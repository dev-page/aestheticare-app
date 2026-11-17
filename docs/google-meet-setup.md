# Google Meet for online consultations

AesthetiCare uses manually created Google Meet rooms. It does not connect to a Google account, call the Meet API, or create Calendar events. Clinic staff still sign in to Google directly at `meet.google.com`; the Google unverified-app consent screen is not part of this workflow.

## Clinic workflow

1. The customer signs the consultation agreement and pays the required amount.
2. Within 30 minutes of the appointment, the customer enters their six-digit service key in **My Appointments**. This verifies check-in and places them in the virtual waiting room. The key is not a Google credential.
3. A clinic employee with branch access and the `consultations:create` permission opens **Appointment Management > Service queue > Online Consultations**. They select **Create room in Google Meet**, sign in to the Google account that should host the call, and create a room.
4. The employee copies the URL from Google Meet, returns to the appointment, and selects **Add link & notify**. AesthetiCare validates and saves the link, posts an in-app notification, and emails the customer's appointment email. If the email cannot be sent, the link remains available in the app and the clinic sees a warning.
5. The customer and clinic open the same link from their appointment. The assigned practitioner confirms the customer's identity and starts the consultation timer in AesthetiCare.
6. At the end, the Meet host selects **End meeting for everyone** in Google Meet. The assigned practitioner confirms that in AesthetiCare and saves the clinical notes.

For the assigned practitioner to have host controls, create the room while signed into that practitioner's Google account. If another employee creates it, that employee is the host and must end the call or make the practitioner a co-host in Google Meet.

## Setup and account keys

No Google OAuth client, Calendar permission, Meet API scope, or Google service-account key is needed for this workflow. Email delivery uses the backend's existing email-provider configuration. AesthetiCare's six-digit service key remains the customer's appointment check-in code; it is not used to create or authenticate a Google room.

Google OAuth credentials that were used by the older automatic-room workflow can remain in deployment settings while legacy consultation records still need them. New consultations do not use those credentials. Do not put a Firebase Admin service-account JSON key in the browser or use it as a Google Meet credential.
