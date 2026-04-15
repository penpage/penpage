import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Folder, db } from '../services/db'
import { isRootFolderId, isTrashFolderId, ROOT_FOLDER_ID } from '../services/rootFolders'
import { WorkspaceId } from '../types/workspace'
import { IconLockFill } from './icons/BootstrapIcons'

// 特殊 ID 用於表示「移動到根層級」（只需要一個，因為只能在同 workspace 內移動）
export const ROOT_LEVEL_TARGET = '__ROOT_LEVEL__'
// 保留舊的 export 以保持向後相容（可能有其他地方使用）
export const ROOT_LEVEL_TARGET_CLOUD = ROOT_LEVEL_TARGET
export const ROOT_LEVEL_TARGET_LOCAL = ROOT_LEVEL_TARGET

interface FolderPickerDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (folderId: string) => void
  currentFolderId: string | null
  sourceWorkspaceId?: WorkspaceId // New prop to enforce restrictions
  title?: string
  excludeIds?: string[] // 要排除的 folder IDs（用於防止循環參照）
}

export const FolderPickerDialog = ({ isOpen, onClose, onSelect, currentFolderId, sourceWorkspaceId = 'local', title = 'Move to Folder', excludeIds = [] }: FolderPickerDialogProps) => {
  const [folders, setFolders] = useState<Folder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadFolders()
      setSelectedId(null) // Reset selection on open
    }
  }, [isOpen])

  const loadFolders = async () => {
    // 直接用 db singleton 載入（與 FolderTree 一致），避免 workspace 切換風險
    const allFolders = await db(sourceWorkspaceId).getAllFolders()

    // 過濾系統資料夾（root 和 trash）- 只顯示用戶資料夾
    const validFolders = allFolders.filter(f =>
      !f.isRootFolder &&
      !f.isTrashFolder &&
      !f.isSystemFolder &&
      !isRootFolderId(f.id) &&
      !isTrashFolderId(f.id)
    )
    setFolders(validFolders)
  }

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const renderFolder = (folder: Folder, level: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.order - b.order)
    const hasChildren = children.length > 0
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedId === folder.id

    // Constraints Logic（簡化：同 workspace 內移動，不再需要跨 workspace 檢查）
    const isCurrent = currentFolderId === folder.id // Can't move to same folder
    const isExcluded = excludeIds.includes(folder.id) // 排除選中的 folder 及其子孫

    const isDisabled = isCurrent || isExcluded

    return (
      <div key={folder.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${level * 20 + 12}px`,
            cursor: isDisabled ? 'default' : 'pointer',
            backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
            opacity: isDisabled ? 0.5 : 1,
            borderRadius: '4px',
            marginBottom: '2px',
            color: isDisabled ? 'var(--text-muted)' : 'var(--text-primary)'
          }}
          onClick={() => {
            if (!isDisabled) setSelectedId(folder.id)
          }}
        >
          {/* Arrow */}
          <div
            style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: '4px' }}
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggleFolder(folder.id)
            }}
          >
            {hasChildren && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>}
          </div>

          <span style={{ marginRight: '6px' }}>📁</span>
          {/* 加密 Folder 圖示 */}
          {folder.isEncrypted && (
            <span style={{ marginRight: '4px', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
              <IconLockFill size={12} />
            </span>
          )}
          <span style={{ fontWeight: isSelected ? '600' : '400', color: isSelected ? 'var(--accent)' : 'inherit' }}>
            {folder.name}
          </span>
          {isCurrent && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>(Current)</span>}
          {isExcluded && !isCurrent && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#ef4444' }}>🚫 Selected</span>}
        </div>

        {isExpanded && children.map(child => renderFolder(child, level + 1))}
      </div>
    )
  }

  if (!isOpen) return null

  // 頂層資料夾：parentId 指向 root folder
  // V10: ROOT_FOLDER_ID = 'root'，同時相容舊格式
  const topLevelFolders = folders.filter(f =>
    f.parentId === ROOT_FOLDER_ID ||
    f.parentId === 'root-global' ||  // 舊格式相容
    f.parentId === 'root-local'      // 舊格式相容
  ).sort((a, b) => a.order - b.order)

  // 取得 workspace 顯示名稱
  const workspaceLabel = 'Local'

  return createPortal(
    <div className="folder-picker-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--overlay)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-toolbar)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `0 20px 25px -5px var(--shadow)`,
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Body - 簡化為單一 workspace */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {/* Workspace 標籤 */}
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', padding: '0 12px 4px', textTransform: 'uppercase' }}>
            {workspaceLabel} Space
          </div>

          {/* Root Level 選項（來源已在 root level 時 disabled） */}
          {(() => {
            const isRootLevelDisabled = currentFolderId === ROOT_FOLDER_ID
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  paddingLeft: '12px',
                  cursor: isRootLevelDisabled ? 'default' : 'pointer',
                  backgroundColor: selectedId === ROOT_LEVEL_TARGET ? 'var(--bg-selected)' : 'transparent',
                  opacity: isRootLevelDisabled ? 0.5 : 1,
                  borderRadius: '4px',
                  marginBottom: '2px',
                  color: isRootLevelDisabled ? 'var(--text-muted)' : 'var(--text-primary)'
                }}
                onClick={() => { if (!isRootLevelDisabled) setSelectedId(ROOT_LEVEL_TARGET) }}
                title={`Move to ${workspaceLabel} root level`}
              >
                <span style={{ marginRight: '6px' }}>📂</span>
                <span style={{ fontWeight: selectedId === ROOT_LEVEL_TARGET ? '600' : '400', color: selectedId === ROOT_LEVEL_TARGET ? 'var(--accent)' : 'inherit', fontStyle: 'italic' }}>
                  Root Level
                </span>
              </div>
            )
          })()}

          {/* 資料夾列表（只有用戶資料夾） */}
          {topLevelFolders.map(f => renderFolder(f))}

          {/* 無資料夾提示 */}
          {topLevelFolders.length === 0 && (
            <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
              No folders in {workspaceLabel} Space
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: selectedId ? 'var(--accent)' : 'var(--bg-hover)',
              color: selectedId ? 'var(--bg-editor)' : 'var(--text-muted)',
              cursor: selectedId ? 'pointer' : 'not-allowed'
            }}
          >
            Move
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}