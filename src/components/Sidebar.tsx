import { useState, useEffect, useRef } from 'react'
import FolderTree, { FolderTreeRef } from './FolderTree'
import PageList, { PageListRef } from './PageList'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceList, { WorkspaceListRef } from './WorkspaceList'
import { WorkspaceIcon } from './WorkspaceIcon'
import { Page, db } from '../services/db'
import { settingsService } from '../services/settings'
import { getRootFolderName } from '../services/rootFolders'
import { WorkspaceId } from '../types/workspace'
import { useOrientation } from '../contexts/OrientationContext'
import { ChevronLeft, ChevronDown } from './icons/ChevronIcons'
import {
  IconThreeDots,
  IconPlusCircleFill,
  IconFileEarmarkCheck,
  IconSort,
  IconCheck,
  IconSortDown,
  IconSortUp
} from './icons/BootstrapIcons'

interface SidebarProps {
  onSelectPage: (page: Page) => void
  onSelectFolder: (folderId: string, options?: { skipViewChange?: boolean }) => void
  selectedFolderId: string | null
  lastSelectedPageId: string | null
  selectedPage: Page | null
  refreshTrigger?: number
  mobileView?: 'workspaces' | 'folders' | 'pages' | 'editor' | 'search'
  desktopSidebarMode?: 'hidden' | 'pageOnly' | 'full'
  // Workspace 相關
  selectedWorkspaceId: WorkspaceId
  onSelectWorkspace: (workspaceId: WorkspaceId) => void
  showWorkspaceList: boolean
  onToggleWorkspaceList: () => void
  onCycleWorkspace?: () => void  // Desktop WorkspaceHeader 點擊時直接切換 Workspace
  // 選單相關 callbacks
  onCreatePage?: () => void
  // Mobile 返回
  onMobileBack?: () => void
  // 視圖追蹤和 Landscape 返回（用於 WorkspaceHeader 返回按鈕）
  currentView?: 'W' | 'F' | 'P' | 'E' | 'S'
  currentOrientation?: 'L' | 'P'
  onLandscapeBack?: () => void
  // 過場動畫用：前一個視圖（過場期間保持 header 可見）
  transitionPreviousView?: 'workspaces' | 'folders' | 'pages' | 'editor' | 'search' | null
}

