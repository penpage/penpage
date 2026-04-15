/**
 * ID 生成工具
 * 統一全專案的 ID 生成規則
 */

/**
 * 生成標準 Page ID
 * 格式: page-{timestamp}-{random}
 * 例如: page-1678901234567-a1b2c3d4e
 */
export function generatePageId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `page-${timestamp}-${random}`
}

/**
 * 生成標準 Folder ID
 * 格式: folder-{timestamp}-{random}
 */
export function generateFolderId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `folder-${timestamp}-${random}`
}

/**
 * 檢查 ID 是否為有效的 Page ID 格式
 * 兼容舊格式: page-{timestamp}
 */
export function isValidPageId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  return /^page-\d+(-[a-z0-9]+)?$/.test(id)
}
