<script>
import { ref, onMounted, watch } from 'vue'
import { getFirestore, collection, getDocs, updateDoc, doc, getDoc, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'HREmployee',
  components: { OwnerSidebar, Modal },
  setup() {
    const db = getFirestore(getApp())
    const staffList = ref([])
    const showEditModal = ref(false)
    const isSaving = ref(false)
    const currentUserId = ref(null)
    const currentBranchId = ref('')
    const customRoles = ref([])
    const getRoleLabel = (staff) => String(staff?.customRoleName || staff?.role || 'Staff').trim()

    const currentStaff = ref({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      role: '',
      userType: 'Staff',
      status: '',
      archived: false
    })

    const loadStaff = async () => {
      if (!currentBranchId.value) {
        staffList.value = []
        return
      }

      const staffQuery = query(
        collection(db, "users"),
        where("branchId", "==", currentBranchId.value),
        where("userType", "==", "Staff")
      )
      const snapshot = await getDocs(staffQuery)
      staffList.value = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user =>
          user.id !== currentUserId.value &&
          !user.archived
        )
    }

    const loadCustomRoles = async () => {
      if (!currentBranchId.value) {
        customRoles.value = []
        return
      }

      const clinicSnap = await getDoc(doc(db, 'clinics', currentBranchId.value))
      if (!clinicSnap.exists()) {
        customRoles.value = []
        return
      }

      const ownerId = String(clinicSnap.data()?.ownerId || '').trim()
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

    const editStaff = (staff) => {
      currentStaff.value = {
        id: staff.id,
        firstName: staff.firstName || '',
        lastName: staff.lastName || '',
        email: staff.email || '',
        phoneNumber: staff.phoneNumber || '',
        address: staff.address || '',
        role: staff.role || 'Staff',
        customRoleId: staff.customRoleId || '',
        customRoleName: staff.customRoleName || '',
        userType: staff.userType || 'Staff',
        status: staff.status || 'Active',
        archived: Boolean(staff.archived)
      }
      showEditModal.value = true
    }

    const saveStaff = async () => {
      if (!currentStaff.value.id) return
      if (!currentStaff.value.firstName.trim() || !currentStaff.value.lastName.trim()) {
        toast.error('First name and last name are required.')
        return
      }
      if (!currentStaff.value.email.trim()) {
        toast.error('Email is required.')
        return
      }

      isSaving.value = true
      try {
        const selectedRole = customRoles.value.find((role) => role.id === currentStaff.value.customRoleId)
        const fullName = `${currentStaff.value.firstName} ${currentStaff.value.lastName}`.trim()
        await updateDoc(doc(db, 'users', currentStaff.value.id), {
          firstName: currentStaff.value.firstName.trim(),
          lastName: currentStaff.value.lastName.trim(),
          fullName,
          email: currentStaff.value.email.trim(),
          phoneNumber: currentStaff.value.phoneNumber || '',
          address: currentStaff.value.address || '',
          role: selectedRole?.name || currentStaff.value.role || 'Staff',
          customRoleId: currentStaff.value.customRoleId || null,
          customRoleName: selectedRole?.name || null,
          status: currentStaff.value.status || 'Active'
        })
        await logActivity(db, {
          module: 'HR',
          action: 'Updated employee profile',
          details: `Updated profile details of ${fullName}.`,
          targetUserId: currentStaff.value.id,
          targetUserName: fullName
        })
        toast.success('Employee updated successfully.')
        showEditModal.value = false
        await loadStaff()
      } catch (error) {
        console.error('Failed to update employee:', error)
        toast.error('Failed to update employee.')
      } finally {
        isSaving.value = false
      }
    }

        onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = null
          currentBranchId.value = ''
          staffList.value = []
          return
        }

        currentUserId.value = user.uid
        const currentUserRef = doc(db, "users", user.uid)
        const currentUserSnap = await getDoc(currentUserRef)
        currentBranchId.value = currentUserSnap.exists() ? (currentUserSnap.data().branchId || '') : ''

        await loadCustomRoles()
        await loadStaff()
      })
    })

    watch(
      () => currentStaff.value.customRoleId,
      (nextCustomRoleId) => {
        const selectedRole = customRoles.value.find((role) => role.id === nextCustomRoleId)
        currentStaff.value.customRoleName = selectedRole?.name || ''
        currentStaff.value.role = selectedRole?.name || currentStaff.value.role || ''
      }
    )

    const deactivateStaff = async (staff) => {
      if (staff.id === currentUserId.value) {
        toast.error("You cannot modify your own account.")
        return
      }

      if (staff.status === 'Active') {
        const result = await Swal.fire({
          title: 'Confirm Deactivation',
          text: `Deactivate ${staff.firstName} ${staff.lastName}?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, deactivate',
          cancelButtonText: 'Cancel'
        })
        if (!result.isConfirmed) return

        await updateDoc(doc(db, "users", staff.id), { status: 'Inactive' })
        staff.status = 'Inactive'
        await logActivity(db, {
          module: 'HR',
          action: 'Deactivated employee',
          details: `Set ${staff.firstName} ${staff.lastName} to Inactive.`,
          targetUserId: staff.id,
          targetUserName: `${staff.firstName} ${staff.lastName}`
        })
        toast.success(`${staff.firstName} ${staff.lastName} deactivated.`)
      } else {
        await updateDoc(doc(db, "users", staff.id), { status: 'Active' })
        staff.status = 'Active'
        await logActivity(db, {
          module: 'HR',
          action: 'Reactivated employee',
          details: `Set ${staff.firstName} ${staff.lastName} to Active.`,
          targetUserId: staff.id,
          targetUserName: `${staff.firstName} ${staff.lastName}`
        })
        toast.success(`${staff.firstName} ${staff.lastName} reactivated.`)
        await loadStaff()
      }
    }

    const archiveStaff = async (staff) => {
      if (staff.id === currentUserId.value) {
        toast.error("You cannot archive your own account.")
        return
      }

      const result = await Swal.fire({
        title: 'Confirm Archive',
        text: `Archive ${staff.firstName} ${staff.lastName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, archive',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) {
        return
      }

      await updateDoc(doc(db, "users", staff.id), {
        archived: true,
        status: 'Inactive'
      })
      await logActivity(db, {
        module: 'HR',
        action: 'Archived employee',
        details: `Archived ${staff.firstName} ${staff.lastName} from Employee Directory.`,
        targetUserId: staff.id,
        targetUserName: `${staff.firstName} ${staff.lastName}`
      })
      toast.success(`${staff.firstName} ${staff.lastName} archived.`)
      await loadStaff()
    }

    return {
      staffList,
      showEditModal,
      isSaving,
      currentStaff,
      currentUserId,
      customRoles,
      getRoleLabel,
      deactivateStaff,
      archiveStaff,
      editStaff,
      saveStaff
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="flex-1 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Staff Management</h1>
      <p class="text-slate-400 mb-6">Manage staff accounts and roles in your branch</p>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[900px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-4">Name</th>
              <th class="py-2 px-4">Email</th>
              <th class="py-2 px-4">Phone</th>
              <th class="py-2 px-4">Address</th>
              <th class="py-2 px-4">Role</th>
              <th class="py-2 px-4">Status</th>
              <th class="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-for="staff in staffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <td class="py-2 px-4 font-medium">{{ staff.firstName }} {{ staff.lastName }}</td>
              <td class="py-2 px-4">{{ staff.email }}</td>
              <td class="py-2 px-4">{{ staff.phoneNumber || '-' }}</td>
              <td class="py-2 px-4">{{ staff.address || '-' }}</td>
              <td class="py-2 px-4">{{ getRoleLabel(staff) }}</td>
              <!-- STATUS COLUMN -->
<td class="py-2 px-4">
  <span
    @click="deactivateStaff(staff)"
    :class="[
      'px-3 py-1 rounded-full text-xs font-medium cursor-pointer',
      staff.status === 'Active'
        ? 'bg-green-500/20 text-green-400'
        : 'bg-red-500/20 text-red-400'
    ]"
  >
    {{ staff.status }}
  </span>
</td>

<!-- ACTIONS COLUMN (ARCHIVE/UNARCHIVE) -->
<td class="py-2 px-4 flex flex-wrap gap-2">
  <button
    @click="editStaff(staff)"
    class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded transition"
  >
    Edit
  </button>
  <button
    @click="archiveStaff(staff)"
    class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
  >
    Archive
  </button>
</td>
            </tr>

            <tr v-if="staffList.length === 0">
              <td colspan="7" class="py-6 text-center text-slate-400">No Results Found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>

  <!-- Edit Employee Modal -->
  <Modal
    :isOpen="showEditModal"
    panelClass="bg-slate-800 text-white w-full max-w-md"
    @close="showEditModal = false"
  >
    <template #header>
      <h2 class="text-xl font-semibold">Edit Employee</h2>
    </template>

    <template #body>
      <form class="space-y-4">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-slate-400 mb-1">First Name</label>
            <input
              type="text"
              v-model="currentStaff.firstName"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Last Name</label>
            <input
              type="text"
              v-model="currentStaff.lastName"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Email</label>
          <input
            type="email"
            v-model="currentStaff.email"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Phone Number</label>
          <input
            type="text"
            v-model="currentStaff.phoneNumber"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Address</label>
          <input
            type="text"
            v-model="currentStaff.address"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Role</label>
          <select
            v-model="currentStaff.customRoleId"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="role in customRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Status</label>
          <select
            v-model="currentStaff.status"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          @click="showEditModal = false"
          class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition"
        >
          Cancel
        </button>
        <button
          @click="saveStaff"
          :disabled="isSaving"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ isSaving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </template>
  </Modal>
</template>


