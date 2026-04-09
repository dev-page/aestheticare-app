import { ref } from 'vue'
import { defineStore } from 'pinia'
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore'

const GRACE_DAYS = 7
const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const PLAN_CACHE_KEY = 'subscription:plan'
const PLAN_FEATURES_CACHE_PREFIX = 'subscription:features:'
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000

const DEFAULT_FEATURES = {
  free: [
    'subscription',
    'staff_management',
    'appointments',
    'pos_payments',
    'inventory',
    'services',
  ],
  basic: [
    'subscription',
    'staff_management',
    'appointments',
    'pos_payments',
    'inventory',
    'services',
  ],
  premium: [
    'subscription',
    'multi_branch',
    'staff_management',
    'appointments',
    'pos_payments',
    'inventory',
    'services',
    'online_consultations',
    'reports',
    'hr',
    'payroll',
    'attendance',
    'dss',
  ],
}

DEFAULT_FEATURES.premium = [
  'subscription',
  'multi_branch',
  'staff_management',
  'appointments',
  'pos_payments',
  'inventory',
  'services',
  'online_consultations',
  'reports',
  'hr',
  'payroll',
  'attendance',
  'dss',
]

const normalizePlanKey = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'free'
  if (raw === 'free' || raw === 'freeplan' || raw === 'free_plan') return 'free'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('free') || raw.includes('trial')) return 'free'
  return raw
}

const normalizeRoleKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const isCustomerRole = (roleValue, userTypeValue) => {
  const roleKey = normalizeRoleKey(roleValue)
  const typeKey = normalizeRoleKey(userTypeValue)
  return roleKey === 'customer' || typeKey === 'customer'
}

const isPermissionDenied = (error) => {
  const code = String(error?.code || '')
  if (code === 'permission-denied') return true
  const message = String(error?.message || '')
  return message.includes('Missing or insufficient permissions')
}

const toDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const activeFeatures = ref([])
  const activePlan = ref('')
  const isLoading = ref(false)
  const isReadOnly = ref(false)
  const isExpired = ref(false)
  const graceEndsAt = ref(null)
  const subscriptionExpiresAt = ref(null)
  const userRole = ref('')
  const userType = ref('')

  let initialized = false
  let lastUserId = null
  let unpublishAttempted = false
  let lastUnpublishUserId = null
  let unsubscribePlanPermissions = null
  let activePlanKey = ''

  const resolveSubscriptionForUser = async (userId) => {
    const userSnap = await getDoc(doc(db, 'users', userId))
    if (!userSnap.exists()) {
      return { planKey: 'free', expiresAt: null, role: '', userType: '', paymentStatus: '', email: '' }
    }
    const userData = userSnap.data() || {}
    const role = String(userData.role || '').trim()
    const userTypeValue = String(userData.userType || '').trim()
    const userPaymentStatus = String(userData.paymentStatus || '').trim()
    const userEmail = String(userData.email || '').trim().toLowerCase()

    const hasDirectPlan = Boolean(userData.subscriptionPlan || userData.plan)
    if (hasDirectPlan) {
      const directPlan = normalizePlanKey(userData.subscriptionPlan || userData.plan)
      const directExpiresAt = toDate(userData.subscriptionExpiresAt)
      return { planKey: directPlan, expiresAt: directExpiresAt, role, userType: userTypeValue, paymentStatus: userPaymentStatus, email: userEmail }
    }

    const branchId = userData.branchId
    if (branchId) {
      const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
      if (clinicSnap.exists()) {
        const clinicData = clinicSnap.data() || {}
        const clinicPlan = clinicData.subscriptionPlan || clinicData.plan
        if (clinicPlan) {
          return {
            planKey: normalizePlanKey(clinicPlan),
            expiresAt: toDate(clinicData.subscriptionExpiresAt),
            role,
            userType: userTypeValue,
            paymentStatus: String(clinicData.paymentStatus || '').trim() || userPaymentStatus,
            email: userEmail
          }
        }
        const clinicOwnerId = String(clinicData.ownerId || '').trim()
        if (clinicOwnerId) {
          const ownerSnap = await getDoc(doc(db, 'users', clinicOwnerId))
          if (ownerSnap.exists()) {
            const ownerData = ownerSnap.data() || {}
            const ownerPlan = ownerData.subscriptionPlan || ownerData.plan
            if (ownerPlan) {
              return {
                planKey: normalizePlanKey(ownerPlan),
                expiresAt: toDate(ownerData.subscriptionExpiresAt),
                role,
                userType: userTypeValue,
                paymentStatus: String(ownerData.paymentStatus || '').trim() || userPaymentStatus,
                email: userEmail
              }
            }
          }
        }
      }
    }

    const ownerQuery = query(collection(db, 'clinics'), where('ownerId', '==', userId))
    const ownerSnap = await getDocs(ownerQuery)
    if (!ownerSnap.empty) {
      const clinicData = ownerSnap.docs[0].data() || {}
      const clinicPlan = clinicData.subscriptionPlan || clinicData.plan
      if (clinicPlan) {
        return {
          planKey: normalizePlanKey(clinicPlan),
          expiresAt: toDate(clinicData.subscriptionExpiresAt),
          role,
          userType: userTypeValue,
          paymentStatus: String(clinicData.paymentStatus || '').trim() || userPaymentStatus,
          email: userEmail
        }
      }
    }

    return { planKey: 'free', expiresAt: null, role, userType: userTypeValue, paymentStatus: userPaymentStatus, email: userEmail }
  }

  const loadLatestPaidPlanByEmail = async (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) return null
    const paymentsSnap = await getDocs(
      query(
        collection(db, 'planPayments'),
        where('payerEmail', '==', normalizedEmail),
        where('status', '==', 'Paid')
      )
    )
    if (paymentsSnap.empty) return null
    let latest = null
    paymentsSnap.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const createdAt = data.createdAt?.seconds || 0
      if (!latest || createdAt > latest.createdAt) {
        latest = {
          id: docSnap.id,
          planId: normalizePlanKey(data.planId || data.planName || ''),
          createdAt,
          paidAtSeconds: Number(data.paymongoPaidAt || 0)
        }
      }
    })
    return latest
  }

  const loadPlanPermissions = async (planKey) => {
    try {
      const cached = JSON.parse(localStorage.getItem(`${PLAN_FEATURES_CACHE_PREFIX}${planKey}`) || 'null')
      if (cached && Array.isArray(cached.data) && cached.ts) {
        const isFresh = Date.now() - cached.ts < PLAN_CACHE_TTL_MS
        if (isFresh && cached.data.length) {
          activeFeatures.value = cached.data
        }
      }
    } catch (_error) {
      // ignore cache parse
    }

    try {
      const planDoc = await getDoc(doc(db, 'planPermissions', planKey))
      if (planDoc.exists()) {
        const data = planDoc.data() || {}
        if (Array.isArray(data.permissions) && data.permissions.length) {
          const permissions = data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
          try {
            localStorage.setItem(
              `${PLAN_FEATURES_CACHE_PREFIX}${planKey}`,
              JSON.stringify({ data: permissions, ts: Date.now() })
            )
          } catch (_error) {
            // ignore cache errors
          }
          return permissions
        }
      }
    } catch (error) {
      console.error('Failed to load plan permissions:', error)
    }
    return DEFAULT_FEATURES[planKey] || DEFAULT_FEATURES.free
  }

  const startPlanPermissionsListener = (planKey) => {
    if (!planKey) return
    if (unsubscribePlanPermissions) {
      unsubscribePlanPermissions()
      unsubscribePlanPermissions = null
    }

    unsubscribePlanPermissions = onSnapshot(
      doc(db, 'planPermissions', planKey),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() || {}
          if (Array.isArray(data.permissions) && data.permissions.length) {
            activeFeatures.value = data.permissions
              .map((value) => String(value || '').trim())
              .filter(Boolean)
            try {
              localStorage.setItem(
                `${PLAN_FEATURES_CACHE_PREFIX}${planKey}`,
                JSON.stringify({ data: activeFeatures.value, ts: Date.now() })
              )
            } catch (_error) {
              // ignore cache errors
            }
            return
          }
        }
        activeFeatures.value = DEFAULT_FEATURES[planKey] || DEFAULT_FEATURES.free
      },
      (error) => {
        console.error('Failed to listen to plan permissions:', error)
      }
    )
  }

  const initSubscription = async (force = false) => {
    const currentUserId = auth.currentUser?.uid || null
    if (initialized && lastUserId === currentUserId && !force) return
    isLoading.value = true
    try {
      const user = auth.currentUser
      if (!user) {
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(PLAN_CACHE_KEY) || key.startsWith(PLAN_FEATURES_CACHE_PREFIX)) {
              localStorage.removeItem(key)
            }
          })
        } catch (_error) {
          // ignore cache clear errors
        }
        activePlan.value = ''
        activeFeatures.value = []
        isReadOnly.value = false
        isExpired.value = false
        graceEndsAt.value = null
        subscriptionExpiresAt.value = null
        initialized = false
        lastUserId = null
        return
      }

      try {
        const cachedPlan = JSON.parse(localStorage.getItem(`${PLAN_CACHE_KEY}:${user.uid}`) || 'null')
        if (cachedPlan?.planKey && cachedPlan?.ts) {
          const isFresh = Date.now() - cachedPlan.ts < PLAN_CACHE_TTL_MS
          if (isFresh) {
            activePlan.value = cachedPlan.planKey
            if (cachedPlan?.expiresAt) {
              subscriptionExpiresAt.value = toDate(cachedPlan.expiresAt)
            }
          }
        }
      } catch (_error) {
        // ignore cache errors
      }

      initialized = true
      lastUserId = currentUserId
      let subscriptionMeta = null
      try {
        subscriptionMeta = await resolveSubscriptionForUser(user.uid)
      } catch (error) {
        if (isPermissionDenied(error)) {
          if (unsubscribePlanPermissions) {
            unsubscribePlanPermissions()
            unsubscribePlanPermissions = null
          }
          activePlanKey = ''
          activePlan.value = ''
          activeFeatures.value = []
          isReadOnly.value = false
          isExpired.value = false
          graceEndsAt.value = null
          subscriptionExpiresAt.value = null
          userRole.value = 'Customer'
          userType.value = 'Customer'
          return
        }
        throw error
      }
      const isCustomer = isCustomerRole(subscriptionMeta.role, subscriptionMeta.userType)
      if (isCustomer) {
        if (unsubscribePlanPermissions) {
          unsubscribePlanPermissions()
          unsubscribePlanPermissions = null
        }
        activePlanKey = ''
        activePlan.value = ''
        activeFeatures.value = []
        isReadOnly.value = false
        isExpired.value = false
        graceEndsAt.value = null
        subscriptionExpiresAt.value = null
        userRole.value = subscriptionMeta.role || subscriptionMeta.userType || ''
        userType.value = subscriptionMeta.userType || ''
        return
      }
      let planKey = subscriptionMeta.planKey
      let paymentStatus = String(subscriptionMeta.paymentStatus || '').trim().toLowerCase()
      let resolvedExpiresAt = subscriptionMeta.expiresAt
      const metaEmail = subscriptionMeta.email || ''
      if (!paymentStatus.includes('paid') && planKey !== 'free' && metaEmail) {
        try {
          const latestPayment = await loadLatestPaidPlanByEmail(metaEmail)
          if (latestPayment?.planId) {
            planKey = latestPayment.planId
            paymentStatus = 'paid'
            const planDays = latestPayment.planId === 'free' ? 0 : 30
            const baseMillis = latestPayment.paidAtSeconds
              ? latestPayment.paidAtSeconds * 1000
              : latestPayment.createdAt
                ? latestPayment.createdAt * 1000
                : Date.now()
            resolvedExpiresAt = new Date(baseMillis + planDays * 24 * 60 * 60 * 1000)
            const uid = auth.currentUser?.uid
            if (uid) {
              try {
                await Promise.all([
                  updateDoc(doc(db, 'users', uid), {
                    subscriptionPlan: planKey,
                    paymentStatus: 'paid',
                    paymentId: latestPayment.id,
                    subscriptionStartedAt: new Date(baseMillis),
                    subscriptionExpiresAt: resolvedExpiresAt
                  }),
                  updateDoc(doc(db, 'clinics', uid), {
                    subscriptionPlan: planKey,
                    paymentStatus: 'paid',
                    paymentId: latestPayment.id,
                    subscriptionStartedAt: new Date(baseMillis),
                    subscriptionExpiresAt: resolvedExpiresAt
                  })
                ])
              } catch (_error) {
                // ignore update errors
              }
            }
          }
        } catch (_error) {
          // ignore payment lookup errors
        }
      }

      if (!resolvedExpiresAt && paymentStatus.includes('paid') && planKey !== 'free') {
        try {
          const latestPayment = await loadLatestPaidPlanByEmail(metaEmail)
          if (latestPayment?.planId) {
            const planDays = latestPayment.planId === 'free' ? 0 : 30
            const baseMillis = latestPayment.paidAtSeconds
              ? latestPayment.paidAtSeconds * 1000
              : latestPayment.createdAt
                ? latestPayment.createdAt * 1000
                : Date.now()
            resolvedExpiresAt = new Date(baseMillis + planDays * 24 * 60 * 60 * 1000)
            const uid = auth.currentUser?.uid
            if (uid) {
              try {
                await Promise.all([
                  updateDoc(doc(db, 'users', uid), {
                    subscriptionStartedAt: new Date(baseMillis),
                    subscriptionExpiresAt: resolvedExpiresAt
                  }),
                  updateDoc(doc(db, 'clinics', uid), {
                    subscriptionStartedAt: new Date(baseMillis),
                    subscriptionExpiresAt: resolvedExpiresAt
                  })
                ])
              } catch (_error) {
                // ignore update errors
              }
            }
          }
        } catch (_error) {
          // ignore payment lookup errors
        }
      }

      activePlanKey = planKey
      activePlan.value = planKey
      subscriptionExpiresAt.value = resolvedExpiresAt
      userRole.value = subscriptionMeta.role || ''
      userType.value = subscriptionMeta.userType || ''
      const permissions = await loadPlanPermissions(planKey)
      activeFeatures.value = permissions
      startPlanPermissionsListener(planKey)
      try {
        localStorage.setItem(
          `${PLAN_CACHE_KEY}:${user.uid}`,
          JSON.stringify({
            planKey,
            expiresAt: resolvedExpiresAt ? resolvedExpiresAt.toISOString() : null,
            ts: Date.now()
          })
        )
      } catch (_error) {
        // ignore cache errors
      }

      const now = new Date()
      if (resolvedExpiresAt) {
        const expiresAt = resolvedExpiresAt
        const graceEnd = new Date(expiresAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000)
        graceEndsAt.value = graceEnd
        const expired = now.getTime() > expiresAt.getTime()
        const isPaidOverride = paymentStatus.includes('paid') && planKey !== 'free'
        isExpired.value = expired && !isPaidOverride
        isReadOnly.value = expired && !isPaidOverride
        const roleKey = String(userRole.value || '')
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, '')
        if (expired && !isPaidOverride && (roleKey === 'owner' || roleKey === 'clinicadmin' || roleKey === 'clinicadministrator')) {
          const shouldAttempt = !unpublishAttempted || lastUnpublishUserId !== user.uid
          if (shouldAttempt) {
            unpublishAttempted = true
            lastUnpublishUserId = user.uid
            fetch(`${OTP_API_BASE}/admin/unpublish-expired-clinics`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ownerId: user.uid })
            }).catch((error) => {
              console.error('Failed to request unpublish of expired clinics:', error)
            })
          }
        }
      } else {
        const isPaidOverride = paymentStatus.includes('paid') && planKey !== 'free'
        isExpired.value = false
        isReadOnly.value = false
        graceEndsAt.value = null
        if (!isPaidOverride) {
          isExpired.value = false
          isReadOnly.value = false
        }
      }
    } catch (error) {
      console.error('Failed to load subscription features:', error)
      activePlan.value = 'free'
      activeFeatures.value = DEFAULT_FEATURES.free
      isReadOnly.value = false
      isExpired.value = false
      graceEndsAt.value = null
      subscriptionExpiresAt.value = null
    } finally {
      isLoading.value = false
    }
  }

  const hasFeature = (feature) => {
    if (!feature) return true
    if (feature === 'subscription') return true
    if (isCustomerRole(userRole.value, userType.value)) {
      return true
    }
    if (!initialized) {
      initSubscription()
    }
    if (feature === 'hr_shifts') {
      const planKey = String(activePlan.value || '').toLowerCase()
      return !planKey.includes('basic')
    }
    return activeFeatures.value.includes(feature)
  }

  const refreshSubscription = async () => {
    initialized = false
    await initSubscription(true)
  }

  return {
    activeFeatures,
    activePlan,
    isLoading,
    isReadOnly,
    isExpired,
    graceEndsAt,
    subscriptionExpiresAt,
    userRole,
    initSubscription,
    hasFeature,
    refreshSubscription
  }
})
