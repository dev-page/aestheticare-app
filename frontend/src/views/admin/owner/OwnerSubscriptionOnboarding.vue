<template>
  <main class="onboarding-page owner-theme">
    <section class="onboarding-shell">
      <div class="onboarding-intro">
        <p class="onboarding-eyebrow">Welcome to AesthetiCare</p>
        <h1>Choose your clinic subscription</h1>
        <p>
          Your clinic account is ready. Select a plan to activate your workspace and continue to your payment details.
        </p>
      </div>

      <p v-if="error" class="onboarding-error">{{ error }}</p>

      <section v-if="loading" class="plan-grid" aria-label="Loading subscription plans">
        <div v-for="index in 2" :key="`plan-skeleton-${index}`" class="plan-card plan-skeleton">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </section>

      <section v-else class="plan-grid" aria-label="Subscription plans">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="plan-card"
          :class="{ selected: selectedPlan === plan.id }"
          @click="selectedPlan = plan.id"
        >
          <div class="plan-card-head">
            <div>
              <span class="plan-label">{{ plan.id }}</span>
              <h2>{{ plan.name }}</h2>
            </div>
            <span v-if="selectedPlan === plan.id" class="selected-badge">Selected</span>
          </div>
          <p class="plan-price">{{ plan.priceLabel }}</p>
          <p class="plan-cycle">{{ plan.cycleLabel }}</p>
          <p class="plan-description">{{ plan.description }}</p>
          <ul>
            <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
          </ul>
        </button>
      </section>

      <div v-if="!loading && !plans.length" class="empty-state">
        No active subscription plans are available right now. Please contact support.
      </div>

      <div class="onboarding-actions">
        <button
          type="button"
          class="continue-button"
          :disabled="loading || submitting || !selectedPlan"
          @click="continueToCheckout"
        >
          {{ submitting ? 'Preparing checkout...' : 'Continue to payment' }}
        </button>
      </div>

      <p class="onboarding-note">Your account details will be filled in automatically on the payment page.</p>
    </section>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { collection, onSnapshot } from 'firebase/firestore'
import {
  buildSubscriptionPlanCatalog,
  filterActiveSubscriptionPlans,
} from '@/utils/subscriptionPlans'
import { db } from '@/config/firebaseConfig'

const router = useRouter()
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const plans = ref([])
const selectedPlan = ref('')
let unsubscribePlans = null

const defaultPlans = () => [
  {
    id: 'basic',
    name: 'Basic',
    price: 999,
    billingCycle: 'month',
    description: 'Essential features for daily clinic operations.',
    features: ['Scheduling & billing', 'Staff management', 'Reports'],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2499,
    billingCycle: 'month',
    description: 'Advanced features and priority support for growing clinics.',
    features: ['Everything in Basic', 'Advanced analytics', 'Priority support'],
    isActive: true,
  },
]

const loadPlans = () => {
  unsubscribePlans = onSnapshot(
    collection(db, 'subscriptionPlans'),
    (snapshot) => {
      const catalog = buildSubscriptionPlanCatalog(defaultPlans(), snapshot.docs)
      plans.value = filterActiveSubscriptionPlans(catalog)
      if (!plans.value.some((plan) => plan.id === selectedPlan.value)) {
        selectedPlan.value = plans.value[0]?.id || ''
      }
      loading.value = false
    },
    (snapshotError) => {
      console.error('Failed to load onboarding subscription plans:', snapshotError)
      error.value = 'Unable to load plans right now. Please try again.'
      loading.value = false
    },
  )
}

const continueToCheckout = async () => {
  if (!selectedPlan.value) return
  submitting.value = true
  await router.push({
    path: '/subscription/checkout',
    query: { plan: selectedPlan.value, from: 'owner', onboarding: '1' },
  })
}

onMounted(loadPlans)
onBeforeUnmount(() => unsubscribePlans?.())
</script>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem);
  background:
    radial-gradient(circle at 15% 10%, rgba(183, 135, 93, 0.2), transparent 35%),
    linear-gradient(145deg, #140f0b 0%, #21150e 58%, #100b08 100%);
  color: var(--owner-text, #f2e2d2);
}

.onboarding-shell {
  width: min(100%, 980px);
}

.onboarding-intro { max-width: 680px; margin-bottom: 2rem; }
.onboarding-eyebrow,
.plan-label {
  color: #d6a878;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

h1 { margin: 0.6rem 0 0.75rem; font-size: clamp(2rem, 5vw, 3.6rem); line-height: 1.05; }
.onboarding-intro > p:last-child { color: #c8af97; line-height: 1.7; }
.onboarding-error,
.empty-state { margin: 1rem 0; color: #f0b7a0; }

.plan-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.plan-card {
  min-width: 0;
  padding: clamp(1.1rem, 3vw, 1.7rem);
  text-align: left;
  color: inherit;
  background: rgba(36, 24, 15, 0.86);
  border: 1px solid #4a3322;
  border-radius: 1.1rem;
  cursor: pointer;
  transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
}
.plan-card:hover { border-color: #b4875d; transform: translateY(-2px); }
.plan-card.selected { background: rgba(73, 48, 30, 0.9); border-color: #d6a878; box-shadow: 0 0 0 3px rgba(214, 168, 120, 0.14); }
.plan-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
h2 { margin: 0.45rem 0 0; font-size: clamp(1.3rem, 3vw, 1.8rem); }
.selected-badge { padding: 0.35rem 0.55rem; color: #24180f; background: #d6a878; border-radius: 999px; font-size: 0.7rem; font-weight: 800; }
.plan-price { margin: 1.35rem 0 0.1rem; font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; }
.plan-cycle { margin: 0; color: #c8af97; font-size: 0.85rem; }
.plan-description { min-height: 3.2em; margin: 1.2rem 0; color: #dcc6b1; line-height: 1.55; }
ul { display: grid; gap: 0.55rem; margin: 0; padding: 0; list-style: none; color: #c8af97; font-size: 0.9rem; }
li::before { content: '✓'; margin-right: 0.5rem; color: #d6a878; font-weight: 800; }
.onboarding-actions { display: flex; justify-content: flex-end; margin-top: 1.5rem; }
.continue-button { padding: 0.8rem 1.3rem; color: #24180f; background: #d6a878; border: 0; border-radius: 0.7rem; font-weight: 800; cursor: pointer; }
.continue-button:hover { background: #e1bb8f; }
.continue-button:disabled { cursor: not-allowed; opacity: 0.55; }
.onboarding-note { margin-top: 1rem; color: #9f826a; font-size: 0.82rem; text-align: right; }
.plan-skeleton { display: grid; gap: 0.9rem; cursor: default; }
.plan-skeleton span { display: block; height: 1rem; border-radius: 0.4rem; background: #3a281b; animation: pulse 1.3s ease-in-out infinite alternate; }
.plan-skeleton span:nth-child(2) { width: 45%; height: 2rem; }
.plan-skeleton span:nth-child(3) { width: 85%; }
.plan-skeleton span:nth-child(4) { width: 65%; }
@keyframes pulse { to { opacity: 0.45; } }

@media (max-width: 640px) {
  .plan-grid { grid-template-columns: 1fr; }
  .plan-description { min-height: 0; }
  .onboarding-actions { justify-content: stretch; }
  .continue-button { width: 100%; }
  .onboarding-note { text-align: left; }
}
</style>
