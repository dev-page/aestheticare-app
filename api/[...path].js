import app from '../backend/otp-backend/server.js'

export default function handler(req, res) {
  const originalUrl = String(req.url || '')
  req.url = originalUrl.startsWith('/api/') ? originalUrl.slice(4) : (originalUrl === '/api' ? '/' : originalUrl)
  return app(req, res)
}
