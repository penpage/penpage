/**
 * 裝置識別管理
 * 用於追蹤和識別不同的裝置/瀏覽器
 */

export interface DeviceInfo {
  deviceId: string           // UUID（唯一裝置標識）
  deviceName: string         // 裝置名稱（例如："Chrome on macOS"）
  browser: string            // 瀏覽器資訊（例如："Chrome 120.0.0.0"）
  os: string                 // 作業系統（例如："macOS 14.0"）
  ip?: string                // IP 地址（可選，需要外部 API）
  createdAt: number          // 首次創建時間
  lastSeenAt: number         // 最後使用時間
}

const STORAGE_KEY = 'ppage_device_info'
const IP_API_URL = 'https://api.ipify.org?format=json'

/**
 * 解析 User Agent 取得瀏覽器資訊
 */
function getBrowserInfo(): { browser: string; os: string; deviceName: string } {
  const ua = navigator.userAgent

  // 解析瀏覽器
  let browser = 'Unknown Browser'
  if (ua.indexOf('FxiOS') > -1) {
    // iOS Firefox（UA 用 FxiOS 而非 Firefox）
    const match = ua.match(/FxiOS\/(\d+\.\d+)/)
    browser = match ? `Firefox ${match[1]}` : 'Firefox'
  } else if (ua.indexOf('CriOS') > -1) {
    // iOS Chrome（UA 用 CriOS 而非 Chrome）
    const match = ua.match(/CriOS\/(\d+\.\d+)/)
    browser = match ? `Chrome ${match[1]}` : 'Chrome'
  } else if (ua.indexOf('EdgiOS') > -1) {
    // iOS Edge（UA 用 EdgiOS 而非 Edg）
    const match = ua.match(/EdgiOS\/(\d+\.\d+)/)
    browser = match ? `Edge ${match[1]}` : 'Edge'
  } else if (ua.indexOf('Firefox') > -1) {
    const match = ua.match(/Firefox\/(\d+\.\d+)/)
    browser = match ? `Firefox ${match[1]}` : 'Firefox'
  } else if (ua.indexOf('Edg') > -1) {
    const match = ua.match(/Edg\/(\d+\.\d+)/)
    browser = match ? `Edge ${match[1]}` : 'Edge'
  } else if (ua.indexOf('Chrome') > -1) {
    const match = ua.match(/Chrome\/(\d+\.\d+)/)
    browser = match ? `Chrome ${match[1]}` : 'Chrome'
  } else if (ua.indexOf('Safari') > -1) {
    const match = ua.match(/Version\/(\d+\.\d+)/)
    browser = match ? `Safari ${match[1]}` : 'Safari'
  }

  // 解析作業系統
  // 注意：iOS Safari 開啟「要求桌面版網站」時 UA 包含 Macintosh，
  // 需要用 maxTouchPoints 或 Mobile 關鍵字偵測真正的 iOS 裝置
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (ua.indexOf('Mac') > -1 && navigator.maxTouchPoints > 1) ||
    (/Safari/.test(ua) && /Mobile/.test(ua))

  let os = 'Unknown OS'
  if (ua.indexOf('Win') > -1) {
    os = 'Windows'
    if (ua.indexOf('Windows NT 10.0') > -1) os = 'Windows 10'
    else if (ua.indexOf('Windows NT 11.0') > -1) os = 'Windows 11'
  } else if (isIOS) {
    // iOS 偵測必須在 macOS 之前（因為 iOS 桌面模式 UA 也包含 Mac）
    os = 'iOS'
    const match = ua.match(/OS (\d+_\d+)/)
    if (match) {
      const version = match[1].replace('_', '.')
      os = `iOS ${version}`
    }
  } else if (ua.indexOf('Mac') > -1) {
    os = 'macOS'
    const match = ua.match(/Mac OS X (\d+[._]\d+)/)
    if (match) {
      const version = match[1].replace('_', '.')
      os = `macOS ${version}`
    }
  } else if (ua.indexOf('Android') > -1) {
    os = 'Android'
    const match = ua.match(/Android (\d+\.\d+)/)
    if (match) os = `Android ${match[1]}`
  } else if (ua.indexOf('Linux') > -1) {
    os = 'Linux'
  }

  // 組合裝置名稱
  const deviceName = `${browser.split(' ')[0]} on ${os.split(' ')[0]}`

  return { browser, os, deviceName }
}

/**
 * 取得 IP 地址（非同步）
 * 如果無法取得則返回 undefined
 */
async function getIpAddress(): Promise<string | undefined> {
  try {
    const response = await fetch(IP_API_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 秒超時
    })
    if (!response.ok) {
      throw new Error('Failed to fetch IP')
    }
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.warn('無法取得 IP 地址:', error)
    return undefined
  }
}

/**
 * 初始化或取得裝置資訊
 * 如果是第一次，會創建新的 deviceId
 * 如果已存在，會更新 lastSeenAt 和 IP（如果變更）
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const now = Date.now()

  // 嘗試從 localStorage 讀取現有資訊
  const stored = localStorage.getItem(STORAGE_KEY)
  let deviceInfo: DeviceInfo | null = null

  if (stored) {
    try {
      deviceInfo = JSON.parse(stored)
    } catch (error) {
      console.error('解析裝置資訊失敗:', error)
    }
  }

  // 取得瀏覽器和 OS 資訊
  const { browser, os, deviceName } = getBrowserInfo()

  if (deviceInfo) {
    // 已存在，更新資訊
    deviceInfo.lastSeenAt = now
    deviceInfo.browser = browser
    deviceInfo.os = os
    deviceInfo.deviceName = deviceName

    // 嘗試更新 IP（非阻塞）
    getIpAddress().then(ip => {
      if (ip && ip !== deviceInfo!.ip) {
        deviceInfo!.ip = ip
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceInfo))
      }
    })
  } else {
    // 第一次，創建新的裝置資訊
    deviceInfo = {
      deviceId: crypto.randomUUID(),
      deviceName,
      browser,
      os,
      createdAt: now,
      lastSeenAt: now
    }

    // 嘗試取得 IP（非阻塞）
    getIpAddress().then(ip => {
      if (ip) {
        deviceInfo!.ip = ip
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceInfo))
      }
    })
  }

  // 儲存到 localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceInfo))

  return deviceInfo
}

/**
 * 取得簡短的裝置 ID（用於顯示）
 * 例如：將 "550e8400-e29b-41d4-a716-446655440000" 簡化為 "550e8400"
 */
export function getShortDeviceId(deviceId: string): string {
  return deviceId.split('-')[0]
}

/**
 * 取得裝置的可讀描述
 * 例如："Chrome on macOS (550e8400)"
 */
export async function getDeviceDescription(): Promise<string> {
  const info = await getDeviceInfo()
  const shortId = getShortDeviceId(info.deviceId)
  return `${info.deviceName} (${shortId})`
}

/**
 * 僅取得 deviceId（向後兼容）
 */
export async function getDeviceId(): Promise<string> {
  const info = await getDeviceInfo()
  return info.deviceId
}

/**
 * 清除裝置資訊（用於測試或重置）
 */
export function clearDeviceInfo(): void {
  localStorage.removeItem(STORAGE_KEY)
}
