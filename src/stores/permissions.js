import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'

export const usePermissionsStore = defineStore('permissions', () => {
  const authStore = useAuthStore()
  const subscriptionStore = useSubscriptionStore()
  const defaultPermissionKeys = new Set(['activities:view', 'notifications:view', 'support:view'])
  const fullAccessPermissionKey = 'administrator:full_access'

  const userPermissions = ref([])
  const rolePermissions = ref([])
  const customRolePermissions = ref([])
  const loading = ref(false)
  const roleKey = ref('')
  const customRoleId = ref('')
  let unsubscribeUser = null
  let unsubscribeRole = null
  let unsubscribeCustomRole = null

  const permissionAliases = {
    view_patients: ['clients:view'],
    edit_patients: ['clients:view', 'clients:create'],
    manage_appointments: ['appointments:view', 'appointments:create'],
  }

  const isOwnerLikeRole = (value) => {
    const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
    return compact === 'owner' || compact === 'clinicadmin' || compact === 'clinicadministrator'
  }

  const normalizeRoleKey = (value) => {
    const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (!compact) return ''
    if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
    if (compact === 'hr') return 'HR'
    if (isOwnerLikeRole(compact)) return 'Owner'
    return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
  }

  const CACHE_TTL_MS = 5 * 60 * 1000

  const loadCachedPermissions = (uid, role) => {
    try {
      if (uid) {
        const userCache = JSON.parse(localStorage.getItem(`permissions:user:${uid}`) || 'null')
        if (userCache && Array.isArray(userCache.data) && userCache.ts) {
          const isFresh = Date.now() - userCache.ts < CACHE_TTL_MS
          if (isFresh && userCache.data.length) {
            userPermissions.value = userCache.data
          }
        }
      }
      if (role) {
        const roleCache = JSON.parse(localStorage.getItem(`permissions:role:${role}`) || 'null')
        if (roleCache && Array.isArray(roleCache.data) && roleCache.ts) {
          const isFresh = Date.now() - roleCache.ts < CACHE_TTL_MS
          if (isFresh && roleCache.data.length) {
            rolePermissions.value = roleCache.data
          }
        }
      }
    } catch (_error) {
      // ignore cache errors
    }
  }

  const persistPermissions = (uid, role) => {
    try {
      if (uid) {
        localStorage.setItem(
          `permissions:user:${uid}`,
          JSON.stringify({ data: userPermissions.value || [], ts: Date.now() })
        )
      }
      if (role) {
        localStorage.setItem(
          `permissions:role:${role}`,
          JSON.stringify({ data: rolePermissions.value || [], ts: Date.now() })
        )
      }
    } catch (_error) {
      // ignore cache errors
    }
  }

  watch(
    () => authStore.user,
    async (newUser) => {
      if (!newUser) {
        userPermissions.value = []
        rolePermissions.value = []
        customRolePermissions.value = []
        roleKey.value = ''
        customRoleId.value = ''
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('permissions:user:') || key.startsWith('permissions:role:')) {
              localStorage.removeItem(key)
            }
          })
        } catch (_error) {
          // ignore cache clear errors
        }
        if (unsubscribeUser) {
          unsubscribeUser()
          unsubscribeUser = null
        }
        if (unsubscribeRole) {
          unsubscribeRole()
          unsubscribeRole = null
        }
        if (unsubscribeCustomRole) {
          unsubscribeCustomRole()
          unsubscribeCustomRole = null
        }
        return
      }

      loading.value = true
      if (unsubscribeUser) {
        unsubscribeUser()
        unsubscribeUser = null
      }
      if (unsubscribeCustomRole) {
        unsubscribeCustomRole()
        unsubscribeCustomRole = null
      }

      unsubscribeUser = onSnapshot(
        doc(db, 'users', newUser.uid),
        (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() || {} : {}
          userPermissions.value = Array.isArray(data.permissions) ? data.permissions : []
          const nextCustomRoleId = String(data.customRoleId || '').trim()
          const nextRole = normalizeRoleKey(data.role || data.userType || '')
          if (nextRole !== roleKey.value) {
            roleKey.value = nextRole
            loadCachedPermissions(newUser.uid, roleKey.value)
            if (unsubscribeRole) {
              unsubscribeRole()
              unsubscribeRole = null
            }
            if (roleKey.value) {
              unsubscribeRole = onSnapshot(
                doc(db, 'rolePermissions', roleKey.value),
                (roleSnap) => {
                  const roleData = roleSnap.exists() ? roleSnap.data() || {} : {}
                  rolePermissions.value = Array.isArray(roleData.permissions)
                    ? roleData.permissions
                    : []
                  persistPermissions(newUser.uid, roleKey.value)
                },
                (error) => {
                  console.error('Error listening to role permissions:', error)
                  rolePermissions.value = []
                }
              )
            } else {
              rolePermissions.value = []
            }
          }
          if (nextCustomRoleId !== customRoleId.value) {
            customRoleId.value = nextCustomRoleId
            if (unsubscribeCustomRole) {
              unsubscribeCustomRole()
              unsubscribeCustomRole = null
            }
            if (customRoleId.value) {
              unsubscribeCustomRole = onSnapshot(
                doc(db, 'clinicRoles', customRoleId.value),
                (customRoleSnap) => {
                  const customRoleData = customRoleSnap.exists() ? customRoleSnap.data() || {} : {}
                  customRolePermissions.value = Array.isArray(customRoleData.permissions)
                    ? customRoleData.permissions
                    : []
                },
                (error) => {
                  console.error('Error listening to clinic custom role permissions:', error)
                  customRolePermissions.value = []
                }
              )
            } else {
              customRolePermissions.value = []
            }
          }
          persistPermissions(newUser.uid, roleKey.value)
          loading.value = false
        },
        (error) => {
          console.error('Error fetching permissions:', error)
          userPermissions.value = []
          rolePermissions.value = []
          customRolePermissions.value = []
          roleKey.value = ''
          customRoleId.value = ''
          loading.value = false
        }
      )
      const initialRole = normalizeRoleKey(newUser?.role || newUser?.userType || '')
      roleKey.value = initialRole
      loadCachedPermissions(newUser.uid, initialRole)
    },
    { immediate: true }
  )

  const userRole = computed(() => {
    return roleKey.value || authStore.user?.role || authStore.user?.userType || 'guest'
  })

  const isClinicAdminOwner = computed(() => {
    return isOwnerLikeRole(userRole.value) || normalizeRoleKey(userRole.value) === 'Owner'
  })

  const effectivePermissions = computed(() => {
    const usesCustomRolePermissions = Boolean(customRoleId.value)
    const set = new Set([
      ...(Array.isArray(userPermissions.value) ? userPermissions.value : []),
      ...(usesCustomRolePermissions ? [] : (Array.isArray(rolePermissions.value) ? rolePermissions.value : [])),
      ...(Array.isArray(customRolePermissions.value) ? customRolePermissions.value : [])
    ])
    defaultPermissionKeys.forEach((permissionKey) => set.add(permissionKey))
    Object.entries(permissionAliases).forEach(([legacyKey, sourceKeys]) => {
      if (sourceKeys.some((sourceKey) => set.has(sourceKey))) {
        set.add(legacyKey)
      }
    })
    if (isClinicAdminOwner.value) {
      set.add('*')
    }
    if (set.has(fullAccessPermissionKey)) {
      set.add('*')
    }
    return Array.from(set)
  })

  const hasPermission = (permission) => {
    if (!permission) return true
    if (isClinicAdminOwner.value) {
      return true
    }
    if (defaultPermissionKeys.has(permission)) {
      return true
    }
    if (effectivePermissions.value.includes(fullAccessPermissionKey)) {
      return true
    }
    if (!subscriptionStore.activePlan) {
      subscriptionStore.initSubscription()
    }
    const planKey = String(subscriptionStore.activePlan || '').toLowerCase()
    const isPremium = planKey.includes('premium')
    if (isPremium && (permission === 'attendance:create' || permission === 'attendance:view')) {
      return true
    }
    return effectivePermissions.value.includes(permission)
  }

  return {
    userPermissions,
    effectivePermissions,
    hasPermission,
    userRole,
    isClinicAdminOwner,
    loading
  }
})
