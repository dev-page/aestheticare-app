// Dry-run by default. The explicit project prevents accidentally writing to a
// different Firebase project; use ADC or GOOGLE_APPLICATION_CREDENTIALS.
import admin from 'firebase-admin'
import projection from '../../functions/publicClinicProjection.cjs'

const projectArgument = process.argv.find((argument) => argument.startsWith('--project='))
const projectId = projectArgument?.slice('--project='.length).trim()
if (!projectId) {
  console.error('Usage: node backend/otp-backend/scripts/backfill-public-clinics.mjs --project=PROJECT_ID [--apply]')
  process.exit(1)
}

const apply = process.argv.includes('--apply')
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId })
const db = admin.firestore()
const counts = { clinics: 0, published: 0, existingPublic: 0 }

const scan = async (collection, handle) => {
  let cursor
  do {
    let query = db.collection(collection).orderBy(admin.firestore.FieldPath.documentId()).limit(200)
    if (cursor) query = query.startAfter(cursor)
    const page = await query.get()
    for (const entry of page.docs) await handle(entry)
    cursor = page.size === 200 ? page.docs.at(-1) : null
  } while (cursor)
}

try {
  await scan('clinics', async (clinic) => {
    counts.clinics += 1
    if (clinic.data()?.isPublished === true) counts.published += 1
    if (apply) await projection.syncPublicClinic(db, clinic.id)
  })
  // Also reconcile orphaned and stale projections; the shared transaction
  // rereads each source, so changes concurrent with this scan remain safe.
  await scan('publicClinics', async (clinic) => {
    counts.existingPublic += 1
    if (apply) await projection.syncPublicClinic(db, clinic.id)
  })
  console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', ...counts }, null, 2))
} catch (error) {
  console.error('Public clinic backfill failed:', error.message)
  process.exitCode = 1
} finally {
  await admin.app().delete()
}
