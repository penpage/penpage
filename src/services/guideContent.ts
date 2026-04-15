/**
 * 示範筆記服務
 * 首次啟動或版本更新時建立/更新示範筆記
 */

import { db, Folder, Page } from './db'
import { ROOT_FOLDER_ID } from './rootFolders'

// 版本控制
export const GUIDE_VERSION = '1.1.0'
export const GUIDE_FOLDER_ID = 'folder-penpage-guide'
export const GUIDE_FOLDER_NAME = '📚 PenPage'

// LocalStorage key（使用新 key，確保既有使用者也會在 local 建立 guide）
const GUIDE_VERSION_KEY = 'guideVersionLocal'

// 頁面定義
interface GuidePage {
  id: string
  name: string
  order: number
}

// 頁面清單
const guidePages: GuidePage[] = [
  { id: 'guide-welcome', name: '👋 Welcome', order: 0 },
  { id: 'guide-editor', name: '✏️ Editor Guide', order: 1 },
  { id: 'guide-organize', name: '📁 Organize Notes', order: 2 },
  { id: 'guide-backup', name: '💾 Backup & Restore', order: 3 },
  { id: 'guide-sync', name: '🔗 File Link', order: 4 },
  { id: 'guide-import', name: '📥 Import Markdown', order: 5 },
  { id: 'guide-shortcuts', name: '⌨️ Shortcuts', order: 6 },
]

