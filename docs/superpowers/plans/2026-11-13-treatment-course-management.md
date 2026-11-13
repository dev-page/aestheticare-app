# Treatment Course Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear single-visit and multi-visit course setup, ordered visit definitions, and matching customer/clinic progress views.

**Architecture:** A shared `treatmentCourse.js` module normalizes, validates, counts, and expands course steps. Listing UI and payloads store ordered course steps; booking snapshots those steps into individual visit definitions. Existing packages without the new field retain legacy expansion, while existing appointment snapshots remain unchanged.

**Tech Stack:** Vue 3, JavaScript ES modules, Firebase Firestore, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-13-treatment-course-management-design.md`

## Global Constraints

- Keep a single visit at exactly one appointment.
- A course has 2–50 visits; each step gap is a whole number of 1–365 days.
- Preserve legacy package booking expansion and current payment, consultation, approval, and scheduling rules.
- Later visits remain clinic-scheduled after the previous visit is resolved.

## Review Focus

- Invalid totals or day gaps are rejected before publishing and booking (shared utility and listing approval tests).
- Legacy packages without ordered steps still expand in their prior sequence (booking resource tests).
- A multi-step package books its first visit from the first step and later sessions use the correct service and gap (booking resource tests).
- Existing multi-visit Service listings are clearly warned and become one visit when edited, without changing already booked plans (listing UI and booking snapshot tests).
- Customer and clinic progress identify the next session even when some prior sessions are forfeited or not yet eligible (view-level computed logic).

---

### Task 1: Shared course model and validation

**Files:** Create `shared/treatmentCourse.js`; create `shared/treatmentCourse.test.js`; modify `backend/otp-backend/listingApproval.js` and its tests.

**Interfaces:** Export `normalizeTreatmentCourseSteps(steps)`, `treatmentCourseVisitCount(steps)`, `validateTreatmentCourseSteps(steps)`, and `buildTreatmentCourseSessions(steps, servicesById)`. Each built session includes service id/name, duration, stage number, stage visit number, and `sessionIntervalDays`.

- [ ] Write tests for valid ordered steps, total visit counts, 1-day minimum, 365-day maximum, 2–50 total visits, and omitted/invalid ids.
- [ ] Run the focused test and confirm the new exports/tests fail.
- [ ] Implement the shared normalization, validation, and session-expansion functions.
- [ ] Enforce exactly one visit for Service listings and validate new-format course steps in listing approval.
- [ ] Run shared-model and listing approval tests.

### Task 2: Course setup, editing, and customer listing detail

**Files:** Modify `frontend/src/components/common/ServiceListingFields.vue`, `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`, `frontend/src/components/common/ServiceDetailsModal.vue`, and `frontend/src/views/customer/CenterPage.vue`.

**Interfaces:** Store steps in `treatmentCourseSteps`; derive `packageServiceIds` as unique step service ids and `sessionCount` as total visits. Legacy package edits initialize ordered steps from existing package/component data.

- [ ] Add form tests/helpers for deriving legacy steps and package pricing from ordered steps.
- [ ] Replace package repeat-cycle setup with an ordered step builder and display the live total, minimum gaps, and course price.
- [ ] Save and edit step data, enforce 2–50 total visits and valid gaps, and convert legacy Service edits to one visit with a visible warning.
- [ ] Show course stages, visit count, minimum gap, and first-visit/later-visit explanation in customer detail and booking summary.
- [ ] Run focused frontend checks/build.

### Task 3: Booking snapshots and later-visit scheduling

**Files:** Modify `backend/otp-backend/bookingResources.js`, `backend/otp-backend/bookingMilestones.js`, related booking resource tests, and `backend/otp-backend/server.js` treatment-session listing enrichment if needed.

**Interfaces:** New-format course bookings use `buildTreatmentCourseSessions`; appointment `treatmentPlan.sessions` is the immutable ordered visit snapshot. Legacy package expansion remains the fallback.

- [ ] Add booking tests for a consultation followed by repeated treatment visits, correct interval metadata, first-visit duration/resources, and legacy package order.
- [ ] Run focused booking tests and confirm the new expectations fail.
- [ ] Expand new-format course steps into the plan snapshot and use a minimum one-day scheduling interval consistently.
- [ ] Preserve stage/service labels when clinic and customer session views load course visits.
- [ ] Run booking workflow and treatment-session tests.

### Task 4: Grouped customer and clinic progress

**Files:** Modify `frontend/src/views/customer/MyAppointments.vue` and `frontend/src/views/admin/owner/clinic/TreatmentSessions.vue`.

**Interfaces:** Both views group sessions by `treatmentPlanAppointmentId` and display completed/total progress, next visit service, status, and earliest eligible date.

- [ ] Add/adjust tests for progress selection, including completed, forfeited, unscheduled, and date-limited next visits.
- [ ] Render grouped plan summaries and service names while retaining per-session schedule and history actions.
- [ ] Run focused frontend checks/build and relevant backend tests.

### Task 5: Verification

**Files:** No new source files.

- [ ] Run all backend `node:test` suites and frontend production build.
- [ ] Review the final diff for compatibility changes and report the evidence and any remaining limitation.
