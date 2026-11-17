# Booking, consultation, and supplier workflows

Deploy the frontend, OTP backend, Firestore rules, and Storage rules together. Changes apply to new workflow-version-2 appointments. Existing bookings are not bulk migrated.

## Individual services and packages

Each appointment contains one service for one customer. A customer cannot book another service on the same date, including at another branch. Multiple selections use separate dates and can be submitted atomically through one shared checkout. The booking order is a payment container; its children are the actual service appointments. The system holds their slots for 15 minutes while the customer signs each appointment agreement and completes the shared checkout. Verified payment confirms the order. Shared orders and group bookings require full payment.

Packages expand into individual visits in the package component order, repeating component sessions and package cycles. Only the first visit is booked initially. The package price is charged once, and later visit appointments are prepaid. Later visits reserve their own materials and equipment.

Clinic prices, contract terms, session definitions, practitioner eligibility, clinic opening hours, published practitioner schedules, approved leave, stock, consultation clearance, and conflicts are validated on the backend. The complete appointment duration must fit within both clinic hours and the practitioner's available shift. Consumable availability is checked across the entire shared submission. Branch and customer-day transaction locks protect concurrent reservations.

Online service bookings are payable directly across clinic plans; they do not wait in a clinic approval queue. After payment verification, the customer and clinic receive confirmation notifications. An unpaid hold expires and releases its slots. Clinic review remains available for consultation clearances, clinical decisions, cancellations, rescheduling, and other workflows that need staff judgment.

## On-site appointment stages

1. Customer chooses a time that fits clinic opening hours and practitioner availability; the backend validates the full duration and briefly holds the slot.
2. Customer reviews and signs the treatment agreement in **My Appointments**.
3. Customer completes the required payment before the 15-minute hold expires. The appointment is confirmed only after the backend verifies payment and notifies the customer and clinic. If checkout expires first, the slot is released.
4. Signing creates and emails the individual six-digit code; the appointment or private attendee page displays it after the required initial payment is received.
5. Both a signed agreement and required payment are needed before on-site check-in or online consultation access.
6. Reception verifies the code and marks the customer **Checked in**. Verification opens 30 minutes before the start and expires at the end of the appointment window.
7. If a code is unavailable, authorized reception or the assigned practitioner records how the attendee's identity was verified. This is audited.
8. The assigned practitioner sees checked-in customers first in **Practitioner Queue**, starts the service, and consumes its reserved materials once.
9. The practitioner records treatment notes and aftercare, then finishes the service.
10. The customer confirms receipt. A remaining installment balance becomes **Balance Due**; full settlement produces **Completed**.

## Same-day on-site consultation and treatment

Same-day booking is an explicit per-service option. The service must require a consultation and link to a published consultation on the same branch that supports on-site appointments. The clinic sets a 0–60 minute buffer on the service listing. Online consultations and group bookings do not use this flow.

The customer selects **Request consultation and treatment on the same day** when the platform cannot find a qualifying prior consultation. The selected start time is the on-site consultation start. Availability reserves one continuous block for the consultation, configured buffer, and treatment with the same practitioner, and the whole block must fit within clinic hours and practitioner availability. The treatment appointment has its own record and a provisional status.

The customer signs and pays for the consultation within its 15-minute slot hold. The assigned practitioner completes the consultation, then explicitly chooses whether treatment may proceed that day. Only after that clinical decision does the treatment agreement become available and a fresh 15-minute hold start for the treatment fee. If not cleared, the provisional treatment appointment is cancelled and its time and materials are released; no treatment fee is collected. The consultation remains a separate appointment and payment.

For walk-ins, reception can select the same-day option while booking the client. Reception collects only the consultation payment first. The treatment does not appear in the POS payment queue until the assigned practitioner clears it. The same signed booking-arranger terms and recipient-specific treatment agreement rules still apply.

A code is scoped to one appointment, cannot check in another attendee, and cannot be reused. Customers cannot check themselves in. Reception cannot start or finish someone else's assigned service.

After a regular booked service is finished, the appointment remains **Awaiting Customer Confirmation** until the customer selects **Confirm I received this service** in My Appointments. The daily reminder job sends one in-app reminder after confirmation has been pending for at least 24 hours. Silence never marks the appointment complete. Walk-in appointments are marked complete by the practitioner because the customer may not have an account for this workflow. Feedback is offered separately after completion and is optional.

## Groups

The organizer pays, and each attendee chooses one service. Guests can choose different services. Initial slots are consecutive with the selected practitioner; clinic staff can assign each attendee another eligible practitioner and available slot independently. The organizer has 15 minutes to sign and pay once for the whole group; verified payment confirms the group appointments. Attendee consent is separate from payment, and every attendee must complete their own consent before check-in.

