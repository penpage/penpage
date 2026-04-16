import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Folder, db } from '../services/db'
import {
  ensureRecycleFolderExists,
  isRecycleFolderOrChild,
  permanentlyDeleteFolder,
  moveFolderToRecycle
} from '../services/recycleBin'
import {
  ensureRootFolderExists,
  isRootFolderId,
  isTrashFolderId,
  ROOT_FOLDER_ID,
  TRASH_FOLDER_ID
} from '../services/rootFolders'
import { useToast } from '../hooks/useToast'
import ToastContainer from './ToastContainer'
import { settingsService } from '../services/settings'
import { WorkspaceId } from '../types/workspace'
import { ChevronRight, ChevronDown } from './icons/ChevronIcons'
import { IconDropletFill, IconType, IconTrash, IconFolderSymlink, IconFolderPlus, IconLink45deg, IconFolderCheck, IconInfoCircle } from './icons/BootstrapIcons'
import InfoDialog, { InfoRow } from './InfoDialog'
// db 已從上方匯入（現在是函式：db(workspaceId)）
import { getAllLinkedFolderIds, isFileHandleSupported, getFolderDirLink, getDirHandle } from '../services/fileHandleStore'
import { linkDirectoryToFolder, rescanLinkedFolder } from '../utils/fileLink'
import { collectSubfolders } from '../utils/folderUtils'
import { useEditMode } from '../hooks/useEditMode'
import { useEditModeClickOutside } from '../hooks/useEditModeClickOutside'
import { useSwipe } from '../hooks/useSwipe'
import { getDisplayColor, TRASH_FOLDER_COLOR } from '../config/colors'
import { generateFolderId } from '../utils/idGenerator'
import { useOrientation } from '../contexts/OrientationContext'
import EditModeBottomBar from './EditModeBottomBar'
import { ActionButton } from './BottomActionBar'
import ColorPicker from './ColorPicker'
import ConfirmDialog from './ConfirmDialog'
import ContextMenu, { ContextMenuEntry } from './ContextMenu'
import { FolderPickerDialog, ROOT_LEVEL_TARGET } from './FolderPickerDialog'
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
import { SortableFolderItem } from './SortableFolderItem'

interface FolderTreeProps {
  onSelectFolder: (folderId: string, options?: { skipViewChange?: boolean }) => void
  onFolderDeleted?: () => void  // 當 folder 被刪除時的回調
  onPagesChanged?: () => void   // 當 page 內容因 sync 等操作更新時的回調
  selectedFolderId: string | null
  refreshKey?: number  // 當這個值改變時，重新加載數據
  workspaceId?: WorkspaceId  // 只顯示指定 workspace 的資料夾
}

// Expose createFolder 和 Edit Mode 方法給外部調用
export interface FolderTreeRef {
  createFolder: () => void
  createSubfolder: (parentId: string | null) => void
  enterEditMode: (preSelectId?: string) => void
  exitEditMode: () => void
  isInEditMode: () => boolean
  showFolderInfo: (folderId: string) => void
}

// Helper to identify trash folders（使用 rootFolders 的 isTrashFolderId）
const isTrashId = isTrashFolderId

