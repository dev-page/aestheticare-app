const functions = require('firebase-functions')
const admin = require('firebase-admin')
const sgMail = require('@sendgrid/mail')

admin.initializeApp()

const DAY_MS = 24 * 60 * 60 * 1000
const GRACE_DAYS = 7

const normalizePlanKey = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'free-plan' || raw === 'freeplan' || raw === 'free_plan' || raw === 'free-trial' || raw === 'trial') {
    return 'free'
  }
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('free')) return 'free'
  return raw
}

const getPlanDurationDays = (planKey, billingCycle = 'month') => {
  const normalizedPlan = normalizePlanKey(planKey)
  if (!normalizedPlan || normalizedPlan === 'free') return 0
  const normalizedCycle = String(billingCycle || '').trim().toLowerCase()
  if (normalizedCycle === 'year' || normalizedCycle === 'annual') return 365
  return 30
}

const clearPendingSubscriptionFields = () => ({
  pendingSubscriptionPlan: admin.firestore.FieldValue.delete(),
  pendingSubscriptionApplyAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionRequestedAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionChangeType: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaidAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionNextExpiresAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionBillingCycle: admin.firestore.FieldValue.delete(),
})

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

const getSendGridConfig = () => {
  try {
    const config = functions.config?.() || {}
    const key = String(config?.sendgrid?.key || '').trim()
    const sender = String(config?.sendgrid?.sender || '').trim()
    if (key && sender) {
      sgMail.setApiKey(key)
      return { key, sender }
    }
  } catch (_error) {
    // ignore
  }
  return { key: '', sender: '' }
}

const formatDate = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(value)
  } catch (_error) {
    return value.toISOString()
  }
}

exports.subscriptionMaintenance = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Manila')
  .onRun(async () => {
    const firestore = admin.firestore()
    const now = new Date()
    const { key, sender } = getSendGridConfig()
    const canEmail = Boolean(key && sender)

    const clinicsSnapshot = await firestore.collection('clinics').get()
    if (clinicsSnapshot.empty) {
      return { updated: 0, notified: 0 }
    }

    const ownerCache = new Map()
    const updates = []
    const mailJobs = []

    for (const docSnap of clinicsSnapshot.docs) {
      const data = docSnap.data() || {}
      let expiresAt = toDate(data.subscriptionExpiresAt)
      const pendingPlan = normalizePlanKey(data.pendingSubscriptionPlan)
      const pendingApplyAt = toDate(data.pendingSubscriptionApplyAt) || expiresAt
      const ownerId = String(data.ownerId || '').trim()

      if (pendingPlan && pendingApplyAt && now.getTime() >= pendingApplyAt.getTime()) {
        const nextExpiresAt =
          pendingPlan === 'free'
            ? null
            : toDate(data.pendingSubscriptionNextExpiresAt) ||
              new Date(
                pendingApplyAt.getTime() +
                  getPlanDurationDays(pendingPlan, data.pendingSubscriptionBillingCycle || 'month') * DAY_MS
              )
        const appliedPayload = {
          subscriptionPlan: pendingPlan,
          paymentStatus: pendingPlan === 'free' ? 'free' : (data.pendingSubscriptionPaymentId ? 'paid' : 'pending'),
          paymentId: pendingPlan === 'free' ? null : (data.pendingSubscriptionPaymentId || null),
          subscriptionStartedAt: pendingApplyAt,
          subscriptionExpiresAt: nextExpiresAt,
          subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...clearPendingSubscriptionFields(),
        }

        updates.push(docSnap.ref.set(appliedPayload, { merge: true }))
        if (ownerId) {
          updates.push(
            firestore.collection('users').doc(ownerId).set(appliedPayload, { merge: true })
          )
        }

        data.subscriptionPlan = pendingPlan
        data.paymentStatus = appliedPayload.paymentStatus
        data.paymentId = appliedPayload.paymentId
        expiresAt = nextExpiresAt
      }

      if (!expiresAt) continue
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)
      const isExpired = now.getTime() > expiresAt.getTime()
      const isPublished = data.isPublished === true

      if (isExpired && isPublished) {
        updates.push(
          docSnap.ref.update({
            isPublished: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        )
      }

      if (!canEmail || !ownerId) continue

      let ownerEmail = ownerCache.get(ownerId)
      if (ownerEmail === undefined) {
        const ownerSnap = await firestore.collection('users').doc(ownerId).get()
        ownerEmail = ownerSnap.exists ? String(ownerSnap.data().email || '').trim() : ''
        ownerCache.set(ownerId, ownerEmail)
      }
      if (!ownerEmail) continue

      if (isExpired && !data.subscriptionExpiredNotifiedAt) {
        mailJobs.push(
          sgMail.send({
            to: ownerEmail,
            from: sender,
            subject: 'Your subscription has expired',
            text:
              `Your subscription expired on ${formatDate(expiresAt)}.\n` +
              `Your clinic page has been unpublished and your account is now read-only.`,
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.5;color:#2a1408;">
                <h2 style="margin:0 0 12px;">Subscription expired</h2>
                <p>Your subscription expired on <strong>${formatDate(expiresAt)}</strong>.</p>
                <p>Your clinic page has been unpublished and your account is now read-only.</p>
              </div>
            `
          })
        )
        updates.push(
          docSnap.ref.update({
            subscriptionExpiredNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        )
        continue
      }

      if (daysLeft >= 0 && daysLeft <= GRACE_DAYS && !data.subscriptionGraceNotifiedAt) {
        mailJobs.push(
          sgMail.send({
            to: ownerEmail,
            from: sender,
            subject: 'Your subscription is about to expire',
            text:
              `Your subscription will expire on ${formatDate(expiresAt)}.\n` +
              `You have ${daysLeft} day(s) left before your account becomes read-only.`,
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.5;color:#2a1408;">
                <h2 style="margin:0 0 12px;">Subscription expiring soon</h2>
                <p>Your subscription will expire on <strong>${formatDate(expiresAt)}</strong>.</p>
                <p>You have <strong>${daysLeft}</strong> day(s) left before your account becomes read-only.</p>
              </div>
            `
          })
        )
        updates.push(
          docSnap.ref.update({
            subscriptionGraceNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        )
      }
    }

    if (updates.length) {
      await Promise.all(updates)
    }
    if (mailJobs.length) {
      await Promise.allSettled(mailJobs)
    }

    return { updated: updates.length, notified: mailJobs.length }
  })
