import { subscriptionLifecycle } from '../../shared/subscriptionLifecycle.js'
import { demand, money, quantity, hasPermission } from './supplyModel.js'
import { lotAvailableQuantity, planLotConsumption } from './inventoryLots.js'
import { reservedMaterialQuantity } from './bookingWorkflow.js'

const cleanId = value => { const id = String(value || ''); demand(/^[A-Za-z0-9_-]{1,150}$/.test(id), 'Invalid identifier.', 400); return id }
const localDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const pharmacyInventoryProjection = (item, availableStock = null) => ({
  id: String(item.id || ''),
  name: String(item.name || 'Pharmacy item'),
  category: String(item.category || ''),
  unit: String(item.unit || 'units'),
  currentStock: Math.max(0, Number(item.currentStock || 0)),
  reservedStock: Math.max(0, Number(item.reservedStock || 0)),
  availableStock: Math.max(0, Number(availableStock ?? (Number(item.currentStock || 0) - Number(item.reservedStock || 0)))),
  expiryDate: String(item.expiryDate || ''),
  pharmacyEnabled: item.pharmacyEnabled === true,
  dispensingClass: String(item.dispensingClass || 'unclassified'),
  retailPrice: Math.max(0, Number(item.retailPrice || 0)),
})

export const registerPharmacyWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const identity = async req => {
    const ctx = await loadUserContext(req.user.uid)
    const supplier = [ctx.roleKey, ctx.userData?.role, ctx.userData?.userType]
      .some(value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '').startsWith('supplier'))
    demand(!supplier, 'Supplier accounts are no longer supported. Suppliers are managed as clinic business contacts.', 403)
    return ctx
  }
  const branchAccess = async (ctx, rawBranchId, permission) => {
    const branchId = cleanId(rawBranchId)
    demand(hasPermission(ctx, permission), 'You do not have permission for this pharmacy action.', 403)
    const clinicSnap = await db.collection('clinics').doc(branchId).get()
    const clinic = clinicSnap.data() || {}
    const assigned = [ctx.userData.branchId, ...(Array.isArray(ctx.userData.branchIds) ? ctx.userData.branchIds : [])].filter(Boolean).includes(branchId)
    demand(clinicSnap.exists && (clinic.ownerId === ctx.uid || assigned || clinic.branchAdminId === ctx.uid), 'This branch is not assigned to your account.', 403)
    const subscription = subscriptionLifecycle(clinic)
    demand(['basic', 'premium'].includes(subscription.plan) && subscription.isOperational, 'Pharmacy POS requires an active Basic or Premium plan.', 403)
    return { branchId, clinic }
  }
  const wrap = handler => async (req, res) => {
    try { const ctx = await identity(req); ctx.uid = req.user.uid; await handler(req, res, ctx) }
    catch (error) { res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Pharmacy request failed.' }) }
  }
  app.get('/pharmacy/pos', requireAuth, wrap(async (req, res, ctx) => {
    const { branchId } = await branchAccess(ctx, req.query.branchId, 'pharmacy:view')
    const [itemsSnap, salesSnap, lotsSnap, appointmentsSnap] = await Promise.all([
      db.collection('inventoryItems').where('branchId', '==', branchId).get(),
      db.collection('pharmacySales').where('branchId', '==', branchId).get(),
      db.collection('supplyLots').where('branchId', '==', branchId).get(),
      db.collection('appointments').where('branchId', '==', branchId).get(),
    ])
    const lotRecords = lotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const lotsByItem = new Map()
    for (const lot of lotRecords) {
      const rows = lotsByItem.get(String(lot.itemId || '')) || []
      rows.push(lot)
      lotsByItem.set(String(lot.itemId || ''), rows)
    }
    const appointments = appointmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .map(item => pharmacyInventoryProjection({
        ...item,
        reservedStock: Number(item.reservedStock || 0) + reservedMaterialQuantity(appointments, item.id),
      }, lotAvailableQuantity({
        branchId,
        itemId: item.id,
        item: { ...item, reservedStock: Number(item.reservedStock || 0) + reservedMaterialQuantity(appointments, item.id) },
        lotRecords: lotsByItem.get(item.id) || [],
        today: localDay(),
      })))
    const prescriptionQueue = appointments
      .filter(appointment => String(appointment.type || '').toLowerCase() === 'consultation'
        && String(appointment.status || '').toLowerCase() === 'completed'
        && (Array.isArray(appointment.prescriptions) ? appointment.prescriptions.length > 0 : Boolean(appointment.prescription))
        && String(appointment.prescriptionStatus || 'pending').toLowerCase() !== 'dispensed')
      .map(appointment => ({
        id: appointment.id,
        customerName: String(appointment.customerName || appointment.clientName || appointment.patientName || 'Customer'),
        service: String(appointment.service || appointment.serviceName || 'Consultation'),
        date: String(appointment.date || ''),
        time: String(appointment.time || ''),
        prescriptionStatus: String(appointment.prescriptionStatus || 'pending'),
        prescriptions: Array.isArray(appointment.prescriptions) ? appointment.prescriptions : appointment.prescription ? [appointment.prescription] : [],
      }))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    const sales = salesSnap.docs.map(doc => {
      const sale = doc.data() || {}
      return {
        id: doc.id,
        receiptNumber: String(sale.receiptNumber || ''),
        customerName: String(sale.customerName || ''),
        total: Math.max(0, Number(sale.total || 0)),
        paymentMethod: String(sale.paymentMethod || ''),
        createdAt: sale.createdAt || null,
      }
    }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 30)
    res.json({ success: true, data: { items, sales, prescriptions: prescriptionQueue } })
  }))
  app.get('/pharmacy/prescription', requireAuth, wrap(async (req, res, ctx) => {
    const { branchId } = await branchAccess(ctx, req.query.branchId, 'pharmacy:view')
    const appointmentId = cleanId(req.query.appointmentId), snapshot = await db.collection('appointments').doc(appointmentId).get(), appointment = snapshot.data() || {}
    demand(snapshot.exists && appointment.branchId === branchId && String(appointment.type || '').toLowerCase() === 'consultation' && String(appointment.status || '').toLowerCase() === 'completed' && (Array.isArray(appointment.prescriptions) ? appointment.prescriptions.length > 0 : Boolean(appointment.prescription)), 'The linked consultation prescription is unavailable.', 404)
    res.json({ success: true, data: { appointment: { id: appointmentId, branchId, customerName: appointment.customerName || appointment.clientName || '', service: appointment.service || appointment.serviceName || '', prescriptions: appointment.prescriptions || appointment.prescription, prescriptionStatus: appointment.prescriptionStatus || 'pending', prescriptionDispensedQuantities: appointment.prescriptionDispensedQuantities || {} } } })
  }))
  app.post('/pharmacy/items/:id/settings', requireAuth, wrap(async (req, res, ctx) => {
    const branchId = cleanId(req.body.branchId), itemId = cleanId(req.params.id)
    await branchAccess(ctx, branchId, 'pharmacy:manage')
    const pharmacyEnabled = req.body.pharmacyEnabled === true
    const dispensingClass = String(req.body.dispensingClass || 'unclassified')
    demand(['general_sale', 'prescription_required', 'restricted', 'unclassified'].includes(dispensingClass), 'Choose a valid dispensing classification.', 400)
    const retailPrice = money(req.body.retailPrice || 0)
    demand(!pharmacyEnabled || (dispensingClass !== 'unclassified' && retailPrice > 0), 'Choose a dispensing classification and set a retail price before adding this item to Pharmacy.', 400)
    const ref = db.collection('inventoryItems').doc(itemId)
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref), item = snapshot.data() || {}
      demand(snapshot.exists && item.branchId === branchId, 'Inventory item not found in this branch.', 404)
      const now = stamp(), after = { pharmacyEnabled, dispensingClass, retailPrice: retailPrice / 100, updatedAt: now }
      tx.update(ref, after)
      tx.set(db.collection('supplyAudit').doc(), { branchId, recordId: itemId, actorId: ctx.uid, actorName: ctx.userData.fullName || ctx.userData.email || ctx.uid, role: ctx.roleKey, module: 'pharmacy', action: 'pharmacy-item-settings-updated', before: { pharmacyEnabled: item.pharmacyEnabled === true, dispensingClass: item.dispensingClass || 'unclassified', retailPrice: Number(item.retailPrice || 0) }, after, createdAt: now })
    })
    res.json({ success: true, data: { id: itemId, pharmacyEnabled, dispensingClass, retailPrice: retailPrice / 100 } })
  }))
  app.post('/pharmacy/checkout', requireAuth, wrap(async (req, res, ctx) => {
    const { branchId } = await branchAccess(ctx, req.body.branchId, 'pharmacy:dispense')
    const appointmentId = String(req.body.appointmentId || '').trim()
    demand(appointmentId, 'Select a completed consultation prescription before dispensing.', 409)
    cleanId(appointmentId)
    const lines = Array.isArray(req.body.items) ? req.body.items : []
    demand(lines.length > 0 && lines.length <= 40, 'Add 1–40 pharmacy items to the sale.', 400)
    const seen = new Set(), requested = lines.map(line => {
      const itemId = cleanId(line.itemId), count = quantity(line.quantity)
      demand(!seen.has(itemId), 'Each pharmacy item can appear only once in a sale.', 400); seen.add(itemId)
      return { itemId, quantity: count }
    })
    const method = String(req.body.paymentMethod || '')
    demand(['Cash', 'Card (external terminal)', 'E-wallet (external)'].includes(method), 'Choose a supported in-person payment method.', 400)
    const saleId = cleanId(req.body.checkoutId), saleRef = db.collection('pharmacySales').doc(saleId)
    const transactionRef = db.collection('transactions').doc(`pharmacy-${saleId}`)
    const movementRefs = requested.map(line => db.collection('inventoryMovements').doc(`pharmacy-${saleId}-${line.itemId}`))
    let sale
    await db.runTransaction(async tx => {
      const existingSale = await tx.get(saleRef)
      if (existingSale.exists) {
        const previous = existingSale.data() || {}
        demand(previous.branchId === branchId, 'Checkout ID belongs to another clinic branch.', 403)
        sale = { ...previous, alreadyRecorded: true }
        return
      }
      const refs = requested.map(line => db.collection('inventoryItems').doc(line.itemId))
      const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
      const appointmentRows = await tx.get(db.collection('appointments').where('branchId', '==', branchId))
      const activeAppointments = appointmentRows.docs.map(doc => doc.data())
      const pricedLines = requested.map((line, index) => {
        const snapshot = snapshots[index], item = snapshot.data() || {}
        demand(snapshot.exists && item.branchId === branchId && item.pharmacyEnabled === true, 'A selected item is no longer enabled for Pharmacy.', 409)
        const dispensingClass = item.dispensingClass || 'unclassified'
        demand(dispensingClass === 'prescription_required', `${item.name || 'This item'} is not configured for prescription dispensing.`, 409)
        const reserved = Number(item.reservedStock || 0) + reservedMaterialQuantity(activeAppointments, item.id)
        const available = Number(item.currentStock || 0) - reserved
        demand(available >= line.quantity, `Insufficient stock for ${item.name || 'an item'}; ${Math.max(0, available)} available.`, 409)
        const priceCents = money(item.retailPrice)
        demand(priceCents > 0, `${item.name || 'An item'} needs a retail price before it can be sold.`, 409)
        return { ...line, ref: refs[index], item, dispensingClass, name: String(item.name || 'Pharmacy item'), unit: String(item.unit || 'units'), unitPrice: priceCents / 100, total: priceCents * line.quantity / 100 }
      })
      const totalCents = pricedLines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0)
      demand(Number.isSafeInteger(totalCents) && totalCents > 0, 'Sale total is invalid.', 400)
      const tenderedCents = method === 'Cash' ? money(req.body.cashTendered) : totalCents
      demand(tenderedCents >= totalCents, 'Cash received is less than the sale total.', 400)
      const appointmentRef = db.collection('appointments').doc(appointmentId)
      const appointmentSnap = await tx.get(appointmentRef)
      const linkedAppointment = appointmentSnap.data() || {}
      demand(appointmentSnap.exists && linkedAppointment.branchId === branchId && String(linkedAppointment.type || '').toLowerCase() === 'consultation' && String(linkedAppointment.status || '').toLowerCase() === 'completed' && (Array.isArray(linkedAppointment.prescriptions) ? linkedAppointment.prescriptions.length > 0 : Boolean(linkedAppointment.prescription)), 'The linked consultation prescription is unavailable.', 409)
      const prescribed = linkedAppointment
        ? (Array.isArray(linkedAppointment.prescriptions) ? linkedAppointment.prescriptions : linkedAppointment.prescription ? [linkedAppointment.prescription] : [])
        : []
      const medicationName = entry => String(typeof entry === 'string' ? entry : entry?.name || entry?.medication || entry?.productName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const prescriptionKey = entry => {
        const inventoryItemId = String(typeof entry === 'object' ? entry?.inventoryItemId || entry?.itemId || '' : '').trim()
        return inventoryItemId ? `item:${inventoryItemId}` : medicationName(entry)
      }
      const prescribedByKey = new Map()
      for (const entry of prescribed) {
        const key = prescriptionKey(entry)
        if (!key) continue
        const amount = typeof entry === 'object' ? Number(entry.quantity ?? entry.totalQuantity) : NaN
        const prior = prescribedByKey.get(key) || { quantity: 0, valid: true }
        if (!Number.isSafeInteger(amount) || amount < 1) prior.valid = false
        else prior.quantity += amount
        prescribedByKey.set(key, prior)
      }
      const requestedByPrescription = new Map()
      for (const line of pricedLines) {
        const exactKey = `item:${line.itemId}`
        const legacyNameKey = medicationName(line.item.name)
        const key = prescribedByKey.has(exactKey) ? exactKey : legacyNameKey
        const allowance = prescribedByKey.get(key)
        demand(allowance, `${line.name} is not listed on the linked consultation prescription.`, 409)
        demand(allowance.valid && allowance.quantity > 0, `${line.name} needs an explicit prescribed quantity. Ask the clinician to update the prescription before dispensing.`, 409)
        requestedByPrescription.set(key, (requestedByPrescription.get(key) || 0) + line.quantity)
      }
      const nextDispensedQuantities = { ...(linkedAppointment?.prescriptionDispensedQuantities || {}) }
      for (const [key, requestedQuantity] of requestedByPrescription) {
        const allowance = prescribedByKey.get(key).quantity
        const alreadyDispensed = Number(nextDispensedQuantities[key] || 0)
        demand(Number.isSafeInteger(alreadyDispensed) && alreadyDispensed >= 0, 'Prescription dispensing history is invalid; ask the clinic to review it.', 409)
        demand(alreadyDispensed + requestedQuantity <= allowance, `Only ${Math.max(0, allowance - alreadyDispensed)} prescribed units of this item remain.`, 409)
        nextDispensedQuantities[key] = alreadyDispensed + requestedQuantity
      }
      const lotSnapshots = await Promise.all(pricedLines.map(line => tx.get(db.collection('supplyLots').where('itemId', '==', line.itemId))))
      const plannedLines = pricedLines.map((line, index) => ({
        ...line,
        lotPlan: planLotConsumption({
          branchId,
          itemId: line.itemId,
          item: { ...line.item, reservedStock: Number(line.item.reservedStock || 0) + reservedMaterialQuantity(activeAppointments, line.itemId) },
          lotRecords: lotSnapshots[index].docs.map(doc => ({ id: doc.id, ...doc.data() })),
          quantity: line.quantity,
          today: localDay(),
        }),
      }))
      const prescriptionsFullyDispensed = prescribed.length > 0
        && [...prescribedByKey.entries()].every(([key, allowance]) => allowance.valid && allowance.quantity > 0 && Number(nextDispensedQuantities[key] || 0) >= allowance.quantity)
      const now = stamp(), createdAt = new Date().toISOString(), customerName = String(req.body.customerName || '').trim().slice(0, 120)
      const receiptNumber = `PH-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${saleId.slice(0, 6).toUpperCase()}`
      const items = plannedLines.map(({ itemId, quantity: count, name, unit, unitPrice, total, dispensingClass, lotPlan }) => ({ itemId, name, quantity: count, unit, unitPrice, total, dispensingClass, lotAllocations: lotPlan.allocations }))
      sale = { id: saleId, receiptNumber, branchId, customerName, items, subtotal: totalCents / 100, total: totalCents / 100, amount: totalCents / 100, paymentMethod: method, cashTendered: tenderedCents / 100, change: (tenderedCents - totalCents) / 100, paymentStatus: 'Paid', status: 'Completed', source: 'clinic_pharmacy_pos', createdBy: ctx.uid, createdAt, ...(appointmentId ? { appointmentId } : {}) }
      plannedLines.forEach(line => {
        tx.update(line.ref, { currentStock: Number(line.item.currentStock || 0) - line.quantity, updatedAt: now })
        line.lotPlan.lotWrites.forEach(write => tx.set(db.collection('supplyLots').doc(write.id), {
          ...write.data,
          ...(write.created ? { receivedAt: now, createdAt: now } : {}),
          updatedAt: now,
        }, { merge: true }))
      })
      tx.set(saleRef, { ...sale, createdAt: now })
      tx.set(transactionRef, { branchId, customerName, items, amount: totalCents / 100, total: totalCents / 100, type: 'product_sale', method, status: 'Paid', source: 'clinic_pharmacy_pos', pharmacySaleId: saleId, receiptNumber, createdBy: ctx.uid, createdAt: now })
      plannedLines.forEach((line, index) => tx.set(movementRefs[index], {
        branchId,
        inventoryItemId: line.itemId,
        quantity: -line.quantity,
        type: 'pharmacy_sale',
        pharmacySaleId: saleId,
        receiptNumber,
        lotAllocations: line.lotPlan.allocations,
        lotAdjustments: line.lotPlan.adjustments,
        createdBy: ctx.uid,
        createdAt: now,
      }))
      if (requestedByPrescription.size) tx.update(appointmentRef, {
        prescriptionDispensedQuantities: nextDispensedQuantities,
        prescriptionStatus: prescriptionsFullyDispensed ? 'dispensed' : 'partially_dispensed',
        prescriptionLastDispensedAt: now,
        prescriptionLastDispensedBy: ctx.uid,
        prescriptionLastPharmacySaleId: saleId,
        ...(prescriptionsFullyDispensed ? { prescriptionDispensedAt: now, prescriptionDispensedBy: ctx.uid, pharmacySaleId: saleId } : {}),
      })
    })
    res.json({ success: true, data: sale })
  }))
}
