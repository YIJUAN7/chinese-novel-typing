<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface Chapter {
  index: number
  title: string
  content: string
}

const props = defineProps<{
  chapters: Chapter[]
  currentChapterIndex: number | null
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'select', chapter: Chapter): void
  (e: 'close'): void
}>()

const searchQuery = ref('')

const filteredChapters = ref<Chapter[]>([])

watch(() => props.chapters, (newChapters) => {
  if (newChapters && newChapters.length > 0) {
    filteredChapters.value = newChapters
  }
}, { immediate: true })

watch(searchQuery, (query) => {
  if (!query.trim()) {
    filteredChapters.value = props.chapters
  } else {
    filteredChapters.value = props.chapters.filter(chapter =>
      chapter.title.toLowerCase().includes(query.toLowerCase())
    )
  }
})

const handleSelect = (chapter: Chapter) => {
  emit('select', chapter)
  emit('close')
}

const currentChapter = computed(() => {
  return props.chapters.find(c => c.index === props.currentChapterIndex)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="chapter-list-overlay" @click.self="emit('close')">
        <div class="chapter-list-panel">
          <div class="chapter-list-header">
            <h2>章节列表</h2>
            <button class="close-btn" @click="emit('close')">×</button>
          </div>

          <div v-if="currentChapter" class="current-chapter-info">
            当前章节：<span class="chapter-title">{{ currentChapter.title }}</span>
          </div>

          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索章节..."
              class="search-input"
            />
          </div>

          <div class="chapter-list-content">
            <div
              v-for="chapter in filteredChapters"
              :key="chapter.index"
              :class="['chapter-item', { active: chapter.index === currentChapterIndex }]"
              @click="handleSelect(chapter)"
            >
              <span class="chapter-index">{{ chapter.index + 1 }}</span>
              <span class="chapter-title">{{ chapter.title }}</span>
            </div>

            <div v-if="filteredChapters.length === 0" class="no-results">
              没有找到匹配的章节
            </div>
          </div>

          <div class="chapter-list-footer">
            共 {{ chapters.length }} 章
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chapter-list-overlay {
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
}

.chapter-list-panel {
  background-color: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chapter-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.chapter-list-header h2 {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-tertiary);
}

.current-chapter-info {
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--bg-secondary);
  font-size: 14px;
  color: var(--text-secondary);
}

.chapter-title {
  color: var(--text-primary);
  font-weight: 500;
}

.search-box {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--color-primary);
}

.chapter-list-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm) 0;
}

.chapter-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  cursor: pointer;
  transition: background-color 0.2s;
  gap: var(--spacing-md);
}

.chapter-item:hover {
  background-color: var(--bg-secondary);
}

.chapter-item.active {
  background-color: var(--bg-tertiary);
  color: var(--color-primary);
}

.chapter-index {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 30px;
}

.chapter-title {
  flex: 1;
  color: inherit;
}

.no-results {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-secondary);
}

.chapter-list-footer {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-top: 1px solid var(--bg-tertiary);
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
