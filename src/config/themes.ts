/**
 * 主題模式系統
 * 定義應用程式的顏色主題，支援擴展
 */

export interface ThemeColors {
  // 背景色
  bgEditor: string
  bgEditorMarkdown: string  // Markdown 編輯器背景
  bgFolder: string
  bgPagelist: string
  bgToolbar: string
  bgRailbar: string
  bgInput: string
  bgHover: string
  bgInputSidebar: string  // FolderTree/PageList 輸入框背景
  bgHoverSidebar: string  // FolderTree/PageList hover 背景
  bgSelected: string
  bgSelectedToolbar: string  // Toolbar 按鈕選中狀態
  bgCode: string       // Code block 背景

  // 文字色
  textPrimary: string
  textSecondary: string
  textMuted: string
  textCode: string     // Code 文字顏色

  // 邊框與分隔線
  border: string
  borderLight: string
  borderSidebar: string  // FolderTree/PageList 按鈕邊框
  borderCode: string   // Code block 邊框
  divider: string

  // 強調色
  accent: string
  accentHover: string

  // 特殊用途
  shadow: string
  overlay: string
}

/**
 * 預設主題集合
 * 使用 Record<string, ThemeColors> 方便未來擴展
 */
export const themes: Record<string, ThemeColors> = {
  // 黑板模式 - 預設主題
  blackboard: {
    bgEditor: '#2d4a3e',      // 深綠黑板
    bgEditorMarkdown: '#3a3020',  // Markdown 暖棕背景
    bgFolder: 'linear-gradient(180deg, #352f28 0%, #2c2620 40%, #241f1a 100%)',      // 深灰棕漸層
    bgPagelist: 'linear-gradient(180deg, #4a3522 0%, #3d2817 40%, #2e1d10 100%)',    // 木頭書架漸層
    bgToolbar: '#1a332a',     // 黑板邊框深綠
    bgRailbar: '#1a332a',     // 與 toolbar 同色
    bgInput: '#3a5548',       // 深綠色輸入框（RailBar/Toolbar 用）
    bgHover: '#3a5548',       // 深綠色 hover（RailBar/Toolbar 用）
    bgInputSidebar: '#5a4a3a',  // 木頭色輸入框（FolderTree/PageList 用）
    bgHoverSidebar: '#6a5a4a',  // 木頭色 hover（FolderTree/PageList 用）
    bgSelected: 'linear-gradient(180deg, #7a6a5a 0%, #5a4a3a 40%, #4a3a2a 100%)',    // 木頭色選中狀態漸層
    bgSelectedToolbar: '#4a6558',  // Toolbar 按鈕選中狀態（亮綠色）
    bgCode: '#1a332a',        // Code block 深色背景

    textPrimary: '#f5f0dc',   // 粉筆淺黃
    textSecondary: '#c4bfb0', // 次要文字
    textMuted: '#8a8578',     // 淡化文字
    textCode: '#e8e4d9',      // Code 文字（粉筆白）

    border: '#4a5d54',        // 邊框
    borderLight: '#3d2a1e',   // 深巧克力木頭分隔線
    borderSidebar: '#6a5040', // 溫暖木頭書架按鈕邊框
    borderCode: '#4a5d54',    // Code block 邊框
    divider: '#3d2a1e',       // 深巧克力木頭分隔線（與 borderLight 同色）

    accent: '#f5d76e',        // 鵝黃色強調
    accentHover: '#f5f0dc',   // hover 強調

    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // 深色模式
  dark: {
    bgEditor: '#1e1e1e',      // VS Code 風格深色
    bgEditorMarkdown: '#1e1a2e',  // Markdown 深紫背景
    bgFolder: '#252526',      // 側邊欄
    bgPagelist: '#2d2d2d',    // 列表區
    bgToolbar: '#333333',     // 工具列
    bgRailbar: '#252526',     // 導航列
    bgInput: '#3c3c3c',       // 輸入框
    bgHover: '#404040',       // hover 狀態
    bgInputSidebar: '#3c3c3c',  // Sidebar 輸入框（同 bgInput）
    bgHoverSidebar: '#404040',  // Sidebar hover（同 bgHover）
    bgSelected: '#094771',    // 選中狀態（藍色）
    bgSelectedToolbar: '#094771',  // Toolbar 選中（同 bgSelected）
    bgCode: '#1e1e1e',        // Code block 背景

    textPrimary: '#d4d4d4',   // 主要文字
    textSecondary: '#9d9d9d', // 次要文字
    textMuted: '#6d6d6d',     // 淡化文字
    textCode: '#ce9178',      // Code 文字（VS Code 橘色）

    border: '#454545',        // 邊框
    borderLight: '#3c3c3c',   // 淺邊框
    borderSidebar: '#454545', // Sidebar 按鈕邊框（同 border）
    borderCode: '#454545',    // Code block 邊框
    divider: '#454545',       // 分隔線

    accent: '#569cd6',        // 藍色強調
    accentHover: '#6eb3f7',   // hover 強調

    shadow: 'rgba(0, 0, 0, 0.4)',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },

  // 淺色模式
  light: {
    bgEditor: '#ffffff',      // 純白
    bgEditorMarkdown: '#fef6e4',  // Markdown 奶油背景
    bgFolder: '#f3f3f3',      // 淺灰
    bgPagelist: '#fafafa',    // 列表區
    bgToolbar: '#f5f5f5',     // 工具列
    bgRailbar: '#f0f0f0',     // 導航列
    bgInput: '#ffffff',       // 輸入框
    bgHover: '#e8e8e8',       // hover 狀態
    bgInputSidebar: '#ffffff',  // Sidebar 輸入框（同 bgInput）
    bgHoverSidebar: '#e8e8e8',  // Sidebar hover（同 bgHover）
    bgSelected: '#cce5ff',    // 選中狀態（淺藍）
    bgSelectedToolbar: '#cce5ff',  // Toolbar 選中（同 bgSelected）
    bgCode: '#f6f8fa',        // Code block 背景（GitHub 風格）

    textPrimary: '#333333',   // 主要文字
    textSecondary: '#666666', // 次要文字
    textMuted: '#999999',     // 淡化文字
    textCode: '#24292f',      // Code 文字（GitHub 風格）

    border: '#dadce0',        // 邊框
    borderLight: '#e8e8e8',   // 淺邊框
    borderSidebar: '#dadce0', // Sidebar 按鈕邊框（同 border）
    borderCode: 'rgba(175, 184, 193, 0.2)', // Code block 邊框
    divider: '#e0e0e0',       // 分隔線

    accent: '#1a73e8',        // Google 藍
    accentHover: '#1557b0',   // hover 強調

    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.3)',
  },
}

