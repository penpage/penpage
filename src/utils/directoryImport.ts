/**
 * 目錄拖放匯入模組
 * 支援遞迴讀取目錄結構，建立對應的 Folder 層級
 */

// 目錄結構樹節點
export interface DirectoryNode {
  name: string
  path: string                  // 相對路徑
  type: 'directory' | 'file'
  children?: DirectoryNode[]    // 僅 directory
  file?: File                   // 僅 file
}

/**
 * 檢查是否為隱藏項目（以 . 開頭）
 */
export function isHiddenEntry(name: string): boolean {
  return name.startsWith('.')
}

/**
 * 檢查 DataTransferItemList 是否包含目錄
 * 使用 webkitGetAsEntry() API（Chrome/Edge 支援）
 */
export function hasDirectoryEntry(items: DataTransferItemList): boolean {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file') {
      // 嘗試取得 entry
      const entry = item.webkitGetAsEntry?.()
      if (entry?.isDirectory) {
        return true
      }
    }
  }
  return false
}

/**
 * 讀取 FileSystemDirectoryEntry 的所有子項目
 * 因為 readEntries() 每次最多返回 100 項，需要迴圈讀取
 */
async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []

  const readBatch = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
  }

  // 持續讀取直到沒有更多項目
  let batch = await readBatch()
  while (batch.length > 0) {
    entries.push(...batch)
    batch = await readBatch()
  }

  return entries
}

/**
 * 遞迴讀取 FileSystemEntry 並轉換為 DirectoryNode
 */
async function readEntryRecursive(
  entry: FileSystemEntry,
  path: string = ''
): Promise<DirectoryNode | null> {
  // 跳過隱藏項目
  if (isHiddenEntry(entry.name)) {
    return null
  }

  const currentPath = path ? `${path}/${entry.name}` : entry.name

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const entries = await readAllDirectoryEntries(reader)

    // 遞迴讀取子項目
    const children: DirectoryNode[] = []
    for (const childEntry of entries) {
      const childNode = await readEntryRecursive(childEntry, currentPath)
      if (childNode) {
        children.push(childNode)
      }
    }

    return {
      name: entry.name,
      path: currentPath,
      type: 'directory',
      children
    }
  } else if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry

    // 取得 File 物件
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject)
    })

    return {
      name: entry.name,
      path: currentPath,
      type: 'file',
      file
    }
  }

  return null
}

/**
 * 從 DataTransferItemList 讀取目錄結構
 * @returns DirectoryNode[] 或 null（如果瀏覽器不支援）
 */
export async function readDirectoryEntries(
  items: DataTransferItemList
): Promise<DirectoryNode[] | null> {
  const nodes: DirectoryNode[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind !== 'file') continue

    const entry = item.webkitGetAsEntry?.()
    if (!entry) {
      // 瀏覽器不支援 webkitGetAsEntry，返回 null 降級處理
      return null
    }

    const node = await readEntryRecursive(entry)
    if (node) {
      nodes.push(node)
    }
  }

  return nodes
}

/**
 * 計算目錄樹中的 .md 檔案數量
 */
export function countMarkdownFiles(nodes: DirectoryNode[]): number {
  let count = 0

  for (const node of nodes) {
    if (node.type === 'file' && node.name.match(/\.(md|markdown)$/i)) {
      count++
    } else if (node.type === 'directory' && node.children) {
      count += countMarkdownFiles(node.children)
    }
  }

  return count
}

/**
 * 檢查目錄節點是否「有效」（包含 .md 檔案或有效子目錄）
 * 用於決定是否建立 Folder
 */
export function isValidDirectoryNode(node: DirectoryNode): boolean {
  if (node.type !== 'directory') return false
  if (!node.children || node.children.length === 0) return false

  for (const child of node.children) {
    // 直接包含 .md 檔案
    if (child.type === 'file' && child.name.match(/\.(md|markdown)$/i)) {
      return true
    }
    // 遞迴檢查子目錄
    if (child.type === 'directory' && isValidDirectoryNode(child)) {
      return true
    }
  }

  return false
}
