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
                    <p class="mt-1 text-xs text-[#876c55]">{{ purchaseRequestReference(request) }}</p>
                  </td>
                  <td class="px-5 py-4">{{ request.branch || 'Clinic branch' }}</td>
                  <td class="px-5 py-4">{{ request.quantity || 0 }} {{ request.unit || 'units' }}</td>
                  <td class="px-5 py-4">{{ request.priority || 'Low' }}</td>
                  <td class="px-5 py-4">
                    <span class="rounded-full bg-[#f4e5d2] px-3 py-1 text-xs font-semibold text-[#765038]">
                      {{ quoteFor(request)?.status || 'Not submitted' }}
                    </span>
                    <p v-if="quoteFor(request)?.reference" class="mt-2 text-xs text-[#765038]">{{ quoteFor(request).reference }}</p>
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
        <section v-if="supplierDocId" class="overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/90 shadow-sm">
          <header class="border-b border-[#efdfca] px-5 py-4">
            <h2 class="text-xl font-bold text-[#40261a]">Submitted Quotes</h2>
            <p class="mt-1 text-sm text-[#6f503d]">Your quotation history, including accepted quotes. Five quotes per page.</p>
          </header>
          <p v-if="quotesLoading" class="p-5 text-sm text-[#6f503d]">Loading submitted quotes...</p>
          <p v-else-if="quotesError" role="alert" class="p-5 text-sm text-rose-700">{{ quotesError }}</p>
          <p v-else-if="!quotes.length" class="p-5 text-sm text-[#6f503d]">You haven't submitted any quotations yet.</p>
          <template v-else>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[800px] text-left text-sm">
                <thead class="bg-[#fff5e8] text-xs uppercase text-[#806047]">
                  <tr><th scope="col" class="px-5 py-4">Reference</th><th scope="col" class="px-5 py-4">Item / Clinic</th><th scope="col" class="px-5 py-4">Quantity</th><th scope="col" class="px-5 py-4">Total</th><th scope="col" class="px-5 py-4">Fulfillment</th><th scope="col" class="px-5 py-4">Status</th><th scope="col" class="px-5 py-4">Action</th></tr>
                </thead>
                <tbody class="divide-y divide-[#efdfca] text-[#5a402f]">
                  <tr v-for="quote in paginatedQuotes" :key="quote.id">
                    <td class="px-5 py-4 whitespace-nowrap font-semibold">{{ quote.reference || 'Not assigned' }}</td>
                    <td class="px-5 py-4"><p class="font-semibold">{{ quote.item || requestForQuote(quote)?.item || 'Item' }}</p><p class="mt-1 text-xs">{{ quote.branch || requestForQuote(quote)?.branch || 'Clinic' }}</p></td>
                    <td class="px-5 py-4">{{ quote.quantity }}</td>
                    <td class="px-5 py-4 whitespace-nowrap">{{ formatQuoteMoney(quote.amount) }}</td>
                    <td class="px-5 py-4 whitespace-nowrap">{{ quote.fulfillmentDate || 'Not provided' }}</td>
                    <td class="px-5 py-4"><span class="rounded-full bg-[#f4e5d2] px-3 py-1 text-xs font-semibold">{{ quote.status || 'Submitted' }}</span></td>
                    <td class="px-5 py-4"><button type="button" class="rounded-xl border border-[#d9b38d] px-3 py-2 text-xs font-semibold text-[#6f4329] hover:bg-[#fff5e8]" @click="viewedQuoteId = quote.id">View Details</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <nav aria-label="Submitted quotes pagination" class="flex flex-wrap items-center justify-between gap-3 border-t border-[#efdfca] px-5 py-4 text-sm text-[#6f503d]">
              <span aria-live="polite">Page {{ quotePage }} of {{ quotePageCount }} · {{ quotes.length }} quotes</span>
              <div class="flex gap-3">
                <button type="button" :disabled="quotePage === 1" class="rounded-lg border border-[#d9b38d] px-3 py-2 disabled:opacity-40" @click="quotePage--">Previous</button>
                <button type="button" :disabled="quotePage === quotePageCount" class="rounded-lg border border-[#d9b38d] px-3 py-2 disabled:opacity-40" @click="quotePage++">Next</button>
              </div>
            </nav>
          </template>
        </section>
      </section>
    </main>

    <Modal :isOpen="Boolean(viewedQuote)" :panelStyle="{ backgroundColor: '#fffaf4', color: '#40261a' }" @close="viewedQuoteId = null">
      <template #header><h2 class="text-xl font-bold">Quotation {{ viewedQuote?.reference || 'details' }}</h2></template>
      <template #body>
        <dl v-if="viewedQuote" class="grid gap-4 text-sm text-[#5a402f] sm:grid-cols-2">
          <div><dt class="font-bold">Item</dt><dd>{{ viewedQuote.item }}</dd></div>
          <div><dt class="font-bold">Clinic</dt><dd>{{ viewedQuote.branch || requestForQuote(viewedQuote)?.branch || 'Clinic' }}</dd></div>
          <div><dt class="font-bold">Quantity</dt><dd>{{ viewedQuote.quantity }}</dd></div>
          <div><dt class="font-bold">Unit price</dt><dd>{{ formatQuoteMoney(viewedQuote.unitPrice ?? Number(viewedQuote.amount) / (Number(viewedQuote.quantity) || 1)) }}</dd></div>
          <div><dt class="font-bold">Total</dt><dd>{{ formatQuoteMoney(viewedQuote.amount) }}</dd></div>
          <div><dt class="font-bold">Fulfillment date</dt><dd>{{ viewedQuote.fulfillmentDate || 'Not provided' }}</dd></div>
          <div><dt class="font-bold">Status</dt><dd>{{ viewedQuote.status || 'Submitted' }}</dd></div>
          <div><dt class="font-bold">Last updated</dt><dd>{{ formatQuoteDate(viewedQuote.updatedAt || viewedQuote.createdAt) }}</dd></div>
          <div class="sm:col-span-2"><dt class="font-bold">Notes and terms</dt><dd class="whitespace-pre-wrap break-words">{{ viewedQuote.notes || viewedQuote.details || 'No notes provided.' }}</dd></div>
        </dl>
      </template>
    </Modal>

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
            <input :value="quoteForm.unitPrice" required type="text" inputmode="decimal" @beforeinput="blockInvalidNumberInput($event, true)" @input="quoteForm.unitPrice = readNumberInput($event, quoteForm.unitPrice, true)" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Quoted quantity
            <input :value="quoteForm.quantity" required type="text" inputmode="numeric" @beforeinput="blockInvalidNumberInput($event)" @input="quoteForm.quantity = readNumberInput($event, quoteForm.quantity)" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Availability / fulfillment date
            <input v-model="quoteForm.fulfillmentDate" :min="minimumDate" required type="date" class="quote-field" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Reference number
            <input :value="quoteForm.reference" readonly class="quote-field" placeholder="Automatically assigned when submitted" />
          </label>
          <label class="block text-sm font-semibold text-[#5a402f]">
            Notes and terms
            <textarea v-model.trim="quoteForm.notes" maxlength="2000" rows="4" class="quote-field" placeholder="Availability, lead time, warranty, or other terms"></textarea>
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
import { manilaDate, validateSupplierQuote } from '../../../../backend/otp-backend/supplierQuoteValidation.js'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import axios from 'axios'
import { purchaseRequestReference } from '@/utils/purchaseRequestReference'
import { blockInvalidNumberInput, readNumberInput } from '@/utils/numericInput'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { db } from '@/config/firebaseConfig'

