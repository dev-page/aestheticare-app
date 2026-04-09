<template>
  <div class="subscription-popup w-full">
    <div class="popup-top">
      <div>
        <p class="popup-eyebrow">AesthetiCare Plans</p>
        <h2 class="popup-title">Choose Your Plan</h2>
        <p class="popup-subtitle">
          Start with what fits your clinic today. You can always upgrade as your operations grow.
        </p>
      </div>
    </div>

    <p v-if="error" class="popup-subtitle" style="color:#b91c1c;">{{ error }}</p>

    <div v-if="isLoading" class="plan-grid plan-grid-skeleton">
      <div v-for="index in 3" :key="`skeleton-${index}`" class="plan-card skeleton-card">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-price"></div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-line skeleton-desc short"></div>
        <div class="skeleton-list">
          <div class="skeleton-line skeleton-item"></div>
          <div class="skeleton-line skeleton-item"></div>
          <div class="skeleton-line skeleton-item short"></div>
        </div>
        <div class="skeleton-chip"></div>
      </div>
    </div>

    <div v-else class="plan-grid">
      <button
        v-for="plan in plans"
        :key="plan.id"
        type="button"
        class="plan-card group"
        :class="{
          'plan-card-active': selectedPlan === plan.id,
          'plan-card-free': plan.id === 'free-trial',
          'plan-card-basic': plan.id === 'basic',
          'plan-card-premium': plan.id === 'premium'
        }"
        @click="selectedPlan = plan.id"
      >
        <span v-if="plan.id !== 'free-trial'" class="card-shine"></span>
        <span v-if="plan.id === 'premium'" class="plan-badge">Recommended</span>
        <p class="plan-name">{{ plan.name }}</p>
        <p class="plan-price">
          {{ plan.priceLabel }}
          <span class="plan-cycle">{{ plan.cycleLabel }}</span>
        </p>
        <p class="plan-desc">{{ plan.description }}</p>
        <ul class="plan-features">
          <li v-for="item in plan.features" :key="item">{{ item }}</li>
        </ul>
        <span
          v-if="selectedPlan === plan.id"
          class="plan-selected"
        >
          Selected
        </span>
      </button>
    </div>

    <div class="popup-actions" :class="{ 'popup-actions-skeleton': isLoading }">
      <button type="button" class="btn-secondary" @click="toggleResume">
        Continue Registration
      </button>
      <button type="button" class="btn-primary" @click="continueWithPlan">
        {{ ctaLabel }}
      </button>
    </div>

    <div v-if="showResume" class="resume-card">
      <label class="resume-label">Use the email you paid with</label>
      <input v-model="resumeEmail" type="email" placeholder="you@email.com" class="resume-input" />
      <p v-if="resumeError" class="resume-error">{{ resumeError }}</p>
      <button type="button" class="btn-primary" :disabled="resumeLoading" @click="resumeRegistration">
        {{ resumeLoading ? 'Checking...' : 'Continue to Registration' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'

const emit = defineEmits(['close'])
const router = useRouter()

const plans = ref([])
const selectedPlan = ref('free-trial')
const error = ref('')
const isLoading = ref(true)
const showResume = ref(false)
const resumeEmail = ref('')
const resumeError = ref('')
const resumeLoading = ref(false)
const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const defaultPlans = () => [
  {
    id: 'free-trial',
    name: 'Free Trial',
    price: 0,
    billingCycle: 'trial',
    description: 'Try all features for 14 days. No credit card required.',
    features: ['Core modules', 'Limited users', 'Email support'],
    trialDays: 14,
    isActive: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 999,
    billingCycle: 'month',
    description: 'Essential features for your clinic operations.',
    features: ['Scheduling & billing', 'Staff management', 'Reports'],
    trialDays: 0,
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2499,
    billingCycle: 'month',
    description: 'Full features including advanced analytics.',
    features: ['Everything in Basic', 'Advanced analytics', 'Priority support'],
    trialDays: 0,
    isActive: true,
  },
]

const formatCurrency = (amount) => {
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP', currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(safe)
}

const formatCycle = (cycle) => {
  const normalized = String(cycle || '').trim().toLowerCase()
  if (!normalized || normalized === 'trial') return ''
  if (normalized.startsWith('/')) return normalized
  return `/${normalized}`
}

const mergePlans = (dbPlansMap) => {
  return defaultPlans().map((basePlan) => {
    const dbPlan = dbPlansMap.get(basePlan.id) || {}
    const merged = {
      ...basePlan,
      ...dbPlan,
      id: basePlan.id,
      features: Array.isArray(dbPlan.features) ? dbPlan.features : basePlan.features,
    }

    return {
      ...merged,
      priceLabel: formatCurrency(merged.price),
      cycleLabel: formatCycle(merged.billingCycle),
      isActive: merged.isActive !== false,
      trialDays: Number(merged.trialDays || 0),
    }
  })
}

const loadPlans = async () => {
  error.value = ''
  isLoading.value = true
  try {
    const snapshot = await getDocs(collection(db, 'subscriptionPlans'))
    const dbPlans = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))
    const merged = mergePlans(dbPlans)
    const activePlans = merged.filter((plan) => plan.isActive)
    plans.value = activePlans.length ? activePlans : merged

    if (!plans.value.some((plan) => plan.id === selectedPlan.value)) {
      selectedPlan.value = plans.value[0]?.id || 'free-trial'
    }
  } catch (err) {
    console.error('Failed to load subscription plans for popup:', err)
    error.value = 'Unable to load latest plans right now.'
    plans.value = mergePlans(new Map())
  } finally {
    isLoading.value = false
  }
}

