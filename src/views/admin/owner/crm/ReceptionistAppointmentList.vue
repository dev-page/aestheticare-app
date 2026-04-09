<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">{{ pageTitle }}</h1>
          <p class="text-slate-400">{{ pageSubtitle }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <router-link
            v-if="canCreateAppointments"
            to="/receptionist/appointments/add"
            class="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600"
          >
            Add Appointment
          </router-link>
          <router-link
            v-if="canReviewRequests"
            to="/receptionist/appointment-requests"
            class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Review Appointment Requests
          </router-link>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Client name or service..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Status</label>
            <select v-model="statusFilter" class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none">
              <option value="">All</option>
              <option value="Scheduled">Scheduled</option>
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
                <th v-if="canManageStatus" class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
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
                <td v-if="canManageStatus" class="px-6 py-4">
                  <select
                    :value="appointment.status || 'Scheduled'"
                    @change="updateStatus(appointment, $event.target.value)"
                    class="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
              <tr v-if="visibleAppointments.length === 0">
                <td :colspan="canManageStatus ? 5 : 4" class="px-6 py-8 text-center text-slate-400">No appointments yet.</td>
              </tr>
              <tr v-else-if="filteredAppointments.length === 0">
                <td :colspan="canManageStatus ? 5 : 4" class="px-6 py-8 text-center text-slate-400">No matching appointments.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'

export default {
  name: 'ReceptionistAppointmentList',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const currentRole = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])

    const pageTitle = computed(() => (currentRole.value === 'practitioner' ? 'Appointments' : 'Appointment Hub'))
    const pageSubtitle = computed(() =>
      currentRole.value === 'practitioner'
        ? 'Appointments assigned to you.'
        : 'Track and update all scheduled client appointments.'
    )
    const canCreateAppointments = computed(() => Boolean(hasPermission('appointments:create')))
    const canReviewRequests = computed(() => Boolean(hasPermission('appointments:review')))
    const canManageStatus = computed(() => currentRole.value !== 'practitioner')

    const isAssignedToPractitioner = (appointment) => {
      const assignedIds = [
        appointment.practitionerId,
        appointment.assignedPractitionerId,
        appointment.staffId,
        appointment.assignedTo
      ]
      return assignedIds.some((value) => value && String(value) === currentUserId.value)
    }

    const visibleAppointments = computed(() => {
      const list = currentRole.value === 'practitioner'
        ? appointments.value.filter((item) => isAssignedToPractitioner(item))
        : appointments.value

      return list.slice().sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
    })

    const filteredAppointments = computed(() => {
      return visibleAppointments.value.filter((item) => {
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

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(
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

      appointments.value = rawAppointments.map((appt) => ({
        ...appt,
        clientName: appt.clientName
          || appt.customerName
          || appt.patientName
          || customerNameMap.get(String(appt.customerId))
          || clientNameMap.get(String(appt.clientId))
          || ''
      }))
    }

    const updateStatus = async (appointment, nextStatus) => {
      try {
        await updateDoc(doc(db, 'appointments', appointment.id), {
          status: nextStatus,
          updatedAt: serverTimestamp()
        })
        appointment.status = nextStatus

        await logActivity(db, {
          actorId: currentUserId.value,
          action: 'Updated appointment status',
          details: `${appointment.clientName || 'Unknown client'} set to ${nextStatus}`,
          module: 'Appointments'
        })

        toast.success('Appointment status updated.')
      } catch (error) {
        console.error(error)
        toast.error('Failed to update appointment.')
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() || {} : {}
        currentBranchId.value = userData.branchId || ''
        currentRole.value = String(userData.role || userData.userType || '').trim().toLowerCase()
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }
        await loadAppointments()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageTitle,
      pageSubtitle,
      searchQuery,
      statusFilter,
      dateFilter,
      visibleAppointments,
      filteredAppointments,
      statusClass,
      updateStatus,
      canManageStatus,
      canCreateAppointments,
      canReviewRequests
    }
  }
}
</script>
