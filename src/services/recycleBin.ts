/**
 * Recycle Bin (回收站) 管理工具
 * 用於管理被刪除的 folders 和 pages
 *
 * V7 重構：使用 rootFolders.ts 統一管理系統 folder
 * V10 統一使用 TRASH_FOLDER_ID ('trash')
 */

import { db, Folder, Page } from './db'
import { WorkspaceId } from '../types/workspace'
import { createLogger } from '../utils/logger'
import {
  cleanupFolderLinks,
  getPageLink,
  getFolderDirLink,
  getDirHandle,
  removePageLink,
} from './fileHandleStore'

const log = createLogger('TRASH')
import { getDeviceId } from './deviceInfo'
import { isPageUntouched } from '../utils/pageDefaults'
import {
  isTrashFolderId,
  ensureTrashFolderExists,
  ROOT_FOLDER_ID,
  TRASH_FOLDER_ID,
  RECYCLE_RETENTION_DAYS
} from './rootFolders'

export { RECYCLE_RETENTION_DAYS }

/**
 * 清理 page 的 file link 並刪除 PC 上的 .md 檔案
 * 用於 page 刪除時，防止 rescan 重建已刪除的 page
 */
async function cleanupPageFileLink(pageId: string): Promise<void> {
  const pageLink = await getPageLink(pageId)
  if (!pageLink) return

  // 嘗試刪除 PC 上的 .md 檔案
  try {
    const folderLink = await getFolderDirLink(pageLink.folderId)
    if (folderLink) {
      const dirEntry = await getDirHandle(folderLink.handleId)
      if (dirEntry) {
        let dir = dirEntry.handle
        if (folderLink.subPath) {
          for (const part of folderLink.subPath.split('/')) {
            dir = await dir.getDirectoryHandle(part)
          }
        }
        await dir.removeEntry(pageLink.fileName)
        log(`🗑️ 已刪除 linked 檔案: ${pageLink.fileName}`)
      }
    }
  } catch {
    // 檔案不存在或無權限，忽略
  }

  await removePageLink(pageId)
}

/**
 * 確保 Trash folder 存在
 * 委託給 rootFolders.ensureTrashFolderExists()
 */
export const ensureRecycleFolderExists = async (workspaceId: WorkspaceId): Promise<void> => {
  await ensureTrashFolderExists(workspaceId)
}

/**
 * 檢查 folder 是否為 Trash 或其子 folder
 */
export const isRecycleFolderOrChild = async (folderId: string, workspaceId: WorkspaceId): Promise<boolean> => {
  if (isTrashFolderId(folderId)) {
    return true
  }

  try {
    const folder = await db(workspaceId).getFolder(folderId)
    if (!folder) return false

    if (folder.parentId && isTrashFolderId(folder.parentId)) {
      return true
    }

    if (folder.parentId) {
      return await isRecycleFolderOrChild(folder.parentId, workspaceId)
    }

    return false
  } catch (error) {
    log.error('檢查 Recycle folder 時發生錯誤:', error)
    return false
  }
}

/**
 * 永久刪除 Recycle 內的 Folder
 */
export async function permanentlyDeleteFolder(folderId: string, workspaceId: WorkspaceId, skipConfirm: boolean = false): Promise<void> {
  try {
    const folder = await db(workspaceId).getFolder(folderId)
    if (!folder) throw new Error(`Folder ${folderId} not found`)

    const isInRecycle = await isRecycleFolderOrChild(folderId, workspaceId)
    if (!isInRecycle) throw new Error('Can only permanently delete folders in Recycle')

    if (isTrashFolderId(folderId)) {
      throw new Error('Cannot delete Recycle folder itself')
    }

    if (!skipConfirm) {
      const confirmed = window.confirm(`Permanently delete "${folder.name}"?`)
      if (!confirmed) return
    }

    await deleteFolderRecursive(folderId, workspaceId)
    log(`🗑️ Folder "${folder.name}" permanently deleted`)
  } catch (error) {
    log.error('permanentlyDeleteFolder failed:', error)
    throw error
  }
}

/**
 * 將 Folder 移到 Recycle（連帶所有子 folders 和 pages）
 */
