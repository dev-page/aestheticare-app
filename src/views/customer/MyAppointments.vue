<template>
  <div class="appointments-shell">
    <CustomerSidebar />

    <main class="appointments-main">
      <div class="appointments-content">
        <section class="appointments-header">
          <h1 class="appointments-title">My Appointments</h1>
        </section>

        <section class="appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Active Bookings</p>
              <h2 class="panel-title">Upcoming Appointments</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading appointments...' : `${upcomingAppointments.length} appointment${upcomingAppointments.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <p class="state-title">Loading appointments...</p>
          </div>

          <div v-else class="appointments-table-wrap">
            <table class="appointments-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appt in upcomingAppointments" :key="appt.id">
                  <td class="appointment-service-cell">
                    <div class="table-primary">{{ formatAppointmentServices(appt) }}</div>
                  </td>
                  <td>
                    <div class="table-primary">{{ appt.clinic }}</div>
                  </td>
                  <td>{{ appt.date }}</td>
                  <td>{{ appt.time }}</td>
                  <td>
                    <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button
                        @click="openRequestModal('reschedule', appt)"
                        class="appointment-button appointment-button-secondary"
                        :disabled="isRequestPending(appt, 'reschedule')"
                      >
                        {{ isRequestPending(appt, 'reschedule') ? 'Pending Approval' : 'Reschedule' }}
                      </button>
                      <button
                        @click="openRequestModal('cancel', appt)"
                        class="appointment-button appointment-button-danger"
                        :disabled="isRequestPending(appt, 'cancel')"
                      >
                        {{ isRequestPending(appt, 'cancel') ? 'Pending Approval' : 'Cancel' }}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!upcomingAppointments.length">
                  <td colspan="6" class="table-empty-cell">No upcoming appointments.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">History</p>
              <h2 class="panel-title">Past Appointments</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading appointments...' : `${pastAppointments.length} appointment${pastAppointments.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <p class="state-title">Loading appointments...</p>
          </div>

          <div v-else class="appointments-table-wrap">
            <table class="appointments-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appt in pastAppointments" :key="appt.id">
                  <td class="appointment-service-cell">
                    <div class="table-primary">{{ formatAppointmentServices(appt) }}</div>
                  </td>
                  <td>
                    <div class="table-primary">{{ appt.clinic }}</div>
                  </td>
                  <td>{{ appt.date }}</td>
                  <td>{{ appt.time }}</td>
                  <td>
                    <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span>
                  </td>
                </tr>
                <tr v-if="!pastAppointments.length">
                  <td colspan="5" class="table-empty-cell">No past appointments.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div v-if="requestModal.open" class="request-modal-overlay">
        <div class="request-modal-shell">
          <div class="request-modal-head">
            <div>
              <p class="request-modal-kicker">
                {{ requestModal.type === 'cancel' ? 'Cancellation Request' : 'Reschedule Request' }}
              </p>
              <h3 class="request-modal-title">
                {{ requestModal.type === 'cancel' ? 'Request Appointment Cancellation' : 'Request Appointment Reschedule' }}
              </h3>
              <p class="request-modal-summary">
                {{ requestModal.appointment ? `${formatAppointmentServices(requestModal.appointment)} - ${requestModal.appointment.date} - ${requestModal.appointment.time}` : '' }}
              </p>
            </div>
            <button type="button" class="request-close-button" @click="closeRequestModal">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>

          <div class="request-modal-body">
            <div class="request-policy-card">
              <p class="request-policy-title">Clinic policy</p>
              <p class="mt-2 whitespace-pre-wrap">{{ requestPolicyText }}</p>
              <p class="mt-3">
                {{ requestModal.type === 'cancel'
                  ? `If approved, the refundable amount will exclude the system commission and the request will be reviewed by clinic staff first.`
                  : `Reschedule requests must still be approved before the appointment can move to the new date and time.` }}
              </p>
            </div>

            <div>
              <label class="request-field-label">Reason *</label>
              <textarea
                v-model.trim="requestModal.reason"
                rows="4"
                class="request-textarea"
                placeholder="Tell the clinic why you need this request."
              ></textarea>
            </div>

            <div v-if="requestModal.type === 'reschedule'" class="request-reschedule-grid">
              <div class="request-card">
                <div class="request-card-head">
                  <button
                    type="button"
                    class="request-nav-button"
                    :disabled="!canGoToPreviousRequestMonth"
                    @click="changeRequestCalendarMonth(-1)"
                  >
                    Prev
                  </button>
                  <p class="request-card-title">{{ requestCalendarMonthLabel }}</p>
                  <button
                    type="button"
                    class="request-nav-button"
                    :disabled="!canGoToNextRequestMonth"
                    @click="changeRequestCalendarMonth(1)"
                  >
                    Next
                  </button>
                </div>

                <div class="request-weekdays">
                  <span v-for="day in requestCalendarWeekdays" :key="day">{{ day }}</span>
                </div>

                <div class="request-calendar-grid">
                  <button
                    v-for="day in requestCalendarDays"
                    :key="day.dateKey"
                    type="button"
                    class="request-day-button"
                    :class="[
                      day.inCurrentMonth ? 'request-day-current' : 'request-day-other',
                      day.isAvailable ? 'request-day-available' : 'request-day-disabled',
                      day.isSelected ? 'request-day-selected' : '',
                    ]"
                    :disabled="!day.isAvailable"
                    @click="selectRequestDate(day.dateKey)"
                  >
                    <span class="text-sm font-semibold">{{ day.dayNumber }}</span>
                    <span class="request-day-dot"></span>
                  </button>
                </div>

                <p class="request-selected-date">{{ requestSelectedDateLabel }}</p>
              </div>

              <div class="request-card">
                <div class="request-card-head request-card-head-stack">
                  <div>
                    <p class="request-card-kicker">Available Schedules</p>
                    <h4 class="request-card-title">Choose a new time slot</h4>
                  </div>
                  <span class="request-duration-pill">
                    {{ requestBookingDurationMinutes }} mins
                  </span>
                </div>

                <div v-if="requestModal.loadingAvailability" class="request-info-card">
                  Loading available schedules...
                </div>
                <div v-else-if="requestModal.availabilityError" class="request-info-card request-info-card-warn">
                  {{ requestModal.availabilityError }}
                </div>
                <div v-else-if="requestSlotsForSelectedDate.length" class="request-slot-list">
                  <button
                    v-for="slot in requestSlotsForSelectedDate"
                    :key="slot.key"
                    type="button"
                    class="request-slot-button"
                    :class="requestModal.requestedSlotKey === slot.key ? 'request-slot-button-selected' : ''"
                    @click="selectRequestSlot(slot)"
                  >
                    <div class="text-base font-semibold">Starts at {{ minutesToTime12(parseClockToMinutes(slot.time)) }}</div>
                    <div class="mt-1 text-xs text-[#7f6654]">{{ slot.practitionerName }}</div>
                  </button>
                </div>
                <div v-else class="request-info-card request-info-card-muted">
                  {{ requestModal.requestedDate ? 'No available time slots on this date.' : 'Choose a date from the calendar to view available time slots.' }}
                </div>

                <div class="request-detail-list">
                  <p>
                    Assigned Practitioner:
                    <span class="request-detail-strong">
                      {{ requestModalPractitioner?.fullName || requestModal.appointment?.assignedPractitionerName || requestModal.appointment?.practitionerName || 'Assigned Practitioner' }}
                    </span>
                  </p>
                  <p>
                    Total duration:
                    <span class="request-detail-strong">{{ requestBookingDurationMinutes }} mins</span>
                  </p>
                </div>
              </div>
            </div>

            <div class="request-modal-actions">
              <p class="request-action-note">
                The clinic will review this request before any refund or schedule change is finalized.
              </p>
              <div class="request-action-buttons">
                <button
                  type="button"
                  class="request-button request-button-secondary"
                  @click="closeRequestModal"
                >
                  Close
                </button>
                <button
                  type="button"
                  class="request-button request-button-primary"
                  @click="submitRequest"
                >
                  {{ requestModal.type === 'cancel' ? 'Submit Cancellation' : 'Submit Reschedule' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'
import { toast } from 'vue3-toastify'

const loading = ref(true)
const upcomingAppointments = ref([])
const pastAppointments = ref([])
const clinicsById = ref({})
const requestModal = ref({
  open: false,
  type: 'cancel',
  appointment: null,
  reason: '',
  requestedDate: '',
  requestedTime: '',
  requestedSlotKey: '',
  loadingAvailability: false,
  availabilityError: '',
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
})
const requestModalPractitioner = ref(null)
const requestModalSchedules = ref({})
const requestModalAppointments = ref([])
const requestModalReservations = ref([])
const requestModalLoadSeq = ref(0)

const SLOT_STEP_MINUTES = 30
const SLOT_DAYS_LOOKAHEAD = 365
const requestCalendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toDateTime = (date, time) => new Date(`${date}T${time || '00:00'}`)

const normalizeAppointmentStatus = (value) => String(value || '').trim().toLowerCase()

const parseClockToMinutes = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!ampm) return null

  let hour = Number(ampm[1])
  const minute = Number(ampm[2])
  const marker = ampm[3].toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  if (marker === 'PM' && hour !== 12) hour += 12
  if (marker === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

const minutesToTime12 = (value) => {
  if (!Number.isFinite(value)) return ''
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
  const rawHours = Math.floor(minutes / 60)
  const mins = String(minutes % 60).padStart(2, '0')
  const period = rawHours >= 12 ? 'PM' : 'AM'
  const hour12 = rawHours % 12 === 0 ? 12 : rawHours % 12
  return `${hour12}:${mins} ${period}`
}

const toDateInput = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const parseDateInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getWeekStartKey = (date) => {
  const currentDay = date.getDay()
  const diffToMonday = (currentDay + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMonday)
  return toDateInput(monday)
}

const extractShiftWindowMinutes = (shiftLabel) => {
  const label = String(shiftLabel || '').trim()
  if (!label) return null
  const base = label.includes('||') ? String(label.split('||').pop() || '').trim() : label
  const [startRaw, endRaw] = base.split('-').map((part) => String(part || '').trim())
  if (!startRaw || !endRaw) return null
  const start = parseClockToMinutes(startRaw)
  const end = parseClockToMinutes(endRaw)
  if (start === null || end === null) return null
  return { start, end }
}

const getAppointmentDurationMinutes = (appointment) => {
  const explicitDuration = Number(
    appointment?.totalServiceDurationMinutes ||
    appointment?.consultationForServiceDurationMinutes ||
    appointment?.consultationDurationMinutes ||
    appointment?.durationMinutes ||
    0
  )
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) return explicitDuration

  const serviceDurations = Array.isArray(appointment?.serviceDurations)
    ? appointment.serviceDurations.map((value) => Number(value || 0)).filter((value) => value > 0)
    : []
  if (serviceDurations.length) {
    return serviceDurations.reduce((sum, value) => sum + value, 0)
  }

  return 60
}

const buildBlockedRanges = (appointmentList = [], options = {}) => {
  const blocked = new Map()
  const blockingStatuses = new Set(['scheduled', 'approved', 'paid', 'completed', 'in progress', 'ongoing', 'held'])
  const skipAppointmentId = String(options.skipAppointmentId || '').trim()

  appointmentList.forEach((appointment) => {
    const appointmentId = String(appointment?.id || '').trim()
    if (skipAppointmentId && appointmentId === skipAppointmentId) return

    const date = String(appointment?.date || '').trim()
    const practitionerId = String(
      appointment?.assignedPractitionerId || appointment?.practitionerId || ''
    ).trim()
    const status = normalizeAppointmentStatus(appointment?.status)
    if (!date || !practitionerId || !blockingStatuses.has(status)) return

    const start = parseClockToMinutes(appointment?.time)
    if (start === null) return
    const appointmentDuration = getAppointmentDurationMinutes(appointment)
    const end = parseClockToMinutes(appointment?.endTime)
    const normalizedEnd =
      end !== null && end > start
        ? end
        : start + appointmentDuration

    const key = `${date}|${practitionerId}`
    const nextList = blocked.get(key) || []
    nextList.push({ start, end: normalizedEnd })
    blocked.set(key, nextList)
  })

  return blocked
}

const overlapsBlockedRange = (candidateStart, candidateEnd, blockedRanges = []) =>
  blockedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start)

