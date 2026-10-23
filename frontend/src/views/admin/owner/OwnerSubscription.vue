<template>
  <div class="flex owner-theme min-h-screen subscription-page">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'cards', cardStyle: 'plan', cards: 2 }" class="subscription-main">
      <header class="page-heading">
        <span class="eyebrow">Account &amp; billing</span>
        <h1>Subscription Plan</h1>
        <p>Your plan, renewal dates, and payment history in one place.</p>
      </header>
      <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
      <OwnerPageSkeleton v-if="loading" variant="cards" card-style="plan" :cards="2" />
      <template v-else>
        <div class="plan-layout">
          <section class="subscription-card current-plan" aria-labelledby="current-plan-title">
            <div class="card-heading">
              <span class="eyebrow" id="current-plan-title">Current plan</span>
              <span class="status-pill" :class="{ 'status-warning': !isFree && (!isPaid || daysRemaining === null || daysRemaining <= 7) }">{{ statusLabel }}</span>
            </div>
            <h2 class="plan-name">{{ planLabel }}</h2>
            <div class="plan-price">{{ planPrice }} <span>{{ isFree ? 'No subscription fee' : planCycle }}</span></div>
            <p class="plan-description">{{ planDescription }}</p>
            <dl class="billing-facts">
              <div><dt>Payment</dt><dd>{{ isFree ? 'No payment required' : paymentStatusLabel }}</dd></div>
              <div><dt>{{ isFree ? 'Plan duration' : isTrial ? 'Trial ends on' : 'Expires on' }}</dt><dd>{{ isFree ? 'No expiry' : expiresAtLabel }}</dd></div>
              <div v-if="!isFree && daysRemaining !== null && daysRemaining > 0"><dt>Time remaining</dt><dd>{{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }}</dd></div>
            </dl>
            <p v-if="!isFree" class="date-note">Dates are shown in Philippine time.</p>
            <p v-if="isTrial" class="pending-notice">No automatic charge. Your clinic returns to Free when the trial ends unless you purchase a plan. Records and existing appointments are retained.</p>
            <div v-if="!isFree && daysRemaining !== null && daysRemaining <= 7" class="renewal-notice" role="status">
              <Icon icon="lucide:clock-3" width="19" aria-hidden="true" />
              <div><strong>{{ daysRemaining <= 0 ? 'Your paid plan has ended' : 'Your renewal is coming up' }}</strong><p>{{ daysRemaining <= 0 ? 'Free Plan access applies after expiry. Explore plans to restore your paid features.' : 'Review your plan options before expiry to keep your paid features.' }}</p></div>
            </div>
            <div v-if="pendingPlanNotice" class="pending-notice"><Icon icon="lucide:calendar-clock" width="19" aria-hidden="true" /><p>{{ pendingPlanNotice }}</p></div>
            <div class="plan-inclusions">
              <h3>Included in your plan</h3>
              <ul><li v-for="item in planFeatures" :key="item"><Icon icon="lucide:check" width="16" aria-hidden="true" /><span>{{ item }}</span></li></ul>
            </div>
          </section>
          <aside class="subscription-card billing-card" aria-labelledby="billing-title">
            <div class="billing-icon"><Icon icon="lucide:wallet-cards" width="24" aria-hidden="true" /></div>
            <h2 id="billing-title">{{ isFree ? 'Ready for more?' : 'Manage your subscription' }}</h2>
            <p>{{ isFree ? 'Compare plans and choose the features that fit your clinic.' : 'Review available plans and manage your next billing cycle.' }}</p>
            <button type="button" class="app-button app-button--primary explore-button" @click="goToUpgrade">Explore Plans <Icon icon="lucide:arrow-right" width="17" aria-hidden="true" /></button>
            <div class="billing-help">
              <div><Icon icon="lucide:credit-card" width="19" aria-hidden="true" /><div><h3>Pay through checkout</h3><p>Choose a plan and complete payment through secure checkout.</p></div></div>
              <div><Icon icon="lucide:bell" width="19" aria-hidden="true" /><div><h3>Stay ahead of expiry</h3><p>Trials and paid plans receive notification and email reminders 7, 3, and 1 day before expiry.</p></div></div>
            </div>
          </aside>
        </div>
        <section class="subscription-card payment-history" aria-labelledby="payment-history-title">
          <div class="history-heading"><div><h2 id="payment-history-title">Payment History</h2><p>Previous subscription payments and their references.</p></div><span v-if="historyRows.length" class="history-count">{{ historyRows.length }} {{ historyRows.length === 1 ? 'payment' : 'payments' }}</span></div>
          <p v-if="historyError" class="error-notice" role="alert">{{ historyError }}</p>
          <div v-if="historyLoading" class="history-loading" role="status" aria-label="Loading payment history"><div v-for="row in 3" :key="row" class="history-skeleton"></div><span class="sr-only">Loading payment history...</span></div>
          <div v-else-if="!historyRows.length && !historyError" class="history-empty"><Icon icon="lucide:receipt-text" width="27" aria-hidden="true" /><h3>No subscription payments yet</h3><p>Your completed payments will appear here when you purchase a plan.</p></div>
          <template v-else-if="historyRows.length">
            <div class="history-table-wrap"><table><caption class="sr-only">Subscription payments. Dates are shown in Philippine time.</caption><thead><tr><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Paid on</th><th scope="col">Status</th><th scope="col">Payment reference</th></tr></thead><tbody><tr v-for="payment in paginatedHistory" :key="payment.id"><td class="payment-plan">{{ normalizePlanLabel(payment.planId || payment.planName) }}</td><td>{{ payment.amount == null ? '-' : formatCurrency(payment.amount) }}</td><td>{{ paymentDateLabel(payment) }}</td><td><span class="status-pill" :class="{ 'status-warning': !paymentIsPaid(payment) }">{{ paymentIsPaid(payment) ? 'Paid' : payment.status || 'Pending' }}</span></td><td class="payment-reference">{{ payment.referenceNumber || payment.paymongoPaymentId || payment.id }}</td></tr></tbody></table></div>
            <TablePagination v-model:page="historyPage" v-model:page-size="historyPageSize" :total-items="historyRows.length" />
            <p class="date-note">Payment dates are shown in Philippine time.</p>
          </template>
        </section>
      </template>
    </main>
  </div>