export async function moveFolderToRecycle(folderId: string, workspaceId: WorkspaceId): Promise<void> {
  try {
    await ensureRecycleFolderExists(workspaceId)

    const folder = await db(workspaceId).getFolder(folderId)
    if (!folder) throw new Error(`Folder ${folderId} not found`)
    if (folder.isSystemFolder) throw new Error('Cannot delete system folders')

    // Determine target trash bin
    const targetTrashId = TRASH_FOLDER_ID

    // If already in trash, ignore
    if (folder.parentId === targetTrashId) return

    const now = Date.now()
    const deviceId = await getDeviceId()
    const autoDeleteAt = now + RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000

    // 遞迴處理：folder 本身 + 所有子 folders + 所有 pages 都移到 Trash
    await moveFolderToTrashRecursive(folderId, targetTrashId, now, deviceId, autoDeleteAt, workspaceId)

    log(`✅ Folder "${folder.name}" and all children moved to ${targetTrashId}`)
  } catch (error) {
    log.error('moveFolderToRecycle failed:', error)
    throw error
  }
}

/**
 * 遞迴將 folder 及其子項目移到 Trash
 * 所有項目都移到 trash，保留 originalParentId/originalFolderId 供還原使用
 */
async function moveFolderToTrashRecursive(
  folderId: string,
  targetTrashId: string,
  now: number,
  deviceId: string,
  autoDeleteAt: number,
  workspaceId: WorkspaceId
): Promise<void> {
  const folder = await db(workspaceId).getFolder(folderId)
  if (!folder || folder.isDeleted) return

  // 先遞迴處理子 folders（深度優先）
  const childFolders = await db(workspaceId).getFoldersByParent(folderId)
  await Promise.all(childFolders.map(child =>
    moveFolderToTrashRecursive(child.id, targetTrashId, now, deviceId, autoDeleteAt, workspaceId)
  ))

  // 處理此 folder 下的 pages
  const pages = await db(workspaceId).getPagesByFolder(folderId)
  await Promise.all(pages.map(page =>
    movePageToTrashDirect(page, targetTrashId, now, deviceId, autoDeleteAt, workspaceId)
  ))

  // 清理 directory link 資料（若此 folder 有連結目錄）
  await cleanupFolderLinks(folderId)

  // 移動 folder 到 Trash（對齊 Page 的 hasBeenSynced 模式）
  const hasBeenSynced = !!folder.lastSyncedAt

  if (!hasBeenSynced) {
    // 從未同步過：直接物理刪除，不留 tombstone
    await db(workspaceId).deleteFolder(folderId)
  } else {
    // 已同步過：標記刪除，產生 tombstone 通知其他裝置
    await db(workspaceId).updateFolder({
      ...folder,
      parentId: targetTrashId,
      originalParentId: folder.parentId || undefined,
      deletedAt: now,
      deletedBy: deviceId,
      autoDeleteAt,
      isDeleted: true,
      updatedAt: now,
    })
  }
}

/**
 * 將 page 直接移到 Trash（內部使用，與 movePageToRecycle 一致的處理邏輯）
 */
async function movePageToTrashDirect(
  page: Page,
  targetTrashId: string,
  now: number,
  deviceId: string,
  autoDeleteAt: number,
  workspaceId: WorkspaceId
): Promise<void> {
  if (page.isDeleted) return

  const hasBeenSynced = !!page.lastSyncedAt

  // 「未編輯 page」（空白 or 預設 MM-DD heading）特殊處理：
  // 等同空白頁面，直接走快速通道刪除而非進 Trash
  if (isPageUntouched(page.content)) {
    if (!hasBeenSynced) {
      // 未同步的空白頁面：直接刪除
      await db(workspaceId).deletePage(page.id)
    } else {
      // 已同步的空白頁面：標記刪除（但不移到 trash folder）
      await db(workspaceId).updatePage({
        ...page,
        content: '',
        isDeleted: true,
        deletedAt: now,
        deletedBy: deviceId,
        updatedAt: now,
      })
    }
    return
  }

  // 有內容的頁面：移到 Trash
  await db(workspaceId).updatePage({
    ...page,
    folderId: targetTrashId,
    originalFolderId: page.folderId,
    deletedAt: now,
    deletedBy: deviceId,
    autoDeleteAt,
    isDeleted: hasBeenSynced, // 僅已同步的需要標記
    updatedAt: now,
  })

  // 清理 file link 並刪除 PC 上的 .md 檔案（避免 rescan 重建）
  await cleanupPageFileLink(page.id)
}

