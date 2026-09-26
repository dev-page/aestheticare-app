<template>
  <div class="min-h-screen bg-slate-900 text-slate-100">
    <OwnerSidebar />
    <main class="ml-0 p-5 md:ml-64 md:p-8">
      <h1 class="text-2xl font-bold">{{ title }}</h1>
      <p class="mt-1 text-sm text-slate-400">{{ intro }}</p>
      <p v-if="error" class="mt-4 rounded border border-red-500 p-3 text-red-200">{{ error }}</p>

      <section v-if="mode === 'inventory'" class="mt-6 max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 class="font-semibold">New inventory request</h2>
        <p class="mt-1 text-sm text-slate-400">Describe what is needed. Procurement will select the supplier and exact catalog item.</p>
        <form class="mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="createRequest">
          <input v-model.trim="draft.name" placeholder="Supply name" required />
          <input v-model.trim="draft.category" placeholder="Category" required />
          <input v-model.number="draft.quantity" type="number" min="1" placeholder="Quantity" required />
          <input v-model="draft.requiredDate" type="date" required />
          <textarea v-model.trim="draft.reason" class="sm:col-span-2" placeholder="Reason for request" required />
          <button class="sm:col-span-2 rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60" :disabled="busy">Send to Procurement</button>
        </form>
      </section>

      <section class="mt-6 space-y-3">
        <article v-for="record in records" :key="record.id" class="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ record.number }}</h2>
              <p class="text-sm text-slate-400">{{ record.lines?.map(line => `${line.name} × ${line.quantity}`).join(', ') }}</p>
            </div>
            <span class="rounded-full bg-slate-700 px-3 py-1 text-xs">{{ record.status }}</span>
          </div>

          <div v-if="mode === 'procurement' && record.kind === 'procurement' && record.status === 'Received'" class="mt-4 space-y-3">
            <label class="block text-sm font-medium">Supplier
              <select v-model="supplierByRecord[record.id]" class="mt-1 w-full" @change="ensureSelectionMap(record.id)">
                <option value="">Select supplier</option>
                <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name || supplier.businessName }}</option>
              </select>
            </label>
            <div v-for="line in record.lines" :key="line.itemId" class="rounded-lg border border-slate-700 p-3">
              <p class="text-sm font-medium">Match “{{ line.name }}” ({{ line.quantity }} {{ line.unit || 'units' }})</p>
              <label class="mt-2 block text-xs text-slate-400">Supplier catalog item
                <select v-model="catalogSelectionsByRecord[record.id][line.itemId]" class="mt-1 w-full" :disabled="!supplierByRecord[record.id]">
                  <option value="">Select the matching item</option>
                  <option v-for="item in catalogItems(record.id)" :key="item.id" :value="item.id">{{ catalogLabel(item) }}</option>
                </select>
              </label>
              <p v-if="supplierByRecord[record.id] && !catalogItems(record.id).length" class="mt-2 text-xs text-amber-300">This supplier has no active catalog items to match. Select another supplier.</p>
            </div>
            <button class="rounded bg-amber-500 px-3 py-2 font-semibold text-slate-950 disabled:opacity-60" :disabled="!readyForFinance(record) || busy" @click="sendForApproval(record)">Send to Finance</button>
          </div>

          <div v-if="mode === 'finance' && record.kind === 'po' && record.status === 'For Finance Approval'" class="mt-4 flex flex-wrap gap-3">
            <select v-model="budgetByRecord[record.id]"><option value="">Select matching budget</option><option v-for="budget in budgets" :key="budget.id" :value="budget.id">{{ budget.category }}</option></select>
            <button class="rounded bg-emerald-600 px-3 py-2 font-semibold disabled:opacity-60" :disabled="!budgetByRecord[record.id] || busy" @click="approve(record)">Approve</button>
          </div>
          <button v-if="mode === 'finance' && record.kind === 'po' && record.status === 'Approved'" class="mt-4 rounded bg-amber-500 px-3 py-2 font-semibold text-slate-950" @click="action(record, 'issue')">Send purchase order to supplier</button>
        </article>
        <p v-if="!records.length" class="text-slate-400">No records currently need your action.</p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const route = useRoute()
