<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">User Accounts</h1>
          <p class="text-slate-400">Active user accounts only. Pending, inactive, and archived records are handled in their dedicated workflows.</p>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadUserAccounts"
          >
            <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="account-filters border-b border-slate-700 p-4">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.5fr)_minmax(10rem,.7fr)_auto]">
            <label class="filter-field">
              <span>Search accounts</span>
              <div class="relative">
                <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
                <input
                  v-model="search"
                  type="search"
                  placeholder="Name, email, or user type"
                  class="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </label>

            <label class="filter-field">
              <span>User type</span>
              <select v-model="userTypeFilter" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100">
                <option value="">All user types</option>
                <option v-for="type in userTypeOptions" :key="type" :value="type">{{ type }}</option>
              </select>
            </label>

            <button
              type="button"
              class="self-end rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!activeFilterCount"
              @click="clearFilters"
            >
              Clear filters<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
            </button>
          </div>
        </div>

        <TablePagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredAccounts.length"
          part="top"
          item-label="matching accounts"
        >
          <template #summary-extra>
            <span v-if="filteredAccounts.length !== accounts.length">({{ accounts.length }} total active)</span>
          </template>
        </TablePagination>

        <div class="account-table-scroll overflow-x-auto">
          <table class="accounts-table w-full text-sm">
            <thead class="border-b border-slate-700 bg-slate-800">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Name</th>
                <th class="text-left text-slate-300 px-4 py-3">Email</th>
                <th class="text-left text-slate-300 px-4 py-3">User Type</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
                <th class="text-left text-slate-300 px-4 py-3">Created</th>
                
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="5">Loading user accounts...</td>
              </tr>

              <tr v-else-if="!filteredAccounts.length">
                <td class="px-4 py-3 text-slate-300" colspan="5">No user accounts found.</td>
              </tr>

              <tr v-for="account in paginatedAccounts" :key="account.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-200">{{ account.fullName }}</td>
                <td class="px-4 py-3 text-slate-300">{{ account.email || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">{{ account.userType || '-' }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(account.status)">
                    {{ account.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400">{{ account.createdLabel }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <TablePagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredAccounts.length"
          part="bottom"
        />
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

const normalizeRoleKey = (value) => {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!compact) return ''
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  if (compact === 'hr') return 'HR'
  if (compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Clinic Admin'
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}

const displayUserType = (user) => {
  const explicitType = String(user?.userType || user?.accountType || '').trim()
  if (explicitType) return explicitType

  const role = normalizeRoleKey(user?.role)
  if (role === 'Clinic Admin' || role === 'Owner') return 'Clinic'
  if (role === 'Customer') return 'Customer'
  if (role === 'Supplier') return 'Supplier'
  if (role === 'HR' || role === 'Finance' || role === 'Manager' || role === 'Receptionist' || role === 'Practitioner') return 'Staff'
  if (user?.branchId || user?.clinicId) return 'Staff'
  return 'User'
}

const readTimestamp = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return null
}

export default {
  name: 'SuperAdminAccountManagement',
  components: { SuperAdminSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const loading = ref(false)
    const error = ref('')
    const search = ref('')
    const userTypeFilter = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const accounts = ref([])
    let unsubscribeUsers = null

    const formatDate = (value) => {
      const date = readTimestamp(value)
      if (!date) return '-'
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'active') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      if (normalized.includes('pending')) return 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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

    const isActive = (user) => {
      return user?.archived !== true && String(user?.status || '').trim().toLowerCase() === 'active'
    }

    const loadUserAccounts = () => {
      if (unsubscribeUsers) unsubscribeUsers()
      loading.value = true
      error.value = ''
      unsubscribeUsers = pageListener(onSnapshot, collection(db, 'users'), (usersSnap) => {
        const mapped = usersSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((user) => !isSystemAdmin(user))
          .filter(isActive)
          .map((user) => {
            const fullName =
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed User'

            return {
              id: user.id,
              fullName,
              email: user.email || '',
              userType: displayUserType(user),
              status: user.status || 'Unknown',
              createdLabel: formatDate(user.createdAt),
              createdAt: user.createdAt || null,
            }
          })

        accounts.value = sortRecordsNewestFirst(mapped)
        loading.value = false
      }, (err) => {
        console.error('Error loading user accounts:', err)
        error.value = 'Failed to load user accounts. Please try again.'
        loading.value = false
      })
    }


    const filteredAccounts = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      return accounts.value.filter((account) => {
        if (userTypeFilter.value && account.userType !== userTypeFilter.value) return false
        if (!keyword) return true

        const haystack = [
          account.fullName,
          account.email,
          account.userType,
          account.status,
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(keyword)
      })
    })

    const userTypeOptions = computed(() => [...new Set(accounts.value.map((account) => account.userType).filter(Boolean))].sort())
    const paginatedAccounts = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      return filteredAccounts.value.slice(start, start + pageSize.value)
    })
    const activeFilterCount = computed(() => [search.value.trim(), userTypeFilter.value].filter(Boolean).length)

    const clearFilters = () => {
      search.value = ''
      userTypeFilter.value = ''
    }

    watch([search, userTypeFilter, pageSize], () => {
      currentPage.value = 1
    })

    onMounted(loadUserAccounts)
    onUnmounted(() => unsubscribeUsers?.())

    return {
      pageLoading,
      loading,
      error,
      search,
      accounts,
      userTypeFilter,
      userTypeOptions,
      filteredAccounts,
      paginatedAccounts,
      currentPage,
      pageSize,
      activeFilterCount,
      clearFilters,
      statusClass,
      loadUserAccounts,
    }
  }
}
</script>

<style scoped>
.filter-field {
  display: grid;
  gap: .4rem;
  color: var(--ac-text-secondary, #624733);
  font-size: .75rem;
  font-weight: 600;
}
.account-table-scroll { box-shadow: none !important; }
.accounts-table thead,
.accounts-table thead th {
  box-shadow: none !important;
  filter: none !important;
  text-shadow: none !important;
}
.accounts-table thead { position: static !important; }

</style>
