import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const rootDir = path.join(__dirname, '..', '..')
const serviceAccountPathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
const serviceAccountPath = serviceAccountPathFromEnv
  ? (path.isAbsolute(serviceAccountPathFromEnv)
    ? serviceAccountPathFromEnv
    : path.join(rootDir, serviceAccountPathFromEnv))
  : path.join(__dirname, '..', 'serviceAccountKey.json')

const defaultRoles = [
  { key: 'Owner', label: 'Clinic Admin' },
  { key: 'Manager', label: 'Manager' },
  { key: 'HR', label: 'HR' },
  { key: 'Finance', label: 'Finance' },
  { key: 'Receptionist', label: 'Receptionist' },
  { key: 'Practitioner', label: 'Practitioner' },
  { key: 'Customer', label: 'Customer' },
]

const actionCatalog = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Update' },
  { key: 'disable', label: 'Disable' },
]

const staffResourceCatalog = [
  { key: 'backups', label: 'Backup Database' },
  { key: 'branches', label: 'Branches' },
  { key: 'clinic_profile', label: 'Clinic Profile' },
  { key: 'staff', label: 'Staff' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'clients', label: 'Clients' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'payments', label: 'Payments/POS' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'services', label: 'Services' },
  { key: 'consultations', label: 'Consultations' },
  { key: 'reports', label: 'Reports' },
  { key: 'hr', label: 'HR & Payroll' },
]

const customerResourceCatalog = [
  { key: 'centers', label: 'Centers' },
  { key: 'cart', label: 'Cart' },
  { key: 'orders', label: 'Orders' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'profile', label: 'Profile' },
]

const roleResourceMap = {
  Owner: ['backups', 'branches', 'clinic_profile', 'staff', 'attendance', 'clients', 'appointments', 'payments', 'inventory', 'services', 'consultations', 'reports', 'hr'],
  Manager: ['attendance', 'staff', 'inventory', 'services', 'appointments', 'reports'],
  HR: ['staff', 'attendance', 'hr', 'reports'],
  Finance: ['payments', 'reports', 'inventory'],
  Receptionist: ['clients', 'appointments', 'payments', 'attendance'],
  Practitioner: ['appointments', 'consultations'],
}

const buildPermissionsForRole = (roleKey) => {
  const resources =
    roleKey === 'Customer'
      ? customerResourceCatalog
      : staffResourceCatalog.filter((resource) => (roleResourceMap[roleKey] || []).includes(resource.key))
  const permissions = []
  resources.forEach((resource) => {
    actionCatalog.forEach((action) => {
      permissions.push(`${resource.key}:${action.key}`)
    })
  })
  return permissions
}

const run = async () => {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  const updated = {}
  for (const role of defaultRoles) {
    const permissions = buildPermissionsForRole(role.key)
    if (role.key === 'HR') {
      permissions.push('payroll:view', 'payroll:update', 'payroll:create')
    }
    updated[role.key] = Array.from(new Set(permissions))
    await db.collection('rolePermissions').doc(role.key).set(
      {
        role: role.key,
        permissions: updated[role.key],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  }

  console.log(JSON.stringify({
    updatedRoles: Object.keys(updated),
    permissionsCount: Object.fromEntries(Object.entries(updated).map(([key, perms]) => [key, perms.length])),
  }, null, 2))

  await admin.app().delete()
}

run().catch((error) => {
  console.error('Role permission sync failed:', error?.message || error)
  process.exit(1)
})
