import crypto from 'node:crypto'
import { demand, punches, clock, fieldValues } from './attendancePolicy.js'

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

export function registerAttendanceImports(app, { admin, requireAuth, requirePermission, resolveBranchAccess }) {
  const db = () => admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const run = fn => async (req,res) => { try { res.json({ success: true, ...await fn(req) }) } catch(e) { res.status(e.status || 400).json({ success: false, error: e.message }) } }
  const scope = async (req, branchId) => {
    demand(typeof branchId === 'string' && branchId && !branchId.includes('/'), 'Select a branch.')
    demand(await resolveBranchAccess(req.user.uid, branchId), 'Branch access denied.', 403)
    const branch = (await db().collection('clinics').doc(branchId).get()).data()
    demand(branch?.ownerId, 'Branch organization is missing.')
    return branch.ownerId
  }
  const route = (path, fn) => app.post(`/attendance/imports/${path}`, requireAuth, requirePermission('attendance:import'), run(fn))
  route('preview', async req => {
    await scope(req, req.body.branchId)
    const filename = String(req.body.fileName || '')
    const bytes = Buffer.from(String(req.body.content || ''), 'base64')
    demand(bytes.length > 0 && bytes.length <= 3 * 1024 * 1024, 'Upload a file up to 3 MB.')
    let rows
    if (/\.csv$/i.test(filename)) {
      demand(!bytes.includes(0), 'CSV must be UTF-8 text.')
      rows = parseCsv(bytes.toString('utf8').replace(/^\uFEFF/, ''))
    } else {
      demand(/\.xlsx$/i.test(filename) && bytes[0] === 80 && bytes[1] === 75, 'Supported formats are UTF-8 CSV and Excel .xlsx.')
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(bytes)
      demand(workbook.worksheets.length === 1, 'Provide a workbook containing one attendance worksheet.')
      const sheet = workbook.worksheets[0]
      demand(sheet.rowCount <= 401 && sheet.columnCount <= 50, 'Limit files to 400 records and 50 columns.')
      rows = []
      sheet.eachRow(row => {
        const cells = []
        for (let i = 1; i <= sheet.columnCount; i++) {
          const value = row.getCell(i).value
          demand(!value || typeof value !== 'object' || value instanceof Date, 'Formula, rich-text, and linked cells are not supported. Export values only.')
          cells.push(value instanceof Date ? value.toISOString() : String(value ?? ''))
        }
        rows.push(cells)
      })
    }
    demand(rows.length >= 2 && rows.length <= 401 && rows[0].length <= 50, 'Provide headers and 1–400 data rows, up to 50 columns.')
    demand(rows[0].every(h => h.trim()) && new Set(rows[0]).size === rows[0].length, 'Column headers must be nonempty and unique.')
    return { headers: rows[0], rows: rows.slice(1), fileName: filename.slice(0,255) }
  })
  route('validate', async req => {
    const { branchId, rows, headers, mapping, mode, overnight, fileName } = req.body
    const ownerId = await scope(req, branchId)
    demand(Array.isArray(rows) && rows.length > 0 && rows.length <= 400 && Array.isArray(headers) && headers.length <= 50, 'Invalid spreadsheet rows.')
    demand(['shift', 'punch'].includes(mode), 'Choose shift rows or punch events.')
    const configuration = (await db().collection('attendanceConfigurations').doc(ownerId).get()).data() || {}
    const fields = configuration.fields || []
    const people = await db().collection('users').where('branchId', '==', branchId).get()
    const users = people.docs.map(d => ({ ...d.data(), id: d.id }))
    const errors = [], review = [], valid = [], groups = new Map()
    for (const [index, cells] of rows.entries()) {
      try {
        demand(Array.isArray(cells) && cells.length <= 50, 'Invalid spreadsheet row.')
        const item = {}, custom = {}
        headers.forEach((header, i) => {
          const target = mapping?.[header], value = String(cells[i] ?? '').trim()
          if (!target) return
          if (target.startsWith('custom:')) {
            const field = fields.find(f => f.id === target.slice(7) && !f.archived)
            demand(field, 'Unknown custom field.')
            let converted = value
            if (value && field.type === 'number') converted = Number(value)
            if (value && field.type === 'boolean') { demand(/^(yes|no|true|false)$/i.test(value), `${field.label} requires Yes or No.`); converted = /^(yes|true)$/i.test(value) }
            custom[field.id] = converted
          } else item[target] = value
        })
        const matched = users.filter(u => item.employeeId ? u.id === item.employeeId : item.email && String(u.email || '').toLowerCase() === item.email.toLowerCase())
        demand(matched.length === 1, 'Employee ID/email did not match one employee in this branch.')
        const user = matched[0]
        const date = String(item.date || '').slice(0,10)
        const key = `${user.id}_${date}`
        const customFields = fieldValues(custom, fields)
        if (mode === 'punch') {
          demand(['in','out'].includes(String(item.direction).toLowerCase()), 'Punch direction must be in or out.')
          const group = groups.get(key) || { employeeId: user.id, employeeName: user.fullName || user.email || user.id, date, customFields, rows: [] }
          const property = item.direction.toLowerCase() === 'in' ? 'timeIn' : 'timeOut'
          if (group[property]) group.ambiguous = true
          group[property] = clock(item.time)
          group.rows.push(index + 2)
          groups.set(key, group)
        } else {
          demand(!groups.has(key), 'Duplicate employee/date within this file.')
          groups.set(key, { employeeId: user.id, employeeName: user.fullName || user.email || user.id, date, timeIn: item.timeIn, timeOut: item.timeOut, customFields, rows: [index + 2] })
        }
      } catch(e) { errors.push({ row: index + 2, reason: e.message }) }
    }
    for (const [key, group] of groups) {
      try {
        if (group.ambiguous || !group.timeIn || !group.timeOut) { review.push({ row: group.rows.join(', '), reason: 'Missing or ambiguous punches; correct the source file before importing.' }); continue }
        const times = punches(group.date, group.timeIn, group.timeOut, overnight === true)
        demand(!(await db().collection('attendance').doc(key).get()).exists, 'Attendance already exists; use an audited correction.')
        valid.push({ employeeId: group.employeeId, employeeName: group.employeeName, date: group.date, ...times, customFields: group.customFields, branchId, source: 'imported', attendanceMethod: 'import', locationVerified: false, revision: 0 })
      } catch(e) { errors.push({ row: group.rows.join(', '), reason: e.message }) }
    }
    const contentHash = crypto.createHash('sha256').update(JSON.stringify({ branchId, valid })).digest('hex')
    const ref = db().collection('attendanceImportPreviews').doc()
    await ref.set({ branchId, ownerId, importedBy: req.user.uid, sourceFileName: String(fileName || '').slice(0,255), valid, rejected: errors, review, contentHash, createdAt: stamp(), expiresAt: Date.now() + 1800000 })
    return { previewId: ref.id, validRows: valid.length, valid, rejectedRows: errors.length, rejected: errors, reviewRows: review.length, review }
  })
  route('commit', async req => {
    const previewId = String(req.body.previewId || '')
    demand(/^[a-zA-Z0-9]+$/.test(previewId), 'Validate the file first.')
    const previewRef = db().collection('attendanceImportPreviews').doc(previewId)
    const initial = (await previewRef.get()).data()
    demand(initial, 'Import preview not found.')
    await scope(req, initial.branchId)
    demand(initial.importedBy === req.user.uid, 'Only the uploader can confirm this preview.', 403)
    return db().runTransaction(async tx => {
      const preview = (await tx.get(previewRef)).data()
      const batchRef = db().collection('attendanceImports').doc(preview.contentHash)
      const prior = await tx.get(batchRef)
      if (prior.exists) return { batchId: prior.id, alreadyImported: true }
      demand(preview.expiresAt > Date.now(), 'Preview expired; validate again.')
      demand(preview.valid.length > 0, 'No valid records to import.')
      const refs = preview.valid.map(r => db().collection('attendance').doc(`${r.employeeId}_${r.date}`))
      const snapshots = await tx.getAll(...refs)
      demand(snapshots.every(s => !s.exists), 'Attendance changed after validation. Validate again; nothing was imported.', 409)
      preview.valid.forEach((record,i) => tx.create(refs[i], { ...record, importBatchId: batchRef.id, importedBy: req.user.uid, importedAt: stamp(), createdAt: stamp(), updatedAt: stamp() }))
      tx.create(batchRef, { branchId: preview.branchId, sourceFileName: preview.sourceFileName, importedBy: req.user.uid, validRows: preview.valid.length, rejectedRows: preview.rejected.length, reviewRows: preview.review.length, rejected: preview.rejected, review: preview.review, status: preview.rejected.length || preview.review.length ? 'Needs Review' : 'Completed', createdAt: stamp() })
      return { batchId: batchRef.id }
    })
  })
  route('history', async req => {
    await scope(req, req.body.branchId)
    const history = await db().collection('attendanceImports').where('branchId', '==', req.body.branchId).get()
    return { batches: history.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) }
  })
}
