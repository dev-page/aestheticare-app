<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Payslip Generation</h1>
        <p class="text-slate-400 text-sm md:text-base">View the latest payslip of employees in your branch.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <label class="block text-slate-400 mb-1">Employee</label>
        <select
          v-model="selectedStaffId"
          @change="loadPayslip"
          class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>Select employee in your branch</option>
          <option v-for="staff in staffList" :key="staff.id" :value="staff.id">
            {{ staff.fullName }} - {{ staff.role }}
          </option>
        </select>
      </div>

      <div v-if="loading" class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <PageSectionSkeleton variant="detail" />
      </div>

      <div v-else-if="payslip" class="payslip-print bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 text-white">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h2 class="text-xl font-semibold">{{ payslip.employeeName || '-' }}</h2>
            <p class="text-slate-400 text-sm">{{ payslip.jobTitle || '-' }}</p>
          </div>
          <div class="text-slate-300 text-sm sm:text-right">
            <p><span class="text-slate-400">Date Generated:</span> {{ formatDate(payslip.dateGenerated) }}</p>
            <p><span class="text-slate-400">Pay Period:</span> {{ payslip.payPeriod || '-' }}</p>
            <p><span class="text-slate-400">Salary Type:</span> {{ payslip.salaryType || '-' }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 class="font-semibold text-white mb-3">Earnings</h3>
            <div v-if="hasEntries(payslip.earnings)" class="space-y-2 text-sm">
              <div v-for="(val, key) in payslip.earnings" :key="key" class="flex items-center justify-between gap-3">
                <span class="text-slate-300 capitalize">{{ humanizeKey(key) }}</span>
                <span class="text-white">{{ formatCurrency(val) }}</span>
              </div>
            </div>
            <p v-else class="text-slate-400 text-sm">No earnings entries.</p>
          </div>

          <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 class="font-semibold text-white mb-3">Deductions</h3>
            <div v-if="hasEntries(payslip.deductions)" class="space-y-2 text-sm">
              <div v-for="(val, key) in payslip.deductions" :key="key" class="flex items-center justify-between gap-3">
                <span class="text-slate-300 capitalize">
                  {{ formatDeductionLabel(key, val) }}
                </span>
                <span class="text-white">{{ formatCurrency(getDeductionAmount(val)) }}</span>
              </div>
            </div>
            <p v-else class="text-slate-400 text-sm">No deductions entries.</p>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-slate-400">Total Earnings</p>
            <p class="text-white font-semibold">{{ formatCurrency(payslip.totalEarnings) }}</p>
          </div>
          <div>
            <p class="text-slate-400">Total Deductions</p>
            <p class="text-white font-semibold">{{ formatCurrency(payslip.totalDeductions) }}</p>
          </div>
          <div>
            <p class="text-slate-400">Net Pay</p>
            <p class="text-green-400 text-lg font-bold">{{ formatCurrency(payslip.netPay) }}</p>
          </div>
        </div>

        <div class="mt-5 text-right print:hidden">
          <button @click="printPayslip" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
            Print Payslip
          </button>
        </div>
      </div>

      <div v-else class="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center text-slate-400">
        Select an employee to view a payslip.
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, orderBy, where, doc, getDoc, limit } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { auth } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { toast } from 'vue3-toastify'
import { hasAnyAssignedShift } from '@/utils/employeeSchedules'

