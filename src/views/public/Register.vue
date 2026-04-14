<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, db, storage } from '@/config/firebaseConfig'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import Modal from '@/components/common/Modal.vue'
import Terms from '@/components/common/Terms.vue'
import PrivacyPolicy from '@/components/common/PrivacyPolicy.vue'
import RegisterCustomer from '@/views/public/RegisterCustomer.vue'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import axios from 'axios'

const router = useRouter()
const route = useRoute()
const legacyClinicRoute = computed(() => {
  const name = String(route.name || '')
  const path = String(route.path || '').toLowerCase()
  return name === 'register-clinic' || name === 'register-clinic-step' || path.startsWith('/clinic/register')
})

const selectedAccount = computed(() => {
  const queryAccount = String(route.query.account || '').trim().toLowerCase()
  if (legacyClinicRoute.value) return 'clinic'
  if (queryAccount === 'clinic' || queryAccount === 'clinic-admin' || queryAccount === 'admin') return 'clinic'
  if (queryAccount === 'customer') return 'customer'
  return ''
})

const isClinicRegistrationActive = computed(() => selectedAccount.value === 'clinic')

const chooseCustomer = async () => {
  await router.replace({
    name: 'register',
    query: { account: 'customer' },
  })
}

const chooseClinic = async () => {
  await router.replace({
    name: 'register',
    query: {
      ...route.query,
      account: 'clinic',
    },
  })
}

const goToHome = async () => {
  await router.push({ name: 'home' })
}

const goToRegisterChooser = async () => {
  await router.push({ name: 'register' })
}

const firstName = ref('')
const lastName = ref('')
const birthDate = ref('')
const manualBirthDate = ref('')
const birthDateError = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const resumeInProgress = ref(false)
const resumeCancelled = ref(false)
const REGISTRATION_DRAFT_KEY = 'register_clinic_draft'
const OTP_SENT_AT_KEY = 'register_clinic_otp_sent_at'
const REGISTRATION_UID_KEY = 'register_clinic_uid'
const REGISTRATION_OTP_EMAIL_KEY = 'register_clinic_otp_email'

const contactNumber = ref('')
const clinicName = ref('')
const clinicLocation = ref('')
const clinicLocationLat = ref('')
const clinicLocationLng = ref('')
const clinicLocationAddress = ref('')
const clinicBarangay = ref('')
const clinicProvince = ref('')
const clinicPostalCode = ref('')
const authorizedRepPosition = ref('')
const authorizedRepPositionOption = ref('')
const authorizedRepPositionOther = ref('')
const companyType = ref('')
const companyTypes = ['Corporation', 'Partnership', 'Cooperative', 'LLC', 'Other']
const authorizedRepPositionOptions = [
  'Owner',
  'President',
  'General Manager',
  'HR Manager',
  'Operations Manager',
  'Authorized Representative',
  'Other',
]
const caviteLocations = [
  'Bacoor',
  'Cavite City',
  'Dasmariñas City',
  'General Trias',
  'Imus',
  'Tagaytay',
  'Trece Martires',
  'Alfonso',
  'Amadeo',
  'Carmona',
  'General Emilio Aguinaldo',
  'General Mariano Alvarez',
  'Indang',
  'Kawit',
  'Magallanes',
  'Maragondon',
  'Mendez',
  'Naic',
  'Noveleta',
  'Rosario',
  'Silang',
  'Tanza',
  'Ternate',
]
const normalizeLocationName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^city of\s+/, '')
  .replace(/\s+city$/, '')
  .replace(/\s+municipality$/, '')
  .replace(/\s+province$/, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
const caviteLocationSet = new Set(caviteLocations.map(normalizeLocationName))
const caviteBounds = {
  north: 14.459,
  south: 13.709,
  east: 121.199,
  west: 120.626
}
const defaultCaviteCenter = { lat: 14.3294, lng: 120.9367 }

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 32
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/

const isSubmitting = ref(false)
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const passwordFocused = ref(false)
const confirmPasswordFocused = ref(false)
const showTerms = ref(false)
const showPrivacy = ref(false)
const termsAccepted = ref(false)
const emailChecked = ref(false)
const isCheckingEmail = ref(false)
const otpVerifiedForRegistration = ref(false)
const pendingApprovalMode = ref(false)

const otpDigits = ref(Array(6).fill(''))
const userUid = ref('')
const otpRecipientEmail = ref('')
const otpInputRefs = ref([])
const otpResendCountdown = ref(0)
const OTP_LENGTH = 6
const OTP_COOLDOWN_SECONDS = 60 // 1 minute resend cooldown
let otpResendInterval = null

const currentStep = ref(1)
const registrationSteps = [
  'Personal Info & Clinic Info',
  'OTP Verification',
  'Document Upload',
  'Waiting for Approval',
]

const secCertificateFile = ref(null)
const articlesOfIncorporationFile = ref(null)
const businessPermitFile = ref(null)
const governmentIdRepresentativeFrontFile = ref(null)
const governmentIdRepresentativeBackFile = ref(null)
const dohAccreditationFile = ref(null)
const fdaApprovalFile = ref(null)
const prcIdMedicalDirectorFile = ref(null)
const existingSubmittedDocuments = ref({
  secCertificate: null,
  articlesOfIncorporation: null,
  businessPermit: null,
  governmentIdRepresentativeFront: null,
  governmentIdRepresentativeBack: null,
  dohAccreditation: null,
  fdaApproval: null,
  prcIdMedicalDirector: null,
})
const documentPreviewUrls = ref({
  secCertificate: '',
  articlesOfIncorporation: '',
  businessPermit: '',
  governmentIdRepresentativeFront: '',
  governmentIdRepresentativeBack: '',
  dohAccreditation: '',
  fdaApproval: '',
  prcIdMedicalDirector: '',
})
const isSubmittingDocuments = ref(false)
const documentUploadState = ref({
  secCertificate: { uploading: false, progress: 0, error: '' },
  articlesOfIncorporation: { uploading: false, progress: 0, error: '' },
  businessPermit: { uploading: false, progress: 0, error: '' },
  governmentIdRepresentativeFront: { uploading: false, progress: 0, error: '' },
  governmentIdRepresentativeBack: { uploading: false, progress: 0, error: '' },
  dohAccreditation: { uploading: false, progress: 0, error: '' },
  fdaApproval: { uploading: false, progress: 0, error: '' },
  prcIdMedicalDirector: { uploading: false, progress: 0, error: '' },
})
const documentFileMap = {
  secCertificate: secCertificateFile,
  articlesOfIncorporation: articlesOfIncorporationFile,
  businessPermit: businessPermitFile,
  governmentIdRepresentativeFront: governmentIdRepresentativeFrontFile,
  governmentIdRepresentativeBack: governmentIdRepresentativeBackFile,
  dohAccreditation: dohAccreditationFile,
  fdaApproval: fdaApprovalFile,
  prcIdMedicalDirector: prcIdMedicalDirectorFile,
}
const documentLabelMap = {
  secCertificate: 'SEC Certificate of Registration',
  articlesOfIncorporation: 'Articles of Incorporation/Partnership Agreement',
  businessPermit: 'Business Permit/Registration',
  governmentIdRepresentativeFront: 'Government-Issued ID of Registrant (Front)',
  governmentIdRepresentativeBack: 'Government-Issued ID of Registrant (Back)',
  dohAccreditation: 'DOH Accreditation',
  fdaApproval: 'FDA Approval',
  prcIdMedicalDirector: 'PRC ID of Medical Director',
}
const documentInputKeys = ref({
  secCertificate: 0,
  articlesOfIncorporation: 0,
  businessPermit: 0,
  governmentIdRepresentativeFront: 0,
  governmentIdRepresentativeBack: 0,
  dohAccreditation: 0,
  fdaApproval: 0,
  prcIdMedicalDirector: 0,
})
const approvalRedirecting = ref(false)
const approvalReviewState = ref('pending')
const approvalReviewMessage = ref('Your registration is under review. Please allow at least 24 hours for admin review.')
const approvalReviewReason = ref('')
const approvalUserExists = ref(false)
const approvalClinicExists = ref(false)
const approvalUserStatus = ref('')
const approvalClinicStatus = ref('')
let unsubscribeApprovalUser = null
let unsubscribeApprovalClinic = null

const togglePassword = () => passwordVisible.value = !passwordVisible.value
const toggleConfirmPassword = () => confirmPasswordVisible.value = !confirmPasswordVisible.value

const calendarOpen = ref(false)
const calendarMonth = ref(new Date().getMonth())
const calendarYear = ref(new Date().getFullYear())
const calendarRef = ref(null)
const monthMenuOpen = ref(false)
const yearMenuOpen = ref(false)
const showLocationModal = ref(false)
const locationSearchQuery = ref('')
const locationMapCanvas = ref(null)
const locationError = ref('')
let mapsReady = false
let locationAutocomplete = null
let locationMap = null
let locationMarker = null
let registrationDraftSaveTimer = null
let lastSavedRegistrationDraft = ''

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years = []
  for (let year = currentYear; year >= currentYear - 100; year--) {
    years.push(year)
  }
  return years
})

const passwordChecks = computed(() => {
  const value = password.value || ''
  return {
    length: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: /[@$!%*?&]/.test(value),
  }
})

const confirmPasswordMatches = computed(() => {
  if (!confirmPassword.value) return false
  return password.value === confirmPassword.value
})

const showPasswordRequirements = computed(() => passwordFocused.value || confirmPasswordFocused.value)
const otpCode = computed(() => otpDigits.value.join(''))
const otpCanResend = computed(() => otpResendCountdown.value === 0)
const otpCountdownLabel = computed(() => {
  const minutes = Math.floor(otpResendCountdown.value / 60)
  const seconds = otpResendCountdown.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const currentStepTitle = computed(() => registrationSteps[currentStep.value - 1] || registrationSteps[0])
const requiresPasswordForStep1 = computed(() => !(userUid.value && otpVerifiedForRegistration.value))
const companyDocumentKeys = [
  'businessPermit',
  'governmentIdRepresentativeFront',
  'governmentIdRepresentativeBack',
  'dohAccreditation',
  'fdaApproval',
  'prcIdMedicalDirector',
]
const requiredDocumentKeys = computed(() => companyDocumentKeys)
const acceptedGovernmentIdOptions = [
  'National ID (PhilSys)',
  "Driver's License",
  'Passport',
  'SSS ID',
  'PhilHealth ID',
  'UMID',
  'Postal ID',
  "Voter's ID",
  'PRC ID',
]
const acceptedGovernmentIdColumns = computed(() => [
  acceptedGovernmentIdOptions.slice(0, 5),
  acceptedGovernmentIdOptions.slice(5),
])
const documentKeysExcludingGovId = computed(() =>
  requiredDocumentKeys.value.filter(
    (key) => key !== 'governmentIdRepresentativeFront' && key !== 'governmentIdRepresentativeBack'
  )
)
const allDocumentsUploaded = computed(() =>
  requiredDocumentKeys.value.every((key) => Boolean(existingSubmittedDocuments.value[key] || documentFileMap[key]?.value))
)

const resolveAuthorizedRepPosition = () => {
  if (authorizedRepPositionOption.value === 'Other') {
    return String(authorizedRepPositionOther.value || '').trim()
  }
  return String(authorizedRepPositionOption.value || '').trim()
}

const syncAuthorizedRepPositionOption = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    authorizedRepPositionOption.value = ''
    authorizedRepPositionOther.value = ''
    return
  }
  const match = authorizedRepPositionOptions.find(
    (option) => option.toLowerCase() === raw.toLowerCase()
  )
  if (match && match !== 'Other') {
    authorizedRepPositionOption.value = match
    authorizedRepPositionOther.value = ''
    return
  }
  authorizedRepPositionOption.value = 'Other'
  authorizedRepPositionOther.value = raw
}

const pad = (value) => String(value).padStart(2, '0')

const toIsoDate = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const isFutureIsoDate = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number)
  if (!year || !month || !day) return false
  const candidate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  candidate.setHours(0, 0, 0, 0)
  return candidate.getTime() > today.getTime()
}
const formatIsoToBirthInput = (isoDate) => {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return ''
  return `${month}/${day}/${year}`
}
const normalizeBirthInput = (rawValue) => {
  const digits = String(rawValue || '').replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''

  let monthDigits = digits.slice(0, 2)
  let dayDigits = digits.slice(2, 4)
  let yearDigits = digits.slice(4, 8)

  let monthValue = null
  if (monthDigits.length === 2) {
    monthValue = clamp(Number(monthDigits) || 1, 1, 12)
    monthDigits = pad(monthValue)
  }

  if (dayDigits.length === 2) {
    let maxDay = 31
    if (monthValue !== null) {
      if (monthValue === 2) maxDay = 29
      else if ([4, 6, 9, 11].includes(monthValue)) maxDay = 30
    }
    const dayValue = clamp(Number(dayDigits) || 1, 1, maxDay)
    dayDigits = pad(dayValue)
  }

  if (yearDigits.length === 4) {
    const yearValue = clamp(Number(yearDigits) || currentYear, currentYear - 100, currentYear)
    yearDigits = String(yearValue)
    if (monthValue !== null && dayDigits.length === 2) {
      const exactMaxDay = new Date(yearValue, monthValue, 0).getDate()
      const dayValue = clamp(Number(dayDigits) || 1, 1, exactMaxDay)
      dayDigits = pad(dayValue)
    }
  }

  if (digits.length <= 2) return monthDigits
  if (digits.length <= 4) return `${monthDigits}/${dayDigits}`
  return `${monthDigits}/${dayDigits}/${yearDigits}`
}
const parseBirthInputToIso = (formattedValue) => {
  const match = String(formattedValue || '').match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/)
  if (!match) return null

  const month = Number(match[1])
  const day = Number(match[2])
  let year = Number(match[3])
  if (match[3].length === 2) {
    const yearNow = new Date().getFullYear()
    const currentTwoDigits = yearNow % 100
    year = year <= currentTwoDigits ? 2000 + year : 1900 + year
  }

  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) return null
  if (month < 1 || month > 12) return null
  if (year < currentYear - 100 || year > currentYear) return null

  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null

  const iso = `${year}-${pad(month)}-${pad(day)}`
  if (isFutureIsoDate(iso)) return null
  return iso
}
const syncManualBirthDate = () => {
  manualBirthDate.value = formatIsoToBirthInput(birthDate.value)
}
const handleManualBirthInput = (event) => {
  const formatted = normalizeBirthInput(event.target.value)
  manualBirthDate.value = formatted
  birthDateError.value = ''

  if (formatted.length === 10) {
    const parsed = parseBirthInputToIso(formatted)
    if (parsed) {
      birthDate.value = parsed
      syncCalendarToBirthDate()
      return
    }
  }
  birthDate.value = ''
}
const handleManualBirthBlur = () => {
  if (!manualBirthDate.value) {
    birthDate.value = ''
    birthDateError.value = ''
    return
  }

  if (manualBirthDate.value.length !== 10) {
    birthDate.value = ''
    birthDateError.value = 'Please complete the date as MM/DD/YYYY.'
    return
  }

  const parsed = parseBirthInputToIso(manualBirthDate.value)
  if (!parsed) {
    birthDate.value = ''
    birthDateError.value = 'Please use a valid date (MM/DD/YYYY) and avoid future dates.'
    return
  }

  birthDate.value = parsed
  manualBirthDate.value = formatIsoToBirthInput(parsed)
  birthDateError.value = ''
  syncCalendarToBirthDate()
}

const calendarLabelActive = computed(() => calendarOpen.value || !!manualBirthDate.value)
const selectedMonthLabel = computed(() => monthNames[calendarMonth.value])
const selectedClinicLocationLabel = computed(() => clinicLocation.value || 'Select city/municipality')
const clinicFullAddressLabel = computed(() => clinicLocationAddress.value || '')
const modalPinnedAddressLabel = computed(() => clinicLocationAddress.value || 'Pin a location inside Cavite to preview the resolved address.')
const isOutsideCaviteLocationError = computed(() => /outside cavite|within cavite/i.test(locationError.value))
const locationErrorTitle = computed(() => isOutsideCaviteLocationError.value ? 'Location Outside Cavite' : 'Map Selection Issue')
const locationErrorHint = computed(() => (
  isOutsideCaviteLocationError.value
    ? 'Choose a pin within Cavite to continue clinic registration.'
    : 'Adjust the pin or try selecting a nearby location again.'
))

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(calendarYear.value, calendarMonth.value, 1).getDay()
  const daysInCurrentMonth = getDaysInMonth(calendarYear.value, calendarMonth.value)
  const prevMonth = calendarMonth.value === 0 ? 11 : calendarMonth.value - 1
  const prevYear = calendarMonth.value === 0 ? calendarYear.value - 1 : calendarYear.value
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth)

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      inCurrentMonth: false,
      iso: toIsoDate(prevYear, prevMonth, daysInPrevMonth - i),
    })
  }

  for (let day = 1; day <= daysInCurrentMonth; day++) {
    days.push({
      day,
      month: calendarMonth.value,
      year: calendarYear.value,
      inCurrentMonth: true,
      iso: toIsoDate(calendarYear.value, calendarMonth.value, day),
    })
  }

  const nextMonth = calendarMonth.value === 11 ? 0 : calendarMonth.value + 1
  const nextYear = calendarMonth.value === 11 ? calendarYear.value + 1 : calendarYear.value
  let nextDay = 1
  while (days.length < 42) {
    days.push({
      day: nextDay,
      month: nextMonth,
      year: nextYear,
      inCurrentMonth: false,
      iso: toIsoDate(nextYear, nextMonth, nextDay),
    })
    nextDay++
  }

  return days
})

