# Appointment and consultation process review

## Required sequence

| Stage | On-site service | Online consultation |
| --- | --- | --- |
| Booking | Clinic checks service eligibility, staff availability and resources. Walk-ins use the clinic POS flow. | Requires an assigned practitioner with a connected Google hosting account. Group consultations are rejected. |
| Agreement and payment | Online bookings use the saved agreement before checkout. Walk-ins collect payment at POS and obtain the actual recipient's signature before treatment. Booking acceptance and individual recipient consent remain separate for bookings made for someone else. | Clinic approval, signed agreement and required payment must exist before meeting access. |
| Code | Reception verifies the recipient's code and checks them in within the appointment window. | The customer submits the code from 30 minutes before the scheduled start until the arrival grace deadline; the backend creates a meeting in the practitioner's primary Calendar. |
| Start | Only the assigned lead can start after check-in, signing and payment. A check-in cannot be reused to start after the appointment window expires. | App access opens five minutes early. Both participants enter the app waiting room; the practitioner confirms the customer's actual presence in Meet before starting the timer. A late start must still fit every team member's availability. |
| Finish | Each team member confirms participation; the practitioner finishes. Online-booked customers confirm receipt. Walk-in completion follows the clinic's witnessed workflow. | Practitioner completion requires notes. Timer expiry closes the app window, but customer confirmation still requires saved notes and individual team confirmations. Short delivery and connection issues retain their review flags. |
| Exceptions | Reschedules require fresh access verification. The clinic reviews expired appointments rather than starting them using old check-in evidence. | Missed arrival, disputes and overdue confirmations go to clinic review. The recipient and treatment team cannot adjudicate their own consultation. Closing the app window does not disconnect Google Meet or revoke a copied URL: the host must end the meeting for everyone. |

## Confirmed gaps corrected

- Expired on-site check-ins could start services after their booked appointment window.
- Timer-based consultation completion could bypass notes and team participation checks at customer confirmation.
- A clinic user who was also the consultation customer could adjudicate their own review.
- Late manual completion could overstate consultation duration beyond the official end time.
- Service-code emails described reception check-in even for online consultations; they now explain both paths and when the consultation timer starts.
- Appointment payment recording depended on the customer returning from checkout. A signed PayMongo webhook now calls the same provider-verification and transactional recording handler as the browser return. Both paths deduplicate by checkout session.

## Enable payment reconciliation on the backend

1. Deploy the updated Express backend, including `appointmentPaymentWebhook.js`. Deploying only the customer frontend does not activate this handler.
2. In PayMongo, register an enabled webhook for `checkout_session.payment.paid` at your actual backend's `/paymongo/webhook` endpoint. For the currently configured Cloud Functions API this is `https://us-central1-aesthetic-db.cloudfunctions.net/api/paymongo/webhook`. If using the Vercel API adapter, use `https://<backend-host>/api/paymongo/webhook`.
3. Set `PAYMONGO_WEBHOOK_SECRET` on that backend to the endpoint's signing secret. This is not the PayMongo API secret and must not be a `VITE_` frontend variable. Match the webhook's test/live mode to the existing `PAYMONGO_SECRET_KEY`.
4. Deliver a PayMongo test checkout event and verify the response and appointment state. The handler verifies the raw body HMAC, signature timestamp and mode, then independently retrieves the checkout from PayMongo before applying its amount.
5. Test duplicate delivery, the customer's browser return arriving before/after the webhook, and closing the browser after payment. Exactly one payment transaction should be recorded.
6. Test payment arriving after cancellation or a booking change. The handler leaves the appointment closed and saves an `appointmentPaymentReviews/<checkoutSessionId>` record with a clinic notification identifying the checkout and appointment. Reconcile that exception against PayMongo manually; no automatic refund or extra collection is performed. A dedicated reconciliation screen is not part of this change.

Non-appointment checkout events, including subscription checkout payments, retain their existing flows. Temporary provider failures return a non-success response so delivery can be retried.

PayMongo signature format and checkout event references: [Webhook setup and management](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [Webhook events](https://docs.paymongo.com/docs/developer-tools-webhooks-events).

## Deployment checks still required

New online bookings now save an individual notification for each active, authorized branch recipient (including the owner) inside the booking transaction. This covers single/group creation and multi-service batches. No notification survives a failed booking transaction. Each employee has independent read/unread state; the live topbar listener updates its badge and shows a toast for newly arriving booking alerts. Reviewers open Online Booking Requests for pending approvals; Free Plan bookings open appointment records with payment still pending. Notification links select the authorized branch. These are in-app alerts, not background push messages or booking emails to staff.

Use test payments and two separate participant accounts on staging. Exercise consent, payment, code entry, practitioner hosting, early/late arrival, simultaneous starts, interruption, manual and timer completion, customer disputes, rescheduling, cancellation and staff earnings. Confirm the consultation scheduler is running against the same database and backend version. Automated tests do not verify Google account permissions, actual Meet attendance, external call termination, payment-provider webhook registration, or deployed email delivery.
