/**
 * Install Guide 頁面
 * PWA 安裝指南，根據設備和瀏覽器顯示對應的安裝步驟
 */

import { useMemo } from 'react'
import { detectEnvironment } from '../services/pwa/pwaDetection'

// 安裝步驟類型
interface InstallStep {
  icon: string | 'share-icon'  // 'share-icon' 為特殊圖示
  title: string
  description: string
}

// 多語言文字
const i18n = {
  en: {
    back: '⬅ ❮❮❮❮ Back',
    title: 'Install PenPage APP',
    envTitle: 'Your Environment',
    installGuideTitle: 'Installation Steps',
    device: 'Device',
    os: 'OS',
    browser: 'Browser',
    pwaStatus: 'PWA Status',
    desktop: 'Desktop',
    mobileIOS: 'iPhone / iPad',
    mobileAndroid: 'Android',
    mobileOther: 'Mobile',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    ios: 'iOS',
    android: 'Android',
    otherOS: 'Other',
    chrome: 'Chrome',
    safari: 'Safari',
    firefox: 'Firefox',
    edge: 'Edge',
    otherBrowser: 'Other',
    installed: 'Installed ✓',
    notInstalled: 'Not Installed',
    alreadyInstalled: 'PenPage is already installed! You can open it from your Dock or Taskbar.',
    notSupported: 'Your browser does not support PWA installation. Please try Chrome, Safari, or Edge.',
    // macOS Chrome
    macChromeStep1Title: 'Open Chrome Menu',
    macChromeStep1Desc: 'Click the {three-dots-icon} button in the top right corner of Chrome',
    macChromeStep2Title: 'Find Install Option',
    macChromeStep2Desc: 'Click {cast-save-share-icon} "Cast, save, and share" → "Install PenPage"',
    macChromeStep3Title: 'Confirm Installation',
    macChromeStep3Desc: 'Click "Install" in the popup dialog',
    macChromeStep4Title: 'Keep in Dock',
    macChromeStep4Desc: 'Right-click the PenPage icon {penpage-icon} in Dock → Options → Keep in Dock',
    // macOS Safari
    macSafariStep1Title: 'Click Share Button',
    macSafariStep1Desc: 'Click the Share button {share-icon} in Safari toolbar',
    macSafariStep2Title: 'Add to Dock',
    macSafariStep2Desc: 'Select "Add to Dock" {add-to-home-icon} from the menu',
    macSafariStep3Title: 'Done!',
    macSafariStep3Desc: 'PenPage icon {penpage-icon} will appear in your Dock. Click to open.',
    // Windows Chrome
    winChromeStep1Title: 'Open Chrome Menu',
    winChromeStep1Desc: 'Click the {three-dots-icon} button in the top right corner',
    winChromeStep2Title: 'Find Install Option',
    winChromeStep2Desc: 'Click {cast-save-share-icon} "Cast, save, and share" → "Install page as app"',
    winChromeStep3Title: 'Confirm Installation',
    winChromeStep3Desc: 'Click "Install" and check "Pin to taskbar"',
    winChromeStep4Title: 'Done!',
    winChromeStep4Desc: 'PenPage icon {penpage-icon} will appear in your taskbar',
    // Windows Edge
    winEdgeStep1Title: 'Open Edge Menu',
    winEdgeStep1Desc: 'Click the {three-dots-icon} button in the top right corner',
    winEdgeStep2Title: 'Find Apps Menu',
    winEdgeStep2Desc: 'Click "More tools" → "Apps" → "Install PenPage"',
    winEdgeStep3Title: 'Confirm Installation',
    winEdgeStep3Desc: 'Click "Install" in the popup dialog',
    winEdgeStep4Title: 'Pin to Taskbar',
    winEdgeStep4Desc: 'Check "Pin to taskbar" option. Done!',
    // iOS (Chrome & Safari 共用，僅分享按鈕位置不同)
    iosShareStepTitle: 'Tap Share Button',
    iosShareStepDescChrome: 'Tap the share button {share-icon} in the top right corner',
    iosShareStepDescSafari: 'Tap the share button {share-icon} at the bottom center',
    iosAddToHomeTitle: 'Add to Home Screen',
    iosAddToHomeDesc: 'Scroll up and tap "Add to Home Screen" {add-to-home-icon}',
    iosConfirmTitle: 'Confirm',
    iosConfirmDesc: 'Tap "Add" in the top right corner',
    iosDoneTitle: 'Done!',
    iosDoneDesc: 'PenPage icon {penpage-icon} will appear on your home screen. Tap to open.',
    // Android Chrome
    androidStep1Title: 'Tap Menu Button',
    androidStep1Desc: 'Tap the {three-dots-icon} button in the top right corner',
    androidStep2Title: 'Add to Home Screen',
    androidStep2Desc: 'Tap "Add to Home screen" {add-to-home-icon} or "Install app"',
    androidStep3Title: 'Confirm',
    androidStep3Desc: 'Tap "Add" or "Install" to confirm',
    androidDoneTitle: 'Done!',
    androidDoneDesc: 'PenPage icon {penpage-icon} will appear on your home screen. Tap to open.',
  },
  zh: {
    back: '⬅ ❮❮❮❮ 返回',
    title: '安裝 PenPage APP',
    envTitle: '您的環境',
    installGuideTitle: '安裝步驟',
    device: '裝置',
    os: '作業系統',
    browser: '瀏覽器',
    pwaStatus: 'PWA 狀態',
    desktop: '電腦',
    mobileIOS: 'iPhone / iPad',
    mobileAndroid: 'Android',
    mobileOther: '行動裝置',
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    ios: 'iOS',
    android: 'Android',
    otherOS: '其他',
    chrome: 'Chrome',
    safari: 'Safari',
    firefox: 'Firefox',
    edge: 'Edge',
    otherBrowser: '其他',
    installed: '已安裝 ✓',
    notInstalled: '尚未安裝',
    alreadyInstalled: 'PenPage 已經安裝完成！您可以從 Dock 或工作列開啟。',
    notSupported: '您的瀏覽器不支援 PWA 安裝。請使用 Chrome、Safari 或 Edge。',
    // macOS Chrome
    macChromeStep1Title: '開啟 Chrome 選單',
    macChromeStep1Desc: '點擊 Chrome 右上角的 {three-dots-icon} 按鈕',
    macChromeStep2Title: '找到安裝選項',
    macChromeStep2Desc: '點擊 {cast-save-share-icon}「投放、儲存及分享」→「安裝 PenPage」',
    macChromeStep3Title: '確認安裝',
    macChromeStep3Desc: '在彈出的對話框中點擊「安裝」',
    macChromeStep4Title: '保留在 Dock',
    macChromeStep4Desc: '在 Dock 上的 PenPage 圖示 {penpage-icon} 按右鍵 → 選項 → 保留在 Dock 上',
    // macOS Safari
    macSafariStep1Title: '點擊分享按鈕',
    macSafariStep1Desc: '點擊 Safari 工具列右上方的分享按鈕 {share-icon}',
    macSafariStep2Title: '加入 Dock',
    macSafariStep2Desc: '從選單中選擇「加入 Dock 中」{add-to-home-icon}',
    macSafariStep3Title: '完成！',
    macSafariStep3Desc: 'PenPage 圖示 {penpage-icon} 會出現在 Dock 中，點擊即可開啟',
    // Windows Chrome
    winChromeStep1Title: '開啟 Chrome 選單',
    winChromeStep1Desc: '點擊右上角的 {three-dots-icon} 按鈕',
    winChromeStep2Title: '找到安裝選項',
    winChromeStep2Desc: '點擊 {cast-save-share-icon}「投放、儲存及分享」→「將頁面安裝為應用程式」',
    winChromeStep3Title: '確認安裝',
    winChromeStep3Desc: '點擊「安裝」並勾選「釘選到工作列」',
    winChromeStep4Title: '完成！',
    winChromeStep4Desc: 'PenPage 圖示 {penpage-icon} 會出現在工作列上',
    // Windows Edge
    winEdgeStep1Title: '開啟 Edge 選單',
    winEdgeStep1Desc: '點擊右上角的 {three-dots-icon} 按鈕',
    winEdgeStep2Title: '找到應用程式選項',
    winEdgeStep2Desc: '點擊「更多工具」→「應用程式」→「安裝 PenPage」',
    winEdgeStep3Title: '確認安裝',
    winEdgeStep3Desc: '在彈出的對話框中點擊「安裝」',
    winEdgeStep4Title: '釘選到工作列',
    winEdgeStep4Desc: '勾選「釘選到工作列」選項，完成！',
    // iOS (Chrome & Safari 共用，僅分享按鈕位置不同)
    iosShareStepTitle: '點擊分享按鈕',
    iosShareStepDescChrome: '點擊右上角的分享按鈕 {share-icon}',
    iosShareStepDescSafari: '點擊底部中央的分享按鈕 {share-icon}',
    iosAddToHomeTitle: '加入主畫面',
    iosAddToHomeDesc: '向上捲動，找到並點擊「加入主畫面」{add-to-home-icon}',
    iosConfirmTitle: '確認加入',
    iosConfirmDesc: '點擊右上角的「加入」',
    iosDoneTitle: '完成！',
    iosDoneDesc: 'PenPage 圖示 {penpage-icon} 會出現在主畫面上，點擊即可開啟',
    // Android Chrome
    androidStep1Title: '點擊選單按鈕',
    androidStep1Desc: '點擊右上角的 {three-dots-icon} 按鈕',
    androidStep2Title: '加入主畫面',
    androidStep2Desc: '點擊「加入主畫面」{add-to-home-icon} 或「安裝應用程式」',
    androidStep3Title: '確認安裝',
    androidStep3Desc: '點擊「新增」或「安裝」確認',
    androidDoneTitle: '完成！',
    androidDoneDesc: 'PenPage 圖示 {penpage-icon} 會出現在主畫面上，點擊即可開啟',
  }
}

