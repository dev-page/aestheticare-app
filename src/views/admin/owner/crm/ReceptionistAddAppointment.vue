<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Add Appointment</h1>
        <p class="text-slate-400">Schedule a new appointment for a registered client.</p>
      </div>

      <div class="w-full bg-slate-800 rounded-xl p-6 border border-slate-700">
        <form class="space-y-6" @submit.prevent="submitAppointment">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Client</label>
            <select
              v-if="clients.length"
              v-model="form.clientId"
              required
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">Select client</option>
              <option v-for="client in clients" :key="client.id" :value="client.id">
                {{ client.fullName }} - {{ client.phone || client.email || 'No contact' }}
              </option>
            </select>
            <p v-else class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No registered clients yet.
            </p>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Practitioner</label>
            <select
              v-if="availablePractitioners.length"
              v-model="form.practitionerId"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">Let DSS recommend</option>
              <option v-for="practitioner in availablePractitioners" :key="practitioner.id" :value="practitioner.id">
                {{ practitioner.fullName }} - {{ practitioner.email || practitioner.phoneNumber || 'No contact' }}
              </option>
            </select>
            <p v-else class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              {{ form.date ? 'No practitioners are available for the selected date.' : 'No practitioners available yet.' }}
            </p>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-white">Suggested Slots</h2>
                <p class="mt-1 text-sm text-slate-400">
                  Recommendations are based on practitioner schedules and existing appointments.
                </p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                @click="refreshRecommendations"
              >
                Refresh
              </button>
            </div>

            <div v-if="recommendations.length" class="mt-4 grid gap-3 md:grid-cols-3">
              <button
                v-for="recommendation in recommendations"
                :key="recommendation.key"
                type="button"
                class="rounded-xl border border-slate-600 bg-slate-800/80 p-4 text-left transition hover:border-emerald-300 hover:bg-slate-700"
                @click="applyRecommendation(recommendation)"
              >
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">{{ recommendation.title }}</p>
                <p class="mt-2 text-sm font-medium text-white">{{ recommendation.label }}</p>
                <p class="mt-1 text-xs text-slate-300">{{ recommendation.description }}</p>
              </button>
            </div>
            <p v-else class="mt-4 text-sm text-slate-400">
              {{ form.date ? 'No suggested slots for this date yet.' : 'Choose a date to see available suggestions.' }}
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] gap-4">
            <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <label class="block text-slate-400 text-sm">Appointment Calendar</label>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ form.date ? `Selected: ${selectedDateLabel}` : 'Pick a date from the calendar.' }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-700"
                    @click="goToPreviousMonth"
                  >
                    Prev
                  </button>
                  <div class="min-w-[150px] text-center text-sm font-semibold text-white">
                    {{ calendarMonthLabel }}
                  </div>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-600 px-3 py-2 text-slate-300 hover:bg-slate-700"
                    @click="goToNextMonth"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span v-for="day in calendarWeekdays" :key="day">{{ day }}</span>
              </div>

              <div class="mt-3 grid grid-cols-7 gap-2">
                <button
                  v-for="day in calendarDays"
                  :key="day.key"
                  type="button"
                  :disabled="!day.isCurrentMonth || day.isPast"
                  :class="[
                    'min-h-[46px] rounded-xl border text-sm transition',
                    day.isSelected
                      ? 'border-purple-400 bg-purple-500 text-white'
                      : day.isToday
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                        : day.isCurrentMonth
                          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-purple-400 hover:bg-slate-700'
                          : 'border-slate-800 bg-slate-900 text-slate-600',
                    day.isPast ? 'cursor-not-allowed opacity-50' : ''
                  ]"
                  @click="selectCalendarDate(day)"
                >
                  {{ day.dayNumber }}
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Date</label>
                <input
                  v-model="form.date"
                  type="date"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Time</label>
                <input
                  v-model="form.time"
                  type="time"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Service</label>
            <select
              v-if="services.length"
              v-model="form.service"
              required
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">Select service</option>
              <option v-for="service in services" :key="service.id" :value="service.name">
                {{ service.name }}
              </option>
            </select>
            <p v-else class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No services available for this branch yet.
            </p>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Notes</label>
            <textarea v-model="form.notes" rows="3" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"></textarea>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              :disabled="isSubmitting"
              class="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white text-sm"
            >
              {{ isSubmitting ? 'Saving...' : 'Save Appointment' }}
            </button>
            <router-link
              to="/receptionist/appointments"
              class="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm"
            >
              Cancel
            </router-link>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'
