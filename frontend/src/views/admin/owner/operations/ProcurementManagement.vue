<template>
  <div class="flex min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-6xl">
        <h1 class="text-3xl font-bold">Procurement</h1>
        <p class="mt-2 text-slate-400">Manage supplier quotations, purchase orders, finance approval, and manual purchases in one workflow.</p>
        <div class="mt-6 flex flex-wrap gap-2 border-b border-slate-700 pb-3">
          <button v-for="tab in tabs" :key="tab" class="rounded-lg px-4 py-2 text-sm" :class="activeTab === tab ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'" @click="activeTab = tab">{{ tab }}</button>
          <button class="ml-auto rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600" @click="openForm">{{ activeTab === 'Manual Purchases' ? 'Record Purchase' : `New ${activeTab.slice(0, -1)}` }}</button>
        </div>
        <div class="mt-6 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800">
          <table class="w-full text-left text-sm"><thead class="bg-slate-700 text-xs uppercase text-slate-300"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Supplier</th><th class="px-4 py-3">Details</th><th class="px-4 py-3">Amount</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Action</th></tr></thead><tbody><tr v-for="item in visibleItems" :key="item.id" class="border-t border-slate-700"><td class="px-4 py-3 font-semibold">{{ item.reference || item.purchaseOrderNumber || item.id.slice(0, 8) }}</td><td class="px-4 py-3">{{ item.supplierName || item.vendorName || '-' }}</td><td class="max-w-xs px-4 py-3 text-slate-300">{{ item.details || item.itemName || item.description || '-' }}</td><td class="px-4 py-3">{{ formatMoney(item.amount || item.totalAmount || item.totalCost) }}</td><td class="px-4 py-3"><span class="rounded-full bg-slate-700 px-2 py-1 text-xs">{{ item.status || item.purchaseOrderStatus || 'Draft' }}</span></td><td class="px-4 py-3"><button v-if="canAdvance(item)" class="text-amber-300 hover:text-amber-200" @click="advance(item)">{{ actionLabel(item) }}</button></td></tr></tbody></table>
          <p v-if="!visibleItems.length" class="p-8 text-center text-slate-500">No records in this stage yet.</p>
        </div>
        <form v-if="showForm" class="mt-6 rounded-2xl border border-slate-700 bg-slate-800 p-6" @submit.prevent="createRecord">
          <h2 class="text-lg font-semibold">{{ activeTab === 'Manual Purchases' ? 'Record manual purchase' : `Create ${activeTab.slice(0, -1)}` }}</h2>
          <div class="mt-4 grid gap-4 md:grid-cols-2"><label><span class="label">Supplier/vendor</span><input v-model="form.supplierName" required class="field" /></label><label><span class="label">Amount</span><input v-model.number="form.amount" required min="0" type="number" step="0.01" class="field" /></label><label><span class="label">Reference</span><input v-model="form.reference" class="field" placeholder="RFQ-2026-001" /></label><label><span class="label">Date</span><input v-model="form.date" required type="date" class="field" /></label></div>
          <label class="mt-4 block"><span class="label">Details / line items</span><textarea v-model="form.details" required rows="4" class="field" placeholder="Item, quantity, unit, and quoted price" /></label>
          <div class="mt-5 flex justify-end gap-3"><button type="button" class="rounded-xl border border-slate-600 px-4 py-2" @click="showForm = false">Cancel</button><button class="rounded-xl bg-amber-600 px-4 py-2 font-semibold">Create Record</button></div>
        </form>
      </div>
    </main>
  </div>
</template>
<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
const tabs = ['Supplier Quotes', 'Purchase Orders', 'Manual Purchases']; const activeTab = ref(tabs[0]); const records = reactive({ 'Supplier Quotes': [], 'Purchase Orders': [], 'Manual Purchases': [] }); const branchId = ref(''); const showForm = ref(false); let stops = []
const form = reactive({ supplierName: '', amount: 0, reference: '', date: new Date().toISOString().slice(0, 10), details: '' })
const collectionForTab = (tab) => ({ 'Supplier Quotes': 'supplierQuotes', 'Purchase Orders': 'purchaseOrders', 'Manual Purchases': 'manualPurchases' })[tab]
const visibleItems = computed(() => records[activeTab.value] || [])
const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const openForm = () => { Object.assign(form, { supplierName: '', amount: 0, reference: '', date: new Date().toISOString().slice(0, 10), details: '' }); showForm.value = true }
const createRecord = async () => { try { const collectionName = collectionForTab(activeTab.value); const base = { ...form, branchId: branchId.value, createdBy: auth.currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }; if (activeTab.value === 'Supplier Quotes') base.status = 'Submitted'; if (activeTab.value === 'Purchase Orders') { base.status = 'Pending Finance'; base.purchaseOrderNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}` } if (activeTab.value === 'Manual Purchases') base.status = 'Recorded'; await addDoc(collection(db, collectionName), base); showForm.value = false; toast.success('Procurement record created.') } catch (error) { console.error(error); toast.error(error?.message || 'Could not create procurement record.') } }
const canAdvance = (item) => activeTab.value === 'Supplier Quotes' || (activeTab.value === 'Purchase Orders' && ['Pending Finance', 'Approved', 'Issued', 'Shipped'].includes(item.status))
const actionLabel = (item) => activeTab.value === 'Supplier Quotes' ? 'Accept quote' : item.status === 'Pending Finance' ? 'Approve' : item.status === 'Approved' ? 'Issue PO' : item.status === 'Issued' ? 'Mark shipped' : 'Mark received'
const advance = async (item) => { const next = activeTab.value === 'Supplier Quotes' ? 'Accepted' : ({ 'Pending Finance': 'Approved', Approved: 'Issued', Issued: 'Shipped', Shipped: 'Received' }[item.status] || item.status); try { await updateDoc(doc(db, collectionForTab(activeTab.value), item.id), { status: next, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid }); toast.success(`Record moved to ${next}.`) } catch (error) { toast.error(error?.message || 'Could not update record.') } }
onMounted(async () => { const uid = auth.currentUser?.uid; if (!uid) return; const snap = await getDoc(doc(db, 'users', uid)); branchId.value = snap.data()?.branchId || uid; Object.entries({ 'Supplier Quotes': 'supplierQuotes', 'Purchase Orders': 'purchaseOrders', 'Manual Purchases': 'manualPurchases' }).forEach(([tab, name]) => { stops.push(onSnapshot(query(collection(db, name), where('branchId', '==', branchId.value)), (result) => { records[tab] = result.docs.map((item) => ({ id: item.id, ...item.data() })) })) }) })
onUnmounted(() => stops.forEach((stop) => stop()))
</script>
<style scoped>
.label { display:block; margin-bottom:.5rem; color:#cbd5e1; font-size:.875rem }.field { width:100%; border:1px solid #475569; border-radius:.75rem; background:#0f172a; color:white; padding:.75rem; outline:none }.field:focus { border-color:#f59e0b }
</style>
