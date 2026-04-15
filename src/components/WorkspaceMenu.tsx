/**
 * WorkspaceMenu - W 視圖的共用選單組件
 * 用於 PW（WorkspaceList）和 DW/LW（WorkspaceHeader）
 */

import { IconHouseAdd, IconHouseCheck, IconLock } from './icons/BootstrapIcons'

interface WorkspaceMenuProps {
  onClose: () => void
  onCreateWorkspace?: () => void
  onEditWorkspace?: () => void
}

const WorkspaceMenu = ({ onClose, onCreateWorkspace, onEditWorkspace }: WorkspaceMenuProps) => (
  <>
    {/* 新增 Workspace */}
    <button
      className="sort-menu-item"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
        onCreateWorkspace?.()
      }}
    >
      <IconHouseAdd size={16} className="menu-icon" />
      New Workspace
    </button>

    {/* 編輯 Workspace */}
    <button
      className="sort-menu-item"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
        onEditWorkspace?.()
      }}
    >
      <IconHouseCheck size={16} className="menu-icon" />
      Select
    </button>

    <div className="sort-menu-divider" />

    {/* 加密（TBD）*/}
    <button
      className="sort-menu-item"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{ opacity: 0.5 }}
    >
      <IconLock size={16} className="menu-icon" />
      Encryption (TBD)
    </button>
  </>
)

export default WorkspaceMenu
