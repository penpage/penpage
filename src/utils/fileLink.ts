/**
 * 目錄級檔案連結：Pull / Push / Sync
 * 透過 DirectoryHandle + subPath + fileName 定位檔案
 */

import { db, Page } from '../services/db'
import { movePageToRecycle } from '../services/recycleBin'
import { WorkspaceId } from '../types/workspace'
import {
  getResolvedHandle,
  removePageLink,
  updatePageSyncState,
  getPageLink,
  tryCleanupFolderIfDirGone,
  getFolderDirLink,
  getDirHandle,
  getPageLinksByFolder,
  getAllLinkedFolderIds,
  savePageLink,
  resolveFileHandle,
  saveDirHandle,
  findDirHandleBySameEntry,
  saveFolderDirLink,
} from '../services/fileHandleStore'
import { createPageWithContent } from '../services/pageHelper'
import { calculateContentHash } from './hashCalculator'
import { normalizeImagePaths } from './imagePathConverter'
import { extractPageTitle } from './markdownConverter'
import { listMdFileNames, selectDirectoryWithHandles } from './fileOperations'
import { createLogger } from '../utils/logger'

const log = createLogger('FILE-LINK')

export type FileLinkResult =
  | 'success'
  | 'unchanged'
  | 'NO_HANDLE'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'ENCRYPTION_LOCKED'

export type SyncResult = FileLinkResult | 'conflict' | 'pulled' | 'pushed'

/**
 * Pull：從本地檔案更新 page 內容
 */
export async function pullFromFile(pageId: string, workspaceId: WorkspaceId): Promise<FileLinkResult> {
  const resolved = await getResolvedHandle(pageId)
  if (!resolved) return 'NO_HANDLE'

  const { fileHandle, dirHandle } = resolved

  try {
    // 對 dirHandle 請求 read 權限
    const permission = await dirHandle.requestPermission({ mode: 'read' })
    if (permission !== 'granted') return 'PERMISSION_DENIED'

    // 讀取檔案
    const file = await fileHandle.getFile()
    const rawContent = await file.text()
    const content = normalizeImagePaths(rawContent)

    // 比對 hash
    const newHash = await calculateContentHash(content)
    const page = await db(workspaceId).getPage(pageId)
    if (!page) {
      await removePageLink(pageId)
      return 'NO_HANDLE'
    }

    if (page.contentHash === newHash) return 'unchanged'

    // 更新 page（使用檔案時間戳）
    const name = extractPageTitle(content) || page.name
    await db(workspaceId).updatePage({
      ...page,
      content,
      name,
      contentHash: newHash,
      updatedAt: file.lastModified
    })

    await updatePageSyncState(pageId, file.lastModified, newHash)
    return 'success'
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      const pageLink = await getPageLink(pageId)
      await removePageLink(pageId)
      // 嘗試清理整個 folder link（如果目錄已不存在）
      if (pageLink?.folderId) {
        await tryCleanupFolderIfDirGone(pageLink.folderId)
      }
      return 'FILE_NOT_FOUND'
    }
    if (err?.name === 'NotAllowedError') {
      return 'PERMISSION_DENIED'
    }
    throw err
  }
}

/**
 * Push：把 page 內容寫回本地檔案
 */
export async function pushToFile(pageId: string, workspaceId: WorkspaceId): Promise<FileLinkResult> {
  const resolved = await getResolvedHandle(pageId)
  if (!resolved) return 'NO_HANDLE'

  const { fileHandle, dirHandle } = resolved

  const page = await db(workspaceId).getPage(pageId)
  if (!page) return 'NO_HANDLE'

  if (page.isEncrypted) return 'ENCRYPTION_LOCKED'

  try {
    // 對 dirHandle 請求 readwrite 權限
    const permission = await dirHandle.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') return 'PERMISSION_DENIED'

    // 寫入檔案
    const writable = await fileHandle.createWritable()
    await writable.write(page.content)
    await writable.close()

    // 更新 sync state + page.updatedAt 同步為檔案寫入時間
    const file = await fileHandle.getFile()
    await db(workspaceId).updatePage({ ...page, updatedAt: file.lastModified })
    await updatePageSyncState(pageId, file.lastModified, page.contentHash || '')

    return 'success'
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      const pageLink = await getPageLink(pageId)
      await removePageLink(pageId)
      if (pageLink?.folderId) {
        await tryCleanupFolderIfDirGone(pageLink.folderId)
      }
      return 'FILE_NOT_FOUND'
    }
    if (err?.name === 'NotAllowedError') {
      return 'PERMISSION_DENIED'
    }
    throw err
  }
}

