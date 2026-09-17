<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Appointments</h1>
        <p class="text-slate-400">All appointments assigned to you.</p>
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
              <option v-for="status in ['Unpaid', 'Pending Approval', 'Awaiting Payment', 'Contract Pending', 'Paid', 'Ready to Start', 'Ongoing', 'Awaiting Customer Confirmation', 'Balance Due', 'Scheduled']" :key="status" :value="status">{{ status }}</option>
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
                <td class="px-6 py-4 text-white">{{ appointment.clientName || appointment.customerName || appointment.patientName || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.service || appointment.type || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.date || '-' }} {{ appointment.time || '' }}</td>
                <td class="px-6 py-4">
                  <span :class="statusClass(appointment.status)">
                    {{ appointment.status || 'Scheduled' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap items-center gap-3">
                    <button v-if="appointment.source === 'walk_in' && appointment.paymentStatus === 'Paid'" @click="contractAppointment = appointment" class="rounded bg-indigo-700 px-3 py-2 text-white">{{ appointment.contract?.status === 'signed' ? 'View contract' : 'Client review & e-sign' }}</button>
                    <button v-if="appointment.serviceKey && !appointment.workerKeyVerified && ['Paid', 'Ready to Start', 'Scheduled'].includes(appointment.status)" :disabled="actionBusy" @click="openServiceKeyModal(appointment)" class="rounded bg-amber-700 px-3 py-2 text-white">Verify Customer Key</button>
                    <button v-if="appointment.status === 'Ready to Start' || (appointment.source === 'walk_in' && appointment.status === 'Paid' && appointment.workerKeyVerified && appointment.contract?.status === 'signed')" :disabled="actionBusy" @click="bookingAction(appointment, 'start')" class="rounded bg-blue-700 px-3 py-2 text-white">Start Service</button>
                    <button v-if="appointment.status === 'Ongoing'" :disabled="actionBusy" @click="bookingAction(appointment, 'worker_complete')" class="rounded bg-emerald-700 px-3 py-2 text-white">{{ appointment.source === 'walk_in' ? 'Complete Service' : 'Mark My Work Done' }}</button>
                    <button
                      v-if="canRecommendFollowUp(appointment)"
                      type="button"
                      class="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
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
    </main>
    <BookingContractModal :visible="Boolean(contractAppointment)" :appointment="contractAppointment" @close="contractAppointment = null" @updated="contractSaved" />
    <ServiceKeyVerificationModal
      :visible="showServiceKeyModal"
      :loading="actionBusy"
      description="Enter the service key provided by the customer."
      @close="closeServiceKeyModal"
      @submit="submitServiceKey"
    />
  </div>
</template>

<script>
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ServiceKeyVerificationModal from '@/components/ServiceKeyVerificationModal.vue'

export default {
  name: 'PractitionerAppointments',
  components: { OwnerSidebar, ServiceKeyVerificationModal, BookingContractModal },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])
    const actionBusy = ref(false)
    const contractAppointment = ref(null)
    const contractSaved = async () => { contractAppointment.value = null; await loadAppointments() }
    const showServiceKeyModal = ref(false)
    const selectedServiceKeyAppointment = ref(null)
    const bookingAction = async (appointment, action, serviceKey = '') => {
      if (actionBusy.value) return
      if (action === 'key' && !serviceKey) return false
      actionBusy.value = true
      try {
        const token = await auth.currentUser.getIdToken()
        const path = action === 'key' ? 'verify-service-key' : 'transition'
        const response = await fetch(OTP_API_BASE + '/appointments/' + appointment.id + '/' + path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(action === 'key' ? { serviceKey } : { action }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to update booking.')
        toast.success('Booking updated: ' + payload.data.status)
        await loadAppointments()
        return true
      } catch (error) { toast.error(error.message); return false } finally { actionBusy.value = false }
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
        appointments.value.filter((item) => isAssignedToPractitioner(item))
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
      })
    })

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

      try {
        await updateDoc(doc(db, 'appointments', appointment.id), {
          followUpRecommended: true,
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

    const loadAppointments = async (liveSnapshot = null) => {
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
    }

    let unsubscribeAuth = null
    let unsubscribeAppointments = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        unsubscribeAppointments?.()
        if (!user) { appointments.value = []; return }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        unsubscribeAppointments = onSnapshot(
          query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)),
          (snapshot) => loadAppointments(snapshot),
          () => toast.error('Unable to refresh bookings.')
        )
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      unsubscribeAppointments?.()
    })

    return {
      contractAppointment, contractSaved,
      actionBusy, bookingAction, showServiceKeyModal, openServiceKeyModal, closeServiceKeyModal, submitServiceKey,
      searchQuery,
      statusFilter,
      dateFilter,
      assignedAppointments,
      filteredAppointments,
      statusClass,
      canRecommendFollowUp,
      recommendFollowUp
    }
  }
}
</script>
