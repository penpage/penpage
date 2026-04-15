/**
 * ConfirmDialog 組件
 * 確認對話框
 */

import React, { useEffect } from 'react'

export interface ConfirmDialogProps {
  // 是否顯示
  isOpen: boolean
  // 標題
  title: string
  // 訊息內容
  message: string
  // 確認按鈕文字
  confirmText?: string
  // 取消按鈕文字
  cancelText?: string
  // 對話框樣式變體
  variant?: 'danger' | 'warning' | 'info'
  // 圖標（可選）
  icon?: React.ReactNode
  // 確認回調
  onConfirm: () => void
  // 取消回調
  onCancel: () => void
  // 第三按鈕（可選）
  tertiaryText?: string
  onTertiary?: () => void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  icon,
  onConfirm,
  onCancel,
  tertiaryText,
  onTertiary,
}) => {
  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  // 根據 variant 選擇預設圖標
  const getDefaultIcon = () => {
    switch (variant) {
      case 'danger':
        return '⚠️'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  const displayIcon = icon ?? getDefaultIcon()

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        onClick={e => e.stopPropagation()}
      >
        <div className="confirm-dialog-content">
          {displayIcon && (
            <div className={`confirm-dialog-icon ${variant}`}>
              {displayIcon}
            </div>
          )}
          <div className="confirm-dialog-title">{title}</div>
          <div className="confirm-dialog-message">{message}</div>
        </div>

        <div className="confirm-dialog-actions"
          style={tertiaryText ? { flexDirection: 'column' } : undefined}
        >
          {tertiaryText && onTertiary && (
            <button
              className={`confirm-dialog-btn ${variant}`}
              onClick={onTertiary}
            >
              {tertiaryText}
            </button>
          )}
          <div style={tertiaryText ? { display: 'flex', width: '100%' } : { display: 'contents' }}>
            <button
              className="confirm-dialog-btn cancel"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              className={`confirm-dialog-btn ${variant}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
