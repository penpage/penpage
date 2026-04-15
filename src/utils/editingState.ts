/**
 * 編輯狀態追蹤（module-level ref）
 *
 * 用途：背景任務（cleanup / dedup）在清理「未編輯 page」時，
 * 需避免清掉使用者「正在開著 editor」的 page（race condition guard）。
 *
 * 目前架構為單 editor：若未來支援多 editor 同時打開，
 * 需改為 `Set<string>`。
 */

// 當前 editor 打開著的 page id（背景任務用來避免清掉使用者正在用的 page）
let currentEditingPageId: string | null = null

export function setCurrentEditingPage(id: string | null): void {
  currentEditingPageId = id
}

export function getCurrentEditingPage(): string | null {
  return currentEditingPageId
}

/**
 * 便利方法：這個 page 現在是不是被打開在 editor？
 */
export function isPageCurrentlyEditing(pageId: string): boolean {
  return currentEditingPageId === pageId
}
