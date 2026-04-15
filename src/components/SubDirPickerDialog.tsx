/**
 * 子目錄選擇對話框
 * 匯入目錄後，讓使用者勾選要連結的子目錄
 */

import React, { useState, useEffect } from 'react'

export interface SubDirPickerDialogProps {
  isOpen: boolean
  subDirectories: string[]
  onConfirm: (selected: string[]) => void
  onCancel: () => void
}

const SubDirPickerDialog: React.FC<SubDirPickerDialogProps> = ({
  isOpen,
  subDirectories,
  onConfirm,
  onCancel,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 開啟時重置選擇
  useEffect(() => {
    if (isOpen) {
      setSelected(new Set())
    }
  }, [isOpen])

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

  if (!isOpen || subDirectories.length === 0) return null

  const allSelected = selected.size === subDirectories.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(subDirectories))
    }
  }

  const toggleOne = (dir: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(dir)) {
        next.delete(dir)
      } else {
        next.add(dir)
      }
      return next
    })
  }

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog subdir-picker"
        onClick={e => e.stopPropagation()}
      >
        <div className="confirm-dialog-content" style={{ textAlign: 'left' }}>
          <div className="confirm-dialog-title" style={{ textAlign: 'center' }}>
            連結子目錄
          </div>
          <div className="confirm-dialog-message" style={{ textAlign: 'center', marginBottom: '14px' }}>
            選擇要連結的子目錄
          </div>

          {/* 全選 */}
          <label className="subdir-picker-item subdir-picker-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
            />
            <span className="subdir-picker-label">全選</span>
          </label>

          {/* 子目錄清單 */}
          <div className="subdir-picker-list">
            {subDirectories.map(dir => (
              <label key={dir} className="subdir-picker-item">
                <input
                  type="checkbox"
                  checked={selected.has(dir)}
                  onChange={() => toggleOne(dir)}
                />
                <span className="subdir-picker-label">{dir}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn cancel"
            onClick={onCancel}
          >
            略過
          </button>
          <button
            className="confirm-dialog-btn info"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
          >
            連結 ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubDirPickerDialog
