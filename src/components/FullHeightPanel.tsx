/**
 * FullHeightPanel - 全高面板元件
 * Search / Feedback / Install / Sync 共用
 *
 * Desktop/Landscape：右側滑入 480px
 * Portrait：全高面板，bottom: 64px（不覆蓋 NavBar）
 */

import { useEffect } from 'react'
import { IconArrowBarLeft } from './icons/BootstrapIcons'

interface FullHeightPanelProps {
  isOpen: boolean
  onClose: () => void
  header?: React.ReactNode    // 自訂 Header（Search 用）
  title?: string              // 標準標題（其他面板用）
  noPadding?: boolean         // body 不加 padding（Search 用）
  children: React.ReactNode
}

export function FullHeightPanel({
  isOpen,
  onClose,
  header,
  title,
  noPadding = false,
  children
}: FullHeightPanelProps) {
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
    <>
      {/* Desktop Overlay */}
      {isOpen && (
        <div className="full-height-panel-overlay" onClick={onClose} />
      )}

      {/* Panel */}
      <div className={`full-height-panel ${isOpen ? 'open' : ''}`}>
        {/* Header：自訂或標準 */}
        <div className="full-height-panel-header">
          <button
            className="full-height-panel-back"
            onClick={onClose}
            aria-label="Close"
          >
            <IconArrowBarLeft size={22} /> Back
          </button>
          {header || (title && <div className="full-height-panel-title">{title}</div>)}
          {/* 佔位，保持置中（當有 title 時） */}
          {!header && title && <div style={{ width: '40px' }} />}
        </div>

        {/* Body */}
        <div className={`full-height-panel-body${noPadding ? ' no-padding' : ''}`}>
          {children}
        </div>
      </div>
    </>
  )
}
