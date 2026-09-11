import express from 'express'
import cors from 'cors'
import { ServerClient } from 'postmark'
import dotenv from 'dotenv'
import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'
import { PassThrough } from 'node:stream'
import { google } from 'googleapis'
import vision from '@google-cloud/vision'

// firebase-admin v13 can hit a Google auth compatibility edge in some Node/runtime combinations.
// Keep the same fallback used by the backend maintenance scripts so OTP requests do not fail.
if (typeof Object.prototype.getUniverseDomain !== 'function') {
  Object.defineProperty(Object.prototype, 'getUniverseDomain', {
    value: async function getUniverseDomain() {
      return 'googleapis.com'
    },
    configurable: true,
    writable: true,
    enumerable: false,
  })
}

const app = express()
const PORT = Number(process.env.PORT || 3000)
const isDevelopment = String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production'
const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGISTRATION_OTP_EXPIRY_MINUTES = 10
const REGISTRATION_OTP_COOLDOWN_SECONDS = 60
const REGISTRATION_OTP_MAX_SENDS = 5
const REGISTRATION_OTP_SEND_WINDOW_SECONDS = 15 * 60
const REGISTRATION_ATTEMPT_MAX_PER_WINDOW = 5
const REGISTRATION_ATTEMPT_WINDOW_SECONDS = 15 * 60
const REGISTRATION_ATTEMPT_MAX_PER_DAY = 10
const REGISTRATION_ATTEMPT_DAY_SECONDS = 24 * 60 * 60
const CLINIC_REGISTRATION_OTP_PURPOSE = 'clinic-registration'
const CUSTOMER_REGISTRATION_OTP_PURPOSE = 'customer-registration'
const SUPPLIER_REGISTRATION_OTP_PURPOSE = 'supplier-registration'
const LOGIN_OTP_PURPOSE = 'login-otp'
const OTP_PATH = '/send-otp'
const REQUEST_REGISTRATION_OTP_PATH = '/auth/request-registration-otp'
const VERIFY_REGISTRATION_OTP_PATH = '/auth/verify-registration-otp'
const REQUEST_CUSTOMER_OTP_PATH = '/auth/request-customer-otp'
const VERIFY_CUSTOMER_OTP_PATH = '/auth/verify-customer-otp'
const REQUEST_SUPPLIER_OTP_PATH = '/auth/request-supplier-otp'
const VERIFY_SUPPLIER_OTP_PATH = '/auth/verify-supplier-otp'
const REQUEST_LOGIN_OTP_PATH = '/auth/request-login-otp'
const VERIFY_LOGIN_OTP_PATH = '/auth/verify-login-otp'
const CHECK_SUPPLIER_REGISTRATION_STATUS_PATH = '/auth/check-supplier-registration-status'
const CHECK_CUSTOMER_REGISTRATION_STATUS_PATH = '/auth/check-customer-registration-status'
const ATTENDANCE_PIN_PATH = '/send-attendance-pin'
const ATTENDANCE_RECORD_PATH = '/attendance/record'
const ATTENDANCE_IMPORT_PATH = '/attendance/import'
const STAFF_WELCOME_PATH = '/send-staff-welcome'
const RESET_PASSWORD_PATH = '/auth/reset-password'
const CHECK_USER_PATH = '/auth/check-user'
const CHECK_REGISTRATION_ATTEMPT_PATH = '/auth/check-registration-attempt'
const AUTO_VERIFICATION_THRESHOLD = Math.max(0.85, Math.min(1, Number(process.env.AUTO_VERIFICATION_THRESHOLD || 0.9)))
const REGISTRATION_DOCUMENT_REQUIREMENTS = {
    clinic: ['businessPermit', 'governmentIdRepresentativeFront', 'governmentIdRepresentativeBack', 'dohAccreditation', 'prcIdMedicalDirector', 'birRegistration', 'sanitaryCertificate', 'clinicLicense'],
  supplier: ['taxRegistration', 'businessRegistration'],
}
const DOCUMENT_NUMBER_REQUIREMENTS = new Set([
  'businessPermit',
  'birRegistration',
  'sanitaryCertificate',
  'clinicLicense',
  'dohAccreditation',
  'prcIdMedicalDirector',
])
const normalizeOcrComparable = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === __filename : false

// Load backend-only environment variables from otp-backend/.env.
dotenv.config({ path: path.resolve(__dirname, '.env') })

console.log("Loaded ENV:", {
  PORT: process.env.PORT,
  POSTMARK_API_TOKEN: process.env.POSTMARK_API_TOKEN ? "present" : (process.env.SENDGRID_API_KEY ? "present (from SENDGRID_API_KEY)" : "missing"),
  POSTMARK_SENDER: process.env.POSTMARK_SENDER || process.env.SENDGRID_SENDER,
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY ? "present" : "missing",
  PAYMONGO_PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY ? "present" : "missing",
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ? "present" : "missing",
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET ? "present" : "missing",
  GOOGLE_OAUTH_REFRESH_TOKEN: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ? "present" : "missing",
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || "primary",
});

const configuredCorsOrigins = new Set(
  [
    process.env.FRONTEND_BASE_URL,
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://aestheticare.online',
    'https://www.aestheticare.online',
    ...(String(process.env.CORS_ORIGINS || '').split(',')),
    ...(isDevelopment ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
  ]
    .map((value) => String(value || '').trim().replace(/\/+$/, ''))
    .filter(Boolean)
)

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests without an Origin header, but never allow
    // an arbitrary browser origin to call the API.
    if (!origin || configuredCorsOrigins.has(String(origin).trim().replace(/\/+$/, ''))) {
      return callback(null, true)
    }
    return callback(new Error('Origin is not allowed by the API.'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
}

app.use(cors(corsOptions))
app.options(/.*/, cors(corsOptions))
app.use(express.json())
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON request body',
    })
  }
  return next(error)
})

const postmarkApiToken = process.env.POSTMARK_API_TOKEN || process.env.SENDGRID_API_KEY || ''
const senderEmail = process.env.POSTMARK_SENDER || process.env.SENDGRID_SENDER || ''
const payMongoSecretKey = process.env.PAYMONGO_SECRET_KEY || ''
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
const configuredServiceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim()
const serviceAccountPath = configuredServiceAccountPath
  ? path.isAbsolute(configuredServiceAccountPath)
    ? configuredServiceAccountPath
    : path.resolve(__dirname, configuredServiceAccountPath)
  : path.join(__dirname, 'serviceAccountKey.json')
const googleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const googleOauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const googleOauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN || ''
const googleCalendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
const googleMeetDefaultTimezone = process.env.GOOGLE_MEET_DEFAULT_TIMEZONE || 'Asia/Manila'
const firebaseServiceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
const firebaseServiceAccountBase64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()

let caviteBoundaryCache = null
let caviteBoundaryCacheAt = 0
const CAVITE_BOUNDARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const postmarkClient = postmarkApiToken ? new ServerClient(postmarkApiToken) : null

const fetchCaviteBoundary = async () => {
  if (caviteBoundaryCache && Date.now() - caviteBoundaryCacheAt < CAVITE_BOUNDARY_CACHE_TTL_MS) {
    return caviteBoundaryCache
  }

  const response = await fetch(
    'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&limit=10&polygon_geojson=1&addressdetails=1&q=Province%20of%20Cavite%2C%20Philippines',
    {
      headers: {
        'User-Agent': 'AestheticCare/1.0',
        'Accept-Language': 'en',
      },
    }
  )

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(`Nominatim returned ${response.status}${responseText ? `: ${responseText}` : ''}`)
  }

  const payload = await response.json()
  const features = Array.isArray(payload) ? payload : Array.isArray(payload?.features) ? payload.features : []
  const getFeatureGeometry = (feature) => feature?.geometry || feature?.geojson || feature?.polygons_geojson || null
  const isValidGeometry = (geometry) =>
    Boolean(
      geometry &&
      typeof geometry.type === 'string' &&
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length
    )
  const getFeatureDisplayName = (feature) => {
    const properties = feature?.properties || {}
    return String(
      properties.display_name ||
      properties.displayName ||
      feature?.display_name ||
      feature?.displayName ||
      feature?.name ||
      ''
    ).toLowerCase()
  }
  const boundaryFeature =
    features.find((feature) => {
      const properties = feature?.properties || {}
      const displayName = getFeatureDisplayName(feature)
      const category = String(properties.category || '').toLowerCase()
      const type = String(properties.type || '').toLowerCase()
      return /cavite/.test(displayName) && (!category || category === 'boundary') && (!type || type === 'administrative')
    }) ||
    features.find((feature) => /cavite/i.test(getFeatureDisplayName(feature))) ||
    features.find((feature) => isValidGeometry(getFeatureGeometry(feature)))

  const boundary = getFeatureGeometry(boundaryFeature)
  if (!isValidGeometry(boundary)) {
    throw new Error('Nominatim returned an unexpected Cavite boundary payload.')
  }

  caviteBoundaryCache = boundary
  caviteBoundaryCacheAt = Date.now()
  return boundary
}

let adminReady = false
let adminInitError = ''
let firebaseProjectId = ''
let firebaseStorageBucket = ''
let googleCloudCredential = null
const backupScheduleEnabled = String(process.env.BACKUP_SCHEDULE_ENABLED || '').toLowerCase() === 'true'
const backupDailyHour = Number(process.env.BACKUP_DAILY_HOUR || 2)
const backupMonthlyDay = Number(process.env.BACKUP_MONTHLY_DAY || 1)
const backupDailyRetentionDays = Number(process.env.BACKUP_DAILY_RETENTION_DAYS || 30)
const backupMonthlyRetentionDays = Number(process.env.BACKUP_MONTHLY_RETENTION_DAYS || 365)

const normalizeServiceAccount = (serviceAccount) => {
  if (!serviceAccount || typeof serviceAccount !== 'object') return null
  const normalized = { ...serviceAccount }
  if (typeof normalized.private_key === 'string') {
    normalized.private_key = normalized.private_key.replace(/\\n/g, '\n')
  }
  delete normalized.universe_domain
  return normalized
}

const parseServiceAccountFromEnv = () => {
  try {
    if (firebaseServiceAccountJson) {
      return normalizeServiceAccount(JSON.parse(firebaseServiceAccountJson))
    }
    if (firebaseServiceAccountBase64) {
      const decoded = Buffer.from(firebaseServiceAccountBase64, 'base64').toString('utf8')
      return normalizeServiceAccount(JSON.parse(decoded))
    }
  } catch (error) {
    adminInitError = `Invalid Firebase service account env: ${error?.message || 'Unable to parse service account'}`
  }
  return null
}

try {
  const envServiceAccount = parseServiceAccountFromEnv()
  if (envServiceAccount) {
    googleCloudCredential = envServiceAccount
    firebaseProjectId = String(
      envServiceAccount?.project_id ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      ''
    ).trim()
    firebaseStorageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      String(envServiceAccount?.storageBucket || '').trim() ||
      (firebaseProjectId ? `${firebaseProjectId}.firebasestorage.app` : '') ||
      (firebaseProjectId ? `${firebaseProjectId}.appspot.com` : '')
    admin.initializeApp({
      credential: admin.credential.cert(envServiceAccount),
      ...(firebaseProjectId ? { projectId: firebaseProjectId } : {}),
      ...(firebaseStorageBucket ? { storageBucket: firebaseStorageBucket } : {}),
    })
  } else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccountRaw = fs.readFileSync(serviceAccountPath, 'utf8')
    const serviceAccount = normalizeServiceAccount(JSON.parse(serviceAccountRaw))
    googleCloudCredential = serviceAccount
    firebaseProjectId = String(serviceAccount?.project_id || '').trim()
    firebaseStorageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      String(serviceAccount?.storageBucket || '').trim() ||
      (firebaseProjectId ? `${firebaseProjectId}.firebasestorage.app` : '') ||
      (firebaseProjectId ? `${firebaseProjectId}.appspot.com` : '')
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(firebaseStorageBucket ? { storageBucket: firebaseStorageBucket } : {}),
    })
  } else {
    firebaseProjectId = String(
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      ''
    ).trim()
    firebaseStorageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      (firebaseProjectId ? `${firebaseProjectId}.firebasestorage.app` : '') ||
      (firebaseProjectId ? `${firebaseProjectId}.appspot.com` : '')
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(firebaseProjectId ? { projectId: firebaseProjectId } : {}),
      ...(firebaseStorageBucket ? { storageBucket: firebaseStorageBucket } : {}),
    })
  }
  adminReady = true
  console.log('firebase-admin initialized:', {
    serviceAccountSource: envServiceAccount ? 'env' : (fs.existsSync(serviceAccountPath) ? 'file' : 'application-default'),
    serviceAccountPath: envServiceAccount ? null : (fs.existsSync(serviceAccountPath) ? serviceAccountPath : null),
    usingApplicationDefaultCredentials: !envServiceAccount && !fs.existsSync(serviceAccountPath),
    firebaseProjectId,
    firebaseStorageBucket,
  })
} catch (error) {
  adminReady = false
  adminInitError = error?.message || 'Failed to initialize firebase-admin'
  console.error('firebase-admin init error:', adminInitError)
}

const buildPayMongoHeaders = () => ({
  accept: 'application/json',
  'content-type': 'application/json',
  Authorization: `Basic ${Buffer.from(`${payMongoSecretKey}:`).toString('base64')}`,
})

const assertPayMongoConfigured = (res) => {
  if (payMongoSecretKey) return true
  res.status(500).json({
    success: false,
    error: 'PAYMONGO_SECRET_KEY is missing',
  })
  return false
}

const isGoogleMeetConfigured = () =>
  Boolean(googleOauthClientId && googleOauthClientSecret && googleOauthRefreshToken)

const getGoogleCalendarClient = () => {
  const oauth2Client = new google.auth.OAuth2(googleOauthClientId, googleOauthClientSecret)
  oauth2Client.setCredentials({ refresh_token: googleOauthRefreshToken })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

const sendPostmarkMessage = async (message) => {
  if (!postmarkClient) return { statusCode: null, messageId: null }
  const response = await postmarkClient.sendEmail({
    From: senderEmail,
    To: message.to,
    Subject: message.subject,
    TextBody: message.text,
    HtmlBody: message.html,
  })
  return {
    statusCode: response?.ErrorCode === 0 ? 200 : response?.ErrorCode || null,
    messageId: response?.MessageID || null,
  }
}

// Vision must use the same explicit credentials as Firebase Admin. Creating a
// Vision client without options makes google-auth-library search for ADC and
// can crash the backend on startup when ADC is not configured locally.
const createVisionClient = () => {
  if (!firebaseStorageBucket || !googleCloudCredential?.client_email || !googleCloudCredential?.private_key) {
    return null
  }

  return new vision.ImageAnnotatorClient({
    projectId: firebaseProjectId || googleCloudCredential.project_id,
    credentials: {
      client_email: googleCloudCredential.client_email,
      private_key: googleCloudCredential.private_key,
    },
  })
}

const formatPhilippineCurrency = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    currencyDisplay: 'code',
  }).format(Number(value || 0))

const maskLogValue = (value, visible = 6) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.length <= visible) return raw
  return `${'*'.repeat(Math.max(0, raw.length - visible))}${raw.slice(-visible)}`
}

const logPayMongoEvent = (event, details = {}) => {
  console.log(`[PayMongo] ${event}`, details)
}

const isPayMongoPaidAppointment = (appointmentData = {}) => {
  const paymentId = String(appointmentData.paymongoPaymentId || '').trim()
  const paymentStatus = String(appointmentData.paymentStatus || '').trim().toLowerCase()
  const source = String(appointmentData.source || '').trim().toLowerCase()
  return Boolean(paymentId) && paymentStatus === 'paid' && source === 'paymongo_checkout'
}

const getAppointmentCustomerProfile = async (firestore, appointmentData = {}) => {
  const customerId = String(appointmentData.customerId || '').trim()
  let customerSnap = null

  if (customerId) {
    customerSnap = await firestore.collection('users').doc(customerId).get()
  }

  const customerData = customerSnap?.exists ? customerSnap.data() || {} : {}
  const customerEmail = String(customerData.email || appointmentData.customerEmail || '').trim().toLowerCase()
  const customerName =
    String(appointmentData.customerName || customerData.fullName || '').trim() ||
    `${String(customerData.firstName || '').trim()} ${String(customerData.lastName || '').trim()}`.trim() ||
    customerEmail ||
    'Customer'

  return {
    customerId,
    customerData,
    customerEmail,
    customerName,
  }
}

const normalizeClientPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('63') && digits.length > 2) return `+${digits}`
  if (digits.length === 10 && digits.startsWith('9')) return `+63${digits}`
  return digits.startsWith('+') ? digits : `+${digits}`
}

const upsertBranchClientFromAppointment = async (firestore, {
  branchId,
  appointmentData = {},
  customerProfile = {},
  createdBy = '',
} = {}) => {
  const normalizedBranchId = String(branchId || appointmentData.branchId || '').trim()
  const customerId = String(customerProfile.customerId || appointmentData.customerId || '').trim()
  const customerEmail = String(customerProfile.customerEmail || appointmentData.customerEmail || '').trim().toLowerCase()
  const customerPhone = normalizeClientPhone(
    customerProfile.customerData?.contactNumber ||
    customerProfile.customerData?.phone ||
    appointmentData.customerPhone ||
    appointmentData.phone ||
    ''
  )
  const customerName = String(customerProfile.customerName || appointmentData.customerName || appointmentData.clientName || 'Customer').trim() || 'Customer'
  const [firstName, ...rest] = customerName.split(/\s+/)
  const lastName = rest.join(' ').trim()
  const clientsCol = firestore.collection('clients')

  const matchers = []
  if (customerId) {
    matchers.push(clientsCol.where('branchId', '==', normalizedBranchId).where('customerId', '==', customerId))
  }
  if (customerEmail) {
    matchers.push(clientsCol.where('branchId', '==', normalizedBranchId).where('email', '==', customerEmail))
  }
  if (customerPhone) {
    matchers.push(clientsCol.where('branchId', '==', normalizedBranchId).where('phone', '==', customerPhone))
  }

  let existingSnap = null
  for (const matcher of matchers) {
    const snap = await matcher.limit(1).get()
    if (!snap.empty) {
      existingSnap = snap.docs[0]
      break
    }
  }

  const payload = {
    firstName: firstName || customerName,
    lastName,
    fullName: customerName,
    email: customerEmail,
    phone: customerPhone,
    branchId: normalizedBranchId,
    customerId,
    source: 'appointment',
    status: 'Active',
    createdBy: String(createdBy || appointmentData.createdBy || customerId || '').trim(),
    lastAppointmentId: String(appointmentData.id || '').trim(),
    lastAppointmentAt: appointmentData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  if (existingSnap?.ref) {
    await existingSnap.ref.set(payload, { merge: true })
    return { id: existingSnap.id, updated: true }
  }

  const createdRef = await clientsCol.add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { id: createdRef.id, created: true }
}

const getAppointmentBranchName = async (firestore, branchId, fallback = 'Clinic') => {
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId) return fallback

  const snap = await firestore.collection('clinics').doc(normalizedBranchId).get()
  if (!snap.exists) return fallback

  const data = snap.data() || {}
  return String(data.clinicName || data.clinicBranch || fallback).trim() || fallback
}

const normalizeBackfillLookupKey = (value) => String(value || '').trim().toLowerCase()

const getBackfillAppointmentLookupKeys = (appointment = {}) => {
  const keys = [
    appointment.customerId,
    appointment.clientId,
    appointment.patientId,
    appointment.customerEmail,
    appointment.clientEmail,
    appointment.patientEmail,
    appointment.email,
    appointment.customerPhone,
    appointment.clientPhone,
    appointment.patientPhone,
    appointment.phone,
    appointment.customerName,
    appointment.clientName,
    appointment.patientName,
    appointment.id,
  ]
    .map(normalizeBackfillLookupKey)
    .filter(Boolean)

  return [...new Set(keys)]
}

