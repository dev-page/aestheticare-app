<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8 overflow-x-hidden">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Subscription Permissions</h1>
          <p class="text-slate-400">Define the scope of features for each subscription plan.</p>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          @click="loadPermissions"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-white font-semibold">Plan Feature Access</h2>
            <p class="text-slate-400 text-xs">Toggle which features are available per plan.</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-[11px] table-fixed">
            <thead class="bg-slate-900/70">
              <tr>
                <th class="text-left text-slate-300 px-3 py-2 w-40">Plan</th>
                <th
                  v-for="feature in planFeatureCatalog"
                  :key="`head-${feature.key}`"
                  class="text-center text-slate-300 px-2 py-2 whitespace-normal leading-tight"
                >
                  {{ feature.label }}
                </th>
                <th class="text-center text-slate-300 px-2 py-2 whitespace-normal leading-tight">Full Access</th>
                <th class="text-right text-slate-300 px-3 py-2 w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-3 py-2 text-slate-300" :colspan="planFeatureCatalog.length + 3">
                  Loading plan permissions...
                </td>
              </tr>
              <tr v-else-if="!planEntries.length">
                <td class="px-3 py-2 text-slate-300" :colspan="planFeatureCatalog.length + 3">
                  No plans found.
                </td>
              </tr>
              <tr
                v-else
                v-for="planEntry in planEntries"
                :key="planEntry.key"
                class="border-t border-slate-700/60"
              >
                <td class="px-3 py-2 text-slate-100">
                  <div class="font-semibold">{{ planEntry.label }}</div>
                  <div class="text-[11px] text-slate-400">{{ planEntry.key }}</div>
                </td>
                <td
                  v-for="feature in planFeatureCatalog"
                  :key="`${planEntry.key}-${feature.key}`"
                  class="px-2 py-2 text-center"
                  :title="feature.description"
                >
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 items-center rounded-full border transition"
                    :class="toggleClass(hasFeature(planEntry, feature.key))"
                    @click="toggleFeature(planEntry, feature.key)"
                    :aria-pressed="hasFeature(planEntry, feature.key)"
                    :title="feature.description"
                  >
                    <span
                      class="inline-block h-3 w-3 transform rounded-full bg-white transition"
                      :class="hasFeature(planEntry, feature.key) ? 'translate-x-5' : 'translate-x-1'"
                    ></span>
                  </button>
                </td>
                <td class="px-2 py-2 text-center">
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 items-center rounded-full border transition"
                    :class="toggleClass(isPlanFullAccess(planEntry.key))"
                    @click="togglePlanFullAccess(planEntry.key)"
                    :aria-pressed="isPlanFullAccess(planEntry.key)"
                    title="Toggle full access for this plan"
                  >
                    <span
                      class="inline-block h-3 w-3 transform rounded-full bg-white transition"
                      :class="isPlanFullAccess(planEntry.key) ? 'translate-x-5' : 'translate-x-1'"
                    ></span>
                  </button>
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    class="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px]"
                    :disabled="savingPlan === planEntry.key"
                    @click="savePlan(planEntry)"
                  >
                    {{ savingPlan === planEntry.key ? 'Saving...' : 'Save' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const planCatalog = [
  { key: 'free', label: 'Free Plan' },
  { key: 'basic', label: 'Basic' },
  { key: 'premium', label: 'Premium' },
]

const planFeatureCatalog = [
  { key: 'multi_branch', label: 'Multi-Branch', description: 'Add and manage multiple branches.' },
  { key: 'staff_management', label: 'Staff Management', description: 'Create and manage staff accounts.' },
  { key: 'appointments', label: 'Appointments', description: 'Scheduling, rescheduling, and appointment management.' },
  { key: 'pos_payments', label: 'POS & Payments', description: 'Collect payments and manage POS.' },
  { key: 'inventory', label: 'Inventory', description: 'Suppliers, catalog, purchases, stock.' },
  { key: 'services', label: 'Services & Posts', description: 'Manage services/products and posts.' },
  { key: 'online_consultations', label: 'Online Consultations', description: 'Enable online consultations.' },
  { key: 'reports', label: 'Reports', description: 'Access analytics and finance reports.' },
  { key: 'hr', label: 'HR', description: 'Employee records, shifts, attendance management.' },
  { key: 'payroll', label: 'Payroll', description: 'Payroll processing and payslips.' },
  { key: 'attendance', label: 'Attendance', description: 'Attendance monitoring and logs.' },
  { key: 'dss', label: 'DSS', description: 'Decision support recommendations.' },
]

export default {
  name: 'SuperAdminSubscriptionPermission',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const savingPlan = ref('')
    const planPermissions = ref({})

    const planEntries = computed(() =>
      planCatalog.map((plan) => ({
        ...plan,
        permissions: Array.isArray(planPermissions.value[plan.key])
          ? [...planPermissions.value[plan.key]]
          : [],
      }))
    )

    let unsubscribe = null

    const loadPermissions = () => {
      loading.value = true
      error.value = ''
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }

      try {
        unsubscribe = onSnapshot(
          collection(db, 'planPermissions'),
          (snapshot) => {
            const map = {}
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() || {}
              map[docSnap.id] = Array.isArray(data.permissions) ? data.permissions : []
            })
            planPermissions.value = map
            loading.value = false
          },
          (err) => {
            console.error('Error loading plan permissions:', err)
            error.value = 'Failed to load plan permissions. Please try again.'
            loading.value = false
          }
        )
      } catch (err) {
        console.error('Error loading plan permissions:', err)
        error.value = 'Failed to load plan permissions. Please try again.'
        loading.value = false
      }
    }

    const savePlan = async (planEntry) => {
      savingPlan.value = planEntry.key
      error.value = ''
      try {
        const cleanPermissions = Array.from(
          new Set(
            (planEntry.permissions || [])
              .map((value) => String(value || '').trim())
              .filter(Boolean)
          )
        )

        await setDoc(
          doc(db, 'planPermissions', planEntry.key),
          {
            plan: planEntry.key,
            permissions: cleanPermissions,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        planPermissions.value = {
          ...planPermissions.value,
          [planEntry.key]: cleanPermissions,
        }

        await Swal.fire({
          title: 'Saved',
          text: `${planEntry.label} permissions updated.`,
          icon: 'success',
          timer: 1200,
          showConfirmButton: false,
        })
      } catch (err) {
        console.error('Error saving plan permissions:', err)
        error.value = `Failed to save ${planEntry.label} permissions.`
      } finally {
        savingPlan.value = ''
      }
    }

    const hasFeature = (planEntry, featureKey) => {
      const current = planPermissions.value[planEntry.key]
      return Array.isArray(current) && current.includes(featureKey)
    }

    const toggleFeature = (planEntry, featureKey) => {
      const current = Array.isArray(planPermissions.value[planEntry.key])
        ? planPermissions.value[planEntry.key]
        : []
      const set = new Set(current)
      if (set.has(featureKey)) {
        set.delete(featureKey)
      } else {
        set.add(featureKey)
      }
      planPermissions.value = {
        ...planPermissions.value,
        [planEntry.key]: Array.from(set),
      }
    }

    const isPlanFullAccess = (planKey) => {
      const current = Array.isArray(planPermissions.value[planKey]) ? planPermissions.value[planKey] : []
      if (!planFeatureCatalog.length) return false
      return planFeatureCatalog.every((feature) => current.includes(feature.key))
    }

    const togglePlanFullAccess = (planKey) => {
      const current = new Set(Array.isArray(planPermissions.value[planKey]) ? planPermissions.value[planKey] : [])
      const allKeys = planFeatureCatalog.map((feature) => feature.key)
      const enableAll = !allKeys.every((key) => current.has(key))
      planPermissions.value = {
        ...planPermissions.value,
        [planKey]: enableAll ? allKeys : [],
      }
    }

    const toggleClass = (enabled) =>
      enabled
        ? 'bg-emerald-500 border-emerald-300/50 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]'
        : 'bg-slate-900 border-slate-600 hover:border-slate-400'

    onMounted(loadPermissions)

    onUnmounted(() => {
      if (unsubscribe) unsubscribe()
    })

    return {
      loading,
      error,
      savingPlan,
      planEntries,
      planFeatureCatalog,
      loadPermissions,
      savePlan,
      hasFeature,
      toggleFeature,
      isPlanFullAccess,
      togglePlanFullAccess,
      toggleClass,
    }
  },
}
</script>
