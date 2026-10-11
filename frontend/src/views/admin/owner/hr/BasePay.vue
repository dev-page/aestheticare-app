<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, onUnmounted } from 'vue'
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
          .filter((staff) => !staff.archived)
          .map((staff) => ({
            id: staff.id,
            fullName: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'Unnamed',
            role: String(staff.customRoleName || staff.role || 'Staff').trim(),
            basePayModel: staff.basePayModel || 'hourly',
            monthlyBaseHours: Number(staff.monthlyBaseHours || 176),
            basePay: staff.basePay == null || staff.basePay === '' ? '' : Number(staff.basePay)
          }))
      } catch (error) {
        console.error('Failed to load staff for base pay:', error)
        toast.error('Failed to load base pay records.')
      } finally {
        loading.value = false
      }
    })

    const saveBasePay = async (staff) => {
      if (!staff) return
      const rawValue = String(staff.basePay ?? '').trim()
      const basePayValue = Number(rawValue)
      let validationMessage = ''
      if (!['hourly', 'daily', 'monthly-retainer'].includes(staff.basePayModel) || !Number.isFinite(Number(staff.monthlyBaseHours)) || staff.monthlyBaseHours < 1 || staff.monthlyBaseHours > 744) {
        validationMessage = 'Choose a valid pay model and monthly hour divisor.'
      } else if (!rawValue) {
        validationMessage = 'Enter the employee\'s base pay.'
      } else if (!Number.isFinite(basePayValue)) {
        validationMessage = 'Base pay must be a valid number.'
      } else if (basePayValue <= 0) {
        validationMessage = 'Base pay must be greater than PHP 0.00.'
      } else if (basePayValue > 1000000) {
        validationMessage = 'Base pay cannot exceed PHP 1,000,000.00 for this pay model.'
      } else if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
        validationMessage = 'Base pay may contain up to two decimal places.'
      }
      if (validationMessage) {
        basePayErrors.value = { ...basePayErrors.value, [staff.id]: validationMessage }
        toast.error(validationMessage)
        return
      }
      const nextErrors = { ...basePayErrors.value }
      delete nextErrors[staff.id]
      basePayErrors.value = nextErrors
      savingId.value = staff.id
      try {
        await updateDoc(doc(db, 'users', staff.id), {
          basePay: Number(basePayValue.toFixed(2)),
          basePayModel: staff.basePayModel,
          monthlyBaseHours: Number(staff.monthlyBaseHours || 176)
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
      clearBasePayError,
      updateBasePayRate,
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
        <p class="mb-4 text-sm text-slate-400">Hourly pay uses worked hours; daily pay uses completed attendance days. A fixed monthly retainer pays the full agreed monthly amount without automatic proration. Configure its agreed monthly hours for the hourly equivalent.</p>
        <table class="w-full text-left min-w-[900px] border-collapse">
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
                <ContractAppearanceSelect :id="`base-pay-model-${staff.id}`" v-model="staff.basePayModel" label="Pay model" :options="[{ value: 'hourly', label: 'Hourly / Professional Fee' }, { value: 'daily', label: 'Daily' }, { value: 'monthly-retainer', label: 'Monthly Retainer' }]" />
                <label :for="`base-pay-rate-${staff.id}`" class="block mb-2 text-xs">Rate (PHP)</label>
                <input
                  :id="`base-pay-rate-${staff.id}`"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  :value="staff.basePay"
                  inputmode="decimal"
                  maxlength="12"
                  @keydown="($event.key === '-' || $event.key === 'Subtract') && $event.preventDefault()"
                  @input="updateBasePayRate(staff, $event)"
                  :aria-invalid="!!basePayErrors[staff.id]"
                  :aria-describedby="basePayErrors[staff.id] ? `base-pay-error-${staff.id}` : undefined"
                  class="w-full min-w-[140px] px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label v-if="staff.basePayModel === 'monthly-retainer'" class="block mt-3 text-xs">Agreed monthly hours<input v-model.number="staff.monthlyBaseHours" type="number" min="1" max="744" step="1" class="mt-2 w-full rounded-lg border px-3 py-2" /></label>
                <p v-if="basePayErrors[staff.id]" :id="`base-pay-error-${staff.id}`" class="mt-1 text-xs text-rose-300" role="alert">{{ basePayErrors[staff.id] }}</p>
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
    </component>
  </div>
</template>
