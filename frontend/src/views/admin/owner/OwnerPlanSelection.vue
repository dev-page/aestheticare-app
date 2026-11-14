<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'cards', cardStyle: 'plan', cards: 3 }" class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
        <p class="text-slate-400">Select the plan you want to avail or upgrade to before continuing to checkout.</p>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section v-if="!loading" class="trial-offer">
        <div>
          <h2>{{ trialActive ? 'Your Free Trial is active' : trialEligible ? 'Start with 14 days of Premium access' : 'Choose a subscription plan' }}</h2>
          <p>{{ trialActive ? `Your Premium access ends on ${subscriptionDateLabel(currentPlanExpiresAt)}. No payment is collected during the trial. A 7-day grace period follows while you choose Basic or Premium.` : trialEligible ? 'Free Trial is a separate plan, available once per clinic after clinic approval. Basic and Premium are paid plans with no trial settings.' : 'Expired subscriptions restrict operations after the 7-day grace period. Clinic records remain retained while you renew or export authorised data.' }}</p>
        </div>
        <button v-if="trialEligible && eligibleTrialPlan" type="button" class="app-button app-button--primary" :disabled="submitting || startingTrial" @click="selectPlan(eligibleTrialPlan.id)">Select Free Trial</button>
      </section>

      <section v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          v-for="index in 3"
          :key="`owner-plan-skeleton-${index}`"
          class="rounded-2xl border border-slate-700 bg-slate-800 p-6 animate-pulse"
        >
          <div class="h-4 w-24 rounded bg-slate-700 mb-4"></div>
          <div class="h-8 w-40 rounded bg-slate-700 mb-3"></div>
          <div class="h-3 w-full rounded bg-slate-700 mb-2"></div>
          <div class="h-3 w-3/4 rounded bg-slate-700 mb-6"></div>
          <div class="space-y-2">
            <div class="h-3 w-full rounded bg-slate-700"></div>
            <div class="h-3 w-5/6 rounded bg-slate-700"></div>
            <div class="h-3 w-2/3 rounded bg-slate-700"></div>
          </div>
        </div>
      </section>

      <section v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="text-left rounded-2xl border p-6 transition-all"
          :class="isPlanDisabled(plan.id)
            ? 'cursor-not-allowed border-slate-700/80 bg-slate-800/70 opacity-75'
            : selectedPlan === plan.id
              ? 'border-amber-400 bg-slate-900 shadow-[0_0_0_16px_rgba(251,191,36,0.08)] ring-2 ring-amber-400/30'
              : 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-800/90'"
          :disabled="isPlanDisabled(plan.id)"
          @click="selectPlan(plan.id)"
        >
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <p class="text-xs uppercase tracking-[0.22em] text-amber-300 mb-2">{{ plan.id === FREE_TRIAL_PLAN_ID ? 'Clinic trial' : plan.id }}</p>
              <h2 class="text-2xl font-semibold text-white">{{ plan.name }}</h2>
            </div>
            <span
              v-if="selectedPlan === plan.id"
              class="rounded-full border border-amber-300 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200"
            >
              Selected
            </span>
          </div>

          <div class="mb-4">
            <div class="text-3xl font-bold text-white">{{ plan.priceLabel }}</div>
            <div class="text-sm text-slate-400">{{ plan.id === FREE_TRIAL_PLAN_ID ? '14-day access' : plan.cycleLabel || '-' }}</div>
            <p v-if="plan.id === FREE_TRIAL_PLAN_ID" class="mt-2 text-sm font-semibold text-emerald-300">14 days of Premium access · no payment collected</p>
            <p v-else class="mt-2 text-sm text-slate-400">Paid plan · billed at the listed price</p>
          </div>

          <p class="mb-5 text-sm text-slate-300">{{ plan.description }}</p>
          <div class="mb-4 flex items-center gap-2 text-sm text-slate-400">
            <span class="inline-flex h-2 w-2 rounded-full bg-slate-400"></span>
            <span>{{ selectedPlan === plan.id ? 'Plan is selected' : 'Click to select this plan' }}</span>
          </div>

          <ul class="space-y-2 text-sm text-slate-200">
            <li v-for="feature in plan.features" :key="feature">- {{ feature }}</li>
          </ul>

          <p
            v-if="isBlockedDowngradeCard(plan.id)"
            class="mt-5 text-sm text-rose-300"
          >
            This plan will be available after your current subscription ends.
          </p>
        </button>
      </section>

      <div class="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition"
          @click="goBack"
        >
          Back
        </button>
        <button
          type="button"
          class="px-5 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition disabled:opacity-60"
          :disabled="!selectedPlan || submitting || isPlanDisabled(selectedPlan)"
          @click="continueWithPlan"
        >
          {{ startingTrial || submitting ? (startingTrial ? 'Starting trial…' : 'Checking...') : selectedPlanTrialEligible ? 'Start 14-Day Free Trial' : 'Continue with selected plan' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import {
  buildSubscriptionPlanCatalog,
  createDefaultSubscriptionPlans,
  FREE_TRIAL_PLAN_ID,
  filterActiveSubscriptionPlans,
  getSubscriptionPlanPriority,
} from '@/utils/subscriptionPlans'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'
import { subscriptionLifecycle } from '../../../../../shared/subscriptionLifecycle.js'
import { subscriptionDateLabel, subscriptionRecord } from '../../../../../shared/subscriptionDates.js'
import { useSubscriptionStore } from '@/stores/subscription'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const router = useRouter()
const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const selectedPlan = ref('basic')
const allPlans = ref([])
const plans = ref([])
const currentPlan = ref('free')
const currentPlanExpiresAt = ref(null)
const trialEligible = ref(false)
const trialActive = ref(false)
const startingTrial = ref(false)
const subscriptionStore = useSubscriptionStore()
const pendingPlan = ref('')
const selectedPlanData = computed(() => plans.value.find((plan) => plan.id === selectedPlan.value) || null)
const eligibleTrialPlan = computed(() => trialEligible.value ? plans.value.find((plan) => plan.id === FREE_TRIAL_PLAN_ID) || null : null)
const selectedPlanTrialEligible = computed(() => trialEligible.value && selectedPlanData.value?.id === FREE_TRIAL_PLAN_ID)
let unsubscribePlans = null

const defaultPlans = () => createDefaultSubscriptionPlans()

const normalizePlanId = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'free'
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('free') || raw.includes('trial')) return 'free'
  return raw
}

