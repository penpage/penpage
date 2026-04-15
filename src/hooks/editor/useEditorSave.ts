import { useState, useRef } from 'react'
import { Page, db } from '../../services/db'
import { generatePageId } from '../../utils/idGenerator'
import { extractPageTitle } from '../../utils/markdownConverter'
import { isFileHandleSupported } from '../../services/fileHandleStore'
import { syncFile } from '../../utils/fileLink'
import { WorkspaceId } from '../../types/workspace'

// Module-level：追蹤待執行的 debounced save，供外部 flush
let pendingSaveCallback: (() => Promise<void>) | null = null

export async function flushPendingSave(): Promise<void> {
  if (pendingSaveCallback) {
    const cb = pendingSaveCallback
    pendingSaveCallback = null
    await cb()
  }
}

// 本地儲存狀態
export type SyncStatus = 'saved' | 'saving' | 'unsaved'

/**
 * 顯示狀態（簡化為兩態）
 * - unsaved: 未儲存本地（紅色）
 * - synced: 已儲存（白色）
 */
export type DisplayStatus = 'unsaved' | 'synced'

interface EditorState {
  wysiwygCursorPosition?: number
  markdownCursorPosition?: number
  scrollPosition?: number
  isMarkdownMode?: boolean
}

export const useEditorSave = (workspaceId: WorkspaceId = 'local') => {
  const [currentPage, setCurrentPage] = useState<Page | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved')
  const autoSaveTimer = useRef<number | null>(null)
  const fileSyncTimer = useRef<number | null>(null)

  const savePage = async (
    content: string,
    options: {
      folderId: string | null,
      editorState?: EditorState
    }
  ): Promise<void> => {
    setSyncStatus('saving')

    try {
      const newTitle = extractPageTitle(content)

      // 新建頁面
      if (!currentPage) {
        if (!options.folderId) {
          setSyncStatus('saved')
          return
        }

        const newPage: Page = {
          id: generatePageId(),
          folderId: options.folderId,
          name: newTitle,
          content: content,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          editorState: options.editorState
        }

        await db(workspaceId).createPage(newPage)
        setCurrentPage(newPage)
        setSyncStatus('saved')
        return
      }

      // 更新既有頁面
      const updatedPage: Page = {
        ...currentPage,
        name: newTitle,
        content: content,
        contentHash: undefined, // 清空，讓 db.updatePage 重新計算
        updatedAt: Date.now(),
        editorState: options.editorState ? {
          ...currentPage.editorState,
          ...options.editorState
        } : currentPage.editorState
      }

      await db(workspaceId).updatePage(updatedPage)
      setCurrentPage(updatedPage)
      setSyncStatus('saved')

      // 本地檔案同步（5 秒 debounce auto push）
      if (isFileHandleSupported() && updatedPage.id) {
        if (fileSyncTimer.current) clearTimeout(fileSyncTimer.current)
        fileSyncTimer.current = window.setTimeout(() => {
          syncFile(updatedPage.id, workspaceId, { silent: true }).catch(() => {})
        }, 5000)
      }
    } catch (error) {
      console.error('Save failed:', error)
      setSyncStatus('unsaved')
    }
  }

  const scheduleAutoSave = (
    content: string,
    options: { folderId: string | null, editorState?: EditorState },
    delay: number = 500
  ) => {
    setSyncStatus('unsaved')

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
    }

    pendingSaveCallback = () => savePage(content, options)

    autoSaveTimer.current = window.setTimeout(() => {
      pendingSaveCallback = null
      savePage(content, options)
    }, delay)
  }

  const clearAutoSave = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }
  }

  const getDisplayStatus = (): DisplayStatus => {
    if (syncStatus === 'unsaved' || syncStatus === 'saving') {
      return 'unsaved'
    }
    return 'synced'
  }

  return {
    currentPage,
    setCurrentPage,
    syncStatus,
    setSyncStatus,
    displayStatus: getDisplayStatus(),
    savePage,
    scheduleAutoSave,
    clearAutoSave
  }
}
