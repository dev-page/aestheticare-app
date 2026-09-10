import crypto from 'node:crypto'
import app from '../backend/otp-backend/server.js'

export default async function handler(req, res) {
  const requestId = crypto.randomUUID()
  const originalUrl = String(req.url || '')
  req.url = originalUrl.startsWith('/api/') ? originalUrl.slice(4) : (originalUrl === '/api' ? '/' : originalUrl)

  try {
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
