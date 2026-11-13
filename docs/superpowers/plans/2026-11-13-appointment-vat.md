# Appointment VAT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fixed 12% VAT option for eligible appointment listings and show the saved price breakdown in online and walk-in payment flows.

**Architecture:** A shared helper calculates centavo amounts. The booking server reads the clinic's VAT setting and listing classification, stores an immutable pricing snapshot, and keeps the existing `amount`/`totalAmount` fields compatible. Customer, clinic, transaction, and receipt views display the saved snapshot; frontend estimates use the helper but do not set the payable amount.

**Tech Stack:** Vue 3, Firebase Firestore, Node.js backend, shared ES modules.

**Spec:** `docs/superpowers/specs/2026-11-13-appointment-vat-design.md`

## Global Constraints

- VAT rate is fixed at 1,200 basis points.
- Missing legacy VAT settings mean no VAT; historical appointments are not repriced.
- Online and walk-in payments must charge the persisted server total.
- The 10% platform commission stays internal and is calculated on the pre-VAT subtotal for VAT-applicable appointments.
- Do not change pharmacy, procurement, subscriptions, or cancellation/refund policy calculations.
- Do not add dependencies or run tests; use code inspection and build/syntax checks only.

## Review Focus

- Inclusive price arithmetic must extract VAT without increasing listed price.
- Exclusive price arithmetic must add VAT exactly once.
- Missing policy/listing metadata must preserve legacy no-VAT behavior.
- Group/order aggregates must sum child snapshots rather than tax their parent total.
- Customer and reception displays must use the same saved total and avoid exposing internal commission.

---

### Task 1: Shared appointment pricing helper

**Files:**
- Create: `shared/appointmentPricing.js`

**Interfaces:**
- Produces: `buildAppointmentPricing({ listedPrice, vatApplicable, vatRegistered, vatPriceMode })`, returning integer-centavo `listedPrice`, `subtotal`, `vatAmount`, `total`, fixed `vatRateBasisPoints`, applicability, and mode.

- [ ] Implement centavo rounding for VAT-inclusive, VAT-exclusive, and non-applicable prices.
- [ ] Confirm calculations by running a small Node invocation for the spec examples (not a test suite).

### Task 2: Clinic tax setting and listing controls

**Files:**
- Modify: `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`
- Modify: `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`
- Modify: `frontend/src/components/common/ServiceListingFields.vue`
- Modify: `backend/otp-backend/listingApproval.js`
- Modify: `frontend/src/views/admin/owner/finance/ListingApprovals.vue`

**Interfaces:**
- Clinic policy persists `vatRegistered` at `clinicPolicies/{ownerId}`.
- Service, consultation, and package listings persist `vatApplicable` and `vatPriceMode`.

- [ ] Add a clinic-level VAT-registration switch, default false, through existing policy loading and saving.
- [ ] Load the owner's tax setting in listing management and pass it into create/edit fields.
- [ ] Add a listing-level VAT switch and inclusive/exclusive choice; disable the switch until registration is enabled.
- [ ] Persist these listing fields on create and edit; default old listings to non-applicable.
- [ ] Treat VAT treatment as a financial term and display it in the Finance review.
- [ ] Preserve the existing package-price-preview correction.

### Task 3: Server-authoritative booking snapshots

**Files:**
- Modify: `backend/otp-backend/bookingResources.js`
- Modify: `backend/otp-backend/walkInBookings.js`
- Modify: `backend/otp-backend/server.js` (group/order aggregation only if required)

**Interfaces:**
- Every newly prepared appointment carries `pricingSnapshot` with PHP listed amount, subtotal, VAT applicability/rate/mode/amount, total, and schema version.
- `amount` and `totalAmount` remain equal to the saved gross total.

- [ ] Read owner policy using the branch owner ID; reject VAT-applicable listings when clinic VAT registration is off.
- [ ] Use the shared helper for normal, package, same-day, and walk-in booking preparation.
- [ ] Calculate commission on the pre-VAT subtotal and persist clinic net separately.
- [ ] Aggregate group/order parent snapshots from child snapshots without recalculating tax.
- [ ] Keep old appointments and non-VAT listings at their current amount.

### Task 4: Customer estimate and payment breakdown

**Files:**
- Modify: `frontend/src/views/customer/CenterPage.vue`
- Modify: `frontend/src/views/customer/MyAppointments.vue`
- Modify: `backend/otp-backend/server.js` (online payment transaction snapshot)

- [ ] Show subtotal, VAT or “No VAT”, and total in the booking estimate, including the same-day consultation amount due.
- [ ] Remove platform commission and clinic-net details from customer-facing booking copy.
- [ ] Show saved subtotal, VAT, total, paid-to-date, and balance in the payment panel.
- [ ] Copy appointment pricing snapshot into each online service-payment transaction.

### Task 5: Reception POS and receipt breakdown

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`
- Modify: `backend/otp-backend/walkInWorkflow.js`

- [ ] Show snapshot subtotal, VAT or “No VAT”, and total on the walk-in payment card.
- [ ] Persist the pricing snapshot on walk-in receipt transactions.
- [ ] Print the same breakdown while keeping cash tender and change based on the persisted total.

### Task 6: Review and verification

**Files:** All files above.

- [ ] Review every touched diff for compatibility with current booking and payment paths.
- [ ] Run `git diff --check` on touched files.
- [ ] Run the existing frontend production build and Node syntax checks for modified backend modules; do not run tests.
