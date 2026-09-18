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
              v-if="practitioners.length"
              v-model="form.practitionerId"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">Select practitioner</option>
              <option v-for="practitioner in practitioners" :key="practitioner.id" :value="practitioner.id">
                {{ practitioner.fullName }} - {{ practitioner.email || practitioner.phoneNumber || 'No contact' }}
              </option>
            </select>
            <p v-else class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              {{ form.date ? 'No practitioners are available for the selected date.' : 'No practitioners available yet.' }}
            </p>
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
              <option v-for="service in services" :key="service.id" :value="service.id">
                {{ service.name }}
              </option>
            </select>
            <p v-else class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              No services available for this branch yet.
            </p>
          </div>

          <div v-if="selectedServiceDetails" class="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h2 class="text-sm font-semibold text-white">{{ selectedServiceDetails.name }}</h2>
            <p class="mt-2 text-sm text-slate-300">{{ selectedServiceDetails.description || 'No service description provided.' }}</p>
            <div class="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
              <span>Duration: {{ selectedServiceDetails.durationMinutes }} minutes</span>
              <span>Price: PHP {{ selectedServiceDetails.price > 0 ? selectedServiceDetails.price.toFixed(2) : 'Not configured' }}</span>
              <span v-if="selectedServiceDetails.requiresConsultationFirst">Consultation required first</span>
            </div>
            <div v-if="clinicPolicies.length" class="mt-4 border-t border-slate-700 pt-3">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Active clinic policies</p>
              <div class="mt-2 space-y-2">
                <p v-for="policy in clinicPolicies" :key="policy.key" class="text-sm leading-5 text-slate-300">
                  <span class="font-medium text-slate-200">{{ policy.label }}:</span> {{ policy.text }}
                </p>
              </div>
            </div>
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
                    {{ form.date ? `Selected: ${selectedDateLabel}` : 'Select a practitioner and service, then choose an available date.' }}
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
                  :disabled="!day.isCurrentMonth || !day.isAvailable"
                  :title="day.isAvailable ? 'Available appointments' : 'No available times'"
                  :class="[
                    'min-h-[46px] rounded-xl border text-sm transition',
                    day.isSelected
                      ? 'border-purple-400 bg-purple-500 text-white'
                      : day.isToday
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                        : day.isCurrentMonth
                          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-purple-400 hover:bg-slate-700'
                          : 'border-slate-800 bg-slate-900 text-slate-600',
                    !day.isAvailable ? 'cursor-not-allowed opacity-40' : ''
                  ]"
                  @click="selectCalendarDate(day)"
                >
                  {{ day.dayNumber }}
                </button>
              </div>
              <p class="mt-3 text-xs text-slate-400">Unavailable days are disabled. Only times that fit the full treatment within the assigned shift can be booked.</p>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Date</label>
                <input
                  :value="selectedDateLabel"
                  type="text"
                  readonly
                  placeholder="Choose an available calendar date"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Time</label>
                <select
                  :disabled="!availableTimeOptions.length"
                  v-model="form.time"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">{{ availableTimeOptions.length ? 'Select available time' : 'No available times' }}</option>
                  <option v-for="option in availableTimeOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <p class="mt-2 text-xs text-slate-400">{{ !form.practitionerId || !form.service ? 'Select a practitioner and service to see available dates and times.' : availableTimeOptions.length ? 'Times include the full treatment duration.' : 'No times available. Choose another enabled date or practitioner.' }}</p>
              </div>
            </div>
          </div>

          <label v-if="clinicPolicies.length" class="flex items-start gap-2 text-sm text-slate-300">
            <input v-model="policyAcknowledged" type="checkbox" class="mt-1" />
            <span>I have reviewed the clinic policies above with the client, and the client acknowledges them.</span>
          </label>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Notes</label>
            <textarea v-model="form.notes" rows="3" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"></textarea>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              :disabled="isSubmitting || !form.time || !selectedServiceDetails || !(selectedServiceDetails.price > 0)"
              class="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white text-sm"
            >
              {{ isSubmitting ? 'Saving...' : 'Save Appointment' }}
            </button>
            <router-link
              to="/crm/appointments"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { buildWeekScheduleMap } from '@/utils/employeeSchedules'
import { getAppointmentSlots } from '@/utils/appointmentSlots'