/**
 * Conflict 解決：比較時間戳，自動選擇較新的一方
 * 回傳 'pulled' | 'pushed' 表示最終方向
 */
export async function resolveConflictByNewest(
  pageId: string,
  workspaceId: WorkspaceId
): Promise<{ direction: 'pulled' | 'pushed', result: FileLinkResult }> {
  const resolved = await getResolvedHandle(pageId)
  if (!resolved) return { direction: 'pulled', result: 'NO_HANDLE' }

  const { fileHandle, dirHandle } = resolved
  const readPerm = await dirHandle.queryPermission({ mode: 'read' })
  if (readPerm !== 'granted') {
    const perm = await dirHandle.requestPermission({ mode: 'read' })
    if (perm !== 'granted') return { direction: 'pulled', result: 'PERMISSION_DENIED' }
  }

  const file = await fileHandle.getFile()
  const page = await db(workspaceId).getPage(pageId)
  if (!page) return { direction: 'pulled', result: 'NO_HANDLE' }

  // 比較時間：檔案較新 → pull，頁面較新或相同 → push
  if (file.lastModified > page.updatedAt) {
    const result = await pullFromFile(pageId, workspaceId)
    return { direction: 'pulled', result }
  } else {
    const result = await pushToFile(pageId, workspaceId)
    return { direction: 'pushed', result }
  }
}

/**
 * Sync：自動偵測方向並同步
 * 兩階段權限：先 read（判斷方向 + pull），push 時才升 readwrite
 */
export async function syncFile(
  pageId: string,
  workspaceId: WorkspaceId,
  options: { silent?: boolean } = {}
): Promise<SyncResult> {
  const pageLink = await getPageLink(pageId)
  if (!pageLink) return 'NO_HANDLE'

  // 靜默模式下，autoSync 關閉時跳過
  if (options.silent && pageLink.autoSync === false) return 'unchanged'

  const resolved = await getResolvedHandle(pageId)
  if (!resolved) return 'NO_HANDLE'

  const { fileHandle, dirHandle } = resolved

  try {
    // 第一階段：read 權限（pull 只需要 read）
    const readPermission = await dirHandle.queryPermission({ mode: 'read' })
    if (readPermission !== 'granted') {
      if (options.silent) return 'PERMISSION_DENIED'
      const permission = await dirHandle.requestPermission({ mode: 'read' })
      if (permission !== 'granted') return 'PERMISSION_DENIED'
    }

    // 讀取檔案和 page
    const file = await fileHandle.getFile()
    const page = await db(workspaceId).getPage(pageId)
    if (!page) {
      await removePageLink(pageId)
      return 'NO_HANDLE'
    }

    if (page.isEncrypted) return 'ENCRYPTION_LOCKED'

    // 首次 sync（沒有快照）：建立快照，不做任何同步
    if (pageLink.fileUpdateTime === undefined || pageLink.pageContentHash === undefined) {
      await updatePageSyncState(pageId, file.lastModified, page.contentHash || '')
      return 'unchanged'
    }

    // 比對變化
    const fileChanged = file.lastModified !== pageLink.fileUpdateTime
    const pageChanged = page.contentHash !== pageLink.pageContentHash

    if (!fileChanged && !pageChanged) {
      return 'unchanged'
    }

    if (fileChanged && pageChanged) {
      return 'conflict'
    }

    if (fileChanged) {
      // 檔案改了 → pull（read 權限已足夠）
      const rawContent = await file.text()
      const content = normalizeImagePaths(rawContent)
      const newHash = await calculateContentHash(content)

      // 內容實際上相同（檔案 touch 但沒改內容）
      if (page.contentHash === newHash) {
        await updatePageSyncState(pageId, file.lastModified, newHash)
        return 'unchanged'
      }

      const name = extractPageTitle(content) || page.name
      await db(workspaceId).updatePage({
        ...page,
        content,
        name,
        contentHash: newHash,
        updatedAt: file.lastModified
      })
      await updatePageSyncState(pageId, file.lastModified, newHash)
      return 'pulled'
    }

    // pageChanged → push：需要 readwrite 權限
    const rwPermission = await dirHandle.queryPermission({ mode: 'readwrite' })
    if (rwPermission !== 'granted') {
      if (options.silent) return 'PERMISSION_DENIED'
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' })
      if (permission !== 'granted') return 'PERMISSION_DENIED'
    }

    const writable = await fileHandle.createWritable()
    await writable.write(page.content)
    await writable.close()

    const updatedFile = await fileHandle.getFile()
    await updatePageSyncState(pageId, updatedFile.lastModified, page.contentHash || '')
    return 'pushed'
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      // pageLink 已在函數開頭取得
      await removePageLink(pageId)
      if (pageLink?.folderId) {
        await tryCleanupFolderIfDirGone(pageLink.folderId)
      }
      return 'FILE_NOT_FOUND'
    }
    if (err?.name === 'NotAllowedError') {
      return 'PERMISSION_DENIED'
    }
    throw err
  }
}

// ===== 工具函數 =====

/**
 * 過濾 stale pageLinks（page 已刪除或不存在），並清理殘留記錄
 */
async function filterValidLinks(
  existingLinks: Awaited<ReturnType<typeof getPageLinksByFolder>>,
  workspaceId: WorkspaceId
) {
  const validLinks: typeof existingLinks = []
  let removedNotFound = 0
  let removedDeleted = 0
  for (const link of existingLinks) {
    const page = await db(workspaceId).getPage(link.pageId)
    if (page && !page.isDeleted) {
      validLinks.push(link)
    } else {
      if (!page) removedNotFound++
      else removedDeleted++
      await removePageLink(link.pageId)
    }
  }
  if (removedNotFound + removedDeleted > 0) {
    log(`Links: ${existingLinks.length} → ${validLinks.length} valid (${removedNotFound} not-found, ${removedDeleted} deleted)`)
  }
  return validLinks
}

/**
 * 清理檔名中的不合法字元
 */
function sanitizeFileName(title: string): string {
  let name = title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')     // OS 不合法字元
    .replace(/\.+$/, '')                         // 移除結尾點（Windows 相容）
    .replace(/_+/g, '_')                         // 合併連續底線
    .trim()

  // 長度限制：UTF-8 最多 251 bytes（留 4 bytes 給 .md）
  const encoder = new TextEncoder()
  while (encoder.encode(name).length > 251) {
    name = name.slice(0, -1)
  }

  return name || 'untitled'
}

/**
 * 產生不衝突的檔名（加序號）
 */
function uniqueFileName(baseName: string, existingNames: Set<string>): string {
  const fileName = `${baseName}.md`
  if (!existingNames.has(fileName)) return fileName

  let i = 1
  while (existingNames.has(`${baseName}-${i}.md`)) i++
  return `${baseName}-${i}.md`
}

/**
 * 將 page 內容寫入新的 .md 檔案並建立 link
 */
async function exportPageToFile(
  page: Page,
  folderId: string,
  dirHandle: FileSystemDirectoryHandle,
  subPath: string,
  existingFileNames: Set<string>
): Promise<string | null> {
  try {
    if (page.isEncrypted) return null

    const baseName = sanitizeFileName(page.name || 'untitled')
    const fileName = uniqueFileName(baseName, existingFileNames)

    // 定位到子目錄
    let dir = dirHandle
    if (subPath) {
      for (const part of subPath.split('/')) {
        dir = await dir.getDirectoryHandle(part)
      }
    }

    // 建立並寫入檔案
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(page.content)
    await writable.close()

    // 建立 pageLink + sync snapshot
    const file = await fileHandle.getFile()
    await savePageLink(page.id, folderId, fileName)
    await updatePageSyncState(page.id, file.lastModified, page.contentHash || '')

    existingFileNames.add(fileName)
    return fileName
  } catch (err: any) {
    log.warn(`Export: 無法匯出 page ${page.id}: ${err?.message}`)
    return null
  }
}

