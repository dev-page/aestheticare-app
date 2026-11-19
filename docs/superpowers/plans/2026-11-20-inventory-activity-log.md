# Inventory Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Show a branch-scoped, searchable history of inventory quantity movements below the inventory item list.

**Architecture:** Extend existing `inventoryMovements` writes with consistent per-item before/after stock snapshots, normalize legacy and current records into display rows, then render those rows in an activity table in `SupplyWorkspace.vue`. Continue using the existing workspace endpoint's inventory/report permissions and branch scope.

**Tech Stack:** Vue 3, JavaScript, Express, Firebase Admin / Firestore.

**Spec:** `docs/superpowers/specs/2026-11-20-inventory-activity-log-design.md`

## Global Constraints

- Do not fabricate before/after values for historical movement records that do not contain them.
- Keep movement history read-only and branch-scoped.
- Avoid a second audit collection; use `inventoryMovements` as the stock-quantity ledger.
- Do not change procurement approvals or add supplier accounts.

## Review Focus

- Historical movements without before/after values must still render with those values marked unavailable.
- Multi-item movements must render one row per affected item.
- Movements with only an item ID must still render if the item is absent from the current catalog.
- Zero-quantity edits must not appear as stock changes.
- Users without inventory or report read permission must not receive or see movement history.

---

### Task 1: Record consistent stock snapshots in movement entries

**Files:**
- Modify: `backend/otp-backend/supplyWorkflow.js`
- Modify: `backend/otp-backend/bookingMilestones.js`
- Modify: `backend/otp-backend/orderWorkflow.js`
- Modify: `backend/otp-backend/pharmacyWorkflow.js`

**Interface:** New movement records add `stockChanges: Array<{ inventoryItemId: string, itemName: string, quantityDelta: number, stockBefore: number, stockAfter: number }>` while retaining existing fields for compatibility.

- [ ] Add `stockChanges` to manual inventory adjustments and purchase receiving, using the transaction's current quantity and accepted quantity.
- [ ] Add `stockChanges` to appointment material consumption and pharmacy sales using each transaction's item snapshots.
- [ ] Add `stockChanges` to product sales, fulfillment deductions, and cancelled-sale returns using the stock plan's `current` and `quantity` values.
- [ ] Keep the movement record and stock update in the same Firestore transaction.

### Task 2: Normalize inventory movements for display

**Files:**
- Create: `frontend/src/views/admin/owner/operations/inventoryActivity.js`

**Interface:** Export `normalizeInventoryMovements(movements, items)`, returning rows with movement ID, item ID/name, timestamp, type, signed quantity delta, optional before/after quantities, reason/source, actor, and source reference.

- [ ] Prefer `stockChanges` for new records and support legacy single-item (`inventoryItemId` / `quantity`) and multi-item (`items`) records.
- [ ] Resolve item labels from the current catalog, then movement snapshot fields, then the item ID.
- [ ] Leave before/after unavailable for legacy records that lack snapshots; omit rows whose signed quantity delta is zero.

### Task 3: Add the Inventory Activity table below the item list

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`

- [ ] Render the table only on Inventory → Items, after the existing inventory list and its pagination.
- [ ] Use `data.movements` and the normalizer; sort newest first.
- [ ] Add item search, movement type, date-range filters, and independent pagination.
- [ ] Show date, item, movement type, before/change/after quantities, reason or source, actor, and linked record reference.
- [ ] Show an empty state when there are no matching movements and maintain the existing permission-aware workspace data flow.

## Verification Constraints

The implementation must not add or run tests unless the user asks for testing or verification. Review the changed paths and preserve existing movement fields for compatibility.
