<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Records</h1>
      <p class="text-slate-400 mb-6">Employees under your assigned branch</p>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[600px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-4">Name</th>
              <th class="py-2 px-4">Email</th>
              <th class="py-2 px-4">Role</th>
              <th class="py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-for="staff in staffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <td class="py-2 px-4 font-medium">{{ staff.firstName }} {{ staff.lastName }}</td>
              <td class="py-2 px-4">{{ staff.email }}</td>
              <td class="py-2 px-4">{{ staff.role || 'Staff' }}</td>
              <td class="py-2 px-4">
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-xs font-medium',
                    staff.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  ]"
                >
                  {{ staff.status || 'Inactive' }}
                </span>
              </td>
            </tr>

            <tr v-if="staffList.length === 0">
              <td colspan="4" class="py-6 text-center text-slate-400">No staff found for your branch.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ManagerStaffs',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const staffList = ref([])
    const currentUserId = ref('')
    const currentBranchId = ref('')

    const loadStaffList = async () => {
      if (!currentBranchId.value) {
        staffList.value = []
        return
      }

      const staffQuery = query(
        collection(db, 'users'),
        where('branchId', '==', currentBranchId.value),
        where('userType', '==', 'Staff')
      )
      const snapshot = await getDocs(staffQuery)
      staffList.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((staff) => staff.id !== currentUserId.value && !staff.archived)
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          staffList.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''

        await loadStaffList()
        await logActivity(db, {
          module: 'Manager',
          action: 'Viewed staff list',
          details: 'Opened manager staff list page.'
        })
      })
    })

    return { staffList }
  }
}
</script>
