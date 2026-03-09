import { ref, computed, type ComputedRef, type Ref } from 'vue'

export interface StatsState {
  startTime: Ref<number | null>
  totalErrors: Ref<number>
  correctChars: Ref<number>
  errorChars: Ref<number>
}

export interface StatsResult {
  state: StatsState
  elapsedTime: Ref<number>
  wpm: ComputedRef<number>
  errorPositions: Ref<number[]>
  startTiming: () => void
  resetStats: () => void
  recordError: (position: number) => void
  recordCorrectChar: () => void
  initStats: (initialCorrectChars: number, initialElapsedTime?: number, initialErrors?: number) => void
}

export function useStats(): StatsResult {
  const startTime = ref<number | null>(null)
  const totalErrors = ref(0)
  const correctChars = ref(0)
  const errorChars = ref(0)
  const errorPositions = ref<number[]>([])
  const elapsed = ref(0)

  const wpm = computed(() => {
    if (elapsed.value === 0) return 0
    const minutes = elapsed.value / 60
    return Math.round(correctChars.value / minutes) || 0
  })

  const startTiming = () => {
    if (!startTime.value) {
      startTime.value = Date.now()
    }
  }

  const resetStats = () => {
    startTime.value = null
    totalErrors.value = 0
    correctChars.value = 0
    errorChars.value = 0
    errorPositions.value = []
    elapsed.value = 0
  }

  const recordError = (position: number) => {
    totalErrors.value++
    errorChars.value++
    if (!errorPositions.value.includes(position)) {
      errorPositions.value.push(position)
    }
    // 错误时也开始计时
    startTiming()
  }

  const recordCorrectChar = () => {
    correctChars.value++
  }

  const initStats = (initialCorrectChars: number, initialElapsedTime: number = 0, initialErrors: number = 0) => {
    correctChars.value = initialCorrectChars
    elapsed.value = initialElapsedTime
    totalErrors.value = initialErrors
  }

  return {
    state: {
      startTime,
      totalErrors,
      correctChars,
      errorChars
    },
    elapsedTime: elapsed,
    wpm,
    errorPositions,
    startTiming,
    resetStats,
    recordError,
    recordCorrectChar,
    initStats
  }
}
