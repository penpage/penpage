import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// 游標離開 menu 後延遲關閉時間（ms）
const CLOSE_DELAY_MS = 800
// menu 開啟後若游標始終未進入，經過此時間自動關閉（ms）
const IDLE_CLOSE_DELAY_MS = 2000

// 選單項目
export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

// 分隔線
export interface ContextMenuSeparator {
  type: 'separator'
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  items: ContextMenuEntry[]
  onClose: () => void
}

// 判斷是否為分隔線
const isSeparator = (entry: ContextMenuEntry): entry is ContextMenuSeparator => {
  return 'type' in entry && entry.type === 'separator'
}

const ContextMenu = ({ isOpen, position, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)

  // 外部點擊關閉
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      onClose()
    }
  }, [onClose])

  // ESC 關閉
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  // 游標離開 menu → 延遲關閉
  const handleMouseLeave = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, CLOSE_DELAY_MS)
  }, [onClose])

  // 游標返回 menu → 取消關閉
  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    // 使用 setTimeout 避免觸發 contextmenu 的同一事件
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }, 0)

    // 開啟後的 idle timer：若游標始終未進入 menu，也要自動關閉
    // 進入 menu 時 handleMouseEnter 會清掉此 timer；之後由 leave/enter 管理
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, IDLE_CLOSE_DELAY_MS)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [isOpen, handleClickOutside, handleKeyDown, onClose])

  // 邊緣檢測：調整位置避免超出 viewport
  const getAdjustedPosition = () => {
    if (!menuRef.current) return { top: position.y, left: position.x }

    const rect = menuRef.current.getBoundingClientRect()
    const padding = 8
    let { x, y } = position

    // 右側超出
    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding
    }
    // 下方超出
    if (y + rect.height > window.innerHeight - padding) {
      y = window.innerHeight - rect.height - padding
    }
    // 左側超出
    if (x < padding) x = padding
    // 上方超出
    if (y < padding) y = padding

    return { top: y, left: x }
  }

  if (!isOpen) return null

  const adjustedPos = getAdjustedPosition()

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: `${adjustedPos.top}px`,
        left: `${adjustedPos.left}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {items.map((entry, index) => {
        if (isSeparator(entry)) {
          return <div key={`sep-${index}`} className="context-menu-separator" />
        }

        return (
          <button
            key={entry.id}
            className={`context-menu-item ${entry.variant === 'danger' ? 'danger' : ''} ${entry.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (entry.disabled) return
              entry.onClick()
              onClose()
            }}
            disabled={entry.disabled}
          >
            {entry.icon && <span className="context-menu-item-icon">{entry.icon}</span>}
            <span className="context-menu-item-label">{entry.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

export default ContextMenu
