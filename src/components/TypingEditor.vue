<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useStats } from '@/composables/useStats'

const props = defineProps<{
  originalText: string
  skipPunctuation?: boolean
  customSkipChars?: string
  pendingLines?: number
}>()

const emit = defineEmits<{
  (e: 'progress', progress: number): void
  (e: 'complete'): void
  (e: 'stats-change', stats: { elapsedTime: number; errors: number; correctChars: number; wpm: number }): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const isComposing = ref(false)
const cursorPosition = ref(0)
const hasError = ref(false)
const errorMsg = ref('')
const isFocused = ref(false)
// 记录用户实际输入的字符数（用于速度计算，不包括自动跳过的符号）
const actualInputCount = ref(0)

const {
  resetStats,
  recordError,
  recordCorrectChar,
  initStats,
  state,
} = useStats()

let isUpdating = false

// 动态计算经过时间
const elapsedTime = ref(0)
const timerRef = ref<number | null>(null)
const startTimeRef = ref<number | null>(null)
const accumulatedTimeRef = ref(0) // 累计暂停前经过的时间

// 上次保存的时间（避免保存过于频繁）
let lastSaveTime = 0

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
        // 每秒保存一次进度（检查距上次保存是否超过 1 秒）
        const now = Date.now()
        if (now - lastSaveTime >= 1000) {
          lastSaveTime = now
          // 发出统计数据变化事件，触发 App.vue 中的进度保存
          emit('stats-change', {
            elapsedTime: elapsedTime.value,
            errors: state.totalErrors.value,
            correctChars: state.correctChars.value,
            wpm: wpm.value,
          })
        }
      }
    }, 100)
  }
}

// 计算 WPM - 使用实际输入字符数而不是光标位置
const wpm = computed(() => {
  if (elapsedTime.value === 0) return 0
  const minutes = elapsedTime.value / 60
  // 如果启用跳过符号模式，使用实际输入字符数；否则使用光标位置
  const inputCount = props.skipPunctuation ? actualInputCount.value : cursorPosition.value
  return Math.round(inputCount / minutes) || 0
})

// 格式化时间显示
const formattedTime = computed(() => {
  const totalSeconds = Math.floor(elapsedTime.value)

  if (totalSeconds >= 3600) {
    // 超过 1 小时：显示 X 小时 Y 分 Z 秒
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}小时${minutes}分${seconds}秒`
  } else if (totalSeconds >= 60) {
    // 超过 1 分钟：显示 Y 分 Z 秒
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}分${seconds}秒`
  } else {
    // 小于 1 分钟：显示 X 秒
    return `${totalSeconds}秒`
  }
})

// 包装 resetStats 来停止定时器
const wrappedResetStats = () => {
  stopTimer()
  elapsedTime.value = 0
  accumulatedTimeRef.value = 0
  lastSaveTime = 0
  actualInputCount.value = 0
  resetStats()
}

// 初始化统计状态（用于恢复进度时）
const initStatsState = (correctChars: number, elapsedTimeSec: number, errors: number = 0) => {
  initStats(correctChars, elapsedTimeSec, errors)
  elapsedTime.value = elapsedTimeSec
  accumulatedTimeRef.value = elapsedTimeSec
  // 在跳过符号模式下，correctChars 参数表示实际输入字符数
  if (props.skipPunctuation) {
    actualInputCount.value = correctChars
  }
}

// 计算已输入和待输入文本
const typedText = computed(() => props.originalText.slice(0, cursorPosition.value))
const pendingText = computed(() => props.originalText.slice(cursorPosition.value))

// 根据 pendingLines 设置分割待跟打文本为可见部分和隐藏部分
const visiblePendingText = computed(() => {
  if (!props.pendingLines || props.pendingLines === 0) {
    return pendingText.value
  }

  const text = pendingText.value
  let lineCount = 1 // 从当前行开始计数（第一行）

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (lineCount >= props.pendingLines) {
        return text.slice(0, i + 1) // 包括当前换行符
      }
      lineCount++
    }
  }

  // 如果没有找到足够的换行符，返回全部文本
  return text
})

const hiddenPendingText = computed(() => {
  if (!props.pendingLines || props.pendingLines === 0) {
    return ''
  }

  const text = pendingText.value
  const visible = visiblePendingText.value

  return text.slice(visible.length)
})

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
    ><span class="visible-pending-text">${escapeHtml(visiblePendingText.value)}</span
    ><span class="hidden-pending-text">${escapeHtml(hiddenPendingText.value)}</span>
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
    // 检查是否还有待输入的内容（使用完整的 pendingText，而不是可见部分）
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

// 处理转义序列，将 \n \t \r 等转换为实际字符
const processEscapeSequences = (str: string): string => {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
}

// 判断字符是否为标点符号或空白字符（用于跳过模式）
const isPunctuation = (char: string): boolean => {
  if (!char) return false
  // 如果用户自定义了跳过符号，使用自定义的（处理转义序列）；否则使用默认的
  const defaultSkipChars = `，。；……“”‘’：！？、'"（）【】{}〈〉《》「」『』—～,.;:.!?()[]{}<>()-~` + '\u3000 \n\r\t'
  const skipChars = props.customSkipChars
    ? processEscapeSequences(props.customSkipChars)
    : defaultSkipChars

  return skipChars.includes(char)
}

