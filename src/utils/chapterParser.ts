export interface Chapter {
  index: number
  title: string
  content: string
}

/**
 * 标准化换行符：将 \r\n 和 \r 统一转换为 \n
 */
const normalizeLineEndings = (text: string): string => {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * 清理文本中的多余空白字符
 * - 移除每行末尾的空格和制表符
 */
const cleanText = (text: string): string => {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
}

/**
 * 默认章节标题正则表达式
 * 只允许：数字 0-9、中文数字、中文空格 (\u3000)、英文空格 ( )
 */
export const DEFAULT_CHAPTER_REGEX = /第[0-9 \u3000一二三四五六七八九十百千万]+章/

/**
 * 从小说文本中识别并分割章节
 * 采用逐行扫描的方式，更可靠
 * @param text 小说文本
 * @param customRegex 自定义章节匹配正则，可选
 */
export const parseChapters = (text: string, customRegex?: RegExp): Chapter[] => {
  // 使用自定义正则或默认正则
  const chapterRegex = customRegex || DEFAULT_CHAPTER_REGEX

  // 标准化换行符
  text = normalizeLineEndings(text)

  // 清理多余空白
  text = cleanText(text)

  const lines = text.split('\n')
  const chapters: Chapter[] = []
  let currentChapter: { title: string; contentLines: string[] } | null = null
  let chapterIndex = 0

  for (const line of lines) {
    const trimmedLine = line.trim()

    // 检查是否是章节标题行
    if (chapterRegex.test(trimmedLine)) {
      // 保存之前的章节
      if (currentChapter !== null) {
        chapters.push({
          index: chapterIndex - 1,
          title: currentChapter.title,
          content: currentChapter.contentLines.join('\n').trim()
        })
      }

      // 开始新章节
      currentChapter = {
        title: trimmedLine,
        contentLines: []
      }
      chapterIndex++
    } else if (currentChapter !== null && trimmedLine !== '') {
      // 添加到当前章节内容（使用 trim 后的行，去除首尾空格）
      currentChapter.contentLines.push(trimmedLine)
    }
  }

  // 保存最后一个章节
  if (currentChapter !== null) {
    chapters.push({
      index: chapterIndex - 1,
      title: currentChapter.title,
      content: currentChapter.contentLines.join('\n').trim()
    })
  }

  // 如果没有找到任何章节，返回全文
  if (chapters.length === 0) {
    return [{
      index: 0,
      title: '全文',
      content: text.trim()
    }]
  }

  // 重新设置索引
  return chapters.map((chapter, index) => ({
    ...chapter,
    index
  }))
}

/**
 * 检查文本是否包含章节结构
 * @param text 小说文本
 * @param customRegex 自定义章节匹配正则，可选
 */
export const hasChapters = (text: string, customRegex?: RegExp): boolean => {
  const normalized = normalizeLineEndings(text)
  const chapterRegex = customRegex || DEFAULT_CHAPTER_REGEX
  return normalized.split('\n').some(line => chapterRegex.test(line.trim()))
}
