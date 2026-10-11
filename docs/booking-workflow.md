# Booking, consultation, and supplier workflows

Deploy the frontend, OTP backend, Firestore rules, and Storage rules together. Changes apply to new workflow-version-2 appointments. Existing bookings are not bulk migrated.

## Individual services and packages

Each appointment contains one service for one customer. A customer cannot book another service on the same date, including at another branch. Multiple selections use separate dates and can be submitted atomically through one shared checkout. The booking order is a payment container; its children are the actual service appointments. Shared orders and group bookings require full payment.

Packages expand into individual visits in the package component order, repeating component sessions and package cycles. Only the first visit is booked initially. The package price is charged once, and later visit appointments are prepaid. Later visits reserve their own materials and equipment.

Clinic prices, contract terms, session definitions, practitioner eligibility, published schedules, approved leave, stock, consultation clearance, and conflicts are validated on the backend. Consumable availability is checked across the entire shared submission. Branch and customer-day transaction locks protect concurrent reservations.

Paid clinics review the shared request and its individual appointments together. Free-plan service bookings become payable directly because that tier has no clinic approval queue.

## On-site appointment stages

1. Clinic approves the booking, unless the clinic uses direct free-plan booking.
2. Customer signs the treatment agreement and pays the required amount. Signing and payment are both required before check-in.
3. The individual six-digit code is delivered by email and appears in the customer's appointment or private attendee page.
4. Reception verifies the code and marks the customer **Checked in**. Verification opens 30 minutes before the start and expires at the end of the appointment window.
5. If a code is unavailable, authorized reception or the assigned practitioner records how the attendee's identity was verified. This is audited.
6. The assigned practitioner sees checked-in customers first in **Practitioner Queue**, starts the service, and consumes its reserved materials once.
7. The practitioner records treatment notes and aftercare, then finishes the service.
8. The customer confirms receipt. A remaining installment balance becomes **Balance Due**; full settlement produces **Completed**.

A code is scoped to one appointment, cannot check in another attendee, and cannot be reused. Customers cannot check themselves in. Reception cannot start or finish someone else's assigned service.

## Groups

The organizer pays, and each attendee chooses one service. Guests can choose different services. Initial slots are consecutive with the selected practitioner; clinic staff can assign each attendee another eligible practitioner and available slot independently.

Every attendee, including an organizer receiving a service, gets a private invitation email. The invitation opens only that attendee's consent, code, appointment status, completion confirmation, schedule requests, and treatment sessions. Guests do not need customer accounts. Keep invitation links private.

Approval and payment cover the group. Consent, reception check-in, service execution, completion, and change requests remain individual. A cancellation affects the attendee's allocated paid amount under clinic policy; approved refunds use the organizer's original payment. Code delivery uses the backend's existing Postmark configuration.

## Later treatment sessions

The clinic proposes each next session after the preceding one is completed or forfeited. The service's minimum interval and the one-service-per-day rule apply. The treatment plan must be fully paid before later visits are proposed.

The customer confirms the proposed schedule or requests a different date/time. Clinic approval checks availability again. Every confirmed visit gets its own appointment and fresh check-in code. Group guests can use their private invitation for these actions.

Session progress is updated once when care is confirmed, even if the first visit still has a balance due. No-show recording requires an ended appointment window and rejects checked-in or active customers. Clinic policy determines whether a missed visit is eligible for rescheduling or forfeited.

## Online consultations

Consultations remain individual; group consultation booking is disabled. Authenticated customer and assigned practitioner enter the application's waiting room before the practitioner starts a paid, signed consultation with a system meeting link.

The customer may record the end of their participation. The practitioner ends the consultation and records notes. The scheduled-window job closes elapsed application records: attended consultations await customer confirmation; absent or incomplete consultations are not automatically completed. Short consultations and timer closures missing notes are flagged for clinic review.

**Google Meet limitation:** application waiting-room entry and end actions do not prove presence inside Google Meet and do not disconnect an external Meet call. Duration records support review; they cannot guarantee fraud prevention. Customer confirmation remains required. The existing authenticated online-consultation cron endpoint uses the same timeout logic; configure CRON_SECRET for hosted execution.

**Vercel Hobby scheduling:** `vercel.json` schedules reminders and consultation cleanup once daily so deployment meets Hobby cron limits. Daily consultation cleanup is a fallback, not timely session closure. For minute-by-minute timeout processing, an external scheduler must call `/api/cron/online-consultation-timeouts` with `Authorization: Bearer <CRON_SECRET>`, or the backend must run continuously outside Vercel with its existing interval. Vercel serverless execution cannot guarantee that interval runs between requests. An external scheduler is not configured by this repository change.

## Supplier verification

Suppliers verify their email, then submit business identity/contact information and registration, permit/tax, and representative authorization documents. An optional distribution document can also be submitted.

System-admin **Supplier Verification** supports approval, revision requests, rejection, and suspension, with reasons and review history. Documents remain private; authorized viewers receive short-lived download links. Status changes synchronize linked clinic supplier records.

Only verified suppliers can use the supply portal, publish catalogues, or receive new procurement requests. Existing suppliers must submit documents and be reviewed; they are not automatically considered verified. Review is performed by authorized admins, not an automatic claim that a business is legitimate.

## Verification and release

Run `npm test`, `npm run build`, and `node scripts/check-page-skeletons.mjs`. The tests use mocked Firebase and payment-provider responses; they cover appointment ordering, authorization, resource reservations, atomic batches, package expansion, group service selection, supplier decisions/enforcement, consultation timeout handling, and session progress.

Compile-check Firestore rules with `node backend/otp-backend/scripts/check-workflow-rules.cjs` using a signed-in Firebase CLI account. This does not deploy rules.

Before release, exercise individual, batch, group, package, consultation, and supplier flows with separate role accounts in staging. Confirm Postmark invitation/code delivery, PayMongo test-mode shared checkout and attendee refunds, private document links, customer session confirmation, and the hosted timeout job. Live provider behavior and signed-in browser flows are not proven by local tests.
