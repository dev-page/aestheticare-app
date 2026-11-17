<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import { usePageLoading } from '@/composables/usePageLoading'
import { usePermissions } from '@/composables/usePermissions'
import { useRoute } from 'vue-router'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatClockTime, parseClockToMinutes } from '@/utils/appointmentDss'
import { getAppointmentSlots } from '@/utils/appointmentSlots'
import { isBookingPaymentHoldReleased } from '../../../../../../shared/bookingPaymentHold.js'
import { buildWeekScheduleMap } from '@/utils/employeeSchedules'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { appointmentClientName, appointmentSource, appointmentServiceType, appointmentServiceName, appointmentSessions, appointmentRecipients, appointmentBookingRows, appointmentCheckInAllowed } from '@/utils/appointmentManagement'
import { APPOINTMENT_STATUS_FILTERS, appointmentStatusGroup } from '@/utils/appointmentStatusFilter'
import OnlineConsultationControls from '@/components/common/OnlineConsultationControls.vue'
import Modal from '@/components/common/Modal.vue'
import AppointmentTeam from '@/components/common/AppointmentTeam.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ServiceKeyVerificationModal from '@/components/ServiceKeyVerificationModal.vue'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const { hasPermission } = usePermissions()
const route = useRoute()
const appointments = ref([]), staff = ref([]), clients = ref([])
const search = ref(''), status = ref(''), date = ref(''), dateMode = ref('all'), source = ref(''), error = ref(''), needsReview = ref(false)
const page = ref(1), pageSize = ref(10), selectedId = ref('')
const contractTarget = ref(null), checkInTarget = ref(null), verifying = ref(false), menu = ref(null)
const rescheduleTarget = ref(null), rescheduleDate = ref(''), reschedulePractitionerId = ref(''), rescheduleTime = ref(''), rescheduleReason = ref('')
const rescheduleAvailability = ref(null), loadingRescheduleAvailability = ref(false), savingReschedule = ref(false), rescheduleError = ref('')
const canCheckIn = computed(() => hasPermission('appointments:update'))
const selected = computed(() => appointments.value.find(item => item.id === selectedId.value) || null)
const recipientRows = computed(() => appointmentRecipients(selected.value, appointments.value))
const clientFor = item => clients.value.find(client => (item.clientId && client.id === item.clientId) || (item.customerId && client.customerId === item.customerId) || (item.customerEmail && client.email === item.customerEmail)) || {}
const emailFor = item => item.customerEmail || item.clientEmail || item.email || clientFor(item).email || 'Not provided'
const phoneFor = item => item.customerPhone || item.contactNumber || item.phoneNumber || item.phone || clientFor(item).phone || clientFor(item).contactNumber || 'Not provided'
const nameFor = item => appointmentClientName({ ...item, clientName: item.clientName || item.customerName || clientFor(item).fullName })
const practitionerFor = item => item.practitionerName || item.assignedPractitionerName || staff.value.find(person => [item.practitionerId, item.assignedPractitionerId, item.staffId].includes(person.id))?.fullName || 'Not assigned'
const scheduleFor = item => item.date ? `${item.date}   ${formatClockTime(item.time) || 'Time not set'}${item.endTime ? ` – ${formatClockTime(item.endTime)}` : ''}` : 'Not scheduled'
const serviceTypeFor = item => [...new Set((appointmentRecipients(item, appointments.value).length ? appointmentRecipients(item, appointments.value) : [item]).map(appointmentServiceType))].join(', ')
const serviceNameFor = item => [...new Set((appointmentRecipients(item, appointments.value).length ? appointmentRecipients(item, appointments.value) : [item]).map(appointmentServiceName))].join(', ')
const bookingKind = item => item.isGroupParent || item.isGroupRecipient || item.groupBookingId ? 'Group booking' : item.isBookingOrderParent || item.bookingOrderId ? 'Multiple service booking' : 'Individual booking'
const organizer = computed(() => {
  const item = selected.value
  if (!item) return null
  if (item.source === 'walk_in' && item.bookedByName) return { customerName: item.bookedByName, customerEmail: item.bookedByEmail, customerPhone: item.bookedByPhone }
  if (item.isGroupRecipient) return appointments.value.find(parent => parent.id === item.parentAppointmentId) || { customerName: item.groupOrganizerName, customerEmail: item.groupOrganizerEmail, customerPhone: item.groupOrganizerPhone }
  return item
})
const rows = computed(() => sortRecordsNewestFirst(appointmentBookingRows(appointments.value)))
const todayDate = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
const canRescheduleAppointment = item => {
  if (!item || !canCheckIn.value || item.isGroupParent || item.isBookingOrderParent || item.startedAt || item.checkedInAt) return false
  if (!['scheduled', 'paid', 'awaiting payment', 'contract pending', 'unpaid', 'balance due'].includes(String(item.status || '').trim().toLowerCase())) return false
  const appointmentMinutes = parseClockToMinutes(item.time)
  const appointmentStart = appointmentMinutes === null ? 0 : new Date(`${item.date || ''}T00:00:00+08:00`).getTime() + appointmentMinutes * 60000
  return Number.isFinite(appointmentStart) && appointmentStart > Date.now()
}
const reschedulePractitioners = computed(() => {
  const practitioners = Array.isArray(rescheduleAvailability.value?.practitioners) ? rescheduleAvailability.value.practitioners : []
  const leaveByPractitioner = rescheduleAvailability.value?.leaves || {}
  return practitioners.filter(person => !(leaveByPractitioner[person.id] || []).some(leave =>
    String(leave.startDate || '') <= rescheduleDate.value && String(leave.endDate || '') >= rescheduleDate.value
  ))
})
const rescheduleDateHasCustomerConflict = computed(() => {
  const target = rescheduleTarget.value
  const targetDate = rescheduleDate.value
  if (!target || !targetDate) return false
  const targetCustomerId = String(target.customerId || clientFor(target).customerId || '').trim()
  const targetEmail = String(emailFor(target) || '').trim().toLowerCase()
  return appointments.value.some(appointment => {
    if (appointment.id === target.id || appointment.date !== targetDate || appointment.isGroupParent || appointment.isBookingOrderParent || isBookingPaymentHoldReleased(appointment)) return false
    if (['cancelled', 'rejected', 'expired'].includes(String(appointment.status || '').trim().toLowerCase())) return false
    const sameCustomer = targetCustomerId && String(appointment.customerId || '').trim() === targetCustomerId
    const sameEmail = targetEmail && String(appointment.customerEmail || appointment.clientEmail || appointment.email || '').trim().toLowerCase() === targetEmail
    return Boolean(sameCustomer || sameEmail)
  })
})
const rescheduleSlots = computed(() => {
  const target = rescheduleTarget.value
  const availability = rescheduleAvailability.value
  if (!target || !availability || !rescheduleDate.value || !reschedulePractitionerId.value || rescheduleDateHasCustomerConflict.value) return []
  const slots = getAppointmentSlots({
    date: rescheduleDate.value,
    practitionerId: reschedulePractitionerId.value,
    schedules: Object.fromEntries(Object.entries(availability.schedules || {}).map(([id, entries]) => [id, buildWeekScheduleMap(entries)])),
    appointments: appointments.value.filter(appointment => appointment.id !== target.id),
    durationMinutes: Number(target.totalServiceDurationMinutes || target.consultationDurationMinutes || target.durationMinutes || 60),
    operatingHours: availability.operatingHours,
    legacyOperatingHours: availability.legacyOperatingHours || {},
  })
  return slots.filter(slot => !(rescheduleDate.value === target.date
    && reschedulePractitionerId.value === (target.practitionerId || target.assignedPractitionerId)
    && parseClockToMinutes(slot.value) === parseClockToMinutes(target.time)))
})
const filtered = computed(() => rows.value.filter(item => {
  if (route.query.branchId && item.branchId !== String(route.query.branchId)) return false
  const children = appointmentRecipients(item, appointments.value)
  if (needsReview.value && !children.some(child => child.consultationNeedsReview || child.consultationDispute?.status === 'Open')) return false
  const haystack = [nameFor(item), appointmentServiceName(item), ...children.flatMap(child => [nameFor(child), appointmentServiceName(child), emailFor(child)])].join(' ').toLowerCase()
  const selectedDate = dateMode.value === 'today' ? todayDate() : dateMode.value === 'custom' ? date.value : ''
  return (!search.value.trim() || haystack.includes(search.value.trim().toLowerCase()))
    && (!status.value || appointmentStatusGroup(item.status || 'Scheduled') === status.value)
    && (!selectedDate || item.date === selectedDate || children.some(child => child.date === selectedDate))
    && (!source.value || appointmentSource(item) === source.value)
}))
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([search, status, date, dateMode, source, pageSize, needsReview], () => { page.value = 1 })
watch(() => filtered.value.length, total => { page.value = Math.min(page.value, Math.max(1, Math.ceil(total / pageSize.value))) })
watch(selectedId, () => { menu.value = null })

