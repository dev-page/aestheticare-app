<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'BasePay',
  props: { embedded: { type: Boolean, default: false } },
  components: { OwnerSidebar, PageSectionSkeleton, ContractAppearanceSelect },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const currentUserId = ref('')
    const currentBranchId = ref('')
    const staffList = ref([])
    const loading = ref(false)
    const savingId = ref('')
    const basePayErrors = ref({})
    const editingStaff = ref(null)
    const basePayRateInput = ref(null)
    let lastEditButton = null

    const loadStaff = trackPageLoad(async () => {
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
          .filter((staff) => !staff.archived && staff.engagementType !== 'student_intern')
          .map((staff) => ({
            id: staff.id,
            fullName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'Unnamed',
            role: String(staff.customRoleName || staff.role || 'Staff').trim(),
            basePayModel: staff.basePayModel || 'hourly',
            monthlyBaseHours: Number(staff.monthlyBaseHours || 176),
            basePay: staff.basePay == null || staff.basePay === '' ? '' : Number(staff.basePay),
          }))
      } catch (error) {
        console.error('Failed to load staff for base pay:', error)
        toast.error('Failed to load base pay records.')
      } finally {
        loading.value = false
      }
    })

    const saveBasePay = async (staff) => {
      if (!staff) return false
      const rawValue = String(staff.basePay ?? '').trim()
      const hasBasePay = Boolean(rawValue)
      const basePayValue = Number(rawValue)
      let validationMessage = ''
      if (!['hourly', 'daily', 'monthly-retainer'].includes(staff.basePayModel) || !Number.isFinite(Number(staff.monthlyBaseHours)) || staff.monthlyBaseHours < 1 || staff.monthlyBaseHours > 744) {
        validationMessage = 'Choose a valid pay model and monthly hour divisor.'
      } else if (!hasBasePay) {
        validationMessage = 'Enter a base pay rate before saving.'
      } else if (hasBasePay && !Number.isFinite(basePayValue)) {
        validationMessage = 'Base pay must be a valid number.'
      } else if (hasBasePay && basePayValue <= 0) {
        validationMessage = 'Base pay must be greater than PHP 0.00.'
      } else if (hasBasePay && basePayValue > 1000000) {
        validationMessage = 'Base pay cannot exceed PHP 1,000,000.00 for this pay model.'
      } else if (hasBasePay && !/^\d+(\.\d{1,2})?$/.test(rawValue)) {
        validationMessage = 'Base pay may contain up to two decimal places.'
      }
      if (validationMessage) {
        basePayErrors.value = { ...basePayErrors.value, [staff.id]: validationMessage }
        toast.error(validationMessage)
        return false
      }
      const nextErrors = { ...basePayErrors.value }
      delete nextErrors[staff.id]
      basePayErrors.value = nextErrors
      savingId.value = staff.id
      try {
        const updates = {
          basePay: Number(basePayValue.toFixed(2)),
          basePayModel: staff.basePayModel,
          monthlyBaseHours: Number(staff.monthlyBaseHours || 176),
        }
        await updateDoc(doc(db, 'users', staff.id), updates)

        await logActivity(db, {
          module: 'HR',
          action: 'Updated base pay',
          details: `Updated base pay for ${staff.fullName} (${staff.role}).`,
          targetUserId: staff.id,
          targetUserName: staff.fullName
        })

        const staffIndex = staffList.value.findIndex((entry) => entry.id === staff.id)
        if (staffIndex >= 0) staffList.value.splice(staffIndex, 1, { ...staffList.value[staffIndex], ...updates })
        toast.success('Base pay saved.')
        return true
      } catch (error) {
        console.error('Failed to save base pay:', error)
        toast.error('Failed to save base pay.')
        return false
      } finally {
        savingId.value = ''
      }
    }

    const openEditModal = async (staff, event) => {
      editingStaff.value = { ...staff }
      clearBasePayError(staff.id)
      lastEditButton = event?.currentTarget || null
      await nextTick()
      basePayRateInput.value?.focus()
    }

    const closeEditModal = async () => {
      if (savingId.value) return
      editingStaff.value = null
      await nextTick()
      lastEditButton?.focus?.()
      lastEditButton = null
    }

    const submitEditModal = async () => {
      const staff = editingStaff.value
      if (!staff || savingId.value) return
      if (await saveBasePay(staff)) await closeEditModal()
    }

    const clearBasePayError = (staffId) => {
      if (!basePayErrors.value[staffId]) return
      const nextErrors = { ...basePayErrors.value }
      delete nextErrors[staffId]
      basePayErrors.value = nextErrors
    }

    const updateBasePayRate = (staff, event) => {
      const input = event.target
      const value = input.value
      if (value.startsWith('-') || Number(value) < 0) {
        input.value = ''
        staff.basePay = ''
        basePayErrors.value = { ...basePayErrors.value, [staff.id]: 'Base pay cannot be negative. Enter a rate greater than PHP 0.00.' }
        return
      }
      staff.basePay = value === '' ? '' : Number(value)
      clearBasePayError(staff.id)
    }

    const payModelLabel = (model) => ({
      hourly: 'Hourly / Professional Fee',
      daily: 'Daily',
      'monthly-retainer': 'Monthly Retainer',
    })[model] || 'Pay model not set'

    const basePaySummary = (staff) => {
      if (staff.basePay === '' || staff.basePay == null || !Number.isFinite(Number(staff.basePay))) return 'Not configured'
      const amount = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(staff.basePay))
      const unit = staff.basePayModel === 'daily' ? ' / day' : staff.basePayModel === 'monthly-retainer' ? ' / month' : ' / hour'
      return `${amount}${unit}`
    }

    let unsubscribeAuth = null
    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
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
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageLoading,
      staffList,
      loading,
      savingId,
      basePayErrors,
      editingStaff,
      basePayRateInput,
      clearBasePayError,
      updateBasePayRate,
      payModelLabel,
      basePaySummary,
      openEditModal,
      closeEditModal,
      submitEditModal,
      saveBasePay
    }
  }
}
</script>

