import test from 'node:test'
import assert from 'node:assert/strict'
import {
  quoteAdjustmentDrafts,
  quoteAdjustmentRows,
  quoteDraftIsValid,
  quoteDraftTotal,
  quoteTaxTreatment,
} from './supplyQuotePricing.js'

test('supplier quotes allow itemized tax, delivery, named fees, and discounts with a matching stated total', () => {
  const lines = [{ quantity: 2, unitPrice: 100 }]
  const adjustments = [
    { type: 'tax', label: 'VAT', amount: 14 },
    { type: 'fee', label: 'Delivery', amount: 12 },
    { type: 'fee', label: 'Handling', amount: 5 },
    { type: 'discount', label: 'Supplier discount', amount: 10 },
  ]

  assert.equal(quoteDraftTotal(lines, adjustments), 221)
  assert.equal(quoteDraftIsValid(lines, adjustments, 'separate', '221'), true)
  assert.equal(quoteDraftIsValid(lines, adjustments, 'separate', '220.99'), false)
  assert.equal(quoteDraftIsValid(lines, adjustments, 'included', '221'), false)
})

test('recorded quote adjustments render as currency drafts and infer legacy tax treatment', () => {
  const quote = {
    adjustments: [
      { type: 'tax', label: 'VAT', amount: 1250 },
      { type: 'fee', label: 'Freight', amount: 500 },
      { type: 'discount', label: 'Discount', amount: 200 },
    ],
  }

  assert.equal(quoteTaxTreatment(quote), 'separate')
  assert.deepEqual(quoteAdjustmentDrafts(quote).map(({ type, label, amount }) => ({ type, label, amount })), [
    { type: 'tax', label: 'VAT', amount: 12.5 },
    { type: 'fee', label: 'Freight', amount: 5 },
    { type: 'discount', label: 'Discount', amount: 2 },
  ])
  assert.equal(quoteAdjustmentRows({ taxTreatment: 'included', adjustments: [] }).length, 0)
})
