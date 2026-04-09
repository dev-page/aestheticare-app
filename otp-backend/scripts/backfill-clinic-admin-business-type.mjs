import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const rootDir = path.join(__dirname, '..', '..')
const serviceAccountPathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
const serviceAccountPath = serviceAccountPathFromEnv
  ? (path.isAbsolute(serviceAccountPathFromEnv)
    ? serviceAccountPathFromEnv
    : path.join(rootDir, serviceAccountPathFromEnv))
  : path.join(__dirname, '..', 'serviceAccountKey.json')

const normalizeRole = (value) => String(value || '').trim().toLowerCase()

const run = async () => {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  const usersSnap = await db.collection('users').get()
  const clinicAdmins = usersSnap.docs.filter((snap) => {
    const data = snap.data() || {}
    const role = normalizeRole(data.role)
    return role === 'clinic admin' || role === 'clinicadmin'
  })

  let userUpdates = 0
  let clinicUpdates = 0

  for (const adminDoc of clinicAdmins) {
    const uid = adminDoc.id

    await db.collection('users').doc(uid).set(
      {
        businessType: 'sole_proprietor',
        businessTypeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    userUpdates += 1

    const clinicsByOwnerSnap = await db.collection('clinics').where('ownerId', '==', uid).get()
    for (const clinicDoc of clinicsByOwnerSnap.docs) {
      await db.collection('clinics').doc(clinicDoc.id).set(
        {
          businessType: 'sole_proprietor',
          businessTypeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      clinicUpdates += 1
    }

    const clinicDocByUid = await db.collection('clinics').doc(uid).get()
    if (clinicDocByUid.exists) {
      await db.collection('clinics').doc(uid).set(
        {
          businessType: 'sole_proprietor',
          businessTypeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
