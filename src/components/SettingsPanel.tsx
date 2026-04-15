/**
 * Settings Panel Component
 * Slide-over Panel 設計的設定面板
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { VERSION_INFO } from '../config/version'
import { settingsService, SyncedSettings, isMobileDevice } from '../services/settings'
import { applyTheme, getAvailableThemes, applyFontSize, FONT_SIZE_LIMITS } from '../config/themes'
import { exportAllToLocal, importAllFromLocal } from '../utils/localExportImport'
import { useToast } from '../hooks/useToast'
import ToastContainer from './ToastContainer'
import ConfirmDialog from './ConfirmDialog'
import { IconTrash, IconArrowBarLeft } from './icons/BootstrapIcons'

import { SettingsDebugPanel } from './debug/SettingsDebugPanel'
import {
  isInstalled as checkPWAInstalled,
  isRunningAsPWA,
  markAsInstalled as markPWAInstalled,
  detectEnvironment,
  PWADetectionResult
} from '../services/pwa/pwaDetection'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  onSettingsChange?: () => void
  onOpenFeedback?: () => void
  onOpenInstall?: () => void
  onImportMarkdown?: () => void
  onImportDirectory?: () => void
}

// PWA 安裝提示事件類型
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function SettingsPanel({ isOpen, onClose, onSettingsChange, onOpenFeedback, onOpenInstall, onImportMarkdown, onImportDirectory }: SettingsPanelProps) {
  const [settings, setSettings] = useState<SyncedSettings>(() => settingsService.getSyncedSettings())
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<'load' | 'reset' | null>(null)

  // Debug Panel（Token + PWA）
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  // PWA 開啟指引 Modal
  const [showPWAGuide, setShowPWAGuide] = useState(false)

  // Import Menu 狀態
  const [showImportMenu, setShowImportMenu] = useState(false)

  // PWA 安裝相關狀態
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  // pwaDetectionMethod 用於記錄偵測方法（供 Debug 使用）
  const [, setPwaDetectionMethod] = useState<string>('none')

  // 監聽 PWA 安裝提示事件並使用 PWA Detection Service
  useEffect(() => {
    // 如果已經在 PWA 模式運行，直接標記為已安裝
    if (isRunningAsPWA()) {
      setIsInstalled(true)
      setPwaDetectionMethod('display-mode')
      return
    }

    // 使用 PWA Detection Service 異步檢查安裝狀態
    const checkInstallation = async () => {
      const result: PWADetectionResult = await checkPWAInstalled()
      setIsInstalled(result.isInstalled)
      setPwaDetectionMethod(result.method)
    }
    checkInstallation()

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
      // 標記為已安裝（供 fallback 使用）
      markPWAInstalled()
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // 處理 PWA 安裝
  const handleInstallPWA = async () => {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setInstallPrompt(null)
        onClose()
      }
    } catch (error) {
      console.error('PWA install failed:', error)
    }
  }

  // 當面板打開時重新讀取設定
  useEffect(() => {
    if (isOpen) {
      setSettings(settingsService.getSyncedSettings())
      setShowImportMenu(false)  // 重置匯入選單狀態
    }
  }, [isOpen])

  // ESC 鍵關閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value
    settingsService.saveSyncedSettings({ theme: newTheme })
    setSettings(prev => ({ ...prev, theme: newTheme }))
    applyTheme(newTheme)
    if (onSettingsChange) onSettingsChange()
    onClose()
  }

  // 判斷當前裝置類型
  const [isMobile] = useState(() => isMobileDevice())

  // 字體大小變更後 2 秒自動關閉
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleAutoClose = useCallback(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current)
    autoCloseTimerRef.current = setTimeout(() => onClose(), 2000)
  }, [onClose])
  useEffect(() => {
    return () => { if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current) }
  }, [])

  // 取得當前裝置的字體大小
  const currentInterfaceFontSize = isMobile
    ? settings.mobileInterfaceFontSize
    : settings.desktopInterfaceFontSize
  const currentContentFontSize = isMobile
    ? settings.mobileContentFontSize
    : settings.desktopContentFontSize

  // 字體大小調整
  const handleInterfaceFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10)
    if (isMobile) {
      settingsService.saveSyncedSettings({ mobileInterfaceFontSize: newSize })
      setSettings(prev => ({ ...prev, mobileInterfaceFontSize: newSize }))
    } else {
      settingsService.saveSyncedSettings({ desktopInterfaceFontSize: newSize })
      setSettings(prev => ({ ...prev, desktopInterfaceFontSize: newSize }))
    }
    applyFontSize(newSize, currentContentFontSize)
    if (onSettingsChange) onSettingsChange()
    scheduleAutoClose()
  }

  const handleContentFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10)
    if (isMobile) {
      settingsService.saveSyncedSettings({ mobileContentFontSize: newSize })
      setSettings(prev => ({ ...prev, mobileContentFontSize: newSize }))
    } else {
      settingsService.saveSyncedSettings({ desktopContentFontSize: newSize })
      setSettings(prev => ({ ...prev, desktopContentFontSize: newSize }))
    }
    applyFontSize(currentInterfaceFontSize, newSize)
    if (onSettingsChange) onSettingsChange()
    scheduleAutoClose()
  }

  const handleResetFontSize = () => {
    const defaults = isMobile ? FONT_SIZE_LIMITS.mobile : FONT_SIZE_LIMITS.desktop
    if (isMobile) {
      settingsService.saveSyncedSettings({
        mobileInterfaceFontSize: defaults.interface,
        mobileContentFontSize: defaults.content,
      })
      setSettings(prev => ({
        ...prev,
        mobileInterfaceFontSize: defaults.interface,
        mobileContentFontSize: defaults.content,
      }))
    } else {
      settingsService.saveSyncedSettings({
        desktopInterfaceFontSize: defaults.interface,
        desktopContentFontSize: defaults.content,
      })
      setSettings(prev => ({
        ...prev,
        desktopInterfaceFontSize: defaults.interface,
        desktopContentFontSize: defaults.content,
      }))
    }
    applyFontSize(defaults.interface, defaults.content)
    if (onSettingsChange) onSettingsChange()
    onClose()
  }

  // Save All
  const handleSaveAll = async () => {
    onClose()
    try {
      await exportAllToLocal()
      toast.success('Save complete!')
    } catch (error) {
      toast.error(`Save failed: ${(error as Error).message}`)
    }
  }

  // Load All
  const handleLoadAll = () => {
    onClose()
    setConfirmAction('load')
  }

  const executeLoadAll = async () => {
    setConfirmAction(null)
    try {
      await importAllFromLocal()
    } catch (error) {
      console.error('Load failed:', error)
      toast.error(`Load failed: ${(error as Error).message}`)
    }
  }

  const executeReset = async () => {
    setConfirmAction(null)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) await reg.unregister()
      }
      window.location.reload()
    } catch (e) {
      toast.error(`Reset failed: ${e}`)
    }
  }

  // Action 按鈕共用樣式
  const actionBtnStyle: React.CSSProperties = {
    padding: '8px 4px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: 'var(--interface-font-size-xs)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  }

  // 點擊 overlay 關閉
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // 點擊 body 空白區域關閉（footer 下方空白處）
  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <>
      {/* Overlay + Panel */}
      <div
        className={`settings-overlay ${isOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
      >
        <div className="settings-panel" onClick={e => e.stopPropagation()}>
          {/* Header: ← 返回按鈕 + Show Trash toggle */}
          <div className="settings-panel-header">
            <button
              className="settings-panel-back"
              onClick={onClose}
              aria-label="Back"
              title="Back"
            >
              <IconArrowBarLeft size={22} /> Back
            </button>
            <button
              className="settings-panel-trash-toggle"
              onClick={() => {
                const newShowTrash = !settings.showTrash
                settingsService.saveSyncedSettings({ showTrash: newShowTrash })
                setSettings(prev => ({ ...prev, showTrash: newShowTrash }))
                if (onSettingsChange) onSettingsChange()
              }}
              aria-label={settings.showTrash ? 'Hide Trash' : 'Show Trash'}
              title={settings.showTrash ? 'Hide Trash' : 'Show Trash'}
              style={{
                opacity: settings.showTrash ? 1 : 0.4,
                color: settings.showTrash ? 'var(--text-primary)' : 'var(--accent)',
              }}
            >
              <IconTrash size={18} />
              <span>Show Trash</span>
            </button>
          </div>

          {/* Body */}
          <div className="settings-panel-body" onClick={handleBodyClick}>
            <div className="settings-panel-content">
            {/* Theme select + Reset Size */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <select
                value={settings.theme}
                onChange={handleThemeChange}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--interface-font-size)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {getAvailableThemes().map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
              <button
                onClick={handleResetFontSize}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--interface-font-size)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Reset Size
              </button>
            </div>

            {/* Font Size - 兩行式 */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              {/* Interface Font Size */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: 'var(--interface-font-size-sm)', color: 'var(--text-secondary)' }}>Interface Font Size</span>
                  <span style={{ fontSize: 'var(--interface-font-size-sm)', color: 'var(--text-primary)' }}>{currentInterfaceFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={FONT_SIZE_LIMITS.interface.min}
                  max={FONT_SIZE_LIMITS.interface.max}
                  value={currentInterfaceFontSize}
                  onChange={handleInterfaceFontSizeChange}
                  style={{ width: '100%', height: '4px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
              {/* Content Font Size */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: 'var(--interface-font-size-sm)', color: 'var(--text-secondary)' }}>Content Font Size</span>
                  <span style={{ fontSize: 'var(--interface-font-size-sm)', color: 'var(--text-primary)' }}>{currentContentFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={FONT_SIZE_LIMITS.content.min}
                  max={FONT_SIZE_LIMITS.content.max}
                  value={currentContentFontSize}
                  onChange={handleContentFontSizeChange}
                  style={{ width: '100%', height: '4px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Line Numbers Toggle（Desktop only） */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{ fontSize: 'var(--interface-font-size-sm)', color: 'var(--text-secondary)' }}>
                  Line Numbers
                </span>
                <button
                  onClick={() => {
                    const newVal = !settings.showLineNumbers
                    settingsService.saveSyncedSettings({ showLineNumbers: newVal })
                    setSettings(prev => ({ ...prev, showLineNumbers: newVal }))
                    if (onSettingsChange) onSettingsChange()
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    fontSize: 'var(--interface-font-size-sm)',
                    backgroundColor: settings.showLineNumbers ? 'var(--accent)' : 'var(--bg-input)',
                    color: settings.showLineNumbers ? 'var(--bg-editor)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontWeight: settings.showLineNumbers ? 600 : 400,
                  }}
                >
                  {settings.showLineNumbers ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {/* Action 按鈕 Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              padding: '12px 0',
            }}>
              <button onClick={handleSaveAll} style={actionBtnStyle}>Save</button>
              <button onClick={handleLoadAll} style={actionBtnStyle}>Restore</button>
              <div className="import-dropdown">
                <button
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  style={actionBtnStyle}
                >
                  Open MD ▾
                </button>
                {showImportMenu && (
                  <div className="import-menu">
                    <button
                      className="import-menu-item"
                      onClick={() => {
                        setShowImportMenu(false)
                        onClose()
                        onImportMarkdown?.()
                      }}
                    >
                      Files
                    </button>
                    <button
                      className="import-menu-item"
                      onClick={() => {
                        setShowImportMenu(false)
                        onClose()
                        onImportDirectory?.()
                      }}
                    >
                      Directory
                    </button>
                  </div>
                )}
              </div>
              {!isInstalled ? (
                <button
                  onClick={installPrompt ? handleInstallPWA : () => {
                    onOpenInstall?.()
                  }}
                  style={actionBtnStyle}
                >
                  Install APP
                </button>
              ) : (
                <button
                  onClick={() => setShowPWAGuide(true)}
                  style={{
                    ...actionBtnStyle,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22c55e',
                  }}
                >
                  PWA APP
                </button>
              )}
              <button
                onClick={() => { onOpenFeedback?.() }}
                style={actionBtnStyle}
              >
                Feedback
              </button>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 12px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-light)',
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); setConfirmAction('reset') }}
                style={{
                  fontSize: '12px',
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                v{VERSION_INFO.app}
              </button>
              <a href="#/help" onClick={onClose} style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>Help</a>
              <a href="/terms.html" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</a>
              <a href="/privacy.html" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                  setShowDebugPanel(true)
                }}
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                Debug
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* 進度對話框 */}
      {/* Toast 通知 */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* 確認對話框 */}
      <ConfirmDialog
        isOpen={confirmAction === 'load'}
        title="Restore Data"
        message={`This will REPLACE all data in "${settingsService.getSelectedWorkspace() === 'local' ? 'Local' : 'Cloud'}" workspace.\n\nData in other workspaces will NOT be affected.\n\nCompatible with both V3 and V3.1 backups.\n\nContinue?`}
        confirmText="Restore"
        variant="warning"
        onConfirm={executeLoadAll}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'reset'}
        title="Reset APP"
        message="Upgrade/Reload/Reset APP. Your notes are safe."
        confirmText="Reset"
        variant="warning"
        onConfirm={executeReset}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Debug Panel（Token + PWA） */}
      {showDebugPanel && (
        <SettingsDebugPanel onClose={() => setShowDebugPanel(false)} />
      )}

      {/* PWA 開啟指引 Modal */}
      {showPWAGuide && <PWAGuideModal onClose={() => setShowPWAGuide(false)} />}
    </>
  )
}

// 偵測 Chrome 版本號
function detectChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * PWA 開啟指引 Modal
 * 依據平台、Chrome 版本和系統語言顯示不同的指引內容
 */
function PWAGuideModal({ onClose }: { onClose: () => void }) {
  const env = detectEnvironment()
  const isChineseLocale = navigator.language.startsWith('zh')
  const isDesktop = env.device === 'desktop'
  const chromeVersion = detectChromeVersion()

  // 根據平台、Chrome 版本和語言取得指引內容
  const getGuideContent = () => {
    if (isDesktop) {
      // Chrome 134+ 支援「在應用程式中開啟」按鈕
      const hasOpenInAppButton = chromeVersion !== null && chromeVersion >= 134

      if (hasOpenInAppButton) {
        // Chrome 134+：使用網址列按鈕
        return {
          title: isChineseLocale ? '開啟 PenPage APP' : 'Open PenPage APP',
          steps: isChineseLocale
            ? ['點擊網址列右側的「在應用程式中開啟」按鈕']
            : ['Click the "Open in app" button on the right side of the URL bar'],
          note: isChineseLocale
            ? '提示：按鈕位於網址列最右側'
            : 'Tip: The button is on the far right of the URL bar'
        }
      } else {
        // Chrome < 134 或非 Chrome：使用選單
        return {
          title: isChineseLocale ? '開啟 PenPage APP' : 'Open PenPage APP',
          steps: isChineseLocale
            ? [
                '點擊 Chrome 右上角的「⋮」選單',
                '選擇「投放、儲存與分享」',
                '點擊「在 PenPage 中開啟」'
              ]
            : [
                'Click the "⋮" menu at the top right of Chrome',
                'Select "Cast, Save, and Share"',
                'Click "Open in PenPage"'
              ],
          note: isChineseLocale
            ? '提示：Chrome 134+ 可直接點擊網址列按鈕'
            : 'Tip: Chrome 134+ allows direct click from URL bar'
        }
      }
    } else {
      // Mobile iOS/Android
      return {
        title: isChineseLocale ? '開啟 PenPage APP' : 'Open PenPage APP',
        steps: isChineseLocale
          ? [
              '返回主畫面',
              '點擊「PenPage」圖示即可開啟'
            ]
          : [
              'Go to your home screen',
              'Tap the "PenPage" icon to open'
            ],
        note: isChineseLocale
          ? '提示：APP 已安裝在您的裝置上'
          : 'Tip: The APP is installed on your device'
      }
    }
  }

  const guide = getGuideContent()

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-toolbar)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '280px',
          maxWidth: '90vw',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 標題 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 'var(--interface-font-size)',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            {guide.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        {/* 步驟列表 */}
        <ol style={{
          margin: '0 0 16px 0',
          paddingLeft: '20px',
          color: 'var(--text-primary)',
          fontSize: 'var(--interface-font-size-sm)',
          lineHeight: '1.8'
        }}>
          {guide.steps.map((step, index) => (
            <li key={index} style={{ marginBottom: '8px' }}>{step}</li>
          ))}
        </ol>

        {/* 提示 */}
        <div style={{
          fontSize: 'var(--interface-font-size-xs)',
          color: 'var(--text-muted)',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-hover)',
          borderRadius: '6px'
        }}>
          {guide.note}
        </div>

        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '10px',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: 'var(--interface-font-size)',
            cursor: 'pointer'
          }}
        >
          {isChineseLocale ? '關閉' : 'Close'}
        </button>
      </div>
    </div>
  )
}
