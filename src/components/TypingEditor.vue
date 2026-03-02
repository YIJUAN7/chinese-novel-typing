<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { useStats } from '@/composables/useStats'

const props = defineProps<{
  originalText: string
}>()

const emit = defineEmits<{
  (e: 'progress', progress: number): void
  (e: 'complete'): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const isComposing = ref(false)
const cursorPosition = ref(0)
const hasError = ref(false)
const errorMsg = ref('')

const {
  elapsedTime,
  wpm,
  accuracy,
  startTiming,
  resetStats,
  recordError,
  recordCorrectChar,
} = useStats()

let isUpdating = false

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
    resetStats()
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
      startTiming()
    }

    const progress = props.originalText.length > 0 ? (newPos / props.originalText.length) * 100 : 0
    emit('progress', progress)

    if (newPos === props.originalText.length && newPos > 0) {
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

  // 获取用户输入的字符
  const data = (e as InputEvent).data
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

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  // 允许的功能键
  const allowedKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']
  if (allowedKeys.includes(e.key)) return

  // 阻止所有修改性按键
  const blockKeys = ['Backspace', 'Delete', 'Enter']
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

defineExpose({
  focusEditor,
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
}

.editor-content {
  min-height: 200px;
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
  max-height: 400px;
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
