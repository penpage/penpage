/**
 * SortablePageItem - dnd-kit sortable wrapper for page items
 * 用於 Page Edit Mode 的可拖動頁面項目
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '../services/db'
import { IconLock, IconLockFill } from './icons/BootstrapIcons'

interface SortablePageItemProps {
  page: Page
  isSelected: boolean          // 當前選中的 page（編輯器顯示）
  isEditSelected: boolean      // Edit Mode 中被勾選
  onSelect?: () => void        // 點擊選擇 page（保留給未來使用）
  onToggleSelect: () => void   // 切換 checkbox
  formatDate: (timestamp: number) => string
  getPreview: (content: string) => string
  displayName?: string         // 可選的顯示名稱（用於實時更新）
  displayContent?: string      // 可選的顯示內容（用於實時更新）
  isEncryptionUnlocked?: boolean // 加密是否已解鎖
}

export const SortablePageItem = ({
  page,
  isSelected,
  isEditSelected,
  onSelect: _onSelect,
  onToggleSelect,
  formatDate,
  getPreview,
  displayName,
  displayContent,
  isEncryptionUnlocked = false,
}: SortablePageItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 使用傳入的 displayName/displayContent 或 page 原有的值
  const name = displayName ?? page.name
  const content = displayContent ?? page.content

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`page-item sortable-page-item ${isSelected ? 'selected' : ''} ${isEditSelected ? 'edit-selected' : ''} ${isDragging ? 'dragging' : ''}`}
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

      {/* Page 內容 */}
      <div className="page-item-content">
        {/* 第一行：Page Name + 拖動把手 */}
        <div className="page-item-header">
          <div className="page-item-name">
            {page.isEncrypted && (
              <span style={{ marginRight: '6px', color: isEncryptionUnlocked ? '#22c55e' : '#f59e0b', verticalAlign: 'middle' }}>
                {isEncryptionUnlocked ? <IconLock size={14} /> : <IconLockFill size={14} />}
              </span>
            )}
            {name}
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
        {/* 第二區：日期 + 預覽 */}
        <div className="page-item-meta">
          <span className="page-item-date">{formatDate(page.updatedAt)}</span>
          <span className="page-item-preview">{getPreview(content)}</span>
        </div>
      </div>
    </div>
  )
}

export default SortablePageItem
