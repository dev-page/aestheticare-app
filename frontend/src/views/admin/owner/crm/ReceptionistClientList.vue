<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="min-w-0 flex-1 p-4 md:p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Client List</h1>
          <p class="text-slate-400">View branch clients and people from appointment history. New walk-in recipients are added after booking succeeds; clinic edits do not change platform account information.</p>
        </div>
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

      <Modal
        :is-open="Boolean(selectedClient)"
        :title="selectedClient?.fullName || 'Client Profile'"
        panel-class="client-profile-dialog"
        body-class="client-profile-modal-body"
        :panel-style="{ maxWidth: '76rem' }"
        @close="closeClientView"
      >
        <template #body>
          <p class="client-profile-intro">Clinic contact details and appointment history. Changes here do not update the customer’s platform login or past appointment records.</p>
          <div v-if="selectedClient" class="client-profile-grid">
            <section class="client-profile-card">
              <div class="client-profile-card-heading">
                <h3>Client details</h3>
                <button v-if="canEditSelectedClient && !editingClient" type="button" class="client-profile-action" @click="beginClientEdit">Edit</button>
              </div>
              <div v-if="editingClient" class="client-edit-grid">
                <label class="client-edit-field">First name<input v-model.trim="clientDraft.firstName" type="text" maxlength="100" required /></label>
                <label class="client-edit-field">Middle name <span>(optional)</span><input v-model.trim="clientDraft.middleName" type="text" maxlength="100" /></label>
                <label class="client-edit-field">Last name<input v-model.trim="clientDraft.lastName" type="text" maxlength="100" required /></label>
                <label class="client-edit-field">Suffix <span>(optional)</span><input v-model.trim="clientDraft.suffix" type="text" maxlength="20" placeholder="Jr., Sr., III" /></label>
                <label class="client-edit-field client-edit-wide">Email<input v-model.trim="clientDraft.email" type="email" maxlength="254" required /></label>
                <label class="client-edit-field client-edit-wide">Phone<input v-model.trim="clientDraft.phone" type="tel" maxlength="32" /></label>
                <p v-if="editError" class="client-profile-error" role="alert">{{ editError }}</p>
              </div>
              <dl v-else class="client-info-list">
                <div><dt>Name</dt><dd>{{ selectedClient.fullName || '—' }}</dd></div>
                <div><dt>Middle name</dt><dd>{{ selectedClient.middleName || selectedClient.midName || '—' }}</dd></div>
                <div><dt>Suffix</dt><dd>{{ selectedClient.suffix || '—' }}</dd></div>
                <div><dt>Email</dt><dd>{{ selectedClient.email || '—' }}</dd></div>
                <div><dt>Phone</dt><dd>{{ selectedClient.phone || '—' }}</dd></div>
                <div><dt>First seen</dt><dd>{{ formatDate(selectedClient.createdAt) }}</dd></div>
                <div><dt>Appointments</dt><dd>{{ selectedClientHistory.length }}</dd></div>
              </dl>
            </section>

            <section class="client-profile-card">
              <div class="client-profile-card-heading">
                <h3>Appointment history</h3>
                <span>{{ selectedClientHistory.length }} record{{ selectedClientHistory.length === 1 ? '' : 's' }}</span>
              </div>
              <div class="client-history-list">
                <article v-for="appointment in selectedClientHistory" :key="appointment.id" class="client-history-card">
                  <div class="client-history-heading">
                    <div class="client-history-main">
                      <h4>{{ appointment.service || appointment.type || 'Appointment' }}</h4>
                      <p>{{ appointment.date || 'Date not set' }} {{ formatClockTime(appointment.time) }}</p>
                      <p>Practitioner: {{ appointment.practitionerName || appointment.assignedPractitionerName || '—' }}</p>
                    </div>
                    <span class="client-status-badge">{{ appointment.status || 'Scheduled' }}</span>
                  </div>
                  <div v-if="getAppointmentTimelineTags(appointment).length" class="client-history-tags">
                    <span v-for="tag in getAppointmentTimelineTags(appointment)" :key="tag.label" :class="['client-history-tag', timelineTagClass(tag.kind)]">{{ tag.label }}</span>
                  </div>
                  <div v-if="appointment.notes || appointment.cancellationReason || appointment.rescheduleReason || appointment.requestDecisionNote" class="client-history-notes">
                    <p v-if="appointment.notes"><strong>Notes:</strong> {{ appointment.notes }}</p>
                    <p v-if="appointment.cancellationReason"><strong>Cancellation:</strong> {{ appointment.cancellationReason }}</p>
                    <p v-if="appointment.rescheduleReason"><strong>Reschedule:</strong> {{ appointment.rescheduleReason }}</p>
                    <p v-if="appointment.requestDecisionNote"><strong>Decision:</strong> {{ appointment.requestDecisionNote }}</p>
                  </div>
                </article>
                <div v-if="!selectedClientHistory.length" class="client-history-empty">No appointment history found for this client yet.</div>
              </div>
            </section>
          </div>
        </template>
        <template v-if="editingClient" #footer>
          <div class="client-profile-footer">
            <button type="button" class="client-profile-secondary" :disabled="savingClient" @click="cancelClientEdit">Cancel</button>
            <button type="button" class="client-profile-primary" :disabled="savingClient" @click="saveClientChanges">{{ savingClient ? 'Saving…' : 'Save changes' }}</button>
          </div>
        </template>
      </Modal>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { toast } from 'vue3-toastify'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatClockTime } from '@/utils/appointmentDss'
