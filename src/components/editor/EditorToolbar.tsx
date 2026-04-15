import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { useOrientation } from '../../contexts/OrientationContext'
import { ChevronLeft } from '../icons/ChevronIcons'
import {
  UndoIcon,
  RedoIcon,
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  FontAIcon,
  H1Icon,
  H2Icon,
  H3Icon,
  BulletListIcon,
  OrderedListIcon,
  CheckboxIcon,
  QuoteIcon,
  CodeIcon,
  HRIcon,
  EmojiIcon,
  TableIcon,
  TableInsertIcon,
  RowInsertAboveIcon,
  RowInsertBelowIcon,
  RowDeleteIcon,
  ColumnInsertLeftIcon,
  ColumnInsertRightIcon,
  ColumnDeleteIcon,
  TableDeleteIcon,
  LinkIcon,
  ImageIcon,
  IndentIcon,
  OutdentIcon
} from '../icons/ToolbarIcons'

interface EditorToolbarProps {
  editor: Editor | null
  isMarkdownMode: boolean
  isReadOnly: boolean
  /** MD 按鈕顯示狀態（四態：unsaved/pending/syncing/synced） */
  syncStatus: 'unsaved' | 'pending' | 'syncing' | 'synced'
  onToggleMarkdownMode: () => void
  onOpenLinkDialog: () => void
  onMobileBack?: () => void  // Mobile 返回上一頁
  showLandscapeBack?: boolean  // Landscape LE 模式顯示返回按鈕
  onLandscapeBack?: () => void  // Landscape 返回 callback
  onImageUpload?: (file: File) => void  // 圖片上傳 callback
}

/**
 * 取得游標最接近的列表資訊
 * 返回列表類型和其在文檔中的位置
 */
const getClosestListInfo = (editor: Editor): {
  type: 'bulletList' | 'orderedList' | 'taskList' | null
  depth: number
  pos: number
  node: ProseMirrorNode | null
} => {
  const { $from } = editor.state.selection

  // 從當前位置往上找，找到第一個列表節點
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList' || node.type.name === 'taskList') {
      return {
        type: node.type.name as 'bulletList' | 'orderedList' | 'taskList',
        depth,
        pos: $from.before(depth),
        node
      }
    }
  }

  return { type: null, depth: 0, pos: 0, node: null }
}

/**
 * 自訂列表類型切換函數
 * 在巢狀列表中，只轉換當前層級的列表，不影響父層級
 */
// 縮排列表項目（支援 listItem 和 taskItem）
const indentListItem = (editor: Editor) => {
  if (editor.can().sinkListItem('taskItem')) {
    editor.chain().focus().sinkListItem('taskItem').run()
  } else if (editor.can().sinkListItem('listItem')) {
    editor.chain().focus().sinkListItem('listItem').run()
  }
}

// 取消縮排列表項目
const outdentListItem = (editor: Editor) => {
  if (editor.can().liftListItem('taskItem')) {
    editor.chain().focus().liftListItem('taskItem').run()
  } else if (editor.can().liftListItem('listItem')) {
    editor.chain().focus().liftListItem('listItem').run()
  }
}

