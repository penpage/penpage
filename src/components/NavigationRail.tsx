import '../styles/editor.css'
import { useOrientation } from '../contexts/OrientationContext'
import {
  IconHouseDoor,
  IconPlusCircleFill,
  IconSearch,
  IconSliders,
  IconBoxArrowUp
} from './icons/BootstrapIcons'

// 按鈕 ID 類型
type NavButtonId = 'home' | 'newpage' | 'search' | 'settings' | 'share'

// 按鈕配置介面
interface NavButtonConfig {
  id: NavButtonId
  icon: React.ReactNode
  label: string
  onClick: () => void
  /** 是否隱藏但佔位（visibility: hidden） */
  placeholder: boolean
  /** 是否為主要按鈕（反白凸顯） */
  primary?: boolean
  /** 是否禁用（灰色） */
  disabled?: boolean
}

// NavButton 子組件 Props
interface NavButtonProps {
  config: NavButtonConfig
}

// NavButton 子組件 - 統一按鈕設計
const NavButton = ({ config }: NavButtonProps) => {
  const { id, icon, label, onClick, placeholder, primary, disabled } = config

  const classNames = [
    'nav-rail-btn',
    placeholder ? 'placeholder' : '',
    primary ? 'primary' : '',
    disabled ? 'disabled' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      className={classNames}
      onClick={onClick}
      disabled={placeholder || disabled}
      title={label}
      aria-label={label}
      data-btn-id={id}
    >
      {icon}
    </button>
  )
}

// NavigationRail Props
interface NavigationRailProps {
  currentView: 'W' | 'F' | 'P' | 'E' | 'S'
  onGoHome: () => void
  onCreateNewPage: () => void
  onSearch: () => void
  onOpenSettings: () => void
  onShare: () => void
  selectedPageId?: string | null  // 用於判斷 Share 按鈕是否啟用
  hidden?: boolean  // E1 模式隱藏（鍵盤彈出時）
}

// 根據視圖模式取得按鈕配置
const getButtonConfigs = (
  _currentView: 'W' | 'F' | 'P' | 'E' | 'S',
  iconSize: number,
  callbacks: {
    onGoHome: () => void
    onCreateNewPage: () => void
    onSearch: () => void
    onOpenSettings: () => void
    onShare: () => void
  },
  selectedPageId?: string | null
): NavButtonConfig[] => {
  // 搜尋視圖 'S' 已支援，目前與其他視圖行為相同

  // 新版 5 按鈕配置：Home → Share → + → Search → Settings
  return [
    {
      id: 'home',
      icon: <IconHouseDoor size={iconSize} />,
      label: 'Home',
      onClick: callbacks.onGoHome,
      placeholder: false, // W ↔ F toggle，永遠顯示
    },
    {
      id: 'share',
      icon: <IconBoxArrowUp size={iconSize} />,
      label: 'Share',
      onClick: callbacks.onShare,
      placeholder: false,
      disabled: !selectedPageId, // 無選中頁面時禁用
    },
    {
      id: 'newpage',
      icon: <IconPlusCircleFill size={iconSize} />,
      label: 'New Page',
      onClick: callbacks.onCreateNewPage,
      placeholder: false,
    },
    {
      id: 'search',
      icon: <IconSearch size={iconSize} />,
      label: 'Search',
      onClick: callbacks.onSearch,
      placeholder: false,
    },
    {
      id: 'settings',
      icon: <IconSliders size={iconSize} />,
      label: 'Settings',
      onClick: callbacks.onOpenSettings,
      placeholder: false,
    },
  ]
}

export const NavigationRail = ({
  currentView,
  onGoHome,
  onCreateNewPage,
  onSearch,
  onOpenSettings,
  onShare,
  selectedPageId,
  hidden,
}: NavigationRailProps) => {
  const { isPortraitMode } = useOrientation()

  // 根據模式決定 icon 尺寸
  const iconSize = isPortraitMode ? 24 : 20

  const buttonConfigs = getButtonConfigs(
    currentView,
    iconSize,
    {
      onGoHome,
      onCreateNewPage,
      onSearch,
      onOpenSettings,
      onShare,
    },
    selectedPageId
  )

  return (
    <nav className={`navigation-rail ${hidden ? 'hidden' : ''}`}>
      <div className="nav-rail-buttons">
        {buttonConfigs.map((config) => (
          <NavButton
            key={config.id}
            config={config}
          />
        ))}
      </div>
    </nav>
  )
}
