import { computed, ref } from 'vue'

const STORAGE_KEY = 'aestheticare-theme'
const isDark = ref(false)
let initialized = false

const readStoredTheme = () => {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

const applyTheme = (dark) => {
  isDark.value = Boolean(dark)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark-theme', isDark.value)
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  }
}

const initializeTheme = () => {
  if (initialized) return
  initialized = true
  applyTheme(readStoredTheme())
}

export function useTheme() {
  initializeTheme()

  const toggleTheme = () => {
    applyTheme(!isDark.value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    }
  }

  return {
    isDark: computed(() => isDark.value),
    toggleTheme,
  }
}