const syncCalendarToBirthDate = () => {
  if (!birthDate.value) return
  const [year, month] = birthDate.value.split('-').map(Number)
  if (!year || !month) return
  calendarYear.value = year
  calendarMonth.value = month - 1
}

const toggleCalendar = () => {
  if (!calendarOpen.value) syncCalendarToBirthDate()
  monthMenuOpen.value = false
  yearMenuOpen.value = false
  calendarOpen.value = !calendarOpen.value
}

const closeCalendar = () => {
  calendarOpen.value = false
  monthMenuOpen.value = false
  yearMenuOpen.value = false
}

const toggleMonthMenu = () => {
  monthMenuOpen.value = !monthMenuOpen.value
  yearMenuOpen.value = false
}

const toggleYearMenu = () => {
  yearMenuOpen.value = !yearMenuOpen.value
  monthMenuOpen.value = false
}

const selectMonth = (monthIndex) => {
  calendarMonth.value = monthIndex
  monthMenuOpen.value = false
}

const selectYear = (year) => {
  calendarYear.value = year
  yearMenuOpen.value = false
}

const previousMonth = () => {
  if (calendarMonth.value === 0) {
    calendarMonth.value = 11
    calendarYear.value -= 1
    return
  }
  calendarMonth.value -= 1
}

const nextMonth = () => {
  if (calendarMonth.value === 11) {
    calendarMonth.value = 0
    calendarYear.value += 1
    return
  }
  calendarMonth.value += 1
}

const selectDate = (dayObj) => {
  if (isFutureIsoDate(dayObj?.iso)) return
  birthDate.value = dayObj.iso
  syncManualBirthDate()
  birthDateError.value = ''
  closeCalendar()
}

const isSelectedDate = (dayObj) => birthDate.value === dayObj.iso

const isToday = (dayObj) => {
  const today = new Date()
  return dayObj.iso === toIsoDate(today.getFullYear(), today.getMonth(), today.getDate())
}
const isFutureDate = (dayObj) => isFutureIsoDate(dayObj?.iso)

const onWindowClick = (event) => {
  if (calendarOpen.value && calendarRef.value && !calendarRef.value.contains(event.target)) {
    closeCalendar()
  }

  if (showLocationModal.value && locationError.value) {
    locationError.value = ''
  }
}

onMounted(async () => {
    if (!isClinicRegistrationActive.value) return
    const immediateStep = parseStepParam(route.params?.step)
    if (immediateStep && immediateStep > 1) {
      currentStep.value = immediateStep
      syncStepRoute(immediateStep)
    }
    const qFirstName = String(route.query.firstName || '').trim()
    const qLastName = String(route.query.lastName || '').trim()
    const qEmail = String(route.query.email || '').trim()
    const qResume = String(route.query.resume || '').trim()

    const stepParam = parseStepParam(route.params?.step)
    if (stepParam) {
      currentStep.value = stepParam
    }

  if (qFirstName && !firstName.value) firstName.value = qFirstName
  if (qLastName && !lastName.value) lastName.value = qLastName
  const resumeEmail = qResume ? (qEmail || sessionStorage.getItem('resume_email') || '') : (qEmail || '')
  if (resumeEmail && !email.value) email.value = String(resumeEmail).toLowerCase()

    syncManualBirthDate()
    window.addEventListener('click', onWindowClick)

    if (stepParam) {
      if (resumeEmail) {
        const profileResult = await fetchRegistrationProfile(resumeEmail)
        if (profileResult?.profile) {
          applyProfileData(profileResult.profile)
        }
        otpRecipientEmail.value = String(resumeEmail || '').trim().toLowerCase()
        setStoredOtpRecipientEmail(otpRecipientEmail.value)
        email.value = otpRecipientEmail.value || email.value
      }
      const storedUid = getStoredRegistrationUid()
      if (storedUid && !userUid.value) {
        userUid.value = storedUid
      }
      syncStepRoute(currentStep.value)
      return
    }

    if (qResume && resumeEmail) {
      resumeInProgress.value = true
      resumeCancelled.value = false
    const nextQuery = { ...route.query }
    delete nextQuery.email
    if (route.query.email) {
      await router.replace({ name: 'register-clinic', query: nextQuery })
    }
      const statusResult = await checkRegistrationStatus(resumeEmail)
      if (!statusResult || statusResult.exists !== true) {
        resumeInProgress.value = false
        toast.error('Unable to resume. Please verify your email again.')
        return
      }

      userUid.value = String(statusResult.uid || '').trim()
      if (userUid.value) {
        setStoredRegistrationUid(userUid.value)
      }
      email.value = String(resumeEmail).toLowerCase()
      emailChecked.value = true
    otpRecipientEmail.value = String(resumeEmail).toLowerCase()
    setStoredOtpRecipientEmail(otpRecipientEmail.value)

      const profileResult = await fetchRegistrationProfile(resumeEmail)
      if (profileResult?.profile) {
        applyProfileData(profileResult.profile)
      }
      const resolvedStep = inferResumeStep(statusResult, profileResult?.profile)

      if (resolvedStep === 'active') {
        toast.info('This account is already active. Please log in.')
        setTimeout(() => router.push('/login'), 800)
        resumeInProgress.value = false
        return
      }

            if (resolvedStep === 4 || statusResult.hasSubmittedDocs) {
              otpVerifiedForRegistration.value = true
              pendingApprovalMode.value = true
              currentStep.value = 4
            } else if (resolvedStep === 3) {
              otpVerifiedForRegistration.value = true
              pendingApprovalMode.value = false
              currentStep.value = 3
            } else if (resolvedStep === 2) {
              otpVerifiedForRegistration.value = false
              pendingApprovalMode.value = false
              currentStep.value = 2
              syncStepRoute(2)
            } else {
              otpVerifiedForRegistration.value = false
              pendingApprovalMode.value = false
              currentStep.value = 1
          }

    resumeInProgress.value = false
    } else if (qResume && !resumeEmail) {
      toast.error('Unable to resume. Please enter your email again.')
    }
    syncStepRoute(currentStep.value)
  })

onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick)
  stopOtpCountdown()
  stopApprovalCheck()
  if (registrationDraftSaveTimer) {
    clearTimeout(registrationDraftSaveTimer)
    registrationDraftSaveTimer = null
  }
  saveRegistrationDraft()
  Object.values(documentPreviewUrls.value).forEach((previewUrl) => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  })
})

const sanitizeContactNumber = () => {
  let digits = (contactNumber.value || '').replace(/\D/g, '')

  // If user pastes full PH format (e.g. +639...), strip country code.
  if (digits.startsWith('63')) {
    digits = digits.slice(2)
  }

  // Local part after +63 should not start with 0.
  digits = digits.replace(/^0+/, '')

  contactNumber.value = digits.slice(0, 10)
}

/*
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const res = await axios.post(`${OTP_API_BASE}/send-otp`, {
      recipient: toEmail,
      otp: otp,
    }, { timeout: 10000 })
    return Boolean(res?.data?.success)
  } catch (err) {
    console.error('Error sending OTP email:', err?.response?.data || err?.message || err)
    return false
  }
}
  */

const sendOtpEmail = async (toEmail) => {
  try {
    const res = await axios.post(
      `${OTP_API_BASE}/auth/request-registration-otp`,
      {
        email: String(toEmail || '').trim().toLowerCase(),
        uid: String(userUid.value || '').trim(),
      },
      { timeout: 20000 }
    )

    if (res?.data?.success) {
      console.log('Registration OTP sent successfully')
      return {
        success: true,
        error: '',
        recipient: String(res?.data?.recipient || toEmail || '').trim().toLowerCase(),
        retryAfterSeconds: Number(res?.data?.retryAfterSeconds || OTP_COOLDOWN_SECONDS),
      }
    }

    console.error('Error sending OTP:', res?.data?.error)
    return {
      success: false,
      error: res?.data?.error || 'OTP API returned an unsuccessful response.',
      recipient: String(toEmail || '').trim().toLowerCase(),
      retryAfterSeconds: Number(res?.data?.retryAfterSeconds || 0),
    }
  } catch (err) {
    const providerError =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Unexpected OTP send error'
    console.error('Error sending OTP email:', providerError)
    return {
      success: false,
      error: providerError,
      recipient: String(toEmail || '').trim().toLowerCase(),
      retryAfterSeconds: Number(err?.response?.data?.retryAfterSeconds || 0),
    }
  }
}

const handleClinicOtpResult = (otpResult, successMessage, failureMessage = 'Unable to send OTP') => {
  if (otpResult.success) {
    beginOtpCooldown()
    toast.info(successMessage)
    return true
  }

  if (otpResult.retryAfterSeconds > 0) {
    startOtpCountdown(otpResult.retryAfterSeconds)
    toast.info(otpResult.error || 'A recent OTP is still active. Please use the latest code in your email.')
    return true
  }

  stopOtpCountdown()
  toast.warning(`${failureMessage}: ${otpResult.error}`)
  return false
}

