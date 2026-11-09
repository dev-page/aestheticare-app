import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const THEME_OPTIONS = [
  { value: 'light', label: 'Light Mode' },
  { value: 'dark', label: 'Dark Mode' },
]

const STORAGE_KEY = 'aestheticare-theme'
const validThemes = new Set(THEME_OPTIONS.map(option => option.value))

const readStoredTheme = () => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return validThemes.has(stored) ? stored : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const preference = ref(readStoredTheme())
  const resolvedTheme = ref(preference.value)

  const applyTheme = () => {
    if (typeof document === 'undefined') return
    resolvedTheme.value = preference.value
    document.documentElement.dataset.acTheme = resolvedTheme.value
    document.documentElement.classList.toggle('dark', resolvedTheme.value === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme.value
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', resolvedTheme.value === 'dark' ? '#24180f' : '#fff8eb')
  }

  const initialize = () => {
    if (typeof window === 'undefined') return
    applyTheme()
  }

  const setPreference = value => {
    if (!validThemes.has(value)) return
    preference.value = value
    window.localStorage.setItem(STORAGE_KEY, value)
    applyTheme()
  }

  const toggle = () => {
    setPreference(preference.value === 'dark' ? 'light' : 'dark')
  }

  return {
    preference,
    resolvedTheme: computed(() => resolvedTheme.value),
    initialize,
    setPreference,
    toggle,
  }
})
