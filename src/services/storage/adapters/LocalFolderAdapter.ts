/**
 * Local Folder (JSON) Storage Adapter
 * 將單個 folder 匯出為 JSON 文件
 */

import { FolderStorageAdapter, FolderExportData } from '../types'

export class LocalFolderAdapter implements FolderStorageAdapter {
  name = 'Local JSON File'

  /**
   * 保存單個 folder 到 JSON 文件
   */
  async saveFolder(data: FolderExportData): Promise<void> {
    try {
      if (data.folders.length === 0) {
        throw new Error('No folders to export')
      }

      // 獲取根 folder 名稱
      const rootFolder = data.folders[0]
      const folderName = rootFolder.name

      // 生成文件名
      const date = new Date().toISOString().split('T')[0]
      const filename = `${folderName}_${date}.json`

      // 創建 JSON 數據
      const exportData = {
        version: '1.0',
        exportDate: Date.now(),
        folderName: folderName,
        rootFolderId: rootFolder.id,
        folders: data.folders,
        pages: data.pages,
      }

      // 創建 Blob 並下載
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      console.log(`✅ Folder exported: ${filename}`)
    } catch (error) {
      console.error('LocalFolderAdapter saveFolder failed:', error)
      throw new Error(`Failed to save folder: ${(error as Error).message}`)
    }
  }

  /**
   * 從 JSON 文件載入單個 folder
   */
  async loadFolder(): Promise<FolderExportData> {
    return new Promise((resolve, reject) => {
      // 創建文件選擇器
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) {
            reject(new Error('No file selected'))
            return
          }

          // 讀取文件內容
          const text = await file.text()
          const data = JSON.parse(text)

          // 驗證格式
          if (!data.version || !data.folders || !data.pages) {
            reject(new Error('Invalid folder export file format'))
            return
          }

          if (data.version !== '1.0') {
            reject(new Error(`Unsupported version: ${data.version}`))
            return
          }

          resolve({
            folders: data.folders,
            pages: data.pages,
          })
        } catch (error) {
          console.error('LocalFolderAdapter loadFolder failed:', error)
          reject(new Error(`Failed to load folder: ${(error as Error).message}`))
        }
      }

      input.click()
    })
  }

  /**
   * 檢查是否可用（JSON 功能在瀏覽器中總是可用）
   */
  async isAvailable(): Promise<boolean> {
    return true
  }
}
