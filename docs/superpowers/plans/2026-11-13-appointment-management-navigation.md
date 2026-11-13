# Appointment Management Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate appointment records and approval requests under one Appointments area while retaining the separate service queue and online consultation workflow.

**Architecture:** Keep `AppointmentRecords` and `AppointmentRequestApprovals` as separate workflow components. Update `AppointmentManagement.vue` to provide two top-level areas and two appointment views, preserve legacy query URLs, and receive the pending review count from the approvals view. Make the connected Google hosting card collapsible without changing its account API.

**Tech Stack:** Vue 3, Vue Router, Node.js built-in test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-11-13-appointment-management-navigation-design.md`

## Global Constraints

- Preserve existing permission keys and data schemas.
- Preserve the three online request types: booking, cancellation, and reschedule.
- Preserve service queue and online consultation routes.
- Keep connected account attendance warnings visible.

## Review Focus

- Legacy `tab=requests` deep links still open Needs review.
- Review-only staff land on the review view and cannot access appointment records.
- Appointment-only staff do not see or enter the review view.
- Consultation-only staff still land in Online Consultations.
- Connected, disconnected, loading, and attendance-disabled Meet account states retain usable controls and status.

---

### Task 1: Make appointment navigation state explicit and testable

**Files:**
- Create: `frontend/src/utils/appointmentManagementNavigation.js`
- Create: `frontend/src/utils/appointmentManagementNavigation.test.js`
- Modify: `frontend/src/views/admin/owner/crm/AppointmentManagement.vue`

**Interfaces:**
- Produces `resolveAppointmentManagementState({ query, canView, canReview, canOnline, canQueue })`, returning `{ activeTab, appointmentView, onlineMode }`.

- [x] Write tests for new/default appointment view, legacy request URL, permission fallbacks, queue URL, and online-only access.
- [x] Run the targeted test and confirm it fails because the navigation resolver does not exist.
- [x] Implement the resolver and use it in `AppointmentManagement.vue`.
- [x] Run the targeted test and confirm all assertions pass.

### Task 2: Consolidate navigation and expose pending review count

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/AppointmentManagement.vue`
- Modify: `frontend/src/views/admin/owner/crm/AppointmentRequestApprovals.vue`

**Interfaces:**
- `AppointmentRequestApprovals` emits `pending-count` with the number of pending booking, cancellation, and reschedule requests.
- Existing `embedded` and `branchId` props remain unchanged.

- [x] Replace the three top-level links with Appointments and Service Queue.
- [x] Add All appointments and Needs review views under Appointments, showing the pending count and preserving permission gates.
- [x] Default the request status filter to Pending while retaining its existing status choices.
- [x] Keep selected branch choices in the URL across view changes without scoping the default All appointments view.
- [x] Load the pending count when the appointments area first opens so Needs review is accurately badged immediately.
- [x] Run targeted navigation tests and `npm run build`.

### Task 3: Collapse connected Google hosting details

**Files:**
- Modify: `frontend/src/components/common/GoogleHostingAccount.vue`

- [x] Show a compact connected-account summary with expandable management details.
- [x] Keep reconnect, disconnect, setup retry, and configuration instructions reachable.
- [x] Keep attendance-disabled warnings visible while applicable.
- [x] Run `npm run build` and inspect the diff for preserved account actions.

### Task 4: Final verification

**Files:** All files above.

- [x] Run the targeted navigation test.
- [x] Run the production build.
- [x] Run the full test suite and `git diff --check`; inspect the complete diff for permission, route, or workflow regressions.
