import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { EditorContent } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import Sidebar from './Sidebar'
import { NavigationRail } from './NavigationRail'
import { SettingsPanel } from './SettingsPanel'
import { SearchPage } from './SearchPage'
import { FullHeightPanel } from './FullHeightPanel'
import { FeedbackPage } from './FeedbackPage'
import { InstallGuidePage } from './InstallGuidePage'
import LinkDialog from './editor/LinkDialog'
import { EditorToolbar } from './editor/EditorToolbar'
import { db, dbInit, Page, Folder } from '../services/db'
import { settingsService, isMobileDevice } from '../services/settings'
import { ensureFolderAndPage } from '../services/pageHelper'
import { ensureSystemStructureExists, ROOT_FOLDER_ID, isTrashFolderId } from '../services/rootFolders'
import { extractPageTitle } from '../utils/markdownConverter'
import { configureMarkdownIt, markdownToHtml } from '../config/editor/markdownItConfig'
import { useEditorSave } from '../hooks/editor/useEditorSave'
import { useImageHandler } from '../hooks/editor/useImageHandler'
import { useTiptapEditor } from '../hooks/editor/useTiptapEditor'
import { useEditorMode } from '../hooks/editor/useEditorMode'
import { useLineNumbers } from '../hooks/editor/useLineNumbers'
import { useOrientation } from '../contexts/OrientationContext'
import { WorkspaceId } from '../types/workspace'
import { useFileLaunchListener } from '../hooks/useFileLaunch'
import { useToast } from '../hooks/useToast'
import {
  MarkdownFile,
  ImportResult,
  DirectoryImportResult,
  resolveTargetFolderId,
  importMarkdownFiles,
  getImportToastMessage,
  importDirectoryStructure,
  importDirectoryFiles,
  getDirectoryImportToastMessage
} from '../utils/markdownImport'
import {
  hasDirectoryEntry,
  readDirectoryEntries,
  countMarkdownFiles
} from '../utils/directoryImport'
import {
  selectMarkdownFiles, selectDirectory, DirectoryFile,
  selectDirectoryWithHandles, scanSubDirectory
} from '../utils/fileOperations'
import {
  isFileHandleSupported, saveDirHandle, findDirHandleBySameEntry,
  saveFolderDirLink, savePageLink, updatePageSyncState, isSubPathLinked
} from '../services/fileHandleStore'
import { syncFile, rescanAllLinkedFolders } from '../utils/fileLink'
import SubDirPickerDialog from './SubDirPickerDialog'
import ToastContainer from './ToastContainer'
import { crossContextSync } from '../services/pwa/crossContextSync'
import { setCurrentEditingPage } from '../utils/editingState'
import '../styles/editor.css'

// 重置編輯器 undo/redo history（頁面切換時使用）
// 用 EditorState.create 重建 state，保留文件內容但清除 history plugin 的 stack
function resetEditorHistory(editor: ReturnType<typeof import('@tiptap/react').useEditor>) {
  if (!editor) return
  const freshState = EditorState.create({
    doc: editor.state.doc,
    plugins: editor.state.plugins,
  })
  editor.view.updateState(freshState)
}

/**
 * Markdown 行號 Gutter
 * 根據 textarea 的 source lines 計算每行的 Y 座標
 */
