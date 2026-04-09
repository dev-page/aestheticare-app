<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Choose Your Plan</h1>
        <p class="text-slate-400">Select the plan you want to avail or upgrade to before continuing to checkout.</p>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          v-for="index in 2"
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

      <section v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="text-left rounded-2xl border p-6 transition-all"
          :class="isPlanDisabled(plan.id)
            ? 'cursor-not-allowed border-slate-700/80 bg-slate-800/70 opacity-75'
            : selectedPlan === plan.id
              ? 'border-amber-400 bg-slate-800 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]'
              : 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-800/90'"
          :disabled="isPlanDisabled(plan.id)"
          @click="selectPlan(plan.id)"
        >
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <p class="text-xs uppercase tracking-[0.22em] text-amber-300 mb-2">{{ plan.id }}</p>
              <h2 class="text-2xl font-semibold text-white">{{ plan.name }}</h2>
            </div>
            <span
              v-if="getPlanBadge(plan.id)"
              class="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
              :class="isCurrentPlanCard(plan.id)
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                : isPendingPlanCard(plan.id)
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                  : isBlockedDowngradeCard(plan.id)
                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                    : 'border-amber-400/40 bg-amber-500/15 text-amber-300'"
            >
              {{ getPlanBadge(plan.id) }}
            </span>
          </div>

          <div class="mb-4">
            <div class="text-3xl font-bold text-white">{{ plan.priceLabel }}</div>
            <div class="text-sm text-slate-400">{{ plan.cycleLabel || '-' }}</div>
          </div>

          <p class="mb-5 text-sm text-slate-300">{{ plan.description }}</p>

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
          {{ submitting ? 'Checking...' : 'Confirm And Continue' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

const router = useRouter()
const route = useRoute()
const configuredApiBase = String(import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3002').replace(/\/$/, '')
const OTP_API_BASE_CANDIDATES = Array.from(new Set([configuredApiBase, 'http://localhost:3002', 'http://localhost:3000']))

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const selectedPlan = ref('basic')
const plans = ref([])
const currentPlan = ref('free')
const currentPlanExpiresAt = ref(null)
const pendingPlan = ref('')

const PLAN_PRIORITIES = {
  free: 0,
  basic: 1,
  premium: 2,
}

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

const formatCurrency = (amount) => {
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(safe)
}

const formatCycle = (cycle) => {
  const normalized = String(cycle || '').trim().toLowerCase()
  if (!normalized || normalized === 'trial') return ''
  if (normalized.startsWith('/')) return normalized
  return `/${normalized}`
}

const normalizePlanId = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'free'
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('free') || raw.includes('trial')) return 'free'
  return raw
}

const getPlanPriority = (value) => PLAN_PRIORITIES[normalizePlanId(value)] ?? 0

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

const isCurrentPlanCard = (planId) => normalizePlanId(planId) === normalizePlanId(currentPlan.value)

const isPendingPlanCard = (planId) => {
  const normalizedPendingPlan = normalizePlanId(pendingPlan.value)
  return normalizedPendingPlan && normalizedPendingPlan === normalizePlanId(planId)
}

const isBlockedDowngradeCard = (planId) =>
  hasActiveCurrentCycle.value &&
  getPlanPriority(planId) < getPlanPriority(currentPlan.value)

const isPlanDisabled = (planId) =>
  isCurrentPlanCard(planId) || isPendingPlanCard(planId) || isBlockedDowngradeCard(planId)

const getPlanBadge = (planId) => {
  if (isCurrentPlanCard(planId)) return 'Current Plan'
  if (isPendingPlanCard(planId)) return 'Scheduled'
  if (isBlockedDowngradeCard(planId)) return 'Locked'
  if (selectedPlan.value === planId) return 'Selected'
  return ''
}

const selectPlan = (planId) => {
  if (isPlanDisabled(planId)) return
  selectedPlan.value = planId
}

const mergePlans = (dbPlansMap) =>
  defaultPlans().map((basePlan) => {
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
    }
  })

const loadPlans = async () => {
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

    const [snapshot, userSnap, clinicSnap] = await Promise.all([
      getDocs(collection(db, 'subscriptionPlans')),
      getDoc(doc(db, 'users', currentUser.uid)),
      getDoc(doc(db, 'clinics', currentUser.uid)),
    ])

    const userData = userSnap.exists() ? userSnap.data() : {}
    const clinicData = clinicSnap.exists() ? clinicSnap.data() : {}
    currentPlan.value = normalizePlanId(clinicData.subscriptionPlan || userData.subscriptionPlan || 'free')
    currentPlanExpiresAt.value = clinicData.subscriptionExpiresAt || userData.subscriptionExpiresAt || null
    pendingPlan.value = normalizePlanId(clinicData.pendingSubscriptionPlan || userData.pendingSubscriptionPlan || '')

    const dbPlans = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))
    const merged = mergePlans(dbPlans)
    const activePlans = merged.filter((plan) => plan.isActive)
    plans.value = activePlans.length ? activePlans : merged

    const requestedPlanIsSelectable = plans.value.some((plan) => plan.id === selectedPlan.value && !isPlanDisabled(plan.id))
    if (!requestedPlanIsSelectable) {
      const firstSelectablePlan = plans.value.find((plan) => !isPlanDisabled(plan.id))
      selectedPlan.value = firstSelectablePlan?.id || ''
    }
  } catch (err) {
    console.error('Failed to load owner subscription plans:', err)
    error.value = 'Unable to load plans right now.'
    plans.value = mergePlans(new Map())
  } finally {
    loading.value = false
  }
}

const getCurrentUser = async () => {
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

const fetchBackendJson = async (path, options = {}) => {
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
        throw new Error(payload?.error || 'Unable to continue with this plan.')
      }

      return payload
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Unable to reach the subscription backend.')
}

const continueWithPlan = async () => {
  if (!selectedPlan.value) return
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
      router.push('/owner/account/subscription')
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

const goBack = () => {
  router.push('/owner/account/subscription')
}

onMounted(loadPlans)
</script>
