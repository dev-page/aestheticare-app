<template>
  <div class="checkout-shell">
    <div class="checkout-glow checkout-glow-left"></div>
    <div class="checkout-glow checkout-glow-right"></div>

    <div class="checkout-wrap">
      <Transition name="checkout-panel" appear>
        <section v-if="showPanels" class="checkout-panel delay-0 checkout-form-card">
          <p class="checkout-eyebrow">Subscription Checkout</p>
          <h1 class="checkout-title">Complete Your Plan Payment</h1>
          <p class="checkout-subtitle">Choose a payment method for PayMongo and confirm your clinic plan with confidence.</p>

          <div v-if="error" class="checkout-error">
            {{ error }}
          </div>

          <div class="checkout-form-grid">
            <div class="field-block">
              <label class="field-label">First Name</label>
              <input
                v-model="payerFirstName"
                type="text"
                class="field-input"
                :class="{ 'field-input-error': fieldErrors.firstName }"
                placeholder="Enter first name"
                @input="validateField('firstName')"
              />
              <p v-if="fieldErrors.firstName" class="field-error">{{ fieldErrors.firstName }}</p>
            </div>

            <div class="field-block">
              <label class="field-label">Last Name</label>
              <input
                v-model="payerLastName"
                type="text"
                class="field-input"
                :class="{ 'field-input-error': fieldErrors.lastName }"
                placeholder="Enter last name"
                @input="validateField('lastName')"
              />
              <p v-if="fieldErrors.lastName" class="field-error">{{ fieldErrors.lastName }}</p>
            </div>

            <div class="field-block field-block-wide">
              <label class="field-label">Email Address</label>
              <input
                v-model="payerEmail"
                type="email"
                class="field-input"
                :class="{ 'field-input-error': fieldErrors.email }"
                placeholder="Enter email"
                @input="validateField('email')"
              />
              <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</p>
            </div>

            <div class="field-block field-block-wide">
              <label class="field-label">Payment Method</label>
              <select
                v-model="paymentMethod"
                class="field-input field-select"
                :class="{ 'field-input-error': fieldErrors.paymentMethod }"
                @change="validateField('paymentMethod')"
              >
                <option value="" disabled>Select Payment Method</option>
                <option value="GCash">GCash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
              <p v-if="fieldErrors.paymentMethod" class="field-error">{{ fieldErrors.paymentMethod }}</p>
            </div>
          </div>

          <div class="checkout-actions">
            <button
              type="button"
              class="btn-primary"
              :disabled="saving || !selectedPlan"
              @click="startPayMongoCheckout"
            >
              {{ saving ? 'Redirecting...' : 'Proceed to PayMongo' }}
            </button>

            <button
              type="button"
              class="btn-secondary"
              @click="goBack"
            >
              Back to Plans
            </button>
          </div>
        </section>
      </Transition>

      <Transition name="checkout-panel" appear>
        <section v-if="showPanels" class="checkout-panel delay-1 checkout-summary-card">
          <div class="summary-head">
            <div>
              <p class="summary-eyebrow">Selected plan</p>
              <h2 class="summary-title">Order Summary</h2>
            </div>
            <span v-if="selectedPlan" class="summary-plan-chip">{{ selectedPlan.id }}</span>
          </div>

          <div v-if="selectedPlan" class="summary-content">
            <div class="summary-hero">
              <p class="summary-plan-name">{{ selectedPlan.name }}</p>
              <p class="summary-plan-copy">{{ selectedPlan.description }}</p>
            </div>

            <div class="summary-stats">
              <div class="summary-stat">
                <span>Billing Cycle</span>
                <strong>{{ selectedPlan.billingCycle || '-' }}</strong>
              </div>
              <div class="summary-stat">
                <span>Amount Due</span>
                <strong>{{ formatCurrency(selectedPlan.price) }}</strong>
              </div>
            </div>

            <div class="summary-feature-panel">
              <p class="summary-feature-label">Included Features</p>
              <ul class="summary-feature-list">
                <li v-for="feature in selectedPlan.features" :key="feature">{{ feature }}</li>
              </ul>
            </div>
          </div>

          <div v-else class="summary-empty">No paid plan selected. Please go back and choose Basic or Premium.</div>
        </section>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { addDoc, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { auth, db } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'

const route = useRoute()
const router = useRouter()
const subscriptionStore = useSubscriptionStore()

const PENDING_PAYMONGO_KEY = 'subscription_checkout_pending_paymongo'

const saving = ref(false)
const error = ref('')
const plans = ref([])
const showPanels = ref(false)

const payerFirstName = ref('')
const payerLastName = ref('')
const payerEmail = ref('')
const paymentMethod = ref('')
const fieldErrors = ref({
  firstName: '',
  lastName: '',
  email: '',
  paymentMethod: ''
})

const shouldPrefill = computed(() => String(route.query.from || '').trim().toLowerCase() === 'owner')

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

const validateField = (field) => {
  if (field === 'firstName') {
    fieldErrors.value.firstName = payerFirstName.value.trim() ? '' : 'First name is required.'
  }
  if (field === 'lastName') {
    fieldErrors.value.lastName = payerLastName.value.trim() ? '' : 'Last name is required.'
  }
  if (field === 'email') {
    if (!payerEmail.value.trim()) {
      fieldErrors.value.email = 'Email is required.'
    } else if (!emailRegex.test(payerEmail.value.trim())) {
      fieldErrors.value.email = 'Enter a valid email address.'
    } else {
      fieldErrors.value.email = ''
    }
  }
  if (field === 'paymentMethod') {
    fieldErrors.value.paymentMethod = paymentMethod.value ? '' : 'Please select a payment method.'
  }
}

const defaultPlans = () => [
  {
    id: 'free-trial',
    name: 'Free Trial',
    price: 0,
    billingCycle: 'trial',
    description: 'For new clinics trying the platform.',
    features: ['Core modules', 'Limited users', 'Email support'],
    isActive: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 999,
    billingCycle: 'month',
    description: 'Essential tools for daily clinic operations.',
    features: ['Scheduling & billing', 'Staff management', 'Reports'],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2499,
    billingCycle: 'month',
    description: 'Advanced features and priority support.',
    features: ['Everything in Basic', 'Advanced analytics', 'Priority support'],
    isActive: true,
  },
]

const normalizePlanId = (value) => String(value || '').trim().toLowerCase()
const toCentavos = (pesoAmount) => Math.round(Number(pesoAmount || 0) * 100)

const selectedPlanId = computed(() => normalizePlanId(route.query.plan))

const selectedPlan = computed(() => {
  return plans.value.find((plan) => plan.id === selectedPlanId.value && plan.id !== 'free-trial') || null
})

const PLAN_PRIORITIES = {
  free: 0,
  'free-trial': 0,
  basic: 1,
  premium: 2,
}

const formatCurrency = (amount) => {
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP', currencyDisplay: 'code',
    minimumFractionDigits: 2,
  }).format(safe)
}

