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
  seed('clinics', 'clinic', { subscriptionPlan: 'basic', ownerId: 'owner' }); seed('inventoryItems', 'item', { branchId: 'clinic', name: 'Gloves', currentStock: 20, minStock: 25, targetStock: 120, unit: 'boxes', supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves' })
  seed('suppliers', 'vendor', { branchId: 'clinic', status: 'Active', verificationStatus: 'Verified', ownerId: 'supplier', offeredItems: [{ id: 'catalog-gloves', name: 'Gloves', category: 'Materials', unit: 'boxes', price: 5, quantity: 1000 }] }); seed('suppliers', 'rival', { branchId: 'clinic', status: 'Active', verificationStatus: 'Verified', ownerId: 'competitor', offeredItems: [] })
  const call = async (uid, path, body = {}, id, method = 'POST', query = {}) => { let status = 200, payload; await routes.get(`${method} ${path}`)({ user: { uid }, body, params: { id }, query }, { status: code => { status = code; return { json: data => { payload = data } } }, json: data => { payload = data } }); return { status, ...payload } }
  const create = async (uid, kind, data) => { const r = await call(uid, '/supply/records', { branchId: 'clinic', kind, ...data }); assert.equal(r.status, 200, JSON.stringify(r)); return r.data.id }
  const act = async (uid, id, action, data = {}, expected = 200) => { const r = await call(uid, '/supply/records/:id/actions', { action, ...data }, id); assert.equal(r.status, expected, JSON.stringify(r)); return r }
  const read = id => store.get(`supplyRecords/${id}`)
  const evidence = id => { const doc = `proof-${id}`; seed('supplyDocuments', doc, { branchId: 'clinic', recordId: id }); return doc }
  return { store, seed, call, create, act, read, evidence }
}

test('Free and expired subscriptions block paid supply APIs while preserving inventory records', async () => {
  for (const subscription of [{ subscriptionPlan: 'free' }, { subscriptionPlan: 'basic', subscriptionExpiresAt: new Date(1), paymentStatus: 'trial' }]) {
    const f = fixture()
    f.seed('clinics', 'clinic', { ownerId: 'owner', ...subscription })
    assert.equal((await f.call('inventory', '/supply/workspace', {}, undefined, 'GET')).status, 403)
    assert.equal((await f.call('inventory', '/supply/records', { branchId: 'clinic', kind: 'request' })).status, 403)
    assert.equal((await f.call('procurement', '/supply/chat', {}, undefined, 'GET', { supplierId: 'vendor' })).status, 403)
    assert.ok(f.store.has('inventoryItems/item'))
  }
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


test('A supplier delivery fee is selected from the clinic branch city before Finance approval', async () => {
  const f = fixture(), date = '2099-12-31'
  f.seed('clinics', 'clinic', { subscriptionPlan: 'basic', ownerId: 'owner', clinicLocation: 'Imus' })
  const supplier = f.store.get('suppliers/vendor')
  f.seed('suppliers', 'vendor', { ...supplier, deliveryFees: [{ city: 'Imus', amount: 250 }, { city: 'Bacoor', amount: 400 }] })
  const request = await f.create('inventory', 'request', { supplierId: 'vendor', supplierCatalogItemId: 'catalog-gloves', quantity: 20, minStock: 25, targetStock: 120, maxStock: 150, department: 'Inventory', reason: 'Restock', requiredDate: date })
  const procurement = f.read(request).procurementId
  await f.act('procurement', procurement, 'confirm', { productsCorrect: true, quantitiesVerified: true, availabilityConfirmed: true, pricesVerified: true, category: 'Materials', deliveryDate: date, deliveryLocation: 'Main clinic', terms: 'Sealed boxes' })
  const po = f.read(f.read(procurement).purchaseOrderId)
  assert.equal(po.delivery, 25000)
  assert.equal(po.deliveryFeeCity, 'Imus')
  assert.equal(po.deliveryFeeConfigured, true)
  assert.equal(po.total, 35000)
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


test('A legacy purchase order without its Procurement parent can still be approved by Finance', async () => {
  const f = fixture()
  const budget = await f.create('finance', 'budget', { category: 'Legacy inventory', total: 100 })
  f.seed('supplyRecords', 'legacy-finance-po', { id: 'legacy-finance-po', kind: 'po', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', status: 'For Finance Approval', department: 'Inventory', total: 5000, requestedAmount: 5000, lines: [{ itemId: 'item', name: 'Gloves', quantity: 10 }] })
  await f.act('finance', 'legacy-finance-po', 'approve', { budgetId: budget, approvedAmount: 50, remarks: 'Approved legacy order' })
  assert.equal(f.read('legacy-finance-po').status, 'Approved')
  await f.act('finance', 'legacy-finance-po', 'issue')
  assert.equal(f.read('legacy-finance-po').status, 'Sent to Supplier')
  assert.equal(f.read(budget).committed, 5000)
})
