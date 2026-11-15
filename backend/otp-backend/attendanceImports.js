import crypto from 'node:crypto'
import { demand, dateKey, clock } from './attendancePolicy.js'

const HEADER_TARGETS = {
  employeeemail: 'employeeEmail',
  staffemail: 'employeeEmail',
  email: 'employeeEmail',
  emailaddress: 'employeeEmail',
  employeeid: 'employeeId',
  staffid: 'employeeId',
  uid: 'employeeId',
  date: 'date',
  workdate: 'date',
  attendancedate: 'date',
  timein: 'timeIn',
  clockin: 'timeIn',
  timeout: 'timeOut',
  clockout: 'timeOut',
  clockoutdate: 'clockOutDate',
  timeoutdate: 'clockOutDate',
  unpaidbreakminutes: 'unpaidBreakMinutes',
  unpaidmealbreakminutes: 'unpaidBreakMinutes',
  mealbreakminutes: 'unpaidBreakMinutes',
  breakminutes: 'unpaidBreakMinutes',
}

const normalizeHeader = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (!quoted && (ch === ',' || ch === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = ''
      if (ch === '\n') { if (row.some(v => v.trim())) rows.push(row); row = [] }
    } else cell += ch
  }
  demand(!quoted, 'CSV has an unclosed quoted value.')
  row.push(cell.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row)
  return rows
}

const dateCell = (value, label) => {
  const candidate = String(value ?? '').trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  demand(candidate, `${label} must use YYYY-MM-DD.`)
  return dateKey(candidate)
}

