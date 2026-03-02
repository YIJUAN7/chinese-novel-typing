import { ref } from 'vue'

interface TypingProgress {
  chapterIndex: number        // 当前章节索引
  cursorPosition: number      // 在当前章节中的光标位置
  elapsedTime: number         // 累计用时
  errors: number              // 错误数
  correctChars: number        // 正确字符数
  completedAt?: string        // 完成时间（如果已完成）
}

interface NovelProgress {
  [key: string]: TypingProgress // key 是小说标题
}

interface SavedNovel {
  title: string
  content: string
  chapters: string[] // 章节标题列表
  savedAt: string
}

const STORAGE_KEY = 'novel-typing-progress'
const STORAGE_KEY_NOVELS = 'novel-typing-novels'

export const useProgressStorage = () => {
  const progressData = ref<NovelProgress>({})
  const isLoaded = ref(false)
  const savedNovels = ref<SavedNovel[]>([])

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
   * 加载已保存的小说列表
   */
  const loadSavedNovels = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NOVELS)
      if (stored) {
        savedNovels.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('加载小说列表失败:', error)
      savedNovels.value = []
    }
    return savedNovels.value
  }

  /**
   * 保存小说进度（每本小说只保留一个进度）
   * @param novelTitle 小说标题
   * @param progress 进度数据
   */
  const saveNovelProgress = (novelTitle: string, progress: TypingProgress) => {
    // 直接覆盖该小说的进度，只保留最新状态
    progressData.value[novelTitle] = {
      ...progress,
      completedAt: progress.completedAt,
    }
    persistToStorage()
  }

  /**
   * 获取小说进度
   * @param novelTitle 小说标题
   */
  const getNovelProgress = (novelTitle: string): TypingProgress | undefined => {
    return progressData.value[novelTitle]
  }

  /**
   * 删除小说进度
   * @param novelTitle 小说标题
   */
  const deleteNovelProgress = (novelTitle: string) => {
    delete progressData.value[novelTitle]
    persistToStorage()
  }

  /**
   * 获取所有已保存进度的小说
   */
  const getProgressedNovels = () => {
    return Object.keys(progressData.value).map((title) => ({
      title,
      progress: progressData.value[title],
    }))
  }

  /**
   * 保存小说文本
   */
  const saveNovel = (title: string, content: string, chapterTitles: string[] = []) => {
    // 检查是否已存在同名小说
    const existingIndex = savedNovels.value.findIndex(n => n.title === title)
    const novel: SavedNovel = {
      title,
      content,
      chapters: chapterTitles,
      savedAt: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      savedNovels.value[existingIndex] = novel
    } else {
      savedNovels.value.push(novel)
    }
    persistNovelsToStorage()
  }

  /**
   * 获取已保存的小说列表
   */
  const getSavedNovels = () => {
    return savedNovels.value.map(novel => ({
      title: novel.title,
      chapters: novel.chapters,
      savedAt: novel.savedAt,
    }))
  }

  /**
   * 加载指定小说
   */
  const loadNovel = (title: string): { content: string; chapters: string[] } | null => {
    const novel = savedNovels.value.find(n => n.title === title)
    if (novel) {
      return {
        content: novel.content,
        chapters: novel.chapters,
      }
    }
    return null
  }

  /**
   * 删除指定小说
   */
  const deleteNovel = (title: string) => {
    savedNovels.value = savedNovels.value.filter(n => n.title !== title)
    persistNovelsToStorage()
  }

  /**
   * 清空所有小说
   */
  const clearAllNovels = () => {
    savedNovels.value = []
    persistNovelsToStorage()
  }

  /**
   * 清空所有进度
   */
  const clearAllProgress = () => {
    progressData.value = {}
    persistToStorage()
  }

  /**
   * 持久化进度到 localStorage
   */
  const persistToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData.value))
    } catch (error) {
      console.error('保存进度数据失败:', error)
    }
  }

  /**
   * 持久化小说到 localStorage
   */
  const persistNovelsToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY_NOVELS, JSON.stringify(savedNovels.value))
    } catch (error) {
      console.error('保存小说数据失败:', error)
    }
  }

  // 初始化时加载数据
  loadProgress()
  loadSavedNovels()

  return {
    progressData,
    isLoaded,
    savedNovels,
    loadProgress,
    loadSavedNovels,
    saveNovelProgress,
    getNovelProgress,
    deleteNovelProgress,
    clearAllProgress,
    getProgressedNovels,
    saveNovel,
    getSavedNovels,
    loadNovel,
    deleteNovel,
    clearAllNovels,
  }
}
