import { storeToRefs } from 'pinia'
import { useOwnerModulesStore } from '@/stores/ownerModules'

export function useOwnerModules() {
  const ownerModulesStore = useOwnerModulesStore()
  const { enabledModules, activeModuleKeys, loading } = storeToRefs(ownerModulesStore)
  const { startOwnerModulesListener, saveOwnerModules } = ownerModulesStore

  return {
    defaultModules: ownerModulesStore.defaultModules,
    enabledModules,
    activeModuleKeys,
    loading,
    startOwnerModulesListener,
    saveOwnerModules,
  }
}
