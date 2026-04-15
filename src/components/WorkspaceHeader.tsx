/**
 * WorkspaceHeader - Sidebar 頂部的 Workspace 資訊 Header
 * 顯示當前 Workspace 資訊，點擊可展開 Workspace 選擇器
 * 包含選單功能：新增資料夾、編輯資料夾、清理
 * （New Page / Edit Pages 已移至 PageList 右鍵選單）
 */

import { useState, useEffect } from 'react'
import { settingsService } from '../services/settings'
import { getRootFolderName } from '../services/rootFolders'
import { WorkspaceId } from '../types/workspace'
import { WorkspaceIcon } from './WorkspaceIcon'
import { ChevronUp, ChevronDown, ChevronLeft } from './icons/ChevronIcons'
import {
  IconThreeDots,
  IconSort,
  IconCheck,
  IconSortDown,
  IconSortUp
} from './icons/BootstrapIcons'
import WorkspaceMenu from './WorkspaceMenu'

interface WorkspaceHeaderProps {
  workspaceId: WorkspaceId
  isExpanded: boolean  // Workspace List 是否展開
  onToggle: () => void
  // 返回按鈕（Landscape LF/LP 模式）
  showBackButton?: boolean
  onBack?: () => void
  // currentView 控制選單項目（取代舊的 showFolderOptions）
  currentView?: 'W' | 'F' | 'P' | 'E' | 'S'
  // Workspace 相關 callbacks（placeholder）
  onCreateWorkspace?: () => void
  onEditWorkspace?: () => void
  // 排序變更 callback
  onSortChange?: () => void
  refreshTrigger?: number
  // Folder 變動後刷新 workspace name（本地改名等）
  folderRefreshKey?: number
}

type SortBy = 'none' | 'updatedAt' | 'createdAt' | 'name'
type SortOrder = 'asc' | 'desc'

