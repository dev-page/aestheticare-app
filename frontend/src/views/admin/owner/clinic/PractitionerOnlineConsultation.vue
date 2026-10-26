<template>
  <div class="flex module-theme min-w-0" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'div' : 'main'" v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5, header: !embedded }" class="flex-1 min-w-0" :class="embedded ? '' : 'p-8'">
      <div class="mb-8">
        <h1 v-if="!embedded" class="text-3xl font-bold text-white mb-2">Online Consultation</h1>
        <p class="text-slate-400">Customers check in to the virtual waiting room with their service code. Invite a waiting customer to Meet when you are ready; the consultation timer starts when both participants are detected and you start the session.</p>
      </div>

      <GoogleHostingAccount />
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Client or service..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Status</label>
            <select
              v-model="statusFilter"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-sky-500 focus:outline-none"
            >
              <option value="">All</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Date</label>
            <input
              v-model="dateFilter"
              type="date"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Schedule</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Meeting Link</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="appointment in filteredAppointments" :key="appointment.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ appointment.clientName || appointment.patientName || '-' }} <span v-if="appointment.demoMode" class="ml-2 rounded-full bg-amber-700/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Demo</span></td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.service || appointment.type || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.date || '-' }} {{ formatClockTime(appointment.time) }}</td>
                <td class="px-6 py-4">
                  <div v-if="appointment.consultationMode === 'online' && appointment.meetLink && appointment.consultationInviteAt" class="flex items-center gap-2">
                    <span class="text-sky-300 text-sm break-all">
                      {{ appointment.meetLink }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center h-7 w-7 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-60"
                      :disabled="!canJoinConsultation(appointment)"
                      @click="copyMeetLink(appointment.meetLink)"
                      title="Copy link"
                    >
                      <Icon icon="mdi:content-copy" class="h-4 w-4" />
                    </button>
                  </div>
                  <span v-else class="text-slate-400 text-sm">
                    {{ appointment.consultationMode === 'on-site' ? 'On-site consultation' : appointment.consultationCustomerReadyAt ? 'Customer is waiting for your invite' : 'Waiting for customer check-in' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-2">
<p v-if="appointment.consultationCustomerReadyAt && !appointment.consultationInviteAt" class="w-full text-sm text-emerald-300">Customer checked in and is waiting. Invite them when you are ready.</p>
<button v-if="appointment.meetLink && appointment.consultationCustomerReadyAt && !appointment.consultationInviteAt" type="button" class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs hover:bg-sky-500 disabled:opacity-60" :disabled="invitingId === appointment.id || !canJoinConsultation(appointment)" @click="inviteCustomer(appointment)">{{ invitingId === appointment.id ? 'Inviting…' : 'Invite to Meet' }}</button>
<p v-if="appointment.consultationInviteAt" class="text-sm text-slate-400">Invitation sent. Join as host using {{ appointment.hostEmail }}.</p>
                    <button
                      v-if="appointment.meetLink && appointment.consultationInviteAt"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-60"
                      :disabled="!canJoinConsultation(appointment)"
                      @click="joinCall(appointment)"
                    >
                      Join Call
                    </button>
                    <OnlineConsultationControls :appointment="appointment" />
                    <p v-if="appointment.meetPresenceTrackingEnabled && appointment.meetPresence?.state === 'participants_detected'" class="w-full text-xs text-emerald-300">Google Meet reports at least two active participants. Confirm the customer's identity in Meet before starting.</p>
                    <p v-else-if="appointment.meetPresenceTrackingEnabled && appointment.meetPresence?.state === 'one_participant'" class="w-full text-xs text-amber-300">Google Meet reports one active participant. Waiting for the other participant.</p>
                    <p v-else-if="appointment.meetPresenceTrackingEnabled && appointment.meetLink && appointment.status !== 'Ongoing'" class="w-full text-xs text-slate-400">Checking Google Meet attendance… The call must be active for participant detection.</p>
                    <p v-if="appointment.meetPresenceError" class="w-full text-xs text-rose-300">Meet attendance check failed: {{ appointment.meetPresenceError }}</p>
                    <p v-if="!appointment.meetPresenceTrackingEnabled && appointment.clientJoinedAt" class="w-full text-xs text-amber-300">The customer selected Join Call in the app; this account cannot verify presence inside Google Meet.</p>
                    <p v-if="appointment.consultationClientEndedAt" class="w-full text-xs text-amber-300">Customer ended participation. Submit notes and mark consultation done.</p>
                    <p v-if="appointment.consultationNeedsReview" class="w-full text-xs text-rose-300">Consultation flagged for clinic review.</p>
                    <button
                      v-if="canStartConsultation(appointment)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-500 disabled:opacity-60"
                      :disabled="startingId === appointment.id"
                      @click="startConsultation(appointment)"
                    >
                      {{ startingId === appointment.id ? 'Starting...' : 'Start Consultation' }}
                    </button>
                    <button
                      v-if="appointment.status === 'Ongoing'"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-60"
                      :disabled="finishingId === appointment.id"
                      @click="completeConsultation(appointment)"
                    >
                      {{ finishingId === appointment.id ? 'Completing...' : 'Mark Consultation Done' }}
                    </button>
                    <p v-if="appointment.status === 'Ongoing'" class="w-full text-xs font-medium" :class="hasConsultationWindowEnded(appointment) ? 'text-amber-300' : 'text-emerald-300'">{{ consultationTimerLabel(appointment) }}</p>
                    <p v-if="meetLinkGateReason(appointment)" class="w-full text-xs text-amber-300">
                      {{ meetLinkGateReason(appointment) }}
                    </p>
                  </div>
                </td>
              </tr>
              <tr v-if="assignedAppointments.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No assigned appointments yet.</td>
              </tr>
              <tr v-else-if="filteredAppointments.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No matching appointments.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </component>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OnlineConsultationControls from '@/components/common/OnlineConsultationControls.vue'
import { onlineWindow, onlineAccessOpen } from '../../../../../../shared/onlineConsultation.js'
import GoogleHostingAccount from '@/components/common/GoogleHostingAccount.vue'
import { Icon } from '@iconify/vue'
import { OTP_BACKEND_CANDIDATES, OTP_BACKEND_URL } from '@/utils/runtimeConfig'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatClockTime } from '@/utils/appointmentDss'
import { initialPaymentReceived, normalized } from '../../../../../../backend/otp-backend/bookingWorkflow.js'
import { promptForPrescriptions } from '@/utils/prescriptions'

export default {
  name: 'PractitionerOnlineConsultation',
  props: { embedded: { type: Boolean, default: false }, branchId: { type: String, default: '' }, existingOnly: { type: Boolean, default: false } },
  components: { OwnerSidebar, Icon, GoogleHostingAccount, OnlineConsultationControls },
  setup(props) {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])

    const startingId = ref('')
    const finishingId = ref('')
    const invitingId = ref('')
    const clockNow = ref(Date.now())
    const isSeedingDemo = ref(false)
    const lastDemoAppointmentId = ref('')

    const fetchFromBackend = trackPageLoad(async (path, options = {}) => {
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

      throw lastError || new Error(`Failed to reach backend service at ${BACKEND_URL}`)
    })

    const isAssignedToPractitioner = appointment => String(appointment.assignedPractitionerId || appointment.practitionerId || appointment.staffId || appointment.assignedTo || '') === currentUserId.value
    const activeDemoAppointment = computed(() => appointments.value.find(item => {
      if (item.demoMode !== true || ['completed', 'cancelled', 'rejected', 'no-show'].includes(normalized(item.status))) return false
      const window = onlineWindow(item)
      if (normalized(item.status) === 'ongoing' && item.startedAt) return true
      const expiresAt = window.arrivalDeadline.getTime()
      return Number.isFinite(expiresAt) && expiresAt > clockNow.value
    }))

    const assignedAppointments = computed(() =>
      sortRecordsNewestFirst(appointments.value.filter((item) => isAssignedToPractitioner(item))).sort((a, b) => {
        const aWaiting = a.consultationCustomerReadyAt && !a.consultationInviteAt ? 1 : 0
        const bWaiting = b.consultationCustomerReadyAt && !b.consultationInviteAt ? 1 : 0
        return bWaiting - aWaiting
      })
    )

    const filteredAppointments = computed(() =>
      assignedAppointments.value.filter((item) => {
        if (props.existingOnly && !initialPaymentReceived(item)) return false
        if (String(item.consultationMode || '').trim().toLowerCase() !== 'online' && !item.meetLink) return false
        const queryText = searchQuery.value.trim().toLowerCase()
        const clientName = (item.clientName || item.patientName || '').toLowerCase()
        const service = (item.service || item.type || '').toLowerCase()
        const matchesSearch = !queryText || clientName.includes(queryText) || service.includes(queryText)
        const matchesStatus = !statusFilter.value || (item.status || 'Scheduled') === statusFilter.value
        const matchesDate = !dateFilter.value || item.date === dateFilter.value
        return matchesSearch && matchesStatus && matchesDate
      })
    )

    const loadAppointments = trackPageLoad(async (providedSnapshot = null) => {
      if (!currentBranchId.value) return
      const snapshot = providedSnapshot || await getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value), where('type', '==', 'Consultation')))
      const records = await Promise.all(snapshot.docs.filter(snap => isAssignedToPractitioner(snap.data()) && normalized(snap.data().type) === 'consultation').map(async (snap) => {
        const appointment = { id: snap.id, ...snap.data() }
        const meetingSnap = await getDoc(doc(db, 'appointmentMeetings', snap.id))
        return meetingSnap.exists() && meetingSnap.data().hostVerified && appointment.consultationCodeVerifiedAt && meetingSnap.data().practitionerId === (appointment.assignedPractitionerId || appointment.practitionerId) && Date.parse(meetingSnap.data().scheduledStartAt) === Date.parse(`${appointment.date}T${appointment.time}+08:00`) ? { ...appointment, ...meetingSnap.data() } : { ...appointment, meetLink: '' }
      }))
      appointments.value = sortRecordsNewestFirst(records)
      refreshMeetPresence()
    })

    const parseDateTime = (dateValue, timeValue) => {
      const date = String(dateValue || '').trim()
      const time = String(timeValue || '09:00').trim()
      if (!date) return null

      const parsed = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`)
      if (Number.isNaN(parsed.getTime())) return null
      return parsed
    }

    const isExpiredAppointment = (appointment) => {
      const start = parseDateTime(appointment?.date, appointment?.time)
      if (!start) return false
      const end = new Date(start.getTime() + consultationDurationMinutes(appointment) * 60 * 1000)
      return clockNow.value > end.getTime()
    }

    const consultationDurationMinutes = (appointment) => Math.min(240, Math.max(5, Number(
      appointment?.consultationDurationMinutes || appointment?.durationMinutes || appointment?.totalServiceDurationMinutes || 30
    )))

    const consultationWindow = appointment => onlineWindow(appointment)

    const canJoinConsultation = (appointment) => {
      const window = consultationWindow(appointment)
      return Boolean(appointment?.meetLink && onlineAccessOpen(appointment, clockNow.value))
    }

    const hasConsultationWindowEnded = (appointment) => {
      const window = consultationWindow(appointment)
      return Boolean(window && clockNow.value >= window.end.getTime())
    }

    const consultationTimerLabel = (appointment) => {
      const window = consultationWindow(appointment)
      if (!window) return 'Consultation schedule is unavailable.'
      const remainingSeconds = Math.max(0, Math.ceil((window.end.getTime() - clockNow.value) / 1000))
      if (!remainingSeconds) {
        const elapsed = Math.max(0, Math.floor((clockNow.value - window.end.getTime()) / 1000))
        return `Booked time ended. Consultation continues; ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} past booked time.`
      }
      return `${remainingSeconds <= 60 ? 'One minute or less left. ' : remainingSeconds <= 300 ? 'Five minutes or less left. ' : ''}Booked time remaining: ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
    }

    const isCancelledAppointment = (appointment) =>
      String(appointment?.status || '').trim().toLowerCase() === 'cancelled'

    const meetLinkGateReason = (appointment) => {
      if (String(appointment?.approvalStatus || '').trim() !== 'Approved') {
        return 'Waiting for clinic approval.'
      }
      if (appointment?.contractRequired === true && normalized(appointment?.contract?.status) !== 'signed') {
        return 'Waiting for the customer to sign the consultation contract.'
      }
      if (!initialPaymentReceived(appointment)) {
        return 'Waiting for the required consultation payment.'
      }
      return ''
    }

    const joinCall = async (appointment) => {
      const url = String(appointment.meetLink || '').trim()
      if (!url) return
      const callWindow = window.open('about:blank', '_blank')
      try {
        const response = await fetchFromBackend(`/appointments/${appointment.id}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'join_consultation', ...(appointment.demoMode ? { demoParticipantRole: 'practitioner' } : {}) }) })
        const payload = await response.json()
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to enter waiting room.')
        appointment.practitionerJoinedAt = new Date().toISOString()
        if (callWindow) { callWindow.opener = null; callWindow.location.href = url }
        else toast.info('Waiting room entered. Open the consultation link to join your call.')
      } catch (error) { callWindow?.close(); toast.error(error.message) }
    }

    const inviteCustomer = async (appointment) => {
      if (!appointment?.id || invitingId.value || !appointment.consultationCustomerReadyAt || appointment.consultationInviteAt) return
      const callWindow = window.open('about:blank', '_blank')
      invitingId.value = appointment.id
      try {
        const response = await fetchFromBackend(`/appointments/${appointment.id}/invite-to-meet`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to invite the customer to Google Meet.')
        appointment.consultationInviteAt = new Date().toISOString()
        const joined = await fetchFromBackend(`/appointments/${appointment.id}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'join_consultation', ...(appointment.demoMode ? { demoParticipantRole: 'practitioner' } : {}) }) })
        const joinPayload = await joined.json()
        if (!joined.ok || !joinPayload?.success) throw new Error(joinPayload?.error || 'Invitation sent, but the waiting room entry could not be recorded.')
        appointment.practitionerJoinedAt = new Date().toISOString()
        if (callWindow) { callWindow.opener = null; callWindow.location.href = payload.data.meetLink }
        else toast.info('Invitation sent. Open the meeting link from the appointment to join as host.')
        toast.success('Customer invited to Google Meet.')
      } catch (error) {
        callWindow?.close()
        toast.error(error.message || 'Unable to invite the customer.')
      } finally { invitingId.value = '' }
    }

    const canStartConsultation = (appointment) => {
      if (!appointment?.meetLink || !canJoinConsultation(appointment)) return false
      if (String(appointment.consultationMode || '').trim().toLowerCase() !== 'online') return false
      if (meetLinkGateReason(appointment)) return false
      if (appointment.meetPresenceTrackingEnabled) {
        const presence = appointment.meetPresence
        if (presence?.state !== 'participants_detected' || Number(presence.activeParticipantCount) < 2 || Date.now() - Date.parse(presence.checkedAt || '') > 60000) return false
      } else if (!appointment.clientJoinedAt || !appointment.practitionerJoinedAt) return false
      return ['Paid', 'Ready to Start', 'Scheduled'].includes(String(appointment.status || '').trim())
    }

    const refreshMeetPresence = async () => {
      const targets = appointments.value.filter(appointment => appointment.meetPresenceTrackingEnabled && appointment.meetLink && appointment.consultationInviteAt && ['paid', 'ready to start', 'scheduled'].includes(normalized(appointment.status)) && onlineAccessOpen(appointment, clockNow.value))
      await Promise.all(targets.map(async appointment => {
        if (appointment.meetPresenceRequestPending) return
        appointment.meetPresenceRequestPending = true
        try {
          const response = await fetchFromBackend(`/appointments/${appointment.id}/meet-presence`, { method: 'POST' })
          const payload = await response.json()
          if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to read meeting participants.')
          appointment.meetPresence = payload.data
          appointment.meetPresenceError = ''
        } catch (error) {
          appointment.meetPresenceError = error.message || 'Unable to read meeting participants.'
        } finally {
          appointment.meetPresenceRequestPending = false
        }
      }))
    }

    const startConsultation = async (appointment) => {
      if (!canStartConsultation(appointment)) return
      if (!window.confirm('Is the customer present in Google Meet, has their identity been verified, and are both of you ready to begin?')) return
      startingId.value = appointment.id
      try {
        const response = await fetchFromBackend(`/appointments/${appointment.id}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'start', participantVerified: true }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to start the online consultation.')
        }
        Object.assign(appointment, payload.data || {})
        appointment.status = payload?.data?.status || 'Ongoing'
        appointment.startedAt = new Date().toISOString()
        toast.success('Online consultation started.')
        // The practitioner enters the waiting room using Join Call before starting.
      } catch (error) {
        console.error('Failed to start online consultation:', error)
        toast.error(error?.message || 'Failed to start the online consultation.')
      } finally {
        startingId.value = ''
      }
    }

    const completeConsultation = async (appointment) => {
      if (!appointment?.id || String(appointment.status || '').trim() !== 'Ongoing') return
      finishingId.value = appointment.id
      try {
        const treatmentNotes = window.prompt('Consultation notes and recommendations (at least 10 characters):', appointment.treatmentNotes || '')
        if (treatmentNotes === null) return
        if (treatmentNotes.trim().length < 10) throw Error('Enter consultation notes of at least 10 characters.')
        const prescriptions = promptForPrescriptions(appointment.prescriptions)
        if (prescriptions === null) return
        const response = await fetchFromBackend(`/appointments/${appointment.id}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'worker_complete', treatmentNotes, prescriptions }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to complete the online consultation.')
        }
        appointment.status = payload?.data?.status || 'Awaiting Customer Confirmation'
        toast.success('Consultation marked done. End meeting for all in Google Meet; the customer can confirm receipt or report a problem.')
      } catch (error) {
        console.error('Failed to complete online consultation:', error)
        toast.error(error?.message || 'Failed to complete the online consultation.')
      } finally {
        finishingId.value = ''
      }
    }

    const copyMeetLink = async (meetLink) => {
      const url = String(meetLink || '').trim()
      if (!url) return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Meet link copied.')
      } catch (error) {
        console.error('Failed to copy meet link:', error)
        toast.error('Failed to copy link.')
      }
    }

    const seedDemoConsultation = async () => {
      if (activeDemoAppointment.value) {
        lastDemoAppointmentId.value = activeDemoAppointment.value.id
        toast.info('A demo appointment is already active. Use the customer appointment view to continue it.')
        return
      }
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('Missing practitioner context for demo seeding.')
        return
      }

      isSeedingDemo.value = true
      try {
        const response = await fetchFromBackend('/appointments/demo-online-consultation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ branchId: currentBranchId.value }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to create a demo consultation.')
        lastDemoAppointmentId.value = payload.data?.id || ''
        toast.success(`Demo appointment created for ${payload.data?.date} at ${payload.data?.time}. Use its service code in My Appointments.`)
        await loadAppointments()
      } catch (error) {
        console.error('Failed to create demo consultation:', error)
        toast.error(error.message || 'Failed to create demo consultation.')
      } finally {
        isSeedingDemo.value = false
      }
    }

    let unsubscribeAuth = null
    let unsubscribeAppointments = null
    let disposed = false
    let consultationClock = null
    let meetPresenceClock = null

    onMounted(trackPageLoad(() => {
      consultationClock = window.setInterval(() => {
        clockNow.value = Date.now()
      }, 1000)
      meetPresenceClock = window.setInterval(refreshMeetPresence, 15000)
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const scope = await loadOwnerBranchScope(db, user.uid)
        currentBranchId.value = props.branchId || scope.branchId
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment-consult' })
          return
        }

        if (disposed) return
        unsubscribeAppointments?.()
        unsubscribeAppointments = pageListener(onSnapshot, query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value), where('type', '==', 'Consultation')), snapshot => loadAppointments(snapshot), error => toast.error(error.message || 'Live consultation updates are unavailable.'))
      })
    }))

    onUnmounted(() => {
      disposed = true
      if (unsubscribeAuth) unsubscribeAuth()
      unsubscribeAppointments?.()
      if (consultationClock) window.clearInterval(consultationClock)
      if (meetPresenceClock) window.clearInterval(meetPresenceClock)
    })

    return {
      pageLoading,
      searchQuery,
      statusFilter,
      dateFilter,
      assignedAppointments,
      filteredAppointments,

      startingId,
      finishingId,
      currentBranchId,
      currentUserId,
      isSeedingDemo,
      lastDemoAppointmentId,
      activeDemoAppointment,

      meetLinkGateReason,
      invitingId,
      joinCall,
      inviteCustomer,
      canStartConsultation,
      startConsultation,
      completeConsultation,
      copyMeetLink,
      canJoinConsultation,
      hasConsultationWindowEnded,
      consultationTimerLabel,
      seedDemoConsultation,
      isExpiredAppointment,
      isCancelledAppointment,
    }
  },
}
</script>
