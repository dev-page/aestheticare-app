<template>
  <div class="checkout-page flex customer-theme min-h-screen">
    <CustomerSidebar />

    <main class="checkout-main flex-1 p-4 md:p-8">
      <button
        type="button"
        class="mb-3 inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        @click="goBack"
      >
        <span class="text-lg leading-none">‹</span>
        <span class="text-sm font-medium">Back</span>
      </button>

      <div class="checkout-hero mb-6">
        <p class="checkout-eyebrow">Secure Checkout</p>
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="checkout-title">Checkout</h2>
            <p class="checkout-subtitle">Review your order, fill in delivery details, and choose a payment method.</p>
          </div>
          <div class="checkout-stat-chip">
            <Icon icon="mdi:cart-outline" class="h-5 w-5" />
            <span>{{ selectedItems.length }} item{{ selectedItems.length === 1 ? '' : 's' }}</span>
          </div>
        </div>
      </div>

      <h1 class="sr-only">Checkout</h1>

      <div class="checkout-panel mb-8">
        <div class="checkout-panel-head">
          <div>
            <p class="checkout-panel-kicker">Order Summary</p>
            <h2 class="checkout-panel-title">Selected items</h2>
          </div>
          <span class="checkout-count-pill">{{ selectedItems.length }}</span>
        </div>

        <div v-if="selectedItems.length" class="mt-5 space-y-3">
          <div
            v-for="item in selectedItems"
            :key="item.id"
            class="checkout-item-card flex items-start gap-4 rounded-2xl border border-[#ead4b7] bg-[#fffaf3] p-4"
          >
            <div class="checkout-item-thumb flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5e4cf]">
              <Icon icon="mdi:package-variant" class="h-7 w-7 text-[#8b5a3f]" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-semibold text-[#3d281d]">{{ item.name }}</p>
                  <p class="mt-1 text-xs text-[#8b6a4d]">Variation: {{ item.variation || 'Default' }}</p>
                  <p class="text-xs text-[#8b6a4d]">Qty: {{ item.quantity }}</p>
                </div>
                <p class="shrink-0 font-semibold text-[#6f4329]">
                  PHP {{ (Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2) }}
                </p>
              </div>
              <p class="mt-2 text-xs text-[#8b6a4d]">Center: {{ item.branchName || 'AesthetiCare' }}</p>
            </div>
          </div>
        </div>

        <p v-else class="mt-4 rounded-2xl border border-dashed border-[#e0c09a] bg-[#fffaf3] px-4 py-5 text-sm text-[#8b6a4d]">
          No items were selected for checkout.
        </p>

        <div class="mt-5 rounded-2xl border border-[#ead4b7] bg-[#fff2e0] p-4">
          <div class="space-y-3">
            <div class="checkout-summary-row">
              <span>Subtotal</span>
              <strong>PHP {{ subtotal.toFixed(2) }}</strong>
            </div>
            <div class="checkout-summary-row">
              <span>System commission ({{ productCommissionPercent }}%)</span>
              <strong>PHP {{ commissionAmount.toFixed(2) }}</strong>
            </div>
            <div class="checkout-summary-row checkout-summary-row-total">
              <span>Total due</span>
              <strong>PHP {{ subtotal.toFixed(2) }}</strong>
            </div>
            <div class="checkout-summary-row checkout-summary-row-muted">
              <span>Clinic share after commission</span>
              <strong>PHP {{ merchantNetAmount.toFixed(2) }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="checkout-panel mb-8">
        <div class="checkout-panel-head">
          <div>
            <p class="checkout-panel-kicker">Delivery Information</p>
            <h2 class="checkout-panel-title">Where should we reach you?</h2>
          </div>
          <Icon icon="mdi:account-box-outline" class="h-5 w-5 text-[#8b6a4d]" />
        </div>
        <form class="mt-5 grid gap-4 md:grid-cols-2" @submit.prevent>
          <label class="checkout-field md:col-span-2">
            <span>Full Name</span>
            <div class="checkout-input-wrap">
              <Icon icon="mdi:account-outline" class="h-4 w-4 text-[#a77d57]" />
              <input type="text" placeholder="Your full name" v-model="delivery.fullName" />
            </div>
          </label>
          <label class="checkout-field md:col-span-2">
            <span>Address</span>
            <div class="checkout-input-wrap">
              <Icon icon="mdi:map-marker-outline" class="h-4 w-4 text-[#a77d57]" />
              <input type="text" placeholder="Street, barangay, city" v-model="delivery.address" />
            </div>
          </label>
          <label class="checkout-field md:col-span-2">
            <span>Phone Number</span>
            <div class="checkout-input-wrap">
              <Icon icon="mdi:phone-outline" class="h-4 w-4 text-[#a77d57]" />
              <input type="text" placeholder="09xxxxxxxxx" v-model="delivery.phone" />
            </div>
          </label>
        </form>
      </div>

      <div class="checkout-panel mb-8">
        <div class="checkout-panel-head">
          <div>
            <p class="checkout-panel-kicker">Payment Method</p>
            <h2 class="checkout-panel-title">Choose how to pay</h2>
          </div>
          <Icon icon="mdi:credit-card-outline" class="h-5 w-5 text-[#8b6a4d]" />
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label class="payment-option" :class="paymentMethod === 'GCash' ? 'is-selected' : ''">
            <input type="radio" value="GCash" v-model="paymentMethod" />
            <div class="payment-option-icon">
              <Icon icon="simple-icons:gcash" class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-[#3d281d]">GCash</p>
              <p class="text-xs text-[#8b6a4d]">Fast mobile wallet payment</p>
            </div>
          </label>

          <label class="payment-option" :class="paymentMethod === 'Card' ? 'is-selected' : ''">
            <input type="radio" value="Card" v-model="paymentMethod" />
            <div class="payment-option-icon">
              <Icon icon="mdi:credit-card-outline" class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-[#3d281d]">Card</p>
              <p class="text-xs text-[#8b6a4d]">Debit or credit card checkout</p>
            </div>
          </label>
        </div>
        <p class="mt-4 text-xs text-[#8b6a4d]">Payment is processed in full through PayMongo before the order is created.</p>
      </div>

      <div class="checkout-panel mb-8">
        <div class="checkout-panel-head">
          <div>
            <p class="checkout-panel-kicker">Delivery Location</p>
            <h2 class="checkout-panel-title">Customer address details</h2>
          </div>
          <Icon icon="mdi:map-outline" class="h-5 w-5 text-[#8b6a4d]" />
        </div>

        <div class="mt-5 space-y-4">
          <p class="text-sm leading-relaxed text-[#6f4a2d]">
            {{ delivery.address || 'No detailed address has been saved yet.' }}
          </p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="checkout-location-box">
              <p class="checkout-location-label">City / Municipality</p>
              <p class="checkout-location-value mt-1">{{ delivery.addressCity || '-' }}</p>
            </div>
            <div class="checkout-location-box">
              <p class="checkout-location-label">Barangay</p>
              <p class="checkout-location-value mt-1">{{ delivery.addressBarangay || '-' }}</p>
            </div>
            <div class="checkout-location-box">
              <p class="checkout-location-label">Actual Location</p>
              <p class="checkout-location-value mt-1">{{ delivery.address || '-' }}</p>
            </div>
            <div class="checkout-location-box">
              <p class="checkout-location-label">Postal Code</p>
              <p class="checkout-location-value mt-1">{{ delivery.addressPostalCode || '-' }}</p>
            </div>
          </div>

          <div class="overflow-hidden rounded-2xl border border-[#e0c09a] bg-[#fffaf3]">
            <div ref="checkoutLocationMapEl" class="checkout-location-map"></div>
            <p v-if="!hasDeliveryLocationCoords" class="border-t border-[#ead6b8] px-4 py-3 text-xs text-[#8b6a4d]">
              Add a pinned location in your profile so the checkout map can show it.
            </p>
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          :disabled="saving"
          @click="startPayMongoCheckout"
          class="checkout-submit inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          <Icon v-if="!saving" icon="mdi:lock-check-outline" class="h-5 w-5" />
          <Icon v-else icon="mdi:progress-clock" class="h-5 w-5 animate-spin" />
          {{ saving ? 'Processing...' : 'Proceed to Payment' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { clearCheckoutItems, readCart, readCheckoutItems, writeCart } from '@/utils/customerCart'
import { calculateCommissionAmount, calculateNetAmount, getProductCommissionPercent } from '@/utils/transactionFees'
import { toast } from 'vue3-toastify'
import { onAuthStateChanged } from 'firebase/auth'
import Swal from 'sweetalert2'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

const router = useRouter()
const route = useRoute()
const selectedItems = ref([])
const paymentMethod = ref('GCash')
const saving = ref(false)

const PENDING_PAYMONGO_KEY = 'customer_checkout_pending_paymongo'

const delivery = ref({
  fullName: '',
  address: '',
  addressCity: '',
  addressBarangay: '',
  addressPostalCode: '',
  addressLat: '',
  addressLng: '',
  phone: '',
})

const checkoutLocationMapEl = ref(null)
const hasDeliveryLocationCoords = computed(() => {
  const lat = Number(delivery.value.addressLat || 0)
  const lng = Number(delivery.value.addressLng || 0)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.0001 && Math.abs(lng) > 0.0001
})

let mapsReady = false
let deliveryMap = null
let deliveryMarker = null
let geocoder = null
const philippinesBounds = { north: 21.5, south: 4.3, east: 127.5, west: 116.0 }
const defaultPhilippinesCenter = { lat: 12.8797, lng: 121.774 }

const subtotal = computed(() => selectedItems.value.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0))
const productCommissionPercent = getProductCommissionPercent()
const commissionAmount = computed(() => calculateCommissionAmount(subtotal.value, productCommissionPercent))
const merchantNetAmount = computed(() => calculateNetAmount(subtotal.value, commissionAmount.value))

const flattenAddressComponents = (results = []) =>
  (results || []).flatMap((entry) => entry?.address_components || [])

const getAddressComponentValue = (components, type) => {
  const preferredTypes = Array.isArray(type) ? type : [type]
  const match = (components || []).find((component) =>
    preferredTypes.some((preferredType) => component.types?.includes(preferredType))
  )
  return String(match?.long_name || '').trim()
}

const ensureGeocoder = () => {
  if (!geocoder && window.google?.maps?.Geocoder) {
    geocoder = new window.google.maps.Geocoder()
  }
  return geocoder
}

const loadMapsScript = () => {
  if (window.google?.maps?.Map || window.google?.maps?.importLibrary) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-js')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true })
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in environment.'))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-js'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async&v=weekly`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

const initDeliveryMap = async () => {
  if (!checkoutLocationMapEl.value) return

  try {
    if (!mapsReady) {
      await loadMapsScript()
      mapsReady = true
    }
  } catch (error) {
    console.error('Failed to load delivery map:', error)
    return
  }

  let MapCtor = window.google?.maps?.Map
  let AdvancedMarkerElement = window.google?.maps?.marker?.AdvancedMarkerElement
  if (window.google?.maps?.importLibrary) {
    try {
      const mapsLib = await window.google.maps.importLibrary('maps')
      MapCtor = mapsLib?.Map || MapCtor
      const markerLib = await window.google.maps.importLibrary('marker')
      AdvancedMarkerElement = markerLib?.AdvancedMarkerElement || AdvancedMarkerElement
    } catch (error) {
      console.error('Failed to import Google Maps libraries:', error)
    }
  }

  if (!MapCtor) return

  const lat = Number(delivery.value.addressLat)
  const lng = Number(delivery.value.addressLng)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
  const center = hasCoords ? { lat, lng } : defaultPhilippinesCenter

  if (!deliveryMap) {
    deliveryMap = new MapCtor(checkoutLocationMapEl.value, {
      center,
      zoom: hasCoords ? 15 : 6,
      restriction: { latLngBounds: philippinesBounds, strictBounds: true },
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
    })
  } else {
    deliveryMap.setCenter(center)
  }

  if (deliveryMarker?.setMap) {
    deliveryMarker.setMap(null)
  }
  deliveryMarker = null

  if (hasCoords) {
    if (AdvancedMarkerElement) {
      deliveryMarker = new AdvancedMarkerElement({
        map: deliveryMap,
        position: center,
      })
    } else if (window.google?.maps?.Marker) {
      deliveryMarker = new window.google.maps.Marker({
        map: deliveryMap,
        position: center,
      })
    }
  }
}

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
        source: 'paymongo_checkout',
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

watch(
  () => [delivery.value.addressLat, delivery.value.addressLng],
  async () => {
    await nextTick()
    await initDeliveryMap()
  }
)

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
      if (!delivery.value.addressCity && data.addressCity) delivery.value.addressCity = String(data.addressCity || '')
      if (!delivery.value.addressBarangay && data.addressBarangay) delivery.value.addressBarangay = String(data.addressBarangay || '')
      if (!delivery.value.addressPostalCode && data.addressPostalCode) delivery.value.addressPostalCode = String(data.addressPostalCode || '')
      if (!delivery.value.addressLat && data.addressLat) delivery.value.addressLat = String(data.addressLat || '')
      if (!delivery.value.addressLng && data.addressLng) delivery.value.addressLng = String(data.addressLng || '')
      if (!delivery.value.phone && data.contactNumber) delivery.value.phone = String(data.contactNumber || '')
    }
    await nextTick()
    await initDeliveryMap()
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

onUnmounted(() => {
  if (deliveryMarker?.setMap) deliveryMarker.setMap(null)
  deliveryMap = null
  deliveryMarker = null
})
</script>

<style scoped>
.checkout-page {
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.28), transparent 28%),
    radial-gradient(circle at 85% 10%, rgba(198, 148, 108, 0.12), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
  color: #3d281d;
}

.checkout-main {
  background: transparent;
}

.checkout-shell {
  width: 100%;
}

.checkout-main > button:first-of-type {
  border: 1px solid rgba(224, 192, 154, 0.95);
  background: #fffaf3;
  color: #6f4a2d;
  box-shadow: 0 8px 18px rgba(84, 54, 34, 0.08);
}

.checkout-main > button:first-of-type:hover {
  background: #fff2e0;
  color: #3d281d;
}

.checkout-hero {
  border: 1px solid rgba(224, 192, 154, 0.85);
  border-radius: 1.75rem;
  background: rgba(255, 251, 244, 0.94);
  box-shadow: 0 20px 48px rgba(84, 54, 34, 0.08);
  padding: 1.25rem 1.5rem;
}

.checkout-eyebrow {
  margin-bottom: 0.4rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8b6a4d;
}

.checkout-title {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #3d281d;
}

.checkout-subtitle {
  margin-top: 0.55rem;
  max-width: 52rem;
  color: #6f4a2d;
}

.checkout-stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(224, 192, 154, 0.95);
  border-radius: 999px;
  padding: 0.7rem 1rem;
  background: #fff6ea;
  color: #6f4329;
  font-weight: 700;
}

.checkout-panel {
  border: 1px solid rgba(224, 192, 154, 0.85);
  border-radius: 1.5rem;
  background: rgba(255, 251, 244, 0.96);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
  padding: 1.25rem;
}

.checkout-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.checkout-panel-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8b6a4d;
}

.checkout-panel-title {
  margin-top: 0.35rem;
  font-size: 1.15rem;
  font-weight: 800;
  color: #3d281d;
}

.checkout-count-pill {
  min-width: 2rem;
  padding: 0.3rem 0.65rem;
  border: 1px solid rgba(224, 192, 154, 0.95);
  border-radius: 999px;
  background: #fffaf3;
  color: #6f4329;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
}

.checkout-item-card {
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.checkout-item-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(84, 54, 34, 0.08);
}

.checkout-item-thumb {
  flex-shrink: 0;
}

.checkout-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
  color: #6f4a2d;
}

.checkout-summary-row strong {
  color: #3d281d;
}

.checkout-summary-row-total {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(224, 192, 154, 0.85);
  font-size: 1.03rem;
  font-weight: 800;
}

.checkout-summary-row-muted {
  color: #8b6a4d;
}

.checkout-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #6f4a2d;
  font-weight: 600;
}

.checkout-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(224, 192, 154, 0.95);
  border-radius: 1rem;
  background: #fffaf3;
  padding: 0.85rem 1rem;
}

.checkout-input-wrap input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: none;
  color: #3d281d;
}

.checkout-input-wrap input::placeholder {
  color: #a78a6e;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border: 1px solid rgba(224, 192, 154, 0.85);
  border-radius: 1.25rem;
  background: #fffaf3;
  padding: 1rem;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.payment-option:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(84, 54, 34, 0.08);
}

.payment-option input {
  margin: 0;
  accent-color: #8d5a3b;
}

.payment-option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.95rem;
  background: linear-gradient(135deg, rgba(141, 90, 59, 0.14), rgba(111, 67, 41, 0.08));
  color: #6f4a2d;
  flex-shrink: 0;
}

.payment-option.is-selected {
  border-color: rgba(141, 90, 59, 0.95);
  background: linear-gradient(180deg, rgba(255, 246, 234, 0.98), rgba(255, 241, 224, 0.98));
  box-shadow: 0 14px 28px rgba(111, 63, 42, 0.12);
}

.checkout-location-map {
  height: 18rem;
  width: 100%;
  background: #fffaf3;
}

.checkout-location-box {
  border: 1px solid rgba(224, 192, 154, 0.9);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(255, 249, 240, 0.98), rgba(250, 238, 220, 0.96));
  padding: 0.85rem 0.9rem;
}

.checkout-location-label {
  color: #8b6a4d;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.checkout-location-value {
  color: #3d281d;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35;
}

.checkout-submit {
  background: linear-gradient(135deg, #8d5a3b 0%, #6f4329 100%);
  box-shadow: 0 14px 26px rgba(111, 63, 42, 0.14);
}

.checkout-submit:hover:not(:disabled) {
  filter: brightness(1.03);
}

@media (min-width: 1024px) {
  .checkout-main {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}
</style>