let stopAuth, stops = [], generation = 0
const stopBranches = () => { stops.forEach(stop => stop()); stops = [] }
onMounted(trackPageLoad(() => {
  stopAuth = pageListener(onAuthStateChanged, auth, async user => {
    const run = ++generation
    stopBranches()
    appointments.value = []; staff.value = []; clients.value = []; selectedId.value = ''; error.value = ''
    if (!user) return
    try {
      const scope = await loadOwnerBranchScope(db, user.uid)
      if (run !== generation) return
      const ids = [...new Set(scope.branchIds.filter(Boolean))]
      if (!ids.length) throw new Error('No clinic branch is linked to your account.')
      const byBranch = new Map()
      ids.forEach(branchId => {
        stops.push(pageListener(onSnapshot, query(collection(db, 'appointments'), where('branchId', '==', branchId)), snapshot => {
          if (run !== generation) return
          byBranch.set(branchId, snapshot.docs.map(item => ({ ...item.data(), id: item.id })))
          appointments.value = [...byBranch.values()].flat()
        }, cause => { console.error('Appointment updates failed:', cause); error.value = 'Unable to load appointments. Check clinic branch access and Firestore permissions.' }))
      })
      const read = async name => (await Promise.all(ids.map(branchId => getDocs(query(collection(db, name), where('branchId', '==', branchId)))))).flatMap(snapshot => snapshot.docs.map(item => ({ ...item.data(), id: item.id })))
      const results = await Promise.allSettled([read('users'), hasPermission('clients:view') ? read('clients') : Promise.resolve([])])
      if (run !== generation) return
      staff.value = results[0].status === 'fulfilled' ? results[0].value.map(person => ({ ...person, fullName: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email })) : []
      clients.value = results[1].status === 'fulfilled' ? results[1].value : []
    } catch (cause) { error.value = cause.message || 'Unable to load appointments.' }
  })
}))
const openMenu = (item, event) => {
  if (menu.value?.item.id === item.id) { menu.value = null; return }
  const rect = event.currentTarget.getBoundingClientRect()
  menu.value = { item, left: Math.max(12, Math.min(rect.right - 180, window.innerWidth - 192)), top: Math.max(12, Math.min(rect.bottom + 4, window.innerHeight - 116)) }
}
watch(rescheduleDate, () => {
  rescheduleTime.value = ''
  if (!reschedulePractitioners.value.some(person => person.id === reschedulePractitionerId.value)) {
    reschedulePractitionerId.value = reschedulePractitioners.value[0]?.id || ''
  }
})
watch(reschedulePractitionerId, () => { rescheduleTime.value = '' })
const dismissMenu = event => { if (!event.target.closest('[data-appointment-menu]')) menu.value = null }
const escape = event => {
  if (event.key !== 'Escape') return
  if (menu.value) menu.value = null
  else if (rescheduleTarget.value) closeReschedule()
  else if (!contractTarget.value && !checkInTarget.value) selectedId.value = ''
}
onMounted(() => { document.addEventListener('pointerdown', dismissMenu); document.addEventListener('keydown', escape) })
onBeforeUnmount(() => { ++generation; stopAuth?.(); stopBranches(); document.removeEventListener('pointerdown', dismissMenu); document.removeEventListener('keydown', escape) })
const openContract = item => { menu.value = null; contractTarget.value = item }
const openCheckIn = item => { menu.value = null; checkInTarget.value = item }
const submitCode = async serviceKey => {
  if (!checkInTarget.value || verifying.value || !canCheckIn.value) return
  verifying.value = true
  try {
    const token = await auth.currentUser.getIdToken()
    let response
    for (const base of OTP_BACKEND_CANDIDATES) {
      try {
        response = await fetch(`${base}/appointments/${checkInTarget.value.id}/verify-service-key`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceKey }) })
        if (response.status !== 404) break
      } catch (cause) { if (base === OTP_BACKEND_CANDIDATES.at(-1)) throw cause }
    }
    const payload = await response?.json()
    if (!response?.ok || !payload?.success) throw new Error(payload?.error || 'Unable to verify the service code.')
    toast.success('Client checked in. The assigned practitioner can now start the service.')
    checkInTarget.value = null
  } catch (cause) { toast.error(cause.message) } finally { verifying.value = false }
}

