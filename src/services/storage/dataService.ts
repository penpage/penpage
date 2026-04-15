/**
 * 統一的數據服務
 * 負責所有數據的讀取、寫入、清空操作
 */

import { db, dbInit, Folder, Page } from '../db'
import { createLogger } from '../../utils/logger'

const log = createLogger('BACKUP')
import { settingsService } from '../settings'
import { calculateBlobHash } from '../../utils/hashCalculator'
import { ExportData, FolderExportData, ProgressCallback } from './types'
import { generatePageId, generateFolderId } from '../../utils/idGenerator'
import {
  ensureSystemStructureExists,
  isAnyRootFolderId,
  TRASH_FOLDER_ID,
  ROOT_FOLDER_ID,
  isTrashFolderId
} from '../rootFolders'
import { WorkspaceId } from '../../types/workspace'

/** 檢查是否為 Trash folder */
const isTrashFolder = (folderId: string | null): boolean => {
  if (folderId === null) return false
  return folderId === TRASH_FOLDER_ID
}

/** workspace 和 Trash 過濾選項 */
export interface WorkspaceOptions {
  workspaceId?: WorkspaceId
  /** 排除 Trash 資料夾及其內容（用於 Force Upload/Download） */
  excludeTrash?: boolean
  /** 跳過 resetToken 覆寫（用於 Force Download，由呼叫端自行管理 resetToken） */
  skipResetToken?: boolean
}

export class DataService {
  /**
   * 獲取所有本地數據（用於完整匯出）
   * @param onProgress 進度回調
   * @param options 可選的 workspace 過濾和 Trash 排除選項
   */
  async exportAll(onProgress?: ProgressCallback, options?: WorkspaceOptions): Promise<ExportData> {
    try {
      const wsId = options?.workspaceId ?? settingsService.getSelectedWorkspace()

      onProgress?.(0, 4, 'Reading folders...')
      let folders = await db(wsId).getAllFolders()

      onProgress?.(1, 4, 'Reading pages...')
      let pages = await db(wsId).getAllPages()

      // 排除 Trash 資料夾及其內容
      if (options?.excludeTrash) {
        // 過濾掉 Trash folder 本身
        folders = folders.filter(f => !isTrashFolder(f.id))
        // 過濾掉在 Trash 中的頁面（folderId 指向 Trash）
        pages = pages.filter(p => !isTrashFolder(p.folderId))
        // 也過濾掉已標記刪除的項目
        folders = folders.filter(f => !f.isDeleted)
        pages = pages.filter(p => !p.isDeleted)
        log(`🗑️ 排除 Trash: 匯出 ${folders.length} folders, ${pages.length} pages`)
      }

      // Debug: 檢查是否有 unknown folder 的 pages（在匯出階段）
      const folderIdSet = new Set(folders.map(f => f.id))
      const orphanPages = pages.filter(p => !folderIdSet.has(p.folderId))
      if (orphanPages.length > 0) {
        log.warn('[Export] 發現孤兒 pages（folderId 指向不存在的 folder）:')
        orphanPages.forEach((page, i) => {
          log.warn(`  ${i + 1}. Page: id=${page.id}, name="${page.name}", folderId="${page.folderId}"`)
        })
        log.warn(`  📊 總共 ${orphanPages.length} 個孤兒 pages`)
        log.warn(`  📊 將被匯出的 Folders 數: ${folders.length}, Pages 數: ${pages.length}`)
        // 列出 workspace 篩選條件
        log.warn(`  📊 篩選條件: workspaceId=${options?.workspaceId || 'all'}, excludeTrash=${options?.excludeTrash || false}`)
      }

      onProgress?.(2, 4, 'Reading images...')
      const images = await db(wsId).getAllImages()

      onProgress?.(3, 4, 'Reading settings...')
      const settings = settingsService.getSyncedSettings()

      // 計算圖片的 metadata
      const imageMetadata = await Promise.all(
        images.map(async (img) => {
          const contentHash = await calculateBlobHash(img.blob)
          return {
            id: img.id,
            filename: img.filename,
            mimeType: img.mimeType,
            size: img.size,
            createdAt: img.createdAt,
            contentHash,
          }
        })
      )

      onProgress?.(4, 4, 'Data collection complete')

      return {
        folders,
        pages,
        images,
        imageMetadata,
        settings,
        // 記錄備份來源 workspace（用於匯入時驗證一致性）
        sourceWorkspace: options?.workspaceId,
      }
    } catch (error) {
      log.error('Failed to export all data:', error)
      throw new Error(`Export failed: ${(error as Error).message}`)
    }
  }

