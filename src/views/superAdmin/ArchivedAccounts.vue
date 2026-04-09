<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Archived Accounts</h1>
          <p class="text-slate-400">Disabled or inactive accounts. You can enable or delete archived records.</p>
        </div>

        <div class="flex gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search name, email, role, user type..."
            class="w-72 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
          />
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadArchivedAccounts"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-700 text-sm text-slate-400">
          Total Archived Accounts: <span class="text-slate-200 font-semibold">{{ filteredAccounts.length }}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700 bg-slate-800">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Name</th>
                <th class="text-left text-slate-300 px-4 py-3">Email</th>
                <th class="text-left text-slate-300 px-4 py-3">Role</th>
                <th class="text-left text-slate-300 px-4 py-3">User Type</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
                <th class="text-left text-slate-300 px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="6">Loading archived accounts...</td>
              </tr>

              <tr v-else-if="!filteredAccounts.length">
                <td class="px-4 py-3 text-slate-300" colspan="6">No archived accounts found.</td>
              </tr>

              <tr v-for="account in filteredAccounts" :key="account.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-200">{{ account.fullName }}</td>
                <td class="px-4 py-3 text-slate-300">{{ account.email || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">{{ account.role || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">{{ account.userType || '-' }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(account.status)">
                    {{ account.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                      :disabled="processingId === account.id"
                      @click="enableAccount(account)"
                    >
                      {{ processingId === account.id ? 'Processing...' : 'Enable' }}
                    </button>

                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs"
                      :disabled="processingId === account.id"
                      @click="deleteAccount(account)"
                    >
                      {{ processingId === account.id ? 'Processing...' : 'Delete' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import Swal from 'sweetalert2'

const normalizeRoleKey = (value) => {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!compact) return ''
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  if (compact === 'hr') return 'HR'
  if (compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Clinic Admin'
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}

export default {
  name: 'SuperAdminArchivedAccounts',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const search = ref('')
    const processingId = ref('')
    const accounts = ref([])

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'active') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      if (normalized === 'inactive' || normalized === 'disabled' || normalized === 'archived') {
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      }
      return 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
    }

    const isSystemAdmin = (user) => {
      const role = normalizeRoleKey(user?.role)
      const userType = String(user?.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      return role === 'Superadmin' || userType === 'systemadmin'
    }

    const isArchived = (user) => {
      const status = String(user?.status || '').trim().toLowerCase()
      return user?.archived === true || status === 'inactive' || status === 'disabled'
    }

    const loadArchivedAccounts = async () => {
      loading.value = true
      error.value = ''

      try {
        const usersSnap = await getDocs(collection(db, 'users'))

        accounts.value = usersSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((user) => !isSystemAdmin(user))
          .filter((user) => isArchived(user))
          .map((user) => {
            const fullName =
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed User'

            return {
              id: user.id,
              fullName,
              email: user.email || '',
              role: normalizeRoleKey(user.role) || 'User',
              userType: user.userType || '-',
              status: user.status || 'Inactive',
            }
          })
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
      } catch (err) {
        console.error('Error loading archived accounts:', err)
        error.value = 'Failed to load archived accounts. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const enableAccount = async (account) => {
      const result = await Swal.fire({
        title: 'Enable Account?',
        text: `Enable ${account.fullName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, enable',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processingId.value = account.id
      try {
        await updateDoc(doc(db, 'users', account.id), {
          archived: false,
          status: 'Active',
        })
        await Swal.fire({
          title: 'Enabled',
          text: `${account.fullName} is active again.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })
        await loadArchivedAccounts()
      } catch (err) {
        console.error('Error enabling account:', err)
        error.value = 'Failed to enable account. Please try again.'
      } finally {
        processingId.value = ''
      }
    }

    const deleteAccount = async (account) => {
      const result = await Swal.fire({
        title: 'Delete Account?',
        text: `Permanently delete ${account.fullName}? This cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processingId.value = account.id
      try {
        await deleteDoc(doc(db, 'users', account.id))
        await Swal.fire({
          title: 'Deleted',
          text: `${account.fullName} has been removed.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })
        await loadArchivedAccounts()
      } catch (err) {
        console.error('Error deleting account:', err)
        error.value = 'Failed to delete account. Please try again.'
      } finally {
        processingId.value = ''
      }
    }

    const filteredAccounts = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return accounts.value

      return accounts.value.filter((account) => {
        const haystack = [
          account.fullName,
          account.email,
          account.role,
          account.userType,
          account.status,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(keyword)
      })
    })

    onMounted(loadArchivedAccounts)

    return {
      loading,
      error,
      search,
      processingId,
      filteredAccounts,
      statusClass,
      loadArchivedAccounts,
      enableAccount,
      deleteAccount,
    }
  }
}
</script>
