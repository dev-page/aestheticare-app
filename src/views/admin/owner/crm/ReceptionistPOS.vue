<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">POS</h1>
          <p class="text-slate-400">Process walk-in product purchases and post transactions.</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-3 border border-slate-700 inline-flex gap-2 mb-6">
        <button
          @click="saleMode = 'product'"
          :class="[
            'px-4 py-2 rounded-lg text-sm transition-colors',
            saleMode === 'product' ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          ]"
        >
          Product Sale
        </button>
        <button
          @click="saleMode = 'appointment'"
          :class="[
            'px-4 py-2 rounded-lg text-sm transition-colors',
            saleMode === 'appointment' ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          ]"
        >
          Appointment Payment
        </button>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section class="xl:col-span-2">
          <template v-if="saleMode === 'product'">
            <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
              <label class="block text-slate-400 text-sm mb-2">Search Product</label>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by item name or SKU..."
                class="w-full md:w-96 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-slate-700">
                    <tr>
                      <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Product</th>
                      <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">SKU</th>
                      <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Price</th>
                      <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Stock</th>
                      <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700">
                    <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-slate-700/50 transition-colors">
                      <td class="px-6 py-4 text-white font-medium">{{ item.name || '-' }}</td>
                      <td class="px-6 py-4 text-slate-300">{{ item.sku || '-' }}</td>
                      <td class="px-6 py-4 text-green-400">{{ formatAmount(item.unitPrice) }}</td>
                      <td class="px-6 py-4 text-slate-300">{{ Number(item.currentStock || 0) }}</td>
                      <td class="px-6 py-4">
                        <button
                          @click="addToCart(item)"
                          :disabled="Number(item.currentStock || 0) <= 0"
                          class="px-3 py-1 rounded text-xs text-white bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                    <tr v-if="items.length === 0">
                      <td colspan="5" class="px-6 py-8 text-center text-slate-400">No inventory items available.</td>
                    </tr>
                    <tr v-else-if="filteredItems.length === 0">
                      <td colspan="5" class="px-6 py-8 text-center text-slate-400">No matching products.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div class="mb-4">
                <label class="block text-slate-400 text-sm mb-2">Search Appointment (Last Name)</label>
                <input
                  v-model="appointmentSearchQuery"
                  type="text"
                  placeholder="e.g. Dela Cruz"
                  class="w-full md:w-96 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-slate-400 text-sm mb-2">Select Appointment</label>
                  <select
                    v-model="selectedAppointmentId"
                    @change="syncAppointmentFieldsFromSelection"
                    class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Choose an appointment</option>
                    <option v-for="appointment in filteredUnpaidAppointments" :key="appointment.id" :value="appointment.id">
                      {{ formatClientDisplayName(appointment.clientName) }} - {{ appointment.service || 'Service' }} ({{ appointment.date || '-' }} {{ appointment.time || '' }})
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-slate-400 text-sm mb-2">Appointment Amount (PHP)</label>
                  <input
                    v-model.number="appointmentAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div v-if="selectedAppointment" class="mt-5 p-4 rounded-lg bg-slate-700 border border-slate-600">
                <p class="text-white font-medium">{{ selectedAppointment.clientName || 'Unknown Client' }}</p>
                <p class="text-slate-300 text-sm mt-1">{{ selectedAppointment.service || 'Service not set' }}</p>
                <p class="text-slate-400 text-xs mt-2">{{ selectedAppointment.date || '-' }} {{ selectedAppointment.time || '' }}</p>
              </div>

              <p v-if="unpaidAppointments.length === 0" class="text-slate-400 text-sm mt-4">
                No unpaid appointments found.
              </p>
              <p v-else-if="filteredUnpaidAppointments.length === 0" class="text-slate-400 text-sm mt-4">
                No appointments matched your search.
              </p>
            </div>
          </template>
        </section>

        <aside class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 class="text-xl font-semibold text-white mb-4">
            {{ saleMode === 'product' ? 'Cart' : 'Appointment Checkout' }}
          </h2>

          <div v-if="saleMode === 'product'" class="space-y-3 max-h-64 overflow-y-auto pr-1">
            <div
              v-for="row in cart"
              :key="row.id"
              class="bg-slate-700 rounded-lg p-3 border border-slate-600"
            >
              <p class="text-white text-sm font-medium">{{ row.name }}</p>
              <p class="text-slate-400 text-xs">{{ formatAmount(row.unitPrice) }} each</p>

              <div class="flex items-center justify-between mt-2">
                <div class="flex items-center gap-2">
                  <button @click="decreaseQty(row)" class="w-7 h-7 rounded bg-slate-600 text-white">-</button>
                  <span class="text-white text-sm w-6 text-center">{{ row.qty }}</span>
                  <button
                    @click="increaseQty(row)"
                    :disabled="row.qty >= row.availableStock"
                    class="w-7 h-7 rounded bg-slate-600 text-white disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <button @click="removeFromCart(row.id)" class="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            </div>
            <div v-if="cart.length === 0" class="text-slate-400 text-sm">No items in cart.</div>
          </div>

          <div class="border-t border-slate-700 mt-5 pt-5 space-y-3">
            <div v-if="saleMode === 'product'">
              <label class="block text-slate-400 text-xs mb-1">Client Name (optional)</label>
              <input
                v-model="clientName"
                type="text"
                placeholder="Walk-in Client"
                class="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-400 text-xs mb-1">Payment Method</label>
              <select v-model="paymentMethod" class="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-purple-500 focus:outline-none">
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-400 text-xs mb-1">Discount (%)</label>
              <input
                v-model.number="discountPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                class="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div v-if="paymentMethod === 'Cash'">
              <label class="block text-slate-400 text-xs mb-1">Amount Tendered (PHP)</label>
              <input
                v-model.number="amountTendered"
                type="number"
                min="0"
                step="0.01"
                class="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <p v-else class="text-xs text-slate-400">
              You will be redirected to PayMongo to complete this payment securely.
            </p>

            <div class="space-y-1 text-sm">
              <div class="flex items-center justify-between text-slate-300">
                <span>Subtotal</span>
                <span>{{ formatAmount(subtotal) }}</span>
              </div>
              <div class="flex items-center justify-between text-slate-300">
                <span>Discount</span>
                <span>- {{ formatAmount(effectiveDiscount) }}</span>
              </div>
              <div class="flex items-center justify-between text-white font-semibold text-base pt-1">
                <span>Total</span>
                <span>{{ formatAmount(grandTotal) }}</span>
              </div>
              <div class="flex items-center justify-between text-slate-300">
                <span>Change</span>
                <span>{{ formatAmount(changeAmount) }}</span>
              </div>
            </div>

            <button
              @click="checkout"
              :disabled="isCheckoutDisabled"
              class="w-full mt-2 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              {{ saving ? 'Processing...' : (paymentMethod === 'Cash' ? (saleMode === 'product' ? 'Complete Sale' : 'Pay Appointment') : 'Proceed to PayMongo') }}
            </button>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { useRoute, useRouter } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ReceptionistPOS',
  components: { OwnerSidebar },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const BACKEND_URL = import.meta.env.VITE_OTP_BACKEND_URL || 'http://localhost:3001'
    const PENDING_PAYMONGO_KEY = 'receptionist_pos_pending_paymongo'

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const saleMode = ref('product')
    const searchQuery = ref('')
    const items = ref([])
    const appointments = ref([])
    const cart = ref([])
    const clientName = ref('')
    const appointmentSearchQuery = ref('')
    const selectedAppointmentId = ref('')
    const appointmentAmount = ref(0)
    const paymentMethod = ref('Cash')
    const discountPercent = ref(0)
    const amountTendered = ref(0)
    const saving = ref(false)

    const formatAmount = (amount) => {
      const numeric = Number(amount || 0)
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(numeric)
    }

    const filteredItems = computed(() => {
      const queryText = searchQuery.value.trim().toLowerCase()
      if (!queryText) return items.value

      return items.value.filter((item) => {
        const name = (item.name || '').toLowerCase()
        const sku = (item.sku || '').toLowerCase()
        return name.includes(queryText) || sku.includes(queryText)
      })
    })

    const unpaidAppointments = computed(() =>
      appointments.value.filter((item) => {
        if (String(item.status || '').toLowerCase() === 'cancelled') return false
        const paymentStatus = String(item.paymentStatus || '').toLowerCase()
        return paymentStatus !== 'paid'
      })
    )

    const extractNameParts = (fullName) => {
      const source = String(fullName || '').trim()
      if (!source) return { firstNames: '', lastName: '' }
      const parts = source.split(/\s+/).filter(Boolean)
      if (parts.length === 1) return { firstNames: '', lastName: parts[0] }
      return {
        firstNames: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1]
      }
    }

    const formatClientDisplayName = (fullName) => {
      const { firstNames, lastName } = extractNameParts(fullName)
      if (!lastName) return 'Unknown Client'
      return firstNames ? `${lastName}, ${firstNames}` : lastName
    }

    const filteredUnpaidAppointments = computed(() => {
      const queryText = appointmentSearchQuery.value.trim().toLowerCase()
      if (!queryText) return unpaidAppointments.value

      return unpaidAppointments.value.filter((item) => {
        const client = String(item.clientName || '').toLowerCase()
        const service = String(item.service || '').toLowerCase()
        const { lastName } = extractNameParts(item.clientName)
        const normalizedLastName = String(lastName || '').toLowerCase()
        return normalizedLastName.includes(queryText) || client.includes(queryText) || service.includes(queryText)
      })
    })

    const selectedAppointment = computed(() =>
      unpaidAppointments.value.find((item) => item.id === selectedAppointmentId.value) || null
    )

    const inferredAppointmentAmount = (appointment) => {
      if (!appointment) return 0
      const candidates = [appointment.amount, appointment.price, appointment.fee, appointment.serviceFee]
      const found = candidates.find((value) => value !== undefined && value !== null && value !== '')
      return Number(found || 0)
    }

    const subtotal = computed(() => {
      if (saleMode.value === 'appointment') return Number(appointmentAmount.value || 0)
      return cart.value.reduce((sum, row) => sum + Number(row.unitPrice || 0) * Number(row.qty || 0), 0)
    })

    const effectiveDiscount = computed(() => {
      const rawPercent = Number(discountPercent.value || 0)
      const safePercent = Math.min(100, Math.max(0, rawPercent))
      return subtotal.value * (safePercent / 100)
    })

    const grandTotal = computed(() => Math.max(0, subtotal.value - effectiveDiscount.value))
    const effectiveTendered = computed(() => {
      if (paymentMethod.value === 'Cash') return Number(amountTendered.value || 0)
      return grandTotal.value
    })

    const changeAmount = computed(() => Math.max(0, effectiveTendered.value - grandTotal.value))

    const isCheckoutDisabled = computed(() => {
      if (saving.value) return true
      if (saleMode.value === 'product' && cart.value.length === 0) return true
      if (saleMode.value === 'appointment' && !selectedAppointmentId.value) return true
      if (grandTotal.value <= 0) return true
      if (paymentMethod.value === 'Cash' && Number(amountTendered.value || 0) < grandTotal.value) return true
      return false
    })

    const addToCart = (item) => {
      if (Number(item.currentStock || 0) <= 0) {
        toast.error('Item is out of stock.')
        return
      }

      const existing = cart.value.find((row) => row.id === item.id)
      if (existing) {
        if (existing.qty >= existing.availableStock) {
          toast.error('Reached available stock for this item.')
          return
        }
        existing.qty += 1
        return
      }

      cart.value.push({
        id: item.id,
        name: item.name || 'Unnamed Item',
        sku: item.sku || '',
        unitPrice: Number(item.unitPrice || 0),
        qty: 1,
        availableStock: Number(item.currentStock || 0)
      })
    }

    const increaseQty = (row) => {
      if (row.qty >= row.availableStock) return
      row.qty += 1
    }

    const decreaseQty = (row) => {
      if (row.qty <= 1) {
        removeFromCart(row.id)
        return
      }
      row.qty -= 1
    }

    const removeFromCart = (itemId) => {
      cart.value = cart.value.filter((row) => row.id !== itemId)
    }

    const resetPOS = () => {
      cart.value = []
      clientName.value = ''
      appointmentSearchQuery.value = ''
      selectedAppointmentId.value = ''
      appointmentAmount.value = 0
      paymentMethod.value = 'Cash'
      discountPercent.value = 0
      amountTendered.value = 0
    }

    const getCurrentSaleSnapshot = () => {
      if (saleMode.value === 'appointment') {
        const appointment = selectedAppointment.value
        if (!appointment) throw new Error('Please select an appointment.')
        return {
          saleMode: 'appointment',
          paymentMethod: paymentMethod.value,
          clientName: (clientName.value || appointment.clientName || '').trim(),
          appointment: {
            id: appointment.id,
            clientName: appointment.clientName || '',
            service: appointment.service || '',
            date: appointment.date || '',
            time: appointment.time || ''
          },
          subtotal: subtotal.value,
          discount: effectiveDiscount.value,
          discountPercent: Math.min(100, Math.max(0, Number(discountPercent.value || 0))),
          amount: grandTotal.value,
          amountTendered: effectiveTendered.value,
          change: changeAmount.value
        }
      }

      return {
        saleMode: 'product',
        paymentMethod: paymentMethod.value,
        clientName: (clientName.value || '').trim() || 'Walk-in Client',
        items: cart.value.map((row) => ({
          itemId: row.id,
          name: row.name,
          sku: row.sku || '',
          unitPrice: Number(row.unitPrice || 0),
          quantity: Number(row.qty || 0),
          lineTotal: Number(row.unitPrice || 0) * Number(row.qty || 0)
        })),
        subtotal: subtotal.value,
        discount: effectiveDiscount.value,
        discountPercent: Math.min(100, Math.max(0, Number(discountPercent.value || 0))),
        amount: grandTotal.value,
        amountTendered: effectiveTendered.value,
        change: changeAmount.value
      }
    }

    const toCentavos = (pesoAmount) => Math.round(Number(pesoAmount || 0) * 100)

    const getBackendCandidates = () => {
      const candidates = [String(BACKEND_URL || '').trim()].filter(Boolean)
      return [...new Set(candidates)]
    }

    const fetchFromBackend = async (path, options = {}) => {
      const candidates = getBackendCandidates()
      let lastError = null
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

      for (const baseUrl of candidates) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: { ...(options.headers || {}), ...authHeader },
          })
          // If this host does not expose the endpoint, try the next candidate.
          if (response.status === 404) {
            lastError = new Error(`Endpoint not found on ${baseUrl}`)
            continue
          }

          const contentType = response.headers.get('content-type') || ''
          if (!contentType.toLowerCase().includes('application/json')) {
            lastError = new Error(`Non-JSON response from ${baseUrl}`)
            continue
          }

          return response
        } catch (error) {
          lastError = error
        }
      }

      throw lastError || new Error(`Failed to reach backend service at ${BACKEND_URL}. Ensure otp-backend is running.`)
    }

    const savePendingPayMongoState = (state) => {
      localStorage.setItem(PENDING_PAYMONGO_KEY, JSON.stringify(state))
    }

    const loadPendingPayMongoState = () => {
      try {
        const raw = localStorage.getItem(PENDING_PAYMONGO_KEY)
        return raw ? JSON.parse(raw) : null
      } catch (_error) {
        return null
      }
    }

    const clearPendingPayMongoState = () => {
      localStorage.removeItem(PENDING_PAYMONGO_KEY)
    }

    const buildPayMongoLineItems = (snapshot) => {
      if (snapshot.saleMode === 'appointment') {
        return [
          {
            name: snapshot.appointment.service || 'Appointment Payment',
            amount: toCentavos(snapshot.amount),
            currency: 'PHP', currencyDisplay: 'code',
            quantity: 1
          }
        ]
      }

      return snapshot.items.map((item) => ({
        name: item.name,
        amount: toCentavos(item.unitPrice),
        currency: 'PHP', currencyDisplay: 'code',
        quantity: item.quantity
      }))
    }

    const createPayMongoCheckoutSession = async (snapshot) => {
      const paymentMethodType = snapshot.paymentMethod === 'Card' ? 'card' : 'gcash'
      const referenceNumber = `POS-${Date.now()}`
      const successUrl = `${window.location.origin}/receptionist/pos?paymongo_status=success`
      const cancelUrl = `${window.location.origin}/receptionist/pos?paymongo_status=cancelled`

      const response = await fetchFromBackend('/paymongo/create-checkout-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: toCentavos(snapshot.amount),
          paymentMethodType,
          description: snapshot.saleMode === 'appointment' ? 'Appointment Payment' : 'POS Product Sale',
          referenceNumber,
          metadata: {
            saleMode: snapshot.saleMode,
            branchId: currentBranchId.value,
            receptionistId: currentUserId.value
          },
          lineItems: buildPayMongoLineItems(snapshot),
          successUrl,
          cancelUrl
        })
      })

      const raw = await response.text()
      let payload = null
      try {
        payload = JSON.parse(raw)
      } catch (_error) {
        throw new Error(`Backend returned non-JSON response (${response.status}). Check backend URL/port and ensure /paymongo endpoints exist.`)
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to create PayMongo checkout session.')
      }

      return payload.data
    }

    const commitSale = async (snapshot, paymentMeta = {}) => {
      const batch = writeBatch(db)
      const transactionRef = doc(collection(db, 'transactions'))

      if (snapshot.saleMode === 'product') {
        batch.set(transactionRef, {
          branchId: currentBranchId.value,
          receptionistId: currentUserId.value,
          clientName: snapshot.clientName || 'Walk-in Client',
          amount: snapshot.amount,
          subtotal: snapshot.subtotal,
          discount: snapshot.discount,
          discountPercent: snapshot.discountPercent,
          amountTendered: snapshot.amountTendered,
          change: snapshot.change,
          method: snapshot.paymentMethod,
          status: 'Paid',
          type: 'product_sale',
          source: paymentMeta.source || 'receptionist_pos',
          itemCount: snapshot.items.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
          items: snapshot.items,
          paymongoCheckoutSessionId: paymentMeta.paymongoCheckoutSessionId || null,
          createdAt: serverTimestamp()
        })

        for (const row of snapshot.items) {
          const itemRef = doc(db, 'inventoryItems', row.itemId)
          const currentItem = items.value.find((item) => item.id === row.itemId)
          const currentStock = Number(currentItem?.currentStock || 0)
          const nextStock = currentStock - Number(row.quantity || 0)

          if (nextStock < 0) {
            throw new Error(`Not enough stock for ${row.name}.`)
          }

          const lowStockThreshold = Number(currentItem?.minStock || 0)
          let stockStatus = 'In Stock'
          if (nextStock <= 0) stockStatus = 'Out of Stock'
          else if (lowStockThreshold > 0 && nextStock <= lowStockThreshold) stockStatus = 'Low Stock'

          batch.update(itemRef, {
            currentStock: nextStock,
            stockStatus,
            updatedAt: serverTimestamp()
          })
        }
      } else {
        batch.set(transactionRef, {
          branchId: currentBranchId.value,
          receptionistId: currentUserId.value,
          clientName: snapshot.clientName || snapshot.appointment.clientName || 'Walk-in Client',
          appointmentId: snapshot.appointment.id,
          appointmentDate: snapshot.appointment.date,
          appointmentTime: snapshot.appointment.time,
          service: snapshot.appointment.service,
          amount: snapshot.amount,
          subtotal: snapshot.subtotal,
          discount: snapshot.discount,
          discountPercent: snapshot.discountPercent,
          amountTendered: snapshot.amountTendered,
          change: snapshot.change,
          method: snapshot.paymentMethod,
          status: 'Paid',
          type: 'appointment_payment',
          source: paymentMeta.source || 'receptionist_pos',
          paymongoCheckoutSessionId: paymentMeta.paymongoCheckoutSessionId || null,
          createdAt: serverTimestamp()
        })

        const appointmentRef = doc(db, 'appointments', snapshot.appointment.id)
        batch.update(appointmentRef, {
          paymentStatus: 'Paid',
          paymentMethod: snapshot.paymentMethod,
          amountPaid: snapshot.amount,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }

      await batch.commit()
    }

    const loadItems = async () => {
      if (!currentBranchId.value) {
        items.value = []
        return
      }

      const snapshot = await getDocs(
        query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))
      )
      items.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((item) => Number(item.unitPrice || 0) > 0 && Boolean(item.name))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    const loadAppointments = async () => {
      if (!currentBranchId.value) {
        appointments.value = []
        return
      }

      const snapshot = await getDocs(
        query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))
      )
      appointments.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`))
    }

    const syncAppointmentFieldsFromSelection = () => {
      const appointment = selectedAppointment.value
      if (!appointment) return
      clientName.value = appointment.clientName || clientName.value
      appointmentAmount.value = inferredAppointmentAmount(appointment)
    }

    const checkout = async () => {
      if (isCheckoutDisabled.value) return

      saving.value = true
      try {
        const snapshot = getCurrentSaleSnapshot()
        if (paymentMethod.value === 'Cash') {
          await commitSale(snapshot, { source: 'receptionist_pos' })
          await finalizeSuccessLog(snapshot)
          toast.success(snapshot.saleMode === 'product' ? 'Sale completed successfully.' : 'Appointment payment recorded.')
          resetPOS()
          await loadItems()
          await loadAppointments()
          return
        }

        const session = await createPayMongoCheckoutSession(snapshot)
        savePendingPayMongoState({
          snapshot,
          checkoutSessionId: session.id,
          createdAt: Date.now()
        })

        window.location.href = session.checkout_url
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Failed to process sale.')
      } finally {
        saving.value = false
      }
    }

    const finalizeSuccessLog = async (snapshot) => {
      if (snapshot.saleMode === 'product') {
        await logActivity(db, {
          actorId: currentUserId.value,
          action: 'Processed POS sale',
          details: `${snapshot.items.length} items sold for ${formatAmount(snapshot.amount)}`,
          module: 'Receptionist'
        })
      } else {
        await logActivity(db, {
          actorId: currentUserId.value,
          action: 'Paid an appointment',
          details: `${snapshot.appointment.clientName || 'Client'} paid ${formatAmount(snapshot.amount)}`,
          module: 'Receptionist'
        })
      }
    }

    const handlePayMongoReturn = async () => {
      const status = String(route.query.paymongo_status || '').toLowerCase()
      if (!status) return

      const pending = loadPendingPayMongoState()
      if (!pending?.checkoutSessionId || !pending?.snapshot) {
        toast.error('No pending PayMongo payment found.')
        await router.replace('/receptionist/pos')
        return
      }

      if (status === 'cancelled') {
        clearPendingPayMongoState()
        toast.info('PayMongo payment was cancelled.')
        await router.replace('/receptionist/pos')
        return
      }

      if (status !== 'success') {
        await router.replace('/receptionist/pos')
        return
      }

      try {
        saving.value = true
        const response = await fetchFromBackend(`/paymongo/checkout-session/${pending.checkoutSessionId}`)
        const raw = await response.text()
        let payload = null
        try {
          payload = JSON.parse(raw)
        } catch (_error) {
          throw new Error(`Backend returned non-JSON response (${response.status}). Check backend URL/port and ensure /paymongo endpoints exist.`)
        }
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to verify PayMongo payment.')
        }
        if (!payload?.data?.isPaid) {
          throw new Error('Payment is not yet marked as paid in PayMongo.')
        }

        await commitSale(pending.snapshot, {
          source: 'paymongo_checkout',
          paymongoCheckoutSessionId: pending.checkoutSessionId
        })
        await finalizeSuccessLog(pending.snapshot)

        clearPendingPayMongoState()
        resetPOS()
        await loadItems()
        await loadAppointments()
        toast.success('PayMongo payment confirmed and recorded.')
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Failed to finalize PayMongo payment.')
      } finally {
        saving.value = false
        await router.replace('/receptionist/pos')
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadItems()
        await loadAppointments()
        await handlePayMongoReturn()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      saleMode,
      searchQuery,
      items,
      unpaidAppointments,
      filteredUnpaidAppointments,
      selectedAppointment,
      cart,
      clientName,
      appointmentSearchQuery,
      selectedAppointmentId,
      appointmentAmount,
      paymentMethod,
      discountPercent,
      amountTendered,
      saving,
      filteredItems,
      subtotal,
      effectiveDiscount,
      grandTotal,
      changeAmount,
      isCheckoutDisabled,
      formatAmount,
      formatClientDisplayName,
      addToCart,
      increaseQty,
      decreaseQty,
      removeFromCart,
      syncAppointmentFieldsFromSelection,
      checkout
    }
  }
}
</script>

