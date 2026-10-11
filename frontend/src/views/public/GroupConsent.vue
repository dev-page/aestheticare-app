<template>
  <main class="min-h-screen bg-[#fff8eb] p-6 text-[#3d281d]">
    <section class="mx-auto max-w-lg rounded-2xl border border-[#dfc29e] bg-white p-6 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-widest text-[#8d5a3b]">AesthetiCare</p><h1 class="mt-2 text-2xl font-bold">Your group appointment</h1>
      <PageSkeleton v-if="loading" variant="form" :fields="4" class="mt-4" />
      <p v-if="error" role="alert" class="mt-4 text-sm text-red-700">{{ error }}</p>
      <template v-if="appointment">
        <p class="mt-3 font-semibold">{{ appointment.service }}</p><p class="mt-2">{{ appointment.date }} · {{ appointment.time }} · {{ appointment.status }}</p>
        <p class="mt-3 text-sm text-[#6f4a2d]">Your consent, attendance, and code apply only to you. Keep your invitation link private.</p>
        <div class="mt-4 rounded-xl bg-[#fff8eb] p-4"><h2 class="font-semibold">Treatment agreement</h2><ClientContractDocument v-if="appointment.contractDocument" :document="appointment.contractDocument" class="mt-2" /><p v-else class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ appointment.terms || 'Contact the clinic for your treatment agreement.' }}</p></div>
        <form v-if="!appointment.consentCompleted" class="mt-6 space-y-4" @submit.prevent="accept">
          <label class="block text-sm font-semibold">Your full name<input v-model.trim="name" required maxlength="150" class="mt-1 w-full rounded-xl border border-[#d9be9b] px-3 py-2" /></label>
          <label class="flex gap-2 text-sm"><input v-model="accepted" required type="checkbox" /> I am this attendee and have read and accept the treatment agreement.</label>
          <button class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-white" :disabled="busy || !appointment.terms">Confirm individual consent</button>
        </form>
        <section v-else class="mt-6 rounded-xl bg-[#f7ead7] p-4">
          <p class="font-semibold">Consent completed</p><p class="mt-2 text-sm">Your private check-in code:</p><p class="mt-1 text-3xl font-bold tracking-[.3em]">{{ appointment.serviceKey }}</p>
          <p class="mt-3 text-sm">Bring this code to reception. It expires after your appointment window. Your organizer handles the group payment.</p>
          <button v-if="appointment.status === 'Awaiting Customer Confirmation'" :disabled="busy" class="mt-4 rounded-xl bg-[#8d5a3b] px-4 py-2 text-white" @click="confirmCompletion">Confirm I received my service</button>
          <p v-if="appointment.status === 'Completed'" class="mt-4 font-semibold">Your appointment is completed.</p>
        </section>
        <section v-if="appointment.consentCompleted && appointment.sessions?.length" class="mt-5 space-y-3"><h2 class="font-semibold">Your treatment sessions</h2><article v-for="session in appointment.sessions" :key="session.id" class="rounded-xl border border-[#d9be9b] p-3"><p>Session {{ session.sessionNumber }} / {{ session.totalSessions }} · {{ session.status }}</p><p>{{ session.date }} {{ session.time }}</p><p v-if="session.serviceKey">Check-in code: {{ session.serviceKey }}</p><button v-if="session.status === 'Schedule Proposed'" class="mt-2 underline" :disabled="busy" @click="confirmSession(session)">Confirm proposed schedule</button><button v-if="session.appointmentStatus === 'Awaiting Customer Confirmation'" class="mt-2 underline" :disabled="busy" @click="confirmCompletion(session.appointmentId)">Confirm I received this session</button><button v-if="['Unscheduled', 'Scheduled', 'Schedule Proposed', 'Reschedule eligible'].includes(session.status)" class="mt-2 ml-3 underline" :disabled="busy" @click="requestSession(session)">Request a different date</button></article></section>
        <form v-if="appointment.consentCompleted && ['Paid', 'Scheduled', 'Contract Pending', 'Awaiting Payment'].includes(appointment.status)" class="mt-5 space-y-3" @submit.prevent="requestChange">
          <h2 class="font-semibold">Request a change for your appointment</h2><select v-model="changeType" class="w-full rounded-xl border border-[#d9be9b] p-2"><option value="reschedule">Reschedule</option><option value="cancel">Cancel</option></select>
          <template v-if="changeType === 'reschedule'"><label class="block text-sm">Preferred date<input v-model="changeDate" type="date" required class="block w-full rounded-xl border border-[#d9be9b] p-2" /></label><label class="block text-sm">Preferred time<input v-model="changeTime" type="time" required class="block w-full rounded-xl border border-[#d9be9b] p-2" /></label></template>
          <textarea v-model.trim="changeReason" required minlength="5" maxlength="1000" class="w-full rounded-xl border border-[#d9be9b] p-2" placeholder="Reason for your request" /><p class="text-sm">The clinic reviews changes under its policies. Approved refunds return to the organizer’s payment method.</p><button :disabled="busy" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-white">Submit request</button>
        </form>
        <button type="button" class="mt-4 text-sm underline" :disabled="loading || busy" @click="load">Refresh appointment</button>
      </template>
    </section>
  </main>
</template>
<script setup>
import { onMounted, ref } from 'vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import { useRoute } from 'vue-router'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
const route = useRoute(), name = ref(''), accepted = ref(false), loading = ref(false), busy = ref(false), error = ref(''), appointment = ref(null)
const changeType = ref('reschedule'), changeDate = ref(''), changeTime = ref(''), changeReason = ref('')
const api = async (suffix = '', body) => {
  const response = await fetch(OTP_API_BASE + '/group-consents/' + encodeURIComponent(String(route.query.token || '')) + suffix, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load appointment.')
  return result.data
}
const load = async () => { loading.value = true; error.value = ''; try { appointment.value = await api(); name.value = appointment.value.name || '' } catch (e) { error.value = e.message } finally { loading.value = false } }
const accept = async () => { busy.value = true; error.value = ''; try { await api('/accept', { name: name.value, accepted: accepted.value }); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const confirmCompletion = async appointmentId => { if (!window.confirm('Confirm that you personally received this service?')) return; busy.value = true; try { await api('/transition', { action: 'customer_complete', ...(typeof appointmentId === 'string' ? { appointmentId } : {}) }); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const confirmSession = async session => { busy.value = true; try { await api(`/sessions/${encodeURIComponent(session.id)}/confirm`, {}); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
const requestSession = async session => {
  const date = window.prompt('Preferred session date (YYYY-MM-DD):', session.date || ''); if (!date) return
  const time = window.prompt('Preferred time (HH:MM):', session.time || ''); if (!time) return
  const reason = window.prompt('Reason for requesting this schedule:'); if (!reason) return
  busy.value = true
  try { await api(`/sessions/${encodeURIComponent(session.id)}/request-schedule`, { date, time, reason }); await load() } catch (e) { error.value = e.message } finally { busy.value = false }
}
const requestChange = async () => { busy.value = true; error.value = ''; try { await api('/request', { type: changeType.value, date: changeDate.value, time: changeTime.value, reason: changeReason.value }); await load() } catch (e) { error.value = e.message } finally { busy.value = false } }
onMounted(load)
</script>
