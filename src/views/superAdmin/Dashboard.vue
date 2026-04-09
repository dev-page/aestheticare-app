<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
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
          {{ loading ? 'Refreshing...' : 'Refresh' }}
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

      <section class="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 class="text-xl text-white font-semibold mb-4">Subscription Overview</h2>
        <p class="text-slate-400 text-sm mb-6">Number of clinics and users currently under the Free Plan, Basic, and Premium plans.</p>

        <div class="space-y-4">
          <div v-for="entry in subscriptionChart" :key="entry.key">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-200">{{ entry.label }}</span>
              <span class="text-slate-400">{{ entry.value }}</span>
            </div>
            <div class="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div class="h-2" :class="entry.colorClass" :style="{ width: `${entry.width}%` }"></div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
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
  if (raw.includes('free')) return 'freeTrial'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('premium')) return 'premium'
  return null
}

const extractPlanFromRecord = (record = {}) => {
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

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'code',
        minimumFractionDigits: 2,
      }).format(toNumber(amount))
    }

    const subscriptionChart = computed(() => {
      const highest = Math.max(freeTrialCount.value, basicCount.value, premiumCount.value, 1)
      return [
        {
          key: 'free',
          label: 'Free Plan',
          value: freeTrialCount.value,
          width: (freeTrialCount.value / highest) * 100,
          colorClass: 'bg-blue-500'
        },
        {
          key: 'basic',
          label: 'Basic',
          value: basicCount.value,
          width: (basicCount.value / highest) * 100,
          colorClass: 'bg-emerald-500'
        },
        {
          key: 'premium',
          label: 'Premium',
          value: premiumCount.value,
          width: (premiumCount.value / highest) * 100,
          colorClass: 'bg-amber-500'
        }
      ]
    })

    const loadPaymentRevenue = async () => {
      const paymentCollections = ['planPayments', 'subscriptionPayments', 'payments']
      let total = 0

      for (const name of paymentCollections) {
        const snapshot = await safeGetDocs(name)
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {}
          total += toNumber(data.amount ?? data.total ?? data.value ?? data.paidAmount)
        })
      }

      return total
    }

    const loadPlanPaymentCounts = async () => {
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
    }

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

    const loadDashboard = async () => {
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
    }

    onMounted(loadDashboard)

    return {
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