  /**
   * 匯入所有數據（覆蓋本地）
   *
   * 🔒 Workspace 隔離重構：
   * - 保持原 ID（同 workspace 內不會衝突，因為已在 localExportImport 層驗證一致性）
   * - 簡化 parentId 處理（不需要 ID 映射）
   * - 由 localExportImport 層負責 workspace 驗證
   *
   * V10: 自動轉換舊格式
   * - root-global/root-local → root
   * - trash-global/trash-local → trash
   * - parentId='root' → 'workspace'
   *
   * @param data 要匯入的數據
   * @param onProgress 進度回調
   * @param options workspaceId 是必要的，用於清除和匯入資料
   */
  async importAll(data: ExportData, onProgress?: ProgressCallback, options?: WorkspaceOptions): Promise<void> {
    try {
      // workspaceId 是必要的（由呼叫端負責傳入）
      const targetWorkspaceId = options?.workspaceId
      if (!targetWorkspaceId) {
        throw new Error('workspaceId is required for importAll')
      }

      // V10: 確保 DB 切換到目標 workspace
      await dbInit.switchWorkspace(targetWorkspaceId)

      const totalSteps = 5
      const workspaceLabel = ` (${targetWorkspaceId})`

      // Restore 開始
      log(`Restore Start | incoming: ${data.folders.length}F ${data.pages.length}P ${data.images.length}I`)

      // Step 1: 清空現有數據（只清除指定的 workspace）
      onProgress?.(1, totalSteps, `Clearing existing data${workspaceLabel}...`)
      await this.clearAllData(undefined, options)

      // V10: 使用統一的 root ID
      const targetRootId = ROOT_FOLDER_ID

      // Step 2: 匯入 folders - 保持原 ID（同 workspace 不會衝突）
      // 過濾掉系統 folder（root, trash）- 這些由 ensureSystemStructureExists 管理
      const filteredFolders = data.folders.filter(folder => {
        // 排除 trash folders（如果設定了 excludeTrash）
        if (options?.excludeTrash && isTrashFolder(folder.id)) return false
        // 排除系統 folders（root 和 trash）- 這些由 ensureSystemStructureExists 管理
        if (isAnyRootFolderId(folder.id) || isTrashFolderId(folder.id) || folder.isRootFolder || folder.isTrashFolder) return false
        return true
      })

      // 用雲端的 root folder 資料更新本地 root folder 的 name 和 updatedAt
      const cloudRootFolder = data.folders.find(
        f => isAnyRootFolderId(f.id) || f.isRootFolder
      )
      if (cloudRootFolder) {
        const localRoot = await db(targetWorkspaceId).getFolder(ROOT_FOLDER_ID)
        if (localRoot) {
          await db(targetWorkspaceId).updateFolder({
            ...localRoot,
            name: cloudRootFolder.name,
            updatedAt: cloudRootFolder.updatedAt,
          })
        }
      }

      onProgress?.(2, totalSteps, `Importing ${filteredFolders.length} folders${workspaceLabel}...`)

      // 建立有效 folder ID 集合（用於驗證 parentId）
      const validFolderIds = new Set(filteredFolders.map(f => f.id))

      const foldersToImport = filteredFolders.map(folder => {
        // 計算正確的 parentId
        let newParentId: string | null = folder.parentId
        if (isAnyRootFolderId(folder.parentId)) {
          // 頂層 folder → 指向目標 workspace 的 root
          newParentId = targetRootId
        } else if (folder.parentId && !validFolderIds.has(folder.parentId)) {
          // parentId 指向不存在的 folder → 移到 root
          log.warn(`Folder "${folder.name}" has invalid parentId "${folder.parentId}", moving to root`)
          newParentId = targetRootId
        }

        return {
          ...folder,
          // 保持原 ID（同 workspace 不會衝突）
          parentId: newParentId,
          // 清除同步狀態（因為是恢復的資料，需要重新同步）
          lastSyncedAt: undefined,
          driveFileId: undefined,
        }
      })
      await Promise.all(foldersToImport.map(folder => db(targetWorkspaceId).updateFolder(folder)))

      // Step 3: 匯入 pages - 保持原 ID（同 workspace 不會衝突）
      const filteredPages = data.pages.filter(page => {
        if (options?.excludeTrash && isTrashFolder(page.folderId)) return false
        return true
      })

      onProgress?.(3, totalSteps, `Importing ${filteredPages.length} pages${workspaceLabel}...`)

      const pagesToImport = filteredPages.map(page => {
        // 計算正確的 folderId
        let newFolderId = page.folderId
        if (isAnyRootFolderId(page.folderId)) {
          // 頁面在 root folder 下 → 指向目標 workspace 的 root
          newFolderId = targetRootId
        } else if (!validFolderIds.has(page.folderId)) {
          // folderId 指向不存在的 folder → 移到 root
          log.warn(`Page "${page.name}" has invalid folderId "${page.folderId}", moving to root`)
          newFolderId = targetRootId
        }

        return {
          ...page,
          // 保持原 ID（同 workspace 不會衝突）
          folderId: newFolderId,
          // 清除同步狀態
          lastSyncedAt: undefined,
          contentHash: undefined,
        }
      })
      await Promise.all(pagesToImport.map(page => db(targetWorkspaceId).updatePage(page)))

      // Step 4: 匯入 images（設定 workspaceId）
      // 使用 Promise.all 並行寫入以提升效能
      if (data.images.length > 0) {
        onProgress?.(4, totalSteps, `Importing ${data.images.length} images...`)
        const imagesToImport = data.images
        await Promise.all(imagesToImport.map(image => db(targetWorkspaceId).saveImage(image)))
      } else {
        onProgress?.(4, totalSteps, 'No images to import...')
      }

      // Step 5: 匯入 settings
      onProgress?.(5, totalSteps, 'Importing settings...')
      if (data.settings) {
        settingsService.replaceSyncedSettings(data.settings)
      }

      // 確保系統資料夾存在
      // 這些可能不在備份中，但在 clearAllData 時被刪除了
      await ensureSystemStructureExists(targetWorkspaceId)

      log(`Restore Complete | imported: ${foldersToImport.length}F ${pagesToImport.length}P ${data.images.length}I`)

      log(`✅ Import${workspaceLabel} data complete`)
    } catch (error) {
      log.error('Failed to import all data:', error)
      throw new Error(`Import failed: ${(error as Error).message}`)
    }
  }

