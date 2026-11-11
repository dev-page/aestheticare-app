# Supply Workflow Production Readiness Design

**Status:** Approved for implementation by the user's request to fix the identified bugs and gaps
**Date:** 2026-11-12

## Goal

Make the clinic's inventory, procurement, finance, and pharmacy supply workflow safe and usable end to end, then restore the repository's production readiness checks and failing tests.

## Selected approach

Keep the existing clinic-owned supplier-contact model and inventory/procurement/finance workflow. Repair the Pharmacy backend authorization and return only a pharmacy-safe item projection. Stop the Pharmacy browser from reading full inventory records directly. Apply permission changes in Firestore and the employee dashboard to preserve the least-privilege boundary.

Treat received inventory lots as the traceable stock ledger. Reconcile older aggregate-only stock into a stable opening balance when it first enters a lot-aware transaction. Consume saleable stock by earliest expiry, skip expired stock, preserve reserved quantities, and store each allocation on the sale and movement. Keep aggregate stock and lots in sync for pharmacy and clinic treatment consumption, and carry lot allocations through restocking edits and returns where the existing workflow supports them.

Require an explicit integer quantity on prescription lines. Match Pharmacy sales to a completed consultation prescription and enforce the remaining prescribed quantity. Record partial dispensing and mark a prescription fully dispensed only after its prescribed quantities have been fulfilled. Do not infer a clinical quantity from dosage, frequency, or duration; old prescriptions without quantity must be updated by a clinician before dispensing.

Update the production readiness verifier to reflect the current explicit Inventory and Procurement routes plus the backward-compatible Logistics redirect. Fix the currently failing consultation-window and on-site walk-in behaviors according to their existing tests. Remove the obsolete supplier-account projection assertion from the supply test because supplier accounts have been retired.

## Data and compatibility rules

- Existing inventory items with no lot records keep their aggregate stock; the first lot-aware use creates an auditable opening balance, carrying the item's known expiry date when available.
- Received procurement lots retain their receiving, PO, supplier-contact, lot, and expiry references.
- A sale never consumes expired stock, never reduces stock below existing reservations, and records its exact lot allocations.
- Legacy prescription entries may still be displayed, but cannot authorize a quantity-based prescription sale until a clinician records the quantity.
- Supplier contacts remain clinic records. Supplier logins, external tax integrations, and Logistics workflows remain out of scope.
- A successful local build and test suite do not replace the required staging acceptance checks in `docs/production-e2e-checklist.md`.

## Acceptance criteria

- Pharmacy endpoints enforce an active Basic or Premium subscription, assigned branch, and action permission; supplier identities are rejected.
- Pharmacy users receive only sellable inventory fields through the API and cannot directly read full `inventoryItems` documents using `pharmacy:view`.
- Pharmacy checkout is idempotent, FEFO lot-aware, expiry-safe, reservation-safe, auditable, and keeps the inventory total synchronized.
- Prescriptions record a quantity, allow partial dispensing without overselling, and update their status accurately.
- Clinic treatment consumption and supported stock adjustments keep the lot ledger synchronized with aggregate stock.
- `npm test` (run as `npm.cmd test` on this Windows setup) passes, including production readiness verification.
- The frontend production build succeeds.
