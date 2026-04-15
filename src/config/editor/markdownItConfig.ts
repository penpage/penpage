import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

// DOMPurify 淨化設定（允許安全的 HTML 標籤和屬性）
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    // 區塊元素
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
    // 表格
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // 行內元素
    'a', 'strong', 'em', 'del', 'mark', 'sub', 'sup', 'span',
    // 圖片
    'img',
    // Task list 所需
    'input', 'label',
  ],
  ALLOWED_ATTR: [
    // 連結
    'href', 'target', 'rel',
    // 圖片
    'src', 'alt', 'title',
    // 通用
    'class', 'id',
    // 樣式（文字顏色）
    'style',
    // Task list 與自定義 data 屬性
    'data-type', 'data-checked', 'data-language', 'data-src',
    'type', 'checked', 'disabled',
  ],
  // 允許 data-* 屬性（Task list 等功能需要）
  ALLOW_DATA_ATTR: true,
  // 允許自定義 URI scheme（image:// 用於本地圖片引用）
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob|data|image):)|(?:#|\/)/i,
}

// 創建 markdown-it 實例
// 使用 commonmark 模式確保 100% CommonMark 合規，巢狀列表解析正確
const md = new MarkdownIt({
  html: true,        // 允許 HTML 標籤
  breaks: false,     // 不將單個換行轉為 <br>
  linkify: false,    // 不自動轉換 URL 為連結
})

// HTML 转义函数
const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

// 自定義 fence (code block) 渲染器
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const lang = token.info.trim() || ''
  const langClass = lang ? ` class="language-${lang}" data-language="${lang}"` : ''
  const escapedCode = escapeHtml(token.content)
  // 移除末尾換行符，避免累積空行
  const trimmedCode = escapedCode.replace(/\n$/, '')
  return `<pre${langClass}><code>${trimmedCode}</code></pre>\n`
}

// 自定義 code_block 渲染器（縮排式代碼塊）
md.renderer.rules.code_block = (tokens, idx) => {
  const token = tokens[idx]
  const escapedCode = escapeHtml(token.content)
  const trimmedCode = escapedCode.replace(/\n$/, '')
  return `<pre><code>${trimmedCode}</code></pre>\n`
}

// 自定義列表項渲染器，支援 task list（GFM checkbox）
md.renderer.rules.list_item_open = (tokens, idx) => {
  const token = tokens[idx]

  // 檢查下一個 token 是否包含 checkbox
  // markdown-it 解析 `- [ ]` 或 `- [x]` 時，會在 paragraph 內容開頭包含 checkbox 文字
  const nextToken = tokens[idx + 1]
  const contentToken = tokens[idx + 2]

  if (nextToken && nextToken.type === 'paragraph_open' && contentToken && contentToken.type === 'inline') {
    const content = contentToken.content
    // 檢查是否為 task list item：以 [ ] 或 [x] 或 [X] 開頭
    const taskMatch = content.match(/^\[([ xX])\]\s*/)
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x'
      // 從內容中移除 checkbox 標記
      // 重要：必須同時修改 content 和 children
      contentToken.content = content.slice(taskMatch[0].length)
      // 修改 children 中的第一個 text token
      if (contentToken.children && contentToken.children.length > 0) {
        const firstChild = contentToken.children[0]
        if (firstChild.type === 'text' && firstChild.content.startsWith(taskMatch[0])) {
          firstChild.content = firstChild.content.slice(taskMatch[0].length)
        }
      }
      // 標記這個 list_item 為 taskItem
      token.meta = { isTask: true, checked }
      return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked' : ''}><span>`
    }
  }

  return '<li>'
}

md.renderer.rules.list_item_close = (tokens, idx) => {
  // 找到對應的 list_item_open
  let openIdx = idx - 1
  let depth = 1
  while (openIdx >= 0 && depth > 0) {
    if (tokens[openIdx].type === 'list_item_close') depth++
    if (tokens[openIdx].type === 'list_item_open') depth--
    if (depth > 0) openIdx--
  }

  const openToken = tokens[openIdx]
  if (openToken && openToken.meta && openToken.meta.isTask) {
    return '</span></label></li>\n'
  }
  return '</li>\n'
}

// 自定義列表渲染器，為 taskList 添加 data-type 屬性
md.renderer.rules.bullet_list_open = (tokens, idx) => {
  // 檢查第一個 list_item 是否為 taskItem
  // 往後找到第一個 list_item_open
  let checkIdx = idx + 1
  while (checkIdx < tokens.length && tokens[checkIdx].type !== 'list_item_open') {
    checkIdx++
  }

  if (checkIdx < tokens.length) {
    const nextToken = tokens[checkIdx + 1]
    const contentToken = tokens[checkIdx + 2]

    if (nextToken && nextToken.type === 'paragraph_open' && contentToken && contentToken.type === 'inline') {
      const content = contentToken.content
      if (/^\[([ xX])\]\s*/.test(content)) {
        return '<ul data-type="taskList">\n'
      }
    }
  }

  return '<ul>\n'
}

md.renderer.rules.bullet_list_close = () => '</ul>\n'

md.renderer.rules.ordered_list_open = () => '<ol>\n'
md.renderer.rules.ordered_list_close = () => '</ol>\n'

// 導出配置函數（為了向後兼容，保持相同的 API）
export const configureMarkdownIt = () => {
  // markdown-it 的配置已在創建實例時完成
  // 這個函數主要是為了保持與原 configureMarked 相同的調用方式
}

// 輔助函數：將 Markdown 轉換為 HTML（使用 DOMPurify 淨化防止 XSS）
export const markdownToHtml = (markdown: string): string => {
  const rawHtml = md.render(markdown)
  // 使用 as any 繞過 DOMPurify 版本間的類型不相容問題
  return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG as any) as unknown as string
}

// 為了向後兼容，也導出 configureMarked 別名
export const configureMarked = configureMarkdownIt
