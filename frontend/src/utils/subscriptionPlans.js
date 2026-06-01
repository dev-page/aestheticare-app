const BASE_PRIORITY = {
  'free-trial': 0,
  free: 0,
  basic: 999,
  premium: 2499,
}

const DISPLAY_ORDER = {
  'free-trial': 0,
  free: 0,
  basic: 1,
  premium: 2,
}

export const prettifySubscriptionPlanId = (value) =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

export const formatSubscriptionPrice = (amount) => {
  const value = Number(amount)
  const safeValue = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(safeValue)
}

export const formatSubscriptionCycle = (cycle) => {
  const normalized = String(cycle || '').trim().toLowerCase()
  if (!normalized || normalized === 'trial') return ''
  if (normalized.startsWith('/')) return normalized
  return `/${normalized}`
}

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0
  const direct = Number(value)
  if (Number.isFinite(direct)) return direct
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const getTimestampValue = (value) => {
  if (!value) return 0
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const getDisplayOrder = (planId) => {
  const normalizedId = String(planId || '').trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(DISPLAY_ORDER, normalizedId)) {
    return DISPLAY_ORDER[normalizedId]
  }
  return 1000
}

const normalizeFeatures = (features, fallback = []) => {
  const source = Array.isArray(features)
    ? features
    : Array.isArray(fallback)
      ? fallback
      : []

  return source
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)
}

export const normalizeSubscriptionPlan = (plan = {}, fallback = {}) => {
  const rawId = String(plan.id || fallback.id || '').trim().toLowerCase()
  const id = rawId === 'free-trial' ? 'free' : rawId
  const label = String(plan.label || plan.name || fallback.label || fallback.name || '').trim()
  const name = String(plan.name || plan.label || fallback.name || fallback.label || '').trim()
  const billingCycle = String(plan.billingCycle || plan.cycle || fallback.billingCycle || fallback.cycle || '').trim()
  const price = toNumber(plan.price ?? fallback.price ?? 0)
  const isDeleted = Boolean(plan.isDeleted ?? fallback.isDeleted ?? false)

  return {
    ...fallback,
    ...plan,
    id,
    label: label || name || prettifySubscriptionPlanId(id),
    name: name || label || prettifySubscriptionPlanId(id),
    price,
    priceLabel: plan.priceLabel || fallback.priceLabel || formatSubscriptionPrice(price),
    billingCycle,
    cycle: billingCycle,
    cycleLabel: plan.cycleLabel || fallback.cycleLabel || formatSubscriptionCycle(billingCycle),
    description: String(plan.description || fallback.description || '').trim(),
    trialDays: Math.max(0, Math.floor(toNumber(plan.trialDays ?? fallback.trialDays ?? 0))),
    features: normalizeFeatures(plan.features, fallback.features),
    recommended: Boolean(plan.recommended ?? fallback.recommended ?? (id === 'premium')),
    isActive: plan.isActive !== false && fallback.isActive !== false && !isDeleted,
    isDeleted,
    createdAt: plan.createdAt ?? fallback.createdAt ?? null,
  }
}

export const buildSubscriptionPlanCatalog = (basePlans = [], snapshotDocs = []) => {
  const dbPlans = new Map(snapshotDocs.map((docSnap) => [docSnap.id, docSnap.data() || {}]))
  const normalizedBasePlans = basePlans.map((basePlan) =>
    normalizeSubscriptionPlan(
      {
        ...basePlan,
        ...dbPlans.get(basePlan.id),
        id: basePlan.id,
        features: Array.isArray(dbPlans.get(basePlan.id)?.features) ? dbPlans.get(basePlan.id).features : basePlan.features,
      },
      basePlan,
    ),
  )

  const baseIds = new Set(normalizedBasePlans.map((plan) => plan.id))
  const orderedBasePlans = [...normalizedBasePlans].sort((a, b) => {
    const orderDiff = getDisplayOrder(a.id) - getDisplayOrder(b.id)
    if (orderDiff) return orderDiff
    return String(a.name || a.label || a.id).localeCompare(String(b.name || b.label || b.id))
  })

  const customPlans = snapshotDocs
    .filter((docSnap) => !baseIds.has(docSnap.id))
    .map((docSnap) =>
      normalizeSubscriptionPlan(
        {
          id: docSnap.id,
          ...dbPlans.get(docSnap.id),
          features: Array.isArray(dbPlans.get(docSnap.id)?.features) ? dbPlans.get(docSnap.id).features : [''],
        },
        {
          id: docSnap.id,
          label: prettifySubscriptionPlanId(docSnap.id),
          name: prettifySubscriptionPlanId(docSnap.id),
          features: [''],
        },
      ),
    )
    .filter((plan) => !plan.isDeleted)
    .sort((a, b) => {
      const createdDiff = getTimestampValue(a.createdAt) - getTimestampValue(b.createdAt)
      if (createdDiff) return createdDiff
      return String(a.name || a.label || a.id).localeCompare(String(b.name || b.label || b.id))
    })

  return [...orderedBasePlans, ...customPlans]
}

export const filterActiveSubscriptionPlans = (plans = [], { fallbackToAll = true } = {}) => {
  const activePlans = plans.filter((plan) => plan.isActive !== false)
  return activePlans.length || !fallbackToAll ? activePlans : plans
}

export const getSubscriptionPlanPriority = (planId, planCatalog = []) => {
  const normalizedId = String(planId || '').trim().toLowerCase()
  const knownPlan = planCatalog.find((plan) => String(plan.id || '').trim().toLowerCase() === normalizedId)

  if (knownPlan) {
    const knownPrice = toNumber(knownPlan.price)
    if (knownPrice > 0) return knownPrice
  }

  if (Object.prototype.hasOwnProperty.call(BASE_PRIORITY, normalizedId)) {
    return BASE_PRIORITY[normalizedId]
  }

  return toNumber(knownPlan?.price || 0)
}
