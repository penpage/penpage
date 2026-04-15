/**
 * Edit Mode Hook
 * 用於管理 Folder/Page/Workspace 的編輯模式狀態
 */

import { useState, useCallback } from 'react'

// 可編輯項目類型
export type EditableItemType = 'folder' | 'page' | 'workspace'

// 拖動狀態
export interface DragState {
  isDragging: boolean
  draggedId: string | null
  dragOverId: string | null
  dropPosition: 'before' | 'after' | 'inside' | null
}

// Hook 返回值介面
export interface UseEditModeReturn {
  // 編輯模式狀態
  isEditMode: boolean
  itemType: EditableItemType | null

  // 選擇狀態
  selectedIds: Set<string>
  selectionCount: number
  hasSelection: boolean

  // 拖動狀態
  dragState: DragState

  // 模式控制
  enterEditMode: (type: EditableItemType) => void
  exitEditMode: () => void

  // 選擇操作
  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean

  // 拖動操作
  startDrag: (id: string) => void
  updateDragOver: (targetId: string | null, position: 'before' | 'after' | 'inside' | null) => void
  endDrag: () => void

  // 檢查是否全選
  isAllSelected: (totalIds: string[]) => boolean
}

// 初始拖動狀態
const initialDragState: DragState = {
  isDragging: false,
  draggedId: null,
  dragOverId: null,
  dropPosition: null,
}

/**
 * Edit Mode Hook
 */
export function useEditMode(): UseEditModeReturn {
  // 編輯模式狀態
  const [isEditMode, setIsEditMode] = useState(false)
  const [itemType, setItemType] = useState<EditableItemType | null>(null)

  // 選擇狀態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 拖動狀態
  const [dragState, setDragState] = useState<DragState>(initialDragState)

  // 進入編輯模式
  const enterEditMode = useCallback((type: EditableItemType) => {
    setIsEditMode(true)
    setItemType(type)
    setSelectedIds(new Set())
    setDragState(initialDragState)
  }, [])

  // 退出編輯模式
  const exitEditMode = useCallback(() => {
    setIsEditMode(false)
    setItemType(null)
    setSelectedIds(new Set())
    setDragState(initialDragState)
  }, [])

  // 切換選擇
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 全選
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  // 清除選擇
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // 檢查是否選中
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  // 檢查是否全選
  const isAllSelected = useCallback((totalIds: string[]) => {
    if (totalIds.length === 0) return false
    return totalIds.every(id => selectedIds.has(id))
  }, [selectedIds])

  // 開始拖動
  const startDrag = useCallback((id: string) => {
    setDragState({
      isDragging: true,
      draggedId: id,
      dragOverId: null,
      dropPosition: null,
    })
  }, [])

  // 更新拖動位置
  const updateDragOver = useCallback((targetId: string | null, position: 'before' | 'after' | 'inside' | null) => {
    setDragState(prev => ({
      ...prev,
      dragOverId: targetId,
      dropPosition: position,
    }))
  }, [])

  // 結束拖動
  const endDrag = useCallback(() => {
    setDragState(initialDragState)
  }, [])

  // 計算屬性
  const selectionCount = selectedIds.size
  const hasSelection = selectionCount > 0

  return {
    // 狀態
    isEditMode,
    itemType,
    selectedIds,
    selectionCount,
    hasSelection,
    dragState,

    // 模式控制
    enterEditMode,
    exitEditMode,

    // 選擇操作
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,

    // 拖動操作
    startDrag,
    updateDragOver,
    endDrag,
  }
}

export default useEditMode