const fetchClinicAvailability = async branchId => {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in again before rescheduling an appointment.')
  const token = await user.getIdToken()
  let lastError = null
  for (const candidate of OTP_BACKEND_CANDIDATES) {
    const base = String(candidate || '').replace(/\/+$/, '')
    if (!base) continue
    try {
      const response = await fetch(`${base}/public/clinics/${encodeURIComponent(branchId)}/practitioners`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 404 && candidate !== OTP_BACKEND_CANDIDATES.at(-1)) continue
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to load practitioner availability.')
      return payload
    } catch (cause) {
      lastError = cause
      if (candidate === OTP_BACKEND_CANDIDATES.at(-1)) throw cause
    }
  }
  throw lastError || new Error('The appointment availability service is unavailable.')
}

const openReschedule = async item => {
  if (!canRescheduleAppointment(item)) return
  menu.value = null
  rescheduleTarget.value = item
  rescheduleDate.value = item.date || todayDate()
  reschedulePractitionerId.value = ''
  rescheduleTime.value = ''
  rescheduleReason.value = ''
  rescheduleError.value = ''
  rescheduleAvailability.value = null
  loadingRescheduleAvailability.value = true
  try {
    rescheduleAvailability.value = await fetchClinicAvailability(String(item.branchId || '').trim())
    const existingPractitionerId = String(item.practitionerId || item.assignedPractitionerId || '').trim()
    const currentDatePractitioners = reschedulePractitioners.value
    reschedulePractitionerId.value = currentDatePractitioners.some(person => person.id === existingPractitionerId)
      ? existingPractitionerId
      : currentDatePractitioners[0]?.id || ''
  } catch (cause) {
    rescheduleError.value = cause.message || 'Unable to load practitioner availability.'
  } finally {
    loadingRescheduleAvailability.value = false
  }
}

