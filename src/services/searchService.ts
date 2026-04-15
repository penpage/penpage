/**
 * 搜尋服務
 * 提供頁面搜尋功能，支援標題和內容搜尋
 */

import { db, Page, Folder } from './db'
import { WorkspaceId } from '../types/workspace'
import { isTrashFolderId } from './rootFolders'

/**
 * 搜尋結果
 */
export interface SearchResult {
  page: Page
  folder?: Folder  // 所屬資料夾（用於顯示路徑）
  matchType: 'title' | 'content' | 'both'
  contentPreview?: string  // 匹配內容的片段預覽
  score: number  // 搜尋評分（用於排序）
}

/**
 * 搜尋所有頁面
 * @param query 搜尋關鍵字
 * @param workspaceId Workspace ID
 * @returns 搜尋結果陣列，按評分降序排列
 */
export async function searchPages(
  query: string,
  workspaceId: WorkspaceId
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim().toLowerCase()
  if (!trimmedQuery) return []

  // 取得所有頁面（已限定 workspace）
  const allPages = await db(workspaceId).getAllPages()

  // 取得所有資料夾（用於顯示路徑）
  const allFolders = await db(workspaceId).getAllFolders()
  const folderMap = new Map<string, Folder>(allFolders.map(f => [f.id, f]))

  const results: SearchResult[] = []

  for (const page of allPages) {
    // 排除已刪除的頁面
    if (page.isDeleted) continue

    // 排除 Trash 內的頁面
    if (isTrashFolderId(page.folderId)) continue

    // 計算匹配
    const match = calculateMatch(page, trimmedQuery)
    if (match) {
      results.push({
        ...match,
        folder: folderMap.get(page.folderId)
      })
    }
  }

  // 按評分降序排序
  results.sort((a, b) => b.score - a.score)

  return results
}

/**
 * 計算頁面與搜尋詞的匹配
 */
function calculateMatch(page: Page, query: string): Omit<SearchResult, 'folder'> | null {
  const titleLower = page.name.toLowerCase()
  const contentLower = page.content.toLowerCase()

  const titleMatch = titleLower.includes(query)
  const contentMatch = contentLower.includes(query)

  if (!titleMatch && !contentMatch) return null

  // 計算評分
  let score = 0

  // 標題匹配權重較高
  if (titleMatch) {
    score += 100
    // 標題開頭匹配加分
    if (titleLower.startsWith(query)) {
      score += 50
    }
    // 完全匹配加分
    if (titleLower === query) {
      score += 30
    }
  }

  // 內容匹配
  if (contentMatch) {
    score += 10
    // 計算匹配次數（最多加 20 分）
    const matchCount = countMatches(contentLower, query)
    score += Math.min(matchCount * 2, 20)
  }

  // 較新的頁面略微加分
  const ageBonus = Math.max(0, 5 - Math.floor((Date.now() - page.updatedAt) / (1000 * 60 * 60 * 24 * 30)))
  score += ageBonus

  // 提取內容預覽
  const contentPreview = contentMatch
    ? extractMatchContext(page.content, query)
    : undefined

  return {
    page,
    matchType: titleMatch && contentMatch ? 'both' : (titleMatch ? 'title' : 'content'),
    contentPreview,
    score
  }
}

/**
 * 計算字串中的匹配次數
 */
function countMatches(text: string, query: string): number {
  let count = 0
  let pos = 0
  while ((pos = text.indexOf(query, pos)) !== -1) {
    count++
    pos += query.length
  }
  return count
}

/**
 * 提取匹配位置前後的文字作為預覽
 * @param text 原始文字
 * @param query 搜尋詞
 * @param contextLength 前後各取多少字元（預設 40）
 */
function extractMatchContext(text: string, query: string, contextLength: number = 40): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return ''

  // 計算起始和結束位置
  const start = Math.max(0, index - contextLength)
  const end = Math.min(text.length, index + query.length + contextLength)

  // 提取片段
  let preview = text.slice(start, end)

  // 加上省略號
  if (start > 0) preview = '...' + preview
  if (end < text.length) preview = preview + '...'

  // 移除換行符，保持單行
  preview = preview.replace(/\n/g, ' ').replace(/\s+/g, ' ')

  return preview
}

/**
 * Escape 正則表達式特殊字元
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 取得最近更新的頁面
 * @param workspaceId Workspace ID
 * @param limit 限制數量（預設 10）
 * @returns 最近更新的頁面陣列，按 updatedAt 降序排列
 */
export async function getRecentPages(
  workspaceId: WorkspaceId,
  limit: number = 10
): Promise<Page[]> {
  // 取得所有頁面（已限定 workspace）
  const allPages = await db(workspaceId).getAllPages()

  // 過濾並排序
  const recentPages = allPages
    // 排除已刪除的頁面
    .filter(page => !page.isDeleted)
    // 排除 Trash 內的頁面
    .filter(page => !isTrashFolderId(page.folderId))
    // 按 updatedAt 降序排序
    .sort((a, b) => b.updatedAt - a.updatedAt)
    // 取前 N 筆
    .slice(0, limit)

  return recentPages
}