const selectedPlanData = computed(() => plans.value.find((plan) => plan.id === selectedPlan.value) || null)

const ctaLabel = computed(() => {
  const current = selectedPlanData.value
  if (!current) return 'Continue'
  if (current.id === 'free-trial') {
    const days = Number(current.trialDays || 14)
    return `Proceed to ${days}-day Free Trial`
  }
  return 'Continue with Selected Plan'
})

const cardClass = (plan) => {
  const selected = selectedPlan.value === plan.id

  if (plan.id === 'free-trial') {
    return selected
      ? 'bg-gray-100/80 border-2 border-gold-600 text-gray-800 shadow-lg'
      : 'bg-gray-100/70 border border-gray-300 text-gray-800 shadow-lg hover:shadow-[0_0_25px_rgba(255,255,255,0.6)]'
  }

  if (plan.id === 'premium') {
    return selected
      ? 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white border-2 border-yellow-300 shadow-[0_0_45px_rgba(255,215,0,1)]'
      : 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-yellow-700 text-white border-2 border-yellow-400 shadow-lg hover:shadow-[0_0_45px_rgba(255,215,0,1)]'
  }

  return selected
    ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white border-2 border-yellow-300'
    : 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white border border-yellow-500'
}

const continueWithPlan = () => {
  if (selectedPlan.value === 'free-trial') {
    router.push({ name: 'register', query: { account: 'clinic' } })
    emit('close')
    return
  }

  router.push({ path: '/subscription/checkout', query: { plan: selectedPlan.value } })
  emit('close')
}

const maybeLater = () => {
  emit('close')
  router.push({ path: '/' })
}

const toggleResume = () => {
  showResume.value = !showResume.value
  resumeError.value = ''
}

const checkRegistrationStatus = async (emailValue) => {
  try {
    const res = await axios.post(`${OTP_API_BASE}/auth/check-registration-status`, {
      email: String(emailValue || '').trim().toLowerCase()
    })
    return res?.data || null
  } catch (error) {
    console.error('Failed to check user email:', error)
    return null
  }
}

