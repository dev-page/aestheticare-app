import { ref } from 'vue'
import { defineStore } from 'pinia'
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { subscriptionDate } from '../../../shared/subscriptionDates.js'
import { subscriptionLifecycle } from '../../../shared/subscriptionLifecycle.js'

const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  READ_ONLY: 'read_only',
  SUSPENDED: 'suspended'
})
const PLAN_CACHE_KEY = 'subscription:plan'
const PLAN_FEATURES_CACHE_PREFIX = 'subscription:features:'
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000

const DEFAULT_FEATURES = {
  basic: [
    'subscription',
    'staff_management',
    'appointments',
    'pos_payments',
    'inventory',
    'services',
    'booking_availability',
    // Basic is the single-clinic operational plan. It deliberately includes
    // the customer, booking, consultation, inventory, order and financial
    // reporting workflow, but not workforce management or payroll.
    'online_consultations',
    'reports',
    'dss',
  ],
  premium: [
    'subscription',
    'multi_branch',
    'booking_availability',
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
  'booking_availability',
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
  if (!raw || ['free', 'freeplan', 'free-plan', 'free_plan', 'free-trial', 'trial'].includes(raw)) return ''
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('premium')) return 'premium'
  return raw
}

const getEntitlementPlanKey = (planValue, paymentStatus) =>
  String(paymentStatus || '').trim().toLowerCase() === 'trial'
    ? 'premium'
    : normalizePlanKey(planValue)

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

const isNonClinicSubscriptionRole = (roleValue, userTypeValue) => {
  const roleKey = normalizeRoleKey(roleValue)
  const typeKey = normalizeRoleKey(userTypeValue)
  return [roleKey, typeKey].some((value) => [
    'customer', 'supplier', 'supplieradmin', 'superadmin', 'systemadmin', 'sysadmin'
  ].includes(value))
}

const isPermissionDenied = (error) => {
  const code = String(error?.code || '')
  if (code === 'permission-denied') return true
  const message = String(error?.message || '')
  return message.includes('Missing or insufficient permissions')
}

const toDate = subscriptionDate

