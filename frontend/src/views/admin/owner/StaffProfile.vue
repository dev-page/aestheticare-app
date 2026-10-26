<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getFirestore, collection, getDocs, onSnapshot, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { compensationApi } from '@/utils/compensationApi'
import { employeeSpecialtyTypes } from '../../../../../shared/practitionerTeam.js'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { storage } from '@/config/firebaseConfig'

export default {
  name: 'OwnerStaff',
  components: { OwnerSidebar, Modal, ContractAppearanceSelect },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const staffList = ref([])
    const branches = ref([])
    const customRoles = ref([])
    const currentOwnerId = ref('')

    const showEditModal = ref(false)
    const searchQuery = ref('')
    const editErrors = ref({})
    const loadingSpecialty = ref(false)
    const specialtyError = ref('')
    const savingEmployee = ref(false)
    const originalSpecialty = ref({ type: '', credentialNumber: '' })
    const licenseFile = ref(null)
    const licenseOcrResult = ref(null)
    const licenseOcrBusy = ref(false)
    let licenseOcrSequence = 0
    const showLicenseField = computed(() => Boolean(String(currentStaff.value.practitionerType || '').trim() || String(currentStaff.value.credentialNumber || '').trim()))
    let staffUnsubscribers = []

    const currentStaff = ref({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
      customRoleIds: [],
      customRoleName: '',
      branchId: '',
      branchIds: [],
      userType: 'Staff',
      status: 'Active'
    })

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const clearStaffListeners = () => {
      staffUnsubscribers.forEach((unsubscribe) => unsubscribe?.())
      staffUnsubscribers = []
    }

    const applyStaffDocs = (staffDocs) => {
      const uniqueStaff = Array.from(new Map(staffDocs.map((staff) => [staff.id, staff])).values())
        .filter((user) => !user.archived)
      staffList.value = sortRecordsNewestFirst(uniqueStaff.map(staff => {
        const assignedBranchIds = Array.isArray(staff.branchIds) && staff.branchIds.length ? staff.branchIds : [staff.branchId].filter(Boolean)
        const branch = branches.value.find(b => b.id === staff.branchId)
        return {
          ...staff,
          clinicBranch: branch ? branch.clinicBranch : '',
          clinicLocation: branch ? branch.clinicLocation : '',
          assignedBranchNames: assignedBranchIds.map(id => branches.value.find(b => b.id === id)?.clinicBranch || id),
          customRoleName: String(staff.customRoleName || '').trim(),
          createdAt: staff.archivedAt || staff.createdAt || staff.updatedAt || null,
        }
      }))
    }

    const subscribeStaff = () => {
      clearStaffListeners()
      const ownerBranchIds = branches.value.map(branch => branch.id).filter(Boolean)
      if (ownerBranchIds.length === 0) {
        staffList.value = []
        return
      }

      const chunks = chunkArray(ownerBranchIds)
      const recordsByChunk = chunks.map(() => [])
      chunks.forEach((chunk, chunkIndex) => {
        const staffQuery = query(
          collection(db, "users"),
          where("branchId", "in", chunk),
          where("userType", "==", "Staff")
        )
        const unsubscribe = pageListener(onSnapshot, staffQuery, (snapshot) => {
          recordsByChunk[chunkIndex] = snapshot.docs.map((staffDoc) => ({ id: staffDoc.id, ...staffDoc.data() }))
          applyStaffDocs(recordsByChunk.flat())
        }, (error) => {
          console.error('Failed to subscribe to employee updates:', error)
          toast.error('Live employee updates are temporarily unavailable.')
        })
        staffUnsubscribers.push(unsubscribe)
      })
    }

    const loadBranches = trackPageLoad(async () => {
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        currentOwnerId.value = ''
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid
      const branchDocs = await loadClinicDocsByIds(db, scope.branchIds?.length ? scope.branchIds : [scope.branchId || ''])
      branches.value = branchDocs.map((branch) => ({
        id: branch.id,
        clinicBranch: branch.clinicBranch,
        clinicLocation: branch.clinicLocation
      }))
    })

    const loadCustomRoles = trackPageLoad(async () => {
      const user = auth.currentUser
      if (!user) {
        customRoles.value = []
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid

      const rolesSnapshot = await getDocs(
        query(collection(db, 'clinicRoles'), where('ownerId', '==', currentOwnerId.value))
      )
      customRoles.value = rolesSnapshot.docs
        .map((roleDoc) => {
          const data = roleDoc.data() || {}
          const permissions = Array.isArray(data.permissions)
            ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
            : []

          return {
            id: roleDoc.id,
            name: String(data.name || '').trim(),
            permissions,
          }
        })
        .filter((role) => role.name && role.permissions.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name))
    })

    onMounted(trackPageLoad(async() => {
      await loadBranches()
      await loadCustomRoles()
      subscribeStaff()

    }))

    onUnmounted(() => clearStaffListeners())

    watch(
      () => currentStaff.value.customRoleIds,
      (nextCustomRoleIds) => {
        const ids = Array.isArray(nextCustomRoleIds) ? nextCustomRoleIds : []
        const selectedRoles = customRoles.value.filter((role) => ids.includes(role.id))
        currentStaff.value.customRoleId = ids[0] || ''
        currentStaff.value.customRoleName = selectedRoles.map((role) => role.name).join(', ')
        currentStaff.value.role = selectedRoles.map((role) => role.name).join(', ') || currentStaff.value.role || ''
      },
      { deep: true }
    )

    const openEditModal = async (staff) => {
      editErrors.value = {}
      licenseFile.value = null
      licenseOcrResult.value = null
      licenseOcrBusy.value = false
      licenseOcrSequence += 1
      currentStaff.value = {
        ...staff,
        practitionerType: staff.practitionerType || '',
        credentialNumber: '',
        customRoleId: String(staff.customRoleId || '').trim(),
        customRoleIds: Array.isArray(staff.customRoleIds) && staff.customRoleIds.length
          ? staff.customRoleIds
          : [String(staff.customRoleId || '').trim()].filter(Boolean),
        customRoleName: String(staff.customRoleName || '').trim(),
        branchIds: Array.isArray(staff.branchIds) && staff.branchIds.length ? staff.branchIds : [staff.branchId].filter(Boolean),
      }
      showEditModal.value = true
      loadingSpecialty.value = true
      specialtyError.value = ''
      try {
        const details = await compensationApi(`/staff/${staff.id}/practitioner-details`)
        if (currentStaff.value.id !== staff.id) return
        currentStaff.value.practitionerType = details.type
        currentStaff.value.credentialNumber = details.credentialNumber
        originalSpecialty.value = { ...details }
      } catch (error) { specialtyError.value = 'Unable to load specialty and license details. Close and reopen the employee after restarting the updated backend.' }
      finally { loadingSpecialty.value = false }
    }

    const clearEditError = (field) => {
      if (!editErrors.value[field]) return
      const nextErrors = { ...editErrors.value }
      delete nextErrors[field]
      editErrors.value = nextErrors
    }

    const handleLicenseFile = async event => {
      const sequence = ++licenseOcrSequence
      licenseOcrBusy.value = false
      const file = event?.target?.files?.[0] || null
      licenseFile.value = null
      licenseOcrResult.value = null
      if (!file) return
      const contentType = String(file.type || '').toLowerCase()
      if (!['image/jpeg', 'image/png'].includes(contentType)) {
        toast.error('Upload one JPEG or PNG image so OCR can read the credential.')
        event.target.value = ''
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be 5MB or smaller.')
        event.target.value = ''
        return
      }
      licenseFile.value = file
      const branchId = String(currentStaff.value.branchId || currentStaff.value.branchIds?.[0] || '').trim()
      if (!branchId) {
        licenseOcrResult.value = { status: 'manual_review', reason: 'No clinic branch is assigned. Enter the license number manually and ask the clinic owner to review the document.' }
        return
      }
      licenseOcrBusy.value = true
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
          reader.onerror = () => reject(new Error('Unable to read the selected image.'))
          reader.readAsDataURL(file)
        })
        const token = await auth.currentUser?.getIdToken()
        const response = await fetch(`${OTP_API_BASE}/practitioner-license/ocr`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchId, employeeId: currentStaff.value.id, contentType, base64 }) })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to process this credential image.')
        if (sequence !== licenseOcrSequence) return
        licenseOcrResult.value = payload.data || null
        if (payload.data?.licenseNumber) currentStaff.value.credentialNumber = payload.data.licenseNumber
      } catch (error) {
        if (sequence === licenseOcrSequence) licenseOcrResult.value = { status: 'manual_review', reason: error.message || 'OCR is unavailable. Enter the number manually and review the document.' }
      } finally {
        if (sequence === licenseOcrSequence) licenseOcrBusy.value = false
      }
    }

    const normalizePhoneNumber = (value) => {
      const digits = String(value || '').replace(/\D/g, '')
      if (digits.startsWith('63') && digits.length === 12) return `+${digits}`
      if (digits.startsWith('0') && digits.length === 11) return `+63${digits.slice(1)}`
      if (digits.startsWith('9') && digits.length === 10) return `+63${digits}`
      return ''
    }

    const validateEditStaff = () => {
      const staff = currentStaff.value
      const errors = {}
      const nameRegex = /^[A-Za-z\s]+$/
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!String(staff.firstName || '').trim()) errors.firstName = 'First name is required.'
      else if (!nameRegex.test(String(staff.firstName).trim())) errors.firstName = 'Only letters and spaces are allowed.'
      if (!String(staff.lastName || '').trim()) errors.lastName = 'Last name is required.'
      else if (!nameRegex.test(String(staff.lastName).trim())) errors.lastName = 'Only letters and spaces are allowed.'
      if (!String(staff.email || '').trim()) errors.email = 'Email is required.'
      else if (!emailRegex.test(String(staff.email).trim())) errors.email = 'Enter a valid email address.'
      if (!String(staff.phoneNumber || '').trim()) errors.phoneNumber = 'Phone number is required.'
      else if (!normalizePhoneNumber(staff.phoneNumber)) errors.phoneNumber = 'Enter a valid Philippine mobile number.'
      if (!Array.isArray(staff.branchIds) || !staff.branchIds.length) errors.branchId = 'Select at least one branch.'
      if (!String(staff.clinicLocation || '').trim()) errors.clinicLocation = 'Clinic location is required.'
      if (staff.practitionerType && !employeeSpecialtyTypes.includes(staff.practitionerType)) errors.practitionerType = 'Choose one of the suggested professional specialties.'

      editErrors.value = errors
      return Object.keys(errors).length === 0
    }

    const updateCurrentStaffLocation = () => {
      currentStaff.value.branchId = currentStaff.value.branchIds?.[0] || ''
      const branch = branches.value.find((entry) => entry.id === currentStaff.value.branchId)
      currentStaff.value.clinicBranch = branch?.clinicBranch || ''
      currentStaff.value.clinicLocation = branch?.clinicLocation || ''
    }

    const deactivateStaff = async (staff) => {
      const fullName = `${staff.firstName} ${staff.lastName}`
      if (staff.status === 'Active') {
        const result = await Swal.fire({
          title: 'Confirm Deactivation',
          text: `Are you sure you want to deactivate ${fullName}? They will not be able to log in.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, deactivate',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Deactivation cancelled.")
          return
        }

        try {
          const staffRef = doc(db, "users", staff.id)
          await updateDoc(staffRef, { status: 'Inactive', archived: true, archivedAt: serverTimestamp() })
          staff.status = 'Inactive'
          toast.success(`${fullName} has been deactivated.`)
        } catch (error) {
          console.error(error)
          toast.error("Failed to deactivate staff.")
        }
      } else {
        try {
          const staffRef = doc(db, "users", staff.id)
          await updateDoc(staffRef, { status: 'Active', archived: false, archivedAt: null })
          staff.status = 'Active'
          toast.success(`${fullName} has been reactivated.`)
        } catch (error) {
          console.error(error)
          toast.error("Failed to reactivate staff.")
        }
      }
    }


    const saveStaff = async () => {
      if (savingEmployee.value || loadingSpecialty.value || licenseOcrBusy.value || specialtyError.value) return
      const { firstName, lastName, email, phoneNumber, clinicBranch, clinicLocation } = currentStaff.value
      const fullName = `${firstName} ${lastName}`
      const selectedRoleIds = Array.isArray(currentStaff.value.customRoleIds)
        ? currentStaff.value.customRoleIds
        : [currentStaff.value.customRoleId].filter(Boolean)
      const selectedRoleNames = customRoles.value
        .filter((entry) => selectedRoleIds.includes(entry.id))
        .map((entry) => entry.name)

      if (!validateEditStaff()) {
        const firstError = Object.values(editErrors.value)[0]
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)

      try {
        if (currentStaff.value.id) {
          const result = await Swal.fire({
            title: 'Confirm Update',
            text: `Do you want to update ${fullName}'s information?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, update',
            cancelButtonText: 'Cancel'
          })

          if (!result.isConfirmed) {
            toast.info("Update cancelled.")
            return
          }

          const staffRef = doc(db, "users", currentStaff.value.id)
          savingEmployee.value = true
          const token = await auth.currentUser?.getIdToken()
          const branchResponse = await fetch(`${OTP_API_BASE}/staff/${currentStaff.value.id}/branch-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchIds: currentStaff.value.branchIds }) })
          const branchPayload = await branchResponse.json()
          if (!branchResponse.ok) throw new Error(branchPayload.error || 'Unable to update assigned branches.')
          let licenseDocument = null
          if (licenseFile.value) {
            const ownerId = auth.currentUser?.uid
            const safeName = licenseFile.value.name.replace(/[^\w.\-]+/g, '_')
            const path = `practitioner-licenses/${ownerId}/${currentStaff.value.id}/${Date.now()}-${safeName}`
            const fileRef = storageRef(storage, path)
            await uploadBytes(fileRef, licenseFile.value)
            licenseDocument = { url: await getDownloadURL(fileRef), name: licenseFile.value.name }
          }
          if (currentStaff.value.practitionerType !== originalSpecialty.value.type || currentStaff.value.credentialNumber !== originalSpecialty.value.credentialNumber || licenseDocument) {
            await compensationApi(`/staff/${currentStaff.value.id}/practitioner-details`, 'POST', { type: currentStaff.value.practitionerType, credentialNumber: currentStaff.value.credentialNumber, licenseDocument })
          }
          const nextStatus = currentStaff.value.status
          const shouldArchive = String(nextStatus || '').trim().toLowerCase() === 'inactive'
          await updateDoc(staffRef, { 
            firstName: currentStaff.value.firstName.trim(),
            lastName: currentStaff.value.lastName.trim(),
            fullName: `${currentStaff.value.firstName.trim()} ${currentStaff.value.lastName.trim()}`.trim(),
            email: currentStaff.value.email.trim(),
            phoneNumber: normalizedPhoneNumber,
            role: selectedRoleNames.join(', ') || currentStaff.value.role || null,
            customRoleId: selectedRoleIds[0] || null,
            customRoleIds: selectedRoleIds,
            customRoleName: selectedRoleNames.join(', ') || null,
            effectivePermissions: [...new Set(customRoles.value
              .filter((entry) => selectedRoleIds.includes(entry.id))
              .flatMap((entry) => entry.permissions || []))],
            status: nextStatus,
            archived: shouldArchive,
            archivedAt: shouldArchive ? serverTimestamp() : null
          })
          toast.success(`${fullName}'s information updated successfully!`)
          showEditModal.value = false
        }
      } catch (err) {
        console.error(err)
        toast.error(err.message || 'Unable to save employee changes.')
      } finally {
        savingEmployee.value = false
      }
    }

    const filteredStaffList = computed(() => {
      const records = Array.isArray(staffList.value) ? staffList.value : []
      if (!searchQuery.value.trim()) return records
      const query = searchQuery.value.toLowerCase()
      return records.filter(staff =>
        [staff.firstName, staff.lastName, staff.fullName, staff.email, staff.role].some((value) =>
          String(value || '').toLowerCase().includes(query)
        ) ||
        (staff.clinicBranch && staff.clinicBranch.toLowerCase().includes(query)) ||
        (staff.clinicLocation && staff.clinicLocation.toLowerCase().includes(query))
      )
    })

    return {
      pageLoading,
      staffList,
      branches,
      showEditModal,
      currentStaff,
      editErrors,
      clearEditError,
      openEditModal,
      updateCurrentStaffLocation,
      deactivateStaff,
      saveStaff,
      searchQuery,
      filteredStaffList,
      customRoles,
      practitionerTypes, loadingSpecialty, specialtyError, showLicenseField, savingEmployee,
      licenseFile, licenseOcrResult, licenseOcrBusy, handleLicenseFile
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme w-full" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5, header: false }" :is="embedded ? 'div' : 'main'" class="staff-management-main flex-1 min-w-0" :class="embedded ? '' : 'p-4 sm:p-6 lg:p-8'">
      <!-- Header -->
      <div v-if="!embedded" class="mb-6 flex flex-col gap-2">
        <div>
          <p class="staff-eyebrow">People & access</p>
          <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Employee Management</h1>
          <p class="text-slate-400 text-sm md:text-base">Manage employee accounts and roles at branch level.</p>
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-4">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search employees, roles, branches..."
          aria-label="Search employees"
          class="staff-search w-full max-w-xl px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Employee Table -->
      <div class="staff-list-shell bg-slate-800 rounded-xl p-3 sm:p-5 border border-slate-700">
        <div class="staff-list-heading">
          <div>
            <h2 class="text-lg font-semibold text-white">Employee accounts</h2>
            <p class="text-sm text-slate-400">{{ filteredStaffList.length }} employee{{ filteredStaffList.length === 1 ? '' : 's' }} shown</p>
          </div>
          <span class="staff-list-caption">Use Edit to update access or branch assignment</span>
        </div>

        <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left border-collapse staff-table">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-2 sm:py-3 sm:px-4">Name</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Email</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Phone Number</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Role</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Branch</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Location</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Status</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-for="staff in filteredStaffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <!-- Name column now combines firstName + lastName -->
              <td class="py-2 px-2 sm:py-3 sm:px-4 font-medium">{{ staff.firstName }} {{ staff.lastName }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.email }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.phoneNumber || '-' }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <div>{{ staff.role || '-' }}<span v-if="staff.practitionerType"> / {{ staff.practitionerType }}</span></div>
                <div v-if="staff.customRoleName" class="text-xs text-cyan-300">{{ staff.customRoleName }}</div>
              </td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.assignedBranchNames?.join(', ') || staff.clinicBranch }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.clinicLocation || '-' }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <span
                  :class="[
                    'inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium',
                    staff.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  ]"
                >
                  {{ staff.status }}
                </span>
              </td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <div class="flex flex-wrap gap-2">
                <button type="button" @click="openEditModal(staff)" :aria-label="`Edit ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Edit employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-white transition hover:bg-yellow-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.1 2.1 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621"/><path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></g></svg>
                </button>
                <button type="button" @click="deactivateStaff(staff)" :aria-label="`Disable ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Disable employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h32v32H0z" fill="none"/><path fill="currentColor" d="M2.293 2.293a1 1 0 0 1 1.414 0l26 26a1 1 0 1 1-1.414 1.414l-3.127-3.127A13.94 13.94 0 0 1 16 30C8.268 30 2 23.732 2 16c0-3.506 1.288-6.712 3.418-9.168L2.293 3.707a1 1 0 0 1 0-1.414m4.545 5.959A11.95 11.95 0 0 0 4 16c0 6.627 5.373 12 12 12c2.954 0 5.656-1.07 7.746-2.84l-2.554-2.554C19.912 23.805 18.062 24.5 16 24.5c-3.866 0-7-2.428-7-6.071A2.43 2.43 0 0 1 11.429 16h3.157zM16 2c7.732 0 14 6.268 14 14c0 2.962-.921 5.708-2.491 7.97l-1.444-1.442A11.94 11.94 0 0 0 28 16c0-6.627-5.373-12-12-12c-2.409 0-4.65.712-6.53 1.934L8.028 4.49A13.94 13.94 0 0 1 16 2m4.571 14A2.43 2.43 0 0 1 23 18.429q-.002.494-.077.957L19.538 16zM16 7a3.75 3.75 0 0 1 1.653 7.115l-5.02-5.02A3.75 3.75 0 0 1 16 7"/></svg>
                </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredStaffList.length === 0">
              <td colspan="8" class="py-6 text-center text-slate-400">No Results Found</td>
            </tr>
          </tbody>
        </table>
        </div>

        <div class="space-y-3 md:hidden">
          <article v-for="staff in filteredStaffList" :key="`card-${staff.id}`" class="staff-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-white">{{ staff.fullName || `${staff.firstName} ${staff.lastName}` }}</h3>
                <p class="truncate text-sm text-slate-400">{{ staff.email || '-' }}</p>
              </div>
              <span
                :class="[
                  'shrink-0 inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
                  staff.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                ]"
              >{{ staff.status }}</span>
            </div>
            <dl class="staff-card-details">
              <div><dt>Role</dt><dd>{{ staff.role || '-' }}</dd></div>
              <div><dt>Assigned branches</dt><dd>{{ staff.assignedBranchNames?.join(', ') || staff.clinicBranch || '-' }}</dd></div>
              <div><dt>Location</dt><dd>{{ staff.clinicLocation || '-' }}</dd></div>
              <div><dt>Phone</dt><dd>{{ staff.phoneNumber || '-' }}</dd></div>
            </dl>
            <div class="flex gap-2 border-t border-slate-700/80 pt-3">
              <button type="button" @click="openEditModal(staff)" :aria-label="`Edit ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Edit employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-white transition hover:bg-yellow-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.1 2.1 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621"/><path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></g></svg>
              </button>
              <button type="button" @click="deactivateStaff(staff)" :aria-label="`Disable ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Disable employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h32v32H0z" fill="none"/><path fill="currentColor" d="M2.293 2.293a1 1 0 0 1 1.414 0l26 26a1 1 0 1 1-1.414 1.414l-3.127-3.127A13.94 13.94 0 0 1 16 30C8.268 30 2 23.732 2 16c0-3.506 1.288-6.712 3.418-9.168L2.293 3.707a1 1 0 0 1 0-1.414m4.545 5.959A11.95 11.95 0 0 0 4 16c0 6.627 5.373 12 12 12c2.954 0 5.656-1.07 7.746-2.84l-2.554-2.554C19.912 23.805 18.062 24.5 16 24.5c-3.866 0-7-2.428-7-6.071A2.43 2.43 0 0 1 11.429 16h3.157zM16 2c7.732 0 14 6.268 14 14c0 2.962-.921 5.708-2.491 7.97l-1.444-1.442A11.94 11.94 0 0 0 28 16c0-6.627-5.373-12-12-12c-2.409 0-4.65.712-6.53 1.934L8.028 4.49A13.94 13.94 0 0 1 16 2m4.571 14A2.43 2.43 0 0 1 23 18.429q-.002.494-.077.957L19.538 16zM16 7a3.75 3.75 0 0 1 1.653 7.115l-5.02-5.02A3.75 3.75 0 0 1 16 7"/></svg>
              </button>
            </div>
          </article>
          <div v-if="filteredStaffList.length === 0" class="py-8 text-center text-slate-400">No Results Found</div>
        </div>
      </div>

      <!-- Edit Modal -->
      <Modal :isOpen="showEditModal" panelClass="employee-edit-modal" :panel-style="{ maxWidth: '720px', background: '#fffdf9', color: '#3d281d' }" :close-on-backdrop="!savingEmployee" @close="!savingEmployee && (showEditModal = false)">
        <template #header>
          <div><p class="employee-edit-eyebrow">EMPLOYEE PROFILE</p><h2 class="employee-edit-title">Edit Employee</h2><p class="employee-edit-caption">Update personal details, assignments, and professional information.</p></div>
        </template>

        <template #body>
          <form id="employee-edit-form" class="employee-edit-form space-y-4" @submit.prevent="saveStaff">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 mb-1">First Name</label>
                <input type="text" v-model="currentStaff.firstName" @input="clearEditError('firstName')" placeholder="First Name"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                <p v-if="editErrors.firstName" class="mt-1 text-xs text-red-300">{{ editErrors.firstName }}</p>
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Last Name</label>
                <input type="text" v-model="currentStaff.lastName" @input="clearEditError('lastName')" placeholder="Last Name"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                <p v-if="editErrors.lastName" class="mt-1 text-xs text-red-300">{{ editErrors.lastName }}</p>
              </div>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Email</label>
              <input type="email" v-model="currentStaff.email" @input="clearEditError('email')" placeholder="Enter email"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <p v-if="editErrors.email" class="mt-1 text-xs text-red-300">{{ editErrors.email }}</p>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Phone Number</label>
              <input type="tel" v-model="currentStaff.phoneNumber" @input="clearEditError('phoneNumber')" placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <p class="mt-1 text-xs text-slate-400">Use a valid Philippine mobile number.</p>
              <p v-if="editErrors.phoneNumber" class="mt-1 text-xs text-red-300">{{ editErrors.phoneNumber }}</p>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Custom Role</label>
              <div class="employee-edit-choices"><label v-for="role in customRoles" :key="role.id"><input v-model="currentStaff.customRoleIds" type="checkbox" :value="role.id" /><span>{{ role.name }}</span></label><p v-if="!customRoles.length">No custom roles available.</p></div>
              <p class="mt-1 text-xs text-slate-400">Select all roles this employee needs.</p>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Assigned Branches</label>
              <div class="employee-edit-choices"><label v-for="branch in branches" :key="branch.id"><input v-model="currentStaff.branchIds" type="checkbox" :value="branch.id" @change="updateCurrentStaffLocation(); clearEditError('branchId')" /><span>{{ branch.clinicBranch }} — {{ branch.clinicLocation }}</span></label></div>
              <p class="mt-1 text-xs text-slate-400">Select one or more branches. The first branch is the primary branch.</p>
              <p v-if="editErrors.branchId" class="mt-1 text-xs text-red-300">{{ editErrors.branchId }}</p>
              </div>

            <div>
              <label class="block text-slate-400 mb-1">Clinic Location</label>
              <input type="text" readonly v-model="currentStaff.clinicLocation" placeholder="Enter clinic location"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <p v-if="editErrors.clinicLocation" class="mt-1 text-xs text-red-300">{{ editErrors.clinicLocation }}</p>
            </div>

            <div>
              <ContractAppearanceSelect id="employee-edit-status" v-model="currentStaff.status" label="Status" :options="currentStaff.status === 'Pending Activation' ? [{ value: 'Pending Activation', label: 'Pending Activation' }, { value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] : [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]" />
            </div>
            <fieldset class="employee-professional-fields" :disabled="loadingSpecialty || savingEmployee || !!specialtyError">
              <legend>Professional information</legend>
              <p v-if="loadingSpecialty" role="status" class="employee-edit-caption">Loading professional details...</p>
              <ContractAppearanceSelect id="employee-edit-specialty" label="Professional specialty (optional)" v-model="currentStaff.practitionerType" :options="[{ value: '', label: 'Not specified / non-clinical' }, ...employeeSpecialtyTypes.map(type => ({ value: type, label: type }))]" @update:model-value="clearEditError('practitionerType')" />
              <p class="employee-edit-caption">This employee reference does not grant system access. Pharmacy access comes from the assigned role; appointment practitioner types and service approvals are managed separately.</p>
              <p v-if="editErrors.practitionerType" class="employee-edit-error" role="alert">{{ editErrors.practitionerType }}</p>
              <template v-if="showLicenseField">
                <label for="employee-edit-license">Credential / license number</label><input id="employee-edit-license" v-model.trim="currentStaff.credentialNumber" maxlength="100" placeholder="OCR suggestion appears here; review or enter it" />
                <p class="employee-edit-caption">Changing professional details or the uploaded document requires a new credential review by the clinic owner.</p>
                <p v-if="currentStaff.practitionerLicenseName && !licenseFile" class="employee-edit-caption">Current document: {{ currentStaff.practitionerLicenseName }}</p>
                <a v-if="currentStaff.practitionerLicenseUrl && !licenseFile" class="employee-license-link" :href="currentStaff.practitionerLicenseUrl" target="_blank" rel="noopener">View current license document</a>
                <label for="employee-edit-license-file" class="employee-license-upload-label">Upload a replacement license image (optional)</label>
                <input id="employee-edit-license-file" type="file" accept="image/jpeg,image/png" @change="handleLicenseFile" />
                <p class="employee-edit-caption">One JPEG or PNG image, up to 5MB. OCR only suggests a number; check the image and verify the credential manually.</p>
                <p v-if="licenseOcrBusy" class="employee-edit-caption" role="status">Reading the credential with OCR…</p>
                <div v-else-if="licenseOcrResult" class="employee-license-ocr" aria-live="polite"><strong>OCR suggestion · owner review required</strong><p>{{ licenseOcrResult.reason }}</p><p v-if="licenseOcrResult.confidence != null">Text recognition confidence: {{ Math.round(licenseOcrResult.confidence * 100) }}%</p><details v-if="licenseOcrResult.extractedText"><summary>View extracted text</summary><pre>{{ licenseOcrResult.extractedText }}</pre></details></div>
              </template>
            </fieldset>
            <p v-if="specialtyError" class="employee-edit-error" role="alert">{{ specialtyError }}</p>
          </form>
        </template>

        <template #footer>
          <div class="flex flex-col sm:flex-row justify-end sm:space-x-2 space-y-2 sm:space-y-0">
            <button type="button" :disabled="savingEmployee" @click="showEditModal = false" class="employee-edit-cancel">Cancel</button>
            <button type="submit" form="employee-edit-form" :disabled="savingEmployee || loadingSpecialty || licenseOcrBusy || !!specialtyError" class="employee-edit-save">{{ savingEmployee ? 'Saving...' : 'Update Employee' }}</button>
          </div>
        </template>
      </Modal>
    </component>
  </div>