const requestBookingDurationMinutes = computed(() => Math.max(getAppointmentDurationMinutes(requestModal.value.appointment), 30))

const requestAssignedPractitionerId = computed(() =>
  String(requestModal.value.appointment?.assignedPractitionerId || requestModal.value.appointment?.practitionerId || '').trim()
)

const requestBranchId = computed(() =>
  String(requestModal.value.appointment?.branchId || '').trim()
)

const requestCalendarMonthLabel = computed(() =>
  requestModal.value.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const requestAvailableSlots = computed(() => {
  if (requestModal.value.type !== 'reschedule' || !requestModal.value.open) return []
  if (!requestAssignedPractitionerId.value || !requestBranchId.value) return []
  if (!requestModalSchedules.value || !Object.keys(requestModalSchedules.value).length) return []

  const slotDurationMinutes = Number(requestBookingDurationMinutes.value || 0)
  if (slotDurationMinutes <= 0) return []

  const blockedMap = buildBlockedRanges(
    [...requestModalAppointments.value, ...requestModalReservations.value],
    { skipAppointmentId: requestModal.value.appointment?.id }
  )
  const slots = []
  const today = new Date()
  const todayKey = toDateInput(today)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  for (let offset = 0; offset < SLOT_DAYS_LOOKAHEAD; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const dateKey = toDateInput(date)
    const weekKey = getWeekStartKey(date)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    const assignments = resolveWeekAssignments(requestModalSchedules.value, weekKey)
    const shiftLabel = String(assignments?.[dayName] || '').trim()
    if (!shiftLabel) continue

    const windowMinutes = extractShiftWindowMinutes(shiftLabel)
    if (!windowMinutes) continue

    let { start, end } = windowMinutes
    if (end < start) {
      end += 24 * 60
    }

    let slotStart = start
    if (dateKey === todayKey && slotStart <= nowMinutes) {
      slotStart = nowMinutes + SLOT_STEP_MINUTES
    }

    const blockedRanges = blockedMap.get(`${dateKey}|${requestAssignedPractitionerId.value}`) || []

    for (let minutes = slotStart; minutes + slotDurationMinutes <= end; minutes += SLOT_STEP_MINUTES) {
      const normalizedMinutes = minutes % (24 * 60)
      const time = minutesToTime12(normalizedMinutes)
      const key = `${dateKey}|${time}|${requestAssignedPractitionerId.value}`
      const endMinutes = normalizedMinutes + slotDurationMinutes
      if (overlapsBlockedRange(normalizedMinutes, endMinutes, blockedRanges)) {
        continue
      }
      slots.push({
        key,
        date: dateKey,
        time,
        practitionerName: requestModalPractitioner.value?.fullName || requestModal.value.appointment?.assignedPractitionerName || requestModal.value.appointment?.practitionerName || 'Assigned Practitioner',
      })
    }
  }

  return slots
})

const requestAvailableDates = computed(() => [...new Set(requestAvailableSlots.value.map((slot) => slot.date))])
const requestAvailableDateSet = computed(() => new Set(requestAvailableDates.value))

const requestSelectedDateLabel = computed(() => {
  const parsed = parseDateInput(requestModal.value.requestedDate)
  return parsed
    ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Choose a date from the calendar to view available time slots.'
})

const requestSlotsForSelectedDate = computed(() => {
  if (!requestModal.value.requestedDate) return []
  return requestAvailableSlots.value.filter((slot) => slot.date === requestModal.value.requestedDate)
})

const requestCalendarDays = computed(() => {
  const year = requestModal.value.calendarMonth.getFullYear()
  const month = requestModal.value.calendarMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateKey = toDateInput(date)
    return {
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isAvailable: requestAvailableDateSet.value.has(dateKey),
      isSelected: requestModal.value.requestedDate === dateKey,
    }
  })
})

