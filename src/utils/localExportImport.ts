/**
 * 本地完整匯出/匯入功能
 * 使用 LocalZipAdapter（人類可讀格式）
 * 支援 Workspace 過濾（根據當前選擇的 workspace 運作）
 * 自動偵測並相容 V3 和 V3.1 備份格式
 */

import { dataService } from '../services/storage/dataService'
import { LocalZipAdapter } from '../services/storage/adapters/LocalZipAdapter'
import { ProgressCallback } from '../services/storage/types'
import { settingsService } from '../services/settings'
import { WorkspaceId } from '../types/workspace'

/**
 * 匯入選項
 */
export interface ImportOptions {
  onProgress?: ProgressCallback
  // 目標 workspace（可選，預設使用當前選擇的 workspace）
  targetWorkspaceId?: WorkspaceId
}

/**
 * 匯出全部到本地（人類可讀 ZIP 格式）
 */
export async function exportAllToLocal(onProgress?: ProgressCallback): Promise<void> {
  try {
    // 取得當前選擇的 workspace
    const workspaceId = settingsService.getSelectedWorkspace()

    // 使用 DataService 獲取指定 workspace 的數據
    // 排除 Trash 內容（包含 conflict pages），避免備份檔案中出現垃圾桶資料
    const data = await dataService.exportAll(onProgress, {
      workspaceId,
      excludeTrash: true
    })

    // 使用 LocalZipAdapter 保存到 ZIP
    const adapter = new LocalZipAdapter()
    await adapter.saveAll(data, onProgress)
  } catch (error) {
    console.error('Export to local failed:', error)
    throw error
  }
}

/**
 * 從本地匯入全部（人類可讀 ZIP 格式）
 * 自動偵測並支援 V3 和 V3.1 格式
 * 根據當前選擇的 workspace 匯入資料（只覆蓋該 workspace）
 */
export async function importAllFromLocal(options?: ImportOptions): Promise<void> {
  try {
    const { onProgress, targetWorkspaceId } = options || {}

    // 使用指定的 targetWorkspaceId，或預設使用當前選擇的 workspace
    const currentWorkspace = targetWorkspaceId ?? settingsService.getSelectedWorkspace()

    // 使用 LocalZipAdapter 載入 ZIP 數據
    const adapter = new LocalZipAdapter()
    const data = await adapter.loadAll(onProgress)

    // 驗證 workspace 一致性（禁止跨 workspace 匯入）
    if (data.sourceWorkspace && data.sourceWorkspace !== currentWorkspace) {
      const wsLabel = (id: string) => id === 'local' ? 'Local' : id
      const sourceLabel = wsLabel(data.sourceWorkspace)
      const targetLabel = wsLabel(currentWorkspace)
      throw new Error(
        `Workspace mismatch: This backup is from "${sourceLabel}" workspace, ` +
        `but you are currently in "${targetLabel}" workspace.\n\n` +
        `Please switch to the "${sourceLabel}" workspace before importing this backup.`
      )
    }

    // 使用驗證後的 workspace ID
    const workspaceId = currentWorkspace

    // 使用 DataService 匯入指定 workspace 的數據
    await dataService.importAll(data, onProgress, { workspaceId })
  } catch (error) {
    console.error('Import from local failed:', error)
    throw error
  }
}