const WorkspaceHeader = ({
  workspaceId,
  isExpanded,
  onToggle,
  showBackButton,
  onBack,
  currentView = 'F',
  onCreateWorkspace,
  onEditWorkspace,
  onSortChange,
  refreshTrigger,
  folderRefreshKey
}: WorkspaceHeaderProps) => {
  const [rootFolderName, setRootFolderName] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)

  // 排序狀態：sortBy 持久化，sortOrder 每次載入重置為 desc
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const saved = settingsService.getPageSort()
    // 重置 sortOrder 為 desc（實現「不記憶升降序」）
    settingsService.savePageSort(saved.sortBy, 'desc')
    return saved.sortBy as SortBy
  })
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // 載入 Root Folder 名稱
  useEffect(() => {
    getRootFolderName(workspaceId).then(setRootFolderName)
  }, [workspaceId, refreshTrigger, folderRefreshKey])

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showMenu && !target.closest('.workspace-header-menu-container')) {
        setShowMenu(false)
      }
      if (showSortMenu && !target.closest('.workspace-header-sort-container')) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMenu, showSortMenu])

  // 處理選單按鈕點擊
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()  // 防止觸發 Header 的 toggle
    setShowMenu(!showMenu)
    setShowSortMenu(false)
  }

  // 處理排序選單按鈕點擊
  const handleSortMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowSortMenu(!showSortMenu)
    setShowMenu(false)
  }

  // 取得排序圖標
  const getSortIcon = () => {
    if (sortBy === 'none') return null
    return sortOrder === 'desc' ? <IconSortDown size={12} /> : <IconSortUp size={12} />
  }

  // 處理排序選項點擊
  const handleSortSelect = (newSortBy: SortBy) => {
    if (newSortBy === 'none') {
      // 手動排序：重複點擊不變
      if (sortBy === 'none') return
      setSortBy('none')
      setSortOrder('desc')
      settingsService.savePageSort('none', 'desc')
    } else {
      // 字母/日期排序
      if (sortBy === newSortBy) {
        // 同一選項：toggle 升降序
        const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
        setSortOrder(newOrder)
        settingsService.savePageSort(newSortBy, newOrder)
      } else {
        // 不同選項：Alphabetical 預設 A→Z (asc)，日期排序預設最新在前 (desc)
        setSortBy(newSortBy)
        const defaultOrder = newSortBy === 'name' ? 'asc' : 'desc'
        setSortOrder(defaultOrder)
        settingsService.savePageSort(newSortBy, defaultOrder)
      }
    }
    onSortChange?.()
  }

  // 取得次要文字
  const getSubtitle = () => {
    if (workspaceId === 'local') {
      return 'Local'
    }
    return null
  }

  const subtitle = getSubtitle()

  return (
    <div className="workspace-header" onClick={onToggle}>
      {/* 左側：返回按鈕（LF/LP 模式） */}
      <div className="workspace-header-left">
        {showBackButton && (
          <button
            className="workspace-header-back-btn"
            onClick={(e) => {
              e.stopPropagation()
              onBack?.()
            }}
            title="Back"
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* 中央：icon + 名稱 + 副標題 + chevron（置中） */}
      <div className="workspace-header-center">
        <WorkspaceIcon workspaceId={workspaceId} size={36} />
        <span className="workspace-header-name">{rootFolderName}</span>
        {subtitle && (
          <span className="workspace-header-subtitle">{subtitle}</span>
        )}
        <span className="workspace-header-chevron">
          {isExpanded ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
        </span>
      </div>

      {/* 右側：排序 + 選單 */}
      <div className="workspace-header-right">
        {/* 排序按鈕（只在 F/P 視圖顯示，W 視圖只用手動排序） */}
        {currentView !== 'W' && (
          <div className="workspace-header-sort-container" style={{ position: 'relative' }}>
            <button
              className="workspace-header-sort-btn"
              onClick={handleSortMenuClick}
              title="Sort"
            >
              <IconSort size={16} />
            </button>
            {/* 排序下拉選單 */}
            {showSortMenu && (
              <div
                className="page-sort-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  minWidth: '160px',
                  zIndex: 1000
                }}
              >
                {/* 手動排序 */}
                <button
                  className={`sort-menu-item ${sortBy === 'none' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSortMenu(false)
                    handleSortSelect('none')
                  }}
                >
                  <span className="sort-menu-indicator">
                    {sortBy === 'none' && <IconCheck size={14} />}
                  </span>
                  Manual
                </button>

                {/* 字母 */}
                <button
                  className={`sort-menu-item ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSortMenu(false)
                    handleSortSelect('name')
                  }}
                >
                  <span className="sort-menu-indicator">
                    {sortBy === 'name' && getSortIcon()}
                  </span>
                  Alphabetical
                </button>

                {/* 建立日期 */}
                <button
                  className={`sort-menu-item ${sortBy === 'createdAt' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSortMenu(false)
                    handleSortSelect('createdAt')
                  }}
                >
                  <span className="sort-menu-indicator">
                    {sortBy === 'createdAt' && getSortIcon()}
                  </span>
                  Date Created
                </button>

                {/* 修改日期 */}
                <button
                  className={`sort-menu-item ${sortBy === 'updatedAt' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowSortMenu(false)
                    handleSortSelect('updatedAt')
                  }}
                >
                  <span className="sort-menu-indicator">
                    {sortBy === 'updatedAt' && getSortIcon()}
                  </span>
                  Date Modified
                </button>
              </div>
            )}
          </div>
        )}

        {/* 選單容器（只有 W 視圖有 Workspace 操作；F 視圖 New Folder/Select 已移至 FolderTree 底部；P/E 視圖無項目） */}
        <div
          className="workspace-header-menu-container"
          style={{
            position: 'relative',
            visibility: currentView === 'W' ? 'visible' : 'hidden'
          }}
        >
          <button
            className="workspace-header-menu-btn"
            onClick={handleMenuClick}
            title="More options"
          >
            <IconThreeDots size={18} />
          </button>
          {/* 下拉選單 - 只在 W 視圖顯示 Workspace 操作 */}
          {showMenu && currentView === 'W' && (
            <div
              className="page-sort-menu"
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                minWidth: '200px',
                zIndex: 1000
              }}
            >
              <WorkspaceMenu
                onClose={() => setShowMenu(false)}
                onCreateWorkspace={onCreateWorkspace}
                onEditWorkspace={onEditWorkspace}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkspaceHeader
