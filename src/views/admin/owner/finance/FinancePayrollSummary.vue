<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Payroll Summary</h1>
          <p class="text-slate-400">Monitor labor costs and payroll trends for finance control.</p>
        </div>
        <div>
          <label class="block text-slate-400 text-sm mb-2">Payroll Month</label>
          <input
            v-model="selectedMonth"
            type="month"
            class="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Payroll Total (Month)</p>
          <p class="text-3xl font-bold text-rose-400">{{ formatCurrency(monthlyPayrollTotal) }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Employees Paid</p>
          <p class="text-3xl font-bold text-white">{{ monthlyPayrollRows.length }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p class="text-slate-400 text-sm">Payroll vs Revenue</p>
          <p class="text-3xl font-bold text-white">{{ payrollVsRevenuePercent.toFixed(2) }}%</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-slate-700">
          <h2 class="text-lg font-semibold text-white">Monthly Payroll Details</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Employee</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Position</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Basic Salary</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Commission</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Total Salary</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="row in monthlyPayrollRows" :key="row.employeeId" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ row.employeeName }}</td>
                <td class="px-6 py-4 text-slate-300">{{ row.position }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.basicSalary) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.commission) }}</td>
                <td class="px-6 py-4 text-rose-400 font-semibold">{{ formatCurrency(row.totalSalary) }}</td>
              </tr>
              <tr v-if="payrolls.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No payroll records available.</td>
              </tr>
              <tr v-else-if="monthlyPayrollRows.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No payroll records for selected month.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-700">
          <h2 class="text-lg font-semibold text-white">Payroll History by Month</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Month</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Employees</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Payroll Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="history in payrollHistory" :key="history.monthKey" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ history.label }}</td>
                <td class="px-6 py-4 text-slate-300">{{ history.employeeCount }}</td>
                <td class="px-6 py-4 text-rose-400 font-semibold">{{ formatCurrency(history.total) }}</td>
              </tr>
              <tr v-if="payrollHistory.length === 0">
                <td colspan="3" class="px-6 py-8 text-center text-slate-400">No payroll history available.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'FinancePayrollSummary',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const payrolls = ref([])
    const users = ref([])
    const transactions = ref([])
    const selectedMonth = ref(new Date().toISOString().slice(0, 7))

    const toDate = (timestamp) => (timestamp?.toDate ? timestamp.toDate() : null)
    const monthKey = (date) =>
      date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : ''
    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value || 0))

    const userById = computed(() => {
      const map = {}
      users.value.forEach((user) => {
        map[user.id] = user
      })
      return map
    })

    const monthlyPayrollRows = computed(() => {
      const grouped = {}

      payrolls.value.forEach((entry) => {
        const date = toDate(entry.createdAt)
        if (monthKey(date) !== selectedMonth.value) return

        const key = entry.employeeId || entry.employeeName || entry.id
        if (!grouped[key]) {
          const profile = userById.value[entry.employeeId] || {}
          grouped[key] = {
            employeeId: entry.employeeId || key,
            employeeName: entry.employeeName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown',
            position: profile.role || profile.jobTitle || '-',
            basicSalary: Number(profile.basicSalary || profile.monthlySalary || 0),
            commission: 0,
            totalSalary: 0
          }
        }

        grouped[key].commission += Number(entry.commission || 0)
        grouped[key].totalSalary += Number(entry.totalPay || 0)
      })

      return Object.values(grouped).sort((a, b) => b.totalSalary - a.totalSalary)
    })

    const monthlyPayrollTotal = computed(() =>
      monthlyPayrollRows.value.reduce((sum, row) => sum + Number(row.totalSalary || 0), 0)
    )

    const monthlyRevenue = computed(() =>
      transactions.value.reduce((sum, tx) => {
        const date = toDate(tx.createdAt)
        if (monthKey(date) !== selectedMonth.value) return sum
        return sum + Number(tx.amount || 0)
      }, 0)
    )

    const payrollVsRevenuePercent = computed(() =>
      monthlyRevenue.value > 0 ? (monthlyPayrollTotal.value / monthlyRevenue.value) * 100 : 0
    )

    const payrollHistory = computed(() => {
      const grouped = {}

      payrolls.value.forEach((entry) => {
        const date = toDate(entry.createdAt)
        const key = monthKey(date)
        if (!key) return

        if (!grouped[key]) {
          grouped[key] = {
            monthKey: key,
            label: new Date(`${key}-01`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
            total: 0,
            employees: new Set()
          }
        }

        grouped[key].total += Number(entry.totalPay || 0)
        grouped[key].employees.add(entry.employeeId || entry.employeeName || entry.id)
      })

      return Object.values(grouped)
        .map((row) => ({ ...row, employeeCount: row.employees.size }))
        .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
    })

    const loadPayrollData = async () => {
      if (!currentBranchId.value) return

      const [payrollSnap, usersSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, 'payrolls'), where('branchId', '==', currentBranchId.value))),
        getDocs(query(collection(db, 'users'), where('branchId', '==', currentBranchId.value), where('userType', '==', 'Staff'))),
        getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value)))
      ])

      payrolls.value = payrollSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      users.value = usersSnap.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((user) => !user.archived)
      transactions.value = txSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          payrolls.value = []
          users.value = []
          transactions.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadPayrollData()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      payrolls,
      selectedMonth,
      monthlyPayrollRows,
      monthlyPayrollTotal,
      payrollVsRevenuePercent,
      payrollHistory,
      formatCurrency
    }
  }
}
</script>

