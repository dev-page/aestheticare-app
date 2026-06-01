<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Role Management</h1>
          <p class="text-slate-400">Manage platform role permissions and keep access rules organized.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadPermissions"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
            :disabled="loading"
            @click="syncToCurrentPages"
          >
            Sync To Current Pages
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="grid grid-cols-1 gap-6">
        <article
          v-for="roleEntry in roleEntries"
          :key="roleEntry.key"
          class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-white font-semibold">{{ roleEntry.label }}</h2>
              <p class="text-slate-400 text-xs">Role Key: {{ roleEntry.key }}</p>
            </div>
            <button
              type="button"
              class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              :disabled="savingRole === roleEntry.key"
              @click="saveRole(roleEntry)"
            >
              {{ savingRole === roleEntry.key ? 'Saving...' : 'Save' }}
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[720px]">
              <thead class="bg-slate-900/70">
                <tr>
                  <th class="text-left text-slate-300 px-4 py-3 w-56">Resource</th>
                  <th
                    v-for="action in actionCatalog"
                    :key="`head-${roleEntry.key}-${action.key}`"
                    class="text-center text-slate-300 px-3 py-3 whitespace-nowrap"
                  >
                    {{ action.label }}
                  </th>
                  <th class="text-center text-slate-300 px-3 py-3 whitespace-nowrap">Full Access</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(resource, resourceIndex) in resourcesForRole(roleEntry.key)"
                  :key="`${roleEntry.key}-${resource.key}`"
                  class="border-t border-slate-700/60"
                >
                  <td class="px-4 py-3 text-slate-100">
                    <div class="font-medium">{{ resource.label }}</div>
                    <div class="text-xs text-slate-400">{{ resource.description }}</div>
                  </td>
                  <td
                    v-for="action in actionCatalog"
                    :key="`${roleEntry.key}-${resource.key}-${action.key}`"
                    class="px-3 py-3 text-center"
                  >
                    <button
                      type="button"
                      class="relative inline-flex h-6 w-11 items-center rounded-full border transition"
                      :class="toggleClass(hasPermission(roleEntry, resource.key, action.key))"
                      @click="togglePermission(roleEntry, resource.key, action.key)"
                      :aria-pressed="hasPermission(roleEntry, resource.key, action.key)"
                      :title="`${action.label} ${resource.label}`"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white transition"
                        :class="hasPermission(roleEntry, resource.key, action.key) ? 'translate-x-5' : 'translate-x-1'"
                      ></span>
                    </button>
                  </td>
                  <td class="px-3 py-3 text-center">
                    <button
                      type="button"
                      class="relative inline-flex h-6 w-11 items-center rounded-full border transition"
                      :class="toggleClass(isRowFullAccess(roleEntry.key, resource.key))"
                      @click="toggleRowFullAccess(roleEntry.key, resource.key)"
                      :aria-pressed="isRowFullAccess(roleEntry.key, resource.key)"
                      :title="`Toggle full access for ${resource.label}`"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white transition"
                        :class="isRowFullAccess(roleEntry.key, resource.key) ? 'translate-x-5' : 'translate-x-1'"
                      ></span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const defaultRoles = [
  { key: 'Owner', label: 'Clinic Admin' },
  { key: 'Manager', label: 'Manager' },
  { key: 'HR', label: 'HR' },
  { key: 'Finance', label: 'Finance' },
  { key: 'Receptionist', label: 'Receptionist' },
  { key: 'Practitioner', label: 'Practitioner' },
  { key: 'Customer', label: 'Customer' },
]

const actionCatalog = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Update' },
  { key: 'disable', label: 'Disable' },
]