// 圖示大小常數
const ICON_SIZE = 24

// 步驟卡片組件
function StepCard({ step, index }: { step: InstallStep; index: number }) {
  // 渲染圖示
  const renderIcon = () => {
    if (step.icon === 'share-icon') {
      return (
        <img
          src="/share-icon.svg"
          alt="Share"
          style={{
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
          }}
        />
      )
    }
    if (step.icon === 'add-to-home-icon') {
      return (
        <img
          src="/add-to-home-icon.svg"
          alt="Add to Home Screen"
          style={{
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
          }}
        />
      )
    }
    if (step.icon === 'three-dots-icon') {
      return (
        <img
          src="/three-dots-icon.svg"
          alt="Menu"
          style={{
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
          }}
        />
      )
    }
    if (step.icon === 'cast-save-share-icon') {
      return (
        <img
          src="/cast-save-share-icon.svg"
          alt="Cast, save, and share"
          style={{
            width: `${ICON_SIZE}px`,
            height: `${ICON_SIZE}px`,
          }}
        />
      )
    }
    // 文字「+」符號使用樣式化顯示
    if (step.icon === '+') {
      return (
        <span style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}>+</span>
      )
    }
    return <span style={{ fontSize: '20px' }}>{step.icon}</span>
  }

  // 渲染描述文字（支援圖示標記）
  const renderDescription = () => {
    // 定義圖示標記和對應的圖片
    const iconMarkers = [
      { marker: '{penpage-icon}', src: '/icon-192.png', alt: 'PenPage', borderRadius: '4px' },
      { marker: '{share-icon}', src: '/share-icon.svg', alt: 'Share', borderRadius: '50%' },
      { marker: '{add-to-home-icon}', src: '/add-to-home-icon.svg', alt: 'Add to Home', borderRadius: '50%' },
      { marker: '{three-dots-icon}', src: '/three-dots-icon.svg', alt: 'Menu', borderRadius: '50%' },
      { marker: '{cast-save-share-icon}', src: '/cast-save-share-icon.svg', alt: 'Cast, save, share', borderRadius: '50%' },
    ]

    let result: (string | JSX.Element)[] = [step.description]

    // 依序處理每個標記
    iconMarkers.forEach(({ marker, src, alt, borderRadius }) => {
      const newResult: (string | JSX.Element)[] = []
      result.forEach((item, idx) => {
        if (typeof item === 'string' && item.includes(marker)) {
          const parts = item.split(marker)
          parts.forEach((part, i) => {
            if (part) newResult.push(part)
            if (i < parts.length - 1) {
              newResult.push(
                <img
                  key={`${idx}-${marker}-${i}`}
                  src={src}
                  alt={alt}
                  style={{
                    width: `${ICON_SIZE}px`,
                    height: `${ICON_SIZE}px`,
                    verticalAlign: 'middle',
                    marginLeft: '4px',
                    borderRadius,
                  }}
                />
              )
            }
          })
        } else {
          newResult.push(item)
        }
      })
      result = newResult
    })

    return result
  }

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '16px',
      backgroundColor: 'var(--bg-input)',
      borderRadius: '12px',
      marginBottom: '12px',
    }}>
      {/* 步驟編號 */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-toolbar)',
        color: 'var(--text-primary)',
        border: '2px solid var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        flexShrink: 0,
      }}>
        {index + 1}
      </div>
      {/* 內容 */}
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}>
          {renderIcon()}
          <span style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--text-primary)',
          }}>
            {step.title}
          </span>
        </div>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {renderDescription()}
        </p>
      </div>
    </div>
  )
}

