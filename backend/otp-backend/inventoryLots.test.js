import test from 'node:test'
import assert from 'node:assert/strict'
import { planLotConsumption, reconcileLotsToInventory } from './inventoryLots.js'

test('lot consumption follows FEFO, skips expired stock, and preserves reserved units', () => {
  const plan = planLotConsumption({
    branchId: 'clinic',
    itemId: 'serum',
    item: { currentStock: 7, reservedStock: 1, expiryDate: '2020-01-01' },
    lotRecords: [
      { id: 'expired', branchId: 'clinic', itemId: 'serum', lot: 'OLD', expiryDate: '2026-01-01', remainingQuantity: 2 },
      { id: 'near', branchId: 'clinic', itemId: 'serum', lot: 'A', expiryDate: '2026-11-20', remainingQuantity: 2 },
      { id: 'later', branchId: 'clinic', itemId: 'serum', lot: 'B', expiryDate: '2027-02-01', remainingQuantity: 3 },
    ],
    quantity: 3,
    today: '2026-11-12',
  })

  assert.deepEqual(plan.allocations.map(({ lotId, quantity }) => ({ lotId, quantity })), [
    { lotId: 'near', quantity: 2 },
    { lotId: 'later', quantity: 1 },
  ])
  assert.equal(plan.availableQuantity, 4)
  assert.equal(plan.lotWrites.find(write => write.id === 'expired'), undefined)
  assert.equal(plan.lotWrites.find(write => write.id === 'near').data.remainingQuantity, 0)
  assert.equal(plan.lotWrites.find(write => write.id === 'later').data.remainingQuantity, 2)
})

test('lot consumption creates an opening balance for legacy stock and carries its known expiry', () => {
  const plan = planLotConsumption({
    branchId: 'clinic',
    itemId: 'cream',
    item: { currentStock: 4, reservedStock: 0, expiryDate: '2027-05-01' },
    lotRecords: [],
    quantity: 1,
    today: '2026-11-12',
  })

  assert.equal(plan.allocations[0].lotId, 'opening-clinic-cream')
  assert.equal(plan.allocations[0].quantity, 1)
  assert.equal(plan.lotWrites[0].data.source, 'opening_stock_reconciliation')
  assert.equal(plan.lotWrites[0].data.expiryDate, '2027-05-01')
  assert.equal(plan.lotWrites[0].data.remainingQuantity, 3)
})

test('lot consumption blocks expired or reserved quantities instead of overselling', () => {
  const item = { currentStock: 2, reservedStock: 0 }
  const expired = [{ id: 'expired', branchId: 'clinic', itemId: 'cream', expiryDate: '2026-11-11', remainingQuantity: 2 }]
  assert.throws(() => planLotConsumption({ branchId: 'clinic', itemId: 'cream', item, lotRecords: expired, quantity: 1, today: '2026-11-12' }), /expired|available/i)

  const reserved = [{ id: 'valid', branchId: 'clinic', itemId: 'cream', expiryDate: '2027-01-01', remainingQuantity: 2 }]
  assert.throws(() => planLotConsumption({ branchId: 'clinic', itemId: 'cream', item: { ...item, reservedStock: 2 }, lotRecords: reserved, quantity: 1, today: '2026-11-12' }), /reserved|available/i)
})

test('manual inventory count reconciles the lot ledger and reports affected lots', () => {
  const plan = reconcileLotsToInventory({
    branchId: 'clinic', itemId: 'cream', item: { currentStock: 2, expiryDate: '' },
    lotRecords: [
      { id: 'old', branchId: 'clinic', itemId: 'cream', remainingQuantity: 2, receivedAt: '2026-01-01' },
      { id: 'new', branchId: 'clinic', itemId: 'cream', remainingQuantity: 2, receivedAt: '2026-02-01' },
    ],
  })
  assert.equal(plan.totalQuantity, 2)
  assert.deepEqual(plan.adjustments, [{ lotId: 'new', quantity: 2, direction: 'decrease' }])
  assert.equal(plan.lotWrites.find(write => write.id === 'new').data.remainingQuantity, 0)
})

test('inventory stock increases are recorded as auditable opening-lot adjustments', () => {
  const plan = reconcileLotsToInventory({ branchId: 'clinic', itemId: 'cream', item: { currentStock: 3 }, lotRecords: [] })
  assert.equal(plan.totalQuantity, 3)
  assert.deepEqual(plan.adjustments, [{ lotId: 'opening-clinic-cream', quantity: 3, direction: 'increase' }])
  assert.equal(plan.lotWrites[0].data.remainingQuantity, 3)
  assert.equal(plan.lotWrites[0].created, true)

  const nextCount = reconcileLotsToInventory({
    branchId: 'clinic', itemId: 'cream', item: { currentStock: 4 },
    lotRecords: [{ id: plan.lotWrites[0].id, ...plan.lotWrites[0].data, receivedAt: '2026-01-01' }],
  })
  assert.equal(nextCount.lotWrites[0].created, false)
})
