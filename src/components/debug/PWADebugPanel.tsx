import { useState, useEffect, useCallback } from 'react'
import {
  isInstalled,
  isRunningAsPWA,
  detectEnvironment,
  markAsInstalled,
  clearInstallMark,
  PWADetectionResult,
  EnvironmentInfo
} from '../../services/pwa/pwaDetection'

// localStorage keys
const PWA_INSTALLED_KEY = 'pwa_installed_at'

interface PWAState {
  environment: EnvironmentInfo | null
  userAgent: string
  isRunningAsPWA: boolean
  displayModeStandalone: boolean
  navigatorStandalone: boolean | undefined
  getInstalledRelatedAppsSupported: boolean
  installedResult: PWADetectionResult | null
  pwaInstalledAt: string | null
  // Launch capabilities
  chromeVersion: number | null
  autoCaptureSupported: boolean
  protocolHandlerSupported: boolean
  launchHandlerMode: string | null
}

/**
 * PWA Debug Content
 * 純內容元件，顯示 PWA 偵測狀態（供 SettingsDebugPanel 使用）
 */
// 偵測 Chrome 版本號
function detectChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// 偵測 Protocol Handler 支援
function detectProtocolHandlerSupport(): boolean {
  return 'registerProtocolHandler' in navigator
}

export const PWADebugContent = () => {
  const [state, setState] = useState<PWAState>({
    environment: null,
    userAgent: '',
    isRunningAsPWA: false,
    displayModeStandalone: false,
    navigatorStandalone: undefined,
    getInstalledRelatedAppsSupported: false,
    installedResult: null,
    pwaInstalledAt: null,
    // Launch capabilities
    chromeVersion: null,
    autoCaptureSupported: false,
    protocolHandlerSupported: false,
    launchHandlerMode: null
  })
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  // 偵測所有 PWA 相關狀態
  const detectAll = useCallback(async () => {
    const env = detectEnvironment()
    const running = isRunningAsPWA()
    const displayMode = window.matchMedia('(display-mode: standalone)').matches
    const navStandalone = (window.navigator as { standalone?: boolean }).standalone
    const apiSupported = 'getInstalledRelatedApps' in navigator && !!navigator.getInstalledRelatedApps
    const installed = await isInstalled()

    // Launch capabilities
    const chromeVer = detectChromeVersion()
    const protocolSupported = detectProtocolHandlerSupport()

    setState({
      environment: env,
      userAgent: navigator.userAgent,
      isRunningAsPWA: running,
      displayModeStandalone: displayMode,
      navigatorStandalone: navStandalone,
      getInstalledRelatedAppsSupported: apiSupported,
      installedResult: installed,
      pwaInstalledAt: localStorage.getItem(PWA_INSTALLED_KEY),
      // Launch capabilities
      chromeVersion: chromeVer,
      autoCaptureSupported: chromeVer !== null && chromeVer >= 139,
      protocolHandlerSupported: protocolSupported,
      launchHandlerMode: 'navigate-existing' // manifest 設定值
    })
  }, [])

  // 初始偵測
  useEffect(() => {
    detectAll()
  }, [detectAll])

  // 手動設置 marker
  const handleSetMarker = () => {
    markAsInstalled()
    detectAll()
  }

  // 清除所有 PWA 相關 localStorage
  const handleClearMarker = () => {
    clearInstallMark()
    detectAll()
  }

  // 複製 Protocol URL 到剪貼簿
  const handleCopyProtocolUrl = async () => {
    const protocolUrl = 'web+penpage://open'
    try {
      await navigator.clipboard.writeText(protocolUrl)
      setCopyStatus('已複製!')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('複製失敗')
      setTimeout(() => setCopyStatus(null), 2000)
    }
  }

  // 根據環境取得開啟方式說明
  const getLaunchCapabilityMessage = (): string => {
    if (state.autoCaptureSupported) {
      return '✓ Chrome 139+：點擊下方連結測試（window.open 無法觸發 auto-capture）'
    }
    if (state.chromeVersion !== null) {
      return '△ Chrome < 139：需手動從 Dock/工作列開啟 App'
    }
    return '✕ Safari/Firefox：不支援自動開啟，需手動開啟 App'
  }

  // 格式化時間戳為可讀格式
  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return '(not set)'
    const date = new Date(parseInt(ts, 10))
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div style={{
      overflow: 'auto',
      padding: '12px',
      flex: 1,
      background: 'rgba(0, 0, 0, 0.95)',
      color: '#e2e8f0',
      fontSize: '11px',
      fontFamily: 'monospace'
    }}>
        {/* === Environment === */}
        <Section title="Environment">
          <Row label="Device" value={state.environment?.device || 'detecting...'} />
          <Row label="OS" value={state.environment?.os || 'detecting...'} />
          <Row label="Browser" value={state.environment?.browser || 'detecting...'} />
          <Row
            label="User Agent"
            value={state.userAgent}
            style={{ fontSize: '9px', wordBreak: 'break-all', color: '#a0aec0' }}
          />
        </Section>

        {/* === PWA Status === */}
        <Section title="PWA Status">
          <Row
            label="isRunningAsPWA()"
            value={state.isRunningAsPWA}
            highlight={state.isRunningAsPWA}
          />
          <Row
            label="display-mode standalone"
            value={state.displayModeStandalone}
            highlight={state.displayModeStandalone}
          />
          <Row
            label="navigator.standalone"
            value={state.navigatorStandalone === undefined ? 'undefined' : state.navigatorStandalone}
            highlight={state.navigatorStandalone === true}
          />
        </Section>

        {/* === Detection APIs === */}
        <Section title="Detection APIs">
          <Row
            label="getInstalledRelatedApps"
            value={state.getInstalledRelatedAppsSupported ? 'supported' : 'not supported'}
            highlight={state.getInstalledRelatedAppsSupported}
          />
        </Section>

        {/* === Launch Capabilities === */}
        <Section title="Launch Capabilities">
          <Row
            label="Chrome Version"
            value={state.chromeVersion ? `v${state.chromeVersion}` : 'N/A (not Chrome)'}
          />
          <Row
            label="Auto-capture (139+)"
            value={state.autoCaptureSupported ? 'supported' : 'not supported'}
            highlight={state.autoCaptureSupported}
          />
          <Row
            label="Protocol Handler API"
            value={state.protocolHandlerSupported ? 'supported' : 'not supported'}
            highlight={state.protocolHandlerSupported}
          />
          <Row
            label="launch_handler mode"
            value={state.launchHandlerMode || 'not set'}
          />
        </Section>

        {/* === Launch Tests === */}
        <Section title="Launch Tests">
          <div style={{
            background: 'rgba(49, 130, 206, 0.15)',
            border: '1px solid rgba(49, 130, 206, 0.3)',
            borderRadius: '4px',
            padding: '8px',
            marginBottom: '8px',
            fontSize: '10px',
            lineHeight: '1.4'
          }}>
            {getLaunchCapabilityMessage()}
          </div>
          {/* 第一排：window.open / location.href */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <ActionButton
              onClick={() => window.open(window.location.origin, '_blank')}
              label="window.open"
              variant="primary"
            />
            <ActionButton
              onClick={() => { window.location.href = window.location.origin }}
              label="location.href"
              variant="primary"
            />
          </div>
          {/* 第二排：<a> navigate / Protocol URL */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a
              href={window.location.origin}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#3182ce',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                flex: 1,
                textAlign: 'center',
                textDecoration: 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#4299e1'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#3182ce'
              }}
            >
              &lt;a&gt; navigate
            </a>
            <ActionButton
              onClick={handleCopyProtocolUrl}
              label={copyStatus || 'Copy Protocol URL'}
              variant="default"
            />
          </div>
          <div style={{
            marginTop: '6px',
            fontSize: '9px',
            color: '#a0aec0'
          }}>
            Protocol: web+penpage://open（需先部署 manifest 設定）
          </div>
        </Section>

        {/* === localStorage Markers === */}
        <Section title="localStorage Markers">
          <Row
            label="pwa_installed_at"
            value={formatTimestamp(state.pwaInstalledAt)}
            highlight={!!state.pwaInstalledAt}
          />
        </Section>

        {/* === isInstalled() Result === */}
        <Section title="isInstalled() Result">
          <Row
            label="isInstalled"
            value={state.installedResult?.isInstalled ?? 'checking...'}
            highlight={state.installedResult?.isInstalled === true}
          />
          <Row
            label="method"
            value={state.installedResult?.method || 'checking...'}
          />
        </Section>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #4a5568'
        }}>
          <ActionButton onClick={handleSetMarker} label="Set Marker" />
          <ActionButton onClick={handleClearMarker} label="Clear Marker" variant="danger" />
          <ActionButton onClick={detectAll} label="Refresh" variant="primary" />
        </div>
    </div>
  )
}