const clockMinutes = value => {
  const normalized = clock(value)
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

const inferredBreakForSchedule = schedule => {
  const explicit = schedule?.unpaidMealBreakMinutes
  if (explicit !== null && explicit !== undefined && explicit !== '') {
    const minutes = Number(explicit)
    if (Number.isInteger(minutes) && minutes >= 0 && minutes <= 180) return minutes
  }
  if (!schedule?.shiftStart || !schedule?.shiftEnd) return null
  let duration = clockMinutes(schedule.shiftEnd) - clockMinutes(schedule.shiftStart)
  if (duration <= 0) duration += 24 * 60
  return duration > 8 * 60 ? 60 : 0
}

const excelValue = (value, target) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (target === 'date' || target === 'clockOutDate') return value.toISOString().slice(0, 10)
    if (target === 'timeIn' || target === 'timeOut') {
      return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`
    }
    return value.toISOString()
  }
  if ((target === 'timeIn' || target === 'timeOut') && typeof value === 'number' && value >= 0 && value < 1) {
    const totalMinutes = Math.round(value * 24 * 60) % (24 * 60)
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
  }
  return String(value)
}

const dayDifference = (startDate, endDate) =>
  (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000

export function registerAttendanceImports(app, { admin, requireAuth, requirePermission, resolveBranchAccess, assertPlanFeature, loadAttendanceSchedule }) {
  const db = () => admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const run = fn => async (req, res) => {
    try { res.json({ success: true, ...await fn(req) }) }
    catch (error) { res.status(error.status || 400).json({ success: false, error: error.message }) }
  }
  const scope = async (req, branchId) => {
    demand(typeof branchId === 'string' && branchId && !branchId.includes('/'), 'Select a branch.')
    demand(await resolveBranchAccess(req.user.uid, branchId), 'Branch access denied.', 403)
    await assertPlanFeature(db(), branchId, 'attendance')
    const branch = (await db().collection('clinics').doc(branchId).get()).data()
    demand(branch?.ownerId, 'Branch organization is missing.')
    return branch.ownerId
  }
  const route = (path, fn) => app.post(`/attendance/imports/${path}`, requireAuth, requirePermission('attendance:import'), run(fn))

  route('preview', async req => {
    const body = req.body || {}
    const { branchId } = body
    const ownerId = await scope(req, branchId)
    const filename = String(body.fileName || '')
    const bytes = Buffer.from(String(body.content || ''), 'base64')
    demand(bytes.length > 0 && bytes.length <= 3 * 1024 * 1024, 'Upload a file up to 3 MB.')

    let rows
    if (/\.csv$/i.test(filename)) {
      demand(!bytes.includes(0), 'CSV must be UTF-8 text.')
      rows = parseCsv(bytes.toString('utf8').replace(/^\uFEFF/, ''))
    } else {
      demand(/\.xlsx$/i.test(filename) && bytes[0] === 80 && bytes[1] === 75, 'Upload the attendance template as CSV or Excel .xlsx.')
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(bytes)
      demand(workbook.worksheets.length === 1, 'Use one worksheet for the attendance template.')
      const sheet = workbook.worksheets[0]
      demand(sheet.rowCount <= 401 && sheet.columnCount <= 50, 'Limit files to 400 records and 50 columns.')
      rows = []
      sheet.eachRow(row => {
        const cells = []
        for (let i = 1; i <= sheet.columnCount; i++) {
          const value = row.getCell(i).value
          demand(!value || typeof value !== 'object' || value instanceof Date, 'Excel cells must contain plain values; formulas, links, and rich text are not supported.')
          cells.push(value)
        }
        rows.push(cells)
      })
    }

    demand(rows.length >= 2 && rows.length <= 401 && rows[0].length <= 50, 'Provide a header row and 1–400 attendance records.')
    const headers = rows[0].map(value => String(value ?? '').trim())
    const normalizedHeaders = headers.map(normalizeHeader)
    demand(headers.every(Boolean) && new Set(normalizedHeaders).size === normalizedHeaders.length, 'Column headers must be nonempty and unique.')

    const headerTargets = new Map()
    normalizedHeaders.forEach((header, index) => {
      const target = HEADER_TARGETS[header]
      if (!target) return
      demand(!headerTargets.has(target), `Use only one column for ${target}.`)
      headerTargets.set(target, index)
    })
    demand(headerTargets.has('employeeEmail') || headerTargets.has('employeeId'), 'Add an employee_email column using the downloadable template.')
    for (const target of ['date', 'timeIn', 'timeOut']) {
      demand(headerTargets.has(target), `The template must include ${target === 'timeIn' ? 'time_in' : target === 'timeOut' ? 'time_out' : 'date'}.`)
    }
    const ignoredColumns = headers.filter((_, index) => !HEADER_TARGETS[normalizedHeaders[index]])

    const [primaryPeople, assignedPeople] = await Promise.all([
      db().collection('users').where('branchId', '==', branchId).get(),
      db().collection('users').where('branchIds', 'array-contains', branchId).get(),
    ])
    const peopleById = new Map()
    for (const snapshot of [...primaryPeople.docs, ...assignedPeople.docs]) {
      if (!peopleById.has(snapshot.id)) peopleById.set(snapshot.id, { ...(snapshot.data() || {}), id: snapshot.id })
    }
    const users = [...peopleById.values()].filter(user =>
      ['staff', 'employee'].includes(String(user.userType || '').trim().toLowerCase())
    )
    const byEmail = new Map()
    for (const user of users) {
      const email = String(user.email || '').trim().toLowerCase()
      if (!email) continue
      const list = byEmail.get(email) || []
      list.push(user)
      byEmail.set(email, list)
    }

    const valid = [], rejected = [], seenAttendance = new Set()
    for (const [index, cells] of rows.slice(1).entries()) {
      const rowNumber = index + 2
      try {
        demand(Array.isArray(cells) && cells.length <= 50 && cells.length <= headers.length, 'This row has more values than the header. Check its commas or quotation marks.')
        const item = {}
        for (const [target, cellIndex] of headerTargets) item[target] = excelValue(cells[cellIndex], target).trim()

        const employeeId = item.employeeId || ''
        const email = String(item.employeeEmail || '').trim().toLowerCase()
        let matched = employeeId ? users.filter(user => user.id === employeeId) : (byEmail.get(email) || [])
        demand(matched.length === 1, 'Employee email or ID must match one staff account assigned to this branch.')
        const employee = matched[0]
        if (email && employee.email && String(employee.email).trim().toLowerCase() !== email) {
          throw new Error('The employee email and ID point to different accounts.')
        }

        const date = dateCell(item.date, 'Date')
        const clockOutDate = item.clockOutDate ? dateCell(item.clockOutDate, 'Clock-out date') : date
        const daysApart = dayDifference(date, clockOutDate)
        demand(daysApart === 0 || daysApart === 1, 'Clock-out date must be the work date or the following day.')
        const timeIn = clock(item.timeIn), timeOut = clock(item.timeOut)
        demand(timeIn && timeOut, 'Enter both time_in and time_out for each imported shift.')
        const timeInEpoch = Date.parse(`${date}T${timeIn}+08:00`)
        const timeOutEpoch = Date.parse(`${clockOutDate}T${timeOut}+08:00`)
        demand(timeOutEpoch > timeInEpoch, 'Clock-out must occur after clock-in.')
        demand(timeOutEpoch - timeInEpoch <= 24 * 60 * 60 * 1000, 'A shift cannot be longer than 24 hours.')

        const attendanceId = `${employee.id}_${date}`
        demand(!seenAttendance.has(attendanceId), 'This employee and date appears more than once in the file.')
        demand(!(await db().collection('attendance').doc(attendanceId).get()).exists, 'Attendance already exists for this employee and date. Use an audited correction instead.')

        const schedule = typeof loadAttendanceSchedule === 'function'
          ? await loadAttendanceSchedule(employee.id, date)
          : null
        demand(!schedule?.onLeave, 'This employee has approved leave on this date.')
        const suppliedBreak = item.unpaidBreakMinutes
        let unpaidMealBreakMinutes
        if (suppliedBreak !== undefined && suppliedBreak !== '') {
          demand(/^\d{1,3}$/.test(suppliedBreak), 'unpaid_break_minutes must be a whole number from 0 to 180.')
          unpaidMealBreakMinutes = Number(suppliedBreak)
          demand(unpaidMealBreakMinutes <= 180, 'unpaid_break_minutes must be from 0 to 180.')
        } else {
          unpaidMealBreakMinutes = inferredBreakForSchedule(schedule)
          demand(unpaidMealBreakMinutes !== null, 'No assigned shift break was found. Enter unpaid_break_minutes (use 0 when there was no unpaid break).')
        }

        const totalWorkedMinutes = Math.round((timeOutEpoch - timeInEpoch) / 60000)
        seenAttendance.add(attendanceId)
        valid.push({
          employeeId: employee.id,
          employeeName: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email || employee.id,
          branchId,
          date,
          clockOutDate,
          timeIn,
          timeOut,
          timeInEpoch,
          timeOutEpoch,
          totalWorkedMinutes,
          attendanceStatus: 'Complete',
          shiftLabel: String(schedule?.shiftLabel || '').trim(),
          shiftStart: String(schedule?.shiftStart || '').trim(),
          shiftEnd: String(schedule?.shiftEnd || '').trim(),
          unpaidMealBreakMinutes,
          source: 'imported',
          attendanceMethod: 'import',
          locationVerified: false,
          revision: 0,
        })
      } catch (error) {
        rejected.push({ row: rowNumber, reason: error.message })
      }
    }

    const contentHash = crypto.createHash('sha256').update(JSON.stringify({ branchId, valid })).digest('hex')
    const ref = db().collection('attendanceImportPreviews').doc()
    const sourceFileName = filename.slice(0, 255)
    await ref.set({
      branchId, ownerId, importedBy: req.user.uid, sourceFileName,
      valid, rejected, ignoredColumns, contentHash, createdAt: stamp(), expiresAt: Date.now() + 1800000,
    })
    return {
      previewId: ref.id,
      fileName: sourceFileName,
      validRows: valid.length,
      valid: valid.map(record => ({ ...record, paidMinutes: Math.max(0, record.totalWorkedMinutes - record.unpaidMealBreakMinutes) })),
      rejectedRows: rejected.length,
      rejected,
      ignoredColumns,
    }
  })

  route('commit', async req => {
    const previewId = String(req.body.previewId || '')
    demand(/^[a-zA-Z0-9]+$/.test(previewId), 'Preview the file before importing.')
    const previewRef = db().collection('attendanceImportPreviews').doc(previewId)
    const initial = (await previewRef.get()).data()
    demand(initial, 'Import preview not found.')
    await scope(req, initial.branchId)
    demand(initial.importedBy === req.user.uid, 'Only the uploader can confirm this preview.', 403)
    return db().runTransaction(async tx => {
      const preview = (await tx.get(previewRef)).data()
      demand(preview && preview.expiresAt > Date.now(), 'Preview expired; upload the file again.')
      demand(preview.valid.length > 0, 'There are no valid rows to import.')
      const batchRef = db().collection('attendanceImports').doc(preview.contentHash)
      const prior = await tx.get(batchRef)
      if (prior.exists) return { batchId: prior.id, alreadyImported: true, importedRows: 0 }
      const refs = preview.valid.map(record => db().collection('attendance').doc(`${record.employeeId}_${record.date}`))
      const snapshots = await tx.getAll(...refs)
      demand(snapshots.every(snapshot => !snapshot.exists), 'Attendance changed after preview. Upload the file again; nothing was imported.', 409)
      preview.valid.forEach((record, index) => tx.create(refs[index], {
        ...record,
        importBatchId: batchRef.id,
        importedBy: req.user.uid,
        importedAt: stamp(),
        createdAt: stamp(),
        updatedAt: stamp(),
      }))
      tx.create(batchRef, {
        branchId: preview.branchId,
        sourceFileName: preview.sourceFileName,
        importedBy: req.user.uid,
        validRows: preview.valid.length,
        rejectedRows: preview.rejected.length,
        reviewRows: 0,
        rejected: preview.rejected,
        review: [],
        status: preview.rejected.length ? 'Needs Review' : 'Completed',
        createdAt: stamp(),
      })
      return { batchId: batchRef.id, alreadyImported: false, importedRows: preview.valid.length }
    })
  })

  route('history', async req => {
    await scope(req, req.body.branchId)
    const history = await db().collection('attendanceImports').where('branchId', '==', req.body.branchId).get()
    return { batches: history.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) }
  })
}