  /**
   * 清空本地數據
   * @param onProgress 進度回調
   * @param options 可選的 workspace 過濾和 Trash 排除選項
   */
  async clearAllData(onProgress?: ProgressCallback, options?: WorkspaceOptions): Promise<void> {
    try {
      const wsId = options?.workspaceId ?? settingsService.getSelectedWorkspace()
      const workspaceLabel = ` (${wsId})`

      onProgress?.(0, 3, 'Getting existing data...')
      let folders = await db(wsId).getAllFolders()
      let pages = await db(wsId).getAllPages()
      let images = await db(wsId).getAllImages()

      // 只保留 V10 系統 folder（root, trash）— 由 ensureSystemStructureExists 管理
      // 注意：不能用 isSystemFolder 標記判斷，因為舊版系統 folder（如 recycle-folder-bin,
      // trash-cloud）也帶有此標記，會導致 restore 後殘留
      folders = folders.filter(f => f.id !== ROOT_FOLDER_ID && f.id !== TRASH_FOLDER_ID)

      // ❌ 已移除孤兒清理邏輯（會誤刪其他 workspace 的資料）
      // 如果需要清理孤兒資料，應該提供獨立的維護功能

      // 排除 Trash - 保留 Trash folder 和其中的內容
      if (options?.excludeTrash) {
        folders = folders.filter(f => !isTrashFolder(f.id))
        pages = pages.filter(p => !isTrashFolder(p.folderId))
      }

      // 使用 Promise.all 並行刪除以提升效能
      onProgress?.(1, 3, `Deleting ${folders.length} folders${workspaceLabel}...`)
      await Promise.all(folders.map(folder => db(wsId).deleteFolder(folder.id)))

      onProgress?.(2, 3, `Deleting ${pages.length} pages${workspaceLabel}...`)
      await Promise.all(pages.map(page => db(wsId).deletePage(page.id)))

      if (images.length > 0) {
        onProgress?.(3, 3, `Deleting ${images.length} images...`)
        await Promise.all(images.map(image => db(wsId).deleteImage(image.id)))
      }

      log(`✅ Clear${workspaceLabel} data complete`)
    } catch (error) {
      log.error('Failed to clear all data:', error)
      throw new Error(`Clear failed: ${(error as Error).message}`)
    }
  }