const data = ref({ records: [], suppliers: [], branches: [] })
const busy = ref(false)
const error = ref('')
const supplierByRecord = ref({})
const catalogSelectionsByRecord = ref({})
const budgetByRecord = ref({})
const mode = computed(() => route.path.startsWith('/inventory') ? 'inventory' : route.path.startsWith('/procurement') ? 'procurement' : 'finance')
const title = computed(() => mode.value === 'inventory' ? 'Inventory Requests' : mode.value === 'procurement' ? 'Procurement Requests' : 'Purchase Order Approvals')
const intro = computed(() => mode.value === 'inventory' ? 'Request clinic supplies.' : mode.value === 'procurement' ? 'Choose a supplier, match every request to a catalog item, and prepare the purchase order.' : 'Review and approve purchase orders prepared by Procurement.')
const branchId = computed(() => data.value.branchId || data.value.branches?.[0]?.id || '')
const suppliers = computed(() => data.value.suppliers.filter(supplier => supplier.status === 'Active'))
const budgets = computed(() => data.value.records.filter(record => record.kind === 'budget' && record.status === 'Active'))
const records = computed(() => data.value.records.filter(record => mode.value === 'inventory' ? record.kind === 'request' : mode.value === 'procurement' ? ['procurement', 'po'].includes(record.kind) : record.kind === 'po'))
const api = async (path, body) => {
  const token = await auth.currentUser?.getIdToken()
  let lastError
  for (const base of OTP_BACKEND_CANDIDATES) {
    try {
      const response = await fetch(`${base}/supply${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      const json = await response.json()
      if (!response.ok) throw Error(json.error || 'Request failed.')
      return json.data
    } catch (caught) { lastError = caught }
  }
  throw lastError
}
const load = async () => {
  try {
    data.value = await api('/workspace')
    data.value.records.filter(record => record.kind === 'procurement').forEach(record => {
      if (!catalogSelectionsByRecord.value[record.id]) catalogSelectionsByRecord.value[record.id] = {}
    })
  } catch (caught) { error.value = caught.message }
}
const draft = ref({ name: '', category: '', quantity: 1, unit: 'units', requiredDate: new Date().toISOString().slice(0, 10), location: 'Clinic branch', reason: '', priority: 'Normal' })
const createRequest = async () => {
  busy.value = true
  try {
    await api('/records', { kind: 'request', branchId: branchId.value, department: 'Inventory', lines: [draft.value], ...draft.value })
    draft.value = { ...draft.value, name: '', category: '', quantity: 1, reason: '' }
    await load()
  } catch (caught) { error.value = caught.message } finally { busy.value = false }
}
const ensureSelectionMap = recordId => { if (!catalogSelectionsByRecord.value[recordId]) catalogSelectionsByRecord.value[recordId] = {} }
const catalogItems = recordId => suppliers.value.find(item => item.id === supplierByRecord.value[recordId])?.offeredItems || []
const catalogLabel = item => `${item.name || item.itemName || item.productName || 'Unnamed item'}${item.measurementUnit || item.unit ? ` · ${item.measurementUnit || item.unit}` : ''}${item.price != null ? ` · PHP ${Number(item.price).toLocaleString()}` : ''}`
const readyForFinance = record => Boolean(supplierByRecord.value[record.id]) && record.lines?.every(line => catalogSelectionsByRecord.value[record.id]?.[line.itemId])
const action = async (record, actionName, extra = {}) => {
  busy.value = true
  try { await api(`/records/${record.id}/actions`, { action: actionName, ...extra }); await load() } catch (caught) { error.value = caught.message } finally { busy.value = false }
}
const sendForApproval = record => action(record, 'confirm', { supplierId: supplierByRecord.value[record.id], catalogSelections: catalogSelectionsByRecord.value[record.id], productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true })
const approve = record => action(record, 'approve', { budgetId: budgetByRecord.value[record.id], approvedAmount: record.requestedAmount / 100, remarks: 'Approved' })
onMounted(load)
</script>

<style scoped>
input, select, textarea { border: 1px solid rgb(71 85 105); border-radius: .5rem; background: rgb(15 23 42); padding: .65rem .75rem; color: white; }
textarea { min-height: 5rem; }
select:disabled { cursor: not-allowed; opacity: .55; }
</style>
