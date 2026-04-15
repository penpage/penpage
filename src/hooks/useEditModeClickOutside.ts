import { useEffect, useCallback } from 'react'

// Edit Mode 共用白名單：這些元素內的點擊不退出 edit mode
const SHARED_WHITELIST = [
  '.edit-mode-bottom-bar',
  '.color-picker-popover',
  '.color-picker-overlay',
  '.confirm-dialog-overlay',
  '.confirm-dialog',
  '.folder-picker-overlay',
]

/**
 * Edit Mode 的 click outside 退出邏輯（共用 hook）
 * 使用 capture phase，不受子元素 stopPropagation 影響
 */
export function useEditModeClickOutside(
  isEditMode: boolean,
  exitEditMode: () => void,
  containerSelector: string
) {
  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    const allWhitelist = [containerSelector, ...SHARED_WHITELIST]
    if (!allWhitelist.some(sel => target.closest(sel))) {
      exitEditMode()
    }
  }, [containerSelector, exitEditMode])

  useEffect(() => {
    if (!isEditMode) return

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isEditMode, handleClick])
}
