// 頁面和資料夾輔助函數

import { db, Folder, Page } from './db'
import { WorkspaceId } from '../types/workspace'
import { generatePageId } from '../utils/idGenerator'
import { isTrashFolderId, ROOT_FOLDER_ID } from './rootFolders'
import { calculateContentHash } from '../utils/hashCalculator'

import { extractPageTitle } from '../utils/markdownConverter'
import { generateDefaultContent, getDefaultContentCursorPosition } from '../utils/pageDefaults'

/**
 * 確保有 folder 和 page 可以編輯
 * 如果 selectedFolderId 是 Recycle Bin 或無效/空，自動使用對應 Workspace 的 Root Folder
 * @param selectedFolderId 可選，指定在哪個 folder 下創建頁面
 * @param workspaceId Workspace ID
 * @returns { folder, page } 選擇的 folder 和新創建的 page
 */
export async function ensureFolderAndPage(selectedFolderId: string | null | undefined, workspaceId: WorkspaceId): Promise<{ folder: Folder; page: Page }> {
  const allFolders = await db(workspaceId).getAllFolders()

  let targetFolder: Folder | undefined

  // 1. 如果選中 Trash，重置為 null（改用 root folder）
  if (selectedFolderId && isTrashFolderId(selectedFolderId)) {
    selectedFolderId = null
  }

  // 2. 嘗試獲取有效的 Target Folder
  if (selectedFolderId) {
    targetFolder = allFolders.find(f => f.id === selectedFolderId)
    if (!targetFolder) {
      selectedFolderId = null
    }
  }

  // 3. 如果沒有有效的 Target Folder，使用 Root Folder
  if (!targetFolder) {
    targetFolder = await db(workspaceId).getFolder(ROOT_FOLDER_ID)

    if (!targetFolder) {
      throw new Error(`Root folder not found. Please ensure ensureRootFolderExists() is called on app init.`)
    }
  }

  // 4. 預設內容：由 pageDefaults 產生（目前為 `# MM-DD`）
  //    為了讓 delete/sync/cleanup/dedup 能把「未編輯 page」當成 empty page 處理，
  //    內容判定統一透過 pageDefaults.isPageUntouched
  const defaultContent = generateDefaultContent()
  // 走跟使用者動作一樣的 title derive 路徑（從 content 第一行 heading 取得）
  const newPageName = extractPageTitle(defaultContent)
  // WYSIWYG 游標落在 h1 內 "MM-DD" 結尾
  const wysiwygCursorPosition = getDefaultContentCursorPosition()

  // 5. 建立 Page
  const newPage: Page = {
    id: generatePageId(),
    folderId: targetFolder.id,
    name: newPageName,
    content: defaultContent,
    editorState: { wysiwygCursorPosition },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  await db(workspaceId).createPage(newPage)

  // 6. 返回 folder 和 page
  return { folder: targetFolder, page: newPage }
}

/**
 * 建立帶有內容的新頁面（用於匯入 Markdown 檔案）
 * @param selectedFolderId 可選，指定在哪個 folder 下創建頁面
 * @param content Markdown 內容
 * @param filename 可選，原始檔名（用於 fallback 標題）
 * @param fileTimestamp 可選，檔案時間戳
 * @param workspaceId Workspace ID
 * @returns { folder, page } 選擇的 folder 和新創建的 page
 */
export async function createPageWithContent(
  selectedFolderId: string | null | undefined,
  content: string,
  filename: string | undefined,
  fileTimestamp: number | undefined,
  workspaceId: WorkspaceId
): Promise<{ folder: Folder; page: Page }> {
  const allFolders = await db(workspaceId).getAllFolders()

  let targetFolder: Folder | undefined

  // 1. 如果選中 Trash，重置為 null（改用 root folder）
  if (selectedFolderId && isTrashFolderId(selectedFolderId)) {
    selectedFolderId = null
  }

  // 2. 嘗試獲取有效的 Target Folder
  if (selectedFolderId) {
    targetFolder = allFolders.find(f => f.id === selectedFolderId)
    if (!targetFolder) {
      selectedFolderId = null
    }
  }

  // 3. 如果沒有有效的 Target Folder，使用 Root Folder
  if (!targetFolder) {
    targetFolder = await db(workspaceId).getFolder(ROOT_FOLDER_ID)

    if (!targetFolder) {
      throw new Error(`Root folder not found.`)
    }
  }

  // 4. 從內容或檔名取得頁面標題
  let pageName = extractPageTitle(content)
  if (pageName === 'New Page' && filename) {
    // 如果內容沒有標題，使用檔名（去除副檔名）
    pageName = filename.replace(/\.(md|markdown|txt)$/i, '')
  }

  // 5. 建立 Page
  const contentHash = await calculateContentHash(content)
  const newPage: Page = {
    id: generatePageId(),
    folderId: targetFolder.id,
    name: pageName,
    content: content,
    contentHash,
    createdAt: fileTimestamp || Date.now(),
    updatedAt: fileTimestamp || Date.now(),
  }

  await db(workspaceId).createPage(newPage)

  return { folder: targetFolder, page: newPage }
}
