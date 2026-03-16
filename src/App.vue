<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import ControlBar from './components/ControlBar.vue'
import TypingEditor from './components/TypingEditor.vue'
import ChapterList from './components/ChapterList.vue'
import AnnouncementModal from './components/AnnouncementModal.vue'
import { useChapter } from './composables/useChapter'
import { parseChapters } from './utils/chapterParser'
import { useProgressStorage } from './composables/useProgressStorage'
import { initTheme, getBuiltInThemes, setTheme } from './utils/themes'
import { announcements } from './data/announcements'
import type { Announcement } from './data/announcements'

// 已保存小说列表弹窗状态
const isSavedNovelsOpen = ref(false)

// 设置面板状态
const isSettingsOpen = ref(false)
const currentTheme = ref('light')
const skipPunctuation = ref(false)
const customSkipChars = ref('')
const pendingLines = ref(0)

// 公告相关
const showAnnouncement = ref(false)
const currentAnnouncement = ref<Announcement | null>(null)

// 默认示例文本
const defaultText = `多年以后，奥雷连诺上校站在行刑队面前，准会想起父亲带他去参观冰块的那个遥远的下午。`

const originalText = ref(defaultText)
const progress = ref(0)
const isComplete = ref(false)
const editorRef = ref<InstanceType<typeof TypingEditor> | null>(null)

// 章节管理
const {
  chapters,
  currentChapterIndex,
  isChapterListOpen,
  currentChapterTitle,
  setChapters,
  selectChapter,
  closeChapterList,
  openChapterList,
  resetChapters,
} = useChapter()

// 进度保存
const { saveNovelProgress, getNovelProgress, saveNovel, getSavedNovels, loadNovel, deleteNovel } = useProgressStorage()

// 当前小说标题（用于进度保存）
const currentNovelTitle = ref('')

// 截断标题到最多 15 个字
const truncateTitle = (title: string) => {
  if (!title) return ''
  return title.length > 15 ? title.slice(0, 15) + '...' : title
}

// 当前统计数据
const currentStats = ref({
  elapsedTime: 0,
  errors: 0,
  correctChars: 0,
  wpm: 0,
})

// 格式化时间显示（与 TypingEditor.vue 保持一致）
const formatTime = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds)

  if (totalSeconds >= 3600) {
    // 超过 1 小时：显示 X 小时 Y 分 Z 秒
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hours}小时${minutes}分${secs}秒`
  } else if (totalSeconds >= 60) {
    // 超过 1 分钟：显示 Y 分 Z 秒
    const minutes = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${minutes}分${secs}秒`
  } else {
    // 小于 1 分钟：显示 X 秒
    return `${totalSeconds}秒`
  }
}

// 处理文本导入（包含章节解析）
const handleImportText = (text: string, fileName?: string, customRegexStr?: string) => {
  // 解析自定义正则
  let customRegex: RegExp | undefined
  if (customRegexStr) {
    try {
      // 支持两种格式：
      // 1. 带斜杠和标志：/pattern/flags
      // 2. 纯正则字符串：pattern
      let pattern: string
      let flags: string = ''

      if (customRegexStr.startsWith('/') && customRegexStr.lastIndexOf('/') > 0) {
        // 格式：/pattern/flags
        const lastSlashIndex = customRegexStr.lastIndexOf('/')
        pattern = customRegexStr.slice(1, lastSlashIndex)
        flags = customRegexStr.slice(lastSlashIndex + 1)
      } else {
        // 格式：pattern
        pattern = customRegexStr
      }

      customRegex = new RegExp(pattern, flags)
    } catch (e) {
      console.error('自定义正则无效:', e)
      customRegex = undefined
    }
  }

  // 解析章节（使用原始文本，保留空格以便正则匹配）
  const parsedChapters = parseChapters(text, customRegex)
  console.log('解析到的章节数:', parsedChapters.length)
  console.log('章节列表:', parsedChapters.map(c => c.title))
  setChapters(parsedChapters)

  // 保存小说文本（格式化后的文本）
  // 优先使用文件名作为小说名，如果没有文件名则使用章节名
  const novelTitle = fileName
    ? `${fileName}-${new Date().toLocaleDateString('zh-CN')}`
    : parsedChapters.length > 0
      ? `小说-${parsedChapters[0]?.title}-${new Date().toLocaleDateString('zh-CN')}`
      : `小说-${new Date().toLocaleDateString('zh-CN')}`
  const chapterTitles = parsedChapters.map(c => c.title)
  const formattedText = text.replace(/[\u3000 ]/g, '')
  saveNovel(novelTitle, formattedText, chapterTitles)
  currentNovelTitle.value = novelTitle

  // 如果有多个章节，显示第一章并恢复进度
  if (parsedChapters.length > 0) {
    const firstChapter = parsedChapters[0]
    if (!firstChapter) return

    console.log('第一章标题:', firstChapter.title)
    console.log('第一章内容长度:', firstChapter.content.length)
    originalText.value = firstChapter.content

    // 重置编辑器滚动位置到顶部
    nextTick(() => {
      const editorElement = document.querySelector('.editor-content')
      if (editorElement) {
        editorElement.scrollTop = 0
      }
    })

    // 恢复该小说的进度
    const savedProgress = getNovelProgress(novelTitle)
    if (savedProgress) {
      console.log('检测到已保存的进度:', savedProgress)

      // 如果保存的章节索引有效，切换到对应章节
      const targetIndex = savedProgress.chapterIndex || 0
      let targetChapter = firstChapter

      if (targetIndex < parsedChapters.length && targetIndex > 0) {
        const chapter = parsedChapters[targetIndex]
        if (chapter) {
          targetChapter = chapter
          selectChapter(targetIndex)
          originalText.value = targetChapter.content
        }
      }

      // 只要有进度记录就提示恢复（包括 cursorPosition = 0 的情况）
      const positionText = savedProgress.cursorPosition > 0
        ? `第 ${savedProgress.cursorPosition} 字`
        : `第 ${targetIndex + 1} 章开头`
      const resume = confirm(`检测到"${novelTitle}"已练习到${positionText}，是否恢复进度？`)
      if (resume) {
        nextTick(() => {
          editorRef.value?.setCursorPosition(savedProgress.cursorPosition)
          // 初始化统计状态：时间恢复，正确字符数设为光标位置，错误数恢复
          editorRef.value?.initStats(savedProgress.cursorPosition, savedProgress.elapsedTime, savedProgress.errors)
          progress.value = (savedProgress.cursorPosition / targetChapter.content.length) * 100
          currentStats.value = {
            elapsedTime: savedProgress.elapsedTime,
            errors: savedProgress.errors,
            correctChars: savedProgress.cursorPosition,
            wpm: 0,

          }
        })
      }
    }
  } else {
    originalText.value = text
  }

  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0, wpm: 0 }
}

const handleProgress = (value: number) => {
  progress.value = value
}

const handleStatsChange = (stats: { elapsedTime: number; errors: number; correctChars: number; wpm: number }) => {
  currentStats.value = stats

  // 实时更新进度保存（每本小说只保留一个最新进度）
  if (currentNovelTitle.value) {
    saveNovelProgress(currentNovelTitle.value, {
      chapterIndex: currentChapterIndex.value || 0,
      cursorPosition: Math.round((progress.value / 100) * originalText.value.length),
      ...stats,
    })
  }
}

const handleComplete = () => {
  isComplete.value = true

  // 获取最终的统计数据（确保时间是最新的）
  const finalStats = editorRef.value?.getStats()
  if (finalStats) {
    currentStats.value = finalStats
  }

  // 保存完成状态（每本小说只保留一个最新进度）
  // 完成一章后，进度保存为下一章的开头
  if (currentNovelTitle.value && currentChapterIndex.value !== null) {
    const nextChapterIndex = currentChapterIndex.value + 1
    saveNovelProgress(currentNovelTitle.value, {
      chapterIndex: nextChapterIndex,  // 保存为下一章索引
      cursorPosition: 0,               // 下一章从头开始
      ...currentStats.value,
      completedAt: new Date().toISOString(),
    })
  }
}

const handleReset = () => {
  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0, wpm: 0 }

  // 重置编辑器状态（触发原文变化以重置内部状态）
  const currentText = originalText.value
  originalText.value = ''
  nextTick(() => {
    originalText.value = currentText
  })
}

// 下一章或重置
const handleNextOrReset = () => {
  if (!isComplete.value) return

  // 尝试切换到下一章
  if (chapters.value.length > 0 && currentChapterIndex.value !== null) {
    const hasNext = currentChapterIndex.value < chapters.value.length - 1
    if (hasNext) {
      const nextIndex = currentChapterIndex.value + 1
      const nextChapter = chapters.value[nextIndex]
      if (nextChapter) {
        // 先保存当前进度（更新章节索引）
        const currentFinalStats = editorRef.value?.getStats()
        if (currentFinalStats && currentNovelTitle.value) {
          saveNovelProgress(currentNovelTitle.value, {
            chapterIndex: nextIndex, // 更新为下一章的索引
            cursorPosition: 0, // 下一章从头开始
            ...currentFinalStats,
          })
        }

        selectChapter(nextIndex)
        originalText.value = nextChapter.content

        // 重置编辑器滚动位置到顶部
        nextTick(() => {
          const editorElement = document.querySelector('.editor-content')
          if (editorElement) {
            editorElement.scrollTop = 0
          }
        })

        // 检查该小说是否有已保存的进度
        const savedProgress = getNovelProgress(currentNovelTitle.value)
        if (savedProgress && savedProgress.cursorPosition > 0 && savedProgress.chapterIndex === nextIndex) {
          const resume = confirm(`检测到"${nextChapter.title}"已练习到第 ${savedProgress.cursorPosition} 字，是否恢复进度？`)
          if (resume) {
            nextTick(() => {
              editorRef.value?.setCursorPosition(savedProgress.cursorPosition)
              // 初始化统计状态：时间恢复，正确字符数设为光标位置，错误数恢复
              editorRef.value?.initStats(savedProgress.cursorPosition, savedProgress.elapsedTime, savedProgress.errors)
              progress.value = (savedProgress.cursorPosition / nextChapter.content.length) * 100
              currentStats.value = {
                elapsedTime: savedProgress.elapsedTime,
                errors: savedProgress.errors,
                correctChars: savedProgress.cursorPosition,
                wpm: 0,

              }
            })
            return // 如果恢复进度，直接返回
          }
        }
      }
    }
  }

  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0, wpm: 0 }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (isComplete.value) {
    e.preventDefault()
    handleNextOrReset()
  }
}

const handleOpenChapterList = () => {
  if (chapters.value.length > 0) {
    openChapterList()
  }
}

const handleOpenSavedNovels = () => {
  isSavedNovelsOpen.value = true
}

const handleSelectSavedNovel = (novel: { title: string; chapters: string[] }) => {
  const loaded = loadNovel(novel.title)
  if (loaded) {
    // 从 LocalStorage 加载自定义正则
    let customRegex: RegExp | undefined
    const savedRegex = localStorage.getItem('customChapterRegex')
    const useCustomRegex = localStorage.getItem('useCustomRegex') === 'true'
    if (useCustomRegex && savedRegex) {
      try {
        // 支持两种格式：/pattern/flags 或 pattern
        let pattern: string
        let flags: string = ''

        if (savedRegex.startsWith('/') && savedRegex.lastIndexOf('/') > 0) {
          const lastSlashIndex = savedRegex.lastIndexOf('/')
          pattern = savedRegex.slice(1, lastSlashIndex)
          flags = savedRegex.slice(lastSlashIndex + 1)
        } else {
          pattern = savedRegex
        }

        customRegex = new RegExp(pattern, flags)
      } catch (e) {
        console.error('自定义正则无效:', e)
        customRegex = undefined
      }
    }

    // 解析章节
    const parsedChapters = parseChapters(loaded.content, customRegex)
    setChapters(parsedChapters)

    // 设置当前小说标题
    currentNovelTitle.value = novel.title

    if (parsedChapters.length > 0) {
      const firstChapter = parsedChapters[0]
      if (!firstChapter) return

      originalText.value = firstChapter.content

      // 重置编辑器滚动位置到顶部
      nextTick(() => {
        const editorElement = document.querySelector('.editor-content')
        if (editorElement) {
          editorElement.scrollTop = 0
        }
      })

      // 恢复该小说的进度
      const savedProgress = getNovelProgress(novel.title)
      if (savedProgress) {
        // 如果保存的章节索引有效，切换到对应章节
        const targetIndex = savedProgress.chapterIndex || 0
        let targetChapter = parsedChapters[0]

        // 检查是否有下一章
        if (targetIndex < parsedChapters.length && targetIndex > 0) {
          const chapter = parsedChapters[targetIndex]
          if (chapter) {
            targetChapter = chapter
            selectChapter(targetIndex)
            originalText.value = targetChapter.content
          }
        }

        // 如果有进度（cursorPosition > 0）或已保存下一章进度，提示恢复
        if (savedProgress.cursorPosition > 0 || (targetIndex > 0 && targetIndex <= parsedChapters.length)) {
          const resume = confirm(`检测到"${novel.title}"已练习到第 ${savedProgress.cursorPosition} 字（第${targetIndex + 1}章开头），是否恢复进度？`)
          if (resume) {
            nextTick(() => {
              editorRef.value?.setCursorPosition(savedProgress.cursorPosition)
              // 初始化统计状态：时间恢复，正确字符数设为光标位置，错误数恢复
              editorRef.value?.initStats(savedProgress.cursorPosition, savedProgress.elapsedTime, savedProgress.errors)
              progress.value = (savedProgress.cursorPosition / originalText.value.length) * 100
              currentStats.value = {
                elapsedTime: savedProgress.elapsedTime,
                errors: savedProgress.errors,
                correctChars: savedProgress.cursorPosition,
                wpm: 0,

              }
            })
          }
        }
      }
    } else {
      originalText.value = loaded.content
    }

    isComplete.value = false
    progress.value = 0
    currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0, wpm: 0 }
    isSavedNovelsOpen.value = false
  }
}

const handleDeleteNovel = (novel: { title: string; chapters: string[] }) => {
  if (confirm(`确定要删除"${novel.title}"吗？`)) {
    deleteNovel(novel.title)
  }
}

const handleSelectChapter = (chapter: { index: number; title: string; content: string }) => {
  selectChapter(chapter.index)
  originalText.value = chapter.content
  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0, wpm: 0 }

  // 重置编辑器滚动位置到顶部
  nextTick(() => {
    const editorElement = document.querySelector('.editor-content')
    if (editorElement) {
      editorElement.scrollTop = 0
    }
  })

  // 恢复该小说的进度（检查是否是该章节）
  if (currentNovelTitle.value) {
    const savedProgress = getNovelProgress(currentNovelTitle.value)
    if (savedProgress && savedProgress.cursorPosition > 0 && savedProgress.chapterIndex === chapter.index) {
      // 询问用户是否要恢复进度
      const resume = confirm(`检测到"${chapter.title}"已练习到第 ${savedProgress.cursorPosition} 字，是否恢复进度？`)
      if (resume) {
        // 设置编辑器光标位置
        nextTick(() => {
          editorRef.value?.setCursorPosition(savedProgress.cursorPosition)
          // 初始化统计状态：时间恢复，正确字符数设为光标位置，错误数恢复
          editorRef.value?.initStats(savedProgress.cursorPosition, savedProgress.elapsedTime, savedProgress.errors)
          // 更新进度条
          progress.value = (savedProgress.cursorPosition / chapter.content.length) * 100
          // 恢复统计数据
          currentStats.value = {
            elapsedTime: savedProgress.elapsedTime,
            errors: savedProgress.errors,
            correctChars: savedProgress.cursorPosition,
            wpm: 0,

          }
        })
      }
    }
  }
}

// 监听原文变化
watch(
  () => originalText.value,
  () => {
    isComplete.value = false
    progress.value = 0
  }
)

// 监听章节重置
watch(
  () => chapters.value.length,
  (newLength) => {
    if (newLength === 0) {
      resetChapters()
    }
  }
)

