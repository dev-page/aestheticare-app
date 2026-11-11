# Supply Workflow Production Readiness Plan

> Execute inline in the current shared checkout. The user requested implementation now; preserve all existing uncommitted work and do not commit.

**Goal:** Fix release blockers across Inventory, Procurement, Finance, and Pharmacy, plus restore the failing project checks.

**Architecture:** Add focused backend helpers for Pharmacy projections, prescription quantities, and lot allocations. Integrate them into the existing Firebase transactions and update the relevant Vue, rules, and readiness-check code.

**Tech Stack:** Node.js ES modules, Firebase Admin transactions, Firestore rules, Vue 3, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-11-12-supply-workflow-readiness-design.md`

## Global constraints

- Preserve the existing dirty working tree and every pre-existing edit.
- The user explicitly asked to fix the bugs and failures, so add and run focused tests plus the full configured suite.
- Do not read, modify, or copy the service-account key shown in the IDE context.
- Keep the current clinic supplier-contact workflow; do not add supplier accounts or a Logistics module.
- Do not claim production deployment acceptance without staging evidence.

## Review focus

- Pharmacy rejects unauthorized, unassigned, supplier, free-plan, and inactive-subscription access.
- Pharmacy does not expose cost, supplier, or procurement fields through browser reads or API payloads.
- Replayed checkouts cannot deduct stock twice; expired and reserved quantities cannot be dispensed.
- FEFO lot allocations and prescription remaining quantities are enforced in the transaction and retained in the records.
- Consultation timer behavior does not fabricate clinical notes or customer confirmation; duration cannot exceed the official window.
- Readiness checks describe current routes and have no accidental Logistics feature matcher.

## Tasks

### Task 1: Repair Pharmacy authorization, projection, and access boundary

**Files:** `backend/otp-backend/pharmacyWorkflow.js`, `backend/otp-backend/pharmacyWorkflow.test.js`, `frontend/src/views/admin/owner/clinic/PharmacyPOS.vue`, `frontend/src/views/admin/owner/employee/EmployeeDashboard.vue`, `firestore.rules`

- [x] Add failing route tests for valid access, denied roles/plans, and the safe item projection.
- [x] Import and apply the shared permission check; align subscription checks with Inventory and Procurement.
- [x] Return only enabled, pharmacy-safe inventory fields from the API.
- [x] Replace the Pharmacy page's direct `inventoryItems` subscription with the API data.
- [x] Remove `pharmacy:view` as authorization to read complete inventory documents; retain dashboard inventory reads only for inventory/finance permissions.
- [x] Run focused Pharmacy tests and inspect all outputs.

### Task 2: Make stock and prescription dispensing traceable

**Files:** `backend/otp-backend/pharmacyWorkflow.js`, `backend/otp-backend/inventoryLots.js`, `backend/otp-backend/supplyWorkflow.js`, `backend/otp-backend/bookingMilestones.js`, `backend/otp-backend/orderWorkflow.js`, `frontend/src/utils/prescriptions.js`, `frontend/src/views/admin/owner/clinic/PharmacyPOS.vue`, `frontend/src/views/admin/owner/clinic/ClinicPrescriptions.vue`, related tests

- [x] Add failing tests for opening-stock migration, FEFO allocation, expiry and reservation handling, exact lot movements, idempotent checkout, and prescription quantity limits/partial fills.
- [x] Implement a shared transaction-safe lot allocation/restoration helper and keep supported inventory mutations synchronized.
- [x] Add prescribed quantity to clinician entry and enforce it at backend dispense time.
- [x] Track cumulative dispensed quantities and expose remaining quantity in the Pharmacy UI.
- [x] Run supply, order, booking, and Pharmacy-focused tests.

### Task 3: Restore production checks and fix the remaining configured test failures

**Files:** `scripts/verify-production-readiness.mjs`, consultation window/booking files and tests, `backend/otp-backend/walkInBookings.js`, `backend/otp-backend/supplyWorkflow.test.js`

- [x] Add/adjust failing tests for elapsed online consultation windows, bounded duration, on-site consultation mode, and the retired supplier projection assertion.
- [x] Update the static route matcher for explicit Inventory/Procurement routes and the Logistics compatibility redirect.
- [x] Move expired active consultations to customer confirmation without bypassing documentation or team confirmations; clamp recorded duration to the official window.
- [x] Preserve on-site walk-in consultations while rejecting online walk-ins.
- [x] Run `npm.cmd test` and compare every result.

### Task 4: Final verification and release boundary

- [x] Run the production readiness guard, full test suite, frontend production build, backend syntax checks, and `git diff --check`.
- [x] Review the task changes and preserve the existing working tree changes.
- [x] Record staging-only checks still needed, including the existing staging checklist.