const resumeRegistration = async () => {
  const normalizedEmail = String(resumeEmail.value || '').trim().toLowerCase()
  resumeError.value = ''

  if (!normalizedEmail) {
    resumeError.value = 'Email is required.'
    return
  }

  resumeLoading.value = true
  try {
    const status = await checkRegistrationStatus(normalizedEmail)
    if (!status) {
      resumeError.value = 'Unable to verify email right now.'
      return
    }
    if (status.exists === true) {
      if (status.resumeStep === 'active') {
        resumeError.value = 'Account already registered.'
        return
      }
      sessionStorage.setItem('resume_email', normalizedEmail)
      await router.push({
        name: 'register',
        query: { account: 'clinic', resume: '1' },
      })
      emit('close')
      return
    }

    const paymentsSnap = await getDocs(query(
      collection(db, 'planPayments'),
      where('payerEmail', '==', normalizedEmail),
      where('status', '==', 'Paid'),
    ))

    if (paymentsSnap.empty) {
      resumeError.value = 'No paid subscription found for that email.'
      return
    }

    let latestPayment = null
    paymentsSnap.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const createdAt = data.createdAt?.seconds || 0
      if (!latestPayment || createdAt > latestPayment.createdAt) {
        latestPayment = {
          id: docSnap.id,
          planId: String(data.planId || data.planName || '').trim().toLowerCase(),
          firstName: data.payerFirstName || '',
          lastName: data.payerLastName || '',
        }
      }
    })

    if (!latestPayment?.planId) {
      resumeError.value = 'Payment record missing plan data.'
      return
    }

    router.push({
      name: 'register',
      query: {
        account: 'clinic',
        plan: latestPayment.planId,
        paymentId: latestPayment.id,
        paymentStatus: 'paid',
        firstName: latestPayment.firstName,
        lastName: latestPayment.lastName,
        email: normalizedEmail,
      },
    })
    emit('close')
  } catch (err) {
    console.error('Failed to resume registration:', err)
    resumeError.value = 'Unable to resume right now. Please try again.'
  } finally {
    resumeLoading.value = false
  }
}

onMounted(loadPlans)
</script>

<style scoped>
.subscription-popup {
  padding: 0.75rem;
}

.popup-top {
  display: block;
  margin-bottom: 1.15rem;
}

.popup-eyebrow {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: #996341;
  margin-bottom: 0.25rem;
}

.popup-title {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(1.7rem, 2.4vw, 2.1rem);
  line-height: 1.05;
  background: linear-gradient(120deg, #4a2c1e 0%, #996341 44%, #c89066 72%, #7b4e35 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.popup-subtitle {
  margin-top: 0.35rem;
  color: #5f4b3a;
  font-size: 0.92rem;
  max-width: 660px;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.85rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.plan-grid-skeleton {
  pointer-events: none;
}

.skeleton-card {
  border: 1px solid rgba(198, 148, 108, 0.25);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.7), rgba(248, 234, 206, 0.55));
}

.skeleton-line,
.skeleton-chip {
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(224, 197, 168, 0.55) 0%,
    rgba(244, 228, 206, 0.9) 45%,
    rgba(224, 197, 168, 0.55) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shine 1.4s ease-in-out infinite;
}

.skeleton-title {
  height: 14px;
  width: 40%;
}

.skeleton-price {
  margin-top: 0.6rem;
  height: 26px;
  width: 55%;
}

.skeleton-desc {
  margin-top: 0.6rem;
  height: 12px;
  width: 80%;
  border-radius: 0.5rem;
}

.skeleton-desc.short {
  width: 65%;
}

.skeleton-list {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.4rem;
}

.skeleton-item {
  height: 10px;
  width: 75%;
  border-radius: 0.4rem;
}

.skeleton-item.short {
  width: 55%;
}

.skeleton-chip {
  margin-top: 0.9rem;
  height: 20px;
  width: 90px;
}

.popup-actions-skeleton {
  opacity: 0.7;
  pointer-events: none;
}

@keyframes skeleton-shine {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

.plan-card {
  position: relative;
  overflow: hidden;
  text-align: left;
  border-radius: 1rem;
  border: 1px solid rgba(198, 148, 108, 0.34);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.8), rgba(248, 234, 206, 0.56));
  padding: 1.2rem 1rem;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.plan-card:hover {
  transform: translateY(-2px);
  border-color: rgba(198, 148, 108, 0.62);
  box-shadow: 0 10px 22px rgba(54, 34, 22, 0.12);
}

.plan-card-active {
  border-color: rgba(159, 105, 70, 0.72);
  box-shadow: 0 12px 24px rgba(111, 63, 42, 0.18);
}

.plan-card-free {
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.88), rgba(246, 238, 223, 0.78));
}

