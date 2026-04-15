/**
 * Cross Context Sync Service
 * 使用 BroadcastChannel 實現網頁版與 PWA 之間的即時同步
 */

import { createLogger } from '../../utils/logger'

const log = createLogger('PWA')

// ===================== 常數 =====================

const CHANNEL_NAME = 'penpage-sync';

// ===================== 類型定義 =====================

export type SyncMessageType =
  | 'PAGE_UPDATED'
  | 'PAGE_DELETED'
  | 'FOLDER_UPDATED'
  | 'FOLDER_DELETED'
  | 'EDITING_START'
  | 'EDITING_END'
  | 'SYNC_REQUEST'
  | 'PING'
  | 'PONG';

export interface SyncMessage {
  type: SyncMessageType;
  payload: {
    pageId?: string;
    folderId?: string;
    timestamp: number;
    sourceId: string;
  };
}

export type SyncCallback = (message: SyncMessage) => void;

// ===================== Cross Context Sync Service =====================

class CrossContextSyncService {
  private channel: BroadcastChannel | null = null;
  private sourceId: string;
  private callbacks: Map<SyncMessageType, Set<SyncCallback>> = new Map();
  private editingPages: Map<string, { sourceId: string; timestamp: number }> = new Map();

  constructor() {
    // 產生唯一的 source ID（用於識別訊息來源）
    this.sourceId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 初始化 BroadcastChannel
   * 應在 App 初始化時呼叫
   */
  init(): void {
    if (this.channel) return;

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage.bind(this);
      // BroadcastChannel 初始化完成
    } catch (error) {
      log.warn('BroadcastChannel not supported: ' + error);
    }
  }

