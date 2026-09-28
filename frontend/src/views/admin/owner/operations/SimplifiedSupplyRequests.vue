<template>
  <div class="module-theme flex min-h-screen bg-slate-900 text-slate-100">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div class="mx-auto max-w-6xl">
      <header class="border-b border-slate-700/80 pb-5">
        <p class="text-xs font-bold tracking-[0.16em] text-amber-400">{{ mode.toUpperCase() }} MANAGEMENT</p>
        <h1 class="mt-1 text-2xl font-bold text-white sm:text-3xl">{{ title }}</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{{ intro }}</p>
      </header>
      <p v-if="error" class="mt-5 rounded-xl border border-red-500/70 bg-red-950/40 p-4 text-sm text-red-100">{{ error }}</p>

      <section v-if="mode === 'inventory'" class="mt-6 rounded-2xl border border-slate-700 bg-slate-800/80 shadow-xl shadow-slate-950/20">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700 px-5 py-5 sm:px-6">
          <div><p class="text-xs font-bold tracking-[0.14em] text-amber-400">NEW REQUEST</p><h2 class="mt-1 text-lg font-semibold text-white">Request clinic supplies</h2><p class="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Describe the supply your clinic needs. Procurement will select the supplier and the matching catalog item before preparing the purchase order.</p></div>
          <span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">Inventory starts the request</span>
        </div>
          <form class="p-5 sm:p-6" @submit.prevent="createRequest">
            <p v-if="!requestBranchId" class="mb-5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">Your assigned clinic branch is still loading. Wait a moment before sending this request.</p>
          <div class="grid gap-5 md:grid-cols-2">
            <label class="form-field"><span>Supply or item name <b>*</b></span><input v-model.trim="draft.name" placeholder="e.g. Surgical gloves" required /><small>Use a general item description. It does not need to match a supplier's exact product name.</small></label>
            <label class="form-field"><span>Category <b>*</b></span><input v-model.trim="draft.category" placeholder="e.g. Medical supplies" required /><small>Group similar supplies to make the request easier to review.</small></label>
            <label class="form-field"><span>Quantity requested <b>*</b></span><input v-model.number="draft.quantity" type="number" min="1" required /><small>Enter the amount of supply the clinic needs.</small></label>
            <label class="form-field"><span>Unit of measure <b>*</b></span><select v-model="draft.unit" required><option value="units">Units</option><option value="boxes">Boxes</option><option value="packs">Packs</option><option value="bottles">Bottles</option><option value="pairs">Pairs</option><option value="pieces">Pieces</option><option value="rolls">Rolls</option><option value="tubes">Tubes</option><option value="grams">Grams</option><option value="kilograms">Kilograms</option><option value="milliliters">Milliliters</option><option value="liters">Liters</option></select><small>Choose how the requested quantity is measured.</small></label>
            <label class="form-field"><span>Required by <b>*</b></span><input v-model="draft.requiredDate" type="date" required /><small>Choose the date when this supply is needed.</small></label>
            <section class="delivery-location-panel md:col-span-2"><div><p class="form-field-label">Delivery location <b>*</b></p><p class="mt-1 text-sm text-slate-400">Choose the clinic branch that should receive the supplies. Its registered map pin and address are used automatically.</p></div><label class="form-field mt-4"><span>Clinic branch <b>*</b></span><select v-model="selectedDeliveryBranchId" required><option value="" disabled>Select delivery branch</option><option v-for="branch in data.branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option></select></label><LocationPicker v-if="branchCoordinates" class="mt-4" :initial-address="branchAddress" :initial-lat="activeBranch.latitude" :initial-lng="activeBranch.longitude" map-height="220px" theme="dark" readonly :show-actions="false" pinned-address-label="Pinned branch location" /><div v-else class="mt-4 rounded-xl border border-amber-600/50 bg-amber-950/20 p-4 text-sm text-amber-100">This branch does not have a map pin yet. Ask the clinic owner to set the branch location in Clinic Profile.</div><div class="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4"><p class="text-xs font-bold uppercase tracking-[.12em] text-amber-300">Full address</p><p class="mt-1 text-sm leading-6 text-slate-100">{{ branchAddress || 'No registered branch address.' }}</p></div></section>
            <label class="form-field"><span>Priority <b>*</b></span><select v-model="draft.priority" required><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select><small>Use urgent only when operations would be affected without the supply.</small></label>
            <label class="form-field md:col-span-2"><span>Reason for request <b>*</b></span><textarea v-model.trim="draft.reason" placeholder="Explain why this supply is needed and how it will be used." required /><small>This helps Procurement and Finance assess the request.</small></label>
          </div>
          <div class="mt-6 flex flex-col gap-4 border-t border-slate-700 pt-5 sm:flex-row sm:items-center sm:justify-between"><p class="max-w-2xl text-sm leading-6 text-slate-400"><span class="font-semibold text-slate-200">Next step:</span> Procurement will be notified to choose a supplier and catalog item for this request.</p><button class="rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60" :disabled="busy || !requestBranchId">{{ busy ? 'Sending request…' : 'Send to Procurement' }}</button></div>
        </form>
      </section>

      <section class="mt-6">
        <div class="mb-4"><h2 class="text-lg font-semibold text-white">{{ mode === 'inventory' ? 'Your requests' : mode === 'procurement' ? 'Procurement requests' : 'Records requiring action' }}</h2><p class="mt-1 text-sm text-slate-400">{{ mode === 'inventory' ? 'Track the requests you have sent to Procurement.' : mode === 'procurement' ? 'Open a request to review its inventory details and complete supplier matching.' : 'Review the information below and complete the next workflow step.' }}</p></div>
        <div v-if="mode === 'procurement'" class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-slate-700 bg-slate-900/70 text-xs font-bold uppercase tracking-[.1em] text-slate-300"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Requested supplies</th><th class="px-4 py-3">Priority</th><th class="px-4 py-3">Required by</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Action</th></tr></thead>
              <tbody class="divide-y divide-slate-700"><tr v-for="record in procurementRecords" :key="record.id" class="transition hover:bg-slate-700/40"><td class="whitespace-nowrap px-4 py-4 font-semibold text-white">{{ record.number }}</td><td class="px-4 py-4 text-slate-300">{{ requestLines(record).map(line => `${line.name} × ${line.quantity} ${line.unit || 'units'}`).join(', ') || '—' }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'priority') }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'requiredDate') }}</td><td class="whitespace-nowrap px-4 py-4"><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ record.status }}</span></td><td class="whitespace-nowrap px-4 py-4 text-right"><button class="rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500 hover:text-slate-950" @click="openProcurementDetails(record)">Details</button></td></tr></tbody>
            </table>
          </div>
          <p v-if="!procurementRecords.length" class="px-5 py-8 text-center text-sm text-slate-400">No procurement requests currently need your action.</p>
        </div>
        <div v-if="mode !== 'procurement'" class="space-y-3">
        <article v-for="record in records" :key="record.id" class="rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-semibold">{{ record.number }}</h2>
              <p class="text-sm text-slate-400">{{ record.lines?.map(line => `${line.name} × ${line.quantity}`).join(', ') }}</p>
            </div>
            <span class="rounded-full bg-slate-700 px-3 py-1 text-xs">{{ record.status }}</span>
          </div>

          <div v-if="mode === 'procurement' && record.kind === 'procurement' && record.status === 'Received'" class="mt-4 space-y-3">
            <label class="form-field">Supplier business <b>*</b>
              <select v-model="supplierByRecord[record.id]" class="mt-1 w-full" @change="ensureSelectionMap(record.id)">
                <option value="">Choose supplier business</option>
                <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name || supplier.businessName }}</option>
              </select>
            </label>
            <div v-for="line in record.lines" :key="line.itemId" class="rounded-lg border border-slate-700 p-3">
              <p class="text-sm font-medium">Match “{{ line.name }}” ({{ line.quantity }} {{ line.unit || 'units' }})</p>
              <label class="form-field mt-3">Matching supplier catalog item <b>*</b>
                <select v-model="catalogSelectionsByRecord[record.id][line.itemId]" class="mt-1 w-full" :disabled="!supplierByRecord[record.id]">
                  <option value="">Choose the matching catalog item</option>
                  <option v-for="item in catalogItems(record.id)" :key="item.id" :value="item.id">{{ catalogLabel(item) }}</option>
                </select>
              </label>
              <p v-if="supplierByRecord[record.id] && !catalogItems(record.id).length" class="mt-2 text-xs text-amber-300">This supplier has no active catalog items to match. Select another supplier.</p>
            </div>
            <button class="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60" :disabled="!readyForFinance(record) || busy" @click="sendForApproval(record)">Send to Finance for approval</button>
          </div>

          <div v-if="mode === 'finance' && record.kind === 'po' && record.status === 'For Finance Approval'" class="mt-4 flex flex-wrap items-end gap-3">
            <label class="form-field min-w-64 flex-1">Inventory budget <b>*</b><select v-model="budgetByRecord[record.id]"><option value="">Choose an approved inventory budget</option><option v-for="budget in budgets" :key="budget.id" :value="budget.id">{{ budget.category }}</option></select></label>
            <button class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold disabled:opacity-60" :disabled="!budgetByRecord[record.id] || busy" @click="approve(record)">Approve purchase order</button>
          </div>
          <button v-if="mode === 'finance' && record.kind === 'po' && record.status === 'Approved'" class="mt-4 rounded bg-amber-500 px-3 py-2 font-semibold text-slate-950" @click="action(record, 'issue')">Send purchase order to supplier</button>
        </article>
        <p v-if="!records.length" class="rounded-xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-400">No records currently need your action.</p>
        </div>
      </section>
      </div>
    </main>
    <Modal :is-open="Boolean(selectedProcurementRecord)" panel-class="procurement-modal-panel" body-class="procurement-modal-body" @close="closeProcurementDetails">
      <template #header><div><p class="text-xs font-bold tracking-[.14em] text-amber-300">PROCUREMENT REQUEST</p><h2 class="mt-1 text-xl font-bold text-white">{{ selectedProcurementRecord?.number }}</h2></div></template>
      <template #body>
        <div v-if="selectedProcurementRecord" class="space-y-5">
          <section class="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-semibold text-white">Inventory request details</h3><p class="mt-1 text-sm text-slate-400">The original supply request sent by Inventory.</p></div><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ relatedInventoryRequest(selectedProcurementRecord)?.number || 'Linked request' }}</span></div><dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt>Requested supplies</dt><dd>{{ requestLines(selectedProcurementRecord).map(line => `${line.name} × ${line.quantity} ${line.unit || 'units'}`).join(', ') || '—' }}</dd></div><div><dt>Category</dt><dd>{{ requestValue(selectedProcurementRecord, 'category') }}</dd></div><div><dt>Priority</dt><dd>{{ requestValue(selectedProcurementRecord, 'priority') }}</dd></div><div><dt>Required by</dt><dd>{{ requestValue(selectedProcurementRecord, 'requiredDate') }}</dd></div><div class="sm:col-span-2"><dt>Delivery location</dt><dd>{{ requestValue(selectedProcurementRecord, 'location') }}</dd></div><div class="sm:col-span-2"><dt>Reason for request</dt><dd>{{ requestValue(selectedProcurementRecord, 'reason') }}</dd></div></dl></section>
          <section v-if="selectedProcurementRecord.status === 'Received'" class="space-y-4 rounded-xl border border-amber-500/35 bg-amber-950/15 p-4"><div><h3 class="font-semibold text-white">Supplier and catalog matching</h3><p class="mt-1 text-sm text-slate-400">Select the supplier, then match each requested supply to its catalog item.</p></div><label class="form-field">Supplier business <b>*</b><select v-model="supplierByRecord[selectedProcurementRecord.id]" class="mt-1 w-full" @change="ensureSelectionMap(selectedProcurementRecord.id)"><option value="">Choose supplier business</option><option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name || supplier.businessName }}</option></select></label><div v-for="line in selectedProcurementRecord.lines" :key="line.itemId" class="rounded-lg border border-slate-700 bg-slate-900/60 p-3"><p class="text-sm font-medium text-white">Match “{{ line.name }}” ({{ line.quantity }} {{ line.unit || 'units' }})</p><label class="form-field mt-3">Matching supplier catalog item <b>*</b><select v-model="catalogSelectionsByRecord[selectedProcurementRecord.id][line.itemId]" class="mt-1 w-full" :disabled="!supplierByRecord[selectedProcurementRecord.id]"><option value="">Choose the matching catalog item</option><option v-for="item in catalogItems(selectedProcurementRecord.id)" :key="item.id" :value="item.id">{{ catalogLabel(item) }}</option></select></label><p v-if="supplierByRecord[selectedProcurementRecord.id] && !catalogItems(selectedProcurementRecord.id).length" class="mt-2 text-xs text-amber-300">This supplier has no active catalog items to match. Select another supplier.</p></div><button class="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-60" :disabled="!readyForFinance(selectedProcurementRecord) || busy" @click="sendForApproval(selectedProcurementRecord)">Send to Finance for approval</button></section>
          <p v-else class="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">This request has already been sent to the next workflow step and can no longer be edited here.</p>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import LocationPicker from '@/components/common/LocationPicker.vue'
