/**
 * EditModeHeader 組件
 * 編輯模式的頂部標題列
 *
 * 布局：[完成] ─── 標題 (已選/總數) ─── [全選]
 */

import React from 'react'

export interface EditModeHeaderProps {
  // 標題文字（如「編輯資料夾」）
  title: string
  // 已選擇數量
  selectionCount: number
  // 總數量
  totalCount: number
  // 是否已全選
  isAllSelected: boolean
  // 點擊完成
  onDone: () => void
  // 點擊全選/取消全選
  onToggleSelectAll: () => void
}

const EditModeHeader: React.FC<EditModeHeaderProps> = ({
  title,
  selectionCount,
  totalCount,
  isAllSelected,
  onDone,
  onToggleSelectAll,
}) => {
  return (
    <div className="edit-mode-header">
      {/* 左側：完成按鈕 */}
      <div className="edit-mode-header-left">
        <button
          className="edit-mode-btn-done"
          onClick={onDone}
        >
          Done
        </button>
      </div>

      {/* 中央：標題和計數 */}
      <div className="edit-mode-header-center">
        <span className="edit-mode-title">
          {title}
          <span className="edit-mode-count">
            {' '}({selectionCount}/{totalCount})
          </span>
        </span>
      </div>

      {/* 右側：全選/取消全選 */}
      <div className="edit-mode-header-right">
        <button
          className="edit-mode-btn-select-all"
          onClick={onToggleSelectAll}
        >
          {isAllSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  )
}

export default EditModeHeader