// ===== Rescan：偵測 linked folder 內所有變更（雙向同步 + dedup） =====

export interface RescanFolderOptions {
  silent?: boolean  // default true: queryPermission; false: requestPermission
}

export interface RescanFolderResult {
  newPages: Page[]
  pulledNew: number         // 新 MD → page
  pushedNew: number         // page → 新 .md
  dedupLinked: number       // linked (dedup)
  dedupPage: number         // dedup page
  dedupMdFile: number       // dedup MD file — 目錄內重複 .md 清理
  deletePage: number        // delete page (linked MD gone)
  pulled: number            // 已 linked 內容 pull
  pushed: number            // 已 linked 內容 push
  conflictCount: number     // conflict fork 次數
  linkedMatch: number       // 已 linked 兩邊一致
  pulledPageIds: string[]   // 被 pull 的 pageIds（讓呼叫端刷新 UI）
}

/**
 * 刪除目錄內指定檔案
 */
async function deleteFileFromDir(
  dirHandle: FileSystemDirectoryHandle,
  subPath: string,
  fileName: string
): Promise<void> {
  let dir = dirHandle
  if (subPath) {
    for (const part of subPath.split('/')) {
      dir = await dir.getDirectoryHandle(part)
    }
  }
  await dir.removeEntry(fileName)
}

/**
 * Rescan 單一 linked folder，完整雙向同步：
 * 1. dir → folder：新 .md 建 page（pulled new）
 * 2. folder → dir：無 link 的 page 建 .md（pushed new）
 * 3. 目錄內重複 .md 清理（dedup MD file）
 * 4. 已 linked pages：syncFile 雙向更新（pull / push / conflict fork）
 */