const getBackfillAppointmentSortValue = (appointment = {}) => {
  const candidate = appointment.createdAt || appointment.paidAt || appointment.completedAt || appointment.updatedAt || appointment.date || null
  if (!candidate) return 0
  if (typeof candidate?.toMillis === 'function') return candidate.toMillis()
  if (typeof candidate?.toDate === 'function') return candidate.toDate().getTime()
  if (typeof candidate === 'number') return candidate
  if (typeof candidate === 'string') {
    const parsed = Date.parse(candidate)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

const runClientContactBackfill = async (firestore) => {
  const [appointmentsSnapshot, clientsSnapshot] = await Promise.all([
    firestore.collection('appointments').get(),
    firestore.collection('clients').get(),
  ])

  const appointments = []
  const appointmentUpdates = []

  for (const docSnap of appointmentsSnapshot.docs) {
    const original = docSnap.data() || {}
    const appointment = { id: docSnap.id, ...original }
    let customerProfile = null

    if (String(appointment.customerId || '').trim()) {
      try {
        customerProfile = await getAppointmentCustomerProfile(firestore, appointment)
      } catch (error) {
        console.warn('Client backfill customer lookup failed:', error?.message || error)
      }
    }

    const updates = {}
    const profileEmail = String(customerProfile?.customerEmail || '').trim().toLowerCase()
    const profileName = String(customerProfile?.customerName || '').trim()
    const profilePhone = normalizeClientPhone(
      customerProfile?.customerData?.contactNumber ||
      customerProfile?.customerData?.phone ||
      ''
    )

    if (profileEmail && !String(appointment.customerEmail || '').trim()) updates.customerEmail = profileEmail
    if (profileEmail && !String(appointment.clientEmail || '').trim()) updates.clientEmail = profileEmail
    if (profileName && !String(appointment.customerName || '').trim()) updates.customerName = profileName
    if (profileName && !String(appointment.clientName || '').trim()) updates.clientName = profileName
    if (profilePhone && !String(appointment.customerPhone || '').trim()) updates.customerPhone = profilePhone
    if (profilePhone && !String(appointment.clientPhone || '').trim()) updates.clientPhone = profilePhone

    if (Object.keys(updates).length) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
      appointmentUpdates.push(docSnap.ref.update(updates))
      appointments.push({ ...appointment, ...updates })
    } else {
      appointments.push(appointment)
    }
  }

  if (appointmentUpdates.length) {
    await Promise.all(appointmentUpdates)
  }

  const appointmentIndex = new Map()
  appointments.forEach((appointment) => {
    const branchId = String(appointment.branchId || '').trim()
    if (!branchId) return
    for (const lookupKey of getBackfillAppointmentLookupKeys(appointment)) {
      const mapKey = `${branchId}::${lookupKey}`
      const existing = appointmentIndex.get(mapKey)
      if (!existing) {
        appointmentIndex.set(mapKey, appointment)
        continue
      }

      const currentScore = getBackfillAppointmentSortValue(existing)
      const nextScore = getBackfillAppointmentSortValue(appointment)
      if (nextScore >= currentScore) {
        appointmentIndex.set(mapKey, appointment)
      }
    }
  })

  let scanned = 0
  let updated = 0
  let skipped = 0

  for (const docSnap of clientsSnapshot.docs) {
    scanned += 1
    const client = docSnap.data() || {}
    const branchId = String(client.branchId || '').trim()
    const lookupKeys = [
      client.customerId,
      client.email,
      client.phone,
      client.fullName,
      `${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim(),
      docSnap.id,
    ]
      .map(normalizeBackfillLookupKey)
      .filter(Boolean)

    let matchedAppointment = null
    for (const lookupKey of lookupKeys) {
      const candidate = appointmentIndex.get(`${branchId}::${lookupKey}`)
      if (candidate) {
        matchedAppointment = candidate
        break
      }
    }

    if (!matchedAppointment) {
      skipped += 1
      continue
    }

    const appointmentName = String(
      matchedAppointment.customerName ||
      matchedAppointment.clientName ||
      matchedAppointment.patientName ||
      ''
    ).trim()
    const appointmentEmail = String(
      matchedAppointment.customerEmail ||
      matchedAppointment.clientEmail ||
      matchedAppointment.patientEmail ||
      matchedAppointment.email ||
      ''
    ).trim().toLowerCase()
    const appointmentPhone = normalizeClientPhone(
      matchedAppointment.customerPhone ||
      matchedAppointment.clientPhone ||
      matchedAppointment.patientPhone ||
      matchedAppointment.phone ||
      ''
    )
    const clientFullName = String(
      client.fullName ||
      `${String(client.firstName || '').trim()} ${String(client.lastName || '').trim()}`.trim() ||
      appointmentName ||
      'Customer'
    ).trim() || 'Customer'
    const [firstName, ...rest] = clientFullName.split(/\s+/)
    const lastName = rest.join(' ').trim()

    const updates = {}

    if (!String(client.fullName || '').trim() && clientFullName) updates.fullName = clientFullName
    if (!String(client.firstName || '').trim() && firstName) updates.firstName = firstName
    if (!String(client.lastName || '').trim() && lastName) updates.lastName = lastName
    if (!String(client.email || '').trim() && appointmentEmail) updates.email = appointmentEmail
    if (!String(client.phone || '').trim() && appointmentPhone) updates.phone = appointmentPhone
    if (!String(client.customerId || '').trim() && String(matchedAppointment.customerId || '').trim()) {
      updates.customerId = String(matchedAppointment.customerId || '').trim()
    }
    if (!String(client.source || '').trim()) updates.source = 'appointment'
    if (!String(client.lastAppointmentId || '').trim() && String(matchedAppointment.id || '').trim()) {
      updates.lastAppointmentId = String(matchedAppointment.id || '').trim()
    }
    if (!client.lastAppointmentAt) {
      updates.lastAppointmentAt = matchedAppointment.createdAt || matchedAppointment.paidAt || matchedAppointment.completedAt || matchedAppointment.updatedAt || matchedAppointment.date || admin.firestore.FieldValue.serverTimestamp()
    }

    if (!Object.keys(updates).length) {
      skipped += 1
      continue
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    updates.backfilledAt = admin.firestore.FieldValue.serverTimestamp()

    await docSnap.ref.set(updates, { merge: true })
    updated += 1
  }

  return { scannedAppointments: appointments.length, scannedClients: scanned, updatedAppointments: appointmentUpdates.length, updatedClients: updated, skippedClients: skipped }
}

const getStaffDisplayName = (userData = {}) =>
  String(userData.fullName || '').trim() ||
  `${String(userData.firstName || '').trim()} ${String(userData.lastName || '').trim()}`.trim() ||
  'Clinic Staff'

const sendAppointmentDecisionEmail = async ({
  recipient,
  customerName,
  branchName,
  appointmentLabel,
  requestType,
  refundAmount,
  commissionAmount,
  isPayMongoPaid,
  appointmentDate,
  appointmentTime,
}) => {
  const normalizedRecipient = String(recipient || '').trim().toLowerCase()
  if (!normalizedRecipient) {
    return { skipped: true, reason: 'Missing recipient email' }
  }

  if (!postmarkClient || !senderEmail) {
    return { skipped: true, reason: 'Postmark not configured' }
  }

  const safeCustomerName = String(customerName || 'Customer').trim() || 'Customer'
  const safeBranchName = String(branchName || 'Clinic').trim() || 'Clinic'
  const safeAppointmentLabel = String(appointmentLabel || 'appointment').trim() || 'appointment'
  const safeDate = String(appointmentDate || '').trim()
  const safeTime = String(appointmentTime || '').trim()
  const timingText = 'The refund may take 3 to 5 business days to reflect, depending on your bank or payment method.'
  const refundSummary = isPayMongoPaid
    ? refundAmount > 0
      ? `We initiated a refund of ${formatPhilippineCurrency(refundAmount)}. The platform commission of ${formatPhilippineCurrency(commissionAmount)} is non-refundable and was retained according to platform policy.`
      : 'No refundable amount remained after excluding the non-refundable platform commission.'
    : 'No online refund was available for this appointment.'
  const subject =
    requestType === 'cancel'
      ? 'Your appointment cancellation was approved and refund processing started'
      : 'Your appointment reschedule was approved'

  const intro =
    requestType === 'cancel'
      ? `Hi ${safeCustomerName}, your cancellation request for ${safeAppointmentLabel} was approved by ${safeBranchName}.`
      : `Hi ${safeCustomerName}, your reschedule request for ${safeAppointmentLabel} was approved by ${safeBranchName}.`

  const scheduleLine = safeDate || safeTime
    ? `<p><strong>New schedule:</strong> ${[safeDate, safeTime].filter(Boolean).join(' ')}</p>`
    : ''
  const text =
    `${intro}\n\n` +
    `${refundSummary}\n` +
    `${timingText}\n\n` +
    (safeDate || safeTime ? `Schedule: ${[safeDate, safeTime].filter(Boolean).join(' ')}\n\n` : '') +
    `If you have questions, please contact the clinic.`

  const message = {
    to: normalizedRecipient,
    from: senderEmail,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
        <p>${intro}</p>
        <p>${refundSummary}</p>
        <p>${timingText}</p>
        ${scheduleLine}
        <p>If you have questions, please contact the clinic.</p>
      </div>
    `,
  }

  const delivery = await sendPostmarkMessage(message)
  return { skipped: false, delivery }
}

const createAppointmentNotification = async ({
  firestore,
  customerId,
  title,
  message,
  link = '/customer/appointments',
}) => {
  const normalizedCustomerId = String(customerId || '').trim()
  if (!normalizedCustomerId) {
    return { skipped: true, reason: 'Missing customer id' }
  }

  await firestore.collection('notifications').add({
    recipientUserId: normalizedCustomerId,
    title: String(title || 'Notification').trim() || 'Notification',
    message: String(message || '').trim(),
    link,
    read: false,
    deleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { skipped: false }
}

const extractProviderError = (error) =>
  error?.Message ||
  error?.response?.body?.errors?.[0]?.message ||
  error?.response?.body?.errors?.[0]?.field ||
  error?.message ||
  'Unknown email provider error'

const generateSixDigitOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

const getRegistrationOtpDocRef = (purpose, email) =>
  admin.firestore().collection('registration_otps').doc(`${String(purpose || '').trim()}:${String(email || '').trim().toLowerCase()}`)

const getAuthUserByEmail = async (email) => {
  try {
    return await admin.auth().getUserByEmail(email)
  } catch (error) {
    if (String(error?.code || '') === 'auth/user-not-found') {
      return null
    }
    throw error
  }
}

const getUserDocByEmail = async (firestore, email) => {
  const snap = await firestore
    .collection('users')
    .where('email', '==', email)
    .limit(1)
    .get()

  return snap.empty ? null : snap.docs[0]
}

const getCustomerRegistrationState = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const firestore = admin.firestore()
  const authUser = await getAuthUserByEmail(normalizedEmail)

  let uid = String(authUser?.uid || '').trim()
  let userSnap = null

  if (uid) {
    const directUserSnap = await firestore.collection('users').doc(uid).get()
    if (directUserSnap.exists) {
      userSnap = directUserSnap
    }
  }

  if (!userSnap) {
    userSnap = await getUserDocByEmail(firestore, normalizedEmail)
    if (userSnap?.id && !uid) {
      uid = userSnap.id
    }
  }

  const userData = userSnap?.data?.() || {}
  const role = String(userData.role || userData.userType || '').trim()
  const status = String(userData.status || '').trim()
  const emailVerified = Boolean(userData.emailVerified || authUser?.emailVerified)

  return {
    exists: Boolean(authUser || userSnap),
    uid,
    authUser,
    userSnap,
    userData,
    role,
    status,
    emailVerified,
  }
}

const getSupplierRegistrationState = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const firestore = admin.firestore()
  const authUser = await getAuthUserByEmail(normalizedEmail)

  let uid = String(authUser?.uid || '').trim()
  let userSnap = null

  if (uid) {
    const directUserSnap = await firestore.collection('users').doc(uid).get()
    if (directUserSnap.exists) {
      userSnap = directUserSnap
    }
  }

  if (!userSnap) {
    userSnap = await getUserDocByEmail(firestore, normalizedEmail)
    if (userSnap?.id && !uid) {
      uid = userSnap.id
    }
  }

  const userData = userSnap?.data?.() || {}
  const role = String(userData.role || userData.userType || '').trim()
  const status = String(userData.status || '').trim()
  const approvalStatus = String(userData.approvalStatus || '').trim()
  const emailVerified = Boolean(userData.emailVerified || authUser?.emailVerified)

  return {
    exists: Boolean(authUser || userSnap),
    uid,
    authUser,
    userSnap,
    userData,
    role,
    status,
    approvalStatus,
    emailVerified,
  }
}

const hashOtp = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex')

const otpMatches = (otpData, candidate) => {
  const expectedHash = String(otpData?.otpHash || '').trim()
  if (expectedHash) {
    const actualHash = hashOtp(candidate)
    const expectedBuffer = Buffer.from(expectedHash, 'hex')
    const actualBuffer = Buffer.from(actualHash, 'hex')
    return expectedBuffer.length === actualBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  }

  // Records without a hash are invalid. This prevents legacy plaintext OTP
  // records from remaining usable after the secure storage migration.
  return false
}

const sendRegistrationOtpMessage = async ({
  email,
  uid,
  purpose,
}) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  const otpRef = getRegistrationOtpDocRef(purpose, normalizedEmail)
  const reservation = await admin.firestore().runTransaction(async (transaction) => {
    const existingSnap = await transaction.get(otpRef)
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {}
    const now = new Date()
    const lastSentAt = getTimestampDate(existingData.lastSentAt)
    const secondsSinceLastSend = lastSentAt
      ? Math.floor((now.getTime() - lastSentAt.getTime()) / 1000)
      : Number.POSITIVE_INFINITY
    const sendWindowStartedAt = getTimestampDate(existingData.sendWindowStartedAt)
    const secondsSinceWindowStart = sendWindowStartedAt
      ? Math.floor((now.getTime() - sendWindowStartedAt.getTime()) / 1000)
      : Number.POSITIVE_INFINITY
    const sendCountInWindow = secondsSinceWindowStart >= REGISTRATION_OTP_SEND_WINDOW_SECONDS
      ? 0
      : Math.max(Number(existingData.sendCount || 0), 0)

    if (sendCountInWindow >= REGISTRATION_OTP_MAX_SENDS) {
      const retryAfterSeconds = Math.max(
        REGISTRATION_OTP_SEND_WINDOW_SECONDS - Math.max(secondsSinceWindowStart, 0),
        1
      )
      const limitError = new Error(`You have reached the OTP request limit. Please try again in ${retryAfterSeconds}s.`)
      limitError.statusCode = 429
      limitError.retryAfterSeconds = retryAfterSeconds
      limitError.maxAttempts = REGISTRATION_OTP_MAX_SENDS
      throw limitError
    }

    if (secondsSinceLastSend < REGISTRATION_OTP_COOLDOWN_SECONDS) {
      const retryAfterSeconds = Math.max(REGISTRATION_OTP_COOLDOWN_SECONDS - secondsSinceLastSend, 1)
      const rateLimitError = new Error(`Please wait ${retryAfterSeconds}s before requesting a new OTP.`)
      rateLimitError.statusCode = 429
      rateLimitError.retryAfterSeconds = retryAfterSeconds
      throw rateLimitError
    }

    const otp = generateSixDigitOtp()
    const expiresAt = new Date(now.getTime() + REGISTRATION_OTP_EXPIRY_MINUTES * 60 * 1000)
    transaction.set(otpRef, {
      email: normalizedEmail,
      uid: normalizedUid || String(existingData.uid || '').trim(),
      purpose,
      otpHash: hashOtp(otp),
      otp: admin.firestore.FieldValue.delete(),
      used: false,
      attempts: 0,
      messageId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      sendCount: sendCountInWindow + 1,
      sendWindowStartedAt: sendWindowStartedAt && secondsSinceWindowStart < REGISTRATION_OTP_SEND_WINDOW_SECONDS
        ? existingData.sendWindowStartedAt
        : admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      deliveryStatus: 'pending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return { existingData, otp, expiresAt }
  })

  const { existingData, otp, expiresAt } = reservation
  const message = {
    to: normalizedEmail,
    from: senderEmail,
    subject: 'Your OTP Code',
    text:
      `Your one-time password is: ${otp}\n\n` +
      `This code is only valid for ${REGISTRATION_OTP_EXPIRY_MINUTES} minutes. ` +
      `It expires after that time. ` +
      `Only the most recent OTP will work.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
        <p>Your one-time password is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p>
        <p>This code is only valid for ${REGISTRATION_OTP_EXPIRY_MINUTES} minutes.</p>
        <p>It expires after that time.</p>
        <p><strong>Only the most recent OTP will work.</strong></p>
      </div>
    `,
  }

  const delivery = await sendPostmarkMessage(message)

  // If delivery indicates failure, and this is a registration OTP, attempt server-side cleanup
  if (!delivery || delivery.statusCode !== 200) {
    console.error('OTP delivery failed', { delivery, normalizedEmail, normalizedUid, purpose })
    await otpRef.set({
      deliveryStatus: 'failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch((statusError) => {
      console.error('Failed to update OTP delivery status:', statusError)
    })
    try {
      if (
        (purpose === CLINIC_REGISTRATION_OTP_PURPOSE || purpose === CUSTOMER_REGISTRATION_OTP_PURPOSE) &&
        (normalizedUid || existingData.uid)
      ) {
        const resolvedUid = String(normalizedUid || existingData.uid || '').trim()
        if (resolvedUid) {
          const firestore = admin.firestore()
          const userRef = firestore.collection('users').doc(resolvedUid)
          const clinicRef = firestore.collection('clinics').doc(resolvedUid)
          const [userSnap, clinicSnap] = await Promise.all([userRef.get(), clinicRef.get()])
          const userData = userSnap.exists ? userSnap.data() || {} : {}
          const now = new Date()
          const createdAt = userData.createdAt && typeof userData.createdAt.toDate === 'function'
            ? userData.createdAt.toDate()
            : userData.createdAt ? new Date(userData.createdAt) : null

          const isRecent = createdAt ? (now.getTime() - createdAt.getTime()) <= (15 * 60 * 1000) : false
          const isPendingStatus = String(userData.status || '').toLowerCase().includes('pending')

          if (isRecent || isPendingStatus) {
            // best-effort delete user docs and Auth record
            await Promise.allSettled([
              userRef.delete(),
              clinicRef.delete(),
              admin.auth().deleteUser(resolvedUid),
            ])
            console.log('Performed server-side cleanup for failed OTP delivery', { uid: resolvedUid })
          } else {
            console.log('Skipping server-side cleanup: user is not recent or not pending', { uid: resolvedUid, isRecent, isPendingStatus })
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Error during server-side cleanup after OTP failure', cleanupErr)
    }

    const err = new Error('Failed to deliver OTP')
    err.statusCode = 500
    throw err
  }

  await otpRef.set({
    messageId: delivery.messageId || null,
    deliveryStatus: 'sent',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  return {
    delivery,
    expiresAt,
    expiresInSeconds: REGISTRATION_OTP_EXPIRY_MINUTES * 60,
    retryAfterSeconds: REGISTRATION_OTP_COOLDOWN_SECONDS,
  }
}

const getTimestampDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const hashRateLimitKey = (value) => crypto
  .createHash('sha256')
  .update(String(value || '').trim().toLowerCase())
  .digest('hex')

const getRequestIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwardedFor || String(req.ip || req.socket?.remoteAddress || 'unknown').trim()
}

const recordRegistrationAttempt = async ({ email, purpose, ip }) => {
  const firestore = admin.firestore()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPurpose = String(purpose || '').trim().toLowerCase()
  const emailRef = firestore.collection('registrationRateLimits').doc(
    `email-${hashRateLimitKey(`${normalizedPurpose}:${normalizedEmail}`)}`
  )
  const ipRef = firestore.collection('registrationRateLimits').doc(
    `ip-${hashRateLimitKey(`${normalizedPurpose}:${ip}`)}`
  )
  const now = Date.now()

  return firestore.runTransaction(async (transaction) => {
    const [emailSnap, ipSnap] = await Promise.all([
      transaction.get(emailRef),
      transaction.get(ipRef),
    ])

    const getState = (snapshot) => {
      const data = snapshot.exists ? snapshot.data() || {} : {}
      const windowStartedAt = getTimestampDate(data.windowStartedAt)
      const dayStartedAt = getTimestampDate(data.dayStartedAt)
      const windowActive = windowStartedAt && (now - windowStartedAt.getTime()) < REGISTRATION_ATTEMPT_WINDOW_SECONDS * 1000
      const dayActive = dayStartedAt && (now - dayStartedAt.getTime()) < REGISTRATION_ATTEMPT_DAY_SECONDS * 1000
      return {
        windowCount: windowActive ? Math.max(Number(data.windowCount || 0), 0) : 0,
        windowStartedAt: windowActive ? windowStartedAt : new Date(now),
        dayCount: dayActive ? Math.max(Number(data.dayCount || 0), 0) : 0,
        dayStartedAt: dayActive ? dayStartedAt : new Date(now),
      }
    }

    const emailState = getState(emailSnap)
    const ipState = getState(ipSnap)
    const windowBlocked = emailState.windowCount >= REGISTRATION_ATTEMPT_MAX_PER_WINDOW
      || ipState.windowCount >= REGISTRATION_ATTEMPT_MAX_PER_WINDOW
    const dayBlocked = emailState.dayCount >= REGISTRATION_ATTEMPT_MAX_PER_DAY
      || ipState.dayCount >= REGISTRATION_ATTEMPT_MAX_PER_DAY

    if (windowBlocked || dayBlocked) {
      const retryAfterSeconds = dayBlocked
        ? Math.max(
          REGISTRATION_ATTEMPT_DAY_SECONDS - Math.floor((now - Math.min(
            emailState.dayStartedAt.getTime(),
            ipState.dayStartedAt.getTime()
          )) / 1000),
          1
        )
        : Math.max(
          REGISTRATION_ATTEMPT_WINDOW_SECONDS - Math.floor((now - Math.min(
            emailState.windowStartedAt.getTime(),
            ipState.windowStartedAt.getTime()
          )) / 1000),
          1
        )
      return {
        allowed: false,
        retryAfterSeconds,
        error: dayBlocked
          ? 'Too many registration attempts today. Please try again later.'
          : 'Too many registration attempts. Please try again in a few minutes.',
      }
    }

    const nextState = (state) => ({
      windowCount: state.windowCount + 1,
      windowStartedAt: admin.firestore.Timestamp.fromDate(state.windowStartedAt),
      dayCount: state.dayCount + 1,
      dayStartedAt: admin.firestore.Timestamp.fromDate(state.dayStartedAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    transaction.set(emailRef, { purpose: normalizedPurpose, keyType: 'email', ...nextState(emailState) }, { merge: true })
    transaction.set(ipRef, { purpose: normalizedPurpose, keyType: 'ip', ...nextState(ipState) }, { merge: true })
    return { allowed: true }
  })
}

const maskEmailAddress = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return normalized
  const [localPart, domain] = normalized.split('@')
  if (!localPart || !domain) return normalized
  const visiblePrefix = localPart.slice(0, 2)
  const hiddenLength = Math.max(localPart.length - visiblePrefix.length, 2)
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}@${domain}`
}

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '')

const resolveFrontendBaseUrl = (req) => {
  const configured = trimTrailingSlash(frontendBaseUrl)
  if (configured && !configured.includes('localhost')) return configured

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim()
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(req?.headers?.host || '').trim()
  const protocol = forwardedProto || (req?.protocol ? String(req.protocol).trim() : '')

  if (host && protocol) {
    return `${protocol}://${host}`
  }

  return configured || 'http://localhost:5173'
}

const requireAuth = async (req, res, next) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }
  const authHeader = String(req.headers?.authorization || '').trim()
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!tokenMatch) {
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
    })
  }
  try {
    const decoded = await admin.auth().verifyIdToken(tokenMatch[1])
    req.user = decoded
    return next()
  } catch (error) {
    console.warn('Firebase ID token verification failed:', error?.code || 'unknown', error?.message || 'unknown error')
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization token',
    })
  }
}

const optionalAuth = async (req, res, next) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }
  const authHeader = String(req.headers?.authorization || '').trim()
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!tokenMatch) {
    return next()
  }
  try {
    const decoded = await admin.auth().verifyIdToken(tokenMatch[1])
    req.user = decoded
    return next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization token',
    })
  }
}

const requireRole = (roles = []) => async (req, res, next) => {
  const uid = req.user?.uid
  if (!uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  try {
    const snap = await admin.firestore().collection('users').doc(uid).get()
    const data = snap.exists ? snap.data() || {} : {}
    const role = String(data.role || data.userType || '').trim().toLowerCase()
    const allowed = roles.map((r) => String(r).trim().toLowerCase())
    if (!allowed.includes(role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    return next()
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to verify role' })
  }
}

const normalizeRoleKey = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '')
  if (compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Owner'
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  if (compact === 'hr') return 'HR'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const loadUserContext = async (uid) => {
  const firestore = admin.firestore()
  const userSnap = await firestore.collection('users').doc(uid).get()
  const userData = userSnap.exists ? userSnap.data() || {} : {}
  const roleKey = normalizeRoleKey(userData.role || userData.userType || '')
  let rolePermissions = []
  if (roleKey) {
    const roleSnap = await firestore.collection('rolePermissions').doc(roleKey).get()
    const roleData = roleSnap.exists ? roleSnap.data() || {} : {}
    rolePermissions = Array.isArray(roleData.permissions) ? roleData.permissions : []
  }
  const customRoleIds = [
    ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
    userData.customRoleId,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
  const customRolePermissions = []
  if (customRoleIds.length) {
    const customRoleSnaps = await Promise.all(
      customRoleIds.map((roleId) => firestore.collection('clinicRoles').doc(roleId).get())
    )
    customRoleSnaps.forEach((roleSnap) => {
      const roleData = roleSnap.exists ? roleSnap.data() || {} : {}
      if (Array.isArray(roleData.permissions)) {
        customRolePermissions.push(...roleData.permissions)
      }
    })
  }
  const userPermissions = [
    ...(Array.isArray(userData.permissions) ? userData.permissions : []),
    ...(Array.isArray(userData.effectivePermissions) ? userData.effectivePermissions : []),
  ]
  // Existing system administrators were created before system-admin RBAC was added.
  // Keep those legacy accounts functional until an explicit adminRole is assigned.
  if (roleKey === 'Superadmin' && !userData.adminRole && !userPermissions.length && !rolePermissions.length) {
    userPermissions.push('administrator:full_access')
  }
  return {
    uid,
    roleKey,
    userData,
    permissions: new Set([...userPermissions, ...rolePermissions, ...customRolePermissions]),
  }
}

const requirePermission = (permission) => async (req, res, next) => {
  const uid = req.user?.uid
  if (!uid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  try {
    if (!req.userContext || req.userContext.uid !== uid) {
      req.userContext = await loadUserContext(uid)
    }
    const allowed = req.userContext.permissions.has(permission)
      || req.userContext.permissions.has('administrator:full_access')
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    return next()
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to verify permission' })
  }
}

// Keep platform audit records independent from a clinic branch. Audit failures
// must never prevent the protected operation itself from completing.
const writeSystemAdminActivity = async (req, {
  action,
  module = 'System Administration',
  details = '',
  targetId = null,
  targetName = null,
  success = true,
} = {}) => {
  try {
    const actorId = req.user?.uid
    if (!actorId) return

    const userSnap = await admin.firestore().collection('users').doc(actorId).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const actorName = userData.fullName
      || `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
      || req.user.email
      || 'System Administrator'

    await admin.firestore().collection('activities').add({
      action,
      details,
      module,
      actorId,
      actorName,
      actorEmail: userData.email || req.user.email || '',
      actorRole: userData.role || 'Superadmin',
      actorUserType: userData.userType || 'systemadmin',
      branchId: null,
      ownerId: null,
      targetId,
      targetName,
      success,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (auditError) {
    console.warn('System administrator activity log failed:', auditError?.message || auditError)
  }
}

const manilaDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const manilaTimeLabel = (date = new Date()) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)

const parseCsvLine = (line) => {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(value.trim())
      value = ''
    } else {
      value += char
    }
  }
  values.push(value.trim())
  return values
}

const parseAttendanceCsv = (text) => {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) throw new Error('The CSV must contain a header row and at least one record.')
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ''))
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || ''
      return row
    }, {})
  })
  return rows
}

const normalizeImportDate = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

const resolveBranchAccess = async (uid, branchId) => {
  const firestore = admin.firestore()
  const branchSnap = await firestore.collection('clinics').doc(branchId).get()
  if (!branchSnap.exists) return false
  const branch = branchSnap.data() || {}
  if (String(branch.ownerId || '') === uid) return true
  const userSnap = await firestore.collection('users').doc(uid).get()
  return String(userSnap.data()?.branchId || '') === branchId
}

const loadAttendanceSchedule = async (employeeId, dateKey) => {
  const firestore = admin.firestore()
  const scheduleSnap = await firestore.collection('users').doc(employeeId).collection('schedules').doc('recurring').get()
  const assignments = scheduleSnap.exists ? scheduleSnap.data()?.assignments || {} : {}
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(new Date(`${dateKey}T12:00:00+08:00`))
  const shiftLabel = String(assignments[weekday] || '').trim()
  if (!shiftLabel || shiftLabel.toLowerCase() === 'off') return { shiftLabel, shiftStart: '', shiftEnd: '' }
  const shiftSnap = await firestore.collection('shifts').where('branchId', '==', (await firestore.collection('users').doc(employeeId).get()).data()?.branchId || '').get()
  const shift = shiftSnap.docs.map((snap) => snap.data() || {}).find((entry) => {
    const label = `${String(entry.shiftType || 'Shift').trim()} || ${String(entry.start || '').trim()} - ${String(entry.end || '').trim()}`
    return label === shiftLabel
  }) || {}
  return { shiftLabel, shiftStart: String(shift.start || '').trim(), shiftEnd: String(shift.end || '').trim() }
}

const runRegistrationDocumentVerification = async ({ uid, applicantType, processedBy }) => {
  const firestore = admin.firestore()
  const normalizedType = applicantType === 'supplier' ? 'supplier' : 'clinic'
  const collectionName = normalizedType === 'supplier' ? 'supplierApplications' : 'clinics'
  const applicationRef = firestore.collection(collectionName).doc(uid)
  const userRef = firestore.collection('users').doc(uid)
  const [applicationSnap, userSnap] = await Promise.all([applicationRef.get(), userRef.get()])
  if (!applicationSnap.exists) throw new Error('Registration application not found.')

  const application = applicationSnap.data() || {}
  const user = userSnap.exists ? userSnap.data() || {} : {}
  const documents = normalizedType === 'supplier'
    ? (application.documents || application.submittedDocuments || {})
    : (application.submittedDocuments || {})
  const requiredKeys = REGISTRATION_DOCUMENT_REQUIREMENTS[normalizedType]
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  const visionClient = createVisionClient()
  const results = {}

  for (const docKey of requiredKeys) {
    const document = documents?.[docKey] || {}
    const expectedPrefix = `${normalizedType === 'supplier' ? 'supplier-registration' : 'clinic-registration'}/${uid}/${docKey}/`
    const storagePath = String(document.path || document.storagePath || '').trim()
    const result = {
      status: 'manual_review',
      confidence: 0,
      storagePath,
      reason: '',
      numberMatch: null,
      expectedDocumentNumber: String(document.documentNumber || document.number || '').trim(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (!storagePath || !storagePath.startsWith(expectedPrefix)) {
      result.reason = 'Document storage path is missing or does not belong to this application.'
      results[docKey] = result
      continue
    }
    if (!document.type || !['application/pdf', 'image/jpeg', 'image/png'].includes(String(document.type).toLowerCase())) {
      result.reason = 'Unsupported document type.'
      results[docKey] = result
      continue
    }
    if (Number(document.size || 0) <= 0 || Number(document.size || 0) > 10 * 1024 * 1024) {
      result.reason = 'Document size is invalid.'
      results[docKey] = result
      continue
    }

    if (!visionClient) {
      result.reason = 'Automatic document processor is not configured.'
      results[docKey] = result
      continue
    }

    try {
      const gcsUri = `gs://${bucketName}/${storagePath}`
      const [visionResult] = await visionClient.documentTextDetection(gcsUri)
      const extractedText = String(visionResult?.fullTextAnnotation?.text || '').trim()
      const textLower = extractedText.toLowerCase()
      const businessName = String(application.businessName || application.clinicName || '').trim().toLowerCase()
      const ownerName = `${String(user.firstName || application.firstName || '')} ${String(user.lastName || application.lastName || '')}`.trim().toLowerCase()
      const nameMatch = (businessName.length >= 3 && textLower.includes(businessName)) || (ownerName.length >= 3 && textLower.includes(ownerName))
      const hasReadableText = extractedText.length >= 30
      const expiry = document.expiryDate ? new Date(document.expiryDate) : null
      const expiryValid = !expiry || (Number.isFinite(expiry.getTime()) && expiry.getTime() >= Date.now())
      const requiresDocumentNumber = DOCUMENT_NUMBER_REQUIREMENTS.has(docKey)
      const expectedNumber = normalizeOcrComparable(document.documentNumber || document.number)
      const extractedComparable = normalizeOcrComparable(extractedText)
      const numberMatch = requiresDocumentNumber
        ? Boolean(expectedNumber && extractedComparable.includes(expectedNumber))
        : null
      result.numberMatch = numberMatch
      const numberCheckPassed = !requiresDocumentNumber || numberMatch
      const confidence = Math.min(1, (hasReadableText ? 0.6 : 0.15) + (nameMatch ? 0.25 : 0) + (expiryValid ? 0.15 : 0))
      result.confidence = confidence
      result.extractedText = extractedText.slice(0, 2000)
      result.status = confidence >= AUTO_VERIFICATION_THRESHOLD && numberCheckPassed ? 'verified' : 'manual_review'
      if (!requiresDocumentNumber) {
        result.reason = result.status === 'verified' ? 'Passed automatic checks.' : 'Confidence is below the automatic approval threshold.'
      } else if (!expectedNumber) {
        result.reason = 'The required document number was not provided for comparison.'
      } else if (!numberMatch) {
        result.reason = 'The document number does not match the number entered during registration.'
      } else {
        result.reason = result.status === 'verified' ? 'Document number and automatic checks matched.' : 'Confidence is below the automatic approval threshold.'
      }
    } catch (error) {
      result.reason = error?.message || 'Automatic document processing failed.'
    }
    results[docKey] = result
  }

  const allRequiredDocumentsPresent = requiredKeys.every((key) => Boolean(documents?.[key]?.path || documents?.[key]?.storagePath))
  const allVerified = allRequiredDocumentsPresent && requiredKeys.every((key) => results[key]?.status === 'verified')
  const verificationStatus = allVerified ? 'Automatically Verified' : 'Manual Review Required'
  const verificationPayload = {
    verificationStatus,
    verificationResults: results,
    verificationThreshold: AUTO_VERIFICATION_THRESHOLD,
    verificationProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
    verificationProcessedBy: processedBy || 'automatic_processor',
    // OCR verifies document quality and consistency; it never grants account access.
    approvalStatus: 'Pending Approval',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  const batch = firestore.batch()
  batch.set(applicationRef, verificationPayload, { merge: true })
  batch.set(userRef, {
    status: 'Pending Approval',
    approvalStatus: 'Pending Approval',
    verificationStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  batch.set(applicationRef.collection('verificationHistory').doc(), {
    action: allVerified ? 'automatically-verified-pending-approval' : 'manual-review-required',
    applicantType: normalizedType,
    results,
    processedBy: processedBy || 'automatic_processor',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  const notificationLabel = normalizedType === 'supplier' ? 'Supplier' : 'Clinic'
  batch.set(firestore.collection('notifications').doc(`${normalizedType}-registration-${uid}`), {
    recipientRole: 'Superadmin',
    senderId: uid,
    type: `${normalizedType}_registration_verification`,
    title: `${notificationLabel} Registration Ready for Review`,
    message: allVerified
      ? `A ${normalizedType} registration passed automatic verification and is awaiting your approval.`
      : `A ${normalizedType} registration requires manual document review.`,
    link: normalizedType === 'supplier' ? '/superadmin/suppliers/verification' : '/superadmin/clinics/verification',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
  await batch.commit()

  return { status: verificationStatus, approvalStatus: 'Pending Approval', allVerified, results }
}

app.post('/registration/auto-verify-documents', requireAuth, async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const applicantType = String(req.body?.applicantType || '').trim().toLowerCase()
  if (!uid || uid !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
  if (!['clinic', 'supplier'].includes(applicantType)) return res.status(400).json({ success: false, error: 'applicantType must be clinic or supplier' })
  try {
    const data = await runRegistrationDocumentVerification({ uid, applicantType, processedBy: 'automatic_processor' })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('Automatic registration verification failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Automatic verification failed' })
  }
})

const procurementTransitionMap = {
  supplierQuotes: { Submitted: 'Accepted' },
  purchaseOrders: { 'Pending Finance': 'Approved', Approved: 'Issued', Issued: 'Shipped', Shipped: 'Received' },
  purchaseRequests: { 'Pending Finance': 'Approved', Approved: 'Issued', Issued: 'Shipped', Shipped: 'Received' },
}

const canAccessBranchRecord = (context, record) => {
  const permissions = context?.permissions || new Set()
  const role = String(context?.roleKey || '').toLowerCase()
  if (role === 'superadmin' || permissions.has('administrator:full_access')) return true
  const branchId = String(context?.userData?.branchId || context?.userData?.clinicId || '').trim()
  return Boolean(branchId && String(record?.branchId || '').trim() === branchId && (
    role === 'owner' ||
    permissions.has('procurement:create') || permissions.has('procurement:review') ||
    permissions.has('inventory:review') || permissions.has('orders:update')
  ))
}

app.post('/procurement/:collection/:id/transition', requireAuth, async (req, res) => {
  const collectionName = String(req.params.collection || '').trim()
  const recordId = String(req.params.id || '').trim()
  const transitions = procurementTransitionMap[collectionName]
  if (!transitions || !recordId) return res.status(400).json({ success: false, error: 'Invalid procurement transition.' })

  try {
    const context = await loadUserContext(req.user.uid)
    const recordRef = admin.firestore().collection(collectionName).doc(recordId)
    const recordSnap = await recordRef.get()
    if (!recordSnap.exists) return res.status(404).json({ success: false, error: 'Procurement record not found.' })
    const record = recordSnap.data() || {}
    if (!canAccessBranchRecord(context, record)) return res.status(403).json({ success: false, error: 'Forbidden' })

    const rawPurchaseOrderStatus = String(record.purchaseOrderStatus || '').trim()
    const currentStatus = collectionName === 'purchaseRequests'
      ? (rawPurchaseOrderStatus === 'Draft' || !rawPurchaseOrderStatus ? 'Pending Finance' : rawPurchaseOrderStatus)
      : String(record.status || '').trim()
    const nextStatus = transitions[currentStatus]
    if (!nextStatus) return res.status(409).json({ success: false, error: `Record cannot move forward from ${currentStatus || 'its current status'}.` })

    const payload = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    }
    if (collectionName === 'purchaseRequests') {
      payload.purchaseOrderStatus = nextStatus
      payload.procurementStatus = nextStatus === 'Received' ? 'Received' : `Purchase Order ${nextStatus}`
      payload.workflowStage = nextStatus === 'Received' ? 'Delivered - Awaiting Finance Settlement' : `${nextStatus} Purchase Order`
    } else {
      payload.status = nextStatus
    }
    if (nextStatus === 'Approved') payload.financeApprovedAt = admin.firestore.FieldValue.serverTimestamp()
    if (nextStatus === 'Issued') payload.purchaseOrderIssuedAt = admin.firestore.FieldValue.serverTimestamp()
    if (nextStatus === 'Shipped') payload.shippedAt = admin.firestore.FieldValue.serverTimestamp()
    if (nextStatus === 'Received') payload.receivedAt = admin.firestore.FieldValue.serverTimestamp()
    if (collectionName === 'supplierQuotes' && record.purchaseRequestId && nextStatus === 'Accepted') {
      const requestRef = admin.firestore().collection('purchaseRequests').doc(String(record.purchaseRequestId))
      const requestSnap = await requestRef.get()
      if (requestSnap.exists) {
        await requestRef.update({
          supplierQuoteId: recordSnap.id,
          supplierQuoteStatus: 'Accepted',
          supplierQuoteReference: record.reference || record.id || recordSnap.id,
          supplierQuoteAmount: Number(record.amount || record.totalAmount || record.totalCost || 0),
          quotedSupplier: record.supplierName || record.supplier || '',
          purchaseOrderStatus: 'Pending Finance',
          procurementStatus: 'Pending Finance',
          workflowStage: 'Pending Finance Approval',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    }
    if (collectionName === 'purchaseRequests' && nextStatus === 'Received') {
      payload.status = 'Delivered'
      payload.logisticsStatus = 'Delivered'
      payload.deliveredAt = admin.firestore.FieldValue.serverTimestamp()
    }
    await recordRef.update(payload)
    if (collectionName === 'purchaseRequests' && nextStatus === 'Received') {
      const branchId = String(record.branchId || '').trim()
      const itemName = String(record.item || '').trim()
      const supplierName = String(record.supplier || '').trim()
      const quantity = Number(record.quantity || 0)
      const unitCost = Number(record.unitCost || 0)
      if (branchId && itemName && quantity > 0) {
        const inventorySnap = await admin.firestore().collection('inventoryItems').where('branchId', '==', branchId).get()
        const existing = inventorySnap.docs
          .map((itemSnap) => ({ id: itemSnap.id, data: itemSnap.data() || {} }))
          .find(({ data }) => String(data.name || '').trim().toLowerCase() === itemName.toLowerCase()
            && String(data.supplier || '').trim().toLowerCase() === supplierName.toLowerCase())
        if (existing) {
          const currentStock = Number(existing.data.currentStock || 0)
          await admin.firestore().collection('inventoryItems').doc(existing.id).update({
            currentStock: currentStock + quantity,
            maxStock: Number(existing.data.maxStock || currentStock) + quantity,
            ...(unitCost > 0 && Number(existing.data.costPrice || 0) <= 0 ? { costPrice: unitCost, unitPrice: unitCost } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        } else {
          await admin.firestore().collection('inventoryItems').add({
            name: itemName,
            sku: `AUTO-${recordSnap.id.slice(-8).toUpperCase()}`,
            category: record.category || '',
            supplier: supplierName,
            currentStock: quantity,
            minStock: 1,
            maxStock: quantity,
            unit: record.unit || 'units',
            costPrice: unitCost,
            unitPrice: unitCost,
            description: 'Auto-added from received purchase order',
            stockStatus: 'In Stock',
            branchId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }
    }
    return res.json({ success: true, data: { id: recordId, status: nextStatus } })
  } catch (error) {
    console.error('Procurement transition failed:', error)
    return res.status(500).json({ success: false, error: 'Could not update procurement status.' })
  }
})

app.post('/finance/purchase-requests/:id/settle', requireAuth, async (req, res) => {
  const recordId = String(req.params.id || '').trim()
  if (!recordId) return res.status(400).json({ success: false, error: 'Purchase request id is required.' })
  try {
    const context = await loadUserContext(req.user.uid)
    const recordRef = admin.firestore().collection('purchaseRequests').doc(recordId)
    const recordSnap = await recordRef.get()
    if (!recordSnap.exists) return res.status(404).json({ success: false, error: 'Purchase request not found.' })
    const record = recordSnap.data() || {}
    const permissions = context.permissions || new Set()
    const role = String(context.roleKey || '').toLowerCase()
    const branchId = String(context.userData?.branchId || context.userData?.clinicId || '').trim()
    const authorized = role === 'superadmin' || permissions.has('administrator:full_access') || (
      branchId && String(record.branchId || '').trim() === branchId && (
        role === 'owner' || permissions.has('payments:create') || permissions.has('inventory:review') || permissions.has('orders:update')
      )
    )
    if (!authorized) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (String(record.status || '').trim() !== 'Delivered') {
      return res.status(409).json({ success: false, error: 'Only delivered purchase requests can be settled.' })
    }

    const total = Math.max(0, Number(record.totalCost || record.total || 0) || (Number(record.quantity || 0) * Number(record.unitCost || 0)))
    const paid = req.body?.paid === true
    await recordRef.update({
      paymentStatus: paid ? 'Paid' : 'Unpaid',
      amountPaid: paid ? total : 0,
      balance: paid ? 0 : total,
      paidAt: paid ? admin.firestore.FieldValue.serverTimestamp() : null,
      paidBy: paid ? req.user.uid : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.json({ success: true, data: { id: recordId, paymentStatus: paid ? 'Paid' : 'Unpaid', amountPaid: paid ? total : 0, balance: paid ? 0 : total } })
  } catch (error) {
    console.error('Purchase settlement failed:', error)
    return res.status(500).json({ success: false, error: 'Could not update payment status.' })
  }
})

// Allow authorized system administrators to rerun the same verifier for an
// existing supplier application when processing failed or was never started.
app.post('/admin/trigger-registration-verification', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:suppliers:verify'), async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const applicantType = String(req.body?.applicantType || '').trim().toLowerCase()
  if (!uid || applicantType !== 'supplier') {
    return res.status(400).json({ success: false, error: 'A supplier uid is required' })
  }

  try {
    const data = await runRegistrationDocumentVerification({ uid, applicantType, processedBy: req.user.uid })
    await writeSystemAdminActivity(req, {
      action: 'Reran supplier document OCR',
      module: 'Supplier Verification',
      details: `Reran automatic verification for supplier ${uid}; result: ${data.status}.`,
      targetId: uid,
      targetName: uid,
    })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('Supplier document verification rerun failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Automatic verification failed' })
  }
})

app.post('/admin/trigger-clinic-registration-verification', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  if (!uid) {
    return res.status(400).json({ success: false, error: 'A clinic uid is required' })
  }

  try {
    const data = await runRegistrationDocumentVerification({ uid, applicantType: 'clinic', processedBy: req.user.uid })
    await writeSystemAdminActivity(req, {
      action: 'Reran clinic document OCR',
      module: 'Clinic Verification',
      details: `Reran automatic verification for clinic ${uid}; result: ${data.status}.`,
      targetId: uid,
      targetName: uid,
    })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('Clinic document verification rerun failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Automatic verification failed' })
  }
})

const BOOKING_RESERVATIONS_COLLECTION = 'bookingReservations'
const BOOKING_RESERVATION_TTL_MINUTES = Math.max(5, Number(process.env.BOOKING_RESERVATION_TTL_MINUTES || 15))
const BOOKING_BLOCKING_STATUSES = new Set([
  'pending approval',
  'payment pending',
  'contract pending',
  'ready to start',
  'awaiting customer confirmation',
  'balance due',
  'scheduled',
  'approved',
  'paid',
  'cancellation requested',
  'reschedule requested',
  'completed',
  'in progress',
  'ongoing',
  'held',
])

const parseClockToMinutes = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!ampm) return null

  let hour = Number(ampm[1])
  const minute = Number(ampm[2])
  const marker = ampm[3].toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  if (marker === 'PM' && hour !== 12) hour += 12
  if (marker === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

const normalizeBookingStatus = (value) => String(value || '').trim().toLowerCase()

const getMinutesFromData = (value, fallback = 60) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getBookingRange = (data = {}) => {
  const start = parseClockToMinutes(data.time)
  if (start === null) return null
  const end = parseClockToMinutes(data.endTime)
  const durationMinutes = getMinutesFromData(
    data.totalServiceDurationMinutes ||
    data.consultationForServiceDurationMinutes ||
    data.durationMinutes ||
    data.bookingDurationMinutes,
    60
  )
  let normalizedEnd = end !== null && end > start ? end : start + durationMinutes
  if (normalizedEnd <= start) {
    normalizedEnd = start + durationMinutes
  }
  return { start, end: normalizedEnd }
}

const rangesOverlap = (leftStart, leftEnd, rightStart, rightEnd) =>
  leftStart < rightEnd && leftEnd > rightStart

const toMillis = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizePlanKey = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'free'
  if (raw === 'free-plan' || raw === 'freeplan' || raw === 'free_plan' || raw === 'free-trial' || raw === 'trial') {
    return 'free'
  }
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('free')) return 'free'
  return raw
}

const PLAN_PRIORITIES = {
  free: 0,
  basic: 1,
  premium: 2,
}

const getPlanPriority = (planKey) => PLAN_PRIORITIES[normalizePlanKey(planKey)] ?? 0

const getPlanDurationDays = (planKey, billingCycle = 'month') => {
  const normalizedPlan = normalizePlanKey(planKey)
  if (normalizedPlan === 'free') return 0
  const cycle = String(billingCycle || '').trim().toLowerCase()
  if (cycle === 'year' || cycle === 'annual') return 365
  return 30
}

const toDateValue = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const clearPendingSubscriptionFields = () => ({
  pendingSubscriptionPlan: admin.firestore.FieldValue.delete(),
  pendingSubscriptionApplyAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionRequestedAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionChangeType: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaidAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionNextExpiresAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionBillingCycle: admin.firestore.FieldValue.delete(),
})

const isOwnerRoleValue = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  return normalized === 'owner' || normalized === 'clinicadmin' || normalized === 'clinicadministrator'
}

const loadOwnerSubscriptionContext = async (firestore, ownerUid) => {
  const userRef = firestore.collection('users').doc(ownerUid)
  const clinicRefByUid = firestore.collection('clinics').doc(ownerUid)
  const [userSnap, clinicByUidSnap, clinicsByOwnerSnap] = await Promise.all([
    userRef.get(),
    clinicRefByUid.get(),
    firestore.collection('clinics').where('ownerId', '==', ownerUid).get(),
  ])

  const userData = userSnap.exists ? userSnap.data() || {} : {}
  const clinicRefs = new Map()
  let primaryClinicData = clinicByUidSnap.exists ? clinicByUidSnap.data() || {} : null

  if (clinicByUidSnap.exists) {
    clinicRefs.set(clinicByUidSnap.id, clinicByUidSnap.ref)
  }

  clinicsByOwnerSnap.forEach((docSnap) => {
    clinicRefs.set(docSnap.id, docSnap.ref)
    if (!primaryClinicData) {
      primaryClinicData = docSnap.data() || {}
    }
  })

  const clinicData = primaryClinicData || {}
  const currentPlan = normalizePlanKey(clinicData.subscriptionPlan || userData.subscriptionPlan || userData.plan || 'free')
  const currentExpiresAt = toDateValue(clinicData.subscriptionExpiresAt || userData.subscriptionExpiresAt)
  const rawPendingPlan = String(clinicData.pendingSubscriptionPlan || userData.pendingSubscriptionPlan || '').trim()
  const pendingPlan = rawPendingPlan ? normalizePlanKey(rawPendingPlan) : ''
  const pendingApplyAt = toDateValue(clinicData.pendingSubscriptionApplyAt || userData.pendingSubscriptionApplyAt)
  const pendingNextExpiresAt = toDateValue(
    clinicData.pendingSubscriptionNextExpiresAt || userData.pendingSubscriptionNextExpiresAt
  )
  const pendingPaymentId =
    String(clinicData.pendingSubscriptionPaymentId || userData.pendingSubscriptionPaymentId || '').trim() || null
  const pendingBillingCycle =
    String(clinicData.pendingSubscriptionBillingCycle || userData.pendingSubscriptionBillingCycle || 'month').trim() || 'month'

  return {
    userRef,
    clinicRefs: Array.from(clinicRefs.values()),
    userData,
    clinicData,
    currentPlan,
    currentExpiresAt,
    pendingPlan: pendingPlan || '',
    pendingApplyAt,
    pendingNextExpiresAt,
    pendingPaymentId,
    pendingBillingCycle,
  }
}

const updateOwnerSubscriptionDocuments = async (firestore, ownerUid, payload) => {
  const context = await loadOwnerSubscriptionContext(firestore, ownerUid)
  const writes = [
    context.userRef.set(payload, { merge: true }),
    firestore.collection('clinics').doc(ownerUid).set(payload, { merge: true }),
  ]
  context.clinicRefs.forEach((ref) => {
    writes.push(ref.set(payload, { merge: true }))
  })
  await Promise.all(writes)
  return context
}

const applySubscriptionPaymentForOwner = async ({
  firestore,
  ownerUid,
  targetPlan,
  paidAt,
  paymentReference,
  billingCycle = 'month',
}) => {
  const context = await loadOwnerSubscriptionContext(firestore, ownerUid)
  const normalizedTargetPlan = normalizePlanKey(targetPlan)
  const currentPlan = context.currentPlan
  const currentPriority = getPlanPriority(currentPlan)
  const targetPriority = getPlanPriority(normalizedTargetPlan)
  const paymentDate = toDateValue(paidAt) || new Date()
  const currentExpiresAt = context.currentExpiresAt
  const hasActiveCurrentCycle = Boolean(currentExpiresAt && currentExpiresAt.getTime() > paymentDate.getTime())

  if (normalizedTargetPlan === currentPlan && hasActiveCurrentCycle) {
    return {
      action: 'blocked_same_plan',
      currentPlan,
      targetPlan: normalizedTargetPlan,
      message: "You're already on this plan.",
    }
  }

  if (
    context.pendingPlan &&
    context.pendingPlan === normalizedTargetPlan &&
    context.pendingApplyAt &&
    context.pendingApplyAt.getTime() > paymentDate.getTime()
  ) {
    return {
      action: 'blocked_pending_same_plan',
      currentPlan,
      targetPlan: normalizedTargetPlan,
      effectiveAt: context.pendingApplyAt.toISOString(),
      message: 'This plan change is already scheduled for your next billing cycle.',
    }
  }

  if (targetPriority < currentPriority && hasActiveCurrentCycle) {
    const applyAt = currentExpiresAt
    const durationDays = getPlanDurationDays(normalizedTargetPlan, billingCycle)
    const nextExpiresAt =
      targetPriority === 0 ? null : new Date(applyAt.getTime() + durationDays * DAY_MS)

    await updateOwnerSubscriptionDocuments(firestore, ownerUid, {
      pendingSubscriptionPlan: normalizedTargetPlan,
      pendingSubscriptionApplyAt: applyAt,
      pendingSubscriptionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      pendingSubscriptionChangeType: 'downgrade',
      pendingSubscriptionPaymentId: paymentReference || null,
      pendingSubscriptionPaidAt: paymentDate,
      pendingSubscriptionNextExpiresAt: nextExpiresAt,
      pendingSubscriptionBillingCycle: billingCycle,
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return {
      action: 'scheduled_downgrade',
      currentPlan,
      targetPlan: normalizedTargetPlan,
      effectiveAt: applyAt.toISOString(),
      expiresAt: nextExpiresAt ? nextExpiresAt.toISOString() : null,
      message: 'Your plan downgrade is scheduled for the end of your current billing cycle.',
    }
  }

  const durationDays = getPlanDurationDays(normalizedTargetPlan, billingCycle)
  const nextExpiresAt =
    targetPriority === 0 ? null : new Date(paymentDate.getTime() + durationDays * DAY_MS)
  const nextPaymentStatus = targetPriority === 0 ? 'free' : 'paid'

  await updateOwnerSubscriptionDocuments(firestore, ownerUid, {
    subscriptionPlan: normalizedTargetPlan,
    paymentStatus: nextPaymentStatus,
    paymentId: paymentReference || null,
    subscriptionStartedAt: paymentDate,
    subscriptionExpiresAt: nextExpiresAt,
    subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...clearPendingSubscriptionFields(),
  })

  return {
    action: targetPriority > currentPriority ? 'applied_upgrade' : 'applied_plan_change',
    currentPlan,
    targetPlan: normalizedTargetPlan,
    effectiveAt: paymentDate.toISOString(),
    expiresAt: nextExpiresAt ? nextExpiresAt.toISOString() : null,
    message: targetPriority > currentPriority
      ? 'Your upgraded plan is now active.'
      : 'Your plan change is now active.',
  }
}

const buildBookingAppointmentPayload = ({
  reservation,
  paymongo,
  paymentMethodType,
  paymentMethod,
}) => {
  const flowType = String(reservation.flowType || 'booking').trim().toLowerCase()
  const selectedServices = Array.isArray(reservation.selectedServices) ? reservation.selectedServices : []
  const serviceNames = selectedServices.map((service) => String(service?.title || service?.name || '').trim()).filter(Boolean)
  const serviceIds = Array.isArray(reservation.selectedServiceIds) ? reservation.selectedServiceIds.filter(Boolean) : []
  const serviceDurations = Array.isArray(reservation.serviceDurations) ? reservation.serviceDurations.map((value) => Number(value || 0)).filter((value) => value > 0) : []
  const totalServiceDurationMinutes = Number(reservation.totalServiceDurationMinutes || serviceDurations.reduce((sum, value) => sum + value, 0) || 0)
  const totalAmount = Number(reservation.amount || reservation.consultationFee || 0)
  const installmentsAllowed = reservation.allowInstallments === true || selectedServices.some((service) => service?.allowInstallments === true)
  // A payment cannot make a booking active until the shop has approved it.
  // This protects the legacy finalize endpoint from bypassing approval.
  const isApproved = normalizeBookingStatus(reservation.approvalStatus) === 'approved' || Boolean(reservation.approvedAt)
  const isPaid = isApproved && (Boolean(paymongo?.paymentId) || String(reservation.paymentStatus || '').trim().toLowerCase() === 'paid')
  const paymentStatus = isPaid ? 'Paid' : String(reservation.paymentStatus || 'Pending').trim() || 'Pending'
  const appointmentStatus = isPaid
    ? 'Scheduled'
    : String(reservation.status || 'Pending Approval').trim() || 'Pending Approval'
  const commissionAmount = Number(reservation.commissionAmount || 0)
  const netAmount = Number(reservation.netAmount || 0)
  const basePayload = {
    customerId: reservation.customerId || '',
    customerName: reservation.customerName || reservation.customerEmail || 'Customer',
    clientName: reservation.customerName || reservation.customerEmail || 'Customer',
    customerEmail: String(reservation.customerEmail || '').trim().toLowerCase(),
    customerPhone: String(reservation.customerPhone || '').trim(),
    practitionerId: reservation.practitionerId || '',
    assignedPractitionerId: reservation.practitionerId || '',
    practitionerName: reservation.practitionerName || '',
    assignedPractitionerName: reservation.practitionerName || '',
    service: serviceNames.join(', '),
    services: serviceNames,
    serviceIds,
    serviceDetails: selectedServices,
    serviceDurations,
    totalServiceDurationMinutes,
    date: reservation.date || '',
    time: reservation.time || '',
    endTime: reservation.endTime || '',
    notes: reservation.notes || '',
    status: appointmentStatus,
    paymentStatus,
    source: reservation.source || (isPaid ? 'paymongo_checkout' : 'customer_booking_request'),
    paymentMethod: paymentMethod || paymentMethodType || reservation.paymentMethod || 'GCash',
    paymentCoverage: reservation.paymentCoverage || (isPaid ? 'full' : 'pending'),
    installmentsAllowed,
    amount: totalAmount,
    amountPaid: isPaid ? totalAmount : Number(reservation.amountPaid || 0),
    totalAmount,
    commissionPercent: Number(reservation.commissionPercent || 10),
    commissionAmount,
    merchantNetAmount: netAmount,
    requiresConsultationFirst: Boolean(reservation.requiresConsultationFirst),
    followUpAllowed: Boolean(reservation.followUpAllowed),
    followUpWindowDays: reservation.followUpWindowDays != null ? Number(reservation.followUpWindowDays) : null,
    bookingType: reservation.bookingType || 'standard',
    followUpOf: reservation.followUpOf || '',
    preferredPractitionerId: reservation.preferredPractitionerId || '',
    followUpSourceServiceIds: Array.isArray(reservation.followUpSourceServiceIds) ? reservation.followUpSourceServiceIds : [],
    followUpSourceServiceNames: Array.isArray(reservation.followUpSourceServiceNames) ? reservation.followUpSourceServiceNames : [],
    branchId: reservation.branchId || '',
    centerId: reservation.centerId || reservation.branchId || '',
    bookingId: reservation.bookingId || '',
    paymongoCheckoutSessionId: isPaid ? (reservation.checkoutSessionId || null) : null,
    paymongoStatus: isPaid ? (paymongo?.status || null) : null,
    paymongoPaidAt: isPaid ? (paymongo?.paid_at || null) : null,
    paymongoPaymentId: isPaid ? (paymongo?.paymentId || null) : null,
    paymongoPaymentMethodType: isPaid ? (paymentMethodType || null) : null,
    referenceNumber: reservation.referenceNumber || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reservationId: reservation.id,
  }

  return flowType === 'consultation'
    ? {
        ...basePayload,
        type: 'Consultation',
        service: 'Online Consultation',
        services: ['Online Consultation'],
        consultationMode: 'online',
        consultationFee: totalAmount,
        consultationForServices: serviceNames,
        consultationForServiceIds: serviceIds,
        consultationForServiceDetails: selectedServices,
        consultationForServiceDurationMinutes: totalServiceDurationMinutes,
        followUpAllowed: false,
        followUpWindowDays: null,
        bookingType: 'consultation',
        followUpOf: reservation.followUpOf || '',
        preferredPractitionerId: reservation.preferredPractitionerId || '',
        followUpSourceServiceIds: Array.isArray(reservation.followUpSourceServiceIds) ? reservation.followUpSourceServiceIds : [],
        followUpSourceServiceNames: Array.isArray(reservation.followUpSourceServiceNames) ? reservation.followUpSourceServiceNames : [],
      }
    : basePayload
}

const zipJsonBuffer = async (jsonBuffer, fileBaseName) => {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = new PassThrough()
  const chunks = []

  stream.on('data', (chunk) => chunks.push(chunk))

  const finalizePromise = new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
    archive.on('error', reject)
  })

  archive.pipe(stream)
  archive.append(jsonBuffer, { name: `${fileBaseName}.json` })
  archive.finalize()

  return finalizePromise
}

const buildBackupPayload = async (firestore, ownerId) => {
  const clinicsSnapshot = await firestore.collection('clinics').where('ownerId', '==', ownerId).get()
  const clinics = clinicsSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
  const branchIds = clinics.map((clinic) => clinic.id)

  const chunkArray = (items, size) => {
    const chunks = []
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }
    return chunks
  }

  const fetchByBranches = async (collectionName, extraFilter = null) => {
    if (!branchIds.length) return []
    const chunks = chunkArray(branchIds, 10)
    const results = []
    for (const chunk of chunks) {
      let queryRef = firestore.collection(collectionName).where('branchId', 'in', chunk)
      if (extraFilter) {
        queryRef = queryRef.where(extraFilter.field, extraFilter.op, extraFilter.value)
      }
      const snap = await queryRef.get()
      snap.forEach((docSnap) => results.push({ id: docSnap.id, ...docSnap.data() }))
    }
    return results
  }

  const [ownerSnap, staffUsers, clients, appointments, transactions, attendance, payrolls, inventoryItems, suppliers, purchaseRequests, productServicePosts, reviews, messages] =
    await Promise.all([
      firestore.collection('users').doc(ownerId).get(),
      fetchByBranches('users', { field: 'userType', op: '==', value: 'Staff' }),
      fetchByBranches('clients'),
      fetchByBranches('appointments'),
      fetchByBranches('transactions'),
      fetchByBranches('attendance'),
      fetchByBranches('payrolls'),
      fetchByBranches('inventoryItems'),
      fetchByBranches('suppliers'),
      fetchByBranches('purchaseRequests'),
      fetchByBranches('productServicePosts'),
      fetchByBranches('reviews'),
      fetchByBranches('messages'),
    ])

  const ownerData = ownerSnap.exists ? ownerSnap.data() : {}
  return {
    ownerId,
    generatedAt: new Date().toISOString(),
    owner: ownerData,
    clinics,
    collections: {
      users: staffUsers,
      clients,
      appointments,
      transactions,
      attendance,
      payrolls,
      inventoryItems,
      suppliers,
      purchaseRequests,
      productServicePosts,
      reviews,
      messages,
    },
  }
}

const pruneOldBackups = async (firestore, bucket, ownerId) => {
  const cutoffDaily = new Date(Date.now() - backupDailyRetentionDays * 24 * 60 * 60 * 1000)
  const cutoffMonthly = new Date(Date.now() - backupMonthlyRetentionDays * 24 * 60 * 60 * 1000)
  const backupsSnap = await firestore.collection('backups').where('ownerId', '==', ownerId).get()

  const deletions = []
  backupsSnap.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const createdAt = data.createdAt?.toDate?.() || null
    const kind = String(data.kind || '').toLowerCase()
    const shouldDelete =
      (kind === 'daily' && createdAt && createdAt < cutoffDaily) ||
      (kind === 'monthly' && createdAt && createdAt < cutoffMonthly)

    if (!shouldDelete) return
    const storagePath = data.storagePath
    if (storagePath) {
      deletions.push(bucket.file(storagePath).delete({ ignoreNotFound: true }))
    }
    deletions.push(docSnap.ref.delete())
  })

  if (deletions.length) {
    await Promise.all(deletions)
  }
}

const generateOwnerBackup = async ({ ownerId, kind = 'manual', triggeredBy = 'system' }) => {
  const firestore = admin.firestore()
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  if (!bucketName) {
    throw new Error('Firebase Storage bucket is not configured.')
  }
  const bucket = admin.storage().bucket(bucketName)
  const backupPayload = await buildBackupPayload(firestore, ownerId)

  const backupJson = JSON.stringify(backupPayload, null, 2)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `backup-${timestamp}.json`
  const storagePath = `backups/${ownerId}/${timestamp}/${fileName}`
  const file = bucket.file(storagePath)
  await file.save(backupJson, {
    contentType: 'application/json',
    resumable: false,
  })

  const backupDoc = {
    ownerId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'complete',
    size: Buffer.byteLength(backupJson, 'utf8'),
    storagePath,
    fileName,
    kind,
    triggeredBy,
  }
  await firestore.collection('backups').add(backupDoc)
  await pruneOldBackups(firestore, bucket, ownerId)

  return { storagePath, fileName }
}

// Appointment contract endpoints
app.post('/appointments/:id/contract', requireAuth, async (req, res) => {
  const id = String(req.params?.id || '').trim()
  const { title, templateUrl, requiredSigners } = req.body ?? {}
  if (!id) return res.status(400).json({ success: false, error: 'appointment id is required' })
  try {
    const firestore = admin.firestore()
    const apptRef = firestore.collection('appointments').doc(id)
    const apptSnap = await apptRef.get()
    if (!apptSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
    const appointment = apptSnap.data() || {}
    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const roleKey = String(req.userContext.roleKey || '').trim()
    const canManage =
      roleKey === 'Superadmin' ||
      roleKey === 'Owner' ||
      (String(req.userContext.userData?.branchId || '').trim() === String(appointment.branchId || '').trim() &&
        (req.userContext.permissions.has('appointments:update') || req.userContext.permissions.has('appointments:review')))
    if (!canManage) return res.status(403).json({ success: false, error: 'Forbidden' })

    const customerEmail = String(appointment.customerEmail || '').trim().toLowerCase()
    const normalizedSigners = Array.isArray(requiredSigners)
      ? requiredSigners.map((signer) => ({ email: String(signer?.email || '').trim().toLowerCase() })).filter((signer) => signer.email)
      : []
    const signers = normalizedSigners.length ? normalizedSigners : (customerEmail ? [{ email: customerEmail }] : [])

    const contractId = `contract-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const contract = {
      contractId,
      title: String(title || 'Contract').trim(),
      templateUrl: String(templateUrl || '').trim() || null,
      requiredSigners: signers,
      signatures: {},
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.uid || null,
    }

    const currentStatus = normalizeBookingStatus(appointment.status)
    await apptRef.set({ contract, contractRequired: true, status: ['approved', 'payment pending'].includes(currentStatus) ? 'Contract Pending' : appointment.status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    return res.json({ success: true, data: { contract } })
  } catch (error) {
    console.error('appointments/:id/contract error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save contract' })
  }
})

app.post('/appointments/:id/contract/sign', requireAuth, async (req, res) => {
  const id = String(req.params?.id || '').trim()
  const { name, email } = req.body ?? {}
  if (!id) return res.status(400).json({ success: false, error: 'appointment id is required' })
  try {
    const firestore = admin.firestore()
    const apptRef = firestore.collection('appointments').doc(id)
    const apptSnap = await apptRef.get()
    if (!apptSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
    const appt = apptSnap.data() || {}
    const contract = appt.contract || {}

    const signerUid = req.user?.uid || null
    if (!signerUid) return res.status(401).json({ success: false, error: 'Unauthorized' })

    // Basic permission: if requiredSigners defined, ensure email matches one of them or allow owner/staff
    const userEmail = String(req.user?.email || '').trim().toLowerCase()
    const required = Array.isArray(contract.requiredSigners) ? contract.requiredSigners : []
    if (required.length > 0) {
      const matched = required.some(s => String((s.email||'').toLowerCase()) === userEmail)
      if (!matched) {
        return res.status(403).json({ success: false, error: 'You are not a listed signer for this contract' })
      }
    }

    const signature = {
      uid: signerUid,
      name: String(name || req.user?.displayName || ''),
      email: userEmail || req.user?.email || null,
      signedAt: new Date().toISOString(),
    }

    // write signature and evaluate status
    const signatures = contract.signatures || {}
    signatures[signerUid] = signature

    // check if all required signers signed
    let newStatus = contract.status || 'pending'
    if (required.length > 0) {
      const requiredEmails = required.map(s => String(s.email || '').toLowerCase())
      const signedEmails = Object.values(signatures).map(s => String(s.email||'').toLowerCase())
      const allSigned = requiredEmails.every(e => signedEmails.includes(e))
      if (allSigned) newStatus = 'signed'
    } else {
      // no required signers declared — single signer completes contract
      newStatus = 'signed'
    }

    const contractUpdate = { ...contract, signatures, status: newStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
    await apptRef.set({
      contract: contractUpdate,
      ...(newStatus === 'signed' ? {
        contractSignedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: normalizeBookingStatus(appt.status) === 'contract pending' ? 'Payment Pending' : appt.status,
      } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })

    const updated = (await apptRef.get()).data().contract
    return res.json({ success: true, data: { contract: updated } })
  } catch (error) {
    console.error('appointments/:id/contract/sign error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to sign contract' })
  }
})

app.post('/appointments/:id/contract/upload-signed', requireAuth, async (req, res) => {
  const id = String(req.params?.id || '').trim()
  const { signedUrl } = req.body ?? {}
  if (!id) return res.status(400).json({ success: false, error: 'appointment id is required' })
  if (!signedUrl) return res.status(400).json({ success: false, error: 'signedUrl is required' })
  try {
    const firestore = admin.firestore()
    const apptRef = firestore.collection('appointments').doc(id)
    const apptSnap = await apptRef.get()
    if (!apptSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
    const appt = apptSnap.data() || {}
    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const roleKey = String(req.userContext.roleKey || '').trim()
    const canManage = roleKey === 'Superadmin' || roleKey === 'Owner' ||
      (String(req.userContext.userData?.branchId || '').trim() === String(appt.branchId || '').trim() && req.userContext.permissions.has('appointments:update'))
    if (!canManage) return res.status(403).json({ success: false, error: 'Forbidden' })
    const contract = appt.contract || {}
    contract.signedUrl = String(signedUrl)
    contract.status = 'signed'
    contract.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    contract.signedByUploadAt = admin.firestore.FieldValue.serverTimestamp()

    await apptRef.set({ contract }, { merge: true })
    return res.json({ success: true, data: { contract } })
  } catch (error) {
    console.error('appointments/:id/contract/upload-signed error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to set signed URL' })
  }
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'otp-backend',
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || null,
    explicitFirebaseCredentials: Boolean(googleCloudCredential),
    postmarkConfigured: Boolean(postmarkClient && senderEmail),
    paymongoConfigured: Boolean(payMongoSecretKey),
    googleMeetConfigured: isGoogleMeetConfigured(),
    firebaseAdminConfigured: adminReady,
    firebaseAdminError: adminReady ? null : adminInitError,
  })
})

app.get('/maps/cavite-boundary', async (_req, res) => {
  try {
    const boundary = await fetchCaviteBoundary()
    res.json({
      ok: true,
      source: 'OpenStreetMap Nominatim',
      geometry: boundary,
    })
  } catch (error) {
    console.error('Failed to load official Cavite boundary:', error)
    res.status(503).json({
      ok: false,
      error: 'Official Cavite boundary is unavailable.',
      details: isDevelopment ? String(error?.message || error) : undefined,
    })
  }
})

app.post('/google-meet/create-consultation-link', requireAuth, requirePermission('consultations:create'), async (req, res) => {
  if (!isGoogleMeetConfigured()) {
    return res.status(503).json({
      success: false,
      error:
        'Google Meet integration is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.',
    })
  }

  const {
    summary,
    description,
    startDateTime,
    endDateTime,
    timezone,
    attendeeEmails,
    requestId,
  } = req.body ?? {}

  const cleanSummary = String(summary || '').trim()
  const cleanDescription = String(description || '').trim()
  const cleanStart = String(startDateTime || '').trim()
  const cleanEnd = String(endDateTime || '').trim()
  const cleanTimezone = String(timezone || googleMeetDefaultTimezone).trim() || googleMeetDefaultTimezone

  if (!cleanSummary || !cleanStart || !cleanEnd) {
    return res.status(400).json({
      success: false,
      error: 'summary, startDateTime, and endDateTime are required',
    })
  }

  const attendees = Array.isArray(attendeeEmails)
    ? attendeeEmails
        .map((email) => String(email || '').trim())
        .filter(Boolean)
        .map((email) => ({ email }))
    : []

  const eventPayload = {
    summary: cleanSummary,
    description: cleanDescription,
    start: { dateTime: cleanStart, timeZone: cleanTimezone },
    end: { dateTime: cleanEnd, timeZone: cleanTimezone },
    attendees,
    conferenceData: {
      createRequest: {
        requestId:
          String(requestId || '').trim() ||
          `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }

  try {
    const calendar = getGoogleCalendarClient()
    const response = await calendar.events.insert({
      calendarId: googleCalendarId,
      conferenceDataVersion: 1,
      sendUpdates: 'none',
      requestBody: eventPayload,
    })

    const data = response?.data || {}
    const entryPoints = data?.conferenceData?.entryPoints || []
    const meetEntry = entryPoints.find((item) => item?.entryPointType === 'video')
    const meetLink = data?.hangoutLink || meetEntry?.uri || ''

    if (!meetLink) {
      return res.status(500).json({
        success: false,
        error: 'Google Meet link was not returned by Google Calendar API',
      })
    }

    return res.json({
      success: true,
      data: {
        eventId: data.id,
        meetLink,
        htmlLink: data.htmlLink || '',
        calendarId: googleCalendarId,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create Google Meet link',
    })
  }
})

app.delete('/admin/system-admin/:uid', requireAuth, requireRole(['superadmin']), requirePermission('system:admins:manage'), async (req, res) => {
  const uid = String(req.params?.uid || '').trim()
  if (!uid) {
    return res.status(400).json({ success: false, error: 'Admin uid is required' })
  }
  if (uid === req.user.uid) {
    return res.status(403).json({ success: false, error: 'You cannot delete your own administrator account' })
  }

  try {
    const userRef = admin.firestore().collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return res.status(404).json({ success: false, error: 'Administrator account not found' })
    }

    const userData = userSnap.data() || {}
    const role = normalizeRoleKey(userData.role || userData.userType || '')
    if (role !== 'Superadmin') {
      return res.status(400).json({ success: false, error: 'The selected account is not a system administrator' })
    }

    await admin.auth().deleteUser(uid)
    await userRef.delete()
    await writeSystemAdminActivity(req, {
      action: 'Deleted system administrator',
      details: `Deleted ${userData.fullName || userData.email || uid}'s administrator account.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })
    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete system administrator:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to delete administrator account' })
  }
})

app.post('/admin/reject-clinic-registration', requireAuth, requireRole(['superadmin']), requirePermission('system:clinics:verify'), async (req, res) => {

  const uid = String(req.body?.uid || '').trim()
  const rejectionReason = String(req.body?.rejectionReason || '').trim()
  const reviewedBy = String(req.body?.reviewedBy || '').trim() || null

  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'uid is required',
    })
  }

  if (!rejectionReason) {
    return res.status(400).json({
      success: false,
      error: 'rejectionReason is required',
    })
  }

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(uid)
    const clinicRef = firestore.collection('clinics').doc(uid)
    const [userBeforeRejection, clinicBeforeRejection] = await Promise.all([userRef.get(), clinicRef.get()])
    const userData = userBeforeRejection.exists ? userBeforeRejection.data() || {} : {}
    const clinicData = clinicBeforeRejection.exists ? clinicBeforeRejection.data() || {} : {}
    const recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
    const applicantName = String(userData.firstName || '').trim() || 'Applicant'

    // Write rejection audit fields first, then hard delete docs.
    await Promise.all([
      userRef.set(
        {
          status: 'Rejected',
          rejectionReason,
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedBy,
        },
        { merge: true }
      ),
      clinicRef.set(
        {
          approvalStatus: 'Rejected',
          rejectionReason,
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedBy,
        },
        { merge: true }
      ),
    ])

    await Promise.all([
      userRef.delete(),
      firestore.recursiveDelete(clinicRef),
    ])

    try {
      await admin.auth().deleteUser(uid)
    } catch (authError) {
      if (authError?.code !== 'auth/user-not-found') {
        throw authError
      }
    }

    await writeSystemAdminActivity(req, {
      action: 'Rejected clinic registration',
      module: 'Clinic Verification',
      details: `Rejected ${applicantName}'s clinic registration. Reason: ${rejectionReason}`,
      targetId: uid,
      targetName: applicantName,
    })

    let emailSent = false
    if (recipient && postmarkClient && senderEmail) {
      try {
        const registrationUrl = `${resolveFrontendBaseUrl(req)}/clinic/register`
        const subject = 'AesthetiCare - Clinic Registration Update'
        const textBody = `Hi ${applicantName},

Your clinic registration was not approved at this time.

Reason provided by the system administrator:
${rejectionReason}

You may correct the information or documents and submit a new clinic registration here:
${registrationUrl}

Please make sure that your details and uploaded documents are complete, valid, and readable before submitting again.

Regards,
The AesthetiCare Team`
        const htmlReason = rejectionReason
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Your clinic registration was not approved at this time.</p><p><strong>Reason provided by the system administrator:</strong></p><p>${htmlReason}</p><p>You may correct the information or documents and submit a new clinic registration here:</p><p><a href="${registrationUrl}">${registrationUrl}</a></p><p>Please make sure that your details and uploaded documents are complete, valid, and readable before submitting again.</p><p>Regards,<br>The AesthetiCare Team</p></div>`
        await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
        emailSent = true
      } catch (emailError) {
        console.warn('Failed to send clinic rejection email:', emailError?.message || emailError)
      }
    }

    return res.json({
      success: true,
      data: { uid, deleted: true, emailSent },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to reject and delete account',
    })
  }
})

// Admin-triggered OCR processing for clinic registration documents (production-safe)
app.post('/admin/trigger-ocr', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  // Production: require authenticated admin role instead of a static secret
  if (!adminReady) {
    return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin not ready' })
  }

  const { uid, docKey, storagePath, force } = req.body ?? {}
  if (!uid || !docKey || !storagePath) {
    return res.status(400).json({ success: false, error: 'uid, docKey and storagePath are required' })
  }

  try {
    const firestore = admin.firestore()
    const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
    if (!bucketName) return res.status(500).json({ success: false, error: 'Storage bucket not configured' })

    const reviewRef = firestore.collection('clinics').doc(uid).collection('documentReviews').doc(docKey)
    const reviewSnap = await reviewRef.get()
    const alreadyProcessed = reviewSnap.exists && reviewSnap.data()?.processedAt
    if (alreadyProcessed && !force) {
      return res.status(409).json({ success: false, error: 'Document already processed', processedAt: reviewSnap.data()?.processedAt })
    }

    // Mark as processing to avoid concurrent duplicate runs
    await reviewRef.set({ processing: true, processingStartedAt: admin.firestore.FieldValue.serverTimestamp(), processedBy: req.user?.uid || null }, { merge: true })

    const visionClient = createVisionClient()
    if (!visionClient) {
      return res.status(503).json({
        success: false,
        error: 'OCR is not configured. Add a valid Firebase service-account credential to the backend environment.',
      })
    }
    const gcsUri = `gs://${bucketName}/${String(storagePath || '').replace(/^\/+/, '')}`

    // Attempt document OCR (documentTextDetection works for many image/PDF inputs via GCS URI)
    let fullText = ''
    try {
      const [result] = await visionClient.documentTextDetection(gcsUri)
      fullText = String(result?.fullTextAnnotation?.text || '')
    } catch (visionErr) {
      console.warn('Vision documentTextDetection failed, attempting textDetection as fallback', visionErr?.message || visionErr)
      try {
        const [result2] = await visionClient.textDetection(gcsUri)
        fullText = String(result2?.textAnnotations?.[0]?.description || '')
      } catch (visionErr2) {
        console.error('Vision OCR failed for', gcsUri, visionErr2?.message || visionErr2)
        await reviewRef.set({
          storagePath,
          error: String(visionErr2?.message || visionErr?.message || 'Vision OCR failed'),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          confidence: 0,
          processing: false,
        }, { merge: true })
        // add audit entry
        await firestore.collection('clinics').doc(uid).collection('reviewHistory').add({ action: 'ocr-failed', docKey, processedBy: req.user?.uid || null, error: String(visionErr2?.message || visionErr?.message || 'Vision OCR failed'), ts: admin.firestore.FieldValue.serverTimestamp() })
        return res.status(500).json({ success: false, error: 'OCR processing failed' })
      }
    }

    // Basic heuristics for POC: detect expiry-like dates and simple name/clinic matching
    const expiryRegex = /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/g
    const expiryMatches = fullText.match(expiryRegex) || []
    const expiryFound = expiryMatches.length > 0

    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const [clinicSnap, userSnap] = await Promise.all([clinicRef.get(), userRef.get()])
    const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {}
    const userData = userSnap.exists ? userSnap.data() || {} : {}

    const clinicName = String(clinicData.clinicName || clinicData.companyName || '').toLowerCase()
    const ownerName = `${String(userData.firstName || '')} ${String(userData.lastName || '')}`.trim().toLowerCase()
    const textLower = fullText.toLowerCase()

    let nameMatches = 0
    if (clinicName && clinicName.length >= 3 && textLower.includes(clinicName)) nameMatches++
    if (ownerName && ownerName.length >= 3 && textLower.includes(ownerName)) nameMatches++
    const nameScore = Math.min(1, nameMatches / 2)

    // Combine heuristics into a confidence score [0..1]
    let confidence = 0.5 + (nameScore * 0.25) + (expiryFound ? 0.25 : 0)
    confidence = Math.max(0, Math.min(1, confidence))

    const ocrRecord = {
      uid,
      docKey,
      storagePath,
      extractedText: fullText ? fullText.slice(0, 10000) : '',
      expiryFound,
      expiryMatches,
      nameScore,
      confidence,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: req.user?.uid || null,
    }

    await reviewRef.set(ocrRecord, { merge: true })

    // Update clinics.<uid>.submittedDocuments.<docKey> with ocr metadata and verified flag when confident
    const clinicDataLatest = clinicSnap.exists ? (clinicSnap.data() || {}) : {}
    const submittedDocs = clinicDataLatest.submittedDocuments || {}
    const existingDocEntry = submittedDocs[docKey] || {}
    const updatedDocEntry = {
      ...existingDocEntry,
      ocr: {
        confidence,
        nameScore,
        expiryFound,
        processedAt: new Date().toISOString(),
      },
      processing: false,
    }
    if (confidence >= (Number(process.env.OCR_AUTO_APPROVE_THRESHOLD || 0.85))) {
      updatedDocEntry.verified = true
      updatedDocEntry.verifiedAt = admin.firestore.FieldValue.serverTimestamp()
    }

    submittedDocs[docKey] = updatedDocEntry
    await clinicRef.set({ submittedDocuments: submittedDocs }, { merge: true })

    // add audit entry for OCR processing
    await clinicRef.collection('reviewHistory').add({ action: 'ocr-processed', docKey, processedBy: req.user?.uid || null, confidence, force: !!force, ts: admin.firestore.FieldValue.serverTimestamp() })
    await writeSystemAdminActivity(req, {
      action: 'Processed registration document OCR',
      module: 'Clinic Verification',
      details: `Processed ${docKey} for ${userData.fullName || userData.email || uid} with ${(confidence * 100).toFixed(1)}% confidence.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })

    // If all submitted documents are verified, auto-approve the clinic
    const allDocKeys = REGISTRATION_DOCUMENT_REQUIREMENTS.clinic
    const allVerified = allDocKeys.every((k) => Boolean(submittedDocs[k]?.verified))
    if (allVerified) {
      await clinicRef.set({
        approvalStatus: 'Approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        subscriptionOnboardingRequired: true,
      }, { merge: true })
      await userRef.set({
        status: 'Active',
        subscriptionOnboardingRequired: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })

      // Send welcome email to clinic owner (best-effort)
      const recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
      if (recipient && postmarkClient && senderEmail) {
        try {
          const loginUrl = `${frontendBaseUrl}/login`
          const subject = 'Welcome to AesthetiCare — Your Clinic is Approved'
          const textBody = `Hi ${String(userData.firstName || '').trim() || 'User'},\n\nYour clinic registration has been approved. You can now log in at ${loginUrl}.\n\nThank you for joining AesthetiCare.`
          const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(userData.firstName || '').trim() || 'User'},</p><p>Your clinic registration has been <strong>approved</strong>. You can now <a href="${loginUrl}">log in</a> to access your account.</p><p>Thank you for joining AesthetiCare.</p></div>`
          await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
        } catch (emailErr) {
          console.warn('Failed to send clinic welcome email (auto-approve):', emailErr?.message || emailErr)
        }
      }
    }

    return res.json({ success: true, data: { uid, docKey, confidence, autoApproved: updatedDocEntry.verified || false } })
  } catch (error) {
    console.error('OCR processing error:', error)
    // best-effort: unset processing flag so future retries can proceed
    try {
      const firestore = admin.firestore()
      await firestore.collection('clinics').doc(uid).collection('documentReviews').doc(docKey).set({ processing: false, processingError: String(error?.message || error), processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      await firestore.collection('clinics').doc(uid).collection('reviewHistory').add({ action: 'ocr-failed', docKey, processedBy: req.user?.uid || null, error: String(error?.message || error), ts: admin.firestore.FieldValue.serverTimestamp() })
    } catch (e) {
      console.warn('Failed to write OCR failure metadata:', e?.message || e)
    }
    return res.status(500).json({ success: false, error: error?.message || 'OCR processing failed' })
  }
})

// Admin clinic review endpoints (lightweight)
app.get('/admin/clinic-review/:uid', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const uid = String(req.params?.uid || '').trim()
  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })
  try {
    const firestore = admin.firestore()
    const [clinicSnap, userSnap] = await Promise.all([
      firestore.collection('clinics').doc(uid).get(),
      firestore.collection('users').doc(uid).get(),
    ])
    if (!clinicSnap.exists && !userSnap.exists) return res.status(404).json({ success: false, error: 'Clinic or user not found' })
    const clinicData = clinicSnap.exists ? clinicSnap.data() : {}
    const userData = userSnap.exists ? userSnap.data() : {}

    const submittedDocuments = clinicData.submittedDocuments || {}
    const reviewsSnap = await firestore.collection('clinics').doc(uid).collection('documentReviews').get()
    const documentReviews = {}
    reviewsSnap.forEach((d) => (documentReviews[d.id] = d.data()))

    const historySnap = await firestore.collection('clinics').doc(uid).collection('reviewHistory').orderBy('ts','desc').limit(50).get()
    const reviewHistory = []
    historySnap.forEach((d) => reviewHistory.push({ id: d.id, ...d.data() }))

    return res.json({ success: true, data: { uid, clinic: clinicData, user: userData, submittedDocuments, documentReviews, reviewHistory } })
  } catch (error) {
    console.error('clinic-review error', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to load clinic review' })
  }
})

app.post('/admin/document/verify', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const { uid, docKey, reviewer, note } = req.body ?? {}
  if (!uid || !docKey) return res.status(400).json({ success: false, error: 'uid and docKey are required' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const [clinicSnap, userSnap] = await Promise.all([clinicRef.get(), userRef.get()])
    const clinicData = clinicSnap.exists ? clinicSnap.data() : {}
    const userData = userSnap.exists ? userSnap.data() : {}

    const submittedDocs = clinicData.submittedDocuments || {}
    const existing = submittedDocs[docKey] || {}
    existing.verified = true
    existing.verifiedAt = admin.firestore.FieldValue.serverTimestamp()
    submittedDocs[docKey] = existing

    await Promise.all([
      clinicRef.set({ submittedDocuments: submittedDocs }, { merge: true }),
      clinicRef.collection('reviewHistory').add({ action: 'document-verified', docKey, reviewer: reviewer || null, note: note || null, ts: admin.firestore.FieldValue.serverTimestamp() }),
    ])
    await writeSystemAdminActivity(req, {
      action: 'Verified clinic document',
      module: 'Clinic Verification',
      details: `Verified ${docKey} for ${userData.fullName || userData.email || uid}.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })

    const allKeys = REGISTRATION_DOCUMENT_REQUIREMENTS.clinic
    const allVerified = allKeys.every((k) => Boolean(submittedDocs[k]?.verified))
    if (allVerified) {
      await Promise.all([
        clinicRef.set({
          approvalStatus: 'Approved',
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          subscriptionOnboardingRequired: true,
        }, { merge: true }),
        userRef.set({
          status: 'Active',
          subscriptionOnboardingRequired: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
      ])

      const recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
      if (recipient && postmarkClient && senderEmail) {
        try {
          const loginUrl = `${frontendBaseUrl}/login`
          const subject = 'Welcome to AesthetiCare — Your Clinic is Approved'
          const textBody = `Hi ${String(userData.firstName || '').trim() || 'User'},\n\nYour clinic registration has been approved. You can now log in at ${loginUrl}.\n\nThank you for joining AesthetiCare.`
          const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(userData.firstName || '').trim() || 'User'},</p><p>Your clinic registration has been <strong>approved</strong>. You can now <a href="${loginUrl}">log in</a> to access your account.</p><p>Thank you for joining AesthetiCare.</p></div>`
          await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
        } catch (emailErr) {
          console.warn('Failed to send clinic welcome email (manual verify):', emailErr?.message || emailErr)
        }
      }
    }

    return res.json({ success: true, data: { uid, docKey, allVerified } })
  } catch (error) {
    console.error('document verify error', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to verify document' })
  }
})

app.post('/admin/document/reject', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const { uid, docKey, reviewer, reason } = req.body ?? {}
  if (!uid || !docKey) return res.status(400).json({ success: false, error: 'uid and docKey are required' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const [clinicSnap, userSnap] = await Promise.all([clinicRef.get(), userRef.get()])
    const clinicData = clinicSnap.exists ? clinicSnap.data() : {}
    const userData = userSnap.exists ? userSnap.data() : {}

    const submittedDocs = clinicData.submittedDocuments || {}
    const existing = submittedDocs[docKey] || {}
    existing.verified = false
    existing.rejectionReason = reason || null
    existing.rejectedAt = admin.firestore.FieldValue.serverTimestamp()
    submittedDocs[docKey] = existing

    await Promise.all([
      clinicRef.set({ submittedDocuments: submittedDocs, approvalStatus: 'Pending Approval' }, { merge: true }),
      clinicRef.collection('reviewHistory').add({ action: 'document-rejected', docKey, reviewer: reviewer || null, reason: reason || null, ts: admin.firestore.FieldValue.serverTimestamp() }),
    ])
    await writeSystemAdminActivity(req, {
      action: 'Rejected clinic document',
      module: 'Clinic Verification',
      details: `Rejected ${docKey} for ${userData.fullName || userData.email || uid}. Reason: ${reason || 'Not provided'}`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })

    const recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
    if (recipient && postmarkClient && senderEmail) {
      try {
        const subject = 'AesthetiCare — Document Reupload Requested'
        const textBody = `Hi ${String(userData.firstName || '').trim() || 'User'},\n\nWe were unable to verify one of your submitted documents (${docKey}). Reason: ${reason || 'Please reupload a clearer/valid document.'}\n\nPlease log in and upload a new copy of the document.`
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(userData.firstName || '').trim() || 'User'},</p><p>We were unable to verify one of your submitted documents (<strong>${docKey}</strong>).</p><p>Reason: ${reason || 'Please reupload a clearer/valid document.'}</p><p>Please log in and upload a new copy of the document.</p></div>`
        await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
      } catch (emailErr) {
        console.warn('Failed to send document rejection email:', emailErr?.message || emailErr)
      }
    }

    return res.json({ success: true, data: { uid, docKey } })
  } catch (error) {
    console.error('document reject error', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to reject document' })
  }
})

app.post('/admin/clinic/approve', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const { uid, reviewer, note } = req.body ?? {}
  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const [clinicSnap, userSnap] = await Promise.all([clinicRef.get(), userRef.get()])
    const clinicData = clinicSnap.exists ? clinicSnap.data() : {}
    const userData = userSnap.exists ? userSnap.data() : {}

    const submittedDocuments = clinicData.submittedDocuments || {}
    const missingDocuments = REGISTRATION_DOCUMENT_REQUIREMENTS.clinic.filter((docKey) => !submittedDocuments[docKey]?.url && !submittedDocuments[docKey]?.path)
    if (missingDocuments.length) {
      return res.status(409).json({
        success: false,
        error: 'Cannot approve a clinic with missing required documents.',
        missingDocuments,
      })
    }

    await Promise.all([
      clinicRef.set({
        approvalStatus: 'Approved',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: reviewer || null,
        subscriptionOnboardingRequired: true,
      }, { merge: true }),
      userRef.set({
        status: 'Active',
        subscriptionOnboardingRequired: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      clinicRef.collection('reviewHistory').add({ action: 'clinic-approved', reviewer: reviewer || null, note: note || null, ts: admin.firestore.FieldValue.serverTimestamp() }),
    ])
    await writeSystemAdminActivity(req, {
      action: 'Approved clinic registration',
      module: 'Clinic Verification',
      details: `Approved ${userData.fullName || userData.email || uid}'s clinic registration.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })

    const recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
    if (recipient && postmarkClient && senderEmail) {
      try {
        const loginUrl = `${frontendBaseUrl}/login`
        const subject = 'Welcome to AesthetiCare — Your Clinic is Approved'
        const textBody = `Hi ${String(userData.firstName || '').trim() || 'User'},\n\nYour clinic registration has been approved. You can now log in at ${loginUrl}.\n\nThank you for joining AesthetiCare.`
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(userData.firstName || '').trim() || 'User'},</p><p>Your clinic registration has been <strong>approved</strong>. You can now <a href="${loginUrl}">log in</a> to access your account.</p><p>Thank you for joining AesthetiCare.</p></div>`
        await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
      } catch (emailErr) {
        console.warn('Failed to send clinic welcome email (manual approve):', emailErr?.message || emailErr)
      }
    }

    return res.json({ success: true, data: { uid, approved: true } })
  } catch (error) {
    console.error('clinic approve error', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to approve clinic' })
  }
})

app.post('/admin/supplier/approve', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:suppliers:verify'), async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const reviewer = String(req.body?.reviewer || req.user.uid || '').trim()
  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })

  try {
    const firestore = admin.firestore()
    const applicationRef = firestore.collection('supplierApplications').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const [applicationSnap, userSnap] = await Promise.all([applicationRef.get(), userRef.get()])
    if (!applicationSnap.exists) return res.status(404).json({ success: false, error: 'Supplier application not found' })
    const application = applicationSnap.data() || {}
    const user = userSnap.exists ? userSnap.data() || {} : {}
    const supplierRef = firestore.collection('suppliers').doc(uid)
    const supplierPayload = {
      ownerId: uid,
      name: application.businessName || application.name || 'Supplier',
      businessName: application.businessName || application.name || 'Supplier',
      email: application.email || user.email || '',
      contactNumber: application.contactNumber || user.contactNumber || '',
      businessType: application.businessType || user.businessType || '',
      contact: application.contactNumber || user.contactNumber || '',
      phone: application.contactNumber || user.contactNumber || '',
      address: application.businessAddress || user.address || '',
      businessAddress: application.businessAddress || user.address || '',
      businessAddressStreet: application.businessAddressStreet || user.addressStreet || '',
      businessAddressBarangay: application.businessAddressBarangay || user.addressBarangay || '',
      businessAddressCity: application.businessAddressCity || user.addressCity || '',
      businessAddressProvince: application.businessAddressProvince || user.addressProvince || '',
      businessAddressPostalCode: application.businessAddressPostalCode || user.addressPostalCode || '',
      businessAddressLat: application.businessAddressLat || user.addressLat || '',
      businessAddressLng: application.businessAddressLng || user.addressLng || '',
      taxRegistrationNumber: application.taxRegistrationNumber || user.taxRegistrationNumber || '',
      approvalStatus: 'Approved',
      status: 'Active',
      reviewedBy: reviewer,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: application.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      offeredItems: Array.isArray(application.offeredItems) ? application.offeredItems : [],
      documents: application.documents || {},
    }
    const batch = firestore.batch()
    batch.set(applicationRef, {
      approvalStatus: 'Approved',
      status: 'Active',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: reviewer,
      rejectionReason: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    batch.set(userRef, {
      role: 'Supplier',
      userType: 'supplier',
      approvalStatus: 'Approved',
      status: 'Active',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    batch.set(supplierRef, supplierPayload, { merge: true })
    batch.set(applicationRef.collection('verificationHistory').doc(), {
      action: 'supplier-approved',
      reviewer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await batch.commit()
    await writeSystemAdminActivity(req, {
      action: 'Approved supplier registration',
      module: 'Supplier Verification',
      details: `Approved ${application.businessName || application.name || user.email || uid}'s supplier registration.`,
      targetId: uid,
      targetName: application.businessName || application.name || user.email || uid,
    })
    return res.json({ success: true, data: { uid, approved: true } })
  } catch (error) {
    console.error('supplier approve error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to approve supplier' })
  }
})

app.post('/admin/supplier/reject', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:suppliers:verify'), async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const reason = String(req.body?.reason || '').trim()
  const reviewer = String(req.body?.reviewer || req.user.uid || '').trim()
  if (!uid || !reason) return res.status(400).json({ success: false, error: 'uid and reason are required' })

  try {
    const firestore = admin.firestore()
    const applicationRef = firestore.collection('supplierApplications').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const supplierRef = firestore.collection('suppliers').doc(uid)
    const [applicationSnap, userSnap] = await Promise.all([applicationRef.get(), userRef.get()])
    const application = applicationSnap.exists ? applicationSnap.data() || {} : {}
    const user = userSnap.exists ? userSnap.data() || {} : {}
    const recipient = String(application.email || user.email || '').trim().toLowerCase()
    const applicantName = String(user.fullName || '').trim()
      || `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim()
      || String(application.businessName || '').trim()
      || 'Applicant'

    let emailSent = false
    if (recipient && postmarkClient && senderEmail) {
      try {
        const registrationUrl = `${resolveFrontendBaseUrl(req)}/register?account=supplier`
        const subject = 'AesthetiCare - Supplier Registration Update'
        const textBody = `Hi ${applicantName},\n\nYour supplier registration was rejected.\n\nReason provided by the system administrator:\n${reason}\n\nYou may submit a new supplier registration after correcting the information or documents:\n${registrationUrl}\n\nRegards,\nThe AesthetiCare Team`
        const htmlReason = reason
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Your supplier registration was rejected.</p><p><strong>Reason provided by the system administrator:</strong></p><p>${htmlReason}</p><p>You may submit a new supplier registration after correcting the information or documents:</p><p><a href="${registrationUrl}">${registrationUrl}</a></p><p>Regards,<br>The AesthetiCare Team</p></div>`
        await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
        emailSent = true
      } catch (emailError) {
        console.warn('Failed to send supplier rejection email:', emailError?.message || emailError)
      }
    }

    // Rejecting a registration permanently removes its login and registration data.
    try {
      await admin.auth().deleteUser(uid)
    } catch (authError) {
      if (authError?.code !== 'auth/user-not-found') throw authError
    }

    await Promise.all([
      firestore.recursiveDelete(applicationRef),
      userRef.delete(),
      supplierRef.delete(),
    ])
    await writeSystemAdminActivity(req, {
      action: 'Rejected supplier registration',
      module: 'Supplier Verification',
      details: `Rejected and deleted ${applicantName}'s supplier registration. Reason: ${reason}`,
      targetId: uid,
      targetName: applicantName,
    })
    return res.json({ success: true, data: { uid, rejected: true, deleted: true, emailSent } })
  } catch (error) {
    console.error('supplier reject error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to reject supplier' })
  }
})

app.post(OTP_PATH, async (req, res) => {
  try {
    const { recipient, otp } = req.body ?? {}
    const normalizedRecipient = String(recipient || '').trim().toLowerCase()
    const normalizedOtp = String(otp || '').trim()

    if (!normalizedRecipient || !normalizedOtp) {
      return res.status(400).json({
        success: false,
        error: 'recipient and otp are required',
      })
    }

    if (!EMAIL_ADDRESS_REGEX.test(normalizedRecipient)) {
      return res.status(400).json({
        success: false,
        error: 'recipient must be a valid email address',
      })
    }

    if (!postmarkClient || !senderEmail) {
      return res.status(500).json({
        success: false,
        error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
      })
    }

    const message = {
      to: normalizedRecipient,
      from: senderEmail,
      subject: 'Your OTP Code',
      text:
        `Your one-time password is: ${normalizedOtp}\n\n` +
        `This code is only valid for ${REGISTRATION_OTP_EXPIRY_MINUTES} minutes. ` +
        `It expires after that time.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
          <p>Your one-time password is:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${normalizedOtp}</p>
          <p>This code is only valid for ${REGISTRATION_OTP_EXPIRY_MINUTES} minutes.</p>
          <p>It expires after that time.</p>
        </div>
      `,
    }

    const delivery = await sendPostmarkMessage(message)

    console.log('Postmark registration OTP sent', {
      status: delivery.statusCode || 'unknown',
      messageId: delivery.messageId || 'unknown',
      to: normalizedRecipient,
    })
    return res.json({ success: true, ...delivery })
  } catch (error) {
    const providerMessage = extractProviderError(error)

    console.error('Postmark registration OTP error:', {
      error: providerMessage,
    })
    return res.status(500).json({ success: false, error: providerMessage })
  }
})

app.post(CHECK_REGISTRATION_ATTEMPT_PATH, async (req, res) => {
  const { email, purpose } = req.body ?? {}
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const purposeMap = {
    clinic: CLINIC_REGISTRATION_OTP_PURPOSE,
    customer: CUSTOMER_REGISTRATION_OTP_PURPOSE,
    supplier: SUPPLIER_REGISTRATION_OTP_PURPOSE,
  }
  const normalizedPurpose = purposeMap[String(purpose || '').trim().toLowerCase()]

  if (!normalizedEmail || !EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email is required.' })
  }
  if (!normalizedPurpose) {
    return res.status(400).json({ success: false, error: 'A valid registration type is required.' })
  }

  try {
    const result = await recordRegistrationAttempt({
      email: normalizedEmail,
      purpose: normalizedPurpose,
      ip: getRequestIp(req),
    })
    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      })
    }
    return res.json({ success: true })
  } catch (error) {
    console.error('Registration attempt rate-limit error:', error)
    return res.status(503).json({
      success: false,
      error: 'Registration protection is temporarily unavailable. Please try again shortly.',
    })
  }
})

app.post(REQUEST_REGISTRATION_OTP_PATH, async (req, res) => {
  const { email, uid } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  try {
    const otpResult = await sendRegistrationOtpMessage({
      email: normalizedEmail,
      uid: normalizedUid,
      purpose: CLINIC_REGISTRATION_OTP_PURPOSE,
    })

    console.log('Registration OTP sent', {
      to: normalizedEmail,
      maskedTo: maskEmailAddress(normalizedEmail),
      status: otpResult.delivery.statusCode || 'unknown',
      messageId: otpResult.delivery.messageId || 'unknown',
      expiresAt: otpResult.expiresAt.toISOString(),
    })

    return res.json({
      success: true,
      recipient: normalizedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      retryAfterSeconds: otpResult.retryAfterSeconds,
      messageId: otpResult.delivery.messageId || null,
    })
  } catch (error) {
    if (error?.statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      })
    }
    const providerMessage = extractProviderError(error)
    console.error('Registration OTP request error:', {
      email: normalizedEmail,
      error: providerMessage,
    })
    return res.status(500).json({
      success: false,
      error: providerMessage,
    })
  }
})

app.post(REQUEST_LOGIN_OTP_PATH, requireAuth, async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase()
  const requestedUid = String(req.body?.uid || '').trim()
  const requestId = crypto.randomUUID()
  let failureStage = 'validation'

  const logLoginOtpFailure = (stage, error = null) => {
    console.error('LOGIN_OTP_FAILURE', {
      requestId,
      stage,
      uid: requestedUid || null,
      email: maskEmailAddress(normalizedEmail),
      firebaseAdminReady: adminReady,
      explicitFirebaseCredentials: Boolean(googleCloudCredential),
      postmarkConfigured: Boolean(postmarkClient && senderEmail),
      errorName: error?.name || null,
      errorCode: error?.code || error?.statusCode || null,
      errorMessage: error?.message || null,
      stack: isDevelopment ? error?.stack || null : undefined,
    })
  }

  if (!adminReady || !googleCloudCredential) {
    logLoginOtpFailure('firebase_configuration')
    return res.status(503).json({
      success: false,
      error: 'Login service is not configured on the production backend.',
      requestId,
    })
  }

  if (!postmarkClient || !senderEmail) {
    logLoginOtpFailure('postmark_configuration')
    return res.status(503).json({
      success: false,
      error: 'Login OTP email service is not configured on the production backend.',
      requestId,
    })
  }

  if (!normalizedEmail || !EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email is required.' })
  }
  if (!requestedUid || requestedUid !== String(req.user?.uid || '').trim()) {
    return res.status(403).json({ success: false, error: 'Login verification request is invalid.' })
  }

  try {
    failureStage = 'firestore_account_lookup'
    const userSnap = await admin.firestore().collection('users').doc(requestedUid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const roleKey = normalizeRoleKey(userData.role || userData.userType || '')
    if (roleKey !== 'Superadmin' && !isOwnerRoleValue(userData.role || userData.userType)) {
      return res.status(403).json({ success: false, error: 'Login OTP is not required for this account.' })
    }

    failureStage = 'firebase_auth_lookup'
    const authUser = await admin.auth().getUser(requestedUid)
    if (String(authUser.email || '').trim().toLowerCase() !== normalizedEmail) {
      return res.status(403).json({ success: false, error: 'Email does not match the account.' })
    }

    failureStage = 'otp_reservation_or_email_delivery'
    const otpResult = await sendRegistrationOtpMessage({
      email: normalizedEmail,
      uid: requestedUid,
      purpose: LOGIN_OTP_PURPOSE,
    })

    return res.json({
      success: true,
      recipient: normalizedEmail,
      expiresInSeconds: otpResult.expiresInSeconds,
      retryAfterSeconds: otpResult.retryAfterSeconds,
    })
  } catch (error) {
    if (error?.statusCode === 429) {
      logLoginOtpFailure('rate_limit', error)
      return res.status(429).json({ success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds })
    }
    logLoginOtpFailure('request_processing', error)
    return res.status(500).json({
      success: false,
      error: 'Unable to send login OTP. Please try again later.',
      requestId,
      stage: failureStage,
      errorCode: error?.code || error?.statusCode || null,
    })
  }
})

app.post(VERIFY_LOGIN_OTP_PATH, async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase()
  const normalizedUid = String(req.body?.uid || '').trim()
  const normalizedOtp = String(req.body?.otp || '').trim()
  if (!normalizedEmail || !normalizedUid || !/^\d{6}$/.test(normalizedOtp)) {
    return res.status(400).json({ success: false, error: 'Email, account, and a 6-digit OTP are required.' })
  }

  try {
    const firestore = admin.firestore()
    const authUser = await admin.auth().getUser(normalizedUid)
    if (String(authUser.email || '').trim().toLowerCase() !== normalizedEmail) {
      return res.status(403).json({ success: false, error: 'Email does not match the account.' })
    }
    const userSnap = await firestore.collection('users').doc(normalizedUid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const roleKey = normalizeRoleKey(userData.role || userData.userType || '')
    if (roleKey !== 'Superadmin' && !isOwnerRoleValue(userData.role || userData.userType)) {
      return res.status(403).json({ success: false, error: 'Login OTP is not required for this account.' })
    }

    const otpRef = getRegistrationOtpDocRef(LOGIN_OTP_PURPOSE, normalizedEmail)
    const otpSnap = await otpRef.get()
    if (!otpSnap.exists) {
      return res.status(400).json({ success: false, error: 'No active login OTP found. Please sign in again.' })
    }
    const otpData = otpSnap.data() || {}
    const expiresAt = getTimestampDate(otpData.expiresAt)
    if (otpData.used || (expiresAt && expiresAt.getTime() <= Date.now())) {
      await otpRef.set({ used: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      return res.status(400).json({ success: false, error: 'This login OTP has expired. Please sign in again.' })
    }
    if (String(otpData.uid || '').trim() !== normalizedUid || !otpMatches(otpData, normalizedOtp)) {
      const attempts = Number(otpData.attempts || 0) + 1
      await otpRef.set({
        attempts,
        used: attempts >= 5,
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: attempts >= 5 ? 'Too many invalid OTP attempts. Please sign in again.' : 'Invalid OTP. Please try again.',
      })
    }

    await otpRef.set({
      used: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return res.json({ success: true, data: { uid: normalizedUid } })
  } catch (error) {
    console.error('Login OTP verification error:', error)
    return res.status(400).json({ success: false, error: 'Unable to verify login OTP. Please try again.' })
  }
})

app.post(REQUEST_CUSTOMER_OTP_PATH, async (req, res) => {
  const { email, uid } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  try {
    const customerState = await getCustomerRegistrationState(normalizedEmail)
    const role = String(customerState.role || '').trim().toLowerCase()
    const status = String(customerState.status || '').trim().toLowerCase()
    const resolvedUid = normalizedUid || customerState.uid

    if (customerState.exists && role && role !== 'customer') {
      return res.status(409).json({
        success: false,
        error: 'This email is already used by another account type.',
      })
    }

    if (customerState.emailVerified || status === 'active') {
      return res.status(409).json({
        success: false,
        error: 'This customer account is already verified. Please sign in.',
      })
    }

    if (!resolvedUid) {
      return res.status(400).json({
        success: false,
        error: 'No customer registration was found for this email.',
      })
    }

    const otpResult = await sendRegistrationOtpMessage({
      email: normalizedEmail,
      uid: resolvedUid,
      purpose: CUSTOMER_REGISTRATION_OTP_PURPOSE,
    })

    console.log('Customer registration OTP sent', {
      uid: resolvedUid,
      to: normalizedEmail,
      maskedTo: maskEmailAddress(normalizedEmail),
      status: otpResult.delivery.statusCode || 'unknown',
      messageId: otpResult.delivery.messageId || 'unknown',
      expiresAt: otpResult.expiresAt.toISOString(),
    })

    return res.json({
      success: true,
      recipient: normalizedEmail,
      uid: resolvedUid,
      expiresInSeconds: otpResult.expiresInSeconds,
      retryAfterSeconds: otpResult.retryAfterSeconds,
      messageId: otpResult.delivery.messageId || null,
    })
  } catch (error) {
    if (error?.statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      })
    }

    const providerMessage = extractProviderError(error)
    console.error('Customer registration OTP request error:', {
      email: normalizedEmail,
      error: providerMessage,
    })
    return res.status(500).json({
      success: false,
      error: providerMessage,
    })
  }
})

app.post(RESET_PASSWORD_PATH, async (req, res) => {
  const { email, newPassword } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const passwordValue = String(newPassword || '')

  if (!normalizedEmail || !passwordValue) {
    return res.status(400).json({
      success: false,
      error: 'email and newPassword are required',
    })
  }

  if (passwordValue.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters.',
    })
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail)
    await admin.auth().updateUser(userRecord.uid, { password: passwordValue })
    // Clear the forced password-change flag so staff are not forced to
    // change their password again after a self-service reset.
    try {
      await admin.firestore().collection('users').doc(userRecord.uid).set(
        { mustChangePassword: false },
        { merge: true }
      )
    } catch (flagError) {
      console.warn('Failed to clear mustChangePassword after reset:', flagError?.message || flagError)
    }
    return res.json({ success: true })
  } catch (error) {
    const code = error?.code || ''
    const message =
      code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : error?.message || 'Failed to reset password.'
    return res.status(400).json({ success: false, error: message, code })
  }
})

// Bookings: create booking record and corresponding appointment (transactional) with availability checks
app.post('/bookings/create', requireAuth, async (req, res) => {
  const { reservation } = req.body ?? {}
  if (!reservation) return res.status(400).json({ success: false, error: 'reservation is required' })

  if (!adminReady) {
    return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  }

  try {
    const firestore = admin.firestore()
    const customerId = String(reservation.customerId || '').trim()
    if (!customerId || customerId !== String(req.user?.uid || '').trim()) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    // Validate basic reservation fields
    const practitionerId = String(reservation.practitionerId || '').trim()
    const branchId = String(reservation.branchId || '').trim()
    const date = String(reservation.date || '').trim()

    if (!practitionerId) return res.status(400).json({ success: false, error: 'practitionerId is required' })
    if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required' })
    if (!date) return res.status(400).json({ success: false, error: 'date is required' })

    // Compute requested booking time range in minutes
    const requestedRange = getBookingRange(reservation)
    if (!requestedRange) return res.status(400).json({ success: false, error: 'Invalid or missing time/duration for reservation' })

    const selectedServices = Array.isArray(reservation.selectedServices) ? reservation.selectedServices : []
    const consultationRequiredIds = selectedServices
      .filter((service) => service?.requiresConsultationFirst === true)
      .map((service) => String(service.id || '').trim())
      .filter(Boolean)

    if (consultationRequiredIds.length) {
      const consultationSnap = await firestore.collection('appointments')
        .where('customerId', '==', customerId)
        .where('type', '==', 'Consultation')
        .get()
      const hasCompletedConsultation = consultationSnap.docs.some((docSnap) => {
        const appointment = docSnap.data() || {}
        if (normalizeBookingStatus(appointment.status) !== 'completed') return false
        const coveredIds = Array.isArray(appointment.consultationForServiceIds)
          ? appointment.consultationForServiceIds.map((id) => String(id || '').trim())
          : []
        return consultationRequiredIds.every((id) => coveredIds.includes(id))
      })
      if (!hasCompletedConsultation) {
        return res.status(422).json({
          success: false,
          code: 'CONSULTATION_REQUIRED',
          error: 'A completed consultation is required before requesting one or more selected services.',
          requiredServiceIds: consultationRequiredIds,
        })
      }
    }

    // Fetch existing appointments for the same practitioner/branch/date and check for conflicts
    const apptQuery = firestore.collection('appointments')
      .where('branchId', '==', branchId)
      .where('practitionerId', '==', practitionerId)
      .where('date', '==', date)

    const apptSnap = await apptQuery.get()

    for (const docSnap of apptSnap.docs) {
      const appt = docSnap.data() || {}
      const existingRange = getBookingRange(appt)
      if (!existingRange) continue

      const existingStatus = normalizeBookingStatus(appt.status)
      if (!BOOKING_BLOCKING_STATUSES.has(existingStatus)) continue

      if (rangesOverlap(requestedRange.start, requestedRange.end, existingRange.start, existingRange.end)) {
        // Conflict found
        return res.status(409).json({
          success: false,
          error: 'Requested time conflicts with an existing appointment',
          conflict: {
            appointmentId: docSnap.id,
            practitionerId,
            branchId,
            date,
            time: appt.time || null,
            endTime: appt.endTime || null,
            status: appt.status || null,
            details: appt.service || appt.type || null,
          },
        })
      }
    }

    // No conflicts — proceed to create booking + appointment transactionally
    const bookingRef = firestore.collection('bookings').doc()
    const appointmentRef = firestore.collection('appointments').doc()

    const bookingPayload = {
      ...reservation,
      customerId,
      status: 'requested',
      createdBy: req.user?.uid || null,
      branchId,
      practitionerId,
      date,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    const appointmentPayload = buildBookingAppointmentPayload({
      reservation: {
        ...reservation,
        customerId,
        status: 'Pending Approval',
        paymentStatus: 'Pending',
        paymentCoverage: 'pending',
        source: 'customer_booking_request',
        bookingId: bookingRef.id,
      },
    })

    await firestore.runTransaction(async (tx) => {
      tx.set(bookingRef, bookingPayload)
      tx.set(appointmentRef, appointmentPayload)
      tx.update(bookingRef, { appointmentId: appointmentRef.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    })

    return res.json({ success: true, data: { bookingId: bookingRef.id, appointmentId: appointmentRef.id } })
  } catch (error) {
    console.error('bookings/create error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to create booking' })
  }
})

app.post(CHECK_USER_PATH, async (req, res) => {
  const { email } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail)
    return res.json({ success: true, exists: true, uid: userRecord.uid })
  } catch (error) {
    const code = error?.code || ''
    if (code === 'auth/user-not-found') {
      return res.json({ success: true, exists: false })
    }
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to check user.',
      code,
    })
  }
})

