/**
 * Storage & Sync 統一類型定義
 */

import { Folder, Page, ImageData } from '../db'
import { SyncedSettings } from '../settings'
import { ImageMetadata } from '../../utils/imagePathConverter'
import { WorkspaceId } from '../../types/workspace'

/**
 * 完整的匯出數據結構
 */
export interface ExportData {
  folders: Folder[]
  pages: Page[]
  images: ImageData[]
  imageMetadata: (ImageMetadata & { contentHash: string })[]
  settings: SyncedSettings
  // 備份來源 workspace（用於匯入時驗證一致性）
  sourceWorkspace?: WorkspaceId
}

/**
 * 單個 Folder 的匯出數據（不包含 images 和 settings）
 */
export interface FolderExportData {
  folders: Folder[]
  pages: Page[]
}

/**
 * 進度回調函數
 */
export type ProgressCallback = (current: number, total: number, message: string) => void

/**
 * Storage Adapter 接口
 * 所有存儲方式都需要實現這個接口
 */
export interface StorageAdapter {
  /**
   * Adapter 名稱（用於顯示和日誌）
   */
  name: string

  /**
   * 保存完整數據
   */
  saveAll(data: ExportData, onProgress?: ProgressCallback): Promise<void>

  /**
   * 載入完整數據
   */
  loadAll(onProgress?: ProgressCallback): Promise<ExportData>

  /**
   * 檢查此 Adapter 是否可用
   */
  isAvailable(): Promise<boolean>
}

/**
 * Folder Storage Adapter 接口
 * 用於單個 folder 的匯出/匯入
 */
export interface FolderStorageAdapter {
  /**
   * Adapter 名稱
   */
  name: string

  /**
   * 保存單個 folder
   */
  saveFolder(data: FolderExportData): Promise<void>

  /**
   * 載入單個 folder
   */
  loadFolder(): Promise<FolderExportData>

  /**
   * 檢查此 Adapter 是否可用
   */
  isAvailable(): Promise<boolean>
}
