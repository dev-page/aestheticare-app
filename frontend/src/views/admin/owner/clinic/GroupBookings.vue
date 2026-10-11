<template><div class="flex module-theme min-h-screen bg-slate-900 text-white"><OwnerSidebar/><main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="flex-1 p-6"><div class="mx-auto max-w-6xl"><h1 class="text-3xl font-bold">Group Bookings</h1><p class="mt-2 text-slate-400">Assign every recipient to a practitioner and individual slot.</p><p v-if="error" class="mt-4 rounded bg-rose-950 p-3 text-rose-200">{{ error }}</p><section v-for="group in groups" :key="group.id" class="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-5"><h2 class="font-semibold">{{ group.organizerName || 'Organizer' }}’s group · {{ group.participantCount }} recipients</h2><p class="mt-1 text-sm text-slate-400">Payment: {{ group.paymentStatus || 'Pending' }} · Total: ₱{{ Number(group.totalAmount||0).toFixed(2) }}</p><div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="text-slate-400"><tr><th class="p-2">Recipient</th><th class="p-2">Consent</th><th class="p-2">Practitioner</th><th class="p-2">Schedule</th><th class="p-2"></th></tr></thead><tbody><tr v-for="item in recipients(group)" :key="item.id" class="border-t border-slate-700"><td class="p-2">{{ item.clientName }}<small class="mt-1 block text-slate-400">{{ item.service }} · {{ item.status }}</small></td><td class="p-2">{{ item.consent?.status || 'Pending' }}</td><td class="p-2"><select v-model="draft(item).practitionerId" class="field"><option value="">Select practitioner</option><option v-for="person in practitionersFor(group)" :key="person.id" :value="person.id">{{ person.fullName || person.email }}</option></select></td><td class="p-2"><input v-model="draft(item).date" type="date" class="field"><input v-model="draft(item).time" type="time" class="field mt-1"></td><td class="p-2"><button class="btn" :disabled="saving===item.id" @click="assign(group,item)">{{ saving===item.id?'Saving…':'Assign' }}</button></td></tr></tbody></table></div></section><p v-if="!pageLoading && !error && !groups.length" class="mt-6 text-slate-400">No group bookings for your clinic branches.</p></div></main></div></template>
<script setup>
import { onMounted, ref } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'

const { pageLoading, trackPageLoad } = usePageLoading()
const groups = ref([])
const appointments = ref([])
const practitioners = ref([])
const error = ref('')
const saving = ref('')
const drafts = ref({})
const recipients = group => appointments.value.filter(item => item.groupBookingId === group.id && item.isGroupRecipient)
const practitionersFor = group => practitioners.value.filter(person => person.branchId === group.branchId)
const draft = item => drafts.value[item.id] || (drafts.value[item.id] = {
  practitionerId: item.practitionerId || '', date: item.date || '', time: item.time || '',
})

const readBranch = async branchId => {
  // Firestore rules require each query to identify an authorized branch.
  const read = async name => {
    const snapshot = await getDocs(query(collection(db, name), where('branchId', '==', branchId)))
    return snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
  }
  const [groupRows, appointmentRows, staffRows] = await Promise.all([
    read('groupBookings'), read('appointments'), read('users'),
  ])
  return { groups: groupRows, appointments: appointmentRows, practitioners: staffRows }
}

const load = trackPageLoad(async () => {
  error.value = ''
  groups.value = []
  appointments.value = []
  practitioners.value = []
  try {
    const user = auth.currentUser
    if (!user) throw new Error('Sign in to view group bookings.')
    const scope = await loadOwnerBranchScope(db, user.uid)
    const branchIds = [...new Set(scope.branchIds.filter(Boolean))]
    if (!branchIds.length) throw new Error('No clinic branch is linked to your account.')
    const rows = await Promise.all(branchIds.map(readBranch))
    const unique = records => [...new Map(records.map(item => [item.id, item])).values()]
    groups.value = unique(rows.flatMap(row => row.groups))
    appointments.value = unique(rows.flatMap(row => row.appointments))
    practitioners.value = unique(rows.flatMap(row => row.practitioners)).filter(person =>
      person.archived !== true && !['inactive', 'disabled', 'archived'].includes(String(person.status || '').trim().toLowerCase()))
  } catch (cause) {
    console.error('Failed to load group bookings:', cause)
    error.value = cause.code === 'permission-denied'
      ? 'Group booking access was denied. Check your branch access and the deployed appointment permissions.'
      : cause.message || 'Unable to load group bookings.'
  }
})

const assign = async (group, item) => {
  const values = draft(item)
  if (!values.practitionerId || !values.date || !values.time) return toast.error('Choose a practitioner, date, and time.')
  saving.value = item.id
  try {
    const token = await auth.currentUser.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/group-bookings/${group.id}/recipients/${item.id}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(values),
    })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to assign recipient.')
    toast.success('Recipient assigned.')
    await load()
  } catch (cause) {
    toast.error(cause.message)
  } finally {
    saving.value = ''
  }
}
onMounted(load)
</script>
<style scoped>.field{width:100%;border:1px solid var(--ac-border);border-radius:.4rem;background:var(--ac-surface);padding:.45rem;color:var(--ac-text)}.btn{border-radius:.4rem;background:var(--ac-primary);padding:.45rem .7rem;color:#fff}.btn:disabled{opacity:.6}</style>