</template>
<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { Icon } from '@iconify/vue'
import { subscriptionDate, subscriptionDateLabel, subscriptionRecord } from '../../../../../shared/subscriptionDates.js'
import { subscriptionLifecycle } from '../../../../../shared/subscriptionLifecycle.js'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const router = useRouter()

const loading = ref(true)
const error = ref('')

const planKey = ref('free')
const isTrial = ref(false)
const paymentStatus = ref('')
const subscriptionExpiresAt = ref(null)
const planData = ref(null)
const subscriptionTrialDays = ref(0)
const pendingPlan = ref('')
const pendingApplyAt = ref(null)
const planDocs = ref(new Map())
let unsubscribeUser = null
let unsubscribeClinic = null
let unsubscribePlans = null
let unsubscribeHistory = []
let clockTimer = null
const currentTime = ref(Date.now())
const historySources = ref({})
const historyLoading = ref(true)
const historyError = ref('')
const historyPage = ref(1)
const historyPageSize = ref(10)
const historyRows = computed(() => {
  const rows = new Map()
  Object.values(historySources.value).flat().forEach(row => rows.set(row.id, row))
  return [...rows.values()].sort((a, b) => paymentTime(b) - paymentTime(a))
})
const paginatedHistory = computed(() => historyRows.value.slice((historyPage.value - 1) * historyPageSize.value, historyPage.value * historyPageSize.value))
watch(() => historyRows.value.length, () => { historyPage.value = 1 })
watch(historyPageSize, () => { historyPage.value = 1 })
const paymentIsPaid = payment => ['paid', 'succeeded'].includes(String(payment.status || payment.paymongoStatus || '').toLowerCase())
const paymentTime = payment => (subscriptionDate(payment.paymongoPaidAt || payment.paidAt || payment.createdAt)?.getTime() || 0)
const paymentDateLabel = payment => paymentIsPaid(payment) ? formatDate(payment.paymongoPaidAt || payment.paidAt || payment.createdAt) : '-'

const formatCurrency = (amount) => {
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP', currencyDisplay: 'code',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(safe)
}

const formatCycle = (cycle) => {
  const normalized = String(cycle || '').trim().toLowerCase()
  if (!normalized || normalized === 'trial') return 'Trial'
  if (normalized.startsWith('/')) return normalized.slice(1)
  return normalized
}

const syncPlanData = () => {
  planData.value = planDocs.value.get(planKey.value) || (isFree.value ? planDocs.value.get('free') || planDocs.value.get('free-trial') : null) || null
}

const formatDate = subscriptionDateLabel

const normalizePlanLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Not set'
  if (raw.includes('free')) return 'Free Plan'
  if (raw.includes('basic')) return 'Basic'
  if (raw.includes('premium')) return 'Premium'
  return value
}