/**
 * 將 camelCase 轉換為 kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * 套用主題到 document root
 * @param themeName 主題名稱
 */
export function applyTheme(themeName: string): void {
  const theme = themes[themeName] || themes.blackboard
  const root = document.documentElement

  // 設定 CSS variables
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--${camelToKebab(key)}`, value)
  })

  // 設定 data-theme attribute（可用於 CSS 選擇器）
  root.setAttribute('data-theme', themeName)
}

/**
 * 取得可用的主題列表
 */
export function getAvailableThemes(): Array<{ id: string; name: string }> {
  return [
    { id: 'blackboard', name: 'Blackboard' },
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
  ]
}

/**
 * 取得主題顯示名稱
 */
export function getThemeName(themeId: string): string {
  const themeMap: Record<string, string> = {
    blackboard: 'Blackboard',
    dark: 'Dark',
    light: 'Light',
  }
  return themeMap[themeId] || themeId
}

/**
 * 字體大小設定常數（Desktop / Mobile 分離）
 */
export const FONT_SIZE_LIMITS = {
  interface: { min: 12, max: 36 },
  content: { min: 12, max: 36 },
  // Desktop / Mobile 預設值
  desktop: {
    interface: 18,
    content: 18,
  },
  mobile: {
    interface: 24,
    content: 24,
  },
}

/**
 * 套用字體大小到 document root
 * @param interfaceSize 介面字體大小（px）
 * @param contentSize 內容字體大小（px）
 */
export function applyFontSize(interfaceSize: number, contentSize: number): void {
  const root = document.documentElement

  // 介面字體大小
  root.style.setProperty('--interface-font-size', `${interfaceSize}px`)
  root.style.setProperty('--interface-font-size-sm', `${Math.max(interfaceSize - 2, 10)}px`)
  root.style.setProperty('--interface-font-size-xs', `${Math.max(interfaceSize - 4, 9)}px`)

  // 內容字體大小
  root.style.setProperty('--content-font-size', `${contentSize}px`)
  root.style.setProperty('--content-font-size-h1', `${contentSize * 2}px`)
  root.style.setProperty('--content-font-size-h2', `${contentSize * 1.5}px`)
  root.style.setProperty('--content-font-size-h3', `${contentSize * 1.25}px`)
  root.style.setProperty('--content-font-size-code', `${contentSize * 0.85}px`)
}