const fetchFromBackend = async (path, options = {}) => {
  let lastError = null

  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
    if (!String(baseUrl || '').trim()) continue
    try {
      const response = await fetch(`${baseUrl}${path}`, options)
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

  throw lastError || new Error('Subscription backend is not reachable.')
}

const getCurrentUser = async () => {
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user)
    })
  })
}

const buildBackendHeaders = async (withAuth = false, baseHeaders = {}) => {
  const headers = { ...baseHeaders }
  if (!withAuth) return headers
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated.')
  }
  const idToken = await currentUser.getIdToken()
  headers.authorization = `Bearer ${idToken}`
  return headers
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

const getPlanPriority = (planId) => PLAN_PRIORITIES[normalizePlanId(planId)] ?? 0

const loadPlans = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'subscriptionPlans'))
    const dbPlans = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))

    plans.value = defaultPlans().map((base) => {
      const dbPlan = dbPlans.get(base.id) || {}
      return {
        ...base,
        ...dbPlan,
        id: base.id,
        features: Array.isArray(dbPlan.features) ? dbPlan.features : base.features,
        isActive: dbPlan.isActive !== false,
      }
    })
  } catch (err) {
    console.error('Failed to load plans for checkout:', err)
    plans.value = defaultPlans()
  }
}

const validateForm = () => {
  if (!selectedPlan.value) {
    error.value = 'Please select Basic or Premium plan first.'
    return false
  }
  if (!selectedPlan.value.isActive) {
    error.value = 'Selected plan is currently inactive.'
    return false
  }
  validateField('firstName')
  validateField('lastName')
  validateField('email')
  validateField('paymentMethod')

  if (fieldErrors.value.firstName || fieldErrors.value.lastName || fieldErrors.value.email || fieldErrors.value.paymentMethod) {
    return false
  }

  error.value = ''
  return true
}