// 监听键盘事件（完成状态下按任意键开始下一章）
onMounted(() => {
  // 初始化主题
  initTheme()
  currentTheme.value = localStorage.getItem('novel-typing-theme') || 'light'

  // 加载跟打符号设置
  skipPunctuation.value = localStorage.getItem('skipPunctuation') === 'true'
  // 加载自定义跳过符号设置
  customSkipChars.value = localStorage.getItem('customSkipChars') || ''
  // 加载未跟打行数设置
  pendingLines.value = parseInt(localStorage.getItem('pendingLines') || '0')

  // 检查未读公告
  const readIds = JSON.parse(localStorage.getItem('readAnnouncements') || '[]')
  const unread = announcements.filter(a => !readIds.includes(a.id))
  if (unread.length > 0) {
    // 显示最新的未读公告（数组第一个是最新的）
    const latestAnnouncement = unread[0]
    if (latestAnnouncement) {
      currentAnnouncement.value = latestAnnouncement
      showAnnouncement.value = true
    }
  }

  window.addEventListener('keydown', handleKeydown)
  // 页面加载时自动聚焦到输入区域
  nextTick(() => {
    editorRef.value?.focusEditor()
  })
})

// 处理公告确认
const handleAnnouncementConfirm = () => {
  if (currentAnnouncement.value) {
    const readIds = JSON.parse(localStorage.getItem('readAnnouncements') || '[]')
    readIds.push(currentAnnouncement.value.id)
    localStorage.setItem('readAnnouncements', JSON.stringify(readIds))
    showAnnouncement.value = false
  }
}

// 主题相关函数
const themes = getBuiltInThemes()

const handleThemeChange = (themeName: string) => {
  setTheme(themeName)
  currentTheme.value = themeName
}

// 处理跟打符号设置变更
const handleSkipPunctuationChange = () => {
  localStorage.setItem('skipPunctuation', skipPunctuation.value ? 'true' : 'false')
}

// 处理自定义跳过符号设置变更
const handleCustomSkipCharsChange = () => {
  localStorage.setItem('customSkipChars', customSkipChars.value)
}

// 处理未跟打行数设置变更
const handlePendingLinesChange = () => {
  const val = pendingLines.value < 0 ? 0 : pendingLines.value
  pendingLines.value = val
  localStorage.setItem('pendingLines', val.toString())
  // 触发编辑器更新
  nextTick(() => {
    editorRef.value?.focusEditor()
  })
}

// 打开设置面板
const openSettings = () => {
  isSettingsOpen.value = true
  // 加载跟打符号设置
  skipPunctuation.value = localStorage.getItem('skipPunctuation') === 'true'
  // 加载自定义跳过符号设置
  customSkipChars.value = localStorage.getItem('customSkipChars') || ''
  // 加载未跟打行数设置
  pendingLines.value = parseInt(localStorage.getItem('pendingLines') || '0')
}

