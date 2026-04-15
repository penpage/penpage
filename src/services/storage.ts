/**
 * Storage Service - 向後兼容的封裝
 * 實際使用 settingsService
 */

import { settingsService } from './settings'

// 向後兼容的接口
interface AppState {
  selectedFolderId: string | null
  cursorPosition: number | null
  expandedFolders: string[]
  pageSortBy: string
  pageSortOrder: string
}

class StorageService {
  // 保存狀態
  saveState(state: Partial<AppState>): void {
    if (state.pageSortBy || state.pageSortOrder) {
      settingsService.saveSyncedSettings({
        pageSortBy: state.pageSortBy as any,
        pageSortOrder: state.pageSortOrder as any,
      })
    }

    const localState: any = {}
    if (state.selectedFolderId !== undefined) localState.selectedFolderId = state.selectedFolderId
    if (state.expandedFolders !== undefined) localState.expandedFolders = state.expandedFolders

    if (Object.keys(localState).length > 0) {
      settingsService.saveLocalSettings(localState)
    }
  }

  // 獲取完整狀態
  getState(): AppState {
    const synced = settingsService.getSyncedSettings()
    const local = settingsService.getLocalSettings()

    return {
      selectedFolderId: settingsService.getCurrentSelectedFolder(),
      cursorPosition: null,
      expandedFolders: local.expandedFolders,
      pageSortBy: synced.pageSortBy,
      pageSortOrder: synced.pageSortOrder,
    }
  }

  saveSelectedFolder(folderId: string | null): void {
    // 向後兼容：使用當前 workspace
    const workspaceId = settingsService.getSelectedWorkspace()
    settingsService.saveSelectedFolder(folderId, workspaceId)
  }

  saveCursorPosition(_position: number | null): void {
    // 不再使用，保留接口兼容性
  }

  saveExpandedFolders(folderIds: string[]): void {
    settingsService.saveExpandedFolders(folderIds)
  }

  getExpandedFolders(): string[] {
    return settingsService.getExpandedFolders()
  }

  savePageSort(sortBy: string, sortOrder: string): void {
    settingsService.savePageSort(sortBy as any, sortOrder as any)
  }

  getPageSort(): { sortBy: string; sortOrder: string } {
    return settingsService.getPageSort()
  }

  clearState(): void {
    // 只清除本地狀態，不清除同步設定
    settingsService.saveLocalSettings({
      expandedFolders: [],
      lastSelectedFolder: {}
    })
  }
}

export const storage = new StorageService()