</template>

<style scoped>
:global(.app-modal-panel.employee-edit-modal) { background: #fffdf9 !important; color: #3d281d !important; border: 1px solid #ecd6be; border-radius: 16px; }
:global(.employee-edit-modal > div:first-child), :global(.employee-edit-modal > div:last-child) { background: #fffdf9; padding: 20px 24px; }
:global(.employee-edit-modal > div:first-child > button) { color: #765d4c; border: 1px solid #ecd6be; border-radius: 8px; padding: 5px; }
.employee-edit-eyebrow { color: #9b603d; font-size: 10px; letter-spacing: .15em; font-weight: 700; }
.employee-edit-title { color: #3d281d; font-size: 23px; font-weight: 700; margin: 5px 0; }
.employee-edit-caption { font-size: 12px; color: #765d4c !important; line-height: 1.6; margin-top: 6px; }
.employee-edit-form { padding: 4px 8px; color: #3d281d; }
.employee-edit-form label { color: #5d4536 !important; font-size: 13px; font-weight: 600; }
.employee-edit-form input:not([type=checkbox]) { display: block; width: 100%; padding: 11px 12px; min-height: 44px; margin-top: 6px; border: 1px solid #dec19e !important; border-radius: 9px; background: #fffdf9 !important; color: #3d281d !important; }
.employee-edit-form input:read-only { background: #f7f0e6 !important; }
.employee-edit-form input:focus { outline: 2px solid #d7aa7d; outline-offset: 2px; }
.employee-edit-form :is(.text-slate-400, .text-white) { color: #765d4c !important; }
.employee-edit-form :deep(.appearance-select) { margin: 0; }
.employee-edit-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; border: 1px solid #ecd6be; border-radius: 10px; max-height: 180px; overflow-y: auto; }
.employee-edit-choices label { display: flex; align-items: flex-start; gap: 9px; padding: 8px; background: #fffaf3; border-radius: 7px; font-weight: 400; }
.employee-edit-choices input { margin-top: 3px; accent-color: #8d5a3b; flex-shrink: 0; width: 15px; height: 15px; }
.employee-professional-fields { padding: 18px; border: 1px solid #ecd6be; border-radius: 12px; }
.employee-professional-fields legend { padding: 0 6px; font-size: 14px; font-weight: 600; color: #3d281d; }
.employee-professional-fields label { display: block; margin-top: 12px; }
.employee-professional-fields input[type="file"] { padding: 8px; background: #fffaf3 !important; color: #5d4536 !important; }
.employee-license-link { display: inline-block; margin-top: 6px; color: #805337; font-size: 12px; text-decoration: underline; }
.employee-license-upload-label { margin-top: 14px !important; }
.employee-license-ocr { margin-top: 10px; padding: 12px; border: 1px solid #e8c99f; border-radius: 9px; background: #fbf1df; color: #5d4536; font-size: 12px; }
.employee-license-ocr strong { color: #805337; }
.employee-license-ocr p { margin-top: 5px; }
.employee-license-ocr summary { cursor: pointer; font-weight: 600; }
.employee-license-ocr pre { max-height: 160px; margin-top: 8px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 6px; background: #fffdf9; padding: 9px; font: 11px/1.5 ui-monospace, monospace; }
.employee-edit-error { color: #a13732; font-size: 12px; margin-top: 8px; }
.employee-edit-cancel, .employee-edit-save { padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; min-height: 42px; }
.employee-edit-cancel { border: 1px solid #dec19e; background: #fffdf9; color: #70482e; }
.employee-edit-save { border: 1px solid #8d5a3b; background: #8d5a3b; color: #fffdf9; }
.employee-edit-save:hover { background: #74462d; }
.employee-edit-cancel:disabled, .employee-edit-save:disabled { opacity: .55; cursor: not-allowed; }
@media(max-width: 540px) { .employee-edit-choices { grid-template-columns: 1fr; } .employee-edit-form { padding: 0; } }
.staff-management-main {
  background: radial-gradient(circle at 90% 0%, rgba(126, 78, 46, 0.14), transparent 32rem);
}

.staff-eyebrow {
  margin-bottom: 0.35rem;
  color: #d8b38f;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.staff-search {
  box-shadow: 0 12px 30px rgba(25, 12, 7, 0.18);
}

.staff-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(123, 79, 55, 0.35);
  padding: 0.35rem 0.5rem 1rem;
}

.staff-list-caption {
  color: #cbb19c;
  font-size: 0.75rem;
  text-align: right;
}

.staff-table th {
  padding: 0.9rem 0.75rem;
  white-space: nowrap;
}

.staff-table td {
  padding: 1rem 0.75rem;
  vertical-align: middle;
}

.staff-table tbody tr {
  border-bottom: 1px solid rgba(123, 79, 55, 0.2);
}

.staff-table tbody tr:last-child {
  border-bottom: 0;
}

.staff-card {
  border: 1px solid rgba(123, 79, 55, 0.42);
  border-radius: 0.9rem;
  background: rgba(38, 23, 16, 0.76);
  padding: 1rem;
}

.staff-card-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
  margin: 1rem 0;
}

.staff-card-details dt {
  color: #a88d7a;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.staff-card-details dd {
  overflow-wrap: anywhere;
  color: #f2dfd0;
  font-size: 0.88rem;
  margin-top: 0.2rem;
}

@media (max-width: 639px) {
  .staff-list-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .staff-list-caption {
    text-align: left;
  }
}

@media (min-width: 768px) and (max-width: 1100px) {
  .staff-table th,
  .staff-table td {
    padding-left: 0.55rem;
    padding-right: 0.55rem;
  }
}
</style>
