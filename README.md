# AesthetiCare

AesthetiCare is a clinic operations platform for aesthetic clinics and their customers. The application combines a Vue 3 and Vite frontend, an Express API, and Firebase Authentication, Firestore, and Storage.

## Main workflows

- Customer and clinic registration, clinic verification, and subscription plans
- Clinic discovery, appointments, consultations, treatment sessions, consent, and payments
- Client directory and walk-in booking / point of sale
- Inventory, procurement, supplier records, receiving, and finance approvals
- Human resources, recurring shifts, attendance, leave, overtime, payroll, and payslips
- Pharmacy, reporting, and decision support

## Local development

Use a current Node.js LTS release. Install the root dependencies, then start the API and frontend together:

```sh
npm install
npm run start
```

The Vite frontend is available on its configured development port and the Express API defaults to port `3000`. For separate processes, use `npm run frontend` and `npm run backend`. Firebase emulators can be started with `npm run emulators` when a local emulator configuration is available.

## Runtime configuration

The frontend Firebase client configuration is in `frontend/src/config/firebaseConfig.js`. The backend reads runtime environment variables; do not commit service-account credentials or provider secrets. Firebase Admin credentials can be supplied through `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, or `FIREBASE_SERVICE_ACCOUNT_PATH`, with the project and storage settings supplied through `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET` as needed.

Configure only the integrations enabled in the environment. Common settings include `CORS_ORIGINS`, `APP_URL` / `FRONTEND_BASE_URL`, `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, Google OAuth/Calendar settings, and the registration OCR processor. Set these in the local environment or deployment secret store; never place secret values in source control.

## Firebase and deployment

Deploy Firestore and Storage rules with the Firebase CLI. The frontend is built with `npm run build`; the repository includes Vercel API routing and scheduled endpoints in `vercel.json`. Production integrations require their own configured provider credentials and staging verification.

For role-based workflows, use separate test accounts for the clinic owner, Finance, HR, Inventory, Procurement, practitioner, receptionist, and customer roles. Use the staging checklist in [`docs/production-e2e-checklist.md`](docs/production-e2e-checklist.md) before a release. A successful local build does not verify provider callbacks, production permissions, or live email/payment delivery.