import Modal from '@/components/common/Modal.vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { toast } from 'vue3-toastify'

const route = useRoute()
const data = ref({ records: [], suppliers: [], branches: [] })
const busy = ref(false)
const error = ref('')
const supplierByRecord = ref({})
const catalogSelectionsByRecord = ref({})
const budgetByRecord = ref({})
const selectedDeliveryBranchId = ref('')
const selectedProcurementRecord = ref(null)
const mode = computed(() => route.path.startsWith('/inventory') ? 'inventory' : route.path.startsWith('/procurement') ? 'procurement' : 'finance')
const title = computed(() => mode.value === 'inventory' ? 'Inventory Requests' : mode.value === 'procurement' ? 'Procurement Requests' : 'Purchase Order Approvals')
const intro = computed(() => mode.value === 'inventory' ? 'Create and track supply needs for your clinic. Procurement selects the supplier and matching catalog items.' : mode.value === 'procurement' ? 'Choose a supplier, match every request to a catalog item, and prepare the purchase order.' : 'Review and approve purchase orders prepared by Procurement.')
const branchId = computed(() => data.value.branchId || data.value.branches?.[0]?.id || '')
const activeBranch = computed(() => data.value.branches.find(branch => branch.id === selectedDeliveryBranchId.value) || {})
const requestBranchId = computed(() => String(activeBranch.value?.id || '').trim())
const branchAddress = computed(() => String(activeBranch.value.address || activeBranch.value.name || '').trim())
const branchCoordinates = computed(() => Number.isFinite(Number(activeBranch.value.latitude)) && Number.isFinite(Number(activeBranch.value.longitude)) && Number(activeBranch.value.latitude) !== 0 && Number(activeBranch.value.longitude) !== 0)
const suppliers = computed(() => data.value.suppliers.filter(supplier => supplier.status === 'Active'))
const budgets = computed(() => data.value.records.filter(record => record.kind === 'budget' && record.status === 'Active'))
const records = computed(() => data.value.records.filter(record => mode.value === 'inventory' ? record.kind === 'request' : mode.value === 'procurement' ? ['procurement', 'po'].includes(record.kind) : record.kind === 'po'))
const procurementRecords = computed(() => records.value.filter(record => record.kind === 'procurement'))
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
    if (!selectedDeliveryBranchId.value || !data.value.branches.some(branch => branch.id === selectedDeliveryBranchId.value)) selectedDeliveryBranchId.value = data.value.branches.find(branch => branch.id === data.value.branchId)?.id || data.value.branches[0]?.id || ''
    data.value.records.filter(record => record.kind === 'procurement').forEach(record => {
      if (!catalogSelectionsByRecord.value[record.id]) catalogSelectionsByRecord.value[record.id] = {}
    })
  } catch (caught) { error.value = caught.message }
}
const draft = ref({ name: '', category: '', quantity: 1, unit: 'units', requiredDate: new Date().toISOString().slice(0, 10), location: 'Clinic branch', reason: '', priority: 'Normal' })
const createRequest = async () => {
  if (!requestBranchId.value) {
    error.value = 'Your assigned clinic branch is unavailable. Refresh the page and try again.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const requestDraft = { ...draft.value, location: branchAddress.value }
    await api('/records', { kind: 'request', branchId: requestBranchId.value, department: 'Inventory', lines: [requestDraft], ...requestDraft })
    draft.value = { ...draft.value, name: '', category: '', quantity: 1, reason: '' }
    await load()
    toast.success('Inventory request sent to Procurement.')
  } catch (caught) {
    error.value = caught.message === 'Invalid record identifier.' ? 'Your assigned clinic branch could not be identified. Refresh the page and try again.' : caught.message
    toast.error(error.value)
  } finally { busy.value = false }
}
const ensureSelectionMap = recordId => { if (!catalogSelectionsByRecord.value[recordId]) catalogSelectionsByRecord.value[recordId] = {} }
const relatedInventoryRequest = record => data.value.records.find(candidate => candidate.kind === 'request' && (candidate.id === record?.requestId || candidate.links?.includes(record?.id) || record?.links?.includes(candidate.id))) || null
const requestSource = record => relatedInventoryRequest(record) || record
const requestLines = record => requestSource(record)?.lines?.length ? requestSource(record).lines : record?.lines || []
const requestValue = (record, key) => requestSource(record)?.[key] || record?.[key] || '—'
const openProcurementDetails = record => { ensureSelectionMap(record.id); selectedProcurementRecord.value = record }
const closeProcurementDetails = () => { selectedProcurementRecord.value = null }
const catalogItems = recordId => suppliers.value.find(item => item.id === supplierByRecord.value[recordId])?.offeredItems || []
const catalogLabel = item => `${item.name || item.itemName || item.productName || 'Unnamed item'}${item.measurementUnit || item.unit ? ` · ${item.measurementUnit || item.unit}` : ''}${item.price != null ? ` · PHP ${Number(item.price).toLocaleString()}` : ''}`
const readyForFinance = record => Boolean(supplierByRecord.value[record.id]) && record.lines?.every(line => catalogSelectionsByRecord.value[record.id]?.[line.itemId])
const actionSuccessMessage = actionName => ({
  confirm: 'Purchase order sent to Finance for approval.',
  approve: 'Purchase order approved. Finance can now send it to the supplier.',
  issue: 'Purchase order sent to the supplier.',
}[actionName] || 'Supply workflow updated.')
const action = async (record, actionName, extra = {}) => {
  busy.value = true
  error.value = ''
  try {
    await api(`/records/${record.id}/actions`, { action: actionName, ...extra })
    await load()
    toast.success(actionSuccessMessage(actionName))
  } catch (caught) {
    error.value = caught.message
    toast.error(error.value)
  } finally { busy.value = false }
}
const sendForApproval = async record => {
  await action(record, 'confirm', { supplierId: supplierByRecord.value[record.id], catalogSelections: catalogSelectionsByRecord.value[record.id], productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true })
  if (!error.value) closeProcurementDetails()
}
const approve = record => action(record, 'approve', { budgetId: budgetByRecord.value[record.id], approvedAmount: record.requestedAmount / 100, remarks: 'Approved' })
onMounted(load)
</script>

