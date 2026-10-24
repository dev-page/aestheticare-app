import { computed, ref, unref } from 'vue'

const sidebarStates = new Map()

export const clearSidebarTransientState = () => {
  if (typeof window === 'undefined') return

  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('sidebar:') && key.endsWith(':groups')) {
        window.localStorage.removeItem(key)
      }
    })
  } catch (_error) {
    // ignore storage errors
  }

  try {
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key.startsWith('sidebar:') && key.endsWith(':scroll-top')) {
        window.sessionStorage.removeItem(key)
      }
    })
  } catch (_error) {
    // ignore storage errors
  }
}

const getStorageKey = (panelKey) => `sidebar:${panelKey}:collapsed`

const readStoredValue = (panelKey) => {
  if (!panelKey || typeof window === 'undefined') return false
  try {
    return localStorage.getItem(getStorageKey(panelKey)) === '1'
  } catch (_error) {
    return false
  }
}

const persistStoredValue = (panelKey, value) => {
  if (!panelKey || typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(panelKey), value ? '1' : '0')
  } catch (_error) {
    // ignore storage errors
  }
}

const getStateRef = (panelKey) => {
  const key = String(panelKey || '').trim()
  if (!key) return null

  if (!sidebarStates.has(key)) {
    sidebarStates.set(key, ref(readStoredValue(key)))
  }

  return sidebarStates.get(key)
}

export const useSidebarState = (panelKeySource) => {
  const resolvedPanelKey = computed(() => String(unref(panelKeySource) || '').trim())

  const collapsed = computed({
    get() {
      const stateRef = getStateRef(resolvedPanelKey.value)
      return stateRef ? stateRef.value : false
    },
    set(nextValue) {
      const key = resolvedPanelKey.value
      if (!key) return

      const stateRef = getStateRef(key)
      if (!stateRef) return

      stateRef.value = Boolean(nextValue)
      persistStoredValue(key, stateRef.value)
    }
  })

  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value
  }

  const syncFromStorage = () => {
    const key = resolvedPanelKey.value
    if (!key) return

    const stateRef = getStateRef(key)
    if (!stateRef) return

    stateRef.value = readStoredValue(key)
  }

  return {
    collapsed,
    toggleCollapsed,
    syncFromStorage,
    resolvedPanelKey,
  }
}