const FolderTree = forwardRef<FolderTreeRef, FolderTreeProps>(({ onSelectFolder, onFolderDeleted, onPagesChanged, selectedFolderId, refreshKey, workspaceId = 'local' }, ref) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({})
  const [linkedFolders, setLinkedFolders] = useState<Set<string>>(new Set())
  const [showTrash, setShowTrash] = useState(false)

  // 初始化時從 localStorage 恢復展開狀態
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const savedExpandedFolders = settingsService.getExpandedFolders()
    return new Set(savedExpandedFolders)
  })

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showArchiveMenu, setShowArchiveMenu] = useState(false)

  // dnd-kit 狀態
  const [activeId, setActiveId] = useState<string | null>(null)

  // Toast 通知
  const toast = useToast()

  // Ref 用於引用 folder name 輸入框
  const folderInputRef = useRef<HTMLInputElement>(null)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } })
  )

  // Edit Mode 相關狀態
  const editMode = useEditMode()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerAnchor] = useState<DOMRect | null>(null)  // null = 居中顯示
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [moveSourceIds, setMoveSourceIds] = useState<string[]>([])  // 共用：swipe 單一 / edit mode 批量

  // Swipe（共用 hook，edit mode 或 inline rename 時停用）
  const swipe = useSwipe({ enabled: !editMode.isEditMode && !editingFolderId })

  // Context Menu 狀態（folderId: null 表示空白區域右鍵）
  const [contextMenu, setContextMenu] = useState<{
    folderId: string | null
    position: { x: number; y: number }
  } | null>(null)

  // Cleanup 確認對話框
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)

  // Info Dialog：顯示 folder 詳細資訊
  const [infoTarget, setInfoTarget] = useState<Folder | null>(null)
  const [infoFolderStats, setInfoFolderStats] = useState<{
    directPages: number
    totalPages: number
    totalSize: number
    directSubfolders: number
  } | null>(null)
  const [infoLinkPath, setInfoLinkPath] = useState<string | null>(null)

  // 裝置模式
  const { isPortraitMode } = useOrientation()

  useEffect(() => {
    const init = async () => {
      // 初始化極快（<150ms），不需要 LoadingSpinner
      await ensureRootFolderExists(workspaceId)
      await ensureRecycleFolderExists(workspaceId)
      await loadFolders()
      await loadPageCounts()
      loadLinkedFolders()
    }
    init()
  }, [])

  // Edit Mode 的 click outside 邏輯（共用 hook）
  useEditModeClickOutside(editMode.isEditMode, editMode.exitEditMode, '.folder-tree')

  // Global click handler to close menus
  useEffect(() => {
    if (!showArchiveMenu) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.archive-dropdown')) {
        setShowArchiveMenu(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [showArchiveMenu])

  // 當 refreshKey 改變時，重新加載 folders 和 page counts
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      loadFolders()
      loadPageCounts()
      loadLinkedFolders()
    }
  }, [refreshKey])

  // 當進入編輯模式時，自動全選 folder name
  useEffect(() => {
    if (editingFolderId && folderInputRef.current) {
      setTimeout(() => {
        folderInputRef.current?.select()
      }, 0)
    }
  }, [editingFolderId])

  // 當 refreshKey 改變時，如果在編輯模式中，自動退出（表示外部有資料變更）
  useEffect(() => {
    if (editMode.isEditMode && refreshKey !== undefined && refreshKey > 0) {
      editMode.exitEditMode()
    }
  }, [refreshKey])

  const loadFolders = async () => {
    const allFolders = await db(workspaceId).getAllFolders()
    setFolders(allFolders)
    // Load settings
    const settings = settingsService.getSyncedSettings()
    setShowTrash(settings.showTrash)
  }

  const loadPageCounts = async () => {
    const allPages = await db(workspaceId).getAllPages()
    const counts: Record<string, number> = {}

    // Count pages per folder
    allPages.forEach(page => {
      if (page.folderId) {
        counts[page.folderId] = (counts[page.folderId] || 0) + 1
      }
    })
    setPageCounts(counts)
  }

  const loadLinkedFolders = () => {
    getAllLinkedFolderIds().then(setLinkedFolders).catch(() => {})
  }

  const handleCreateFolder = async (parentId: string | null = null) => {
    setShowArchiveMenu(false) // Close menu if open

    // 如果 parentId 為 null，預設為對應 workspace 的 root folder
    const actualParentId = parentId ?? ROOT_FOLDER_ID

    const siblings = folders.filter(f => f.parentId === actualParentId)

    // 計算新 folder 的 order（忽略 Trash 和 Root）
    const normalSiblings = siblings.filter(f => !isTrashId(f.id) && !isRootFolderId(f.id))
    const maxOrder = normalSiblings.length > 0 ? Math.max(...normalSiblings.map(f => f.order)) : -1
    const newOrder = maxOrder + 1

    // 使用 FolderN 命名模式
    const newFolderPattern = /^Folder(\d+)$/
    let maxNumber = 0

    siblings.forEach(folder => {
      const match = folder.name.match(newFolderPattern)
      if (match) maxNumber = Math.max(maxNumber, parseInt(match[1], 10))
    })

    const newFolderName = `Folder${maxNumber + 1}`

    const newFolder: Folder = {
      id: generateFolderId(),
      name: newFolderName,
      parentId: actualParentId,  // 使用 actualParentId（不再是 null）
      order: newOrder,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await db(workspaceId).createFolder(newFolder)

    if (parentId) {
      const newExpanded = new Set([...expandedFolders, parentId])
      setExpandedFolders(newExpanded)
      settingsService.saveExpandedFolders(Array.from(newExpanded))
    }

    await loadFolders()
    // 新增資料夾時跳過視圖切換，保持在當前視圖等待輸入名稱
    onSelectFolder(newFolder.id, { skipViewChange: true })
    setEditingFolderId(newFolder.id)
    setEditingName(newFolder.name)

  }

  // Expose createFolder 和 Edit Mode 給外部調用（透過 ref）
  useImperativeHandle(ref, () => ({
    createFolder: () => handleCreateFolder(null),
    createSubfolder: (parentId: string | null) => handleCreateFolder(parentId),
    enterEditMode: (preSelectId?: string) => {
      editMode.enterEditMode('folder')
      if (preSelectId) editMode.toggleSelect(preSelectId)
    },
    exitEditMode: () => editMode.exitEditMode(),
    isInEditMode: () => editMode.isEditMode,
    showFolderInfo: (folderId: string) => {
      const folder = folders.find(f => f.id === folderId)
      if (folder) {
        setInfoTarget(folder)
        setInfoFolderStats(null)
        setInfoLinkPath(null)
      }
    }
  }), [folders, expandedFolders, editMode])

  const handleUpdateFolder = async (folder: Folder, newName: string) => {
    const updated = { ...folder, name: newName, updatedAt: Date.now() }
    await db(workspaceId).updateFolder(updated)
    await loadFolders()
    setEditingFolderId(null)
    onFolderDeleted?.()  // 通知 Sidebar 刷新 header title

    // 如果在編輯模式中重命名，完成後退出編輯模式
    if (editMode.isEditMode) {
      editMode.exitEditMode()
    }
  }

  // Edit Mode: 批量刪除確認
  const handleBatchDeleteConfirm = useCallback(async () => {
    setShowDeleteConfirm(false)
    const selectedIds = Array.from(editMode.selectedIds)

    for (const folderId of selectedIds) {
      try {
        // 系統 folder 保護
        if (isTrashId(folderId) || isRootFolderId(folderId)) {
          continue
        }

        const isInRecycle = await isRecycleFolderOrChild(folderId, workspaceId)
        if (isInRecycle) {
          await permanentlyDeleteFolder(folderId, workspaceId)
        } else {
          // 檢查是否有非空頁面（使用 cleanupService 的共用函數）
          const folder = folders.find(f => f.id === folderId)
          if (!folder) continue

          // 簡易判斷 folder 是否為空（只檢查直接 pages）
          const pages = await db(workspaceId).getPagesByFolder(folderId)
          const isEmpty = pages.every(p => !p.content || p.content.trim() === '')

          if (!isEmpty) {
            toast.warning(`Folder "${folder.name}" contains non-empty pages, skipped`)
            continue
          }

          // 遞迴刪除所有子 folders（由深到淺，防止孤兒）
          const deleteSubfoldersRecursively = async (parentId: string): Promise<void> => {
            const children = folders.filter(f => f.parentId === parentId && !f.isDeleted)
            for (const child of children) {
              // 先遞迴刪除子層
              await deleteSubfoldersRecursively(child.id)
              // 再刪除這個 folder
              await moveFolderToRecycle(child.id, workspaceId)
            }
          }

          // 先刪除所有子 folders
          await deleteSubfoldersRecursively(folderId)
          // 最後刪除自己
          await moveFolderToRecycle(folderId, workspaceId)
        }
      } catch (error) {
        console.error('Delete folder failed:', error)
      }
    }

    // 刪除後自動顯示 Trash（不展開，使用者自己決定）
    settingsService.saveSyncedSettings({ showTrash: true })
    await loadFolders()
    await loadPageCounts()
    toast.success(`Deleted ${selectedIds.length} folders`)

    // 刪除後自動退出編輯模式
    editMode.exitEditMode()

    if (onFolderDeleted) onFolderDeleted()
  }, [editMode, folders, toast, onFolderDeleted])

  // Edit Mode: 更改顏色（Root 可以改顏色）
  const handleColorChange = useCallback(async (color: string | null) => {
    setShowColorPicker(false)
    const selectedIds = Array.from(editMode.selectedIds)

    for (const folderId of selectedIds) {
      const folder = folders.find(f => f.id === folderId)
      if (!folder || isTrashId(folderId)) continue  // 只排除 Trash，Root 可以改顏色

      const updated = { ...folder, color, updatedAt: Date.now() }
      await db(workspaceId).updateFolder(updated)
    }

    await loadFolders()
    toast.success(`Updated color for ${selectedIds.length} folders`)

    // 選完顏色後自動退出編輯模式
    editMode.exitEditMode()

  }, [editMode, folders, toast])

  // Edit Mode: 開始重命名（只能單選，Root 可以重命名）
  const handleRenameSelected = useCallback(() => {
    if (editMode.selectionCount !== 1) return
    const folderId = Array.from(editMode.selectedIds)[0]
    const folder = folders.find(f => f.id === folderId)
    if (!folder || isTrashId(folderId)) return  // 只排除 Trash，Root 可以重命名

    setEditingFolderId(folderId)
    setEditingName(folder.name)
  }, [editMode.selectedIds, editMode.selectionCount, folders])

  // 共用核心：移動 folders 到目標 folder（swipe 單一 / edit mode 批量共用）
  const moveFolders = useCallback(async (folderIds: string[], targetFolderId: string) => {
    const isRootLevelTarget = targetFolderId === ROOT_LEVEL_TARGET
    const actualParentId = isRootLevelTarget
      ? ROOT_FOLDER_ID
      : targetFolderId

    for (const folderId of folderIds) {
      const folder = folders.find(f => f.id === folderId)
      if (!folder || isTrashId(folderId) || isRootFolderId(folderId)) continue

      const targetChildren = folders.filter(f =>
        f.parentId === actualParentId
      )
      const maxOrder = targetChildren.length > 0
        ? Math.max(...targetChildren.map(f => f.order))
        : -1

      const updated = {
        ...folder,
        parentId: actualParentId,
        order: maxOrder + 1,
        updatedAt: Date.now()
      }
      await db(workspaceId).updateFolder(updated)
    }

    // 展開目標 folder 以顯示移動後的結果（根層級不需展開）
    if (!isRootLevelTarget) {
      setExpandedFolders(prev => {
        const newSet = new Set([...prev, targetFolderId])
        settingsService.saveExpandedFolders(Array.from(newSet))
        return newSet
      })
    }

    await loadFolders()
    setShowMoveDialog(false)

  }, [folders])

  // Move Dialog 的 onSelect handler（判斷來源並做後續處理）
  const handleMoveDialogSelect = useCallback(async (targetFolderId: string) => {
    await moveFolders(moveSourceIds, targetFolderId)

    if (editMode.isEditMode) {
      editMode.exitEditMode()
    }
    toast.success(`Moved ${moveSourceIds.length} folder(s)`)
  }, [moveFolders, moveSourceIds, editMode, toast])

  // 計算要排除的 folder IDs（來源 folders + 所有子孫）
  const getMoveExcludeIds = useCallback((): string[] => {
    const excludeIds = new Set<string>(moveSourceIds)

    // 遞迴收集所有子孫（防止移動到自己的子孫下）
    const collectDescendants = (parentId: string) => {
      folders.filter(f => f.parentId === parentId).forEach(child => {
        excludeIds.add(child.id)
        collectDescendants(child.id)
      })
    }

    moveSourceIds.forEach(id => collectDescendants(id))
    return Array.from(excludeIds)
  }, [moveSourceIds, folders])

  // Edit Mode: 檢查是否選中了系統 folder（Root 或 Trash）
  const hasSystemFolderSelected = useCallback((): boolean => {
    return Array.from(editMode.selectedIds).some(id =>
      isTrashId(id) || isRootFolderId(id)
    )
  }, [editMode.selectedIds])

  // Edit Mode: 全選/取消全選
  const handleToggleSelectAll = useCallback(() => {
    // 取得可選擇的 folder IDs（排除 Trash，但包含 Root）
    const selectableIds = currentWorkspaceFolders
      .filter(f => !isTrashId(f.id))  // Root 可選，只排除 Trash
      .flatMap(f => {
        // 包含所有子資料夾
        const getDescendantIds = (parentId: string): string[] => {
          const children = folders.filter(c => c.parentId === parentId && !isTrashId(c.id))
          return children.flatMap(c => [c.id, ...getDescendantIds(c.id)])
        }
        return [f.id, ...getDescendantIds(f.id)]
      })

    if (editMode.isAllSelected(selectableIds)) {
      editMode.clearSelection()
    } else {
      editMode.selectAll(selectableIds)
    }
  }, [editMode, folders])

  // Edit Mode: 開啟 ColorPicker（居中顯示）
  const handleOpenColorPicker = useCallback(() => {
    setShowColorPicker(true)
  }, [])

  // Edit Mode: 取得當前選中項目的顏色（用於 ColorPicker 顯示）
  const getSelectedColor = useCallback((): string | null => {
    if (editMode.selectionCount === 0) return null
    const firstId = Array.from(editMode.selectedIds)[0]
    const folder = folders.find(f => f.id === firstId)
    return folder?.color || null
  }, [editMode.selectedIds, editMode.selectionCount, folders])

  // Cleanup: 清空 Trash
  const handleCleanupConfirm = useCallback(async () => {
    setShowCleanupConfirm(false)
    try {
      // 清空 Trash 中的所有 folders 和 pages
      const trashFolders = folders.filter(f => f.parentId === TRASH_FOLDER_ID || f.isDeleted)
      for (const f of trashFolders) {
        await permanentlyDeleteFolder(f.id, workspaceId)
      }
      // Cleanup 後自動隱藏 Trash（已清空）
      settingsService.saveSyncedSettings({ showTrash: false })
      await loadFolders()
      await loadPageCounts()
      // 跳回上次選中的 folder
      const lastFolder = settingsService.getSelectedFolder(workspaceId)
      onSelectFolder(lastFolder || ROOT_FOLDER_ID)
      onFolderDeleted?.()
      onPagesChanged?.()
      toast.success('Cleanup done')
    } catch (error) {
      console.error('Cleanup failed:', error)
      toast.error('Cleanup failed')
    }
  }, [toast, onFolderDeleted, onPagesChanged, onSelectFolder, workspaceId, folders])

  // V10: 每個 workspace DB 統一使用 ROOT_FOLDER_ID / TRASH_FOLDER_ID
  const currentRootFolderId = ROOT_FOLDER_ID
  const currentTrashFolderId = TRASH_FOLDER_ID

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) newExpanded.delete(folderId)
    else newExpanded.add(folderId)
    setExpandedFolders(newExpanded)
    settingsService.saveExpandedFolders(Array.from(newExpanded))
  }

  // dnd-kit 拖放處理
  const handleDndDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDndDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    // 找到被拖動的 folder
    const draggedFolder = folders.find(f => f.id === active.id)
    if (!draggedFolder) return

    // 取得同層級的 siblings（排除 Root 和 Trash）
    const siblings = folders
      .filter(f =>
        f.parentId === draggedFolder.parentId &&
        !isTrashId(f.id) &&
        !isRootFolderId(f.id)
      )
      .sort((a, b) => a.order - b.order)

    const oldIndex = siblings.findIndex(f => f.id === active.id)
    const newIndex = siblings.findIndex(f => f.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(siblings, oldIndex, newIndex)
    const timestamp = Date.now()

    // 建立更新後的 siblings（包含新 order）
    const updatedSiblings = reordered.map((folder, index) => ({
      ...folder,
      order: index,
      updatedAt: timestamp
    }))

    // 直接更新本地 state（避免 loadFolders 造成的閃動）
    setFolders(prevFolders => {
      const siblingIds = new Set(updatedSiblings.map(f => f.id))
      // 保留非 siblings 的 folders，替換 siblings
      return prevFolders
        .filter(f => !siblingIds.has(f.id))
        .concat(updatedSiblings)
    })

    // 異步寫入 DB（不 await，不 reload）
    Promise.all(updatedSiblings.map(f => db(workspaceId).updateFolder(f))).then(() => {
    })
  }

  // 取得可排序的 folder IDs（用於 SortableContext）
  // parentId=null 表示頂層，實際對應 root folder 的子層
  const getSortableFolderIds = useCallback((parentId: string | null, level: number = 0): string[] => {
    // 頂層時，需要匹配：
    // 1. parentId === currentRootFolderId 或 ROOT_FOLDER_ID（支援新舊格式）
    // 2. parentId === null（舊格式向後相容）
    // 3. isRootFolder/isTrashFolder 本身
    const isTopLevel = parentId === null

    const children = folders
      .filter(f => {
        if (f.isHidden) return false
        if (f.id === parentId) return false  // 排除自己

        if (isTopLevel) {
          // 頂層顯示：root folder、trash folder、parentId 指向 root folder 的 folders
          if (f.isRootFolder && (f.id === currentRootFolderId || f.id === ROOT_FOLDER_ID)) return true
          if (f.isTrashFolder && (f.id === currentTrashFolderId || f.id === TRASH_FOLDER_ID)) return showTrash
          if (f.parentId === currentRootFolderId || f.parentId === ROOT_FOLDER_ID) return true
          if (f.parentId === null) return true  // 向後相容
          return false
        } else {
          // 非頂層：正常的 parentId 匹配
          return f.parentId === parentId
        }
      })
      .sort((a, b) => {
        // Root folder 永遠在最上方
        if (isRootFolderId(a.id) && !isRootFolderId(b.id)) return -1
        if (!isRootFolderId(a.id) && isRootFolderId(b.id)) return 1
        // Trash 永遠在最下方
        if (isTrashId(a.id) && !isTrashId(b.id)) return 1
        if (!isTrashId(a.id) && isTrashId(b.id)) return -1
        return a.order - b.order
      })

    // 扁平化：當前層級的 folder + 展開的子 folder
    // root folder 不展開（子層已在頂層顯示）
    return children.flatMap(folder => {
      const isRoot = isRootFolderId(folder.id)
      const isExpanded = expandedFolders.has(folder.id)
      const childIds = isExpanded && !isRoot ? getSortableFolderIds(folder.id, level + 1) : []
      return [folder.id, ...childIds]
    })
  }, [folders, expandedFolders, showTrash, currentRootFolderId, currentTrashFolderId])

  // Edit Mode 渲染函數（使用 SortableFolderItem）
  const renderEditModeFolder = (folder: Folder, level: number = 0): React.ReactNode => {
    const isTrash = isTrashId(folder.id)
    const isRoot = isRootFolderId(folder.id)

    // Filter out trash if showTrash is false
    if (isTrash && !showTrash) return null

    // root folder 不顯示子層（子層已在 currentWorkspaceFolders 作為頂層顯示）
    // 其他 folder 正常顯示子層
    const children = isRoot
      ? []
      : folders.filter(f => f.parentId === folder.id && f.id !== folder.id).sort((a, b) => a.order - b.order)
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const isEditing = !isTrash && editingFolderId === folder.id
    const isEditSelected = editMode.isSelected(folder.id)

    // 細粒度權限控制
    const canBeSelected = !isTrash
    const canBeDragged = !isTrash && !isRoot

    // Page Count
    const count = isTrash ? 0 : (pageCounts[folder.id] || 0)

    // Dynamic Color Tab
    const tabColor = isTrash
      ? TRASH_FOLDER_COLOR
      : getDisplayColor(folder.color, folder.id)

    // 點擊處理
    const handleItemClick = () => {
      if (isEditing) return
      if (canBeSelected) {
        editMode.toggleSelect(folder.id)
      }
    }

    return (
      <div key={folder.id}>
        <SortableFolderItem
          folder={folder}
          level={level}
          isSelected={isSelected}
          isEditSelected={isEditSelected}
          pageCount={count}
          isLinked={linkedFolders.has(folder.id)}
          tabColor={tabColor}
          canBeSelected={canBeSelected}
          canBeDragged={canBeDragged}
          isEditing={isEditing}
          editingName={editingName}
          onToggleSelect={() => {
            if (canBeSelected) editMode.toggleSelect(folder.id)
          }}
          onItemClick={handleItemClick}
          onEditNameChange={setEditingName}
          onFinishEdit={() => {
            if (editingName.trim()) {
              handleUpdateFolder(folder, editingName.trim())
            } else {
              setEditingFolderId(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleUpdateFolder(folder, editingName.trim())
            }
          }}
          folderInputRef={folderInputRef}
        />
        {isExpanded && children.length > 0 && (
          <div className="folder-children">
            {children.map(child => renderEditModeFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderFolder = (folder: Folder, level: number = 0) => {
    const isTrash = isTrashId(folder.id)
    const isRoot = isRootFolderId(folder.id)

    // Filter out trash if showTrash is false
    if (isTrash && !showTrash) return null

    // root folder 不顯示子層（子層已在 currentWorkspaceFolders 作為頂層顯示）
    // 其他 folder 正常顯示子層
    const children = isRoot
      ? []
      : folders.filter(f => f.parentId === folder.id && f.id !== folder.id).sort((a, b) => a.order - b.order)
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const isEditing = !isTrash && editingFolderId === folder.id

    // Edit Mode 狀態
    const isInEditMode = editMode.isEditMode
    const isEditSelected = editMode.isSelected(folder.id)
    // 細粒度權限控制
    const canBeSelected = !isTrash                    // Root 可選，Trash 不可選

    // Page Count
    let count = 0
    if (isTrash) {
      // Count not implemented yet for Trash
    } else {
      count = pageCounts[folder.id] || 0
    }

    // Dynamic Color Tab - 使用 getDisplayColor
    const tabColor = isTrash
      ? TRASH_FOLDER_COLOR
      : getDisplayColor(folder.color, folder.id)

    // Trash 裡的 deleted folder（純展示，無操作）
    const isInTrash = !isTrash && !isRoot && folder.isDeleted === true

    // root folder 不顯示箭頭（因為子層已扁平顯示在頂層）
    const showArrow = !isRoot && children.length > 0

    // Edit Mode 點擊處理
    const handleItemClick = () => {
      if (isEditing) return
      // Trash 子 folder 不可點擊（空 folder，無 pages 可顯示）
      if (isInTrash) return

      if (isInEditMode) {
        // Edit Mode：切換選擇狀態（只有 Trash 不可選）
        if (canBeSelected) {
          editMode.toggleSelect(folder.id)
        }
      } else {
        // 正常模式：選擇資料夾
        onSelectFolder(folder.id)
      }
    }

    // Swipe 只在 Portrait 模式啟用（Desktop 用 hover buttons + context menu）
    const canSwipe = isPortraitMode && !isInEditMode && !isEditing && !isInTrash && !(isTrash && isExpanded)

    // Swipe action handlers
    const handleSwipeRename = (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingFolderId(folder.id)
      setEditingName(folder.name)
      swipe.closeSwipe()
    }

    const handleSwipeMove = (e: React.MouseEvent) => {
      e.stopPropagation()
      setMoveSourceIds([folder.id])
      setShowMoveDialog(true)
      swipe.closeSwipe()
    }

    return (
      <div key={folder.id} className="folder-wrapper" style={{ position: 'relative', overflow: canSwipe ? 'hidden' : undefined, opacity: isInTrash ? 0.5 : undefined }}>
        {/* Swipe Actions (Behind) - 只在正常模式顯示 */}
        {canSwipe && (
          <div
            className="folder-swipe-actions"
            style={{
              position: 'absolute', top: 0, bottom: 0, right: 0, width: isTrash ? '100px' : '140px',
              display: 'flex', zIndex: 1
            }}
          >
            {isTrash ? (
              <button
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  swipe.closeSwipe()
                  setShowCleanupConfirm(true)
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
              >
                Cleanup
              </button>
            ) : (<>
            {!isRoot && (
              <button
                onClick={handleSwipeMove}
                style={{ flex: 1, backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
              >
                Move
              </button>
            )}
            <button
              onClick={handleSwipeRename}
              style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}
            >
              Rename
            </button>
            </>)}
          </div>
        )}

        {/* Main Content Layer */}
        <div
          className={`folder-item ${isSelected && !isInEditMode ? 'selected' : ''} ${isInEditMode ? 'edit-mode' : ''} ${isEditSelected ? 'edit-selected' : ''}`}
          style={{
            // Edit Mode 時增加左側空間給 Checkbox
            paddingLeft: isInEditMode ? `${level * 12 + 48}px` : `${level * 12 + 16}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: '8px',
            position: 'relative',
            background: isEditSelected
              ? 'var(--bg-edit-selected)'
              : isSelected && !isInEditMode
                ? 'var(--bg-selected)'
                : 'var(--bg-folder)',
            borderBottom: '1px solid var(--border-light)',
            ...(canSwipe ? { zIndex: 2, ...swipe.getSwipeStyle(folder.id) } : {}),
          }}
          onClick={handleItemClick}
          onContextMenu={(e: React.MouseEvent) => {
            if (!isPortraitMode && !isInEditMode && !isInTrash) {
              e.preventDefault()
              swipe.closeSwipe()
              setContextMenu({ folderId: folder.id, position: { x: e.clientX, y: e.clientY } })
            }
          }}
          {...(canSwipe ? {
            onTouchStart: (e: React.TouchEvent) => swipe.handleTouchStart(e, folder.id),
            onTouchMove: (e: React.TouchEvent) => swipe.handleTouchMove(e, folder.id),
            onTouchEnd: () => swipe.handleTouchEnd(folder.id),
          } : {})}
        >
          {/* Edit Mode Checkbox */}
          {isInEditMode && (
            <div
              className={`edit-mode-checkbox ${isEditSelected ? 'selected' : ''} ${!canBeSelected ? 'disabled' : ''}`}
              style={{
                position: 'absolute',
                left: `${level * 12 + 16}px`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (canBeSelected) editMode.toggleSelect(folder.id)
              }}
            >
              <span className="edit-mode-checkbox-check">✓</span>
            </div>
          )}

          {/* Colored Tab - Indented with Level */}
          <div style={{
            position: 'absolute',
            left: isInEditMode ? `${level * 12 + 44}px` : `${level * 12 + 4}px`,
            top: '4px',
            bottom: '4px',
            width: '6px',
            backgroundColor: tabColor,
            borderRadius: '3px',
            transition: 'left 0.2s ease-out',
          }} />
          {/* Content */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', marginLeft: '6px' }}>
            {isEditing ? (
              <input
                ref={folderInputRef}
                type="text"
                className="folder-name-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => { if (editingName.trim()) handleUpdateFolder(folder, editingName.trim()); else setEditingFolderId(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateFolder(folder, editingName.trim()) }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{ marginLeft: '8px' }}  /* fontSize 由 CSS class 控制 */
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px' }}>
                <span className="folder-name" style={{
                  fontWeight: '500',
                  /* fontSize 由 CSS class 控制 */
                  color: 'var(--text-primary)'
                }}>
                  {folder.name}
                </span>
                {count > 0 && (
                  <span style={{
                    marginLeft: '6px',
                    fontSize: 'var(--interface-font-size)',
                    color: 'var(--text-muted)'
                  }}>
                    ({count})
                  </span>
                )}
                {linkedFolders.has(folder.id) && (
                  <span style={{ marginLeft: '4px', display: 'inline-flex', color: '#3b82f6' }}
                        title="Linked to local directory">
                    <IconLink45deg size={20} />
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Hover Action Buttons - Desktop only, 排除 Trash 及其子 folder */}
          {!isPortraitMode && !isInEditMode && !isTrash && !isInTrash && !isEditing && (
            <div className="folder-actions">
              {!isRoot && (
                <button
                  className="folder-action-btn"
                  title="Move"
                  onClick={handleSwipeMove}
                >
                  <IconFolderSymlink size={14} />
                </button>
              )}
              <button
                className="folder-action-btn"
                title="Rename"
                onClick={handleSwipeRename}
              >
                <IconType size={14} />
              </button>
            </div>
          )}

          {/* Arrow - 編輯模式下隱藏 */}
          {!isInEditMode && (
            <div
              className="folder-arrow"
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '12px',
                visibility: showArrow ? 'visible' : 'hidden'
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (showArrow) toggleFolder(folder.id)
              }}
            >
              {isExpanded ? <ChevronDown size={22} strokeWidth={2.5} /> : <ChevronRight size={22} strokeWidth={2.5} />}
            </div>
          )}

        </div>

        {isExpanded && children.length > 0 && (
          <div className="folder-children">
            {children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // 取得當前 DB 的所有 root-level folders（包含 root folder 本身）
  // V10: DB 本身就是 workspace identity，不需要 workspaceId 過濾
  const currentWorkspaceFolders = folders
    .filter(f => {
      // 只顯示指定 workspace 的資料夾
      // 不顯示隱藏的
      if (f.isHidden) return false

      // 顯示頂層 folder 的條件：
      // 1. root folder 本身（支援新舊 ID 格式）
      if (f.isRootFolder && (f.id === currentRootFolderId || f.id === ROOT_FOLDER_ID)) return true
      // 2. trash folder 本身（支援新舊 ID 格式）
      if (f.isTrashFolder && (f.id === currentTrashFolderId || f.id === TRASH_FOLDER_ID)) return true
      // 3. parentId === null（向後相容舊資料）
      if (f.parentId === null) return true
      // 4. parentId 指向 root folder（支援新舊格式）
      if (f.parentId === currentRootFolderId || f.parentId === ROOT_FOLDER_ID) return true

      return false
    })
    .sort((a, b) => {
      // Root folder 永遠在最上方
      if (isRootFolderId(a.id) && !isRootFolderId(b.id)) return -1
      if (!isRootFolderId(a.id) && isRootFolderId(b.id)) return 1
      // Trash 永遠在最下方
      const isTrashA = isTrashId(a.id)
      const isTrashB = isTrashId(b.id)
      if (isTrashA && !isTrashB) return 1
      if (!isTrashA && isTrashB) return -1
      // 其餘按 order 排序
      return a.order - b.order
    })

  // 移除 LoadingSpinner：初始化極快（<150ms），用戶幾乎無感
  // isLoading 狀態保留，可用於其他用途

  // Edit Mode 操作按鈕
  const editModeActions: ActionButton[] = [
    {
      id: 'move',
      icon: <IconFolderSymlink size={20} />,
      label: 'Move',
      onClick: () => { setMoveSourceIds(Array.from(editMode.selectedIds)); setShowMoveDialog(true) },
      disabled: !editMode.hasSelection || hasSystemFolderSelected(),
    },
    {
      id: 'color',
      icon: <IconDropletFill size={20} />,
      label: 'Color',
      onClick: handleOpenColorPicker,
      disabled: !editMode.hasSelection,
    },
    {
      id: 'rename',
      icon: <IconType size={20} />,
      label: 'Rename',
      onClick: handleRenameSelected,
      disabled: editMode.selectionCount !== 1,  // 只能單選重命名
    },
    {
      id: 'delete',
      icon: <IconTrash size={20} />,
      label: 'Delete',
      onClick: () => setShowDeleteConfirm(true),
      disabled: !editMode.hasSelection,
      variant: 'danger',
    },
  ]

  // === File Link handlers ===
  const handleLinkDirectory = async (folderId: string) => {
    try {
      const result = await linkDirectoryToFolder(folderId, workspaceId)
      if (!result) { toast.warning('連結失敗'); return }
      loadLinkedFolders()
      await loadFolders()
      const parts = []
      if (result.matched > 0) parts.push(`匹配 ${result.matched}`)
      if (result.imported > 0) parts.push(`匯入 ${result.imported}`)
      if (result.exported > 0) parts.push(`匯出 ${result.exported}`)
      toast.success(parts.length > 0 ? `已連結：${parts.join('、')}` : '已連結')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      console.error('Failed to link directory:', e)
      toast.warning('連結目錄失敗')
    }
  }

  const handleSyncDirectory = async (folderId: string) => {
    try {
      const result = await rescanLinkedFolder(folderId, workspaceId, { silent: false })
      if (!result) { toast.warning('同步失敗'); return }
      const parts = []
      if (result.pulledNew > 0) parts.push(`匯入 ${result.pulledNew}`)
      if (result.pushedNew > 0) parts.push(`匯出 ${result.pushedNew}`)
      if (result.pulled > 0) parts.push(`拉取 ${result.pulled}`)
      if (result.pushed > 0) parts.push(`推送 ${result.pushed}`)
      if (result.conflictCount > 0) parts.push(`衝突 ${result.conflictCount}`)
      if (parts.length > 0) {
        toast.success(`完成：${parts.join('、')}`)
        await loadFolders()
        onPagesChanged?.()
      } else {
        toast.success('已是最新')
      }
    } catch (e: any) {
      console.error('Failed to sync directory:', e)
      toast.warning('同步目錄失敗')
    }
  }

  // Context Menu: 根據 folder 狀態建立選單項目
  const getContextMenuItems = useCallback((folderId: string | null): ContextMenuEntry[] => {
    // 空白區域右鍵：只顯示 New Folder / Select
    if (folderId === null) {
      return [
        {
          id: 'new-folder',
          label: 'New Folder',
          icon: <IconFolderPlus size={16} />,
          onClick: () => handleCreateFolder(null),
        },
        {
          id: 'select',
          label: 'Select',
          icon: <IconFolderCheck size={16} />,
          onClick: () => editMode.enterEditMode('folder'),
        },
      ]
    }

    const folder = folders.find(f => f.id === folderId)
    if (!folder) return []

    const isRoot = isRootFolderId(folderId)
    const isTrash = isTrashId(folderId)

    // Trash folder 專用選單
    if (isTrash) {
      return [{
        id: 'cleanup',
        label: 'Cleanup',
        icon: <IconTrash size={16} />,
        variant: 'danger' as const,
        onClick: () => {
          setShowCleanupConfirm(true)
        },
      }]
    }

    const items: ContextMenuEntry[] = []

    // New Folder / Add Subfolder
    // Root folder 的「子 folder」其實就是頂層 folder，顯示為 New Folder
    items.push({
      id: 'add-subfolder',
      label: isRoot ? 'New Folder' : 'Add Subfolder',
      icon: <IconFolderPlus size={16} />,
      onClick: () => handleCreateFolder(folderId),
    })

    // Move（非 Root）
    if (!isRoot) {
      items.push({
        id: 'move',
        label: 'Move',
        icon: <IconFolderSymlink size={16} />,
        onClick: () => {
          setMoveSourceIds([folderId])
          setShowMoveDialog(true)
        },
      })
    }

    // Select：進入 edit mode 並預先勾選當前 folder
    items.push({
      id: 'select',
      label: 'Select',
      icon: <IconFolderCheck size={16} />,
      onClick: () => {
        editMode.enterEditMode('folder')
        editMode.toggleSelect(folderId)
      },
    })

    // Link / Sync Directory（非 Root、支援 File Handle API）
    if (!isRoot && isFileHandleSupported()) {
      if (linkedFolders.has(folderId)) {
        items.push({
          id: 'sync-directory',
          label: 'Sync Directory',
          icon: <IconLink45deg size={16} />,
          onClick: () => handleSyncDirectory(folderId),
        })
      } else {
        items.push({
          id: 'link-directory',
          label: 'Link Directory',
          icon: <IconLink45deg size={16} />,
          onClick: () => handleLinkDirectory(folderId),
        })
      }
    }

    // Separator + Delete（非 Root）
    if (!isRoot) {
      items.push({ type: 'separator' as const })
      items.push({
        id: 'delete',
        label: 'Delete',
        icon: <IconTrash size={16} />,
        variant: 'danger' as const,
        onClick: () => {
          editMode.enterEditMode('folder')
          editMode.toggleSelect(folderId)
          setTimeout(() => setShowDeleteConfirm(true), 0)
        },
      })
    }

    // Separator + Info（最底部，Root 與 normal folder 都顯示）
    items.push({ type: 'separator' as const })
    items.push({
      id: 'info',
      label: 'Info',
      icon: <IconInfoCircle size={16} />,
      onClick: () => {
        setInfoTarget(folder)
        setInfoFolderStats(null)  // 重置，交由 useEffect 異步載入
        setInfoLinkPath(null)
      },
    })

    return items
  }, [folders, editMode, linkedFolders])

  // Info Dialog：非同步載入 folder 統計（pages / subfolders / total pages）
  useEffect(() => {
    if (!infoTarget) return
    let cancelled = false
    const target = infoTarget
    ;(async () => {
      try {
        const [directPages, subfolders] = await Promise.all([
          db(workspaceId).getPagesByFolder(target.id),
          collectSubfolders(target.id, workspaceId),
        ])
        // 排除 Trash 子樹（若 target 不是 Trash 本身）
        const filteredSubs = isTrashId(target.id)
          ? subfolders
          : subfolders.filter(f => !isTrashId(f.id))
        const allFolderIds = [target.id, ...filteredSubs.map(f => f.id)]
        const allPagesArrays = await Promise.all(
          allFolderIds.map(id => db(workspaceId).getPagesByFolder(id))
        )
        if (cancelled) return
        // 計算直接子 folder（不含遞迴，排除 Trash）
        const directSubfolders = folders.filter(f =>
          f.parentId === target.id && !isTrashId(f.id)
        ).length
        const totalSize = allPagesArrays
          .flat()
          .reduce((sum, p) => sum + new Blob([p.content || '']).size, 0)
        setInfoFolderStats({
          directPages: directPages.length,
          totalPages: allPagesArrays.reduce((sum, arr) => sum + arr.length, 0),
          totalSize,
          directSubfolders,
        })
        // 載入 linked 目錄路徑
        if (linkedFolders.has(target.id)) {
          const folderLink = await getFolderDirLink(target.id)
          if (folderLink && !cancelled) {
            const dirEntry = await getDirHandle(folderLink.handleId)
            if (dirEntry && !cancelled) {
              const fullPath = folderLink.subPath
                ? `${dirEntry.dirName}/${folderLink.subPath}`
                : dirEntry.dirName
              setInfoLinkPath(fullPath)
            }
          }
        }
      } catch (err) {
        console.error('[InfoDialog] Failed to load folder stats:', err)
      }
    })()
    return () => { cancelled = true }
  }, [infoTarget, workspaceId, folders, linkedFolders])

  // Helpers（Info Dialog 專用，inline 在此檔案中）
  const fmtFull = (ts: number) => new Date(ts).toLocaleString()
  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(2)} MB`
  }
  // 組合 folder 路徑：Root › A › B（不含當前 folder 自己）
  const getFolderLocation = (folder: Folder): string => {
    if (isRootFolderId(folder.id)) return '—'
    const chain: string[] = []
    let cur: Folder | undefined = folder.parentId
      ? folders.find(f => f.id === folder.parentId)
      : undefined
    while (cur) {
      chain.unshift(cur.name)
      cur = cur.parentId ? folders.find(f => f.id === cur!.parentId) : undefined
    }
    return chain.length > 0 ? chain.join(' › ') : '—'
  }

  const buildFolderInfoRows = (folder: Folder): InfoRow[] => {
    const rows: InfoRow[] = []
    rows.push({ label: 'Location', value: getFolderLocation(folder) })
    rows.push({ label: 'Created', value: fmtFull(folder.createdAt) })
    rows.push({ label: 'Modified', value: fmtFull(folder.updatedAt) })
    rows.push({
      label: 'Pages',
      value: infoFolderStats ? String(infoFolderStats.directPages) : '…',
    })
    rows.push({
      label: 'Subfolders',
      value: infoFolderStats ? String(infoFolderStats.directSubfolders) : '…',
    })
    rows.push({
      label: 'Size',
      value: infoFolderStats
        ? `${fmtBytes(infoFolderStats.totalSize)} / ${infoFolderStats.totalPages} ${infoFolderStats.totalPages === 1 ? 'Page' : 'Pages'}`
        : '…',
    })
    if (linkedFolders.has(folder.id)) {
      rows.push({ label: 'Linked 🔗', value: infoLinkPath ?? '…' })
    }
    return rows
  }

  // 計算是否全選（排除 Trash，但包含 Root）
  const selectableFolderIds = (() => {
    const collectIds = (parentId: string | null): string[] => {
      return folders
        .filter(f =>
          f.parentId === parentId &&
          !isTrashId(f.id)  // Root 可選，只排除 Trash
        )
        .flatMap(f => [f.id, ...collectIds(f.id)])
    }
    return collectIds(null)
  })()

  return (
    <div className={`folder-tree ${editMode.isEditMode ? 'in-edit-mode' : ''}`}>

      {/* Folder 列表 */}
      <div
        ref={swipe.containerRef}
        className="folder-tree-body"
        style={{ overflowY: 'auto', flex: 1 }}
        onClick={(e) => {
          // Edit Mode 時，點擊空白區域（非 folder-item）退出
          if (editMode.isEditMode) {
            const target = e.target as HTMLElement
            // 只有點擊 folder-tree-body 自身（空白區域）時才退出
            if (!target.closest('.folder-item') && !target.closest('.folder-wrapper')) {
              editMode.exitEditMode()
            }
          }
        }}
        onContextMenu={(e) => {
          // Desktop 才支援右鍵，Edit Mode 時停用
          if (isPortraitMode || editMode.isEditMode) return
          // 若點擊目標在 folder-item 內，交由 folder-item 自己處理
          const target = e.target as HTMLElement
          if (target.closest('.folder-item') || target.closest('.folder-wrapper')) return
          e.preventDefault()
          swipe.closeSwipe()
          setContextMenu({ folderId: null, position: { x: e.clientX, y: e.clientY } })
        }}
      >
        {editMode.isEditMode ? (
          // Edit Mode: 使用 dnd-kit
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDndDragStart}
            onDragEnd={handleDndDragEnd}
          >
            <SortableContext
              items={getSortableFolderIds(null)}
              strategy={verticalListSortingStrategy}
            >
              {currentWorkspaceFolders.map(folder => renderEditModeFolder(folder))}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId && (
                <div className="folder-drag-preview">
                  {folders.find(f => f.id === activeId)?.name || 'Folder'}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          // 正常模式：靜態渲染
          currentWorkspaceFolders.map(folder => renderFolder(folder))
        )}
      </div>

      {/* Edit Mode Bottom Bar（合併控制列和操作列） */}
      {editMode.isEditMode && (
        <EditModeBottomBar
          isAllSelected={editMode.isAllSelected(selectableFolderIds)}
          onDone={() => editMode.exitEditMode()}
          onToggleSelectAll={handleToggleSelectAll}
          actions={editModeActions}
          isDragging={editMode.dragState.isDragging}
        />
      )}

      {/* Move Dialog */}
      <FolderPickerDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        onSelect={handleMoveDialogSelect}
        currentFolderId={(() => {
          // 判斷所有來源 folders 是否都在同一個 parent
          const parents = moveSourceIds
            .map(id => folders.find(f => f.id === id)?.parentId)
            .filter(Boolean)
          const allSameParent = parents.length > 0 && parents.every(p => p === parents[0])
          return allSameParent ? parents[0]! : null
        })()}
        sourceWorkspaceId={workspaceId}
        excludeIds={getMoveExcludeIds()}
        title="Move to Folder"
      />

      {/* Color Picker */}
      <ColorPicker
        isOpen={showColorPicker}
        currentColor={getSelectedColor()}
        anchorRect={colorPickerAnchor}
        onSelect={handleColorChange}
        onClose={() => setShowColorPicker(false)}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Folders"
        message={`Are you sure you want to delete ${editMode.selectionCount} folders? Folders with non-empty pages will be skipped.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        icon="🗑️"
        onConfirm={handleBatchDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Cleanup Confirm Dialog */}
      <ConfirmDialog
        isOpen={showCleanupConfirm}
        title="Cleanup"
        message="This will empty trash, remove orphan data and duplicated images. Continue?"
        confirmText="Cleanup"
        cancelText="Cancel"
        variant="danger"
        icon="🧹"
        onConfirm={handleCleanupConfirm}
        onCancel={() => setShowCleanupConfirm(false)}
      />

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu !== null}
        position={contextMenu?.position ?? { x: 0, y: 0 }}
        items={contextMenu ? getContextMenuItems(contextMenu.folderId) : []}
        onClose={() => setContextMenu(null)}
      />

      {/* Info Dialog：顯示 folder metadata */}
      <InfoDialog
        isOpen={infoTarget !== null}
        title={infoTarget?.name ?? ''}
        icon={<IconFolderPlus size={18} />}
        rows={infoTarget ? buildFolderInfoRows(infoTarget) : []}
        onClose={() => {
          setInfoTarget(null)
          setInfoFolderStats(null)
          setInfoLinkPath(null)
        }}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
})

export default FolderTree