Every attendee, including an organizer receiving a service, gets a private invitation email. The invitation opens only that attendee's consent, code, appointment status, completion confirmation, schedule requests, and treatment sessions. Guests do not need customer accounts. An existing account is not currently linked to a guest appointment; the recipient uses the private invitation. Keep invitation links private.

One payment covers the group. Consent, reception check-in, service execution, completion, and change requests remain individual. Group booking is limited to standalone services that do not require a prior consultation; the system cannot currently verify consultation history for each invited guest. Book consultation-required services individually so the clinic can verify each recipient's eligibility. A cancellation affects the attendee's allocated paid amount under clinic policy; approved refunds use the organizer's original payment. Code delivery uses the backend's existing Postmark configuration.

## Later treatment sessions

The clinic proposes each next session after the preceding one is completed or forfeited. The service's minimum interval and the one-service-per-day rule apply. The treatment plan must be fully paid before later visits are proposed.

The customer confirms the proposed schedule or requests a different date/time. Clinic approval checks availability again. Every confirmed visit gets its own appointment and fresh check-in code. Group guests can use their private invitation for these actions.

Session progress is updated once when care is confirmed, even if the first visit still has a balance due. No-show recording requires an ended appointment window and rejects checked-in or active customers. Clinic policy determines whether a missed visit is eligible for rescheduling or forfeited.

## Online consultations

Consultations remain individual; group consultation booking is disabled. The customer chooses an available time, after which the backend briefly holds it. The customer signs the agreement and completes payment in **My Appointments** within 15 minutes. Verified payment confirms the consultation; an unpaid hold expires and releases the time. The in-app appointment actions then provide the saved check-in code, payment status, and contract status.

The customer checks in from the appointment action menu using the saved code (or enters the emailed code). This verifies arrival and places the customer in the virtual waiting room; it does not create a Meet room. A clinic user with branch access and `consultations:create` opens Google Meet, creates a room, and attaches its link to the appointment. AesthetiCare notifies the customer in-app and by email. The assigned practitioner joins the same room and starts the timer after both participants enter the app waiting room and identity/readiness are attested. The Meet host ends the call through Google's host controls before the practitioner records completion. See [Google Meet setup](google-meet-setup.md) for the manual workflow.

The customer may record the end of their participation. The practitioner ends the consultation and records notes. The scheduled-window job closes elapsed application records: attended consultations await customer confirmation; absent or incomplete consultations are not automatically completed. The customer selects **Confirm I received this consultation** from the online appointment row, or reports a problem in Consultation controls. Short consultations and timer closures missing notes are flagged for clinic review. Feedback remains optional after completion.

**Google Meet limitation:** application waiting-room entry does not prove presence inside Google Meet. AesthetiCare cannot disconnect a manually created Meet call, so the host must end it using Google Meet controls. Duration records support review; they cannot guarantee fraud prevention. Customer confirmation remains required. The existing authenticated online-consultation cron endpoint uses the same timeout logic; configure CRON_SECRET for hosted execution.

**Vercel Hobby scheduling:** `vercel.json` schedules reminders and consultation cleanup once daily so deployment meets Hobby cron limits. Daily consultation cleanup is a fallback, not timely session closure. For minute-by-minute timeout processing, an external scheduler must call `/api/cron/online-consultation-timeouts` with `Authorization: Bearer <CRON_SECRET>`, or the backend must run continuously outside Vercel with its existing interval. Vercel serverless execution cannot guarantee that interval runs between requests. An external scheduler is not configured by this repository change.

Appointment payment holds expose `/api/cron/appointment-payment-holds` with the same `CRON_SECRET` authorization. Availability, booking, walk-in, and checkout requests also run expiry cleanup on demand, so expired slots are cleared when a fresh booking check occurs. Configure an external scheduler if holds must be released promptly even when no users are making requests; Vercel's daily Hobby cron schedule is not frequent enough for a 15-minute payment window.

## Supplier directory records

Clinic staff create and manage supplier business contacts for Procurement. Any registration, permit, tax, or FDA LTO fields are clinic-maintained supplier records and do not create a supplier account or portal login. Supplier-role accounts are not supported by the clinic platform.

## Verification and release

### Walk-in scheduling

Online customers choose an offering, delivery mode, practitioner, and available slot. The system validates clinic hours and practitioner availability, then holds the appointment for 15 minutes while the customer signs and pays in My Appointments. Verified payment confirms the booking and notifies the clinic; an unpaid slot is released. Walk-ins are scheduled by clinic staff and are approved at creation; the booking arranger accepts booking/payment terms, the treatment recipient signs the separate treatment agreement, and staff records payment at POS. Both paths require signed treatment consent and the required payment before service access.

