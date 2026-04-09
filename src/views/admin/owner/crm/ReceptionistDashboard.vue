<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="mb-2 text-3xl font-bold text-white">Receptionist Dashboard</h1>
          <p class="text-slate-400">Daily overview of clients, appointments, messages, and transactions.</p>
        </div>
        <router-link
          to="/receptionist/appointment-requests"
          class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Review Appointment Requests
        </router-link>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Total Clients</h3>
          <p class="text-3xl font-bold text-white">{{ totalClients }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Today's Appointments</h3>
          <p class="text-3xl font-bold text-white">{{ todayAppointments }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Unread Inbox</h3>
          <p class="text-3xl font-bold text-white">{{ unreadMessages }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Transactions</h3>
          <p class="text-3xl font-bold text-white">{{ totalTransactions }}</p>
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

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Upcoming Appointments</h2>
          <div class="space-y-3">
            <div
              v-for="appointment in upcomingAppointments.slice(0, 6)"
              :key="appointment.id"
              class="p-3 bg-slate-700 rounded-lg flex items-center justify-between"
            >
              <div>
                <p class="text-white text-sm font-medium">{{ appointment.clientName || 'Unknown Client' }}</p>
                <p class="text-slate-400 text-xs">{{ appointment.service || 'Service not set' }}</p>
              </div>
              <p class="text-slate-300 text-sm">{{ appointment.date }} {{ appointment.time || '' }}</p>
            </div>
            <p v-if="upcomingAppointments.length === 0" class="text-slate-400 text-sm">No upcoming appointments.</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 class="text-xl font-semibold text-white mb-6">Recent Transactions</h2>
          <div class="space-y-3">
            <div
              v-for="txn in recentTransactions.slice(0, 6)"
              :key="txn.id"
              class="p-3 bg-slate-700 rounded-lg flex items-center justify-between"
            >
              <div>
                <p class="text-white text-sm font-medium">{{ txn.clientName || 'Walk-in Client' }}</p>
                <p class="text-slate-400 text-xs">{{ txn.method || 'N/A' }}</p>
              </div>
              <p class="text-green-400 text-sm font-semibold">{{ formatAmount(txn.amount) }}</p>
            </div>
            <p v-if="recentTransactions.length === 0" class="text-slate-400 text-sm">No transactions yet.</p>
          </div>
        </div>
      </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { toast } from 'vue3-toastify'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'

export default {
  name: 'ReceptionistDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const loading = ref(true)
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const clients = ref([])
    const appointments = ref([])
    const messages = ref([])
    const transactions = ref([])
    const todayShiftLabel = ref('Off')
    const weeklyShiftAssignments = ref([])
    let unsubscribeMessages = null

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const todayDayName = computed(() =>
      new Date().toLocaleDateString('en-US', { weekday: 'long' })
    )

    const totalClients = computed(() => clients.value.length)
    const totalTransactions = computed(() => transactions.value.length)
    const unreadMessages = computed(() => messages.value.filter((item) => !item.isRead).length)

    const todayKey = computed(() => {
      const today = new Date()
      const month = `${today.getMonth() + 1}`.padStart(2, '0')
      const day = `${today.getDate()}`.padStart(2, '0')
      return `${today.getFullYear()}-${month}-${day}`
    })

    const todayAppointments = computed(() =>
      appointments.value.filter((item) => item.date === todayKey.value).length
    )

    const upcomingAppointments = computed(() =>
      [...appointments.value]
        .filter((item) => (item.date || '') >= todayKey.value)
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
    )

    const recentTransactions = computed(() =>
      [...transactions.value].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    )

    const formatAmount = (amount) => {
      const numeric = Number(amount || 0)
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(numeric)
    }

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

    const loadCurrentUserShift = async (profile = {}, userId = '') => {
      const fallbackShift =
        String(profile.shiftStart || '').trim() && String(profile.shiftEnd || '').trim()
          ? `${profile.shiftStart} - ${profile.shiftEnd}`
          : 'Off'

      try {
        const weekKey = getWeekStartKey(new Date())
        const schedulesSnap = await getDocs(collection(db, 'users', userId, 'schedules'))
        const weekMap = buildWeekScheduleMap(schedulesSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))
        const assignments = resolveWeekAssignments(weekMap, weekKey)

        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({
          day,
          shift: String(assignments[day] || '').trim() || 'Off'
        }))

        const todayEntry = weeklyShiftAssignments.value.find((entry) => entry.day === todayDayName.value)
        todayShiftLabel.value = todayEntry?.shift || fallbackShift
      } catch {
        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
        todayShiftLabel.value = fallbackShift
      }
    }

    const loadDashboardData = async () => {
      if (!currentBranchId.value) return

      const [clientSnap, appointmentSnap, inboxSnap, transactionSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'messages'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value)))
      ])

      clients.value = clientSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      appointments.value = appointmentSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      messages.value = inboxSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      transactions.value = transactionSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const startMessageListener = () => {
      if (!currentBranchId.value) return
      if (unsubscribeMessages) unsubscribeMessages()
      const messageQuery = query(collection(db, 'messages'), where('branchId', '==', currentBranchId.value))
      unsubscribeMessages = onSnapshot(messageQuery, (snapshot) => {
        messages.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      })
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          todayShiftLabel.value = 'Off'
          weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
          loading.value = false
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const profile = userSnap.exists() ? userSnap.data() : {}
        currentUserId.value = user.uid
        currentBranchId.value = profile.branchId || ''
        await loadCurrentUserShift(profile, user.uid)
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          loading.value = false
          return
        }

        loading.value = true
        await loadDashboardData()
        startMessageListener()
        loading.value = false
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (unsubscribeMessages) unsubscribeMessages()
    })

    return {
      loading,
      totalClients,
      todayAppointments,
      unreadMessages,
      totalTransactions,
      todayDayName,
      todayShiftLabel,
      weeklyShiftAssignments,
      upcomingAppointments,
      recentTransactions,
      formatAmount
    }
  }
}
</script>

