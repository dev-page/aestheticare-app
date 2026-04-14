import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { auth, db } from '@/config/firebaseConfig'
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'

const defaultModules = {
  crm: true,
  clinic: true,
  operations: true,
  hr: true,
  finance: true,
}

const normalizeModules = (value) => ({
  ...defaultModules,
  ...(value && typeof value === 'object' ? value : {}),
})

export const useOwnerModulesStore = defineStore('ownerModules', () => {
  const enabledModules = ref({ ...defaultModules })
  const loading = ref(false)
  let unsubscribe = null
  const ownerId = ref('')

  const resolveOwnerId = (explicitOwnerId) => {
    if (typeof explicitOwnerId === 'string') {
      return String(explicitOwnerId || '').trim()
    }
    return String(auth.currentUser?.uid || '').trim()
  }

  const startOwnerModulesListener = async (explicitOwnerId = '') => {
    const nextOwnerId = resolveOwnerId(explicitOwnerId)
    if (!nextOwnerId) {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      enabledModules.value = { ...defaultModules }
      ownerId.value = ''
      return
    }

    if (unsubscribe && ownerId.value === nextOwnerId) return
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }

    loading.value = true
    ownerId.value = nextOwnerId
    const settingsRef = doc(db, 'ownerModuleSettings', nextOwnerId)
    const snap = await getDoc(settingsRef)
    if (!snap.exists()) {
      await setDoc(settingsRef, {
        ownerId: nextOwnerId,
        enabledModules: { ...defaultModules },
      }, { merge: true })
    }

    unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() || {} : {}
        enabledModules.value = normalizeModules(data.enabledModules)
        loading.value = false
      },
      (error) => {
        console.error('Error loading owner module settings:', error)
        enabledModules.value = { ...defaultModules }
        loading.value = false
      }
    )
  }

  const saveOwnerModules = async (nextModules, explicitOwnerId = '') => {
    const nextOwnerId = resolveOwnerId(explicitOwnerId)
    if (!nextOwnerId) {
      throw new Error('You must be logged in to update modules.')
    }

    const normalized = normalizeModules(nextModules)
    await setDoc(
      doc(db, 'ownerModuleSettings', nextOwnerId),
      {
        ownerId: nextOwnerId,
        enabledModules: normalized,
      },
      { merge: true }
    )
  }

  const activeModuleKeys = computed(() =>
    Object.entries(enabledModules.value)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
  )

  return {
    defaultModules,
    enabledModules,
    activeModuleKeys,
    loading,
    ownerId,
    startOwnerModulesListener,
    saveOwnerModules,
  }
})
