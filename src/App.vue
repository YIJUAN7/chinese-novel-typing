<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlBar from './components/ControlBar.vue'
import TypingEditor from './components/TypingEditor.vue'

// 默认示例文本
const defaultText = `那是一个很好的时代，那是一个糟糕的时代；那是一个智慧的年代，那是一个愚昧的年代；那是一个充满希望的春天，那是一个充满失望的冬天。我们面前应有尽有，我们面前一无所有。`

const originalText = ref(defaultText)
const progress = ref(0)
const isComplete = ref(false)
const editorRef = ref<InstanceType<typeof TypingEditor> | null>(null)

const handleImportText = (text: string) => {
  originalText.value = text
  isComplete.value = false
  progress.value = 0
}

const handleProgress = (value: number) => {
  progress.value = value
}

const handleComplete = () => {
  isComplete.value = true
}

const handleReset = () => {
  isComplete.value = false
  progress.value = 0
}

const handleStart = () => {
  editorRef.value?.focusEditor()
}

watch(
  () => originalText.value,
  () => {
    isComplete.value = false
    progress.value = 0
  }
)
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>小说跟打器</h1>
      <p class="subtitle">在光标后显示待输入文本的创新打字练习工具</p>
    </header>

    <main class="app-main">
      <ControlBar
        @import-text="handleImportText"
        @reset="handleReset"
        @start="handleStart"
      />

      <div class="editor-wrapper">
        <TypingEditor
          ref="editorRef"
          :original-text="originalText"
          @progress="handleProgress"
          @complete="handleComplete"
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
