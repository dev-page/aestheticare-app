# Same-Day Consultation and Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-service, opt-in same-day on-site consultation and provisional treatment booking for customers and walk-ins, with practitioner clearance before treatment consent or payment.

**Architecture:** Add listing configuration, a transactional backend helper and customer endpoint that create two linked appointments, and extend walk-in creation to expand an opted-in treatment into a consultation/treatment pair. Add a practitioner-only clearance action and gate all treatment signing/payment paths until clearance. Update both booking UIs and workflow documentation to match.

**Tech Stack:** Vue 3, Node.js, Express, Firestore transactions, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-12-same-day-consultation-design.md`

## Global Constraints

- Same-day eligibility defaults to off and is configured per treatment service.
- Same-day is limited to the linked on-site consultation at the same branch and with the same practitioner.
- Treatment remains provisional until the assigned practitioner clears it.
- Do not enable this path for group bookings or online consultations.
- Preserve unrelated uncommitted workspace changes.

## Review Focus

- Client attempts to forge a same-day request for an unconfigured service: backend rejects it.
- Linked consultation is online-only, unpublished, in another branch, or mismatched: backend rejects it.
- Consultation and treatment overlap or exceed schedule/resource availability: transaction writes nothing.
- Treatment payment/consent is attempted before clearance: backend rejects it.
- Practitioner declines treatment: provisional treatment is cancelled and its material reservation is released.

---

### Task 1: Service configuration

**Files:** `frontend/src/components/common/ServiceListingFields.vue`, `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`, `backend/otp-backend/server.js`, listing approval tests.

- [ ] Add default-off same-day eligibility and a bounded buffer to create/edit listing forms.
- [ ] Validate the setting against a required linked consultation that offers on-site mode when saving/publishing.
- [ ] Add tests for disabled defaults and invalid service/consultation combinations.

### Task 2: Transactional customer booking pair

**Files:** create `backend/otp-backend/sameDayBookings.js` and its tests; modify `backend/otp-backend/bookingResources.js` and `backend/otp-backend/server.js`.

- [ ] Test service/consultation pairing, sequential times, and transactional failure without partial writes.
- [ ] Add an internal-only prerequisite bypass used after the helper validates the exact linked consultation.
- [ ] Register an authenticated customer endpoint that creates two linked appointment records, locks resources, and charges only the consultation at first.
- [ ] Reject groups, online consultations, unrelated same-date bookings, and invalid branch/practitioner schedules.

### Task 3: Practitioner clearance and lifecycle gates

**Files:** create `backend/otp-backend/sameDayTreatmentClearance.js` and tests; modify approval, signing, payment, walk-in POS, and appointment start paths in backend workflows.

- [ ] Test assigned-practitioner authorization and approve/decline outcomes.
- [ ] Approve/reject both linked booking requests together.
- [ ] Gate treatment agreement signing, payment checkout/recording, and treatment start until clearance.
- [ ] Declining treatment cancels its provisional record and releases its resources.

### Task 4: Customer and clinic UI

**Files:** `frontend/src/views/customer/CenterPage.vue`, `frontend/src/views/customer/MyAppointments.vue`, `frontend/src/views/admin/owner/crm/WalkInDesk.vue`, `frontend/src/views/admin/owner/clinic/PractitionerAppointments.vue`.

- [ ] Show the same-day request only for eligible services missing consultation clearance; show the consultation-first schedule and buffer.
- [ ] Submit through the paired-booking endpoint and explain that treatment approval, consent, and payment are conditional.
- [ ] Add the walk-in option and show consultation payment separately from the provisional treatment fee.
- [ ] Add practitioner approve/decline controls after the on-site consultation is completed.
- [ ] Show pending/declined states to customers and prevent premature signing/payment controls.

### Task 5: Documentation and verification

**Files:** `docs/booking-workflow.md` and relevant tests/build checks.

- [ ] Document the online and walk-in same-day sequence and limitations.
- [ ] Run focused backend tests and the frontend production build; inspect the final diff for unintended changes.
