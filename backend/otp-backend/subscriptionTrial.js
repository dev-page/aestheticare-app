import { subscriptionLifecycle, TRIAL_DAYS, TRIAL_PLAN } from '../../shared/subscriptionLifecycle.js'

export function registerSubscriptionTrial(app, { admin, requireAuth, loadUserContext }) {
  const db = admin.firestore()
  app.post('/subscription/start-trial', requireAuth, async (req, res) => {
    try {
      const context = await loadUserContext(req.user.uid)
      if (context.roleKey !== 'Owner') return res.status(403).json({ success: false, error: 'Only the clinic owner can start the trial.' })
      const ownerRef = db.collection('users').doc(req.user.uid)
      const clinicRef = db.collection('clinics').doc(req.user.uid)
      const paymentQuery = db.collection('planPayments').where('ownerUid', '==', req.user.uid)
      const result = await db.runTransaction(async tx => {
        const [owner, clinic, payments] = await Promise.all([tx.get(ownerRef), tx.get(clinicRef), tx.get(paymentQuery)])
        if (!owner.exists || !clinic.exists || clinic.data().ownerId !== req.user.uid) throw Object.assign(new Error('Complete clinic registration before starting a trial.'), { status: 409 })
        const email = String(owner.data().email || '').trim().toLowerCase()
        const emailPayments = email ? await tx.get(db.collection('planPayments').where('payerEmail', '==', email)) : { docs: [] }
        if (String(owner.data().status).toLowerCase() !== 'active' || !String(clinic.data().approvalStatus || owner.data().approvalStatus).toLowerCase().includes('approved')) throw Object.assign(new Error('Your clinic must be approved and active before starting a trial.'), { status: 403 })
        const lifecycle = subscriptionLifecycle(owner.data())
        const clinicLifecycle = subscriptionLifecycle(clinic.data())
        const paid = [...payments.docs, ...emailPayments.docs].some(row => ['paid', 'succeeded'].includes(String(row.data().status || row.data().paymongoStatus).toLowerCase()))
        // Retrying a successful activation returns the same trial, never a new end date.
        if (lifecycle.trial && clinicLifecycle.trial && lifecycle.expiresAt && owner.data().subscriptionTrialUsedAt && !paid) return { plan: lifecycle.plan, trialDays: TRIAL_DAYS, expiresAt: lifecycle.expiresAt.toISOString() }
        if (!lifecycle.trialEligible || !clinicLifecycle.trialEligible || paid) throw Object.assign(new Error('The trial is available once to clinics that have not used a trial or paid subscription.'), { status: 409 })
        const now = new Date(), endsAt = new Date(now.getTime() + TRIAL_DAYS * 86400000)
        const stamp = admin.firestore.FieldValue.serverTimestamp()
        const fields = { subscriptionPlan: TRIAL_PLAN, paymentStatus: 'trial', paymentId: null,
          subscriptionStartedAt: null, subscriptionExpiresAt: endsAt,
          subscriptionTrialPlan: TRIAL_PLAN, subscriptionTrialUsedAt: stamp,
          subscriptionTrialStartedAt: now, subscriptionTrialEndsAt: endsAt,
          subscriptionUpdatedAt: stamp, updatedAt: stamp }
        tx.set(ownerRef, fields, { merge: true })
        tx.set(clinicRef, fields, { merge: true })
        tx.set(db.collection('notifications').doc(`subscription-trial-${req.user.uid}`), {
          recipientUserId: req.user.uid, title: 'Your Premium trial has started',
          message: `You have ${TRIAL_DAYS} days to explore Basic features. No subscription payment is collected. Your account returns to Free when the trial ends unless you purchase a plan.`,
          link: '/account/subscription', read: false, createdAt: stamp })
        return { plan: TRIAL_PLAN, trialDays: TRIAL_DAYS, expiresAt: endsAt.toISOString() }
      })
      return res.json({ success: true, data: result })
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to start the trial.' }) }
  })
}
