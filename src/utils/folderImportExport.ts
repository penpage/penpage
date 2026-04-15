/**
 * Folder 匯出/匯入工具（重構版）
 * 使用統一的 DataService 和 LocalFolderAdapter
 */

import { dataService } from '../services/storage/dataService'
import { LocalFolderAdapter } from '../services/storage/adapters/LocalFolderAdapter'

/**
 * 匯出指定 folder 及其所有子 folders 和 pages 到 JSON 文件
 */
export async function exportFolder(folderId: string): Promise<void> {
  try {
    // 使用 DataService 獲取 folder 數據（包含所有子 folders 和 pages）
    const data = await dataService.exportFolder(folderId)

    // 使用 LocalFolderAdapter 保存到 JSON 文件
    const adapter = new LocalFolderAdapter()
    await adapter.saveFolder(data)
  } catch (error) {
    console.error('Export folder failed:', error)
    throw error
  }
}

/**
 * 選擇 JSON 文件並匯入到指定的 parent folder
 */
export const selectAndImportFolder = (
  parentFolderId: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): void => {
  const adapter = new LocalFolderAdapter()

  // LocalFolderAdapter.loadFolder() 會處理文件選擇和讀取
  adapter
    .loadFolder()
    .then((data) => {
      // 使用 DataService 匯入 folder 數據
      return dataService.importFolder(data, parentFolderId)
    })
    .then(() => {
      if (onSuccess) onSuccess()
    })
    .catch((error) => {
      console.error('Import folder failed:', error)
      if (onError) onError(error as Error)
    })
}