const canGoToPreviousRequestMonth = computed(() => {
  const firstAllowed = new Date()
  firstAllowed.setDate(1)
  firstAllowed.setHours(0, 0, 0, 0)
  return (
    requestModal.value.calendarMonth.getFullYear() > firstAllowed.getFullYear()
    || (
      requestModal.value.calendarMonth.getFullYear() === firstAllowed.getFullYear()
      && requestModal.value.calendarMonth.getMonth() > firstAllowed.getMonth()
    )
  )
})

const canGoToNextRequestMonth = computed(() => {
  const lastAllowed = new Date()
  lastAllowed.setDate(lastAllowed.getDate() + Math.max(0, SLOT_DAYS_LOOKAHEAD - 1))
  lastAllowed.setHours(0, 0, 0, 0)
  return (
    requestModal.value.calendarMonth.getFullYear() < lastAllowed.getFullYear()
    || (
      requestModal.value.calendarMonth.getFullYear() === lastAllowed.getFullYear()
      && requestModal.value.calendarMonth.getMonth() < lastAllowed.getMonth()
    )
  )
})

const changeRequestCalendarMonth = (offset) => {
  const next = new Date(requestModal.value.calendarMonth)
  next.setMonth(next.getMonth() + offset)
  requestModal.value.calendarMonth = new Date(next.getFullYear(), next.getMonth(), 1)
}

