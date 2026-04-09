# Deployment Guide

This project is structured for:

- Frontend: Firebase Hosting
- Backend: Google Cloud Run
- Database/Storage/Auth: Firebase
- Domain: optional custom domain from Hostinger DNS

## Why this setup

The frontend is a Vite SPA and deploys cleanly to Firebase Hosting. The `otp-backend` directory is a Node/Express server, which is not a good fit for regular Hostinger shared hosting. Cloud Run is the simplest production target without rewriting the backend into Firebase Functions.

## Prerequisites

Install these tools on the machine you deploy from:

- Firebase CLI
- Google Cloud SDK (`gcloud`)

Then authenticate:

```powershell
firebase login
gcloud auth login
gcloud config set project aesthetic-db
```

## 1. Frontend production env

Create the root `.env` from [.env.example](/C:/Users/Lovely/Downloads/aestheticare-main%20(1)/aestheticare-main/.env.example).

Set these values:

```env
VITE_OTP_API_BASE_URL=https://YOUR-CLOUD-RUN-URL
VITE_OTP_BACKEND_URL=https://YOUR-CLOUD-RUN-URL
VITE_PAYMONGO_PUBLIC_KEY=...
VITE_FACE_API_SCRIPT_URL=...
VITE_FACE_API_MODEL_URL=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_MAP_ID=...
```

Use the real Cloud Run URL after the backend is deployed.

## 2. Backend production env

Create `otp-backend/.env` from [otp-backend/.env.example](/C:/Users/Lovely/Downloads/aestheticare-main%20(1)/aestheticare-main/otp-backend/.env.example).

Set these values:

```env
PORT=8080
SENDGRID_API_KEY=...
SENDGRID_SENDER=...
PAYMONGO_SECRET_KEY=...
PAYMONGO_PUBLIC_KEY=...
FRONTEND_BASE_URL=https://YOUR-FIREBASE-HOSTING-DOMAIN
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_CALENDAR_ID=primary
FIREBASE_PROJECT_ID=aesthetic-db
FIREBASE_STORAGE_BUCKET=aesthetic-db.firebasestorage.app
```

Notes:

- Do not set `FIREBASE_SERVICE_ACCOUNT_PATH` in Cloud Run unless you are mounting a secret file manually.
- The backend now supports Google-managed credentials on Cloud Run through `applicationDefault()`.

## 3. Deploy the backend to Cloud Run

From `otp-backend/`:

```powershell
gcloud run deploy otp-backend `
  --source . `
  --region asia-southeast1 `
  --allow-unauthenticated
```

Why `asia-southeast1`:

- it is a supported Cloud Run region
- it is a practical region for Philippines/Singapore traffic

After deployment, copy the Cloud Run service URL.

## 4. Build and deploy the frontend to Firebase Hosting

Back in the project root:

```powershell
npm install
npm run build
firebase deploy --only hosting
```

Firebase Hosting config is already present in [firebase.json](/C:/Users/Lovely/Downloads/aestheticare-main%20(1)/aestheticare-main/firebase.json).

## 5. Custom domain with Hostinger

If your domain is managed in Hostinger:

1. Open Firebase Hosting custom domain setup
2. Add your domain there
3. Copy the DNS records Firebase gives you
4. Add those DNS records in Hostinger DNS

Hostinger is only used as the DNS manager in this setup.

## 6. Rotate exposed secrets

Before production, rotate these if they were ever exposed:

- SendGrid API key
- PayMongo secret/public keys
- Google OAuth client secret
- Google refresh token

## Rollback points

Git tags available in this repo:

- `savepoint/pre-deployment-fixes`
- `savepoint/post-deployment-hardening`
