<template><div class="flex module-theme min-h-screen bg-slate-900 text-white"><OwnerSidebar/><main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="flex-1 p-6"><div class="mx-auto max-w-5xl"><h1 class="text-3xl font-bold">Treatment Sessions</h1><p class="mt-2 text-slate-400">Only the first visit is booked initially. Confirm each later visit after the previous one is completed or resolved.</p><p v-if="error" class="mt-4 rounded-lg bg-rose-950 p-3 text-rose-200">{{ error }}</p><section class="mt-6 overflow-x-auto rounded-xl border border-slate-700"><table class="w-full text-left text-sm"><thead class="bg-slate-800 text-slate-300"><tr><th class="p-3">Session</th><th class="p-3">Customer</th><th class="p-3">Schedule</th><th class="p-3">Status</th><th class="p-3"></th></tr></thead><tbody><tr v-for="s in sessions" :key="s.id" class="border-t border-slate-700"><td class="p-3">{{ s.sessionNumber }} / {{ s.totalSessions }}</td><td class="p-3">{{ s.customerName || 'Customer' }}</td><td class="p-3">{{ s.date ? `${s.date} ${s.time || ''}` : s.requestedDate ? `Requested: ${s.requestedDate} ${s.requestedTime || ''}` : 'Not scheduled' }}</td><td class="p-3">{{ s.status }}</td><td class="p-3"><button v-if="canSchedule(s)" class="btn" @click="openSchedule(s)">{{ String(s.status).includes('Requested') ? 'Review request' : 'Schedule' }}</button><router-link v-if="s.appointmentId && s.status==='Scheduled'" class="btn" to="/clinical/appointments">Open practitioner queue</router-link><span v-if="s.status==='Schedule Proposed'" class="text-sm text-amber-300">Awaiting customer confirmation</span><button v-if="s.status==='Scheduled'" class="ml-2 rounded bg-rose-700 px-3 py-2" @click="noShow(s)">No-show</button><button class="ml-2 rounded border border-slate-500 px-3 py-2" @click="showHistory(s)">History</button></td></tr><tr v-if="!sessions.length"><td colspan="5" class="p-8 text-center text-slate-400">No multi-session treatments for this branch.</td></tr></tbody></table></section><section v-if="historySession" class="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-5"><div class="flex justify-between"><h2 class="font-semibold">Session {{ historySession.sessionNumber }} history</h2><button @click="historySession=null">Close</button></div><p v-if="!history.length" class="mt-3 text-slate-400">No recorded changes yet.</p><ol v-else class="mt-3 space-y-3"><li v-for="entry in history" :key="entry.id" class="rounded-lg bg-slate-900 p-3"><strong>{{ entry.action }}</strong> · {{ entry.previousStatus || 'New' }} → {{ entry.nextStatus }}<span v-if="entry.date"> · {{ entry.date }} {{ entry.time }}</span><small class="block mt-1 text-slate-400">{{ entry.actorName || entry.actorId }} · {{ formatDate(entry.createdAt) }}</small></li></ol></section><form v-if="target" class="fixed inset-0 grid place-items-center bg-black/70 p-4" @submit.prevent="schedule"><section class="w-full max-w-sm rounded-xl bg-slate-800 p-5"><h2 class="text-lg font-semibold">{{ String(target.status).includes('Requested') ? 'Review requested time' : 'Schedule' }} session {{ target.sessionNumber }}</h2><p v-if="target.requestedDate" class="mt-2 text-sm text-slate-300">Customer requested {{ target.requestedDate }} at {{ target.requestedTime }}. You may confirm it or choose another available time.</p><ContractAppearanceSelect id="session-lead-practitioner" label="Lead practitioner" v-model="practitionerId" :options="practitioners.map(person => ({ value: person.id, label: person.fullName + (person.practitionerType ? ' (' + person.practitionerType + ')' : '') }))" /><label class="block mt-4">Date<input v-model="date" type="date" required class="field"/></label><label class="block mt-3">Time<input v-model="time" type="time" required class="field"/></label><div class="mt-5 flex justify-end gap-2"><button type="button" @click="target=null">Cancel</button><button class="btn">Confirm schedule</button></div></section></form></div></main></div></template>
<script setup>
import { usePageLoading } from '@/composables/usePageLoading'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { useRoute } from 'vue-router'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
const route = useRoute()

