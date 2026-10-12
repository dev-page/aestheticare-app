# Subscription dates and expiry reminders

Owner Subscription Plan reads the owner billing record, falling back to the main
clinic record for older accounts. An explicit cleared expiry is respected.
Firestore timestamps, serialized timestamps, Unix seconds, milliseconds and ISO
strings are normalized and displayed in Asia/Manila. Browser listeners do not
calculate or write billing dates. The verified payment backend assigns them.
The subscription store no longer attempts to restore billing dates from old
payments when navigating between pages.

Paid Basic and Premium subscriptions receive a system notification and email at
seven, three and one day before expiry. A check selects the nearest current
threshold; a missed run does not send several old reminders at once. Owners
receive one notification per expiry date and threshold regardless of branch
count. Renewed, expired and Free subscriptions are skipped. Notifications link
to `/account/subscription` and appear in the existing topbar and notification
page. Email is sent to the owner's registered email through the existing Mailjet
backend configuration.

Reminder delivery is included in the existing protected
`/cron/appointment-reminders` daily job (`0 1 * * *`, 09:00 Asia/Manila), even
when there are no appointments to remind. A separate protected
`/cron/subscription-reminders` endpoint supports an independent scheduler or
retry. Both require `Authorization: Bearer <CRON_SECRET>`.

Private `subscriptionReminders` documents record email status and a five-minute
claim lease. Failed delivery can retry without recreating a notification or
resetting its read status. Failures produce a non-success response for monitoring.
The collection is server-only under the existing default Firestore deny rule.

Deploy the updated frontend and backend to release this change. The backend
requires `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_SENDER`, and
`CRON_SECRET`; the daily scheduler must use the same secret. This change does
not redeploy the previously activated Google consultation cleanup function.
