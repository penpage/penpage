/**
 * SortableFolderItem - dnd-kit sortable wrapper for folder items
 * 用於 Folder Edit Mode 的可拖動資料夾項目
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Folder } from '../services/db'
import { IconLink45deg } from './icons/BootstrapIcons'

interface SortableFolderItemProps {
  folder: Folder
  level: number                    // 縮排層級
  isSelected: boolean              // 正常模式選中（不在 Edit Mode 使用，保留給未來）
  isEditSelected: boolean          // Edit Mode 勾選
  pageCount: number                // 頁面數量
  isLinked?: boolean               // 是否連結外部目錄
  tabColor: string                 // 顏色標籤
  canBeSelected: boolean           // 能否被選擇（Trash 不可選）
  canBeDragged: boolean            // 能否拖動（Root/Trash 不可拖）
  isEditing: boolean               // 是否在重命名
  editingName: string              // 重命名中的名稱
  onToggleSelect: () => void       // 切換選擇
  onItemClick: () => void          // 點擊項目
  onEditNameChange: (name: string) => void  // 重命名輸入變更
  onFinishEdit: () => void         // 完成重命名（失焦或 Enter）
  onKeyDown: (e: React.KeyboardEvent) => void  // 鍵盤事件
  folderInputRef: React.RefObject<HTMLInputElement>  // 輸入框 ref
}

export const SortableFolderItem = ({
  folder,
  level,
  isSelected: _isSelected,
  isEditSelected,
  pageCount,
  isLinked,
  tabColor,
  canBeSelected,
  canBeDragged,
  isEditing,
  editingName,
  onToggleSelect,
  onItemClick,
  onEditNameChange,
  onFinishEdit,
  onKeyDown,
  folderInputRef,
}: SortableFolderItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: folder.id,
    disabled: !canBeDragged  // Root/Trash 不可拖
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="folder-wrapper"
    >
      <div
        className={`folder-item edit-mode ${isEditSelected ? 'edit-selected' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{
          paddingLeft: `${level * 12 + 48}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingRight: '8px',
          position: 'relative',
          background: isEditSelected
            ? 'var(--bg-edit-selected)'
            : 'var(--bg-folder)',
          borderBottom: '1px solid var(--border-light)',
        }}
        onClick={onItemClick}
      >
        {/* Edit Mode Checkbox */}
        <div
          className={`edit-mode-checkbox ${isEditSelected ? 'selected' : ''} ${!canBeSelected ? 'disabled' : ''}`}
          style={{
            position: 'absolute',
            left: `${level * 12 + 16}px`,
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (canBeSelected) onToggleSelect()
          }}
        >
          <span className="edit-mode-checkbox-check">✓</span>
        </div>

        {/* Colored Tab - Indented with Level */}
        <div style={{
          position: 'absolute',
          left: `${level * 12 + 44}px`,
          top: '4px',
          bottom: '4px',
          width: '6px',
          backgroundColor: tabColor,
          borderRadius: '3px',
        }} />

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', marginLeft: '6px' }}>
          {isEditing ? (
            <input
              ref={folderInputRef}
              type="text"
              className="folder-name-input"
              value={editingName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onBlur={onFinishEdit}
              onKeyDown={onKeyDown}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{ marginLeft: '8px' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: '8px' }}>
              <span className="folder-name" style={{
                fontWeight: '500',
                color: 'var(--text-primary)'
              }}>
                {folder.name}
              </span>
              {pageCount > 0 && (
                <span style={{
                  marginLeft: '6px',
                  fontSize: 'var(--interface-font-size)',
                  color: 'var(--text-muted)'
                }}>
                  ({pageCount})
                </span>
              )}
              {isLinked && (
                <span style={{ marginLeft: '4px', display: 'inline-flex', color: '#3b82f6' }}
                      title="Linked to local directory">
                  <IconLink45deg size={20} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Drag Handle - 只有可拖動的項目顯示 */}
        {canBeDragged && (
          <div
            className="edit-mode-drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="edit-mode-drag-handle-icon">≡</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default SortableFolderItem
