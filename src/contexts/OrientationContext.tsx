/**
 * Orientation Context - 統一管理裝置方向和螢幕模式
 *
 * 三種模式：
 * - desktop: 寬度 > 768px 且非小螢幕橫向
 * - mobile-portrait: 寬度 <= 768px
 * - mobile-landscape: 高度 <= 500px 且橫向（與 CSS media query 一致）
 *
 * mobile-landscape 的 UI 行為與 desktop 相同（NavBar 左側、Sidebar 三態）
 *
 * 實作策略：訂閱兩條 MediaQueryList 的 'change' 事件
 * - MQL change 與 CSS media query 切換「同步」觸發，與 CSS state 無 gap
 * - 不再讀取 window.innerWidth/innerHeight，因此繞過 WebKit #170595
 *   （iOS Safari resize 事件觸發時 innerWidth 尚未更新的 bug）
 * - 消除 React state 晚於 CSS 切換的時序縫隙，避免旋轉瞬間 portrait-scoped
 *   CSS 已失效但 JSX 仍依 React state 渲染 mobile-nav-header 的閃爍
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'

export type DeviceMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape'

export interface OrientationState {
  /** 當前裝置模式 */
  mode: DeviceMode
  /** 是否為 Portrait 模式（只有 mobile-portrait 為 true） */
  isPortraitMode: boolean
  /** 是否為 Desktop-like 模式（desktop 或 mobile-landscape 為 true） */
  isDesktopLike: boolean
}

const OrientationContext = createContext<OrientationState | null>(null)

/**
 * Media query 常量
 * 必須與 src/styles/editor.css 的斷點保持一致
 * - Portrait：@media (max-width: 768px)
 * - Mobile Landscape：@media (max-height: 500px) and (orientation: landscape)
 */
const PORTRAIT_MQ = '(max-width: 768px)'
const MOBILE_LANDSCAPE_MQ = '(max-height: 500px) and (orientation: landscape)'

/**
 * 從兩條 MediaQueryList 計算 orientation 狀態
 * 判斷邏輯與 CSS media query 完全一致
 */
function calcFromMatchMedia(
  portraitMql: MediaQueryList,
  mobileLandscapeMql: MediaQueryList
): OrientationState {
  // Mobile Portrait：寬度 <= 768
  if (portraitMql.matches) {
    return {
      mode: 'mobile-portrait',
      isPortraitMode: true,
      isDesktopLike: false,
    }
  }

  // Mobile Landscape：高度 <= 500 且橫向
  if (mobileLandscapeMql.matches) {
    return {
      mode: 'mobile-landscape',
      isPortraitMode: false,
      isDesktopLike: true, // UI 行為類似 Desktop
    }
  }

  // Desktop
  return {
    mode: 'desktop',
    isPortraitMode: false,
    isDesktopLike: true,
  }
}

/**
 * OrientationProvider - 方向狀態提供者
 */
export function OrientationProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer：mount 當下就透過 matchMedia 取得初值
  const [state, setState] = useState<OrientationState>(() =>
    calcFromMatchMedia(
      window.matchMedia(PORTRAIT_MQ),
      window.matchMedia(MOBILE_LANDSCAPE_MQ)
    )
  )

  useEffect(() => {
    const portraitMql = window.matchMedia(PORTRAIT_MQ)
    const mobileLandscapeMql = window.matchMedia(MOBILE_LANDSCAPE_MQ)

    const handleChange = () => {
      setState(calcFromMatchMedia(portraitMql, mobileLandscapeMql))
    }

    // 訂閱 MQL change 事件
    portraitMql.addEventListener('change', handleChange)
    mobileLandscapeMql.addEventListener('change', handleChange)

    // 掛載後主動同步一次：避免 initializer 與 effect 之間極少數情境的競態
    handleChange()

    return () => {
      portraitMql.removeEventListener('change', handleChange)
      mobileLandscapeMql.removeEventListener('change', handleChange)
    }
  }, [])

  // 用 useMemo 優化：只在 mode 變化時產生新的 value 物件
  // 避免因為 state 物件參考改變而觸發不必要的 re-render
  const value = useMemo(
    () => state,
    [state.mode] // 只依賴 mode，因為其他屬性都由 mode 決定
  )

  return (
    <OrientationContext.Provider value={value}>
      {children}
    </OrientationContext.Provider>
  )
}

/**
 * useOrientation Hook - 便捷地使用方向 Context
 *
 * @example
 * const { mode, isPortraitMode, isDesktopLike } = useOrientation()
 *
 * // 根據 mode 決定行為
 * if (isPortraitMode) {
 *   // Mobile Portrait 行為：NavBar 底部、mobileView 四層導覽
 * } else {
 *   // Desktop-like 行為：NavBar 左側、Sidebar 三態模式
 * }
 */
export function useOrientation(): OrientationState {
  const context = useContext(OrientationContext)
  if (!context) {
    throw new Error('useOrientation must be used within an OrientationProvider')
  }
  return context
}
