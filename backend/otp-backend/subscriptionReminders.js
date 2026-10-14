import { createHash, randomUUID } from 'node:crypto'
import { subscriptionDate, subscriptionDateLabel, subscriptionRecord } from '../../shared/subscriptionDates.js'

const DAY = 86400000
export function expiryReminderStage(expiresAt, now = new Date()) {
  const expiry = subscriptionDate(expiresAt)
  const remaining = expiry ? expiry - now : 0
  if (remaining <= 0 || remaining > 7 * DAY) return null
  return remaining <= DAY ? 1 : remaining <= 3 * DAY ? 3 : 7
}

// One reminder per owner, billing period and threshold. Email delivery has its
// own retryable state so a failed email never suppresses the system notification.
export async function sendSubscriptionReminders({ admin, sendEmail, websiteUrl, now = new Date() }) {
  const db = admin.firestore()
  const clinics = await db.collection('clinics').where('subscriptionPlan', 'in', ['basic', 'premium', 'Basic', 'Premium']).get()
  const users = await db.collection('users').where('subscriptionPlan', 'in', ['basic', 'premium', 'Basic', 'Premium']).get()
  const owners = new Set(clinics.docs.map(doc => String(doc.data().ownerId || doc.id)))
  // User records with a clinic-owner role may exist before a clinic is created.
  for (const doc of users.docs) {
    const data = doc.data()
    if (/owner/i.test(`${data.role || ''} ${data.userType || ''}`)) owners.add(doc.id)
  }
  let notifications = 0, emails = 0, failures = 0
  for (const ownerId of owners) {
    const ownerRef = db.collection('users').doc(ownerId)
    const clinicRef = db.collection('clinics').doc(ownerId)
    const [ownerSnap, clinicSnap] = await Promise.all([ownerRef.get(), clinicRef.get()])
    if (!ownerSnap.exists) continue
    const record = subscriptionRecord(ownerSnap.data(), clinicSnap.data() || {})
    const stage = expiryReminderStage(record.subscriptionExpiresAt, now)
    if (!stage || !['basic', 'premium'].includes(String(record.subscriptionPlan || '').toLowerCase())) continue
    const expiry = subscriptionDate(record.subscriptionExpiresAt)
    const key = createHash('sha256').update(`${ownerId}:${expiry.toISOString()}:${stage}`).digest('hex')
    const reminderRef = db.collection('subscriptionReminders').doc(key)
    const notificationRef = db.collection('notifications').doc(`subscription-expiry-${key}`)
    const token = randomUUID()
    const trial = String(record.paymentStatus).toLowerCase() === 'trial'
    const trialPlanLabel = String(record.subscriptionPlan).toLowerCase() === 'premium' ? 'Premium' : 'Basic'
    const title = trial ? `Your ${trialPlanLabel} trial is ending soon` : 'Your subscription is nearing expiry'
    const message = trial
      ? `Your ${trialPlanLabel} trial ends on ${subscriptionDateLabel(expiry)} (Philippine time). No automatic charge applies. Your clinic returns to Free unless you purchase a plan. Your records and existing appointments are retained.`
      : `Your ${record.subscriptionPlan} subscription expires on ${subscriptionDateLabel(expiry)} (Philippine time). Your clinic returns to Free after expiry, with records and existing appointments retained. Review your Subscription Plan to arrange renewal and keep your paid features.`
    try {
      const claim = await db.runTransaction(async tx => {
        const [currentOwner, currentClinic, previous] = await Promise.all([tx.get(ownerRef), tx.get(clinicRef), tx.get(reminderRef)])
        if (!currentOwner.exists) return null
        const current = subscriptionRecord(currentOwner.data() || {}, currentClinic.data() || {})
        if (subscriptionDate(current.subscriptionExpiresAt)?.getTime() !== expiry.getTime()
          || String(current.subscriptionPlan).toLowerCase() !== String(record.subscriptionPlan).toLowerCase()) return null
        const state = previous.data() || {}
        const stamp = admin.firestore.FieldValue.serverTimestamp()
        if (!previous.exists) {
          tx.set(notificationRef, { recipientUserId: ownerId, title, message, link: '/account/subscription', read: false, deleted: false, createdAt: stamp })
        }
        const email = String(currentOwner.data()?.email || '').trim()
        const canSend = email && sendEmail && state.emailStatus !== 'sent' && !(subscriptionDate(state.leaseUntil) > now)
        tx.set(reminderRef, {
          ownerId, expiresAt: expiry, thresholdDays: stage,
          ...(!previous.exists ? { createdAt: stamp, emailStatus: 'pending' } : {}),
          ...(canSend ? { emailStatus: 'sending', leaseToken: token, leaseUntil: new Date(now.getTime() + 5 * 60000) } : {}),
          updatedAt: stamp,
        }, { merge: true })
        return { notification: !previous.exists, email: canSend ? email : null,
          unavailable: state.emailStatus !== 'sent' && (!email || !sendEmail) }
      })
      if (!claim) continue
      if (claim.notification) notifications++
      if (claim.unavailable) { failures++; continue }
      if (!claim.email) continue
      try {
        await sendEmail({ to: claim.email, subject: title, text: `${message}\n\nOpen your Subscription Plan: ${websiteUrl.replace(/\/$/, '')}/account/subscription` })
        await finishEmail('sent')
        emails++
      } catch {
        await finishEmail('pending')
        failures++
      }
      async function finishEmail(status) {
        await db.runTransaction(async tx => {
          const state = (await tx.get(reminderRef)).data()
          if (state?.leaseToken !== token) return
          tx.update(reminderRef, { emailStatus: status, leaseUntil: null, leaseToken: null,
            ...(status === 'sent' ? { emailSentAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        })
      }
    } catch {
      failures++
    }
  }
  return { notifications, emails, failures }
}

export function registerSubscriptionReminders(app, dependencies) {
  app.all('/cron/subscription-reminders', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '').trim()
    if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized.' })
    try {
      const result = await sendSubscriptionReminders(dependencies)
      return res.status(result.failures ? 503 : 200).json({ success: !result.failures, ...result })
    } catch {
      return res.status(503).json({ success: false, error: 'Unable to send subscription reminders.' })
    }
  })
}
