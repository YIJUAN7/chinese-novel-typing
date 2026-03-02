<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'import-text', text: string): void
  (e: 'reset'): void
  (e: 'start'): void
}>()

const showModal = ref(false)
const inputText = ref('')

const handleImport = () => {
  if (inputText.value.trim()) {
    emit('import-text', inputText.value.trim())
    showModal.value = false
    inputText.value = ''
  }
}

const handleFileImport = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const text = event.target?.result as string
    emit('import-text', text.trim())
  }
  reader.readAsText(file)
  target.value = ''
}

const handleStart = () => {
  emit('start')
}

const handleReset = () => {
  emit('reset')
}
</script>

<template>
  <div class="control-bar">
    <div class="control-group">
      <button class="btn btn-primary" @click="showModal = true">
        📄 导入文本
      </button>
      <button class="btn btn-secondary" @click="handleFileImport">
        📁 从文件导入
        <input type="file" accept=".txt" @change="handleFileImport" hidden />
      </button>
    </div>

    <div class="control-group">
      <button class="btn btn-primary" @click="handleStart">
        ▶️ 开始
      </button>
      <button class="btn btn-secondary" @click="handleReset">
        🔄 重置
      </button>
    </div>
  </div>

  <!-- 导入文本弹窗 -->
  <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>导入小说文本</h2>
        <button class="btn-close" @click="showModal = false">×</button>
      </div>
      <div class="modal-body">
        <textarea
          v-model="inputText"
          placeholder="请粘贴要练习的小说文本..."
          rows="10"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="showModal = false">取消</button>
        <button class="btn btn-primary" @click="handleImport">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-md);
}

.control-group {
  display: flex;
  gap: var(--spacing-sm);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background-color: var(--text-disabled);
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

.btn-close:hover {
  background-color: var(--bg-tertiary);
}

.modal-overlay {
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
  animation: fadeIn 0.2s ease;
}

.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.modal-header h2 {
  font-size: 18px;
  color: var(--text-primary);
}

.modal-body {
  padding: var(--spacing-lg);
  flex: 1;
  overflow-y: auto;
}

.modal-body textarea {
  width: 100%;
  min-height: 200px;
  padding: var(--spacing-md);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 14px;
  resize: vertical;
  outline: none;
}

.modal-body textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--bg-tertiary);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
