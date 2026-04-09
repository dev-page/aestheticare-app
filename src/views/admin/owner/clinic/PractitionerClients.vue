<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Clients</h1>
        <p class="text-slate-400">Clients with appointments assigned to you.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <label class="block text-slate-400 text-sm mb-2">Search Client</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Name, email, or phone..."
          class="w-full md:w-96 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Email</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Phone</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Last Appointment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="client in filteredClients" :key="client.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white font-medium">{{ client.fullName || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ client.email || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ client.phone || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ client.lastAppointment || '-' }}</td>
              </tr>
              <tr v-if="clients.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">No assigned clients yet.</td>
              </tr>
              <tr v-else-if="filteredClients.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">No matching clients.</td>
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
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'

export default {
  name: 'PractitionerClients',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const appointments = ref([])

    const isAssignedToPractitioner = (appointment) => {
      const assignedIds = [
        appointment.practitionerId,
        appointment.assignedPractitionerId,
        appointment.staffId,
        appointment.assignedTo
      ]
      return assignedIds.some((value) => value && String(value) === currentUserId.value)
    }

    const clients = computed(() => {
      const map = new Map()

      appointments.value
        .filter((item) => isAssignedToPractitioner(item))
        .forEach((item) => {
          const key = item.clientId || item.patientId || item.clientName || item.patientName || item.id
          const current = map.get(key)
          const displayName = item.clientName || item.patientName || 'Unknown Client'
          const nextDate = item.date || ''

          if (!current) {
            map.set(key, {
              id: key,
              fullName: displayName,
              email: item.clientEmail || item.email || '',
              phone: item.clientPhone || item.phone || '',
              lastAppointment: nextDate
            })
            return
          }

          if (nextDate > (current.lastAppointment || '')) {
            current.lastAppointment = nextDate
          }
        })

      return [...map.values()].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
    })

    const filteredClients = computed(() => {
      const queryText = searchQuery.value.trim().toLowerCase()
      if (!queryText) return clients.value

      return clients.value.filter((client) => {
        const name = (client.fullName || '').toLowerCase()
        const email = (client.email || '').toLowerCase()
        const phone = (client.phone || '').toLowerCase()
        return name.includes(queryText) || email.includes(queryText) || phone.includes(queryText)
      })
    })

    const loadAppointments = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(
        query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))
      )
      appointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
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
      searchQuery,
      clients,
      filteredClients
    }
  }
}
</script>
