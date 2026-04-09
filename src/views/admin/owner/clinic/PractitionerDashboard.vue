<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Practitioner Dashboard</h1>
        <p class="text-slate-400">Your assigned appointment calendar and daily schedule.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Assigned Clients</h3>
          <p class="text-3xl font-bold text-white">{{ assignedClientCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Today's Appointments</h3>
          <p class="text-3xl font-bold text-white">{{ todayCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">This Month</h3>
          <p class="text-3xl font-bold text-white">{{ monthCount }}</p>
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

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section class="xl:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div class="flex items-center justify-between mb-6">
            <button @click="changeMonth(-1)" class="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors">
              Previous
            </button>
            <h2 class="text-xl font-semibold text-white">{{ monthLabel }}</h2>
            <button @click="changeMonth(1)" class="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors">
              Next
            </button>
          </div>

          <div class="grid grid-cols-7 gap-2 mb-3">
            <p v-for="day in weekdayLabels" :key="day" class="text-xs text-slate-400 font-medium text-center py-2">{{ day }}</p>
          </div>

          <div class="grid grid-cols-7 gap-2">
            <button
              v-for="cell in calendarCells"
              :key="cell.key"
              @click="selectDate(cell.dateKey)"
              :disabled="!cell.inMonth"
              class="rounded-lg min-h-[90px] p-2 text-left border transition-colors"
              :class="cellClass(cell)"
            >
              <p class="text-xs font-medium mb-2" :class="cell.inMonth ? 'text-slate-200' : 'text-slate-500'">
                {{ cell.dayNumber }}
              </p>
              <div class="space-y-1">
                <p
                  v-for="item in cell.appointments.slice(0, 2)"
                  :key="item.id"
                  class="text-[11px] rounded px-2 py-1 truncate bg-purple-500/20 text-purple-300"
                >
                  {{ item.time || 'Time TBD' }} · {{ item.clientName || 'Client' }}
                </p>
                <p v-if="cell.appointments.length > 2" class="text-[11px] text-slate-400">
                  +{{ cell.appointments.length - 2 }} more
                </p>
              </div>
            </button>
          </div>
        </section>

        <aside class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 class="text-white text-lg font-semibold mb-1">Selected Day</h3>
          <p class="text-slate-400 text-sm mb-5">{{ selectedDateLabel }}</p>

          <div class="space-y-3">
            <div
              v-for="appointment in selectedDateAppointments"
              :key="appointment.id"
              class="p-3 rounded-lg bg-slate-700 border border-slate-600"
            >
              <p class="text-white text-sm font-medium">{{ appointment.clientName || 'Unknown Client' }}</p>
              <p class="text-slate-300 text-xs mt-1">{{ appointment.service || 'Service not set' }}</p>
              <div class="flex items-center justify-between mt-2">
                <p class="text-slate-400 text-xs">{{ appointment.time || 'Time TBD' }}</p>
                <span class="text-[11px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                  {{ appointment.status || 'Scheduled' }}
                </span>
              </div>
            </div>

            <div v-if="selectedDateAppointments.length === 0" class="text-sm text-slate-400">
              No assigned appointments for this day.
            </div>
          </div>
        </aside>
      </div>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'

export default {
  name: 'PractitionerDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const appointments = ref([])
    const calendarMonth = ref(new Date())
    const selectedDate = ref('')
    const todayShiftLabel = ref('Off')
    const weeklyShiftAssignments = ref([])

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const todayDayName = computed(() =>
      new Date().toLocaleDateString('en-US', { weekday: 'long' })
    )

    const toDateKey = (dateObj) => {
      const month = `${dateObj.getMonth() + 1}`.padStart(2, '0')
      const day = `${dateObj.getDate()}`.padStart(2, '0')
      return `${dateObj.getFullYear()}-${month}-${day}`
    }

    const isAssignedToPractitioner = (appointment) => {
      const assignedIds = [
        appointment.practitionerId,
        appointment.assignedPractitionerId,
        appointment.staffId,
        appointment.assignedTo
      ]
      return assignedIds.some((value) => value && String(value) === currentUserId.value)
    }

    const assignedAppointments = computed(() =>
      appointments.value
        .filter((item) => isAssignedToPractitioner(item))
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
    )

    const selectedDateAppointments = computed(() =>
      assignedAppointments.value.filter((item) => item.date === selectedDate.value)
    )

    const assignedClientCount = computed(() => {
      const names = new Set(
        assignedAppointments.value
          .map((item) => (item.clientName || item.patientName || '').trim())
          .filter(Boolean)
      )
      return names.size
    })

    const todayKey = computed(() => toDateKey(new Date()))
    const todayCount = computed(() => assignedAppointments.value.filter((item) => item.date === todayKey.value).length)

    const monthKey = computed(() => {
      const month = `${calendarMonth.value.getMonth() + 1}`.padStart(2, '0')
      return `${calendarMonth.value.getFullYear()}-${month}`
    })

    const monthCount = computed(() =>
      assignedAppointments.value.filter((item) => (item.date || '').startsWith(monthKey.value)).length
    )

    const monthLabel = computed(() =>
      calendarMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    )

    const selectedDateLabel = computed(() => {
      if (!selectedDate.value) return 'No date selected'
      const [year, month, day] = selectedDate.value.split('-').map(Number)
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    })

    const groupedByDate = computed(() => {
      const map = new Map()
      assignedAppointments.value.forEach((item) => {
        const key = item.date || ''
        if (!key) return
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(item)
      })
      return map
    })

    const calendarCells = computed(() => {
      const year = calendarMonth.value.getFullYear()
      const month = calendarMonth.value.getMonth()
      const firstDay = new Date(year, month, 1)
      const start = new Date(firstDay)
      start.setDate(start.getDate() - firstDay.getDay())

      return Array.from({ length: 42 }).map((_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        const dateKey = toDateKey(date)
        return {
          key: `${dateKey}-${index}`,
          dateKey,
          dayNumber: date.getDate(),
          inMonth: date.getMonth() === month,
          appointments: groupedByDate.value.get(dateKey) || []
        }
      })
    })

    const cellClass = (cell) => {
      if (!cell.inMonth) {
        return 'bg-slate-900/30 border-slate-800 cursor-not-allowed'
      }

      if (cell.dateKey === selectedDate.value) {
        return 'bg-slate-700 border-purple-500'
      }

      if (cell.appointments.length > 0) {
        return 'bg-slate-700/70 border-slate-600 hover:border-purple-400'
      }

      return 'bg-slate-800 border-slate-700 hover:border-slate-500'
    }

    const selectDate = (dateKey) => {
      selectedDate.value = dateKey
    }

    const changeMonth = (offset) => {
      const next = new Date(calendarMonth.value)
      next.setMonth(next.getMonth() + offset)
      calendarMonth.value = next
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
      } catch {
        weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
        todayShiftLabel.value = fallbackShift
      }
    }

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(
        query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))
      )
      appointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      selectedDate.value = toDateKey(new Date())
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        loading.value = true
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          todayShiftLabel.value = 'Off'
          weeklyShiftAssignments.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
          loading.value = false
          return
        }

        try {
          currentUserId.value = user.uid
          const userSnap = await getDoc(doc(db, 'users', user.uid))
          const profile = userSnap.exists() ? userSnap.data() : {}
          currentBranchId.value = profile.branchId || ''
          await loadCurrentUserShift(profile)
          if (!currentBranchId.value) {
            toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
            return
          }

          await loadAppointments()
        } finally {
          loading.value = false
        }
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      loading,
      weekdayLabels,
      calendarCells,
      monthLabel,
      selectedDateAppointments,
      selectedDateLabel,
      assignedClientCount,
      todayCount,
      monthCount,
      todayDayName,
      todayShiftLabel,
      weeklyShiftAssignments,
      cellClass,
      selectDate,
      changeMonth
    }
  }
}
</script>