import { usePermissionsStore } from '@/stores/permissions'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

export default {
  name: 'ReceptionistClientList',
  components: { OwnerSidebar, Modal },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const permissions = usePermissionsStore()

    const currentBranchId = ref('')
    const searchQuery = ref('')
    const selectedClient = ref(null)
    const editingClient = ref(false)
    const savingClient = ref(false)
    const editError = ref('')
    const clientDraft = ref({ firstName: '', middleName: '', lastName: '', suffix: '', email: '', phone: '' })
    const branchClientRecords = ref([])
    const appointmentRecords = ref([])
    let unsubscribeClients = null
    let unsubscribeAppointments = null

    const normalizeText = (value) => String(value || '').trim().toLowerCase()

    const formatClientName = (client = {}) => {
      const firstName = String(client.firstName || '').trim()
      const middleName = String(client.middleName || client.midName || '').trim()
      const lastName = String(client.lastName || '').trim()
      const suffix = String(client.suffix || '').trim()
      const structuredName = [firstName, middleName, lastName].filter(Boolean).join(' ')
      if (structuredName) return suffix ? `${structuredName}, ${suffix}` : structuredName
      return String(client.fullName || '').trim() || 'Unknown Client'
    }

    const appointmentIdentity = (appointment = {}) => {
      const clientId = String(appointment.clientId || '').trim()
      const customerId = String(appointment.customerId || '').trim()
      const patientId = String(appointment.patientId || '').trim()
      const stableIds = [clientId && `client:${clientId}`, customerId && `customer:${customerId}`, patientId && `patient:${patientId}`].filter(Boolean)
      const email = normalizeText(appointment.customerEmail || appointment.clientEmail || appointment.patientEmail || appointment.email)
      const phone = normalizeText(appointment.customerPhone || appointment.clientPhone || appointment.patientPhone || appointment.phone)
      const tokens = stableIds.length ? stableIds : email ? [`email:${email}`] : phone ? [`phone:${phone}`] : appointment.id ? [`appointment:${appointment.id}`] : []
      return { tokens, clientId, customerId, appointmentId: String(appointment.id || '').trim(), identity: clientId || customerId || patientId || email || phone || appointment.id || '' }
    }

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
      const map = new Map(), aliases = new Map()

      appointmentRecords.value.forEach((appointment) => {
        if (appointment?.isGroupParent || appointment?.isBookingOrderParent) return
        const identity = appointmentIdentity(appointment)
        if (!identity.tokens.length) return
        const key = identity.tokens.map(token => aliases.get(token)).find(Boolean) || identity.tokens[0]
        const existing = map.get(key)
        const nextCreatedAt = getAppointmentCreatedAt(appointment)
        const nextLastAppointment = appointment?.date || ''

        if (!existing) {
          map.set(key, {
            id: identity.identity,
            clientId: identity.clientId,
            customerId: identity.customerId,
            sourceAppointmentId: identity.appointmentId,
            directoryRecordId: '',
            directoryCustomerId: identity.customerId,
            fullName: getAppointmentClientName(appointment),
            email: appointment?.customerEmail || appointment?.clientEmail || appointment?.patientEmail || appointment?.email || '',
            phone: appointment?.customerPhone || appointment?.clientPhone || appointment?.patientPhone || appointment?.phone || '',
            createdAt: nextCreatedAt,
            lastAppointment: nextLastAppointment,
          })
          identity.tokens.forEach(token => aliases.set(token, key))
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
        if (!existing.customerId && identity.customerId) existing.customerId = identity.customerId
        if (!existing.clientId && identity.clientId) existing.clientId = identity.clientId
        if (!existing.sourceAppointmentId && identity.appointmentId) existing.sourceAppointmentId = identity.appointmentId
        identity.tokens.forEach(token => aliases.set(token, key))
      })

      return [...map.values()]
    })

    const clients = computed(() => {
      const map = new Map(), aliases = new Map()
      const addAliases = (client, key) => {
        if (client.id) aliases.set(`client:${client.id}`, key)
        if (client.customerId) aliases.set(`customer:${client.customerId}`, key)
        if (client.clientId) aliases.set(`client:${client.clientId}`, key)
        if (client.patientId) aliases.set(`patient:${client.patientId}`, key)
        if (client.sourceAppointmentId) aliases.set(`appointment:${client.sourceAppointmentId}`, key)
        // Contact fallbacks apply only to older appointments that lack an ID.
        if (client.email) aliases.set(`email:${normalizeText(client.email)}`, key)
        if (client.phone) aliases.set(`phone:${normalizeText(client.phone)}`, key)
      }

      sortRecordsNewestFirst(branchClientRecords.value).forEach((client) => {
        const key = client.customerId ? `customer:${client.customerId}` : `client:${client.id}`
        const row = {
          id: client.id,
          clientId: client.id,
          customerId: client.customerId || '',
          directoryRecordId: client.id,
          directoryCustomerId: client.customerId || '',
          fullName: formatClientName(client),
          firstName: client.firstName || '',
          middleName: client.middleName || client.midName || '',
          lastName: client.lastName || '',
          suffix: client.suffix || '',
          email: client.email || '',
          phone: client.phone || '',
          createdAt: client.createdAt || null,
        }
        map.set(key, row)
        addAliases(row, key)
      })

      deriveAppointmentClients.value.forEach((client) => {
        const identity = appointmentIdentity(client)
        const key = identity.tokens.map(token => aliases.get(token)).find(Boolean) || identity.tokens[0]
        const existing = map.get(key)
        if (existing) {
          // The clinic directory copy wins for contact details, while booking
          // history supplies the latest appointment date.
          const lastAppointment = [existing.lastAppointment, client.lastAppointment].filter(Boolean).sort().at(-1) || ''
          map.set(key, { ...client, ...existing, lastAppointment, createdAt: existing.createdAt || client.createdAt || null })
          addAliases(map.get(key), key)
          return
        }
        map.set(key, { ...client, id: client.id || identity.identity, lastAppointment: client.lastAppointment || '' })
        addAliases(map.get(key), key)
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

    const canEditSelectedClient = computed(() => Boolean(
      selectedClient.value
      && permissions.hasPermission('clients:update')
    ))

    const selectedClientHistory = computed(() => {
      if (!selectedClient.value) return []

      const selectedKeys = new Set([
        selectedClient.value.directoryRecordId,
        selectedClient.value.id,
        selectedClient.value.clientId,
        selectedClient.value.customerId,
        selectedClient.value.directoryCustomerId,
      ].map(normalizeText).filter(Boolean))
      const selectedEmail = normalizeText(selectedClient.value.email)
      const selectedPhone = normalizeText(selectedClient.value.phone)

      return sortRecordsNewestFirst(
        appointmentRecords.value.filter((appointment) => {
          if (appointment?.isGroupParent || appointment?.isBookingOrderParent) return false
          const appointmentKeys = [
            appointment?.customerId,
            appointment?.clientId,
            appointment?.patientId,
          ].map((value) => normalizeText(value)).filter(Boolean)
          if (appointmentKeys.some((key) => selectedKeys.has(key))) return true
          if (appointmentKeys.length) return false
          const email = normalizeText(appointment.customerEmail || appointment.clientEmail || appointment.patientEmail || appointment.email)
          const phone = normalizeText(appointment.customerPhone || appointment.clientPhone || appointment.patientPhone || appointment.phone)
          return Boolean((selectedEmail && email === selectedEmail) || (selectedPhone && phone === selectedPhone))
        })
      )
    })

    const formatDate = (timestamp) => {
      const date = typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : timestamp
            ? new Date(timestamp)
            : null
      if (!date || Number.isNaN(date.getTime())) return '-'
      return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
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
      cancelClientEdit()
    }

    const closeClientView = () => {
      cancelClientEdit()
      selectedClient.value = null
    }

    const beginClientEdit = () => {
      if (!canEditSelectedClient.value) return
      const fullName = String(selectedClient.value.fullName || '').trim()
      const commaAt = fullName.lastIndexOf(',')
      const parsedSuffix = commaAt > 0 ? fullName.slice(commaAt + 1).trim() : ''
      const nameParts = (commaAt > 0 ? fullName.slice(0, commaAt) : fullName).trim().split(/\s+/).filter(Boolean)
      clientDraft.value = {
        firstName: String(selectedClient.value.firstName || nameParts.shift() || '').trim(),
        middleName: String(selectedClient.value.middleName || selectedClient.value.midName || '').trim(),
        lastName: String(selectedClient.value.lastName || nameParts.join(' ')).trim(),
        suffix: String(selectedClient.value.suffix || parsedSuffix).trim(),
        email: String(selectedClient.value.email || '').trim(),
        phone: String(selectedClient.value.phone || '').trim(),
      }
      editError.value = ''
      editingClient.value = true
    }

    const cancelClientEdit = () => {
      editingClient.value = false
      savingClient.value = false
      editError.value = ''
      clientDraft.value = { firstName: '', middleName: '', lastName: '', suffix: '', email: '', phone: '' }
    }

    const saveClientChanges = async () => {
      if (!selectedClient.value || !canEditSelectedClient.value || savingClient.value) return
      const firstName = String(clientDraft.value.firstName || '').trim().replace(/\s+/g, ' ')
      const middleName = String(clientDraft.value.middleName || '').trim().replace(/\s+/g, ' ')
      const lastName = String(clientDraft.value.lastName || '').trim().replace(/\s+/g, ' ')
      const suffix = String(clientDraft.value.suffix || '').trim().replace(/\s+/g, ' ')
      const name = [firstName, middleName, lastName].filter(Boolean).join(' ')
      const fullName = suffix ? `${name}, ${suffix}` : name
      const email = String(clientDraft.value.email || '').trim().toLowerCase()
      const phone = String(clientDraft.value.phone || '').trim()
      if (!firstName || !lastName || firstName.length > 100 || middleName.length > 100 || lastName.length > 100 || suffix.length > 20) return void (editError.value = 'Enter a first and last name. Middle name and suffix are optional.')
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return void (editError.value = 'Enter a valid email address.')
      if (phone.length > 32 || (phone && !/^\+?[0-9 ()-]{7,32}$/.test(phone))) return void (editError.value = 'Enter a valid phone number.')

      savingClient.value = true
      editError.value = ''
      try {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw Error('Sign in again to update this client.')
        const identity = selectedClient.value.directoryRecordId
          ? { clientRecordId: selectedClient.value.directoryRecordId }
          : selectedClient.value.customerId || selectedClient.value.directoryCustomerId
            ? { customerId: selectedClient.value.customerId || selectedClient.value.directoryCustomerId }
            : selectedClient.value.sourceAppointmentId
              ? { sourceAppointmentId: selectedClient.value.sourceAppointmentId }
              : null
        if (!identity) throw Error('This client has no appointment identity that can be updated securely.')
        const body = {
          branchId: currentBranchId.value,
          ...identity,
          profile: { fullName, firstName, middleName, lastName, suffix, email, phone },
        }
        let response, payload, lastFailure
        for (const base of OTP_BACKEND_CANDIDATES) {
          try {
            response = await fetch(`${base}/clinic/clients/profile`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
              body: JSON.stringify(body),
            })
            if (response.status === 404) continue
            if (!response.headers.get('content-type')?.includes('application/json')) throw Error('The client profile service is unavailable or outdated.')
            payload = await response.json()
            if (!response.ok || payload.success === false) throw Error(payload.error || 'Failed to update client information.')
            break
          } catch (error) {
            lastFailure = error
            if (error.message && !/Failed to fetch|NetworkError/i.test(error.message)) throw error
          }
        }
        if (!payload) throw lastFailure || Error('The client profile service is unavailable.')
        const updated = payload.data || payload
        selectedClient.value = {
          ...selectedClient.value,
          ...updated,
          id: updated.id || selectedClient.value.id,
          directoryRecordId: updated.id || selectedClient.value.directoryRecordId,
          directoryCustomerId: updated.customerId || selectedClient.value.directoryCustomerId,
          fullName, firstName, middleName, lastName, suffix, email, phone,
        }
        toast.success('Client information updated.')
        cancelClientEdit()
      } catch (error) {
        console.error(error)
        editError.value = error?.code === 'permission-denied'
          ? 'You do not have permission to update clients in this branch.'
          : error?.message || 'Failed to update client information.'
      } finally {
        savingClient.value = false
      }
    }

    const startClientsListener = () => {
      if (!currentBranchId.value) return

      if (unsubscribeClients) {
        unsubscribeClients()
        unsubscribeClients = null
      }

      unsubscribeClients = pageListener(
        onSnapshot, query(collection(db, 'clients'), where('branchId', '==', currentBranchId.value)),
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

      unsubscribeAppointments = pageListener(
        onSnapshot, query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value)),
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

    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
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
    }))

    onUnmounted(() => {
      if (unsubscribeClients) unsubscribeClients()
      if (unsubscribeAppointments) unsubscribeAppointments()
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageLoading,
      searchQuery,
      clients,
      filteredClients,
      selectedClient,
      selectedClientHistory,
      canEditSelectedClient,
      editingClient,
      savingClient,
      editError,
      clientDraft,
      openClientView,
      closeClientView,
      beginClientEdit,
      cancelClientEdit,
      saveClientChanges,
      formatDate,
      getAppointmentTimelineTags,
      timelineTagClass
    }
  }
}
</script>

