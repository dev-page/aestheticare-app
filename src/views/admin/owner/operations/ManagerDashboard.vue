<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Manager Dashboard</h1>
        <p class="text-slate-400">Overview of staff, supplies, products, and branch operations.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Total Staff</h3>
          <p class="text-3xl font-bold text-white">{{ totalStaff }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ activeStaff }} active</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Catalog Products</h3>
          <p class="text-3xl font-bold text-white">{{ totalProducts }}</p>
          <p class="text-xs text-yellow-400 mt-1">{{ lowStockCount }} low stock</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Suppliers</h3>
          <p class="text-3xl font-bold text-white">{{ totalSuppliers }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ activeSuppliers }} active</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Purchase Requests</h3>
          <p class="text-3xl font-bold text-white">{{ totalRequests }}</p>
          <p class="text-xs text-orange-400 mt-1">{{ pendingRequests }} pending</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-white mb-1">My Shift Assignment</h2>
        <p class="text-slate-400 text-sm mb-4">My Work Schedule</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide">Today</p>
            <p class="text-lg font-semibold text-white mt-1">{{ todayDayName }}</p>
            <p class="text-emerald-300 text-sm mt-1">{{ todayShiftLabel }}</p>
          </div>

          <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p class="text-slate-400 text-xs uppercase tracking-wide mb-2">This Week</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="entry in weeklyShiftAssignments"
                :key="entry.day"
                class="rounded-md border border-slate-700 bg-slate-800 px-3 py-2"
              >
                <p class="text-slate-300 text-xs">{{ entry.day }}</p>
                <p class="text-white text-sm font-medium">{{ entry.shift }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Staff by Role</h2>
          <div class="space-y-4">
            <div v-for="entry in staffByRole" :key="entry.role" class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-white text-sm">{{ entry.role }}</span>
                <span class="text-slate-400 text-sm">{{ entry.count }}</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div
                  class="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  :style="{ width: `${staffByRoleMax > 0 ? (entry.count / staffByRoleMax) * 100 : 0}%` }"
                ></div>
              </div>
            </div>
            <p v-if="staffByRole.length === 0" class="text-slate-400 text-sm">No staff data available.</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Low Stock Items</h2>
          <div class="space-y-3">
            <div
              v-for="item in lowStockItems.slice(0, 6)"
              :key="item.id"
              class="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
            >
              <div>
                <p class="text-white text-sm font-medium">{{ item.name }}</p>
                <p class="text-slate-400 text-xs">{{ item.supplier || '-' }}</p>
              </div>
              <p class="text-yellow-400 text-sm font-semibold">
                {{ item.currentStock || 0 }} / {{ getEffectiveMaxStock(item) || 0 }} {{ item.unit || 'units' }}
              </p>
            </div>
            <p v-if="lowStockItems.length === 0" class="text-slate-400 text-sm">No low stock items.</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Recent Purchase Requests</h2>
          <div class="space-y-3">
            <div
              v-for="request in recentRequests.slice(0, 6)"
              :key="request.id"
              class="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
            >
              <div>
                <p class="text-white text-sm font-medium">{{ request.item || '-' }}</p>
                <p class="text-slate-400 text-xs">{{ request.supplier || '-' }} • {{ request.quantity || 0 }} {{ request.unit || 'units' }}</p>
              </div>
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  request.status === 'Pending' ? 'bg-orange-500/20 text-orange-400' :
                  request.status === 'Delivered' ? 'bg-green-500/20 text-green-400' :
                  request.status === 'Delayed' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-600 text-slate-300'
                ]"
              >
                {{ request.status || 'Pending' }}
              </span>
            </div>
            <p v-if="recentRequests.length === 0" class="text-slate-400 text-sm">No purchase requests yet.</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Recent Activity</h2>
          <div class="space-y-4">
            <div
              v-for="activity in recentActivity.slice(0, 8)"
              :key="activity.id"
              class="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0"
            >
              <div class="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-white text-sm">{{ activity.action || 'Activity recorded' }}</p>
                <p class="text-slate-400 text-xs mt-1">{{ activity.time }}</p>
              </div>
            </div>
            <p v-if="recentActivity.length === 0" class="text-slate-400 text-sm">No recent activity yet.</p>
          </div>
        </div>
      </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { toast } from 'vue3-toastify'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ManagerDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const loading = ref(true)
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const todayShiftLabel = ref('Off')
    const weeklyShiftAssignments = ref([])

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const todayDayName = computed(() =>
      new Date().toLocaleDateString('en-US', { weekday: 'long' })
    )

    const staff = ref([])
    const items = ref([])
    const suppliers = ref([])
    const requests = ref([])
    const deliveredTotals = ref({})
    const recentActivity = ref([])

    const totalStaff = computed(() => staff.value.length)
    const activeStaff = computed(() => staff.value.filter((s) => (s.status || '') === 'Active').length)
    const totalProducts = computed(() => items.value.length)

    const buildDeliveredTotals = (entries) => {
      const map = {}
      entries.forEach((entry) => {
        if (String(entry.status || '').toLowerCase() !== 'delivered') return
        const name = String(entry.item || '').trim().toLowerCase()
        const supplier = String(entry.supplier || '').trim().toLowerCase()
        if (!name) return
        const key = `${name}::${supplier}`
        const quantity = Number(entry.quantity || 0)
        if (!Number.isFinite(quantity) || quantity <= 0) return
        map[key] = (map[key] || 0) + quantity
      })
      return map
    }

    const getEffectiveMaxStock = (item) => {
      const maxStock = Number(item?.maxStock || 0)
      if (maxStock > 0) return maxStock
      const key = `${String(item?.name || '').trim().toLowerCase()}::${String(item?.supplier || '').trim().toLowerCase()}`
      const deliveredMax = Number(deliveredTotals.value[key] || 0)
      if (deliveredMax > 0) return deliveredMax
      return Number(item?.currentStock || 0)
    }

    const lowStockItems = computed(() =>
      items.value.filter((item) => {
        const current = Number(item.currentStock || 0)
        const maxStock = Number(getEffectiveMaxStock(item) || 0)
        if (current <= 0) return true
        if (maxStock <= 0) return false
        return current < maxStock * 0.5
      })
    )
    const lowStockCount = computed(() => lowStockItems.value.length)
    const totalSuppliers = computed(() => suppliers.value.length)
    const activeSuppliers = computed(() => suppliers.value.filter((s) => (s.status || 'Active') === 'Active').length)
    const totalRequests = computed(() => requests.value.length)
    const pendingRequests = computed(() => requests.value.filter((r) => (r.status || 'Pending') === 'Pending').length)

    const staffByRole = computed(() => {
      const map = {}
      staff.value.forEach((member) => {
        const role = member.role || 'Unassigned'
        map[role] = (map[role] || 0) + 1
      })
      return Object.entries(map)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count)
    })

    const staffByRoleMax = computed(() => {
      return staffByRole.value.length > 0 ? Math.max(...staffByRole.value.map((r) => r.count)) : 0
    })

    const recentRequests = computed(() => {
      return [...requests.value].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    })

    const getWeekStartKey = (baseDate = new Date()) => {
      const currentDay = baseDate.getDay()
      const diffToMonday = (currentDay + 6) % 7
      const monday = new Date(baseDate)
      monday.setDate(baseDate.getDate() - diffToMonday)
      const yyyy = monday.getFullYear()
      const mm = String(monday.getMonth() + 1).padStart(2, '0')
      const dd = String(monday.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const loadCurrentUserShift = async (profile = {}) => {
      const fallbackShift =
        String(profile.shiftStart || '').trim() && String(profile.shiftEnd || '').trim()
          ? `${profile.shiftStart} - ${profile.shiftEnd}`
          : 'Off'

      try {
        const weekKey = getWeekStartKey(new Date())
        const schedulesSnap = await getDocs(collection(db, 'users', currentUserId.value, 'schedules'))
        const weekMap = buildWeekScheduleMap(schedulesSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))
        const assignments = resolveWeekAssignments(weekMap, weekKey)

        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({
          day,
          shift: String(assignments[day] || '').trim() || 'Off'
        }))

        const todayEntry = weeklyShiftAssignments.value.find((entry) => entry.day === todayDayName.value)
        todayShiftLabel.value = todayEntry?.shift || fallbackShift
      } catch (error) {
        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
        todayShiftLabel.value = fallbackShift
      }
    }


    const loadManagerData = async () => {
      if (!currentBranchId.value || !currentUserId.value) return

      const staffQuery = query(
        collection(db, 'users'),
        where('branchId', '==', currentBranchId.value),
        where('userType', '==', 'Staff')
      )
      const staffSnapshot = await getDocs(staffQuery)
      staff.value = staffSnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((member) => !member.archived)

      const itemQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))
      const itemSnapshot = await getDocs(itemQuery)
      items.value = itemSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))

      const supplierQuery = query(collection(db, 'suppliers'), where('branchId', '==', currentBranchId.value))
      const supplierSnapshot = await getDocs(supplierQuery)
      suppliers.value = supplierSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))

      const requestQuery = query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))
      const requestSnapshot = await getDocs(requestQuery)
      requests.value = requestSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      deliveredTotals.value = buildDeliveredTotals(requests.value)

      const activityQuery = query(collection(db, 'activities'), where('actorId', '==', currentUserId.value))
      const activitySnapshot = await getDocs(activityQuery)
      recentActivity.value = activitySnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .map((activity) => ({
          ...activity,
          time: activity.createdAt?.toDate?.().toLocaleString() || 'Unknown time'
        }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          staff.value = []
          items.value = []
          suppliers.value = []
          requests.value = []
          recentActivity.value = []
          loading.value = false
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const profile = userSnap.exists() ? userSnap.data() : {}
        currentBranchId.value = profile.branchId || ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          loading.value = false
          return
        }

        loading.value = true
        await loadCurrentUserShift(profile)
        await loadManagerData()
        await logActivity(db, {
          module: 'Manager',
          action: 'Viewed manager dashboard',
          details: 'Opened manager dashboard overview.'
        })
        loading.value = false
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      loading,
      totalStaff,
      activeStaff,
      totalProducts,
      lowStockCount,
      totalSuppliers,
      activeSuppliers,
      totalRequests,
      pendingRequests,
      todayDayName,
      todayShiftLabel,
      weeklyShiftAssignments,
      staffByRole,
      staffByRoleMax,
      lowStockItems,
      getEffectiveMaxStock,
      recentRequests,
      recentActivity
    }
  }
}
</script>
