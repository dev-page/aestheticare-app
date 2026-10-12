import admin from 'firebase-admin'
import { closeExpiredConsultations } from './lib/consultationWindows.js'

// Google Cloud IAM authenticates the Scheduler service account before requests
// reach this function. Deploy with no unauthenticated access.
if (!admin.apps.length) admin.initializeApp()
export const processOnlineConsultations = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Use POST.' })
  try {
    const result = await closeExpiredConsultations(admin)
    await admin.firestore().collection('systemJobs').doc('onlineConsultations').set({
      lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(), closed: result.closed,
      scheduler: 'google-cloud', updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(JSON.stringify({ event: 'online_consultation_reconciliation', closed: result.closed }))
    res.json({ success: true, data: result })
  } catch (error) {
    console.error(JSON.stringify({ event: 'online_consultation_reconciliation_failed', code: String(error.code || 'unknown') }))
    res.status(500).json({ success: false, error: 'Consultation reconciliation failed.' })
  }
}
