import { practitionerTypes, normalizePractitionerProfile, normalizeStaffing, rateFor, teamMeetsRequirements, appointmentStaffIds, appointmentServiceId, sessionEarningBase, calculateStaffEarnings } from '../../shared/practitionerTeam.js'
import { compareRegistrationFields } from './registrationComparisons.js'
const check = (ok, message, status = 409) => { if (!ok) throw Object.assign(new Error(message), { status }) }
const serviceIdFor = appointmentServiceId
const nameFor = user => user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Practitioner'

export const prepareTeamStart = async (tx, db, appointment, id) => {
  const leadId = appointment.assignedPractitionerId || appointment.practitionerId
  check(leadId, 'Assign one lead practitioner before treatment starts.')
  const team = [{ employeeId: leadId, responsibility: 'lead' }]
  const requirements = normalizeStaffing(appointment.staffingRequirements)
  const members = [], terms = []
  for (const member of team) {
    const user = (await tx.get(db.collection('users').doc(member.employeeId))).data()
    const profile = (await tx.get(db.collection('practitionerProfiles').doc(member.employeeId))).data()
    check(user && !user.archived && String(user.status).toLowerCase() === 'active' && [user.branchId, ...(user.branchIds || [])].includes(appointment.branchId), 'A team member is inactive or no longer assigned to this branch.')
    if (requirements.length) check(profile && profile.approvedServiceIds.includes(serviceIdFor(appointment)) && (!['Doctor', 'Registered Nurse'].includes(profile.type) || profile.credentialsVerified), 'Configure verified credentials and approved services for every required team member.')
    const entry = { employeeId: member.employeeId, name: nameFor(user), type: profile?.type || 'Other', responsibility: 'lead', participationConfirmed: true }
    members.push(entry)
    const rateSnapshot = rateFor(profile, serviceIdFor(appointment), member.responsibility, appointment.date)
    if (profile || requirements.length) check(rateSnapshot, 'Configure an effective compensation agreement for the lead practitioner before treatment starts.')
    terms.push({ ...entry, rateSnapshot })
  }
  check(teamMeetsRequirements(members, requirements), 'The assigned practitioner does not meet this service’s specialty requirement.')
  if (terms.every(member => member.rateSnapshot)) {
    const plan = appointment.treatmentPlanAppointmentId ? (await tx.get(db.collection('appointments').doc(appointment.treatmentPlanAppointmentId))).data() : appointment
    check(plan, 'The original treatment plan is missing.')
    const base = sessionEarningBase(appointment, plan)
    const forecast = calculateStaffEarnings(terms.map(member => ({ ...member, participationConfirmed: true })), base)
    check(forecast.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) <= Math.round(base * 100), 'The lead practitioner’s earnings exceed this session’s allocated service price. Correct the agreement before starting.')
  }
  return { members, termsRef: db.collection('appointmentStaffTerms').doc(id), terms: { branchId: appointment.branchId, appointmentId: id, members: terms } }
}

