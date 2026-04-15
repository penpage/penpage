/**
 * Console Log Debug Panel
 * 用 checkbox 選擇要啟用的 console log 分類
 * 取代手動輸入 localStorage.setItem('debug', '...')
 */

import { useState, useCallback } from 'react';

const ALL_CATEGORIES = [
  'SYNC', 'AUTH', 'CRYPTO', 'DB', 'TRASH', 'PWA',
  'FOLDER', 'DRIVE', 'FILE-LINK', 'IMAGE', 'PAGE', 'BACKUP',
  'CLEANUP', 'TOKEN', 'EDITOR', 'VIEW', 'BLACKBOARD', 'FSYNC', 'V3',
] as const;

type Category = typeof ALL_CATEGORIES[number];

/** 從 localStorage 讀取已啟用的分類 */
const getEnabledCategories = (): Set<Category> => {
  const raw = localStorage.getItem('debug') || '';
  return new Set(
    raw.split(',').map(s => s.trim()).filter(Boolean) as Category[]
  );
};

/** 寫入 localStorage */
const persistCategories = (cats: Set<Category>) => {
  const value = Array.from(cats).join(',');
  if (value) {
    localStorage.setItem('debug', value);
  } else {
    localStorage.removeItem('debug');
  }
};

export const ConsoleLogDebugContent = () => {
  const [enabled, setEnabled] = useState<Set<Category>>(getEnabledCategories);

  const toggle = useCallback((cat: Category) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      persistCategories(next);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const next = new Set<Category>(ALL_CATEGORIES);
    persistCategories(next);
    setEnabled(next);
  }, []);

  const clearAll = useCallback(() => {
    const next = new Set<Category>();
    persistCategories(next);
    setEnabled(next);
  }, []);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      {/* 標題與按鈕 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div>
          <span style={{ color: '#888' }}>
            已啟用 {enabled.size} / {ALL_CATEGORIES.length} 個分類
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={selectAll}
            style={{
              background: '#333',
              color: '#4ade80',
              border: '1px solid #555',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            全選
          </button>
          <button
            onClick={clearAll}
            style={{
              background: '#333',
              color: '#f87171',
              border: '1px solid #555',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            全部清除
          </button>
        </div>
      </div>

      {/* Checkbox 列表 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '4px',
      }}>
        {ALL_CATEGORIES.map(cat => (
          <label
            key={cat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              background: enabled.has(cat) ? '#1a2e1a' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={enabled.has(cat)}
              onChange={() => toggle(cat)}
              style={{ accentColor: '#4ade80' }}
            />
            <span style={{
              color: enabled.has(cat) ? '#4ade80' : '#888',
              fontSize: '13px',
            }}>
              {cat}
            </span>
          </label>
        ))}
      </div>

      {/* 目前值預覽 */}
      <div style={{
        marginTop: '20px',
        padding: '10px 12px',
        background: '#111',
        borderRadius: '4px',
        border: '1px solid #333',
      }}>
        <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>
          localStorage.debug
        </div>
        <code style={{ color: '#4ade80', fontSize: '12px', wordBreak: 'break-all' }}>
          {enabled.size > 0 ? Array.from(enabled).join(',') : '(empty)'}
        </code>
      </div>
    </div>
  );
};
