<script>
import { ref, onMounted } from 'vue'
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { auth } from '@/config/firebaseConfig'

export default {
  name: 'OwnerStaff',
  components: { OwnerSidebar, Modal, OwnerPageSkeleton },

  setup() {
    const db = getFirestore(getApp())
    const loading = ref(true)
    const getRoleLabel = (staff) => String(staff?.customRoleName || staff?.role || 'Staff').trim()

    const staffList = ref([])
    const branches = ref([])
    const showViewModal = ref(false)

    const currentStaff = ref({})

    /* ================= LOAD DATA ================= */

    const loadBranches = async () => {
      loading.value = true
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        loading.value = false
        return
      }
      const snapshot = await getDocs(query(collection(db, "clinics"), where("ownerId", "==", user.uid)))
      branches.value = snapshot.docs.map(doc => ({
        id: doc.id,
        clinicBranch: doc.data().clinicBranch,
        clinicLocation: doc.data().clinicLocation
      }))
      loading.value = false
    }

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

const loadStaff = async () => {
  const branchIds = branches.value.map((branch) => branch.id).filter(Boolean)
  if (branchIds.length === 0) {
    staffList.value = []
    return
  }

  let users = []
  const chunks = chunkArray(branchIds)
  for (const chunk of chunks) {
    const staffQuery = query(
      collection(db, "users"),
      where("branchId", "in", chunk),
      where("userType", "==", "Staff")
    )
    const snapshot = await getDocs(staffQuery)
    users = users.concat(snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }

  staffList.value = users
    .filter(user => user.status === 'Inactive' && !user.archived)
    .map(user => {
      const branch = branches.value.find(
        b => b.id === user.branchId
      ) || {}

      return {
        ...user,
        branchName: branch.clinicBranch || 'N/A',
        branchLocation: branch.clinicLocation || ''
      }
    })
}

    onMounted(async () => {
      await loadBranches()
      await loadStaff()
    })

    /* ================= VIEW ================= */

    const viewStaff = (staff) => {
      currentStaff.value = { ...staff }
      showViewModal.value = true
    }

    /* ================= APPROVE ================= */

    const acceptStaff = async (staff) => {
      const result = await Swal.fire({
        title: 'Approve Employee',
        text: `Do you want to approve ${staff.fullName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, approve'
      })

      if (!result.isConfirmed) {
        toast.info("Approval cancelled.")
        return
      }

      try {
        const staffRef = doc(db, "users", staff.id)
        await updateDoc(staffRef, { status: 'Active' })

        toast.success(`${staff.fullName} has been approved.`)
        await loadStaff()
      } catch (error) {
        console.error(error)
        toast.error("Failed to approve employee.")
      }
    }

    /* ================= REJECT ================= */

    const rejectStaff = async (staff) => {
      const result = await Swal.fire({
        title: 'Reject Employee',
        text: `Do you want to reject ${staff.fullName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, reject'
      })

      if (!result.isConfirmed) {
        toast.info("Rejection cancelled.")
        return
      }

      try {
        const staffRef = doc(db, "users", staff.id)
        await updateDoc(staffRef, { status: 'Rejected' })

        toast.success(`${staff.fullName} has been rejected.`)
        await loadStaff()
      } catch (error) {
        console.error(error)
        toast.error("Failed to reject employee.")
      }
    }

    return {
      loading,
      staffList,
      branches,
      showViewModal,
      currentStaff,
      getRoleLabel,
      viewStaff,
      acceptStaff,
      rejectStaff
    }
  }
}
</script>
<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <OwnerPageSkeleton v-if="loading" />
      <div v-else>
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">
          Approval Requests
        </h1>
        <p class="text-slate-400 text-sm md:text-base">
          Manage employee approval requests sent by Human Resource
        </p>
      </div>

      <!-- Employee Table -->
      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[500px] sm:min-w-[700px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-3 px-4">Name</th>
              <th class="py-3 px-4">Email</th>
              <th class="py-3 px-4">Role</th>
              <th class="py-3 px-4">Branch</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Actions</th>
            </tr>
          </thead>

          <tbody class="text-white">
            <tr
              v-for="staff in staffList"
              :key="staff.id"
              class="hover:bg-slate-700 transition-colors"
            >
              <td class="py-3 px-4 font-medium">{{ staff.fullName }}</td>
              <td class="py-3 px-4">{{ staff.email }}</td>
              <td class="py-3 px-4">{{ getRoleLabel(staff) }}</td>
              <td class="py-3 px-4">
                {{ staff.branchName }} - {{ staff.branchLocation }}
              </td>

              <td class="py-3 px-4">
                <span
                  :class="{
                    'text-green-400': staff.status === 'Active',
                    'text-red-400': staff.status === 'Rejected',
                    'text-yellow-400': staff.status === 'Inactive'
                  }"
                  class="font-semibold"
                >
                  {{ staff.status }}
                </span>
              </td>

              <td class="py-3 px-4 flex flex-wrap gap-2">
                <button
                  @click="viewStaff(staff)"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
                >
                  View
                </button>

                <button
                  @click="acceptStaff(staff)"
                  class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition"
                >
                  Accept
                </button>

                <button
                  @click="rejectStaff(staff)"
                  class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition"
                >
                  Reject
                </button>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="staffList.length === 0">
              <td colspan="6" class="py-6 text-center text-slate-400">
                No Approval Requests Found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- VIEW MODAL -->
      <Modal
        :isOpen="showViewModal"
        panelClass="bg-slate-800 text-white w-full max-w-md"
        @close="showViewModal = false"
      >
        <template #header>
          <h2 class="text-xl font-semibold">Employee Details</h2>
        </template>

        <template #body>
          <div class="space-y-3">
            <p><span class="text-slate-400">Full Name:</span> {{ currentStaff.fullName }}</p>
            <p><span class="text-slate-400">Email:</span> {{ currentStaff.email }}</p>
            <p><span class="text-slate-400">Role:</span> {{ getRoleLabel(currentStaff) }}</p>
            <p>
              <span class="text-slate-400">Branch:</span>
              {{ currentStaff.branchName }} - {{ currentStaff.branchLocation }}
            </p>
            <p><span class="text-slate-400">Status:</span> {{ currentStaff.status }}</p>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end">
            <button
              @click="showViewModal = false"
              class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition"
            >
              Close
            </button>
          </div>
        </template>
      </Modal>
      </div>
    </main>
  </div>
</template>


