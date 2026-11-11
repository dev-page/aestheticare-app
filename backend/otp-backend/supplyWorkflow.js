import crypto from 'node:crypto'
import { subscriptionLifecycle } from '../../shared/subscriptionLifecycle.js'
import { demand, money, quantity, required, dateKey, day, quoteTotals, invoiceMatch, stockSignals, hasPermission, permissionsByKind } from './supplyModel.js'
import { reconcileLotsToInventory } from './inventoryLots.js'

const docs = snapshot => snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
const cleanId = value => { const id = String(value || ''); demand(/^[A-Za-z0-9_-]{1,150}$/.test(id), 'Invalid record identifier.', 400); return id }
// Older workflow records did not always include relationship links.
const linksOf = record => Array.isArray(record?.links) ? record.links.filter(Boolean) : []
const names = { request: 'IR', procurement: 'PR', rfq: 'RFQ', quotation: 'QT', evaluation: 'EV', budget: 'BD', budgetRequest: 'BR', financeApproval: 'FA', budgetAllocation: 'BA', po: 'PO', supplierConfirmation: 'PC', receiving: 'RC', inspection: 'INSP', discrepancy: 'DS', invoice: 'INV', threeWayMatch: 'MT', payment: 'PAY' }
export const registerSupplyWorkflow = (app, { admin, requireAuth, loadUserContext, storageBucket }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const identity = async req => {
    const ctx = await loadUserContext(req.user.uid)
    const supplier = [ctx.roleKey, ctx.userData.role, ctx.userData.userType].some(value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '').startsWith('supplier'))
    demand(!supplier, 'Supplier accounts are no longer supported. Suppliers are managed as clinic business contacts.', 403)
    return ctx
  }
  const branchAccess = async (ctx, branchId, paidModule = true) => {
    cleanId(branchId)
    const clinic = (await db.collection('clinics').doc(branchId).get()).data()
    const assignedBranches = new Set([ctx.userData.branchId, ...(Array.isArray(ctx.userData.branchIds) ? ctx.userData.branchIds : [])].filter(Boolean))
    demand(clinic && (assignedBranches.has(branchId) || clinic.ownerId === ctx.uid || clinic.branchAdminId === ctx.uid || branchId === ctx.uid), 'This branch is not assigned to your account.', 403)
    if (paidModule) {
      const subscription = subscriptionLifecycle(clinic)
      demand(['basic', 'premium'].includes(subscription.plan) && subscription.isOperational, 'Inventory and procurement require an active Basic or Premium plan.', 403)
    }
  }
  const canRead = (ctx, r) => hasPermission(ctx, 'reports:view') || (permissionsByKind[r.kind] || []).some(p => hasPermission(ctx, p))
  const ensureRead = async (ctx, r) => { demand(r && canRead(ctx, r), 'Record not available to this account.', 403); await branchAccess(ctx, r.branchId) }
  const wrap = handler => async (req, res) => {
    let ctx
    try {
      ctx = await identity(req)
      ctx.auditContext = { ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 128), device: String(req.get?.('user-agent') || req.headers?.['user-agent'] || '').slice(0, 500) }
      await handler(req, res, ctx)
    } catch (e) {
      const unexpected = !e.status
      if (unexpected) console.error('Unhandled supply workflow error', {
        request: {
          method: req.method,
          path: req.originalUrl || req.url || '',
          recordId: String(req.params?.id || ''),
          action: String(req.body?.action || ''),
          branchId: String(req.body?.branchId || ''),
          userId: ctx?.uid || req.user?.uid || '',
          role: ctx?.roleKey || '',
        },
        error: {
          name: e?.name || 'Error',
          message: e?.message || String(e),
          code: e?.code || '',
          status: e?.status || '',
          details: e?.details || '',
          cause: e?.cause ? { name: e.cause.name, message: e.cause.message, code: e.cause.code } : null,
          stack: e?.stack || '',
        },
      })
      res.status(e.status || 500).json({
        success: false,
        error: e.status ? e.message : 'Supply operation failed. Please try again.',
        // The client already requires authentication. Keep this concise enough
        // to diagnose an unexpected production error without exposing a stack
        // trace or any record contents in the browser.
        diagnostic: unexpected ? { name: e?.name || 'Error', message: e?.message || String(e), code: e?.code || '', recordId: String(req.params?.id || ''), action: String(req.body?.action || '') } : undefined,
      })
    }
  }
  const allow = (ctx, permission) => demand(hasPermission(ctx, permission), 'You do not have permission for this action.', 403)
  // Deterministic per-day IDs prevent repeated workspace refreshes from sending
  // the same alert twice. A deployment scheduler may invoke this endpoint too.
  app.post('/supply/reminders', requireAuth, wrap(async (req, res, ctx) => {
    const today = day(), branchId = String(req.body.branchId || ''), alerts = []
    let records = []
    // Workspace refreshes can occur before a branch is selected, or while the
    // user is viewing every assigned branch. Resolve the user's available
    // branches instead of rejecting an empty reminder request.
    const assigned = new Set([ctx.userData.branchId, ...(Array.isArray(ctx.userData.branchIds) ? ctx.userData.branchIds : [])].filter(Boolean))
    if (branchId === 'all') {
      for (const field of ['ownerId', 'branchAdminId']) for (const clinic of docs(await db.collection('clinics').where(field, '==', ctx.uid).get())) assigned.add(clinic.id)
      const own = await db.collection('clinics').doc(ctx.uid).get(); if (own.exists) assigned.add(own.id)
    }
    const scopes = branchId && branchId !== 'all' ? [branchId] : [...assigned]
    for (const scope of scopes) {
      await branchAccess(ctx, scope)
      records.push(...docs(await db.collection('supplyRecords').where('branchId', '==', scope).get()).filter(r => canRead(ctx, r)))
      if (hasPermission(ctx, 'inventory:view')) for (const item of docs(await db.collection('inventoryItems').where('branchId', '==', scope).get())) {
        const signals = stockSignals(item, today)
        if (signals.length) alerts.push({ id: item.id, branchId: scope, message: `${item.name}: ${signals.join(', ')}`, link: '/inventory/items' })
      }
    }
    for (const r of records) {
      const due = r.kind === 'rfq' && ['Sent', 'Open', 'Quotation Received'].includes(r.status) ? r.deadline : r.kind === 'po' && ['Shipped', 'Claimed by Logistics', 'Partially Received'].includes(r.status) ? r.deliveryDate : null
      if (due && Date.parse(due) - Date.parse(today) <= 3 * 86400000) alerts.push({ id: r.id, branchId: r.branchId, message: `${r.number}: ${r.status}; due ${due}`, link: r.kind === 'rfq' ? '/procurement/rfqs' : r.kind === 'po' ? '/inventory/receiving' : '/finance/procurement/invoices' })
    }
    await db.runTransaction(async tx => {
      const entries = alerts.slice(0, 100).map(a => ({ ...a, ref: db.collection('notifications').doc(`supply-${ctx.uid}-${a.id}-${today}`) }))
      const snapshots = await Promise.all(entries.map(a => tx.get(a.ref)))
      entries.forEach((a, i) => { if (!snapshots[i].exists) tx.set(a.ref, { recipientUserId: ctx.uid, branchId: a.branchId, title: 'Supply management reminder', message: a.message, link: a.link, read: false, deleted: false, createdAt: stamp() }) })
    })
    res.json({ success: true, data: { checked: alerts.length } })
  }))

  app.get('/supply/workspace', requireAuth, wrap(async (req, res, ctx) => {
    const branchIds = new Set([ctx.userData.branchId, ...(Array.isArray(ctx.userData.branchIds) ? ctx.userData.branchIds : [])].filter(Boolean))
    for (const field of ['ownerId', 'branchAdminId']) for (const clinic of docs(await db.collection('clinics').where(field, '==', ctx.uid).get())) branchIds.add(clinic.id)
    const own = await db.collection('clinics').doc(ctx.uid).get(); if (own.exists) branchIds.add(own.id)
    const branches = await Promise.all([...branchIds].map(async id => {
      const c = (await db.collection('clinics').doc(id).get()).data() || {}
      const address = [c.clinicLocationAddress, c.clinicBarangay, c.clinicLocation, c.clinicProvince, c.clinicPostalCode]
        .map(value => String(value || '').trim())
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join(', ')
      return { id, name: c.clinicBranch || c.clinicName || id, address, latitude: String(c.clinicLocationLat || ''), longitude: String(c.clinicLocationLng || '') }
    }))
    const requestedScope = String(req.query.branchId || branches[0]?.id || '')
    const allBranches = requestedScope === 'all'
    const branchId = allBranches ? 'all' : requestedScope
    if (!branchId) return res.json({ success: true, data: { branches, records: [], items: [], suppliers: [], movements: [], permissions: [...ctx.permissions], supplier: false } })
    if (!allBranches) await branchAccess(ctx, branchId)
    if (allBranches) await Promise.all(branches.map(branch => branchAccess(ctx, branch.id)))
    const scopedDocs = async (collection) => (await Promise.all((allBranches ? branches.map(b => b.id) : [branchId]).map(id => db.collection(collection).where('branchId', '==', id).get()))).flatMap(docs)
    const records = (await scopedDocs('supplyRecords')).filter(r => canRead(ctx, r))
    const internal = true
    const broadRead = ['inventory:view', 'procurement:view', 'finance:payables:view', 'reports:view'].some(p => hasPermission(ctx, p))
    const items = broadRead ? (await scopedDocs('inventoryItems')).map(i => ({ ...i, signals: stockSignals(i), availableStock: Math.max(0, Number(i.currentStock || 0) - Number(i.reservedStock || 0)) })) : []
    // Supplier contacts are global/business records. Branch eligibility and
    // private purchasing notes live in clinicSuppliers, so never infer access
    // from the legacy suppliers.branchId field.
    let suppliers = []
    if (broadRead) {
      const associationDocs = await scopedDocs('clinicSuppliers')
      const supplierIds = [...new Set(associationDocs.map(link => String(link.supplierId || '')).filter(Boolean))]
      const supplierDocs = await Promise.all(supplierIds.map(async id => {
        const snapshot = await db.collection('suppliers').doc(id).get()
        const association = associationDocs.find(link => link.supplierId === id)
        return snapshot.exists ? { id, ...(snapshot.data() || {}), associationStatus: association?.status || 'Active', clinicSupplierId: association?.id || '' } : null
      }))
      const legacySuppliers = await scopedDocs('suppliers')
      suppliers = [...supplierDocs.filter(Boolean), ...legacySuppliers.filter(legacy => !supplierDocs.some(supplier => supplier?.id === legacy.id))]
    }
    // Historical POs can reference a supplier record that was later relinked
    // to another branch. Include only the supplier documents already named by
    // records the caller is authorized to read, so the UI can show its business
    // name instead of exposing an internal document ID.
    if (broadRead) {
      const known = new Set(suppliers.map(supplier => supplier.id))
      const referencedIds = [...new Set(records.map(record => String(record.supplierId || '')).filter(Boolean))]
      const referenced = await Promise.all(referencedIds.filter(id => !known.has(id)).map(async id => {
        const snapshot = await db.collection('suppliers').doc(id).get()
        return snapshot.exists ? { id, ...(snapshot.data() || {}) } : null
      }))
      suppliers = [...suppliers, ...referenced.filter(Boolean)]
    }
    const movements = internal && (hasPermission(ctx, 'inventory:view') || hasPermission(ctx, 'reports:view')) ? await scopedDocs('inventoryMovements') : []
    const snapshots = internal && (hasPermission(ctx, 'inventory:view') || hasPermission(ctx, 'reports:view')) ? await scopedDocs('supplySnapshots') : []
    res.json({ success: true, data: { branchId, branches, records, items, suppliers, movements, snapshots, permissions: [...ctx.permissions], roleKey: ctx.roleKey, supplier: false, uid: ctx.uid } })
  }))

  app.post('/supply/items', requireAuth, wrap(async (req, res, ctx) => {
    allow(ctx, 'inventory:create'); const input = req.body, branchId = cleanId(input.branchId); await branchAccess(ctx, branchId)
    const ref = db.collection('inventoryItems').doc(input.id ? cleanId(input.id) : crypto.randomUUID())
    await db.runTransaction(async tx => {
      const existing = await tx.get(ref), old = existing.data() || {}
      demand(!existing.exists || old.branchId === branchId, 'Item belongs to another branch.', 403)
      const supplierId = Object.prototype.hasOwnProperty.call(input, 'supplierId') ? String(input.supplierId || '') : String(old.supplierId || '')
      const supplierSnap = supplierId ? await tx.get(db.collection('suppliers').doc(cleanId(supplierId))) : null
      const supplier = supplierSnap?.data()
      if (supplierId && (!existing.exists || supplierId !== String(old.supplierId || ''))) {
        const associationSnapshot = await tx.get(db.collection('clinicSuppliers').where('branchId', '==', branchId))
        const associated = docs(associationSnapshot).some(link => link.supplierId === supplierId && link.status === 'Active')
        const legacyBranchSupplier = supplier?.branchId === branchId && supplier.status === 'Active'
        demand(supplier && supplier.status === 'Active' && (associated || legacyBranchSupplier), 'Choose an active supplier associated with this clinic branch.', 400)
      }
      const lotSnapshot = await tx.get(db.collection('supplyLots').where('itemId', '==', ref.id))
      const currentStock = quantity(input.currentStock, true), minStock = quantity(input.minStock, true), targetStock = quantity(input.targetStock, true), maxStock = quantity(input.maxStock, true)
      demand(targetStock >= minStock && maxStock >= targetStock, 'Maximum stock must be at least target stock, and target must be at least the restocking threshold.', 400)
      demand(currentStock >= Number(old.reservedStock || 0), 'Stock cannot fall below reserved quantity.')
      const reason = required(input.adjustmentReason, 'Stock/edit reason')
      const data = {
        branchId,
        name: required(input.name || old.name, 'Item name'),
        category: required(input.category || old.category, 'Category'),
        description: String(input.description ?? old.description ?? '').slice(0, 4000),
        unit: required(input.unit || old.unit || 'units', 'Unit'),
        currentStock,
        reservedStock: Number(old.reservedStock || 0),
        minStock,
        targetStock,
        maxStock,
        supplierId,
        supplierCatalogItemId: String(old.supplierCatalogItemId || ''),
        costPrice: Number(input.costPrice ?? old.costPrice ?? 0),
        fdaRegistrationNumber: String(input.fdaRegistrationNumber ?? old.fdaRegistrationNumber ?? '').slice(0, 200),
        fdaApprovalDocument: old.fdaApprovalDocument || null,
        updatedAt: stamp(),
        ...(!existing.exists ? { createdAt: stamp() } : {}),
      }
      demand(Number.isFinite(data.costPrice) && data.costPrice >= 0, 'Enter a valid non-negative unit cost.', 400)
      for (const key of ['location', 'condition', 'serialNumber', 'modelNumber', 'warranty', 'brand', 'imageUrl']) data[key] = String(input[key] ?? old[key] ?? '').slice(0, 4000)
      demand(!data.imageUrl || /^https:\/\//.test(data.imageUrl), 'Images must use an HTTPS URL.', 400)
      demand(['Material', 'Equipment'].includes(input.itemType), 'Choose Material or Equipment.', 400)
      data.itemType = input.itemType; data.consumability = input.consumability === 'Non-consumable' ? 'Non-consumable' : 'Consumable'
      data.manufacturingDate = input.manufacturingDate ? dateKey(input.manufacturingDate) : ''
      data.expiryDate = input.expiryDate ? dateKey(input.expiryDate) : ''
      const lotPlan = reconcileLotsToInventory({
        branchId,
        itemId: ref.id,
        item: { ...old, ...data, currentStock },
        lotRecords: lotSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      })
      tx.set(ref, data, { merge: true })
      lotPlan.lotWrites.forEach(write => tx.set(db.collection('supplyLots').doc(write.id), {
        ...write.data,
        ...(write.created ? { receivedAt: stamp(), createdAt: stamp() } : {}),
        updatedAt: stamp(),
      }, { merge: true }))
      tx.set(db.collection('inventoryMovements').doc(), { branchId, inventoryItemId: ref.id, type: existing.exists ? 'adjustment' : 'opening_stock', quantity: currentStock - Number(old.currentStock || 0), lotAdjustments: lotPlan.adjustments, reason, createdBy: ctx.uid, createdAt: stamp() })
      tx.set(db.collection('supplyAudit').doc(), { recordId: ref.id, branchId, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: 'inventory', action: 'inventory-edit', before: old, after: data, reason, ...ctx.auditContext, createdAt: stamp() })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))

  app.post('/supply/suppliers', requireAuth, wrap(async (req, res, ctx) => {
    allow(ctx, 'suppliers:create'); const input = req.body, branchId = cleanId(input.branchId); await branchAccess(ctx, branchId)
    const clinic = (await db.collection('clinics').doc(branchId).get()).data() || {}
    const ref = db.collection('suppliers').doc(), associationRef = db.collection('clinicSuppliers').doc()
    const data = { businessName: required(input.name, 'Company name'), contactPerson: required(input.contactPerson, 'Contact person'), email: String(input.email || ''), contactNumber: String(input.phone || ''), address: String(input.address || ''), category: String(input.category || ''), registrationNumber: String(input.registrationNumber || ''), status: 'Active', sharedDirectory: false, createdForClinicId: String(clinic.ownerId || ctx.uid), createdBy: ctx.uid, createdAt: stamp(), updatedAt: stamp() }
    await db.runTransaction(async tx => {
      tx.set(ref, data)
      tx.set(associationRef, { clinicId: String(clinic.ownerId || ctx.uid), branchId, supplierId: ref.id, status: 'Active', internalNotes: '', associatedAt: stamp(), createdBy: ctx.uid, updatedBy: ctx.uid, updatedAt: stamp() })
      tx.set(db.collection('supplyAudit').doc(), { branchId, recordId: ref.id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: 'supplier', action: 'manual-supplier-created', after: data, ...ctx.auditContext, createdAt: stamp() })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))

  // Read the branch's workflow records inside each transaction. Stage writes so all
  // validation and reads happen before Firestore writes, including notifications.
  app.post('/supply/records', requireAuth, wrap(async (req, res, ctx) => {
    const input = req.body || {}, rawBranchId = String(input.branchId || '').trim()
    demand(/^[A-Za-z0-9_-]{1,150}$/.test(rawBranchId), 'Select a valid assigned clinic branch before sending this request.', 400)
    const branchId = rawBranchId
    await branchAccess(ctx, branchId)
    const result = await mutate(ctx, branchId, input, null)
    res.json({ success: true, data: result })
  }))
  app.post('/supply/records/:id/actions', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), r = (await db.collection('supplyRecords').doc(id).get()).data()
    await ensureRead(ctx, r)
    res.json({ success: true, data: await mutate(ctx, r.branchId, req.body || {}, id) })
  }))
  const mutate = async (ctx, branchId, input, targetId) => db.runTransaction(async tx => {
    const [recordSnap, itemSnap, supplierLinkSnap, legacySupplierSnap, staffSnap, documentSnap, lotSnap] = await Promise.all([
      tx.get(db.collection('supplyRecords').where('branchId', '==', branchId)), tx.get(db.collection('inventoryItems').where('branchId', '==', branchId)),
      tx.get(db.collection('clinicSuppliers').where('branchId', '==', branchId)), tx.get(db.collection('suppliers').where('branchId', '==', branchId)), tx.get(db.collection('users').where('branchId', '==', branchId)), tx.get(db.collection('supplyDocuments').where('branchId', '==', branchId)),
      tx.get(db.collection('supplyLots').where('branchId', '==', branchId)),
    ])
    const supplierLinks = docs(supplierLinkSnap)
    const supplierDocs = await Promise.all(supplierLinks.map(link => tx.get(db.collection('suppliers').doc(cleanId(link.supplierId)))))
    const associationSuppliers = supplierDocs.map((snapshot, index) => snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() || {}), associationStatus: supplierLinks[index]?.status || 'Active' }) : null).filter(Boolean)
    const records = docs(recordSnap), items = docs(itemSnap), suppliers = [...associationSuppliers, ...docs(legacySupplierSnap).filter(legacy => !associationSuppliers.some(supplier => supplier.id === legacy.id))], documents = docs(documentSnap)
    const writes = [], financialWrites = [], now = stamp()
    const get = (id, kind) => { const r = records.find(r => r.id === id && r.kind === kind); demand(r, `${kind} record not found.`, 404); return r }
    // Some records created before the current workflow did not retain every
    // parent link. A missing parent must not prevent the record that is in
    // front of the user from progressing.
    const linked = (id, kind) => records.find(r => r.id === id && r.kind === kind) || null
    const set = (r, patch) => { writes.push([db.collection('supplyRecords').doc(r.id), patch, true]); return { ...r, ...patch } }
    const create = (kind, data, id = crypto.randomUUID()) => {
      demand(!records.some(r => r.id === id), 'This linked record already exists.')
      const record = { id, kind, number: `${names[kind]}-${day().replaceAll('-', '')}-${id.slice(0, 8).toUpperCase()}`, branchId, createdBy: ctx.uid, createdAt: now, updatedAt: now, links: [], ...data }
      writes.push([db.collection('supplyRecords').doc(id), record, false]); return record
    }
    const evidence = (r, message) => demand(documents.some(d => d.recordId === r.id), message || 'Upload supporting documents before continuing.')
    const supplier = id => { const s = suppliers.find(s => s.id === id); demand(s && s.status === 'Active' && (!s.associationStatus || s.associationStatus === 'Active'), 'Select an active supplier associated with this clinic branch.'); return s }
    const manualOrSupplier = (r, permission = 'procurement:create') => {
      allow(ctx, permission)
      demand(r.mode !== 'Online', 'Historical online supplier transactions are read-only.', 403)
    }
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
            demand(!raw.supplierId, 'Inventory requests describe the clinic need; Procurement selects a supplier.', 400)
            const name = required(raw.name || raw.itemName, 'Supply name')
            const category = required(raw.category, 'Supply category')
            const requestedQuantity = quantity(raw.quantity)
            demand(!seenProducts.has(`${category}:${name}`), 'Duplicate requested supplies are not allowed.', 400)
            seenProducts.add(`${category}:${name}`)
            const existingItem = items.find(item => String(item.name || '').trim().toLowerCase() === name.toLowerCase() && String(item.category || '').trim().toLowerCase() === category.toLowerCase())
            return { itemId: existingItem?.id || crypto.randomUUID(), initialInventory: !existingItem, name, category, supplierId: '', preferredSupplierId: '', supplierCatalogItemId: '', quantity: requestedQuantity, unit: String(raw.unit || existingItem?.unit || 'units'), specifications: String(raw.specifications || ''), packaging: '', manufacturingDate: '', expiryDate: '', unitPrice: 0, subtotal: 0, taxRate: 0, taxTreatment: 'vat-inclusive', discountRate: 0, tieredDiscounts: [], otherChargePerUnit: 0, currentStock: Number(existingItem?.currentStock || 0), minStock: quantity(raw.minStock || existingItem?.minStock || 0, true), targetStock: quantity(raw.targetStock || existingItem?.targetStock || 0, true), maxStock: quantity(raw.maxStock || existingItem?.maxStock || 0, true), location: String(raw.location || input.location || '') }
          })
          const estimatedCost = lines.reduce((sum, line) => sum + line.subtotal, 0)
          const saveDraft = input.action === 'saveDraft'
          result = create('request', { status: saveDraft ? 'Draft' : 'Sent to Procurement', supplierId: lines.length === 1 ? lines[0].supplierId : '', itemId: lines.length === 1 ? lines[0].itemId : '', lines, department: 'Inventory', reason: required(input.reason, 'Reason'), notes: String(input.notes || ''), priority: input.priority || 'Normal', requiredDate: dateKey(input.requiredDate), estimatedCost, submittedBy: ctx.uid, ...(saveDraft ? { savedAt: now } : { submittedAt: now }) })
          if (!saveDraft) {
            const procurement = create('procurement', { status: 'Received', requestId: result.id, requesterId: ctx.uid, lines, department: result.department, requiredDate: result.requiredDate, reason: result.reason, priority: result.priority, estimatedProcurementValue: estimatedCost, links: [result.id] }, `proc-${result.id}`)
            set(result, { procurementId: procurement.id })
          }
          break
        }
        case 'budget': { allow(ctx, 'finance:payables:approve'); const category = required(input.category, 'Purpose'); result = create('budget', { status: 'Active', department: 'Inventory', category, period: input.period ? String(input.period).slice(0, 7) : '', notes: String(input.notes || '').slice(0, 4000), total: money(input.total), committed: 0, spent: 0 }); break }
        case 'rfq':
        case 'quotation':
          demand(false, 'Supplier accounts do not submit quotations. Record externally received quotation terms in Procurement.', 410)
          break
        case 'receiving': {
          allow(ctx, 'inventory:create'); const po = get(input.poId, 'po'); demand(po.status === 'Receiving', 'The purchase order must be in Receiving before recording a delivery.'); demand(po.mode !== 'Manual' || po.confirmedAt, 'Record the supplier confirmation before receiving a delivery.')
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
          result = create('receiving', { status: 'Inspected', poId: po.id, supplierId: po.supplierId, links: [...linksOf(po), po.id], lines, reference: required(input.reference, 'Delivery reference'), deliveryDate: dateKey(input.deliveryDate), receivedBy: ctx.uid, notes: String(input.notes || '') })
          const inspection = create('inspection', { status: 'Completed', poId: po.id, receivingId: result.id, supplierId: po.supplierId, links: [...linksOf(result), result.id], lines, quantityResult: lines.some(l => l.delivered !== l.ordered) ? 'Discrepancy' : 'Verified', qualityResult: lines.some(l => l.rejected > 0) ? 'Discrepancy' : 'Accepted', inspectedBy: ctx.uid, inspectedAt: now }, `inspection-${result.id}`)
          set(result, { inspectionId: inspection.id })
          if (lines.some(l => l.rejected > 0)) create('discrepancy', { status: 'Open', poId: po.id, receivingId: result.id, supplierId: po.supplierId, links: [po.id, result.id], lines: lines.filter(l => l.rejected), reason: 'Rejected delivery items require resolution' })
          break
        }
        case 'invoice': {
          const po = get(input.poId, 'po'); demand(hasPermission(ctx, 'procurement:review') || hasPermission(ctx, 'finance:payables:approve'), 'Procurement or Finance access is required to record an invoice.', 403); demand(po.status === 'Receiving', 'Receive and inspect goods before invoicing.')
          const invoiceNumber = required(input.invoiceNumber, 'Invoice number'); demand(!records.some(r => r.kind === 'invoice' && r.supplierId === po.supplierId && r.invoiceNumber === invoiceNumber), 'This supplier invoice number already exists.')
          const receiving = records.filter(r => r.kind === 'receiving' && r.poId === po.id && r.status === 'Onboarded')
          result = create('invoice', { ...quoteTotals(input, { requireStatedTotal: true }), mode: po.mode, status: 'Submitted', poId: po.id, supplierId: po.supplierId, invoiceNumber, invoiceDate: dateKey(input.invoiceDate), links: [...new Set([...linksOf(po), po.id, ...receiving.flatMap(record => [record.id, record.inspectionId].filter(Boolean))])], receivingIds: receiving.map(record => record.id) });
          financialWrites.push([db.collection('financialRecords').doc(`supply-${result.id}`), { id: `supply-${result.id}`, branchId, kind: 'procurementPayable', status: 'Unpaid', category: 'Procurement', description: `Supplier invoice ${invoiceNumber}`, payee: po.supplierId, amount: result.total, paidAmount: 0, outstandingAmount: result.total, supplyInvoiceId: result.id, purchaseOrderId: po.id, createdBy: ctx.uid, createdAt: now, updatedAt: now }, false]); break
        }
        default: demand(false, 'Unsupported record type.', 400)
      }
    } else {
      demand(record, 'Record not found.', 404); demand(canRead(ctx, record), 'Access denied.', 403)
      demand(record.mode !== 'Online', 'Historical online supplier transactions are read-only.', 403)
      const r = record
      if (r.kind === 'budget') {
        allow(ctx, 'finance:payables:approve')
        demand(Number(r.committed || 0) === 0 && Number(r.spent || 0) === 0, 'Budgets with commitments or recognized spending cannot be changed or cancelled.')
        if (action === 'editBudget') result = set(r, { department: 'Inventory', category: required(input.category, 'Category'), period: input.period ? String(input.period).slice(0, 7) : '', notes: String(input.notes || '').slice(0, 4000), total: money(input.total), updatedBy: ctx.uid, updatedAt: now })
        else if (action === 'cancelBudget') result = set(r, { status: 'Cancelled', cancellationReason: required(input.remarks, 'Cancellation reason'), cancelledBy: ctx.uid, cancelledAt: now })
        else demand(false, 'Invalid budget action.')
      } else if (r.kind === 'request') {
        if (action === 'submitDraft') {
          allow(ctx, 'inventory:create'); demand(r.createdBy === ctx.uid && r.status === 'Draft', 'Only the original requester can submit this draft.', 403)
          const procurement = create('procurement', { status: 'Received', requestId: r.id, requesterId: ctx.uid, lines: r.lines, department: r.department, requiredDate: r.requiredDate, reason: r.reason, priority: r.priority, estimatedProcurementValue: r.estimatedCost, links: [...linksOf(r), r.id] }, `proc-${r.id}`)
          result = set(r, { status: 'Sent to Procurement', procurementId: procurement.id, submittedBy: ctx.uid, submittedAt: now })
        } else if (action === 'resubmit') {
          allow(ctx, 'inventory:create'); demand(r.createdBy === ctx.uid && r.status === 'Returned', 'Only the original requester can resubmit a returned request.', 403)
          const procurement = get(r.procurementId, 'procurement')
          result = set(r, { status: 'Sent to Procurement', resubmittedAt: now, resubmissionResponse: required(input.remarks, 'Response to Procurement') })
          set(procurement, { status: 'Received', returnedAt: '', returnReason: '', returnInstructions: '', returnedItemId: '', resubmittedAt: now })
        } else demand(false, 'Draft requests can be submitted only by their original requester.')
      } else if (r.kind === 'procurement') {
        allow(ctx, 'procurement:review')
        if (['confirm', 'verifyRequest'].includes(action)) {
          demand(r.status === 'Received', 'Only newly received requests can be prepared for Finance.')
          demand(input.productsCorrect && input.quantitiesVerified && input.availabilityConfirmed && input.pricesVerified, 'Complete every procurement checklist item before requesting funding.', 400)
          const supplierId = cleanId(input.supplierId), selectedSupplier = supplier(supplierId)
          demand(!r.purchaseOrderId, 'A purchase order has already been created for this procurement request.')
          evidence(r, 'Attach the supplier quotation received outside the platform before sending this request to Finance.')
          const quoteLines = Array.isArray(input.lines) ? input.lines : []
          demand(Array.isArray(r.lines) && r.lines.length > 0 && quoteLines.length === r.lines.length, 'Enter a price for every requested item.', 400)
          r.lines.forEach(line => {
            const quoteLine = quoteLines.find(candidate => String(candidate.itemId) === String(line.itemId))
            demand(quoteLine && Number(quoteLine.quantity) === Number(line.quantity), `The quoted quantity for ${line.name} must match the inventory request.`, 400)
          })
          const pricing = quoteTotals({ ...input, lines: quoteLines }, { requireStatedTotal: true })
          const lines = r.lines.map(line => {
            const priced = pricing.lines.find(candidate => candidate.itemId === String(line.itemId))
            return { ...line, supplierId, preferredSupplierId: supplierId, quantity: Number(line.quantity), unitPrice: priced.unitPrice, subtotal: priced.total }
          })
          const totals = { ...pricing, lines: lines.map(line => ({ ...line, total: line.subtotal })) }
          const quoteDate = input.quoteDate ? dateKey(input.quoteDate) : ''
          const po = create('po', {
            status: 'For Review', mode: 'Manual', directSupplierQuote: true, supplierId,
            supplierBusinessName: String(selectedSupplier.businessName || selectedSupplier.name || selectedSupplier.companyName || 'Supplier').trim() || 'Supplier',
            procurementId: r.id, department: r.department,
            priority: ['Low', 'Normal', 'High', 'Urgent'].includes(r.priority) ? r.priority : 'Normal',
            category: String(input.category || r.lines[0]?.category || 'Procurement'), lines: totals.lines,
            subtotal: totals.subtotal, tax: totals.tax, delivery: totals.delivery,
            otherCharges: totals.otherCharges, discount: totals.discount, adjustments: totals.adjustments,
            taxTreatment: totals.taxTreatment, statedTotal: totals.statedTotal, total: totals.total,
            requestedAmount: totals.total, quoteReference: String(input.quoteReference || '').trim(), quoteDate,
            warranty: String(input.warranty || ''), deliveryDate: dateKey(input.deliveryDate || r.requiredDate),
            deliveryLocation: String(input.deliveryLocation || r.lines[0]?.location || 'Clinic branch'),
            terms: String(input.terms || 'Per attached supplier quotation'), paymentTerms: String(input.paymentTerms || ''),
            quotedBy: ctx.uid, quotedAt: now, committedAmount: 0, paidAmount: 0, accepted: {}, links: [...linksOf(r), r.id],
          }, `po-${r.id}`)
          result = set(r, { status: 'For Review', supplierId, verifiedBy: ctx.uid, verifiedAt: now, purchaseOrderId: po.id, checklist: { productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true } })
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
          result = set(r, { status: 'Received', rfqId: '', evaluationId: '', budgetRequestId: '', purchaseOrderId: '', revisionReason: reason, officer: ctx.uid })
        } else demand(false, 'Invalid procurement action.')
      } else if (r.kind === 'rfq') {
        allow(ctx, 'procurement:review')
        if (action === 'editRfq') { demand(r.status === 'Draft', 'Issued RFQs cannot be silently changed. Cancel and re-source instead.'); const deadline = dateKey(input.deadline); demand(deadline >= day(), 'Deadline cannot be in the past.'); result = set(r, { deadline, deliveryDate: dateKey(input.deliveryDate), deliveryLocation: required(input.deliveryLocation, 'Delivery location'), terms: required(input.terms, 'Terms'), conditions: String(input.conditions || ''), contact: required(input.contact, 'Contact') }) }
        else if (action === 'cancel') { demand(['Draft', 'Sent', 'Open', 'Quotation Received', 'Closed', 'Under Evaluation'].includes(r.status), 'An awarded RFQ must be handled through procurement re-sourcing.'); result = set(r, { status: 'Cancelled', remarks: required(input.remarks, 'Cancellation reason') }); set(get(r.procurementId, 'procurement'), { status: 'Received', rfqId: '' }) }
        else if (action === 'send') { demand(r.status === 'Draft', 'RFQ is already issued.'); if (r.mode === 'Manual') evidence(r, 'Upload the manual RFQ first.'); demand(r.deadline >= day(), 'Update the expired RFQ deadline.'); result = set(r, { status: 'Open', sentAt: now, openedAt: now }); set(get(r.procurementId, 'procurement'), { status: 'RFQ Sent' }) }
        else demand(false, 'Invalid RFQ action.')
      } else if (r.kind === 'quotation' && action === 'revise') {
        const rfq = get(r.rfqId, 'rfq'); manualOrSupplier(r); demand(r.status === 'Submitted' && ['Open', 'Quotation Received'].includes(rfq.status) && rfq.deadline >= day(), 'Quotation editing is closed.')
        const totals = quoteTotals(input, { requireStatedTotal: true }); validateQuoteLines(rfq, totals); result = set(r, { ...totals, validUntil: dateKey(input.validUntil), leadDays: quantity(input.leadDays, true), paymentTerms: required(input.paymentTerms, 'Payment terms'), warranty: String(input.warranty || ''), notes: String(input.notes || '') })
      } else if (r.kind === 'quotation' && action === 'select') {
        allow(ctx, 'procurement:review'); const rfq = get(r.rfqId, 'rfq'), p = get(rfq.procurementId, 'procurement')
        demand(r.status === 'Submitted' && ['Open', 'Quotation Received'].includes(rfq.status) && !p.evaluationId, 'This quotation is no longer available for selection.'); demand(r.validUntil >= day(), 'Quotation has expired.')
        if (r.mode === 'Manual') evidence(r, 'Upload the supplier quotation first.')
        const justification = required(input.justification, 'Selection justification')
        const ev = create('evaluation', { status: 'Supplier Selected', quotationId: r.id, supplierId: r.supplierId, rfqId: rfq.id, procurementId: p.id, recommendation: String(input.recommendation || justification), justification, evaluatorId: ctx.uid, evaluatedAt: now, links: [...linksOf(p), p.id, rfq.id, r.id] })
        const br = create('budgetRequest', { status: 'Submitted', quotationId: r.id, supplierId: r.supplierId, procurementId: p.id, evaluationId: ev.id, requestedAmount: r.total, recommendedAmount: r.total, department: p.department, category: required(input.category, 'Budget category'), lines: r.lines, subtotal: r.subtotal, tax: r.tax, delivery: r.delivery, otherCharges: r.otherCharges, discount: r.discount, adjustments: r.adjustments || [], taxTreatment: r.taxTreatment || '', ...(r.statedTotal === undefined ? {} : { statedTotal: r.statedTotal }), paymentTerms: r.paymentTerms, warranty: r.warranty, deliveryDate: rfq.deliveryDate, deliveryLocation: rfq.deliveryLocation, terms: rfq.terms, mode: r.mode, links: [...linksOf(ev), ev.id] })
        result = set(r, { status: 'Selected' }); set(rfq, { status: 'Awarded' }); set(p, { status: 'For Finance Approval', evaluationId: ev.id, budgetRequestId: br.id }); records.filter(q => q.kind === 'quotation' && q.rfqId === rfq.id && q.id !== r.id).forEach(q => set(q, { status: 'Not Selected' }))
      } else if (r.kind === 'budgetRequest') {
        if (action === 'resubmit') { allow(ctx, 'procurement:review'); demand(['Returned', 'Rejected'].includes(r.status), 'This request cannot be resubmitted.'); result = set(r, { status: 'Submitted', revision: required(input.remarks, 'Revision details') }) }
        else { allow(ctx, 'finance:payables:approve'); const ownerSelfApproval = ctx.roleKey === 'Owner' && r.createdBy === ctx.uid; demand(r.createdBy !== ctx.uid || ownerSelfApproval, 'Finance approval must be performed by another user.'); demand(r.status === 'Submitted', 'Budget request is not awaiting a decision.')
          if (action === 'approve') {
            demand((r.quotationId || r.directSupplierCatalog || r.directSupplierQuote) && Array.isArray(r.lines) && r.lines.length, 'Funding requests must include Procurement’s documented supplier quotation terms.', 400)
            const budget = get(input.budgetId, 'budget'); demand(budget.department === r.department, 'Budget department must match the request.')
            const approvedAmount = money(input.approvedAmount); demand(approvedAmount >= r.requestedAmount && approvedAmount <= budget.total - budget.committed - budget.spent, 'Insufficient available budget, or approved amount is below the quotation.')
            set(budget, { committed: budget.committed + approvedAmount })
            const remarks = required(input.remarks, 'Approval remarks')
            const approval = create('financeApproval', { status: 'Approved', budgetRequestId: r.id, budgetId: budget.id, approvedAmount, decision: 'Approved', remarks, financeOfficerId: ctx.uid, decidedAt: now, links: [...linksOf(r), r.id] }, `approval-${r.id}`)
            const allocation = create('budgetAllocation', { status: 'Committed', budgetRequestId: r.id, financeApprovalId: approval.id, budgetId: budget.id, amount: approvedAmount, releasedAmount: 0, allocatedBy: ctx.uid, allocatedAt: now, links: [...linksOf(approval), approval.id] }, `allocation-${r.id}`)
            result = set(r, { status: 'Approved', budgetId: budget.id, approvedAmount, approvedBy: ctx.uid, approvedAt: now, remarks, ownerSelfApproved: ownerSelfApproval, financeApprovalId: approval.id, budgetAllocationId: allocation.id })
            create('po', { lines: r.lines, subtotal: r.subtotal, tax: r.tax, delivery: r.delivery, otherCharges: r.otherCharges, discount: r.discount, adjustments: r.adjustments || [], taxTreatment: r.taxTreatment || '', ...(r.statedTotal === undefined ? {} : { statedTotal: r.statedTotal }), total: r.requestedAmount, sourceQuotationId: r.quotationId || '', directSupplierCatalog: Boolean(r.directSupplierCatalog || r.directSupplierQuote), mode: r.mode || 'Online', supplierId: r.supplierId, paymentTerms: r.paymentTerms, warranty: r.warranty, status: 'Approved', budgetId: budget.id, budgetRequestId: r.id, financeApprovalId: approval.id, budgetAllocationId: allocation.id, procurementId: r.procurementId, links: [...linksOf(allocation), allocation.id, ...(r.quotationId ? [r.quotationId] : [])], committedAmount: approvedAmount, paidAmount: 0, accepted: {}, deliveryDate: r.deliveryDate, deliveryLocation: r.deliveryLocation, terms: r.terms }, `po-${r.id}`)
          } else { demand(['reject', 'return'].includes(action), 'Invalid action.'); result = set(r, { status: action === 'reject' ? 'Rejected' : 'Returned', remarks: required(input.remarks, 'Decision reason'), reviewedBy: ctx.uid, reviewedAt: now }) }
        }
      } else if (r.kind === 'po') {
        if (['approve', 'reject'].includes(action) && r.status === 'For Review') {
          allow(ctx, 'finance:payables:approve')
          const ownerSelfApproval = ctx.roleKey === 'Owner' && r.createdBy === ctx.uid
          demand(r.createdBy !== ctx.uid || ownerSelfApproval, 'Finance approval must be performed by another user.')
          if (action === 'approve') {
            const budget = get(input.budgetId, 'budget')
            demand(budget.department === r.department, 'Budget department must match the purchase order.')
            const approvedAmount = money(input.approvedAmount)
            demand(approvedAmount >= r.total && approvedAmount <= budget.total - budget.committed - budget.spent, 'Insufficient available budget, or approved amount is below the purchase order.')
            const remarks = required(input.remarks, 'Approval remarks')
            set(budget, { committed: budget.committed + approvedAmount })
            const approval = create('financeApproval', { status: 'Approved', poId: r.id, budgetId: budget.id, approvedAmount, decision: 'Approved', remarks, financeOfficerId: ctx.uid, decidedAt: now, links: [...linksOf(r), r.id] }, `approval-${r.id}`)
            const allocation = create('budgetAllocation', { status: 'Committed', poId: r.id, financeApprovalId: approval.id, budgetId: budget.id, amount: approvedAmount, releasedAmount: 0, allocatedBy: ctx.uid, allocatedAt: now, links: [...linksOf(approval), approval.id] }, `allocation-${r.id}`)
            result = set(r, { status: 'Approved', budgetId: budget.id, committedAmount: approvedAmount, approvedAmount, approvedBy: ctx.uid, approvedAt: now, remarks, ownerSelfApproved: ownerSelfApproval, financeApprovalId: approval.id, budgetAllocationId: allocation.id })
            const procurement = linked(r.procurementId, 'procurement')
            if (procurement) set(procurement, { status: 'Approved' })
          } else {
            const remarks = required(input.remarks, 'Decision reason')
            result = set(r, { status: 'Rejected', remarks, reviewedBy: ctx.uid, reviewedAt: now })
            const procurement = linked(r.procurementId, 'procurement')
            if (procurement) set(procurement, { status: 'Rejected', financeDecision: action, financeRemarks: remarks })
          }
        } else if (action === 'issue') { allow(ctx, 'procurement:review'); demand(r.status === 'Approved', 'Finance approval is required before sending the PO to the supplier.'); evidence(r, 'Upload the approved PO first.'); result = set(r, { status: 'Receiving', sentBy: ctx.uid, sentAt: now }); const procurement = linked(r.procurementId, 'procurement'); if (procurement) set(procurement, { status: 'Ordered' }) }
        else if (action === 'confirm') {
          allow(ctx, 'procurement:review')
          demand(r.status === 'Receiving', 'The PO is not ready for supplier confirmation.')
          const reason = required(input.remarks, 'Supplier confirmation details')
          const confirmationId = `confirmation-${r.id}`
          const oldConfirmation = records.find(record => record.id === confirmationId && record.kind === 'supplierConfirmation')
          const confirmationData = { status: 'Accepted', poId: r.id, supplierId: r.supplierId, response: 'Accepted', reason, confirmedDeliveryDate: input.deliveryDate ? dateKey(input.deliveryDate) : r.deliveryDate, respondedBy: ctx.uid, respondedAt: now, links: [...linksOf(r), r.id] }
          const confirmation = oldConfirmation ? set(oldConfirmation, confirmationData) : create('supplierConfirmation', confirmationData, confirmationId)
          result = set(r, { status: 'Receiving', supplierConfirmationId: confirmation.id, confirmationReason: reason, deliveryDate: confirmationData.confirmedDeliveryDate, confirmedBy: ctx.uid, confirmedAt: now })
        }        else if (action === 'resend') { allow(ctx, 'procurement:review'); demand(r.status === 'Rejected', 'Only rejected POs can be revised.'); result = set(r, { status: 'Draft', revision: required(input.remarks, 'Revision details') }) }
        else if (action === 'cancel') {
          allow(ctx, 'procurement:review')
          demand(!['Cancelled', 'Completed', 'Shipped', 'Claimed by Logistics', 'Partially Received', 'Delivered'].includes(r.status) && !records.some(record => record.poId === r.id && ['receiving', 'invoice', 'payment'].includes(record.kind)), 'A shipped, received, or invoiced order cannot be cancelled. Continue with delivery receiving and inspection instead.')
          if (r.budgetId && Number(r.committedAmount || 0) > 0) {
            const budget = get(r.budgetId, 'budget')
            set(budget, { committed: Math.max(0, budget.committed - r.committedAmount) })
            if (r.budgetAllocationId) set(get(r.budgetAllocationId, 'budgetAllocation'), { status: 'Released', releasedAmount: r.committedAmount, releasedBy: ctx.uid, releasedAt: now })
          }
          result = set(r, { status: 'Cancelled', committedAmount: 0, remarks: required(input.remarks, 'Cancellation reason') })
          set(get(r.procurementId, 'procurement'), { status: 'Cancelled' })
        }
        else demand(false, 'Invalid PO action.')
      } else if (r.kind === 'receiving' && action === 'onboard') {
        allow(ctx, 'inventory:create'); if (r.status === 'Onboarded') return { id: r.id, alreadyRecorded: true }
        demand(r.status === 'Inspected', 'Inspection is required.'); const po = get(r.poId, 'po'); const accepted = { ...po.accepted }
        for (const line of r.lines) {
          if (!line.accepted) continue
          let item = items.find(i => i.id === line.itemId)
          const ordered = po.lines.find(l => l.itemId === line.itemId); demand(ordered, 'The ordered item is unavailable.')
          const isFirstReceipt = !item
          if (isFirstReceipt) item = { id: line.itemId, branchId, name: ordered.name, category: ordered.category || '', description: ordered.specifications || '', unit: ordered.unit || 'units', minStock: Number(ordered.minStock || 0), targetStock: Number(ordered.targetStock || ordered.quantity), maxStock: Number(ordered.maxStock || ordered.quantity), itemType: String(ordered.category || '').toLowerCase() === 'equipment' ? 'Equipment' : 'Material', consumability: String(ordered.category || '').toLowerCase() === 'equipment' ? 'Non-consumable' : 'Consumable', currentStock: 0, supplierCatalogItemId: ordered.supplierCatalogItemId || '' }
          accepted[line.itemId] = Number(accepted[line.itemId] || 0) + line.accepted
          demand(accepted[line.itemId] <= ordered.quantity, 'Receipt exceeds ordered quantity.')
          if (line.serialNumber) { demand(line.accepted === 1, 'Receive serialized equipment one unit per receiving record.'); demand(!docs(lotSnap).some(l => l.serialNumber === line.serialNumber && l.itemId === item.id), 'This equipment serial number has already been received.') }
          writes.push([db.collection('supplyLots').doc(`${r.id}-${item.id}`), { branchId, itemId: item.id, receivingId: r.id, poId: po.id, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || '', receivedQuantity: line.accepted, remainingQuantity: line.accepted, lot: line.lot || '', manufacturingDate: line.manufacturingDate || '', expiryDate: line.expiryDate || '', serialNumber: line.serialNumber || '', modelNumber: line.modelNumber || '', warranty: line.warranty || '', condition: line.condition, location: po.deliveryLocation, unitCost: ordered.unitPrice, receivedAt: now }, false])
          writes.push([db.collection('inventoryItems').doc(item.id), { ...item, currentStock: Number(item.currentStock || 0) + line.accepted, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || item.supplierCatalogItemId || '', receivedAt: now, updatedAt: now, createdAt: isFirstReceipt ? now : item.createdAt || now, manufacturingDate: line.manufacturingDate || item.manufacturingDate || '', expiryDate: Number(item.currentStock || 0) > 0 && item.expiryDate ? [item.expiryDate, line.expiryDate].filter(Boolean).sort()[0] : line.expiryDate || '', serialNumber: line.serialNumber || item.serialNumber || '', modelNumber: line.modelNumber || item.modelNumber || '', warranty: line.warranty || item.warranty || '', condition: line.condition, location: ordered.location || po.deliveryLocation, costPrice: ordered.unitPrice / 100 }, true])
          writes.push([db.collection('inventoryMovements').doc(`${r.id}-${item.id}`), { branchId, inventoryItemId: item.id, receivingId: r.id, inspectionId: r.inspectionId, poId: po.id, supplierId: po.supplierId, supplierCatalogItemId: ordered.supplierCatalogItemId || '', quantity: line.accepted, type: 'purchase_receipt', createdBy: ctx.uid, createdAt: now, lot: line.lot, expiryDate: line.expiryDate }, false])
        }
        const complete = po.lines.every(l => Number(accepted[l.itemId] || 0) === l.quantity)
        set(po, { accepted, status: 'Receiving' }); result = set(r, { status: 'Onboarded', onboardedBy: ctx.uid, onboardedAt: now })
      } else if (r.kind === 'discrepancy' && action === 'resolve') { allow(ctx, 'inventory:create'); demand(r.status === 'Open', 'Discrepancy is already resolved.'); demand(['Return to supplier', 'Replacement', 'Credit', 'Refund', 'Other resolution'].includes(input.resolutionType), 'Select a resolution type.', 400); result = set(r, { status: 'Resolved', resolutionType: input.resolutionType, resolution: required(input.remarks, 'Resolution'), resolvedBy: ctx.uid, resolvedAt: now }) }
      else if (r.kind === 'invoice' && action === 'reviseInvoice') {
        const po = get(r.poId, 'po'); manualOrSupplier(po, 'finance:payables:approve')
        demand(['Submitted', 'Disputed'].includes(r.status), 'Matched or approved invoices cannot be edited.')
        result = set(r, { ...quoteTotals(input, { requireStatedTotal: true }), status: 'Submitted', invoiceDate: dateKey(input.invoiceDate), revisionReason: required(input.remarks, 'Invoice revision reason'), matchIssues: [] })
      }
      else if (r.kind === 'invoice') {
        allow(ctx, action === 'pay' ? 'finance:payables:settle' : 'finance:payables:approve'); const po = get(r.poId, 'po')
        if (action === 'startVerification') { demand(['Submitted', 'Disputed'].includes(r.status), 'Invoice cannot enter verification.'); evidence(r, 'Upload the supplier invoice document.'); result = set(r, { status: 'Under Verification', verificationStartedBy: ctx.uid, verificationStartedAt: now }) }
        else if (action === 'verify') { demand(r.status === 'Under Verification', 'Start invoice verification first.'); const issues = invoiceMatch(po, r, records.filter(i => i.kind === 'invoice' && i.poId === po.id && i.id !== r.id)), matchedReceiving = records.filter(x => x.kind === 'receiving' && x.poId === po.id && x.status === 'Onboarded'), receivingIds = matchedReceiving.map(x => x.id), traceLinks = [...new Set([...linksOf(r), ...matchedReceiving.flatMap(x => [x.id, x.inspectionId].filter(Boolean))])]; const matchId = `match-${r.id}`, existingMatch = records.find(x => x.id === matchId && x.kind === 'threeWayMatch'); const matchData = { status: issues.length ? 'Disputed' : 'Matched', invoiceId: r.id, poId: po.id, receivingIds, supplierId: r.supplierId, issues, checkedBy: ctx.uid, checkedAt: now, links: [...traceLinks, r.id] }; if (existingMatch) set(existingMatch, matchData); else create('threeWayMatch', matchData, matchId); result = set(r, { status: issues.length ? 'Disputed' : 'Matched', receivingIds, links: traceLinks, threeWayMatchId: matchId, matchIssues: issues, verifiedBy: ctx.uid, verifiedAt: now }) }
        else if (action === 'approve') { demand(r.status === 'Matched', 'Three-way matching is required.'); demand(r.createdBy !== ctx.uid && r.verifiedBy !== ctx.uid, 'Invoice approval must be performed by another Finance user.'); result = set(r, { status: 'Approved for Payment', approvedBy: ctx.uid, approvedAt: now }) }
        else if (action === 'preparePayment') {
          demand(r.status === 'Approved for Payment', 'Approve the invoice before preparing payment.')
          demand(!records.some(p => p.kind === 'payment' && p.invoiceId === r.id && p.status !== 'Rejected'), 'A payment is already prepared.')
          result = create('payment', { status: 'Pending', mode: po.mode, supplierId: po.supplierId, invoiceId: r.id, poId: po.id, budgetId: po.budgetId, total: r.total, amount: r.total, links: [...linksOf(r), r.id], invoiceApprovedBy: r.approvedBy }, `payment-${r.id}`)
        }
        else if (action === 'pay') {
          if (r.status === 'Paid') return { id: r.id, alreadyRecorded: true }
          demand(r.status === 'Approved for Payment', 'Invoice must be approved for payment.')
          const payment = get(`payment-${r.id}`, 'payment'); demand(payment.status === 'Processing', 'Prepare, approve and start the payment before recording settlement.')
          const proof = documents.find(d => d.id === input.proofId && [r.id, payment.id].includes(d.recordId)); demand(proof, 'Upload and select payment evidence from the payment record.')
          const budget = get(po.budgetId, 'budget'); demand(budget.committed >= r.total && po.committedAmount >= r.total, 'Insufficient reserved funds.')
          demand(['Manual Payment', 'Digital Transfer'].includes(input.method), 'Select the payment recording method.')
          const paidAmount = po.paidAmount + r.total, remaining = po.committedAmount - r.total
          const allReceived = po.lines.every(l => Number(po.accepted?.[l.itemId] || 0) === l.quantity)
          const paidInvoices = records.filter(i => i.kind === 'invoice' && i.poId === po.id && (i.status === 'Paid' || i.id === r.id))
          const complete = allReceived && po.lines.every(line => paidInvoices.reduce((sum, i) => sum + (i.lines.find(l => l.itemId === line.itemId)?.quantity || 0), 0) === line.quantity)
          set(payment, { status: 'Paid', method: input.method, reference: required(input.reference, 'Payment reference'), paymentDate: dateKey(input.paymentDate), proofId: proof.id, processedBy: ctx.uid, paidAt: now })
          financialWrites.push([db.collection('financialRecords').doc(`supply-${r.id}`), { status: 'Paid', paidAmount: r.total, outstandingAmount: 0, paymentMethod: input.method, paymentReference: input.reference, paidAt: now, updatedAt: now }, true])
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
    // Notification recipients are best-effort. A legacy or deactivated staff
    // account must never turn a completed supply action into a server error.
    const staffResults = await Promise.allSettled(docs(staffSnap).filter(u => u.id !== ctx.uid).map(u => loadUserContext(u.id)))
    const staffContexts = staffResults.filter(result => result.status === 'fulfilled').map(result => result.value)
    for (const [ref, value, merge] of writes) {
      tx.set(ref, { ...value, updatedAt: now }, { merge })
      const previous = records.find(r => r.id === ref.id), changed = { ...previous, ...value }
      tx.set(db.collection('supplyAudit').doc(), { branchId, recordId: ref.id, parentActionRecordId: result.id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: changed.kind || (ref.parent.id === 'inventoryItems' ? 'inventory' : 'system'), action, previousStatus: previous?.status || '', newStatus: changed.status || '', before: previous || null, after: changed, details: input, ...ctx.auditContext, createdAt: now })
      if (!changed.kind) continue
      // Supply alerts are handoffs, not general record-change broadcasts. This
      // keeps each team focused on the action that has just reached its queue.
      const staffWith = permission => staffContexts.filter(user => hasPermission(user, permission)).map(user => user.uid)
      let recipients = [], title = '', message = '', link = ''
      if (changed.kind === 'procurement' && changed.status === 'Received') {
        recipients = staffWith('procurement:review'); title = 'Inventory request awaiting procurement'; message = `${changed.number} was sent by Inventory. Select a supplier and record the external quotation.`; link = '/procurement/requests'
      } else if (changed.kind === 'procurement' && changed.status === 'Returned to Inventory') {
        recipients = [changed.requesterId]; title = 'Inventory request returned'; message = `${changed.number} needs revision before Procurement can continue.`; link = '/inventory/requests'
      } else if (changed.kind === 'po' && changed.status === 'For Review') {
        recipients = staffWith('finance:payables:approve'); title = 'Purchase order awaiting Finance approval'; message = `${changed.number} is ready for budget and financial approval.`; link = '/finance/procurement/requests'
      } else if (changed.kind === 'po' && changed.status === 'Approved') {
        recipients = staffWith('procurement:review'); title = 'Purchase order approved'; message = `${changed.number} is approved and ready for Procurement to send externally.`; link = '/procurement/orders'
      } else if (changed.kind === 'po' && changed.status === 'Receiving' && changed.confirmedAt) {
        recipients = staffWith('inventory:create'); title = 'Supplier confirmation recorded'; message = `${changed.number} is confirmed and ready for delivery receiving.`; link = '/inventory/receiving'
      } else if (changed.kind === 'po' && ['Returned to Procurement', 'Rejected', 'Clarification Requested'].includes(changed.status)) {
        recipients = staffWith('procurement:review'); title = 'Purchase order needs Procurement action'; message = `${changed.number}: ${changed.status}. Review the external supplier or Finance response.`; link = '/procurement/orders'
      } else if (changed.kind === 'receiving' && changed.status === 'Inspected') {
        recipients = staffWith('inventory:create'); title = 'Inspected delivery awaiting Inventory onboarding'; message = `${changed.number} has been inspected. Onboard accepted stock into Inventory.`; link = '/inventory/receiving'
      } else if (changed.kind === 'discrepancy' && changed.status === 'Open') {
        recipients = staffWith('inventory:create'); title = 'Delivery discrepancy needs resolution'; message = `${changed.number} contains rejected or discrepant delivery items.`; link = '/inventory/receiving'
      } else if (changed.kind === 'invoice' && changed.status === 'Submitted') {
        recipients = staffWith('finance:payables:approve'); title = 'Supplier invoice awaiting verification'; message = `${changed.number} was submitted and needs three-way matching.`; link = '/finance/procurement/invoices'
      } else if (changed.kind === 'invoice' && changed.status === 'Approved for Payment') {
        recipients = staffWith('finance:payables:settle'); title = 'Supplier invoice ready for payment'; message = `${changed.number} was approved and is ready for payment processing.`; link = '/finance/procurement/invoices'
      } else if (changed.kind === 'payment' && changed.status === 'Pending') {
        recipients = staffWith('finance:payables:approve'); title = 'Supplier payment awaiting review'; message = `${changed.number} was prepared and needs Finance review.`; link = '/finance/procurement/invoices'
      } else if (changed.kind === 'payment' && changed.status === 'Approved') {
        recipients = staffWith('finance:payables:settle'); title = 'Supplier payment ready to process'; message = `${changed.number} was approved. Record the payment after it is made externally.`; link = '/finance/procurement/invoices'
      }
      for (const uid of new Set(recipients.filter(uid => uid && uid !== ctx.uid))) {
        tx.set(db.collection('notifications').doc(), { recipientUserId: uid, branchId, title, message, link, read: false, deleted: false, createdAt: now })
      }
    }
    for (const [ref, value, merge] of financialWrites) tx.set(ref, { ...value, updatedAt: now }, { merge })
    return { id: result.id, status: result.status }
  })
  const validateQuoteLines = (rfq, quote) => {
    demand(quote.lines.length === rfq.lines.length, 'Quote every requested item.')
    for (const line of quote.lines) { const expected = rfq.lines.find(l => l.itemId === line.itemId); demand(expected && line.quantity === expected.quantity, 'Quoted quantities must match the RFQ.') }
  }

  app.get('/supply/records/:id/history', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data(); await ensureRead(ctx, record)
    const history = docs(await db.collection('supplyAudit').where('recordId', '==', id).get())
    const documents = docs(await db.collection('supplyDocuments').where('recordId', '==', id).get())
    const messages = ['rfq', 'po'].includes(record.kind) ? docs(await db.collection('supplyMessages').where('recordId', '==', id).get()) : []
    res.json({ success: true, data: { history, messages, documents: documents.map(({ storagePath, ...d }) => d) } })
  }))
  app.post('/supply/records/:id/messages', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data()
    await ensureRead(ctx, record)
    demand(['rfq', 'po'].includes(record.kind) && record.status !== 'Draft', 'Communications require an issued RFQ or PO.')
    demand(record.mode !== 'Online', 'Historical online supplier transactions are read-only.', 403)
    allow(ctx, 'procurement:create')
    const supplierId = cleanId(req.body.supplierId), supplier = (await db.collection('suppliers').doc(supplierId).get()).data()
    demand(supplier && (record.supplierId === supplierId || record.supplierIds?.includes(supplierId)), 'Supplier is not part of this record.', 403)
    const channel = required(req.body.channel, 'External communication channel')
    demand(['Email', 'Phone', 'Physical document', 'External platform'].includes(channel), 'Choose a valid external communication channel.', 400)
    const ref = db.collection('supplyMessages').doc(), message = required(req.body.message, 'Communication notes'), now = stamp()
    await db.runTransaction(async tx => {
      tx.set(ref, { recordId: id, branchId: record.branchId, supplierId, message, channel, from: 'Procurement', communicationMode: 'Externally recorded', actorId: ctx.uid, createdAt: now })
      tx.set(db.collection('supplyAudit').doc(), { recordId: id, branchId: record.branchId, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: record.kind, action: 'external-supplier-communication-recorded', messageId: ref.id, supplierId, ...ctx.auditContext, createdAt: now })
    })
    res.json({ success: true, data: { id: ref.id } })
  }))
  app.post('/supply/records/:id/documents', requireAuth, wrap(async (req, res, ctx) => {
    const id = cleanId(req.params.id), record = (await db.collection('supplyRecords').doc(id).get()).data()
    await ensureRead(ctx, record)
    demand(record.mode !== 'Online', 'Historical online supplier transactions are read-only.', 403)
    const writers = { request: ['inventory:create'], procurement: ['procurement:create', 'procurement:review'], rfq: ['procurement:create', 'procurement:review'], quotation: ['procurement:create', 'procurement:review'], evaluation: ['procurement:review'], financeApproval: ['finance:payables:approve'], budgetAllocation: ['finance:payables:approve'], po: ['procurement:review', 'finance:payables:approve'], supplierConfirmation: ['procurement:review'], receiving: ['inventory:create'], inspection: ['inventory:create'], discrepancy: ['inventory:create'], budget: ['finance:payables:approve'], budgetRequest: ['procurement:review', 'finance:payables:approve'], invoice: ['finance:payables:approve', 'finance:payables:settle'], threeWayMatch: ['finance:payables:approve'], payment: ['finance:payables:settle'] }
    demand((writers[record.kind] || []).some(permission => hasPermission(ctx, permission)), 'Document upload requires write permission.', 403)
    const { contentType, data, name } = req.body
    demand(['application/pdf', 'image/png', 'image/jpeg'].includes(contentType), 'Upload PDF, PNG or JPEG.', 400)
    const bytes = Buffer.from(String(data || ''), 'base64'); demand(bytes.length > 0 && bytes.length <= 5 * 1024 * 1024, 'File limit is 5 MB.', 400)
    const header = bytes.subarray(0, 8)
    demand(contentType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : contentType === 'image/png' ? header.equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216, 'File content does not match its type.', 400)
    const ref = db.collection('supplyDocuments').doc(), storagePath = `supply-documents/${record.branchId}/${id}/${ref.id}`
    const file = admin.storage().bucket(storageBucket()).file(storagePath)
    await file.save(bytes, { metadata: { contentType }, resumable: false })
    try { await ref.set({ recordId: id, branchId: record.branchId, name: required(name, 'Filename'), contentType, size: bytes.length, storagePath, visibility: 'internal', supplierIds: record.supplierId ? [record.supplierId] : record.supplierIds || [], uploadedBy: ctx.uid, createdAt: stamp() }) } catch (e) { await file.delete().catch(() => {}); throw e }
    await db.collection('supplyAudit').add({ branchId: record.branchId, recordId: id, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: record.kind, action: 'document-upload', documentId: ref.id, filename: required(name, 'Filename'), ...ctx.auditContext, createdAt: stamp() })
    res.json({ success: true, data: { id: ref.id } })
  }))
  app.get('/supply/documents/:id', requireAuth, wrap(async (req, res, ctx) => {
    const d = (await db.collection('supplyDocuments').doc(cleanId(req.params.id)).get()).data(); demand(d, 'Document not found.', 404)
    const r = (await db.collection('supplyRecords').doc(d.recordId).get()).data(); await ensureRead(ctx, r)
    const [url] = await admin.storage().bucket(storageBucket()).file(d.storagePath).getSignedUrl({ action: 'read', expires: Date.now() + 60000 })
    res.json({ success: true, data: { url } })
  }))
}
