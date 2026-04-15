/**
 * Root Folders 服務
 * 管理 Local Space 和 Cloud Space 的根目錄和垃圾桶
 *
 * V10 重構：Workspace DB 分離
 * - 每個 workspace 有獨立的 IndexedDB（PenPage_Global, PenPage_Local）
 * - 統一 ID：ROOT_FOLDER_ID = 'root', TRASH_FOLDER_ID = 'trash'
 * - 新 sentinel value：ROOT_PARENT_ID = 'workspace'
 */

import { db, getDbName, _dbService, Folder, Workspace } from './db'
import { createLogger } from '../utils/logger'

const log = createLogger('DB')
import { WorkspaceId, WORKSPACE_CONFIGS } from '../types/workspace'

// ===== V10 統一 ID 常數 =====
// 每個 workspace DB 內的 root/trash folder 使用相同 ID
export const ROOT_FOLDER_ID = 'root'
export const TRASH_FOLDER_ID = 'trash'

export const ROOT_FOLDER_DEFAULT_NAME = 'My Notes'
export const ROOT_FOLDER_ORDER = -9999  // 排在最前面

// Root folder 的 parentId（sentinel value，表示上層是 workspace 本身）
// V10: 'root' → 'workspace'（避免與 ROOT_FOLDER_ID='root' 混淆）
export const ROOT_PARENT_ID = 'workspace'

/**
 * 檢查是否為 root parent ID（sentinel value）
 */
export const isRootParentId = (parentId: string | null): boolean => {
  return parentId === ROOT_PARENT_ID
}

// ===== Folder parentId 標準化工具 =====

/**
 * 檢查 folder 是否需要 parentId 標準化（純函數）
 * 處理情況：
 * 1. 系統 folder（root/trash）的 parentId 不是 'workspace' (ROOT_PARENT_ID)
 * 2. 一般 folder 的 parentId 為 null
 */
export function needsParentIdNormalization(folder: Folder): boolean {
  // Case 1: root/trash folder → parentId 應為 'workspace' (ROOT_PARENT_ID)
  if (folder.isRootFolder || folder.isTrashFolder) {
    return !isRootParentId(folder.parentId)
  }
  // Case 2: 一般 folder，parentId=null 是舊資料
  return folder.parentId === null
}

/**
 * 標準化 folder 的 parentId（純函數）
 * 處理：系統 folder 格式、null 舊資料
 *
 * V10: ROOT_PARENT_ID = 'workspace'（新 sentinel value）
 *
 * @returns 標準化後的 folder，或原 folder（不需要修改時）
 */
export function normalizeFolderParentId(folder: Folder): Folder {
  // Case 1: root/trash folder → parentId='workspace' (ROOT_PARENT_ID)
  if (folder.isRootFolder || folder.isTrashFolder) {
    if (!isRootParentId(folder.parentId)) {
      return { ...folder, parentId: ROOT_PARENT_ID }
    }
    return folder
  }

  // Case 2: 一般 folder，parentId=null → ROOT_FOLDER_ID（舊 DB 格式）
  if (folder.parentId === null) {
    return { ...folder, parentId: ROOT_FOLDER_ID }
  }

  return folder
}

// ===== Trash Folder 常數定義（V7 新增）=====
export const TRASH_FOLDER_DEFAULT_NAME = 'Trash'
export const TRASH_FOLDER_ORDER = 9999  // 排在最後面
export const RECYCLE_RETENTION_DAYS = 30  // 垃圾桶保留天數


/**
 * 檢查是否為 root folder ID
 * 支援新舊格式
 */
export const isRootFolderId = (folderId: string): boolean => {
  return folderId === ROOT_FOLDER_ID
}

/**
 * 通用：判斷是否為任何 workspace 的 root folder ID
 */
export const isAnyRootFolderId = (id: string | null): boolean => {
  if (id === null) return false
  return id === ROOT_FOLDER_ID
}


/**
 * 檢查是否為 trash folder ID
 */
export const isTrashFolderId = (folderId: string): boolean => {
  return folderId === TRASH_FOLDER_ID
}

/**
 * 檢查是否為系統 folder ID（root 或 trash）
 */
export const isSystemFolderId = (folderId: string): boolean => {
  return isRootFolderId(folderId) || isTrashFolderId(folderId)
}

/**
 * 確保當前 workspace 的 Workspace 記錄存在
 * V10: 每個 DB 只管理自己的 workspace
 */
