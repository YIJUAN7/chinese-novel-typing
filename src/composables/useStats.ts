import { ref, computed } from 'vue'

export interface StatsState {
  startTime: number | null
  endTime: number | null
  totalErrors: number
  correctChars: number
  errorChars: number
}

export interface StatsResult {
  state: StatsState
  elapsedTime: computed<number>
  wpm: computed<number>
  accuracy: computed<number>
  errorPositions: number[]
  startTiming: () => void
  stopTiming: () => void
  resetStats: () => void
  recordError: (position: number) => void
  recordCorrectChar: () => void
}

export function useStats(): StatsResult {
  const startTime = ref<number | null>(null)
  const endTime = ref<number | null>(null)
  const totalErrors = ref(0)
  const correctChars = ref(0)
  const errorChars = ref(0)
  const errorPositions = ref<number[]>([])

  const elapsedTime = computed(() => {
    if (!startTime.value) return 0
    const end = endTime.value || Date.now()
    return (end - startTime.value) / 1000 // 秒
  })

  const wpm = computed(() => {
    if (elapsedTime.value === 0) return 0
    // WPM = (字符数 / 5) / 分钟数 (英文标准)
    // 中文可以用字符数 / 分钟
    const minutes = elapsedTime.value / 60
    return Math.round(correctChars.value / minutes) || 0
  })

  const accuracy = computed(() => {
    const total = correctChars.value + errorChars.value
    if (total === 0) return 100
    return Math.round((correctChars.value / total) * 100)
  })

  const startTiming = () => {
    startTime.value = Date.now()
    endTime.value = null
  }

  const stopTiming = () => {
    endTime.value = Date.now()
  }

  const resetStats = () => {
    startTime.value = null
    endTime.value = null
    totalErrors.value = 0
    correctChars.value = 0
    errorChars.value = 0
    errorPositions.value = []
  }

  const recordError = (position: number) => {
    totalErrors.value++
    errorChars.value++
    if (!errorPositions.value.includes(position)) {
      errorPositions.value.push(position)
    }
  }

  const recordCorrectChar = () => {
    correctChars.value++
  }

  return {
    state: {
      startTime,
      endTime,
      totalErrors,
      correctChars,
      errorChars
    },
    elapsedTime,
    wpm,
    accuracy,
    errorPositions,
    startTiming,
    stopTiming,
    resetStats,
    recordError,
    recordCorrectChar
  }
}
