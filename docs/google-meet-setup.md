# Google Meet for online consultations

AesthetiCare generates a separate Google Meet room for each online appointment
through the Google Meet REST API. The assigned practitioner connects their own
Google account once, then generates the link from the appointment row. Calendar
events are not created.

## Clinic workflow

1. The customer books an online consultation, signs the agreement, and pays the
   required amount.
2. The assigned practitioner opens **Online Consultations**, connects their
   Google account if needed, and selects **Generate link & notify** for the
   appointment.
3. AesthetiCare creates a meeting space under that practitioner's Google
   account, stores the link for the appointment, writes a Meet link history
   record, and notifies the customer in the app and by email.
4. The customer enters their six-digit service key in **My Appointments** to
   reveal the link. The service key is not a Google credential.
5. The practitioner and customer join the same room. The practitioner checks
   the customer's identity, admits them if prompted by Google Meet, and starts
   the consultation timer in AesthetiCare.
6. At the end, the Meet host ends the call in Google Meet. The assigned
   practitioner confirms this in AesthetiCare and saves the clinical notes.

The history table is below the online consultation appointment table. It records
the practitioner, customer, service, appointment time, and when each new link
was generated. It does not expose the link itself.

## Google configuration

The backend needs `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, a
registered callback URL (`GOOGLE_OAUTH_REDIRECT_URI` outside production), and a
32-byte base64 `GOOGLE_TOKEN_ENCRYPTION_KEY`. Production uses
`https://aestheticare.online/api/google-meet/oauth/callback` as its callback.
Register the matching redirect URI in the Google OAuth client.

Each practitioner authorizes AesthetiCare with the Google Meet
`meetings.space.created` scope. The backend stores only an encrypted refresh
token and the account identity. No Calendar permission or Firebase service
account key is used as a Google Meet credential. Do not put Google OAuth
secrets or tokens in the frontend.
