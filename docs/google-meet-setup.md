# Google Meet consultation hosting

Customers submit their appointment code in **My Appointments > Online consultations > Check in to virtual waiting room**. The backend verifies approval, signed contract, required payment, and appointment timing, then prepares the meeting. The customer waits in the app until the practitioner invites them. The invitation sends an in-app notification, reveals **Join Google Meet** to the customer, and opens Meet for the practitioner. Code submission is allowed from 30 minutes before the appointment until its scheduled end. Five incorrect codes lock submissions for ten minutes.

The backend creates the event in the assigned practitioner's connected Google account's **primary calendar** and checks Google's returned organizer. It does not use a shared platform account. The practitioner may need to admit the customer. With Meet attendance permission, the backend checks active Meet participants every 15 seconds; the practitioner can start only after Meet reports at least two participants and they confirm the customer's identity. The paid consultation timer starts on the practitioner's **Start Consultation** action. Without attendance permission, in-app join records and practitioner confirmation are used as a fallback.

## Administrator configuration

1. In the Google Cloud project, enable the **Google Calendar API** and **Google Meet REST API**. Configure the Google Auth Platform consent screen and a Web application OAuth client. The app requests `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.owned`, and `https://www.googleapis.com/auth/meetings.space.readonly`. Add practitioner accounts as OAuth test users during development. The Meet read-only scope is sensitive and public use may require Google's OAuth verification. External apps in Testing can have refresh tokens expire after seven days for these scopes.
2. Add these environment variables in the **backend host's secret/environment settings**, not the frontend:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`: the exact public backend URL followed by `/google-meet/oauth/callback`. Register that exact URI in the OAuth client.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: a stable, base64-encoded random 32-byte key. Changing it requires practitioners to reconnect.
   - `FRONTEND_BASE_URL`: the trusted frontend origin used after successful connection.
3. Deploy the backend, frontend, and Firestore rules together. This implementation polls the Meet REST API, so it does not need Google Workspace Events subscriptions or Pub/Sub. Connection states, account ownership mappings, encrypted refresh tokens, and code-attempt counters remain server-only. The customer cannot read the meeting link until the practitioner invitation is recorded.
4. Each practitioner opens **Online Consultation > Connect Google account**, chooses their Google account, and grants the Calendar and Meet permissions. Existing connections must reconnect to grant the new Meet attendance scope. Their Google email can differ from their AesthetiCare email. Switching hosting accounts is blocked while future meetings created under the original account remain scheduled. Disconnecting removes stored credentials but does not delete existing Calendar events.

## Verification before rollout

Use separate customer and practitioner accounts. Confirm that code submission puts the customer in the virtual queue without revealing the Meet link, the practitioner can invite them, the customer receives the invitation and can join, Meet attendance enables **Start Consultation**, and the practitioner action starts the timer. Also check revoked Google access, wrong codes, OAuth denial, incomplete payment/contract, changed practitioner/schedule, and organization admission policies. Mocked tests do not verify live Google authorization, Firestore rules deployment, or Meet host controls.

Google references: [Calendar event creation](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Meet API setup](https://developers.google.com/workspace/meet/api/guides/quickstart/nodejs), [Meet OAuth scopes](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize), [OAuth app verification](https://support.google.com/cloud/answer/13463073?hl=en).