const Sidebar = ({
  onSelectPage,
  onSelectFolder,
  selectedFolderId: selectedFolderIdFromParent,
  lastSelectedPageId,
  selectedPage,
  refreshTrigger,
  mobileView = 'folders',
  desktopSidebarMode = 'full',
  selectedWorkspaceId,
  onSelectWorkspace,
  showWorkspaceList,
  onToggleWorkspaceList,
  onCycleWorkspace,
  onCreatePage,
  onMobileBack,
  currentView,
  currentOrientation,
  onLandscapeBack,
  transitionPreviousView: _transitionPreviousView,
}: SidebarProps) => {

  // 內部的 selectedFolderId，用於顯示
  const [internalSelectedFolderId, setInternalSelectedFolderId] = useState<string | null>(() => {
    return settingsService.getCurrentSelectedFolder()
  })
  const [folderWidth, setFolderWidth] = useState(250)
  const [pageWidth, setPageWidth] = useState(250)
  const [isResizingFolder, setIsResizingFolder] = useState(false)
  const [isResizingPage, setIsResizingPage] = useState(false)
  // Resizer 拖動起始資訊（避免按下時跳動）
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  // 使用 OrientationContext 取代本地 state
  const { isPortraitMode } = useOrientation()

  // FolderTree ref，用於調用 createFolder
  const folderTreeRef = useRef<FolderTreeRef>(null)

  // PageList ref，用於調用 Edit Mode
  const pageListRef = useRef<PageListRef>(null)

  // WorkspaceList ref，用於調用 Edit Mode
  const workspaceListRef = useRef<WorkspaceListRef>(null)

  // Portrait 模式：各面板的 header 標題
  const [folderHeaderTitle, setFolderHeaderTitle] = useState('')
  const [pageHeaderTitle, setPageHeaderTitle] = useState('')

  // Portrait 模式：各面板的選單狀態
  const [showPageMenu, setShowPageMenu] = useState(false)
  const [showMobileSortMenu, setShowMobileSortMenu] = useState(false)

  // 排序狀態：sortBy 持久化，sortOrder 每次載入重置為 desc
  const [sortBy, setSortBy] = useState<'none' | 'updatedAt' | 'createdAt' | 'name'>(() => {
    const saved = settingsService.getPageSort()
    settingsService.savePageSort(saved.sortBy, 'desc')
    return saved.sortBy as 'none' | 'updatedAt' | 'createdAt' | 'name'
  })
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 取得排序圖標
  const getSortIcon = () => {
    if (sortBy === 'none') return null
    return sortOrder === 'desc' ? <IconSortDown size={18} /> : <IconSortUp size={18} />
  }

  // 處理排序選項點擊（與 WorkspaceHeader 共用相同邏輯）
  const handleMobileSortSelect = (newSortBy: 'none' | 'updatedAt' | 'createdAt' | 'name') => {
    if (newSortBy === 'none') {
      if (sortBy === 'none') return
      setSortBy('none')
      setSortOrder('desc')
      settingsService.savePageSort('none', 'desc')
    } else {
      if (sortBy === newSortBy) {
        const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
        setSortOrder(newOrder)
        settingsService.savePageSort(newSortBy, newOrder)
      } else {
        setSortBy(newSortBy)
        // Alphabetical 預設 A→Z (asc)，日期排序預設最新在前 (desc)
        const defaultOrder = newSortBy === 'name' ? 'asc' : 'desc'
        setSortOrder(defaultOrder)
        settingsService.savePageSort(newSortBy, defaultOrder)
      }
    }
    triggerPageRefresh()
  }

  // 刷新觸發器
  const [folderRefreshKey, setFolderRefreshKey] = useState(0)
  const [pageRefreshKey, setPageRefreshKey] = useState(0)

  // 點擊外部關閉 Portrait 選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showPageMenu && !target.closest('.mobile-nav-menu-container')) {
        setShowPageMenu(false)
      }
      if (showMobileSortMenu && !target.closest('.mobile-nav-sort-container')) {
        setShowMobileSortMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showPageMenu, showMobileSortMenu])

  // 觸發 FolderTree 刷新
  const triggerFolderRefresh = () => {
    setFolderRefreshKey(prev => prev + 1)
  }

  // 觸發 PageList 刷新
  const triggerPageRefresh = () => {
    setPageRefreshKey(prev => prev + 1)
  }

  // 初始化時，如果有恢復的 folderId，通知父組件
  useEffect(() => {
    if (internalSelectedFolderId) {
      onSelectFolder(internalSelectedFolderId)
    }
  }, [])

  // 監聽來自父組件的 selectedFolderId 變化
  useEffect(() => {
    if (selectedFolderIdFromParent !== undefined && selectedFolderIdFromParent !== internalSelectedFolderId) {
      setInternalSelectedFolderId(selectedFolderIdFromParent)

      // 當 selectedFolderId 變化時，也觸發 PageList 刷新
      // 延遲一下，確保 internalSelectedFolderId 已經更新
      setTimeout(() => {
        triggerPageRefresh()
      }, 50)
    }
  }, [selectedFolderIdFromParent])

  // 監聽來自 MarkdownEditor 的刷新觸發
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      // 同時刷新 FolderTree 和 PageList
      triggerFolderRefresh()
      triggerPageRefresh()
    }
  }, [refreshTrigger])


  // 載入 Folder Header 標題（Workspace 名稱）
  useEffect(() => {
    if (!isPortraitMode) return
    getRootFolderName(selectedWorkspaceId).then(setFolderHeaderTitle)
  }, [isPortraitMode, selectedWorkspaceId, refreshTrigger, folderRefreshKey])

  // 載入 Page Header 標題（Folder 名稱）
  useEffect(() => {
    const loadTitle = async () => {
      if (!isPortraitMode) return
      if (internalSelectedFolderId) {
        const folder = await db(selectedWorkspaceId).getFolder(internalSelectedFolderId)
        setPageHeaderTitle(folder?.name || 'Pages')
      } else {
        setPageHeaderTitle('Pages')
      }
    }
    loadTitle()
  }, [isPortraitMode, internalSelectedFolderId, selectedWorkspaceId, refreshTrigger, folderRefreshKey])

  const handleSelectFolder = (folderId: string, options?: { skipViewChange?: boolean }) => {
    setInternalSelectedFolderId(folderId)
    onSelectFolder(folderId, options)
    // MarkdownEditor.handleSelectFolder 會處理 lastSelectedPageId 和 fallback 邏輯
  }

  // 處理調整寬度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()  // 防止文字選取

      if (isResizingFolder) {
        // 使用相對位移計算，避免按下時跳動
        const delta = e.clientX - resizeStartX
        const newWidth = resizeStartWidth + delta
        if (newWidth >= 150 && newWidth <= 400) {
          setFolderWidth(newWidth)
        }
      } else if (isResizingPage) {
        // 使用相對位移計算，避免按下時跳動
        const delta = e.clientX - resizeStartX
        const newWidth = resizeStartWidth + delta
        if (newWidth >= 150 && newWidth <= 400) {
          setPageWidth(newWidth)
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizingFolder(false)
      setIsResizingPage(false)
      // 恢復文字選取
      document.body.style.userSelect = ''
    }

    if (isResizingFolder || isResizingPage) {
      // 禁止文字選取
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isResizingFolder, isResizingPage, resizeStartX, resizeStartWidth])

  // 注意：移除了 Portrait workspaces 的 early return
  // 改為在主 render 中同時渲染 WorkspaceList 和 sidebar-panels，讓 W↔F 過場動畫可以正常運作

  return (
    <div
      className={`sidebar mobile-view-${mobileView} desktop-mode-${desktopSidebarMode} ${showWorkspaceList ? 'show-workspace-list' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        '--page-width': `${pageWidth}px`  // CSS 變數：LP 模式用於設定 sidebar 寬度
      } as React.CSSProperties}
    >
      {/* Workspace Header（Desktop 或非 mobile folders/pages 視圖）*/}
      {!isPortraitMode && (
        <WorkspaceHeader
          workspaceId={selectedWorkspaceId}
          isExpanded={showWorkspaceList}
          onToggle={onCycleWorkspace || onToggleWorkspaceList}
          showBackButton={currentOrientation === 'L' && (currentView === 'F' || currentView === 'P')}
          onBack={onLandscapeBack}
          currentView={currentView}
          onCreateWorkspace={() => {}}
          onEditWorkspace={() => workspaceListRef.current?.enterEditMode()}
          onSortChange={triggerPageRefresh}
          refreshTrigger={refreshTrigger}
          folderRefreshKey={folderRefreshKey}
        />
      )}

      {/* Portrait 模式：WorkspaceList 直接渲染在 sidebar 內（W↔F 過場需要同時存在）*/}
      {isPortraitMode && (
        <div className="sidebar-workspace-list-portrait">
          <WorkspaceList
            ref={workspaceListRef}
            currentWorkspaceId={selectedWorkspaceId}
            onSelect={onSelectWorkspace}
            refreshKey={folderRefreshKey}
          />
        </div>
      )}

      {/* Desktop 模式：WorkspaceList 條件渲染 */}
      {!isPortraitMode && showWorkspaceList && (
        <div
          className="sidebar-workspace-list"
          style={{ width: `${folderWidth + pageWidth + 8}px` }}
        >
          <WorkspaceList
            ref={workspaceListRef}
            currentWorkspaceId={selectedWorkspaceId}
            onSelect={onSelectWorkspace}
            refreshKey={folderRefreshKey}
          />
        </div>
      )}

      {/* sidebar-panels：Portrait 模式永遠渲染（CSS 控制顯示），Desktop 模式在非 workspace 時渲染 */}
      {(isPortraitMode || !showWorkspaceList) && (
        <div className="sidebar-panels">
          {/* Folder 區塊（Portrait 模式：header 在面板內部，跟著面板一起動畫）*/}
          <div className="sidebar-folder" style={{ width: isPortraitMode ? undefined : `${folderWidth}px` }}>
            {/* Folder Header - Portrait 模式專用 */}
            {isPortraitMode && (
              <div className="mobile-nav-header">
                <div className="mobile-nav-left">
                  <button className="mobile-back-btn" onClick={onMobileBack}>
                    <ChevronLeft size={28} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="mobile-nav-center">
                  <WorkspaceIcon workspaceId={selectedWorkspaceId} />
                  <button
                    className="mobile-nav-title-btn"
                    onClick={onCycleWorkspace}
                  >
                    {folderHeaderTitle}
                    <ChevronDown size={16} />
                  </button>
                </div>
                {/* 右側佔位（保持 header 置中對稱；New Folder / Select 已移至 FolderTree 底部） */}
                <div className="mobile-nav-right" />
              </div>
            )}
            <FolderTree
              ref={folderTreeRef}
              onSelectFolder={handleSelectFolder}
              onFolderDeleted={triggerFolderRefresh}
              onPagesChanged={triggerPageRefresh}
              selectedFolderId={internalSelectedFolderId}
              refreshKey={folderRefreshKey}
              workspaceId={selectedWorkspaceId}
            />
          </div>
          {!isPortraitMode && (
            <div
              className="sidebar-resizer"
              onMouseDown={(e) => {
                setIsResizingFolder(true)
                setResizeStartX(e.clientX)
                setResizeStartWidth(folderWidth)
              }}
            />
          )}

          {/* Page 區塊（Portrait 模式：header 在面板內部，跟著面板一起動畫）*/}
          <div className="sidebar-page" style={{ width: isPortraitMode ? undefined : `${pageWidth}px` }}>
            {/* Page Header - Portrait 模式專用 */}
            {isPortraitMode && (
              <div className="mobile-nav-header">
                <div className="mobile-nav-left">
                  <button className="mobile-back-btn" onClick={onMobileBack}>
                    <ChevronLeft size={28} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="mobile-nav-center">
                  <WorkspaceIcon workspaceId={selectedWorkspaceId} />
                  <button
                    className="mobile-nav-title-btn"
                    onClick={onCycleWorkspace}
                  >
                    {pageHeaderTitle}
                    <ChevronDown size={16} />
                  </button>
                </div>
                <div className="mobile-nav-right">
                  {/* 排序按鈕 */}
                  <div className="mobile-nav-sort-container">
                    <button
                      className="mobile-nav-sort-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMobileSortMenu(!showMobileSortMenu)
                        setShowPageMenu(false)
                      }}
                      title="Sort"
                    >
                      <IconSort size={24} />
                    </button>
                    {showMobileSortMenu && (
                      <div className="mobile-nav-menu">
                        <button
                          className={`sort-menu-item ${sortBy === 'none' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMobileSortMenu(false)
                            handleMobileSortSelect('none')
                          }}
                        >
                          <span className="sort-menu-indicator">
                            {sortBy === 'none' && <IconCheck size={18} />}
                          </span>
                          Manual
                        </button>
                        <button
                          className={`sort-menu-item ${sortBy === 'name' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMobileSortMenu(false)
                            handleMobileSortSelect('name')
                          }}
                        >
                          <span className="sort-menu-indicator">
                            {sortBy === 'name' && getSortIcon()}
                          </span>
                          Alphabetical
                        </button>
                        <button
                          className={`sort-menu-item ${sortBy === 'createdAt' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMobileSortMenu(false)
                            handleMobileSortSelect('createdAt')
                          }}
                        >
                          <span className="sort-menu-indicator">
                            {sortBy === 'createdAt' && getSortIcon()}
                          </span>
                          Date Created
                        </button>
                        <button
                          className={`sort-menu-item ${sortBy === 'updatedAt' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMobileSortMenu(false)
                            handleMobileSortSelect('updatedAt')
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

                  {/* 選單按鈕 */}
                  <div className="mobile-nav-menu-container">
                    <button
                      className="mobile-nav-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowPageMenu(!showPageMenu)
                        setShowMobileSortMenu(false)
                      }}
                      title="More options"
                    >
                      <IconThreeDots size={24} />
                    </button>
                    {showPageMenu && (
                      <div className="mobile-nav-menu">
                        <button
                          className="sort-menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowPageMenu(false)
                            onCreatePage?.()
                          }}
                        >
                          <IconPlusCircleFill size={24} className="menu-icon" />
                          New Page
                        </button>
                        <button
                          className="sort-menu-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowPageMenu(false)
                            pageListRef.current?.enterEditMode()
                          }}
                        >
                          <IconFileEarmarkCheck size={24} className="menu-icon" />
                          Select
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <PageList
              ref={pageListRef}
              folderId={internalSelectedFolderId}
              onSelectPage={onSelectPage}
              onSelectFolder={handleSelectFolder}
              lastSelectedPageId={lastSelectedPageId}
              selectedPage={selectedPage}
              refreshKey={pageRefreshKey}
              onPagesChanged={triggerFolderRefresh}
              workspaceId={selectedWorkspaceId}
              onCreatePage={onCreatePage}
            />
          </div>
          {!isPortraitMode && (
            <div
              className="sidebar-resizer"
              onMouseDown={(e) => {
                setIsResizingPage(true)
                setResizeStartX(e.clientX)
                setResizeStartWidth(pageWidth)
              }}
            />
          )}
        </div>
      )}

    </div>
  )
}

export default Sidebar
