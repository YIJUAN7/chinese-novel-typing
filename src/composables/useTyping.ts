import { ref, computed } from 'vue'

export interface TypingState {
  cursorPosition: number
  isComposing: boolean
  hasError: boolean
  errorIndex: number
}

export interface TypingResult {
  state: TypingState
  typedText: computed<string>
  pendingText: computed<string>
  progress: computed<number>
  startTyping: () => void
  resetTyping: () => void
  handleInput: (e: InputEvent) => void
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
  setCursorPosition: (position: number) => void
}

export function useTyping(originalText: string): TypingResult {
  const cursorPosition = ref(0)
  const isComposing = ref(false)
  const hasError = ref(false)
  const errorIndex = ref(-1)
  const isStarted = ref(false)

  const typedText = computed(() => {
    return originalText.slice(0, cursorPosition.value)
  })

  const pendingText = computed(() => {
    return originalText.slice(cursorPosition.value)
  })

  const progress = computed(() => {
    if (originalText.length === 0) return 0
    return cursorPosition.value / originalText.length
  })

  const startTyping = () => {
    isStarted.value = true
  }

  const resetTyping = () => {
    cursorPosition.value = 0
    isComposing.value = false
    hasError.value = false
    errorIndex.value = -1
    isStarted.value = false
  }

  const handleInput = (e: InputEvent) => {
    if (isComposing.value) return

    // 获取输入后的文本内容
    const target = e.target as HTMLElement
    const currentText = target.textContent || ''

    // 检查输入是否正确
    const expectedText = originalText.slice(0, currentText.length)
    if (currentText !== expectedText) {
      // 输入错误，找到第一个错误位置
      hasError.value = true
      for (let i = 0; i < currentText.length; i++) {
        if (currentText[i] !== originalText[i]) {
          errorIndex.value = i
          break
        }
      }
      // 限制输入长度不超过原文
      if (currentText.length > originalText.length) {
        target.textContent = originalText
        cursorPosition.value = originalText.length
      } else {
        // 错误时不更新光标位置，保持原文
        target.textContent = typedText.value
      }
    } else {
      // 输入正确，更新光标位置
      hasError.value = false
      errorIndex.value = -1
      cursorPosition.value = currentText.length
    }

    if (!isStarted.value && cursorPosition.value > 0) {
      startTyping()
    }
  }

  const handleCompositionStart = () => {
    isComposing.value = true
  }

  const handleCompositionEnd = () => {
    isComposing.value = false
  }

  const setCursorPosition = (position: number) => {
    cursorPosition.value = position
  }

  return {
    state: {
      cursorPosition,
      isComposing,
      hasError,
      errorIndex
    },
    typedText,
    pendingText,
    progress,
    startTyping,
    resetTyping,
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
    setCursorPosition
  }
}
