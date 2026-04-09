<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar class="w-full md:w-64 flex-shrink-0" />

    <main class="flex-1 p-4 md:p-8">
      <div class="mb-6 md:mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Reports & Analytics</h1>
        <p class="text-slate-400 text-sm md:text-base">View detailed performance metrics for branches, employees, and revenue</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h3 class="text-slate-400 text-xs sm:text-sm mb-1">Total Branches</h3>
          <p class="text-2xl sm:text-3xl font-bold text-white">{{ totalBranches }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h3 class="text-slate-400 text-xs sm:text-sm mb-1">Total Employees</h3>
          <p class="text-2xl sm:text-3xl font-bold text-white">{{ totalEmployees }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h3 class="text-slate-400 text-xs sm:text-sm mb-1">Total Revenue</h3>
          <p class="text-2xl sm:text-3xl font-bold text-white">P{{ monthlyRevenue.toLocaleString('en-PH') }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h3 class="text-slate-400 text-xs sm:text-sm mb-1">New Inquiries</h3>
          <p class="text-2xl sm:text-3xl font-bold text-white">{{ newInquiries }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mt-8">
        <h2 class="text-xl font-semibold text-white mb-6">Employee Activity Log</h2>
        <div class="max-h-[420px] overflow-y-auto overflow-x-auto">
          <table class="min-w-full text-sm text-left text-slate-300">
            <thead class="bg-slate-700 text-slate-200 uppercase text-xs">
              <tr>
                <th class="px-6 py-3">Date</th>
                <th class="px-6 py-3">Employee</th>
                <th class="px-6 py-3">Action</th>
                <th class="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody v-if="activityLogs.length > 0">
              <tr v-for="log in activityLogs" :key="log.id" class="border-b border-slate-700 hover:bg-slate-700/50">
                <td class="px-6 py-4">{{ formatDate(log.createdAt) }}</td>
                <td class="px-6 py-4">{{ log.actorName || '-' }}</td>
                <td class="px-6 py-4 font-medium text-white">{{ log.action || '-' }}</td>
                <td class="px-6 py-4">{{ log.details || '-' }}</td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr>
                <td colspan="4" class="px-6 py-4 text-center text-slate-400">
                  No activity logs available
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'

export default {
  name: 'OwnerReports',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())

    const totalBranches = ref(0)
    const totalEmployees = ref(0)
    const monthlyRevenue = ref(0)
    const newInquiries = ref(0)
    const branches = ref([])
    const activityLogs = ref([])

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const loadOwnerData = async (user) => {
      const branchQuery = query(collection(db, 'clinics'), where('ownerId', '==', user.uid))
      const branchSnapshot = await getDocs(branchQuery)
      const branchData = branchSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))

      branches.value = branchData
      totalBranches.value = branchData.length
      monthlyRevenue.value = branchData.reduce((sum, b) => sum + Number(b.revenue || 0), 0)
      newInquiries.value = branchData.reduce((sum, b) => sum + Number(b.inquiries || 0), 0)

      const branchIds = branchData.map((b) => b.id).filter(Boolean)
      let totalStaff = 0
      if (branchIds.length) {
        const chunks = chunkArray(branchIds)
        for (const chunk of chunks) {
          const staffQuery = query(
            collection(db, 'users'),
            where('branchId', 'in', chunk),
            where('userType', '==', 'Staff')
          )
          const usersSnapshot = await getDocs(staffQuery)
          totalStaff += usersSnapshot.docs.filter((snap) => !snap.data()?.archived).length
        }
      }
      totalEmployees.value = totalStaff

      const activityQuery = query(collection(db, 'activities'), where('ownerId', '==', user.uid))
      const activitySnapshot = await getDocs(activityQuery)
      activityLogs.value = activitySnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((log) => String(log.actorUserType || '').toLowerCase() === 'staff')
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          totalBranches.value = 0
          totalEmployees.value = 0
          monthlyRevenue.value = 0
          newInquiries.value = 0
          activityLogs.value = []
          return
        }
        await loadOwnerData(user)
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      totalBranches,
      totalEmployees,
      monthlyRevenue,
      newInquiries,
      branches,
      activityLogs,
      formatDate
    }
  }
}
</script>
