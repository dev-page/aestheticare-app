<template>
  <div class="flex module-theme min-w-0" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'div' : 'main'" v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5, header: !embedded }" class="flex-1 min-w-0" :class="embedded ? '' : 'p-8'">
      <div class="mb-8">
        <h1 v-if="!embedded" class="text-3xl font-bold text-white mb-2">Service Queue</h1>
        <p class="text-slate-400">Checked-in customers appear first. Start your assigned service, record notes, and finish when care is complete.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Client or service..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Status</label>
            <select v-model="statusFilter" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All</option>
              <option v-for="status in ['Unpaid', 'Pending Approval', 'Awaiting Payment', 'Contract Pending', 'Paid', 'Checked in', 'Ready to Start', 'Ongoing', 'Awaiting Customer Confirmation', 'Balance Due', 'Scheduled', 'No-show', 'Incomplete']" :key="status" :value="status">{{ status }}</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Date</label>
            <input v-model="dateFilter" type="date" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none" />
          </div>
        </div>
      </div>

      <section v-if="pendingConsultationClearances.length" class="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/20 p-5">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-white">Consultation verification requests</h2>
          <p class="mt-1 text-sm text-slate-300">Confirm a customer's prior external consultation before they can book a service that requires one.</p>
        </div>
        <div class="space-y-3">
          <article v-for="clearance in pendingConsultationClearances" :key="clearance.id" class="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/80 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-medium text-white">{{ clearance.customerEmail || 'Customer verification request' }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ clearance.serviceNames?.join(', ') || 'Selected consultation-required service' }}</p>
            </div>
            <div v-if="canReviewConsultationClearances" class="flex gap-2">
              <button type="button" :disabled="actionBusy" class="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" @click="reviewConsultationClearance(clearance, 'Approved')">Approve</button>
              <button type="button" :disabled="actionBusy" class="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" @click="reviewConsultationClearance(clearance, 'Rejected')">Reject</button>
            </div>
          </article>
        </div>
      </section>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Schedule</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Service Actions / Follow-up</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="appointment in filteredAppointments" :key="appointment.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white"><p>{{ appointment.clientName || appointment.customerName || appointment.patientName || '-' }}</p><p v-if="appointment.isGroupRecipient" class="mt-1 text-xs text-violet-300">Group recipient {{ appointment.groupRecipientIndex }} of {{ appointment.groupRecipientCount }} · Paid by {{ appointment.groupOrganizerName || 'organizer' }}</p></td>
                <td class="px-6 py-4 text-slate-300"><p>{{ appointment.service || appointment.type || '-' }}</p><p v-if="appointment.treatmentPlan?.totalSessions > 1" class="mt-1 text-xs text-amber-300">Treatment plan: {{ appointment.treatmentPlan.completedSessions || 0 }}/{{ appointment.treatmentPlan.totalSessions }} completed</p></td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.date || '-' }} {{ appointment.time || '' }}</td>
                <td class="px-6 py-4">
                  <span :class="statusClass(appointment.status)">
                    {{ appointment.status || 'Scheduled' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap items-center gap-3">
                    <AppointmentTeam :appointment="appointment" />
                    <button v-if="appointment.source === 'walk_in' && appointment.paymentStatus === 'Paid'" @click="contractAppointment = appointment" class="rounded bg-indigo-700 px-3 py-2 text-white">{{ appointment.contract?.status === 'signed' ? 'View contract' : 'Client review & e-sign' }}</button>
                    <button v-if="appointment.contract?.status === 'signed' && !appointment.workerKeyVerified && ['Paid', 'Scheduled'].includes(appointment.status)" :disabled="actionBusy" @click="manualCheckIn(appointment)" class="rounded bg-amber-700 px-3 py-2 text-white">Check in without reception</button>
                    <button v-if="appointment.consultationMode !== 'online' && (['Checked in', 'Ready to Start'].includes(appointment.status) || (appointment.source === 'walk_in' && appointment.status === 'Paid' && appointment.workerKeyVerified && appointment.contract?.status === 'signed'))" :disabled="actionBusy || !isAssignedToPractitioner(appointment)" title="Only the assigned practitioner can start the service." @click="bookingAction(appointment, 'start')" class="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Start Service</button>
                    <button v-if="canMarkNoShow(appointment)" :disabled="actionBusy" @click="markNoShow(appointment)" class="rounded bg-rose-700 px-3 py-2 text-white">Mark No-show</button>
                    <router-link v-if="appointment.type === 'Consultation' &amp;&amp; appointment.consultationMode === 'online'" :to="{ path: '/crm/appointments', query: { tab: 'queue', mode: 'online' } }" class="rounded border border-amber-300 px-3 py-2">Open Online Consultation</router-link>
                    <button v-if="appointment.status === 'Ongoing' && appointment.consultationMode !== 'online'" :disabled="actionBusy || !isAssignedToPractitioner(appointment)" title="Only the assigned practitioner can complete their work." @click="bookingAction(appointment, 'worker_complete')" class="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">{{ appointment.source === 'walk_in' ? 'Complete Service' : 'Mark My Work Done' }}</button>
                    <button
                      v-if="canRecommendFollowUp(appointment)"
                      type="button"
                      class="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                      :disabled="!isAssignedToPractitioner(appointment)"
                      @click="recommendFollowUp(appointment)"
                    >
                      Recommend Follow-up
                    </button>
                    <span v-else-if="appointment.followUpRecommended" class="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
                      Recommended
                    </span>
                    <span v-else class="text-xs text-slate-400">Not recommended</span>
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
    <BookingContractModal :visible="Boolean(contractAppointment)" :appointment="contractAppointment" @close="contractAppointment = null" @updated="contractSaved" />
    <ServiceKeyVerificationModal
      :visible="showServiceKeyModal"
      :loading="actionBusy"
      :description="selectedServiceKeyAppointment?.isGroupRecipient ? `Enter the service key provided by ${selectedServiceKeyAppointment.clientName || selectedServiceKeyAppointment.customerName || 'this recipient'}.` : 'Enter the service key provided by the customer.'"
      @close="closeServiceKeyModal"
      @submit="submitServiceKey"
    />
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import AppointmentTeam from '@/components/common/AppointmentTeam.vue'
import { toast } from 'vue3-toastify'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ServiceKeyVerificationModal from '@/components/ServiceKeyVerificationModal.vue'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { promptForPrescriptions } from '@/utils/prescriptions'

export default {
  name: 'PractitionerAppointments',
  props: { embedded: { type: Boolean, default: false }, branchId: { type: String, default: '' } },
  components: { OwnerSidebar, ServiceKeyVerificationModal, BookingContractModal, AppointmentTeam },
  setup(props) {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])
    const consultationClearances = ref([])
    const actionBusy = ref(false)
    const contractAppointment = ref(null)
    const contractSaved = async () => { contractAppointment.value = null; await loadAppointments() }
    const showServiceKeyModal = ref(false)
    const selectedServiceKeyAppointment = ref(null)
    const canReviewConsultationClearances = computed(() => hasPermission('appointments:review'))
    const bookingAction = async (appointment, action, serviceKey = '', extra = {}) => {
      if (appointment.type === 'Consultation' && appointment.consultationMode === 'online') { toast.info('Use Online Consultation for verified attendance, timing, and consultation notes.'); return }
      if (actionBusy.value) return
      if (action === 'key' && !serviceKey) return false
      actionBusy.value = true
      try {
        const token = await auth.currentUser.getIdToken()
        const path = action === 'key' ? 'verify-service-key' : 'transition'
        if (action === 'worker_complete') {
          const treatmentNotes = window.prompt('Treatment notes / recommendations (optional):', '')
          if (treatmentNotes === null) return false
          const aftercareInstructions = window.prompt('Aftercare instructions (optional):', '')
          if (aftercareInstructions === null) return false
          const prescriptions = String(appointment.type || '').toLowerCase() === 'consultation' ? promptForPrescriptions(appointment.prescriptions) : undefined
          if (prescriptions === null) return false
          extra = { treatmentNotes, aftercareInstructions, ...(prescriptions ? { prescriptions } : {}) }
        }
        const response = await fetch(OTP_API_BASE + '/appointments/' + appointment.id + '/' + path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(action === 'key' ? { serviceKey } : { action, ...extra }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to update booking.')
        toast.success('Booking updated: ' + payload.data.status)
        await loadAppointments()
        return true
      } catch (error) { toast.error(error.message); return false } finally { actionBusy.value = false }
    }

    const manualCheckIn = async appointment => {
      const reason = window.prompt('Reception fallback: explain how you verified the customer identity (at least 10 characters).')
      if (reason) await bookingAction(appointment, 'manual_check_in', '', { reason })
    }
    const openServiceKeyModal = (appointment) => {
      selectedServiceKeyAppointment.value = appointment
      showServiceKeyModal.value = true
    }
    const closeServiceKeyModal = () => {
      showServiceKeyModal.value = false
      selectedServiceKeyAppointment.value = null
    }
    const submitServiceKey = async (serviceKey) => {
      const verified = await bookingAction(selectedServiceKeyAppointment.value, 'key', serviceKey)
      if (verified) closeServiceKeyModal()
    }

    const canMarkNoShow = (appointment) => {
      const status = String(appointment?.status || '').trim().toLowerCase()
      return ['scheduled', 'ready to start', 'paid'].includes(status)
        && String(appointment?.date || '') <= new Date().toISOString().slice(0, 10)
    }

    const markNoShow = async (appointment) => {
      if (!appointment?.id || actionBusy.value) return
      actionBusy.value = true
      try {
        const token = await auth.currentUser.getIdToken()
        const response = await fetch(`${OTP_API_BASE}/appointments/${appointment.id}/mark-no-show`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to mark the appointment as a no-show.')
        toast.success(`No-show recorded: ${payload.data.noShowOutcome}.`)
      } catch (error) {
        toast.error(error.message)
      } finally {
        actionBusy.value = false
      }
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
      sortRecordsNewestFirst(
        appointments.value.filter((item) => (hasPermission('appointments:review') || isAssignedToPractitioner(item) || item.treatmentTeam?.some(member => member.employeeId === currentUserId.value)) && !item.isGroupParent && !item.isBookingOrderParent)
      )
    )

    const filteredAppointments = computed(() => {
      return assignedAppointments.value.filter((item) => {
        const queryText = searchQuery.value.trim().toLowerCase()
        const clientName = (item.clientName || item.customerName || item.patientName || '').toLowerCase()
        const service = (item.service || item.type || '').toLowerCase()
        const matchesSearch = !queryText || clientName.includes(queryText) || service.includes(queryText)
        const matchesStatus = !statusFilter.value || (item.status || 'Scheduled') === statusFilter.value
        const matchesDate = !dateFilter.value || item.date === dateFilter.value
        return matchesSearch && matchesStatus && matchesDate
      }).sort((a, b) => {
        const priority = { 'Checked in': 0, 'Ready to Start': 0, Ongoing: 1 }
        return (priority[a.status] ?? 2) - (priority[b.status] ?? 2) || String(a.date + a.time).localeCompare(String(b.date + b.time))
      })
    })

    const pendingConsultationClearances = computed(() =>
      consultationClearances.value.filter((clearance) => clearance.status === 'Pending')
    )

    const statusClass = (status) => {
      if (status === 'Completed') return 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400'
      if (status === 'Cancelled') return 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400'
      return 'px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400'
    }

    const canRecommendFollowUp = (appointment) => {
      const status = String(appointment?.status || '').trim().toLowerCase()
      const allowed = Boolean(appointment?.followUpAllowed) || (
        Array.isArray(appointment?.serviceDetails) &&
        appointment.serviceDetails.some((service) => Boolean(service?.followUpAllowed))
      )
      return status === 'completed' && allowed && !appointment?.followUpRecommended
    }

    const recommendFollowUp = async (appointment) => {
      if (!appointment?.id || !canRecommendFollowUp(appointment)) return

      const serviceWindows = Array.isArray(appointment.serviceDetails)
        ? appointment.serviceDetails.map((service) => Number(service?.followUpWindowDays)).filter((days) => Number.isFinite(days) && days > 0)
        : []
      const allWindows = [Number(appointment.followUpWindowDays || 0), ...serviceWindows].filter((days) => Number.isFinite(days) && days > 0)
      const windowDays = allWindows.length ? Math.min(...allWindows) : 14
      const note = window.prompt(
        'Add a brief follow-up recommendation for the customer. Avoid sensitive medical details.',
        `A follow-up visit is recommended. Please book within ${windowDays} days.`
      )
      if (note === null) return
      const customerNote = note.trim()
      if (customerNote.length < 5 || customerNote.length > 250) {
        toast.error('Enter a customer note between 5 and 250 characters.')
        return
      }

      try {
        await updateDoc(doc(db, 'appointments', appointment.id), {
          followUpRecommended: true,
          followUpRecommendationNote: customerNote,
          followUpRecommendedAt: new Date().toISOString(),
          followUpRecommendedById: currentUserId.value,
          updatedAt: new Date().toISOString(),
        })
        toast.success('Follow-up recommended.')
        await loadAppointments()
      } catch (error) {
        console.error(error)
        toast.error('Failed to recommend follow-up.')
      }
    }

    const reviewConsultationClearance = async (clearance, status) => {
      if (!canReviewConsultationClearances.value) {
        toast.error('You do not have permission to review consultation verification requests.')
        return
      }
      if (!clearance?.id || actionBusy.value) return
      actionBusy.value = true
      try {
        await updateDoc(doc(db, 'consultationClearances', clearance.id), {
          status,
          reviewedBy: currentUserId.value,
          reviewedAt: new Date().toISOString(),
          reviewNote: status === 'Rejected' ? 'Please book a consultation with the clinic before requesting this service.' : '',
        })
        toast.success(status === 'Approved' ? 'Consultation verification approved.' : 'Consultation verification rejected.')
      } catch (error) {
        console.error(error)
        toast.error('Unable to review the consultation verification request.')
      } finally {
        actionBusy.value = false
      }
    }

    const loadAppointments = trackPageLoad(async (liveSnapshot = null) => {
      if (!currentBranchId.value) return
      const snapshot = liveSnapshot || await getDocs(
        query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))
      )
      const rawAppointments = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      const missingCustomerIds = Array.from(new Set(
        rawAppointments
          .filter((appt) => !appt.clientName && !appt.customerName && !appt.patientName && appt.customerId)
          .map((appt) => String(appt.customerId))
          .filter(Boolean)
      ))
      const missingClientIds = Array.from(new Set(
        rawAppointments
          .filter((appt) => !appt.clientName && !appt.customerName && !appt.patientName && appt.clientId)
          .map((appt) => String(appt.clientId))
          .filter(Boolean)
      ))

      const customerNameMap = new Map()
      await Promise.all(
        missingCustomerIds.map(async (id) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', id))
            if (userSnap.exists()) {
              const data = userSnap.data() || {}
              const fullName = String(data.fullName || '').trim() ||
                `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim()
              if (fullName) {
                customerNameMap.set(id, fullName)
              }
            }
          } catch (_error) {
            // ignore lookup failures
          }
        })
      )

      const clientNameMap = new Map()
      await Promise.all(
        missingClientIds.map(async (id) => {
          try {
            const clientSnap = await getDoc(doc(db, 'clients', id))
            if (clientSnap.exists()) {
              const data = clientSnap.data() || {}
              const fullName = String(data.fullName || '').trim() ||
                `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim()
              if (fullName) {
                clientNameMap.set(id, fullName)
              }
            }
          } catch (_error) {
            // ignore lookup failures
          }
        })
      )

      appointments.value = sortRecordsNewestFirst(rawAppointments.map((appt) => ({
        ...appt,
        clientName: appt.clientName
          || appt.customerName
          || appt.patientName
          || customerNameMap.get(String(appt.customerId))
          || clientNameMap.get(String(appt.clientId))
          || ''
      })))
    })

    let unsubscribeAuth = null
    let disposed = false
    let unsubscribeAppointments = null
    let unsubscribeConsultationClearances = null

    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        unsubscribeAppointments?.()
        unsubscribeConsultationClearances?.()
        if (!user) { appointments.value = []; consultationClearances.value = []; return }

        currentUserId.value = user.uid
        const scope = await loadOwnerBranchScope(db, user.uid)
        if (disposed) return
        currentBranchId.value = props.branchId || scope.branchId
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        unsubscribeAppointments = pageListener(
          onSnapshot, query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)),
          (snapshot) => loadAppointments(snapshot),
          () => toast.error('Unable to refresh bookings.')
        )
        if (canReviewConsultationClearances.value) {
          unsubscribeConsultationClearances = pageListener(
            onSnapshot, query(collection(db, 'consultationClearances'), where('branchId', '==', currentBranchId.value)),
            (snapshot) => {
              consultationClearances.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
            },
            () => toast.error('Unable to refresh consultation verification requests.')
          )
        }
      })
    }))

    onUnmounted(() => {
      disposed = true
      if (unsubscribeAuth) unsubscribeAuth()
      unsubscribeAppointments?.()
      unsubscribeConsultationClearances?.()
    })

    return {
      pageLoading,
      isAssignedToPractitioner,
      contractAppointment, contractSaved,
      actionBusy, bookingAction, showServiceKeyModal, openServiceKeyModal, closeServiceKeyModal, submitServiceKey,
      canMarkNoShow, markNoShow,
      manualCheckIn,
      searchQuery,
      statusFilter,
      dateFilter,
      assignedAppointments,
      filteredAppointments,
      statusClass,
      canRecommendFollowUp,
      recommendFollowUp,
      pendingConsultationClearances,
      canReviewConsultationClearances,
      reviewConsultationClearance
    }
  }
}
</script>
