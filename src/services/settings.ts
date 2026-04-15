/**
 * Settings Management Service
 * 管理應用設定，區分同步設定和本地設定
 */

import { WorkspaceId } from '../types/workspace'

/**
 * 同步設定：跨裝置同步的設定
 */
/** 最後同步的裝置資訊 */
export interface LastSyncedDevice {
  deviceId: string        // 裝置 ID（如 "f52853ec-488b-4..."）
  deviceName: string      // 裝置名稱（如 "Chrome on macOS"）
  browser: string         // 瀏覽器（如 "Chrome 143.0"）
  os: string              // 作業系統（如 "macOS 10.15"）
  ip?: string             // IP 位址（如 "211.23.59.138"）
}

export interface SyncedSettings {
  pageSortBy: 'name' | 'createdAt' | 'updatedAt' | 'none'
  pageSortOrder: 'asc' | 'desc'
  showTrash: boolean // 是否顯示回收桶
  showLineNumbers: boolean // 是否顯示行號（Desktop only）
  theme: string      // 主題模式（blackboard, dark, light 等）
  updatedAt: number  // 設定更新時間

  // 字體大小設定（Desktop / Mobile 分離）
  desktopInterfaceFontSize: number  // Desktop 介面字體（12-36px），預設 18
  desktopContentFontSize: number    // Desktop 內容字體（12-36px），預設 18
  mobileInterfaceFontSize: number   // Mobile 介面字體（12-36px），預設 24
  mobileContentFontSize: number     // Mobile 內容字體（12-36px），預設 24

  // 最後同步資訊（由同步操作寫入 Drive）
  lastSyncedAt?: number           // 最後同步時間戳
  lastSyncedBy?: LastSyncedDevice // 最後同步的裝置資訊

  // Workspace 設定（Edit Mode 新增）
  workspaceColors?: Record<string, string>  // Workspace 自訂顏色 { workspaceId: hex }
  hiddenWorkspaces?: string[]               // 被隱藏的 Workspace ID 列表
  workspaceOrder?: string[]                 // Workspace 排序順序，預設 ['global', 'local']
}

/**
 * 搜尋歷史項目
 */
export interface SearchHistoryItem {
  query: string
  timestamp: number
}

/**
 * 本地設定：裝置特定的設定（不同步）
 */
export interface LocalSettings {
  expandedFolders: string[]
  lastSelectedWorkspace: WorkspaceId  // 最近選擇的 Workspace
  searchHistory: SearchHistoryItem[]  // 搜尋歷史
  // 按 workspace 保存最近選取的 folder
  lastSelectedFolder?: Partial<Record<WorkspaceId, string>>
  lastActiveTime?: number  // 最後活動時間（用於久未使用恢復到頁面列表）
}

const SYNCED_SETTINGS_KEY = 'ppage_synced_settings'
const LOCAL_SETTINGS_KEY = 'ppage_local_settings'

const DEFAULT_SYNCED_SETTINGS: SyncedSettings = {
  pageSortBy: 'updatedAt', // 預設按修改時間排序
  pageSortOrder: 'desc',   // 預設降序（最新的在上面）
  showTrash: false,        // 預設不顯示回收桶
  showLineNumbers: false,  // 預設不顯示行號
  theme: 'blackboard',     // 預設黑板模式
  // Desktop / Mobile 分離字體設定
  desktopInterfaceFontSize: 18,  // Desktop 介面字體預設 18px
  desktopContentFontSize: 18,    // Desktop 內容字體預設 18px
  mobileInterfaceFontSize: 24,   // Mobile 介面字體預設 24px
  mobileContentFontSize: 24,     // Mobile 內容字體預設 24px
  updatedAt: Date.now(),
}

const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  expandedFolders: [],
  lastSelectedWorkspace: 'local',  // 預設使用 Local Workspace
  searchHistory: [],  // 搜尋歷史預設為空
  lastSelectedFolder: {}
}

// 搜尋歷史最大數量
const MAX_SEARCH_HISTORY = 20

/**
 * 判斷當前裝置是否為 Mobile（用於字體大小設定）
 * 基於 touch capability 而非螢幕寬度判斷
 * 載入時判斷一次，不隨 orientation 變化
 */
export function isMobileDevice(): boolean {
  // 檢查是否有觸控能力
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // 有觸控能力，但要排除觸控螢幕電腦（如 Surface）
    // 如果同時支援精確指標（滑鼠），視為 Desktop
    const hasFineMouse = window.matchMedia('(pointer: fine)').matches
    if (hasFineMouse) {
      return false // 觸控螢幕電腦，視為 Desktop
    }
    return true // 純觸控裝置（手機/平板）
  }
  return false // 無觸控，Desktop
}

class SettingsService {
  // ==================== Synced Settings ====================

  getSyncedSettings(): SyncedSettings {
    const stored = localStorage.getItem(SYNCED_SETTINGS_KEY)
    if (!stored) {
      return { ...DEFAULT_SYNCED_SETTINGS }
    }

    return JSON.parse(stored)
  }

