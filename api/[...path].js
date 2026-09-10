import crypto from 'node:crypto'

let backendAppPromise

const loadBackendApp = () => {
  if (!backendAppPromise) {
    backendAppPromise = import('../backend/otp-backend/server.js').then((module) => module.default)
  }
  return backendAppPromise
}

export default async function handler(req, res) {
  const requestId = crypto.randomUUID()
  const originalUrl = String(req.url || '')
  req.url = originalUrl.startsWith('/api/') ? originalUrl.slice(4) : (originalUrl === '/api' ? '/' : originalUrl)

  try {
    const app = await loadBackendApp()
    return await app(req, res)
  } catch (error) {
    console.error('VERCEL_API_HANDLER_FAILURE', {
      requestId,
      method: req.method,
      path: req.url,
      errorName: error?.name || null,
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      stack: process.env.NODE_ENV === 'development' ? error?.stack || null : undefined,
    })

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'The API request could not be completed.',
        requestId,
      })
    }
  }
}