const maskEmailAddress = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return ''
  const [localPart, domain] = normalized.split('@')
  if (!localPart || !domain) return normalized
  const visiblePrefix = localPart.slice(0, 2)
  const hiddenLength = Math.max(localPart.length - visiblePrefix.length, 2)
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}@${domain}`
}

const otpRecipientLabel = computed(() =>
  maskEmailAddress(otpRecipientEmail.value || email.value)
)

const setOtpInputRef = (el, index) => {
  if (el) otpInputRefs.value[index] = el
}

const focusOtpInput = (index) => {
  if (index < 0 || index > OTP_LENGTH - 1) return
  nextTick(() => otpInputRefs.value[index]?.focus())
}

const clearOtpInputs = () => {
  otpDigits.value = Array(OTP_LENGTH).fill('')
}

const stopOtpCountdown = () => {
  if (otpResendInterval) {
    clearInterval(otpResendInterval)
    otpResendInterval = null
  }
}

const stopApprovalCheck = () => {
  if (unsubscribeApprovalUser) {
    unsubscribeApprovalUser()
    unsubscribeApprovalUser = null
  }
  if (unsubscribeApprovalClinic) {
    unsubscribeApprovalClinic()
    unsubscribeApprovalClinic = null
  }
}

const startApprovalCheck = () => {
  if (!userUid.value) return
  stopApprovalCheck()
  approvalReviewState.value = 'reviewing'
  approvalReviewMessage.value = 'Your registration is under review. Please allow at least 24 hours for admin review.'
  approvalReviewReason.value = ''

  unsubscribeApprovalUser = onSnapshot(
    doc(db, 'users', userUid.value),
    (snapshot) => {
      approvalUserExists.value = snapshot.exists()
      approvalUserStatus.value = snapshot.exists() ? String(snapshot.data()?.status || '') : ''
      updateApprovalReviewState()
    },
    (error) => {
      console.error('Failed to listen to user registration status:', error)
    }
  )

  unsubscribeApprovalClinic = onSnapshot(
    doc(db, 'clinics', userUid.value),
    (snapshot) => {
      approvalClinicExists.value = snapshot.exists()
      approvalClinicStatus.value = snapshot.exists() ? String(snapshot.data()?.approvalStatus || '') : ''
      if (snapshot.exists()) {
        approvalReviewReason.value = String(snapshot.data()?.rejectionReason || '')
      }
      updateApprovalReviewState()
    },
    (error) => {
      console.error('Failed to listen to clinic registration status:', error)
    }
  )
}

const startOtpCountdown = (seconds = OTP_COOLDOWN_SECONDS) => {
  stopOtpCountdown()
  otpResendCountdown.value = seconds
  otpResendInterval = setInterval(() => {
    if (otpResendCountdown.value <= 0) {
      stopOtpCountdown()
      return
    }
    otpResendCountdown.value -= 1
  }, 1000)
}

const handleDocumentFileChange = async (key, event) => {
  const selectedFile = event?.target?.files?.[0] || null
  if (documentFileMap[key]) {
    documentFileMap[key].value = selectedFile
  }

  if (selectedFile) {
    if (existingSubmittedDocuments.value[key]) {
      existingSubmittedDocuments.value[key] = null
    }
  }

  const previewKey = key
  const currentPreview = documentPreviewUrls.value[previewKey]
  if (currentPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPreview)
  documentPreviewUrls.value[previewKey] = selectedFile && selectedFile.type?.startsWith('image/')
    ? URL.createObjectURL(selectedFile)
    : ''

  if (!selectedFile) return
  if (!userUid.value) {
    toast.error('User ID not found. Please verify your email again.')
    return
  }

  const docKey = previewKey
  documentUploadState.value[docKey] = { uploading: true, progress: 0, error: '' }
  try {
    const uploadedDoc = await uploadDocumentForClinic(userUid.value, selectedFile, docKey, (progress) => {
      documentUploadState.value[docKey] = {
        ...documentUploadState.value[docKey],
        uploading: true,
        progress,
        error: '',
      }
    })
    if (!uploadedDoc) throw new Error('Upload failed')

    existingSubmittedDocuments.value[docKey] = uploadedDoc
    await updateDoc(doc(db, 'clinics', userUid.value), {
      [`draftDocuments.${docKey}`]: uploadedDoc,
      draftDocumentsUpdatedAt: serverTimestamp(),
    })
    documentUploadState.value[docKey] = { uploading: false, progress: 100, error: '' }
    toast.success('Document uploaded. You can safely leave and continue later.')
  } catch (err) {
    console.error(err)
    const errorMessage = err?.message || 'Failed to upload document. Please try again.'
    documentUploadState.value[docKey] = { uploading: false, progress: 0, error: errorMessage }
    toast.error(errorMessage)
  }
}

const syncExistingDocumentPreviews = () => {
  const docs = existingSubmittedDocuments.value
  Object.keys(documentPreviewUrls.value).forEach((key) => {
    const existingUrl = documentPreviewUrls.value[key]
    if (existingUrl?.startsWith('blob:')) URL.revokeObjectURL(existingUrl)
  })
  Object.keys(documentPreviewUrls.value).forEach((key) => {
    const docEntry = docs[key]
    documentPreviewUrls.value[key] = docEntry?.url && docEntry?.type?.startsWith('image/')
      ? docEntry.url
      : ''
  })
}

const isFullyApprovedFromStatus = (userStatus, clinicStatus) => {
  const normalizedUserStatus = String(userStatus || '').toLowerCase()
  const normalizedClinicStatus = String(clinicStatus || '').toLowerCase()
  return normalizedUserStatus === 'active' && normalizedClinicStatus.includes('approved')
}

const mapRegistrationStepFromStatus = (userStatus, clinicStatus) => {
  const normalizedUserStatus = String(userStatus || '').toLowerCase()
  const normalizedClinicStatus = String(clinicStatus || '').toLowerCase()

  if (isFullyApprovedFromStatus(normalizedUserStatus, normalizedClinicStatus)) return 'active'
  if (normalizedUserStatus.includes('pending approval') || normalizedClinicStatus.includes('pending approval')) return 4
  if (normalizedUserStatus.includes('pending document') || normalizedClinicStatus.includes('pending document')) return 3
  if (normalizedUserStatus.includes('pending otp') || normalizedClinicStatus.includes('pending otp')) return 2
  return 1
}

const parseStepParam = (value) => {
  const raw = String(value || '').trim().replace(/^step-/, '')
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 1 || parsed > 4) return null
  return Math.floor(parsed)
}

const syncStepRoute = (step) => {
  const safeStep = parseStepParam(step) || currentStep.value || 1
  const desiredPath = `/clinic/register/step-${safeStep}`
  if (route.path === desiredPath) return
  router.replace({ path: desiredPath, query: route.query })
}

const checkUserByEmail = async (emailValue) => {
  try {
    const res = await axios.post(`${OTP_API_BASE}/auth/check-user`, {
      email: String(emailValue || '').trim().toLowerCase()
    })
    return {
      exists: Boolean(res?.data?.exists),
      uid: String(res?.data?.uid || '').trim()
    }
  } catch (error) {
    console.error('Failed to check user email:', error)
    return null
  }
}

const checkRegistrationStatus = async (emailValue) => {
  try {
    const res = await axios.post(`${OTP_API_BASE}/auth/check-registration-status`, {
      email: String(emailValue || '').trim().toLowerCase()
    })
    return res?.data || null
  } catch (error) {
    console.error('Failed to check registration status:', error)
    return null
  }
}

const fetchRegistrationProfile = async (emailValue) => {
  try {
    const res = await axios.post(`${OTP_API_BASE}/auth/registration-profile`, {
      email: String(emailValue || '').trim().toLowerCase()
    })
    return res?.data || null
  } catch (error) {
    console.error('Failed to load registration profile:', error)
    return null
  }
}

const applyProfileData = (profile) => {
  if (!profile) return
  const safe = (value) => (value === null || value === undefined ? '' : value)
  firstName.value = safe(profile.firstName) || firstName.value
  lastName.value = safe(profile.lastName) || lastName.value
  if (profile.email) {
    email.value = String(profile.email).trim().toLowerCase()
    otpRecipientEmail.value = email.value
    setStoredOtpRecipientEmail(otpRecipientEmail.value)
  }
  contactNumber.value = safe(profile.contactNumber) || contactNumber.value
  clinicName.value = safe(profile.clinicName) || clinicName.value
  clinicLocation.value = safe(profile.clinicLocation) || clinicLocation.value
  clinicLocationLat.value = safe(profile.clinicLocationLat) || clinicLocationLat.value
  clinicLocationLng.value = safe(profile.clinicLocationLng) || clinicLocationLng.value
  clinicLocationAddress.value = safe(profile.clinicLocationAddress) || clinicLocationAddress.value
  authorizedRepPosition.value = safe(profile.authorizedRepPosition) || authorizedRepPosition.value
  companyType.value = safe(profile.companyType) || companyType.value

  if (profile.birthDate) {
    const birth = new Date(profile.birthDate)
    if (!Number.isNaN(birth.getTime())) {
      birthDate.value = `${birth.getFullYear()}-${pad(birth.getMonth() + 1)}-${pad(birth.getDate())}`
      syncManualBirthDate()
      syncCalendarToBirthDate()
    }
  }

  const storedDocuments = profile.submittedDocuments || profile.draftDocuments || {}
  existingSubmittedDocuments.value = {
    secCertificate: storedDocuments?.secCertificate || null,
    articlesOfIncorporation: storedDocuments?.articlesOfIncorporation || null,
    businessPermit: storedDocuments?.businessPermit || null,
    governmentIdRepresentativeFront: storedDocuments?.governmentIdRepresentativeFront || storedDocuments?.governmentIdRepresentative || null,
    governmentIdRepresentativeBack: storedDocuments?.governmentIdRepresentativeBack || null,
    dohAccreditation: storedDocuments?.dohAccreditation || null,
    fdaApproval: storedDocuments?.fdaApproval || null,
    prcIdMedicalDirector: storedDocuments?.prcIdMedicalDirector || storedDocuments?.prcLicenseMedicalDirector || null,
  }
  syncAuthorizedRepPositionOption(authorizedRepPosition.value)
  syncExistingDocumentPreviews()
}

const inferResumeStep = (statusResult, profile) => {
  const resumeStep = statusResult?.resumeStep
  if (resumeStep === 'active' && isFullyApprovedFromStatus(profile?.status, profile?.approvalStatus)) return 'active'
  if (resumeStep === 2 || resumeStep === 3 || resumeStep === 4) return resumeStep

  const statusText = String(profile?.status || '').toLowerCase()
  const approvalText = String(profile?.approvalStatus || '').toLowerCase()
  if (isFullyApprovedFromStatus(statusText, approvalText)) return 'active'
  if (statusText.includes('pending approval') || approvalText.includes('pending approval')) return 4
  if (statusText.includes('pending document') || approvalText.includes('pending document')) return 3
  if (statusText.includes('pending otp') || approvalText.includes('pending otp')) return 2

  const docs =
    profile?.submittedDocuments ||
    profile?.draftDocuments ||
    null
  if (docs && Object.keys(docs || {}).length > 0) return 3

  const hasStep1Data =
    Boolean(profile?.firstName) &&
    Boolean(profile?.lastName) &&
    Boolean(profile?.email) &&
    Boolean(profile?.clinicName) &&
    Boolean(profile?.clinicLocation) &&
    Boolean(profile?.contactNumber)
  if (hasStep1Data) return 2

  return 1
}

const saveRegistrationDraft = () => {
  const payload = {
    email: String(email.value || '').trim().toLowerCase(),
    firstName: firstName.value || '',
    lastName: lastName.value || '',
    birthDate: birthDate.value || '',
    contactNumber: contactNumber.value || '',
    clinicName: clinicName.value || '',
    clinicLocation: clinicLocation.value || '',
    clinicLocationLat: clinicLocationLat.value || '',
    clinicLocationLng: clinicLocationLng.value || '',
    clinicLocationAddress: clinicLocationAddress.value || '',
    clinicBarangay: clinicBarangay.value || '',
    clinicProvince: clinicProvince.value || '',
    clinicPostalCode: clinicPostalCode.value || '',
    authorizedRepPositionOption: authorizedRepPositionOption.value || '',
    authorizedRepPositionOther: authorizedRepPositionOther.value || '',
    companyType: companyType.value || '',
  }
  const serialized = JSON.stringify(payload)
  if (serialized === lastSavedRegistrationDraft) return
  try {
    sessionStorage.setItem(REGISTRATION_DRAFT_KEY, serialized)
    if (payload.email) {
      sessionStorage.setItem('resume_email', payload.email)
    }
    lastSavedRegistrationDraft = serialized
  } catch (_error) {
    // Ignore session storage failures
  }
}

const hasAnyDocumentUploadInProgress = computed(() =>
  Object.values(documentUploadState.value).some((item) => Boolean(item?.uploading))
)

const isApprovalUnderReview = computed(() =>
  approvalReviewState.value === 'pending' || approvalReviewState.value === 'reviewing'
)
const isApprovalApproved = computed(() =>
  approvalRedirecting.value || approvalReviewState.value === 'approved'
)
const isApprovalRejected = computed(() => approvalReviewState.value === 'rejected')
const approvalStateIcon = computed(() => {
  if (isApprovalApproved.value) return 'mdi:check-circle-outline'
  if (isApprovalRejected.value) return 'mdi:close-circle-outline'
  return 'mdi:clock-outline'
})
const approvalStateIconTone = computed(() => {
  if (isApprovalApproved.value) return 'text-emerald-600'
  if (isApprovalRejected.value) return 'text-rose-600'
  return 'text-gold-700'
})

const updateApprovalReviewState = () => {
  const userStatus = String(approvalUserStatus.value || '').trim().toLowerCase()
  const clinicStatus = String(approvalClinicStatus.value || '').trim().toLowerCase()

  if (userStatus === 'active' || clinicStatus.includes('approved')) {
    approvalReviewState.value = 'approved'
    approvalReviewMessage.value = 'Your registration has been approved. Redirecting you to the login page now.'
    approvalReviewReason.value = ''
    if (!approvalRedirecting.value) {
      approvalRedirecting.value = true
      stopApprovalCheck()
      setTimeout(() => router.push('/login'), 1800)
    }
    return
  }

  const isRejected =
    userStatus.includes('rejected') ||
    clinicStatus.includes('rejected') ||
    (!approvalUserExists.value && !approvalClinicExists.value && currentStep.value === 4)

  if (isRejected) {
    approvalReviewState.value = 'rejected'
    approvalReviewMessage.value = 'Your registration was rejected by the platform admin. Please contact support if you need help or submit a new application.'
    approvalRedirecting.value = false
    return
  }

  approvalReviewState.value = 'reviewing'
  approvalReviewMessage.value = 'Your registration is under review. Please allow at least 24 hours for admin review.'
  approvalReviewReason.value = ''
  approvalRedirecting.value = false
}

const scheduleRegistrationDraftSave = () => {
  if (registrationDraftSaveTimer) {
    clearTimeout(registrationDraftSaveTimer)
  }
  registrationDraftSaveTimer = setTimeout(() => {
    registrationDraftSaveTimer = null
    saveRegistrationDraft()
  }, 250)
}

const applyDraftIfEmpty = (draft) => {
  if (!draft) return
  if (!email.value && draft.email) email.value = draft.email
  if (!firstName.value && draft.firstName) firstName.value = draft.firstName
  if (!lastName.value && draft.lastName) lastName.value = draft.lastName
  if (!birthDate.value && draft.birthDate) {
    birthDate.value = draft.birthDate
    syncManualBirthDate()
    syncCalendarToBirthDate()
  }
  if (!contactNumber.value && draft.contactNumber) contactNumber.value = draft.contactNumber
  if (!clinicName.value && draft.clinicName) clinicName.value = draft.clinicName
  if (!clinicLocation.value && draft.clinicLocation) clinicLocation.value = draft.clinicLocation
  if (!clinicLocationLat.value && draft.clinicLocationLat) clinicLocationLat.value = draft.clinicLocationLat
  if (!clinicLocationLng.value && draft.clinicLocationLng) clinicLocationLng.value = draft.clinicLocationLng
  if (!clinicLocationAddress.value && draft.clinicLocationAddress) clinicLocationAddress.value = draft.clinicLocationAddress
  if (!clinicBarangay.value && draft.clinicBarangay) clinicBarangay.value = draft.clinicBarangay
  if (!clinicProvince.value && draft.clinicProvince) clinicProvince.value = draft.clinicProvince
  if (!clinicPostalCode.value && draft.clinicPostalCode) clinicPostalCode.value = draft.clinicPostalCode
  if (!authorizedRepPositionOption.value && draft.authorizedRepPositionOption) {
    authorizedRepPositionOption.value = draft.authorizedRepPositionOption
  }
  if (!authorizedRepPositionOther.value && draft.authorizedRepPositionOther) {
    authorizedRepPositionOther.value = draft.authorizedRepPositionOther
  }
  if (!companyType.value && draft.companyType) companyType.value = draft.companyType
}

const getLastOtpSentAt = () => {
  const raw = sessionStorage.getItem(OTP_SENT_AT_KEY)
  const parsed = Number(raw || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const getStoredRegistrationUid = () => String(sessionStorage.getItem(REGISTRATION_UID_KEY) || '').trim()

const setStoredRegistrationUid = (value) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    sessionStorage.removeItem(REGISTRATION_UID_KEY)
    return
  }
  sessionStorage.setItem(REGISTRATION_UID_KEY, normalized)
}

const getStoredOtpRecipientEmail = () => String(sessionStorage.getItem(REGISTRATION_OTP_EMAIL_KEY) || '').trim().toLowerCase()

const setStoredOtpRecipientEmail = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    sessionStorage.removeItem(REGISTRATION_OTP_EMAIL_KEY)
    return
  }
  sessionStorage.setItem(REGISTRATION_OTP_EMAIL_KEY, normalized)
}

const markOtpSentNow = () => {
  sessionStorage.setItem(OTP_SENT_AT_KEY, String(Date.now()))
}

const restoreOtpCountdown = () => {
  const lastSentAt = getLastOtpSentAt()
  if (!lastSentAt) {
    stopOtpCountdown()
    otpResendCountdown.value = 0
    return
  }

  const elapsedSeconds = Math.floor((Date.now() - lastSentAt) / 1000)
  const remainingSeconds = Math.max(OTP_COOLDOWN_SECONDS - elapsedSeconds, 0)

  if (remainingSeconds > 0) {
    startOtpCountdown(remainingSeconds)
    return
  }

  stopOtpCountdown()
  otpResendCountdown.value = 0
}

const beginOtpCooldown = () => {
  markOtpSentNow()
  startOtpCountdown()
}

otpRecipientEmail.value = getStoredOtpRecipientEmail()

watch([currentStep, userUid], ([step, uid]) => {
  syncStepRoute(step)
  if (step === 4 && uid) {
    startApprovalCheck()
  } else {
    stopApprovalCheck()
  }

  if (step === 2) {
    if (!otpRecipientEmail.value) {
      otpRecipientEmail.value = String(getStoredOtpRecipientEmail() || email.value || '').trim().toLowerCase()
    }
    if (otpRecipientEmail.value) setStoredOtpRecipientEmail(otpRecipientEmail.value)
    restoreOtpCountdown()
    nextTick(() => {
      if (!otpCode.value) focusOtpInput(0)
    })
  }
})

watch(authorizedRepPositionOption, (value) => {
  if (value !== 'Other') {
    authorizedRepPositionOther.value = ''
  }
})

watch(
  [
    email,
    firstName,
    lastName,
    birthDate,
    contactNumber,
    clinicName,
    clinicLocation,
    clinicLocationLat,
    clinicLocationLng,
    clinicLocationAddress,
    clinicBarangay,
    clinicProvince,
    clinicPostalCode,
    authorizedRepPositionOption,
    authorizedRepPositionOther,
    companyType,
  ],
  scheduleRegistrationDraftSave
)

const verifyRegistrationEmail = async (options = {}) => {
  const isAutoResume = Boolean(options?.isAutoResume)
  const normalizedEmail = String(email.value || '').trim().toLowerCase()
  if (!normalizedEmail) {
    toast.error('Please enter your email first.')
    return
  }

  sessionStorage.setItem('resume_email', normalizedEmail)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    toast.error('Please enter a valid email address.')
    return
  }

  isCheckingEmail.value = true

  try {
    userUid.value = ''
    setStoredRegistrationUid('')
    clearOtpInputs()
    stopOtpCountdown()
    secCertificateFile.value = null
    articlesOfIncorporationFile.value = null
    businessPermitFile.value = null
    governmentIdRepresentativeFrontFile.value = null
    governmentIdRepresentativeBackFile.value = null
    dohAccreditationFile.value = null
    fdaApprovalFile.value = null
    prcIdMedicalDirectorFile.value = null
    existingSubmittedDocuments.value = {
      secCertificate: null,
      articlesOfIncorporation: null,
      businessPermit: null,
      governmentIdRepresentativeFront: null,
      governmentIdRepresentativeBack: null,
      dohAccreditation: null,
      fdaApproval: null,
      prcIdMedicalDirector: null,
    }
    syncExistingDocumentPreviews()
    pendingApprovalMode.value = false

    const statusResult = await checkRegistrationStatus(normalizedEmail)
      if (statusResult?.exists) {
        const profileResult = await fetchRegistrationProfile(normalizedEmail)
        if (profileResult?.profile) {
          applyProfileData(profileResult.profile)
        }
        userUid.value = String(statusResult.uid || '').trim()
        if (userUid.value) {
          setStoredRegistrationUid(userUid.value)
        }
      emailChecked.value = true
      otpRecipientEmail.value = normalizedEmail
      setStoredOtpRecipientEmail(otpRecipientEmail.value)

      const resolvedStep = inferResumeStep(statusResult, profileResult?.profile)
      if (resolvedStep === 'active') {
        toast.info('This account is already active. Please log in.')
        setTimeout(() => router.push('/login'), 800)
        return
      }

      if (isAutoResume && resumeCancelled.value) {
        return
      }

      if (resolvedStep === 4) {
        otpVerifiedForRegistration.value = true
        pendingApprovalMode.value = true
        currentStep.value = 4
        toast.info('Welcome back. You are already waiting for approval.')
        return
      }

      if (resolvedStep === 3) {
        otpVerifiedForRegistration.value = true
        pendingApprovalMode.value = false
        currentStep.value = 3
        toast.info('Welcome back. Continue with your document uploads.')
        return
      }

      if (resolvedStep === 2) {
        otpVerifiedForRegistration.value = false
        pendingApprovalMode.value = false
        currentStep.value = 2
        const lastSentAt = getLastOtpSentAt()
        const now = Date.now()
        const canSend = !lastSentAt || (now - lastSentAt) > (OTP_COOLDOWN_SECONDS * 1000)
        if (canSend) {
          const otpResult = await sendOtpEmail(normalizedEmail)
          clearOtpInputs()
          focusOtpInput(0)
          handleClinicOtpResult(otpResult, 'We found an account. Please verify the OTP to continue.')
        } else {
          clearOtpInputs()
          focusOtpInput(0)
          restoreOtpCountdown()
        }
        syncStepRoute(2)
        return
      }
    }

    let snapshot = null
    try {
      const usersRef = collection(db, 'users')
      const emailQuery = query(usersRef, where('email', '==', normalizedEmail))
      snapshot = await getDocs(emailQuery)
    } catch (readError) {
      const errorCode = String(readError?.code || '').toLowerCase()
      if (errorCode.includes('permission-denied')) {
        const statusResult = await checkRegistrationStatus(normalizedEmail)
        if (statusResult && statusResult.exists === false) {
          emailChecked.value = true
          otpVerifiedForRegistration.value = false
          currentStep.value = 1
          toast.success('Email verified. Continue with your registration details.')
          return
        }

        if (statusResult && statusResult.exists === true) {
          const profileResult = await fetchRegistrationProfile(normalizedEmail)
          if (profileResult?.profile) {
            applyProfileData(profileResult.profile)
          }
          userUid.value = String(statusResult.uid || '').trim()
          setStoredRegistrationUid(userUid.value)
          emailChecked.value = true
          otpRecipientEmail.value = normalizedEmail
          setStoredOtpRecipientEmail(otpRecipientEmail.value)

          if (statusResult.resumeStep === 'active') {
            const isApproved = isFullyApprovedFromStatus(statusResult?.status, statusResult?.approvalStatus)
            if (isApproved) {
              toast.info('This account is already active. Please log in.')
              setTimeout(() => router.push('/login'), 800)
              return
            }
            pendingApprovalMode.value = true
            currentStep.value = 4
            toast.info('Your registration is still pending approval. Continue here.')
            return
          }

          if (isAutoResume && resumeCancelled.value) {
            return
          }

          if (statusResult.resumeStep === 4) {
            otpVerifiedForRegistration.value = true
            pendingApprovalMode.value = true
            currentStep.value = 4
            toast.info('Welcome back. You are already waiting for approval.')
            return
          }

          if (statusResult.resumeStep === 3) {
            otpVerifiedForRegistration.value = true
            pendingApprovalMode.value = false
            currentStep.value = 3
            toast.info('Welcome back. Continue with your document uploads.')
            return
          }

          if (statusResult.resumeStep === 1) {
            otpVerifiedForRegistration.value = false
            pendingApprovalMode.value = false
            currentStep.value = 1
            toast.info('Welcome back. Continue your registration details.')
            return
          }

          otpVerifiedForRegistration.value = false
          pendingApprovalMode.value = false
          currentStep.value = 2
          const otpResult = await sendOtpEmail(normalizedEmail)
          clearOtpInputs()
          focusOtpInput(0)
          handleClinicOtpResult(otpResult, 'We found an account. Please verify the OTP to continue.')
          return
        }
      }
      throw readError
    }

    email.value = normalizedEmail
    otpRecipientEmail.value = normalizedEmail
    setStoredOtpRecipientEmail(otpRecipientEmail.value)

    if (snapshot.empty) {
      emailChecked.value = true
      otpVerifiedForRegistration.value = false
      currentStep.value = 1
      toast.success('Email verified. Continue with your registration details.')
      return
    }

    const existingUserDoc = snapshot.docs[0]
    const existingUser = existingUserDoc.data() || {}
    userUid.value = existingUserDoc.id
    setStoredRegistrationUid(userUid.value)

    firstName.value = existingUser.firstName || firstName.value
    lastName.value = existingUser.lastName || lastName.value
    contactNumber.value = existingUser.contactNumber || contactNumber.value

    if (existingUser.birthDate?.toDate) {
      const birth = existingUser.birthDate.toDate()
      birthDate.value = `${birth.getFullYear()}-${pad(birth.getMonth() + 1)}-${pad(birth.getDate())}`
      syncManualBirthDate()
      syncCalendarToBirthDate()
    }

    const clinicDoc = await getDoc(doc(db, 'clinics', userUid.value))
    const clinicData = clinicDoc.exists() ? clinicDoc.data() : {}
    applyProfileData({
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      birthDate: existingUser.birthDate?.toDate ? existingUser.birthDate.toDate().toISOString() : existingUser.birthDate,
      email: existingUser.email,
      contactNumber: existingUser.contactNumber,
      authorizedRepPosition: existingUser.authorizedRepPosition || clinicData.authorizedRepPosition,
      companyName: clinicData.companyName || clinicData.clinicName || '',
      companyType: clinicData.companyType,
      clinicName: clinicData.clinicName,
      clinicLocation: clinicData.clinicLocation,
      clinicLocationLat: clinicData.clinicLocationLat,
      clinicLocationLng: clinicData.clinicLocationLng,
      clinicLocationAddress: clinicData.clinicLocationAddress,
      clinicBarangay: clinicData.clinicBarangay,
      clinicProvince: clinicData.clinicProvince,
      clinicPostalCode: clinicData.clinicPostalCode,
      submittedDocuments: clinicData.submittedDocuments,
      draftDocuments: clinicData.draftDocuments,
    })

    const resumeStep = mapRegistrationStepFromStatus(existingUser.status, clinicData.approvalStatus)
    if (resumeStep === 'active') {
      toast.info('This account is already active. Please log in.')
      setTimeout(() => router.push('/login'), 800)
      return
    }

    emailChecked.value = true
    otpVerifiedForRegistration.value = resumeStep === 3 || resumeStep === 4
    pendingApprovalMode.value = resumeStep === 4
    currentStep.value = resumeStep

    if (resumeStep === 2) {
      const otpResult = await sendOtpEmail(normalizedEmail)
      clearOtpInputs()
      focusOtpInput(0)
      if (otpResult.success) {
        beginOtpCooldown()
        toast.info('Welcome back. A new OTP was sent to your email.')
      } else {
        stopOtpCountdown()
        toast.warning(`Unable to send OTP: ${otpResult.error}`)
      }
    } else {
      stopOtpCountdown()
      toast.info(`Welcome back. Continuing from Step ${resumeStep}.`)
    }
  } catch (err) {
    console.error(err)
    toast.error('Unable to verify email right now. Please try again.')
  } finally {
    isCheckingEmail.value = false
  }
}

const handleEmailDraftInput = () => {
  const normalizedEmail = String(email.value || '').trim().toLowerCase()
  if (emailChecked.value && normalizedEmail !== String(otpRecipientEmail.value || '').toLowerCase()) {
    emailChecked.value = false
    currentStep.value = 1
    otpVerifiedForRegistration.value = false
    userUid.value = ''
    setStoredRegistrationUid('')
    otpRecipientEmail.value = ''
    setStoredOtpRecipientEmail('')
    clearOtpInputs()
    stopOtpCountdown()
    secCertificateFile.value = null
    articlesOfIncorporationFile.value = null
    businessPermitFile.value = null
    governmentIdRepresentativeFrontFile.value = null
    governmentIdRepresentativeBackFile.value = null
    dohAccreditationFile.value = null
    fdaApprovalFile.value = null
    prcIdMedicalDirectorFile.value = null
    existingSubmittedDocuments.value = {
      secCertificate: null,
      articlesOfIncorporation: null,
      businessPermit: null,
      governmentIdRepresentativeFront: null,
      governmentIdRepresentativeBack: null,
      dohAccreditation: null,
      fdaApproval: null,
      prcIdMedicalDirector: null,
    }
    syncExistingDocumentPreviews()
    pendingApprovalMode.value = false
    approvalRedirecting.value = false
    approvalReviewState.value = 'pending'
    approvalReviewMessage.value = 'Your registration is under review. Please allow at least 24 hours for admin review.'
    approvalReviewReason.value = ''
    approvalUserExists.value = false
    approvalClinicExists.value = false
    approvalUserStatus.value = ''
    approvalClinicStatus.value = ''
    stopApprovalCheck()
  }
}

const openLocationModal = () => {
  locationSearchQuery.value = clinicLocationAddress.value || clinicLocation.value || ''
  showLocationModal.value = true
  nextTick(() => initLocationMap())
}

const closeLocationModal = () => {
  showLocationModal.value = false
}

const resetClinicRegistrationFlow = () => {
  stopApprovalCheck()
  stopOtpCountdown()
  approvalRedirecting.value = false
  approvalReviewState.value = 'pending'
  approvalReviewMessage.value = 'Your registration is under review. Please allow at least 24 hours for admin review.'
  approvalReviewReason.value = ''
  approvalUserExists.value = false
  approvalClinicExists.value = false
  approvalUserStatus.value = ''
  approvalClinicStatus.value = ''
  pendingApprovalMode.value = false
  otpVerifiedForRegistration.value = false
  emailChecked.value = false
  currentStep.value = 1
  userUid.value = ''
  setStoredRegistrationUid('')
  setStoredOtpRecipientEmail('')
  otpRecipientEmail.value = ''
  clearOtpInputs()
  secCertificateFile.value = null
  articlesOfIncorporationFile.value = null
  businessPermitFile.value = null
  governmentIdRepresentativeFrontFile.value = null
  governmentIdRepresentativeBackFile.value = null
  dohAccreditationFile.value = null
  fdaApprovalFile.value = null
  prcIdMedicalDirectorFile.value = null
  existingSubmittedDocuments.value = {
    secCertificate: null,
    articlesOfIncorporation: null,
    businessPermit: null,
    governmentIdRepresentativeFront: null,
    governmentIdRepresentativeBack: null,
    dohAccreditation: null,
    fdaApproval: null,
    prcIdMedicalDirector: null,
  }
  Object.keys(documentPreviewUrls.value).forEach((key) => {
    const currentPreview = documentPreviewUrls.value[key]
    if (currentPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPreview)
    documentPreviewUrls.value[key] = ''
  })
  Object.keys(documentUploadState.value).forEach((key) => {
    documentUploadState.value[key] = { uploading: false, progress: 0, error: '' }
  })
}

const loadMapsScript = (apiKey) =>
  new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve()
      return
    }

    const existing = document.getElementById('google-maps-js')
    if (existing) {
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-js'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async&v=weekly`
    script.onload = () => {
      const start = Date.now()
      const waitForMaps = () => {
        if (window.google?.maps?.Map) {
          resolve()
          return
        }
        if (Date.now() - start > 5000) {
          reject(new Error('Google Maps JS API loaded but maps object was not initialized.'))
          return
        }
        setTimeout(waitForMaps, 50)
      }
      waitForMaps()
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps JS API.'))
    document.head.appendChild(script)
  })

