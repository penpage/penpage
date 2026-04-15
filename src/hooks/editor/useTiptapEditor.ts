import { useEditor } from '@tiptap/react'
import { getExtensions } from '../../config/editor/tiptapExtensions'
import { getMarkdownFromEditor } from '../../utils/markdownConverter'

interface UseTiptapEditorProps {
  initialContent?: string
  isMarkdownMode: boolean
  isReadOnly: boolean
  onUpdate?: (markdown: string) => void
  onSelectionUpdate?: (editor: any) => void
  onFocus?: () => void
  onBlur?: () => void
  onImageUpload?: (file: File) => void
}

export const useTiptapEditor = ({
  initialContent = '',
  isMarkdownMode,
  isReadOnly,
  onUpdate,
  onSelectionUpdate,
  onFocus,
  onBlur,
  onImageUpload
}: UseTiptapEditorProps) => {
  const editor = useEditor({
    extensions: getExtensions(),
    content: initialContent,
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
      },
      handleDOMEvents: {
        focus: () => {
          onFocus?.()
          return false
        },
        blur: () => {
          onBlur?.()
          return false
        },
        paste: (_view, event) => {
          const items = event.clipboardData?.items
          if (!items) return false

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                onImageUpload?.(file)
              }
              return true
            }
          }
          return false
        },
        drop: (_view, event) => {
          // 只處理圖片檔案（md 檔案由外層容器處理）
          const files = event.dataTransfer?.files
          if (!files || files.length === 0) return false

          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.type.startsWith('image/')) {
              event.preventDefault()
              onImageUpload?.(file)
              return true
            }
          }
          return false
        },
      },
    },
    onUpdate: ({ editor }) => {
      // Only trigger update if not in Markdown mode (main component handles logic)
      // But actually, onUpdate is called when editor content changes.
      // We transform to markdown here to pass up.
      if (!isMarkdownMode && !isReadOnly) {
        const markdown = getMarkdownFromEditor(editor)
        onUpdate?.(markdown)
      }
    },
    onSelectionUpdate: ({ editor }) => {
      onSelectionUpdate?.(editor)
    },
  })

  // Effect to update editable state
  if (editor && editor.isEditable === isReadOnly) {
    editor.setEditable(!isReadOnly)
  }

  return editor
}
