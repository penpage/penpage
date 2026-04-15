import { useState, useRef, RefObject } from 'react'
import { Editor } from '@tiptap/react'
import { Page } from '../../services/db'
import { markdownToHtml } from '../../config/editor/markdownItConfig'
import { 
  convertWysiwygPosToMarkdown, 
  convertMarkdownPosToWysiwyg 
} from '../../utils/markdownConverter'

interface UseEditorModeProps {
  editor: Editor | null
  markdownTextareaRef: RefObject<HTMLTextAreaElement>
  markdownText: string
  currentPage: Page | null
  setCurrentPage: (page: Page | null) => void
  convertImageUrls: () => Promise<void>
  isSyncingFromMarkdown: React.MutableRefObject<boolean>
  updateMarkdownLineHighlight: () => void
  scrollMarkdownCursorToCenter: () => void
  scrollWysiwygCursorToCenter: () => void
}

export const useEditorMode = ({
  editor,
  markdownTextareaRef,
  markdownText,
  currentPage,
  setCurrentPage,
  convertImageUrls,
  isSyncingFromMarkdown,
  updateMarkdownLineHighlight,
  scrollMarkdownCursorToCenter,
  scrollWysiwygCursorToCenter
}: UseEditorModeProps) => {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false)
  const isSwitchingModeRef = useRef(false)

  const validateWysiwygCursorPosition = (position: number): number => {
    if (!editor) return 0
    const docSize = editor.state.doc.content.size
    const maxPos = Math.max(0, docSize - 1)
    if (position < 0) return 0
    if (position > maxPos) return maxPos
    return position
  }

  const handleToggleMarkdownMode = () => {
    console.log('========== 切換模式 ==========')
    console.log('當前模式:', isMarkdownMode ? 'Markdown' : 'WYSIWYG')

    if (!isMarkdownMode) {
      // WYSIWYG -> Markdown
      const currentWysiwygCursor = editor?.state.selection.from || 0
      const savedWysiwygCursor = currentPage?.editorState?.wysiwygCursorPosition
      const savedMarkdownCursor = currentPage?.editorState?.markdownCursorPosition

      let targetMarkdownCursor: number

      if (savedWysiwygCursor !== undefined && currentWysiwygCursor === savedWysiwygCursor) {
        targetMarkdownCursor = savedMarkdownCursor || 0
      } else {
        targetMarkdownCursor = convertWysiwygPosToMarkdown(editor, currentWysiwygCursor)
        
        if (currentPage) {
          setCurrentPage({
            ...currentPage,
            editorState: {
              ...currentPage.editorState,
              wysiwygCursorPosition: currentWysiwygCursor,
              markdownCursorPosition: targetMarkdownCursor,
            }
          })
        }
      }

      isSwitchingModeRef.current = true
      setIsMarkdownMode(true)

      setTimeout(() => {
        if (markdownTextareaRef.current) {
          markdownTextareaRef.current.focus()
          markdownTextareaRef.current.setSelectionRange(targetMarkdownCursor, targetMarkdownCursor)
          
          setTimeout(() => {
            scrollMarkdownCursorToCenter()
            updateMarkdownLineHighlight()
            isSwitchingModeRef.current = false
          }, 50)
        }
      }, 50)

    } else {
      // Markdown -> WYSIWYG
      const currentMarkdownCursor = markdownTextareaRef.current?.selectionStart || 0
      const savedMarkdownCursor = currentPage?.editorState?.markdownCursorPosition
      const savedWysiwygCursor = currentPage?.editorState?.wysiwygCursorPosition

      let targetWysiwygCursor: number

      if (savedMarkdownCursor !== undefined && currentMarkdownCursor === savedMarkdownCursor) {
        targetWysiwygCursor = savedWysiwygCursor || 0
      } else {
        targetWysiwygCursor = convertMarkdownPosToWysiwyg(editor, markdownText, currentMarkdownCursor)
        
        if (currentPage) {
          setCurrentPage({
            ...currentPage,
            editorState: {
              ...currentPage.editorState,
              wysiwygCursorPosition: targetWysiwygCursor,
              markdownCursorPosition: currentMarkdownCursor,
            }
          })
        }
      }

      isSyncingFromMarkdown.current = true
      const html = markdownToHtml(markdownText)
      editor?.commands.setContent(html)
      setIsMarkdownMode(false)

      setTimeout(() => {
        isSyncingFromMarkdown.current = false
        convertImageUrls()

        if (editor) {
          const validPosition = validateWysiwygCursorPosition(targetWysiwygCursor)
          editor.commands.focus()
          editor.commands.setTextSelection(validPosition)
          setTimeout(() => scrollWysiwygCursorToCenter(), 50)
        }
      }, 0)
    }
  }

  return {
    isMarkdownMode,
    setIsMarkdownMode,
    handleToggleMarkdownMode,
    isSwitchingModeRef
  }
}
