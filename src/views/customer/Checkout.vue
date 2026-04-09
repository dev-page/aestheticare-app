<template>
  <div class="flex customer-theme bg-slate-900 min-h-screen">
    <CustomerSidebar />

    <main class="flex-1 p-8">
      <button
        type="button"
        class="mb-3 inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        @click="goBack"
      >
        <span class="text-lg leading-none">‹</span>
        <span class="text-sm font-medium">Back</span>
      </button>

      <h1 class="text-2xl font-bold text-white mb-6">Checkout</h1>

      <div class="bg-slate-800 rounded-lg shadow-md p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-purple-400 mb-4">Order Summary</h2>
        <div v-for="item in selectedItems" :key="item.id" class="flex justify-between items-center border-b border-slate-700 py-3">
          <div>
            <p class="text-white font-medium">{{ item.name }}</p>
            <p class="text-slate-400 text-sm">Qty: {{ item.quantity }}</p>
          </div>
          <p class="text-purple-400 font-semibold">PHP {{ (Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2) }}</p>
        </div>
        <div class="mt-4 space-y-2">
          <div class="flex justify-between text-slate-300">
            <span>Subtotal</span>
            <span>PHP {{ subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-slate-300">
            <span>System commission ({{ productCommissionPercent }}%)</span>
            <span>PHP {{ commissionAmount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-white font-semibold text-lg mt-2">
            <span>Total due</span>
            <span>PHP {{ subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-slate-400 text-sm">
            <span>Clinic share after commission</span>
            <span>PHP {{ merchantNetAmount.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-lg shadow-md p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-purple-400 mb-4">Delivery Information</h2>
        <form class="space-y-4" @submit.prevent>
          <input type="text" placeholder="Full Name" v-model="delivery.fullName" class="w-full p-3 rounded bg-slate-700 text-white border border-slate-600" />
          <input type="text" placeholder="Address" v-model="delivery.address" class="w-full p-3 rounded bg-slate-700 text-white border border-slate-600" />
          <input type="text" placeholder="Phone Number" v-model="delivery.phone" class="w-full p-3 rounded bg-slate-700 text-white border border-slate-600" />
        </form>
      </div>

      <div class="bg-slate-800 rounded-lg shadow-md p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-purple-400 mb-4">Payment Method</h2>
        <div class="space-y-3">
          <label class="flex items-center gap-2 text-white">
            <input type="radio" value="GCash" v-model="paymentMethod" />
            GCash
          </label>
          <label class="flex items-center gap-2 text-white">
            <input type="radio" value="Card" v-model="paymentMethod" />
            Credit/Debit Card
          </label>
        </div>
        <p class="mt-3 text-xs text-slate-400">Payment is processed in full through PayMongo before the order is created.</p>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          :disabled="saving"
          @click="startPayMongoCheckout"
          class="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white rounded-lg font-semibold"
        >
          {{ saving ? 'Processing...' : 'Proceed to Payment' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { clearCheckoutItems, readCart, readCheckoutItems, writeCart } from '@/utils/customerCart'
import { calculateCommissionAmount, calculateNetAmount, getProductCommissionPercent } from '@/utils/transactionFees'
import { toast } from 'vue3-toastify'
import { onAuthStateChanged } from 'firebase/auth'
import Swal from 'sweetalert2'

const router = useRouter()
const route = useRoute()
const selectedItems = ref([])
const paymentMethod = ref('GCash')
const saving = ref(false)

const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const PENDING_PAYMONGO_KEY = 'customer_checkout_pending_paymongo'

const delivery = ref({
  fullName: '',
  address: '',
  phone: '',
})

const subtotal = computed(() => selectedItems.value.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0))
const productCommissionPercent = getProductCommissionPercent()
const commissionAmount = computed(() => calculateCommissionAmount(subtotal.value, productCommissionPercent))
const merchantNetAmount = computed(() => calculateNetAmount(subtotal.value, commissionAmount.value))

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'customer-cart' })
}

const removePurchasedFromCart = () => {
  const selectedIds = new Set(selectedItems.value.map((item) => item.id))
  const nextCart = readCart().filter((item) => !selectedIds.has(item.id))
  writeCart(nextCart)
}

const toCentavos = (pesoAmount) => Math.round(Number(pesoAmount || 0) * 100)

const fetchFromBackend = async (path, options = {}) => {
  const baseUrl = String(OTP_API_BASE || '').trim()
  if (!baseUrl) {
    throw new Error('VITE_OTP_API_BASE_URL is not set.')
  }
  const response = await fetch(`${baseUrl}${path}`, options)
  if (response.status === 404) {
    throw new Error(`Endpoint not found on ${baseUrl}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Non-JSON response from ${baseUrl}`)
  }
  return response
}

const buildAuthHeaders = async (headers = {}) => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('You must be logged in to continue.')
  }
  const token = await user.getIdToken()
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
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

const createCustomerNotification = async ({ title, message, link = '/customer/orders' }) => {
  const user = auth.currentUser
  if (!user) return
  await addDoc(collection(db, 'notifications'), {
    recipientUserId: user.uid,
    title: String(title || 'Notification').trim(),
    message: String(message || '').trim(),
    link,
    read: false,
    deleted: false,
    createdAt: serverTimestamp(),
  })
}

const buildPayMongoLineItems = () =>
  selectedItems.value.map((item) => ({
    name: item.name || 'Order Item',
    amount: toCentavos(Number(item.price || 0)),
    currency: 'PHP',
    quantity: Math.max(1, Number(item.quantity || 1)),
  }))

const createPayMongoCheckoutSession = async () => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('You must be logged in to continue.')
  }

  if (paymentMethod.value === 'GCash' && !String(delivery.value.phone || '').trim()) {
    throw new Error('Mobile phone number is required for GCash payments.')
  }

  const paymentMethodType = paymentMethod.value === 'Card' ? 'card' : 'gcash'
  const referenceNumber = `ORD-${Date.now()}`
  const successUrl = `${window.location.origin}/customer/checkout?paymongo_status=success`
  const cancelUrl = `${window.location.origin}/customer/checkout?paymongo_status=cancelled`

  const response = await fetchFromBackend('/paymongo/create-checkout-session', {
    method: 'POST',
    headers: await buildAuthHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      amount: toCentavos(subtotal.value),
      paymentMethodType,
      description: 'Customer Order Full Payment',
      referenceNumber,
      billing: {
        name: delivery.value.fullName,
        email: auth.currentUser?.email || '',
        phone: String(delivery.value.phone || '').trim(),
      },
      metadata: {
        module: 'customer_order',
        customerId: user.uid,
        customerEmail: auth.currentUser?.email || '',
        customerName: delivery.value.fullName || '',
        paymentMethod: paymentMethod.value,
        paymentCoverage: 'full',
        commissionPercent: productCommissionPercent,
        commissionAmount: commissionAmount.value,
      },
      lineItems: buildPayMongoLineItems(),
      successUrl,
      cancelUrl,
    }),
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

  return {
    session: payload.data,
    referenceNumber,
  }
}

const startPayMongoCheckout = async () => {
  if (!selectedItems.value.length) {
    toast.error('No selected items to checkout.')
    return
  }
  if (!delivery.value.fullName || !delivery.value.address || !delivery.value.phone) {
    toast.error('Please complete delivery details.')
    return
  }
  if (paymentMethod.value === 'GCash' && !String(delivery.value.phone || '').trim()) {
    toast.error('Mobile phone number is required for GCash payments.')
    return
  }

  saving.value = true
  try {
    const { session, referenceNumber } = await createPayMongoCheckoutSession()
    savePendingPayMongoState({
      checkoutSessionId: session.id,
      selectedItems: selectedItems.value,
      delivery: delivery.value,
      total: subtotal.value,
      paymentMethod: paymentMethod.value,
      paymentCoverage: 'full',
      commissionPercent: productCommissionPercent,
      commissionAmount: commissionAmount.value,
      referenceNumber,
      createdAt: Date.now(),
    })
    window.location.href = session.checkout_url
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Failed to start payment.')
  } finally {
    saving.value = false
  }
}

const finalizeSuccessfulOrder = async (pending, payload) => {
  const payments = Array.isArray(payload?.data?.payments) ? payload.data.payments : []
  const firstPayment = payments[0] || {}
  const paymentAttrs = firstPayment?.attributes || {}
  const paymentMethodType =
    paymentAttrs?.payment_method?.type ||
    paymentAttrs?.source?.type ||
    paymentAttrs?.type ||
    pending.paymentMethod

  const branchIds = [...new Set((pending.selectedItems || []).map((item) => String(item.branchId || '').trim()).filter(Boolean))]
  const branchNames = [...new Set((pending.selectedItems || []).map((item) => String(item.branchName || '').trim()).filter(Boolean))]

  const orderRef = await addDoc(collection(db, 'customerOrders'), {
    customerId: auth.currentUser?.uid || '',
    customerEmail: auth.currentUser?.email || '',
    customerName: pending.delivery?.fullName || '',
    items: pending.selectedItems || [],
    delivery: pending.delivery || {},
    paymentMethod: pending.paymentMethod,
    paymentStatus: 'Paid',
    total: Number(pending.total || 0),
    status: 'Paid',
    referenceNumber: pending.referenceNumber || '',
    source: 'paymongo_checkout',
    paymongoCheckoutSessionId: pending.checkoutSessionId,
    paymongoStatus: payload?.data?.status || null,
    paymongoPaidAt: payload?.data?.paid_at || null,
    paymongoPaymentId: firstPayment?.id || null,
    paymongoPaymentMethodType: paymentMethodType || null,
    branchId: branchIds.length === 1 ? branchIds[0] : '',
    branchName: branchNames.length === 1 ? branchNames[0] : '',
    paymentCoverage: 'full',
    commissionPercent: productCommissionPercent,
    commissionAmount: commissionAmount.value,
    merchantNetAmount: merchantNetAmount.value,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await createCustomerNotification({
    title: 'Payment Received',
    message: `Your payment for order ${orderRef.id} was received successfully. Your purchase is now being processed.`,
    link: '/customer/orders',
  })

  removePurchasedFromCart()
  clearCheckoutItems()
}

const handlePayMongoReturn = async () => {
  const status = String(route.query.paymongo_status || '').toLowerCase()
  if (!status) return

  const pending = loadPendingPayMongoState()
  if (!pending?.checkoutSessionId) {
    toast.error('No pending PayMongo payment found.')
    await router.replace({ name: 'customer-checkout' })
    return
  }

  if (status === 'cancelled') {
    clearPendingPayMongoState()
    await Swal.fire({
      title: 'Payment Cancelled',
      text: 'Your PayMongo payment was cancelled.',
      icon: 'info',
      timer: 1600,
      showConfirmButton: false,
    })
    await router.replace({ name: 'customer-checkout' })
    return
  }

  if (status !== 'success') return

  saving.value = true
  try {
    const response = await fetchFromBackend(`/paymongo/checkout-session/${pending.checkoutSessionId}`, {
      headers: await buildAuthHeaders(),
    })
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

    await finalizeSuccessfulOrder(pending, payload)
    clearPendingPayMongoState()
    toast.success('Order paid successfully.')
    await router.replace({ name: 'customer-orders' })
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Failed to finalize PayMongo payment.')
    await router.replace({ name: 'customer-checkout' })
  } finally {
    saving.value = false
  }
}

const prefillDeliveryInfo = async (user) => {
  if (!user) return
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid))
    if (userSnap.exists()) {
      const data = userSnap.data() || {}
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
      if (!delivery.value.fullName && fullName) delivery.value.fullName = fullName
      if (!delivery.value.address && data.address) delivery.value.address = String(data.address || '')
      if (!delivery.value.phone && data.contactNumber) delivery.value.phone = String(data.contactNumber || '')
    }
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  selectedItems.value = readCheckoutItems()
  if (!selectedItems.value.length && !loadPendingPayMongoState()) {
    router.push({ name: 'customer-cart' })
    return
  }

  const currentUser = auth.currentUser
  if (currentUser) {
    prefillDeliveryInfo(currentUser)
    handlePayMongoReturn()
    return
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      prefillDeliveryInfo(user)
      handlePayMongoReturn()
    }
    unsubscribe()
  })
})
</script>
