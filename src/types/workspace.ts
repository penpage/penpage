/**
 * Workspace 類型定義
 * 集中管理所有 Workspace 相關的類型和配置
 */

// Workspace ID 類型（開源版僅支援 local）
export type WorkspaceId = 'local'

// Workspace 配置介面
export interface WorkspaceConfig {
  id: WorkspaceId
  name: string
  icon: string
  color?: string
  platform: 'local'
  syncEnabled: boolean
  defaultRootFolderName: string
}

// Workspace 配置表
export const WORKSPACE_CONFIGS: Record<WorkspaceId, WorkspaceConfig> = {
  local: {
    id: 'local',
    name: 'Local',
    icon: '💻',
    platform: 'local',
    syncEnabled: false,
    defaultRootFolderName: 'My Local',
  },
}

/**
 * 取得 Workspace 配置
 */
export const getWorkspaceConfig = (id: WorkspaceId): WorkspaceConfig => {
  return WORKSPACE_CONFIGS[id]
}

/**
 * 檢查 Workspace 是否為雲端同步類型
 */
export const isCloudWorkspace = (_id: WorkspaceId): boolean => {
  return false
}
