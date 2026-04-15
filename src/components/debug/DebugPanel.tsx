interface LogEntry {
  id: number
  time: string
  message: string
}

// 全域 log 收集器
const logs: LogEntry[] = []
let logId = 0
let listeners: (() => void)[] = []

export const debugLog = (message: string, data?: Record<string, unknown>) => {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  } as Intl.DateTimeFormatOptions)
  const fullMessage = data
    ? `${message} ${JSON.stringify(data)}`
    : message

  logs.unshift({ id: logId++, time, message: fullMessage })

  // 只保留最近 50 條
  if (logs.length > 50) {
    logs.pop()
  }

  // 通知所有監聽器
  listeners.forEach(fn => fn())
}