<style scoped>
:global(.app-modal-panel.client-profile-dialog) {
  max-height: calc(100dvh - 6rem) !important;
  border: 1px solid var(--ac-border) !important;
  border-radius: 18px !important;
  background: var(--ac-surface) !important;
  color: var(--ac-text) !important;
}

@media (min-width: 640px) {
  :global(.app-modal-panel.client-profile-dialog) {
    max-height: calc(100dvh - 3rem) !important;
  }
}

:global(.client-profile-dialog > div:first-child),
:global(.client-profile-dialog > div:last-child) {
  border-color: var(--ac-border) !important;
  background: var(--ac-surface) !important;
}

:global(.client-profile-dialog > div:first-child h3) {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--ac-text) !important;
}

:global(.client-profile-dialog > div:first-child button) {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--ac-border) !important;
  border-radius: 10px;
  color: var(--ac-text-secondary) !important;
  background: var(--ac-surface-soft) !important;
}

:global(.client-profile-dialog .client-profile-modal-body) {
  min-height: 0;
  padding: 0 !important;
  background: var(--ac-surface) !important;
}

.client-profile-intro {
  margin: 0;
  padding: 20px 22px 0;
  color: var(--ac-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.client-profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 18px 22px 24px;
}

.client-profile-card {
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--ac-border);
  border-radius: 14px;
  background: var(--ac-surface-soft);
}

