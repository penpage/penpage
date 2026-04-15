/**
 * Editor Toolbar SVG Icons
 * 統一使用 currentColor 繼承父元素顏色
 */

interface IconProps {
  size?: number
  className?: string
}

// Undo - D style
export const UndoIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8 4l-6 6 6 6" />
    <path d="M2 10h14a6 6 0 1 1 0 12h-4" />
  </svg>
)

// Redo - D style
export const RedoIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 4l6 6-6 6" />
    <path d="M22 10H8a6 6 0 1 0 0 12h4" />
  </svg>
)

// Bold - A style
export const BoldIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
)

// Italic - D style
export const ItalicIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M11 4h6" />
    <path d="M7 20h6" />
    <path d="M14 4l-4 16" />
  </svg>
)

// Strikethrough - S 字母 + 刪除線
export const StrikethroughIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <text x="5" y="21" fontSize="26" fill="currentColor" stroke="none" fontFamily="Georgia, serif" fontWeight="400">S</text>
    <line x1="1" y1="12" x2="26" y2="12" strokeWidth={1.75} />
  </svg>
)

// FontA - 單純 A 字母（用於 Font Group 按鈕）
export const FontAIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <text x="3" y="20" fontSize="26" fill="currentColor" stroke="none" fontFamily="system-ui" fontWeight="600">A</text>
  </svg>
)

// TextColor - A 字母 + 底線顏色條
export const TextColorIcon = ({ size = 20, className = '', color = 'currentColor' }: IconProps & { color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <text x="5" y="17" fontSize="18" fill="currentColor" stroke="none" fontFamily="system-ui" fontWeight="500">A</text>
    <line x1="3" y1="21" x2="21" y2="21" stroke={color} strokeWidth={3} />
  </svg>
)

// H1 - D style
export const H1Icon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="2 2 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 5v14" />
    <path d="M12 5v14" />
    <path d="M4 12h8" />
    <path d="M18 7v12" />
  </svg>
)

// H2 - D style
export const H2Icon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 5v14" />
    <path d="M12 5v14" />
    <path d="M4 12h8" />
    <path d="M16 11c0-1.5 1.5-3 3.5-3S23 9.5 23 11c0 3-7 4-7 8h7" />
  </svg>
)

// H3 - D style
export const H3Icon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 5v14" />
    <path d="M12 5v14" />
    <path d="M4 12h8" />
    <path d="M16 9h5l-3 3.5c2 0 3.5 1.5 3.5 3.5 0 2-1.5 3-3.5 3-1.5 0-2.5-.5-3-1.5" />
  </svg>
)

// Bullet List - 4 style (空心圓)
export const BulletListIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="4" cy="5" r="2" fill="none" />
    <circle cx="4" cy="12" r="2" fill="none" />
    <circle cx="4" cy="19" r="2" fill="none" />
    <line x1="10" y1="5" x2="21" y2="5" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="19" x2="21" y2="19" />
  </svg>
)

// Ordered List - 2C style (超大兩條)
export const OrderedListIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <text x="0" y="11" fontSize="12" fill="currentColor" stroke="none" fontWeight="900">1</text>
    <text x="0" y="22" fontSize="12" fill="currentColor" stroke="none" fontWeight="900">2</text>
    <line x1="12" y1="7" x2="16" y2="7" />
    <line x1="12" y1="18" x2="16" y2="18" />
  </svg>
)

// Checkbox - D style (大圓角，單純方框打勾)
export const CheckboxIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M7 12l4 4 6-7" />
  </svg>
)

// Quote - C style (左線)
export const QuoteIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="3" y1="5" x2="3" y2="19" />
    <line x1="8" y1="5" x2="21" y2="5" />
    <line x1="8" y1="12" x2="18" y2="12" />
    <line x1="8" y1="19" x2="15" y2="19" />
  </svg>
)

// Code - A style (角括)
export const CodeIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

// Horizontal Rule - 粗實線
export const HRIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
)

// Emoji - 笑臉圖示
export const EmojiIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth={2} />
    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth={2} />
  </svg>
)

// Table - 3x2-A style (3 rows x 2 columns)
export const TableIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
)

