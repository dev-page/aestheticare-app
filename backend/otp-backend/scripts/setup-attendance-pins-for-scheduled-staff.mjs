import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'serviceAccountKey.json')

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

const generateAttendancePin = (length = 6) => {
  let pin = ''
  for (let i = 0; i < length; i += 1) {
    pin += Math.floor(Math.random() * 10).toString()
  }
  return pin
}

const hasAnyShiftAssignment = (assignments = {}) => {
  return Object.values(assignments).some((value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return Boolean(normalized) && normalized !== 'off'
  })
}

const run = async () => {
  const staffQuery = db.collection('users').where('userType', '==', 'Staff')
  const snapshot = await staffQuery.get()

  const staffUsers = snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .filter((user) => !user.archived)

  const results = []

  for (const user of staffUsers) {
    const scheduleSnap = await db.collection('users').doc(user.id).collection('schedules').get()
    const hasSchedule = scheduleSnap.docs.some((docSnap) => {
      const data = docSnap.data() || {}
      return hasAnyShiftAssignment(data.assignments || {})
    })

    if (!hasSchedule) continue

    let pin = String(user.attendancePin || '').trim()
    let created = false

    if (!pin) {
      pin = generateAttendancePin()
      created = true
      await db.collection('users').doc(user.id).set(
        {
          attendancePin: pin,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    }

    const fullName =
      String(user.fullName || '').trim() ||
      `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
      'Unknown Staff'

    results.push({
      uid: user.id,
      fullName,
      email: String(user.email || '').trim(),
      role: String(user.role || 'Staff').trim(),
      pin,
      created,
    })
  }

  results.sort((a, b) => a.fullName.localeCompare(b.fullName))

  console.log(JSON.stringify({ total: results.length, staff: results }, null, 2))
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Setup failed:', error?.message || error)
    process.exit(1)
  })