.plan-card-free:hover {
  transform: none;
  border-color: rgba(198, 148, 108, 0.34);
  box-shadow: none;
}

.plan-card-basic {
  border-color: rgba(205, 145, 92, 0.62);
  background: linear-gradient(145deg, #f2c998 0%, #deaa73 48%, #c78f5d 100%);
}

.plan-card-basic .plan-name,
.plan-card-basic .plan-price,
.plan-card-basic .plan-desc,
.plan-card-basic .plan-features {
  color: #fff9ee;
}

.plan-card-premium {
  border-color: rgba(235, 193, 93, 0.78);
  background: linear-gradient(145deg, #f0a74f 0%, #d07b34 45%, #a84f22 100%);
}

.plan-card-premium .plan-name,
.plan-card-premium .plan-price,
.plan-card-premium .plan-desc,
.plan-card-premium .plan-features {
  color: #fff7ea;
}

.card-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(110deg, transparent 28%, rgba(255, 255, 255, 0.38) 52%, transparent 76%);
  transition: transform 0.7s ease;
}

.group:hover .card-shine {
  transform: translateX(120%);
}

.plan-badge {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #fff;
  background: linear-gradient(120deg, #9f6946 0%, #7b4e35 100%);
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
}

.plan-name {
  font-size: 1rem;
  font-weight: 700;
  color: #3b281d;
}

.plan-price {
  margin-top: 0.15rem;
  font-size: 1.65rem;
  font-weight: 800;
  color: #6f3f2a;
}

.plan-cycle {
  font-size: 0.85rem;
  font-weight: 500;
  color: #8f6a51;
  margin-left: 0.22rem;
}

.plan-desc {
  margin-top: 0.25rem;
  font-size: 0.84rem;
  color: #66503f;
}

.plan-features {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: #4a3528;
}

.plan-features li::before {
  content: "\2713";
  color: #9f6946;
  margin-right: 0.4rem;
  font-weight: 700;
}

.plan-selected {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.75rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(17, 24, 39, 0.22);
  color: #fffaf0;
}

.popup-actions {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.btn-outline {
  width: 100%;
  border-radius: 0.8rem;
  padding: 0.72rem 0.95rem;
  font-weight: 600;
  border: 1px solid rgba(198, 148, 108, 0.6);
  color: #7b4e35;
  background: transparent;
  transition: all 0.2s ease;
}

.btn-outline:hover {
  background: rgba(255, 248, 235, 0.6);
}

.resume-card {
  border-radius: 0.9rem;
  border: 1px solid rgba(198, 148, 108, 0.35);
  background: rgba(255, 255, 255, 0.9);
  padding: 0.9rem;
  display: grid;
  gap: 0.6rem;
}

.resume-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #7b4e35;
}

.resume-input {
  height: 44px;
  border-radius: 0.65rem;
  border: 1px solid rgba(198, 148, 108, 0.5);
  padding: 0 0.75rem;
  font-size: 0.9rem;
  color: #4a2c1e;
  background: #fff;
  outline: none;
}

.resume-input:focus {
  border-color: rgba(159, 105, 70, 0.8);
}

.resume-error {
  color: #b91c1c;
  font-size: 0.75rem;
}

.btn-secondary,
.btn-primary {
  width: 100%;
  border-radius: 0.8rem;
  padding: 0.72rem 0.95rem;
  font-weight: 600;
  font-size: 0.86rem;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-secondary {
  border: 1px solid rgba(198, 148, 108, 0.45);
  color: #7b4e35;
  background: rgba(255, 255, 255, 0.6);
}

.btn-secondary:hover {
  background: rgba(255, 248, 235, 0.95);
}

.btn-primary {
  border: 1px solid transparent;
  color: #fff;
  background: linear-gradient(120deg, #9f6946 0%, #7b4e35 100%);
}

.btn-primary:hover {
  filter: brightness(1.03);
  transform: translateY(-1px);
}


@media (min-width: 768px) {
  .subscription-popup {
    padding: 0.95rem;
  }
  .plan-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .popup-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
  .btn-secondary {
    width: 170px;
  }
  .btn-primary {
    width: 290px;
  }
}
</style>