app.post(CHECK_CUSTOMER_REGISTRATION_STATUS_PATH, async (req, res) => {
  const { email } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  try {
    const customerState = await getCustomerRegistrationState(normalizedEmail)
    if (!customerState.exists) {
      return res.json({ success: true, exists: false })
    }

    const role = String(customerState.role || '').trim()
    const status = String(customerState.status || '').trim()
    const normalizedRole = role.toLowerCase()
    const normalizedStatus = status.toLowerCase()
    const canResumeOtp =
      normalizedRole === 'customer' &&
      !customerState.emailVerified &&
      normalizedStatus !== 'active'

    return res.json({
      success: true,
      exists: true,
      uid: customerState.uid,
      role,
      status,
      emailVerified: customerState.emailVerified,
      canResumeOtp,
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to check customer registration status.',
      code: error?.code || '',
    })
  }
})

app.post('/auth/check-registration-status', async (req, res) => {
  const { email } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail)
    const uid = userRecord.uid
    const firestore = admin.firestore()
    const [userSnap, clinicSnap] = await Promise.all([
      firestore.collection('users').doc(uid).get(),
      firestore.collection('clinics').doc(uid).get(),
    ])

    const userData = userSnap.data() || {}
    const clinicData = clinicSnap.data() || {}
    const userStatus = String(userData.status || '').toLowerCase()
    const clinicStatus = String(clinicData.approvalStatus || '').toLowerCase()
    const businessType =
      String(userData.businessType || clinicData.businessType || '').trim()

    const hasSubmittedDocs =
      Boolean(clinicData.documentsSubmittedAt) ||
      (clinicData.submittedDocuments && Object.keys(clinicData.submittedDocuments || {}).length > 0)

    const pendingApprovalSignals =
      userStatus.includes('pending approval') ||
      clinicStatus.includes('pending approval') ||
      clinicStatus.includes('waiting') ||
      clinicStatus.includes('for approval') ||
      clinicStatus.includes('submitted') ||
      hasSubmittedDocs

    let resumeStep = 1
    if (userStatus === 'active') {
      resumeStep = 'active'
    } else if (pendingApprovalSignals) {
      resumeStep = 4
    } else if (userStatus.includes('pending document') || clinicStatus.includes('pending document')) {
      resumeStep = 3
    } else if (userStatus.includes('pending otp') || clinicStatus.includes('pending otp')) {
      resumeStep = 2
    }

    return res.json({
      success: true,
      exists: true,
      uid,
      role: userData.role || userData.userType || '',
      resumeStep,
      userStatus,
      clinicStatus,
      hasSubmittedDocs,
      businessType,
    })
  } catch (error) {
    const code = error?.code || ''
    if (code === 'auth/user-not-found') {
      return res.json({ success: true, exists: false })
    }
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to check registration status.',
      code,
    })
  }
})