export default {
  name: 'PayslipGeneration',
  components: { OwnerSidebar, PageSectionSkeleton },
  setup() {
    const db = getFirestore(getApp())

    const loading = ref(false)
    const currentUserId = ref('')
    const currentBranchId = ref('')

    const staffList = ref([])
    const selectedStaffId = ref('')
    const payslip = ref(null)

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

    const hasEntries = (obj) => {
      return obj && typeof obj === 'object' && Object.keys(obj).length > 0
    }

    const getDeductionAmount = (value) => {
      if (value && typeof value === 'object') {
        return Number(value.amount || 0)
      }
      return Number(value || 0)
    }

    const getDeductionRate = (value) => {
      if (!value || typeof value !== 'object') return null
      const rate = Number(value.rate)
      return Number.isFinite(rate) ? rate : null
    }

    const humanizeKey = (key) => {
      const normalized = String(key || '').trim().toLowerCase()
      const labelMap = {
        sss: 'SSS',
        philhealth: 'PhilHealth',
        pagibig: 'Pag-IBIG',
        incometax: 'Income Tax',
        income_tax: 'Income Tax',
        pag_ibig: 'Pag-IBIG'
      }
      if (labelMap[normalized]) return labelMap[normalized]

      return String(key || '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .replace(/^./, (char) => char.toUpperCase())
        .trim()
    }

    const formatDeductionLabel = (key, value) => {
      const baseLabel = humanizeKey(key)
      const rate = getDeductionRate(value)
      const mode = value && typeof value === 'object' ? String(value.mode || '').toLowerCase() : ''
      const suffixParts = []
      if (mode === 'graduated') {
        suffixParts.push('graduated')
      }
      if (rate !== null) {
        suffixParts.push(`${rate}%`)
      }
      if (!suffixParts.length) return baseLabel
      return `${baseLabel} (${suffixParts.join(', ')})`
    }

    const loadStaff = async () => {
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
      const candidates = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((staff) => staff.id !== currentUserId.value && !staff.archived)
        .map((staff) => ({
          id: staff.id,
          fullName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
          role: String(staff.customRoleName || staff.role || 'Staff').trim()
        }))

      const withShiftAssignments = await Promise.all(
        candidates.map(async (staff) => {
          const scheduleSnap = await getDocs(collection(db, 'users', staff.id, 'schedules'))
          const hasAssignedShift = hasAnyAssignedShift(
            scheduleSnap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() || {} }))
          )
          return hasAssignedShift ? staff : null
        })
      )

      staffList.value = withShiftAssignments.filter(Boolean)
      if (selectedStaffId.value && !staffList.value.some((staff) => staff.id === selectedStaffId.value)) {
        selectedStaffId.value = ''
        payslip.value = null
      }
    }

    const loadPayslip = async () => {
      if (!selectedStaffId.value) {
        payslip.value = null
        return
      }

      loading.value = true
      try {
        const payslipQuery = query(
          collection(db, 'users', selectedStaffId.value, 'payslips'),
          orderBy('dateGenerated', 'desc'),
          limit(1)
        )

        const snapshot = await getDocs(payslipQuery)
        payslip.value = snapshot.empty ? null : snapshot.docs[0].data()
      } catch (error) {
        console.error('Error loading payslip:', error)
        toast.error('Failed to load payslip.')
        payslip.value = null
      } finally {
        loading.value = false
      }
    }

    const printPayslip = () => window.print()

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          staffList.value = []
          selectedStaffId.value = ''
          payslip.value = null
          return
        }

        currentUserId.value = user.uid
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userDoc.exists() ? (userDoc.data().branchId || '') : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          staffList.value = []
          return
        }

        await loadStaff()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      loading,
      staffList,
      selectedStaffId,
      payslip,
      formatCurrency,
      formatDate,
      hasEntries,
      humanizeKey,
      getDeductionAmount,
      formatDeductionLabel,
      loadPayslip,
      printPayslip
    }
  }
}
</script>

<style>
@media print {
  body {
    background: white !important;
  }
  body * {
    visibility: hidden;
  }
  .payslip-print,
  .payslip-print * {
    visibility: visible;
  }
  .payslip-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    background: white !important;
    color: #000 !important;
    border: none !important;
    box-shadow: none !important;
  }
  .payslip-print .text-slate-400,
  .payslip-print .text-slate-300,
  .payslip-print .text-white {
    color: #000 !important;
  }
  .payslip-print .bg-slate-900\/50,
  .payslip-print .bg-slate-800 {
    background: transparent !important;
    border-color: #ddd !important;
  }
}
</style>