// === Sub Components ===

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{
      color: '#90cdf4',
      fontWeight: 'bold',
      marginBottom: '6px',
      fontSize: '10px',
      letterSpacing: '0.5px'
    }}>
      === {title} ===
    </div>
    {children}
  </div>
)

const Row = ({
  label,
  value,
  highlight,
  style
}: {
  label: string
  value: string | boolean | undefined
  highlight?: boolean
  style?: React.CSSProperties
}) => {
  const displayValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value

  return (
    <div style={{
      display: 'flex',
      marginBottom: '3px',
      ...style
    }}>
      <span style={{ color: '#a0aec0', minWidth: '180px' }}>{label}:</span>
      <span style={{
        color: highlight ? '#68d391' : '#e2e8f0',
        fontWeight: highlight ? 'bold' : 'normal'
      }}>
        {displayValue}
      </span>
    </div>
  )
}

const ActionButton = ({
  onClick,
  label,
  variant = 'default'
}: {
  onClick: () => void
  label: string
  variant?: 'default' | 'primary' | 'danger'
}) => {
  const colors = {
    default: { bg: '#4a5568', hover: '#718096' },
    primary: { bg: '#3182ce', hover: '#4299e1' },
    danger: { bg: '#c53030', hover: '#e53e3e' }
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: colors[variant].bg,
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '11px',
        cursor: 'pointer',
        flex: 1
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = colors[variant].hover
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = colors[variant].bg
      }}
    >
      {label}
    </button>
  )
}