const switchListType = (
  editor: Editor,
  targetType: 'bulletList' | 'orderedList' | 'taskList'
) => {
  const listInfo = getClosestListInfo(editor)

  // 如果不在任何列表中，使用原生 toggle
  if (!listInfo.type) {
    if (targetType === 'bulletList') {
      editor.chain().focus().toggleBulletList().run()
    } else if (targetType === 'orderedList') {
      editor.chain().focus().toggleOrderedList().run()
    } else {
      editor.chain().focus().toggleTaskList().run()
    }
    return
  }

  // 如果當前已經是目標類型，取消列表（lift out）
  if (listInfo.type === targetType) {
    if (targetType === 'bulletList') {
      editor.chain().focus().toggleBulletList().run()
    } else if (targetType === 'orderedList') {
      editor.chain().focus().toggleOrderedList().run()
    } else {
      editor.chain().focus().toggleTaskList().run()
    }
    return
  }

  // 在巢狀列表中切換類型：使用 ProseMirror 直接替換節點類型
  const { state, view } = editor
  const { tr } = state
  const { pos, node } = listInfo

  if (!node) return

  // 記錄當前游標相對於列表開始位置的偏移量
  const { $from } = state.selection
  const cursorOffsetInList = $from.pos - pos

  // 獲取目標列表類型
  const newListType = state.schema.nodes[targetType]
  if (!newListType) return

  // 獲取對應的列表項類型
  const newItemType = targetType === 'taskList'
    ? state.schema.nodes.taskItem
    : state.schema.nodes.listItem

  if (!newItemType) return

  // 創建新的列表內容（轉換每個列表項）
  const newContent: ProseMirrorNode[] = []

  node.forEach((child) => {
    if (child.type.name === 'listItem' || child.type.name === 'taskItem') {
      // 轉換列表項類型
      const attrs = targetType === 'taskList' ? { checked: false } : {}
      const newItem = newItemType.create(attrs, child.content, child.marks)
      newContent.push(newItem)
    }
  })

  // 創建新的列表節點
  const newList = newListType.create(null, newContent)

  // 替換舊列表
  tr.replaceWith(pos, pos + node.nodeSize, newList)

  // 計算新的游標位置：列表開始位置 + 相對偏移量
  // 需要確保位置在有效範圍內
  const newCursorPos = Math.min(pos + cursorOffsetInList, pos + newList.nodeSize - 1)
  const validPos = Math.max(pos + 1, newCursorPos)

  // 設定游標位置
  tr.setSelection(TextSelection.near(tr.doc.resolve(validPos)))

  // 應用變更
  view.dispatch(tr)
  editor.commands.focus()
}

