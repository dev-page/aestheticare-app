# Policy-Driven Appointment Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align appointment cancellation and rescheduling UI, API enforcement, group invite flows, and clinic policy settings.

**Architecture:** A small shared policy helper computes cancellation refunds and reschedule eligibility for both browser and server. The API becomes the only customer request writer, snapshots policy terms, and revalidates selected schedules when clinics approve them.

**Tech Stack:** Vue 3, Firebase Firestore, Node.js ESM, Express, built-in `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-13-policy-driven-appointment-changes.md`

## Global Constraints

- Keep appointment requests pending until a clinic approves or rejects them.
- Do not reserve a reschedule slot while it awaits clinic review.
- Preserve existing booking, consultation, treatment-session, and calendar behavior outside these request paths.

## Review Focus

- Exact cancellation band boundaries and zero-paid appointments are covered by helper tests.
- Reschedule allowance at zero, below limit, and at limit is covered by helper tests.
- Group invitees and account customers enforce the same toggles and allowance.
- Schedule conflicts are checked at request and approval without creating a pending slot hold.
- Legacy requests without a refund snapshot retain the existing approval fallback.

---

### Task 1: Shared policy calculations

**Files:** Create `shared/appointmentChangePolicy.js`, `shared/appointmentChangePolicy.test.js`.

- [x] Add tests for each cancellation band, refund percentage after commission, disabled non-refundable bands, overpayment caps, and reschedule allowance boundaries.
- [x] Run `node --test shared/appointmentChangePolicy.test.js` and verify it fails when the helper module is absent.
- [x] Implement the shared helpers and rerun the focused tests.

### Task 2: Policy management and customer experience

**Files:** Modify `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`, `frontend/src/views/customer/MyAppointments.vue`, `frontend/src/views/public/GroupConsent.vue`.

- [x] Enforce contiguous cancellation thresholds and copy numeric policy fields to published branch documents.
- [x] Reflect enabled flags and remaining reschedule allowance in customer actions; show cancellation estimates and clarify that approval is still required.
- [x] Reflect request policies and allowance in the token-based group attendee view.

### Task 3: API enforcement and audit data

**Files:** Modify `backend/otp-backend/server.js`, `firestore.rules`.

- [x] Extend the authenticated change-request endpoint to support rescheduling with allowance and schedule validation.
- [x] Apply the same toggle, allowance, schedule, and snapshot checks to group invite requests.
- [x] Apply snapshotted refund terms during cancellation approval, while preserving the legacy fallback.
- [x] Remove direct customer updates to appointment change fields from Firestore rules.

### Task 4: Verification

- [x] Run focused policy and appointment workflow tests, backend syntax checks, `git diff --check`, and the frontend production build. Firestore rules emulator validation was unavailable because Java is not installed in this environment.
- [x] Review the affected flows for policy/UI consistency and check the diff for whitespace issues.