const planLabel = computed(() => `${normalizePlanLabel(planKey.value)}${isTrial.value ? ' trial' : ''}`)
const isFree = computed(() => planKey.value.includes('free'))
const isPaid = computed(() => paymentStatus.value.toLowerCase() === 'paid')
const planPrice = computed(() => isFree.value || isTrial.value ? formatCurrency(0) : planData.value?.price != null ? formatCurrency(planData.value.price) : 'Price unavailable')
const planCycle = computed(() => {
  if (isTrial.value) return `Free for ${Number(planData.value?.trialDays || subscriptionTrialDays.value || 14)} days`
  if (isFree.value) return 'No billing cycle'
  const cycle = formatCycle(planData.value?.billingCycle || planData.value?.cycle || '')
  return cycle === 'Trial' ? 'Billing cycle unavailable' : `per ${{ monthly: 'month', yearly: 'year', annually: 'year', annual: 'year' }[cycle] || cycle}`
})
const daysRemaining = computed(() => {
  const expiry = subscriptionDate(subscriptionExpiresAt.value)
  return expiry ? Math.ceil((expiry.getTime() - currentTime.value) / 86400000) : null
})
const statusLabel = computed(() => {
  if (isFree.value) return 'Active'
  if (isTrial.value) return 'Trial active'
  if (daysRemaining.value !== null && daysRemaining.value <= 0) return 'Expired'
  if (!isPaid.value) return 'Pending payment'
  if (daysRemaining.value === null) return 'Check billing details'
  return daysRemaining.value <= 7 ? 'Expiring soon' : 'Active'
})
const planDescription = computed(() => {
  if (planKey.value === 'free-trial' || planKey.value === 'free') {
    return 'Permanent access to essential clinic features, with no subscription fee or expiry.'
  }
  return planData.value?.description || 'No description available.'
})
const planFeatures = computed(() => {
  if (planKey.value === 'free-trial' || planKey.value === 'free') {
    return ['Primary clinic profile and branch', 'Service listings and clinic policies', 'Clients and inbox', 'Appointment management and existing transactions']
  }
  return planData.value?.features || []
})
const paymentStatusLabel = computed(() => {
  if (isTrial.value) return 'No charge during trial'
  if (planKey.value === 'free-trial' || planKey.value === 'free') return '-'
  const raw = String(paymentStatus.value || '').trim().toLowerCase()
  if (!raw) return '-'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
})
const expiresAtLabel = computed(() => formatDate(subscriptionExpiresAt.value))
const pendingPlanLabel = computed(() => {
  if (!pendingPlan.value) return '-'
  return normalizePlanLabel(pendingPlan.value)
})
const pendingApplyAtLabel = computed(() => formatDate(pendingApplyAt.value))
const pendingPlanNotice = computed(() => {
  if (!pendingPlan.value || !pendingApplyAt.value) return ''
  return `${pendingPlanLabel.value} will take effect on ${pendingApplyAtLabel.value} after your current billing cycle ends.`
})

let userSubscription = {}, clinicSubscription = {}
const applySubscriptionData = (userData = {}, clinicData = {}) => {
  const data = subscriptionRecord(userData, clinicData)
  const lifecycle = subscriptionLifecycle(data)
  planKey.value = lifecycle.plan
  isTrial.value = lifecycle.trial
  subscriptionTrialDays.value = Number(data.subscriptionTrialDays || 0)
  paymentStatus.value = data.paymentStatus || ''
  subscriptionExpiresAt.value = lifecycle.expiresAt
  pendingPlan.value = String(data.pendingSubscriptionPlan || '').trim().toLowerCase()
  pendingApplyAt.value = data.pendingSubscriptionApplyAt ?? null
  syncPlanData()
}

const loadSubscription = trackPageLoad(async () => {
  error.value = ''
  loading.value = true
  try {
    const currentUser = auth.currentUser || await new Promise((resolve) => {
      const unsub = pageListener(onAuthStateChanged, auth, (user) => {
        unsub()
        resolve(user)
      })
    })
    if (!currentUser) {
      error.value = 'User not authenticated.'
      loading.value = false
      return
    }

    const [userSnap, clinicSnap] = await Promise.all([
      getDoc(doc(db, 'users', currentUser.uid)),
      getDoc(doc(db, 'clinics', currentUser.uid)),
    ])

    const userData = userSnap.exists() ? userSnap.data() : {}
    const clinicData = clinicSnap.exists() ? clinicSnap.data() : {}
    userSubscription = userData
    clinicSubscription = clinicData
    applySubscriptionData(userSubscription, clinicSubscription)
    subscribePaymentHistory(currentUser.uid, userData.email || currentUser.email)

    if (unsubscribePlans) unsubscribePlans()
    unsubscribePlans = pageListener(onSnapshot, collection(db, 'subscriptionPlans'), (snapshot) => {
      planDocs.value = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))
      syncPlanData()
      if (loading.value) loading.value = false
    }, () => {
      error.value = 'Unable to load subscription plans.'
      loading.value = false
    })
  } catch (err) {
    console.error('Failed to load subscription info:', err)
    error.value = 'Failed to load subscription information.'
    loading.value = false
  }
})

