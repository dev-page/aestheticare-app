import admin from 'firebase-admin'

if (process.env.CONFIRM_LEGACY_SUPPLIER_DATA_DELETE !== 'YES') {
  throw new Error('Set CONFIRM_LEGACY_SUPPLIER_DATA_DELETE=YES to delete legacy supplier-account data.')
}

admin.initializeApp()
const db = admin.firestore()
const collections = ['supplierApplications', 'supplierVerificationAudit']

for (const name of collections) {
  const snapshot = await db.collection(name).get()
  let batch = db.batch()
  let count = 0
  for (const document of snapshot.docs) {
    batch.delete(document.ref)
    count += 1
    if (count % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }
  if (count % 400) await batch.commit()
  console.log(`Deleted ${count} documents from ${name}.`)
}

const supplierAccounts = new Set()
for (const field of ['ownerId', 'supplierUserId']) {
  const snapshot = await db.collection('suppliers').where(field, '!=', null).get()
  let batch = db.batch()
  let count = 0
  for (const document of snapshot.docs) {
    const uid = String(document.data()?.[field] || '').trim()
    if (uid) supplierAccounts.add(uid)
    batch.delete(document.ref)
    count += 1
    if (count % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }
  if (count % 400) await batch.commit()
  console.log(`Deleted ${count} legacy supplier records indexed by ${field}.`)
}

for (const uid of supplierAccounts) {
  await db.collection('users').doc(uid).delete()
  await admin.auth().deleteUser(uid).catch(error => {
    if (error?.code !== 'auth/user-not-found') throw error
  })
}
console.log(`Deleted ${supplierAccounts.size} legacy supplier accounts.`)

const [bucket] = await admin.storage().bucket().getFiles({ prefix: 'supplier-verification/' })
for (const file of bucket) await file.delete()
console.log(`Deleted ${bucket.length} legacy supplier verification files.`)