.client-profile-card-heading,
.client-history-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.client-profile-card-heading h3 {
  margin: 0;
  color: var(--ac-text-secondary);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .13em;
  text-transform: uppercase;
}

.client-profile-card-heading > span {
  color: var(--ac-text-muted);
  font-size: 12px;
}

.client-profile-action,
.client-profile-secondary,
.client-profile-primary {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ac-border-strong);
  border-radius: 9px;
  padding: 8px 13px;
  color: var(--ac-text-secondary);
  background: var(--ac-surface);
  font-size: 13px;
  font-weight: 650;
}

.client-profile-action:hover,
.client-profile-secondary:hover { background: var(--ac-surface-muted); }

.client-profile-primary {
  border-color: var(--ac-accent);
  color: var(--ac-on-accent, #fffaf4);
  background: var(--ac-accent);
}

.client-profile-primary:hover { filter: brightness(.94); }
.client-profile-primary:disabled,
.client-profile-secondary:disabled { cursor: not-allowed; opacity: .6; }

.client-info-list { display: grid; gap: 0; margin: 14px 0 0; }
.client-info-list > div { display: grid; grid-template-columns: minmax(94px, .32fr) minmax(0, 1fr); gap: 12px; padding: 10px 0; border-top: 1px solid var(--ac-border); }
.client-info-list dt { color: var(--ac-text-muted); font-size: 12px; }
.client-info-list dd { min-width: 0; margin: 0; color: var(--ac-text); font-size: 13px; font-weight: 550; overflow-wrap: anywhere; }

.client-edit-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 13px; margin-top: 15px; }
.client-edit-field { display: grid; gap: 6px; color: var(--ac-text-secondary); font-size: 13px; font-weight: 600; }
.client-edit-field > span { display: inline; color: var(--ac-text-muted); font-weight: 400; }
.client-edit-field input { width: 100%; min-width: 0; border: 1px solid var(--ac-border-strong); border-radius: 9px; padding: 10px 12px; color: var(--ac-text); background: var(--ac-surface); }
.client-profile-error { grid-column: 1 / -1; margin: 0; color: var(--ac-danger); font-size: 13px; }

