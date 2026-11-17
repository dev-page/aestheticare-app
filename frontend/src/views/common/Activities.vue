<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <component :is="sidebarComponent" v-if="sidebarComponent" />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 4, rows: 5 }" class="min-w-0 flex-1 p-4 md:p-8">
      <div class="mb-6 md:mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Activities</h1>
        <p class="text-slate-400">Recent activity logs related to your account and clinic access.</p>
      </div>

      <section class="activities-table-panel overflow-hidden rounded-xl border border-slate-700 bg-slate-800" aria-label="Activity log">
        <TablePagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredActivities.length"
          part="top"
          item-label="activities"
        />
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Activity</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Details</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Performed by</th>
                <th scope="col" class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="activity in pagedActivities" :key="activity.id">
                <td class="px-4 py-4 font-semibold">{{ activity.action || 'Activity' }}</td>
                <td class="max-w-xl px-4 py-4 text-sm">{{ activity.details || 'No details provided.' }}</td>
                <td class="px-4 py-4 text-sm">
                  <span class="block font-medium">{{ activity.actorName || 'Unknown user' }}</span>
                  <span class="mt-1 block text-xs text-slate-400">{{ formatActorRole(activity) }}</span>
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-sm">{{ formatDate(activity.createdAt) }}</td>
              </tr>
              <tr v-if="filteredActivities.length === 0">
                <td colspan="4" class="px-4 py-10 text-center text-slate-400">No activity logs available.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <TablePagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :total-items="filteredActivities.length"
          part="bottom"
          item-label="activities"
        />
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, watch } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { isSignificantActivity } from '@/utils/activityLogger'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'

export default {
  name: 'Activities',
  components: { CustomerSidebar, EmployeeSidebar, OwnerSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const role = ref('')
    const userType = ref('')
    const activities = ref([])
    const currentPage = ref(1)
    const pageSize = ref(10)

    const sidebarComponent = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (typeValue === 'customer' || roleValue === 'customer') return CustomerSidebar
      if (typeValue === 'staff') return EmployeeSidebar
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return OwnerSidebar
      return CustomerSidebar
    })

    const filteredActivities = computed(() =>
      activities.value
        .filter((item) => isSignificantActivity(item))
        .filter((item) => {
          const currentUserIdValue = String(currentUserId.value || '')
          const roleValue = String(role.value || '').trim().toLowerCase()
          const userTypeValue = String(userType.value || '').trim().toLowerCase()
          const actorRole = String(item.actorRole || '').trim().toLowerCase()
          const activityModule = String(item.module || '').trim().toLowerCase()

          if (item.actorId && String(item.actorId) === currentUserIdValue) return true
          if (item.practitionerId && String(item.practitionerId) === currentUserIdValue) return true

          if (userTypeValue === 'staff') {
            if (actorRole && actorRole === roleValue) return true
            if (activityModule && activityModule === roleValue) return true
            if (activityModule && roleValue && activityModule.includes(roleValue)) return true
            if (activityModule && roleValue && roleValue.includes(activityModule)) return true
          }

          if (roleValue === 'owner' || roleValue === 'clinic admin' || roleValue === 'clinicadmin') {
            return true
          }

          return false
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    )

    const pagedActivities = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      return filteredActivities.value.slice(start, start + pageSize.value)
    })

    watch(() => filteredActivities.value.length, () => {
      const lastPage = Math.max(1, Math.ceil(filteredActivities.value.length / pageSize.value))
      if (currentPage.value > lastPage) currentPage.value = lastPage
    })

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const formatActorRole = (activity) => {
      const value = String(activity?.actorRole || '').trim().toLowerCase()
      if (['owner', 'clinic owner', 'clinicowner'].includes(value)) return 'Clinic Owner'
      if (['clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(value)) return 'Clinic Admin'
      if (['superadmin', 'system admin', 'systemadmin'].includes(value)) return 'System Admin'
      return String(activity?.actorRole || activity?.actorUserType || 'Unknown role').trim()
    }

    const loadActivities = trackPageLoad(async () => {
      activities.value = []
      try {
        // Activity documents are branch-scoped in Firestore. A query by actor
        // can include a historic global document that this clinic user is not
        // allowed to read, which denies the entire query. Only query branches
        // accessible to the signed-in account.
        let branchIds = []
        const roleValue = String(role.value || '').toLowerCase()
        if (roleValue === 'owner' || roleValue === 'clinic admin' || roleValue === 'clinicadmin') {
          const scope = await loadOwnerBranchScope(db, currentUserId.value)
          branchIds = scope.branchIds || []
        } else if (currentBranchId.value) {
          branchIds = [currentBranchId.value]
        }

        const uniqueBranchIds = [...new Set(branchIds.map((id) => String(id || '').trim()).filter(Boolean))]
        const activitySnapshots = await Promise.all(
          uniqueBranchIds.map((branchId) =>
            getDocs(query(collection(db, 'activities'), where('branchId', '==', branchId)))
          )
        )

        // Merge and deduplicate. Every requested record now matches the
        // branch-access Firestore rule.
        const map = new Map()
        activitySnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((snap) => {
            if (!map.has(snap.id)) map.set(snap.id, { id: snap.id, ...snap.data() })
          })
        })
        activities.value = Array.from(map.values()).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      } catch (err) {
        console.error('Failed to load activities:', err)
      }
    })

    onMounted(trackPageLoad(() => {
      pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const data = userSnap.exists() ? userSnap.data() || {} : {}
        currentBranchId.value = data.branchId || ''
        role.value = data.role || ''
        userType.value = data.userType || ''
        await loadActivities()
      })
    }))

    return {
      pageLoading,
      filteredActivities,
      pagedActivities,
      currentPage,
      pageSize,
      formatDate,
      formatActorRole,
      sidebarComponent
    }
  }
}
</script>

<style scoped>
.activities-table-panel table thead,
.activities-table-panel table th {
  background: var(--ac-surface-muted) !important;
  color: var(--ac-text-secondary) !important;
}

.activities-table-panel table td {
  color: var(--ac-text-secondary) !important;
}

.activities-table-panel table tbody tr:hover {
  background: var(--ac-surface-soft) !important;
}
</style>
