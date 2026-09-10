<template>
  <div class="flex min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-5xl">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div><h1 class="text-3xl font-bold">Commission Agreements</h1><p class="mt-2 text-slate-400">Define the commission terms that apply to product and service transactions.</p></div>
          <button class="rounded-xl bg-amber-600 px-4 py-2 font-semibold hover:bg-amber-500" @click="openNew">New Agreement</button>
        </div>
        <div class="mt-8 space-y-4">
          <article v-for="item in contracts" :key="item.id" class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <div class="flex flex-wrap justify-between gap-3"><div><h2 class="font-semibold">{{ item.title }}</h2><p class="text-sm text-slate-400">{{ item.terms }}</p></div><span class="rounded-full bg-emerald-900 px-3 py-1 text-xs text-emerald-200">{{ item.status }}</span></div>
            <div class="mt-4 flex flex-wrap gap-6 text-sm text-slate-300"><span>Commission: <b>{{ item.commissionPercent }}%</b></span><span>Effective: {{ item.effectiveFrom || '-' }}</span><span>Until: {{ item.effectiveUntil || 'No end date' }}</span></div>
          </article>
          <p v-if="!contracts.length" class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-500">No commission agreement has been created.</p>
        </div>
        <form v-if="showForm" class="mt-8 rounded-2xl border border-slate-700 bg-slate-800 p-6" @submit.prevent="saveContract">
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block"><span class="label">Agreement title</span><input v-model="form.title" required class="field" placeholder="Clinic product commission agreement" /></label>
            <label class="block"><span class="label">Commission percentage</span><input v-model.number="form.commissionPercent" required min="0" max="100" step="0.01" type="number" class="field" /></label>
            <label class="block"><span class="label">Effective from</span><input v-model="form.effectiveFrom" required type="date" class="field" /></label>
            <label class="block"><span class="label">Effective until</span><input v-model="form.effectiveUntil" type="date" class="field" /></label>
          </div>
          <label class="mt-4 block"><span class="label">Terms</span><textarea v-model="form.terms" required rows="5" class="field" placeholder="Describe the commission, settlement, and notice terms." /></label>
          <div class="mt-5 flex justify-end gap-3"><button type="button" class="rounded-xl border border-slate-600 px-4 py-2" @click="showForm = false">Cancel</button><button class="rounded-xl bg-amber-600 px-4 py-2 font-semibold">Save Agreement</button></div>
        </form>
      </div>
    </main>
  </div>
</template>
<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
const contracts = ref([]); const branchId = ref(''); const ownerId = ref(''); const showForm = ref(false); let stopListening = null
const form = reactive({ title: '', terms: '', commissionPercent: 0, effectiveFrom: '', effectiveUntil: '' })
const openNew = () => { Object.assign(form, { title: '', terms: '', commissionPercent: 0, effectiveFrom: '', effectiveUntil: '' }); showForm.value = true }
const saveContract = async () => {
  try {
    const now = { ...form, branchId: branchId.value, ownerId: ownerId.value, status: 'Active', createdBy: auth.currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    await addDoc(collection(db, 'commissionContracts'), now)
    await addDoc(collection(db, 'notifications'), { senderId: auth.currentUser.uid, recipientUserId: ownerId.value, recipientRole: 'Owner', type: 'commission_agreement', title: 'Commission agreement updated', message: `${form.title} is now active for your clinic.`, link: '/owner/commission-contracts', read: false, createdAt: serverTimestamp() })
    showForm.value = false; toast.success('Agreement saved and owner notification created.')
  } catch (error) { console.error(error); toast.error(error?.message || 'Could not save agreement.') }
}
onMounted(async () => { const uid = auth.currentUser?.uid; if (!uid) return; const user = await getDoc(doc(db, 'users', uid)); const data = user.data() || {}; ownerId.value = data.ownerId || uid; branchId.value = data.branchId || uid; stopListening = onSnapshot(query(collection(db, 'commissionContracts'), where('branchId', '==', branchId.value)), (snap) => { contracts.value = snap.docs.map((item) => ({ id: item.id, ...item.data() })) }) })
onUnmounted(() => stopListening?.())
</script>
<style scoped>
.label { display:block; margin-bottom:.5rem; color:#cbd5e1; font-size:.875rem }
.field { width:100%; border:1px solid #475569; border-radius:.75rem; background:#0f172a; color:white; padding:.75rem; outline:none }
.field:focus { border-color:#f59e0b }
</style>
