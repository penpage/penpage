// IndexedDB 服務

import { calculateContentHash } from '../utils/hashCalculator'
import { createLogger } from '../utils/logger'

const log = createLogger('DB')
import { WorkspaceId } from '../types/workspace'
import { settingsService } from './settings'

// Workspace interface（V7 新增）
export interface Workspace {
  id: string              // 'global' | 'local'
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null // null 表示根目錄
  order: number // 用於排序
  createdAt: number
  updatedAt: number
  // Google Drive 同步欄位（可選，向後兼容）
  driveFileId?: string // Drive 上對應的文件 ID
  lastSyncedAt?: number // 上次同步時間戳

  // 回收站相關（僅當在 Recycle folder 內時有效）
  deletedAt?: number              // 移入 Recycle 的時間
  deletedBy?: string              // 刪除的裝置 ID
  originalParentId?: string       // 原本的父資料夾 ID（用於還原）
  autoDeleteAt?: number           // 自動永久刪除時間（deletedAt + 30天）

  // 刪除追蹤（用於同步）
  isDeleted?: boolean             // 標記為已刪除（用於 Drive 同步追蹤）

  // 同步追蹤
  lastSyncedDevice?: string       // 最後同步的裝置 ID

  // 系統標記
  isSystemFolder?: boolean        // 標記為系統資料夾（如 Recycle）
  isHidden?: boolean              // 是否隱藏（UI 控制）
  isRootFolder?: boolean          // 標記為根目錄（不可刪除、不可移動，但可重命名）
  isTrashFolder?: boolean         // V7: 標記為垃圾桶資料夾

  // 自訂顏色（Edit Mode 新增）
  color?: string | null           // 自訂顏色 hex 值，null/undefined 表示使用預設 hash 計算

  // 加密相關欄位
  isEncrypted?: boolean           // 標記為加密資料夾
  // 注意：名稱不加密，用戶可自行決定用什麼名稱

  // 選擇記憶欄位
  lastSelectedPageId?: string     // 記住最後選的 page，隨 folder 同步到 Google Drive
}

export interface Page {
  id: string
  folderId: string
  name: string
  content: string // Markdown 內容
  createdAt: number
  updatedAt: number
  // 編輯狀態（可選）
  editorState?: {
    // 分別存儲兩個模式的游標位置，避免重複轉換導致飄移
    wysiwygCursorPosition?: number  // WYSIWYG 模式下的游標位置
    markdownCursorPosition?: number // Markdown 模式下的游標位置
    scrollPosition?: number         // 滾動位置
    isMarkdownMode?: boolean        // 當前編輯模式
  }

  // 回收站相關（僅當 folderId 為 Trash folder 時有效）
  deletedAt?: number                // 移入 Recycle 的時間
  deletedBy?: string                // 刪除的裝置 ID
  originalFolderId?: string         // 原本所屬的資料夾 ID（用於還原）
  autoDeleteAt?: number             // 自動永久刪除時間
  deletedReason?: string            // 刪除原因（可選，用於 debug）

  // 刪除追蹤（用於同步）
  isDeleted?: boolean               // 標記為已刪除（用於 Drive 同步追蹤）
  deletionPhase?: number            // 刪除階段：0=RECYCLE, 1=TOMBSTONE, 2=PURGED

  // 同步相關
  contentHash?: string              // 內容雜湊值（用於增量同步）
  lastSyncedAt?: number             // 上次同步時間戳（用於判斷是否需要同步刪除）
  lastSyncedDevice?: string

  // 手動排序（Edit Mode 新增）
  order?: number                    // 手動排序順序，undefined 時依 updatedAt 排序

  // 加密相關欄位
  isEncrypted?: boolean             // 標記為加密 Page
  encryptedContent?: string         // 加密後的內容 (Base64)
  encryptedContentIv?: string       // 內容加密 IV (Base64)
  // 注意：名稱不再單獨加密，統一從 content 第一行 derive
}

export interface ImageData {
  id: string          // 唯一標識符，例如 img-1234567890
  blob: Blob          // 圖片二進制數據
  filename: string    // 原始文件名
  mimeType: string    // MIME 類型，例如 'image/png'
  size: number        // 文件大小（字節）
  createdAt: number   // 創建時間戳
  contentHash?: string // 內容雜湊值（用於去重）
}

// V10: Workspace DB 分離
// 每個 workspace 有獨立的 IndexedDB
const DB_VERSION = 1  // V10: 新 DB 重新從 1 開始
const FOLDER_STORE = 'folders'
const PAGE_STORE = 'pages'
const IMAGE_STORE = 'images'
const WORKSPACE_STORE = 'workspaces'

