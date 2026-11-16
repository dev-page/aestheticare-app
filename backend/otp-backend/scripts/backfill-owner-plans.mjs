import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'serviceAccountKey.json')

const normalizePlan = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (['free-trial', 'freetrial', 'free_trial', 'free trial', 'trial'].includes(raw)) return 'free-trial'
  if (raw === 'basic' || raw === 'premium') return raw
  // A missing or legacy Free value means no offer was selected. Do not grant
  // a trial as a side effect of a migration script.
  return ''
}

const paymentStatusForPlan = (plan, currentStatus) => {
  if (String(currentStatus || '').trim()) return currentStatus
  return plan === 'free-trial' ? 'trial' : 'pending'
}

const run = async () => {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  const usersSnap = await db.collection('users').get()
  const ownerDocs = usersSnap.docs.filter((snap) => {
    const data = snap.data() || {}
    return String(data.role || '').trim().toLowerCase() === 'owner'
  })

  let userUpdates = 0
  let clinicUpdates = 0

  for (const ownerDoc of ownerDocs) {
    const uid = ownerDoc.id
    const userData = ownerDoc.data() || {}
    const plan = normalizePlan(userData.subscriptionPlan || userData.plan)

    await db.collection('users').doc(uid).set(
      {
        subscriptionPlan: plan || admin.firestore.FieldValue.delete(),
        plan: plan || admin.firestore.FieldValue.delete(),
        paymentStatus: plan ? paymentStatusForPlan(plan, userData.paymentStatus) : admin.firestore.FieldValue.delete(),
        paymentId: plan ? userData.paymentId || null : admin.firestore.FieldValue.delete(),
        subscriptionAccessStatus: plan ? userData.subscriptionAccessStatus || (plan === 'free-trial' ? 'trial' : 'active') : 'unsubscribed',
        planBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    userUpdates += 1

    const clinicsByOwnerSnap = await db.collection('clinics').where('ownerId', '==', uid).get()
    for (const clinicDoc of clinicsByOwnerSnap.docs) {
      const clinicData = clinicDoc.data() || {}
      const clinicPlan = normalizePlan(clinicData.subscriptionPlan || clinicData.plan || plan)
      await db.collection('clinics').doc(clinicDoc.id).set(
        {
          subscriptionPlan: clinicPlan || admin.firestore.FieldValue.delete(),
          plan: clinicPlan || admin.firestore.FieldValue.delete(),
          paymentStatus: clinicPlan ? paymentStatusForPlan(clinicPlan, clinicData.paymentStatus) : admin.firestore.FieldValue.delete(),
          paymentId: clinicPlan ? clinicData.paymentId || null : admin.firestore.FieldValue.delete(),
          subscriptionAccessStatus: clinicPlan ? clinicData.subscriptionAccessStatus || (clinicPlan === 'free-trial' ? 'trial' : 'active') : 'unsubscribed',
          planBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      clinicUpdates += 1
    }

    const clinicDocByUid = await db.collection('clinics').doc(uid).get()
    if (clinicDocByUid.exists) {
      const clinicData = clinicDocByUid.data() || {}
      const clinicPlan = normalizePlan(clinicData.subscriptionPlan || clinicData.plan || plan)
      await db.collection('clinics').doc(uid).set(
        {
          subscriptionPlan: clinicPlan || admin.firestore.FieldValue.delete(),
          plan: clinicPlan || admin.firestore.FieldValue.delete(),
          paymentStatus: clinicPlan ? paymentStatusForPlan(clinicPlan, clinicData.paymentStatus) : admin.firestore.FieldValue.delete(),
          paymentId: clinicPlan ? clinicData.paymentId || null : admin.firestore.FieldValue.delete(),
          subscriptionAccessStatus: clinicPlan ? clinicData.subscriptionAccessStatus || (clinicPlan === 'free-trial' ? 'trial' : 'active') : 'unsubscribed',
          planBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      clinicUpdates += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        ownerCount: ownerDocs.length,
        userUpdates,
        clinicUpdates,
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