Walk-In Desk supports one care recipient and up to twenty service appointments. Staff can select an existing branch client (including customers found through prior appointment history) or enter a new recipient inline. New recipient details are stored only when the booking succeeds. An existing verified customer account is linked only when its email and full name match; a later online booking links a single exact matching walk-in profile, while ambiguous matches stay separate. Group booking is unavailable for walk-ins; reception creates separate bookings for other clients. Each appointment has its own visible availability calendar, lead practitioner, time, and notes. The client must use different dates for additional services, except that an explicitly configured same-day consultation and treatment pair occupies one service row and creates two linked appointments. Supporting staff are assigned through **Treatment team** in Appointment Management before treatment starts, according to the service's staffing requirements.

For a friend arranging a booking, select the treatment recipient from the client list or enter their details inline, then enable **Booking for someone else**. Record the arranger's name, contact number, and optional email. The arranger draws their own signature to accept booking/payment terms; the server snapshots enabled branch financial policies, the priced appointments, signer identity, and staff witness. Clinical additional terms and service-specific treatment text are excluded from this booking agreement. New bookings require this acceptance before payment. Existing walk-ins remain payable without retroactive booking acceptance.

Booking acceptance does not sign the recipient's treatment agreement. Before payment, the recipient reviews and signs each appointment's treatment agreement from Walk-In Desk or **Appointment Management → View Details → Contract**, with authorized staff witnessing the signature. The arranger cannot sign this agreement for them. POS payment stays locked until this signature is recorded; payment creates the receipt and service code and sends it to the recipient. Check-in remains blocked until the appointment is paid and the treatment agreement is signed.

The Walk-In Desk requires `clients:view`, `appointments:view`, `appointments:create`, `appointments:update`, and `payments:create` so staff can select clients, schedule, manage/check in appointments, and take payment without running into a later permission block. New recipient details are entered within Step 1 and saved as a clinic client profile only as part of a successful, transactional booking; no separate `clients:create` permission or registration step is required. Client List records are derived from appointment history, and clinic edits are stored in the branch directory without changing customer login profiles or historical appointment snapshots. Same-day treatment clearance is limited to the practitioner assigned to both linked appointments. The separate `/crm/pos` queue requires only `appointments:view` and `payments:create`; POS users do not need client browsing or appointment-creation access. The receptionist permission preset includes the required booking, appointment-update, and payment permissions; clinic owners retain their existing access.

`POST /walk-in/bookings` validates the entire submission before writing any appointments. Prices, recipient contacts, consultation prerequisites, resources, and saved clinic contracts come from server records. Same-day walk-ins create a linked on-site consultation plus a treatment appointment that cannot be signed, checked in, started, or paid before practitioner clearance. A submission ID makes retries return the original appointments. `GET /walk-in/availability` requires appointment-creation access and returns busy windows and applicable policies without service keys, signatures, clinical notes, or compensation details.

Payments remain individual: after the recipient signs, recording cash payment creates that appointment's receipt and service code and sends it to the client's email. A multiple-appointment booking stays partially paid until all appointments are paid. The recipient signs each agreement separately; signing does not create or send a service code. Unpaid walk-ins remain available in the POS queue at `/crm/pos` after staff leave or reload the booking screen. POS staff can record cash or start a Card/GCash checkout from the appointment. After the provider returns to the POS, staff explicitly verify the checkout; only the backend's provider confirmation records the payment and issues the service code. Both checkout creation and payment recording require the booking terms and recipient treatment agreement to be signed; staff cannot manually mark an electronic payment as paid.

Deploy the updated backend with the frontend. In local development, restart the backend to register the same-day and Walk-In endpoints. Before release, verify the calendar, multiple services, same-day consultation clearance (both clear and decline outcomes), individual signatures, printed receipts, and actual Postmark code delivery using clinic staff accounts.

Run `npm test`, `npm run build`, and `node scripts/check-page-skeletons.mjs`. The tests use mocked Firebase and payment-provider responses; they cover appointment ordering, authorization, resource reservations, atomic batches, package expansion, group service selection, supplier decisions/enforcement, consultation timeout handling, and session progress.

Compile-check Firestore rules with `node backend/otp-backend/scripts/check-workflow-rules.cjs` using a signed-in Firebase CLI account. This does not deploy rules.

Before release, exercise individual, batch, group, package, consultation, and supplier flows with separate role accounts in staging. Confirm Postmark invitation/code delivery, PayMongo test-mode shared checkout and attendee refunds, private document links, customer session confirmation, and the hosted timeout job. Live provider behavior and signed-in browser flows are not proven by local tests.
