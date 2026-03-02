import { ref, watch } from 'vue'

interface TypingProgress {
  chapterIndex: number
  cursorPosition: number
  elapsedTime: number
  errors: number
  correctChars: number
  completedAt?: string
}

interface ChapterProgress {
  [key: string]: TypingProgress // key 是章节标题或唯一标识
}

const STORAGE_KEY = 'novel-typing-progress'

export const useProgressStorage = () => {
  const progressData = ref<ChapterProgress>({})
  const isLoaded = ref(false)

  /**
   * 加载进度数据
   */
  const loadProgress = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        progressData.value = JSON.parse(stored)
      }
      isLoaded.value = true
    } catch (error) {
      console.error('加载进度数据失败:', error)
      progressData.value = {}
      isLoaded.value = true
    }
    return progressData.value
  }

  /**
   * 保存章节进度
   */
  const saveChapterProgress = (chapterTitle: string, progress: TypingProgress) => {
    progressData.value[chapterTitle] = {
      ...progress,
      completedAt: progress.cursorPosition >= 100 ? new Date().toISOString() : undefined,
    }
    persistToStorage()
  }

  /**
   * 获取章节进度
   */
  const getChapterProgress = (chapterTitle: string): TypingProgress | undefined => {
    return progressData.value[chapterTitle]
  }

  /**
   * 删除章节进度
   */
  const deleteChapterProgress = (chapterTitle: string) => {
    delete progressData.value[chapterTitle]
    persistToStorage()
  }

  /**
   * 清空所有进度
   */
  const clearAllProgress = () => {
    progressData.value = {}
    persistToStorage()
  }

  /**
   * 持久化到 localStorage
   */
  const persistToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData.value))
    } catch (error) {
      console.error('保存进度数据失败:', error)
    }
  }

  /**
   * 获取所有已保存进度的章节
   */
  const getProgressedChapters = () => {
    return Object.keys(progressData.value).map((title) => ({
      title,
      progress: progressData.value[title],
    }))
  }

  // 初始化时加载数据
  loadProgress()

  return {
    progressData,
    isLoaded,
    loadProgress,
    saveChapterProgress,
    getChapterProgress,
    deleteChapterProgress,
    clearAllProgress,
    getProgressedChapters,
  }
}