export const EditorToolbar = ({
  editor,
  isMarkdownMode,
  isReadOnly,
  syncStatus,
  onToggleMarkdownMode,
  onOpenLinkDialog,
  onMobileBack,
  showLandscapeBack,
  onLandscapeBack,
  onImageUpload
}: EditorToolbarProps) => {
  // 使用 OrientationContext 取代本地 state
  const { isPortraitMode } = useOrientation()
  const imageInputRef = useRef<HTMLInputElement>(null)

  // 下拉選單狀態
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showEmojiMenu, setShowEmojiMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  // Portrait 底部 Toolbar 群組選單
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [showParaMenu, setShowParaMenu] = useState(false)
  const [showInsertMenu, setShowInsertMenu] = useState(false)

  // 點擊外部關閉所有下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.toolbar-dropdown')) {
        setShowTableMenu(false)
        setShowEmojiMenu(false)
        setShowColorMenu(false)
        // Portrait 底部 Toolbar 群組選單
        setShowEditMenu(false)
        setShowFontMenu(false)
        setShowParaMenu(false)
        setShowInsertMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!editor) return null

  // 取得最接近的列表類型，用於正確顯示按鈕狀態
  const closestListInfo = getClosestListInfo(editor)
  const closestListType = closestListInfo.type

  // 關閉所有選單
  const closeAllMenus = () => {
    setShowTableMenu(false)
    setShowEmojiMenu(false)
    setShowColorMenu(false)
    // Portrait 底部 Toolbar 群組選單
    setShowEditMenu(false)
    setShowFontMenu(false)
    setShowParaMenu(false)
    setShowInsertMenu(false)
  }

  // 常用 Emoji 列表（擴充版）
  const commonEmojis = [
    // 表情
    '😀', '😊', '😂', '🤔', '😍', '😎', '🥳', '😢',
    '😅', '🙂', '😉', '😌', '🤗', '😏', '🤭', '😬',
    // 手勢
    '👍', '👎', '👋', '🙏', '💪', '👏', '🤝', '✌️',
    '👌', '🤞', '🤙', '👊', '✋', '🖐️', '👆', '👇',
    // 符號
    '❤️', '⭐', '✅', '❌', '💡', '🔥', '⚡', '💯',
    '⚠️', '🔴', '🟢', '🔵', '⏰', '🎉', '✨', '💎',
    // 物品
    '📝', '📌', '📎', '🎯', '🏆', '💻', '📱', '🔒',
    '📁', '📂', '📊', '📈', '🗂️', '📋', '🔗', '💾'
  ]

  // 插入 Emoji
  const insertEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run()
    closeAllMenus()
  }

  // 文字顏色列表
  const textColors = [
    { name: 'Default', value: '' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Gray', value: '#6b7280' },
  ]

  // 設定文字顏色
  const setTextColor = (color: string) => {
    if (color === '') {
      editor.chain().focus().unsetColor().run()
    } else {
      editor.chain().focus().setColor(color).run()
    }
    closeAllMenus()
  }

  // 取得目前文字顏色
  const currentColor = editor.getAttributes('textStyle').color || ''

  // 隱藏的圖片選擇 input（PE 和 Desktop 共用）
  const imageInput = (
    <input
      ref={imageInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (file) onImageUpload?.(file)
        e.target.value = ''
      }}
    />
  )

  // ========== Mobile Portrait 版 Toolbar（頂部：返回 + MD + 6 組群組按鈕）==========
  if (isPortraitMode) {
    return (
      <div className="toolbar toolbar-mobile">
        {imageInput}
        {/* 返回按鈕 */}
        <button
          className="toolbar-button toolbar-back-btn"
          onClick={onMobileBack}
          title="返回"
        >
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>

        {/* MD 切換按鈕（包在 dropdown 容器內以統一寬度） */}
        <div className="toolbar-dropdown">
          <button
            onClick={onToggleMarkdownMode}
            className={`toolbar-button toolbar-button-md ${isMarkdownMode ? 'is-active' : ''} status-${syncStatus}`}
            title={isMarkdownMode ? 'Switch to WYSIWYG mode' : 'Switch to Markdown source mode'}
          >
            MD
          </button>
        </div>

        {/* 1. Undo/Redo Group */}
        <div className="toolbar-dropdown">
          <button
            onClick={() => {
              closeAllMenus()
              setShowEditMenu(!showEditMenu)
            }}
            className="toolbar-button toolbar-group-btn"
            title="Undo/Redo"
          >
            <UndoIcon size={22} />
          </button>
          {showEditMenu && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => { editor.chain().focus().undo().run(); closeAllMenus() }}
                disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().undo().run()}
                title="Undo"
              >
                <UndoIcon size={28} />
              </button>
              <button
                className="dropdown-item"
                onClick={() => { editor.chain().focus().redo().run(); closeAllMenus() }}
                disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().redo().run()}
                title="Redo"
              >
                <RedoIcon size={28} />
              </button>
            </div>
          )}
        </div>

        {/* 2. Font Group - H1, H2, H3, B, I, S, Color */}
        <div className="toolbar-dropdown">
          <button
            onClick={() => {
              closeAllMenus()
              setShowFontMenu(!showFontMenu)
            }}
            disabled={isMarkdownMode || isReadOnly}
            className={`toolbar-button toolbar-group-btn ${editor.isActive('heading') || editor.isActive('bold') || editor.isActive('italic') || editor.isActive('strike') ? 'is-active' : ''}`}
            title="Font"
          >
            <FontAIcon size={22} />
          </button>
          {showFontMenu && !isMarkdownMode && (
            <div className="dropdown-menu dropdown-menu-font">
              {/* 第一排：H1 H2 H3 */}
              <div className="dropdown-row">
                <button
                  className={`dropdown-item ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); closeAllMenus() }}
                  title="Heading 1"
                >
                  <H1Icon size={28} />
                </button>
                <button
                  className={`dropdown-item ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); closeAllMenus() }}
                  title="Heading 2"
                >
                  <H2Icon size={28} />
                </button>
                <button
                  className={`dropdown-item ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); closeAllMenus() }}
                  title="Heading 3"
                >
                  <H3Icon size={28} />
                </button>
              </div>
              {/* 第二排：B I S */}
              <div className="dropdown-row">
                <button
                  className={`dropdown-item ${editor.isActive('bold') ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleBold().run(); closeAllMenus() }}
                  title="Bold"
                >
                  <BoldIcon size={28} />
                </button>
                <button
                  className={`dropdown-item ${editor.isActive('italic') ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleItalic().run(); closeAllMenus() }}
                  title="Italic"
                >
                  <ItalicIcon size={28} />
                </button>
                <button
                  className={`dropdown-item ${editor.isActive('strike') ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleStrike().run(); closeAllMenus() }}
                  title="Strikethrough"
                >
                  <StrikethroughIcon size={28} />
                </button>
              </div>
              {/* 第三排：顏色 */}
              <div className="dropdown-color-row">
                {textColors.map((color, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`color-dot ${currentColor === color.value ? 'is-active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTextColor(color.value) }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setTextColor(color.value) }}
                    title={color.name}
                    style={{
                      backgroundColor: color.value || 'var(--text-primary)',
                      border: color.value === '' ? '2px solid var(--border)' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Para Group - Checkbox, Bullet, Numbered, Code, Quote */}
        <div className="toolbar-dropdown">
          <button
            onClick={() => {
              closeAllMenus()
              setShowParaMenu(!showParaMenu)
            }}
            disabled={isMarkdownMode || isReadOnly}
            className={`toolbar-button toolbar-group-btn ${closestListType || editor.isActive('codeBlock') || editor.isActive('blockquote') ? 'is-active' : ''}`}
            title="Paragraph"
          >
            <CheckboxIcon size={22} />
          </button>
          {showParaMenu && !isMarkdownMode && (
            <div className="dropdown-menu dropdown-menu-para">
              {/* 第一排：Checkbox, Bullet, Numbered */}
              <div className="dropdown-row">
                <button
                  className={`dropdown-item ${closestListType === 'taskList' ? 'is-active' : ''}`}
                  onClick={() => { switchListType(editor, 'taskList'); closeAllMenus() }}
                  title="Task List"
                >
                  <CheckboxIcon size={28} />
                </button>
                <button
                  className={`dropdown-item ${closestListType === 'bulletList' ? 'is-active' : ''}`}
                  onClick={() => { switchListType(editor, 'bulletList'); closeAllMenus() }}
                  title="Bullet List"
                >
                  <BulletListIcon size={28} />
                </button>
                <button
                  className={`dropdown-item ${closestListType === 'orderedList' ? 'is-active' : ''}`}
                  onClick={() => { switchListType(editor, 'orderedList'); closeAllMenus() }}
                  title="Numbered List"
                >
                  <OrderedListIcon size={28} />
                </button>
              </div>
              {/* 第二排：Quote, Code */}
              <div className="dropdown-row">
                <button
                  className={`dropdown-item ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleBlockquote().run(); closeAllMenus() }}
                  title="Quote"
                >
                  <QuoteIcon size={28} />
                </button>
                <button
                  className={`dropdown-item ${editor.isActive('codeBlock') ? 'is-active' : ''}`}
                  onClick={() => { editor.chain().focus().toggleCodeBlock().run(); closeAllMenus() }}
                  title="Code Block"
                >
                  <CodeIcon size={28} />
                </button>
              </div>
              {/* 第三排：Outdent, Indent（僅在列表內顯示） */}
              {closestListType && (
                <div className="dropdown-row">
                  <button
                    className="dropdown-item"
                    onClick={() => outdentListItem(editor)}
                    disabled={!editor.can().liftListItem('listItem') && !editor.can().liftListItem('taskItem')}
                    title="Outdent"
                  >
                    <OutdentIcon size={28} />
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => indentListItem(editor)}
                    disabled={!editor.can().sinkListItem('listItem') && !editor.can().sinkListItem('taskItem')}
                    title="Indent"
                  >
                    <IndentIcon size={28} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Insert Group - 整合 HR, Image, Link, Emoji, Table（二階段展開） */}
        <div className="toolbar-dropdown dropdown-right">
          <button
            onClick={() => {
              closeAllMenus()
              setShowInsertMenu(!showInsertMenu)
            }}
            disabled={isMarkdownMode || isReadOnly}
            className={`toolbar-button toolbar-group-btn ${editor.isActive('link') ? 'is-active' : ''}`}
            title="Insert"
          >
            <EmojiIcon size={22} />
          </button>
          {showInsertMenu && !isMarkdownMode && (
            <div className="dropdown-menu dropdown-menu-insert">
              {/* 一階主選項（兩排布局） */}
              {!showEmojiMenu && !showTableMenu && (
                <>
                  {/* 第一排：HR, Image, Link */}
                  <div className="dropdown-row">
                    <button
                      className="dropdown-item"
                      onClick={() => { editor.chain().focus().setHorizontalRule().run(); closeAllMenus() }}
                      title="Horizontal Rule"
                    >
                      <HRIcon size={28} />
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        imageInputRef.current?.click()
                        closeAllMenus()
                      }}
                      title="Image"
                    >
                      <ImageIcon size={28} />
                    </button>
                    <button
                      className={`dropdown-item ${editor.isActive('link') ? 'is-active' : ''}`}
                      onClick={() => { onOpenLinkDialog(); closeAllMenus() }}
                      title="Link"
                    >
                      <LinkIcon size={28} />
                    </button>
                  </div>
                  {/* 第二排：Emoji, Table */}
                  <div className="dropdown-row">
                    <button
                      className="dropdown-item"
                      onClick={() => setShowEmojiMenu(true)}
                      title="Emoji"
                    >
                      <EmojiIcon size={28} />
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => setShowTableMenu(true)}
                      title="Table"
                    >
                      <TableIcon size={28} />
                    </button>
                  </div>
                </>
              )}
              {/* 二階：Emoji Grid */}
              {showEmojiMenu && (
                <div className="insert-submenu">
                  <button
                    className="submenu-back"
                    onClick={() => setShowEmojiMenu(false)}
                    title="Back"
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <div className="emoji-grid">
                    {commonEmojis.map((emoji, index) => (
                      <button
                        key={index}
                        className="emoji-item"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 二階：Table 操作 */}
              {showTableMenu && (
                <div className="insert-submenu">
                  <button
                    className="submenu-back"
                    onClick={() => setShowTableMenu(false)}
                    title="Back"
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <div className="table-grid">
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        editor.chain().focus().insertContent({
                          type: 'table',
                          content: [
                            {
                              type: 'tableRow',
                              content: [
                                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header 1' }] }] },
                                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header 2' }] }] },
                              ],
                            },
                            {
                              type: 'tableRow',
                              content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
                              ],
                            },
                            {
                              type: 'tableRow',
                              content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 3' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 4' }] }] },
                              ],
                            },
                          ],
                        }).run()
                        closeAllMenus()
                      }}
                      title="Insert Table"
                    >
                      <TableInsertIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().addRowBefore().run(); closeAllMenus() }} title="Row Above">
                      <RowInsertAboveIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().addRowAfter().run(); closeAllMenus() }} title="Row Below">
                      <RowInsertBelowIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().deleteRow().run(); closeAllMenus() }} title="Delete Row">
                      <RowDeleteIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().addColumnBefore().run(); closeAllMenus() }} title="Column Left">
                      <ColumnInsertLeftIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().addColumnAfter().run(); closeAllMenus() }} title="Column Right">
                      <ColumnInsertRightIcon size={28} />
                    </button>
                    <button className="dropdown-item" onClick={() => { editor.chain().focus().deleteColumn().run(); closeAllMenus() }} title="Delete Column">
                      <ColumnDeleteIcon size={28} />
                    </button>
                    <button className="dropdown-item dropdown-item-danger" onClick={() => { editor.chain().focus().deleteTable().run(); closeAllMenus() }} title="Delete Table">
                      <TableDeleteIcon size={28} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ========== Desktop 版 Toolbar（保持原樣，所有獨立按鈕）==========
  return (
    <div className="toolbar">
      {/* Landscape LE 模式：顯示返回按鈕 */}
      {showLandscapeBack && (
        <button
          className="toolbar-back-btn-desktop"
          onClick={onLandscapeBack}
          title="顯示 Page List"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}

      <button
        onClick={onToggleMarkdownMode}
        className={`toolbar-button toolbar-button-md ${isMarkdownMode ? 'is-active' : ''} status-${syncStatus}`}
        title={isMarkdownMode ? 'Switch to WYSIWYG mode' : 'Switch to Markdown source mode'}
      >
        MD⬇
      </button>

      {/* Undo/Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().undo().run()}
        className="toolbar-button"
        title="Undo (Ctrl+Z)"
      >
        <UndoIcon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().redo().run()}
        className="toolbar-button"
        title="Redo (Ctrl+Shift+Z)"
      >
        <RedoIcon size={20} />
      </button>

      <div className="toolbar-divider"></div>

      {/* Text formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Bold (Ctrl+B)"
      >
        <BoldIcon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Italic (Ctrl+I)"
      >
        <ItalicIcon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={isMarkdownMode || isReadOnly || !editor.can().chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Strikethrough (Ctrl+Shift+S)"
      >
        <StrikethroughIcon size={20} />
      </button>

      {/* Text Color 下拉選單 */}
      <div className="toolbar-dropdown">
        <button
          onClick={() => {
            closeAllMenus()
            setShowColorMenu(!showColorMenu)
          }}
          disabled={isMarkdownMode || isReadOnly}
          className="toolbar-button"
          title="Text Color"
        >
          <span
            className="color-circle-btn"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: currentColor || 'var(--text-primary)',
              border: currentColor ? 'none' : '2px solid var(--border)',
              display: 'inline-block'
            }}
          />
        </button>
        {showColorMenu && !isMarkdownMode && (
          <div className="dropdown-menu color-menu">
            <div className="color-grid">
              {textColors.map((color, index) => (
                <button
                  key={index}
                  className={`color-item ${currentColor === color.value ? 'is-active' : ''}`}
                  onClick={() => setTextColor(color.value)}
                  title={color.name}
                  style={{
                    backgroundColor: color.value || 'transparent',
                    border: color.value === '' ? '2px dashed var(--border)' : 'none'
                  }}
                >
                  {color.value === '' && <span style={{ fontSize: '10px' }}>✕</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('heading', { level: 1 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 1"
      >
        <H1Icon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('heading', { level: 2 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 2"
      >
        <H2Icon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('heading', { level: 3 }) ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Heading 3"
      >
        <H3Icon size={20} />
      </button>

      <div className="toolbar-divider"></div>

      {/* Lists - 使用自訂 switchListType 保持巢狀結構 */}
      <button
        onClick={() => switchListType(editor, 'taskList')}
        disabled={isMarkdownMode || isReadOnly}
        className={closestListType === 'taskList' ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Task List"
      >
        <CheckboxIcon size={20} />
      </button>
      <button
        onClick={() => switchListType(editor, 'bulletList')}
        disabled={isMarkdownMode || isReadOnly}
        className={closestListType === 'bulletList' ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Bullet List"
      >
        <BulletListIcon size={20} />
      </button>
      <button
        onClick={() => switchListType(editor, 'orderedList')}
        disabled={isMarkdownMode || isReadOnly}
        className={closestListType === 'orderedList' ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Ordered List"
      >
        <OrderedListIcon size={20} />
      </button>
      {closestListType && (
        <>
          <button
            onClick={() => outdentListItem(editor)}
            disabled={isMarkdownMode || isReadOnly || (!editor.can().liftListItem('listItem') && !editor.can().liftListItem('taskItem'))}
            className="toolbar-button"
            title="Outdent (Shift+Tab)"
          >
            <OutdentIcon size={20} />
          </button>
          <button
            onClick={() => indentListItem(editor)}
            disabled={isMarkdownMode || isReadOnly || (!editor.can().sinkListItem('listItem') && !editor.can().sinkListItem('taskItem'))}
            className="toolbar-button"
            title="Indent (Tab)"
          >
            <IndentIcon size={20} />
          </button>
        </>
      )}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('blockquote') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Quote"
      >
        <QuoteIcon size={20} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('codeBlock') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Code Block"
      >
        <CodeIcon size={20} />
      </button>

      <div className="toolbar-divider"></div>

      {/* Extra */}
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={isMarkdownMode || isReadOnly}
        className="toolbar-button"
        title="Horizontal Rule"
      >
        <HRIcon size={20} />
      </button>

      {/* Image */}
      {imageInput}
      <button
        onClick={() => imageInputRef.current?.click()}
        disabled={isMarkdownMode || isReadOnly}
        className="toolbar-button"
        title="Insert Image"
      >
        <ImageIcon size={20} />
      </button>

      {/* Emoji 下拉選單 */}
      <div className="toolbar-dropdown">
        <button
          onClick={() => {
            closeAllMenus()
            setShowEmojiMenu(!showEmojiMenu)
          }}
          disabled={isMarkdownMode || isReadOnly}
          className="toolbar-button"
          title="Insert Emoji"
        >
          <EmojiIcon size={20} />
        </button>
        {showEmojiMenu && !isMarkdownMode && (
          <div className="dropdown-menu emoji-menu">
            <div className="emoji-grid">
              {commonEmojis.map((emoji, index) => (
                <button
                  key={index}
                  className="emoji-item"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table 下拉選單 */}
      <div className="toolbar-dropdown">
        <button
          onClick={() => setShowTableMenu(!showTableMenu)}
          disabled={isMarkdownMode || isReadOnly}
          className="toolbar-button"
          title="Table Operations"
        >
          <TableIcon size={20} />
        </button>
        {showTableMenu && !isMarkdownMode && (
          <div className="dropdown-menu">
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().insertContent({
                  type: 'table',
                  content: [
                    {
                      type: 'tableRow',
                      content: [
                        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header 1' }] }] },
                        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header 2' }] }] },
                      ],
                    },
                    {
                      type: 'tableRow',
                      content: [
                        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
                        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
                      ],
                    },
                    {
                      type: 'tableRow',
                      content: [
                        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 3' }] }] },
                        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 4' }] }] },
                      ],
                    },
                  ],
                }).run()
                setShowTableMenu(false)
              }}
            >
              <TableInsertIcon size={28} />
            </button>
            <div className="dropdown-divider"></div>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().addRowBefore().run()
                setShowTableMenu(false)
              }}
            >
              <RowInsertAboveIcon size={28} />
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().addRowAfter().run()
                setShowTableMenu(false)
              }}
            >
              <RowInsertBelowIcon size={28} />
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().deleteRow().run()
                setShowTableMenu(false)
              }}
            >
              <RowDeleteIcon size={28} />
            </button>
            <div className="dropdown-divider"></div>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().addColumnBefore().run()
                setShowTableMenu(false)
              }}
            >
              <ColumnInsertLeftIcon size={28} />
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().addColumnAfter().run()
                setShowTableMenu(false)
              }}
            >
              <ColumnInsertRightIcon size={28} />
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                editor.chain().focus().deleteColumn().run()
                setShowTableMenu(false)
              }}
            >
              <ColumnDeleteIcon size={28} />
            </button>
            <div className="dropdown-divider"></div>
            <button
              className="dropdown-item dropdown-item-danger"
              onClick={() => {
                editor.chain().focus().deleteTable().run()
                setShowTableMenu(false)
              }}
            >
              <TableDeleteIcon size={28} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onOpenLinkDialog}
        disabled={isMarkdownMode || isReadOnly}
        className={editor.isActive('link') ? 'toolbar-button is-active' : 'toolbar-button'}
        title="Link"
      >
        <LinkIcon size={20} />
      </button>
    </div>
  )
}
