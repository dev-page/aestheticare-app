# Supply Workflow Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Inventory and Procurement supply handoffs simpler to understand and complete without changing approval or stock-accounting rules.

**Architecture:** Reuse the existing Vue screens and backend transitions. Procurement's optional invoice fields move behind a disclosure, and Inventory's receiving form saves the inspection, uploads receipt evidence, then invokes the existing stock-onboarding action with a retry path for partial failure.

**Tech Stack:** Vue 3, JavaScript, existing supply workflow API, CSS theme tokens.

**Spec:** `docs/superpowers/specs/2026-11-21-supply-workflow-simplification-design.md`

## Global Constraints

- Finance purchase-order approval remains required.
- Accepted stock is added only after inspection and delivery receipt evidence.
- Existing inventory movements, lots, audit history, and discrepancy records remain intact.
- No tests are added or run unless requested.

## Review Focus

- Receipt upload fails after inspection saves: the UI must direct the user to the saved receiving record and avoid creating a duplicate.
- Stock posting fails after receipt upload: the existing retry action must remain available on the saved record.
- Accepted plus rejected quantities must equal delivered quantities; rejected quantity is derived in the UI and validated by the existing backend.
- Invoice price reconciliation and document evidence remain required before Finance review.
- Optional lot and equipment fields remain available when needed.

---

### Task 1: Shorten the supply flow guide and routine invoice review

**Files:**
- Modify: `frontend/src/components/common/SupplyFlowGuide.vue`
- Modify: `frontend/src/views/admin/owner/operations/SimplifiedSupplyRequests.vue`

**Interfaces:**
- Keep the guide's existing `department` and `page` props.
- Keep the existing quote draft shape and `sendForApproval` payload.

- Replace the six instructional cards with four concise workflow stages.
- Move tax handling and optional charges, discounts, warranty, and terms under one clearer optional disclosure.
- Retain the item-price/total match, invoice attachment, and Procurement confirmation checks.

### Task 2: Combine delivery inspection and stock receipt into one Inventory action

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`

**Interfaces:**
- Reuse `POST /supply/records` for the inspection record.
- Reuse `POST /supply/records/:id/documents` for the delivery receipt.
- Reuse `POST /supply/records/:id/actions` with `action: "onboard"` to add accepted stock.

- Present delivered and accepted quantities as the primary inputs; derive rejected quantity.
- Place lot, expiry, and equipment metadata in a collapsed optional section.
- Require a valid PDF, PNG, or JPEG delivery receipt before starting submission.
- Save the receiving record, upload the receipt, and add accepted stock sequentially.
- On upload or onboarding failure, reload and open the saved receiving record so the user can retry without making another receiving record.
- Update labels and success/error messages to say when accepted stock has actually been added.

### Task 3: Review the change

**Files:**
- Review the files changed in Tasks 1 and 2.

- Confirm the procurement optional disclosure preserves all quote fields and the Finance-ready calculation.
- Confirm receiving keeps the existing backend validation and recovery controls.
- Inspect the diff and run the frontend production build if the project provides one; do not run tests.
