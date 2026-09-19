<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getFirestore, collection, getDocs, onSnapshot, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

export default {
  name: 'OwnerStaff',
  components: { OwnerSidebar, Modal },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const staffList = ref([])
    const branches = ref([])
    const customRoles = ref([])
    const currentOwnerId = ref('')

    const showEditModal = ref(false)
    const searchQuery = ref('')
    const editErrors = ref({})
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
        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
          recordsByChunk[chunkIndex] = snapshot.docs.map((staffDoc) => ({ id: staffDoc.id, ...staffDoc.data() }))
          applyStaffDocs(recordsByChunk.flat())
        }, (error) => {
          console.error('Failed to subscribe to employee updates:', error)
          toast.error('Live employee updates are temporarily unavailable.')
        })
        staffUnsubscribers.push(unsubscribe)
      })
    }

    const loadBranches = async () => {
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
    }

    const loadCustomRoles = async () => {
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
    }

    onMounted(async() => {
      await loadBranches()
      await loadCustomRoles()
      subscribeStaff()

    })

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

    const openEditModal = (staff) => {
      editErrors.value = {}
      currentStaff.value = {
        ...staff,
        customRoleId: String(staff.customRoleId || '').trim(),
        customRoleIds: Array.isArray(staff.customRoleIds) && staff.customRoleIds.length
          ? staff.customRoleIds
          : [String(staff.customRoleId || '').trim()].filter(Boolean),
        customRoleName: String(staff.customRoleName || '').trim(),
        branchIds: Array.isArray(staff.branchIds) && staff.branchIds.length ? staff.branchIds : [staff.branchId].filter(Boolean),
      }
      showEditModal.value = true
    }

    const clearEditError = (field) => {
      if (!editErrors.value[field]) return
      const nextErrors = { ...editErrors.value }
      delete nextErrors[field]
      editErrors.value = nextErrors
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
          const token = await auth.currentUser?.getIdToken()
          const branchResponse = await fetch(`${OTP_API_BASE}/staff/${currentStaff.value.id}/branch-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchIds: currentStaff.value.branchIds }) })
          const branchPayload = await branchResponse.json()
          if (!branchResponse.ok) throw new Error(branchPayload.error || 'Unable to update assigned branches.')
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
            branchId: currentStaff.value.branchId,
            branchIds: [...new Set(currentStaff.value.branchIds || [])],
            clinicLocation: currentStaff.value.clinicLocation,
            status: nextStatus,
            archived: shouldArchive,
            archivedAt: shouldArchive ? serverTimestamp() : null
          })
          toast.success(`${fullName}'s information updated successfully!`)
        }
      } catch (err) {
        console.error(err)
        toast.error("Unexpected error while saving employee.")
      }

      showEditModal.value = false
    }

    const filteredStaffList = computed(() => {
      if (!searchQuery.value.trim()) return staffList.value
      const query = searchQuery.value.toLowerCase()
      return staffList.value.filter(staff =>
        [staff.firstName, staff.lastName, staff.fullName, staff.email, staff.role].some((value) =>
          String(value || '').toLowerCase().includes(query)
        ) ||
        (staff.clinicBranch && staff.clinicBranch.toLowerCase().includes(query)) ||
        (staff.clinicLocation && staff.clinicLocation.toLowerCase().includes(query))
      )
    })

    return {
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
      customRoles
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="staff-management-main flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
      <!-- Header -->
      <div class="mb-6 flex flex-col gap-2">
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
                <div>{{ staff.role || '-' }}</div>
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
                <button @click="openEditModal(staff)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition">
                  Edit
                </button>
                <button @click="deactivateStaff(staff)" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition">
                  Disable
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
              <button @click="openEditModal(staff)" class="flex-1 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-yellow-600">Edit</button>
              <button @click="deactivateStaff(staff)" class="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700">Disable</button>
            </div>
          </article>
          <div v-if="filteredStaffList.length === 0" class="py-8 text-center text-slate-400">No Results Found</div>
        </div>
      </div>

      <!-- Edit Modal -->
      <Modal :isOpen="showEditModal" panelClass="bg-slate-800 text-white w-full max-w-md" @close="showEditModal = false">
        <template #header>
          <h2 class="text-xl font-semibold text-white">Edit Employee</h2>
        </template>

        <template #body>
          <form class="space-y-4">
            <div class="grid grid-cols-2 gap-2">
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
              <select v-model="currentStaff.customRoleIds"
                multiple
                class="w-full min-h-28 px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option v-for="role in customRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
              </select>
              <p class="mt-1 text-xs text-slate-400">Hold Ctrl or Command to assign more than one role.</p>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Assigned Branches</label>
              <select v-model="currentStaff.branchIds" multiple
                @change="updateCurrentStaffLocation(); clearEditError('branchId')"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.clinicBranch }} - {{ branch.clinicLocation }}
                </option>
              </select>
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
              <label class="block text-slate-400 mb-1">Status</label>
              <select v-model="currentStaff.status"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending Activation" disabled>Pending</option>
              </select>
            </div>
          </form>
        </template>

        <template #footer>
          <div class="flex flex-col sm:flex-row justify-end sm:space-x-2 space-y-2 sm:space-y-0">
            <button @click="showEditModal = false" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition">Cancel</button>
            <button @click="saveStaff" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">Update</button>
          </div>
        </template>
      </Modal>
    </main>
  </div>
</template>

<style scoped>
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
