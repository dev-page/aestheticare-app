<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-white mb-1">Payroll Summary Approval</h1>
        <p class="text-slate-400 text-sm">Review monthly payroll summaries and approve them for payslip generation.</p>
      </div>

      <section class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-700 text-sm text-slate-400">
          Monthly Summaries
        </div>

        <div v-if="loading" class="px-5 py-6">
          <PageSectionSkeleton variant="table" :rows="5" :columns="8" />
        </div>
        <div v-else-if="!summaries.length" class="px-5 py-6 text-slate-300 text-sm">No payroll summaries yet.</div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Month</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Employees</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Total Payroll</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Net Pay</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Created At</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Approved By</th>
                <th class="px-5 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="summary in summaries" :key="summary.id" class="hover:bg-slate-700/40 transition-colors">
                <td class="px-5 py-3 text-white text-sm">{{ summary.monthLabel || summary.monthKey }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ summary.totalEmployees || 0 }}</td>
                <td class="px-5 py-3 text-amber-400 text-sm font-semibold">{{ formatCurrency(summary.totalPayroll) }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatCurrency(summary.totalNetPay) }}</td>
                <td class="px-5 py-3">
                  <span
                    class="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    :class="statusBadge(summary.status)"
                  >
                    {{ formatStatus(summary.status) }}
                  </span>
                </td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ formatDate(summary.createdAt || summary.updatedAt) }}</td>
                <td class="px-5 py-3 text-slate-300 text-sm">{{ summary.approvedByName || '-' }}</td>
                <td class="px-5 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-500 text-slate-200 hover:bg-slate-600/40"
                      @click="openSummaryModal(summary)"
                    >
                      View
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/60 text-amber-200 hover:bg-amber-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      :disabled="processingId === summary.id || summary.status === 'approved'"
                      @click="approveSummary(summary)"
                    >
                      {{ summary.status === 'approved' ? 'Approved' : 'Approve' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="showSummaryModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div>
              <h3 class="text-lg font-semibold text-white">Payroll Summary Details</h3>
              <p class="text-xs text-slate-400">{{ selectedSummary?.monthLabel || selectedSummary?.monthKey }}</p>
            </div>
            <button
              class="text-slate-400 hover:text-white text-xl leading-none"
              @click="showSummaryModal = false"
            >
              &times;
            </button>
          </div>
          <div class="px-5 py-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300 mb-4">
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Employees</div>
                <div class="text-white font-semibold">{{ selectedSummary?.totalEmployees || 0 }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Total Payroll</div>
                <div class="text-amber-300 font-semibold">{{ formatCurrency(selectedSummary?.totalPayroll || 0) }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Total Deductions</div>
                <div class="text-slate-200 font-semibold">{{ formatCurrency(totalDeductionsAll || 0) }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Net Pay</div>
                <div class="text-emerald-300 font-semibold">{{ formatCurrency(selectedSummary?.totalNetPay || 0) }}</div>
              </div>
            </div>

            <div class="overflow-x-auto border border-slate-700 rounded-xl">
              <table class="w-full text-left min-w-[700px]">
                <thead class="bg-slate-800">
                  <tr class="text-slate-400 uppercase text-xs border-b border-slate-700">
                    <th class="py-2 px-3">Employee</th>
                    <th class="py-2 px-3">Rate</th>
                    <th class="py-2 px-3">Hours</th>
                    <th class="py-2 px-3">Commission</th>
                    <th class="py-2 px-3">Total Pay</th>
                    <th class="py-2 px-3">Total Deductions</th>
                    <th class="py-2 px-3">Net Pay</th>
                  </tr>
                </thead>
                <tbody class="text-white">
                  <tr v-for="entry in summaryEntries" :key="entry.id" class="border-b border-slate-800">
                    <td class="py-2 px-3 font-medium">{{ entry.employeeName }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ formatCurrency(entry.hourlyRate || 0) }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ entry.hoursWorked ?? '-' }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ formatCurrency(entry.commission || 0) }}</td>
                    <td class="py-2 px-3 text-amber-300 font-semibold">{{ formatCurrency(entry.totalPay || 0) }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ formatCurrency(entry.totalDeductions || 0) }}</td>
                    <td class="py-2 px-3 text-emerald-300 font-semibold">{{ formatCurrency(entry.netPay || 0) }}</td>
                  </tr>
                  <tr v-if="summaryEntries.length" class="bg-slate-800/80 text-white font-semibold">
                    <td class="py-2 px-3">Totals</td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3 text-amber-300">{{ formatCurrency(summaryTotalsRow.totalPay) }}</td>
                    <td class="py-2 px-3 text-slate-200">{{ formatCurrency(summaryTotalsRow.totalDeductions) }}</td>
                    <td class="py-2 px-3 text-emerald-300">{{ formatCurrency(summaryTotalsRow.netPay) }}</td>
                  </tr>
                  <tr v-if="!summaryEntries.length">
                    <td colspan="7" class="py-6 text-center text-slate-400">No payroll entries found for this summary.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { toast } from 'vue3-toastify'

export default {
  name: 'FinancePayrollApproval',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
    const currentBranchId = ref('')
    const currentUserId = ref('')
    const currentUserName = ref('')
    const summaries = ref([])
    const loading = ref(true)
    const processingId = ref('')
    const showSummaryModal = ref(false)
    const selectedSummary = ref(null)
    const summaryEntries = ref([])
    const totalDeductionsAll = computed(() => {
      return summaryEntries.value.reduce((sum, entry) => sum + Number(entry.totalDeductions || 0), 0)
    })
    const summaryTotalsRow = computed(() => {
      return summaryEntries.value.reduce((acc, entry) => {
        acc.totalPay += Number(entry.totalPay || 0)
        acc.totalDeductions += Number(entry.totalDeductions || 0)
        acc.netPay += Number(entry.netPay || 0)
        return acc
      }, { totalPay: 0, totalDeductions: 0, netPay: 0 })
    })

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'code'
      }).format(Number(value) || 0)
    }

    const formatStatus = (value) => {
      const status = String(value || 'pending').toLowerCase()
      if (status === 'approved') return 'Approved'
      if (status === 'rejected') return 'Rejected'
      return 'Pending'
    }

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-PH')
    }

    const statusBadge = (value) => {
      const status = String(value || 'pending').toLowerCase()
      if (status === 'approved') return 'bg-emerald-500/20 text-emerald-300'
      if (status === 'rejected') return 'bg-rose-500/20 text-rose-300'
      return 'bg-amber-500/20 text-amber-300'
    }

    let unsubscribeAuth = null
    let unsubscribeSummaries = null

    const subscribeSummaries = () => {
      if (!currentBranchId.value) return
      if (unsubscribeSummaries) unsubscribeSummaries()
      loading.value = true
      const summariesQuery = query(
        collection(db, 'payrollSummaries'),
        where('branchId', '==', currentBranchId.value)
      )
      unsubscribeSummaries = onSnapshot(summariesQuery, (snapshot) => {
        summaries.value = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => String(b.monthKey || '').localeCompare(String(a.monthKey || '')))
        loading.value = false
      }, () => {
        loading.value = false
      })
    }

    const approveSummary = async (summary) => {
      if (!summary?.id) return
      processingId.value = summary.id
      try {
        await updateDoc(doc(db, 'payrollSummaries', summary.id), {
          status: 'approved',
          approvedBy: currentUserId.value,
          approvedByName: currentUserName.value || 'Finance',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        toast.success('Payroll summary approved.')
      } catch (error) {
        console.error('Failed to approve summary:', error)
        toast.error('Unable to approve payroll summary.')
      } finally {
        processingId.value = ''
      }
    }

    const getMonthKeyFromDate = (value) => {
      if (!value) return ''
      if (value?.toDate) return getMonthKeyFromDate(value.toDate())
      if (value?.seconds) return getMonthKeyFromDate(new Date(value.seconds * 1000))
      if (typeof value === 'string') {
        if (value.includes('-') && value.length >= 7) return value.slice(0, 7)
      }
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return ''
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
    }

    const openSummaryModal = async (summary) => {
      selectedSummary.value = summary
      showSummaryModal.value = true
      summaryEntries.value = []
      if (!summary?.branchId || !summary?.monthKey) return
      try {
        const snapshot = await getDocs(query(
          collection(db, 'payrolls'),
          where('branchId', '==', summary.branchId)
        ))
        summaryEntries.value = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((entry) => {
            const key = entry.payPeriodMonthKey || getMonthKeyFromDate(entry.createdAt || entry.date)
            return key === summary.monthKey
          })
      } catch (error) {
        console.error('Failed to load summary entries:', error)
      }
    }

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return
        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (!userSnap.exists()) return
        const data = userSnap.data() || {}
        currentBranchId.value = data.branchId || ''
        currentUserName.value = `${data.firstName || ''} ${data.lastName || ''}`.trim()
        subscribeSummaries()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (unsubscribeSummaries) unsubscribeSummaries()
    })

    return {
      summaries,
      loading,
      processingId,
      showSummaryModal,
      selectedSummary,
      summaryEntries,
      totalDeductionsAll,
      summaryTotalsRow,
      formatCurrency,
      formatStatus,
      formatDate,
      statusBadge,
      openSummaryModal,
      approveSummary
    }
  }
}
</script>
