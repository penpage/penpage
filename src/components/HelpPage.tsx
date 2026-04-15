/**
 * Help Page Component
 * 使用者說明頁面，協助使用者了解 PenPage 的功能與使用方式
 */

import { useMemo, useEffect, useCallback, useState } from 'react'
import '../styles/help.css'

// 擴展 Window 介面以支援 Google Translate
declare global {
  interface Window {
    googleTranslateElementInit: () => void
    google?: {
      translate?: {
        TranslateElement: any
      }
    }
  }
}

// 平台安裝指引類型
interface PlatformGuide {
  name: string
  icon: string
  position: string
  steps: string[]
}

// FAQ 問答類型
interface FAQQuestion {
  q: string
  a: string
}

interface FAQCategory {
  title: string
  questions: FAQQuestion[]
}

// 故障排除問題類型
interface TroubleshootingIssue {
  title: string
  steps: string[]
}

// 多語言內容
const i18n = {
  en: {
    title: 'PenPage Help',
    subtitle: 'Learn how to use PenPage effectively',
    toc: 'Quick Navigation',
    whyPenPage: {
      title: 'Why PenPage?',
      intro: 'A note-taking app designed for people who value privacy and simplicity.',
      values: [
        {
          title: 'Privacy First',
          desc: 'Your notes stay on your device. No servers, no tracking, no data mining.',
          icon: '🔒'
        },
        {
          title: 'No Account Needed',
          desc: 'Start writing immediately. No sign-up, no email verification, no passwords to remember.',
          icon: '⚡'
        },
        {
          title: 'Completely Free',
          desc: 'No ads, no subscriptions, no premium tiers. All features available to everyone.',
          icon: '💎'
        }
      ],
      comparison: {
        title: 'How we compare',
        headers: ['Feature', 'PenPage', 'Others'],
        rows: [
          ['Local Storage', '✓', 'Some'],
          ['No Account Required', '✓', 'Rare'],
          ['File Link (Local Sync)', '✓', 'Rare'],
          ['Offline Access', '✓', 'Some'],
          ['Open Source', '✓', 'Rare'],
          ['100% Free', '✓', 'Rare']
        ]
      }
    },
    faq: {
      title: 'Frequently Asked Questions',
      categories: {
        privacy: {
          title: 'Privacy & Security',
          questions: [
            {
              q: 'Does PenPage access my note content?',
              a: 'No. PenPage runs entirely in your browser. Your notes are stored in IndexedDB on your device and are never sent to our servers.'
            },
            {
              q: 'Where is my data stored?',
              a: 'All data is stored locally in your browser using IndexedDB. You can also use File Link to sync notes with local directories on your computer.'
            },
            {
              q: 'Is my data safe from being accessed by others?',
              a: 'Your notes are stored only in your browser\'s local storage. No data is ever sent to any server. For extra safety, regularly export backups.'
            }
          ]
        },
        data: {
          title: 'Data & Backup',
          questions: [
            {
              q: 'Will clearing browser data delete my notes?',
              a: 'Yes. That\'s why we strongly recommend regular backups (Settings → Save) and using File Link to keep local copies of your notes.'
            },
            {
              q: 'How do I backup my notes?',
              a: 'Go to Settings → Save to export a .ppx backup file. Store it somewhere safe like cloud storage or an external drive.'
            },
            {
              q: 'Can I restore notes from a backup?',
              a: 'Yes. Go to Settings → Restore and select your .ppx backup file. Your notes will be restored.'
            }
          ]
        },
        features: {
          title: 'Features',
          questions: [
            {
              q: 'Can I use PenPage on multiple devices?',
              a: 'You can export your notes as a .ppx backup and import them on another device. You can also use File Link to sync notes with a local directory and share it via cloud storage services.'
            },
            {
              q: 'What Markdown syntax is supported?',
              a: 'PenPage supports headings (#), bold (**), italic (*), lists, code blocks, links, images, and more.'
            },
            {
              q: 'How do I import my existing Markdown files?',
              a: 'Drag and drop .md files onto PenPage, or use the menu (⋮) → Open MD. You can also import entire folders.'
            }
          ]
        },
        pwa: {
          title: 'Mobile App (PWA)',
          questions: [
            {
              q: 'Why should I install PenPage as an app?',
              a: 'Installing as PWA gives you offline access, home screen icon, full-screen experience, and faster loading.'
            },
            {
              q: 'What\'s the difference between PWA and native apps?',
              a: 'PWA apps are installed directly from the web - no app store needed. They use less storage and update automatically.'
            },
            {
              q: 'Does the PWA work offline?',
              a: 'Yes! Once installed, PenPage works fully offline. Your notes are stored locally in your browser.'
            }
          ]
        }
      } as Record<string, FAQCategory>
    },
    troubleshooting: {
      title: 'Troubleshooting',
      intro: 'Having issues? Try these solutions.',
      issues: [
        {
          title: 'File Link Not Working',
          steps: [
            'Check if the linked directory still exists',
            'Re-authorize directory access if prompted by the browser',
            'Try unlinking and re-linking the directory',
            'Make sure you are using a supported browser (Chrome/Edge)'
          ]
        },
        {
          title: 'Notes Missing',
          steps: [
            'Check if you\'re in the correct Workspace',
            'Look in the Trash folder',
            'Restore from a backup file if available',
            'Check File Link directory for local copies'
          ]
        },
        {
          title: 'PWA Won\'t Install',
          steps: [
            'Make sure you\'re using Chrome, Edge, or Safari',
            'Clear browser cache and reload the page',
            'Check if pop-ups are blocked',
            'Try incognito/private mode'
          ]
        },
        {
          title: 'Editor Not Responding',
          steps: [
            'Refresh the page',
            'Clear browser cache',
            'Try a different browser',
            'Check if JavaScript is enabled'
          ]
        }
      ] as TroubleshootingIssue[]
    },
    sections: {
      gettingStarted: {
        title: '1. Getting Started',
        intro: 'PenPage is a privacy-first note-taking application that stores your notes locally in your browser. No account required, no data sent to servers.',
        features: [
          { title: 'Local Storage', desc: 'Notes are saved in your browser\'s IndexedDB' },
          { title: 'Offline Ready', desc: 'Works without internet connection' },
          { title: 'No Sign-up', desc: 'Start writing immediately, no account needed' },
          { title: 'File Link', desc: 'Link folders to local directories for two-way sync' },
        ],
      },
      editor: {
        title: '2. Editor Features',
        intro: 'PenPage is a real WYSIWYG editor with live Markdown rendering — type and see results instantly, no preview pane needed.',
        features: [
          { title: 'Live Markdown', desc: 'Type Markdown syntax and see results instantly — no preview pane, no mode switching needed' },
          { title: 'Real WYSIWYG', desc: 'A true what-you-see-is-what-you-get editor that renders as you type' },
          { title: 'Markdown Syntax', desc: 'Type Markdown shortcuts like # for headings, ** for bold' },
          { title: 'Rich Formatting', desc: 'Bold, italic, headings, lists, code blocks, and more' },
          { title: 'Image Support', desc: 'Paste or drag images directly into your notes' },
        ],
      },
      organization: {
        title: '3. Organization',
        intro: 'Organize your notes with Workspaces, Folders, and Pages.',
        hierarchy: [
          { name: 'Workspace', desc: 'Top-level containers for different contexts (work, personal, projects)' },
          { name: 'Folder', desc: 'Group related pages together within a workspace' },
          { name: 'Page', desc: 'Individual notes where you write your content' },
        ],
        tips: [
          'Drag and drop to reorder pages and folders (desktop)',
          'Use Edit Mode for batch operations',
          'Color-code folders for visual organization',
        ],
      },
      storage: {
        title: '4. Local Storage',
        intro: 'Your notes are stored locally using IndexedDB, a browser database.',
        points: [
          { title: 'Persistence', desc: 'Notes survive browser restarts and updates' },
          { title: 'Privacy', desc: 'Data stays on your device, not sent to servers' },
          { title: 'Offline Access', desc: 'Read and edit notes without internet' },
        ],
        warning: 'Clearing browser data will delete your notes. Always backup important content!',
      },
      security: {
        title: '5. Privacy & Security',
        intro: 'PenPage is designed with privacy as a core principle.',
        features: [
          { title: 'Local-First', desc: 'Notes stored on your device by default' },
          { title: 'No Server', desc: 'Your data never leaves your browser — no cloud, no tracking' },
          { title: 'Open Source', desc: 'Source code is publicly available for transparency' },
          { title: 'No Account', desc: 'No sign-up, no email, no personal data collected' },
        ],
        encryptionSteps: [
          'Your notes are stored only in your browser\'s IndexedDB',
          'No data is transmitted to any external server',
          'Use backups and File Link for additional data safety',
        ],
      },
      cloudSync: {
        title: '6. File Link (Local Sync)',
        intro: 'Link folders to local directories on your computer for two-way sync.',
        steps: [
          'Open a folder\'s menu and select "Link Directory"',
          'Choose a local directory on your computer',
          'PenPage will sync notes with that directory as Markdown files',
          'Changes in either direction are detected and synced automatically',
        ],
        tips: [
          'File Link uses the browser\'s File System Access API (Chrome/Edge)',
          'You can link multiple folders to different directories',
          'Use a cloud-synced directory (e.g. Dropbox, iCloud) for cross-device access',
        ],
      },
      backup: {
        title: '7. Backup & Restore',
        intro: 'Regularly backup your notes to prevent data loss.',
        export: [
          'Go to Settings > Save to export all notes',
          'A .ppx backup file will be downloaded',
          'Store backups in a safe location (cloud storage recommended)',
        ],
        import: [
          'Go to Settings > Restore to import a backup',
          'Select your previously exported .ppx backup file',
          'Your notes will be restored',
        ],
        iosTitle: 'iOS File Location',
        ios: [
          'After Save, the .ppx file is downloaded to Files app > Downloads folder',
          'You can move it to iCloud Drive for cloud backup',
          'Use AirDrop to transfer backups to other devices',
        ],
        note: 'All notes are included in the backup exactly as stored.',
      },
      pwa: {
        title: '8. Mobile APP',
        intro: 'Install PenPage as an app on your device for the best experience.',
        benefitTitle: 'Why install from web?',
        benefit: 'Unlike traditional apps, PenPage is installed directly from the web without going through app stores. This means more privacy (no tracking by app stores), instant updates, and the freedom to use it anywhere.',
        platforms: {
          iosSafari: {
            name: 'iOS (Safari)',
            icon: '📱',
            position: 'Bottom center - Share button',
            steps: [
              'Open penpage.com in Safari',
              'Tap the Share button at the bottom center',
              'Scroll down and tap "Add to Home Screen"',
              'Tap "Add" to confirm',
            ],
          },
          iosChrome: {
            name: 'iOS (Chrome)',
            icon: '📱',
            position: 'Top right - Share button',
            steps: [
              'Open penpage.com in Chrome',
              'Tap the Share button at the top right',
              'Scroll down and tap "Add to Home Screen"',
              'Tap "Add" to confirm',
            ],
          },
          androidChrome: {
            name: 'Android (Chrome)',
            icon: '🤖',
            position: 'Top right - Menu (⋮)',
            steps: [
              'Open penpage.com in Chrome',
              'Tap the menu icon (⋮) at the top right',
              'Tap "Add to Home screen" or "Install app"',
              'Tap "Add" or "Install" to confirm',
            ],
          },
          desktopChrome: {
            name: 'Desktop (Chrome)',
            icon: '💻',
            position: 'Address bar right side',
            steps: [
              'Open penpage.com in Chrome',
              'Chrome 76+: Click the install icon (⬇️) on the right side of the URL bar',
              'Click "Install"',
              'Or: Click ⋮ menu → Cast, Save, and Share → Install PenPage...',
            ],
          },
          openDesktopChrome: {
            name: 'Open Installed APP (Chrome)',
            icon: '💻',
            position: 'Address bar right side',
            steps: [
              'Chrome 134+: Click the "Open in PenPage" button in the address bar',
              'Or: Click ⋮ menu → Cast, Save, and Share → Open in PenPage',
            ],
          },
          desktopEdge: {
            name: 'Desktop (Edge)',
            icon: '💻',
            position: 'Top right - Menu (···)',
            steps: [
              'Open penpage.com in Edge',
              'Click the menu (···) at the top right',
              'Select "Apps" > "Install this site as an app"',
              'Click "Install" to confirm',
            ],
          },
          desktopSafari: {
            name: 'Desktop (Safari)',
            icon: '🍎',
            position: 'Toolbar - Share button',
            steps: [
              'Open penpage.com in Safari',
              'Click the Share button in the toolbar',
              'Select "Add to Dock"',
              'Click "Add" to confirm',
            ],
          },
        } as Record<string, PlatformGuide>,
      },
      openMd: {
        title: '9. Open Markdown Files',
        intro: 'Import existing Markdown files into PenPage with multiple convenient methods.',
        methods: {
          dragDrop: {
            title: 'Drag & Drop',
            desc: 'Drag .md files or folders directly onto PenPage',
            steps: [
              'Drag files: Drop .md/.markdown files anywhere on the page',
              'Drag folders: Drop a folder to import its entire structure (Chrome/Edge)',
              'Duplicate content is automatically detected and skipped',
            ],
          },
          button: {
            title: 'Import Button',
            desc: 'Use the menu to select files or directories',
            steps: [
              'Click the ⋮ menu in the top right',
              'Select "Open MD" to import individual files',
              'Select "Open Folder" to import an entire directory',
            ],
          },
          fileAssociation: {
            title: 'File Association (PWA)',
            desc: 'After installing PenPage as an app, open .md files directly',
            steps: [
              'Install PenPage as a PWA (see Mobile APP section)',
              'Chrome/Edge 102+: Right-click any .md file → Open with → PenPage',
              'Or: Double-click .md files (if set as default app)',
              'The file will open directly in PenPage',
            ],
            note: 'File association requires installing PenPage as a PWA and using Chrome/Edge 102+',
          },
        },
        features: [
          { title: 'Smart Deduplication', desc: 'Content hash prevents importing duplicate notes' },
          { title: 'Folder Structure', desc: 'Directory imports preserve folder hierarchy' },
          { title: 'Auto Title', desc: 'Page titles extracted from first H1 heading' },
          { title: 'Image Support', desc: 'Relative image paths from V3.1 backups are converted' },
        ],
        supported: {
          title: 'Supported Formats',
          formats: ['.md', '.markdown', '.txt'],
        },
      },
      shortcuts: {
        title: '10. Keyboard Shortcuts',
        intro: 'Speed up your workflow with keyboard shortcuts.',
        list: [
          { keys: 'Ctrl/Cmd + B', action: 'Bold' },
          { keys: 'Ctrl/Cmd + I', action: 'Italic' },
          { keys: 'Ctrl/Cmd + U', action: 'Underline' },
          { keys: 'Ctrl/Cmd + Shift + S', action: 'Strikethrough' },
          { keys: 'Ctrl/Cmd + Shift + H', action: 'Highlight' },
          { keys: 'Ctrl/Cmd + K', action: 'Add link' },
          { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
          { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
        ],
      },
    },
    cta: {
      title: 'Need Help?',
      text: 'We\'re here to help! Send us feedback or contact support.',
      feedback: 'Send Feedback',
      contact: 'Contact Support',
    },
    nav: {
      back: 'Back to App',
      terms: 'Terms',
      privacy: 'Privacy',
    },
  },
  zh: {
    title: 'PenPage 使用說明',
    subtitle: '了解如何有效使用 PenPage',
    toc: '快速導覽',
    whyPenPage: {
      title: '為什麼選擇 PenPage？',
      intro: '專為重視隱私與簡潔的使用者設計的筆記應用程式。',
      values: [
        {
          title: '隱私優先',
          desc: '筆記儲存在您的裝置上。沒有伺服器、沒有追蹤、沒有資料探勘。',
          icon: '🔒'
        },
        {
          title: '無需帳號',
          desc: '立即開始寫作。無需註冊、無需電子郵件驗證、無需記住密碼。',
          icon: '⚡'
        },
        {
          title: '完全免費',
          desc: '沒有廣告、沒有訂閱、沒有付費功能。所有功能對所有人開放。',
          icon: '💎'
        }
      ],
      comparison: {
        title: '功能比較',
        headers: ['功能', 'PenPage', '其他'],
        rows: [
          ['本地儲存', '✓', '部分'],
          ['無需帳號', '✓', '少見'],
          ['File Link（本地同步）', '✓', '少見'],
          ['離線存取', '✓', '部分'],
          ['開放原始碼', '✓', '少見'],
          ['100% 免費', '✓', '少見']
        ]
      }
    },
    faq: {
      title: '常見問題',
      categories: {
        privacy: {
          title: '隱私與安全',
          questions: [
            {
              q: 'PenPage 會存取我的筆記內容嗎？',
              a: '不會。PenPage 完全在您的瀏覽器中執行。筆記儲存在裝置的 IndexedDB 中，永不傳送到我們的伺服器。'
            },
            {
              q: '我的資料儲存在哪裡？',
              a: '所有資料都使用 IndexedDB 儲存在瀏覽器本地。您也可以使用 File Link 將筆記同步到電腦上的本地目錄。'
            },
            {
              q: '我的資料是否安全？',
              a: '您的筆記僅儲存在瀏覽器的本地儲存中，不會傳送到任何伺服器。建議定期匯出備份以增加資料安全性。'
            }
          ]
        },
        data: {
          title: '資料與備份',
          questions: [
            {
              q: '清除瀏覽器資料會刪除筆記嗎？',
              a: '是的。因此我們強烈建議定期備份（設定 → Save）並使用 File Link 在本地保留筆記副本。'
            },
            {
              q: '如何備份筆記？',
              a: '前往設定 → Save 匯出 .ppx 備份檔案。將其儲存在安全的地方，如雲端儲存或外接硬碟。'
            },
            {
              q: '可以從備份還原筆記嗎？',
              a: '可以。前往設定 → Restore 選擇您的 .ppx 備份檔案。筆記將被還原。'
            }
          ]
        },
        features: {
          title: '功能相關',
          questions: [
            {
              q: '可以在多個裝置上使用 PenPage 嗎？',
              a: '您可以匯出 .ppx 備份檔並在其他裝置匯入。也可以使用 File Link 將筆記同步到本地目錄，再透過雲端儲存服務共享。'
            },
            {
              q: '支援哪些 Markdown 語法？',
              a: 'PenPage 支援標題（#）、粗體（**）、斜體（*）、列表、程式碼區塊、連結、圖片等。'
            },
            {
              q: '如何匯入現有的 Markdown 檔案？',
              a: '將 .md 檔案拖放到 PenPage，或使用選單（⋮）→ Open MD。也可以匯入整個資料夾。'
            }
          ]
        },
        pwa: {
          title: '行動應用程式（PWA）',
          questions: [
            {
              q: '為什麼要將 PenPage 安裝為應用程式？',
              a: '安裝為 PWA 可讓您離線存取、擁有主畫面圖示、全螢幕體驗，以及更快的載入速度。'
            },
            {
              q: 'PWA 和原生應用程式有什麼區別？',
              a: 'PWA 直接從網頁安裝，無需應用程式商店。它們佔用更少儲存空間並自動更新。'
            },
            {
              q: 'PWA 可以離線使用嗎？',
              a: '可以！安裝後，PenPage 可完全離線使用。筆記儲存在瀏覽器本地。'
            }
          ]
        }
      } as Record<string, FAQCategory>
    },
    troubleshooting: {
      title: '故障排除',
      intro: '遇到問題？試試這些解決方案。',
      issues: [
        {
          title: 'File Link 無法運作',
          steps: [
            '確認連結的目錄是否仍然存在',
            '如果瀏覽器提示，請重新授權目錄存取',
            '嘗試取消連結後重新連結目錄',
            '確保使用支援的瀏覽器（Chrome/Edge）'
          ]
        },
        {
          title: '筆記遺失',
          steps: [
            '確認是否在正確的工作區',
            '查看垃圾桶資料夾',
            '如有備份檔案，嘗試還原',
            '檢查 File Link 目錄中是否有本地副本'
          ]
        },
        {
          title: 'PWA 無法安裝',
          steps: [
            '確保使用 Chrome、Edge 或 Safari',
            '清除瀏覽器快取並重新載入頁面',
            '檢查是否封鎖了彈出視窗',
            '嘗試使用無痕/私密模式'
          ]
        },
        {
          title: '編輯器沒有反應',
          steps: [
            '重新整理頁面',
            '清除瀏覽器快取',
            '嘗試其他瀏覽器',
            '確認 JavaScript 已啟用'
          ]
        }
      ] as TroubleshootingIssue[]
    },
    sections: {
      gettingStarted: {
        title: '1. 開始使用',
        intro: 'PenPage 是一款隱私優先的筆記應用程式，將您的筆記儲存在瀏覽器本地。無需帳號，資料不會傳送到伺服器。',
        features: [
          { title: '本地儲存', desc: '筆記儲存在瀏覽器的 IndexedDB 中' },
          { title: '離線就緒', desc: '無需網路連線即可使用' },
          { title: '免註冊', desc: '立即開始寫作，無需建立帳號' },
          { title: 'File Link', desc: '將資料夾連結到本地目錄進行雙向同步' },
        ],
      },
      editor: {
        title: '2. 編輯器功能',
        intro: 'PenPage 是真正的所見即所得編輯器，支援即時 Markdown 渲染 — 打字即呈現，無需預覽面板。',
        features: [
          { title: '即時 Markdown', desc: '輸入 Markdown 語法即時呈現結果 — 無需預覽面板、無需切換模式' },
          { title: '真正所見即所得', desc: '打字即呈現的編輯器，輸入即渲染' },
          { title: 'Markdown 語法', desc: '輸入 # 產生標題、** 產生粗體等快捷方式' },
          { title: '豐富格式', desc: '粗體、斜體、標題、列表、程式碼區塊等' },
          { title: '圖片支援', desc: '直接貼上或拖放圖片到筆記中' },
        ],
      },
      organization: {
        title: '3. 組織管理',
        intro: '使用工作區、資料夾和頁面來組織您的筆記。',
        hierarchy: [
          { name: '工作區 (Workspace)', desc: '最上層容器，用於區分不同情境（工作、個人、專案）' },
          { name: '資料夾 (Folder)', desc: '在工作區內將相關頁面分組' },
          { name: '頁面 (Page)', desc: '撰寫內容的個別筆記' },
        ],
        tips: [
          '拖放可重新排序頁面和資料夾（桌面版）',
          '使用編輯模式進行批次操作',
          '為資料夾設定顏色以便視覺組織',
        ],
      },
      storage: {
        title: '4. 本地儲存',
        intro: '您的筆記使用 IndexedDB（瀏覽器資料庫）儲存在本地。',
        points: [
          { title: '持久性', desc: '筆記在瀏覽器重啟和更新後仍然保留' },
          { title: '隱私性', desc: '資料留在您的裝置上，不會傳送到伺服器' },
          { title: '離線存取', desc: '無需網路即可讀取和編輯筆記' },
        ],
        warning: '清除瀏覽器資料會刪除您的筆記。請務必備份重要內容！',
      },
      security: {
        title: '5. 隱私與安全',
        intro: 'PenPage 以隱私為核心原則設計。',
        features: [
          { title: '本地優先', desc: '筆記預設儲存在您的裝置上' },
          { title: '無伺服器', desc: '您的資料不會離開瀏覽器 — 沒有雲端、沒有追蹤' },
          { title: '開放原始碼', desc: '原始碼公開可供審查，確保透明度' },
          { title: '無需帳號', desc: '不需註冊、不需電子郵件、不收集個人資料' },
        ],
        encryptionSteps: [
          '您的筆記僅儲存在瀏覽器的 IndexedDB 中',
          '不會將任何資料傳送到外部伺服器',
          '使用備份和 File Link 增加資料安全性',
        ],
      },
      cloudSync: {
        title: '6. File Link（本地同步）',
        intro: '將資料夾連結到電腦上的本地目錄，進行雙向同步。',
        steps: [
          '開啟資料夾選單，選擇「Link Directory」',
          '選擇電腦上的本地目錄',
          'PenPage 會將筆記以 Markdown 檔案同步到該目錄',
          '雙向變更會自動偵測並同步',
        ],
        tips: [
          'File Link 使用瀏覽器的 File System Access API（Chrome/Edge）',
          '可以將多個資料夾連結到不同目錄',
          '使用雲端同步目錄（如 Dropbox、iCloud）即可跨裝置存取',
        ],
      },
      backup: {
        title: '7. 備份與還原',
        intro: '定期備份您的筆記以防止資料遺失。',
        export: [
          '前往設定 > Save 匯出所有筆記',
          '系統會下載 .ppx 備份檔案',
          '將備份儲存在安全的位置（建議使用雲端儲存）',
        ],
        import: [
          '前往設定 > Restore 還原備份',
          '選擇先前匯出的 .ppx 備份檔案',
          '您的筆記將被還原',
        ],
        iosTitle: 'iOS 檔案位置',
        ios: [
          'Save 後，.ppx 檔案會下載到「檔案」App > 下載項目',
          '可將檔案移至 iCloud Drive 進行雲端備份',
          '使用 AirDrop 將備份傳送到其他裝置',
        ],
        note: '所有筆記會完整包含在備份中。',
      },
      pwa: {
        title: '8. 行動應用程式',
        intro: '將 PenPage 安裝為應用程式，獲得最佳體驗。',
        benefitTitle: '為什麼從網頁安裝？',
        benefit: '與傳統應用程式不同，PenPage 直接從網頁安裝，無需通過應用程式商店。這意味著更高的隱私（不被商店追蹤）、即時更新，以及隨時隨地使用的自由。',
        platforms: {
          iosSafari: {
            name: 'iOS (Safari)',
            icon: '📱',
            position: '底部中央 - 分享按鈕',
            steps: [
              '在 Safari 中開啟 penpage.com',
              '點擊底部中央的分享按鈕',
              '向下捲動並點擊「加入主畫面」',
              '點擊「加入」確認',
            ],
          },
          iosChrome: {
            name: 'iOS (Chrome)',
            icon: '📱',
            position: '右上角 - 分享按鈕',
            steps: [
              '在 Chrome 中開啟 penpage.com',
              '點擊右上角的分享按鈕',
              '向下捲動並點擊「加入主畫面」',
              '點擊「加入」確認',
            ],
          },
          androidChrome: {
            name: 'Android (Chrome)',
            icon: '🤖',
            position: '右上角 - 選單 (⋮)',
            steps: [
              '在 Chrome 中開啟 penpage.com',
              '點擊右上角的選單圖示 (⋮)',
              '點擊「新增至主畫面」或「安裝應用程式」',
              '點擊「新增」或「安裝」確認',
            ],
          },
          desktopChrome: {
            name: '桌面版 (Chrome)',
            icon: '💻',
            position: '網址列右側',
            steps: [
              '在 Chrome 中開啟 penpage.com',
              'Chrome 76+：點擊網址列右側的「安裝」圖示（⬇️）',
              '點擊「安裝」',
              '或：點擊「⋮」→「投放、儲存與分享」→「安裝 PenPage...」',
            ],
          },
          openDesktopChrome: {
            name: '開啟已安裝 APP (Chrome)',
            icon: '💻',
            position: '網址列右側',
            steps: [
              'Chrome 134+：點擊網址列的「在應用程式中開啟」按鈕',
              '或：點擊「⋮」選單 → 投放、儲存與分享 → 在 PenPage 中開啟',
            ],
          },
          desktopEdge: {
            name: '桌面版 (Edge)',
            icon: '💻',
            position: '右上角 - 選單 (···)',
            steps: [
              '在 Edge 中開啟 penpage.com',
              '點擊右上角的選單 (···)',
              '選擇「應用程式」>「將此網站安裝為應用程式」',
              '點擊「安裝」確認',
            ],
          },
          desktopSafari: {
            name: '桌面版 (Safari)',
            icon: '🍎',
            position: '工具列 - 分享按鈕',
            steps: [
              '在 Safari 中開啟 penpage.com',
              '點擊工具列中的分享按鈕',
              '選擇「加入 Dock」',
              '點擊「加入」確認',
            ],
          },
        } as Record<string, PlatformGuide>,
      },
      openMd: {
        title: '9. 開啟 Markdown 檔案',
        intro: '透過多種便利方式將現有的 Markdown 檔案匯入 PenPage。',
        methods: {
          dragDrop: {
            title: '拖放匯入',
            desc: '直接將 .md 檔案或資料夾拖放到 PenPage',
            steps: [
              '拖放檔案：將 .md/.markdown 檔案拖放到頁面任意位置',
              '拖放資料夾：拖放整個資料夾以匯入其目錄結構（Chrome/Edge）',
              '自動偵測並跳過重複內容',
            ],
          },
          button: {
            title: '按鈕匯入',
            desc: '使用選單選擇檔案或目錄',
            steps: [
              '點擊右上角的 ⋮ 選單',
              '選擇「Open MD」匯入單一檔案',
              '選擇「Open Folder」匯入整個目錄',
            ],
          },
          fileAssociation: {
            title: '檔案關聯（PWA）',
            desc: '安裝 PenPage 為應用程式後，可直接開啟 .md 檔案',
            steps: [
              '將 PenPage 安裝為 PWA（參見行動應用程式章節）',
              'Chrome/Edge 102+：右鍵點擊任何 .md 檔案 → 開啟方式 → PenPage',
              '或：雙擊 .md 檔案（如已設為預設應用程式）',
              '檔案會直接在 PenPage 中開啟',
            ],
            note: '檔案關聯需要安裝 PenPage 為 PWA，並使用 Chrome/Edge 102+',
          },
        },
        features: [
          { title: '智慧去重', desc: '透過內容雜湊防止匯入重複筆記' },
          { title: '目錄結構', desc: '目錄匯入時保留資料夾層級' },
          { title: '自動標題', desc: '從第一個 H1 標題提取頁面標題' },
          { title: '圖片支援', desc: '自動轉換 V3.1 備份的相對圖片路徑' },
        ],
        supported: {
          title: '支援格式',
          formats: ['.md', '.markdown', '.txt'],
        },
      },
      shortcuts: {
        title: '10. 快捷鍵',
        intro: '使用快捷鍵加速您的工作流程。',
        list: [
          { keys: 'Ctrl/Cmd + B', action: '粗體' },
          { keys: 'Ctrl/Cmd + I', action: '斜體' },
          { keys: 'Ctrl/Cmd + U', action: '底線' },
          { keys: 'Ctrl/Cmd + Shift + S', action: '刪除線' },
          { keys: 'Ctrl/Cmd + Shift + H', action: '螢光標記' },
          { keys: 'Ctrl/Cmd + K', action: '新增連結' },
          { keys: 'Ctrl/Cmd + Z', action: '復原' },
          { keys: 'Ctrl/Cmd + Shift + Z', action: '重做' },
        ],
      },
    },
    cta: {
      title: '需要協助？',
      text: '我們隨時為您提供幫助！發送回饋或聯繫支援團隊。',
      feedback: '發送回饋',
      contact: '聯繫支援',
    },
    nav: {
      back: '返回應用程式',
      terms: '服務條款',
      privacy: '隱私權政策',
    },
  },
}

const HelpPage = () => {
  // 自動語言偵測（無手動選項）
  const lang = useMemo(() => {
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('zh') ? 'zh' : 'en'
  }, [])

  const t = i18n[lang]

  // Google Translate Widget 初始化
  useEffect(() => {
    // 避免重複載入
    if (document.getElementById('google-translate-script')) return

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: lang === 'zh' ? 'zh-TW' : 'en',
            includedLanguages: 'zh-TW,zh-CN,en,ja,ko,es,fr,de,pt,vi,th,id,ar,ru',
            layout: (window.google.translate.TranslateElement as any).InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element'
        )
      }
    }

    const script = document.createElement('script')
    script.id = 'google-translate-script'
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
    document.body.appendChild(script)
  }, [lang])

  // 滾動到指定區塊，避免觸發 hashchange
  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // 導覽到其他頁面
  const navigateTo = useCallback((e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault()
    window.location.hash = path
  }, [])

  // 搜尋狀態
  const [searchQuery, setSearchQuery] = useState('')

  // 深度搜尋物件中的所有文字內容
  const searchInObject = useCallback((obj: unknown): boolean => {
    if (!searchQuery.trim()) return true
    if (typeof obj === 'string') {
      return obj.toLowerCase().includes(searchQuery.toLowerCase())
    }
    if (Array.isArray(obj)) {
      return obj.some(item => searchInObject(item))
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => searchInObject(value))
    }
    return false
  }, [searchQuery])

  // 判斷區塊是否應該顯示
  const shouldShowSection = useCallback((sectionKey: string): boolean => {
    if (!searchQuery.trim()) return true
    // 先檢查頂層屬性（whyPenPage, faq, troubleshooting）
    if (sectionKey in t && sectionKey !== 'sections') {
      return searchInObject((t as Record<string, unknown>)[sectionKey])
    }
    // 再檢查 sections 內的屬性
    const section = (t.sections as Record<string, unknown>)[sectionKey]
    return searchInObject(section)
  }, [searchQuery, t, searchInObject])

  // 高亮匹配文字
  const highlightMatch = useCallback((text: string): React.ReactNode => {
    if (!searchQuery.trim()) return text
    const query = searchQuery.toLowerCase()
    const lowerText = text.toLowerCase()
    const index = lowerText.indexOf(query)
    if (index === -1) return text
    return (
      <>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + searchQuery.length)}</mark>
        {text.slice(index + searchQuery.length)}
      </>
    )
  }, [searchQuery])

  // 檢查是否有任何區塊匹配
  const hasAnyMatch = useMemo(() => {
    if (!searchQuery.trim()) return true
    const sectionKeys = ['whyPenPage', 'gettingStarted', 'editor', 'organization', 'storage', 'security', 'cloudSync', 'backup', 'pwa', 'openMd', 'shortcuts', 'faq', 'troubleshooting']
    return sectionKeys.some(key => shouldShowSection(key))
  }, [searchQuery, shouldShowSection])

  return (
    <div className="help-page">
      <div className="help-container">
        {/* Google Translate Widget */}
        <div className="help-translate">
          <div id="google_translate_element"></div>
        </div>

        {/* 頂部導覽列 */}
        <div className="help-header">
          <a href="#/" onClick={(e) => navigateTo(e, '/')} className="btn-back">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M12.5 15a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5M10 8a.5.5 0 0 1-.5.5H3.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L3.707 7.5H9.5a.5.5 0 0 1 .5.5"/>
            </svg>
            Back
          </a>
          <div className="help-brand">
            <img src="/ppage2.png" alt="PenPage" className="help-brand-logo" />
            <span className="help-brand-name">PenPage</span>
          </div>
        </div>

        <h1>{t.title}</h1>
        <p className="help-subtitle">{t.subtitle}</p>

        {/* 搜尋框 */}
        <div className="help-search">
          <input
            type="text"
            placeholder={lang === 'zh' ? '搜尋說明內容...' : 'Search help...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="help-search-input"
          />
          {searchQuery && (
            <button
              className="help-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* 快速導覽 TOC - 使用 scrollIntoView 避免觸發 hashchange */}
        {!searchQuery && (
          <nav className="help-toc">
            <h2>{t.toc}</h2>
            <ul>
              <li><a href="#why-penpage" onClick={(e) => scrollToSection(e, 'why-penpage')}>{t.whyPenPage.title}</a></li>
              <li><a href="#getting-started" onClick={(e) => scrollToSection(e, 'getting-started')}>{t.sections.gettingStarted.title}</a></li>
              <li><a href="#editor" onClick={(e) => scrollToSection(e, 'editor')}>{t.sections.editor.title}</a></li>
              <li><a href="#organization" onClick={(e) => scrollToSection(e, 'organization')}>{t.sections.organization.title}</a></li>
              <li><a href="#storage" onClick={(e) => scrollToSection(e, 'storage')}>{t.sections.storage.title}</a></li>
              <li><a href="#security" onClick={(e) => scrollToSection(e, 'security')}>{t.sections.security.title}</a></li>
              <li><a href="#cloud-sync" onClick={(e) => scrollToSection(e, 'cloud-sync')}>{t.sections.cloudSync.title}</a></li>
              <li><a href="#backup" onClick={(e) => scrollToSection(e, 'backup')}>{t.sections.backup.title}</a></li>
              <li><a href="#mobile-app" onClick={(e) => scrollToSection(e, 'mobile-app')}>{t.sections.pwa.title}</a></li>
              <li><a href="#open-md" onClick={(e) => scrollToSection(e, 'open-md')}>{(t.sections as any).openMd.title}</a></li>
              <li><a href="#shortcuts" onClick={(e) => scrollToSection(e, 'shortcuts')}>{t.sections.shortcuts.title}</a></li>
              <li><a href="#faq" onClick={(e) => scrollToSection(e, 'faq')}>{t.faq.title}</a></li>
              <li><a href="#troubleshooting" onClick={(e) => scrollToSection(e, 'troubleshooting')}>{t.troubleshooting.title}</a></li>
            </ul>
          </nav>
        )}

        {/* 無結果提示 */}
        {!hasAnyMatch && (
          <div className="help-no-results">
            <div className="help-no-results-icon">🔍</div>
            <p>{lang === 'zh' ? '找不到符合的內容' : 'No matching content found'}</p>
            <button onClick={() => setSearchQuery('')} className="help-search-reset">
              {lang === 'zh' ? '清除搜尋' : 'Clear search'}
            </button>
          </div>
        )}

        {/* 0. Why PenPage? - 價值主張 */}
        {shouldShowSection('whyPenPage') && (
          <section id="why-penpage" className="help-section help-why-section">
            <h2>{highlightMatch(t.whyPenPage.title)}</h2>
            <p className="help-why-intro">{highlightMatch(t.whyPenPage.intro)}</p>

            {/* 價值主張卡片 */}
            <div className="help-value-grid">
              {t.whyPenPage.values.map((value, index) => (
                <div key={index} className="help-value-card">
                  <span className="help-value-icon">{value.icon}</span>
                  <h4>{highlightMatch(value.title)}</h4>
                  <p>{highlightMatch(value.desc)}</p>
                </div>
              ))}
            </div>

            {/* 競品比較表 */}
            <h3>{highlightMatch(t.whyPenPage.comparison.title)}</h3>
            <table className="help-comparison-table">
              <thead>
                <tr>
                  {t.whyPenPage.comparison.headers.map((header, i) => (
                    <th key={i}>{highlightMatch(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.whyPenPage.comparison.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className={j === 1 && cell === '✓' ? 'help-check' : ''}>
                        {highlightMatch(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 1. Getting Started */}
        {shouldShowSection('gettingStarted') && (
          <section id="getting-started" className="help-section">
            <h2>{highlightMatch(t.sections.gettingStarted.title)}</h2>
            <p>{highlightMatch(t.sections.gettingStarted.intro)}</p>
            <div className="help-feature-grid">
              {t.sections.gettingStarted.features.map((feature, index) => (
                <div key={index} className="help-feature-card">
                  <h4>{highlightMatch(feature.title)}</h4>
                  <p>{highlightMatch(feature.desc)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 2. Editor Features */}
        {shouldShowSection('editor') && (
          <section id="editor" className="help-section">
            <h2>{highlightMatch(t.sections.editor.title)}</h2>
            <p>{highlightMatch(t.sections.editor.intro)}</p>
            <div className="help-feature-grid">
              {t.sections.editor.features.map((feature, index) => (
                <div key={index} className="help-feature-card">
                  <h4>{highlightMatch(feature.title)}</h4>
                  <p>{highlightMatch(feature.desc)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Organization */}
        {shouldShowSection('organization') && (
          <section id="organization" className="help-section">
            <h2>{highlightMatch(t.sections.organization.title)}</h2>
            <p>{highlightMatch(t.sections.organization.intro)}</p>
            <h3>{lang === 'zh' ? '階層結構' : 'Hierarchy'}</h3>
            <ul>
              {t.sections.organization.hierarchy.map((item, index) => (
                <li key={index}><strong>{highlightMatch(item.name)}:</strong> {highlightMatch(item.desc)}</li>
              ))}
            </ul>
            <h3>{lang === 'zh' ? '使用技巧' : 'Tips'}</h3>
            <ul>
              {t.sections.organization.tips.map((tip, index) => (
                <li key={index}>{highlightMatch(tip)}</li>
              ))}
            </ul>
          </section>
        )}

        {/* 4. Local Storage */}
        {shouldShowSection('storage') && (
          <section id="storage" className="help-section">
            <h2>{highlightMatch(t.sections.storage.title)}</h2>
            <p>{highlightMatch(t.sections.storage.intro)}</p>
            <div className="help-feature-grid">
              {t.sections.storage.points.map((point, index) => (
                <div key={index} className="help-feature-card">
                  <h4>{highlightMatch(point.title)}</h4>
                  <p>{highlightMatch(point.desc)}</p>
                </div>
              ))}
            </div>
            <div className="help-warning">
              <strong>⚠️ {lang === 'zh' ? '注意：' : 'Warning:'}</strong> {highlightMatch(t.sections.storage.warning)}
            </div>
          </section>
        )}

        {/* 5. Privacy & Security */}
        {shouldShowSection('security') && (
          <section id="security" className="help-section">
            <h2>{highlightMatch(t.sections.security.title)}</h2>
            <p>{highlightMatch(t.sections.security.intro)}</p>
            <div className="help-feature-grid">
              {t.sections.security.features.map((feature, index) => (
                <div key={index} className="help-feature-card">
                  <h4>{highlightMatch(feature.title)}</h4>
                  <p>{highlightMatch(feature.desc)}</p>
                </div>
              ))}
            </div>
            <h3>{lang === 'zh' ? '隱私保障' : 'How Your Data Is Protected'}</h3>
            <ol>
              {t.sections.security.encryptionSteps.map((step, index) => (
                <li key={index}>{highlightMatch(step)}</li>
              ))}
            </ol>
          </section>
        )}

        {/* 6. File Link */}
        {shouldShowSection('cloudSync') && (
          <section id="cloud-sync" className="help-section">
            <h2>{highlightMatch(t.sections.cloudSync.title)}</h2>
            <p>{highlightMatch(t.sections.cloudSync.intro)}</p>
            <h3>{lang === 'zh' ? '使用步驟' : 'Setup Steps'}</h3>
            <ol>
              {t.sections.cloudSync.steps.map((step, index) => (
                <li key={index}>{highlightMatch(step)}</li>
              ))}
            </ol>
            <h3>{lang === 'zh' ? '注意事項' : 'Notes'}</h3>
            <ul>
              {t.sections.cloudSync.tips.map((tip, index) => (
                <li key={index}>{highlightMatch(tip)}</li>
              ))}
            </ul>
          </section>
        )}

        {/* 7. Backup & Restore */}
        {shouldShowSection('backup') && (
          <section id="backup" className="help-section">
            <h2>{highlightMatch(t.sections.backup.title)}</h2>
            <p>{highlightMatch(t.sections.backup.intro)}</p>
            <h3>{lang === 'zh' ? '匯出備份' : 'Export Backup'}</h3>
            <ol>
              {t.sections.backup.export.map((step, index) => (
                <li key={index}>{highlightMatch(step)}</li>
              ))}
            </ol>
            <h3>{lang === 'zh' ? '匯入備份' : 'Import Backup'}</h3>
            <ol>
              {t.sections.backup.import.map((step, index) => (
                <li key={index}>{highlightMatch(step)}</li>
              ))}
            </ol>
            <h3>{(t.sections.backup as any).iosTitle}</h3>
            <ul>
              {((t.sections.backup as any).ios as string[]).map((tip, index) => (
                <li key={index}>{highlightMatch(tip)}</li>
              ))}
            </ul>
            <p><strong>{lang === 'zh' ? '注意：' : 'Note:'}</strong> {highlightMatch(t.sections.backup.note)}</p>
          </section>
        )}

        {/* 8. Mobile APP */}
        {shouldShowSection('pwa') && (
          <section id="mobile-app" className="help-section">
            <h2>{highlightMatch(t.sections.pwa.title)}</h2>
            <p>{highlightMatch(t.sections.pwa.intro)}</p>

            {/* 安裝優點說明區塊 */}
            <div className="help-benefit-box">
              <h3>{highlightMatch(t.sections.pwa.benefitTitle)}</h3>
              <p>{highlightMatch(t.sections.pwa.benefit)}</p>
            </div>

            {/* 平台特定指引 */}
            <div className="help-platform-grid">
              {Object.entries(t.sections.pwa.platforms).map(([key, platform]) => (
                <div key={key} className="help-platform-card">
                  <h4>
                    <span className="help-platform-icon">{platform.icon}</span>
                    {highlightMatch(platform.name)}
                  </h4>
                  <p className="help-platform-position">
                    📍 {lang === 'zh' ? '位置：' : 'Look for:'} <strong>{highlightMatch(platform.position)}</strong>
                  </p>
                  <ol>
                    {platform.steps.map((step, i) => <li key={i}>{highlightMatch(step)}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Open Markdown Files */}
        {shouldShowSection('openMd') && (
          <section id="open-md" className="help-section">
            <h2>{highlightMatch((t.sections as any).openMd.title)}</h2>
            <p>{highlightMatch((t.sections as any).openMd.intro)}</p>

            {/* 匯入方式 */}
            {Object.entries((t.sections as any).openMd.methods).map(([key, method]: [string, any]) => (
              <div key={key} className="help-method-card">
                <h3>{highlightMatch(method.title)}</h3>
                <p className="help-method-desc">{highlightMatch(method.desc)}</p>
                <ol>
                  {method.steps.map((step: string, i: number) => (
                    <li key={i}>{highlightMatch(step)}</li>
                  ))}
                </ol>
                {method.note && (
                  <p className="help-method-note">
                    <strong>{lang === 'zh' ? '注意：' : 'Note:'}</strong> {highlightMatch(method.note)}
                  </p>
                )}
              </div>
            ))}

            {/* 功能特色 */}
            <h3>{lang === 'zh' ? '功能特色' : 'Features'}</h3>
            <div className="help-feature-grid">
              {(t.sections as any).openMd.features.map((feature: { title: string; desc: string }, index: number) => (
                <div key={index} className="help-feature-card">
                  <h4>{highlightMatch(feature.title)}</h4>
                  <p>{highlightMatch(feature.desc)}</p>
                </div>
              ))}
            </div>

            {/* 支援格式 */}
            <h3>{(t.sections as any).openMd.supported.title}</h3>
            <p>
              {(t.sections as any).openMd.supported.formats.map((fmt: string, i: number) => (
                <code key={i} style={{ marginRight: '0.5rem' }}>{fmt}</code>
              ))}
            </p>
          </section>
        )}

        {/* 10. Keyboard Shortcuts */}
        {shouldShowSection('shortcuts') && (
          <section id="shortcuts" className="help-section">
            <h2>{highlightMatch(t.sections.shortcuts.title)}</h2>
            <p>{highlightMatch(t.sections.shortcuts.intro)}</p>
            <table className="help-shortcuts-table">
              <thead>
                <tr>
                  <th>{lang === 'zh' ? '快捷鍵' : 'Shortcut'}</th>
                  <th>{lang === 'zh' ? '功能' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {t.sections.shortcuts.list.map((shortcut, index) => (
                  <tr key={index}>
                    <td><kbd>{shortcut.keys}</kbd></td>
                    <td>{highlightMatch(shortcut.action)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 11. FAQ - 常見問題 */}
        {shouldShowSection('faq') && (
          <section id="faq" className="help-section help-faq-section">
            <h2>{highlightMatch(t.faq.title)}</h2>

            {Object.entries(t.faq.categories).map(([key, category]) => (
              <div key={key} className="help-faq-category">
                <h3>{highlightMatch(category.title)}</h3>
                <div className="help-faq-list">
                  {category.questions.map((item, index) => (
                    <details key={index} className="help-faq-item">
                      <summary>{highlightMatch(item.q)}</summary>
                      <p>{highlightMatch(item.a)}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 12. Troubleshooting - 故障排除 */}
        {shouldShowSection('troubleshooting') && (
          <section id="troubleshooting" className="help-section help-troubleshooting-section">
            <h2>{highlightMatch(t.troubleshooting.title)}</h2>
            <p>{highlightMatch(t.troubleshooting.intro)}</p>

            <div className="help-troubleshooting-grid">
              {t.troubleshooting.issues.map((issue, index) => (
                <div key={index} className="help-troubleshooting-card">
                  <h4>{highlightMatch(issue.title)}</h4>
                  <ol>
                    {issue.steps.map((step, i) => (
                      <li key={i}>{highlightMatch(step)}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA 區塊 */}
        <section className="help-cta">
          <h2>{t.cta.title}</h2>
          <p>{t.cta.text}</p>
          <div className="help-cta-buttons">
            <a href="#/feedback" onClick={(e) => navigateTo(e, '/feedback')} className="help-cta-btn primary">
              {t.cta.feedback}
            </a>
            <a href="mailto:support@penpage.com" className="help-cta-btn secondary">
              {t.cta.contact}
            </a>
          </div>
        </section>

        {/* 頁尾導覽 */}
        <div className="help-navigation">
          <a href="#/" onClick={(e) => navigateTo(e, '/')} className="btn-back">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M12.5 15a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 1 0v13a.5.5 0 0 1-.5.5M10 8a.5.5 0 0 1-.5.5H3.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L3.707 7.5H9.5a.5.5 0 0 1 .5.5"/>
            </svg>
            Back
          </a>
        </div>
      </div>
    </div>
  )
}

export default HelpPage
