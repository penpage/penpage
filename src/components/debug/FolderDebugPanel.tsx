/**
 * Folder Debug Panel
 * 診斷 FolderPickerDialog 在 iOS PWA 上只顯示 root level 的問題
 * 比較 FolderTree 方式（db.getAllFolders）和 FolderPickerDialog 方式（workspaceDbFactory）載入的資料差異
 */

import { useState } from 'react'
import { db, Folder } from '../../services/db'
import { settingsService } from '../../services/settings'
import { workspaceDbFactory } from '../../services/workspaceDb'
import { isRootFolderId, isTrashFolderId, ROOT_FOLDER_ID } from '../../services/rootFolders'

interface FolderInfo {
  id: string
  name: string
  parentId: string | null
  order: number
  updatedAt: number
  isRootFolder?: boolean
  isTrashFolder?: boolean
  isSystemFolder?: boolean
}

// 格式化 timestamp 為相對時間
const timeAgo = (ts: number) => {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}月前`
  return `${Math.floor(days / 365)}年前`
}

export const FolderDebugContent = () => {
  const [loading, setLoading] = useState(false)
  const [dbSingletonState, setDbSingletonState] = useState<string>('')
  const [folderTreeFolders, setFolderTreeFolders] = useState<FolderInfo[]>([])
  const [localFolders, setLocalFolders] = useState<FolderInfo[]>([])
  const [localTopLevel, setLocalTopLevel] = useState<FolderInfo[]>([])
  const [error, setError] = useState<string>('')

  const loadDiagnostics = async () => {
    setLoading(true)
    setError('')

    try {
      // 1. DB Singleton 狀態
      const currentWsId = settingsService.getSelectedWorkspace()
      setDbSingletonState(currentWsId)

      // 2. FolderTree 方式：直接用 db(wsId).getAllFolders()
      const ftFolders = await db(currentWsId).getAllFolders()
      setFolderTreeFolders(ftFolders.map(toFolderInfo))

      // 3. FolderPickerDialog 方式：workspaceDbFactory
      try {
        const localDb = workspaceDbFactory.getDb('local')
        const localAll = await localDb.getAllFolders()
        setLocalFolders(localAll.map(toFolderInfo))

        // 用 FolderPickerDialog 同樣的過濾邏輯
        const localValid = localAll.filter(f =>
          !f.isRootFolder && !f.isTrashFolder && !f.isSystemFolder &&
          !isRootFolderId(f.id) && !isTrashFolderId(f.id)
        )
        const localTop = localValid.filter(f =>
          f.parentId === ROOT_FOLDER_ID ||
          f.parentId === 'root-global' ||
          f.parentId === 'root-local'
        )
        setLocalTopLevel(localTop.map(toFolderInfo))
      } catch (e) {
        setLocalFolders([])
        setLocalTopLevel([])
      }

      // 4. 載入完後檢查 db singleton 是否被切換
      const afterWsId = settingsService.getSelectedWorkspace()
      if (afterWsId !== currentWsId) {
        setError(`⚠️ DB singleton 被切換！ ${currentWsId} → ${afterWsId}`)
      }
    } catch (e) {
      setError(`載入失敗: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const toFolderInfo = (f: Folder): FolderInfo => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    order: f.order,
    updatedAt: f.updatedAt,
    isRootFolder: f.isRootFolder,
    isTrashFolder: f.isTrashFolder,
    isSystemFolder: f.isSystemFolder
  })

  // 渲染列表（比照 DriveDebugPanel renderFolders 格式）
  const renderList = (folders: FolderInfo[], orphanIds?: Set<string>, startIndex = 1): JSX.Element[] => {
    const sorted = [...folders].sort((a, b) => a.order - b.order)
    return sorted.map((f, i) => {
      const flags = [
        f.isRootFolder && 'ROOT',
        f.isTrashFolder && 'TRASH',
        f.isSystemFolder && 'SYS',
        isRootFolderId(f.id) && 'rootId',
        isTrashFolderId(f.id) && 'trashId'
      ].filter(Boolean).join(',')

      const isOrphan = orphanIds?.has(f.id) ?? false
      const color = isOrphan ? '#ef4444' : flags ? '#f59e0b' : '#4ade80'

      return (
        <div key={f.id} style={{ marginLeft: '8px' }}>
          <span style={{ color: '#666', fontSize: '11px' }}>{startIndex + i}.</span>
          {' '}
          <span style={{ color, fontWeight: isOrphan ? 'bold' : undefined }}>
            [{f.name}]
          </span>
          {isOrphan && (
            <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold' }}>
              {' '}[Orphan]
            </span>
          )}
          <span style={{ color: isOrphan ? '#ef4444' : color, fontSize: '11px', fontWeight: isOrphan ? 'bold' : undefined }}>
            {' '}[Updated {timeAgo(f.updatedAt)}]
          </span>
          {flags && (
            <span style={{ color: '#f59e0b', fontSize: '11px' }}>
              {' '}[{flags}]
            </span>
          )}
          <span style={{ color: '#60a5fa', fontSize: '11px' }}>
            {' '}order={f.order}
          </span>
          <span style={{ color: '#666', fontSize: '11px' }}>
            {' '}id={f.id} parent={f.parentId}
          </span>
        </div>
      )
    })
  }

  const sectionStyle = {
    padding: '8px 0',
    borderBottom: '1px solid #333'
  }

  const headerStyle = {
    color: '#4ade80',
    fontWeight: 'bold' as const,
    marginBottom: '4px'
  }

  return (
    <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1 }}>
      <button
        onClick={loadDiagnostics}
        disabled={loading}
        style={{
          background: '#4ade80',
          color: '#000',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: loading ? 'wait' : 'pointer',
          fontWeight: 'bold',
          marginBottom: '12px'
        }}
      >
        {loading ? 'Loading...' : 'Run Diagnostics'}
      </button>

      {error && (
        <div style={{ color: '#ef4444', marginBottom: '8px', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      {dbSingletonState && (
        <>
          {/* DB Singleton 狀態 */}
          <div style={sectionStyle}>
            <div style={headerStyle}>1. DB Singleton State</div>
            <div>Current workspace: <span style={{ color: '#60a5fa' }}>{dbSingletonState}</span> <span style={{ color: '#888', fontSize: '11px' }}>{new Date().toLocaleString('en-GB', { hour12: false })}</span></div>
          </div>

          {/* FolderTree 方式 */}
          <div style={sectionStyle}>
            <div style={headerStyle}>
              2. FolderTree 方式 (db.getAllFolders) — {folderTreeFolders.length} folders
            </div>
            <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
              {(() => {
                const trashFolders = folderTreeFolders.filter(f =>
                  (f.isTrashFolder || isTrashFolderId(f.id)) &&
                  !f.isRootFolder && !isRootFolderId(f.id)
                )
                const orphanIds = new Set(
                  folderTreeFolders
                    .filter(f =>
                      !f.isRootFolder && !isRootFolderId(f.id) &&
                      !f.isTrashFolder && !isTrashFolderId(f.id) &&
                      !folderTreeFolders.some(p => p.id === f.parentId)
                    )
                    .map(f => f.id)
                )
                return (
                  <>
                    {renderList(folderTreeFolders, orphanIds)}
                    {trashFolders.length > 1 && (
                      <div style={{ color: '#ef4444', marginTop: '4px' }}>
                        ⚠ Duplicate Trash ({trashFolders.length}): {trashFolders.map(f => f.id).join(', ')}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          {/* FolderPickerDialog 方式 - Local */}
          <div style={sectionStyle}>
            <div style={headerStyle}>
              3a. Picker 方式 — Local ({localFolders.length} total, {localTopLevel.length} top-level)
            </div>
            <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
              {localTopLevel.length === 0
                ? <span style={{ color: '#666' }}>No top-level folders</span>
                : renderList(localTopLevel)
              }
            </div>
          </div>

          {/* 比對 */}
          <div style={sectionStyle}>
            <div style={headerStyle}>4. Comparison</div>
            {(() => {
              const diff = folderTreeFolders.length - localFolders.length
              return (
                <div>
                  FolderTree: {folderTreeFolders.length} folders
                  <br />
                  Picker Local: {localFolders.length} folders ({localTopLevel.length} top-level)
                  <br />
                  <span style={{ color: diff !== 0 ? '#ef4444' : '#4ade80' }}>
                    Delta: {diff} (FolderTree − Picker)
                  </span>
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}
