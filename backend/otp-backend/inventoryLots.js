import { demand } from './supplyModel.js'

const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const numericQuantity = value => {
  const result = Number(value || 0)
  demand(Number.isSafeInteger(result) && result >= 0, 'Inventory lot quantity is invalid; ask Inventory to reconcile the item.', 409)
  return result
}
const recordData = record => typeof record?.data === 'function' ? record.data() || {} : record || {}
const timestampValue = value => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value || 0)
  return Number.isFinite(date.getTime()) ? date.getTime() : 0
}
const expiryValue = lot => String(lot.expiryDate || '')
const isUsableLot = lot => {
  const condition = String(lot.condition || '').trim().toLowerCase()
  return !condition || ['good', 'usable', 'active'].includes(condition)
}
const compareLots = (left, right) => {
  const a = expiryValue(left.data), b = expiryValue(right.data)
  const aKnown = dayPattern.test(a), bKnown = dayPattern.test(b)
  if (aKnown && bKnown && a !== b) return a.localeCompare(b)
  if (aKnown !== bKnown) return aKnown ? -1 : 1
  const receivedOrder = timestampValue(left.data.receivedAt) - timestampValue(right.data.receivedAt)
  return receivedOrder || left.id.localeCompare(right.id)
}

const normalizeLots = (branchId, itemId, records) => records
  .map(record => ({ id: String(record.id || ''), data: recordData(record) }))
  .filter(({ id, data }) => id && data.branchId === branchId && data.itemId === itemId)
  .map(lot => ({ ...lot, data: { ...lot.data, remainingQuantity: numericQuantity(lot.data.remainingQuantity) } }))

export const reconcileLotsToInventory = ({ branchId, itemId, item = {}, lotRecords = [] }) => {
  const target = numericQuantity(item.currentStock)
  let lots = normalizeLots(branchId, itemId, lotRecords)
  const changed = new Map()
  const adjustments = []
  let total = lots.reduce((sum, lot) => sum + lot.data.remainingQuantity, 0)

  if (total < target) {
    const openingId = `opening-${branchId}-${itemId}`
    const existing = lots.find(lot => lot.id === openingId)
    const difference = target - total
    const opening = existing || {
      id: openingId,
      data: {
        branchId,
        itemId,
        source: 'opening_stock_reconciliation',
        lot: 'Opening stock (legacy balance)',
        expiryDate: String(item.expiryDate || ''),
        manufacturingDate: String(item.manufacturingDate || ''),
        receivedQuantity: 0,
        remainingQuantity: 0,
      },
    }
    opening.data = {
      ...opening.data,
      receivedQuantity: numericQuantity(opening.data.receivedQuantity) + difference,
      remainingQuantity: opening.data.remainingQuantity + difference,
    }
    if (existing) lots = lots.map(lot => lot.id === openingId ? opening : lot)
    else lots.push(opening)
    changed.set(openingId, { data: opening.data, created: !existing })
    adjustments.push({ lotId: openingId, quantity: difference, direction: 'increase' })
    total = target
  } else if (total > target) {
    let excess = total - target
    // A manual count is authoritative. Reduce the most recently received
    // balances first so the oldest and nearest-expiry stock remains FEFO-ready.
    const newestFirst = [...lots].sort((a, b) => timestampValue(b.data.receivedAt) - timestampValue(a.data.receivedAt) || b.id.localeCompare(a.id))
    for (const lot of newestFirst) {
      if (!excess) break
      const reduction = Math.min(excess, lot.data.remainingQuantity)
      if (!reduction) continue
      lot.data = { ...lot.data, remainingQuantity: lot.data.remainingQuantity - reduction }
      changed.set(lot.id, { data: lot.data, created: false })
      adjustments.push({ lotId: lot.id, quantity: reduction, direction: 'decrease' })
      excess -= reduction
    }
    total = target
  }

  return {
    lots,
    lotWrites: [...changed].map(([id, value]) => ({ id, ...value, merge: true })),
    adjustments,
    totalQuantity: total,
  }
}

