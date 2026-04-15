/**
 * 並發控制工具
 * 用於限制同時執行的 Promise 數量，避免超過 API rate limit
 */

/**
 * 並發執行 Promise，限制同時執行的數量
 *
 * @param items - 要處理的項目陣列
 * @param fn - 處理每個項目的 async 函數
 * @param concurrency - 最大同時執行數量（預設 5）
 * @returns 處理結果陣列（順序與輸入相同）
 *
 * @example
 * const results = await runConcurrent(
 *   [page1, page2, page3, ...],
 *   async (page) => {
 *     await uploadPage(page)
 *     return { success: true, id: page.id }
 *   },
 *   5  // 同時最多 5 個
 * )
 */
export async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  // 結果陣列（按原始順序）
  const results: (R | undefined)[] = new Array(items.length)

  // 目前正在執行的 Promise 集合
  const executing = new Set<Promise<void>>()

  for (let i = 0; i < items.length; i++) {
    const index = i
    const item = items[i]

    // 建立執行 Promise
    const promise = fn(item, index)
      .then(result => {
        results[index] = result
      })
      .then(() => {
        // 執行完成後從集合中移除
        executing.delete(wrappedPromise)
      })

    const wrappedPromise = promise
    executing.add(wrappedPromise)

    // 如果達到並發上限，等待其中一個完成
    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  // 等待所有剩餘的 Promise 完成
  await Promise.all(executing)

  return results as R[]
}

/**
 * 收集並發執行的錯誤
 *
 * @param items - 要處理的項目陣列
 * @param fn - 處理每個項目的 async 函數
 * @param concurrency - 最大同時執行數量
 * @returns { results, errors } - 成功結果和錯誤列表
 */
export async function runConcurrentWithErrors<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<{
  results: (R | undefined)[]
  errors: { index: number; item: T; error: Error }[]
}> {
  const results: (R | undefined)[] = new Array(items.length)
  const errors: { index: number; item: T; error: Error }[] = []
  const executing = new Set<Promise<void>>()

  for (let i = 0; i < items.length; i++) {
    const index = i
    const item = items[i]

    const promise = fn(item, index)
      .then(result => {
        results[index] = result
      })
      .catch(error => {
        errors.push({
          index,
          item,
          error: error instanceof Error ? error : new Error(String(error))
        })
      })
      .then(() => {
        executing.delete(wrappedPromise)
      })

    const wrappedPromise = promise
    executing.add(wrappedPromise)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)

  return { results, errors }
}