/**
 * 將 Page 移到 Recycle
 */
export async function movePageToRecycle(pageId: string, workspaceId: WorkspaceId): Promise<void> {
  try {
    await ensureRecycleFolderExists(workspaceId)

    const page = await db(workspaceId).getPage(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)

    const targetTrashId = TRASH_FOLDER_ID

    if (page.folderId === targetTrashId) return

    const now = Date.now()
    const deviceId = await getDeviceId()
    const hasBeenSynced = !!page.lastSyncedAt

    // 「未編輯 page」（空白 or 預設 MM-DD heading）快速通道：
    // 不進 Trash，直接硬刪（未同步）或 soft delete（已同步）
    if (isPageUntouched(page.content)) {
      if (!hasBeenSynced) {
        // Unsynced empty page -> Hard Delete
        await db(workspaceId).deletePage(pageId)
      } else {
        // Synced empty page -> Soft Delete (mark deleted) but DO NOT move to trash folder
        // This ensures it's hidden from UI (default filter) and Trash (folder filter), but Sync detects deletion
        await db(workspaceId).updatePage({
          ...page,
          content: '',
          isDeleted: true,
          deletedAt: now,
          deletedBy: deviceId,
          updatedAt: now,
        })
      }
      return
    }

    const autoDeleteAt = now + RECYCLE_RETENTION_DAYS * 24 * 60 * 60 * 1000

    await db(workspaceId).updatePage({
      ...page,
      folderId: targetTrashId,
      originalFolderId: page.folderId,
      deletedAt: now,
      deletedBy: deviceId,
      autoDeleteAt,
      isDeleted: hasBeenSynced, // Only mark isDeleted if it needs sync tracking
      updatedAt: now,
    })

    // 清理 file link 並刪除 PC 上的 .md 檔案（避免 rescan 重建）
    await cleanupPageFileLink(pageId)

    log(`✅ Page "${page.name}" moved to ${targetTrashId}`)
  } catch (error) {
    log.error('movePageToRecycle failed:', error)
    throw error
  }
}

/**
 * 從 Recycle 還原 Folder
 * 注意：只還原此 folder，子 folders/pages 需用戶自行還原
 */
export async function restoreFolderFromRecycle(folderId: string, workspaceId: WorkspaceId): Promise<void> {
  try {
    const folder = await db(workspaceId).getFolder(folderId)
    if (!folder) throw new Error(`Folder ${folderId} not found`)

    // Check if in any trash
    if (!folder.parentId || !isTrashFolderId(folder.parentId)) {
      throw new Error('Folder is not in Recycle')
    }

    // 1. Try to find original parent folder
    let targetParentId = folder.originalParentId
    let targetParent: Folder | undefined

    if (targetParentId) {
      targetParent = await db(workspaceId).getFolder(targetParentId)
      // 如果原始父 folder 也在 trash 中（isDeleted），則改用 root
      if (targetParent?.isDeleted) {
        targetParent = undefined
      }
    }

    // 2. If missing or deleted, fallback to root folder
    if (!targetParent) {
      log.warn('Original parent folder missing or deleted, falling back to root folder')
      targetParentId = ROOT_FOLDER_ID
    }

    if (!targetParentId) throw new Error('Cannot restore: no valid target folder')

    await db(workspaceId).updateFolder({
      ...folder,
      parentId: targetParentId,
      originalParentId: undefined,
      deletedAt: undefined,
      deletedBy: undefined,
      autoDeleteAt: undefined,
      updatedAt: Date.now(),
      isDeleted: false
    })

    log(`✅ Folder restored to ${targetParentId}`)
  } catch (error) {
    log.error('restoreFolderFromRecycle failed:', error)
    throw error
  }
}

/**
 * 從 Recycle 還原 Page
 */