const selectRequestDate = (dateKey) => {
  if (!requestAvailableDateSet.value.has(dateKey)) return
  requestModal.value.requestedDate = dateKey
  const selectedDate = parseDateInput(dateKey)
  if (selectedDate) {
    requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  }
  const firstSlot = requestAvailableSlots.value.find((slot) => slot.date === dateKey)
  if (firstSlot) {
    requestModal.value.requestedTime = firstSlot.time
    requestModal.value.requestedSlotKey = firstSlot.key
    return
  }
  requestModal.value.requestedTime = ''
  requestModal.value.requestedSlotKey = ''
}

const selectRequestSlot = (slot) => {
  if (!slot?.key) return
  requestModal.value.requestedDate = slot.date
  requestModal.value.requestedTime = slot.time
  requestModal.value.requestedSlotKey = slot.key
  const selectedDate = parseDateInput(slot.date)
  if (selectedDate) {
    requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  }
}

const resetRequestModalState = () => {
  requestModalLoadSeq.value += 1
  requestModal.value = {
    open: false,
    type: 'cancel',
    appointment: null,
    reason: '',
    requestedDate: '',
    requestedTime: '',
    requestedSlotKey: '',
    loadingAvailability: false,
    availabilityError: '',
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  }
  requestModalPractitioner.value = null
  requestModalSchedules.value = {}
  requestModalAppointments.value = []
  requestModalReservations.value = []
}

