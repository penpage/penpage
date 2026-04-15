/**
 * 環境感知的 Logger 工具
 * 在生產環境自動禁用 debug/log，但保留 error
 */

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * 調試信息 - 僅開發環境
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * 警告信息 - 僅開發環境
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },

  /**
   * 錯誤信息 - 所有環境
   */
  error: (...args: any[]) => {
    console.error(...args)
  },

  /**
   * 詳細調試信息 - 僅開發環境
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },

  /**
   * 信息日誌 - 僅開發環境
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args)
    }
  },

  /**
   * 分組日誌 - 僅開發環境
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label)
    }
  },

  /**
   * 結束分組 - 僅開發環境
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd()
    }
  },

  /**
   * 表格日誌 - 僅開發環境
   */
  table: (data: any) => {
    if (isDev) {
      console.table(data)
    }
  }
}

// ===== 統一分類 Logger =====
// 用法: const log = createLogger('SYNC')
//       log('開始同步')    → [SYNC 14:23:45] 開始同步
//       log.warn('問題')   → [SYNC 14:23:45] ⚠️ 問題
//       log.error('失敗')  → [SYNC 14:23:45] ❌ 失敗
//
// log() 受 localStorage.debug 控制（逗號分隔分類名）
// warn/error 永遠顯示

const getTimestamp = () =>
  new Date().toLocaleTimeString('en-GB', { hour12: false })

/** 檢查該分類是否啟用 debug 輸出 */
export function shouldLog(category: string): boolean {
  const debug = localStorage.getItem('debug')
  if (!debug) return false
  return debug.split(',').some(c => c.trim() === category)
}

export interface CategoryLogger {
  (msg: string): void
  warn: (msg: string) => void
  error: (msg: string, err?: unknown) => void
}

export function createLogger(category: string): CategoryLogger {
  const prefix = () => `[${category} ${getTimestamp()}]`
  const log = ((msg: string) => {
    if (shouldLog(category)) console.log(`${prefix()} ${msg}`)
  }) as CategoryLogger
  log.warn = (msg: string) => console.warn(`${prefix()} ⚠️ ${msg}`)
  log.error = (msg: string, err?: unknown) =>
    err ? console.error(`${prefix()} ❌ ${msg}`, err) : console.error(`${prefix()} ❌ ${msg}`)
  return log
}

// 預設導出
export default logger
