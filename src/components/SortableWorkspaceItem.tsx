/**
 * SortableWorkspaceItem - dnd-kit sortable wrapper for workspace items
 * 用於 Workspace Edit Mode 的可拖動項目
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WorkspaceIcon } from './WorkspaceIcon'
import { WorkspaceId } from '../types/workspace'

interface WorkspaceInfo {
  id: WorkspaceId
  name: string
  subtitle: string | null
}

interface SortableWorkspaceItemProps {
  workspace: WorkspaceInfo
  isSelected: boolean           // 當前選中的 workspace（非 Edit Mode）
  isEditSelected: boolean       // Edit Mode 中被勾選
  displayColor: string          // 顏色（從 workspaceColors 或 hash 計算）
  customColor?: string          // 傳給 WorkspaceIcon 的自訂顏色
  onToggleSelect: () => void    // 切換 checkbox
  onSelect: () => void          // 點擊選擇 workspace（非 Edit Mode）
}

export const SortableWorkspaceItem = ({
  workspace,
  isSelected,
  isEditSelected,
  displayColor,
  customColor,
  onToggleSelect,
  onSelect: _onSelect,
}: SortableWorkspaceItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workspace.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`workspace-list-item sortable-workspace-item ${isSelected ? 'selected' : ''} ${isEditSelected ? 'edit-selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onToggleSelect}
    >
      {/* Edit Mode: Checkbox */}
      <div
        className={`edit-mode-checkbox ${isEditSelected ? 'selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleSelect()
        }}
      >
        <span className="edit-mode-checkbox-check">✓</span>
      </div>

      {/* Color Tab */}
      <div
        className="workspace-color-tab"
        style={{ backgroundColor: displayColor }}
      />

      {/* Workspace 內容 */}
      <div className="workspace-list-item-avatar">
        <WorkspaceIcon
          workspaceId={workspace.id}
          customColor={customColor}
        />
      </div>
      <div className="workspace-list-item-info">
        <span className="workspace-list-item-name">{workspace.name}</span>
        {workspace.subtitle && (
          <span className="workspace-list-item-subtitle">{workspace.subtitle}</span>
        )}
      </div>

      {/* Edit Mode: 拖動把手 */}
      <div
        className="edit-mode-drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="edit-mode-drag-handle-icon">≡</span>
      </div>
    </div>
  )
}

export default SortableWorkspaceItem