const applyPrefill = (data = {}) => {
  if (!data) return
  if (!payerFirstName.value && data.firstName) {
    payerFirstName.value = String(data.firstName || '').trim()
  }
  if (!payerLastName.value && data.lastName) {
    payerLastName.value = String(data.lastName || '').trim()
  }
  if (!payerEmail.value && data.email) {
    payerEmail.value = String(data.email || '').trim().toLowerCase()
  }
  validateField('firstName')
  validateField('lastName')
  validateField('email')
}

const prefillFromAccount = async () => {
  if (!shouldPrefill.value) return
  const currentUser = auth.currentUser || await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user)
    })
  })
  if (!currentUser) return
  try {
    const userSnap = await getDoc(doc(db, 'users', currentUser.uid))
    const userData = userSnap.exists() ? userSnap.data() : {}
    applyPrefill({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email || currentUser.email
    })
  } catch (err) {
    console.error('Failed to prefill payer info:', err)
  }
}

const createPayMongoCheckoutSession = async () => {
  const method = String(paymentMethod.value || '').trim()
  const paymentMethodTypes =
    method === 'Card'
      ? ['card']
      : method === 'GCash'
        ? ['gcash']
        : method === 'Bank Transfer'
          ? ['dob', 'dob_ubp', 'brankas_bdo', 'brankas_landbank', 'brankas_metrobank']
          : null
  const referenceNumber = `SUB-${Date.now()}`
  const payerName = `${payerFirstName.value || ''} ${payerLastName.value || ''}`.trim()

const flowSuffix = shouldPrefill.value ? '&from=owner' : ''
const successUrl = `${window.location.origin}/subscription/checkout?plan=${selectedPlan.value.id}&paymongo_status=success${flowSuffix}`
const cancelUrl = `${window.location.origin}/subscription/checkout?plan=${selectedPlan.value.id}&paymongo_status=cancelled${flowSuffix}`

  const response = await fetchFromBackend('/paymongo/create-checkout-session', {
    method: 'POST',
    headers: await buildBackendHeaders(shouldPrefill.value, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      amount: toCentavos(selectedPlan.value.price),
      ...(paymentMethodTypes ? { paymentMethodTypes } : {}),
      description: `Subscription Payment - ${selectedPlan.value.name}`,
      referenceNumber,
      billing: {
        name: payerName,
        email: payerEmail.value.trim().toLowerCase(),
      },
      metadata: {
        module: 'subscription',
        planId: selectedPlan.value.id,
        billingCycle: selectedPlan.value.billingCycle || 'month',
        payerFirstName: payerFirstName.value.trim(),
        payerLastName: payerLastName.value.trim(),
        payerEmail: payerEmail.value.trim().toLowerCase(),
        preferredPaymentMethod: method,
      },
      lineItems: [
        {
          name: selectedPlan.value.name,
          amount: toCentavos(selectedPlan.value.price),
          currency: 'PHP', currencyDisplay: 'code',
          quantity: 1,
        },
      ],
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

  return { session: payload.data, referenceNumber }
}

const startPayMongoCheckout = async () => {
  if (!validateForm()) return

  saving.value = true
  try {
    const { session, referenceNumber } = await createPayMongoCheckoutSession()

    savePendingPayMongoState({
      checkoutSessionId: session.id,
      planId: selectedPlan.value.id,
      planName: selectedPlan.value.name,
      amount: Number(selectedPlan.value.price || 0),
      billingCycle: selectedPlan.value.billingCycle || 'month',
      referenceNumber,
      payerFirstName: payerFirstName.value.trim(),
      payerLastName: payerLastName.value.trim(),
      payerEmail: payerEmail.value.trim().toLowerCase(),
      paymentMethod: paymentMethod.value,
      createdAt: Date.now(),
    })

    window.location.href = session.checkout_url
  } catch (err) {
    console.error(err)
    error.value = err?.message || 'Failed to start PayMongo checkout.'
    saving.value = false
  }
}

const handlePayMongoReturn = async () => {
  const status = String(route.query.paymongo_status || '').toLowerCase()
  if (!status) return

  const pending = loadPendingPayMongoState()
  if (!pending?.checkoutSessionId) {
    error.value = 'No pending PayMongo payment found.'
    await router.replace({ path: '/subscription/checkout', query: { plan: selectedPlanId.value || 'basic' } })
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
    await router.replace({ path: '/subscription/checkout', query: { plan: pending.planId || selectedPlanId.value || 'basic' } })
    return
  }

  if (status !== 'success') return

  saving.value = true
  try {
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

    const payments = Array.isArray(payload?.data?.payments) ? payload.data.payments : []
    const firstPayment = payments[0] || {}
    const paymentAttrs = firstPayment?.attributes || {}
    const paymentMethodType =
      paymentAttrs?.payment_method?.type ||
      paymentAttrs?.source?.type ||
      paymentAttrs?.type ||
      null

    const subscriptionAction = payload?.data?.subscriptionAction || null

    const paymentDoc = await addDoc(collection(db, 'planPayments'), {
      planId: pending.planId,
      planName: pending.planName,
      amount: Number(pending.amount || 0),
      currency: 'PHP', currencyDisplay: 'code',
      billingCycle: pending.billingCycle || 'month',
      payerFirstName: pending.payerFirstName,
      payerLastName: pending.payerLastName,
      payerName: `${pending.payerFirstName || ''} ${pending.payerLastName || ''}`.trim(),
      payerEmail: pending.payerEmail,
      paymentMethod: paymentMethodType,
      referenceNumber: pending.referenceNumber,
      paymongoCheckoutSessionId: pending.checkoutSessionId,
      paymongoStatus: payload?.data?.status || null,
      paymongoPaidAt: payload?.data?.paid_at || null,
      paymongoPaymentId: firstPayment?.id || null,
      subscriptionAction: subscriptionAction?.action || null,
      subscriptionActionEffectiveAt: subscriptionAction?.effectiveAt || null,
      subscriptionActionMessage: subscriptionAction?.message || null,
      status: 'Paid',
      source: 'paymongo_checkout',
      createdAt: serverTimestamp(),
    })

    try {
      await fetchFromBackend('/send-payment-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipient: pending.payerEmail,
          payerName: `${pending.payerFirstName || ''} ${pending.payerLastName || ''}`.trim(),
          planName: pending.planName,
          amount: Number(pending.amount || 0),
          currency: 'PHP', currencyDisplay: 'code',
          referenceNumber: pending.referenceNumber,
          paymentMethod: paymentMethodType,
        }),
      })
    } catch (emailError) {
      console.error('Failed to send payment receipt email:', emailError)
    }

    clearPendingPayMongoState()

    const currentUser = await getCurrentUser()

    if (shouldPrefill.value && currentUser) {
      const currentPlan = normalizePlanId(subscriptionStore.activePlan || '')
      const targetPlan = normalizePlanId(pending.planId || '')
      const shouldApplyImmediateFallback =
        subscriptionAction?.action !== 'scheduled_downgrade' &&
        targetPlan &&
        getPlanPriority(targetPlan) >= getPlanPriority(currentPlan)

      if (shouldApplyImmediateFallback) {
        const planDays = targetPlan === 'free-trial' ? 14 : 30
        const startedAt = subscriptionAction?.effectiveAt ? new Date(subscriptionAction.effectiveAt) : new Date()
        const parsedExpiresAt = subscriptionAction?.expiresAt ? new Date(subscriptionAction.expiresAt) : null
        const expiresAt =
          parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime())
            ? parsedExpiresAt
            : new Date(startedAt.getTime() + planDays * 24 * 60 * 60 * 1000)
        const immediatePayload = {
          subscriptionPlan: targetPlan,
          paymentStatus: 'Paid',
          paymentId: paymentDoc.id,
          subscriptionStartedAt: startedAt,
          subscriptionExpiresAt: expiresAt,
          pendingSubscriptionPlan: deleteField(),
          pendingSubscriptionApplyAt: deleteField(),
          pendingSubscriptionRequestedAt: deleteField(),
          pendingSubscriptionChangeType: deleteField(),
          pendingSubscriptionPaymentId: deleteField(),
          pendingSubscriptionPaidAt: deleteField(),
          pendingSubscriptionNextExpiresAt: deleteField(),
          pendingSubscriptionBillingCycle: deleteField(),
        }

        await Promise.all([
          setDoc(doc(db, 'users', currentUser.uid), immediatePayload, { merge: true }),
          setDoc(doc(db, 'clinics', currentUser.uid), immediatePayload, { merge: true }),
        ])
      }

      await subscriptionStore.refreshSubscription()

      await Swal.fire({
        title: subscriptionAction?.action === 'scheduled_downgrade' ? 'Plan Change Scheduled' : 'Payment Successful',
        text:
          subscriptionAction?.action === 'scheduled_downgrade'
            ? (subscriptionAction?.message || 'Your plan change will take effect after the current billing cycle.')
            : 'Redirecting you back to your subscription settings.',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      })

      await router.replace({ path: '/owner/account/subscription' })
      return
    }

    await Swal.fire({
      title: 'Payment Successful',
      text: 'Redirecting you to clinic registration.',
      icon: 'success',
      timer: 1400,
      showConfirmButton: false,
    })

    try {
      sessionStorage.setItem('register_clinic_draft', JSON.stringify({
        email: pending.payerEmail,
        firstName: pending.payerFirstName,
        lastName: pending.payerLastName,
        selectedPlan: pending.planId,
        paymentStatus: 'paid',
        paymentId: paymentDoc.id,
      }))
      if (pending.payerEmail) {
        sessionStorage.setItem('resume_email', pending.payerEmail)
      }
    } catch (_error) {
      // ignore session storage failures
    }

    await router.replace({
      name: 'register',
      query: {
        account: 'clinic',
        plan: pending.planId,
        paymentId: paymentDoc.id,
        paymentStatus: 'paid',
        firstName: pending.payerFirstName,
        lastName: pending.payerLastName,
        email: pending.payerEmail,
      },
    })
  } catch (err) {
    console.error(err)
    error.value = err?.message || 'Failed to finalize PayMongo payment.'
    await router.replace({ path: '/subscription/checkout', query: { plan: pending.planId || selectedPlanId.value || 'basic' } })
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (shouldPrefill.value) {
    router.push({ path: '/owner/account/plans', query: { plan: selectedPlanId.value || 'basic' } })
    return
  }
  router.push({ name: 'subscription-features', query: { plan: selectedPlanId.value || 'basic' } })
}