export async function rescanLinkedFolder(
  folderId: string,
  workspaceId: WorkspaceId,
  options: RescanFolderOptions = {}
): Promise<RescanFolderResult | null> {
  try {
    const folderLink = await getFolderDirLink(folderId)
    if (!folderLink) return null

    const dirEntry = await getDirHandle(folderLink.handleId)
    if (!dirEntry) return null

    // 權限檢查：silent 用 query，非 silent 用 request
    const readPermission = options.silent !== false
      ? await dirEntry.handle.queryPermission({ mode: 'read' })
      : await dirEntry.handle.requestPermission({ mode: 'read' })
    if (readPermission !== 'granted') return null

    // 輕量掃描：只列檔名
    const allFileNames = await listMdFileNames(dirEntry.handle, folderLink.subPath)
    const allFileNameSet = new Set(allFileNames)

    // 取得已連結的檔名集合（過濾掉已刪除 page 的 stale links）
    const existingLinks = await getPageLinksByFolder(folderId)
    const validLinks = await filterValidLinks(existingLinks, workspaceId)

    // folder 名稱（用於 ❌ log 前綴）
    const folder = await db(workspaceId).getFolder(folderId)
    const folderName = folder?.name ?? folderId

    // 清理 stale links：page 存在但 fileName 不在目錄 → 移除 link + page 移到 trash
    const freshLinks: typeof validLinks = []
    let deletePage = 0
    for (const link of validLinks) {
      if (allFileNameSet.has(link.fileName)) {
        freshLinks.push(link)
      } else {
        await removePageLink(link.pageId)
        await movePageToRecycle(link.pageId, workspaceId)
        deletePage++
        log(`📁${folderName} 📄 ${link.fileName} → delete page (linked MD gone) ❌`)
      }
    }

    const linkedFileNames = new Set(freshLinks.map(l => l.fileName))
    const linkedPageIds = new Set(freshLinks.map(l => l.pageId))
    const pageLinkMap = new Map(freshLinks.map(l => [l.pageId, l]))

    // === 建立 contentHash dedup map（防止重複 import/export） ===
    const allPages = await db(workspaceId).getPagesByFolder(folderId)
    const activeHashMap = new Map<string, Page>() // contentHash → page
    for (const p of allPages) {
      if (!p.isDeleted && p.contentHash) {
        activeHashMap.set(p.contentHash, p)
      }
    }

    // === dir → folder：新 .md 建 page（含 contentHash dedup） ===
    const newFileNames = allFileNames.filter(name => !linkedFileNames.has(name))
    const newPages: Page[] = []
    let pulledNew = 0
    let dedupLinked = 0
    for (const fileName of newFileNames) {
      try {
        const fileHandle = await resolveFileHandle(dirEntry.handle, folderLink.subPath, fileName)
        const file = await fileHandle.getFile()
        const rawContent = await file.text()
        const content = normalizeImagePaths(rawContent)
        const contentHash = await calculateContentHash(content)

        // contentHash dedup：已有相同內容的 page → 直接建 link，不建新 page
        const existingPage = activeHashMap.get(contentHash)
        if (existingPage && !linkedPageIds.has(existingPage.id)) {
          await savePageLink(existingPage.id, folderId, fileName)
          await updatePageSyncState(existingPage.id, file.lastModified, contentHash)
          linkedPageIds.add(existingPage.id)
          activeHashMap.delete(contentHash)
          dedupLinked++
          continue
        }

        if (existingPage && linkedPageIds.has(existingPage.id)) {
          const existingLink = pageLinkMap.get(existingPage.id)
          if (existingLink && !allFileNameSet.has(existingLink.fileName)) {
            await savePageLink(existingPage.id, folderId, fileName)
            await updatePageSyncState(existingPage.id, file.lastModified, contentHash)
            linkedFileNames.add(fileName)
            dedupLinked++
            continue
          }
        }

        const { page } = await createPageWithContent(folderId, content, fileName, file.lastModified, workspaceId)
        await savePageLink(page.id, folderId, fileName)
        await updatePageSyncState(page.id, file.lastModified, contentHash)
        linkedPageIds.add(page.id)

        newPages.push(page)
        pulledNew++
        log(`📁${folderName} 📄 ${fileName} → pulled (new) ❌`)
      } catch (err: any) {
        log.warn(`Rescan: 無法匯入 ${fileName}: ${err?.message}`)
      }
    }

    // === folder → dir：無 link 的 page 建 .md（含 contentHash dedup） ===
    let pushedNew = 0
    let dedupPage = 0
    const hasRwPermission = options.silent !== false
      ? (await dirEntry.handle.queryPermission({ mode: 'readwrite' })) === 'granted'
      : (await dirEntry.handle.requestPermission({ mode: 'readwrite' })) === 'granted'

    if (hasRwPermission) {
      const linkedHashes = new Set<string>()
      for (const p of allPages) {
        if (linkedPageIds.has(p.id) && p.contentHash) {
          linkedHashes.add(p.contentHash)
        }
      }

      const unlinkedPages = allPages.filter(p => !linkedPageIds.has(p.id) && !p.isDeleted)

      for (const page of unlinkedPages) {
        // 內容跟已連結 page 相同 → 重複 page，移到 trash
        if (page.contentHash && linkedHashes.has(page.contentHash)) {
          await movePageToRecycle(page.id, workspaceId)
          dedupPage++
          log(`📁${folderName} 📄 ${page.name || page.id} → dedup page ❌`)
          continue
        }

        const result = await exportPageToFile(
          page, folderId, dirEntry.handle, folderLink.subPath, allFileNameSet
        )
        if (result) {
          pushedNew++
          linkedPageIds.add(page.id)
          log(`📁${folderName} 📄 ${result} → pushed (new) ❌`)
        }
      }
    }

    // === 清理目錄內同 hash 重複 .md（與 Drive dedup 邏輯一致：保留 createdAt 最小） ===
    let dedupMdFile = 0
    if (hasRwPermission) {
      const hashToEntries = new Map<string, { link: typeof freshLinks[0], page: Page }[]>()
      for (const link of freshLinks) {
        const page = allPages.find(p => p.id === link.pageId)
        if (page?.contentHash) {
          const group = hashToEntries.get(page.contentHash) || []
          group.push({ link, page })
          hashToEntries.set(page.contentHash, group)
        }
      }

      for (const [, group] of hashToEntries) {
        if (group.length < 2) continue
        // 按 createdAt 升序，保留第一個（最舊）— 與 Drive dedup 一致
        group.sort((a, b) => a.page.createdAt - b.page.createdAt)
        for (let i = 1; i < group.length; i++) {
          const entry = group[i]
          await deleteFileFromDir(dirEntry.handle, folderLink.subPath, entry.link.fileName)
          await removePageLink(entry.link.pageId)
          await movePageToRecycle(entry.link.pageId, workspaceId)
          // 從 freshLinks 移除（避免後續 syncFile loop 處理到）
          const idx = freshLinks.indexOf(entry.link)
          if (idx >= 0) freshLinks.splice(idx, 1)
          dedupMdFile++
          log(`📁${folderName} 📄 ${entry.link.fileName} → dedup MD file ❌`)
        }
      }
    }

    // === 已 linked pages：syncFile 雙向更新 ===
    let pulled = 0, pushed = 0, linkedMatch = 0, conflictCount = 0
    const pulledPageIds: string[] = []
    for (const link of freshLinks) {
      try {
        const result = await syncFile(link.pageId, workspaceId, { silent: options.silent !== false })
        if (result === 'pulled') {
          pulled++
          pulledPageIds.push(link.pageId)
          log(`📁${folderName} 📄 ${link.fileName} → pulled ❌`)
        } else if (result === 'pushed') {
          pushed++
          log(`📁${folderName} 📄 ${link.fileName} → pushed ❌`)
        } else if (result === 'conflict') {
          conflictCount++

          // 1. 解除舊 link
          await removePageLink(link.pageId)

          // 2. Pull：讀 MD → 建新 Page + link
          const fileHandle = await resolveFileHandle(dirEntry.handle, folderLink.subPath, link.fileName)
          const file = await fileHandle.getFile()
          const content = normalizeImagePaths(await file.text())
          const contentHash = await calculateContentHash(content)
          const { page: newPage } = await createPageWithContent(
            folderId, content, link.fileName, file.lastModified, workspaceId
          )
          await savePageLink(newPage.id, folderId, link.fileName)
          await updatePageSyncState(newPage.id, file.lastModified, contentHash)
          pulledPageIds.push(newPage.id)
          log(`📁${folderName} 📄 ${link.fileName} → conflict: pulled (new) ❌`)

          // 3. Push：原 Page → 建新 .md + link（需 rw）
          if (hasRwPermission) {
            const page = allPages.find(p => p.id === link.pageId)
            if (page) {
              const exportResult = await exportPageToFile(
                page, folderId, dirEntry.handle, folderLink.subPath, allFileNameSet
              )
              if (exportResult) {
                log(`📁${folderName} 📄 ${exportResult} → conflict: pushed (new) ❌`)
              }
            }
          }
        } else {
          linkedMatch++
        }
      } catch {}
    }

    return {
      newPages, pulledNew, pushedNew, dedupLinked, dedupPage, dedupMdFile,
      deletePage, pulled, pushed, conflictCount, linkedMatch, pulledPageIds
    }
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      await tryCleanupFolderIfDirGone(folderId)
    }
    return null
  }
}

