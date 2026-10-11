import crypto from 'node:crypto'
import { assertWorkflow as check, normalized } from './bookingWorkflow.js'

export const supplierIsVerified = application => application?.verificationStatus === 'Verified'
export const supplierDecision = (current, action, reason) => {
  const status = { approve: 'Verified', revise: 'Needs revision', reject: 'Rejected', suspend: 'Suspended' }[action]
  check(status, 'Choose a valid review decision.', 400)
  check(action === 'suspend' ? current === 'Verified' : ['Submitted', 'Under review'].includes(current), 'This application is not at the correct review stage.')
  check(action === 'approve' || String(reason || '').trim().length >= 10, 'Provide a clear reason of at least 10 characters.', 400)
  return status
}

export const registerSupplierVerification = (app, { admin, requireAuth, loadUserContext, storageBucket }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const bucket = () => admin.storage().bucket(storageBucket() || admin.app().options.storageBucket)
  const supplier = async uid => {
    const ctx = await loadUserContext(uid)
    check(normalized(ctx.roleKey || ctx.userData.userType) === 'supplier', 'Supplier access required.', 403)
    check(ctx.userData.emailVerified === true, 'Verify your account email before submitting business documents.', 403)
    return ctx
  }
  const reviewer = async uid => {
    const ctx = await loadUserContext(uid)
    check(['superadmin', 'systemadmin'].includes(normalized(ctx.roleKey)) || (['admin', 'reviewer'].includes(normalized(ctx.roleKey)) && ctx.permissions.has('system:suppliers:verify')), 'Supplier verification permission required.', 403)
    return ctx
  }
  const wrap = handler => async (req, res) => { try { await handler(req, res) } catch (error) { res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Supplier verification could not be completed.' }) } }
  app.get('/supplier-verification/me', requireAuth, wrap(async (req, res) => {
    await supplier(req.user.uid)
    const snap = await db.collection('supplierApplications').doc(req.user.uid).get()
    res.json({ success: true, data: { id: req.user.uid, verificationStatus: 'Draft', ...(snap.data() || {}) } })
  }))
  app.post('/supplier-verification/documents', requireAuth, wrap(async (req, res) => {
    await supplier(req.user.uid)
    const application = (await db.collection('supplierApplications').doc(req.user.uid).get()).data() || {}
    check(!['Submitted', 'Under review', 'Verified', 'Suspended'].includes(application.verificationStatus), 'Documents cannot be changed at this stage.')
    const kind = String(req.body.kind || '')
    check(['registration', 'permit', 'representative', 'distribution'].includes(kind), 'Choose a document type.', 400)
    const bytes = Buffer.from(String(req.body.base64 || ''), 'base64')
    check(bytes.length > 20 && bytes.length <= 3 * 1024 * 1024, 'Upload a document up to 3 MB.', 400)
    const isPdf = bytes.subarray(0, 5).toString() === '%PDF-', isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    check(isPdf || isPng || isJpeg, 'Upload a PDF, PNG, or JPEG document.', 400)
    const contentType = isPdf ? 'application/pdf' : isPng ? 'image/png' : 'image/jpeg'
    const path = `supplier-verification/${req.user.uid}/${crypto.randomUUID()}`
    await bucket().file(path).save(bytes, { resumable: false, metadata: { contentType } })
    const document = { path, name: String(req.body.name || kind).slice(0, 150), contentType, size: bytes.length }
    const applicationRef = db.collection('supplierApplications').doc(req.user.uid)
    try {
      await db.runTransaction(async tx => {
        const current = (await tx.get(applicationRef)).data() || {}
        check(!['Submitted', 'Under review', 'Verified', 'Suspended'].includes(current.verificationStatus), 'The application was submitted while uploading. Documents are now locked.')
        tx.set(applicationRef, { ownerId: req.user.uid, documents: { [kind]: document }, updatedAt: stamp() }, { merge: true })
      })
    } catch (error) { await bucket().file(path).delete().catch(() => {}); throw error }
    res.json({ success: true, data: document })
  }))
  app.post('/supplier-verification/submit', requireAuth, wrap(async (req, res) => {
    await supplier(req.user.uid)
    const fields = {}
    for (const name of ['businessName', 'registrationNumber', 'taxNumber', 'businessAddress', 'representativeName', 'contactEmail', 'contactPhone']) {
      fields[name] = String(req.body[name] || '').trim()
      check(fields[name].length > 0 && fields[name].length <= 500, `Provide a valid ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}.`, 400)
    }
    check(/^\S+@\S+\.\S+$/.test(fields.contactEmail), 'Provide a valid contact email.', 400)
    const ref = db.collection('supplierApplications').doc(req.user.uid)
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() || {}
      check(!['Submitted', 'Under review', 'Verified', 'Suspended'].includes(current.verificationStatus), 'This application cannot be submitted at this stage.')
      check(['registration', 'permit', 'representative'].every(kind => current.documents?.[kind]?.path?.startsWith(`supplier-verification/${req.user.uid}/`)), 'Upload registration, business permit/tax document, and representative authorization.', 400)
      tx.set(ref, { ...fields, ownerId: req.user.uid, verificationStatus: 'Submitted', revisionReason: '', submittedAt: stamp(), updatedAt: stamp() }, { merge: true })
      tx.set(db.collection('supplierVerificationAudit').doc(), { supplierUid: req.user.uid, actorId: req.user.uid, action: 'submitted', previousStatus: current.verificationStatus || 'Draft', nextStatus: 'Submitted', createdAt: stamp() })
    })
    res.json({ success: true, data: { verificationStatus: 'Submitted' } })
  }))
  app.get('/admin/supplier-verification', requireAuth, wrap(async (req, res) => {
    await reviewer(req.user.uid)
    const applications = await db.collection('supplierApplications').get()
    res.json({ success: true, data: applications.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}), verificationStatus: doc.data()?.verificationStatus || 'Draft' })) })
  }))
  app.get('/supplier-verification/:id/documents/:kind', requireAuth, wrap(async (req, res) => {
    if (req.params.id === req.user.uid) await supplier(req.user.uid); else await reviewer(req.user.uid)
    const application = (await db.collection('supplierApplications').doc(req.params.id).get()).data() || {}
    const document = application.documents?.[req.params.kind]
    check(document?.path?.startsWith(`supplier-verification/${req.params.id}/`), 'Document not found.', 404)
    const [url] = await bucket().file(document.path).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000 })
    res.json({ success: true, data: { url } })
  }))
  app.post('/admin/supplier-verification/:id/review', requireAuth, wrap(async (req, res) => {
    await reviewer(req.user.uid)
    const ref = db.collection('supplierApplications').doc(req.params.id), reason = String(req.body.reason || '').trim().slice(0, 2000)
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref)
      check(snap.exists, 'Application not found.', 404)
      const current = snap.data() || {}, status = supplierDecision(current.verificationStatus, req.body.action, reason)
      const accounts = await tx.get(db.collection('suppliers').where('ownerId', '==', req.params.id))
      const linked = await tx.get(db.collection('suppliers').where('supplierUserId', '==', req.params.id))
      tx.set(ref, { verificationStatus: status, revisionReason: reason, reviewedById: req.user.uid, reviewedAt: stamp(), updatedAt: stamp() }, { merge: true })
      tx.set(db.collection('users').doc(req.params.id), { supplierVerificationStatus: status, ...(status === 'Verified' ? { status: 'Active' } : {}), updatedAt: stamp() }, { merge: true })
      const unique = new Map([...accounts.docs, ...linked.docs].map(doc => [doc.id, doc]))
      for (const doc of unique.values()) tx.set(doc.ref, { verificationStatus: status, updatedAt: stamp() }, { merge: true })
      tx.set(db.collection('supplierVerificationAudit').doc(), { supplierUid: req.params.id, actorId: req.user.uid, action: req.body.action, previousStatus: current.verificationStatus, nextStatus: status, reason, createdAt: stamp() })
      tx.set(db.collection('notifications').doc(), { recipientUserId: req.params.id, title: `Supplier verification: ${status}`, message: reason || 'Your business documents were approved. You can now publish your catalogue and receive orders.', link: '/supplier/verification', read: false, createdAt: stamp() })
      return { verificationStatus: status }
    })
    res.json({ success: true, data: result })
  }))
  app.get('/admin/supplier-verification/:id/history', requireAuth, wrap(async (req, res) => {
    await reviewer(req.user.uid)
    const history = await db.collection('supplierVerificationAudit').where('supplierUid', '==', req.params.id).get()
    res.json({ success: true, data: history.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) })
  }))
}