const initLocationMap = async () => {
  if (!locationMapCanvas.value) return
  locationError.value = ''

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    locationError.value = 'Missing Google Maps API key in frontend env.'
    return
  }

  if (!mapsReady) {
    try {
      await loadMapsScript(apiKey)
      mapsReady = true
    } catch (error) {
      console.error(error)
      const existing = document.getElementById('google-maps-js')
      if (existing) existing.remove()
      try {
        await loadMapsScript(apiKey)
        mapsReady = true
      } catch (retryError) {
        console.error(retryError)
        locationError.value = 'Failed to load Google Maps. Check API key and referrer restrictions.'
        return
      }
    }
  }

  if (!window.google?.maps?.Map) {
    locationError.value = 'Google Maps failed to initialize.'
    return
  }

  locationMap = new window.google.maps.Map(locationMapCanvas.value, {
    center: defaultCaviteCenter,
    zoom: 12,
    restriction: { latLngBounds: caviteBounds, strictBounds: true },
    mapId: import.meta.env.VITE_GOOGLE_MAP_ID,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false
  })

  if (window.google.maps.importLibrary) {
    const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
    locationMarker = new AdvancedMarkerElement({
      position: defaultCaviteCenter,
      map: locationMap,
      gmpDraggable: true
    })
  } else if (window.google.maps.Marker) {
    locationMarker = new window.google.maps.Marker({
      position: defaultCaviteCenter,
      map: locationMap,
      draggable: true
    })
  }

  const restoreMarkerToSavedLocation = () => {
    const lat = Number(clinicLocationLat.value)
    const lng = Number(clinicLocationLng.value)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const savedLocation = { lat, lng }
    if (locationMarker?.position) {
      locationMarker.position = savedLocation
    } else if (locationMarker?.setPosition) {
      locationMarker.setPosition(savedLocation)
    }
    locationMap?.setCenter(savedLocation)
  }

  restoreMarkerToSavedLocation()

  locationMap.addListener('click', (event) => {
    const latLng = event?.latLng
    if (!latLng) return
    const lat = latLng.lat()
    const lng = latLng.lng()
    if (locationMarker?.position) {
      locationMarker.position = { lat, lng }
    } else if (locationMarker?.setPosition) {
      locationMarker.setPosition({ lat, lng })
    }
    reverseGeocodeLocation(lat, lng)
  })

  if (locationMarker?.addListener) {
    locationMarker.addListener('dragend', () => {
      const pos = locationMarker?.getPosition ? locationMarker.getPosition() : locationMarker?.position
      if (!pos) return
      const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
      const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
      reverseGeocodeLocation(lat, lng)
    })
  }

  locationAutocomplete = null
}

const flattenAddressComponents = (entries = []) => (entries || []).flatMap((entry) => entry?.address_components || [])

const getAddressComponentValue = (components, type, mode = 'long') => {
  const preferredTypes = Array.isArray(type) ? type : [type]
  const match = (components || []).find((component) =>
    preferredTypes.some((preferredType) => component.types?.includes(preferredType))
  )
  if (!match) return ''
  return mode === 'short'
    ? String(match.short_name || match.shortName || '')
    : String(match.long_name || match.longName || '')
}

const extractPostalCode = (components = [], ...fallbackTexts) => {
  const componentPostalCode = getAddressComponentValue(components, 'postal_code')
  if (componentPostalCode) return componentPostalCode

  for (const text of fallbackTexts) {
    const match = String(text || '').match(/\b\d{4}\b/)
    if (match) return match[0]
  }

  return ''
}

const sanitizePostalCodeInput = (event) => {
  clinicPostalCode.value = String(event?.target?.value || '')
    .replace(/\D/g, '')
    .slice(0, 4)
}

const isWithinCavite = (components = []) => {
  const province = getAddressComponentValue(components, 'administrative_area_level_2')
  return /cavite/i.test(province)
}

const applyResolvedClinicLocation = ({ lat, lng, components = [], formattedAddress = '', fallbackName = '' }) => {
  const cityName =
    getAddressComponentValue(components, 'locality') ||
    getAddressComponentValue(components, 'administrative_area_level_3') ||
    getAddressComponentValue(components, 'administrative_area_level_2')
  const barangayName =
    getAddressComponentValue(components, [
      'sublocality_level_1',
      'sublocality_level_2',
      'sublocality',
      'administrative_area_level_4'
    ]) ||
    getAddressComponentValue(components, 'neighborhood')
  const provinceName =
    getAddressComponentValue(components, 'administrative_area_level_2') ||
    getAddressComponentValue(components, 'administrative_area_level_1')
  const postalCode = extractPostalCode(components, formattedAddress, fallbackName)
  const streetNumber = getAddressComponentValue(components, 'street_number')
  const routeName = getAddressComponentValue(components, 'route')
  const streetAddress = [streetNumber, routeName].filter(Boolean).join(' ').trim()

  clinicLocationLat.value = String(lat)
  clinicLocationLng.value = String(lng)
  clinicLocation.value = cityName || fallbackName || ''
  clinicLocationAddress.value = formattedAddress || fallbackName || ''
  clinicBarangay.value = barangayName || ''
  clinicProvince.value = provinceName || 'Cavite'
  clinicPostalCode.value = postalCode || ''

  if (!clinicLocationAddress.value && streetAddress) {
    clinicLocationAddress.value = streetAddress
  }
}

const handlePlaceSelection = (location, components, fallbackName) => {
  if (!location) return
  const comp = components || []
  if (!isWithinCavite(comp)) {
    locationError.value = 'Please select a location within Cavite.'
    return
  }
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng
  if (locationMarker?.position) {
    locationMarker.position = { lat, lng }
  } else if (locationMarker?.setPosition) {
    locationMarker.setPosition({ lat, lng })
  }
  applyResolvedClinicLocation({
    lat,
    lng,
    components: comp,
    formattedAddress: fallbackName || '',
    fallbackName
  })
  locationError.value = ''
}

const searchLocation = () => {
  const query = String(locationSearchQuery.value || '').trim()
  if (!query) {
    locationError.value = 'Enter a location to search.'
    return
  }
  if (!window.google?.maps?.Geocoder) {
    locationError.value = 'Search is not available right now.'
    return
  }

  const geocoder = new window.google.maps.Geocoder()
  geocoder.geocode(
    {
      address: query,
      bounds: caviteBounds,
      componentRestrictions: { country: 'PH' }
    },
    (results, status) => {
      if (status !== 'OK' || !results?.length) {
        locationError.value = 'No matching location found.'
        return
      }

      const place = results[0]
      const components = flattenAddressComponents(results)
      if (!isWithinCavite(components)) {
        locationError.value = 'Please select a location within Cavite.'
        return
      }

      const location = place.geometry?.location
      if (!location) {
        locationError.value = 'Unable to resolve the searched location.'
        return
      }

      const lat = typeof location.lat === 'function' ? location.lat() : location.lat
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng

      if (locationMarker?.position) {
        locationMarker.position = { lat, lng }
      } else if (locationMarker?.setPosition) {
        locationMarker.setPosition({ lat, lng })
      }
      if (locationMap?.setCenter) {
        locationMap.setCenter({ lat, lng })
      }

      applyResolvedClinicLocation({
        lat,
        lng,
        components,
        formattedAddress: place.formatted_address || query,
        fallbackName: place.formatted_address || query
      })
      locationError.value = ''
    }
  )
}

const usePinnedLocation = async () => {
  if (!locationMarker) {
    locationError.value = 'Pin a location on the map first.'
    return
  }
  const pos = locationMarker?.position || (locationMarker?.getPosition ? locationMarker.getPosition() : null)
  if (!pos) {
    locationError.value = 'Pin a location on the map first.'
    return
  }
  const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat
  const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng
  const resolved = await reverseGeocodeLocation(lat, lng)
  if (!resolved) return

  closeLocationModal()
  toast.success('Clinic location selected successfully.')
}

const reverseGeocodeLocation = (lat, lng) => {
  if (!window.google?.maps?.Geocoder) return Promise.resolve(false)
  const geocoder = new window.google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== 'OK' || !results?.length) {
        locationError.value = 'Unable to resolve a place name for the pinned location.'
        resolve(false)
        return
      }
      const components = flattenAddressComponents(results)
      if (!isWithinCavite(components)) {
        locationError.value = 'Pinned location is outside Cavite.'
        if (locationMap) {
          locationMap.setCenter(defaultCaviteCenter)
        }
        resolve(false)
        return
      }
      applyResolvedClinicLocation({
        lat,
        lng,
        components,
        formattedAddress: results[0].formatted_address || '',
        fallbackName: results[0].formatted_address || ''
      })
      locationError.value = ''
      resolve(true)
    })
  })
}

const handleOtpInput = (index, event) => {
  const digits = String(event.target.value || '').replace(/\D/g, '')

  if (!digits) {
    otpDigits.value[index] = ''
    return
  }

  if (digits.length === 1) {
    otpDigits.value[index] = digits
    if (index < OTP_LENGTH - 1) focusOtpInput(index + 1)
    return
  }

  const spread = digits.slice(0, OTP_LENGTH - index).split('')
  spread.forEach((digit, offset) => {
    otpDigits.value[index + offset] = digit
  })

  const nextIndex = Math.min(index + spread.length, OTP_LENGTH - 1)
  focusOtpInput(nextIndex)
}

const handleOtpKeydown = (index, event) => {
  const allowedControlKeys = ['Tab', 'Shift', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Home', 'End']
  if (allowedControlKeys.includes(event.key)) {
    if (event.key === 'Backspace') {
      if (otpDigits.value[index]) {
        otpDigits.value[index] = ''
      } else if (index > 0) {
        otpDigits.value[index - 1] = ''
        focusOtpInput(index - 1)
      }
      event.preventDefault()
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      focusOtpInput(index - 1)
      event.preventDefault()
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusOtpInput(index + 1)
      event.preventDefault()
    }
    return
  }

  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

const handleOtpPaste = (event) => {
  event.preventDefault()
  const pastedDigits = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, OTP_LENGTH) || ''
  if (!pastedDigits) return

  clearOtpInputs()
  pastedDigits.split('').forEach((digit, index) => {
    otpDigits.value[index] = digit
  })

  const nextIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1)
  focusOtpInput(nextIndex)
}

