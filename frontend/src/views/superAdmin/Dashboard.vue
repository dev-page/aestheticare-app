<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'superadmin-dashboard' }" class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" variant="superadmin-dashboard" />
      <div v-else>
      <div class="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">System Administrator Dashboard</h1>
          <p class="text-slate-400">Platform-wide KPIs and subscription insights.</p>
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          @click="loadDashboard"
        >
          <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <p class="text-slate-400 text-sm mb-2">Total Clinics</p>
          <p class="text-white text-3xl font-bold">{{ totalClinics }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <p class="text-slate-400 text-sm mb-2">Users</p>
          <p class="text-white text-3xl font-bold">{{ totalUsers }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <p class="text-slate-400 text-sm mb-2">Active Subscriptions</p>
          <p class="text-white text-3xl font-bold">{{ activeSubscriptions }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <p class="text-slate-400 text-sm mb-2">Platform Revenue</p>
          <p class="text-white text-3xl font-bold">{{ formatCurrency(platformRevenue) }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6 md:col-span-2 xl:col-span-2">
          <p class="text-slate-400 text-sm mb-2">Clinic Revenue (All Clinics)</p>
          <p class="text-white text-3xl font-bold">{{ formatCurrency(clinicRevenue) }}</p>
        </div>
      </div>

      <section class="subscription-overview rounded-2xl border p-5 sm:p-6">
        <div class="mb-5">
          <p class="subscription-overview__eyebrow">PLATFORM PLANS</p>
          <h2 class="mt-1 text-xl font-semibold">Subscription Overview</h2>
          <p class="mt-1 text-sm">Number of clinics and users currently in trial, Basic, and Premium subscription states.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <article v-for="entry in subscriptionChart" :key="entry.key" class="subscription-card" :class="`subscription-card--${entry.key}`">
            <div class="subscription-card__heading"><span class="subscription-card__dot" aria-hidden="true"></span><span>{{ entry.label }}</span></div>
            <p class="subscription-card__value">{{ entry.value }}</p>
            <div class="subscription-card__meta"><span>Relative to largest plan</span><span>{{ Math.round(entry.width) }}%</span></div>
            <div class="subscription-card__track" role="meter" :aria-label="`${entry.label} relative count`" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(entry.width)">
              <div class="subscription-card__fill" :style="{ width: `${entry.width}%` }"></div>
            </div>
          </article>
        </div>
      </section>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizePlan = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'free-trial' || raw === 'trial') return 'freeTrial'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('premium')) return 'premium'
  return null
}

const extractPlanFromRecord = (record = {}) => {
  if (String(record.paymentStatus || '').trim().toLowerCase() === 'trial') return 'freeTrial'
  const direct = [
    record.subscriptionPlan,
    record.plan,
    record.planName,
    record.selectedPlan,
    record.tier,
    record.package,
    record.subscription?.plan,
    record.subscription?.name,
    record.subscriptionDetails?.plan
  ]

  for (const candidate of direct) {
    const normalized = normalizePlan(candidate)
    if (normalized) return normalized
  }

  return null
}

export default {
  name: 'SuperAdminDashboard',
  components: { SuperAdminSidebar, DashboardSkeleton },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const loading = ref(false)
    const error = ref('')

    const totalClinics = ref(0)
    const totalUsers = ref(0)
    const activeSubscriptions = ref(0)
    const platformRevenue = ref(0)
    const clinicRevenue = ref(0)

    const freeTrialCount = ref(0)
    const basicCount = ref(0)
    const premiumCount = ref(0)
    // planPayments is the current, rule-protected subscription payment source.
    // The older subscriptionPayments and payments collections have no client
    // read rule and must not be queried from the browser dashboard.
    const realtimeCollections = ['clinics', 'users', 'planPayments']
    const realtimeUnsubscribers = []
    let refreshTimer = null

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
      }).format(toNumber(amount))
    }

    const subscriptionChart = computed(() => {
      const highest = Math.max(freeTrialCount.value, basicCount.value, premiumCount.value, 1)
      return [
        {
          key: 'trial',
          label: 'Trial',
          value: freeTrialCount.value,
          width: (freeTrialCount.value / highest) * 100
        },
        {
          key: 'basic',
          label: 'Basic',
          value: basicCount.value,
          width: (basicCount.value / highest) * 100
        },
        {
          key: 'premium',
          label: 'Premium',
          value: premiumCount.value,
          width: (premiumCount.value / highest) * 100
        }
      ]
    })

    const loadPaymentRevenue = trackPageLoad(async () => {
      const paymentCollections = ['planPayments']
      let total = 0

      for (const name of paymentCollections) {
        const snapshot = await safeGetDocs(name)
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {}
          total += toNumber(data.amount ?? data.total ?? data.value ?? data.paidAmount)
        })
      }

      return total
    })

    const loadPlanPaymentCounts = trackPageLoad(async () => {
      const snapshot = await safeGetDocs('planPayments')
      let basic = 0
      let premium = 0

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {}
        const plan = normalizePlan(data.planId || data.planName || data.plan)
        if (plan === 'basic') basic += 1
        if (plan === 'premium') premium += 1
      })

      return { basic, premium }
    })

    const safeGetDocs = async (collectionName) => {
      try {
        return await getDocs(collection(db, collectionName))
      } catch (err) {
        const code = String(err?.code || '').toLowerCase()
        const message = err?.message || 'Unknown error'
        console.error(`Failed to read ${collectionName}:`, err)
        if (code.includes('permission-denied')) {
          throw new Error(`Permission denied reading ${collectionName}.`)
        }
        throw new Error(`Failed to read ${collectionName}: ${message}`)
      }
    }

    const loadDashboard = trackPageLoad(async () => {
      loading.value = true
      error.value = ''

      try {
        const [clinicsSnap, usersSnap, paymentCounts] = await Promise.all([
          safeGetDocs('clinics'),
          safeGetDocs('users'),
          loadPlanPaymentCounts(),
        ])

        const clinics = clinicsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        const users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))

        totalClinics.value = clinics.length
        totalUsers.value = users.length
        clinicRevenue.value = clinics.reduce((sum, clinic) => sum + toNumber(clinic.revenue), 0)

        let free = 0
        let basic = 0
        let premium = 0

        clinics.forEach((clinic) => {
          const plan = extractPlanFromRecord(clinic)
          if (plan === 'freeTrial') free += 1
          if (plan === 'basic') basic += 1
          if (plan === 'premium') premium += 1
        })

        users.forEach((user) => {
          const plan = extractPlanFromRecord(user)
          if (plan === 'freeTrial') free += 1
          if (plan === 'basic') basic += 1
          if (plan === 'premium') premium += 1
        })

        const paidBasic = paymentCounts.basic
        const paidPremium = paymentCounts.premium

        freeTrialCount.value = free
        basicCount.value = paidBasic > 0 ? paidBasic : basic
        premiumCount.value = paidPremium > 0 ? paidPremium : premium
        activeSubscriptions.value = freeTrialCount.value + basicCount.value + premiumCount.value

        platformRevenue.value = await loadPaymentRevenue()
      } catch (err) {
        console.error('Error loading superadmin dashboard:', err)
        error.value = err?.message || 'Failed to load dashboard data. Please try again.'
      } finally {
        loading.value = false
      }
    })

    const scheduleDashboardRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        loadDashboard()
      }, 150)
    }

    const startRealtimeDashboard = () => {
      realtimeCollections.forEach((collectionName) => {
        realtimeUnsubscribers.push(pageListener(
          onSnapshot, collection(db, collectionName),
          scheduleDashboardRefresh,
          (err) => console.error(`Failed to listen to ${collectionName}:`, err)
        ))
      })
    }

    onMounted(trackPageLoad(() => {
      loadDashboard()
      startRealtimeDashboard()
    }))
    onUnmounted(() => {
      realtimeUnsubscribers.forEach((unsubscribe) => unsubscribe())
      if (refreshTimer) clearTimeout(refreshTimer)
    })

    return {
      pageLoading,
      loading,
      error,
      totalClinics,
      totalUsers,
      activeSubscriptions,
      platformRevenue,
      clinicRevenue,
      subscriptionChart,
      formatCurrency,
      loadDashboard,
    }
  }
}
</script>

