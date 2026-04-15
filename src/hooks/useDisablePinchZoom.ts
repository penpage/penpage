import { useEffect, useRef, useCallback } from 'react'

interface UseDisablePinchZoomOptions {
  /** scale !== 1 時的回呼，帶 debounce */
  onScaleChange?: (scale: number) => void
}

/**
 * 多層防禦禁止 pinch-to-zoom：
 * 1. Safari gesturestart/gesturechange 攔截
 * 2. 多指 touchmove 攔截
 * 3. visualViewport scale 偵測 + 回呼（終極 fallback）
 */
export function useDisablePinchZoom(options?: UseDisablePinchZoomOptions) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNotifiedScale = useRef<number>(1)

  const notifyScale = useCallback((scale: number) => {
    if (!options?.onScaleChange) return
    // 四捨五入到小數點後 2 位
    const rounded = Math.round(scale * 100) / 100
    if (rounded === lastNotifiedScale.current) return
    lastNotifiedScale.current = rounded

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      options.onScaleChange!(rounded)
    }, 300)
  }, [options?.onScaleChange])

  useEffect(() => {
    // --- 1. Safari 專有 gesture 事件攔截 ---
    const onGestureStart = (e: Event) => e.preventDefault()
    const onGestureChange = (e: Event) => e.preventDefault()

    document.addEventListener('gesturestart', onGestureStart, { passive: false } as any)
    document.addEventListener('gesturechange', onGestureChange, { passive: false } as any)

    // --- 2. 多指 touchmove 攔截 ---
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault()
      }
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    // --- 3. visualViewport scale 偵測 ---
    const vv = window.visualViewport
    const onViewportResize = () => {
      if (!vv) return
      const scale = vv.scale
      if (scale !== 1) {
        notifyScale(scale)
      }
    }

    if (vv) {
      vv.addEventListener('resize', onViewportResize)
    }

    return () => {
      document.removeEventListener('gesturestart', onGestureStart)
      document.removeEventListener('gesturechange', onGestureChange)
      document.removeEventListener('touchmove', onTouchMove)
      if (vv) {
        vv.removeEventListener('resize', onViewportResize)
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [notifyScale])
}
