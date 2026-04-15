/**
 * Markdown 转换工具
 * 负责 Tiptap Editor JSON 格式与 Markdown 文本之间的转换
 */

/**
 * 从 Tiptap Editor 实例中提取 Markdown 文本
 * @param editorInstance - Tiptap Editor 实例
 * @returns Markdown 格式的文本
 */
export const getMarkdownFromEditor = (editorInstance: any): string => {
  if (!editorInstance) return ''

  // 获取编辑器的 JSON 内容
  const json = editorInstance.getJSON()

  // 改进的 JSON 到 Markdown 转换
  const jsonToMarkdown = (node: any, depth = 0): string => {
    if (node.type === 'doc') {
      const items = node.content?.map((child: any) => jsonToMarkdown(child, depth)) || []
      // 智能处理换行：只在非空内容之间添加空行
      return items.filter((item: string) => item.trim()).join('\n\n')
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level || 1
      const text = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('') || ''
      return '#'.repeat(level) + ' ' + text
    }

    if (node.type === 'paragraph') {
      const content = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('') || ''
      return content
    }

    if (node.type === 'text') {
      let text = node.text || ''
      if (node.marks) {
        const linkMark = node.marks.find((mark: any) => mark.type === 'link')
        const codeMark = node.marks.find((mark: any) => mark.type === 'code')
        const boldMark = node.marks.find((mark: any) => mark.type === 'bold')
        const italicMark = node.marks.find((mark: any) => mark.type === 'italic')
        const strikeMark = node.marks.find((mark: any) => mark.type === 'strike')
        const textStyleMark = node.marks.find((mark: any) => mark.type === 'textStyle')

        // 特殊处理：code + link 组合
        // 生成 [`text`](url) 格式，这在 markdown 中是合法的
        if (codeMark && linkMark) {
          text = `[\`${text}\`](${linkMark.attrs.href})`
        } else {
          // 处理其他格式标记
          if (boldMark) text = `**${text}**`
          if (italicMark) text = `*${text}*`
          if (strikeMark) text = `~~${text}~~`
          if (codeMark) text = `\`${text}\``

          // 最后应用链接（包装所有其他格式）
          if (linkMark) {
            text = `[${text}](${linkMark.attrs.href})`
          }
        }

        // 處理文字顏色（使用 HTML span 標籤）
        if (textStyleMark?.attrs?.color) {
          text = `<span style="color:${textStyleMark.attrs.color}">${text}</span>`
        }
      }
      return text
    }

    if (node.type === 'bulletList') {
      // 處理 bulletList 內的每個 listItem，保持相同的 depth
      return node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('\n') || ''
    }

    if (node.type === 'orderedList') {
      // 處理 orderedList 內的每個 listItem，保持相同的 depth
      return node.content?.map((child: any, index: number) => {
        const content = jsonToMarkdown(child, depth)
        // 替換 listItem 生成的 "- " 為 "數字. "
        return content.replace(/^(\s*)- /, `$1${index + 1}. `)
      }).join('\n') || ''
    }

    if (node.type === 'listItem') {
      // 根據 depth 計算縮排（每層 4 個空格，符合 marked 規範）
      const indent = '    '.repeat(depth)

      // 分離 paragraph 和巢狀列表
      const paragraphs: string[] = []
      const nestedLists: string[] = []

      node.content?.forEach((child: any) => {
        if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
          // 巢狀列表：depth + 1
          nestedLists.push(jsonToMarkdown(child, depth + 1))
        } else if (child.type === 'paragraph') {
          paragraphs.push(jsonToMarkdown(child, depth))
        } else {
          paragraphs.push(jsonToMarkdown(child, depth))
        }
      })

      const firstPara = paragraphs[0] || ''
      const restParas = paragraphs.slice(1)

      // 構建結果：縮排 + "- " + 第一段內容
      let result = indent + '- ' + firstPara

      // 如果有多個段落，添加縮排後的後續段落
      if (restParas.length > 0) {
        const paraIndent = indent + '    '
        result += '\n' + paraIndent + restParas.join('\n' + paraIndent)
      }

      // 添加巢狀列表（已經有正確的縮排）
      if (nestedLists.length > 0) {
        result += '\n' + nestedLists.join('\n')
      }

      return result
    }

    if (node.type === 'taskList') {
      // 處理 taskList 內的每個 taskItem，保持相同的 depth
      return node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('\n') || ''
    }

    if (node.type === 'taskItem') {
      const checked = node.attrs?.checked ? 'x' : ' '
      // 根據 depth 計算縮排（每層 4 個空格，符合 marked 規範）
      const indent = '    '.repeat(depth)

      // 分離 paragraph 和巢狀列表
      const paragraphs: string[] = []
      const nestedLists: string[] = []

      node.content?.forEach((child: any) => {
        if (child.type === 'taskList' || child.type === 'bulletList' || child.type === 'orderedList') {
          // 巢狀列表：depth + 1
          nestedLists.push(jsonToMarkdown(child, depth + 1))
        } else if (child.type === 'paragraph') {
          paragraphs.push(jsonToMarkdown(child, depth))
        } else {
          paragraphs.push(jsonToMarkdown(child, depth))
        }
      })

      const firstPara = paragraphs[0] || ''
      const restParas = paragraphs.slice(1)

      // 構建結果：縮排 + "- [x] " + 第一段內容（即使是空的也保留）
      let result = indent + `- [${checked}] ` + firstPara

      // 如果有多個段落，添加縮排後的後續段落
      if (restParas.length > 0) {
        const paraIndent = indent + '    '
        result += '\n' + paraIndent + restParas.join('\n' + paraIndent)
      }

      // 添加巢狀列表（已經有正確的縮排）
      if (nestedLists.length > 0) {
        result += '\n' + nestedLists.join('\n')
      }

      return result
    }

    if (node.type === 'codeBlock') {
      const language = node.attrs?.language || ''
      const code = node.content?.map((child: any) => child.text || '').join('\n') || ''
      // 移除末尾的單個換行符，避免在 code block 後出現多餘空行
      // 原因：Tiptap 在 code block 最後一行按 Enter 後會保留換行符
      const trimmedCode = code.replace(/\n$/, '')
      return '```' + language + '\n' + trimmedCode + '\n```'
    }

    if (node.type === 'blockquote') {
      const content = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('\n\n') || ''
      return content.split('\n').map((line: string) => '> ' + line).join('\n')
    }

    if (node.type === 'horizontalRule') {
      return '---'
    }

    if (node.type === 'hardBreak') {
      return '  \n'  // Markdown 硬换行：两个空格 + 换行
    }

    if (node.type === 'image') {
      const src = node.attrs?.src || ''
      const alt = node.attrs?.alt || ''

      // 只保存基本 Markdown 語法
      // 屬性（width, shadow）會保存在 Tiptap 的 JSON 中，不需要在 Markdown 中顯示
      return `![${alt}](${src})`
    }

    if (node.type === 'table') {
      return convertTableToMarkdown(node)
    }

    if (node.type === 'tableRow' || node.type === 'tableCell' || node.type === 'tableHeader') {
      // 这些由 table 节点统一处理
      return ''
    }

    return ''
  }

  const convertTableToMarkdown = (tableNode: any): string => {
    const rows = tableNode.content || []
    if (rows.length === 0) return ''

    let markdown = ''
    rows.forEach((row: any, rowIndex: number) => {
      const cells = row.content || []
      const cellContents = cells.map((cell: any) => {
        // 使用 jsonToMarkdown 递归处理 cell 内容，保留所有格式（包括 code + link）
        return cell.content?.map((node: any) => jsonToMarkdown(node, 0)).join(' ').trim() || ''
      })

      markdown += '| ' + cellContents.join(' | ') + ' |\n'

      // 添加分隔线（在第一行后）
      if (rowIndex === 0) {
        markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n'
      }
    })

    return markdown
  }

  return jsonToMarkdown(json)
}

