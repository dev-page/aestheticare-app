# Inventory Activity Log Design

## Intent

Show clinic staff a clear, searchable history of stock changes below the inventory item list. This helps staff distinguish a supplier receipt from a stock count correction or stock consumed through a service or sale.

## Goals

- Display stock movements for the selected branch, newest first, below the inventory list.
- Show item, timestamp, movement type, quantity change, before/after quantity when recorded, reason or source, actor when available, and linked purchase/receipt/appointment/order reference.
- Normalize the existing movement shapes for adjustments, opening stock, purchase receipts, service consumption, pharmacy dispensing, product sales, and returned/cancelled sales.
- Record before/after stock values transactionally for future stock changes where the current movement record does not include them.
- Keep the existing inventory permission checks and branch scoping.

## Non-goals

- Add a supplier portal or change purchase approval policy.
- Treat a manual adjustment as a supplier receipt.
- Fabricate before/after values for historical movements that did not store them.
- Create a second audit collection that duplicates inventory movement records.

## Approaches

1. **Inline table below the inventory list (chosen):** matches the requested placement and makes recent movement history visible on the inventory screen.
2. Collapsed activity section below the list: saves vertical space, but hides the history until opened.
3. Separate history page: supports a larger report view, but adds navigation for a task staff expect beside inventory.

## Design

Use the existing `inventoryMovements` records already returned by the branch-scoped workspace endpoint. Render a responsive table directly below the inventory items table, with filters for item, movement type, and date range and pagination for older entries. Normalize single-item and multi-item movement records into rows. Show missing historical before/after values as unavailable rather than estimating them. New stock-changing writes should save the affected item's before and after quantity alongside the movement, in the same transaction as the stock update. Keep the history read-only.

The table is visible only to users who already have inventory-view or report-view access to that branch. Existing audit entries remain the audit source for metadata edits and workflow state changes; the new table focuses on stock quantity movements.
