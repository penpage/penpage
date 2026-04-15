/**
 * PWA Services
 * 統一匯出 PWA 相關服務
 */

export {
  pwaDetection,
  isInstalled,
  isRunningAsPWA,
  detectEnvironment,
  markAsInstalled,
  clearInstallMark,
  getDetectionMethod,
  getInstallTimestamp,
  type PWADetectionMethod,
  type PWADetectionResult,
  type EnvironmentInfo
} from './pwaDetection';

export {
  crossContextSync,
  type SyncMessageType,
  type SyncMessage,
  type SyncCallback
} from './crossContextSync';
