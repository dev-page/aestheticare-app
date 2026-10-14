const crypto = require('node:crypto')

// Each owner and their branches change together. Transaction retries prevent
// expiry maintenance from overwriting a payment received at the same time.
exports.runSubscriptionMaintenance = async ({ admin, now = new Date(), normalizePlanKey, toDate, getPlanDurationDays, clearPendingSubscriptionFields }) => {
  const db = admin.firestore()
  const clinics = await db.collection('clinics').get()
  const owners = new Set(clinics.docs.map(doc => String(doc.data().ownerId || '')).filter(Boolean))
  let updated = 0
  for (const ownerId of owners) {
    updated += await db.runTransaction(async tx => {
      const ownerRef = db.collection('users').doc(ownerId)
      const [owner, branches] = await Promise.all([
        tx.get(ownerRef), tx.get(db.collection('clinics').where('ownerId', '==', ownerId)),
      ])
      const main = branches.docs.find(doc => doc.id === ownerId) || branches.docs[0]
      if (!main) return 0
      const record = { ...main.data(), ...(owner.exists && owner.data().subscriptionPlan ? owner.data() : {}) }
      let plan = normalizePlanKey(record.subscriptionPlan || record.plan) || 'free'
      let expiry = toDate(record.subscriptionExpiresAt)
      let payload = {}
      const pending = normalizePlanKey(record.pendingSubscriptionPlan)
      const applyAt = toDate(record.pendingSubscriptionApplyAt) || expiry
      if (pending && applyAt && now >= applyAt) {
        plan = pending
        expiry = plan === 'free' ? null : toDate(record.pendingSubscriptionNextExpiresAt)
          || new Date(applyAt.getTime() + getPlanDurationDays(plan, record.pendingSubscriptionBillingCycle || 'month') * 86400000)
        payload = { ...clearPendingSubscriptionFields(), subscriptionStartedAt: applyAt,
          paymentStatus: plan === 'free' ? 'free' : record.pendingSubscriptionPaymentId ? 'paid' : 'pending',
          paymentId: plan === 'free' ? null : record.pendingSubscriptionPaymentId || null }
      }
      const expired = plan !== 'free' && expiry && now >= expiry
      if (expired) {
        const endedPlan = plan
        plan = 'free'
        payload = { ...payload, paymentStatus: 'free', subscriptionDowngradedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(String(payload.paymentStatus || record.paymentStatus).toLowerCase() === 'trial' ? {} : { lastPaidSubscriptionPlan: endedPlan }) }
        const key = crypto.createHash('sha256').update(`${ownerId}:${expiry.toISOString()}`).digest('hex')
        tx.set(db.collection('notifications').doc(`subscription-ended-${key}`), {
          recipientUserId: ownerId, title: 'Your clinic is now on Free',
          message: 'Your trial or paid subscription has ended. Your clinic remains published, and records and existing appointments are retained. Renew to restore paid features.',
          link: '/account/subscription', read: false, deleted: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        expiry = null
      }
      const needsSync = expired || Object.keys(payload).length || [record, ...branches.docs.map(doc => doc.data())].some(data =>
        normalizePlanKey(data.subscriptionPlan) !== plan || (data.subscriptionAccessStatus && data.subscriptionAccessStatus !== 'active')
        || (plan === 'free' && data.subscriptionExpiresAt))
      if (!needsSync) return 0
      payload = { ...payload, subscriptionPlan: plan, subscriptionExpiresAt: plan === 'free' ? null : expiry,
        subscriptionAccessStatus: 'active', subscriptionGraceEndsAt: null,
        ...(plan === 'free' ? { paymentStatus: 'free' } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() }
      for (const branch of branches.docs) tx.set(branch.ref, payload, { merge: true })
      if (owner.exists) tx.set(ownerRef, payload, { merge: true })
      return branches.docs.length + (owner.exists ? 1 : 0)
    })
  }
  return { updated }
}
