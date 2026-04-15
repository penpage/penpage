/**
 * WorkspaceList - Workspace 選擇列表
 * 開源版：僅顯示 Local workspace
 */

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react'
import { getRootFolderName } from '../services/rootFolders'
import { WorkspaceIcon } from './WorkspaceIcon'
import { WorkspaceId } from '../types/workspace'
import { IconThreeDots, IconDropletFill } from './icons/BootstrapIcons'
import WorkspaceMenu from './WorkspaceMenu'
import { useEditMode } from '../hooks/useEditMode'
import { useEditModeClickOutside } from '../hooks/useEditModeClickOutside'
import EditModeBottomBar from './EditModeBottomBar'
import ColorPicker from './ColorPicker'
import { ActionButton } from './BottomActionBar'
import { settingsService } from '../services/settings'
import { getDisplayColor } from '../config/colors'
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
import { SortableWorkspaceItem } from './SortableWorkspaceItem'

interface WorkspaceListProps {
  currentWorkspaceId: WorkspaceId
  onSelect: (workspaceId: WorkspaceId) => void
  refreshKey?: number
}

interface WorkspaceInfo {
  id: WorkspaceId
  name: string
  subtitle: string | null
}

// Ref 介面，供外部呼叫
export interface WorkspaceListRef {
  enterEditMode: () => void
  exitEditMode: () => void
}

