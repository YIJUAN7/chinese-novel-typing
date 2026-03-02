<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
  openChapterList,
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
  console.log('解析到的章节数:', parsedChapters.length)
  console.log('章节列表:', parsedChapters.map(c => c.title))
  setChapters(parsedChapters)

  // 如果有多个章节，显示第一章并恢复进度
  if (parsedChapters.length > 0) {
    const firstChapter = parsedChapters[0]
    console.log('第一章标题:', firstChapter.title)
    console.log('第一章内容长度:', firstChapter.content.length)
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

  // 获取最终的统计数据（确保时间是最新的）
  const finalStats = editorRef.value?.getStats()
  if (finalStats) {
    currentStats.value = finalStats
  }

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
      selectChapter(nextIndex)
      originalText.value = chapters.value[nextIndex].content
    }
  }

  isComplete.value = false
  progress.value = 0
  currentStats.value = { elapsedTime: 0, errors: 0, correctChars: 0 }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (isComplete.value) {
    e.preventDefault()
    handleNextOrReset()
  }
}

const handleStart = () => {
  editorRef.value?.focusEditor()
}

const handleOpenChapterList = () => {
  if (chapters.value.length > 0) {
    openChapterList()
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

// 监听键盘事件（完成状态下按任意键开始下一章）
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
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
    </main>

    <!-- 完成弹窗 -->
    <div v-if="isComplete" class="complete-modal-overlay" @click.self="handleNextOrReset">
      <div class="complete-modal">
        <h2>🎉 恭喜完成！</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.elapsedTime.toFixed(1) }}s</div>
            <div class="stat-label">用时</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.errors }}</div>
            <div class="stat-label">错误</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ currentStats.correctChars }}</div>
            <div class="stat-label">正确字数</div>
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

.subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0;
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
  background-color: rgba(0, 0, 0, 0.5);
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
</style>
