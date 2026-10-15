# Customer-only Android app with PWABuilder

The website and Android app use the same Firebase customer accounts, backend, appointments and messages. Their deployment builds are separate: the website keeps its normal landing page and authentication choices. The customer app uses its own manifest and customer-only navigation.

## URLs and packaging

Build the website with `npm run build`; its output stays in `dist/`, with the original `/manifest.json` and start URL `/`.

Build the APK frontend with `npm run build:customer-app`; its output goes to `dist-customer-app/`. Deploy that folder to a separate HTTPS host or subdomain configured to serve `index.html` for SPA routes. Do not replace the website deployment with this folder. Authorize the app host in Firebase Authentication and the backend's allowed origins before testing login and API requests.

Enter the separate app host in PWABuilder. Use these Android package settings, substituting your actual app host:

- Host: the separate HTTPS app host
- Start URL: `/customer-app/login`
- Manifest URL: `https://<app-host>/customer-app/manifest.json`
- Display mode: Standalone
- Theme/background/navigation color: `#fff8eb`

Only the customer app build's HTML links to the customer manifest. The website HTML continues to use its original manifest. The customer manifest starts at the customer login. Its scope remains `/` on the separate app host because authenticated customer pages use `/customer/`, and shared password recovery and consent routes also need to remain within the app. Route guards enforce the customer experience; manifest scope does not grant access permissions.

Choose the real Android package ID and signing key when generating the APK. PWABuilder generates the corresponding Digital Asset Links file. Publish that exact file at `https://<app-host>/.well-known/assetlinks.json` to associate the signed APK with the site. Do not use placeholder package names or certificate fingerprints. Save the signing key for future updates.

Official packaging instructions: https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md

## Navigation and account behavior

- Login: `/customer-app/login`, with no link to the marketing landing page.
- Create account: `/customer-app/register`, which renders `RegisterCustomer` directly and creates a Customer account. No registration-type chooser appears.
- Forgot password: `/customer-app/forgot-password`, with return navigation to customer login or the customer account page.
- Registration completion, password-reset completion, logout and inactivity expiry stay in the customer authentication flow.
- Existing clinic, supplier, staff and system admin accounts cannot enter app panels. They use the normal website login in a separate browser tab.
- App mode is retained in the app's tab/session. Ordinary website tabs continue to use the website login, landing page and registration chooser.
- Payments and Google Meet may intentionally open their external providers. This does not expose clinic/admin panels inside the app.

`build:customer-app` enables customer-only mode automatically for that build. Do not set `VITE_MOBILE_APP=true` in the website environment. No APK, app deployment, or signing association is created by the frontend build command.

## Device checks before release

Test the generated, signed APK on Android: fresh launch, direct customer signup and OTP, existing customer login, rejected operational-account login, password recovery, account recovery, booking/payment return, external consultation links, logout, app restart, and Android Back navigation. Test ordinary website clinic/supplier/admin login separately. Local automated checks and a frontend build do not replace these signed-APK checks.
