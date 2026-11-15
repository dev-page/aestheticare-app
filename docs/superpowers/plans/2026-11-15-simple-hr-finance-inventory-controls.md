# Simple HR, Finance, and Inventory Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close agreed payroll, leave, Finance reporting, and inventory reconciliation gaps with simple, backend-enforced clinic workflows.

**Architecture:** Use small shared calculation modules that both the UI and backend consume where possible. Keep policy and writes branch-scoped behind authenticated backend routes, and add a read-only reconciliation summary to the existing Inventory workspace.

**Tech Stack:** Vue 3, Firebase Firestore, Express backend, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-15-simple-hr-finance-inventory-controls.md`

## Global Constraints

- Preserve the current in-progress workspace changes; do not reset, stash, or overwrite them.
- Do not expose secrets, change external systems, or deploy.
- Keep leave and payroll rates configurable; never hard-code a claim that the app's values are legally authoritative.
- Inventory reconciliation is read-only.
- Write and run each focused failing test before implementing its behavior.

## Review Focus

- Tampered deduction lines or changed deduction settings are rejected during payroll submission.
- Missing or invalid employment start dates cannot silently grant tenure-based paid leave.
- Refunds represented as negative transactions are counted once and displayed separately.
- Lots from another item or branch never affect a reconciliation total.
- Mismatches and invalid lot quantities are reported without writes or data loss.

---

### Task 1: Backend-verified payroll deductions

**Files:**
- Create: `shared/payrollDeductions.js`, `shared/payrollDeductions.test.js`
- Modify: `backend/otp-backend/payrollWorkflow.js`, `frontend/src/views/admin/owner/hr/Payroll.vue`, `firestore.rules`, root `package.json`

**Interfaces:**
- Produce `calculatePayrollDeductions(grossPay, settings)` and `payrollDeductionsMatch({ grossPay, settings, settingsSnapshot, deductions, totalDeductions, netPay })`.
- Add authenticated `/payroll/settings` GET/POST routes; POST validates settings and writes an audit row.

- [x] Write failing calculation and tampering tests.
- [x] Run those tests and confirm expected failures.
- [x] Implement the shared calculation; use it in the UI and submission validation.
- [x] Move settings saves behind the backend and deny browser writes in Firestore rules.
- [x] Run targeted tests and backend syntax check.

### Task 2: Configurable paid-leave eligibility

**Files:**
- Create: `shared/leavePolicy.js`, `shared/leavePolicy.test.js`
- Modify: `backend/otp-backend/hrWorkflow.js`, `frontend/src/views/admin/owner/hr/LeaveManagement.vue`, `frontend/src/views/admin/owner/hr/LeaveRequest.vue`, `frontend/src/views/admin/owner/hr/BasePay.vue`, root `package.json`

**Interfaces:**
- Produce `normalizeLeavePolicy(input)`, `isEligibleForPaidLeave(employmentStartDate, asOfDate, eligibilityMonths)`, and `/hr/leave-policy` GET/POST routes.
- Default to the existing five scheduled workdays per year and twelve months of service; make both values clinic-editable.
- Store the employee's employment start date on the existing staff profile.

- [x] Write failing policy normalization, tenure-boundary, and missing-date tests.
- [x] Run tests and confirm expected failures.
- [x] Implement backend policy enforcement and reviewer settings UI.
- [x] Update the employee leave page to display the same allowance and eligibility rule.
- [x] Run targeted tests and backend syntax check.

### Task 3: Refund-aware monthly financial activity

**Files:**
- Create: `shared/financeSummary.js`, `shared/financeSummary.test.js`
- Modify: `frontend/src/views/admin/owner/finance/FinanceReports.vue`, root `package.json`

**Interfaces:**
- Produce `summarizeFinanceMonth({ transactions, payrolls, financialRecords, monthKey })` with gross collections, refunds, net collections, costs, and net recorded activity.

- [x] Write failing tests for sale/refund split, date grouping, and zero/negative values.
- [x] Run tests and confirm expected failures.
- [x] Implement the summary helper and use it in Finance cards, breakdown, and sales tables.
- [x] Label the date basis and rename the result to avoid implying audited profit.
- [x] Run targeted tests and frontend build.

### Task 4: Read-only inventory lot reconciliation

**Files:**
- Modify: `backend/otp-backend/inventoryLots.js`, `backend/otp-backend/inventoryLots.test.js`, `backend/otp-backend/supplyWorkflow.js`, `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`

**Interfaces:**
- Produce `summarizeInventoryLotReconciliation(items, lotRecords)` returning mismatched/invalid item totals only.
- Include the summary in the existing Inventory workspace response only for authorized inventory viewers.

- [x] Write failing tests for mismatches, branch/item isolation, and invalid lot quantities.
- [x] Run tests and confirm expected failures.
- [x] Implement read-only aggregation and an Inventory page notice/table with no auto-correct action.
- [x] Run targeted tests, backend syntax check, production verification, and frontend build.

## Execution Notes

- The existing worktree is already carrying related in-progress changes from the preceding user-approved work. Continue in that workspace to preserve them.
- Do not commit or deploy as part of this task.

## Verification Results

- Focused payroll, leave, Finance summary, inventory reconciliation, HR workflow, and integration tests: 23 passed.
- Backend syntax checks: passed.
- Frontend production build: passed (Vite transformed 800 modules).
- Production static verification: passed.
- Initial full-suite failures were resolved: appointment fixtures now match the normalized schedule data contract; the booking source-extraction harness supplies the refund workflow dependency; refund tests cover the active settlement endpoints and assert retired voucher routes return 410; Firestore rule assertions now distinguish reads from writes; and walk-in validation explicitly explains the one-client rule.
- Final full `npm test`: 253 passed, 0 failed.
- Production readiness verification passed with a warning that the ignored local `backend/otp-backend/serviceAccountKey.json` exists. Keep it out of version control and confirm the key has been rotated before release.
