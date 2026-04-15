/**
 * 搜尋結果項目組件
 * 顯示單個搜尋結果，包含標題、內容預覽、資料夾名稱和更新時間
 */

import { SearchResult, escapeRegExp } from '../services/searchService'
import { Page } from '../services/db'

interface SearchResultItemProps {
  result: SearchResult
  onClick: (page: Page) => void
  highlightQuery: string
}

/**
 * 高亮顯示匹配文字
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const escaped = escapeRegExp(query)
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={i} className="search-highlight">{part}</mark>
    }
    return part
  })
}

/**
 * 格式化相對時間
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  } else if (days > 0) {
    return `${days}d ago`
  } else if (hours > 0) {
    return `${hours}h ago`
  } else if (minutes > 0) {
    return `${minutes}m ago`
  } else {
    return 'Just now'
  }
}

export function SearchResultItem({ result, onClick, highlightQuery }: SearchResultItemProps) {
  const { page, folder, contentPreview, matchType } = result

  const handleClick = () => {
    onClick(page)
  }

  return (
    <div className="search-result-item" onClick={handleClick}>
      {/* 標題 */}
      <div className="search-result-title">
        {highlightText(page.name || 'Untitled', highlightQuery)}
      </div>

      {/* 內容預覽（僅當有內容匹配時顯示） */}
      {contentPreview && (matchType === 'content' || matchType === 'both') && (
        <div className="search-result-preview">
          {highlightText(contentPreview, highlightQuery)}
        </div>
      )}

      {/* 元資訊：資料夾名稱 + 更新時間 */}
      <div className="search-result-meta">
        {folder && (
          <span className="search-result-folder">
            📁 {folder.name}
          </span>
        )}
        <span className="search-result-time">
          {formatRelativeTime(page.updatedAt)}
        </span>
      </div>
    </div>
  )
}
