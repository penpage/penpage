/**
 * Workspace Database Factory
 * V11: db(workspaceId) API — 消除 currentWorkspaceId 共享狀態
 *
 * 設計說明：
 * - 每個 workspace 有獨立的 IndexedDB (PenPage_Global, PenPage_Local, PenPage_Public)
 * - db('global').getPage(id) — 明確指定 workspace，不依賴 currentWorkspaceId
 * - 使用 _dbService.executeOnWorkspace() 確保操作在正確的 connection 上執行
 */

import { _dbService, _registerDbFactory, Folder, Page, ImageData } from './db'
import { settingsService } from './settings'
import { WorkspaceId } from '../types/workspace'
import {
  ROOT_FOLDER_ID,
  TRASH_FOLDER_ID,
  ROOT_PARENT_ID,
  isRootParentId
} from './rootFolders'

/**
 * Workspace Database 介面
 * 每個 workspace 的 DB 實例都遵循此介面
 */
export interface WorkspaceDbInstance {
  readonly workspaceId: WorkspaceId

  // ===== Folder 操作 =====
  getAllFolders(): Promise<Folder[]>
  getFolder(id: string): Promise<Folder | undefined>
  getFoldersByParent(parentId: string | null): Promise<Folder[]>
  createFolder(folder: Folder): Promise<void>
  updateFolder(folder: Folder): Promise<void>
  deleteFolder(id: string): Promise<void>
  updateFolderLastSelectedPage(folderId: string, pageId: string): Promise<void>

  // ===== Page 操作 =====
  getAllPages(): Promise<Page[]>
  getPage(id: string): Promise<Page | undefined>
  getPagesByFolder(folderId: string, includeDeleted?: boolean): Promise<Page[]>
  createPage(page: Omit<Page, 'workspaceId'>): Promise<void>
  updatePage(page: Page): Promise<void>
  deletePage(id: string): Promise<void>

  // ===== Image 操作 =====
  getAllImages(): Promise<ImageData[]>
  getImage(id: string): Promise<ImageData | undefined>
  saveImage(image: Omit<ImageData, 'workspaceId'>): Promise<void>
  deleteImage(id: string): Promise<void>
  findImageByContentHash(contentHash: string): Promise<ImageData | undefined>

  // ===== 常數（每個 workspace DB 相同）=====
  readonly ROOT_FOLDER_ID: string
  readonly TRASH_FOLDER_ID: string
  readonly ROOT_PARENT_ID: string
}

/**
 * 建立 Workspace DB 實例
 * 使用 _dbService.executeOnWorkspace 確保操作在正確的 connection 上執行
 */
function createWorkspaceDbInstance(workspaceId: WorkspaceId): WorkspaceDbInstance {
  return {
    workspaceId,

    // 統一常數
    ROOT_FOLDER_ID,
    TRASH_FOLDER_ID,
    ROOT_PARENT_ID,

    // ===== Folder 操作 =====
    async getAllFolders(): Promise<Folder[]> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getAllFolders())
    },

    async getFolder(id: string): Promise<Folder | undefined> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getFolder(id))
    },

    async getFoldersByParent(parentId: string | null): Promise<Folder[]> {
      return _dbService.executeOnWorkspace(workspaceId, async () => {
        const allFolders = await _dbService.getAllFolders()

        if (parentId === null || parentId === ROOT_PARENT_ID) {
          return allFolders.filter(f => isRootParentId(f.parentId))
        }

        return allFolders.filter(f => f.parentId === parentId)
      })
    },

    async createFolder(folder: Folder): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.createFolder(folder))
    },

    async updateFolder(folder: Folder): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.updateFolder(folder))
    },

    async deleteFolder(id: string): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.deleteFolder(id))
    },

    async updateFolderLastSelectedPage(folderId: string, pageId: string): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () =>
        _dbService.updateFolderLastSelectedPage(folderId, pageId)
      )
    },

    // ===== Page 操作 =====
    async getAllPages(): Promise<Page[]> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getAllPages())
    },

    async getPage(id: string): Promise<Page | undefined> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getPage(id))
    },

    async getPagesByFolder(folderId: string, includeDeleted = false): Promise<Page[]> {
      return _dbService.executeOnWorkspace(workspaceId, async () => {
        const allPages = await _dbService.getAllPages()

        return allPages.filter(p => {
          if (!includeDeleted && p.isDeleted) return false
          return p.folderId === folderId
        })
      })
    },

    async createPage(page: Page): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.createPage(page))
    },

    async updatePage(page: Page): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.updatePage(page))
    },

    async deletePage(id: string): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.deletePage(id))
    },

    // ===== Image 操作 =====
    async getAllImages(): Promise<ImageData[]> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getAllImages())
    },

    async getImage(id: string): Promise<ImageData | undefined> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.getImage(id))
    },

    async saveImage(image: Omit<ImageData, 'workspaceId'>): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () =>
        _dbService.saveImage({ ...image, workspaceId } as ImageData)
      )
    },

    async deleteImage(id: string): Promise<void> {
      return _dbService.executeOnWorkspace(workspaceId, () => _dbService.deleteImage(id))
    },

    async findImageByContentHash(contentHash: string): Promise<ImageData | undefined> {
      return _dbService.executeOnWorkspace(workspaceId, () =>
        _dbService.findImageByContentHash(contentHash)
      )
    }
  }
}

// ===== 快取 DB 實例 =====
const dbInstances = new Map<WorkspaceId, WorkspaceDbInstance>()

/**
 * Workspace Database Factory
 */
export const workspaceDbFactory = {
  getDb(workspaceId: WorkspaceId): WorkspaceDbInstance {
    let instance = dbInstances.get(workspaceId)
    if (!instance) {
      instance = createWorkspaceDbInstance(workspaceId)
      dbInstances.set(workspaceId, instance)
    }
    return instance
  },

  getCurrentDb(): WorkspaceDbInstance {
    const currentWorkspaceId = settingsService.getSelectedWorkspace()
    return this.getDb(currentWorkspaceId)
  },

  getGlobalDb(): WorkspaceDbInstance {
    return this.getDb('local')
  },

  getLocalDb(): WorkspaceDbInstance {
    return this.getDb('local')
  },

  clearCache(): void {
    dbInstances.clear()
  }
}

// ===== 註冊 factory 到 db.ts（避免循環依賴）=====
_registerDbFactory((wsId) => workspaceDbFactory.getDb(wsId))

// ===== 便利匯出 =====
export { ROOT_FOLDER_ID, TRASH_FOLDER_ID, ROOT_PARENT_ID }