const subscribeToUpdates = async () => {
  const currentUser = auth.currentUser || await new Promise((resolve) => {
    const unsub = pageListener(onAuthStateChanged, auth, (user) => {
      unsub()
      resolve(user)
    })
  })
  if (!currentUser) return

  if (unsubscribeUser) unsubscribeUser()
  if (unsubscribeClinic) unsubscribeClinic()

  unsubscribeUser = pageListener(onSnapshot, doc(db, 'users', currentUser.uid), (snap) => {
    userSubscription = snap.exists() ? snap.data() : {}
    applySubscriptionData(userSubscription, clinicSubscription)
  }, () => { error.value = 'Unable to update subscription information.' })

  unsubscribeClinic = pageListener(onSnapshot, doc(db, 'clinics', currentUser.uid), (snap) => {
    clinicSubscription = snap.exists() ? snap.data() : {}
    applySubscriptionData(userSubscription, clinicSubscription)
  }, () => { error.value = 'Unable to update clinic subscription information.' })
}

const subscribePaymentHistory = (ownerId, email) => {
  unsubscribeHistory.forEach(unsubscribe => unsubscribe())
  historySources.value = {}
  historyError.value = ''
  historyLoading.value = true
  const sources = [{ key: 'owner', field: 'ownerUid', value: ownerId }]
  if (email) sources.push({ key: 'email', field: 'payerEmail', value: String(email).trim().toLowerCase() })
  const pending = new Set(sources.map(source => source.key))
  const failures = new Set()
  unsubscribeHistory = sources.map(source => pageListener(onSnapshot,
    query(collection(db, 'planPayments'), where(source.field, '==', source.value)),
    snapshot => {
      historySources.value = { ...historySources.value, [source.key]: snapshot.docs.map(row => ({ ...row.data(), id: row.id })) }
      failures.delete(source.key)
      pending.delete(source.key)
      historyLoading.value = pending.size > 0
      historyError.value = failures.size ? 'Some payment history could not be loaded. Please try again later.' : ''
    }, () => {
      historySources.value = { ...historySources.value, [source.key]: [] }
      failures.add(source.key)
      pending.delete(source.key)
      historyLoading.value = pending.size > 0
      historyError.value = 'Some payment history could not be loaded. Please try again later.'
    }))
}

const goToUpgrade = () => {
  const targetPlan = isTrial.value ? 'premium' : isFree.value ? 'basic' : planKey.value === 'basic' ? 'premium' : planKey.value
  router.push({ path: '/account/plans', query: { plan: targetPlan } })
}

onMounted(trackPageLoad(async () => {
  clockTimer = setInterval(() => { currentTime.value = Date.now(); applySubscriptionData(userSubscription, clinicSubscription) }, 60000)
  await loadSubscription()
  await subscribeToUpdates()
}))

onUnmounted(() => {
  clearInterval(clockTimer)
  unsubscribeHistory.forEach(unsubscribe => unsubscribe())
  if (unsubscribeUser) unsubscribeUser()
  if (unsubscribeClinic) unsubscribeClinic()
  if (unsubscribePlans) unsubscribePlans()
})
</script>

