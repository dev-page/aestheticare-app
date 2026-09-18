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
    return { ...query([]), doc: (id = `generated-${++seq}`) => ({ id, key: `${name}/${id}`, get: async () => ({ id, exists: store.has(`${name}/${id}`), data: () => structuredClone(store.get(`${name}/${id}`)) }), set: async value => seed(name, id, value) }), add: async value => seed(name, `generated-${++seq}`, value) }
  }
  const db = { collection, runTransaction: async fn => { const writes = []; const result = await fn({ get: ref => ref.get(), set: (ref, value, options) => writes.push([ref.key, value, options]) }); for (const [key, value, options] of writes) store.set(key, options?.merge ? { ...store.get(key), ...structuredClone(value) } : structuredClone(value)); return result } }
  const permissions = {
    inventory: ['inventory:view', 'inventory:create'], reviewer: ['inventory:view', 'inventory:review'], procurement: ['procurement:view', 'procurement:create', 'procurement:review'], finance: ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle'], finance2: ['finance:payables:view', 'finance:payables:approve'], logistics: ['orders:view', 'orders:update'], reader: ['inventory:view'], supplier: [], competitor: [],
  }
  const firestore = () => db; firestore.FieldValue = { serverTimestamp: () => ({ _seconds: 1800000000 }) }
  registerSupplyWorkflow({ get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)), post: (path, ...handlers) => routes.set(`POST ${path}`, handlers.at(-1)) }, { admin: { firestore }, requireAuth: () => {}, loadUserContext: async uid => ({ uid, roleKey: ['supplier', 'competitor'].includes(uid) ? 'supplier' : uid, permissions: new Set(permissions[uid]), userData: { branchId: 'clinic', fullName: uid } }), storageBucket: () => 'unused' })
  seed('clinics', 'clinic', { ownerId: 'owner' }); seed('inventoryItems', 'item', { branchId: 'clinic', name: 'Gloves', currentStock: 20, minStock: 25, targetStock: 120, unit: 'boxes' })
  seed('suppliers', 'vendor', { branchId: 'clinic', status: 'Active', ownerId: 'supplier' }); seed('suppliers', 'rival', { branchId: 'clinic', status: 'Active', ownerId: 'competitor' })
  const call = async (uid, path, body = {}, id, method = 'POST') => { let status = 200, payload; await routes.get(`${method} ${path}`)({ user: { uid }, body, params: { id }, query: {} }, { status: code => { status = code; return { json: data => { payload = data } } }, json: data => { payload = data } }); return { status, ...payload } }
  const create = async (uid, kind, data) => { const r = await call(uid, '/supply/records', { branchId: 'clinic', kind, ...data }); assert.equal(r.status, 200, JSON.stringify(r)); return r.data.id }
  const act = async (uid, id, action, data = {}, expected = 200) => { const r = await call(uid, '/supply/records/:id/actions', { action, ...data }, id); assert.equal(r.status, expected, JSON.stringify(r)); return r }
  const read = id => store.get(`supplyRecords/${id}`)
  const evidence = id => { const doc = `proof-${id}`; seed('supplyDocuments', doc, { branchId: 'clinic', recordId: id }); return doc }
  return { store, seed, call, create, act, read, evidence }
}

