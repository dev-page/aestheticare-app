import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requiredFiles = [
  'firebase.json',
  'vercel.json',
  'firestore.rules',
  'storage.rules',
  'frontend/src/router/index.js',
  'frontend/src/config/clinicPermissionRegistry.js',
  'frontend/src/components/sidebar/clinicSidebarItems.js',
  'backend/otp-backend/server.js',
]

const requiredSnippets = [
  ['frontend/src/router/index.js', 'finance:payables:view'],
  ['frontend/src/router/index.js', 'finance:refunds:view'],
  ['frontend/src/router/index.js', 'manager/purchase-history'],
  ['frontend/src/config/clinicPermissionRegistry.js', 'finance:refunds:manage'],
  ['frontend/src/config/clinicPermissionRegistry.js', 'finance:payables:settle'],
  ['firestore.rules', 'match /refundRequests/{requestId}'],
  ['firestore.rules', 'match /refundVouchers/{voucherId}'],
  ['firestore.rules', "hasPermission('finance:payables:approve')"],
  ['backend/otp-backend/server.js', '/finance/purchase-requests/:id/settle'],
]

const failures = []

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Missing required file: ${relativePath}`)
  }
}

for (const [relativePath, snippet] of requiredSnippets) {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) continue
  const content = fs.readFileSync(absolutePath, 'utf8')
  if (!content.includes(snippet)) {
    failures.push(`Missing required configuration in ${relativePath}: ${snippet}`)
  }
}

const secretPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
const scanRoots = ['frontend/src', 'backend/otp-backend', 'scripts']
for (const relativeRoot of scanRoots) {
  const absoluteRoot = path.join(root, relativeRoot)
  if (!fs.existsSync(absoluteRoot)) continue
  const entries = fs.readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = entry.parentPath
      ? path.join(entry.parentPath, entry.name)
      : path.join(absoluteRoot, entry.name)
    const relativePath = path.relative(root, filePath)
    if (relativePath.split(path.sep).some((segment) => ['node_modules', 'dist', '.git'].includes(segment))) continue
    if (!/\.(js|mjs|vue|json|rules|html|css)$/i.test(relativePath)) continue
    const content = fs.readFileSync(filePath, 'utf8')
    if (relativePath.replaceAll('\\', '/') === 'backend/otp-backend/serviceAccountKey.json') {
      console.warn('Warning: local Firebase service-account key detected; keep it ignored and rotate it before production.')
      continue
    }
    if (secretPattern.test(content)) {
      failures.push(`Private key material found in source: ${relativePath}`)
    }
  }
}

if (failures.length) {
  console.error('Production readiness verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log('Production readiness static checks passed.')
  console.log('Run docs/production-e2e-checklist.md against a staging deployment before release.')
}