/**
 * 从 Markdown 文本中提取页面标题
 * @param markdown - Markdown 文本
 * @returns 页面标题
 */
export const extractPageTitle = (markdown: string): string => {
  if (!markdown.trim()) return 'New Page'

  const lines = markdown.split('\n')

  // 跳過 YAML frontmatter（--- ... ---）
  let startIndex = 0
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        startIndex = i + 1
        break
      }
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line) continue  // 跳過空行

    // 移除 Markdown 標題符號（# ## ### 等）
    const withoutHash = line.replace(/^#+\s*/, '')

    // 移除 checkbox 和水平線
    const withoutSpecial = withoutHash
      .replace(/^-\s*\[[ x]?\]\s*/i, '')    // checkbox（- [ ]、-[ ]、- [x]、-[x]）
      .replace(/^---+$/, '')               // 水平線（整行 ---）

    // 移除其他 Markdown 格式符號
    const cleaned = withoutSpecial
      .replace(/\*\*/g, '')  // 粗體
      .replace(/\*/g, '')    // 斜體
      .replace(/`/g, '')     // 代碼
      .replace(/\*?\[([^\]]+)\]\([^)]+\)/g, '$1')  // 鏈接
      .trim()

    if (cleaned) return cleaned  // 找到有意義的文字
  }

  return 'New Page'
}

/**
 * 將 WYSIWYG (Tiptap) 的游標位置轉換為 Markdown 文本位置
 * 策略：獲取游標前的純文本長度，然後在生成 Markdown 時找到相同純文本長度的位置
 * @param editorInstance - Tiptap Editor 实例
 * @param wysiwygPos - WYSIWYG 中的游標位置（Tiptap position）
 * @returns Markdown 文本中的位置
 */
export const convertWysiwygPosToMarkdown = (editorInstance: any, wysiwygPos: number): number => {
  if (!editorInstance) return 0

  // 獲取游標前的純文本長度（不含任何格式）
  const plainTextBeforeCursor = editorInstance.state.doc.textBetween(0, wysiwygPos, '\n', '\n')
  const targetPlainTextLength = plainTextBeforeCursor.length

  console.log('📘 WYSIWYG → Markdown 轉換（基於 JSON 結構）')
  console.log('  Tiptap 游標位置:', wysiwygPos)
  console.log('  游標前純文本長度:', targetPlainTextLength)
  console.log('  游標前純文本示例:', JSON.stringify(plainTextBeforeCursor.substring(Math.max(0, plainTextBeforeCursor.length - 30))))

  const json = editorInstance.getJSON()

  let markdownLength = 0
  let plainTextLength = 0
  let foundPosition = 0
  let reachedTarget = false

  // 使用和 getMarkdownFromEditor 完全相同的轉換邏輯
  const jsonToMarkdown = (node: any, depth = 0): string => {
    if (reachedTarget) return '' // 已經找到目標位置，停止計算

    if (node.type === 'doc') {
      const items: string[] = []

      // 逐個處理子節點，並在非空節點之間添加分隔符
      for (let i = 0; i < (node.content?.length || 0); i++) {
        const childResult = jsonToMarkdown(node.content[i], depth)

        if (childResult.trim()) {
          // 如果不是第一個非空項，添加段落分隔符
          if (items.length > 0) {
            // Markdown 中段落間是 \n\n（2 個字符）
            markdownLength += 2
            // 但 textBetween 只用 \n（1 個字符）作為 block separator
            plainTextLength += 1

            // 檢查是否達到目標
            if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
              foundPosition = markdownLength - 1 // 回退到分隔符前
              reachedTarget = true
              return items.join('\n\n')
            }
          }

          items.push(childResult)
        }
      }

      return items.join('\n\n')
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level || 1
      const prefix = '#'.repeat(level) + ' '
      markdownLength += prefix.length // Markdown 增加的前綴

      const text = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('') || ''
      return prefix + text
    }

    if (node.type === 'paragraph') {
      const content = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('') || ''
      return content
    }

    if (node.type === 'text') {
      const text = node.text || ''

      // 計算這段文本在 Markdown 中的起始和結束長度
      const markdownPrefix = getMarkdownPrefix(node.marks)
      const markdownSuffix = getMarkdownSuffix(node.marks)

      markdownLength += markdownPrefix.length

      // 逐字符檢查
      for (let i = 0; i < text.length; i++) {
        if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
          foundPosition = markdownLength
          reachedTarget = true
          break
        }

        plainTextLength++
        markdownLength++
      }

      markdownLength += markdownSuffix.length

      // 生成完整的 Markdown
      let result = text
      if (node.marks) {
        const linkMark = node.marks.find((mark: any) => mark.type === 'link')
        const codeMark = node.marks.find((mark: any) => mark.type === 'code')
        const boldMark = node.marks.find((mark: any) => mark.type === 'bold')
        const italicMark = node.marks.find((mark: any) => mark.type === 'italic')
        const strikeMark = node.marks.find((mark: any) => mark.type === 'strike')

        if (codeMark && linkMark) {
          result = `[\`${text}\`](${linkMark.attrs.href})`
        } else {
          if (boldMark) result = `**${text}**`
          if (italicMark) result = `*${text}*`
          if (strikeMark) result = `~~${text}~~`
          if (codeMark) result = `\`${text}\``
          if (linkMark) result = `[${text}](${linkMark.attrs.href})`
        }
      }
      return result
    }

    if (node.type === 'bulletList') {
      const items: string[] = []

      for (let i = 0; i < (node.content?.length || 0); i++) {
        const childResult = jsonToMarkdown(node.content[i], depth)

        if (i > 0 && childResult) {
          // 列表項之間的換行符
          markdownLength += 1 // \n
          plainTextLength += 1 // \n

          if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
            foundPosition = markdownLength - 1
            reachedTarget = true
            return items.join('\n')
          }
        }

        items.push(childResult)
      }

      return items.join('\n')
    }

    if (node.type === 'orderedList') {
      const items: string[] = []

      for (let i = 0; i < (node.content?.length || 0); i++) {
        const childResult = jsonToMarkdown(node.content[i], depth)
        const content = childResult.replace(/^- /, `${i + 1}. `)

        if (i > 0 && content) {
          // 列表項之間的換行符
          markdownLength += 1 // \n
          plainTextLength += 1 // \n

          if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
            foundPosition = markdownLength - 1
            reachedTarget = true
            return items.join('\n')
          }
        }

        items.push(content)
      }

      return items.join('\n')
    }

    if (node.type === 'listItem') {
      const prefix = '- '
      markdownLength += prefix.length

      const paragraphs = node.content?.map((child: any) => {
        if (child.type === 'paragraph') {
          return jsonToMarkdown(child, depth + 1)
        }
        return jsonToMarkdown(child, depth + 1)
      }) || []

      const firstPara = paragraphs[0] || ''
      const restParas = paragraphs.slice(1)

      let result = prefix + firstPara
      if (restParas.length > 0) {
        const separator = '\n  '
        markdownLength += separator.length * restParas.length
        result += separator + restParas.join(separator)
      }
      return result
    }

    if (node.type === 'codeBlock') {
      const language = node.attrs?.language || ''
      const code = node.content?.map((child: any) => child.text || '').join('\n') || ''
      const trimmedCode = code.replace(/\n$/, '')
      const wrapper = '```' + language + '\n' + trimmedCode + '\n```'

      markdownLength += wrapper.length
      plainTextLength += code.length

      if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
        foundPosition = markdownLength - (plainTextLength - targetPlainTextLength)
        reachedTarget = true
      }

      return wrapper
    }

    if (node.type === 'blockquote') {
      const content = node.content?.map((child: any) => jsonToMarkdown(child, depth)).join('\n\n') || ''
      const lines = content.split('\n')
      lines.forEach((_line: string) => {
        markdownLength += 2 // '> '
      })
      return lines.map((line: string) => '> ' + line).join('\n')
    }

    if (node.type === 'hardBreak') {
      markdownLength += 3 // '  \n'
      plainTextLength += 1 // 換行符
      return '  \n'
    }

    if (node.type === 'image') {
      const src = node.attrs?.src || ''
      const alt = node.attrs?.alt || ''
      const md = `![${alt}](${src})`
      markdownLength += md.length
      return md
    }

    if (node.type === 'table') {
      return convertTableToMarkdown(node)
    }

    if (node.type === 'taskList') {
      const items: string[] = []

      for (let i = 0; i < (node.content?.length || 0); i++) {
        const childResult = jsonToMarkdown(node.content[i], depth)

        if (i > 0 && childResult) {
          // 任務項之間的換行符
          markdownLength += 1 // \n
          plainTextLength += 1 // \n

          if (plainTextLength >= targetPlainTextLength && !reachedTarget) {
            foundPosition = markdownLength - 1
            reachedTarget = true
            return items.join('\n')
          }
        }

        items.push(childResult)
      }

      return items.join('\n')
    }

    if (node.type === 'taskItem') {
      const checked = node.attrs?.checked ? 'x' : ' '
      const prefix = `- [${checked}] `
      markdownLength += prefix.length

      const paragraphs = node.content?.map((child: any) => {
        if (child.type === 'paragraph') {
          return jsonToMarkdown(child, depth + 1)
        }
        return jsonToMarkdown(child, depth + 1)
      }) || []

      const firstPara = paragraphs[0] || ''
      const restParas = paragraphs.slice(1)

      let result = prefix + firstPara
      if (restParas.length > 0) {
        const separator = '\n  '
        markdownLength += separator.length * restParas.length
        result += separator + restParas.join(separator)
      }
      return result
    }

    return ''
  }

  // 輔助函數：獲取 Markdown 前綴
  const getMarkdownPrefix = (marks: any[]): string => {
    if (!marks) return ''

    const linkMark = marks.find((mark: any) => mark.type === 'link')
    const codeMark = marks.find((mark: any) => mark.type === 'code')
    const boldMark = marks.find((mark: any) => mark.type === 'bold')
    const italicMark = marks.find((mark: any) => mark.type === 'italic')
    const strikeMark = marks.find((mark: any) => mark.type === 'strike')
    const textStyleMark = marks.find((mark: any) => mark.type === 'textStyle')

    if (codeMark && linkMark) {
      return '[`'
    } else {
      let prefix = ''
      if (boldMark) prefix += '**'
      if (italicMark) prefix += '*'
      if (strikeMark) prefix += '~~'
      if (codeMark) prefix += '`'
      if (linkMark) prefix += '['
      // 文字顏色使用 HTML span 標籤
      if (textStyleMark?.attrs?.color) {
        prefix = `<span style="color:${textStyleMark.attrs.color}">` + prefix
      }
      return prefix
    }
  }

  // 輔助函數：獲取 Markdown 後綴
  const getMarkdownSuffix = (marks: any[]): string => {
    if (!marks) return ''

    const linkMark = marks.find((mark: any) => mark.type === 'link')
    const codeMark = marks.find((mark: any) => mark.type === 'code')
    const boldMark = marks.find((mark: any) => mark.type === 'bold')
    const italicMark = marks.find((mark: any) => mark.type === 'italic')
    const strikeMark = marks.find((mark: any) => mark.type === 'strike')
    const textStyleMark = marks.find((mark: any) => mark.type === 'textStyle')

    if (codeMark && linkMark) {
      return '`](' + linkMark.attrs.href + ')'
    } else {
      let suffix = ''
      if (linkMark) suffix += `](${linkMark.attrs.href})`
      if (codeMark) suffix += '`'
      if (strikeMark) suffix += '~~'
      if (italicMark) suffix += '*'
      if (boldMark) suffix += '**'
      // 文字顏色使用 HTML span 標籤
      if (textStyleMark?.attrs?.color) {
        suffix += '</span>'
      }
      return suffix
    }
  }

  const convertTableToMarkdown = (tableNode: any): string => {
    const rows = tableNode.content || []
    if (rows.length === 0) return ''

    let result = ''
    rows.forEach((row: any, rowIndex: number) => {
      const cells = row.content || []
      const cellContents = cells.map((cell: any) => {
        return cell.content?.map((node: any) => jsonToMarkdown(node, 0)).join(' ').trim() || ''
      })

      const rowText = '| ' + cellContents.join(' | ') + ' |\n'
      result += rowText
      markdownLength += rowText.length
      plainTextLength += cellContents.join(' ').length

      if (rowIndex === 0) {
        const separatorText = '| ' + cellContents.map(() => '---').join(' | ') + ' |\n'
        result += separatorText
        markdownLength += separatorText.length
      }
    })

    return result
  }

  jsonToMarkdown(json)

  console.log('  找到的 Markdown 位置:', foundPosition)
  console.log('  最終純文本長度:', plainTextLength)
  console.log('  最終 Markdown 長度:', markdownLength)

  return foundPosition
}