import {
  buildAppointmentRecommendations,
  extractShiftWindowMinutes,
  getDayName,
  getWeekStartKey,
  parseClockToMinutes,
} from '@/utils/appointmentDss'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'

export default {
  name: 'ReceptionistAddAppointment',
  components: { OwnerSidebar },
  setup() {
    const router = useRouter()
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const clients = ref([])
    const services = ref([])
    const practitioners = ref([])
    const practitionerSchedules = ref({})
    const branchAppointments = ref([])
    const isSubmitting = ref(false)
    const currentCalendarMonth = ref(new Date())
    const calendarWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    const form = ref({
      clientId: '',
      practitionerId: '',
      date: '',
      time: '',
      service: '',
      notes: ''
    })

    const todayDateString = () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const toDateInput = (date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const calendarMonthLabel = computed(() =>
      currentCalendarMonth.value.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      })
    )

    const selectedDateLabel = computed(() => {
      if (!form.value.date) return ''
      const [year, month, day] = String(form.value.date).split('-').map(Number)
      const nextDate = new Date(year, month - 1, day)
      if (Number.isNaN(nextDate.getTime())) return form.value.date
      return nextDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    })

    const calendarDays = computed(() => {
      const startOfMonth = new Date(currentCalendarMonth.value.getFullYear(), currentCalendarMonth.value.getMonth(), 1)
      const endOfMonth = new Date(currentCalendarMonth.value.getFullYear(), currentCalendarMonth.value.getMonth() + 1, 0)
      const days = []
      const firstDayOffset = (startOfMonth.getDay() + 6) % 7
      const totalCells = Math.ceil((firstDayOffset + endOfMonth.getDate()) / 7) * 7
      const today = todayDateString()

      for (let index = 0; index < totalCells; index += 1) {
        const date = new Date(startOfMonth)
        date.setDate(startOfMonth.getDate() - firstDayOffset + index)
        const iso = toDateInput(date)
        const isCurrentMonth = date.getMonth() === currentCalendarMonth.value.getMonth()
        days.push({
          key: `${iso}-${index}`,
          iso,
          date,
          dayNumber: date.getDate(),
          isCurrentMonth,
          isSelected: form.value.date === iso,
          isToday: iso === today,
          isPast: iso < today
        })
      }

      return days
    })

    const loadClients = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'clients'), where('branchId', '==', currentBranchId.value)))
      clients.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadServices = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(
        query(collection(db, 'productServicePosts'), where('branchId', '==', currentBranchId.value))
      )

      services.value = snapshot.docs
        .map((snap) => {
          const data = snap.data() || {}
          return {
            id: snap.id,
            type: String(data.postType || '').trim().toLowerCase(),
            name: String(data.serviceName || data.title || '').trim(),
          }
        })
        .filter((entry) => entry.type === 'service' && entry.name)
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)))
      branchAppointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const recommendations = computed(() =>
      buildAppointmentRecommendations({
        practitioners: practitioners.value,
        practitionerSchedules: practitionerSchedules.value,
        appointments: branchAppointments.value,
        preferredPractitionerId: form.value.practitionerId,
        selectedDate: form.value.date,
        selectedTime: form.value.time,
        daysAhead: 21,
        slotIntervalMinutes: 60,
        defaultDurationMinutes: 60,
      })
    )

    const loadPractitionerSchedules = async (list) => {
      const pairs = await Promise.all(
        list.map(async (practitioner) => {
          const scheduleSnap = await getDocs(collection(db, 'users', practitioner.id, 'schedules'))
          const weekMap = buildWeekScheduleMap(scheduleSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))

          return [practitioner.id, weekMap]
        })
      )

      practitionerSchedules.value = Object.fromEntries(pairs)
    }

    const loadPractitioners = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', '==', currentBranchId.value)))
      const list = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((user) => {
          const role = String(user.role || '').trim().toLowerCase()
          const userType = String(user.userType || '').trim().toLowerCase()
          return role === 'practitioner' && userType === 'staff' && !user.archived
        })
        .map((user) => ({
          ...user,
          fullName:
            String(user.fullName || '').trim() ||
            `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
            'Unnamed Practitioner'
        }))
        .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')))
      practitioners.value = list
      await loadPractitionerSchedules(list)
    }

    const availablePractitioners = computed(() => {
      const hasDate = Boolean(String(form.value.date || '').trim())
      const hasTime = Boolean(String(form.value.time || '').trim())
      if (!hasDate) return practitioners.value

      const weekKey = getWeekStartKey(form.value.date)
      const dayName = getDayName(form.value.date)
      if (!weekKey || !dayName) return practitioners.value

      const appointmentMinutes = hasTime ? parseClockToMinutes(form.value.time) : null

      return practitioners.value.filter((practitioner) => {
        const assignments = resolveWeekAssignments(practitionerSchedules.value?.[practitioner.id] || {}, weekKey)
        const shiftLabel = String(assignments?.[dayName] || '').trim()
        if (!shiftLabel) return false

        if (!hasTime || appointmentMinutes === null) {
          // Day-based availability only; time is optional refinement.
          return true
        }

        const shiftWindow = extractShiftWindowMinutes(shiftLabel)
        if (!shiftWindow) return true

        let { start, end } = shiftWindow
        let time = appointmentMinutes
        if (end < start) {
          end += 24 * 60
          if (time < start) time += 24 * 60
        }

        return time >= start && time <= end
      })
    })

    watch(
      availablePractitioners,
      (nextList) => {
        if (!form.value.practitionerId) return
        const stillValid = nextList.some((entry) => entry.id === form.value.practitionerId)
        if (!stillValid) form.value.practitionerId = ''
      },
      { immediate: true }
    )

    watch(
      () => form.value.date,
      (value) => {
        if (!value) return
        const [year, month] = String(value).split('-').map(Number)
        if (!year || !month) return
        currentCalendarMonth.value = new Date(year, month - 1, 1)
      }
    )

    const goToPreviousMonth = () => {
      const nextMonth = new Date(currentCalendarMonth.value)
      nextMonth.setMonth(nextMonth.getMonth() - 1)
      currentCalendarMonth.value = nextMonth
    }

    const goToNextMonth = () => {
      const nextMonth = new Date(currentCalendarMonth.value)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      currentCalendarMonth.value = nextMonth
    }

    const selectCalendarDate = (day) => {
      if (!day?.isCurrentMonth || day.isPast) return
      form.value.date = day.iso
    }

    const applyRecommendation = (recommendation) => {
      if (!recommendation) return
      form.value.date = recommendation.date
      form.value.time = recommendation.time
      form.value.practitionerId = recommendation.practitionerId
      const [year, month] = String(recommendation.date).split('-').map(Number)
      if (year && month) {
        currentCalendarMonth.value = new Date(year, month - 1, 1)
      }
      toast.success(`Recommended slot applied: ${recommendation.label}`)
    }

    const refreshRecommendations = () => {
      if (!recommendations.value.length) {
        toast.info('No schedule recommendations are available yet.')
        return
      }
      toast.success('Schedule recommendations refreshed.')
    }

    const submitAppointment = async () => {
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('Your account is not ready for appointment creation.')
        return
      }

      const selectedClient = clients.value.find((item) => item.id === form.value.clientId)
      if (!selectedClient) {
        toast.error('Please select a valid client.')
        return
      }
      const selectedPractitioner = practitioners.value.find((item) => item.id === form.value.practitionerId)
      if (!selectedPractitioner) {
        toast.error('Please select a valid practitioner.')
        return
      }

      isSubmitting.value = true
      try {
        await addDoc(collection(db, 'appointments'), {
          clientId: selectedClient.id,
          clientName: selectedClient.fullName || `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim(),
          practitionerId: selectedPractitioner.id,
          assignedPractitionerId: selectedPractitioner.id,
          practitionerName: selectedPractitioner.fullName,
          assignedPractitionerName: selectedPractitioner.fullName,
          service: form.value.service.trim(),
          date: form.value.date,
          time: form.value.time,
          notes: form.value.notes.trim(),
          status: 'Scheduled',
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        await logActivity(db, {
          actorId: currentUserId.value,
          action: 'Added an appointment',
          details: `Scheduled ${selectedClient.fullName || 'client'} with ${selectedPractitioner.fullName || 'practitioner'} on ${form.value.date} ${form.value.time}`,
          module: 'Receptionist'
        })

        toast.success('Appointment created successfully.')
        router.push('/receptionist/appointments')
      } catch (error) {
        console.error(error)
        toast.error('Failed to create appointment.')
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        await Promise.all([loadClients(), loadServices(), loadPractitioners(), loadAppointments()])
        if (!form.value.date) {
          form.value.date = todayDateString()
        }
      })
    })

    return {
      form,
      clients,
      services,
      practitioners,
      availablePractitioners,
      calendarWeekdays,
      calendarMonthLabel,
      calendarDays,
      selectedDateLabel,
      recommendations,
      goToPreviousMonth,
      goToNextMonth,
      selectCalendarDate,
      applyRecommendation,
      refreshRecommendations,
      isSubmitting,
      submitAppointment
    }
  }
}
</script>