<style scoped>
.form-field { display: flex; flex-direction: column; gap: .42rem; color: rgb(226 232 240); font-size: .875rem; font-weight: 600; }
.form-field b { color: rgb(251 191 36); }
.form-field-label { color: rgb(226 232 240); font-size: .875rem; font-weight: 600; }
.form-field small { color: rgb(148 163 184); font-size: .75rem; font-weight: 400; line-height: 1.25rem; }
.delivery-location-panel { border: 1px solid rgb(71 85 105); border-radius: .75rem; background: rgb(15 23 42 / .5); padding: 1rem; }
input, select, textarea { width: 100%; border: 1px solid rgb(71 85 105); border-radius: .5rem; background: rgb(15 23 42); padding: .7rem .8rem; color: white; font-weight: 400; }
input:focus, select:focus, textarea:focus { border-color: rgb(245 158 11); box-shadow: 0 0 0 3px rgb(245 158 11 / .15); outline: none; }
textarea { min-height: 6.5rem; resize: vertical; }
select:disabled { cursor: not-allowed; opacity: .55; }
:global(.procurement-modal-body) dt { color: rgb(148 163 184); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
:global(.procurement-modal-body) dd { margin-top: .3rem; color: rgb(241 245 249); line-height: 1.45; }
:global(.procurement-modal-panel) { border-color: rgb(180 83 9 / .7) !important; background: rgb(36 22 15) !important; color: rgb(241 245 249); }
:global(.procurement-modal-body) { background: rgb(36 22 15) !important; }
</style>