const resendOtp = async () => {
  if (!otpCanResend.value) return
  const recipientEmail = String(otpRecipientEmail.value || email.value || '').trim().toLowerCase()
  if (!recipientEmail) {
    toast.error('Missing recipient email. Please register again.')
    return
  }
  otpRecipientEmail.value = recipientEmail
  setStoredOtpRecipientEmail(recipientEmail)

  const otpResult = await sendOtpEmail(recipientEmail)
  clearOtpInputs()
  focusOtpInput(0)
  handleClinicOtpResult(
    otpResult,
    `OTP resent to ${otpRecipientLabel.value || 'your email'}. Check your inbox or spam folder. Only the latest OTP will work.`,
    'Unable to resend OTP'
  )
}

const registerClinic = async () => {
  if (currentStep.value !== 1) return
  if (!emailChecked.value) {
    toast.error('Please verify your email first.')
    return
  }

  if (!termsAccepted.value) {
    toast.error('You must agree to the terms and conditions and privacy policy')
    return
  }

  if (requiresPasswordForStep1.value) {
    if (password.value !== confirmPassword.value) {
      toast.error('Passwords do not match')
      return
    }

    if (!PASSWORD_REGEX.test(password.value)) {
      toast.error('Password must be 8-32 characters and include uppercase, lowercase, number, and special character (@$!%*?&)')
      return
    }
  }

  if (!firstName.value || !lastName.value || !email.value || !clinicName.value || 
      !clinicLocation.value || !contactNumber.value ||
      (requiresPasswordForStep1.value && (!password.value || !confirmPassword.value))) {
    toast.error('Please fill all required fields')
    return
  }
  if (!clinicLocationLat.value || !clinicLocationLng.value) {
    toast.error('Please pin the exact clinic location on the map.')
    return
  }

  if (!caviteLocationSet.has(normalizeLocationName(clinicLocation.value))) {
    toast.error('Only clinics located in Cavite can register.')
    return
  }

  if (!birthDate.value) {
    toast.error('Please enter a valid birth date (MM/DD/YYYY).')
    return
  }

  const phoneRegex = /^[1-9][0-9]{9}$/
  if (!phoneRegex.test(contactNumber.value)) {
    toast.error('Contact number must be 10 digits after +63 and cannot start with 0')
    return
  }

  const birth = new Date(birthDate.value)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--

  if (age < 18) {
    toast.error('You must be at least 18 years old to register')
    return
  }

  const companyPayload = {
    authorizedRepPosition: '',
    companyName: clinicName.value.trim(),
    companyType: '',
  }

  sessionStorage.setItem('resume_email', String(email.value || '').trim().toLowerCase())

  isSubmitting.value = true

  try {
    // 🔹 Create Firebase Auth user
    if (userUid.value) {
      if (!otpVerifiedForRegistration.value) {
        const otpResult = await sendOtpEmail(email.value.trim())
        currentStep.value = 2
        syncStepRoute(2)
        clearOtpInputs()
        focusOtpInput(0)
        if (otpResult.success) {
          beginOtpCooldown()
          toast.info('Account is already in progress. A new OTP was sent.')
        } else {
          stopOtpCountdown()
          toast.warning(`Unable to send OTP: ${otpResult.error}`)
        }
        return
      }

      await Promise.all([
        updateDoc(doc(db, 'users', userUid.value), {
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          birthDate: birthDate.value ? new Date(birthDate.value) : null,
          email: email.value.trim(),
          contactNumber: contactNumber.value.trim(),
          authorizedRepPosition: companyPayload.authorizedRepPosition,
          companyName: companyPayload.companyName,
          companyType: companyPayload.companyType,
          updatedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'clinics', userUid.value), {
          clinicName: clinicName.value.trim(),
          clinicLocation: clinicLocation.value.trim(),
          clinicLocationLat: clinicLocationLat.value,
          clinicLocationLng: clinicLocationLng.value,
          clinicLocationAddress: clinicLocationAddress.value,
          clinicBarangay: clinicBarangay.value,
          clinicProvince: clinicProvince.value,
          clinicPostalCode: clinicPostalCode.value,
          authorizedRepPosition: companyPayload.authorizedRepPosition,
          companyName: companyPayload.companyName,
          companyType: companyPayload.companyType,
          updatedAt: serverTimestamp(),
        }),
      ])

      currentStep.value = 3
      toast.info('Information updated. Continue to document upload.')
      return
    }

    const userCredentials = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    )

    const uid = userCredentials.user.uid
    userUid.value = uid
    setStoredRegistrationUid(uid)
    const ownerFullName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim()

    // 🔹 Save user
    const saveUserPromise = setDoc(doc(db, 'users', uid), {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      birthDate: birthDate.value ? new Date(birthDate.value) : null,
      email: email.value.trim(),
      contactNumber: contactNumber.value.trim(),
      authorizedRepPosition: companyPayload.authorizedRepPosition,
      companyName: companyPayload.companyName,
      companyType: companyPayload.companyType,
      branchId: uid,
      clinicBranch: 'Main Branch',
      role: 'Clinic Admin',
      status: 'Pending OTP Verification',
      createdAt: serverTimestamp(),
    })

    // 🔹 Save clinic
    const saveClinicPromise = setDoc(doc(db, 'clinics', uid), {
      clinicName: clinicName.value.trim(),
      clinicLocation: clinicLocation.value.trim(),
      clinicLocationLat: clinicLocationLat.value,
      clinicLocationLng: clinicLocationLng.value,
      clinicLocationAddress: clinicLocationAddress.value,
      clinicBarangay: clinicBarangay.value,
      clinicProvince: clinicProvince.value,
      clinicPostalCode: clinicPostalCode.value,
      authorizedRepPosition: companyPayload.authorizedRepPosition,
      companyName: companyPayload.companyName,
      companyType: companyPayload.companyType,
      clinicBranch: 'Main Branch',
      ownerId: uid,
      isMainBranch: true,
      branchAdminId: uid,
      branchAdminName: ownerFullName || 'Owner',
      approvalStatus: 'Pending OTP Verification',
      createdAt: serverTimestamp(),
    })

    // 🔹 Send OTP
    otpRecipientEmail.value = email.value.trim()
    setStoredOtpRecipientEmail(otpRecipientEmail.value)
    const sendOtpPromise = sendOtpEmail(otpRecipientEmail.value)

    const [, , otpResult] = await Promise.all([
      saveUserPromise,
      saveClinicPromise,
      sendOtpPromise,
    ])

    // 🔹 Open OTP modal
    currentStep.value = 2
    syncStepRoute(2)
    clearOtpInputs()
    focusOtpInput(0)
    handleClinicOtpResult(otpResult, 'OTP sent to your email! Please verify to complete registration.')

  } catch (err) {
    console.error(err)

    const errorCode = String(err?.code || '')
    const friendlyMessages = {
      'auth/email-already-in-use': 'An account with this email already exists. Continuing your registration...',
      'auth/invalid-email': 'Invalid email format.',
      'auth/weak-password': 'Password is too weak.',
      'auth/invalid-api-key': 'Firebase Auth API key is invalid or restricted. Please update the Firebase config.',
      'auth/api-key-not-valid': 'Firebase Auth API key is invalid or restricted. Please update the Firebase config.',
      'auth/operation-not-allowed': 'Email/password sign-in is disabled in Firebase Auth.',
    }

    if (errorCode === 'auth/email-already-in-use') {
      const statusResult = await checkRegistrationStatus(email.value.trim())
      if (statusResult?.exists) {
        userUid.value = String(statusResult.uid || '').trim()
        setStoredRegistrationUid(userUid.value)
        emailChecked.value = true
        otpRecipientEmail.value = email.value.trim().toLowerCase()
        setStoredOtpRecipientEmail(otpRecipientEmail.value)

        const otpResult = await sendOtpEmail(otpRecipientEmail.value)
        currentStep.value = 2
        syncStepRoute(2)
        clearOtpInputs()
        focusOtpInput(0)
        handleClinicOtpResult(otpResult, 'Account exists. Please verify the latest OTP to continue.')
        return
      }
    }

    toast.error(friendlyMessages[errorCode] || 'Failed to register, please try again')
  } finally {
    isSubmitting.value = false
  }
}

const verifyOtp = async () => {
  if (currentStep.value !== 2) return

  if (otpCode.value.length !== OTP_LENGTH) {
    toast.error('Please enter the complete 6-digit OTP')
    return
  }

  try {
    const lookupEmail = String(otpRecipientEmail.value || email.value || '').trim().toLowerCase()
    const currentAuthUid = auth?.currentUser?.uid || ''
    const currentAuthEmail = String(auth?.currentUser?.email || '').trim().toLowerCase()

    if (currentAuthUid && lookupEmail && currentAuthEmail === lookupEmail) {
      userUid.value = currentAuthUid
      setStoredRegistrationUid(userUid.value)
    }

    if (!userUid.value) {
      if (lookupEmail) {
        const statusResult = await checkRegistrationStatus(lookupEmail)
        if (statusResult?.uid) {
          userUid.value = String(statusResult.uid).trim()
          setStoredRegistrationUid(userUid.value)
        }
      }
      if (!userUid.value) {
        const storedUid = getStoredRegistrationUid()
        if (storedUid) {
          userUid.value = storedUid
        }
      }
    }

    const verifyRes = await axios.post(`${OTP_API_BASE}/auth/verify-registration-otp`, {
      uid: userUid.value,
      email: lookupEmail,
      otp: otpCode.value,
    })

    if (!verifyRes?.data?.success) {
      throw new Error(verifyRes?.data?.error || 'Failed to verify OTP')
    }

    if (verifyRes?.data?.data?.uid) {
      userUid.value = String(verifyRes.data.data.uid).trim()
      setStoredRegistrationUid(userUid.value)
    }

    otpVerifiedForRegistration.value = true
    setStoredOtpRecipientEmail('')
    toast.success('Email verified. Continue to document upload.')
    currentStep.value = 3
    clearOtpInputs()
  } catch (err) {
    console.error(err)
    const verifyError =
      err?.response?.data?.error ||
      err?.message ||
      'Failed to verify OTP, please try again'
    toast.error(verifyError)
  }
}

const uploadDocumentForClinic = async (uid, file, documentKey, onProgress = () => {}) => {
  if (!file) return null
  const safeName = `${Date.now()}-${String(file.name || 'document').replace(/\s+/g, '_')}`
  const filePath = `clinic-registration/${uid}/${documentKey}/${safeName}`
  const fileRef = storageRef(storage, filePath)

  const snapshot = await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file)
    task.on(
      'state_changed',
      (snap) => {
        const percent = snap.totalBytes
          ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          : 0
        onProgress(percent)
      },
      reject,
      () => resolve(task.snapshot)
    )
  })

  const url = await getDownloadURL(snapshot.ref)
  return {
    name: file.name || '',
    size: file.size || 0,
    type: file.type || '',
    url,
    path: filePath,
    uploadedAt: new Date().toISOString(),
  }
}

const submitDocuments = async () => {
  if (currentStep.value !== 3) return

  if (!allDocumentsUploaded.value) {
    toast.error('Please upload all required documents.')
    return
  }

  if (!userUid.value) {
    toast.error('User ID not found. Please restart registration.')
    return
  }

  if (hasAnyDocumentUploadInProgress.value) {
    toast.info('Please wait for the current upload to finish.')
    return
  }

  isSubmittingDocuments.value = true

  try {
    const uploads = await Promise.all(
      requiredDocumentKeys.value.map((docKey) =>
        uploadDocumentForClinic(userUid.value, documentFileMap[docKey]?.value, docKey)
      )
    )

    const submittedDocumentsPayload = {}
    requiredDocumentKeys.value.forEach((docKey, index) => {
      const fallbackDoc =
        existingSubmittedDocuments.value[docKey] || { name: '', size: 0, type: '', url: '' }
      const docPayload = uploads[index] || fallbackDoc
      submittedDocumentsPayload[docKey] = docPayload
    })

    await updateDoc(doc(db, 'clinics', userUid.value), {
      approvalStatus: 'Pending Approval',
      documentsSubmittedAt: serverTimestamp(),
      submittedDocuments: submittedDocumentsPayload,
      draftDocuments: deleteField(),
      draftDocumentsUpdatedAt: deleteField(),
    })

    await updateDoc(doc(db, 'users', userUid.value), {
      status: 'Pending Approval',
    })

    existingSubmittedDocuments.value = submittedDocumentsPayload
    syncExistingDocumentPreviews()
    pendingApprovalMode.value = true
    approvalReviewState.value = 'reviewing'
    approvalReviewMessage.value = 'Your registration is under review. Please allow at least 24 hours for admin review.'

    currentStep.value = 4
    setStoredOtpRecipientEmail('')
    stopOtpCountdown()
    toast.success('Documents submitted. Please wait for approval.')
  } catch (err) {
    console.error(err)
    toast.error('Failed to submit documents. Please try again.')
  } finally {
    isSubmittingDocuments.value = false
  }
}
</script>