/**
 * 將 Markdown 文本的游標位置轉換為 WYSIWYG 編輯器的位置
 * @param editorInstance - Tiptap Editor 实例
 * @param markdownText - 完整的 Markdown 文本
 * @param markdownPos - Markdown 文本中的游標位置
 * @returns WYSIWYG 編輯器中的位置 (Tiptap position)
 */
export const convertMarkdownPosToWysiwyg = (editorInstance: any, markdownText: string, markdownPos: number): number => {
  if (!editorInstance) return 0

  // 獲取 WYSIWYG 的完整純文本
  const fullWysiwygText = editorInstance.state.doc.textBetween(0, editorInstance.state.doc.content.size, '\n', '\n')

  // 清理完整的 Markdown（與 MarkdownEditor 中的邏輯保持一致）
  const cleanedFullMarkdown = markdownText
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/\*?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^-\s*\[[ x]\]\s*/gm, '')
    .replace(/^```[\s\S]*?```$/gm, (match) => {
      const lines = match.split('\n')
      return lines.slice(1, -1).join('\n')
    })
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')

  // 獲取游標前的 Markdown 文本並清理
  const mdTextBeforeCursor = markdownText.substring(0, markdownPos)
  const cleanedBeforeCursor = mdTextBeforeCursor
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/\*?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^-\s*\[[ x]\]\s*/gm, '')
    .replace(/^```[\s\S]*?```$/gm, (match) => {
      const lines = match.split('\n')
      return lines.slice(1, -1).join('\n')
    })
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')

  const cleanCursorPos = cleanedBeforeCursor.length

  // 提取上下文：游標前後各 30 個字符
  const contextBefore = cleanedFullMarkdown.substring(Math.max(0, cleanCursorPos - 30), cleanCursorPos)
  const contextAfter = cleanedFullMarkdown.substring(cleanCursorPos, Math.min(cleanedFullMarkdown.length, cleanCursorPos + 30))

  // 在 WYSIWYG 純文本中查找上下文
  let plainTextPos = -1

  // 優先使用前後文一起匹配
  if (contextBefore.length > 0 && contextAfter.length > 0) {
    const combinedContext = contextBefore + contextAfter
    const index = fullWysiwygText.indexOf(combinedContext)
    if (index !== -1) {
      plainTextPos = index + contextBefore.length
    }
  }

  // 如果沒找到，只用前文匹配
  if (plainTextPos === -1 && contextBefore.length > 0) {
    const index = fullWysiwygText.indexOf(contextBefore)
    if (index !== -1) {
      plainTextPos = index + contextBefore.length
    }
  }

  // 如果還是沒找到，使用比例估算
  if (plainTextPos === -1) {
    const ratio = cleanCursorPos / (cleanedFullMarkdown.length || 1)
    plainTextPos = Math.floor(fullWysiwygText.length * ratio)
  }

  // 使用二分搜索找到對應的 Tiptap position（第一次估算）
  const docSize = editorInstance.state.doc.content.size
  let left = 0
  let right = docSize
  let initialGuess = 0

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const textLength = editorInstance.state.doc.textBetween(0, mid, '\n', '\n').length

    if (textLength === plainTextPos) {
      initialGuess = mid
      break
    } else if (textLength < plainTextPos) {
      left = mid + 1
      initialGuess = mid
    } else {
      right = mid - 1
    }
  }

  // === 二次精確匹配 ===
  const beforeLength = 15
  const afterLength = 15
  const mdBeforeText = markdownText.substring(
    Math.max(0, markdownPos - beforeLength),
    markdownPos
  )
  const mdAfterText = markdownText.substring(
    markdownPos,
    Math.min(markdownText.length, markdownPos + afterLength)
  )

  const initialPlainPos = editorInstance.state.doc.textBetween(0, initialGuess, '\n', '\n').length
  const searchRadius = 100
  const searchStartPlain = Math.max(0, initialPlainPos - searchRadius)
  const searchEndPlain = Math.min(fullWysiwygText.length, initialPlainPos + searchRadius)

  let bestMatch = initialGuess
  let bestMatchScore = 0

  for (let plainPos = searchStartPlain; plainPos <= searchEndPlain; plainPos++) {
    const wysiwygBefore = fullWysiwygText.substring(Math.max(0, plainPos - beforeLength), plainPos)
    const wysiwygAfter = fullWysiwygText.substring(plainPos, Math.min(fullWysiwygText.length, plainPos + afterLength))

    let score = 0
    let beforeMatches = 0
    const minBeforeLen = Math.min(mdBeforeText.length, wysiwygBefore.length)
    for (let i = 1; i <= minBeforeLen; i++) {
      if (mdBeforeText[mdBeforeText.length - i] === wysiwygBefore[wysiwygBefore.length - i]) {
        beforeMatches++
      } else {
        break
      }
    }

    let afterMatches = 0
    const minAfterLen = Math.min(mdAfterText.length, wysiwygAfter.length)
    for (let i = 0; i < minAfterLen; i++) {
      if (mdAfterText[i] === wysiwygAfter[i]) {
        afterMatches++
      } else {
        break
      }
    }

    score = beforeMatches * 2 + afterMatches

    if (score > bestMatchScore) {
      bestMatchScore = score
      // Find Tiptap pos
      let tempLeft = 0
      let tempRight = docSize
      let tempResult = 0

      while (tempLeft <= tempRight) {
        const tempMid = Math.floor((tempLeft + tempRight) / 2)
        const tempLength = editorInstance.state.doc.textBetween(0, tempMid, '\n', '\n').length

        if (tempLength === plainPos) {
          tempResult = tempMid
          break
        } else if (tempLength < plainPos) {
          tempLeft = tempMid + 1
          tempResult = tempMid
        } else {
          tempRight = tempMid - 1
        }
      }
      bestMatch = tempResult
    }
  }

  if (bestMatchScore >= 3) {
    return bestMatch
  }

  return initialGuess
}