// 关闭设置面板
const closeSettings = () => {
  isSettingsOpen.value = false
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>{{ truncateTitle(currentChapterTitle) || '小说跟打器' }}</h1>
    </header>

    <main class="app-main">
      <ControlBar
        :chapter-count="chapters.length"
        @import-text="handleImportText"
        @reset="handleReset"
        @open-chapter-list="handleOpenChapterList"
        @open-saved-novels="handleOpenSavedNovels"
        @open-settings="openSettings"
      />

      <div class="editor-wrapper">
        <TypingEditor
          ref="editorRef"
          :original-text="originalText"
          :skip-punctuation="skipPunctuation"
          :custom-skip-chars="customSkipChars"
          :pending-lines="pendingLines"
          @progress="handleProgress"
          @complete="handleComplete"
          @stats-change="handleStatsChange"
        />
      </div>

      <!-- 进度条 -->
      <div class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progress + '%' }"
            :class="{ complete: isComplete }"
          ></div>
        </div>
        <span class="progress-text">{{ progress.toFixed(0) }}%</span>
      </div>
    </main>

    <!-- 完成弹窗 -->
    <div v-if="isComplete" class="complete-modal-overlay" @click.self="handleNextOrReset">
      <div class="complete-modal">
        <h2>🎉 恭喜完成！</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ formatTime(currentStats.elapsedTime) }}</div>
            <div class="stat-label">时间</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.wpm }} 字/分</div>
            <div class="stat-label">速度</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.errors }}</div>
            <div class="stat-label">错误</div>
          </div>
        </div>
        <p class="modal-tip-text">按任意键开始下一章</p>
      </div>
    </div>

    <!-- 章节列表 -->
    <ChapterList
      :chapters="chapters"
      :current-chapter-index="currentChapterIndex"
      :show="isChapterListOpen"
      @select="handleSelectChapter"
      @close="closeChapterList"
    />

    <!-- 小说列表 -->
    <div v-if="isSavedNovelsOpen" class="modal-overlay" @click.self="isSavedNovelsOpen = false">
      <div class="saved-novels-modal">
        <div class="modal-header">
          <h2>📚 小说列表</h2>
          <button class="close-btn" @click="isSavedNovelsOpen = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="getSavedNovels().length === 0" class="empty-state">
            <p>暂无已保存的小说</p>
            <p class="tip-text">导入小说后会自动保存</p>
          </div>
          <div v-else class="novel-list">
            <div
              v-for="novel in getSavedNovels()"
              :key="novel.title"
              class="novel-item"
            >
              <div class="novel-info">
                <h3 class="novel-title">{{ novel.title }}</h3>
                <p class="novel-meta">
                  <span class="chapter-count">{{ novel.chapters.length }} 章</span>
                  <span class="saved-time">{{ new Date(novel.savedAt).toLocaleString('zh-CN') }}</span>
                </p>
              </div>
              <div class="novel-actions">
                <button class="btn btn-sm btn-primary" @click="handleSelectSavedNovel(novel)">
                  加载
                </button>
                <button class="btn btn-sm btn-danger" @click="handleDeleteNovel(novel)">
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 作者信息 -->
    <footer class="app-footer">by 寒号鸟</footer>

    <!-- 设置面板 -->
    <div v-if="isSettingsOpen" class="modal-overlay" @click.self="closeSettings">
      <div class="settings-modal">
        <div class="modal-header">
          <h2>⚙️ 设置</h2>
          <button class="close-btn" @click="closeSettings">×</button>
        </div>
        <div class="modal-body">
          <div class="setting-section">
            <h3 class="section-title">主题选择</h3>
            <div class="theme-grid">
              <div
                v-for="theme in themes"
                :key="theme.name"
                class="theme-card"
                :class="{ active: currentTheme === theme.name }"
                @click="handleThemeChange(theme.name)"
              >
                <div class="theme-preview" :style="{ background: theme.colors.bgPrimary }">
                  <div class="theme-preview-text" :style="{ color: theme.colors.textPrimary }">
                    Aa
                  </div>
                </div>
                <span class="theme-name">{{ theme.label }}</span>
                <span v-if="currentTheme === theme.name" class="theme-check">✓</span>
              </div>
            </div>
          </div>
          <div class="setting-section">
            <h3 class="section-title">打字设置</h3>
            <label class="checkbox-label">
              <input type="checkbox" v-model="skipPunctuation" @change="handleSkipPunctuationChange" />
              <span>不跟打符号（自动跳过标点符号和换行符）</span>
            </label>
            <div class="custom-skip-chars">
              <label for="customSkipChars" class="custom-skip-label">自定义跳过符号（留空使用默认）：</label>
              <input
                id="customSkipChars"
                type="text"
                v-model="customSkipChars"
                @input="handleCustomSkipCharsChange"
                placeholder="例如：，。！？或 \\n \\t"
                class="text-input"
              />
              <p class="hint-text">支持转义符号：<code>\n</code>（换行）、<code>\t</code>（制表符）、<code>\r</code>（回车）、<code>\\</code>（反斜杠）</p>
            </div>
            <div class="pending-lines-setting">
              <label for="pendingLines" class="pending-lines-label">未跟打文本显示行数（0 表示全部显示）：</label>
              <input
                id="pendingLines"
                type="number"
                min="0"
                v-model.number="pendingLines"
                @input="handlePendingLinesChange"
                placeholder="0"
                class="text-input number-input"
              />
              <p class="hint-text">0=全部显示，1=只显示当前行，2=显示当前行及下一行，以此类推</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新公告 -->
    <AnnouncementModal
      :show="showAnnouncement"
      :announcement="currentAnnouncement"
      @confirm="handleAnnouncementConfirm"
    />
  </div>
