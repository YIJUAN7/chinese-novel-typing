export interface Chapter {
  index: number
  title: string
  content: string
}

/**
 * 中文章节标题正则表达式
 * 匹配格式：
 * - 第一章
 * - 第一章：标题
 * - 第一章 标题
 * - 第 1 章
 * - 第一卷 第一章
 * - 楔子
 * - 序章
 * - 尾声
 * - 大结局
 */
const CHAPTER_REGEX = /^(?:(?:第 [零〇一二三四五六七八九十百千万 0-9]+[卷章回])|(?:(?:楔 | 序 | 尾) 子)|(?:大结局)).*$/m

/**
 * 更宽松的章节匹配，用于查找所有章节位置
 */
const CHAPTER_POSITION_REGEX = /(?:^|\n)((?:(?:第 [零〇一二三四五六七八九十百千万 0-9]+[卷章回])|(?:(?:楔 | 序 | 尾) 子)|(?:大结局))[.:：. \t\n]*)/g

/**
 * 从小说文本中识别并分割章节
 * @param text - 小说全文
 * @returns Chapter[] 章节数组
 */
export const parseChapters = (text: string): Chapter[] => {
  // 如果文本中没有找到章节标记，将整篇文本作为单章
  const matches = [...text.matchAll(CHAPTER_POSITION_REGEX)]

  if (matches.length === 0) {
    return [{
      index: 0,
      title: '全文',
      content: text.trim()
    }]
  }

  const chapters: Chapter[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const title = match[1].trim()
    const startIndex = match.index! + match[1].length

    // 下一章节的起始位置
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index! : text.length

    // 提取章节内容（不包含标题）
    const content = text.slice(startIndex, nextIndex).trim()

    chapters.push({
      index: i,
      title: title,
      content: content
    })
  }

  return chapters
}

/**
 * 检查文本是否包含章节结构
 * @param text - 小说文本
 * @returns boolean 是否包含章节
 */
export const hasChapters = (text: string): boolean => {
  return CHAPTER_POSITION_REGEX.test(text)
}