onMounted(async () => {
  showPanels.value = true
  await loadPlans()
  await handlePayMongoReturn()
  await prefillFromAccount()
})

onBeforeRouteLeave((_to, _from, next) => {
  if (!showPanels.value) {
    next()
    return
  }
  showPanels.value = false
  window.setTimeout(() => next(), 260)
})
</script>

<style scoped>
.checkout-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.46), transparent 28%),
    radial-gradient(circle at 82% 14%, rgba(198, 148, 108, 0.22), transparent 24%),
    linear-gradient(180deg, #fffdf8 0%, #fbf3e6 52%, #f8ecda 100%);
}

.checkout-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(70px);
  opacity: 0.55;
  pointer-events: none;
}

.checkout-glow-left {
  top: 4rem;
  left: -3rem;
  width: 15rem;
  height: 15rem;
  background: rgba(241, 212, 170, 0.58);
}

.checkout-glow-right {
  right: -3rem;
  bottom: 2rem;
  width: 16rem;
  height: 16rem;
  background: rgba(181, 127, 92, 0.22);
}

.checkout-wrap {
  position: relative;
  z-index: 1;
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
  padding: 1rem 1rem 1.5rem;
}

.checkout-form-card,
.checkout-summary-card {
  border-radius: 1.75rem;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.checkout-form-card {
  border: 1px solid rgba(198, 148, 108, 0.28);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.78), rgba(255, 248, 237, 0.68));
  box-shadow: 0 18px 48px rgba(94, 63, 42, 0.1);
  padding: 1.35rem;
}