export async function restorePageFromRecycle(pageId: string, workspaceId: WorkspaceId): Promise<void> {
  try {
    const page = await db(workspaceId).getPage(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)

    // Check if in any trash
    if (!isTrashFolderId(page.folderId)) {
      throw new Error('Page is not in Recycle')
    }

    // 1. Try to find original folder
    let targetFolderId = page.originalFolderId
    let targetFolder: Folder | undefined

    if (targetFolderId) {
      targetFolder = await db(workspaceId).getFolder(targetFolderId)
    }

    // 2. If missing, fallback to root folder
    if (!targetFolder) {
      log.warn('Original folder missing, falling back to root folder')
      targetFolder = await db(workspaceId).getFolder(ROOT_FOLDER_ID)

      if (!targetFolder) {
        throw new Error(`Root folder not found. Please ensure ensureRootFolderExists() is called on app init.`)
      }
      targetFolderId = targetFolder.id
    }

    if (!targetFolderId) throw new Error('Cannot restore: no valid target folder')

    await db(workspaceId).updatePage({
      ...page,
      folderId: targetFolderId,
      originalFolderId: undefined,
      deletedAt: undefined,
      deletedBy: undefined,
      autoDeleteAt: undefined,
      updatedAt: Date.now(),
      isDeleted: false
    })

    log(`✅ Page restored to ${targetFolderId}`)
  } catch (error) {
    log.error('restorePageFromRecycle failed:', error)
    throw error
  }
}

/**
 * 永久刪除 Page
 */
export async function permanentlyDeletePage(pageId: string, workspaceId: WorkspaceId, skipConfirm: boolean = false): Promise<void> {
  try {
    const page = await db(workspaceId).getPage(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)

    if (!skipConfirm) {
      if (!window.confirm(`Permanently delete "${page.name}"?`)) return
    }

    const hasBeenSynced = !!page.lastSyncedAt

    if (!hasBeenSynced) {
      await db(workspaceId).deletePage(pageId)
    } else {
      // Mark deleted for sync, content cleared
      const now = Date.now()
      await db(workspaceId).updatePage({
        ...page,
        content: '',
        isDeleted: true,
        deletedAt: now,
        deletedBy: await getDeviceId(),
        updatedAt: now,
      })
    }
    // 清理 file link 並刪除 PC 上的 .md 檔案
    await cleanupPageFileLink(pageId)

    log(`🗑️ Page "${page.name}" permanently deleted`)
  } catch (error) {
    log.error('permanentlyDeletePage failed:', error)
    throw error
  }
}

/**
 * 自動清理過期的 Trash 項目
 */
export async function autoCleanupRecycle(workspaceId: WorkspaceId): Promise<{ pages: number; folders: number }> {
  try {
    const now = Date.now()
    let pagesDeleted = 0
    let foldersDeleted = 0

    const allPages = await db(workspaceId).getAllPages()
    const trashIds = [TRASH_FOLDER_ID]

    // 清理過期的 pages
    const expiredPages = allPages.filter(
      p => trashIds.includes(p.folderId) && p.autoDeleteAt && p.autoDeleteAt <= now
    )

    for (const page of expiredPages) {
      await permanentlyDeletePage(page.id, workspaceId, true)
      pagesDeleted++
    }

    // 清理過期的 folders
    const allFolders = await db(workspaceId).getAllFolders()
    const expiredFolders = allFolders.filter(
      f => f.parentId && trashIds.includes(f.parentId) && f.autoDeleteAt && f.autoDeleteAt <= now
    )

    for (const folder of expiredFolders) {
      await permanentlyDeleteFolder(folder.id, workspaceId, true)
      foldersDeleted++
    }

    if (pagesDeleted > 0 || foldersDeleted > 0) {
      log(`🧹 Auto cleanup: ${pagesDeleted} pages, ${foldersDeleted} folders deleted`)
    }

    return { pages: pagesDeleted, folders: foldersDeleted }
  } catch (e) {
    log.error('Auto cleanup failed:', e)
    return { pages: 0, folders: 0 }
  }
}

/**
 * 工具: 遞迴刪除 folder 及其所有子項目
 * 使用 Promise.all 並行刪除以提升效能
 */
export const deleteFolderRecursive = async (folderId: string, workspaceId: WorkspaceId): Promise<void> => {
  // 並行遞迴刪除子 folders
  const childFolders = await db(workspaceId).getFoldersByParent(folderId)
  await Promise.all(childFolders.map(child => deleteFolderRecursive(child.id, workspaceId)))

  // 並行刪除此 folder 下的所有 pages
  const pages = await db(workspaceId).getPagesByFolder(folderId)
  await Promise.all(pages.map(page => db(workspaceId).deletePage(page.id)))

  // 清理 directory link 資料（若此 folder 有連結目錄）
  await cleanupFolderLinks(folderId)

  // 最後刪除 folder 本身
  await db(workspaceId).deleteFolder(folderId)
}
