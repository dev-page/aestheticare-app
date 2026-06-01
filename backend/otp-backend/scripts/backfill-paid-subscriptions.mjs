import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const resolveServiceAccountPath = () => {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (configured) {
    if (path.isAbsolute(configured)) return configured
    const resolved = path.join(__dirname, '..', configured)
    if (fs.existsSync(resolved)) return resolved
  }
  return path.join(__dirname, '..', 'serviceAccountKey.json')
}

const serviceAccountPath = resolveServiceAccountPath()

const normalizeRole = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

const isClinicAdminRole = (value) => {
  const role = normalizeRole(value)
  return role === 'clinicadmin' || role === 'owner' || role === 'clinicadministrator'
}

const normalizePlan = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('free')) return 'free-trial'
  return raw
}

const toMillis = (value) => {
  if (!value) return 0
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const pickLatestPaidPayment = (snap) => {
  let latest = null
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const status = String(data.status || '').trim().toLowerCase()
    if (status !== 'paid') return
    const createdAtMs = toMillis(data.createdAt)
    const refMs = createdAtMs
    if (!latest || refMs > latest.refMs) {
      latest = {
        id: docSnap.id,
        planId: normalizePlan(data.planId || data.planName || ''),
        refMs,
        createdAtMs,
      }
    }
  })
  return latest
}

const run = async () => {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  const usersSnap = await db.collection('users').get()
  const clinicAdmins = usersSnap.docs.filter((snap) => {
    const data = snap.data() || {}
    return isClinicAdminRole(data.role || data.userType)
  })

  let userUpdates = 0
  let clinicUpdates = 0
  let skipped = 0

  for (const adminDoc of clinicAdmins) {
    const uid = adminDoc.id
    const userData = adminDoc.data() || {}
    const email = String(userData.email || '').trim().toLowerCase()
    if (!email) {
      skipped += 1
      continue
    }

    const paymentsSnap = await db.collection('planPayments').where('payerEmail', '==', email).get()
    if (paymentsSnap.empty) {
      skipped += 1
      continue
    }

    const latestPayment = pickLatestPaidPayment(paymentsSnap)
    if (!latestPayment?.planId) {
      skipped += 1
      continue
    }

    const planDays = 30
    const startedAt = new Date(latestPayment.refMs || Date.now())
    const expiresAt = new Date(startedAt.getTime() + planDays * 24 * 60 * 60 * 1000)

    await db.collection('users').doc(uid).set(
      {
        subscriptionPlan: latestPayment.planId,
        paymentStatus: 'paid',
        paymentId: latestPayment.id,
        subscriptionStartedAt: startedAt,
        subscriptionExpiresAt: expiresAt,
        subscriptionBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    userUpdates += 1

    const clinicsByOwnerSnap = await db.collection('clinics').where('ownerId', '==', uid).get()
    for (const clinicDoc of clinicsByOwnerSnap.docs) {
      await db.collection('clinics').doc(clinicDoc.id).set(
        {
          subscriptionPlan: latestPayment.planId,
          paymentStatus: 'paid',
          paymentId: latestPayment.id,
          subscriptionStartedAt: startedAt,
          subscriptionExpiresAt: expiresAt,
          subscriptionBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      clinicUpdates += 1
    }

    const clinicDocByUid = await db.collection('clinics').doc(uid).get()
    if (clinicDocByUid.exists) {
      await db.collection('clinics').doc(uid).set(
        {
          subscriptionPlan: latestPayment.planId,
          paymentStatus: 'paid',
          paymentId: latestPayment.id,
          subscriptionStartedAt: startedAt,
          subscriptionExpiresAt: expiresAt,
          subscriptionBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      clinicUpdates += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        clinicAdminCount: clinicAdmins.length,
        userUpdates,
        clinicUpdates,
        skipped,
      },
      null,
      2
    )
  )

  await admin.app().delete()
}

run().catch((error) => {
  console.error('Backfill failed:', error?.message || error)
  process.exit(1)
})
