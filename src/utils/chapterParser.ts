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
 * 简单的章节标题正则表达式
 * 匹配包含 "第 X 章" 格式的行（X 可以是任意字符，支持中文数字和阿拉伯数字）
 */
const CHAPTER_LINE_REGEX = /第.+章/

/**
 * 从小说文本中识别并分割章节
 * 采用逐行扫描的方式，更可靠
 */
export const parseChapters = (text: string): Chapter[] => {
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
    if (CHAPTER_LINE_REGEX.test(trimmedLine)) {
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
      // 添加到当前章节内容
      currentChapter.contentLines.push(line)
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
 */
export const hasChapters = (text: string): boolean => {
  const normalized = normalizeLineEndings(text)
  return normalized.split('\n').some(line => CHAPTER_LINE_REGEX.test(line.trim()))
}
