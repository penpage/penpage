/**
 * 資料庫除錯面板
 * 提供 DB 狀態檢查、migration 版本管理等功能
 */

import { useState } from 'react'
import { getDbName } from '../../services/db'
import { getMigrationVersion, resetMigrationVersion } from '../../services/migration'
import { settingsService } from '../../services/settings'

/**
 * DatabaseDebugContent - 可嵌入 SettingsDebugPanel 的內容組件
 */
export function DatabaseDebugContent() {
  const [log, setLog] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    const prefix = type === 'success' ? '✅' :
                   type === 'error' ? '❌' :
                   type === 'warn' ? '⚠️' : 'ℹ️'
    setLog(prev => [...prev, `${prefix} ${message}`])
  }

  const clearLog = () => setLog([])

  // 檢查資料庫狀態
  const checkDatabases = async () => {
    clearLog()
    setIsLoading(true)
    addLog('=== 資料庫狀態檢查 ===')
    addLog('')

    try {
      // 檢查 Migration 版本
      addLog('📊 Migration 版本:')
      try {
        const version = getMigrationVersion(settingsService.getSelectedWorkspace())
        addLog(`  當前 workspace: v${version}`)
      } catch {
        addLog('  無法取得（DB 可能未初始化）', 'warn')
      }

      addLog('')

      // 列出所有 IndexedDB
      addLog('📂 IndexedDB 列表:')
      const databases = await indexedDB.databases()

      if (databases.length === 0) {
        addLog('  沒有找到任何資料庫')
      } else {
        // 預期的 DB
        const localDbName = getDbName('local')
        const expectedDbs = new Set([localDbName])

        for (const db of databases) {
          const name = db.name || 'unknown'
          const version = db.version || 0

          if (expectedDbs.has(name)) {
            addLog(`  ✅ ${name} (v${version})`, 'success')
          } else {
            addLog(`  - ${name} (v${version})`)
          }
        }

        // 檢查預期的 DB 是否存在
        const foundDbs = new Set(databases.map(d => d.name))
        if (!foundDbs.has(localDbName)) {
          addLog(`  ❌ ${localDbName} - 不存在`, 'error')
        }
      }

      addLog('')
      addLog('檢查完成', 'success')

    } catch (error: any) {
      addLog(`錯誤: ${error.message || error}`, 'error')
      console.error('Database check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 重設遷移狀態
  const handleResetMigrationState = async () => {
    if (!confirm('確定要重設遷移狀態嗎？\n\n這會清除當前 workspace 的 migration 版本。')) {
      return
    }

    clearLog()
    addLog('=== 重設遷移狀態 ===')

    try {
      resetMigrationVersion(settingsService.getSelectedWorkspace())
      addLog('已重設當前 workspace 的 migration 版本', 'success')
      addLog('')
      addLog('⚠️ 請重新整理頁面', 'warn')
    } catch (error: any) {
      addLog(`錯誤: ${error.message || error}`, 'error')
    }
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 操作按鈕 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #333',
        background: '#1a1a1a',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <ActionButton
            onClick={checkDatabases}
            disabled={isLoading}
            color="#3b82f6"
          >
            檢查狀態
          </ActionButton>

          <ActionButton
            onClick={handleResetMigrationState}
            disabled={isLoading}
            color="#f97316"
          >
            重設遷移狀態
          </ActionButton>
        </div>
      </div>

      {/* 日誌區域 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        color: '#ccc',
      }}>
        {log.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>
            點擊「檢查狀態」查看資料庫資訊
          </div>
        ) : (
          <>
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {isLoading && (
              <div style={{ color: '#facc15', marginTop: '8px' }}>
                執行中...
              </div>
            )}
          </>
        )}
      </div>

      {/* 清除日誌按鈕 */}
      {log.length > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #333',
          background: '#1a1a1a',
        }}>
          <button
            onClick={clearLog}
            style={{
              width: '100%',
              padding: '8px',
              background: '#333',
              color: '#888',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            清除日誌
          </button>
        </div>
      )}
    </div>
  )
}

// 操作按鈕元件
function ActionButton({
  onClick,
  disabled,
  color,
  children
}: {
  onClick: () => void
  disabled?: boolean
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 12px',
        background: disabled ? '#333' : color,
        color: disabled ? '#666' : '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
