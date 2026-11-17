# Appointment Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify walk-in and appointment details screens, make client profiles viewable on mobile, and support direct clinic-initiated rescheduling while keeping customer bookings automatic.

**Architecture:** Reuse the shared body-level `Modal` component for the Client List and existing appointment dialogs. Use the trusted practitioner availability endpoint to populate the clinic reschedule form, then validate and save the selected appointment transactionally in the backend before notifying the customer.

**Tech Stack:** Vue 3, Firebase Firestore, Express, existing appointment availability and booking-resource helpers.

**Spec:** `docs/appointment-operations-design.md`

## Global Constraints

- Do not create or run automated tests unless the user asks to test or verify implementation.
- Keep normal customer bookings automatically approved only after the existing availability and practitioner checks pass.
- Keep customer cancellation/reschedule requests in the clinic review queue and remove new-booking request categorization from that queue.
- Keep cancellation/refund, contract, payment, branch-scope, and staff-permission safeguards intact.
- Clinic rescheduling must not consume the customer's reschedule allowance.
- Preserve existing uncommitted walk-in receipt, landing-page, and business-owner documentation changes.

## Review Focus

- Branch scope and `appointments:update` authorization are enforced by the backend clinic-reschedule endpoint.
- A slot occupied by the selected appointment itself remains selectable, while every other conflicting booking stays blocked.
- Approved leave, practitioner eligibility, clinic hours, service resources, and overlapping appointments are rechecked transactionally before saving.
- A clinic-initiated move preserves paid amounts, pricing snapshots, and signed contract terms while refreshing a service code when one exists.
- Customer notification failures do not roll back a successfully committed schedule change and are returned as warnings.

---

### Task 1: Remove Walk-In Header Links and Repair Client Details Dialog

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`
- Modify: `frontend/src/views/admin/owner/crm/ReceptionistClientList.vue`

**Interfaces:**
- Consumes: shared `Modal` component props/slots and existing client record/edit state.
- Produces: responsive, viewport-bounded client profile dialog with the existing edit action and history.

- [ ] Remove the Walk-In Desk header links labeled “Unpaid walk-in payments” and “View appointments”; retain the POS page’s “New walk-in booking” link.
- [ ] Replace the nested custom client overlay with the shared body-level `Modal`; keep selected-client state, read-only fields, branch-scoped appointment history, and permission-gated editing.
- [ ] Make the dialog body scroll within the viewport and stack client details/history into one column on narrow screens.
- [ ] Inspect the changed template for balanced slots/sections and confirm the modal close/edit handlers still reference the same state.

### Task 2: Add an Authorized Clinic Reschedule Endpoint and Simplify the Review Queue

**Files:**
- Modify: `backend/otp-backend/server.js`
- Modify: `frontend/src/views/admin/owner/crm/AppointmentRequestApprovals.vue`

**Interfaces:**
- Produces: `POST /appointments/:id/clinic-reschedule` accepting `{ date, time, practitionerId, reason }` and returning the changed schedule plus notification warnings.
- Keeps: `POST /appointments/:id/request-change` and `/appointments/:id/approve-request` unchanged for customer cancellation/reschedule requests.

- [ ] Add an authenticated endpoint that requires `appointments:update` for the appointment branch, rejects closed/started/checked-in appointments, and validates date, time, practitioner, and reason.
- [ ] Within a Firestore transaction, re-read the appointment, validate branch and practitioner scope, approved leave, slot/resource availability, and conflicts using `prepareBooking`; update schedule fields without overwriting its payment/pricing/contract data or incrementing customer reschedule allowance; write an audit record.
- [ ] Refresh the service code when present and send customer in-app/email notices after commit. Return delivery failures as warnings without undoing the reschedule.
- [ ] Rename the embedded review queue to appointment change requests, keep only cancellation/reschedule filters and counts, and remove “New Booking Requests” presentation while leaving historical records accessible in Appointment Records.
- [ ] Run `node --check backend/otp-backend/server.js` and inspect route authorization, transaction writes, audit fields, and notification failures.

### Task 3: Replace the Appointment Recipient Table and Add a Reschedule Form

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/AppointmentRecords.vue`

**Interfaces:**
- Consumes: Task 2's `POST /appointments/:id/clinic-reschedule`; the existing authenticated practitioner-availability endpoint; `getAppointmentSlots` from `frontend/src/utils/appointmentSlots.js`.
- Preserves: Contract, check-in, online consultation, group/treatment links, and appointment summary actions.

- [ ] Replace the fixed 1250px recipient table with responsive per-recipient cards that separate contact, service, practitioner/team, schedule, session, status, and action details.
- [ ] Add a permission-gated clinic “Reschedule” action for eligible future recipient appointments.
- [ ] Load practitioner schedules and busy windows for the appointment's branch; show only practitioners not on approved leave for the selected date and offer only locally available time slots, excluding the appointment being edited from local conflicts.
- [ ] Submit the selected practitioner/date/time/reason to the clinic-reschedule endpoint; show backend validation errors, update the row after success, and surface notification warnings.
- [ ] Ensure both dialogs fit within the viewport and their content scrolls without hiding the close/action controls.
- [ ] Run the frontend production build and inspect the final diff for responsive layout, permission gating, and preservation of the existing appointment actions.
