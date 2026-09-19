import crypto from 'node:crypto'
import { demand, money, quantity, required, dateKey, day, quoteTotals, invoiceMatch, stockSignals, hasPermission, permissionsByKind, supplierCanRead, supplierProjection } from './supplyModel.js'

const docs = snapshot => snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
const cleanId = value => { const id = String(value || ''); demand(/^[A-Za-z0-9_-]{1,150}$/.test(id), 'Invalid record identifier.', 400); return id }
const names = { request: 'IR', procurement: 'PR', rfq: 'RFQ', quotation: 'QT', evaluation: 'EV', budget: 'BD', budgetRequest: 'BR', financeApproval: 'FA', budgetAllocation: 'BA', po: 'PO', supplierConfirmation: 'PC', receiving: 'RC', inspection: 'INSP', discrepancy: 'DS', invoice: 'INV', threeWayMatch: 'MT', payment: 'PAY' }
export const registerSupplyWorkflow = (app, { admin, requireAuth, loadUserContext, storageBucket }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const identity = async req => {
    const ctx = await loadUserContext(req.user.uid)
    const supplier = String(ctx.roleKey).toLowerCase() === 'supplier' || ctx.userData.userType === 'supplier'
    const owned = supplier ? docs(await db.collection('suppliers').where('ownerId', '==', ctx.uid).get()).concat(docs(await db.collection('suppliers').where('supplierUserId', '==', ctx.uid).get())) : []
    return { ...ctx, supplier, supplierIds: [...new Set(owned.filter(s => s.status === 'Active').map(s => s.id))] }
  }
  const branchAccess = async (ctx, branchId) => {
    cleanId(branchId)
    demand(!ctx.supplier, 'Staff access required.', 403)
    const clinic = (await db.collection('clinics').doc(branchId).get()).data()
    demand(clinic && (ctx.userData.branchId === branchId || clinic.ownerId === ctx.uid || clinic.branchAdminId === ctx.uid || branchId === ctx.uid), 'This branch is not assigned to your account.', 403)
  }
  const canRead = (ctx, r) => ctx.supplier ? supplierCanRead(r, ctx.supplierIds) : hasPermission(ctx, 'reports:view') || (permissionsByKind[r.kind] || []).some(p => hasPermission(ctx, p))
  const ensureRead = async (ctx, r) => { demand(r && canRead(ctx, r), 'Record not available to this account.', 403); if (!ctx.supplier) await branchAccess(ctx, r.branchId) }
  const wrap = handler => async (req, res) => { try { const ctx = await identity(req); ctx.auditContext = { ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 128), device: String(req.get?.('user-agent') || req.headers?.['user-agent'] || '').slice(0, 500) }; await handler(req, res, ctx) } catch (e) { res.status(e.status || 500).json({ success: false, error: e.status ? e.message : 'Supply operation failed. Please try again.' }) } }
  const supplierOwns = (ctx, r) => ctx.supplier && ctx.supplierIds.includes(r.supplierId)
  const allow = (ctx, permission) => demand(!ctx.supplier && hasPermission(ctx, permission), 'You do not have permission for this action.', 403)

  // Deterministic per-day IDs prevent repeated workspace refreshes from sending
  // the same alert twice. A deployment scheduler may invoke this endpoint too.
  app.post('/supply/reminders', requireAuth, wrap(async (req, res, ctx) => {
    const today = day(), branchId = String(req.body.branchId || ''), alerts = []
    let records = []
    if (ctx.supplier) {
      const found = new Map()
      for (const id of ctx.supplierIds) {
        for (const r of docs(await db.collection('supplyRecords').where('supplierIds', 'array-contains', id).get())) found.set(r.id, r)
        for (const r of docs(await db.collection('supplyRecords').where('supplierId', '==', id).get())) found.set(r.id, r)
      }
      records = [...found.values()].filter(r => canRead(ctx, r))
    } else {
      await branchAccess(ctx, branchId)
      records = docs(await db.collection('supplyRecords').where('branchId', '==', branchId).get()).filter(r => canRead(ctx, r))
      if (hasPermission(ctx, 'inventory:view')) for (const item of docs(await db.collection('inventoryItems').where('branchId', '==', branchId).get())) {
        const signals = stockSignals(item, today)
        if (signals.length) alerts.push({ id: item.id, branchId, message: `${item.name}: ${signals.join(', ')}`, link: '/inventory/items' })
      }
    }
    for (const r of records) {
      const due = r.kind === 'rfq' && ['Sent', 'Open', 'Quotation Received'].includes(r.status) ? r.deadline : r.kind === 'po' && ['Supplier Confirmed', 'Claimed by Logistics', 'Partially Received'].includes(r.status) ? r.deliveryDate : r.kind === 'invoice' && !['Paid'].includes(r.status) ? r.dueDate : null
      if (due && Date.parse(due) - Date.parse(today) <= 3 * 86400000) alerts.push({ id: r.id, branchId: r.branchId, message: `${r.number}: ${r.status}; due ${due}`, link: ctx.supplier ? (r.kind === 'rfq' ? '/supplier/supply/rfqs' : r.kind === 'po' ? '/supplier/supply/orders' : '/supplier/supply/invoices') : (r.kind === 'rfq' ? '/procurement/rfqs' : r.kind === 'po' ? '/logistics/items' : '/finance/procurement/invoices') })
    }
    await db.runTransaction(async tx => {
      const entries = alerts.slice(0, 100).map(a => ({ ...a, ref: db.collection('notifications').doc(`supply-${ctx.uid}-${a.id}-${today}`) }))
      const snapshots = await Promise.all(entries.map(a => tx.get(a.ref)))
      entries.forEach((a, i) => { if (!snapshots[i].exists) tx.set(a.ref, { recipientUserId: ctx.uid, branchId: a.branchId, title: 'Supply management reminder', message: a.message, link: a.link, read: false, deleted: false, createdAt: stamp() }) })
    })
    res.json({ success: true, data: { checked: alerts.length } })
  }))

  app.get('/supply/workspace', requireAuth, wrap(async (req, res, ctx) => {
    let branches = []
    if (!ctx.supplier) {
      const branchIds = new Set([ctx.userData.branchId].filter(Boolean))
      for (const field of ['ownerId', 'branchAdminId']) for (const clinic of docs(await db.collection('clinics').where(field, '==', ctx.uid).get())) branchIds.add(clinic.id)
      const own = await db.collection('clinics').doc(ctx.uid).get(); if (own.exists) branchIds.add(own.id)
      branches = await Promise.all([...branchIds].map(async id => { const c = (await db.collection('clinics').doc(id).get()).data() || {}; return { id, name: c.clinicBranch || c.clinicName || id } }))
    }
    const branchId = String(req.query.branchId || branches[0]?.id || '')
    if (!ctx.supplier && !branchId) return res.json({ success: true, data: { branches, records: [], items: [], suppliers: [], movements: [], permissions: [...ctx.permissions], supplier: false } })
    if (!ctx.supplier) await branchAccess(ctx, branchId)
    let records
    if (ctx.supplier) {
      const found = new Map()
      for (const id of ctx.supplierIds) {
        for (const r of docs(await db.collection('supplyRecords').where('supplierId', '==', id).get())) found.set(r.id, r)
        for (const r of docs(await db.collection('supplyRecords').where('supplierIds', 'array-contains', id).get())) found.set(r.id, r)
      }
      records = [...found.values()].filter(r => canRead(ctx, r)).map(supplierProjection)
    } else records = docs(await db.collection('supplyRecords').where('branchId', '==', branchId).get()).filter(r => canRead(ctx, r))
    const internal = !ctx.supplier
    const broadRead = internal && ['inventory:view', 'procurement:view', 'orders:view', 'finance:payables:view', 'reports:view'].some(p => hasPermission(ctx, p))
    const items = broadRead ? docs(await db.collection('inventoryItems').where('branchId', '==', branchId).get()).map(i => ({ ...i, signals: stockSignals(i), availableStock: Math.max(0, Number(i.currentStock || 0) - Number(i.reservedStock || 0)) })) : []
    const suppliers = broadRead ? docs(await db.collection('suppliers').where('branchId', '==', branchId).get()) : []
    const movements = internal && (hasPermission(ctx, 'inventory:view') || hasPermission(ctx, 'reports:view')) ? docs(await db.collection('inventoryMovements').where('branchId', '==', branchId).get()) : []
    const snapshots = internal && (hasPermission(ctx, 'inventory:view') || hasPermission(ctx, 'reports:view')) ? docs(await db.collection('supplySnapshots').where('branchId', '==', branchId).get()) : []
    res.json({ success: true, data: { branchId, branches, records, items, suppliers, movements, snapshots, permissions: [...ctx.permissions], supplier: ctx.supplier, supplierIds: ctx.supplierIds, uid: ctx.uid } })
  }))

  app.post('/supply/items', requireAuth, wrap(async (req, res, ctx) => {
    allow(ctx, 'inventory:create'); const input = req.body, branchId = cleanId(input.branchId); await branchAccess(ctx, branchId)
    const ref = db.collection('inventoryItems').doc(input.id ? cleanId(input.id) : crypto.randomUUID())
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref), old = existing.data() || {}
      demand(!existing.exists || old.branchId === branchId, 'Item belongs to another branch.', 403)
      const supplierId = String(input.supplierId || old.supplierId || '')
      const catalogItemId = String(input.supplierCatalogItemId || old.supplierCatalogItemId || '')
      const supplierSnap = supplierId ? await tx.get(db.collection('suppliers').doc(cleanId(supplierId))) : null
      const supplier = supplierSnap?.data()
      const catalogItem = Array.isArray(supplier?.offeredItems) ? supplier.offeredItems.find(product => String(product.id) === catalogItemId) : null
      if (!existing.exists) demand(supplier && supplier.branchId === branchId && supplier.status === 'Active' && catalogItem, 'Choose an active supplier and an item from that supplier\'s catalog.', 400)
      if (catalogItem) demand(supplier.branchId === branchId && supplier.status === 'Active', 'The selected supplier is not active for this branch.', 400)
      const currentStock = quantity(input.currentStock, true), minStock = quantity(input.minStock, true), targetStock = quantity(input.targetStock, true), maxStock = quantity(input.maxStock, true)
      demand(targetStock >= minStock && maxStock >= targetStock, 'Maximum stock must be at least target stock, and target must be at least the restocking threshold.', 400)
      demand(currentStock >= Number(old.reservedStock || 0), 'Stock cannot fall below reserved quantity.')
      const reason = required(input.adjustmentReason, 'Stock/edit reason')
      const data = { branchId, name: required(catalogItem?.name || catalogItem?.itemName || catalogItem?.productName || old.name || input.name, 'Catalog item name'), currentStock, reservedStock: Number(old.reservedStock || 0), minStock, targetStock, maxStock, updatedAt: stamp(), ...(!existing.exists ? { createdAt: stamp() } : {}) }
      for (const key of ['location', 'condition', 'serialNumber', 'modelNumber', 'warranty']) data[key] = String(input[key] || '').slice(0, 4000)
      if (catalogItem) {
        data.supplierId = supplierId; data.supplierCatalogItemId = catalogItemId
        data.category = String(catalogItem.category || catalogItem.categoryGroup || catalogItem.customCategory || '').slice(0, 4000)
        data.description = String(catalogItem.description || catalogItem.specifications || '').slice(0, 4000)
        data.unit = String(catalogItem.measurementUnit || catalogItem.unit || 'units').slice(0, 4000)
        data.imageUrl = String(catalogItem.imageUrl || '').slice(0, 4000)
        data.costPrice = money(catalogItem.price || catalogItem.unitCost || 0) / 100
      } else {
        for (const key of ['brand', 'description', 'category', 'unit', 'imageUrl', 'supplierId', 'supplierCatalogItemId']) data[key] = String(old[key] || '').slice(0, 4000)
        data.costPrice = Number(old.costPrice || 0)
      }
      demand(!data.imageUrl || /^https:\/\//.test(data.imageUrl), 'Images must use an HTTPS URL.', 400)
      demand(['Material', 'Equipment'].includes(input.itemType), 'Choose Material or Equipment.', 400)
      data.itemType = input.itemType; data.consumability = input.consumability === 'Non-consumable' ? 'Non-consumable' : 'Consumable'
      data.manufacturingDate = input.manufacturingDate ? dateKey(input.manufacturingDate) : ''
      data.expiryDate = input.expiryDate ? dateKey(input.expiryDate) : ''
      tx.set(ref, data, { merge: true })
      tx.set(db.collection('inventoryMovements').doc(), { branchId, inventoryItemId: ref.id, type: existing.exists ? 'adjustment' : 'opening_stock', quantity: currentStock - Number(old.currentStock || 0), reason, createdBy: ctx.uid, createdAt: stamp() })
      tx.set(db.collection('supplyAudit').doc(), { recordId: ref.id, branchId, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: 'inventory', action: 'inventory-edit', before: old, after: data, reason, ...ctx.auditContext, createdAt: stamp() })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))

  app.post('/supply/suppliers', requireAuth, wrap(async (req, res, ctx) => {
    allow(ctx, 'suppliers:create'); const input = req.body, branchId = cleanId(input.branchId); await branchAccess(ctx, branchId)
    const ref = db.collection('suppliers').doc(), data = { branchId, name: required(input.name, 'Company name'), businessName: required(input.name, 'Company name'), contactPerson: required(input.contactPerson, 'Contact person'), email: String(input.email || ''), phone: String(input.phone || ''), address: String(input.address || ''), category: String(input.category || ''), registrationNumber: String(input.registrationNumber || ''), status: 'Pending Accreditation', accreditationStatus: 'Pending Accreditation', procurementAccess: 'Manual', offeredItems: [], createdBy: ctx.uid, createdAt: stamp() }
    await db.runTransaction(async tx => {
      tx.set(ref, data)
      tx.set(db.collection('supplyAudit').doc(), { branchId, recordId: ref.id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: 'supplier', action: 'manual-supplier-created', after: data, ...ctx.auditContext, createdAt: stamp() })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))

  // Read the branch's workflow records inside each transaction. Stage writes so all
  // validation and reads happen before Firestore writes, including notifications.
  app.post('/supply/records', requireAuth, wrap(async (req, res, ctx) => {
    const input = req.body || {}, branchId = cleanId(input.branchId)
    if (!ctx.supplier) await branchAccess(ctx, branchId)
    const result = await mutate(ctx, branchId, input, null)
    res.json({ success: true, data: result })
  }))
  app.post('/supply/records/:id/actions', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), r = (await db.collection('supplyRecords').doc(id).get()).data()
    await ensureRead(ctx, r)
    res.json({ success: true, data: await mutate(ctx, r.branchId, req.body || {}, id) })
  }))

  const mutate = async (ctx, branchId, input, targetId) => db.runTransaction(async tx => {
    const [recordSnap, itemSnap, supplierSnap, staffSnap, documentSnap, lotSnap] = await Promise.all([
      tx.get(db.collection('supplyRecords').where('branchId', '==', branchId)), tx.get(db.collection('inventoryItems').where('branchId', '==', branchId)),
      tx.get(db.collection('suppliers').where('branchId', '==', branchId)), tx.get(db.collection('users').where('branchId', '==', branchId)), tx.get(db.collection('supplyDocuments').where('branchId', '==', branchId)),
      tx.get(db.collection('supplyLots').where('branchId', '==', branchId)),
    ])
    const records = docs(recordSnap), items = docs(itemSnap), suppliers = docs(supplierSnap), documents = docs(documentSnap)
    const writes = [], now = stamp()
    const get = (id, kind) => { const r = records.find(r => r.id === id && r.kind === kind); demand(r, `${kind} record not found.`, 404); return r }
    const set = (r, patch) => { writes.push([db.collection('supplyRecords').doc(r.id), patch, true]); return { ...r, ...patch } }
    const create = (kind, data, id = crypto.randomUUID()) => {
      demand(!records.some(r => r.id === id), 'This linked record already exists.')
      const record = { id, kind, number: `${names[kind]}-${day().replaceAll('-', '')}-${id.slice(0, 8).toUpperCase()}`, branchId, createdBy: ctx.uid, createdAt: now, updatedAt: now, links: [], ...data }
      writes.push([db.collection('supplyRecords').doc(id), record, false]); return record
    }
    const evidence = (r, message) => demand(documents.some(d => d.recordId === r.id), message || 'Upload supporting documents before continuing.')
    const supplier = id => { const s = suppliers.find(s => s.id === id); demand(s && s.status === 'Active', 'Select an active supplier assigned to this branch.'); return s }
    const supplierCanProvideLine = (s, line) => (Array.isArray(s.offeredItems) ? s.offeredItems : []).some(product => {
      const catalogMatch = s.id === line.supplierId && String(product.id || '') === String(line.supplierCatalogItemId || '')
      const nameMatch = String(product.name || product.itemName || product.productName || '').trim().toLowerCase() === String(line.name || '').trim().toLowerCase()
      const productCategory = String(product.category || product.categoryGroup || product.customCategory || '').trim().toLowerCase()
      const categoryMatch = !line.category || productCategory === String(line.category).trim().toLowerCase()
      return catalogMatch || nameMatch && categoryMatch
    })
    const supplierCatalogIndexForLine = (items, line) => items.findIndex(product => {
      const catalogMatch = String(product.id || '') === String(line.supplierCatalogItemId || '')
      const nameMatch = String(product.name || product.itemName || product.productName || '').trim().toLowerCase() === String(line.name || '').trim().toLowerCase()
      const productCategory = String(product.category || product.categoryGroup || product.customCategory || '').trim().toLowerCase()
      const categoryMatch = !line.category || productCategory === String(line.category).trim().toLowerCase()
      return catalogMatch || nameMatch && categoryMatch
    })
    const manualOrSupplier = (r, permission = 'procurement:create') => { if (ctx.supplier) demand(r.mode === 'Online' && supplierOwns(ctx, r), 'This record belongs to another supplier.', 403); else { allow(ctx, permission); demand(r.mode === 'Manual', 'The supplier must perform this action through their portal.'); } }
    const record = targetId ? records.find(r => r.id === targetId) : null
    let result, action = String(input.action || 'create'), before = record?.status || ''
    if (!targetId) {
      switch (input.kind) {
        case 'request': {
          allow(ctx, 'inventory:create')
          const suppliedLines = Array.isArray(input.lines) && input.lines.length ? input.lines : [input]
          demand(suppliedLines.length <= 50, 'A request can include up to 50 items.', 400)
          const seenProducts = new Set()
          const lines = suppliedLines.map(raw => {
            const supplierId = cleanId(raw.supplierId), sourceSupplier = supplier(supplierId), catalogItemId = String(raw.supplierCatalogItemId || ''), product = (sourceSupplier.offeredItems || []).find(entry => String(entry.id) === catalogItemId)
            demand(product, 'Select a supply from an active supplier catalog.', 400)
            demand(!seenProducts.has(`${supplierId}:${catalogItemId}`), 'Duplicate supplier catalog items are not allowed.', 400); seenProducts.add(`${supplierId}:${catalogItemId}`)
            const minStock = quantity(raw.minStock || 0, true), targetStock = quantity(raw.targetStock || minStock, true), maxStock = quantity(raw.maxStock || targetStock, true)
            demand(targetStock >= minStock && maxStock >= targetStock, 'Maximum stock must be at least target stock, and target stock must be at least the restocking threshold.', 400)
            const existingItem = items.find(item => item.supplierId === supplierId && String(item.supplierCatalogItemId || '') === catalogItemId)
            const unitPrice = money(product.price || product.unitCost || 0), requestedQuantity = quantity(raw.quantity), availableUnits = Math.max(0, quantity(product.quantity || 0, true) - quantity(product.reservedQuantity || 0, true))
            demand(requestedQuantity <= availableUnits, `Requested quantity cannot exceed the supplier's ${availableUnits} available unit(s).`, 400)
            return { itemId: existingItem?.id || crypto.randomUUID(), initialInventory: !existingItem, name: required(product.name || product.itemName || product.productName, 'Catalog item name'), category: String(product.category || product.categoryGroup || product.customCategory || ''), supplierId, preferredSupplierId: supplierId, supplierCatalogItemId: catalogItemId, quantity: requestedQuantity, unit: String(product.measurementUnit || product.unit || 'units'), specifications: String(product.description || product.specifications || ''), packaging: String(product.measurementValue || ''), manufacturingDate: product.manufacturingDate ? dateKey(product.manufacturingDate) : '', expiryDate: product.expiryDate ? dateKey(product.expiryDate) : '', unitPrice, subtotal: requestedQuantity * unitPrice, currentStock: Number(existingItem?.currentStock || 0), minStock, targetStock, maxStock, location: String(raw.location || input.location || '') }
          })
          const estimatedCost = lines.reduce((sum, line) => sum + line.subtotal, 0)
          result = create('request', { status: 'Sent to Procurement', supplierId: lines.length === 1 ? lines[0].supplierId : '', itemId: lines.length === 1 ? lines[0].itemId : '', lines, department: required(input.department, 'Department'), reason: required(input.reason, 'Reason'), notes: String(input.notes || ''), priority: input.priority || 'Normal', requiredDate: dateKey(input.requiredDate), estimatedCost, submittedBy: ctx.uid, submittedAt: now })
          const procurement = create('procurement', { status: 'Received', requestId: result.id, requesterId: ctx.uid, lines, department: result.department, requiredDate: result.requiredDate, reason: result.reason, priority: result.priority, estimatedProcurementValue: estimatedCost, links: [result.id] }, `proc-${result.id}`)
          set(result, { procurementId: procurement.id })
          break
        }
        case 'budget': allow(ctx, 'finance:payables:approve'); result = create('budget', { status: 'Active', department: required(input.department, 'Department'), category: required(input.category, 'Category'), total: money(input.total), committed: 0, spent: 0 }); break
        case 'rfq': {
          allow(ctx, 'procurement:create'); const p = get(input.procurementId, 'procurement'); demand(['Received', 'Verified'].includes(p.status) && !p.rfqId, 'This procurement already has an active sourcing process.')
          demand(['Manual', 'Online'].includes(input.mode), 'Choose a procurement mode.', 400)
          const supplierIds = [...new Set(input.supplierIds || [])]; demand(supplierIds.length > 0 && supplierIds.length <= 20, 'Select 1–20 suppliers.'); supplierIds.forEach(id => { const selectedSupplier = supplier(id); demand(p.lines.every(line => supplierCanProvideLine(selectedSupplier, line)), 'Each invited supplier must offer every requested supply in its catalog.', 400) })
          if (input.mode === 'Online') demand(supplierIds.every(id => { const s = supplier(id); return s.ownerId || s.supplierUserId }), 'Online procurement requires suppliers with activated portal accounts.')
          const deadline = dateKey(input.deadline); demand(deadline >= day(), 'Quotation deadline cannot be in the past.')
          result = create('rfq', { status: 'Draft', mode: input.mode, procurementId: p.id, links: [...p.links, p.id], lines: p.lines, supplierIds, deadline, deliveryDate: dateKey(input.deliveryDate), deliveryLocation: required(input.deliveryLocation, 'Delivery location'), terms: required(input.terms, 'RFQ terms'), conditions: String(input.conditions || ''), contact: required(input.contact, 'Contact'), department: p.department })
          set(p, { status: 'RFQ Preparation', mode: input.mode, rfqId: result.id, officer: ctx.uid, method: String(input.method || ''), strategy: String(input.strategy || '') }); break
        }
        case 'quotation': {
          const r = get(input.rfqId, 'rfq'); const supplierId = cleanId(input.supplierId); supplier(supplierId)
          demand(r.supplierIds.includes(supplierId), 'Supplier is not invited to this RFQ.', 403)
          manualOrSupplier({ ...r, supplierId }); demand(['Open', 'Quotation Received'].includes(r.status) && r.deadline >= day(), 'RFQ is closed or its deadline has passed.')
          demand(!records.some(q => q.kind === 'quotation' && q.rfqId === r.id && q.supplierId === supplierId), 'Edit the existing quotation instead.')
          const totals = quoteTotals(input); validateQuoteLines(r, totals)
          totals.lines = totals.lines.map(line => ({ ...r.lines.find(source => source.itemId === line.itemId), ...line }))
          result = create('quotation', { ...totals, status: 'Submitted', mode: r.mode, supplierId, rfqId: r.id, procurementId: r.procurementId, links: [r.id], validUntil: dateKey(input.validUntil), leadDays: quantity(input.leadDays, true), paymentTerms: required(input.paymentTerms, 'Payment terms'), warranty: String(input.warranty || ''), notes: String(input.notes || '') })
          set(r, { status: 'Quotation Received', quotationReceivedAt: now }); set(get(r.procurementId, 'procurement'), { status: 'Quotations Received' }); break
        }
        case 'receiving': {
          allow(ctx, 'orders:update'); const po = get(input.poId, 'po'); demand(['Claimed by Logistics', 'Partially Received'].includes(po.status), 'Logistics must claim the supplier-confirmed PO before receiving.')
          const lines = (input.lines || []).map(line => {
            const ordered = po.lines.find(l => l.itemId === line.itemId); demand(ordered, 'Item is not on this PO.')
            const delivered = quantity(line.delivered, true), accepted = quantity(line.accepted, true), rejected = quantity(line.rejected, true)
            demand(delivered === accepted + rejected, 'Accepted plus rejected must equal delivered.')
            const pending = records.filter(r => r.kind === 'receiving' && r.poId === po.id && r.status === 'Inspected').reduce((sum, r) => sum + (r.lines.find(l => l.itemId === line.itemId)?.accepted || 0), 0)
            demand(accepted + pending + Number(po.accepted?.[line.itemId] || 0) <= ordered.quantity, 'Accepted quantity exceeds the outstanding PO quantity.')
            const expiryDate = line.expiryDate ? dateKey(line.expiryDate) : ''
            demand(!accepted || ((!expiryDate || expiryDate >= day()) && (line.condition || 'Good') === 'Good'), 'Only goods inspected as Good can be accepted into inventory.')
            if (rejected) required(line.reason, 'Rejection reason')
            const manufacturingDate = line.manufacturingDate ? dateKey(line.manufacturingDate) : ''
            demand(!manufacturingDate || !expiryDate || manufacturingDate <= expiryDate, 'Expiry date cannot be earlier than the manufacturing date.')
            return { itemId: ordered.itemId, name: ordered.name, category: ordered.category || '', supplierCatalogItemId: ordered.supplierCatalogItemId || '', ordered: ordered.quantity, delivered, accepted, rejected, condition: String(line.condition || 'Good'), reason: String(line.reason || ''), manufacturingDate, expiryDate, lot: String(line.lot || ''), serialNumber: String(line.serialNumber || ''), modelNumber: String(line.modelNumber || ''), warranty: String(line.warranty || ''), packaging: String(line.packaging || '') }
          })
          demand(lines.length && new Set(lines.map(l => l.itemId)).size === lines.length && lines.some(l => l.delivered > 0), 'Enter unique delivered items.')
          result = create('receiving', { status: 'Inspected', poId: po.id, supplierId: po.supplierId, links: [...po.links, po.id], lines, reference: required(input.reference, 'Delivery reference'), deliveryDate: dateKey(input.deliveryDate), receivedBy: ctx.uid, notes: String(input.notes || '') })
          const inspection = create('inspection', { status: 'Completed', poId: po.id, receivingId: result.id, supplierId: po.supplierId, links: [...result.links, result.id], lines, quantityResult: lines.some(l => l.delivered !== l.ordered) ? 'Discrepancy' : 'Verified', qualityResult: lines.some(l => l.rejected > 0) ? 'Discrepancy' : 'Accepted', inspectedBy: ctx.uid, inspectedAt: now }, `inspection-${result.id}`)
          set(result, { inspectionId: inspection.id })
          if (lines.some(l => l.rejected > 0)) create('discrepancy', { status: 'Open', poId: po.id, receivingId: result.id, supplierId: po.supplierId, links: [po.id, result.id], lines: lines.filter(l => l.rejected), reason: 'Rejected delivery items require resolution' })
          break
        }
        case 'invoice': {
          const po = get(input.poId, 'po'); manualOrSupplier(po, 'finance:payables:approve'); demand(['Partially Received', 'Delivered'].includes(po.status), 'Receive and onboard goods before invoicing.')
          const invoiceNumber = required(input.invoiceNumber, 'Invoice number'); demand(!records.some(r => r.kind === 'invoice' && r.supplierId === po.supplierId && r.invoiceNumber === invoiceNumber), 'This supplier invoice number already exists.')
          const receiving = records.filter(r => r.kind === 'receiving' && r.poId === po.id && r.status === 'Onboarded')
          result = create('invoice', { ...quoteTotals(input), mode: po.mode, status: 'Submitted', poId: po.id, supplierId: po.supplierId, invoiceNumber, invoiceDate: dateKey(input.invoiceDate), dueDate: dateKey(input.dueDate), links: [...new Set([...po.links, po.id, ...receiving.flatMap(record => [record.id, record.inspectionId].filter(Boolean))])], receivingIds: receiving.map(record => record.id) }); break
        }
        default: demand(false, 'Unsupported record type.', 400)
      }
    } else {
      demand(record, 'Record not found.', 404); demand(canRead(ctx, record), 'Access denied.', 403)
      const r = record
      if (r.kind === 'request') {
        if (action === 'resubmit') {
          allow(ctx, 'inventory:create'); demand(r.createdBy === ctx.uid && r.status === 'Returned', 'Only the original requester can resubmit a returned request.', 403)
          const procurement = get(r.procurementId, 'procurement')
          result = set(r, { status: 'Sent to Procurement', resubmittedAt: now, resubmissionResponse: required(input.remarks, 'Response to Procurement') })
          set(procurement, { status: 'Received', returnedAt: '', returnReason: '', returnInstructions: '', returnedItemId: '', resubmittedAt: now })
        } else demand(false, 'Inventory requests are sent directly to Procurement when created.')
      } else if (r.kind === 'procurement') {
        allow(ctx, 'procurement:review')
        if (['confirm', 'verifyRequest'].includes(action)) {
          demand(r.status === 'Received', 'Only newly received requests can be confirmed.')
          demand(input.productsCorrect && input.quantitiesVerified && input.availabilityConfirmed && input.pricesVerified, 'Complete every procurement checklist item before confirming.', 400)
          const supplierIds = [...new Set(r.lines.map(line => line.supplierId))]
          demand(supplierIds.length === 1, 'A budget request must contain products from one supplier. Return the request to Inventory to revise it.', 400)
          demand(!r.budgetRequestId, 'A budget request has already been created for this procurement request.')
          const supplierId = supplierIds[0], requestedAmount = Number(r.estimatedProcurementValue || 0)
          const budgetRequest = create('budgetRequest', { status: 'Submitted', supplierId, procurementId: r.id, requestedAmount, recommendedAmount: requestedAmount, department: r.department, category: String(r.lines[0]?.category || 'Procurement'), lines: r.lines, deliveryDate: r.requiredDate, deliveryLocation: String(r.lines[0]?.location || ''), terms: 'Per approved inventory request', links: [...r.links, r.id] })
          result = set(r, { status: 'For Finance Approval', supplierId, verifiedBy: ctx.uid, verifiedAt: now, budgetRequestId: budgetRequest.id, checklist: { productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true } })
        } else if (action === 'return') {
          demand(r.status === 'Received', 'Only newly received requests can be returned.')
          const reason = required(input.returnReason, 'Reason for return'), instructions = required(input.instructions, 'Revision instructions')
          const request = get(r.requestId, 'request')
          result = set(r, { status: 'Returned to Inventory', returnReason: reason, returnInstructions: instructions, returnedItemId: String(input.itemId || ''), returnedBy: ctx.uid, returnedAt: now })
          set(request, { status: 'Returned', returnReason: reason, returnInstructions: instructions, returnedItemId: String(input.itemId || ''), returnedBy: ctx.uid, returnedAt: now })
        } else if (action === 'resource') {
          demand(!records.some(p => p.kind === 'po' && p.procurementId === r.id && p.status !== 'Cancelled'), 'Cancel the funded purchase order before re-sourcing.')
          demand(r.status !== 'Completed', 'Completed procurement cannot be re-sourced.')
          const reason = required(input.remarks, 'Re-sourcing reason')
          records.filter(x => x.procurementId === r.id && ['rfq', 'budgetRequest'].includes(x.kind) && !['Cancelled', 'Rejected'].includes(x.status)).forEach(x => set(x, { status: 'Cancelled', cancellationReason: reason }))
          result = set(r, { status: 'Received', rfqId: '', evaluationId: '', budgetRequestId: '', revisionReason: reason, officer: ctx.uid })
        } else demand(false, 'Invalid procurement action.')
      } else if (r.kind === 'rfq') {
        allow(ctx, 'procurement:review')
        if (action === 'editRfq') { demand(r.status === 'Draft', 'Issued RFQs cannot be silently changed. Cancel and re-source instead.'); const deadline = dateKey(input.deadline); demand(deadline >= day(), 'Deadline cannot be in the past.'); result = set(r, { deadline, deliveryDate: dateKey(input.deliveryDate), deliveryLocation: required(input.deliveryLocation, 'Delivery location'), terms: required(input.terms, 'Terms'), conditions: String(input.conditions || ''), contact: required(input.contact, 'Contact') }) }
        else if (action === 'cancel') { demand(['Draft', 'Sent', 'Open', 'Quotation Received', 'Closed', 'Under Evaluation'].includes(r.status), 'An awarded RFQ must be handled through procurement re-sourcing.'); result = set(r, { status: 'Cancelled', remarks: required(input.remarks, 'Cancellation reason') }); set(get(r.procurementId, 'procurement'), { status: 'Received', rfqId: '' }) }
        else if (action === 'send') { demand(r.status === 'Draft', 'RFQ is already issued.'); if (r.mode === 'Manual') evidence(r, 'Upload the manual RFQ first.'); demand(r.deadline >= day(), 'Update the expired RFQ deadline.'); result = set(r, { status: 'Open', sentAt: now, openedAt: now }); set(get(r.procurementId, 'procurement'), { status: 'RFQ Sent' }) }
        else demand(false, 'Invalid RFQ action.')
      } else if (r.kind === 'quotation' && action === 'revise') {
        const rfq = get(r.rfqId, 'rfq'); manualOrSupplier(r); demand(r.status === 'Submitted' && ['Open', 'Quotation Received'].includes(rfq.status) && rfq.deadline >= day(), 'Quotation editing is closed.')
        const totals = quoteTotals(input); validateQuoteLines(rfq, totals); result = set(r, { ...totals, validUntil: dateKey(input.validUntil), leadDays: quantity(input.leadDays, true), paymentTerms: required(input.paymentTerms, 'Payment terms'), warranty: String(input.warranty || ''), notes: String(input.notes || '') })
      } else if (r.kind === 'quotation' && action === 'select') {
        allow(ctx, 'procurement:review'); const rfq = get(r.rfqId, 'rfq'), p = get(rfq.procurementId, 'procurement')
        demand(r.status === 'Submitted' && ['Open', 'Quotation Received'].includes(rfq.status) && !p.evaluationId, 'This quotation is no longer available for selection.'); demand(r.validUntil >= day(), 'Quotation has expired.')
        if (r.mode === 'Manual') evidence(r, 'Upload the supplier quotation first.')
        const justification = required(input.justification, 'Selection justification')
        const ev = create('evaluation', { status: 'Supplier Selected', quotationId: r.id, supplierId: r.supplierId, rfqId: rfq.id, procurementId: p.id, recommendation: String(input.recommendation || justification), justification, evaluatorId: ctx.uid, evaluatedAt: now, links: [...p.links, p.id, rfq.id, r.id] })
        const br = create('budgetRequest', { status: 'Submitted', quotationId: r.id, supplierId: r.supplierId, procurementId: p.id, evaluationId: ev.id, requestedAmount: r.total, recommendedAmount: r.total, department: p.department, category: required(input.category, 'Budget category'), links: [...ev.links, ev.id] })
        result = set(r, { status: 'Selected' }); set(rfq, { status: 'Awarded' }); set(p, { status: 'For Finance Approval', evaluationId: ev.id, budgetRequestId: br.id }); records.filter(q => q.kind === 'quotation' && q.rfqId === rfq.id && q.id !== r.id).forEach(q => set(q, { status: 'Not Selected' }))
      } else if (r.kind === 'budgetRequest') {
        if (action === 'resubmit') { allow(ctx, 'procurement:review'); demand(['Returned', 'Rejected'].includes(r.status), 'This request cannot be resubmitted.'); result = set(r, { status: 'Submitted', revision: required(input.remarks, 'Revision details') }) }
        else { allow(ctx, 'finance:payables:approve'); demand(r.createdBy !== ctx.uid, 'Finance approval must be performed by another user.'); demand(r.status === 'Submitted', 'Budget request is not awaiting a decision.')
          if (action === 'approve') {
            const budget = get(input.budgetId, 'budget'); demand(budget.department === r.department && budget.category === r.category, 'Budget department/category must match the request.')
            const approvedAmount = money(input.approvedAmount); demand(approvedAmount >= r.requestedAmount && approvedAmount <= budget.total - budget.committed - budget.spent, 'Insufficient available budget, or approved amount is below the quotation.')
            set(budget, { committed: budget.committed + approvedAmount })
            const remarks = required(input.remarks, 'Approval remarks')
            const approval = create('financeApproval', { status: 'Approved', budgetRequestId: r.id, budgetId: budget.id, approvedAmount, decision: 'Approved', remarks, financeOfficerId: ctx.uid, decidedAt: now, links: [...r.links, r.id] }, `approval-${r.id}`)
            const allocation = create('budgetAllocation', { status: 'Committed', budgetRequestId: r.id, financeApprovalId: approval.id, budgetId: budget.id, amount: approvedAmount, releasedAmount: 0, allocatedBy: ctx.uid, allocatedAt: now, links: [...approval.links, approval.id] }, `allocation-${r.id}`)
            result = set(r, { status: 'Approved', budgetId: budget.id, approvedAmount, approvedBy: ctx.uid, approvedAt: now, remarks, financeApprovalId: approval.id, budgetAllocationId: allocation.id })
            create('po', { lines: r.lines, subtotal: r.requestedAmount, tax: 0, delivery: 0, otherCharges: 0, discount: 0, total: r.requestedAmount, mode: 'Online', supplierId: r.supplierId, paymentTerms: 'Per supplier terms', warranty: '', status: 'Approved', budgetId: budget.id, budgetRequestId: r.id, financeApprovalId: approval.id, budgetAllocationId: allocation.id, procurementId: r.procurementId, links: [...allocation.links, allocation.id], committedAmount: approvedAmount, paidAmount: 0, accepted: {}, deliveryDate: r.deliveryDate, deliveryLocation: r.deliveryLocation, terms: r.terms }, `po-${r.id}`)
          } else { demand(['reject', 'return'].includes(action), 'Invalid action.'); result = set(r, { status: action === 'reject' ? 'Rejected' : 'Returned', remarks: required(input.remarks, 'Decision reason'), reviewedBy: ctx.uid, reviewedAt: now }) }
        }
      } else if (r.kind === 'po') {
        if (action === 'issue') { allow(ctx, 'procurement:review'); demand(r.status === 'Approved', 'Finance approval is required before issuing the PO.'); if (r.mode === 'Manual') evidence(r, 'Upload the manual PO first.'); result = set(r, { status: 'Sent to Supplier', issuedBy: ctx.uid, issuedAt: now }); set(get(r.procurementId, 'procurement'), { status: 'Ordered' }) }
        else if (['confirm', 'decline', 'clarify'].includes(action)) { manualOrSupplier(r, 'procurement:review'); demand(r.status === 'Sent to Supplier', 'PO is not awaiting supplier confirmation.'); const response = action === 'confirm' ? 'Accepted' : action === 'decline' ? 'Rejected' : 'Clarification Requested'; const reason = required(input.remarks, 'Supplier response'), confirmationId = `confirmation-${r.id}`, oldConfirmation = records.find(x => x.id === confirmationId && x.kind === 'supplierConfirmation'), confirmationData = { status: response, poId: r.id, supplierId: r.supplierId, response, reason, confirmedDeliveryDate: action === 'confirm' ? dateKey(input.deliveryDate) : r.deliveryDate, respondedBy: ctx.uid, respondedAt: now, links: [...r.links, r.id] }
          if (action === 'confirm') {
            const stockSupplier = supplier(r.supplierId), catalog = [...(stockSupplier.offeredItems || [])]
            for (const line of r.lines) {
              const index = supplierCatalogIndexForLine(catalog, line); demand(index >= 0, `The supplier catalog no longer contains ${line.name}.`)
              const product = catalog[index], onHand = quantity(product.quantity, true), reserved = quantity(product.reservedQuantity || 0, true)
              demand(onHand - reserved >= line.quantity, `Insufficient available supplier stock for ${line.name}.`)
              catalog[index] = { ...product, reservedQuantity: reserved + line.quantity, lastReservedAt: now, lastReservedPoId: r.id }
            }
            writes.push([db.collection('suppliers').doc(stockSupplier.id), { offeredItems: catalog, catalogStockUpdatedAt: now }, true])
          }
          const confirmation = oldConfirmation ? set(oldConfirmation, confirmationData) : create('supplierConfirmation', confirmationData, confirmationId); result = set(r, { status: action === 'confirm' ? 'Supplier Confirmed' : action === 'decline' ? 'Rejected' : 'Clarification Requested', supplierConfirmationId: confirmation.id, confirmationReason: reason, deliveryDate: confirmation.confirmedDeliveryDate, confirmedBy: ctx.uid, confirmedAt: now }) }
        else if (action === 'claimOrder') { allow(ctx, 'orders:update'); demand(r.status === 'Supplier Confirmed', 'Only a supplier-confirmed PO can be claimed by Logistics.'); result = set(r, { status: 'Claimed by Logistics', claimedBy: ctx.uid, claimedAt: now }) }
        else if (action === 'resend') { allow(ctx, 'procurement:review'); demand(['Rejected', 'Clarification Requested'].includes(r.status), 'PO is not awaiting clarification.'); result = set(r, { status: 'Sent to Supplier', clarification: required(input.remarks, 'Clarification response') }) }
        else if (action === 'cancel') { allow(ctx, 'procurement:review'); demand(!['Cancelled', 'Completed'].includes(r.status) && !records.some(x => x.poId === r.id && ['receiving', 'invoice', 'payment'].includes(x.kind)), 'Received or invoiced orders cannot be cancelled here.'); const budget = get(r.budgetId, 'budget'); set(budget, { committed: budget.committed - r.committedAmount }); if (r.budgetAllocationId) set(get(r.budgetAllocationId, 'budgetAllocation'), { status: 'Released', releasedAmount: r.committedAmount, releasedBy: ctx.uid, releasedAt: now });
          if (['Supplier Confirmed', 'Claimed by Logistics'].includes(r.status)) {
            const stockSupplier = supplier(r.supplierId), catalog = [...(stockSupplier.offeredItems || [])]
            for (const line of r.lines) { const index = supplierCatalogIndexForLine(catalog, line); if (index >= 0) { const product = catalog[index], reserved = quantity(product.reservedQuantity, true); catalog[index] = { ...product, reservedQuantity: Math.max(0, reserved - line.quantity), lastReleasedAt: now, lastReleasedPoId: r.id } } }
            writes.push([db.collection('suppliers').doc(stockSupplier.id), { offeredItems: catalog, catalogStockUpdatedAt: now }, true])
          }
          result = set(r, { status: 'Cancelled', committedAmount: 0, remarks: required(input.remarks, 'Cancellation reason') }); set(get(r.procurementId, 'procurement'), { status: 'Cancelled' }) }
        else demand(false, 'Invalid PO action.')
      } else if (r.kind === 'receiving' && action === 'onboard') {
        allow(ctx, 'orders:update'); if (r.status === 'Onboarded') return { id: r.id, alreadyRecorded: true }
        demand(r.status === 'Inspected', 'Inspection is required.'); const po = get(r.poId, 'po'); const accepted = { ...po.accepted }
        const stockSupplier = supplier(po.supplierId), catalog = [...(stockSupplier.offeredItems || [])]
        for (const line of r.lines) {
          if (!line.accepted) continue
          let item = items.find(i => i.id === line.itemId)
          const ordered = po.lines.find(l => l.itemId === line.itemId); demand(ordered, 'The ordered item is unavailable.')
          const isFirstReceipt = !item
          if (isFirstReceipt) item = { id: line.itemId, branchId, name: ordered.name, category: ordered.category || '', description: ordered.specifications || '', unit: ordered.unit || 'units', minStock: Number(ordered.minStock || 0), targetStock: Number(ordered.targetStock || ordered.quantity), maxStock: Number(ordered.maxStock || ordered.quantity), itemType: String(ordered.category || '').toLowerCase() === 'equipment' ? 'Equipment' : 'Material', consumability: String(ordered.category || '').toLowerCase() === 'equipment' ? 'Non-consumable' : 'Consumable', currentStock: 0, supplierCatalogItemId: ordered.supplierCatalogItemId || '' }
          accepted[line.itemId] = Number(accepted[line.itemId] || 0) + line.accepted
          demand(accepted[line.itemId] <= ordered.quantity, 'Receipt exceeds ordered quantity.')
          const catalogIndex = supplierCatalogIndexForLine(catalog, ordered); demand(catalogIndex >= 0, `The supplier catalog no longer contains ${ordered.name}.`)
          const catalogItem = catalog[catalogIndex], onHand = quantity(catalogItem.quantity, true)
          // Older confirmed POs had no reservation field; treating this accepted quantity as
          // their reservation lets existing transactions complete without creating negative stock.
          const reserved = Object.hasOwn(catalogItem, 'reservedQuantity') ? quantity(catalogItem.reservedQuantity, true) : line.accepted
          demand(onHand >= line.accepted && reserved >= line.accepted, `Supplier stock is insufficient to complete receipt for ${ordered.name}.`)
          catalog[catalogIndex] = { ...catalogItem, quantity: onHand - line.accepted, reservedQuantity: reserved - line.accepted, lastFulfilledAt: now, lastFulfilledPoId: po.id }
          if (line.serialNumber) { demand(line.accepted === 1, 'Receive serialized equipment one unit per receiving record.'); demand(!docs(lotSnap).some(l => l.serialNumber === line.serialNumber && l.itemId === item.id), 'This equipment serial number has already been received.') }
          writes.push([db.collection('supplyLots').doc(`${r.id}-${item.id}`), { branchId, itemId: item.id, receivingId: r.id, poId: po.id, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || '', receivedQuantity: line.accepted, remainingQuantity: line.accepted, lot: line.lot || '', manufacturingDate: line.manufacturingDate || '', expiryDate: line.expiryDate || '', serialNumber: line.serialNumber || '', modelNumber: line.modelNumber || '', warranty: line.warranty || '', condition: line.condition, location: po.deliveryLocation, unitCost: ordered.unitPrice, receivedAt: now }, false])
          writes.push([db.collection('inventoryItems').doc(item.id), { ...item, currentStock: Number(item.currentStock || 0) + line.accepted, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || item.supplierCatalogItemId || '', receivedAt: now, updatedAt: now, createdAt: isFirstReceipt ? now : item.createdAt || now, manufacturingDate: line.manufacturingDate || item.manufacturingDate || '', expiryDate: Number(item.currentStock || 0) > 0 && item.expiryDate ? [item.expiryDate, line.expiryDate].filter(Boolean).sort()[0] : line.expiryDate || '', serialNumber: line.serialNumber || item.serialNumber || '', modelNumber: line.modelNumber || item.modelNumber || '', warranty: line.warranty || item.warranty || '', condition: line.condition, location: ordered.location || po.deliveryLocation, costPrice: ordered.unitPrice / 100 }, true])
          writes.push([db.collection('inventoryMovements').doc(`${r.id}-${item.id}`), { branchId, inventoryItemId: item.id, receivingId: r.id, inspectionId: r.inspectionId, poId: po.id, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || '', quantity: line.accepted, type: 'purchase_receipt', createdBy: ctx.uid, createdAt: now, lot: line.lot, expiryDate: line.expiryDate }, false])
        }
        writes.push([db.collection('suppliers').doc(stockSupplier.id), { offeredItems: catalog, catalogStockUpdatedAt: now }, true])
        const complete = po.lines.every(l => Number(accepted[l.itemId] || 0) === l.quantity)
        set(po, { accepted, status: complete ? 'Delivered' : 'Partially Received' }); result = set(r, { status: 'Onboarded', onboardedBy: ctx.uid, onboardedAt: now })
      } else if (r.kind === 'discrepancy' && action === 'resolve') { allow(ctx, 'orders:update'); demand(r.status === 'Open', 'Discrepancy is already resolved.'); demand(['Return to supplier', 'Replacement', 'Credit', 'Refund', 'Other resolution'].includes(input.resolutionType), 'Select a resolution type.', 400); result = set(r, { status: 'Resolved', resolutionType: input.resolutionType, resolution: required(input.remarks, 'Resolution'), resolvedBy: ctx.uid, resolvedAt: now }) }
      else if (r.kind === 'invoice' && action === 'reviseInvoice') {
        const po = get(r.poId, 'po'); manualOrSupplier(po, 'finance:payables:approve')
        demand(['Submitted', 'Disputed'].includes(r.status), 'Matched or approved invoices cannot be edited.')
        result = set(r, { ...quoteTotals(input), status: 'Submitted', invoiceDate: dateKey(input.invoiceDate), dueDate: dateKey(input.dueDate), revisionReason: required(input.remarks, 'Invoice revision reason'), matchIssues: [] })
      }
      else if (r.kind === 'invoice') {
        allow(ctx, action === 'pay' ? 'finance:payables:settle' : 'finance:payables:approve'); const po = get(r.poId, 'po')
        if (action === 'startVerification') { demand(['Submitted', 'Disputed'].includes(r.status), 'Invoice cannot enter verification.'); evidence(r, 'Upload the supplier invoice document.'); result = set(r, { status: 'Under Verification', verificationStartedBy: ctx.uid, verificationStartedAt: now }) }
        else if (action === 'verify') { demand(r.status === 'Under Verification', 'Start invoice verification first.'); const issues = invoiceMatch(po, r, records.filter(i => i.kind === 'invoice' && i.poId === po.id && i.id !== r.id)), matchedReceiving = records.filter(x => x.kind === 'receiving' && x.poId === po.id && x.status === 'Onboarded'), receivingIds = matchedReceiving.map(x => x.id), traceLinks = [...new Set([...r.links, ...matchedReceiving.flatMap(x => [x.id, x.inspectionId].filter(Boolean))])]; const matchId = `match-${r.id}`, existingMatch = records.find(x => x.id === matchId && x.kind === 'threeWayMatch'); const matchData = { status: issues.length ? 'Disputed' : 'Matched', invoiceId: r.id, poId: po.id, receivingIds, supplierId: r.supplierId, issues, checkedBy: ctx.uid, checkedAt: now, links: [...traceLinks, r.id] }; if (existingMatch) set(existingMatch, matchData); else create('threeWayMatch', matchData, matchId); result = set(r, { status: issues.length ? 'Disputed' : 'Matched', receivingIds, links: traceLinks, threeWayMatchId: matchId, matchIssues: issues, verifiedBy: ctx.uid, verifiedAt: now }) }
        else if (action === 'approve') { demand(r.status === 'Matched', 'Three-way matching is required.'); demand(r.createdBy !== ctx.uid && r.verifiedBy !== ctx.uid, 'Invoice approval must be performed by another Finance user.'); result = set(r, { status: 'Approved for Payment', approvedBy: ctx.uid, approvedAt: now }) }
        else if (action === 'preparePayment') {
          demand(r.status === 'Approved for Payment', 'Approve the invoice before preparing payment.')
          demand(!records.some(p => p.kind === 'payment' && p.invoiceId === r.id && p.status !== 'Rejected'), 'A payment is already prepared.')
          result = create('payment', { status: 'Pending', mode: po.mode, supplierId: po.supplierId, invoiceId: r.id, poId: po.id, budgetId: po.budgetId, total: r.total, amount: r.total, links: [...r.links, r.id], invoiceApprovedBy: r.approvedBy }, `payment-${r.id}`)
        }
        else if (action === 'pay') {
          if (r.status === 'Paid') return { id: r.id, alreadyRecorded: true }
          demand(r.status === 'Approved for Payment', 'Invoice must be approved for payment.')
          const payment = get(`payment-${r.id}`, 'payment'); demand(payment.status === 'Processing', 'Prepare, approve and start the payment before recording settlement.')
          const proof = documents.find(d => d.id === input.proofId && [r.id, payment.id].includes(d.recordId)); demand(proof, 'Upload and select payment evidence from the payment record.')
          const budget = get(po.budgetId, 'budget'); demand(budget.committed >= r.total && po.committedAmount >= r.total, 'Insufficient reserved funds.')
          demand(['Manual/External', 'Electronic'].includes(input.method), 'Select the payment recording method.')
          const paidAmount = po.paidAmount + r.total, remaining = po.committedAmount - r.total
          const allReceived = po.lines.every(l => Number(po.accepted?.[l.itemId] || 0) === l.quantity)
          const paidInvoices = records.filter(i => i.kind === 'invoice' && i.poId === po.id && (i.status === 'Paid' || i.id === r.id))
          const complete = allReceived && po.lines.every(line => paidInvoices.reduce((sum, i) => sum + (i.lines.find(l => l.itemId === line.itemId)?.quantity || 0), 0) === line.quantity)
          set(payment, { status: 'Paid', method: input.method, reference: required(input.reference, 'Payment reference'), paymentDate: dateKey(input.paymentDate), proofId: proof.id, processedBy: ctx.uid, paidAt: now })
          set(budget, { committed: budget.committed - r.total - (complete ? remaining : 0), spent: budget.spent + r.total })
          if (po.budgetAllocationId) set(get(po.budgetAllocationId, 'budgetAllocation'), { status: complete ? 'Settled' : 'Partially Spent', spentAmount: paidAmount, releasedAmount: complete ? remaining : 0, settledAt: complete ? now : null })
          set(po, { paidAmount, committedAmount: complete ? 0 : remaining, status: complete ? 'Completed' : po.status })
          if (complete) set(get(po.procurementId, 'procurement'), { status: 'Completed' })
          result = set(r, { status: 'Paid', paidBy: ctx.uid, paidAt: now })
        } else demand(false, 'Invalid invoice action.')
      } else if (r.kind === 'payment') {
        allow(ctx, action === 'startPayment' ? 'finance:payables:settle' : 'finance:payables:approve')
        if (action === 'reviewPayment') { demand(r.status === 'Pending', 'Payment is not pending.'); result = set(r, { status: 'Under Verification', reviewedBy: ctx.uid, reviewedAt: now }) }
        else if (action === 'approvePayment') { demand(r.status === 'Under Verification', 'Review the payment first.'); demand(r.createdBy !== ctx.uid, 'Another Finance user must approve this payment.'); result = set(r, { status: 'Approved', approvedBy: ctx.uid, approvedAt: now, approvalRemarks: required(input.remarks, 'Payment approval remarks') }) }
        else if (action === 'startPayment') { demand(r.status === 'Approved', 'Payment approval is required.'); result = set(r, { status: 'Processing', processedBy: ctx.uid, processingAt: now }) }
        else if (action === 'rejectPayment') { demand(['Pending', 'Under Verification'].includes(r.status), 'Payment is no longer awaiting review.'); result = set(r, { status: 'Rejected', rejectedBy: ctx.uid, rejectionReason: required(input.remarks, 'Rejection reason'), rejectedAt: now }) }
        else if (action === 'resubmitPayment') { demand(r.status === 'Rejected', 'Only rejected payments can be resubmitted.'); result = set(r, { status: 'Pending', revision: required(input.remarks, 'Revision details') }) }
        else demand(false, 'Invalid payment action.')
      } else demand(false, 'This action is not allowed for the record.')
    }
    demand(result, 'No action was performed.')
    const staffContexts = await Promise.all(docs(staffSnap).filter(u => u.id !== ctx.uid).map(u => loadUserContext(u.id)))
    for (const [ref, value, merge] of writes) {
      tx.set(ref, { ...value, updatedAt: now }, { merge })
      const previous = records.find(r => r.id === ref.id), supplierCatalog = ref.parent.id === 'suppliers', changed = { ...previous, ...value }
      const supplierBefore = supplierCatalog ? suppliers.find(s => s.id === ref.id) : null
      tx.set(db.collection('supplyAudit').doc(), { branchId, recordId: ref.id, parentActionRecordId: result.id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: changed.kind || (supplierCatalog ? 'supplierCatalog' : 'system'), action: supplierCatalog ? `catalog-stock-${action}` : action, previousStatus: previous?.status || '', newStatus: changed.status || '', before: supplierBefore || previous || null, after: changed, details: input, ...ctx.auditContext, createdAt: now })
      if (!changed.kind) continue
      const recipients = staffContexts.filter(u => (permissionsByKind[changed.kind] || []).some(p => hasPermission(u, p))).map(u => u.uid)
      for (const s of suppliers.filter(s => s.id === changed.supplierId || changed.supplierIds?.includes(s.id))) if (changed.mode === 'Online' && ['rfq', 'po', 'invoice', 'payment', 'quotation'].includes(changed.kind) && changed.status !== 'Draft') recipients.push(s.ownerId || s.supplierUserId)
      const department = ['budget', 'budgetRequest', 'invoice', 'payment'].includes(changed.kind) ? 'finance' : ['receiving', 'discrepancy'].includes(changed.kind) || changed.kind === 'po' && changed.status === 'Claimed by Logistics' ? 'logistics' : changed.kind === 'request' ? 'inventory' : 'procurement'
      const clinicLink = department === 'finance' ? '/finance/procurement/dashboard' : `/${department}/dashboard`
      for (const uid of new Set(recipients.filter(Boolean))) tx.set(db.collection('notifications').doc(), { recipientUserId: uid, branchId, title: `${names[changed.kind]} updated`, message: `${changed.number}: ${changed.status}`, link: suppliers.some(s => s.ownerId === uid || s.supplierUserId === uid) ? '/supplier/supply' : clinicLink, read: false, deleted: false, createdAt: now })
    }
    return { id: result.id, status: result.status }
  })
  const validateQuoteLines = (rfq, quote) => {
    demand(quote.lines.length === rfq.lines.length, 'Quote every requested item.')
    for (const line of quote.lines) { const expected = rfq.lines.find(l => l.itemId === line.itemId); demand(expected && line.quantity === expected.quantity, 'Quoted quantities must match the RFQ.') }
  }

  app.get('/supply/records/:id/history', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data(); await ensureRead(ctx, record)
    const history = ctx.supplier ? [] : docs(await db.collection('supplyAudit').where('recordId', '==', id).get())
    const documents = docs(await db.collection('supplyDocuments').where('recordId', '==', id).get()).filter(d => !ctx.supplier || (d.visibility === 'supplier' && d.supplierIds.some(s => ctx.supplierIds.includes(s))))
    const messages = ['rfq', 'po'].includes(record.kind) ? docs(await db.collection('supplyMessages').where('recordId', '==', id).get()).filter(m => !ctx.supplier || ctx.supplierIds.includes(m.supplierId)) : []
    res.json({ success: true, data: { history, messages, documents: documents.map(({ storagePath, ...d }) => d) } })
  }))
  app.post('/supply/records/:id/messages', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data(); await ensureRead(ctx, record)
    demand(['rfq', 'po'].includes(record.kind) && record.status !== 'Draft', 'Communications require an issued RFQ or PO.')
    if (!ctx.supplier) allow(ctx, 'procurement:create')
    const supplierId = cleanId(req.body.supplierId), supplier = (await db.collection('suppliers').doc(supplierId).get()).data()
    demand(supplier && supplier.branchId === record.branchId && (record.supplierId === supplierId || record.supplierIds?.includes(supplierId)), 'Supplier is not part of this record.', 403)
    demand(!ctx.supplier || ctx.supplierIds.includes(supplierId), 'Cannot communicate as another supplier.', 403)
    const ref = db.collection('supplyMessages').doc(), message = required(req.body.message, 'Message'), now = stamp()
    await db.runTransaction(async tx => {
      tx.set(ref, { recordId: id, branchId: record.branchId, supplierId, message, channel: record.mode === 'Manual' ? required(req.body.channel, 'External communication channel') : 'Portal', from: ctx.supplier ? 'Supplier' : 'Procurement', actorId: ctx.uid, createdAt: now })
      tx.set(db.collection('supplyAudit').doc(), { recordId: id, branchId: record.branchId, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: record.kind, action: 'supplier-communication', messageId: ref.id, supplierId, ...ctx.auditContext, createdAt: now })
      const recipient = ctx.supplier ? record.createdBy : supplier.ownerId || supplier.supplierUserId
      if (record.mode === 'Online' && recipient && recipient !== ctx.uid) tx.set(db.collection('notifications').doc(), { recipientUserId: recipient, branchId: record.branchId, title: 'Supplier communication', message: `New message on ${record.number}`, link: ctx.supplier ? '/procurement/rfqs' : '/supplier/supply/rfqs', read: false, deleted: false, createdAt: now })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))
  app.post('/supply/records/:id/documents', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data(); await ensureRead(ctx, record)
    demand(!ctx.supplier || (supplierOwns(ctx, record) && ['quotation', 'po', 'invoice'].includes(record.kind)), 'Supplier cannot upload to this record.', 403)
    if (!ctx.supplier) {
      const writers = { request: ['inventory:create'], procurement: ['procurement:create', 'procurement:review'], rfq: ['procurement:create', 'procurement:review'], quotation: ['procurement:create', 'procurement:review'], evaluation: ['procurement:review'], financeApproval: ['finance:payables:approve'], budgetAllocation: ['finance:payables:approve'], po: ['procurement:review', 'orders:update'], supplierConfirmation: ['procurement:review'], receiving: ['orders:update'], inspection: ['orders:update'], discrepancy: ['orders:update'], budget: ['finance:payables:approve'], budgetRequest: ['procurement:review', 'finance:payables:approve'], invoice: ['finance:payables:approve', 'finance:payables:settle'], threeWayMatch: ['finance:payables:approve'], payment: ['finance:payables:settle'] }
      demand((writers[record.kind] || []).some(p => hasPermission(ctx, p)), 'Document upload requires write permission.', 403)
    }
    const { contentType, data, name } = req.body
    demand(['application/pdf', 'image/png', 'image/jpeg'].includes(contentType), 'Upload PDF, PNG or JPEG.', 400)
    const bytes = Buffer.from(String(data || ''), 'base64'); demand(bytes.length > 0 && bytes.length <= 5 * 1024 * 1024, 'File limit is 5 MB.', 400)
    const header = bytes.subarray(0, 8)
    demand(contentType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : contentType === 'image/png' ? header.equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216, 'File content does not match its type.', 400)
    const ref = db.collection('supplyDocuments').doc(), storagePath = `supply-documents/${record.branchId}/${id}/${ref.id}`
    const file = admin.storage().bucket(storageBucket()).file(storagePath)
    await file.save(bytes, { metadata: { contentType }, resumable: false })
    try { await ref.set({ recordId: id, branchId: record.branchId, name: required(name, 'Filename'), contentType, size: bytes.length, storagePath, visibility: ctx.supplier || req.body.visibility === 'supplier' ? 'supplier' : 'internal', supplierIds: record.supplierId ? [record.supplierId] : record.supplierIds || [], uploadedBy: ctx.uid, createdAt: stamp() }) } catch (e) { await file.delete().catch(() => {}); throw e }
    await db.collection('supplyAudit').add({ branchId: record.branchId, recordId: id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: record.kind, action: 'document-upload', documentId: ref.id, filename: required(name, 'Filename'), ...ctx.auditContext, createdAt: stamp() })
    res.json({ success: true, data: { id: ref.id } })
  }))
  app.get('/supply/documents/:id', requireAuth, wrap(async (req, res, ctx) => {
    const d = (await db.collection('supplyDocuments').doc(cleanId(req.params.id)).get()).data(); demand(d, 'Document not found.', 404)
    const r = (await db.collection('supplyRecords').doc(d.recordId).get()).data(); await ensureRead(ctx, r)
    demand(!ctx.supplier || (d.visibility === 'supplier' && d.supplierIds.some(id => ctx.supplierIds.includes(id))), 'This document is private.', 403)
    const [url] = await admin.storage().bucket(storageBucket()).file(d.storagePath).getSignedUrl({ action: 'read', expires: Date.now() + 60000 })
    res.json({ success: true, data: { url } })
  }))
}
