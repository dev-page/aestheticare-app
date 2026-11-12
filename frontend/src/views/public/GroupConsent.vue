<template>
  <main class="min-h-screen bg-[#fff8eb] p-6 text-[#3d281d]">
    <section class="mx-auto max-w-lg rounded-2xl border border-[#dfc29e] bg-white p-6 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-widest text-[#8d5a3b]">AesthetiCare</p><h1 class="mt-2 text-2xl font-bold">Your group appointment</h1>
      <PageSkeleton v-if="loading" variant="form" :fields="4" class="mt-4" />
      <p v-if="error" role="alert" class="mt-4 text-sm text-red-700">{{ error }}</p>
      <p v-if="successMessage" role="status" class="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{{ successMessage }}</p>
      <template v-if="appointment">
        <p class="mt-3 font-semibold">{{ appointment.service }}</p><p class="mt-2">{{ appointment.date }} · {{ formatClockTime(appointment.time) }} · {{ appointment.status }}</p>
        <p class="mt-3 text-sm text-[#6f4a2d]">Your consent, attendance, and code apply only to you. Keep your invitation link private.</p>
        <p class="mt-2 text-sm text-[#6f4a2d]">The organizer pays for the group. You can complete consent before or after payment, but both must be complete before check-in. You do not need a platform account.</p>
        <div class="mt-4 rounded-xl bg-[#fff8eb] p-4"><h2 class="font-semibold">Treatment agreement</h2><ClientContractDocument v-if="appointment.contractDocument" :document="appointment.contractDocument" class="mt-2" /><p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ appointment.terms || 'Contact the clinic for your treatment agreement.' }}</p></div>
        <form v-if="!appointment.consentCompleted" class="mt-6 space-y-4" @submit.prevent="accept">
          <label class="block text-sm font-semibold">Your full name<input v-model.trim="name" required maxlength="150" class="mt-1 w-full rounded-xl border border-[#d9be9b] px-3 py-2" /></label>
          <label class="flex gap-2 text-sm"><input v-model="accepted" required type="checkbox" /> I am this attendee and have read and accept the treatment agreement.</label>
          <button class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-white" :disabled="busy || !appointment.terms">Confirm individual consent</button>
        </form>
        <section v-else class="mt-6 rounded-xl bg-[#f7ead7] p-4">
          <p class="font-semibold">Consent completed</p><p class="mt-2 text-sm">Your private check-in code:</p><p class="mt-1 text-3xl font-bold tracking-[.3em]">{{ appointment.serviceKey }}</p>
          <p class="mt-3 text-sm">Bring this code to reception. Check-in is available after your consent and the organizer's group payment are both recorded. The code expires after your appointment window.</p>
          <button v-if="appointment.status === 'Awaiting Customer Confirmation'" :disabled="busy" class="mt-4 rounded-xl bg-[#8d5a3b] px-4 py-2 text-white" @click="confirmCompletion">Confirm I received my service</button>
          <p v-if="appointment.status === 'Completed'" class="mt-4 font-semibold">Your appointment is completed.</p>
        </section>
        <section v-if="appointment.consentCompleted && appointment.sessions?.length" class="mt-5 space-y-3">
          <h2 class="font-semibold">Your treatment sessions</h2>
          <article v-for="session in appointment.sessions" :key="session.id" class="rounded-xl border border-[#d9be9b] p-3">
            <p>Session {{ session.sessionNumber }} / {{ session.totalSessions }} · {{ session.status }}</p>
            <p>{{ session.date }} {{ formatClockTime(session.time) }}</p>
            <p v-if="session.serviceKey">Check-in code: {{ session.serviceKey }}</p>
            <button v-if="session.status === 'Schedule Proposed'" class="mt-2 underline" :disabled="busy" @click="confirmSession(session)">Confirm proposed schedule</button>
            <button v-if="session.appointmentStatus === 'Awaiting Customer Confirmation'" class="mt-2 underline" :disabled="busy" @click="confirmCompletion(session.appointmentId)">Confirm I received this session</button>
            <button v-if="session.canRequestSchedule" class="mt-2 ml-3 underline" :disabled="busy" @click="openSessionRequest(session)">{{ String(session.status || '').toLowerCase() === 'unscheduled' ? 'Choose a session date' : 'Request a different date' }}</button>
            <form v-if="sessionRequests[session.id]" class="mt-3 grid gap-3 rounded-lg bg-[#fff8eb] p-3" @submit.prevent="submitSessionRequest(session)">
              <label class="block text-sm">Preferred date<input v-model="sessionRequests[session.id].date" type="date" :min="sessionMinDate(session)" required class="mt-1 block w-full rounded-xl border border-[#d9be9b] p-2" /></label>
              <label class="block text-sm">Preferred time<input v-model="sessionRequests[session.id].time" type="time" required class="mt-1 block w-full rounded-xl border border-[#d9be9b] p-2" /></label>
              <label class="block text-sm">Reason<textarea v-model.trim="sessionRequests[session.id].reason" required minlength="5" maxlength="1000" class="mt-1 block w-full rounded-xl border border-[#d9be9b] p-2" /></label>
              <div class="flex gap-2"><button type="submit" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-white" :disabled="busy || !sessionRequests[session.id].date || !sessionRequests[session.id].time || !sessionRequests[session.id].reason.trim()">Send request</button><button type="button" class="rounded-xl border border-[#d9be9b] px-4 py-2" @click="closeSessionRequest(session.id)">Close</button></div>
            </form>
          </article>
        </section>
        <form v-if="appointment.consentCompleted && (appointment.canRequestReschedule || appointment.canRequestCancellation)" class="mt-5 space-y-3" @submit.prevent="requestChange">
          <h2 class="font-semibold">Request a change for your appointment</h2>
          <select v-model="changeType" class="w-full rounded-xl border border-[#d9be9b] p-2">
            <option v-if="appointment.canRequestReschedule" value="reschedule">Reschedule ({{ appointment.rescheduleCount }} of {{ appointment.maximumRescheduleAllowance }} used)</option>
            <option v-if="appointment.canRequestCancellation" value="cancel">Cancel</option>
          </select>
          <p v-if="changeType === 'reschedule' && appointment.reschedulePolicy" class="text-sm">{{ appointment.reschedulePolicy }} Your preferred time is reviewed by the clinic and is not held until approval.</p>
          <template v-if="changeType === 'reschedule'"><label class="block text-sm">Preferred date<input v-model="changeDate" type="date" :min="todayManila" required class="block w-full rounded-xl border border-[#d9be9b] p-2" /></label><label class="block text-sm">Preferred time<input v-model="changeTime" type="time" required class="block w-full rounded-xl border border-[#d9be9b] p-2" /></label></template>
          <template v-if="changeType === 'cancel'"><p v-if="appointment.cancellationPolicy" class="whitespace-pre-wrap text-sm">{{ appointment.cancellationPolicy }}</p><p class="text-sm">{{ cancellationEstimateText }}</p><p class="text-xs">The clinic must approve the request. Any approved refund goes to the organizer’s payment method.</p></template>
          <textarea v-model.trim="changeReason" required minlength="5" maxlength="1000" class="w-full rounded-xl border border-[#d9be9b] p-2" placeholder="Reason for your request" />
          <button :disabled="busy || !changeReason.trim() || (changeType === 'reschedule' && (!changeDate || !changeTime))" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-white">Submit request</button>
        </form>
        <p v-else-if="appointment.consentCompleted && !['cancelled', 'completed', 'rejected', 'no-show'].includes(String(appointment.status || '').toLowerCase())" class="mt-5 rounded-xl bg-[#fff8eb] p-4 text-sm">Appointment changes are not currently available under the clinic’s policy or this appointment’s status. Contact the clinic if you need help.</p>
        <button type="button" class="mt-4 inline-flex items-center gap-2 text-sm underline" aria-label="Refresh appointment" :disabled="loading || busy" @click="load"><svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span>Refresh appointment</span></button>
      </template>
    </section>
  </main>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import { useRoute } from 'vue-router'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { formatClockTime } from '@/utils/appointmentDss'
import { cancellationRefundEstimate } from '../../../../shared/appointmentChangePolicy.js'
const route = useRoute(), name = ref(''), accepted = ref(false), loading = ref(false), busy = ref(false), error = ref(''), successMessage = ref(''), appointment = ref(null), sessionRequests = ref({})
const changeType = ref('reschedule'), changeDate = ref(''), changeTime = ref(''), changeReason = ref('')
const todayManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
const sessionMinDate = session => String(session.earliestScheduleDate || '') > todayManila ? session.earliestScheduleDate : todayManila
const cancellationEstimateText = computed(() => {
  if (!appointment.value) return ''
  const estimate = cancellationRefundEstimate({ policy: appointment.value.cancellationTerms || {}, appointment: appointment.value })
  const currency = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0))
  if (estimate.eligibleAmount <= 0) return 'No paid amount is currently eligible for refund.'
  return `Estimated refund if approved: ${currency(estimate.refundAmount)} (${estimate.refundPercentage}% of eligible paid amount after platform commission, using the ${estimate.tier} window).`
})
const api = async (suffix = '', body) => {
  const response = await fetch(OTP_API_BASE + '/group-consents/' + encodeURIComponent(String(route.query.token || '')) + suffix, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load appointment.')
  return result.data
}
const load = async () => { loading.value = true; error.value = ''; try { appointment.value = await api(); name.value = appointment.value.name || ''; changeType.value = appointment.value.canRequestReschedule ? 'reschedule' : 'cancel' } catch (e) { error.value = e.message } finally { loading.value = false } }
const accept = async () => { busy.value = true; error.value = ''; try { await api('/accept', { name: name.value, accepted: accepted.value }); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const confirmCompletion = async appointmentId => { if (!window.confirm('Confirm that you personally received this service?')) return; busy.value = true; try { await api('/transition', { action: 'customer_complete', ...(typeof appointmentId === 'string' ? { appointmentId } : {}) }); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const confirmSession = async session => { busy.value = true; try { await api(`/sessions/${encodeURIComponent(session.id)}/confirm`, {}); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const openSessionRequest = session => { sessionRequests.value = { ...sessionRequests.value, [session.id]: { date: session.date || '', time: session.time || '', reason: '' } } }
const closeSessionRequest = sessionId => { const next = { ...sessionRequests.value }; delete next[sessionId]; sessionRequests.value = next }
const submitSessionRequest = async session => {
  const request = sessionRequests.value[session.id]
  if (!request?.date || !request?.time || String(request.reason || '').trim().length < 5) return
  busy.value = true; error.value = ''; successMessage.value = ''
  try { await api(`/sessions/${encodeURIComponent(session.id)}/request-schedule`, request); sessionRequests.value = {}; successMessage.value = 'Your preferred session time was sent to the clinic for review.'; await load() } catch (e) { error.value = e.message } finally { busy.value = false }
}
const requestChange = async () => { busy.value = true; error.value = ''; successMessage.value = ''; try { await api('/request', { type: changeType.value, date: changeDate.value, time: changeTime.value, reason: changeReason.value }); successMessage.value = changeType.value === 'cancel' ? 'Your cancellation request was sent to the clinic for review.' : 'Your preferred schedule was sent to the clinic. Your current appointment remains active until the clinic approves the change.'; await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
onMounted(load)
</script>
