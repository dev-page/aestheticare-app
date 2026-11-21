import { isClinicCustomerDiscoverable, isPublicClinicCustomerDiscoverable, isCustomerCareListing, getCustomerCareListingName, assertCustomerCheckoutSupported } from '../../shared/customerCatalog.js'
import { findClinicNameMatches } from '../../shared/clinicNameMatching.js'
import publicClinicProjection from '../functions/publicClinicProjection.cjs'
import { registerAppointmentPaymentWebhook } from './appointmentPaymentWebhook.js'
import { createAppointmentPaymentHoldReaper } from './appointmentPaymentHolds.js'
import { registerConsultationEvents } from './consultationEvents.js'
import { subscriptionDate } from '../../shared/subscriptionDates.js'
import { subscriptionLifecycle, hasActivePaidCycle, GRACE_PERIOD_DAYS } from '../../shared/subscriptionLifecycle.js'
import { registerSubscriptionTrial } from './subscriptionTrial.js'
import { registerSubscriptionReminders, sendSubscriptionReminders } from './subscriptionReminders.js'
import { serviceOnlyClinicPolicies } from '../../shared/clinicPolicyContent.js'
import { BOOKING_PAYMENT_HOLD_MS, isBookingPaymentHoldReleased, timestampMillis } from '../../shared/bookingPaymentHold.js'
import { cancellationRefundEstimate, isCancellationPolicyEnabled, isReschedulePolicyEnabled, rescheduleAllowanceForPolicy } from '../../shared/appointmentChangePolicy.js'
import { registerOrderWorkflow, prepareOrderSnapshot, finalizeCancelledOrder } from './orderWorkflow.js'
import { registerPayrollWorkflow } from './payrollWorkflow.js'
import { registerHrWorkflow } from './hrWorkflow.js'
import { registerPractitionerTeams, extractPractitionerLicenseNumber, readPractitionerLicenseOcr, validatePractitionerCredentialDocument } from './practitionerTeams.js'
import { appointmentStaffIds, employeeSpecialtyTypes, hasPractitionerPermissions, practitionerTypes } from '../../shared/practitionerTeam.js'
import { registerSupplyWorkflow } from './supplyWorkflow.js'
import { registerPharmacyWorkflow } from './pharmacyWorkflow.js'
import { registerFinanceWorkflow } from './financeWorkflow.js'
import { registerRefundWorkflow } from './refundWorkflow.js'
import { registerPaymentReceiptWorkflow } from './paymentReceiptWorkflow.js'
import { createAppointmentPaymentReceiptPdf, emailAppointmentPaymentReceipt } from './appointmentPaymentReceipts.js'
import { registerListingApproval, approvedOrderLines } from './listingApproval.js'
import { registerBookingMilestones } from './bookingMilestones.js'
import { registerBookingBatch } from './bookingBatch.js'
import { registerSameDayBookings } from './sameDayBookings.js'
import { registerSameDayTreatmentClearance } from './sameDayTreatmentClearance.js'
import { cancelPendingSameDayTreatment, sameDayChangeError } from './sameDayBookingChanges.js'
import { prepareClinicBookingRecipients, writeClinicBookingNotifications, writeClinicAppointmentPaidNotifications } from './clinicBookingNotifications.js'
import { registerConsultationWindows, closeExpiredConsultations } from './consultationWindows.js'
import { remindPendingAppointmentConfirmations } from './appointmentConfirmationReminders.js'
import { registerWalkInPayments, assertWalkInPaymentAgreements } from './walkInWorkflow.js'
import { registerWalkInBookings } from './walkInBookings.js'
import { registerClientDirectory } from './clientDirectory.js'
import { registerGoogleConsultations } from './googleConsultations.js'
import { prepareBooking } from './bookingResources.js'
import { hasConsultationRequirement } from '../../shared/consultationRequirements.js'
import { paymentDue, initialPaymentReceived, afterPaymentStatus, normalized, assertWorkflow, resetAppointmentAccess, bookingOrderReadyForPayment } from './bookingWorkflow.js'
import express from 'express'
import { waitUntil } from '@vercel/functions'
import { registerPublicContact } from './publicContact.js'
import cors from 'cors'
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
import { EMAIL_WEBSITE_URL } from './emailLinks.js'
import { demand, clock, verifyLocation, scanAction } from './attendancePolicy.js'
import { calculateShiftStartAlignment } from '../../shared/philippineOvertime.js'
import { registerAttendanceManagement } from './attendanceManagement.js'
import { registerAttendanceImports } from './attendanceImports.js'
import { createClinicAgreementPdf, clinicAgreementTextHash } from './clinicAgreementDocument.js'
import { CLINIC_PLATFORM_AGREEMENT } from '../../shared/clinicPlatformAgreement.js'
import { recurringScheduleVersions, resolveRecurringScheduleVersion, withRecurringScheduleVersion } from '../../shared/recurringEmployeeSchedules.js'
import { defaultClinicRolePermissions } from '../../shared/clinicRoleDefaults.js'
import {
  clinicRolePagePermissionKeys,
  clinicRolePermissionGrants,
  expandClinicRolePermissions,
} from '../../shared/clinicRolePermissionControls.js'
import { compareRegistrationFields } from './registrationComparisons.js'

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
// The API is hosted behind one trusted reverse proxy in production. Keeping
// this explicit prevents arbitrary X-Forwarded-For headers from being trusted.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS)
app.set('trust proxy', Number.isInteger(configuredProxyHops) && configuredProxyHops >= 0
  ? configuredProxyHops
  : isDevelopment ? false : 1)
const API_RATE_LIMITS = Object.freeze({
  general: { windowMs: 60_000, max: 300 },
  authenticatedUser: { windowMs: 60_000, max: 180 },
  sensitive: { windowMs: 60_000, max: 30 },
  expensive: { windowMs: 60_000, max: 8 },
  publicAuth: { windowMs: 60_000, max: 20 },
})
const apiRateLimitBuckets = new Map()
const consumeApiRateLimit = (key, { windowMs, max }) => {
  const now = Date.now()
  let bucket = apiRateLimitBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    apiRateLimitBuckets.set(key, bucket)
  }
  bucket.count += 1
  return { allowed: bucket.count <= max, remaining: Math.max(0, max - bucket.count), resetAt: bucket.resetAt }
}
const sendRateLimitResponse = (res, result) => {
  res.set('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))))
  res.set('RateLimit-Limit', String(result.limit))
  res.set('RateLimit-Remaining', String(result.remaining))
  res.set('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  return res.status(429).json({ success: false, error: 'Too many requests. Please try again shortly.' })
}
const rateLimitApi = (req, res, next) => {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100)
  const path = String(req.path || '').toLowerCase()
  let policy = API_RATE_LIMITS.general
  let scope = 'api'
  if (/^\/(auth\/|send-otp|send-attendance-pin|send-staff-welcome|send-supplier-welcome|public\/contact|check-user|registration\/)/.test(path)) {
    policy = API_RATE_LIMITS.publicAuth
    scope = 'public-auth'
  }
  if (/\/(ocr|ocr-preflight|auto-verify|trigger-ocr|backup\/zip|attendance\/import|attendance\/imports)(\/|$)/.test(path)) {
    policy = API_RATE_LIMITS.expensive
    scope = 'expensive'
  } else if (/\/(create|submit|approve|reject|cancel|checkout|payment|record|schedule|restore|close|connect|disconnect|upload|resend|verify|activate)(\/|$)/.test(path) || req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    policy = scope === 'public-auth' ? policy : API_RATE_LIMITS.sensitive
    if (scope === 'api') scope = 'sensitive'
  }
  const result = consumeApiRateLimit(`${scope}:${ip}`, policy)
  result.limit = policy.max
  res.set('RateLimit-Limit', String(result.limit))
  res.set('RateLimit-Remaining', String(result.remaining))
  res.set('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  if (!result.allowed) return sendRateLimitResponse(res, result)
  return next()
}
// Periodically reclaim expired keys so long-running instances do not retain
// stale client addresses forever.
const apiRateLimitCleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of apiRateLimitBuckets) {
    if (bucket.resetAt <= now) apiRateLimitBuckets.delete(key)
  }
}, 60_000)
apiRateLimitCleanup.unref?.()
const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGISTRATION_OTP_EXPIRY_MINUTES = 10
const REGISTRATION_OTP_COOLDOWN_SECONDS = 60
const REGISTRATION_OTP_MAX_SENDS = 5
const REGISTRATION_OTP_MAX_VERIFY_ATTEMPTS = 5
const REGISTRATION_OTP_SEND_WINDOW_SECONDS = 15 * 60
const REGISTRATION_ATTEMPT_MAX_PER_WINDOW = 5
const REGISTRATION_ATTEMPT_WINDOW_SECONDS = 15 * 60
const REGISTRATION_ATTEMPT_MAX_PER_DAY = 10
const REGISTRATION_ATTEMPT_DAY_SECONDS = 24 * 60 * 60
const CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS = 3
const CLINIC_REGISTRATION_LOCKOUT_DAYS = 14
const CLINIC_REGISTRATION_OTP_PURPOSE = 'clinic-registration'
const CUSTOMER_REGISTRATION_OTP_PURPOSE = 'customer-registration'
const LOGIN_OTP_PURPOSE = 'login-otp'
const OTP_PATH = '/send-otp'
const REQUEST_REGISTRATION_OTP_PATH = '/auth/request-registration-otp'
const VERIFY_REGISTRATION_OTP_PATH = '/auth/verify-registration-otp'
const REQUEST_CUSTOMER_OTP_PATH = '/auth/request-customer-otp'
const VERIFY_CUSTOMER_OTP_PATH = '/auth/verify-customer-otp'
const REQUEST_LOGIN_OTP_PATH = '/auth/request-login-otp'
const VERIFY_LOGIN_OTP_PATH = '/auth/verify-login-otp'
const CHECK_CUSTOMER_REGISTRATION_STATUS_PATH = '/auth/check-customer-registration-status'
const ATTENDANCE_PIN_PATH = '/send-attendance-pin'
const ATTENDANCE_RECORD_PATH = '/attendance/record'
const ATTENDANCE_MY_RECORDS_PATH = '/attendance/my-records'
const ATTENDANCE_QR_PATH = '/attendance/qr'
const ATTENDANCE_CORRECTION_PATH = '/attendance/correct'
const ATTENDANCE_FIELDS_PATH = '/attendance/fields'
const STAFF_WELCOME_PATH = '/send-staff-welcome'
const RESET_PASSWORD_PATH = '/auth/reset-password'
const CHECK_USER_PATH = '/auth/check-user'
const CHECK_REGISTRATION_ATTEMPT_PATH = '/auth/check-registration-attempt'
const configuredAutoVerificationThreshold = Number(process.env.AUTO_VERIFICATION_THRESHOLD || 0.74)
const AUTO_VERIFICATION_THRESHOLD = Number.isFinite(configuredAutoVerificationThreshold)
  ? Math.max(0.74, Math.min(1, configuredAutoVerificationThreshold))
  : 0.74
// A 30-day window gives administrators and registrants advance notice. Only
// documents with seven or fewer days remaining require replacement before
// review; already expired documents remain rejected.
const REGISTRATION_EXPIRY_HOLD_DAYS = 7
const REGISTRATION_EXPIRY_WARNING_DAYS = 30
const REGISTRATION_EXPIRY_RESUBMISSION_DAYS = 24
// `registrationStatus` is the single, user-facing registration phase. Keep
// account status, approval status, and OCR status separate: they describe
// account access, the reviewer decision, and document processing respectively.
const CLINIC_REGISTRATION_STATUS = Object.freeze({
  PENDING_OTP: 'Pending OTP Verification',
  PENDING_DOCUMENTS: 'Pending Document Submission',
  PENDING_REVIEW: 'Pending Review',
  RESUBMISSION_REQUIRED: 'Resubmission Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
})
const REGISTRATION_DOCUMENT_REQUIREMENTS = {
  clinic: ['governmentIdRepresentativeFront', 'governmentIdRepresentativeBack', 'businessPermit', 'dohAccreditation', 'birRegistration', 'sanitaryCertificate'],
}
const AUTHORIZATION_DOCUMENT_KEY = 'authorizationLetter'
const SUPPORTED_CLINIC_REGISTRATION_DOCUMENTS = new Set([
  ...REGISTRATION_DOCUMENT_REQUIREMENTS.clinic,
  AUTHORIZATION_DOCUMENT_KEY,
])
const getRegistrationDocumentRequirements = (applicantType, application = {}) => {
  const baseRequirements = REGISTRATION_DOCUMENT_REQUIREMENTS[applicantType] || []
  const requirements = [...baseRequirements]
  if (application.permitHolderIsRegistrant === false) requirements.push(AUTHORIZATION_DOCUMENT_KEY)
  return requirements
}
const DOCUMENT_NUMBER_REQUIREMENTS = new Set([
  'businessPermit',
  'birRegistration',
  'sanitaryCertificate',
  'dohAccreditation',
])
const EXPIRY_DATE_REQUIREMENTS = new Set([
  'businessPermit',
  'sanitaryCertificate',
  'dohAccreditation',
])
const BUSINESS_NAME_REQUIREMENTS = new Set([
  'businessPermit',
  'birRegistration',
  'sanitaryCertificate',
  'dohAccreditation',
])
const REGISTRATION_NAME_MATCH_DOCUMENTS = new Set([
  'governmentIdRepresentativeFront',
  ...BUSINESS_NAME_REQUIREMENTS,
])
const REGISTRATION_NAME_MATCH_POLICY_VERSION = 1
const REGISTRATION_DOCUMENT_REVIEW_POLICY_VERSION = 2
const getRegistrationDocumentMinimumTextLength = (docKey) =>
  String(docKey || '').trim() === 'governmentIdRepresentativeBack' ? 10 : 30
const registrationDocumentHash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const getRegistrationNameInputsHash = (application = {}, user = {}) => {
  const snapshot = application.registrationOcrSnapshot || {}
  const hasSnapshot = Boolean(application.registrationOcrSnapshot && typeof application.registrationOcrSnapshot === 'object')
  const ownerName = [
    hasSnapshot ? snapshot.firstName : user.firstName || application.firstName,
    hasSnapshot ? snapshot.middleName : user.midName || user.middleName || application.midName || application.middleName,
    hasSnapshot ? snapshot.lastName : user.lastName || application.lastName,
    hasSnapshot ? snapshot.suffix : user.suffix || application.suffix,
  ].map((part) => String(part || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ')
  const businessName = String(hasSnapshot
    ? snapshot.businessName
    : application.businessName || application.clinicName || application.companyName || user.companyName || '').trim().replace(/\s+/g, ' ')
  return registrationDocumentHash(Buffer.from(JSON.stringify({ ownerName, businessName })))
}

const normalizeRegistrationDateForOcr = (value) => {
  if (!value) return ''
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const getRegistrationBirthDateForOcr = (application = {}, user = {}) => normalizeRegistrationDateForOcr(
  user.birthDate || application.birthDate
)

const getVisionWordConfidence = (annotation) => {
  const confidences = []
  for (const page of annotation?.pages || []) {
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          const confidence = Number(word.confidence)
          if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) confidences.push(confidence)
        }
      }
    }
  }
  if (!confidences.length) return null
  return confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
}
const extractOcrDates = (text) => {
  const dates = []
  const addDate = (year, month, day) => {
    const normalized = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const parsed = new Date(`${normalized}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime())
      && parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() + 1 === Number(month)
      && parsed.getUTCDate() === Number(day)) dates.push(normalized)
  }
  const matcher = /\b(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})\b/g
  for (const match of String(text || '').matchAll(matcher)) {
    const raw = match[1]
    const parts = raw.split(/[-\/.]/).map(Number)
    if (/^\d{1,2}[-\/.]/.test(raw)) addDate(parts[2], parts[0], parts[1])
    else addDate(parts[0], parts[1], parts[2])
  }
  const monthNames = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  }
  const normalizedText = String(text || '').toLowerCase()
  const monthPattern = Object.keys(monthNames).join('|')
  const monthFirst = new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`, 'g')
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\.?[,]?\\s+(\\d{4})\\b`, 'g')
  for (const match of normalizedText.matchAll(monthFirst)) addDate(match[3], monthNames[match[1]], match[2])
  for (const match of normalizedText.matchAll(dayFirst)) addDate(match[3], monthNames[match[2]], match[1])
  return [...new Set(dates)]
}

const OCR_MONTH_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const OCR_DATE_TOKEN_PATTERN = `(?:\\d{4}[-\\/.]\\d{1,2}[-\\/.]\\d{1,2}|\\d{1,2}[-\\/.]\\d{1,2}[-\\/.]\\d{4}|${OCR_MONTH_PATTERN}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+${OCR_MONTH_PATTERN}\\.?[,]?\\s+\\d{4})`

const normalizeOcrDateToken = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/[,]/g, '')
  const numeric = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$|^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/)
  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  }
  let year = 0
  let month = 0
  let day = 0
  if (numeric) {
    if (numeric[1]) [year, month, day] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])]
    else [year, month, day] = [Number(numeric[6]), Number(numeric[4]), Number(numeric[5])]
  } else {
    const monthFirst = raw.match(new RegExp(`^(${OCR_MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(\\d{4})$`))
    const dayFirst = raw.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${OCR_MONTH_PATTERN})\\.?\\s+(\\d{4})$`))
    if (monthFirst) [year, month, day] = [Number(monthFirst[3]), months[monthFirst[1]], Number(monthFirst[2])]
    if (dayFirst) [year, month, day] = [Number(dayFirst[3]), months[dayFirst[2]], Number(dayFirst[1])]
  }
  if (!year || !month || !day) return ''
  const normalized = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${normalized}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day
    ? normalized
    : ''
}

const extractOcrExpiryContext = (text) => {
  const source = String(text || '').toLowerCase().replace(/\s+/g, ' ')
  const rangePattern = new RegExp(`(?:valid(?:ity)?(?:\\s+period)?(?:\\s+from)?|effective(?:\\s+date)?|authorized\\s+to\\s+operate(?:\\s+from)?)\\s*[:\\-]?\\s*(${OCR_DATE_TOKEN_PATTERN})\\s*(?:to|until|through|thru|[-–—])\\s*(${OCR_DATE_TOKEN_PATTERN})`, 'i')
  const range = source.match(rangePattern)
  if (range) {
    return {
      type: 'validity_range',
      validFrom: normalizeOcrDateToken(range[1]),
      validTo: normalizeOcrDateToken(range[2]),
    }
  }
  const expiryPattern = new RegExp(`(?:valid(?:ity)?\\s*(?:until|through|thru|to)|valid\\s+up\\s+to|(?:date\\s+of\\s+)?expiry(?:\\s+date)?|(?:date\\s+of\\s+)?expiration(?:\\s+date)?|expires?(?:\\s+on)?)\\s*[:\\-]?\\s*(${OCR_DATE_TOKEN_PATTERN})`, 'i')
  const expiry = source.match(expiryPattern)
  return {
    type: expiry ? 'expiry_date' : 'not_found',
    validFrom: '',
    validTo: expiry ? normalizeOcrDateToken(expiry[1]) : '',
  }
}

const getOcrExpiryValidation = (text, requiresExpiry) => {
  if (!requiresExpiry) return { valid: null, expired: false, invalidRange: false, daysRemaining: null, accountHold: false, ...extractOcrExpiryContext('') }
  const context = extractOcrExpiryContext(text)
  if (!context.validTo) return { valid: null, expired: false, invalidRange: false, daysRemaining: null, accountHold: false, ...context }
  // Use Philippines calendar dates rather than a server clock boundary. An
  // expiry printed as a date remains valid through that local calendar day.
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {})
  const today = `${localParts.year}-${localParts.month}-${localParts.day}`
  const toUtcDay = (dateKey) => Date.parse(`${dateKey}T00:00:00Z`)
  const endDay = toUtcDay(context.validTo)
  const startDay = context.validFrom ? toUtcDay(context.validFrom) : null
  const todayDay = toUtcDay(today)
  if (startDay !== null && endDay < startDay) return { valid: false, expired: false, invalidRange: true, daysRemaining: null, accountHold: false, ...context }
  const daysRemaining = Math.round((endDay - todayDay) / DAY_MS)
  const expired = daysRemaining < 0
  const accountHold = !expired && daysRemaining <= REGISTRATION_EXPIRY_HOLD_DAYS
  return { valid: !expired && (startDay === null || startDay <= todayDay), expired, invalidRange: false, daysRemaining, accountHold, ...context }
}

const hasActiveRegistrationExpiryHold = (verificationResults = {}) => Object.values(verificationResults || {}).some((result) => {
  const expiry = result?.checks?.expiryDate || result?.expiryDate
  if (!expiry) return false
  return getOcrExpiryValidation(`Expiry date: ${expiry}`, true).accountHold
})
const registrationDocumentLabel = (key) => ({
  businessPermit: 'Business Permit / Registration',
  dohAccreditation: 'DOH License to Operate',
  sanitaryCertificate: 'Sanitary Certificate',
  authorizationLetter: 'Authorization Letter / Proof of Authority',
}[key] || String(key || 'Required document'))
const extractOcrDocumentNumber = (text) => {
  const source = String(text || '').toUpperCase()
  const labelled = source.match(/\b(?:LTO|LICENSE|PERMIT|REGISTRATION|CERTIFICATE|TIN|TAXPAYER\s*(?:ID|NUMBER))\s*(?:NO\.?|NUMBER|#|:)?\s*((?:[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,5}|[A-Z0-9]{4,}))\b/i)
  if (labelled?.[1] && /\d/.test(labelled[1])) return labelled[1]

  const candidates = source.match(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,5}\b|\b\d{6,}\b/g) || []
  return candidates.find((value) => {
    // A date such as 02-28-2024 is not a document number.
    if (/^\d{2}-\d{2}-\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    return /\d/.test(value)
  }) || ''
}
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDirectRun = process.argv[1] ? path.resolve(process.argv[1]) === __filename : false

// Load backend-only environment variables from otp-backend/.env.
dotenv.config({ path: path.resolve(__dirname, '.env') })

console.log("Loaded ENV:", {
  PORT: process.env.PORT,
  MAILJET_API_KEY: process.env.MAILJET_API_KEY ? "present" : "missing",
  MAILJET_SECRET_KEY: process.env.MAILJET_SECRET_KEY ? "present" : "missing",
  MAILJET_SENDER: process.env.MAILJET_SENDER,
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
    process.env.CUSTOMER_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? (/^https?:\/\//i.test(process.env.VERCEL_PROJECT_PRODUCTION_URL)
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
      : '',
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
app.use(rateLimitApi)
app.use('/supply', express.json({ limit: '8mb' }))
app.use('/attendance', express.json({ limit: '5mb' }))
app.use(express.json({ limit: '15mb', verify: (req, _res, buffer) => {
  if (req.path === '/paymongo/webhook') req.rawBody = buffer
} }))
registerPublicContact(app, admin)
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON request body',
    })
  }
  return next(error)
})

const mailjetApiKey = process.env.MAILJET_API_KEY || ''
const mailjetSecretKey = process.env.MAILJET_SECRET_KEY || ''
const senderEmail = process.env.MAILJET_SENDER || ''
const payMongoSecretKey = process.env.PAYMONGO_SECRET_KEY || ''
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'
// The production app is served from its custom domain and Vercel forwards
// /api/* into this Express handler. Ignore stale Vercel-preview callback URLs
// in the production environment so Google always receives the public callback.
const googleOauthRedirectUri = String(process.env.VERCEL_ENV || '').trim() === 'production'
  ? 'https://aestheticare.online/api/google-meet/oauth/callback'
  : String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim()
const configuredServiceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim()
const serviceAccountPath = configuredServiceAccountPath
  ? path.isAbsolute(configuredServiceAccountPath)
    ? configuredServiceAccountPath
    : path.resolve(__dirname, configuredServiceAccountPath)
  : path.join(__dirname, 'serviceAccountKey.json')
const googleOauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const googleOauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const firebaseServiceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
const firebaseServiceAccountBase64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()

let caviteBoundaryCache = null
let caviteBoundaryCacheAt = 0
const CAVITE_BOUNDARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const postmarkClient = mailjetApiKey && mailjetSecretKey ? {
  async sendEmail({ From, To, Subject, TextBody, HtmlBody, Attachments, timeoutMs }) {
    const auth = Buffer.from(`${mailjetApiKey}:${mailjetSecretKey}`).toString('base64')
    const response = await fetch('https://api.mailjet.com/v3.1/send', { method: 'POST', ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}), headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ Messages: [{ From: { Email: From || senderEmail }, To: String(To).split(',').map((Email) => ({ Email: Email.trim() })).filter(({ Email }) => Email), Subject, TextPart: TextBody || '', HTMLPart: HtmlBody || '', ...(Array.isArray(Attachments) && Attachments.length ? { Attachments } : {}) }] }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.ErrorMessage || 'Mailjet delivery failed.')
    const result = payload?.Messages?.[0]
    return { ErrorCode: result?.Status === 'success' ? 0 : 1, MessageID: result?.To?.[0]?.MessageID || null }
  }
} : null

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

const isGoogleMeetConfigured = () => Boolean(
  googleOauthClientId && googleOauthClientSecret && googleOauthRedirectUri
  && Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '', 'base64').length === 32
)

const sendPostmarkMessage = async (message) => {
  if (!postmarkClient) return { statusCode: null, messageId: null }
  const response = await postmarkClient.sendEmail({
    From: senderEmail,
    To: message.to,
    Subject: message.subject,
    TextBody: message.text,
    HtmlBody: message.html,
    timeoutMs: message.timeoutMs,
  })
  return {
    statusCode: response?.ErrorCode === 0 ? 200 : response?.ErrorCode || null,
    messageId: response?.MessageID || null,
  }
}

const ACTIVATION_EXPIRY_MS = 24 * 60 * 60 * 1000
const ACTIVATION_SEND_WINDOW_MS = 24 * 60 * 60 * 1000
const ACTIVATION_MAX_SENDS = 5
const activationTokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex')

const createAccountActivation = async ({ firestore, uid, email, name = 'User', req, temporaryPassword = '' }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!uid || !EMAIL_ADDRESS_REGEX.test(normalizedEmail)) throw new Error('A valid account email is required.')
  const token = crypto.randomBytes(32).toString('hex')
  const tokenRef = firestore.collection('accountActivations').doc(activationTokenHash(token))
  const userRef = firestore.collection('users').doc(uid)
  const now = Date.now()
  await firestore.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef)
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const windowStartedAt = userData.activationSendWindowStartedAt?.toDate?.()?.getTime?.() || Date.parse(userData.activationSendWindowStartedAt || '') || 0
    const previousCount = Number(userData.activationSendCount || 0)
    const windowActive = windowStartedAt > 0 && now - windowStartedAt < ACTIVATION_SEND_WINDOW_MS
    const sendCount = windowActive ? previousCount : 0
    if (sendCount >= ACTIVATION_MAX_SENDS) {
      const error = new Error('Activation email resend limit reached. Please try again after 24 hours.')
      error.code = 'ACTIVATION_LIMIT'
      error.retryAfterSeconds = Math.max(1, Math.ceil((windowStartedAt + ACTIVATION_SEND_WINDOW_MS - now) / 1000))
      throw error
    }
    transaction.set(tokenRef, {
      uid,
      email: normalizedEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(now + ACTIVATION_EXPIRY_MS),
      used: false,
    })
    transaction.set(userRef, {
      activationTokenHash: tokenRef.id,
      activationLastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      activationSendCount: sendCount + 1,
      activationSendWindowStartedAt: windowActive
        ? userData.activationSendWindowStartedAt
        : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  })
  const activationUrl = `${EMAIL_WEBSITE_URL}/activate-account?token=${encodeURIComponent(token)}`
  const passwordLine = temporaryPassword ? `Temporary password: ${temporaryPassword}\n\n` : ''
  const delivery = await sendPostmarkMessage({
    to: normalizedEmail,
    subject: 'Activate your AesthetiCare account',
    text: `Hi ${String(name || 'User').trim() || 'User'},\n\nYour AesthetiCare account is ready. Activate it using this link:\n${activationUrl}\n\n${passwordLine}This activation link expires in 24 hours and can only be used once.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(name || 'User').trim() || 'User'},</p><p>Your AesthetiCare account is ready.</p><p><a href="${activationUrl}" style="display:inline-block;padding:12px 18px;background:#8d5a3b;color:#fff;text-decoration:none;border-radius:6px;">Activate Account</a></p>${temporaryPassword ? `<p><strong>Temporary password:</strong> ${temporaryPassword}</p>` : ''}<p>This link expires in 24 hours and can only be used once.</p></div>`,
  })
  return { activationUrl, delivery }
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

const getVisionResponseError = (response) => {
  const error = response?.error
  if (!error) return ''
  return String(error?.message || error?.code || 'Vision returned an OCR processing error.').trim()
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
  return Boolean(paymentId) && ['paid', 'partially paid'].includes(paymentStatus) && Boolean(source === 'paymongo_checkout' || appointmentData.paymongoPaidAt || appointmentData.recordedPaymentSessions?.length)
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
  const refundSummary = requestType !== 'cancel'
    ? ''
    : isPayMongoPaid
      ? refundAmount > 0
        ? `We initiated a refund of ${formatPhilippineCurrency(refundAmount)}. The platform commission of ${formatPhilippineCurrency(commissionAmount)} is non-refundable and was retained according to platform policy.`
        : 'No refundable amount remained after excluding the non-refundable platform commission.'
      : 'No online refund was available for this appointment.'
  const timingText = 'The refund may take 3 to 5 business days to reflect, depending on your bank or payment method.'
  const subject =
    requestType === 'cancel'
      ? 'Your appointment cancellation was approved and refund processing started'
      : requestType === 'clinic_reschedule'
        ? 'Your appointment schedule has changed'
        : 'Your appointment reschedule request was approved'

  const intro =
    requestType === 'cancel'
      ? `Hi ${safeCustomerName}, your cancellation request for ${safeAppointmentLabel} was approved by ${safeBranchName}.`
      : requestType === 'clinic_reschedule'
        ? `Hi ${safeCustomerName}, ${safeBranchName} has rescheduled your ${safeAppointmentLabel} because of a clinic schedule change.`
        : `Hi ${safeCustomerName}, your reschedule request for ${safeAppointmentLabel} was approved by ${safeBranchName}.`

  const clinicRescheduleHelp = requestType === 'clinic_reschedule'
    ? 'If this new time does not work for you, contact the clinic or submit a reschedule request from My Appointments.'
    : ''

  const scheduleLine = safeDate || safeTime
    ? `<p><strong>New schedule:</strong> ${[safeDate, safeTime].filter(Boolean).join(' ')}</p>`
    : ''
  const text =
    `${intro}\n\n` +
    `${refundSummary ? `${refundSummary}\n${timingText}\n\n` : ''}` +
    (safeDate || safeTime ? `Schedule: ${[safeDate, safeTime].filter(Boolean).join(' ')}\n\n` : '') +
    `${clinicRescheduleHelp ? `${clinicRescheduleHelp}\n\n` : ''}` +
    `If you have questions, please contact the clinic.`

  const message = {
    to: normalizedRecipient,
    from: senderEmail,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;">
        <p>${intro}</p>
        ${refundSummary ? `<p>${refundSummary}</p><p>${timingText}</p>` : ''}
        ${scheduleLine}
        ${clinicRescheduleHelp ? `<p>${clinicRescheduleHelp}</p>` : ''}
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

const clinicSubmissionPolicyRef = (firestore, email) => firestore
  .collection('clinicRegistrationSubmissionLimits')
  .doc(hashRateLimitKey(`clinic:${String(email || '').trim().toLowerCase()}`))

const getClinicSubmissionLock = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return null
  const snapshot = await clinicSubmissionPolicyRef(admin.firestore(), normalizedEmail).get()
  if (!snapshot.exists) return null
  const lockedUntil = getTimestampDate(snapshot.data()?.lockedUntil)
  return lockedUntil && lockedUntil.getTime() > Date.now() ? lockedUntil : null
}

const clinicSubmissionLockPayload = (lockedUntil) => ({
  success: false,
  code: 'CLINIC_REGISTRATION_LOCKED',
  error: `You have used all ${CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS} document submissions. You may apply again after ${lockedUntil.toLocaleDateString('en-PH')}.`,
  retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)),
  lockedUntil: lockedUntil.toISOString(),
})

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

const getIdTokenDiagnostics = (token) => {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return {}
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return {
      audience: typeof claims.aud === 'string' ? claims.aud : null,
      issuer: typeof claims.iss === 'string' ? claims.iss : null,
      expiresAt: Number.isFinite(Number(claims.exp)) ? Number(claims.exp) : null,
    }
  } catch (_error) {
    return {}
  }
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
    const userLimit = consumeApiRateLimit(`user:${String(decoded.uid || '').slice(0, 128)}`, API_RATE_LIMITS.authenticatedUser)
    if (!userLimit.allowed) {
      userLimit.limit = API_RATE_LIMITS.authenticatedUser.max
      return sendRateLimitResponse(res, userLimit)
    }
    return next()
  } catch (error) {
    const tokenDiagnostics = getIdTokenDiagnostics(tokenMatch[1])
    console.warn('Firebase ID token verification failed:', {
      code: error?.code || 'unknown',
      message: error?.message || 'unknown error',
      expectedProjectId: firebaseProjectId || null,
      tokenAudience: tokenDiagnostics.audience,
      tokenIssuer: tokenDiagnostics.issuer,
      tokenExpired: tokenDiagnostics.expiresAt ? tokenDiagnostics.expiresAt * 1000 <= Date.now() : null,
    })
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization token',
      code: error?.code || 'auth/invalid-id-token',
    })
  }
}

// Customer chat messages are written to their Firestore thread by the customer.
// Notification recipients are resolved here so a customer can never choose who
// receives a clinic notification from the browser.
app.post('/customer-chat-notification', requireAuth, async (req, res) => {
  try {
    const branchId = String(req.body?.branchId || '').trim()
    const message = String(req.body?.message || '').trim().slice(0, 240)
    if (!branchId || !message) return res.status(400).json({ success: false, error: 'Branch and message are required.' })

    const firestore = admin.firestore()
    const [customerSnap, clinicSnap, branchUsers] = await Promise.all([
      firestore.collection('users').doc(req.user.uid).get(),
      firestore.collection('clinics').doc(branchId).get(),
      firestore.collection('users').where('branchId', '==', branchId).get(),
    ])
    const customer = customerSnap.data() || {}
    const customerRole = String(customer.role || customer.roleKey || '').trim().toLowerCase()
    if (!customerSnap.exists || !['customer', 'client', 'patient'].includes(customerRole)) return res.status(403).json({ success: false, error: 'Only customer accounts can send clinic chat notifications.' })
    if (!clinicSnap.exists) return res.status(404).json({ success: false, error: 'Clinic branch not found.' })

    const clinic = clinicSnap.data() || {}
    const recipientCandidates = new Set([clinic.ownerId, clinic.organizationOwnerId, ...branchUsers.docs.map((userSnap) => userSnap.id)].filter(Boolean))
    const recipientContexts = await Promise.all([...recipientCandidates].map(async (uid) => ({ uid, context: await loadUserContext(uid) })))
    // The CRM inbox is permission-protected, so message notifications must be
    // limited to the same people who can actually open that page.
    const recipients = new Set(recipientContexts
      .filter(({ context }) => context.permissions.has('inbox:view'))
      .map(({ uid }) => uid))
    const senderName = String(customer.fullName || customer.name || customer.displayName || customer.email || 'A customer').trim() || 'A customer'
    const batch = firestore.batch()
    recipients.forEach((recipientUserId) => batch.set(firestore.collection('notifications').doc(), {
      recipientUserId,
      branchId,
      title: 'New customer message',
      message: `${senderName}: ${message}`,
      link: '/crm/inbox',
      read: false,
      deleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }))
    if (recipients.size) await batch.commit()
    return res.json({ success: true, data: { recipients: recipients.size } })
  } catch (error) {
    console.error('Customer chat notification failed:', error?.message || error)
    return res.status(500).json({ success: false, error: 'Unable to notify the clinic.' })
  }
})

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

app.post('/auth/activate-account', async (req, res) => {
  const token = String(req.body?.token || '').trim()
  if (!token) return res.status(400).json({ success: false, error: 'Activation token is required.' })
  try {
    const firestore = admin.firestore()
    const tokenRef = firestore.collection('accountActivations').doc(activationTokenHash(token))
    const tokenSnap = await tokenRef.get()
    if (!tokenSnap.exists) return res.status(400).json({ success: false, error: 'This activation link is invalid or expired.' })
    const activation = tokenSnap.data() || {}
    const expiresAt = activation.expiresAt?.toDate?.() || new Date(activation.expiresAt || 0)
    if (activation.used === true || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'This activation link is invalid or expired.' })
    }
    const userRef = firestore.collection('users').doc(String(activation.uid || '').trim())
    const userSnap = await userRef.get()
    if (!userSnap.exists) return res.status(404).json({ success: false, error: 'Account not found.' })
    const userData = userSnap.data() || {}
    if (String(userData.activationTokenHash || '') !== tokenRef.id) return res.status(400).json({ success: false, error: 'This activation link is invalid or expired.' })
    const status = String(userData.status || '').trim().toLowerCase()
    if (['inactive', 'disabled', 'closed', 'deactivated', 'rejected'].includes(status) || userData.archived === true) {
      return res.status(409).json({ success: false, error: 'This account is no longer available.' })
    }
    const accountRoles = [userData.role, userData.userType].map(value => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ''))
    if (accountRoles.some(role => role.startsWith('supplier'))) {
      return res.status(410).json({ success: false, error: 'Supplier accounts are no longer supported. Suppliers are managed as clinic business contacts.' })
    }
    await firestore.runTransaction(async (transaction) => {
      const [freshToken, freshUser] = await Promise.all([transaction.get(tokenRef), transaction.get(userRef)])
      if (!freshToken.exists || freshToken.data()?.used === true || freshUser.data()?.activationTokenHash !== tokenRef.id) throw new Error('Activation link already used.')
      transaction.update(tokenRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() })
      transaction.set(userRef, { status: 'Active', accountActivated: true, accountActivatedAt: admin.firestore.FieldValue.serverTimestamp(), emailVerified: true }, { merge: true })
    })

    return res.json({ success: true, data: { uid: userRef.id } })
  } catch (error) {
    return res.status(400).json({ success: false, error: error?.message || 'Unable to activate account.' })
  }
})

app.post('/auth/resend-activation', async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) return res.status(400).json({ success: false, error: 'A valid email address is required.' })
  try {
    const firestore = admin.firestore()
    const snapshot = await firestore.collection('users').where('email', '==', normalizedEmail).limit(1).get()
    if (snapshot.empty) return res.json({ success: true, data: { sent: false } })
    const userSnap = snapshot.docs[0]
    const userData = userSnap.data() || {}
    const status = String(userData.status || '').trim().toLowerCase()
    if (status !== 'pending activation') {
      return res.json({ success: true, data: { sent: false, alreadyActive: status === 'active' || userData.accountActivated === true } })
    }
    const lastSentAt = userData.activationLastSentAt?.toDate?.()?.getTime?.() || Date.parse(userData.activationLastSentAt || '') || 0
    const retryAfterSeconds = Math.ceil((lastSentAt + 60 * 1000 - Date.now()) / 1000)
    if (retryAfterSeconds > 0) return res.status(429).json({ success: false, error: `Please wait ${retryAfterSeconds} seconds before requesting another activation email.`, retryAfterSeconds })
    await createAccountActivation({ firestore, uid: userSnap.id, email: normalizedEmail, name: userData.fullName || userData.firstName || 'User', req })
    return res.json({ success: true, data: { sent: true } })
  } catch (error) {
    if (error?.code === 'ACTIVATION_LIMIT') {
      return res.status(429).json({ success: false, error: error.message, retryAfterSeconds: error.retryAfterSeconds })
    }
    return res.status(500).json({ success: false, error: 'Unable to resend the activation email.' })
  }
})

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
  if (compact === 'clinicadmin' || compact === 'clinicadministrator') return 'Clinic Admin'
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  if (compact === 'hr') return 'HR'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const isSupplierAccount = (userData = {}) => [userData.role, userData.userType]
  .some((value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '').startsWith('supplier'))

const requiresOperationalLoginOtp = (userData = {}) => {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const accountKinds = new Set([
    'superadmin', 'systemadmin', 'sysadmin',
    'owner', 'clinicowner', 'clinicadmin', 'clinicadministrator',
    'staff', 'employee',
  ])
  // Customer accounts are intentionally excluded from login OTP.
  return accountKinds.has(normalize(userData.role)) || accountKinds.has(normalize(userData.userType))
}

// Built-in branch administrator permissions mirror the frontend permission
// store. Clinic owners receive the additional account and role controls below.
const CLINIC_ADMIN_PERMISSIONS = new Set([
  'branches:view', 'branches:create', 'clinic_profile:view', 'clinic_profile:update', 'roles:manage',
  'staff:view', 'staff:create', 'staff:update', 'staff:disable',
  'attendance:view', 'attendance:create', 'attendance:update', 'attendance:import',
  'clients:view', 'clients:update',
  'appointments:view', 'appointments:create', 'appointments:update', 'appointments:review', 'consultations:view', 'consultations:create',
  'payments:view', 'payments:create', 'inbox:view', 'reports:view',
  'services:view', 'services:create', 'services:update', 'services:disable', 'services:review',
  'inventory:view', 'inventory:create', 'inventory:update', 'inventory:disable', 'inventory:review',
  'suppliers:create', 'suppliers:update', 'orders:view', 'orders:update',
  'pharmacy:view', 'pharmacy:dispense', 'pharmacy:manage',
  'procurement:view', 'procurement:create', 'procurement:review',
  'procurement:requests:view', 'procurement:requests:manage', 'procurement:orders:view', 'procurement:orders:manage',
  'hr:view', 'hr:create', 'hr:update',
  'leave:create', 'leave:review', 'overtime:view', 'overtime:create', 'overtime:review',
  'payroll:view', 'payroll:update', 'payroll:approve',
  'finance:purchases:view', 'finance:payables:view', 'finance:payables:approve', 'finance:payables:settle',
  'finance:invoices:view', 'finance:invoices:manage', 'finance:invoices:settle',
  'finance:refunds:view', 'finance:refunds:manage', 'finance:sales:view', 'finance:reports:view',
  'policies:view', 'policies:update', 'activities:view', 'notifications:view',
  'profile:view', 'password:update', 'subscription:view', 'backups:view', 'backups:create', 'support:report',
  ...clinicRolePagePermissionKeys,
  ...clinicRolePermissionGrants,
])
const CLINIC_OWNER_ADDITIONAL_PERMISSIONS = new Set([
  'branches:view', 'branches:create', 'clinic_profile:update', 'roles:manage',
  'subscription:view', 'backups:view', 'backups:create',
])
const CLINIC_ROLE_PERMISSION_KEYS = new Set([
  ...CLINIC_ADMIN_PERMISSIONS,
  ...CLINIC_OWNER_ADDITIONAL_PERMISSIONS,
  ...clinicRolePagePermissionKeys,
])

const loadUserContext = async (uid) => {
  const firestore = admin.firestore()
  const userSnap = await firestore.collection('users').doc(uid).get()
  const userData = userSnap.exists ? userSnap.data() || {} : {}
  const rawRole = String(userData.role || '').trim()
  const rawUserType = String(userData.userType || '').trim()
  const compactRole = rawRole.toLowerCase().replace(/[\s_-]+/g, '')
  const compactUserType = rawUserType.toLowerCase().replace(/[\s_-]+/g, '')
  const isStaffAccount = compactUserType === 'staff' || compactUserType === 'employee'
  const legacyClinicAdmin = ['clinicadmin', 'clinicadministrator'].includes(compactRole)
  const ownerByType = !isStaffAccount && (compactUserType === 'owner' || compactRole === 'owner' || compactRole === 'clinicowner')
  const ownerByClinic = !isStaffAccount && legacyClinicAdmin
    ? (await firestore.collection('clinics').where('ownerId', '==', uid).limit(1).get()).size > 0
    : false
  const staffRoleKey = isStaffAccount
    ? (legacyClinicAdmin ? 'Clinic Admin' : 'Staff')
    : normalizeRoleKey(rawRole || rawUserType)
  const roleKey = (ownerByType || ownerByClinic) ? 'Owner' : staffRoleKey
  let rolePermissions = []
  if (roleKey && !isStaffAccount) {
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
  let staffOwnerId = String(userData.organizationOwnerId || '').trim()
  if (isStaffAccount && !staffOwnerId) {
    const branchId = String(userData.branchId || '').trim()
    if (branchId) {
      const branchSnap = await firestore.collection('clinics').doc(branchId).get()
      staffOwnerId = String(branchSnap.data()?.ownerId || '').trim()
    }
  }
  const customRolePermissions = []
  if (customRoleIds.length) {
    const customRoleSnaps = await Promise.all(
      customRoleIds.map((roleId) => firestore.collection('clinicRoles').doc(roleId).get())
    )
    customRoleSnaps.forEach((roleSnap) => {
      const roleData = roleSnap.exists ? roleSnap.data() || {} : {}
      if (isStaffAccount && (!staffOwnerId || String(roleData.ownerId || '').trim() !== staffOwnerId)) return
      if (Array.isArray(roleData.permissions)) {
        customRolePermissions.push(...expandClinicRolePermissions(roleData.permissions))
      }
    })
  }
  const userPermissions = [
    ...(Array.isArray(userData.permissions) ? userData.permissions : []),
    ...(isStaffAccount ? defaultClinicRolePermissions : []),
    // Staff role permissions are loaded from the current clinicRoles records
    // above. Their effectivePermissions field is a cache for Firestore rules,
    // and must never keep a revoked permission alive in backend authorization.
    ...(!isStaffAccount && Array.isArray(userData.effectivePermissions) ? userData.effectivePermissions : []),
  ]
  // Existing system administrators were created before system-admin RBAC was added.
  // Keep those legacy accounts functional until an explicit adminRole is assigned.
  if (roleKey === 'Superadmin' && !userData.adminRole && !userPermissions.length && !rolePermissions.length) {
    userPermissions.push('administrator:full_access')
  }
  // A Clinic Admin is an employee administrator, never an owner. Legacy
  // role records could contain the global full-access flag, so discard it;
  // branch checks remain mandatory in every workflow.
  // Clinic owners are the accountable administrators for their own branch.
  // Give them the same operational permissions as a Clinic Admin; supply
  // workflow endpoints still verify clinic ownership/branch access separately.
  const builtInClinicPermissions = roleKey === 'Owner'
    ? [...CLINIC_ADMIN_PERMISSIONS, ...CLINIC_OWNER_ADDITIONAL_PERMISSIONS]
    : roleKey === 'Clinic Admin'
      ? [...CLINIC_ADMIN_PERMISSIONS]
      : []
  const permissions = builtInClinicPermissions.length
    ? [...new Set([
      ...builtInClinicPermissions,
      ...userPermissions,
      ...rolePermissions,
      ...customRolePermissions,
    ])].filter((permission) => permission !== 'administrator:full_access')
    : [...userPermissions, ...rolePermissions, ...customRolePermissions]
        // Custom clinic roles may never elevate a staff member to platform-wide
        // administrator access. Superadmin accounts keep their explicit role.
        .filter((permission) => roleKey === 'Superadmin' || permission !== 'administrator:full_access')
  return {
    uid,
    roleKey,
    userData,
    permissions: new Set(permissions),
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

// Every assigned employee may clock themselves in or out. Administrative
// attendance permissions continue to govern reports, imports, and edits.
const requireAttendanceClockingAccess = async (req, res, next) => {
  const uid = req.user?.uid
  if (!uid) return res.status(401).json({ success: false, error: 'Unauthorized' })
  try {
    if (!req.userContext || req.userContext.uid !== uid) {
      req.userContext = await loadUserContext(uid)
    }
    const userType = String(req.userContext.userData?.userType || '').trim().toLowerCase()
    const isEmployee = userType === 'staff' || userType === 'employee'
    const permissions = req.userContext.permissions
    if (isEmployee || permissions.has('attendance:create') || permissions.has('administrator:full_access')) {
      return next()
    }
    return res.status(403).json({ success: false, error: 'Forbidden' })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to verify attendance access' })
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

const resolveBranchAccess = async (uid, branchId) => {
  const firestore = admin.firestore()
  const branchSnap = await firestore.collection('clinics').doc(branchId).get()
  if (!branchSnap.exists) return false
  const branch = branchSnap.data() || {}
  if (String(branch.ownerId || '') === uid) return true
  const userSnap = await firestore.collection('users').doc(uid).get()
  const user = userSnap.data() || {}
  const assignedBranches = new Set([user.branchId, ...(Array.isArray(user.branchIds) ? user.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))
  return assignedBranches.has(String(branchId || '').trim())
}

// Policies are configured once per clinic organization. A branch retains its
// own operational data (hours, staff and stock), but inherits this document.
// The legacy branch-keyed lookup is only a temporary fallback for clinics that
// have not opened and saved Policy Management since this migration.
const getClinicPoliciesForBranch = async (firestore, branchId, knownBranch = null) => {
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId) return { policy: {}, ownerId: '', branch: {} }
  let branch = knownBranch || null
  if (!branch) {
    const branchSnap = await firestore.collection('clinics').doc(normalizedBranchId).get()
    branch = branchSnap.exists ? branchSnap.data() || {} : {}
  }
  const ownerId = String(branch.ownerId || branch.organizationOwnerId || '').trim()
  const applyBranchLinks = (sourcePolicy) => {
    const policy = serviceOnlyClinicPolicies(sourcePolicy)
    // Undefined means a legacy branch that predates explicit linking: preserve
    // its existing behaviour by enforcing every enabled clinic policy.
    if (!Array.isArray(branch.enforcedPolicyKeys)) return policy
    const linked = new Set(branch.enforcedPolicyKeys.map((key) => String(key || '').trim()))
    const definitions = [
      ['paymentPolicy', ['paymentPolicyEnabled', 'servicePaymentPolicyEnabled']],
      ['cancellationPolicy', ['cancellationPolicyEnabled', 'serviceCancellationPolicyEnabled', 'refundPolicyEnabled']],
      ['reschedulePolicy', ['reschedulePolicyEnabled', 'serviceReschedulingPolicyEnabled']],
      ['noShowPolicy', ['noShowPolicyEnabled', 'serviceNoShowPolicyEnabled']],
    ]
    definitions.forEach(([key, enabledKeys]) => {
      if (!linked.has(key)) enabledKeys.forEach((enabledKey) => { policy[enabledKey] = false })
    })
    return policy
  }
  if (ownerId) {
    const clinicPolicySnap = await firestore.collection('clinicPolicies').doc(ownerId).get()
    if (clinicPolicySnap.exists) return { policy: applyBranchLinks(clinicPolicySnap.data()), ownerId, branch }
  }
  const legacySnap = await firestore.collection('clinicPolicies').doc(normalizedBranchId).get()
  return { policy: legacySnap.exists ? applyBranchLinks(legacySnap.data()) : {}, ownerId, branch }
}

const cancellationTermsSnapshot = (policy, appointment) => {
  const estimate = cancellationRefundEstimate({ policy, appointment })
  return {
    version: 1,
    cancellationPolicy: String(policy.cancellationPolicy || '').trim(),
    tier: estimate.tier,
    hoursUntil: estimate.hoursUntil,
    refundPercentage: estimate.refundPercentage,
    eligibleAmount: estimate.eligibleAmount,
    commissionAmount: estimate.commissionAmount,
    refundAmount: estimate.refundAmount,
    earlyMinimumHours: Number(policy.earlyMinimumHours ?? 48),
    earlyNonRefundable: policy.earlyNonRefundable === true,
    earlyRefundPercentage: Number(policy.earlyRefundPercentage ?? 100),
    midMinimumHours: Number(policy.midMinimumHours ?? 24),
    midMaximumHours: Number(policy.midMaximumHours ?? 48),
    midNonRefundable: policy.midNonRefundable === true,
    midRefundPercentage: Number(policy.midRefundPercentage ?? 50),
    lateMaximumHours: Number(policy.lateMaximumHours ?? 24),
    lateNonRefundable: policy.lateNonRefundable === true,
    lateRefundPercentage: Number(policy.lateRefundPercentage ?? 0),
  }
}

const getApprovedLeaveForDate = async (employeeId, dateKey) => {
  const normalizedEmployeeId = String(employeeId || '').trim()
  const normalizedDate = String(dateKey || '').trim()
  if (!normalizedEmployeeId || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) return null

  const leaveSnap = await admin.firestore()
    .collection('leaveRequests')
    .where('requesterId', '==', normalizedEmployeeId)
    .get()

  return leaveSnap.docs
    .map((snap) => ({ id: snap.id, ...(snap.data() || {}) }))
    .find((request) => {
      const status = String(request.status || '').trim().toLowerCase()
      const startDate = String(request.startDate || '').trim()
      const endDate = String(request.endDate || '').trim()
      return status === 'approved' && startDate && endDate && startDate <= normalizedDate && normalizedDate <= endDate
    }) || null
}

const loadAttendanceSchedule = async (employeeId, dateKey) => {
  const firestore = admin.firestore()
  const approvedLeave = await getApprovedLeaveForDate(employeeId, dateKey)
  if (approvedLeave) {
    return {
      onLeave: true,
      leaveId: approvedLeave.id,
      leaveType: String(approvedLeave.leaveType || 'Approved leave').trim(),
      shiftLabel: 'Approved leave',
      shiftStart: '',
      shiftEnd: '',
      unpaidMealBreakMinutes: null,
    }
  }

  const scheduleSnap = await firestore.collection('users').doc(employeeId).collection('schedules').doc('recurring').get()
  const scheduleData = scheduleSnap.exists ? scheduleSnap.data() || {} : {}
  const effectiveSchedule = resolveRecurringScheduleVersion(scheduleData, dateKey)
  const assignments = effectiveSchedule?.assignments || {}
  const assignmentLabels = effectiveSchedule?.assignmentLabels || {}
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long' }).format(new Date(`${dateKey}T12:00:00+08:00`))
  const assignmentValue = String(assignments[weekday] || '').trim()
  const shiftLabel = String(assignmentLabels[weekday] || assignmentValue).trim()
  if (!assignmentValue || assignmentValue.toLowerCase() === 'off' || shiftLabel.toLowerCase() === 'off') {
    return { shiftLabel, shiftStart: '', shiftEnd: '', unpaidMealBreakMinutes: null }
  }
  const employeeData = (await firestore.collection('users').doc(employeeId).get()).data() || {}
  const shiftSnap = await firestore.collection('shifts').where('branchId', '==', employeeData.branchId || '').get()
  const shift = shiftSnap.docs.map((snap) => ({ id: snap.id, ...(snap.data() || {}) })).find((entry) => {
    const label = `${String(entry.shiftType || 'Shift').trim()} || ${String(entry.start || '').trim()} - ${String(entry.end || '').trim()}`
    return entry.id === assignmentValue || label === shiftLabel || label === assignmentValue
  }) || {}
  const historicalTimes = shiftLabel.match(/\|\|\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/)
  const useHistoricalSnapshot = effectiveSchedule?.historical === true && historicalTimes
  return {
    shiftLabel: useHistoricalSnapshot ? shiftLabel : shift.id ? `${String(shift.shiftType || 'Shift').trim()} || ${String(shift.start || '').trim()} - ${String(shift.end || '').trim()}` : shiftLabel,
    shiftStart: String(useHistoricalSnapshot ? historicalTimes[1] : shift.start || '').trim(),
    shiftEnd: String(useHistoricalSnapshot ? historicalTimes[2] : shift.end || '').trim(),
    unpaidMealBreakMinutes: Number.isFinite(Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes))
      && Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes) >= 0
      ? Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes)
      : null
  }
}

const getRegistrationComparisonMatch = (comparisons, field) => {
  const comparison = comparisons.find((item) => item.field === field)
  if (!comparison) return null
  if (comparison.status === 'match') return true
  if (comparison.status === 'mismatch') return false
  return null
}

const getRegistrationComparisonNameMatch = (comparisons) => {
  const nameComparisons = comparisons.filter((item) => item.field !== 'birthDate')
  if (!nameComparisons.length) return null
  if (nameComparisons.some((item) => item.status === 'mismatch')) return false
  return nameComparisons.every((item) => item.status === 'match') ? true : null
}

const REGISTRATION_OCR_SCORE_WEIGHTS = Object.freeze({
  ocrQuality: 0.35,
  readability: 0.15,
  identityMatch: 0.10,
  documentNumberMatch: 0.35,
  expiryValidity: 0.05,
})

const calculateRegistrationOcrScore = ({
  ocrConfidence,
  readableText,
  hasSomeText,
  nameMatch,
  hasNameComparison,
  requiresDocumentNumber,
  documentNumberDetected,
  requiresExpiry,
  expiryValid,
}) => {
  const ocrQuality = ocrConfidence ?? (readableText ? 0.75 : hasSomeText ? 0.4 : 0)
  const componentValues = {
    ocrQuality,
    readability: readableText ? 1 : hasSomeText ? 0.5 : 0,
    identityMatch: hasNameComparison ? (nameMatch === true ? 1 : 0) : null,
    documentNumberMatch: requiresDocumentNumber ? (documentNumberDetected ? 1 : 0) : null,
    expiryValidity: requiresExpiry ? (expiryValid === true ? 1 : 0) : null,
  }
  const applicableWeight = Object.entries(componentValues).reduce((total, [key, value]) =>
    total + (value === null ? 0 : REGISTRATION_OCR_SCORE_WEIGHTS[key]), 0)
  const weightedScore = Object.entries(componentValues).reduce((total, [key, value]) =>
    total + (value === null ? 0 : REGISTRATION_OCR_SCORE_WEIGHTS[key] * value), 0)
  const percentage = (value) => value === null ? null : Math.round(value * 100)
  const score = applicableWeight > 0 ? weightedScore / applicableWeight : 0
  const weights = Object.fromEntries(Object.entries(componentValues).map(([key, value]) => [
    key,
    value === null ? null : Math.round((REGISTRATION_OCR_SCORE_WEIGHTS[key] / applicableWeight) * 100),
  ]))
  return {
    score,
    breakdown: {
      ocrQuality: percentage(componentValues.ocrQuality),
      readability: percentage(componentValues.readability),
      identityMatch: percentage(componentValues.identityMatch),
      documentNumberMatch: percentage(componentValues.documentNumberMatch),
      expiryValidity: percentage(componentValues.expiryValidity),
      applicableWeight: Math.round(applicableWeight * 100),
      weights,
    },
  }
}

const getRegistrationDocumentOcr = async ({ visionClient, bucketName, storagePath, contentType, bytes, uid, docKey }) => {
  if (String(contentType || '').toLowerCase() !== 'application/pdf') {
    const [response] = await visionClient.documentTextDetection({ image: { content: bytes.toString('base64') } })
    const responseError = getVisionResponseError(response)
    if (responseError) throw new Error(responseError)
    let annotation = response?.fullTextAnnotation || null
    let extractedText = String(annotation?.text || '').trim()
    if (!extractedText) {
      const [fallback] = await visionClient.textDetection({ image: { content: bytes.toString('base64') } })
      const fallbackError = getVisionResponseError(fallback)
      if (fallbackError) throw new Error(fallbackError)
      extractedText = String(fallback?.textAnnotations?.[0]?.description || '').trim()
      annotation = fallback?.fullTextAnnotation || annotation
    }
    return { annotation, extractedText }
  }

  const outputPrefix = `clinic-registration/${uid}/ocr-output/${docKey}/${crypto.randomUUID()}/`
  const outputUri = `gs://${bucketName}/${outputPrefix}`
  try {
    const [operation] = await visionClient.asyncBatchAnnotateFiles({
      requests: [{
        inputConfig: {
          gcsSource: { uri: `gs://${bucketName}/${storagePath}` },
          mimeType: 'application/pdf',
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        outputConfig: { gcsDestination: { uri: outputUri }, batchSize: 5 },
      }],
    })
    const [operationResponse] = await operation.promise()
    const fileError = operationResponse?.responses?.find((item) => item?.error?.message)
    if (fileError) throw new Error(fileError.error.message)

    const [outputFiles] = await admin.storage().bucket(bucketName).getFiles({ prefix: outputPrefix })
    if (!outputFiles.length) throw new Error('Vision did not return OCR output for this PDF.')
    const pageResponses = []
    for (const outputFile of outputFiles) {
      const [outputBytes] = await outputFile.download()
      const output = JSON.parse(outputBytes.toString('utf8'))
      for (const response of output?.responses || []) {
        if (response?.error?.message) throw new Error(response.error.message)
        pageResponses.push(response)
      }
    }
    const extractedText = pageResponses
      .map((response) => String(response?.fullTextAnnotation?.text || response?.textAnnotations?.[0]?.description || '').trim())
      .filter(Boolean)
      .join('\n')
    const annotation = {
      pages: pageResponses.flatMap((response) => response?.fullTextAnnotation?.pages || []),
      text: extractedText,
    }
    return { annotation, extractedText }
  } finally {
    const [outputFiles] = await admin.storage().bucket(bucketName).getFiles({ prefix: outputPrefix }).catch(() => [[]])
    await Promise.all(outputFiles.map((file) => file.delete({ ignoreNotFound: true }).catch(() => {})))
  }
}

const processUploadedRegistrationDocument = async ({ uid, docKey, document, application, user }) => {
  const storagePath = String(document?.path || document?.storagePath || '').trim()
  const result = {
    status: 'rejected',
    confidence: 0,
    ocrConfidence: null,
    storagePath,
    detectedDocumentNumber: '',
    detectedDates: [],
    checks: { readableText: false, ocrConfidence: null, nameMatch: null, birthDateMatch: null, documentNumberDetected: null, expiryValid: null },
    processedAt: new Date().toISOString(),
    processingError: '',
    reason: '',
  }
  const expectedPrefix = `clinic-registration/${uid}/${docKey}/`
  if (!storagePath || !storagePath.startsWith(expectedPrefix)) {
    result.reason = 'Document storage path is missing or does not belong to this registration.'
    return result
  }
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(String(document?.type || '').toLowerCase())) {
    result.reason = 'Unsupported document type. Upload a PDF, PNG, or JPEG file.'
    return result
  }
  if (Number(document?.size || 0) <= 0 || Number(document.size) > 10 * 1024 * 1024) {
    result.reason = 'Document size is invalid.'
    return result
  }
  const visionClient = createVisionClient()
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  if (!visionClient || !bucketName) {
    result.status = 'manual_review'
    result.reason = 'Automatic document processing is unavailable. This document requires manual review.'
    return result
  }
  try {
    const [bytes] = await admin.storage().bucket(bucketName).file(storagePath).download()
    const { annotation, extractedText } = await getRegistrationDocumentOcr({
      visionClient, bucketName, storagePath, contentType: document.type, bytes, uid, docKey,
    })
    const requiresBusinessName = BUSINESS_NAME_REQUIREMENTS.has(docKey)
    const isAuthorizationDocument = docKey === AUTHORIZATION_DOCUMENT_KEY
    const minimumTextLength = getRegistrationDocumentMinimumTextLength(docKey)
    const readableText = extractedText.length >= minimumTextLength
    const hasSomeText = extractedText.length > 0
    const ocrConfidence = getVisionWordConfidence(annotation)
    const comparisons = compareRegistrationFields({ docKey, text: extractedText, application, user, confidence: ocrConfidence })
    const ownerNameMatch = getRegistrationComparisonMatch(comparisons, 'registrantName')
    const permitHolderNameMatch = getRegistrationComparisonMatch(comparisons, 'permitHolderName')
    const businessNameMatch = getRegistrationComparisonMatch(comparisons, 'businessName')
    const nameMatch = getRegistrationComparisonNameMatch(comparisons)
    const detectedDates = extractOcrDates(extractedText)
    const birthDateMatch = getRegistrationComparisonMatch(comparisons, 'birthDate')
    const expectedBirthDate = getRegistrationBirthDateForOcr(application, user)
    const detectedDocumentNumber = extractOcrDocumentNumber(extractedText)
    const requiresNumber = DOCUMENT_NUMBER_REQUIREMENTS.has(docKey)
    const requiresExpiry = EXPIRY_DATE_REQUIREMENTS.has(docKey)
    const expiryValidation = getOcrExpiryValidation(extractedText, requiresExpiry)
    const expiryDate = expiryValidation.validTo
    const expiryValid = expiryValidation.valid
    const score = calculateRegistrationOcrScore({
      ocrConfidence,
      readableText,
      hasSomeText,
      nameMatch,
      hasNameComparison: comparisons.some((item) => item.field !== 'birthDate'),
      requiresDocumentNumber: requiresNumber,
      documentNumberDetected: Boolean(detectedDocumentNumber),
      requiresExpiry,
      expiryValid,
    })
    result.confidence = score.score
    result.scoreBreakdown = score.breakdown
    result.ocrConfidence = ocrConfidence
    result.detectedDocumentNumber = detectedDocumentNumber
    result.detectedDates = detectedDates
    result.checks = {
      readableText, ocrConfidence, nameMatch, ownerNameMatch, permitHolderNameMatch, businessNameMatch, birthDateMatch, expectedBirthDate,
      nameCheckType: isAuthorizationDocument ? 'authorization_parties' : requiresBusinessName ? 'clinic_business_name' : 'registrant_name',
      documentNumberDetected: requiresNumber ? Boolean(detectedDocumentNumber) : null,
      expiryValid,
      expiryDate,
      expiryValidationType: expiryValidation.type,
      expiryDaysRemaining: requiresExpiry ? expiryValidation.daysRemaining : null,
      expiryAccountHold: requiresExpiry ? expiryValidation.accountHold : false,
      expiryWarning: requiresExpiry && expiryValidation.daysRemaining > REGISTRATION_EXPIRY_HOLD_DAYS
        && expiryValidation.daysRemaining <= REGISTRATION_EXPIRY_WARNING_DAYS,
    }
    // Document-level OCR verification requires all labeled comparisons to
    // match. The clinic still requires a separate administrator decision.
    const automaticChecksPassed = comparisons.every((item) => item.status === 'match')
      && (!requiresExpiry || expiryValid === true)
    const expiredDocument = requiresExpiry && expiryValidation.expired
    const invalidValidityRange = requiresExpiry && expiryValidation.invalidRange
    const expiryAccountHold = requiresExpiry && expiryValidation.accountHold
    result.comparisons = comparisons
    result.status = expiredDocument || invalidValidityRange
      ? 'rejected'
      : expiryAccountHold ? 'held_pending'
      : isAuthorizationDocument ? 'manual_review'
      : readableText && score.score >= AUTO_VERIFICATION_THRESHOLD && automaticChecksPassed ? 'verified' : 'manual_review'
    result.reason = !readableText
      ? 'OCR could not read enough text to compare the document. An administrator must inspect the original file.'
      : expiredDocument
        ? `This document expired on ${expiryDate}. Please upload a current document.`
      : invalidValidityRange
        ? 'The document has an invalid validity range: its end date is earlier than its start date. Please upload a correct, current document.'
      : expiryAccountHold
        ? `This document expires in ${expiryValidation.daysRemaining} day${expiryValidation.daysRemaining === 1 ? '' : 's'}. Your registration requires a replacement document before it can be reviewed.`
      : isAuthorizationDocument
        ? 'OCR checked the registrant and permit-holder names. An administrator must review the authority granted before approval.'
      : comparisons.some((item) => item.status === 'mismatch')
        ? 'OCR found a possible mismatch. Compare the values with the original document before making a decision.'
        : comparisons.some((item) => item.status === 'needs_review')
          ? 'OCR could not confidently compare every entered value. Inspect the original document before making a decision.'
          : requiresExpiry && expiryValid !== true
            ? 'OCR completed, but a labelled validity period or expiry date could not be confirmed. This document requires manual review.'
        : result.status === 'verified'
          ? 'OCR extracted readable text and passed automatic checks.'
          : 'OCR completed, but this document requires manual review.'
  } catch (error) {
    const processingError = String(error?.message || error || 'Unknown OCR processing error.')
    console.warn('Registration document OCR could not be completed:', {
      uid,
      docKey,
      storagePath,
      error: processingError,
    })
    result.status = 'manual_review'
    // Diagnostic only: shown in the registrant's browser console so an
    // integration failure can be distinguished from an unreadable document.
    result.processingError = processingError
    result.reason = 'We could not process this document automatically. It has been sent for manual review.'
  }
  return result
}

const runRegistrationDocumentVerification = async ({ uid, applicantType, processedBy, runId }) => {
  if (String(applicantType || '').trim().toLowerCase() !== 'clinic') {
    throw new Error('Only clinic registration verification is supported.')
  }
  const firestore = admin.firestore()
  const normalizedType = 'clinic'
  const collectionName = 'clinics'
  const applicationRef = firestore.collection(collectionName).doc(uid)
  const userRef = firestore.collection('users').doc(uid)
  const [applicationSnap, userSnap] = await Promise.all([applicationRef.get(), userRef.get()])
  if (!applicationSnap.exists) throw new Error('Registration application not found.')

  const application = applicationSnap.data() || {}
  const user = userSnap.exists ? userSnap.data() || {} : {}
  const documents = application.submittedDocuments || {}
  const requiredKeys = getRegistrationDocumentRequirements(normalizedType, application)
  const expectedRunId = String(runId || '').trim()
  if (!expectedRunId) throw new Error('A clinic verification job ID is required.')
  await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(applicationRef)
    if (!currentSnapshot.exists) throw new Error('Registration application not found.')
    const currentApplication = currentSnapshot.data() || {}
    const job = currentApplication.verificationJob || {}
    if (job.runId !== expectedRunId || job.status !== 'queued') {
      throw Object.assign(new Error('This clinic verification job is no longer queued.'), {
        statusCode: 409,
        jobAlreadyClaimed: job.runId === expectedRunId && job.status === 'processing',
      })
    }
    const approvalStatus = String(currentApplication.approvalStatus || '').trim().toLowerCase()
    if (approvalStatus.includes('approved') || approvalStatus.includes('rejected')
      || (approvalStatus.includes('pending documents') && currentApplication.resubmissionRequired === true)) {
      throw Object.assign(new Error('This clinic registration is no longer available for OCR review.'), { statusCode: 409 })
    }
    const ocrSnapshot = currentApplication.registrationOcrSnapshot || {
      firstName: String(currentApplication.firstName || user.firstName || '').trim(),
      middleName: String(currentApplication.midName || currentApplication.middleName || user.midName || user.middleName || '').trim(),
      lastName: String(currentApplication.lastName || user.lastName || '').trim(),
      suffix: String(currentApplication.suffix || user.suffix || '').trim(),
      birthDate: currentApplication.birthDate || user.birthDate || null,
      businessName: String(currentApplication.businessName || currentApplication.clinicName || currentApplication.companyName || user.companyName || '').trim(),
      permitHolderIsRegistrant: currentApplication.permitHolderIsRegistrant !== false,
      permitHolderName: String(currentApplication.permitHolderName || '').trim(),
      permitHolderRelationship: String(currentApplication.permitHolderRelationship || '').trim(),
      source: 'legacy-review-time',
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (!currentApplication.registrationOcrSnapshot) {
      application.registrationOcrSnapshot = ocrSnapshot
    }
    transaction.set(applicationRef, {
      verificationStatus: 'Processing OCR',
      ...(!currentApplication.registrationOcrSnapshot ? { registrationOcrSnapshot: ocrSnapshot } : {}),
      verificationJob: {
        ...job,
        status: 'processing',
        processedDocuments: 0,
        totalDocuments: requiredKeys.length,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + CLINIC_VERIFICATION_JOB_LEASE_MS),
      },
    }, { merge: true })
  })
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  const storageBucket = bucketName ? admin.storage().bucket(bucketName) : null
  const visionClient = createVisionClient()
  const results = {}
  const persistDocumentProgress = async () => {
    const processedDocuments = Object.keys(results).length
    await firestore.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(applicationRef)
      if (!currentSnapshot.exists) throw Object.assign(new Error('Clinic registration was removed during OCR.'), { statusCode: 409 })
      const currentApplication = currentSnapshot.data() || {}
      const job = currentApplication.verificationJob || {}
      if (job.runId !== expectedRunId || job.status !== 'processing') {
        throw Object.assign(new Error('This clinic verification job was superseded.'), { statusCode: 409 })
      }
      const approvalStatus = String(currentApplication.approvalStatus || '').trim().toLowerCase()
      if (approvalStatus.includes('approved') || approvalStatus.includes('rejected')
        || (approvalStatus.includes('pending documents') && currentApplication.resubmissionRequired === true)) {
        throw Object.assign(new Error('A reviewer changed the registration while OCR was running.'), { statusCode: 409 })
      }
      transaction.set(applicationRef, {
        verificationResults: results,
        verificationJob: {
          ...job,
          processedDocuments,
          totalDocuments: requiredKeys.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          leaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + CLINIC_VERIFICATION_JOB_LEASE_MS),
        },
      }, { merge: true })
    })
  }

  for (const docKey of requiredKeys) {
    const document = documents?.[docKey] || {}
    const expectedPrefix = `clinic-registration/${uid}/${docKey}/`
    const storagePath = String(document.path || document.storagePath || '').trim()
    const result = {
      status: 'manual_review',
      confidence: 0,
      ocrConfidence: null,
      storagePath,
      reason: '',
      numberMatch: null,
      detectedDocumentNumber: '',
      checks: {
        readableText: false,
        ocrConfidence: null,
        nameMatch: false,
        birthDateMatch: null,
        numberMatch: null,
        expiryValid: null,
      },
      scoreBreakdown: null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (!storagePath || !storagePath.startsWith(expectedPrefix)) {
      result.reason = 'Document storage path is missing or does not belong to this application.'
      results[docKey] = result
      await persistDocumentProgress()
      continue
    }
    const documentContentType = String(document.type || '').toLowerCase()
    const supportedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!documentContentType || !supportedDocumentTypes.includes(documentContentType)) {
      result.reason = 'Unsupported document type.'
      results[docKey] = result
      await persistDocumentProgress()
      continue
    }
    if (Number(document.size || 0) <= 0 || Number(document.size || 0) > 10 * 1024 * 1024) {
      result.reason = 'Document size is invalid.'
      results[docKey] = result
      await persistDocumentProgress()
      continue
    }

    try {
      const preflightSnap = await applicationRef.collection('documentPreflights').doc(docKey).get()
      const preflight = preflightSnap.exists ? preflightSnap.data() || {} : {}
      const preflightExpiresAt = getTimestampDate(preflight.expiresAt)
      const hasCurrentDocumentPolicy = Number(preflight.policyVersion || preflight.quality?.policyVersion || 0)
        === REGISTRATION_DOCUMENT_REVIEW_POLICY_VERSION
      const hasReusablePreflight = preflight.accepted === true
        && hasCurrentDocumentPolicy
        && preflight.storagePath === storagePath
        && Boolean(preflightExpiresAt && preflightExpiresAt.getTime() > Date.now())
        && String(preflight.extractedText || '').trim().length >= getRegistrationDocumentMinimumTextLength(docKey)
      let annotation = null
      let extractedText = hasReusablePreflight ? String(preflight.extractedText || '').trim() : ''
      if (!hasReusablePreflight) {
        if (!visionClient || !storageBucket || !bucketName) {
          result.reason = !storageBucket || !bucketName
            ? 'Secure document storage is not configured. Inspect this document manually.'
            : 'Automatic document processor is not configured. Inspect this document manually.'
          results[docKey] = result
          await persistDocumentProgress()
          continue
        }
        const [bytes] = await storageBucket.file(storagePath).download()
        const ocr = await getRegistrationDocumentOcr({
          visionClient, bucketName, storagePath, contentType: document.type, bytes, uid, docKey,
        })
        annotation = ocr.annotation
        extractedText = ocr.extractedText
      }
      const requiresBusinessName = BUSINESS_NAME_REQUIREMENTS.has(docKey)
      const isAuthorizationDocument = docKey === AUTHORIZATION_DOCUMENT_KEY
      const minimumTextLength = getRegistrationDocumentMinimumTextLength(docKey)
      const hasReadableText = extractedText.length >= minimumTextLength
      const hasSomeText = extractedText.length > 0
      const preflightOcrConfidence = Number(preflight.ocrConfidence)
      const ocrConfidence = hasReusablePreflight
        ? Number.isFinite(preflightOcrConfidence) ? preflightOcrConfidence : null
        : getVisionWordConfidence(annotation)
      const comparisons = compareRegistrationFields({ docKey, text: extractedText, application, user, confidence: ocrConfidence })
      const ownerNameMatch = getRegistrationComparisonMatch(comparisons, 'registrantName')
      const permitHolderNameMatch = getRegistrationComparisonMatch(comparisons, 'permitHolderName')
      const businessNameMatch = getRegistrationComparisonMatch(comparisons, 'businessName')
      const nameMatch = getRegistrationComparisonNameMatch(comparisons)
      const expiryApplicable = EXPIRY_DATE_REQUIREMENTS.has(docKey)
      const expectedBirthDate = getRegistrationBirthDateForOcr(application, user)
      const birthDateMatch = getRegistrationComparisonMatch(comparisons, 'birthDate')
      const expiryValidation = getOcrExpiryValidation(extractedText, expiryApplicable)
      const expiryValid = expiryValidation.valid
      const requiresDocumentNumber = DOCUMENT_NUMBER_REQUIREMENTS.has(docKey)
      const detectedDocumentNumber = extractOcrDocumentNumber(extractedText)
      const documentNumberDetected = requiresDocumentNumber ? Boolean(detectedDocumentNumber) : null
      // Registration does not ask applicants to type document numbers. OCR
      // therefore verifies that a number is readable; it does not falsely
      // report a mismatch against a non-existent applicant-entered value.
      const numberMatch = null
      const score = calculateRegistrationOcrScore({
        ocrConfidence,
        readableText: hasReadableText,
        hasSomeText,
        nameMatch,
        hasNameComparison: comparisons.some((item) => item.field !== 'birthDate'),
        requiresDocumentNumber,
        documentNumberDetected,
        requiresExpiry: expiryApplicable,
        expiryValid,
      })
      result.numberMatch = numberMatch
      result.detectedDocumentNumber = docKey === 'governmentIdRepresentativeFront'
        ? ''
        : detectedDocumentNumber
      result.ocrConfidence = ocrConfidence
      result.comparisons = comparisons
      result.checks = {
        readableText: hasReadableText,
        ocrConfidence,
        nameMatch,
        ownerNameMatch,
        permitHolderNameMatch,
        businessNameMatch,
        birthDateMatch,
        expectedBirthDate,
        nameCheckType: isAuthorizationDocument ? 'authorization_parties' : requiresBusinessName ? 'clinic_business_name' : 'registrant_name',
        numberMatch,
        documentNumberDetected,
        expiryValid: expiryApplicable ? expiryValid : null,
        expiryDate: expiryValidation.validTo,
        expiryValidationType: expiryValidation.type,
        expiryDaysRemaining: expiryApplicable ? expiryValidation.daysRemaining : null,
        expiryAccountHold: expiryApplicable ? expiryValidation.accountHold : false,
      }
      result.scoreBreakdown = score.breakdown
      result.confidence = score.score
      const automaticChecksPassed = comparisons.every((item) => item.status === 'match')
        && (!expiryApplicable || expiryValid)
      const expiredDocument = expiryApplicable && expiryValidation.expired
      const invalidValidityRange = expiryApplicable && expiryValidation.invalidRange
      const expiryAccountHold = expiryApplicable && expiryValidation.accountHold
      result.status = expiredDocument || invalidValidityRange
        ? 'rejected'
        : expiryAccountHold ? 'held_pending'
        : isAuthorizationDocument ? 'manual_review'
        : hasReadableText && score.score >= AUTO_VERIFICATION_THRESHOLD && automaticChecksPassed ? 'verified' : 'manual_review'
      if (!hasSomeText) {
        result.reason = 'OCR returned no readable text. Check that the file is clear, not corrupted, and contains a readable image or text-based PDF.'
      } else if (expiredDocument) {
        result.reason = `This document expired on ${expiryValidation.validTo}. Please upload a current document.`
      } else if (invalidValidityRange) {
        result.reason = 'The document has an invalid validity range: its end date is earlier than its start date. Please upload a correct, current document.'
      } else if (expiryAccountHold) {
        result.reason = `This document expires in ${expiryValidation.daysRemaining} day${expiryValidation.daysRemaining === 1 ? '' : 's'}. Your registration requires a replacement document before it can be reviewed.`
      } else if (isAuthorizationDocument) {
        result.reason = 'OCR checked the registrant and permit-holder names. An administrator must review the authority granted before approval.'
      } else if (comparisons.some((item) => item.status === 'mismatch')) {
        result.reason = 'OCR found a possible mismatch. Compare the values with the original document before making a decision.'
      } else if (comparisons.some((item) => item.status === 'needs_review')) {
        result.reason = 'OCR could not confidently compare every entered value. Inspect the original document before making a decision.'
      } else if (expiryApplicable && expiryValid !== true) {
        result.reason = 'A labelled validity period or expiry date could not be confirmed. This document requires manual review.'
      } else if (requiresDocumentNumber && !documentNumberDetected) {
        result.reason = 'A document number could not be read clearly. This document requires manual review.'
      } else if (expiryApplicable && expiryValid === false) {
        result.reason = 'The document expiry date is invalid or expired.'
      } else {
        result.reason = result.status === 'verified'
          ? 'OCR, identity, document number, and validity checks passed.'
          : 'The document needs manual review because its weighted score is below the automatic verification threshold.'
      }
    } catch (error) {
      result.reason = error?.message || 'Automatic document processing failed.'
    }
    results[docKey] = result
    await persistDocumentProgress()
  }

  const allRequiredDocumentsPresent = requiredKeys.every((key) => Boolean(documents?.[key]?.path || documents?.[key]?.storagePath))
  const allVerified = allRequiredDocumentsPresent && requiredKeys.every((key) => results[key]?.status === 'verified')
  const hasRejectedDocument = requiredKeys.some((key) => results[key]?.status === 'rejected')
  const rejectedDocumentKeys = requiredKeys.filter((key) => results[key]?.status === 'rejected')
  const expiryHoldDocuments = requiredKeys.filter((key) => results[key]?.checks?.expiryAccountHold)
  const hasExpiryHold = expiryHoldDocuments.length > 0
  const expiryWarningDocuments = requiredKeys.filter((key) => results[key]?.checks?.expiryWarning)
  const hasExpiryWarning = expiryWarningDocuments.length > 0
  const requiresExpiryResubmission = hasExpiryHold && !hasRejectedDocument
  const requiresDocumentResubmission = hasRejectedDocument || hasExpiryHold
  const resubmissionDocumentKeys = [...new Set([...rejectedDocumentKeys, ...expiryHoldDocuments])]
  const existingExpiryDeadline = typeof application.expiryResubmissionExpiresAt?.toDate === 'function'
    ? application.expiryResubmissionExpiresAt.toDate()
    : application.expiryResubmissionExpiresAt ? new Date(application.expiryResubmissionExpiresAt) : null
  const canKeepExistingExpiryDeadline = existingExpiryDeadline && !Number.isNaN(existingExpiryDeadline.getTime()) && existingExpiryDeadline.getTime() > Date.now()
  const expiryResubmissionExpiresAt = requiresExpiryResubmission
    ? (canKeepExistingExpiryDeadline
      ? admin.firestore.Timestamp.fromDate(existingExpiryDeadline)
      : admin.firestore.Timestamp.fromMillis(Date.now() + REGISTRATION_EXPIRY_RESUBMISSION_DAYS * DAY_MS))
    : null
  const shouldSendExpiryHoldEmail = requiresExpiryResubmission && !canKeepExistingExpiryDeadline
  const verificationStatus = hasExpiryHold ? 'Pending - Expiry Hold' : allVerified ? 'OCR Verified' : hasRejectedDocument ? 'Resubmission Required' : 'Manual Review Required'
  const approvalStatus = requiresDocumentResubmission ? 'Pending Documents' : 'Pending Approval'
  const verificationPayload = {
    verificationStatus,
    verificationResults: results,
    verificationThreshold: AUTO_VERIFICATION_THRESHOLD,
    verificationProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
    verificationProcessedBy: processedBy || 'automatic_processor',
    expiryAccountHold: hasExpiryHold,
    expiryWarningDocuments,
    expiryHoldDocuments,
    expiryHoldPolicy: hasExpiryHold ? `Document expires within ${REGISTRATION_EXPIRY_HOLD_DAYS} calendar days.` : admin.firestore.FieldValue.delete(),
    expiryResubmissionExpiresAt: expiryResubmissionExpiresAt || admin.firestore.FieldValue.delete(),
    expiryResubmissionRequestedAt: requiresExpiryResubmission
      ? (canKeepExistingExpiryDeadline && application.expiryResubmissionRequestedAt
        ? application.expiryResubmissionRequestedAt
        : admin.firestore.FieldValue.serverTimestamp())
      : admin.firestore.FieldValue.delete(),
    // OCR verifies document quality and consistency; it never grants account access.
    approvalStatus,
    registrationStatus: requiresDocumentResubmission
      ? CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED
      : CLINIC_REGISTRATION_STATUS.PENDING_REVIEW,
    resubmissionRequired: requiresDocumentResubmission,
    resubmissionReason: requiresDocumentResubmission
      ? `Replace ${resubmissionDocumentKeys.map(registrationDocumentLabel).join(', ')}${requiresExpiryResubmission ? ` before the expiry review deadline (${REGISTRATION_EXPIRY_RESUBMISSION_DAYS} days).` : ' with a clearer or corrected copy.'}`
      : admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  const historyRef = applicationRef.collection('verificationHistory').doc()
  const notificationRef = firestore.collection('notifications').doc(`${normalizedType}-registration-${uid}`)
  const verificationJob = {
    runId: expectedRunId,
    status: 'completed',
    processedDocuments: requiredKeys.length,
    totalDocuments: requiredKeys.length,
    processedBy: processedBy || 'automatic_processor',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    leaseExpiresAt: admin.firestore.FieldValue.delete(),
    error: admin.firestore.FieldValue.delete(),
  }
  const historyEntry = {
    action: allVerified ? 'ocr-verified-pending-approval' : requiresDocumentResubmission ? 'ocr-resubmission-required' : 'manual-review-required',
    applicantType: normalizedType,
    results,
    processedBy: processedBy || 'automatic_processor',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  const notificationLabel = 'Clinic'
  const notification = {
    recipientRole: 'Superadmin',
    senderId: uid,
    type: `${normalizedType}_registration_verification`,
    title: `${notificationLabel} Registration Ready for Review`,
    message: `${allVerified
      ? `A ${normalizedType} registration passed OCR verification and is awaiting your approval.`
      : requiresDocumentResubmission
        ? `A ${normalizedType} registration needs replacement documents before review can continue.`
        : `A ${normalizedType} registration requires manual document review.`}${hasExpiryWarning ? ` Expiry warning: ${expiryWarningDocuments.map(registrationDocumentLabel).join(', ')} expire within ${REGISTRATION_EXPIRY_WARNING_DAYS} days.` : ''}`,
    link: '/superadmin/clinics/verification',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  await firestore.runTransaction(async (transaction) => {
    const latestSnapshot = await transaction.get(applicationRef)
    if (!latestSnapshot.exists) throw Object.assign(new Error('Registration application was removed before OCR completed.'), { statusCode: 409 })
    const latest = latestSnapshot.data() || {}
    const latestJob = latest.verificationJob || {}
    if (latestJob.runId !== expectedRunId || latestJob.status !== 'processing') {
      throw Object.assign(new Error('This clinic verification job was superseded before completion.'), { statusCode: 409 })
    }
    const latestApprovalStatus = String(latest.approvalStatus || '').trim().toLowerCase()
    if (latestApprovalStatus.includes('approved') || latestApprovalStatus.includes('rejected')
      || (latestApprovalStatus.includes('pending documents') && latest.resubmissionRequired === true)) {
      throw Object.assign(new Error('A reviewer changed the registration while OCR was running.'), { statusCode: 409 })
    }
    const latestDocuments = latest.submittedDocuments || {}
    const documentsChanged = requiredKeys.some((docKey) => {
      const originalPath = String(documents?.[docKey]?.path || documents?.[docKey]?.storagePath || '').trim()
      const currentPath = String(latestDocuments?.[docKey]?.path || latestDocuments?.[docKey]?.storagePath || '').trim()
      return originalPath !== currentPath
    })
    if (documentsChanged) {
      throw Object.assign(new Error('Submitted documents changed while OCR was running. Run verification again.'), { statusCode: 409 })
    }
    transaction.set(applicationRef, { ...verificationPayload, verificationJob }, { merge: true })
    transaction.set(userRef, {
      status: approvalStatus,
      approvalStatus,
      registrationStatus: requiresDocumentResubmission
        ? CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED
        : CLINIC_REGISTRATION_STATUS.PENDING_REVIEW,
      verificationStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(historyRef, historyEntry)
    transaction.set(notificationRef, notification, { merge: true })
  })

  let expiryHoldEmailSent = false
  let expiryWarningEmailSent = false
  if (shouldSendExpiryHoldEmail) {
    const recipient = String(user.email || application.email || '').trim().toLowerCase()
    if (recipient && postmarkClient && senderEmail) {
      try {
        const applicantName = String(user.firstName || application.ownerFirstName || '').trim() || 'Applicant'
        const expiryDocumentLabels = expiryHoldDocuments.map((key) => {
          const expiryDate = results[key]?.checks?.expiryDate
          return `${registrationDocumentLabel(key)}${expiryDate ? ` (expires ${expiryDate})` : ''}`
        }).join(', ')
        const deadlineLabel = expiryResubmissionExpiresAt.toDate().toLocaleDateString('en-PH', {
          timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric',
        })
        const registrationUrl = `${EMAIL_WEBSITE_URL}/clinic/register?resubmission=expiry-hold`
        await sendPostmarkMessage({
          to: recipient,
          from: senderEmail,
          subject: 'Action Required: Resubmit Your Clinic Document Within 24 Days',
          text: `Hi ${applicantName},\n\nYour clinic registration is on hold because a submitted document is close to its expiration date.\n\nDocument requiring replacement: ${expiryDocumentLabels}\n\nPlease renew the document and upload the updated copy here:\n${registrationUrl}\n\nThis resubmission link is valid until ${deadlineLabel}. After this date, your pending clinic registration will be closed and a new application will be required.\n\nPlease ensure the replacement document is complete, clear, readable, and currently valid.\n\nRegards,\nThe AesthetiCare Team`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Your clinic registration is on hold because a submitted document is close to its expiration date.</p><p><strong>Document requiring replacement:</strong> ${expiryDocumentLabels}</p><p>Please renew the document and upload the updated copy here:</p><p><a href="${registrationUrl}">${registrationUrl}</a></p><p>This resubmission link is valid until <strong>${deadlineLabel}</strong>. After this date, your pending clinic registration will be closed and a new application will be required.</p><p>Please ensure the replacement document is complete, clear, readable, and currently valid.</p><p>Regards,<br>The AesthetiCare Team</p></div>`,
        })
        expiryHoldEmailSent = true
      } catch (emailError) {
        console.warn('Failed to send clinic expiry-hold resubmission email:', emailError?.message || emailError)
      }
    }
  }

  const shouldSendExpiryWarningEmail = hasExpiryWarning && !application.expiryWarningEmailSentAt
  if (shouldSendExpiryWarningEmail) {
    const recipient = String(user.email || application.email || '').trim().toLowerCase()
    if (recipient && postmarkClient && senderEmail) {
      try {
        const applicantName = String(user.firstName || application.ownerFirstName || '').trim() || 'Applicant'
        const expiringDocuments = expiryWarningDocuments.map((key) => {
          const result = results[key]
          return `${registrationDocumentLabel(key)} (expires ${result.checks.expiryDate}; ${result.checks.expiryDaysRemaining} days remaining)`
        }).join(', ')
        await sendPostmarkMessage({
          to: recipient,
          from: senderEmail,
          subject: 'Reminder: A Clinic Registration Document Expires Soon',
          text: `Hi ${applicantName},\n\nOur document check found that the following clinic registration document${expiryWarningDocuments.length === 1 ? '' : 's'} will expire within 30 days: ${expiringDocuments}.\n\nYour registration can continue through its normal review while the document is still valid. Please renew it before it expires and contact the platform administrator if an updated document is needed for review.\n\nRegards,\nThe AesthetiCare Team`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Our document check found that the following clinic registration document${expiryWarningDocuments.length === 1 ? '' : 's'} will expire within 30 days:</p><p><strong>${expiringDocuments}</strong></p><p>Your registration can continue through its normal review while the document is still valid. Please renew it before it expires and contact the platform administrator if an updated document is needed for review.</p><p>Regards,<br>The AesthetiCare Team</p></div>`,
        })
        expiryWarningEmailSent = true
        await applicationRef.set({ expiryWarningEmailSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      } catch (emailError) {
        console.warn('Failed to send clinic expiry-warning email:', emailError?.message || emailError)
      }
    }
  }

  return { status: verificationStatus, approvalStatus, allVerified, hasRejectedDocument, results, expiryResubmissionExpiresAt, expiryHoldEmailSent, expiryWarningEmailSent, verificationJob }
}

const activeClinicVerificationRunIds = new Set()
const CLINIC_VERIFICATION_JOB_LEASE_MS = 15 * 60 * 1000

const markClinicVerificationJobFailed = async ({ uid, runId, error }) => {
  const applicationRef = admin.firestore().collection('clinics').doc(uid)
  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(applicationRef)
    if (!snapshot.exists) return
    const application = snapshot.data() || {}
    const job = application.verificationJob || {}
    if (job.runId !== runId || job.status !== 'processing') return
    transaction.set(applicationRef, {
      verificationStatus: 'OCR Processing Failed',
      verificationJob: {
        ...job,
        status: 'failed',
        error: String(error?.message || error || 'OCR processing failed').slice(0, 500),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaseExpiresAt: admin.firestore.FieldValue.delete(),
      },
    }, { merge: true })
  })
}

const executeClinicVerificationJob = async ({ uid, runId, processedBy }) => {
  try {
    return await runRegistrationDocumentVerification({
      uid,
      applicantType: 'clinic',
      processedBy,
      runId,
    })
  } catch (error) {
    if (!error?.jobAlreadyClaimed) {
      try {
        await markClinicVerificationJobFailed({ uid, runId, error })
      } catch (persistError) {
        console.error('Could not persist clinic OCR job failure:', persistError)
      }
    }
    throw error
  }
}

const scheduleClinicVerificationJob = ({ uid, runId, processedBy = 'automatic_processor' }) => {
  if (!uid || !runId || activeClinicVerificationRunIds.has(runId)) return
  activeClinicVerificationRunIds.add(runId)
  const run = () => executeClinicVerificationJob({ uid, runId, processedBy })
      .catch((error) => console.error('Clinic OCR job failed:', uid, error?.message || error))
      .finally(() => activeClinicVerificationRunIds.delete(runId))
  if (process.env.VERCEL) {
    // Vercel may freeze a serverless function as soon as the response is sent.
    // waitUntil keeps this job alive within the function's configured duration.
    waitUntil(run())
  } else {
    setImmediate(() => { void run() })
  }
}

const queueClinicVerificationRetry = async ({ uid, processedBy }) => {
  const firestore = admin.firestore()
  const applicationRef = firestore.collection('clinics').doc(uid)
  const runId = crypto.randomUUID()
  let jobSummary = null
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(applicationRef)
    if (!snapshot.exists) throw Object.assign(new Error('Registration application not found.'), { statusCode: 404 })
    const application = snapshot.data() || {}
    const approvalStatus = String(application.approvalStatus || '').trim().toLowerCase()
    if (approvalStatus.includes('approved') || approvalStatus.includes('rejected')) {
      throw Object.assign(new Error('A completed clinic registration cannot be reprocessed.'), { statusCode: 409 })
    }
    if (approvalStatus.includes('pending documents') && application.resubmissionRequired === true) {
      throw Object.assign(new Error('OCR is unavailable while replacement documents are being requested.'), { statusCode: 409 })
    }
    const priorJob = application.verificationJob || {}
    const leaseExpiresAt = getTimestampDate(priorJob.leaseExpiresAt)
    if (priorJob.status === 'queued'
      || (priorJob.status === 'processing' && leaseExpiresAt && leaseExpiresAt.getTime() > Date.now())) {
      throw Object.assign(new Error('Clinic OCR is already queued or processing.'), { statusCode: 409 })
    }
    const requiredKeys = getRegistrationDocumentRequirements('clinic', application)
    const missing = requiredKeys.filter((key) => {
      const document = application.submittedDocuments?.[key] || {}
      return !String(document.path || document.storagePath || '').trim()
    })
    if (missing.length) {
      throw Object.assign(new Error(`Required submitted documents are missing: ${missing.map(registrationDocumentLabel).join(', ')}.`), { statusCode: 409 })
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    const job = {
      runId,
      status: 'queued',
      processedDocuments: 0,
      totalDocuments: requiredKeys.length,
      processedBy: processedBy || 'automatic_processor',
      queuedAt: timestamp,
      updatedAt: timestamp,
    }
    transaction.set(applicationRef, {
      verificationStatus: 'Queued for OCR',
      verificationResults: {},
      verificationProcessedAt: admin.firestore.FieldValue.delete(),
      verificationProcessedBy: admin.firestore.FieldValue.delete(),
      verificationJob: job,
      updatedAt: timestamp,
    }, { merge: true })
    jobSummary = {
      runId,
      status: 'queued',
      processedDocuments: 0,
      totalDocuments: requiredKeys.length,
      processedBy: processedBy || 'automatic_processor',
    }
  })
  return jobSummary
}

const recoverClinicVerificationJobs = async ({ uid = '' } = {}) => {
  if (!adminReady) return { ok: false, scheduled: 0, recovered: 0 }
  let scheduled = 0
  let recoveredCount = 0
  try {
    const firestore = admin.firestore()
    let queuedDocuments = []
    let processingDocuments = []
    if (uid) {
      const applicationSnapshot = await firestore.collection('clinics').doc(uid).get()
      const status = String(applicationSnapshot.data()?.verificationJob?.status || '').toLowerCase()
      if (status === 'queued') queuedDocuments = [applicationSnapshot]
      if (status === 'processing') processingDocuments = [applicationSnapshot]
    } else {
      const [queuedSnapshot, processingSnapshot] = await Promise.all([
        firestore.collection('clinics').where('verificationJob.status', '==', 'queued').limit(50).get(),
        firestore.collection('clinics').where('verificationJob.status', '==', 'processing').limit(50).get(),
      ])
      queuedDocuments = queuedSnapshot.docs
      processingDocuments = processingSnapshot.docs
    }
    for (const documentSnapshot of queuedDocuments) {
      const application = documentSnapshot.data() || {}
      const job = application.verificationJob || {}
      if (job.runId) {
        scheduleClinicVerificationJob({ uid: documentSnapshot.id, runId: job.runId, processedBy: job.processedBy })
        scheduled += 1
      }
    }
    for (const documentSnapshot of processingDocuments) {
      const application = documentSnapshot.data() || {}
      const job = application.verificationJob || {}
      const leaseExpiresAt = getTimestampDate(job.leaseExpiresAt)
      if (leaseExpiresAt && leaseExpiresAt.getTime() > Date.now()) continue

      const applicationRef = documentSnapshot.ref
      const replacementRunId = crypto.randomUUID()
      let recovered = false
      await firestore.runTransaction(async (transaction) => {
        const latestSnapshot = await transaction.get(applicationRef)
        if (!latestSnapshot.exists) return
        const latest = latestSnapshot.data() || {}
        const latestJob = latest.verificationJob || {}
        const currentLease = getTimestampDate(latestJob.leaseExpiresAt)
        if (latestJob.runId !== job.runId
          || latestJob.status !== 'processing'
          || (currentLease && currentLease.getTime() > Date.now())) return
        transaction.set(applicationRef, {
          verificationStatus: 'Queued for OCR',
          verificationResults: {},
          verificationJob: {
            ...latestJob,
            runId: replacementRunId,
            status: 'queued',
            processedDocuments: 0,
            totalDocuments: getRegistrationDocumentRequirements('clinic', latest).length,
            queuedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            leaseExpiresAt: admin.firestore.FieldValue.delete(),
            recoveredFromRunId: latestJob.runId,
          },
        }, { merge: true })
        recovered = true
      })
      if (recovered) {
        recoveredCount += 1
        scheduleClinicVerificationJob({
          uid: documentSnapshot.id,
          runId: replacementRunId,
          processedBy: job.processedBy || 'automatic_processor',
        })
      }
    }

    if (!uid) {
      const recoveryVersion = 'registration-ocr-storagebucket-reference-v1'
      const keys = [...REGISTRATION_DOCUMENT_REQUIREMENTS.clinic, AUTHORIZATION_DOCUMENT_KEY]
      const failedSnapshots = await Promise.all(keys.flatMap((docKey) => [
        firestore.collection('clinics')
          .where(`verificationResults.${docKey}.processingError`, '==', 'storageBucket is not defined')
          .limit(50)
          .get(),
        firestore.collection('clinics')
          .where(`verificationResults.${docKey}.reason`, '==', 'storageBucket is not defined')
          .limit(50)
          .get(),
      ]))
      const candidates = new Map()
      failedSnapshots.forEach((snapshot) => snapshot.docs.forEach((documentSnapshot) => {
        candidates.set(documentSnapshot.id, documentSnapshot)
      }))

      for (const documentSnapshot of candidates.values()) {
        const application = documentSnapshot.data() || {}
        const approvalStatus = String(application.approvalStatus || '').trim().toLowerCase()
        const hasKnownStorageBucketError = Object.values(application.verificationResults || {}).some((result) =>
          ['processingError', 'reason'].some((key) => String(result?.[key] || '').includes('storageBucket is not defined')))
        if (!hasKnownStorageBucketError) continue
        if (application.automaticOcrRecoveryVersion === recoveryVersion
          || approvalStatus.includes('approved')
          || approvalStatus.includes('rejected')
          || ['queued', 'processing'].includes(String(application.verificationJob?.status || '').toLowerCase())) continue

        try {
          const job = await queueClinicVerificationRetry({ uid: documentSnapshot.id, processedBy: 'automatic_processor' })
          await documentSnapshot.ref.set({
            automaticOcrRecoveryVersion: recoveryVersion,
            automaticOcrRecoveryAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true })
          scheduleClinicVerificationJob({ uid: documentSnapshot.id, runId: job.runId, processedBy: 'automatic_processor' })
          recoveredCount += 1
        } catch (recoveryError) {
          if (Number(recoveryError?.statusCode) !== 409) {
            console.warn('Could not automatically recover the clinic OCR result:', documentSnapshot.id, recoveryError?.message || recoveryError)
          }
        }
      }
    }
    return { ok: true, scheduled, recovered: recoveredCount }
  } catch (error) {
    console.error('Could not recover queued clinic OCR jobs:', error?.message || error)
    return { ok: false, scheduled, recovered: recoveredCount }
  }
}

app.post('/registration/submit-clinic-documents', requireAuth, async (req, res) => {
  const uid = String(req.user?.uid || '').trim()
  const documents = req.body?.submittedDocuments && typeof req.body.submittedDocuments === 'object'
    ? req.body.submittedDocuments
    : {}
  const permitHolderIsRegistrant = req.body?.permitHolderIsRegistrant
  if (permitHolderIsRegistrant !== true && permitHolderIsRegistrant !== false) {
    return res.status(400).json({ success: false, error: 'Confirm who is named on the business permit.' })
  }
  const submittedPermitHolderName = String(req.body?.permitHolderName || '').trim().slice(0, 200)
  const submittedPermitHolderRelationship = permitHolderIsRegistrant
    ? 'Self'
    : String(req.body?.permitHolderRelationship || '').trim().slice(0, 200)
  if (!permitHolderIsRegistrant && (!submittedPermitHolderName || !submittedPermitHolderRelationship)) {
    return res.status(400).json({ success: false, error: 'Enter the business permit holder name and your relationship to them.' })
  }

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(uid)
    const clinicRef = firestore.collection('clinics').doc(uid)
    const [userSnapshot, clinicSnapshot] = await Promise.all([userRef.get(), clinicRef.get()])
    if (!userSnapshot.exists || !clinicSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Clinic registration account was not found.' })
    }
    const user = userSnapshot.data() || {}
    const clinic = clinicSnapshot.data() || {}
    const email = String(user.email || clinic.email || '').trim().toLowerCase()
    if (!email || !EMAIL_ADDRESS_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'A verified registration email is required.' })
    }
    const authEmail = String(req.user?.email || '').trim().toLowerCase()
    if (authEmail && authEmail !== email) {
      return res.status(403).json({ success: false, error: 'Your signed-in email does not match this registration.' })
    }
    if (clinic.resubmissionRequired === true
      && typeof clinic.permitHolderIsRegistrant === 'boolean'
      && permitHolderIsRegistrant !== clinic.permitHolderIsRegistrant) {
      return res.status(409).json({ success: false, error: 'The permit-holder details cannot be changed during document resubmission. Refresh your registration and try again.' })
    }

    const requiredKeys = getRegistrationDocumentRequirements('clinic', {
      ...clinic,
      permitHolderIsRegistrant,
    })
    const verificationRunId = crypto.randomUUID()
    const expiryDeadline = getTimestampDate(clinic.expiryResubmissionExpiresAt)
    const expiryHoldKeys = Array.isArray(clinic.expiryHoldDocuments)
      ? [...new Set(clinic.expiryHoldDocuments.filter((key) => requiredKeys.includes(key)))]
      : []
    if (clinic.resubmissionRequired === true && expiryDeadline && expiryDeadline.getTime() <= Date.now()) {
      return res.status(409).json({ success: false, error: 'The document-resubmission period has ended. Please start a new clinic registration.' })
    }
    const isExpiryPartialResubmission = clinic.approvalStatus === 'Pending Documents'
      && clinic.resubmissionRequired === true
      && Boolean(expiryDeadline && expiryDeadline.getTime() > Date.now())
      && expiryHoldKeys.length > 0
    const expiryHoldKeySet = new Set(expiryHoldKeys)
    const previousDocuments = clinic.submittedDocuments || {}
    const submittedDocuments = {}
    for (const docKey of requiredKeys) {
      if (isExpiryPartialResubmission && !expiryHoldKeySet.has(docKey)) {
        const existing = previousDocuments[docKey]
        const existingPath = String(existing?.path || existing?.storagePath || '').trim()
        if (!existingPath.startsWith(`clinic-registration/${uid}/${docKey}/`)) {
          return res.status(409).json({ success: false, error: `The saved ${registrationDocumentLabel(docKey)} is unavailable. Please contact support.` })
        }
        submittedDocuments[docKey] = existing
        continue
      }
      const entry = documents[docKey] || {}
      const storagePath = String(entry.path || entry.storagePath || '').trim()
      if (!storagePath.startsWith(`clinic-registration/${uid}/${docKey}/`)) {
        return res.status(400).json({ success: false, error: `The ${registrationDocumentLabel(docKey)} file is missing or invalid.` })
      }
      if (isExpiryPartialResubmission) {
        const previousPath = String(previousDocuments[docKey]?.path || previousDocuments[docKey]?.storagePath || '').trim()
        if (previousPath && storagePath === previousPath) {
          return res.status(400).json({ success: false, error: `Upload a replacement for ${registrationDocumentLabel(docKey)}.` })
        }
      }
      const fileSize = Number(entry.size || 0)
      const fileType = String(entry.type || '').toLowerCase()
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 10 * 1024 * 1024
        || !allowedTypes.includes(fileType)) {
        return res.status(400).json({ success: false, error: `The ${registrationDocumentLabel(docKey)} file type or size is invalid.` })
      }
      submittedDocuments[docKey] = {
        name: String(entry.name || '').slice(0, 255),
        size: fileSize,
        type: fileType,
        url: String(entry.url || '').slice(0, 2048),
        path: storagePath,
        uploadedAt: String(entry.uploadedAt || '').slice(0, 64),
      }
    }

    // Confirm each uploaded Storage object exists and matches its submitted
    // size/type metadata before accepting the registration.
    const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
    if (!bucketName) {
      const error = new Error('Secure document storage is not configured. Please contact support before submitting.')
      error.statusCode = 503
      throw error
    }
    const storageBucket = admin.storage().bucket(bucketName)
    for (const docKey of requiredKeys) {
      const document = submittedDocuments[docKey]
      let metadata
      try {
        const [storedMetadata] = await storageBucket.file(document.path).getMetadata()
        metadata = storedMetadata
      } catch (_error) {
        const error = new Error(`The saved ${registrationDocumentLabel(docKey)} file is unavailable. Please upload it again.`)
        error.statusCode = 422
        throw error
      }
      const storedSize = Number(metadata?.size || 0)
      const storedType = String(metadata?.contentType || '').toLowerCase()
      const allowedStoredTypes = ['application/pdf', 'image/jpeg', 'image/png']
      if (!Number.isFinite(storedSize) || storedSize <= 0 || storedSize > 10 * 1024 * 1024
        || storedSize !== Number(document.size)
        || storedType !== document.type
        || !allowedStoredTypes.includes(storedType)) {
        const error = new Error(`The saved ${registrationDocumentLabel(docKey)} file type or size is invalid. Please upload it again.`)
        error.statusCode = 422
        throw error
      }

      if (REGISTRATION_NAME_MATCH_DOCUMENTS.has(docKey)) {
        const previousPath = String(previousDocuments[docKey]?.path || previousDocuments[docKey]?.storagePath || '').trim()
        const isPreviouslyAcceptedFile = isExpiryPartialResubmission && previousPath === document.path
        if (!isPreviouslyAcceptedFile) {
          const preflightSnapshot = await clinicRef.collection('documentPreflights').doc(docKey).get()
          const preflight = preflightSnapshot.exists ? preflightSnapshot.data() || {} : {}
          const expiresAt = getTimestampDate(preflight.expiresAt)
          const [storedBytes] = await storageBucket.file(document.path).download()
          const preflightMatchesFile = preflight.accepted === true
            && preflight.nameMatchPolicyVersion === REGISTRATION_NAME_MATCH_POLICY_VERSION
            && preflight.storagePath === document.path
            && preflight.comparisonStatus !== 'mismatch'
            && Boolean(expiresAt && expiresAt.getTime() > Date.now())
            && preflight.contentType === storedType
            && Number(preflight.size) === storedSize
            && preflight.nameInputsHash === getRegistrationNameInputsHash(clinic, user)
            && preflight.contentHash === registrationDocumentHash(storedBytes)
          if (!preflightMatchesFile) {
            const error = new Error(`The ${registrationDocumentLabel(docKey)} has not passed the name comparison. Select and upload it again before submitting.`)
            error.statusCode = 422
            throw error
          }
        }
      }
    }

    const registrationRequiresAgreement = clinic.isClinicRegistrationActive !== false
    const priorAgreement = clinic.platformAgreementAcceptance && typeof clinic.platformAgreementAcceptance === 'object'
      ? clinic.platformAgreementAcceptance
      : null
    const isStoredAgreementPdf = (agreement) => {
      const storagePath = String(agreement?.pdfStoragePath || '').trim()
      return agreement?.version === CLINIC_PLATFORM_AGREEMENT.version
        && storagePath.startsWith(`clinic-agreements/${uid}/`)
        && storagePath.endsWith('.pdf')
    }
    let preparedAgreementAcceptance = registrationRequiresAgreement && isStoredAgreementPdf(priorAgreement)
      ? priorAgreement
      : null
    let newAgreementPdfPath = ''
    let newAgreementSignaturePath = ''
    if (registrationRequiresAgreement && !preparedAgreementAcceptance) {
      const acceptance = req.body?.platformAgreementAcceptance
      const normalizeSignerName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
      const expectedSignerName = [user.firstName, user.midName, user.lastName, user.suffix]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ')
      const suppliedSignerName = String(acceptance?.signerName || '').trim().replace(/\s+/g, ' ')
      const suppliedSignerEmail = String(acceptance?.signerEmail || '').trim().toLowerCase()
      const signatureDataUrl = String(acceptance?.signatureImage || '')
      const signatureMatch = signatureDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/)
      if (acceptance?.accepted !== true
        || acceptance?.version !== CLINIC_PLATFORM_AGREEMENT.version
        || acceptance?.method !== 'drawn-signature'
        || !expectedSignerName
        || normalizeSignerName(suppliedSignerName) !== normalizeSignerName(expectedSignerName)
        || suppliedSignerEmail !== email
        || !signatureMatch) {
        return res.status(400).json({ success: false, error: 'Review and sign the current Clinic Platform Agreement before submitting.' })
      }
      const signatureBytes = Buffer.from(signatureMatch[1], 'base64')
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      if (!signatureBytes.length || signatureBytes.length > 512 * 1024
        || !signatureBytes.subarray(0, pngSignature.length).equals(pngSignature)) {
        return res.status(400).json({ success: false, error: 'The electronic signature image is invalid. Please sign again.' })
      }

      const signedAt = new Date()
      const acceptanceId = crypto.randomUUID()
      const pdfFileName = 'AesthetiCare-Signed-Clinic-Platform-Agreement.pdf'
      const pdfBytes = createClinicAgreementPdf({
        clinicName: clinic.clinicName,
        companyName: clinic.companyName,
        signerName: suppliedSignerName,
        signerEmail: email,
        signerPosition: clinic.authorizedRepPosition || user.authorizedRepPosition,
        signatureImage: signatureDataUrl,
        signedAt,
        acceptanceId,
      })
      newAgreementPdfPath = `clinic-agreements/${uid}/${acceptanceId}.pdf`
      newAgreementSignaturePath = `clinic-agreements/${uid}/${acceptanceId}.png`
      const pdfSha256 = registrationDocumentHash(pdfBytes)
      const signatureSha256 = registrationDocumentHash(signatureBytes)
      try {
        await admin.storage().bucket(bucketName).file(newAgreementSignaturePath).save(signatureBytes, {
          resumable: false,
          metadata: {
            contentType: 'image/png',
            cacheControl: 'private, no-store, max-age=0',
            metadata: { clinicId: uid, acceptanceId, sha256: signatureSha256 },
          },
        })
        await admin.storage().bucket(bucketName).file(newAgreementPdfPath).save(pdfBytes, {
          resumable: false,
          metadata: {
            contentType: 'application/pdf',
            cacheControl: 'private, no-store, max-age=0',
            metadata: {
              clinicId: uid,
              agreementVersion: CLINIC_PLATFORM_AGREEMENT.version,
              acceptanceId,
              sha256: pdfSha256,
            },
          },
        })
      } catch (uploadError) {
        await Promise.all([
          admin.storage().bucket(bucketName).file(newAgreementSignaturePath).delete({ ignoreNotFound: true }).catch(() => {}),
          admin.storage().bucket(bucketName).file(newAgreementPdfPath).delete({ ignoreNotFound: true }).catch(() => {}),
        ])
        throw uploadError
      }
      preparedAgreementAcceptance = {
        version: CLINIC_PLATFORM_AGREEMENT.version,
        signerName: suppliedSignerName,
        signerEmail: email,
        signerPosition: String(clinic.authorizedRepPosition || user.authorizedRepPosition || '').trim().slice(0, 100),
        method: 'drawn-signature',
        acceptedAt: admin.firestore.Timestamp.fromDate(signedAt),
        signedAt: admin.firestore.Timestamp.fromDate(signedAt),
        acceptanceId,
        clinicNameSnapshot: String(clinic.clinicName || '').trim().slice(0, 160),
        companyNameSnapshot: String(clinic.companyName || '').trim().slice(0, 160),
        agreementTextHash: clinicAgreementTextHash(),
        pdfStoragePath: newAgreementPdfPath,
        pdfFileName,
        pdfSha256,
        signatureStoragePath: newAgreementSignaturePath,
        signatureSha256,
      }
    }

    const policyRef = clinicSubmissionPolicyRef(firestore, email)
    const now = Date.now()
    let submissionAttemptCount = 0
    let lockedUntil = null
    let committedAgreementAcceptance = null
    try {
      await firestore.runTransaction(async (transaction) => {
      committedAgreementAcceptance = null
      const [latestClinicSnapshot, policySnapshot, latestUserSnapshot] = await Promise.all([
        transaction.get(clinicRef), transaction.get(policyRef), transaction.get(userRef),
      ])
      if (!latestClinicSnapshot.exists) {
        throw Object.assign(new Error('Clinic registration account was not found.'), { statusCode: 404 })
      }
      const latestClinic = latestClinicSnapshot.data() || {}
      const policy = policySnapshot.exists ? policySnapshot.data() || {} : {}
      const latestUser = latestUserSnapshot.exists ? latestUserSnapshot.data() || {} : {}
      if (isExpiryPartialResubmission) {
        const latestDeadline = getTimestampDate(latestClinic.expiryResubmissionExpiresAt)
        const latestHeldKeys = Array.isArray(latestClinic.expiryHoldDocuments)
          ? [...new Set(latestClinic.expiryHoldDocuments.filter((key) => requiredKeys.includes(key)))].sort()
          : []
        if (latestClinic.resubmissionRequired !== true
          || !latestDeadline
          || latestDeadline.getTime() <= now
          || latestHeldKeys.join('|') !== [...expiryHoldKeys].sort().join('|')) {
          throw Object.assign(new Error('The expiry resubmission request changed or has expired. Refresh your registration and try again.'), { statusCode: 409 })
        }
        const latestDocuments = latestClinic.submittedDocuments || {}
        const savedDocumentsChanged = requiredKeys.some((docKey) => {
          const initialPath = String(previousDocuments[docKey]?.path || previousDocuments[docKey]?.storagePath || '').trim()
          const latestPath = String(latestDocuments[docKey]?.path || latestDocuments[docKey]?.storagePath || '').trim()
          return initialPath !== latestPath
        })
        if (savedDocumentsChanged) {
          throw Object.assign(new Error('The saved documents changed while you were preparing this submission. Refresh the page and try again.'), { statusCode: 409 })
        }
      }
      const existingLock = getTimestampDate(policy.lockedUntil)
      if (existingLock && existingLock.getTime() > now) {
        lockedUntil = existingLock
        return
      }
      const status = String(latestClinic.approvalStatus || '')
      if (!['Pending Document Submission', 'Pending Documents', 'Pending Approval'].includes(status)) {
        throw Object.assign(new Error('This clinic application is not accepting document submissions.'), { statusCode: 409 })
      }
      const previousLock = getTimestampDate(policy.lockedUntil)
      const lockExpired = Boolean(previousLock && previousLock.getTime() <= now)
      const count = lockExpired ? 0 : Math.max(
        Number(policy.submissionAttemptCount || 0),
        Number(latestClinic.submissionAttemptCount || 0),
        Number(latestClinic.resubmissionCount || 0) + (latestClinic.documentsSubmittedAt ? 1 : 0)
      )
      if (count >= CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS) {
        lockedUntil = new Date(now + CLINIC_REGISTRATION_LOCKOUT_DAYS * DAY_MS)
        transaction.set(policyRef, {
          email,
          submissionAttemptCount: count,
          lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })
        return
      }

      if (latestClinic.isClinicRegistrationActive !== false) {
        const latestAcceptance = latestClinic.platformAgreementAcceptance
        committedAgreementAcceptance = isStoredAgreementPdf(latestAcceptance)
          ? latestAcceptance
          : preparedAgreementAcceptance
        if (!committedAgreementAcceptance) {
          throw Object.assign(new Error('The signed Clinic Platform Agreement is required before document submission.'), { statusCode: 400 })
        }
      }
      const ownerParts = [
        latestUser.firstName || latestClinic.firstName,
        latestUser.midName || latestUser.middleName || latestClinic.midName || latestClinic.middleName,
        latestUser.lastName || latestClinic.lastName,
        latestUser.suffix || latestClinic.suffix,
      ].map((part) => String(part || '').trim()).filter(Boolean)
      const submittedHolderName = permitHolderIsRegistrant
        ? ownerParts.join(' ') || String(latestUser.fullName || latestClinic.fullName || submittedPermitHolderName).trim()
        : submittedPermitHolderName
      const ocrSnapshot = latestClinic.registrationOcrSnapshot || {
        firstName: String(latestUser.firstName || latestClinic.firstName || '').trim(),
        middleName: String(latestUser.midName || latestUser.middleName || latestClinic.midName || latestClinic.middleName || '').trim(),
        lastName: String(latestUser.lastName || latestClinic.lastName || '').trim(),
        suffix: String(latestUser.suffix || latestClinic.suffix || '').trim(),
        birthDate: latestUser.birthDate || latestClinic.birthDate || null,
        businessName: String(latestClinic.businessName || latestClinic.clinicName || latestClinic.companyName || latestUser.companyName || '').trim(),
        permitHolderIsRegistrant,
        permitHolderName: submittedHolderName,
        permitHolderRelationship: submittedPermitHolderRelationship,
        source: 'submission',
        capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      if (latestClinic.registrationOcrSnapshot
        && (ocrSnapshot.permitHolderIsRegistrant !== permitHolderIsRegistrant
          || String(ocrSnapshot.permitHolderName || '').trim().toLowerCase() !== submittedHolderName.trim().toLowerCase()
          || String(ocrSnapshot.permitHolderRelationship || '').trim().toLowerCase() !== submittedPermitHolderRelationship.trim().toLowerCase())) {
        throw Object.assign(new Error('The registrant and permit-holder details cannot be changed after the initial document submission.'), { statusCode: 409 })
      }
      const agreementHistoryEntries = []
      if (committedAgreementAcceptance && latestClinic.isClinicRegistrationActive !== false) {
        const latestAcceptance = latestClinic.platformAgreementAcceptance
        if (latestAcceptance && latestAcceptance.acceptanceId !== committedAgreementAcceptance.acceptanceId) {
          agreementHistoryEntries.push(latestAcceptance)
        }
        agreementHistoryEntries.push(committedAgreementAcceptance)
      }

      submissionAttemptCount = count + 1
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      transaction.set(clinicRef, {
        approvalStatus: 'Pending Approval',
        registrationStatus: 'Pending Review',
        verificationStatus: 'Queued for OCR',
        verificationResults: {},
        verificationProcessedAt: admin.firestore.FieldValue.delete(),
        verificationProcessedBy: admin.firestore.FieldValue.delete(),
        verificationJob: {
          runId: verificationRunId,
          status: 'queued',
          processedDocuments: 0,
          totalDocuments: requiredKeys.length,
          processedBy: 'automatic_processor',
          queuedAt: timestamp,
          updatedAt: timestamp,
        },
        documentsSubmittedAt: timestamp,
        submittedDocuments,
        registrationOcrSnapshot: ocrSnapshot,
        permitHolderIsRegistrant,
        permitHolderName: submittedHolderName,
        permitHolderRelationship: submittedPermitHolderRelationship,
        authorizationReviewRequired: permitHolderIsRegistrant === false,
        submissionAttemptCount,
        ...(committedAgreementAcceptance && latestClinic.isClinicRegistrationActive !== false
          ? {
              platformAgreementAcceptance: committedAgreementAcceptance,
              platformAgreementAcceptances: admin.firestore.FieldValue.arrayUnion(...agreementHistoryEntries),
            }
          : {}),
        draftDocuments: admin.firestore.FieldValue.delete(),
        draftDocumentsUpdatedAt: admin.firestore.FieldValue.delete(),
        registrationLockedUntil: admin.firestore.FieldValue.delete(),
        expiryWarningDocuments: admin.firestore.FieldValue.delete(),
        expiryWarningEmailSentAt: admin.firestore.FieldValue.delete(),
        expiryHoldDocuments: admin.firestore.FieldValue.delete(),
        expiryResubmissionExpiresAt: admin.firestore.FieldValue.delete(),
        expiryAccountHold: admin.firestore.FieldValue.delete(),
        resubmissionRequired: admin.firestore.FieldValue.delete(),
        resubmissionReason: admin.firestore.FieldValue.delete(),
        updatedAt: timestamp,
      }, { merge: true })
      transaction.set(userRef, {
        status: 'Pending Approval',
        registrationStatus: 'Pending Review',
        submissionAttemptCount,
        registrationLockedUntil: admin.firestore.FieldValue.delete(),
        updatedAt: timestamp,
      }, { merge: true })
      transaction.set(policyRef, {
        email,
        submissionAttemptCount,
        updatedAt: timestamp,
      }, { merge: true })
      })
    } catch (transactionError) {
      if (newAgreementPdfPath) {
        await admin.storage().bucket(bucketName).file(newAgreementPdfPath).delete({ ignoreNotFound: true }).catch(() => {})
      }
      if (newAgreementSignaturePath) {
        await admin.storage().bucket(bucketName).file(newAgreementSignaturePath).delete({ ignoreNotFound: true }).catch(() => {})
      }
      throw transactionError
    }

    if (newAgreementPdfPath && committedAgreementAcceptance?.pdfStoragePath !== newAgreementPdfPath) {
      await admin.storage().bucket(bucketName).file(newAgreementPdfPath).delete({ ignoreNotFound: true }).catch(() => {})
    }
    if (newAgreementSignaturePath && committedAgreementAcceptance?.signatureStoragePath !== newAgreementSignaturePath) {
      await admin.storage().bucket(bucketName).file(newAgreementSignaturePath).delete({ ignoreNotFound: true }).catch(() => {})
    }
    if (lockedUntil) return res.status(429).json(clinicSubmissionLockPayload(lockedUntil))
    scheduleClinicVerificationJob({ uid, runId: verificationRunId, processedBy: 'automatic_processor' })
    return res.json({
      success: true,
      data: {
        submissionAttemptCount,
        verificationJob: {
          runId: verificationRunId,
          status: 'queued',
          processedDocuments: 0,
          totalDocuments: requiredKeys.length,
        },
      },
    })
  } catch (error) {
    const status = Number(error?.statusCode || 500)
    if (status >= 400 && status < 500) return res.status(status).json({ success: false, error: error.message })
    console.error('Clinic document submission failed:', error)
    return res.status(500).json({ success: false, error: 'Could not submit clinic documents. Please try again.' })
  }
})

const sendClinicAgreementPdf = async (res, uid, requestedAcceptanceId = '') => {
  const firestore = admin.firestore()
  const clinicSnapshot = await firestore.collection('clinics').doc(uid).get()
  if (!clinicSnapshot.exists) return res.status(404).json({ success: false, error: 'Signed clinic agreement was not found.' })
  const clinic = clinicSnapshot.data() || {}
  const currentAcceptance = clinic.platformAgreementAcceptance || null
  const acceptanceId = String(requestedAcceptanceId || '').trim()
  const acceptances = [
    ...(Array.isArray(clinic.platformAgreementAcceptances) ? clinic.platformAgreementAcceptances : []),
    currentAcceptance,
  ].filter(Boolean)
  const acceptance = acceptanceId
    ? acceptances.find((entry) => String(entry.acceptanceId || '') === acceptanceId)
    : currentAcceptance
  if (!acceptance) return res.status(404).json({ success: false, error: 'Signed clinic agreement was not found.' })
  const storagePath = String(acceptance.pdfStoragePath || '').trim()
  if (!storagePath.startsWith(`clinic-agreements/${uid}/`) || !storagePath.endsWith('.pdf')) {
    return res.status(404).json({ success: false, error: 'A downloadable signed clinic agreement is not available.' })
  }
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  if (!bucketName) return res.status(503).json({ success: false, error: 'Secure document storage is not configured.' })
  try {
    const [bytes] = await admin.storage().bucket(bucketName).file(storagePath).download()
    if (!bytes?.length || bytes.subarray(0, 5).toString('ascii') !== '%PDF-'
      || (acceptance.pdfSha256 && registrationDocumentHash(bytes) !== acceptance.pdfSha256)) {
      return res.status(500).json({ success: false, error: 'The signed agreement file could not be verified.' })
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': 'attachment; filename="AesthetiCare-Signed-Clinic-Platform-Agreement.pdf"',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    })
    return res.send(bytes)
  } catch (error) {
    if (String(error?.code || '').includes('not-found') || Number(error?.code) === 404) {
      return res.status(404).json({ success: false, error: 'The signed agreement file is not available.' })
    }
    throw error
  }
}

app.get('/registration/clinic-platform-agreement', requireAuth, async (req, res) => {
  const uid = String(req.user?.uid || '').trim()
  try {
    const firestore = admin.firestore()
    const [userSnapshot, clinicSnapshot] = await Promise.all([
      firestore.collection('users').doc(uid).get(),
      firestore.collection('clinics').doc(uid).get(),
    ])
    if (!userSnapshot.exists || !clinicSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Clinic registration account was not found.' })
    }
    const role = String(userSnapshot.data()?.role || userSnapshot.data()?.userType || '').trim().toLowerCase()
    if (!['clinic owner', 'clinicowner', 'owner'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Only the clinic owner can download this agreement.' })
    }
    return await sendClinicAgreementPdf(res, uid, req.query?.acceptanceId)
  } catch (error) {
    console.error('Clinic owner agreement download failed:', error)
    return res.status(500).json({ success: false, error: 'Could not download the signed clinic agreement.' })
  }
})

app.get('/admin/clinic-platform-agreement/:uid', requireAuth, requireRole(['superadmin', 'admin', 'reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const uid = String(req.params?.uid || '').trim()
  if (!uid || uid.length > 128 || uid.includes('/')) {
    return res.status(400).json({ success: false, error: 'A valid clinic owner ID is required.' })
  }
  try {
    return await sendClinicAgreementPdf(res, uid, req.query?.acceptanceId)
  } catch (error) {
    console.error('Admin clinic agreement download failed:', error)
    return res.status(500).json({ success: false, error: 'Could not download the signed clinic agreement.' })
  }
})

app.get('/registration/clinic-submission-status', requireAuth, async (req, res) => {
  const uid = String(req.user?.uid || '').trim()
  try {
    const firestore = admin.firestore()
    const [userSnapshot, clinicSnapshot] = await Promise.all([
      firestore.collection('users').doc(uid).get(),
      firestore.collection('clinics').doc(uid).get(),
    ])
    if (!userSnapshot.exists || !clinicSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Clinic registration account was not found.' })
    }
    const user = userSnapshot.data() || {}
    const clinic = clinicSnapshot.data() || {}
    const email = String(user.email || clinic.email || '').trim().toLowerCase()
    const authEmail = String(req.user?.email || '').trim().toLowerCase()
    if (!email || (authEmail && authEmail !== email)) {
      return res.status(403).json({ success: false, error: 'Your signed-in email does not match this registration.' })
    }
    const policySnapshot = await clinicSubmissionPolicyRef(firestore, email).get()
    const policy = policySnapshot.exists ? policySnapshot.data() || {} : {}
    const lockedUntil = getTimestampDate(policy.lockedUntil)
    const activeLock = lockedUntil && lockedUntil.getTime() > Date.now() ? lockedUntil : null
    const count = activeLock ? CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS : Math.max(
      Number(policy.submissionAttemptCount || 0),
      Number(clinic.submissionAttemptCount || 0),
      Number(clinic.resubmissionCount || 0) + (clinic.documentsSubmittedAt ? 1 : 0),
    )
    return res.json({ success: true, data: {
      submissionAttemptCount: Math.min(count, CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS),
      maxSubmissionAttempts: CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS,
      lockedUntil: activeLock?.toISOString() || null,
    } })
  } catch (error) {
    console.error('Clinic submission status lookup failed:', error)
    return res.status(500).json({ success: false, error: 'Could not load the clinic submission status.' })
  }
})

app.post('/registration/auto-verify-documents', requireAuth, async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const applicantType = String(req.body?.applicantType || '').trim().toLowerCase()
  if (!uid || uid !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
  if (applicantType !== 'clinic') return res.status(400).json({ success: false, error: 'Only clinic registration verification is supported.' })
  try {
    const clinicSnapshot = await admin.firestore().collection('clinics').doc(uid).get()
    if (!clinicSnapshot.exists) return res.status(404).json({ success: false, error: 'Registration application not found.' })
    let job = clinicSnapshot.data()?.verificationJob || null
    if (!job || !['queued', 'processing', 'completed'].includes(job.status)) {
      job = await queueClinicVerificationRetry({ uid, processedBy: 'automatic_processor' })
      scheduleClinicVerificationJob({ uid, runId: job.runId, processedBy: job.processedBy })
    }
    return res.status(job.status === 'queued' || job.status === 'processing' ? 202 : 200).json({ success: true, data: { verificationJob: job } })
  } catch (error) {
    console.error('Automatic registration verification failed:', error)
    return res.status(Number(error?.statusCode || 500)).json({ success: false, error: error?.message || 'Automatic verification failed' })
  }
})

// Legacy draft-document OCR endpoint. The current registration flow checks
// identity and business-name documents during upload, then queues full OCR
// automatically after the registrant submits the document set.
app.post('/registration/ocr-document', requireAuth, async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const docKey = String(req.body?.docKey || '').trim()
  if (!uid || uid !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
  if (!SUPPORTED_CLINIC_REGISTRATION_DOCUMENTS.has(docKey)) return res.status(400).json({ success: false, error: 'Unsupported clinic document.' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const [clinicSnap, userSnap] = await Promise.all([clinicRef.get(), firestore.collection('users').doc(uid).get()])
    if (!clinicSnap.exists) return res.status(404).json({ success: false, error: 'Registration application not found.' })
    const clinic = clinicSnap.data() || {}
    const document = clinic.draftDocuments?.[docKey]
    if (!document) return res.status(404).json({ success: false, error: 'Upload the document before starting OCR.' })
    const result = await processUploadedRegistrationDocument({ uid, docKey, document, application: clinic, user: userSnap.data() || {} })
    await clinicRef.set({
      [`draftDocumentOcr.${docKey}`]: result,
      draftDocumentOcrUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return res.json({ success: true, data: result })
  } catch (error) {
    console.error('Upload-time OCR failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'OCR processing failed.' })
  }
})

// Compare names in a private preflight object. Promote the candidate into the
// normal registration folder only after it passes the name check.
app.post('/registration/ocr-preflight', requireAuth, async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const docKey = String(req.body?.docKey || '').trim()
  const storagePath = String(req.body?.storagePath || '').trim()
  const targetPath = String(req.body?.targetPath || '').trim()
  const file = req.body?.file && typeof req.body.file === 'object' ? req.body.file : {}
  if (!uid || uid !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
  if (!REGISTRATION_NAME_MATCH_DOCUMENTS.has(docKey)) {
    return res.status(400).json({ success: false, error: 'This document does not require a name comparison.' })
  }
  const preflightPrefix = `clinic-registration/${uid}/preflight-${docKey}/`
  const targetPrefix = `clinic-registration/${uid}/${docKey}/`
  const preflightFileName = storagePath.startsWith(preflightPrefix) ? storagePath.slice(preflightPrefix.length) : ''
  const targetFileName = targetPath.startsWith(targetPrefix) ? targetPath.slice(targetPrefix.length) : ''
  if (!preflightFileName || preflightFileName.includes('/') || preflightFileName.length > 255
    || !targetFileName || targetFileName.includes('/') || targetFileName.length > 255
    || storagePath === targetPath) {
    return res.status(400).json({ success: false, error: 'The uploaded document path is invalid.' })
  }

  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  if (!bucketName) return res.status(503).json({ success: false, error: 'Secure document storage is not configured.' })
  const bucket = admin.storage().bucket(bucketName)
  const storageFile = bucket.file(storagePath)
  const acceptedFile = bucket.file(targetPath)
  let preserveAcceptedFile = false
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const [clinicSnapshot, userSnapshot, [metadata], [bytes]] = await Promise.all([
      clinicRef.get(),
      firestore.collection('users').doc(uid).get(),
      storageFile.getMetadata(),
      storageFile.download(),
    ])
    if (!clinicSnapshot.exists || !userSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Clinic registration information was not found.' })
    }
    const contentType = String(metadata?.contentType || '').toLowerCase()
    const size = Number(metadata?.size || 0)
    const allowedPreflightTypes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowedPreflightTypes.includes(contentType)
      || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024
      || Number(file.size) !== size || String(file.type || '').toLowerCase() !== contentType) {
      return res.status(422).json({ success: false, error: 'The uploaded document details are invalid. Please choose the file again.' })
    }

    const visionClient = createVisionClient()
    if (!visionClient) {
      return res.status(503).json({
        success: false,
        error: 'Document name checking is temporarily unavailable. The file was not accepted; please try again shortly.',
      })
    }
    let extractedText = ''
    let ocrConfidence = null
    let comparisons = []
    try {
      const ocr = await getRegistrationDocumentOcr({
        visionClient, bucketName, storagePath, contentType, bytes, uid, docKey,
      })
      extractedText = ocr.extractedText
      ocrConfidence = getVisionWordConfidence(ocr.annotation)
      comparisons = compareRegistrationFields({
        docKey,
        text: extractedText,
        application: clinicSnapshot.data() || {},
        user: userSnapshot.data() || {},
        confidence: ocrConfidence,
      })
    } catch (ocrError) {
      // OCR errors and documents without a labelled name remain eligible for
      // the existing human review path. Only a confident, labelled mismatch
      // blocks the upload.
      console.warn('Clinic registration name preflight needs manual review:', {
        uid,
        docKey,
        error: ocrError?.message || String(ocrError),
      })
    }

    const mismatch = comparisons.find((comparison) => ['registrantName', 'birthDate', 'businessName'].includes(comparison.field)
      && comparison.status === 'mismatch')
    if (mismatch) {
      const error = mismatch.field === 'businessName'
        ? 'Clinic name mismatch: the clinic name on this document does not match the name entered in Step 1. Please upload the correct document.'
        : mismatch.field === 'birthDate'
          ? 'Birth date mismatch: the birth date on this government ID does not match the date entered in Step 1. Please upload the correct document.'
          : 'Registrant name mismatch: the name on this government ID does not match the owner details entered in Step 1. Please upload the correct document.'
      return res.status(422).json({ success: false, error, code: 'REGISTRATION_DOCUMENT_NAME_MISMATCH' })
    }

    await storageFile.copy(acceptedFile)
    const nameComparison = comparisons.find((comparison) => ['registrantName', 'businessName'].includes(comparison.field))
    await clinicRef.collection('documentPreflights').doc(docKey).set({
      accepted: true,
      contentHash: registrationDocumentHash(bytes),
      nameInputsHash: getRegistrationNameInputsHash(clinicSnapshot.data() || {}, userSnapshot.data() || {}),
      contentType,
      size,
      storagePath: targetPath,
      nameMatchPolicyVersion: REGISTRATION_NAME_MATCH_POLICY_VERSION,
      comparisonStatus: nameComparison?.status === 'match' ? 'match' : 'needs_review',
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * DAY_MS),
    })
    preserveAcceptedFile = true
    return res.json({
      success: true,
      data: { accepted: true, comparisonStatus: nameComparison?.status === 'match' ? 'match' : 'needs_review' },
    })
  } catch (error) {
    console.error('Clinic registration name preflight failed:', error?.message || error)
    return res.status(Number(error?.statusCode || 500)).json({
      success: false,
      error: error?.message || 'Could not compare the uploaded document. Please try again.',
    })
  } finally {
    await storageFile.delete({ ignoreNotFound: true }).catch(() => {})
    if (!preserveAcceptedFile) await acceptedFile.delete({ ignoreNotFound: true }).catch(() => {})
  }
})

registerSupplyWorkflow(app, {
  admin, requireAuth, loadUserContext,
  storageBucket: () => firebaseStorageBucket,
  createVisionClient,
  getDocumentOcr: getRegistrationDocumentOcr,
})
registerPharmacyWorkflow(app, { admin, requireAuth, loadUserContext })
registerFinanceWorkflow(app, { admin, requireAuth, loadUserContext })
const refundWorkflow = registerRefundWorkflow(app, {
  admin, requireAuth, loadUserContext, getClinicPoliciesForBranch,
  buildPayMongoHeaders, finalizeCancelledOrder,
})
registerAttendanceManagement(app, { admin, requireAuth, requirePermission, resolveBranchAccess, loadAttendanceSchedule, assertPlanFeature: (...args) => assertClinicPlanFeature(...args) })
registerAttendanceImports(app, { admin, requireAuth, requirePermission, resolveBranchAccess, loadAttendanceSchedule, assertPlanFeature: (...args) => assertClinicPlanFeature(...args) })
registerOrderWorkflow(app, { admin, requireAuth, loadUserContext, buildPayMongoHeaders })
registerPayrollWorkflow(app, { admin, requireAuth, loadUserContext, assertPlanFeature: (...args) => assertClinicPlanFeature(...args) })
registerHrWorkflow(app, { admin, requireAuth, loadUserContext, assertPlanFeature: (...args) => assertClinicPlanFeature(...args), loadAttendanceSchedule })

app.post('/admin/trigger-clinic-registration-verification', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Clinic registration OCR runs automatically after submission. Administrators review the original documents and saved OCR results.',
  })
})

const BOOKING_RESERVATIONS_COLLECTION = 'bookingReservations'
const BOOKING_RESERVATION_TTL_MINUTES = Math.max(5, Number(process.env.BOOKING_RESERVATION_TTL_MINUTES || 15))
const BOOKING_BLOCKING_STATUSES = new Set([
  'unpaid',
  'pending approval',
  'payment pending',
  'awaiting payment',
  'paid - awaiting approval',
  'contract pending',
  'ready to start',
  'checked in',
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

const getFollowUpTimestampMillis = (value) => {
  if (value && typeof value.toDate === 'function') return value.toDate().getTime()
  if (value && Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value) {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const validateFollowUpSource = (source, { customerId, branchId, now = Date.now() } = {}) => {
  if (!source || String(source.customerId || '') !== String(customerId || '')
    || String(source.branchId || '') !== String(branchId || '')
    || normalizeBookingStatus(source.status) !== 'completed') {
    return 'The selected appointment is not eligible for a follow-up.'
  }

  const services = Array.isArray(source.serviceDetails) ? source.serviceDetails : []
  const allowed = Boolean(source.followUpAllowed) || services.some((service) => Boolean(service?.followUpAllowed))
  if (!allowed || source.followUpRecommended !== true) {
    return 'The clinic has not enabled or recommended a follow-up for this appointment.'
  }

  const windowValues = [source.followUpWindowDays, ...services.map((service) => service?.followUpWindowDays)]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
  const windowDays = windowValues.length ? Math.min(...windowValues) : 0
  if (windowDays) {
    const completedAt = getFollowUpTimestampMillis(source.completedAt)
      ?? getFollowUpTimestampMillis(source.workerCompletedAt)
      ?? getFollowUpTimestampMillis(source.date ? `${source.date}T${source.time || '00:00'}+08:00` : null)
    if (completedAt !== null && now > completedAt + windowDays * 24 * 60 * 60 * 1000) {
      return 'The follow-up booking window for this appointment has expired.'
    }
  }

  return ''
}

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
  if (!raw || ['free', 'free-plan', 'freeplan', 'free_plan', 'free-trial', 'trial'].includes(raw)) return ''
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  return raw
}

const PLAN_PRIORITIES = {
  basic: 1,
  premium: 2,
}

const getEffectiveClinicPlan = (clinic = {}) => {
  return subscriptionLifecycle(clinic).plan
}

const PLAN_FEATURES = Object.freeze({
  // Basic is a single-clinic operational plan: bookings, consultations,
  // services/packages, orders, inventory and operational finance.
  basic: new Set(['booking_availability', 'staff_management', 'online_consultations', 'reports']),
  // Workforce management is intentionally a Premium boundary.
  premium: new Set(['booking_availability', 'staff_management', 'online_consultations', 'reports', 'multi_branch', 'hr', 'attendance', 'payroll']),
})

const assertClinicPlanFeature = async (firestore, branchId, feature) => {
  const clinicSnap = await firestore.collection('clinics').doc(String(branchId || '').trim()).get()
  assertWorkflow(clinicSnap.exists, 'Clinic branch not found.', 404)
  const clinic = clinicSnap.data() || {}
  const lifecycle = subscriptionLifecycle(clinic)
  const plan = lifecycle.plan
  assertWorkflow(lifecycle.isOperational, 'This clinic subscription is inactive. Sign in to renew or choose a plan to restore clinic access.', 403)
  assertWorkflow(['basic', 'premium'].includes(plan), 'Choose Free Trial, Basic, or Premium to use clinic operations.', 403)
  const configured = await firestore.collection('planPermissions').doc(plan).get()
  const configuredFeatures = configured.exists && Array.isArray(configured.data()?.permissions)
    ? new Set(configured.data().permissions.map(value => String(value || '').trim()).filter(Boolean))
    : null
  const allowedFeatures = PLAN_FEATURES[plan] || new Set()
  // A persisted plan-permissions document can never widen the hard plan
  // boundary. This protects Basic clinics even when an old document still
  // contains workforce or payroll permissions.
  const features = configuredFeatures?.size
    ? new Set([...allowedFeatures, ...[...configuredFeatures].filter(value => allowedFeatures.has(value))])
    : allowedFeatures
  assertWorkflow(features.has(feature), `This clinic plan does not include ${String(feature || 'this')} access.`, 403)
  return { plan, clinic }
}

const getPlanPriority = (planKey) => PLAN_PRIORITIES[normalizePlanKey(planKey)] ?? 0

const getPlanDurationDays = (planKey, billingCycle = 'month') => {
  const normalizedPlan = normalizePlanKey(planKey)
  if (!['basic', 'premium'].includes(normalizedPlan)) return 0
  const cycle = String(billingCycle || '').trim().toLowerCase()
  if (cycle === 'year' || cycle === 'annual') return 365
  return 30
}

const toDateValue = subscriptionDate

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
  // Clinic registrations persist the owner-facing role as "Clinic Owner".
  // Keep that canonical registration role accepted wherever an owner changes
  // or pays for a subscription; otherwise a newly activated owner is rejected
  // before their plan selection can be evaluated.
  return normalized === 'owner' || normalized === 'clinicowner' || normalized === 'clinicadmin' || normalized === 'clinicadministrator'
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
  const paymentStatus = String(clinicData.paymentStatus || userData.paymentStatus || '').trim().toLowerCase()
  const currentPlan = paymentStatus === 'trial'
    ? 'premium'
    : normalizePlanKey(clinicData.subscriptionPlan || userData.subscriptionPlan || userData.plan)
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
  assertWorkflow(['basic', 'premium'].includes(normalizedTargetPlan), 'Choose Basic or Premium for a paid subscription.', 400)
  const currentPlan = context.currentPlan
  const currentPriority = getPlanPriority(currentPlan)
  const targetPriority = getPlanPriority(normalizedTargetPlan)
  const paymentDate = toDateValue(paidAt) || new Date()
  const currentExpiresAt = context.currentExpiresAt
  const hasActiveCurrentCycle = hasActivePaidCycle({ ...context.userData, ...context.clinicData }, paymentDate)

  if (normalizedTargetPlan === currentPlan && hasActiveCurrentCycle && String(context.clinicData.paymentStatus || context.userData.paymentStatus).toLowerCase() !== 'trial') {
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
    const nextExpiresAt = new Date(applyAt.getTime() + durationDays * DAY_MS)

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
  const nextExpiresAt = new Date(paymentDate.getTime() + durationDays * DAY_MS)
  const nextPaymentStatus = 'paid'

  await updateOwnerSubscriptionDocuments(firestore, ownerUid, {
    subscriptionPlan: normalizedTargetPlan,
    paymentStatus: nextPaymentStatus,
    subscriptionAccessStatus: 'active',
    paymentId: paymentReference || null,
    subscriptionStartedAt: paymentDate,
    subscriptionExpiresAt: nextExpiresAt,
    subscriptionGraceEndsAt: new Date(nextExpiresAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS),
    subscriptionRetentionEndsAt: null,
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

// A new clinic may pay before it has a Firebase account.  Once registration
// creates that account, this endpoint attaches only the matching, verified
// PayMongo payment.  The browser never gets to choose a plan or payment state.
app.post('/subscription/claim-registration-payment', requireAuth, async (req, res) => {
  try {
    const paymentId = String(req.body?.paymentId || '').trim()
    if (!paymentId) return res.status(400).json({ success: false, error: 'Payment reference is required.' })
    const firestore = admin.firestore()
    const [userSnap, clinicSnap, paymentSnap] = await Promise.all([
      firestore.collection('users').doc(req.user.uid).get(),
      firestore.collection('clinics').doc(req.user.uid).get(),
      firestore.collection('planPayments').doc(paymentId).get(),
    ])
    if (!userSnap.exists || !clinicSnap.exists) return res.status(409).json({ success: false, error: 'Create the clinic account before claiming its payment.' })
    if (!paymentSnap.exists) return res.status(404).json({ success: false, error: 'Subscription payment was not found.' })
    const user = userSnap.data() || {}, clinic = clinicSnap.data() || {}, payment = paymentSnap.data() || {}
    const userEmail = String(req.user.email || user.email || '').trim().toLowerCase()
    const payerEmail = String(payment.payerEmail || payment.email || '').trim().toLowerCase()
    const planId = normalizePlanKey(payment.planId || '')
    const paid = String(payment.paymongoStatus || '').trim().toLowerCase() === 'paid'
    if (!userEmail || payerEmail !== userEmail || !paid || !['basic', 'premium'].includes(planId)) {
      return res.status(403).json({ success: false, error: 'This verified payment does not belong to this clinic account.' })
    }
    if (String(clinic.ownerId || req.user.uid) !== req.user.uid) return res.status(403).json({ success: false, error: 'Only the clinic owner can claim this payment.' })
    const claimedBy = String(payment.ownerUid || '').trim()
    if (claimedBy && claimedBy !== req.user.uid) return res.status(409).json({ success: false, error: 'This subscription payment has already been claimed.' })

    const action = await applySubscriptionPaymentForOwner({
      firestore,
      ownerUid: req.user.uid,
      targetPlan: planId,
      paidAt: payment.paymongoPaidAt || payment.createdAt || new Date(),
      paymentReference: payment.paymongoPaymentId || paymentId,
      billingCycle: String(payment.billingCycle || 'month'),
    })
    await paymentSnap.ref.set({ ownerUid: req.user.uid, claimedAt: admin.firestore.FieldValue.serverTimestamp(), claimAction: action.action }, { merge: true })
    return res.json({ success: true, data: { planId, ...action } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to apply the subscription payment.' })
  }
})

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
  const isConsultation = flowType === 'consultation'
  const consultationMode = isConsultation
    ? (String(reservation.consultationMode || '').trim().toLowerCase() === 'on-site' ? 'on-site' : 'online')
    : null
  // Payment is governed only by the clinic-wide Payment Policy. Listing-level
  // installment flags are legacy data and must never change a transaction.
  const installmentsAllowed = false
  // Direct customer bookings are approved by the booking route. Payment still
  // has to be verified before the appointment becomes Scheduled.
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
    ...(isConsultation ? { consultationMode } : {}),
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
    groupBooking: reservation.groupBooking && typeof reservation.groupBooking === 'object' ? reservation.groupBooking : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    reservationId: reservation.id,
  }

  return isConsultation
    ? {
        ...basePayload,
        type: 'Consultation',
        service: consultationMode === 'on-site' ? 'On-site Consultation' : 'Online Consultation',
        services: [consultationMode === 'on-site' ? 'On-site Consultation' : 'Online Consultation'],
        consultationMode,
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

const serializeBackupValue = (value) => {
  if (value instanceof admin.firestore.Timestamp) {
    return { __aestheticCareBackupType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (value instanceof Date) {
    return { __aestheticCareBackupType: 'date', value: value.toISOString() }
  }
  if (Buffer.isBuffer(value)) {
    return { __aestheticCareBackupType: 'buffer', value: value.toString('base64') }
  }
  if (Array.isArray(value)) return value.map(serializeBackupValue)
  if (!value || typeof value !== 'object') return value

  if (value.constructor?.name === 'GeoPoint') {
    return { __aestheticCareBackupType: 'geoPoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (value.constructor?.name === 'DocumentReference' && typeof value.path === 'string') {
    return { __aestheticCareBackupType: 'documentReference', path: value.path }
  }
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeBackupValue(nested)]))
}

const deserializeBackupValue = (value) => {
  if (Array.isArray(value)) return value.map(deserializeBackupValue)
  if (!value || typeof value !== 'object') return value

  const type = value.__aestheticCareBackupType
  if (type === 'timestamp') return new admin.firestore.Timestamp(Number(value.seconds), Number(value.nanoseconds || 0))
  if (type === 'date') return new Date(String(value.value))
  if (type === 'buffer') return Buffer.from(String(value.value || ''), 'base64')
  if (type === 'geoPoint') return new admin.firestore.GeoPoint(Number(value.latitude), Number(value.longitude))
  if (type === 'documentReference') return admin.firestore().doc(String(value.path || ''))

  // Older exports serialized Timestamp's private fields directly.
  if (Number.isInteger(value._seconds) && Number.isInteger(value._nanoseconds)) {
    return new admin.firestore.Timestamp(value._seconds, value._nanoseconds)
  }
  if (value.type === 'firestore/timestamp' && Number.isInteger(Number(value.seconds))) {
    return new admin.firestore.Timestamp(Number(value.seconds), Number(value.nanoseconds || 0))
  }
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deserializeBackupValue(nested)]))
}

const backupRecord = (docSnap) => ({ docId: docSnap.id, data: serializeBackupValue(docSnap.data() || {}) })

const buildBackupPayload = async (firestore, ownerId) => {
  const clinicsSnapshot = await firestore.collection('clinics').where('ownerId', '==', ownerId).get()
  const clinics = clinicsSnapshot.docs.map(backupRecord)
  const branchIds = clinics.map((clinic) => clinic.docId)

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
      snap.forEach((docSnap) => results.push(backupRecord(docSnap)))
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
    formatVersion: 2,
    ownerId,
    generatedAt: new Date().toISOString(),
    owner: serializeBackupValue(ownerData),
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

const generateOwnerBackup = async ({ ownerId, kind = 'manual', triggeredBy = 'system', onStage = () => {} }) => {
  const firestore = admin.firestore()
  onStage('checking Firebase Storage configuration')
  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  if (!bucketName) {
    const error = new Error('Firebase Storage bucket is not configured.')
    error.status = 503
    throw error
  }
  const bucket = admin.storage().bucket(bucketName)
  onStage('collecting clinic records from Firestore')
  const backupPayload = await buildBackupPayload(firestore, ownerId)

  onStage('preparing the backup file')
  const backupJson = JSON.stringify(backupPayload, null, 2)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `backup-${timestamp}.json`
  const storagePath = `backups/${ownerId}/${timestamp}/${fileName}`
  const file = bucket.file(storagePath)
  onStage('uploading the backup file to Firebase Storage')
  await file.save(backupJson, {
    contentType: 'application/json',
    resumable: false,
  })

  onStage('saving backup history')
  const backupDoc = {
    ownerId,
    formatVersion: 2,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'complete',
    size: Buffer.byteLength(backupJson, 'utf8'),
    storagePath,
    fileName,
    kind,
    triggeredBy,
  }
  await firestore.collection('backups').add(backupDoc)
  onStage('applying backup retention')
  await pruneOldBackups(firestore, bucket, ownerId)

  return { storagePath, fileName }
}

// Appointment contract endpoints
const authorizeClinicAction = async (uid, branchId, permission) => {
  const context = await loadUserContext(uid)
  assertWorkflow(await resolveBranchAccess(uid, branchId), 'You cannot manage appointments for this branch.', 403)
  assertWorkflow(context.permissions.has(permission) || context.permissions.has('administrator:full_access'), 'You do not have permission for this action.', 403)
}

// Recheck appointment permission using snapshots from the active transaction.
// This prevents a role or branch assignment revoked during a reschedule from
// remaining authorized through the earlier, request-level check.
const authorizeClinicActionInTransaction = async (tx, uid, branchId, permission) => {
  const firestore = admin.firestore()
  const userRef = firestore.collection('users').doc(uid)
  const branchRef = firestore.collection('clinics').doc(branchId)
  const [userSnap, branchSnap] = await Promise.all([tx.get(userRef), tx.get(branchRef)])
  assertWorkflow(userSnap.exists && branchSnap.exists, 'You cannot manage appointments for this branch.', 403)

  const userData = userSnap.data() || {}
  const branch = branchSnap.data() || {}
  const assignedBranches = new Set([userData.branchId, ...(Array.isArray(userData.branchIds) ? userData.branchIds : [])]
    .map(value => String(value || '').trim()).filter(Boolean))
  assertWorkflow(String(branch.ownerId || '') === uid || assignedBranches.has(branchId), 'You cannot manage appointments for this branch.', 403)

  const rawRole = String(userData.role || '').trim()
  const rawUserType = String(userData.userType || '').trim()
  const compactRole = rawRole.toLowerCase().replace(/[\s_-]+/g, '')
  const compactUserType = rawUserType.toLowerCase().replace(/[\s_-]+/g, '')
  const isStaffAccount = compactUserType === 'staff' || compactUserType === 'employee'
  const legacyClinicAdmin = ['clinicadmin', 'clinicadministrator'].includes(compactRole)
  const ownerByType = !isStaffAccount && (compactUserType === 'owner' || compactRole === 'owner' || compactRole === 'clinicowner')
  const roleKey = ownerByType || (!isStaffAccount && legacyClinicAdmin && String(branch.ownerId || '') === uid)
    ? 'Owner'
    : isStaffAccount
      ? (legacyClinicAdmin ? 'Clinic Admin' : 'Staff')
      : normalizeRoleKey(rawRole || rawUserType)

  const rolePermissions = []
  if (!isStaffAccount && roleKey) {
    const roleSnap = await tx.get(firestore.collection('rolePermissions').doc(roleKey))
    if (roleSnap.exists && Array.isArray(roleSnap.data()?.permissions)) rolePermissions.push(...roleSnap.data().permissions)
  }

  const customRoleIds = [...new Set([
    ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
    userData.customRoleId,
  ].map(value => String(value || '').trim()).filter(Boolean))]
  const customRoleSnaps = await Promise.all(customRoleIds.map(roleId => tx.get(firestore.collection('clinicRoles').doc(roleId))))
  const staffOwnerId = String(userData.organizationOwnerId || branch.ownerId || '').trim()
  const customRolePermissions = customRoleSnaps.flatMap(roleSnap => {
    if (!roleSnap.exists) return []
    const roleData = roleSnap.data() || {}
    if (isStaffAccount && (!staffOwnerId || String(roleData.ownerId || '').trim() !== staffOwnerId)) return []
    return Array.isArray(roleData.permissions) ? expandClinicRolePermissions(roleData.permissions) : []
  })

  const userPermissions = [
    ...(Array.isArray(userData.permissions) ? userData.permissions : []),
    ...(isStaffAccount ? defaultClinicRolePermissions : []),
    ...(!isStaffAccount && Array.isArray(userData.effectivePermissions) ? userData.effectivePermissions : []),
  ]
  const builtInClinicPermissions = roleKey === 'Owner'
    ? [...CLINIC_ADMIN_PERMISSIONS, ...CLINIC_OWNER_ADDITIONAL_PERMISSIONS]
    : roleKey === 'Clinic Admin'
      ? [...CLINIC_ADMIN_PERMISSIONS]
      : []
  const effectivePermissions = builtInClinicPermissions.length
    ? [...builtInClinicPermissions, ...userPermissions, ...rolePermissions, ...customRolePermissions]
      .filter(permissionKey => permissionKey !== 'administrator:full_access')
    : [...userPermissions, ...rolePermissions, ...customRolePermissions]
      .filter(permissionKey => roleKey === 'Superadmin' || permissionKey !== 'administrator:full_access')
  assertWorkflow(effectivePermissions.includes(permission) || effectivePermissions.includes('administrator:full_access'), 'You do not have permission for this action.', 403)
}

// Branch entitlement belongs to the clinic organization, never to an individual
// browser page. Basic clinics retain one active branch; Premium clinics may add
// branches. The new branch inherits its organization's subscription state.
app.post('/owner/branches', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), actorId = req.user.uid, context = await loadUserContext(actorId)
    assertWorkflow(
      context.permissions.has('branches:create') || context.permissions.has('administrator:full_access'),
      'You do not have permission to add a branch.',
      403
    )

    // A delegated staff member may create a branch only for the organization
    // that owns one of their assigned branches. Never use the staff UID as
    // the organization owner ID, otherwise the new branch would be orphaned.
    let ownerId = actorId
    if (context.roleKey !== 'Owner') {
      const assignedBranches = [
        context.userData?.branchId,
        ...(Array.isArray(context.userData?.branchIds) ? context.userData.branchIds : []),
      ].map((value) => String(value || '').trim()).filter(Boolean)
      assertWorkflow(assignedBranches.length, 'Assign this user to a clinic branch before granting branch creation.', 403)
      const assignedClinicSnap = await firestore.collection('clinics').doc(assignedBranches[0]).get()
      const assignedClinic = assignedClinicSnap.exists ? assignedClinicSnap.data() || {} : {}
      ownerId = String(assignedClinic.ownerId || context.userData?.organizationOwnerId || '').trim()
      assertWorkflow(ownerId, 'The assigned branch is not linked to a clinic organization.', 403)
    }
    const input = req.body || {}, branches = (await firestore.collection('clinics').where('ownerId', '==', ownerId).get()).docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    const organization = branches.find(branch => branch.id === ownerId) || branches.find(branch => branch.isMainBranch) || branches[0] || {}
    const organizationClinicName = String(organization.clinicName || organization.clinicBranch || '').trim()
    const plan = getEffectiveClinicPlan(organization)
    const activeBranches = branches.filter(branch => String(branch.status || 'Active').toLowerCase() === 'active')
    assertWorkflow(plan === 'premium', 'Adding another branch requires the Premium subscription.', 403)
    const name = String(input.name || input.clinicBranch || '').trim(), location = String(input.location || input.clinicLocation || '').trim()
    assertWorkflow(name && location, 'Branch name and location are required.', 400)
    const branchRef = firestore.collection('clinics').doc()
    await firestore.runTransaction(async tx => {
      const current = await tx.get(firestore.collection('clinics').where('ownerId', '==', ownerId))
      const currentBranches = current.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      const currentOrganization = currentBranches.find(branch => branch.id === ownerId) || currentBranches.find(branch => branch.isMainBranch) || currentBranches[0] || {}
      const currentPlan = getEffectiveClinicPlan(currentOrganization)
      assertWorkflow(currentPlan === 'premium', 'Adding another branch requires the Premium subscription.', 403)
      // A branch's legal/organizational designation is not changed from this
      // workflow. New branches inherit the organization without becoming a
      // user-selectable "main branch".
      tx.set(branchRef, { clinicBranch: name, clinicName: organizationClinicName || name, clinicLocation: location, clinicLocationLat: String(input.clinicLocationLat || ''), clinicLocationLng: String(input.clinicLocationLng || ''), clinicLocationAddress: String(input.clinicLocationAddress || ''), clinicBarangay: String(input.clinicBarangay || ''), clinicProvince: String(input.clinicProvince || 'Cavite'), clinicPostalCode: String(input.clinicPostalCode || ''), status: 'Active', isPublished: true, ownerId, organizationOwnerId: ownerId, subscriptionPlan: currentPlan, subscriptionExpiresAt: currentOrganization.subscriptionExpiresAt || context.userData.subscriptionExpiresAt || null, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('activities').doc(), { branchId: branchRef.id, ownerId, action: 'branch-created', details: `Created ${name} under the ${currentPlan} organization subscription.`, createdAt: admin.firestore.FieldValue.serverTimestamp() })
    })
    return res.json({ success: true, data: { id: branchRef.id, clinicName: organizationClinicName || name, plan, activeBranchCount: activeBranches.length + 1 } })
  } catch (error) {
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Unable to add branch.' })
  }
})
const sendServiceCode = async ({ email, serviceKey, date, time }) => {
  if (!email) return { skipped: true, reason: 'Missing recipient email for the refreshed service code.' }
  if (!postmarkClient || !senderEmail) return { skipped: true, reason: 'Postmark not configured for the refreshed service code.' }
  return sendPostmarkMessage({ to: email, subject: 'Your individual appointment code', text: `Your AesthetiCare appointment is on ${date} at ${time} (Philippine time). Your private service code is ${serviceKey}. For an on-site appointment, show this code to reception for check-in. For an online consultation, enter it in My Appointments to reveal the Google Meet link when the clinic has added it. The consultation timer starts when the practitioner verifies your presence and starts the consultation. This code applies only to your appointment. Keep it private.` })
}
let runAppointmentPaymentHoldSweep = async () => ({ expired: 0 })
const safelySweepAppointmentPaymentHolds = async () => {
  try { return await runAppointmentPaymentHoldSweep() }
  catch (error) {
    console.error('On-demand appointment hold cleanup failed:', error?.message || error)
    return { expired: 0, failed: true }
  }
}
registerBookingMilestones(app, { admin, requireAuth, authorizeClinicAction, sendServiceCode })
registerSameDayTreatmentClearance(app, { admin, requireAuth })
registerConsultationEvents(app, { admin, requireAuth, authorizeClinicAction })
registerPractitionerTeams(app, { admin, requireAuth, loadUserContext, authorizeClinicAction, getBookingRange, rangesOverlap, createVisionClient, getVisionResponseError, getVisionWordConfidence })
registerConsultationWindows(app, { admin, ready: () => adminReady })
registerBookingBatch(app, { admin, requireAuth, getBookingRange, rangesOverlap, assertClinicPlanFeature, getClinicPoliciesForBranch, getApprovedLeaveForDate, getEffectiveClinicPlan, loadUserContext, reapExpiredAppointmentHolds: safelySweepAppointmentPaymentHolds })
registerSameDayBookings(app, { admin, requireAuth, getBookingRange, rangesOverlap, assertClinicPlanFeature, getClinicPoliciesForBranch, getApprovedLeaveForDate, getEffectiveClinicPlan, loadUserContext, reapExpiredAppointmentHolds: safelySweepAppointmentPaymentHolds })

// Each treatment visit has its own lifecycle. The original appointment is the
// treatment-plan parent; later visits are scheduled explicitly so a missed
// visit never silently consumes the remaining sessions.
app.get('/treatment-sessions', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), branchId = String(req.query.branchId || '').trim()
    if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required.' })
    await authorizeClinicAction(req.user.uid, branchId, 'appointments:view')
    const sessionRows = (await firestore.collection('treatmentSessions').where('branchId', '==', branchId).get()).docs
      .map(snap => ({ id: snap.id, ...(snap.data() || {}) }))
    const planIds = [...new Set(sessionRows.map(session => session.treatmentPlanAppointmentId).filter(Boolean))]
    const planEntries = await Promise.all(planIds.map(async id => [id, (await firestore.collection('appointments').doc(id).get()).data() || {}]))
    const plansById = new Map(planEntries)
    const rows = sessionRows.map(session => {
      const parent = plansById.get(session.treatmentPlanAppointmentId) || {}
      const definition = parent.treatmentPlan?.sessions?.[Number(session.sessionNumber || 1) - 1]
      return {
        ...session,
        practitionerId: parent.assignedPractitionerId || parent.practitionerId || session.practitionerId || '',
        practitionerName: parent.assignedPractitionerName || parent.practitionerName || '',
        planName: parent.treatmentPlan?.planName || parent.service || 'Treatment course',
        serviceName: definition?.serviceName || parent.service || 'Treatment visit',
        stageNumber: Number(definition?.stageNumber || 1),
        stageVisitNumber: Number(definition?.stageVisitNumber || session.sessionNumber || 1),
        minimumGapDays: Math.max(1, Number(definition?.sessionIntervalDays || parent.treatmentPlan?.sessionIntervalDays || 1)),
      }
    })
    return res.json({ success: true, data: rows })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to load treatment sessions.' }) }
})

app.get('/treatment-sessions/:id/audit', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), sessionRef = firestore.collection('treatmentSessions').doc(String(req.params.id || ''))
    const sessionSnap = await sessionRef.get(); assertWorkflow(sessionSnap.exists, 'Treatment session not found.', 404)
    const session = sessionSnap.data() || {}; await authorizeClinicAction(req.user.uid, session.branchId, 'appointments:view')
    const entries = (await firestore.collection('treatmentSessionAudit').where('sessionId', '==', sessionRef.id).get()).docs
      .map(snap => ({ id: snap.id, ...(snap.data() || {}) })).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    return res.json({ success: true, data: entries })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to load treatment-session history.' }) }
})

app.post('/treatment-sessions/:id/schedule', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), ref = firestore.collection('treatmentSessions').doc(String(req.params.id || ''))
    const date = String(req.body?.date || '').trim(), time = String(req.body?.time || '').trim()
    assertWorkflow(/^\d{4}-\d{2}-\d{2}$/.test(date) && parseClockToMinutes(time) !== null, 'Choose a valid session date and time.', 400)
    const result = await firestore.runTransaction(async tx => {
      const snap = await tx.get(ref); assertWorkflow(snap.exists, 'Treatment session not found.', 404)
      const session = snap.data() || {}; await authorizeClinicAction(req.user.uid, session.branchId, 'appointments:update')
      const currentStatus = normalizeBookingStatus(session.status)
      assertWorkflow(['unscheduled', 'reschedule eligible', 'schedule requested', 'reschedule requested'].includes(currentStatus), 'Only an unscheduled, requested, or eligible session can be scheduled.')
      const parentRef = firestore.collection('appointments').doc(session.treatmentPlanAppointmentId); const parent = await tx.get(parentRef)
      assertWorkflow(parent.exists, 'Treatment plan appointment not found.', 404)
      const parentData = parent.data() || {}
      const practitionerId = String(parentData.assignedPractitionerId || parentData.practitionerId || session.practitionerId || '').trim()
      assertWorkflow(practitionerId, 'Assign a lead practitioner to the treatment plan before scheduling its visits.', 400)
      assertWorkflow(!(await getApprovedLeaveForDate(practitionerId, date)), 'The assigned lead practitioner is on approved leave.')
      // Later visits are intentionally not booked in advance. The immediately
      // preceding visit must be resolved before staff can confirm this one.
      const sessionNumber = Number(session.sessionNumber || 1)
      if (sessionNumber > 1) {
        const previous = await tx.get(firestore.collection('treatmentSessions').doc(`${session.treatmentPlanAppointmentId}-${sessionNumber - 1}`))
        assertWorkflow(previous.exists && ['completed', 'forfeited'].includes(normalizeBookingStatus(previous.data()?.status)), 'Complete or resolve the previous treatment session before scheduling this visit.')
      }
      assertWorkflow(!session.earliestScheduleDate || date >= String(session.earliestScheduleDate), `This session is eligible to be scheduled on or after ${session.earliestScheduleDate}.`)
      if (currentStatus === 'reschedule requested') {
        const allowance = Number(session.rescheduleAllowanceSnapshot ?? 1)
        assertWorkflow(Number(session.rescheduleCount || 0) < allowance, 'This treatment session has reached the reschedule limit.', 409)
        if (session.rescheduleCountAtRequest !== undefined) assertWorkflow(Number(session.rescheduleCountAtRequest) === Number(session.rescheduleCount || 0), 'The reschedule allowance changed while this request was pending.', 409)
      }
      const definition = parentData.treatmentPlan?.sessions?.[sessionNumber - 1]
      const requestedRange = getBookingRange({ time, totalServiceDurationMinutes: definition?.durationMinutes || parentData.totalServiceDurationMinutes || 60 })
      const [otherAppointments, otherSessions] = await Promise.all([
        tx.get(firestore.collection('appointments').where('branchId', '==', session.branchId)),
        tx.get(firestore.collection('treatmentSessions').where('branchId', '==', session.branchId)),
      ])
      const conflicts = [...otherAppointments.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) })), ...otherSessions.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) }))]
        .some(item => item.id !== ref.id && item.id !== session.appointmentId && item.appointmentId !== session.appointmentId && item.date === date && appointmentStaffIds(item).includes(practitionerId) && ['scheduled', 'paid', 'checked in', 'ready to start', 'ongoing'].includes(normalizeBookingStatus(item.status)) && (() => { const range = getBookingRange(item); return range && rangesOverlap(requestedRange.start, requestedRange.end, range.start, range.end) })())
      assertWorkflow(!conflicts, 'The practitioner already has an appointment or treatment session at that time.')
      const visitRef = firestore.collection('appointments').doc(session.appointmentId || undefined)
      const preparedVisit = await prepareBooking({ tx, db: firestore, reservation: { ...parentData, selectedServiceIds: definition ? [definition.serviceId] : parentData.selectedServiceIds, customerId: session.customerId, customerEmail: parentData.customerEmail, date, time, endTime: '', practitionerId: practitionerId, assignedPractitionerId: practitionerId, groupBooking: null }, getBookingRange, rangesOverlap, appointmentId: session.appointmentId || null })
      assertWorkflow(Number(parentData.amountPaid || 0) >= Number(parentData.totalAmount || parentData.amount || 0), 'Settle the treatment plan payment before scheduling later visits.')
      const isLaterVisit = sessionNumber > 1
      tx.set(preparedVisit.lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      for (const lock of preparedVisit.customerLocks || []) tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      if (isLaterVisit) tx.set(visitRef, {
        ...parentData, ...preparedVisit.data, date, time, practitionerId: practitionerId, assignedPractitionerId: practitionerId,
        bookingId: '', bookingOrderId: '', groupBookingId: '', groupBooking: null, isGroupRecipient: false, isGroupParent: false, isBookingOrderParent: false, paymentManagedByOrganizer: false,
        treatmentPlanAppointmentId: parentRef.id, treatmentSessionId: ref.id, sessionNumber, treatmentPlan: parentData.treatmentPlan,
        amount: 0, totalAmount: 0, amountPaid: 0, commissionAmount: 0, merchantNetAmount: 0, paymentStatus: 'Paid', paymentCoverage: 'treatment-plan', installmentsAllowed: false, depositPercent: 100,
        contract: parentData.contract, approvalStatus: 'Pending Confirmation', status: 'Scheduled', serviceKey: null, checkedInAt: null, checkedInById: null, workerKeyVerified: false, workerKeyVerifiedAt: null,
        startedAt: null, completedAt: null, workerCompleted: false, workerCompletedAt: null, customerCompleted: false, customerCompletedAt: null, materialsConsumed: false,
        recordedPaymentSessions: [], paymongoCheckoutSessionId: null, paymongoPaymentId: null, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      else tx.update(visitRef, { practitionerId, assignedPractitionerId: practitionerId, treatmentTeam: [], staffingRequirements: preparedVisit.data.staffingRequirements, selectedServiceIds: preparedVisit.data.selectedServiceIds, serviceDetails: preparedVisit.data.serviceDetails, selectedServices: preparedVisit.data.selectedServices, date, time, endTime: preparedVisit.data.endTime, status: 'Scheduled', approvalStatus: 'Pending Confirmation', workerKeyVerified: false, checkedInAt: null, serviceKey: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      const action = currentStatus === 'reschedule requested' ? 'reschedule_request_approved' : currentStatus === 'schedule requested' ? 'schedule_request_approved' : currentStatus === 'reschedule eligible' ? 'rescheduled' : 'scheduled'
      tx.update(ref, { practitionerId, status: 'Schedule Proposed', appointmentId: visitRef.id, date, time, scheduledById: req.user.uid, scheduledAt: admin.firestore.FieldValue.serverTimestamp(), ...(currentStatus === 'reschedule requested' ? { rescheduleCount: Number(session.rescheduleCount || 0) + 1 } : {}), requestedDate: admin.firestore.FieldValue.delete(), requestedTime: admin.firestore.FieldValue.delete(), requestedSlotKey: admin.firestore.FieldValue.delete(), scheduleRequestReason: admin.firestore.FieldValue.delete(), scheduleRequestedAt: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('treatmentSessionAudit').doc(), { sessionId: ref.id, treatmentPlanAppointmentId: session.treatmentPlanAppointmentId, branchId: session.branchId, action, previousStatus: session.status || '', nextStatus: 'Schedule Proposed', date, time, actorId: req.user.uid, actorName: req.user.email || '', createdAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('notifications').doc(), { recipientUserId: session.customerId, branchId: session.branchId, title: `Treatment session ${session.sessionNumber} schedule proposed`, message: `The clinic proposes ${date} at ${time}. Confirm this schedule or request a different time.`, link: '/customer/appointments', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() })
      return { id: ref.id, status: 'Schedule Proposed', date, time }
    })
    return res.json({ success: true, data: result })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to schedule treatment session.' }) }
})

// Customers propose a time; the clinic remains responsible for accepting it.
// This keeps availability and practitioner conflicts authoritative on the API.
const confirmTreatmentSession = async (req, res) => {
  try {
    const firestore = admin.firestore(), ref = firestore.collection('treatmentSessions').doc(req.params.id)
    const delivery = await firestore.runTransaction(async tx => {
      const session = (await tx.get(ref)).data()
      assertWorkflow(session && session.customerId === req.user.uid, 'This treatment session belongs to another customer.', 403)
      if (req.groupPlanId) assertWorkflow(session.treatmentPlanAppointmentId === req.groupPlanId, 'This invitation belongs to another treatment plan.', 403)
      assertWorkflow(session.status === 'Schedule Proposed', 'This session has no schedule awaiting confirmation.')
      const visitRef = firestore.collection('appointments').doc(session.appointmentId), visit = (await tx.get(visitRef)).data()
      assertWorkflow(visit && new Date(`${visit.date}T${visit.time}+08:00`) > new Date(), 'The proposed schedule has passed. Request another date.')
      const serviceKey = String(crypto.randomInt(100000, 1000000)), timestamp = admin.firestore.FieldValue.serverTimestamp()
      tx.update(ref, { status: 'Scheduled', customerConfirmedAt: timestamp, updatedAt: timestamp })
      tx.update(visitRef, { approvalStatus: 'Approved', status: 'Paid', serviceKey, updatedAt: timestamp })
      tx.set(firestore.collection('treatmentSessionAudit').doc(), { sessionId: ref.id, branchId: visit.branchId, actorId: req.user.uid, action: 'schedule_confirmed', previousStatus: 'Schedule Proposed', nextStatus: 'Scheduled', createdAt: timestamp })
      return { email: visit.customerEmail, serviceKey, date: visit.date, time: visit.time }
    })
    await sendServiceCode(delivery).catch(error => console.warn('Session code email failed:', error.message))
    res.json({ success: true, data: { status: 'Scheduled' } })
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
}
app.post('/treatment-sessions/:id/confirm', requireAuth, confirmTreatmentSession)
app.post('/group-consents/:token/sessions/:id/confirm', async (req, res) => {
  try {
    const attendee = await resolveGroupAttendee(req.params.token)
    req.groupPlanId = attendee.invite.appointmentId
    req.user = { uid: attendee.appointment.customerId, email: attendee.appointment.customerEmail }
    return confirmTreatmentSession(req, res)
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
})
const requestTreatmentSessionSchedule = async (req, res) => {
  try {
    const firestore = admin.firestore(), ref = firestore.collection('treatmentSessions').doc(String(req.params.id || ''))
    const date = String(req.body?.date || '').trim(), time = String(req.body?.time || '').trim(), reason = String(req.body?.reason || '').trim()
    assertWorkflow(/^\d{4}-\d{2}-\d{2}$/.test(date) && parseClockToMinutes(time) !== null, 'Choose a valid preferred session date and time.', 400)
    assertWorkflow(reason.length >= 5 && reason.length <= 1000, 'Provide a scheduling reason (5–1000 characters).', 400)
    assertWorkflow(new Date(`${date}T${time}+08:00`) > new Date(), 'Choose a future session date and time.', 400)
    const result = await firestore.runTransaction(async tx => {
      const snap = await tx.get(ref); assertWorkflow(snap.exists, 'Treatment session not found.', 404)
      const session = snap.data() || {}
      assertWorkflow(session.customerId === req.user.uid, 'Only the treatment-plan customer can request this session schedule.', 403)
      if (req.groupPlanId) assertWorkflow(session.treatmentPlanAppointmentId === req.groupPlanId, 'This invitation belongs to another treatment plan.', 403)
      if (session.appointmentId) {
        const visit = (await tx.get(firestore.collection('appointments').doc(session.appointmentId))).data()
        assertWorkflow(visit && !visit.startedAt && !visit.checkedInAt, 'A checked-in or ongoing session cannot be rescheduled.')
      }
      const currentStatus = normalizeBookingStatus(session.status)
      assertWorkflow(['unscheduled', 'scheduled', 'schedule proposed', 'reschedule eligible'].includes(currentStatus), 'This treatment session cannot be changed at its current stage.')
      const sessionNumber = Number(session.sessionNumber || 1)
      if (sessionNumber > 1) {
        const previous = await tx.get(firestore.collection('treatmentSessions').doc(`${session.treatmentPlanAppointmentId}-${sessionNumber - 1}`))
        assertWorkflow(previous.exists && ['completed', 'forfeited'].includes(normalizeBookingStatus(previous.data()?.status)), 'The previous treatment session must be completed or resolved first.')
      }
      assertWorkflow(!session.earliestScheduleDate || date >= String(session.earliestScheduleDate), `This session is eligible to be scheduled on or after ${session.earliestScheduleDate}.`, 400)
      let policy = {}
      if (currentStatus !== 'unscheduled') {
        policy = (await getClinicPoliciesForBranch(firestore, session.branchId)).policy
        assertWorkflow(isReschedulePolicyEnabled(policy), 'This clinic does not currently allow treatment-session reschedule requests.', 403)
        assertWorkflow(Number(session.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy), 'You have reached this clinic\'s reschedule limit for this treatment session.', 403)
      }
      const nextStatus = currentStatus === 'unscheduled' ? 'Schedule Requested' : 'Reschedule Requested'
      tx.update(ref, { status: nextStatus, requestedDate: date, requestedTime: time, scheduleRequestReason: reason, scheduleRequestedAt: admin.firestore.FieldValue.serverTimestamp(), ...(currentStatus === 'unscheduled' ? {} : { rescheduleAllowanceSnapshot: rescheduleAllowanceForPolicy(policy), rescheduleCountAtRequest: Number(session.rescheduleCount || 0) }), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('treatmentSessionAudit').doc(), { sessionId: ref.id, treatmentPlanAppointmentId: session.treatmentPlanAppointmentId, branchId: session.branchId, action: currentStatus === 'unscheduled' ? 'schedule_requested' : 'reschedule_requested', previousStatus: session.status || '', nextStatus, date, time, actorId: req.user.uid, actorName: req.user.email || '', createdAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('notifications').doc(), { recipientUserId: session.practitionerId, branchId: session.branchId, title: `Treatment session ${session.sessionNumber} needs scheduling`, message: `The customer requested ${date} at ${time}. Review and confirm an available time.`, link: '/clinical/treatment-sessions', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() })
      return { id: ref.id, status: nextStatus }
    })
    return res.json({ success: true, data: result })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to request treatment-session scheduling.' }) }
}
app.post('/treatment-sessions/:id/request-schedule', requireAuth, requestTreatmentSessionSchedule)
app.post('/group-consents/:token/sessions/:id/request-schedule', async (req, res) => {
  try {
    const attendee = await resolveGroupAttendee(req.params.token)
    assertWorkflow(attendee.invite.status === 'Completed', 'Complete individual consent first.', 403)
    req.user = { uid: attendee.appointment.customerId, email: attendee.invite.recipientEmail }
    req.groupPlanId = attendee.appointmentId
    return requestTreatmentSessionSchedule(req, res)
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
})

app.post('/treatment-sessions/:id/no-show', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), ref = firestore.collection('treatmentSessions').doc(String(req.params.id || ''))
    const result = await firestore.runTransaction(async tx => {
      const snap = await tx.get(ref); assertWorkflow(snap.exists, 'Treatment session not found.', 404)
      const session = snap.data() || {}; await authorizeClinicAction(req.user.uid, session.branchId, 'appointments:update')
      assertWorkflow(normalizeBookingStatus(session.status) === 'scheduled', 'Only a scheduled session can be marked as a no-show.')
      assertWorkflow(String(session.date || '') <= new Date().toISOString().slice(0, 10), 'A session cannot be marked as a no-show before its date.')
      const { policy } = await getClinicPoliciesForBranch(firestore, session.branchId); const eligible = policy.noShowRescheduleAllowed === true
      const nextStatus = eligible ? 'Reschedule eligible' : 'Forfeited'
      const planRef = firestore.collection('appointments').doc(session.treatmentPlanAppointmentId), plan = (await tx.get(planRef)).data() || {}
      const visitRef = session.appointmentId ? firestore.collection('appointments').doc(session.appointmentId) : null
      const visit = visitRef ? (await tx.get(visitRef)).data() : null
      assertWorkflow(!visit?.checkedInAt && !visit?.startedAt, 'An attendee who checked in cannot be marked absent.')
      const end = new Date(`${session.date}T${session.time}+08:00`).getTime() + Number(visit?.totalServiceDurationMinutes || 60) * 60000
      const configuredGracePeriod = Number(policy.noShowGracePeriodMinutes ?? 15)
      const gracePeriodMinutes = Number.isFinite(configuredGracePeriod) ? Math.max(0, configuredGracePeriod) : 15
      assertWorkflow(Number.isFinite(end) && Date.now() >= end + gracePeriodMinutes * 60000, `Wait until the appointment ends and its ${gracePeriodMinutes}-minute no-show grace period passes before marking a no-show.`)
      tx.update(ref, { status: nextStatus, noShowAt: admin.firestore.FieldValue.serverTimestamp(), noShowMarkedById: req.user.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      if (visitRef) tx.update(visitRef, { status: 'No-show', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      if (!eligible) tx.update(planRef, { treatmentPlan: { ...plan.treatmentPlan, forfeitedSessions: Number(plan.treatmentPlan?.forfeitedSessions || 0) + 1, remainingSessions: Math.max(0, Number(plan.treatmentPlan?.remainingSessions || session.totalSessions) - 1) }, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(firestore.collection('treatmentSessionAudit').doc(), { sessionId: ref.id, treatmentPlanAppointmentId: session.treatmentPlanAppointmentId, branchId: session.branchId, action: 'no_show', previousStatus: session.status || '', nextStatus, actorId: req.user.uid, actorName: req.user.email || '', createdAt: admin.firestore.FieldValue.serverTimestamp() })
      return { status: nextStatus }
    })
    return res.json({ success: true, data: result })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to mark treatment session as no-show.' }) }
})

app.post('/treatment-sessions/:id/complete', requireAuth, async (req, res) => {
  try {
    const session = (await admin.firestore().collection('treatmentSessions').doc(String(req.params.id || '')).get()).data()
    assertWorkflow(session, 'Treatment session not found.', 404)
    await authorizeClinicAction(req.user.uid, session.branchId, 'appointments:update')
    return res.status(409).json({ success: false, error: 'Complete this session through the assigned practitioner appointment queue. Check-in, start, and completion are required.' })
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
})

const subscriptionReminderDependencies = {
  admin, websiteUrl: EMAIL_WEBSITE_URL,
  sendEmail: postmarkClient && senderEmail ? async message => {
    const delivery = await sendPostmarkMessage({ ...message, timeoutMs: 15000 })
    if (delivery.statusCode !== 200) throw new Error('Subscription reminder email was not accepted.')
  } : null,
}
registerSubscriptionReminders(app, subscriptionReminderDependencies)
registerSubscriptionTrial(app, { admin, requireAuth, loadUserContext })

app.get('/auth/profile', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(503).json({ success: false, error: 'Profile service is temporarily unavailable.' })
  }
  try {
    const user = await admin.firestore().collection('users').doc(req.user.uid).get()
    if (!user.exists) return res.status(404).json({ success: false, error: 'User profile not found.' })
    return res.json({ success: true, data: user.data() || {} })
  } catch (error) {
    console.error('Authenticated profile lookup failed:', {
      code: error?.code || null,
      name: error?.name || null,
    })
    return res.status(503).json({ success: false, error: 'Profile service is temporarily unavailable.' })
  }
})

// User profiles may be created by trusted registration flows, so initializing
// this cosmetic one-time notification must not rely on a browser profile write.
// The transaction keeps repeated logins idempotent.
app.post('/auth/ensure-welcome-notification', requireAuth, async (req, res) => {
  try {
    const userRef = admin.firestore().collection('users').doc(req.user.uid)
    const initialized = await admin.firestore().runTransaction(async (tx) => {
      const user = await tx.get(userRef)
      if (!user.exists) return false
      if (user.data()?.welcomeNotificationSent === true) return false
      tx.update(userRef, {
        welcomeNotificationSent: true,
        welcomeNotificationAt: admin.firestore.FieldValue.serverTimestamp(),
        welcomeNotificationRead: false,
        welcomeNotificationDeleted: false,
      })
      return true
    })
    return res.json({ success: true, data: { initialized } })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to initialize the welcome notification.' })
  }
})

app.all('/cron/clinic-registration-ocr', async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret || String(req.get('authorization') || '') !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' })
  }
  const result = await recoverClinicVerificationJobs()
  return res.status(result.ok ? 200 : 503).json({ success: result.ok, ...result })
})

app.all('/cron/appointment-reminders', async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret || String(req.get('authorization') || '') !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized.' })
  try {
    // Run these independently of appointment email failures or an empty list.
    const subscriptions = await sendSubscriptionReminders(subscriptionReminderDependencies)
    let completionReminders = 0
    try {
      completionReminders = await remindPendingAppointmentConfirmations(admin)
    } catch (error) {
      console.warn('Failed to send service completion reminders:', error?.message || error)
    }
    const firestore = admin.firestore(), tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rows = (await firestore.collection('appointments').where('date', '==', tomorrow).get()).docs.map(snap => ({ id: snap.id, ...(snap.data() || {}) }))
      .filter(row => ['scheduled', 'ready to start', 'paid'].includes(normalizeBookingStatus(row.status)))
    await Promise.all(rows.map(async row => {
      const reminderRef = firestore.collection('notifications').doc(`appointment-reminder-${row.id}-${tomorrow}`)
      const existing = await reminderRef.get()
      if (!existing.exists) {
        await reminderRef.set({ recipientUserId: row.customerId, branchId: row.branchId, title: 'Appointment reminder', message: `Reminder: ${row.service || 'your appointment'} is tomorrow at ${row.time || 'the scheduled time'}.`, link: '/customer/appointments', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() })
        if (postmarkClient && senderEmail && row.customerEmail) await postmarkClient.sendEmail({ From: senderEmail, To: row.customerEmail, Subject: 'AesthetiCare appointment reminder', TextBody: `Reminder: your ${row.service || 'appointment'} is tomorrow at ${row.time || 'the scheduled time'}.` })
      }

      const isOnlineConsultation = normalizeBookingStatus(row.type) === 'consultation' && normalizeBookingStatus(row.consultationMode) === 'online'
      const practitionerId = String(row.practitionerId || row.assignedPractitionerId || row.staffId || row.assignedTo || '').trim()
      if (!isOnlineConsultation || !practitionerId) return

      const practitionerReminderRef = firestore.collection('notifications').doc(`online-consultation-practitioner-reminder-${row.id}-${tomorrow}`)
      const practitionerReminder = await practitionerReminderRef.get()
      if (practitionerReminder.exists) return

      const practitionerSnap = await firestore.collection('users').doc(practitionerId).get()
      const practitioner = practitionerSnap.exists ? practitionerSnap.data() || {} : {}
      const clientName = String(row.clientName || row.customerName || row.patientName || 'Customer').trim()
      const consultationName = String(row.service || 'online consultation').trim()
      const schedule = `${row.date || 'tomorrow'}${row.time ? ` at ${row.time}` : ''}`
      const message = `Reminder: ${consultationName} with ${clientName} is scheduled for ${schedule}. Open Online Consultation to prepare or join the call.`
      await practitionerReminderRef.set({
        recipientUserId: practitionerId,
        branchId: row.branchId,
        title: 'Online consultation reminder',
        message,
        link: '/clinical/consultations/online',
        read: false,
        deleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      const practitionerEmail = String(practitioner.email || row.practitionerEmail || '').trim().toLowerCase()
      if (postmarkClient && senderEmail && practitionerEmail) {
        try {
          await postmarkClient.sendEmail({
            From: senderEmail,
            To: practitionerEmail,
            Subject: 'AesthetiCare online consultation reminder',
            TextBody: `${message}\n\nOpen Online Consultation: ${EMAIL_WEBSITE_URL}/clinical/consultations/online`,
          })
        } catch (emailError) {
          console.warn('Failed to email online consultation practitioner reminder:', emailError?.message || emailError)
        }
      }
    }))
    return res.status(subscriptions.failures ? 503 : 200).json({ success: !subscriptions.failures, reminders: rows.length, completionReminders, subscriptions })
  } catch (error) { return res.status(500).json({ success: false, error: 'Unable to send appointment reminders.' }) }
})

// Invoke this protected endpoint every minute from the deployment scheduler.
// Unlike the practitioner-page timer, this remains reliable when no browser is
// open and is the authoritative end of an online consultation's billed window.
app.all('/cron/online-consultation-timeouts', async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret || String(req.get('authorization') || '') !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized.' })
  try {
    const result = await closeExpiredConsultations(admin)
    return res.json({ success: true, ...result })
  } catch (error) { return res.status(500).json({ success: false, error: 'Unable to close overdue online consultations.' }) }
})
registerWalkInBookings(app, {
  admin, requireAuth, authorizeClinicAction, assertClinicPlanFeature,
  getBookingRange, rangesOverlap, getApprovedLeaveForDate, getClinicPoliciesForBranch,
  reapExpiredAppointmentHolds: safelySweepAppointmentPaymentHolds,
  sendBooking: async appointment => {
    if (!appointment.customerEmail || !postmarkClient || !senderEmail) return
    const provisionalTreatment = appointment.sameDayTreatmentStatus === 'pending_clinical_clearance'
    const consentSummary = provisionalTreatment
      ? 'You reviewed and signed the consultation agreement during booking. The treatment agreement will be signed after practitioner clearance.'
      : 'Your treatment agreement was reviewed and signed during booking.'
    await sendPostmarkMessage({
      to: appointment.customerEmail,
      subject: 'Your AesthetiCare walk-in appointment is scheduled',
      text: `Hi ${appointment.customerName},\n\nYour walk-in appointment is scheduled.${appointment.bookingForSomeoneElse ? `\nArranged by: ${appointment.bookedByName}.` : ''}\nService: ${appointment.service}\nWhen: ${appointment.date} at ${appointment.time}\nPractitioner: ${appointment.practitionerName}\n\n${consentSummary} ${provisionalTreatment ? 'This same-day treatment remains provisional until the practitioner clears it after the consultation; payment is not due before clearance.' : 'Payment is still due. After the clinic records your payment, your service code will be sent to this email.'} Bring your service code on the appointment day once it has been issued.`,
    })
  },
})
registerClientDirectory(app, { admin, requireAuth, authorizeClinicAction })
registerWalkInPayments(app, {
  admin, requireAuth, authorizeClinicAction,
  verifyCheckout: async (sessionId, appointmentId, branchId) => {
    assertWorkflow(/^cs_[A-Za-z0-9_-]+$/.test(sessionId), 'A valid checkout session is required.', 400)
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, { headers: buildPayMongoHeaders() })
    const data = (await response.json())?.data?.attributes || {}
    const payment = (data.payments || []).find(entry => entry.attributes?.status === 'paid')
    assertWorkflow(response.ok && payment, 'Payment has not been confirmed.')
    assertWorkflow(data.metadata?.appointmentId === appointmentId && data.metadata?.branchId === branchId && data.metadata?.saleMode === 'appointment', 'This payment belongs to a different appointment.')
    return { amount: Number(payment.attributes.amount) }
  },
  sendReceipt: async (email, receipt) => {
    if (!postmarkClient || !senderEmail) return false
    const pricing = receipt.pricingSnapshot
    const priceLines = pricing
      ? `\nSubtotal: PHP ${Number(pricing.subtotal || 0).toFixed(2)}\n${pricing.vatApplicable ? `VAT (12%): PHP ${Number(pricing.vatAmount || 0).toFixed(2)}` : 'VAT: PHP 0.00'}\nTotal: PHP ${Number(pricing.total ?? receipt.total).toFixed(2)}`
      : `\nAmount paid: PHP ${Number(receipt.total || 0).toFixed(2)}`
    const attachment = createAppointmentPaymentReceiptPdf({ appointment: receipt, payment: receipt, clinicName: receipt.clinicName || 'AesthetiCare clinic' })
    const sameRecipient = String(receipt.customerEmail || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()
    const delivery = await postmarkClient.sendEmail({
      From: senderEmail,
      To: email,
      Subject: sameRecipient ? 'Your walk-in appointment payment receipt and service code' : 'Your walk-in appointment payment receipt',
      TextBody: `Hi ${receipt.payerName || receipt.clientName},\n\nYour payment has been recorded for ${receipt.service}.\nWhen: ${[receipt.date, receipt.time].filter(Boolean).join(' at ')}${priceLines}\n\nYour PDF receipt is attached.${sameRecipient ? `\n\nThe appointment service code is: ${receipt.serviceKey}\nKeep this code private and bring it on the appointment day.` : ''}`,
      Attachments: [attachment],
    })
    if (!sameRecipient && receipt.customerEmail && receipt.serviceKey) {
      try {
        await postmarkClient.sendEmail({
          From: senderEmail,
          To: receipt.customerEmail,
          Subject: 'Your walk-in appointment service code',
          TextBody: `Hi ${receipt.clientName},\n\nYour payment has been recorded for ${receipt.service}. Your service code is ${receipt.serviceKey}. Keep it private and bring it on the appointment day so the practitioner can verify your appointment.`,
        })
      } catch (error) { console.warn('Could not email the walk-in service code:', error?.message || error) }
    }
    return delivery?.ErrorCode === 0
  },
})
registerListingApproval(app, { admin, requireAuth, loadUserContext })

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
    if (appointment.sameDayTreatmentStatus === 'pending_clinical_clearance') return res.status(409).json({ success: false, error: 'The assigned practitioner must clear same-day treatment before its agreement can be prepared.' })
    if (appointment.contract?.status === 'signed' || appointment.startedAt) return res.status(409).json({ success: false, error: 'A signed or started booking contract cannot be replaced.' })
    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const roleKey = String(req.userContext.roleKey || '').trim()
    const assignedBranches = new Set([req.userContext.userData?.branchId, ...(Array.isArray(req.userContext.userData?.branchIds) ? req.userContext.userData.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))
    const canManage =
      roleKey === 'Superadmin' ||
      roleKey === 'Owner' ||
      (assignedBranches.has(String(appointment.branchId || '').trim()) &&
        (req.userContext.permissions.has('appointments:update') || req.userContext.permissions.has('appointments:review')))
    if (!canManage) return res.status(403).json({ success: false, error: 'Forbidden' })

    if (roleKey === 'Owner') {
      const clinic = (await firestore.collection('clinics').doc(appointment.branchId).get()).data() || {}
      if (clinic.ownerId !== req.user.uid && appointment.branchId !== req.user.uid) return res.status(403).json({ success: false, error: 'This booking belongs to another clinic.' })
    }

    const customerEmail = String(appointment.customerEmail || '').trim().toLowerCase()
    const normalizedSigners = Array.isArray(requiredSigners)
      ? requiredSigners.map((signer) => ({ email: String(signer?.email || '').trim().toLowerCase() })).filter((signer) => signer.email)
      : []
    const signers = normalizedSigners.length ? normalizedSigners : (customerEmail ? [{ email: customerEmail }] : [])

    const contractId = `contract-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
    const contract = {
      contractId,
      title: String(title || 'Contract').trim(),
      terms: appointment.contract?.terms || '',
      ...(appointment.contract?.document ? { document: appointment.contract.document } : {}),
      templateUrl: String(templateUrl || '').trim() || null,
      requiredSigners: signers,
      signatures: {},
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.uid || null,
    }

    const currentStatus = normalizeBookingStatus(appointment.status)
    await apptRef.set({ contract, contractRequired: true, status: appointment.approvalStatus === 'Approved' ? 'Contract Pending' : appointment.status, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    return res.json({ success: true, data: { contract } })
  } catch (error) {
    console.error('appointments/:id/contract error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save contract' })
  }
})

app.post('/appointments/:id/contract/upload-signed', requireAuth, async (req, res) => {
  return res.status(409).json({ success: false, error: 'Online booking customers must sign the contract from their account before payment. Walk-in recipients sign through the clinic-assisted contract screen after POS payment.' })
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

registerGoogleConsultations(app, {
  admin, google, requireAuth, authorizeClinicAction, loadUserContext, sendEmail: sendPostmarkMessage,
  config: {
    clientId: googleOauthClientId, clientSecret: googleOauthClientSecret,
    redirectUri: googleOauthRedirectUri,
    encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '',
    frontendUrl: frontendBaseUrl,
  },
})

// Legacy manual creation cannot bypass customer verification or hosting identity.
app.post('/google-meet/create-consultation-link', requireAuth, (req, res) => {
  res.status(410).json({ success: false, error: 'Create the room in Google Meet, then add its link to the appointment in Online Consultations.' })
})

app.patch('/admin/system-admin/:uid/status', requireAuth, requireRole(['superadmin']), requirePermission('system:admins:manage'), async (req, res) => {
  const uid = String(req.params?.uid || '').trim()
  const status = String(req.body?.status || '').trim()
  if (!uid) return res.status(400).json({ success: false, error: 'Admin uid is required' })
  if (uid === req.user.uid) return res.status(403).json({ success: false, error: 'You cannot change your own administrator status' })
  if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ success: false, error: 'Status must be Active or Inactive' })

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
    const inactive = status === 'Inactive'
    const previousStatus = String(userData.status || 'Active')
    const previousArchived = userData.archived === true
    if (inactive) {
      await userRef.set({ status: 'Inactive', archived: true, archivedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      try {
        await admin.auth().updateUser(uid, { disabled: true })
      } catch (authError) {
        await userRef.set({ status: previousStatus, archived: previousArchived, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
        throw authError
      }
    } else {
      await admin.auth().updateUser(uid, { disabled: false })
      try {
        await userRef.set({ status: 'Active', archived: false, archivedAt: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      } catch (firestoreError) {
        await admin.auth().updateUser(uid, { disabled: true }).catch(() => {})
        throw firestoreError
      }
    }
    await writeSystemAdminActivity(req, {
      action: `${inactive ? 'Disabled' : 'Enabled'} system administrator`,
      details: `${inactive ? 'Marked inactive' : 'Marked active'} ${userData.fullName || userData.email || uid}'s administrator account.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })
    return res.json({ success: true, data: { uid, status } })
  } catch (error) {
    console.error('Failed to update system administrator status:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to update administrator status' })
  }
})

app.post('/admin/request-clinic-resubmission', requireAuth, requireRole(['superadmin']), requirePermission('system:clinics:verify'), async (req, res) => {
  const uid = String(req.body?.uid || '').trim()
  const resubmissionReason = String(req.body?.resubmissionReason || '').trim()
  const reviewedBy = String(req.body?.reviewedBy || '').trim() || null

  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })
  if (!resubmissionReason) return res.status(400).json({ success: false, error: 'A resubmission reason is required' })

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(uid)
    const clinicRef = firestore.collection('clinics').doc(uid)
    let userData = {}
    let clinicData = {}
    let recipient = ''
    let applicantName = 'Applicant'
    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    let resubmissionCount = 0
    let lockoutApplied = false
    let lockoutUntil = null

    await firestore.runTransaction(async (transaction) => {
      lockoutApplied = false
      lockoutUntil = null
      const [userSnapshot, clinicSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(clinicRef),
      ])
      if (!userSnapshot.exists || !clinicSnapshot.exists) {
        throw Object.assign(new Error('Clinic registration account was not found.'), { statusCode: 404 })
      }
      userData = userSnapshot.data() || {}
      clinicData = clinicSnapshot.data() || {}
      const approvalStatus = String(clinicData.approvalStatus || '').trim().toLowerCase()
      const userStatus = String(userData.approvalStatus || userData.registrationStatus || userData.status || '').trim().toLowerCase()
      if (approvalStatus.includes('approved') || approvalStatus.includes('rejected')
        || userStatus.includes('approved') || userStatus.includes('rejected') || userStatus === 'pending activation') {
        throw Object.assign(new Error('This clinic registration already has a final decision.'), { statusCode: 409 })
      }
      if (clinicData.resubmissionRequired === true || approvalStatus.includes('pending documents') || userStatus.includes('pending documents')) {
        throw Object.assign(new Error('Replacement documents have already been requested for this registration.'), { statusCode: 409 })
      }
      recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
      applicantName = String(userData.firstName || clinicData.ownerFirstName || '').trim() || 'Applicant'
      resubmissionCount = Number(clinicData.resubmissionCount || 0) + 1
      const submissionPolicyRef = clinicSubmissionPolicyRef(firestore, recipient)
      const policySnapshot = await transaction.get(submissionPolicyRef)
      const policy = policySnapshot.exists ? policySnapshot.data() || {} : {}
      const previousLock = getTimestampDate(policy.lockedUntil)
      const submissionAttemptCount = previousLock && previousLock.getTime() <= Date.now() ? 0 : Math.max(
        Number(policy.submissionAttemptCount || 0),
        Number(clinicData.submissionAttemptCount || 0),
        Number(clinicData.resubmissionCount || 0) + (clinicData.documentsSubmittedAt ? 1 : 0)
      )
      const priorJob = clinicData.verificationJob || {}
      const cancelActiveJob = priorJob.status === 'queued' || priorJob.status === 'processing'
      const cancelledJob = cancelActiveJob ? {
        ...priorJob,
        status: 'cancelled',
        cancelledAt: timestamp,
        updatedAt: timestamp,
        leaseExpiresAt: admin.firestore.FieldValue.delete(),
      } : undefined
      if (submissionAttemptCount >= CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS) {
        lockoutUntil = new Date(Date.now() + CLINIC_REGISTRATION_LOCKOUT_DAYS * DAY_MS)
        lockoutApplied = true
        transaction.set(submissionPolicyRef, {
          email: recipient,
          submissionAttemptCount,
          lockedUntil: admin.firestore.Timestamp.fromDate(lockoutUntil),
          updatedAt: timestamp,
        }, { merge: true })
        transaction.set(userRef, {
          status: 'Pending Documents',
          approvalStatus: 'Pending Documents',
          registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
          registrationLockedUntil: admin.firestore.Timestamp.fromDate(lockoutUntil),
          updatedAt: timestamp,
        }, { merge: true })
        transaction.set(clinicRef, {
          approvalStatus: 'Pending Documents',
          registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
          verificationStatus: 'Resubmission Required',
          registrationLockedUntil: admin.firestore.Timestamp.fromDate(lockoutUntil),
          resubmissionRequired: true,
          ...(cancelledJob ? { verificationJob: cancelledJob } : {}),
          updatedAt: timestamp,
        }, { merge: true })
        return
      }
      transaction.set(userRef, {
        status: 'Pending Documents',
        approvalStatus: 'Pending Documents',
        registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
        resubmissionRequired: true,
        resubmissionReason,
        resubmissionRequestedAt: timestamp,
        reviewedBy,
        updatedAt: timestamp,
      }, { merge: true })
      transaction.set(clinicRef, {
        approvalStatus: 'Pending Documents',
        registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
        verificationStatus: 'Resubmission Required',
        resubmissionRequired: true,
        resubmissionReason,
        resubmissionRequestedAt: timestamp,
        resubmissionCount,
        reviewedBy,
        ...(cancelledJob ? { verificationJob: cancelledJob } : {}),
        submittedDocuments: {},
        documentsSubmittedAt: admin.firestore.FieldValue.delete(),
        expiryHoldDocuments: admin.firestore.FieldValue.delete(),
        expiryResubmissionExpiresAt: admin.firestore.FieldValue.delete(),
        expiryAccountHold: admin.firestore.FieldValue.delete(),
        updatedAt: timestamp,
      }, { merge: true })
      transaction.set(firestore.collection('notifications').doc(), {
        recipientUserId: uid,
        branchId: uid,
        title: 'Clinic registration changes requested',
        message: `Please correct and resubmit your clinic documents. Reason: ${resubmissionReason}`,
        link: '/clinic/register',
        read: false,
        deleted: false,
        createdAt: timestamp,
      })
    })

    if (lockoutApplied) {
      await writeSystemAdminActivity(req, {
        action: 'Locked clinic registration after exhausted submissions',
        module: 'Clinic Verification',
        details: `Clinic registration for ${applicantName} reached the ${CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS}-submission limit. Locked until ${lockoutUntil.toISOString()}.`,
        targetId: uid,
        targetName: applicantName,
      })
      if (recipient && postmarkClient && senderEmail) {
        const lockedMessage = `Your clinic registration has used all ${CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS} document submissions. You may start a new application after ${lockoutUntil.toLocaleDateString('en-PH')}.`
        await sendPostmarkMessage({
          to: recipient,
          from: senderEmail,
          subject: 'AesthetiCare - Clinic Registration Locked',
          text: `Hi ${applicantName},\n\n${lockedMessage}\n\nRegards,\nThe AesthetiCare Team`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>${lockedMessage}</p><p>Regards,<br>The AesthetiCare Team</p></div>`,
        }).catch((emailError) => console.warn('Failed to send clinic registration lockout email:', emailError?.message || emailError))
      }
      return res.json({ success: true, data: { uid, lockedUntil: lockoutUntil.toISOString(), submissionAttemptCount: CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS } })
    }

    await writeSystemAdminActivity(req, {
      action: 'Requested clinic registration resubmission',
      module: 'Clinic Verification',
      details: `Requested corrected documents from ${applicantName}. Reason: ${resubmissionReason}`,
      targetId: uid,
      targetName: applicantName,
    })

    let emailSent = false
    if (recipient && postmarkClient && senderEmail) {
      try {
        const registrationUrl = `${EMAIL_WEBSITE_URL}/clinic/register`
        const subject = 'AesthetiCare - Documents Need Revision'
        const htmlReason = resubmissionReason
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
        await sendPostmarkMessage({
          to: recipient,
          from: senderEmail,
          subject,
          text: `Hi ${applicantName},\n\nYour clinic registration needs revised documents before it can be approved.\n\nReason provided by the system administrator:\n${resubmissionReason}\n\nReturn to your registration, enter the email you used, complete the email verification, and upload the corrected documents:\n${registrationUrl}\n\nRegards,\nThe AesthetiCare Team`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Your clinic registration needs revised documents before it can be approved.</p><p><strong>Reason provided by the system administrator:</strong></p><p>${htmlReason}</p><p>Return to your registration, enter the email you used, complete the email verification, and upload the corrected documents:</p><p><a href="${registrationUrl}">${registrationUrl}</a></p><p>Regards,<br>The AesthetiCare Team</p></div>`,
        })
        emailSent = true
      } catch (emailError) {
        console.warn('Failed to send clinic resubmission email:', emailError?.message || emailError)
      }
    }

    return res.json({ success: true, data: { uid, emailSent, resubmissionCount } })
  } catch (error) {
    console.error('Failed to request clinic document resubmission:', error)
    return res.status(Number(error?.statusCode || 500)).json({ success: false, error: error?.message || 'Failed to request document resubmission' })
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
    const rejectionHistoryRef = firestore.collection('registrationRejectionHistory').doc()
    let userData = {}
    let clinicData = {}
    let recipient = ''
    let applicantName = 'Applicant'
    let lockoutUntil = null
    let rejectionRecorded = false
    await firestore.runTransaction(async (transaction) => {
      rejectionRecorded = false
      const [userSnapshot, clinicSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(clinicRef),
      ])
      userData = userSnapshot.exists ? userSnapshot.data() || {} : {}
      clinicData = clinicSnapshot.exists ? clinicSnapshot.data() || {} : {}
      recipient = String(userData.email || clinicData.email || '').trim().toLowerCase()
      applicantName = [userData.firstName, userData.midName || userData.middleName, userData.lastName, userData.suffix].filter(Boolean).join(' ').trim() || 'Applicant'
      if (!userSnapshot.exists && !clinicSnapshot.exists) return

      const clinicStatus = String(clinicData.approvalStatus || clinicData.registrationStatus || '').trim().toLowerCase()
      const userStatus = String(userData.approvalStatus || userData.registrationStatus || userData.status || '').trim().toLowerCase()
      if (clinicStatus.includes('approved') || userStatus.includes('approved') || userStatus === 'pending activation') {
        throw Object.assign(new Error('This clinic registration is already approved and cannot be rejected.'), { statusCode: 409 })
      }
      if (clinicStatus.includes('rejected') || userStatus.includes('rejected')) return

      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      lockoutUntil = null
      if (recipient) {
        const submissionPolicyRef = clinicSubmissionPolicyRef(firestore, recipient)
        const policySnapshot = await transaction.get(submissionPolicyRef)
        const policy = policySnapshot.exists ? policySnapshot.data() || {} : {}
        const submissionAttemptCount = Math.max(
          Number(policy.submissionAttemptCount || 0),
          Number(clinicData.submissionAttemptCount || 0),
          Number(clinicData.resubmissionCount || 0) + (clinicData.documentsSubmittedAt ? 1 : 0)
        )
        if (submissionAttemptCount >= CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS) {
          lockoutUntil = new Date(Date.now() + CLINIC_REGISTRATION_LOCKOUT_DAYS * DAY_MS)
          transaction.set(submissionPolicyRef, {
            email: recipient,
            submissionAttemptCount,
            lockedUntil: admin.firestore.Timestamp.fromDate(lockoutUntil),
            updatedAt: timestamp,
          }, { merge: true })
        }
      }

      const priorJob = clinicData.verificationJob || {}
      const verificationJob = priorJob.status === 'queued' || priorJob.status === 'processing'
        ? {
            ...priorJob,
            status: 'cancelled',
            cancelledAt: timestamp,
            updatedAt: timestamp,
            leaseExpiresAt: admin.firestore.FieldValue.delete(),
          }
        : undefined
      transaction.set(userRef, {
        status: 'Rejected',
        approvalStatus: 'Rejected',
        registrationStatus: CLINIC_REGISTRATION_STATUS.REJECTED,
        rejectionReason,
        rejectedAt: timestamp,
        reviewedBy,
      }, { merge: true })
      transaction.set(clinicRef, {
        approvalStatus: 'Rejected',
        registrationStatus: CLINIC_REGISTRATION_STATUS.REJECTED,
        verificationStatus: 'Rejected',
        ...(verificationJob ? { verificationJob } : {}),
        rejectionReason,
        rejectedAt: timestamp,
        reviewedBy,
      }, { merge: true })
      transaction.set(rejectionHistoryRef, {
        email: recipient,
        applicantType: 'clinic',
        originalUid: uid,
        applicantName,
        clinicName: clinicData.clinicName || clinicData.companyName || '',
        reason: rejectionReason,
        ...(lockoutUntil ? { registrationLockedUntil: admin.firestore.Timestamp.fromDate(lockoutUntil) } : {}),
        rejectedAt: timestamp,
        reviewedBy,
      })
      rejectionRecorded = true
    })

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

    if (rejectionRecorded) {
      await writeSystemAdminActivity(req, {
        action: 'Rejected clinic registration',
        module: 'Clinic Verification',
        details: `Rejected ${applicantName}'s clinic registration. Reason: ${rejectionReason}`,
        targetId: uid,
        targetName: applicantName,
      })
    }

    let emailSent = false
    if (rejectionRecorded && recipient && postmarkClient && senderEmail) {
      try {
        const registrationUrl = `${EMAIL_WEBSITE_URL}/clinic/register`
        const subject = 'AesthetiCare - Clinic Registration Update'
        const textBody = `Hi ${applicantName},

Your clinic registration was not approved at this time.

Reason provided by the system administrator:
${rejectionReason}

${lockoutUntil
    ? `You have used all ${CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS} document submissions. You may start a new application after ${lockoutUntil.toLocaleDateString('en-PH')}.`
    : `You may correct the information or documents and submit a new clinic registration here:\n${registrationUrl}`}

Please make sure that your details and uploaded documents are complete, valid, and readable before submitting again.

Regards,
The AesthetiCare Team`
        const htmlReason = rejectionReason
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
        const htmlNextStep = lockoutUntil
          ? `<p>You have used all ${CLINIC_DOCUMENT_SUBMISSION_MAX_ATTEMPTS} document submissions. You may start a new application after <strong>${lockoutUntil.toLocaleDateString('en-PH')}</strong>.</p>`
          : `<p>You may correct the information or documents and submit a new clinic registration here: <a href="${registrationUrl}">${registrationUrl}</a></p>`
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${applicantName},</p><p>Your clinic registration was not approved at this time.</p><p><strong>Reason provided by the system administrator:</strong></p><p>${htmlReason}</p>${htmlNextStep}<p>Please make sure that your details and uploaded documents are complete, valid, and readable before submitting again.</p><p>Regards,<br>The AesthetiCare Team</p></div>`
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
    return res.status(Number(error?.statusCode || 500)).json({
      success: false,
      error: error?.message || 'Failed to reject and delete account',
    })
  }
})

// The legacy per-file OCR endpoint used a separate heuristic and could approve
// a clinic without a reviewer decision. Use the tracked registration job above.
app.post('/admin/trigger-ocr', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'The legacy per-file OCR path is disabled. Clinic registration OCR runs automatically after the applicant submits documents.',
  })
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
  if (!SUPPORTED_CLINIC_REGISTRATION_DOCUMENTS.has(docKey)) return res.status(400).json({ success: false, error: 'Unsupported clinic document.' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const historyRef = clinicRef.collection('reviewHistory').doc()
    let allDocumentsMarkedVerified = false
    let expiryHold = false
    let userData = {}

    await firestore.runTransaction(async (transaction) => {
      const [clinicSnap, userSnap] = await Promise.all([transaction.get(clinicRef), transaction.get(userRef)])
      if (!clinicSnap.exists) throw Object.assign(new Error('Clinic registration not found.'), { statusCode: 404 })
      const clinicData = clinicSnap.data() || {}
      userData = userSnap.exists ? userSnap.data() || {} : {}
      const submittedDocs = clinicData.submittedDocuments || {}
      const existing = submittedDocs[docKey]
      if (!existing?.path && !existing?.storagePath && !existing?.url) {
        throw Object.assign(new Error('The submitted clinic document was not found.'), { statusCode: 404 })
      }
      const updatedDocs = {
        ...submittedDocs,
        [docKey]: {
          ...existing,
          verified: true,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedBy: reviewer || req.user?.uid || null,
          rejectionReason: null,
          rejectedAt: null,
        },
      }
      const allKeys = getRegistrationDocumentRequirements('clinic', clinicData)
      allDocumentsMarkedVerified = allKeys.every((key) => Boolean(updatedDocs[key]?.verified))
      expiryHold = Boolean(clinicData.expiryAccountHold) || hasActiveRegistrationExpiryHold(clinicData.verificationResults)
      transaction.set(clinicRef, { submittedDocuments: updatedDocs, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      transaction.set(historyRef, {
        action: 'document-verified',
        docKey,
        reviewer: reviewer || req.user?.uid || null,
        note: note || null,
        clinicApprovalRequired: true,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      })
    })

    await writeSystemAdminActivity(req, {
      action: 'Verified clinic document',
      module: 'Clinic Verification',
      details: `Verified ${docKey} for ${userData.fullName || userData.email || uid}. Clinic registration still requires an explicit administrator approval decision.`,
      targetId: uid,
      targetName: userData.fullName || userData.email || uid,
    })

    return res.json({ success: true, data: { uid, docKey, allDocumentsMarkedVerified, expiryHold, clinicApprovalRequired: true } })
  } catch (error) {
    console.error('document verify error', error)
    return res.status(Number(error?.statusCode || 500)).json({ success: false, error: error?.message || 'Failed to verify document' })
  }
})
app.post('/admin/document/reject', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const { uid, docKey, reviewer, reason } = req.body ?? {}
  if (!uid || !docKey) return res.status(400).json({ success: false, error: 'uid and docKey are required' })
  if (!SUPPORTED_CLINIC_REGISTRATION_DOCUMENTS.has(docKey)) return res.status(400).json({ success: false, error: 'Unsupported clinic document.' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const historyRef = clinicRef.collection('reviewHistory').doc()
    let clinicData = {}
    let userData = {}
    await firestore.runTransaction(async (transaction) => {
      const [clinicSnap, userSnap] = await Promise.all([
        transaction.get(clinicRef),
        transaction.get(userRef),
      ])
      if (!clinicSnap.exists) throw Object.assign(new Error('Clinic registration not found.'), { statusCode: 404 })
      clinicData = clinicSnap.data() || {}
      userData = userSnap.exists ? userSnap.data() || {} : {}
      const approvalStatus = String(clinicData.approvalStatus || '').trim().toLowerCase()
      const userStatus = String(userData.approvalStatus || userData.registrationStatus || userData.status || '').trim().toLowerCase()
      if (approvalStatus.includes('approved') || approvalStatus.includes('rejected')
        || userStatus.includes('approved') || userStatus.includes('rejected') || userStatus === 'pending activation') {
        throw Object.assign(new Error('This clinic registration already has a final decision.'), { statusCode: 409 })
      }
      if (clinicData.resubmissionRequired === true || approvalStatus.includes('pending documents') || userStatus.includes('pending documents')) {
        throw Object.assign(new Error('Replacement documents have already been requested for this registration.'), { statusCode: 409 })
      }

      const submittedDocs = clinicData.submittedDocuments || {}
      const existing = submittedDocs[docKey]
      if (!existing?.path && !existing?.storagePath && !existing?.url) {
        throw Object.assign(new Error('The submitted clinic document was not found.'), { statusCode: 404 })
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      const priorJob = clinicData.verificationJob || {}
      const verificationJob = priorJob.status === 'queued' || priorJob.status === 'processing'
        ? {
            ...priorJob,
            status: 'cancelled',
            cancelledAt: timestamp,
            updatedAt: timestamp,
            leaseExpiresAt: admin.firestore.FieldValue.delete(),
          }
        : undefined
      submittedDocs[docKey] = {
        ...existing,
        verified: false,
        rejectionReason: reason || null,
        rejectedAt: timestamp,
      }
      transaction.set(clinicRef, {
        submittedDocuments: submittedDocs,
        approvalStatus: 'Pending Documents',
        registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
        verificationStatus: 'Resubmission Required',
        ...(verificationJob ? { verificationJob } : {}),
        resubmissionRequired: true,
        resubmissionReason: reason || `Replace the rejected ${registrationDocumentLabel(docKey)} document.`,
      }, { merge: true })
      transaction.set(userRef, {
        status: 'Pending Documents',
        approvalStatus: 'Pending Documents',
        registrationStatus: CLINIC_REGISTRATION_STATUS.RESUBMISSION_REQUIRED,
        resubmissionRequired: true,
        resubmissionReason: reason || `Replace the rejected ${registrationDocumentLabel(docKey)} document.`,
        updatedAt: timestamp,
      }, { merge: true })
      transaction.set(historyRef, { action: 'document-rejected', docKey, reviewer: reviewer || req.user?.uid || null, reason: reason || null, ts: timestamp })
    })
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
    return res.status(Number(error?.statusCode || 500)).json({ success: false, error: error?.message || 'Failed to reject document' })
  }
})

app.post('/admin/clinic/approve', requireAuth, requireRole(['superadmin','admin','reviewer']), requirePermission('system:clinics:verify'), async (req, res) => {
  const { uid, reviewer, note } = req.body ?? {}
  if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })
  try {
    const firestore = admin.firestore()
    const clinicRef = firestore.collection('clinics').doc(uid)
    const userRef = firestore.collection('users').doc(uid)
    const historyRef = clinicRef.collection('reviewHistory').doc()
    let clinicData = {}
    let userData = {}
    await firestore.runTransaction(async (transaction) => {
      const [clinicSnap, userSnap] = await Promise.all([
        transaction.get(clinicRef),
        transaction.get(userRef),
      ])
      if (!clinicSnap.exists) {
        throw Object.assign(new Error('Clinic registration not found.'), { statusCode: 404 })
      }
      clinicData = clinicSnap.data() || {}
      userData = userSnap.exists ? userSnap.data() || {} : {}

      const jobStatus = String(clinicData.verificationJob?.status || '').trim().toLowerCase()
      if (jobStatus === 'queued' || jobStatus === 'processing') {
        throw Object.assign(new Error('OCR is still running. Wait for it to finish before approving this registration.'), { statusCode: 409 })
      }
      const currentApprovalStatus = String(clinicData.approvalStatus || '').trim().toLowerCase()
      const currentUserStatus = String(userData.approvalStatus || userData.registrationStatus || userData.status || '').trim().toLowerCase()
      if (currentApprovalStatus.includes('approved') || currentApprovalStatus.includes('rejected')
        || currentUserStatus.includes('approved') || currentUserStatus.includes('rejected') || currentUserStatus === 'pending activation') {
        throw Object.assign(new Error('This clinic registration already has a final decision.'), { statusCode: 409 })
      }
      if (clinicData.resubmissionRequired === true || currentApprovalStatus.includes('pending documents') || currentUserStatus.includes('pending documents')) {
        throw Object.assign(new Error('Replacement documents are required before this clinic registration can be approved.'), { statusCode: 409 })
      }

      const submittedDocuments = clinicData.submittedDocuments || {}
      const missingDocuments = getRegistrationDocumentRequirements('clinic', clinicData)
        .filter((docKey) => !submittedDocuments[docKey]?.url && !submittedDocuments[docKey]?.path && !submittedDocuments[docKey]?.storagePath)
      if (missingDocuments.length) {
        throw Object.assign(new Error('Cannot approve a clinic with missing required documents.'), { statusCode: 409, missingDocuments })
      }
      const expiryHold = Boolean(clinicData.expiryAccountHold) || hasActiveRegistrationExpiryHold(clinicData.verificationResults)
      if (expiryHold) {
        throw Object.assign(new Error(`This registration requires resubmission because an expiry-dated document has ${REGISTRATION_EXPIRY_HOLD_DAYS} or fewer calendar days remaining. Request a replacement document before approving.`), { statusCode: 409 })
      }

      transaction.set(clinicRef, {
        approvalStatus: 'Approved',
        registrationStatus: CLINIC_REGISTRATION_STATUS.APPROVED,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: reviewer || req.user?.uid || null,
        resubmissionRequired: false,
        resubmissionReason: admin.firestore.FieldValue.delete(),
        clinicSetupRequired: true,
      }, { merge: true })
      transaction.set(userRef, {
        status: 'Pending Activation',
        registrationStatus: CLINIC_REGISTRATION_STATUS.APPROVED,
        clinicSetupRequired: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
      transaction.set(historyRef, {
        action: 'clinic-approved',
        reviewer: reviewer || req.user?.uid || null,
        note: note || null,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      })
    })
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
        const loginUrl = `${EMAIL_WEBSITE_URL}/login`
        const subject = 'Welcome to AesthetiCare — Your Clinic is Approved'
        const textBody = `Hi ${String(userData.firstName || '').trim() || 'User'},\n\nYour clinic registration has been approved. Please use the activation link in the separate Activate your AesthetiCare account email before logging in.\n\nThank you for joining AesthetiCare.`
        const htmlBody = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2a1408;"><p>Hi ${String(userData.firstName || '').trim() || 'User'},</p><p>Your clinic registration has been <strong>approved</strong>.</p><p>Please use the activation link in the separate <strong>Activate your AesthetiCare account</strong> email before logging in.</p><p>Thank you for joining AesthetiCare.</p></div>`
        await sendPostmarkMessage({ to: recipient, from: senderEmail, subject, text: textBody, html: htmlBody })
        await createAccountActivation({
          firestore,
          uid,
          email: recipient,
          name: userData.fullName || userData.firstName || 'Clinic owner',
          req,
        })
      } catch (emailErr) {
        console.warn('Failed to send clinic welcome email (manual approve):', emailErr?.message || emailErr)
      }
    }

    return res.json({ success: true, data: { uid, approved: true } })
  } catch (error) {
    console.error('clinic approve error', error)
    return res.status(Number(error?.statusCode || 500)).json({
      success: false,
      error: error?.message || 'Failed to approve clinic',
      ...(Array.isArray(error?.missingDocuments) ? { missingDocuments: error.missingDocuments } : {}),
    })
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
  }
  const normalizedPurpose = purposeMap[String(purpose || '').trim().toLowerCase()]

  if (!normalizedEmail || !EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email is required.' })
  }
  if (!normalizedPurpose) {
    return res.status(400).json({ success: false, error: 'A valid registration type is required.' })
  }

  try {
    if (normalizedPurpose === CLINIC_REGISTRATION_OTP_PURPOSE) {
      const lockedUntil = await getClinicSubmissionLock(normalizedEmail)
      if (lockedUntil) return res.status(429).json(clinicSubmissionLockPayload(lockedUntil))
    }
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

const registrationText = (value, maxLength = 160) => String(value ?? '').trim().slice(0, maxLength)
const registrationDate = (value) => {
  const raw = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : date
}
const isCaviteRegistrationLocation = (clinicInput, latitude, longitude) => {
  const province = registrationText(clinicInput?.clinicProvince, 120).toLowerCase()
  return /\bcavite\b/.test(province)
    && latitude >= 13.679 && latitude <= 14.518
    && longitude >= 120.559 && longitude <= 121.255
}
const isAdultRegistrationDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return false
  const today = new Date()
  let age = today.getUTCFullYear() - date.getUTCFullYear()
  if (today.getUTCMonth() < date.getUTCMonth()
    || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())) age -= 1
  return age >= 18
}
const normalizedRegistrationRole = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
const trustedRegistrationProfileResponse = async (uid) => {
  const firestore = admin.firestore()
  const [userSnap, clinicSnap] = await Promise.all([
    firestore.collection('users').doc(uid).get(),
    firestore.collection('clinics').doc(uid).get(),
  ])
  if (!userSnap.exists) return { exists: false }
  const userData = userSnap.data() || {}
  const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {}
  if (!['clinicowner', 'clinicadmin', 'owner'].includes(normalizedRegistrationRole(userData.role || userData.userType))) {
    const error = new Error('This account has no clinic registration to resume.')
    error.statusCode = 404
    throw error
  }
  const userStatus = String(userData.status || '').trim().toLowerCase()
  const clinicStatus = String(clinicData.approvalStatus || '').trim().toLowerCase()
  const hasSubmittedDocs = Boolean(clinicData.documentsSubmittedAt)
    || Boolean(clinicData.submittedDocuments && Object.keys(clinicData.submittedDocuments).length)
  const isActive = userStatus === 'active' || clinicStatus === 'approved' || clinicData.isPublished === true
  const resumeStep = isActive ? 'active'
    : !clinicSnap.exists ? 1
      : hasSubmittedDocs || userStatus.includes('pending approval') || clinicStatus.includes('pending approval') ? 4
        : userData.emailVerified === true ? 3 : 2
  const safeDate = (value) => {
    if (!value) return null
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return {
    exists: true,
    uid,
    resumeStep,
    profile: {
      firstName: userData.firstName || '',
      midName: userData.midName || '',
      lastName: userData.lastName || '',
      suffix: userData.suffix || '',
      birthDate: safeDate(userData.birthDate),
      email: userData.email || '',
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
      clinicBuildingNumber: clinicData.clinicBuildingNumber || '',
      clinicStreetName: clinicData.clinicStreetName || '',
      clinicBarangay: clinicData.clinicBarangay || '',
      clinicProvince: clinicData.clinicProvince || '',
      clinicPostalCode: clinicData.clinicPostalCode || '',
      subscriptionPlan: clinicData.subscriptionPlan || userData.subscriptionPlan || '',
      paymentStatus: clinicData.paymentStatus || userData.paymentStatus || '',
      paymentId: clinicData.paymentId || userData.paymentId || '',
      permitHolderIsRegistrant: typeof clinicData.permitHolderIsRegistrant === 'boolean' ? clinicData.permitHolderIsRegistrant : null,
      permitHolderName: clinicData.permitHolderName || '',
      permitHolderRelationship: clinicData.permitHolderRelationship || '',
      submittedDocuments: clinicData.submittedDocuments || {},
      draftDocuments: clinicData.draftDocuments || {},
      expiryHoldDocuments: clinicData.expiryHoldDocuments || [],
      expiryResubmissionExpiresAt: safeDate(clinicData.expiryResubmissionExpiresAt),
      resubmissionReason: clinicData.resubmissionReason || '',
      status: userData.status || '',
      approvalStatus: clinicData.approvalStatus || '',
    },
  }
}

const clinicNameMatchesInSnapshot = (snapshot, clinicInput) => {
  const clinics = snapshot.docs.map((clinicDoc) => {
    const clinic = clinicDoc.data() || {}
    return {
      ...clinic,
      clinicName: clinic.clinicName || clinic.businessName || clinic.companyName || clinic.organizationName,
    }
  })
  return findClinicNameMatches(clinics, clinicInput).sameName
}

const hasRegisteredClinicName = async (transaction, firestore, clinicInput) => {
  // Check source clinic records instead of publicClinics. Public projections
  // can lag or be missing, and a registration must not bypass uniqueness when
  // that happens. The transaction makes the check authoritative at creation.
  const snapshot = await transaction.get(firestore.collection('clinics'))
  return clinicNameMatchesInSnapshot(snapshot, clinicInput)
}

const PUBLIC_SUBSCRIPTION_FIELDS = [
  'subscriptionPlan', 'plan', 'selectedPlan', 'paymentStatus',
  'subscriptionAccessStatus', 'subscriptionStatus', 'subscriptionExpiresAt',
  'subscriptionTrialEndsAt', 'subscriptionGraceEndsAt', 'gracePeriodEndDate',
]

const publicClinicProfile = (clinicId, clinicData, ownerData = {}) => {
  const ownerId = String(clinicData?.ownerId || clinicData?.organizationOwnerId || clinicId || '').trim()
  const organizationOwnerId = String(clinicData?.organizationOwnerId || ownerId).trim()
  const clinicSubscription = subscriptionLifecycle(clinicData)
  const ownerSubscription = subscriptionLifecycle(ownerData)
  const subscriptionSource = ownerSubscription.isOperational && !clinicSubscription.isOperational
    ? ownerData
    : clinicData
  const subscriptionFields = Object.fromEntries(PUBLIC_SUBSCRIPTION_FIELDS
    .filter((field) => subscriptionSource?.[field] !== undefined)
    .map((field) => [field, subscriptionSource[field]]))
  const normalizedClinic = {
    ...clinicData,
    ...subscriptionFields,
    ownerId,
    organizationOwnerId,
    clinicName: clinicData?.clinicName || clinicData?.businessName || clinicData?.companyName || clinicData?.clinicBranch || '',
  }
  // Preserve the existing public eligibility rule: clinics must finish the
  // owner onboarding profile before customers can discover them.
  if (!normalizedClinic.clinicSetupCompletedAt) return null
  if (!isClinicCustomerDiscoverable(normalizedClinic)) return null
  const profile = publicClinicProjection.projectPublicClinic(normalizedClinic)
  if (!isPublicClinicCustomerDiscoverable(profile)) return null
  return { id: clinicId, ...profile }
}

// Public discovery reads the clinic source of truth and returns only the
// allowlisted public profile. This also keeps discovery working while the
// asynchronous publicClinics projection is being repaired or caught up.
app.get('/public/clinics', async (_req, res) => {
  try {
    const firestore = admin.firestore()
    const snapshot = await firestore.collection('clinics').where('isPublished', '==', true).get()
    const sourceClinics = snapshot.docs.map((clinicDoc) => ({ id: clinicDoc.id, data: clinicDoc.data() || {} }))
    const ownerIds = [...new Set(sourceClinics
      .map(({ id, data }) => String(data.ownerId || data.organizationOwnerId || id).trim())
      .filter(Boolean))]
    const ownerSnapshots = await Promise.all(ownerIds.map((ownerId) => firestore.collection('users').doc(ownerId).get()))
    const ownersById = new Map(ownerSnapshots.map((ownerSnapshot) => [ownerSnapshot.id, ownerSnapshot.exists ? ownerSnapshot.data() || {} : {}]))
    const clinics = sourceClinics
      .map(({ id, data }) => publicClinicProfile(id, data, ownersById.get(String(data.ownerId || data.organizationOwnerId || id).trim()) || {}))
      .filter(Boolean)
    const serviceNamesByBranch = new Map()
    const clinicIds = clinics.map((clinic) => clinic.id)
    for (let offset = 0; offset < clinicIds.length; offset += 10) {
      const branchIds = clinicIds.slice(offset, offset + 10)
      const postsSnapshot = await firestore.collection('productServicePosts')
        .where('branchId', 'in', branchIds)
        .get()
      postsSnapshot.forEach((postSnapshot) => {
        const post = postSnapshot.data() || {}
        if (!isCustomerCareListing(post)) return
        const serviceName = getCustomerCareListingName(post)
        const branchId = String(post.branchId || '').trim()
        if (!branchId || !serviceName) return
        if (!serviceNamesByBranch.has(branchId)) serviceNamesByBranch.set(branchId, new Set())
        serviceNamesByBranch.get(branchId).add(serviceName)
      })
    }
    const clinicsWithServices = clinics.map((clinic) => {
      const listedServices = Array.from(serviceNamesByBranch.get(clinic.id) || [])
      return listedServices.length ? { ...clinic, services: listedServices } : clinic
    })
    return res.json({ success: true, data: { clinics: clinicsWithServices } })
  } catch (error) {
    console.error('Public clinic discovery failed:', error?.code || error?.message || error)
    return res.status(500).json({ success: false, error: 'Unable to load clinics right now.' })
  }
})

app.post('/public/clinics/check-name', async (req, res) => {
  const clinicName = registrationText(req.body?.clinicName, 160)
  if (clinicName.length < 3) {
    return res.status(400).json({ success: false, error: 'Enter at least 3 characters to check this name.' })
  }
  try {
    const snapshot = await admin.firestore().collection('clinics').get()
    const sameName = clinicNameMatchesInSnapshot(snapshot, { clinicName })
    return res.json({ success: true, data: { sameName, available: !sameName } })
  } catch (error) {
    console.error('Clinic name availability check failed:', error?.code || error?.message || error)
    return res.status(500).json({ success: false, error: 'Unable to check clinic name right now.' })
  }
})

app.get('/public/clinics/:branchId/profile', async (req, res) => {
  const branchId = String(req.params?.branchId || '').trim()
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(branchId)) {
    return res.status(400).json({ success: false, error: 'A valid clinic branch is required.' })
  }
  try {
    const firestore = admin.firestore()
    const clinicSnap = await firestore.collection('clinics').doc(branchId).get()
    const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {}
    const ownerId = String(clinicData.ownerId || clinicData.organizationOwnerId || branchId).trim()
    const ownerSnap = ownerId ? await firestore.collection('users').doc(ownerId).get() : null
    const clinic = clinicSnap.exists
      ? publicClinicProfile(branchId, clinicData, ownerSnap?.exists ? ownerSnap.data() || {} : {})
      : null
    if (!clinic) return res.status(404).json({ success: false, error: 'Center unavailable.' })
    return res.json({ success: true, data: { clinic } })
  } catch (error) {
    console.error('Public clinic profile load failed:', { branchId, code: error?.code || null, message: error?.message || String(error) })
    return res.status(500).json({ success: false, error: 'Unable to load this clinic right now.' })
  }
})

app.post('/auth/create-registration-profile', requireAuth, async (req, res) => {
  try {
    const uid = String(req.user?.uid || '').trim()
    const email = String(req.user?.email || '').trim().toLowerCase()
    const accountType = String(req.body?.accountType || '').trim().toLowerCase()
    if (!uid || !email || !EMAIL_ADDRESS_REGEX.test(email) || !['clinic', 'customer'].includes(accountType)) {
      return res.status(400).json({ success: false, error: 'A valid signed-in registration account is required.' })
    }

    const authUser = await admin.auth().getUser(uid)
    if (String(authUser.email || '').trim().toLowerCase() !== email) {
      return res.status(403).json({ success: false, error: 'The signed-in email does not match this account.' })
    }
    const profileInput = req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : {}
    const birthDate = registrationDate(profileInput.birthDate)
    if (!registrationText(profileInput.firstName, 80) || !registrationText(profileInput.lastName, 80)
      || !birthDate || !isAdultRegistrationDate(birthDate)) {
      return res.status(400).json({ success: false, error: 'Enter your name and a valid birth date. Applicants must be at least 18.' })
    }
    const contactNumber = registrationText(profileInput.contactNumber, 32)
    if (!/^(?:\+?63)?9\d{9}$/.test(contactNumber.replace(/[\s()-]/g, ''))) {
      return res.status(400).json({ success: false, error: 'Enter a valid Philippine mobile number.' })
    }

    const profileBase = {
      firstName: registrationText(profileInput.firstName, 80),
      midName: registrationText(profileInput.midName, 80),
      suffix: registrationText(profileInput.suffix, 24),
      lastName: registrationText(profileInput.lastName, 80),
      birthDate: admin.firestore.Timestamp.fromDate(birthDate),
      email,
      contactNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(uid)
    const clinicRef = firestore.collection('clinics').doc(uid)
    const result = await firestore.runTransaction(async (transaction) => {
      const [userSnap, clinicSnap] = await Promise.all([transaction.get(userRef), transaction.get(clinicRef)])
      if (userSnap.exists) {
        const userData = userSnap.data() || {}
        const role = normalizedRegistrationRole(userData.role || userData.userType)
        const storedEmail = String(userData.email || '').trim().toLowerCase()
        if (storedEmail && storedEmail !== email) return { error: 'This account cannot start this registration type.' }
        if (accountType === 'customer' && role === 'customer') return { created: false }
        if (accountType === 'clinic' && ['clinicowner', 'clinicadmin', 'owner'].includes(role)) {
          if (clinicSnap.exists) return { created: false }
          const clinicInput = req.body?.clinic && typeof req.body.clinic === 'object' ? req.body.clinic : {}
          const latitude = Number(clinicInput.clinicLocationLat)
          const longitude = Number(clinicInput.clinicLocationLng)
          if (!registrationText(clinicInput.clinicName, 160) || !registrationText(clinicInput.clinicLocation, 100)
            || !Number.isFinite(latitude) || !Number.isFinite(longitude)
            || !isCaviteRegistrationLocation(clinicInput, latitude, longitude)) {
            return { error: 'Enter the clinic name and a valid pinned location within Cavite.' }
          }
          if (await hasRegisteredClinicName(transaction, firestore, clinicInput)) {
            return { error: 'A clinic with this name is already registered. Choose a different clinic name.' }
          }
          const emailVerified = userData.emailVerified === true
          const pendingStatus = emailVerified ? 'Pending Document Submission' : 'Pending OTP Verification'
          transaction.create(clinicRef, {
            clinicName: registrationText(clinicInput.clinicName, 160),
            clinicLocation: registrationText(clinicInput.clinicLocation, 100),
            clinicLocationLat: String(latitude),
            clinicLocationLng: String(longitude),
            clinicLocationAddress: registrationText(clinicInput.clinicLocationAddress, 300),
            clinicBuildingNumber: registrationText(clinicInput.clinicBuildingNumber, 80),
            clinicStreetName: registrationText(clinicInput.clinicStreetName, 120),
            clinicBarangay: registrationText(clinicInput.clinicBarangay, 120),
            clinicProvince: registrationText(clinicInput.clinicProvince, 120),
            clinicPostalCode: registrationText(clinicInput.clinicPostalCode, 20),
            authorizedRepPosition: registrationText(clinicInput.authorizedRepPosition, 100),
            companyName: registrationText(clinicInput.companyName, 160),
            companyType: registrationText(clinicInput.companyType, 100),
            clinicBranch: 'Main Branch',
            ownerId: uid,
            isMainBranch: true,
            branchAdminId: uid,
            branchAdminName: `${profileBase.firstName} ${profileBase.lastName}`.trim(),
            approvalStatus: pendingStatus,
            registrationStatus: pendingStatus,
            subscriptionAccessStatus: 'unsubscribed',
            isPublished: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          transaction.update(userRef, {
            firstName: profileBase.firstName,
            midName: profileBase.midName,
            suffix: profileBase.suffix,
            lastName: profileBase.lastName,
            birthDate: profileBase.birthDate,
            email,
            contactNumber: profileBase.contactNumber,
            authorizedRepPosition: registrationText(clinicInput.authorizedRepPosition, 100),
            companyName: registrationText(clinicInput.companyName || clinicInput.clinicName, 160),
            companyType: registrationText(clinicInput.companyType, 100),
            branchId: uid,
            clinicBranch: 'Main Branch',
            status: pendingStatus,
            registrationStatus: pendingStatus,
            subscriptionAccessStatus: 'unsubscribed',
            subscriptionPlan: admin.firestore.FieldValue.delete(),
            paymentStatus: admin.firestore.FieldValue.delete(),
            subscriptionExpiresAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          return { created: true, repaired: true }
        }
        return { error: 'This account cannot start this registration type.' }
      }
      if (clinicSnap.exists) return { error: 'This registration could not be started. Please contact support.' }

      if (accountType === 'customer') {
        const addressInput = req.body?.profile || {}
        const addressLat = addressInput.addressLat === '' || addressInput.addressLat == null ? null : Number(addressInput.addressLat)
        const addressLng = addressInput.addressLng === '' || addressInput.addressLng == null ? null : Number(addressInput.addressLng)
        const hasAddressCoordinates = addressLat !== null || addressLng !== null
        if (hasAddressCoordinates && (!Number.isFinite(addressLat) || !Number.isFinite(addressLng)
          || addressLat < 4.5 || addressLat > 21.5 || addressLng < 116 || addressLng > 127)) {
          return { error: 'Choose a valid address location in the Philippines.' }
        }
        transaction.create(userRef, {
          ...profileBase,
          contactNumber: `+63${contactNumber.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '')}`,
          address: registrationText(addressInput.address, 300),
          addressBuildingNumber: registrationText(addressInput.addressBuildingNumber, 80),
          addressStreetName: registrationText(addressInput.addressStreetName, 120),
          addressStreet: registrationText(addressInput.addressStreet, 200),
          addressBarangay: registrationText(addressInput.addressBarangay, 120),
          addressCity: registrationText(addressInput.addressCity, 120),
          addressProvince: registrationText(addressInput.addressProvince, 120),
          addressPostalCode: registrationText(addressInput.addressPostalCode, 20),
          addressLat: hasAddressCoordinates ? addressLat : '',
          addressLng: hasAddressCoordinates ? addressLng : '',
          role: 'Customer',
          status: 'Pending',
          emailVerified: false,
        })
        return { created: true }
      }

      const clinicInput = req.body?.clinic && typeof req.body.clinic === 'object' ? req.body.clinic : {}
      const latitude = Number(clinicInput.clinicLocationLat)
      const longitude = Number(clinicInput.clinicLocationLng)
      if (!registrationText(clinicInput.clinicName, 160) || !registrationText(clinicInput.clinicLocation, 100)
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || !isCaviteRegistrationLocation(clinicInput, latitude, longitude)) {
        return { error: 'Enter the clinic name and a valid pinned location within Cavite.' }
      }
      if (await hasRegisteredClinicName(transaction, firestore, clinicInput)) {
        return { error: 'A clinic with this name is already registered. Choose a different clinic name.' }
      }
      const companyName = registrationText(clinicInput.companyName || clinicInput.clinicName, 160)
      transaction.create(userRef, {
        ...profileBase,
        authorizedRepPosition: registrationText(clinicInput.authorizedRepPosition, 100),
        companyName,
        companyType: registrationText(clinicInput.companyType, 100),
        branchId: uid,
        clinicBranch: 'Main Branch',
        role: 'Clinic Owner',
        userType: 'Owner',
        status: 'Pending OTP Verification',
        registrationStatus: 'Pending OTP Verification',
        emailVerified: false,
        subscriptionAccessStatus: 'unsubscribed',
      })
      transaction.create(clinicRef, {
        clinicName: registrationText(clinicInput.clinicName, 160),
        clinicLocation: registrationText(clinicInput.clinicLocation, 100),
        clinicLocationLat: String(latitude),
        clinicLocationLng: String(longitude),
        clinicLocationAddress: registrationText(clinicInput.clinicLocationAddress, 300),
        clinicBuildingNumber: registrationText(clinicInput.clinicBuildingNumber, 80),
        clinicStreetName: registrationText(clinicInput.clinicStreetName, 120),
        clinicBarangay: registrationText(clinicInput.clinicBarangay, 120),
        clinicProvince: registrationText(clinicInput.clinicProvince, 120),
        clinicPostalCode: registrationText(clinicInput.clinicPostalCode, 20),
        authorizedRepPosition: registrationText(clinicInput.authorizedRepPosition, 100),
        companyName,
        companyType: registrationText(clinicInput.companyType, 100),
        clinicBranch: 'Main Branch',
        ownerId: uid,
        isMainBranch: true,
        branchAdminId: uid,
        branchAdminName: `${profileBase.firstName} ${profileBase.lastName}`.trim(),
        approvalStatus: 'Pending OTP Verification',
        registrationStatus: 'Pending OTP Verification',
        subscriptionAccessStatus: 'unsubscribed',
        isPublished: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return { created: true }
    })
    if (result.error) return res.status(409).json({ success: false, error: result.error })
    return res.status(result.created ? 201 : 200).json({ success: true, data: { uid, created: result.created } })
  } catch (error) {
    console.error('Trusted registration profile creation failed:', error?.code || error?.message || error)
    return res.status(Number(error?.statusCode || 500)).json({ success: false, error: error?.message || 'Unable to save registration details.' })
  }
})

app.post(REQUEST_REGISTRATION_OTP_PATH, async (req, res) => {
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

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(503).json({ success: false, error: 'Registration email verification is temporarily unavailable. Please try again later.' })
  }

  try {
    if (postmarkClient && senderEmail) {
      const authUser = await admin.auth().getUserByEmail(normalizedEmail).catch(() => null)
      if (authUser?.uid) {
        const firestore = admin.firestore()
        const [userSnap, clinicSnap] = await Promise.all([
          firestore.collection('users').doc(authUser.uid).get(),
          firestore.collection('clinics').doc(authUser.uid).get(),
        ])
        const userData = userSnap.exists ? userSnap.data() || {} : {}
        const clinicData = clinicSnap.exists ? clinicSnap.data() || {} : {}
        const role = normalizedRegistrationRole(userData.role || userData.userType)
        const active = String(userData.status || '').toLowerCase() === 'active'
          || String(clinicData.approvalStatus || '').toLowerCase() === 'approved'
          || clinicData.isPublished === true
        if (['clinicowner', 'clinicadmin', 'owner'].includes(role) && !active) {
          await sendRegistrationOtpMessage({ email: normalizedEmail, uid: authUser.uid, purpose: CLINIC_REGISTRATION_OTP_PURPOSE })
        }
      }
    }
    // Keep the response identical for unknown, active, and eligible emails.
    return res.status(202).json({
      success: true,
      message: 'If this email belongs to an unfinished clinic registration, a code will be sent to it.',
      retryAfterSeconds: REGISTRATION_OTP_COOLDOWN_SECONDS,
    })
  } catch (error) {
    console.error('Clinic registration OTP request failed:', error?.code || error?.message || error)
    if (error?.statusCode === 429) {
      return res.status(202).json({ success: true, message: 'If this email belongs to an unfinished clinic registration, a code will be sent to it.', retryAfterSeconds: REGISTRATION_OTP_COOLDOWN_SECONDS })
    }
    return res.status(503).json({ success: false, error: 'Registration email verification is temporarily unavailable. Please try again later.' })
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
    if (isSupplierAccount(userData)) return res.status(410).json({ success: false, error: 'Supplier accounts are no longer supported. Suppliers are managed as clinic business contacts.' })
    if (!requiresOperationalLoginOtp(userData)) {
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
    if (isSupplierAccount(userData)) return res.status(410).json({ success: false, error: 'Supplier accounts are no longer supported. Suppliers are managed as clinic business contacts.' })
    if (!requiresOperationalLoginOtp(userData)) {
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

  if (!EMAIL_ADDRESS_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: 'email must be a valid email address',
    })
  }

  if (!postmarkClient || !senderEmail) {
    return res.status(503).json({ success: false, error: 'Registration email verification is temporarily unavailable. Please try again later.' })
  }

  try {
    if (postmarkClient && senderEmail) {
      const authUser = await admin.auth().getUserByEmail(normalizedEmail).catch(() => null)
      if (authUser?.uid) {
        const userSnap = await admin.firestore().collection('users').doc(authUser.uid).get()
        const userData = userSnap.exists ? userSnap.data() || {} : {}
        const role = normalizedRegistrationRole(userData.role || userData.userType)
        const status = String(userData.status || '').trim().toLowerCase()
        if (role === 'customer' && userData.emailVerified !== true && status !== 'active') {
          await sendRegistrationOtpMessage({ email: normalizedEmail, uid: authUser.uid, purpose: CUSTOMER_REGISTRATION_OTP_PURPOSE })
        }
      }
    }
    return res.status(202).json({
      success: true,
      message: 'If this email belongs to an unfinished customer registration, a code will be sent to it.',
      retryAfterSeconds: REGISTRATION_OTP_COOLDOWN_SECONDS,
    })
  } catch (error) {
    console.error('Customer registration OTP request failed:', error?.code || error?.message || error)
    if (error?.statusCode === 429) {
      return res.status(202).json({ success: true, message: 'If this email belongs to an unfinished customer registration, a code will be sent to it.', retryAfterSeconds: REGISTRATION_OTP_COOLDOWN_SECONDS })
    }
    return res.status(503).json({ success: false, error: 'Registration email verification is temporarily unavailable. Please try again later.' })
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

// Customer booking pages need practitioner availability, but must never read
// employee profiles, roles, schedules, or leave records directly from Firestore.
// Return only the minimum public booking metadata from this trusted endpoint.
app.get('/public/clinics/:branchId/practitioners', requireAuth, async (req, res) => {
  try {
    await safelySweepAppointmentPaymentHolds()
    const branchId = String(req.params?.branchId || '').trim()
    if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required.' })

    const firestore = admin.firestore()
    const clinicSnap = await firestore.collection('clinics').doc(branchId).get()
    const clinic = clinicSnap.exists ? clinicSnap.data() || {} : null
    if (!clinic || String(clinic.status || '').trim().toLowerCase() === 'inactive') {
      return res.status(404).json({ success: false, error: 'Center unavailable.' })
    }

    const ownerId = String(clinic.ownerId || '').trim()
    if (!ownerId) return res.status(404).json({ success: false, error: 'Center unavailable.' })

    // Customers may only retrieve availability for public clinics. Internal
    // clinic users also use this endpoint from the Walk-In Desk, where an
    // unpublished clinic must still be able to schedule its own clients.
    const requesterSnap = await firestore.collection('users').doc(req.user.uid).get()
    const requester = requesterSnap.exists ? requesterSnap.data() || {} : {}
    const requesterRole = String(requester.role || requester.userType || '').trim().toLowerCase()
    const isClinicOwner = req.user.uid === ownerId
      || ['owner', 'clinic owner', 'clinicowner'].includes(requesterRole)
    const isBranchStaff = (String(requester.branchId || '').trim() === branchId
      || (Array.isArray(requester.branchIds) && requester.branchIds.map(value => String(value || '').trim()).includes(branchId)))
      && !['customer', 'supplier'].includes(requesterRole)
    if (clinic.isPublished !== true && !isClinicOwner && !isBranchStaff) {
      return res.status(404).json({ success: false, error: 'Center unavailable.' })
    }

    const rolesSnap = await firestore.collection('clinicRoles').where('ownerId', '==', ownerId).get()
    const practitionerPermissionKeys = new Set(['appointments:update', 'consultations:view', 'consultations:create'])
    const practitionerRoleIds = new Set(
      rolesSnap.docs
        .filter((roleSnap) => Array.isArray(roleSnap.data()?.permissions)
          && roleSnap.data().permissions.some((permission) => practitionerPermissionKeys.has(String(permission || '').trim())))
        .map((roleSnap) => roleSnap.id)
    )

    const [primaryStaffSnap, additionalBranchStaffSnap] = await Promise.all([
      firestore.collection('users').where('branchId', '==', branchId).get(),
      firestore.collection('users').where('branchIds', 'array-contains', branchId).get(),
    ])
    const uniqueStaff = new Map([...primaryStaffSnap.docs, ...additionalBranchStaffSnap.docs].map(staffSnap => [staffSnap.id, staffSnap]))
    const practitioners = [...uniqueStaff.values()]
      .map((staffSnap) => ({ id: staffSnap.id, ...staffSnap.data() }))
      .filter((staff) => {
        const role = String(staff.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
        const directPermissions = [...(Array.isArray(staff.effectivePermissions) ? staff.effectivePermissions : []), ...(Array.isArray(staff.permissions) ? staff.permissions : [])]
        const type = String(staff.userType || '').trim().toLowerCase()
        return type !== 'customer' && type !== 'supplier' && staff.archived !== true
          && !['inactive', 'disabled', 'archived'].includes(String(staff.status || '').trim().toLowerCase())
          && (role === 'practitioner' || [...(Array.isArray(staff.customRoleIds) ? staff.customRoleIds : []), staff.customRoleId].some((roleId) => practitionerRoleIds.has(String(roleId || '').trim())) || directPermissions.some((permission) => practitionerPermissionKeys.has(String(permission || '').trim())))
      })
      .map((staff) => ({
        id: staff.id,
        fullName: String(staff.fullName || '').trim()
          || `${String(staff.firstName || '').trim()} ${String(staff.lastName || '').trim()}`.trim()
          || 'Unnamed Practitioner',
        practitionerType: String(staff.practitionerType || '').trim(),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))

    await Promise.all(practitioners.map(async practitioner => {
      const profile = (await firestore.collection('practitionerProfiles').doc(practitioner.id).get()).data()
      Object.assign(practitioner, { practitionerType: profile?.type || practitioner.practitionerType || '', credentialsVerified: profile?.credentialsVerified === true })
    }))
    const availabilityEntries = await Promise.all(practitioners.map(async (practitioner) => {
      const [schedulesSnap, leavesSnap] = await Promise.all([
        firestore.collection('users').doc(practitioner.id).collection('schedules').get(),
        firestore.collection('leaveRequests').where('requesterId', '==', practitioner.id).get(),
      ])
      const schedules = schedulesSnap.docs.map((scheduleSnap) => ({ id: scheduleSnap.id, data: scheduleSnap.data() || {} }))
      const leaves = leavesSnap.docs
        .map((leaveSnap) => leaveSnap.data() || {})
        .filter((leave) => String(leave.status || '').trim().toLowerCase() === 'approved')
        .map((leave) => ({
          startDate: String(leave.startDate || '').trim(),
          endDate: String(leave.endDate || '').trim(),
          leaveType: String(leave.leaveType || 'Approved leave').trim(),
        }))
        .filter((leave) => leave.startDate && leave.endDate)
      return [practitioner.id, schedules, leaves]
    }))

    const schedules = {}, leaves = {}
    availabilityEntries.forEach(([practitionerId, practitionerSchedules, practitionerLeaves]) => {
      schedules[practitionerId] = practitionerSchedules
      leaves[practitionerId] = practitionerLeaves
    })

    // Customers need to see occupied times in the slot picker, but must not
    // receive appointment records or client details. Return only the fields
    // needed to draw blocked windows. The transactional booking check remains
    // authoritative if availability changes after this response.
    const startDate = String(req.query?.startDate || '').trim()
    const endDate = String(req.query?.endDate || '').trim()
    let busyWindows = [], customerBusyDates = []
    if (startDate || endDate) {
      const validDate = value => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
        const parsed = Date.parse(`${value}T00:00:00.000Z`)
        return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
      }
      if (!validDate(startDate) || !validDate(endDate)) {
        return res.status(400).json({ success: false, error: 'A valid availability date range is required.' })
      }
      const dayCount = (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86400000
      if (dayCount < 0 || dayCount > 365) {
        return res.status(400).json({ success: false, error: 'Availability can be requested for up to 366 days.' })
      }

      const releasedAvailabilityStatuses = new Set(['cancelled', 'rejected', 'completed', 'expired', 'no-show', 'incomplete', 'forfeited'])
      const releasedCustomerDateStatuses = new Set(['cancelled', 'rejected', 'expired'])
      const appointmentQuery = collection => collection
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
      const [branchAppointments, customerAppointments] = await Promise.all([
        appointmentQuery(firestore.collection('appointments').where('branchId', '==', branchId)).get(),
        requesterRole === 'customer'
          ? appointmentQuery(firestore.collection('appointments').where('customerId', '==', req.user.uid)).get()
          : Promise.resolve(null),
      ])

      busyWindows = branchAppointments.docs.flatMap(snapshot => {
        const appointment = snapshot.data() || {}
        if (isBookingPaymentHoldReleased(appointment)) return []
        if (appointment.isGroupParent || appointment.isBookingOrderParent || releasedAvailabilityStatuses.has(String(appointment.status || '').trim().toLowerCase())) return []
        const practitionerId = String(appointment.assignedPractitionerId || appointment.practitionerId || '').trim()
        if (!practitionerId || !appointment.date || !appointment.time) return []
        const durationMinutes = Number(appointment.totalServiceDurationMinutes || appointment.consultationDurationMinutes || appointment.durationMinutes || 60)
        return [{
          status: 'busy',
          date: String(appointment.date),
          time: String(appointment.time),
          endTime: String(appointment.endTime || ''),
          durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60,
          practitionerId,
          treatmentTeam: (Array.isArray(appointment.treatmentTeam) ? appointment.treatmentTeam : [])
            .map(member => ({ employeeId: String(member?.employeeId || '').trim() }))
            .filter(member => member.employeeId),
        }]
      })

      if (customerAppointments) {
        customerBusyDates = [...new Set(customerAppointments.docs
          .map(snapshot => snapshot.data() || {})
          .filter(appointment => !appointment.isGroupParent && !appointment.isBookingOrderParent
            && !isBookingPaymentHoldReleased(appointment)
            && !releasedCustomerDateStatuses.has(String(appointment.status || '').trim().toLowerCase()))
          .map(appointment => String(appointment.date || '').trim())
          .filter(Boolean))]
      }
    }

    return res.json({ success: true, practitioners, schedules, leaves, busyWindows, customerBusyDates, operatingHours: clinic.operatingHours || {}, legacyOperatingHours: { openDays: clinic.openDays, openTime: clinic.openTime, closeTime: clinic.closeTime } })
  } catch (error) {
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Unable to load practitioner availability.' })
  }
})

// Public catalog reads use the trusted backend so published-center visibility
// does not depend on customer Firestore rules.
app.get('/public/clinics/:branchId/catalog', async (req, res) => {
  const branchId = String(req.params?.branchId || '').trim()
  let stage = 'initialization'
  try {
    if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required.' })
    if (!adminReady) return res.status(503).json({ success: false, error: 'Center catalog is temporarily unavailable.' })
    const firestore = admin.firestore()
    stage = 'clinic lookup'
    const clinicSnap = await firestore.collection('clinics').doc(branchId).get()
    const clinic = clinicSnap.exists ? clinicSnap.data() || {} : null
    if (!isClinicCustomerDiscoverable(clinic)) {
      return res.status(404).json({ success: false, error: 'Center unavailable.' })
    }
    stage = 'catalog query'
    const postsSnap = await firestore.collection('productServicePosts').where('branchId', '==', branchId).get()
    const posts = postsSnap.docs
      .map((postSnap) => ({ id: postSnap.id, ...postSnap.data() }))
      .filter(isCustomerCareListing)
    return res.json({ success: true, posts })
  } catch (error) {
    console.error('Public clinic catalog load failed:', {
      branchId,
      stage,
      code: error?.code || null,
      message: error?.message || String(error),
      stack: error?.stack || null,
    })
    return res.status(500).json({ success: false, error: 'Unable to load this center’s products and services.' })
  }
})

// Demo customer bookings exercise the customer selection flow and appear in
// the clinic appointment list, but never enter payment, notification, or slot
// reservation workflows.
app.post('/appointments/demo-service-booking', requireAuth, async (req, res) => {
  try {
    const branchId = String(req.body?.branchId || '').trim()
    const serviceId = String(req.body?.serviceId || '').trim()
    const practitionerId = String(req.body?.practitionerId || '').trim()
    const date = String(req.body?.date || '').trim()
    const time = String(req.body?.time || '').trim()
    const validDocumentId = (value) => /^[A-Za-z0-9_-]{1,150}$/.test(value)
    const selectedDate = new Date(`${date}T00:00:00+08:00`)
    if (!validDocumentId(branchId) || !validDocumentId(serviceId) || !validDocumentId(practitionerId)
      || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(selectedDate.getTime())
      || selectedDate.getTime() < Date.now() - 24 * 60 * 60 * 1000
      || selectedDate.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000 || parseClockToMinutes(time) === null) {
      return res.status(400).json({ success: false, error: 'Choose a service, practitioner, and available date and time.' })
    }

    const firestore = admin.firestore()
    const [branchSnap, serviceSnap, practitionerSnap, context] = await Promise.all([
      firestore.collection('clinics').doc(branchId).get(),
      firestore.collection('productServicePosts').doc(serviceId).get(),
      firestore.collection('users').doc(practitionerId).get(),
      loadUserContext(req.user.uid),
    ])
    const branch = branchSnap.exists ? branchSnap.data() || {} : null
    const service = serviceSnap.exists ? { id: serviceSnap.id, ...serviceSnap.data() } : null
    const practitioner = practitionerSnap.exists ? practitionerSnap.data() || {} : null
    if (!branch || branch.isPublished !== true || String(branch.status || '').toLowerCase() === 'inactive') {
      return res.status(404).json({ success: false, error: 'This clinic is not available for demo bookings.' })
    }
    if (!service || String(service.branchId || '') !== branchId || !isCustomerCareListing(service)
      || service.postType !== 'Service' || service.isPackageComponent === true || Number(service.sessionCount || 1) !== 1) {
      return res.status(409).json({ success: false, error: 'Choose a currently published standalone service.' })
    }
    if (!practitioner || String(practitioner.branchId || '') !== branchId || practitioner.archived === true
      || ['inactive', 'disabled', 'archived'].includes(String(practitioner.status || '').trim().toLowerCase())) {
      return res.status(409).json({ success: false, error: 'Choose an active practitioner from this clinic.' })
    }
    if (['inactive', 'disabled', 'archived'].includes(String(context?.userData?.status || '').trim().toLowerCase())) {
      return res.status(403).json({ success: false, error: 'An active account is required to create a demo booking.' })
    }

    const user = context?.userData || {}
    const customerName = String(user.fullName || user.name || req.user.name || req.user.email || 'Demo Customer').trim()
    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    const appointmentRef = firestore.collection('appointments').doc()
    const requestedDuration = Number(service.durationMinutes || 60)
    const durationMinutes = Number.isFinite(requestedDuration) ? Math.max(15, requestedDuration) : 60
    const serviceDetails = {
      id: service.id,
      title: String(service.title || service.name || 'Service'),
      name: String(service.title || service.name || 'Service'),
      postType: 'Service',
      durationMinutes,
      sessionCount: 1,
    }
    await appointmentRef.set({
      branchId,
      customerId: req.user.uid,
      customerName,
      clientName: customerName,
      customerEmail: String(req.user.email || user.email || '').trim().toLowerCase(),
      customerPhone: String(req.body?.customerPhone || user.contactNumber || user.phoneNumber || '').trim(),
      practitionerId,
      assignedPractitionerId: practitionerId,
      practitionerName: String(practitioner.fullName || `${practitioner.firstName || ''} ${practitioner.lastName || ''}`.trim() || 'Practitioner'),
      assignedPractitionerName: String(practitioner.fullName || `${practitioner.firstName || ''} ${practitioner.lastName || ''}`.trim() || 'Practitioner'),
      service: serviceDetails.title,
      services: [serviceDetails.title],
      serviceIds: [serviceId],
      selectedServiceIds: [serviceId],
      serviceDetails: [serviceDetails],
      serviceDurations: [durationMinutes],
      totalServiceDurationMinutes: durationMinutes,
      type: 'Service',
      date,
      time,
      status: 'Demo',
      approvalStatus: 'Demo',
      paymentStatus: 'No charge',
      paymentMethod: 'Demo',
      paymentCoverage: 'demo',
      amount: 0,
      totalAmount: 0,
      amountPaid: 0,
      contract: { status: 'signed', terms: 'Demo appointment only. No payment is taken and no treatment is performed.' },
      source: 'demo_customer_booking',
      bookingType: 'demo',
      demoMode: true,
      demoScenario: 'customer_service_booking',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const actorRole = String(context?.userData?.role || context?.userData?.userType || '').trim().toLowerCase()
    const clinicPreview = ['owner', 'clinic owner', 'clinicowner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator', 'practitioner', 'receptionist', 'manager', 'hr', 'finance', 'employee', 'staff'].includes(actorRole)
      || ['staff', 'employee'].includes(String(context?.userData?.userType || '').trim().toLowerCase())
    return res.status(201).json({ success: true, data: { id: appointmentRef.id, service: serviceDetails.title, date, time, noCharge: true, clinicPreview } })
  } catch (error) {
    console.error('Demo service booking failed:', error?.message || error)
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Unable to create a demo booking.' })
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
    await safelySweepAppointmentPaymentHolds()
    const firestore = admin.firestore()
    let customerId = String(reservation.customerId || '').trim()
    const walkIn = reservation.source === 'walk_in'
    if (walkIn) {
      assertWorkflow(!reservation.groupBooking, 'Group bookings are not available for walk-ins.', 400)
      await authorizeClinicAction(req.user.uid, String(reservation.branchId || ''), 'appointments:create')
      const client = await firestore.collection('clients').doc(String(reservation.clientId || customerId)).get()
      assertWorkflow(client.exists && client.data().branchId === reservation.branchId, 'Select a walk-in client from this branch.', 403)
      const data = client.data() || {}
      reservation.clientId = client.id
      reservation.customerId = client.id
      customerId = client.id
      reservation.customerName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Walk-in client'
      reservation.customerEmail = String(data.email || '').trim().toLowerCase()
      reservation.customerPhone = data.phone || data.contactNumber || ''
      assertWorkflow(EMAIL_ADDRESS_REGEX.test(reservation.customerEmail), 'A valid client email is required for walk-in bookings. Booking details and the service key are sent to this address.', 400)
    }
    if (!walkIn && (!customerId || customerId !== String(req.user?.uid || '').trim())) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    // Validate basic reservation fields
    const practitionerId = String(reservation.practitionerId || '').trim()
    const branchId = String(reservation.branchId || '').trim()
    const date = String(reservation.date || '').trim()

    if (!practitionerId) return res.status(400).json({ success: false, error: 'practitionerId is required' })
    if (!branchId) return res.status(400).json({ success: false, error: 'branchId is required' })
    if (!date) return res.status(400).json({ success: false, error: 'date is required' })

    await assertClinicPlanFeature(firestore, branchId, 'booking_availability')

    // Never trust a practitioner ID supplied by the customer. The assignee
    // must belong to this branch and be an actual practitioner by role or by
    // a role permission that permits practitioner work.
    const [branchSnap, practitionerSnap] = await Promise.all([
      firestore.collection('clinics').doc(branchId).get(),
      firestore.collection('users').doc(practitionerId).get(),
    ])
    const branch = branchSnap.exists ? branchSnap.data() || {} : null
    const practitioner = practitionerSnap.exists ? practitionerSnap.data() || {} : null
    if (!branch || !practitioner || String(practitioner.branchId || '').trim() !== branchId) {
      return res.status(400).json({ success: false, error: 'Choose an eligible practitioner from this branch.' })
    }
    // Online bookings use one path for every subscription plan: create a short
    // payment hold, let the customer sign and pay, then confirm on verified
    // payment. Walk-ins keep their in-clinic payment flow.
    const directOnlineBooking = !walkIn
    const paymentHoldExpiresAt = directOnlineBooking
      ? admin.firestore.Timestamp.fromMillis(Date.now() + BOOKING_PAYMENT_HOLD_MS)
      : null
    const initialBookingStatus = walkIn ? 'Unpaid' : 'Awaiting Payment'
    const initialApprovalStatus = 'Approved'
    const practitionerPermissionKeys = new Set(['appointments:update', 'consultations:view', 'consultations:create'])
    const directPermissions = [...(Array.isArray(practitioner.effectivePermissions) ? practitioner.effectivePermissions : []), ...(Array.isArray(practitioner.permissions) ? practitioner.permissions : [])]
    const role = String(practitioner.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
    let hasEligibleRole = role === 'practitioner' || directPermissions.some((permission) => practitionerPermissionKeys.has(String(permission || '').trim()))
    const customRoleIds = [...new Set([...(Array.isArray(practitioner.customRoleIds) ? practitioner.customRoleIds : []), practitioner.customRoleId].map((roleId) => String(roleId || '').trim()).filter(Boolean))]
    if (!hasEligibleRole && branch.ownerId && customRoleIds.length) {
      const practitionerRoleSnaps = await Promise.all(customRoleIds.map((roleId) => firestore.collection('clinicRoles').doc(roleId).get()))
      hasEligibleRole = practitionerRoleSnaps.some((practitionerRoleSnap) => practitionerRoleSnap.exists
        && String(practitionerRoleSnap.data()?.ownerId || '').trim() === String(branch.ownerId || '').trim()
        && (practitionerRoleSnap.data()?.permissions || []).some((permission) => practitionerPermissionKeys.has(String(permission || '').trim())))
    }
    if (!hasEligibleRole || practitioner.archived === true || ['inactive', 'disabled', 'archived'].includes(String(practitioner.status || '').trim().toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Choose an eligible practitioner from this branch.' })
    }

    if (!walkIn && String(reservation.bookingType || '').toLowerCase() === 'follow-up') {
      const followUpOf = String(reservation.followUpOf || '').trim()
      if (!followUpOf) {
        return res.status(400).json({ success: false, error: 'A follow-up must be linked to the completed appointment.' })
      }
      const sourceSnap = await firestore.collection('appointments').doc(followUpOf).get()
      const source = sourceSnap.exists ? sourceSnap.data() || {} : null
      const followUpError = validateFollowUpSource(source, { customerId, branchId })
      if (followUpError) return res.status(409).json({ success: false, error: followUpError })
      const existingFollowUps = await firestore.collection('appointments').where('followUpOf', '==', followUpOf).get()
      const hasOpenFollowUp = existingFollowUps.docs.some((docSnap) => !['cancelled', 'rejected'].includes(normalizeBookingStatus(docSnap.data()?.status)))
      if (hasOpenFollowUp) {
        return res.status(409).json({ success: false, error: 'A follow-up booking has already been requested for this appointment.' })
      }
    }

    const approvedLeave = await getApprovedLeaveForDate(practitionerId, date)
    if (approvedLeave) {
      return res.status(409).json({
        success: false,
        code: 'PRACTITIONER_ON_LEAVE',
        error: 'The selected practitioner is on approved leave for this date. Please choose another schedule.',
        leaveId: approvedLeave.id,
      })
    }

    // Compute requested booking time range in minutes
    const requestedRange = getBookingRange(reservation)
    if (!requestedRange) return res.status(400).json({ success: false, error: 'Invalid or missing time/duration for reservation' })

    const selectedServices = Array.isArray(reservation.selectedServices) ? reservation.selectedServices : []
    const { policy: policyData } = await getClinicPoliciesForBranch(firestore, branchId, branch)
    const policyDefinitions = [
      ['cancellationPolicy', 'Cancellation policy'],
      ['reschedulePolicy', 'Reschedule policy'],
      ['refundPolicy', 'Refund policy'],
      ['consultationPolicy', 'Consultation policy'],
      ['serviceTerms', 'Service terms'],
      ['paymentPolicy', 'Payment policy'],
      ['noShowPolicy', 'No-show policy'],
    ]
    const clinicPolicySnapshot = Object.fromEntries(
      policyDefinitions
        .filter(([key]) => policyData[`${key}Enabled`] === true && String(policyData[key] || '').trim())
        .map(([key, label]) => [key, { label, text: String(policyData[key]).trim() }])
    )
    if (Object.keys(clinicPolicySnapshot).length && reservation.policyAcknowledged !== true) {
      return res.status(422).json({
        success: false,
        code: 'POLICY_ACKNOWLEDGEMENT_REQUIRED',
        error: 'Please review and acknowledge the clinic policies before booking.',
      })
    }
    const consultationRequiredIds = (reservation.groupBooking ? [] : selectedServices)
      .filter((service) => service?.requiresConsultationFirst === true && !service.packageComponents?.some(component => component.type === 'Consultation'))
      .map((service) => String(service.id || '').trim())
      .filter(Boolean)

    if (consultationRequiredIds.length) {
      const [consultationSnap, clearanceSnap] = await Promise.all([
        firestore.collection('appointments').where('customerId', '==', customerId).where('type', '==', 'Consultation').get(),
        firestore.collection('consultationClearances').where('customerId', '==', customerId).get(),
      ])
      const requiredServices = await Promise.all(consultationRequiredIds.map(async id => ({ ...(await firestore.collection('productServicePosts').doc(id).get()).data(), id })))
      const hasCompletedConsultation = requiredServices.every(service => hasConsultationRequirement(service, consultationSnap.docs.map(snapshot => snapshot.data()), clearanceSnap.docs.map(snapshot => snapshot.data()), branchId))
      if (!hasCompletedConsultation) {
        return res.status(422).json({
          success: false,
          code: 'CONSULTATION_REQUIRED',
          error: 'A completed consultation is required before requesting one or more selected services.',
          requiredServiceIds: consultationRequiredIds,
        })
      }
    }

    // A per-practitioner/day transaction lock serializes online and walk-in
    // bookings. The appointment conflict check below runs after acquiring it.
    const slotLockId = crypto.createHash('sha256').update(`${branchId}:${practitionerId}:${date}`).digest('hex')
    const slotLockRef = firestore.collection('bookingSlotLocks').doc(slotLockId)

    // Create booking + appointment transactionally after validating the slot.
    const bookingRef = firestore.collection('bookings').doc()
    const appointmentRef = firestore.collection('appointments').doc()

    const bookingPayload = {
      ...reservation,
      customerId,
      approvalStatus: initialApprovalStatus,
      status: initialBookingStatus,
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
        id: bookingRef.id,
        customerId,
        status: initialBookingStatus,
        paymentStatus: 'Pending',
        paymentCoverage: 'pending',
        source: walkIn ? 'walk_in' : 'customer_booking',
        bookingId: bookingRef.id,
      ...(directOnlineBooking ? { paymentHoldStatus: 'active', paymentHoldExpiresAt } : {}),
        clinicPolicySnapshot,
        policyAcknowledged: reservation.policyAcknowledged === true,
        policyAcknowledgedAt: reservation.policyAcknowledged === true ? admin.firestore.FieldValue.serverTimestamp() : null,
      },
    })

    const groupResult = { recipientAppointmentIds: [], invitations: [] }
    await firestore.runTransaction(async (tx) => {
      await tx.get(slotLockRef)
      const apptQuery = firestore.collection('appointments')
        .where('branchId', '==', branchId)
        .where('practitionerId', '==', practitionerId)
        .where('date', '==', date)
      const apptSnap = await tx.get(apptQuery)
      for (const docSnap of apptSnap.docs) {
        const appt = docSnap.data() || {}
        const existingRange = getBookingRange(appt)
        if (isBookingPaymentHoldReleased(appt) || !existingRange || !BOOKING_BLOCKING_STATUSES.has(normalizeBookingStatus(appt.status))) continue
        assertWorkflow(!rangesOverlap(requestedRange.start, requestedRange.end, existingRange.start, existingRange.end), 'Requested time conflicts with an existing appointment.', 409)
      }
      const prepared = await prepareBooking({ tx, db: firestore, reservation, getBookingRange, rangesOverlap })
      const recipients = walkIn ? [] : await prepareClinicBookingRecipients({ tx, db: firestore, branchId, branch, loadUserContext })
      Object.assign(appointmentPayload, prepared.data, {
        approvalStatus: initialApprovalStatus, status: initialBookingStatus, paymentStatus: 'Pending', amountPaid: 0,
        ...(walkIn
          ? { source: 'walk_in', clientId: reservation.clientId, clientName: reservation.customerName, installmentsAllowed: false, depositPercent: 100, approvedBy: req.user.uid, approvedAt: admin.firestore.FieldValue.serverTimestamp() }
          : { source: 'customer_booking', approvedBy: null, approvedAt: admin.firestore.FieldValue.serverTimestamp() }),
        serviceKey: null, customerKeyVerified: false, workerKeyVerified: false, workerCompleted: false, customerCompleted: false,
      })
      tx.set(slotLockRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(prepared.lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      for (const lock of prepared.customerLocks || []) tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.set(bookingRef, { ...bookingPayload, ...prepared.data, source: walkIn ? 'walk_in' : 'customer_booking', status: initialBookingStatus, ...(directOnlineBooking ? { paymentHoldStatus: 'active', paymentHoldExpiresAt } : {}) })
      tx.set(appointmentRef, appointmentPayload)
      writeClinicBookingNotifications({ tx, db: firestore, recipients, branchId, bookingId: bookingRef.id, appointmentId: appointmentRef.id, customerName: reservation.customerName, directBooking: directOnlineBooking, createdAt: admin.firestore.FieldValue.serverTimestamp() })
      if (directOnlineBooking && !prepared.data.groupBooking && Number(prepared.data.treatmentPlan?.totalSessions || 1) > 1) {
        const count = prepared.data.treatmentPlan.totalSessions
        for (let number = 1; number <= count; number++) tx.set(firestore.collection('treatmentSessions').doc(`${appointmentRef.id}-${number}`), { branchId, treatmentPlanAppointmentId: appointmentRef.id, customerId, customerName: reservation.customerName, practitionerId, sessionNumber: number, totalSessions: count, status: number === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: number === 1 ? appointmentRef.id : '', ...(number === 1 ? { date: reservation.date, time: reservation.time } : {}), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      }
      tx.update(bookingRef, { appointmentId: appointmentRef.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      const group = prepared.data.groupBooking
      if (group) {
        const recipients = [
          ...(group.organizerIncluded ? [{ name: reservation.customerName, email: reservation.customerEmail, customerId, organizer: true }] : []),
          ...group.guests.map((guest) => ({ name: guest.name, email: guest.email, phone: guest.phone || '', customerId: '', organizer: false })),
        ]
        const serviceDuration = Math.max(30, Math.round(Number(prepared.data.totalServiceDurationMinutes || 0) / recipients.length))
        const totalAmount = Number(prepared.data.totalAmount || 0)
        const perRecipientAmount = Math.round((totalAmount / recipients.length) * 100) / 100
        const firstStart = parseClockToMinutes(reservation.time)
        const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
        const groupRef = firestore.collection('groupBookings').doc(bookingRef.id)
        const recipientIds = []
        recipients.forEach((recipient, index) => {
          const childRef = firestore.collection('appointments').doc()
          const plan = group.recipientPlans?.[index]
          const individualDuration = plan?.data.totalServiceDurationMinutes || serviceDuration
          const individualAmount = plan?.data.totalAmount || perRecipientAmount
          const startMinutes = plan ? parseClockToMinutes(plan.time) : firstStart + index * serviceDuration
          const childTime = toClock(startMinutes), childEndTime = toClock(startMinutes + individualDuration)
          const consentToken = crypto.randomBytes(24).toString('hex')
          const child = {
            ...appointmentPayload,
            ...(plan?.data || {}),
            services: [plan?.data.service || appointmentPayload.service],
            customerId: recipient.customerId || `guest:${childRef.id}`,
            customerName: recipient.name,
            clientName: recipient.name,
            customerEmail: String(recipient.email || '').toLowerCase(),
            customerPhone: recipient.organizer ? reservation.customerPhone || '' : recipient.phone,
            time: childTime, endTime: childEndTime, totalServiceDurationMinutes: individualDuration,
            groupBooking: null, resources: plan?.data.resources || (appointmentPayload.resources || []).map(resource => ({ ...resource, quantity: resource.kind === 'material' ? resource.quantity / recipients.length : resource.quantity })),
            amount: individualAmount, totalAmount: individualAmount, amountPaid: 0,
            commissionAmount: plan?.data.commissionAmount ?? Math.round((Number(appointmentPayload.commissionAmount || 0) * individualAmount / totalAmount) * 100) / 100,
            merchantNetAmount: plan?.data.merchantNetAmount ?? Math.round((Number(appointmentPayload.merchantNetAmount || 0) * individualAmount / totalAmount) * 100) / 100,
            groupBookingId: bookingRef.id, groupOrganizerId: customerId, groupOrganizerName: reservation.customerName || '', groupOrganizerEmail: reservation.customerEmail || '', groupOrganizerPhone: reservation.customerPhone || '', groupRecipientIndex: index + 1, groupRecipientCount: recipients.length,
            parentAppointmentId: appointmentRef.id, paymentHoldParentId: appointmentRef.id,
            isGroupRecipient: true, paymentManagedByOrganizer: true,
            consent: { status: recipient.organizer ? 'Organizer Consent Required' : 'Guest Consent Required', invitedAt: admin.firestore.FieldValue.serverTimestamp() },
            contract: { ...(plan?.data.contract || appointmentPayload.contract || {}), status: 'guest_consent_pending' }, serviceKey: null,
          }
          tx.set(childRef, child)
          if (directOnlineBooking && Number(child.treatmentPlan?.totalSessions || 1) > 1) for (let number = 1; number <= child.treatmentPlan.totalSessions; number++) tx.set(firestore.collection('treatmentSessions').doc(`${childRef.id}-${number}`), { branchId, treatmentPlanAppointmentId: childRef.id, customerId: child.customerId, customerName: child.customerName, practitionerId, sessionNumber: number, totalSessions: child.treatmentPlan.totalSessions, status: number === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: number === 1 ? childRef.id : '', ...(number === 1 ? { date: child.date, time: child.time } : {}), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          tx.set(firestore.collection('groupConsentInvitations').doc(consentToken), { groupBookingId: bookingRef.id, appointmentId: childRef.id, recipientName: recipient.name, recipientEmail: String(recipient.email || '').toLowerCase(), status: 'Pending', createdAt: admin.firestore.FieldValue.serverTimestamp() })
          recipientIds.push(childRef.id)
          groupResult.invitations.push({ email: String(recipient.email || '').toLowerCase(), name: recipient.name, token: consentToken })
        })
        tx.set(groupRef, { id: bookingRef.id, organizerId: customerId, organizerName: reservation.customerName || '', organizerEmail: reservation.customerEmail || '', branchId, bookingId: bookingRef.id, parentAppointmentId: appointmentRef.id, recipientAppointmentIds: recipientIds, participantCount: recipients.length, paymentStatus: 'Pending', totalAmount, status: initialBookingStatus, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        tx.update(appointmentRef, { isGroupParent: true, groupBookingId: bookingRef.id, groupRecipientAppointmentIds: recipientIds, groupRecipientCount: recipients.length, service: `Group booking (${recipients.length} recipients)`, totalServiceDurationMinutes: 0, practitionerId: '', assignedPractitionerId: '', resources: [], installmentsAllowed: false, depositPercent: 100, treatmentPlan: { totalSessions: 1 }, contract: { status: 'signed', terms: 'Each attendee must complete their individual consent before check-in.' } })
        groupResult.recipientAppointmentIds.push(...recipientIds)
      }
    })

    let bookingEmailSent = false
    if (walkIn && postmarkClient && senderEmail) {
      try {
        await sendPostmarkMessage({
          to: reservation.customerEmail,
          subject: 'Your AesthetiCare walk-in appointment is booked',
          text: `Hi ${reservation.customerName},\n\nYour booking at ${branch.clinicName || branch.clinicBranch || 'the clinic'} is confirmed.\nService: ${reservation.service || 'Appointment'}\nWhen: ${[reservation.date, reservation.time].filter(Boolean).join(' at ')}\n\nAfter payment is recorded, we will send your six-digit service key to this email. Please bring it on the appointment day; the practitioner uses it to verify the appointment before starting your service.`,
        })
        bookingEmailSent = true
      } catch (emailError) {
        console.error('Walk-in booking email failed:', emailError)
      }
    }

    if (groupResult.recipientAppointmentIds.length && postmarkClient && senderEmail) {
      const group = reservation.groupBooking || {}
      await Promise.all(groupResult.invitations.map(async (invite) => {
        const email = String(invite.email || '').trim().toLowerCase()
        if (!EMAIL_ADDRESS_REGEX.test(email)) return
        try {
          await sendPostmarkMessage({
            to: email,
            subject: 'You were added to an AesthetiCare group booking',
            text: `Hi ${String(invite.name || 'Guest').trim()},\n\n${reservation.customerName || 'The organizer'} added you to a group booking at ${branch.clinicName || branch.clinicBranch || 'the clinic'} on ${[reservation.date, reservation.time].filter(Boolean).join(' at ')}. The organizer pays for the group. You can complete consent before or after payment, but both must be complete before check-in. You do not need a platform account. Complete your individual consent using this private link: ${EMAIL_WEBSITE_URL}/group-consent?token=${invite.token}`,
          })
        } catch (error) { console.warn('Group booking guest email failed:', error?.message || error) }
      }))
    }

    return res.json({ success: true, data: { bookingId: bookingRef.id, appointmentId: appointmentRef.id, recipientAppointmentIds: groupResult.recipientAppointmentIds, bookingEmailSent } })
  } catch (error) {
    console.error('bookings/create error:', error)
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Failed to create booking' })
  }
})

// A guest does not need an account to consent, but receives only an
// unguessable, single-recipient invitation token. Their consent and key never
// affect other guests in the same organizer-paid group.
const resolveGroupAttendee = async (token, targetId = '') => {
  assertWorkflow(/^[a-f0-9]{48}$/i.test(String(token || '')), 'Invalid invitation.', 400)
  const firestore = admin.firestore(), invite = (await firestore.collection('groupConsentInvitations').doc(token).get()).data()
  assertWorkflow(invite, 'Invitation not found.', 404)
  const appointment = (await firestore.collection('appointments').doc(invite.appointmentId).get()).data()
  assertWorkflow(appointment?.isGroupRecipient && normalized(appointment.customerEmail) === normalized(invite.recipientEmail), 'Invalid recipient invitation.', 403)
  if (targetId && targetId !== invite.appointmentId) {
    const target = (await firestore.collection('appointments').doc(targetId).get()).data()
    assertWorkflow(target?.treatmentPlanAppointmentId === invite.appointmentId && target.customerId === appointment.customerId, 'This session belongs to another attendee.', 403)
    return { invite, appointment: target, appointmentId: targetId }
  }
  return { invite, appointment, appointmentId: invite.appointmentId }
}
app.post('/group-consents/:token/request', async (req, res) => {
  try {
    const { invite, appointment, appointmentId } = await resolveGroupAttendee(req.params.token, String(req.body?.appointmentId || ''))
    assertWorkflow(invite.status === 'Completed', 'Complete your individual consent first.', 403)
    const type = String(req.body?.type || '').trim().toLowerCase(), reason = String(req.body?.reason || '').trim()
    assertWorkflow(['cancel', 'reschedule'].includes(type) && reason.length >= 5 && reason.length <= 1000, 'Choose a request type and provide a reason.', 400)
    const firestore = admin.firestore(), ref = firestore.collection('appointments').doc(appointmentId)
    const { policy, branch } = await getClinicPoliciesForBranch(firestore, appointment.branchId)
    if (type === 'cancel') assertWorkflow(isCancellationPolicyEnabled(policy), 'This clinic does not allow cancellation requests.', 403)
    if (type === 'reschedule') {
      assertWorkflow(isReschedulePolicyEnabled(policy), 'This clinic does not allow reschedule requests.', 403)
      assertWorkflow(Number(appointment.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy), 'You have reached this clinic’s reschedule limit.', 403)
    }
    assertWorkflow(!sameDayChangeError(appointment, type), sameDayChangeError(appointment, type), 409)
    const date = String(req.body?.date || '').trim(), time = String(req.body?.time || '').trim()
    const practitionerId = String(appointment.assignedPractitionerId || appointment.practitionerId || '').trim()
    if (type === 'reschedule') {
      assertWorkflow(/^\d{4}-\d{2}-\d{2}$/.test(date) && parseClockToMinutes(time) !== null && new Date(`${date}T${time}+08:00`) > new Date(), 'Choose a future date and time.', 400)
      assertWorkflow(practitionerId, 'The appointment has no assigned practitioner to reschedule with.', 409)
      assertWorkflow(!await getApprovedLeaveForDate(practitionerId, date), 'The practitioner is on approved leave for that date.', 409)
    }
    const refundRequestId = type === 'cancel' ? crypto.randomUUID() : ''
    await firestore.runTransaction(async tx => {
      const snap = await tx.get(ref), current = snap.exists ? snap.data() || {} : null
      assertWorkflow(current && current.isGroupRecipient === true && String(current.customerEmail || '').toLowerCase() === String(invite.recipientEmail || '').toLowerCase(), 'This invitation does not match its attendee.', 403)
      assertWorkflow(!current.startedAt && !current.checkedInAt && ['paid', 'scheduled', 'contract pending', 'awaiting payment'].includes(normalized(current.status)) && new Date(`${current.date}T${current.time}+08:00`) > new Date(), 'Only an upcoming attendee appointment can be changed.')
      assertWorkflow(!sameDayChangeError(current, type), sameDayChangeError(current, type), 409)
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      if (type === 'cancel') {
        const refundTerms = cancellationTermsSnapshot(policy, current)
        tx.update(ref, { status: 'Cancellation Requested', statusBeforeChange: current.status || '', cancellationReason: reason, cancellationRequestedAt: timestamp, cancellationPolicySnapshot: String(policy.cancellationPolicy || '').trim(), cancellationRefundPolicySnapshot: refundTerms, refundRequestedAmount: refundTerms.refundAmount, refundCommissionAmount: refundTerms.commissionAmount, refundRequestId, refundRequestStatus: 'Requested', refundStatus: 'Requested', updatedAt: timestamp })
      } else {
        assertWorkflow(Number(current.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy), 'You have reached this clinic’s reschedule limit.', 403)
        const prepared = await prepareBooking({ tx, db: firestore, reservation: { ...current, date, time, endTime: '', practitionerId, assignedPractitionerId: practitionerId, groupBooking: null }, getBookingRange, rangesOverlap, appointmentId })
        tx.update(ref, { status: 'Reschedule Requested', requestedDate: date, requestedTime: time, requestedPractitionerId: practitionerId, rescheduleReason: reason, rescheduleRequestedAt: timestamp, reschedulePolicySnapshot: String(policy.reschedulePolicy || '').trim(), rescheduleAllowanceSnapshot: rescheduleAllowanceForPolicy(policy), rescheduleCountAtRequest: Number(current.rescheduleCount || 0), requestedEndTime: prepared.data.endTime, updatedAt: timestamp })
      }
      tx.set(firestore.collection('appointmentAudit').doc(), { appointmentId: ref.id, branchId: current.branchId, actorId: current.customerId, action: `guest_${type}_requested`, previousStatus: current.status, nextStatus: type === 'cancel' ? 'Cancellation Requested' : 'Reschedule Requested', ...(type === 'reschedule' ? { date, time, practitionerId } : {}), createdAt: timestamp })
    })
    const clinicRecipients = [...new Set([branch.ownerId, branch.organizationOwnerId, branch.branchAdminId].map(uid => String(uid || '').trim()).filter(Boolean))]
    const requestMessage = type === 'cancel'
      ? `${appointment.customerName || 'A group attendee'} requested to cancel ${appointment.service || 'an appointment'} scheduled for ${appointment.date || ''} ${appointment.time || ''}.`
      : `${appointment.customerName || 'A group attendee'} requested to move ${appointment.service || 'an appointment'} to ${date} ${time}.`
    await Promise.all(clinicRecipients.map(async recipientUserId => {
      try {
        await firestore.collection('notifications').add({ recipientUserId, branchId: appointment.branchId || '', title: type === 'cancel' ? 'Group attendee cancellation requested' : 'Group attendee reschedule requested', message: requestMessage, link: '/crm/appointments', read: false, deleted: false, createdAt: admin.firestore.FieldValue.serverTimestamp() })
      } catch (notificationError) { console.warn('Failed to notify clinic about group attendee change:', notificationError?.message || notificationError) }
    }))
    const organizerId = String(appointment.groupOrganizerId || '').trim()
    if (organizerId) await createAppointmentNotification({ firestore, customerId: organizerId, title: type === 'cancel' ? 'Group attendee requested cancellation' : 'Group attendee requested a new time', message: requestMessage, link: '/customer/appointments' }).catch(error => console.warn('Failed to notify group organizer about attendee change:', error?.message || error))
    res.json({ success: true, data: { requested: true } })
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
})
app.get('/group-consents/:token', async (req, res) => {
  try {
    assertWorkflow(/^[a-f0-9]{48}$/i.test(String(req.params.token || '')), 'Invalid invitation.', 400)
    const firestore = admin.firestore(), invite = (await firestore.collection('groupConsentInvitations').doc(req.params.token).get()).data()
    assertWorkflow(invite, 'Invitation not found.', 404)
    const appointment = (await firestore.collection('appointments').doc(invite.appointmentId).get()).data()
    assertWorkflow(appointment?.isGroupRecipient && normalized(appointment.customerEmail) === normalized(invite.recipientEmail), 'Invalid recipient invitation.', 403)
    const { policy } = await getClinicPoliciesForBranch(firestore, appointment.branchId)
    const canChangeStatus = !appointment.startedAt && !appointment.checkedInAt && ['paid', 'scheduled', 'contract pending', 'awaiting payment'].includes(normalized(appointment.status)) && new Date(`${appointment.date}T${appointment.time}+08:00`) > new Date()
    const canRequestCancellation = invite.status === 'Completed' && canChangeStatus && isCancellationPolicyEnabled(policy) && !sameDayChangeError(appointment, 'cancel')
    const canRequestReschedule = invite.status === 'Completed' && canChangeStatus && isReschedulePolicyEnabled(policy) && Number(appointment.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy) && !sameDayChangeError(appointment, 'reschedule')
    const sessions = await Promise.all((await firestore.collection('treatmentSessions').where('treatmentPlanAppointmentId', '==', invite.appointmentId).get()).docs.map(async doc => {
      const session = doc.data(), visit = session.appointmentId ? (await firestore.collection('appointments').doc(session.appointmentId).get()).data() || {} : {}
      const sessionStatus = normalized(session.status)
      const hasNextSession = sessionStatus === 'unscheduled'
        || (isReschedulePolicyEnabled(policy) && Number(session.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy))
      return { id: doc.id, appointmentId: session.appointmentId || '', sessionNumber: session.sessionNumber, totalSessions: session.totalSessions, status: session.status, rescheduleCount: Number(session.rescheduleCount || 0), earliestScheduleDate: session.earliestScheduleDate || '', canRequestSchedule: invite.status === 'Completed' && hasNextSession && ['unscheduled', 'scheduled', 'schedule proposed', 'reschedule eligible'].includes(sessionStatus), appointmentStatus: visit.status || '', serviceKey: invite.status === 'Completed' ? visit.serviceKey || '' : '', date: session.date || '', time: session.time || '' }
    }))
    sessions.sort((left, right) => Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0))
    sessions.forEach(session => {
      if (Number(session.sessionNumber || 1) <= 1) return
      const previous = sessions.find(item => Number(item.sessionNumber || 0) === Number(session.sessionNumber || 1) - 1)
      session.canRequestSchedule = session.canRequestSchedule && Boolean(previous && ['completed', 'forfeited'].includes(normalized(previous.status)))
    })
    const policyFields = ['earlyMinimumHours', 'earlyNonRefundable', 'earlyRefundPercentage', 'midMinimumHours', 'midMaximumHours', 'midNonRefundable', 'midRefundPercentage', 'lateMaximumHours', 'lateNonRefundable', 'lateRefundPercentage']
    const cancellationTerms = Object.fromEntries(policyFields.map(key => [key, policy[key]]))
    res.json({ success: true, data: { name: appointment.customerName, service: appointment.service, date: appointment.date, time: appointment.time, status: appointment.status, amount: Number(appointment.amount || 0), totalAmount: Number(appointment.totalAmount || appointment.amount || 0), amountPaid: Number(appointment.amountPaid || 0), commissionAmount: Number(appointment.commissionAmount || appointment.refundCommissionAmount || 0), terms: appointment.contract?.terms || '', contractDocument: appointment.contract?.document || null, consentCompleted: invite.status === 'Completed', serviceKey: invite.status === 'Completed' ? appointment.serviceKey : null, sessions, canRequestCancellation, canRequestReschedule, rescheduleCount: Number(appointment.rescheduleCount || 0), cancellationPolicy: String(policy.cancellationPolicy || ''), reschedulePolicy: String(policy.reschedulePolicy || ''), maximumRescheduleAllowance: rescheduleAllowanceForPolicy(policy), cancellationTerms } })
  } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
})
app.post('/group-consents/:token/accept', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim(), name = String(req.body?.name || '').trim()
    assertWorkflow(/^[a-f0-9]{48}$/i.test(token) && name, 'A valid invitation and recipient name are required.', 400)
    assertWorkflow(req.body?.accepted === true, 'Consent must be accepted before continuing.', 400)
    const firestore = admin.firestore(), inviteRef = firestore.collection('groupConsentInvitations').doc(token)
    const result = await firestore.runTransaction(async tx => {
      const inviteSnap = await tx.get(inviteRef); assertWorkflow(inviteSnap.exists, 'This consent invitation is invalid or expired.', 404)
      const invite = inviteSnap.data() || {}; assertWorkflow(String(invite.status || '') === 'Pending', 'This guest consent was already completed.', 409)
      const appointmentRef = firestore.collection('appointments').doc(String(invite.appointmentId || '')), appointmentSnap = await tx.get(appointmentRef)
      assertWorkflow(appointmentSnap.exists, 'Recipient appointment was not found.', 404)
      const appointment = appointmentSnap.data() || {}; assertWorkflow(String(appointment.customerEmail || '').toLowerCase() === String(invite.recipientEmail || '').toLowerCase(), 'This invitation does not match its recipient.', 403)
      assertWorkflow(!['cancelled', 'rejected', 'completed', 'expired'].includes(normalized(appointment.status)), 'This appointment is closed.')
      const serviceKey = String(crypto.randomInt(100000, 1000000))
      const status = afterPaymentStatus({ ...appointment, contract: { status: 'signed' } })
      tx.update(appointmentRef, { customerName: name, clientName: name, contract: { ...(appointment.contract || {}), status: 'signed', guestConsent: { name, acceptedAt: admin.firestore.FieldValue.serverTimestamp(), method: 'invitation-link' } }, consent: { ...(appointment.consent || {}), status: 'Completed', completedAt: admin.firestore.FieldValue.serverTimestamp() }, serviceKey, status, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.update(inviteRef, { status: 'Completed', acceptedName: name, acceptedAt: admin.firestore.FieldValue.serverTimestamp() })
      return { appointmentId: appointmentRef.id, serviceKey, status, email: appointment.customerEmail, date: appointment.date, time: appointment.time }
    })
    await sendServiceCode(result).catch(error => console.warn('Group code email failed:', error.message))
    delete result.email
    return res.json({ success: true, data: result })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error?.message || 'Unable to complete guest consent.' }) }
})

app.post('/group-bookings/:id/recipients/:appointmentId/assign', requireAuth, async (req, res) => {
  try {
    const firestore = admin.firestore(), groupId = String(req.params.id || ''), appointmentId = String(req.params.appointmentId || '')
    const practitionerId = String(req.body?.practitionerId || '').trim(), date = String(req.body?.date || '').trim(), time = String(req.body?.time || '').trim()
    assertWorkflow(groupId && appointmentId && practitionerId && /^\d{4}-\d{2}-\d{2}$/.test(date) && parseClockToMinutes(time) !== null, 'Choose a practitioner, date, and time.', 400)
    const result = await firestore.runTransaction(async tx => {
      const ref = firestore.collection('appointments').doc(appointmentId), snap = await tx.get(ref); assertWorkflow(snap.exists, 'Recipient appointment not found.', 404)
      const appointment = snap.data() || {}; assertWorkflow(appointment.groupBookingId === groupId && appointment.isGroupRecipient === true, 'This recipient does not belong to the group booking.', 403)
      await authorizeClinicAction(req.user.uid, appointment.branchId, 'appointments:update')
      assertWorkflow(!appointment.startedAt && !appointment.checkedInAt && ['pending approval', 'awaiting payment', 'contract pending', 'paid', 'scheduled'].includes(normalized(appointment.status)), 'Only an upcoming recipient appointment may be reassigned.')
      assertWorkflow(!await getApprovedLeaveForDate(practitionerId, date), 'This practitioner is on approved leave.')
      const prepared = await prepareBooking({ tx, db: firestore, reservation: { ...appointment, practitionerId, assignedPractitionerId: practitionerId, date, time, endTime: '', groupBooking: null }, getBookingRange, rangesOverlap, appointmentId })
      const practitionerSnap = await tx.get(firestore.collection('users').doc(practitionerId)); assertWorkflow(practitionerSnap.exists && String(practitionerSnap.data()?.branchId || '') === String(appointment.branchId || ''), 'Select an eligible practitioner from this branch.', 400)
      const duration = Math.max(30, Number(appointment.totalServiceDurationMinutes || 60)), start = parseClockToMinutes(time), requested = { start, end: start + duration }
      const rows = await tx.get(firestore.collection('appointments').where('branchId', '==', appointment.branchId))
      const conflict = rows.docs.some(docSnap => { const item = docSnap.data() || {}; if (docSnap.id === appointmentId || item.date !== date || String(item.practitionerId || item.assignedPractitionerId || '') !== practitionerId || !BOOKING_BLOCKING_STATUSES.has(normalizeBookingStatus(item.status))) return false; const range = getBookingRange(item); return range && rangesOverlap(requested.start, requested.end, range.start, range.end) })
      assertWorkflow(!conflict, 'That practitioner is already booked at the selected time.', 409)
      const practitioner = practitionerSnap.data() || {}, name = String(practitioner.fullName || `${practitioner.firstName || ''} ${practitioner.lastName || ''}`.trim() || practitioner.email || 'Practitioner')
      const serviceKey = appointment.serviceKey ? String(crypto.randomInt(100000, 1000000)) : null
      tx.set(prepared.lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      for (const lock of prepared.customerLocks || []) tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.update(ref, { ...resetAppointmentAccess(), treatmentTeam: [], staffingRequirements: prepared.data.staffingRequirements, practitionerId, assignedPractitionerId: practitionerId, practitionerName: name, assignedPractitionerName: name, date, time, serviceKey, workerKeyVerified: false, checkedInAt: null, endTime: prepared.data.endTime, reassignedAt: admin.firestore.FieldValue.serverTimestamp(), reassignedById: req.user.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      return { appointmentId, practitionerId, practitionerName: name, date, time, email: appointment.customerEmail, serviceKey }
    })
    if (result.serviceKey) await sendServiceCode(result).catch(error => console.warn('Group reschedule code email failed:', error.message))
    delete result.serviceKey
    delete result.email
    return res.json({ success: true, data: result })
  } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message || 'Unable to assign recipient.' }) }
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

  return res.json({
    success: true,
    message: 'For account safety, registration details are confirmed only after email verification.',
  })
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

  return res.json({
    success: true,
    message: 'If this account needs verification, instructions will be sent to its registered email.',
  })
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

  return res.json({
    success: true,
    message: 'If this account needs verification, instructions will be sent to its registered email.',
  })
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

const recordRegistrationOtpFailure = (transaction, otpRef, otpData, message = 'Invalid OTP. Please try again.') => {
  const attempts = Math.max(0, Number(otpData.attempts || 0)) + 1
  transaction.update(otpRef, {
    attempts,
    used: attempts >= REGISTRATION_OTP_MAX_VERIFY_ATTEMPTS,
    lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { error: attempts >= REGISTRATION_OTP_MAX_VERIFY_ATTEMPTS
    ? 'Too many incorrect codes. Request a new code to continue.'
    : message }
}

app.post(VERIFY_REGISTRATION_OTP_PATH, async (req, res) => {
  const normalizedEmail = String(req.body?.email || '').trim().toLowerCase()
  const normalizedOtp = String(req.body?.otp || '').trim()
  if (!normalizedEmail || !EMAIL_ADDRESS_REGEX.test(normalizedEmail) || !/^\d{6}$/.test(normalizedOtp)) {
    return res.status(400).json({ success: false, error: 'Enter the email address and complete 6-digit code.' })
  }

  try {
    const firestore = admin.firestore()
    const otpRef = getRegistrationOtpDocRef(CLINIC_REGISTRATION_OTP_PURPOSE, normalizedEmail)
    const initialOtp = await otpRef.get()
    if (!initialOtp.exists) return res.status(400).json({ success: false, error: 'No active code was found. Request a new code.' })
    const expectedUid = String(initialOtp.data()?.uid || '').trim()
    if (!expectedUid) return res.status(400).json({ success: false, error: 'No active code was found. Request a new code.' })
    const authUser = await admin.auth().getUser(expectedUid)
    if (String(authUser.email || '').trim().toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ success: false, error: 'This code does not match the registration email.' })
    }

    const userRef = firestore.collection('users').doc(expectedUid)
    const clinicRef = firestore.collection('clinics').doc(expectedUid)
    const outcome = await firestore.runTransaction(async (transaction) => {
      const [otpSnap, userSnap, clinicSnap] = await Promise.all([
        transaction.get(otpRef), transaction.get(userRef), transaction.get(clinicRef),
      ])
      if (!otpSnap.exists) return { error: 'No active code was found. Request a new code.' }
      const otpData = otpSnap.data() || {}
      if (otpData.used) return { error: 'This code has already been used. Request a new code.' }
      const expiresAt = getTimestampDate(otpData.expiresAt)
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        transaction.update(otpRef, { used: true, expiredAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        return { error: 'This code has expired. Request a new code.' }
      }
      if (Number(otpData.attempts || 0) >= REGISTRATION_OTP_MAX_VERIFY_ATTEMPTS) {
        transaction.update(otpRef, { used: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        return { error: 'Too many incorrect codes. Request a new code to continue.' }
      }
      if (String(otpData.uid || '').trim() !== expectedUid || !otpMatches(otpData, normalizedOtp)) {
        return recordRegistrationOtpFailure(transaction, otpRef, otpData)
      }
      if (!userSnap.exists) return { error: 'The registration could not be found. Start again or contact support.' }
      const userData = userSnap.data() || {}
      const clinicData = clinicSnap.data() || {}
      if (!['clinicowner', 'clinicadmin', 'owner'].includes(normalizedRegistrationRole(userData.role || userData.userType))
        || String(userData.email || '').trim().toLowerCase() !== normalizedEmail
        || (clinicSnap.exists && String(clinicData.ownerId || '').trim() !== expectedUid)) {
        return { error: 'This code does not match the registration account.' }
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      const userUpdate = { emailVerified: true, emailVerifiedAt: timestamp, updatedAt: timestamp }
      const clinicUpdate = { updatedAt: timestamp }
      if (String(userData.status || '').toLowerCase().includes('pending otp')) {
        userUpdate.status = 'Pending Document Submission'
        userUpdate.registrationStatus = CLINIC_REGISTRATION_STATUS.PENDING_DOCUMENTS
      }
      if (String(clinicData.approvalStatus || '').toLowerCase().includes('pending otp')) {
        clinicUpdate.approvalStatus = 'Pending Document Submission'
        clinicUpdate.registrationStatus = CLINIC_REGISTRATION_STATUS.PENDING_DOCUMENTS
      }
      transaction.update(userRef, userUpdate)
      if (clinicSnap.exists) transaction.update(clinicRef, clinicUpdate)
      transaction.update(otpRef, { used: true, verifiedAt: timestamp, updatedAt: timestamp })
      return { uid: expectedUid }
    })
    if (outcome.error) return res.status(400).json({ success: false, error: outcome.error })
    const customToken = await admin.auth().createCustomToken(outcome.uid)
    return res.json({ success: true, data: { uid: outcome.uid, customToken } })
  } catch (error) {
    console.error('Clinic registration OTP verification failed:', error?.code || error?.message || error)
    return res.status(400).json({ success: false, error: 'Unable to verify this code. Request a new one and try again.' })
  }
})

app.post(VERIFY_CUSTOMER_OTP_PATH, async (req, res) => {
  const { email, otp } = req.body ?? {}

  if (!adminReady) {
    return res.status(500).json({
      success: false,
      error: adminInitError || 'firebase-admin is not ready',
    })
  }

  const normalizedEmail = String(email || '').trim().toLowerCase()
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
    const firestore = admin.firestore()
    const otpRef = getRegistrationOtpDocRef(CUSTOMER_REGISTRATION_OTP_PURPOSE, normalizedEmail)
    const initialOtp = await otpRef.get()
    const expectedUid = String(initialOtp.data()?.uid || '').trim()
    if (!initialOtp.exists || !expectedUid) {
      return res.status(400).json({ success: false, error: 'No active code was found. Request a new code.' })
    }
    const authUser = await admin.auth().getUser(expectedUid)
    if (String(authUser.email || '').trim().toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ success: false, error: 'Unable to verify this code. Request a new one and try again.' })
    }
    const userRef = firestore.collection('users').doc(expectedUid)
    const otpOutcome = await firestore.runTransaction(async (transaction) => {
      const [otpSnap, userSnap] = await Promise.all([transaction.get(otpRef), transaction.get(userRef)])
      if (!otpSnap.exists || !userSnap.exists) return { error: 'No active code was found. Request a new code.' }
      const otpData = otpSnap.data() || {}
      const userData = userSnap.data() || {}
      if (otpData.used) return { error: 'This code has already been used. Request a new code.' }
      const expiresAt = getTimestampDate(otpData.expiresAt)
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        transaction.update(otpRef, { used: true, expiredAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        return { error: 'This code has expired. Request a new code.' }
      }
      const attempts = Math.max(0, Number(otpData.attempts || 0))
      if (attempts >= REGISTRATION_OTP_MAX_VERIFY_ATTEMPTS) {
        transaction.update(otpRef, { used: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        return { error: 'Too many incorrect codes. Request a new code to continue.' }
      }
      const otpUid = String(otpData.uid || '').trim()
      const role = normalizedRegistrationRole(userData.role || userData.userType)
      const storedEmail = String(userData.email || '').trim().toLowerCase()
      if (otpUid !== expectedUid || storedEmail !== normalizedEmail || role !== 'customer'
        || !otpMatches(otpData, normalizedOtp)) {
        return recordRegistrationOtpFailure(transaction, otpRef, otpData)
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      transaction.update(userRef, {
        status: 'Pending Activation',
        emailVerified: true,
        emailVerifiedAt: timestamp,
        updatedAt: timestamp,
      })
      transaction.update(otpRef, { used: true, verifiedAt: timestamp, updatedAt: timestamp })
      return { uid: expectedUid, fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() }
    })
    if (otpOutcome.error) return res.status(400).json({ success: false, error: otpOutcome.error })
    const resolvedUid = otpOutcome.uid

    console.log('Customer registration OTP verified', {
      uid: resolvedUid,
      email: normalizedEmail,
      maskedTo: maskEmailAddress(normalizedEmail),
      previousStatus: 'pending',
    })

    // Send welcome email to customer (transactional)
    try {
      const subject = 'Welcome to AestheticCare — Activate your account'
      const textBody = `Hi,\n\nWelcome to AestheticCare! Your email has been verified. Please use the activation link in the separate Activate your AesthetiCare account email before logging in.\n\nIf you need help, reply to this email or contact us at ${senderEmail}.\n\nWarm regards,\nThe AestheticCare Team`
      const htmlBody = `
        <div style="font-family:Arial, sans-serif;color:#222;">
          <p>Hi,</p>
          <p><strong>Welcome to AestheticCare!</strong> Your email has been verified.</p>
          <p>Please use the activation link in the separate <strong>Activate your AesthetiCare account</strong> email before logging in.</p>
          <p>If you need help, reply to this email or contact us at <a href="mailto:${senderEmail}">${senderEmail}</a>.</p>
          <p>Warm regards,<br/>The AestheticCare Team</p>
        </div>
      `

      const delivery = await sendPostmarkMessage({ to: normalizedEmail, subject, text: textBody, html: htmlBody })
      console.log('Sent welcome email to customer', { to: maskEmailAddress(normalizedEmail), statusCode: delivery.statusCode, messageId: delivery.messageId })
    } catch (emailErr) {
      console.error('Failed to send customer welcome email:', emailErr)
    }

    try {
      await createAccountActivation({
        firestore,
        uid: resolvedUid,
        email: normalizedEmail,
        name: otpOutcome.fullName || 'Customer',
        req,
      })
    } catch (emailErr) {
      console.error('Failed to send customer activation email:', emailErr)
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

app.post('/auth/registration-profile', requireAuth, async (req, res) => {
  try {
    const data = await trustedRegistrationProfileResponse(String(req.user?.uid || '').trim())
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({
      success: false,
      error: error?.message || 'Failed to load registration progress.',
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

  if (!targetPlan || !['basic', 'premium'].includes(targetPlan)) {
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
    const hasActiveCurrentCycle = hasActivePaidCycle({ ...context.userData, ...context.clinicData }, now)

    if (targetPlan === currentPlan && hasActiveCurrentCycle && !subscriptionLifecycle(context.clinicData).trial) {
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

  if (!targetPlan || !['basic', 'premium'].includes(targetPlan)) {
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
    const hasActiveCurrentCycle = hasActivePaidCycle({ ...context.userData, ...context.clinicData }, now)

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

const OWNER_CLOSURE_RECOVERY_MS = 30 * DAY_MS

const getOwnerClosureClinics = async (firestore, ownerUid) => {
  const [mainClinicSnap, ownedClinicsSnap] = await Promise.all([
    firestore.collection('clinics').doc(ownerUid).get(),
    firestore.collection('clinics').where('ownerId', '==', ownerUid).get(),
  ])
  const clinics = new Map()
  if (mainClinicSnap.exists) clinics.set(mainClinicSnap.id, mainClinicSnap)
  ownedClinicsSnap.forEach((clinicSnap) => clinics.set(clinicSnap.id, clinicSnap))
  return [...clinics.values()]
}

const commitOwnerClosureWrites = async (firestore, writes) => {
  for (let index = 0; index < writes.length; index += 450) {
    const batch = firestore.batch()
    writes.slice(index, index + 450).forEach(({ ref, payload }) => batch.set(ref, payload, { merge: true }))
    await batch.commit()
  }
}

// Closing a clinic is the owner's decision. Data is held for a 30-day recovery
// period, after which the scheduled Firebase cleanup removes it permanently.
app.post('/owner/account/close', requireAuth, async (req, res) => {
  const ownerUid = String(req.user?.uid || '').trim()
  if (!ownerUid) return res.status(401).json({ success: false, error: 'Unauthorized' })

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(ownerUid)
    const userSnap = await userRef.get()
    const owner = userSnap.exists ? userSnap.data() || {} : {}
    if (!isOwnerRoleValue(owner.role || owner.userType)) return res.status(403).json({ success: false, error: 'Forbidden' })

    const clinics = await getOwnerClosureClinics(firestore, ownerUid)
    if (!clinics.length) return res.status(404).json({ success: false, error: 'No clinic is linked to this owner account.' })
    const branchIds = clinics.map((clinicSnap) => clinicSnap.id)
    const staffSnapshots = await Promise.all(branchIds.map((branchId) => firestore.collection('users').where('branchId', '==', branchId).get()))
    const staff = new Map()
    staffSnapshots.forEach((snapshot) => snapshot.forEach((staffSnap) => {
      const staffData = staffSnap.data() || {}
      const userType = String(staffData.userType || '').trim().toLowerCase()
      if (staffSnap.id !== ownerUid && ['staff', 'employee'].includes(userType)) staff.set(staffSnap.id, staffSnap)
    }))

    const now = new Date()
    const recoveryEndsAt = new Date(now.getTime() + OWNER_CLOSURE_RECOVERY_MS)
    const writes = [{
      ref: userRef,
      payload: {
        status: 'Inactive', archived: true, accountClosed: true, accountClosureAction: 'deactivate',
        accountClosedAt: now, accountRecoveryEndsAt: recoveryEndsAt, accountDeletionScheduledFor: recoveryEndsAt,
        clinicClosurePendingDeletion: true, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }]

    clinics.forEach((clinicSnap) => {
      const clinic = clinicSnap.data() || {}
      writes.push({
        ref: clinicSnap.ref,
        payload: {
          isPublished: false,
          wasPublishedBeforeOwnerClosure: clinic.isPublished === true,
          ownerClosurePendingDeletion: true,
          ownerClosureStartedAt: now,
          ownerClosureRecoveryEndsAt: recoveryEndsAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      })
    })

    staff.forEach((staffSnap) => {
      const employee = staffSnap.data() || {}
      writes.push({
        ref: staffSnap.ref,
        payload: {
          status: 'Inactive', archived: true, ownerClosureLocked: true,
          statusBeforeOwnerClosure: String(employee.status || 'Active'),
          archivedBeforeOwnerClosure: employee.archived === true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      })
    })

    await commitOwnerClosureWrites(firestore, writes)
    await Promise.all([...staff.keys()].map((uid) => admin.auth().updateUser(uid, { disabled: true }).catch(() => undefined)))
    await admin.auth().revokeRefreshTokens(ownerUid).catch(() => undefined)

    return res.json({ success: true, data: { recoveryEndsAt: recoveryEndsAt.toISOString(), clinicCount: clinics.length, employeeCount: staff.size } })
  } catch (error) {
    console.error('Owner account closure failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Unable to close this clinic account.' })
  }
})

app.post('/owner/account/restore', requireAuth, async (req, res) => {
  const ownerUid = String(req.user?.uid || '').trim()
  if (!ownerUid) return res.status(401).json({ success: false, error: 'Unauthorized' })

  try {
    const firestore = admin.firestore()
    const userRef = firestore.collection('users').doc(ownerUid)
    const userSnap = await userRef.get()
    const owner = userSnap.exists ? userSnap.data() || {} : {}
    const recoveryEndsAt = toDateValue(owner.accountRecoveryEndsAt)
    const canRestore = isOwnerRoleValue(owner.role || owner.userType)
      && String(owner.status || '').trim().toLowerCase() === 'inactive'
      && owner.accountClosed === true
      && String(owner.accountClosureAction || '').trim().toLowerCase() === 'deactivate'
      && recoveryEndsAt && recoveryEndsAt.getTime() > Date.now()
    if (!canRestore) return res.status(409).json({ success: false, error: 'This account can no longer be restored.' })

    const clinics = await getOwnerClosureClinics(firestore, ownerUid)
    const branchIds = clinics.map((clinicSnap) => clinicSnap.id)
    const staffSnapshots = await Promise.all(branchIds.map((branchId) => firestore.collection('users').where('branchId', '==', branchId).get()))
    const staff = new Map()
    staffSnapshots.forEach((snapshot) => snapshot.forEach((staffSnap) => {
      const staffData = staffSnap.data() || {}
      const userType = String(staffData.userType || '').trim().toLowerCase()
      if (staffSnap.id !== ownerUid && ['staff', 'employee'].includes(userType) && staffData.ownerClosureLocked === true) staff.set(staffSnap.id, staffSnap)
    }))

    const writes = [{
      ref: userRef,
      payload: {
        status: 'Active', archived: false, accountClosed: false, accountClosureAction: null,
        accountRecoveryEndsAt: null, accountDeletionScheduledFor: null, clinicClosurePendingDeletion: false,
        accountReactivatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }]
    clinics.forEach((clinicSnap) => {
      const clinic = clinicSnap.data() || {}
      writes.push({
        ref: clinicSnap.ref,
        payload: {
          isPublished: clinic.wasPublishedBeforeOwnerClosure === true,
          wasPublishedBeforeOwnerClosure: admin.firestore.FieldValue.delete(),
          ownerClosurePendingDeletion: false,
          ownerClosureStartedAt: admin.firestore.FieldValue.delete(),
          ownerClosureRecoveryEndsAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      })
    })
    staff.forEach((staffSnap) => {
      const employee = staffSnap.data() || {}
      const previousStatus = String(employee.statusBeforeOwnerClosure || 'Active')
      writes.push({
        ref: staffSnap.ref,
        payload: {
          status: previousStatus, archived: employee.archivedBeforeOwnerClosure === true,
          ownerClosureLocked: false,
          statusBeforeOwnerClosure: admin.firestore.FieldValue.delete(),
          archivedBeforeOwnerClosure: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      })
    })
    await commitOwnerClosureWrites(firestore, writes)
    await Promise.all([...staff.entries()].map(([uid, staffSnap]) => {
      const employee = staffSnap.data() || {}
      return String(employee.statusBeforeOwnerClosure || 'Active').toLowerCase() === 'active'
        ? admin.auth().updateUser(uid, { disabled: false }).catch(() => undefined)
        : Promise.resolve()
    }))

    return res.json({ success: true, data: { clinicCount: clinics.length, employeeCount: staff.size } })
  } catch (error) {
    console.error('Owner account restoration failed:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Unable to restore this clinic account.' })
  }
})

const authorizeOwnerBackupAccess = async (req, ownerId) => {
  const actorId = String(req.user?.uid || '').trim()
  assertWorkflow(actorId, 'Unauthorized backup request', 401)
  if (actorId === ownerId || req.userContext?.permissions?.has('administrator:full_access')) return

  const context = req.userContext || await loadUserContext(actorId)
  const assignedBranches = [
    context.userData?.branchId,
    ...(Array.isArray(context.userData?.branchIds) ? context.userData.branchIds : []),
  ].map((value) => String(value || '').trim()).filter(Boolean)
  assertWorkflow(assignedBranches.length, 'You are not assigned to this clinic organization.', 403)
  const branchSnaps = await Promise.all(assignedBranches.map((branchId) => admin.firestore().collection('clinics').doc(branchId).get()))
  const belongsToOwner = branchSnaps.some((snap) => snap.exists && String(snap.data()?.ownerId || '').trim() === ownerId)
  assertWorkflow(belongsToOwner, 'You are not allowed to access this clinic backup.', 403)
}

const BACKUP_RESTORE_COLLECTIONS = Object.freeze([
  'users', 'clients', 'appointments', 'transactions', 'attendance', 'payrolls',
  'inventoryItems', 'suppliers', 'purchaseRequests', 'productServicePosts', 'reviews', 'messages',
])

const normalizeBackupRecords = (records, collectionName, ownerId, branchIds) => {
  if (!Array.isArray(records)) throw new Error(`Backup collection ${collectionName} is malformed.`)
  return records.map((record) => {
    const docId = String(record?.docId || record?.id || '').trim()
    assertWorkflow(docId && !docId.includes('/') && docId.length <= 1500, `Backup contains an invalid ${collectionName} record id.`, 400)
    let rawData = record?.data
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      rawData = { ...(record || {}) }
      delete rawData.id
      delete rawData.docId
      delete rawData.data
    }
    const data = deserializeBackupValue(rawData)
    assertWorkflow(data && typeof data === 'object' && !Array.isArray(data), `Backup contains an invalid ${collectionName} record.`, 400)
    if (collectionName === 'clinics') {
      assertWorkflow(String(data.ownerId || '').trim() === ownerId, 'Backup contains a clinic branch outside this organization.', 403)
    } else {
      const recordBranches = [data.branchId, ...(Array.isArray(data.branchIds) ? data.branchIds : [])]
        .map((value) => String(value || '').trim()).filter(Boolean)
      assertWorkflow(recordBranches.some((branchId) => branchIds.has(branchId)), `Backup contains a ${collectionName} record outside this organization.`, 403)
    }
    return { collectionName, docId, data }
  })
}

const readStoredBackupPayload = async ({ firestore, ownerId, backupId }) => {
  const backupSnap = await firestore.collection('backups').doc(backupId).get()
  assertWorkflow(backupSnap.exists, 'Backup was not found.', 404)
  const metadata = backupSnap.data() || {}
  assertWorkflow(String(metadata.ownerId || '').trim() === ownerId, 'You are not allowed to restore this backup.', 403)
  assertWorkflow(metadata.status === 'complete' && String(metadata.storagePath || '').startsWith(`backups/${ownerId}/`), 'This backup is not complete or its file path is invalid.', 409)

  const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
  assertWorkflow(bucketName, 'Firebase Storage bucket is not configured.', 503)
  const [bytes] = await admin.storage().bucket(bucketName).file(metadata.storagePath).download()
  let payload
  try {
    payload = JSON.parse(bytes.toString('utf8'))
  } catch (_error) {
    throw Object.assign(new Error('The backup file is not valid JSON.'), { status: 400 })
  }
  assertWorkflow(String(payload?.ownerId || '').trim() === ownerId, 'Backup data does not match this clinic organization.', 403)
  assertWorkflow(payload?.collections && typeof payload.collections === 'object', 'This backup does not contain restorable clinic collections.', 400)
  return payload
}

app.post('/owner/backup', requireAuth, requirePermission('backups:create'), async (req, res) => {

  const ownerId = String(req.body?.ownerId || '').trim()
  if (!ownerId) {
    return res.status(400).json({
      success: false,
      error: 'ownerId is required',
    })
  }

  let stage = 'authorizing backup access'
  try {
    await authorizeOwnerBackupAccess(req, ownerId)

    const result = await generateOwnerBackup({
      ownerId,
      kind: 'manual',
      triggeredBy: req.user.uid === ownerId ? 'owner' : 'delegated-staff',
      onStage: (nextStage) => { stage = nextStage },
    })
    return res.json({ success: true, data: result })
  } catch (error) {
    const requestId = crypto.randomUUID()
    console.error('Owner backup generation failed:', {
      requestId,
      stage,
      code: error?.code || null,
      status: error?.status || error?.statusCode || null,
      message: error?.message || 'Unknown backup error',
    })
    const status = Number(error?.status || error?.statusCode || error?.code)
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      success: false,
      error: status === 503
        ? 'Backup storage is unavailable or not configured. Check the Firebase Storage bucket and server credentials.'
        : 'The backup could not be completed. Check the server logs for this request.',
      stage,
      requestId,
    })
  }
})

app.get('/owner/backup/schedule', requireAuth, requirePermission('backups:view'), async (req, res) => {
  const ownerId = String(req.query?.ownerId || '').trim()
  if (!ownerId) return res.status(400).json({ success: false, error: 'ownerId is required.' })
  try {
    await authorizeOwnerBackupAccess(req, ownerId)
    return res.json({
      success: true,
      data: {
        enabled: backupScheduleEnabled,
        dailyHour: backupDailyHour,
        monthlyDay: backupMonthlyDay,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
    })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Unable to load backup schedule.' })
  }
})

app.post('/owner/backup/download', requireAuth, requirePermission('backups:view'), async (req, res) => {
  const ownerId = String(req.body?.ownerId || '').trim()
  const storagePath = String(req.body?.storagePath || '').trim()
  const fileName = String(req.body?.fileName || 'backup').trim().replace(/\.json$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 100)
  if (!ownerId || !storagePath) {
    return res.status(400).json({ success: false, error: 'ownerId and storagePath are required.' })
  }
  if (!storagePath.startsWith(`backups/${ownerId}/`)) {
    return res.status(403).json({ success: false, error: 'Unauthorized backup path.' })
  }

  try {
    await authorizeOwnerBackupAccess(req, ownerId)
    const bucketName = firebaseStorageBucket || admin.app().options.storageBucket
    if (!bucketName) return res.status(500).json({ success: false, error: 'Firebase Storage bucket is not configured.' })
    const [jsonBuffer] = await admin.storage().bucket(bucketName).file(storagePath).download()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=\"${fileName || 'backup'}.json\"`)
    return res.status(200).send(jsonBuffer)
  } catch (error) {
    console.error('Failed to download clinic backup:', error)
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Failed to download backup.' })
  }
})

app.post('/owner/backup/restore', requireAuth, requirePermission('backups:create'), async (req, res) => {
  const ownerId = String(req.body?.ownerId || '').trim()
  const backupId = String(req.body?.backupId || '').trim()
  const actorId = String(req.user?.uid || '').trim()
  if (!ownerId || !backupId) return res.status(400).json({ success: false, error: 'ownerId and backupId are required.' })
  if (req.body?.confirmRestore !== true) return res.status(400).json({ success: false, error: 'Confirm the restore before continuing.' })

  try {
    assertWorkflow(actorId === ownerId || req.userContext?.permissions?.has('administrator:full_access'), 'Only the clinic owner can restore clinic records.', 403)
    await authorizeOwnerBackupAccess(req, ownerId)

    const firestore = admin.firestore()
    const payload = await readStoredBackupPayload({ firestore, ownerId, backupId })
    const clinicRecords = normalizeBackupRecords(payload.clinics || [], 'clinics', ownerId, new Set())
    const branchIds = new Set(clinicRecords.map((record) => record.docId))
    const restoreRecords = [...clinicRecords]

    for (const collectionName of BACKUP_RESTORE_COLLECTIONS) {
      const records = payload.collections[collectionName]
      if (records === undefined) continue
      restoreRecords.push(...normalizeBackupRecords(records, collectionName, ownerId, branchIds))
    }

    const counts = {}
    let restoredRecords = 0
    let skippedExistingRecords = 0
    for (const collectionName of [...new Set(restoreRecords.map((record) => record.collectionName))]) {
      const records = restoreRecords.filter((record) => record.collectionName === collectionName)
      counts[collectionName] = { restored: 0, alreadyPresent: 0 }
      for (let offset = 0; offset < records.length; offset += 400) {
        const chunk = records.slice(offset, offset + 400)
        const refs = chunk.map((record) => firestore.collection(collectionName).doc(record.docId))
        const existing = await firestore.getAll(...refs)
        const missing = chunk.filter((_record, index) => !existing[index]?.exists)
        const presentCount = chunk.length - missing.length
        skippedExistingRecords += presentCount
        counts[collectionName].alreadyPresent += presentCount
        if (!missing.length) continue

        const batch = firestore.batch()
        missing.forEach((record) => {
          batch.create(firestore.collection(collectionName).doc(record.docId), record.data)
        })
        await batch.commit()
        restoredRecords += missing.length
        counts[collectionName].restored += missing.length
      }
    }

    const summary = { restoredRecords, skippedExistingRecords, byCollection: counts }
    await firestore.collection('backupRestoreLogs').add({
      ownerId,
      backupId,
      actorId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...summary,
    }).catch((error) => console.error('Failed to write backup restore audit log:', error?.code || error?.message || error))

    return res.json({ success: true, data: summary })
  } catch (error) {
    const status = Number(error?.status || error?.statusCode || error?.code)
    if (status >= 500 || !Number.isFinite(status)) {
      console.error('Clinic backup restore failed:', {
        ownerId,
        backupId,
        code: error?.code || null,
        message: error?.message || 'Unknown restore error',
      })
    }
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      success: false,
      error: status === 503
        ? 'Firebase Storage is unavailable. The backup file could not be read.'
        : error?.message || 'Unable to restore clinic records.',
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
    await authorizeOwnerBackupAccess(req, ownerId)

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

app.post(ATTENDANCE_MY_RECORDS_PATH, requireAuth, requireAttendanceClockingAccess, async (req, res) => {
  try {
    const firestore = admin.firestore()
    const userSnap = await firestore.collection('users').doc(req.user.uid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const branchId = String(userData.branchId || '').trim()
    demand(userSnap.exists && branchId, 'Your employee account is not assigned to a branch.', 403)
    demand(!userData.archived && String(userData.status || '').toLowerCase() === 'active', 'An active employee account is required.', 403)
    demand(await resolveBranchAccess(req.user.uid, branchId), 'You are not assigned to this branch.', 403)
    await assertClinicPlanFeature(firestore, branchId, 'attendance')

    const today = manilaDateKey()
    const snapshot = await firestore.collection('attendance').where('employeeId', '==', req.user.uid).get()
    const history = snapshot.docs
      .map((record) => ({ id: record.id, ...(record.data() || {}) }))
      .filter((record) => String(record.branchId || '') === branchId)
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
      .slice(0, 7)
    const record = history.find((entry) => entry.date === today) || null
    return res.json({ success: true, data: { record, history } })
  } catch (error) {
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Unable to load your attendance records.' })
  }
})

app.post(ATTENDANCE_RECORD_PATH, requireAuth, requireAttendanceClockingAccess, async (req, res) => {
  const { branchId, qrToken, latitude, longitude, accuracy, proofStoragePath, proofUrl, requestId, intent } = req.body ?? {}
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(requestId || ''))) return res.status(400).json({ success: false, error: 'A scan request ID is required.' })
  const normalizedBranchId = String(branchId || '').trim()
  if (!normalizedBranchId || !qrToken) {
    return res.status(400).json({ success: false, error: 'branchId and qrToken are required' })
  }
  const dateKey = manilaDateKey()
  const expectedProofPrefix = `attendanceProofs/${normalizedBranchId}/${req.user.uid}/${dateKey}/`
  if (!String(proofStoragePath || '').startsWith(expectedProofPrefix)) {
    return res.status(400).json({ success: false, error: 'A current attendance photo proof is required.' })
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
    await assertClinicPlanFeature(firestore, normalizedBranchId, 'attendance')
    demand(userSnap.exists && !userData.archived && String(userData.status || '').toLowerCase() === 'active', 'An active employee account is required.', 403)
    const proofObject = admin.storage().bucket(firebaseStorageBucket || admin.app().options.storageBucket).file(String(proofStoragePath))
    const [proofMetadata] = await proofObject.getMetadata()
    demand(/^image\/(jpeg|png|webp)$/.test(proofMetadata.contentType || '') && Number(proofMetadata.size) <= 5 * 1024 * 1024 && Date.now() - Date.parse(proofMetadata.timeCreated) <= 180000, 'A recently captured attendance photo is required.')
    if (!branchSnap.exists || !await resolveBranchAccess(req.user.uid, normalizedBranchId)) {
      return res.status(403).json({ success: false, error: 'You are not assigned to this branch.' })
    }
    const assignedBranches = new Set([userData.branchId, ...(Array.isArray(userData.branchIds) ? userData.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))
    if (!assignedBranches.has(normalizedBranchId)) {
      return res.status(403).json({ success: false, error: 'Your employee profile is not assigned to this branch.' })
    }

    let attendanceDate = dateKey
    const previousDate = new Date(Date.parse(`${dateKey}T12:00:00+08:00`) - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    const previousRecord = await firestore.collection('attendance').doc(`${req.user.uid}_${previousDate}`).get()
    if (previousRecord.data()?.timeIn && !previousRecord.data()?.timeOut) {
      const previousSchedule = await loadAttendanceSchedule(req.user.uid, previousDate)
      if (previousSchedule.shiftStart && previousSchedule.shiftEnd && clock(previousSchedule.shiftEnd) < clock(previousSchedule.shiftStart)) attendanceDate = previousDate
      else demand(intent !== 'clock_out', 'An earlier incomplete shift requires HR review.', 409)
    }
    const approvedLeave = await getApprovedLeaveForDate(req.user.uid, attendanceDate)
    if (approvedLeave) {
      return res.status(409).json({
        success: false,
        code: 'APPROVED_LEAVE',
        error: `Attendance is unavailable because you are on approved ${String(approvedLeave.leaveType || 'leave').toLowerCase()}.`,
        leaveId: approvedLeave.id,
      })
    }

    const qrSnap = await firestore.collection('attendanceDailyQRCodes').doc(`${normalizedBranchId}_${dateKey}`).get()
    const qrData = qrSnap.exists ? qrSnap.data() || {} : {}
    const expiresAtMs = typeof qrData.expiresAt?.toDate === 'function' ? qrData.expiresAt.toDate().getTime() : Number(qrData.expiresAt || 0)
    if (!qrSnap.exists || String(qrData.token || '') !== String(qrToken).trim() || !expiresAtMs || expiresAtMs <= Date.now()) {
      return res.status(400).json({ success: false, error: 'The attendance QR is invalid or expired.' })
    }

    const distanceMeters = verifyLocation(req.body, branch)
    const hasLocation = true
    const accuracyNumber = accuracy


    const schedule = await loadAttendanceSchedule(req.user.uid, attendanceDate)
    if (schedule.onLeave) {
      return res.status(409).json({
        success: false,
        code: 'APPROVED_LEAVE',
        error: `Attendance is unavailable because you are on approved ${String(schedule.leaveType || 'leave').toLowerCase()}.`,
        leaveId: schedule.leaveId,
      })
    }
    if (!String(schedule.shiftLabel || '').trim() || String(schedule.shiftLabel).trim().toLowerCase() === 'off') {
      return res.status(409).json({
        success: false,
        code: 'SCHEDULED_DAY_OFF',
        error: 'Attendance is unavailable because today is your scheduled day off.',
      })
    }
    const attendanceRef = firestore.collection('attendance').doc(`${req.user.uid}_${attendanceDate}`)
    const receiptRef = firestore.collection('attendanceScanReceipts').doc(`${req.user.uid}_${requestId}`)
    const proofClaim = firestore.collection('attendanceProofClaims').doc(crypto.createHash('sha256').update(String(proofStoragePath)).digest('hex'))
    const result = await firestore.runTransaction(async (transaction) => {
      const receipt = await transaction.get(receiptRef)
      if (receipt.exists) return receipt.data().result
      demand(!(await transaction.get(proofClaim)).exists, 'This photo was already used. Capture a fresh attendance photo.', 409)
      const challenge = await transaction.get(qrSnap.ref)
      demand(challenge.data()?.token === qrToken && challenge.data()?.expiresAt?.toMillis() > Date.now(), 'The QR expired. Scan the current QR again.')
      const existingSnap = await transaction.get(attendanceRef)
      const existing = existingSnap.exists ? existingSnap.data() || {} : {}
      demand(!existing.branchId || existing.branchId === normalizedBranchId, 'Clock out at the branch where you clocked in.', 409)
      scanAction(existing, intent, Date.now())
      const now = admin.firestore.Timestamp.now()
      const actualTimeIn = existing.timeIn || manilaTimeLabel()
      const attendanceTiming = calculateShiftStartAlignment(actualTimeIn, schedule.shiftStart)
      const next = {
        employeeId: req.user.uid,
        employeeName: String(userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`).trim() || userData.email || 'Employee',
        role: userData.customRoleName || userData.role || 'Staff',
        branchId: normalizedBranchId,
        date: attendanceDate,
        attendanceMethod: 'qr_gps',
        source: 'built_in',
        qrToken: String(qrToken).trim(),
        shiftLabel: schedule.shiftLabel,
        shiftStart: schedule.shiftStart,
        shiftEnd: schedule.shiftEnd,
        unpaidMealBreakMinutes: schedule.unpaidMealBreakMinutes,
        payrollTimeIn: existing.payrollTimeIn || attendanceTiming.payrollTimeIn,
        earlyMinutes: existing.earlyMinutes ?? attendanceTiming.earlyMinutes,
        lateMinutes: existing.lateMinutes ?? attendanceTiming.lateMinutes,
        attendanceStatus: existing.attendanceStatus || attendanceTiming.attendanceStatus,
        locationVerified: hasLocation,
        locationAccuracyMeters: Number.isFinite(accuracyNumber) ? Math.round(accuracyNumber) : null,
        locationDistanceMeters: distanceMeters,
        proofStoragePath: String(proofStoragePath),
        proofUrl: '',
        updatedAt: now,
        createdAt: existing.createdAt || now,
      }
      if (!existing.timeIn) {
        next.timeInEpoch = now.toMillis()
        next.timeIn = actualTimeIn
        next.status = 'Logged'
        next.action = 'clock_in'
      } else if (!existing.timeOut) {
        next.timeOutEpoch = now.toMillis()
        next.totalWorkedMinutes = existing.timeInEpoch ? Math.round((now.toMillis() - existing.timeInEpoch) / 60000) : null
        next.timeIn = existing.timeIn
        next.timeOut = manilaTimeLabel()
        next.status = 'Logged'
        next.action = 'clock_out'
      } else {
        return { alreadyComplete: true }
      }
      transaction.set(attendanceRef, next, { merge: true })
      transaction.create(receiptRef, { employeeId: req.user.uid, createdAt: now, result: { ...next, alreadyComplete: false } })
      transaction.create(proofClaim, { employeeId: req.user.uid, attendanceId: attendanceRef.id, createdAt: now })
      return { ...next, alreadyComplete: false }
    })
    if (result.alreadyComplete) return res.status(409).json({ success: false, error: 'Attendance is already complete for today.' })
    return res.json({ success: true, action: result.action, record: result })
  } catch (error) {
    console.error('Attendance record failed:', error)
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to record attendance.' })
  }
})

// QR challenges are issued only by the trusted backend. The value is short
// lived and tied to one branch, so a screenshot cannot be reused indefinitely.
app.post(ATTENDANCE_QR_PATH, requireAuth, requirePermission('attendance:update'), async (req, res) => {
  const normalizedBranchId = String(req.body?.branchId || '').trim()
  const forceRefresh = req.body?.forceRefresh === true
  if (!normalizedBranchId) return res.status(400).json({ success: false, error: 'branchId is required' })
  try {
    if (!await resolveBranchAccess(req.user.uid, normalizedBranchId)) {
      return res.status(403).json({ success: false, error: 'You cannot manage attendance for this branch.' })
    }
    const firestore = admin.firestore()
    await assertClinicPlanFeature(firestore, normalizedBranchId, 'attendance')
    const branchSnap = await firestore.collection('clinics').doc(normalizedBranchId).get()
    if (!branchSnap.exists) return res.status(404).json({ success: false, error: 'Branch not found.' })
    const dateKey = manilaDateKey()
    const qrRef = firestore.collection('attendanceDailyQRCodes').doc(`${normalizedBranchId}_${dateKey}`)
    const now = Date.now()
    const result = await firestore.runTransaction(async transaction => {
    const currentSnap = await transaction.get(qrRef)
    const current = currentSnap.exists ? currentSnap.data() || {} : {}
    const currentExpiry = typeof current.expiresAt?.toDate === 'function' ? current.expiresAt.toDate().getTime() : Number(current.expiresAt || 0)
    if (!forceRefresh && current.token && currentExpiry > now + 15_000) {
      return { qrPayload: current.qrPayload, date: current.date, expiresAt: currentExpiry }
    }
    demand(!current.issuedAtMs || now - current.issuedAtMs >= 15000, 'Wait 15 seconds before refreshing the QR again.', 429)
    const expiresAt = now + 5 * 60 * 1000
    const branch = branchSnap.data() || {}
    const payload = {
      type: 'attendance-qr',
      branchId: normalizedBranchId,
      branchLabel: `${branch.clinicBranch || 'Branch'}${branch.clinicLocation ? ` - ${branch.clinicLocation}` : ''}`,
      date: dateKey,
      token: crypto.randomBytes(24).toString('base64url'),
      expiresAt,
    }
    const qrPayload = JSON.stringify(payload)
    transaction.set(qrRef, { ...payload, qrPayload, issuedAtMs: now, issuedBy: req.user.uid, expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt), createdAt: current.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    return { qrPayload, date: dateKey, expiresAt }
    })
    return res.json({ success: true, ...result })
  } catch (error) {
    console.error('Attendance QR issuance failed:', error)
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to issue attendance QR.' })
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

const handleAccountWelcome = async (req, res) => {
  const { recipient, fullName, defaultPassword, uid } = req.body ?? {}

  const normalizedRecipient = String(recipient || '').trim().toLowerCase()
  const accountLabel = 'Staff'
  const safeName = String(fullName || accountLabel).trim() || accountLabel
  const safePassword = String(defaultPassword || '').trim()

  if (!normalizedRecipient || !safePassword) {
    return res.status(400).json({
      success: false,
      error: 'recipient and defaultPassword are required',
    })
  }

  if (!postmarkClient || !senderEmail) {
    if (isDevelopment) {
      console.warn(`[DEV ${accountLabel.toUpperCase()} EMAIL BYPASS] Welcome email not sent to ${normalizedRecipient}.`)
      return res.json({ success: true, devMode: true })
    }
    return res.status(500).json({
      success: false,
      error: 'POSTMARK_API_TOKEN or POSTMARK_SENDER is missing',
    })
  }

  try {
    if (!uid) return res.status(400).json({ success: false, error: 'uid is required' })
    const activation = await createAccountActivation({
      firestore: admin.firestore(),
      uid: String(uid).trim(),
      email: normalizedRecipient,
      name: safeName,
      req,
      temporaryPassword: safePassword,
    })
    return res.json({ success: true, ...activation.delivery })

    const loginUrl = `${EMAIL_WEBSITE_URL}/login`
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
      console.warn(`[DEV ${accountLabel.toUpperCase()} EMAIL BYPASS] Postmark failed for ${normalizedRecipient}.`)
      return res.json({ success: true, devMode: true, warning: providerMessage })
    }
    return res.status(500).json({ success: false, error: providerMessage })
  }
}

app.post(STAFF_WELCOME_PATH, requireAuth, requirePermission('staff:create'), handleAccountWelcome)

// Save a clinic role's permissions through the trusted backend so the role
// record and every employee's Firestore-rule snapshot stay in sync. The
// browser cannot update copied effectivePermissions directly because that
// would let a role manager invent grants outside the clinic role itself.
app.put('/clinic-roles/:roleId/permissions', requireAuth, requirePermission('roles:manage'), async (req, res) => {
  try {
    const roleId = String(req.params.roleId || '').trim()
    const requestedPermissions = req.body?.permissions
    if (!roleId || !Array.isArray(requestedPermissions) || requestedPermissions.length > 100) {
      return res.status(400).json({ success: false, error: 'Provide a valid clinic role and permission list.' })
    }

    const requestedPermissionSet = [...new Set(requestedPermissions
      .map((permission) => String(permission || '').trim())
      .filter((permission) => permission && CLINIC_ROLE_PERMISSION_KEYS.has(permission)))]
    const invalidPermissions = requestedPermissions
      .map((permission) => String(permission || '').trim())
      .filter((permission) => permission && !CLINIC_ROLE_PERMISSION_KEYS.has(permission))
    if (invalidPermissions.length) {
      return res.status(400).json({ success: false, error: 'One or more permissions are not assignable to clinic staff.' })
    }
    const permissions = [...new Set(expandClinicRolePermissions(requestedPermissionSet))]

    const firestore = admin.firestore()
    const roleRef = firestore.collection('clinicRoles').doc(roleId)
    const roleSnap = await roleRef.get()
    if (!roleSnap.exists) return res.status(404).json({ success: false, error: 'Clinic role not found.' })
    const ownerId = String(roleSnap.data()?.ownerId || '').trim()
    if (!ownerId) return res.status(400).json({ success: false, error: 'Clinic role has no organization owner.' })

    const actor = req.userContext || await loadUserContext(req.user.uid)
    const actorIsOwner = actor.roleKey === 'Owner' && actor.uid === ownerId
    let actorBelongsToOwner = String(actor.userData?.organizationOwnerId || '').trim() === ownerId
    if (!actorBelongsToOwner && !actorIsOwner) {
      const actorBranchIds = [...new Set([
        actor.userData?.branchId,
        ...(Array.isArray(actor.userData?.branchIds) ? actor.userData.branchIds : []),
      ].map((id) => String(id || '').trim()).filter(Boolean))]
      const actorBranches = await Promise.all(actorBranchIds.map((id) => firestore.collection('clinics').doc(id).get()))
      actorBelongsToOwner = actorBranches.some((branch) => branch.exists && String(branch.data()?.ownerId || '').trim() === ownerId)
    }
    if (!actorIsOwner && !actorBelongsToOwner) {
      return res.status(403).json({ success: false, error: 'You are not authorized to manage roles for this clinic.' })
    }

    await roleRef.update({
      permissions,
      permissionModelVersion: 2,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    const [primaryAssignments, multiAssignments] = await Promise.all([
      firestore.collection('users').where('customRoleId', '==', roleId).get(),
      firestore.collection('users').where('customRoleIds', 'array-contains', roleId).get(),
    ])
    const assignedUsers = new Map()
    ;[...primaryAssignments.docs, ...multiAssignments.docs].forEach((userDoc) => assignedUsers.set(userDoc.id, userDoc))

    const rolePermissionCache = new Map([[roleId, permissions]])
    const clinicOwnerCache = new Map()
    const staffBelongsToOwner = async (userData) => {
      const storedOwnerId = String(userData.organizationOwnerId || '').trim()
      if (storedOwnerId) return storedOwnerId === ownerId
      const branchIds = [...new Set([
        userData.branchId,
        ...(Array.isArray(userData.branchIds) ? userData.branchIds : []),
      ].map((id) => String(id || '').trim()).filter(Boolean))]
      const branchOwners = await Promise.all(branchIds.map(async (branchId) => {
        if (!clinicOwnerCache.has(branchId)) {
          clinicOwnerCache.set(branchId, firestore.collection('clinics').doc(branchId).get())
        }
        const branchSnap = await clinicOwnerCache.get(branchId)
        return String(branchSnap.data()?.ownerId || '').trim()
      }))
      return branchOwners.includes(ownerId)
    }
    const staffUpdates = []
    for (const userDoc of assignedUsers.values()) {
      const userData = userDoc.data() || {}
      const userType = String(userData.userType || '').trim().toLowerCase()
      if (userType !== 'staff' && userType !== 'employee') continue
      if (!await staffBelongsToOwner(userData)) continue

      const assignedRoleIds = [...new Set([
        ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
        userData.customRoleId,
      ].map((id) => String(id || '').trim()).filter(Boolean))]
      const missingRoleIds = assignedRoleIds.filter((id) => !rolePermissionCache.has(id))
      const roleSnaps = await Promise.all(missingRoleIds.map((id) => firestore.collection('clinicRoles').doc(id).get()))
      roleSnaps.forEach((snap) => {
        const roleData = snap.exists ? snap.data() || {} : {}
        rolePermissionCache.set(snap.id, Array.isArray(roleData.permissions) ? roleData.permissions : [])
      })

      const effectivePermissions = [...new Set([
        ...defaultClinicRolePermissions,
        ...(Array.isArray(userData.permissions) ? userData.permissions : []),
        ...assignedRoleIds.flatMap((id) => expandClinicRolePermissions(rolePermissionCache.get(id) || [])),
      ].map((permission) => String(permission || '').trim())
        .filter((permission) => permission && CLINIC_ROLE_PERMISSION_KEYS.has(permission)))]
      staffUpdates.push({ ref: userDoc.ref, effectivePermissions })
    }

    for (let offset = 0; offset < staffUpdates.length; offset += 400) {
      const batch = firestore.batch()
      staffUpdates.slice(offset, offset + 400).forEach(({ ref, effectivePermissions }) => {
        batch.update(ref, {
          effectivePermissions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
      await batch.commit()
    }

    return res.json({ success: true, data: { roleId, updatedStaffCount: staffUpdates.length } })
  } catch (error) {
    console.error('Failed to save clinic role permissions:', error)
    return res.status(error.status || 500).json({ success: false, error: 'Unable to save role permissions right now.' })
  }
})

// Trusted multi-branch assignment: the browser never decides organizational scope.
app.post('/staff/:userId/branch-assignments', requireAuth, requirePermission('staff:update'), async (req, res) => {
  try {
    const targetId = String(req.params.userId || '').trim()
    const branchIds = [...new Set((Array.isArray(req.body?.branchIds) ? req.body.branchIds : []).map((id) => String(id || '').trim()).filter(Boolean))]
    if (!targetId || !branchIds.length || branchIds.length > 100) return res.status(400).json({ success: false, error: 'Select between 1 and 100 assigned branches.' })
    const firestore = admin.firestore()
    const targetRef = firestore.collection('users').doc(targetId)
    const [targetSnap, branchSnaps] = await Promise.all([targetRef.get(), Promise.all(branchIds.map((id) => firestore.collection('clinics').doc(id).get()))])
    if (!targetSnap.exists || String(targetSnap.data()?.userType || '').toLowerCase() !== 'staff') return res.status(404).json({ success: false, error: 'Staff account not found.' })
    if (branchSnaps.some((snap) => !snap.exists)) return res.status(400).json({ success: false, error: 'One or more selected branches do not exist.' })
    const branches = branchSnaps.map((snap) => ({ id: snap.id, ...(snap.data() || {}) }))
    const ownerId = String(branches[0].ownerId || '').trim()
    if (!ownerId || branches.some((branch) => String(branch.ownerId || '') !== ownerId)) return res.status(403).json({ success: false, error: 'Employees may only be assigned to branches in one clinic organization.' })
    const currentBranchId = String(targetSnap.data()?.branchId || '').trim()
    if (currentBranchId) {
      const currentBranch = await firestore.collection('clinics').doc(currentBranchId).get()
      if (currentBranch.exists && String(currentBranch.data()?.ownerId || '') !== ownerId) {
        return res.status(403).json({ success: false, error: 'An employee cannot be moved between clinic organizations.' })
      }
    }
    const actor = await loadUserContext(req.user.uid)
    const actorIsOwner = String(actor.roleKey || '') === 'Owner' && req.user.uid === ownerId
    if (!actorIsOwner && !(await Promise.all(branchIds.map((id) => resolveBranchAccess(req.user.uid, id)))).every(Boolean)) return res.status(403).json({ success: false, error: 'You are not authorized for every selected branch.' })
    await targetRef.update({ branchId: branchIds[0], branchIds, organizationOwnerId: ownerId, clinicLocation: branches[0].clinicLocation || '', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    res.json({ success: true, data: { branchId: branchIds[0], branchIds } })
  } catch (error) { res.status(error.status || 500).json({ success: false, error: 'Unable to update employee branch assignments.' }) }
})

app.patch('/staff/:userId/status', requireAuth, async (req, res) => {
  try {
    const actor = await loadUserContext(req.user.uid)
    assertWorkflow(actor.permissions.has('staff:disable') || actor.permissions.has('administrator:full_access'), 'You do not have permission to change employee access status.', 403)
    const firestore = admin.firestore()
    const targetRef = firestore.collection('users').doc(String(req.params.userId || '').trim())
    const target = await targetRef.get()
    assertWorkflow(target.exists && String(target.data()?.userType || '').toLowerCase() === 'staff', 'Employee profile not found.', 404)
    const employee = target.data() || {}
    const branchIds = [...new Set([employee.branchId, ...(Array.isArray(employee.branchIds) ? employee.branchIds : [])].map(value => String(value || '').trim()).filter(Boolean))]
    const currentBranch = branchIds.length ? await firestore.collection('clinics').doc(branchIds[0]).get() : null
    const ownerId = String(employee.organizationOwnerId || currentBranch?.data()?.ownerId || '').trim()
    const actorIsOwner = actor.roleKey === 'Owner' && req.user.uid === ownerId
    if (!actorIsOwner) assertWorkflow((await Promise.all(branchIds.map(id => resolveBranchAccess(req.user.uid, id)))).some(Boolean), 'You are not authorized to update this employee.', 403)
    const status = String(req.body?.status || '').trim()
    assertWorkflow(['Pending Activation', 'Active', 'Inactive'].includes(status), 'Choose a valid employee status.', 400)
    await targetRef.update({
      status,
      archived: status === 'Inactive',
      archivedAt: status === 'Inactive' ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return res.json({ success: true, data: { id: target.id, status, archived: status === 'Inactive' } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to change employee access status.' })
  }
})

// Employee profile writes use the same server-side custom-role resolver as
// authenticated APIs. Firestore rules intentionally validate a materialized
// permission snapshot, which can lag a clinic role update in an open browser.
app.patch('/staff/:userId/profile', requireAuth, async (req, res) => {
  try {
    const actor = await loadUserContext(req.user.uid)
    const permissions = actor.permissions
    assertWorkflow(permissions.has('staff:update') || permissions.has('administrator:full_access'), 'You do not have permission to update employee profiles.', 403)

    const targetId = String(req.params.userId || '').trim()
    const firestore = admin.firestore()
    const targetRef = firestore.collection('users').doc(targetId)
    const targetSnap = await targetRef.get()
    if (!targetSnap.exists || String(targetSnap.data()?.userType || '').toLowerCase() !== 'staff') {
      return res.status(404).json({ success: false, error: 'Employee profile not found.' })
    }
    const current = targetSnap.data() || {}
    const currentBranchIds = [...new Set([current.branchId, ...(Array.isArray(current.branchIds) ? current.branchIds : [])].map(value => String(value || '').trim()).filter(Boolean))]
    const selectedBranchIds = [...new Set((Array.isArray(req.body?.branchIds) ? req.body.branchIds : currentBranchIds).map(value => String(value || '').trim()).filter(Boolean))]
    if (!selectedBranchIds.length || selectedBranchIds.length > 100) return res.status(400).json({ success: false, error: 'Select between 1 and 100 assigned branches.' })

    const [currentBranchSnaps, branchSnaps] = await Promise.all([
      Promise.all(currentBranchIds.map(id => firestore.collection('clinics').doc(id).get())),
      Promise.all(selectedBranchIds.map(id => firestore.collection('clinics').doc(id).get())),
    ])
    const allBranchSnaps = [...currentBranchSnaps, ...branchSnaps]
    if (allBranchSnaps.some(snapshot => !snapshot.exists)) return res.status(400).json({ success: false, error: 'One or more employee branches do not exist.' })
    const allBranches = allBranchSnaps.map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) }))
    const ownerId = String(allBranches[0]?.ownerId || '').trim()
    if (!ownerId || allBranches.some(branch => String(branch.ownerId || '') !== ownerId)
      || (current.organizationOwnerId && String(current.organizationOwnerId) !== ownerId)) {
      return res.status(403).json({ success: false, error: 'Employee branches must belong to the same clinic organization.' })
    }
    const actorIsOwner = actor.roleKey === 'Owner' && req.user.uid === ownerId
    if (!actorIsOwner && !(await Promise.all(currentBranchIds.map(id => resolveBranchAccess(req.user.uid, id)))).some(Boolean)) {
      return res.status(403).json({ success: false, error: 'You are not authorized to update this employee.' })
    }
    if (!actorIsOwner && !(await Promise.all(selectedBranchIds.map(id => resolveBranchAccess(req.user.uid, id)))).every(Boolean)) {
      return res.status(403).json({ success: false, error: 'You are not authorized for every selected branch.' })
    }

    const text = (value, max = 250) => String(value ?? '').trim().slice(0, max)
    const firstName = text(req.body?.firstName, 100)
    const middleName = text(req.body?.middleName, 100)
    const lastName = text(req.body?.lastName, 100)
    const suffix = text(req.body?.suffix, 50)
    const email = text(req.body?.email, 320).toLowerCase()
    const phoneNumber = text(req.body?.phoneNumber, 30)
    const engagementType = text(req.body?.engagementType, 40).toLowerCase()
    const employmentType = text(req.body?.employmentType, 40)
    const weeklyHoursTarget = Number(req.body?.weeklyHoursTarget)
    const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u
    const suffixPattern = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u
    if (!namePattern.test(firstName) || !namePattern.test(lastName)
      || (middleName && !namePattern.test(middleName)) || (suffix && !suffixPattern.test(suffix))) {
      return res.status(400).json({ success: false, error: 'Enter valid employee name details.' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' })
    if (!/^\+639\d{9}$/.test(phoneNumber)) return res.status(400).json({ success: false, error: 'Enter a valid Philippine mobile number.' })
    if (!['employee', 'student_intern'].includes(engagementType)
      || (engagementType === 'employee' && !['Full-time', 'Part-time'].includes(employmentType))
      || (engagementType === 'student_intern' && employmentType !== 'Intern')
      || !Number.isFinite(weeklyHoursTarget) || weeklyHoursTarget < 1 || weeklyHoursTarget > 48
      || Math.round(weeklyHoursTarget * 2) !== weeklyHoursTarget * 2
      || (engagementType === 'employee' && employmentType === 'Full-time' && weeklyHoursTarget < 40)
      || (engagementType === 'employee' && employmentType === 'Part-time' && weeklyHoursTarget >= 40)) {
      return res.status(400).json({ success: false, error: 'Enter valid employment type and agreed weekly hours (maximum 48).' })
    }

    const uniqueLocations = [...new Map(selectedBranchIds.map(id => {
      const location = text(allBranches.find(branch => branch.id === id)?.clinicLocation, 250)
      return [location.toLocaleLowerCase(), location]
    }).filter(([key, value]) => key && value)).values()]
    const updates = {
      firstName, middleName: middleName || null, lastName, suffix: suffix || null,
      fullName: [firstName, middleName, lastName, suffix].filter(Boolean).join(' ').trim(), email, phoneNumber,
      engagementType, employmentType, weeklyHoursTarget,
      branchId: selectedBranchIds[0], branchIds: selectedBranchIds, organizationOwnerId: ownerId,
      clinicBranch: text(allBranches.find(branch => branch.id === selectedBranchIds[0])?.clinicBranch, 150),
      clinicLocation: uniqueLocations.join(', '), clinicLocations: uniqueLocations,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (req.body?.status !== undefined && String(req.body.status) !== String(current.status || '')) {
      assertWorkflow(permissions.has('staff:disable') || permissions.has('administrator:full_access'), 'You do not have permission to change employee access status.', 403)
      const status = text(req.body.status, 40)
      assertWorkflow(['Pending Activation', 'Active', 'Inactive'].includes(status), 'Choose a valid employee status.', 400)
      Object.assign(updates, { status, archived: status === 'Inactive', archivedAt: status === 'Inactive' ? admin.firestore.FieldValue.serverTimestamp() : null })
    }

    if (Array.isArray(req.body?.customRoleIds)) {
      assertWorkflow(permissions.has('roles:manage') || permissions.has('administrator:full_access'), 'You do not have permission to change employee roles.', 403)
      const customRoleIds = [...new Set(req.body.customRoleIds.map(value => String(value || '').trim()).filter(Boolean))]
      assertWorkflow(customRoleIds.length > 0 && customRoleIds.length <= 20, 'Assign at least one valid clinic role.', 400)
      const roleSnaps = await Promise.all(customRoleIds.map(id => firestore.collection('clinicRoles').doc(id).get()))
      assertWorkflow(roleSnaps.every(snapshot => snapshot.exists && String(snapshot.data()?.ownerId || '') === ownerId), 'One or more selected roles are not available to this clinic.', 400)
      const roles = roleSnaps.map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) }))
      const effectivePermissions = [...new Set([
        ...defaultClinicRolePermissions,
        ...(Array.isArray(current.permissions) ? current.permissions : []),
        ...roles.flatMap(role => expandClinicRolePermissions(Array.isArray(role.permissions) ? role.permissions : [])),
      ])].filter(permission => CLINIC_ROLE_PERMISSION_KEYS.has(permission))
      const roleNames = roles.map(role => String(role.name || '').trim()).filter(Boolean)
      Object.assign(updates, {
        role: roleNames.join(', ') || 'Staff',
        customRoleId: customRoleIds[0], customRoleIds,
        customRoleName: roleNames.join(', '), effectivePermissions,
      })
    }

    await targetRef.update(updates)
    return res.json({ success: true, data: { id: targetId, branchId: selectedBranchIds[0], branchIds: selectedBranchIds } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to update employee profile.' })
  }
})

const staffScheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const staffShiftMinutes = value => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
const staffShiftHours = shift => {
  const start = staffShiftMinutes(shift.start), end = staffShiftMinutes(shift.end)
  if (start === null || end === null || end <= start) return 0
  const elapsed = end - start
  const requestedBreak = Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes)
  const breakMinutes = Number.isFinite(requestedBreak) && requestedBreak >= 0 ? requestedBreak : elapsed > 8 * 60 ? 60 : 0
  return Math.max(0, elapsed - breakMinutes) / 60
}

// HR setup APIs authorize against live clinic roles, avoiding direct client
// reads/writes that can fail when Firestore's permission snapshot is stale.
app.get('/hr/branches/:branchId/shift-templates', requireAuth, async (req, res) => {
  try {
    const branchId = String(req.params.branchId || '').trim()
    const actor = await loadUserContext(req.user.uid)
    assertWorkflow(actor.permissions.has('hr:view') || actor.permissions.has('administrator:full_access'), 'You do not have permission to view shift templates.', 403)
    assertWorkflow(await resolveBranchAccess(req.user.uid, branchId), 'You are not assigned to this branch.', 403)
    const firestore = admin.firestore()
    await assertClinicPlanFeature(firestore, branchId, 'hr')
    const shiftSnapshot = await firestore.collection('shifts').where('branchId', '==', branchId).get()
    const shifts = shiftSnapshot.docs.map(snapshot => {
      const shift = snapshot.data() || {}
      return {
        id: snapshot.id,
        shiftType: String(shift.shiftType || ''),
        start: String(shift.start || ''),
        end: String(shift.end || ''),
        unpaidMealBreakMinutes: Number(shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes ?? 0),
        capacity: Number(shift.capacity || 1),
        notes: String(shift.notes || ''),
        isArchived: shift.isArchived === true,
      }
    })
    let capacitySchedules = []
    if (String(req.query.includeCapacity || '').toLowerCase() === 'true') {
      assertWorkflow(actor.permissions.has('hr:update') || actor.permissions.has('administrator:full_access'), 'You do not have permission to assign employee shifts.', 403)
      const excludeEmployeeId = String(req.query.excludeEmployeeId || '').trim()
      if (excludeEmployeeId) {
        const excludedEmployee = await firestore.collection('users').doc(excludeEmployeeId).get()
        const excludedData = excludedEmployee.data() || {}
        const assignedBranches = [excludedData.branchId, ...(Array.isArray(excludedData.branchIds) ? excludedData.branchIds : [])].map(value => String(value || '').trim())
        assertWorkflow(excludedEmployee.exists && String(excludedData.userType || '').toLowerCase() === 'staff' && assignedBranches.includes(branchId), 'The employee being edited is not assigned to this branch.', 400)
      }
      const [primaryStaff, additionalStaff] = await Promise.all([
        firestore.collection('users').where('branchId', '==', branchId).where('userType', '==', 'Staff').get(),
        firestore.collection('users').where('branchIds', 'array-contains', branchId).get(),
      ])
      const staffById = new Map([...primaryStaff.docs, ...additionalStaff.docs].map(snapshot => [snapshot.id, snapshot]))
      const activeStaff = [...staffById.values()].filter(snapshot => {
        const data = snapshot.data() || {}
        return snapshot.id !== excludeEmployeeId && ['staff', 'employee'].includes(String(data.userType || '').toLowerCase())
          && data.archived !== true && String(data.status || '').toLowerCase() !== 'inactive'
      })
      const effectiveFrom = String(req.query.effectiveFrom || '')
      const schedules = await Promise.all(activeStaff.map(snapshot => snapshot.ref.collection('schedules').doc('recurring').get()))
      capacitySchedules = schedules.map(snapshot => {
        const effective = resolveRecurringScheduleVersion(snapshot.data() || {}, effectiveFrom)
        return { assignments: effective?.assignments || {} }
      })
    }
    return res.json({ success: true, data: { shifts, capacitySchedules } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to load branch shift templates.' })
  }
})

app.post('/hr/branches/:branchId/shifts', requireAuth, async (req, res) => {
  try {
    const branchId = String(req.params.branchId || '').trim()
    const actor = await loadUserContext(req.user.uid)
    assertWorkflow(actor.permissions.has('hr:create') || actor.permissions.has('administrator:full_access'), 'You do not have permission to create shift templates.', 403)
    assertWorkflow(await resolveBranchAccess(req.user.uid, branchId), 'You are not assigned to this branch.', 403)
    const firestore = admin.firestore()
    const { clinic } = await assertClinicPlanFeature(firestore, branchId, 'hr')
    const name = String(req.body?.name || '').trim()
    const start = String(req.body?.start || '').trim()
    const end = String(req.body?.end || '').trim()
    const notes = String(req.body?.notes || '').trim()
    const capacity = Number(req.body?.capacity)
    const startMinutes = staffShiftMinutes(start), endMinutes = staffShiftMinutes(end)
    assertWorkflow(name.length > 0 && name.length <= 80 && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes, 'Enter a shift name and valid same-day start and end times.', 400)
    assertWorkflow(Number.isInteger(capacity) && capacity >= 1 && capacity <= 500 && notes.length <= 300, 'Enter valid shift capacity and notes.', 400)
    const existing = await firestore.collection('shifts').where('branchId', '==', branchId).get()
    const duplicate = existing.docs.some(snapshot => {
      const shift = snapshot.data() || {}
      return shift.isArchived !== true
        && String(shift.shiftType || '').trim().toLowerCase() === name.toLowerCase()
        && String(shift.start || '') === start && String(shift.end || '') === end
    })
    assertWorkflow(!duplicate, 'A shift with the same name and time already exists for this branch.', 409)
    const shiftRef = firestore.collection('shifts').doc()
    const shift = {
      shiftType: name, start, end, unpaidMealBreakMinutes: 0,
      branch: String(clinic.clinicBranch || ''), branchId, notes, capacity,
      isArchived: false, employees: [], createdBy: req.user.uid, updatedBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await shiftRef.set(shift)
    return res.status(201).json({ success: true, data: { shift: {
      id: shiftRef.id, shiftType: name, start, end, unpaidMealBreakMinutes: 0,
      capacity, notes, isArchived: false,
    } } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to create the shift template.' })
  }
})

app.get('/staff/:userId/recurring-schedule', requireAuth, async (req, res) => {
  try {
    const actor = await loadUserContext(req.user.uid)
    assertWorkflow(actor.permissions.has('hr:view') || actor.permissions.has('administrator:full_access'), 'You do not have permission to view employee schedules.', 403)
    const userId = String(req.params.userId || '').trim()
    const branchId = String(req.query.branchId || '').trim()
    const firestore = admin.firestore()
    const employeeSnapshot = await firestore.collection('users').doc(userId).get()
    const employee = employeeSnapshot.data() || {}
    const assignedBranches = [employee.branchId, ...(Array.isArray(employee.branchIds) ? employee.branchIds : [])].map(value => String(value || '').trim())
    assertWorkflow(employeeSnapshot.exists && String(employee.userType || '').toLowerCase() === 'staff' && assignedBranches.includes(branchId), 'Employee is not assigned to this branch.', 404)
    assertWorkflow(await resolveBranchAccess(req.user.uid, branchId), 'You are not assigned to this branch.', 403)
    await assertClinicPlanFeature(firestore, branchId, 'hr')
    const scheduleSnapshot = await firestore.collection('users').doc(userId).collection('schedules').doc('recurring').get()
    const effectiveFrom = String(req.query.effectiveFrom || '')
    const scheduleData = scheduleSnapshot.exists ? scheduleSnapshot.data() || {} : {}
    const schedule = scheduleSnapshot.exists ? resolveRecurringScheduleVersion(scheduleData, effectiveFrom) : null
    const latestSchedule = scheduleSnapshot.exists ? recurringScheduleVersions(scheduleData).at(-1) || null : null
    return res.json({
      success: true,
      data: {
        schedule: schedule ? { ...schedule, branchId } : null,
        latestSchedule: latestSchedule ? { ...latestSchedule, branchId } : null,
      },
    })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to load the employee recurring schedule.' })
  }
})

app.put('/staff/:userId/recurring-schedule', requireAuth, async (req, res) => {
  try {
    const actor = await loadUserContext(req.user.uid)
    assertWorkflow(actor.permissions.has('hr:update') || actor.permissions.has('administrator:full_access'), 'You do not have permission to assign employee shifts.', 403)
    const userId = String(req.params.userId || '').trim()
    const branchId = String(req.body?.branchId || '').trim()
    assertWorkflow(await resolveBranchAccess(req.user.uid, branchId), 'You are not assigned to this branch.', 403)
    const firestore = admin.firestore()
    await assertClinicPlanFeature(firestore, branchId, 'hr')
    const employeeRef = firestore.collection('users').doc(userId)
    const employeeSnapshot = await employeeRef.get()
    const employee = employeeSnapshot.data() || {}
    assertWorkflow(employeeSnapshot.exists && String(employee.userType || '').toLowerCase() === 'staff', 'Employee profile not found.', 404)
    const assignedBranches = [employee.branchId, ...(Array.isArray(employee.branchIds) ? employee.branchIds : [])].map(value => String(value || '').trim())
    assertWorkflow(assignedBranches.includes(branchId), 'Employee is not assigned to this branch.', 403)
    const effectiveFrom = String(req.body?.effectiveFrom || '')
    const date = new Date(`${effectiveFrom}T00:00:00.000Z`)
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === effectiveFrom
    assertWorkflow(validDate && date.getUTCDay() === 1, 'Choose a valid Monday for the schedule to take effect.', 400)
    const manilaParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
    const manilaToday = new Date(`${manilaParts.year}-${manilaParts.month}-${manilaParts.day}T00:00:00.000Z`)
    manilaToday.setUTCDate(manilaToday.getUTCDate() - ((manilaToday.getUTCDay() + 6) % 7))
    assertWorkflow(effectiveFrom >= manilaToday.toISOString().slice(0, 10), 'The recurring schedule cannot start in a past week.', 400)
    const weeklyHoursCap = Number(req.body?.weeklyHoursCap)
    const agreedHours = Number(employee.weeklyHoursTarget || 0)
    assertWorkflow(Number.isFinite(weeklyHoursCap) && weeklyHoursCap >= 1 && weeklyHoursCap <= Math.min(48, agreedHours), 'The weekly limit cannot exceed the employee’s agreed hours or 48 hours.', 400)
    const requestedAssignments = req.body?.assignments && typeof req.body.assignments === 'object' ? req.body.assignments : {}
    const assignments = Object.fromEntries(staffScheduleDays.map(day => [day, String(requestedAssignments[day] || '').trim()]))
    assertWorkflow(staffScheduleDays.every(day => !assignments[day] || assignments[day].length <= 150), 'Choose valid shift templates for the weekly schedule.', 400)
    const shiftIds = [...new Set(Object.values(assignments).filter(Boolean))]
    const shiftSnaps = await Promise.all(shiftIds.map(id => firestore.collection('shifts').doc(id).get()))
    assertWorkflow(shiftSnaps.every(snapshot => snapshot.exists && String(snapshot.data()?.branchId || '') === branchId && snapshot.data()?.isArchived !== true), 'Select active shift templates from this branch.', 400)
    const shiftsById = new Map(shiftSnaps.map(snapshot => [snapshot.id, snapshot.data() || {}]))
    const assignedHours = staffScheduleDays.reduce((total, day) => total + (shiftsById.has(assignments[day]) ? staffShiftHours(shiftsById.get(assignments[day])) : 0), 0)
    assertWorkflow(assignedHours <= weeklyHoursCap, `Assigned shifts total ${assignedHours} hours, above the ${weeklyHoursCap}-hour weekly limit.`, 400)

    const [primaryStaff, additionalStaff] = await Promise.all([
      firestore.collection('users').where('branchId', '==', branchId).where('userType', '==', 'Staff').get(),
      firestore.collection('users').where('branchIds', 'array-contains', branchId).get(),
    ])
    const staffById = new Map([...primaryStaff.docs, ...additionalStaff.docs].map(snapshot => [snapshot.id, snapshot]))
    const activeStaff = [...staffById.values()].filter(snapshot => snapshot.id !== userId && snapshot.data()?.archived !== true && String(snapshot.data()?.status || '').toLowerCase() !== 'inactive')
    const schedules = await Promise.all(activeStaff.map(snapshot => snapshot.ref.collection('schedules').doc('recurring').get()))
    const capacityCounts = new Map(staffScheduleDays.map(day => [day, new Map()]))
    schedules.forEach(snapshot => {
      const effective = resolveRecurringScheduleVersion(snapshot.data() || {}, effectiveFrom)
      staffScheduleDays.forEach(day => {
        const shiftId = String(effective?.assignments?.[day] || '')
        if (shiftId) {
          const counts = capacityCounts.get(day)
          counts.set(shiftId, (counts.get(shiftId) || 0) + 1)
        }
      })
    })
    for (const day of staffScheduleDays) {
      const shiftId = assignments[day]
      if (!shiftId) continue
      const shift = shiftsById.get(shiftId)
      const assigned = capacityCounts.get(day).get(shiftId) || 0
      assertWorkflow(assigned < Number(shift.capacity || 1), `Shift capacity is full on ${day}. Choose another shift or day.`, 409)
    }

    const scheduleRef = employeeRef.collection('schedules').doc('recurring')
    const existingSchedule = await scheduleRef.get()
    const assignmentLabels = Object.fromEntries(staffScheduleDays.map(day => {
      const shift = shiftsById.get(assignments[day])
      return [day, shift ? `${shift.shiftType || 'Shift'} || ${shift.start || ''} - ${shift.end || ''}` : '']
    }))
    const nextSchedule = withRecurringScheduleVersion(existingSchedule.data() || {}, {
      employeeId: userId, employeeName: String(employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`).trim(),
      employeeRole: String(employee.role || 'Staff'), branchId, weekStart: null, effectiveFrom,
      recurring: true, type: 'recurring', availability: null, weeklyHoursCap, assignments, assignmentLabels,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(!existingSchedule.exists ? { createdAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    })
    await scheduleRef.set(nextSchedule)
    return res.json({ success: true, data: { employeeId: userId, branchId, effectiveFrom, assignedHours } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to assign the recurring employee schedule.' })
  }
})

// Staff accounts are created in Firebase Authentication by the browser's
// secondary Auth instance, but their organizational profile is always created
// here.  In particular, a caller cannot write an arbitrary branchId/branchIds
// pair directly to Firestore.
app.post('/staff/:userId/profile', requireAuth, requirePermission('staff:create'), async (req, res) => {
  let profileCreated = false
  let practitionerLicenseCleanup = null
  try {
    const targetId = String(req.params.userId || '').trim()
    const input = req.body || {}
    const text = (value, max = 500) => String(value || '').trim().slice(0, max)
    const email = text(input.email, 320).toLowerCase()
    const firstName = text(input.firstName, 100)
    const lastName = text(input.lastName, 100)
    const requestedRole = normalizeRoleKey(text(input.role, 80))
    const engagementType = text(input.engagementType || 'employee', 40).toLowerCase()
    const employmentType = text(input.employmentType, 80)
    let credentialNumber = text(input.credentialNumber, 100)
    const weeklyHoursTarget = Number(input.weeklyHoursTarget)
    const forbiddenRoles = new Set(['Owner', 'Superadmin'])
    const branchIds = [...new Set((Array.isArray(input.branchIds) ? input.branchIds : []).map((id) => String(id || '').trim()).filter(Boolean))]
    const customRoleIds = [...new Set((Array.isArray(input.customRoleIds) ? input.customRoleIds : [input.customRoleId]).map((id) => String(id || '').trim()).filter(Boolean))]
    if (!targetId || !email || !firstName || !lastName || forbiddenRoles.has(requestedRole)) {
      return res.status(400).json({ success: false, error: 'Enter valid staff details.' })
    }
    if (!requestedRole || !customRoleIds.length) {
      return res.status(400).json({ success: false, error: 'Select at least one staff role.' })
    }
    if (!branchIds.length || branchIds.length > 100) {
      return res.status(400).json({ success: false, error: 'Select between 1 and 100 assigned branches.' })
    }
    if (!['employee', 'student_intern'].includes(engagementType)
      || (engagementType === 'employee' && !['Full-time', 'Part-time'].includes(employmentType))
      || (engagementType === 'student_intern' && employmentType !== 'Intern')
      || !Number.isFinite(weeklyHoursTarget) || weeklyHoursTarget < 1 || weeklyHoursTarget > 48
      || (employmentType === 'Full-time' && weeklyHoursTarget < 40)
      || (employmentType === 'Part-time' && weeklyHoursTarget >= 40)
      || Math.round(weeklyHoursTarget * 2) !== weeklyHoursTarget * 2) {
      return res.status(400).json({ success: false, error: 'Enter 40 to 48 agreed hours for full-time, fewer than 40 for part-time, or 1 to 48 for an intern.' })
    }
    const employmentStartDate = text(input.employmentStartDate, 10)
    const hasPayRate = input.basePay !== undefined && input.basePay !== null && String(input.basePay).trim() !== ''
    const basePayValue = hasPayRate ? Number(input.basePay) : null
    const basePayModel = text(input.basePayModel || 'hourly', 40)
    const monthlyBaseHours = Number(input.monthlyBaseHours || 176)
    const payFieldsRequested = input.basePayModel !== undefined
      || input.basePay !== undefined
      || input.monthlyBaseHours !== undefined
      || input.employmentStartDate !== undefined
    if (payFieldsRequested && (!['hourly', 'daily', 'monthly-retainer'].includes(basePayModel)
      || !Number.isFinite(monthlyBaseHours) || monthlyBaseHours < 1 || monthlyBaseHours > 744
      || (!hasPayRate && !employmentStartDate)
      || (hasPayRate && (!Number.isFinite(basePayValue) || basePayValue <= 0 || basePayValue > 1000000 || !/^\d+(\.\d{1,2})?$/.test(String(input.basePay).trim())))
      || (employmentStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(employmentStartDate)))) {
      return res.status(400).json({ success: false, error: 'Enter valid base pay terms or an employment start date.' })
    }
    if (credentialNumber && !/^\d{7}$/.test(credentialNumber)) {
      return res.status(400).json({ success: false, error: 'Credential number must be exactly 7 digits.' })
    }

    const firestore = admin.firestore()
    const targetRef = firestore.collection('users').doc(targetId)
    const [existing, authUser, branchSnaps] = await Promise.all([
      targetRef.get(),
      admin.auth().getUser(targetId),
      Promise.all(branchIds.map((id) => firestore.collection('clinics').doc(id).get())),
    ])
    if (existing.exists) return res.status(409).json({ success: false, error: 'This employee profile already exists.' })
    if (String(authUser.email || '').trim().toLowerCase() !== email) return res.status(400).json({ success: false, error: 'Employee email does not match the created account.' })
    if (branchSnaps.some((snap) => !snap.exists)) return res.status(400).json({ success: false, error: 'One or more selected branches do not exist.' })
    const branches = branchSnaps.map((snap) => ({ id: snap.id, ...(snap.data() || {}) }))
    const ownerId = String(branches[0].ownerId || '').trim()
    if (!ownerId || branches.some((branch) => String(branch.ownerId || '') !== ownerId)) return res.status(403).json({ success: false, error: 'Employees may only be assigned within one clinic organization.' })
    await assertClinicPlanFeature(firestore, branches[0].id, 'staff_management')
    const actor = await loadUserContext(req.user.uid)
    const actorIsOwner = String(actor.roleKey || '') === 'Owner' && req.user.uid === ownerId
    if (payFieldsRequested && !actor.permissions.has('payroll:update') && !actor.permissions.has('administrator:full_access')) {
      return res.status(403).json({ success: false, error: 'You are not authorized to set employee base pay.' })
    }
    if (payFieldsRequested) await assertClinicPlanFeature(firestore, branches[0].id, 'payroll')
    if (!actorIsOwner && !(await Promise.all(branchIds.map((id) => resolveBranchAccess(req.user.uid, id)))).every(Boolean)) {
      return res.status(403).json({ success: false, error: 'You are not authorized for every selected branch.' })
    }

    const customRoleSnaps = await Promise.all(customRoleIds.map((id) => firestore.collection('clinicRoles').doc(id).get()))
    if (customRoleSnaps.some((snap) => !snap.exists || String(snap.data()?.ownerId || '') !== ownerId)) {
      return res.status(400).json({ success: false, error: 'One or more selected custom roles are not available to this clinic organization.' })
    }
    const isPractitioner = customRoleSnaps.some((snap) =>
      /\bpractitioner\b/i.test(String(snap.data()?.name || ''))
      || hasPractitionerPermissions(snap.data()?.permissions)
    )
    const professionalSpecialty = text(input.practitionerType, 100)
    if (isPractitioner && !employeeSpecialtyTypes.includes(professionalSpecialty)) {
      return res.status(400).json({ success: false, error: 'Choose a professional specialty for the Practitioner role.' })
    }
    if (!isPractitioner && professionalSpecialty) {
      return res.status(400).json({ success: false, error: 'Professional specialty is only available for the Practitioner role.' })
    }
    const practitionerLicenseUrl = text(input.practitionerLicenseUrl, 2000)
    const practitionerLicenseName = text(input.practitionerLicenseName, 255)
    const practitionerLicenseStoragePath = text(input.practitionerLicenseStoragePath, 1024)
    let practitionerCredentialExpiryDate = ''
    if (isPractitioner) {
      if (!practitionerLicenseUrl || !practitionerLicenseName || !practitionerLicenseStoragePath) {
        return res.status(400).json({ success: false, error: 'Upload a current practitioner license before creating this account.' })
      }
      const expectedPrefix = `practitioner-licenses/${req.user.uid}/${targetId}/`
      const licenseObjectName = practitionerLicenseStoragePath.startsWith(expectedPrefix)
        ? practitionerLicenseStoragePath.slice(expectedPrefix.length)
        : ''
      if (!/^\d+-[A-Za-z0-9_.-]+$/.test(licenseObjectName)) {
        return res.status(400).json({ success: false, error: 'The practitioner license upload is invalid. Upload the document again.' })
      }
      let parsedLicenseUrl
      try { parsedLicenseUrl = new URL(practitionerLicenseUrl) } catch {}
      const urlObject = parsedLicenseUrl?.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
      let urlBucket = '', urlStoragePath = ''
      try {
        urlBucket = urlObject ? decodeURIComponent(urlObject[1]) : ''
        urlStoragePath = urlObject ? decodeURIComponent(urlObject[2]) : ''
      } catch {}
      const projectId = String(firebaseProjectId || admin.app().options.projectId || '').trim()
      const projectBuckets = new Set([
        firebaseStorageBucket,
        projectId ? `${projectId}.firebasestorage.app` : '',
        projectId ? `${projectId}.appspot.com` : '',
      ].filter(Boolean))
      if (parsedLicenseUrl?.origin !== 'https://firebasestorage.googleapis.com'
        || !projectBuckets.has(urlBucket) || urlStoragePath !== practitionerLicenseStoragePath) {
        return res.status(400).json({ success: false, error: 'The practitioner license upload is invalid. Upload the document again.' })
      }
      // Firebase projects may still have an older .appspot.com bucket name
      // configured on the backend while the web app uploads to the newer
      // .firebasestorage.app bucket. Accept only known bucket names for this
      // Firebase project and read the exact bucket named by the download URL.
      practitionerLicenseCleanup = { bucket: urlBucket, path: practitionerLicenseStoragePath }
      const licenseFile = admin.storage().bucket(urlBucket).file(practitionerLicenseStoragePath)
      let licenseMetadata
      try {
        [licenseMetadata] = await licenseFile.getMetadata()
      } catch (error) {
        if (Number(error?.code) === 404) return res.status(400).json({ success: false, error: 'The uploaded practitioner license could not be found. Upload the document again.' })
        throw error
      }
      const licenseContentType = String(licenseMetadata.contentType || '').toLowerCase()
      const licenseSize = Number(licenseMetadata.size || 0)
      if (!['image/jpeg', 'image/png'].includes(licenseContentType) || licenseSize <= 0 || licenseSize > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Upload one JPEG or PNG license image up to 5 MB.' })
      }
      let licenseBytes
      try {
        [licenseBytes] = await licenseFile.download()
      } catch (error) {
        if (Number(error?.code) === 404) return res.status(400).json({ success: false, error: 'The uploaded practitioner license could not be found. Upload the document again.' })
        throw error
      }
      let licenseOcr
      try {
        licenseOcr = await readPractitionerLicenseOcr({
          visionClient: createVisionClient(), bytes: licenseBytes, getVisionResponseError,
        })
      } catch (error) {
        if (error?.status === 503) return res.status(503).json({ success: false, error: error.message })
        console.error('Practitioner license validation OCR failed:', error?.message || error)
        return res.status(503).json({ success: false, error: 'We could not read this license document. Upload a clearer image and try again.' })
      }
      const licenseValidation = validatePractitionerCredentialDocument({
        firstName,
        middleName: text(input.middleName, 100),
        lastName,
        suffix: text(input.suffix, 50),
        text: licenseOcr.extractedText,
        confidence: getVisionWordConfidence(licenseOcr.annotation),
      })
      if (!licenseValidation.accepted) {
        return res.status(422).json({ success: false, error: licenseValidation.reason })
      }
      practitionerCredentialExpiryDate = licenseValidation.expiryDate
      if (!credentialNumber) credentialNumber = extractPractitionerLicenseNumber(licenseOcr.extractedText)
    }
    const effectivePermissions = [...new Set([
      ...defaultClinicRolePermissions,
      ...customRoleSnaps.flatMap((snap) => Array.isArray(snap.data()?.permissions) ? expandClinicRolePermissions(snap.data().permissions) : []),
    ])]
    const profileBatch = firestore.batch()
    profileBatch.set(targetRef, {
      firstName, middleName: text(input.middleName, 100) || null, lastName, suffix: text(input.suffix, 50) || null,
      fullName: text(input.fullName, 250) || `${firstName} ${lastName}`,
      email, phoneNumber: text(input.phoneNumber, 30), role: requestedRole,
      customRoleId: customRoleIds[0] || null, customRoleIds,
      customRoleName: text(input.customRoleName, 150) || null, effectivePermissions,
      engagementType, employmentType, weeklyHoursTarget, userType: 'Staff',
      branchId: branchIds[0], branchIds, organizationOwnerId: ownerId,
      clinicLocation: [...new Map(branches.map(branch => {
        const location = text(branch.clinicLocation, 250)
        return [location.toLocaleLowerCase(), location]
      }).filter(([key, value]) => key && value)).values()].join(', '),
      clinicLocations: [...new Map(branches.map(branch => {
        const location = text(branch.clinicLocation, 250)
        return [location.toLocaleLowerCase(), location]
      }).filter(([key, value]) => key && value)).values()],
      ...(payFieldsRequested ? {
        employmentStartDate,
        ...(hasPayRate ? { basePay: Number(basePayValue.toFixed(2)), basePayModel, monthlyBaseHours } : {}),
      } : {}),
      practitionerType: isPractitioner ? professionalSpecialty : null,
      status: 'Pending Activation', practitionerLicenseUrl: practitionerLicenseUrl || null,
      practitionerLicenseName: practitionerLicenseName || null,
      practitionerLicenseStoragePath: practitionerLicenseStoragePath || null,
      practitionerLicenseUploadedBy: practitionerLicenseUrl ? req.user.uid : null,
      mustChangePassword: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: req.user.uid,
    })
    if (isPractitioner) {
      profileBatch.set(firestore.collection('practitionerProfiles').doc(targetId), {
        type: professionalSpecialty,
        credentialNumber,
        credentialExpiryDate: practitionerCredentialExpiryDate,
        credentialsVerified: false,
        approvedServiceIds: [],
        rates: [],
        branchId: branchIds[0],
        updatedBy: req.user.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    await profileBatch.commit()
    profileCreated = true
    res.status(201).json({ success: true, data: { id: targetId, branchId: branchIds[0], branchIds } })
  } catch (error) {
    console.error('Create staff profile failed:', error)
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500
    const message = status < 500
      ? String(error.message || 'Unable to create employee profile.')
      : 'Unable to create employee profile.'
    res.status(status).json({ success: false, error: message })
  } finally {
    // Browser Storage rules intentionally make credential uploads immutable.
    // Clean up failed profile submissions with the trusted Admin SDK instead
    // of issuing a client delete that would always be denied.
    if (!profileCreated && practitionerLicenseCleanup) {
      try {
        await admin.storage().bucket(practitionerLicenseCleanup.bucket)
          .file(practitionerLicenseCleanup.path)
          .delete({ ignoreNotFound: true })
      } catch (cleanupError) {
        console.warn('Unable to clean up an unlinked practitioner license upload:', cleanupError?.message || cleanupError)
      }
    }
  }
})


registerPaymentReceiptWorkflow(app, {
  admin,
  sendEmail: async ({ To, Subject, TextBody, HtmlBody }) => {
    if (!postmarkClient || !senderEmail) throw Object.assign(new Error('Payment receipt email is unavailable.'), { status: 503 })
    return postmarkClient.sendEmail({ From: senderEmail, To, Subject, TextBody, HtmlBody })
  },
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
  if (bookingType === 'follow-up') {
    if (!followUpOf) return res.status(400).json({ success: false, error: 'A follow-up must be linked to the completed appointment.' })
    const source = await admin.firestore().collection('appointments').doc(followUpOf).get()
    const sourceData = source.data() || {}
    const followUpError = validateFollowUpSource(source.exists ? sourceData : null, { customerId, branchId })
    if (followUpError) return res.status(409).json({ success: false, error: followUpError })
    const existing = await admin.firestore().collection('appointments').where('followUpOf', '==', followUpOf).get()
    if (existing.docs.some(docSnap => !['cancelled', 'rejected'].includes(normalizeBookingStatus(docSnap.data().status)))) return res.status(409).json({ success: false, error: 'A follow-up has already been booked for this appointment.' })
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
  await assertClinicPlanFeature(firestore, branchId, 'booking_availability')
  const approvedLeave = await getApprovedLeaveForDate(practitionerId, date)
  if (approvedLeave) {
    return res.status(409).json({
      success: false,
      code: 'PRACTITIONER_ON_LEAVE',
      error: 'The selected practitioner is on approved leave for this date. Please choose another schedule.',
      leaveId: approvedLeave.id,
    })
  }

  const consultationRequiredIds = selectedServices
    .filter((service) => service?.requiresConsultationFirst === true && !service.packageComponents?.some(component => component.type === 'Consultation'))
    .map((service) => String(service.id || '').trim())
    .filter(Boolean)

  if (consultationRequiredIds.length) {
    const [consultationSnap, clearanceSnap] = await Promise.all([
      firestore.collection('appointments').where('customerId', '==', customerId).where('type', '==', 'Consultation').get(),
      firestore.collection('consultationClearances').where('customerId', '==', customerId).get(),
    ])
    const requiredServices = await Promise.all(consultationRequiredIds.map(async id => ({ ...(await firestore.collection('productServicePosts').doc(id).get()).data(), id })))
      const hasCompletedConsultation = requiredServices.every(service => hasConsultationRequirement(service, consultationSnap.docs.map(snapshot => snapshot.data()), clearanceSnap.docs.map(snapshot => snapshot.data()), branchId))
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
        if (!appointmentStaffIds(data).includes(practitionerId) || !BOOKING_BLOCKING_STATUSES.has(status)) return
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
  return res.status(409).json({ success: false, error: 'Create the appointment first, then sign its agreement and complete payment from My Appointments.' })
})

app.post('/appointments/:id/request-change', requireAuth, async (req, res) => {
  if (!adminReady) return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  const appointmentId = String(req.params.id || '').trim()
  const type = String(req.body?.type || '').trim().toLowerCase()
  const reason = String(req.body?.reason || '').trim()
  if (!appointmentId) return res.status(400).json({ success: false, error: 'appointment id is required' })
  if (!['cancel', 'reschedule'].includes(type)) return res.status(400).json({ success: false, error: 'Unsupported appointment change request.' })
  if (!reason || reason.length > 1000) return res.status(400).json({ success: false, error: 'Provide a reason of up to 1,000 characters.' })

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    assertWorkflow(String(appointment.customerId || '') === req.user.uid, 'You can only request changes to your own appointment.', 403)
    assertWorkflow(!appointment.isGroupParent && !appointment.isBookingOrderParent, 'This booking cannot be changed from this appointment record.', 400)
    assertWorkflow(!sameDayChangeError(appointment, type), sameDayChangeError(appointment, type), 409)

    const branchId = String(appointment.branchId || '').trim()
    const { policy, branch } = await getClinicPoliciesForBranch(firestore, branchId)
    if (type === 'cancel') assertWorkflow(isCancellationPolicyEnabled(policy), 'This clinic does not allow cancellation requests.', 403)
    if (type === 'reschedule') {
      assertWorkflow(isReschedulePolicyEnabled(policy), 'This clinic does not allow reschedule requests.', 403)
      assertWorkflow(Number(appointment.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy), 'You have reached this clinic’s reschedule limit.', 403)
    }
    const scheduledStart = new Date(`${appointment.date}T${appointment.time}+08:00`)
    assertWorkflow(Number.isFinite(scheduledStart.getTime()) && scheduledStart.getTime() > Date.now(), 'This appointment has already started or passed. Contact the clinic to resolve it.', 409)
    const allowedStatuses = ['paid', 'scheduled', 'awaiting payment', 'contract pending', 'ready to start']
    assertWorkflow(allowedStatuses.includes(normalizeBookingStatus(appointment.status)) && !appointment.startedAt && !appointment.checkedInAt, 'This appointment can no longer be changed.', 409)

    const requestedDate = String(req.body?.date || '').trim()
    const requestedTime = String(req.body?.time || '').trim()
    const requestedPractitionerId = String(req.body?.practitionerId || appointment.assignedPractitionerId || appointment.practitionerId || '').trim()
    if (type === 'reschedule') {
      assertWorkflow(/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && parseClockToMinutes(requestedTime) !== null, 'Choose a valid preferred date and time.', 400)
      assertWorkflow(new Date(`${requestedDate}T${requestedTime}+08:00`) > new Date(), 'Choose a future date and time.', 400)
      assertWorkflow(requestedPractitionerId, 'The appointment has no assigned practitioner to reschedule with.', 409)
      assertWorkflow(!await getApprovedLeaveForDate(requestedPractitionerId, requestedDate), 'The practitioner is on approved leave for that date.', 409)
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    const refundRequestId = type === 'cancel' ? crypto.randomUUID() : ''
    const result = await firestore.runTransaction(async tx => {
      const freshSnap = await tx.get(appointmentRef)
      const fresh = freshSnap.exists ? freshSnap.data() || {} : null
      assertWorkflow(fresh && String(fresh.customerId || '') === req.user.uid, 'Appointment not found.', 404)
      assertWorkflow(['paid', 'scheduled', 'awaiting payment', 'contract pending', 'ready to start'].includes(normalizeBookingStatus(fresh.status)) && !fresh.startedAt && !fresh.checkedInAt, 'This appointment can no longer be changed.', 409)
      assertWorkflow(!sameDayChangeError(fresh, type), sameDayChangeError(fresh, type), 409)
      const freshStart = new Date(`${fresh.date}T${fresh.time}+08:00`)
      assertWorkflow(Number.isFinite(freshStart.getTime()) && freshStart.getTime() > Date.now(), 'This appointment has already started or passed. Contact the clinic to resolve it.', 409)
      if (type === 'cancel') {
        const refundTerms = cancellationTermsSnapshot(policy, fresh)
        tx.update(appointmentRef, {
          status: 'Cancellation Requested',
          statusBeforeChange: fresh.status || '',
          cancellationReason: reason,
          cancellationRequestedAt: timestamp,
          cancellationPolicySnapshot: String(policy.cancellationPolicy || '').trim(),
          cancellationRefundPolicySnapshot: refundTerms,
          refundRequestedAmount: refundTerms.refundAmount,
          refundCommissionAmount: refundTerms.commissionAmount,
          refundRequestId,
          refundRequestStatus: 'Requested',
          refundStatus: 'Requested',
          updatedAt: timestamp,
        })
      } else {
        assertWorkflow(Number(fresh.rescheduleCount || 0) < rescheduleAllowanceForPolicy(policy), 'You have reached this clinic’s reschedule limit.', 403)
        const prepared = await prepareBooking({
          tx,
          db: firestore,
          reservation: { ...fresh, date: requestedDate, time: requestedTime, endTime: '', practitionerId: requestedPractitionerId, assignedPractitionerId: requestedPractitionerId, groupBooking: null },
          getBookingRange,
          rangesOverlap,
          appointmentId,
        })
        tx.update(appointmentRef, {
          status: 'Reschedule Requested',
          requestedDate,
          requestedTime,
          requestedPractitionerId,
          requestedSlotKey: String(req.body?.slotKey || '').trim(),
          rescheduleReason: reason,
          rescheduleRequestedAt: timestamp,
          reschedulePolicySnapshot: String(policy.reschedulePolicy || '').trim(),
          rescheduleAllowanceSnapshot: rescheduleAllowanceForPolicy(policy),
          rescheduleCountAtRequest: Number(fresh.rescheduleCount || 0),
          requestedEndTime: prepared.data.endTime,
          updatedAt: timestamp,
        })
      }
      tx.set(firestore.collection('appointmentAudit').doc(), {
        appointmentId,
        branchId,
        action: type === 'cancel' ? 'cancellation_requested' : 'reschedule_requested',
        actorId: req.user.uid,
        previousStatus: fresh.status || '',
        nextStatus: type === 'cancel' ? 'Cancellation Requested' : 'Reschedule Requested',
        ...(type === 'reschedule' ? { date: requestedDate, time: requestedTime, practitionerId: requestedPractitionerId } : {}),
        createdAt: timestamp,
      })
      return { status: type === 'cancel' ? 'Cancellation Requested' : 'Reschedule Requested' }
    })

    const clinicRecipients = [...new Set([
      String(branch.ownerId || branch.organizationOwnerId || '').trim(),
      String(branch.branchAdminId || '').trim(),
    ].filter((uid) => uid && uid !== req.user.uid))]
    await Promise.all(clinicRecipients.map(async recipientUserId => {
      try {
        await firestore.collection('notifications').add({
          recipientUserId,
          branchId,
          title: type === 'cancel' ? 'Appointment cancellation requested' : 'Appointment reschedule requested',
          message: type === 'cancel'
            ? `${appointment.customerName || 'A customer'} requested to cancel ${appointment.service || 'an appointment'} scheduled for ${appointment.date || ''} ${appointment.time || ''}.`
            : `${appointment.customerName || 'A customer'} requested to move ${appointment.service || 'an appointment'} to ${requestedDate} ${requestedTime}.`,
          link: '/crm/appointments',
          read: false,
          deleted: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      } catch (notificationError) {
        console.warn('Failed to notify clinic about cancellation request:', notificationError?.message || notificationError)
      }
    }))
    await createAppointmentNotification({
      firestore,
      customerId: req.user.uid,
      title: type === 'cancel' ? 'Cancellation request submitted' : 'Reschedule request submitted',
      message: type === 'cancel'
        ? 'Your cancellation request was sent to the clinic for review. You will be notified when it is decided.'
        : `Your preferred new schedule, ${requestedDate} at ${requestedTime}, was sent to the clinic. The current appointment remains in place until the clinic approves it.`,
    }).catch(error => console.warn(`Failed to create ${type} request notification:`, error?.message || error))
    const customerEmail = String(appointment.customerEmail || '').trim().toLowerCase()
    if (customerEmail && postmarkClient && senderEmail) {
      try {
        await sendPostmarkMessage({
          to: customerEmail,
          subject: type === 'cancel' ? 'Your appointment cancellation request was received' : 'Your appointment reschedule request was received',
          text: type === 'cancel'
            ? `We sent your cancellation request for ${appointment.service || 'your appointment'} on ${[appointment.date, appointment.time].filter(Boolean).join(' at ')} to the clinic for review. The appointment is not cancelled until the clinic makes a decision.`
            : `We sent your preferred new schedule for ${appointment.service || 'your appointment'} to the clinic for review. Your current schedule remains active until the clinic makes a decision.`,
        })
      } catch (emailError) {
        console.warn(`Failed to email ${type} request confirmation:`, emailError?.message || emailError)
      }
    }
    return res.json({ success: true, data: { appointmentId, status: result.status } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Unable to submit the appointment change request.' })
  }
})

app.post('/appointments/:id/mark-no-show', requireAuth, async (req, res) => {
  if (!adminReady) return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  const appointmentId = String(req.params.id || '').trim()
  if (!appointmentId) return res.status(400).json({ success: false, error: 'appointment id is required' })

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    assertWorkflow(!(normalized(appointment.type) === 'consultation' && normalized(appointment.consultationMode) === 'online'), 'Online consultations are marked automatically after the arrival grace period and cannot be manually marked as no-show.', 400)
    const branchId = String(appointment.branchId || '').trim()
    await authorizeClinicAction(req.user.uid, branchId, 'appointments:update')

    const { policy } = await getClinicPoliciesForBranch(firestore, branchId)
    const rescheduleAllowed = policy.noShowRescheduleAllowed === true
    const timestamp = admin.firestore.FieldValue.serverTimestamp()
    const noShowOutcome = rescheduleAllowed ? 'Reschedule eligible' : 'Forfeited'
    await firestore.runTransaction(async tx => {
      const fresh = (await tx.get(appointmentRef)).data()
      assertWorkflow(!(normalized(fresh?.type) === 'consultation' && normalized(fresh?.consultationMode) === 'online'), 'Online consultations are marked automatically after the arrival grace period and cannot be manually marked as no-show.', 400)
      assertWorkflow(fresh && ['scheduled', 'ready to start', 'paid'].includes(normalized(fresh.status)) && !fresh.checkedInAt && !fresh.workerKeyVerified && !fresh.startedAt && !fresh.isGroupParent && !fresh.isBookingOrderParent, 'Only an unattended individual appointment can be marked as a no-show.')
      const start = new Date(`${fresh.date}T${fresh.time}+08:00`)
      const end = fresh.endTime ? new Date(`${fresh.date}T${fresh.endTime}+08:00`) : new Date(start.getTime() + Number(fresh.totalServiceDurationMinutes || 60) * 60000)
      const configuredGracePeriod = Number(policy.noShowGracePeriodMinutes ?? 15)
      const gracePeriodMinutes = Number.isFinite(configuredGracePeriod) ? Math.max(0, configuredGracePeriod) : 15
      assertWorkflow(Number.isFinite(end.getTime()) && Date.now() >= end.getTime() + gracePeriodMinutes * 60 * 1000, `Wait until the appointment ends and its ${gracePeriodMinutes}-minute no-show grace period passes before recording a no-show.`)
      const planId = fresh.treatmentPlanAppointmentId || appointmentId
      const planRef = firestore.collection('appointments').doc(planId)
      const plan = planId === appointmentId ? fresh : (await tx.get(planRef)).data()
      const totalSessions = Number(plan?.treatmentPlan?.totalSessions || 1), sessionNumber = Number(fresh.sessionNumber || 1)
      tx.update(appointmentRef, { status: 'No-show', noShowAt: timestamp, noShowMarkedById: req.user.uid, noShowOutcome, updatedAt: timestamp })
      tx.set(firestore.collection('appointmentAudit').doc(), { appointmentId, branchId, action: 'no_show', actorId: req.user.uid, previousStatus: fresh.status, nextStatus: 'No-show', createdAt: timestamp })
      if (totalSessions > 1) {
        const sessionRef = firestore.collection('treatmentSessions').doc(`${planId}-${sessionNumber}`)
        tx.set(sessionRef, { branchId, treatmentPlanAppointmentId: planId, customerId: fresh.customerId || '', customerName: fresh.customerName || 'Customer', practitionerId: fresh.practitionerId || fresh.assignedPractitionerId || '', sessionNumber, totalSessions, appointmentId, status: noShowOutcome, noShowAt: timestamp, noShowMarkedById: req.user.uid, updatedAt: timestamp }, { merge: true })
        if (!rescheduleAllowed) {
          const forfeited = Number(plan.treatmentPlan.forfeitedSessions || 0) + 1
          tx.update(planRef, { treatmentPlan: { ...plan.treatmentPlan, forfeitedSessions: forfeited, remainingSessions: Math.max(0, totalSessions - Number(plan.treatmentPlan.completedSessions || 0) - forfeited) }, updatedAt: timestamp })
          if (sessionNumber < totalSessions) tx.set(firestore.collection('treatmentSessions').doc(`${planId}-${sessionNumber + 1}`), { earliestScheduleDate: new Date(start.getTime() + Math.max(1, Number(plan.treatmentPlan.sessions?.[sessionNumber - 1]?.sessionIntervalDays || 1)) * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), updatedAt: timestamp }, { merge: true })
        }
        tx.set(firestore.collection('treatmentSessionAudit').doc(), { sessionId: sessionRef.id, treatmentPlanAppointmentId: planId, branchId, action: 'no_show', previousStatus: fresh.status, nextStatus: noShowOutcome, actorId: req.user.uid, createdAt: timestamp })
      }
    })
    await createAppointmentNotification({
      firestore,
      customerId: appointment.customerId || '',
      title: 'Appointment marked as no-show',
      message: rescheduleAllowed
        ? 'Your clinic recorded a missed appointment. Contact the clinic to arrange a staff-approved reschedule under its no-show policy.'
        : 'Your clinic recorded a missed appointment. This appointment is forfeited under the clinic no-show policy.',
      link: '/customer/appointments',
    }).catch(notificationError => console.warn('Failed to create appointment no-show notification:', notificationError?.message || notificationError))
    const customerEmail = String(appointment.customerEmail || '').trim().toLowerCase()
    if (customerEmail && postmarkClient && senderEmail) {
      try {
        const customerName = String(appointment.customerName || 'Customer').trim() || 'Customer'
        const outcomeText = rescheduleAllowed
          ? 'Contact the clinic to arrange a staff-approved reschedule under its no-show policy.'
          : 'This appointment is forfeited under the clinic no-show policy.'
        await sendPostmarkMessage({
          to: customerEmail,
          subject: 'Your appointment was marked as a no-show',
          text: `Hi ${customerName},\n\nThe clinic recorded your ${appointment.service || 'appointment'} on ${[appointment.date, appointment.time].filter(Boolean).join(' at ')} as a no-show. ${outcomeText}\n\nIf you believe this is incorrect, please contact the clinic.`,
        })
      } catch (emailError) {
        console.warn('Failed to email appointment no-show notice:', emailError?.message || emailError)
      }
    }
    return res.json({ success: true, data: { appointmentId, status: 'No-show', noShowOutcome } })
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Unable to mark the appointment as a no-show.' })
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
    if (!['pending approval', 'requested', 'payment pending', 'paid - awaiting approval'].includes(currentStatus)) {
      return res.status(409).json({ success: false, error: 'This booking is no longer awaiting shop approval.' })
    }

    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const userData = req.userContext.userData || {}
    const roleKey = String(req.userContext.roleKey || '').trim()
    const canReviewRequests = req.userContext.permissions.has('appointments:review') || roleKey === 'Owner' || roleKey === 'Superadmin'
    if (!canReviewRequests) return res.status(403).json({ success: false, error: 'Forbidden' })

    const userBranchIds = new Set([userData.branchId, ...(Array.isArray(userData.branchIds) ? userData.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))
    const appointmentBranchId = String(appointment.branchId || '').trim()
    if (roleKey !== 'Owner' && roleKey !== 'Superadmin' && !userBranchIds.has(appointmentBranchId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    if (roleKey === 'Owner') {
      const clinic = (await firestore.collection('clinics').doc(appointmentBranchId).get()).data() || {}
      if (clinic.ownerId !== req.user.uid && appointmentBranchId !== req.user.uid) return res.status(403).json({ success: false, error: 'This booking belongs to another clinic.' })
    }
    const approved = decision === 'approve'
    const appointmentPaymentStatus = String(appointment.paymentStatus || '').trim().toLowerCase()
    const isPaid = ['paid', 'partially paid', 'partially refunded', 'refunded'].includes(appointmentPaymentStatus) && Number(appointment.amountPaid || 0) > 0
    if (approved) {
      const leave = await getApprovedLeaveForDate(appointment.practitionerId || appointment.assignedPractitionerId, appointment.date)
      if (leave) return res.status(409).json({ success: false, error: 'The assigned worker is on leave. Choose another booking schedule.' })

    }
    let refundId = null
    let refundStatus = null
    let refundState = null
    let refundWarning = ''
    let pendingRefund = null
    if (!approved && isPaid) {
      assertWorkflow(req.userContext.permissions.has('finance:refunds:manage') || roleKey === 'Owner' || roleKey === 'Superadmin', 'Finance refund permission is required to approve a paid booking rejection.', 403)
      const amount = Number(appointment.amountPaid || 0)
      const requestId = String(appointment.refundRequestId || `booking-rejected-${appointmentId}`)
      if (isPayMongoPaidAppointment(appointment)) {
        assertWorkflow(String(appointment.paymongoPaymentId || '').trim(), 'The verified PayMongo payment reference is missing.', 409)
        pendingRefund = { kind: 'paymongo', amount, requestId, paymentId: String(appointment.paymongoPaymentId).trim() }
      } else {
        assertWorkflow(String(appointment.source || '').trim().toLowerCase() !== 'paymongo_checkout' && !appointment.paymongoPaymentId, 'The verified PayMongo payment reference is missing. Do not record an offline refund for an online payment.', 409)
        assertWorkflow(req.body?.offlineRefundConfirmed === true, 'Confirm that the offline refund has actually been returned before rejecting this paid booking.', 400)
        assertWorkflow(String(req.body?.offlineRefundReference || '').trim().length >= 2, 'Enter the cash or bank refund reference.', 400)
        pendingRefund = { kind: 'offline', amount, requestId, reference: String(req.body.offlineRefundReference).trim() }
      }
      refundState = 'Requested'
    }
    const awaitsSameDayClearance = appointment.sameDayTreatmentStatus === 'pending_clinical_clearance'
    const nextStatus = approved ? (awaitsSameDayClearance ? 'Awaiting Clinical Clearance' : afterPaymentStatus(appointment)) : 'Rejected'
    const nextPaymentStatus = isPaid ? 'Paid' : approved ? (awaitsSameDayClearance ? 'Not Applicable' : 'Pending') : 'Not Applicable'
    const update = {
      status: nextStatus,
      approvalStatus: approved ? 'Approved' : 'Rejected',
      approvalNote: decisionNote,
      approvedAt: approved ? admin.firestore.FieldValue.serverTimestamp() : null,
      approvedById: approved ? req.user.uid : null,
      rejectedAt: approved ? null : admin.firestore.FieldValue.serverTimestamp(),
      rejectedById: approved ? null : req.user.uid,
      paymentStatus: nextPaymentStatus,
      ...(!approved && isPaid ? {
        refundStatus: 'Requested',
        refundRequestStatus: 'Requested',
        refundAmount: Number(appointment.amountPaid || 0),
        refundRequestId: pendingRefund?.requestId || String(appointment.refundRequestId || `booking-rejected-${appointmentId}`),
      } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await firestore.runTransaction(async (tx) => {
      const latest = (await tx.get(appointmentRef)).data()
      assertWorkflow(latest && latest.status === appointment.status, 'This booking was already updated. Refresh and try again.')
      if (latest.sameDayBookingId) {
        const linkedId = String(latest.sameDayTreatmentAppointmentId || latest.sameDayConsultationAppointmentId || '').trim()
        assertWorkflow(linkedId && linkedId !== appointmentId, 'The linked same-day appointment is missing.', 409)
        const linkedRef = firestore.collection('appointments').doc(linkedId)
        const linkedSnap = await tx.get(linkedRef)
        assertWorkflow(linkedSnap.exists, 'The linked same-day appointment is missing.', 409)
        const linked = linkedSnap.data() || {}
        assertWorkflow(linked.sameDayBookingId === latest.sameDayBookingId
          && (latest.sameDayTreatmentAppointmentId ? linked.sameDayConsultationAppointmentId === appointmentId : linked.sameDayTreatmentAppointmentId === appointmentId),
        'The consultation and treatment links do not match.', 409)
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const makePairUpdate = (record) => {
          const treatmentPending = record.sameDayTreatmentStatus === 'pending_clinical_clearance'
          return {
            approvalStatus: approved ? 'Approved' : 'Rejected',
            status: approved ? (treatmentPending ? 'Awaiting Clinical Clearance' : afterPaymentStatus(record)) : 'Rejected',
            paymentStatus: approved
              ? (treatmentPending ? 'Not Applicable' : 'Pending')
              : (isPaid && record === latest ? latest.paymentStatus || appointment.paymentStatus || 'Paid' : 'Not Applicable'),
            ...(!approved && isPaid && record === latest ? {
              refundStatus: 'Requested', refundRequestStatus: 'Requested', refundAmount: Number(appointment.amountPaid || 0),
              refundRequestId: pendingRefund?.requestId || String(appointment.refundRequestId || `booking-rejected-${appointmentId}`),
            } : {}),
            approvalNote: decisionNote, approvedAt: approved ? timestamp : null, approvedById: approved ? req.user.uid : null,
            rejectedAt: approved ? null : timestamp, rejectedById: approved ? null : req.user.uid,
            ...(treatmentPending && !approved ? { sameDayTreatmentStatus: 'booking_rejected' } : {}), updatedAt: timestamp,
          }
        }
        tx.update(appointmentRef, makePairUpdate(latest))
        tx.update(linkedRef, makePairUpdate(linked))
        return
      }
      let prepared
      let groupRef = null
      let children = []
      if (latest.isGroupParent && latest.groupBookingId) {
        groupRef = firestore.collection('groupBookings').doc(String(latest.groupBookingId))
        const groupSnap = await tx.get(groupRef)
        for (const id of groupSnap.data()?.recipientAppointmentIds || []) {
          const ref = firestore.collection('appointments').doc(id), snap = await tx.get(ref)
          assertWorkflow(snap.exists, 'A group appointment is missing.')
          children.push({ ref, data: snap.data() })
        }
      } else if (latest.isBookingOrderParent) {
        for (const id of latest.appointmentIds || []) {
          const ref = firestore.collection('appointments').doc(id), snap = await tx.get(ref)
          assertWorkflow(snap.exists, 'An appointment in this order is missing.')
          children.push({ ref, data: snap.data() })
        }
      }
      if (approved && children.length) {
        for (const child of children) {
          assertWorkflow(!await getApprovedLeaveForDate(child.data.practitionerId, child.data.date), 'A practitioner is on leave for one of these appointments.')
          child.prepared = await prepareBooking({ tx, db: firestore, reservation: { ...child.data, groupBooking: null }, getBookingRange, rangesOverlap, appointmentId: child.ref.id })
        }
      } else if (approved) prepared = await prepareBooking({ tx, db: firestore, reservation: latest, getBookingRange, rangesOverlap, appointmentId })
      if (prepared) tx.set(prepared.lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      for (const lock of prepared?.customerLocks || []) tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      tx.update(appointmentRef, {
        ...(prepared && !Number(latest.amountPaid) ? prepared.data : {}),
        ...update,
        ...(!approved && isPaid ? { paymentStatus: latest.paymentStatus || appointment.paymentStatus || 'Paid' } : {}),
      })
      if (children.length) {
        for (const child of children) {
          if (child.prepared) tx.set(child.prepared.lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          for (const lock of child.prepared?.customerLocks || []) tx.set(lock, { updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          tx.update(child.ref, { approvalStatus: approved ? 'Approved' : 'Rejected', status: approved ? afterPaymentStatus(child.data) : 'Rejected', paymentStatus: approved ? 'Pending' : 'Not Applicable', approvalNote: decisionNote, approvedAt: approved ? admin.firestore.FieldValue.serverTimestamp() : null, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          const count = Number(child.data.treatmentPlan?.totalSessions || 1)
          if (approved && count > 1) for (let number = 1; number <= count; number++) tx.set(firestore.collection('treatmentSessions').doc(`${child.ref.id}-${number}`), { branchId: child.data.branchId, treatmentPlanAppointmentId: child.ref.id, customerId: child.data.customerId, customerName: child.data.customerName || '', practitionerId: child.data.practitionerId, sessionNumber: number, totalSessions: count, status: number === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: number === 1 ? child.ref.id : '', ...(number === 1 ? { date: child.data.date, time: child.data.time } : {}), sessionIntervalDays: child.data.treatmentPlan?.sessionIntervalDays || 1, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
        }
        if (groupRef) tx.set(groupRef, { status: approved ? 'Approved' : 'Rejected', approvalStatus: approved ? 'Approved' : 'Rejected', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      }
      const totalSessions = Number(prepared?.data?.treatmentPlan?.totalSessions || latest?.treatmentPlan?.totalSessions || 1)
      if (approved && totalSessions > 1) {
        for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
          const sessionRef = firestore.collection('treatmentSessions').doc(`${appointmentId}-${sessionNumber}`)
          tx.set(sessionRef, {
            branchId: latest.branchId, treatmentPlanAppointmentId: appointmentId, customerId: latest.customerId, customerName: latest.customerName || latest.clientName || 'Customer',
            practitionerId: latest.practitionerId || latest.assignedPractitionerId || '', sessionNumber, totalSessions,
            // The booking date belongs only to the first visit. Future visits
            // are deliberately left unscheduled until the treatment progresses.
            status: sessionNumber === 1 ? 'Scheduled' : 'Unscheduled', appointmentId: sessionNumber === 1 ? appointmentId : '',
            ...(sessionNumber === 1 ? { date: latest.date || '', time: latest.time || '' } : {}),
            durationMinutes: Number(latest.totalServiceDurationMinutes || latest.durationMinutes || 60),
            sessionIntervalDays: Math.min(365, Math.max(0, Number(prepared?.data?.treatmentPlan?.sessionIntervalDays ?? latest.treatmentPlan?.sessionIntervalDays ?? 0))),
            createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true })
        }
      }
    })

    if (!approved && isPaid && pendingRefund) {
      try {
        const refundContext = {
          entityType: 'appointment', recordId: appointmentId, branchId: appointmentBranchId,
          customerId: appointment.customerId || '', customerName: appointment.customerName || appointment.clientName || 'Customer',
          amount: pendingRefund.amount, paidAmount: Number(appointment.amountPaid || 0), requestId: pendingRefund.requestId,
          actorId: req.user.uid, description: appointment.service || 'Rejected appointment booking', reason: decisionNote || 'Booking rejected by clinic',
        }
        const refundResult = pendingRefund.kind === 'paymongo'
          ? await refundWorkflow.startPayMongoRefund({ ...refundContext, paymentId: pendingRefund.paymentId })
          : await refundWorkflow.recordOfflineRefund({ ...refundContext, reference: pendingRefund.reference })
        refundId = refundResult.paymongoRefundId || null
        refundStatus = refundResult.providerStatus || null
        refundState = refundResult.status || 'Requested'
      } catch (refundError) {
        refundWarning = refundError?.message || 'The refund could not be started automatically. Finance review is required.'
        refundState = 'Requested'
        console.error('Could not start booking rejection refund:', refundError)
      }
    }

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
          ? `Your request for ${appointment.service || 'the selected service'} was approved.`
          : `Your request for ${appointment.service || 'the selected service'} was rejected.${refundState === 'Processing' ? ' Your refund is processing.' : refundState === 'Refunded' ? ' Your refund has been confirmed.' : refundState === 'Requested' ? ' The refund needs clinic review.' : ''}${decisionNote ? ` Note: ${decisionNote}` : ''}`,
        link: '/customer/appointments',
      })
    } catch (notificationError) {
      console.error('Failed to notify customer about booking decision:', notificationError)
    }

    return res.json({ success: true, data: { appointmentId, status: nextStatus, approvalStatus: update.approvalStatus, refundStatus: refundState || null, ...(refundWarning ? { refundWarning } : {}) } })
  } catch (error) {
    console.error('appointments/approve-booking error:', error)
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Failed to decide booking request' })
  }
})

app.get('/appointments/:id/feedback', requireAuth, async (req, res) => {
  const appointmentId = String(req.params.id || '').trim()
  try {
    const firestore = admin.firestore()
    const appointmentSnap = await firestore.collection('appointments').doc(appointmentId).get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    if (String(appointmentSnap.data()?.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
    const reviewSnap = await firestore.collection('reviews').doc(`${appointmentId}_${req.user.uid}`).get()
    if (!reviewSnap.exists) return res.json({ success: true, data: { review: null } })
    const review = reviewSnap.data() || {}
    return res.json({ success: true, data: { review: { rating: Number(review.rating || 0), comment: String(review.comment || ''), reviewerName: String(review.reviewerName || ''), createdAt: review.createdAt || null, updatedAt: review.updatedAt || null } } })
  } catch (error) {
    console.error('appointment feedback read error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Feedback could not be loaded.' })
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
    const status = normalizeBookingStatus(appointment.status)
    const practitionerFinished = appointment.workerCompleted === true
      && ['awaiting customer confirmation', 'balance due'].includes(status)
    if (status !== 'completed' && !practitionerFinished) return res.status(409).json({ success: false, error: 'Feedback is available after the clinic marks the service complete.' })

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
  const decision = String(req.body?.decision || 'approve').trim().toLowerCase()
  const decisionNote = String(req.body?.decisionNote || req.body?.note || '').trim()
  if (!appointmentId) {
    return res.status(400).json({ success: false, error: 'appointment id is required' })
  }
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ success: false, error: 'decision must be approve or reject' })

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

    if (decision === 'approve') {
      const sameDayRestriction = sameDayChangeError(appointmentData, requestType)
      if (sameDayRestriction) return res.status(409).json({ success: false, error: sameDayRestriction })
    }

    req.userContext = req.userContext || await loadUserContext(req.user.uid)
    const userSnap = await firestore.collection('users').doc(req.user.uid).get()
    const userData = userSnap.exists ? userSnap.data() || {} : {}
    const userBranchIds = new Set([userData.branchId, ...(Array.isArray(userData.branchIds) ? userData.branchIds : [])].map((id) => String(id || '').trim()).filter(Boolean))
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
      appointmentBranchId &&
      !userBranchIds.has(appointmentBranchId)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      })
    }

    branchName = await getAppointmentBranchName(firestore, appointmentBranchId, 'Clinic')
    customerProfile = await getAppointmentCustomerProfile(firestore, appointmentData)

    if (decision === 'reject') {
      const rejectionReason = decisionNote || 'The clinic could not approve this request.'
      const now = admin.firestore.FieldValue.serverTimestamp()
      const rejectedStatus = await firestore.runTransaction(async tx => {
        const freshSnap = await tx.get(appointmentRef)
        const fresh = freshSnap.exists ? freshSnap.data() || {} : null
        assertWorkflow(fresh && normalized(fresh.status) === (requestType === 'cancel' ? 'cancellation requested' : 'reschedule requested'), 'This request is no longer awaiting approval.', 409)
        const restoredStatus = String(fresh.statusBeforeChange || afterPaymentStatus(fresh)).trim() || 'Scheduled'
        tx.update(appointmentRef, {
          status: restoredStatus,
          statusBeforeChange: admin.firestore.FieldValue.delete(),
          requestDecisionStatus: 'Rejected', requestDecisionNote: rejectionReason,
          requestDecisionAt: now, requestDecisionById: req.user.uid, requestDecisionByName: staffDisplayName,
          ...(requestType === 'cancel' ? {
            refundStatus: 'Rejected', refundRequestStatus: 'Rejected', refundDecisionNote: rejectionReason,
            refundDecisionAt: now, refundDecisionById: req.user.uid, refundDecisionByName: staffDisplayName,
            cancellationRequestStatus: 'Rejected', cancellationRejectedAt: now,
          } : { rescheduleDecisionNote: rejectionReason, rescheduleRejectedAt: now, rescheduleRejectedById: req.user.uid }),
          updatedAt: now,
        })
        tx.set(firestore.collection('appointmentAudit').doc(), { appointmentId, branchId: appointmentBranchId, actorId: req.user.uid, action: `${requestType}_request_rejected`, previousStatus: fresh.status, nextStatus: restoredStatus, remarks: rejectionReason, createdAt: now })
        return restoredStatus
      })
      await createAppointmentNotification({
        firestore, customerId: customerProfile?.customerId || appointmentData.customerId || '',
        title: requestType === 'cancel' ? 'Cancellation Request Declined' : 'Reschedule Request Declined',
        message: `Your ${requestType === 'cancel' ? 'cancellation' : 'reschedule'} request for ${appointmentData.service || 'your appointment'} was declined. The existing appointment remains scheduled. Note: ${rejectionReason}`,
        link: '/customer/appointments',
      }).catch(() => {})
      return res.json({ success: true, data: { appointmentId, requestType, status: rejectedStatus, decision: 'Rejected' } })
    }

    if (requestType === 'cancel') {
      const totalAmount = Number(appointmentData.totalAmount || appointmentData.amountPaid || appointmentData.amount || 0)
      const refundSnapshot = appointmentData.cancellationRefundPolicySnapshot
      const paidAmount = Math.max(0, Number(appointmentData.amountPaid || 0))
      commissionAmount = Math.min(paidAmount, Math.max(0, Number(refundSnapshot?.commissionAmount ?? appointmentData.commissionAmount ?? appointmentData.refundCommissionAmount ?? 0)))
      const eligibleRefundBase = Math.max(0, Math.min(totalAmount, paidAmount) - commissionAmount)
      refundAmount = refundSnapshot?.version === 1
        ? Math.min(eligibleRefundBase, Math.max(0, Number(refundSnapshot.refundAmount || 0)))
        : eligibleRefundBase

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

      const paidStatuses = ['paid', 'partially paid', 'partially refunded', 'refunded']
      const wasPaid = paidStatuses.includes(String(appointmentData.paymentStatus || '').trim().toLowerCase()) && Number(appointmentData.amountPaid || 0) > 0
      const refundRequestId = String(appointmentData.refundRequestId || `appointment-cancel-${appointmentId}`)
      let refundResult = null
      if (refundAmount > 0 && wasPaid) {
        assertWorkflow(req.userContext.permissions.has('finance:refunds:manage') || roleKey === 'Owner' || roleKey === 'Superadmin', 'Finance refund permission is required to approve a cancellation with a refund.', 403)
        if (isPayMongoPaid) {
          assertWorkflow(paymentId, 'The verified PayMongo payment reference is missing.', 409)
        } else {
          assertWorkflow(String(appointmentData.source || '').trim().toLowerCase() !== 'paymongo_checkout', 'The verified PayMongo payment reference is missing. Do not record an offline refund for an online payment.', 409)
          assertWorkflow(req.body?.offlineRefundConfirmed === true, 'Confirm that the offline refund has actually been returned before approving.', 400)
          assertWorkflow(String(req.body?.offlineRefundReference || '').trim().length >= 2, 'Enter the cash or bank refund reference.', 400)
        }
      }

      const initialRefundStatus = refundAmount > 0 && wasPaid ? 'Requested' : 'Not Applicable'
      await firestore.runTransaction(async tx => {
        const freshSnap = await tx.get(appointmentRef)
        const fresh = freshSnap.exists ? freshSnap.data() || {} : null
        assertWorkflow(fresh && normalized(fresh.status) === 'cancellation requested', 'This cancellation request is no longer awaiting approval.', 409)
        assertWorkflow(!sameDayChangeError(fresh, 'cancel'), sameDayChangeError(fresh, 'cancel'), 409)
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const releasedTreatmentId = await cancelPendingSameDayTreatment({ tx, db: firestore, appointmentId, consultation: fresh, timestamp })
        tx.update(appointmentRef, {
        status: 'Cancelled',
        statusBeforeChange: admin.firestore.FieldValue.delete(),
        refundProcessing: false,
        requestDecisionStatus: 'Approved',
        requestDecisionNote: decisionNote,
        requestDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
        requestDecisionById: req.user.uid,
        requestDecisionByName: staffDisplayName,
        refundStatus: initialRefundStatus,
        refundRequestStatus: initialRefundStatus,
        cancellationRequestStatus: 'Approved',
        refundRequestId,
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
        ...(releasedTreatmentId ? { sameDayTreatmentStatus: 'booking_cancelled' } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })

      if (refundAmount > 0 && wasPaid) {
        try {
          if (isPayMongoPaid) {
            refundResult = await refundWorkflow.startPayMongoRefund({
              entityType: 'appointment', recordId: appointmentId, branchId: appointmentBranchId,
              customerId: appointmentData.customerId || '', customerName: appointmentData.customerName || appointmentData.clientName || 'Customer',
              paymentId, amount: refundAmount, paidAmount: appointmentData.amountPaid, requestId: refundRequestId,
              actorId: req.user.uid, description: appointmentData.service || 'Appointment cancellation', reason: decisionNote || appointmentData.cancellationReason || 'Cancellation approved',
            })
            paymongoRefundId = refundResult.paymongoRefundId || null
            paymongoRefundStatus = refundResult.providerStatus || null
          } else {
            refundResult = await refundWorkflow.recordOfflineRefund({
              entityType: 'appointment', recordId: appointmentId, branchId: appointmentBranchId,
              customerId: appointmentData.customerId || '', customerName: appointmentData.customerName || appointmentData.clientName || 'Customer',
              amount: refundAmount, paidAmount: appointmentData.amountPaid, requestId: refundRequestId,
              actorId: req.user.uid, description: appointmentData.service || 'Appointment cancellation',
              reason: decisionNote || appointmentData.cancellationReason || 'Cancellation approved', reference: req.body?.offlineRefundReference,
            })
          }
        } catch (refundError) {
          warnings.push(refundError?.message || 'Refund needs finance review.')
          refundResult = { status: 'Requested' }
        }
      }
      const finalRefundStatus = refundAmount > 0 && wasPaid ? (refundResult?.status || 'Requested') : 'Not Applicable'

      try {
        const notificationMessage = finalRefundStatus === 'Processing'
          ? `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved. A refund of ${formatPhilippineCurrency(refundAmount)} is processing and will be marked complete after the payment provider confirms it.`
          : finalRefundStatus === 'Requested'
            ? `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved, but the refund could not be started automatically. The clinic will review the payment and update you.`
          : finalRefundStatus === 'Refunded'
            ? `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved. The clinic confirmed the refund of ${formatPhilippineCurrency(refundAmount)}.`
            : `Your cancellation request for ${appointmentData.service || 'your appointment'} was approved. No refund is due under the recorded payment and cancellation terms.`

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
          isPayMongoPaid: finalRefundStatus === 'Processing' || finalRefundStatus === 'Refunded',
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
          isPayMongoPaid: finalRefundStatus === 'Processing' || finalRefundStatus === 'Refunded',
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
          refundStatus: finalRefundStatus,
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

    const rescheduleUpdate = {
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
    }
    assertWorkflow(!await getApprovedLeaveForDate(requestedPractitionerId, requestedDate), 'The practitioner is on approved leave for this date.')
    const codeDelivery = await firestore.runTransaction(async tx => {
      const fresh = (await tx.get(appointmentRef)).data()
      assertWorkflow(fresh && normalized(fresh.status) === 'reschedule requested' && !fresh.startedAt && !fresh.checkedInAt, 'This appointment can no longer be rescheduled.')
      assertWorkflow(!sameDayChangeError(fresh, 'reschedule'), sameDayChangeError(fresh, 'reschedule'), 409)
      const allowance = Number(fresh.rescheduleAllowanceSnapshot ?? 1)
      assertWorkflow(Number(fresh.rescheduleCount || 0) < allowance, 'This appointment has reached the reschedule limit.', 409)
      if (fresh.rescheduleCountAtRequest !== undefined) assertWorkflow(Number(fresh.rescheduleCountAtRequest) === Number(fresh.rescheduleCount || 0), 'The reschedule allowance changed while this request was pending.', 409)
      const prepared = await prepareBooking({ tx, db: firestore, reservation: { ...fresh, date: requestedDate, time: requestedTime, endTime: '', practitionerId: requestedPractitionerId, assignedPractitionerId: requestedPractitionerId, groupBooking: null }, getBookingRange, rangesOverlap, appointmentId })
      const serviceKey = fresh.serviceKey ? String(crypto.randomInt(100000, 1000000)) : null
      const status = afterPaymentStatus({ ...fresh, startedAt: null, checkedInAt: null, workerKeyVerified: false })
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      tx.set(prepared.lock, { updatedAt: timestamp })
      for (const lock of prepared.customerLocks || []) tx.set(lock, { updatedAt: timestamp })
      tx.update(appointmentRef, { ...rescheduleUpdate, ...resetAppointmentAccess(), treatmentTeam: [], staffingRequirements: prepared.data.staffingRequirements, status, endTime: prepared.data.endTime, serviceKey, checkedInAt: null, workerKeyVerified: false, rescheduleCount: Number(fresh.rescheduleCount || 0) + 1 })
      if (fresh.treatmentPlan?.totalSessions > 1) tx.set(firestore.collection('treatmentSessions').doc(`${fresh.treatmentPlanAppointmentId || appointmentId}-${fresh.sessionNumber || 1}`), { date: requestedDate, time: requestedTime, status: 'Scheduled', updatedAt: timestamp }, { merge: true })
      tx.set(firestore.collection('appointmentAudit').doc(), { appointmentId, branchId: fresh.branchId, actorId: req.user.uid, action: 'reschedule_approved', previousStatus: fresh.status, nextStatus: status, date: requestedDate, time: requestedTime, createdAt: timestamp })
      return { email: fresh.customerEmail, serviceKey, date: requestedDate, time: requestedTime }
    })
    if (codeDelivery.serviceKey) await sendServiceCode(codeDelivery).catch(error => console.warn('Rescheduled code email failed:', error.message))

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
    return res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Failed to approve appointment request',
    })
  }
})

app.post('/appointments/:id/clinic-reschedule', requireAuth, async (req, res) => {
  if (!adminReady) {
    return res.status(500).json({ success: false, error: adminInitError || 'firebase-admin is not ready' })
  }

  const appointmentId = String(req.params.id || '').trim()
  const date = String(req.body?.date || '').trim()
  const time = String(req.body?.time || '').trim()
  const practitionerId = String(req.body?.practitionerId || '').trim()
  const reason = String(req.body?.reason || '').trim()
  if (!appointmentId) return res.status(400).json({ success: false, error: 'Appointment id is required.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || parseClockToMinutes(time) === null) {
    return res.status(400).json({ success: false, error: 'Choose a valid appointment date and time.' })
  }
  if (new Date(`${date}T${time}:00+08:00`).getTime() <= Date.now()) {
    return res.status(400).json({ success: false, error: 'Choose a future date and time.' })
  }
  if (!practitionerId) return res.status(400).json({ success: false, error: 'Choose an available practitioner.' })
  if (reason.length < 5 || reason.length > 1000) {
    return res.status(400).json({ success: false, error: 'Enter a reason between 5 and 1000 characters.' })
  }

  const firestore = admin.firestore()
  const appointmentRef = firestore.collection('appointments').doc(appointmentId)
  const warnings = []

  try {
    const initialSnap = await appointmentRef.get()
    if (!initialSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const initial = initialSnap.data() || {}
    const branchId = String(initial.branchId || '').trim()
    assertWorkflow(branchId, 'Appointment has no clinic branch.', 409)
    await authorizeClinicAction(req.user.uid, branchId, 'appointments:update')

    const staffSnap = await firestore.collection('users').doc(req.user.uid).get()
    const staffName = getStaffDisplayName(staffSnap.exists ? staffSnap.data() || {} : {})
    let customerProfile = null
    try {
      customerProfile = await getAppointmentCustomerProfile(firestore, initial)
    } catch (profileError) {
      warnings.push(profileError?.message || 'Customer profile could not be loaded for notification.')
    }
    const branchName = await getAppointmentBranchName(firestore, branchId, 'Clinic').catch(() => 'Clinic')

    const result = await firestore.runTransaction(async tx => {
      await authorizeClinicActionInTransaction(tx, req.user.uid, branchId, 'appointments:update')
      const freshSnap = await tx.get(appointmentRef)
      assertWorkflow(freshSnap.exists, 'Appointment not found.', 404)
      const fresh = freshSnap.data() || {}
      assertWorkflow(String(fresh.branchId || '').trim() === branchId, 'Appointment branch changed. Refresh and try again.', 409)
      assertWorkflow(!fresh.isGroupParent && !fresh.isBookingOrderParent, 'Reschedule an individual service recipient instead of a booking summary.', 400)
      assertWorkflow(!fresh.startedAt && !fresh.checkedInAt, 'An appointment that has started or checked in cannot be rescheduled.')
      assertWorkflow(['scheduled', 'paid', 'awaiting payment', 'contract pending', 'unpaid', 'balance due'].includes(normalized(fresh.status)), 'Only an upcoming appointment can be rescheduled.')
      const currentSchedule = `${String(fresh.date || '').trim()} ${String(fresh.time || '').trim()}`
      assertWorkflow(currentSchedule !== `${date} ${time}`, 'Choose a different date or time.')

      const leaveSnap = await tx.get(firestore.collection('leaveRequests').where('requesterId', '==', practitionerId))
      const approvedLeave = leaveSnap.docs.find(leaveDoc => {
        const leave = leaveDoc.data() || {}
        return normalized(leave.status) === 'approved'
          && String(leave.startDate || '').trim() <= date
          && String(leave.endDate || '').trim() >= date
      })
      assertWorkflow(!approvedLeave, 'The selected practitioner is on approved leave for that date.')

      const prepared = await prepareBooking({
        tx,
        db: firestore,
        reservation: {
          ...fresh,
          date,
          time,
          endTime: '',
          practitionerId,
          assignedPractitionerId: practitionerId,
          groupBooking: null,
        },
        getBookingRange,
        rangesOverlap,
        appointmentId,
      })
      const practitionerSnap = await tx.get(firestore.collection('users').doc(practitionerId))
      assertWorkflow(practitionerSnap.exists, 'The selected practitioner is unavailable.', 409)
      const practitionerData = practitionerSnap.data() || {}
      const practitionerName = String(practitionerData.fullName || `${practitionerData.firstName || ''} ${practitionerData.lastName || ''}`.trim() || practitionerData.email || 'Practitioner')
      const now = admin.firestore.FieldValue.serverTimestamp()
      const serviceKey = fresh.serviceKey ? String(crypto.randomInt(100000, 1000000)) : null

      tx.set(prepared.lock, { updatedAt: now })
      for (const lock of prepared.customerLocks || []) tx.set(lock, { updatedAt: now })
      tx.update(appointmentRef, {
        ...resetAppointmentAccess(),
        date,
        time,
        endTime: prepared.data.endTime,
        practitionerId,
        assignedPractitionerId: practitionerId,
        practitionerName,
        assignedPractitionerName: practitionerName,
        totalServiceDurationMinutes: prepared.data.totalServiceDurationMinutes,
        staffingRequirements: prepared.data.staffingRequirements,
        resources: prepared.data.resources,
        treatmentTeam: [],
        serviceKey,
        clinicRescheduleReason: reason,
        clinicRescheduledAt: now,
        clinicRescheduledById: req.user.uid,
        clinicRescheduledByName: staffName,
        clinicPreviousSchedule: {
          date: String(fresh.date || ''),
          time: String(fresh.time || ''),
          practitionerId: String(fresh.practitionerId || fresh.assignedPractitionerId || ''),
          practitionerName: String(fresh.practitionerName || fresh.assignedPractitionerName || ''),
        },
        updatedAt: now,
      })
      if (fresh.treatmentPlan?.totalSessions > 1) {
        const sessionNumber = Number(fresh.sessionNumber || 1)
        const sessionId = `${fresh.treatmentPlanAppointmentId || appointmentId}-${sessionNumber}`
        tx.set(firestore.collection('treatmentSessions').doc(sessionId), {
          date,
          time,
          practitionerId,
          status: 'Scheduled',
          updatedAt: now,
        }, { merge: true })
      }
      tx.set(firestore.collection('appointmentAudit').doc(), {
        appointmentId,
        branchId,
        actorId: req.user.uid,
        action: 'clinic_rescheduled',
        previousStatus: fresh.status,
        nextStatus: fresh.status,
        previousDate: String(fresh.date || ''),
        previousTime: String(fresh.time || ''),
        previousPractitionerId: String(fresh.practitionerId || fresh.assignedPractitionerId || ''),
        date,
        time,
        practitionerId,
        reason,
        createdAt: now,
      })
      return {
        appointmentId,
        customerId: String(fresh.customerId || ''),
        customerName: String(fresh.customerName || fresh.clientName || 'Customer'),
        customerEmail: String(fresh.customerEmail || ''),
        service: String(fresh.service || 'appointment'),
        date,
        time,
        status: fresh.status,
        serviceKey,
      }
    })

    if (result.serviceKey) {
      const codeDelivery = await sendServiceCode({ email: customerProfile?.customerEmail || result.customerEmail, serviceKey: result.serviceKey, date, time }).catch(error => ({ skipped: true, reason: error?.message || 'The refreshed service code email could not be sent.' }))
      if (codeDelivery?.skipped || codeDelivery?.statusCode !== 200) {
        warnings.push(codeDelivery?.reason || 'The refreshed service code email was not accepted by the mail provider.')
      }
    }
    const customerId = customerProfile?.customerId || result.customerId
    const scheduleLabel = [date, time].filter(Boolean).join(' ')
    try {
      const notificationResult = await createAppointmentNotification({
        firestore,
        customerId,
        title: 'Appointment Rescheduled by Clinic',
        message: `${branchName} rescheduled your ${result.service} due to a clinic schedule change. New schedule: ${scheduleLabel}. Contact the clinic or submit a new reschedule request if this time does not work for you.`,
        link: '/customer/appointments',
      })
      if (notificationResult?.skipped) warnings.push(notificationResult.reason || 'The in-app customer notification was skipped.')
    } catch (notificationError) {
      warnings.push(notificationError?.message || 'The in-app customer notification could not be created.')
    }
    try {
      const emailResult = await sendAppointmentDecisionEmail({
        recipient: customerProfile?.customerEmail || result.customerEmail,
        customerName: customerProfile?.customerName || result.customerName,
        branchName,
        appointmentLabel: result.service,
        requestType: 'clinic_reschedule',
        appointmentDate: date,
        appointmentTime: time,
      })
      if (emailResult?.skipped || emailResult?.delivery?.statusCode !== 200) {
        warnings.push(emailResult?.reason || 'The reschedule email was not accepted by the mail provider.')
      }
    } catch (emailError) {
      warnings.push(emailError?.message || 'The reschedule email could not be sent.')
    }

    const responseData = { ...result, warnings }
    delete responseData.serviceKey
    return res.json({ success: true, data: responseData })
  } catch (error) {
    console.error('clinic appointment reschedule error:', error)
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Failed to reschedule appointment.' })
  }
})

const appointmentCheckoutLineItems = (pricingSnapshot, amountCents, serviceName = 'Appointment') => {
  const invoiceTotalCents = Math.round(Number(pricingSnapshot?.total || 0) * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || invoiceTotalCents <= 0 || !pricingSnapshot) return null
  const invoiceVatCents = pricingSnapshot.vatApplicable === true ? Math.round(Number(pricingSnapshot.vatAmount || 0) * 100) : 0
  const dueVatCents = Math.min(amountCents, Math.round(invoiceVatCents * amountCents / invoiceTotalCents))
  const subtotalDueCents = amountCents - dueVatCents
  const items = []
  if (subtotalDueCents > 0) items.push({ amount: subtotalDueCents, currency: 'PHP', name: `${String(serviceName).slice(0, 55)} subtotal`, quantity: 1 })
  if (dueVatCents > 0) items.push({ amount: dueVatCents, currency: 'PHP', name: 'VAT (12%)', quantity: 1 })
  return items.length ? items : null
}

app.post('/paymongo/create-checkout-session', requireAuth, async (req, res) => {
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

  try { assertCustomerCheckoutSupported(metadata) } catch (error) { return res.status(error.status).json({ success: false, error: error.message }) }
  const moduleKey = String(metadata?.module || '').trim().toLowerCase()
  const isSubscriptionCheckout = moduleKey === 'subscription'
  const isCustomerOrderCheckout = moduleKey === 'customer_order'
  const isCustomerBookingCheckout =
    moduleKey === 'customer_appointment' ||
    moduleKey === 'customer_consultation'
  if (isCustomerBookingCheckout) await safelySweepAppointmentPaymentHolds()
  const reservationId = String(metadata?.reservationId || '').trim()
  const totalServiceDurationMinutes = Math.max(
    30,
    Number(metadata?.totalServiceDurationMinutes || metadata?.durationMinutes || 0)
  )

  let orderSnapshot = null
  let approvedProductLines = null
  let appointmentPaymentLines = null
  let appointmentCheckoutTarget = null
  if (isCustomerOrderCheckout) {
    try {
      const items = req.body?.items
      if (!Array.isArray(items) || !items.length || items.length > 50) throw Object.assign(new Error('Select between 1 and 50 products.'), { status: 400 })
      const listings = await Promise.all(items.map(async (item) => {
        const id = String(item.id || '')
        if (!id || id.includes('/')) throw Object.assign(new Error('Invalid product.'), { status: 400 })
        return (await admin.firestore().collection('productServicePosts').doc(id).get()).data()
      }))
      approvedProductLines = approvedOrderLines(items, listings, amount)
      orderSnapshot = await prepareOrderSnapshot(admin.firestore(), items, req.user.uid, req.body.delivery, String(referenceNumber || ''))
    } catch (error) { return res.status(error.status || 500).json({ success: false, error: error.message }) }
  }

  if (metadata?.saleMode === 'appointment') {
    try {
      const appointment = (await admin.firestore().collection('appointments').doc(String(metadata.appointmentId || '')).get()).data()
      assertWorkflow(appointment?.source === 'walk_in', 'Select a walk-in appointment.')
      await authorizeClinicAction(req.user.uid, appointment.branchId, 'payments:create')
      assertWorkflow(appointment.branchId === metadata.branchId && appointment.status === 'Unpaid', 'This appointment is not ready for payment.')
      assertWalkInPaymentAgreements(appointment)
      assertWorkflow(Math.round(Number(appointment.totalAmount ?? appointment.amount) * 100) === Number(amount), 'Payment amount does not match the appointment.')
    } catch (error) { return res.status(error.status || 400).json({ success: false, error: error.message }) }
  }

  if (!isSubscriptionCheckout) {
    if (!req.user?.uid) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization token',
      })
    }
    if (isCustomerOrderCheckout || isCustomerBookingCheckout) {
      if (isCustomerBookingCheckout && req.body?.paymentAgreementAcknowledged !== true) {
        return res.status(422).json({
          success: false,
          code: 'PAYMENT_AGREEMENT_REQUIRED',
          error: 'Please review and accept the clinic agreement before payment.',
        })
      }
      if (isCustomerOrderCheckout && req.body?.policyAcknowledged !== true) {
        return res.status(422).json({
          success: false,
          code: 'ORDER_POLICY_ACKNOWLEDGEMENT_REQUIRED',
          error: 'Please review and accept the clinic policies before payment.',
        })
      }
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
          if (appointmentData.sameDayTreatmentStatus === 'pending_clinical_clearance') return res.status(409).json({ success: false, error: 'The practitioner must clear same-day treatment after the consultation before payment is available.' })
          if (appointmentData.paymentManagedByOrganizer && !appointmentData.isBookingOrderParent && !appointmentData.isGroupParent) return res.status(409).json({ success: false, error: 'Pay through the shared booking checkout.' })
          if (String(appointmentData.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
          if (!['approved', 'awaiting payment', 'payment pending', 'balance due'].includes(normalizeBookingStatus(appointmentData.status))) {
            return res.status(409).json({ success: false, error: 'This appointment is not ready for payment.' })
          }
          if (appointmentData.approvalStatus !== 'Approved') return res.status(409).json({ success: false, error: 'This booking is not ready for payment.' })
          const holdExpiry = timestampMillis(appointmentData.paymentHoldExpiresAt)
          if (normalized(appointmentData.paymentHoldStatus) === 'released' || (holdExpiry && holdExpiry <= Date.now() && !appointmentData.activePaymongoCheckoutSessionId)) {
            return res.status(409).json({ success: false, error: 'The payment window expired and the appointment slot was released. Please choose a new time.' })
          }
          appointmentCheckoutTarget = { id: appointmentId, data: appointmentData }
          if (!appointmentData.isBookingOrderParent && normalized(appointmentData.contract?.status) !== 'signed') return res.status(409).json({ success: false, error: 'Please review and sign your contract before payment.' })
          if (appointmentData.isBookingOrderParent) {
            const childIds = Array.isArray(appointmentData.appointmentIds) ? appointmentData.appointmentIds : []
            if (!childIds.length) return res.status(409).json({ success: false, error: 'This booking order has no appointments to pay for.' })
            const children = await Promise.all(childIds.map(id => firestore.collection('appointments').doc(String(id)).get()))
            const childAppointments = children.filter(child => child.exists).map(child => ({ id: child.id, ...child.data() }))
            if (!bookingOrderReadyForPayment(appointmentData, childAppointments)) return res.status(409).json({ success: false, error: 'Every appointment in this order must be approved and have a signed agreement before payment.' })
          }
          const remainingAmount = paymentDue(appointmentData) / 100
          if (remainingAmount <= 0) return res.status(409).json({ success: false, error: 'This appointment has no remaining balance.' })
          if (Math.abs(Number(amount || 0) - Math.round(remainingAmount * 100)) > 1) {
            return res.status(409).json({ success: false, error: 'Payment amount does not match the appointment balance.' })
          }
          appointmentPaymentLines = appointmentCheckoutLineItems(
            appointmentData.pricingSnapshot,
            Math.round(Number(amount || 0)),
            appointmentData.service || 'Appointment',
          )
        } else {
          return res.status(409).json({ success: false, error: 'Create the appointment first, then sign its agreement and pay from My Appointments.' })
        }
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
        const hasActiveCurrentCycle = hasActivePaidCycle({ ...context.userData, ...context.clinicData }, now)

        if (!['basic', 'premium'].includes(targetPlan)) {
          return res.status(400).json({
            success: false,
            error: 'Only paid plans can be checked out here.',
          })
        }

        if (targetPlan === context.currentPlan && hasActiveCurrentCycle && !subscriptionLifecycle(context.clinicData).trial) {
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

  if (isCustomerBookingCheckout && appointmentCheckoutTarget?.data?.activePaymongoCheckoutSessionId) {
    const activeId = String(appointmentCheckoutTarget.data.activePaymongoCheckoutSessionId)
    try {
      const existingResponse = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(activeId)}`, { headers: buildPayMongoHeaders() })
      const existingPayload = await existingResponse.json().catch(() => ({}))
      const existingAttributes = existingPayload?.data?.attributes || {}
      if (existingResponse.ok && String(existingAttributes.status || '').toLowerCase() !== 'expired') {
        return res.json({ success: true, data: { id: activeId, checkout_url: existingAttributes.checkout_url, client_key: existingAttributes.client_key, reused: true } })
      }
    } catch (error) {
      return res.status(503).json({ success: false, error: 'We could not check your active payment session. Please try again shortly.' })
    }
  }

  const payload = {
    data: {
      attributes: {
        billing: billing && typeof billing === 'object' ? billing : null,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: String(description || 'POS Payment'),
        line_items: approvedProductLines || (isCustomerBookingCheckout
          ? appointmentPaymentLines || fallbackLineItem
          : Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : fallbackLineItem),
        ...(selectedMethods.length > 0 ? { payment_method_types: selectedMethods } : {}),
        reference_number: String(referenceNumber || ''),
        metadata: {
          ...(metadata && typeof metadata === 'object' ? metadata : {}),
          ...(isSubscriptionCheckout && req.user?.uid ? { ownerUid: req.user.uid } : {}),
        },
        success_url:
          successUrl ||
          `${resolveFrontendBaseUrl(req)}/crm/walk-in?paymongo_status=success`,
        cancel_url:
          cancelUrl ||
          `${resolveFrontendBaseUrl(req)}/crm/walk-in?paymongo_status=cancelled`,
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

    if (orderSnapshot) await admin.firestore().collection('orderCheckouts').doc(data.data.id).set(orderSnapshot)
    if (isCustomerBookingCheckout && appointmentCheckoutTarget?.id) {
      const db = admin.firestore()
      const appointmentRef = db.collection('appointments').doc(appointmentCheckoutTarget.id)
      try {
        await db.runTransaction(async tx => {
          const freshSnap = await tx.get(appointmentRef)
          assertWorkflow(freshSnap.exists, 'Appointment not found.', 404)
          const fresh = freshSnap.data() || {}
          const expiry = timestampMillis(fresh.paymentHoldExpiresAt)
          assertWorkflow(normalized(fresh.paymentHoldStatus) !== 'released' && (!expiry || expiry > Date.now()), 'The payment window expired. Please choose a new appointment time.', 409)
          assertWorkflow(String(fresh.customerId || '') === String(req.user.uid), 'Forbidden', 403)
          const activeSession = String(fresh.activePaymongoCheckoutSessionId || '').trim()
          assertWorkflow(!activeSession || activeSession === data.data.id, 'Another payment checkout is already active.', 409)
          const checkoutChildren = []
          if (fresh.isBookingOrderParent) {
            for (const childId of fresh.appointmentIds || []) {
              const childRef = db.collection('appointments').doc(String(childId))
              const childSnap = await tx.get(childRef)
              if (childSnap.exists) checkoutChildren.push(childRef)
            }
          }
          tx.update(appointmentRef, { activePaymongoCheckoutSessionId: data.data.id, paymentHoldStatus: 'checkout_active', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          for (const childRef of checkoutChildren) tx.update(childRef, { paymentHoldStatus: 'checkout_active', updatedAt: admin.firestore.FieldValue.serverTimestamp() })
          if (fresh.bookingId) tx.set(db.collection('bookings').doc(String(fresh.bookingId)), { activePaymongoCheckoutSessionId: data.data.id, paymentHoldStatus: 'checkout_active', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
        })
      } catch (error) {
        await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(data.data.id)}/expire`, { method: 'POST', headers: buildPayMongoHeaders() }).catch(() => {})
        return res.status(error.status || 409).json({ success: false, error: error.message || 'The appointment hold is no longer available.' })
      }
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
    return res.status(error?.status || 500).json({
      success: false,
      error: error?.message || 'Unexpected PayMongo error',
    })
  }
})

const recordAppointmentPayment = async (req, res) => {
  if (!assertPayMongoConfigured(res)) return

  const appointmentId = String(req.params.id || '').trim()
  const checkoutSessionId = String(req.body?.checkoutSessionId || '').trim()
  if (!appointmentId || !checkoutSessionId) return res.status(400).json({ success: false, error: 'appointment id and checkoutSessionId are required' })
  if (req.body?.paymentAgreementAcknowledged !== true) {
    return res.status(422).json({
      success: false,
      code: 'PAYMENT_AGREEMENT_REQUIRED',
      error: 'Please review and accept the clinic agreement before payment.',
    })
  }

  try {
    const firestore = admin.firestore()
    const appointmentRef = firestore.collection('appointments').doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found' })
    const appointment = appointmentSnap.data() || {}
    if (String(appointment.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (appointment.sameDayTreatmentStatus === 'pending_clinical_clearance') return res.status(409).json({ success: false, error: 'The practitioner must clear same-day treatment after the consultation before payment is available.' })
    if (appointment.paymentManagedByOrganizer && !appointment.isBookingOrderParent && !appointment.isGroupParent) return res.status(409).json({ success: false, error: 'Pay through the shared booking checkout.' })
    if (!(appointment.recordedPaymentSessions || []).includes(checkoutSessionId) && !['approved', 'awaiting payment', 'payment pending', 'contract pending', 'balance due', 'paid', 'partially paid'].includes(normalizeBookingStatus(appointment.status))) {
      return res.status(409).json({ success: false, error: 'Payment is not available for this appointment yet.' })
    }
    if (appointment.approvalStatus !== 'Approved') return res.status(409).json({ success: false, error: 'This booking is not ready for payment.' })

    if (appointment.isBookingOrderParent) {
      const childIds = Array.isArray(appointment.appointmentIds) ? appointment.appointmentIds : []
      const children = await Promise.all(childIds.map(id => firestore.collection('appointments').doc(String(id)).get()))
      const childAppointments = children.filter(child => child.exists).map(child => ({ id: child.id, ...child.data() }))
      if (!bookingOrderReadyForPayment(appointment, childAppointments)) return res.status(409).json({ success: false, error: 'Every appointment in this order must be approved and have a signed agreement before payment.' })
    }

    if ((appointment.recordedPaymentSessions || []).includes(checkoutSessionId) || String(appointment.paymongoCheckoutSessionId || '').trim() === checkoutSessionId) {
      const clinicSnap = appointment.branchId ? await firestore.collection('clinics').doc(String(appointment.branchId)).get() : null
      let emailResult = { sent: false }
      try {
        emailResult = await emailAppointmentPaymentReceipt({
          db: firestore,
          transactionId: `booking-${checkoutSessionId}`,
          appointment,
          clinicName: clinicSnap?.data()?.name || '',
          senderEmail,
          sendEmail: postmarkClient?.sendEmail.bind(postmarkClient),
        })
      } catch (error) { console.warn('Could not send appointment receipt email:', error?.message || error) }
      return res.json({
        success: true,
        data: {
          appointmentId,
          status: appointment.status,
          amountPaid: Number(appointment.amountPaid || 0),
          paymentCoverage: appointment.paymentCoverage || 'pending',
          serviceKey: appointment.serviceKey || null,
          alreadyRecorded: true,
          receiptEmailSent: emailResult.sent,
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
    const paid = Boolean(attributes.paid_at) || (Array.isArray(attributes.payments) && attributes.payments.some((payment) => payment.attributes?.status === 'paid'))
    if (String(metadata.appointmentId || '').trim() !== appointmentId || String(metadata.customerId || '').trim() !== req.user.uid) {
      return res.status(403).json({ success: false, error: 'Payment session does not belong to this appointment.' })
    }
    if (!paid) return res.status(409).json({ success: false, error: 'Payment has not been completed.' })

    const payment = Array.isArray(attributes.payments) ? attributes.payments.find((entry) => entry.attributes?.status === 'paid') || (attributes.paid_at ? attributes.payments[0] : null) || {} : {}
    const paymentId = payment.id || null
    const paymentAmount = Number(payment.attributes?.amount || 0) / 100
    const paidAtValue = payment.attributes?.paid_at || attributes.paid_at || 0
    const paidAtNumeric = Number(paidAtValue)
    const paidAtParsed = Number.isFinite(paidAtNumeric) && paidAtNumeric > 0
      ? (paidAtNumeric < 1e12 ? paidAtNumeric * 1000 : paidAtNumeric)
      : Date.parse(String(paidAtValue || ''))
    const paymentPaidAt = Number.isFinite(paidAtParsed) && paidAtParsed > 0 ? paidAtParsed : 0
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return res.status(409).json({ success: false, error: 'The provider has not confirmed a valid payment amount.' })
    const result = await firestore.runTransaction(async (tx) => {
      const freshSnap = await tx.get(appointmentRef)
      const fresh = freshSnap.exists ? freshSnap.data() || {} : null
      assertWorkflow(fresh, 'Appointment not found.', 404)
      const sessions = fresh.recordedPaymentSessions || []
      if (sessions.includes(checkoutSessionId) || fresh.paymongoCheckoutSessionId === checkoutSessionId) return { status: fresh.status, amountPaid: fresh.amountPaid, alreadyRecorded: true }
      assertWorkflow(fresh.sameDayTreatmentStatus !== 'pending_clinical_clearance', 'The practitioner must clear same-day treatment after the consultation before payment is available.', 409)
      assertWorkflow(fresh.approvalStatus === 'Approved' && ['awaiting payment', 'approved', 'payment pending', 'balance due'].includes(normalized(fresh.status)), 'This booking cannot receive payment at this stage.')
      assertWorkflow(normalized(fresh.paymentHoldStatus) !== 'released', 'The payment window expired and the appointment slot was released. Please choose a new time.', 409)
      const holdExpiresAt = timestampMillis(fresh.paymentHoldExpiresAt)
      assertWorkflow(!holdExpiresAt || (paymentPaidAt > 0 && paymentPaidAt <= holdExpiresAt), 'The payment window expired before PayMongo confirmed payment. Please contact the clinic for help.', 409)
      assertWorkflow(!fresh.activePaymongoCheckoutSessionId || fresh.activePaymongoCheckoutSessionId === checkoutSessionId, 'This checkout session is no longer active for the appointment.', 409)
      assertWorkflow(Math.round(paymentAmount * 100) === paymentDue(fresh), 'Verified payment does not match the amount due.')
      const amountPaid = Math.round((Number(fresh.amountPaid || 0) + paymentAmount) * 100) / 100
      const totalAmount = Number(fresh.totalAmount || fresh.amount || 0)
      const fullyPaid = amountPaid >= totalAmount
      const next = { ...fresh, amountPaid }
      const status = afterPaymentStatus(next)
      const canIssueServiceKey = !fresh.isBookingOrderParent
        && !fresh.isGroupParent
        && normalized(fresh.contract?.status) === 'signed'
        && initialPaymentReceived(next)
      const serviceKey = fresh.serviceKey || (canIssueServiceKey ? String(crypto.randomInt(100000, 1000000)) : null)
      const serviceKeyIssued = !fresh.serviceKey && Boolean(serviceKey)
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      const branchSnap = await tx.get(firestore.collection('clinics').doc(String(fresh.branchId || '')))
      const branch = branchSnap.exists ? branchSnap.data() || {} : {}
      const clinicRecipients = await prepareClinicBookingRecipients({ tx, db: firestore, branchId: fresh.branchId, branch, loadUserContext })
      let groupRef = null
      let childIds = []
      if (fresh.isGroupParent && fresh.groupBookingId) {
        groupRef = firestore.collection('groupBookings').doc(String(fresh.groupBookingId))
        childIds = (await tx.get(groupRef)).data()?.recipientAppointmentIds || []
      } else if (fresh.isBookingOrderParent) childIds = fresh.appointmentIds || []
      const paidChildren = []
      for (const id of childIds) {
        const ref = firestore.collection('appointments').doc(String(id)), snap = await tx.get(ref)
        assertWorkflow(snap.exists, 'An individual appointment is missing.')
        paidChildren.push({ ref, data: snap.data() })
      }
      if (fresh.isBookingOrderParent) {
        assertWorkflow(bookingOrderReadyForPayment(fresh, paidChildren.map(({ ref, data }) => ({ id: ref.id, ...data }))), 'Every appointment in this order must be approved and have a signed agreement before payment.')
      }
      const sameDayTreatmentRef = fresh.sameDayTreatmentAppointmentId
        ? firestore.collection('appointments').doc(String(fresh.sameDayTreatmentAppointmentId))
        : null
      const sameDayTreatmentSnap = sameDayTreatmentRef ? await tx.get(sameDayTreatmentRef) : null
      const referenceNumber = String(attributes.reference_number || metadata.referenceNumber || '').trim()
      const paidTimestamp = paymentPaidAt > 0 ? admin.firestore.Timestamp.fromMillis(paymentPaidAt) : timestamp
      tx.set(firestore.collection('transactions').doc('booking-' + checkoutSessionId), {
        branchId: fresh.branchId,
        customerId: fresh.customerId,
        appointmentId,
        checkoutSessionId,
        transactionCode: checkoutSessionId,
        referenceNumber: referenceNumber || '',
        paymentId,
        type: 'service_payment',
        service: fresh.service || 'Service booking',
        amount: paymentAmount,
        total: paymentAmount,
        invoiceTotal: totalAmount,
        pricingSnapshot: fresh.pricingSnapshot || null,
        method: payment.attributes?.source?.type || payment.attributes?.payment_method?.type || 'Online',
        status: 'Paid',
        receiptEmailStatus: 'pending',
        paidAt: paidTimestamp,
        createdAt: timestamp,
      })
      tx.update(appointmentRef, {
        status, amountPaid, balance: Math.max(0, totalAmount - amountPaid),
        paymentStatus: fullyPaid ? 'Paid' : 'Partially Paid', paymentCoverage: fullyPaid ? 'full' : 'installment',
        recordedPaymentSessions: [...sessions, checkoutSessionId], paymongoCheckoutSessionId: checkoutSessionId,
        activePaymongoCheckoutSessionId: '', paymentHoldStatus: 'confirmed',
        paymentHoldDeadlineAt: fresh.paymentHoldExpiresAt || null, paymentHoldExpiresAt: null,
        paymongoPaymentId: paymentId, paymongoPaidAt: paidTimestamp, updatedAt: timestamp,
        ...(serviceKey ? { serviceKey } : {}),
        ...(status === 'Completed' ? { completedAt: timestamp } : {}),
      })
      if (sameDayTreatmentRef && sameDayTreatmentSnap?.exists) tx.update(sameDayTreatmentRef, {
        paymentHoldStatus: 'awaiting_clinical_clearance', paymentHoldExpiresAt: null, updatedAt: timestamp,
      })
      if (paidChildren.length) {
        for (const { ref: childRef, data: child } of paidChildren) {
          const childTotal = Number(child.totalAmount || child.amount || 0)
          const childStatus = normalized(child.contract?.status) === 'signed' ? afterPaymentStatus({ ...child, amountPaid: childTotal }) : 'Contract Pending'
          tx.update(childRef, { amountPaid: childTotal, balance: 0, paymentStatus: 'Paid', paymentCoverage: 'group', status: childStatus, approvalStatus: 'Approved', paymentHoldStatus: 'confirmed', activePaymongoCheckoutSessionId: '', paymentHoldDeadlineAt: child.paymentHoldExpiresAt || null, paymentHoldExpiresAt: null, paymongoCheckoutSessionId: checkoutSessionId, paymongoPaymentId: paymentId, paymongoPaidAt: timestamp, updatedAt: timestamp })
        }
        if (groupRef) tx.set(groupRef, { paymentStatus: 'Paid', paymongoCheckoutSessionId: checkoutSessionId, paymongoPaymentId: paymentId, paidAt: timestamp, status: 'Paid', updatedAt: timestamp }, { merge: true })
      }
      if (fresh.bookingId) tx.set(firestore.collection('bookings').doc(fresh.bookingId), { status, amountPaid, paymentHoldStatus: 'confirmed', activePaymongoCheckoutSessionId: '', paymentHoldDeadlineAt: fresh.paymentHoldExpiresAt || null, paymentHoldExpiresAt: null, updatedAt: timestamp }, { merge: true })
      tx.set(firestore.collection('notifications').doc(), { recipientUserId: fresh.customerId, title: 'Payment received and receipt ready', message: `Your payment of PHP ${paymentAmount.toFixed(2)} was verified. Download the PDF receipt from Appointment History in My Appointments.`, link: '/customer/appointments?tab=history', read: false, deleted: false, createdAt: timestamp })
      writeClinicAppointmentPaidNotifications({ tx, db: firestore, recipients: clinicRecipients, branchId: fresh.branchId, appointmentId, bookingId: fresh.bookingId, customerName: fresh.customerName, serviceName: fresh.service || 'Appointment', appointmentDate: fresh.date, appointmentTime: fresh.time, createdAt: timestamp })
      return { appointmentId, status, amountPaid, paymentCoverage: fullyPaid ? 'full' : 'installment', serviceKey, serviceKeyIssued }
    })
    const updatedSnap = await appointmentRef.get()
    const updatedAppointment = updatedSnap.data() || appointment
    const serviceKey = result.serviceKey || updatedAppointment.serviceKey || null
    if (result.serviceKeyIssued && serviceKey) {
      await sendServiceCode({ email: updatedAppointment.customerEmail, serviceKey, date: updatedAppointment.date, time: updatedAppointment.time })
        .catch(error => console.warn('Could not email the verified appointment service code:', error?.message || error))
    }
    const clinicSnap = updatedAppointment.branchId ? await firestore.collection('clinics').doc(String(updatedAppointment.branchId)).get() : null
    let emailResult = { sent: false }
    try {
      emailResult = await emailAppointmentPaymentReceipt({
        db: firestore,
        transactionId: `booking-${checkoutSessionId}`,
        appointment: updatedAppointment,
        clinicName: clinicSnap?.data()?.name || '',
        senderEmail,
        sendEmail: postmarkClient?.sendEmail.bind(postmarkClient),
      })
    } catch (error) { console.warn('Could not send appointment receipt email:', error?.message || error) }
    return res.json({ success: true, data: { ...result, serviceKey, receiptEmailSent: emailResult.sent } })
  } catch (error) {
    console.error('appointments/record-payment error:', error)
    return res.status(error.status || 500).json({ success: false, error: error?.message || 'Failed to record appointment payment' })
  }
}
app.post('/appointments/:id/record-payment', requireAuth, recordAppointmentPayment)
app.get('/appointments/:id/payment-receipt', requireAuth, async (req, res) => {
  const appointmentId = String(req.params.id || '').trim()
  if (!appointmentId) return res.status(400).json({ success: false, error: 'Appointment ID is required.' })
  try {
    const firestore = admin.firestore()
    const appointmentSnap = await firestore.collection('appointments').doc(appointmentId).get()
    if (!appointmentSnap.exists) return res.status(404).json({ success: false, error: 'Appointment not found.' })
    const appointment = appointmentSnap.data() || {}
    if (String(appointment.customerId || '').trim() !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' })

    // Customer clients cannot read the clinic transaction collection directly.
    // Query only this appointment's records on the server, then return a small
    // receipt-safe projection to the verified owner of the appointment.
    const transactions = await firestore.collection('transactions').where('appointmentId', '==', appointmentId).get()
    const toIso = value => {
      if (value?.toDate) return value.toDate().toISOString()
      if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
      const date = value ? new Date(value) : null
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
    }
    const payments = transactions.docs
      .map(snapshot => ({ id: snapshot.id, ...(snapshot.data() || {}) }))
      .filter(transaction => (!String(transaction.customerId || transaction.clientId || '') || String(transaction.customerId || transaction.clientId || '') === req.user.uid)
        && ['service_payment', 'appointment_payment'].includes(String(transaction.type || ''))
        && Number(transaction.amount || 0) > 0)
      .map(transaction => ({
        id: transaction.id,
        transactionCode: String(transaction.transactionCode || transaction.referenceNumber || transaction.checkoutSessionId || transaction.id),
        referenceNumber: String(transaction.referenceNumber || ''),
        checkoutSessionId: String(transaction.checkoutSessionId || ''),
        paymentId: String(transaction.paymentId || ''),
        amount: Number(transaction.amount || 0),
        method: String(transaction.method || 'Online payment'),
        status: String(transaction.status || 'Paid'),
        receiptEmailStatus: String(transaction.receiptEmailStatus || 'unknown'),
        receiptEmailSentAt: toIso(transaction.receiptEmailSentAt),
        paidAt: toIso(transaction.paidAt || transaction.createdAt || appointment.paymongoPaidAt),
        paidAtSource: transaction.paidAt ? 'provider' : (transaction.createdAt || appointment.paymongoPaidAt ? 'recorded' : 'unknown'),
      }))
      .sort((left, right) => String(right.paidAt || '').localeCompare(String(left.paidAt || '')))

    return res.json({ success: true, data: { appointmentId, payments } })
  } catch (error) {
    console.error('appointments/payment-receipt error:', error)
    return res.status(500).json({ success: false, error: 'Payment records could not be loaded.' })
  }
})
const appointmentPaymentHoldExpiry = createAppointmentPaymentHoldReaper({
  app,
  admin,
  getPayMongoHeaders: buildPayMongoHeaders,
  recordPayment: recordAppointmentPayment,
  getCronSecret: () => process.env.CRON_SECRET || '',
})
runAppointmentPaymentHoldSweep = () => appointmentPaymentHoldExpiry.expireDueHolds()
registerAppointmentPaymentWebhook(app, {
  admin, recordPayment: recordAppointmentPayment,
  handlePayMongoRefund: refundWorkflow.handlePayMongoRefund,
  getSecret: () => process.env.PAYMONGO_WEBHOOK_SECRET || '',
  getMode: () => payMongoSecretKey.startsWith('sk_live_') ? 'live' : payMongoSecretKey.startsWith('sk_test_') ? 'test' : '',
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
    let paymentRecordId = null

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
            const paidAt = subscriptionDate(attributes?.paid_at) || new Date()
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

      const firestore = admin.firestore()
      const paymentRecordRef = firestore.collection('planPayments').doc(`paymongo-${checkoutSessionId}`)
      paymentRecordId = paymentRecordRef.id
      await paymentRecordRef.set({
        ownerUid: String(metadata?.ownerUid || req.user?.uid || '').trim(),
        planId: String(metadata?.planId || '').trim().toLowerCase(),
        planName: String(metadata?.planName || metadata?.planId || 'Subscription').trim(),
        amount: Number(attributes?.line_items?.[0]?.amount || 0) / 100,
        currency: 'PHP',
        billingCycle: String(metadata?.billingCycle || 'month').trim() || 'month',
        payerFirstName: String(metadata?.payerFirstName || '').trim(),
        payerLastName: String(metadata?.payerLastName || '').trim(),
        payerName: `${String(metadata?.payerFirstName || '').trim()} ${String(metadata?.payerLastName || '').trim()}`.trim(),
        payerEmail: String(metadata?.payerEmail || metadata?.email || '').trim().toLowerCase(),
        paymentMethod: String(attributes?.payments?.[0]?.attributes?.payment_method?.type || attributes?.payments?.[0]?.attributes?.source?.type || '').trim(),
        referenceNumber: String(attributes?.reference_number || metadata?.referenceNumber || '').trim(),
        paymongoCheckoutSessionId: checkoutSessionId,
        paymongoStatus: attributes?.status || null,
        paymongoPaidAt: attributes?.paid_at || null,
        paymongoPaymentId: attributes?.payments?.[0]?.id || null,
        status: 'Paid',
        source: 'paymongo_checkout',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
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
        paymentRecordId,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unexpected PayMongo error',
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
    origin: req.get('origin') || null,
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
  })
})

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`OTP backend running on http://localhost:${PORT}`)
    void recoverClinicVerificationJobs()
    const clinicVerificationRecoveryTimer = setInterval(() => {
      void recoverClinicVerificationJobs()
    }, 60_000)
    clinicVerificationRecoveryTimer.unref?.()
  })
}

export { admin, runClientContactBackfill }
export default app
