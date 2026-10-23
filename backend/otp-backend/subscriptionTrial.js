import { subscriptionLifecycle, TRIAL_DAYS, TRIAL_PLAN, normalizeSubscriptionPlan } from '../../shared/subscriptionLifecycle.js'

export function registerSubscriptionTrial(app, { admin, requireAuth, loadUserContext }) {
  const db = admin.firestore()
  app.post('/subscription/start-trial', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      if (context.roleKey !== 'Owner') return res.status(403).json({ success: false, error: 'Only the clinic owner can start the trial.' })
      const requestedPlan = normalizeSubscriptionPlan(req.body?.targetPlan || TRIAL_PLAN)
      if (!['basic', 'premium'].includes(requestedPlan)) return res.status(400).json({ success: false, error: 'Choose an available paid plan for the free trial.' })
      const ownerRef = db.collection('users').doc(req.user.uid)
      const clinicRef = db.collection('clinics').doc(req.user.uid)
      const paymentQuery = db.collection('planPayments').where('ownerUid', '==', req.user.uid)
      const result = await db.runTransaction(async tx => {
        const planRef = db.collection('subscriptionPlans').doc(requestedPlan)
        const [owner, clinic, payments, planSnap] = await Promise.all([tx.get(ownerRef), tx.get(clinicRef), tx.get(paymentQuery), tx.get(planRef)])
        if (!owner.exists || !clinic.exists || clinic.data().ownerId !== req.user.uid) throw Object.assign(new Error('Complete clinic registration before starting a trial.'), { status: 409 })
        const plan = planSnap.exists ? planSnap.data() || {} : {}
        // Keep the existing Premium 14-day offer as the safe fallback when no
        // plan document or trial settings have been configured yet.
        const defaultEnabled = requestedPlan === 'premium'
        const freeTrialEnabled = planSnap.exists && Object.hasOwn(plan, 'freeTrialEnabled')
          ? plan.freeTrialEnabled === true
          : defaultEnabled
        const configuredDays = Number(plan.trialDays)
        const trialDays = Number.isInteger(configuredDays) && configuredDays >= 1 && configuredDays <= 365
          ? configuredDays
          : (requestedPlan === 'premium' && (!planSnap.exists || !Object.hasOwn(plan, 'trialDays')) ? TRIAL_DAYS : 0)
        if (plan.isActive === false || Number(plan.price ?? (requestedPlan === 'basic' ? 499 : 999)) <= 0 || !freeTrialEnabled || !trialDays) {
          throw Object.assign(new Error('A free trial is not currently available for this plan.'), { status: 409 })
        }
        const email = String(owner.data().email || '').trim().toLowerCase()
        const emailPayments = email ? await tx.get(db.collection('planPayments').where('payerEmail', '==', email)) : { docs: [] }
        if (String(owner.data().status).toLowerCase() !== 'active' || !String(clinic.data().approvalStatus || owner.data().approvalStatus).toLowerCase().includes('approved')) throw Object.assign(new Error('Your clinic must be approved and active before starting a trial.'), { status: 403 })
        const lifecycle = subscriptionLifecycle(owner.data())
        const clinicLifecycle = subscriptionLifecycle(clinic.data())
        const paid = [...payments.docs, ...emailPayments.docs].some(row => ['paid', 'succeeded'].includes(String(row.data().status || row.data().paymongoStatus).toLowerCase()))
        // Retrying a successful activation returns the same trial, never a new end date.
        const existingTrialPlan = normalizeSubscriptionPlan(owner.data().subscriptionTrialPlan || clinic.data().subscriptionTrialPlan || lifecycle.plan)
        if (lifecycle.trial && clinicLifecycle.trial && lifecycle.expiresAt && owner.data().subscriptionTrialUsedAt && existingTrialPlan === requestedPlan && !paid) return { plan: lifecycle.plan, trialDays: Number(owner.data().subscriptionTrialDays || trialDays), expiresAt: lifecycle.expiresAt.toISOString() }
        if (!lifecycle.trialEligible || !clinicLifecycle.trialEligible || paid) throw Object.assign(new Error('The trial is available once to clinics that have not used a trial or paid subscription.'), { status: 409 })
        const now = new Date(), endsAt = new Date(now.getTime() + trialDays * 86400000)
        const stamp = admin.firestore.FieldValue.serverTimestamp()
        const fields = { subscriptionPlan: requestedPlan, paymentStatus: 'trial', paymentId: null,
          subscriptionStartedAt: null, subscriptionExpiresAt: endsAt,
          subscriptionTrialPlan: requestedPlan, subscriptionTrialUsedAt: stamp, subscriptionTrialDays: trialDays,
          subscriptionTrialStartedAt: now, subscriptionTrialEndsAt: endsAt,
          subscriptionUpdatedAt: stamp, updatedAt: stamp }
        tx.set(ownerRef, fields, { merge: true })
        tx.set(clinicRef, fields, { merge: true })
        tx.set(db.collection('notifications').doc(`subscription-trial-${req.user.uid}`), {
          recipientUserId: req.user.uid, title: `Your ${plan.name || plan.label || requestedPlan} trial has started`,
          message: `You have ${trialDays} days to use the ${plan.name || plan.label || requestedPlan} plan. No subscription payment is collected. Your account returns to Free when the trial ends. A later purchase uses the plan's normal price.`,
          link: '/account/subscription', read: false, createdAt: stamp })
        return { plan: requestedPlan, trialDays, expiresAt: endsAt.toISOString() }
      })
      return res.json({ success: true, data: result })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to start the trial.' }) }
  })
}
