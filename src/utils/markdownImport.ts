/**
 * Markdown 檔案匯入共用模組
 * 統一處理 Drag & Drop、檔案關聯開啟、按鈕選擇三種入口的匯入邏輯
 */

import { db, Folder, Page } from '../services/db'
import { WorkspaceId } from '../types/workspace'
import { calculateContentHash } from './hashCalculator'
import { createPageWithContent } from '../services/pageHelper'
import { ROOT_FOLDER_ID, isTrashFolderId } from '../services/rootFolders'
import { normalizeImagePaths } from './imagePathConverter'
import { generateFolderId } from './idGenerator'
import { DirectoryNode, isValidDirectoryNode } from './directoryImport'

// 匯入檔案的資料結構
export interface MarkdownFile {
  name: string
  content: string
  lastModified?: number          // 檔案的 lastModified 時間戳
}

// 匯入結果
export interface ImportResult {
  importedPages: Page[]       // 新匯入的 pages
  duplicateCount: number      // 重複跳過的數量
  lastPage: Page | null       // 最後處理的 page（用於 UI 顯示）
  duplicateFolderName?: string // 若單檔重複，已存在的 folder 名稱
}

/**
 * 決定目標 folder（排除 trash）
 */
export function resolveTargetFolderId(selectedFolderId: string | null): string {
  if (!selectedFolderId || isTrashFolderId(selectedFolderId)) {
    return ROOT_FOLDER_ID
  }
  return selectedFolderId
}

/**
 * 統一匯入 Markdown 檔案（支援單檔/多檔）
 *
 * @param files 要匯入的檔案陣列
 * @param targetFolderId 目標 folder ID
 * @param workspaceId Workspace ID
 * @returns 匯入結果
 */
export async function importMarkdownFiles(
  files: MarkdownFile[],
  targetFolderId: string,
  workspaceId: WorkspaceId
): Promise<ImportResult> {
  // 1. 取得所有現有 pages（排除 trash）建立 hash 索引
  const allPages = await db(workspaceId).getAllPages()
  const existingHashes = new Map<string, Page>()

  for (const p of allPages) {
    if (p.contentHash && !isTrashFolderId(p.folderId)) {
      existingHashes.set(p.contentHash, p)
    }
  }

  // 2. 處理每個檔案
  const importedHashes = new Set<string>()
  const importedPages: Page[] = []
  let duplicateCount = 0
  let lastPage: Page | null = null
  let duplicateFolderName: string | undefined

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    // 標準化圖片路徑後再計算 hash（確保 hash 一致性）
    // 這樣從 V3.1 備份匯出的 .md 檔案（含相對路徑）
    // 在 Open MD 時會轉回 image:// 格式，hash 相同不會建立重複頁面
    const normalizedContent = normalizeImagePaths(file.content)
    const hash = await calculateContentHash(normalizedContent)

    // 檢查是否重複（現有 + 本次匯入中）
    if (existingHashes.has(hash) || importedHashes.has(hash)) {
      duplicateCount++
      console.log(`⏭️ 跳過重複檔案：${file.name}`)

      // 記錄重複的 page（用於顯示）
      if (!lastPage && existingHashes.has(hash)) {
        const existingPage = existingHashes.get(hash)!
        lastPage = existingPage

        // 單檔時取得 folder 名稱
        if (files.length === 1) {
          const folder = await db(workspaceId).getFolder(existingPage.folderId)
          duplicateFolderName = folder?.name || '未知資料夾'
        }
      }
      continue
    }

    importedHashes.add(hash)

    // 延遲處理避免競爭
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 使用標準化後的內容建立頁面（image:// 格式）
    const { page } = await createPageWithContent(targetFolderId, normalizedContent, file.name, file.lastModified, workspaceId)
    importedPages.push(page)
    lastPage = page
  }

  return {
    importedPages,
    duplicateCount,
    lastPage,
    duplicateFolderName
  }
}

/**
 * 產生 Toast 訊息
 */
export function getImportToastMessage(result: ImportResult, totalFiles: number): string | null {
  const { importedPages, duplicateCount, duplicateFolderName } = result

  if (totalFiles === 1 && duplicateCount === 1 && duplicateFolderName) {
    // 單檔重複
    return `內容已存在於「${duplicateFolderName}」`
  }

  if (duplicateCount > 0) {
    if (importedPages.length > 0) {
      // 多檔部分重複
      return `匯入 ${importedPages.length} 個，${duplicateCount} 個已存在`
    } else {
      // 多檔全重複
      return `${duplicateCount} 個檔案內容已存在`
    }
  }

  // 無重複，不顯示 toast
  return null
}

