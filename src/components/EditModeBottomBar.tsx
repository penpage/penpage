/**
 * EditModeBottomBar 組件
 * 編輯模式的底部控制列（均分佈局，可自動折行）
 *
 * 布局：[←完成] [○全選] [actions...] 均勻分佈
 */

import React from 'react'
import { ActionButton } from './BottomActionBar'
import { IconArrowBarLeft, IconCheck2Circle } from './icons/BootstrapIcons'

export interface EditModeBottomBarProps {
  // 是否已全選
  isAllSelected: boolean
  // 點擊完成
  onDone: () => void
  // 點擊全選/取消全選
  onToggleSelectAll: () => void
  // 右側操作按鈕列表
  actions: ActionButton[]
  // 是否正在拖動（拖動時禁用操作按鈕）
  isDragging?: boolean
}

const EditModeBottomBar: React.FC<EditModeBottomBarProps> = ({
  isAllSelected,
  onDone,
  onToggleSelectAll,
  actions,
  isDragging = false,
}) => {
  // 點擊空白區域或 disabled 按鈕時退出 Edit Mode
  // （disabled 按鈕設有 pointer-events: none，點擊會穿透到容器）
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 只有直接點擊容器時才退出（enabled 按鈕的點擊不會到這裡）
    if (e.target === e.currentTarget) {
      onDone()
    }
  }

  return (
    <div className="edit-mode-bottom-bar" onClick={handleContainerClick}>
      {/* 完成按鈕 */}
      <button
        className="edit-mode-action-btn"
        onClick={onDone}
        title="Done"
      >
        <IconArrowBarLeft size={20} />
      </button>

      {/* 全選按鈕 */}
      <button
        className="edit-mode-action-btn"
        onClick={onToggleSelectAll}
        title={isAllSelected ? 'Deselect All' : 'Select All'}
      >
        <IconCheck2Circle size={20} />
      </button>

      {/* 其他操作按鈕 */}
      {actions.map(action => {
        const isDisabled = isDragging || action.disabled
        const variantClass = action.variant === 'danger' ? 'danger' : ''

        return (
          <button
            key={action.id}
            className={`edit-mode-action-btn ${variantClass}`}
            onClick={action.onClick}
            disabled={isDisabled}
            title={action.label}
          >
            <span className="edit-mode-action-icon">{action.icon}</span>
          </button>
        )
      })}
    </div>
  )
}

export default EditModeBottomBar
