/**
 * Directory Handle 儲存服務
 * 使用獨立 IndexedDB 儲存 FileSystemDirectoryHandle，實現目錄級 file link
 * 一個 dirHandle 可服務多個 folder（透過 subPath）
 * 僅 Chrome/Edge 支援 File System Access API
 */

const DB_NAME = 'PenPage_DirLinks'
const DB_VERSION = 1
const STORE_DIR_HANDLES = 'dirHandles'
const STORE_FOLDER_DIR_LINKS = 'folderDirLinks'
const STORE_PAGE_LINKS = 'pageLinks'

// 舊 DB（待清理）
const OLD_DB_NAME = 'PenPage_FileHandles'

// ===== 資料結構 =====

export interface DirHandleEntry {
  handleId: string
  handle: FileSystemDirectoryHandle
  dirName: string
  linkedAt: number
}

export interface FolderDirLink {
  folderId: string
  handleId: string
  subPath: string       // ""（根層）| "bookA" | "bookB"
  linkedAt: number
  workspaceId?: string  // 所屬 workspace（舊資料可能沒有，fallback 為 'global'）
}

export interface PageLinkEntry {
  pageId: string
  folderId: string
  fileName: string      // 純檔名（一層 flat）
  linkedAt: number
  fileUpdateTime?: number
  pageContentHash?: string
  autoSync?: boolean
}

// ===== DB 管理 =====

let dbInstance: IDBDatabase | null = null

export function isFileHandleSupported(): boolean {
  return 'showDirectoryPicker' in window
}

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_DIR_HANDLES)) {
        db.createObjectStore(STORE_DIR_HANDLES, { keyPath: 'handleId' })
      }
      if (!db.objectStoreNames.contains(STORE_FOLDER_DIR_LINKS)) {
        db.createObjectStore(STORE_FOLDER_DIR_LINKS, { keyPath: 'folderId' })
      }
      if (!db.objectStoreNames.contains(STORE_PAGE_LINKS)) {
        db.createObjectStore(STORE_PAGE_LINKS, { keyPath: 'pageId' })
      }
    }

    request.onsuccess = () => {
      dbInstance = request.result
      // 清理舊 DB
      cleanupOldDB()
      resolve(dbInstance)
    }

    request.onerror = () => reject(request.error)
  })
}

/** 刪除舊的 per-file handle DB */
function cleanupOldDB(): void {
  try {
    indexedDB.deleteDatabase(OLD_DB_NAME)
  } catch {
    // 忽略錯誤
  }
}

// ===== 通用 IDB 工具 =====

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

// ===== dirHandle 操作 =====

