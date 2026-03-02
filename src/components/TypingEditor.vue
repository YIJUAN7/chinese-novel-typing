<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useStats } from '@/composables/useStats'

const props = defineProps<{
  originalText: string
}>()

const emit = defineEmits<{
  (e: 'progress', progress: number): void
  (e: 'complete'): void
  (e: 'stats-change', stats: { elapsedTime: number; errors: number; correctChars: number }): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const isComposing = ref(false)
const cursorPosition = ref(0)
const hasError = ref(false)
const errorMsg = ref('')

const {
  resetStats,
  recordError,
  recordCorrectChar,
  state,
} = useStats()

let isUpdating = false

// 动态计算经过时间
const elapsedTime = ref(0)
const timerRef = ref<number | null>(null)
const startTimeRef = ref<number | null>(null)

// 启动定时器
const startTimer = () => {
  if (timerRef.value) return
  if (!startTimeRef.value) {
    startTimeRef.value = Date.now()
  }
  timerRef.value = window.setInterval(() => {
    if (startTimeRef.value) {
      elapsedTime.value = (Date.now() - startTimeRef.value) / 1000
    }
  }, 100)
}

// 停止定时器
const stopTimer = () => {
  if (timerRef.value) {
    clearInterval(timerRef.value)
    timerRef.value = null
  }
  startTimeRef.value = null
  // 不重置 elapsedTime，保留最终时间
}

// 包装的 startTiming
const wrappedStartTiming = () => {
  if (!startTimeRef.value) {
    startTimeRef.value = Date.now()
  }
  startTimer()
}

// 计算 WPM 和准确率
const wpm = computed(() => {
  if (elapsedTime.value === 0) return 0
  const minutes = elapsedTime.value / 60
  return Math.round(state.correctChars.value / minutes) || 0
})

const accuracy = computed(() => {
  const total = state.correctChars.value + state.errorChars.value
  if (total === 0) return 100
  return Math.round((state.correctChars.value / total) * 100)
})

// 包装 resetStats 来停止定时器
const wrappedResetStats = () => {
  stopTimer()
  elapsedTime.value = 0
  resetStats()
}

// 计算已输入和待输入文本
const typedText = computed(() => props.originalText.slice(0, cursorPosition.value))
const pendingText = computed(() => props.originalText.slice(cursorPosition.value))

// 转义 HTML 防止 XSS
const escapeHtml = (text: string) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 更新 editor 内容
const updateEditorContent = () => {
  if (!editorRef.value) return

  isUpdating = true

  // 设置内容
  editorRef.value.innerHTML = `
    <span class="typed-text">${escapeHtml(typedText.value)}</span
    ><span class="cursor ${hasError.value ? 'error' : ''}">|</span
    ><span class="pending-text">${escapeHtml(pendingText.value)}</span>
  `

  // 恢复光标到 cursor span 后面
  placeCaretAfterCursor()

  isUpdating = false
}

// 将光标放在 cursor span 之后
const placeCaretAfterCursor = () => {
  const selection = window.getSelection()
  if (!selection) return

  const cursorNode = editorRef.value?.querySelector('.cursor')
  if (cursorNode) {
    const range = document.createRange()
    range.setStartAfter(cursorNode)
    range.setEndAfter(cursorNode)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// 获取当前光标位置（基于用户实际输入）
const getCursorFromDOM = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(editorRef.value!)
  preCaretRange.setEnd(range.startContainer, range.startOffset)

  // 获取光标前的所有文本
  const text = preCaretRange.toString()
  return text.length
}

// 监听原文变化
watch(
  () => props.originalText,
  () => {
    cursorPosition.value = 0
    hasError.value = false
    errorMsg.value = ''
    wrappedResetStats()
    nextTick(() => updateEditorContent())
  },
  { immediate: true }
)

// 监听光标位置变化
watch(
  () => cursorPosition.value,
  (newPos, oldPos) => {
    if (newPos > oldPos) {
      if (!hasError.value) {
        recordCorrectChar()
      }
      wrappedStartTiming()
    }

    const progress = props.originalText.length > 0 ? (newPos / props.originalText.length) * 100 : 0
    emit('progress', progress)

    // 发出统计数据变化事件
    emit('stats-change', {
      elapsedTime: elapsedTime.value,
      errors: state.totalErrors.value,
      correctChars: state.correctChars.value,
    })

    if (newPos === props.originalText.length && newPos > 0) {
      stopTimer()
      emit('complete')
    }

    if (!isUpdating) {
      nextTick(() => updateEditorContent())
    }
  }
)

// 处理输入
const handleEditorInput = (e: Event) => {
  if (isComposing.value || isUpdating) return

  e.preventDefault()

  const target = e.target as HTMLElement
  const inputType = (e as InputEvent).inputType

  // 处理删除操作（虽然我们阻止了，但以防万一）
  if (inputType?.includes('delete')) {
    nextTick(() => updateEditorContent())
    return
  }

  // 获取用户输入的字符（可能是换行符）
  let data = (e as InputEvent).data

  // 如果 inputType 为 insertLineBreak 或 insertParagraph，说明用户按了 Enter
  if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
    data = '\n'
  }

  if (!data) {
    nextTick(() => updateEditorContent())
    return
  }

  // 检查输入的字符是否正确
  const expectedChar = props.originalText[cursorPosition.value]
  const actualChar = data

  if (actualChar !== expectedChar) {
    // 输入错误
    hasError.value = true
    errorMsg.value = `期望输入 "${expectedChar}"，但输入了 "${actualChar}"`
    recordError(cursorPosition.value)
    // 不更新光标位置
    nextTick(() => {
      updateEditorContent()
    })
  } else {
    // 输入正确
    hasError.value = false
    errorMsg.value = ''
    cursorPosition.value++
    nextTick(() => {
      updateEditorContent()
    })
  }
}

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  // 允许的功能键
  const allowedKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']
  if (allowedKeys.includes(e.key)) return

  // 如果下一个字符是换行符，允许 Enter 键并手动处理
  if (e.key === 'Enter') {
    const expectedChar = props.originalText[cursorPosition.value]
    if (expectedChar === '\n') {
      // 阻止默认的换行行为（插入 br），由 input 事件处理
      e.preventDefault()
      // 手动触发输入处理
      handleEditorInput({
        preventDefault: () => {},
        target: e.target,
        inputType: 'insertLineBreak',
        data: '\n',
      } as InputEvent)
    } else {
      // 如果不需要输入换行符，阻止 Enter 键
      e.preventDefault()
    }
    return
  }

  // 阻止所有修改性按键
  const blockKeys = ['Backspace', 'Delete']
  if (blockKeys.includes(e.key)) {
    e.preventDefault()
    return
  }

  // 阻止 Ctrl/Command 组合键
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    return
  }

  // 阻止方向键
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    return
  }

  // 其他字符键将通过 inputType 为 insertText 的 input 事件处理
}