const WorkspaceList = forwardRef<WorkspaceListRef, WorkspaceListProps>(({
  currentWorkspaceId,
  onSelect,
  refreshKey
}, ref) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([])
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)

  // Edit Mode
  const editMode = useEditMode()
  const [workspaceColors, setWorkspaceColors] = useState<Record<string, string>>({})
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Drag and Drop
  const [activeId, setActiveId] = useState<string | null>(null)
  const [workspaceOrder, setWorkspaceOrder] = useState<string[]>(['local'])

  // Sensors（與 PageList 相同設定）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } })
  )

  // 暴露 ref 方法
  useImperativeHandle(ref, () => ({
    enterEditMode: () => editMode.enterEditMode('workspace'),
    exitEditMode: () => editMode.exitEditMode()
  }))

  // 載入顏色和順序設定
  useEffect(() => {
    const settings = settingsService.getSyncedSettings()
    setWorkspaceColors(settings.workspaceColors || {})
    const order = settings.workspaceOrder || ['local']
    setWorkspaceOrder(order)
  }, [])

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showHeaderMenu && !target.closest('.workspace-list-header-menu-container')) {
        setShowHeaderMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showHeaderMenu])

  // Edit Mode 的 click outside 邏輯
  useEditModeClickOutside(editMode.isEditMode, editMode.exitEditMode, '.workspace-list')

  // 外部資料變化時自動退出 Edit Mode
  useEffect(() => {
    if (editMode.isEditMode && refreshKey !== undefined && refreshKey > 0) {
      editMode.exitEditMode()
    }
  }, [refreshKey])

  // 載入 Workspace 資訊
  useEffect(() => {
    const loadWorkspaces = async () => {
      const localName = await getRootFolderName('local')

      const list: WorkspaceInfo[] = [
        {
          id: 'local',
          name: localName,
          subtitle: 'Local'
        }
      ]

      setWorkspaces(list)
    }
    loadWorkspaces()
  }, [])

  const handleSelect = (workspaceId: WorkspaceId) => {
    onSelect(workspaceId)
  }

  // Header 選單按鈕點擊
  const handleHeaderMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowHeaderMenu(!showHeaderMenu)
  }

  // 進入 Edit Mode
  const handleEnterEditMode = useCallback(() => {
    setShowHeaderMenu(false)
    editMode.enterEditMode('workspace')
  }, [editMode])

  // 根據 workspaceOrder 排序
  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => {
      const indexA = workspaceOrder.indexOf(a.id)
      const indexB = workspaceOrder.indexOf(b.id)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }, [workspaces, workspaceOrder])

  // 儲存順序
  const saveWorkspaceOrder = useCallback((order: string[]) => {
    settingsService.saveSyncedSettings({ workspaceOrder: order })
    setWorkspaceOrder(order)
  }, [])

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = workspaceOrder.indexOf(active.id as string)
    const newIndex = workspaceOrder.indexOf(over.id as string)
    const newOrder = arrayMove(workspaceOrder, oldIndex, newIndex)
    saveWorkspaceOrder(newOrder)
  }, [workspaceOrder, saveWorkspaceOrder])

  // 顏色變更處理
  const handleColorChange = useCallback((color: string | null) => {
    const selectedIds = Array.from(editMode.selectedIds)
    const newColors = { ...workspaceColors }

    for (const wsId of selectedIds) {
      if (color) {
        newColors[wsId] = color
      } else {
        delete newColors[wsId]
      }
    }

    settingsService.saveSyncedSettings({ workspaceColors: newColors })
    setWorkspaceColors(newColors)
    setShowColorPicker(false)
    editMode.exitEditMode()
  }, [editMode, workspaceColors])

  // 取得選中項目的顏色
  const getSelectedColor = useCallback(() => {
    if (editMode.selectionCount !== 1) return null
    const selectedId = Array.from(editMode.selectedIds)[0]
    return workspaceColors[selectedId] || null
  }, [editMode.selectedIds, editMode.selectionCount, workspaceColors])

  // 全選切換
  const handleToggleSelectAll = useCallback(() => {
    const allIds = workspaces.map(w => w.id)
    if (editMode.isAllSelected(allIds)) {
      editMode.clearSelection()
    } else {
      editMode.selectAll(allIds)
    }
  }, [workspaces, editMode])

  // Edit Mode 操作按鈕
  const editModeActions: ActionButton[] = [
    {
      id: 'color',
      icon: <IconDropletFill size={20} />,
      label: 'Color',
      onClick: () => setShowColorPicker(true),
      disabled: !editMode.hasSelection,
    },
  ]

  return (
    <div className={`workspace-list ${editMode.isEditMode ? 'in-edit-mode' : ''}`}>
      {/* PenPage 標題 Header */}
      <div className="workspace-list-header">
        <div className="workspace-list-header-spacer"></div>
        <div className="workspace-list-header-left">
          <img src="/ppage2.png" alt="PenPage" className="workspace-list-logo" />
          <span className="workspace-list-title">PenPage</span>
        </div>
        {!editMode.isEditMode && (
          <div className="workspace-list-header-menu-container">
            <button
              className="workspace-list-header-menu-btn"
              onClick={handleHeaderMenuClick}
              title="More options"
            >
              <IconThreeDots size={24} />
            </button>
            {showHeaderMenu && (
              <div className="workspace-list-header-menu">
                <WorkspaceMenu
                  onClose={() => setShowHeaderMenu(false)}
                  onCreateWorkspace={() => {}}
                  onEditWorkspace={handleEnterEditMode}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workspace 列表 */}
      <div
        className="workspace-list-body"
        onClick={(e) => {
          if (editMode.isEditMode) {
            const target = e.target as HTMLElement
            if (!target.closest('.workspace-item') && !target.closest('.workspace-item-wrapper')) {
              editMode.exitEditMode()
            }
          }
        }}
      >
        {editMode.isEditMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={workspaceOrder}
              strategy={verticalListSortingStrategy}
            >
              {sortedWorkspaces.map(workspace => {
                const customColor = workspaceColors[workspace.id]
                const displayColor = getDisplayColor(customColor, workspace.id)

                return (
                  <SortableWorkspaceItem
                    key={workspace.id}
                    workspace={workspace}
                    isSelected={workspace.id === currentWorkspaceId}
                    isEditSelected={editMode.isSelected(workspace.id)}
                    displayColor={displayColor}
                    customColor={customColor}
                    onToggleSelect={() => editMode.toggleSelect(workspace.id)}
                    onSelect={() => handleSelect(workspace.id)}
                  />
                )
              })}
            </SortableContext>
            <DragOverlay>
              {activeId && (
                <div className="workspace-drag-preview">
                  {workspaces.find(w => w.id === activeId)?.name || 'Workspace'}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          sortedWorkspaces.map(workspace => {
            const customColor = workspaceColors[workspace.id]

            return (
              <div
                key={workspace.id}
                className={`workspace-list-item ${workspace.id === currentWorkspaceId ? 'selected' : ''}`}
                onClick={() => handleSelect(workspace.id)}
              >
                <div className="workspace-list-item-avatar">
                  <WorkspaceIcon
                    workspaceId={workspace.id}
                    customColor={customColor}
                  />
                </div>
                <div className="workspace-list-item-info">
                  <span className="workspace-list-item-name">{workspace.name}</span>
                  {workspace.subtitle && (
                    <span className="workspace-list-item-subtitle">{workspace.subtitle}</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Edit Mode Bottom Bar */}
      {editMode.isEditMode && (
        <EditModeBottomBar
          isAllSelected={editMode.isAllSelected(workspaces.map(w => w.id))}
          onDone={() => editMode.exitEditMode()}
          onToggleSelectAll={handleToggleSelectAll}
          actions={editModeActions}
          isDragging={!!activeId}
        />
      )}

      {/* Color Picker */}
      <ColorPicker
        isOpen={showColorPicker}
        currentColor={getSelectedColor()}
        anchorRect={null}
        onSelect={handleColorChange}
        onClose={() => setShowColorPicker(false)}
      />
    </div>
  )
})

WorkspaceList.displayName = 'WorkspaceList'

export default WorkspaceList
