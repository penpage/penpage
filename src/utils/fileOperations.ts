/**
 * 文件操作工具函數
 * 負責 Markdown 檔案的匯入、匯出等操作
 */

/**
 * 匯出 Markdown 檔案
 * @param content Markdown 內容
 * @param filename 檔名（可選，預設使用當前日期）
 */
export const exportMarkdownFile = (content: string, filename?: string): void => {
  const defaultFilename = `markdown-${new Date().toISOString().split('T')[0]}.md`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 匯入 Markdown 檔案（支援多選）
 * @param onImport 匯入成功的回呼函數（傳入檔案陣列）
 */
export const selectMarkdownFiles = (
  onImport: (files: Array<{ name: string, content: string, lastModified: number }>) => void
): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.multiple = true  // 支援多選

  input.onchange = async (e) => {
    const fileList = (e.target as HTMLInputElement).files
    if (!fileList || fileList.length === 0) return

    const files: Array<{ name: string, content: string, lastModified: number }> = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const content = await file.text()
      if (content) {
        files.push({ name: file.name, content, lastModified: file.lastModified })
      }
    }

    if (files.length > 0) {
      onImport(files)
    }
  }

  input.click()
}

/**
 * 匯入 Markdown 檔案（單檔）
 * @deprecated 使用 selectMarkdownFiles 取代
 * @param onImport 匯入成功的回呼函數
 */
export const importMarkdownFile = (onImport: (content: string) => void): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        onImport(content)
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// 目錄選擇的檔案資料結構
export interface DirectoryFile {
  name: string
  content: string
  relativePath: string   // 只一層時退化為 fileName
  lastModified: number
}

// 目錄選擇結果（含 dirHandle）
export interface DirectoryPickResult {
  dirHandle: FileSystemDirectoryHandle
  files: DirectoryFile[]
  subDirectories: string[]   // 子目錄名稱（供 UI 提示）
}

/**
 * 選擇目錄並匯入 Markdown 檔案
 * 使用 webkitdirectory 屬性支援目錄選擇
 * @param onImport 匯入成功的回呼函數（傳入檔案陣列）
 */
export const selectDirectory = (
  onImport: (files: DirectoryFile[]) => void
): void => {
  const input = document.createElement('input')
  input.type = 'file'
  input.setAttribute('webkitdirectory', '')
  input.setAttribute('directory', '')

  input.onchange = async (e) => {
    const fileList = (e.target as HTMLInputElement).files
    if (!fileList || fileList.length === 0) return

    const files: DirectoryFile[] = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]

      // 只處理 .md/.markdown 檔案
      if (!file.name.match(/\.(md|markdown)$/i)) continue

      // 跳過隱藏檔案（以 . 開頭）
      if (file.name.startsWith('.')) continue

      const content = await file.text()
      if (content) {
        files.push({
          name: file.name,
          content,
          // webkitRelativePath 包含完整相對路徑（例如 "notes/work/meeting.md"）
          relativePath: (file as any).webkitRelativePath || file.name,
          lastModified: file.lastModified
        })
      }
    }

    if (files.length > 0) {
      onImport(files)
    }
  }

  input.click()
}

/**
 * 使用 File System Access API 選擇目錄
 * 只掃描根層 .md 檔案（不遞迴），並列出子目錄
 */
export const selectDirectoryWithHandles = async (): Promise<DirectoryPickResult> => {
  const dirHandle = await window.showDirectoryPicker()
  const files: DirectoryFile[] = []
  const subDirectories: string[] = []

  for await (const [name, entry] of dirHandle.entries()) {
    // 跳過隱藏檔案/目錄
    if (name.startsWith('.')) continue

    if (entry.kind === 'directory') {
      subDirectories.push(name)
    } else if (entry.kind === 'file' && name.match(/\.(md|markdown)$/i)) {
      const fileHandle = entry as FileSystemFileHandle
      const file = await fileHandle.getFile()
      const content = await file.text()
      if (content) {
        files.push({
          name: file.name,
          content,
          relativePath: file.name,  // 一層 flat，relativePath = fileName
          lastModified: file.lastModified
        })
      }
    }
  }

  subDirectories.sort()
  return { dirHandle, files, subDirectories }
}

/**
 * 從已存的 dirHandle 掃描指定子目錄的根層 .md 檔案
 */
export const scanSubDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  subPath: string
): Promise<DirectoryFile[]> => {
  const files: DirectoryFile[] = []

  // 遍歷到子目錄
  let subDir = dirHandle
  const parts = subPath.split('/').filter(p => p.length > 0)
  for (const part of parts) {
    subDir = await subDir.getDirectoryHandle(part)
  }

  for await (const [name, entry] of subDir.entries()) {
    if (name.startsWith('.')) continue

    if (entry.kind === 'file' && name.match(/\.(md|markdown)$/i)) {
      const fileHandle = entry as FileSystemFileHandle
      const file = await fileHandle.getFile()
      const content = await file.text()
      if (content) {
        files.push({
          name: file.name,
          content,
          relativePath: file.name,
          lastModified: file.lastModified
        })
      }
    }
  }

  return files
}

/**
 * 輕量掃描：只列出目錄內的 .md 檔名（不讀內容）
 * 用於 rescan 時快速比對是否有新檔案
 */
export const listMdFileNames = async (
  dirHandle: FileSystemDirectoryHandle,
  subPath: string
): Promise<string[]> => {
  const names: string[] = []

  let dir = dirHandle
  if (subPath) {
    const parts = subPath.split('/').filter(p => p.length > 0)
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
  }

  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.')) continue
    if (entry.kind === 'file' && name.match(/\.(md|markdown)$/i)) {
      names.push(name)
    }
  }

  return names
}