const closeReschedule = () => {
  if (savingReschedule.value) return
  rescheduleTarget.value = null
  rescheduleError.value = ''
}

const submitClinicReschedule = async () => {
  const target = rescheduleTarget.value
  if (!target || !canRescheduleAppointment(target) || savingReschedule.value) return
  if (!reschedulePractitioners.value.some(person => person.id === reschedulePractitionerId.value)) {
    rescheduleError.value = 'Choose a practitioner who is available on that date.'
    return
  }
  if (!rescheduleSlots.value.some(slot => slot.value === rescheduleTime.value)) {
    rescheduleError.value = 'Choose one of the available appointment times.'
    return
  }
  const reason = rescheduleReason.value.trim()
  if (reason.length < 5 || reason.length > 1000) {
    rescheduleError.value = 'Enter a reason between 5 and 1000 characters.'
    return
  }

  savingReschedule.value = true
  rescheduleError.value = ''
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('Sign in again before rescheduling an appointment.')
    let response
    for (const candidate of OTP_BACKEND_CANDIDATES) {
      const base = String(candidate || '').replace(/\/+$/, '')
      if (!base) continue
      try {
        response = await fetch(`${base}/appointments/${encodeURIComponent(target.id)}/clinic-reschedule`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: rescheduleDate.value,
            time: rescheduleTime.value,
            practitionerId: reschedulePractitionerId.value,
            reason,
          }),
        })
        if (response.status !== 404) break
      } catch (cause) {
        if (candidate === OTP_BACKEND_CANDIDATES.at(-1)) throw cause
      }
    }
    const payload = await response?.json().catch(() => null)
    if (!response?.ok || !payload?.success) throw new Error(payload?.error || 'Unable to reschedule this appointment.')

    const updated = appointments.value.find(appointment => appointment.id === target.id)
    if (updated) {
      updated.date = payload.data.date
      updated.time = payload.data.time
      updated.practitionerId = reschedulePractitionerId.value
      updated.assignedPractitionerId = reschedulePractitionerId.value
      updated.practitionerName = reschedulePractitioners.value.find(person => person.id === reschedulePractitionerId.value)?.fullName || updated.practitionerName
      updated.assignedPractitionerName = updated.practitionerName
    }
    rescheduleTarget.value = null
    const notificationWarnings = Array.isArray(payload.data.warnings) ? payload.data.warnings : []
    toast.success(notificationWarnings.length ? 'Appointment rescheduled.' : 'Appointment rescheduled and customer notifications sent.')
    if (notificationWarnings.length) toast.warning(`Schedule changed, but: ${notificationWarnings.join(' ')}`)
  } catch (cause) {
    rescheduleError.value = cause.message || 'Unable to reschedule this appointment.'
  } finally {
    savingReschedule.value = false
  }
}
</script>