app.post('/auth/cleanup-partial-registration', async (req, res) => {
  const { uid, email } = req.body ?? {}
  const providedSecret = String(req.get('x-otp-backend-secret') || '').trim()
  const expectedSecret = String(process.env.OTP_BACKEND_CLEANUP_SECRET || '').trim()

  if (!expectedSecret) {
    return res.status(500).json({ success: false, error: 'OTP backend cleanup secret is not configured on the server' })
  }

  if (providedSecret !== expectedSecret) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  if (!adminReady) {
    return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  }

  if (!uid && !email) {
    return res.status(400).json({ success: false, error: 'uid or email is required' })
  }

  try {
    let resolvedUid = String(uid || '').trim()
    if (!resolvedUid && email) {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      try {
        const userRecord = await admin.auth().getUserByEmail(normalizedEmail)
        resolvedUid = userRecord.uid
      } catch (getErr) {
        // If the user is not found treat as no-op cleanup
        const code = getErr?.code || ''
        if (code === 'auth/user-not-found') {
          return res.json({ success: true, message: 'No matching user found; nothing to cleanup.' })
        }
        throw getErr
      }
    }

    if (!resolvedUid) {
      return res.status(400).json({ success: false, error: 'Unable to resolve uid' })
    }

    const firestore = admin.firestore()
    const deletions = await Promise.allSettled([
      firestore.collection('users').doc(resolvedUid).delete(),
      firestore.collection('clinics').doc(resolvedUid).delete(),
      admin.auth().deleteUser(resolvedUid),
    ])

    const deletedUsersDoc = deletions[0]?.status === 'fulfilled'
    const deletedClinicsDoc = deletions[1]?.status === 'fulfilled'
    const deletedAuthUser = deletions[2]?.status === 'fulfilled'

    return res.json({
      success: true,
      uid: resolvedUid,
      deletedUsersDoc,
      deletedClinicsDoc,
      deletedAuthUser,
      results: deletions.map((d) => ({ status: d.status, reason: d.reason?.message || null })),
    })
  } catch (error) {
    console.error('Cleanup partial registration error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to cleanup partial registration' })
  }
})

