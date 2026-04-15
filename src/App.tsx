import { useState, useEffect, useCallback } from 'react'
import MarkdownEditor from './components/MarkdownEditor'
import ToastContainer from './components/ToastContainer'
import { useToast } from './hooks/useToast'
import { useDisablePinchZoom } from './hooks/useDisablePinchZoom'
import LandingPage from './components/LandingPage'
import LandingPageD from './components/LandingPageD'
import HelpPage from './components/HelpPage'
import FeedbackPage from './components/FeedbackPage'
import InstallGuidePage from './components/InstallGuidePage'
import ReloadPrompt from './components/ReloadPrompt'
import { NavigationRail } from './components/NavigationRail'
import { applyTheme, applyFontSize } from './config/themes'
import { settingsService } from './services/settings'
import { dbInit } from './services/db'
import { runMigrations } from './services/migration'
import { ensureGuideContent } from './services/guideContent'
import { useOrientation } from './contexts/OrientationContext'

/**
 * 帶 NavigationRail 的頁面佈局
 * 用於 Feedback、InstallGuide 頁面
 */
interface PageWithNavLayoutProps {
  children: React.ReactNode
}

function PageWithNavLayout({ children }: PageWithNavLayoutProps) {
  const { isPortraitMode } = useOrientation()

  const handleBackToMain = () => {
    window.location.hash = '#/'
  }

  return (
    <div className={`page-with-nav ${isPortraitMode ? 'mobile' : 'desktop'}`}>
      <NavigationRail
        currentView="E"
        onGoHome={handleBackToMain}
        onCreateNewPage={handleBackToMain}
        onSearch={() => {}}
        onOpenSettings={() => {}}
        onShare={() => {}}
      />
      <div className="page-content">
        {children}
      </div>
    </div>
  )
}

function App() {
  return <AppMain />
}

function AppMain() {

  // Pinch-to-zoom 防止 + scale 偵測 toast
  const toast = useToast()
  const handleScaleChange = useCallback((scale: number) => {
    toast.warning(`Page zoomed (scale: ${scale}), double-tap to reset`)
  }, [])
  useDisablePinchZoom({ onScaleChange: handleScaleChange })

  // 全局 DB 初始化狀態
  const [dbInitialized, setDbInitialized] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

  // 全局 DB 初始化（確保所有頁面都能存取 DB）
  useEffect(() => {
    const initDB = async () => {
      try {
        await dbInit.init()
        await runMigrations(settingsService.getSelectedWorkspace())
        setDbInitialized(true)

        // 建立/更新示範筆記（不阻塞 UI）
        ensureGuideContent().catch(console.error)
      } catch (error: any) {
        console.error('Failed to initialize database:', error)
        setDbError(error.message || 'Database initialization failed')
      }
    }
    initDB()
  }, [])

  // 初始化主題和字體大小（根據裝置類型套用對應設定）
  useEffect(() => {
    const settings = settingsService.getSyncedSettings()
    applyTheme(settings.theme)
    const fontSizes = settingsService.getCurrentDeviceFontSize()
    applyFontSize(fontSizes.interfaceFontSize, fontSizes.contentFontSize)
  }, [])

  // 檢查當前路由（使用簡單的 hash routing 避免需要後端配置）
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.hash.slice(1) || '/'
  })

  // 檢查是否已訪問過（首次訪問顯示 Landing Page）
  const [hasVisited, setHasVisited] = useState(() => {
    return localStorage.getItem('hasVisited') === 'true'
  })

  // 監聽 hash 變化
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.slice(1) || '/')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // 處理開始使用
  const handleGetStarted = () => {
    localStorage.setItem('hasVisited', 'true')
    setHasVisited(true)
    window.location.hash = '#/'
  }

  // 標記使用者已在 app 內導航（首次載入時設定）
  useEffect(() => {
    const markNavigation = () => {
      sessionStorage.setItem('ppage_has_navigation', 'true')
    }
    window.addEventListener('hashchange', markNavigation, { once: false })
    return () => window.removeEventListener('hashchange', markNavigation)
  }, [])

  // 路由渲染
  const renderRoute = () => {
    if (currentPath === '/help') {
      return <HelpPage />
    }

    if (currentPath === '/landing') {
      return <LandingPage onGetStarted={handleGetStarted} />
    }

    if (currentPath === '/landing-d') {
      return <LandingPageD onGetStarted={handleGetStarted} />
    }

    if (currentPath === '/feedback') {
      return (
        <PageWithNavLayout>
          <FeedbackPage />
        </PageWithNavLayout>
      )
    }

    if (currentPath === '/install') {
      return (
        <PageWithNavLayout>
          <InstallGuidePage />
        </PageWithNavLayout>
      )
    }

    // 首頁路由
    if (currentPath === '/' || currentPath === '') {
      if (!hasVisited) {
        return <LandingPageD onGetStarted={handleGetStarted} />
      }
      return <MarkdownEditor />
    }

    // 404 - 返回首頁
    return <MarkdownEditor />
  }

  // DB 初始化中顯示 loading
  if (!dbInitialized) {
    if (dbError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: '#ef4444',
          fontFamily: 'system-ui, sans-serif',
        }}>
          Error: {dbError}
        </div>
      )
    }
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'system-ui, sans-serif',
      }}>
        Loading...
      </div>
    )
  }

  return (
    <>
      {renderRoute()}
      <ReloadPrompt />
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </>
  )
}

export default App