<template>
  <RegisterCustomer v-if="selectedAccount === 'customer'" />

  <div v-else-if="selectedAccount === 'clinic'" class="min-h-[100dvh] lg:h-screen bg-gradient-to-br from-cream-50 via-cream-100 to-gold-100 overflow-x-hidden no-scrollbar relative">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-gold-200/40 blur-3xl"></div>
      <div class="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cream-300/40 blur-3xl"></div>
    </div>

    <div class="relative z-10 flex items-center justify-center px-4 pt-12 pb-8 lg:pt-10 lg:pb-6 lg:min-h-[100dvh] text-sm">
      <div class="register-clinic-card relative w-full max-w-6xl rounded-3xl overflow-hidden bg-white/68 backdrop-blur-xl border border-gold-200/60 shadow-2xl shadow-gold-900/15 lg:h-[calc(100dvh-5rem)]">
        <div class="compact-desktop register-form-panel relative z-10 flex items-center justify-center h-full px-4 pt-8 pb-8 lg:pt-3 lg:pb-3 sm:px-8">
          <span class="form-side-bubble f-bubble-1 hidden lg:block" aria-hidden="true"></span>
          <span class="form-side-bubble f-bubble-2 hidden lg:block" aria-hidden="true"></span>
          <span class="form-side-bubble f-bubble-3 hidden lg:block" aria-hidden="true"></span>

          <form class="space-y-4 w-full max-w-[560px] pt-3 lg:pt-5" @submit.prevent="registerClinic">
            <div v-if="approvalRedirecting" class="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/60 backdrop-blur">
              <div class="w-[90%] max-w-md rounded-2xl border border-gold-200/80 bg-white/90 p-6 text-center shadow-2xl">
                <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gold-600 border-t-transparent"></div>
                <h3 class="text-lg font-semibold text-charcoal-700">Registration approved</h3>
                <p class="mt-2 text-sm text-charcoal-600">Redirecting you to the login page...</p>
              </div>
            </div>
              <div class="intro-block mb-6">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-gold-300/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-charcoal-700 transition hover:border-gold-500 hover:text-gold-700 hover:bg-gold-50/90"
                  @click="goToRegisterChooser"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h1 class="register-title text-3xl sm:text-4xl leading-tight">Clinic Registration</h1>
                <p class="text-charcoal-600 text-sm mt-1">Step {{ currentStep }} of {{ registrationSteps.length }}: {{ currentStepTitle }}</p>
              </div>

              <div class="registration-stepper">
                <div
                  v-for="(stepLabel, index) in registrationSteps"
                  :key="stepLabel"
                  class="stepper-item"
                  :class="{ 'stepper-item-active': currentStep === index + 1, 'stepper-item-done': currentStep > index + 1 }"
                >
                  <div class="stepper-dot">{{ index + 1 }}</div>
                  <p class="stepper-label">{{ stepLabel }}</p>
                </div>
              </div>

            <transition name="step-slide" mode="out-in" appear>
            <section v-if="currentStep === 1" key="step-1" class="registration-step-panel space-y-4">
            <div class="space-y-2 rounded-2xl border border-gold-200/80 bg-cream-50/80 p-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div class="relative flex-1">
                  <input v-model="email" type="email" required placeholder=" " class="peer input h-16 pt-4 pb-2 px-3" @input="handleEmailDraftInput" />
                  <label class="floating-label">Email Address</label>
                </div>
                <button
                  v-if="!pendingApprovalMode"
                  type="button"
                  :disabled="isCheckingEmail"
                  class="h-12 sm:h-14 px-5 rounded-xl bg-gold-700 text-white font-semibold hover:bg-gold-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  @click="verifyRegistrationEmail"
                >
                  {{ isCheckingEmail ? 'Checking...' : (emailChecked ? 'Re-verify Email' : 'Verify Email') }}
                </button>
              </div>
              <p v-if="pendingApprovalMode" class="text-xs text-charcoal-500">
                This registration is already in the waiting-for-approval stage. OTP re-verification is not required.
              </p>
              <p v-else-if="!emailChecked" class="text-xs text-charcoal-500">
                Verify your email first. If this email has unfinished registration, we will continue from the saved step.
              </p>
              <p v-else class="text-xs font-medium text-emerald-700">
                Email verified.
              </p>
            </div>

            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-charcoal-600">
              Business Details
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="relative">
                <input v-model="firstName" placeholder=" " required class="peer input h-16 pt-4 pb-2 px-3" />
                <label class="floating-label">Business First Name</label>
              </div>
              <div class="relative">
                <input v-model="lastName" placeholder=" " required class="peer input h-16 pt-4 pb-2 px-3" />
                <label class="floating-label">Business Last Name</label>
              </div>
            </div>

            <div class="relative">
              <div ref="calendarRef" class="calendar-wrapper" @click.stop>
                <input
                  v-model="manualBirthDate"
                  type="text"
                  inputmode="numeric"
                  autocomplete="bday"
                  maxlength="10"
                  placeholder="mm/dd/yyyy"
                  class="peer input h-16 pt-4 pb-2 px-3 pr-12 text-left birth-display"
                  :class="{ 'birth-display-active': calendarLabelActive, 'input-error': birthDateError }"
                  @input="handleManualBirthInput"
                  @blur="handleManualBirthBlur"
                />
                <label class="floating-label birth-floating-label">Birth Date</label>
                <button type="button" @click.stop="toggleCalendar"
                  class="calendar-toggle absolute right-4 top-1/2 -translate-y-1/2 text-charcoal-700 hover:text-gold-700">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                  </svg>
                </button>

                <transition name="calendar-fade">
                  <div v-if="calendarOpen" class="calendar-popover">
                    <div class="calendar-header">
                      <button type="button" @click="previousMonth" class="calendar-nav-btn" aria-label="Previous month">&#8249;</button>
                      <div class="calendar-select-group">
                        <div class="calendar-select-wrap">
                          <button type="button" class="calendar-select" @click="toggleMonthMenu" :aria-expanded="monthMenuOpen">
                            {{ selectedMonthLabel }}
                          </button>
                          <div v-if="monthMenuOpen" class="calendar-menu">
                            <button
                              v-for="(month, index) in monthNames"
                              :key="month"
                              type="button"
                              class="calendar-menu-item"
                              :class="{ 'calendar-menu-item-active': index === calendarMonth }"
                              @click="selectMonth(index)"
                            >
                              {{ month }}
                            </button>
                          </div>
                        </div>

                        <div class="calendar-select-wrap">
                          <button type="button" class="calendar-select calendar-year-select" @click="toggleYearMenu" :aria-expanded="yearMenuOpen">
                            {{ calendarYear }}
                          </button>
                          <div v-if="yearMenuOpen" class="calendar-menu calendar-menu-year">
                            <button
                              v-for="year in yearOptions"
                              :key="year"
                              type="button"
                              class="calendar-menu-item"
                              :class="{ 'calendar-menu-item-active': year === calendarYear }"
                              @click="selectYear(year)"
                            >
                              {{ year }}
                            </button>
                          </div>
                        </div>
                      </div>
                      <button type="button" @click="nextMonth" class="calendar-nav-btn" aria-label="Next month">&#8250;</button>
                    </div>
                    <div class="calendar-weekdays">
                      <span v-for="day in weekDays" :key="day">{{ day }}</span>
                    </div>
                    <div class="calendar-grid">
                      <button
                        v-for="dayObj in calendarDays"
                        :key="dayObj.iso"
                        type="button"
                        :disabled="isFutureDate(dayObj)"
                        @click="selectDate(dayObj)"
                        class="calendar-day"
                        :class="{
                          'calendar-day-other': !dayObj.inCurrentMonth,
                          'calendar-day-selected': isSelectedDate(dayObj),
                          'calendar-day-today': isToday(dayObj) && !isSelectedDate(dayObj),
                          'calendar-day-disabled': isFutureDate(dayObj),
                        }"
                      >
                        {{ dayObj.day }}
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
              <p v-if="birthDateError" class="mt-1 text-xs text-red-600">{{ birthDateError }}</p>
            </div>

            <div v-if="requiresPasswordForStep1" class="relative">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="relative">
                  <input :type="passwordVisible ? 'text' : 'password'" v-model="password" required maxlength="32" placeholder=" " class="peer input h-16 pt-4 pb-2 px-3" @focus="passwordFocused = true" @blur="passwordFocused = false" />
                  <label class="floating-label">Password</label>
                  <button type="button" @click="togglePassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 hover:text-gold-700" tabindex="-1">
                    <svg v-if="!passwordVisible" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.956 9.956 0 012.1-3.592M6.18 6.18A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>

                <div class="relative">
                  <input :type="confirmPasswordVisible ? 'text' : 'password'" v-model="confirmPassword" required maxlength="32" placeholder=" " class="peer input h-16 pt-4 pb-2 px-3" @focus="confirmPasswordFocused = true" @blur="confirmPasswordFocused = false" />
                  <label class="floating-label">Confirm Password</label>
                  <button type="button" @click="toggleConfirmPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 hover:text-gold-700" tabindex="-1">
                    <svg v-if="!confirmPasswordVisible" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.956 9.956 0 012.1-3.592M6.18 6.18A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>

              <transition name="password-guide-fade">
                <div v-if="showPasswordRequirements" class="password-guide-popover rounded-xl border border-gold-200/80 bg-cream-50/95 px-4 py-3 shadow-[0_12px_26px_rgba(58,36,22,0.14)]">
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700 mb-2">Password Requirements</p>
                <ul class="space-y-1.5 text-xs sm:text-sm">
                  <li class="flex items-center gap-2" :class="passwordChecks.length ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="passwordChecks.length ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="passwordChecks.length" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>8-32 characters</span>
                  </li>
                  <li class="flex items-center gap-2" :class="passwordChecks.uppercase ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="passwordChecks.uppercase ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="passwordChecks.uppercase" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>At least 1 uppercase letter (A-Z)</span>
                  </li>
                  <li class="flex items-center gap-2" :class="passwordChecks.lowercase ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="passwordChecks.lowercase ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="passwordChecks.lowercase" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>At least 1 lowercase letter (a-z)</span>
                  </li>
                  <li class="flex items-center gap-2" :class="passwordChecks.number ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="passwordChecks.number ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="passwordChecks.number" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>At least 1 number (0-9)</span>
                  </li>
                  <li class="flex items-center gap-2" :class="passwordChecks.special ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="passwordChecks.special ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="passwordChecks.special" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>At least 1 special character (@$!%*?&)</span>
                  </li>
                  <li class="flex items-center gap-2" :class="confirmPasswordMatches ? 'text-emerald-700' : 'text-charcoal-500'">
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border" :class="confirmPasswordMatches ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-cream-100 border-gold-200 text-gold-700'">
                      <svg v-if="confirmPasswordMatches" class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.42l2.293 2.294 6.493-6.494a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                      <span v-else class="h-1.5 w-1.5 rounded-full bg-current"></span>
                    </span>
                    <span>Passwords match</span>
                  </li>
                </ul>
                </div>
              </transition>
            </div>
            <p v-else class="text-xs rounded-lg border border-gold-200/70 bg-white/55 px-3 py-2 text-charcoal-600">
              Password is already set for this account. You can edit profile details without OTP/password re-entry.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="relative">
                <input v-model="clinicName" placeholder=" " required class="peer input h-16 pt-4 pb-2 px-3" />
                <label class="floating-label">Clinic Name</label>
              </div>
              <div class="relative">
                <label for="clinic-location" class="floating-label floating-label-raised">Clinic Location (Cavite Only)</label>
                <button
                  id="clinic-location"
                  type="button"
                  class="input custom-dropdown-trigger h-16 pt-4 pb-2 px-3 pr-10 text-left"
                  :class="{ 'custom-dropdown-placeholder': !clinicLocation }"
                  @click="openLocationModal"
                >
                  {{ selectedClinicLocationLabel }}
                </button>
                <Icon
                  icon="mdi:map-marker-outline"
                  class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-charcoal-700"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="relative">
                <input :value="clinicFullAddressLabel" readonly class="input h-16 pt-4 pb-2 px-3 bg-cream-50/70 text-charcoal-700" />
                <label class="floating-label floating-label-raised">Full Address</label>
                <p v-if="!clinicLocationAddress" class="mt-1 text-xs text-charcoal-500">
                  Address will be filled after pinning the clinic location.
                </p>
              </div>
              <div class="relative">
                <input :value="clinicBarangay" readonly class="input h-16 pt-4 pb-2 px-3 bg-cream-50/70 text-charcoal-700" />
                <label class="floating-label floating-label-raised">Barangay</label>
              </div>
              <div class="relative">
                <input :value="clinicProvince" readonly class="input h-16 pt-4 pb-2 px-3 bg-cream-50/70 text-charcoal-700" />
                <label class="floating-label floating-label-raised">Province</label>
              </div>
              <div class="relative">
                <input
                  v-model="clinicPostalCode"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder=" "
                  @input="sanitizePostalCodeInput"
                  class="peer input h-16 pt-4 pb-2 px-3"
                />
                <label class="floating-label">Postal Code</label>
              </div>
            </div>

            <div class="relative">
              <div class="flex items-center rounded-xl border border-[rgba(232,167,58,0.35)] bg-white/45 focus-within:border-gold-700">
                <span class="inline-flex items-center px-3 text-charcoal-700 select-none">+63</span>
                <input
                  v-model="contactNumber"
                  type="tel"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="10"
                  placeholder=" "
                  required
                  class="peer flex-1 h-16 pt-4 pb-2 px-3 bg-transparent text-charcoal-700 placeholder-transparent focus:outline-none"
                  @input="sanitizeContactNumber"
                />
                <label class="floating-label contact-label">Business Contact Number</label>
              </div>
            </div>

            <label class="terms-row flex items-center gap-2 text-charcoal-600 text-sm">
              <input type="checkbox" v-model="termsAccepted" required class="accent-gold-700" />
              I agree to the
              <a href="#" @click.prevent="showTerms = true" class="text-gold-700 hover:underline">Terms &amp; Conditions</a>
              and
              <a href="#" @click.prevent="showPrivacy = true" class="text-gold-700 hover:underline">Privacy Policy</a>
            </label>

            <div class="cta-row flex gap-3">
              <button
                type="button"
                :disabled="isSubmitting || !emailChecked"
                @click="registerClinic"
                class="h-14 lg:h-12 flex-1 py-3 rounded-xl bg-gold-700 text-white font-semibold text-base hover:bg-gold-800 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {{ isSubmitting ? 'Processing...' : 'Next: OTP Verification' }}
              </button>
            </div>
            </section>
            </transition>

            <transition name="step-slide" mode="out-in" appear>
            <section v-if="currentStep === 2" key="step-2" class="registration-step-panel space-y-5">
                <div class="space-y-1">
                  <p class="text-sm text-charcoal-600">
                    We've sent a One-Time Password (OTP) to your email. Please enter it below to continue.
                  </p>
                  <p v-if="otpRecipientLabel" class="text-xs text-charcoal-500">
                    Sent to {{ otpRecipientLabel }}. Check spam or promotions if it does not appear in your inbox.
                  </p>
                </div>

              <div class="otp-boxes">
                <input
                  v-for="(_, index) in OTP_LENGTH"
                  :key="`clinic-otp-${index}`"
                  :ref="(el) => setOtpInputRef(el, index)"
                  v-model="otpDigits[index]"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  maxlength="1"
                  autocomplete="one-time-code"
                  class="otp-digit"
                  :class="{ 'otp-digit-filled': otpDigits[index] }"
                  @input="handleOtpInput(index, $event)"
                  @keydown="handleOtpKeydown(index, $event)"
                  @paste="handleOtpPaste"
                />
              </div>

              <div class="flex flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                <p class="text-charcoal-500">
                  <span v-if="!otpCanResend">Resend available in <span class="font-semibold text-gold-700">{{ otpCountdownLabel }}</span></span>
                  <span v-else>You can request a new OTP now.</span>
                </p>
                <button
                  type="button"
                  class="font-semibold transition"
                  :class="otpCanResend ? 'text-gold-700 hover:text-gold-800' : 'text-charcoal-400 cursor-not-allowed'"
                  :disabled="!otpCanResend"
                  @click="resendOtp"
                >
                  Resend OTP
                </button>
              </div>

              <div class="flex gap-3">
                <button
                  type="button"
                  class="h-12 px-5 rounded-xl border border-gold-300 text-charcoal-700 font-medium hover:bg-gold-100/70 transition"
                  @click="currentStep = 1"
                >
                  Back
                </button>
                <button
                  type="button"
                  @click="verifyOtp"
                  class="flex-1 py-3 rounded-xl bg-gold-700 text-white font-semibold text-base hover:bg-gold-800 hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  Verify OTP and Continue
                </button>
              </div>
            </section>
            </transition>

            <transition name="step-slide" mode="out-in" appear>
            <section v-if="currentStep === 3" key="step-3" class="registration-step-panel space-y-4">
              <p class="text-sm text-charcoal-600">
                Upload your required documents for legitimacy checks before approval.
              </p>

              <div class="upload-grid">
                <div class="upload-row">
                  <details class="upload-row-header">
                    <summary class="upload-accordion-summary">
                      <span>Accepted Government-Issued IDs</span>
                      <span class="upload-accordion-caret" aria-hidden="true"></span>
                    </summary>
                    <p class="text-xs text-charcoal-500">
                      Upload the front and back of any one accepted government-issued ID listed below.
                    </p>
                    <div class="upload-accordion-columns">
                      <ul v-for="(column, columnIndex) in acceptedGovernmentIdColumns" :key="`gov-id-column-${columnIndex}`" class="upload-accordion-list">
                        <li v-for="option in column" :key="option">{{ option }}</li>
                      </ul>
                    </div>
                  </details>
                  <div class="upload-card">
                    <p class="upload-label">{{ documentLabelMap.governmentIdRepresentativeFront }}</p>
                    <input :key="documentInputKeys.governmentIdRepresentativeFront" type="file" accept=".pdf,image/*" @change="handleDocumentFileChange('governmentIdRepresentativeFront', $event)" class="upload-input" />
                    <img
                      v-if="documentPreviewUrls.governmentIdRepresentativeFront"
                      :src="documentPreviewUrls.governmentIdRepresentativeFront"
                      :alt="`${documentLabelMap.governmentIdRepresentativeFront} Preview`"
                      class="upload-preview-image"
                    />
                    <p class="upload-file-name">
                      {{ documentFileMap.governmentIdRepresentativeFront?.value?.name || existingSubmittedDocuments.governmentIdRepresentativeFront?.name || 'No file selected' }}
                    </p>
                    <div v-if="documentUploadState.governmentIdRepresentativeFront.uploading" class="mt-3 space-y-1">
                      <div class="flex items-center justify-between text-[11px] text-charcoal-500">
                        <span>Uploading...</span>
                        <span>{{ documentUploadState.governmentIdRepresentativeFront.progress || 0 }}%</span>
                      </div>
                      <div class="h-2 overflow-hidden rounded-full bg-gold-100">
                        <div
                          class="h-full rounded-full bg-gold-600 transition-all duration-200"
                          :style="{ width: `${documentUploadState.governmentIdRepresentativeFront.progress || 0}%` }"
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div class="upload-card">
                    <p class="upload-label">{{ documentLabelMap.governmentIdRepresentativeBack }}</p>
                    <input :key="documentInputKeys.governmentIdRepresentativeBack" type="file" accept=".pdf,image/*" @change="handleDocumentFileChange('governmentIdRepresentativeBack', $event)" class="upload-input" />
                    <img
                      v-if="documentPreviewUrls.governmentIdRepresentativeBack"
                      :src="documentPreviewUrls.governmentIdRepresentativeBack"
                      :alt="`${documentLabelMap.governmentIdRepresentativeBack} Preview`"
                      class="upload-preview-image"
                    />
                    <p class="upload-file-name">
                      {{ documentFileMap.governmentIdRepresentativeBack?.value?.name || existingSubmittedDocuments.governmentIdRepresentativeBack?.name || 'No file selected' }}
                    </p>
                    <div v-if="documentUploadState.governmentIdRepresentativeBack.uploading" class="mt-3 space-y-1">
                      <div class="flex items-center justify-between text-[11px] text-charcoal-500">
                        <span>Uploading...</span>
                        <span>{{ documentUploadState.governmentIdRepresentativeBack.progress || 0 }}%</span>
                      </div>
                      <div class="h-2 overflow-hidden rounded-full bg-gold-100">
                        <div
                          class="h-full rounded-full bg-gold-600 transition-all duration-200"
                          :style="{ width: `${documentUploadState.governmentIdRepresentativeBack.progress || 0}%` }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-for="docKey in documentKeysExcludingGovId"
                  :key="docKey"
                  class="upload-card"
                >
                  <p class="upload-label">{{ documentLabelMap[docKey] || docKey }}</p>
                  <input :key="documentInputKeys[docKey]" type="file" accept=".pdf,image/*" @change="handleDocumentFileChange(docKey, $event)" class="upload-input" />
                  <img
                    v-if="documentPreviewUrls[docKey]"
                    :src="documentPreviewUrls[docKey]"
                    :alt="`${documentLabelMap[docKey] || docKey} Preview`"
                    class="upload-preview-image"
                  />
                  <p class="upload-file-name">
                    {{ documentFileMap[docKey]?.value?.name || existingSubmittedDocuments[docKey]?.name || 'No file selected' }}
                  </p>
                  <div v-if="documentUploadState[docKey]?.uploading" class="mt-3 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-charcoal-500">
                      <span>Uploading...</span>
                      <span>{{ documentUploadState[docKey]?.progress || 0 }}%</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-gold-100">
                      <div
                        class="h-full rounded-full bg-gold-600 transition-all duration-200"
                        :style="{ width: `${documentUploadState[docKey]?.progress || 0}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button
                  type="button"
                  class="h-12 px-5 rounded-xl border border-gold-300 text-charcoal-700 font-medium hover:bg-gold-100/70 transition"
                  @click="currentStep = otpVerifiedForRegistration ? 1 : 2"
                >
                  Back
                </button>
                <button
                  type="button"
                  :disabled="isSubmittingDocuments || hasAnyDocumentUploadInProgress"
                  class="flex-1 h-12 px-5 rounded-xl bg-gold-700 text-white font-semibold hover:bg-gold-800 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  @click="submitDocuments"
                >
                  {{ isSubmittingDocuments ? 'Submitting...' : (hasAnyDocumentUploadInProgress ? 'Finish Uploads First' : 'Submit Documents') }}
                </button>
              </div>
            </section>
            </transition>

            <transition name="step-slide" mode="out-in" appear>
            <section v-if="currentStep === 4" key="step-4" class="registration-step-panel space-y-4 rounded-2xl border border-gold-200/80 bg-cream-50/80 p-6">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-xl font-semibold text-charcoal-700">Registration Status</h2>
                  <p class="mt-1 text-sm text-charcoal-600">
                    {{ approvalReviewMessage }}
                  </p>
                </div>
                <Icon :icon="approvalStateIcon" class="h-10 w-10 shrink-0" :class="approvalStateIconTone" aria-hidden="true" />
              </div>

              <div v-if="isApprovalUnderReview" class="rounded-2xl border border-gold-200 bg-white/70 p-4 text-sm text-charcoal-600">
                We are still waiting on the platform admin. You do not need to refresh this page, and this step will update automatically once a decision is made.
              </div>

              <div v-else-if="isApprovalApproved" class="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800">
                Your clinic has been approved. You will be redirected to the login page shortly.
              </div>

              <div v-else-if="isApprovalRejected" class="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800 space-y-2">
                <p>Your registration was rejected.</p>
                <p class="text-rose-700/90">
                  Reason: {{ approvalReviewReason || 'Please contact support if you want to ask about the decision or submit a new registration.' }}
                </p>
                <div class="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    class="h-11 rounded-xl border border-rose-200 bg-white px-4 font-semibold text-rose-700 transition hover:bg-rose-100"
                    @click="resetClinicRegistrationFlow"
                  >
                    Start New Registration
                  </button>
                  <button
                    type="button"
                    class="h-11 rounded-xl bg-rose-700 px-4 font-semibold text-white transition hover:bg-rose-800"
                    @click="router.push('/login')"
                  >
                    Go to Login
                  </button>
                </div>
              </div>
            </section>
            </transition>
          </form>
        </div>

        <div class="register-visual register-visual-pane relative items-center justify-center h-full overflow-hidden">
          <div class="visual-orb orb-1"></div>
          <div class="visual-orb orb-2"></div>
          <div class="visual-orb orb-3"></div>

          <div class="device-stack">
            <div class="device-layer layer-3"></div>
            <div class="device-layer layer-2"></div>
            <div class="device-layer layer-1"></div>
            <div class="device-top">
              <div class="device-chip"></div>
            </div>
          </div>

          <div class="space-dot dot-1"></div>
          <div class="space-dot dot-2"></div>
          <div class="space-dot dot-3"></div>
          <div class="space-comet comet-1"></div>
          <div class="space-comet comet-2"></div>
          <div class="side-bubble bubble-1"></div>
          <div class="side-bubble bubble-2"></div>
          <div class="side-bubble bubble-3"></div>
          <div class="side-bubble bubble-4"></div>
          <div class="side-bubble bubble-5"></div>
          <div class="side-bubble bubble-6"></div>
        </div>
      </div>

      <Modal panelClass="bg-white" :isOpen="showTerms" :title="'Terms and Conditions'" @close="showTerms = false" :showConfirm="false">
        <Terms />
      </Modal>
      <Modal panelClass="bg-white" :isOpen="showPrivacy" :title="'Privacy Policy'" @close="showPrivacy = false" :showConfirm="false">
        <PrivacyPolicy />
      </Modal>

      <Modal
        panelClass="bg-cream-50 border border-gold-200/80 w-full max-w-4xl shadow-2xl shadow-gold-900/15"
        bodyClass="location-modal-body"
        :isOpen="showLocationModal"
      :title="'Select Clinic Location'"
      @close="closeLocationModal"
      :showConfirm="false"
      >
        <div class="space-y-4">
          <div class="rounded-2xl border border-gold-200/80 bg-cream-100 p-4 shadow-[0_10px_24px_rgba(54,34,22,0.06)]">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">Search location</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="locationSearchQuery"
                type="text"
                class="w-full rounded-xl border border-gold-200/80 bg-white px-4 py-3 text-charcoal-700 outline-none placeholder:text-charcoal-400 focus:border-gold-400 focus:ring-4 focus:ring-gold-200/30"
                placeholder="Search a city, barangay, or address"
                @keyup.enter.prevent="searchLocation"
              />
              <button
                type="button"
                class="rounded-xl bg-gold-700 px-5 py-3 font-semibold text-white transition hover:bg-gold-800"
                @click="searchLocation"
              >
                Search
              </button>
            </div>
            <p class="mt-2 text-xs text-charcoal-500">Search first, then fine-tune the exact spot by dragging or clicking the pin.</p>
          </div>
          <div ref="locationMapCanvas" class="w-full h-[380px] rounded-2xl border border-gold-200/80 bg-cream-100 shadow-[0_12px_28px_rgba(54,34,22,0.08)] overflow-hidden"></div>
          <div
            v-if="locationError"
            class="rounded-2xl border px-4 py-3 shadow-lg"
            :class="isOutsideCaviteLocationError ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'"
          >
            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                :class="isOutsideCaviteLocationError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'"
              >
                <Icon :icon="isOutsideCaviteLocationError ? 'mdi:map-marker-off-outline' : 'mdi:alert-circle-outline'" class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p
                  class="text-sm font-semibold uppercase tracking-[0.14em]"
                  :class="isOutsideCaviteLocationError ? 'text-rose-700' : 'text-amber-700'"
                >
                  {{ locationErrorTitle }}
                </p>
                <p class="mt-1 text-sm text-charcoal-700">{{ locationError }}</p>
                <p class="mt-2 text-xs text-charcoal-500">{{ locationErrorHint }}</p>
              </div>
            </div>
          </div>
          <div class="rounded-2xl border border-gold-200/80 bg-gradient-to-br from-cream-100 to-gold-100 p-4 space-y-3 shadow-[0_10px_24px_rgba(54,34,22,0.06)]">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">Pinned Full Address</p>
              <p class="mt-1 text-sm text-charcoal-700">{{ modalPinnedAddressLabel }}</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p class="text-gold-700/80 text-xs uppercase tracking-wide">Barangay</p>
                <p class="mt-1 text-charcoal-700">{{ clinicBarangay || '-' }}</p>
              </div>
              <div>
                <p class="text-gold-700/80 text-xs uppercase tracking-wide">City/Municipality</p>
                <p class="mt-1 text-charcoal-700">{{ clinicLocation || '-' }}</p>
              </div>
              <div>
                <p class="text-gold-700/80 text-xs uppercase tracking-wide">Postal Code</p>
                <p class="mt-1 text-charcoal-700">{{ clinicPostalCode || '-' }}</p>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-lg border border-gold-300 bg-cream-100 text-charcoal-700 hover:bg-cream-200 transition"
              @click="closeLocationModal"
            >
              Close
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white"
              @click="usePinnedLocation"
            >
              Use Pin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  </div>

  <div v-else class="min-h-[100dvh] bg-gradient-to-br from-cream-50 via-cream-100 to-gold-100 overflow-hidden relative">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl"></div>
      <div class="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cream-300/40 blur-3xl"></div>
    </div>

    <nav class="sticky top-0 inset-x-0 z-50 bg-gradient-to-r from-cream-50/95 via-cream-100/95 to-gold-50/95 backdrop-blur-md border-b border-gold-200/70 shadow-[0_6px_18px_rgba(54,34,22,0.08)]">
      <div class="relative max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button
          type="button"
          @click="goToHome"
          class="flex items-center gap-2 text-charcoal-700 hover:text-gold-700 transition-colors rounded-md px-2 py-1 hover:bg-gold-100/70"
        >
          <svg class="hidden lg:block w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <svg class="w-5 h-5 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10.5l9-7 9 7M5.25 9.75V20.25H18.75V9.75" />
          </svg>
        </button>

        <span class="nav-brand absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg sm:text-xl tracking-wide">AesthetiCare</span>
        <div class="w-8"></div>
      </div>
    </nav>

    <main class="relative z-10 min-h-[100dvh] px-4 pt-24 pb-10 flex items-center justify-center">
      <section class="w-full max-w-5xl rounded-[2rem] border border-amber-100 bg-[rgba(255,255,255,0.88)] shadow-xl shadow-amber-900/10 overflow-hidden">
        <div class="p-8 sm:p-10 lg:p-12">
            <p class="text-xs uppercase tracking-[0.28em] text-[#a56b44] font-semibold">Create Your Account</p>
            <h1 class="register-title mt-3 text-4xl sm:text-5xl leading-tight text-[#4a2c1e]">Choose how you want to register.</h1>
            <p class="mt-4 max-w-2xl text-sm sm:text-base text-charcoal-600">
              Start with the account type that fits you. Customers can create a personal account, while clinic admins can continue with clinic onboarding and verification.
            </p>

            <div class="mt-8 grid gap-4 lg:grid-cols-2">
              <button type="button" class="choice-card" @click="chooseCustomer">
                <div class="choice-art choice-art-customer" aria-hidden="true">
                  <svg viewBox="0 0 240 160" class="choice-illustration" role="img" aria-label="">
                    <defs>
                      <linearGradient id="customerBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fff7ee" />
                        <stop offset="100%" stop-color="#f1dcc0" />
                      </linearGradient>
                      <filter id="customerShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#8c5a3a" flood-opacity="0.12" />
                      </filter>
                    </defs>
                    <rect x="24" y="22" width="192" height="116" rx="28" fill="url(#customerBg)" filter="url(#customerShadow)" />
                    <circle cx="52" cy="42" r="14" fill="#f3cfa8" opacity="0.38" />
                    <circle cx="190" cy="40" r="10" fill="#e2b989" opacity="0.24" />
                    <circle cx="184" cy="114" r="12" fill="#d9a87b" opacity="0.18" />
                    <circle cx="112" cy="62" r="18" fill="#fffaf3" stroke="#7b4e35" stroke-width="4.5" />
                    <path d="M84 108c5-15 16-25 28-25s23 10 28 25" fill="none" stroke="#7b4e35" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
                    <rect x="142" y="40" width="42" height="46" rx="11" fill="#fffaf3" stroke="#c99673" stroke-width="3.5" />
                    <path d="M150 49h26M150 59h18M150 69h22" stroke="#d8b59c" stroke-width="3.3" stroke-linecap="round" />
                    <rect x="38" y="86" width="52" height="22" rx="9" fill="#fffaf3" stroke="#c99673" stroke-width="3.5" />
                    <path d="M48 97h16" stroke="#9f6946" stroke-width="3.2" stroke-linecap="round" />
                    <path d="M94 92c4 4 11 7 18 7s14-3 18-7" fill="none" stroke="#9f6946" stroke-width="3.2" stroke-linecap="round" />
                    <path d="M40 44c0 6-4 10-10 10" fill="none" stroke="#d8b59c" stroke-width="3" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="choice-body">
                  <p class="choice-kicker">Personal Access</p>
                  <h2 class="choice-title">Register as Customer</h2>
                  <p class="choice-copy">Create your account to browse clinics, book appointments, and manage your profile.</p>
                </div>
                <span class="choice-cta">Continue</span>
              </button>

              <button type="button" class="choice-card" @click="chooseClinic">
                <div class="choice-art choice-art-clinic" aria-hidden="true">
                  <svg viewBox="0 0 240 160" class="choice-illustration" role="img" aria-label="">
                    <defs>
                      <linearGradient id="clinicBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fff7ee" />
                        <stop offset="100%" stop-color="#ecd0a7" />
                      </linearGradient>
                      <linearGradient id="clinicRoof" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#c99673" />
                        <stop offset="100%" stop-color="#9f6946" />
                      </linearGradient>
                      <filter id="clinicShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#8c5a3a" flood-opacity="0.12" />
                      </filter>
                    </defs>
                    <rect x="24" y="22" width="192" height="116" rx="28" fill="url(#clinicBg)" filter="url(#clinicShadow)" />
                    <rect x="78" y="34" width="84" height="70" rx="18" fill="#fffaf3" stroke="#c99673" stroke-width="4" />
                    <path d="M120 24l18 14h-36z" fill="url(#clinicRoof)" />
                    <path d="M98 48h44" stroke="#c99673" stroke-width="3.5" stroke-linecap="round" />
                    <rect x="95" y="56" width="14" height="14" rx="3" fill="#d8b59c" />
                    <rect x="113" y="56" width="14" height="14" rx="3" fill="#c99673" />
                    <rect x="131" y="56" width="14" height="14" rx="3" fill="#d8b59c" />
                    <rect x="95" y="74" width="14" height="14" rx="3" fill="#c99673" />
                    <rect x="113" y="74" width="14" height="14" rx="3" fill="#d8b59c" />
                    <rect x="131" y="74" width="14" height="14" rx="3" fill="#c99673" />
                    <path d="M101 101h38" stroke="#7b4e35" stroke-width="4" stroke-linecap="round" />

                    <rect x="38" y="104" width="50" height="22" rx="9" fill="#fffaf3" stroke="#c99673" stroke-width="3.5" />
                    <path d="M50 115h14" stroke="#9f6946" stroke-width="3.2" stroke-linecap="round" />

                    <circle cx="184" cy="98" r="13" fill="#fffaf3" stroke="#c99673" stroke-width="4" />
                    <path d="M184 91v14" stroke="#9f6946" stroke-width="3.2" stroke-linecap="round" />
                    <path d="M177 98h14" stroke="#9f6946" stroke-width="3.2" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="choice-body">
                  <p class="choice-kicker">Business Access</p>
                  <h2 class="choice-title">Register as Clinic Admin</h2>
                  <p class="choice-copy">Continue with clinic registration, account verification, and document submission for approval.</p>
                </div>
                <span class="choice-cta">Continue</span>
              </button>
            </div>

            <p class="mt-6 text-sm text-charcoal-600">
              Already have an account?
              <router-link to="/login" class="font-semibold text-gold-700 hover:text-gold-800 underline underline-offset-4">
                Sign in here
              </router-link>
            </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.nav-brand {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: linear-gradient(120deg, #3c2519 0%, #9f6946 42%, #c99673 70%, #744a33 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.register-title {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.choice-card {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.85rem;
  padding: 1.4rem 1.5rem;
  border-radius: 1.4rem;
  border: 1px solid rgba(198, 148, 108, 0.18);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 24px rgba(54, 34, 22, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.choice-card:hover {
  transform: translateY(-2px);
  border-color: rgba(159, 105, 70, 0.3);
  box-shadow: 0 14px 30px rgba(54, 34, 22, 0.09);
}

.choice-body {
  width: 100%;
  text-align: center;
}

.choice-kicker {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #9f6946;
  font-weight: 700;
}

.choice-art {
  width: min(100%, 17.5rem);
  display: flex;
  justify-content: center;
}

.choice-illustration {
  width: 100%;
  max-width: 16.5rem;
  height: auto;
  display: block;
}

.choice-title {
  margin-top: 0.35rem;
  font-size: 1.2rem;
  line-height: 1.35;
  color: #3f281c;
  font-weight: 700;
}

.choice-copy {
  margin-top: 0.45rem;
  font-size: 0.93rem;
  line-height: 1.6;
  color: #6b4a34;
}

.choice-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 7rem;
  height: 2.8rem;
  padding: 0 1rem;
  border-radius: 999px;
  background: #9f6946;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  margin-top: 0.15rem;
}

.business-type-card {
  position: relative;
  display: flex;
  gap: 1.1rem;
  align-items: center;
  text-align: left;
  width: 100%;
  min-height: 140px;
  padding: 1.4rem 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(232, 167, 58, 0.45);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 10px 24px rgba(54, 34, 22, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.business-type-card:hover {
  transform: translateY(-3px);
  border-color: rgba(212, 175, 55, 0.8);
  box-shadow: 0 16px 30px rgba(54, 34, 22, 0.16);
}

.business-type-selected {
  border-color: rgba(159, 105, 70, 0.8);
  background: linear-gradient(160deg, rgba(255, 246, 230, 0.9), rgba(248, 231, 205, 0.85));
  box-shadow: 0 18px 38px rgba(111, 63, 42, 0.2);
}

.business-type-selected::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -10px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #9f6946 0%, #c99673 100%);
  box-shadow: 0 8px 18px rgba(111, 63, 42, 0.25);
}

.business-type-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.9rem;
  border: 1px solid rgba(232, 167, 58, 0.4);
  background: rgba(255, 255, 255, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8c5a3a;
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.business-type-selected .business-type-icon {
  background: #8c5a3a;
  color: #fff;
  transform: scale(1.05);
}

.card-rise-enter-active,
.card-rise-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.card-rise-appear-active {
  transition: opacity 0.34s ease, transform 0.34s ease;
}

.card-rise-enter-from,
.card-rise-appear-from,
.card-rise-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.step-slide-enter-active,
.step-slide-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.step-slide-appear-active {
  transition: opacity 0.32s ease, transform 0.32s ease;
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.step-slide-appear-from {
  opacity: 0;
  transform: translateY(12px);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.registration-step-panel {
  min-height: 23rem;
}

.register-clinic-card {
  display: grid;
  grid-template-columns: 1fr;
}

.register-form-panel {
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.register-form-panel::-webkit-scrollbar {
  display: none;
}

.location-modal-body {
  scrollbar-width: thin;
  scrollbar-color: #c99673 rgba(248, 229, 189, 0.65);
}

.location-modal-body::-webkit-scrollbar {
  width: 0.72rem;
}

.location-modal-body::-webkit-scrollbar-track {
  background: rgba(248, 229, 189, 0.65);
  border-radius: 999px;
}

.location-modal-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 2px solid rgba(248, 229, 189, 0.65);
  background: linear-gradient(180deg, #c99673 0%, #9f6946 100%);
}

.location-modal-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #b8825f 0%, #8c5a3a 100%);
}

.register-visual-pane {
  display: none;
}

.form-side-bubble {
  position: absolute;
  right: 8px;
  border-radius: 999px;
  border: 1px solid rgba(226, 189, 149, 0.52);
  background: radial-gradient(circle at 30% 28%, rgba(255, 250, 241, 0.75), rgba(233, 206, 173, 0.42));
  box-shadow: 0 8px 18px rgba(54, 34, 22, 0.1);
  pointer-events: none;
  z-index: 1;
  animation: bubbleDriftSoft 7s ease-in-out infinite;
}

.f-bubble-1 { width: 44px; height: 44px; top: 22%; animation-delay: 0.5s; }
.f-bubble-2 { width: 58px; height: 58px; top: 48%; right: -2px; animation-delay: 1.4s; }
.f-bubble-3 { width: 40px; height: 40px; top: 74%; right: 12px; animation-delay: 2.1s; }

.register-visual {
  background: radial-gradient(circle at 18% 20%, rgba(230, 193, 150, 0.35), transparent 42%),
    linear-gradient(145deg, #f8e5bd 0%, #e6c196 45%, #c6946c 100%);
  background-size: 140% 140%;
  animation: visualFlow 16s ease-in-out infinite alternate;
  clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%);
}

.visual-orb {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255, 248, 235, 0.34);
  pointer-events: none;
  animation: orbFloat 13s ease-in-out infinite;
}
.orb-1 { width: 360px; height: 360px; top: -140px; right: -120px; }
.orb-2 { width: 280px; height: 280px; bottom: -110px; right: 20px; }
.orb-3 { width: 220px; height: 220px; top: 18%; left: -90px; }

.device-stack {
  position: relative;
  width: min(82%, 420px);
  height: 280px;
  transform: rotate(-12deg);
  z-index: 2;
  animation: stackFloat 6.8s ease-in-out infinite;
}
.device-layer {
  position: absolute;
  left: 40px;
  right: 10px;
  height: 160px;
  border-radius: 22px;
  border: 1px solid rgba(255, 248, 235, 0.42);
  background: linear-gradient(140deg, rgba(255, 248, 235, 0.62), rgba(248, 229, 189, 0.3));
  box-shadow: 0 12px 28px rgba(54, 34, 22, 0.14);
  animation: layerShimmer 5.2s ease-in-out infinite;
}
.layer-1 { top: 92px; }
.layer-2 { top: 122px; left: 58px; opacity: 0.82; }
.layer-3 { top: 152px; left: 76px; opacity: 0.6; }

.device-top {
  position: absolute;
  top: 54px;
  left: 28px;
  right: 0;
  height: 170px;
  border-radius: 24px;
  border: 1px solid rgba(255, 248, 235, 0.62);
  background: linear-gradient(160deg, rgba(255, 248, 235, 0.9), rgba(214, 175, 127, 0.78));
  box-shadow: 0 20px 36px rgba(54, 34, 22, 0.2);
}

.device-chip {
  width: 44px;
  height: 26px;
  border-radius: 12px;
  background: rgba(255, 248, 235, 0.7);
  border: 1px solid rgba(198, 148, 108, 0.36);
  margin: 18px auto 0;
}

.space-dot {
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 248, 235, 0.7);
  border: 1px solid rgba(198, 148, 108, 0.5);
  animation: dotPulse 2.8s ease-in-out infinite;
}
.dot-1 { width: 14px; height: 14px; top: 70px; left: 50px; }
.dot-2 { width: 10px; height: 10px; bottom: 92px; left: 100px; }
.dot-3 { width: 8px; height: 8px; top: 126px; right: 90px; }

.space-comet {
  position: absolute;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 248, 235, 0), rgba(255, 248, 235, 0.95));
  animation: cometDrift 4.4s ease-in-out infinite;
}
.comet-1 { width: 82px; top: 108px; left: 72px; --comet-rot: -26deg; }
.comet-2 { width: 66px; bottom: 76px; right: 72px; --comet-rot: 24deg; animation-delay: 0.9s; }

.side-bubble {
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255, 248, 235, 0.78);
  background: radial-gradient(circle at 30% 28%, rgba(255, 250, 241, 0.95), rgba(225, 185, 142, 0.75));
  box-shadow: 0 10px 22px rgba(54, 34, 22, 0.16);
  animation: bubbleDrift 6.2s ease-in-out infinite;
  z-index: 3;
}
.bubble-1 { width: 62px; height: 62px; left: 12px; top: 18%; animation-delay: 0s; }
.bubble-2 { width: 46px; height: 46px; left: 36px; top: 38%; animation-delay: 1.2s; }
.bubble-3 { width: 54px; height: 54px; left: 10px; top: 54%; animation-delay: 2s; }
.bubble-4 { width: 68px; height: 68px; left: 18px; top: 70%; animation-delay: 0.6s; }
.bubble-5 { width: 40px; height: 40px; left: 28px; top: 84%; animation-delay: 1.6s; }
.bubble-6 { width: 34px; height: 34px; left: 54px; top: 26%; animation-delay: 2.6s; }

.registration-stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.stepper-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stepper-dot {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 105, 70, 0.45);
  background: rgba(255, 255, 255, 0.72);
  color: #8c5a3a;
  font-size: 0.82rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stepper-label {
  text-align: center;
  font-size: 0.66rem;
  color: #8c5a3a;
  line-height: 1.2;
}

.stepper-item-active .stepper-dot,
.stepper-item-done .stepper-dot {
  background: linear-gradient(120deg, #9f6946 0%, #c99673 100%);
  color: #fff;
  border-color: transparent;
}

.stepper-item-active .stepper-label,
.stepper-item-done .stepper-label {
  color: #6f3f2a;
  font-weight: 600;
}

.upload-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.upload-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.upload-row-header {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.4rem;
  padding: 0.75rem;
  border: 1px solid rgba(232, 167, 58, 0.22);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.7);
}

.upload-accordion-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: #7b4e35;
  font-size: 0.78rem;
  font-weight: 700;
  list-style: none;
}

