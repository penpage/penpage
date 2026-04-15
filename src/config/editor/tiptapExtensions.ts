import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Code from '@tiptap/extension-code'
import CodeBlock from '@tiptap/extension-code-block'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { wrappingInputRule, InputRule } from '@tiptap/core'

// 創建一個 Extension 來高亮當前游標所在的節點
export const CurrentNodeHighlight = Extension.create({
  name: 'currentNodeHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('currentNodeHighlight'),
        props: {
          decorations(state) {
            const { $from } = state.selection
            const decorations: Decoration[] = []

            // 找到當前游標所在的塊級節點
            let depth = $from.depth
            while (depth > 0) {
              const node = $from.node(depth)

              // 找到第一個塊級節點（但不是 doc）
              if (node.isBlock && node.type.name !== 'doc') {
                // Code block：用 inline decoration 包裹游標所在行
                if (node.type.name === 'codeBlock') {
                  const codeBlockStart = $from.start(depth)
                  const cursorOffset = $from.pos - codeBlockStart
                  const text = node.textContent

                  const lineStartOffset =
                    text.lastIndexOf('\n', cursorOffset - 1) + 1
                  let lineEndOffset = text.indexOf('\n', cursorOffset)
                  if (lineEndOffset === -1) lineEndOffset = text.length

                  // 空行跳過（inline decoration 需要 range > 0）
                  if (lineStartOffset < lineEndOffset) {
                    decorations.push(
                      Decoration.inline(
                        codeBlockStart + lineStartOffset,
                        codeBlockStart + lineEndOffset,
                        { class: 'code-cursor-line' }
                      )
                    )
                  }
                  break
                }

                const from = $from.before(depth)
                const to = $from.after(depth)

                // 添加 decoration，給這個節點添加 class
                decorations.push(
                  Decoration.node(from, to, {
                    class: 'current-cursor-node',
                  })
                )
                break
              }
              depth--
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

export const getExtensions = () => [
  StarterKit.configure({
    code: false,
    codeBlock: false,
  }),
  Code.extend({
    excludes: '',
  }).configure({
    HTMLAttributes: {
      class: 'inline-code',
    },
  }),
  CodeBlock.extend({
    addAttributes() {
      return {
        language: {
          default: null,
          parseHTML: element => element.getAttribute('data-language') || element.className.replace(/^language-/, ''),
          renderHTML: attributes => {
            if (!attributes.language) {
              return {}
            }
            return {
              'data-language': attributes.language,
              class: `language-${attributes.language}`,
            }
          },
        },
      }
    },
  }),
  Placeholder.configure({
    showOnlyCurrent: false,
    placeholder: `  ⬆ Green button switch to MARKDOWN source editor
     Start typing your note here ...

     # space      Heading 1
     ## space     Heading 2
     ### space    Heading 3
     >            Blockquote

     - space      Bullet list
     1.           Numbered list
     -[ ]  -[x]   Todo checklist

     ---          Horizontal divider
     \`\`\`          Code block   (triple backticks)
     \`Code\`       Inline Code  (Cmd/Ctrl + E) 

     **Bold**     Bold Font    (Cmd/Ctrl + B)
     *Italic*     Italic Font  (Cmd/Ctrl + I)
     ~~Cross~~    Cross Out 

     `,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        src: {
          default: null,
          parseHTML: element => {
            return element.getAttribute('src') || element.getAttribute('data-src')
          },
          renderHTML: attributes => {
            if (!attributes.src) return {}
            if (attributes.src.startsWith('image://')) {
              return {
                'data-src': attributes.src,
                src: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Crect fill=\'%23f0f0f0\' width=\'100\' height=\'100\'%3E%3C/rect%3E%3C/svg%3E'
              }
            }
            return { src: attributes.src }
          },
        },
        alt: {
          default: null,
          parseHTML: element => element.getAttribute('alt'),
          renderHTML: attributes => {
            if (!attributes.alt) return {}
            return { alt: attributes.alt }
          },
        },
        width: {
          default: null,
          parseHTML: element => element.getAttribute('width'),
          renderHTML: attributes => {
            if (!attributes.width) return {}
            return { width: attributes.width }
          },
        },
        'data-shadow': {
          default: 'true',
          parseHTML: element => element.getAttribute('data-shadow'),
          renderHTML: attributes => {
            return { 'data-shadow': attributes['data-shadow'] || 'true' }
          },
        },
      }
    },
  }).configure({
    inline: true,
    HTMLAttributes: {
      class: 'editor-image',
    },
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.extend({
    addAttributes() {
      return {
        checked: {
          default: false,
          parseHTML: element => {
            const dataChecked = element.getAttribute('data-checked')
            if (dataChecked !== null) return dataChecked === 'true'
            const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement | null
            return checkbox?.checked || false
          },
          renderHTML: attributes => ({
            'data-checked': attributes.checked,
          }),
        },
      }
    },
    // 覆寫 NodeView：checkbox 點擊時不呼叫 focus()，避免 iOS 原生捲動
    addNodeView() {
      return ({ node, HTMLAttributes, getPos, editor }) => {
        const listItem = document.createElement('li')
        const checkboxWrapper = document.createElement('label')
        const checkboxStyler = document.createElement('span')
        const checkbox = document.createElement('input')
        const content = document.createElement('div')

        checkboxWrapper.contentEditable = 'false'
        checkbox.type = 'checkbox'
        checkbox.ariaLabel = `Task item checkbox for ${node.textContent || 'empty task item'}`
        checkbox.addEventListener('mousedown', event => event.preventDefault())
        checkbox.addEventListener('change', event => {
          if (!editor.isEditable && !this.options.onReadOnlyChecked) {
            checkbox.checked = !checkbox.checked
            return
          }

          const { checked } = event.target as any

          if (editor.isEditable && typeof getPos === 'function') {
            // 直接 dispatch transaction，不呼叫 focus()
            // 避免 iOS Safari 原生 .focus() 觸發捲動 + PE V1→E1 佈局切換
            const pos = getPos()
            if (typeof pos === 'number') {
              const currentNode = editor.state.tr.doc.nodeAt(pos)
              if (currentNode) {
                editor.view.dispatch(
                  editor.state.tr.setNodeMarkup(pos, undefined, {
                    ...currentNode.attrs,
                    checked,
                  })
                )
              }
            }
          }
          if (!editor.isEditable && this.options.onReadOnlyChecked) {
            if (!this.options.onReadOnlyChecked(node, checked)) {
              checkbox.checked = !checkbox.checked
            }
          }
        })

        Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
          listItem.setAttribute(key, value)
        })

        listItem.dataset.checked = node.attrs.checked
        checkbox.checked = node.attrs.checked

        checkboxWrapper.append(checkbox, checkboxStyler)
        listItem.append(checkboxWrapper, content)

        Object.entries(HTMLAttributes).forEach(([key, value]) => {
          listItem.setAttribute(key, value)
        })

        return {
          dom: listItem,
          contentDOM: content,
          update: updatedNode => {
            if (updatedNode.type !== this.type) {
              return false
            }
            listItem.dataset.checked = updatedNode.attrs.checked
            checkbox.checked = updatedNode.attrs.checked
            checkbox.ariaLabel = `Task item checkbox for ${updatedNode.textContent || 'empty task item'}`
            return true
          },
        }
      }
    },
    addInputRules() {
      return [
        // -[ ] + space → unchecked checkbox
        wrappingInputRule({
          find: /^-\[\]\s$/,
          type: this.type,
          getAttributes: () => ({ checked: false }),
        }),
        // -[ + space → unchecked checkbox (簡化輸入)
        wrappingInputRule({
          find: /^-\[\s$/,
          type: this.type,
          getAttributes: () => ({ checked: false }),
        }),
        // -【 → unchecked checkbox (中文括號，不需要 space)
        wrappingInputRule({
          find: /^-【$/,
          type: this.type,
          getAttributes: () => ({ checked: false }),
        }),
        // -[x] + space → checked checkbox
        wrappingInputRule({
          find: /^-\[x\]\s$/i,
          type: this.type,
          getAttributes: () => ({ checked: true }),
        }),
        // -[x + space → checked checkbox (簡化輸入)
        wrappingInputRule({
          find: /^-\[x\s$/i,
          type: this.type,
          getAttributes: () => ({ checked: true }),
        }),
        // 在 bulletList 內輸入 [] + space → 轉換為 unchecked taskItem
        new InputRule({
          find: /^\[\]\s$/,
          handler: ({ state, range, chain }) => {
            const { $from } = state.selection
            const listItem = $from.node($from.depth - 1)
            if (listItem && listItem.type.name === 'listItem') {
              const list = $from.node($from.depth - 2)
              if (list && list.type.name === 'bulletList') {
                chain()
                  .deleteRange({ from: range.from, to: range.to })
                  .toggleTaskList()
                  .run()
              }
            }
          },
        }),
        // 在 bulletList 內輸入 [x] + space → 轉換為 checked taskItem
        new InputRule({
          find: /^\[x\]\s$/i,
          handler: ({ state, range, chain }) => {
            const { $from } = state.selection
            const listItem = $from.node($from.depth - 1)
            if (listItem && listItem.type.name === 'listItem') {
              const list = $from.node($from.depth - 2)
              if (list && list.type.name === 'bulletList') {
                chain()
                  .deleteRange({ from: range.from, to: range.to })
                  .toggleTaskList()
                  .updateAttributes('taskItem', { checked: true })
                  .run()
              }
            }
          },
        }),
      ]
    },
  }).configure({
    nested: true,
  }),
  TextStyle,
  Color,
  CurrentNodeHighlight,
]
