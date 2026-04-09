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
import { storage } from '@/config/firebaseConfig'

const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const DEFAULT_STAFF_PASSWORD = 'password123'

export default {
  name: 'AddStaff',
  components: { OwnerSidebar, OwnerPageSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)
    const branches = ref([])
    const customRoles = ref([])
    const { initSubscription, activePlan } = useSubscription()

    const currentStaff = ref({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
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
        loading.value = false
        return
      }

      const ownerBranchesQuery = query(
        collection(db, "clinics"),
        where("ownerId", "==", user.uid)
      )
      const snapshot = await getDocs(ownerBranchesQuery)
      branches.value = snapshot.docs.map(doc => ({
        id: doc.id, // branchId reference
        branch: doc.data().clinicBranch,
        location: doc.data().clinicLocation
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

      const rolesQuery = query(
        collection(db, 'clinicRoles'),
        where('ownerId', '==', user.uid)
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
        lastName: '',
        email: '',
        phoneNumber: '',
        role: '',
        customRoleId: '',
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

    watch(() => currentStaff.value.customRoleId, (nextCustomRoleId) => {
      const selectedRole = customRoles.value.find((role) => role.id === nextCustomRoleId)
      currentStaff.value.role = selectedRole?.name || ''
    }, { immediate: true })

    const sanitizeName = (value) => value.replace(/[^A-Za-z\s]/g, '')
    const sanitizeEmail = (value) => value.replace(/[^A-Za-z0-9@._]/g, '')
    const sanitizePhone = (value) => value.replace(/\D/g, '')

    const handleFirstNameInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.firstName = sanitizeName(value)
    }

    const handleLastNameInput = (event) => {
      const value = event?.target?.value ?? ''
      currentStaff.value.lastName = sanitizeName(value)
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
        lastName: '',
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

      if (!currentStaff.value.lastName.trim()) {
        errors.lastName = 'Last name is required.'
      } else if (!nameRegex.test(currentStaff.value.lastName.trim())) {
        errors.lastName = 'Only letters and spaces are allowed.'
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

    const hasErrors = computed(() => Object.values(fieldErrors.value).some(Boolean))
    const isPractitionerRole = computed(() => String(currentStaff.value.role || '').toLowerCase() === 'practitioner')
    const selectedCustomRoleName = computed(() => {
      const match = customRoles.value.find((role) => role.id === currentStaff.value.customRoleId)
      return match?.name || ''
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

    const saveStaff = async () => {
      if (hasErrors.value) {
        const firstError = Object.values(fieldErrors.value).find(Boolean)
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      try {
        const result = await Swal.fire({
          title: 'Confirm Employee Creation',
          text: `Do you want to create an account for ${currentStaff.value.firstName} ${currentStaff.value.lastName} (${currentStaff.value.email})?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, create',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Employee creation cancelled.")
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
            lastName: currentStaff.value.lastName,
            fullName: `${currentStaff.value.firstName} ${currentStaff.value.lastName}`,
            email: currentStaff.value.email,
            phoneNumber: `+63${currentStaff.value.phoneNumber}`,
            role: currentStaff.value.role,
            customRoleId: currentStaff.value.customRoleId || null,
            customRoleName: selectedCustomRoleName.value || null,
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
              fullName: `${currentStaff.value.firstName} ${currentStaff.value.lastName}`,
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
      loadBranches,
      updateLocation,
      fieldErrors,
      hasErrors,
      handleFirstNameInput,
      handleLastNameInput,
      handleEmailInput,
      handlePhoneInput,
      handlePractitionerFile,
      practitionerIdFile,
      isPractitionerRole,
      isFormEmpty,
      isBasicPlan,
      customRoles
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-10 text-white">
      <OwnerPageSkeleton v-if="loading" />
      <div v-else>
      <h1 class="text-2xl font-bold mb-6">Add Employee</h1>

      <div class="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700 max-w-2xl mx-auto">
        <form class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 mb-1">First Name</label>
              <input
                type="text"
                v-model="currentStaff.firstName"
                placeholder="Enter first name"
                @input="handleFirstNameInput"
                :class="[
                  'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:outline-none focus:ring-2',
                  fieldErrors.firstName ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
                ]"
              />
              <p v-if="fieldErrors.firstName" class="mt-1 text-xs text-red-400">{{ fieldErrors.firstName }}</p>
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Last Name</label>
              <input
                type="text"
                v-model="currentStaff.lastName"
                placeholder="Enter last name"
                @input="handleLastNameInput"
                :class="[
                  'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:outline-none focus:ring-2',
                  fieldErrors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
                ]"
              />
              <p v-if="fieldErrors.lastName" class="mt-1 text-xs text-red-400">{{ fieldErrors.lastName }}</p>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Email</label>
            <input
              type="email"
              v-model="currentStaff.email"
              placeholder="Enter employee email"
              @input="handleEmailInput"
              :class="[
                'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:outline-none focus:ring-2',
                fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
              ]"
            />
            <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-400">{{ fieldErrors.email }}</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Phone Number</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">+63</span>
              <input
                type="text"
                v-model="currentStaff.phoneNumber"
                placeholder="Enter 10-digit mobile number"
                @input="handlePhoneInput"
                inputmode="numeric"
                :class="[
                  'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:outline-none focus:ring-2 pl-12',
                  fieldErrors.phoneNumber ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
                ]"
              />
            </div>
            <p v-if="fieldErrors.phoneNumber" class="mt-1 text-xs text-red-400">{{ fieldErrors.phoneNumber }}</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Roles</label>
            <select
              v-model="currentStaff.customRoleId"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select role</option>
              <option v-for="role in customRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Assign one of the clinic admin's saved roles.</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Employment Type</label>
            <select
              v-model="currentStaff.employmentType"
              :class="[
                'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:ring-2',
                fieldErrors.employmentType ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
              ]"
            >
              <option disabled value="">Select type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
            </select>
            <p v-if="fieldErrors.employmentType" class="mt-1 text-xs text-red-400">{{ fieldErrors.employmentType }}</p>
          </div>

          <div v-if="isPractitionerRole">
            <label class="block text-slate-400 mb-1">Practitioner ID Attachment</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              @change="handlePractitionerFile"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
            <p v-if="fieldErrors.practitionerId" class="mt-1 text-xs text-red-400">{{ fieldErrors.practitionerId }}</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Branch</label>
            <select
              v-if="!isBasicPlan"
              v-model="currentStaff.clinicBranch"
              @change="updateLocation"
              :class="[
                'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:ring-2',
                fieldErrors.clinicBranch ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
              ]">
              <option disabled value="">Select Branch</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                {{ branch.branch }} - {{ branch.location }}
              </option>
            </select>
            <input
              v-else
              type="text"
              readonly
              :value="branches.find(b => b.id === currentStaff.clinicBranch)?.branch || ''"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 cursor-not-allowed"
            />
            <p v-if="fieldErrors.clinicBranch" class="mt-1 text-xs text-red-400">{{ fieldErrors.clinicBranch }}</p>
          </div>

           <div>
            <label class="block text-slate-400 mb-1">Clinic Location</label>
            <input
              type="text"
              v-model="currentStaff.clinicLocation"
              readonly
              :class="[
                'w-full px-3 py-2 rounded-lg bg-slate-700 text-white border focus:ring-2 cursor-not-allowed',
                fieldErrors.clinicLocation ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'
              ]"
            />
            <p v-if="fieldErrors.clinicLocation" class="mt-1 text-xs text-red-400">{{ fieldErrors.clinicLocation }}</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Status</label>
            <input type="text" v-model="currentStaff.status" readonly
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 cursor-not-allowed"
            />
          </div>

          <!-- Buttons -->
          <div class="flex justify-end space-x-2 pt-4">
            <button type="reset" @click="resetForm" :disabled="isFormEmpty" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition
              disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="button" @click="saveStaff" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
              Add Employee
            </button>
          </div>
        </form>
      </div>
      </div>
    </main>
  </div>
</template>
