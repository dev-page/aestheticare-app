<template>
  <div class="pos-shell owner-theme">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'form', fields: 5 }" class="pos-main">
      <div class="pos-content">
        <header class="page-heading">
          <div><p class="eyebrow">Clinic pharmacy</p><h1>Pharmacy POS</h1><p class="subtitle">Sell available pharmacy items, collect in-person payment, and keep inventory and sales records in sync.</p></div>
          <label v-if="branches.length > 1" class="branch-filter">Clinic branch<select v-model="branchId" @change="switchBranch"><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option></select></label>
        </header>
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <section v-if="appointmentId" class="notice prescription-link"><div><strong>Prescription pickup</strong><p v-if="linkedPrescription">{{ linkedPrescription.customerName || 'Customer' }} · {{ linkedPrescription.service || linkedPrescription.serviceName || 'Consultation' }}</p><p v-else>Linked consultation: {{ appointmentId }}</p><ul v-if="linkedPrescriptionItems.length" class="prescription-items"><li v-for="(item, index) in linkedPrescriptionItems" :key="index"><strong>{{ item.name || item.medication || item.productName || 'Medication' }}</strong><span>{{ [item.dosage || item.strength, item.frequency, item.duration, item.instructions || item.notes].filter(Boolean).join(' · ') }}</span></li></ul></div><router-link to="/clinical/prescriptions">Back to prescriptions</router-link></section>

        <div class="pos-layout">
          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">Sellable items</p><h2>Pharmacy stock</h2></div><input v-model.trim="search" class="search" placeholder="Search products" aria-label="Search pharmacy products" /></div>
            <p v-if="loading" class="muted">Loading branch inventory…</p>
            <p v-else-if="!pharmacyItems.length" class="muted">No inventory items match your search.</p>
            <div v-else class="item-grid">
              <article v-for="item in pharmacyItems" :key="item.id" class="item-card">
                <div><strong>{{ item.name }}</strong><small>{{ item.unit || 'units' }} · {{ available(item) }} in stock · {{ dispensingLabel(item.dispensingClass) }}</small></div>
                <span class="price">{{ Number(item.retailPrice) > 0 ? currency(item.retailPrice) : 'Price needed' }}</span>
                <button type="button" :disabled="!canAdd(item)" @click="addItem(item)">Add</button>
              </article>
            </div>
          </section>

          <section class="panel cart-panel">
            <div class="section-heading"><div><p class="eyebrow">Checkout</p><h2>Current sale</h2></div><button v-if="cart.length" class="text-button" type="button" @click="cart = []">Clear</button></div>
            <p v-if="!cart.length" class="muted">Add pharmacy items to start a sale.</p>
            <div v-for="line in cart" :key="line.itemId" class="cart-line"><div><strong>{{ line.name }}</strong><small>{{ currency(line.unitPrice) }} each</small></div><div class="quantity-control"><button type="button" aria-label="Decrease quantity" @click="changeQuantity(line.itemId, -1)">−</button><span>{{ line.quantity }}</span><button type="button" :disabled="line.quantity >= available(itemFor(line.itemId))" aria-label="Increase quantity" @click="changeQuantity(line.itemId, 1)">+</button></div><strong>{{ currency(line.unitPrice * line.quantity) }}</strong></div>
            <label class="checkout-field">Customer name <span>optional</span><input v-model.trim="customerName" maxlength="120" placeholder="Name for the receipt" /></label>
            <label class="checkout-field">Payment method<select v-model="paymentMethod"><option>Cash</option><option>Card (external terminal)</option><option>E-wallet (external)</option></select></label>
            <label v-if="paymentMethod === 'Cash'" class="checkout-field">Cash received<input v-model.number="cashTendered" type="number" min="0" step="0.01" placeholder="0.00" /></label>
            <div class="total-row"><span>Total</span><strong>{{ currency(total) }}</strong></div>
            <p v-if="paymentMethod === 'Cash' && cashTendered >= total && total > 0" class="change-row">Change <strong>{{ currency(cashTendered - total) }}</strong></p>
            <p class="payment-note">For card or e-wallet, collect payment on your external terminal before completing this sale.</p>
            <button class="checkout-button" type="button" :disabled="!cart.length || busy || !canSell || (paymentMethod === 'Cash' && cashTendered < total)" @click="checkout">{{ busy ? 'Processing…' : 'Complete sale' }}</button>
            <p v-if="!canSell" class="muted">You need inventory update and payment creation access to complete sales.</p>
          </section>
        </div>

        <section class="panel settings-panel">
          <div class="section-heading"><div><p class="eyebrow">Retail setup</p><h2>Adjust pharmacy retail prices</h2></div></div>
          <p class="muted">Only items explicitly added from Inventory appear here. Procurement cost is not used as the sale price.</p>
          <div class="settings-list"><div v-for="item in pharmacyListedItems" :key="item.id" class="setting-row"><div><strong>{{ item.name }}</strong><small>{{ available(item) }} {{ item.unit || 'units' }} in stock · {{ dispensingLabel(item.dispensingClass) }}</small></div><label class="price-field">Retail price (PHP)<input v-model="prices[item.id]" type="number" min="0.01" step="0.01" :disabled="!canManage" /></label><button v-if="canManage" type="button" :disabled="savingId === item.id" @click="saveSettings(item)">{{ savingId === item.id ? 'Saving…' : 'Save price' }}</button></div></div>
          <p v-if="!pharmacyListedItems.length && !loading" class="muted">No items have been added to Pharmacy yet. Add them from Inventory.</p>
        </section>

        <section class="panel sales-panel"><div class="section-heading"><div><p class="eyebrow">Recent activity</p><h2>Recent pharmacy sales</h2></div></div><div v-if="sales.length" class="sales-list"><article v-for="sale in sales" :key="sale.id"><div><strong>{{ sale.receiptNumber }}</strong><small>{{ sale.customerName || 'Walk-in customer' }} · {{ formatDate(sale.createdAt) }} · {{ sale.paymentMethod || 'Payment' }}</small></div><strong>{{ currency(sale.total) }}</strong></article></div><p v-else class="muted">Completed sales will appear here.</p></section>

        <div v-if="receipt" class="receipt-overlay" role="dialog" aria-modal="true" aria-label="Sale receipt"><section class="receipt"><p class="eyebrow">Sale complete</p><h2>Receipt {{ receipt.receiptNumber }}</h2><p>{{ receipt.customerName || 'Walk-in customer' }} · {{ receipt.paymentMethod }}</p><div v-for="line in receipt.items" :key="line.itemId" class="receipt-line"><span>{{ line.name }} × {{ line.quantity }}</span><strong>{{ currency(line.total) }}</strong></div><div class="total-row"><span>Total paid</span><strong>{{ currency(receipt.total) }}</strong></div><p v-if="receipt.change" class="change-row">Change <strong>{{ currency(receipt.change) }}</strong></p><div class="receipt-actions"><button type="button" @click="printReceipt">Print</button><button type="button" @click="receipt = null">Close</button></div></section></div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'

