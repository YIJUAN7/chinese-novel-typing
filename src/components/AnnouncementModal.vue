<script setup lang="ts">
import type { Announcement } from '@/data/announcements'

const props = defineProps<{
  show: boolean
  announcement: Announcement | null
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
}>()
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('confirm')">
    <div class="announcement-modal">
      <div class="modal-header">
        <h2>📢 {{ announcement?.title }}</h2>
      </div>
      <div class="modal-body">
        <div v-if="announcement?.date" class="announcement-date">
          发布日期：{{ announcement.date }}
        </div>
        <div
          class="announcement-content"
          v-html="announcement?.content"
        ></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" @click="emit('confirm')">
          知道了
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcement-modal {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.announcement-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.announcement-modal .modal-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0;
}

.announcement-modal .modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  max-height: 60vh;
}

.announcement-date {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.announcement-content {
  color: var(--text-primary);
  line-height: 1.6;
}

.announcement-content p {
  margin: var(--spacing-sm) 0;
}

.announcement-content ul {
  margin: var(--spacing-sm) 0;
  padding-left: var(--spacing-lg);
}

.announcement-content li {
  margin: var(--spacing-xs) 0;
}

.announcement-content code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

.announcement-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--bg-tertiary);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
