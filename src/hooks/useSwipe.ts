import { useState, useEffect, useRef, useCallback } from 'react'

// 共用 swipe 手勢 hook（原生 APP 風格左滑動作面板）
// 從 PageList.tsx 提取，供 PageList 和 FolderTree 共用

interface UseSwipeOptions {
  actionWidth?: number       // swipe action panel 寬度，預設 140
  enabled?: boolean          // 是否啟用，edit mode 時可設 false
}

interface UseSwipeReturn {
  // 狀態
  swipedItemId: string | null
  swipingItemId: string | null
  swipeTranslateX: number
  isSwipeAnimating: boolean

  // 事件 handlers（綁到各 item 上）
  handleTouchStart: (e: React.TouchEvent, itemId: string) => void
  handleTouchMove: (e: React.TouchEvent, itemId: string) => void
  handleTouchEnd: (itemId: string) => void

  // 操作
  closeSwipe: () => void

  // Ref（綁到 scrollable container，用於 non-passive touchmove）
  containerRef: React.RefObject<HTMLDivElement>

  // 工具函數：計算 item 的 transform 和 transition
  getSwipeStyle: (itemId: string) => {
    transform: string
    transition: string
  }
}

const VELOCITY_THRESHOLD = 100  // px/ms，等同關閉快速滑動判定，只看距離
const GESTURE_THRESHOLD = 10    // 移動超過此距離決定手勢方向

export function useSwipe(options: UseSwipeOptions = {}): UseSwipeReturn {
  const {
    actionWidth = 140,
    enabled = true,
  } = options

  const swipeThreshold = actionWidth  // 拉滿才 snap open（避免誤觸破壞性操作）

  // State
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null)
  const [swipingItemId, setSwipingItemId] = useState<string | null>(null)
  const [swipeTranslateX, setSwipeTranslateX] = useState(0)
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false)

  // Refs
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchStartTime = useRef<number>(0)
  const lastTouchX = useRef<number>(0)
  const gestureDirection = useRef<'horizontal' | 'vertical' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // enabled 變更時關閉 swipe
  useEffect(() => {
    if (!enabled) {
      setSwipedItemId(null)
      setSwipeTranslateX(0)
    }
  }, [enabled])

  // swipe 打開後 3 秒無操作自動關閉
  useEffect(() => {
    if (!swipedItemId) return
    const timer = setTimeout(() => {
      setSwipedItemId(null)
      setSwipeTranslateX(0)
    }, 1500)
    return () => clearTimeout(timer)
  }, [swipedItemId])

  // 任何點擊都關閉 swipe（capture phase 確保在 stopPropagation 前執行）
  useEffect(() => {
    const handleClick = () => {
      if (swipedItemId) {
        setSwipedItemId(null)
        setSwipeTranslateX(0)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [swipedItemId])

  // 原生 event listener 阻止橫向 swipe 時的縱向滾動
  // React 的 touch event 是 passive 的，無法 preventDefault
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (gestureDirection.current === 'horizontal') {
        e.preventDefault()
      }
    }

    element.addEventListener('touchmove', handleTouchMoveNative, { passive: false })

    return () => {
      element.removeEventListener('touchmove', handleTouchMoveNative)
    }
  }, [])

  const closeSwipe = useCallback(() => {
    setSwipedItemId(null)
    setSwipeTranslateX(0)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent, itemId: string) => {
    if (!enabled) return

    // 如果其他 item 已經 swipe 開，先關閉
    if (swipedItemId && swipedItemId !== itemId) {
      setSwipedItemId(null)
      setSwipeTranslateX(0)
    }

    const startX = e.touches[0].clientX
    const startY = e.touches[0].clientY
    touchStartX.current = startX
    touchStartY.current = startY
    touchStartTime.current = Date.now()
    lastTouchX.current = startX
    gestureDirection.current = null
    setSwipingItemId(itemId)
    setIsSwipeAnimating(false)

    // 如果這個 item 已經 swipe 開，從 -actionWidth 開始
    if (swipedItemId === itemId) {
      setSwipeTranslateX(-actionWidth)
    }
  }, [enabled, swipedItemId, actionWidth])

  const handleTouchMove = useCallback((e: React.TouchEvent, itemId: string) => {
    if (touchStartX.current === null || touchStartY.current === null || swipingItemId !== itemId) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    lastTouchX.current = currentX

    const deltaX = currentX - touchStartX.current
    const deltaY = currentY - touchStartY.current

    // 如果尚未決定手勢方向，根據先達到閾值的軸向判定
    if (gestureDirection.current === null) {
      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      if (absDeltaY >= GESTURE_THRESHOLD) {
        gestureDirection.current = 'vertical'
      } else if (absDeltaX >= GESTURE_THRESHOLD) {
        gestureDirection.current = 'horizontal'
      }
    }

    // 垂直滾動，忽略 swipe
    if (gestureDirection.current === 'vertical') return

    // 水平 swipe
    if (gestureDirection.current === 'horizontal') {
      const baseX = swipedItemId === itemId ? -actionWidth : 0
      let newTranslateX = baseX + deltaX * 0.6  // 阻尼 0.6，拉動更費力

      // rubber band 效果（超出邊界再加額外阻尼）
      if (newTranslateX > 0) {
        newTranslateX = newTranslateX * 0.3
      } else if (newTranslateX < -actionWidth) {
        const overScroll = newTranslateX + actionWidth
        newTranslateX = -actionWidth + overScroll * 0.3
      }

      setSwipeTranslateX(newTranslateX)
    }
  }, [swipingItemId, swipedItemId, actionWidth])

  const handleTouchEnd = useCallback((itemId: string) => {
    if (touchStartX.current === null || swipingItemId !== itemId) return

    // 垂直滾動，只清理狀態
    if (gestureDirection.current === 'vertical') {
      touchStartX.current = null
      touchStartY.current = null
      gestureDirection.current = null
      setSwipingItemId(null)
      return
    }

    const endTime = Date.now()
    const duration = endTime - touchStartTime.current
    const distance = lastTouchX.current - touchStartX.current
    const velocity = Math.abs(distance) / duration

    setIsSwipeAnimating(true)

    // 決定 snap 到哪個位置
    const shouldOpen =
      (velocity > VELOCITY_THRESHOLD && distance < 0) ||
      (swipeTranslateX < -swipeThreshold)

    if (shouldOpen) {
      setSwipedItemId(itemId)
      setSwipeTranslateX(-actionWidth)
    } else {
      setSwipedItemId(null)
      setSwipeTranslateX(0)
    }

    touchStartX.current = null
    touchStartY.current = null
    gestureDirection.current = null
    setSwipingItemId(null)
  }, [swipingItemId, swipeTranslateX, swipeThreshold, actionWidth])

  // 工具函數：計算 item 的 transform 和 transition
  const getSwipeStyle = useCallback((itemId: string) => {
    const isSwiping = swipingItemId === itemId
    const isSwiped = swipedItemId === itemId

    const transform = isSwiping
      ? `translateX(${swipeTranslateX}px)`
      : isSwiped
        ? `translateX(${-actionWidth}px)`
        : 'translateX(0)'

    const transition = isSwiping && !isSwipeAnimating
      ? 'none'
      : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

    return { transform, transition }
  }, [swipingItemId, swipedItemId, swipeTranslateX, isSwipeAnimating, actionWidth])

  return {
    swipedItemId,
    swipingItemId,
    swipeTranslateX,
    isSwipeAnimating,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    closeSwipe,
    containerRef,
    getSwipeStyle,
  }
}