const loadRescheduleAvailability = async (appointment, { autoSelect = true } = {}) => {
  const loadSeq = ++requestModalLoadSeq.value
  const branchId = String(appointment?.branchId || '').trim()
  const practitionerId = String(appointment?.assignedPractitionerId || appointment?.practitionerId || '').trim()

  requestModal.value.loadingAvailability = true
  requestModal.value.availabilityError = ''
  requestModalPractitioner.value = null
  requestModalSchedules.value = {}
  requestModalAppointments.value = []
  requestModalReservations.value = []

  try {
    if (!branchId || !practitionerId) {
      requestModal.value.availabilityError = 'This appointment does not include practitioner scheduling details.'
      return
    }

    const [scheduleSnap, appointmentsSnap, reservationsSnap, practitionerSnap] = await Promise.all([
      getDocs(collection(db, 'users', practitionerId, 'schedules')),
      getDocs(query(collection(db, 'appointments'), where('branchId', '==', branchId))),
      getDocs(query(collection(db, 'bookingReservations'), where('branchId', '==', branchId))),
      getDoc(doc(db, 'users', practitionerId)),
    ])

    if (loadSeq !== requestModalLoadSeq.value || !requestModal.value.open) return

    requestModalSchedules.value = buildWeekScheduleMap(
      scheduleSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} }))
    )
    requestModalAppointments.value = appointmentsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    requestModalReservations.value = reservationsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    const practitionerData = practitionerSnap.exists() ? practitionerSnap.data() || {} : {}
    requestModalPractitioner.value = {
      id: practitionerId,
      fullName:
        String(practitionerData.fullName || '').trim() ||
        `${String(practitionerData.firstName || '').trim()} ${String(practitionerData.lastName || '').trim()}`.trim() ||
        appointment?.assignedPractitionerName ||
        appointment?.practitionerName ||
        'Assigned Practitioner',
    }

    const parsedDate = parseDateInput(appointment?.date) || new Date()
    requestModal.value.calendarMonth = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)

    if (autoSelect) {
      const currentRequestedDate = String(requestModal.value.requestedDate || '').trim()
      const currentRequestedTime = String(requestModal.value.requestedTime || '').trim()
      const existingSelection = currentRequestedDate && currentRequestedTime
        ? requestAvailableSlots.value.find((slot) => slot.date === currentRequestedDate && slot.time === currentRequestedTime)
        : null
      const firstSlot = existingSelection || requestAvailableSlots.value[0] || null
      if (firstSlot) {
        requestModal.value.requestedDate = firstSlot.date
        requestModal.value.requestedTime = firstSlot.time
        requestModal.value.requestedSlotKey = firstSlot.key
        const selectedDate = parseDateInput(firstSlot.date)
        if (selectedDate) {
          requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        }
      }
    } else {
      const currentRequestedDate = String(requestModal.value.requestedDate || '').trim()
      const currentRequestedTime = String(requestModal.value.requestedTime || '').trim()
      const selection = currentRequestedDate && currentRequestedTime
        ? requestAvailableSlots.value.find((slot) => slot.date === currentRequestedDate && slot.time === currentRequestedTime)
        : null
      requestModal.value.requestedSlotKey = selection?.key || ''
      if (!selection && currentRequestedDate) {
        requestModal.value.requestedDate = ''
        requestModal.value.requestedTime = ''
      } else if (selection) {
        const selectedDate = parseDateInput(selection.date)
        if (selectedDate) {
          requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        }
      }
    }
  } catch (error) {
    console.error(error)
    requestModal.value.availabilityError = 'Unable to load available schedules for rescheduling.'
  } finally {
    requestModal.value.loadingAvailability = false
  }
}

const formatAppointmentServices = (appointment) => {
  if (Array.isArray(appointment?.services) && appointment.services.length) {
    return appointment.services.join(', ')
  }
  return appointment?.service || 'Service not set'
}

const getClinicPolicy = (appointment, kind) => {
  const clinic = clinicsById.value[appointment?.branchId] || {}
  if (kind === 'cancel') {
    return (
      clinic.cancellationPolicy ||
      clinic.refundPolicy ||
      'Cancellation requests are reviewed by the clinic first. Approved cancellations are refunded without the system commission.'
    )
  }

  return (
    clinic.reschedulePolicy ||
    'Reschedule requests are reviewed by the clinic first. The new schedule will only take effect after approval.'
  )
}

const statusToneClass = (status) => {
  const normalized = normalizeAppointmentStatus(status)
  if (normalized.includes('cancel')) return 'status-badge-danger'
  if (normalized.includes('complete')) return 'status-badge-muted'
  if (normalized.includes('request')) return 'status-badge-warning'
  return 'status-badge-primary'
}

const requestPolicyText = computed(() => {
  if (!requestModal.value.appointment) return ''
  return getClinicPolicy(requestModal.value.appointment, requestModal.value.type)
})

