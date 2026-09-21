import crypto from 'node:crypto'
import { demand, dateKey, clock, punches, validateField, fieldValues } from './attendancePolicy.js'

export function registerAttendanceManagement(app, { admin, requireAuth, requirePermission, resolveBranchAccess, loadAttendanceSchedule }) {
  const db = () => admin.firestore()
  const stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const run = handler => async (req, res) => {
    try { res.json({ success: true, ...await handler(req) }) }
    catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }) }
  }
  const scope = async (req, input = req.body) => {
    const branchId = String(input.branchId || '').trim()
    demand(branchId && !branchId.includes('/'), 'Select a branch.')
    demand(await resolveBranchAccess(req.user.uid, branchId), 'You cannot access this branch.', 403)
    const branch = (await db().collection('clinics').doc(branchId).get()).data()
    demand(branch?.ownerId, 'Branch organization is missing.')
    return { branchId, branch, ownerId: branch.ownerId }
  }
  const configRef = ownerId => db().collection('attendanceConfigurations').doc(ownerId)
  const configuration = async ownerId => (await configRef(ownerId).get()).data() || { fields: [], templates: [], holidays: [] }

  app.post('/attendance/configuration', requireAuth, requirePermission('attendance:view'), run(async req => {
    const s = await scope(req)
    return { ...await configuration(s.ownerId), ownerId: s.ownerId, canManageFields: req.user.uid === s.ownerId }
  }))
  app.post('/attendance/fields', requireAuth, requirePermission('attendance:update'), run(async req => {
    const s = await scope(req)
    demand(req.user.uid === s.ownerId, 'Only the organization owner can define attendance fields.', 403)
    const ref = configRef(s.ownerId)
    return db().runTransaction(async tx => {
      const config = (await tx.get(ref)).data() || {}
      const fields = config.fields || []
      let field
      if (req.body.archiveId) {
        field = fields.find(f => f.id === req.body.archiveId)
        demand(field, 'Field not found.')
        field.archived = true
      } else {
        demand(fields.length < 50 && fields.filter(f => !f.archived).length < 20, 'At most 20 active fields and 50 historical definitions are supported.')
        field = { id: crypto.randomUUID(), ...validateField(req.body), archived: false }
        fields.push(field)
      }
      tx.set(ref, { fields, updatedAt: stamp() }, { merge: true })
      tx.create(ref.collection('audit').doc(), { action: field.archived ? 'archive' : 'create', field, actorId: req.user.uid, createdAt: stamp() })
      return { fields }
    })
  }))
  app.post('/attendance/template', requireAuth, requirePermission('attendance:import'), run(async req => {
    const s = await scope(req), ref = configRef(s.ownerId)
    const template = { id: crypto.randomUUID(), name: String(req.body.name || '').trim().slice(0, 80), mapping: req.body.mapping, mode: req.body.mode || 'shift' }
    demand(template.name && template.mapping && Object.keys(template.mapping).length <= 50, 'Provide a name and a valid mapping.')
    await db().runTransaction(async tx => {
      const config = (await tx.get(ref)).data() || {}
      const templates = config.templates || []
      demand(templates.length < 30, 'The organization mapping-template limit is 30.')
      tx.set(ref, { templates: [...templates, template] }, { merge: true })
    })
    return { template }
  }))
  app.post('/attendance/holidays', requireAuth, requirePermission('attendance:update'), run(async req => {
    const s = await scope(req)
    demand(s.ownerId === req.user.uid, 'Only the organization owner can change the attendance calendar.', 403)
    const holidays = req.body.holidays
    demand(Array.isArray(holidays) && holidays.length <= 366, 'At most 366 holiday dates are supported.')
    holidays.forEach(dateKey)
    await configRef(s.ownerId).set({ holidays: [...new Set(holidays)], updatedAt: stamp() }, { merge: true })
    return { holidays }
  }))
  app.post('/attendance/records', requireAuth, requirePermission('attendance:view'), run(async req => {
    const s = await scope(req), date = dateKey(req.body.date)
    const [people, records, config] = await Promise.all([
      db().collection('users').where('branchId', '==', s.branchId).get(),
      db().collection('attendance').where('branchId', '==', s.branchId).where('date', '==', date).get(),
      configuration(s.ownerId),
    ])
    const found = new Map(records.docs.map(d => [d.data().employeeId, { ...d.data(), id: d.id }]))
    const rows = []
    for (const person of people.docs) {
      const user = person.data()
      if (!['staff', 'employee'].includes(String(user.userType || '').toLowerCase()) || user.archived || String(user.status || '').toLowerCase() !== 'active') continue
      const record = found.get(person.id)
      found.delete(person.id)
      const schedule = await loadAttendanceSchedule(person.id, date)
      const scheduled = !!schedule.shiftStart && !!schedule.shiftEnd && !schedule.onLeave && !(config.holidays || []).includes(date)
      let cutoff = Infinity
      if (scheduled) cutoff = punches(date, schedule.shiftStart, schedule.shiftEnd, clock(schedule.shiftEnd) <= clock(schedule.shiftStart)).timeOutEpoch + 60 * 60000
      let status = schedule.onLeave ? 'On Leave' : (config.holidays || []).includes(date) ? 'Holiday' : scheduled ? (Date.now() > cutoff ? 'Absent' : 'Scheduled') : 'Day Off'
      if (record?.timeIn) status = record.timeOut ? 'Complete' : Date.now() > cutoff ? 'Needs Review' : 'On Duty'
      if (record?.timeOut && !record.timeIn || record?.attendanceStatus === 'Needs Review') status = 'Needs Review'
      rows.push({ ...schedule, ...record, id: record?.id || '', employeeId: person.id, employeeName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, branchId: s.branchId, date, scheduled, attendanceStatus: status })
    }
    // Preserve historical records for archived employees.
    rows.push(...found.values())
    return { records: rows }
  }))
  app.post('/attendance/details', requireAuth, requirePermission('attendance:view'), run(async req => {
    demand(/^[^/]{1,200}$/.test(String(req.body.attendanceId || '')), 'Select an attendance record.')
    const ref = db().collection('attendance').doc(req.body.attendanceId), record = (await ref.get()).data()
    demand(record, 'Record not found.', 404)
    await scope(req, record)
    const audit = await ref.collection('corrections').get()
    if (record.proofStoragePath && record.proofStoragePath.startsWith(`attendanceProofs/${record.branchId}/${record.employeeId}/`)) {
      const [url] = await admin.storage().bucket().file(record.proofStoragePath).getSignedUrl({ action: 'read', expires: Date.now() + 300000 })
      record.proofUrl = url
    }
    return { record: { ...record, id: ref.id }, audit: audit.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) }
  }))
  app.post('/attendance/correction', requireAuth, requirePermission('attendance:update'), run(async req => {
    demand(/^[^/]{1,200}$/.test(String(req.body.attendanceId || '')), 'Select an attendance record.')
    const ref = db().collection('attendance').doc(req.body.attendanceId), initial = (await ref.get()).data()
    demand(initial, 'Record not found.', 404)
    const s = await scope(req, initial), config = await configuration(s.ownerId)
    const reason = String(req.body.reason || '').trim()
    demand(reason.length >= 5 && reason.length <= 1000, 'Provide a correction reason of 5–1000 characters.')
    return db().runTransaction(async tx => {
      const snap = await tx.get(ref), before = snap.data()
      demand(before?.branchId === s.branchId, 'Record scope changed.', 409)
      demand((before.revision || 0) === req.body.revision, 'Record changed. Reopen it before correcting.', 409)
      const after = { ...punches(before.date, req.body.timeIn, req.body.timeOut, req.body.overnight === true), customFields: fieldValues(req.body.customFields || {}, config.fields || [], before.customFields || {}), revision: (before.revision || 0) + 1 }
      tx.update(ref, { ...after, correctedBy: req.user.uid, correctedAt: stamp(), updatedAt: stamp() })
      tx.create(ref.collection('corrections').doc(), { before, after, reason, correctedBy: req.user.uid, branchId: s.branchId, createdAt: stamp() })
      return { record: { ...before, ...after, id: ref.id } }
    })
  }))
}
