/**
 * Settings Debug Panel
 * 整合 PWA Debug 和 Database Debug 的通用除錯面板
 * 從 Settings 面板的 Debug 連結開啟
 */

import { useState } from 'react'
import { PWADebugContent } from './PWADebugPanel'
import { DatabaseDebugContent } from './DatabaseDebugPanel'
import { FolderDebugContent } from './FolderDebugPanel'
import { ConsoleLogDebugContent } from './ConsoleLogDebugPanel'

type DebugTab = 'console' | 'pwa' | 'database' | 'folders'

interface SettingsDebugPanelProps {
  onClose: () => void
}

const DEBUG_PASSWORD = 'ppage'

export const SettingsDebugPanel = ({ onClose }: SettingsDebugPanelProps) => {
  const [activeTab, setActiveTab] = useState<DebugTab>('console')
  const [authenticated, setAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const handlePasswordSubmit = () => {
    if (passwordInput === DEBUG_PASSWORD) {
      setAuthenticated(true)
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.95)',
        color: '#fff',
        fontSize: '13px',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#222',
        borderBottom: '1px solid #444',
      }}>
        <button
          onClick={onClose}
          style={{
            background: '#555',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          關閉
        </button>
        <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
          🔧 Debug
        </span>
      </div>

      {/* 密碼驗證閘門 */}
      {!authenticated ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}>
          <div style={{ color: '#888', marginBottom: '4px' }}>輸入密碼以存取 Debug 面板</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
              style={{
                background: '#222',
                color: '#fff',
                border: `1px solid ${passwordError ? '#ef4444' : '#555'}`,
                padding: '8px 12px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '14px',
                outline: 'none',
              }}
            />
            <button
              onClick={handlePasswordSubmit}
              style={{
                background: '#4ade80',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              進入
            </button>
          </div>
          {passwordError && (
            <div style={{ color: '#ef4444', fontSize: '12px' }}>密碼錯誤</div>
          )}
        </div>
      ) : (
        <>
          {/* Tab Bar */}
          <div style={{
            display: 'flex',
            background: '#1a1a1a',
            borderBottom: '1px solid #333',
          }}>
            <TabButton
              label="Console"
              isActive={activeTab === 'console'}
              onClick={() => setActiveTab('console')}
            />
            <TabButton
              label="PWA"
              isActive={activeTab === 'pwa'}
              onClick={() => setActiveTab('pwa')}
            />
            <TabButton
              label="Database"
              isActive={activeTab === 'database'}
              onClick={() => setActiveTab('database')}
            />
            <TabButton
              label="Folders"
              isActive={activeTab === 'folders'}
              onClick={() => setActiveTab('folders')}
            />
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'console' && <ConsoleLogDebugContent />}
            {activeTab === 'pwa' && <PWADebugContent />}
            {activeTab === 'database' && <DatabaseDebugContent />}
            {activeTab === 'folders' && <FolderDebugContent />}
          </div>
        </>
      )}
    </div>
  )
}

// Tab 按鈕元件
const TabButton = ({
  label,
  isActive,
  onClick
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 20px',
      background: isActive ? '#333' : 'transparent',
      color: isActive ? '#fff' : '#888',
      border: 'none',
      borderBottom: isActive ? '2px solid #4ade80' : '2px solid transparent',
      fontSize: '13px',
      fontFamily: 'monospace',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
  >
    {label}
  </button>
)
