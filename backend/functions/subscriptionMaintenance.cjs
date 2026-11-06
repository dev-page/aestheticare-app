const crypto = require('node:crypto')

// Idempotent lifecycle maintenance. It never deletes clinic data; disposition
// is a review marker for an authorised, separately implemented process.
exports.runSubscriptionMaintenance = async ({ admin, now = new Date(), normalizePlanKey, toDate, getPlanDurationDays, clearPendingSubscriptionFields, gracePeriodDays = 7, retentionDays = 90 }) => {
  const db = admin.firestore()
  const clinics = await db.collection('clinics').get()
  const owners = new Set(clinics.docs.map(doc => String(doc.data().ownerId || '')).filter(Boolean))
  let updated = 0
  for (const ownerId of owners) {
    updated += await db.runTransaction(async tx => {
      const ownerRef = db.collection('users').doc(ownerId)
      const [owner, branches] = await Promise.all([tx.get(ownerRef), tx.get(db.collection('clinics').where('ownerId', '==', ownerId))])
      const main = branches.docs.find(doc => doc.id === ownerId) || branches.docs[0]
      if (!main) return 0
      const record = { ...main.data(), ...(owner.exists ? owner.data() : {}) }
      let plan = normalizePlanKey(record.subscriptionPlan || record.plan)
      let expiry = toDate(record.subscriptionExpiresAt)
      let paymentStatus = String(record.paymentStatus || '').toLowerCase()
      let status = String(record.subscriptionAccessStatus || (paymentStatus === 'trial' ? 'trial' : 'active')).toLowerCase()
      let payload = {}
      const pending = normalizePlanKey(record.pendingSubscriptionPlan)
      const applyAt = toDate(record.pendingSubscriptionApplyAt) || expiry
      if (pending && applyAt && now >= applyAt) {
        plan = pending
        expiry = toDate(record.pendingSubscriptionNextExpiresAt) || new Date(applyAt.getTime() + getPlanDurationDays(plan, record.pendingSubscriptionBillingCycle || 'month') * 86400000)
        paymentStatus = record.pendingSubscriptionPaymentId ? 'paid' : 'pending'
        status = 'active'
        payload = { ...clearPendingSubscriptionFields(), subscriptionStartedAt: applyAt, paymentStatus, paymentId: record.pendingSubscriptionPaymentId || null, subscriptionGraceEndsAt: null, subscriptionRetentionEndsAt: null }
      }
      const graceEndsAt = toDate(record.subscriptionGraceEndsAt)
      if (plan && ['trial', 'active', 'canceled'].includes(status) && expiry && now >= expiry) {
        status = 'grace_period'
        payload.subscriptionGraceStartedAt = expiry
        payload.subscriptionGraceEndsAt = graceEndsAt || new Date(expiry.getTime() + gracePeriodDays * 86400000)
      }
      const finalGraceEnd = toDate(payload.subscriptionGraceEndsAt) || graceEndsAt
      if (status === 'grace_period' && finalGraceEnd && now >= finalGraceEnd) {
        status = 'expired'
        payload.subscriptionRetentionStartedAt = finalGraceEnd
        payload.subscriptionRetentionEndsAt = toDate(record.subscriptionRetentionEndsAt) || new Date(finalGraceEnd.getTime() + retentionDays * 86400000)
      }
      const retentionEndsAt = toDate(payload.subscriptionRetentionEndsAt) || toDate(record.subscriptionRetentionEndsAt)
      if (status === 'expired' && retentionEndsAt && now >= retentionEndsAt && record.subscriptionDispositionStatus !== 'review_required') {
        payload.subscriptionDispositionStatus = 'review_required'
        payload.subscriptionDispositionEligibleAt = retentionEndsAt
      }
      const desired = { ...payload, subscriptionPlan: plan || null, subscriptionExpiresAt: expiry || null, subscriptionAccessStatus: status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
      const changed = [record, ...branches.docs.map(doc => doc.data())].some(current =>
        Object.keys(desired).some(key => key !== 'updatedAt' && String(current[key] || '') !== String(desired[key] || '')))
      if (!changed) return 0
      for (const branch of branches.docs) tx.set(branch.ref, desired, { merge: true })
      if (owner.exists) tx.set(ownerRef, desired, { merge: true })
      if (status === 'expired') {
        const key = crypto.createHash('sha256').update(`${ownerId}:expired:${finalGraceEnd?.toISOString() || ''}`).digest('hex')
        tx.set(db.collection('notifications').doc(`subscription-expired-${key}`), { recipientUserId: ownerId, title: 'Subscription expired', message: 'Operational access is restricted. Your clinic records are retained while you renew or export authorised data.', link: '/account/subscription', read: false, deleted: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      }
      return branches.docs.length + (owner.exists ? 1 : 0)
    })
  }
  return { updated }
}
