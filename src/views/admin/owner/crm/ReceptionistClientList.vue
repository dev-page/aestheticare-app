<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Client List</h1>
          <p class="text-slate-400">View and search all clients registered in your branch.</p>
        </div>
        <router-link
          to="/receptionist/clients/add"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
        >
          Add Client
        </router-link>
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
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Created</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="client in filteredClients" :key="client.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4">
                  <p class="text-white font-medium">{{ client.fullName || '-' }}</p>
                </td>
                <td class="px-6 py-4 text-slate-300">{{ client.email || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ client.phone || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatDate(client.createdAt) }}</td>
                <td class="px-6 py-4">
                  <button
                    type="button"
                    class="rounded-lg border border-purple-400/40 bg-purple-500/15 px-3 py-1.5 text-sm font-medium text-purple-200 transition hover:bg-purple-500/25"
                    @click="openClientView(client)"
                  >
                    View
                  </button>
                </td>
              </tr>
              <tr v-if="clients.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No clients yet.</td>
              </tr>
              <tr v-else-if="filteredClients.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No matching clients.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="selectedClient" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div class="flex items-start justify-between border-b border-slate-700 px-6 py-4">
            <div>
              <h2 class="text-2xl font-bold text-white">{{ selectedClient.fullName || 'Client Profile' }}</h2>
              <p class="mt-1 text-sm text-slate-400">Client history and appointment notes for this branch.</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
              @click="closeClientView"
            >
              Close
            </button>
          </div>

          <div class="grid gap-6 px-6 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section class="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Client Details</h3>
              <div class="mt-4 space-y-3 text-sm">
                <p><span class="text-slate-500">Name:</span> <span class="text-white">{{ selectedClient.fullName || '-' }}</span></p>
                <p><span class="text-slate-500">Email:</span> <span class="text-white">{{ selectedClient.email || '-' }}</span></p>
                <p><span class="text-slate-500">Phone:</span> <span class="text-white">{{ selectedClient.phone || '-' }}</span></p>
                <p><span class="text-slate-500">First Seen:</span> <span class="text-white">{{ formatDate(selectedClient.createdAt) }}</span></p>
                <p><span class="text-slate-500">Appointments:</span> <span class="text-white">{{ selectedClientHistory.length }}</span></p>
              </div>
            </section>

            <section class="rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Appointment History</h3>
                <span class="text-xs text-slate-500">{{ selectedClientHistory.length }} record{{ selectedClientHistory.length === 1 ? '' : 's' }}</span>
              </div>

              <div class="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <article
                  v-for="appointment in selectedClientHistory"
                  :key="appointment.id"
                  class="relative rounded-xl border border-slate-700 bg-slate-900/80 p-4 pl-5"
                >
                  <span class="absolute left-0 top-4 h-4 w-1 rounded-r-full bg-purple-400"></span>
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-base font-semibold text-white">{{ appointment.service || appointment.type || 'Appointment' }}</p>
                      <p class="mt-1 text-sm text-slate-400">{{ appointment.date || '-' }} {{ appointment.time || '' }}</p>
                      <p class="mt-1 text-xs text-slate-500">Practitioner: {{ appointment.practitionerName || appointment.assignedPractitionerName || '-' }}</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                      <span class="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200">{{ appointment.status || 'Scheduled' }}</span>
                      <div class="flex flex-wrap justify-end gap-2">
                        <span
                          v-for="tag in getAppointmentTimelineTags(appointment)"
                          :key="tag.label"
                          class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          :class="timelineTagClass(tag.kind)"
                        >
                          {{ tag.label }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 grid gap-3 md:grid-cols-2">
                    <div v-if="appointment.notes" class="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Notes</p>
                      <p class="mt-2 whitespace-pre-wrap text-sm text-slate-200">{{ appointment.notes }}</p>
                    </div>
                    <div v-if="appointment.cancellationReason || appointment.rescheduleReason || appointment.requestDecisionNote" class="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">History Notes</p>
                      <div class="mt-2 space-y-2 text-sm text-slate-200">
                        <p v-if="appointment.cancellationReason"><span class="text-slate-400">Cancellation:</span> {{ appointment.cancellationReason }}</p>
                        <p v-if="appointment.rescheduleReason"><span class="text-slate-400">Reschedule:</span> {{ appointment.rescheduleReason }}</p>
                        <p v-if="appointment.requestDecisionNote"><span class="text-slate-400">Decision:</span> {{ appointment.requestDecisionNote }}</p>
                      </div>
                    </div>
                  </div>
                </article>

                <div v-if="!selectedClientHistory.length" class="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
                  No appointment history found for this client yet.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

export default {
  name: 'ReceptionistClientList',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const searchQuery = ref('')
    const selectedClient = ref(null)
    const branchClientRecords = ref([])
    const appointmentRecords = ref([])
    let unsubscribeClients = null
    let unsubscribeAppointments = null

    const normalizeText = (value) => String(value || '').trim().toLowerCase()

    const hasUsefulContact = (client = {}) =>
      Boolean(normalizeText(client.email) || normalizeText(client.phone))

    const recordRicherThan = (candidate = {}, existing = {}) => {
      const candidateScore = Number(Boolean(normalizeText(candidate.email))) + Number(Boolean(normalizeText(candidate.phone)))
      const existingScore = Number(Boolean(normalizeText(existing.email))) + Number(Boolean(normalizeText(existing.phone)))
      if (candidateScore !== existingScore) return candidateScore > existingScore
      return Boolean(candidate.createdAt) && !existing.createdAt
    }

    const mergeClientRecord = (target = {}, source = {}) => ({
      ...target,
      ...source,
      fullName: String(target.fullName || source.fullName || 'Unknown Client').trim() || 'Unknown Client',
      email: String(target.email || source.email || '').trim(),
      phone: String(target.phone || source.phone || '').trim(),
      createdAt: target.createdAt || source.createdAt || null,
      lastAppointment: String(target.lastAppointment || source.lastAppointment || '').trim(),
    })

    const getAppointmentClientKey = (appointment) =>
      String(
        appointment?.customerId ||
        appointment?.clientId ||
        appointment?.patientId ||
        appointment?.customerEmail ||
        appointment?.clientEmail ||
        appointment?.patientEmail ||
        appointment?.email ||
        appointment?.customerPhone ||
        appointment?.clientPhone ||
        appointment?.phone ||
        appointment?.clientName ||
        appointment?.patientName ||
        appointment?.customerName ||
        appointment?.id ||
        ''
      ).trim()

    const getAppointmentClientName = (appointment) =>
      String(
        appointment?.clientName ||
        appointment?.customerName ||
        appointment?.patientName ||
        appointment?.fullName ||
        'Unknown Client'
      ).trim() || 'Unknown Client'

    const getAppointmentCreatedAt = (appointment) =>
      appointment?.createdAt || appointment?.paidAt || appointment?.completedAt || appointment?.updatedAt || appointment?.date || null

    const deriveAppointmentClients = computed(() => {
      const map = new Map()

      appointmentRecords.value.forEach((appointment) => {
        const key = getAppointmentClientKey(appointment)
        if (!key) return

        const existing = map.get(key)
        const nextCreatedAt = getAppointmentCreatedAt(appointment)
        const nextLastAppointment = appointment?.date || ''

        if (!existing) {
          map.set(key, {
            id: key,
            fullName: getAppointmentClientName(appointment),
            email: appointment?.customerEmail || appointment?.clientEmail || appointment?.patientEmail || appointment?.email || '',
            phone: appointment?.customerPhone || appointment?.clientPhone || appointment?.patientPhone || appointment?.phone || '',
            createdAt: nextCreatedAt,
            lastAppointment: nextLastAppointment,
          })
          return
        }

        if (nextLastAppointment > (existing.lastAppointment || '')) {
          existing.lastAppointment = nextLastAppointment
        }
        if (!existing.createdAt && nextCreatedAt) {
          existing.createdAt = nextCreatedAt
        }
        if (!existing.email) {
          existing.email = appointment?.customerEmail || appointment?.clientEmail || appointment?.patientEmail || appointment?.email || ''
        }
        if (!existing.phone) {
          existing.phone = appointment?.customerPhone || appointment?.clientPhone || appointment?.patientPhone || appointment?.phone || ''
        }
      })

      return [...map.values()]
    })

    const clients = computed(() => {
      const map = new Map()

      sortRecordsNewestFirst(branchClientRecords.value).forEach((client) => {
        const key = String(client.customerId || client.email || client.phone || client.fullName || client.id || '').trim()
        if (!key) return
        map.set(key, mergeClientRecord(map.get(key), {
          id: client.id,
          fullName: client.fullName || `${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim() || 'Unknown Client',
          email: client.email || '',
          phone: client.phone || '',
          createdAt: client.createdAt || null,
        }))
      })

      deriveAppointmentClients.value.forEach((client) => {
        const key = String(client.id || client.email || client.phone || client.fullName || '').trim()
        if (key && map.has(key)) {
          map.set(key, mergeClientRecord(map.get(key), client))
          return
        }

        const normalizedName = normalizeText(client.fullName)
        if (normalizedName) {
          const nameMatchEntry = [...map.entries()].find(([, existing]) => {
            const existingName = normalizeText(existing.fullName)
            if (existingName !== normalizedName) return false
            return true
          })

          if (nameMatchEntry) {
            const [nameKey, existing] = nameMatchEntry
            if (hasUsefulContact(existing) && !hasUsefulContact(client)) {
              return
            }
            if (recordRicherThan(existing, client)) {
              map.set(nameKey, mergeClientRecord(client, existing))
              return
            }
            map.set(nameKey, mergeClientRecord(existing, client))
            return
          }
        }

        map.set(key || `${normalizedName || 'client'}-${String(client.createdAt || client.lastAppointment || '').trim()}`, client)
      })

      return sortRecordsNewestFirst([...map.values()].map((client) => ({
        ...client,
        createdAt: client.createdAt || client.lastAppointment || null,
      })))
    })

    const filteredClients = computed(() => {
      const queryText = searchQuery.value.trim().toLowerCase()
      if (!queryText) return clients.value

      return clients.value.filter((client) => {
        const name = normalizeText(client.fullName)
        const email = normalizeText(client.email)
        const phone = normalizeText(client.phone)
        return name.includes(queryText) || email.includes(queryText) || phone.includes(queryText)
      })
    })

    const selectedClientHistory = computed(() => {
      if (!selectedClient.value) return []

      const selectedKeys = new Set([
        normalizeText(selectedClient.value.id),
        normalizeText(selectedClient.value.fullName),
        normalizeText(selectedClient.value.email),
        normalizeText(selectedClient.value.phone),
      ].filter(Boolean))

      return sortRecordsNewestFirst(
        appointmentRecords.value.filter((appointment) => {
          const appointmentKeys = [
            appointment?.customerId,
            appointment?.clientId,
            appointment?.patientId,
            appointment?.customerEmail,
            appointment?.clientEmail,
            appointment?.patientEmail,
            appointment?.email,
            appointment?.customerPhone,
            appointment?.clientPhone,
            appointment?.patientPhone,
            appointment?.phone,
            appointment?.clientName,
            appointment?.patientName,
            appointment?.customerName,
          ].map((value) => normalizeText(value)).filter(Boolean)

          return appointmentKeys.some((key) => selectedKeys.has(key))
        })
      )
    })

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const normalizeAppointmentStatus = (value) => String(value || '').trim().toLowerCase()

    const getAppointmentTimelineTags = (appointment) => {
      const tags = []
      const status = normalizeAppointmentStatus(appointment?.status)
      const requestDecision = normalizeAppointmentStatus(appointment?.requestDecisionStatus)

      if (appointment?.followUpRecommended) {
        tags.push({ label: 'Follow-up recommended', kind: 'success' })
      }

      if (appointment?.cancellationRequestedAt || status.includes('cancel')) {
        tags.push({ label: 'Cancellation', kind: 'danger' })
      }

      if (appointment?.rescheduleRequestedAt || status.includes('reschedule')) {
        tags.push({ label: 'Reschedule', kind: 'warning' })
      }

      if (requestDecision === 'approved' && (appointment?.rescheduleApprovedAt || appointment?.requestedDate || appointment?.requestedTime)) {
        tags.push({ label: 'Approved', kind: 'info' })
      }

      return tags
    }

    const timelineTagClass = (kind) => {
      if (kind === 'success') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
      if (kind === 'danger') return 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
      if (kind === 'warning') return 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
      return 'bg-sky-500/15 text-sky-300 border border-sky-400/30'
    }

    const openClientView = (client) => {
      selectedClient.value = client ? { ...client } : null
    }

    const closeClientView = () => {
      selectedClient.value = null
    }

    const startClientsListener = () => {
      if (!currentBranchId.value) return

      if (unsubscribeClients) {
        unsubscribeClients()
        unsubscribeClients = null
      }

      unsubscribeClients = onSnapshot(
        query(collection(db, 'clients'), where('branchId', '==', currentBranchId.value)),
        (snapshot) => {
          branchClientRecords.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
        },
        (error) => {
          console.error(error)
          toast.error('Failed to load clients.')
        }
      )
    }

    const startAppointmentsListener = () => {
      if (!currentBranchId.value) return

      if (unsubscribeAppointments) {
        unsubscribeAppointments()
        unsubscribeAppointments = null
      }

      unsubscribeAppointments = onSnapshot(
        query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)),
        (snapshot) => {
          appointmentRecords.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
        },
        (error) => {
          console.error(error)
          toast.error('Failed to sync appointment clients.')
        }
      )
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        startClientsListener()
        startAppointmentsListener()
      })
    })

    onUnmounted(() => {
      if (unsubscribeClients) unsubscribeClients()
      if (unsubscribeAppointments) unsubscribeAppointments()
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      searchQuery,
      clients,
      filteredClients,
      selectedClient,
      selectedClientHistory,
      openClientView,
      closeClientView,
      formatDate,
      getAppointmentTimelineTags,
      timelineTagClass
    }
  }
}
</script>