app.post(VERIFY_REGISTRATION_OTP_PATH, async (req, res) => {
  const { uid, email, otp } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  const normalizedOtp = String(otp || '').trim()
  if (!normalizedEmail || !normalizedOtp) {
    return res.status(400).json({
      success: false,
      error: 'email and otp are required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  try {
    let resolvedUid = normalizedUid
    let userRecord = null
    const firestore = admin.firestore()
    const otpRef = getRegistrationOtpDocRef(CLINIC_REGISTRATION_OTP_PURPOSE, normalizedEmail)
    const otpSnap = await otpRef.get()

    if (!otpSnap.exists) {
      return res.status(400).json({
        success: false,
        error: 'No active OTP found. Please request a new OTP.',
      })
    }

    const otpData = otpSnap.data() || {}
    if (!resolvedUid) {
      resolvedUid = String(otpData.uid || '').trim()
    }
    const expiresAt = getTimestampDate(otpData.expiresAt)
    if (otpData.used) {
      return res.status(400).json({
        success: false,
        error: 'This OTP was already used. Please request a new OTP.',
      })
    }

    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await otpRef.set({
        used: true,
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'OTP expired. Please request a new OTP.',
      })
    }

    if (!otpMatches(otpData, normalizedOtp)) {
      await otpRef.set({
        attempts: admin.firestore.FieldValue.increment(1),
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.',
      })
    }

    if (resolvedUid) {
      try {
        userRecord = await admin.auth().getUser(resolvedUid)
      } catch (error) {
        const code = String(error?.code || '')
        if (code !== 'auth/user-not-found') {
          throw error
        }
      }
    }

    const emailUserRecord = await admin.auth().getUserByEmail(normalizedEmail).catch(() => null)
    if (emailUserRecord?.uid) {
      resolvedUid = emailUserRecord.uid
      userRecord = emailUserRecord
    }

    let recordEmail = String(userRecord?.email || '').trim().toLowerCase()
    if (!emailUserRecord?.uid && (!resolvedUid || !recordEmail || recordEmail !== normalizedEmail)) {
      const matchingUsersSnap = await firestore
        .collection('users')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get()

      if (!matchingUsersSnap.empty) {
        resolvedUid = matchingUsersSnap.docs[0].id
        if (!recordEmail) {
          recordEmail = normalizedEmail
        }
      }
    }

    if (recordEmail && recordEmail !== normalizedEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match user record',
      })
    }

    if (!resolvedUid) {
      return res.status(400).json({
        success: false,
        error: 'Unable to resolve the registration account for this OTP.',
      })
    }

    await Promise.all([
      firestore.collection('users').doc(resolvedUid).set({
        status: 'Pending Document Submission',
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      firestore.collection('clinics').doc(resolvedUid).set({
        approvalStatus: 'Pending Document Submission',
      }, { merge: true }),
      otpRef.set({
        uid: resolvedUid,
        used: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    console.log('Registration OTP verified', {
      uid: resolvedUid,
      email: normalizedEmail,
      maskedTo: maskEmailAddress(normalizedEmail),
    })

    return res.json({ success: true, data: { uid: resolvedUid } })
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to verify OTP.',
      code: error?.code || '',
    })
  }
})

app.post(VERIFY_CUSTOMER_OTP_PATH, async (req, res) => {
  const { uid, email, otp } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  const normalizedOtp = String(otp || '').trim()
  if (!normalizedEmail || !normalizedOtp) {
    return res.status(400).json({
      success: false,
      error: 'email and otp are required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  try {
    let resolvedUid = normalizedUid
    const firestore = admin.firestore()
    const otpRef = getRegistrationOtpDocRef(CUSTOMER_REGISTRATION_OTP_PURPOSE, normalizedEmail)
    const otpSnap = await otpRef.get()

    if (!otpSnap.exists) {
      return res.status(400).json({
        success: false,
        error: 'No active OTP found. Please request a new OTP.',
      })
    }

    const otpData = otpSnap.data() || {}
    if (!resolvedUid) {
      resolvedUid = String(otpData.uid || '').trim()
    }
    const expiresAt = getTimestampDate(otpData.expiresAt)
    if (otpData.used) {
      return res.status(400).json({
        success: false,
        error: 'This OTP was already used. Please request a new OTP.',
      })
    }

    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await otpRef.set({
        used: true,
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'OTP expired. Please request a new OTP.',
      })
    }

    if (!otpMatches(otpData, normalizedOtp)) {
      await otpRef.set({
        attempts: admin.firestore.FieldValue.increment(1),
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.',
      })
    }

    const customerState = await getCustomerRegistrationState(normalizedEmail)
    const role = String(customerState.role || '').trim().toLowerCase()
    const status = String(customerState.status || '').trim().toLowerCase()

    if (customerState.exists && role && role !== 'customer') {
      return res.status(403).json({
        success: false,
        error: 'This email is already used by another account type.',
      })
    }

    if (!resolvedUid) {
      resolvedUid = customerState.uid
    }

    if (!resolvedUid) {
      return res.status(400).json({
        success: false,
        error: 'Unable to resolve the customer account for this OTP.',
      })
    }

    await Promise.all([
      firestore.collection('users').doc(resolvedUid).set({
        role: 'Customer',
        status: 'Active',
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      otpRef.set({
        uid: resolvedUid,
        used: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    console.log('Customer registration OTP verified', {
      uid: resolvedUid,
      email: normalizedEmail,
      maskedTo: maskEmailAddress(normalizedEmail),
      previousStatus: status || 'unknown',
    })

    // Send welcome email to customer (transactional)
    try {
      const loginUrl = `${resolveFrontendBaseUrl(req)}/login`
      const subject = 'Welcome to AestheticCare — Your account is ready'
      const textBody = `Hi,\n\nWelcome to AestheticCare! Your account has been verified and is ready to use.\n\nYou can sign in here: ${loginUrl}\n\nIf you need help, reply to this email or contact us at ${senderEmail}.\n\nWarm regards,\nThe AestheticCare Team`
      const htmlBody = `
        <div style="font-family:Arial, sans-serif;color:#222;">
          <p>Hi,</p>
          <p><strong>Welcome to AestheticCare!</strong> Your account has been verified and is ready to use.</p>
          <p><a href="${loginUrl}">Sign in to your account</a> to book services, save favorites, and more.</p>
          <p>If you need help, reply to this email or contact us at <a href="mailto:${senderEmail}">${senderEmail}</a>.</p>
          <p>Warm regards,<br/>The AestheticCare Team</p>
        </div>
      `

      const delivery = await sendPostmarkMessage({ to: normalizedEmail, subject, text: textBody, html: htmlBody })
      console.log('Sent welcome email to customer', { to: maskEmailAddress(normalizedEmail), statusCode: delivery.statusCode, messageId: delivery.messageId })
    } catch (emailErr) {
      console.error('Failed to send customer welcome email:', emailErr)
    }

    return res.json({ success: true, data: { uid: resolvedUid } })
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to verify OTP.',
      code: error?.code || '',
    })
  }
})

app.post('/auth/registration-profile', async (req, res) => {
  const { email } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(normalizedEmail)
    const uid = userRecord.uid
    const firestore = admin.firestore()
    const [userSnap, clinicSnap] = await Promise.all([
      firestore.collection('users').doc(uid).get(),
      firestore.collection('clinics').doc(uid).get(),
    ])

    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {}

    const safeDate = (value) => {
      if (!value) return null
      if (typeof value?.toDate === 'function') {
        const d = value.toDate()
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      if (value instanceof Date) return value.toISOString()
      if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      return null
    }

    return res.json({
      success: true,
      exists: true,
      uid,
      profile: {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        birthDate: safeDate(userData.birthDate),
        email: userData.email || normalizedEmail,
        contactNumber: userData.contactNumber || '',
        businessType: userData.businessType || clinicData.businessType || '',
        authorizedRepPosition: userData.authorizedRepPosition || clinicData.authorizedRepPosition || '',
        companyName: userData.companyName || clinicData.companyName || '',
        companyType: userData.companyType || clinicData.companyType || '',
        clinicName: clinicData.clinicName || '',
        clinicLocation: clinicData.clinicLocation || '',
        clinicLocationLat: clinicData.clinicLocationLat || '',
        clinicLocationLng: clinicData.clinicLocationLng || '',
        clinicLocationAddress: clinicData.clinicLocationAddress || '',
        subscriptionPlan: clinicData.subscriptionPlan || userData.subscriptionPlan || '',
        paymentStatus: clinicData.paymentStatus || userData.paymentStatus || '',
        paymentId: clinicData.paymentId || userData.paymentId || '',
        submittedDocuments: clinicData.submittedDocuments || {},
        draftDocuments: clinicData.draftDocuments || {},
        status: userData.status || '',
        approvalStatus: clinicData.approvalStatus || '',
      },
    })
  } catch (error) {
    const code = error?.code || ''
    if (code === 'auth/user-not-found') {
      return res.json({ success: true, exists: false })
    }
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to load registration profile.',
      code,
    })
  }
})

app.post('/admin/unpublish-expired-clinics', requireAuth, requireRole(['superadmin']), async (req, res) => {

  const ownerId = String(req.body?.ownerId || '').trim()
  const firestore = admin.firestore()
  const now = new Date()

  const toDate = (value) => {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    if (value instanceof Date) return value
    if (typeof value === 'number') return new Date(value)
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
  }

  try {
    const clinicsRef = firestore.collection('clinics')
    const clinicsSnapshot = ownerId
      ? await clinicsRef.where('ownerId', '==', ownerId).get()
      : await clinicsRef.get()

    if (clinicsSnapshot.empty) {
      return res.json({ success: true, updated: 0 })
    }

    const updates = []
    clinicsSnapshot.forEach((docSnap) => {
      const data = docSnap.data() || {}
      if (data.isPublished !== true) return
      const expiresAt = toDate(data.subscriptionExpiresAt)
      if (!expiresAt) return
      if (now.getTime() <= expiresAt.getTime()) return
      updates.push(
        docSnap.ref.update({
          isPublished: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      )
    })

    if (!updates.length) {
      return res.json({ success: true, updated: 0 })
    }

    await Promise.all(updates)
    return res.json({ success: true, updated: updates.length })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to unpublish expired clinics',
    })
  }
})

app.post('/dev/backfill-client-contact-info', requireAuth, requireRole(['superadmin']), async (_req, res) => {
  if (!isDevelopment || String(process.env.ENABLE_DEV_ENDPOINTS || '').toLowerCase() !== 'true') {
    return res.status(404).json({
      success: false,
      error: 'Not available in production.',
    })
  }

  try {
    const firestore = admin.firestore()
    const result = await runClientContactBackfill(firestore)
    return res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Client contact backfill failed:', error?.message || error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to backfill client contact info.',
    })
  }
})

app.post('/owner/subscription/plan-change-preview', requireAuth, async (req, res) => {
  const ownerUid = String(req.user?.uid || '').trim()
  const rawTargetPlan = String(req.body?.targetPlan || '').trim()
  const targetPlan = rawTargetPlan ? normalizePlanKey(rawTargetPlan) : ''

  if (!ownerUid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (!targetPlan || !['free', 'basic', 'premium'].includes(targetPlan)) {
    return res.status(400).json({ success: false, error: 'A valid target plan is required.' })
  }

  try {
    const firestore = admin.firestore()
    const userSnap = await firestore.collection('users').doc(ownerUid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    if (!isOwnerRoleValue(userData.role || userData.userType)) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const context = await loadOwnerSubscriptionContext(firestore, ownerUid)
    const now = new Date()
    const currentPlan = context.currentPlan
    const currentPriority = getPlanPriority(currentPlan)
    const targetPriority = getPlanPriority(targetPlan)
    const hasActiveCurrentCycle = Boolean(
      context.currentExpiresAt && context.currentExpiresAt.getTime() > now.getTime()
    )

    if (targetPlan === currentPlan && hasActiveCurrentCycle) {
      return res.json({
        success: true,
        data: {
          action: 'blocked_same_plan',
          currentPlan,
          targetPlan,
          message: "You're already on this plan.",
        },
      })
    }

    if (
      context.pendingPlan &&
      context.pendingPlan === targetPlan &&
      context.pendingApplyAt &&
      context.pendingApplyAt.getTime() > now.getTime()
    ) {
      return res.json({
        success: true,
        data: {
          action: 'blocked_pending_same_plan',
          currentPlan,
          targetPlan,
          effectiveAt: context.pendingApplyAt.toISOString(),
          message: 'This plan change is already scheduled for your next billing cycle.',
        },
      })
    }

    return res.json({
      success: true,
      data: {
        action: targetPriority < currentPriority && hasActiveCurrentCycle
          ? 'schedule_without_payment'
          : 'checkout',
        currentPlan,
        targetPlan,
        changeTiming: targetPriority < currentPriority && hasActiveCurrentCycle ? 'end_of_cycle' : 'immediate',
        effectiveAt:
          targetPriority < currentPriority && hasActiveCurrentCycle && context.currentExpiresAt
            ? context.currentExpiresAt.toISOString()
            : now.toISOString(),
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to evaluate plan change.',
    })
  }
})

app.post('/owner/subscription/schedule-plan-change', requireAuth, async (req, res) => {
  const ownerUid = String(req.user?.uid || '').trim()
  const rawTargetPlan = String(req.body?.targetPlan || '').trim()
  const targetPlan = rawTargetPlan ? normalizePlanKey(rawTargetPlan) : ''

  if (!ownerUid) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (!targetPlan || !['free', 'basic', 'premium'].includes(targetPlan)) {
    return res.status(400).json({
      success: false,
      error: 'A valid target plan is required.',
    })
  }

  try {
    const firestore = admin.firestore()
    const userSnap = await firestore.collection('users').doc(ownerUid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    if (!isOwnerRoleValue(userData.role || userData.userType)) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const context = await loadOwnerSubscriptionContext(firestore, ownerUid)
    const now = new Date()
    const hasActiveCurrentCycle = Boolean(
      context.currentExpiresAt && context.currentExpiresAt.getTime() > now.getTime()
    )

    if (context.currentPlan === targetPlan && hasActiveCurrentCycle) {
      return res.status(409).json({
        success: false,
        error: "You're already on this plan.",
        code: 'ALREADY_ON_PLAN',
      })
    }

    if (!hasActiveCurrentCycle || getPlanPriority(context.currentPlan) <= getPlanPriority(targetPlan)) {
      return res.status(400).json({
        success: false,
        error: 'This plan change does not need scheduling.',
      })
    }

    if (
      context.pendingPlan === targetPlan &&
      context.pendingApplyAt &&
      context.pendingApplyAt.getTime() > now.getTime()
    ) {
      return res.status(409).json({
        success: false,
        error: 'This plan change is already scheduled for your next billing cycle.',
        code: 'PLAN_CHANGE_ALREADY_SCHEDULED',
        data: {
          effectiveAt: context.pendingApplyAt.toISOString(),
        },
      })
    }

    const applyAt = context.currentExpiresAt
    const durationDays = getPlanDurationDays(targetPlan, context.pendingBillingCycle || 'month')
    const nextExpiresAt =
      getPlanPriority(targetPlan) === 0 ? null : new Date(applyAt.getTime() + durationDays * DAY_MS)

    await updateOwnerSubscriptionDocuments(firestore, ownerUid, {
      pendingSubscriptionPlan: targetPlan,
      pendingSubscriptionApplyAt: applyAt,
      pendingSubscriptionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      pendingSubscriptionChangeType: 'downgrade',
      pendingSubscriptionPaymentId: null,
      pendingSubscriptionPaidAt: null,
      pendingSubscriptionNextExpiresAt: nextExpiresAt,
      pendingSubscriptionBillingCycle: context.pendingBillingCycle || 'month',
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return res.json({
      success: true,
      data: {
        action: 'scheduled_downgrade',
        currentPlan: context.currentPlan,
        targetPlan,
        effectiveAt: applyAt.toISOString(),
        expiresAt: nextExpiresAt ? nextExpiresAt.toISOString() : null,
        message: 'Your plan downgrade is scheduled for the end of your current billing cycle.',
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to schedule plan change.',
    })
  }
})

app.post('/owner/backup', requireAuth, requirePermission('backups:create'), async (req, res) => {

  const ownerId = String(req.body?.ownerId || '').trim()
  if (!ownerId) {
    return res.status(400).json({
      success: false,
      error: 'ownerId is required',
    })
  }

  try {
    if (!req.user?.uid || req.user.uid !== ownerId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized backup request',
      })
    }

    const result = await generateOwnerBackup({ ownerId, kind: 'manual', triggeredBy: 'owner' })
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate backup',
    })
  }
})

app.post('/owner/backup/zip', requireAuth, requirePermission('backups:view'), async (req, res) => {

  const ownerId = String(req.body?.ownerId || '').trim()
  const storagePath = String(req.body?.storagePath || '').trim()
  const fileName = String(req.body?.fileName || 'backup').trim().replace(/\.json$/i, '')

  if (!ownerId || !storagePath) {
    return res.status(400).json({
      success: false,
      error: 'ownerId and storagePath are required',
    })
  }

  if (!storagePath.startsWith(`backups/${ownerId}/`)) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized backup path',
    })
  }

  try {
    if (!req.user?.uid || req.user.uid !== ownerId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized backup request',
      })
    }

    const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
    if (!bucketName) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Storage bucket is not configured.',
      })
    }

    const bucket = admin.storage().bucket(bucketName)
    const [jsonBuffer] = await bucket.file(storagePath).download()
    const zipBuffer = await zipJsonBuffer(jsonBuffer, fileName)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.zip"`)
    return res.status(200).send(zipBuffer)
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate ZIP backup',
    })
  }
})


if (backupScheduleEnabled && adminReady) {
  let lastDailyKey = ''
  let lastMonthlyKey = ''

  const toKey = (date) => date.toISOString().slice(0, 10)
  const toMonthKey = (date) => date.toISOString().slice(0, 7)

  const runScheduledBackups = async () => {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDate()
    const dailyKey = toKey(now)
    const monthlyKey = toMonthKey(now)

    const shouldRunDaily = hour === backupDailyHour && lastDailyKey !== dailyKey
    const shouldRunMonthly = hour === backupDailyHour && day === backupMonthlyDay && lastMonthlyKey !== monthlyKey

    if (!shouldRunDaily && !shouldRunMonthly) return

    try {
      const firestore = admin.firestore()
      const ownerIds = new Set()
      const ownersSnap = await firestore.collection('users').where('role', '==', 'Owner').get()
      ownersSnap.forEach((docSnap) => ownerIds.add(docSnap.id))
      const clinicsSnap = await firestore.collection('clinics').get()
      clinicsSnap.forEach((docSnap) => {
        const ownerId = docSnap.data()?.ownerId
        if (ownerId) ownerIds.add(ownerId)
      })

      const tasks = []
      ownerIds.forEach((ownerId) => {
        if (shouldRunDaily) tasks.push(generateOwnerBackup({ ownerId, kind: 'daily', triggeredBy: 'system' }))
        if (shouldRunMonthly) tasks.push(generateOwnerBackup({ ownerId, kind: 'monthly', triggeredBy: 'system' }))
      })

      if (tasks.length) {
        await Promise.allSettled(tasks)
      }
      if (shouldRunDaily) lastDailyKey = dailyKey
      if (shouldRunMonthly) lastMonthlyKey = monthlyKey
      console.log('Scheduled backups completed', { daily: shouldRunDaily, monthly: shouldRunMonthly })
    } catch (error) {
      console.error('Scheduled backup error:', error?.message || error)
    }
  }

  setInterval(runScheduledBackups, 15 * 60 * 1000)
  runScheduledBackups().catch(() => {})
}

app.post(ATTENDANCE_RECORD_PATH, requireAuth, requirePermission('attendance:create'), async (req, res) => {
  const { branchId, qrToken, latitude, longitude, accuracy } = req.body ?? {}
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId || !qrToken) {
    return res.status(400).json({ success: false, error: 'branchId and qrToken are required' })
  }

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(req.user.uid)
    const [userSnap, branchSnap] = await Promise.all([
      userRef.get(),
      firestore.collection('clinics').doc(normalizedBranchId).get(),
    ])
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const branch = branchSnap.exists ? branchSnap.data() || {} : {}
    if (!branchSnap.exists || !await resolveBranchAccess(req.user.uid, normalizedBranchId)) {
      return res.status(403).json({ success: false, error: 'You are not assigned to this branch.' })
    }
    if (String(userData.branchId || '') !== normalizedBranchId) {
      return res.status(403).json({ success: false, error: 'Your employee profile is not assigned to this branch.' })
    }

    const dateKey = manilaDateKey()
    const qrSnap = await firestore.collection('attendanceDailyQRCodes').doc(`${normalizedBranchId}_${dateKey}`).get()
    if (!qrSnap.exists || String(qrSnap.data()?.token || '') !== String(qrToken).trim()) {
      return res.status(400).json({ success: false, error: 'The attendance QR is invalid or expired.' })
    }

    const settings = branch.attendanceSettings || {}
    const latitudeNumber = Number(latitude)
    const longitudeNumber = Number(longitude)
    const accuracyNumber = Number(accuracy)
    const hasLocation = Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber)
    const requiresLocation = settings.requireLocation !== false
    if (requiresLocation && !hasLocation) {
      return res.status(400).json({ success: false, error: 'Location permission is required to record attendance.' })
    }
    if (hasLocation && Number.isFinite(accuracyNumber) && accuracyNumber > Number(settings.maxAccuracyMeters || 150)) {
      return res.status(400).json({ success: false, error: 'Your location accuracy is too low. Move to an open area and try again.' })
    }

    let distanceMeters = null
    const branchLatitude = Number(branch.latitude ?? branch.lat ?? branch.clinicLocationLat)
    const branchLongitude = Number(branch.longitude ?? branch.lng ?? branch.lon ?? branch.clinicLocationLng)
    const radiusMeters = Math.max(25, Math.min(1000, Number(settings.geofenceRadiusMeters || 150)))
    if (hasLocation && Number.isFinite(branchLatitude) && Number.isFinite(branchLongitude)) {
      const toRadians = (value) => (value * Math.PI) / 180
      const earthRadius = 6371000
      const dLat = toRadians(latitudeNumber - branchLatitude)
      const dLon = toRadians(longitudeNumber - branchLongitude)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(branchLatitude)) * Math.cos(toRadians(latitudeNumber)) * Math.sin(dLon / 2) ** 2
      distanceMeters = Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
      if (distanceMeters > radiusMeters) {
        return res.status(400).json({ success: false, error: `You are outside the allowed attendance area (${radiusMeters} meters).` })
      }
    } else if (requiresLocation) {
      return res.status(400).json({ success: false, error: 'This branch has no valid attendance location configured.' })
    }

    const schedule = await loadAttendanceSchedule(req.user.uid, dateKey)
    const attendanceRef = firestore.collection('attendance').doc(`${req.user.uid}_${dateKey}`)
    const result = await firestore.runTransaction(async (transaction) => {
      const existingSnap = await transaction.get(attendanceRef)
      const existing = existingSnap.exists ? existingSnap.data() || {} : {}
      const now = admin.firestore.Timestamp.now()
      const next = {
        employeeId: req.user.uid,
        employeeName: String(userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`).trim() || userData.email || 'Employee',
        role: userData.customRoleName || userData.role || 'Staff',
        branchId: normalizedBranchId,
        date: dateKey,
        attendanceMethod: 'qr_gps',
        source: 'built_in',
        qrToken: String(qrToken).trim(),
        shiftLabel: schedule.shiftLabel,
        shiftStart: schedule.shiftStart,
        shiftEnd: schedule.shiftEnd,
        locationVerified: hasLocation,
        locationAccuracyMeters: Number.isFinite(accuracyNumber) ? Math.round(accuracyNumber) : null,
        locationDistanceMeters: distanceMeters,
        updatedAt: now,
        createdAt: existing.createdAt || now,
      }
      if (!existing.timeIn) {
        next.timeIn = manilaTimeLabel()
        next.status = 'Logged'
        next.action = 'clock_in'
      } else if (!existing.timeOut) {
        next.timeIn = existing.timeIn
        next.timeOut = manilaTimeLabel()
        next.status = 'Logged'
        next.action = 'clock_out'
      } else {
        return { alreadyComplete: true }
      }
      transaction.set(attendanceRef, next, { merge: true })
      return { ...next, alreadyComplete: false }
    })
    if (result.alreadyComplete) return res.status(409).json({ success: false, error: 'Attendance is already complete for today.' })
    return res.json({ success: true, action: result.action, record: result })
  } catch (error) {
    console.error('Attendance record failed:', error)
    return res.status(500).json({ success: false, error: 'Unable to record attendance.' })
  }
})

app.post(ATTENDANCE_IMPORT_PATH, requireAuth, requirePermission('attendance:import'), async (req, res) => {
  const { branchId, csvText, dryRun = false } = req.body ?? {}
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId || !String(csvText || '').trim()) return res.status(400).json({ success: false, error: 'branchId and csvText are required' })
  try {
    if (!await resolveBranchAccess(req.user.uid, normalizedBranchId)) return res.status(403).json({ success: false, error: 'You cannot import attendance for this branch.' })
    const rows = parseAttendanceCsv(csvText)
    const firestore = admin.firestore()
    const valid = []
    const rejected = []
    for (const [index, row] of rows.entries()) {
      const employeeId = String(row.employeeid || row.uid || '').trim()
      const email = String(row.email || '').trim().toLowerCase()
      const date = normalizeImportDate(row.date || row.attendancedate)
      const timeIn = String(row.timein || row.clockin || '').trim()
      const timeOut = String(row.timeout || row.clockout || '').trim()
      if (!date || (!employeeId && !email) || (!timeIn && !timeOut)) {
        rejected.push({ row: index + 2, reason: 'Required fields: date, employeeId/email, and timeIn or timeOut.' })
        continue
      }
      let resolvedId = employeeId
      if (!resolvedId) {
        const userSnap = await firestore.collection('users').where('email', '==', email).limit(2).get()
        if (userSnap.size !== 1) {
          rejected.push({ row: index + 2, reason: 'Email did not resolve to exactly one employee.' })
          continue
        }
        resolvedId = userSnap.docs[0].id
      }
      const userSnap = await firestore.collection('users').doc(resolvedId).get()
      if (!userSnap.exists || String(userSnap.data()?.branchId || '') !== normalizedBranchId) {
        rejected.push({ row: index + 2, reason: 'Employee does not belong to this branch.' })
        continue
      }
      valid.push({ employeeId: resolvedId, branchId: normalizedBranchId, date, timeIn, timeOut, source: 'imported', importSource: 'clinic_csv' })
    }
    if (!dryRun && valid.length) {
      const batch = firestore.batch()
      valid.forEach((record) => batch.set(firestore.collection('attendance').doc(`${record.employeeId}_${record.date}`), { ...record, importedBy: req.user.uid, importedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }))
      const importRef = firestore.collection('attendanceImports').doc()
      batch.set(importRef, { branchId: normalizedBranchId, importedBy: req.user.uid, validRows: valid.length, rejectedRows: rejected.length, createdAt: admin.firestore.FieldValue.serverTimestamp() })
      await batch.commit()
    }
    return res.json({ success: true, dryRun: Boolean(dryRun), validRows: valid.length, rejectedRows: rejected.length, rejected })
  } catch (error) {
    console.error('Attendance import failed:', error)
    return res.status(400).json({ success: false, error: error.message || 'Unable to import attendance.' })
  }
})

app.post(ATTENDANCE_PIN_PATH, requireAuth, requirePermission('staff:create'), async (req, res) => {
  const { recipient, attendancePin, fullName } = req.body ?? {}

  if (!recipient || !attendancePin) {
    return res.status(400).json({
      success: false,
      error: 'recipient and attendancePin are required',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  const safeName = String(fullName || 'Staff').trim() || 'Staff'
  const safePin = String(attendancePin || '').trim()

  const message = {
    to: recipient,
    from: senderEmail,
    subject: 'Your Attendance PIN (Do Not Share)',
    text:
      `Hi ${safeName},\n\n` +
      `Your attendance PIN is: ${safePin}\n\n` +
      `Do not share this PIN with anyone. You will use it for attendance as verification that you are the person who says you are.\n\n` +
      `If you did not expect this email, please contact your administrator.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
        <p>Hi ${safeName},</p>
        <p>Your attendance PIN is:</p>
        <p style="font-size:22px;font-weight:700;letter-spacing:2px;">${safePin}</p>
        <p><strong>Do not share this PIN with anyone.</strong> You will use it for attendance as verification that you are the person who says you are.</p>
        <p>If you did not expect this email, please contact your administrator.</p>
      </div>
    `,
  }

  try {
    const response = await postmarkClient.sendEmail({
      From: senderEmail,
      To: recipient,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
    })
    const messageId = response?.MessageID || null
    console.log('Postmark OTP sent', {
      status: response?.ErrorCode === 0 ? 200 : response?.ErrorCode,
      messageId: messageId || 'unknown',
      to: recipient,
    })
    return res.json({ success: true, messageId: messageId || null })
  } catch (error) {
    const providerMessage = error?.Message || error?.message || 'Unknown Postmark error'
    console.error('Postmark error:', providerMessage)
    return res.status(500).json({ success: false, error: providerMessage })
  }
})

app.post(STAFF_WELCOME_PATH, requireAuth, requirePermission('staff:create'), async (req, res) => {
  const { recipient, fullName, defaultPassword } = req.body ?? {}

  const normalizedRecipient = String(recipient || '').trim().toLowerCase()
  const safeName = String(fullName || 'Staff').trim() || 'Staff'
  const safePassword = String(defaultPassword || '').trim()

  if (!normalizedRecipient || !safePassword) {
    return res.status(400).json({
      success: false,
      error: 'recipient and defaultPassword are required',
    })
  }

  if (!postmarkClient || !senderEmail) {
    if (isDevelopment) {
      console.warn(`[DEV STAFF EMAIL BYPASS] Welcome email not sent to ${normalizedRecipient}. Default password: ${safePassword}`)
      return res.json({ success: true, devMode: true })
    }
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  try {
    const loginUrl = `${resolveFrontendBaseUrl(req)}/login`
    const message = {
      to: normalizedRecipient,
      from: senderEmail,
      subject: 'Your Staff Account Has Been Created',
      text:
        `Hi ${safeName},\n\n` +
        `A staff account has been created for you.\n\n` +
        `Email: ${normalizedRecipient}\n` +
        `Temporary password: ${safePassword}\n\n` +
        `Please sign in as soon as possible and change your password immediately after logging in.\n` +
        `Login page: ${loginUrl}\n\n` +
        `If you did not expect this email, please contact your clinic administrator.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
          <p>Hi ${safeName},</p>
          <p>A staff account has been created for you.</p>
          <p><strong>Email:</strong> ${normalizedRecipient}<br /><strong>Temporary password:</strong> ${safePassword}</p>
          <p>Please sign in as soon as possible and change your password immediately after logging in.</p>
          <p><a href="${loginUrl}">Go to Login</a></p>
          <p>If you did not expect this email, please contact your clinic administrator.</p>
        </div>
      `,
    }
    const delivery = await sendPostmarkMessage(message)
    return res.json({ success: true, ...delivery })
  } catch (error) {
    const providerMessage = extractProviderError(error)
    console.error('Postmark staff welcome error:', providerMessage)
    if (isDevelopment) {
      console.warn(`[DEV STAFF EMAIL BYPASS] Postmark failed for ${normalizedRecipient}. Temporary password: ${safePassword}`)
      return res.json({ success: true, devMode: true, warning: providerMessage })
    }
    return res.status(500).json({ success: false, error: providerMessage })
  }
})

app.post(CHECK_SUPPLIER_REGISTRATION_STATUS_PATH, async (req, res) => {
  const { email } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  try {
    const supplierState = await getSupplierRegistrationState(normalizedEmail)
    if (!supplierState.exists) {
      return res.json({ success: true, exists: false })
    }

    const role = String(supplierState.role || '').trim()
    const status = String(supplierState.status || '').trim()
    const approvalStatus = String(supplierState.approvalStatus || '').trim()
    return res.json({
      success: true,
      exists: true,
      uid: supplierState.uid,
      role,
      status,
      approvalStatus,
      emailVerified: supplierState.emailVerified,
      canResumeOtp: !supplierState.emailVerified && !String(status || approvalStatus || '').toLowerCase().includes('active'),
    })
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to check supplier registration status.',
      code: error?.code || '',
    })
  }
})

app.post(REQUEST_SUPPLIER_OTP_PATH, async (req, res) => {
  const { email, uid } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  try {
    const supplierState = await getSupplierRegistrationState(normalizedEmail)
    const resolvedUid = normalizedUid || supplierState.uid

    if (supplierState.exists && String(supplierState.role || supplierState.userData?.userType || '').toLowerCase() && String(supplierState.role || supplierState.userData?.userType || '').toLowerCase() !== 'supplier') {
      return res.status(409).json({
        success: false,
        error: 'This email is already used by another account type.',
      })
    }

    if (supplierState.emailVerified && String(supplierState.status || '').toLowerCase() === 'active') {
      return res.status(409).json({
        success: false,
        error: 'This supplier account is already verified. Please sign in.',
      })
    }

    if (!resolvedUid) {
      return res.status(400).json({
        success: false,
        error: 'No supplier registration was found for this email.',
      })
    }

    const otpResult = await sendRegistrationOtpMessage({
      email: normalizedEmail,
      uid: resolvedUid,
      purpose: SUPPLIER_REGISTRATION_OTP_PURPOSE,
    })

    return res.json({
      success: true,
      recipient: normalizedEmail,
      uid: resolvedUid,
      expiresInSeconds: otpResult.expiresInSeconds,
      retryAfterSeconds: otpResult.retryAfterSeconds,
      messageId: otpResult.delivery.messageId || null,
    })
  } catch (error) {
    if (error?.statusCode === 429) {
      return res.status(429).json({
        success: false,
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      })
    }
    const providerMessage = extractProviderError(error)
    return res.status(500).json({
      success: false,
      error: providerMessage,
    })
  }
})

app.post(VERIFY_SUPPLIER_OTP_PATH, async (req, res) => {
  const { uid, email, otp } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedUid = String(uid || '').trim()
  const normalizedOtp = String(otp || '').trim()
  if (!normalizedEmail || !normalizedOtp) {
    return res.status(400).json({
      success: false,
      error: 'email and otp are required',
    })
  }

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  try {
    let resolvedUid = normalizedUid
    let userRecord = null
    const firestore = admin.firestore()
    const otpRef = getRegistrationOtpDocRef(SUPPLIER_REGISTRATION_OTP_PURPOSE, normalizedEmail)
    const otpSnap = await otpRef.get()

    if (!otpSnap.exists) {
      return res.status(400).json({
        success: false,
        error: 'No active OTP found. Please request a new OTP.',
      })
    }

    const otpData = otpSnap.data() || {}
    if (!resolvedUid) {
      resolvedUid = String(otpData.uid || '').trim()
    }
    const expiresAt = getTimestampDate(otpData.expiresAt)
    if (otpData.used) {
      return res.status(400).json({
        success: false,
        error: 'This OTP was already used. Please request a new OTP.',
      })
    }

    if (expiresAt && expiresAt.getTime() < Date.now()) {
      await otpRef.set({
        used: true,
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'OTP expired. Please request a new OTP.',
      })
    }

    if (!otpMatches(otpData, normalizedOtp)) {
      await otpRef.set({
        attempts: admin.firestore.FieldValue.increment(1),
        lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP. Please try again.',
      })
    }

    if (resolvedUid) {
      try {
        userRecord = await admin.auth().getUser(resolvedUid)
      } catch (error) {
        const code = String(error?.code || '')
        if (code !== 'auth/user-not-found') {
          throw error
        }
      }
    }

    const emailUserRecord = await admin.auth().getUserByEmail(normalizedEmail).catch(() => null)
    if (emailUserRecord?.uid) {
      resolvedUid = emailUserRecord.uid
      userRecord = emailUserRecord
    }

    let recordEmail = String(userRecord?.email || '').trim().toLowerCase()
    if (!emailUserRecord?.uid && (!resolvedUid || !recordEmail || recordEmail !== normalizedEmail)) {
      const matchingUsersSnap = await firestore
        .collection('users')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get()

      if (!matchingUsersSnap.empty) {
        resolvedUid = matchingUsersSnap.docs[0].id
        if (!recordEmail) {
          recordEmail = normalizedEmail
        }
      }
    }

    if (recordEmail && recordEmail !== normalizedEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email does not match user record',
      })
    }

    if (!resolvedUid) {
      return res.status(400).json({
        success: false,
        error: 'Unable to resolve the registration account for this OTP.',
      })
    }

    await Promise.all([
      firestore.collection('users').doc(resolvedUid).set({
        status: 'Pending Approval',
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      firestore.collection('supplierApplications').doc(resolvedUid).set({
        ownerId: resolvedUid,
        approvalStatus: 'Pending Approval',
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
      otpRef.set({
        uid: resolvedUid,
        used: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    return res.json({ success: true, data: { uid: resolvedUid } })
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to verify OTP.',
      code: error?.code || '',
    })
  }
})

app.post('/send-payment-receipt', async (req, res) => {
  const { recipient, payerName, planName, amount, currency, referenceNumber, paymentMethod } = req.body ?? {}

  if (!recipient) {
    return res.status(400).json({
      success: false,
      error: 'recipient is required',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  const safeRecipient = String(recipient || '').trim().toLowerCase()
  const safeName = String(payerName || 'Customer').trim() || 'Customer'
  const safePlan = String(planName || 'Subscription').trim() || 'Subscription'
  const safeAmount = Number(amount || 0)
  const safeCurrency = String(currency || 'PHP').trim() || 'PHP'
  const safeReference = String(referenceNumber || '').trim()
  const safeMethod = String(paymentMethod || '').trim()

  const formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: safeCurrency })
  const amountLabel = formatter.format(safeAmount)

  const message = {
    to: safeRecipient,
    from: senderEmail,
    subject: 'Subscription Payment सफल',
    text:
      `Hi ${safeName},\n\n` +
      `Your payment was successful.\n` +
      `Plan: ${safePlan}\n` +
      `Amount: ${amountLabel}\n` +
      `${safeMethod ? `Payment Method: ${safeMethod}\n` : ''}` +
      `${safeReference ? `Reference: ${safeReference}\n` : ''}` +
      `\nThank you for subscribing to AesthetiCare.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#2a1408;">
        <h2 style="margin:0 0 12px;">Payment Successful</h2>
        <p>Hi ${safeName},</p>
        <p>Your subscription payment was successful.</p>
        <table style="border-collapse:collapse;margin-top:12px;">
          <tr><td style="padding:4px 12px 4px 0;"><strong>Plan</strong></td><td>${safePlan}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;"><strong>Amount</strong></td><td>${amountLabel}</td></tr>
          ${safeMethod ? `<tr><td style="padding:4px 12px 4px 0;"><strong>Payment Method</strong></td><td>${safeMethod}</td></tr>` : ''}
          ${safeReference ? `<tr><td style="padding:4px 12px 4px 0;"><strong>Reference</strong></td><td>${safeReference}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;">Thank you for subscribing to AesthetiCare.</p>
      </div>
    `,
  }

  try {
    await postmarkClient.sendEmail({
      From: senderEmail,
      To: safeRecipient,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
    })
    return res.json({ success: true })
  } catch (error) {
    const providerMessage = error?.Message || error?.message || 'Unknown Postmark error'
    console.error('Postmark error:', providerMessage)
    return res.status(500).json({ success: false, error: providerMessage })
  }
})

app.post('/appointments/reservations', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const body = req.body || {}
  const branchId = String(body.branchId || '').trim()
  const centerId = String(body.centerId || branchId || '').trim()
  const customerId = String(body.customerId || '').trim()
  const customerName = String(body.customerName || '').trim()
  const customerEmail = String(body.customerEmail || '').trim()
  const practitionerId = String(body.practitionerId || '').trim()
  const practitionerName = String(body.practitionerName || '').trim()
  const date = String(body.date || '').trim()
  const time = String(body.time || '').trim()
  const endTime = String(body.endTime || '').trim()
  const notes = String(body.notes || '').trim()
  const flowType = String(body.flowType || 'booking').trim().toLowerCase()
  const selectedServices = Array.isArray(body.selectedServices) ? body.selectedServices : []
  const selectedServiceIds = Array.isArray(body.selectedServiceIds) ? body.selectedServiceIds.map((value) => String(value || '').trim()).filter(Boolean) : []
  const selectedServiceNames = Array.isArray(body.selectedServiceNames) ? body.selectedServiceNames.map((value) => String(value || '').trim()).filter(Boolean) : []
  const serviceDurations = Array.isArray(body.serviceDurations) ? body.serviceDurations.map((value) => Number(value || 0)).filter((value) => value > 0) : []
  const totalServiceDurationMinutes = Math.max(30, Number(body.totalServiceDurationMinutes || serviceDurations.reduce((sum, value) => sum + value, 0) || 0))
  const consultationFee = Number(body.consultationFee || 0)
  const amount = Number(body.amount || 0)
  const paymentMethod = String(body.paymentMethod || '').trim()
  const paymentCoverage = String(body.paymentCoverage || 'full').trim()
  const commissionPercent = Number(body.commissionPercent || 10)
  const commissionAmount = Number(body.commissionAmount || 0)
  const netAmount = Number(body.netAmount || 0)
  const requiresConsultationFirst = Boolean(body.requiresConsultationFirst)
  const followUpAllowed = Boolean(body.followUpAllowed)
  const followUpWindowDays = body.followUpWindowDays != null ? Number(body.followUpWindowDays) : null
  const bookingType = String(body.bookingType || 'standard').trim().toLowerCase()
  const followUpOf = String(body.followUpOf || '').trim()
  const preferredPractitionerId = String(body.preferredPractitionerId || '').trim()
  const followUpSourceServiceIds = Array.isArray(body.followUpSourceServiceIds)
    ? body.followUpSourceServiceIds.map((value) => String(value || '').trim()).filter(Boolean)
    : []
  const followUpSourceServiceNames = Array.isArray(body.followUpSourceServiceNames)
    ? body.followUpSourceServiceNames.map((value) => String(value || '').trim()).filter(Boolean)
    : []

  if (!customerId || !req.user?.uid || customerId !== req.user.uid) {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  if (!branchId || !practitionerId || !date || !time) {
    return res.status(400).json({ success: false, error: 'Missing booking details' })
  }

  const start = parseClockToMinutes(time)
  if (start === null) {
    return res.status(400).json({ success: false, error: 'Invalid booking time' })
  }
  const end = parseClockToMinutes(endTime)
  const normalizedEnd = end !== null && end > start ? end : start + totalServiceDurationMinutes

  const firestore = admin.firestore()
  const consultationRequiredIds = selectedServices
    .filter((service) => service?.requiresConsultationFirst === true)
    .map((service) => String(service.id || '').trim())
    .filter(Boolean)

  if (consultationRequiredIds.length) {
    const consultationSnap = await firestore.collection('appointments')
      .where('customerId', '==', customerId)
      .where('type', '==', 'Consultation')
      .get()
    const hasCompletedConsultation = consultationSnap.docs.some((docSnap) => {
      const appointment = docSnap.data() || {}
      if (normalizeBookingStatus(appointment.status) !== 'completed') return false
      const coveredIds = Array.isArray(appointment.consultationForServiceIds)
        ? appointment.consultationForServiceIds.map((id) => String(id || '').trim())
        : []
      return consultationRequiredIds.every((id) => coveredIds.includes(id))
    })
    if (!hasCompletedConsultation) {
      return res.status(422).json({
        success: false,
        code: 'CONSULTATION_REQUIRED',
        error: 'A completed consultation is required before requesting one or more selected services.',
        requiredServiceIds: consultationRequiredIds,
      })
    }
  }

  const reservationsCol = firestore.collection(BOOKING_RESERVATIONS_COLLECTION)
  const reservationRef = reservationsCol.doc()
  const nowMs = Date.now()
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + BOOKING_RESERVATION_TTL_MINUTES * 60 * 1000)
  let responseData = null

  try {
    await firestore.runTransaction(async (transaction) => {
      const appointmentsSnap = await transaction.get(
        firestore.collection('appointments')
          .where('branchId', '==', branchId)
          .where('date', '==', date)
          .where('assignedPractitionerId', '==', practitionerId)
      )
      const reservationsSnap = await transaction.get(
        reservationsCol
          .where('branchId', '==', branchId)
          .where('date', '==', date)
          .where('practitionerId', '==', practitionerId)
          .where('status', '==', 'held')
      )

      const existingBlocks = []

      appointmentsSnap.docs.forEach((snap) => {
        const data = snap.data() || {}
        const status = normalizeBookingStatus(data.status)
        if (!BOOKING_BLOCKING_STATUSES.has(status)) return
        const range = getBookingRange(data)
        if (range) existingBlocks.push(range)
      })

      for (const snap of reservationsSnap.docs) {
        const data = snap.data() || {}
        const expiry = toMillis(data.expiresAt)
        const status = normalizeBookingStatus(data.status)
        if (status !== 'held' || expiry <= nowMs) continue
        const range = getBookingRange(data)
        if (!range) continue

        if (
          String(data.customerId || '').trim() === customerId &&
          rangesOverlap(start, normalizedEnd, range.start, range.end)
        ) {
          responseData = {
            id: snap.id,
            expiresAt: expiry ? new Date(expiry).toISOString() : expiresAt.toDate().toISOString(),
            reused: true,
          }
          return
        }

        existingBlocks.push(range)
      }

      const conflictingBlock = existingBlocks.find((range) => rangesOverlap(start, normalizedEnd, range.start, range.end))
      if (conflictingBlock) {
        throw new Error('That schedule was just taken. Please choose another available time.')
      }

      transaction.set(reservationRef, {
        branchId,
        centerId,
        customerId,
        customerName,
        customerEmail,
        practitionerId,
        practitionerName,
        flowType,
        date,
        time,
        endTime: endTime || '',
        durationMinutes: totalServiceDurationMinutes,
        selectedServices,
        selectedServiceIds,
        selectedServiceNames,
        serviceDurations,
        totalServiceDurationMinutes,
        consultationFee,
        amount,
        paymentMethod,
        paymentCoverage,
        commissionPercent,
        commissionAmount,
        netAmount,
        requiresConsultationFirst,
        followUpAllowed,
        followUpWindowDays,
        bookingType,
        followUpOf,
        preferredPractitionerId,
        followUpSourceServiceIds,
        followUpSourceServiceNames,
        notes,
        status: 'held',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
      })

      responseData = {
        id: reservationRef.id,
        expiresAt: expiresAt.toDate().toISOString(),
        reused: false,
      }
    })

    return res.json({ success: true, data: responseData })
  } catch (error) {
    const message = String(error?.message || '').trim() || 'Failed to reserve the selected time.'
    return res.status(400).json({ success: false, error: message })
  }
})

app.delete('/appointments/reservations/:id', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const reservationId = String(req.params.id || '').trim()
  if (!reservationId) {
    return res.status(400).json({ success: false, error: 'reservation id is required' })
  }

  try {
    const firestore = admin.firestore()
    const reservationRef = firestore.collection(BOOKING_RESERVATIONS_COLLECTION).doc(reservationId)
    await firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(reservationRef)
      if (!snap.exists) return
      const data = snap.data() || {}
      if (String(data.customerId || '').trim() !== String(req.user?.uid || '').trim()) {
        throw new Error('Forbidden')
      }
      if (normalizeBookingStatus(data.status) === 'consumed') return
      transaction.update(reservationRef, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })
    return res.json({ success: true })
  } catch (error) {
    if (String(error?.message || '') === 'Forbidden') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    return res.status(500).json({ success: false, error: error?.message || 'Failed to release reservation' })
  }
})

