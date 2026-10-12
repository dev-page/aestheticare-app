<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { usePermissions } from '@/composables/usePermissions'
import Modal from './Modal.vue'
import { onlineWindow, onlineAccessOpen } from '../../../../shared/onlineConsultation.js'

const props = defineProps({ appointment: { type: Object, required: true }, customer: Boolean, autoOpen: Boolean })
const emit = defineEmits(['changed', 'close'])
const { hasPermission } = usePermissions()
const open = ref(props.autoOpen), busy = ref(false), error = ref(''), message = ref(''), note = ref(''), date = ref(''), time = ref(''), present = ref(false), now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
const online = computed(() => String(props.appointment.type).toLowerCase() === 'consultation' && props.appointment.consultationMode === 'online')
const windowInfo = computed(() => onlineWindow(props.appointment))
const worker = computed(() => !props.customer && auth.currentUser?.uid === (props.appointment.assignedPractitionerId || props.appointment.practitionerId))
const reviewer = computed(() => !props.customer && !worker.value && hasPermission('appointments:review'))
const active = computed(() => props.appointment.status === 'Ongoing' && now.value < windowInfo.value.end.getTime())
const remaining = computed(() => Math.max(0, Math.ceil((windowInfo.value.end.getTime() - now.value) / 1000)))
const clock = computed(() => props.appointment.startedAt ? `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')} remaining` : `Waiting room opens five minutes early. Arrival grace: ${windowInfo.value.policy.graceMinutes} minutes.`)
const warning = computed(() => props.appointment.startedAt && remaining.value <= 300 ? remaining.value <= 60 ? 'One minute or less remains. Finish your discussion and prepare to end the call.' : 'Five minutes or less remain.' : '')
const reporting = computed(() => !['Cancelled', 'Rejected'].includes(props.appointment.status) && props.appointment.consultationDispute?.status !== 'Open')
const send = async (action, extra = {}) => {
  if (busy.value) return
  busy.value = true; error.value = ''; message.value = ''
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw Error('Sign in again to continue.')
    const response = await fetch(`${OTP_BACKEND_CANDIDATES[0]}/appointments/${props.appointment.id}/consultation-events`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action, note: note.value, participantVerified: present.value, date: date.value, time: time.value, ...extra }) })
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw Error('The consultation backend is unavailable. Check the deployed API URL.')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw Error(payload.error || 'Unable to save this consultation update.')
    Object.assign(props.appointment, payload.data)
    emit('changed', payload.data)
    message.value = action === 'review' ? 'Review recorded. Reschedule and refund outcomes go to Booking Requests for approval and processing.' : 'Consultation updated.'
    note.value = ''
  } catch (cause) { error.value = cause.message }
  finally { busy.value = false }
}
</script>

<template>
  <button v-if="online && !autoOpen" type="button" class="consultation-control-button" @click="open = true">Consultation controls<span v-if="appointment.consultationNeedsReview"> · Needs review</span></button>
  <Modal :is-open="open" title="Online consultation" :panel-style="{ maxWidth: '42rem', background: '#fffaf4', color: '#3d281d' }" @close="open = false; emit('close')">
    <template #body>
      <div class="consultation-controls">
        <p class="clock" aria-live="polite">{{ clock }}</p>
        <p v-if="warning && active" class="notice">{{ warning }}</p>
        <p>Booked duration: {{ windowInfo.duration }} minutes from the confirmed start. A new appointment receives a separate meeting link.</p>
        <p v-if="worker" class="notice">After finishing, choose <strong>End meeting for all</strong> in Google Meet. The app cannot disconnect the call.</p>
        <p v-if="!onlineAccessOpen(appointment, now)">Joining through this app is closed. A previously copied Google Meet URL may still exist.</p>
        <p v-if="appointment.consultationReviewReason" class="notice">{{ appointment.consultationReviewReason }}</p>
        <p v-if="appointment.consultationDispute?.status === 'Open'" class="notice">Your reported problem is awaiting independent clinic review: {{ appointment.consultationDispute.note }}</p>
        <p v-if="appointment.consultationReview">Review: {{ appointment.consultationReview.outcome }} — {{ appointment.consultationReview.note }}</p>
        <p v-if="appointment.treatmentNotes"><strong>Saved consultation notes:</strong> {{ appointment.treatmentNotes }}</p>
        <p v-if="appointment.consultationInterruption?.open" class="notice">An interruption is recorded. Rejoin while access is open; the practitioner confirms reconnection. Up to five minutes can be restored within the reserved buffer. Further lost time needs clinic review.</p>
        <label for="consultation-note">{{ worker ? 'Consultation notes or connection issue' : reviewer ? 'Review findings' : 'Describe a problem or connection issue' }}</label>
        <textarea id="consultation-note" v-model="note" rows="4" maxlength="2000" placeholder="Provide details (at least 10 characters)." />
        <div v-if="worker && appointment.consultationInterruption?.open" class="presence"><label><input v-model="present" type="checkbox" /> Both participants have reconnected and are ready.</label></div>
        <div v-if="reviewer" class="schedule"><label>Proposed new date<input v-model="date" type="date" /></label><label>Time (Philippine time)<input v-model="time" type="time" /></label></div>
        <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
        <div class="actions">
          <button v-if="worker && appointment.startedAt" :disabled="busy || note.trim().length < 10" @click="send('save_notes')">Save notes</button>
          <button v-if="active && (customer || worker) && !appointment.consultationInterruption?.open" :disabled="busy || note.trim().length < 10" @click="send('report_interruption')">Report connection interruption</button>
          <button v-if="worker && active && appointment.consultationInterruption?.open" :disabled="busy || !present" @click="send('resume')">Confirm reconnection</button>
          <button v-if="customer && reporting" :disabled="busy || note.trim().length < 10" @click="send('report_problem')">Report a problem</button>
          <template v-if="reviewer && appointment.consultationNeedsReview">
            <button :disabled="busy || note.trim().length < 10" @click="send('review', { outcome: 'received' })">Resolve as received</button>
            <button :disabled="busy || note.trim().length < 10 || !date || !time" @click="send('review', { outcome: 'reschedule' })">Request reviewed reschedule</button>
            <button :disabled="busy || note.trim().length < 10" @click="send('review', { outcome: 'refund' })">Request cancellation / refund review</button>
          </template>
        </div>
        <p v-if="customer">After completion, confirm receipt from the appointment menu or report a problem within 48 hours. Unanswered confirmations go to clinic review.</p>
      </div>
    </template>
    <template #footer><button class="consultation-control-button" @click="open = false; emit('close')">Close</button></template>
  </Modal>
</template>

<style scoped>
.consultation-control-button { padding: 8px 12px; border: 1px solid #e5bc98; border-radius: 8px; background: #fffaf4; color: #62432f; font-size: 13px; text-align: left; }
.consultation-controls { display: grid; gap: 14px; color: #62432f; font-size: 14px; }.clock { font-weight: 700; font-size: 18px; }.notice { padding: 12px; background: #f6ead9; border-radius: 8px; }.error { color: #a32d2d; }
textarea, input[type=date], input[type=time] { width: 100%; border: 1px solid #dfb894; padding: 10px; border-radius: 8px; background: #fffdfa; color: #3d281d; }.actions { display: flex; flex-wrap: wrap; gap: 8px; }.actions button { border: 1px solid #b8855b; border-radius: 8px; padding: 9px 12px; color: #62432f; background: #f6ead9; }.actions button:disabled { opacity: .5; cursor: not-allowed; }.schedule { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }.presence input { accent-color: #99613d; }
</style>
