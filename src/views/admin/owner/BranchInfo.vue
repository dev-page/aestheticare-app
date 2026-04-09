<script>
import { ref, onMounted, computed } from 'vue'
import { getFirestore, collection, updateDoc, doc, getDoc, getDocs, serverTimestamp, query, where, writeBatch } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'

export default {
  name: 'Branch Info',
  components: { OwnerSidebar, Modal },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const branches = ref([])
    const staffOptions = ref([])
    const showEditModal = ref(false)
    const ownerProfile = ref({
      branchAdminId: '',
      branchAdminName: ''
    })

    const currentBranch = ref({
      id: null,
      clinicBranch: '',
      revenue: 0,
      status: 'Active',
      clinicLocation: '',
      isMainBranch: false,
      branchAdminId: '',
      branchAdminName: '',
    })
    const archivedBranches = computed(() => branches.value.filter((branch) => branch.status === 'Inactive'))
    const activeBranches = computed(() => branches.value.filter((branch) => branch.status !== 'Inactive'))

    const normalizeRevenue = (value) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0
    }

    const loadOwnerProfile = async (uid) => {
      if (!uid) return { branchAdminId: '', branchAdminName: '' }
      const userSnap = await getDoc(doc(db, 'users', uid))
      const data = userSnap.exists() ? userSnap.data() || {} : {}
      const branchAdminName =
        String(data.fullName || '').trim() ||
        `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
        'Owner'

      return {
        branchAdminId: uid,
        branchAdminName,
      }
    }

    const formatFullName = (data = {}) =>
      String(data.fullName || '').trim() ||
      `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
      data.email ||
      'Owner'

    const loadBranches = async () => {
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        staffOptions.value = []
        return
      }

      const clinicsQuery = query(
        collection(db, 'clinics'),
        where('ownerId', '==', user.uid)
      )
      const snapshot = await getDocs(clinicsQuery)
      ownerProfile.value = await loadOwnerProfile(user.uid)
      branches.value = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {}
        const rawStatus = String(data.status || '').trim()
        const isMainBranch = Boolean(data.isMainBranch)
        const branchAdminId = String(data.branchAdminId || '').trim()
        const branchAdminName = String(data.branchAdminName || '').trim()
        return {
          id: docSnap.id,
          ...data,
          revenue: normalizeRevenue(data.revenue),
          status: rawStatus || 'Active',
          isMainBranch,
          branchAdminId: branchAdminId || (isMainBranch ? ownerProfile.value.branchAdminId : ''),
          branchAdminName: branchAdminName || (isMainBranch ? ownerProfile.value.branchAdminName : ''),
        }
      })

      const branchIds = branches.value.map((branch) => branch.id).filter(Boolean)
      if (!branchIds.length) {
        staffOptions.value = []
        return
      }

      const staffResults = [{
        id: ownerProfile.value.branchAdminId,
        branchId: '',
        fullName: ownerProfile.value.branchAdminName || 'Owner',
        role: 'Clinic Admin',
        isOwner: true
      }]
      for (let index = 0; index < branchIds.length; index += 10) {
        const chunk = branchIds.slice(index, index + 10)
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', 'in', chunk),
          where('userType', '==', 'Staff')
        )
        const staffSnapshot = await getDocs(staffQuery)
        staffResults.push(
          ...staffSnapshot.docs.map((staffDoc) => {
            const data = staffDoc.data() || {}
            const fullName = formatFullName(data)
            return {
              id: staffDoc.id,
              branchId: String(data.branchId || ''),
              fullName: fullName || 'Unnamed Staff',
              role: String(data.customRoleName || data.role || 'Staff'),
              isOwner: false
            }
          })
        )
      }
      staffOptions.value = staffResults
        .filter((staff, index, array) => array.findIndex((entry) => entry.id === staff.id) === index)
        .filter((staff) => staff.id)
        .sort((left, right) => left.fullName.localeCompare(right.fullName))
    }

    onMounted(loadBranches)

    const openEditModal = (branch) => {
      currentBranch.value = {
        ...branch,
        revenue: normalizeRevenue(branch?.revenue),
      }
      if (!String(currentBranch.value.branchAdminId || '').trim() && currentBranch.value.isMainBranch) {
        currentBranch.value.branchAdminId = ownerProfile.value.branchAdminId
        currentBranch.value.branchAdminName = ownerProfile.value.branchAdminName
      }
      showEditModal.value = true
    }

    const archiveBranch = async (branch) => {
      if (!branch?.id) {
        toast.error('Invalid branch ID')
        return
      }

      const result = await Swal.fire({
        title: 'Archive Branch',
        text: `Archive ${branch.clinicBranch}? This will set the status to Inactive.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, archive it!',
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info('Archive cancelled')
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, {
          status: 'Inactive',
          archivedAt: serverTimestamp()
        })
        branch.status = 'Inactive'
        toast.success('Branch archived successfully.')
      } catch (error) {
        console.error('Error archiving branch:', error)
        toast.error('Failed to archive branch. Please try again.')
      }
    }

    const unarchiveBranch = async (branch) => {
      if (!branch?.id) {
        toast.error('Invalid branch ID')
        return
      }

      const result = await Swal.fire({
        title: 'Unarchive Branch',
        text: `Unarchive ${branch.clinicBranch}? This will set the status to Active.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, unarchive it!',
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info('Unarchive cancelled')
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, {
          status: 'Active',
          updatedAt: serverTimestamp()
        })
        branch.status = 'Active'
        toast.success('Branch unarchived successfully.')
      } catch (error) {
        console.error('Error unarchiving branch:', error)
        toast.error('Failed to unarchive branch. Please try again.')
      }
    }

    const updateBranch = async () => {
      if (!currentBranch.value.clinicBranch || !currentBranch.value.clinicBranch.trim()) {
        toast.error('Branch name is required')
        return
      }

      if (!currentBranch.value.clinicLocation || !currentBranch.value.clinicLocation.trim()) {
        toast.error('Branch location is required')
        return
      }
      if (Number(currentBranch.value.revenue) < 0) {
        toast.error('Revenue cannot be negative.')
        return
      }

      try {
        const user = auth.currentUser
        if (!user) {
          toast.error('You must be logged in to update a branch')
          return
        }

        const ownerId = user.uid
        const ownerProfileData = ownerProfile.value.branchAdminId ? ownerProfile.value : await loadOwnerProfile(ownerId)
        const revenue = normalizeRevenue(currentBranch.value.revenue)
        const shouldUseOwnerAsBranchAdmin =
          Boolean(currentBranch.value.isMainBranch) && !String(currentBranch.value.branchAdminId || '').trim()
        const branchAdminId = shouldUseOwnerAsBranchAdmin
          ? ownerProfileData.branchAdminId
          : String(currentBranch.value.branchAdminId || '').trim()
        const branchAdminName = shouldUseOwnerAsBranchAdmin
          ? ownerProfileData.branchAdminName
          : String(currentBranch.value.branchAdminName || '').trim()

        if (currentBranch.value.id) {
          const result = await Swal.fire({
            title: 'Confirm Update',
            text: 'Are you sure you want to update this branch?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, update!',
            cancelButtonText: 'Cancel'
          })

          if (!result.isConfirmed) {
            toast.info('Update cancelled')
            return
          }

          const branchRef = doc(db, 'clinics', currentBranch.value.id)
          if (currentBranch.value.isMainBranch) {
            const ownerBranchesQuery = query(collection(db, 'clinics'), where('ownerId', '==', ownerId))
            const ownerBranches = await getDocs(ownerBranchesQuery)
            const batch = writeBatch(db)
            ownerBranches.docs.forEach((branchDoc) => {
              batch.update(branchDoc.ref, { isMainBranch: false })
            })
            await batch.commit()
          }

          await updateDoc(branchRef, {
            clinicBranch: currentBranch.value.clinicBranch.trim(),
            clinicLocation: currentBranch.value.clinicLocation.trim(),
            revenue,
            status: currentBranch.value.status,
            isMainBranch: Boolean(currentBranch.value.isMainBranch),
            branchAdminId: branchAdminId || null,
            branchAdminName: branchAdminName || null,
            ownerId,
            updatedAt: serverTimestamp()
          })

          const index = branches.value.findIndex((branch) => branch.id === currentBranch.value.id)
          if (index !== -1) {
            branches.value[index] = {
              ...currentBranch.value,
              clinicBranch: currentBranch.value.clinicBranch.trim(),
              clinicLocation: currentBranch.value.clinicLocation.trim(),
              revenue,
              branchAdminId,
              branchAdminName,
              ownerId
            }
          }

          toast.success('Branch updated successfully.')
          showEditModal.value = false
        }
      } catch (error) {
        console.error('Error updating branch:', error)
        toast.error('Failed to update branch. Please try again.')
      }
    }

    const toggleStatus = async (branch) => {
      const action = branch.status === 'Active' ? 'deactivate' : 'reactivate'
      const newStatus = branch.status === 'Active' ? 'Inactive' : 'Active'

      const result = await Swal.fire({
        title: `Confirm ${action}`,
        text: `Are you sure you want to ${action} ${branch.clinicBranch}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: `Yes, ${action}!`,
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info(`${action.charAt(0).toUpperCase() + action.slice(1)} cancelled`)
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, { status: newStatus })
        branch.status = newStatus
        toast.success(`${branch.clinicBranch} has been ${action}d.`)
      } catch (error) {
        console.error('Error updating status:', error)
        toast.error(`Failed to ${action} branch.`)
      }
    }

    return {
      branches,
      staffOptions,
      activeBranches,
      archivedBranches,
      showEditModal,
      currentBranch,
      openEditModal,
      archiveBranch,
      unarchiveBranch,
      updateBranch,
      toggleStatus
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <div class="mb-6 flex flex-col items-start justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
        <div>
          <h1 class="mb-1 text-2xl font-bold text-white md:text-3xl">Branch Management</h1>
          <p class="text-sm text-slate-400 md:text-base">Monitor branch locations, employees, and revenue performance</p>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <table class="w-full min-w-[600px] border-collapse text-left sm:min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-700 text-xs uppercase text-slate-400 sm:text-sm">
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Name</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Location</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Admin</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Revenue</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Status</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr
              v-for="branch in activeBranches"
              :key="branch.id"
              class="transition-colors hover:bg-slate-700"
            >
              <td class="px-2 py-2 font-medium sm:px-4 sm:py-3">{{ branch.clinicBranch }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">{{ branch.clinicLocation || 'N/A' }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <div class="text-sm text-white">{{ branch.branchAdminName || 'Not assigned' }}</div>
                <div v-if="branch.isMainBranch" class="text-xs text-amber-300 mt-1">Main branch</div>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">PHP {{ branch.revenue ? branch.revenue.toLocaleString() : 0 }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <span
                  @click="toggleStatus(branch)"
                  :class="[
                    'cursor-pointer rounded-full px-2 py-1 text-xs font-medium sm:px-3 sm:text-sm',
                    branch.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  ]"
                >
                  {{ branch.status }}
                </span>
              </td>
              <td class="flex flex-wrap gap-2 px-2 py-2 sm:px-4 sm:py-3">
                <button
                  @click="openEditModal(branch)"
                  class="flex-1 rounded bg-yellow-500 px-3 py-1 text-white transition hover:bg-yellow-600 sm:flex-none"
                >
                  Edit
                </button>
                <button
                  @click="archiveBranch(branch)"
                  class="flex-1 rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 sm:flex-none"
                >
                  Archive
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-8 overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-white sm:text-xl">Archived Branches</h2>
          <p class="text-sm text-slate-400">Inactive branches archived by the owner.</p>
        </div>
        <table class="w-full min-w-[600px] border-collapse text-left sm:min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-700 text-xs uppercase text-slate-400 sm:text-sm">
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Name</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Location</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Admin</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Revenue</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Status</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-if="archivedBranches.length === 0">
              <td colspan="5" class="py-6 text-center text-slate-400">No archived branches yet.</td>
            </tr>
            <tr
              v-for="branch in archivedBranches"
              :key="branch.id"
              class="transition-colors hover:bg-slate-700"
            >
              <td class="px-2 py-2 font-medium sm:px-4 sm:py-3">{{ branch.clinicBranch }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">{{ branch.clinicLocation || 'N/A' }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <div class="text-sm text-white">{{ branch.branchAdminName || 'Not assigned' }}</div>
                <div v-if="branch.isMainBranch" class="text-xs text-amber-300 mt-1">Main branch</div>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">PHP {{ branch.revenue ? branch.revenue.toLocaleString() : 0 }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <span class="rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-400 sm:px-3 sm:text-sm">
                  Inactive
                </span>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <button
                  @click="unarchiveBranch(branch)"
                  class="rounded bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-700"
                >
                  Unarchive
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal :isOpen="showEditModal" panelClass="bg-slate-800 text-white w-full max-w-md" @close="showEditModal = false">
        <template #header>
          <h2 class="text-xl font-semibold text-white">Edit Branch</h2>
        </template>

        <template #body>
          <form class="space-y-4">
            <div>
              <label class="mb-1 block text-slate-400">Branch Name</label>
              <input
                v-model="currentBranch.clinicBranch"
                type="text"
                placeholder="Enter branch name"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Location</label>
              <input
                v-model="currentBranch.clinicLocation"
                type="text"
                placeholder="Enter location"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Revenue</label>
              <input
                v-model.number="currentBranch.revenue"
                type="number"
                min="0"
                step="0.01"
                placeholder="Revenue"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Status</label>
              <select
                v-model="currentBranch.status"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>

            <div class="rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3">
              <label class="flex items-center gap-3 text-white">
                <input
                  v-model="currentBranch.isMainBranch"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-500 bg-slate-800 text-amber-500"
                />
                <span>Set as main branch</span>
              </label>
            </div>

            <div>
              <label class="mb-1 block text-slate-400">Branch Admin</label>
              <select
                v-model="currentBranch.branchAdminId"
                class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                @change="currentBranch.branchAdminName = staffOptions.find((staff) => staff.id === currentBranch.branchAdminId)?.fullName || ''"
              >
                <option value="">Select branch admin</option>
                <option
                  v-for="staff in staffOptions"
                  :key="staff.id"
                  :value="staff.id"
                >
                  {{ staff.fullName }} - {{ staff.role }}{{ staff.isOwner ? ' (Clinic Admin)' : '' }}
                </option>
              </select>
              <p class="mt-1 text-xs text-slate-400">The branch admin is auto-filled for the main branch, but you can change it here.</p>
            </div>
          </form>
        </template>

        <template #footer>
          <div class="flex flex-col justify-end space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
            <button @click="showEditModal = false" class="rounded bg-slate-600 px-4 py-2 text-white transition hover:bg-slate-700">
              Cancel
            </button>
            <button @click="updateBranch" class="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700">
              Update
            </button>
          </div>
        </template>
      </Modal>
    </main>
  </div>
</template>