const auth = getAuth()
const loading = ref(true)
const saving = ref(false)
const supplierDocId = ref('')
const supplierName = ref('')
const requests = ref([])
const quotes = ref([])
const allRequests = ref([])
const quotesLoading = ref(true)
const quotesError = ref('')
const quotePage = ref(1)
const viewedQuoteId = ref(null)
const viewedQuote = computed(() => quotes.value.find((quote) => quote.id === viewedQuoteId.value) || null)
const quoteTime = (value) => value?.toMillis ? value.toMillis() : value ? new Date(value).getTime() || 0 : 0
const sortedQuotes = computed(() => [...quotes.value].sort((a, b) => quoteTime(b.updatedAt || b.createdAt) - quoteTime(a.updatedAt || a.createdAt) || a.id.localeCompare(b.id)))
const quotePageCount = computed(() => Math.max(1, Math.ceil(quotes.value.length / 5)))
const paginatedQuotes = computed(() => sortedQuotes.value.slice((quotePage.value - 1) * 5, quotePage.value * 5))
watch(quotePageCount, (count) => { quotePage.value = Math.min(quotePage.value, count) })
const requestForQuote = (quote) => allRequests.value.find((request) => request.id === quote.purchaseRequestId)
const formatQuoteMoney = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const formatQuoteDate = (value) => quoteTime(value) ? new Date(quoteTime(value)).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not available'
const selectedRequest = ref(null)
const minimumDate = ref(manilaDate())
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
    allRequests.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    requests.value = allRequests.value.filter((item) => !['Cancelled', 'Delivered'].includes(item.status))
  }))
  stops.push(onSnapshot(query(collection(db, 'supplierQuotes'), where('supplierId', '==', supplierDocId.value)), (snapshot) => {
    quotes.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    quotesLoading.value = false
    quotesError.value = ''
  }, (error) => {
    console.error('Failed to load submitted quotes:', error)
    quotesLoading.value = false
    quotesError.value = 'Unable to load submitted quotes. Please refresh or check your access.'
  }))
}

const openQuote = (request) => {
  const quote = quoteFor(request)
  minimumDate.value = manilaDate()
  selectedRequest.value = request
  Object.assign(quoteForm, {
    unitPrice: Number(quote?.unitPrice ?? (quote?.amount ? quote.amount / (quote.quantity || request.quantity || 1) : 0)),
    quantity: Number(quote?.quantity || request.quantity || 1),
    fulfillmentDate: quote?.fulfillmentDate || '',
    reference: /^QT-\d{8}-\d+$/.test(quote?.reference || '') ? quote.reference : '',
    notes: quote?.notes || quote?.details || ''
  })
}

const closeQuote = () => { selectedRequest.value = null }

const submitQuote = async () => {
  if (saving.value || !selectedRequest.value || !auth.currentUser) return
  minimumDate.value = manilaDate()
  const validation = validateSupplierQuote(quoteForm, selectedRequest.value.quantity)
  if (validation) return toast.error(validation)
  if (existingQuote.value?.status === 'Accepted') return toast.error('An accepted quotation cannot be changed.')
  saving.value = true
  try {
    const token = await auth.currentUser.getIdToken()
    const response = await axios.post(OTP_API_BASE + '/supplier/quotes', {
      purchaseRequestId: selectedRequest.value.id,
      unitPrice: quoteForm.unitPrice,
      quantity: quoteForm.quantity,
      fulfillmentDate: quoteForm.fulfillmentDate,
      notes: quoteForm.notes,
    }, { headers: { Authorization: 'Bearer ' + token } })
    quoteForm.reference = response.data.data.reference
    quotePage.value = 1
    toast.success('Quotation ' + quoteForm.reference + ' submitted. The clinic has been notified.')
    closeQuote()
  } catch (error) {
    console.error('Failed to submit supplier quote:', error)
    toast.error(error?.response?.data?.error || 'Failed to submit quotation.')
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