export default {
  name: 'ReceptionistAddAppointment',
  components: { OwnerSidebar },
  setup() {
    const router = useRouter()
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const fetchFromBackend = async (path, options = {}) => {
      const candidates = OTP_BACKEND_CANDIDATES
      let lastError = null
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

      for (const baseUrl of candidates) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: { ...(options.headers || {}), ...authHeader },
          })
          if (response.status === 404) {
            lastError = new Error(`Endpoint not found on ${baseUrl}`)
            continue
          }
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.toLowerCase().includes('application/json')) {
            lastError = new Error(`Non-JSON response from ${baseUrl}`)
            continue
          }
          return response
        } catch (error) {
          lastError = error
        }
      }

      throw lastError || new Error('Failed to reach backend service')
    }

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const clients = ref([])
    const services = ref([])
    const practitioners = ref([])
    const practitionerSchedules = ref({})
    const branchAppointments = ref([])
    const clinicPolicies = ref([])
    const isSubmitting = ref(false)
    const loadingSchedules = ref(true)
    const availabilityNow = ref(Date.now())
    const policyAcknowledged = ref(false)
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

    const todayDateString = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(availabilityNow.value))

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
          isPast: iso < today,
          isAvailable: iso >= today && slotsForDate(iso).length > 0
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
            ...data,
            price: Number(data.price),
            description: String(data.description || ''),
            id: snap.id,
            type: String(data.postType || '').trim().toLowerCase(),
            name: String(data.serviceName || data.title || '').trim(),
            durationMinutes: Math.max(1, Number(data.durationMinutes || 60)),
          }
        })
        .filter((entry) => entry.type === 'service' && entry.name && entry.isPublished === true && entry.financeStatus === 'approved' && !entry.archived && entry.status !== 'Archived')
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)))
      branchAppointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadClinicPolicies = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDoc(doc(db, 'clinicPolicies', currentBranchId.value))
      const data = snapshot.exists() ? snapshot.data() || {} : {}
      const definitions = [
        ['cancellationPolicy', 'Cancellation policy'],
        ['reschedulePolicy', 'Reschedule policy'],
        ['refundPolicy', 'Refund policy'],
        ['consultationPolicy', 'Consultation policy'],
        ['serviceTerms', 'Service terms'],
        ['paymentPolicy', 'Payment policy'],
      ]
      clinicPolicies.value = definitions
        .filter(([key]) => data[`${key}Enabled`] === true && String(data[key] || '').trim())
        .map(([key, label]) => ({ key, label, text: String(data[key]).trim() }))
    }

    const recommendations = computed(() => {
      if (!selectedServiceDetails.value || loadingSchedules.value) return []
      const list = form.value.practitionerId ? practitioners.value.filter(p => p.id === form.value.practitionerId) : practitioners.value
      const results = []
      for (let offset = 0; offset < 21 && results.length < 3; offset++) {
        const date = new Date(todayDateString() + 'T12:00:00')
        date.setDate(date.getDate() + offset)
        const dateKey = toDateInput(date)
        for (const practitioner of list) {
          const slot = slotsForDate(dateKey, practitioner.id)[0]
          if (slot) results.push({ key: dateKey + practitioner.id, date: dateKey, time: slot.value, practitionerId: practitioner.id, title: 'Available appointment', label: dateKey + ' ? ' + slot.label + ' ? ' + practitioner.fullName, description: 'Fits the treatment duration and assigned shift.' })
          if (results.length === 3) break
        }
      }
      return results
    })

    const loadPractitionerSchedules = async (list) => {
      const shiftSnapshot = await getDocs(query(collection(db, 'shifts'), where('branchId', '==', currentBranchId.value)))
      const shifts = new Map(shiftSnapshot.docs.map(snap => [snap.id, snap.data()]))
      const pairs = await Promise.all(
        list.map(async (practitioner) => {
          const scheduleSnap = await getDocs(collection(db, 'users', practitioner.id, 'schedules'))
          const weekMap = buildWeekScheduleMap(scheduleSnap.docs.map((snap) => {
            const data = snap.data() || {}
            const labels = { ...(data.assignmentLabels || {}) }
            for (const [day, assignment] of Object.entries(data.assignments || {})) {
              const shift = shifts.get(assignment)
              labels[day] = !assignment || String(assignment).toLowerCase() === 'off' ? '' : shift ? shift.start + ' - ' + shift.end : labels[day] || assignment
            }
            return { id: snap.id, data: { ...data, assignmentLabels: labels } }
          }))

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
          const customRoleName = String(user.customRoleName || '').trim().toLowerCase()
          const userType = String(user.userType || '').trim().toLowerCase()
          const isPractitioner = role === 'practitioner' || customRoleName.includes('practitioner')
          return isPractitioner && userType === 'staff' && !user.archived && user.status !== 'Inactive'
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

    watch(() => form.value.clientId, () => { policyAcknowledged.value = false })
    const selectedServiceDetails = computed(() => services.value.find(service => service.id === form.value.service) || null)
    const slotsForDate = (date, practitionerId = form.value.practitionerId) => loadingSchedules.value ? [] : getAppointmentSlots({
      date, practitionerId, schedules: practitionerSchedules.value, appointments: branchAppointments.value,
      durationMinutes: selectedServiceDetails.value?.durationMinutes, now: availabilityNow.value,
    })
    const availableTimeOptions = computed(() => slotsForDate(form.value.date))
    watch(availableTimeOptions, options => {
      if (!options.some(option => option.value === form.value.time)) form.value.time = options[0]?.value || ''
    })
    watch([() => form.value.practitionerId, () => form.value.service, loadingSchedules], () => {
      if (loadingSchedules.value || !form.value.practitionerId || !form.value.service) return
      if (slotsForDate(form.value.date).length) return
      form.value.date = ''
      for (let offset = 0; offset < 90; offset++) {
        const date = new Date(todayDateString() + 'T12:00:00')
        date.setDate(date.getDate() + offset)
        const key = toDateInput(date)
        if (slotsForDate(key).length) { form.value.date = key; break }
      }
    })

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
      if (!day?.isCurrentMonth || !day.isAvailable) return
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

    const refreshRecommendations = async () => {
      loadingSchedules.value = true
      try {
        await Promise.all([loadPractitioners(), loadAppointments(), loadServices()])
        availabilityNow.value = Date.now()
        toast.success('Availability updated.')
      } catch (error) { toast.error('Could not refresh availability. Please try again.') }
      finally { loadingSchedules.value = false }
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

      const selectedService = services.value.find((item) => item.id === form.value.service)
      const durationMinutes = Math.max(1, Number(selectedService?.durationMinutes || 60))
      availabilityNow.value = Date.now()
      if (!selectedService || !(selectedService.price > 0)) { toast.error('Select a service with a configured price.'); return }
      if (clinicPolicies.value.length && !policyAcknowledged.value) { toast.error('Please review the clinic policies with the client first.'); return }
      if (!slotsForDate(form.value.date).some(slot => slot.value === form.value.time)) {
        toast.error('The selected time is outside this practitioner\'s assigned shift. Choose a suggested slot or another time.')
        return
      }

      isSubmitting.value = true
      try {
        // Build a reservation payload and send to the backend bookings.create endpoint.
        const reservation = {
          customerId: selectedClient.id,
          clientId: selectedClient.id,
          source: 'walk_in',
          customerName: selectedClient.fullName || `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim(),
          customerEmail: selectedClient.email || '',
          customerPhone: selectedClient.phone || '',
          practitionerId: selectedPractitioner.id,
          practitionerName: selectedPractitioner.fullName,
          selectedServices: [selectedService],
          selectedServiceIds: [selectedService.id],
          service: selectedService.name,
          policyAcknowledged: policyAcknowledged.value,
          date: form.value.date,
          time: form.value.time,
          durationMinutes,
          notes: form.value.notes.trim(),
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
        }

        const resp = await fetchFromBackend('/bookings/create', {
          method: 'POST',
          body: JSON.stringify({ reservation }),
          headers: { 'Content-Type': 'application/json' },
        })

        const payload = await resp.json()
        if (!payload || !payload.success) {
          console.error('Booking creation failed', payload)
          throw new Error(payload?.error || 'Booking creation failed')
        }

        // Log activity locally in Firestore for audit
        try {
          await logActivity(db, {
            actorId: currentUserId.value,
            action: 'Created booking',
            details: `Booking ${payload.data?.bookingId || ''} created for ${reservation.customerName} on ${reservation.date} ${reservation.time}`,
            module: 'Receptionist',
          })
        } catch (logErr) {
          console.warn('Failed to log activity after booking creation:', logErr)
        }

        toast.success('Walk-in appointment approved. Collect payment at POS.')
        router.push('/crm/appointments')
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Failed to create appointment.')
      } finally {
        isSubmitting.value = false
      }
    }

    let clockTimer
    let stopAuth
    onUnmounted(() => { clearInterval(clockTimer); stopAuth?.() })
    onMounted(() => {
      clockTimer = setInterval(() => { availabilityNow.value = Date.now() }, 30000)
      stopAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        try {
          await Promise.all([loadClients(), loadServices(), loadPractitioners(), loadAppointments(), loadClinicPolicies()])
        } catch (error) { toast.error('Could not load appointment details. Please refresh the page.'); return }
        loadingSchedules.value = false
        if (!form.value.date) {
          form.value.date = todayDateString()
        }
      })
    })

    return {
      form,
      clients,
      services,
      selectedServiceDetails,
      clinicPolicies,
      availableTimeOptions,
      practitioners,
      policyAcknowledged,
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
