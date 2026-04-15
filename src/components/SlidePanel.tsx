/**
 * SlidePanel - 滑入面板元件（僅 Settings 專用）
 * Desktop/Landscape：從右側滑入
 * Portrait：底部滑入 bottom-sheet 風格（70vh、圓角、拖動把手）
 */

import { useEffect } from 'react'
import { IconArrowBarLeft } from './icons/BootstrapIcons'

interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  width?: number
  children: React.ReactNode
}

export function SlidePanel({
  isOpen,
  onClose,
  title,
  width = 480,
  children,
}: SlidePanelProps) {
  // ESC 鍵關閉
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <div
      className={`slide-panel-overlay ${isOpen ? 'open' : ''}`}
      onClick={onClose}
    >
      <div
        className="slide-panel"
        style={{ '--slide-panel-width': `${width}px` } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="slide-panel-header">
          <button className="slide-panel-back" onClick={onClose} aria-label="Close">
            <IconArrowBarLeft size={20} />
          </button>
          {title && <div className="slide-panel-title">{title}</div>}
          <div style={{ width: '40px' }} />
        </div>
        {/* Body */}
        <div className="slide-panel-body">
          {children}
        </div>
      </div>
    </div>
  )
}