.checkout-summary-card {
  background:
    radial-gradient(circle at top right, rgba(255, 221, 170, 0.14), transparent 22%),
    linear-gradient(165deg, #2a1a11 0%, #342116 52%, #24160f 100%);
  color: #fdf2e3;
  border: 1px solid rgba(198, 148, 108, 0.16);
  box-shadow: 0 24px 56px rgba(42, 26, 17, 0.24);
  padding: 1.35rem;
}

.checkout-eyebrow,
.summary-eyebrow {
  margin: 0 0 0.55rem;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.24em;
}

.checkout-eyebrow {
  color: #a56b44;
}

.summary-eyebrow {
  color: rgba(241, 212, 170, 0.7);
}

.checkout-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 4vw, 3.15rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: #40281c;
}

.checkout-subtitle {
  margin: 0.65rem 0 0;
  max-width: 38rem;
  color: #6c5140;
  font-size: 0.96rem;
  line-height: 1.6;
}

.checkout-error {
  margin-top: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(235, 115, 115, 0.36);
  background: rgba(255, 241, 241, 0.86);
  color: #b53f3f;
  padding: 0.85rem 0.95rem;
  font-size: 0.9rem;
}

.checkout-form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 1.4rem;
}

.field-block {
  display: grid;
  gap: 0.45rem;
}

