import admin from 'firebase-admin'
import { readFile } from 'node:fs/promises'

const keyPath = process.env.SERVICE_ACCOUNT_KEY || new URL('../serviceAccountKey.json', import.meta.url)
const key = JSON.parse(await readFile(keyPath, 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(key) })

const db = admin.firestore()
let updated = 0
let batch = db.batch()
let pending = 0
const flush = async () => { if (pending) { await batch.commit(); batch = db.batch(); pending = 0 } }

for (const doc of (await db.collection('users').where('userType', '==', 'Staff').get()).docs) {
  const staff = doc.data() || {}
  const branchIds = [...new Set([staff.branchId, ...(Array.isArray(staff.branchIds) ? staff.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))]
  if (!branchIds.length) continue
  const primaryBranchId = String(staff.branchId || branchIds[0])
  const primaryBranch = await db.collection('clinics').doc(primaryBranchId).get()
  const organizationOwnerId = String(primaryBranch.data()?.ownerId || '').trim()
  const assignmentsAlreadyCurrent = Array.isArray(staff.branchIds) && staff.branchIds.join('|') === branchIds.join('|')
  if (assignmentsAlreadyCurrent && String(staff.organizationOwnerId || '') === organizationOwnerId) continue
  batch.update(doc.ref, {
    branchId: primaryBranchId,
    branchIds,
    organizationOwnerId: organizationOwnerId || null,
    branchAssignmentsMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  updated++; pending++
  if (pending === 400) await flush()
}
await flush()
console.log(`Migrated ${updated} staff branch assignment record(s).`)