const isRequestPending = (appt, kind) => {
  const status = String(appt?.status || '').trim().toLowerCase()
  if (status.includes('requested')) return true
  if (kind === 'cancel') {
    return status === 'cancelled' || status === 'completed'
  }
  return status === 'cancelled' || status === 'completed'
}

const openRequestModal = async (type, appt) => {
  requestModal.value = {
    open: true,
    type,
    appointment: appt,
    reason: '',
    requestedDate: '',
    requestedTime: '',
    requestedSlotKey: '',
    loadingAvailability: type === 'reschedule',
    availabilityError: '',
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  }

  if (type === 'reschedule') {
    await loadRescheduleAvailability(appt, { autoSelect: true })
  }
}

const closeRequestModal = () => {
  resetRequestModalState()
}

const loadAppointments = async () => {
  const user = auth.currentUser
  if (!user) {
    upcomingAppointments.value = []
    pastAppointments.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    const [appointmentsSnap, clinicsSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), where('customerId', '==', user.uid))),
      getDocs(collection(db, 'clinics')),
    ])

    const clinicMap = new Map()
    clinicsSnap.docs.forEach((snap) => {
      const data = snap.data()
      clinicMap.set(snap.id, {
        name: data.clinicName || data.clinicBranch || 'Clinic',
        cancellationPolicy: String(data.cancellationPolicy || '').trim(),
        reschedulePolicy: String(data.reschedulePolicy || '').trim(),
        refundPolicy: String(data.refundPolicy || '').trim(),
      })
    })
    clinicsById.value = Object.fromEntries(clinicMap.entries())

    const now = new Date()
    const all = appointmentsSnap.docs.map((snap) => {
      const data = snap.data()
      return {
        id: snap.id,
        ...data,
        clinic: clinicMap.get(data.branchId)?.name || 'Clinic',
      }
    })

    upcomingAppointments.value = all
      .filter((appt) => appt.status !== 'Cancelled' && toDateTime(appt.date, appt.time) >= now)
      .sort((a, b) => toDateTime(a.date, a.time) - toDateTime(b.date, b.time))

    pastAppointments.value = all
      .filter((appt) => appt.status === 'Cancelled' || toDateTime(appt.date, appt.time) < now)
      .sort((a, b) => toDateTime(b.date, b.time) - toDateTime(a.date, a.time))
  } catch (error) {
    console.error(error)
    toast.error('Failed to load appointments.')
  } finally {
    loading.value = false
  }
}

const submitRequest = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in first.')
    return
  }

  const appt = requestModal.value.appointment
  if (!appt?.id) {
    toast.error('Please choose an appointment first.')
    return
  }

  const reason = String(requestModal.value.reason || '').trim()
  if (!reason) {
    toast.error('Please provide a reason.')
    return
  }

  if (requestModal.value.type === 'cancel') {
    try {
      const totalAmount = Number(appt.totalAmount || appt.amountPaid || appt.amount || 0)
      const commissionAmount = Number(appt.commissionAmount || 0)
      const refundableAmount = Math.max(0, totalAmount - commissionAmount)
      await updateDoc(doc(db, 'appointments', appt.id), {
        status: 'Cancellation Requested',
        cancellationReason: reason,
        cancellationRequestedAt: new Date().toISOString(),
        cancellationPolicySnapshot: getClinicPolicy(appt, 'cancel'),
        refundRequestedAmount: refundableAmount,
        refundCommissionAmount: commissionAmount,
        refundStatus: 'Pending Approval',
      })
      toast.success('Cancellation request submitted for review.')
      closeRequestModal()
      await loadAppointments()
    } catch (error) {
      console.error(error)
      toast.error('Failed to submit cancellation request.')
    }
    return
  }

  if (!requestModal.value.requestedDate || !requestModal.value.requestedTime) {
    toast.error('Please choose a new date and time.')
    return
  }

  try {
    await loadRescheduleAvailability(appt, { autoSelect: false })
    const selectedSlot = requestAvailableSlots.value.find(
      (slot) =>
        slot.date === requestModal.value.requestedDate &&
        slot.time === requestModal.value.requestedTime &&
        slot.key === requestModal.value.requestedSlotKey
    )

    if (!selectedSlot) {
      toast.error('That time slot is no longer available. Please choose another one.')
      return
    }

    await updateDoc(doc(db, 'appointments', appt.id), {
      status: 'Reschedule Requested',
      requestedDate: requestModal.value.requestedDate,
      requestedTime: requestModal.value.requestedTime,
      requestedPractitionerId: requestAssignedPractitionerId.value,
      requestedSlotKey: requestModal.value.requestedSlotKey,
      rescheduleReason: reason,
      rescheduleRequestedAt: new Date().toISOString(),
      reschedulePolicySnapshot: getClinicPolicy(appt, 'reschedule'),
    })
    toast.success('Reschedule request submitted for review.')
    closeRequestModal()
    await loadAppointments()
  } catch (error) {
    console.error(error)
    toast.error('Failed to submit reschedule request.')
  }
}

