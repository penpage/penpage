/**
 * ColorPicker 組件
 * 顏色選擇器 Popover
 */

import React, { useEffect, useRef } from 'react'
import { PRESET_COLORS, ColorOption } from '../config/colors'

export interface ColorPickerProps {
  // 是否顯示
  isOpen: boolean
  // 當前選中的顏色（null 表示預設）
  currentColor: string | null
  // 錨點元素的位置（用於定位 popover）
  anchorRect: DOMRect | null
  // 選擇顏色回調
  onSelect: (color: string | null) => void
  // 關閉回調
  onClose: () => void
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  isOpen,
  currentColor,
  anchorRect,
  onSelect,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  // 點擊外部關閉
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // 延遲綁定，避免立即觸發
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // 計算 popover 位置
  const getPopoverStyle = (): React.CSSProperties => {
    if (!anchorRect) {
      // 如果沒有錨點，居中顯示
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1100,
      }
    }

    // 計算最佳位置（優先在錨點右側，空間不足則在左側）
    const popoverWidth = 220
    const popoverHeight = 180
    const margin = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = anchorRect.right + margin
    let top = anchorRect.top

    // 右側空間不足，改到左側
    if (left + popoverWidth > viewportWidth) {
      left = anchorRect.left - popoverWidth - margin
    }

    // 左側也不夠，居中
    if (left < 0) {
      left = (viewportWidth - popoverWidth) / 2
    }

    // 底部空間不足，往上調整
    if (top + popoverHeight > viewportHeight) {
      top = viewportHeight - popoverHeight - margin
    }

    // 頂部空間不足
    if (top < 0) {
      top = margin
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 1100,
    }
  }

  const handleColorClick = (color: ColorOption) => {
    onSelect(color.hex)
  }

  const isColorSelected = (color: ColorOption) => {
    if (color.hex === null) {
      return currentColor === null
    }
    return currentColor === color.hex
  }

  return (
    <>
      {/* 背景遮罩（半透明） */}
      <div className="color-picker-overlay" onClick={onClose} />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="color-picker-popover"
        style={getPopoverStyle()}
      >
        <div className="color-picker-title">Choose Color</div>
        <div className="color-picker-grid">
          {PRESET_COLORS.map(color => (
            <button
              key={color.id}
              className={`color-picker-item ${isColorSelected(color) ? 'selected' : ''} ${color.hex === null ? 'default' : ''}`}
              style={color.hex ? { backgroundColor: color.hex } : undefined}
              onClick={() => handleColorClick(color)}
              title={color.name}
            >
              {isColorSelected(color) && (
                <span className="color-picker-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default ColorPicker