app.post('/appointments/finalize-booking', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const body = req.body || {}
  const reservationId = String(body.reservationId || '').trim()
  const paymongoCheckoutSessionId = String(body.paymongoCheckoutSessionId || '').trim() || null
  const paymongoStatus = String(body.paymongoStatus || '').trim() || null
  const paymongoPaidAt = body.paymongoPaidAt || null
  const paymongoPaymentId = String(body.paymongoPaymentId || '').trim() || null
  const paymongoPaymentMethodType = String(body.paymongoPaymentMethodType || '').trim() || null
  const paymentMethod = String(body.paymentMethod || '').trim() || null

  logPayMongoEvent('Finalize booking request received', {
    reservationId,
    paymongoCheckoutSessionId,
    paymongoStatus,
    paymongoPaidAt,
    paymongoPaymentId: maskLogValue(paymongoPaymentId),
    paymongoPaymentMethodType,
    paymentMethod,
    source: String(body.source || body.paymentSource || '').trim(),
  })

  if (!reservationId) {
    return res.status(400).json({ success: false, error: 'reservation id is required' })
  }

  const firestore = admin.firestore()
  const reservationRef = firestore.collection(BOOKING_RESERVATIONS_COLLECTION).doc(reservationId)
  let appointmentId = ''
  let appointmentPayload = null

  try {
    await firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(reservationRef)
      if (!snap.exists) {
        throw new Error('Reservation not found.')
      }

      const reservation = snap.data() || {}
      if (String(reservation.customerId || '').trim() !== String(req.user?.uid || '').trim()) {
        throw new Error('Forbidden')
      }
      if (normalizeBookingStatus(reservation.status) === 'consumed') {
        appointmentId = String(reservation.appointmentId || '').trim()
        return
      }
      if (normalizeBookingStatus(reservation.status) !== 'held') {
        throw new Error('This reservation is no longer active.')
      }
      if (toMillis(reservation.expiresAt) <= Date.now()) {
        throw new Error('This reservation has expired. Please book again.')
      }

      const range = getBookingRange(reservation)
      if (!range) {
        throw new Error('Invalid reservation time.')
      }

      const appointmentsSnap = await transaction.get(
        firestore.collection('appointments')
          .where('branchId', '==', String(reservation.branchId || '').trim())
          .where('date', '==', String(reservation.date || '').trim())
          .where('assignedPractitionerId', '==', String(reservation.practitionerId || '').trim())
      )

      appointmentsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() || {}
        const status = normalizeBookingStatus(data.status)
        if (!BOOKING_BLOCKING_STATUSES.has(status)) return
        const existingRange = getBookingRange(data)
        if (existingRange && rangesOverlap(range.start, range.end, existingRange.start, existingRange.end)) {
          throw new Error('That schedule was just taken. Please choose another available time.')
        }
      })

      const finalAppointmentRef = firestore.collection('appointments').doc()
      appointmentPayload = buildBookingAppointmentPayload({
        reservation: {
          ...reservation,
          id: reservationId,
          checkoutSessionId: paymongoCheckoutSessionId,
          paymentMethod: paymentMethod || reservation.paymentMethod || 'GCash',
        },
        paymongo: {
          status: paymongoStatus,
          paid_at: paymongoPaidAt,
          paymentId: paymongoPaymentId,
        },
        paymentMethodType: paymongoPaymentMethodType,
        paymentMethod,
      })

      const computedPaymentId = String(appointmentPayload.paymongoPaymentId || '').trim()
      const computedPaymentStatus = String(appointmentPayload.paymentStatus || '').trim()
      const computedSource = String(appointmentPayload.source || 'paymongo_checkout').trim().toLowerCase()
      const isPaidAppointment =
        Boolean(computedPaymentId) &&
        computedPaymentStatus.toLowerCase() === 'paid' &&
        computedSource === 'paymongo_checkout'

      logPayMongoEvent('Booking payload prepared', {
        reservationId,
        appointmentId: finalAppointmentRef.id,
        paymongoCheckoutSessionId: appointmentPayload.paymongoCheckoutSessionId || null,
        paymongoStatus: appointmentPayload.paymongoStatus || null,
        paymongoPaidAt: appointmentPayload.paymongoPaidAt || null,
        paymongoPaymentId: maskLogValue(computedPaymentId),
        paymentStatus: computedPaymentStatus,
        source: computedSource,
        isPaidAppointment,
      })

      transaction.set(finalAppointmentRef, appointmentPayload)
      transaction.update(reservationRef, {
        status: 'consumed',
        appointmentId: finalAppointmentRef.id,
        paymongoCheckoutSessionId,
        paymongoStatus,
        paymongoPaidAt,
        paymongoPaymentId,
        paymongoPaymentMethodType,
        consumedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      appointmentId = finalAppointmentRef.id
    })

    logPayMongoEvent('Finalize booking completed', {
      reservationId,
      appointmentId,
    })

    if (appointmentPayload) {
      try {
        const customerProfile = await getAppointmentCustomerProfile(firestore, appointmentPayload)
        await upsertBranchClientFromAppointment(firestore, {
          branchId: appointmentPayload.branchId || '',
          appointmentData: {
            ...appointmentPayload,
            id: appointmentId,
            createdBy: req.user?.uid || '',
          },
          customerProfile,
          createdBy: req.user?.uid || '',
        })
      } catch (clientError) {
        console.error('Failed to sync client record from appointment:', clientError)
      }
    }

    return res.json({ success: true, data: { appointmentId } })
  } catch (error) {
    if (String(error?.message || '') === 'Forbidden') {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    return res.status(400).json({ success: false, error: error?.message || 'Failed to finalize booking' })
  }
})

app.post('/appointments/:id/approve-booking', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  }

  const appointmentId = String(req.params.id || '').trim()
  const decision = String(req.body?.decision || 'approve').trim().toLowerCase()
  const decisionNote = String(req.body?.decisionNote || req.body?.note || '').trim()
  if (!appointmentId) return res.status(400).json({ success: false, error: 'appointment id is required' })
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ success: false, error: 'decision must be approve or reject' })

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })

    const appointment = appointmentSnap.data() || {}
    const currentStatus = normalizeBookingStatus(appointment.status)
    if (!['pending approval', 'requested'].includes(currentStatus)) {
      return res.status(409).json({ success: false, error: 'This booking is no longer awaiting shop approval.' })
    }

    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const userData = req.userContext.userData || {}
    const roleKey = String(req.userContext.roleKey || '').trim()
    const canReviewRequests = req.userContext.permissions.has('appointments:review') || roleKey === 'Owner' || roleKey === 'Superadmin'
    if (!canReviewRequests) return res.status(403).json({ success: false, error: 'Forbidden' })

    const userBranchId = String(userData.branchId || '').trim()
    const appointmentBranchId = String(appointment.branchId || '').trim()
    if (roleKey !== 'Owner' && roleKey !== 'Superadmin' && userBranchId && appointmentBranchId && userBranchId !== appointmentBranchId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const approved = decision === 'approve'
    const nextStatus = approved ? 'Payment Pending' : 'Rejected'
    const nextPaymentStatus = approved ? 'Pending' : 'Not Applicable'
    const update = {
      status: nextStatus,
      approvalStatus: approved ? 'Approved' : 'Rejected',
      approvalNote: decisionNote,
      approvedAt: approved ? admin.firestore.FieldValue.serverTimestamp() : null,
      approvedById: approved ? req.user.uid : null,
      rejectedAt: approved ? null : admin.firestore.FieldValue.serverTimestamp(),
      rejectedById: approved ? null : req.user.uid,
      paymentStatus: nextPaymentStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await appointmentRef.update(update)

    if (appointment.bookingId) {
      await firestore.collection('bookings').doc(String(appointment.bookingId)).set({
        status: approved ? 'approved' : 'rejected',
        decisionNote,
        decidedById: req.user.uid,
        decidedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    try {
      await createAppointmentNotification({
        firestore,
        customerId: appointment.customerId || '',
        title: approved ? 'Booking Request Approved' : 'Booking Request Rejected',
        message: approved
          ? `Your request for ${appointment.service || 'the selected service'} was approved. Please complete payment to continue.`
          : `Your request for ${appointment.service || 'the selected service'} was rejected.${decisionNote ? ` Note: ${decisionNote}` : ''}`,
        link: '/customer/appointments',
      })
    } catch (notificationError) {
      console.error('Failed to notify customer about booking decision:', notificationError)
    }

    return res.json({ success: true, data: { appointmentId, status: nextStatus, approvalStatus: update.approvalStatus } })
  } catch (error) {
    console.error('appointments/approve-booking error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to decide booking request' })
  }
})

app.post('/appointments/:id/transition', requireAuth, async (req, res) => {
  const appointmentId = String(req.params.id || '').trim()
  const action = String(req.body?.action || '').trim().toLowerCase()
  if (!appointmentId || !['start', 'worker_complete', 'customer_complete'].includes(action)) {
    return res.status(400).json({ success: false, error: 'A valid transition action is required.' })
  }

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    const status = normalizeBookingStatus(appointment.status)
    const isCustomer = String(appointment.customerId || '').trim() === req.user.uid
    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const roleKey = String(req.userContext.roleKey || '').trim()
    const sameBranch = String(req.userContext.userData?.branchId || '').trim() === String(appointment.branchId || '').trim()
    const assignedPractitioner = [appointment.practitionerId, appointment.assignedPractitionerId, appointment.staffId, appointment.assignedTo]
      .map((value) => String(value || '').trim()).includes(req.user.uid)
    const canStaffUpdate = roleKey === 'Superadmin' || roleKey === 'Owner' || (sameBranch && (assignedPractitioner || req.userContext.permissions.has('appointments:update')))
    const totalAmount = Number(appointment.totalAmount || appointment.amount || 0)
    const amountPaid = Number(appointment.amountPaid || 0)
    const balancePaid = totalAmount <= 0 || amountPaid + 0.01 >= totalAmount

    if (action === 'customer_complete' && !isCustomer) return res.status(403).json({ success: false, error: 'Only the customer can confirm completion.' })
    if (action !== 'customer_complete' && !canStaffUpdate) return res.status(403).json({ success: false, error: 'Forbidden' })

    const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() }
    if (action === 'start') {
      if (status !== 'ready to start' || appointment.customerKeyVerified !== true || appointment.workerKeyVerified !== true) {
        return res.status(409).json({ success: false, error: 'Both customer and worker must verify the service key before starting.' })
      }
      update.status = 'Ongoing'
      update.startedAt = admin.firestore.FieldValue.serverTimestamp()
      update.startedById = req.user.uid
    } else if (action === 'worker_complete') {
      if (status !== 'ongoing' || appointment.startedAt == null) return res.status(409).json({ success: false, error: 'The appointment is not in progress.' })
      update.workerCompleted = true
      update.workerCompletedAt = admin.firestore.FieldValue.serverTimestamp()
      update.workerCompletedById = req.user.uid
      update.status = appointment.customerCompleted && balancePaid ? 'Completed' : 'Awaiting Customer Confirmation'
    } else {
      if (!['ongoing', 'awaiting customer confirmation', 'balance due'].includes(status)) return res.status(409).json({ success: false, error: 'The appointment cannot be confirmed yet.' })
      update.customerCompleted = true
      update.customerCompletedAt = admin.firestore.FieldValue.serverTimestamp()
      update.status = appointment.workerCompleted && balancePaid ? 'Completed' : (appointment.workerCompleted ? 'Balance Due' : 'Ongoing')
    }
    await appointmentRef.update(update)
    return res.json({ success: true, data: { appointmentId, status: update.status } })
  } catch (error) {
    console.error('appointment transition error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to update appointment milestone.' })
  }
})

app.post('/appointments/:id/verify-service-key', requireAuth, async (req, res) => {
  const appointmentId = String(req.params.id || '').trim()
  const submittedKey = String(req.body?.serviceKey || '').trim()
  if (!appointmentId || !submittedKey) return res.status(400).json({ success: false, error: 'serviceKey is required.' })

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    if (String(appointment.serviceKey || '') !== submittedKey) return res.status(403).json({ success: false, error: 'Invalid service key.' })

    const isCustomer = String(appointment.customerId || '').trim() === req.user.uid
    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const roleKey = String(req.userContext.roleKey || '').trim()
    const sameBranch = String(req.userContext.userData?.branchId || '').trim() === String(appointment.branchId || '').trim()
    const assigned = [appointment.practitionerId, appointment.assignedPractitionerId, appointment.staffId, appointment.assignedTo]
      .map((value) => String(value || '').trim()).includes(req.user.uid)
    const isStaff = roleKey === 'Superadmin' || roleKey === 'Owner' || (sameBranch && (assigned || req.userContext.permissions.has('appointments:update')))
    if (!isCustomer && !isStaff) return res.status(403).json({ success: false, error: 'Forbidden' })

    const update = isCustomer
      ? { customerKeyVerified: true, customerKeyVerifiedAt: admin.firestore.FieldValue.serverTimestamp() }
      : { workerKeyVerified: true, workerKeyVerifiedAt: admin.firestore.FieldValue.serverTimestamp() }
    const bothVerified = Boolean(isCustomer ? update.customerKeyVerified : appointment.customerKeyVerified) &&
      Boolean(isCustomer ? appointment.workerKeyVerified : update.workerKeyVerified)
    if (bothVerified) update.status = 'Ready to Start'
    update.updatedAt = admin.firestore.FieldValue.serverTimestamp()
    await appointmentRef.update(update)
    return res.json({ success: true, data: { appointmentId, status: update.status || appointment.status, bothVerified } })
  } catch (error) {
    console.error('service key verification error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to verify service key.' })
  }
})

