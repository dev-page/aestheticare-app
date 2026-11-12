# Unified Appointment Booking Implementation Plan

> **For agentic workers:** Execute inline with test-first changes. Keep the existing customer and walk-in intake routes, and share the existing appointment lifecycle.

**Goal:** Make online customer requests and clinic walk-ins follow clear, secure appointment lifecycles, with walk-in treatment consent completed before POS payment.

**Architecture:** Online requests retain clinic approval, customer agreement signing, and customer checkout. Walk-ins retain staff scheduling and separate booking-arranger acceptance, while the recipient signs each treatment agreement before a staff member records payment. The backend remains authoritative for state transitions and permissions.

**Tech Stack:** Vue 3, Express, Firestore transactions, Node.js built-in test runner.

**Spec:** User-approved booking-flow recommendation in the conversation; align `docs/booking-workflow.md` with the resulting implementation.

## Global Constraints

- Preserve separate identities and signatures for the booking arranger and treatment recipient.
- Keep customer booking requests uncharged until clinic approval where required, agreement signing, and checkout.
- Keep payment amounts, agreement signatures, and permission checks authoritative on the backend.
- Preserve legacy walk-in payment records without retroactively requiring new workflow steps.

## Review Focus

- Unpaid walk-in treatment consent must not issue a service code or email before payment.
- Card/GCash checkout must not start before the treatment agreement is signed.
- Appointment creation, recipient consent, and POS payment require their existing distinct permissions.
- A friend arranging a booking must not sign on behalf of the recipient.
- Online booking copy must describe a request and not imply immediate confirmation or charge.

---

### Task 1: Enforce walk-in consent-before-payment

**Files:**
- Modify: `backend/otp-backend/bookingMilestones.js`
- Modify: `backend/otp-backend/walkInWorkflow.js`
- Test: `backend/otp-backend/walkInWorkflow.test.js`

**Interfaces:** Reuse `/appointments/:id/contract/sign` and `/appointments/:id/walk-in-payment`; no new endpoint.

- [x] Add failing tests for signing while unpaid, blocking payment before consent (including checkout methods), and code issuance only after payment.
- [x] Run the walk-in workflow test and confirm it fails for the intended sequence.
- [x] Implement the minimal backend transition changes.
- [x] Re-run walk-in workflow tests.
- [x] Add a permission-checked POS queue so unpaid walk-ins can be recovered after a reload; test that private fields are omitted.

### Task 2: Align the walk-in UI and permissions

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`
- Modify: `frontend/src/components/BookingContractModal.vue`
- Modify: `frontend/src/views/admin/owner/crm/AppointmentRecords.vue`
- Modify: `frontend/src/router/index.js`

**Interfaces:** Use existing clinic permissions `clients:view`, `appointments:create`, `clients:create`, and `payments:create`.

- [x] Put recipient consent before the payment controls and gate cash collection until signed.
- [x] Add a permission-checked POS queue view to resume unpaid walk-ins after leaving the booking page.
- [x] Keep the optional client registration control permission-aware.
- [x] Make the contract modal and appointment record action allow authorized staff to sign new unpaid walk-ins.
- [x] Make the Walk-In Desk routes require the capabilities needed for client lookup, scheduling, check-in, and payment; update the receptionist permission preset.
- [x] Build the frontend.

### Task 3: Clarify customer self-service language and workflow docs

**Files:**
- Modify: `frontend/src/views/customer/CenterPage.vue`
- Modify: `frontend/src/views/admin/owner/crm/AppointmentManagement.vue`
- Modify: `docs/booking-workflow.md`

- [x] Label self-service submission as a booking request and the clinic queue as customer booking requests.
- [x] Document the two intake paths, their shared lifecycle, separate consent roles, and payment ordering.
- [x] Run the full project test suite, frontend build, workflow checks, and diff whitespace check.
