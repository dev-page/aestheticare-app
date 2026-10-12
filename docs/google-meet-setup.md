# Google Meet consultation hosting

Customers submit their appointment code in **My Appointments → Online Consultations → Join Consultation - submit service code**. Approval, a signed treatment contract, required payment, and the consultation window are checked before creating a meeting. Code submission is allowed from 30 minutes before the appointment until its scheduled end. Joining is allowed from five minutes before the appointment. Five incorrect codes lock submissions for ten minutes.

The backend creates the event in the assigned practitioner's connected Google account's **primary calendar** and checks that Google's returned organizer matches that account. No shared-platform Google account fallback is used. Arriving first does not change the organizer. The practitioner joins using the displayed hosting email and may need to admit the customer. Google Workspace access policies can affect admission. The paid consultation timer starts only when the assigned practitioner starts the session after both participants enter the application's waiting room; opening a Meet tab is not evidence that someone actually joined the video call.

## Administrator configuration

1. Enable Google Calendar API in the Google Cloud project. Configure a Web application OAuth client and consent screen. Request `openid`, `email`, and `https://www.googleapis.com/auth/calendar.events.owned`. During development, register every practitioner Google account as a test user. Complete Google's applicable verification before public rollout; refresh tokens for external apps in testing may expire after seven days when Calendar access is requested.
2. Configure these **backend** environment variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`: the exact public backend URL followed by `/google-meet/oauth/callback`. Register the identical URI in Google Cloud. For local testing, register the exact localhost callback too.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: a base64-encoded cryptographically random 32-byte key. Generate it securely, store it in the backend secret settings, and keep it stable across instances and deployments. Changing it requires practitioners to reconnect.
   - `FRONTEND_BASE_URL`: the trusted frontend origin used after successful connection.
3. Deploy the backend, frontend, and Firestore rules together. Google connection states, account ownership mappings, encrypted refresh tokens, and code-attempt counters are server-only. Meeting creation and consultation verification fields cannot be written by clients. Existing meeting links created through the former shared account must be replaced through customer code submission; they cannot bypass the new host/code checks.
4. Each practitioner opens **Online Consultation → Connect Google account**, chooses their Google account, and grants permission. Its email can differ from their AesthetiCare email. The UI displays the hosting email. Reconnecting uses Google's account selection; switching to a different hosting account is blocked while future meetings created under the original account remain scheduled. Disconnect removes stored credentials and blocks new meeting creation, but does not delete already created Calendar events.

## Verification before rollout

The subsequent `online-consultation-workflow.md` defines actual-start duration,
arrival grace periods, interruptions, and the production scheduler requirement.
It supersedes the initial fixed scheduled-end behavior described above.

Use separate customer and practitioner accounts. Confirm that customer code submission generates a single meeting across retries, the organizer is the connected practitioner, and the customer arriving first never receives host controls. Confirm the practitioner signs into that exact hosting account, can admit the customer, and can start the timer only after both waiting-room entries. Test revoked Google access, incorrect codes, denial of OAuth permission, incomplete payment/consent, changed practitioner/schedule, and accounts with organization restrictions. No live Google authorization or Meet host controls are proven by mocked tests.

Google references: [Calendar event creation](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [OAuth web-server authorization](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar organizers](https://support.google.com/meet/answer/10003792?hl=en).
