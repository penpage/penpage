import { useEffect, useRef, useCallback } from 'react'

/**
 * 檔案啟動參數介面（File Handling API）
 */
interface LaunchParams {
  files?: FileSystemFileHandle[]
}

interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void) => void
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue
  }
}

/**
 * 自訂事件名稱：當系統透過檔案關聯開啟 .md 檔案時觸發
 */
export const FILE_LAUNCH_EVENT = 'ppage:file-launch'

/**
 * 檔案啟動事件的資料結構
 */
export interface FileLaunchDetail {
  filename: string
  content: string
  lastModified?: number
}

/**
 * 暫存尚未處理的檔案（在 React mount 之前收到的檔案）
 * 這是解決時序問題的關鍵：launchQueue 可能在 React 還沒 mount 時就觸發
 */
const pendingFiles: Array<FileLaunchDetail> = []

/**
 * 模組層級立即註冊 launchQueue consumer
 * 這確保在 PWA 啟動時能立即接收檔案，不需等待 React mount
 */
if ('launchQueue' in window && window.launchQueue) {
  window.launchQueue.setConsumer(async (launchParams: LaunchParams) => {
    if (!launchParams.files || launchParams.files.length === 0) {
      return
    }

    // 處理所有傳入的檔案
    for (let i = 0; i < launchParams.files.length; i++) {
      const fileHandle = launchParams.files[i]
      try {
        const file = await fileHandle.getFile()
        const content = await file.text()

        if (content) {
          const fileData: FileLaunchDetail = { filename: file.name, content, lastModified: file.lastModified }
          // 先暫存檔案
          pendingFiles.push(fileData)
          // 同時嘗試發送事件（如果 listener 已註冊就能收到）
          // 延遲處理以避免同時建立多個 page 的競爭
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent<FileLaunchDetail>(FILE_LAUNCH_EVENT, {
                detail: fileData
              })
            )
          }, i * 100)
        }
      } catch (error) {
        console.error('Failed to read file from launchQueue:', error)
      }
    }
  })
}

/**
 * 監聽檔案啟動事件的 Hook
 * 在 MarkdownEditor 中使用，接收從 launchQueue 傳來的檔案
 *
 * 此 Hook 會：
 * 1. 處理在 mount 之前就收到並暫存的檔案
 * 2. 監聽後續的檔案開啟事件
 *
 * @param onFileOpen 檔案開啟時的回呼函數
 */
export function useFileLaunchListener(
  onFileOpen: (filename: string, content: string, lastModified?: number) => void
) {
  // 使用 ref 保存最新的回呼
  const onFileOpenRef = useRef(onFileOpen)
  onFileOpenRef.current = onFileOpen

  // 追蹤已處理的檔案，避免重複處理
  const processedFilesRef = useRef<Set<string>>(new Set())

  const handleFileLaunch = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<FileLaunchDetail>
    const { filename, content, lastModified } = customEvent.detail

    // 使用檔名+內容長度作為簡單的重複檢查 key
    const fileKey = `${filename}:${content.length}`
    if (processedFilesRef.current.has(fileKey)) {
      return // 已處理過，跳過
    }
    processedFilesRef.current.add(fileKey)

    onFileOpenRef.current(filename, content, lastModified)
  }, [])

  useEffect(() => {
    // 處理在 mount 之前就收到的檔案
    while (pendingFiles.length > 0) {
      const file = pendingFiles.shift()!
      const fileKey = `${file.filename}:${file.content.length}`
      if (!processedFilesRef.current.has(fileKey)) {
        processedFilesRef.current.add(fileKey)
        onFileOpenRef.current(file.filename, file.content, file.lastModified)
      }
    }

    // 監聯後續的檔案開啟事件
    window.addEventListener(FILE_LAUNCH_EVENT, handleFileLaunch)
    return () => {
      window.removeEventListener(FILE_LAUNCH_EVENT, handleFileLaunch)
    }
  }, [handleFileLaunch])
}
