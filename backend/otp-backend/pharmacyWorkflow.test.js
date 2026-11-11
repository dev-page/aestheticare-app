import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDb } from './testTransactionDb.js'
import { registerPharmacyWorkflow } from './pharmacyWorkflow.js'

const fixture = ({ permissions = ['pharmacy:view'], roleKey = 'Pharmacist', userData = {}, clinic = {} } = {}) => {
  const h = transactionDb(), routes = new Map()
  h.seed('clinics', 'clinic', { ownerId: 'owner', subscriptionPlan: 'basic', ...clinic })
  registerPharmacyWorkflow({
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)),
    post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)),
  }, {
    admin: h.admin,
    requireAuth() {},
    loadUserContext: async uid => ({
      uid,
      roleKey,
      permissions: new Set(permissions),
      userData: { branchId: 'clinic', fullName: uid, role: roleKey, ...userData },
    }),
  })
  const call = async (uid, method, path, { body = {}, query = {}, params = {} } = {}) => {
    let status = 200, payload
    await routes.get(`${method} ${path}`)(
      { user: { uid }, body, query, params },
      { status: code => { status = code; return { json: value => { payload = value } } }, json: value => { payload = value } },
    )
    return { status, ...payload }
  }
  return { ...h, call }
}

test('Pharmacy reads only enabled inventory through a pharmacy-safe API projection', async () => {
  const h = fixture()
  h.seed('inventoryItems', 'sellable', {
    branchId: 'clinic', name: 'Serum', category: 'Skincare', unit: 'bottle', currentStock: 8,
    reservedStock: 1, expiryDate: '2027-01-01', pharmacyEnabled: true,
    dispensingClass: 'general_sale', retailPrice: 45, costPrice: 17, supplierId: 'supplier-private',
  })
  h.seed('inventoryItems', 'hidden', { branchId: 'clinic', name: 'Backroom item', currentStock: 4, pharmacyEnabled: false })
  h.seed('pharmacySales', 'sale-1', { branchId: 'clinic', receiptNumber: 'PH-001', customerName: 'Client', total: 45, paymentMethod: 'Cash', createdBy: 'staff-id', appointmentId: 'private-clinical-link' })

  const response = await h.call('pharmacist', 'GET', '/pharmacy/pos', { query: { branchId: 'clinic' } })

  assert.equal(response.status, 200, JSON.stringify(response))
  assert.equal(response.data.items.length, 1)
  assert.equal(response.data.items[0].id, 'sellable')
  assert.equal(response.data.items[0].retailPrice, 45)
  assert.equal('costPrice' in response.data.items[0], false)
  assert.equal('supplierId' in response.data.items[0], false)
  assert.deepEqual(Object.keys(response.data.sales[0]).sort(), ['createdAt', 'customerName', 'id', 'paymentMethod', 'receiptNumber', 'total'].sort())
})

test('Pharmacy requires permission, an active paid plan, and a non-supplier identity', async () => {
  const noPermission = fixture({ permissions: [] })
  assert.equal((await noPermission.call('staff', 'GET', '/pharmacy/pos', { query: { branchId: 'clinic' } })).status, 403)

  const freePlan = fixture({ clinic: { subscriptionPlan: 'free' } })
  assert.equal((await freePlan.call('pharmacist', 'GET', '/pharmacy/pos', { query: { branchId: 'clinic' } })).status, 403)

  const supplier = fixture({ permissions: ['administrator:full_access'], roleKey: 'Supplier' })
  assert.equal((await supplier.call('supplier', 'GET', '/pharmacy/pos', { query: { branchId: 'clinic' } })).status, 403)
})

test('Pharmacy preserves material quantities reserved for future treatments', async () => {
  const h = fixture({ permissions: ['pharmacy:view', 'pharmacy:dispense'] })
  h.seed('inventoryItems', 'serum', {
    branchId: 'clinic', name: 'Serum', unit: 'bottle', currentStock: 4, reservedStock: 0,
    pharmacyEnabled: true, dispensingClass: 'general_sale', retailPrice: 5,
  })
  h.seed('supplyLots', 'serum-lot', { branchId: 'clinic', itemId: 'serum', expiryDate: '2027-01-01', remainingQuantity: 4 })
  h.seed('appointments', 'future-treatment', {
    branchId: 'clinic', status: 'Paid', materialsConsumed: false,
    resources: [{ id: 'serum', kind: 'material', quantity: 3 }],
  })
  h.seed('appointments', 'cancelled-treatment', {
    branchId: 'clinic', status: 'Cancelled', materialsConsumed: false,
    resources: [{ id: 'serum', kind: 'material', quantity: 20 }],
  })

  const inventory = await h.call('pharmacist', 'GET', '/pharmacy/pos', { query: { branchId: 'clinic' } })
  assert.equal(inventory.data.items[0].availableStock, 1)

  const sale = await h.call('pharmacist', 'POST', '/pharmacy/checkout', { body: {
    checkoutId: 'reserved-stock-sale', branchId: 'clinic', items: [{ itemId: 'serum', quantity: 2 }],
    paymentMethod: 'Cash', cashTendered: 10,
  } })
  assert.equal(sale.status, 409)
  assert.equal(h.records.get('inventoryItems/serum').currentStock, 4)
})

test('Pharmacy checkout retries cannot read a sale from another clinic branch', async () => {
  const h = fixture({ permissions: ['pharmacy:view', 'pharmacy:dispense'] })
  h.seed('pharmacySales', 'foreign-checkout', {
    branchId: 'another-clinic', receiptNumber: 'PH-PRIVATE', customerName: 'Private customer',
    items: [{ itemId: 'private-item', name: 'Private medication', quantity: 1, total: 50 }], total: 50,
  })

  const result = await h.call('pharmacist', 'POST', '/pharmacy/checkout', { body: {
    checkoutId: 'foreign-checkout', branchId: 'clinic', items: [{ itemId: 'missing-item', quantity: 1 }],
    paymentMethod: 'Cash', cashTendered: 10,
  } })

  assert.equal(result.status, 403)
  assert.equal(result.data, undefined)
})

