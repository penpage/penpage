/**
 * 「未編輯 page」的統一語意：
 *   - 空白 content
 *   - 系統自動產生的預設 heading（例如 `# MM-DD`）
 *
 * 背景：新增 page 會自動載入 `# MM-DD\n` 作為 heading 起點。為了避免系統把
 * 它當成「有內容」而 sync / 留在 trash / 殘留在 dedup，所有背景服務
 * （delete / sync / cleanup / dedup）都改用 isPageUntouched 判定，
 * 將 MM-DD 預設頁的行為統一為「empty page」。
 *
 * 未來換預設格式（例如 YYYY-MM-DD）或取消 MM-DD 時，只需改此檔案。
 */

// 未來新增其他預設格式只需擴充這個 array
const DEFAULT_CONTENT_PATTERNS: RegExp[] = [
  /^#\s\d{2}-\d{2}\s*$/,  // MM-DD（目前預設）
]

/**
 * 產生今日 MM-DD 預設 heading（給 pageHelper.ensureFolderAndPage 用）
 */
export function generateDefaultContent(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `# ${mm}-${dd}\n`
}

/**
 * 計算 default content 的 WYSIWYG cursor 位置（h1 邊界 + text 長度）
 * 對應 generateDefaultContent 的輸出；若未來改格式需同步調整
 */
export function getDefaultContentCursorPosition(): number {
  return 1 + 5  // h1 開邊界(1) + "MM-DD" 長度(5)
}

/**
 * Pure predicate：判定 page 內容是否為「未編輯」狀態。
 * 命中條件：空白 or 匹配任一預設 pattern（接受任何 MM-DD，不限今天）。
 *
 * 呼叫者注意：這是純內容判定，不管 editing/focus state，
 * 背景任務（cleanup / dedup）需另外組合 editingState 的 guard。
 */
export function isPageUntouched(content: string | undefined | null): boolean {
  if (!content) return true
  const trimmed = content.trim()
  if (trimmed === '') return true
  return DEFAULT_CONTENT_PATTERNS.some(p => p.test(trimmed))
}
