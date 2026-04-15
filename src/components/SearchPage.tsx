/**
 * 搜尋頁面組件
 * 使用 FullHeightPanel 作為容器
 * Desktop/Landscape: 右側滑入 480px
 * Portrait: 全高面板，bottom: 64px（不覆蓋 NavBar）
 */

import { useEffect, useRef } from 'react'
import { useSearch } from '../hooks/useSearch'
import { SearchResultItem } from './SearchResultItem'
import { Page } from '../services/db'
import { WorkspaceId } from '../types/workspace'
import { IconSearch, IconXCircle, IconTimePast } from './icons/BootstrapIcons'
import { FullHeightPanel } from './FullHeightPanel'

interface SearchPageProps {
  isOpen: boolean
  onClose: () => void
  onSelectPage: (page: Page) => void
  workspaceId?: WorkspaceId
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

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

export function SearchPage({ isOpen, onClose, onSelectPage, workspaceId }: SearchPageProps) {
  const {
    query,
    setQuery,
    results,
    isSearching,
    hasSearched,
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    recentPages,
    loadRecentPages,
    clearSearch
  } = useSearch({ workspaceId })

  const inputRef = useRef<HTMLInputElement>(null)

  // 打開時自動聚焦輸入框並載入最近頁面
  useEffect(() => {
    if (isOpen) {
      // 載入最近頁面
      loadRecentPages()
      // 使用 setTimeout 確保動畫完成後聚焦
      if (inputRef.current) {
        const timer = setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
        return () => clearTimeout(timer)
      }
    }
  }, [isOpen, loadRecentPages])

  // 關閉時清除搜尋
  useEffect(() => {
    if (!isOpen) {
      clearSearch()
    }
  }, [isOpen, clearSearch])

  // 處理搜尋結果選擇
  const handleSelectResult = (page: Page) => {
    // 儲存搜尋歷史
    if (query.trim()) {
      addToHistory(query.trim())
    }
    onSelectPage(page)
  }

  // 處理歷史項目點擊
  const handleSelectHistory = (historyQuery: string) => {
    setQuery(historyQuery)
  }

  // 處理按下 Enter 或 ESC
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      addToHistory(query.trim())
    } else if (e.key === 'Escape') {
      if (query) {
        clearSearch()
      }
      // ESC 關閉由 FullHeightPanel 統一處理
    }
  }

  // 處理清除按鈕
  const handleClear = () => {
    clearSearch()
    inputRef.current?.focus()
  }

  // 搜尋專用 Header
  const searchHeader = (
    <div className="search-input-container">
      <IconSearch size={18} className="search-input-icon" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search pages..."
        className="search-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {query && (
        <button
          className="search-clear-btn"
          onClick={handleClear}
          aria-label="Clear"
        >
          <IconXCircle size={18} />
        </button>
      )}
    </div>
  )

  return (
    <FullHeightPanel
      isOpen={isOpen}
      onClose={onClose}
      header={searchHeader}
      noPadding
    >
      {/* 搜尋內容區 */}
      <div className="search-body">
          {/* 搜尋歷史（query 為空時顯示） */}
          {!query && history.length > 0 && (
            <div className="search-history">
              <div className="search-history-header">
                <span>Search History</span>
                <button
                  className="search-history-clear-all"
                  onClick={clearHistory}
                >
                  Clear All
                </button>
              </div>
              <div className="search-history-list">
                {history.map((item) => (
                  <div key={item.query} className="search-history-item">
                    <button
                      className="search-history-query"
                      onClick={() => handleSelectHistory(item.query)}
                    >
                      <span className="search-history-icon">🕐</span>
                      <span className="search-history-text">{item.query}</span>
                    </button>
                    <button
                      className="search-history-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFromHistory(item.query)
                      }}
                      aria-label="Remove"
                    >
                      <IconXCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最近頁面（query 為空時顯示） */}
          {!query && recentPages.length > 0 && (
            <div className="recent-pages">
              <div className="recent-pages-header">
                <span>Recent Pages</span>
              </div>
              <div className="recent-pages-list">
                {recentPages.map((page) => (
                  <button
                    key={page.id}
                    className="recent-page-item"
                    onClick={() => onSelectPage(page)}
                  >
                    <IconTimePast size={16} className="recent-page-icon" />
                    <span className="recent-page-title">{page.name || 'Untitled'}</span>
                    <span className="recent-page-time">{formatRelativeTime(page.updatedAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 無搜尋歷史且無最近頁面時的提示 */}
          {!query && history.length === 0 && recentPages.length === 0 && (
            <div className="search-empty-state">
              <IconSearch size={48} className="search-empty-icon" />
              <p>Enter keywords to search pages</p>
            </div>
          )}

          {/* 搜尋中 */}
          {query && isSearching && (
            <div className="search-loading">
              <span className="search-loading-spinner" />
              Searching...
            </div>
          )}

          {/* 無結果 */}
          {query && hasSearched && !isSearching && results.length === 0 && (
            <div className="search-no-results">
              <p>No results found for "{query}"</p>
              <p className="search-no-results-hint">Try different keywords</p>
            </div>
          )}

          {/* 搜尋結果 */}
          {query && results.length > 0 && (
            <div className="search-results">
              <div className="search-results-count">
                {results.length} results found
              </div>
              <div className="search-results-list">
                {results.map((result) => (
                  <SearchResultItem
                    key={result.page.id}
                    result={result}
                    onClick={handleSelectResult}
                    highlightQuery={query}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
    </FullHeightPanel>
  )
}