test('Pharmacy checkout consumes unexpired lots by FEFO, preserves reservations, and is idempotent', async () => {
  const h = fixture({ permissions: ['pharmacy:view', 'pharmacy:dispense'] })
  h.seed('inventoryItems', 'serum', {
    branchId: 'clinic', name: 'Serum', unit: 'bottle', currentStock: 7, reservedStock: 1,
    expiryDate: '2000-01-01', pharmacyEnabled: true, dispensingClass: 'general_sale', retailPrice: 10,
  })
  h.seed('supplyLots', 'expired', { branchId: 'clinic', itemId: 'serum', expiryDate: '2001-01-01', remainingQuantity: 2 })
  h.seed('supplyLots', 'near', { branchId: 'clinic', itemId: 'serum', lot: 'A', expiryDate: '2027-01-01', remainingQuantity: 2 })
  h.seed('supplyLots', 'later', { branchId: 'clinic', itemId: 'serum', lot: 'B', expiryDate: '2999-01-01', remainingQuantity: 3 })
  const body = { checkoutId: 'checkout-1', branchId: 'clinic', items: [{ itemId: 'serum', quantity: 3 }], paymentMethod: 'Cash', cashTendered: 30 }

  const first = await h.call('pharmacist', 'POST', '/pharmacy/checkout', { body })

  assert.equal(first.status, 200, JSON.stringify(first))
  assert.equal(h.records.get('inventoryItems/serum').currentStock, 4)
  assert.equal(h.records.get('supplyLots/expired').remainingQuantity, 2)
  assert.equal(h.records.get('supplyLots/near').remainingQuantity, 0)
  assert.equal(h.records.get('supplyLots/later').remainingQuantity, 2)
  assert.deepEqual(h.records.get('inventoryMovements/pharmacy-checkout-1-serum').lotAllocations, [
    { lotId: 'near', lot: 'A', expiryDate: '2027-01-01', quantity: 2 },
    { lotId: 'later', lot: 'B', expiryDate: '2999-01-01', quantity: 1 },
  ])

  const retry = await h.call('pharmacist', 'POST', '/pharmacy/checkout', { body })
  assert.equal(retry.status, 200)
  assert.equal(retry.data.alreadyRecorded, true)
  assert.equal(h.records.get('inventoryItems/serum').currentStock, 4)
})

test('Prescription dispensing enforces the prescribed quantity and supports partial fills', async () => {
  const h = fixture({ permissions: ['pharmacy:view', 'pharmacy:dispense'] })
  h.seed('appointments', 'consult', {
    branchId: 'clinic', type: 'Consultation', status: 'Completed',
    prescriptions: [{ name: 'Rx Serum', dosage: '10 mg', quantity: 3 }], prescriptionStatus: 'pending',
  })
  h.seed('inventoryItems', 'rx-serum', {
    branchId: 'clinic', name: 'Rx Serum', unit: 'bottle', currentStock: 5, reservedStock: 0,
    pharmacyEnabled: true, dispensingClass: 'prescription_required', retailPrice: 20,
  })
  const checkout = (checkoutId, count) => h.call('pharmacist', 'POST', '/pharmacy/checkout', { body: {
    checkoutId, branchId: 'clinic', appointmentId: 'consult', items: [{ itemId: 'rx-serum', quantity: count }],
    paymentMethod: 'Cash', cashTendered: count * 20,
  } })

  const partial = await checkout('rx-sale-1', 2)
  assert.equal(partial.status, 200, JSON.stringify(partial))
  assert.equal(h.records.get('appointments/consult').prescriptionStatus, 'partially_dispensed')
  assert.equal(h.records.get('appointments/consult').prescriptionDispensedQuantities.rxserum, 2)

  const overfill = await checkout('rx-sale-overfill', 2)
  assert.equal(overfill.status, 409)
  assert.equal(h.records.get('inventoryItems/rx-serum').currentStock, 3)

  const finalFill = await checkout('rx-sale-2', 1)
  assert.equal(finalFill.status, 200, JSON.stringify(finalFill))
  assert.equal(h.records.get('appointments/consult').prescriptionStatus, 'dispensed')
  assert.equal(h.records.get('appointments/consult').prescriptionDispensedQuantities.rxserum, 3)
})

test('A prescription without an explicit quantity cannot authorize Pharmacy dispensing', async () => {
  const h = fixture({ permissions: ['pharmacy:view', 'pharmacy:dispense'] })
  h.seed('appointments', 'legacy-consult', { branchId: 'clinic', type: 'Consultation', status: 'Completed', prescriptions: [{ name: 'Rx Serum', dosage: '10 mg' }] })
  h.seed('inventoryItems', 'rx-serum', { branchId: 'clinic', name: 'Rx Serum', currentStock: 5, pharmacyEnabled: true, dispensingClass: 'prescription_required', retailPrice: 20 })

  const response = await h.call('pharmacist', 'POST', '/pharmacy/checkout', { body: {
    checkoutId: 'legacy-rx-sale', branchId: 'clinic', appointmentId: 'legacy-consult', items: [{ itemId: 'rx-serum', quantity: 1 }],
    paymentMethod: 'Cash', cashTendered: 20,
  } })

  assert.equal(response.status, 409)
  assert.match(response.error, /quantity/i)
  assert.equal(h.records.get('inventoryItems/rx-serum').currentStock, 5)
})
