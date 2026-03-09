<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useStats } from '@/composables/useStats'

const props = defineProps<{
  originalText: string
}>()

const emit = defineEmits<{
  (e: 'progress', progress: number): void
  (e: 'complete'): void
  (e: 'stats-change', stats: { elapsedTime: number; errors: number; correctChars: number; wpm: number; accuracy: number }): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const isComposing = ref(false)
const cursorPosition = ref(0)
const hasError = ref(false)
const errorMsg = ref('')
const isFocused = ref(false)

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
const accumulatedTimeRef = ref(0) // 累计暂停前经过的时间

// 停止定时器
const stopTimer = () => {
  if (timerRef.value) {
    clearInterval(timerRef.value)
    timerRef.value = null
  }
  startTimeRef.value = null
  // 不重置 elapsedTime，保留最终时间
}

// 暂停定时器（失去焦点时调用）
const pauseTimer = () => {
  if (timerRef.value && startTimeRef.value) {
    // 保存当前已过去的时间
    accumulatedTimeRef.value += (Date.now() - startTimeRef.value) / 1000
    clearInterval(timerRef.value)
    timerRef.value = null
    startTimeRef.value = null
    // 更新最终时间显示
    elapsedTime.value = accumulatedTimeRef.value
  }
}

// 恢复定时器（获得焦点时调用）
const resumeTimer = () => {
  if (!timerRef.value && !startTimeRef.value) {
    // 重新开始计时
    startTimeRef.value = Date.now()
    timerRef.value = window.setInterval(() => {
      if (startTimeRef.value) {
        elapsedTime.value = accumulatedTimeRef.value + (Date.now() - startTimeRef.value) / 1000
      }
    }, 100)
  }
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

// 自动滚动逻辑：当光标超过可视区域中间时，向下滚动
const autoScrollToCursor = () => {
  if (!editorRef.value) return

  const cursorNode = editorRef.value.querySelector('.cursor')
  if (!cursorNode) return

  const editorRect = editorRef.value.getBoundingClientRect()
  const cursorRect = cursorNode.getBoundingClientRect()

  // 计算编辑器可视区域的中间位置
  const editorMidpoint = editorRect.top + editorRect.height / 2

  // 如果光标位置超过中间位置，且还有待输入的内容，就向下滚动
  if (cursorRect.top > editorMidpoint) {
    // 检查是否还有待输入的内容
    const hasPendingContent = pendingText.value.length > 0
    if (!hasPendingContent) {
      return
    }

    // 计算需要滚动的距离，使光标位于中间位置
    const scrollDelta = cursorRect.top - editorMidpoint
    editorRef.value.scrollTop += scrollDelta
  }
}

// 中英文符号映射表（中文 -> 英文）
const punctuationMap: Record<string, string> = {
  '\uff0c': ',',  // ，
  '\u3002': '.',  // 。
  '\uff1b': ';',  // ；
  '\uff1a': ':',  // ：
  '\uff1f': '?',  // ？
  '\uff01': '!',  // ！
  '\u2018': "'",  // '
  '\u2019': "'",  // '
  '\u201c': '"',  // "
  '\u201d': '"',  // "
  '\uff08': '(',  // （
  '\uff09': ')',  // ）
  '\u3010': '[',  // 【
  '\u3011': ']',  // 】
  '\uff5b': '{',  // ｛
  '\uff5d': '}',  // ｝
  '\u3001': ',',  // 、
  '\u2014': '-',  // —
  '\uff5e': '~',  // ～
  '\uff20': '@',  // ＠
  '\uff03': '#',  // ＃
  '\uff04': '$',  // ＄
  '\uff05': '%',  // ％
  '\uff3e': '^',  // ＾
  '\uff06': '&',  // ＆
  '\uff0a': '*',  // ＊
  '\uff0d': '-',  // －
  '\uff0b': '+',  // ＋
  '\uff1d': '=',  // ＝
  '\uff5c': '|',  // ｜
  '\uff3c': '\\', // ＼
  '\uff0f': '/',  // ／
  '\u3008': '<',  // 〈
  '\u3009': '>',  // 〉
  '\u300a': '<',  // 《
  '\u300b': '>',  // 》
  '\u300c': '[',  // 「
  '\u300d': ']',  // 」
  '\u300e': '[',  // 『
  '\u300f': ']',  // 』
}

// 规范化字符：将中文符号转换为英文符号
const normalizeChar = (char: string): string => {
  return punctuationMap[char] || char
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
    // 只在没有错误且位置前进时才记录正确字符
    // 注意：hasError 可能在此处已经被设置为 true（部分匹配情况），所以不重复记录
    if (newPos > oldPos && !hasError.value) {
      // 根据前进的字符数记录正确字符
      const charsAdvanced = newPos - oldPos
      for (let i = 0; i < charsAdvanced; i++) {
        recordCorrectChar()
      }
      // 只在有实际输入时才恢复/启动计时
      resumeTimer()
    } else if (hasError.value && newPos > oldPos) {
      // 部分匹配后前进到有错误的位置，仍然需要恢复计时器
      resumeTimer()
    }

    const progress = props.originalText.length > 0 ? (newPos / props.originalText.length) * 100 : 0
    emit('progress', progress)

    // 发出统计数据变化事件
    emit('stats-change', {
      elapsedTime: elapsedTime.value,
      errors: state.totalErrors.value,
      correctChars: state.correctChars.value,
      wpm: wpm.value,
      accuracy: accuracy.value,
    })

    if (newPos === props.originalText.length && newPos > 0) {
      stopTimer()
      emit('complete')
    }

    if (!isUpdating) {
      nextTick(() => {
        updateEditorContent()
        // 内容更新后执行自动滚动
        nextTick(() => autoScrollToCursor())
      })
    }
  }
)

// 处理输入
const handleEditorInput = (e: Event) => {
  if (isComposing.value || isUpdating) return

  e.preventDefault()

  const inputType = (e as InputEvent).inputType

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

  // 检查是否输入了万能符 '*'，如果是则直接跳过当前字符
  if (data === '*') {
    hasError.value = false
    errorMsg.value = ''
    cursorPosition.value++
    nextTick(() => {
      updateEditorContent()
      nextTick(() => autoScrollToCursor())
    })
    return
  }

  // 处理删除操作（虽然我们阻止了，但以防万一）
  if (inputType?.includes('delete')) {
    nextTick(() => updateEditorContent())
    return
  }

  // 多字符词组匹配：向后检查是否完全匹配
  const inputText = data
  let matchLength = 0

  // 逐个字符检查输入是否与原文匹配（不区分中英文符号）
  for (let i = 0; i < inputText.length; i++) {
    const expectedChar = props.originalText[cursorPosition.value + i]
    const actualChar = inputText[i]
    const normalizedExpected = normalizeChar(expectedChar || '')
    const normalizedActual = normalizeChar(actualChar || '')

    if (normalizedActual !== normalizedExpected) {
      break
    }
    matchLength++
  }

  if (matchLength === 0) {
    // 完全错误
    hasError.value = true
    const expectedChar = props.originalText[cursorPosition.value]
    const actualChar = inputText[0]
    errorMsg.value = `期望输入 "${expectedChar}"，但输入了 "${actualChar}"（输入 * 跳过）`
    recordError(cursorPosition.value)
    nextTick(() => {
      updateEditorContent()
    })
  } else if (matchLength === inputText.length) {
    // 全部匹配，一次性前进多个字符
    hasError.value = false
    errorMsg.value = ''
    cursorPosition.value += matchLength
    nextTick(() => {
      updateEditorContent()
      nextTick(() => autoScrollToCursor())
    })
  } else {
    // 部分匹配：只前进匹配的字符，错误字符不前进
    hasError.value = true // 设置为错误状态以显示错误提示
    errorMsg.value = ''
    cursorPosition.value += matchLength
    // 记录错误（在光标位置移动后设置错误信息）
    const expectedChar = props.originalText[cursorPosition.value]
    const actualChar = inputText[matchLength]
    errorMsg.value = `期望输入 "${expectedChar}"，但输入了 "${actualChar}"（输入 * 跳过）`
    recordError(cursorPosition.value)
    nextTick(() => {
      updateEditorContent()
      nextTick(() => autoScrollToCursor())
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

  // 多字符词组匹配：向后检查是否完全匹配
  let matchLength = 0

  // 逐个字符检查（不区分中英文符号）
  for (let i = 0; i < inputText.length; i++) {
    const expectedChar = props.originalText[cursorPosition.value + i]
    const actualChar = inputText[i]
    const normalizedExpected = normalizeChar(expectedChar || '')
    const normalizedActual = normalizeChar(actualChar || '')

    if (normalizedActual !== normalizedExpected) {
      break
    }
    matchLength++
  }

  if (matchLength === 0) {
    // 完全错误
    hasError.value = true
    const expectedChar = props.originalText[cursorPosition.value]
    const actualChar = inputText[0]
    errorMsg.value = `期望输入 "${expectedChar}"，但输入了 "${actualChar}"（输入 * 跳过）`
    recordError(cursorPosition.value)
  } else if (matchLength === inputText.length) {
    // 全部匹配，一次性前进多个字符
    hasError.value = false
    errorMsg.value = ''
    cursorPosition.value += matchLength
  } else {
    // 部分匹配：只前进匹配的字符
    hasError.value = true // 设置为错误状态以显示错误提示
    errorMsg.value = ''
    cursorPosition.value += matchLength
    // 设置错误信息
    const expectedChar = props.originalText[cursorPosition.value]
    const actualChar = inputText[matchLength]
    errorMsg.value = `期望输入 "${expectedChar}"，但输入了 "${actualChar}"（输入 * 跳过）`
    recordError(cursorPosition.value)
  }

  nextTick(() => {
    updateEditorContent()
    nextTick(() => autoScrollToCursor())
  })
}

// 失去焦点时暂停计时并隐藏光标
const handleBlur = () => {
  isFocused.value = false
  pauseTimer()
}

// 获得焦点时显示光标
const handleFocus = () => {
  isFocused.value = true
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
  // 组件挂载后自动聚焦
  nextTick(() => {
    focusEditor()
  })
})

onUnmounted(() => {
  stopTimer()
})

defineExpose({
  focusEditor,
  getCursorPosition: () => cursorPosition.value,
  setCursorPosition: (pos: number) => {
    cursorPosition.value = pos
  },
  getStats: () => ({
    elapsedTime: elapsedTime.value,
    errors: state.totalErrors.value,
    correctChars: state.correctChars.value,
    wpm: wpm.value,
    accuracy: accuracy.value,
  }),
})
</script>

<template>
  <div class="typing-editor" @click="focusEditor">
    <div class="editor-content" ref="editorRef" contenteditable="true"
      :class="{ 'is-focused': isFocused }"
      @input="handleEditorInput"
      @compositionstart="handleCompositionStart"
      @compositionupdate="handleCompositionUpdate"
      @compositionend="handleCompositionEnd"
      @keydown="handleKeyDown"
      @paste="handlePaste"
      @blur="handleBlur"
      @focus="handleFocus"
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
  padding-left: calc(var(--spacing-lg) + 2em);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  line-height: 1.8;
  white-space: pre-line;
  word-break: break-all;
  outline: none;
  cursor: text;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.editor-content:focus {
  box-shadow: var(--shadow-lg);
}

.editor-content .typed-text {
  color: var(--text-primary);
  text-indent: 0 !important;
}

.editor-content .cursor {
  display: inline-block;
  color: transparent;
  font-weight: bold;
  position: relative;
  width: 1ch;
  white-space: nowrap;
}

/* 使用 ::before 伪元素显示光标，只在聚焦时显示 */
.editor-content .cursor::before {
  content: '|';
  color: var(--cursor-color);
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
}

.editor-content.is-focused .cursor::before {
  opacity: 1;
  animation: blink 1s infinite;
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