<template>
  <div v-page-loading="{ active: pageLoading, header: false, blocks: [{ variant: 'form', fields: 5, sections: 1 }, { variant: 'table', columns: 6, rows: 6 }] }" class="appointment-records">
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="route.query.branchId" class="subline">Showing this branch's appointments. <router-link :to="{ path: route.path, query: { ...route.query, branchId: undefined } }" class="outline-button">Show all branches</router-link></p>
    <section class="records-panel filters">
      <label class="filter-search">Search<input v-model="search" placeholder="Client, recipient, or service" type="search" /></label>
      <label class="filter-type">Appointment Type<select v-model="source"><option value="">All types</option><option>Walk-in</option><option>Online booking</option></select></label>
      <label class="review-filter"><input v-model="needsReview" type="checkbox" /><span>Consultation verification pending</span></label>
      <label class="filter-status">Status
        <select v-model="status"><option v-for="filter in APPOINTMENT_STATUS_FILTERS" :key="filter.value || 'all'" :value="filter.value">{{ filter.label }}</option></select>
        <small class="filter-help">Needs attention groups payment, approval, and customer follow-up states.</small>
      </label>
      <label class="filter-date">Date
        <select v-model="dateMode"><option value="all">All dates</option><option value="today">Today</option><option value="custom">Choose a date…</option></select>
        <input v-if="dateMode === 'custom'" v-model="date" aria-label="Choose appointment date" type="date" />
      </label>
    </section>
    <section class="records-panel table-panel">
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="filtered.length" part="top" item-label="appointments" />
      <div class="table-scroll"><table><thead><tr><th>Client Name</th><th>Service Type</th><th>Service Name</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead>
        <tbody><tr v-for="item in paged" :key="item.id"><td><strong>{{ nameFor(item) }}</strong><div class="subline">{{ appointmentSource(item) }} · {{ bookingKind(item) }}</div></td><td>{{ serviceTypeFor(item) }}</td><td>{{ serviceNameFor(item) }}</td><td>{{ scheduleFor(item) }}</td><td><span class="status-badge">{{ item.status || 'Scheduled' }}</span></td><td><button class="outline-button" @click="selectedId = item.id">View Details</button></td></tr>
          <tr v-if="!paged.length && !error"><td colspan="6" class="empty">{{ rows.length ? 'No appointments match these filters.' : 'No appointments yet.' }}</td></tr>
        </tbody></table></div>
      <TablePagination v-model:page="page" v-model:page-size="pageSize" :total-items="filtered.length" />
    </section>
    <Modal :is-open="Boolean(selected) && !contractTarget && !checkInTarget && !rescheduleTarget" title="Appointment Details" panel-class="appointment-details-panel" :panel-style="{ maxWidth: '86rem' }" @close="selectedId = ''">
      <template #body><div v-if="selected" class="details-body">
        <p v-if="selected.demoMode" role="status" class="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-[#6d4b30]">Demo record: no payment, customer notification, treatment, or schedule reservation was created.</p>
        <section class="booking-summary"><div><span class="summary-label">Booked by</span><strong>{{ organizer ? nameFor(organizer) : 'Not provided' }}</strong><p>{{ organizer ? emailFor(organizer) : 'Not provided' }}</p><p>{{ organizer ? phoneFor(organizer) : 'Not provided' }}</p></div><div><span class="summary-label">Booking</span><strong>{{ bookingKind(selected) }}</strong><p>{{ appointmentSource(selected) }} · {{ selected.status }}</p><p>{{ recipientRows.length }} service recipient{{ recipientRows.length === 1 ? '' : 's' }}</p></div></section>
        <h2 class="details-heading">Service Recipients</h2>
        <p class="subline">Each recipient has an individual contract and service code. The organizer appears here when included as a recipient.</p>
        <div class="recipient-cards">
          <article v-for="recipient in recipientRows" :key="recipient.id" class="recipient-card">
            <header class="recipient-card-header">
              <div class="recipient-person">
                <h3>{{ nameFor(recipient) }}</h3>
                <p>{{ emailFor(recipient) }}</p>
              </div>
              <span class="status-badge">{{ recipient.status || 'Scheduled' }}</span>
            </header>
            <dl class="recipient-details-grid">
              <div><dt>Contact number</dt><dd>{{ phoneFor(recipient) }}</dd></div>
              <div><dt>Service type</dt><dd>{{ appointmentServiceType(recipient) }}</dd></div>
              <div><dt>Service</dt><dd>{{ appointmentServiceName(recipient) }}</dd></div>
              <div><dt>Practitioner</dt><dd>{{ practitionerFor(recipient) }}</dd></div>
              <div><dt>Schedule</dt><dd>{{ scheduleFor(recipient) }}</dd></div>
              <div><dt>Sessions</dt><dd>{{ appointmentSessions(recipient) }}</dd></div>
            </dl>
            <div class="recipient-card-footer">
              <AppointmentTeam :appointment="recipient" />
              <button v-if="canRescheduleAppointment(recipient)" type="button" class="outline-button" @click="openReschedule(recipient)">Reschedule</button>
              <OnlineConsultationControls :appointment="recipient" />
              <button class="menu-trigger" data-appointment-menu :aria-label="`More actions for ${nameFor(recipient)}`" aria-haspopup="menu" :aria-expanded="menu?.item.id === recipient.id" @click="openMenu(recipient, $event)">⋯</button>
            </div>
          </article>
          <div v-if="!recipientRows.length" class="empty">Recipient appointments are not available yet.</div>
        </div>
        <div class="related-tools">
          <router-link v-if="selected.groupBookingId && canCheckIn" :to="{ path: '/clinical/group-bookings', query: { group: selected.groupBookingId } }" class="outline-button">Manage Group Schedule</router-link>
          <router-link v-if="recipientRows.some(item => appointmentSessions(item) > 1) && canCheckIn" :to="{ path: '/clinical/treatment-sessions', query: { branch: selected.branchId } }" class="outline-button">Manage Treatment Sessions</router-link>
          <router-link v-if="recipientRows.some(item => appointmentServiceType(item) === 'Online Consultation') && hasPermission('consultations:view')" to="/clinical/consultations/online" class="outline-button">Open Online Consultation</router-link>
        </div>
      </div></template>
      <template #footer><div class="modal-footer"><button class="outline-button" @click="selectedId = ''">Close</button></div></template>
    </Modal>
    <Modal :is-open="Boolean(rescheduleTarget)" title="Reschedule Appointment" panel-class="clinic-reschedule-modal" :panel-style="{ maxWidth: '44rem' }" :close-on-backdrop="!savingReschedule" @close="closeReschedule">
      <template #body>
        <form v-if="rescheduleTarget" class="reschedule-form" @submit.prevent="submitClinicReschedule">
          <div class="reschedule-context">
            <strong>{{ appointmentServiceName(rescheduleTarget) }}</strong>
            <span>{{ nameFor(rescheduleTarget) }}</span>
            <span>Current: {{ scheduleFor(rescheduleTarget) }}</span>
          </div>
          <p v-if="loadingRescheduleAvailability" class="reschedule-message" role="status">Loading clinic availability…</p>
          <p v-if="rescheduleError" class="reschedule-error" role="alert">{{ rescheduleError }}</p>
          <label>Date<input v-model="rescheduleDate" type="date" :min="todayDate()" :disabled="loadingRescheduleAvailability || savingReschedule" required /></label>
          <p v-if="rescheduleDateHasCustomerConflict" class="reschedule-error" role="status">This customer already has another appointment on that date. Choose a different date.</p>
          <label>Available practitioner
            <select v-model="reschedulePractitionerId" :disabled="loadingRescheduleAvailability || savingReschedule || !reschedulePractitioners.length" required>
              <option value="" disabled>{{ reschedulePractitioners.length ? 'Choose practitioner' : 'No practitioner available' }}</option>
              <option v-for="person in reschedulePractitioners" :key="person.id" :value="person.id">{{ person.fullName }}</option>
            </select>
          </label>
          <label>Available time
            <select v-model="rescheduleTime" :disabled="loadingRescheduleAvailability || savingReschedule || !rescheduleSlots.length" required>
              <option value="" disabled>{{ rescheduleSlots.length ? 'Choose an available time' : 'No available times for this date' }}</option>
              <option v-for="slot in rescheduleSlots" :key="slot.value" :value="slot.value">{{ slot.label }}</option>
            </select>
          </label>
          <label>Reason for changing the schedule<textarea v-model.trim="rescheduleReason" rows="3" minlength="5" maxlength="1000" placeholder="For example: the practitioner is unavailable due to an emergency." :disabled="savingReschedule" required /></label>
          <p class="reschedule-message">The new schedule takes effect immediately. We’ll notify the customer by in-app message and email.</p>
        </form>
      </template>
      <template #footer><div class="reschedule-footer"><button type="button" class="outline-button" :disabled="savingReschedule" @click="closeReschedule">Cancel</button><button type="button" class="reschedule-primary" :disabled="savingReschedule || loadingRescheduleAvailability || !reschedulePractitionerId || !rescheduleTime || rescheduleReason.trim().length < 5" @click="submitClinicReschedule">{{ savingReschedule ? 'Rescheduling…' : 'Confirm reschedule' }}</button></div></template>
    </Modal>
    <Teleport to="body"><div v-if="menu" class="recipient-menu" data-appointment-menu role="menu" :style="{ left: `${menu.left}px`, top: `${menu.top}px` }"><button role="menuitem" @click="openContract(menu.item)">Contract</button><button role="menuitem" :disabled="!canCheckIn || !appointmentCheckInAllowed(menu.item)" :title="!canCheckIn ? 'Check-in permission is required.' : 'Check-in requires a paid, signed appointment with an unused service code.'" @click="openCheckIn(menu.item)">Check In</button></div></Teleport>
    <BookingContractModal :visible="Boolean(contractTarget)" :appointment="contractTarget" :read-only="!(contractTarget?.source === 'walk_in' && (hasPermission('appointments:create') || contractTarget?.assignedPractitionerId === auth.currentUser?.uid || contractTarget?.practitionerId === auth.currentUser?.uid))" @close="contractTarget = null" @updated="result => { if (contractTarget && result?.contract) contractTarget.contract = result.contract }" />
    <ServiceKeyVerificationModal :visible="Boolean(checkInTarget)" :loading="verifying" :description="`Enter the service code sent to ${checkInTarget ? emailFor(checkInTarget) : 'the client'}.`" @close="!verifying && (checkInTarget = null)" @submit="submitCode" />
  </div>