app.post('/appointments/:id/feedback', requireAuth, async (req, res) => {
  const appointmentId = String(req.params.id || '').trim()
  const rating = Number(req.body?.rating || 0)
  const comment = String(req.body?.comment || '').trim()
  if (!appointmentId || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'A rating from 1 to 5 is required.' })

  try {
    const firestore = admin.firestore()
    const appointmentSnap = await firestore.collection('appointments').doc(appointmentId).get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    if (String(appointment.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (normalizeBookingStatus(appointment.status) !== 'completed') return res.status(409).json({ success: false, error: 'Feedback is available after completion.' })

    const reviewRef = firestore.collection('reviews').doc(`${appointmentId}_${req.user.uid}`)
    await reviewRef.set({
      appointmentId,
      customerId: req.user.uid,
      branchId: appointment.branchId || '',
      service: appointment.service || appointment.type || 'Appointment',
      rating,
      comment,
      reviewerName: appointment.customerName || appointment.clientName || 'Customer',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return res.json({ success: true, data: { reviewId: reviewRef.id } })
  } catch (error) {
    console.error('appointment feedback error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save feedback.' })
  }
})

app.post('/appointments/:id/approve-request', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const appointmentId = String(req.params.id || '').trim()
  const decisionNote = String(req.body?.decisionNote || req.body?.note || '').trim()
  if (!appointmentId) {
    return res.status(400).json({ success: false, error: 'appointment id is required' })
  }

  const firestore = admin.firestore()
  const appointmentRef = firestore.collection('appointments').doc(appointmentId)
  let appointmentData = null
  let branchName = 'Clinic'
  let customerProfile = null
  let requestType = ''
  let refundAmount = 0
  let commissionAmount = 0
  let paymongoRefundId = null
  let paymongoRefundStatus = null
  const warnings = []

  try {
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found.',
      })
    }

    appointmentData = appointmentSnap.data() || {}
    const status = String(appointmentData.status || '').trim().toLowerCase()
    requestType = status.includes('cancellation requested')
      ? 'cancel'
      : status.includes('reschedule requested')
        ? 'reschedule'
      : ''

    if (!requestType) {
      return res.status(400).json({
        success: false,
        error: 'This appointment is not awaiting approval.',
      })
    }

    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const userSnap = await firestore.collection('users').doc(req.user.uid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const userBranchId = String(userData.branchId || '').trim()
    const appointmentBranchId = String(appointmentData.branchId || '').trim()
    const staffDisplayName = getStaffDisplayName(userData)
    const roleKey = String(req.userContext?.roleKey || '').trim()
    const canReviewRequests =
      req.userContext.permissions.has('appointments:review') ||
      roleKey === 'Owner' ||
      roleKey === 'Superadmin'

    if (!canReviewRequests) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      })
    }

    if (
      roleKey !== 'Owner' &&
      roleKey !== 'Superadmin' &&
      userBranchId &&
      appointmentBranchId &&
      userBranchId !== appointmentBranchId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      })
    }

    branchName = await getAppointmentBranchName(firestore, appointmentBranchId, 'Clinic')
    customerProfile = await getAppointmentCustomerProfile(firestore, appointmentData)

    if (requestType === 'cancel') {
      const totalAmount = Number(appointmentData.totalAmount || appointmentData.amountPaid || appointmentData.amount || 0)
      commissionAmount = Number(appointmentData.commissionAmount || appointmentData.refundCommissionAmount || 0)
      refundAmount = Math.max(0, Number(appointmentData.refundRequestedAmount || totalAmount - commissionAmount))

      const isPayMongoPaid = isPayMongoPaidAppointment(appointmentData)
      const paymentId = String(appointmentData.paymongoPaymentId || '').trim()

      logPayMongoEvent('Cancellation refund eligibility evaluated', {
        appointmentId,
        isPayMongoPaid,
        paymentStatus: String(appointmentData.paymentStatus || '').trim(),
        source: String(appointmentData.source || '').trim(),
        paymongoPaymentId: maskLogValue(paymentId),
        refundAmount,
        commissionAmount,
      })

      if (isPayMongoPaid && paymentId && refundAmount > 0) {
        const refundResponse = await fetch('https://api.paymongo.com/v1/refunds', {
          method: 'POST',
          headers: buildPayMongoHeaders(),
          body: JSON.stringify({
            data: {
              attributes: {
                amount: Math.round(refundAmount * 100),
                payment_id: paymentId,
                reason: 'requested_by_customer',
              },
            },
          }),
        })

        const refundData = await refundResponse.json()
        if (!refundResponse.ok) {
          return res.status(refundResponse.status).json({
            success: false,
            error: refundData?.errors?.[0]?.detail || 'Failed to refund appointment payment via PayMongo',
            provider: refundData,
          })
        }

        paymongoRefundId = refundData?.data?.id || null
        paymongoRefundStatus = refundData?.data?.attributes?.status || 'pending'
      }

      await appointmentRef.update({
        status: 'Cancelled',
        requestDecisionStatus: 'Approved',
        requestDecisionNote: decisionNote,
        requestDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
        requestDecisionById: req.user.uid,
        requestDecisionByName: staffDisplayName,
        refundStatus: 'Approved',
        refundApprovedAmount: refundAmount,
        refundCommissionAmount: commissionAmount,
        refundDecisionNote: decisionNote,
        refundDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
        refundDecisionById: req.user.uid,
        refundDecisionByName: staffDisplayName,
        cancellationApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationApprovedById: req.user.uid,
        cancellationApprovedByName: staffDisplayName,
        paymongoRefundId: paymongoRefundId || appointmentData.paymongoRefundId || null,
        paymongoRefundStatus: paymongoRefundStatus || appointmentData.paymongoRefundStatus || null,
        paymentStatus: isPayMongoPaid && refundAmount > 0 ? 'Refunded' : String(appointmentData.paymentStatus || ''),
        refundedAt: isPayMongoPaid && refundAmount > 0 ? admin.firestore.FieldValue.serverTimestamp() : appointmentData.refundedAt || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      if (isPayMongoPaid && refundAmount > 0) {
        await firestore.collection('transactions').add({
          branchId: appointmentBranchId,
          amount: -Math.abs(refundAmount),
          method: appointmentData.paymentMethod || 'PayMongo',
          status: 'Refunded',
          type: 'appointment_refund',
          appointmentId,
          clientName: appointmentData.customerName || customerProfile?.customerName || 'Customer',
          service: appointmentData.service || 'Appointment Cancellation Refund',
          paymongoPaymentId: paymentId,
          paymongoRefundId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }

      try {
      const notificationMessage = isPayMongoPaid && refundAmount > 0
          ? `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved. A refund of ${formatPhilippineCurrency(refundAmount)} has been initiated. The platform commission of ${formatPhilippineCurrency(commissionAmount)} is non-refundable and was retained according to platform policy. The refund may take 3 to 5 business days to reflect, depending on your bank or payment method.`
          : `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved. The refund may take 3 to 5 business days to reflect, depending on your bank or payment method. If your appointment was not paid online, no refund will be issued.`

        await createAppointmentNotification({
          firestore,
          customerId: customerProfile?.customerId || appointmentData.customerId || '',
          title: 'Cancellation Approved',
          message: notificationMessage,
          link: '/customer/appointments',
        })
      } catch (notificationError) {
        warnings.push(notificationError?.message || 'Failed to create appointment notification.')
      }

      try {
        logPayMongoEvent('Cancellation email payload', {
          appointmentId,
          recipient: customerProfile?.customerEmail || appointmentData.customerEmail || '',
          requestType: 'cancel',
          refundAmount,
          commissionAmount,
          isPayMongoPaid,
          appointmentDate: appointmentData.date || '',
          appointmentTime: appointmentData.time || '',
          source: String(appointmentData.source || '').trim(),
        })
        const emailResult = await sendAppointmentDecisionEmail({
          recipient: customerProfile?.customerEmail || appointmentData.customerEmail || '',
          customerName: customerProfile?.customerName || appointmentData.customerName || 'Customer',
          branchName,
          appointmentLabel: appointmentData.service || 'your appointment',
          requestType: 'cancel',
          refundAmount,
          commissionAmount,
          isPayMongoPaid,
          appointmentDate: appointmentData.date || '',
          appointmentTime: appointmentData.time || '',
        })
        if (emailResult?.skipped) {
          warnings.push(emailResult.reason || 'Appointment cancellation email was skipped.')
        }
      } catch (emailError) {
        warnings.push(emailError?.message || 'Failed to send cancellation email.')
      }

      return res.json({
        success: true,
        data: {
          appointmentId,
          requestType,
          status: 'Cancelled',
          refundAmount,
          commissionAmount,
          paymongoRefundId,
          paymongoRefundStatus,
          warnings,
        },
      })
    }

    const requestedDate = String(appointmentData.requestedDate || '').trim()
    const requestedTime = String(appointmentData.requestedTime || '').trim()
    const requestedPractitionerId = String(
      appointmentData.requestedPractitionerId || appointmentData.practitionerId || appointmentData.assignedPractitionerId || ''
    ).trim()
    const requestedPractitionerName = String(
      appointmentData.requestedPractitionerName || appointmentData.practitionerName || appointmentData.assignedPractitionerName || ''
    ).trim()

    await appointmentRef.update({
      status: 'Scheduled',
      date: requestedDate,
      time: requestedTime,
      practitionerId: requestedPractitionerId,
      assignedPractitionerId: requestedPractitionerId,
      practitionerName: requestedPractitionerName,
      assignedPractitionerName: requestedPractitionerName,
      requestDecisionStatus: 'Approved',
      requestDecisionNote: decisionNote,
      requestDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
      requestDecisionById: req.user.uid,
      requestDecisionByName: staffDisplayName,
      rescheduleDecisionNote: decisionNote,
      rescheduleApprovedAt: admin.firestore.FieldValue.serverTimestamp(),
      rescheduleApprovedById: req.user.uid,
      rescheduleApprovedByName: staffDisplayName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    try {
      await createAppointmentNotification({
        firestore,
        customerId: customerProfile?.customerId || appointmentData.customerId || '',
        title: 'Reschedule Approved',
        message: `Your reschedule request for ${appointmentData.service || 'your appointment'} was approved. Your new schedule is ${[requestedDate, requestedTime].filter(Boolean).join(' ')}.`,
        link: '/customer/appointments',
      })
    } catch (notificationError) {
      warnings.push(notificationError?.message || 'Failed to create appointment notification.')
    }

    try {
      const emailResult = await sendAppointmentDecisionEmail({
        recipient: customerProfile?.customerEmail || appointmentData.customerEmail || '',
        customerName: customerProfile?.customerName || appointmentData.customerName || 'Customer',
        branchName,
        appointmentLabel: appointmentData.service || 'your appointment',
        requestType: 'reschedule',
        refundAmount: 0,
        commissionAmount: 0,
        isPayMongoPaid: false,
        appointmentDate: requestedDate,
        appointmentTime: requestedTime,
      })
      if (emailResult?.skipped) {
        warnings.push(emailResult.reason || 'Appointment reschedule email was skipped.')
      }
    } catch (emailError) {
      warnings.push(emailError?.message || 'Failed to send reschedule email.')
    }

    return res.json({
      success: true,
      data: {
        appointmentId,
        requestType,
        status: 'Scheduled',
        warnings,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to approve appointment request',
    })
  }
})

app.post('/paymongo/create-checkout-session', optionalAuth, async (req, res) => {
  if (!assertPayMongoConfigured(res)) return

  const {
    amount,
    paymentMethodType,
    paymentMethodTypes,
    description,
    referenceNumber,
    metadata,
    billing,
    lineItems,
    successUrl,
    cancelUrl,
  } = req.body ?? {}

  const moduleKey = String(metadata?.module || '').trim().toLowerCase()
  const isSubscriptionCheckout = moduleKey === 'subscription'
  const isCustomerOrderCheckout = moduleKey === 'customer_order'
  const isCustomerBookingCheckout =
    moduleKey === 'customer_appointment' ||
    moduleKey === 'customer_consultation'
  const reservationId = String(metadata?.reservationId || '').trim()
  const totalServiceDurationMinutes = Math.max(
    30,
    Number(metadata?.totalServiceDurationMinutes || metadata?.durationMinutes || 0)
  )

  if (!isSubscriptionCheckout) {
    if (!req.user?.uid) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization token',
      })
    }
    if (isCustomerOrderCheckout || isCustomerBookingCheckout) {
      const metadataCustomerId = String(metadata?.customerId || '').trim()
      if (!metadataCustomerId || metadataCustomerId !== req.user.uid) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
        })
      }
      if (isCustomerBookingCheckout) {
        const firestore = admin.firestore()
        const appointmentId = String(metadata?.appointmentId || '').trim()
        if (appointmentId) {
          const appointmentSnap = await firestore.collection('appointments').doc(appointmentId).get()
          if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
          const appointmentData = appointmentSnap.data() || {}
          if (String(appointmentData.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
          if (!['approved', 'payment pending', 'contract pending', 'balance due'].includes(normalizeBookingStatus(appointmentData.status))) {
            return res.status(409).json({ success: false, error: 'This appointment is not ready for payment.' })
          }
          if (appointmentData.contractRequired === true && normalizeBookingStatus(appointmentData.contract?.status) !== 'signed') {
            return res.status(409).json({ success: false, error: 'The customer must sign the contract before payment.' })
          }
          const remainingAmount = Math.max(0, Number(appointmentData.totalAmount || appointmentData.amount || 0) - Number(appointmentData.amountPaid || 0))
          if (remainingAmount <= 0) return res.status(409).json({ success: false, error: 'This appointment has no remaining balance.' })
          if (Math.abs(Number(amount || 0) - Math.round(remainingAmount * 100)) > 1) {
            return res.status(409).json({ success: false, error: 'Payment amount does not match the appointment balance.' })
          }
        } else if (reservationId) {
          const reservationSnap = await firestore.collection(BOOKING_RESERVATIONS_COLLECTION).doc(reservationId).get()
          if (!reservationSnap.exists) {
            return res.status(404).json({
              success: false,
              error: 'Reservation not found',
            })
          }
          const reservationData = reservationSnap.data() || {}
          if (String(reservationData.customerId || '').trim() !== req.user.uid) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
            })
          }
          if (normalizeBookingStatus(reservationData.status) !== 'held' || toMillis(reservationData.expiresAt) <= Date.now()) {
            return res.status(409).json({
              success: false,
              error: 'Reservation is no longer active',
            })
          }
        } else {
          const branchId = String(metadata?.branchId || '').trim()
          const practitionerId = String(metadata?.practitionerId || '').trim()
          const appointmentDate = String(metadata?.appointmentDate || '').trim()
          const appointmentTime = String(metadata?.appointmentTime || '').trim()
          const appointmentStart = parseClockToMinutes(appointmentTime)
          if (!branchId || !practitionerId || !appointmentDate || appointmentStart === null) {
            return res.status(400).json({
              success: false,
              error: 'branchId, practitionerId, appointmentDate, and appointmentTime are required for customer bookings',
            })
          }
          const existingAppointments = await firestore.collection('appointments')
            .where('branchId', '==', branchId)
            .where('date', '==', appointmentDate)
            .where('assignedPractitionerId', '==', practitionerId)
            .get()
          const appointmentEnd = appointmentStart + totalServiceDurationMinutes
          const conflicting = existingAppointments.docs.some((docSnap) => {
            const data = docSnap.data() || {}
            const status = normalizeBookingStatus(data.status)
            if (!BOOKING_BLOCKING_STATUSES.has(status)) return false
            const range = getBookingRange(data)
            return range && rangesOverlap(appointmentStart, appointmentEnd, range.start, range.end)
          })
          if (conflicting) {
            return res.status(409).json({
              success: false,
              error: 'That schedule was just taken. Please choose another available time.',
            })
          }
        }
      }
    } else {
      try {
        if (!req.userContext || req.userContext.uid !== req.user.uid) {
          req.userContext = await loadUserContext(req.user.uid)
        }
        if (!req.userContext.permissions.has('payments:create')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
          })
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to verify permission',
        })
      }
    }
  }

  if (isSubscriptionCheckout && req.user?.uid) {
    try {
      const firestore = admin.firestore()
      const userSnap = await firestore.collection('users').doc(req.user.uid).get()
      const userData = userSnap.exists ? userSnap.data() || {} : {}

      if (isOwnerRoleValue(userData.role || userData.userType)) {
        const targetPlan = normalizePlanKey(metadata?.planId)
        const context = await loadOwnerSubscriptionContext(firestore, req.user.uid)
        const now = new Date()
        const hasActiveCurrentCycle = Boolean(
          context.currentExpiresAt && context.currentExpiresAt.getTime() > now.getTime()
        )

        if (!['basic', 'premium'].includes(targetPlan)) {
          return res.status(400).json({
            success: false,
            error: 'Only paid plans can be checked out here.',
          })
        }

        if (targetPlan === context.currentPlan && hasActiveCurrentCycle) {
          return res.status(409).json({
            success: false,
            error: "You're already on this plan.",
            code: 'ALREADY_ON_PLAN',
          })
        }

        if (
          context.pendingPlan &&
          context.pendingPlan === targetPlan &&
          context.pendingApplyAt &&
          context.pendingApplyAt.getTime() > now.getTime()
        ) {
          return res.status(409).json({
            success: false,
            error: 'This plan change is already scheduled for your next billing cycle.',
            code: 'PLAN_CHANGE_ALREADY_SCHEDULED',
          })
        }
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to validate subscription checkout.',
      })
    }
  }

  const normalizedAmount = Number(amount || 0)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'amount must be a positive number in centavos',
    })
  }

  const normalizeMethod = (value) => String(value || '').trim().toLowerCase()
  const allowedMethods = [
    'card',
    'gcash',
    'grab_pay',
    'billease',
    'paymaya',
    'dob',
    'dob_ubp',
    'brankas_bdo',
    'brankas_landbank',
    'brankas_metrobank',
  ]
  const methodsFromArray = Array.isArray(paymentMethodTypes)
    ? paymentMethodTypes.map(normalizeMethod).filter((method) => allowedMethods.includes(method))
    : []
  const methodFromSingle = normalizeMethod(paymentMethodType)
  const selectedMethods =
    methodsFromArray.length > 0
      ? methodsFromArray
      : allowedMethods.includes(methodFromSingle)
        ? [methodFromSingle]
        : []

  const fallbackLineItem = [
    {
      amount: Math.round(normalizedAmount),
      currency: 'PHP',
      name: description || 'POS Payment',
      quantity: 1,
    },
  ]

  const payload = {
    data: {
      attributes: {
        billing: billing && typeof billing === 'object' ? billing : null,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: String(description || 'POS Payment'),
        line_items: Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : fallbackLineItem,
        ...(selectedMethods.length > 0 ? { payment_method_types: selectedMethods } : {}),
        reference_number: String(referenceNumber || ''),
        metadata: {
          ...(metadata && typeof metadata === 'object' ? metadata : {}),
          ...(isSubscriptionCheckout && req.user?.uid ? { ownerUid: req.user.uid } : {}),
        },
        success_url:
          successUrl ||
          `${resolveFrontendBaseUrl(req)}/receptionist/pos?paymongo_status=success`,
        cancel_url:
          cancelUrl ||
          `${resolveFrontendBaseUrl(req)}/receptionist/pos?paymongo_status=cancelled`,
      },
    },
  }

  try {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: buildPayMongoHeaders(),
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!response.ok) {
      logPayMongoEvent('Checkout session creation failed', {
        moduleKey,
        referenceNumber: String(referenceNumber || ''),
        amount: normalizedAmount,
        status: response.status,
        error: data?.errors?.[0]?.detail || 'Failed to create checkout session',
      })
      return res.status(response.status).json({
        success: false,
        error: data?.errors?.[0]?.detail || 'Failed to create checkout session',
        provider: data,
      })
    }

    logPayMongoEvent('Checkout session created', {
      checkoutSessionId: data?.data?.id || null,
      moduleKey,
      referenceNumber: String(referenceNumber || ''),
      amount: normalizedAmount,
      customerId: String(metadata?.customerId || '').trim(),
      source: String(metadata?.source || '').trim(),
    })

    return res.json({
      success: true,
      data: {
        id: data?.data?.id,
        checkout_url: data?.data?.attributes?.checkout_url,
        client_key: data?.data?.attributes?.client_key,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unexpected PayMongo error',
    })
  }
})

app.post('/appointments/:id/record-payment', requireAuth, async (req, res) => {
  if (!assertPayMongoConfigured(res)) return

  const appointmentId = String(req.params.id || '').trim()
  const checkoutSessionId = String(req.body?.checkoutSessionId || '').trim()
  if (!appointmentId || !checkoutSessionId) return res.status(400).json({ success: false, error: 'appointment id and checkoutSessionId are required' })

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
    const appointment = appointmentSnap.data() || {}
    if (String(appointment.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (!['approved', 'payment pending', 'contract pending', 'balance due', 'paid', 'partially paid'].includes(normalizeBookingStatus(appointment.status))) {
      return res.status(409).json({ success: false, error: 'Payment is not available for this appointment yet.' })
    }
    if (appointment.contractRequired === true && normalizeBookingStatus(appointment.contract?.status) !== 'signed') {
      return res.status(409).json({ success: false, error: 'The customer must sign the contract before payment.' })
    }

    if (String(appointment.paymongoCheckoutSessionId || '').trim() === checkoutSessionId) {
      return res.json({
        success: true,
        data: {
          appointmentId,
          status: appointment.status,
          amountPaid: Number(appointment.amountPaid || 0),
          paymentCoverage: appointment.paymentCoverage || 'pending',
          alreadyRecorded: true,
        },
      })
    }

    const providerResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
      method: 'GET',
      headers: buildPayMongoHeaders(),
    })
    const providerData = await providerResponse.json()
    if (!providerResponse.ok) return res.status(providerResponse.status).json({ success: false, error: providerData?.errors?.[0]?.detail || 'Failed to verify payment', provider: providerData })

    const attributes = providerData?.data?.attributes || {}
    const metadata = attributes.metadata || {}
    const paid = Boolean(attributes.paid_at) || (Array.isArray(attributes.payments) && attributes.payments.length > 0)
    if (String(metadata.appointmentId || '').trim() !== appointmentId || String(metadata.customerId || '').trim() !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Payment session does not belong to this appointment.' })
    }
    if (!paid) return res.status(409).json({ success: false, error: 'Payment has not been completed.' })

    const payment = Array.isArray(attributes.payments) ? attributes.payments[0] || {} : {}
    const paymentId = payment.id || null
    const paymentAmount = Number(payment.attributes?.amount || 0) / 100
    const totalAmount = Number(appointment.totalAmount || appointment.amount || 0)
    const previousAmountPaid = Number(appointment.amountPaid || 0)
    const amountPaid = previousAmountPaid + (paymentAmount || Math.max(0, totalAmount - previousAmountPaid))
    const paymentCoverage = amountPaid + 0.01 >= totalAmount ? 'full' : 'installment'
    if (paymentCoverage === 'installment' && appointment.installmentsAllowed !== true) {
      return res.status(409).json({ success: false, error: 'This appointment requires full payment before the service starts.' })
    }
    const serviceKey = paymentCoverage === 'full'
      ? String(appointment.serviceKey || crypto.randomInt(100000, 1000000))
      : appointment.serviceKey || null

    await appointmentRef.update({
      status: paymentCoverage === 'full' ? 'Paid' : 'Partially Paid',
      paymentStatus: paymentCoverage === 'full' ? 'Paid' : 'Partially Paid',
      paymentCoverage,
      amountPaid,
      paymongoCheckoutSessionId: checkoutSessionId,
      paymongoPaymentId: paymentId,
      paymongoStatus: attributes.status || 'paid',
      paymongoPaidAt: attributes.paid_at || admin.firestore.FieldValue.serverTimestamp(),
      serviceKey,
      serviceKeyStatus: serviceKey ? 'pending_exchange' : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return res.json({ success: true, data: { appointmentId, status: paymentCoverage === 'full' ? 'Paid' : 'Partially Paid', amountPaid, paymentCoverage } })
  } catch (error) {
    console.error('appointments/record-payment error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to record appointment payment' })
  }
})

app.get('/paymongo/checkout-session/:id', optionalAuth, async (req, res) => {
  if (!assertPayMongoConfigured(res)) return

  const checkoutSessionId = String(req.params.id || '').trim()
  if (!checkoutSessionId) {
    return res.status(400).json({
      success: false,
      error: 'checkout session id is required',
    })
  }

  try {
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
      method: 'GET',
      headers: buildPayMongoHeaders(),
    })

    const data = await response.json()
    if (!response.ok) {
      logPayMongoEvent('Checkout session lookup failed', {
        checkoutSessionId,
        status: response.status,
        error: data?.errors?.[0]?.detail || 'Failed to retrieve checkout session',
      })
      return res.status(response.status).json({
        success: false,
        error: data?.errors?.[0]?.detail || 'Failed to retrieve checkout session',
        provider: data,
      })
    }

    const attributes = data?.data?.attributes || {}
    const isPaid = Boolean(attributes?.paid_at) || (Array.isArray(attributes?.payments) && attributes.payments.length > 0)
    const metadata = attributes?.metadata || {}
    const moduleKey = String(metadata?.module || '').trim().toLowerCase()
    const isCustomerOrderCheckout = moduleKey === 'customer_order'
    const isCustomerBookingCheckout =
      moduleKey === 'customer_appointment' ||
      moduleKey === 'customer_consultation'

    logPayMongoEvent('Checkout session status fetched', {
      checkoutSessionId,
      moduleKey,
      status: attributes?.status || null,
      paidAt: attributes?.paid_at || null,
      paymentCount: Array.isArray(attributes?.payments) ? attributes.payments.length : 0,
      isPaid,
      paymentId: maskLogValue(attributes?.payments?.[0]?.id || metadata?.paymongoPaymentId || ''),
      customerId: String(metadata?.customerId || '').trim(),
      source: String(metadata?.source || '').trim(),
    })

    if (isCustomerOrderCheckout || isCustomerBookingCheckout) {
      if (!req.user?.uid) {
        return res.status(401).json({
          success: false,
          error: 'Missing authorization token',
        })
      }
      const metadataCustomerId = String(metadata?.customerId || '').trim()
      if (!metadataCustomerId || metadataCustomerId !== req.user.uid) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
        })
      }
    } else if (moduleKey !== 'subscription') {
      if (!req.user?.uid) {
        return res.status(401).json({
          success: false,
          error: 'Missing authorization token',
        })
      }
      try {
        if (!req.userContext || req.userContext.uid !== req.user.uid) {
          req.userContext = await loadUserContext(req.user.uid)
        }
        if (!req.userContext.permissions.has('payments:view')) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
          })
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to verify permission',
        })
      }
    }

    let subscriptionAction = null

    if (isPaid && String(metadata?.module || '').trim().toLowerCase() === 'subscription') {
      try {
        const payerEmail = String(metadata?.payerEmail || metadata?.email || '').trim().toLowerCase()
        const planId = String(metadata?.planId || '').trim().toLowerCase()
        const ownerUidFromMetadata = String(metadata?.ownerUid || '').trim()
        const billingCycle = String(metadata?.billingCycle || 'month').trim() || 'month'
        if ((ownerUidFromMetadata || payerEmail) && planId) {
          const firestore = admin.firestore()
          let ownerUid = ownerUidFromMetadata
          if (!ownerUid) {
            const usersSnap = await firestore.collection('users').where('email', '==', payerEmail).limit(1).get()
            ownerUid = usersSnap.empty ? '' : usersSnap.docs[0].id
          }

          if (ownerUid) {
            const paidAtMs = attributes?.paid_at ? Date.parse(attributes.paid_at) : Date.now()
            const paidAt = new Date(Number.isNaN(paidAtMs) ? Date.now() : paidAtMs)
            const paymentReference =
              String(attributes?.payments?.[0]?.id || data?.data?.id || '').trim() || null

            subscriptionAction = await applySubscriptionPaymentForOwner({
              firestore,
              ownerUid,
              targetPlan: planId,
              paidAt,
              paymentReference,
              billingCycle,
            })
          }
        }
      } catch (error) {
        console.error('Failed to backfill subscription after PayMongo payment:', error?.message || error)
      }
    }

    return res.json({
      success: true,
      data: {
        id: data?.data?.id,
        status: attributes?.status || null,
        paid_at: attributes?.paid_at || null,
        payments: attributes?.payments || [],
        metadata: attributes?.metadata || {},
        isPaid,
        subscriptionAction,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unexpected PayMongo error',
    })
  }
})

app.post('/customer/orders/:id/cancel', requireAuth, async (req, res) => {
  if (!assertPayMongoConfigured(res)) return

  const orderId = String(req.params.id || '').trim()
  const reasonType = String(req.body?.reasonType || '').trim()
  const reasonDetails = String(req.body?.reasonDetails || '').trim()
  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: 'order id is required',
    })
  }
  if (!reasonType) {
    return res.status(400).json({
      success: false,
      error: 'reasonType is required',
    })
  }
  if (reasonType === 'Other' && !reasonDetails) {
    return res.status(400).json({
      success: false,
      error: 'reasonDetails is required when reasonType is Other',
    })
  }

  try {
    const firestore = admin.firestore()
    const orderRef = firestore.collection('customerOrders').doc(orderId)
    const orderSnap = await orderRef.get()

    if (!orderSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      })
    }

    const orderData = orderSnap.data() || {}
    if (String(orderData.customerId || '').trim() !== String(req.user?.uid || '').trim()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      })
    }

    const status = String(orderData.status || '').trim().toLowerCase()
    if (['cancelled', 'completed', 'refunded', 'shipped', 'out for delivery', 'delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'This order can no longer be cancelled because it has already been shipped or completed.',
      })
    }

    const createdAt = orderData.createdAt?.toDate?.() || new Date(orderData.createdAt || 0)
    if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Order creation date is invalid.',
      })
    }

    const diffHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
    if (diffHours > 24) {
      return res.status(400).json({
        success: false,
        error: 'Orders can only be cancelled within 24 hours.',
      })
    }

    const totalAmount = Number(orderData.total || 0)
    const paymentId = String(orderData.paymongoPaymentId || '').trim()
    const isPayMongoPaid =
      String(orderData.source || '').trim().toLowerCase() === 'paymongo_checkout' &&
      String(orderData.paymentStatus || '').trim().toLowerCase() === 'paid' &&
      Boolean(paymentId)

    let refundId = null
    let refundStatus = null

    if (isPayMongoPaid) {
      const refundResponse = await fetch('https://api.paymongo.com/v1/refunds', {
        method: 'POST',
        headers: buildPayMongoHeaders(),
        body: JSON.stringify({
          data: {
            attributes: {
              amount: Math.round(totalAmount * 100),
              payment_id: paymentId,
              reason: 'requested_by_customer',
            },
          },
        }),
      })

      const refundData = await refundResponse.json()
      if (!refundResponse.ok) {
        return res.status(refundResponse.status).json({
          success: false,
          error: refundData?.errors?.[0]?.detail || 'Failed to refund payment via PayMongo',
          provider: refundData,
        })
      }

      refundId = refundData?.data?.id || null
      refundStatus = refundData?.data?.attributes?.status || 'pending'
    }

    const updatePayload = {
      status: 'Cancelled',
      cancelReasonType: reasonType,
      cancelReasonDetails: reasonType === 'Other' ? reasonDetails : '',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (isPayMongoPaid) {
      updatePayload.paymentStatus = 'Refunded'
      updatePayload.refundType = 'PayMongo'
      updatePayload.refundReason = 'Order cancelled within 24 hours by customer'
      updatePayload.refundAmount = totalAmount
      updatePayload.paymongoRefundId = refundId
      updatePayload.paymongoRefundStatus = refundStatus
      updatePayload.refundedAt = admin.firestore.FieldValue.serverTimestamp()
    }

    await orderRef.update(updatePayload)

    if (isPayMongoPaid) {
      const branchId =
        String(orderData.branchId || '').trim() ||
        String(orderData.items?.[0]?.branchId || '').trim() ||
        ''

      await firestore.collection('transactions').add({
        branchId,
        amount: -Math.abs(totalAmount),
        method: orderData.paymentMethod || 'PayMongo',
        status: 'Refunded',
        type: 'customer_order_refund',
        orderId,
        clientName: orderData.customerName || orderData.delivery?.fullName || 'Customer',
        service: 'Customer Order Cancellation Refund',
        paymongoPaymentId: paymentId,
        paymongoRefundId: refundId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return res.json({
      success: true,
      data: {
        orderId,
        status: 'Cancelled',
        cancelReasonType: reasonType,
        cancelReasonDetails: reasonType === 'Other' ? reasonDetails : '',
        paymentStatus: isPayMongoPaid ? 'Refunded' : String(orderData.paymentStatus || ''),
        refundType: isPayMongoPaid ? 'PayMongo' : null,
        refundAmount: isPayMongoPaid ? totalAmount : 0,
        paymongoRefundId: refundId,
        paymongoRefundStatus: refundStatus,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to cancel order',
    })
  }
})

// Keep unexpected middleware and CORS failures machine-readable in production.
// Route handlers should still return their own domain-specific errors.
app.use((error, req, res, _next) => {
  const requestId = crypto.randomUUID()
  console.error('API_REQUEST_FAILURE', {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    errorName: error?.name || null,
    errorCode: error?.code || null,
    errorMessage: error?.message || null,
    stack: isDevelopment ? error?.stack || null : undefined,
  })

  if (res.headersSent) return
  return res.status(500).json({
    success: false,
    error: 'The API request could not be completed.',
    requestId,
    diagnostic: {
      name: error?.name || null,
      code: error?.code || null,
      message: error?.message || null,
    },
  })
})

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`OTP backend running on http://localhost:${PORT}`)
  })
}

export { admin, runClientContactBackfill }
export default app
