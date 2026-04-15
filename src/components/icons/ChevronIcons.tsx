/**
 * ChevronIcons - 統一的方向箭頭 SVG 元件
 * iOS Mail 風格：細線條、圓角端點
 */

interface ChevronProps {
  size?: number
  className?: string
  strokeWidth?: number
}

// 共用的 SVG 屬性
const getCommonProps = (size: number, className: string, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
})

/**
 * ChevronLeft (<)
 * 用於：返回按鈕
 */
export const ChevronLeft = ({ size = 16, className = '', strokeWidth = 1.5 }: ChevronProps) => (
  <svg {...getCommonProps(size, className, strokeWidth)}>
    <path d="M10 12L6 8L10 4" />
  </svg>
)

/**
 * ChevronRight (>)
 * 用於：資料夾折疊狀態
 */
export const ChevronRight = ({ size = 16, className = '', strokeWidth = 1.5 }: ChevronProps) => (
  <svg {...getCommonProps(size, className, strokeWidth)}>
    <path d="M6 4L10 8L6 12" />
  </svg>
)

/**
 * ChevronUp (^)
 * 用於：Workspace 展開狀態、排序方向（升序）
 */
export const ChevronUp = ({ size = 16, className = '', strokeWidth = 1.5 }: ChevronProps) => (
  <svg {...getCommonProps(size, className, strokeWidth)}>
    <path d="M4 10L8 6L12 10" />
  </svg>
)

/**
 * ChevronDown (v)
 * 用於：資料夾展開狀態、Workspace 折疊狀態、排序方向（降序）
 */
export const ChevronDown = ({ size = 16, className = '', strokeWidth = 1.5 }: ChevronProps) => (
  <svg {...getCommonProps(size, className, strokeWidth)}>
    <path d="M4 6L8 10L12 6" />
  </svg>
)