</template>

<style scoped>
.appointment-records { color: var(--ac-text); }
.records-panel { background: var(--ac-surface); border: 1px solid var(--ac-border); border-radius: 16px; margin-bottom: 20px; box-shadow: var(--ac-shadow-sm); }
.filters { display: grid; grid-template-columns: minmax(210px, 2fr) repeat(4, minmax(135px, 1fr)); grid-template-areas: "search type review status date"; align-items: start; gap: 16px; padding: 20px; }
.filter-search { grid-area: search; }
.filter-type { grid-area: type; }
.review-filter { grid-area: review; }
.filter-status { grid-area: status; }
.filter-date { grid-area: date; }
label { display: grid; gap: 7px; font-size: 13px; color: var(--ac-text-secondary); }
input, select { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--ac-border-strong); border-radius: var(--ac-radius-sm); background: var(--ac-surface); color: var(--ac-text); }
.filter-help { color: var(--ac-text-muted); font-size: 11px; line-height: 1.35; }
.filters .review-filter { display: flex; align-items: flex-start; align-self: start; gap: 10px; min-height: 44px; padding: 31px 2px 0; cursor: pointer; }
.filters .review-filter input[type="checkbox"] { flex: 0 0 18px; width: 18px; height: 18px; margin: 0; padding: 0; accent-color: #805337; cursor: pointer; }
.filters .review-filter span { line-height: 1.35; }
.table-panel { padding: 16px; }
.table-scroll { overflow-x: auto; }
table { width: 100%; min-width: 850px; border-collapse: collapse; text-align: left; font-size: 13px; }
th { background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
th, td { padding: 14px 12px; border-bottom: 1px solid var(--ac-border); vertical-align: top; }
.subline { margin-top: 5px; font-size: 12px; color: var(--ac-text-muted); }
.status-badge { display: inline-block; border-radius: 20px; padding: 5px 10px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); white-space: nowrap; }
.outline-button, .menu-trigger { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border: 1px solid var(--ac-border-strong); border-radius: 8px; background: var(--ac-surface); color: var(--ac-text-secondary); font-size: 12px; white-space: nowrap; }
.outline-button:hover, .menu-trigger:hover { background: var(--ac-surface-muted); color: var(--ac-text); }
.menu-trigger { font-size: 23px; line-height: 1; padding: 3px 10px; }
.recipient-menu { position: fixed; z-index: 110; width: 180px; padding: 5px; border: 1px solid var(--ac-border-strong); border-radius: 10px; background: var(--ac-surface); color: var(--ac-text); box-shadow: var(--ac-shadow-md); }
.recipient-menu button { display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 6px; font-size: 13px; }
@media (max-width: 1180px) { .filters { grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)); grid-template-areas: "search search type" "review status date"; } .filters .review-filter { padding-top: 8px; } }
@media (max-width: 680px) { .filters { grid-template-columns: minmax(0, 1fr); grid-template-areas: "search" "type" "review" "status" "date"; gap: 13px; padding: 14px; } .filters .review-filter { min-height: 38px; align-items: center; padding: 0; } }
.recipient-menu button:hover:enabled { background: var(--ac-surface-muted); }
.recipient-menu button:disabled { opacity: .45; cursor: not-allowed; }
.booking-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 20px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); }
.booking-summary strong { display: block; margin-bottom: 5px; }.booking-summary p { font-size: 13px; color: var(--ac-text-secondary); margin-top: 3px; }
.summary-label { display: block; color: var(--ac-accent); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
.details-body { min-width: 0; }
.details-heading { margin-top: 24px; font-size: 18px; font-weight: 700; }
.recipient-cards { display: grid; gap: 14px; margin-top: 16px; }
.recipient-card { min-width: 0; padding: 18px; border: 1px solid var(--ac-border); border-radius: 14px; background: var(--ac-surface-soft); }
.recipient-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.recipient-person { min-width: 0; }
.recipient-person h3 { margin: 0; color: var(--ac-text); font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.recipient-person p { margin-top: 4px; color: var(--ac-text-secondary); font-size: 13px; overflow-wrap: anywhere; }
.recipient-details-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 18px; margin-top: 16px; }
.recipient-details-grid > div { min-width: 0; }
.recipient-details-grid dt { color: var(--ac-text-muted); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.recipient-details-grid dd { margin-top: 4px; color: var(--ac-text-secondary); font-size: 13px; overflow-wrap: anywhere; }
.recipient-card-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--ac-border); }
.related-tools { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }.modal-footer { display: flex; justify-content: flex-end; }
.reschedule-form { display: grid; gap: 16px; color: var(--ac-text); }
.reschedule-context { display: grid; gap: 4px; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface-soft); color: var(--ac-text-secondary); font-size: 13px; overflow-wrap: anywhere; }
.reschedule-context strong { color: var(--ac-text); font-size: 15px; }
.reschedule-form label { display: grid; gap: 7px; color: var(--ac-text-secondary); font-size: 13px; font-weight: 600; }
.reschedule-form input, .reschedule-form select, .reschedule-form textarea { width: 100%; min-width: 0; border: 1px solid var(--ac-border-strong); border-radius: 9px; background: var(--ac-surface); color: var(--ac-text); padding: 11px 12px; }
.reschedule-form textarea { resize: vertical; }
.reschedule-message { color: var(--ac-text-muted); font-size: 12px; line-height: 1.5; }
.reschedule-error { padding: 11px 12px; border-radius: 9px; background: var(--ac-danger-bg); color: var(--ac-danger); font-size: 13px; }
.reschedule-footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; }
.reschedule-primary { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--ac-primary); border-radius: 8px; padding: 9px 14px; background: var(--ac-primary); color: var(--ac-on-primary); font-size: 13px; font-weight: 600; }
.reschedule-primary:hover:enabled { filter: brightness(1.08); }
.reschedule-primary:disabled { opacity: .55; cursor: not-allowed; }
:global(.app-modal-panel.appointment-details-panel), :global(.app-modal-panel.clinic-reschedule-modal) { border: 1px solid var(--ac-border) !important; border-radius: 16px !important; background: var(--ac-surface) !important; color: var(--ac-text) !important; box-shadow: var(--ac-shadow-lg) !important; }
:global(.appointment-details-panel > div:first-child), :global(.appointment-details-panel > div:last-child), :global(.clinic-reschedule-modal > div:first-child), :global(.clinic-reschedule-modal > div:last-child) { border-color: var(--ac-border) !important; background: var(--ac-surface) !important; color: var(--ac-text) !important; }
:global(.appointment-details-panel > div:first-child h3), :global(.clinic-reschedule-modal > div:first-child h3) { color: var(--ac-text) !important; }
:global(.appointment-details-panel > div:first-child button), :global(.clinic-reschedule-modal > div:first-child button) { color: var(--ac-text-secondary) !important; }
:global(.appointment-details-panel > div:nth-child(2)), :global(.clinic-reschedule-modal > div:nth-child(2)) { background: var(--ac-surface) !important; }
.empty { text-align: center; padding: 32px; color: var(--ac-text-muted); }.error-message { padding: 14px; background: var(--ac-danger-bg); color: var(--ac-danger); border-radius: 10px; margin-bottom: 18px; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 3px; }
@media(max-width: 767px) { .filters, .booking-summary { grid-template-columns: 1fr; }.filters .review-filter { padding-top: 0; min-height: auto; }.table-panel { padding: 8px; } }
@media(max-width: 640px) { .recipient-card { padding: 14px; }.recipient-details-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }.recipient-card-header { flex-direction: column; }.recipient-card-footer > :deep(*) { max-width: 100%; }.reschedule-footer > * { flex: 1 1 100%; }.booking-summary { gap: 16px; padding: 15px; } }
</style>