export const planLotRestoration = ({ branchId, itemId, allocations = [], lotRecords = [], returnId = '' }) => {
  const existing = new Map(normalizeLots(branchId, itemId, lotRecords).map(lot => [lot.id, lot]))
  const writes = new Map()
  const restored = []
  for (const allocation of allocations) {
    const amount = numericQuantity(allocation.quantity)
    if (!amount) continue
    const lotId = String(allocation.lotId || '') || `return-${returnId}-${itemId}`
    const prior = existing.get(lotId) || writes.get(lotId)?.data
    const priorData = prior?.data || prior
    const data = priorData
      ? { ...priorData, remainingQuantity: numericQuantity(priorData.remainingQuantity) + amount }
      : {
          branchId,
          itemId,
          source: 'inventory_return',
          returnedFrom: String(returnId || ''),
          lot: String(allocation.lot || ''),
          expiryDate: String(allocation.expiryDate || ''),
          receivedQuantity: amount,
          remainingQuantity: amount,
        }
    writes.set(lotId, { id: lotId, data, created: !existing.has(lotId) && !writes.has(lotId), merge: true })
    restored.push({ lotId, quantity: amount })
  }
  return { lotWrites: [...writes.values()], restored }
}

export const lotAvailableQuantity = ({ branchId, itemId, item = {}, lotRecords = [], today }) => {
  const reconciliation = reconcileLotsToInventory({ branchId, itemId, item, lotRecords })
  const usableQuantity = reconciliation.lots
    .filter(({ data }) => isUsableLot(data))
    .filter(({ data }) => {
      const expiry = expiryValue(data)
      return !expiry || (dayPattern.test(expiry) && expiry >= today)
    })
    .reduce((sum, lot) => sum + lot.data.remainingQuantity, 0)
  const reserved = numericQuantity(item.reservedStock)
  return Math.max(0, usableQuantity - Math.min(reserved, usableQuantity))
}

export const planLotConsumption = ({ branchId, itemId, item = {}, lotRecords = [], quantity, today }) => {
  const requested = numericQuantity(quantity)
  demand(requested > 0, 'Quantity must be a whole number.', 400)
  const reconciliation = reconcileLotsToInventory({ branchId, itemId, item, lotRecords })
  const validDay = dayPattern.test(today || '')
  demand(validDay, 'A valid inventory date is required.', 400)
  const usable = reconciliation.lots
    .filter(({ data }) => isUsableLot(data))
    .filter(({ data }) => {
      const expiry = expiryValue(data)
      return !expiry || (dayPattern.test(expiry) && expiry >= today)
    })
    .sort(compareLots)
  const usableQuantity = usable.reduce((sum, lot) => sum + lot.data.remainingQuantity, 0)
  const reserved = numericQuantity(item.reservedStock)
  let reservedRemaining = reserved
  const reservedByLot = new Map()
  for (const lot of [...usable].reverse()) {
    if (!reservedRemaining) break
    const held = Math.min(lot.data.remainingQuantity, reservedRemaining)
    if (held) reservedByLot.set(lot.id, held)
    reservedRemaining -= held
  }
  const availableQuantity = Math.max(0, usableQuantity - Math.min(reserved, usableQuantity))
  demand(requested <= availableQuantity,
    usableQuantity === 0
      ? 'No unexpired, usable lot stock is available for this item.'
      : `Only ${availableQuantity} unreserved, unexpired units are available for this item.`,
    409)

  let remaining = requested
  const allocations = []
  const writes = new Map(reconciliation.lotWrites.map(write => [write.id, write]))
  for (const lot of usable) {
    if (!remaining) break
    const canTake = Math.max(0, lot.data.remainingQuantity - (reservedByLot.get(lot.id) || 0))
    const take = Math.min(canTake, remaining)
    if (!take) continue
    const after = { ...lot.data, remainingQuantity: lot.data.remainingQuantity - take }
    allocations.push({ lotId: lot.id, lot: String(lot.data.lot || ''), expiryDate: expiryValue(lot.data), quantity: take })
    const previousWrite = writes.get(lot.id)
    writes.set(lot.id, { id: lot.id, data: after, created: previousWrite?.created || false, merge: true })
    remaining -= take
  }
  demand(remaining === 0, 'Inventory lots changed during this request. Refresh stock and try again.', 409)
  return {
    allocations,
    availableQuantity,
    lotWrites: [...writes.values()],
    adjustments: reconciliation.adjustments,
    totalQuantity: reconciliation.totalQuantity - requested,
  }
}
