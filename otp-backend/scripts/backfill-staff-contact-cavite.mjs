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

const staffContactMap = {
  'poldosophia@gmail.com': {
    phoneNumber: '+639171234501',
    address: 'Poblacion, Imus City, Cavite',
  },
  'piyayaya0440@gmail.com': {
    phoneNumber: '+639171234502',
    address: 'San Agustin, Trece Martires City, Cavite',
  },
  'zoffh.xavier@gmail.com': {
    phoneNumber: '+639171234503',
    address: 'Salitran, Dasmarinas City, Cavite',
  },
  'piyaya0440@gmail.com': {
    phoneNumber: '+639171234504',
    address: 'Talaba, Bacoor City, Cavite',
  },
}

const run = async () => {
  const userSnap = await db.collection('users').get()
  const updates = []

  userSnap.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const email = String(data.email || '').trim().toLowerCase()
    const match = staffContactMap[email]
    if (!match) return

    updates.push(
      docSnap.ref.set(
        {
          phoneNumber: match.phoneNumber,
          address: match.address,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  })

  if (!updates.length) {
    console.log('No matching staff records found to update.')
    return
  }

  await Promise.all(updates)
  console.log(`Updated ${updates.length} staff record(s) with Cavite contact info.`)
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error?.message || error)
    process.exit(1)
  })
