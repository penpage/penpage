/**
 * 搜尋功能 Hook
 * 提供搜尋狀態管理、debounced 搜尋和搜尋歷史管理
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { searchPages, SearchResult, getRecentPages } from '../services/searchService'
import { settingsService, SearchHistoryItem } from '../services/settings'
import { WorkspaceId } from '../types/workspace'
import { Page } from '../services/db'


// 取得穩定的 workspaceId（fallback 讀 settings）
const resolveWorkspaceId = (id?: WorkspaceId): WorkspaceId =>
  id || settingsService.getSelectedWorkspace()

interface UseSearchOptions {
  debounceMs?: number  // Debounce 延遲（預設 300ms）
  workspaceId?: WorkspaceId  // 限制搜尋範圍
}

interface UseSearchReturn {
  // 搜尋狀態
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  isSearching: boolean
  hasSearched: boolean  // 區分「尚未搜尋」和「搜尋後無結果」

  // 搜尋歷史
  history: SearchHistoryItem[]
  addToHistory: (query: string) => void
  removeFromHistory: (query: string) => void
  clearHistory: () => void

  // 最近頁面
  recentPages: Page[]
  loadRecentPages: () => Promise<void>

  // 操作
  clearSearch: () => void
  executeSearch: () => void
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 300, workspaceId } = options

  // 搜尋狀態
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // 搜尋歷史
  const [history, setHistory] = useState<SearchHistoryItem[]>(() =>
    settingsService.getSearchHistory()
  )

  // 最近頁面
  const [recentPages, setRecentPages] = useState<Page[]>([])

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 執行搜尋
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()

    if (!trimmed) {
      setResults([])
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    try {
      const searchResults = await searchPages(trimmed, resolveWorkspaceId(workspaceId))
      setResults(searchResults)
      setHasSearched(true)
    } catch (error) {
      console.error('搜尋失敗:', error)
      setResults([])
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }, [workspaceId])

  // Debounced setQuery
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)

    // 清除之前的 timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // 如果 query 為空，立即清除結果
    if (!newQuery.trim()) {
      setResults([])
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    // 設定新的 debounce timer
    setIsSearching(true)
    debounceTimerRef.current = setTimeout(() => {
      performSearch(newQuery)
    }, debounceMs)
  }, [debounceMs, performSearch])

  // 手動執行搜尋（用於按 Enter 時）
  const executeSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    performSearch(query)
  }, [query, performSearch])

  // 清除搜尋
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setQueryState('')
    setResults([])
    setHasSearched(false)
    setIsSearching(false)
  }, [])

  // 搜尋歷史管理
  const addToHistory = useCallback((searchQuery: string) => {
    settingsService.addSearchHistory(searchQuery)
    setHistory(settingsService.getSearchHistory())
  }, [])

  const removeFromHistory = useCallback((searchQuery: string) => {
    settingsService.removeSearchHistory(searchQuery)
    setHistory(settingsService.getSearchHistory())
  }, [])

  const clearHistory = useCallback(() => {
    settingsService.clearSearchHistory()
    setHistory([])
  }, [])

  // 載入最近頁面
  const loadRecentPages = useCallback(async () => {
    try {
      const pages = await getRecentPages(resolveWorkspaceId(workspaceId), 10)
      setRecentPages(pages)
    } catch (error) {
      console.error('載入最近頁面失敗:', error)
      setRecentPages([])
    }
  }, [workspaceId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
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
    clearSearch,
    executeSearch
  }
}