export function InstallGuidePage() {
  // 自動偵測語言
  const lang = useMemo(() => {
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('zh') ? 'zh' : 'en'
  }, [])

  // 偵測環境
  const env = useMemo(() => detectEnvironment(), [])

  const t = i18n[lang]

  // 取得設備名稱
  const getDeviceName = () => {
    switch (env.device) {
      case 'desktop': return t.desktop
      case 'mobile-ios': return t.mobileIOS
      case 'mobile-android': return t.mobileAndroid
      case 'mobile-other': return t.mobileOther
    }
  }

  // 取得設備 emoji
  const getDeviceEmoji = () => {
    switch (env.device) {
      case 'desktop': return '💻'
      case 'mobile-ios': return '🍎'
      case 'mobile-android': return '🤖'
      case 'mobile-other': return '📱'
    }
  }

  // 取得作業系統名稱
  const getOSName = () => {
    switch (env.os) {
      case 'macos': return t.macos
      case 'windows': return t.windows
      case 'linux': return t.linux
      case 'ios': return t.ios
      case 'android': return t.android
      case 'other': return t.otherOS
    }
  }

  // 取得作業系統 emoji
  const getOSEmoji = () => {
    switch (env.os) {
      case 'macos': return '🍎'
      case 'windows': return '🪟'
      case 'linux': return '🐧'
      case 'ios': return '📱'
      case 'android': return '🤖'
      case 'other': return '❓'
    }
  }

  // 取得瀏覽器名稱
  const getBrowserName = () => {
    switch (env.browser) {
      case 'chrome': return t.chrome
      case 'safari': return t.safari
      case 'firefox': return t.firefox
      case 'edge': return t.edge
      case 'other': return t.otherBrowser
    }
  }

  // 取得瀏覽器 emoji
  const getBrowserEmoji = () => {
    switch (env.browser) {
      case 'chrome': return '🌐'
      case 'safari': return '🧭'
      case 'firefox': return '🦊'
      case 'edge': return '🌀'
      case 'other': return '🔍'
    }
  }

  // 取得安裝步驟
  const getInstallSteps = (): InstallStep[] => {
    // 桌面版
    if (env.device === 'desktop') {
      // macOS Chrome
      if (env.os === 'macos' && env.browser === 'chrome') {
        return [
          { icon: 'three-dots-icon', title: t.macChromeStep1Title, description: t.macChromeStep1Desc },
          { icon: 'cast-save-share-icon', title: t.macChromeStep2Title, description: t.macChromeStep2Desc },
          { icon: '✅', title: t.macChromeStep3Title, description: t.macChromeStep3Desc },
          { icon: '📌', title: t.macChromeStep4Title, description: t.macChromeStep4Desc },
        ]
      }
      // macOS Safari
      if (env.os === 'macos' && env.browser === 'safari') {
        return [
          { icon: 'share-icon', title: t.macSafariStep1Title, description: t.macSafariStep1Desc },
          { icon: 'add-to-home-icon', title: t.macSafariStep2Title, description: t.macSafariStep2Desc },
          { icon: '🎉', title: t.macSafariStep3Title, description: t.macSafariStep3Desc },
        ]
      }
      // Windows Chrome
      if (env.os === 'windows' && env.browser === 'chrome') {
        return [
          { icon: 'three-dots-icon', title: t.winChromeStep1Title, description: t.winChromeStep1Desc },
          { icon: 'cast-save-share-icon', title: t.winChromeStep2Title, description: t.winChromeStep2Desc },
          { icon: '✅', title: t.winChromeStep3Title, description: t.winChromeStep3Desc },
          { icon: '🎉', title: t.winChromeStep4Title, description: t.winChromeStep4Desc },
        ]
      }
      // Windows Edge
      if (env.os === 'windows' && env.browser === 'edge') {
        return [
          { icon: 'three-dots-icon', title: t.winEdgeStep1Title, description: t.winEdgeStep1Desc },
          { icon: '📱', title: t.winEdgeStep2Title, description: t.winEdgeStep2Desc },
          { icon: '✅', title: t.winEdgeStep3Title, description: t.winEdgeStep3Desc },
          { icon: '📌', title: t.winEdgeStep4Title, description: t.winEdgeStep4Desc },
        ]
      }
    }

    // iOS Chrome
    if (env.device === 'mobile-ios' && env.browser === 'chrome') {
      return [
        { icon: 'share-icon', title: t.iosShareStepTitle, description: t.iosShareStepDescChrome },
        { icon: 'add-to-home-icon', title: t.iosAddToHomeTitle, description: t.iosAddToHomeDesc },
        { icon: '✅', title: t.iosConfirmTitle, description: t.iosConfirmDesc },
        { icon: '🎉', title: t.iosDoneTitle, description: t.iosDoneDesc },
      ]
    }

    // iOS Safari
    if (env.device === 'mobile-ios' && env.browser === 'safari') {
      return [
        { icon: 'share-icon', title: t.iosShareStepTitle, description: t.iosShareStepDescSafari },
        { icon: 'add-to-home-icon', title: t.iosAddToHomeTitle, description: t.iosAddToHomeDesc },
        { icon: '✅', title: t.iosConfirmTitle, description: t.iosConfirmDesc },
        { icon: '🎉', title: t.iosDoneTitle, description: t.iosDoneDesc },
      ]
    }

    // Android Chrome (及其他 Android 瀏覽器)
    if (env.device === 'mobile-android') {
      return [
        { icon: 'three-dots-icon', title: t.androidStep1Title, description: t.androidStep1Desc },
        { icon: 'add-to-home-icon', title: t.androidStep2Title, description: t.androidStep2Desc },
        { icon: '✅', title: t.androidStep3Title, description: t.androidStep3Desc },
        { icon: '🎉', title: t.androidDoneTitle, description: t.androidDoneDesc },
      ]
    }

    // 其他情況返回空陣列
    return []
  }

  const installSteps = getInstallSteps()
  const isSupported = installSteps.length > 0

  return (
    <div style={{
      color: 'var(--text-primary)',
    }}>
        {/* 已安裝提示 */}
        {env.isPWAInstalled && (
          <div style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>✅</span>
            <span style={{ color: '#22c55e', fontSize: '15px' }}>{t.alreadyInstalled}</span>
          </div>
        )}

        {/* 安裝步驟 */}
        {!env.isPWAInstalled && isSupported && (
          <div style={{
            backgroundColor: 'var(--bg-toolbar)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <h2 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>📋</span>
              {t.installGuideTitle}
            </h2>

            {installSteps.map((step, index) => (
              <StepCard key={index} step={step} index={index} />
            ))}
          </div>
        )}

        {/* 不支援提示 */}
        {!env.isPWAInstalled && !isSupported && (
          <div style={{
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <span style={{ color: '#f59e0b', fontSize: '15px' }}>{t.notSupported}</span>
          </div>
        )}

        {/* 環境資訊卡片 */}
        <div style={{
          backgroundColor: 'var(--bg-toolbar)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '16px',
            color: 'var(--text-primary)',
          }}>
            {t.envTitle}
          </h2>

          {/* 設備 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.device}</span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
            }}>
              <span>{getDeviceEmoji()}</span>
              {getDeviceName()}
            </span>
          </div>

          {/* 作業系統 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.os}</span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
            }}>
              <span>{getOSEmoji()}</span>
              {getOSName()}
            </span>
          </div>

          {/* 瀏覽器 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.browser}</span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
            }}>
              <span>{getBrowserEmoji()}</span>
              {getBrowserName()}
            </span>
          </div>

          {/* PWA 狀態 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t.pwaStatus}</span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
              color: env.isPWAInstalled ? '#22c55e' : 'var(--text-primary)',
            }}>
              {env.isPWAInstalled ? '✅' : '⬜'}
              {env.isPWAInstalled ? t.installed : t.notInstalled}
            </span>
          </div>
        </div>
    </div>
  )
}

export default InstallGuidePage