const cancel = async (appt) => {
  try {
    openRequestModal('cancel', appt)
  } catch (error) {
    console.error(error)
    toast.error('Failed to open cancellation modal.')
  }
}

const reschedule = async (appt) => {
  try {
    openRequestModal('reschedule', appt)
  } catch (error) {
    console.error(error)
    toast.error('Failed to open reschedule modal.')
  }
}

onMounted(loadAppointments)
</script>

<style scoped>
.appointments-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.appointments-main {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.appointments-content {
  display: grid;
  gap: 1.35rem;
  padding: 1.5rem 1.4rem 2rem;
}

.appointments-header,
.appointments-panel,
.state-panel,
.request-modal-shell,
.request-policy-card,
.request-card {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.appointments-header,
.appointments-panel {
  padding: 1.25rem;
}

.appointments-header {
  display: flex;
  align-items: center;
}

.appointments-kicker,
.panel-kicker,
.appointment-card-kicker,
.request-modal-kicker,
.request-card-kicker,
.request-field-label,
.meta-label,
.summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.appointments-kicker,
.panel-kicker,
.request-modal-kicker,
.request-card-kicker,
.request-field-label,
.summary-label,
.meta-label {
  color: #8c6d55;
}

.appointments-title,
.panel-title,
.appointment-service,
.request-modal-title {
  font-family: "Playfair Display", "Times New Roman", serif;
}

.appointments-title {
  margin: 0;
  color: #3d281d;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.appointments-subtitle,
.panel-note,
.appointment-clinic,
.request-modal-summary,
.request-action-note,
.state-copy,
.request-selected-date {
  color: rgba(76, 54, 40, 0.76);
}

.panel-head,
.appointment-card-head,
.appointment-actions,
.request-modal-head,
.request-card-head,
.request-modal-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.panel-title,
.request-card-title {
  margin: 0.55rem 0 0;
  color: #3d281d;
  font-size: clamp(1.6rem, 2.4vw, 2.15rem);
  line-height: 1;
}

.panel-note {
  margin: 0;
  align-self: center;
  font-size: 0.88rem;
}

.appointments-table-wrap {
  margin-top: 1.25rem;
  overflow-x: auto;
  border-radius: 1.35rem;
  border: 1px solid rgba(230, 193, 150, 0.72);
  background: rgba(255, 251, 244, 0.94);
}

.appointments-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 780px;
}

.appointments-table thead tr {
  background: linear-gradient(180deg, #d8b891 0%, #c8a57d 100%);
}

.appointments-table th {
  padding: 1rem 1.05rem;
  text-align: left;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4d301f;
}

.appointments-table td {
  padding: 1rem 1.05rem;
  border-top: 1px solid rgba(230, 193, 150, 0.5);
  color: #6a4b39;
  font-size: 0.95rem;
  vertical-align: middle;
}

.appointments-table tbody tr:nth-child(even) {
  background: rgba(252, 245, 233, 0.76);
}

.appointments-table tbody tr:hover {
  background: rgba(245, 230, 209, 0.72);
}

.appointment-service-cell {
  min-width: 16rem;
}

.table-primary {
  color: #2f1d14;
  font-weight: 600;
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.table-empty-cell {
  padding: 1.4rem 1rem;
  text-align: center;
  color: rgba(76, 54, 40, 0.76);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-badge-primary {
  background: rgba(181, 127, 92, 0.16);
  color: #7c4f34;
  border: 1px solid rgba(181, 127, 92, 0.28);
}

.status-badge-warning {
  background: rgba(213, 160, 94, 0.18);
  color: #8a5e1d;
  border: 1px solid rgba(213, 160, 94, 0.28);
}

.status-badge-danger {
  background: rgba(194, 96, 96, 0.14);
  color: #9a4444;
  border: 1px solid rgba(194, 96, 96, 0.22);
}

.status-badge-muted {
  background: rgba(157, 139, 121, 0.16);
  color: #6f6258;
  border: 1px solid rgba(157, 139, 121, 0.22);
}

.appointment-button,
.request-button,
.request-nav-button,
.request-close-button {
  transition: transform 0.18s ease, filter 0.18s ease, background-color 0.18s ease;
}

.appointment-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.85rem;
  padding: 0.8rem 1.15rem;
  border-radius: 1rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.appointment-button:disabled,
.request-nav-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  transform: none;
}

.appointment-button-secondary {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

.appointment-button-danger {
  border: 1px solid rgba(175, 98, 98, 0.28);
  background: linear-gradient(120deg, #ca7c7c 0%, #b85e5e 48%, #974444 100%);
  color: #fff8f2;
}

.appointment-button:hover:not(:disabled),
.request-button:hover,
.request-nav-button:hover:not(:disabled),
.request-close-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.state-panel {
  margin-top: 1.25rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.state-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #342419;
}

.state-copy {
  margin: 0.85rem auto 0;
  max-width: 32rem;
  line-height: 1.7;
}

.request-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(35, 20, 12, 0.56);
  backdrop-filter: blur(6px);
}

.request-modal-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 70rem;
  max-height: 90vh;
  overflow: hidden;
}

.request-modal-head {
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid rgba(230, 193, 150, 0.8);
}

.request-modal-title {
  margin: 0.45rem 0 0;
  color: #3d281d;
  font-size: clamp(1.75rem, 2.5vw, 2.2rem);
  line-height: 1.02;
}

.request-modal-summary {
  margin: 0.65rem 0 0;
  font-size: 0.95rem;
}

.request-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
}

.request-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.4rem 1.5rem;
  display: grid;
  gap: 1rem;
}

.request-policy-card,
.request-card {
  padding: 1rem;
}

.request-policy-card {
  background: linear-gradient(180deg, rgba(255, 248, 235, 0.98), rgba(249, 236, 215, 0.94));
  color: #674532;
}

.request-policy-title {
  font-weight: 700;
  color: #523324;
}

.request-textarea {
  width: 100%;
  padding: 0.95rem 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.9);
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.request-textarea:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.request-reschedule-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
}

.request-card-head {
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(230, 193, 150, 0.7);
}

.request-card-head-stack {
  align-items: center;
}

.request-nav-button {
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
  padding: 0.65rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.request-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8c6d55;
}

.request-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.request-day-button {
  min-height: 4.6rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fffaf2;
  color: #513626;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.request-day-other {
  background: #f6efe6;
  color: #a08a7a;
}

.request-day-available:hover {
  transform: translateY(-1px);
  border-color: rgba(181, 127, 92, 0.6);
  background: #fff4e6;
}

.request-day-disabled {
  opacity: 0.45;
}

.request-day-selected {
  border-color: rgba(181, 127, 92, 0.85);
  background: rgba(181, 127, 92, 0.16);
  color: #6f4330;
}

.request-day-dot {
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: #d7a764;
}

.request-day-disabled .request-day-dot {
  background: #b6a79a;
}

.request-day-selected .request-day-dot {
  background: #8d5a3b;
}

.request-selected-date {
  margin: 0.9rem 0 0;
  font-size: 0.92rem;
}

.request-duration-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #7c5b44;
  padding: 0.4rem 0.8rem;
  font-size: 0.76rem;
  font-weight: 700;
}

