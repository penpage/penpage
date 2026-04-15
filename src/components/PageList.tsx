import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Page, db } from '../services/db'
import { settingsService } from '../services/settings'
import {
  movePageToRecycle,
  permanentlyDeletePage,
} from '../services/recycleBin'
import { isTrashFolderId, ROOT_FOLDER_ID } from '../services/rootFolders'
import { FolderPickerDialog, ROOT_LEVEL_TARGET } from './FolderPickerDialog'
import { useToast } from '../hooks/useToast'
import ToastContainer from './ToastContainer'
import { WorkspaceId } from '../types/workspace'
import { useEditMode } from '../hooks/useEditMode'
import { useEditModeClickOutside } from '../hooks/useEditModeClickOutside'
import { useSwipe } from '../hooks/useSwipe'
import EditModeBottomBar from './EditModeBottomBar'
import ConfirmDialog from './ConfirmDialog'
import { SortablePageItem } from './SortablePageItem'
import { IconFolderSymlink, IconTrash, IconPlusCircleFill, IconFileEarmarkCheck, IconDownload, IconUpload, IconArrowRepeat, IconInfoCircle } from './icons/BootstrapIcons'
import InfoDialog, { InfoRow } from './InfoDialog'
import { ActionButton } from './BottomActionBar'
import { useOrientation } from '../contexts/OrientationContext'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import { Folder } from '../services/db'

import { isFileHandleSupported, getAllLinkedEntries, togglePageAutoSync, getPageLink, getFolderDirLink, getDirHandle } from '../services/fileHandleStore'
import { pullFromFile, pushToFile, FileLinkResult, SyncResult } from '../utils/fileLink'

// dnd-kit
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'

interface PageListProps {
  folderId: string | null
  onSelectPage: (page: Page) => void
  onSelectFolder?: (folderId: string) => void
  lastSelectedPageId: string | null
  selectedPage: Page | null
  refreshKey?: number
  onPagesChanged?: () => void  // 頁面刪除/移動後的 callback
  workspaceId?: WorkspaceId  // 來自 Sidebar 的可靠 workspace 來源
  onCreatePage?: () => void  // Desktop 右鍵「New Page」callback
}

// Ref 介面，讓外部可以控制 Edit Mode
export interface PageListRef {
  enterEditMode: () => void
  exitEditMode: () => void
  isInEditMode: () => boolean
}

