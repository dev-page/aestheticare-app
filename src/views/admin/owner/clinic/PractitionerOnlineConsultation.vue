<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Online Consultation</h1>
        <p class="text-slate-400">Generate and manage Google Meet links for your assigned appointments.</p>
      </div>

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
                <td class="px-6 py-4 text-white">{{ appointment.clientName || appointment.patientName || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.service || appointment.type || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ appointment.date || '-' }} {{ appointment.time || '' }}</td>
                <td class="px-6 py-4">
                  <div v-if="appointment.meetLink" class="flex items-center gap-2">
                    <span class="text-sky-300 text-sm break-all">
                      {{ appointment.meetLink }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center h-7 w-7 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-60"
                      :disabled="isExpiredAppointment(appointment)"
                      @click="copyMeetLink(appointment.meetLink)"
                      title="Copy link"
                    >
                      <Icon icon="mdi:content-copy" class="h-4 w-4" />
                    </button>
                  </div>
                  <span v-else class="text-slate-400 text-sm">No link yet</span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs hover:bg-sky-500 disabled:opacity-60"
                      :disabled="creatingId === appointment.id || isExpiredAppointment(appointment)"
                      @click="createMeetLink(appointment)"
                    >
                      {{ creatingId === appointment.id ? 'Creating...' : (appointment.meetLink ? 'Regenerate Link' : 'Create Link') }}
                    </button>
                    <button
                      v-if="appointment.meetLink"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-60"
                      :disabled="isExpiredAppointment(appointment)"
                      @click="joinCall(appointment.meetLink)"
                    >
                      Join Call
                    </button>
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
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { Icon } from '@iconify/vue'

const BACKEND_URL = import.meta.env.VITE_OTP_BACKEND_URL || 'http://localhost:3001'
const OTP_API_BASE = import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000'

export default {
  name: 'PractitionerOnlineConsultation',
  components: { OwnerSidebar, Icon },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])
    const creatingId = ref('')
    const isSeedingDemo = ref(false)

    const getBackendCandidates = () => {
      const candidates = [
        String(BACKEND_URL || '').trim(),
        String(OTP_API_BASE || '').trim(),
        'http://localhost:3000',
        'http://localhost:3001',
      ].filter(Boolean)
      return [...new Set(candidates)]
    }

    const fetchFromBackend = async (path, options = {}) => {
      const candidates = getBackendCandidates()
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
    }

    const isAssignedToPractitioner = (appointment) => {
      const assignedIds = [
        appointment.practitionerId,
        appointment.assignedPractitionerId,
        appointment.staffId,
        appointment.assignedTo,
      ]
      return assignedIds.some((value) => value && String(value) === currentUserId.value)
    }

    const assignedAppointments = computed(() =>
      appointments.value
        .filter((item) => isAssignedToPractitioner(item))
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
    )

    const filteredAppointments = computed(() =>
      assignedAppointments.value.filter((item) => {
        const queryText = searchQuery.value.trim().toLowerCase()
        const clientName = (item.clientName || item.patientName || '').toLowerCase()
        const service = (item.service || item.type || '').toLowerCase()
        const matchesSearch = !queryText || clientName.includes(queryText) || service.includes(queryText)
        const matchesStatus = !statusFilter.value || (item.status || 'Scheduled') === statusFilter.value
        const matchesDate = !dateFilter.value || item.date === dateFilter.value
        return matchesSearch && matchesStatus && matchesDate
      })
    )

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)))
      appointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const parseDateTime = (dateValue, timeValue) => {
      const date = String(dateValue || '').trim()
      const time = String(timeValue || '09:00').trim()
      if (!date) return null

      const parsed = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`)
      if (Number.isNaN(parsed.getTime())) return null
      return parsed
    }

    const isExpiredAppointment = (appointment) => {
      const start = parseDateTime(appointment?.date, appointment?.time)
      if (!start) return false
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      return Date.now() > end.getTime()
    }

    const createMeetLink = async (appointment) => {
      if (!appointment?.id) return
      creatingId.value = appointment.id

      try {
        const start = parseDateTime(appointment.date, appointment.time) || new Date()
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        const clientName = appointment.clientName || appointment.patientName || 'Client'
        const serviceName = appointment.service || appointment.type || 'Consultation'

        const response = await fetchFromBackend('/google-meet/create-consultation-link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            summary: `Online Consultation - ${clientName}`,
            description: `${serviceName} (${appointment.date || ''} ${appointment.time || ''})`,
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
            timezone: 'Asia/Manila',
            attendeeEmails: [appointment.clientEmail || appointment.email].filter(Boolean),
            requestId: `appointment-${appointment.id}-${Date.now()}`,
          }),
        })

        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to create Google Meet link.')
        }

        const meetLink = String(payload?.data?.meetLink || '').trim()
        if (!meetLink) throw new Error('Google Meet link is empty.')

        await updateDoc(doc(db, 'appointments', appointment.id), {
          consultationMode: 'online',
          meetLink,
          meetEventId: payload?.data?.eventId || '',
          meetCreatedAt: serverTimestamp(),
          meetCreatedBy: currentUserId.value || '',
        })

        appointment.meetLink = meetLink
        appointment.consultationMode = 'online'
        appointment.meetEventId = payload?.data?.eventId || ''
        toast.success('Google Meet link created successfully.')
      } catch (error) {
        console.error('Failed to create Google Meet link:', error)
        toast.error(error?.message || 'Failed to create Google Meet link.')
      } finally {
        creatingId.value = ''
      }
    }

    const joinCall = (meetLink) => {
      const url = String(meetLink || '').trim()
      if (!url) return
      window.open(url, '_blank', 'noopener,noreferrer')
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
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('Missing practitioner context for demo seeding.')
        return
      }

      isSeedingDemo.value = true
      try {
        const clientQuery = query(
          collection(db, 'clients'),
          where('branchId', '==', currentBranchId.value)
        )
        const usersSnap = await getDocs(clientQuery)
        const customers = usersSnap.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .filter((user) => {
            const status = String(user.status || '').trim().toLowerCase()
            return status !== 'disabled' && status !== 'archived'
          })

        if (!customers.length) {
          toast.error('No customer account found in users collection.')
          return
        }

        const picked = customers[0]
        const firstName = String(picked.firstName || '').trim()
        const lastName = String(picked.lastName || '').trim()
        const fullName =
          String(picked.fullName || '').trim() ||
          `${firstName} ${lastName}`.trim() ||
          picked.email ||
          'Customer'

        const now = new Date()
        now.setMinutes(0, 0, 0)
        now.setHours(now.getHours() + 1)
        const dateValue = now.toISOString().slice(0, 10)
        const timeValue = now.toTimeString().slice(0, 5)

        const payload = {
          branchId: currentBranchId.value,
          practitionerId: currentUserId.value,
          assignedPractitionerId: currentUserId.value,
          clientId: picked.id,
          clientName: fullName,
          patientName: fullName,
          clientEmail: String(picked.email || '').trim(),
          service: 'Online Consultation',
          type: 'Consultation',
          date: dateValue,
          time: timeValue,
          status: 'Scheduled',
          consultationMode: 'online',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }

        await addDoc(collection(db, 'appointments'), payload)
        toast.success(`Demo consultation created for ${fullName}.`)
        await loadAppointments()
      } catch (error) {
        console.error('Failed to seed demo consultation:', error)
        toast.error('Failed to create demo consultation.')
      } finally {
        isSeedingDemo.value = false
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment-consult' })
          return
        }

        await loadAppointments()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      searchQuery,
      statusFilter,
      dateFilter,
      assignedAppointments,
      filteredAppointments,
      creatingId,
      currentBranchId,
      currentUserId,
      isSeedingDemo,
      createMeetLink,
      joinCall,
      copyMeetLink,
      seedDemoConsultation,
      isExpiredAppointment,
    }
  },
}
</script>