.request-info-card {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fffaf2;
  color: #6a4b39;
  font-size: 0.92rem;
}

.request-info-card-warn {
  border-color: rgba(213, 160, 94, 0.35);
  background: rgba(255, 243, 219, 0.92);
  color: #8a5e1d;
}

.request-info-card-muted {
  border-style: dashed;
  color: #8a7768;
}

.request-slot-list {
  display: grid;
  gap: 0.65rem;
  max-height: 20rem;
  overflow-y: auto;
  margin-top: 1rem;
  padding-right: 0.25rem;
}

.request-slot-button {
  text-align: left;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fffaf2;
  color: #513626;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.request-slot-button:hover {
  transform: translateY(-1px);
  border-color: rgba(181, 127, 92, 0.6);
  background: #fff4e6;
}

.request-slot-button-selected {
  border-color: rgba(181, 127, 92, 0.9);
  background: rgba(181, 127, 92, 0.16);
}

.request-detail-list {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(230, 193, 150, 0.7);
  display: grid;
  gap: 0.5rem;
  color: #6b5040;
  font-size: 0.92rem;
}

.request-detail-strong {
  font-weight: 700;
  color: #452b1e;
}

.request-modal-actions {
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(230, 193, 150, 0.7);
}

.request-action-note {
  margin: 0;
  max-width: 30rem;
  font-size: 0.82rem;
}

.request-action-buttons {
  display: flex;
  gap: 0.75rem;
}

.request-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.85rem;
  padding: 0.8rem 1.15rem;
  border-radius: 1rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.request-button-secondary {
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
}

.request-button-primary {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

@media (min-width: 1280px) {
  .appointments-content {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 1023px) {
  .request-reschedule-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .appointments-content {
    padding: 1rem 1rem 1.5rem;
  }

  .appointments-header,
  .panel-head,
  .request-modal-head,
  .request-card-head,
  .request-modal-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .request-action-buttons {
    width: 100%;
  }

  .appointment-button,
  .request-button {
    width: 100%;
  }

  .request-modal-overlay {
    align-items: flex-start;
  }
}
</style>
