/**
 * BottomActionBar 組件
 * 編輯模式的底部操作列
 *
 * 布局：[圖標+文字] [圖標+文字] [圖標+文字]
 */

import React from 'react'

// 單個操作按鈕的定義
export interface ActionButton {
  // 按鈕唯一 ID
  id: string
  // 圖標（emoji 或 React 組件）
  icon: React.ReactNode
  // 按鈕文字
  label: string
  // 點擊處理
  onClick: () => void
  // 是否禁用
  disabled?: boolean
  // 按鈕樣式變體
  variant?: 'default' | 'danger'
}

export interface BottomActionBarProps {
  // 操作按鈕列表
  actions: ActionButton[]
  // 是否正在拖動（拖動時禁用所有按鈕）
  isDragging?: boolean
}

const BottomActionBar: React.FC<BottomActionBarProps> = ({
  actions,
  isDragging = false,
}) => {
  return (
    <div className="bottom-action-bar">
      {actions.map(action => {
        const isDisabled = isDragging || action.disabled
        const variantClass = action.variant === 'danger' ? 'danger' : ''

        return (
          <button
            key={action.id}
            className={`bottom-action-btn ${variantClass}`}
            onClick={action.onClick}
            disabled={isDisabled}
            title={action.label}
          >
            <span className="bottom-action-icon">{action.icon}</span>
            <span className="bottom-action-label">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default BottomActionBar