</template>

<style>
@import './styles/main.css';

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  flex-shrink: 0;
  text-align: center;
  padding: 8px var(--spacing-lg);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.app-header h1 {
  font-size: 22px;
  color: var(--color-primary);
  margin: 0;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px var(--spacing-lg);
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  min-height: 0;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  margin-bottom: 8px;
}

.progress-container {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: 8px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-fill.complete {
  background: var(--color-success);
}

.progress-text {
  min-width: 50px;
  text-align: right;
  font-size: 14px;
  color: var(--text-secondary);
}

.complete-message {
  flex-shrink: 0;
  text-align: center;
  padding: 8px;
  margin-top: 4px;
  font-size: 16px;
  color: var(--color-success);
  animation: celebrate 0.5s ease;
}

@keyframes celebrate {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.complete-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.complete-modal {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-xl);
  text-align: center;
  max-width: 400px;
  width: 90%;
  animation: slideUp 0.3s ease;
}

.complete-modal h2 {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  background: var(--bg-tertiary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.complete-modal .btn {
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: 16px;
}

.modal-tip-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* 已保存小说列表样式 */
.saved-novels-modal {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.saved-novels-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.saved-novels-modal .modal-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
}

/* 小说列表 */
.saved-novels-modal .modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: 60vh;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
}

.empty-state p {
  margin: 8px 0;
}

.empty-state .tip-text {
  font-size: 12px;
  color: var(--text-disabled);
}

.novel-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.novel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  gap: var(--spacing-md);
}

.novel-info {
  flex: 1;
  min-width: 0;
}

.novel-title {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.novel-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  display: flex;
  gap: var(--spacing-sm);
}

.novel-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.btn-danger {
  background-color: var(--color-error);
  color: white;
}

.btn-danger:hover {
  background-color: var(--color-error-dark);
}

/* 小说列表弹窗遮罩层 - 居中显示 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

/* 作者信息 */
.app-footer {
  position: fixed;
  bottom: 8px;
  right: 16px;
  font-size: 12px;
  color: var(--text-hint);
  user-select: none;
}

/* 通用关闭按钮样式 */
.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-tertiary);
}

/* 设置按钮 */
.settings-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.settings-btn:hover {
  background: var(--bg-secondary);
}

/* 设置面板样式 */
.settings-modal {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.settings-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.settings-modal .modal-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
}

.settings-modal .modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: 70vh;
}

.setting-section {
  margin-bottom: var(--spacing-lg);
}

.setting-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
  font-weight: 500;
}

/* 自定义跳过符号输入框 */
.custom-skip-chars {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.custom-skip-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.text-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--bg-secondary);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.2s;
}

.text-input:focus {
  border-color: var(--color-primary);
}

.text-input::placeholder {
  color: var(--text-hint);
}

.hint-text {
  margin-top: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-hint);
}

.hint-text code {
  display: inline-block;
  padding: 1px 4px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

/* 未跟打行数设置 */
.pending-lines-setting {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.pending-lines-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.number-input {
  width: 100px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

/* 主题网格 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-md);
}

.theme-card {
  position: relative;
  border: 2px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.theme-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
}

.theme-card.active {
  border-color: var(--color-primary);
  background: var(--bg-secondary);
}

.theme-preview {
  width: 100%;
  aspect-ratio: 16/10;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-xs);
}

.theme-preview-text {
  font-size: 20px;
  font-weight: bold;
  font-family: serif;
}

.theme-name {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
}

.theme-check {
  position: absolute;
  top: 4px;
  right: 4px;
  color: var(--color-primary);
  font-size: 16px;
  font-weight: bold;
}

/* 动画 */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
