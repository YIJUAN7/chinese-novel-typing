import { ref, computed } from 'vue'
import type { Chapter } from '@/utils/chapterParser'

export const useChapter = () => {
  const chapters = ref<Chapter[]>([])
  const currentChapterIndex = ref<number | null>(null)
  const isChapterListOpen = ref(false)

  const hasChapters = computed(() => chapters.value.length > 0)

  const currentChapter = computed(() => {
    if (currentChapterIndex.value === null) return null
    return chapters.value[currentChapterIndex.value]
  })

  const currentChapterContent = computed(() => {
    return currentChapter.value?.content || ''
  })

  const currentChapterTitle = computed(() => {
    return currentChapter.value?.title || ''
  })

  /**
   * 设置章节列表
   */
  const setChapters = (newChapters: Chapter[]) => {
    chapters.value = newChapters
    if (newChapters.length > 0) {
      currentChapterIndex.value = 0
    }
  }

  /**
   * 选择指定章节
   */
  const selectChapter = (index: number) => {
    if (index >= 0 && index < chapters.value.length) {
      currentChapterIndex.value = index
    }
  }

  /**
   * 切换到下一章
   */
  const nextChapter = () => {
    if (currentChapterIndex.value !== null && currentChapterIndex.value < chapters.value.length - 1) {
      currentChapterIndex.value++
      return true
    }
    return false
  }

  /**
   * 切换到上一章
   */
  const prevChapter = () => {
    if (currentChapterIndex.value !== null && currentChapterIndex.value > 0) {
      currentChapterIndex.value--
      return true
    }
    return false
  }

  /**
   * 打开章节列表
   */
  const openChapterList = () => {
    isChapterListOpen.value = true
  }

  /**
   * 关闭章节列表
   */
  const closeChapterList = () => {
    isChapterListOpen.value = false
  }

  /**
   * 重置章节状态
   */
  const resetChapters = () => {
    chapters.value = []
    currentChapterIndex.value = null
    isChapterListOpen.value = false
  }

  return {
    // 状态
    chapters,
    currentChapterIndex,
    isChapterListOpen,
    hasChapters,
    currentChapter,
    currentChapterContent,
    currentChapterTitle,

    // 方法
    setChapters,
    selectChapter,
    nextChapter,
    prevChapter,
    openChapterList,
    closeChapterList,
    resetChapters,
  }
}