/**
 * Rescan 所有 linked folders，完整雙向同步
 */
export async function rescanAllLinkedFolders(workspaceId: WorkspaceId): Promise<{
  totalNewPages: number
  totalPulled: number
  totalPushed: number
  totalConflicts: number
  pulledPageIds: string[]
  folderResults: Map<string, number>
}> {
  const folderIds = await getAllLinkedFolderIds(workspaceId)
  const folderResults = new Map<string, number>()
  let totalNewPages = 0
  let totalPulled = 0
  let totalPushed = 0
  let totalConflicts = 0
  let totalLinkedMatch = 0
  let totalDedupLinked = 0
  let totalPushedNew = 0
  let totalDedupPage = 0
  let totalDedupMdFile = 0
  let totalDeletePage = 0
  const pulledPageIds: string[] = []

  for (const folderId of folderIds) {
    const result = await rescanLinkedFolder(folderId, workspaceId)
    if (result) {
      if (result.pulledNew > 0) {
        folderResults.set(folderId, result.pulledNew)
        totalNewPages += result.pulledNew
      }
      totalPulled += result.pulled
      totalPushed += result.pushed
      totalConflicts += result.conflictCount
      totalLinkedMatch += result.linkedMatch
      totalDedupLinked += result.dedupLinked
      totalPushedNew += result.pushedNew
      totalDedupPage += result.dedupPage
      totalDedupMdFile += result.dedupMdFile
      totalDeletePage += result.deletePage
      pulledPageIds.push(...result.pulledPageIds)
    }
  }

  // 只顯示一行 summary：異常項目用 ❌ 標記，正常項目不標
  const parts: string[] = []
  if (totalLinkedMatch > 0) parts.push(`${totalLinkedMatch} match`)
  if (totalDedupLinked > 0) parts.push(`${totalDedupLinked} dedup-linked`)
  if (totalNewPages > 0) parts.push(`${totalNewPages} pulled (new) ❌`)
  if (totalPushedNew > 0) parts.push(`${totalPushedNew} pushed (new) ❌`)
  if (totalPulled > 0) parts.push(`${totalPulled} pulled ❌`)
  if (totalPushed > 0) parts.push(`${totalPushed} pushed ❌`)
  if (totalConflicts > 0) parts.push(`${totalConflicts} conflict ❌`)
  if (totalDedupPage > 0) parts.push(`${totalDedupPage} dedup page ❌`)
  if (totalDedupMdFile > 0) parts.push(`${totalDedupMdFile} dedup MD ❌`)
  if (totalDeletePage > 0) parts.push(`${totalDeletePage} delete page ❌`)
  log(`✅ Rescan ${folderIds.size} folders: ${parts.join(', ') || 'all matched'}`)

  return { totalNewPages, totalPulled, totalPushed, totalConflicts, pulledPageIds, folderResults }
}

