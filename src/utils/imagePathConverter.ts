/**
 * 圖片路徑轉換工具
 * 用於 V3.1 備份格式的圖片路徑雙向轉換
 *
 * 轉換規則：
 * - 匯出時：image://img-xxx → ../images/img-xxx.png（外部編輯器可顯示）
 * - 匯入時：../images/img-xxx.png → image://img-xxx（PenPage 標準格式）
 */

export interface ImageMetadata {
  id: string
  filename: string
  mimeType: string
  size: number
  createdAt: number
}

export function getImageExtension(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return mimeToExt[mimeType] || 'bin'
}

/**
 * 標準化圖片路徑（相對路徑 → image://）
 * 用於 Open MD 計算 hash 之前，確保 hash 一致性
 *
 * 匹配格式：
 * - ../images/img-xxx.png
 * - ../../images/img-xxx.jpg
 * - images/img-xxx.webp
 */
export function normalizeImagePaths(content: string): string {
  // 匹配 Markdown 圖片語法中的相對路徑
  // 格式：![alt](../images/img-xxx.ext) 或 ![alt](images/img-xxx.ext)
  const relativePattern = /!\[([^\]]*)\]\(((?:\.\.\/)*images\/(img-[a-zA-Z0-9-]+))\.[a-z]+\)/g

  return content.replace(relativePattern, (_match, alt, _fullPath, imgId) => {
    return `![${alt}](image://${imgId})`
  })
}

/**
 * 轉換圖片路徑為相對路徑（image:// → ../images/）
 * 用於 V3.1 匯出，讓外部編輯器可顯示圖片
 *
 * @param content - Markdown 內容
 * @param depth - 資料夾深度，決定 ../ 數量（0 = 根目錄，1 = 一層子目錄）
 * @param imageMetadataMap - 圖片 ID 到 metadata 的映射，用於取得正確副檔名
 */
export function convertToRelativePaths(
  content: string,
  depth: number,
  imageMetadataMap: Map<string, ImageMetadata>
): string {
  // depth=0（根目錄頁面）：與 images/ 同級，直接引用 images/
  // depth=1+（子目錄頁面）：需要 ../ 回到根目錄
  const prefix = depth === 0 ? 'images/' : '../'.repeat(depth) + 'images/'

  // 匹配 image://img-xxx 格式
  const imagePattern = /!\[([^\]]*)\]\(image:\/\/(img-[a-zA-Z0-9-]+)\)/g

  return content.replace(imagePattern, (_match, alt, imgId) => {
    // 從 metadata 取得正確的副檔名
    const meta = imageMetadataMap.get(imgId)
    const ext = meta ? getImageExtension(meta.mimeType) : 'png'

    return `![${alt}](${prefix}${imgId}.${ext})`
  })
}

/**
 * 計算資料夾深度
 * 用於決定相對路徑中 ../ 的數量
 *
 * @param folderPath - 資料夾路徑，如 "Work/Projects/2024"
 * @returns 深度數字（0 = 根目錄）
 */
export function calculateFolderDepth(folderPath: string): number {
  if (!folderPath) return 0
  return folderPath.split('/').length
}
