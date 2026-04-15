/**
 * Local ZIP Storage Adapter
 * 人類可讀備份格式：資料夾結構 + 頁面名稱作為檔名
 * V3.1（ppage-backup/）格式
 *
 * 備份結構：
 * ppage-backup/
 * ├── .ppage/
 * │   └── sync.json        (metadata)
 * ├── images/
 * │   ├── img-xxx.png
 * │   └── img-yyy.jpg
 * ├── Work/
 * │   ├── 會議筆記.md
 * │   └── 專案計畫.md
 * └── Personal/
 *     └── 日記.md
 */

import JSZip from 'jszip'
import { createLogger } from '../../../utils/logger'

const log = createLogger('BACKUP')
import { StorageAdapter, ExportData, ProgressCallback } from '../types'
import { Folder, Page, ImageData } from '../../db'
import { isRootParentId, normalizeFolderParentId } from '../../rootFolders'
import { getDeviceInfo } from '../../deviceInfo'
import {
  ImageMetadata,
  getImageExtension,
  convertToRelativePaths,
  calculateFolderDepth,
  normalizeImagePaths,
} from '../../../utils/imagePathConverter'
import { calculateContentHash } from '../../../utils/hashCalculator'
import { SyncedSettings, LastSyncedDevice } from '../../settings'

// ==================== Backup 專用類型（從 sync/serializer 精簡而來）====================

/** Page 元數據（不含 content） */
interface PageMetadata {
  id: string
  name: string
  folderId: string
  createdAt: number
  updatedAt: number
  contentHash: string
  contentSize: number
  isDeleted?: boolean
  deletedAt?: number
  deletedBy?: string
  lastSyncedAt?: number
}

/** 備份 sync.json 結構 */
interface SyncFile {
  version: '3.0'
  lastModified: number
  folders: { lastModified: number; items: Folder[] }
  pages: { lastModified: number; items: PageMetadata[] }
  images: { lastModified: number; items: (ImageMetadata & { contentHash: string })[] }
  settings: {
    lastModified: number
    data: SyncedSettings
    lastSyncedAt: number
    lastSyncedBy: LastSyncedDevice
  }
  encryption?: unknown
}

/** 將 Page[] 轉換為 PageMetadata[] */
async function pagesToMetadata(pages: Page[]): Promise<PageMetadata[]> {
  return await Promise.all(
    pages.map(async (page) => {
      const contentHash = page.contentHash || await calculateContentHash(page.content)
      const contentSize = new Blob([page.content]).size
      return {
        id: page.id,
        name: page.name,
        folderId: page.folderId,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        contentHash,
        contentSize,
        isDeleted: page.isDeleted,
        deletedAt: page.deletedAt,
        deletedBy: page.deletedBy,
        lastSyncedAt: page.lastSyncedAt,
      }
    })
  )
}

/** 生成圖片文件名 */
function getImageFileName(imageId: string, mimeType: string): string {
  const ext = getImageExtension(mimeType)
  return `${imageId}.${ext}`
}

/** 序列化 SyncFile 為 JSON */
function serializeSyncFile(syncFile: SyncFile): string {
  return JSON.stringify(syncFile, null, 2)
}

/** 反序列化 sync.json */
function deserializeSyncFile(json: string): SyncFile {
  const data = JSON.parse(json) as SyncFile
  if (data.version !== '3.0') {
    throw new Error(`Unsupported sync.json version: ${data.version}`)
  }
  return data
}

/** 從 metadata 和內容建立 Page 物件 */
function createPageFromDownload(meta: PageMetadata, content: string): Page {
  return {
    id: meta.id,
    name: meta.name,
    folderId: meta.folderId,
    content,
    contentHash: meta.contentHash,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    isDeleted: meta.isDeleted,
    deletedAt: meta.deletedAt,
    deletedBy: meta.deletedBy,
    lastSyncedAt: meta.lastSyncedAt,
  }
}

/**
 * 格式化時間戳為 yymmdd-HHmmss 格式
 */