// ===== 目錄結構匯入 =====

// 目錄匯入結果
export interface DirectoryImportResult {
  foldersCreated: number
  pagesCreated: number
  duplicateCount: number
  rootFolder: Folder | null    // 用於 UI 導航
  lastPage: Page | null
  pageFileMap?: Map<string, string>  // pageId → fileName（用於建立 pageLink）
}

/**
 * 產生目錄匯入的 Toast 訊息
 */
export function getDirectoryImportToastMessage(result: DirectoryImportResult): string | null {
  const { foldersCreated, pagesCreated, duplicateCount } = result

  // 完全空（無 .md 檔案）
  if (foldersCreated === 0 && pagesCreated === 0 && duplicateCount === 0) {
    return '目錄中沒有 Markdown 檔案'
  }

  // 全部重複
  if (pagesCreated === 0 && duplicateCount > 0) {
    return `${duplicateCount} 個檔案內容已存在`
  }

  // 正常匯入
  const parts: string[] = []
  if (foldersCreated > 0) {
    parts.push(`${foldersCreated} 個資料夾`)
  }
  if (pagesCreated > 0) {
    parts.push(`${pagesCreated} 個頁面`)
  }

  let message = `匯入 ${parts.join('、')}`

  if (duplicateCount > 0) {
    message += `，${duplicateCount} 個已存在`
  }

  return message
}

/**
 * 在指定層級找出不重複的資料夾名稱
 * 如果 name 已存在，嘗試 name (2)、name (3)...
 */
async function getUniqueFolderName(
  name: string,
  parentId: string,
  workspaceId: WorkspaceId
): Promise<string> {
  const allFolders = await db(workspaceId).getAllFolders()
  const siblingNames = new Set(
    allFolders
      .filter(f => f.parentId === parentId)
      .map(f => f.name)
  )

  if (!siblingNames.has(name)) {
    return name
  }

  // 找出可用的編號
  let counter = 2
  while (siblingNames.has(`${name} (${counter})`)) {
    counter++
  }

  return `${name} (${counter})`
}

/**
 * 匯入目錄結構（遞迴建立 Folder 並匯入 .md 檔案）
 *
 * @param rootNodes 根節點陣列（通常是一個目錄）
 * @param targetFolderId 目標 folder ID（在此下建立目錄結構）
 * @param workspaceId Workspace ID
 * @returns 匯入結果
 */
export async function importDirectoryStructure(
  rootNodes: DirectoryNode[],
  targetFolderId: string,
  workspaceId: WorkspaceId
): Promise<DirectoryImportResult> {
  // 建立現有 pages 的 hash 索引（用於去重）
  const allPages = await db(workspaceId).getAllPages()
  const existingHashes = new Map<string, Page>()

  for (const p of allPages) {
    if (p.contentHash && !isTrashFolderId(p.folderId)) {
      existingHashes.set(p.contentHash, p)
    }
  }

  const importedHashes = new Set<string>()

  let foldersCreated = 0
  let pagesCreated = 0
  let duplicateCount = 0
  let rootFolder: Folder | null = null
  let lastPage: Page | null = null

  /**
   * 遞迴處理目錄節點
   */
  async function processNode(
    node: DirectoryNode,
    parentFolderId: string,
    isRoot: boolean = false
  ): Promise<void> {
    if (node.type === 'directory') {
      // 檢查目錄是否有效（包含 .md 或有效子目錄）
      if (!isValidDirectoryNode(node)) {
        return
      }

      // 建立新的 Folder
      const uniqueName = await getUniqueFolderName(node.name, parentFolderId, workspaceId)
      const now = Date.now()
      const siblings = (await db(workspaceId).getAllFolders()).filter(f => f.parentId === parentFolderId)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) : -1
      const newFolder: Folder = {
        id: generateFolderId(),
        name: uniqueName,
        parentId: parentFolderId,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      }

      await db(workspaceId).createFolder(newFolder)
      foldersCreated++

      // 記錄根目錄（用於 UI 導航）
      if (isRoot) {
        rootFolder = newFolder
      }

      // 遞迴處理子節點
      if (node.children) {
        for (const child of node.children) {
          await processNode(child, newFolder.id)
        }
      }
    } else if (node.type === 'file' && node.file) {
      // 只處理 .md 檔案
      if (!node.name.match(/\.(md|markdown)$/i)) {
        return
      }

      const content = await node.file.text()
      const normalizedContent = normalizeImagePaths(content)
      const hash = await calculateContentHash(normalizedContent)

      // 檢查是否重複
      if (existingHashes.has(hash) || importedHashes.has(hash)) {
        duplicateCount++
        console.log(`⏭️ 跳過重複檔案：${node.name}`)

        // 記錄重複的 page（如果還沒有 lastPage）
        if (!lastPage && existingHashes.has(hash)) {
          lastPage = existingHashes.get(hash)!
        }
        return
      }

      importedHashes.add(hash)

      // 建立頁面（使用檔案的 lastModified 作為時間戳）
      const { page } = await createPageWithContent(
        parentFolderId,
        normalizedContent,
        node.name,
        node.file.lastModified,
        workspaceId
      )
      pagesCreated++
      lastPage = page
    }
  }

  // 處理所有根節點
  for (const node of rootNodes) {
    await processNode(node, targetFolderId, true)
  }

  return {
    foldersCreated,
    pagesCreated,
    duplicateCount,
    rootFolder,
    lastPage
  }
}

