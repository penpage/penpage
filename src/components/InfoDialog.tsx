import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons/BootstrapIcons'

// 唯讀 metadata dialog 的單一 row 定義
export interface InfoRow {
  label: string
  value: React.ReactNode
}

interface InfoDialogProps {
  isOpen: boolean
  title: string
  icon?: React.ReactNode
  rows: InfoRow[]
  onClose: () => void
}

const InfoDialog = ({ isOpen, title, icon, rows, onClose }: InfoDialogProps) => {
  // ESC 關閉
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="info-dialog-overlay" onClick={onClose}>
      <div className="info-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="info-dialog-header">
          {icon && <div className="info-dialog-icon">{icon}</div>}
          <div className="info-dialog-title" title={title}>{title}</div>
          <button
            className="info-dialog-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="info-dialog-content">
          {rows.map((row, i) => (
            <div key={i} className="info-dialog-row">
              <div className="info-dialog-label">{row.label}</div>
              <div className="info-dialog-value">{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default InfoDialog