/**
 * V10: 根據 workspaceId 取得對應的 DB 名稱
 */
const DB_NAME_MAP: Record<WorkspaceId, string> = {
  local: 'PenPage_Local',
}

export function getDbName(workspaceId: WorkspaceId): string {
  return DB_NAME_MAP[workspaceId]
}

class DatabaseService {
  // 連線池：每個 workspace 獨立的 IDBDatabase 連線，同時開啟
  private connections: Map<WorkspaceId, IDBDatabase> = new Map()
  private currentWorkspaceId: WorkspaceId = 'local'

  /**
   * 取得當前 workspace 的 DB 連線
   * 所有 DB 操作統一透過此方法取得連線
   */
  private getConnection(): IDBDatabase {
    const conn = this.connections.get(this.currentWorkspaceId)
    if (!conn) throw new Error(`Database not initialized for workspace: ${this.currentWorkspaceId}`)
    return conn
  }

  /**
   * V10: 初始化資料庫
   * 懶載入：首次存取時開啟連線，之後從連線池取得（接近同步）
   * @param workspaceId 可選，指定要開啟的 workspace，預設使用 settings 中的設定
   */
  async init(workspaceId?: WorkspaceId): Promise<void> {
    // 決定要使用的 workspaceId
    const targetWorkspaceId = workspaceId ?? settingsService.getSelectedWorkspace()
    const dbName = getDbName(targetWorkspaceId)

    // 如果連線池已有此 workspace 的連線，只需切換指標
    if (this.connections.has(targetWorkspaceId)) {
      this.currentWorkspaceId = targetWorkspaceId
      return
    }

    // 開啟新連線並加入連線池（不關閉其他 workspace 的連線）
    this.currentWorkspaceId = targetWorkspaceId

    // 開啟 DB，若發現空殼（被無版本號 open 建立的）則先刪除再重開
    const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        log(`📂 已開啟 DB: ${dbName}`)
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // V10: 每個 workspace DB 有獨立的 stores，不需要 workspaceId 索引
        // 創建 Folder 存儲
        if (!db.objectStoreNames.contains(FOLDER_STORE)) {
          const folderStore = db.createObjectStore(FOLDER_STORE, { keyPath: 'id' })
          folderStore.createIndex('parentId', 'parentId', { unique: false })
        }

        // 創建 Page 存儲
        if (!db.objectStoreNames.contains(PAGE_STORE)) {
          const pageStore = db.createObjectStore(PAGE_STORE, { keyPath: 'id' })
          pageStore.createIndex('folderId', 'folderId', { unique: false })
        }

        // 創建圖片存儲
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE, { keyPath: 'id' })
        }

        // 創建 Workspace 存儲（用於儲存 workspace metadata）
        if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
          db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' })
        }
      }
    })

    // 先嘗試開啟；若 DB 存在但缺少 stores（空殼），刪除後重開
    let newDb = await openDb()
    if (!newDb.objectStoreNames.contains(FOLDER_STORE)) {
      log(`⚠️ DB ${dbName} 缺少 stores，刪除後重建`)
      newDb.close()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(dbName)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
      newDb = await openDb()
    }

    // 加入連線池
    this.connections.set(targetWorkspaceId, newDb)
  }

  /**
   * V10: 切換到指定的 workspace DB
   * 如果連線已在池中，切換幾乎是同步的（只改指標）
   */
  async switchWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.init(workspaceId)
  }

  /**
   * 確保指定 workspace 的連線已開啟（不改變 currentWorkspaceId）
   * 供 workspaceDbFactory 使用，避免影響其他操作的 workspace 指向
   */
  async ensureConnection(workspaceId: WorkspaceId): Promise<void> {
    if (this.connections.has(workspaceId)) return
    // 開啟連線但不改變 currentWorkspaceId
    const saved = this.currentWorkspaceId
    await this.init(workspaceId)
    this.currentWorkspaceId = saved
  }

  /**
   * 在指定 workspace 上執行操作，完成後恢復原本的 workspace 指向
   * 用於 workspaceDbFactory，避免 sync task 等背景操作影響 UI 層的 workspace 狀態
   */
  async executeOnWorkspace<T>(workspaceId: WorkspaceId, fn: () => Promise<T>): Promise<T> {
    await this.ensureConnection(workspaceId)
    const saved = this.currentWorkspaceId
    this.currentWorkspaceId = workspaceId  // 同步切換（連線已在池中）
    try {
      return await fn()
    } finally {
      this.currentWorkspaceId = saved  // 同步恢復
    }
  }

  /**
   * V10: 取得當前開啟的 workspace ID
   */
  getCurrentWorkspaceId(): WorkspaceId {
    return this.currentWorkspaceId
  }

  // ===== Folder 操作 =====

  async createFolder(folder: Folder): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readwrite')
      const store = transaction.objectStore(FOLDER_STORE)
      // 使用 put 而非 add，避免匯入時 key 已存在的錯誤
      const request = store.put(folder)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updateFolder(folder: Folder): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readwrite')
      const store = transaction.objectStore(FOLDER_STORE)
      const request = store.put(folder)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteFolder(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readwrite')
      const store = transaction.objectStore(FOLDER_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 靜默刪除 folder（不記錄刪除記錄）
   * 用於同步邏輯：從 Drive 下載刪除記錄後執行刪除
   */
  async silentDeleteFolder(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readwrite')
      const store = transaction.objectStore(FOLDER_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readonly')
      const store = transaction.objectStore(FOLDER_STORE)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result as Folder | undefined)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllFolders(_filter?: { workspaceId?: WorkspaceId }): Promise<Folder[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      // V10: 每個 DB 只存放一個 workspace 的資料，忽略 _filter 參數
      // 保留參數是為了 API 向後相容

      const transaction = conn.transaction([FOLDER_STORE], 'readonly')
      const store = transaction.objectStore(FOLDER_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result as Folder[]
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getFoldersByParent(parentId: string | null): Promise<Folder[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([FOLDER_STORE], 'readonly')
      const store = transaction.objectStore(FOLDER_STORE)
      const index = store.index('parentId')
      const request = index.getAll(parentId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 更新 Folder 的 lastSelectedPageId（記住最後選的 page）
   */
  async updateFolderLastSelectedPage(folderId: string, pageId: string): Promise<void> {
    const folder = await this.getFolder(folderId)
    if (folder) {
      await this.updateFolder({ ...folder, lastSelectedPageId: pageId })
    }
  }

  // ===== Workspace 操作（V7 新增）=====

  async createWorkspace(workspace: Workspace): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([WORKSPACE_STORE], 'readwrite')
      const store = transaction.objectStore(WORKSPACE_STORE)
      // 使用 put 而非 add，避免 key 已存在時出錯
      const request = store.put(workspace)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([WORKSPACE_STORE], 'readonly')
      const store = transaction.objectStore(WORKSPACE_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([WORKSPACE_STORE], 'readonly')
      const store = transaction.objectStore(WORKSPACE_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 從 workspace table 讀取當前 DB 的 workspaceId
   * 比 getCurrentWorkspaceId() 更可靠，因為直接從 DB 讀取
   */
  async getWorkspaceIdFromDb(): Promise<WorkspaceId> {
    const workspaces = await this.getAllWorkspaces()
    if (workspaces.length > 0) {
      return workspaces[0].id as WorkspaceId
    }
    // fallback: 如果 workspace table 還沒建立，使用 in-memory 值
    return this.currentWorkspaceId
  }

  async updateWorkspace(workspace: Workspace): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([WORKSPACE_STORE], 'readwrite')
      const store = transaction.objectStore(WORKSPACE_STORE)
      const request = store.put(workspace)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ===== Page 操作 =====

  async createPage(page: Page): Promise<void> {
    // 加密頁面用 encryptedContent 計算 hash，普通頁面用 content
    const contentForHash = (page.isEncrypted && page.encryptedContent)
      ? page.encryptedContent
      : page.content
    const contentHash = await calculateContentHash(contentForHash)
    const pageWithHash: Page = {
      ...page,
      contentHash
    }

    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readwrite')
      const store = transaction.objectStore(PAGE_STORE)
      // 使用 put 而非 add，避免匯入時 key 已存在的錯誤
      const request = store.put(pageWithHash)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updatePage(page: Page): Promise<void> {
    let contentHash = page.contentHash

    // 如果沒有傳入 contentHash，才重新計算
    if (!contentHash) {
      // 加密頁面用 encryptedContent 計算 hash，普通頁面用 content
      const contentForHash = (page.isEncrypted && page.encryptedContent)
        ? page.encryptedContent
        : page.content
      contentHash = await calculateContentHash(contentForHash)
    }

    const pageWithHash: Page = {
      ...page,
      contentHash
    }

    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readwrite')
      const store = transaction.objectStore(PAGE_STORE)
      const request = store.put(pageWithHash)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deletePage(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readwrite')
      const store = transaction.objectStore(PAGE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 靜默刪除 page（不記錄刪除記錄）
   * 用於同步邏輯：從 Drive 下載刪除記錄後執行刪除
   */
  async silentDeletePage(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readwrite')
      const store = transaction.objectStore(PAGE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getPage(id: string): Promise<Page | undefined> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readonly')
      const store = transaction.objectStore(PAGE_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getPagesByFolder(folderId: string, includeDeleted: boolean = false): Promise<Page[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([PAGE_STORE], 'readonly')
      const store = transaction.objectStore(PAGE_STORE)
      const index = store.index('folderId')
      const request = index.getAll(folderId)

      request.onsuccess = () => {
        // 🔧 過濾掉 isDeleted 的 pages，除非 includeDeleted 為 true
        const pages = request.result.filter(p => includeDeleted || !p.isDeleted)
        resolve(pages)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAllPages(_filter?: { workspaceId?: WorkspaceId }): Promise<Page[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      // V10: 每個 DB 只存放一個 workspace 的資料，忽略 _filter 參數
      const transaction = conn.transaction([PAGE_STORE], 'readonly')
      const store = transaction.objectStore(PAGE_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result as Page[]
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deletePagesByFolder(folderId: string): Promise<void> {
    const pages = await this.getPagesByFolder(folderId)
    const deletePromises = pages.map(page => this.deletePage(page.id))
    await Promise.all(deletePromises)
  }

  // ===== Image 操作 =====

  async saveImage(imageData: ImageData): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([IMAGE_STORE], 'readwrite')
      const store = transaction.objectStore(IMAGE_STORE)
      const request = store.put(imageData)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getImage(id: string): Promise<ImageData | undefined> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([IMAGE_STORE], 'readonly')
      const store = transaction.objectStore(IMAGE_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteImage(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      const transaction = conn.transaction([IMAGE_STORE], 'readwrite')
      const store = transaction.objectStore(IMAGE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllImages(_filter?: { workspaceId?: WorkspaceId }): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection()

      // V10: 每個 DB 只存放一個 workspace 的資料，忽略 _filter 參數
      const transaction = conn.transaction([IMAGE_STORE], 'readonly')
      const store = transaction.objectStore(IMAGE_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const images = request.result as ImageData[]
        resolve(images)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 根據 contentHash 查找圖片（用於去重）
   * V10: 同一 DB（同一 workspace）內去重
   * @param contentHash 圖片內容雜湊值
   * @param workspaceId 已棄用，V10 後忽略此參數
   */
  async findImageByContentHash(
    contentHash: string,
    _workspaceId?: WorkspaceId
  ): Promise<ImageData | undefined> {
    const images = await this.getAllImages()
    return images.find(img => img.contentHash === contentHash)
  }
}

// ===== 內部 singleton（不直接 export，改由 db() function 存取）=====
const dbService = new DatabaseService()

// 供 workspaceDb.ts 內部使用（避免循環依賴）
export { dbService as _dbService }

// ===== Registration pattern：避免 db.ts ↔ workspaceDb.ts 循環依賴 =====
import type { WorkspaceDbInstance } from './workspaceDb'

type DbFactory = (wsId: WorkspaceId) => WorkspaceDbInstance
let _dbFactory: DbFactory | null = null

/**
 * 由 workspaceDb.ts 在 module load 時呼叫，註冊 workspace factory
 * @internal
 */
export function _registerDbFactory(factory: DbFactory): void {
  _dbFactory = factory
}

/**
 * 取得指定 workspace 的 DB 實例
 * 每次呼叫都確保操作在正確的 workspace connection 上執行
 *
 * workspaceId 必須來自穩定來源（React state、function param、entity 欄位），
 * 不可從 dbInit.getCurrentWorkspaceId() 取得。
 *
 * @example
 * db('global').getPage(id)
 * db(selectedWorkspaceId).createPage(page)
 * db(page.workspaceId).updatePage(page)
 */
export function db(workspaceId: WorkspaceId): WorkspaceDbInstance {
  if (!_dbFactory) {
    throw new Error('DB factory not initialized. Ensure workspaceDb module is imported.')
  }
  return _dbFactory(workspaceId)
}

/**
 * DB 初始化 API（僅用於 App 啟動、migration、debug）
 * 不含 getCurrentWorkspaceId()，避免呼叫端用不穩定的來源
 */
export const dbInit = {
  init: (wsId?: WorkspaceId) => dbService.init(wsId),
  switchWorkspace: (wsId: WorkspaceId) => dbService.switchWorkspace(wsId),
  ensureConnection: (wsId: WorkspaceId) => dbService.ensureConnection(wsId),
}