const PageList = forwardRef<PageListRef, PageListProps>(({
  folderId,
  onSelectPage,
  onSelectFolder: _onSelectFolder,
  lastSelectedPageId,
  selectedPage,
  refreshKey,
  onPagesChanged,
  workspaceId: workspaceIdProp,
  onCreatePage
}, ref) => {
  // 取得穩定的 workspaceId（優先使用 prop，fallback 讀 settings）
  const wsId = workspaceIdProp || settingsService.getSelectedWorkspace()

  const [pages, setPages] = useState<Page[]>([])

  // 裝置模式
  const { isPortraitMode } = useOrientation()

  // Move Dialog State（單一頁面移動）
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [moveTargetPageId, setMoveTargetPageId] = useState<string | null>(null)
  const [moveSourceWorkspace, setMoveSourceWorkspace] = useState<WorkspaceId>('local')

  // Edit Mode
  const editMode = useEditMode()

  // Swipe（共用 hook，edit mode 時停用）
  const swipe = useSwipe({ enabled: !editMode.isEditMode })

  // Context Menu 狀態（pageId 為 null 代表點在空白區域）
  const [pageContextMenu, setPageContextMenu] = useState<{
    pageId: string | null
    position: { x: number; y: number }
  } | null>(null)

  // File Link：已連結的 pages（含 autoSync 狀態）
  const [linkedPages, setLinkedPages] = useState<Map<string, { autoSync: boolean }>>(new Map())

  // Info Dialog：顯示 page 詳細資訊
  const [infoTarget, setInfoTarget] = useState<Page | null>(null)
  // Info Dialog 所需的 folders 清單（僅在開啟時載入，用於計算 location）
  const [infoFolders, setInfoFolders] = useState<Folder[]>([])
  const [infoLinkPath, setInfoLinkPath] = useState<string | null>(null)

  // Edit Mode: 批量移動
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false)

  // Edit Mode: 刪除確認
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // dnd-kit: 當前拖動的 page ID
  const [activeId, setActiveId] = useState<string | null>(null)

  // dnd-kit: 感應器設定（handle-only dragging，不需長按延遲）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }  // 移動 5px 後啟動
    }),
    useSensor(TouchSensor, {
      activationConstraint: { distance: 5 }  // 移動 5px 即觸發，無需長按
    })
  )

  const toast = useToast()

  // 暴露 ref 方法給外部
  useImperativeHandle(ref, () => ({
    enterEditMode: () => editMode.enterEditMode('page'),
    exitEditMode: () => editMode.exitEditMode(),
    isInEditMode: () => editMode.isEditMode
  }), [editMode])

  useEffect(() => {
    if (folderId) {
      loadPages()
    } else {
      setPages([])
    }
  }, [folderId])

  // 載入已連結的 pageIds（File System Access API）
  useEffect(() => {
    if (isFileHandleSupported()) {
      getAllLinkedEntries().then(setLinkedPages).catch(() => {})
    }
  }, [folderId, refreshKey])

  // Edit Mode 的 click outside 邏輯（共用 hook）
  useEditModeClickOutside(editMode.isEditMode, editMode.exitEditMode, '.page-list')



  useEffect(() => {
    if (selectedPage && selectedPage.id) {
      setPages(prevPages => {
        const existingPage = prevPages.find(p => p.id === selectedPage.id)
        if (existingPage &&
            (existingPage.name !== selectedPage.name ||
             existingPage.content !== selectedPage.content ||
             existingPage.updatedAt !== selectedPage.updatedAt)) {
          const updatedPages = prevPages.map(p =>
            p.id === selectedPage.id ? selectedPage : p
          )
          return sortPages(updatedPages)
        }
        return prevPages
      })
    }
  }, [selectedPage])

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0 && folderId) {
      loadPages()
    }
  }, [refreshKey])

  // 當 refreshKey 改變時，如果在編輯模式中，自動退出（表示外部有資料變更）
  useEffect(() => {
    if (editMode.isEditMode && refreshKey !== undefined && refreshKey > 0) {
      editMode.exitEditMode()
    }
  }, [refreshKey])

  // Info Dialog：開啟時載入 folders 供 location breadcrumb 使用
  useEffect(() => {
    if (!infoTarget) return
    let cancelled = false
    ;(async () => {
      try {
        const all = await db(wsId).getAllFolders()
        if (cancelled) return
        setInfoFolders(all)
        // 載入 linked 檔案路徑
        if (linkedPages.has(infoTarget.id)) {
          const pageLink = await getPageLink(infoTarget.id)
          if (pageLink && !cancelled) {
            const folderLink = await getFolderDirLink(pageLink.folderId)
            if (folderLink && !cancelled) {
              const dirEntry = await getDirHandle(folderLink.handleId)
              if (dirEntry && !cancelled) {
                const parts = [dirEntry.dirName]
                if (folderLink.subPath) parts.push(folderLink.subPath)
                parts.push(pageLink.fileName)
                setInfoLinkPath(parts.join('/'))
              }
            }
          }
        }
      } catch (err) {
        console.error('[InfoDialog] Failed to load folders:', err)
      }
    })()
    return () => { cancelled = true }
  }, [infoTarget, wsId, linkedPages])

  // Info Dialog helpers
  const fmtFull = (ts: number) => new Date(ts).toLocaleString()
  const fmtRelative = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }
  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(2)} MB`
  }

  const buildPageInfoRows = (page: Page): InfoRow[] => {
    const rows: InfoRow[] = []

    // Location: 從 page.folderId 組出 Root › A › B 路徑
    const locChain: string[] = []
    let cur: Folder | undefined = infoFolders.find(f => f.id === page.folderId)
    while (cur) {
      locChain.unshift(cur.name)
      cur = cur.parentId ? infoFolders.find(f => f.id === cur!.parentId) : undefined
    }
    rows.push({
      label: 'Location',
      value: locChain.length > 0 ? locChain.join(' › ') : '—',
    })

    rows.push({ label: 'Created', value: fmtFull(page.createdAt) })
    rows.push({ label: 'Modified', value: fmtFull(page.updatedAt) })

    // Size / Lines / Words / Chars / Images
    const content = page.content || ''
    const byteLen = new Blob([content]).size
    rows.push({ label: 'Size', value: fmtBytes(byteLen) })
    // Lines：以換行數 + 1 計算（空內容 = 0）
    const lineCount = content.length === 0 ? 0 : content.split('\n').length
    // Words：空白切割
    const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0
    // Chars：使用 Array.from 處理 Unicode（emoji / CJK）
    const charCount = Array.from(content).length
    rows.push({
      label: 'Length',
      value: `${lineCount} L · ${wordCount} W · ${charCount} C`,
    })
    const imgMatches = content.match(/image:\/\/img-[^\s)"'`]+/g)
    const imgCount = imgMatches ? imgMatches.length : 0
    if (imgCount > 0) {
      rows.push({ label: 'Images', value: String(imgCount) })
    }

    if (linkedPages.has(page.id)) {
      rows.push({ label: 'Linked 🔗', value: infoLinkPath ?? '…' })
    }

    if (page.lastSyncedAt) {
      rows.push({ label: 'Last Synced', value: fmtRelative(page.lastSyncedAt) })
    }

    return rows
  }




  const loadPages = async () => {
    if (!folderId) return

    // Check if trash to include deleted items
    const isTrash = isTrashFolderId(folderId)

    const folderPages = await db(wsId).getPagesByFolder(folderId, isTrash)
    const sortedPages = sortPages(folderPages)
    setPages(sortedPages)
  }

  // 重新載入頁面並回傳結果（避免閉包問題）
  const loadPagesAndReturn = async (): Promise<Page[]> => {
    if (!folderId) return []

    const isTrash = isTrashFolderId(folderId)

    const folderPages = await db(wsId).getPagesByFolder(folderId, isTrash)
    const sortedPages = sortPages(folderPages)
    setPages(sortedPages)
    return sortedPages
  }

  // 排序頁面：直接讀取 settingsService 取得最新排序設定
  const sortPages = (pagesToSort: Page[]) => {
    const { sortBy, sortOrder } = settingsService.getPageSort()

    if (sortBy === 'none') {
      // 手動排序：按 order 欄位
      return [...pagesToSort].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    const sorted = [...pagesToSort].sort((a, b) => {
      let compareResult = 0

      if (sortBy === 'updatedAt') {
        compareResult = a.updatedAt - b.updatedAt
      } else if (sortBy === 'createdAt') {
        compareResult = a.createdAt - b.createdAt
      } else if (sortBy === 'name') {
        compareResult = a.name.localeCompare(b.name, 'zh-TW')
      }

      return sortOrder === 'asc' ? compareResult : -compareResult
    })

    return sorted
  }


  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    const isSameYear = date.getFullYear() === now.getFullYear()
    const locale = navigator.language || 'en-US'

    if (isToday) {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
    } else if (isYesterday) {
      return 'Yesterday'
    } else if (isSameYear) {
      return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date)
    } else {
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
    }
  }

  const getPreview = (content: string) => {
    if (!content) return 'Empty'
    const lines = content.split('\n')
    const potentialBody = lines.slice(1).join(' ').trim()
    if (!potentialBody) return 'Empty'
    const plainText = potentialBody
      .replace(/[#*\[\]`()>\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return plainText.length > 0 ? plainText : 'Empty'
  }

  // 取得頁面顯示名稱（統一從 content 第一行 derive）
  const getPageDisplayName = (page: Page, selectedPage: Page | null, isSelected: boolean): string => {
    // 如果是當前選中的頁面，使用 selectedPage 的 content
    if (isSelected && selectedPage) {
      const firstLine = (selectedPage.content || '').split('\n')[0].replace(/^#+\s*/, '').trim()
      return firstLine || selectedPage.name || 'Untitled'
    }

    // 從 content 取第一行，或使用 name 欄位作為 fallback
    const firstLine = (page.content || '').split('\n')[0].replace(/^#+\s*/, '').trim()
    return firstLine || page.name || 'Untitled'
  }

  // 取得頁面內容預覽
  const getPagePreview = (page: Page, selectedPage: Page | null, isSelected: boolean): string => {
    const content = (isSelected && selectedPage) ? selectedPage.content : page.content
    return getPreview(content)
  }

  // 核心刪除邏輯（單頁/批量共用）
  const deletePagesCore = async (
    pageIds: string[],
    options?: { skipConfirm?: boolean }
  ): Promise<Page[]> => {
    const skipConfirm = options?.skipConfirm ?? (pageIds.length > 1)

    for (const pageId of pageIds) {
      const page = pages.find(p => p.id === pageId)
      if (!page) continue

      const isInTrash = isTrashFolderId(page.folderId)

      if (isInTrash) {
        await permanentlyDeletePage(pageId, wsId, skipConfirm)
      } else {
        await movePageToRecycle(pageId, wsId)
      }


    }

    // 重新載入並回傳最新列表
    const result = await loadPagesAndReturn()

    // 通知父組件頁面已變更（更新 folder 頁面數量）
    onPagesChanged?.()

    return result
  }

  // 選擇下一頁邏輯（刪除後呼叫）
  const selectNextPageAfterDelete = (
    deletedPageIds: string[],
    updatedPages: Page[],
    originalIndex: number
  ) => {
    // 檢查當前選中頁面是否被刪除
    const isCurrentPageDeleted = lastSelectedPageId &&
      deletedPageIds.includes(lastSelectedPageId)

    if (!isCurrentPageDeleted) return

    if (updatedPages.length === 0) {
      // folder 已空：清空編輯器
      onSelectPage({
        id: '', folderId: '', name: '', content: '', createdAt: 0, updatedAt: 0,
      })
    } else if (originalIndex >= 0 && originalIndex < updatedPages.length) {
      // 選擇同位置的頁面（原來的「下一個」）
      onSelectPage(updatedPages[originalIndex])
    } else {
      // 刪除的是最後一個，選擇新的最後一個
      onSelectPage(updatedPages[updatedPages.length - 1])
    }
  }

  const handleDeletePage = async (pageId: string) => {
    swipe.closeSwipe()

    const deletedIndex = pages.findIndex(p => p.id === pageId)
    if (deletedIndex === -1) return

    // 如果是從普通 folder 刪除（移到 Trash），自動顯示 Trash
    const page = pages[deletedIndex]
    if (page && !isTrashFolderId(page.folderId)) {
      settingsService.saveSyncedSettings({ showTrash: true })
    }

    const updatedPages = await deletePagesCore([pageId])
    selectNextPageAfterDelete([pageId], updatedPages, deletedIndex)
  }

  // --- Move Page Logic (單一頁面) ---
  const initiateMovePage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId)
    if (!page) return
    setMoveSourceWorkspace(workspaceIdProp || wsId)
    setMoveTargetPageId(pageId)
    swipe.closeSwipe()
    setShowMoveDialog(true)
  }

  const handleMovePage = async (targetFolderId: string) => {
    if (!moveTargetPageId) return
    // 處理 Root Level 特殊 sentinel
    const actualTargetFolderId = targetFolderId === ROOT_LEVEL_TARGET
      ? ROOT_FOLDER_ID : targetFolderId
    try {
      const page = pages.find(p => p.id === moveTargetPageId)
      if (!page) throw new Error('Page not found')

      const updateData: Partial<Page> = {
        folderId: actualTargetFolderId,
        updatedAt: Date.now(),
      }

      // If moving FROM trash, restore it (clear deleted state)
      const isFromTrash = isTrashFolderId(page.folderId)
      if (isFromTrash) {
          // @ts-ignore - dynamic property
          updateData.isDeleted = false
          // @ts-ignore
          updateData.deletedAt = undefined
          // @ts-ignore
          updateData.deletedBy = undefined
          // @ts-ignore
          updateData.autoDeleteAt = undefined
      }

      await db(wsId).updatePage({ ...page, ...updateData })

      toast.success('Page moved successfully')
      await loadPages()
      onPagesChanged?.()  // 通知父組件更新 folder 頁面數量

      if (lastSelectedPageId === moveTargetPageId) {
         onSelectPage({ ...page, ...updateData } as Page)
         const deletedIndex = pages.findIndex(p => p.id === moveTargetPageId)
         if (pages.length > 1) {
             const nextIndex = deletedIndex < pages.length - 1 ? deletedIndex + 1 : deletedIndex - 1
             if (nextIndex >= 0) onSelectPage(pages[nextIndex])
         } else {
             onSelectPage({ id: '', folderId: '', name: '', content: '', createdAt: 0, updatedAt: 0 })
         }
      }
    } catch (error) {
      console.error('Move failed:', error)
      toast.error('Failed to move page')
    } finally {
      setShowMoveDialog(false)
      setMoveTargetPageId(null)
    }
  }


  // --- dnd-kit 拖放處理 ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pages.findIndex(p => p.id === active.id)
    const newIndex = pages.findIndex(p => p.id === over.id)
    const newPages = arrayMove(pages, oldIndex, newIndex)

    // 更新 order 欄位並儲存
    const updates = newPages.map((page, index) => ({
      ...page,
      order: index
    }))

    setPages(updates)
    await Promise.all(updates.map(p => db(wsId).updatePage(p)))
  }

  // --- Edit Mode: 批量刪除 ---
  const handleBatchDeleteConfirm = async () => {
    setShowDeleteConfirm(false)
    const selectedIds = Array.from(editMode.selectedIds)

    // 記錄當前選中頁面的位置
    const deletedIndex = lastSelectedPageId
      ? pages.findIndex(p => p.id === lastSelectedPageId)
      : -1

    const updatedPages = await deletePagesCore(selectedIds, { skipConfirm: true })

    editMode.exitEditMode()
    toast.success(`Deleted ${selectedIds.length} pages`)

    selectNextPageAfterDelete(selectedIds, updatedPages, deletedIndex)
  }

  // --- Edit Mode: 批量移動 ---
  const handleBatchMoveOpen = () => {
    setMoveSourceWorkspace(workspaceIdProp || wsId)
    setShowBatchMoveDialog(true)
  }

  const handleBatchMove = async (targetFolderId: string) => {
    // 處理 Root Level 特殊 sentinel
    const actualTargetFolderId = targetFolderId === ROOT_LEVEL_TARGET
      ? ROOT_FOLDER_ID : targetFolderId
    const selectedIds = Array.from(editMode.selectedIds)

    try {
      for (const pageId of selectedIds) {
        const page = pages.find(p => p.id === pageId)
        if (!page) continue

        const updateData: Partial<Page> = {
          folderId: actualTargetFolderId,
          updatedAt: Date.now(),
        }

        // 從 Trash 還原
        const isFromTrash = isTrashFolderId(page.folderId)
        if (isFromTrash) {
          // @ts-ignore
          updateData.isDeleted = false
          // @ts-ignore
          updateData.deletedAt = undefined
          // @ts-ignore
          updateData.deletedBy = undefined
          // @ts-ignore
          updateData.autoDeleteAt = undefined
        }

        await db(wsId).updatePage({ ...page, ...updateData })
      }

      toast.success(`Moved ${selectedIds.length} pages`)
    } catch (error) {
      console.error('Batch move failed:', error)
      toast.error('Failed to move')
    } finally {
      setShowBatchMoveDialog(false)
      await loadPages()
      onPagesChanged?.()  // 通知父組件更新 folder 頁面數量
      editMode.exitEditMode()
    }
  }

  // --- Edit Mode: 操作按鈕 ---
  const pageEditModeActions: ActionButton[] = [
    {
      id: 'move',
      icon: <IconFolderSymlink size={18} />,
      label: 'Move',
      onClick: handleBatchMoveOpen,
      disabled: !editMode.hasSelection
    },
    {
      id: 'delete',
      icon: <IconTrash size={18} />,
      label: 'Delete',
      onClick: () => setShowDeleteConfirm(true),
      disabled: !editMode.hasSelection,
      variant: 'danger' as const
    }
  ]

  // --- 渲染 ---
  return (
    <div className={`page-list ${editMode.isEditMode ? 'in-edit-mode' : ''}`}>
      <div
        ref={swipe.containerRef}
        className="page-list-content"
        style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1 }}
        onClick={(e) => {
          // Edit Mode 時，點擊空白區域（非 page-item）退出
          if (editMode.isEditMode) {
            const target = e.target as HTMLElement
            if (!target.closest('.page-item') && !target.closest('.page-item-wrapper')) {
              editMode.exitEditMode()
            }
          }
        }}
        onContextMenu={(e) => {
          // Desktop 才支援右鍵，Edit Mode 時停用
          if (isPortraitMode || editMode.isEditMode) return
          // 若點擊目標在 page-item 內，交由 page-item 自己處理
          const target = e.target as HTMLElement
          if (target.closest('.page-item')) return
          e.preventDefault()
          swipe.closeSwipe()
          setPageContextMenu({ pageId: null, position: { x: e.clientX, y: e.clientY } })
        }}
      >
        {!folderId ? (
          <div className="page-empty">Please select a folder</div>
        ) : pages.length === 0 ? (
          <div className="page-empty">
            {isTrashFolderId(folderId)
              ? 'Trash is empty'
              : <>Press <IconPlusCircleFill size={20} className="inline-icon" /> to add new page</>
            }
          </div>
        ) : editMode.isEditMode ? (
          // Edit Mode: 使用 dnd-kit
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {pages.map(page => {
                const isSelected = lastSelectedPageId === page.id
                const displayName = getPageDisplayName(page, selectedPage, isSelected)
                const displayPreview = getPagePreview(page, selectedPage, isSelected)

                return (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    isSelected={isSelected}
                    isEditSelected={editMode.isSelected(page.id)}
                    onSelect={() => onSelectPage(page)}
                    onToggleSelect={() => editMode.toggleSelect(page.id)}
                    formatDate={formatDate}
                    getPreview={() => displayPreview}
                    displayName={displayName}
                    displayContent=""
                  />
                )
              })}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId && (
                <div className="page-drag-preview">
                  {pages.find(p => p.id === activeId)?.name || 'Page'}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          // 正常模式: 原有 swipe 邏輯
          pages.map(page => {
            const isSelected = lastSelectedPageId === page.id
            const displayName = getPageDisplayName(page, selectedPage, isSelected)
            const displayPreview = getPagePreview(page, selectedPage, isSelected)

            return (
              <div key={page.id} style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Swipe Actions (Behind) */}
                <div
                  className="page-swipe-actions"
                  style={{
                    position: 'absolute', top: 0, bottom: 0, right: 0, width: '140px',
                    display: 'flex', zIndex: 1
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); initiateMovePage(page.id) }}
                    style={{ flex: 1, backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Move
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id) }}
                    style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>

                {/* Main Content (Slides Left) */}
                <div
                  className={`page-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectPage(page)}
                  onContextMenu={(e) => {
                    if (!isPortraitMode && !editMode.isEditMode) {
                      e.preventDefault()
                      swipe.closeSwipe()
                      setPageContextMenu({ pageId: page.id, position: { x: e.clientX, y: e.clientY } })
                    }
                  }}
                  onTouchStart={(e) => swipe.handleTouchStart(e, page.id)}
                  onTouchMove={(e) => swipe.handleTouchMove(e, page.id)}
                  onTouchEnd={() => swipe.handleTouchEnd(page.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    background: isSelected ? 'var(--bg-selected)' : 'var(--bg-pagelist)',
                    borderLeft: isSelected ? '4px solid var(--accent)' : '4px solid transparent',
                    position: 'relative',
                    zIndex: 2,
                    ...swipe.getSwipeStyle(page.id),
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  {/* Hover Action Buttons - Desktop only */}
                  {!isPortraitMode && !editMode.isEditMode && (
                    <div className="page-actions">
                      <button
                        className="page-action-btn"
                        title="Move"
                        onClick={(e) => { e.stopPropagation(); initiateMovePage(page.id) }}
                      >
                        <IconFolderSymlink size={14} />
                      </button>
                      <button
                        className="page-action-btn page-delete-btn"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id) }}
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  )}
                  <div style={{ fontWeight: 'bold', fontSize: 'var(--content-font-size)', color: 'var(--text-primary)', lineHeight: '1.4', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', alignItems: 'center' }}>
                     {displayName}
                  </div>
                  <div style={{ fontSize: 'var(--interface-font-size)', color: 'var(--text-secondary)', lineHeight: '1.5', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '2px' }}>
                     <span style={{ color: 'var(--text-muted)', marginRight: '8px', fontWeight: '500', whiteSpace: 'nowrap', display: 'inline' }}>
                       {formatDate(settingsService.getPageSort().sortBy === 'createdAt' ? page.createdAt : page.updatedAt)}
                     </span>
                     <span style={{ opacity: 0.8, display: 'inline' }}>
                       {displayPreview}
                     </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Edit Mode 底部操作列 */}
      {editMode.isEditMode && (
        <EditModeBottomBar
          isAllSelected={editMode.isAllSelected(pages.map(p => p.id))}
          onDone={() => editMode.exitEditMode()}
          onToggleSelectAll={() => {
            if (editMode.isAllSelected(pages.map(p => p.id))) {
              editMode.clearSelection()
            } else {
              editMode.selectAll(pages.map(p => p.id))
            }
          }}
          actions={pageEditModeActions}
          isDragging={!!activeId}
        />
      )}

      {/* 單一頁面移動對話框 */}
      <FolderPickerDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        onSelect={handleMovePage}
        currentFolderId={folderId}
        sourceWorkspaceId={moveSourceWorkspace}
      />

      {/* 批量移動對話框 */}
      <FolderPickerDialog
        isOpen={showBatchMoveDialog}
        onClose={() => setShowBatchMoveDialog(false)}
        onSelect={handleBatchMove}
        currentFolderId={folderId}
        sourceWorkspaceId={moveSourceWorkspace}
      />

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Pages"
        message={`Are you sure you want to delete ${editMode.selectionCount} pages?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        icon="🗑️"
        onConfirm={handleBatchDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Context Menu */}
      <ContextMenu
        isOpen={pageContextMenu !== null}
        position={pageContextMenu?.position ?? { x: 0, y: 0 }}
        items={pageContextMenu ? (() => {
          const pid = pageContextMenu.pageId
          // Trash folder 內禁止 New Page / Edit Pages
          const hasFolder = !!folderId && !isTrashFolderId(folderId)

          const newPageItem: ContextMenuItem = {
            id: 'new-page',
            label: 'New Page',
            icon: <IconPlusCircleFill size={16} />,
            disabled: !hasFolder,
            onClick: () => onCreatePage?.(),
          }
          const editPagesItem: ContextMenuItem = {
            id: 'edit-pages',
            label: 'Select',
            icon: <IconFileEarmarkCheck size={16} />,
            disabled: !hasFolder || pages.length === 0,
            onClick: () => editMode.enterEditMode('page'),
          }

          // 空白區域右鍵：只顯示 New Page / Edit Pages
          if (pid === null) return [newPageItem, editPagesItem]

          // Page item 右鍵：New → Move → Edit → (File Link) → Delete
          const isLinked = isFileHandleSupported() && linkedPages.has(pid)
          const isAutoSync = linkedPages.get(pid)?.autoSync ?? true

          const fileLinkToast = (result: FileLinkResult | SyncResult, action: string) => {
            const messages: Record<string, string> = {
              success: action === 'pull' ? '已從檔案更新' : action === 'push' ? '已寫回檔案' : '已連結檔案',
              pulled: '已從檔案更新',
              pushed: '已寫回檔案',
              unchanged: '檔案內容沒有變更',
              NO_HANDLE: '找不到連結的檔案',
              PERMISSION_DENIED: '需要檔案存取權限',
              FILE_NOT_FOUND: '檔案已移動或刪除',
              ENCRYPTION_LOCKED: '需要先解鎖加密資料夾',
            }
            toast.showToast(messages[result] || '操作失敗')
            // 刷新連結狀態
            if (result === 'FILE_NOT_FOUND' || result === 'NO_HANDLE') {
              getAllLinkedEntries().then(setLinkedPages).catch(() => {})
            }
          }

          return [
            newPageItem,
            {
              id: 'move',
              label: 'Move',
              icon: <IconFolderSymlink size={16} />,
              onClick: () => initiateMovePage(pid),
            },
            // Select：進入 edit mode 並預先勾選當前 page
            {
              id: 'select',
              label: 'Select',
              icon: <IconFileEarmarkCheck size={16} />,
              onClick: () => {
                editMode.enterEditMode('page')
                editMode.toggleSelect(pid)
              },
            },
            // File Link 選項（僅已連結檔案的 page 顯示）
            ...(isLinked ? [
              { type: 'separator' as const },
              {
                id: 'sync-toggle',
                label: isAutoSync ? '✓ Sync MD File' : '  Sync MD File',
                icon: <IconArrowRepeat size={16} />,
                onClick: async () => {
                  const newValue = await togglePageAutoSync(pid)
                  setLinkedPages(prev => {
                    const next = new Map(prev)
                    const entry = next.get(pid)
                    if (entry) next.set(pid, { ...entry, autoSync: newValue })
                    return next
                  })
                  toast.showToast(newValue ? '已啟用自動同步' : '已停用自動同步')
                },
              },
              {
                id: 'pull',
                label: 'Pull from File',
                icon: <IconDownload size={16} />,
                onClick: async () => {
                  const result = await pullFromFile(pid, wsId)
                  fileLinkToast(result, 'pull')
                  if (result === 'success') {
                    // 刷新 page list 和編輯器
                    loadPages()
                    const updatedPage = await db(wsId).getPage(pid)
                    if (updatedPage && onSelectPage) onSelectPage(updatedPage)
                  }
                },
              },
              {
                id: 'push',
                label: 'Push to File',
                icon: <IconUpload size={16} />,
                onClick: async () => {
                  const result = await pushToFile(pid, wsId)
                  fileLinkToast(result, 'push')
                },
              },
            ] : []),
            { type: 'separator' as const },
            {
              id: 'delete',
              label: 'Delete',
              icon: <IconTrash size={16} />,
              variant: 'danger' as const,
              onClick: () => handleDeletePage(pid),
            },
            { type: 'separator' as const },
            {
              id: 'info',
              label: 'Info',
              icon: <IconInfoCircle size={16} />,
              onClick: () => {
                const p = pages.find(pg => pg.id === pid)
                if (p) setInfoTarget(p)
              },
            },
          ]
        })() : []}
        onClose={() => setPageContextMenu(null)}
      />

      {/* Info Dialog：顯示 page metadata */}
      <InfoDialog
        isOpen={infoTarget !== null}
        title={infoTarget?.name ?? ''}
        icon={<IconFileEarmarkCheck size={18} />}
        rows={infoTarget ? buildPageInfoRows(infoTarget) : []}
        onClose={() => { setInfoTarget(null); setInfoLinkPath(null) }}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
})

PageList.displayName = 'PageList'

export default PageList
