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
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="row in monthlyPayrollRows" :key="row.employeeId" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ row.employeeName }}</td>
                <td class="px-6 py-4 text-slate-300">{{ row.position }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.basicSalary) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatCurrency(row.commission) }}</td>
                <td class="px-6 py-4 text-rose-400 font-semibold">{{ formatCurrency(row.totalSalary) }}</td>
                <td class="px-6 py-4">
                  <button
                    type="button"
                    class="rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/10"
                    :disabled="!row.employeeId"
                    @click="printApprovedPayslip(row)"
                  >
                    Print Payslip
                  </button>
                </td>
              </tr>
              <tr v-if="payrolls.length === 0">
                <td colspan="6" class="px-6 py-8 text-center text-slate-400">No payroll records available.</td>
              </tr>
              <tr v-else-if="monthlyPayrollRows.length === 0">
                <td colspan="6" class="px-6 py-8 text-center text-slate-400">No payroll records for selected month.</td>
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
import { getFirestore, collection, getDocs, query, where, doc, getDoc, orderBy, limit } from 'firebase/firestore'
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
            basicSalary: 0,
            commission: 0,
            totalSalary: 0
          }
        }

        const workedBasePay = Number(entry.hourlyRate || 0) * Number(entry.hoursWorked || 0)
        grouped[key].basicSalary += workedBasePay
        grouped[key].commission += Number(entry.commission || 0)
        grouped[key].totalSalary += Number(entry.totalPay || 0)
      })

      return Object.values(grouped).sort((a, b) => b.totalSalary - a.totalSalary)
    })

    const monthlyPayrollTotal = computed(() =>
      monthlyPayrollRows.value.reduce((sum, row) => sum + Number(row.totalSalary || 0), 0)
    )

    const formatPrintDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-PH')
    }

    const renderPayslipHtml = (payload) => {
      const deductions = payload.deductions || {}
      const deductionRows = Object.entries(deductions).map(([key, value]) => {
        const amount = typeof value === 'object' ? Number(value.amount || 0) : Number(value || 0)
        return `<tr><td style="padding:8px 0;color:#4b5563;">${key}</td><td style="padding:8px 0;text-align:right;">${formatCurrency(amount)}</td></tr>`
      }).join('')

      const earningsRows = Object.entries(payload.earnings || {}).map(([key, value]) => {
        return `<tr><td style="padding:8px 0;color:#4b5563;">${key}</td><td style="padding:8px 0;text-align:right;">${formatCurrency(value)}</td></tr>`
      }).join('')

      return `
        <html>
          <head>
            <title>Payslip - ${payload.employeeName || 'Employee'}</title>
            <style>
              @page { size: A4; margin: 16mm; }
              body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
              .sheet { padding: 0; }
              .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:24px; }
              .brand { font-size: 18px; font-weight: 700; }
              .muted { color: #6b7280; font-size: 12px; }
              .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
              .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; color: #374151; }
              table { width: 100%; border-collapse: collapse; }
              td { font-size: 13px; border-bottom: 1px solid #f3f4f6; }
              .summary { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
              .summary .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
              .summary .box p { margin: 0; font-size: 12px; color: #6b7280; }
              .summary .box h3 { margin: 6px 0 0; font-size: 15px; }
              .accent { color: #b45309; }
              .green { color: #047857; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="header">
                <div>
                  <div class="brand">Approved Payslip</div>
                  <div class="muted">${payload.branchName || 'Clinic Branch'}</div>
                </div>
                <div class="muted" style="text-align:right">
                  <div><strong>Employee:</strong> ${payload.employeeName || '-'}</div>
                  <div><strong>Position:</strong> ${payload.position || '-'}</div>
                  <div><strong>Period:</strong> ${payload.payPeriod || selectedMonth.value}</div>
                  <div><strong>Generated:</strong> ${payload.generatedLabel || '-'}</div>
                </div>
              </div>

              <div class="card">
                <div class="section-title">Earnings</div>
                <table>
                  ${earningsRows || '<tr><td style="padding:8px 0;color:#6b7280;">No earnings entries.</td><td></td></tr>'}
                </table>
              </div>

              <div class="card">
                <div class="section-title">Deductions</div>
                <table>
                  ${deductionRows || '<tr><td style="padding:8px 0;color:#6b7280;">No deductions entries.</td><td></td></tr>'}
                </table>
              </div>

              <div class="summary">
                <div class="box">
                  <p>Total Earnings</p>
                  <h3 class="accent">${formatCurrency(payload.totalEarnings || 0)}</h3>
                </div>
                <div class="box">
                  <p>Total Deductions</p>
                  <h3>${formatCurrency(payload.totalDeductions || 0)}</h3>
                </div>
                <div class="box">
                  <p>Net Pay</p>
                  <h3 class="green">${formatCurrency(payload.netPay || 0)}</h3>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    }

    const printApprovedPayslip = async (row) => {
      if (!row?.employeeId) return

      try {
        const [payslipSnap, userSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'users', row.employeeId, 'payslips'),
            orderBy('dateGenerated', 'desc'),
            limit(1)
          )),
          getDoc(doc(db, 'users', row.employeeId))
        ])

        const latestPayslip = payslipSnap.empty ? null : payslipSnap.docs[0].data() || {}
        const userData = userSnap.exists() ? (userSnap.data() || {}) : {}
        const payload = {
          employeeName: latestPayslip?.employeeName || row.employeeName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Employee',
          position: latestPayslip?.jobTitle || row.position || userData.role || userData.jobTitle || '-',
          branchName: userData.clinicBranch || userData.branchName || 'Clinic Branch',
          payPeriod: latestPayslip?.payPeriod || selectedMonth.value,
          generatedLabel: formatPrintDate(latestPayslip?.dateGenerated || latestPayslip?.createdAt),
          earnings: latestPayslip?.earnings || {
            basicSalary: row.basicSalary || 0,
            commission: row.commission || 0,
            total: row.totalSalary || 0
          },
          deductions: latestPayslip?.deductions || {},
          totalEarnings: latestPayslip?.totalEarnings ?? row.totalSalary ?? 0,
          totalDeductions: latestPayslip?.totalDeductions ?? 0,
          netPay: latestPayslip?.netPay ?? row.totalSalary ?? 0
        }

        if (!latestPayslip) {
          toast.info('No saved payslip found for this employee yet. Printing the payroll summary values instead.')
        }

        const printWindow = window.open('', '_blank', 'width=900,height=700')
        if (!printWindow) {
          toast.error('Popup blocked. Please allow popups to print the payslip.')
          return
        }

        printWindow.document.open()
        printWindow.document.write(renderPayslipHtml(payload))
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
      } catch (error) {
        console.error('Failed to print approved payslip:', error)
        toast.error('Unable to print the approved payslip.')
      }
    }

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
      formatCurrency,
      printApprovedPayslip
    }
  }
}
</script>