// 取得語言
function getGuideLanguage(): 'zh' | 'en' {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

// ===== 中英文內容 =====

const guideContent = {
  en: {
    'guide-welcome': `# 👋 Welcome to PenPage!

A Real WYSIWYG Markdown (RWM) note-taking app

## Quick Start ✨ Live Markdown Editing

- **Write**: Press + anytime to start typing, auto-saves instantly
- **File Link**: Link a local folder to sync notes with your file system
- Type Markdown, see results instantly — no preview switching needed
    - Type \`#\` + space → Heading appears
    - Type \`**text**\` → **Bold** rendered
    - Type \`- \` → Bullet list starts
- Everything stored on your device — your notes stay private
- Drag & drop files or folders to import all MD files, backup everything together
- No install, no account needed, works offline on a plane! Best of all — it's free

## Why PenPage?

| Feature | PenPage |
| --- | --- |
| 🔒 Privacy | Notes stay on YOUR device |
| ⚡ No Account | Start writing immediately |
| 📴 Offline | Works without internet |
| 💎 Free | No sign-up, no subscriptions |

**Tip**: You can delete this folder anytime. To recreate it, clear \`guideVersion\` from localStorage and reload.
`,

    'guide-editor': `# ✏️ Editor Guide

PenPage supports rich text editing with Markdown shortcuts.

## Text Formatting

- **Bold**: \`**text**\` or \`Cmd/Ctrl + B\`
- *Italic*: \`*text*\` or \`Cmd/Ctrl + I\`
- ~~Strikethrough~~: \`~~text~~\`
- \`Inline code\`: wrap with backticks

## Headings

\`# Heading 1\`
\`## Heading 2\`
\`### Heading 3\`

## Lists

Bullet list:
- Item 1
- Item 2
  - Nested item

Numbered list:
1. First
2. Second
3. Third

Task list:
- [ ] Todo item
- [x] Completed item

## Code Blocks

\`\`\`javascript
function hello() {
  console.log('Hello, PenPage!')
}
\`\`\`

## Tables

| Name | Role |
|------|------|
| Alice | Developer |
| Bob | Designer |

## Links & Images

- Link: \`[text](url)\`
- Image: \`![alt](url)\` or paste/drag image directly
`,

    'guide-organize': `# 📁 Organize Notes

Keep your notes tidy with folders.

## Creating Folders

1. Click the **+** button in sidebar
2. Enter folder name
3. Press Enter

## Moving Notes

1. Click **Edit** button in sidebar
2. Select notes to move
3. Drag to target folder

## Folder Colors

In Edit mode, tap a folder to change its color.

## Deleting

- Deleted items go to **Trash**
- Trash auto-empties after 30 days
- Permanent delete from Trash settings
`,

    'guide-backup': `# 💾 Backup & Restore

Protect your notes with local backups.

## Creating a Backup

1. Open **Settings** (gear icon)
2. Click **Save** button
3. Choose save location
4. Done! A \`.zip\` file is downloaded

## Restoring from Backup

1. Open **Settings**
2. Click **Restore** button
3. Select your backup \`.zip\` file
4. Confirm restore

## What's Included

| Data | Included |
|------|----------|
| All notes | ✅ |
| All folders | ✅ |
| Images | ✅ |
| Settings | ✅ |

## iOS Users

On iOS, backup files are saved to:
- **Files app** → On My iPhone → Downloads

Or use **Share** to save to iCloud Drive.

## Best Practices

- Backup regularly (weekly recommended)
- Keep backups in a safe location
- Test restore occasionally
`,

    'guide-sync': `# 🔗 File Link

Sync your notes with local folders on your file system.

## What is File Link?

File Link lets you connect a PenPage folder to a local directory. Notes are saved as \`.md\` files that you can edit with any text editor.

## Setup

1. Open a folder in the sidebar
2. Click the **link** icon on the folder
3. Select a local directory
4. Grant permission when prompted

## How It Works

- Notes sync bidirectionally with linked directories
- Changes in PenPage update the local files
- Changes to local files update PenPage
- Pull / Push / Auto-detect sync directions

## Use Cases

- Edit notes with your favorite text editor
- Use Git to version control your notes
- Access notes from terminal or file manager
- Share a folder with other tools (VS Code, Obsidian, etc.)

## Tips

- One directory handle covers all subdirectories
- Linked folders show a blue icon in the folder tree
- Unlinking a folder does not delete local files
`,

    'guide-import': `# 📥 Import Markdown

Bring your existing notes into PenPage.

## Methods

### 1. Drag & Drop

Simply drag \`.md\` files onto the editor.

### 2. Menu Import

1. Click **⋮** (more menu)
2. Select **Open MD**
3. Choose file(s)

### 3. Folder Import

Import entire folders with structure:
1. **Open MD** → Select folder
2. Subfolders become PenPage folders

## Supported Format

- Standard Markdown (\`.md\`)
- CommonMark compatible
- GitHub Flavored Markdown

## PWA File Association

If installed as PWA:
- Double-click \`.md\` files to open
- Files open directly in PenPage

## Tips

- Large files may take a moment
- Images in markdown are linked, not embedded
- UTF-8 encoding recommended
`,

    'guide-shortcuts': `# ⌨️ Keyboard Shortcuts

Speed up your workflow with these shortcuts.

## Text Formatting

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + B | **Bold** |
| Cmd/Ctrl + I | *Italic* |
| Cmd/Ctrl + E | \`Code\` |
| Cmd/Ctrl + K | Add link |

## Editing

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + A | Select all |

## Navigation

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + ↑ | Go to top |
| Cmd/Ctrl + ↓ | Go to bottom |

## Editor Mode

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + M | Toggle Markdown mode |

## Mobile Gestures

| Gesture | Action |
|---------|--------|
| Swipe left | Show sidebar |
| Swipe right | Hide sidebar |
| Double tap | Select word |

**Pro tip**: Most shortcuts work on both Mac (Cmd) and Windows/Linux (Ctrl).
`,
  },

  zh: {
    'guide-welcome': `# 👋 歡迎使用 PenPage！

真正的 Real WYSIWYG Markdown (RWM) 筆記應用程式

## 快速開始✨ 即時 Markdown 編輯

- **寫作**：隨時按 + 就可以開始打字，自動儲存
- **檔案連結**：連結本地資料夾，與檔案系統同步筆記
- 輸入 Markdown 語法，即時看到結果，無需切換預覽
    - 輸入 \`#\` + 空格 → 標題立即呈現
    - 輸入 \`**文字**\` → **粗體**即時顯示
    - 輸入 \`- \`→ 項目列表自動產生
- 全部存在你自己電腦，筆記隱私完全保護
- 拖放電腦的檔案或目錄，即可匯入全部 MD 檔，也可以一起儲存備份
- 無需安裝，免帳號，飛機上也可以使用！ 重點是 - 免費

## 為什麼選擇 PenPage？

| 特色 | PenPage |
| --- | --- |
| 🔒 隱私 | 筆記儲存在您的裝置 |
| ⚡ 免帳號 | 立即開始寫作 |
| 📴 離線 | 無需網路即可使用 |
| 💎 免費 | 免註冊，無訂閱 |

**提示**：您可以隨時刪除這個資料夾。如需重建，請清除 localStorage 中的 \`guideVersion\` 並重新載入。
`,

    'guide-editor': `# ✏️ 編輯器指南

PenPage 支援富文本編輯與 Markdown 快捷輸入。

## 文字格式

- **粗體**：\`**文字**\` 或 \`Cmd/Ctrl + B\`
- *斜體*：\`*文字*\` 或 \`Cmd/Ctrl + I\`
- ~~刪除線~~：\`~~文字~~\`
- \`行內程式碼\`：用反引號包裹

## 標題

\`# 標題 1\`
\`## 標題 2\`
\`### 標題 3\`

## 列表

項目列表：
- 項目 1
- 項目 2
  - 巢狀項目

數字列表：
1. 第一
2. 第二
3. 第三

待辦列表：
- [ ] 待辦事項
- [x] 已完成事項

## 程式碼區塊

\`\`\`javascript
function hello() {
  console.log('Hello, PenPage!')
}
\`\`\`

## 表格

| 名稱 | 角色 |
|------|------|
| Alice | 開發者 |
| Bob | 設計師 |

## 連結與圖片

- 連結：\`[文字](網址)\`
- 圖片：\`![替代文字](網址)\` 或直接貼上/拖放圖片
`,

    'guide-organize': `# 📁 整理筆記

使用資料夾保持筆記整潔。

## 建立資料夾

1. 點擊側邊欄的 **+** 按鈕
2. 輸入資料夾名稱
3. 按下 Enter

## 移動筆記

1. 點擊側邊欄的 **Edit** 按鈕
2. 選擇要移動的筆記
3. 拖放到目標資料夾

## 資料夾顏色

在編輯模式中，點擊資料夾可變更顏色。

## 刪除

- 刪除的項目會移至 **Trash**
- 垃圾桶在 30 天後自動清空
- 可從 Trash 設定中永久刪除
`,

    'guide-backup': `# 💾 備份與還原

使用本地備份保護您的筆記。

## 建立備份

1. 開啟 **設定**（齒輪圖示）
2. 點擊 **Save** 按鈕
3. 選擇儲存位置
4. 完成！將下載一個 \`.zip\` 檔案

## 從備份還原

1. 開啟 **設定**
2. 點擊 **Restore** 按鈕
3. 選擇您的備份 \`.zip\` 檔案
4. 確認還原

## 包含內容

| 資料 | 包含 |
|------|------|
| 所有筆記 | ✅ |
| 所有資料夾 | ✅ |
| 圖片 | ✅ |
| 設定 | ✅ |

## iOS 使用者

在 iOS 上，備份檔案儲存於：
- **檔案 App** → 我的 iPhone → 下載項目

或使用 **分享** 儲存至 iCloud 雲碟。

## 最佳實踐

- 定期備份（建議每週一次）
- 將備份保存在安全位置
- 偶爾測試還原功能
`,

    'guide-sync': `# 🔗 檔案連結

將筆記與本地檔案系統的資料夾同步。

## 什麼是檔案連結？

檔案連結可將 PenPage 資料夾連接到本地目錄。筆記會儲存為 \`.md\` 檔案，您可以用任何文字編輯器編輯。

## 設定

1. 在側邊欄開啟一個資料夾
2. 點擊資料夾上的**連結**圖示
3. 選擇一個本地目錄
4. 出現提示時授予權限

## 運作方式

- 筆記與連結的目錄雙向同步
- PenPage 中的變更會更新本地檔案
- 本地檔案的變更會更新 PenPage
- Pull / Push / 自動偵測同步方向

## 使用情境

- 用你喜歡的文字編輯器編輯筆記
- 用 Git 對筆記進行版本控制
- 從終端機或檔案管理員存取筆記
- 與其他工具共用資料夾（VS Code、Obsidian 等）

## 提示

- 一個目錄授權可涵蓋所有子目錄
- 已連結的資料夾在資料夾樹中會顯示藍色圖示
- 取消連結不會刪除本地檔案
`,

    'guide-import': `# 📥 匯入 Markdown

將您現有的筆記匯入 PenPage。

## 方法

### 1. 拖放

直接將 \`.md\` 檔案拖到編輯器上。

### 2. 選單匯入

1. 點擊 **⋮**（更多選單）
2. 選擇 **Open MD**
3. 選擇檔案

### 3. 資料夾匯入

匯入整個資料夾結構：
1. **Open MD** → 選擇資料夾
2. 子資料夾會變成 PenPage 資料夾

## 支援格式

- 標準 Markdown（\`.md\`）
- CommonMark 相容
- GitHub Flavored Markdown

## PWA 檔案關聯

如果安裝為 PWA：
- 雙擊 \`.md\` 檔案直接開啟
- 檔案直接在 PenPage 中開啟

## 提示

- 大檔案可能需要一點時間
- Markdown 中的圖片是連結，非嵌入
- 建議使用 UTF-8 編碼
`,

    'guide-shortcuts': `# ⌨️ 鍵盤快捷鍵

使用這些快捷鍵加速您的工作流程。

## 文字格式

| 快捷鍵 | 動作 |
|--------|------|
| Cmd/Ctrl + B | **粗體** |
| Cmd/Ctrl + I | *斜體* |
| Cmd/Ctrl + E | \`程式碼\` |
| Cmd/Ctrl + K | 新增連結 |

## 編輯

| 快捷鍵 | 動作 |
|--------|------|
| Cmd/Ctrl + Z | 復原 |
| Cmd/Ctrl + Shift + Z | 重做 |
| Cmd/Ctrl + A | 全選 |

## 導航

| 快捷鍵 | 動作 |
|--------|------|
| Cmd/Ctrl + ↑ | 跳至頂部 |
| Cmd/Ctrl + ↓ | 跳至底部 |

## 編輯器模式

| 快捷鍵 | 動作 |
|--------|------|
| Cmd/Ctrl + M | 切換 Markdown 模式 |

## 行動裝置手勢

| 手勢 | 動作 |
|------|------|
| 向左滑動 | 顯示側邊欄 |
| 向右滑動 | 隱藏側邊欄 |
| 雙擊 | 選擇字詞 |

**專業提示**：大多數快捷鍵在 Mac（Cmd）和 Windows/Linux（Ctrl）上都適用。
`,
  },
}

/**
 * 取得頁面內容
 */
function getPageContent(pageId: string): string {
  const lang = getGuideLanguage()
  return guideContent[lang][pageId as keyof typeof guideContent.en] || ''
}

/**
 * 確保示範筆記存在（主要入口）
 * Guide content 固定寫入 local workspace
 */
export async function ensureGuideContent(): Promise<void> {
  try {
    // 檢查版本
    const currentVersion = localStorage.getItem(GUIDE_VERSION_KEY)
    if (currentVersion === GUIDE_VERSION) {
      console.log('📚 Guide content up to date, skipping')
      return
    }

    // 直接使用 db('local') 寫入 guide 到 local workspace
    const localDb = db('local')

    console.log('📚 Creating/updating guide content...')
    const now = Date.now()

    // 確保資料夾存在
    let folder = await localDb.getFolder(GUIDE_FOLDER_ID)
    if (!folder) {
      // 建立資料夾
      const newFolder: Folder = {
        id: GUIDE_FOLDER_ID,
        name: GUIDE_FOLDER_NAME,
        parentId: ROOT_FOLDER_ID,
        order: 0,
        createdAt: now,
        updatedAt: now,
      }
      await localDb.createFolder(newFolder)
      console.log('📁 Created guide folder')
    }

    // 建立/更新頁面
    for (const pageDef of guidePages) {
      const content = getPageContent(pageDef.id)
      const existingPage = await localDb.getPage(pageDef.id)

      if (existingPage) {
        // 更新現有頁面
        const updatedPage: Page = {
          ...existingPage,
          name: pageDef.name,
          content,
          order: pageDef.order,
          updatedAt: now,
        }
        await localDb.updatePage(updatedPage)
      } else {
        // 建立新頁面
        const newPage: Page = {
          id: pageDef.id,
          folderId: GUIDE_FOLDER_ID,
          name: pageDef.name,
          content,
          order: pageDef.order,
          createdAt: now,
          updatedAt: now,
        }
        await localDb.createPage(newPage)
      }
    }

    // 更新版本
    localStorage.setItem(GUIDE_VERSION_KEY, GUIDE_VERSION)
    console.log('✅ Guide content created/updated successfully')
  } catch (error) {
    console.error('❌ Failed to create guide content:', error)
    // 不拋出錯誤，避免阻塞應用程式啟動
  }
}