// DirectoryFile 類型（從 fileOperations.ts 導入的結構）
interface DirectoryFile {
  name: string
  content: string
  relativePath: string
  lastModified?: number          // 檔案的 lastModified 時間戳
}

/**
 * 從目錄選擇器的檔案陣列匯入（flat，一層不遞迴）
 * 建立一個 folder，所有 .md 檔案作為 page
 *
 * @param files 從目錄選擇器獲取的檔案陣列
 * @param targetFolderId 目標 folder ID（在此下建立新 folder）
 * @param dirName 目錄名稱（用於建立 folder）
 * @param workspaceId Workspace ID
 * @returns 匯入結果
 */
export async function importDirectoryFiles(
  files: DirectoryFile[],
  targetFolderId: string,
  dirName: string,
  workspaceId: WorkspaceId
): Promise<DirectoryImportResult> {
  // 建立現有 pages 的 hash 索引（用於去重）
  const allPages = await db(workspaceId).getAllPages()
  const existingHashes = new Map<string, Page>()

  for (const p of allPages) {
    if (p.contentHash && !isTrashFolderId(p.folderId)) {
      existingHashes.set(p.contentHash, p)
    }
  }

  const importedHashes = new Set<string>()
  const pageFileMap = new Map<string, string>()

  let pagesCreated = 0
  let duplicateCount = 0
  let lastPage: Page | null = null

  // 建立新 folder（專屬於此目錄）
  const uniqueName = await getUniqueFolderName(dirName, targetFolderId, workspaceId)
  const now = Date.now()
  const siblings = (await db(workspaceId).getAllFolders()).filter(f => f.parentId === targetFolderId)
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) : -1
  const rootFolder: Folder = {
    id: generateFolderId(),
    name: uniqueName,
    parentId: targetFolderId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  }
  await db(workspaceId).createFolder(rootFolder)

  // 處理每個檔案（flat，直接放到 rootFolder）
  for (const file of files) {
    // 標準化內容並計算 hash
    const normalizedContent = normalizeImagePaths(file.content)
    const hash = await calculateContentHash(normalizedContent)

    // 檢查是否重複
    if (existingHashes.has(hash) || importedHashes.has(hash)) {
      duplicateCount++
      console.log(`⏭️ 跳過重複檔案：${file.name}`)

      if (!lastPage && existingHashes.has(hash)) {
        lastPage = existingHashes.get(hash)!
      }
      continue
    }

    importedHashes.add(hash)

    // 建立頁面（使用檔案的 lastModified 作為時間戳）
    const { page } = await createPageWithContent(
      rootFolder.id,
      normalizedContent,
      file.name,
      file.lastModified,
      workspaceId
    )
    pagesCreated++
    lastPage = page

    // 記錄 pageId → fileName 對映（用於建立 pageLink）
    pageFileMap.set(page.id, file.name)
  }

  return {
    foldersCreated: 1,
    pagesCreated,
    duplicateCount,
    rootFolder,
    lastPage,
    pageFileMap: pageFileMap.size > 0 ? pageFileMap : undefined
  }
}