for (const mode of ['Manual', 'Online']) test(`${mode}: request to funded PO, partial receiving, matching and payment`, async () => {
  const f = fixture(), date = '2099-12-31'
  const request = await f.create('inventory', 'request', { itemId: 'item', quantity: 100, department: 'Inventory', reason: 'Replenishment', requiredDate: date })
  await f.act('inventory', request, 'submit')
  await f.act('inventory', request, 'approve', {}, 403)
  await f.act('reviewer', request, 'approve')
  const procurement = f.read(request).procurementId
  const rfq = await f.create('procurement', 'rfq', { procurementId: procurement, mode, supplierIds: ['vendor'], deadline: date, deliveryDate: date, deliveryLocation: 'Clinic', terms: 'Deliver intact', contact: 'Purchasing' })
  if (mode === 'Manual') { await f.act('procurement', rfq, 'send', {}, 409); f.evidence(rfq) }
  await f.act('procurement', rfq, 'send')
  await f.act('procurement', rfq, 'open')
  const quote = await f.create(mode === 'Manual' ? 'procurement' : 'supplier', 'quotation', { rfqId: rfq, supplierId: 'vendor', lines: [{ itemId: 'item', quantity: 100, unitPrice: 5 }], validUntil: date, leadDays: 1, paymentTerms: 'On delivery' })
  if (mode === 'Manual') f.evidence(quote)
  await f.act('procurement', rfq, 'close'); await f.act('procurement', rfq, 'evaluate'); await f.act('procurement', quote, 'select', { justification: 'Meets specification and delivery date', category: 'Materials' })
  const budgetRequest = f.read(procurement).budgetRequestId
  const budget = await f.create('finance', 'budget', { department: 'Inventory', category: 'Materials', total: 1000 })
  await f.act('finance', budgetRequest, 'approve', { budgetId: budget, approvedAmount: 550, remarks: 'Within allocation' })
  await f.act('finance', budgetRequest, 'approve', { budgetId: budget, approvedAmount: 550, remarks: 'Repeat' }, 409)
  assert.equal(f.read(budget).committed, 55000)
  assert.equal(f.read(`approval-${budgetRequest}`).status, 'Approved')
  assert.equal(f.read(`allocation-${budgetRequest}`).status, 'Committed')
  const po = `po-${budgetRequest}`
  if (mode === 'Manual') f.evidence(po)
  await f.act('procurement', po, 'submitPo')
  await f.act('procurement', po, 'approvePo')
  await f.act('procurement', po, 'issue')
  await f.act('competitor', po, 'confirm', { remarks: 'Wrong supplier', deliveryDate: date }, 403)
  await f.act(mode === 'Manual' ? 'procurement' : 'supplier', po, 'confirm', { remarks: 'Confirmed', deliveryDate: date })
  assert.equal(f.read(`confirmation-${po}`).status, 'Accepted')
  await f.act('procurement', po, 'startOrder')
  const first = await f.create('logistics', 'receiving', { poId: po, reference: 'DR1', deliveryDate: date, lines: [{ itemId: 'item', delivered: 65, accepted: 60, rejected: 5, condition: 'Good', reason: 'Five damaged boxes' }] })
  assert.equal(f.read(`inspection-${first}`).status, 'Completed')
  await f.act('logistics', first, 'onboard'); await f.act('logistics', first, 'onboard')
  assert.equal(f.store.get('inventoryItems/item').currentStock, 80)
  assert.equal(f.read(po).status, 'Partially Received')
  const discrepancy = [...f.store.entries()].find(([key, value]) => key.startsWith('supplyRecords/') && value.kind === 'discrepancy' && value.receivingId === first)?.[1]
  assert.ok(discrepancy)
  await f.act('logistics', discrepancy.id, 'resolve', { resolutionType: 'Replacement', remarks: 'Supplier will replace five damaged boxes' })
  const invoice = await f.create(mode === 'Manual' ? 'finance' : 'supplier', 'invoice', { poId: po, invoiceNumber: 'INV1', invoiceDate: date, dueDate: date, lines: [{ itemId: 'item', quantity: 100, unitPrice: 5 }] })
  f.evidence(invoice); await f.act('finance', invoice, 'startVerification'); await f.act('finance', invoice, 'verify'); assert.equal(f.read(invoice).status, 'Disputed')
  await f.act('finance', invoice, 'pay', {}, 409)
  const rest = await f.create('logistics', 'receiving', { poId: po, reference: 'DR2', deliveryDate: date, lines: [{ itemId: 'item', delivered: 40, accepted: 40, rejected: 0, condition: 'Good' }] })
  await f.act('logistics', rest, 'onboard'); assert.equal(f.store.get('inventoryItems/item').currentStock, 120)
  await f.act('finance', invoice, 'startVerification'); await f.act('finance', invoice, 'verify'); assert.equal(f.read(invoice).status, 'Matched')
  assert.equal(f.read(`match-${invoice}`).status, 'Matched')
  await f.act('finance2', invoice, 'approve')
  await f.act('finance', invoice, 'preparePayment')
  const payment = `payment-${invoice}`
  await f.act('finance', payment, 'reviewPayment')
  await f.act('finance', payment, 'approvePayment', { remarks: 'Self approval attempt' }, 409)
  await f.act('finance2', payment, 'approvePayment', { remarks: 'Verified against the approved invoice' })
  await f.act('finance', payment, 'startPayment')
  await f.act('finance', invoice, 'pay', { proofId: f.evidence(payment), method: 'Manual/External', reference: 'BANK1', paymentDate: date })
  await f.act('finance', invoice, 'pay')
  assert.equal(f.read(po).status, 'Completed'); assert.equal(f.read(budget).committed, 0); assert.equal(f.read(budget).spent, 50000)
  assert.equal(f.read(`allocation-${budgetRequest}`).status, 'Settled')
  const own = await f.call('supplier', '/supply/workspace', {}, undefined, 'GET')
  assert.ok(own.data.records.every(r => !r.links && !r.budgetId && !r.justification && !r.procurementId))
  const other = await f.call('competitor', '/supply/workspace', {}, undefined, 'GET'); assert.equal(other.data.records.length, 0)
})

test('DSS thresholds, invalid dates, privacy and invoice overbilling', () => {
  assert.deepEqual(stockSignals({ currentStock: 5, minStock: 5 }), ['For Restocking'])
  assert.ok(stockSignals({ currentStock: 11, maxStock: 10 }).includes('Overstocked'))
  assert.throws(() => dateKey('2099-99-99'), { status: 400 })
  assert.deepEqual(supplierProjection({ id: 'x', budgetId: 'private', justification: 'private', links: ['private'] }), { id: 'x' })
  assert.ok(invoiceMatch({ lines: [{ itemId: 'a', unitPrice: 100 }], accepted: { a: 5 }, total: 500 }, { lines: [{ itemId: 'a', quantity: 6, unitPrice: 100 }], total: 600 }, []).length)
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

test('Invoice corrections cannot bypass matching or overwrite an approved invoice', async () => {
  const f = fixture()
  f.seed('supplyRecords', 'po', { id: 'po', kind: 'po', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', status: 'Delivered' })
  f.seed('supplyRecords', 'invoice', { id: 'invoice', number: 'INV', kind: 'invoice', mode: 'Online', branchId: 'clinic', supplierId: 'vendor', poId: 'po', status: 'Disputed' })
  const correction = { lines: [{ itemId: 'item', quantity: 1, unitPrice: 5 }], invoiceDate: '2099-01-01', dueDate: '2099-01-02', remarks: 'Correct price' }
  await f.act('supplier', 'invoice', 'reviseInvoice', correction)
  assert.equal(f.read('invoice').status, 'Submitted')
  f.seed('supplyRecords', 'invoice', { ...f.read('invoice'), status: 'Approved for Payment' })
  await f.act('supplier', 'invoice', 'reviseInvoice', correction, 409)
})
