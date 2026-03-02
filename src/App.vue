<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlBar from './components/ControlBar.vue'
import TypingEditor from './components/TypingEditor.vue'
import ChapterList from './components/ChapterList.vue'
import { useChapter } from './composables/useChapter'
import { parseChapters } from './utils/chapterParser'
import { useProgressStorage } from './composables/useProgressStorage'

// 默认示例文本
const defaultText = `那是一个很好的时代，那是一个糟糕的时代；那是一个智慧的年代，那是一个愚昧的年代。`

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
  resetChapters,
} = useChapter()

// 进度保存
const { saveChapterProgress, getChapterProgress } = useProgressStorage()

// 当前统计数据
const currentStats = ref({
  elapsedTime: 0,
  errors: 0,
  correctChars: 0,
})

// 处理文本导入（包含章节解析）
const handleImportText = (text: string) => {
  // 解析章节
  const parsedChapters = parseChapters(text)
  setChapters(parsedChapters)

  // 如果有多个章节，显示第一章并恢复进度
  if (parsedChapters.length > 0) {
    const firstChapter = parsedChapters[0]
    originalText.value = firstChapter.content

    // 恢复该章节的进度
    const savedProgress = getChapterProgress(firstChapter.title)
    if (savedProgress) {
      // 如果有保存的进度，可以选择恢复或不恢复
      // 这里暂时不自动恢复，让用户选择
      console.log('检测到已保存的进度:', savedProgress)
    }
  } else {
    originalText.value = text
  }

  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0 }
}

const handleProgress = (value: number) => {
  progress.value = value
}

const handleStatsChange = (stats: { elapsedTime: number; errors: number; correctChars: number }) => {
  currentStats.value = stats

  // 实时更新进度保存
  if (currentChapterTitle.value) {
    saveChapterProgress(currentChapterTitle.value, {
      chapterIndex: currentChapterIndex.value || 0,
      cursorPosition: Math.round((progress.value / 100) * originalText.value.length),
      ...stats,
    })
  }
}

const handleComplete = () => {
  isComplete.value = true

  // 保存完成状态
  if (currentChapterTitle.value) {
    saveChapterProgress(currentChapterTitle.value, {
      chapterIndex: currentChapterIndex.value || 0,
      cursorPosition: originalText.value.length,
      ...currentStats.value,
      completedAt: new Date().toISOString(),
    })
  }
}

const handleReset = () => {
  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0 }
}

const handleStart = () => {
  editorRef.value?.focusEditor()
}

const handleOpenChapterList = () => {
  if (chapters.value.length > 0) {
    closeChapterList()
  }
}

const handleSelectChapter = (chapter: { index: number; title: string; content: string }) => {
  selectChapter(chapter.index)
  originalText.value = chapter.content
  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0 }

  // 恢复该章节的进度（可选功能）
  const savedProgress = getChapterProgress(chapter.title)
  if (savedProgress && savedProgress.cursorPosition > 0) {
    // 询问用户是否要恢复进度
    const resume = confirm(`检测到"${chapter.title}"已练习到第 ${savedProgress.cursorPosition} 字，是否恢复进度？`)
    if (resume) {
      // 这里需要 TypingEditor 支持设置初始光标位置
      // 暂时不实现，留给后续版本
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
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>小说跟打器</h1>
      <p class="subtitle">
        <span v-if="currentChapterTitle">当前章节：{{ currentChapterTitle }}</span>
        <span v-else>在光标后显示待输入文本的创新打字练习工具</span>
      </p>
    </header>

    <main class="app-main">
      <ControlBar
        @import-text="handleImportText"
        @reset="handleReset"
        @start="handleStart"
        @open-chapter-list="handleOpenChapterList"
      />

      <div class="editor-wrapper">
        <TypingEditor
          ref="editorRef"
          :original-text="originalText"
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

      <!-- 完成提示 -->
      <div v-if="isComplete" class="complete-message">
        🎉 恭喜完成！太棒了！
      </div>
    </main>

    <!-- 章节列表 -->
    <ChapterList
      :chapters="chapters"
      :current-chapter-index="currentChapterIndex"
      :show="isChapterListOpen"
      @select="handleSelectChapter"
      @close="closeChapterList"
    />
  </div>
</template>

<style>
@import './styles/main.css';

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.app-header h1 {
  font-size: 28px;
  color: var(--color-primary);
  margin-bottom: var(--spacing-xs);
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.app-main {
  flex: 1;
  padding: var(--spacing-lg);
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.editor-wrapper {
  margin-bottom: var(--spacing-md);
}

.progress-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
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
  text-align: center;
  padding: var(--spacing-lg);
  margin-top: var(--spacing-md);
  font-size: 20px;
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
</style>
