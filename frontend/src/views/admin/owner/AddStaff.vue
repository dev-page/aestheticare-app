<script>
import { ref, onMounted, computed, watch } from 'vue'
import { getFirestore, collection, doc, getDocs, setDoc, query, where } from 'firebase/firestore'
import { deleteApp, getApp, initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { useSubscription } from '@/composables/useSubscription'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { storage } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

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
  components: { OwnerSidebar, OwnerPageSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)
    const branches = ref([])
    const customRoles = ref([])
    const currentOwnerId = ref('')
    const currentBranchIds = ref([])
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
      employmentType: '',
      userType: 'Staff',
      clinicBranch: '',   // will hold branchId
      clinicLocation: '',
      status: 'Active'
    })
    const practitionerIdFile = ref(null)

    const normalizedPlan = computed(() => String(activePlan.value || '').trim().toLowerCase())
    const isBasicPlan = computed(() => normalizedPlan.value === 'basic')

    // Load branches from Firestore
    const loadBranches = async () => {
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
        updateLocation()
      }
      loading.value = false
    }

    const loadCustomRoles = async () => {
      const user = auth.currentUser
      if (!user) {
        customRoles.value = []
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid

      const rolesQuery = query(
        collection(db, 'clinicRoles'),
        where('ownerId', '==', currentOwnerId.value)
      )
      const snapshot = await getDocs(rolesQuery)
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
    }

    onMounted(async () => {
      loading.value = true
      await initSubscription()
      onAuthStateChanged(auth, async () => {
        await loadBranches()
        await loadCustomRoles()
      })
    })

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
        employmentType: '',
        userType: 'Staff',
        clinicBranch: '',
        clinicLocation: '',
        status: 'Active'
      }
      practitionerIdFile.value = null
      if (isBasicPlan.value && branches.value.length > 0) {
        currentStaff.value.clinicBranch = branches.value[0].id
        updateLocation()
      }
    }

    // Auto-populate clinicLocation when branch is selected
    const updateLocation = () => {
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

    const handleSuffixInput = (event) => {
      const value = event?.target?.value ?? ''
      // Allow letters, spaces, periods (e.g. Jr., III, Sr., II)
      currentStaff.value.suffix = value.replace(/[^A-Za-z\s.]/g, '')
    }

    const handleEmailInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.email = sanitizeEmail(value)
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
        clinicBranch: '',
        clinicLocation: '',
        employmentType: '',
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
      }

      if (!currentStaff.value.phoneNumber.trim()) {
        errors.phoneNumber = 'Phone number is required.'
      } else if (currentStaff.value.phoneNumber.length !== 10) {
        errors.phoneNumber = 'Enter a 10-digit mobile number.'
      }

      if (!currentStaff.value.clinicBranch.trim()) {
        errors.clinicBranch = 'Branch is required.'
      }

      if (!currentStaff.value.clinicLocation.trim()) {
        errors.clinicLocation = 'Clinic location is required.'
      }
      if (!currentStaff.value.employmentType.trim()) {
        errors.employmentType = 'Employment type is required.'
      }
      if (String(currentStaff.value.role || '').toLowerCase() === 'practitioner' && !practitionerIdFile.value) {
        errors.practitionerId = 'Practitioner ID attachment is required.'
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
    const isPractitionerRole = computed(() =>
      selectedCustomRoles.value.some((role) => String(role.name || '').toLowerCase().includes('practitioner'))
      || String(currentStaff.value.role || '').toLowerCase() === 'practitioner'
    )
    const selectedCustomRoleName = computed(() => {
      return selectedCustomRoles.value.map((role) => role.name).join(', ')
    })

    const handlePractitionerFile = (event) => {
      const file = event?.target?.files?.[0] || null
      if (!file) {
        practitionerIdFile.value = null
        return
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Allowed file types: JPG, PNG, WEBP, PDF.')
        event.target.value = ''
        practitionerIdFile.value = null
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be 5MB or smaller.')
        event.target.value = ''
        practitionerIdFile.value = null
        return
      }
      practitionerIdFile.value = file
    }

    const sendStaffWelcomeEmail = async ({ email, fullName, defaultPassword }) => {
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
      if (hasErrors.value) {
        const firstError = Object.values(fieldErrors.value).find(Boolean)
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      const fullName = buildFullName()

      try {
        const result = await Swal.fire({
          title: 'Confirm Employee Creation',
          text: `Do you want to create an account for ${fullName} (${currentStaff.value.email})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, create',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Employee creation cancelled.")
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
            toast.error("Failed to create employee account.")
            console.error(error)
            return
          }
        }

        const uid = userCredential.user.uid

        try {
          let practitionerLicenseUrl = ''
          let practitionerLicenseName = ''

          if (isPractitionerRole.value && practitionerIdFile.value) {
            const ownerId = auth.currentUser?.uid || 'unknown'
            const safeName = practitionerIdFile.value.name.replace(/[^\w.\-]+/g, '_')
            const filePath = `practitioner-licenses/${ownerId}/${uid}/${Date.now()}-${safeName}`
            const fileRef = storageRef(storage, filePath)
            await uploadBytes(fileRef, practitionerIdFile.value)
            practitionerLicenseUrl = await getDownloadURL(fileRef)
            practitionerLicenseName = practitionerIdFile.value.name
          }

          // Step 2: Save to Firestore
          await setDoc(doc(db, "users", uid), {
            firstName: currentStaff.value.firstName,
            middleName: currentStaff.value.middleName.trim() || null,
            lastName: currentStaff.value.lastName,
            suffix: currentStaff.value.suffix.trim() || null,
            fullName: fullName,
            email: currentStaff.value.email,
            phoneNumber: `+63${currentStaff.value.phoneNumber}`,
            role: currentStaff.value.role,
            customRoleId: currentStaff.value.customRoleId || null,
            customRoleIds: Array.isArray(currentStaff.value.customRoleIds) ? currentStaff.value.customRoleIds : [],
            customRoleName: selectedCustomRoleName.value || null,
            effectivePermissions: [...new Set(selectedCustomRoles.value.flatMap((role) => role.permissions || []))],
            employmentType: currentStaff.value.employmentType,
            userType: 'Staff',
            branchId: currentStaff.value.clinicBranch,   // ✅ store branchId reference
            clinicLocation: currentStaff.value.clinicLocation,
            status: currentStaff.value.status ?? "Active",
            practitionerLicenseUrl: practitionerLicenseUrl || null,
            practitionerLicenseName: practitionerLicenseName || null,
            practitionerLicenseUploadedBy: practitionerLicenseUrl ? (auth.currentUser?.uid || null) : null,
            mustChangePassword: true,
            createdAt: new Date()
          })

          try {
            await sendStaffWelcomeEmail({
              email: currentStaff.value.email,
              fullName: fullName,
              defaultPassword: temporaryPassword,
            })
          } catch (emailError) {
            console.error('Failed to send staff welcome email:', emailError)
            toast.warn('Employee added, but the welcome email could not be sent.')
          }

          toast.success('Employee added successfully.')
          resetForm()
        } catch (firestoreError) {
          // Step 3: Rollback Auth if Firestore fails
          await userCredential.user.delete()
          console.error("Error saving staff to Firestore:", firestoreError)
          toast.error("Failed to save employee record. Auth user was rolled back.")
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
      loading,
      currentStaff,
      saveStaff,
      resetForm,
      branches,
      customRoles,
      selectedCustomRoleName,
      isPractitionerRole,
      practitionerIdFile,
      isFormEmpty,
      isBasicPlan,
      fieldErrors,
      hasErrors,
      handleFirstNameInput,
      handleMiddleNameInput,
      handleLastNameInput,
      handleSuffixInput,
      handleEmailInput,
      handlePhoneInput,
      updateLocation,
      handlePractitionerFile,
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <!-- Page Header -->
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Add Employee</h1>
          <p class="text-slate-400 text-sm md:text-base">Create a new employee account and assign them to a branch.</p>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <OwnerPageSkeleton v-if="loading" />

      <!-- Add Employee Form -->
      <div v-else class="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg md:p-8">
        <form class="space-y-6" @submit.prevent="saveStaff">
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
                <input
                  :value="currentStaff.suffix"
                  type="text"
                  placeholder="e.g. Jr., III, Sr. (optional)"
                  @input="handleSuffixInput"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.suffix ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                />
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
                <input
                  :value="currentStaff.email"
                  type="email"
                  placeholder="Enter email address"
                  @input="handleEmailInput"
                  :class="[
                    'w-full rounded-lg border bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2',
                    fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                />
                <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-400">{{ fieldErrors.email }}</p>
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
              <!-- Custom Role -->
              <div>
                <label class="mb-1 block text-slate-400">Role <span class="text-red-400">*</span></label>
                <select
                  v-model="currentStaff.customRoleIds"
                  multiple
                  class="add-staff-select w-full min-h-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option
                    v-for="role in customRoles"
                    :key="role.id"
                    :value="role.id"
                    class="text-white"
                  >
                    {{ role.name }}
                  </option>
                </select>
                <p class="mt-1 text-xs text-slate-400">Hold Ctrl or Command to assign more than one role.</p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ selectedCustomRoleName ? `Selected: ${selectedCustomRoleName}` : 'Choose a role to define permissions.' }}
                </p>
              </div>

              <!-- Employment Type -->
              <div>
                <label class="mb-1 block text-slate-400">Employment Type <span class="text-red-400">*</span></label>
                <select
                  v-model="currentStaff.employmentType"
                  class="add-staff-select w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option class="text-slate-300" value="" disabled>Select employment type</option>
                  <option class="text-white" value="Full-time">Full-time</option>
                  <option class="text-white" value="Part-time">Part-time</option>
                  <option class="text-white" value="Contractual">Contractual</option>
                  <option class="text-white" value="Intern">Intern</option>
                  <option class="text-white" value="Freelance">Freelance</option>
                </select>
                <p v-if="fieldErrors.employmentType" class="mt-1 text-xs text-red-400">{{ fieldErrors.employmentType }}</p>
              </div>
            </div>
          </div>

          <!-- Branch Assignment -->
          <div>
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Branch Assignment</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Branch -->
              <div>
                <label class="mb-1 block text-slate-400">Branch <span class="text-red-400">*</span></label>
                <select
                  v-model="currentStaff.clinicBranch"
                  @change="updateLocation"
                  :class="[
                    'add-staff-select w-full rounded-lg border bg-slate-800 px-3 py-2 text-white appearance-none focus:outline-none focus:ring-2',
                    fieldErrors.clinicBranch ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  ]"
                >
                  <option class="text-slate-300" value="" disabled>Select a branch</option>
                  <option
                    v-for="branch in branches"
                    :key="branch.id"
                    :value="branch.id"
                    class="text-white"
                  >
                    {{ branch.branch }} — {{ branch.location }}
                  </option>
                </select>
                <p v-if="fieldErrors.clinicBranch" class="mt-1 text-xs text-red-400">{{ fieldErrors.clinicBranch }}</p>
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
          <div v-if="isPractitionerRole">
            <h2 class="text-lg font-semibold text-white mb-4 border-b border-slate-700 pb-2">Practitioner License</h2>
            <div>
              <label class="mb-1 block text-slate-400">Upload Practitioner ID <span class="text-red-400">*</span></label>
              <div class="flex items-center gap-3">
                <label class="cursor-pointer rounded-lg border border-dashed border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-300 hover:border-blue-500 hover:text-blue-300 transition">
                  <span v-if="!practitionerIdFile">Choose File</span>
                  <span v-else class="text-green-400">{{ practitionerIdFile.name }}</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    class="hidden"
                    @change="handlePractitionerFile"
                  />
                </label>
                <button
                  v-if="practitionerIdFile"
                  type="button"
                  @click="practitionerIdFile = null"
                  class="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Remove
                </button>
              </div>
              <p v-if="fieldErrors.practitionerId" class="mt-1 text-xs text-red-400">{{ fieldErrors.practitionerId }}</p>
              <p class="mt-1 text-xs text-slate-400">Accepted formats: JPG, PNG, WEBP, PDF (max 5MB).</p>
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
              :disabled="hasErrors"
              class="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Employee
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.owner-theme {
  --sidebar-width: 16rem;
}

.add-staff-select {
  color: #f8fafc;
  background-color: #0f172a;
}

.add-staff-select option {
  color: #f8fafc;
  background-color: #0f172a;
}

.add-staff-select option:disabled {
  color: #94a3b8;
}

.add-staff-select::-ms-expand {
  color: #f8fafc;
}
</style>