function MarkdownLineGutter({
  text,
  textareaRef,
}: {
  text: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
}) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const rafId = useRef(0)

  const update = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      const textarea = textareaRef.current
      const gutter = gutterRef.current
      if (!textarea || !gutter) return

      const style = getComputedStyle(textarea)
      const paddingTop = parseFloat(style.paddingTop)
      const paddingLeft = parseFloat(style.paddingLeft)
      const paddingRight = parseFloat(style.paddingRight)

      // 用隱藏 div 量測每條 source line 的累計高度（處理 soft-wrap）
      const measureDiv = document.createElement('div')
      measureDiv.style.cssText = `
        position: absolute; visibility: hidden; white-space: pre-wrap; word-wrap: break-word;
        width: ${textarea.clientWidth - paddingLeft - paddingRight}px;
        font: ${style.font}; font-size: ${style.fontSize}; font-family: ${style.fontFamily};
        font-weight: ${style.fontWeight};
        line-height: ${style.lineHeight}; padding: 0; border: none; overflow: hidden;
      `
      document.body.appendChild(measureDiv)

      const lines = text.split('\n')
      gutter.innerHTML = ''

      let cumulativeHeight = 0
      for (let i = 0; i < lines.length; i++) {
        const span = document.createElement('span')
        span.className = 'line-num'
        span.textContent = String(i + 1)
        span.style.top = `${paddingTop + cumulativeHeight}px`
        gutter.appendChild(span)

        // 量測這行的高度（包含 soft-wrap）
        measureDiv.textContent = lines[i] || '\u200b' // 空行用零寬字元保持一行高
        cumulativeHeight += measureDiv.offsetHeight
      }

      document.body.removeChild(measureDiv)

      // 同步 scroll
      gutter.style.transform = `translateY(-${textarea.scrollTop}px)`
    })
  }, [text, textareaRef])

  useEffect(() => {
    update()
    const textarea = textareaRef.current
    if (!textarea) return

    const handleScroll = () => {
      const gutter = gutterRef.current
      if (gutter) {
        gutter.style.transform = `translateY(-${textarea.scrollTop}px)`
      }
    }

    textarea.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', update)
    return () => {
      textarea.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', update)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [update, textareaRef])

  return (
    <div className="md-line-gutter">
      <div ref={gutterRef} style={{ position: 'relative' }} />
    </div>
  )
}

const MarkdownEditor = () => {
  useEffect(() => {
    configureMarkdownIt()
  }, [])

  // 初始化 Cross Context Sync（網頁版↔PWA 即時同步）
  useEffect(() => {
    crossContextSync.init()
    return () => crossContextSync.destroy()
  }, [])

  // Local State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [markdownText, setMarkdownText] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [triggerRefresh, setTriggerRefresh] = useState(0)
  const [showLineNumbers, setShowLineNumbers] = useState(() => {
    const s = settingsService.getSyncedSettings()
    return s.showLineNumbers && !isMobileDevice()
  })
  const [dbInitialized, setDbInitialized] = useState(false)
  const [currentLineHighlight, setCurrentLineHighlight] = useState<{ top: number; height: number } | null>(null)
  // Mobile 視圖：五層視圖（workspaces → folders → pages → editor → search）
  type MobileView = 'workspaces' | 'folders' | 'pages' | 'editor' | 'search'
  const [mobileView, setMobileView] = useState<MobileView>('folders')
  // 記錄進入 Search 前的視圖（用於 Search toggle 返回）
  const [previousMobileView, setPreviousMobileView] = useState<MobileView>('folders')
  // 過場動畫狀態（Portrait 視圖切換用）
  type TransitionDirection = 'forward' | 'backward' | null
  const [transitionPreviousView, setTransitionPreviousView] = useState<MobileView | null>(null)
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(null)
  const [transitionAnimate, setTransitionAnimate] = useState(false)
  // Desktop Sidebar 三態模式：hidden（只顯示 Editor）、pageOnly（+PageList）、full（全部）
  type DesktopSidebarMode = 'hidden' | 'pageOnly' | 'full'
  const [desktopSidebarMode, setDesktopSidebarMode] = useState<DesktopSidebarMode>('full')
  // 視圖追蹤：W（Workspace）、F（Folder）、P（Page）、E（Editor）、S（Search）
  type CurrentView = 'W' | 'F' | 'P' | 'E' | 'S'
  const [currentView, setCurrentView] = useState<CurrentView>('F')
  // Search Panel 狀態（Desktop 用）
  const [showSearchPanel, setShowSearchPanel] = useState(false)

  // 使用 OrientationContext 取代本地 state
  const { mode, isPortraitMode, isDesktopLike } = useOrientation()

  // Toast 通知
  const { toasts, info: showToast, removeToast } = useToast()
  // Workspace 相關狀態
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<WorkspaceId>(() => {
    return settingsService.getSelectedWorkspace()
  })
  const [showWorkspaceList, setShowWorkspaceList] = useState(false)
  // Ref 追蹤最新的 selectedWorkspaceId（供 useEffect 閉包使用）
  const selectedWorkspaceIdRef = useRef(selectedWorkspaceId)
  useEffect(() => {
    selectedWorkspaceIdRef.current = selectedWorkspaceId
  }, [selectedWorkspaceId])
  // Settings Panel 狀態
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  // E1/E2 模式：編輯器 focus 狀態（用於 CSS class 切換 toolbar 定位方式）
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  // Slide Panel 狀態（Feedback / Install / Sync）
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false)
  const [showInstallPanel, setShowInstallPanel] = useState(false)
  const [subDirPicker, setSubDirPicker] = useState<{
    dirHandle: FileSystemDirectoryHandle
    handleId: string
    subDirectories: string[]
    parentFolderId: string
  } | null>(null)
  // Refs
  const markdownTextareaRef = useRef<HTMLTextAreaElement>(null)
  // callback ref pattern：用 state 儲存 DOM 元素，確保元素掛載後觸發 re-render
  const [wysiwygEditorEl, setWysiwygEditorEl] = useState<HTMLDivElement | null>(null)
  const isSyncingFromMarkdown = useRef(false)
  const isInitialLoad = useRef(true)
  // 用於跨函數傳遞 skipViewChange 狀態（讓 hashchange 監聯器知道不要切換視圖）
  const skipViewChangeRef = useRef(false)
  // 用於標記正在從背景恢復（PWA background → visible）
  const isResumingFromBackgroundRef = useRef(false)
  // idleToPP 已生效，阻止 handleHashChange 切到 editor
  const idleToPPActiveRef = useRef(false)
  const lastRescanTimeRef = useRef(0)
  // 用於 Ref Pattern：避免閉包陷阱，確保 callback 使用最新狀態
  const isMarkdownModeRef = useRef(false)
  const editorRef = useRef<ReturnType<typeof useTiptapEditor> | null>(null)
  // E1 模式追蹤：編輯器是否有 focus（用 ref 供 scroll handler 讀取）
  const isEditorFocusedRef = useRef(false)
  // iOS 鍵盤修正：Toolbar Wrapper ref（Sticky + Margin 方案）
  const toolbarWrapRef = useRef<HTMLDivElement>(null)

  // Hooks
  const {
    currentPage,
    setCurrentPage,
    setSyncStatus,
    displayStatus,
    scheduleAutoSave,
    clearAutoSave
  } = useEditorSave(selectedWorkspaceId)

  // 追蹤狀態的 refs（避免 useEffect 閉包陷阱）
  // 必須在 useEditorSave() 之後宣告，因為需要 currentPage
  const prevModeRef = useRef(mode)  // 用於追蹤 orientation mode 變化
  const mobileViewRef = useRef(mobileView)
  const desktopSidebarModeRef = useRef(desktopSidebarMode)
  const currentPageRef = useRef(currentPage)
  const showWorkspaceListRef = useRef(showWorkspaceList)

  const onUpdate = (markdown: string) => {
    // 跳過頁面切換期間的更新，避免舊內容覆蓋新頁面標題
    if (isSyncingFromMarkdown.current) {
      return
    }

    setMarkdownText(markdown)
    if (currentPage) {
      const newTitle = extractPageTitle(markdown)
      setCurrentPage({ ...currentPage, name: newTitle })
      // 廣播頁面更新到其他 context（網頁版↔PWA）
      crossContextSync.broadcastPageUpdate(currentPage.id)
    }
    scheduleAutoSave(markdown, {
      folderId: selectedFolderId,
      editorState: currentPage?.editorState
    })
  }

  const isReadOnly = currentPage?.folderId ? isTrashFolderId(currentPage.folderId) : false

  // 用 ref 保存 handleImageUpload，確保事件處理器總是呼叫最新版本
  const handleImageUploadRef = useRef<((file: File) => void) | null>(null)
  // 用 ref 保存 handleMarkdownFileImport，確保事件處理器總是呼叫最新版本
  const handleMarkdownFileImportRef = useRef<((filename: string, content: string, lastModified?: number) => void) | null>(null)

  const editor = useTiptapEditor({
    initialContent: '',
    isMarkdownMode: false,
    isReadOnly,
    onUpdate,
    onSelectionUpdate: () => {},
    onFocus: () => {
      // onFocus
      // E1 模式：標記編輯器有 focus
      isEditorFocusedRef.current = true
      setIsEditorFocused(true)  // 用於 CSS class 切換
    },
    onBlur: () => {
      // onBlur
      // E1 模式結束：標記編輯器失去 focus
      isEditorFocusedRef.current = false
      setIsEditorFocused(false)  // 用於 CSS class 切換
      saveCurrentCursorPositionRef.current?.()  // 透過 ref 呼叫，避免閉包陷阱
    },
    onImageUpload: (file) => handleImageUploadRef.current?.(file)  // 透過 ref 呼叫
  })

  // 同步 editorRef（確保 ref 始終指向最新的 editor）
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const { handleImageUpload, convertImageUrls } = useImageHandler(editor, selectedWorkspaceId)

  // 同步 ref（每次渲染都更新）
  handleImageUploadRef.current = handleImageUpload

  const updateMarkdownLineHighlight = () => {
    const textarea = markdownTextareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const text = textarea.value
    const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
    const lineEnd = text.indexOf('\n', cursorPos)
    const actualLineEnd = lineEnd === -1 ? text.length : lineEnd

    const style = window.getComputedStyle(textarea)
    const lineHeight = parseFloat(style.lineHeight)
    const paddingTop = parseFloat(style.paddingTop)

    const measureDiv = document.createElement('div')
    measureDiv.style.cssText = `
      position: absolute; visibility: hidden; white-space: pre-wrap; word-wrap: break-word;
      width: ${textarea.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)}px;
      font: ${style.font}; font-size: ${style.fontSize}; font-family: ${style.fontFamily};
      line-height: ${style.lineHeight}; padding: 0; border: none; overflow: hidden;
    `
    document.body.appendChild(measureDiv)

    const textBefore = text.substring(0, lineStart)
    measureDiv.textContent = textBefore
    const beforeLineTop = measureDiv.offsetHeight

    const currentLineText = text.substring(lineStart, actualLineEnd)
    let logicalLineHeight = lineHeight
    if (currentLineText !== '') {
      measureDiv.textContent = currentLineText
      logicalLineHeight = measureDiv.offsetHeight || lineHeight
    }

    document.body.removeChild(measureDiv)

    const top = paddingTop + beforeLineTop - textarea.scrollTop
    setCurrentLineHighlight({ top, height: logicalLineHeight })
  }

  const scrollMarkdownCursorToCenter = () => {
    const textarea = markdownTextareaRef.current
    if (!textarea) return
    const cursorPosition = textarea.selectionStart
    const text = textarea.value.substring(0, cursorPosition)
    const lines = text.split('\n').length
    const lineHeight = 24 
    const top = lines * lineHeight
    const height = textarea.clientHeight
    textarea.scrollTop = Math.max(0, top - height / 2)
  }

  const scrollWysiwygCursorToCenter = useCallback(() => {
    if (!editor) return
    const { from } = editor.state.selection
    const domAtPos = editor.view.domAtPos(from)
    const node = domAtPos.node
    if (node instanceof Element) {
      node.scrollIntoView({ behavior: 'auto', block: 'center' })
    } else if (node.parentElement) {
      node.parentElement.scrollIntoView({ behavior: 'auto', block: 'center' })
    }
  }, [editor])

  // 保存當前游標位置到資料庫
  const saveCurrentCursorPosition = useCallback(async () => {
    if (!currentPage) return

    // 🔧 修復：檢查頁面是否已在 Trash，如果是就不保存
    // 這可以防止刪除頁面時觸發的 blur 事件把頁面用舊的 folderId 寫回
    if (isTrashFolderId(currentPage.folderId)) {
      return
    }

    // 🔧 修復：從 DB 獲取最新狀態，確認頁面仍在原 folder
    // 這是第二道防線，避免閉包中的 currentPage 是過時的
    const latestPage = await db(selectedWorkspaceIdRef.current).getPage(currentPage.id)
    if (!latestPage || isTrashFolderId(latestPage.folderId)) {
      return  // 頁面已被刪除或移到 Trash，不保存
    }

    const editorState = {
      ...latestPage.editorState,
      wysiwygCursorPosition: isMarkdownModeRef.current
        ? latestPage.editorState?.wysiwygCursorPosition
        : editorRef.current?.state.selection.from,
      markdownCursorPosition: isMarkdownModeRef.current
        ? markdownTextareaRef.current?.selectionStart
        : latestPage.editorState?.markdownCursorPosition,
    }

    await db(selectedWorkspaceIdRef.current).updatePage({
      ...latestPage,  // 🔧 使用最新的頁面狀態
      editorState,
    })
  }, [currentPage])

  // 保存 ref 供 onBlur 使用
  const saveCurrentCursorPositionRef = useRef(saveCurrentCursorPosition)
  useEffect(() => {
    saveCurrentCursorPositionRef.current = saveCurrentCursorPosition
  }, [saveCurrentCursorPosition])

  // 恢復游標位置並設定 focus（只在 Desktop-like 模式）
  const restoreCursorPositionAndFocus = useCallback((page: Page) => {
    if (!editorRef.current || isMarkdownModeRef.current) return

    const pos = page.editorState?.wysiwygCursorPosition || 1

    try {
      editorRef.current.commands.setTextSelection(pos)
    } catch {
      editorRef.current.commands.setTextSelection(1)
    }

    // 只在 Desktop-like 模式執行 focus（Portrait 保持現狀）
    if (isDesktopLike) {
      editorRef.current.commands.focus()
      scrollWysiwygCursorToCenter()
    }
  }, [isDesktopLike, scrollWysiwygCursorToCenter])

  // 恢復游標 ref（供 hashchange 使用）
  const restoreCursorPositionAndFocusRef = useRef(restoreCursorPositionAndFocus)
  useEffect(() => {
    restoreCursorPositionAndFocusRef.current = restoreCursorPositionAndFocus
  }, [restoreCursorPositionAndFocus])

  const {
    isMarkdownMode,
    handleToggleMarkdownMode
  } = useEditorMode({
    editor,
    markdownTextareaRef,
    markdownText,
    currentPage,
    setCurrentPage,
    convertImageUrls,
    isSyncingFromMarkdown,
    updateMarkdownLineHighlight,
    scrollMarkdownCursorToCenter,
    scrollWysiwygCursorToCenter
  })

  // 同步 isMarkdownModeRef（避免 onBlur 閉包陷阱）
  useEffect(() => {
    isMarkdownModeRef.current = isMarkdownMode
  }, [isMarkdownMode])

  // WYSIWYG 行號（回傳 entries，由 JSX 渲染 gutter）
  const lineEntries = useLineNumbers(
    showLineNumbers && !isMarkdownMode,
    wysiwygEditorEl,
  )

  // 設定變更時重新讀取 showLineNumbers
  useEffect(() => {
    const s = settingsService.getSyncedSettings()
    setShowLineNumbers(s.showLineNumbers && !isMobileDevice())
  }, [triggerRefresh])



  // Cross Context Sync：監聯其他視窗（網頁版↔PWA）的頁面更新
  useEffect(() => {
    const unsubPageUpdate = crossContextSync.onPageUpdate(async (pageId) => {
      // 只處理當前正在編輯的頁面
      if (!currentPage || currentPage.id !== pageId) return

      console.log('📡 Page updated in another context:', pageId)

      try {
        const page = await db(selectedWorkspaceIdRef.current).getPage(pageId)
        if (!page) return

        // 檢查是否有本地未保存的變更
        const hasUnsavedChanges = markdownText !== currentPage.content
        if (hasUnsavedChanges) {
          // 顯示提示：此頁面已在其他視窗更新
          showToast('此頁面已在其他視窗更新')
          return
        }

        // 無本地變更，直接更新內容
        if (page.content !== currentPage.content) {
          setCurrentPage(page)
          setMarkdownText(page.content)

          if (!isMarkdownMode && editor) {
            const html = markdownToHtml(page.content)
            editor.commands.setContent(html || '<p></p>')
          }
        }
      } catch (error) {
        console.error('Failed to handle cross-context page update:', error)
      }
    })

    const unsubPageDelete = crossContextSync.onPageDelete((pageId) => {
      // 如果當前頁面被刪除，清空編輯器
      if (currentPage && currentPage.id === pageId) {
        console.log('📡 Current page deleted in another context:', pageId)
        setCurrentPage(null)
        setMarkdownText('')
        editor?.commands.setContent('<p></p>')
        resetEditorHistory(editor)
        showToast('此頁面已在其他視窗刪除')
      }
    })

    return () => {
      unsubPageUpdate()
      unsubPageDelete()
    }
  }, [currentPage?.id, currentPage?.content, markdownText, editor, isMarkdownMode, showToast])

  // 久未使用 → 恢復到 PP（頁面列表）
  // 由 loadSavedState 和 visibilitychange 共同呼叫
  const idleToPP = (caller: string) => {
    const lastActive = settingsService.getLastActiveTime()
    const now = Date.now()
    const diffSec = lastActive ? Math.round((now - lastActive) / 1000) : null
    const isMobile = window.innerWidth <= 768
    const IDLE_SECONDS = 3600  // 1 小時
    const isLongAbsence = diffSec === null || diffSec >= IDLE_SECONDS

    const timeStr = new Date(now).toLocaleTimeString('en-GB', { hour12: false })
    const lastActiveStr = lastActive ? new Date(lastActive).toLocaleTimeString('en-GB', { hour12: false }) : 'null'
    console.log(
      `[VIEW ${timeStr}] idleToPP(${caller}) | ` +
      `lastActive=${lastActiveStr} now=${timeStr} diff=${diffSec}s threshold=${IDLE_SECONDS}s | ` +
      `mobile=${isMobile} idle=${isLongAbsence} → ${isMobile && isLongAbsence ? 'REDIRECT' : 'skip'}`
    )

    if (!isMobile || !isLongAbsence) return false

    // 取得當前 folder ID
    // 從 URL hash 取 folderId，PWA 被殺重開時 hash 可能是空的，fallback 到 settings
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const folderId = params.get('folder') || settingsService.getCurrentSelectedFolder()

    if (folderId) {
      console.log(`[VIEW ${timeStr}] idleToPP → 轉到 PP`, {
        caller,
        oldUrl: window.location.hash,
        newUrl: `#folder=${folderId}`,
      })
      idleToPPActiveRef.current = true
      setTimeout(() => { idleToPPActiveRef.current = false }, 2000)
      window.location.hash = `#folder=${folderId}`
      setMobileView('pages')
      return true
    }
    return false
  }

  // Effects
  // 載入已儲存的狀態（DB 已由 App.tsx 初始化）
  // 重要：採用「URL 優先」策略，URL 是唯一的狀態來源
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        // DB 已在 App.tsx 初始化完成，這裡直接設為 true
        setDbInitialized(true)

        // 檢查 URL 是否已有參數
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const urlFolderId = params.get('folder')
        const urlPageId = params.get('page')

        // 如果 URL 已有參數，讓 handleHashChange 處理，這裡只設 dbInitialized
        if (urlFolderId || urlPageId) {
          if (idleToPP('loadSavedState')) return
          return
        }

        // URL 沒有參數時，從 localStorage 恢復 folder 和 page
        const savedFolderId = settingsService.getCurrentSelectedFolder()

        if (savedFolderId) {
          // 從 folder.lastSelectedPageId 恢復頁面（取代 localStorage）
          const folder = await db(selectedWorkspaceIdRef.current).getFolder(savedFolderId)
          let validPageId: string | null = null

          if (folder?.lastSelectedPageId) {
            const page = await db(selectedWorkspaceIdRef.current).getPage(folder.lastSelectedPageId)
            // 驗證頁面存在且屬於該 folder
            if (page && page.folderId === savedFolderId) {
              validPageId = folder.lastSelectedPageId
            }
          }

          // 更新 URL（而非直接設 state），讓 handleHashChange 統一處理
          // 同時恢復 page，避免刷新後 currentPage 為 null 導致自動創建空白頁面
          if (validPageId) {
            if (idleToPP('loadSavedState-restore')) {
              // 久未使用，已轉到 PP
            } else {
              window.location.hash = `#folder=${savedFolderId}&page=${validPageId}`
            }
          } else {
            window.location.hash = `#folder=${savedFolderId}`
          }
        } else {
          // 沒有保存的 folder，設定預設值
          setSelectedFolderId(ROOT_FOLDER_ID)
          if (window.innerWidth <= 768) {
            setMobileView('folders')
          }
        }
      } catch (e) { console.error(e) }
    }
    loadSavedState()
  }, [])

  useEffect(() => {
    if (isMarkdownMode && currentPage) {
      const newTitle = extractPageTitle(markdownText)
      setCurrentPage({ ...currentPage, name: newTitle })
      scheduleAutoSave(markdownText, { folderId: selectedFolderId, editorState: currentPage.editorState })
    }
  }, [markdownText, isMarkdownMode])

  // 同步 currentPage 到 editingState，供背景任務（cleanup/dedup）避免 race
  // 使用者正在 editor 打開的 page，即使 content 為「未編輯」也不會被清掉
  useEffect(() => {
    setCurrentEditingPage(currentPage?.id ?? null)
    return () => setCurrentEditingPage(null)
  }, [currentPage?.id])

  useEffect(() => {
    if (isInitialLoad.current && editor && currentPage && !isMarkdownMode) {
      isSyncingFromMarkdown.current = true
      const html = markdownToHtml(currentPage.content)
      editor.commands.setContent(html || '<p></p>')
      resetEditorHistory(editor)

      // Trigger image conversion after initial load
      setTimeout(() => convertImageUrls(), 100)

      setTimeout(() => {
        isSyncingFromMarkdown.current = false
        // 使用統一的游標恢復函數（內部判斷 isDesktopLike 決定是否 focus）
        restoreCursorPositionAndFocus(currentPage)
        isInitialLoad.current = false
      }, 100)
    }
  }, [editor, currentPage, isMarkdownMode, restoreCursorPositionAndFocus])

  useEffect(() => {
    if (!isMarkdownMode || !markdownTextareaRef.current) return
    const textarea = markdownTextareaRef.current
    const handler = () => updateMarkdownLineHighlight()
    textarea.addEventListener('select', handler); textarea.addEventListener('click', handler)
    textarea.addEventListener('keyup', handler); textarea.addEventListener('scroll', handler)
    window.addEventListener('resize', handler)
    return () => {
      textarea.removeEventListener('select', handler); textarea.removeEventListener('click', handler)
      textarea.removeEventListener('keyup', handler); textarea.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [isMarkdownMode])

  // PE 模式 E1：iOS 鍵盤彈出時，用 margin-top 把 Toolbar 拉回可視區域
  // Sticky + Margin 方案：當 sticky wrapper 被推出視野時，用 margin 補償
  // 使用 rAF 節流 + 較大閾值，減少飄移/抖動
  // 新增：檢測游標接近畫面頂部/底部時，自動退出 E1 模式
  useEffect(() => {
    if (!isPortraitMode || mobileView !== 'editor') return

    const toolbarWrap = toolbarWrapRef.current
    const toolbar = document.querySelector('.toolbar.toolbar-mobile') as HTMLElement
    if (!toolbarWrap || !toolbar) return

    let currentMargin = 0
    let rafId: number | null = null  // rAF 節流

    // checkScroll: 是否為 scroll 事件（只有 scroll 時才檢測游標邊界）
    const adjustToolbar = (checkScroll = false) => {
      // 用 rAF 節流，確保每幀最多更新一次
      if (rafId !== null) return

      rafId = requestAnimationFrame(() => {
        rafId = null

        // 只在 E1/E2 模式（editor focused）時才調整 margin
        // V1/V2 模式不需要，否則會導致隱藏的 toolbar 被推下來
        if (!isEditorFocusedRef.current) {
          // 確保 V1/V2 模式下 margin 被清除
          if (currentMargin > 0) {
            currentMargin = 0
            toolbar.classList.remove('keyboard-adjusting')
            toolbar.style.marginTop = '0'
          }
          return
        }

        const rect = toolbarWrap.getBoundingClientRect()

        // 當 wrapper 被推出視野頂部時（rect.top < 0）
        if (rect.top < -1) {
          const newMargin = Math.abs(rect.top)
          // 閾值提高到 3px，減少微小變化觸發更新
          if (Math.abs(newMargin - currentMargin) > 3) {
            currentMargin = newMargin
            toolbar.classList.add('keyboard-adjusting')
            toolbar.style.marginTop = `${currentMargin}px`
          }
        } else if (currentMargin > 0) {
          // 回到正常位置
          currentMargin = 0
          toolbar.classList.remove('keyboard-adjusting')
          toolbar.style.marginTop = '0'
        }

        // 只在 scroll 事件時檢測游標邊界（避免鍵盤彈出時的 resize 誤觸發）
        if (checkScroll) {
          checkCursorProximity()
        }
      })
    }

    // 包裝函數：scroll 事件（檢測游標邊界）
    const handleScroll = () => adjustToolbar(true)
    // 包裝函數：resize 事件（不檢測游標邊界）
    const handleResize = () => adjustToolbar(false)

    // 檢查游標是否接近畫面頂部或底部
    const checkCursorProximity = () => {
      if (!isEditorFocusedRef.current || !editorRef.current) return

      try {
        const { from } = editorRef.current.state.selection
        const coords = editorRef.current.view.coordsAtPos(from)

        // 定義閾值：距離頂部/底部多少像素內觸發退出
        const PROXIMITY_THRESHOLD_TOP = 10    // 距離頂部 10px
        const PROXIMITY_THRESHOLD_BOTTOM = -50 // 游標進入鍵盤遮擋區域 50px 才觸發

        const viewportHeight = window.visualViewport?.height || window.innerHeight
        const cursorTop = coords.top
        const cursorBottom = coords.bottom

        // 檢查是否接近頂部（考慮 Toolbar 高度 60px）
        const TOOLBAR_HEIGHT = 60
        const distanceFromTop = cursorTop - TOOLBAR_HEIGHT

        // 檢查是否接近底部
        const distanceFromBottom = viewportHeight - cursorBottom

        // 當游標接近頂部或底部時，自動退出編輯模式
        if (distanceFromTop < PROXIMITY_THRESHOLD_TOP ||
            distanceFromBottom < PROXIMITY_THRESHOLD_BOTTOM) {
          console.log(`[PE E1] 游標接近邊界，自動退出編輯模式 (top: ${distanceFromTop.toFixed(0)}px, bottom: ${distanceFromBottom.toFixed(0)}px)`)

          // 移除焦點，觸發 blur 事件（會自動收起鍵盤）
          editorRef.current.commands.blur()
        }
      } catch (e) {
        // 忽略座標計算錯誤（例如空文件）
      }
    }

    // 使用 Visual Viewport 事件（比 window scroll 更準確）
    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll)
      viewport.addEventListener('resize', handleResize)
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      // 清理 pending rAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      if (viewport) {
        viewport.removeEventListener('scroll', handleScroll)
        viewport.removeEventListener('resize', handleResize)
      }
      window.removeEventListener('scroll', handleScroll)
      // 清理樣式
      toolbar.style.marginTop = '0'
      toolbar.classList.remove('keyboard-adjusting')
    }
  }, [isPortraitMode, mobileView])

  // History API Integration
  useEffect(() => {
    const handleHashChange = async () => {
      // 🔧 修復：切換頁面時清除 pending 的 auto-save
      // 避免舊頁面的內容覆蓋新頁面（閉包問題）
      clearAutoSave()

      const hash = window.location.hash.substring(1) // Remove #
      const params = new URLSearchParams(hash)
      const folderId = params.get('folder')
      const pageId = params.get('page')

      // 1. Handle Folder
      if (folderId) {
        if (folderId !== selectedFolderId) {
          setSelectedFolderId(folderId)
        }
        // Mobile: 根據 URL 狀態決定 view（不管 folderId 是否變化）
        // 有 folder 但沒有 page → 顯示 PageList
        // 但如果 skipViewChangeRef 為 true，則跳過（新增資料夾時保持在當前視圖）
        // 背景恢復時也跳過，保持用戶原本的視圖
        if (!pageId && window.innerWidth <= 768 &&
            !skipViewChangeRef.current &&
            !isResumingFromBackgroundRef.current) {
          setMobileView('pages')
        }
      } else {
        // No folder in hash -> 降級到 ROOT_FOLDER_ID（而非 null）
        setSelectedFolderId(ROOT_FOLDER_ID)
        // 背景恢復時跳過視圖切換
        if (window.innerWidth <= 768 && !isResumingFromBackgroundRef.current) {
          setMobileView('folders')
        }
      }

      // 2. Handle Page
      if (pageId) {
        // If we already have the page loaded, don't reload to avoid cursor jumps
        if (currentPageRef.current?.id !== pageId) {
          try {
            const page = await db(selectedWorkspaceIdRef.current).getPage(pageId)
            if (page) {
              // 已刪除的頁面不應顯示，清除 URL 中的 page 參數
              // 但如果當前是在 Trash folder 中，則允許顯示（這是 Trash 的目的）
              if (page.isDeleted && !(folderId && isTrashFolderId(folderId))) {
                if (folderId) {
                  await db(selectedWorkspaceIdRef.current).updateFolderLastSelectedPage(folderId, '')
                  window.location.hash = `folder=${folderId}`
                } else {
                  window.location.hash = ''
                }
                return
              }

              // ★ 關鍵修復：在任何 state 更新或 await 之前設置 flag
              // 防止 await 期間的 re-render 觸發 onUpdate 用舊內容覆蓋新頁面
              isSyncingFromMarkdown.current = true

              setCurrentPage(page)
              setMarkdownText(page.content)
              setSyncStatus('saved')

              // 更新 folder.lastSelectedPageId（URL 帶 page 參數時）
              if (folderId) {
                await db(selectedWorkspaceIdRef.current).updateFolderLastSelectedPage(folderId, pageId)
              }

              // Portrait 模式：尊重 skipViewChangeRef（點選 Folder 時不跳到 editor）
              // 背景恢復時也跳過，保持用戶原本的視圖
              if (window.innerWidth <= 768 &&
                  !skipViewChangeRef.current &&
                  !isResumingFromBackgroundRef.current) {
                if (!idleToPPActiveRef.current) {
                  setMobileView('editor')
                }
              }
              // Auto-close sidebar on mobile landscape
              if (window.innerWidth > 768 && window.innerWidth < 1024) {
                setDesktopSidebarMode('hidden')
              }

              // 設定編輯器內容並恢復游標
              if (editorRef.current && !isMarkdownModeRef.current) {
                const html = markdownToHtml(page.content)
                editorRef.current.commands.setContent(html || '<p></p>')
                resetEditorHistory(editorRef.current)
                setTimeout(() => {
                  isSyncingFromMarkdown.current = false
                  convertImageUrls()
                  // 恢復游標並 focus（內部判斷 isDesktopLike）
                  restoreCursorPositionAndFocusRef.current?.(page)
                }, 100)
              } else {
                // Markdown 模式或無編輯器時，也需要重置 flag
                isSyncingFromMarkdown.current = false
              }
            }
          } catch (e) { console.error('Failed to load page from hash', e) }
        }
      } else {
        // No page in hash — 清除編輯器內容（避免顯示上一個 page 的殘留內容）
        if (currentPageRef.current) {
          setCurrentPage(null)
          setMarkdownText('')
          editorRef.current?.commands.clearContent()
          resetEditorHistory(editorRef.current)
        }
      }

      // 重置 skipViewChangeRef（在所有檢查之後）
      skipViewChangeRef.current = false
    }

    // Initial check
    handleHashChange()

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [dbInitialized]) // Run after DB is ready

  // 頁面切換時同步本地連結檔案（非 silent，可請求 dirHandle 權限）
  useEffect(() => {
    if (!currentPage?.id || !isFileHandleSupported()) return

    const pageId = currentPage.id
    // 延遲執行，避免跟 hashchange 競爭
    const timer = setTimeout(() => {
      syncFile(pageId, selectedWorkspaceIdRef.current).then(result => {
        if (result === 'pulled') {
          db(selectedWorkspaceIdRef.current).getPage(pageId).then(updated => {
            if (updated) {
              setCurrentPage(updated)
              setMarkdownText(updated.content)
              // 更新 TipTap editor（WYSIWYG 模式）
              const htmlContent = markdownToHtml(updated.content)
              editor?.commands.setContent(htmlContent)
            }
          })
        }
      }).catch(() => {})
    }, 500)

    return () => clearTimeout(timer)
  }, [currentPage?.id])

  // 同步狀態到 refs（避免 useEffect 閉包陷阱）
  useEffect(() => { mobileViewRef.current = mobileView }, [mobileView])
  useEffect(() => { desktopSidebarModeRef.current = desktopSidebarMode }, [desktopSidebarMode])
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])
  useEffect(() => { showWorkspaceListRef.current = showWorkspaceList }, [showWorkspaceList])

  // 同步視圖追蹤狀態（CurrentView）- 使用 OrientationContext
  useEffect(() => {
    if (isPortraitMode) {
      // Portrait: 從 mobileView 推導
      const viewMap: Record<typeof mobileView, CurrentView> = {
        workspaces: 'W', folders: 'F', pages: 'P', editor: 'E', search: 'S'
      }
      setCurrentView(viewMap[mobileView])
    } else {
      // Desktop-like: 從 showWorkspaceList + desktopSidebarMode + showSearchPanel 推導
      if (showSearchPanel) {
        setCurrentView('S')
      } else if (showWorkspaceList) {
        setCurrentView('W')
      } else {
        const modeMap: Record<DesktopSidebarMode, CurrentView> = {
          full: 'F', pageOnly: 'P', hidden: 'E'
        }
        setCurrentView(modeMap[desktopSidebarMode])
      }
    }
  }, [mobileView, desktopSidebarMode, showWorkspaceList, showSearchPanel, isPortraitMode])

  // ESC 鍵收合 Workspace List
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWorkspaceList) {
        setShowWorkspaceList(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showWorkspaceList])

  // 點擊 Sidebar 外部收合 Workspace List（Document Click Listener）
  useEffect(() => {
    if (!showWorkspaceList) return

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果點擊的不是 Sidebar 內的元素，就收合
      if (!target.closest('.sidebar')) {
        setShowWorkspaceList(false)
      }
    }

    // 使用 setTimeout(0) 避免展開時的點擊立即觸發收合
    const timer = setTimeout(() => {
      document.addEventListener('click', handleDocumentClick)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [showWorkspaceList])

  // 方向變化偵測與狀態同步（Portrait ↔ Desktop-like）
  // 監聯 OrientationContext 的 mode 變化，自動同步狀態
  // 使用 useLayoutEffect：在 mode 切換後的同一幀內同步依賴 state
  // （desktopSidebarMode / mobileView），避免其 stale 一幀造成
  // sidebar 因 `.desktop-mode-hidden` 的 `display: none !important` 閃現。
  useLayoutEffect(() => {
    const prevMode = prevModeRef.current
    const wasPortrait = prevMode === 'mobile-portrait'
    const nowPortrait = mode === 'mobile-portrait'

    // 背景恢復時：只有在 orientation 真正改變時才同步視圖
    if (isResumingFromBackgroundRef.current) {
      if (wasPortrait === nowPortrait) {
        // orientation 沒有實際改變，跳過視圖同步
        prevModeRef.current = mode
        return
      }
      // orientation 確實改變了（如：在背景旋轉裝置），允許視圖同步
    }

    // 只在 portrait ↔ desktop-like 之間切換時同步狀態
    if (wasPortrait !== nowPortrait) {
      if (nowPortrait) {
        // Desktop-like → Portrait：映射到 mobileView
        if (showSearchPanel) {
          setMobileView('search')
        } else if (showWorkspaceListRef.current) {
          setMobileView('workspaces')
        } else {
          const sidebarMode = desktopSidebarModeRef.current
          switch (sidebarMode) {
            case 'hidden':
              setMobileView(currentPageRef.current ? 'editor' : 'pages')
              break
            case 'pageOnly':
              setMobileView('pages')
              break
            case 'full':
              setMobileView('folders')
              break
          }
        }
      } else {
        // Portrait → Desktop-like：映射到 desktopSidebarMode
        const view = mobileViewRef.current
        switch (view) {
          case 'search':
            setShowSearchPanel(true)
            setDesktopSidebarMode('full')
            break
          case 'workspaces':
            setShowWorkspaceList(true)
            setDesktopSidebarMode('full')
            break
          case 'editor':
            setShowWorkspaceList(false)
            setDesktopSidebarMode('hidden')
            break
          case 'pages':
            setShowWorkspaceList(false)
            setDesktopSidebarMode('pageOnly')
            break
          case 'folders':
            setShowWorkspaceList(false)
            setDesktopSidebarMode('full')
            break
        }
      }
    }

    prevModeRef.current = mode
  }, [mode, showSearchPanel])  // 依賴 mode 和 showSearchPanel

  // PWA 從後台復活時的處理
  // 注意：OrientationContext 會自動處理 orientation 變化並觸發上面的 useEffect
  // 這裡標記正在從背景恢復，讓其他 useEffect 知道不要自動切換視圖
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 記錄最後活動時間（切到背景時）
        settingsService.saveLastActiveTime()
        const t = new Date().toLocaleTimeString('en-GB', { hour12: false })
        console.log(`[VIEW ${t}] saveLastActiveTime`)
        return
      }

      if (!document.hidden) {
        // 先檢查是否久未使用 → 轉 PP（必須在設 isResumingFromBackgroundRef 之前）
        if (idleToPP('visibilitychange')) return

        // 標記正在從背景恢復
        isResumingFromBackgroundRef.current = true

        // 延遲重置：給其他 useEffect 足夠時間執行
        setTimeout(() => {
          isResumingFromBackgroundRef.current = false
        }, 100)

        // Rescan linked folders：完整雙向同步（節流 30 秒）
        const now = Date.now()
        if (isFileHandleSupported()) {
          if (now - lastRescanTimeRef.current >= 30_000) {
            lastRescanTimeRef.current = now
            const pageId = currentPage?.id
            rescanAllLinkedFolders(selectedWorkspaceIdRef.current).then(({ totalNewPages, totalPulled, totalPushed, totalConflicts, pulledPageIds }) => {
              // 如果當前頁面被 pull，刷新編輯器
              if (pageId && pulledPageIds.includes(pageId)) {
                db(selectedWorkspaceIdRef.current).getPage(pageId).then(updated => {
                  if (updated) {
                    setCurrentPage(updated)
                    setMarkdownText(updated.content)
                    const htmlContent = markdownToHtml(updated.content)
                    editor?.commands.setContent(htmlContent)
                  }
                })
              }

              const hasChanges = totalNewPages > 0 || totalPulled > 0 || totalPushed > 0 || totalConflicts > 0
              if (hasChanges) {
                setTriggerRefresh(prev => prev + 1)
                const parts = []
                if (totalNewPages > 0) parts.push(`匯入 ${totalNewPages}`)
                if (totalPulled > 0) parts.push(`拉取 ${totalPulled}`)
                if (totalPushed > 0) parts.push(`推送 ${totalPushed}`)
                if (totalConflicts > 0) parts.push(`衝突 ${totalConflicts}`)
                showToast(`偵測到檔案變更：${parts.join('、')}`)
              }
            }).catch(() => {})
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [currentPage?.id])

  // Portrait 視圖切換過場動畫
  // 視圖順序：左 → 右（前進方向）
  const VIEW_ORDER: MobileView[] = ['workspaces', 'folders', 'pages', 'editor']

  // 過場動畫視圖切換函數（僅 Portrait 模式使用）
  const navigateToView = useCallback((newView: MobileView) => {
    // 跳過 search 視圖（使用獨立邏輯）和相同視圖
    if (newView === 'search' || newView === mobileView) {
      if (newView !== mobileView) {
        setMobileView(newView)
      }
      return
    }

    // 計算方向
    const currentIndex = VIEW_ORDER.indexOf(mobileView)
    const newIndex = VIEW_ORDER.indexOf(newView)
    // 處理 search 視圖的情況：視為從 folders 開始
    const effectiveCurrentIndex = mobileView === 'search' ? VIEW_ORDER.indexOf('folders') : currentIndex
    const direction: TransitionDirection = newIndex > effectiveCurrentIndex ? 'forward' : 'backward'

    // 設定過場狀態
    setTransitionPreviousView(mobileView)
    setTransitionDirection(direction)
    setTransitionAnimate(false)
    setMobileView(newView)

    // 下一幀觸發動畫
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionAnimate(true)
      })
    })

    // 300ms 後清除過場狀態
    setTimeout(() => {
      setTransitionPreviousView(null)
      setTransitionDirection(null)
      setTransitionAnimate(false)
    }, 300)
  }, [mobileView])

  // Handlers
  const handleSelectPage = async (page: Page) => {
    clearAutoSave()

    // 1. 保存舊頁面游標位置
    if (currentPage && currentPage.id !== page.id) {
      await saveCurrentCursorPosition()
    }

    // 2. Fix: Use page.folderId to construct hash to ensure it matches the page's actual folder.
    // This prevents issues where selectedFolderId state hasn't updated yet (e.g. during auto-select).
    const targetFolderId = page.folderId || selectedFolderId

    if (page.id) {
      const newHash = `folder=${targetFolderId || ''}&page=${page.id}`
      if (window.location.hash !== `#${newHash}`) {
        window.location.hash = newHash
      }
    } else {
      // Deselecting page
      const newHash = targetFolderId ? `folder=${targetFolderId}` : ''
      window.location.hash = newHash
    }

    // 4. 更新 folder.lastSelectedPageId（跳過 Trash）
    if (targetFolderId && page.id && !isTrashFolderId(targetFolderId)) {
      await db(selectedWorkspaceId).updateFolderLastSelectedPage(targetFolderId, page.id)
    }

    // 5. Portrait: 使用過場動畫切換到 editor 視圖
    if (isPortraitMode) {
      navigateToView('editor')
    }

    // Auto-close sidebar on mobile landscape (width usually > 768 but < 1024)
    if (window.innerWidth > 768 && window.innerWidth < 1024) {
      setDesktopSidebarMode('hidden')
    }

    if (!page.id) {
      setCurrentPage(null)
      setMarkdownText('')
      editor?.commands.clearContent()
      resetEditorHistory(editor)
      setSyncStatus('saved')

      // 清空 folder.lastSelectedPageId，避免刪除最後一個頁面後被重新恢復
      if (targetFolderId) {
        await db(selectedWorkspaceId).updateFolderLastSelectedPage(targetFolderId, '')
      }

      return
    }

    // 6. 從 DB 讀取最新 page（確保 editorState 最新）
    const latestPage = await db(selectedWorkspaceId).getPage(page.id) || page

    // 7. 更新 state
    setCurrentPage(latestPage)
    setMarkdownText(latestPage.content)
    setSyncStatus('saved')

    // 8. 設定編輯器內容並恢復游標
    if (!isMarkdownMode) {
      isSyncingFromMarkdown.current = true
      const html = markdownToHtml(latestPage.content)
      editor?.commands.setContent(html || '<p></p>')
      resetEditorHistory(editor)
      setTimeout(() => {
        isSyncingFromMarkdown.current = false
        convertImageUrls()
        // 恢復游標並 focus（內部判斷 isDesktopLike）
        restoreCursorPositionAndFocus(latestPage)
      }, 50)
    } else {
      setTimeout(() => {
        if (markdownTextareaRef.current) {
          markdownTextareaRef.current.value = latestPage.content
          const pos = latestPage.editorState?.markdownCursorPosition || 0
          markdownTextareaRef.current.setSelectionRange(pos, pos)
          // 只在 Desktop-like 模式 focus
          if (isDesktopLike) {
            markdownTextareaRef.current.focus()
            scrollMarkdownCursorToCenter()
          }
        }
      }, 50)
    }
  }

  const handleSelectFolder = async (folderId: string, options?: { skipViewChange?: boolean, workspaceId?: WorkspaceId }) => {
    // 優先使用明確傳入的 workspaceId（避免 React state 尚未更新的時序問題）
    const wsId = options?.workspaceId || selectedWorkspaceId

    if (folderId === '') {
      window.location.hash = ''
      setSelectedFolderId(null)
      setCurrentPage(null)
      setMarkdownText('')
      editor?.commands.clearContent()
      resetEditorHistory(editor)
      settingsService.saveSelectedFolder(null, wsId)
      return
    }

    // 設置 ref 標記，讓 hashchange 監聯器知道不要切換視圖
    if (options?.skipViewChange) {
      skipViewChangeRef.current = true
    }

    // ★ Portrait 模式：設定標記，讓 handleHashChange 不要自動跳到 editor
    if (isPortraitMode) {
      skipViewChangeRef.current = true
    }

    // 讀取 folder 和其 pages
    const folder = await db(wsId).getFolder(folderId)
    const pages = await db(wsId).getPagesByFolder(folderId)

    // 決定 targetPageId
    let targetPageId: string | undefined

    if (folder?.lastSelectedPageId) {
      // 驗證 page 是否存在於此 folder
      const page = pages.find(p => p.id === folder.lastSelectedPageId)
      if (page) {
        targetPageId = folder.lastSelectedPageId
      }
    }

    // Fallback: 選擇第一個 page（按 updatedAt 排序）
    if (!targetPageId && pages.length > 0) {
      const sortedPages = [...pages].sort((a, b) => b.updatedAt - a.updatedAt)
      targetPageId = sortedPages[0].id
    }

    // 更新 URL（統一帶 page）
    const newHash = targetPageId
      ? `folder=${folderId}&page=${targetPageId}`
      : `folder=${folderId}`

    if (window.location.hash !== `#${newHash}`) {
      window.location.hash = newHash
    }

    setSelectedFolderId(folderId)

    // 只有非 Trash folder 才保存到 localStorage
    // 避免 Trash folder 污染全局狀態（支援新舊格式）
    if (!isTrashFolderId(folderId)) {
      // 傳入 workspaceId 以便按 workspace 保存最近選取的 folder
      settingsService.saveSelectedFolder(folderId, wsId)
    }

    // 只在非 skipViewChange 時切換視圖（新增資料夾時跳過，保持在當前視圖）
    if (!options?.skipViewChange && isPortraitMode) {
      navigateToView('pages')
    }
  }

  // Mobile：依序返回上一層視圖（四層：workspaces → folders → pages → editor）
  const handleMobileBack = useCallback(() => {
    if (mobileView === 'editor') {
      navigateToView('pages')
    } else if (mobileView === 'pages') {
      navigateToView('folders')
    } else if (mobileView === 'folders') {
      navigateToView('workspaces')
    }
    // 在 workspaces 視圖時不做任何動作
  }, [mobileView, navigateToView])

  // Landscape 模式的「〈」返回導航：LF → LE → LP → LF（循環）
  const handleLandscapeBack = () => {
    switch (desktopSidebarMode) {
      case 'full':
        // LF → LE：收起 sidebar
        setDesktopSidebarMode('hidden')
        break
      case 'hidden':
        // LE → LP：顯示 pageList
        setDesktopSidebarMode('pageOnly')
        break
      case 'pageOnly':
        // LP → LF：顯示完整 sidebar
        setDesktopSidebarMode('full')
        break
    }
  }

  // 關閉所有 Slide Panel
  const closeAllPanels = useCallback(() => {
    setShowSettingsPanel(false)
    setShowSearchPanel(false)
    setShowFeedbackPanel(false)
    setShowInstallPanel(false)
  }, [])

  // Home 按鈕：Portrait 時 W ↔ F toggle，Desktop 維持原行為
  const handleGoHome = useCallback(() => {
    // 關閉所有 Panel
    closeAllPanels()
    if (isPortraitMode) {
      // E 或 P → W（維持現行一鍵回家行為）
      if (mobileView === 'editor' || mobileView === 'pages') {
        navigateToView('workspaces')
      }
      // W ↔ F toggle
      else if (mobileView === 'workspaces') {
        navigateToView('folders')
      }
      else if (mobileView === 'folders') {
        navigateToView('workspaces')
      }
      // search → W（合理預設）
      else {
        navigateToView('workspaces')
      }
    } else {
      // Desktop/Landscape：維持原行為（顯示 Workspace List）
      setShowWorkspaceList(true)
      setDesktopSidebarMode('full')
    }
  }, [isPortraitMode, mobileView, navigateToView])

  // 切換 Workspace List 顯示（Desktop）
  const handleToggleWorkspaceList = () => {
    setShowWorkspaceList(prev => {
      if (!prev) {
        // 展開時，設定為 full 模式，確保收合後回到 LF
        setDesktopSidebarMode('full')
      }
      return !prev
    })
  }

  // 選擇 Workspace
  const handleSelectWorkspace = useCallback(async (workspaceId: WorkspaceId) => {
    settingsService.saveSelectedWorkspace(workspaceId)

    // 先等 DB 就緒
    await dbInit.switchWorkspace(workspaceId)
    await ensureSystemStructureExists(workspaceId)

    // DB 就緒後才更新所有 React state，觸發 re-render
    setShowWorkspaceList(false)
    setSelectedWorkspaceId(workspaceId)

    // 觸發 Sidebar 刷新以顯示新 workspace 的 folders
    setTriggerRefresh(prev => prev + 1)

    // 切換到該 workspace 最近選取的 folder（或 root folder）
    let targetFolderId = settingsService.getSelectedFolder(workspaceId)

    // 驗證 folder 是否存在且不是 trash folder，否則 fallback 到 root folder
    if (targetFolderId) {
      const folder = await db(workspaceId).getFolder(targetFolderId)
      if (!folder || isTrashFolderId(targetFolderId)) {
        targetFolderId = null
      }
    }

    // Fallback: 使用統一的 root folder ID（V10）
    if (!targetFolderId) {
      targetFolderId = ROOT_FOLDER_ID
    }

    await handleSelectFolder(targetFolderId, { skipViewChange: true, workspaceId })

    // Portrait: workspace 選擇後應進入 folder view（PF），不是 page view
    if (isPortraitMode) {
      navigateToView('folders')
    }
  }, [handleSelectFolder, isPortraitMode, navigateToView, editor])

  // 輪流切換 Workspace（Desktop WorkspaceHeader 點擊 / Portrait 標題點擊）
  const handleCycleWorkspace = useCallback(async () => {
    // 按照使用者設定的 workspaceOrder 順序切換
    const settings = settingsService.getSyncedSettings()
    const orderedIds = (settings.workspaceOrder || ['local']) as WorkspaceId[]
    const currentIndex = orderedIds.indexOf(selectedWorkspaceId)
    const nextIndex = (currentIndex + 1) % orderedIds.length
    const nextWorkspaceId = orderedIds[nextIndex]

    await handleSelectWorkspace(nextWorkspaceId)

    // Portrait 模式：切換後顯示 Folder 視圖（PF）
    if (isPortraitMode) {
      setMobileView('folders')
    }
  }, [selectedWorkspaceId, handleSelectWorkspace, isPortraitMode])


  // Toggle 搜尋（Portrait: 記住之前的視圖，Desktop: toggle panel）
  const handleSearch = useCallback(() => {
    if (isPortraitMode) {
      // Portrait: 關閉其他 Panel
      closeAllPanels()
      setMobileView(prev => {
        if (prev === 'search') {
          // 關閉 search，返回之前的視圖
          return previousMobileView
        } else {
          // 開啟 search，記錄當前視圖
          setPreviousMobileView(prev)
          return 'search'
        }
      })
    } else {
      // Desktop/Landscape: 如果 Search 已開啟，直接關閉
      if (showSearchPanel) {
        setShowSearchPanel(false)
        return
      }
      // 否則關閉所有 Panel 再開啟 Search
      closeAllPanels()
      setShowSearchPanel(true)
    }
  }, [isPortraitMode, previousMobileView])

  // 關閉搜尋（供 SearchPage 關閉按鈕使用）
  const handleCloseSearch = useCallback(() => {
    if (isPortraitMode) {
      // Portrait: 返回之前的視圖
      setMobileView(previousMobileView)
    } else {
      // Desktop/Landscape: 關閉 panel
      setShowSearchPanel(false)
    }
  }, [isPortraitMode, previousMobileView])

  // 搜尋結果選擇頁面
  const handleSearchSelectPage = useCallback((page: Page) => {
    // 關閉搜尋
    setShowSearchPanel(false)
    if (isPortraitMode) {
      // 直接切換到 editor（不使用過場動畫，因為 search 會自己淡出）
      setMobileView('editor')
    }
    // 選擇頁面
    handleSelectPage(page)
  }, [isPortraitMode, handleSelectPage])

  // 分享功能（簡化版）
  const handleShare = useCallback(() => {
    // 關閉所有 Panel
    closeAllPanels()
    if (isPortraitMode && mobileView === 'search') {
      setMobileView(previousMobileView)
    }
    // 使用瀏覽器原生分享 API 或複製到剪貼簿
    if (navigator.share && markdownText) {
      navigator.share({
        title: currentPage?.name || 'PenPage Note',
        text: markdownText,
      }).catch(() => {})
    } else if (markdownText) {
      navigator.clipboard.writeText(markdownText).then(() => {
        showToast('Copied to clipboard')
      }).catch(() => {})
    }
  }, [isPortraitMode, mobileView, previousMobileView, markdownText, currentPage, showToast])

  // Toggle Settings Panel
  const handleToggleSettings = useCallback(() => {
    // 如果 Settings 已開啟，直接關閉
    if (showSettingsPanel) {
      setShowSettingsPanel(false)
      return
    }
    // 否則關閉所有 Panel 再開啟 Settings
    closeAllPanels()
    if (isPortraitMode && mobileView === 'search') {
      setMobileView(previousMobileView)
    }
    setShowSettingsPanel(true)
  }, [showSettingsPanel, isPortraitMode, mobileView, previousMobileView, closeAllPanels])

  // 從 NavigationRail 建立新 Page
  const handleCreateNewPage = async () => {
    // 關閉所有 Panel
    closeAllPanels()

    // Portrait 模式：使用 flushSync 同步切換視圖並 focus
    // iOS Safari 的鍵盤只能在用戶交互事件的同步調用棧中彈出
    if (isPortraitMode) {
      // flushSync 強制同步更新 DOM
      flushSync(() => {
        setTransitionPreviousView(mobileView)
        setTransitionDirection('forward')
        setTransitionAnimate(false)
        setMobileView('editor')
      })

      // 此時 DOM 已更新，編輯器可見
      // 在用戶交互的同步棧中 focus（觸發鍵盤）
      // 使用 preventScroll 避免自動滾動干擾過場動畫
      if (!isMarkdownMode) {
        const editorDom = editor?.view?.dom as HTMLElement
        if (editorDom) {
          editorDom.focus({ preventScroll: true })
          editor?.commands.setTextSelection(1)
        }
      } else if (markdownTextareaRef.current) {
        markdownTextareaRef.current.focus({ preventScroll: true })
        markdownTextareaRef.current.setSelectionRange(0, 0)
      }

      // 觸發過場動畫（flushSync 已同步更新 DOM，單一 RAF 即可）
      requestAnimationFrame(() => {
        setTransitionAnimate(true)
      })

      // 300ms 後清除過場狀態
      setTimeout(() => {
        setTransitionPreviousView(null)
        setTransitionDirection(null)
        setTransitionAnimate(false)
      }, 300)
    }

    try {
      // 異步創建頁面（此時鍵盤已彈出）
      const { folder, page } = await ensureFolderAndPage(selectedFolderId, selectedWorkspaceId)

      setSelectedFolderId(folder.id)
      setCurrentPage(page)
      setMarkdownText(page.content)
      setSyncStatus('saved')

      // 載入預設內容（pageHelper 會塞入 `# MM-DD` 預設 heading）
      // 補空段落讓 heading 後 placeholder hint 能顯示
      const html = markdownToHtml(page.content)
      editor?.commands.setContent(
        html && !html.includes('<p') ? html + '<p></p>' : (html || '<p></p>')
      )
      resetEditorHistory(editor)

      settingsService.saveSelectedFolder(folder.id, selectedWorkspaceId)
      setTriggerRefresh(prev => prev + 1)

      // 更新 URL hash（db.updateFolderLastSelectedPage 會在 handleSelectPage 被呼叫）
      window.location.hash = `folder=${folder.id}&page=${page.id}`

      // Desktop 模式：延遲 focus
      if (!isPortraitMode) {
        setTimeout(() => {
          if (!isMarkdownMode) {
            // 游標落在 `# MM-DD` 結尾（pageHelper 已塞入 editorState.wysiwygCursorPosition）
            editor?.chain().focus().setTextSelection(page.editorState?.wysiwygCursorPosition ?? 1).run()
          } else if (markdownTextareaRef.current) {
            markdownTextareaRef.current.focus()
            // Markdown textarea 游標落在 `# MM-DD` 結尾（去掉 trailing \n）
            const mdPos = Math.max(0, page.content.length - 1)
            markdownTextareaRef.current.setSelectionRange(mdPos, mdPos)
          }
        }, 100)
      }
    } catch (e: any) {
      // 加密資料夾未解鎖時，彈出解鎖對話框
      console.error('Failed to create new page:', e)
    }
  }

  // 統一的匯入結果處理函數（檔案匯入 / 目錄匯入 / 子目錄匯入共用）
  const navigateToImportResult = async (options: {
    folder?: Folder | null
    page?: Page | null
    toastMessage?: string | null
  }) => {
    const { folder, page, toastMessage } = options

    if (folder) {
      // 目錄匯入：切換到新建的資料夾
      setSelectedFolderId(folder.id)
      settingsService.saveSelectedFolder(folder.id, selectedWorkspaceId)

      if (page && page.folderId === folder.id) {
        // 有頁面在此資料夾
        setCurrentPage(page)
        setMarkdownText(page.content)
        setSyncStatus('saved')

        const htmlContent = markdownToHtml(page.content)
        editor?.commands.setContent(htmlContent)

        await db(selectedWorkspaceId).updateFolderLastSelectedPage(folder.id, page.id)
        window.location.hash = `folder=${folder.id}&page=${page.id}`
      } else {
        // 沒有頁面，只切換到資料夾
        setCurrentPage(null)
        setMarkdownText('')
        editor?.commands.clearContent()
        window.location.hash = `folder=${folder.id}`
      }
    } else if (page) {
      // 檔案匯入：切換到 page 所在資料夾
      setSelectedFolderId(page.folderId)
      setCurrentPage(page)
      setMarkdownText(page.content)
      setSyncStatus('saved')

      const htmlContent = markdownToHtml(page.content)
      editor?.commands.setContent(htmlContent)

      settingsService.saveSelectedFolder(page.folderId, selectedWorkspaceId)
      await db(selectedWorkspaceId).updateFolderLastSelectedPage(page.folderId, page.id)
      window.location.hash = `folder=${page.folderId}&page=${page.id}`
    }

    setTriggerRefresh(prev => prev + 1)

    // Portrait: 切換視圖
    if (isPortraitMode) {
      if (folder) {
        navigateToView('pages')
      } else if (page) {
        navigateToView('editor')
      }
    }

    // 載入圖片 + 游標定位
    setTimeout(() => {
      if (page && !isMarkdownMode && editor) {
        const html = markdownToHtml(page.content)
        editor.commands.setContent(html || '<p></p>')
      }
      convertImageUrls()

      if (page) {
        if (!isMarkdownMode) {
          editor?.chain().focus().setTextSelection(1).run()
        } else if (markdownTextareaRef.current) {
          markdownTextareaRef.current.focus()
          markdownTextareaRef.current.setSelectionRange(0, 0)
        }
      }
    }, 100)

    // 顯示 Toast
    if (toastMessage) {
      showToast(toastMessage)
    }
  }

  // 處理 Markdown 檔案匯入（單檔入口：檔案關聯開啟時觸發）
  const handleMarkdownFileImport = async (filename: string, content: string, lastModified?: number) => {
    closeAllPanels()
    try {
      const targetFolderId = resolveTargetFolderId(selectedFolderId)
      const result = await importMarkdownFiles(
        [{ name: filename, content, lastModified }],
        targetFolderId,
        selectedWorkspaceId
      )
      await handleImportResult(result, 1)
    } catch (e: any) {
      console.error('Failed to import markdown file:', e)
    }
  }

  // 同步 ref（每次渲染都更新）
  handleMarkdownFileImportRef.current = handleMarkdownFileImport

  // 監聽系統檔案關聯開啟事件（使用者雙擊 .md 檔案時觸發）
  useFileLaunchListener(handleMarkdownFileImport)

  // 處理按鈕選擇 Markdown 檔案匯入（Settings Panel 的 Import 按鈕）— 純匯入，不建立連結
  const handleImportMarkdown = () => {
    selectMarkdownFiles(async (files) => {
      try {
        const targetFolderId = resolveTargetFolderId(selectedFolderId)
        const result = await importMarkdownFiles(files, targetFolderId, selectedWorkspaceId)
        await handleImportResult(result, files.length)
      } catch (e: any) {
        console.error('Failed to import markdown files:', e)
      }
    })
  }

  // 儲存目錄 link（dirHandle + folderDirLink + pageLinks）
  const saveDirectoryLinks = async (
    dirHandle: FileSystemDirectoryHandle,
    handleId: string,
    subPath: string,
    folderId: string,
    result: DirectoryImportResult
  ) => {
    // 儲存 folderDirLink（記錄所屬 workspace）
    await saveFolderDirLink(folderId, handleId, subPath, selectedWorkspaceId)

    // 儲存每個 page 的 link + 初始化 sync state
    if (result.pageFileMap) {
      for (const [pageId, fileName] of result.pageFileMap) {
        await savePageLink(pageId, folderId, fileName)
        // 初始化同步快照
        const page = await db(selectedWorkspaceId).getPage(pageId)
        if (page) {
          // 透過 dirHandle 取得檔案的 lastModified
          try {
            let dir = dirHandle
            if (subPath) {
              for (const part of subPath.split('/')) {
                dir = await dir.getDirectoryHandle(part)
              }
            }
            const fileHandle = await dir.getFileHandle(fileName)
            const file = await fileHandle.getFile()
            await updatePageSyncState(pageId, file.lastModified, page.contentHash || '')
          } catch {
            // 檔案不存在，跳過初始化
          }
        }
      }
    }
  }

  // 處理目錄選擇匯入（Settings Panel 的 Directory 選項）
  const handleImportDirectory = () => {
    if (isFileHandleSupported()) {
      ;(async () => {
        try {
          const { dirHandle, files, subDirectories } = await selectDirectoryWithHandles()

          // 檢查是否已 link 過相同目錄
          const existing = await findDirHandleBySameEntry(dirHandle)
          let handleId: string

          if (existing) {
            // 已存在：檢查根層是否已 link
            const rootLinked = await isSubPathLinked(existing.handleId, '')
            if (rootLinked) {
              showToast('此目錄已連結')
              return
            }
            handleId = existing.handleId
          } else {
            // 新目錄：儲存 dirHandle
            handleId = await saveDirHandle(dirHandle)
          }

          if (files.length === 0) {
            showToast('目錄中沒有 Markdown 檔案')
            return
          }

          const targetFolderId = resolveTargetFolderId(selectedFolderId)
          const result = await importDirectoryFiles(files, targetFolderId, dirHandle.name, selectedWorkspaceId)

          // 儲存 directory links
          if (result.rootFolder) {
            await saveDirectoryLinks(dirHandle, handleId, '', result.rootFolder.id, result)
          }

          await handleDirectoryImportResult(result)

          // 彈出子目錄選擇對話框
          if (subDirectories.length > 0) {
            // 過濾已 link 的子目錄
            const unlinked: string[] = []
            for (const dir of subDirectories) {
              if (!(await isSubPathLinked(handleId, dir))) {
                unlinked.push(dir)
              }
            }
            if (unlinked.length > 0) {
              setSubDirPicker({
                dirHandle,
                handleId,
                subDirectories: unlinked,
                parentFolderId: result.rootFolder!.id,
              })
            }
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') return
          console.error('Failed to import directory:', e)
        }
      })()
    } else {
      // 降級：一般 webkitdirectory（不支援 link）
      selectDirectory(async (files: DirectoryFile[]) => {
        if (files.length === 0) {
          showToast('目錄中沒有 Markdown 檔案')
          return
        }
        try {
          const targetFolderId = resolveTargetFolderId(selectedFolderId)
          // 降級模式：用第一個檔案的路徑取得目錄名
          const firstPath = files[0].relativePath
          const dirName = firstPath.split('/')[0] || 'Imported'
          const result = await importDirectoryFiles(files, targetFolderId, dirName, selectedWorkspaceId)
          await handleDirectoryImportResult(result)
        } catch (e: any) {
          console.error('Failed to import directory:', e)
        }
      })
    }
  }

  // 處理子目錄批次匯入（SubDirPickerDialog 確認後）
  const handleSubDirImport = async (selectedDirs: string[]) => {
    if (!subDirPicker || selectedDirs.length === 0) {
      setSubDirPicker(null)
      return
    }

    const { dirHandle, handleId, parentFolderId } = subDirPicker
    setSubDirPicker(null)

    let totalPages = 0
    let totalFolders = 0
    let totalDuplicates = 0
    let lastResult: DirectoryImportResult | null = null

    for (const subDir of selectedDirs) {
      try {
        // 掃描子目錄的 .md 檔案
        const files = await scanSubDirectory(dirHandle, subDir)
        if (files.length === 0) continue

        // 匯入到 parentFolder 下（parentFolderId = rootFolder.id，即 /doc）
        const result = await importDirectoryFiles(files, parentFolderId, subDir, selectedWorkspaceId)

        // 儲存 directory links
        if (result.rootFolder) {
          await saveDirectoryLinks(dirHandle, handleId, subDir, result.rootFolder.id, result)
          totalFolders++
          totalPages += result.pagesCreated
          totalDuplicates += result.duplicateCount
          lastResult = result
        }
      } catch (e) {
        console.error(`Failed to import subdirectory ${subDir}:`, e)
      }
    }

    if (lastResult) {
      // 使用統一的匯入結果處理（導航到最後匯入的子目錄）
      const toastMessage = getDirectoryImportToastMessage({
        foldersCreated: totalFolders,
        pagesCreated: totalPages,
        duplicateCount: totalDuplicates,
        rootFolder: lastResult.rootFolder,
        lastPage: lastResult.lastPage,
      })
      await navigateToImportResult({
        folder: lastResult.rootFolder,
        page: lastResult.lastPage,
        toastMessage,
      })
    }
  }

  // 處理全區拖放 md 檔案（排除 NavigationRail）
  const handleAppDragOver = (e: React.DragEvent) => {
    // 排除 NavigationRail 區域
    if ((e.target as HTMLElement).closest('.navigation-rail')) {
      return
    }
    // 檢查是否有檔案
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // handleImportResult 和 handleDirectoryImportResult 的包裝函數
  const handleImportResult = async (result: ImportResult, totalFiles: number) => {
    await navigateToImportResult({
      page: result.lastPage,
      toastMessage: getImportToastMessage(result, totalFiles),
    })
  }

  const handleDirectoryImportResult = async (result: DirectoryImportResult) => {
    await navigateToImportResult({
      folder: result.rootFolder,
      page: result.lastPage,
      toastMessage: getDirectoryImportToastMessage(result),
    })
  }

  const handleAppDrop = async (e: React.DragEvent) => {
    // 排除 NavigationRail 區域
    if ((e.target as HTMLElement).closest('.navigation-rail')) {
      return
    }

    // 立即阻止瀏覽器預設行為（開啟檔案到新分頁）
    e.preventDefault()
    e.stopPropagation()

    const items = e.dataTransfer?.items
    const files = e.dataTransfer?.files

    // 檢查是否有目錄（Chrome/Edge 支援）
    if (items && hasDirectoryEntry(items)) {
      closeAllPanels()

      try {
        const nodes = await readDirectoryEntries(items)
        if (nodes && nodes.length > 0) {
          // 檢查是否有 .md 檔案
          const mdCount = countMarkdownFiles(nodes)
          if (mdCount === 0) {
            showToast('目錄中沒有 Markdown 檔案')
            return
          }

          const targetFolderId = resolveTargetFolderId(selectedFolderId)
          const result = await importDirectoryStructure(nodes, targetFolderId, selectedWorkspaceId)
          await handleDirectoryImportResult(result)
          return
        }
        // nodes 為 null 或空，降級到檔案處理
      } catch (err: any) {
        console.error('Failed to import directory:', err)
        // 降級到檔案處理
      }
    }

    // 原有邏輯：檔案處理
    if (!files || files.length === 0) return

    // 收集 Markdown 檔案
    const markdownFileList: MarkdownFile[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.match(/\.(md|markdown)$/i)) {
        const content = await file.text()
        if (content) {
          markdownFileList.push({ name: file.name, content, lastModified: file.lastModified })
        }
      }
    }

    if (markdownFileList.length === 0) return

    closeAllPanels()

    try {
      const targetFolderId = resolveTargetFolderId(selectedFolderId)
      const result = await importMarkdownFiles(markdownFileList, targetFolderId, selectedWorkspaceId)
      await handleImportResult(result, markdownFileList.length)
    } catch (err: any) {
      console.error('Failed to import markdown files:', err)
    }
  }

  const handleEditorFocus = async () => {
    if (!currentPage) {
      if (selectedFolderId && isTrashFolderId(selectedFolderId)) {
        return
      }
      try {
        const { folder, page } = await ensureFolderAndPage(selectedFolderId, selectedWorkspaceId)
        setSelectedFolderId(folder.id)
        setCurrentPage(page)
        setMarkdownText(page.content)
        setSyncStatus('saved')
        settingsService.saveSelectedFolder(folder.id, selectedWorkspaceId)
        // 更新 folder.lastSelectedPageId
        await db(selectedWorkspaceId).updateFolderLastSelectedPage(folder.id, page.id)
        setTriggerRefresh(prev => prev + 1)
        // 游標落在 `# MM-DD` 結尾（pageHelper 已塞入 editorState.wysiwygCursorPosition）
        editor?.chain().focus().setTextSelection(page.editorState?.wysiwygCursorPosition ?? 1).run()
      } catch (e: any) {
        // 加密資料夾未解鎖時，彈出解鎖對話框
        console.error(e)
      }
    }
  }

  const handleOpenLinkDialog = () => {
    const { from, to } = editor?.state.selection || { from: 0, to: 0 }
    const text = editor?.state.doc.textBetween(from, to, '') || ''
    const linkMark = editor?.getAttributes('link')
    setLinkUrl(linkMark?.href || '')
    setLinkText(text)
    setShowLinkDialog(true)
  }

  const handleInsertLink = () => {
    if (!linkUrl || !editor) return
    const { from, to } = editor.state.selection
    const text = linkText || editor.state.doc.textBetween(from, to, '')
    editor.chain().focus()
      .deleteSelection()
      .insertContent({ type: 'text', text: text, marks: [{ type: 'link', attrs: { href: linkUrl } }] })
      .run()
    setShowLinkDialog(false); setLinkUrl(''); setLinkText('')
  }

  const handleRemoveLink = () => {
    editor?.chain().focus().unsetLink().run()
    setShowLinkDialog(false); setLinkUrl(''); setLinkText('')
  }

  const handleRestore = async () => {
    if (!currentPage) return
    try {
      const { restorePageFromRecycle } = await import('../services/recycleBin')
      await restorePageFromRecycle(currentPage.id, selectedWorkspaceId)
      setTriggerRefresh(prev => prev + 1)
    } catch (e) { alert('Restore failed') }
  }

  if (!editor || !dbInitialized) return <div className="loading">Loading...</div>

  // 計算過場動畫相關的 CSS class
  const transitionClasses = isPortraitMode && transitionDirection
    ? `transitioning ${transitionDirection} ${transitionAnimate ? 'animate' : ''} prev-view-${transitionPreviousView}`
    : ''

  return (
    <div
      className={`app-container mobile-view-${mobileView} ${transitionClasses}`}
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
    >
      <NavigationRail
        currentView={currentView}
        onGoHome={handleGoHome}
        onCreateNewPage={handleCreateNewPage}
        onSearch={handleSearch}
        onOpenSettings={handleToggleSettings}
        onShare={handleShare}
        selectedPageId={currentPage?.id}
      />
      
      <Sidebar
        onSelectPage={handleSelectPage}
        onSelectFolder={handleSelectFolder}
        selectedFolderId={selectedFolderId}
        lastSelectedPageId={currentPage?.id || null}
        selectedPage={currentPage}
        refreshTrigger={triggerRefresh}
        mobileView={mobileView}
        desktopSidebarMode={desktopSidebarMode}
        selectedWorkspaceId={selectedWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        showWorkspaceList={showWorkspaceList}
        onToggleWorkspaceList={handleToggleWorkspaceList}
        onCycleWorkspace={handleCycleWorkspace}
        onCreatePage={handleCreateNewPage}
        onMobileBack={handleMobileBack}
        currentView={currentView}
        currentOrientation={isPortraitMode ? 'P' : 'L'}
        onLandscapeBack={handleLandscapeBack}
        transitionPreviousView={transitionPreviousView}
      />

      <div className="editor-container">
        <div className="editor-wrapper">
          {/* Toolbar Wrapper for iOS keyboard fix (Sticky + Margin approach) */}
          <div className={`toolbar-wrap ${isPortraitMode && mobileView === 'editor' && isEditorFocused ? 'keyboard-mode' : ''}`} ref={toolbarWrapRef}>
            <EditorToolbar
              editor={editor}
              isMarkdownMode={isMarkdownMode}
              isReadOnly={isReadOnly}
              syncStatus={displayStatus}
              onToggleMarkdownMode={handleToggleMarkdownMode}
              onOpenLinkDialog={handleOpenLinkDialog}
              onMobileBack={handleMobileBack}
              showLandscapeBack={!isPortraitMode && currentView === 'E'}
              onLandscapeBack={handleLandscapeBack}
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* 垃圾桶頁面提示 banner */}
          {isReadOnly && currentPage && (
            <div className="trash-banner">
              <div className="trash-banner-content">
                <span className="trash-banner-text">
                  {currentPage.name?.startsWith('[Conflict]')
                    ? 'This is a conflict backup. You can restore it to compare with the current version.'
                    : 'This page is in the Trash.'}
                </span>
              </div>
              <button className="trash-banner-restore" onClick={handleRestore}>
                Restore
              </button>
            </div>
          )}

          <div className={`editor-content ${showLineNumbers ? 'show-line-numbers' : ''}`}>
            {/* Markdown Mode */}
            <div
              className={`markdown-editor ${isMarkdownMode ? 'active' : ''}`}
              style={{ display: isMarkdownMode ? 'flex' : 'none', flexDirection: 'row', flex: 1 }}
            >
              {showLineNumbers && isMarkdownMode && (
                <MarkdownLineGutter
                  text={markdownText}
                  textareaRef={markdownTextareaRef}
                />
              )}
              <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {currentLineHighlight && (
                  <div
                    className="current-line-highlight"
                    style={{
                      top: currentLineHighlight.top + 'px',
                      height: currentLineHighlight.height + 'px'
                    }}
                  />
                )}
                <textarea
                  ref={markdownTextareaRef}
                  value={markdownText}
                  onChange={(e) => setMarkdownText(e.target.value)}
                  placeholder="⬆ Black button switch to WYSIWYG editor

Here is Markdown Source Editor"
                  spellCheck={false}
                  style={{ flex: 1, height: '100%' }}
                />
              </div>
            </div>

            {/* WYSIWYG Mode */}
            <div
              ref={setWysiwygEditorEl}
              className={`wysiwyg-editor ${!isMarkdownMode ? 'active' : ''}`}
              style={{ display: !isMarkdownMode ? 'block' : 'none', flex: 1 }}
              onClick={handleEditorFocus}
            >
              {showLineNumbers && lineEntries.length > 0 && (
                <div className="line-gutter">
                  {lineEntries.map((e) => (
                    <span key={e.num} className="line-num" style={{ top: e.top }}>
                      {e.num}
                    </span>
                  ))}
                </div>
              )}
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {showLinkDialog && (
        <LinkDialog
          isOpen={showLinkDialog}
          linkText={linkText}
          linkUrl={linkUrl}
          isEditing={!!linkText}
          onClose={() => setShowLinkDialog(false)}
          onLinkTextChange={setLinkText}
          onLinkUrlChange={setLinkUrl}
          onInsertLink={handleInsertLink}
          onRemoveLink={handleRemoveLink}
        />
      )}


      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        onSettingsChange={() => setTriggerRefresh(prev => prev + 1)}
        onOpenFeedback={() => { setShowSettingsPanel(false); setShowFeedbackPanel(true) }}
        onOpenInstall={() => { setShowSettingsPanel(false); setShowInstallPanel(true) }}
        onImportMarkdown={handleImportMarkdown}
        onImportDirectory={handleImportDirectory}
      />

      {/* Search Page */}
      <SearchPage
        isOpen={showSearchPanel || mobileView === 'search'}
        onClose={handleCloseSearch}
        onSelectPage={handleSearchSelectPage}
        workspaceId={selectedWorkspaceId}
      />

      {/* Feedback Panel */}
      <FullHeightPanel
        isOpen={showFeedbackPanel}
        onClose={() => setShowFeedbackPanel(false)}
        title="Feedback"
      >
        <FeedbackPage />
      </FullHeightPanel>

      {/* Install Guide Panel */}
      <FullHeightPanel
        isOpen={showInstallPanel}
        onClose={() => setShowInstallPanel(false)}
        title="Install PenPage APP"
      >
        <InstallGuidePage />
      </FullHeightPanel>

      {/* 子目錄選擇對話框 */}
      <SubDirPickerDialog
        isOpen={subDirPicker !== null}
        subDirectories={subDirPicker?.subDirectories || []}
        onConfirm={handleSubDirImport}
        onCancel={() => setSubDirPicker(null)}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Debug Panel - 暫時用於 iOS 調試（目前隱藏） */}
      {/* {isPortraitMode && <DebugPanel />} */}
    </div>
  )
}

export default MarkdownEditor