// ===== 連結現有 folder 到 MD directory =====

/**
 * 將現有 folder 連結到 MD 目錄，並做內容比對
 * 匹配到的 page 直接建 link，未匹配的雙向建立
 */
export async function linkDirectoryToFolder(folderId: string, workspaceId: WorkspaceId): Promise<{
  matched: number
  imported: number
  exported: number
} | null> {
  // 1. 選擇目錄
  const { dirHandle } = await selectDirectoryWithHandles()

  // 2. 檢查/建立 dirHandle
  const existing = await findDirHandleBySameEntry(dirHandle)
  const handleId = existing
    ? existing.handleId
    : await saveDirHandle(dirHandle)

  // 3. 建立 folderDirLink（記錄所屬 workspace）
  await saveFolderDirLink(folderId, handleId, '', workspaceId)

  // 4. 請求 readwrite 權限（首次連結，使用者預期）
  const permission = await dirHandle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') {
    // 至少有 link，但無法匯出。用 read-only 做單向
    return await matchAndLinkReadOnly(folderId, dirHandle, '', workspaceId)
  }

  // 5. 內容比對 + 雙向建立
  return await matchAndLinkExistingPages(folderId, dirHandle, '', workspaceId)
}

/**
 * 內容比對：用 contentHash 匹配 folder 內 pages 與 dir 內 .md 檔案
 * 需要 readwrite 權限（會建立新 .md）
 */
