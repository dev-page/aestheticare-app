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
export const extractSupplierBusinessIdentifiers = text => {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const extract = marker => {
    for (let index = 0; index < lines.length; index += 1) {
      const match = marker.exec(lines[index])
      if (!match) continue
      const candidates = [lines[index].slice(match.index + match[0].length), lines[index + 1] || '']
      for (const candidate of candidates) {
        const value = candidate.replace(/^[\s:#-]+|[\s,;]+$/g, '').replace(/^(?:no\.?|number|#)\s*[:#-]?\s*/i, '').match(/[A-Z0-9][A-Z0-9./-]{3,39}/i)?.[0] || ''
        if (value.length >= 4 && /[0-9]/.test(value)) return value
      }
    }
    return ''
  }
  return {
    registrationNumber: extract(/\b(?:SEC\s+)?(?:business\s+)?registration(?:\s+(?:certificate|no\.?|number|#))?|\bcertificate\s+(?:no\.?|number|#)|\bDTI(?:\s+registration)?(?:\s+(?:no\.?|number|#))?/i),
    taxNumber: extract(/\bTIN\b|\btax\s+identification(?:\s+(?:no\.?|number|#))?|\btax\s+number\b/i),
  }
}

export const registerSupplierVerification = (app, { admin, requireAuth, loadUserContext, storageBucket, createVisionClient, createRegistrationVisionRequest, getVisionResponseError, getVisionWordConfidence, getOcrExpiryValidation = () => ({ valid: null, expired: false, invalidRange: false, daysRemaining: null, accountHold: false, validTo: '', type: 'not_found' }), normalizeOcrComparable, autoVerificationThreshold = 0.74, expiryHoldDays = 7 }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const normalizedTin = value => String(value || '').replace(/\D/g, '')
  const normalizedTaxNumber = value => String(value || '').replace(/\D/g, '')
  const taxIdentityRef = (kind, value) => db.collection('supplierBusinessIdentities').doc(crypto.createHash('sha256').update(`${kind}:${value}`).digest('hex'))
  const bucket = () => admin.storage().bucket(storageBucket() || admin.app().options.storageBucket)
  const expiryRequiredKinds = new Set(['permit', 'distribution'])
  const nameMatchesOcrText = (expectedName, text) => {
    const ignored = new Set(['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'LLC', 'LTD', 'LIMITED', 'COMPANY', 'CO', 'ENTERPRISE', 'ENTERPRISES'])
    const tokens = String(expectedName || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').split(/\s+/).filter(token => token.length >= 3 && !ignored.has(token))
    const comparableText = (normalizeOcrComparable || (value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')))(text)
    if (!tokens.length || !comparableText) return null
    const matched = tokens.filter(token => comparableText.includes(token)).length
    return matched >= Math.max(1, Math.ceil(tokens.length * 0.7))
  }
  const processSupplierDocumentOcr = async ({ kind, document, application }) => {
    const result = {
      status: 'manual_review', confidence: 0, ocrConfidence: null, extractedText: '', processedAt: new Date().toISOString(),
      checks: { readableText: false, businessNameMatch: null, representativeNameMatch: null, expiryValid: null, expiryDate: '', expiryDaysRemaining: null, expiryAccountHold: false },
      reason: '',
    }
    const client = createVisionClient?.()
    if (!client) { result.reason = 'Automatic OCR is unavailable. An administrator must review this document.'; return result }
    try {
      const request = await createRegistrationVisionRequest({ bucketName: storageBucket() || admin.app().options.storageBucket, storagePath: document.path, contentType: document.contentType })
      let annotation = null, extractedText = '', primaryOcrError = ''
      try {
        const [response] = await client.documentTextDetection(request)
        const providerError = getVisionResponseError(response)
        if (providerError) throw new Error(providerError)
        annotation = response?.fullTextAnnotation || null
        extractedText = String(annotation?.text || '').trim()
      } catch (error) { primaryOcrError = String(error?.message || error) }
      if (!extractedText) {
        try {
          const [fallback] = await client.textDetection(request)
          const fallbackError = getVisionResponseError(fallback)
          if (fallbackError) throw new Error(fallbackError)
          annotation = fallback?.fullTextAnnotation || annotation
          extractedText = String(annotation?.text || fallback?.textAnnotations?.[0]?.description || '').trim()
        } catch (fallbackError) {
          if (!primaryOcrError) primaryOcrError = String(fallbackError?.message || fallbackError)
        }
      }
      if (!extractedText && primaryOcrError) throw new Error(`Document OCR failed: ${primaryOcrError}`)
      const readableText = extractedText.length >= 30
      const businessNameMatch = nameMatchesOcrText(application.businessName, extractedText)
      const representativeNameMatch = kind === 'representative' ? nameMatchesOcrText(application.representativeName, extractedText) : null
      const expiry = getOcrExpiryValidation(extractedText, true)
      const expiryRequired = expiryRequiredKinds.has(kind)
      const expiryValid = expiryRequired ? expiry.valid : (expiry.valid === null ? true : expiry.valid)
      const expiryAccountHold = expiry.accountHold
      const ocrConfidence = getVisionWordConfidence(annotation)
      const ocrQuality = ocrConfidence ?? (readableText ? 0.75 : 0)
      const score = Math.min(1, ocrQuality * 0.35 + (readableText ? 1 : 0) * 0.15 + (businessNameMatch === true ? 1 : 0) * 0.4 + (expiryValid === true ? 1 : 0) * 0.1)
      const fatalMismatch = businessNameMatch === false || representativeNameMatch === false
      const missingRequiredExpiry = expiryRequired && expiry.valid === null
      const expiredOrInvalid = expiry.expired || expiry.invalidRange
      result.status = !readableText || fatalMismatch || expiredOrInvalid ? 'rejected' : expiryAccountHold ? 'held_pending' : score >= autoVerificationThreshold && businessNameMatch === true && representativeNameMatch !== false && expiryValid === true && !missingRequiredExpiry ? 'verified' : 'manual_review'
      result.confidence = score
      result.ocrConfidence = ocrConfidence
      result.extractedText = extractedText.slice(0, 12000)
      result.extractedFields = extractSupplierBusinessIdentifiers(extractedText)
      result.checks = { readableText, businessNameMatch, representativeNameMatch, expiryValid, expiryDate: expiry.validTo || '', expiryDaysRemaining: expiry.daysRemaining, expiryAccountHold, expiryRequired, expiryValidationType: expiry.type }
      result.reason = !readableText ? 'OCR could not read enough text. Upload a clearer, complete document.' : fatalMismatch ? 'The business or representative name does not match the application. Check the document and business details.' : expiredOrInvalid ? expiry.invalidRange ? 'The document has an invalid validity period.' : 'This document has expired. Upload a current document.' : expiryAccountHold ? `This document expires within ${expiryHoldDays} days. Upload a replacement before submitting for review.` : missingRequiredExpiry ? 'A labelled expiry date or validity period could not be confirmed. An administrator must review this document.' : result.status === 'verified' ? 'OCR found the business name and passed the expiry checks.' : 'OCR extracted the text, but the result needs administrator review.'
    } catch (error) {
      result.reason = `OCR processing failed: ${String(error?.message || error).slice(0, 300)}. An administrator must review this document.`
    }
    return result
  }
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
    check(bytes.length > 20 && bytes.length <= 10 * 1024 * 1024, 'Upload a document up to 10 MB.', 400)
    const isPdf = bytes.subarray(0, 5).toString() === '%PDF-', isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), isJpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    check(isPdf || isPng || isJpeg, 'Upload a PDF, PNG, or JPEG document.', 400)
    const contentType = isPdf ? 'application/pdf' : isPng ? 'image/png' : 'image/jpeg'
    const path = `supplier-verification/${req.user.uid}/${crypto.randomUUID()}`
    await bucket().file(path).save(bytes, { resumable: false, metadata: { contentType } })
    const document = { path, name: String(req.body.name || kind).slice(0, 150), contentType, size: bytes.length }
    const applicationRef = db.collection('supplierApplications').doc(req.user.uid)
    let ocr
    try {
      const ocrApplication = {
        ...application,
        businessName: String(req.body.businessName || application.businessName || '').trim(),
        representativeName: String(req.body.representativeName || application.representativeName || '').trim(),
      }
      ocr = await processSupplierDocumentOcr({ kind, document, application: ocrApplication })
      await db.runTransaction(async tx => {
        const current = (await tx.get(applicationRef)).data() || {}
        check(!['Submitted', 'Under review', 'Verified', 'Suspended'].includes(current.verificationStatus), 'The application was submitted while uploading. Documents are now locked.')
        tx.set(applicationRef, { ownerId: req.user.uid, documents: { [kind]: { ...document, ocr } }, updatedAt: stamp() }, { merge: true })
      })
    } catch (error) { await bucket().file(path).delete().catch(() => {}); throw error }
    res.json({ success: true, data: { ...document, ocr } })
  }))
  app.post('/supplier-verification/submit', requireAuth, wrap(async (req, res) => {
    await supplier(req.user.uid)
    const fields = {}
    for (const name of ['businessName', 'registrationNumber', 'taxNumber', 'businessAddress', 'representativeName', 'contactEmail', 'contactPhone']) {
      fields[name] = String(req.body[name] || '').trim()
      check(fields[name].length > 0 && fields[name].length <= 500, `Provide a valid ${name.replace(/([A-Z])/g, ' $1').toLowerCase()}.`, 400)
    }
    const businessType = String(req.body.businessType || '').trim().slice(0, 120)
    const categories = [...new Set((Array.isArray(req.body.categories) ? req.body.categories : []).map(value => String(value || '').trim()).filter(value => ['Injectables', 'Equipment', 'Skincare', 'Medical Supplies'].includes(value)))].slice(0, 20)
    if (req.body.businessType !== undefined) check(businessType.length > 0, 'Provide a valid business type.', 400)
    if (req.body.categories !== undefined) check(categories.length > 0, 'Select at least one supplier category.', 400)
    check(/^\S+@\S+\.\S+$/.test(fields.contactEmail), 'Provide a valid contact email.', 400)
    const phoneDigits = fields.contactPhone.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '')
    check(/^9\d{9}$/.test(phoneDigits), 'Provide a Philippine mobile number with 10 digits starting with 9.', 400)
    fields.contactPhone = `+63${phoneDigits}`
    const addressLat = Number(req.body.businessAddressLat), addressLng = Number(req.body.businessAddressLng)
    check(Number.isFinite(addressLat) && addressLat >= -90 && addressLat <= 90 && Number.isFinite(addressLng) && addressLng >= -180 && addressLng <= 180, 'Select the business location on the map.', 400)
    fields.businessAddressLat = addressLat
    fields.businessAddressLng = addressLng
    const ref = db.collection('supplierApplications').doc(req.user.uid)
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() || {}
      check(!['Submitted', 'Under review', 'Verified', 'Suspended'].includes(current.verificationStatus), 'This application cannot be submitted at this stage.')
      check(['registration', 'permit', 'representative'].every(kind => current.documents?.[kind]?.path?.startsWith(`supplier-verification/${req.user.uid}/`)), 'Upload registration, business permit/tax document, and representative authorization.', 400)
      const updatedDocuments = { ...current.documents }
      const kindsToCheck = ['registration', 'permit', 'representative', ...(updatedDocuments.distribution?.path ? ['distribution'] : [])]
      for (const kind of kindsToCheck) {
        const document = updatedDocuments[kind], ocr = { ...(document.ocr || {}) }
        const businessNameMatch = nameMatchesOcrText(fields.businessName, ocr.extractedText || '')
        const representativeNameMatch = kind === 'representative' ? nameMatchesOcrText(fields.representativeName, ocr.extractedText || '') : ocr.checks?.representativeNameMatch ?? null
        const expiry = getOcrExpiryValidation(ocr.extractedText || '', true)
        if (businessNameMatch === false || representativeNameMatch === false) {
          ocr.status = 'rejected'
          ocr.reason = 'The uploaded document does not show the business or representative name entered in this application.'
        } else if (expiry.expired || expiry.invalidRange) {
          ocr.status = 'rejected'
          ocr.reason = expiry.invalidRange ? 'This document has an invalid validity period.' : 'This document has expired. Upload a current document.'
        } else if (expiry.accountHold) {
          ocr.status = 'held_pending'
          ocr.reason = `This document expires within ${expiryHoldDays} days. Upload a replacement before submitting for review.`
        } else if (expiryRequiredKinds.has(kind) && expiry.valid === null) {
          ocr.status = 'manual_review'
          ocr.reason = 'A labelled expiry date or validity period could not be confirmed. An administrator must review this document.'
        }
        ocr.checks = { ...(ocr.checks || {}), businessNameMatch, representativeNameMatch, expiryValid: expiry.valid, expiryDate: expiry.validTo || '', expiryDaysRemaining: expiry.daysRemaining, expiryAccountHold: expiry.accountHold }
        updatedDocuments[kind] = { ...document, ocr }
      }
      const requiredDocuments = ['registration', 'permit', 'representative'].map(kind => updatedDocuments[kind])
      const ocrRegistrationNumber = String(updatedDocuments.registration?.ocr?.extractedFields?.registrationNumber || '').trim()
      const ocrTaxNumber = String(updatedDocuments.permit?.ocr?.extractedFields?.taxNumber || '').trim()
      if (ocrRegistrationNumber) fields.registrationNumber = ocrRegistrationNumber
      if (ocrTaxNumber) fields.taxNumber = ocrTaxNumber
      check(requiredDocuments.every(document => !['rejected', 'held_pending'].includes(document.ocr?.status)), 'Documents must match the current business and representative names and be current. Upload replacement documents before submitting.', 400)
      check(!updatedDocuments.distribution?.ocr || !['rejected', 'held_pending'].includes(updatedDocuments.distribution.ocr.status), 'Replace rejected or soon-to-expire optional credentials before submitting.', 400)
      const allDocuments = [...requiredDocuments, ...(updatedDocuments.distribution?.path ? [updatedDocuments.distribution] : [])]
      const identifiersDetected = Boolean(ocrRegistrationNumber && ocrTaxNumber)
      const ocrStatus = allDocuments.every(document => document.ocr?.status === 'verified') && identifiersDetected ? 'OCR Verified' : 'Manual Review Required'
      const ocrReviewReason = identifiersDetected ? '' : 'OCR could not confidently locate both the business registration number and tax number. Please compare the entered values with the uploaded documents.'
      tx.set(ref, { ...fields, ...(businessType ? { businessType } : {}), ...(req.body.categories !== undefined ? { categories } : {}), documents: updatedDocuments, ownerId: req.user.uid, verificationStatus: 'Submitted', ocrStatus, ocrReviewReason, revisionReason: '', submittedAt: stamp(), updatedAt: stamp() }, { merge: true })
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
      let businessIdentity = null
      if (req.body.action === 'approve') {
        const requiredDocuments = ['registration', 'permit', 'representative'].map(kind => current.documents?.[kind] || {})
        const documentsToApprove = [...requiredDocuments, ...(current.documents?.distribution?.path ? [current.documents.distribution] : [])]
        check(documentsToApprove.every(document => document.path && !['rejected', 'held_pending'].includes(document.ocr?.status)), 'Rejected or soon-to-expire documents must be replaced before approval.', 400)
        const hasCompleteOcr = documentsToApprove.every(document => String(document.ocr?.extractedText || '').length >= 30)
        // If OCR is unavailable for a legacy application, an administrator can
        // still inspect the original documents in the review UI. When OCR did
        // produce text, enforce its name and expiry findings server-side.
        if (hasCompleteOcr) {
          check(documentsToApprove.every(document => nameMatchesOcrText(current.businessName, document.ocr.extractedText)), 'Required documents must contain readable text showing the verified business name.', 400)
          check(nameMatchesOcrText(current.representativeName, requiredDocuments[2].ocr.extractedText), 'The authorization document must show the named representative.', 400)
          for (const [index, document] of documentsToApprove.entries()) {
            const expiry = getOcrExpiryValidation(document.ocr.extractedText, true)
            check(!expiry.expired && !expiry.invalidRange && !expiry.accountHold, 'Expired or soon-to-expire documents must be replaced before approval.', 400)
            const kind = index < 3 ? ['registration', 'permit', 'representative'][index] : 'distribution'
            if (expiryRequiredKinds.has(kind)) check(expiry.valid === true, 'A current expiry date or validity period is required for the business permit or distribution credential.', 400)
          }
        }
        const taxNumber = normalizedTaxNumber(current.taxNumber)
        const registrationNumber = String(current.registrationNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const identities = [
          ...(/^\d{12}$/.test(taxNumber) ? [{ kind: 'tin', value: taxNumber }] : []),
          ...(registrationNumber.length >= 4 ? [{ kind: 'registration', value: registrationNumber }] : []),
        ]
        businessIdentity = []
        for (const identityValue of identities) {
          const identityRef = taxIdentityRef(identityValue.kind, identityValue.value)
          const identity = await tx.get(identityRef)
          check(!identity.exists || identity.data()?.supplierUid === req.params.id, `This ${identityValue.kind === 'tin' ? 'tax number' : 'registration number'} is already associated with another verified supplier account.`, 409)
          businessIdentity.push({ ref: identityRef, ...identityValue })
        }
        if (/^\d{12}$/.test(taxNumber)) {
          const legacyMatches = await tx.get(db.collection('suppliers').where('taxRegistrationNumber', '==', taxNumber))
          check(legacyMatches.docs.every(document => String(document.data()?.ownerId || document.data()?.supplierUserId || '') === req.params.id || document.data()?.verificationStatus !== 'Verified'), 'This tax number is already associated with another verified supplier account.', 409)
          const legacyApplications = await tx.get(db.collection('supplierApplications').where('taxNumber', '==', current.taxNumber))
          check(legacyApplications.docs.every(document => document.id === req.params.id || document.data()?.verificationStatus !== 'Verified'), 'This tax number is already associated with another verified supplier account.', 409)
        }
        if (registrationNumber.length >= 4) {
          const legacyRegistrationMatches = await tx.get(db.collection('suppliers').where('registrationNumber', '==', current.registrationNumber))
          check(legacyRegistrationMatches.docs.every(document => String(document.data()?.ownerId || document.data()?.supplierUserId || '') === req.params.id || document.data()?.verificationStatus !== 'Verified'), 'This registration number is already associated with another verified supplier account.', 409)
          const legacyRegistrationApplications = await tx.get(db.collection('supplierApplications').where('registrationNumber', '==', current.registrationNumber))
          check(legacyRegistrationApplications.docs.every(document => document.id === req.params.id || document.data()?.verificationStatus !== 'Verified'), 'This registration number is already associated with another verified supplier account.', 409)
        }
      }
      const accounts = await tx.get(db.collection('suppliers').where('ownerId', '==', req.params.id))
      const linked = await tx.get(db.collection('suppliers').where('supplierUserId', '==', req.params.id))
      tx.set(ref, { verificationStatus: status, revisionReason: reason, reviewedById: req.user.uid, reviewedAt: stamp(), updatedAt: stamp() }, { merge: true })
      tx.set(db.collection('users').doc(req.params.id), { supplierVerificationStatus: status, ...(status === 'Verified' ? { status: 'Active' } : {}), updatedAt: stamp() }, { merge: true })
      const unique = new Map([...accounts.docs, ...linked.docs].map(doc => [doc.id, doc]))
      for (const doc of unique.values()) {
        const profile = status === 'Verified' ? {
          name: current.businessName || doc.data()?.name || '',
          businessName: current.businessName || doc.data()?.businessName || '',
          taxRegistrationNumber: admin.firestore.FieldValue.delete(),
          tinNumber: admin.firestore.FieldValue.delete(),
          businessType: current.businessType || doc.data()?.businessType || '',
          categories: Array.isArray(current.categories) && current.categories.length ? current.categories : (Array.isArray(doc.data()?.categories) ? doc.data().categories : []),
          category: Array.isArray(current.categories) && current.categories.length ? current.categories[0] : (doc.data()?.category || ''),
          registrationNumber: current.registrationNumber || '',
          address: current.businessAddress || '',
          businessAddress: current.businessAddress || '',
          businessAddressLat: Number(current.businessAddressLat) || null,
          businessAddressLng: Number(current.businessAddressLng) || null,
          contact: current.representativeName || '',
          contactPerson: current.representativeName || '',
          email: current.contactEmail || doc.data()?.email || '',
          phone: current.contactPhone || '',
          status: 'Active',
        } : {}
        tx.set(doc.ref, { ...profile, verificationStatus: status, updatedAt: stamp() }, { merge: true })
      }
      for (const identity of businessIdentity || []) tx.set(identity.ref, { supplierUid: req.params.id, identityType: identity.kind, createdAt: stamp(), updatedAt: stamp() }, { merge: true })
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