const route = useRoute(), { pageLoading, trackPageLoad, pageListener } = usePageLoading(), { hasPermission } = usePermissions()
const branches = ref([]), branchId = ref(''), items = ref([]), sales = ref([]), cart = ref([]), prices = ref({}), search = ref(''), customerName = ref(''), paymentMethod = ref('Cash'), cashTendered = ref(''), error = ref(''), loading = ref(true), busy = ref(false), savingId = ref(''), receipt = ref(null), linkedPrescription = ref(null), checkoutId = ref(crypto.randomUUID())
const appointmentId = computed(() => String(route.query.appointmentId || ''))
const linkedPrescriptionItems = computed(() => { const value = linkedPrescription.value?.prescriptions; return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : value && typeof value === 'object' ? [value] : [] })
const canManage = computed(() => hasPermission('inventory:update'))
const canSell = computed(() => canManage.value && hasPermission('payments:create'))
const pharmacyListedItems = computed(() => items.value.filter(item => item.pharmacyEnabled === true))
const pharmacyItems = computed(() => pharmacyListedItems.value.filter(item => !search.value || String(item.name || '').toLowerCase().includes(search.value.toLowerCase())))
const total = computed(() => Math.round(cart.value.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100) / 100)
let stopAuth, stopInventory, generation = 0
const currency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const available = item => Math.max(0, Number(item?.currentStock || 0) - Number(item?.reservedStock || 0))
const canAdd = item => available(item) > 0 && Number(item?.retailPrice || 0) > 0 && item?.dispensingClass !== 'restricted' && item?.dispensingClass !== 'unclassified' && (item?.dispensingClass !== 'prescription_required' || Boolean(appointmentId.value))
const dispensingLabel = value => ({ general_sale: 'General sale', prescription_required: 'Prescription required', restricted: 'Restricted', unclassified: 'Unclassified' })[value || 'unclassified']
const itemFor = id => items.value.find(item => item.id === id)
const formatDate = value => { const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value || ''); return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleString('en-PH') }
const api = async (path, body) => { const token = await auth.currentUser.getIdToken(); const response = await fetch(`${OTP_API_BASE}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || 'Pharmacy request failed.'); return payload.data }
const load = async user => {
  const preferredBranchId = branchId.value; const run = ++generation; stopInventory?.(); stopInventory = null; items.value = []; sales.value = []; branches.value = []; error.value = ''; loading.value = true
  if (!user) { loading.value = false; return }
  try {
    const scope = await loadOwnerBranchScope(db, user.uid); if (run !== generation) return
    const branchDocs = await loadClinicDocsByIds(db, scope.branchIds); if (run !== generation) return
    branches.value = branchDocs.map(branch => ({ id: branch.id, name: branch.clinicBranch || branch.clinicName || branch.name || branch.id }))
    branchId.value = branches.value.some(branch => branch.id === preferredBranchId) ? preferredBranchId : branches.value.some(branch => branch.id === String(route.query.branchId || '')) ? String(route.query.branchId) : scope.branchId || branches.value[0]?.id || ''
    if (!branchId.value) throw new Error('No clinic branch is linked to your account.')
    const data = await api(`/pharmacy/pos?branchId=${encodeURIComponent(branchId.value)}`); if (run !== generation) return
    sales.value = data.sales || []
    stopInventory = pageListener(onSnapshot, query(collection(db, 'inventoryItems'), where('branchId', '==', branchId.value)), snapshot => {
      if (run !== generation) return
      items.value = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      prices.value = Object.fromEntries(items.value.map(item => [item.id, Number(item.retailPrice || 0)]))
      loading.value = false
    }, cause => { console.error('Pharmacy inventory subscription failed:', cause); error.value = 'Unable to load pharmacy inventory. Check your branch access.'; loading.value = false })
    if (appointmentId.value) {
      try { linkedPrescription.value = (await api(`/pharmacy/prescription?branchId=${encodeURIComponent(branchId.value)}&appointmentId=${encodeURIComponent(appointmentId.value)}`)).appointment; customerName.value = linkedPrescription.value.customerName || '' }
      catch (_) { linkedPrescription.value = null }
    } else linkedPrescription.value = null
  } catch (cause) { if (run === generation) { error.value = cause.message || 'Unable to load the pharmacy.'; loading.value = false } }
}
const switchBranch = async () => { if (auth.currentUser) { cart.value = []; receipt.value = null; checkoutId.value = crypto.randomUUID(); await load(auth.currentUser) } }
const addItem = item => { const existing = cart.value.find(line => line.itemId === item.id); if (existing) { if (existing.quantity < available(item)) existing.quantity++ } else cart.value.push({ itemId: item.id, name: item.name, unitPrice: Number(item.retailPrice), quantity: 1 }) }
const changeQuantity = (id, delta) => { const line = cart.value.find(entry => entry.itemId === id); if (!line) return; line.quantity += delta; if (line.quantity <= 0) cart.value = cart.value.filter(entry => entry.itemId !== id) }
const saveSettings = async item => { savingId.value = item.id; try { await api(`/pharmacy/items/${encodeURIComponent(item.id)}/settings`, { branchId: branchId.value, pharmacyEnabled: true, dispensingClass: item.dispensingClass || 'unclassified', retailPrice: prices.value[item.id] }); toast.success('Pharmacy retail price saved.') } catch (cause) { toast.error(cause.message) } finally { savingId.value = '' } }
const checkout = async () => { if (!canSell.value || !cart.value.length || busy.value) return; busy.value = true; try { receipt.value = await api('/pharmacy/checkout', { checkoutId: checkoutId.value, branchId: branchId.value, items: cart.value.map(line => ({ itemId: line.itemId, quantity: line.quantity })), customerName: customerName.value, paymentMethod: paymentMethod.value, cashTendered: paymentMethod.value === 'Cash' ? cashTendered.value : undefined, appointmentId: appointmentId.value || undefined }); checkoutId.value = crypto.randomUUID(); cart.value = []; cashTendered.value = ''; customerName.value = ''; sales.value = [receipt.value, ...sales.value.filter(sale => sale.id !== receipt.value.id)].slice(0, 30); toast.success('Sale completed and inventory updated.') } catch (cause) { toast.error(cause.message) } finally { busy.value = false } }
const printReceipt = () => window.print()
onMounted(trackPageLoad(() => { stopAuth = pageListener(onAuthStateChanged, auth, load) }))
onUnmounted(() => { generation++; stopAuth?.(); stopInventory?.() })
</script>

<style scoped>
.pos-shell{display:flex;min-height:100vh;background:#0f172a;color:#f8fafc}.pos-main{min-width:0;flex:1;padding:2rem}.pos-content{width:min(100%,1250px);margin:0 auto}.page-heading,.section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem}.page-heading{margin-bottom:1.5rem}.eyebrow{margin:0;color:#c08457;font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.page-heading h1{margin:.35rem 0;color:#fff;font-size:2rem;font-weight:700}.subtitle,.muted{color:#94a3b8;line-height:1.55}.subtitle{max-width:700px;margin:.4rem 0 0}.panel{margin-top:1.2rem;padding:1.2rem;border:1px solid #334155;border-radius:1rem;background:#1e293b}.section-heading{margin-bottom:1rem}.section-heading h2{margin:.2rem 0;color:#fff;font-size:1.1rem;font-weight:700}.branch-filter{min-width:220px;color:#cbd5e1;font-size:.85rem}.branch-filter select,.checkout-field input,.checkout-field select,.search,.price-field input{display:block;width:100%;margin-top:.35rem;border:1px solid #475569;border-radius:.6rem;background:#0f172a;padding:.6rem;color:#fff}.pos-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(320px,.8fr);gap:1rem}.pos-layout .panel{min-width:0}.item-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.7rem}.item-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.5rem;padding:.8rem;border:1px solid #334155;border-radius:.8rem;background:#0f172a}.item-card strong,.cart-line strong,.setting-row strong,.sales-list strong{display:block;color:#f8fafc}.item-card small,.cart-line small,.setting-row small,.sales-list small{display:block;margin-top:.25rem;color:#94a3b8;font-size:.75rem}.item-card .price{color:#fbbf77;font-weight:700}.item-card button,.checkout-button{border:0;border-radius:.6rem;padding:.55rem .8rem;background:#b45309;color:#fff;font-weight:700}.item-card button:disabled,.checkout-button:disabled{opacity:.45}.cart-panel{align-self:start}.text-button{color:#fbbf77}.cart-line{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:.6rem;padding:.75rem 0;border-bottom:1px solid #334155}.quantity-control{display:flex;align-items:center;gap:.5rem}.quantity-control button{width:1.8rem;height:1.8rem;border:1px solid #475569;border-radius:.4rem;background:#0f172a;color:#fff}.quantity-control button:disabled{opacity:.4}.checkout-field{display:block;margin-top:.9rem;color:#cbd5e1;font-size:.82rem}.checkout-field>span{color:#94a3b8;font-size:.75rem}.total-row,.change-row{display:flex;justify-content:space-between;gap:1rem;margin:1rem 0 0;padding-top:.9rem;border-top:1px solid #475569;color:#f8fafc}.total-row strong{font-size:1.2rem}.change-row{margin-top:.5rem;padding-top:0;border:0;color:#86efac}.payment-note{color:#94a3b8;font-size:.75rem;line-height:1.5}.checkout-button{width:100%;margin-top:.5rem;padding:.75rem}.settings-list,.sales-list{display:grid;gap:.55rem}.setting-row,.sales-list article{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.6fr) auto;align-items:center;gap:.8rem;padding:.75rem;border:1px solid #334155;border-radius:.75rem}.price-field{color:#cbd5e1;font-size:.75rem}.price-field input{max-width:160px}.setting-row button,.receipt-actions button{border:1px solid #475569;border-radius:.5rem;background:#334155;padding:.5rem .7rem;color:#fff}.sales-list article{grid-template-columns:minmax(0,1fr) auto}.sales-list article>strong{color:#fbbf77}.notice{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin:0 0 1rem;padding:1rem;border:1px solid #475569;border-radius:.8rem;background:#1e293b}.notice p{margin:.2rem 0 0;color:#cbd5e1}.notice a,.pos-link{color:#fbbf77;text-decoration:underline}.error{border-color:#7f1d1d;background:#450a0a;color:#fecaca}.prescription-link{border-color:#a16207;background:#422006}.prescription-items{display:grid;gap:.5rem;margin:.8rem 0 0;padding:0;list-style:none}.prescription-items li{display:grid;gap:.2rem;padding:.55rem;border-radius:.5rem;background:#1e293b}.prescription-items li span{color:#cbd5e1;font-size:.8rem}.receipt-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:1rem;background:#000b}.receipt{width:min(100%,420px);padding:1.4rem;border:1px solid #475569;border-radius:1rem;background:#1e293b;box-shadow:0 20px 60px #0008}.receipt h2{margin:.3rem 0 1rem}.receipt>p{color:#cbd5e1}.receipt-line{display:flex;justify-content:space-between;gap:1rem;padding:.6rem 0;border-top:1px solid #334155}.receipt-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.2rem}@media(max-width:900px){.pos-layout{grid-template-columns:1fr}.setting-row{grid-template-columns:minmax(0,1fr) minmax(130px,.6fr)}.setting-row button{grid-column:2;grid-row:2;justify-self:end}}@media(max-width:600px){.pos-main{padding:1rem}.page-heading,.section-heading{align-items:flex-start;flex-direction:column}.page-heading h1{font-size:1.65rem}.branch-filter,.search{width:100%}.setting-row{grid-template-columns:1fr 1fr}.setting-row>div{grid-column:1/-1}.setting-row button{grid-column:2;grid-row:2}.cart-line{grid-template-columns:minmax(0,1fr) auto}.cart-line>strong{grid-column:2;justify-self:end}.receipt-overlay{print-color-adjust:exact}}
@media print{.pos-shell>*:not(main),.page-heading,.pos-layout,.settings-panel,.sales-panel,.receipt-actions{display:none!important}.receipt-overlay{position:static;background:white}.receipt{box-shadow:none;background:white;color:black}.receipt h2,.receipt p,.receipt-line,.total-row{color:black}}
</style>
