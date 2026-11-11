# Supplier Quote Breakdown Implementation Plan

> **For agentic workers:** execute this plan inline in the current workspace. Existing user changes must be preserved.

**Goal:** Make supplier tax treatment, fees, discounts, and quoted totals explicit through Procurement and Finance.

**Architecture:** Normalize itemized adjustment rows in the shared supply model, retaining aggregate fields for old records. Reuse one frontend pricing helper across the two quote entry surfaces, purchase order views, and exports.

**Tech Stack:** Vue 3, JavaScript modules, Firebase-backed supply workflow.

**Spec:** `docs/superpowers/specs/2026-11-12-supplier-quote-breakdown-design.md`

## Global Constraints

- Preserve all pre-existing uncommitted changes.
- Do not add or run tests unless the user asks to test or verify implementation.
- Keep supplier accounts out of the purchase workflow and do not add jurisdiction-specific tax calculations.
- Existing aggregate price fields and records remain compatible.

## Review Focus

- Inclusive tax must not be added twice; backend rejects a separate tax adjustment in this mode.
- A stated total mismatch must block submission in the UI and backend.
- Legacy aggregate records must remain readable in views and exports.
- Itemized invoice charges must not exceed their approved PO allowances across partial invoices.
- All quote entry points must send the same adjustment shape.

## Tasks

### Task 1: Normalize quote pricing in the backend

**Files:** `backend/otp-backend/supplyModel.js`, `backend/otp-backend/supplyWorkflow.js`

- [x] Add itemized adjustment normalization, tax-treatment validation, aggregate compatibility values, and stated-total matching.
- [x] Use the same normalization in direct Procurement quotes, RFQ quotations, and Finance invoices.
- [x] Carry adjustment rows and tax treatment from quotations through budget requests and purchase orders.
- [x] Match invoice adjustment rows against cumulative PO allowances while preserving legacy checks.

### Task 2: Update quote entry and purchase order display

**Files:** `frontend/src/utils/supplyQuotePricing.js`, `frontend/src/views/admin/owner/operations/SimplifiedSupplyRequests.vue`, `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`, `frontend/src/components/common/PurchaseOrderSummary.vue`

- [x] Add shared conversion and total helpers for itemized and historical aggregate pricing.
- [x] Add tax treatment, repeatable named adjustments, supplier-stated total, and mismatch feedback to both quote entry surfaces and invoice entry.
- [x] Render named adjustment rows and tax treatment in purchase order views, summary, and PDF export.

### Task 3: Review the final change

- [x] Inspect the changed pricing flow and run `git diff --check`.
- [x] Run the frontend production build and backend syntax check; do not run the test suite.
- [x] Record validation: production build passed; both backend syntax checks passed; diff whitespace check passed. PowerShell's `npm` wrapper was blocked by execution policy, so the same build ran successfully through `npm.cmd`.