export const ensureWorkspaceExists = async (workspaceId: WorkspaceId): Promise<void> => {
  try {
    let workspace = await _dbService.getWorkspace(workspaceId)
    if (!workspace) {
      const newWorkspace: Workspace = {
        id: workspaceId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      await _dbService.createWorkspace(newWorkspace)
      log(`✅ Workspace "${workspaceId}" created`)
    }
  } catch (error) {
    log.error('Workspace creation failed:', error)
    throw error
  }
}

/**
 * 確保當前 workspace 的 Root folder 存在
 * V10: 統一 ID = 'root'，每個 workspace DB 內結構相同
 */
export const ensureRootFolderExists = async (workspaceId: WorkspaceId): Promise<void> => {
  try {
    let rootFolder = await db(workspaceId).getFolder(ROOT_FOLDER_ID)
    if (!rootFolder) {
      // 優先使用 workspace config 的預設名稱，fallback 到通用預設
      const defaultName = WORKSPACE_CONFIGS[workspaceId]?.defaultRootFolderName || ROOT_FOLDER_DEFAULT_NAME
      const newRoot: Folder = {
        id: ROOT_FOLDER_ID,
        name: defaultName,
        parentId: ROOT_PARENT_ID,  // V10: sentinel value 'workspace'
        order: ROOT_FOLDER_ORDER,
        createdAt: Date.now(),
        updatedAt: 0,  // 使用 0 確保 sync 時雲端版本優先（避免預設名稱覆蓋自訂名稱）
        isSystemFolder: true,
        isRootFolder: true,
      }
      await db(workspaceId).createFolder(newRoot)
      log(`✅ Root folder created (${workspaceId})`)
    } else {
      // 修復缺失的系統標記（可能由舊版 migration 或 backup restore 造成）
      let needsUpdate = false
      if (!rootFolder.isRootFolder) { rootFolder.isRootFolder = true; needsUpdate = true }
      if (!rootFolder.isSystemFolder) { rootFolder.isSystemFolder = true; needsUpdate = true }
      if (!isRootParentId(rootFolder.parentId)) { rootFolder.parentId = ROOT_PARENT_ID; needsUpdate = true }
      if (needsUpdate) {
        await db(workspaceId).updateFolder({ ...rootFolder, updatedAt: Date.now() })
        log(`🔄 Root folder 系統標記已修復 (${workspaceId})`)
      }
    }
  } catch (error) {
    log.error('Root folder creation failed:', error)
    throw error
  }
}

/**
 * 確保當前 workspace 的 Trash folder 存在
 * V10: 統一 ID = 'trash'，每個 workspace DB 內結構相同
 */
export const ensureTrashFolderExists = async (workspaceId: WorkspaceId): Promise<void> => {
  try {
    let trashFolder = await db(workspaceId).getFolder(TRASH_FOLDER_ID)
    if (!trashFolder) {
      const newTrash: Folder = {
        id: TRASH_FOLDER_ID,
        name: TRASH_FOLDER_DEFAULT_NAME,
        parentId: ROOT_PARENT_ID,  // V10: sentinel value 'workspace'
        order: TRASH_FOLDER_ORDER,
        createdAt: Date.now(),
        updatedAt: 0,  // 使用 0 確保 sync 時雲端版本優先（避免預設名稱覆蓋自訂名稱）
        isSystemFolder: true,
        isTrashFolder: true,
      }
      await db(workspaceId).createFolder(newTrash)
      log(`✅ Trash folder created (${workspaceId})`)
    } else {
      // 修復缺失的系統標記（可能由舊版 migration 或 backup restore 造成）
      let needsUpdate = false
      if (!trashFolder.isTrashFolder) { trashFolder.isTrashFolder = true; needsUpdate = true }
      if (!trashFolder.isSystemFolder) { trashFolder.isSystemFolder = true; needsUpdate = true }
      if (!isRootParentId(trashFolder.parentId)) { trashFolder.parentId = ROOT_PARENT_ID; needsUpdate = true }
      if (needsUpdate) {
        await db(workspaceId).updateFolder({ ...trashFolder, updatedAt: Date.now() })
        log(`🔄 Trash folder 系統標記已修復 (${workspaceId})`)
      }
    }
  } catch (error) {
    log.error('Trash folder creation failed:', error)
    throw error
  }
}

/**
 * 確保當前 workspace 的系統結構存在（Workspace + Root + Trash）
 * V10: 這是 App 啟動時應該呼叫的主要函數
 * 只處理當前開啟的 workspace DB
 */
export const ensureSystemStructureExists = async (workspaceId: WorkspaceId): Promise<void> => {
  await ensureWorkspaceExists(workspaceId)
  await ensureRootFolderExists(workspaceId)
  await ensureTrashFolderExists(workspaceId)
}

/**
 * 取得指定 workspace 的 root folder 名稱
 * 使用獨立 IDB 連線查詢，不影響共享 db singleton
 */
export const getRootFolderName = async (workspaceId: WorkspaceId): Promise<string> => {
  const defaultName = WORKSPACE_CONFIGS[workspaceId]?.defaultRootFolderName || ROOT_FOLDER_DEFAULT_NAME
  try {
    const dbName = getDbName(workspaceId)
    // 開啟獨立連線，不影響共享 db singleton
    // 注意：不帶版本號開啟，避免對尚未初始化的 DB 建立空殼
    const tempDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      // DB 還沒初始化過（沒有 folders store）→ 刪除空殼 DB，回傳預設名稱
      if (!tempDb.objectStoreNames.contains('folders')) {
        tempDb.close()
        indexedDB.deleteDatabase(dbName)
        return defaultName
      }
      const folder = await new Promise<Folder | undefined>((resolve, reject) => {
        const tx = tempDb.transaction(['folders'], 'readonly')
        const store = tx.objectStore('folders')
        const request = store.get(ROOT_FOLDER_ID)
        request.onsuccess = () => resolve(request.result as Folder | undefined)
        request.onerror = () => reject(request.error)
      })
      return folder?.name || defaultName
    } finally {
      tempDb.close()
    }
  } catch {
    return defaultName
  }
}
