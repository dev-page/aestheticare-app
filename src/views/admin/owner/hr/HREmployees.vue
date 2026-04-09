<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    
    <main class="flex-1 p-8">
      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Employee List</h1>
          <p class="text-slate-400">Manage all employees across branches</p>
        </div>
        <button
          @click="showAddModal = true"
          class="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Employee
        </button>
      </div>

      <!-- Filters -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search by name or email..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Filter by Branch</label>
            <select 
              v-model="selectedBranch"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Branches</option>
              <option v-for="branch in branchOptions" :key="branch" :value="branch">{{ branch }}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Filter by Position</label>
            <select 
              v-model="selectedPosition"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Positions</option>
              <option v-for="position in positionOptions" :key="position" :value="position">{{ position }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Employee Table -->
      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Employee</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Position</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Branch</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Email</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="employee in filteredEmployees" :key="employee.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                      {{ employee.name.charAt(0) }}
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ employee.name }}</p>
                      <p class="text-slate-400 text-sm">ID: {{ employee.id }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-slate-300">{{ employee.position }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-slate-300">{{ employee.branch }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-slate-300">{{ employee.email }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span 
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      employee.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    ]"
                  >
                    {{ employee.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <button @click="editEmployee(employee)" class="text-blue-400 hover:text-blue-300 transition-colors">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add Employee Modal -->
      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-xl p-8 max-w-2xl w-full mx-4 border border-slate-700">
          <h2 class="text-2xl font-bold text-white mb-6">Add New Employee</h2>
          <form @submit.prevent="addEmployee" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Full Name</label>
                <input 
                  type="text" 
                  v-model="addEmployeeForm.fullName"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Email</label>
                <input 
                  type="email" 
                  v-model="addEmployeeForm.email"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Position</label>
                <select 
                  v-model="addEmployeeForm.position"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Select Position</option>
                  <option v-for="position in positionOptions" :key="position" :value="position">{{ position }}</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Branch</label>
                <select 
                  v-model="addEmployeeForm.branch"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="">Select Branch</option>
                  <option v-for="branch in branchOptions" :key="branch" :value="branch">{{ branch }}</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button 
                type="button"
                @click="showAddModal = false"
                class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
              >
                Add Employee
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Employee Modal -->
      <div v-if="showEditModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-slate-800 rounded-xl p-8 max-w-2xl w-full mx-4 border border-slate-700">
          <h2 class="text-2xl font-bold text-white mb-6">Edit Employee</h2>
          <form @submit.prevent="saveEmployee" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">First Name</label>
                <input
                  type="text"
                  v-model="currentEmployee.firstName"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Last Name</label>
                <input
                  type="text"
                  v-model="currentEmployee.lastName"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Email</label>
                <input
                  type="email"
                  v-model="currentEmployee.email"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Phone Number</label>
                <input
                  type="text"
                  v-model="currentEmployee.phoneNumber"
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Role</label>
                <select
                  v-model="currentEmployee.customRoleId"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option v-for="role in customRoles" :key="role.id" :value="role.id">{{ role.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Status</label>
                <select
                  v-model="currentEmployee.status"
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button
                type="button"
                @click="showEditModal = false"
                class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'

export default {
  name: 'HREmployees',
  components: {
    OwnerSidebar
  },
  setup() {
    const db = getFirestore(getApp())

    const showAddModal = ref(false)
    const showEditModal = ref(false)
    const searchQuery = ref('')
    const selectedBranch = ref('')
    const selectedPosition = ref('')

    const addEmployeeForm = ref({
      fullName: '',
      email: '',
      position: '',
      branch: ''
    })

    const employees = ref([])
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const customRoles = ref([])
    const currentEmployee = ref({
      id: null,
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
      customRoleName: '',
      branchId: '',
      status: 'Active'
    })

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

    const loadEmployees = async () => {
      if (!currentBranchId.value) {
        employees.value = []
        return
      }
      try {
        const staffQuery = query(
          collection(db, "users"),
          where("branchId", "==", currentBranchId.value),
          where("userType", "==", "Staff")
        )
        const staffSnapshot = await getDocs(staffQuery)
        const staffData = staffSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => !u.archived && u.id !== currentUserId.value)

        employees.value = staffData.map((staff) => ({
          id: staff.id,
          firstName: staff.firstName || '',
          lastName: staff.lastName || '',
          name: staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'Unnamed',
          email: staff.email || '',
          phoneNumber: staff.phoneNumber || '',
          branchId: staff.branchId || '',
          branch: staff.branchId || '',
          role: String(staff.customRoleName || staff.role || staff.position || '').trim(),
          position: String(staff.customRoleName || staff.role || staff.position || '').trim(),
          customRoleId: String(staff.customRoleId || '').trim(),
          customRoleName: String(staff.customRoleName || '').trim(),
          status: staff.status || 'Active'
        }))
      } catch (err) {
        console.error("Error loading employees:", err)
      }
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          employees.value = []
          return
        }
        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''
        await loadCustomRoles()
        await loadEmployees()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    watch(
      () => currentEmployee.value.customRoleId,
      (nextCustomRoleId) => {
        const selectedRole = customRoles.value.find((role) => role.id === nextCustomRoleId)
        currentEmployee.value.customRoleName = selectedRole?.name || ''
        currentEmployee.value.role = selectedRole?.name || currentEmployee.value.role || ''
      }
    )

    const branchOptions = computed(() => (
      Array.from(new Set(employees.value.map((employee) => employee.branch).filter(Boolean))).sort()
    ))

    const positionOptions = computed(() => (
      Array.from(new Set(employees.value.map((employee) => employee.position).filter(Boolean))).sort()
    ))

    const filteredEmployees = computed(() => {
      return employees.value.filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                            emp.email?.toLowerCase().includes(searchQuery.value.toLowerCase())
        const matchesBranch = !selectedBranch.value || emp.branch === selectedBranch.value
        const matchesPosition = !selectedPosition.value || emp.role === selectedPosition.value || emp.position === selectedPosition.value
        
        return matchesSearch && matchesBranch && matchesPosition
      })
    })

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

    const addEmployee = () => {
      if (!addEmployeeForm.value.fullName.trim()) {
        toast.error('Full name is required.')
        return
      }
      if (!isValidEmail(addEmployeeForm.value.email)) {
        toast.error('Please enter a valid email address.')
        return
      }
      if (!addEmployeeForm.value.position) {
        toast.error('Please select a position.')
        return
      }
      if (!addEmployeeForm.value.branch) {
        toast.error('Please select a branch.')
        return
      }

      toast.info('Employee form validated. Use the Add Employee page to create actual accounts.')
      showAddModal.value = false
      addEmployeeForm.value = {
        fullName: '',
        email: '',
        position: '',
        branch: ''
      }
    }

    const editEmployee = (employee) => {
      currentEmployee.value = {
        id: employee.id,
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phoneNumber: employee.phoneNumber || '',
        role: employee.role || employee.position || '',
        customRoleId: employee.customRoleId || '',
        customRoleName: employee.customRoleName || '',
        branchId: employee.branchId || '',
        status: employee.status || 'Active'
      }
      showEditModal.value = true
    }

    const saveEmployee = async () => {
      try {
        if (!currentEmployee.value.firstName || !currentEmployee.value.lastName || !currentEmployee.value.email || !currentEmployee.value.role) {
          toast.error('First name, last name, email, and role are required.')
          return
        }
        if (!isValidEmail(currentEmployee.value.email)) {
          toast.error('Please enter a valid email address.')
          return
        }
        if (!currentEmployee.value.id) return
        const employeeRef = doc(db, "users", currentEmployee.value.id)
        const fullName = `${currentEmployee.value.firstName} ${currentEmployee.value.lastName}`.trim()
        const selectedRole = customRoles.value.find((role) => role.id === currentEmployee.value.customRoleId)
        await updateDoc(employeeRef, {
          firstName: currentEmployee.value.firstName,
          lastName: currentEmployee.value.lastName,
          fullName,
          email: currentEmployee.value.email,
          phoneNumber: currentEmployee.value.phoneNumber || '',
          role: selectedRole?.name || currentEmployee.value.role || null,
          customRoleId: currentEmployee.value.customRoleId || null,
          customRoleName: selectedRole?.name || null,
          status: currentEmployee.value.status
        })
        await logActivity(db, {
          module: 'HR',
          action: 'Updated employee profile',
          details: `Updated profile details of ${fullName}.`,
          targetUserId: currentEmployee.value.id,
          targetUserName: fullName
        })
        toast.success("Employee updated successfully!")
        showEditModal.value = false
        await loadEmployees()
      } catch (err) {
        console.error("Error updating employee:", err)
        toast.error("Failed to update employee.")
      }
    }

    return {
      showAddModal,
      showEditModal,
      searchQuery,
      selectedBranch,
      selectedPosition,
      addEmployeeForm,
      employees,
      customRoles,
      branchOptions,
      positionOptions,
      filteredEmployees,
      currentEmployee,
      addEmployee,
      editEmployee,
      saveEmployee
    }
  }
}
</script>
