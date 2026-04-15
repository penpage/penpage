/**
 * WorkspaceIcon - 統一的 Workspace 圖示元件
 * 開源版：僅顯示 Local workspace icon
 */

import { WorkspaceId, getWorkspaceConfig } from '../types/workspace'

interface WorkspaceIconProps {
  workspaceId: WorkspaceId
  size?: number
  className?: string
  interactive?: boolean
  customColor?: string
}

export function WorkspaceIcon({ workspaceId, size = 40, className, customColor }: WorkspaceIconProps) {
  const config = getWorkspaceConfig(workspaceId)

  // 決定背景色（customColor 優先 → config.color → CSS 預設）
  const bgStyle = customColor
    ? { backgroundColor: customColor }
    : config.color
      ? { backgroundColor: config.color }
      : undefined

  return (
    <div
      className={`workspace-icon ${className || ''}`}
      style={{ width: size, height: size, ...bgStyle }}
      title={config.name}
    >
      <LocalMonitorIcon size={size * 0.6} />
    </div>
  )
}

/**
 * Local Monitor + Save SVG（螢幕 + 下載箭頭，語意：資料存在這台裝置上）
 */
function LocalMonitorIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <line x1="12" y1="6" x2="12" y2="13"/>
      <polyline points="9,11 12,14 15,11"/>
    </svg>
  )
}
