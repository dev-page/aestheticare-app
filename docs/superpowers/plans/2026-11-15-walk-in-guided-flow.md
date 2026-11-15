# Walk-In Guided Booking Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the clinic Walk-In Desk a clear, single-page, three-step flow for client selection, appointment scheduling, and booking review/consent/payment, with one canonical navigation entry.

**Architecture:** Keep the existing WalkInDesk component and backend endpoints. Add UI-only step state and client/schedule readiness checks, with a review summary before booking creation. Use `/crm/walk-in` as the canonical booking route, redirect old booking URLs to it, and retain `/crm/pos` as the payment-queue mode of the same page.

**Tech Stack:** Vue 3 Composition API, existing appointment scheduling/pricing helpers, scoped CSS.

**Spec:** The user-approved three-step plan in the conversation: find/register client; schedule; review, consent, and payment with later payment supported through POS.

## Global Constraints

- Preserve backend validation and check booking versus payment permissions at their respective actions.
- The booking route requires client and appointment access; payment collection remains guarded by `payments:create`.
- Keep Client List and Appointment Management visible because they handle client-record maintenance and all appointment operations beyond walk-in intake.
- Keep the booking page and unpaid-payment queue directly reachable from the Walk-In Desk.
- Walk-in bookings remain for one client and on-site consultations only.
- Keep booking-arranger acceptance separate from recipient treatment consent.
- Preserve same-day consultation clearance and full-payment rules.
- Keep existing unpaid appointments accessible from POS.

## Review Focus

- Invalid/missing client email must prevent proceeding to scheduling.
- Incomplete or stale schedule slots must prevent review/booking submission.
- Changing the client or schedule must invalidate any stale signature/policy acceptance.
- Same-day treatment price and schedule summary must show consultation-first handling.
- POS route and the post-booking consent/payment view must remain reachable.

### Task 1: Guided Walk-In Desk

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`

**Interfaces:**
- Consumes existing `clients`, `visits`, `availableSlots`, `serviceFor`, pricing helpers, `createAppointments`, and POS actions.
- Produces local `bookingStep`, client readiness, schedule readiness, and a review-summary model; no backend schema changes.

- [x] Add step state and validation helpers.
- [x] Gate the three booking stages and add visible progress/navigation.
- [x] Add an appointment-by-appointment review summary and clear later-payment guidance.
- [x] Build the frontend and inspect the final diff.

### Task 2: Navigation and route alignment

**Files:**
- Modify: `frontend/src/components/sidebar/clinicSidebarItems.js`
- Modify: `frontend/src/components/sidebar/BaseCollapsibleSidebar.vue`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`

**Interfaces:**
- Consumes the existing sidebar permission filter, router guards, and payment permission checks.
- Produces one canonical Walk-In Desk navigation destination, legacy redirects, and a visible unpaid-payment entry point from the desk.

- [x] Rename and group the sidebar items so the walk-in booking workflow is distinct from client-record maintenance and appointment management.
- [x] Redirect legacy walk-in booking URLs to `/crm/walk-in`.
- [x] Let users with booking permissions reach the desk without payment permission; retain payment permission checks on payment actions and `/crm/pos`.
- [x] Add links between the booking desk, unpaid-payment queue, and appointment management.
