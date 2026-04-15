import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 讀取 version.json 檔案（由 pre-commit hook 自動更新）
interface VersionInfo {
  commitCount: number
  commitHash: string
  commitDate: string
}

function readVersionFile(): VersionInfo | null {
  try {
    const versionPath = resolve(__dirname, 'src/version.json')
    const content = readFileSync(versionPath, 'utf-8')
    return JSON.parse(content) as VersionInfo
  } catch {
    return null
  }
}

// 取得版本資訊
// 優先順序：1. version.json 2. 環境變數 3. git 命令
const versionInfo = readVersionFile()

function getGitCommitDate(): string {
  // 1. 從 version.json 讀取
  if (versionInfo && versionInfo.commitDate && versionInfo.commitDate !== 'unknown') {
    return versionInfo.commitDate
  }
  // 2. 從環境變數讀取（Docker 構建）
  if (process.env.VITE_GIT_COMMIT_DATE && process.env.VITE_GIT_COMMIT_DATE !== 'unknown') {
    return process.env.VITE_GIT_COMMIT_DATE
  }
  // 3. 從 git 命令讀取（本地開發）
  try {
    const date = execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim()
    return date.split(' ')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function getGitCommitCount(): number {
  // 1. 從 version.json 讀取
  if (versionInfo && versionInfo.commitCount > 0) {
    return versionInfo.commitCount
  }
  // 2. 從環境變數讀取（Docker 構建）
  if (process.env.VITE_GIT_COMMIT_COUNT) {
    const count = parseInt(process.env.VITE_GIT_COMMIT_COUNT, 10)
    if (!isNaN(count) && count > 0) return count
  }
  // 3. 從 git 命令讀取（本地開發）
  try {
    const count = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim()
    return parseInt(count, 10)
  } catch {
    return 0
  }
}

function getGitCommitHash(): string {
  // 1. 從 version.json 讀取
  if (versionInfo && versionInfo.commitHash && versionInfo.commitHash !== 'unknown') {
    return versionInfo.commitHash
  }
  // 2. 從環境變數讀取（Docker 構建）
  if (process.env.VITE_GIT_COMMIT_HASH && process.env.VITE_GIT_COMMIT_HASH !== 'unknown') {
    return process.env.VITE_GIT_COMMIT_HASH
  }
  // 3. 從 git 命令讀取（本地開發）
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 使用 'autoUpdate' 自動更新，無需用戶確認
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png'],
      manifest: {
        id: 'com.penpage.app',
        name: 'PenPage',
        short_name: 'PenPage',
        description: 'Real WYSIWYG Markdown editor. Private note-taking with local-first storage.',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'New Note',
            short_name: 'New',
            description: 'Create a new note',
            url: '/',
            icons: [
              {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ],
        // 檔案關聯：讓使用者可以雙擊 .md 檔案用 PenPage 開啟
        // 需要：1. 安裝為 PWA 2. Chrome/Edge 102+ 3. 使用者授權
        file_handlers: [
          {
            action: '/',
            accept: {
              'text/markdown': ['.md', '.markdown']
            },
            launch_type: 'single-client'
          }
        ],
        // 控制 PWA 啟動行為：在現有視窗中開啟，避免開多個視窗
        launch_handler: {
          client_mode: 'navigate-existing'
        },
        // 關聯應用：用於 getInstalledRelatedApps API 偵測 PWA 安裝狀態
        related_applications: [
          {
            platform: 'webapp',
            url: 'https://penpage.com/manifest.webmanifest',
            id: 'com.penpage.app'
          }
        ],
        prefer_related_applications: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: true // 在開發模式下也啟用 PWA
      }
    })
  ],
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    watch: {
      usePolling: true,  // Enable polling for Docker environments
    },
    hmr: {
      // 🔧 修復 CSP 錯誤: 移除 clientPort，讓 Vite 自動檢測
      // 現在通過 nginx (80/443) 訪問，不再直連 8080
      // Vite 會自動使用當前訪問的端口建立 WebSocket 連接
    }
  },
  preview: {
    host: true,
    port: 8080,
    strictPort: true
  },
  // 在 build 時注入 git commit 資訊
  define: {
    __GIT_COMMIT_DATE__: JSON.stringify(getGitCommitDate()),
    __GIT_COMMIT_COUNT__: getGitCommitCount(),
    __GIT_COMMIT_HASH__: JSON.stringify(getGitCommitHash()),
  }
})
