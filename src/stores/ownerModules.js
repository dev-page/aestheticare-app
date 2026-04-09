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

  const startOwnerModulesListener = async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      enabledModules.value = { ...defaultModules }
      return
    }

    if (unsubscribe) return

    loading.value = true
    const settingsRef = doc(db, 'ownerModuleSettings', currentUser.uid)
    const snap = await getDoc(settingsRef)
    if (!snap.exists()) {
      await setDoc(settingsRef, {
        ownerId: currentUser.uid,
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

  const saveOwnerModules = async (nextModules) => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('You must be logged in to update modules.')
    }

    const normalized = normalizeModules(nextModules)
    await setDoc(
      doc(db, 'ownerModuleSettings', currentUser.uid),
      {
        ownerId: currentUser.uid,
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
    startOwnerModulesListener,
    saveOwnerModules,
  }
})
