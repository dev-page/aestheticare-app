// Run as a persistent worker, not inside a Vercel request.
const base = String(process.env.CONSULTATION_API_BASE_URL || '').replace(/\/$/, '')
const secret = String(process.env.CRON_SECRET || '')
if (!/^https?:\/\//.test(base) || !secret) throw Error('Configure CONSULTATION_API_BASE_URL (including /api if needed) and CRON_SECRET.')
let stopped = false
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopped = true })
while (!stopped) {
  const started = Date.now()
  try {
    const response = await fetch(`${base}/cron/online-consultation-timeouts`, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw Error(`Scheduler endpoint returned HTTP ${response.status}`)
    const result = await response.json()
    if (!result.success) throw Error('Scheduler endpoint reported failure')
    console.log(`${new Date().toISOString()} consultation reconciliation succeeded; closed ${Number((result.data || result).closed || 0)} records`)
  } catch (error) {
    // Never print request headers, response bodies, or credentials.
    console.error(`${new Date().toISOString()} consultation reconciliation failed: ${error.name === 'TimeoutError' ? 'request timed out' : 'check endpoint, scheduler secret, and backend availability'}`)
  }
  await new Promise(resolve => setTimeout(resolve, Math.max(1000, 60000 - (Date.now() - started))))
}
