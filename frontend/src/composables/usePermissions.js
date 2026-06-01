import { storeToRefs } from 'pinia'
import { usePermissionsStore } from '@/stores/permissions'

export function usePermissions() {
  const permissionsStore = usePermissionsStore()
  const {
    userPermissions,
    effectivePermissions,
    userRole,
    isClinicAdminOwner,
    loading
  } = storeToRefs(permissionsStore)

  return {
    userPermissions,
    effectivePermissions,
    userRole,
    isClinicAdminOwner,
    loading,
    hasPermission: permissionsStore.hasPermission
  }
}
