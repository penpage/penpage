/**
 * 顏色配置
 * 用於 Folder 和 Workspace 的顏色選擇
 */

export interface ColorOption {
  id: string
  hex: string | null  // null 表示使用預設（hash 計算）
  name: string
}

// 預設色彩選項
export const PRESET_COLORS: ColorOption[] = [
  { id: 'default', hex: null, name: 'Default' },
  { id: 'red', hex: '#ef4444', name: 'Red' },
  { id: 'orange', hex: '#f97316', name: 'Orange' },
  { id: 'amber', hex: '#f59e0b', name: 'Amber' },
  { id: 'green', hex: '#22c55e', name: 'Green' },
  { id: 'teal', hex: '#14b8a6', name: 'Teal' },
  { id: 'blue', hex: '#3b82f6', name: 'Blue' },
  { id: 'indigo', hex: '#6366f1', name: 'Indigo' },
  { id: 'purple', hex: '#8b5cf6', name: 'Purple' },
  { id: 'pink', hex: '#ec4899', name: 'Pink' },
  { id: 'gray', hex: '#6b7280', name: 'Gray' },
]

// 用於 hash 計算的預設色彩陣列（與 FolderTree 現有邏輯一致）
export const DEFAULT_TAB_COLORS = [
  '#3b82f6', // 藍
  '#10b981', // 綠
  '#f59e0b', // 橙
  '#ef4444', // 紅
  '#8b5cf6', // 紫
  '#ec4899', // 粉
]

// 垃圾桶資料夾顏色
export const TRASH_FOLDER_COLOR = '#9ca3af'

/**
 * 根據 ID 計算預設顏色（hash 方式）
 * @param id 資料夾或工作區 ID
 * @returns 顏色 hex 值
 */
export function getDefaultColorById(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return DEFAULT_TAB_COLORS[hash % DEFAULT_TAB_COLORS.length]
}

/**
 * 取得顯示顏色
 * 如果有自訂顏色則使用，否則用 hash 計算
 * @param customColor 自訂顏色（可選）
 * @param id 資料夾或工作區 ID
 * @returns 顏色 hex 值
 */
export function getDisplayColor(customColor: string | null | undefined, id: string): string {
  return customColor || getDefaultColorById(id)
}
