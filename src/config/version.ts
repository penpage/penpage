/**
 * 版本資訊配置
 * 用於追蹤應用版本、Service Worker 版本等
 */

export const VERSION_INFO = {
  // 應用版本（從 git commit 自動產生：2.0.{commit數} (hash)）
  app: `2.0.${__GIT_COMMIT_COUNT__} (${__GIT_COMMIT_HASH__})`,

  // Service Worker 版本（與 public/sw.js 同步）
  serviceWorker: '1.2.0',

  // 最後更新日期（由 Vite build 時從 git commit 自動產生）
  lastUpdated: __GIT_COMMIT_DATE__,

  // 構建資訊
  build: {
    // 構建時間（部署時自動更新）
    timestamp: new Date().toISOString(),
    // 環境
    env: import.meta.env.MODE,
  },

  // 更新日誌（最近 3 次更新）
  changelog: [
    {
      version: '1.0.0',
      date: '2025-01-24',
      changes: [
        'Fixed iOS image display issue (added blob: to CSP)',
        'Updated Service Worker to v1.2.0',
        'Added cache clearing functionality',
        'Added iOS compatibility detection and debug logs',
      ],
    },
    {
      version: '0.9.0',
      date: '2025-01-23',
      changes: [
        'Implemented image sync with hash checking',
        'Added Force Upload/Download functionality',
        'Fixed settings sync',
        'Improved sync progress indicators',
      ],
    },
    {
      version: '0.8.0',
      date: '2025-01-22',
      changes: [
        'Implemented Sync V2 with incremental sync',
        'Added folder ID preservation during sync',
        'Improved sync reliability',
      ],
    },
  ],
}

/**
 * 獲取完整版本字符串
 */
export function getVersionString(): string {
  return `v${VERSION_INFO.app} (SW: v${VERSION_INFO.serviceWorker})`
}

/**
 * 獲取環境資訊
 */
export function getEnvironmentInfo() {
  // 偵測 PWA 運行模式
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  const isPWA = isStandalone || isIOSStandalone;

  // 偵測 PWA 偵測 API 支援
  const hasPWADetectionAPI = 'getInstalledRelatedApps' in navigator;

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isPWA,
    isIOSStandalone,
    hasPWADetectionAPI,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
  }
}