<style scoped>
.subscription-overview { border-color: var(--ac-border); background: var(--ac-surface); color: var(--ac-text); box-shadow: var(--ac-shadow-sm); }
.subscription-overview__eyebrow { color: var(--ac-accent); font-size: .68rem; font-weight: 800; letter-spacing: .15em; }
.subscription-overview h2 { color: var(--ac-text); }
.subscription-overview > div > p:last-child { color: var(--ac-text-muted); }
.subscription-card { --plan-color: #697db9; display: grid; min-width: 0; gap: .85rem; padding: 1.1rem 1.15rem; border: 1px solid var(--ac-border); border-radius: 1rem; background: var(--ac-surface-soft); }
.subscription-card--basic { --plan-color: #47825b; }
.subscription-card--premium { --plan-color: #bd8741; }
.subscription-card__heading { display: flex; align-items: center; gap: .55rem; color: var(--ac-text-secondary); font-size: .9rem; font-weight: 700; }
.subscription-card__dot { width: .6rem; height: .6rem; border-radius: 999px; background: var(--plan-color); }
.subscription-card__value { color: var(--ac-text); font-size: clamp(1.8rem, 3vw, 2.35rem); font-weight: 800; line-height: 1; }
.subscription-card__meta { display: flex; justify-content: space-between; gap: .75rem; color: var(--ac-text-muted); font-size: .72rem; }
.subscription-card__track { height: .55rem; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--plan-color) 14%, var(--ac-surface)); }
.subscription-card__fill { height: 100%; border-radius: inherit; background: var(--plan-color); transition: width .25s ease; }
@media (max-width: 767px) { .subscription-card { gap: .65rem; padding: .95rem; } }
</style>

