/**
 * 資料遷移服務
 * 確保系統結構存在（Root folders, Trash folders）
 */

import { WorkspaceId } from '../types/workspace'
import { createLogger } from '../utils/logger'

const log = createLogger('DB')
import { ensureSystemStructureExists } from './rootFolders'

// Migration 版本追蹤（存在 localStorage，按 workspace 區分）
const MIGRATION_VERSION_KEY = 'penpage_migration_version'
const CURRENT_MIGRATION_VERSION = 10

/**
 * 取得當前 workspace 的 migration key
 */
function getMigrationKey(workspaceId: WorkspaceId): string {
  return `${MIGRATION_VERSION_KEY}_${workspaceId}`
}

/**
 * 取得目前 workspace 的 migration 版本
 */
export function getMigrationVersion(workspaceId: WorkspaceId): number {
  const key = getMigrationKey(workspaceId)
  const version = localStorage.getItem(key)
  return version ? parseInt(version, 10) : 0
}

/**
 * 設定目前 workspace 的 migration 版本
 */
function setMigrationVersion(workspaceId: WorkspaceId, version: number): void {
  const key = getMigrationKey(workspaceId)
  localStorage.setItem(key, version.toString())
}

/**
 * 執行所有必要的資料遷移
 * 確保系統結構存在並更新版本號
 */
export async function runMigrations(workspaceId: WorkspaceId): Promise<void> {
  const currentVersion = getMigrationVersion(workspaceId)

  if (currentVersion >= CURRENT_MIGRATION_VERSION) {
    log(`✅ 資料已是最新版本 (${workspaceId})，無需遷移`)
    return
  }

  log(`🔄 開始資料遷移 (${workspaceId}): v${currentVersion} -> v${CURRENT_MIGRATION_VERSION}`)

  try {
    // 確保系統結構存在（Workspaces, Root folders, Trash folders）
    await ensureSystemStructureExists(workspaceId)

    // 更新版本號
    setMigrationVersion(workspaceId, CURRENT_MIGRATION_VERSION)
    log('✅ 資料遷移完成')
  } catch (error) {
    log.error('資料遷移失敗:', error)
    throw error
  }
}

/**
 * 重設 migration 版本（用於測試或強制重新遷移）
 */
export function resetMigrationVersion(workspaceId: WorkspaceId): void {
  const key = getMigrationKey(workspaceId)
  localStorage.removeItem(key)
  log(`🔄 Migration 版本已重設 (${workspaceId})`)
}
