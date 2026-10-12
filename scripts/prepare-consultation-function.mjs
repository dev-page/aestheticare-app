import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destination = path.join(root, 'backend/consultation-scheduler-function/lib')
fs.mkdirSync(destination, { recursive: true })
const sources = [
  ['backend/otp-backend/consultationWindows.js', 'consultationWindows.js'],
  ['backend/otp-backend/bookingWorkflow.js', 'bookingWorkflow.js'],
  ['shared/onlineConsultation.js', 'onlineConsultation.js'],
]
for (const [source, target] of sources) {
  const text = fs.readFileSync(path.join(root, source), 'utf8').replaceAll("'../../shared/onlineConsultation.js'", "'./onlineConsultation.js'")
  fs.writeFileSync(path.join(destination, target), text)
}
console.log('Prepared scheduler function from the tested appointment workflow modules.')
