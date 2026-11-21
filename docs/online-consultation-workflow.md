# Online consultation workflow and deployment

Implemented locally on 2026-10-12. This supersedes the earlier fixed scheduled-end
policy in the initial Google Meet setup and appointment audit.

## Booking and attendance

Online consultations remain individual. Clinic approval, signed contract, and
required payment precede access. The assigned practitioner connects their Google
account once, then generates a separate Meet room from the Online Consultations
appointment table. AesthetiCare saves the link, records who generated it in the
Meet link history table, and notifies the customer. See `google-meet-setup.md`
for Google OAuth configuration and the clinic steps.

Customers submit the booking request without paying at booking time. After any
required clinic approval, they review and sign the agreement, then complete the required
payment in **My Appointments**. Signing generates and emails the consultation
code. After the initial payment is received, the appointment menu also shows
the saved code and allows direct in-app check-in; entering the emailed code
remains available as a fallback. Unpaid appointments remain visible in the
payment list, and the contract remains accessible from the online appointment.

Service Listings contains arrival grace and buffer fields for online consultation
posts. Defaults are ten minutes and fifteen minutes. Grace is constrained to
0-30 minutes; the buffer is at least grace plus five minutes. Booking preparation
reserves duration plus buffer, validates availability/resources, and snapshots
the timing policy and contract terms. Service cards disclose the timing rules
before booking; the actual agreement includes a timing section before payment.

The customer submits their saved in-app or emailed code beginning thirty minutes
before the schedule and before arrival grace expires. Code submission verifies
check-in and places the customer in the virtual waiting room. The assigned
practitioner generates the room from the appointment table; AesthetiCare stores
the URL and sends the customer an in-app notification and an email. The customer
sees the link only after entering their service code. The waiting room opens five
minutes before the schedule.

After both app waiting-room entries, the practitioner must explicitly attest that
the recipient is present in Meet, identity has been checked, and both are ready.
Only then does Start begin the full booked duration. The backend checks other
appointments for every team member before accepting a delayed start. Existing
appointments with insufficient space must be reviewed/rescheduled rather than
quietly shortened. Attendance is still a staff attestation; these timestamps are
not Google attendance telemetry.

## Interruptions and ending

Customer/practitioner controls can record connection interruptions. Rejoining
remains available while the consultation is active. The practitioner confirms
reconnection; lost time can be restored up to five minutes total, within the
reserved slot. Further lost time remains flagged for independent clinic review.
Interruptions and extension amounts are recorded. Reporting a delivery problem
does not itself disconnect the call.

Live countdowns show five-minute and one-minute warnings. Ordinary practitioner
completion requires notes and confirmed team participation. At expiry, the app
closes access and flags the record for review. Clinic staff end the call through
Google Meet's host controls, then the assigned practitioner confirms this in
AesthetiCare and saves the visit. New appointments and approved reschedules use
their own appointment/schedule-specific links.

## Confirmation, disputes, and review

The customer confirms receipt or reports a problem within 48 hours of completion.
The background job sends a reminder after 24 hours; unanswered confirmation enters
Consultation Review after 48 hours and is never fabricated as customer receipt.
An unstarted appointment past arrival grace enters Consultation Review rather
than automatically receiving a customer No-show label or penalty.

Appointment Management > View Details > Consultation controls lets a staff member
with `appointments:review`, independent of the treatment team, review the record.
Outcomes:

- Received: requires a started/completed appointment, notes, and team participation.
  Records an adjudicated clinic outcome, not a customer signature/confirmation.
- Reschedule: records a future requested schedule, archives the prior attempt,
  clears prior access/start/completion evidence, and sends it through the existing
  Booking Requests approval and availability checks. No new visit is silently
  booked and no duplicate charge is created.
- Refund review: creates a cancellation request for the existing approval and
  financial processing flow. A review recommendation does not issue a refund.
  The reviewer must check the final amount and any existing fee policy before
  processing, especially when the clinic caused the failure.

Notes remain editable by the assigned practitioner before earnings settlement.
Finance cannot approve online earnings while a dispute is open or notes are
missing. Short sessions, interruptions, and timer closures retain review flags
unless independently resolved. Neither participant can approve their own review.

## Production scheduler requirement

Activated on 2026-10-13 in Google Cloud project `aesthetic-db`:

- Job: `aestheticare-online-consultations`, region `us-central1`.
- Schedule: `* * * * *`, time zone `Asia/Manila` (every minute).
- Target: private Gen2 function `aestheticare-consultation-scheduler`.
- Authentication: OIDC from `aestheticare-consultation-cron`; only that account
  receives invocation permission on the function.
- Runtime: `aestheticare-consult-worker`, with Firestore access; maximum one
  instance and one concurrent request, 60-second timeout.
- Retry: up to three retries with 10–60 second backoff.
- Successful executions update `systemJobs/onlineConsultations.lastSuccessAt`
  and emit `online_consultation_reconciliation` in Cloud Logging.

Live verification: the authenticated execution at 2026-10-13 00:55 Asia/Manila
returned HTTP 200 and logged a successful reconciliation with zero records
requiring closure. The 25 relevant workflow regression tests passed locally.
The recurring run at 00:57 also succeeded; the job remained enabled with its
next run scheduled one minute later. An unauthenticated POST returned HTTP 403.

This dedicated worker uses Google IAM authentication and does not need a
`CRON_SECRET`. To redeploy its source, first run
`node scripts/prepare-consultation-function.mjs`, which copies the tested shared
workflow modules into `backend/consultation-scheduler-function/lib`.

Vercel's existing daily timeout cron remains a reconciliation fallback. It does
not provide minute-level expiry. Alternatives to the active Google scheduler:

1. A persistent backend process already has the once-per-minute cleanup loop.
2. Run the supplied persistent worker with `npm run consultations:worker` on a
   host that supports continuously running processes. Set
   `CONSULTATION_API_BASE_URL` to the backend API base (including `/api` when used)
   and give that worker the same `CRON_SECRET` as the backend.
3. Configure an external scheduler to make an authenticated request every minute
   to `/api/cron/online-consultation-timeouts` (or the direct backend equivalent),
   with `Authorization: Bearer <CRON_SECRET>`.

The worker uses a thirty-second request timeout, retries on its next minute tick,
does not overlap its own requests, and never prints credentials. Cleanup is
transactional and reminders use deterministic IDs. Monitor failures and alert if
no successful cleanup has occurred for several minutes. Do not put the secret in
frontend variables, source control, or public scheduler URLs.

Scheduler activation deploys the dedicated cleanup function only. The remaining
backend, frontend, and updated Firebase rules must be deployed together for the
full consultation workflow. Test with separate clinic and customer accounts,
service-key check-in, Google OAuth link generation, in-app and email notifications,
host call ending, and reviewed refund/reschedule processing in staging. New
consultation setup does not require Google OAuth or Calendar access.
