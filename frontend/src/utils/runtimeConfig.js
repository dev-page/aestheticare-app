const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '')

const isBrowser = typeof window !== 'undefined'
const browserHostname = isBrowser ? String(window.location.hostname || '').trim().toLowerCase() : ''
const appOrigin = isBrowser ? trimTrailingSlash(window.location.origin) : ''
const isLocalBrowser = browserHostname === 'localhost' || browserHostname === '127.0.0.1'
const isCustomerAppBuild = import.meta.env.MODE === 'customer-app'
const hostedApiBase = appOrigin ? `${appOrigin}/api` : '/api'

const normalizeHostedApiUrl = (configured) => {
  if (!configured || !appOrigin || isLocalBrowser) return configured
  if (configured === appOrigin) return hostedApiBase

  try {
    const parsed = new URL(configured)
    const configuredOrigin = trimTrailingSlash(parsed.origin)
    const configuredPath = trimTrailingSlash(parsed.pathname)
    const configuredHost = String(parsed.hostname || '').trim().toLowerCase()
    if (configuredHost === 'localhost' || configuredHost === '127.0.0.1') {
      return hostedApiBase
    }
    if (configuredOrigin === appOrigin && (!configuredPath || configuredPath === '/')) {
      return hostedApiBase
    }
  } catch (_error) {
    // Ignore invalid absolute URLs and keep the raw configured value.
  }

  return configured
}

const resolveRuntimeUrl = (envValue, localFallback) => {
  const configured = normalizeHostedApiUrl(trimTrailingSlash(envValue))
  if (isLocalBrowser) return localFallback
  if (configured) return configured
  return hostedApiBase
}

const uniqueUrls = (values) =>
  Array.from(new Set(values.map((value) => trimTrailingSlash(value)).filter(Boolean)))

export const APP_ORIGIN = appOrigin
// The Android/customer PWA is served with the API adapter under the same
// Vercel origin. Ignore a clinic website's legacy API URL in this build so
// mobile sign-in does not make a cross-origin request that can fail preflight.
export const OTP_API_BASE = resolveRuntimeUrl(
  isCustomerAppBuild ? hostedApiBase : import.meta.env.VITE_OTP_API_BASE_URL,
  'http://localhost:3000'
)
// The Express OTP backend defaults to port 3000. Keep the frontend default
// aligned with it so admin actions do not first target an unused port.
export const OTP_BACKEND_URL = resolveRuntimeUrl(
  isCustomerAppBuild ? hostedApiBase : import.meta.env.VITE_OTP_BACKEND_URL,
  'http://localhost:3000'
)
export const OTP_API_BASE_CANDIDATES = uniqueUrls([
  OTP_API_BASE,
  isCustomerAppBuild ? '' : hostedApiBase,
])
// In local development, the Vite origin is only the frontend and cannot serve
// backend routes. Avoid trying localhost:5173/api before showing the real error.
export const OTP_BACKEND_CANDIDATES = uniqueUrls([
  OTP_BACKEND_URL,
  OTP_API_BASE,
  isCustomerAppBuild || isLocalBrowser ? '' : hostedApiBase,
])
