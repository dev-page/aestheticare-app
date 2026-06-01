import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const resolveServiceAccountPath = () => {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(__dirname, '..', 'serviceAccountKey.json'),
    path.join(process.cwd(), 'capstone', 'otp-backend', 'serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(__dirname, '..', 'serviceAccountKey.json')
}

const serviceAccountPath = resolveServiceAccountPath()

const normalizeRoleKey = (value) =>
  String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')

const pickRoleDefaults = ({ isOwner }) => {
  if (isOwner) {
    return { role: 'Clinic Admin', userType: 'Owner' }
  }
  return { role: 'Customer', userType: 'Customer' }
}

const splitName = (displayName) => {
  const name = String(displayName || '').trim()
  if (!name) return { firstName: '', lastName: '' }
  const parts = name.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

const run = async () => {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  const ownerIds = new Set()
  const clinicsSnap = await db.collection('clinics').get()
  clinicsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {}
    if (data.ownerId) ownerIds.add(String(data.ownerId))
  })

  let created = 0
  let patched = 0
  let scanned = 0
  let updatedRole = 0

  const listAllUsers = async (nextPageToken) => {
    const result = await admin.auth().listUsers(1000, nextPageToken)
    return result
  }

  let pageToken = undefined
  do {
    const result = await listAllUsers(pageToken)
    for (const userRecord of result.users) {
      scanned += 1
      const uid = userRecord.uid
      const userRef = db.collection('users').doc(uid)
      const userSnap = await userRef.get()
      const isOwner = ownerIds.has(uid)
      const defaults = pickRoleDefaults({ isOwner })

      const profile = splitName(userRecord.displayName)
      const createdAt = userRecord.metadata?.creationTime
        ? admin.firestore.Timestamp.fromDate(new Date(userRecord.metadata.creationTime))
        : admin.firestore.FieldValue.serverTimestamp()

      if (!userSnap.exists) {
        await userRef.set(
          {
            email: userRecord.email || '',
            firstName: profile.firstName,
            lastName: profile.lastName,
            role: defaults.role,
            userType: defaults.userType,
            status: 'Active',
            profilePicture: '',
            createdAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            backfilledAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        created += 1
        continue
      }

      const existing = userSnap.data() || {}
      const updates = {}

      if (!existing.email && userRecord.email) updates.email = userRecord.email
      if (!existing.firstName && profile.firstName) updates.firstName = profile.firstName
      if (!existing.lastName && profile.lastName) updates.lastName = profile.lastName

      const existingRoleKey = normalizeRoleKey(existing.role)
      if (!existingRoleKey) {
        updates.role = defaults.role
        updatedRole += 1
      }

      const existingTypeKey = normalizeRoleKey(existing.userType)
      if (!existingTypeKey) {
        updates.userType = defaults.userType
      }

      if (Object.keys(updates).length) {
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
        updates.backfilledAt = admin.firestore.FieldValue.serverTimestamp()
        await userRef.set(updates, { merge: true })
        patched += 1
      }
    }
    pageToken = result.pageToken
  } while (pageToken)

  console.log(
    JSON.stringify(
      {
        scanned,
        created,
        patched,
        updatedRole,
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