const getPlanPriority = (value) => getSubscriptionPlanPriority(normalizePlanId(value), allPlans.value)

const toDateValue = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const hasActiveCurrentCycle = computed(() => {
  const expiresAt = toDateValue(currentPlanExpiresAt.value)
  return Boolean(expiresAt && expiresAt.getTime() > Date.now())
})

const isCurrentPlanCard = (planId) =>
  normalizePlanId(planId) === normalizePlanId(currentPlan.value) && hasActiveCurrentCycle.value && !trialActive.value

const isPendingPlanCard = (planId) => {
  const normalizedPendingPlan = normalizePlanId(pendingPlan.value)
  return normalizedPendingPlan && normalizedPendingPlan === normalizePlanId(planId)
}

const isBlockedDowngradeCard = (planId) =>
  !trialActive.value &&
  hasActiveCurrentCycle.value &&
  getPlanPriority(planId) < getPlanPriority(currentPlan.value)

const isPlanDisabled = (planId) =>
  (planId === FREE_TRIAL_PLAN_ID && !trialEligible.value) ||
  isCurrentPlanCard(planId) || isPendingPlanCard(planId) || isBlockedDowngradeCard(planId)

const selectPlan = (planId) => {
  if (isPlanDisabled(planId)) return
  selectedPlan.value = planId
}

const loadPlans = trackPageLoad(async () => {
  error.value = ''
  loading.value = true
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      throw new Error('User not authenticated.')
    }

    const requestedPlan = String(route.query.plan || '').trim().toLowerCase()
    if (requestedPlan) {
      selectedPlan.value = requestedPlan
    }

    const [userSnap, clinicSnap] = await Promise.all([
      getDoc(doc(db, 'users', currentUser.uid)),
      getDoc(doc(db, 'clinics', currentUser.uid)),
    ])

    const userData = userSnap.exists() ? userSnap.data() : {}
    const clinicData = clinicSnap.exists() ? clinicSnap.data() : {}
    const lifecycle = subscriptionLifecycle(subscriptionRecord(userData, clinicData))
    currentPlan.value = lifecycle.plan
    currentPlanExpiresAt.value = lifecycle.expiresAt
    trialEligible.value = lifecycle.trialEligible && subscriptionLifecycle(clinicData).trialEligible
    trialActive.value = lifecycle.trial
    pendingPlan.value = normalizePlanId(clinicData.pendingSubscriptionPlan || userData.pendingSubscriptionPlan || '')

    if (unsubscribePlans) {
      unsubscribePlans()
      unsubscribePlans = null
    }

    unsubscribePlans = pageListener(
      onSnapshot, collection(db, 'subscriptionPlans'),
      (snapshot) => {
        const merged = buildSubscriptionPlanCatalog(defaultPlans(), snapshot.docs)
        allPlans.value = merged
        plans.value = filterActiveSubscriptionPlans(merged)
        loading.value = false

        const requestedPlanIsSelectable = plans.value.some((plan) => plan.id === selectedPlan.value && !isPlanDisabled(plan.id))
        if (!requestedPlanIsSelectable) {
          const firstSelectablePlan = plans.value.find((plan) => !isPlanDisabled(plan.id))
          selectedPlan.value = firstSelectablePlan?.id || ''
        }
      },
      (planErr) => {
        console.error('Failed to load owner subscription plans:', planErr)
        error.value = 'Unable to load plans right now.'
        allPlans.value = buildSubscriptionPlanCatalog(defaultPlans(), [])
        plans.value = filterActiveSubscriptionPlans(allPlans.value)
        loading.value = false
      }
    )
  } catch (err) {
    console.error('Failed to start owner subscription listener:', err)
    error.value = 'Unable to load plans right now.'
    allPlans.value = buildSubscriptionPlanCatalog(defaultPlans(), [])
    plans.value = filterActiveSubscriptionPlans(allPlans.value)
    loading.value = false
  }
})