async function matchAndLinkExistingPages(
  folderId: string,
  dirHandle: FileSystemDirectoryHandle,
  subPath: string,
  workspaceId: WorkspaceId
): Promise<{ matched: number; imported: number; exported: number }> {
  const allFileNames = await listMdFileNames(dirHandle, subPath)
  const allFileNameSet = new Set(allFileNames)
  const allPages = await db(workspaceId).getPagesByFolder(folderId)
  const activePagesMap = new Map<string, Page>() // contentHash → page
  for (const p of allPages) {
    if (!p.isDeleted && p.contentHash) {
      activePagesMap.set(p.contentHash, p)
    }
  }

  let matched = 0
  let imported = 0
  const matchedPageIds = new Set<string>()

  // 對每個 .md 檔做比對
  for (const fileName of allFileNames) {
    try {
      const fileHandle = await resolveFileHandle(dirHandle, subPath, fileName)
      const file = await fileHandle.getFile()
      const rawContent = await file.text()
      const content = normalizeImagePaths(rawContent)
      const contentHash = await calculateContentHash(content)

      // 在 folder pages 中找 contentHash 匹配的 page
      const matchedPage = activePagesMap.get(contentHash)
      if (matchedPage && !matchedPageIds.has(matchedPage.id)) {
        // 匹配到 → 直接建 link
        await savePageLink(matchedPage.id, folderId, fileName)
        await updatePageSyncState(matchedPage.id, file.lastModified, contentHash)
        matchedPageIds.add(matchedPage.id)
        activePagesMap.delete(contentHash)
        matched++
      } else {
        // 未匹配 → 建新 page
        const { page } = await createPageWithContent(folderId, content, fileName, file.lastModified, workspaceId)
        await savePageLink(page.id, folderId, fileName)
        await updatePageSyncState(page.id, file.lastModified, contentHash)
        imported++
      }
    } catch (err: any) {
      log.warn(`Match: 無法處理 ${fileName}: ${err?.message}`)
    }
  }

  // 剩餘未匹配的 pages → 建立 .md 檔案
  let exported = 0
  const remainingPages = allPages.filter(p => !p.isDeleted && !matchedPageIds.has(p.id))
  // 排除已經被匯入的新 pages（它們已有 link）
  const existingLinks = await getPageLinksByFolder(folderId)
  const linkedPageIds = new Set(existingLinks.map(l => l.pageId))

  for (const page of remainingPages) {
    if (linkedPageIds.has(page.id)) continue
    const result = await exportPageToFile(
      page, folderId, dirHandle, subPath, allFileNameSet
    )
    if (result) exported++
  }

  log(`✅ Link folder ${folderId}: ${matched} matched, ${imported} imported, ${exported} exported`)
  return { matched, imported, exported }
}

/**
 * Read-only 模式：只做 dir → folder（沒有 readwrite 權限時）
 */
async function matchAndLinkReadOnly(
  folderId: string,
  dirHandle: FileSystemDirectoryHandle,
  subPath: string,
  workspaceId: WorkspaceId
): Promise<{ matched: number; imported: number; exported: number }> {
  const allFileNames = await listMdFileNames(dirHandle, subPath)
  const allPages = await db(workspaceId).getPagesByFolder(folderId)
  const activePagesMap = new Map<string, Page>()
  for (const p of allPages) {
    if (!p.isDeleted && p.contentHash) {
      activePagesMap.set(p.contentHash, p)
    }
  }

  let matched = 0
  let imported = 0
  const matchedPageIds = new Set<string>()

  for (const fileName of allFileNames) {
    try {
      const fileHandle = await resolveFileHandle(dirHandle, subPath, fileName)
      const file = await fileHandle.getFile()
      const rawContent = await file.text()
      const content = normalizeImagePaths(rawContent)
      const contentHash = await calculateContentHash(content)

      const matchedPage = activePagesMap.get(contentHash)
      if (matchedPage && !matchedPageIds.has(matchedPage.id)) {
        await savePageLink(matchedPage.id, folderId, fileName)
        await updatePageSyncState(matchedPage.id, file.lastModified, contentHash)
        matchedPageIds.add(matchedPage.id)
        activePagesMap.delete(contentHash)
        matched++
      } else {
        const { page } = await createPageWithContent(folderId, content, fileName, file.lastModified, workspaceId)
        await savePageLink(page.id, folderId, fileName)
        await updatePageSyncState(page.id, file.lastModified, contentHash)
        imported++
      }
    } catch (err: any) {
      log.warn(`Match(RO): 無法處理 ${fileName}: ${err?.message}`)
    }
  }

  log(`✅ Link folder ${folderId} (read-only): ${matched} matched, ${imported} imported`)
  return { matched, imported, exported: 0 }
}