// 获取下一个非符号字符的位置
const getNextNonPunctuationPosition = (pos: number): number => {
  if (!props.skipPunctuation) return pos

  let nextPos = pos
  while (nextPos < props.originalText.length) {
    const char = props.originalText[nextPos]
    if (char && !isPunctuation(char)) {
      break
    }
    nextPos++
  }
  return nextPos
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

// 监听 pendingLines 设置变化，立即更新显示
watch(
  () => props.pendingLines,
  () => {
    if (!isUpdating) {
      nextTick(() => updateEditorContent())
    }
  }
)

// 监听光标位置变化
watch(
  () => cursorPosition.value,
  (newPos, oldPos) => {
    // 只在没有错误且位置前进时才记录正确字符
    // 注意：hasError 可能在此处已经被设置为 true（部分匹配情况），所以不重复记录
    if (newPos > oldPos && !hasError.value) {
      // 根据前进的字符数记录正确字符（不包括自动跳过的符号）
      // 在跳过符号模式下，actualInputCount 已经记录了用户实际输入的字符
      if (!props.skipPunctuation) {
        const charsAdvanced = newPos - oldPos
        for (let i = 0; i < charsAdvanced; i++) {
          recordCorrectChar()
        }
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
    // 在跳过符号模式下，使用 actualInputCount 作为正确字符数
    const correctChars = props.skipPunctuation ? actualInputCount.value : state.correctChars.value
    emit('stats-change', {
      elapsedTime: elapsedTime.value,
      errors: state.totalErrors.value,
      correctChars: correctChars,
      wpm: wpm.value,
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
    // 记录实际输入字符数
    actualInputCount.value += matchLength

    // 如果启用跳过符号模式，检查下一个字符是否为符号
    if (props.skipPunctuation) {
      const nextNonPunctPos = getNextNonPunctuationPosition(cursorPosition.value)
      if (nextNonPunctPos > cursorPosition.value) {
        // 有符号需要跳过，不视为用户输入
        cursorPosition.value = nextNonPunctPos
      }
    }

    nextTick(() => {
      updateEditorContent()
      nextTick(() => autoScrollToCursor())
    })
  } else {
    // 部分匹配：只前进匹配的字符，错误字符不前进
    hasError.value = true // 设置为错误状态以显示错误提示
    errorMsg.value = ''
    cursorPosition.value += matchLength
    // 记录实际输入字符数
    actualInputCount.value += matchLength

    // 如果启用跳过符号模式，检查下一个字符是否为符号
    if (props.skipPunctuation) {
      const nextNonPunctPos = getNextNonPunctuationPosition(cursorPosition.value)
      if (nextNonPunctPos > cursorPosition.value) {
        // 有符号需要跳过，不视为用户输入
        cursorPosition.value = nextNonPunctPos
      }
    }

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
    // 记录实际输入字符数
    actualInputCount.value += matchLength

    // 如果启用跳过符号模式，检查下一个字符是否为符号
    if (props.skipPunctuation) {
      const nextNonPunctPos = getNextNonPunctuationPosition(cursorPosition.value)
      if (nextNonPunctPos > cursorPosition.value) {
        // 有符号需要跳过，不视为用户输入
        cursorPosition.value = nextNonPunctPos
      }
    }
  } else {
    // 部分匹配：只前进匹配的字符
    hasError.value = true // 设置为错误状态以显示错误提示
    errorMsg.value = ''
    cursorPosition.value += matchLength
    // 记录实际输入字符数
    actualInputCount.value += matchLength

    // 如果启用跳过符号模式，检查下一个字符是否为符号
    if (props.skipPunctuation) {
      const nextNonPunctPos = getNextNonPunctuationPosition(cursorPosition.value)
      if (nextNonPunctPos > cursorPosition.value) {
        // 有符号需要跳过，不视为用户输入
        cursorPosition.value = nextNonPunctPos
      }
    }

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
  // 卸载时触发一次 stats-change，让父组件保存最终进度
  emit('stats-change', {
    elapsedTime: elapsedTime.value,
    errors: state.totalErrors.value,
    correctChars: state.correctChars.value,
    wpm: wpm.value,
  })
})

defineExpose({
  focusEditor,
  getCursorPosition: () => cursorPosition.value,
  setCursorPosition: (pos: number) => {
    cursorPosition.value = pos
  },
  initStats: (correctChars: number, elapsedTimeSec: number, errors: number = 0) => {
    initStatsState(correctChars, elapsedTimeSec, errors)
  },
  getStats: () => ({
    elapsedTime: elapsedTime.value,
    errors: state.totalErrors.value,
    correctChars: state.correctChars.value,
    wpm: wpm.value,
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
      <span class="stat-item">时间：{{ formattedTime }}</span>
      <span class="stat-item">速度：{{ wpm }} 字/分</span>
      <span class="stat-item">错误：{{ state.totalErrors.value }}</span>
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
  /* 隐藏滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

/* Chrome/Safari/Opera 隐藏滚动条 */
.editor-content::-webkit-scrollbar {
  display: none;
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
  background-color: var(--error-bg);
}

.editor-content .cursor.error::before {
  color: var(--color-error);
}

.editor-content .visible-pending-text {
  color: var(--text-pending);
}

.editor-content .hidden-pending-text {
  /* 使用 color: transparent 让文本不可见，但仍占据空间 */
  color: transparent;
  /* 保持占据空间 */
  display: inline;
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