  /**
   * 獲取單個 folder 的數據（包含所有子 folders 和 pages）
   */
  async exportFolder(folderId: string, onProgress?: ProgressCallback, workspaceId?: WorkspaceId): Promise<FolderExportData> {
    try {
      const wsId = workspaceId ?? settingsService.getSelectedWorkspace()

      onProgress?.(0, 2, 'Reading folders...')
      const allFolders = await db(wsId).getAllFolders()

      onProgress?.(1, 2, 'Reading pages...')
      const allPages = await db(wsId).getAllPages()

      // 遞迴收集所有子 folders
      const folders = this.collectSubFolders(folderId, allFolders)

      // 收集所有相關的 pages
      const folderIds = new Set(folders.map((f) => f.id))
      const pages = allPages.filter((p) => folderIds.has(p.folderId))

      onProgress?.(2, 2, 'Folder data collected')

      return { folders, pages }
    } catch (error) {
      log.error('Failed to export folder:', error)
      throw new Error(`Export folder failed: ${(error as Error).message}`)
    }
  }

  /**
   * 匯入單個 folder（到指定的父 folder 下）
   */
  async importFolder(
    data: FolderExportData,
    parentFolderId: string,
    onProgress?: ProgressCallback,
    workspaceId?: WorkspaceId
  ): Promise<void> {
    try {
      const wsId = workspaceId ?? settingsService.getSelectedWorkspace()

      if (data.folders.length === 0) {
        throw new Error('No folders to import')
      }

      const totalSteps = data.folders.length + data.pages.length + 1

      // 創建 ID 映射（舊 ID -> 新 ID）
      const idMap = new Map<string, string>()
      const rootFolderId = data.folders[0].id

      // 為所有 folders 生成新 ID
      for (const folder of data.folders) {
        const newId = generateFolderId()
        idMap.set(folder.id, newId)
      }

      let currentStep = 0

      // 匯入 folders（按層級順序）
      const sortedFolders = this.sortFoldersByHierarchy(data.folders)
      for (const folder of sortedFolders) {
        onProgress?.(++currentStep, totalSteps, `Importing folder: ${folder.name}`)

        const newFolder: Folder = {
          ...folder,
          id: idMap.get(folder.id)!,
          parentId:
            folder.id === rootFolderId ? parentFolderId : idMap.get(folder.parentId!) || null,
          updatedAt: Date.now(),

          // Clean Sync Data（V10: workspace 由 DB 本身決定）
          lastSyncedAt: undefined,
          driveFileId: undefined,
        }

        await db(wsId).createFolder(newFolder)
      }

      // 匯入 pages
      for (const page of data.pages) {
        onProgress?.(++currentStep, totalSteps, `Importing page: ${page.name}`)

        const newFolderId = idMap.get(page.folderId)
        if (!newFolderId) {
          log.warn(`Skipping page ${page.name}: folder mapping not found`)
          continue
        }

        const newPage: Page = {
          ...page,
          id: generatePageId(),
          folderId: newFolderId,
          updatedAt: Date.now(),

          // Clean Sync Data
          lastSyncedAt: undefined,
          contentHash: undefined, // Will be recalculated on create
        }

        await db(wsId).createPage(newPage)
      }

      onProgress?.(totalSteps, totalSteps, '✅ Import folder complete')
      log('✅ Import folder complete')
    } catch (error) {
      log.error('Failed to import folder:', error)
      throw new Error(`Import folder failed: ${(error as Error).message}`)
    }
  }

  /**
   * 遞迴收集所有子 folders
   */
  private collectSubFolders(folderId: string, allFolders: Folder[]): Folder[] {
    const result: Folder[] = []
    const folder = allFolders.find((f) => f.id === folderId)

    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`)
    }

    result.push(folder)

    // 遞迴收集子 folders
    const children = allFolders.filter((f) => f.parentId === folderId)
    for (const child of children) {
      result.push(...this.collectSubFolders(child.id, allFolders))
    }

    return result
  }

  /**
   * 按層級排序 folders（父 folder 優先）
   */
  private sortFoldersByHierarchy(folders: Folder[]): Folder[] {
    const sorted: Folder[] = []
    const folderMap = new Map(folders.map((f) => [f.id, f]))
    const processed = new Set<string>()

    const addFolderAndChildren = (folderId: string) => {
      if (processed.has(folderId)) return

      const folder = folderMap.get(folderId)
      if (!folder) return

      // 先添加父 folder
      if (folder.parentId && !processed.has(folder.parentId)) {
        addFolderAndChildren(folder.parentId)
      }

      sorted.push(folder)
      processed.add(folderId)

      // 再添加子 folders
      for (const f of folders) {
        if (f.parentId === folderId && !processed.has(f.id)) {
          addFolderAndChildren(f.id)
        }
      }
    }

    // 從根 folders 開始
    for (const folder of folders) {
      if (!processed.has(folder.id)) {
        addFolderAndChildren(folder.id)
      }
    }

    return sorted
  }
}

// 導出單例
export const dataService = new DataService()