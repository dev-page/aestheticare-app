import test from 'node:test'
import assert from 'node:assert/strict'
import { registerSupplyWorkflow } from './supplyWorkflow.js'
import { stockSignals, dateKey, invoiceMatch, supplierProjection } from './supplyModel.js'

// Isolated transactional adapter: exercises the actual HTTP handlers without
// touching a live Firebase project. Production concurrency still needs emulator tests.
function fixture() {
  const store = new Map(), routes = new Map(); let seq = 0
  const seed = (collection, id, data) => store.set(`${collection}/${id}`, structuredClone(data))
  const collection = name => {
    const query = filters => ({ where: (field, op, value) => query([...filters, [field, op, value]]), get: async () => ({ docs: [...store.entries()].filter(([key, value]) => key.startsWith(name + '/') && filters.every(([f, op, v]) => op === 'array-contains' ? value[f]?.includes(v) : value[f] === v)).map(([key, value]) => ({ id: key.split('/')[1], data: () => structuredClone(value) })) }) })
    return { ...query([]), doc: (id = `generated-${++seq}`) => ({ id, key: `${name}/${id}`, parent: { id: name }, get: async () => ({ id, exists: store.has(`${name}/${id}`), data: () => structuredClone(store.get(`${name}/${id}`)) }), set: async value => seed(name, id, value) }), add: async value => seed(name, `generated-${++seq}`, value) }
  }
  const db = { collection, runTransaction: async fn => { const writes = []; const result = await fn({ get: ref => ref.get(), set: (ref, value, options) => writes.push([ref.key, value, options]) }); for (const [key, value, options] of writes) store.set(key, options?.merge ? { ...store.get(key), ...structuredClone(value) } : structuredClone(value)); return result } }
  const permissions = {
    inventory: ['inventory:view', 'inventory:create'], reviewer: ['inventory:view', 'inventory:review'], procurement: ['procurement:view', 'procurement:create', 'procurement:review'], finance: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle'], finance2: ['finance:payables:view', 'finance:payables:approve'], logistics: ['orders:view', 'orders:update'], reader: ['inventory:view'], supplier: [], competitor: [],
  }
  const firestore = () => db; firestore.FieldValue = { serverTimestamp: () => ({ _seconds: 1800000000 }) }
  registerSupplyWorkflow({ get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)), post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)) }, { admin: { firestore }, requireAuth: () => {}, loadUserContext: async uid => ({ uid, roleKey: ['supplier', 'competitor'].includes(uid) ? 'supplier' : uid, permissions: new Set(permissions[uid]), userData: { branchId: 'clinic', fullName: uid } }), storageBucket: () => 'unused' })
  seed('clinics', 'clinic', { ownerId: 'owner' }); seed('inventoryItems', 'item', { branchId: 'clinic', name: 'Gloves', currentStock: 20, minStock: 25, targetStock: 120, unit: 'boxes', supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves' })
  seed('suppliers', 'vendor', { branchId: 'clinic', status: 'Active', ownerId: 'supplier', offeredItems: [{ id: 'catalog-gloves', name: 'Gloves', category: 'Materials', unit: 'boxes', price: 5, quantity: 1000 }] }); seed('suppliers', 'rival', { branchId: 'clinic', status: 'Active', ownerId: 'competitor', offeredItems: [] })
  const call = async (uid, path, body = {}, id, method = 'POST') => { let status = 200, payload; await routes.get(`${method} ${path}`)({ user: { uid }, body, params: { id }, query: {} }, { status: code => { status = code; return { json: data => { payload = data } } }, json: data => { payload = data } }); return { status, ...payload } }
  const create = async (uid, kind, data) => { const r = await call(uid, '/supply/records', { branchId: 'clinic', kind, ...data }); assert.equal(r.status, 200, JSON.stringify(r)); return r.data.id }
  const act = async (uid, id, action, data = {}, expected = 200) => { const r = await call(uid, '/supply/records/:id/actions', { action, ...data }, id); assert.equal(r.status, expected, JSON.stringify(r)); return r }
  const read = id => store.get(`supplyRecords/${id}`)
  const evidence = id => { const doc = `proof-${id}`; seed('supplyDocuments', doc, { branchId: 'clinic', recordId: id }); return doc }
  return { store, seed, call, create, act, read, evidence }
}

for (const mode of ['Online']) test(`${mode}: catalog-priced request to funded PO, partial receiving, matching and payment`, async () => {
  const f = fixture(), date = '2099-12-31'
  const request = await f.create('inventory', 'request', { supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves', quantity: 100, minStock: 25, targetStock: 120, maxStock: 150, department: 'Procurement', reason: 'Replenishment', requiredDate: date })
  assert.equal(f.read(request).status, 'Sent to Procurement')
  assert.equal(f.read(request).department, 'Inventory')
  const aboveAvailable = await f.call('inventory', '/supply/records', { kind: 'request', supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves', quantity: 1001, minStock: 25, targetStock: 120, maxStock: 150, department: 'Inventory', reason: 'Replenishment', requiredDate: date })
  assert.equal(aboveAvailable.status, 400)
  const procurement = f.read(request).procurementId
  await f.act('procurement', procurement, 'confirm', { productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true, category: 'Materials', warranty: 'None', deliveryDate: date, deliveryLocation: 'Clinic', terms: 'Deliver sealed boxes' })
  const po = f.read(procurement).purchaseOrderId
  const budget = await f.create('finance', 'budget', { department: 'Logistics', category: 'Materials', total: 1000 })
  assert.equal(f.read(budget).department, 'Inventory')
  await f.act('finance', po, 'approve', { budgetId: budget, approvedAmount: 550, remarks: 'Within allocation' })
  await f.act('finance', po, 'approve', { budgetId: budget, approvedAmount: 550, remarks: 'Repeat' }, 409)
  assert.equal(f.read(budget).committed, 55000)
  assert.equal(f.read(`approval-${po}`).status, 'Approved')
  assert.equal(f.read(`allocation-${po}`).status, 'Committed')
  assert.equal(f.read(po).tax, 0)
  assert.equal(f.read(po).delivery, 0)
  assert.equal(f.read(po).otherCharges, 0)
  assert.equal(f.read(po).discount, 0)
  assert.equal(f.read(po).total, 50000)
  await f.act('finance', po, 'issue')
  await f.act('competitor', po, 'confirm', { remarks: 'Wrong supplier', deliveryDate: date }, 403)
  await f.act(mode === 'Online' ? 'supplier' : 'procurement', po, 'confirm', { remarks: 'Confirmed', deliveryDate: date })
  assert.equal(f.read(`confirmation-${po}`).status, 'Accepted')
  await f.act('logistics', po, 'claimOrder')
  assert.equal(f.read(po).status, 'Claimed by Logistics')
  const first = await f.create('logistics', 'receiving', { poId: po, reference: 'DR1', deliveryDate: date, lines: [{ itemId: 'item', delivered: 65, accepted: 60, rejected: 5, condition: 'Good', reason: 'Five damaged boxes' }] })
  assert.equal(f.read(`inspection-${first}`).status, 'Completed')
  await f.act('inventory', first, 'onboard'); await f.act('inventory', first, 'onboard')
  assert.equal(f.store.get('inventoryItems/item').currentStock, 80)
  assert.equal(f.read(po).status, 'Partially Received')
  const discrepancy = [...f.store.entries()].find(([key, value]) => key.startsWith('supplyRecords/') && value.kind === 'discrepancy' && value.receivingId === first)?.[1]
  assert.ok(discrepancy)
  await f.act('logistics', discrepancy.id, 'resolve', { resolutionType: 'Replacement', remarks: 'Supplier will replace five damaged boxes' })
  const invoice = await f.create(mode === 'Online' ? 'supplier' : 'finance', 'invoice', { poId: po, invoiceNumber: 'INV1', invoiceDate: date, lines: [{ itemId: 'item', quantity: 100, unitPrice: 5 }], tax: 0, delivery: 0, otherCharges: 0, discount: 0 })
  assert.equal(f.store.get(`financialRecords/supply-${invoice}`).status, 'Unpaid')
  f.evidence(invoice); await f.act('finance', invoice, 'startVerification'); await f.act('finance', invoice, 'verify'); assert.equal(f.read(invoice).status, 'Disputed')
  await f.act('finance', invoice, 'pay', {}, 409)
  const rest = await f.create('logistics', 'receiving', { poId: po, reference: 'DR2', deliveryDate: date, lines: [{ itemId: 'item', delivered: 40, accepted: 40, rejected: 0, condition: 'Good' }] })
  await f.act('inventory', rest, 'onboard'); assert.equal(f.store.get('inventoryItems/item').currentStock, 120)
  await f.act('finance', invoice, 'startVerification'); await f.act('finance', invoice, 'verify'); assert.equal(f.read(invoice).status, 'Matched')
  assert.equal(f.read(`match-${invoice}`).status, 'Matched')
  await f.act('finance2', invoice, 'approve')
  await f.act('finance', invoice, 'preparePayment')
  const payment = `payment-${invoice}`
  await f.act('finance', payment, 'reviewPayment')
  await f.act('finance', payment, 'approvePayment', { remarks: 'Self approval attempt' }, 409)
  await f.act('finance2', payment, 'approvePayment', { remarks: 'Verified against the approved invoice' })
  await f.act('finance', payment, 'startPayment')
  await f.act('finance', invoice, 'pay', { proofId: f.evidence(payment), method: 'Digital Transfer', reference: 'BANK1', paymentDate: date })
  await f.act('finance', invoice, 'pay')
  assert.equal(f.read(po).status, 'Completed'); assert.equal(f.read(budget).committed, 0); assert.equal(f.read(budget).spent, 50000)
  assert.equal(f.store.get(`financialRecords/supply-${invoice}`).status, 'Paid')
  assert.equal(f.read(`allocation-${po}`).status, 'Settled')
  const own = await f.call('supplier', '/supply/workspace', {}, undefined, 'GET')
  assert.ok(own.data.records.every(r => !r.links && !r.budgetId && !r.justification && !r.procurementId))
  const other = await f.call('competitor', '/supply/workspace', {}, undefined, 'GET'); assert.equal(other.data.records.length, 0)
})

test('Inventory can save a request as a draft before sending it to Procurement', async () => {
  const f = fixture(), date = '2099-12-31'
  const saved = await f.call('inventory', '/supply/records', { branchId: 'clinic', kind: 'request', action: 'saveDraft', supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves', quantity: 10, minStock: 25, targetStock: 120, maxStock: 150, department: 'Inventory', reason: 'Review stock requirement', requiredDate: date })
  assert.equal(saved.status, 200, JSON.stringify(saved))
  const draft = f.read(saved.data.id)
  assert.equal(draft.status, 'Draft')
  assert.equal(draft.procurementId, undefined)
  await f.act('inventory', draft.id, 'submitDraft')
  assert.equal(f.read(draft.id).status, 'Sent to Procurement')
  assert.ok(f.read(draft.id).procurementId)
})

test('DSS thresholds, invalid dates, privacy and invoice overbilling', () => {
  assert.deepEqual(stockSignals({ currentStock: 5, minStock: 5 }), ['For Restocking'])
  assert.ok(stockSignals({ currentStock: 11, maxStock: 10 }).includes('Overstocked'))
  assert.throws(() => dateKey('2099-99-99'), { status: 400 })
  assert.deepEqual(supplierProjection({ id: 'x', budgetId: 'private', justification: 'private', links: ['private'] }), { id: 'x' })
  assert.ok(invoiceMatch({ lines: [{ itemId: 'a', unitPrice: 100 }], accepted: { a: 5 }, total: 500 }, { lines: [{ itemId: 'a', quantity: 6, unitPrice: 100 }], total: 600 }, []).length)
})

test('Supplier catalog commercial terms are validated and audited on the server', async () => {
  const f = fixture()
  const valid = { id: 'catalog-serum', name: 'Serum', categoryGroup: 'Skincare', category: 'Skincare', customCategory: '', quantity: 25, minOrderQuantity: 2, measurementValue: '30', measurementUnit: 'mL', specifications: 'Sealed', price: 199.99, taxTreatment: 'vat-exclusive', taxRate: 0, discountRate: 3, tieredDiscounts: [{ minQuantity: 10, discountRate: 8 }], otherChargePerUnit: 1.5, imageUrl: 'https://example.test/serum.jpg', imageName: 'serum.jpg', fdaRegistrationNumber: '' }
  const saved = await f.call('supplier', '/supply/catalog', { supplierId: 'vendor', items: [valid] })
  assert.equal(saved.status, 200, JSON.stringify(saved)); assert.equal(f.store.get('suppliers/vendor').offeredItems[0].taxRate, 12)
  assert.equal(f.store.get('suppliers/vendor').offeredItems[0].tieredDiscounts[0].discountRate, 8)
  const invalid = await f.call('supplier', '/supply/catalog', { supplierId: 'vendor', items: [{ ...valid, discountRate: 101 }] })
  assert.equal(invalid.status, 400)
  const foreign = await f.call('competitor', '/supply/catalog', { supplierId: 'vendor', items: [valid] })
  assert.equal(foreign.status, 403)
})

test('Procurement creates a catalog-priced purchase order for Finance approval without an RFQ', async () => {
  const f = fixture(), date = '2099-12-31'
  const request = await f.create('inventory', 'request', { supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves', quantity: 20, minStock: 25, targetStock: 120, maxStock: 150, department: 'Inventory', reason: 'Restock', requiredDate: date, location: 'Main clinic' })
  const procurement = f.read(request).procurementId
  await f.act('procurement', procurement, 'confirm', { productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true, category: 'Materials', deliveryDate: date, deliveryLocation: 'Main clinic', terms: 'Sealed boxes' })
  const po = f.read(f.read(procurement).purchaseOrderId)
  assert.equal(po.directSupplierCatalog, true)
  assert.equal(po.requestedAmount, 10000)
  assert.equal(po.status, 'For Finance Approval')
  const budget = await f.create('finance', 'budget', { department: 'Inventory', category: 'Materials', total: 200 })
  await f.act('finance', po.id, 'approve', { budgetId: budget, approvedAmount: 100, remarks: 'Approved from verified supplier catalog' })
  assert.equal(po.directSupplierCatalog, true)
  assert.equal(po.total, 10000)
  assert.equal(po.tax, 0)
  assert.equal(po.delivery, 0)
})

test('Self approval, cross-branch writes and read-only document uploads are rejected', async () => {
  const f = fixture()
  f.seed('supplyRecords', 'self', { id: 'self', branchId: 'clinic', kind: 'request', status: 'Submitted', createdBy: 'reviewer' })
  await f.act('reviewer', 'self', 'approve', {}, 409)
  f.seed('clinics', 'other', { ownerId: 'someoneElse' })
  const cross = await f.call('inventory', '/supply/records', { kind: 'request', branchId: 'other' })
  assert.equal(cross.status, 403)
  const upload = await f.call('reader', '/supply/records/:id/documents', {}, 'self')
  assert.equal(upload.status, 403)
})

test('A legacy purchase order without links can still be confirmed by its supplier', async () => {
  const f = fixture(), date = '2099-12-31'
  f.seed('supplyRecords', 'legacy-po', { id: 'legacy-po', kind: 'po', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', status: 'Sent to Supplier', deliveryDate: date, lines: [{ itemId: 'item', supplierCatalogItemId: 'catalog-gloves', name: 'Gloves', category: 'Materials', quantity: 1 }] })
  await f.act('supplier', 'legacy-po', 'confirm', { remarks: 'Confirmed', deliveryDate: date })
  assert.equal(f.read('legacy-po').status, 'Supplier Confirmed')
  assert.deepEqual(f.read('confirmation-legacy-po').links, ['legacy-po'])
})

test('Invoice corrections cannot bypass matching or overwrite an approved invoice', async () => {
  const f = fixture()
  f.seed('supplyRecords', 'po', { id: 'po', kind: 'po', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', status: 'Delivered' })
  f.seed('supplyRecords', 'invoice', { id: 'invoice', number: 'INV', kind: 'invoice', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', poId: 'po', status: 'Disputed' })
  const correction = { lines: [{ itemId: 'item', quantity: 1, unitPrice: 5 }], invoiceDate: '2099-01-01', remarks: 'Correct price' }
  await f.act('supplier', 'invoice', 'reviseInvoice', correction)
  assert.equal(f.read('invoice').status, 'Submitted')
  f.seed('supplyRecords', 'invoice', { ...f.read('invoice'), status: 'Approved for Payment' })
  await f.act('supplier', 'invoice', 'reviseInvoice', correction, 409)
})
