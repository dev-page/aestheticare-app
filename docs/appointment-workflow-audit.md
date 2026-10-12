# Appointment and online consultation audit

Reviewed: 2026-10-12. Scope: local booking preparation, walk-in booking/payment,
contract signing, appointment lifecycle, rescheduling/reassignment, Google Meet
access, consultation expiry, team earnings, and deployment scheduling.
This is a code review with automated regressions, not a live production certification.

Follow-up implementation: see `online-consultation-workflow.md`. Actual-start
timing, grace expiry review, interruption records, disputes, confirmation reminders,
closed-link controls, and a deployable minute worker now address several findings
below. A private Google Cloud cleanup function and authenticated minute scheduler
were activated on 2026-10-13; see the workflow document for configuration.
Live Google Meet provider verification remains open.

## Defects corrected locally

| Finding | Correction | Evidence |
| --- | --- | --- |
| Rescheduling/reassignment could retain previous code verification and waiting-room entries. | Clear access evidence when either schedule or practitioner changes. The new appointment needs fresh code verification and participant entries. | `resetAppointmentAccess` in `bookingWorkflow.js`, both reassignment/reschedule updates in `server.js`, lifecycle regression. |
| Old practitioner aliases could authorize start/completion even with a different assigned practitioner. | Lifecycle authorization and treatment-team lead selection prioritize the current assigned practitioner. | `bookingMilestones.js`, `practitionerTeams.js`, old-lead denial regression. |
| New walk-in financial acceptance fields were not protected against direct browser writes by appointment managers. | Protect booking agreement, requirement, and arranger identity fields for version 2 appointments. | `firestore.rules`; deployment and emulator verification still required. |
| Manual consultation completion did not flag missing notes and could erase earlier review flags. | Flag missing notes and preserve existing flags on completion and timeout. Finance already requires a review explanation for flagged earnings. | Completion regression in `bookingWorkflow.test.js`; `consultationWindows.js`. |
| Walk-in could create online consultations whose clinic client ID cannot authenticate as the recipient. | Exclude online consultations from Walk-In and reject them server-side without partial writes. On-site consultations remain supported. Online consultations use the customer account flow. | `WalkInDesk.vue`, `walkInBookings.js`, online rejection/on-site acceptance regression. |
| Practitioner browser timezone could shift the online consultation window. | Parse clinic schedules explicitly in Philippine time, matching the backend. | `PractitionerOnlineConsultation.vue`; production build. |
| Legacy upload endpoint instructed online customers to sign after payment. | Explain online signing before payment and clinic-assisted walk-in signing after POS payment. | Disabled upload endpoint message in `server.js`. |

## Open issues in priority order

| Priority | Gap and consequence | Recommended next action |
| --- | --- | --- |
| High | `vercel.json` runs consultation expiry once daily. An in-process interval or an open practitioner's browser is not a reliable scheduled worker for a serverless deployment. Overdue records can remain open. | Configure an authenticated external scheduler to call `/api/cron/online-consultation-timeouts` every minute, or run the backend on a persistent worker. Keep the daily cron as reconciliation. Verify execution history and retries. |
| High | App waiting-room timestamps record Join button clicks, not actual Google Meet attendance or identity. Duration is application elapsed time. A click and an open tab do not prove a delivered consultation. | Keep independent customer completion and Finance review. Define a disputed-session workflow before treating this timer as evidence of delivery. Consider provider attendance integration separately, subject to account capabilities. |
| High | Ending the app session does not end the external Google Meet call. | Require the practitioner to end the call for everyone in Meet. Label app controls accurately; test this with two real Google accounts. |
| High | A fixed scheduled end leaves less treatment time when the practitioner starts late. An expired unstarted session can be labeled No-show when the customer never clicked Join, including an outage or unavailable practitioner. | Decide a late-practitioner grace period, who records fault, and reschedule/refund rules. Review expired sessions before assigning customer penalties; do not treat an app No-show label as proof of fault. |
| High | OAuth configuration, actual host/admission behavior, expired/revoked credentials, email delivery, payment webhooks/refunds, and deployed Firebase rules have not been verified against live integrations in this review. | Run the staging checklist below before release. Follow `google-meet-setup.md`. |
| Medium | Legacy appointments have broader direct Firestore editing rules than version 2 records. The new protection does not migrate historical records. | Inventory legacy records and frontend writers; migrate them to server-controlled transitions before tightening legacy rules. Avoid breaking existing appointments through an untested blanket rule change. |
| Medium | Google account change/disconnection and appointment rescheduling do not remove old Calendar events. The app rejects mismatched appointment metadata, but a previously shared external link may still exist. | Add idempotent Calendar cancellation/replacement reconciliation, including failed Google requests and notification to both participants. |
| Medium | A customer may never confirm completed work, leaving an appointment awaiting confirmation. | Define reminders, a dispute window, and a reviewed resolution path. Do not automatically confirm receipt merely because the practitioner completed it. |
| Medium | Staff-assisted recipient signatures rely on the clinic handing the screen to the correct recipient. A saved signature image is not independent identity verification. | Require staff to verify recipient identity, retain the witness, and define guardian/representative handling explicitly. The arranger's financial agreement remains separate from treatment consent. |

## Existing safeguards inspected

The workflow checks linked-consultation prerequisites, practitioner schedules and
leave, overlapping resources, separate service dates per person, signed agreements,
initial payment before starting, reception check-in for on-site appointments,
participant-specific access, and team participation before completion. Automated
tests cover parts of these flows. They do not establish end-to-end correctness
with production Firebase, PayMongo, email, or Google accounts.

## Required staging scenarios

- Two customers attempt the last practitioner/resource slot simultaneously.
- Payment arrives after a cancellation/reschedule request; duplicate webhook and
  refund retries leave exactly one correct financial result.
- Customer arrives first in Meet; practitioner joins with the connected hosting
  account and has host controls. Repeat with the wrong Google account.
- Google authorization is revoked, a meeting creation request fails, or the page
  refreshes during code submission; retry does not create duplicate meetings.
- Reschedule after code verification and waiting-room entry; the old evidence
  cannot start the new appointment, and a fresh code is delivered.
- Both browsers close during a consultation; the external scheduler still closes
  the app record and flags insufficient documentation.
- Practitioner absent, customer absent, late practitioner, and customer losing
  internet receive reviewed outcomes rather than automatic blame.
- Recipient of a friend's walk-in booking signs their own treatment contract;
  the friend's financial signature cannot bypass recipient consent/check-in.
- Exercise deployed rules as customer, receptionist, practitioner, Finance,
  unrelated branch staff, and unauthenticated user.

All code corrections remain local until backend/frontend and Firestore rules are
deployed. Remaining provider setup and policy decisions are not completed by a
passing build or unit test suite.
