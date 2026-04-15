/**
 * Folder 工具函數
 * 用於查找根 folder、收集子 folders 和 pages
 */

import { db, Folder, Page } from '../services/db'
import { WorkspaceId } from '../types/workspace'
import { isRootFolderId, isTrashFolderId } from '../services/rootFolders'

/**
 * 根據 page ID 查找其所屬的根 folder
 */
export async function findRootFolderByPageId(pageId: string, workspaceId: WorkspaceId): Promise<Folder | null> {
  try {
    const page = await db(workspaceId).getPage(pageId)
    if (!page) return null

    return await findRootFolderByFolderId(page.folderId, workspaceId)
  } catch (error) {
    console.error('Error finding root folder by page ID:', error)
    return null
  }
}

/**
 * 根據 folder ID 查找其根 folder
 */
export async function findRootFolderByFolderId(folderId: string, workspaceId: WorkspaceId): Promise<Folder | null> {
  try {
    let currentFolder = await db(workspaceId).getFolder(folderId)
    if (!currentFolder) return null

    // 向上遍歷，直到找到 parentId 為 null 的 folder
    while (currentFolder.parentId !== null) {
      const parentFolder = await db(workspaceId).getFolder(currentFolder.parentId)
      if (!parentFolder) {
        // 如果找不到父 folder，返回當前 folder
        return currentFolder
      }
      currentFolder = parentFolder
    }

    return currentFolder
  } catch (error) {
    console.error('Error finding root folder by folder ID:', error)
    return null
  }
}

/**
 * 遞迴收集指定 folder 及其所有子 folders
 */
export async function collectSubfolders(folderId: string, workspaceId: WorkspaceId): Promise<Folder[]> {
  try {
    const allFolders = await db(workspaceId).getAllFolders()
    const result: Folder[] = []

    const collect = (currentFolderId: string) => {
      // 找到所有 parentId 為 currentFolderId 的 folders
      const children = allFolders.filter(f => f.parentId === currentFolderId)

      for (const child of children) {
        result.push(child)
        // 遞迴收集子 folder 的子 folders
        collect(child.id)
      }
    }

    collect(folderId)
    return result
  } catch (error) {
    console.error('Error collecting subfolders:', error)
    return []
  }
}

/**
 * 收集指定 folder 及其所有子 folders 中的所有 pages
 */
export async function collectPages(folderId: string, subfolders: Folder[], workspaceId: WorkspaceId): Promise<Page[]> {
  try {
    const allPages = await db(workspaceId).getAllPages()
    const folderIds = [folderId, ...subfolders.map(f => f.id)]

    // 過濾出屬於這些 folders 的所有 pages
    return allPages.filter(page => folderIds.includes(page.folderId))
  } catch (error) {
    console.error('Error collecting pages:', error)
    return []
  }
}

/**
 * 獲取所有根 folders
 * 嚴格檢查：只返回 parentId === null 的 folders
 * 排除系統 folders（如 Recycle）
 *
 * 注意：不使用 getFoldersByParent(null) 因為 IndexedDB 索引對 null 的處理不可靠
 * 改用 getAllFolders() 手動過濾
 */
export async function getAllRootFolders(workspaceId: WorkspaceId): Promise<Folder[]> {
  try {
    // 獲取所有 folders
    const allFolders = await db(workspaceId).getAllFolders()

    // 手動過濾：只保留 parentId === null 且不是 Trash folder 的
    const rootFolders = allFolders.filter(f =>
      f.parentId === null &&
      !isTrashFolderId(f.id)
    )

    console.log('✅ getAllRootFolders:', rootFolders.map(f => `${f.name} (order: ${f.order})`).join(', '))
    console.log(`   (從 ${allFolders.length} 個 folders 中找到 ${rootFolders.length} 個根目錄，排除了系統 folders)`)

    return rootFolders
  } catch (error) {
    console.error('❌ Error getting all root folders:', error)
    return []
  }
}

/**
 * 檢查指定 folder 是否為根 folder（parentId === null）
 */
export function isRootFolder(folder: Folder): boolean {
  return folder.parentId === null
}

/**
 * 檢查是否為系統 folder（Trash 或 Root folder）
 */
function isSystemFolderId(folderId: string): boolean {
  return isTrashFolderId(folderId) || isRootFolderId(folderId)
}

/**
 * 檢查 folder 是否可以被刪除
 * 系統 folder（Trash, Root）不可刪除
 */
export function canDeleteFolder(folder: Folder): boolean {
  if (folder.isSystemFolder || folder.isRootFolder) {
    return false
  }
  return !isSystemFolderId(folder.id)
}

/**
 * 檢查 folder 是否可以被移動
 * 系統 folder（Trash, Root）不可移動
 */
export function canMoveFolder(folder: Folder): boolean {
  if (folder.isSystemFolder || folder.isRootFolder) {
    return false
  }
  return !isSystemFolderId(folder.id)
}