function formatBackupTimestamp(date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const HH = String(date.getHours()).padStart(2, '0')
  const MM = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yy}${mm}${dd}-${HH}${MM}${ss}`
}

/**
 * 清理檔名中的非法字元
 */
function sanitizeFilename(name: string): string {
  // 移除 Windows/Mac/Linux 不支援的檔名字元
  return name.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'Untitled'
}

/**
 * 系統保留的根目錄名稱
 * 在 buildFolderPathCache 時會預先佔用這些名稱
 */
const RESERVED_ROOT_NAMES = ['images', '.ppage']

/**
 * 建立 folder ID → ZIP 路徑 的映射
 * 統一處理同名資料夾和系統保留名稱的衝突
 *
 * V8: parentId='root' 是 sentinel value，不是真實的 folder ID
 */
function buildFolderPathCache(folders: Folder[]): Map<string, string> {
  const cache = new Map<string, string>()
  // key: parentPath, value: Set<已使用名稱（小寫）>
  const usedNamesMap = new Map<string, Set<string>>()

  // 根目錄預先佔用系統保留名稱
  usedNamesMap.set('', new Set(RESERVED_ROOT_NAMES.map(n => n.toLowerCase())))

  // 遞迴函數：計算單一 folder 的路徑
  function computePath(folder: Folder, visited: Set<string> = new Set()): string {
    if (cache.has(folder.id)) {
      return cache.get(folder.id)!
    }

    // 防止循環參照
    if (visited.has(folder.id)) {
      log.warn(`⚠️ 循環參照: ${folder.id}`)
      return sanitizeFilename(folder.name)
    }
    visited.add(folder.id)

    // 取得父路徑
    let parentPath = ''

    // parentId='root' 是 sentinel value，這是 root folder，直接用自己名稱
    // parentId=其他 folder id 且不是自己 → 遞迴取得父路徑
    if (folder.parentId && !isRootParentId(folder.parentId) && folder.parentId !== folder.id) {
      const parent = folders.find(f => f.id === folder.parentId)
      // 允許 root folder 作為有效的 parent（isRootFolder 雖然是 system folder 但要建立路徑）
      if (parent && !parent.isDeleted && (!parent.isSystemFolder || parent.isRootFolder)) {
        parentPath = computePath(parent, visited)
      }
    }

    // 取得此層級的已使用名稱
    let usedNames = usedNamesMap.get(parentPath)
    if (!usedNames) {
      usedNames = new Set()
      usedNamesMap.set(parentPath, usedNames)
    }

    // 產生唯一名稱（使用現有的 generateUniqueFilename）
    const uniqueName = generateUniqueFilename(folder.name, usedNames)
    const fullPath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName

    cache.set(folder.id, fullPath)
    return fullPath
  }

  // 處理所有非系統、非刪除的資料夾（root folder 也要處理以建立路徑）
  for (const folder of folders) {
    if ((!folder.isSystemFolder || folder.isRootFolder) && !folder.isDeleted) {
      computePath(folder, new Set())
    }
  }

  return cache
}

/**
 * 產生唯一檔名（處理同名）
 * 同一目錄下同名檔案加後綴 (2), (3), ...
 */
function generateUniqueFilename(
  baseName: string,
  existingNames: Set<string>
): string {
  const sanitized = sanitizeFilename(baseName)
  let filename = sanitized
  let counter = 2

  while (existingNames.has(filename.toLowerCase())) {
    filename = `${sanitized} (${counter++})`
  }

  existingNames.add(filename.toLowerCase())
  return filename
}

/**
 * 建立資料夾路徑到檔名集合的映射
 * 用於追蹤每個資料夾下已使用的檔名
 */
function createFolderFilenameMap(): Map<string, Set<string>> {
  return new Map()
}

/**
 * 取得或建立資料夾的檔名集合
 */
function getOrCreateFilenameSet(
  map: Map<string, Set<string>>,
  folderPath: string
): Set<string> {
  let set = map.get(folderPath)
  if (!set) {
    set = new Set()
    map.set(folderPath, set)
  }
  return set
}

/**
 * 計算 page 在 ZIP 中的路徑
 * 返回 { folderPath, filename, fullPath }
 */
function computePageZipPath(
  page: Page,
  folderPathCache: Map<string, string>,
  folderFilenameMap: Map<string, Set<string>>
): { folderPath: string; filename: string; fullPath: string } {
  // 使用 folderPathCache 取得資料夾路徑（已處理同名衝突）
  const folderPath = page.folderId ? (folderPathCache.get(page.folderId) || '') : ''
  const filenameSet = getOrCreateFilenameSet(folderFilenameMap, folderPath)
  const filename = generateUniqueFilename(page.name, filenameSet) + '.md'

  const fullPath = folderPath ? `${folderPath}/${filename}` : filename

  return { folderPath, filename, fullPath }
}

/**
 * 建立 pageId 到 ZIP 路徑的映射表
 * 用於 sync.json 中記錄
 */
interface PagePathMapping {
  pageId: string
  zipPath: string      // 相對於 ppage-backup/ 的路徑
  folderPath: string   // 資料夾路徑
  filename: string     // 檔名（含 .md）
}

export class LocalZipAdapter implements StorageAdapter {
  name = 'Local ZIP File'

  /**
   * 保存所有數據到 ZIP 文件（V3.1 格式）
   */
  async saveAll(data: ExportData, onProgress?: ProgressCallback): Promise<void> {
    try {
      const totalSteps = 4 + data.pages.length + data.images.length
      let currentStep = 0

      const deviceInfo = await getDeviceInfo()

      // 創建 ZIP 文件
      const zip = new JSZip()
      const rootFolder = zip.folder('ppage-backup')!
      const ppageFolder = rootFolder.folder('.ppage')!
      const imagesFolder = rootFolder.folder('images')!

      // 1. 先計算所有 page 的路徑
      onProgress?.(++currentStep, totalSteps, 'Computing file paths...')

      // 建立 folder ID → ZIP 路徑 的映射（處理同名資料夾和保留名稱衝突）
      const folderPathCache = buildFolderPathCache(data.folders)
      const folderFilenameMap = createFolderFilenameMap()
      const pagePathMappings: PagePathMapping[] = []

      for (const page of data.pages) {
        const { folderPath, filename, fullPath } = computePageZipPath(
          page,
          folderPathCache,
          folderFilenameMap
        )
        pagePathMappings.push({
          pageId: page.id,
          zipPath: fullPath,
          folderPath,
          filename,
        })
      }

      // 2. 建立 SyncFile（V3.1 格式，包含路徑映射）
      onProgress?.(++currentStep, totalSteps, 'Building sync.json...')

      const pagesMetadata = await pagesToMetadata(data.pages)

      // 為每個 page metadata 加上 zipPath
      const pagesMetadataWithPath = pagesMetadata.map(meta => {
        const mapping = pagePathMappings.find(m => m.pageId === meta.id)
        return {
          ...meta,
          zipPath: mapping?.zipPath || `${meta.id}.md`,
        }
      })

      const imagesMetadata = data.imageMetadata.map(img => ({
        id: img.id,
        filename: img.filename,
        mimeType: img.mimeType,
        size: img.size,
        createdAt: img.createdAt,
        contentHash: img.contentHash
      }))

      const now = Date.now()

      // V3.1 SyncFile（與 V3 相容，但 pages.items 多了 zipPath 欄位）
      const syncFile: SyncFile & { sourceWorkspace?: string } = {
        version: '3.0',
        sourceWorkspace: data.sourceWorkspace,
        lastModified: now,
        folders: {
          lastModified: now,
          items: data.folders
        },
        pages: {
          lastModified: now,
          items: pagesMetadataWithPath as PageMetadata[]
        },
        images: {
          lastModified: now,
          items: imagesMetadata
        },
        settings: {
          lastModified: data.settings.updatedAt,
          data: data.settings,
          lastSyncedAt: now,
          lastSyncedBy: {
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            ip: deviceInfo.ip
          }
        },
      }

      // 添加 sync.json 到 .ppage/ 目錄
      ppageFolder.file('sync.json', serializeSyncFile(syncFile))

      // 建立 imageMetadata Map（用於圖片路徑轉換時取得副檔名）
      const imageMetadataMap = new Map<string, ImageMetadata>()
      for (const img of imagesMetadata) {
        imageMetadataMap.set(img.id, img)
      }

      // 3. 添加每個 page 的內容（使用計算好的路徑）
      for (let i = 0; i < data.pages.length; i++) {
        const page = data.pages[i]
        const mapping = pagePathMappings.find(m => m.pageId === page.id)

        onProgress?.(
          ++currentStep,
          totalSteps,
          `Packing page: ${page.name} (${i + 1}/${data.pages.length})`
        )

        if (mapping) {
          let content = page.content

          // 轉換圖片路徑為相對路徑（讓外部編輯器可顯示圖片）
          const folderDepth = calculateFolderDepth(mapping.folderPath)
          content = convertToRelativePaths(content, folderDepth, imageMetadataMap)

          rootFolder.file(mapping.zipPath, content)
        }
      }

      // 4. 添加每個圖片文件
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i]
        onProgress?.(
          ++currentStep,
          totalSteps,
          `Packing image: ${img.filename} (${i + 1}/${data.images.length})`
        )
        const filename = getImageFileName(img.id, img.mimeType)
        imagesFolder.file(filename, img.blob)
      }

      // 5. 生成 ZIP 文件
      onProgress?.(currentStep, totalSteps, 'Generating backup file...')
      const blob = await zip.generateAsync({ type: 'blob' })

      // 6. 下載文件
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ppage-${formatBackupTimestamp()}.ppx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onProgress?.(totalSteps, totalSteps, '✅ Export complete!')
    } catch (error) {
      log.error('LocalZipAdapter saveAll failed:', error)
      throw new Error(`Failed to save ZIP: ${(error as Error).message}`)
    }
  }

  /**
   * 從 ZIP 文件載入所有數據（V3.1 格式）
   * 支援新格式（ppage-backup/）和舊格式（ppage-app/）自動偵測
   */
  async loadAll(onProgress?: ProgressCallback): Promise<ExportData> {
    return new Promise((resolve, reject) => {
      // 創建文件選擇器
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.ppx,.zip'

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) {
            reject(new Error('No file selected'))
            return
          }

          onProgress?.(0, 100, 'Reading backup file...')

          // 解析 ZIP 文件
          const zip = await JSZip.loadAsync(file)

          // V3.1 格式 (ppage-backup/)
          const rootFolder = zip.folder('ppage-backup')

          if (!rootFolder || !rootFolder.file('.ppage/sync.json')) {
            reject(new Error('Invalid backup file: missing ppage-backup folder'))
            return
          }

          onProgress?.(10, 100, 'Reading sync.json...')

          // 讀取 sync.json
          const syncJsonFile = rootFolder.file('.ppage/sync.json')

          if (!syncJsonFile) {
            reject(new Error('Invalid backup file: missing .ppage/sync.json'))
            return
          }

          const syncJsonText = await syncJsonFile.async('text')
          const syncFile = deserializeSyncFile(syncJsonText) as SyncFile & { sourceWorkspace?: string }

          // 過濾已刪除的項目，並標準化 parentId（使用共用純函數）
          const folders = syncFile.folders.items
            .filter(f => !f.isDeleted)
            .map(normalizeFolderParentId)
          const pagesMetadata = syncFile.pages.items.filter(p => !p.isDeleted)
          const imageMetadata = syncFile.images.items

          onProgress?.(20, 100, 'Reading page contents...')

          // 讀取 page 內容
          let pages: Page[]

          // V3.1 格式：使用 zipPath 定位檔案
          pages = await this.loadPages(rootFolder, pagesMetadata, syncFile.folders.items)

          onProgress?.(50, 100, 'Reading images...')

          // 讀取 images
          const imagesFolder = rootFolder.folder('images')
          let images: ImageData[] = []

          if (imagesFolder && imageMetadata.length > 0) {
            const imageFiles: { [imageId: string]: JSZip.JSZipObject } = {}
            imagesFolder.forEach((relativePath, file) => {
              const imageId = relativePath.split('.')[0]
              imageFiles[imageId] = file
            })

            images = await Promise.all(
              imageMetadata.map(async (meta) => {
                const imageFile = imageFiles[meta.id]
                if (!imageFile) {
                  log.warn(`Missing image file: ${meta.id}`)
                  return null
                }

                const blob = await imageFile.async('blob')

                return {
                  id: meta.id,
                  blob: blob,
                  filename: meta.filename,
                  mimeType: meta.mimeType,
                  size: meta.size,
                  createdAt: meta.createdAt,
                }
              })
            ).then((results) => results.filter((img): img is ImageData => img !== null))
          }

          onProgress?.(100, 100, '✅ Backup file loaded successfully')

          resolve({
            folders,
            pages,
            images,
            imageMetadata,
            settings: {
              ...syncFile.settings.data,
              showLineNumbers: syncFile.settings.data.showLineNumbers ?? false,
              desktopInterfaceFontSize: syncFile.settings.data.desktopInterfaceFontSize ?? 18,
              desktopContentFontSize: syncFile.settings.data.desktopContentFontSize ?? 18,
              mobileInterfaceFontSize: syncFile.settings.data.mobileInterfaceFontSize ?? 24,
              mobileContentFontSize: syncFile.settings.data.mobileContentFontSize ?? 24,
            },
            sourceWorkspace: syncFile.sourceWorkspace as 'local' | undefined,
          })
        } catch (error) {
          log.error('LocalZipAdapter loadAll failed:', error)
          reject(new Error(`Failed to load ZIP: ${(error as Error).message}`))
        }
      }

      input.click()
    })
  }

  /**
   * V3.1 格式：使用 zipPath 或 contentHash 定位檔案
   * 優先使用 zipPath，fallback 使用 contentHash 精確匹配
   */
  private async loadPages(
    rootFolder: JSZip,
    pagesMetadata: PageMetadata[],
    _folders: Folder[]  // 保留參數以便未來擴展
  ): Promise<Page[]> {
    // 建立所有 .md 檔案的索引（相對路徑 -> JSZip 物件）
    const mdFiles: Map<string, JSZip.JSZipObject> = new Map()

    rootFolder.forEach((relativePath, file) => {
      if (relativePath.endsWith('.md') && !relativePath.startsWith('.ppage/')) {
        mdFiles.set(relativePath, file)
      }
    })

    // 預先建立 contentHash → content 的索引（用於 fallback 匹配）
    // 只在有 metadata 缺少 zipPath 時才建立索引，避免不必要的計算
    const needsFallback = pagesMetadata.some(meta => !(meta as any).zipPath)
    const contentHashIndex: Map<string, string> = new Map()

    if (needsFallback) {
      // 並行讀取所有 .md 檔案並計算 hash
      const entries = Array.from(mdFiles.entries())
      await Promise.all(
        entries.map(async ([, file]) => {
          const content = await file.async('text')
          // 標準化圖片路徑後計算 hash（與匯出時一致）
          const normalizedContent = normalizeImagePaths(content)
          const hash = await calculateContentHash(normalizedContent)
          contentHashIndex.set(hash, content)
        })
      )
    }

    const pages: Page[] = await Promise.all(
      pagesMetadata.map(async (meta) => {
        // 優先使用 zipPath（V3.1 新增欄位）
        const zipPath = (meta as any).zipPath as string | undefined
        let fileContent: string | null = null

        if (zipPath && mdFiles.has(zipPath)) {
          const file = mdFiles.get(zipPath)!
          fileContent = await file.async('text')
        } else {
          // Fallback: 使用 contentHash 精確匹配
          const matchedContent = contentHashIndex.get(meta.contentHash)
          if (matchedContent) {
            fileContent = matchedContent
          }
        }

        if (fileContent === null) {
          throw new Error(`Missing page content for: ${meta.name} (${meta.id})`)
        }

        // 標準化圖片路徑（相對路徑 → image://）
        const normalizedContent = normalizeImagePaths(fileContent)

        return createPageFromDownload(meta, normalizedContent)
      })
    )

    return pages
  }

  /**
   * 檢查是否可用
   */
  async isAvailable(): Promise<boolean> {
    return true
  }
}