.upload-accordion-summary::-webkit-details-marker {
  display: none;
}

.upload-accordion-caret {
  width: 0.55rem;
  height: 0.55rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  margin-right: 0.2rem;
}

.upload-row-header[open] .upload-accordion-caret {
  transform: rotate(225deg);
}

.upload-accordion-list {
  margin: 0;
  padding-left: 1rem;
  color: #6f3f2a;
  font-size: 0.76rem;
  display: grid;
  gap: 0.2rem;
  list-style: disc;
}

.upload-accordion-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .upload-row {
    grid-template-columns: 1fr;
  }

  .upload-accordion-columns {
    grid-template-columns: 1fr;
  }
}

.upload-card {
  border: 1px solid rgba(232, 167, 58, 0.34);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.62);
  padding: 0.75rem;
}

.upload-id-type {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.upload-id-label {
  color: #7b4e35;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.upload-select {
  height: 40px;
  border-radius: 0.6rem;
  border: 1px solid rgba(232, 167, 58, 0.45);
  padding: 0 0.7rem;
  font-size: 0.85rem;
  color: #4a2c1e;
  background: rgba(255, 255, 255, 0.9);
}

.upload-label {
  color: #6f3f2a;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.upload-input {
  width: 100%;
  font-size: 0.78rem;
  color: #4f3424;
}

.upload-preview-image {
  margin-top: 0.5rem;
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(232, 167, 58, 0.4);
  object-fit: cover;
  background: rgba(255, 255, 255, 0.75);
}

.upload-file-name {
  margin-top: 0.3rem;
  font-size: 0.72rem;
  color: #7b5943;
  word-break: break-word;
}

.input {
  width: 100%;
  padding: 1rem 1rem 0.5rem;
  line-height: 1.25rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(232, 167, 58, 0.35);
  color: #1c1c1c;
  outline: none;
  transition: all 0.2s;
}
.input:focus {
  border-color: #d4af37;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
}

.custom-dropdown-trigger {
  color: #6b4a34;
  cursor: pointer;
}

.custom-dropdown-trigger:focus {
  border-color: #d4af37;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
}

.custom-dropdown-placeholder {
  color: #9b7a5f;
}

.custom-dropdown-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.45rem);
  z-index: 32;
  max-height: 8.1rem;
  overflow-y: auto;
  border-radius: 0.9rem;
  border: 1px solid rgba(232, 167, 58, 0.4);
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.99), rgba(248, 234, 206, 0.99));
  box-shadow: 0 14px 30px rgba(54, 34, 22, 0.18);
  padding: 0.35rem;
}