export const extractPractitionerLicenseNumber = text => {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const marker = /(?:\bPRC\s*)?(?:license|licence|registration|reg\.?)(?:\s*(?:no\.?|number|#))?\s*[:#-]?/i
  const valuePattern = /\b(\d{7})\b/
  for (let index = 0; index < lines.length; index += 1) {
    const match = marker.exec(lines[index])
    if (!match) continue
    const sameLine = lines[index].slice(match.index + match[0].length).replace(/^\s*[:#-]?\s*/, '')
    const value = sameLine.match(valuePattern)?.[1] || lines[index + 1]?.match(valuePattern)?.[1] || ''
    if (value) return value
  }
  return ''
}

const OCR_MONTH_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const OCR_DATE_TOKEN_PATTERN = `(?:\\d{4}[-\\/.]\\d{1,2}[-\\/.]\\d{1,2}|\\d{1,2}[-\\/.]\\d{1,2}[-\\/.]\\d{4}|${OCR_MONTH_PATTERN}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+${OCR_MONTH_PATTERN}\\.?[,]?\\s+\\d{4})`

const normalizePractitionerLicenseDate = value => {
  const raw = String(value || '').trim().toLowerCase().replace(/,/g, '')
  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  }
  const numeric = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$|^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/)
  let year = 0, month = 0, day = 0
  if (numeric?.[1]) [year, month, day] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
  else if (numeric?.[6]) [year, month, day] = [Number(numeric[6]), Number(numeric[4]), Number(numeric[5])]
  else {
    const monthFirst = raw.match(new RegExp(`^(${OCR_MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(\\d{4})$`))
    const dayFirst = raw.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${OCR_MONTH_PATTERN})\\.?\\s+(\\d{4})$`))
    if (monthFirst) [year, month, day] = [Number(monthFirst[3]), months[monthFirst[1]], Number(monthFirst[2])]
    else if (dayFirst) [year, month, day] = [Number(dayFirst[3]), months[dayFirst[2]], Number(dayFirst[1])]
  }
  if (!year || !month || !day) return ''
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : ''
}

export const extractPractitionerLicenseExpiryDate = text => {
  const expiryPattern = new RegExp(`(?:valid(?:ity)?(?:\\s+date)?\\s*(?:until|through|thru|to)?|valid\\s+up\\s+to|date\\s+valid\\s+(?:until|through|thru|to)|(?:date\\s+of\\s+)?expiry(?:\\s+date)?|(?:date\\s+of\\s+)?expiration(?:\\s+date)?|expires?(?:\\s+on)?)\\s*[:#-]?\\s*(${OCR_DATE_TOKEN_PATTERN})`, 'gi')
  const dates = [...String(text || '').matchAll(expiryPattern)]
    .map(match => normalizePractitionerLicenseDate(match[1]))
    .filter(Boolean)
  const unique = [...new Set(dates)]
  return unique.length === 1 ? unique[0] : ''
}

export const validatePractitionerCredentialDocument = ({ text, firstName, middleName, lastName, suffix, confidence, today = null }) => {
  const comparedName = compareRegistrationFields({
    docKey: 'governmentIdRepresentativeFront',
    text,
    user: { firstName, middleName, lastName, suffix },
    confidence,
  }).find(result => result.field === 'registrantName') || { status: 'needs_review', detectedValue: '' }
  const expectedMiddleTokens = String(middleName || '').toUpperCase().match(/[A-Z0-9]+/g) || []
  const detectedNameTokens = String(comparedName.detectedValue || '').toUpperCase().match(/[A-Z0-9]+/g) || []
  const nameStatus = comparedName.status === 'match'
    && expectedMiddleTokens.some(token => !detectedNameTokens.includes(token))
    ? 'mismatch'
    : comparedName.status
  const nameMatch = { ...comparedName, status: nameStatus }
  const expiryDate = extractPractitionerLicenseExpiryDate(text)
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {})
  const todayKey = today || `${localParts.year}-${localParts.month}-${localParts.day}`
  const expiryStatus = !expiryDate ? 'unreadable' : expiryDate < todayKey ? 'expired' : 'valid'
  let reason = 'The license name matches the employee and the expiration date is valid.'
  if (nameMatch.status === 'mismatch') reason = 'The name on the practitioner license does not match the employee name.'
  else if (nameMatch.status !== 'match') reason = 'The practitioner license name could not be read confidently. Upload a clearer image with the name visible.'
  else if (expiryStatus === 'unreadable') reason = 'The license expiration date could not be read. Upload a clear image showing its validity date.'
  else if (expiryStatus === 'expired') reason = `The practitioner license expired on ${expiryDate}. Upload a current license.`
  const accepted = nameMatch.status === 'match' && expiryStatus === 'valid'
  return {
    accepted,
    status: accepted ? 'verified' : nameMatch.status === 'mismatch' || expiryStatus === 'expired' ? 'rejected' : 'needs_review',
    reason,
    nameMatch: { status: nameMatch.status, detectedValue: nameMatch.detectedValue || '' },
    expiryDate,
    expiryStatus,
  }
}

export const readPractitionerLicenseOcr = async ({ visionClient, bytes, getVisionResponseError = () => '' }) => {
  if (!visionClient) throw Object.assign(new Error('Document name checking is temporarily unavailable.'), { status: 503 })
  const request = { image: { content: bytes } }
  const [result] = await visionClient.documentTextDetection(request)
  const primaryError = getVisionResponseError?.(result)
  if (primaryError) throw new Error(primaryError)
  let annotation = result?.fullTextAnnotation
  let extractedText = String(annotation?.text || '').trim()
  if (!extractedText) {
    const [fallback] = await visionClient.textDetection(request)
    const fallbackError = getVisionResponseError?.(fallback)
    if (fallbackError) throw new Error(fallbackError)
    extractedText = String(fallback?.textAnnotations?.[0]?.description || '').trim()
    annotation = fallback?.fullTextAnnotation || annotation
  }
  return { annotation, extractedText }
}

export const registerPractitionerTeams = (app, { admin, requireAuth, loadUserContext, authorizeClinicAction, createVisionClient, getVisionResponseError, getVisionWordConfidence }) => {
  const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp()
  const route = (method, path, fn) => app[method](path, requireAuth, async (req, res) => {
    try { const context = await loadUserContext(req.user.uid); res.json({ success: true, data: await fn(req, context) }) }
    catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
  const owner = async (uid, branchId) => {
    const clinic = (await db.collection('clinics').doc(branchId).get()).data()
    check(clinic?.ownerId === uid || clinic?.organizationOwnerId === uid, 'Only the clinic owner can change practitioner credentials and compensation.', 403)
  }
  app.post('/practitioner-license/ocr', requireAuth, async (req, res) => {
    try {
      const branchId = String(req.body?.branchId || '').trim()
      const employeeId = String(req.body?.employeeId || '').trim()
      const contentType = String(req.body?.contentType || '').toLowerCase()
      const encoded = String(req.body?.base64 || '').replace(/^data:[^,]+,/, '')
      check(branchId, 'Choose a clinic branch before processing the credential document.', 400)
      check(['image/jpeg', 'image/png'].includes(contentType), 'Upload a JPEG or PNG image to use OCR.', 400)
      check(encoded.length >= 16 && encoded.length <= 7 * 1024 * 1024, 'The credential image must be 5 MB or smaller.', 400)
      await authorizeClinicAction(req.user.uid, branchId, employeeId ? 'staff:update' : 'staff:create')
      let employeeName = {
        firstName: String(req.body?.firstName || '').trim(),
        middleName: String(req.body?.middleName || '').trim(),
        lastName: String(req.body?.lastName || '').trim(),
        suffix: String(req.body?.suffix || '').trim(),
      }
      if (employeeId) {
        const employee = (await db.collection('users').doc(employeeId).get()).data()
        check(employee && [employee.branchId, ...(employee.branchIds || [])].includes(branchId), 'Employee is not assigned to this branch.', 403)
        employeeName = {
          firstName: String(employee.firstName || '').trim(),
          middleName: String(employee.middleName || '').trim(),
          lastName: String(employee.lastName || '').trim(),
          suffix: String(employee.suffix || '').trim(),
        }
      }
      check(employeeName.firstName && employeeName.lastName, 'Enter the employee name before checking the license.', 400)
      const visionClient = createVisionClient?.()
      const image = Buffer.from(encoded, 'base64')
      check(image.length > 0 && image.length <= 5 * 1024 * 1024, 'The credential image must be 5 MB or smaller.', 400)
      const { annotation, extractedText } = await readPractitionerLicenseOcr({ visionClient, bytes: image, getVisionResponseError })
      const licenseNumber = extractPractitionerLicenseNumber(extractedText)
      const confidence = getVisionWordConfidence(annotation)
      const validation = validatePractitionerCredentialDocument({ ...employeeName, text: extractedText, confidence })
      const employeeNameMatched = validation.nameMatch?.status === 'match'
      const safeValidation = employeeNameMatched ? validation : {
        ...validation,
        nameMatch: { status: validation.nameMatch?.status || 'needs_review', detectedValue: '' },
        expiryDate: '',
        expiryStatus: 'unreadable',
      }
      return res.json({ success: true, data: {
        ...safeValidation,
        reason: validation.accepted
          ? `${validation.reason}${licenseNumber ? ' The license number was also read.' : ''}`
          : validation.reason,
        // Do not disclose OCR personal data or a detected registration number
        // when the submitted credential does not identify this employee.
        extractedText: employeeNameMatched ? extractedText.slice(0, 12000) : '',
        licenseNumber: employeeNameMatched ? licenseNumber : '',
        confidence: employeeNameMatched ? confidence : null,
      } })
    } catch (error) {
      if (error.status) return res.status(error.status).json({ success: false, error: error.message })
      console.error('Practitioner license OCR failed:', error?.message || error)
      return res.status(503).json({ success: false, error: 'We could not read this license document. Upload a clearer image and try again.' })
    }
  })
  route('get', '/staff/:id/practitioner-details', async req => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await authorizeClinicAction(req.user.uid, user.branchId, 'staff:view')
    const profile = (await db.collection('practitionerProfiles').doc(req.params.id).get()).data()
    return { type: profile?.type || user.practitionerType || '', credentialNumber: profile?.credentialNumber || '' }
  })
  route('post', '/staff/:id/practitioner-details', async req => {
    const type = String(req.body?.type || '').trim()
    const credentialNumber = String(req.body?.credentialNumber || '').trim()
    const licenseDocument = req.body?.licenseDocument && typeof req.body.licenseDocument === 'object' ? req.body.licenseDocument : null
    const licenseUrl = String(licenseDocument?.url || '').trim()
    const licenseName = String(licenseDocument?.name || '').trim()
    check(!type || practitionerTypes.includes(type), 'Choose a supported specialty.', 400)
    check(!credentialNumber || /^\d{7}$/.test(credentialNumber), 'Credential number must be exactly 7 digits.', 400)
    check(!licenseDocument || (licenseUrl.startsWith('https://firebasestorage.googleapis.com/') && licenseUrl.length <= 2000 && licenseName.length <= 255), 'The license document details are invalid.', 400)
    return db.runTransaction(async tx => {
      const userRef = db.collection('users').doc(req.params.id), profileRef = db.collection('practitionerProfiles').doc(req.params.id)
      const user = (await tx.get(userRef)).data()
      check(user, 'Employee not found.', 404)
      await authorizeClinicAction(req.user.uid, user.branchId, 'staff:update')
      const profile = (await tx.get(profileRef)).data()
      const changed = type !== (profile?.type || user.practitionerType || '') || credentialNumber !== (profile?.credentialNumber || '') || Boolean(licenseDocument)
      if (type || profile) tx.set(profileRef, { ...(profile || { approvedServiceIds: [], rates: [] }), type, credentialNumber, credentialsVerified: changed ? false : profile?.credentialsVerified === true, branchId: user.branchId, updatedBy: req.user.uid, updatedAt: now() })
      tx.update(userRef, { practitionerType: type || null, ...(licenseDocument ? { practitionerLicenseUrl: licenseUrl, practitionerLicenseName: licenseName, practitionerLicenseUploadedBy: req.user.uid } : {}) })
      if (changed) tx.set(db.collection('practitionerProfileAudit').doc(), { employeeId: req.params.id, branchId: user.branchId, actorId: req.user.uid, action: 'updated_specialty_and_license', type, credentialNumber, createdAt: now() })
      return { type, credentialNumber }
    })
  })
  route('get', '/practitioner-profiles/:id', async (req) => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await owner(req.user.uid, user.branchId)
    return (await db.collection('practitionerProfiles').doc(req.params.id).get()).data() || null
  })
  route('post', '/practitioner-profiles/:id', async (req) => {
    const user = (await db.collection('users').doc(req.params.id).get()).data()
    check(user, 'Employee not found.', 404)
    await owner(req.user.uid, user.branchId)
    const profile = normalizePractitionerProfile(req.body || {})
    if (['Doctor', 'Registered Nurse'].includes(profile.type) && profile.credentialsVerified) check(profile.credentialNumber, 'Enter the professional credential number before verifying it.', 400)
    for (const id of [...new Set([...profile.approvedServiceIds, ...profile.rates.map(rate => rate.serviceId).filter(Boolean)])]) {
      const listing = (await db.collection('productServicePosts').doc(id).get()).data()
      check(listing && [user.branchId, ...(user.branchIds || [])].includes(listing.branchId) && listing.postType !== 'Product', 'Choose a service from the employee’s assigned branches.', 400)
    }
    const profileRef = db.collection('practitionerProfiles').doc(req.params.id)
    const existingProfile = (await profileRef.get()).data() || {}
    const batch = db.batch()
    batch.set(profileRef, {
      ...profile,
      ...(existingProfile.credentialExpiryDate ? { credentialExpiryDate: existingProfile.credentialExpiryDate } : {}),
      branchId: user.branchId,
      updatedBy: req.user.uid,
      updatedAt: now(),
    })
    batch.update(db.collection('users').doc(req.params.id), { practitionerType: profile.type })
    batch.set(db.collection('practitionerProfileAudit').doc(), { employeeId: req.params.id, branchId: user.branchId, actorId: req.user.uid, profile, createdAt: now() })
    await batch.commit()
    return profile
  })
  route('get', '/appointments/:id/team', async req => {
    const appointment = (await db.collection('appointments').doc(req.params.id).get()).data()
    check(appointment, 'Appointment not found.', 404)
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:view')
    const [primary, additional] = await Promise.all([db.collection('users').where('branchId', '==', appointment.branchId).get(), db.collection('users').where('branchIds', 'array-contains', appointment.branchId).get()])
    const staff = [...new Map([...primary.docs, ...additional.docs].map(doc => [doc.id, doc])).values()]
    const people = []
    for (const doc of staff.filter(doc => !doc.data().archived && String(doc.data().status).toLowerCase() === 'active')) {
      const profile = (await db.collection('practitionerProfiles').doc(doc.id).get()).data()
      if (profile) people.push({ id: doc.id, name: nameFor(doc.data()), type: profile.type, approvedServiceIds: profile.approvedServiceIds, credentialsVerified: profile.credentialsVerified })
    }
    return { appointment, people }
  })
  route('post', '/appointments/:id/team', async () => { check(false, 'Appointments use the single booked lead practitioner. Assistant assignments are no longer supported.', 410) })
  route('post', '/appointments/:id/team/participation', async () => { check(false, 'Only the booked lead practitioner is assigned to an appointment.', 410) })
  route('get', '/staff-earnings', async (req, context) => {
    const branchId = String(req.query.branchId || '')
    await authorizeClinicAction(req.user.uid, branchId, context.permissions.has('payroll:update') ? 'payroll:update' : 'payroll:view')
    return (await db.collection('staffEarnings').where('branchId', '==', branchId).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))
  })
  route('get', '/staff-earnings/appointments', async req => {
    const branchId = String(req.query.branchId || '')
    await authorizeClinicAction(req.user.uid, branchId, 'payroll:view')
    const records = await db.collection('appointments').where('branchId', '==', branchId).get()
    const fields = ['branchId', 'customerName', 'clientName', 'practitionerName', 'assignedPractitionerName', 'practitionerId', 'assignedPractitionerId', 'service', 'date', 'time', 'completedAt', 'treatmentTeam', 'staffEarningsStatus', 'consultationNeedsReview', 'consultationActualDurationSeconds']
    return records.docs.filter(doc => doc.data().status === 'Completed' && !doc.data().isGroupParent && !doc.data().isBookingOrderParent).map(doc => ({ id: doc.id, ...Object.fromEntries(fields.map(key => [key, doc.data()[key] ?? null])) }))
  })
  route('get', '/appointments/:id/staff-earnings', async req => {
    const appointment = (await db.collection('appointments').doc(req.params.id).get()).data()
    if (appointment?.type === 'Consultation' && appointment.consultationMode === 'online') check(String(appointment.treatmentNotes || '').trim().length >= 10, 'Save consultation documentation before approving earnings.')
    check(appointment?.consultationDispute?.status !== 'Open', 'Resolve the customer consultation report before approving earnings.')
    check(appointment?.status === 'Completed', 'Choose a completed appointment.')
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'payroll:view')
    const terms = (await db.collection('appointmentStaffTerms').doc(req.params.id).get()).data()
    check(terms?.members?.length, 'No staff agreements were saved when this appointment started. Configure agreements before starting new appointments.')
    const plan = appointment.treatmentPlanAppointmentId ? (await db.collection('appointments').doc(appointment.treatmentPlanAppointmentId).get()).data() : appointment
    return calculateStaffEarnings(terms.members.map(member => ({ ...member, participationConfirmed: appointment.treatmentTeam?.find(row => row.employeeId === member.employeeId)?.participationConfirmed === true })), sessionEarningBase(appointment, plan))
  })
  route('post', '/staff-earnings/:id/reverse', async (req, context) => db.runTransaction(async tx => {
    const ref = db.collection('staffEarnings').doc(req.params.id), earning = (await tx.get(ref)).data()
    check(earning && !earning.adjustmentOf, 'Choose an original staff earning to reverse.')
    await authorizeClinicAction(req.user.uid, earning.branchId, 'payroll:view')
    check((context.permissions.has('payroll:approve') || context.permissions.has('administrator:full_access')) && earning.employeeId !== req.user.uid, 'An independent owner or Finance reviewer is required.', 403)
    const amount = Number(req.body?.amount), reason = String(req.body?.reason || '').trim(), monthKey = String(req.body?.monthKey || '')
    const requestId = String(req.body?.requestId || '')
    check(/^[a-f0-9-]{36}$/i.test(requestId), 'A reversal request ID is required.', 400)
    const adjustment = db.collection('staffEarnings').doc(ref.id + '_reversal_' + requestId)
    const previous = (await tx.get(adjustment)).data()
    if (previous) {
      check(previous.amount === -Math.round(amount * 100) / 100 && previous.monthKey === monthKey && previous.reason === reason, 'This reversal request was already used with different details.')
      return { id: adjustment.id, alreadyRecorded: true }
    }
    check(Number.isFinite(amount) && amount > 0 && Math.round((amount + Number(earning.reversedAmount || 0)) * 100) <= Math.round(earning.amount * 100), 'The reversal cannot exceed the unreversed staff earning.', 400)
    check(reason.length >= 10 && reason.length <= 1000 && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) && monthKey >= earning.monthKey, 'Enter a reason and an open payroll month on or after the original period.', 400)
    const summary = (await tx.get(db.collection('payrollSummaries').doc(earning.branchId + '_' + monthKey))).data()
    check(summary?.status !== 'approved', 'Choose an open payroll period; approved payroll cannot be changed.')
    tx.set(adjustment, { employeeId: earning.employeeId, employeeName: earning.employeeName, branchId: earning.branchId, appointmentId: earning.appointmentId, service: earning.service, responsibility: earning.responsibility, monthKey, amount: -Math.round(amount * 100) / 100, status: 'Approved', adjustmentOf: ref.id, reason, approvedBy: req.user.uid, createdAt: now(), approvedAt: now(), payrollSummaryId: null })
    tx.update(ref, { reversedAmount: Math.round((amount + Number(earning.reversedAmount || 0)) * 100) / 100 })
    return { id: adjustment.id }
  }))
  route('post', '/appointments/:id/staff-earnings/approve', async (req, context) => db.runTransaction(async tx => {
    const ref = db.collection('appointments').doc(req.params.id), appointment = (await tx.get(ref)).data()
    check(appointment?.status === 'Completed', 'Staff earnings require a completed appointment.')
    await authorizeClinicAction(req.user.uid, appointment.branchId, 'payroll:view')
    const historicalTeamIds = (appointment.treatmentTeam || []).map(member => member.employeeId)
    check((context.permissions.has('payroll:approve') || context.permissions.has('administrator:full_access')) && ![...appointmentStaffIds(appointment), ...historicalTeamIds].includes(req.user.uid), 'An independent owner or Finance reviewer must approve staff earnings.', 403)
    check(appointment.staffEarningsStatus !== 'Approved', 'Staff earnings are already approved.')
    const reviewNote = String(req.body?.reviewNote || '').trim().slice(0, 1000)
    if (appointment.consultationNeedsReview) check(reviewNote.length >= 10, 'Review the flagged consultation and explain why these earnings should be approved.', 400)
    const terms = (await tx.get(db.collection('appointmentStaffTerms').doc(ref.id))).data()
    check(terms?.members?.length, 'This appointment has no saved staff compensation. Configure agreements before starting new appointments.')
    const plan = appointment.treatmentPlanAppointmentId ? (await tx.get(db.collection('appointments').doc(appointment.treatmentPlanAppointmentId))).data() : appointment
    const base = sessionEarningBase(appointment, plan)
    const earned = calculateStaffEarnings(terms.members.map(member => ({ ...member, participationConfirmed: appointment.treatmentTeam?.find(row => row.employeeId === member.employeeId)?.participationConfirmed === true })), base)
    check(earned.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) <= Math.round(base * 100), 'Total staff service earnings exceed the allocated session revenue. Review the compensation agreements.')
    const completed = appointment.completedAt?.toDate?.() || new Date(appointment.completedAt || Date.now())
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(completed)
    const completionMonthKey = parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value
    const monthKey = String(req.body?.payrollMonth || completionMonthKey)
    check(/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) && monthKey >= completionMonthKey, 'Choose a payroll period on or after the completion month.', 400)
    const summary = (await tx.get(db.collection('payrollSummaries').doc(appointment.branchId + '_' + monthKey))).data()
    check(summary?.status !== 'approved', 'This payroll period is locked. Staff earnings must be reviewed before payroll approval.')
    for (const row of earned) tx.set(db.collection('staffEarnings').doc(ref.id + '_' + row.employeeId), { ...row, appointmentId: ref.id, branchId: appointment.branchId, service: appointment.service || '', monthKey, completionMonthKey, status: 'Approved', approvedBy: req.user.uid, approvedAt: now(), createdAt: now(), payrollSummaryId: null })
    tx.update(ref, { staffEarningsStatus: 'Approved', staffEarningsApprovedBy: req.user.uid, staffEarningsReviewNote: reviewNote, updatedAt: now() })
    return earned
  }))
}
