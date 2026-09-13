<template>
  <div class="flex min-h-screen bg-gradient-to-br from-[#f8f1e6] via-[#f4e6d1] to-[#efdbc0]">
    <SupplierSidebar />

    <main class="min-w-0 flex-1 p-6 md:p-8">
      <section class="mx-auto max-w-7xl space-y-6">
        <header class="rounded-[2rem] border border-[#e4c7a1] bg-white/85 p-6 shadow-[0_18px_44px_rgba(77,52,31,0.08)] backdrop-blur">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Supplier Workspace</p>
          <h1 class="mt-2 text-3xl font-bold text-[#40261a]">Quote Requests</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-[#6f503d]">
            Review purchase requests assigned to your business and submit your quotation. Clinics will review and accept the quote before it proceeds to Finance and a purchase order.
          </p>
        </header>

        <div v-if="loading" class="rounded-[2rem] border border-[#e4c7a1] bg-white/80 p-8 text-center text-[#6f503d]">
          Loading quote requests...
        </div>

        <div v-else-if="!supplierDocId" class="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center text-amber-800">
          Your supplier profile is not ready yet. Please complete activation before submitting quotations.
        </div>

        <div v-else-if="!requests.length" class="rounded-[2rem] border border-[#e4c7a1] bg-white/80 p-8 text-center text-[#6f503d]">
          No purchase requests have been assigned to your supplier account yet.
        </div>

        <div v-else class="overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/90 shadow-[0_12px_30px_rgba(77,52,31,0.06)]">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="bg-[#fff5e8] text-xs uppercase tracking-wide text-[#806047]">
                <tr>
                  <th class="px-5 py-4">Request</th>
                  <th class="px-5 py-4">Clinic</th>
                  <th class="px-5 py-4">Quantity</th>
                  <th class="px-5 py-4">Priority</th>
                  <th class="px-5 py-4">Quote status</th>
                  <th class="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#efdfca] text-[#5a402f]">
                <tr v-for="request in requests" :key="request.id">
                  <td class="px-5 py-4">
                    <p class="font-semibold text-[#40261a]">{{ request.item || 'Unnamed item' }}</p>
                    <p class="mt-1 text-xs text-[#876c55]">{{ request.id }}</p>
                  </td>
                  <td class="px-5 py-4">{{ request.branch || 'Clinic branch' }}</td>
                  <td class="px-5 py-4">{{ request.quantity || 0 }} {{ request.unit || 'units' }}</td>
                  <td class="px-5 py-4">{{ request.priority || 'Low' }}</td>
                  <td class="px-5 py-4">
                    <span class="rounded-full bg-[#f4e5d2] px-3 py-1 text-xs font-semibold text-[#765038]">
                      {{ quoteFor(request)?.status || 'Not submitted' }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <button
                      type="button"
                      class="rounded-xl bg-[#8d5a3b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6f4329] disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="Boolean(quoteFor(request)?.status === 'Accepted')"
                      @click="openQuote(request)"
                    >
                      {{ quoteFor(request) ? 'View quote' : 'Submit quote' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>

    <div v-if="selectedRequest" class="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4">
      <div class="mx-auto my-6 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-[#e4c7a1] bg-[#fffaf4] p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Quotation</p>
            <h2 class="mt-1 text-2xl font-bold text-[#40261a]">{{ selectedRequest.item || 'Purchase request' }}</h2>
            <p class="mt-1 text-sm text-[#6f503d]">{{ selectedRequest.quantity }} {{ selectedRequest.unit || 'units' }} requested</p>
          </div>
          <button type="button" class="text-[#806047]" @click="closeQuote">Close</button>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="submitQuote">
          <label class="block text-sm font-semibold text-[#5a402f]">
            Unit price (PHP)
            <input v-model.number="quoteForm.unitPrice" required min="0" step="0.01" type="number" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Quoted quantity
            <input v-model.number="quoteForm.quantity" required min="1" step="1" type="number" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Availability / fulfillment date
            <input v-model="quoteForm.fulfillmentDate" required type="date" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Reference number
            <input v-model.trim="quoteForm.reference" class="quote-field" placeholder="Quote reference" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Notes and terms
            <textarea v-model.trim="quoteForm.notes" rows="4" class="quote-field" placeholder="Availability, lead time, warranty, or other terms"></textarea>
          </label>

          <div class="rounded-2xl border border-[#ead1b0] bg-[#fff3e4] p-4 text-sm text-[#6f503d]">
            Quoted total: <strong class="text-[#40261a]">PHP {{ quotedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</strong>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="rounded-xl border border-[#d9b38d] px-4 py-2 text-sm font-semibold text-[#6f4329]" @click="closeQuote">Cancel</button>
            <button type="submit" :disabled="saving" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {{ saving ? 'Submitting...' : existingQuote ? 'Update Quote' : 'Submit Quote' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import { db } from '@/config/firebaseConfig'

const auth = getAuth()
const loading = ref(true)
const saving = ref(false)
const supplierDocId = ref('')
const supplierName = ref('')
const requests = ref([])
const quotes = ref([])
const selectedRequest = ref(null)
let stops = []

const quoteForm = reactive({ unitPrice: 0, quantity: 1, fulfillmentDate: '', reference: '', notes: '' })
const existingQuote = computed(() => selectedRequest.value ? quoteFor(selectedRequest.value) : null)
const quotedTotal = computed(() => Math.max(0, Number(quoteForm.unitPrice) || 0) * Math.max(0, Number(quoteForm.quantity) || 0))

const quoteFor = (request) => quotes.value.find((quote) => quote.purchaseRequestId === request.id) || null

const loadSupplier = async (user) => {
  const supplierSnapshot = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', user.uid), limit(1)))
  if (!supplierSnapshot.empty) {
    const supplier = supplierSnapshot.docs[0]
    supplierDocId.value = supplier.id
    supplierName.value = supplier.data()?.name || supplier.data()?.businessName || user.email || 'Supplier'
    return
  }
  const fallback = await getDocs(query(collection(db, 'suppliers'), where('id', '==', user.uid), limit(1)))
  if (!fallback.empty) {
    const supplier = fallback.docs[0]
    supplierDocId.value = supplier.id
    supplierName.value = supplier.data()?.name || supplier.data()?.businessName || user.email || 'Supplier'
  }
}

const subscribeToRecords = () => {
  if (!supplierDocId.value) return
  stops.push(onSnapshot(query(collection(db, 'purchaseRequests'), where('supplierId', '==', supplierDocId.value)), (snapshot) => {
    requests.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !['Cancelled', 'Delivered'].includes(item.status))
  }))
  stops.push(onSnapshot(query(collection(db, 'supplierQuotes'), where('supplierId', '==', supplierDocId.value)), (snapshot) => {
    quotes.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }))
}

const openQuote = (request) => {
  const quote = quoteFor(request)
  selectedRequest.value = request
  Object.assign(quoteForm, {
    unitPrice: Number(quote?.unitPrice || quote?.amount || 0),
    quantity: Number(quote?.quantity || request.quantity || 1),
    fulfillmentDate: quote?.fulfillmentDate || '',
    reference: quote?.reference || '',
    notes: quote?.notes || quote?.details || ''
  })
}

const closeQuote = () => { selectedRequest.value = null }

const submitQuote = async () => {
  if (!selectedRequest.value || !supplierDocId.value || quotedTotal.value <= 0) {
    toast.error('Enter a valid unit price and quantity.')
    return
  }
  saving.value = true
  try {
    const quote = existingQuote.value
    const payload = {
      branchId: selectedRequest.value.branchId || null,
      purchaseRequestId: selectedRequest.value.id,
      supplierId: supplierDocId.value,
      supplierName: supplierName.value,
      item: selectedRequest.value.item || '',
      quantity: Number(quoteForm.quantity),
      unitPrice: Number(quoteForm.unitPrice),
      amount: quotedTotal.value,
      fulfillmentDate: quoteForm.fulfillmentDate,
      reference: quoteForm.reference || null,
      details: quoteForm.notes || null,
      notes: quoteForm.notes || null,
      status: quote?.status === 'Accepted' ? 'Accepted' : 'Submitted',
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null
    }
    if (quote?.id) await updateDoc(doc(db, 'supplierQuotes', quote.id), payload)
    else await addDoc(collection(db, 'supplierQuotes'), { ...payload, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid || null })
    toast.success('Quotation submitted to the clinic.')
    closeQuote()
  } catch (error) {
    console.error('Failed to submit supplier quote:', error)
    toast.error('Failed to submit quotation.')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  const stopAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) { loading.value = false; return }
    try {
      await loadSupplier(user)
      subscribeToRecords()
    } catch (error) {
      console.error('Failed to load supplier quote requests:', error)
      toast.error('Failed to load quote requests.')
    } finally {
      loading.value = false
    }
  })
  stops.push(stopAuth)
})

onUnmounted(() => stops.forEach((stop) => stop()))
</script>

<style scoped>
.quote-field {
  display: block;
  width: 100%;
  margin-top: .5rem;
  border: 1px solid #d9b38d;
  border-radius: .75rem;
  background: #fff;
  color: #40261a;
  padding: .75rem;
  outline: none;
}

.quote-field:focus { border-color: #8d5a3b; }
</style>
