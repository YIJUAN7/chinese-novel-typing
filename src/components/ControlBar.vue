<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  chapterCount: number
}>()

const emit = defineEmits<{
  (e: 'import-text', text: string, fileName?: string, customRegex?: string): void
  (e: 'reset'): void
  (e: 'open-chapter-list'): void
  (e: 'open-saved-novels'): void
}>()

const showModal = ref(false)
const inputText = ref('')
const isUploading = ref(false)
const errorMessage = ref('')
const showNoChapterToast = ref(false)
const customRegex = ref('')
const useCustomRegex = ref(false)
const regexError = ref('')
const pendingFileImport = ref<{ text: string; fileName: string } | null>(null)
const fileInfo = ref<{ name: string; size: string } | null>(null)
const isFileImportMode = ref(false)

// 从 LocalStorage 加载自定义正则设置
const loadCustomRegexSetting = () => {
  const saved = localStorage.getItem('customChapterRegex')
  const enabled = localStorage.getItem('useCustomRegex')
  if (saved) {
    customRegex.value = saved
  }
  if (enabled === 'true') {
    useCustomRegex.value = true
  }
}

// 保存自定义正则设置到 LocalStorage
const saveCustomRegexSetting = () => {
  if (useCustomRegex.value && customRegex.value.trim()) {
    localStorage.setItem('customChapterRegex', customRegex.value.trim())
    localStorage.setItem('useCustomRegex', 'true')
  } else {
    localStorage.removeItem('customChapterRegex')
    localStorage.removeItem('useCustomRegex')
  }
}

// 组件挂载时加载设置
onMounted(() => {
  loadCustomRegexSetting()
})

// 关闭弹窗时的处理
const handleCloseModal = () => {
  showModal.value = false
  inputText.value = ''
  pendingFileImport.value = null
  fileInfo.value = null
  isFileImportMode.value = false
  regexError.value = ''
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const handleImport = () => {
  // 确定文本来源：文件导入从 pendingFileImport 获取，手动粘贴从 inputText 获取
  const text = isFileImportMode.value ? pendingFileImport.value?.text : inputText.value

  if (text?.trim()) {
    // 标准化换行符
    const processedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // 如果启用自定义正则，验证正则有效性
    if (useCustomRegex.value && customRegex.value.trim()) {
      try {
        new RegExp(customRegex.value.trim())
        regexError.value = ''
      } catch {
        regexError.value = '正则表达式格式无效，请检查'
        return
      }
    }

    // 保存自定义正则设置
    saveCustomRegexSetting()

    // 确定文件名：如果有待处理的文件导入则使用文件名，否则为 undefined
    const fileName = pendingFileImport.value?.fileName

    emit('import-text', processedText.trim(), fileName, useCustomRegex.value && customRegex.value.trim() ? customRegex.value.trim() : undefined)

    // 重置状态
    handleCloseModal()
  }
}

const handleFileImport = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 验证文件类型
  if (!file.name.endsWith('.txt')) {
    errorMessage.value = '请选择 .txt 格式的文件'
    return
  }

  // 验证文件大小（最大 20MB）
  if (file.size > 20 * 1024 * 1024) {
    errorMessage.value = '文件大小不能超过 20MB'
    return
  }

  isUploading.value = true
  errorMessage.value = ''

  try {
    const reader = new FileReader()
    reader.onload = (event) => {
      let text = event.target?.result as string
      // 标准化换行符
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      // 传递文件名（不含扩展名）
      const fileName = file.name.replace(/\.txt$/i, '')

      // 保存文件内容和信息
      pendingFileImport.value = { text: text.trim(), fileName }
      fileInfo.value = { name: file.name, size: formatFileSize(file.size) }
      isFileImportMode.value = true
      showModal.value = true
      isUploading.value = false
    }
    reader.onerror = () => {
      errorMessage.value = '文件读取失败，请重试'
      isUploading.value = false
    }
    reader.readAsText(file)
  } catch {
    errorMessage.value = '文件读取失败，请重试'
    isUploading.value = false
  }

  target.value = ''
}

const handleReset = () => {
  emit('reset')
}

const handleOpenChapterList = () => {
  // 检查是否有章节内容
  if (props.chapterCount === 0) {
    showNoChapterToast.value = true
    // 3 秒后自动关闭提示
    setTimeout(() => {
      showNoChapterToast.value = false
    }, 3000)
    return
  }
  emit('open-chapter-list')
}

const handleOpenSavedNovels = () => {
  emit('open-saved-novels')
}
</script>

<template>
  <div class="control-bar">
    <div class="control-group">
      <button class="btn btn-primary" @click="showModal = true">
        📄 导入文本
      </button>
      <label class="btn btn-secondary">
        📁 从文件导入
        <input type="file" accept=".txt" @change="handleFileImport" hidden />
      </label>
      <button class="btn btn-secondary" @click="handleOpenSavedNovels">
        📚 小说列表
      </button>
      <button class="btn btn-secondary" @click="handleOpenChapterList">
        📑 章节列表
      </button>
    </div>

    <div class="control-group">
      <button class="btn btn-secondary" @click="handleReset">
        🔄 重置
      </button>
    </div>
  </div>

  <!-- 错误提示 -->
  <div v-if="errorMessage" class="error-toast">
    {{ errorMessage }}
    <button class="toast-close" @click="errorMessage = ''">×</button>
  </div>

  <!-- 无章节提示 -->
  <div v-if="showNoChapterToast" class="info-toast">
    请先导入文本或从小说列表加载小说
    <button class="toast-close" @click="showNoChapterToast = false">×</button>
  </div>

  <!-- 导入文本弹窗 -->
  <div v-if="showModal" class="modal-overlay" @click.self="handleCloseModal">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ isFileImportMode ? '导入文件' : '导入文本' }}</h2>
        <button class="btn-close" @click="handleCloseModal">×</button>
      </div>
      <div class="modal-body">
        <!-- 文件导入模式：显示文件信息 -->
        <div v-if="isFileImportMode && fileInfo" class="file-info-section">
          <div class="file-info-item">
            <span class="label">文件名：</span>
            <span class="value">{{ fileInfo.name }}</span>
          </div>
          <div class="file-info-item">
            <span class="label">大小：</span>
            <span class="value">{{ fileInfo.size }}</span>
          </div>
        </div>

        <!-- 手动粘贴模式：显示文本框 -->
        <div v-else>
          <p class="modal-tip">支持粘贴文本，自动识别章节结构</p>
          <textarea
            v-model="inputText"
            placeholder="请粘贴要练习的小说文本..."
            rows="10"
          ></textarea>
        </div>

        <!-- 自定义章节正则 -->
        <div class="custom-regex-section">
          <label class="checkbox-label">
            <input type="checkbox" v-model="useCustomRegex" />
            <span>使用自定义章节匹配正则</span>
          </label>
          <div v-if="useCustomRegex" class="regex-input-wrapper">
            <input
              type="text"
              v-model="customRegex"
              placeholder="例如：^[0-9]+、或/^第\s*\d+\s*章/"
              class="regex-input"
            />
            <p class="regex-tip">支持两种格式：<code>^[0-9]+、</code> 或 <code>/^\d+/</code></p>
            <p class="regex-tip">默认正则：<code>/第 [0-9 \u3000一二三四五六七八九十百千万]+章/</code></p>
            <p v-if="regexError" class="regex-error">{{ regexError }}</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleCloseModal">取消</button>
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.modal-tip {
  margin-bottom: var(--spacing-md);
  color: var(--text-secondary);
  font-size: 14px;
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

/* 文件信息显示样式 */
.file-info-section {
  background: var(--bg-tertiary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-md);
}

.file-info-item {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.file-info-item:last-child {
  margin-bottom: 0;
}

.file-info-item .label {
  color: var(--text-secondary);
  font-size: 14px;
  min-width: 60px;
}

.file-info-item .value {
  color: var(--text-primary);
  font-size: 14px;
  word-break: break-all;
}

/* 自定义正则样式 */
.custom-regex-section {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--bg-tertiary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.regex-input-wrapper {
  margin-top: var(--spacing-sm);
}

.regex-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.regex-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
}

.regex-tip {
  margin-top: var(--spacing-xs);
  font-size: 12px;
  color: var(--text-secondary);
}

.regex-tip code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.regex-error {
  margin-top: var(--spacing-xs);
  font-size: 12px;
  color: var(--color-error);
}

.error-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-error);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  z-index: 2000;
  animation: slideDown 0.3s ease;
}

.info-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-primary);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  z-index: 2000;
  animation: slideDown 0.3s ease;
}

.toast-close {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
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

@keyframes slideDown {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}
</style>