const staffResourceCatalog = [
  { key: 'backups', label: 'Backup Database', description: 'Generate and download clinic backups.' },
  { key: 'branches', label: 'Branches', description: 'Clinic branches and locations.' },
  { key: 'clinic_profile', label: 'Clinic Profile', description: 'Clinic info and public page.' },
  { key: 'staff', label: 'Staff', description: 'Staff accounts and approvals.' },
  { key: 'attendance', label: 'Attendance', description: 'Attendance records and PINs.' },
  { key: 'clients', label: 'Clients', description: 'Client profiles and history.' },
  { key: 'appointments', label: 'Appointments', description: 'Schedules and bookings.' },
  { key: 'payments', label: 'Payments/POS', description: 'POS and payment records.' },
  { key: 'inventory', label: 'Inventory', description: 'Suppliers, catalog, purchases, stock.' },
  { key: 'services', label: 'Services', description: 'Products/services and posts.' },
  { key: 'consultations', label: 'Consultations', description: 'Online consultations.' },
  { key: 'reports', label: 'Reports', description: 'Sales, payroll, and finance reports.' },
  { key: 'hr', label: 'HR & Payroll', description: 'Employee records, shifts, payroll.' },
]

const customerResourceCatalog = [
  { key: 'centers', label: 'Centers', description: 'Browse and view clinic centers.' },
  { key: 'cart', label: 'Cart', description: 'Manage cart items and quantities.' },
  { key: 'orders', label: 'Orders', description: 'Place and view orders.' },
  { key: 'appointments', label: 'Appointments', description: 'Book, reschedule, and cancel appointments.' },
  { key: 'profile', label: 'Profile', description: 'Update personal profile details.' },
]

const roleResourceMap = {
  Owner: ['backups', 'branches', 'clinic_profile', 'staff', 'attendance', 'clients', 'appointments', 'payments', 'inventory', 'services', 'consultations', 'reports', 'hr'],
  Manager: ['attendance', 'staff', 'inventory', 'services', 'appointments', 'reports'],
  HR: ['staff', 'attendance', 'hr', 'reports'],
  Finance: ['payments', 'reports', 'inventory'],
  Receptionist: ['clients', 'appointments', 'payments', 'attendance'],
  Practitioner: ['appointments', 'consultations'],
}

const normalizeRoleKey = (value) => {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!compact) return ''
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  if (compact === 'hr') return 'HR'
  if (compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Clinic Admin'
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}