.field-label {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: #8b5b3d;
}

.field-input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.95);
  background: rgba(255, 255, 255, 0.86);
  padding: 0.95rem 1rem;
  color: #342419;
  font-size: 0.96rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.field-input::placeholder {
  color: #9b816d;
}

.field-input:focus {
  border-color: rgba(198, 148, 108, 0.95);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.field-select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #7b4f37 50%),
    linear-gradient(135deg, #7b4f37 50%, transparent 50%);
  background-position:
    calc(100% - 24px) calc(50% - 3px),
    calc(100% - 18px) calc(50% - 3px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 3rem;
}

.field-input-error {
  border-color: rgba(232, 90, 90, 0.7);
}

.field-error {
  margin: 0;
  font-size: 0.8rem;
  color: #c34a4a;
}

.checkout-actions {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.35rem;
}

.btn-primary,
.btn-secondary {
  width: 100%;
  border-radius: 1rem;
  padding: 1rem 1.15rem;
  font-size: 0.98rem;
  font-weight: 700;
  transition: transform 0.2s ease, filter 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.btn-primary {
  border: 1px solid transparent;
  color: #fff8f0;
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  box-shadow: 0 18px 34px rgba(122, 75, 47, 0.16);
}

.btn-primary:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  border: 1px solid rgba(198, 148, 108, 0.36);
  color: #6b4631;
  background: rgba(255, 255, 255, 0.54);
}

.btn-secondary:hover {
  background: rgba(255, 248, 235, 0.95);
  transform: translateY(-1px);
}

.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(241, 212, 170, 0.12);
}

.summary-title {
  margin: 0;
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
  font-size: clamp(1.6rem, 2.4vw, 2.3rem);
  line-height: 1;
  letter-spacing: -0.03em;
  color: #fff3e5;
}

.summary-plan-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(241, 212, 170, 0.2);
  background: rgba(241, 212, 170, 0.08);
  color: #f6d8b3;
  padding: 0.45rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.summary-content {
  margin-top: 1.15rem;
  display: grid;
  gap: 1rem;
}

.summary-hero {
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(241, 212, 170, 0.08);
  padding: 1rem;
}

.summary-plan-name {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff8ef;
}

.summary-plan-copy {
  margin: 0.45rem 0 0;
  color: rgba(253, 242, 227, 0.72);
  line-height: 1.6;
  font-size: 0.92rem;
}

.summary-stats {
  display: grid;
  gap: 0.75rem;
}

.summary-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(241, 212, 170, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 0.9rem 1rem;
}

.summary-stat span {
  color: rgba(253, 242, 227, 0.68);
  font-size: 0.88rem;
}

.summary-stat strong {
  color: #fff6eb;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: capitalize;
}

.summary-feature-panel {
  border-top: 1px solid rgba(241, 212, 170, 0.12);
  padding-top: 1rem;
}

.summary-feature-label {
  margin: 0 0 0.75rem;
  color: rgba(241, 212, 170, 0.76);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.summary-feature-list {
  display: grid;
  gap: 0.6rem;
}

.summary-feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  color: #fdf2e3;
  line-height: 1.55;
  font-size: 0.92rem;
}

.summary-feature-list li::before {
  content: "\2713";
  color: #f1d4aa;
  font-weight: 700;
}

.summary-empty {
  margin-top: 1rem;
  color: #f4c2c2;
  font-size: 0.95rem;
}

.checkout-panel-enter-active,
.checkout-panel-leave-active {
  transition: opacity 0.32s ease, transform 0.32s ease;
}

.checkout-panel-enter-from,
.checkout-panel-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

.checkout-panel-enter-active.delay-1 {
  transition-delay: 120ms;
}

.checkout-panel-leave-active.delay-1 {
  transition-delay: 0ms;
}

@media (min-width: 768px) {
  .checkout-wrap {
    padding: 1.25rem 1.25rem 1.8rem;
  }

  .checkout-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-block-wide {
    grid-column: 1 / -1;
  }

  .checkout-actions {
    grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
    align-items: center;
  }
}

@media (min-width: 1024px) {
  .checkout-wrap {
    grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
    gap: 1.4rem;
    padding-top: 1.5rem;
  }

  .checkout-form-card,
  .checkout-summary-card {
    padding: 1.6rem;
  }

  .checkout-summary-card {
    min-height: 100%;
  }
}
</style>
