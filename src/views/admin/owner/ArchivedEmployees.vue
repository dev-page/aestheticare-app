<script>
import { ref, onMounted } from 'vue'
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'

export default {
  name: 'OwnerArchivedEmployees',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const archivedStaff = ref([])
    const ownerBranchIds = ref([])
    const getRoleLabel = (staff) => String(staff?.customRoleName || staff?.role || 'Staff').trim()

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const loadBranches = async (ownerId) => {
      const snapshot = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
      ownerBranchIds.value = snapshot.docs.map((docSnap) => docSnap.id).filter(Boolean)
    }

    const loadArchivedStaff = async () => {
      if (!ownerBranchIds.value.length) {
        archivedStaff.value = []
        return
      }

      let results = []
      const chunks = chunkArray(ownerBranchIds.value)
      for (const chunk of chunks) {
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', 'in', chunk),
          where('userType', '==', 'Staff'),
          where('archived', '==', true)
        )
        const snapshot = await getDocs(staffQuery)
        results = results.concat(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })))
      }

      archivedStaff.value = results
        .sort((a, b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0))
    }

    const unarchiveStaff = async (staff) => {
      const fullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'Employee'
      const result = await Swal.fire({
        title: 'Unarchive Employee',
        text: `Do you want to unarchive ${fullName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, unarchive',
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) return

      try {
        await updateDoc(doc(db, 'users', staff.id), { archived: false, status: 'Active', archivedAt: null })
        toast.success(`${fullName} unarchived.`)
        await loadArchivedStaff()
      } catch (error) {
        console.error(error)
        toast.error('Failed to unarchive employee.')
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          ownerBranchIds.value = []
          archivedStaff.value = []
          return
        }
        await loadBranches(user.uid)
        await loadArchivedStaff()
      })
    })

    return {
      archivedStaff,
      getRoleLabel,
      unarchiveStaff
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Archived Employees</h1>
      <p class="text-slate-400 mb-6">Previously disabled employee accounts under your branches.</p>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[600px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-4">Name</th>
              <th class="py-2 px-4">Email</th>
              <th class="py-2 px-4">Role</th>
              <th class="py-2 px-4">Status</th>
              <th class="py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-for="staff in archivedStaff" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <td class="py-2 px-4 font-medium">{{ staff.firstName }} {{ staff.lastName }}</td>
              <td class="py-2 px-4">{{ staff.email }}</td>
              <td class="py-2 px-4">{{ getRoleLabel(staff) }}</td>
              <td class="py-2 px-4">
                <span class="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                  {{ staff.status || 'Inactive' }}
                </span>
              </td>
              <td class="py-2 px-4">
                <button
                  @click="unarchiveStaff(staff)"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded transition"
                >
                  Unarchive
                </button>
              </td>
            </tr>

            <tr v-if="archivedStaff.length === 0">
              <td colspan="5" class="py-6 text-center text-slate-400">No archived employees found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
