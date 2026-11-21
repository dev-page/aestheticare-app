<template>
  <div class="flex module-theme min-w-0" :class="embedded ? '' : 'owner-theme min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'div' : 'main'" v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5, header: !embedded }" class="flex-1 min-w-0" :class="embedded ? '' : 'p-8'">
      <div class="mb-8">
        <h1 v-if="!embedded" class="text-3xl font-bold text-[#3d281d] mb-2">Online Consultations</h1>
        <p class="text-[#765d4c]">View booked consultations, generate each assigned practitioner's Meet link, and notify the customer.</p>
      </div>
      <section v-if="canCreateMeetLink" class="mb-6 rounded-xl border border-[#ead2b2] bg-white p-5" aria-labelledby="google-account-heading">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="google-account-heading" class="font-semibold text-[#3d281d]">Google Meet account</h2>
            <p v-if="!meetAccount.configured" class="mt-1 text-sm text-[#a13732]">Automatic link generation is not configured. Ask the system administrator to configure Google Meet.</p>
            <p v-else-if="meetAccount.connected" class="mt-1 text-sm text-[#52715b]">Connected{{ meetAccount.email ? ` as ${meetAccount.email}` : '' }}. New links will be generated under this Google account.</p>
            <p v-else class="mt-1 text-sm text-[#765d4c]">Connect your Google account once. The assigned practitioner can then generate and send a meeting link from the consultation row.</p>
            <p v-if="meetAccountError" class="mt-2 text-sm text-[#a13732]" role="alert">{{ meetAccountError }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-if="meetAccount.configured && !meetAccount.connected" type="button" class="rounded-lg bg-[#ad4d0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#913f08] disabled:opacity-50" :disabled="meetAccountLoading || connectingGoogle" @click="connectGoogleAccount">{{ connectingGoogle ? 'Opening Google…' : 'Connect Google account' }}</button>
            <button v-else-if="meetAccount.connected" type="button" class="rounded-lg border border-[#d9b894] px-4 py-2 text-sm font-semibold text-[#70482e] hover:bg-[#fff5e8] disabled:opacity-50" :disabled="meetAccountLoading" @click="disconnectGoogleAccount">Disconnect</button>
          </div>
        </div>
      </section>
      <div class="rounded-xl border border-[#ead2b2] bg-white p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-[#765d4c] text-sm mb-2">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Client or service..."
              class="w-full bg-[#fffaf4] text-[#3d281d] px-4 py-2 rounded-lg border border-[#d9b894] focus:border-[#ad4d0b] focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-[#765d4c] text-sm mb-2">Status</label>
            <select
              v-model="statusFilter"
              class="w-full bg-[#fffaf4] text-[#3d281d] px-4 py-2 rounded-lg border border-[#d9b894] focus:border-[#ad4d0b] focus:outline-none"
            >
              <option value="">All</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="No-show">No-show</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-[#765d4c] text-sm mb-2">Date</label>
            <input
              v-model="dateFilter"
              type="date"
              class="w-full bg-[#fffaf4] text-[#3d281d] px-4 py-2 rounded-lg border border-[#d9b894] focus:border-[#ad4d0b] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <section class="rounded-xl border border-[#ead2b2] bg-white overflow-hidden" aria-labelledby="online-consultations-table-title">
        <div class="border-b border-[#ead2b2] px-6 py-4">
          <h2 id="online-consultations-table-title" class="text-lg font-semibold text-[#3d281d]">Online consultation appointments</h2>
          <p class="mt-1 text-sm text-[#765d4c]">Generate a separate Meet link for each appointment. Each generated link is recorded in the history table below.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-[#f8ead4]">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-[#70482e] uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-[#70482e] uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-[#70482e] uppercase tracking-wider">Schedule</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-[#70482e] uppercase tracking-wider">Meeting Link</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-[#70482e] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0dfc8]">
              <tr v-for="appointment in filteredAppointments" :key="appointment.id" class="hover:bg-[#fffaf4] transition-colors">
                <td class="px-6 py-4 text-[#3d281d]">{{ appointment.clientName || appointment.patientName || '-' }} <span v-if="appointment.demoMode" class="ml-2 rounded-full bg-[#fff2cc] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#805337]">Demo</span><span v-if="String(appointment.status || '').toLowerCase() === 'no-show'" class="ml-2 rounded-full bg-[#fde8e5] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#a13732]">No-show · payment retained</span></td>
                <td class="px-6 py-4 text-[#5d4536]">{{ appointment.service || appointment.type || '-' }}</td>
                <td class="px-6 py-4 text-[#5d4536]">{{ appointment.date || '-' }} {{ formatClockTime(appointment.time) }}</td>
                <td class="px-6 py-4">
                  <div v-if="appointment.consultationMode === 'online' && appointment.meetLink && appointment.consultationInviteAt" class="flex items-center gap-2">
                    <span class="text-[#296348] text-sm break-all">
                      {{ appointment.meetLink }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center h-7 w-7 rounded-md bg-[#f8ead4] text-[#70482e] hover:bg-[#f0dfc8] disabled:opacity-60"
                      @click="copyMeetLink(appointment.meetLink)"
                      title="Copy link"
                    >
                      <Icon icon="mdi:content-copy" class="h-4 w-4" />
                    </button>
                  </div>
                  <span v-else class="text-[#765d4c] text-sm">
                    {{ appointment.consultationMode === 'on-site' ? 'On-site consultation' : 'No meeting link added' }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-2">
<p v-if="appointment.consultationCustomerReadyAt && !appointment.consultationInviteAt" class="w-full text-sm text-[#296348]">Customer checked in and is waiting for a Meet link.</p>
<button v-if="!appointment.meetLink && canGenerateMeetLink(appointment)" type="button" class="px-3 py-1.5 rounded-lg bg-[#ad4d0b] text-white text-xs font-semibold hover:bg-[#913f08] disabled:opacity-60" :disabled="generatingId === appointment.id" @click="generateMeetLink(appointment)">{{ generatingId === appointment.id ? 'Generating…' : 'Generate link & notify' }}</button>
<p v-else-if="!appointment.meetLink && canCreateMeetLink && isAssignedToPractitioner(appointment) && !meetAccount.connected" class="w-full text-xs text-[#805337]">Connect your Google account above to generate this link.</p>
<p v-else-if="!appointment.meetLink && canCreateMeetLink && !isAssignedToPractitioner(appointment)" class="w-full text-xs text-[#765d4c]">The assigned practitioner generates this link.</p>
<p v-if="appointment.consultationInviteAt" class="text-sm text-[#765d4c]">Invitation sent to the customer. Join using your Google account.</p>
<p v-if="appointment.consultationInviteAt && appointment.consultationInviteEmailStatus === 'failed'" class="w-full text-xs text-[#805337]">Email delivery failed. The customer can still reveal the link in My Appointments.</p>
                    <button
                      v-if="appointment.meetLink && appointment.consultationInviteAt && isAssignedToPractitioner(appointment)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-60"
                      :disabled="!canJoinConsultation(appointment)"
                      @click="joinCall(appointment)"
                    >
                      Open Meet
                    </button>
                    <a v-if="appointment.meetLink && appointment.consultationInviteAt && !isAssignedToPractitioner(appointment)" :href="appointment.meetLink" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500">Open Meet</a>
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
                      @click="openStartChecklist(appointment)"
                    >
                      {{ startingId === appointment.id ? 'Starting...' : 'Confirm and Start' }}
                    </button>
                    <button
                      v-if="appointment.status === 'Ongoing' && isAssignedToPractitioner(appointment)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-60"
                      :disabled="finishingId === appointment.id"
                      @click="openCompletionForm(appointment)"
                    >
                      {{ finishingId === appointment.id ? 'Completing...' : 'Add notes and finish' }}
                    </button>
                    <p v-if="appointment.status === 'Ongoing'" class="w-full text-xs font-medium" :class="hasConsultationWindowEnded(appointment) ? 'text-amber-300' : 'text-emerald-300'">{{ consultationTimerLabel(appointment) }}</p>
                    <p v-if="meetLinkGateReason(appointment)" class="w-full text-xs text-amber-300">
                      {{ meetLinkGateReason(appointment) }}
                    </p>
                  </div>
                </td>
              </tr>
              <tr v-if="assignedAppointments.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No online consultations for this branch yet.</td>
              </tr>
              <tr v-else-if="filteredAppointments.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No matching appointments.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-6 overflow-hidden rounded-xl border border-[#ead2b2] bg-white" aria-labelledby="meet-link-history-title">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead2b2] px-6 py-4">
          <div>
            <h2 id="meet-link-history-title" class="text-lg font-semibold text-[#3d281d]">Meet link history</h2>
            <p class="mt-1 text-sm text-[#765d4c]">Every new link generated by a practitioner is recorded here.</p>
          </div>
          <button type="button" class="rounded-lg border border-[#d9b894] px-3 py-2 text-sm text-[#70482e] hover:bg-[#fff5e8] disabled:opacity-50" :disabled="meetLinkLogsLoading" @click="loadMeetLinkLogs">
            {{ meetLinkLogsLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
        <p v-if="meetLinkLogsError && meetLinkLogs.length" class="border-b border-[#e9b2a9] bg-[#fff0ed] px-6 py-3 text-sm text-[#a13732]">
          {{ meetLinkLogsError }}
          <button type="button" class="ml-2 underline underline-offset-2" @click="loadMeetLinkLogs">Try again</button>
        </p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[780px]">
            <thead class="bg-[#f8ead4]">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#70482e]">Link generated</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#70482e]">Practitioner</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#70482e]">Customer</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#70482e]">Service</th>
                <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#70482e]">Appointment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f0dfc8]">
              <tr v-if="meetLinkLogsLoading && meetLinkLogs.length === 0">
                <td colspan="5" class="px-5 py-6 text-center text-sm text-slate-400">Loading Meet link history…</td>
              </tr>
              <tr v-else-if="meetLinkLogsError && meetLinkLogs.length === 0">
                <td colspan="5" class="px-5 py-6 text-center text-sm text-rose-300">
                  {{ meetLinkLogsError }}
                  <button type="button" class="ml-2 underline underline-offset-2" @click="loadMeetLinkLogs">Try again</button>
                </td>
              </tr>
              <tr v-else-if="meetLinkLogs.length === 0">
                <td colspan="5" class="px-5 py-6 text-center text-sm text-slate-400">No Meet links have been generated for this branch yet.</td>
              </tr>
              <template v-else>
                <tr v-for="log in meetLinkLogs" :key="log.id" class="hover:bg-[#fffaf4]">
                  <td class="whitespace-nowrap px-5 py-3 text-sm text-[#3d281d]">{{ formatLogDateTime(log.createdAt) }}</td>
                  <td class="px-5 py-3 text-sm text-[#3d281d]">{{ log.actorName || log.actorId || 'Unknown practitioner' }}</td>
                  <td class="px-5 py-3 text-sm text-[#3d281d]">{{ log.customerName || 'Customer' }}</td>
                  <td class="px-5 py-3 text-sm text-[#5d4536]">{{ log.serviceName || 'Online consultation' }}</td>
                  <td class="whitespace-nowrap px-5 py-3 text-sm text-[#5d4536]">{{ log.appointmentDate || '—' }} {{ formatClockTime(log.appointmentTime) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="meetLinkLogsHasMore" class="flex justify-center border-t border-[#ead2b2] px-6 py-4">
          <button type="button" class="rounded-lg border border-[#d9b894] px-4 py-2 text-sm text-[#70482e] hover:bg-[#fff5e8] disabled:opacity-50" :disabled="meetLinkLogsLoading" @click="loadMeetLinkLogs(true)">
            {{ meetLinkLogsLoading ? 'Loading…' : 'Load older link records' }}
          </button>
        </div>
      </section>
    </component>

    <Modal
      :is-open="Boolean(startChecklistAppointment)"
      title="Confirm before starting"
      :close-on-backdrop="false"
      @close="startChecklistAppointment = null"
    >
      <p class="mb-4 text-sm text-slate-600">Check the customer in Google Meet and verify their identity before starting the consultation timer.</p>
      <label class="mb-3 flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
        <input v-model="startIdentityVerified" type="checkbox" class="mt-1" />
        <span>I verified that the person in Meet is the booked customer.</span>
      </label>
      <label class="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
        <input v-model="startReadyToBegin" type="checkbox" class="mt-1" />
        <span>Both participants are present and ready to begin.</span>
      </label>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border px-4 py-2 text-sm" @click="startChecklistAppointment = null">Cancel</button>
          <button type="button" class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!startIdentityVerified || !startReadyToBegin || startingId === startChecklistAppointment?.id" @click="startConsultation(startChecklistAppointment)">{{ startingId === startChecklistAppointment?.id ? 'Starting…' : 'Start consultation' }}</button>
        </div>
      </template>
    </Modal>

    <Modal
      :is-open="Boolean(completionAppointment)"
      title="Finish online consultation"
      :close-on-backdrop="false"
      @close="closeCompletionForm"
    >
      <p class="mb-4 text-sm text-slate-600">End the call using Google Meet's host controls first. Then confirm below and save your consultation notes. The customer can confirm completion or report a problem.</p>
      <label class="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
        <input v-model="meetEndedConfirmed" type="checkbox" class="mt-1" />
        <span>I ended the Google Meet call for everyone.</span>
      </label>
      <label for="consultation-completion-notes" class="mb-2 block text-sm font-semibold text-slate-700">Consultation notes and recommendations</label>
      <textarea id="consultation-completion-notes" v-model="completionNotes" rows="5" maxlength="5000" class="mb-1 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800" placeholder="Record the assessment, recommendations, and follow-up guidance." />
      <p class="mb-4 text-xs text-slate-500">Enter at least 10 characters. You can save a draft in Consultation controls.</p>
      <PrescriptionComposer v-if="completionAppointment" :key="completionAppointment.id" v-model="completionPrescriptions" :appointment-id="completionAppointment.id" @validity="prescriptionValid = $event" />
      <p v-if="completionError" role="alert" class="mt-3 text-sm text-rose-600">{{ completionError }}</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border px-4 py-2 text-sm" :disabled="finishingId === completionAppointment?.id" @click="closeCompletionForm">Cancel</button>
          <button type="button" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="completionNotes.trim().length < 10 || !meetEndedConfirmed || !prescriptionValid || finishingId === completionAppointment?.id" @click="completeConsultation(completionAppointment)">{{ finishingId === completionAppointment?.id ? 'Saving…' : 'Save notes & finish' }}</button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OnlineConsultationControls from '@/components/common/OnlineConsultationControls.vue'
import Modal from '@/components/common/Modal.vue'
import { onlineWindow, onlineAccessOpen } from '../../../../../../shared/onlineConsultation.js'
import { Icon } from '@iconify/vue'
import { usePermissions } from '@/composables/usePermissions'
import { OTP_BACKEND_CANDIDATES, OTP_BACKEND_URL } from '@/utils/runtimeConfig'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { formatClockTime } from '@/utils/appointmentDss'
import { initialPaymentReceived, normalized } from '../../../../../../backend/otp-backend/bookingWorkflow.js'
import PrescriptionComposer from '@/components/common/PrescriptionComposer.vue'

export default {
  name: 'PractitionerOnlineConsultation',
  props: { embedded: { type: Boolean, default: false }, branchId: { type: String, default: '' }, existingOnly: { type: Boolean, default: false } },
  components: { OwnerSidebar, Icon, OnlineConsultationControls, Modal, PrescriptionComposer },
  setup(props) {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
    const { hasPermission } = usePermissions()
    const route = useRoute()
    const router = useRouter()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const searchQuery = ref('')
    const statusFilter = ref('')
    const dateFilter = ref('')
    const appointments = ref([])
    const meetLinkLogs = ref([])
    const meetLinkLogsLoading = ref(false)
    const meetLinkLogsError = ref('')
    const meetLinkLogsHasMore = ref(false)
    const meetLinkLogsCursor = ref('')
    const meetAccount = ref({ configured: false, connected: false, email: '' })
    const meetAccountLoading = ref(false)
    const meetAccountError = ref('')
    const connectingGoogle = ref(false)
    const generatingId = ref('')

    const startingId = ref('')
    const finishingId = ref('')
    const startChecklistAppointment = ref(null)
    const startIdentityVerified = ref(false)
    const startReadyToBegin = ref(false)
    const completionAppointment = ref(null)
    const completionNotes = ref('')
    const completionPrescriptions = ref([])
    const prescriptionValid = ref(true)
    const completionError = ref('')
    const meetEndedConfirmed = ref(false)
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
    const canCreateMeetLink = computed(() => hasPermission('consultations:create'))
    const activeDemoAppointment = computed(() => appointments.value.find(item => {
      if (item.demoMode !== true || ['completed', 'cancelled', 'rejected', 'no-show'].includes(normalized(item.status))) return false
      const window = onlineWindow(item)
      if (normalized(item.status) === 'ongoing' && item.startedAt) return true
      const expiresAt = window.arrivalDeadline.getTime()
      return Number.isFinite(expiresAt) && expiresAt > clockNow.value
    }))

    const assignedAppointments = computed(() =>
      sortRecordsNewestFirst(appointments.value.filter(item => normalized(item.consultationMode) === 'online')).sort((a, b) => {
        const aWaiting = a.consultationCustomerReadyAt && !a.consultationInviteAt ? 1 : 0
        const bWaiting = b.consultationCustomerReadyAt && !b.consultationInviteAt ? 1 : 0
        return bWaiting - aWaiting
      })
    )

    const filteredAppointments = computed(() =>
      assignedAppointments.value.filter((item) => {
        if (props.existingOnly && !initialPaymentReceived(item)) return false
        if (normalized(item.consultationMode) !== 'online') return false
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
      const records = await Promise.all(snapshot.docs.filter(snap => normalized(snap.data().type) === 'consultation').map(async (snap) => {
        const appointment = { id: snap.id, ...snap.data() }
        const meetingSnap = await getDoc(doc(db, 'appointmentMeetings', snap.id))
        const meeting = meetingSnap.data() || {}
        return meetingSnap.exists() && (meeting.hostVerified || meeting.meetingProvider === 'google-meet-manual') && meeting.practitionerId === (appointment.assignedPractitionerId || appointment.practitionerId) && Date.parse(meeting.scheduledStartAt) === Date.parse(`${appointment.date}T${appointment.time}+08:00`) ? { ...appointment, ...meeting } : { ...appointment, meetLink: '' }
      }))
      appointments.value = sortRecordsNewestFirst(records)
      refreshMeetPresence()
    })

    const formatLogDateTime = value => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
    }

    const loadMeetLinkLogs = async (append = false) => {
      if (!currentBranchId.value || meetLinkLogsLoading.value) return
      meetLinkLogsLoading.value = true
      if (!append) {
        meetLinkLogsError.value = ''
        meetLinkLogsCursor.value = ''
        meetLinkLogsHasMore.value = false
      }
      try {
        const cursor = append ? meetLinkLogsCursor.value : ''
        const response = await fetchFromBackend(`/consultations/meet-link-logs?branchId=${encodeURIComponent(currentBranchId.value)}${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`)
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to load Meet link history.')
        const pageLogs = Array.isArray(payload.data) ? payload.data : []
        meetLinkLogs.value = append ? [...meetLinkLogs.value, ...pageLogs] : pageLogs
        meetLinkLogsCursor.value = payload.nextCursor || ''
        meetLinkLogsHasMore.value = payload.hasMore === true
        meetLinkLogsError.value = ''
      } catch (error) {
        meetLinkLogsError.value = error.message || 'Unable to load Meet link history.'
        console.error('Failed to load Meet link history:', error)
        if (!append) meetLinkLogs.value = []
      } finally {
        meetLinkLogsLoading.value = false
      }
    }

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
      if (!isAssignedToPractitioner(appointment)) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
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

    const canGenerateMeetLink = appointment => Boolean(
      canCreateMeetLink.value && meetAccount.value.connected && isAssignedToPractitioner(appointment)
      && !appointment?.meetLink && normalized(appointment?.consultationMode) === 'online'
    )

    const loadMeetAccount = async () => {
      if (meetAccountLoading.value) return
      meetAccountLoading.value = true
      meetAccountError.value = ''
      try {
        const response = await fetchFromBackend('/google-meet/account')
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to check the Google Meet connection.')
        meetAccount.value = { configured: payload.data?.configured === true, connected: payload.data?.connected === true, email: String(payload.data?.email || '') }
      } catch (error) {
        meetAccountError.value = error.message || 'Unable to check the Google Meet connection.'
      } finally { meetAccountLoading.value = false }
    }

    const connectGoogleAccount = async () => {
      if (connectingGoogle.value || !currentBranchId.value || !canCreateMeetLink.value) return
      connectingGoogle.value = true
      meetAccountError.value = ''
      try {
        const response = await fetchFromBackend('/google-meet/account/connect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ branchId: currentBranchId.value }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success || !payload.data?.url) throw new Error(payload?.error || 'Unable to connect your Google account.')
        window.location.assign(payload.data.url)
      } catch (error) {
        meetAccountError.value = error.message || 'Unable to connect your Google account.'
        connectingGoogle.value = false
      }
    }

    const disconnectGoogleAccount = async () => {
      if (meetAccountLoading.value) return
      meetAccountLoading.value = true
      meetAccountError.value = ''
      try {
        const response = await fetchFromBackend('/google-meet/account/disconnect', { method: 'POST' })
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to disconnect the Google account.')
        meetAccount.value = { ...meetAccount.value, connected: false, email: '' }
        toast.success('Google Meet account disconnected.')
      } catch (error) {
        meetAccountError.value = error.message || 'Unable to disconnect the Google account.'
      } finally { meetAccountLoading.value = false }
    }

    const generateMeetLink = async appointment => {
      if (!appointment?.id || generatingId.value || !canGenerateMeetLink(appointment)) return
      generatingId.value = appointment.id
      try {
        const response = await fetchFromBackend(`/appointments/${appointment.id}/generate-meet-link`, { method: 'POST' })
        const payload = await response.json()
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to generate the Google Meet link.')
        appointment.meetLink = payload.data.meetLink
        appointment.meetingProvider = 'google-meet-api'
        appointment.hostVerified = true
        appointment.meetPresenceTrackingEnabled = false
        appointment.consultationInviteAt = payload.data.invitedAt || new Date().toISOString()
        appointment.consultationInviteEmailStatus = payload.data.emailSent ? 'sent' : 'failed'
        await loadMeetLinkLogs()
        if (payload.data.emailSent) toast.success('Meet link generated. The customer was notified in the app and by email.')
        else toast.warning('Meet link generated and added to the customer’s app. Email delivery failed; check the customer email or email service.')
      } catch (error) {
        toast.error(error.message || 'Unable to generate the Google Meet link.')
      } finally { generatingId.value = '' }
    }

    const canStartConsultation = (appointment) => {
      if (!isAssignedToPractitioner(appointment)) return false
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

    const openStartChecklist = appointment => {
      if (!canStartConsultation(appointment)) return
      startIdentityVerified.value = false
      startReadyToBegin.value = false
      startChecklistAppointment.value = appointment
    }

    const startConsultation = async (appointment) => {
      if (!canStartConsultation(appointment) || !startIdentityVerified.value || !startReadyToBegin.value) return
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
        startChecklistAppointment.value = null
        toast.success('Online consultation started.')
        // The practitioner enters the waiting room using Join Call before starting.
      } catch (error) {
        console.error('Failed to start online consultation:', error)
        toast.error(error?.message || 'Failed to start the online consultation.')
      } finally {
        startingId.value = ''
      }
    }

    const openCompletionForm = appointment => {
      if (!appointment?.id || String(appointment.status || '').trim() !== 'Ongoing') return
      completionAppointment.value = appointment
      completionNotes.value = String(appointment.treatmentNotes || '')
      completionPrescriptions.value = Array.isArray(appointment.prescriptions) ? appointment.prescriptions : []
      prescriptionValid.value = true
      completionError.value = ''
      meetEndedConfirmed.value = false
    }

    const closeCompletionForm = () => {
      if (finishingId.value) return
      completionAppointment.value = null
      completionError.value = ''
      meetEndedConfirmed.value = false
      completionPrescriptions.value = []
      prescriptionValid.value = true
    }

    const completeConsultation = async (appointment) => {
      if (!appointment?.id || String(appointment.status || '').trim() !== 'Ongoing') return
      finishingId.value = appointment.id
      try {
        const treatmentNotes = String(completionNotes.value || '').trim()
        if (treatmentNotes.length < 10) throw Error('Enter consultation notes of at least 10 characters.')
        if (!meetEndedConfirmed.value) throw Error('End the Google Meet call for everyone before finishing the consultation.')
        const materialsUsed = [...new Map((appointment.resources || [])
          .filter(resource => resource.kind === 'material' && String(resource.id || '').trim())
          .map(resource => [String(resource.id).trim(), { id: String(resource.id).trim(), quantity: 0 }])).values()]
        const response = await fetchFromBackend(`/appointments/${appointment.id}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'worker_complete', treatmentNotes, prescriptions: completionPrescriptions.value, materialsUsed, meetEndedConfirmed: true }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to complete the online consultation.')
        }
        appointment.status = payload?.data?.status || 'Awaiting Customer Confirmation'
        appointment.treatmentNotes = treatmentNotes
        appointment.prescriptions = completionPrescriptions.value
        appointment.workerCompleted = true
        appointment.workerCompletedAt = new Date().toISOString()
        appointment.materialsUsed = materialsUsed
        completionAppointment.value = null
        meetEndedConfirmed.value = false
        toast.success('Consultation notes saved. The customer can confirm completion or report a problem.')
      } catch (error) {
        completionError.value = error.message || 'Failed to save consultation notes.'
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
    let oauthFeedbackHandled = false

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
        if (!oauthFeedbackHandled && route.query.googleMeetConnection) {
          oauthFeedbackHandled = true
          const result = String(route.query.googleMeetConnection)
          if (result === 'connected') toast.success('Google Meet account connected.')
          else if (result === 'cancelled') toast.info('Google account connection was cancelled.')
          else toast.error('Google Meet account could not connect. Check the Google configuration and try again.')
          const queryParams = { ...route.query }
          delete queryParams.googleMeetConnection
          await router.replace({ path: route.path, query: queryParams, hash: route.hash })
        }
        await loadMeetAccount()
        await loadMeetLinkLogs()
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
      formatClockTime,
      formatLogDateTime,
      searchQuery,
      statusFilter,
      dateFilter,
      assignedAppointments,
      filteredAppointments,
      meetLinkLogs,
      meetLinkLogsLoading,
      meetLinkLogsError,
      meetLinkLogsHasMore,
      loadMeetLinkLogs,
      meetAccount,
      meetAccountLoading,
      meetAccountError,
      connectingGoogle,
      generatingId,
      connectGoogleAccount,
      disconnectGoogleAccount,
      canGenerateMeetLink,
      generateMeetLink,

      startingId,
      finishingId,
      startChecklistAppointment,
      startIdentityVerified,
      startReadyToBegin,
      completionAppointment,
      completionNotes,
      completionPrescriptions,
      prescriptionValid,
      completionError,
      meetEndedConfirmed,
      currentBranchId,
      currentUserId,
      isSeedingDemo,
      lastDemoAppointmentId,
      activeDemoAppointment,

      meetLinkGateReason,
      canCreateMeetLink,
      isAssignedToPractitioner,
      joinCall,
      canStartConsultation,
      openStartChecklist,
      startConsultation,
      openCompletionForm,
      closeCompletionForm,
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

<style scoped>
.module-theme td.text-white { color: #3d281d; }
.module-theme .text-slate-400 { color: #765d4c; }
.module-theme .text-emerald-300 { color: #296348; }
.module-theme .text-amber-300 { color: #805337; }
.module-theme .text-rose-300 { color: #a13732; }
</style>