const getCurrentUser = async () => {
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const unsubscribe = pageListener(onAuthStateChanged, auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const fetchBackendJson = trackPageLoad(async (path, options = {}) => {
  let lastError = null

  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options)
      const contentType = String(response.headers.get('content-type') || '').toLowerCase()

      if (response.status === 404) {
        lastError = new Error(`Backend route not found on ${baseUrl}.`)
        continue
      }

      if (!contentType.includes('application/json')) {
        lastError = new Error(`Backend returned a non-JSON response on ${baseUrl}.`)
        continue
      }

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw Object.assign(new Error(payload?.error || 'Unable to continue with this plan.'), { terminal: true })
      }

      return payload
    } catch (error) {
      if (error.terminal) throw error
      lastError = error
    }
  }

  throw lastError || new Error('Unable to reach the subscription backend.')
})

onBeforeUnmount(() => {
  if (unsubscribePlans) {
    unsubscribePlans()
    unsubscribePlans = null
  }
})

const continueWithPlan = async () => {
  if (!selectedPlan.value) return
  if (selectedPlanTrialEligible.value) {
    await startTrial()
    return
  }
  submitting.value = true
  error.value = ''
  try {
    if (isPlanDisabled(selectedPlan.value)) {
      if (isCurrentPlanCard(selectedPlan.value)) {
        error.value = "You're already on this plan."
        return
      }
      if (isBlockedDowngradeCard(selectedPlan.value)) {
        error.value = 'This lower plan is unavailable until your current subscription period ends.'
        return
      }
      if (isPendingPlanCard(selectedPlan.value)) {
        error.value = 'This plan change is already scheduled for your next billing cycle.'
        return
      }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      throw new Error('User not authenticated.')
    }

    const idToken = await currentUser.getIdToken()
    const payload = await fetchBackendJson('/owner/subscription/plan-change-preview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        targetPlan: selectedPlan.value,
      }),
    })

    if (payload?.data?.action === 'blocked_same_plan' || payload?.data?.action === 'blocked_pending_same_plan') {
      error.value = payload?.data?.message || 'Unable to continue with this plan.'
      return
    }

    if (payload?.data?.action === 'schedule_without_payment') {
      await fetchBackendJson('/owner/subscription/schedule-plan-change', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          targetPlan: selectedPlan.value,
        }),
      })
      router.push('/account/subscription')
      return
    }

    router.push({ path: '/subscription/checkout', query: { plan: selectedPlan.value, from: 'owner' } })
  } catch (err) {
    console.error('Failed to validate owner plan change:', err)
    error.value = err?.message || 'Unable to continue with this plan.'
  } finally {
    submitting.value = false
  }
}

const startTrial = async () => {
  if (startingTrial.value || !trialEligible.value) return
  startingTrial.value = true
  error.value = ''
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('Please sign in again.')
    await fetchBackendJson('/subscription/start-trial', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({}),
    })
    await subscriptionStore.refreshSubscription()
    await router.push('/account/subscription')
  } catch (err) { error.value = err.message || 'Unable to start the trial.' }
  finally { startingTrial.value = false }
}

const goBack = () => {
  router.push('/account/subscription')
}

onMounted(loadPlans)
</script>

<style scoped>
.trial-offer { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; padding: 24px; border: 1px solid #e6c29f; border-radius: 16px; background: #fff7eb; color: #493323; }
.trial-offer h2 { margin: 0 0 8px; font-size: 20px; }
.trial-offer p { margin: 0; max-width: 640px; font-size: 14px; line-height: 1.6; color: #785d48; }
.trial-offer button { flex-shrink: 0; }
@media (max-width: 640px) { .trial-offer { align-items: stretch; flex-direction: column; } }
</style>
