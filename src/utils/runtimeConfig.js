const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '')

const isBrowser = typeof window !== 'undefined'
const browserHostname = isBrowser ? String(window.location.hostname || '').trim().toLowerCase() : ''
const appOrigin = isBrowser ? trimTrailingSlash(window.location.origin) : ''
const isLocalBrowser = browserHostname === 'localhost' || browserHostname === '127.0.0.1'

const resolveRuntimeUrl = (envValue, localFallback) => {
  const configured = trimTrailingSlash(envValue)
  if (configured) return configured
  if (isLocalBrowser) return localFallback
  return appOrigin
}

const uniqueUrls = (values) =>
  Array.from(new Set(values.map((value) => trimTrailingSlash(value)).filter(Boolean)))

export const APP_ORIGIN = appOrigin
export const OTP_API_BASE = resolveRuntimeUrl(import.meta.env.VITE_OTP_API_BASE_URL, 'http://localhost:3000')
export const OTP_BACKEND_URL = resolveRuntimeUrl(import.meta.env.VITE_OTP_BACKEND_URL, 'http://localhost:3001')
export const OTP_API_BASE_CANDIDATES = uniqueUrls([OTP_API_BASE, APP_ORIGIN])
export const OTP_BACKEND_CANDIDATES = uniqueUrls([OTP_BACKEND_URL, OTP_API_BASE, APP_ORIGIN])