export const useSubscriptionStore = defineStore('subscription', () => {
  const activeFeatures = ref([])
  const activePlan = ref('')
  const isLoading = ref(false)
  const isReadOnly = ref(false)
  const isExpired = ref(false)
  const isSuspended = ref(false)
  const subscriptionStatus = ref(SUBSCRIPTION_STATUS.ACTIVE)
  const graceEndsAt = ref(null)
  const subscriptionExpiresAt = ref(null)
  const userRole = ref('')
  const userType = ref('')

  let initialized = false
  let lastUserId = null
  let unsubscribePlanPermissions = null
  let activePlanKey = ''

  const stopPlanPermissionsListener = () => {
    if (unsubscribePlanPermissions) {
      unsubscribePlanPermissions()
      unsubscribePlanPermissions = null
    }
  }

  const resolveSubscriptionForUser = async (userId) => {
    const userSnap = await getDoc(doc(db, 'users', userId))
    if (!userSnap.exists()) {
      return { planKey: '', expiresAt: null, graceEndsAt: null, role: '', userType: '', paymentStatus: '', email: '', status: 'unsubscribed' }
    }
    const userData = userSnap.data() || {}
    const role = String(userData.role || '').trim()
    const userTypeValue = String(userData.userType || '').trim()
    const userPaymentStatus = String(userData.paymentStatus || '').trim()
    const userEmail = String(userData.email || '').trim().toLowerCase()
    const userSubscriptionStatus = String(userData.subscriptionAccessStatus || '').trim().toLowerCase()

    const directPlan = getEntitlementPlanKey(userData.subscriptionPlan || userData.plan, userPaymentStatus)
    if (directPlan) {
      return {
        planKey: directPlan,
        expiresAt: toDate(userData.subscriptionExpiresAt),
        graceEndsAt: toDate(userData.subscriptionGraceEndsAt),
        role, userType: userTypeValue, paymentStatus: userPaymentStatus, email: userEmail, status: userSubscriptionStatus,
      }
    }

    // Customers, suppliers, and system administrators do not belong to a
    // clinic subscription. Do not fall through to the owner-clinic query for
    // them: that query is correctly denied by Firestore and was creating
    // avoidable permission errors during normal sign-in/navigation.
    if (isNonClinicSubscriptionRole(role, userTypeValue)) {
      return { planKey: '', expiresAt: null, graceEndsAt: null, role, userType: userTypeValue, paymentStatus: userPaymentStatus, email: userEmail, status: 'active' }
    }

    const branchId = userData.branchId
    if (branchId) {
      const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
      if (clinicSnap.exists()) {
        const clinicData = clinicSnap.data() || {}
        const clinicPlan = getEntitlementPlanKey(clinicData.subscriptionPlan || clinicData.plan, clinicData.paymentStatus || userPaymentStatus)
        if (clinicPlan) {
          return {
            planKey: clinicPlan,
            expiresAt: toDate(clinicData.subscriptionExpiresAt),
            graceEndsAt: toDate(clinicData.subscriptionGraceEndsAt),
            role,
            userType: userTypeValue,
            paymentStatus: String(clinicData.paymentStatus || '').trim() || userPaymentStatus,
            status: String(clinicData.subscriptionAccessStatus || '').trim().toLowerCase() || userSubscriptionStatus,
            email: userEmail
          }
        }
        const clinicOwnerId = String(clinicData.ownerId || '').trim()
        if (clinicOwnerId) {
          const ownerSnap = await getDoc(doc(db, 'users', clinicOwnerId))
          if (ownerSnap.exists()) {
            const ownerData = ownerSnap.data() || {}
            const ownerPlan = getEntitlementPlanKey(ownerData.subscriptionPlan || ownerData.plan, ownerData.paymentStatus || userPaymentStatus)
            if (ownerPlan) {
              return {
                planKey: ownerPlan,
                expiresAt: toDate(ownerData.subscriptionExpiresAt),
                graceEndsAt: toDate(ownerData.subscriptionGraceEndsAt),
                role,
                userType: userTypeValue,
                paymentStatus: String(ownerData.paymentStatus || '').trim() || userPaymentStatus,
                status: String(ownerData.subscriptionAccessStatus || '').trim().toLowerCase() || userSubscriptionStatus,
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
      const clinicPlan = getEntitlementPlanKey(clinicData.subscriptionPlan || clinicData.plan, clinicData.paymentStatus || userPaymentStatus)
      if (clinicPlan) {
        return {
          planKey: clinicPlan,
          expiresAt: toDate(clinicData.subscriptionExpiresAt),
          graceEndsAt: toDate(clinicData.subscriptionGraceEndsAt),
          role,
          userType: userTypeValue,
            paymentStatus: String(clinicData.paymentStatus || '').trim() || userPaymentStatus,
            status: String(clinicData.subscriptionAccessStatus || '').trim().toLowerCase() || userSubscriptionStatus,
          email: userEmail
        }
      }
    }

    return { planKey: '', expiresAt: null, graceEndsAt: null, role, userType: userTypeValue, paymentStatus: userPaymentStatus, email: userEmail, status: 'unsubscribed' }
  }

  const loadPlanPermissions = async (planKey) => {
    if (!planKey) return []
    const allowed = new Set(DEFAULT_FEATURES[planKey] || [])
    try {
      const cached = JSON.parse(localStorage.getItem(`${PLAN_FEATURES_CACHE_PREFIX}${planKey}`) || 'null')
      if (cached && Array.isArray(cached.data) && cached.ts) {
        const isFresh = Date.now() - cached.ts < PLAN_CACHE_TTL_MS
        if (isFresh && cached.data.length) {
          activeFeatures.value = cached.data.filter((feature) => allowed.has(feature))
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
          const permissions = [...new Set([
            ...allowed,
            ...data.permissions
              .map((value) => String(value || '').trim())
              .filter((feature) => allowed.has(feature))
          ])]
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
    return [...allowed]
  }

  const startPlanPermissionsListener = (planKey) => {
    if (!planKey || !auth.currentUser) return
    stopPlanPermissionsListener()

    unsubscribePlanPermissions = onSnapshot(
      doc(db, 'planPermissions', planKey),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() || {}
          if (Array.isArray(data.permissions) && data.permissions.length) {
            const allowed = new Set(DEFAULT_FEATURES[planKey] || [])
            // A plan-permissions document can refine a plan, but it must not
            // grant a Basic clinic a Premium-only workforce/payroll feature.
            activeFeatures.value = [...new Set([
              ...allowed,
              ...data.permissions
                .map((value) => String(value || '').trim())
                .filter((feature) => allowed.has(feature))
            ])]
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
        activeFeatures.value = DEFAULT_FEATURES[planKey] || []
      },
      (error) => {
        // Registration deliberately signs the applicant out once documents
        // are submitted. Do not keep a protected listener alive after that.
        if (!auth.currentUser && isPermissionDenied(error)) {
          stopPlanPermissionsListener()
          return
        }
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
        stopPlanPermissionsListener()
        activePlanKey = ''
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
        isSuspended.value = false
        subscriptionStatus.value = SUBSCRIPTION_STATUS.ACTIVE
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
          isSuspended.value = false
          subscriptionStatus.value = SUBSCRIPTION_STATUS.ACTIVE
          graceEndsAt.value = null
          subscriptionExpiresAt.value = null
          userRole.value = 'Customer'
          userType.value = 'Customer'
          return
        }
        throw error
      }
      // Auth can change while the Firestore reads above are in flight (for
      // example, after document submission signs the registrant out).
      if (auth.currentUser?.uid !== user.uid) return
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
        isSuspended.value = false
        subscriptionStatus.value = SUBSCRIPTION_STATUS.ACTIVE
        graceEndsAt.value = null
        subscriptionExpiresAt.value = null
        userRole.value = subscriptionMeta.role || subscriptionMeta.userType || ''
        userType.value = subscriptionMeta.userType || ''
        return
      }
      if (isNonClinicSubscriptionRole(subscriptionMeta.role, subscriptionMeta.userType)) {
        stopPlanPermissionsListener()
        activePlanKey = ''
        activePlan.value = ''
        activeFeatures.value = []
        isReadOnly.value = false
        isExpired.value = false
        isSuspended.value = false
        subscriptionStatus.value = SUBSCRIPTION_STATUS.ACTIVE
        graceEndsAt.value = null
        subscriptionExpiresAt.value = null
        userRole.value = subscriptionMeta.role || ''
        userType.value = subscriptionMeta.userType || ''
        return
      }

      const paymentStatus = String(subscriptionMeta.paymentStatus || '').trim().toLowerCase()
      const subscriptionState = subscriptionLifecycle({
        subscriptionPlan: subscriptionMeta.planKey,
        paymentStatus,
        subscriptionExpiresAt: subscriptionMeta.expiresAt,
        subscriptionGraceEndsAt: subscriptionMeta.graceEndsAt,
        subscriptionAccessStatus: subscriptionMeta.status,
      })
      const planKey = subscriptionState.plan
      const resolvedExpiresAt = subscriptionState.expiresAt
      activePlanKey = planKey
      activePlan.value = planKey
      subscriptionExpiresAt.value = resolvedExpiresAt
      graceEndsAt.value = subscriptionState.graceEndsAt
      userRole.value = subscriptionMeta.role || ''
      userType.value = subscriptionMeta.userType || ''
      const permissions = planKey ? await loadPlanPermissions(planKey) : []
      activeFeatures.value = permissions
      if (auth.currentUser?.uid === user.uid) startPlanPermissionsListener(planKey)
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

      const lifecycleStatus = subscriptionState.status
      const operational = subscriptionState.isOperational
      isExpired.value = lifecycleStatus === 'expired'
      isReadOnly.value = !operational
      isSuspended.value = !operational
      subscriptionStatus.value = operational ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.SUSPENDED
    } catch (error) {
      console.error('Failed to load subscription features:', error)
      activePlanKey = ''
      activePlan.value = ''
      activeFeatures.value = []
      isReadOnly.value = true
      isExpired.value = false
      isSuspended.value = true
      subscriptionStatus.value = SUBSCRIPTION_STATUS.SUSPENDED
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
    // Renewal remains available, but business modules are blocked after expiry.
    if (subscriptionStatus.value !== SUBSCRIPTION_STATUS.ACTIVE) {
      return false
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
    isSuspended,
    subscriptionStatus,
    graceEndsAt,
    subscriptionExpiresAt,
    userRole,
    initSubscription,
    hasFeature,
    refreshSubscription
  }
})
