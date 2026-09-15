import admin from 'firebase-admin'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { ServerClient } from 'postmark'
import { EMAIL_WEBSITE_URL } from '../emailLinks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDir = path.join(__dirname, '..')
dotenv.config({ path: path.join(backendDir, '.env') })

const serviceAccountPathFromEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim()
const serviceAccountPath = serviceAccountPathFromEnv
  ? (path.isAbsolute(serviceAccountPathFromEnv)
    ? serviceAccountPathFromEnv
    : path.resolve(backendDir, serviceAccountPathFromEnv))
  : path.join(backendDir, 'serviceAccountKey.json')

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

const db = admin.firestore()
const auth = admin.auth()
const ownerEmail = 'anon@lnovic.com'
const basePay = 100
const shiftDefinition = {
  shiftType: 'Full-time',
  start: '08:00',
  end: '17:00',
  notes: 'Backfilled standard full-time schedule. Weekends are off.',
  capacity: 3,
}
const employees = [
  { email: 'dina@yzcalo.com', firstName: 'Dina', role: 'Manager' },
  { email: 'jeon@ooynib.com', firstName: 'Jeon', role: 'HR' },
  { email: 'rosa@lnovic.com', firstName: 'Rosa', role: 'Finance' },
]
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const allDays = [...weekdays, 'Saturday', 'Sunday']
const activationExpiryMs = 24 * 60 * 60 * 1000

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const fullNameFor = (employee) => employee.firstName
const activationTokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex')
const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?'
  const values = crypto.randomBytes(14)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

const findAuthUserByEmail = async (email) => {
  try {
    return await auth.getUserByEmail(email)
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null
    throw error
  }
}

const findOwnerClinic = async (ownerUid) => {
  const candidates = []
  const byOwner = await db.collection('clinics').where('ownerId', '==', ownerUid).get()
  candidates.push(...byOwner.docs)
  const byId = await db.collection('clinics').doc(ownerUid).get()
  if (byId.exists && !candidates.some((entry) => entry.id === byId.id)) candidates.push(byId)
  const byBranchAdmin = await db.collection('clinics').where('branchAdminId', '==', ownerUid).get()
  candidates.push(...byBranchAdmin.docs.filter((entry) => !candidates.some((candidate) => candidate.id === entry.id)))
  return candidates[0] || null
}

const resolveExistingShift = async (branchId) => {
  const snapshot = await db.collection('shifts').where('branchId', '==', branchId).get()
  const matching = snapshot.docs.find((entry) => {
    const data = entry.data() || {}
    return data.start === shiftDefinition.start && data.end === shiftDefinition.end
  })
  return matching ? { id: matching.id, data: matching.data() || {} } : null
}

