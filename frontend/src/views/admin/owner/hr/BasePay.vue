<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'BasePay',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const staffList = ref([])
    const loading = ref(false)
    const savingId = ref('')

    const loadStaff = async () => {
      if (!currentBranchId.value) {
        staffList.value = []
        return
      }

      loading.value = true
      try {
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', '==', currentBranchId.value),
          where('userType', '==', 'Staff')
        )
        const snapshot = await getDocs(staffQuery)
        staffList.value = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .filter((staff) => !staff.archived)
          .map((staff) => ({
            id: staff.id,
            fullName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'Unnamed',
            role: String(staff.customRoleName || staff.role || 'Staff').trim(),
            basePay: Number(staff.basePay || 0)
          }))
      } catch (error) {
        console.error('Failed to load staff for base pay:', error)
        toast.error('Failed to load base pay records.')
      } finally {
        loading.value = false
      }
    }

    const saveBasePay = async (staff) => {
      if (!staff) return
      const basePayValue = Number(staff.basePay)
      if (!Number.isFinite(basePayValue)) {
        toast.error('Base pay must be a valid number.')
        return
      }
      if (basePayValue < 0) {
        toast.error('Base pay cannot be negative.')
        return
      }
      savingId.value = staff.id
      try {
        await updateDoc(doc(db, 'users', staff.id), {
          basePay: Number(basePayValue || 0)
        })

        await logActivity(db, {
          module: 'HR',
          action: 'Updated base pay',
          details: `Updated base pay for ${staff.fullName} (${staff.role}).`,
          targetUserId: staff.id,
          targetUserName: staff.fullName
        })

        toast.success('Base pay saved.')
      } catch (error) {
        console.error('Failed to save base pay:', error)
        toast.error('Failed to save base pay.')
      } finally {
        savingId.value = ''
      }
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          staffList.value = []
          return
        }

        currentUserId.value = user.uid
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userDoc.exists() ? (userDoc.data().branchId || '') : ''

        if (!currentBranchId.value) {
          staffList.value = []
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadStaff()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      staffList,
      loading,
      savingId,
      saveBasePay
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8 text-white">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Base Pay</h1>
        <p class="text-slate-400 text-sm md:text-base">
          Set base pay for employees.
        </p>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <div v-if="loading" class="py-2">
          <PageSectionSkeleton variant="table" :rows="6" :columns="4" />
        </div>
        <table class="w-full text-left min-w-[900px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-3 sm:py-3 sm:px-4">Employee</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Role</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Base Pay (PHP/hr)</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Action</th>
            </tr>
          </thead>
          <tbody v-if="!loading" class="text-white">
            <tr v-for="staff in staffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <td class="py-2 px-3 sm:py-3 sm:px-4 font-medium">{{ staff.fullName }}</td>
              <td class="py-2 px-3 sm:py-3 sm:px-4">{{ staff.role }}</td>
              <td class="py-2 px-3 sm:py-3 sm:px-4">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  v-model.number="staff.basePay"
                  class="w-full min-w-[140px] px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </td>
              <td class="py-2 px-3 sm:py-3 sm:px-4">
                <button
                  @click="saveBasePay(staff)"
                  :disabled="savingId === staff.id"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ savingId === staff.id ? 'Saving...' : 'Save' }}
                </button>
              </td>
            </tr>

            <tr v-if="staffList.length === 0">
              <td colspan="4" class="py-6 text-center text-slate-400">No employees found for your branch.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