  /**
   * 取得當前裝置的字體大小設定
   */
  getCurrentDeviceFontSize(): { interfaceFontSize: number; contentFontSize: number } {
    const settings = this.getSyncedSettings()
    if (isMobileDevice()) {
      return {
        interfaceFontSize: settings.mobileInterfaceFontSize,
        contentFontSize: settings.mobileContentFontSize,
      }
    } else {
      return {
        interfaceFontSize: settings.desktopInterfaceFontSize,
        contentFontSize: settings.desktopContentFontSize,
      }
    }
  }

  saveSyncedSettings(settings: Partial<SyncedSettings>): void {
    const current = this.getSyncedSettings()
    const updated = { ...current, ...settings, updatedAt: Date.now() }
    localStorage.setItem(SYNCED_SETTINGS_KEY, JSON.stringify(updated))
  }

  replaceSyncedSettings(settings: SyncedSettings): void {
    localStorage.setItem(SYNCED_SETTINGS_KEY, JSON.stringify(settings))
  }

  // ==================== Local Settings ====================

  getLocalSettings(): LocalSettings {
    const stored = localStorage.getItem(LOCAL_SETTINGS_KEY)
    return stored ? JSON.parse(stored) : { ...DEFAULT_LOCAL_SETTINGS }
  }

  saveLocalSettings(settings: Partial<LocalSettings>): void {
    const current = this.getLocalSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated))
  }

  // ==================== Convenience Methods ====================

  savePageSort(sortBy: SyncedSettings['pageSortBy'], sortOrder: SyncedSettings['pageSortOrder']): void {
    this.saveSyncedSettings({ pageSortBy: sortBy, pageSortOrder: sortOrder })
  }

  getPageSort(): { sortBy: SyncedSettings['pageSortBy']; sortOrder: SyncedSettings['pageSortOrder'] } {
    const settings = this.getSyncedSettings()
    return { sortBy: settings.pageSortBy, sortOrder: settings.pageSortOrder }
  }

  /**
   * 保存選取的 folder（按 workspace 分開儲存）
   * @param folderId folder ID，null 表示清除
   * @param workspaceId workspace ID，必須提供
   */
  saveSelectedFolder(folderId: string | null, workspaceId: WorkspaceId): void {
    const current = this.getLocalSettings()
    const byWorkspace = current.lastSelectedFolder || {}

    if (folderId) {
      this.saveLocalSettings({
        lastSelectedFolder: {
          ...byWorkspace,
          [workspaceId]: folderId
        }
      })
    } else {
      // 清除該 workspace 的記錄
      const { [workspaceId]: _, ...rest } = byWorkspace
      this.saveLocalSettings({
        lastSelectedFolder: rest
      })
    }
  }

  /**
   * 取得指定 workspace 最近選取的 folder ID
   */
  getSelectedFolder(workspaceId: WorkspaceId): string | null {
    const settings = this.getLocalSettings()
    return settings.lastSelectedFolder?.[workspaceId] || null
  }

  /**
   * 取得當前 workspace 選取的 folder ID（便利方法）
   */
  getCurrentSelectedFolder(): string | null {
    const workspaceId = this.getSelectedWorkspace()
    return this.getSelectedFolder(workspaceId)
  }

  saveExpandedFolders(folderIds: string[]): void {
    this.saveLocalSettings({ expandedFolders: folderIds })
  }

  getExpandedFolders(): string[] {
    return this.getLocalSettings().expandedFolders
  }

  saveSelectedWorkspace(workspaceId: WorkspaceId): void {
    this.saveLocalSettings({ lastSelectedWorkspace: workspaceId })
  }

  getSelectedWorkspace(): WorkspaceId {
    const settings = this.getLocalSettings()
    return settings.lastSelectedWorkspace || 'local'
  }

  // ==================== Search History ====================

  /**
   * 取得搜尋歷史
   */
  getSearchHistory(): SearchHistoryItem[] {
    return this.getLocalSettings().searchHistory || []
  }

  /**
   * 新增搜尋歷史
   * - 如果已存在相同 query，更新時間戳並移到最前面
   * - 超過上限時移除最舊的
   */
  addSearchHistory(query: string): void {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    const history = this.getSearchHistory()
    // 移除已存在的相同 query（去重）
    const filtered = history.filter(h => h.query !== trimmedQuery)
    // 加到最前面
    const updated = [
      { query: trimmedQuery, timestamp: Date.now() },
      ...filtered
    ].slice(0, MAX_SEARCH_HISTORY)

    this.saveLocalSettings({ searchHistory: updated })
  }

  /**
   * 移除單筆搜尋歷史
   */
  removeSearchHistory(query: string): void {
    const history = this.getSearchHistory()
    const updated = history.filter(h => h.query !== query)
    this.saveLocalSettings({ searchHistory: updated })
  }

  /**
   * 清除所有搜尋歷史
   */
  clearSearchHistory(): void {
    this.saveLocalSettings({ searchHistory: [] })
  }

  // ==================== Last Active Time ====================

  /**
   * 記錄最後活動時間（切到背景時呼叫）
   */
  saveLastActiveTime(): void {
    this.saveLocalSettings({ lastActiveTime: Date.now() })
  }

  /**
   * 取得最後活動時間
   */
  getLastActiveTime(): number | null {
    return this.getLocalSettings().lastActiveTime ?? null
  }
}

export const settingsService = new SettingsService()