const createActivation = async ({ uid, email, name, temporaryPassword, apply }) => {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenId = activationTokenHash(token)
  const activationUrl = `${EMAIL_WEBSITE_URL}/activate-account?token=${encodeURIComponent(token)}`
  if (!apply) return { activationUrl, sent: false }

  await db.collection('accountActivations').doc(tokenId).set({
    uid,
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + activationExpiryMs),
    used: false,
  })
  await db.collection('users').doc(uid).set({
    activationTokenHash: tokenId,
    activationLastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    activationSendCount: 1,
    activationSendWindowStartedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  const postmarkToken = String(process.env.POSTMARK_API_TOKEN || '').trim()
  const sender = String(process.env.POSTMARK_SENDER || '').trim()
  if (!postmarkToken || !sender) return { activationUrl, sent: false, warning: 'Postmark is not configured.' }

  const client = new ServerClient(postmarkToken)
  await client.sendEmail({
    From: sender,
    To: email,
    Subject: 'Activate your AesthetiCare employee account',
    TextBody: `Hi ${name},\n\nYour AesthetiCare employee account is ready. Activate it here:\n${activationUrl}\n\nTemporary password: ${temporaryPassword}\n\nThe activation link expires in 24 hours and can only be used once.`,
    HtmlBody: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408"><p>Hi ${name},</p><p>Your AesthetiCare employee account is ready.</p><p><a href="${activationUrl}" style="display:inline-block;padding:12px 18px;background:#8d5a3b;color:#fff;text-decoration:none;border-radius:6px">Activate Account</a></p><p><strong>Temporary password:</strong> ${temporaryPassword}</p><p>This activation link expires in 24 hours and can only be used once.</p></div>`,
  })
  return { activationUrl, sent: true }
}

const run = async () => {
  const apply = process.argv.includes('--apply')
  const owner = await findAuthUserByEmail(ownerEmail)
  if (!owner) throw new Error(`No Firebase Auth user found for ${ownerEmail}.`)
  const ownerUserRef = db.collection('users').doc(owner.uid)
  const ownerUserSnap = await ownerUserRef.get()
  const ownerData = ownerUserSnap.exists ? ownerUserSnap.data() || {} : {}
  const clinicDoc = await findOwnerClinic(owner.uid)
  if (!clinicDoc) throw new Error(`No clinic record found for ${ownerEmail} (${owner.uid}).`)
  const clinicData = clinicDoc.data() || {}
  const branchId = clinicDoc.id
  const branchName = String(clinicData.clinicBranch || clinicData.clinicName || 'Main Branch').trim()
  const branchLocation = String(clinicData.clinicLocation || clinicData.address || '').trim()

  const shift = await resolveExistingShift(branchId)
  const shiftId = shift?.id || '(new shift)'
  const results = []

  if (apply) {
    await ownerUserRef.set({
      email: normalizeEmail(ownerData.email || owner.email),
      role: 'Clinic Admin',
      userType: 'Owner',
      clinicId: clinicDoc.id,
      branchId,
      accountBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    await clinicDoc.ref.set({ ownerId: owner.uid, branchAdminId: owner.uid }, { merge: true })
  }

  const actualShiftId = shift?.id || (apply ? db.collection('shifts').doc().id : shiftId)
  const activeShift = shift?.data || shiftDefinition
  const activeShiftLabel = `${activeShift.shiftType || shiftDefinition.shiftType} || ${activeShift.start || shiftDefinition.start} - ${activeShift.end || shiftDefinition.end}`
  if (!shift && apply) {
    await db.collection('shifts').doc(actualShiftId).set({
      ...shiftDefinition,
      branch: branchName,
      branchId,
      employees: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } else if (shift && apply) {
    await db.collection('shifts').doc(actualShiftId).set({
      capacity: Math.max(3, Number(shift.data.capacity) || 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  for (const employee of employees) {
    const email = normalizeEmail(employee.email)
    let authUser = await findAuthUserByEmail(email)
    const temporaryPassword = authUser ? '' : generateTemporaryPassword()
    if (!authUser && apply) {
      authUser = await auth.createUser({ email, password: temporaryPassword })
    }
    const uid = authUser?.uid || '(new auth user)'
    const userRef = uid.startsWith('(') ? null : db.collection('users').doc(uid)
    if (apply && userRef) {
      await userRef.set({
        firstName: employee.firstName,
        middleName: null,
        lastName: '',
        suffix: null,
        fullName: fullNameFor(employee),
        email,
        phoneNumber: '',
        role: employee.role,
        customRoleId: null,
        customRoleIds: [],
        customRoleName: null,
        effectivePermissions: [],
        employmentType: 'Full-time',
        userType: 'Staff',
        branchId,
        clinicLocation: branchLocation,
        status: 'Pending Activation',
        accountActivated: false,
        mustChangePassword: true,
        archived: false,
        basePay,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      await userRef.collection('schedules').doc('recurring').set({
        employeeId: uid,
        employeeName: fullNameFor(employee),
        employeeRole: employee.role,
        branchId,
        weekStart: null,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        recurring: true,
        type: 'recurring',
        assignments: Object.fromEntries(allDays.map((day) => [day, weekdays.includes(day) ? actualShiftId : 'Off'])),
        assignmentLabels: Object.fromEntries(allDays.map((day) => [day, weekdays.includes(day) ? activeShiftLabel : 'Off'])),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    const activation = authUser && apply
      ? await createActivation({ uid, email, name: fullNameFor(employee), temporaryPassword, apply })
      : { sent: false }
    results.push({ email, role: employee.role, uid, activationEmailSent: activation.sent, existingAuthAccount: Boolean(authUser && !temporaryPassword) })
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    owner: { email: ownerEmail, uid: owner.uid, clinicId: clinicDoc.id, clinicName: clinicData.clinicName || '', branchName },
    shift: { id: actualShiftId, reused: Boolean(shift), definition: shiftDefinition },
    basePay: { amount: basePay, currency: 'PHP', unit: 'hour' },
    employees: results,
  }, null, 2))
}

run()
  .then(() => admin.app().delete())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('Backfill failed:', error?.message || error)
    await admin.app().delete().catch(() => {})
    process.exit(1)
  })
