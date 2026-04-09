<script>
import { ref, onMounted, computed, watch } from 'vue'
import { getFirestore, collection, getDocs, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'

export default {
  name: 'OwnerStaff',
  components: { OwnerSidebar, Modal },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const staffList = ref([])
    const branches = ref([])
    const customRoles = ref([])

    const showEditModal = ref(false)
    const searchQuery = ref('')

    const currentStaff = ref({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
      customRoleName: '',
      branchId: '',
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

    const loadStaff = async () => {
      const ownerBranchIds = branches.value.map(branch => branch.id).filter(Boolean)
      if (ownerBranchIds.length === 0) {
        staffList.value = []
        return
      }

      let staffDocs = []
      const chunks = chunkArray(ownerBranchIds)
      for (const chunk of chunks) {
        const staffQuery = query(
          collection(db, "users"),
          where("branchId", "in", chunk),
          where("userType", "==", "Staff")
        )
        const snapshot = await getDocs(staffQuery)
        staffDocs = staffDocs.concat(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      }

      staffDocs = staffDocs.filter((user) => !user.archived)
      staffList.value = staffDocs.map(staff => {
        const branch = branches.value.find(b => b.id === staff.branchId)
        return {
          ...staff,
          clinicBranch: branch ? branch.clinicBranch : '',
          clinicLocation: branch ? branch.clinicLocation : '',
          customRoleName: String(staff.customRoleName || '').trim()
        }
      })
    }

    const loadBranches = async () => {
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        return
      }

      const ownerBranchesQuery = query(
        collection(db, "clinics"),
        where("ownerId", "==", user.uid)
      )
      const snapshot = await getDocs(ownerBranchesQuery)
      branches.value = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        clinicBranch: doc.data().clinicBranch,
        clinicLocation: doc.data().clinicLocation}))
    }

    const loadCustomRoles = async () => {
      const user = auth.currentUser
      if (!user) {
        customRoles.value = []
        return
      }

      const rolesSnapshot = await getDocs(
        query(collection(db, 'clinicRoles'), where('ownerId', '==', user.uid))
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
      await loadStaff()

    })

    watch(
      () => currentStaff.value.customRoleId,
      (nextCustomRoleId) => {
        const selectedRole = customRoles.value.find((role) => role.id === nextCustomRoleId)
        currentStaff.value.customRoleName = selectedRole?.name || ''
        currentStaff.value.role = selectedRole?.name || currentStaff.value.role || ''
      }
    )

    const openEditModal = (staff) => {
      currentStaff.value = {
        ...staff,
        customRoleId: String(staff.customRoleId || '').trim(),
        customRoleName: String(staff.customRoleName || '').trim(),
      }
      showEditModal.value = true
    }

    const updateCurrentStaffLocation = () => {
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
          await loadStaff()
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
          await loadStaff()
        } catch (error) {
          console.error(error)
          toast.error("Failed to reactivate staff.")
        }
      }
    }


    const saveStaff = async () => {
      const { firstName, lastName, email, phoneNumber, clinicBranch, clinicLocation } = currentStaff.value
      const fullName = `${firstName} ${lastName}`
      const selectedRole = customRoles.value.find((entry) => entry.id === currentStaff.value.customRoleId)

      if (!firstName.trim() || !lastName.trim() || !email.trim() || !phoneNumber.trim() || !clinicBranch.trim() || !clinicLocation.trim()) {
        toast.error('All fields are required.')
        return
      }

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
          const nextStatus = currentStaff.value.status
          const shouldArchive = String(nextStatus || '').trim().toLowerCase() === 'inactive'
          await updateDoc(staffRef, { 
            firstName: currentStaff.value.firstName.trim(),
            lastName: currentStaff.value.lastName.trim(),
            fullName: `${currentStaff.value.firstName.trim()} ${currentStaff.value.lastName.trim()}`.trim(),
            email: currentStaff.value.email.trim(),
            phoneNumber: currentStaff.value.phoneNumber,
            role: selectedRole?.name || currentStaff.value.role || null,
            customRoleId: currentStaff.value.customRoleId || null,
            customRoleName: selectedRole?.name || null,
            branchId: currentStaff.value.branchId,
            clinicLocation: currentStaff.value.clinicLocation,
            status: nextStatus,
            archived: shouldArchive,
            archivedAt: shouldArchive ? serverTimestamp() : null
          })
          toast.success(`${fullName}'s information updated successfully!`)
          await loadStaff()
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
        (staff.clinicBranch && staff.clinicBranch.toLowerCase().includes(query)) ||
        (staff.clinicLocation && staff.clinicLocation.toLowerCase().includes(query))
      )
    })

    return {
      staffList,
      branches,
      showEditModal,
      currentStaff,
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
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <!-- Header -->
      <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Employee Management</h1>
          <p class="text-slate-400 text-sm md:text-base">Manage employee accounts and roles at both office and branch level</p>
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-4">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search by branch or location..."
          class="w-full md:w-1/3 px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Employee Table -->
      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[500px] sm:min-w-[700px] border-collapse">
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
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.clinicBranch }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.clinicLocation || '-' }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-medium',
                    staff.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  ]"
                >
                  {{ staff.status }}
                </span>
              </td>
              <td class="py-2 px-2 sm:py-3 sm:px-4 flex flex-wrap gap-2">
                <button @click="openEditModal(staff)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded transition flex-1 sm:flex-none">
                  Edit
                </button>
                <button @click="deactivateStaff(staff)" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition flex-1 sm:flex-none">
                  Disable
                </button>
              </td>
            </tr>

            <tr v-if="filteredStaffList.length === 0">
              <td colspan="8" class="py-6 text-center text-slate-400">No Results Found</td>
            </tr>
          </tbody>
        </table>
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
                <input type="text" v-model="currentStaff.firstName" placeholder="First Name"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Last Name</label>
                <input type="text" v-model="currentStaff.lastName" placeholder="Last Name"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Email</label>
              <input type="email" v-model="currentStaff.email" placeholder="Enter email"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Phone Number</label>
              <input type="text" v-model="currentStaff.phoneNumber" placeholder="Enter phone number"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Custom Role</label>
              <select v-model="currentStaff.customRoleId"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option v-for="role in customRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Branch</label>
              <select v-model="currentStaff.branchId"
                @change="updateCurrentStaffLocation"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option disabled value="">Select branch</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.clinicBranch }} - {{ branch.clinicLocation }}
                </option>
              </select>
              </div>

            <div>
              <label class="block text-slate-400 mb-1">Clinic Location</label>
              <input type="text" readonly v-model="currentStaff.clinicLocation" placeholder="Enter clinic location"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Status</label>
              <select v-model="currentStaff.status"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
