import { subscriptionLifecycle } from '../../shared/subscriptionLifecycle.js'
import { demand, money, quantity } from './supplyModel.js'

const cleanId = value => { const id = String(value || ''); demand(/^[A-Za-z0-9_-]{1,150}$/.test(id), 'Invalid identifier.', 400); return id }
const localDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const registerPharmacyWorkflow = (app, { admin, requireAuth, loadUserContext }) => {
  const db = admin.firestore(), stamp = () => admin.firestore.FieldValue.serverTimestamp()
  const branchAccess = async (ctx, rawBranchId, permission) => {
    const branchId = cleanId(rawBranchId)
    demand(hasPermission(ctx, permission), 'You do not have permission for this pharmacy action.', 403)
    const clinicSnap = await db.collection('clinics').doc(branchId).get()
    const clinic = clinicSnap.data() || {}
    const assigned = [ctx.userData.branchId, ...(Array.isArray(ctx.userData.branchIds) ? ctx.userData.branchIds : [])].filter(Boolean).includes(branchId)
    demand(clinicSnap.exists && (clinic.ownerId === ctx.uid || assigned || clinic.branchAdminId === ctx.uid), 'This branch is not assigned to your account.', 403)
    demand(subscriptionLifecycle(clinic).plan !== 'free', 'Pharmacy POS requires a Basic or Premium plan.', 403)
    return { branchId, clinic }
  }
  const wrap = handler => async (req, res) => {
    try { const ctx = await loadUserContext(req.user.uid); ctx.uid = req.user.uid; await handler(req, res, ctx) }
    catch (error) { res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Pharmacy request failed.' }) }
  }
  app.get('/pharmacy/pos', requireAuth, wrap(async (req, res, ctx) => {
    const { branchId } = await branchAccess(ctx, req.query.branchId, 'pharmacy:view')
    const [itemsSnap, salesSnap] = await Promise.all([
      db.collection('inventoryItems').where('branchId', '==', branchId).get(),
      db.collection('pharmacySales').where('branchId', '==', branchId).get(),
    ])
    const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => item.pharmacyEnabled === true)
    const sales = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 30)
    res.json({ success: true, data: { items, sales } })
  }))
  app.get('/pharmacy/prescription', requireAuth, wrap(async (req, res, ctx) => {
    const { branchId } = await branchAccess(ctx, req.query.branchId, 'pharmacy:view')
    const appointmentId = cleanId(req.query.appointmentId), snapshot = await db.collection('appointments').doc(appointmentId).get(), appointment = snapshot.data() || {}
    demand(snapshot.exists && appointment.branchId === branchId && String(appointment.type || '').toLowerCase() === 'consultation' && String(appointment.status || '').toLowerCase() === 'completed' && (Array.isArray(appointment.prescriptions) ? appointment.prescriptions.length > 0 : Boolean(appointment.prescription)), 'The linked consultation prescription is unavailable.', 404)
    res.json({ success: true, data: { appointment: { id: appointmentId, branchId, customerName: appointment.customerName || appointment.clientName || '', service: appointment.service || appointment.serviceName || '', prescriptions: appointment.prescriptions || appointment.prescription, prescriptionStatus: appointment.prescriptionStatus || 'pending' } } })
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
      if (existingSale.exists) { sale = { ...existingSale.data(), alreadyRecorded: true }; return }
      const refs = requested.map(line => db.collection('inventoryItems').doc(line.itemId))
      const snapshots = await Promise.all(refs.map(ref => tx.get(ref)))
      const pricedLines = requested.map((line, index) => {
        const snapshot = snapshots[index], item = snapshot.data() || {}
        demand(snapshot.exists && item.branchId === branchId && item.pharmacyEnabled === true, 'A selected item is no longer enabled for Pharmacy.', 409)
        const dispensingClass = item.dispensingClass || 'unclassified'
        demand(dispensingClass !== 'unclassified', `${item.name || 'This item'} needs a dispensing classification before it can be sold.`, 409)
        demand(dispensingClass !== 'restricted', `${item.name || 'This item'} is restricted and cannot be dispensed through the Pharmacy POS.`, 409)
        demand(!item.expiryDate || item.expiryDate >= localDay(), `${item.name || 'An item'} is expired and cannot be sold.`, 409)
        const available = Number(item.currentStock || 0) - Number(item.reservedStock || 0)
        demand(available >= line.quantity, `Insufficient stock for ${item.name || 'an item'}; ${Math.max(0, available)} available.`, 409)
        const priceCents = money(item.retailPrice)
        demand(priceCents > 0, `${item.name || 'An item'} needs a retail price before it can be sold.`, 409)
        return { ...line, ref: refs[index], item, dispensingClass, name: String(item.name || 'Pharmacy item'), unit: String(item.unit || 'units'), unitPrice: priceCents / 100, total: priceCents * line.quantity / 100 }
      })
      const totalCents = pricedLines.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0)
      demand(Number.isSafeInteger(totalCents) && totalCents > 0, 'Sale total is invalid.', 400)
      const tenderedCents = method === 'Cash' ? money(req.body.cashTendered) : totalCents
      demand(tenderedCents >= totalCents, 'Cash received is less than the sale total.', 400)
      const appointmentId = String(req.body.appointmentId || '')
      let appointmentRef = null
      let linkedAppointment = null
      if (appointmentId) {
        appointmentRef = db.collection('appointments').doc(cleanId(appointmentId))
        const appointmentSnap = await tx.get(appointmentRef)
        linkedAppointment = appointmentSnap.data() || {}
        demand(appointmentSnap.exists && linkedAppointment.branchId === branchId && String(linkedAppointment.type || '').toLowerCase() === 'consultation' && String(linkedAppointment.status || '').toLowerCase() === 'completed' && (Array.isArray(linkedAppointment.prescriptions) ? linkedAppointment.prescriptions.length > 0 : Boolean(linkedAppointment.prescription)), 'The linked consultation prescription is unavailable.', 409)
      }
      for (const line of pricedLines.filter(value => value.dispensingClass === 'prescription_required')) {
        demand(appointmentId, `${line.name} requires a linked consultation prescription.`, 409)
        demand(linkedAppointment.prescriptionStatus !== 'dispensed', 'This consultation prescription has already been dispensed.', 409)
        const prescribed = Array.isArray(linkedAppointment.prescriptions) ? linkedAppointment.prescriptions : linkedAppointment.prescription ? [linkedAppointment.prescription] : []
        const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        demand(prescribed.some(entry => {
          const prescribedName = typeof entry === 'string' ? entry : entry?.name || entry?.medication || entry?.productName || ''
          return normalize(prescribedName) === normalize(line.item.name)
        }), `${line.name} is not listed on the linked consultation prescription.`, 409)
      }
      const now = stamp(), createdAt = new Date().toISOString(), customerName = String(req.body.customerName || '').trim().slice(0, 120)
      const receiptNumber = `PH-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${saleId.slice(0, 6).toUpperCase()}`
      const items = pricedLines.map(({ itemId, quantity: count, name, unit, unitPrice, total, dispensingClass }) => ({ itemId, name, quantity: count, unit, unitPrice, total, dispensingClass }))
      sale = { id: saleId, receiptNumber, branchId, customerName, items, subtotal: totalCents / 100, total: totalCents / 100, amount: totalCents / 100, paymentMethod: method, cashTendered: tenderedCents / 100, change: (tenderedCents - totalCents) / 100, paymentStatus: 'Paid', status: 'Completed', source: 'clinic_pharmacy_pos', createdBy: ctx.uid, createdAt, ...(appointmentId ? { appointmentId } : {}) }
      pricedLines.forEach(line => tx.update(line.ref, { currentStock: Number(line.item.currentStock || 0) - line.quantity, updatedAt: now }))
      tx.set(saleRef, { ...sale, createdAt: now })
      tx.set(transactionRef, { branchId, customerName, items, amount: totalCents / 100, total: totalCents / 100, type: 'product_sale', method, status: 'Paid', source: 'clinic_pharmacy_pos', pharmacySaleId: saleId, receiptNumber, createdBy: ctx.uid, createdAt: now })
      pricedLines.forEach((line, index) => tx.set(movementRefs[index], { branchId, inventoryItemId: line.itemId, quantity: -line.quantity, type: 'pharmacy_sale', pharmacySaleId: saleId, receiptNumber, createdBy: ctx.uid, createdAt: now }))
      if (appointmentRef && pricedLines.some(line => line.dispensingClass === 'prescription_required')) tx.update(appointmentRef, { prescriptionStatus: 'dispensed', prescriptionDispensedAt: now, prescriptionDispensedBy: ctx.uid, pharmacySaleId: saleId })
    })
    res.json({ success: true, data: sale })
  }))
}