  /**
   * 銷毀 BroadcastChannel
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.callbacks.clear();
    this.editingPages.clear();
  }

  /**
   * 處理接收到的訊息
   */
  private handleMessage(event: MessageEvent<SyncMessage>): void {
    const message = event.data;

    // 忽略自己發送的訊息
    if (message.payload.sourceId === this.sourceId) return;

    // 處理特殊訊息類型
    if (message.type === 'PING') {
      this.broadcast({ type: 'PONG', payload: { timestamp: Date.now(), sourceId: this.sourceId } });
      return;
    }

    // 更新編輯狀態追蹤
    if (message.type === 'EDITING_START' && message.payload.pageId) {
      this.editingPages.set(message.payload.pageId, {
        sourceId: message.payload.sourceId,
        timestamp: message.payload.timestamp
      });
    } else if (message.type === 'EDITING_END' && message.payload.pageId) {
      this.editingPages.delete(message.payload.pageId);
    }

    // 觸發對應的 callbacks
    const callbacks = this.callbacks.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => callback(message));
    }

    // 觸發通用的 '*' callbacks
    const allCallbacks = this.callbacks.get('PAGE_UPDATED'); // 暫時用 PAGE_UPDATED 作為通用
    if (allCallbacks && message.type !== 'PAGE_UPDATED') {
      // 這裡不重複觸發，避免混淆
    }
  }

  /**
   * 廣播訊息到其他 context
   */
  private broadcast(message: Omit<SyncMessage, 'payload'> & { payload: Partial<SyncMessage['payload']> }): void {
    if (!this.channel) return;

    const fullMessage: SyncMessage = {
      type: message.type,
      payload: {
        ...message.payload,
        timestamp: message.payload.timestamp || Date.now(),
        sourceId: this.sourceId
      }
    };

    try {
      this.channel.postMessage(fullMessage);
    } catch (error) {
      log.error('Failed to broadcast:', error);
    }
  }

  // ==================== 公開 API ====================

  /**
   * 廣播頁面更新
   */
  broadcastPageUpdate(pageId: string): void {
    this.broadcast({
      type: 'PAGE_UPDATED',
      payload: { pageId }
    });
  }

  /**
   * 廣播頁面刪除
   */
  broadcastPageDelete(pageId: string): void {
    this.broadcast({
      type: 'PAGE_DELETED',
      payload: { pageId }
    });
  }

  /**
   * 廣播資料夾更新
   */
  broadcastFolderUpdate(folderId: string): void {
    this.broadcast({
      type: 'FOLDER_UPDATED',
      payload: { folderId }
    });
  }

  /**
   * 廣播資料夾刪除
   */
  broadcastFolderDelete(folderId: string): void {
    this.broadcast({
      type: 'FOLDER_DELETED',
      payload: { folderId }
    });
  }

  /**
   * 廣播編輯狀態開始
   */
  broadcastEditingStart(pageId: string): void {
    this.broadcast({
      type: 'EDITING_START',
      payload: { pageId }
    });
  }

  /**
   * 廣播編輯狀態結束
   */
  broadcastEditingEnd(pageId: string): void {
    this.broadcast({
      type: 'EDITING_END',
      payload: { pageId }
    });
  }

  /**
   * 監聽特定類型的訊息
   */
  on(type: SyncMessageType, callback: SyncCallback): () => void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);

    // 返回取消監聽的函數
    return () => {
      this.callbacks.get(type)?.delete(callback);
    };
  }

  /**
   * 監聯頁面更新
   */
  onPageUpdate(callback: (pageId: string) => void): () => void {
    return this.on('PAGE_UPDATED', (message) => {
      if (message.payload.pageId) {
        callback(message.payload.pageId);
      }
    });
  }

  /**
   * 監聯頁面刪除
   */
  onPageDelete(callback: (pageId: string) => void): () => void {
    return this.on('PAGE_DELETED', (message) => {
      if (message.payload.pageId) {
        callback(message.payload.pageId);
      }
    });
  }

  /**
   * 監聯資料夾更新
   */
  onFolderUpdate(callback: (folderId: string) => void): () => void {
    return this.on('FOLDER_UPDATED', (message) => {
      if (message.payload.folderId) {
        callback(message.payload.folderId);
      }
    });
  }

  /**
   * 監聯資料夾刪除
   */
  onFolderDelete(callback: (folderId: string) => void): () => void {
    return this.on('FOLDER_DELETED', (message) => {
      if (message.payload.folderId) {
        callback(message.payload.folderId);
      }
    });
  }

  /**
   * 監聯編輯狀態變化
   */
  onEditingStateChange(callback: (pageId: string, isEditing: boolean, sourceId: string) => void): () => void {
    const unsubStart = this.on('EDITING_START', (message) => {
      if (message.payload.pageId) {
        callback(message.payload.pageId, true, message.payload.sourceId);
      }
    });

    const unsubEnd = this.on('EDITING_END', (message) => {
      if (message.payload.pageId) {
        callback(message.payload.pageId, false, message.payload.sourceId);
      }
    });

    return () => {
      unsubStart();
      unsubEnd();
    };
  }

  /**
   * 檢查頁面是否正在其他視窗編輯中
   */
  isPageBeingEditedElsewhere(pageId: string): boolean {
    const editInfo = this.editingPages.get(pageId);
    if (!editInfo) return false;

    // 檢查編輯狀態是否過期（超過 30 秒視為失效）
    const STALE_THRESHOLD = 30 * 1000;
    if (Date.now() - editInfo.timestamp > STALE_THRESHOLD) {
      this.editingPages.delete(pageId);
      return false;
    }

    return editInfo.sourceId !== this.sourceId;
  }

  /**
   * 取得正在其他視窗編輯中的頁面 ID 列表
   */
  getEditingPagesElsewhere(): string[] {
    const result: string[] = [];
    const STALE_THRESHOLD = 30 * 1000;
    const now = Date.now();

    this.editingPages.forEach((info, pageId) => {
      if (info.sourceId !== this.sourceId && now - info.timestamp <= STALE_THRESHOLD) {
        result.push(pageId);
      }
    });

    return result;
  }

  /**
   * 發送 ping 並等待 pong（檢查其他 context 是否存在）
   */
  async ping(timeout = 1000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.channel) {
        resolve(false);
        return;
      }

      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsub();
          resolve(false);
        }
      }, timeout);

      const unsub = this.on('PONG', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          unsub();
          resolve(true);
        }
      });

      this.broadcast({ type: 'PING', payload: {} });
    });
  }

  /**
   * 取得 source ID（用於識別）
   */
  getSourceId(): string {
    return this.sourceId;
  }
}

// ===================== 匯出單例 =====================

export const crossContextSync = new CrossContextSyncService();