export default {
  name: 'SuperAdminPermissions',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const savingRole = ref('')
    const rolePermissions = ref({})

    const roleEntries = computed(() => {
      return defaultRoles.map((role) => ({
        ...role,
        permissions: Array.isArray(rolePermissions.value[role.key])
          ? [...rolePermissions.value[role.key]]
          : [],
      }))
    })

    let unsubscribe = null

    const loadPermissions = () => {
      loading.value = true
      error.value = ''
      console.log('[Permissions] loadPermissions start')
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }

      try {
        unsubscribe = onSnapshot(
          collection(db, 'rolePermissions'),
          (snapshot) => {
            console.log('[Permissions] snapshot received', snapshot.size)
            const map = {}
            snapshot.forEach((docSnap) => {
              const roleKey = normalizeRoleKey(docSnap.id)
              const data = docSnap.data() || {}
              map[roleKey] = Array.isArray(data.permissions) ? data.permissions : []
            })
            rolePermissions.value = map
            loading.value = false
          },
          (err) => {
            console.error('Error loading role permissions:', err)
            error.value = 'Failed to load permissions. Please try again.'
            loading.value = false
          }
        )
      } catch (err) {
        console.error('Error loading role permissions:', err)
        error.value = 'Failed to load permissions. Please try again.'
        loading.value = false
      }
    }

    const buildPermissionsForRole = (roleKey) => {
      const resources =
        roleKey === 'Customer'
          ? customerResourceCatalog
          : staffResourceCatalog.filter((resource) => (roleResourceMap[roleKey] || []).includes(resource.key))
      const permissions = []
      resources.forEach((resource) => {
        actionCatalog.forEach((action) => {
          permissions.push(`${resource.key}:${action.key}`)
        })
      })
      return permissions
    }

    const syncToCurrentPages = async (auto = false) => {
      if (auto) {
        const alreadySynced = localStorage.getItem('permissions:autosync:v1')
        if (alreadySynced === '1') return
      }

      loading.value = true
      error.value = ''
      try {
        const updated = {}
        for (const role of defaultRoles) {
          const permissions = buildPermissionsForRole(role.key)
          if (role.key === 'HR') {
            permissions.push('payroll:view', 'payroll:update', 'payroll:create')
          }
          updated[role.key] = Array.from(new Set(permissions))
          await setDoc(
            doc(db, 'rolePermissions', role.key),
            { role: role.key, permissions: updated[role.key], updatedAt: serverTimestamp() },
            { merge: true }
          )
        }
        rolePermissions.value = { ...rolePermissions.value, ...updated }
        if (auto) {
          localStorage.setItem('permissions:autosync:v1', '1')
        } else {
          await Swal.fire({
            title: 'Synced',
            text: 'Role permissions now reflect available pages.',
            icon: 'success',
            timer: 1200,
            showConfirmButton: false,
          })
        }
      } catch (err) {
        console.error('Error syncing permissions:', err)
        error.value = 'Failed to sync permissions. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const saveRole = async (roleEntry) => {
      savingRole.value = roleEntry.key
      error.value = ''
      try {
        const cleanPermissions = Array.from(
          new Set(
            (roleEntry.permissions || [])
              .map((value) => String(value || '').trim())
              .filter(Boolean)
          )
        )

        await setDoc(
          doc(db, 'rolePermissions', roleEntry.key),
          {
            role: roleEntry.key,
            permissions: cleanPermissions,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        rolePermissions.value = {
          ...rolePermissions.value,
          [roleEntry.key]: cleanPermissions,
        }

        await Swal.fire({
          title: 'Saved',
          text: `${roleEntry.label} permissions updated.`,
          icon: 'success',
          timer: 1200,
          showConfirmButton: false,
        })
      } catch (err) {
        console.error('Error saving role permissions:', err)
        error.value = `Failed to save ${roleEntry.label} permissions.`
      } finally {
        savingRole.value = ''
      }
    }

    onMounted(loadPermissions)

    onUnmounted(() => {
      if (unsubscribe) unsubscribe()
    })

    return {
      loading,
      error,
      savingRole,
      roleEntries,
      actionCatalog,
      syncToCurrentPages,
      resourcesForRole: (roleKey) => {
        if (roleKey === 'Customer') return customerResourceCatalog
        const allowed = roleResourceMap[roleKey] || []
        return staffResourceCatalog.filter((resource) => allowed.includes(resource.key))
      },
      isRowFullAccess: (roleKey, resourceKey) => {
        const current = Array.isArray(rolePermissions.value[roleKey]) ? rolePermissions.value[roleKey] : []
        const needed = actionCatalog.map((action) => `${resourceKey}:${action.key}`)
        return needed.every((key) => current.includes(key))
      },
      toggleRowFullAccess: (roleKey, resourceKey) => {
        const current = new Set(Array.isArray(rolePermissions.value[roleKey]) ? rolePermissions.value[roleKey] : [])
        const needed = actionCatalog.map((action) => `${resourceKey}:${action.key}`)
        const enableAll = !needed.every((key) => current.has(key))
        needed.forEach((key) => {
          if (enableAll) current.add(key)
          else current.delete(key)
        })
        rolePermissions.value = {
          ...rolePermissions.value,
          [roleKey]: Array.from(current),
        }
      },
      loadPermissions,
      saveRole,
      togglePermission: (roleEntry, resourceKey, actionKey) => {
        const permissionKey = `${resourceKey}:${actionKey}`
        const current = Array.isArray(rolePermissions.value[roleEntry.key])
          ? rolePermissions.value[roleEntry.key]
          : []
        const set = new Set(current)
        if (set.has(permissionKey)) {
          set.delete(permissionKey)
        } else {
          set.add(permissionKey)
        }
        rolePermissions.value = {
          ...rolePermissions.value,
          [roleEntry.key]: Array.from(set),
        }
        console.log('[Permissions] toggled', roleEntry.key, permissionKey, Array.from(set))
      },
      hasPermission: (roleEntry, resourceKey, actionKey) => {
        const permissionKey = `${resourceKey}:${actionKey}`
        const current = rolePermissions.value[roleEntry.key]
        return Array.isArray(current) && current.includes(permissionKey)
      },
      toggleClass: (enabled) =>
        enabled
          ? 'bg-emerald-500 border-emerald-300/50 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]'
          : 'bg-slate-900 border-slate-600 hover:border-slate-400',
    }
  },
}
</script>