.custom-dropdown-option {
  width: 100%;
  border: none;
  border-radius: 0.65rem;
  background: transparent;
  text-align: left;
  color: #6b4a34;
  font-size: 0.92rem;
  line-height: 1.35;
  padding: 0.62rem 0.72rem;
  transition: background 0.18s ease, color 0.18s ease;
}

.custom-dropdown-option:hover {
  background: rgba(255, 245, 228, 0.98);
}

.custom-dropdown-option-active {
  background: linear-gradient(120deg, #9f6946 0%, #c99673 100%);
  color: #fff;
}
.otp-boxes {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
  max-width: 18.75rem;
  margin: 0 auto;
}

.otp-digit {
  height: 2.95rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(214, 186, 152, 0.8);
  background: linear-gradient(180deg, rgba(243, 241, 237, 0.98), rgba(234, 230, 223, 0.95));
  color: #6f3f2a;
  text-align: center;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.14s, background 0.2s;
}

.otp-digit:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 3px rgba(201, 162, 77, 0.22);
  transform: translateY(-1px);
}

.otp-digit-filled {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 237, 226, 0.96));
}

.calendar-wrapper {
  position: relative;
}

.birth-display {
  color: #9b7a5f;
}

.birth-display::placeholder {
  color: #9b7a5f;
  opacity: 1;
}

.birth-display-active {
  color: #6b4a34;
}

.birth-floating-label {
  top: 0.42rem !important;
  transform: translateY(0) !important;
  font-size: 0.72rem !important;
  color: #8c5a3a !important;
}

.input-error,
.input-error:focus {
  border-color: rgba(200, 68, 48, 0.75);
  box-shadow: 0 0 0 3px rgba(200, 68, 48, 0.16);
}

.calendar-toggle {
  z-index: 3;
}

.calendar-popover {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 30;
  border-radius: 0.9rem;
  border: 1px solid rgba(232, 167, 58, 0.35);
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.98), rgba(248, 234, 206, 0.98));
  box-shadow: 0 16px 36px rgba(54, 34, 22, 0.18);
  padding: 0.75rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.calendar-month-title {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: 1rem;
  color: #6f3f2a;
  letter-spacing: 0.02em;
}

.calendar-select-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.calendar-select-wrap {
  position: relative;
}

.calendar-select {
  min-height: 2.1rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(232, 167, 58, 0.4);
  background: rgba(255, 255, 255, 0.72);
  color: #6f3f2a;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.5rem 1.6rem 0.5rem 0.65rem;
  outline: none;
  display: inline-flex;
  align-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  transition: all 0.2s ease;
  background-image:
    linear-gradient(45deg, transparent 50%, #8c5a3a 50%),
    linear-gradient(135deg, #8c5a3a 50%, transparent 50%);
  background-position:
    calc(100% - 12px) calc(50% - 2px),
    calc(100% - 7px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.calendar-select:hover {
  border-color: rgba(212, 175, 55, 0.65);
}

.calendar-select:focus {
  border-color: #d4af37;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.18);
}

.calendar-year-select {
  min-width: 5.4rem;
}

.calendar-menu {
  position: absolute;
  top: calc(100% + 0.32rem);
  left: 0;
  z-index: 35;
  min-width: 100%;
  max-height: 11.5rem;
  overflow-y: auto;
  border-radius: 0.65rem;
  border: 1px solid rgba(232, 167, 58, 0.4);
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.99), rgba(248, 234, 206, 0.99));
  box-shadow: 0 10px 26px rgba(54, 34, 22, 0.2);
  padding: 0.2rem;
}

.calendar-menu-year {
  max-height: 12.5rem;
}

.calendar-menu-item {
  width: 100%;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: #6f3f2a;
  text-align: left;
  font-size: 0.82rem;
  padding: 0.42rem 0.52rem;
  transition: all 0.18s ease;
}

.calendar-menu-item:hover {
  background: rgba(255, 245, 228, 0.95);
}

.calendar-menu-item-active {
  background: linear-gradient(120deg, #9f6946 0%, #c99673 100%);
  color: #fff;
}

.calendar-nav-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid rgba(232, 167, 58, 0.4);
  color: #8c5a3a;
  font-size: 1.35rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.62);
  transition: all 0.2s ease;
}

.calendar-nav-btn:hover {
  background: rgba(255, 245, 228, 0.96);
  color: #6f3f2a;
  border-color: rgba(212, 175, 55, 0.7);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}

.calendar-weekdays span {
  text-align: center;
  font-size: 0.72rem;
  color: #8c5a3a;
  font-weight: 600;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.3rem;
}

.calendar-day {
  height: 2rem;
  border-radius: 0.55rem;
  border: 1px solid transparent;
  color: #6b4a34;
  font-size: 0.82rem;
  background: rgba(255, 255, 255, 0.5);
  transition: all 0.18s ease;
}

.calendar-day:hover {
  border-color: rgba(232, 167, 58, 0.4);
  background: rgba(255, 245, 228, 0.95);
}

.calendar-day-other {
  opacity: 0.45;
}

.calendar-day-today {
  border-color: rgba(212, 175, 55, 0.55);
}

.calendar-day-disabled,
.calendar-day:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.calendar-day-selected {
  background: linear-gradient(120deg, #9f6946 0%, #c99673 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(111, 63, 42, 0.25);
}

.calendar-fade-enter-active,
.calendar-fade-leave-active {
  transition: all 0.2s ease;
}

.calendar-fade-enter-from,
.calendar-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.floating-label {
  position: absolute;
  left: 0.75rem;
  top: 0.34rem;
  font-size: 0.67rem;
  color: #8c5a3a;
  pointer-events: none;
  transition: all 0.2s ease;
}
.peer:placeholder-shown + .floating-label {
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.05rem;
  color: #9b7a5f;
}
.peer:focus + .floating-label,
.peer:not(:placeholder-shown) + .floating-label {
  top: 0.34rem;
  transform: translateY(0);
  font-size: 0.67rem;
  color: #8c5a3a;
}
.floating-label-raised {
  top: 0.38rem !important;
  transform: translateY(0);
  font-size: 0.68rem !important;
  color: #8c5a3a;
}
.contact-label {
  left: 3rem;
}

.terms-row {
  margin-top: 1.15rem !important;
}

.cta-row {
  margin-top: 1.35rem !important;
}

@keyframes visualFlow { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
@keyframes orbFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes stackFloat { 0%,100% { transform: rotate(-12deg) translateY(0); } 50% { transform: rotate(-10deg) translateY(-12px); } }
@keyframes layerShimmer { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.08); } }
@keyframes dotPulse { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.22); } }
@keyframes cometDrift { 0%,100% { opacity: 0.72; transform: translateX(0) rotate(var(--comet-rot, 0deg)); } 50% { opacity: 1; transform: translateX(10px) rotate(var(--comet-rot, 0deg)); } }
@keyframes bubbleDrift { 0%,100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.9; } 50% { transform: translate3d(6px, -12px, 0) scale(1.06); opacity: 1; } }
@keyframes bubbleDriftSoft { 0%,100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.6; } 50% { transform: translate3d(-4px, -8px, 0) scale(1.04); opacity: 0.82; } }

.password-guide-fade-enter-active,
.password-guide-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.password-guide-fade-enter-from,
.password-guide-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.password-guide-popover {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.45rem);
  z-index: 22;
  backdrop-filter: blur(3px);
}

@media (min-width: 1024px) {
  .register-clinic-card {
    grid-template-columns: 60% 40%;
  }
  .register-form-panel {
    align-items: flex-start;
  }
  .register-visual-pane {
    display: flex;
  }
  .compact-desktop .space-y-4 > * + * {
    margin-top: 0.5rem !important;
  }
  .compact-desktop .gap-4 {
    gap: 0.5rem !important;
  }
  .compact-desktop .h-16 {
    height: 3.2rem !important;
  }
  .compact-desktop .input {
    padding-top: 0.95rem !important;
    padding-bottom: 0.4rem !important;
  }
  .compact-desktop .intro-block {
    margin-top: 1.1rem !important;
  }
  .compact-desktop .terms-row {
    margin-top: 1.2rem !important;
  }
  .compact-desktop .cta-row {
    margin-top: 1.45rem !important;
  }
}

@media (max-width: 1023px) {
  .register-visual-pane {
    display: none;
  }
  .register-form-panel {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}

@media (max-width: 640px) {
  .choice-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .choice-art {
    width: min(100%, 16rem);
  }

  .choice-illustration {
    max-width: 100%;
  }

  .choice-cta {
    min-width: 0;
    width: 100%;
  }

  .registration-stepper {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem 0.4rem;
  }
  .stepper-label {
    font-size: 0.64rem;
  }
  .otp-boxes {
    gap: 0.35rem;
    max-width: 100%;
  }
  .otp-digit {
    height: 2.7rem;
    font-size: 1.05rem;
  }
  .calendar-popover {
    padding: 0.65rem;
  }
  .calendar-select-group {
    gap: 0.35rem;
  }
  .calendar-select {
    font-size: 0.78rem;
    padding: 0.45rem 1.3rem 0.45rem 0.52rem;
  }
  .calendar-menu-item {
    font-size: 0.76rem;
  }
  .calendar-year-select {
    min-width: 4.8rem;
  }
  .calendar-day {
    height: 1.85rem;
    font-size: 0.77rem;
  }
}
</style>

