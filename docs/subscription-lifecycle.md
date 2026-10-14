# Clinic subscription lifecycle

Permanent plans are Free, Basic and Premium. A trial is an offer on Premium, not a fourth plan. Approved, active new clinic owners can start one 14-day Premium trial from Account Settings → Subscription Plan → Explore Plans. It requires no card and creates no payment or recurring charge.

Trial activation uses the authenticated backend and a Firestore transaction. It records separate trial dates and a permanent usage marker on the owner and main clinic. Previous paid subscriptions, including payment history under the owner's email, prevent activation. Retrying activation returns the original active trial without extending it. Buying Basic or Premium during a trial starts the paid cycle on the verified payment date.

At expiry, paid features become unavailable immediately. Free retains the clinic profile, primary branch, service listings, clients, inbox, appointment management, transaction resolution and account settings. Existing records are retained. Previously funded consultations can still be resolved through Appointment Management, while new paid-feature bookings require a paid plan. Additional branches and workforce features retain their Premium restrictions.

The hourly Firebase `subscriptionMaintenance` job updates the owner and owned branches in a transaction. It applies scheduled, paid next cycles before evaluating expiry, preserves clinic publication, returns expired subscriptions to Free, and creates one expiry notification per period. Notification links and direct routes use the same Free route allowlist. Supply APIs independently enforce paid access while retaining inbox access.

The existing backend subscription reminder job covers trials as well as paid plans at the 7-, 3- and 1-day thresholds. Trial reminders explain that no charge occurs and the clinic returns to Free. Email delivery still requires the production Mailjet configuration and the authenticated reminder schedule described in [subscription-reminders.md](subscription-reminders.md).

Release the frontend, updated API, Firestore rules, and Firebase `subscriptionMaintenance` function together. Frontend deployment alone does not enable trial activation or replace an already deployed legacy expiry function. Validate trial activation, paid conversion, expiry and retained appointment access in staging before release. Automated tests use local transaction adapters rather than live Firebase or checkout.