import { onMounted, ref } from 'vue'; import { auth, db } from '@/config/firebaseConfig'; import { doc,getDoc } from 'firebase/firestore'; import { OTP_API_BASE } from '@/utils/runtimeConfig'; import { toast } from 'vue3-toastify'; import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

const practitioners=ref([]),practitionerId=ref('');
const sessions=ref([]),error=ref(''),target=ref(null),date=ref(''),time=ref(''),history=ref([]),historySession=ref(null); let branchId=''
const api=async(path,body)=>{const token=await auth.currentUser.getIdToken();const r=await fetch(OTP_API_BASE+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const p=await r.json();if(!r.ok||!p.success)throw new Error(p.error||'Request failed');return p.data}
const load=trackPageLoad(async()=>{try{error.value='';const scope=await loadOwnerBranchScope(db,auth.currentUser.uid);branchId=scope.branchIds.includes(String(route.query.branch||''))?String(route.query.branch):scope.branchId;if(!branchId)throw new Error('No clinic branch is linked to your account.');sessions.value=await api(`/treatment-sessions?branchId=${encodeURIComponent(branchId)}`)}catch(e){error.value=e.message}})
const canSchedule=s=>['Unscheduled','Reschedule eligible','Schedule Requested','Reschedule Requested'].includes(s.status);const openSchedule=async s=>{target.value=s;date.value=s.requestedDate||'';time.value=s.requestedTime||'';practitionerId.value=s.practitionerId||'';try{const token=await auth.currentUser.getIdToken();const response=await fetch(OTP_API_BASE+'/public/clinics/'+encodeURIComponent(branchId)+'/practitioners',{headers:{Authorization:'Bearer '+token}});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load practitioners.');practitioners.value=payload.practitioners||[]}catch(cause){toast.error(cause.message)}};const schedule=async()=>{try{await api(`/treatment-sessions/${target.value.id}/schedule`,{date:date.value,time:time.value,practitionerId:practitionerId.value});toast.success('Schedule proposed. The customer must confirm it.');target.value=null;load()}catch(e){toast.error(e.message)}};const complete=async s=>{try{await api(`/treatment-sessions/${s.id}/complete`,{});toast.success('Session completed.');load()}catch(e){toast.error(e.message)}};const noShow=async s=>{if(!confirm('Mark this session as a no-show?'))return;try{const data=await api(`/treatment-sessions/${s.id}/no-show`,{});toast.success(`Session marked ${data.status}.`);load()}catch(e){toast.error(e.message)}};const showHistory=async s=>{try{historySession.value=s;history.value=await api(`/treatment-sessions/${s.id}/audit`)}catch(e){toast.error(e.message)}};const formatDate=v=>{if(!v)return'Just now';if(v?.toDate)return v.toDate().toLocaleString();const seconds=Number(v?._seconds??v?.seconds);return Number.isFinite(seconds)?new Date(seconds*1000).toLocaleString():new Date(v).toLocaleString()};onMounted(load)
</script>

<style scoped>
.field { display: block; width: 100%; margin-top: .35rem; border: 1px solid #475569; border-radius: .5rem; background: #0f172a; padding: .55rem; color: #fff; }
.btn { border-radius: .45rem; background: #b45309; padding: .45rem .75rem; color: #fff; }

@media (max-width: 767px) {
  main { min-width: 0; padding: 1rem !important; }
  h1 { font-size: 1.45rem; line-height: 1.2; }

  section.overflow-x-auto {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-inline: contain;
  }

  section.overflow-x-auto table { min-width: 34rem; }

  section.overflow-x-auto td:last-child { white-space: nowrap; }
  section.overflow-x-auto td:last-child .ml-2 { margin-left: .35rem; }

  section.mt-6.bg-slate-800 { padding: 1rem; }
  section.mt-6.bg-slate-800 > div { flex-direction: column; align-items: flex-start; gap: .75rem; }

  form.fixed { align-items: flex-start; overflow: auto; padding-top: 1rem; }
  form.fixed > section { max-height: calc(100dvh - 2rem); overflow: auto; }
  form.fixed > section > div { flex-wrap: wrap; }
}
</style>
