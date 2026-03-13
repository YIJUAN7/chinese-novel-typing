// 主题配置接口
export interface ThemeConfig {
  name: string
  label: string
  colors: {
    // 主题色
    primary: string
    primaryDark: string
    success: string
    error: string
    warning: string
    // 文本颜色
    textPrimary: string
    textSecondary: string
    textDisabled: string
    textPending: string
    textHint: string
    textTip: string
    // 背景色
    bgPrimary: string
    bgSecondary: string
    bgTertiary: string
    bgQuaternary: string
    // 遮罩层
    overlayBg: string
    // 光标颜色
    cursorColor: string
    // 焦点环
    focusRing: string
    // 错误背景
    errorBg: string
  }
}

// 内置主题列表
export const builtInThemes: ThemeConfig[] = [
  {
    name: 'light',
    label: '浅色模式',
    colors: {
      primary: '#4a9eff',
      primaryDark: '#3a8eef',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#faad14',
      textPrimary: '#1f1f1f',
      textSecondary: '#6b7280',
      textDisabled: '#9ca3af',
      textPending: '#9ca3af',
      textHint: '#999999',
      textTip: '#888888',
      bgPrimary: '#ffffff',
      bgSecondary: '#f3f4f6',
      bgTertiary: '#e5e7eb',
      bgQuaternary: '#f9fafb',
      overlayBg: 'rgba(0, 0, 0, 0.5)',
      cursorColor: '#4a9eff',
      focusRing: 'rgba(74, 158, 255, 0.2)',
      errorBg: 'rgba(255, 77, 79, 0.2)',
    },
  },
  {
    name: 'dark',
    label: '深色模式',
    colors: {
      primary: '#7b9abdff',
      primaryDark: '#7d9fc6ff',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#faad14',
      textPrimary: '#e5e7eb',
      textSecondary: '#9ca3af',
      textDisabled: '#6b7280',
      textPending: '#a9b6cfff',
      textHint: '#6b7280',
      textTip: '#555555',
      bgPrimary: '#2f2f2f',
      bgSecondary: '#1d1d1d',
      bgTertiary: '#3d3d3d',
      bgQuaternary: '#4a4a4a',
      overlayBg: 'rgba(255, 255, 255, 0.1)',
      cursorColor: '#4a9eff',
      focusRing: 'rgba(74, 158, 255, 0.3)',
      errorBg: 'rgba(255, 77, 79, 0.3)',
    },
  },
  {
    name: 'eye-protection',
    label: '护眼模式',
    colors: {
      primary: '#4a9eff',
      primaryDark: '#3a8eef',
      success: '#52c41a',
      error: '#ff4d4f',
      warning: '#faad14',
      textPrimary: '#2d3436',
      textSecondary: '#636e72',
      textDisabled: '#b2bec3',
      textPending: '#b2bec3',
      textHint: '#b2bec3',
      textTip: '#a0a0a0',
      bgPrimary: '#f0f9f0',
      bgSecondary: '#e8f5e9',
      bgTertiary: '#dcedc8',
      bgQuaternary: '#e8f5e9',
      overlayBg: 'rgba(0, 0, 0, 0.5)',
      cursorColor: '#4a9eff',
      focusRing: 'rgba(74, 158, 255, 0.2)',
      errorBg: 'rgba(255, 77, 79, 0.2)',
    },
  },
]

// LocalStorage 键名
const THEME_STORAGE_KEY = 'novel-typing-theme'
const CUSTOM_THEMES_KEY = 'novel-typing-custom-themes'

// 获取当前主题
export function getCurrentTheme(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'light'
}

// 设置主题
export function setTheme(themeName: string): void {
  const theme = builtInThemes.find((t) => t.name === themeName)
  if (theme) {
    applyTheme(theme)
    localStorage.setItem(THEME_STORAGE_KEY, themeName)
  }
}

// 应用主题颜色
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement.style

  // 主题色
  root.setProperty('--color-primary', theme.colors.primary)
  root.setProperty('--color-primary-dark', theme.colors.primaryDark)
  root.setProperty('--color-success', theme.colors.success)
  root.setProperty('--color-error', theme.colors.error)
  root.setProperty('--color-warning', theme.colors.warning)

  // 文本颜色
  root.setProperty('--text-primary', theme.colors.textPrimary)
  root.setProperty('--text-secondary', theme.colors.textSecondary)
  root.setProperty('--text-disabled', theme.colors.textDisabled)
  root.setProperty('--text-pending', theme.colors.textPending)
  root.setProperty('--text-hint', theme.colors.textHint)
  root.setProperty('--text-tip', theme.colors.textTip)

  // 背景色
  root.setProperty('--bg-primary', theme.colors.bgPrimary)
  root.setProperty('--bg-secondary', theme.colors.bgSecondary)
  root.setProperty('--bg-tertiary', theme.colors.bgTertiary)
  root.setProperty('--bg-quaternary', theme.colors.bgQuaternary)

  // 遮罩层
  root.setProperty('--overlay-bg', theme.colors.overlayBg)

  // 光标颜色
  root.setProperty('--cursor-color', theme.colors.cursorColor)

  // 焦点环
  root.setProperty('--focus-ring', theme.colors.focusRing)

  // 错误背景
  root.setProperty('--error-bg', theme.colors.errorBg)
}

// 初始化主题（页面加载时调用）
export function initTheme(): void {
  const themeName = getCurrentTheme()
  const theme = builtInThemes.find((t) => t.name === themeName)
  if (theme) {
    applyTheme(theme)
  }
}

// 获取内置主题列表
export function getBuiltInThemes(): ThemeConfig[] {
  return builtInThemes
}

// 自定义主题相关功能
export interface CustomTheme extends ThemeConfig {
  isCustom: true
  id: string
}

// 获取所有自定义主题
export function getCustomThemes(): CustomTheme[] {
  const stored = localStorage.getItem(CUSTOM_THEMES_KEY)
  return stored ? JSON.parse(stored) : []
}

// 保存自定义主题
export function saveCustomTheme(theme: CustomTheme): void {
  const themes = getCustomThemes()
  const existingIndex = themes.findIndex((t) => t.id === theme.id)
  if (existingIndex >= 0) {
    themes[existingIndex] = theme
  } else {
    themes.push(theme)
  }
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
}

// 删除自定义主题
export function deleteCustomTheme(themeId: string): void {
  const themes = getCustomThemes().filter((t) => t.id !== themeId)
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
}
