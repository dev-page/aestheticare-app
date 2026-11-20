<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getFirestore, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { deleteApp, getApp, initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { useSubscription } from '@/composables/useSubscription'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { storage } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { employeeSpecialtyTypes, hasPractitionerPermissions } from '../../../../../shared/practitionerTeam.js'
import { builtInRoleTemplates, getTemplatePermissions } from '../../../../../shared/clinicRoleTemplates.js'

const PASSWORD_LENGTH = 12
const PASSWORD_PARTS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%&*?',
}
const PASSWORD_POOL = Object.values(PASSWORD_PARTS).join('')

const generateSecurePassword = (length = PASSWORD_LENGTH) => {
  const cryptoSource = globalThis.crypto
  const randomIndex = (max) => {
    if (cryptoSource?.getRandomValues) {
      const values = new Uint32Array(1)
      cryptoSource.getRandomValues(values)
      return values[0] % max
    }
    return Math.floor(Math.random() * max)
  }

  const passwordChars = [
    PASSWORD_PARTS.uppercase[randomIndex(PASSWORD_PARTS.uppercase.length)],
    PASSWORD_PARTS.lowercase[randomIndex(PASSWORD_PARTS.lowercase.length)],
    PASSWORD_PARTS.digits[randomIndex(PASSWORD_PARTS.digits.length)],
    PASSWORD_PARTS.symbols[randomIndex(PASSWORD_PARTS.symbols.length)],
  ]

  while (passwordChars.length < length) {
    passwordChars.push(PASSWORD_POOL[randomIndex(PASSWORD_POOL.length)])
  }

  for (let index = passwordChars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1)
    ;[passwordChars[index], passwordChars[swapIndex]] = [passwordChars[swapIndex], passwordChars[index]]
  }

  return passwordChars.join('')
}

