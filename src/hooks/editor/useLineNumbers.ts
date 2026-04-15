/**
 * useLineNumbers Hook
 * WYSIWYG 編輯器行號計算
 * 遍歷 ProseMirror block 結構，回傳每個 block 的行號與 Y 座標
 * Gutter 由呼叫端用 JSX 渲染（不在 ProseMirror DOM 內插入外來元素）
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface LineEntry {
  num: number
  top: number
}

/**
 * 計算 WYSIWYG 行號
 * - p, h1~h6, blockquote 等：各佔 1 號
 * - hr：不編號
 * - pre (code block)：<pre> 不佔號，code 內每行繼續編號
 * - ul/ol：每個 li 一號
 * - table：<table> 不佔號，每個 tr 各一號
 */
function computeLineNumbers(proseMirror: HTMLElement): LineEntry[] {
  const entries: LineEntry[] = []
  let lineNum = 1

  for (const child of Array.from(proseMirror.children)) {
    const el = child as HTMLElement
    // hr 不編號
    if (el.matches?.('hr')) continue

    if (el.matches?.('pre')) {
      // Code block：<pre> 不佔號，code 內每行繼續編號
      const code = el.querySelector('code')
      const text = code?.textContent || ''
      const lines = text.split('\n')
      // 如果最後一行是空字串（trailing newline），不計入
      if (lines.length > 1 && lines[lines.length - 1] === '') {
        lines.pop()
      }
      const style = getComputedStyle(el)
      const codeEl = code || el
      const codeStyle = getComputedStyle(codeEl)
      const lineHeight = parseFloat(codeStyle.lineHeight) || parseFloat(codeStyle.fontSize) * 1.6
      const paddingTop = parseFloat(style.paddingTop)
      // el.offsetTop 已是相對於 offsetParent（.ProseMirror with position:relative）
      for (let i = 0; i < lines.length; i++) {
        entries.push({
          num: lineNum++,
          top: el.offsetTop + paddingTop + i * lineHeight,
        })
      }
    } else if (el.matches?.('ul, ol')) {
      // List：每個 li 一號（含巢狀 sub-items）
      const lis = el.querySelectorAll('li')
      for (const li of Array.from(lis)) {
        entries.push({
          num: lineNum++,
          top: (li as HTMLElement).offsetTop,
        })
      }
    } else if (el.matches?.('table') || el.querySelector('table')) {
      // Table：<table> 不佔號，每個 tr 各一號
      // TipTap 可能用 wrapper div 包裹 table，所以也檢查子元素
      const elRect = el.getBoundingClientRect()
      const rows = el.querySelectorAll('tr')
      for (const row of Array.from(rows)) {
        const rowRect = row.getBoundingClientRect()
        entries.push({
          num: lineNum++,
          top: el.offsetTop + (rowRect.top - elRect.top),
        })
      }
    } else {
      // p, h1~h6, blockquote, image 等：各佔 1 號
      entries.push({
        num: lineNum++,
        top: el.offsetTop,
      })
    }
  }
  return entries
}

/**
 * 回傳行號清單（LineEntry[]），由呼叫端用 JSX 渲染
 * @param enabled 是否啟用
 * @param containerEl .wysiwyg-editor 的 DOM 元素（用 callback ref 取得）
 */
export function useLineNumbers(
  enabled: boolean,
  containerEl: HTMLElement | null,
): LineEntry[] {
  const [entries, setEntries] = useState<LineEntry[]>([])
  const rafId = useRef(0)

  const update = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      if (!containerEl) return
      const pm = containerEl.querySelector('.ProseMirror') as HTMLElement | null
      if (!pm) return
      setEntries(computeLineNumbers(pm))
    })
  }, [containerEl])

  useEffect(() => {
    if (!enabled || !containerEl) {
      setEntries([])
      return
    }

    // 首次計算
    update()

    const pm = containerEl.querySelector('.ProseMirror') as HTMLElement | null
    if (!pm) return

    // MutationObserver：偵測內容變動
    const mo = new MutationObserver(() => update())
    mo.observe(pm, { childList: true, subtree: true, characterData: true })

    // ResizeObserver：偵測尺寸變動（折行改變）
    const ro = new ResizeObserver(() => update())
    ro.observe(pm)

    return () => {
      mo.disconnect()
      ro.disconnect()
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [enabled, containerEl, update])

  return entries
}
