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

  const missingBranch = []
  const staffCounts = {}

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const userType = normalizeRole(data.userType)
    const role = normalizeRole(data.role)
    const isStaff = userType === 'staff' || ['manager', 'hr', 'finance', 'receptionist', 'practitioner', 'cashier', 'supply'].includes(role)
    if (!isStaff) return

    const branchId = String(data.branchId || '').trim()
    staffCounts[role || userType || 'unknown'] = (staffCounts[role || userType || 'unknown'] || 0) + 1

    if (!branchId) {
      missingBranch.push({
        id: docSnap.id,
        email: data.email || '',
        role: data.role || data.userType || '',
      })
    }
  })

  console.log(JSON.stringify({
    staffCounts,
    missingBranchCount: missingBranch.length,
    missingBranch,
  }, null, 2))

  await admin.app().delete()
}

run().catch((error) => {
  console.error('BranchId audit failed:', error?.message || error)
  process.exit(1)
})