const handleCompositionStart = () => {
  isComposing.value = true
}

// 在组合过程中，不断恢复编辑器内容到组合前的状态
const handleCompositionUpdate = () => {
  // 不需要额外处理，样式会隐藏 IME 内容
}

const handleCompositionEnd = (e: CompositionEvent) => {
  isComposing.value = false

  // IME 输入完成后，检查输入的文本
  const inputText = e.data
  if (!inputText) return

  // 逐个字符检查
  let allCorrect = true
  for (let i = 0; i < inputText.length; i++) {
    const expectedChar = props.originalText[cursorPosition.value + i]
    if (inputText[i] !== expectedChar) {
      allCorrect = false
      hasError.value = true
      recordError(cursorPosition.value + i)
      break
    }
  }

  if (allCorrect) {
    hasError.value = false
    errorMsg.value = ''
    cursorPosition.value += inputText.length
  }

  nextTick(() => updateEditorContent())
}

// 阻止粘贴
const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault()
}

const focusEditor = () => {
  editorRef.value?.focus()
}

onMounted(() => {
  updateEditorContent()
})

onUnmounted(() => {
  stopTimer()
})

defineExpose({
  focusEditor,
  getCursorPosition: () => cursorPosition.value,
  getStats: () => ({
    elapsedTime: elapsedTime.value,
    errors: state.totalErrors.value,
    correctChars: state.correctChars.value,
  }),
})
</script>

<template>
  <div class="typing-editor" @click="focusEditor">
    <div class="editor-content" ref="editorRef" contenteditable="true"
      @input="handleEditorInput"
      @compositionstart="handleCompositionStart"
      @compositionupdate="handleCompositionUpdate"
      @compositionend="handleCompositionEnd"
      @keydown="handleKeyDown"
      @paste="handlePaste"
      spellcheck="false">
    </div>

    <div class="editor-stats">
      <span class="stat-item">时间：{{ elapsedTime.toFixed(1) }}s</span>
      <span class="stat-item">速度：{{ wpm }} 字/分</span>
      <span class="stat-item">准确率：{{ accuracy }}%</span>
      <span v-if="hasError" class="stat-item error">{{ errorMsg }}</span>
    </div>
  </div>
</template>

<style>
.typing-editor {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  min-height: 0;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  outline: none;
  cursor: text;
  overflow-y: auto;
}

.editor-content:focus {
  box-shadow: var(--shadow-lg);
}

.editor-content .typed-text {
  color: var(--text-primary);
}

.editor-content .cursor {
  display: inline-block;
  color: transparent;
  animation: blink 1s infinite;
  font-weight: bold;
  position: relative;
  width: 1ch;
  white-space: nowrap;
}

/* 使用 ::before 伪元素显示光标 */
.editor-content .cursor::before {
  content: '|';
  color: var(--cursor-color);
  position: absolute;
  left: 0;
  top: 0;
}

.editor-content .cursor.error {
  background-color: rgba(255, 77, 79, 0.2);
}

.editor-content .cursor.error::before {
  color: var(--color-error);
}

.editor-content .pending-text {
  color: var(--text-pending);
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.editor-stats {
  display: flex;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.stat-item {
  font-size: 14px;
  color: var(--text-secondary);
}

.stat-item.error {
  color: var(--color-error);
  font-weight: bold;
}
</style>