.client-history-list { display: grid; gap: 12px; max-height: 55vh; overflow-y: auto; margin-top: 14px; padding-right: 3px; }
.client-history-card { min-width: 0; padding: 14px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface); }
.client-history-main { min-width: 0; }
.client-history-main h4 { margin: 0; color: var(--ac-text); font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
.client-history-main p { margin: 5px 0 0; color: var(--ac-text-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.client-status-badge { flex: 0 0 auto; border: 1px solid var(--ac-border); border-radius: 999px; padding: 5px 9px; color: var(--ac-text-secondary); background: var(--ac-surface-muted); font-size: 11px; font-weight: 650; }
.client-history-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.client-history-tag { border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 700; }
.client-history-notes { display: grid; gap: 7px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ac-border); }
.client-history-notes p { margin: 0; color: var(--ac-text-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.client-history-notes strong { color: var(--ac-text); }
.client-history-empty { padding: 20px 14px; border: 1px dashed var(--ac-border-strong); border-radius: 12px; color: var(--ac-text-muted); font-size: 13px; text-align: center; }
.client-profile-footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }

@media (min-width: 900px) {
  .client-profile-grid { grid-template-columns: minmax(260px, .38fr) minmax(0, .62fr); }
  .client-edit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .client-edit-wide { grid-column: 1 / -1; }
}

@media (max-width: 520px) {
  .client-profile-intro { padding: 16px 16px 0; }
  .client-profile-grid { gap: 12px; padding: 14px 16px 18px; }
  .client-profile-card { padding: 14px; }
  .client-profile-card-heading { align-items: center; }
  .client-info-list > div { grid-template-columns: minmax(82px, .34fr) minmax(0, 1fr); gap: 8px; }
  .client-history-heading { flex-direction: column; }
  .client-history-list { max-height: none; }
}
</style>