// Table Insert - 表格 + 加號（加大）
export const TableInsertIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="12" height="12" rx="2" />
    <line x1="3" y1="7" x2="15" y2="7" />
    <line x1="3" y1="11" x2="15" y2="11" />
    <line x1="9" y1="3" x2="9" y2="15" />
    <circle cx="18" cy="18" r="6" fill="white" stroke="none" />
    <line x1="18" y1="14" x2="18" y2="22" stroke="#3d5a4c" strokeWidth={2.5} />
    <line x1="14" y1="18" x2="22" y2="18" stroke="#3d5a4c" strokeWidth={2.5} />
  </svg>
)

// Row Insert Above - 上方插入行
export const RowInsertAboveIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="10" width="18" height="11" rx="1" />
    <line x1="3" y1="16" x2="21" y2="16" />
    <line x1="12" y1="10" x2="12" y2="21" />
    <path d="M12 2v6M9 5l3-3 3 3" strokeWidth={2} />
  </svg>
)

// Row Insert Below - 下方插入行
export const RowInsertBelowIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="11" rx="1" />
    <line x1="3" y1="8" x2="21" y2="8" />
    <line x1="12" y1="3" x2="12" y2="14" />
    <path d="M12 22v-6M9 19l3 3 3-3" strokeWidth={2} />
  </svg>
)

// Row Delete - 刪除行（正方形兩個 row，上面 row 圓形紅底白叉）
export const RowDeleteIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <circle cx="12" cy="7.5" r="6" fill="#e53e3e" stroke="none" />
    <line x1="9" y1="4.5" x2="15" y2="10.5" stroke="white" strokeWidth={2.5} />
    <line x1="15" y1="4.5" x2="9" y2="10.5" stroke="white" strokeWidth={2.5} />
  </svg>
)

// Column Insert Left - 左側插入列
export const ColumnInsertLeftIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="10" y="3" width="11" height="18" rx="1" />
    <line x1="16" y1="3" x2="16" y2="21" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <path d="M2 12h6M5 9l-3 3 3 3" strokeWidth={2} />
  </svg>
)

// Column Insert Right - 右側插入列
export const ColumnInsertRightIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="11" height="18" rx="1" />
    <line x1="8" y1="3" x2="8" y2="21" />
    <line x1="3" y1="12" x2="14" y2="12" />
    <path d="M22 12h-6M19 9l3 3-3 3" strokeWidth={2} />
  </svg>
)

// Column Delete - 刪除列（正方形兩個 column，左邊 column 圓形紅底白叉）
export const ColumnDeleteIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <circle cx="7.5" cy="12" r="6" fill="#e53e3e" stroke="none" />
    <line x1="4.5" y1="9" x2="10.5" y2="15" stroke="white" strokeWidth={2.5} />
    <line x1="10.5" y1="9" x2="4.5" y2="15" stroke="white" strokeWidth={2.5} />
  </svg>
)

// Table Delete - 刪除表格（紅色圈圈 X 加大）
export const TableDeleteIcon = ({ size = 16, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="12" height="12" rx="2" />
    <line x1="3" y1="7" x2="15" y2="7" />
    <line x1="3" y1="11" x2="15" y2="11" />
    <line x1="9" y1="3" x2="9" y2="15" />
    <circle cx="18" cy="18" r="6" fill="#e53e3e" stroke="none" />
    <line x1="15" y1="15" x2="21" y2="21" stroke="white" strokeWidth={2.5} />
    <line x1="21" y1="15" x2="15" y2="21" stroke="white" strokeWidth={2.5} />
  </svg>
)

// Link - A style (鏈條)
export const LinkIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

// ==================== Mobile Bottom Toolbar Group Icons ====================

// Edit Group - 鉛筆圖示
export const EditGroupIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
)

// Font Group - 文字 A 圖示
export const FontGroupIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 20h12" />
    <path d="M12 4v16" />
    <path d="M6 8V4h12v4" />
  </svg>
)

// Para Group - 段落圖示（列表線條）
export const ParaGroupIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth={3} />
    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth={3} />
    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth={3} />
  </svg>
)

// Insert Group - 加號圖示
export const InsertGroupIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

// Image Icon - 圖片圖示
export const ImageIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)

// Indent（增加縮排）
export const IndentIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="9" y1="12" x2="21" y2="12" />
    <line x1="9" y1="19" x2="21" y2="19" />
    <polyline points="3 9 7 12 3 15" />
  </svg>
)

// Outdent（減少縮排）
export const OutdentIcon = ({ size = 20, className = '' }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="9" y1="12" x2="21" y2="12" />
    <line x1="9" y1="19" x2="21" y2="19" />
    <polyline points="7 9 3 12 7 15" />
  </svg>
)