export default {
  name: 'AddStaff',
  components: { OwnerSidebar, OwnerPageSkeleton, ContractAppearanceSelect },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)
    const branches = ref([])
    const customRoles = ref([])
    const rolesLoading = ref(false)
    const rolesLoadError = ref('')
    const currentOwnerId = ref('')
    const currentBranchIds = ref([])
    const emailCheckingTimer = ref(null)
    let emailLookupSequence = 0
    const emailAvailability = ref('idle')
    const emailAvailabilityMessage = ref('')
    const { initSubscription, activePlan } = useSubscription()

    const currentStaff = ref({
      firstName: '',
      middleName: '',
      lastName: '',
      suffix: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
      customRoleIds: [],
      practitionerType: '',
      engagementType: 'employee',
      employmentType: 'Full-time',
      weeklyHoursTarget: 40,
      userType: 'Staff',
      clinicBranch: '',   // primary branchId, retained for backwards compatibility
      branchIds: [],
      clinicLocation: '',
      status: 'Active'
    })
    const practitionerIdFile = ref(null)
    const practitionerLicenseInput = ref(null)
    const practitionerOcrBusy = ref(false)
    const practitionerOcrResult = ref(null)
    let practitionerOcrSequence = 0
    const savingStaff = ref(false)
    const isStudentIntern = computed(() => currentStaff.value.engagementType === 'student_intern')

    const setEngagementType = (value) => {
      currentStaff.value.engagementType = value === 'student_intern' ? 'student_intern' : 'employee'
      if (currentStaff.value.engagementType === 'student_intern') {
        currentStaff.value.employmentType = 'Intern'
        currentStaff.value.weeklyHoursTarget = ''
      } else {
        currentStaff.value.employmentType = 'Full-time'
        currentStaff.value.weeklyHoursTarget = 40
      }
    }

    const setEmploymentType = (value) => {
      currentStaff.value.employmentType = value
      currentStaff.value.weeklyHoursTarget = value === 'Full-time' ? 40 : ''
    }

    const normalizedPlan = computed(() => String(activePlan.value || '').trim().toLowerCase())
    const isBasicPlan = computed(() => normalizedPlan.value === 'basic')

    // Load branches from Firestore
    const loadBranches = trackPageLoad(async () => {
      loading.value = true
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        currentOwnerId.value = ''
        currentBranchIds.value = []
        loading.value = false
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid
      currentBranchIds.value = scope.branchIds || []

      const clinicDocs = await loadClinicDocsByIds(db, currentBranchIds.value.length ? currentBranchIds.value : [scope.branchId || ''])
      branches.value = clinicDocs.map((entry) => ({
        id: entry.id,
        branch: entry.clinicBranch,
        location: entry.clinicLocation
      }))

      if (isBasicPlan.value && branches.value.length > 0) {
        currentStaff.value.clinicBranch = branches.value[0].id
        currentStaff.value.branchIds = [branches.value[0].id]
        updateLocation()
      }
      loading.value = false
    })

    const loadCustomRoles = trackPageLoad(async (ownerId = currentOwnerId.value) => {
      rolesLoading.value = true
      rolesLoadError.value = ''
      const user = auth.currentUser
      if (!user) {
        customRoles.value = []
        rolesLoading.value = false
        return
      }

      try {
        let resolvedOwnerId = String(ownerId || '').trim()
        if (!resolvedOwnerId) {
          const scope = await loadOwnerBranchScope(db, user.uid)
          resolvedOwnerId = scope.ownerId || user.uid
        }
        currentOwnerId.value = resolvedOwnerId

        const rolesQuery = query(
          collection(db, 'clinicRoles'),
          where('ownerId', '==', resolvedOwnerId)
        )
        let snapshot = await getDocs(rolesQuery)
        const existingBuiltInKeys = new Set(
          snapshot.docs
            .map((roleDoc) => String(roleDoc.data()?.builtinKey || '').trim())
            .filter(Boolean)
        )
        const missingTemplates = builtInRoleTemplates.filter((template) => !existingBuiltInKeys.has(template.key))

        if (missingTemplates.length) {
          await Promise.all(missingTemplates.map((template) => setDoc(
            doc(db, 'clinicRoles', `${resolvedOwnerId}__builtin__${template.key}`),
            {
              ownerId: resolvedOwnerId,
              name: template.name,
              description: template.description,
              color: template.color,
              builtinKey: template.key,
              isBuiltIn: true,
              permissions: getTemplatePermissions(template.suggestion),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          )))
          snapshot = await getDocs(rolesQuery)
        }

        customRoles.value = snapshot.docs
          .map((roleDoc) => {
            const data = roleDoc.data() || {}
            const permissions = Array.isArray(data.permissions)
              ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
              : []

            return {
              id: roleDoc.id,
              name: String(data.name || '').trim(),
              color: String(data.color || '').trim(),
              permissions,
            }
          })
          .filter((role) => role.name && role.permissions.length > 0)
          .sort((left, right) => left.name.localeCompare(right.name))
      } catch (error) {
        console.error('Failed to load employee roles:', error)
        customRoles.value = []
        rolesLoadError.value = 'Roles could not be loaded. Retry before creating an account.'
      } finally {
        rolesLoading.value = false
      }
    })

    let unsubscribeAuth = null
    let isUnmounted = false
    onMounted(trackPageLoad(async () => {
      loading.value = true
      await initSubscription()
      if (isUnmounted) return
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async () => {
        await loadBranches()
        await loadCustomRoles(currentOwnerId.value)
      })
    }))

    const resetForm = () => {
      currentStaff.value = {
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        email: '',
        phoneNumber: '',
        role: '',
        customRoleId: '',
        customRoleIds: [],
        branchIds: [],
        engagementType: 'employee',
        employmentType: 'Full-time',
        weeklyHoursTarget: 40,
        userType: 'Staff',
        clinicBranch: '',
        clinicLocation: '',
        practitionerType: '',
        status: 'Active'
      }
      practitionerIdFile.value = null
      practitionerOcrSequence += 1
      practitionerOcrBusy.value = false
      practitionerOcrResult.value = null
      if (practitionerLicenseInput.value) practitionerLicenseInput.value.value = ''
      if (isBasicPlan.value && branches.value.length > 0) {
        currentStaff.value.clinicBranch = branches.value[0].id
        currentStaff.value.branchIds = [branches.value[0].id]
        updateLocation()
      }
    }

    // Auto-populate clinicLocation when branch is selected
    const updateLocation = () => {
      currentStaff.value.clinicBranch = currentStaff.value.branchIds?.[0] || ''
      const selected = branches.value.find(b => b.id === currentStaff.value.clinicBranch)
      currentStaff.value.clinicLocation = selected ? selected.location : ""
    }

    watch(() => currentStaff.value.customRoleIds, (nextCustomRoleIds) => {
      const ids = Array.isArray(nextCustomRoleIds) ? nextCustomRoleIds : []
      const selectedRoles = customRoles.value.filter((role) => ids.includes(role.id))
      currentStaff.value.customRoleId = ids[0] || ''
      currentStaff.value.role = selectedRoles.map((role) => role.name).join(', ')
    }, { immediate: true, deep: true })

    const selectedCustomRoles = computed(() => {
      const ids = Array.isArray(currentStaff.value.customRoleIds)
        ? currentStaff.value.customRoleIds
        : [currentStaff.value.customRoleId].filter(Boolean)
      return customRoles.value.filter((role) => ids.includes(role.id))
    })

    const sanitizeName = (value) => value.replace(/[^A-Za-z\s]/g, '')
    const sanitizeEmail = (value) => value.replace(/[^A-Za-z0-9@._]/g, '')
    const sanitizePhone = (value) => value.replace(/\D/g, '')

    const handleFirstNameInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.firstName = sanitizeName(value)
    }

    const handleMiddleNameInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.middleName = sanitizeName(value)
    }

    const handleLastNameInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.lastName = sanitizeName(value)
    }

    const handleEmailInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.email = sanitizeEmail(value)
      scheduleEmailCheck()
    }

    const handlePhoneInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.phoneNumber = sanitizePhone(value).slice(0, 10)
    }

    const fieldErrors = computed(() => {
      const errors = {
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        email: '',
        phoneNumber: '',
        role: '',
        clinicBranch: '',
        clinicLocation: '',
        engagementType: '',
        employmentType: '',
        weeklyHoursTarget: '',
        practitionerType: '',
        practitionerId: ''
      }

      const nameRegex = /^[A-Za-z\s]+$/
      const emailRegex = /^[A-Za-z0-9._]+@[A-Za-z0-9._]+\.[A-Za-z]{2,}$/

      if (!currentStaff.value.firstName.trim()) {
        errors.firstName = 'First name is required.'
      } else if (!nameRegex.test(currentStaff.value.firstName.trim())) {
        errors.firstName = 'Only letters and spaces are allowed.'
      }

      // Middle name is optional — validate format only if provided
      if (currentStaff.value.middleName.trim() && !nameRegex.test(currentStaff.value.middleName.trim())) {
        errors.middleName = 'Only letters and spaces are allowed.'
      }

      if (!currentStaff.value.lastName.trim()) {
        errors.lastName = 'Last name is required.'
      } else if (!nameRegex.test(currentStaff.value.lastName.trim())) {
        errors.lastName = 'Only letters and spaces are allowed.'
      }

      // Suffix is optional — validate format only if provided
      if (currentStaff.value.suffix.trim() && !/^[A-Za-z\s.]+$/.test(currentStaff.value.suffix.trim())) {
        errors.suffix = 'Only letters, spaces, and periods are allowed.'
      }

      if (!currentStaff.value.email.trim()) {
        errors.email = 'Email is required.'
      } else if (!emailRegex.test(currentStaff.value.email.trim())) {
        errors.email = 'Use letters, numbers, and @ . _ only.'
      } else if (emailAvailability.value === 'used') {
        errors.email = 'This email is already registered.'
      } else if (emailAvailability.value === 'checking') {
        errors.email = 'Checking email availability...'
      } else if (emailAvailability.value !== 'available') {
        errors.email = 'Wait for the email availability check to finish.'
      }

      if (!currentStaff.value.phoneNumber.trim()) {
        errors.phoneNumber = 'Phone number is required.'
      } else if (currentStaff.value.phoneNumber.length !== 10) {
        errors.phoneNumber = 'Enter a 10-digit mobile number.'
      }

      if (!selectedCustomRoles.value.length) {
        errors.role = 'Select at least one role.'
      }

      if (!currentStaff.value.branchIds?.length) {
        errors.clinicBranch = 'Branch is required.'
      }

      if (!currentStaff.value.clinicLocation.trim()) {
        errors.clinicLocation = 'Clinic location is required.'
      }
      if (!currentStaff.value.employmentType.trim()) {
        errors.employmentType = 'Employment type is required.'
      }
      const weeklyHours = Number(currentStaff.value.weeklyHoursTarget)
      if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 48) {
        errors.weeklyHoursTarget = 'Enter agreed weekly hours from 1 to 48.'
      }
      if (isPractitionerRole.value && !employeeSpecialtyTypes.includes(currentStaff.value.practitionerType)) {
        errors.practitionerType = 'Choose a professional specialty for this Practitioner.'
      }
      if (isPractitionerRole.value && !practitionerIdFile.value) {
        errors.practitionerId = 'Practitioner license image is required.'
      } else if (isPractitionerRole.value && practitionerOcrBusy.value) {
        errors.practitionerId = 'Checking the license name and expiration date...'
      } else if (isPractitionerRole.value && practitionerOcrResult.value?.accepted !== true) {
        errors.practitionerId = practitionerOcrResult.value?.reason || 'Verify the license name and expiration date before creating this account.'
      }

      return errors
    })

    const buildFullName = () => {
      const parts = [currentStaff.value.firstName]
      if (currentStaff.value.middleName.trim()) {
        parts.push(currentStaff.value.middleName)
      }
      parts.push(currentStaff.value.lastName)
      if (currentStaff.value.suffix.trim()) {
        parts.push(currentStaff.value.suffix)
      }
      return parts.join(' ')
    }

    const hasErrors = computed(() => Object.values(fieldErrors.value).some(Boolean))

    const checkEmailAvailability = async (emailValue) => {
      const normalizedEmail = String(emailValue || '').trim().toLowerCase()
      const lookupSequence = ++emailLookupSequence
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        emailAvailability.value = normalizedEmail ? 'invalid' : 'idle'
        emailAvailabilityMessage.value = normalizedEmail ? 'Enter a valid email address.' : ''
        return
      }

      emailAvailability.value = 'checking'
      emailAvailabilityMessage.value = 'Checking email availability...'
      try {
        const response = await fetch(`${OTP_API_BASE}/auth/check-user`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail })
        })
        const result = await response.json().catch(() => null)
        if (lookupSequence !== emailLookupSequence || normalizedEmail !== currentStaff.value.email.trim().toLowerCase()) return
        if (!response.ok || !result) throw new Error(result?.error || 'Email check failed.')
        emailAvailability.value = result.exists ? 'used' : 'available'
        emailAvailabilityMessage.value = result.exists ? 'This email is already registered.' : 'Email is available.'
      } catch (error) {
        if (lookupSequence !== emailLookupSequence) return
        console.error('Failed to check employee email:', error)
        emailAvailability.value = 'error'
        emailAvailabilityMessage.value = 'Unable to check this email right now.'
      }
    }

    const scheduleEmailCheck = () => {
      emailLookupSequence += 1
      emailAvailability.value = 'idle'
      emailAvailabilityMessage.value = ''
      if (emailCheckingTimer.value) clearTimeout(emailCheckingTimer.value)
      const normalizedEmail = currentStaff.value.email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return
      emailCheckingTimer.value = setTimeout(() => checkEmailAvailability(normalizedEmail), 600)
    }

    onUnmounted(() => {
      isUnmounted = true
      unsubscribeAuth?.()
      if (emailCheckingTimer.value) clearTimeout(emailCheckingTimer.value)
    })
    const isPractitionerRole = computed(() =>
      selectedCustomRoles.value.some((role) => /\bpractitioner\b/i.test(String(role.name || '')) || hasPractitionerPermissions(role.permissions))
      || String(currentStaff.value.role || '').toLowerCase() === 'practitioner'
    )
    const showCredentialUpload = computed(() => isPractitionerRole.value)
    watch(isPractitionerRole, (isPractitioner) => {
      if (isPractitioner) return
      practitionerOcrSequence += 1
      practitionerOcrBusy.value = false
      practitionerOcrResult.value = null
      currentStaff.value.practitionerType = ''
      practitionerIdFile.value = null
      if (practitionerLicenseInput.value) practitionerLicenseInput.value.value = ''
    })
    watch(
      () => [currentStaff.value.firstName, currentStaff.value.middleName, currentStaff.value.lastName, currentStaff.value.suffix].map(value => String(value || '').trim()).join('|'),
      () => {
        if (!practitionerOcrBusy.value && !practitionerOcrResult.value) return
        practitionerOcrSequence += 1
        practitionerOcrBusy.value = false
        practitionerOcrResult.value = null
        practitionerIdFile.value = null
        if (practitionerLicenseInput.value) practitionerLicenseInput.value.value = ''
      }
    )
    const selectedCustomRoleName = computed(() => {
      return selectedCustomRoles.value.map((role) => role.name).join(', ')
    })

    const readFileBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
      reader.onerror = () => reject(new Error('Unable to read the selected license image.'))
      reader.readAsDataURL(file)
    })

    const handlePractitionerFile = async (event) => {
      const sequence = ++practitionerOcrSequence
      practitionerOcrBusy.value = false
      practitionerOcrResult.value = null
      if ((event?.target?.files?.length || 0) > 1) {
        toast.error('Select only one practitioner license file.')
        event.target.value = ''
        practitionerIdFile.value = null
        practitionerOcrResult.value = null
        return
      }
      const file = event?.target?.files?.[0] || null
      if (!file) {
        practitionerIdFile.value = null
        return
      }
      const contentType = String(file.type || '').toLowerCase()
      if (!['image/jpeg', 'image/png'].includes(contentType)) {
        toast.error('Upload one JPEG or PNG image.')
        event.target.value = ''
        practitionerIdFile.value = null
        practitionerOcrResult.value = null
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be 5MB or smaller.')
        event.target.value = ''
        practitionerIdFile.value = null
        practitionerOcrResult.value = null
        return
      }
      practitionerIdFile.value = file
      practitionerOcrBusy.value = true
      const employeeName = {
        firstName: currentStaff.value.firstName.trim(),
        middleName: currentStaff.value.middleName.trim(),
        lastName: currentStaff.value.lastName.trim(),
        suffix: currentStaff.value.suffix.trim(),
      }
      try {
        if (!employeeName.firstName || !employeeName.lastName) throw new Error('Enter the employee first and last name before uploading the license.')
        const branchId = currentStaff.value.branchIds?.[0] || currentStaff.value.clinicBranch
        if (!branchId) throw new Error('Choose a clinic branch before checking the license.')
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Your session expired. Sign in again and retry.')
        const base64 = await readFileBase64(file)
        const response = await fetch(`${OTP_API_BASE}/practitioner-license/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ branchId, ...employeeName, contentType, base64 }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to validate the practitioner license.')
        if (sequence !== practitionerOcrSequence) return
        practitionerOcrResult.value = payload.data || null
        if (payload.data?.accepted !== true) {
          practitionerIdFile.value = null
          event.target.value = ''
          toast.error(payload.data?.reason || 'The license could not be validated. Upload a clear, current document.')
        } else {
          toast.success('Employee name and license expiration date verified.')
        }
      } catch (error) {
        if (sequence !== practitionerOcrSequence) return
        practitionerIdFile.value = null
        event.target.value = ''
        practitionerOcrResult.value = { accepted: false, reason: error.message || 'Unable to validate the license image.' }
        toast.error(practitionerOcrResult.value.reason)
      } finally {
        if (sequence === practitionerOcrSequence) practitionerOcrBusy.value = false
      }
    }

    const clearPractitionerFile = () => {
      practitionerOcrSequence += 1
      practitionerOcrBusy.value = false
      practitionerIdFile.value = null
      practitionerOcrResult.value = null
      if (practitionerLicenseInput.value) practitionerLicenseInput.value.value = ''
    }

    const sendStaffWelcomeEmail = async ({ email, fullName, defaultPassword, uid }) => {
      const user = auth.currentUser
      if (!user) {
        throw new Error('User not authenticated.')
      }

      const token = await user.getIdToken()
      const response = await fetch(`${OTP_API_BASE}/send-staff-welcome`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: email,
          fullName,
          defaultPassword,
          uid,
        }),
      })

      const contentType = String(response.headers.get('content-type') || '')
      const data = contentType.includes('application/json') ? await response.json() : null
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to send welcome email.')
      }

      return data
    }

    const saveStaff = async () => {
      if (savingStaff.value) return
      if (hasErrors.value) {
        const firstError = Object.values(fieldErrors.value).find(Boolean)
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      savingStaff.value = true
      const fullName = buildFullName()
      const selectedRoleNames = selectedCustomRoles.value.map((role) => role.name).filter(Boolean)
      const assignedBranchIds = [...new Set(
        (Array.isArray(currentStaff.value.branchIds) && currentStaff.value.branchIds.length
          ? currentStaff.value.branchIds
          : [currentStaff.value.clinicBranch])
          .map((branchId) => String(branchId || '').trim())
          .filter(Boolean)
      )]

      try {
        const result = await Swal.fire({
          title: 'Confirm Staff Account',
          text: `Do you want to create an account for ${fullName} (${currentStaff.value.email})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, create',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Staff account creation cancelled.")
          return
        }

        const temporaryPassword = generateSecurePassword()
        let userCredential
        let creatorApp = null
        let creatorAuth = null

        try {
          // Step 1: Create Auth user using a secondary app so current session is preserved.
          const appName = `staff-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`
          creatorApp = initializeApp(getApp().options, appName)
          creatorAuth = getAuth(creatorApp)
          userCredential = await createUserWithEmailAndPassword(creatorAuth, currentStaff.value.email, temporaryPassword)
        } catch (error) {
          if (error.code === 'auth/email-already-in-use') {
            toast.error("This email is already registered.")
            return
          } else {
            toast.error("Failed to create staff account.")
            console.error(error)
            return
          }
        }

        const uid = userCredential.user.uid
        let practitionerLicenseFileRef = null

        try {
          let practitionerLicenseUrl = ''
          let practitionerLicenseName = ''
          let practitionerLicenseStoragePath = ''

          if (isPractitionerRole.value && practitionerIdFile.value) {
            const ownerId = auth.currentUser?.uid || 'unknown'
            const safeName = practitionerIdFile.value.name.replace(/[^\w.\-]+/g, '_')
            const filePath = `practitioner-licenses/${ownerId}/${uid}/${Date.now()}-${safeName}`
            const fileRef = storageRef(storage, filePath)
            practitionerLicenseFileRef = fileRef
            practitionerLicenseStoragePath = filePath
            await uploadBytes(fileRef, practitionerIdFile.value)
            practitionerLicenseUrl = await getDownloadURL(fileRef)
            practitionerLicenseName = practitionerIdFile.value.name
          }

          // Step 2: create the profile through the trusted API. It validates
          // the caller's authority over every assigned branch.
          const token = await auth.currentUser?.getIdToken()
          const profileResponse = await fetch(`${OTP_API_BASE}/staff/${uid}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
            firstName: currentStaff.value.firstName,
            middleName: currentStaff.value.middleName.trim() || null,
            lastName: currentStaff.value.lastName,
            suffix: currentStaff.value.suffix.trim() || null,
            fullName: fullName,
            email: currentStaff.value.email,
            phoneNumber: `+63${currentStaff.value.phoneNumber}`,
            role: selectedRoleNames[0] || '',
            customRoleId: currentStaff.value.customRoleId || null,
            customRoleIds: Array.isArray(currentStaff.value.customRoleIds) ? currentStaff.value.customRoleIds : [],
            customRoleName: selectedRoleNames.join(', ') || null,
            effectivePermissions: [...new Set(selectedCustomRoles.value.flatMap((role) => role.permissions || []))],
            practitionerType: currentStaff.value.practitionerType,
            engagementType: currentStaff.value.engagementType,
            employmentType: currentStaff.value.employmentType,
            weeklyHoursTarget: Number(currentStaff.value.weeklyHoursTarget),
            userType: 'Staff',
            branchId: currentStaff.value.clinicBranch,
            branchIds: assignedBranchIds,
            clinicLocation: currentStaff.value.clinicLocation,
            status: 'Pending Activation',
            practitionerLicenseUrl: practitionerLicenseUrl || null,
            practitionerLicenseName: practitionerLicenseName || null,
            practitionerLicenseStoragePath: practitionerLicenseStoragePath || null,
            credentialNumber: practitionerOcrResult.value?.licenseNumber || '',
            practitionerLicenseUploadedBy: practitionerLicenseUrl ? (auth.currentUser?.uid || null) : null,
            mustChangePassword: true,
            createdAt: new Date()
            })
          })
          const profilePayload = await profileResponse.json().catch(() => ({}))
          if (!profileResponse.ok || !profilePayload.success) {
            throw new Error(profilePayload.error || 'Unable to create employee profile.')
          }

          try {
            await sendStaffWelcomeEmail({
              email: currentStaff.value.email,
              fullName: fullName,
              defaultPassword: temporaryPassword,
              uid,
            })
          } catch (emailError) {
            console.error('Failed to send staff welcome email:', emailError)
          toast.warn('Staff member added, but the welcome email could not be sent.')
          }

          toast.success('Staff member added successfully.')
          resetForm()
        } catch (firestoreError) {
          // Step 3: Rollback Auth if Firestore fails
          await Promise.allSettled([
            userCredential.user.delete(),
            practitionerLicenseFileRef ? deleteObject(practitionerLicenseFileRef) : Promise.resolve(),
          ])
          console.error("Error creating the employee profile:", firestoreError)
          toast.error(firestoreError.message || 'Failed to create the employee profile. The new account was rolled back.')
        } finally {
          if (creatorAuth) {
            await signOut(creatorAuth).catch(() => {})
          }
          if (creatorApp) {
            await deleteApp(creatorApp).catch(() => {})
          }
        }
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while saving employee.")
      } finally {
        savingStaff.value = false
      }
    }

    const isFormEmpty = computed(() => {
      const s = currentStaff.value
      return !s.firstName?.trim() &&
             !s.lastName?.trim() &&
             !s.email?.trim() &&
             !s.phoneNumber?.trim() &&
             !s.clinicBranch?.trim() &&
             !s.clinicLocation?.trim()
    })

    return {
      pageLoading,
      loading,
      currentStaff,
      employeeSpecialtyTypes,
      rolesLoading,
      rolesLoadError,
      loadCustomRoles,
      isStudentIntern,
      setEngagementType,
      setEmploymentType,
      saveStaff,
      resetForm,
      branches,
      customRoles,
      selectedCustomRoles,
      selectedCustomRoleName,
      isPractitionerRole,
      showCredentialUpload,
      savingStaff,
      practitionerIdFile,
      practitionerLicenseInput,
      practitionerOcrBusy,
      practitionerOcrResult,
      isFormEmpty,
      isBasicPlan,
      fieldErrors,
      hasErrors,
      handleFirstNameInput,
      handleMiddleNameInput,
      handleLastNameInput,
      handleEmailInput,
      emailAvailability,
      emailAvailabilityMessage,
      handlePhoneInput,
      updateLocation,
      handlePractitionerFile,
      clearPractitionerFile,
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme w-full" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component v-page-loading="{ active: pageLoading, variant: 'form', fields: 6, sections: 3, header: !embedded }" :is="embedded ? 'div' : 'main'" class="flex-1" :class="embedded ? '' : 'p-4 md:p-8'">
      <!-- Page Header -->
      <div v-if="!embedded" class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Add Staff Member</h1>
          <p class="text-slate-400 text-sm md:text-base">Create a staff account, choose their arrangement, and assign their agreed weekly hours.</p>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <OwnerPageSkeleton v-if="loading" variant="form" :fields="6" :sections="3" />

      <!-- Add Staff Member Form -->
      <div v-else class="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg md:p-8">
        <form class="space-y-6" @submit.prevent="saveStaff" :aria-busy="savingStaff">
          <!-- Personal Information -->
          <div>
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Personal Information</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- First Name -->
              <div>
                <label class="mb-1 block text-slate-400">First Name <span class="text-red-400">*</span></label>
                <input
                  :value="currentStaff.firstName"
                  type="text"
                  placeholder="Enter first name"
                  @input="handleFirstNameInput"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                />
                <p v-if="fieldErrors.firstName" class="mt-1 text-xs text-red-400">{{ fieldErrors.firstName }}</p>
              </div>

              <!-- Middle Name -->
              <div>
                <label class="mb-1 block text-slate-400">Middle Name</label>
                <input
                  :value="currentStaff.middleName"
                  type="text"
                  placeholder="Enter middle name (optional)"
                  @input="handleMiddleNameInput"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.middleName ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                />
                <p v-if="fieldErrors.middleName" class="mt-1 text-xs text-red-400">{{ fieldErrors.middleName }}</p>
              </div>

              <!-- Last Name -->
              <div>
                <label class="mb-1 block text-slate-400">Last Name <span class="text-red-400">*</span></label>
                <input
                  :value="currentStaff.lastName"
                  type="text"
                  placeholder="Enter last name"
                  @input="handleLastNameInput"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                />
                <p v-if="fieldErrors.lastName" class="mt-1 text-xs text-red-400">{{ fieldErrors.lastName }}</p>
              </div>

              <!-- Suffix -->
              <div>
                <label class="mb-1 block text-slate-400">Suffix</label>
                <select
                  v-model="currentStaff.suffix"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.suffix ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                >
                  <option value="">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                  <option value="V">V</option>
                </select>
                <p v-if="fieldErrors.suffix" class="mt-1 text-xs text-red-400">{{ fieldErrors.suffix }}</p>
              </div>
            </div>
          </div>

          <!-- Contact Information -->
          <div>
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Contact Information</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Email -->
              <div>
                <label class="mb-1 block text-slate-400">Email <span class="text-red-400">*</span></label>
                <div class="relative">
                  <input
                    :value="currentStaff.email"
                    type="email"
                    placeholder="Enter email address"
                    @input="handleEmailInput"
                    :class="[
                      'w-full rounded-lg border bg-slate-800 px-3 py-2 pr-10 text-white focus:outline-none focus:ring-2',
                      fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-amber-500'
                    ]"
                  />
                  <span v-if="emailAvailability === 'checking'" class="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300" aria-label="Checking email availability">&#8987;</span>
                  <span v-else-if="emailAvailability === 'available'" class="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300" aria-label="Email available">&#10003;</span>
                  <span v-else-if="emailAvailability === 'used'" class="absolute right-3 top-1/2 -translate-y-1/2 text-rose-300" aria-label="Email already used">&#10005;</span>
                </div>
                <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-400">{{ fieldErrors.email }}</p>
                <p v-else-if="emailAvailabilityMessage" class="mt-1 text-xs" :class="{
                  'text-emerald-300': emailAvailability === 'available',
                  'text-rose-300': emailAvailability === 'used',
                  'text-amber-300': ['checking', 'error', 'invalid'].includes(emailAvailability)
                }">{{ emailAvailabilityMessage }}</p>
              </div>

              <!-- Phone Number -->
              <div>
                <label class="mb-1 block text-slate-400">Phone Number <span class="text-red-400">*</span></label>
                <div class="flex">
                  <span class="inline-flex items-center rounded-l-lg border border-r-0 border-slate-700 bg-slate-700 px-3 text-slate-400">+63</span>
                  <input
                    :value="currentStaff.phoneNumber"
                    type="tel"
                    placeholder="Enter 10-digit number"
                    @input="handlePhoneInput"
                    :class="[
                      'w-full rounded-r-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                      fieldErrors.phoneNumber ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                    ]"
                  />
                </div>
                <p v-if="fieldErrors.phoneNumber" class="mt-1 text-xs text-red-400">{{ fieldErrors.phoneNumber }}</p>
              </div>
            </div>
          </div>

          <!-- Role & Employment -->
          <div>
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Role & Employment</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-if="isPractitionerRole" class="professional-specialty-block sm:col-span-2">
                <ContractAppearanceSelect id="new-staff-specialty" label="Professional specialty *" v-model="currentStaff.practitionerType" :options="employeeSpecialtyTypes.map(type => ({ value: type, label: type }))" />
                <p v-if="fieldErrors.practitionerType" class="mt-1 text-xs text-red-400" role="alert">{{ fieldErrors.practitionerType }}</p>
                <p v-else class="mt-1 text-xs leading-relaxed text-slate-400">Required for the Practitioner role. Select the employee’s professional specialty.</p>
              </div>
              <!-- Custom Role -->
              <div>
                <label class="mb-1 block text-slate-400">Role <span class="text-red-400">*</span></label>
                <fieldset class="assignment-options" :class="{ 'has-error': fieldErrors.role }" aria-label="Roles" :aria-invalid="Boolean(fieldErrors.role)" :aria-describedby="fieldErrors.role ? 'staff-role-error' : 'staff-role-hint'">
                  <p v-if="rolesLoading" class="assignment-empty" role="status">Loading roles…</p>
                  <div v-else-if="rolesLoadError" class="assignment-empty" role="alert">
                    <span>{{ rolesLoadError }}</span>
                    <button type="button" class="ml-2 underline" @click="loadCustomRoles()">Retry</button>
                  </div>
                  <template v-else>
                    <label v-for="role in customRoles" :key="role.id" class="assignment-option" :class="{ 'is-selected': currentStaff.customRoleIds.includes(role.id) }">
                      <input v-model="currentStaff.customRoleIds" type="checkbox" :value="role.id" />
                      <span>{{ role.name }}</span>
                    </label>
                    <p v-if="!customRoles.length" class="assignment-empty">No roles are available for this clinic.</p>
                  </template>
                </fieldset>
                <p id="staff-role-hint" class="mt-2 text-xs text-slate-400">Select one or more roles.</p>
                <p v-if="fieldErrors.role" id="staff-role-error" class="mt-1 text-xs text-red-400" role="alert">{{ fieldErrors.role }}</p>
                <div v-if="selectedCustomRoles.length" class="mt-3 rounded-lg border border-gold-500/40 bg-gold-500/10 p-3">
                  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-200">Selected roles</p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="role in selectedCustomRoles"
                      :key="role.id"
                      class="rounded-full border border-gold-400/50 bg-gold-500/20 px-2.5 py-1 text-xs font-medium text-gold-100"
                    >
                      {{ role.name }}
                    </span>
                  </div>
                </div>
                <p v-else class="mt-1 text-xs text-slate-400">Choose a role to define permissions.</p>
              </div>

              <div>
                <label class="mb-1 block text-slate-400">Staff Arrangement <span class="text-red-400">*</span></label>
                <select
                  :value="currentStaff.engagementType"
                  @change="setEngagementType($event.target.value)"
                  class="add-staff-select w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="student_intern">Student intern / OJT</option>
                </select>
                <p class="mt-1 text-xs text-slate-400">Everyone uses the same schedule and attendance flow. Use Employee for staff paid through payroll, including an intern hired as an employee. Use Student intern / OJT for a training placement; record any stipend as a Finance expense.</p>
              </div>

              <!-- Employment Type -->
              <div v-if="!isStudentIntern">
                <label class="mb-1 block text-slate-400">Employment Type <span class="text-red-400">*</span></label>
                <select
                  :value="currentStaff.employmentType"
                  @change="setEmploymentType($event.target.value)"
                  class="add-staff-select w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option class="text-slate-300" value="" disabled>Select employment type</option>
                  <option class="text-white" value="Full-time">Full-time</option>
                  <option class="text-white" value="Part-time">Part-time</option>
                </select>
                <p v-if="fieldErrors.employmentType" class="mt-1 text-xs text-red-400">{{ fieldErrors.employmentType }}</p>
              </div>
              <div>
                <label for="staff-weekly-hours" class="mb-1 block text-slate-400">Agreed Weekly Hours <span class="text-red-400">*</span></label>
                <input id="staff-weekly-hours" v-model.number="currentStaff.weeklyHoursTarget" type="number" min="1" max="48" step="0.5" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p v-if="!isStudentIntern && currentStaff.employmentType === 'Full-time'" class="mt-1 text-xs text-slate-400">Full-time starts at 40 hours. Adjust only to match the employee’s agreement.</p>
                <p v-else class="mt-1 text-xs text-slate-400">Enter the hours agreed with the part-time employee or training institution (maximum 48 hours).</p>
                <p v-if="fieldErrors.weeklyHoursTarget" class="mt-1 text-xs text-red-400">{{ fieldErrors.weeklyHoursTarget }}</p>
              </div>
            </div>
          </div>

          <!-- Branch Assignment -->
          <div>
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Branch Assignment</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Branch -->
              <div>
                <label class="mb-1 block text-slate-400">Assigned Branches <span class="text-red-400">*</span></label>
                <fieldset class="assignment-options" :class="{ 'has-error': fieldErrors.clinicBranch }" aria-label="Assigned branches" :aria-invalid="Boolean(fieldErrors.clinicBranch)" :aria-describedby="fieldErrors.clinicBranch ? 'branch-assignment-error' : 'branch-assignment-hint'">
                  <label v-for="branch in branches" :key="branch.id" class="assignment-option" :class="{ 'is-selected': currentStaff.branchIds.includes(branch.id) }">
                    <input v-model="currentStaff.branchIds" type="checkbox" :value="branch.id" @change="updateLocation" />
                    <span><span class="assignment-name">{{ branch.branch }}</span><span class="assignment-location">{{ branch.location }}</span></span>
                  </label>
                  <p v-if="!branches.length" class="assignment-empty">No branches available.</p>
                </fieldset>
                <p id="branch-assignment-hint" class="mt-2 text-xs text-slate-400">Select one or more branches. The first selected branch sets the clinic location.</p>
                <p v-if="fieldErrors.clinicBranch" id="branch-assignment-error" class="mt-1 text-xs text-red-400">{{ fieldErrors.clinicBranch }}</p>
              </div>

              <!-- Clinic Location (auto-populated) -->
              <div>
                <label class="mb-1 block text-slate-400">Clinic Location <span class="text-red-400">*</span></label>
                <input
                  :value="currentStaff.clinicLocation"
                  type="text"
                  readonly
                  :class="[
                    'w-full rounded-lg border bg-slate-900/70 px-3 py-2 text-white cursor-not-allowed',
                    fieldErrors.clinicLocation ? 'border-red-500' : 'border-slate-700'
                  ]"
                  placeholder="Auto-populated from branch"
                />
                <p v-if="fieldErrors.clinicLocation" class="mt-1 text-xs text-red-400">{{ fieldErrors.clinicLocation }}</p>
                <p v-else class="mt-1 text-xs text-slate-400">Automatically filled when a branch is selected.</p>
              </div>
            </div>
          </div>

          <!-- Practitioner ID Upload (conditional) -->
          <div v-if="showCredentialUpload">
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Practitioner License</h2>
            <div>
              <label class="mb-1 block text-slate-400">Upload practitioner credential <span v-if="isPractitionerRole" class="text-red-400">*</span><span v-else class="text-slate-400">(optional)</span></label>
              <div class="flex items-center gap-3">
                <label class="cursor-pointer rounded-lg border border-dashed border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-300 hover:border-blue-500 hover:text-blue-300 transition">
                  <span v-if="!practitionerIdFile">Choose File</span>
                  <span v-else class="text-green-400">{{ practitionerIdFile.name }}</span>
                  <input
                    ref="practitionerLicenseInput"
                    type="file"
                    accept="image/jpeg,image/png"
                    class="hidden"
                    @change="handlePractitionerFile"
                  />
                </label>
                <button
                  v-if="practitionerIdFile"
                  type="button"
                  @click="clearPractitionerFile"
                  class="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Remove
                </button>
              </div>
              <p v-if="fieldErrors.practitionerId" class="mt-1 text-xs text-red-400">{{ fieldErrors.practitionerId }}</p>
              <p v-else-if="practitionerOcrBusy" class="mt-1 text-xs text-slate-400" role="status">Checking the employee name and license expiration date…</p>
              <p v-else-if="practitionerOcrResult?.accepted" class="mt-1 text-xs text-green-400" role="status">Name matched and license valid through {{ practitionerOcrResult.expiryDate }}.</p>
              <p class="mt-1 text-xs text-slate-400">The image must show this employee’s name and a current expiration date. Both are checked before the account is created.</p>
              <p class="mt-1 text-xs text-slate-400">Accepted formats: one JPEG or PNG image (max 5MB).</p>
            </div>
          </div>

          <!-- Status (hidden, always Active on creation) -->
          <input type="hidden" v-model="currentStaff.status" />

          <!-- Form Actions -->
          <div class="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              :disabled="isFormEmpty"
              @click="resetForm"
              class="rounded-lg bg-slate-600 px-5 py-2 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              :disabled="hasErrors || savingStaff || rolesLoading || Boolean(rolesLoadError)"
              class="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ savingStaff ? 'Adding staff member…' : 'Add Staff Member' }}
            </button>
          </div>
        </form>
      </div>
    </component>
  </div>
</template>

<style scoped>
.owner-theme {
  --sidebar-width: 16rem;
}

.add-staff-select {
  color: #352a25;
  background-color: #fffaf4;
  color-scheme: light;
}

.add-staff-select option {
  color: #352a25;
  background-color: #fffaf4;
}

.add-staff-select option:disabled {
  color: #786354;
}

.add-staff-select::-ms-expand {
  color: #352a25;
}
.assignment-options { max-height: 220px; overflow-y: auto; display: grid; gap: 6px; padding: 8px; border: 1px solid #dfbea0; border-radius: 12px; background: #fffaf4; color: #352a25; color-scheme: light; }
.assignment-options.has-error { border-color: #b9433f; }
.assignment-option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-size: 13px; line-height: 1.5; }
.assignment-option:hover { background: #f8eedf; }
.assignment-option.is-selected { background: #f4e4cf; border-color: #d7aa7d; }
.assignment-option input[type="checkbox"] { flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; accent-color: #91643f; }
.assignment-option:focus-within { outline: 2px solid #91643f; outline-offset: 1px; }
.assignment-name { display: block; font-weight: 600; }
.assignment-location { display: block; font-size: 12px; color: #786354; }
.assignment-empty { padding: 12px; font-size: 13px; color: #786354; }
.professional-specialty-block { display: grid; gap: 4px; }
.professional-specialty-block :deep(.appearance-select) { margin: 0; }
</style>