<template>
  <div :class="embedded ? 'base-pay-content' : 'flex flex-col md:flex-row module-theme bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'section' : 'main'" v-page-loading="{ active: pageLoading, variant: 'table', columns: 4, rows: 5 }" :class="embedded ? 'min-w-0' : 'flex-1 p-4 md:p-8 text-white'">
      <div v-if="!embedded" class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Base Pay</h1>
        <p class="text-slate-400 text-sm md:text-base">
          Set base pay for employees.
        </p>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <div v-if="loading" class="py-2">
          <PageSectionSkeleton variant="table" :rows="6" :columns="4" />
        </div>
        <p class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Student interns / OJT are excluded from employee payroll. Record each approved allowance in <a class="underline underline-offset-2" href="/finance/expenses-payments?tab=other">Finance → Other Expenses</a> with category “Student intern / OJT allowance,” the intern as payee, and the coverage period in the notes. Then record the payment there.
        </p>
        <p class="mb-4 text-sm text-slate-400">Hourly pay uses worked hours; daily pay uses completed attendance days. A fixed monthly retainer pays the full agreed monthly amount without automatic proration. Configure its agreed monthly hours for the hourly equivalent.</p>
        <p class="mb-4 text-sm text-slate-400">New employee start dates use the effective week set in Shift Assignment. Paid leave eligibility uses that recorded start date; payroll amounts use pay terms and attendance.</p>
        <table class="w-full text-left min-w-[620px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-3 sm:py-3 sm:px-4">Employee</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Role</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Base Pay (PHP)</th>
              <th class="py-2 px-3 sm:py-3 sm:px-4">Action</th>
            </tr>
          </thead>
          <tbody v-if="!loading" class="text-white">
            <tr v-for="staff in staffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <td class="py-2 px-3 sm:py-3 sm:px-4 font-medium">{{ staff.fullName }}</td>
              <td class="py-2 px-3 sm:py-3 sm:px-4">{{ staff.role }}</td>
              <td class="py-2 px-3 sm:py-3 sm:px-4">
                <strong class="block">{{ basePaySummary(staff) }}</strong>
                <small class="text-slate-400">{{ payModelLabel(staff.basePayModel) }}<template v-if="staff.basePayModel === 'monthly-retainer'"> · {{ staff.monthlyBaseHours }} agreed hours / month</template></small>
              </td>
              <td class="py-2 px-3 sm:py-3 sm:px-4 text-right">
                <button
                  type="button"
                  @click="openEditModal(staff, $event)"
                  :aria-label="`Edit compensation for ${staff.fullName}`"
                  :title="`Edit compensation for ${staff.fullName}`"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/30 bg-amber-800 text-white transition hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
                </button>
              </td>
            </tr>

            <tr v-if="staffList.length === 0">
              <td colspan="4" class="py-6 text-center text-slate-400">No employees found for your branch.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </component>

    <div v-if="editingStaff" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" @click.self="closeEditModal" @keydown.esc.stop.prevent="closeEditModal">
      <form class="app-modal-panel finance-dialog w-full max-w-xl overflow-y-auto rounded-2xl border border-amber-800/25 bg-slate-900 p-5 text-white shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="base-pay-modal-title" :aria-busy="savingId === editingStaff.id" @submit.prevent="submitEditModal">
        <header class="flex items-start justify-between gap-4 border-b border-slate-700 pb-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Employee compensation</p>
            <h2 id="base-pay-modal-title" class="mt-1 text-xl font-bold">{{ editingStaff.fullName }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ editingStaff.role }}</p>
          </div>
          <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800" aria-label="Close compensation editor" :disabled="savingId === editingStaff.id" @click="closeEditModal">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="mt-5 grid gap-4">
          <ContractAppearanceSelect :id="`base-pay-model-${editingStaff.id}`" v-model="editingStaff.basePayModel" label="Pay model" :options="[{ value: 'hourly', label: 'Hourly / Professional Fee' }, { value: 'daily', label: 'Daily' }, { value: 'monthly-retainer', label: 'Monthly Retainer' }]" />
          <label :for="`base-pay-rate-${editingStaff.id}`" class="block text-sm font-medium">Rate (PHP)
            <input
              :id="`base-pay-rate-${editingStaff.id}`"
              ref="basePayRateInput"
              type="number"
              min="0.01"
              max="1000000"
              step="0.01"
              :value="editingStaff.basePay"
              inputmode="decimal"
              maxlength="12"
              @keydown="($event.key === '-' || $event.key === 'Subtract') && $event.preventDefault()"
              @input="updateBasePayRate(editingStaff, $event)"
              :aria-invalid="!!basePayErrors[editingStaff.id]"
              :aria-describedby="basePayErrors[editingStaff.id] ? `base-pay-error-${editingStaff.id}` : undefined"
              class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            />
          </label>
          <label v-if="editingStaff.basePayModel === 'monthly-retainer'" class="block text-sm font-medium">Agreed monthly hours
            <input v-model.number="editingStaff.monthlyBaseHours" type="number" min="1" max="744" step="1" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
          </label>
          <p class="text-xs text-slate-400">Payroll is calculated from the saved pay terms and attendance. New employee start dates use the effective week set under Shift Assignment.</p>
          <p v-if="basePayErrors[editingStaff.id]" :id="`base-pay-error-${editingStaff.id}`" class="text-sm text-rose-300" role="alert">{{ basePayErrors[editingStaff.id] }}</p>
        </div>

        <footer class="mt-6 flex justify-end gap-3 border-t border-slate-700 pt-4">
          <button type="button" class="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800" :disabled="savingId === editingStaff.id" @click="closeEditModal">Cancel</button>
          <button type="submit" class="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="savingId === editingStaff.id">{{ savingId === editingStaff.id ? 'Saving…' : 'Save changes' }}</button>
        </footer>
      </form>
    </div>
  </div>
</template>