<style scoped>
.subscription-page { background: #fffaf4; color: #402b20; }
.subscription-main { flex: 1; min-width: 0; padding: 30px 32px 40px; }
.page-heading { margin-bottom: 24px; }
.eyebrow { font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #a36d49; }
.page-heading h1 { margin: 7px 0 8px; font-size: 32px; line-height: 1.2; }
.page-heading p, .subscription-card p { color: #876c59; font-size: 14px; line-height: 1.65; }
.plan-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 1fr); align-items: start; gap: 22px; }
.subscription-card { background: #fffdfa; border: 1px solid #eed6bc; border-radius: 16px; padding: 26px; box-shadow: 0 4px 16px rgb(75 46 27 / 4%); }
.card-heading, .history-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.status-pill { display: inline-flex; align-items: center; border-radius: 20px; padding: 5px 11px; font-size: 11px; font-weight: 600; color: #357354; background: #e7f2eb; white-space: nowrap; }
.status-warning { color: #986029; background: #fcf0dc; }
.current-plan .plan-name { margin: 15px 0 8px; font-size: 29px; }
.plan-price { font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
.plan-price span { display: inline-block; margin-left: 7px; font-size: 12px; font-weight: 400; letter-spacing: 0; color: #94745f; }
.plan-description { margin-top: 12px; margin-bottom: 20px; }
.billing-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-top: 18px; border-top: 1px solid #f0dfcd; }
.billing-facts dt { font-size: 12px; color: #94745f; margin-bottom: 5px; }
.billing-facts dd { margin: 0; font-size: 14px; font-weight: 600; color: #4d3425; overflow-wrap: anywhere; }
.subscription-card .date-note { font-size: 11px; color: #9b816e; margin: 12px 0 0; }
.plan-inclusions { border-top: 1px solid #f0dfcd; padding-top: 20px; margin-top: 22px; }
.subscription-card h3 { font-size: 14px; margin: 0 0 12px; }
.plan-inclusions ul { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px 18px; }
.plan-inclusions li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.5; color: #735641; }
.plan-inclusions li svg { flex-shrink: 0; margin-top: 2px; color: #6c8961; }
.billing-icon { display: grid; place-items: center; width: 48px; height: 48px; background: #f8ecdb; border: 1px solid #eed6bc; border-radius: 14px; color: #996841; margin-bottom: 18px; }
.billing-card h2, .history-heading h2 { font-size: 21px; margin: 0 0 10px; }
.billing-card > p { margin: 0 0 21px; }
.explore-button { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 18px; min-height: 44px; width: 100%; border: 1px solid #805335; cursor: pointer; font-size: 14px; }
.explore-button:focus-visible { outline: 3px solid #d5af88; outline-offset: 3px; }
.billing-help { border-top: 1px solid #f0dfcd; margin-top: 24px; padding-top: 20px; display: grid; gap: 19px; }
.billing-help > div { display: flex; align-items: flex-start; gap: 12px; }
.billing-help svg { color: #ad7d57; flex-shrink: 0; margin-top: 2px; }
.billing-help h3 { margin-bottom: 4px; font-size: 13px; }
.billing-help p { margin: 0; font-size: 12px; }
.renewal-notice, .pending-notice { display: flex; align-items: flex-start; gap: 11px; padding: 14px; border-radius: 10px; border: 1px solid #ebd0a7; background: #fff6e8; margin-top: 18px; font-size: 13px; }
.renewal-notice svg, .pending-notice svg { flex-shrink: 0; color: #ad7b40; margin-top: 2px; }
.renewal-notice p, .pending-notice p { margin: 4px 0 0; font-size: 12px; }
.payment-history { margin-top: 24px; }
.history-heading { margin-bottom: 20px; }
.history-heading h2 { margin-bottom: 5px; }
.history-heading p { margin: 0; font-size: 12px; }
.history-count { color: #927159; font-size: 12px; white-space: nowrap; }
.history-table-wrap { overflow-x: auto; border: 1px solid #eed6bc; border-radius: 10px; }
.history-table-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
.history-table-wrap th { background: #f7ead7; color: #795436; text-align: left; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; padding: 13px 16px; white-space: nowrap; }
.history-table-wrap td { padding: 16px; border-top: 1px solid #f0dfcd; color: #70543f; }
.history-table-wrap .payment-plan { font-weight: 600; color: #4d3425; }
.payment-reference { max-width: 260px; overflow-wrap: anywhere; font-size: 12px; }
.history-empty { text-align: center; padding: 28px 16px; background: #fffbf5; border: 1px dashed #eed6bc; border-radius: 12px; }
.history-empty > svg { color: #b58a65; margin-bottom: 12px; }
.history-empty h3 { margin: 0 0 6px; }
.history-empty p { margin: 0; font-size: 12px; }
.error-notice { color: #a04434 !important; font-size: 13px; padding: 12px 15px; border-radius: 9px; background: #fff0e9; margin-bottom: 16px; }
.history-loading { display: grid; gap: 10px; }
.history-skeleton { height: 48px; border-radius: 8px; background: #f4eadc; animation: history-pulse 1.5s ease-in-out infinite; }
@keyframes history-pulse { 50% { opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .history-skeleton { animation: none; } }
@media (max-width: 1050px) { .plan-layout { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .subscription-main { padding: 22px 16px 30px; }
  .page-heading h1 { font-size: 27px; }
  .subscription-card { padding: 20px; }
  .plan-inclusions ul, .billing-facts { grid-template-columns: minmax(0, 1fr); }
  .history-heading { align-items: flex-start; }
  .plan-price span { display: block; margin: 5px 0 0; }
}
</style>
