<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Payroll Management</h1>
        <p class="text-slate-400 text-sm md:text-base">Create payroll entries and generate payslips for your branch staff.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <h2 class="text-lg font-semibold text-white mb-4">Payroll Settings (Deductions)</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 mb-1">SSS (%)</label>
            <input
              type="number"
              v-model.number="deductionSettings.sssRate"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">PhilHealth (%)</label>
            <input
              type="number"
              v-model.number="deductionSettings.philHealthRate"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Pag-IBIG (%)</label>
            <input
              type="number"
              v-model.number="deductionSettings.pagIbigRate"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-slate-400 mt-1">Capped at PHP 200 per payroll run.</p>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Income Tax (%)</label>
            <input
              type="number"
              v-model.number="deductionSettings.incomeTaxRate"
              min="0"
              step="0.01"
              :disabled="deductionSettings.useGraduatedIncomeTax"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            <label class="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                v-model="deductionSettings.useGraduatedIncomeTax"
                class="h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
              />
              Use graduated income tax table
            </label>
          </div>
        </div>

        <div class="mt-4">
          <button
            type="button"
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="savingSettings"
            @click="savePayrollSettings"
          >
            {{ savingSettings ? 'Saving...' : 'Save Deduction Settings' }}
          </button>
        </div>

        <div class="mt-6 border-t border-slate-700 pt-5">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 class="text-base font-semibold text-white">Monthly Payroll Summary</h3>
              <p class="text-sm text-slate-400">
                Generate a single payroll summary for all employees in {{ approvalMonthLabel }} and send it to Finance for approval.
              </p>
            </div>
            <span
              class="px-3 py-1 rounded-full text-xs font-semibold"
              :class="summaryStatusClass"
            >
              {{ summaryStatusLabel }}
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300 mb-4">
            <div class="bg-slate-700/60 rounded-lg px-4 py-3 border border-slate-600">
              <div class="text-xs uppercase text-slate-400 mb-1">Employees</div>
              <div class="text-white font-semibold">{{ summaryTotals.totalEmployees || 0 }}</div>
            </div>
            <div class="bg-slate-700/60 rounded-lg px-4 py-3 border border-slate-600">
              <div class="text-xs uppercase text-slate-400 mb-1">Total Payroll</div>
              <div class="text-amber-300 font-semibold">{{ formatCurrency(summaryTotals.totalPayroll || 0) }}</div>
            </div>
            <div class="bg-slate-700/60 rounded-lg px-4 py-3 border border-slate-600">
              <div class="text-xs uppercase text-slate-400 mb-1">Net Pay</div>
              <div class="text-emerald-300 font-semibold">{{ formatCurrency(summaryTotals.totalNetPay || 0) }}</div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              class="bg-amber-500/90 hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="summaryLoading"
              @click="generateMonthlySummary"
            >
              {{ summaryLoading ? 'Generating...' : 'Generate Summary (All Employees)' }}
            </button>
            <button
              type="button"
              class="border border-slate-500 text-slate-200 px-4 py-2 rounded-lg font-semibold hover:bg-slate-700/60"
              :disabled="!monthlyPayrollEntries.length"
              @click="openSummaryModalForMonth(approvalMonthKey, approvalMonthLabel, isPayrollApproved)"
            >
              View Summary Details
            </button>
            <span class="text-xs text-slate-400">
              {{ summaryUpdatedAt ? `Last updated ${formatDate(summaryUpdatedAt)}` : 'No summary generated yet.' }}
            </span>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-semibold text-white">Payslips</h2>
            <p class="text-sm text-slate-400">View generated payslips for this branch.</p>
          </div>
        </div>

        <div v-if="payslipsLoading">
          <PageSectionSkeleton variant="table" :rows="5" :columns="7" />
        </div>
        <div v-else-if="!payslips.length" class="text-sm text-slate-300">No payslips generated yet.</div>

        <div v-else class="overflow-x-auto border border-slate-700 rounded-xl">
          <table class="w-full text-left min-w-[900px]">
            <thead class="bg-slate-800">
              <tr class="text-slate-400 uppercase text-xs border-b border-slate-700">
                <th class="py-2 px-3">Employee</th>
                <th class="py-2 px-3">Pay Period</th>
                <th class="py-2 px-3">Total Earnings</th>
                <th class="py-2 px-3">Total Deductions</th>
                <th class="py-2 px-3">Net Pay</th>
                <th class="py-2 px-3">Generated At</th>
                <th class="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="text-white">
              <tr v-for="slip in payslips" :key="slip.id" class="border-b border-slate-800">
                <td class="py-2 px-3 font-medium">{{ slip.employeeName }}</td>
                <td class="py-2 px-3 text-slate-300">{{ slip.payPeriod || '-' }}</td>
                <td class="py-2 px-3 text-amber-300 font-semibold">{{ formatCurrency(slip.totalEarnings || 0) }}</td>
                <td class="py-2 px-3 text-slate-300">{{ formatCurrency(slip.totalDeductions || 0) }}</td>
                <td class="py-2 px-3 text-emerald-300 font-semibold">{{ formatCurrency(slip.netPay || 0) }}</td>
                <td class="py-2 px-3 text-slate-300">{{ formatDate(slip.dateGenerated || slip.createdAt) }}</td>
                <td class="py-2 px-3">
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                    @click="openPayslipModal(slip)"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 class="text-lg font-semibold text-white">Approved Payroll Summaries</h2>
            <p class="text-sm text-slate-400">Track payroll summaries already approved by Finance.</p>
          </div>
        </div>

        <div v-if="approvedSummariesLoading">
          <PageSectionSkeleton variant="table" :rows="4" :columns="7" />
        </div>
        <div v-else-if="!approvedSummaries.length" class="text-sm text-slate-300">No approved summaries yet.</div>

        <div v-else class="overflow-x-auto border border-slate-700 rounded-xl">
          <table class="w-full text-left min-w-[700px]">
            <thead class="bg-slate-800">
              <tr class="text-slate-400 uppercase text-xs border-b border-slate-700">
                <th class="py-2 px-3">Month</th>
                <th class="py-2 px-3">Employees</th>
                <th class="py-2 px-3">Total Payroll</th>
                <th class="py-2 px-3">Total Deductions</th>
                <th class="py-2 px-3">Net Pay</th>
                <th class="py-2 px-3">Approved At</th>
                <th class="py-2 px-3">Approved By</th>
              </tr>
            </thead>
            <tbody class="text-white">
              <tr v-for="summary in approvedSummaries" :key="summary.id" class="border-b border-slate-800">
                <td class="py-2 px-3 font-medium">{{ summary.monthLabel || summary.monthKey }}</td>
                <td class="py-2 px-3 text-slate-300">{{ summary.totalEmployees || 0 }}</td>
                <td class="py-2 px-3 text-amber-300 font-semibold">{{ formatCurrency(summary.totalPayroll || 0) }}</td>
                <td class="py-2 px-3 text-slate-300">{{ formatCurrency(summary.totalDeductions || 0) }}</td>
                <td class="py-2 px-3 text-emerald-300 font-semibold">{{ formatCurrency(summary.totalNetPay || 0) }}</td>
                <td class="py-2 px-3 text-slate-300">{{ formatDate(summary.approvedAt || summary.updatedAt) }}</td>
                <td class="py-2 px-3 text-slate-300">{{ summary.approvedByName || '-' }}</td>
                <td class="py-2 px-3">
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-500 text-slate-200 hover:bg-slate-600/40"
                    @click="openSummaryModalForMonth(summary.monthKey, summary.monthLabel, true)"
                  >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="showSummaryDetails"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div>
              <h3 class="text-lg font-semibold text-white">Payroll Summary Details</h3>
              <p class="text-xs text-slate-400">Breakdown for {{ summaryModalLabel || approvalMonthLabel }}</p>
            </div>
            <button
              class="text-slate-400 hover:text-white text-xl leading-none"
              @click="showSummaryDetails = false"
            >
              &times;
            </button>
          </div>
          <div class="px-5 py-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300 mb-4">
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Employees</div>
                <div class="text-white font-semibold">{{ summaryTotals.totalEmployees || 0 }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Total Payroll</div>
                <div class="text-amber-300 font-semibold">{{ formatCurrency(summaryTotals.totalPayroll || 0) }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Net Pay</div>
                <div class="text-emerald-300 font-semibold">{{ formatCurrency(summaryTotals.totalNetPay || 0) }}</div>
              </div>
            </div>

            <div class="overflow-x-auto border border-slate-700 rounded-xl">
              <table class="w-full text-left min-w-[800px]">
                <thead class="bg-slate-800">
                  <tr class="text-slate-400 uppercase text-xs border-b border-slate-700">
                    <th class="py-2 px-3">Employee</th>
                    <th class="py-2 px-3">Rate</th>
                    <th class="py-2 px-3">Hours</th>
                    <th class="py-2 px-3">Commission</th>
                    <th class="py-2 px-3">Total Pay</th>
                    <th class="py-2 px-3">Total Deductions</th>
                    <th class="py-2 px-3">Net Pay</th>
                    <th class="py-2 px-3">Date</th>
                    <th class="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody class="text-white">
                  <tr v-for="entry in summaryModalEntries" :key="entry.id" class="border-b border-slate-800">
                    <td class="py-2 px-3 font-medium">{{ entry.employeeName }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ entry.hourlyRate != null ? formatCurrency(entry.hourlyRate) : '-' }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ entry.hoursWorked ?? '-' }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ entry.commission != null ? formatCurrency(entry.commission) : '-' }}</td>
                    <td class="py-2 px-3 text-amber-300 font-semibold">{{ formatCurrency(entry.totalPay || 0) }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ formatCurrency(entry.totalDeductions || 0) }}</td>
                    <td class="py-2 px-3 text-emerald-300 font-semibold">{{ formatCurrency(entry.netPay || 0) }}</td>
                    <td class="py-2 px-3 text-slate-300">{{ formatDate(entry.createdAt || entry.date) }}</td>
                    <td class="py-2 px-3">
                      <button
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/60 text-amber-200 hover:bg-amber-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                        :disabled="!summaryModalApproved || payslipLoading[entry.id]"
                        @click="generatePayslipForEntry(entry)"
                      >
                        {{ payslipLoading[entry.id] ? 'Generating...' : 'Generate Payslip' }}
                      </button>
                    </td>
                  </tr>
                  <tr v-if="summaryModalEntries.length" class="bg-slate-800/80 text-white font-semibold">
                    <td class="py-2 px-3">Totals</td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3 text-amber-300">{{ formatCurrency(summaryTotalsRow.totalPay) }}</td>
                    <td class="py-2 px-3 text-slate-200">{{ formatCurrency(summaryTotalsRow.totalDeductions) }}</td>
                    <td class="py-2 px-3 text-emerald-300">{{ formatCurrency(summaryTotalsRow.netPay) }}</td>
                    <td class="py-2 px-3"></td>
                    <td class="py-2 px-3"></td>
                  </tr>
                  <tr v-if="!summaryModalEntries.length">
                    <td colspan="10" class="py-6 text-center text-slate-400">No payroll entries for this month.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showPayslipModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-xl">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div>
              <h3 class="text-lg font-semibold text-white">Payslip Details</h3>
              <p class="text-xs text-slate-400">{{ selectedPayslip?.employeeName || 'Employee' }}</p>
            </div>
            <button
              class="text-slate-400 hover:text-white text-xl leading-none"
              @click="showPayslipModal = false"
            >
              &times;
            </button>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Pay Period</div>
                <div class="text-white font-semibold">{{ selectedPayslip?.payPeriod || '-' }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Generated At</div>
                <div class="text-white font-semibold">{{ formatDate(selectedPayslip?.dateGenerated || selectedPayslip?.createdAt) }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Total Earnings</div>
                <div class="text-amber-300 font-semibold">{{ formatCurrency(selectedPayslip?.totalEarnings || 0) }}</div>
              </div>
              <div class="bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                <div class="text-xs uppercase text-slate-400 mb-1">Net Pay</div>
                <div class="text-emerald-300 font-semibold">{{ formatCurrency(selectedPayslip?.netPay || 0) }}</div>
              </div>
            </div>

            <div class="bg-slate-800 rounded-xl border border-slate-700">
              <div class="px-4 py-3 border-b border-slate-700 text-xs uppercase text-slate-400">Breakdown</div>
              <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <div class="text-slate-400 text-xs uppercase mb-2">Earnings</div>
                  <div class="flex justify-between"><span>Hours Worked</span><span>{{ selectedPayslip?.earnings?.hoursWorked ?? '-' }}</span></div>
                  <div class="flex justify-between"><span>Hourly Rate</span><span>{{ formatCurrency(selectedPayslip?.earnings?.hourlyRate || 0) }}</span></div>
                  <div class="flex justify-between"><span>Commission</span><span>{{ formatCurrency(selectedPayslip?.earnings?.commission || 0) }}</span></div>
                  <div class="flex justify-between font-semibold text-white mt-2"><span>Total</span><span>{{ formatCurrency(selectedPayslip?.earnings?.total || 0) }}</span></div>
                </div>
                <div>
                  <div class="text-slate-400 text-xs uppercase mb-2">Deductions</div>
                  <div class="flex justify-between"><span>SSS</span><span>{{ formatCurrency(selectedPayslip?.deductions?.sss?.amount || 0) }}</span></div>
                  <div class="flex justify-between"><span>PhilHealth</span><span>{{ formatCurrency(selectedPayslip?.deductions?.philHealth?.amount || 0) }}</span></div>
                  <div class="flex justify-between"><span>Pag-IBIG</span><span>{{ formatCurrency(selectedPayslip?.deductions?.pagIbig?.amount || 0) }}</span></div>
                  <div class="flex justify-between"><span>Income Tax</span><span>{{ formatCurrency(selectedPayslip?.deductions?.incomeTax?.amount || 0) }}</span></div>
                  <div class="flex justify-between font-semibold text-white mt-2"><span>Total</span><span>{{ formatCurrency(selectedPayslip?.totalDeductions || 0) }}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4 border-t border-slate-700">
            <button
              class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-500 text-slate-200 hover:bg-slate-700/60"
              @click="printPayslip"
            >
              Print
            </button>
            <button
              class="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/90 text-slate-900 hover:bg-amber-500"
              @click="exportPayslipPdf"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getFirestore, collection, getDocs, addDoc, query, where, doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { logActivity } from '@/utils/activityLogger'
import { hasAnyAssignedShift } from '@/utils/employeeSchedules'

export default {
  name: 'PayrollAndPayslipManagement',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
    const db = getFirestore(getApp())

    const loading = ref(false)
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const isPayrollApproved = ref(false)
    const approvalMonthKey = computed(() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })
    const approvalMonthLabel = computed(() =>
      new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    )
    const summaryLoading = ref(false)
    const summaryStatus = ref('pending')
    const summaryUpdatedAt = ref(null)
    const summaryTotals = ref({
      totalEmployees: 0,
      totalPayroll: 0,
      totalNetPay: 0,
      totalDeductions: 0
    })
    const showSummaryDetails = ref(false)
    const summaryModalKey = ref('')
    const summaryModalLabel = ref('')
    const summaryModalApproved = ref(false)
    const payslipLoading = ref({})
    const payslips = ref([])
    const payslipsLoading = ref(false)
    const showPayslipModal = ref(false)
    const selectedPayslip = ref(null)
    const approvedSummaries = ref([])
    const approvedSummariesLoading = ref(false)

    const employees = ref([])
    const payrolls = ref([])

    const selectedEmployeeId = ref('')
    const hoursWorked = ref(0)
    const hourlyRate = ref(0)
    const loadingHours = ref(false)
    const commissionTotal = ref(0)
    const commissionCount = ref(0)
    const commissionRangeStart = ref('')
    const commissionRangeEnd = ref('')
    const loadingCommission = ref(false)
    const deductionSettings = ref({
      sssRate: 4.5,
      philHealthRate: 2.5,
      pagIbigRate: 2,
      incomeTaxRate: 10,
      useGraduatedIncomeTax: true
    })
    const savingSettings = ref(false)

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'code'
      }).format(Number(value) || 0)
    }

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-PH')
    }

    const summaryStatusLabel = computed(() => {
      const status = String(summaryStatus.value || 'pending').toLowerCase()
      if (status === 'approved') return 'Approved'
      if (status === 'rejected') return 'Rejected'
      return 'Pending'
    })

    const summaryStatusClass = computed(() => {
      const status = String(summaryStatus.value || 'pending').toLowerCase()
      if (status === 'approved') return 'bg-emerald-500/20 text-emerald-300'
      if (status === 'rejected') return 'bg-rose-500/20 text-rose-300'
      return 'bg-amber-500/20 text-amber-300'
    })

    const monthlyPayrollEntries = computed(() => {
      const monthKey = approvalMonthKey.value
      return payrolls.value.filter((entry) => {
        const dateValue = extractDate(entry.createdAt || entry.date)
        if (!dateValue) return false
        return getMonthKeyFromDate(dateValue) === monthKey
      })
    })
    const summaryModalEntries = computed(() => {
      const monthKey = summaryModalKey.value || approvalMonthKey.value
      return payrolls.value.filter((entry) => {
        const dateValue = extractDate(entry.createdAt || entry.date)
        if (!dateValue) return false
        return getMonthKeyFromDate(dateValue) === monthKey
      })
    })
    const openSummaryModalForMonth = (monthKey, label, approved) => {
      summaryModalKey.value = monthKey || approvalMonthKey.value
      summaryModalLabel.value = label || approvalMonthLabel.value
      summaryModalApproved.value = Boolean(approved)
      showSummaryDetails.value = true
    }
    const summaryTotalsRow = computed(() => {
      return summaryModalEntries.value.reduce((acc, entry) => {
        acc.totalPay += Number(entry.totalPay || 0)
        acc.totalDeductions += Number(entry.totalDeductions || 0)
        acc.netPay += Number(entry.netPay || 0)
        return acc
      }, { totalPay: 0, totalDeductions: 0, netPay: 0 })
    })

    const openPayslipModal = (slip) => {
      selectedPayslip.value = slip
      showPayslipModal.value = true
    }

    const buildPayslipHtml = () => {
      const slip = selectedPayslip.value
      if (!slip) return ''
      return `
        <html>
          <head>
            <title>Payslip</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
              h1 { margin: 0 0 8px; }
              .meta { margin-bottom: 16px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; }
              th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
              th { text-align: left; background: #f5f5f5; }
            </style>
          </head>
          <body>
            <h1>Payslip</h1>
            <div class="meta">
              <div><strong>Employee:</strong> ${slip.employeeName || '-'}</div>
              <div><strong>Pay Period:</strong> ${slip.payPeriod || '-'}</div>
              <div><strong>Generated:</strong> ${formatDate(slip.dateGenerated || slip.createdAt)}</div>
            </div>
            <div class="grid">
              <div>
                <h3>Earnings</h3>
                <table>
                  <tr><th>Hours Worked</th><td>${slip.earnings?.hoursWorked ?? '-'}</td></tr>
                  <tr><th>Hourly Rate</th><td>${formatCurrency(slip.earnings?.hourlyRate || 0)}</td></tr>
                  <tr><th>Commission</th><td>${formatCurrency(slip.earnings?.commission || 0)}</td></tr>
                  <tr><th>Total</th><td>${formatCurrency(slip.earnings?.total || 0)}</td></tr>
                </table>
              </div>
              <div>
                <h3>Deductions</h3>
                <table>
                  <tr><th>SSS</th><td>${formatCurrency(slip.deductions?.sss?.amount || 0)}</td></tr>
                  <tr><th>PhilHealth</th><td>${formatCurrency(slip.deductions?.philHealth?.amount || 0)}</td></tr>
                  <tr><th>Pag-IBIG</th><td>${formatCurrency(slip.deductions?.pagIbig?.amount || 0)}</td></tr>
                  <tr><th>Income Tax</th><td>${formatCurrency(slip.deductions?.incomeTax?.amount || 0)}</td></tr>
                  <tr><th>Total Deductions</th><td>${formatCurrency(slip.totalDeductions || 0)}</td></tr>
                </table>
              </div>
            </div>
            <h3>Summary</h3>
            <table>
              <tr><th>Total Earnings</th><td>${formatCurrency(slip.totalEarnings || 0)}</td></tr>
              <tr><th>Total Deductions</th><td>${formatCurrency(slip.totalDeductions || 0)}</td></tr>
              <tr><th>Net Pay</th><td>${formatCurrency(slip.netPay || 0)}</td></tr>
            </table>
          </body>
        </html>
      `
    }

    const printPayslip = () => {
      const html = buildPayslipHtml()
      if (!html) return
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }

    const escapePdfText = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

    const buildPayslipPdfBlob = () => {
      const slip = selectedPayslip.value
      if (!slip) return null

      const contentLines = []
      const left = 60
      let y = 760

      const addText = (text, x, yPos, size = 12) => {
        contentLines.push(`BT /F1 ${size} Tf ${x} ${yPos} Td (${escapePdfText(text)}) Tj ET`)
      }

      const drawLine = (x1, y1, x2, y2) => {
        contentLines.push(`${x1} ${y1} m ${x2} ${y2} l S`)
      }

      addText('Payslip', left, y, 16)
      y -= 24
      addText(`Employee: ${slip.employeeName || '-'}`, left, y, 11)
      y -= 16
      addText(`Pay Period: ${slip.payPeriod || '-'}`, left, y, 11)
      y -= 16
      addText(`Generated: ${formatDate(slip.dateGenerated || slip.createdAt)}`, left, y, 11)
      y -= 24

      // Earnings table
      addText('Earnings', left, y, 12)
      y -= 12
      const earningsTop = y
      const tableWidth = 480
      const colSplit = left + 260
      const rowHeight = 18
      const earningsRows = [
        ['Hours Worked', String(slip.earnings?.hoursWorked ?? '-')],
        ['Hourly Rate', formatCurrency(slip.earnings?.hourlyRate || 0)],
        ['Commission', formatCurrency(slip.earnings?.commission || 0)],
        ['Total Earnings', formatCurrency(slip.earnings?.total || 0)]
      ]
      const earningsHeight = (earningsRows.length + 1) * rowHeight
      drawLine(left, earningsTop, left + tableWidth, earningsTop)
      drawLine(left, earningsTop - earningsHeight, left + tableWidth, earningsTop - earningsHeight)
      drawLine(left, earningsTop, left, earningsTop - earningsHeight)
      drawLine(left + tableWidth, earningsTop, left + tableWidth, earningsTop - earningsHeight)
      drawLine(colSplit, earningsTop, colSplit, earningsTop - earningsHeight)
      addText('Item', left + 6, earningsTop - 13, 10)
      addText('Amount', colSplit + 6, earningsTop - 13, 10)
      let rowY = earningsTop - rowHeight
      earningsRows.forEach((row) => {
        drawLine(left, rowY, left + tableWidth, rowY)
        addText(row[0], left + 6, rowY - 13, 10)
        addText(row[1], colSplit + 6, rowY - 13, 10)
        rowY -= rowHeight
      })
      y = earningsTop - earningsHeight - 28

      // Deductions table
      addText('Deductions', left, y, 12)
      y -= 12
      const deductionsTop = y
      const deductionsRows = [
        ['SSS', formatCurrency(slip.deductions?.sss?.amount || 0)],
        ['PhilHealth', formatCurrency(slip.deductions?.philHealth?.amount || 0)],
        ['Pag-IBIG', formatCurrency(slip.deductions?.pagIbig?.amount || 0)],
        ['Income Tax', formatCurrency(slip.deductions?.incomeTax?.amount || 0)],
        ['Total Deductions', formatCurrency(slip.totalDeductions || 0)]
      ]
      const deductionsHeight = (deductionsRows.length + 1) * rowHeight
      drawLine(left, deductionsTop, left + tableWidth, deductionsTop)
      drawLine(left, deductionsTop - deductionsHeight, left + tableWidth, deductionsTop - deductionsHeight)
      drawLine(left, deductionsTop, left, deductionsTop - deductionsHeight)
      drawLine(left + tableWidth, deductionsTop, left + tableWidth, deductionsTop - deductionsHeight)
      drawLine(colSplit, deductionsTop, colSplit, deductionsTop - deductionsHeight)
      addText('Item', left + 6, deductionsTop - 13, 10)
      addText('Amount', colSplit + 6, deductionsTop - 13, 10)
      rowY = deductionsTop - rowHeight
      deductionsRows.forEach((row) => {
        drawLine(left, rowY, left + tableWidth, rowY)
        addText(row[0], left + 6, rowY - 13, 10)
        addText(row[1], colSplit + 6, rowY - 13, 10)
        rowY -= rowHeight
      })
      y = deductionsTop - deductionsHeight - 28

      // Summary table
      addText('Summary', left, y, 12)
      y -= 12
      const summaryTop = y
      const summaryRows = [
        ['Total Earnings', formatCurrency(slip.totalEarnings || 0)],
        ['Total Deductions', formatCurrency(slip.totalDeductions || 0)],
        ['Net Pay', formatCurrency(slip.netPay || 0)]
      ]
      const summaryHeight = (summaryRows.length + 1) * rowHeight
      drawLine(left, summaryTop, left + tableWidth, summaryTop)
      drawLine(left, summaryTop - summaryHeight, left + tableWidth, summaryTop - summaryHeight)
      drawLine(left, summaryTop, left, summaryTop - summaryHeight)
      drawLine(left + tableWidth, summaryTop, left + tableWidth, summaryTop - summaryHeight)
      drawLine(colSplit, summaryTop, colSplit, summaryTop - summaryHeight)
      addText('Item', left + 6, summaryTop - 13, 10)
      addText('Amount', colSplit + 6, summaryTop - 13, 10)
      rowY = summaryTop - rowHeight
      summaryRows.forEach((row) => {
        drawLine(left, rowY, left + tableWidth, rowY)
        addText(row[0], left + 6, rowY - 13, 10)
        addText(row[1], colSplit + 6, rowY - 13, 10)
        rowY -= rowHeight
      })

      const contentStream = contentLines.join('\n')

      const objects = []
      objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj')
      objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj')
      objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj')
      objects.push(`4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`)
      objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj')

      let pdf = '%PDF-1.4\n'
      const xrefOffsets = [0]
      objects.forEach((obj) => {
        xrefOffsets.push(pdf.length)
        pdf += `${obj}\n`
      })
      const xrefStart = pdf.length
      pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
      xrefOffsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
      })
      pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

      return new Blob([pdf], { type: 'application/pdf' })
    }

    const exportPayslipPdf = () => {
      const blob = buildPayslipPdfBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const filename = `${selectedPayslip.value?.employeeName || 'payslip'}-${approvalMonthLabel.value}.pdf`
      link.href = url
      link.download = filename.replace(/\s+/g, '_')
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    }

    const generatePayslipForEntry = async (entry) => {
      if (!entry?.employeeId || !isPayrollApproved.value) return
      payslipLoading.value = { ...payslipLoading.value, [entry.id]: true }
      try {
        const payload = {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName || '',
          jobTitle: entry.role || entry.jobTitle || entry.salaryType || 'Staff',
          employmentType: entry.employmentType || null,
          salaryType: entry.salaryType || 'Hourly',
          branchId: currentBranchId.value,
          payPeriod: approvalMonthLabel.value,
          earnings: {
            hoursWorked: Number(entry.hoursWorked || 0),
            hourlyRate: Number(entry.hourlyRate || 0),
            commission: Number(entry.commission || 0),
            total: Number(entry.totalPay || 0)
          },
          deductions: entry.deductions || {},
          totalEarnings: Number(entry.totalPay || 0),
          totalDeductions: Number(entry.totalDeductions || 0),
          netPay: Number(entry.netPay || 0),
          dateGenerated: serverTimestamp(),
          createdBy: currentUserId.value,
          payrollEntryId: entry.id
        }

        await addDoc(collection(db, 'users', entry.employeeId, 'payslips'), payload)
        await addDoc(collection(db, 'payslips'), payload)

        await logActivity(db, {
          module: 'HR',
          action: 'Generated payslip',
          details: `Generated payslip for ${entry.employeeName || 'staff'} (${approvalMonthLabel.value}).`,
          targetUserId: entry.employeeId,
          targetUserName: entry.employeeName || ''
        })

        toast.success('Payslip generated successfully.')
        await loadPayslips()
      } catch (error) {
        console.error('Failed to generate payslip:', error)
        toast.error('Failed to generate payslip.')
      } finally {
        payslipLoading.value = { ...payslipLoading.value, [entry.id]: false }
      }
    }

    const loadPayslips = async () => {
      if (!currentBranchId.value) {
        payslips.value = []
        return
      }
      payslipsLoading.value = true
      try {
        const slipsQuery = query(collection(db, 'payslips'), where('branchId', '==', currentBranchId.value))
        const snapshot = await getDocs(slipsQuery)
        payslips.value = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => {
            const aTime = a.dateGenerated?.seconds || 0
            const bTime = b.dateGenerated?.seconds || 0
            return bTime - aTime
          })
      } catch (error) {
        console.error('Failed to load payslips:', error)
        toast.error('Failed to load payslips.')
      } finally {
        payslipsLoading.value = false
      }
    }

    const loadApprovedSummaries = async () => {
      if (!currentBranchId.value) {
        approvedSummaries.value = []
        return
      }
      approvedSummariesLoading.value = true
      try {
        const snapshot = await getDocs(query(
          collection(db, 'payrollSummaries'),
          where('branchId', '==', currentBranchId.value),
          where('status', '==', 'approved')
        ))
        approvedSummaries.value = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => String(b.monthKey || '').localeCompare(String(a.monthKey || '')))
      } catch (error) {
        console.error('Failed to load approved summaries:', error)
        toast.error('Failed to load approved summaries.')
      } finally {
        approvedSummariesLoading.value = false
      }
    }

    const toDateInputValue = (date) => {
      if (!date) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const parseDateInput = (value) => {
      if (!value) return null
      const parsed = new Date(`${value}T00:00:00`)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const normalizeStatus = (value) => String(value || '').trim().toLowerCase()

    const parseClockToMinutes = (timeValue) => {
      if (!timeValue) return null
      const input = String(timeValue).trim().toUpperCase()
      if (!input) return null

      const hasMeridiem = input.includes('AM') || input.includes('PM')
      const clean = input.replace(/\s+/g, '')
      const meridiem = clean.endsWith('AM') ? 'AM' : clean.endsWith('PM') ? 'PM' : ''
      const timePart = meridiem ? clean.slice(0, -2) : clean
      const parts = timePart.split(':')
      if (parts.length < 2) return null

      let hours = Number(parts[0])
      const minutes = Number(parts[1])
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

      if (hasMeridiem) {
        if (hours === 12) hours = 0
        if (meridiem === 'PM') hours += 12
      }

      return hours * 60 + minutes
    }

    const roundToQuarterHour = (hours) => Math.round((Number(hours) || 0) * 4) / 4

    const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2))

    const computeIncomeTaxMonthly = (gross) => {
      const income = Number(gross) || 0
      if (income <= 20833) return 0
      if (income <= 33332) return (income - 20833) * 0.15
      if (income <= 66666) return 1875 + (income - 33333) * 0.2
      if (income <= 166666) return 8541.8 + (income - 66667) * 0.25
      if (income <= 666666) return 33541.8 + (income - 166667) * 0.3
      return 183541.8 + (income - 666667) * 0.35
    }

    const computeDeductions = (grossPay) => {
      const gross = Number(grossPay) || 0
      const sssRate = Number(deductionSettings.value.sssRate || 0)
      const philHealthRate = Number(deductionSettings.value.philHealthRate || 0)
      const pagIbigRate = Number(deductionSettings.value.pagIbigRate || 0)
      const incomeTaxRate = Number(deductionSettings.value.incomeTaxRate || 0)
      const useGraduated = Boolean(deductionSettings.value.useGraduatedIncomeTax)

      const sss = gross * (sssRate / 100)
      const philHealth = gross * (philHealthRate / 100)
      const pagIbigRaw = gross * (pagIbigRate / 100)
      const pagIbig = Math.min(pagIbigRaw, 200)
      const incomeTax = useGraduated ? computeIncomeTaxMonthly(gross) : gross * (incomeTaxRate / 100)

      const incomeTaxRateEffective = gross > 0 ? (incomeTax / gross) * 100 : 0

      return {
        sss: { amount: roundCurrency(sss), rate: roundCurrency(sssRate) },
        philHealth: { amount: roundCurrency(philHealth), rate: roundCurrency(philHealthRate) },
        pagIbig: { amount: roundCurrency(pagIbig), rate: roundCurrency(pagIbigRate), capped: pagIbigRaw > 200 },
        incomeTax: {
          amount: roundCurrency(incomeTax),
          rate: roundCurrency(useGraduated ? incomeTaxRateEffective : incomeTaxRate),
          mode: useGraduated ? 'graduated' : 'flat'
        }
      }
    }

    const loadPayrollSettings = async () => {
      if (!currentBranchId.value) return
      const settingsSnap = await getDoc(doc(db, 'payrollSettings', currentBranchId.value))
      if (!settingsSnap.exists()) return
      const data = settingsSnap.data() || {}
      deductionSettings.value = {
        sssRate: Number(data.sssRate ?? deductionSettings.value.sssRate),
        philHealthRate: Number(data.philHealthRate ?? deductionSettings.value.philHealthRate),
        pagIbigRate: Number(data.pagIbigRate ?? deductionSettings.value.pagIbigRate),
        incomeTaxRate: Number(data.incomeTaxRate ?? deductionSettings.value.incomeTaxRate),
        useGraduatedIncomeTax: data.useGraduatedIncomeTax !== undefined
          ? Boolean(data.useGraduatedIncomeTax)
          : deductionSettings.value.useGraduatedIncomeTax
      }
    }

    const savePayrollSettings = async () => {
      if (!currentBranchId.value) return
      savingSettings.value = true
      try {
        await addDoc(collection(db, 'payrollSettingsAudit'), {
          branchId: currentBranchId.value,
          ...deductionSettings.value,
          updatedBy: currentUserId.value,
          updatedAt: serverTimestamp()
        })
        await setDoc(
          doc(db, 'payrollSettings', currentBranchId.value),
          {
            branchId: currentBranchId.value,
            ...deductionSettings.value,
            updatedBy: currentUserId.value,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )
        toast.success('Payroll deduction settings updated.')
      } catch (error) {
        console.error('Failed to save payroll settings:', error)
        toast.error('Failed to save payroll settings.')
      } finally {
        savingSettings.value = false
      }
    }

    const isDateInMonth = (dateValue, monthKey) => {
      if (!monthKey) return true
      if (!dateValue) return false
      if (typeof dateValue === 'string') {
        return dateValue.startsWith(monthKey)
      }
      if (dateValue?.toDate) return isDateInMonth(dateValue.toDate(), monthKey)
      if (dateValue?.seconds) return isDateInMonth(new Date(dateValue.seconds * 1000), monthKey)
      const parsed = new Date(dateValue)
      if (Number.isNaN(parsed.getTime())) return false
      return getMonthKeyFromDate(parsed) === monthKey
    }

    const computeWorkedHoursFromAttendance = async (employeeId, monthKey = '') => {
      if (!employeeId || !currentBranchId.value) return 0

      let docs = []
      try {
        const byBranchAndEmployee = query(
          collection(db, 'attendance'),
          where('branchId', '==', currentBranchId.value),
          where('employeeId', '==', employeeId)
        )
        const snapshot = await getDocs(byBranchAndEmployee)
        docs = snapshot.docs
      } catch (_error) {
        const byBranch = query(collection(db, 'attendance'), where('branchId', '==', currentBranchId.value))
        const snapshot = await getDocs(byBranch)
        docs = snapshot.docs.filter((snap) => (snap.data()?.employeeId || '') === employeeId)
      }

      const totalMinutes = docs.reduce((sum, snap) => {
        const data = snap.data() || {}
        if (monthKey && !isDateInMonth(data.date || data.createdAt || data.updatedAt, monthKey)) {
          return sum
        }
        const inMinutes = parseClockToMinutes(data.timeIn)
        const outMinutes = parseClockToMinutes(data.timeOut)
        if (inMinutes === null || outMinutes === null) return sum

        let duration = outMinutes - inMinutes
        if (duration < 0) duration += 24 * 60
        return sum + Math.max(duration, 0)
      }, 0)

      return roundToQuarterHour(totalMinutes / 60)
    }

    const resetForm = () => {
      selectedEmployeeId.value = ''
      hoursWorked.value = 0
      hourlyRate.value = 0
      commissionTotal.value = 0
      commissionCount.value = 0
    }

    const loadEmployees = async () => {
      if (!currentBranchId.value) {
        employees.value = []
        return
      }

      const staffQuery = query(
        collection(db, 'users'),
        where('branchId', '==', currentBranchId.value),
        where('userType', '==', 'Staff')
      )

      const snapshot = await getDocs(staffQuery)
      const candidates = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((emp) => emp.id !== currentUserId.value && !emp.archived)
        .map((emp) => ({
          id: emp.id,
          fullName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          role: String(emp.customRoleName || emp.role || 'Staff').trim(),
          isCommissionBased: emp.role === 'Practitioner',
          basePay: Number(emp.basePay || 0),
          employmentType: emp.employmentType || ''
        }))

      const withShiftAssignments = await Promise.all(
        candidates.map(async (emp) => {
          const scheduleSnap = await getDocs(collection(db, 'users', emp.id, 'schedules'))
          const hasAssignedShift = hasAnyAssignedShift(
            scheduleSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() || {} }))
          )
          return hasAssignedShift ? emp : null
        })
      )

      employees.value = withShiftAssignments.filter(Boolean)
      if (selectedEmployeeId.value && !employees.value.some((emp) => emp.id === selectedEmployeeId.value)) {
        selectedEmployeeId.value = ''
      }
    }

    const loadPayrolls = async () => {
      if (!currentBranchId.value) {
        payrolls.value = []
        return
      }

      const payrollQuery = query(collection(db, 'payrolls'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(payrollQuery)

      payrolls.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })
    }

    const getMonthKeyFromDate = (date) => {
      if (!date) return ''
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    }

    const extractDate = (value) => {
      if (!value) return null
      if (value?.toDate) return value.toDate()
      if (value?.seconds) return new Date(value.seconds * 1000)
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const generateMonthlySummary = async () => {
      if (!currentBranchId.value) return
      summaryLoading.value = true
      try {
        const monthKey = approvalMonthKey.value
        const monthLabel = approvalMonthLabel.value
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
        monthEnd.setHours(23, 59, 59, 999)

        const existingMonthPayrolls = payrolls.value.filter((entry) => {
          const dateValue = extractDate(entry.createdAt || entry.date)
          if (!dateValue) return false
          return getMonthKeyFromDate(dateValue) === monthKey
        })

        const existingByEmployee = new Set(
          existingMonthPayrolls.map((entry) => String(entry.employeeId || '').trim()).filter(Boolean)
        )

        const autoCreatedIds = []
        for (const employee of employees.value) {
          if (!employee?.id) continue
          if (existingByEmployee.has(employee.id)) continue

          const employeeHours = await computeWorkedHoursFromAttendance(employee.id, monthKey)
          if (!employeeHours || employeeHours <= 0) continue

          const basePay = Number(employee.basePay || 0)
          if (basePay <= 0) continue

          let commissionAmount = 0
          if (employee.isCommissionBased) {
            const commissionResult = await computeCommissionForEmployee(employee.id, monthStart, monthEnd)
            commissionAmount = Number(commissionResult.total || 0)
          }

          const totalPay = Number(employeeHours || 0) * basePay + commissionAmount
          const deductions = computeDeductions(totalPay)
          const totalDeductions = roundCurrency(
            Object.values(deductions).reduce((sum, entry) => sum + Number(entry?.amount || 0), 0)
          )
          const netPay = roundCurrency(totalPay - totalDeductions)

          const salaryType = employee.isCommissionBased ? 'Hourly + Commission' : 'Hourly'
          const payrollDoc = await addDoc(collection(db, 'payrolls'), {
            employeeId: employee.id,
            employeeName: employee.fullName,
            branchId: currentBranchId.value,
            employmentType: employee.employmentType || null,
            salaryType,
            hoursWorked: Number(employeeHours || 0),
            hourlyRate: Number(basePay || 0),
            commission: commissionAmount,
            totalPay,
            deductions,
            totalDeductions,
            netPay,
            payPeriodMonthKey: monthKey,
            payPeriodStart: monthStart,
            payPeriodEnd: monthEnd,
            createdBy: currentUserId.value,
            createdAt: serverTimestamp()
          })
          autoCreatedIds.push(payrollDoc.id)
        }

        if (autoCreatedIds.length) {
          await loadPayrolls()
        }

        const monthPayrolls = payrolls.value.filter((entry) => {
          const dateValue = extractDate(entry.createdAt || entry.date)
          if (!dateValue) return false
          return getMonthKeyFromDate(dateValue) === monthKey
        })

        if (monthPayrolls.length === 0) {
          toast.error('No payroll records found for the current month.')
          return
        }

        const employeeIds = new Set()
        let totalPayroll = 0
        let totalNetPay = 0
        let totalDeductions = 0

        monthPayrolls.forEach((entry) => {
          if (entry.employeeId) employeeIds.add(entry.employeeId)
          totalPayroll += Number(entry.totalPay || 0)
          totalNetPay += Number(entry.netPay || 0)
          totalDeductions += Number(entry.totalDeductions || 0)
        })

        const summaryDocId = `${currentBranchId.value}_${monthKey}`
        await setDoc(
          doc(db, 'payrollSummaries', summaryDocId),
          {
            branchId: currentBranchId.value,
            monthKey,
            monthLabel,
            totalEmployees: employeeIds.size,
            totalEntries: monthPayrolls.length,
            totalPayroll: Number(totalPayroll.toFixed(2)),
            totalNetPay: Number(totalNetPay.toFixed(2)),
            totalDeductions: Number(totalDeductions.toFixed(2)),
            status: 'pending',
            approvedBy: null,
            approvedByName: null,
            approvedAt: null,
            updatedBy: currentUserId.value,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )

        const autoCreatedMessage = autoCreatedIds.length
          ? `Auto-generated ${autoCreatedIds.length} payroll entr${autoCreatedIds.length === 1 ? 'y' : 'ies'}. `
          : ''
        toast.success(`${autoCreatedMessage}Monthly payroll summary generated and sent for approval.`)
      } catch (error) {
        console.error('Failed to generate monthly summary:', error)
        toast.error('Failed to generate payroll summary.')
      } finally {
        summaryLoading.value = false
      }
    }

    const selectedEmployeeIsPractitioner = computed(() => {
      const emp = employees.value.find((e) => e.id === selectedEmployeeId.value)
      return Boolean(emp?.isCommissionBased)
    })

    const setCommissionRange = (preset) => {
      const today = new Date()
      if (preset === 'today') {
        commissionRangeStart.value = toDateInputValue(today)
        commissionRangeEnd.value = toDateInputValue(today)
        return
      }

      if (preset === 'week') {
        const day = today.getDay()
        const diffToMonday = (day + 6) % 7
        const start = new Date(today)
        start.setDate(today.getDate() - diffToMonday)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        commissionRangeStart.value = toDateInputValue(start)
        commissionRangeEnd.value = toDateInputValue(end)
        return
      }

      if (preset === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        commissionRangeStart.value = toDateInputValue(start)
        commissionRangeEnd.value = toDateInputValue(end)
      }
    }

    const extractAppointmentDate = (appointment) => {
      const dateValue = appointment?.date
      if (dateValue) {
        const parsed = new Date(`${dateValue}T00:00:00`)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }

      const candidates = [appointment?.completedAt, appointment?.paidAt, appointment?.updatedAt, appointment?.createdAt]
      for (const value of candidates) {
        if (!value) continue
        if (value?.toDate) return value.toDate()
        if (value?.seconds) return new Date(value.seconds * 1000)
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
      return null
    }

    const getAppointmentAmount = (appointment, transactionMap) => {
      const candidates = [
        appointment?.amountPaid,
        appointment?.amount,
        appointment?.price,
        appointment?.fee,
        appointment?.serviceFee
      ]
      for (const value of candidates) {
        const numeric = Number(value)
        if (Number.isFinite(numeric) && numeric > 0) return numeric
      }

      const txAmount = transactionMap?.get(appointment?.id)
      if (Number.isFinite(txAmount) && txAmount > 0) return txAmount
      return 0
    }

    const buildTransactionMap = async (appointmentIds) => {
      if (!appointmentIds.length || !currentBranchId.value) return new Map()
      try {
        const txQuery = query(
          collection(db, 'transactions'),
          where('branchId', '==', currentBranchId.value),
          where('type', '==', 'appointment_payment')
        )
        const snapshot = await getDocs(txQuery)
        const map = new Map()
        snapshot.docs.forEach((snap) => {
          const data = snap.data() || {}
          if (!appointmentIds.includes(data.appointmentId)) return
          if (String(data.status || '').toLowerCase() !== 'paid') return
          const amount = Number(data.amount || 0)
          if (!Number.isFinite(amount) || amount <= 0) return
          const existing = map.get(data.appointmentId) || 0
          map.set(data.appointmentId, existing + amount)
        })
        return map
      } catch (error) {
        console.error('Failed to load appointment transactions:', error)
        return new Map()
      }
    }

    const computeCommissionForEmployee = async (employeeId, start, end) => {
      if (!employeeId || !currentBranchId.value) {
        return { total: 0, count: 0 }
      }

      try {
        const appointmentSnapshot = await getDocs(
          query(collection(db, 'appointments'), where('branchId', '==', currentBranchId.value))
        )
        const appointments = appointmentSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))

        const filtered = appointments.filter((appointment) => {
          const practitionerId = appointment.assignedPractitionerId || appointment.practitionerId || ''
          if (practitionerId !== employeeId) return false
          if (normalizeStatus(appointment.status) !== 'completed') return false

          const dateValue = extractAppointmentDate(appointment)
          if (!dateValue) return false
          const time = dateValue.getTime()
          return time >= start.getTime() && time <= end.getTime()
        })

        const missingAmountIds = filtered
          .filter((appointment) => Number(appointment.amountPaid || appointment.amount || appointment.price || 0) <= 0)
          .map((appointment) => appointment.id)

        const transactionMap = await buildTransactionMap(missingAmountIds)

        const total = filtered.reduce((sum, appointment) => {
          return sum + getAppointmentAmount(appointment, transactionMap)
        }, 0)

        return { total: Number(total.toFixed(2)), count: filtered.length }
      } catch (error) {
        console.error('Failed to compute commission:', error)
        return { total: 0, count: 0 }
      }
    }

    const computeCommissionFromAppointments = async (employeeId) => {
      if (!employeeId || !currentBranchId.value) {
        commissionTotal.value = 0
        commissionCount.value = 0
        return
      }

      const start = parseDateInput(commissionRangeStart.value)
      const end = parseDateInput(commissionRangeEnd.value)
      if (!start || !end) {
        commissionTotal.value = 0
        commissionCount.value = 0
        return
      }

      loadingCommission.value = true
      try {
        const result = await computeCommissionForEmployee(employeeId, start, end)
        commissionTotal.value = result.total
        commissionCount.value = result.count
      } catch (error) {
        console.error('Failed to compute commission:', error)
        toast.error('Failed to compute commission from appointments.')
        commissionTotal.value = 0
        commissionCount.value = 0
      } finally {
        loadingCommission.value = false
      }
    }

    watch(
      selectedEmployeeId,
      async (employeeId) => {
        if (!employeeId) {
          hoursWorked.value = 0
          return
        }

        const selectedEmployee = employees.value.find((emp) => emp.id === employeeId)
        hourlyRate.value = Number(selectedEmployee?.basePay || 0)
        loadingHours.value = true
        try {
          hoursWorked.value = await computeWorkedHoursFromAttendance(employeeId)
        } catch (error) {
          console.error('Error computing attendance hours:', error)
          toast.error('Failed to auto-compute hours from attendance.')
          hoursWorked.value = 0
        } finally {
          loadingHours.value = false
        }

        if (selectedEmployee?.isCommissionBased) {
          if (!commissionRangeStart.value || !commissionRangeEnd.value) {
            setCommissionRange('month')
          }
          await computeCommissionFromAppointments(employeeId)
        } else {
          commissionTotal.value = 0
          commissionCount.value = 0
        }
      }
    )

    watch([commissionRangeStart, commissionRangeEnd], async () => {
      if (!selectedEmployeeId.value) return
      if (!selectedEmployeeIsPractitioner.value) return
      await computeCommissionFromAppointments(selectedEmployeeId.value)
    })

    const savePayrollAndPayslip = async () => {
      if (!selectedEmployeeId.value) {
        toast.error('Please select an employee.')
        return
      }

      const employee = employees.value.find((e) => e.id === selectedEmployeeId.value)
      if (!employee) {
        toast.error('Selected employee is invalid.')
        return
      }

      let totalPay = 0
      const salaryType = employee.isCommissionBased ? 'Hourly + Commission' : 'Hourly'

      if (hourlyRate.value <= 0) {
        toast.error('Hourly rate must be greater than 0.')
        return
      }

      if (hoursWorked.value <= 0) {
        toast.error('No completed attendance hours found for this employee.')
        return
      }

      if (employee.isCommissionBased) {
        const start = parseDateInput(commissionRangeStart.value)
        const end = parseDateInput(commissionRangeEnd.value)
        if (!start || !end) {
          toast.error('Please select a valid commission period.')
          return
        }
      }

      const basePayTotal = Number(hoursWorked.value || 0) * Number(hourlyRate.value || 0)
      const commissionAmount = employee.isCommissionBased ? Number(commissionTotal.value || 0) : 0
      totalPay = basePayTotal + commissionAmount
      const deductions = computeDeductions(totalPay)
      const totalDeductions = roundCurrency(
        Object.values(deductions).reduce((sum, entry) => sum + Number(entry?.amount || 0), 0)
      )
      const netPay = roundCurrency(totalPay - totalDeductions)

      loading.value = true
      try {
        await addDoc(collection(db, 'payrolls'), {
          employeeId: employee.id,
          employeeName: employee.fullName,
          branchId: currentBranchId.value,
          employmentType: employee.employmentType || null,
          salaryType,
          hoursWorked: Number(hoursWorked.value || 0),
          hourlyRate: Number(hourlyRate.value || 0),
          commission: commissionAmount,
          totalPay,
          deductions,
          totalDeductions,
          netPay,
          createdBy: currentUserId.value,
          createdAt: serverTimestamp()
        })

        await addDoc(collection(db, 'users', employee.id, 'payslips'), {
          employeeId: employee.id,
          employeeName: employee.fullName,
          jobTitle: employee.role,
          employmentType: employee.employmentType || null,
          salaryType,
          branchId: currentBranchId.value,
          payPeriod: new Date().toLocaleDateString('en-PH'),
          earnings: {
            hoursWorked: Number(hoursWorked.value || 0),
            hourlyRate: Number(hourlyRate.value || 0),
            commission: commissionAmount,
            total: totalPay
          },
          deductions,
          totalEarnings: totalPay,
          totalDeductions,
          netPay,
          dateGenerated: serverTimestamp(),
          createdBy: currentUserId.value
        })

        await logActivity(db, {
          module: 'HR',
          action: 'Generated payroll',
          details: `Generated ${salaryType.toLowerCase()} payroll for ${employee.fullName} (${formatCurrency(totalPay)}).`,
          targetUserId: employee.id,
          targetUserName: employee.fullName
        })

        toast.success('Payroll and payslip saved successfully.')
        resetForm()
        await loadPayrolls()
      } catch (error) {
        console.error('Error saving payroll/payslip:', error)
        toast.error('Failed to save payroll and payslip.')
      } finally {
        loading.value = false
      }
    }

    let unsubscribeAuth = null
    let unsubscribeApproval = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          employees.value = []
          payrolls.value = []
          return
        }

        currentUserId.value = user.uid
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userDoc.exists() ? (userDoc.data().branchId || '') : ''

        if (!currentBranchId.value) {
          employees.value = []
          payrolls.value = []
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadEmployees()
        await loadPayrolls()
        await loadPayrollSettings()
        await loadPayslips()
        await loadApprovedSummaries()

        if (currentBranchId.value) {
          if (unsubscribeApproval) unsubscribeApproval()
          const summaryId = `${currentBranchId.value}_${approvalMonthKey.value}`
          unsubscribeApproval = onSnapshot(doc(db, 'payrollSummaries', summaryId), (snap) => {
            if (!snap.exists()) {
              isPayrollApproved.value = false
              summaryStatus.value = 'pending'
              summaryUpdatedAt.value = null
              summaryTotals.value = {
                totalEmployees: 0,
                totalPayroll: 0,
                totalNetPay: 0,
                totalDeductions: 0
              }
              return
            }
            const data = snap.data() || {}
            summaryStatus.value = data.status || 'pending'
            summaryUpdatedAt.value = data.updatedAt || data.createdAt || null
            summaryTotals.value = {
              totalEmployees: Number(data.totalEmployees || 0),
              totalPayroll: Number(data.totalPayroll || 0),
              totalNetPay: Number(data.totalNetPay || 0),
              totalDeductions: Number(data.totalDeductions || 0)
            }
            isPayrollApproved.value = String(data.status || '').toLowerCase() === 'approved'
          })
        }
      })
    })

    watch(currentBranchId, (branchId) => {
      if (!branchId) return
      if (unsubscribeApproval) unsubscribeApproval()
      const summaryId = `${branchId}_${approvalMonthKey.value}`
      unsubscribeApproval = onSnapshot(doc(db, 'payrollSummaries', summaryId), (snap) => {
        if (!snap.exists()) {
          isPayrollApproved.value = false
          summaryStatus.value = 'pending'
          summaryUpdatedAt.value = null
          summaryTotals.value = {
            totalEmployees: 0,
            totalPayroll: 0,
            totalNetPay: 0,
            totalDeductions: 0
          }
          return
        }
        const data = snap.data() || {}
        summaryStatus.value = data.status || 'pending'
        summaryUpdatedAt.value = data.updatedAt || data.createdAt || null
        summaryTotals.value = {
          totalEmployees: Number(data.totalEmployees || 0),
          totalPayroll: Number(data.totalPayroll || 0),
          totalNetPay: Number(data.totalNetPay || 0),
          totalDeductions: Number(data.totalDeductions || 0)
        }
        isPayrollApproved.value = String(data.status || '').toLowerCase() === 'approved'
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (unsubscribeApproval) unsubscribeApproval()
    })

    return {
      loading,
      employees,
      payrolls,
      selectedEmployeeId,
      hoursWorked,
      hourlyRate,
      loadingHours,
      commissionTotal,
      commissionCount,
      commissionRangeStart,
      commissionRangeEnd,
      loadingCommission,
      deductionSettings,
      savingSettings,
      selectedEmployeeIsPractitioner,
      setCommissionRange,
      savePayrollAndPayslip,
      savePayrollSettings,
      resetForm,
      formatCurrency,
      formatDate,
      isPayrollApproved,
      approvalMonthLabel,
      summaryLoading,
      summaryStatusLabel,
      summaryStatusClass,
      summaryTotals,
      summaryUpdatedAt,
      generateMonthlySummary,
      showSummaryDetails,
      monthlyPayrollEntries,
      summaryTotalsRow,
      summaryModalEntries,
      openSummaryModalForMonth,
      summaryModalLabel,
      summaryModalApproved,
      generatePayslipForEntry,
      payslipLoading,
      payslips,
      payslipsLoading,
      showPayslipModal,
      selectedPayslip,
      openPayslipModal,
      printPayslip,
      exportPayslipPdf,
      approvedSummaries,
      approvedSummariesLoading
    }
  }
}
</script>


