/**
 * PWA Detection Service
 * 偵測 PWA 安裝狀態並提供相關功能
 */

import { createLogger } from '../../utils/logger'

const log = createLogger('PWA')

// ===================== 常數 =====================

const PWA_INSTALLED_KEY = 'pwa_installed_at';

// ===================== 類型定義 =====================

interface RelatedApplication {
  platform: string;
  url?: string;
  id?: string;
}

// 擴展 Navigator 類型以包含 getInstalledRelatedApps
declare global {
  interface Navigator {
    getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
  }
}

export type PWADetectionMethod = 'api' | 'fallback' | 'display-mode' | 'none';

export interface PWADetectionResult {
  isInstalled: boolean;
  method: PWADetectionMethod;
}

// 環境偵測結果
export interface EnvironmentInfo {
  device: 'desktop' | 'mobile-ios' | 'mobile-android' | 'mobile-other';
  os: 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'other';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';
  isPWAInstalled: boolean;
}

// ===================== 環境偵測 =====================

/**
 * 偵測目前的裝置、作業系統、瀏覽器及 PWA 安裝狀態
 */
export function detectEnvironment(): EnvironmentInfo {
  const ua = navigator.userAgent.toLowerCase();

  // 偵測設備
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMobile = isIOS || isAndroid || /mobile/.test(ua);

  let device: EnvironmentInfo['device'] = 'desktop';
  if (isIOS) {
    device = 'mobile-ios';
  } else if (isAndroid) {
    device = 'mobile-android';
  } else if (isMobile) {
    device = 'mobile-other';
  }

  // 偵測作業系統
  let os: EnvironmentInfo['os'] = 'other';
  if (isIOS) {
    os = 'ios';
  } else if (isAndroid) {
    os = 'android';
  } else if (/macintosh|mac os x/.test(ua)) {
    os = 'macos';
  } else if (/windows/.test(ua)) {
    os = 'windows';
  } else if (/linux/.test(ua)) {
    os = 'linux';
  }

  // 偵測瀏覽器
  let browser: EnvironmentInfo['browser'] = 'other';
  if (/edg/.test(ua)) {
    browser = 'edge';
  } else if (/chrome/.test(ua) || /chromium/.test(ua) || /crios/.test(ua)) {
    browser = 'chrome';
  } else if (/safari/.test(ua) && !/chrome/.test(ua)) {
    browser = 'safari';
  } else if (/firefox/.test(ua) || /fxios/.test(ua)) {
    browser = 'firefox';
  }

  // 偵測 PWA 安裝狀態
  const isPWAInstalled = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true;

  return { device, os, browser, isPWAInstalled };
}

// ===================== PWA Detection Service =====================

/**
 * 偵測 PWA 是否已安裝
 * 1. 優先使用 getInstalledRelatedApps API (Chrome/Edge 92+)
 * 2. Fallback: 檢查 localStorage 標記 (Safari/Firefox)
 */
export async function isInstalled(): Promise<PWADetectionResult> {
  log('Checking installation status...');

  // 方法 1: getInstalledRelatedApps API (Chrome/Edge)
  if ('getInstalledRelatedApps' in navigator && navigator.getInstalledRelatedApps) {
    log('API available, calling getInstalledRelatedApps...');
    try {
      const relatedApps = await navigator.getInstalledRelatedApps();
      log('Related apps: ' + JSON.stringify(relatedApps));
      if (relatedApps && relatedApps.length > 0) {
        log('PWA is installed (detected via API)');
        return { isInstalled: true, method: 'api' };
      }
      // API 可用但沒有找到已安裝的 app，繼續檢查 localStorage fallback
      log('API returned empty, checking localStorage fallback...');
    } catch (error) {
      log.warn('getInstalledRelatedApps failed: ' + error);
      // 降級到 fallback
    }
  } else {
    log('API not available, using fallback');
  }

  // 方法 2: localStorage 標記 (Safari/Firefox fallback)
  const installedAt = localStorage.getItem(PWA_INSTALLED_KEY);
  if (installedAt) {
    log('PWA is installed (detected via localStorage fallback)');
    return { isInstalled: true, method: 'fallback' };
  }

  log('PWA not detected');
  return { isInstalled: false, method: 'none' };
}

/**
 * 偵測當前是否在 PWA 模式中運行
 * 如果是，自動設置 localStorage 標記供 fallback 使用
 */
export function isRunningAsPWA(): boolean {
  // 方法 1: display-mode media query
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) {
    // 自動設置 fallback 標記（舊安裝的 PWA 沒有 appinstalled 事件記錄）
    if (!localStorage.getItem(PWA_INSTALLED_KEY)) {
      log('Running as PWA, setting fallback marker');
      localStorage.setItem(PWA_INSTALLED_KEY, Date.now().toString());
    }
    return true;
  }

  // 方法 2: iOS Safari standalone 屬性
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone;
  if (iosStandalone === true) {
    // 自動設置 fallback 標記
    if (!localStorage.getItem(PWA_INSTALLED_KEY)) {
      log('Running as iOS PWA, setting fallback marker');
      localStorage.setItem(PWA_INSTALLED_KEY, Date.now().toString());
    }
    return true;
  }

  // 方法 3: Android TWA (Trusted Web Activity)
  const isAndroidTWA = document.referrer.includes('android-app://');
  if (isAndroidTWA) {
    // 自動設置 fallback 標記
    if (!localStorage.getItem(PWA_INSTALLED_KEY)) {
      log('Running as Android TWA, setting fallback marker');
      localStorage.setItem(PWA_INSTALLED_KEY, Date.now().toString());
    }
    return true;
  }

  return false;
}

/**
 * 記錄安裝狀態到 localStorage（供 fallback 使用）
 * 應在 appinstalled 事件時呼叫
 */
export function markAsInstalled(): void {
  localStorage.setItem(PWA_INSTALLED_KEY, Date.now().toString());
}

/**
 * 清除安裝標記（用於測試或重置）
 */
export function clearInstallMark(): void {
  localStorage.removeItem(PWA_INSTALLED_KEY);
}

/**
 * 取得偵測方法（用於 analytics）
 */
export function getDetectionMethod(): PWADetectionMethod {
  if ('getInstalledRelatedApps' in navigator && navigator.getInstalledRelatedApps) {
    return 'api';
  }
  if (localStorage.getItem(PWA_INSTALLED_KEY)) {
    return 'fallback';
  }
  return 'none';
}


/**
 * 取得安裝時間戳
 */
export function getInstallTimestamp(): number | null {
  const installedAt = localStorage.getItem(PWA_INSTALLED_KEY);
  return installedAt ? parseInt(installedAt, 10) : null;
}

// ===================== 匯出便捷函數 =====================

export const pwaDetection = {
  isInstalled,
  isRunningAsPWA,
  detectEnvironment,
  markAsInstalled,
  clearInstallMark,
  getDetectionMethod,
  getInstallTimestamp,
};
