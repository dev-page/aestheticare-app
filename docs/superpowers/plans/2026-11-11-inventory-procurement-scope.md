# Inventory and Procurement Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire supplier login access and the standalone supply Logistics module while keeping supplier contacts and moving supply receiving into Inventory.

**Architecture:** The current Express supply workflow remains the source of truth. New supplier communication is clinic-recorded, Inventory creates and onboards receiving records with Inventory permissions, and old Logistics URLs redirect to the new Inventory receiving page. Historical records remain readable; unrelated Finance and customer-order flows remain untouched.

**Tech Stack:** Vue 3, Vue Router, Express, Firebase Admin/Firestore, Firebase Auth, existing supply workflow records.

**Spec:** `docs/superpowers/specs/2026-11-11-inventory-procurement-scope-design.md`

## Global Constraints

- Keep Finance's existing budget, invoice, and payment workflows.
- Keep clinic supplier directory records, catalog data, and local regulatory-check fields.
- Do not delete or bulk-convert historical supplier accounts or Online-mode supply records.
- Do not remove customer-order fulfillment or `orders:view` / `orders:update` uses outside the supply workflow.
- Only accepted quantities enter Inventory; preserve partial receipt, discrepancy, audit, lot, movement, and idempotency behavior.
- Run no tests unless the user asks for testing or verification; use static review and the frontend production build for this implementation.

## Review Focus

- Historical Online-mode records must remain readable without retaining supplier access for new transactions.
- A legacy supplier-role account must be blocked without being redirected in a loop or receiving supply API data.
- Legacy `/logistics/*`, `/manager/logistics`, and `/supply-management/logistics/*` links must land on Inventory receiving.
- Inventory permission holders must be able to record receipt and onboard accepted stock; Procurement-only users must not post stock.
- Customer-order fulfillment must continue to use its existing order permissions and routes.

## File Map

- `backend/otp-backend/supplyWorkflow.js`: remove supplier-authenticated supply actions, force clinic-entered sourcing, move receiving authorization and notifications to Inventory.
- `backend/otp-backend/supplyModel.js`: remove supplier-only record projections/visibility from new supply access while retaining supplier references on internal records.
- `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`: replace Logistics view branches with Inventory receiving, remove supplier portal branches and Logistics ownership text, keep Finance and clinic procurement.
- `frontend/src/views/admin/owner/crm/ReceptionistInbox.vue`: remove the obsolete external supplier chat tab and polling/actions; preserve customer inbox.
- `frontend/src/router/index.js`, `frontend/src/components/sidebar/clinicSidebarItems.js`, and `frontend/src/App.vue`: expose only Inventory and Procurement supply routes, preserve redirects for old links, remove Logistics-only supply presentation.
- `frontend/src/views/public/Login.vue`: give retired supplier-role accounts a clear blocked-access outcome; keep existing clinic/customer authentication behavior.
- `frontend/src/config/clinicPermissionRegistry.js` and `frontend/src/views/admin/owner/OwnerRoleManagement.vue`: remove supply-Logistics role labels/defaults while preserving order permissions used by customer orders.
- `frontend/src/views/public/Home.vue`: remove standalone supplier-account and supply-Logistics claims from product copy.
- `storage.rules`: disable new writes to supplier-owned asset paths while retaining signed-in reads of historical assets.
- `docs/AesthetiCare_Process_Guide.txt`, `docs/supply-management-architecture.md`, `docs/supply-management-validation.md`, `docs/production-e2e-checklist.md`, `docs/booking-workflow.md`, and `docs/customer-apk-pwabuilder.md`: document the two-department supply flow and existing Finance handoff, and remove claims that supplier users sign in.

## Tasks

### Task 1: Make supply APIs clinic-only and Inventory-owned

**Files:**
- Modify: `backend/otp-backend/supplyWorkflow.js`
- Modify: `backend/otp-backend/supplyModel.js`

- [x] Remove supplier-role projections, supplier-side mutations, supplier notifications, and supplier-only chat/document access from the supply API; retain clinic staff communication/evidence records.
- [x] Require clinic Procurement permission for quotes, supplier confirmation, and PO actions; require `inventory:create` for receiving, inspection, discrepancy resolution, and accepted-stock onboarding.
- [x] Ensure new sourcing is clinic-entered/manual; keep historical Online records readable.
- [x] Preserve branch checks, transaction writes, quantity invariants, audit history, idempotent onboarding, and existing Finance handoffs.
- [x] Review API authorization branches and document behavior statically.
- [x] Remove the staff-side supplier chat integration and disable new supplier-owned storage uploads without deleting historical documents.

### Task 2: Fold receiving into Inventory and retire supply Logistics UI

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/components/sidebar/clinicSidebarItems.js`
- Modify: `frontend/src/App.vue`

- [x] Add Inventory receiving/inspection navigation and view at `/inventory/receiving`, reusing existing receiving records and onboarding actions.
- [x] Remove the supply Logistics department view, counters, filters, reports, and owner labels; remove supplier portal-only view states.
- [x] Redirect legacy Logistics supply URLs to the equivalent Inventory dashboard or receiving page.
- [x] Confirm Inventory and Procurement routes keep their existing permission gates and Finance routes remain unchanged.

### Task 3: Align account messaging, roles, and scope copy

**Files:**
- Modify: `frontend/src/views/public/Login.vue`
- Modify: `frontend/src/config/clinicPermissionRegistry.js`
- Modify: `frontend/src/views/admin/owner/OwnerRoleManagement.vue`
- Modify: `frontend/src/views/public/Home.vue`

- [x] Block existing supplier-role sign-ins with a clear message and no redirect loop; do not delete historical user records.
- [x] Remove supply Logistics from role templates and descriptions without removing order permissions used by customer-order workflows.
- [x] Update product copy to describe Inventory and Procurement with clinic-managed suppliers and no supplier portal.
- [x] Remove the supplier tab from the Receptionist Inbox while preserving customer conversations.

### Task 4: Align workflow documentation and review the result

**Files:**
- Modify: `docs/AesthetiCare_Process_Guide.txt`
- Modify: `docs/supply-management-architecture.md`
- Modify: `docs/supply-management-validation.md`
- Modify: `docs/production-e2e-checklist.md`

- [x] Replace supplier-account and supply Logistics descriptions with clinic-entered supplier responses and Inventory receiving/inspection.
- [x] Update older booking/PWA guidance and preserve read access to historical supplier assets only.
- [x] Preserve Finance and historical-data caveats in the docs.
- [x] Run `git diff --check` and `npm.cmd run build`; inspect the complete diff and report that tests were not run.

