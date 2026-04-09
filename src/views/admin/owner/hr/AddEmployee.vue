<script>
import { ref, onMounted, watch, computed } from 'vue'
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { deleteApp, getApp, initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { storage } from '@/config/firebaseConfig'

const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const DEFAULT_STAFF_PASSWORD = 'password123'

export default {
  name: 'AddEmployee',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const currentBranchLabel = ref('')
    const assignedBranchId = ref('')
    const customRoles = ref([])

    const currentStaff = ref({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      role: '',
      customRoleId: '',
      customRoleName: '',
      employmentType: '',
      userType: 'Staff',
      branchId: '',   // ✅ store branchId instead of branch name
      status: 'Active'
    })
    const practitionerIdFile = ref(null)

    const setAssignedBranch = async (user) => {
      if (!user) {
        assignedBranchId.value = ''
        currentStaff.value.branchId = ''
        currentBranchLabel.value = ''
        customRoles.value = []
        return
      }

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists()) {
        assignedBranchId.value = ''
        currentStaff.value.branchId = ''
        currentBranchLabel.value = ''
        customRoles.value = []
        return
      }

      const branchId = userSnap.data().branchId || ''
      assignedBranchId.value = branchId
      currentStaff.value.branchId = branchId

      if (!branchId) {
        currentBranchLabel.value = 'No branch assigned'
        customRoles.value = []
        return
      }

      const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
      if (!clinicSnap.exists()) {
        currentBranchLabel.value = 'Unknown branch'
        customRoles.value = []
        return
      }

      const clinic = clinicSnap.data()
      currentBranchLabel.value = `${clinic.clinicBranch || 'Branch'}${clinic.clinicLocation ? ` - ${clinic.clinicLocation}` : ''}`

      const ownerId = String(clinic.ownerId || '').trim()
      if (!ownerId) {
        customRoles.value = []
        return
      }

      const rolesSnap = await getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
      customRoles.value = rolesSnap.docs
        .map((roleDoc) => {
          const data = roleDoc.data() || {}
          const permissions = Array.isArray(data.permissions)
            ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
            : []

          return {
            id: roleDoc.id,
            name: String(data.name || '').trim(),
            permissions
          }
        })
        .filter((role) => role.name && role.permissions.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name))
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        await setAssignedBranch(user)
      })
    })

    const normalizeLocalPhone = (value) => {
      const digitsOnly = String(value || '').replace(/\D/g, '')
      const withoutLeadingZero = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly
      return withoutLeadingZero.slice(0, 10)
    }

    const onPhoneInput = () => {
      currentStaff.value.phoneNumber = normalizeLocalPhone(currentStaff.value.phoneNumber)
      if (touchedFields.value.phoneNumber) {
        validateField('phoneNumber')
      }
    }

    const resetForm = () => {
      currentStaff.value = {
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        address: '',
        role: '',
        customRoleId: '',
        customRoleName: '',
        employmentType: '',
        userType: 'Staff',
        branchId: assignedBranchId.value,
        status: 'Active'
      }
      practitionerIdFile.value = null
      fieldErrors.value = {}
      touchedFields.value = {}
    }

    const fieldErrors = ref({})
    const touchedFields = ref({})

    const hasLetter = (value) => /[A-Za-z]/.test(String(value || ''))
    const isValidName = (value) => {
      const trimmed = String(value || '').trim()
      if (!trimmed) return false
      if (!hasLetter(trimmed)) return false
      return /^[A-Za-z][A-Za-z\s]*$/.test(trimmed)
    }

    const isValidAddress = (value) => {
      const trimmed = String(value || '').trim()
      if (!trimmed) return false
      if (!hasLetter(trimmed)) return false
      return /^[A-Za-z0-9\s.,'-]+$/.test(trimmed)
    }

    const isValidEmail = (value) => {
      const trimmed = String(value || '').trim()
      if (!trimmed) return false
      // Allow only letters, numbers, dot, underscore, and @. Must include letters in local and domain.
      if (!/^[A-Za-z0-9._@]+$/.test(trimmed)) return false
      const parts = trimmed.split('@')
      if (parts.length !== 2) return false
      const [local, domain] = parts
      if (!local || !domain) return false
      if (!hasLetter(local) || !hasLetter(domain)) return false
      if (!/^[A-Za-z0-9._]+$/.test(local)) return false
      if (!/^[A-Za-z0-9.]+$/.test(domain)) return false
      if (!domain.includes('.')) return false
      return true
    }

    const validateField = (field) => {
      const errors = { ...fieldErrors.value }
      const value = currentStaff.value[field]

      switch (field) {
        case 'firstName':
          if (!String(value || '').trim()) errors.firstName = 'First name is required.'
          else if (!isValidName(value)) errors.firstName = 'Only letters and spaces are allowed.'
          else errors.firstName = ''
          break
        case 'lastName':
          if (!String(value || '').trim()) errors.lastName = 'Last name is required.'
          else if (!isValidName(value)) errors.lastName = 'Only letters and spaces are allowed.'
          else errors.lastName = ''
          break
        case 'email':
          if (!String(value || '').trim()) errors.email = 'Email is required.'
          else if (!isValidEmail(value)) errors.email = 'Only letters, numbers, ., _, and @ are allowed.'
          else errors.email = ''
          break
        case 'phoneNumber': {
          const localPhone = normalizeLocalPhone(value)
          if (!localPhone) errors.phoneNumber = 'Phone number is required.'
          else if (localPhone.length !== 10) errors.phoneNumber = 'Enter 10 digits after +63.'
          else errors.phoneNumber = ''
          break
        }
        case 'address':
          if (!String(value || '').trim()) errors.address = 'Address is required.'
          else if (!isValidAddress(value)) errors.address = 'Only letters, numbers, spaces, comma, period, apostrophe, and hyphen are allowed.'
          else errors.address = ''
          break
        case 'role':
          errors.role = String(value || '').trim() ? '' : 'Role is required.'
          break
        case 'employmentType':
          errors.employmentType = String(value || '').trim() ? '' : 'Employment type is required.'
          break
        case 'branchId':
          errors.branchId = String(value || '').trim() ? '' : 'Branch assignment is required.'
          break
        case 'practitionerId':
          if (isPractitionerRole.value && !practitionerIdFile.value) {
            errors.practitionerId = 'Practitioner ID attachment is required.'
          } else {
            errors.practitionerId = ''
          }
          break
        default:
          break
      }

      fieldErrors.value = errors
      return !errors[field]
    }

    const markTouched = (field) => {
      touchedFields.value = { ...touchedFields.value, [field]: true }
      validateField(field)
    }

    const isPractitionerRole = computed(() => String(currentStaff.value.role || '').toLowerCase() === 'practitioner')

    watch(
      () => currentStaff.value.customRoleId,
      (nextCustomRoleId) => {
        const selectedRole = customRoles.value.find((role) => role.id === nextCustomRoleId)
        currentStaff.value.customRoleName = selectedRole?.name || ''
        currentStaff.value.role = selectedRole?.name || ''
      },
      { immediate: true }
    )

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

    const sendStaffWelcomeEmail = async ({ email, fullName }) => {
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
          defaultPassword: DEFAULT_STAFF_PASSWORD,
        }),
      })

      const contentType = String(response.headers.get('content-type') || '')
      const data = contentType.includes('application/json') ? await response.json() : null
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to send welcome email.')
      }

      return data
    }

    const validateForm = () => {
      const fields = ['firstName', 'lastName', 'email', 'phoneNumber', 'address', 'role', 'employmentType', 'branchId']
      let isValid = true
      fields.forEach((field) => {
        touchedFields.value = { ...touchedFields.value, [field]: true }
        if (!validateField(field)) isValid = false
      })
      if (isPractitionerRole.value) {
        touchedFields.value = { ...touchedFields.value, practitionerId: true }
        if (!validateField('practitionerId')) isValid = false
      }
      return isValid
    }

    watch(
      () => currentStaff.value.role,
      (next) => {
        if (String(next || '').toLowerCase() !== 'practitioner') {
          practitionerIdFile.value = null
          fieldErrors.value = { ...fieldErrors.value, practitionerId: '' }
          touchedFields.value = { ...touchedFields.value, practitionerId: false }
        }
      }
    )

    watch(
      () => ({ ...currentStaff.value }),
      (next) => {
        Object.keys(touchedFields.value).forEach((field) => {
          if (touchedFields.value[field]) {
            validateField(field)
          }
        })
      },
      { deep: true }
    )

    const saveStaff = async () => {
      if (!validateForm()) {
        toast.error('Please fix the highlighted fields.')
        return
      }

      try {
        const actorId = auth.currentUser?.uid || ''
        const localPhone = normalizeLocalPhone(currentStaff.value.phoneNumber)
        const formattedPhone = `+63${localPhone}`

        const result = await Swal.fire({
          title: 'Confirm Staff Creation',
          text: `Do you want to create an account for ${currentStaff.value.firstName} ${currentStaff.value.lastName} (${currentStaff.value.email})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, create',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Staff creation cancelled.")
          return
        }

        let userCredential
        let creatorApp = null
        let creatorAuth = null

        try {
          // Step 1: Create Auth user using a secondary app so current session is preserved.
          const appName = `staff-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`
          creatorApp = initializeApp(getApp().options, appName)
          creatorAuth = getAuth(creatorApp)
          userCredential = await createUserWithEmailAndPassword(creatorAuth, currentStaff.value.email, DEFAULT_STAFF_PASSWORD)
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

        try {
          let practitionerLicenseUrl = ''
          let practitionerLicenseName = ''

          if (isPractitionerRole.value && practitionerIdFile.value) {
            const uploaderId = auth.currentUser?.uid || 'unknown'
            const safeName = practitionerIdFile.value.name.replace(/[^\w.\-]+/g, '_')
            const filePath = `practitioner-licenses/${uploaderId}/${uid}/${Date.now()}-${safeName}`
            const fileRef = storageRef(storage, filePath)
            await uploadBytes(fileRef, practitionerIdFile.value)
            practitionerLicenseUrl = await getDownloadURL(fileRef)
            practitionerLicenseName = practitionerIdFile.value.name
          }


          // Step 2: Save to Firestore
          await setDoc(doc(db, "users", uid), {
            firstName: currentStaff.value.firstName,
            lastName: currentStaff.value.lastName,
            fullName: `${currentStaff.value.firstName} ${currentStaff.value.lastName}`,
            email: currentStaff.value.email,
            phoneNumber: formattedPhone,
            address: currentStaff.value.address,
            role: currentStaff.value.role,
            customRoleId: currentStaff.value.customRoleId || null,
            customRoleName: currentStaff.value.customRoleName || null,
            employmentType: currentStaff.value.employmentType,
            userType: 'Staff',
            branchId: currentStaff.value.branchId,   // ✅ consistent schema
            status: currentStaff.value.status ?? "Inactive",
            practitionerLicenseUrl: practitionerLicenseUrl || null,
            practitionerLicenseName: practitionerLicenseName || null,
            practitionerLicenseUploadedBy: practitionerLicenseUrl ? (auth.currentUser?.uid || null) : null,
            mustChangePassword: true,
            createdAt: new Date()
          })

          await logActivity(db, {
            actorId,
            module: 'HR',
            action: 'Added employee',
            details: `Created staff account for ${currentStaff.value.firstName} ${currentStaff.value.lastName} (${currentStaff.value.role}).`,
            targetUserId: uid,
            targetUserName: `${currentStaff.value.firstName} ${currentStaff.value.lastName}`
          })

          try {
            await sendStaffWelcomeEmail({
              email: currentStaff.value.email,
              fullName: `${currentStaff.value.firstName} ${currentStaff.value.lastName}`,
            })
          } catch (emailError) {
            console.error('Failed to send staff welcome email:', emailError)
            toast.warn('Staff member added, but the welcome email could not be sent.')
          }

          toast.success('Staff member added successfully.')
          resetForm()
        } catch (firestoreError) {
          // Step 3: Rollback Auth if Firestore fails
          await userCredential.user.delete()
          console.error("Error saving staff to Firestore:", firestoreError)
          toast.error("Failed to save staff record. Auth user was rolled back.")
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
        toast.error("Unexpected error while saving staff.")
      }
    }

    return {
      currentStaff,
      currentBranchLabel,
      customRoles,
      onPhoneInput,
      saveStaff,
      resetForm,
      fieldErrors,
      touchedFields,
      markTouched,
      handlePractitionerFile,
      practitionerIdFile,
      isPractitionerRole
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-10 text-white">
      <!-- Page Header -->
      <h1 class="text-2xl font-bold mb-6">Add Employee</h1>

      <!-- Responsive Card -->
      <div class="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700 max-w-2xl mx-auto">
        <form class="space-y-4">
<div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 mb-1">First Name</label>
              <input
                type="text"
                v-model="currentStaff.firstName"
                placeholder="Enter first name"
                @blur="markTouched('firstName')"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p v-if="touchedFields.firstName && fieldErrors.firstName" class="mt-1 text-xs text-rose-400">
                {{ fieldErrors.firstName }}
              </p>
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Last Name</label>
              <input
                type="text"
                v-model="currentStaff.lastName"
                placeholder="Enter last name"
                @blur="markTouched('lastName')"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p v-if="touchedFields.lastName && fieldErrors.lastName" class="mt-1 text-xs text-rose-400">
                {{ fieldErrors.lastName }}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Email</label>
            <input
              type="email"
              v-model="currentStaff.email"
              placeholder="Enter staff email"
              @blur="markTouched('email')"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p v-if="touchedFields.email && fieldErrors.email" class="mt-1 text-xs text-rose-400">
              {{ fieldErrors.email }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 mb-1">Phone</label>
              <div class="flex items-center rounded-lg border border-slate-600 bg-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
                <span class="px-3 py-2 text-slate-300 border-r border-slate-600">+63</span>
                <input
                  type="text"
                  inputmode="numeric"
                  maxlength="10"
                  v-model="currentStaff.phoneNumber"
                  @input="onPhoneInput"
                  @blur="markTouched('phoneNumber')"
                  placeholder="9XXXXXXXXX"
                  class="w-full px-3 py-2 bg-transparent text-white focus:outline-none"
                />
              </div>
              <p v-if="touchedFields.phoneNumber && fieldErrors.phoneNumber" class="mt-1 text-xs text-rose-400">
                {{ fieldErrors.phoneNumber }}
              </p>
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Address</label>
              <input
                type="text"
                v-model="currentStaff.address"
                placeholder="Enter staff address"
                @blur="markTouched('address')"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p v-if="touchedFields.address && fieldErrors.address" class="mt-1 text-xs text-rose-400">
                {{ fieldErrors.address }}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Role</label>
            <select
              v-model="currentStaff.customRoleId"
              @blur="markTouched('role')"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option disabled value="">Select Role</option>
              <option v-for="role in customRoles" :key="role.id" :value="role.id">
                {{ role.name }}
              </option>
            </select>
            <p v-if="touchedFields.role && fieldErrors.role" class="mt-1 text-xs text-rose-400">
              {{ fieldErrors.role }}
            </p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Employment Type</label>
            <select
              v-model="currentStaff.employmentType"
              @blur="markTouched('employmentType')"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option disabled value="">Select type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
            </select>
            <p v-if="touchedFields.employmentType && fieldErrors.employmentType" class="mt-1 text-xs text-rose-400">
              {{ fieldErrors.employmentType }}
            </p>
          </div>

          <div v-if="isPractitionerRole">
            <label class="block text-slate-400 mb-1">Practitioner ID Attachment</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              @change="(event) => { handlePractitionerFile(event); markTouched('practitionerId') }"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p v-if="touchedFields.practitionerId && fieldErrors.practitionerId" class="mt-1 text-xs text-rose-400">
              {{ fieldErrors.practitionerId }}
            </p>
          </div>

        <div>
            <label class="block text-slate-400 mb-1">Branch</label>
            <input
              type="text"
              :value="currentBranchLabel || 'No branch assigned'"
              readonly
              @blur="markTouched('branchId')"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 cursor-not-allowed"
            />
            <p v-if="touchedFields.branchId && fieldErrors.branchId" class="mt-1 text-xs text-rose-400">
              {{ fieldErrors.branchId }}
            </p>
        </div>

        <div>
            <label class="block text-slate-400 mb-1">Status</label>
            <input
                type="text"
                v-model="currentStaff.status"
                readonly
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 cursor-not-allowed"
            />
        </div>

          <div class="flex justify-end space-x-2 pt-4">
            <button 
              type="reset" 
              @click="resetForm" 
              class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition"
            >
              Cancel
            </button>
            <button 
              type="button" 
              @click="saveStaff" 
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              Add Staff
            </button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>





