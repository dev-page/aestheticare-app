import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('appointment reminder cron accepts Vercel GET requests and requires CRON_SECRET', async () => {
  const source = await readFile(new URL('./server.js', import.meta.url), 'utf8')
  assert.match(source, /app\.all\('\/cron\/appointment-reminders'/)
  assert.match(source, /req\.get\('authorization'\).*Bearer \$\{secret\}/)
  assert.match(source, /appointment-reminder-\$\{row\.id\}-\$\{tomorrow\}/)
})