/** 儲存 dirHandle，回傳 handleId */
export async function saveDirHandle(
  handle: FileSystemDirectoryHandle,
  handleId?: string
): Promise<string> {
  const id = handleId || `dh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry: DirHandleEntry = {
    handleId: id,
    handle,
    dirName: handle.name,
    linkedAt: Date.now()
  }
  await idbPut(STORE_DIR_HANDLES, entry)
  return id
}

export async function getDirHandle(handleId: string): Promise<DirHandleEntry | null> {
  return idbGet<DirHandleEntry>(STORE_DIR_HANDLES, handleId)
}

export async function removeDirHandle(handleId: string): Promise<void> {
  return idbDelete(STORE_DIR_HANDLES, handleId)
}

export async function getAllDirHandles(): Promise<DirHandleEntry[]> {
  return idbGetAll<DirHandleEntry>(STORE_DIR_HANDLES)
}

/** 用 isSameEntry 偵測是否已存在相同目錄 */
export async function findDirHandleBySameEntry(
  handle: FileSystemDirectoryHandle
): Promise<DirHandleEntry | null> {
  const all = await getAllDirHandles()
  for (const entry of all) {
    try {
      if (await entry.handle.isSameEntry(handle)) {
        return entry
      }
    } catch {
      // handle 可能已失效，忽略
    }
  }
  return null
}

// ===== folderDirLink 操作 =====

export async function saveFolderDirLink(
  folderId: string,
  handleId: string,
  subPath: string,
  workspaceId?: string
): Promise<void> {
  const link: FolderDirLink = { folderId, handleId, subPath, linkedAt: Date.now(), workspaceId }
  await idbPut(STORE_FOLDER_DIR_LINKS, link)
}

export async function getFolderDirLink(folderId: string): Promise<FolderDirLink | null> {
  return idbGet<FolderDirLink>(STORE_FOLDER_DIR_LINKS, folderId)
}

export async function removeFolderDirLink(folderId: string): Promise<void> {
  return idbDelete(STORE_FOLDER_DIR_LINKS, folderId)
}

export async function getFoldersByHandleId(handleId: string): Promise<FolderDirLink[]> {
  const all = await idbGetAll<FolderDirLink>(STORE_FOLDER_DIR_LINKS)
  return all.filter(link => link.handleId === handleId)
}

/** 檢查 subPath 是否已被 link（同一 handleId 下） */
export async function isSubPathLinked(handleId: string, subPath: string): Promise<boolean> {
  const folders = await getFoldersByHandleId(handleId)
  return folders.some(f => f.subPath === subPath)
}

// ===== pageLink 操作 =====

export async function savePageLink(
  pageId: string,
  folderId: string,
  fileName: string
): Promise<void> {
  const entry: PageLinkEntry = { pageId, folderId, fileName, linkedAt: Date.now() }
  await idbPut(STORE_PAGE_LINKS, entry)
}

export async function getPageLink(pageId: string): Promise<PageLinkEntry | null> {
  return idbGet<PageLinkEntry>(STORE_PAGE_LINKS, pageId)
}

export async function removePageLink(pageId: string): Promise<void> {
  return idbDelete(STORE_PAGE_LINKS, pageId)
}

export async function hasPageLink(pageId: string): Promise<boolean> {
  const entry = await getPageLink(pageId)
  return entry !== null
}

export async function updatePageSyncState(
  pageId: string,
  fileUpdateTime: number,
  pageContentHash: string
): Promise<void> {
  const entry = await getPageLink(pageId)
  if (!entry) return
  await idbPut(STORE_PAGE_LINKS, { ...entry, fileUpdateTime, pageContentHash })
}

export async function togglePageAutoSync(pageId: string): Promise<boolean> {
  const entry = await getPageLink(pageId)
  if (!entry) return false
  const newValue = entry.autoSync === false ? true : false
  await idbPut(STORE_PAGE_LINKS, { ...entry, autoSync: newValue })
  return newValue
}

export async function getAllLinkedPageIds(): Promise<Set<string>> {
  const all = await idbGetAll<PageLinkEntry>(STORE_PAGE_LINKS)
  return new Set(all.map(e => e.pageId))
}

/** 取得所有已連結的 entries（含 autoSync 狀態）— 與舊 API 相容 */
export async function getAllLinkedEntries(): Promise<Map<string, { autoSync: boolean }>> {
  const all = await idbGetAll<PageLinkEntry>(STORE_PAGE_LINKS)
  const map = new Map<string, { autoSync: boolean }>()
  for (const entry of all) {
    map.set(entry.pageId, { autoSync: entry.autoSync !== false })
  }
  return map
}

/** 取得所有已連結的 folder IDs（可按 workspace 過濾） */
export async function getAllLinkedFolderIds(workspaceId?: string): Promise<Set<string>> {
  const all = await idbGetAll<FolderDirLink>(STORE_FOLDER_DIR_LINKS)
  if (!workspaceId) {
    return new Set(all.map(link => link.folderId))
  }
  // 過濾：舊資料沒有 workspaceId 的視為 'global'
  return new Set(
    all
      .filter(link => (link.workspaceId || 'global') === workspaceId)
      .map(link => link.folderId)
  )
}

export async function getPageLinksByFolder(folderId: string): Promise<PageLinkEntry[]> {
  const all = await idbGetAll<PageLinkEntry>(STORE_PAGE_LINKS)
  return all.filter(e => e.folderId === folderId)
}

// ===== 檔案定位 =====

/**
 * 從 dirHandle + subPath + fileName 定位到 FileSystemFileHandle
 */
export async function resolveFileHandle(
  handle: FileSystemDirectoryHandle,
  subPath: string,
  fileName: string
): Promise<FileSystemFileHandle> {
  let dir = handle
  if (subPath) {
    // 遍歷子目錄路徑
    const parts = subPath.split('/')
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
  }
  return dir.getFileHandle(fileName)
}

/**
 * 透過 pageId 完整解析到 fileHandle + dirHandle
 */
export async function getResolvedHandle(pageId: string): Promise<{
  fileHandle: FileSystemFileHandle
  dirHandle: FileSystemDirectoryHandle
  pageLink: PageLinkEntry
  folderLink: FolderDirLink
} | null> {
  const pageLink = await getPageLink(pageId)
  if (!pageLink) return null

  const folderLink = await getFolderDirLink(pageLink.folderId)
  if (!folderLink) return null

  const dirEntry = await getDirHandle(folderLink.handleId)
  if (!dirEntry) return null

  try {
    const fileHandle = await resolveFileHandle(
      dirEntry.handle,
      folderLink.subPath,
      pageLink.fileName
    )
    return { fileHandle, dirHandle: dirEntry.handle, pageLink, folderLink }
  } catch {
    return null
  }
}

// ===== 子目錄列表 =====

/** 列出 dirHandle 下的子目錄名稱（一層） */
export async function listSubDirectories(handleId: string): Promise<string[]> {
  const entry = await getDirHandle(handleId)
  if (!entry) return []

  const dirs: string[] = []
  try {
    for await (const [name, handle] of entry.handle.entries()) {
      if (handle.kind === 'directory' && !name.startsWith('.')) {
        dirs.push(name)
      }
    }
  } catch {
    // 權限不足或 handle 失效
  }
  return dirs.sort()
}

// ===== 清理工具 =====

/**
 * 偵測連結目錄是否已刪除，若已刪除則清理所有相關 links
 * @returns true 如果目錄已刪除且已清理
 */
export async function tryCleanupFolderIfDirGone(folderId: string): Promise<boolean> {
  const folderLink = await getFolderDirLink(folderId)
  if (!folderLink) return false

  const dirEntry = await getDirHandle(folderLink.handleId)
  if (!dirEntry) {
    // dirHandle 記錄也沒了，直接清理 folderDirLink
    await removeFolderDirLink(folderId)
    return true
  }

  try {
    // 嘗試存取目錄（驗證是否還存在）
    if (folderLink.subPath) {
      await dirEntry.handle.getDirectoryHandle(folderLink.subPath)
    } else {
      // 根層：嘗試列出內容（驗證 handle 有效）
      const iter = dirEntry.handle.values()
      await iter.next()
    }
    return false // 目錄仍存在，不清理
  } catch (err: any) {
    if (err?.name === 'NotFoundError') {
      await cleanupFolderLinks(folderId)
      return true
    }
    // NotAllowedError 等：目錄可能存在但沒權限，不清理
    return false
  }
}

/** 清理 folder 相關的所有 links（folder 刪除時呼叫） */
export async function cleanupFolderLinks(folderId: string): Promise<void> {
  // 移除該 folder 下所有 pageLinks
  const pageLinks = await getPageLinksByFolder(folderId)
  for (const link of pageLinks) {
    await removePageLink(link.pageId)
  }
  // 移除 folderDirLink
  const folderLink = await getFolderDirLink(folderId)
  if (folderLink) {
    await removeFolderDirLink(folderId)
    // 如果該 handleId 沒有其他 folder 在用，也移除 dirHandle
    const remaining = await getFoldersByHandleId(folderLink.handleId)
    if (remaining.length === 0) {
      await removeDirHandle(folderLink.handleId)
    }
  }
}
