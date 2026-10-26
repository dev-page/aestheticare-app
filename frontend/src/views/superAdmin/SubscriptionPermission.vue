<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 4, rows: 5 }" class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
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
          <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>
      <input v-model.trim="planSearch" type="search" placeholder="Filter subscription plans..." class="mb-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" />

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-white font-semibold">Plan Feature Access</h2>
            <p class="text-slate-400 text-xs">Turn features on or off for each plan, then save your changes.</p>
          </div>
        </div>

        <div v-if="loading" class="p-4 text-sm text-slate-300">Loading plan permissions...</div>
        <div v-else-if="!filteredPlanEntries.length" class="p-4 text-sm text-slate-300">No plans found.</div>
        <div v-else class="grid min-w-0 grid-cols-1 gap-4 p-4 xl:grid-cols-2">
          <article v-for="planEntry in paginatedPlanEntries" :key="planEntry.key" class="min-w-0 rounded-xl border border-slate-700 bg-slate-900/50 p-4 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-700 pb-4">
              <div class="min-w-0">
                <h3 class="truncate font-semibold text-white">{{ planEntry.label }}</h3>
                <p class="mt-1 text-xs text-slate-400">{{ planEntry.key }}</p>
              </div>
              <div class="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2">
                <span class="text-xs font-medium text-slate-200">All features</span>
                <button type="button" role="switch" class="feature-switch" :class="isPlanFullAccess(planEntry.key) ? 'feature-switch-on' : 'feature-switch-off'" :aria-checked="isPlanFullAccess(planEntry.key)" :aria-label="`Toggle all features for ${planEntry.label}`" @click="togglePlanFullAccess(planEntry.key)">
                  <span class="feature-switch-thumb" :class="isPlanFullAccess(planEntry.key) ? 'feature-switch-thumb-on' : 'feature-switch-thumb-off'"></span>
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div v-for="feature in planFeatureCatalog" :key="`${planEntry.key}-${feature.key}`" class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-800/60 px-3 py-3" :title="feature.description">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-slate-100">{{ feature.label }}</p>
                  <p class="truncate text-[11px] text-slate-400">{{ feature.description }}</p>
                </div>
                <button type="button" role="switch" class="feature-switch" :class="hasFeature(planEntry, feature.key) ? 'feature-switch-on' : 'feature-switch-off'" :aria-checked="hasFeature(planEntry, feature.key)" :aria-label="`${feature.label} for ${planEntry.label}`" @click="toggleFeature(planEntry, feature.key)">
                  <span class="feature-switch-thumb" :class="hasFeature(planEntry, feature.key) ? 'feature-switch-thumb-on' : 'feature-switch-thumb-off'"></span>
                </button>
              </div>
            </div>

            <div class="mt-4 flex justify-end border-t border-slate-700 pt-4">
              <button type="button" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60" :disabled="savingPlan === planEntry.key" @click="savePlan(planEntry)">
                {{ savingPlan === planEntry.key ? 'Saving...' : 'Save changes' }}
              </button>
            </div>
          </article>
        </div>
        <TablePagination v-model:page="planPage" v-model:page-size="planPageSize" :total-items="filteredPlanEntries.length" />
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import {
  buildSubscriptionPlanCatalog,
  filterActiveSubscriptionPlans,
} from '@/utils/subscriptionPlans'
import { DEFAULT_SUBSCRIPTION_FEATURES } from '@/utils/subscriptionFeatureRegistry'

const defaultPlanCatalog = [
  { id: 'free', key: 'free', label: 'Free Plan' },
  { id: 'basic', key: 'basic', label: 'Basic' },
  { id: 'premium', key: 'premium', label: 'Premium' },
]

export default {
  name: 'SuperAdminSubscriptionPermission',
  components: { SuperAdminSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const loading = ref(false)
    const error = ref('')
    const savingPlan = ref('')
    const planCatalog = ref([])
    const planSearch = ref('')
    const planPage = ref(1)
    const planPageSize = ref(10)
    const planPermissions = ref({})
    const planCatalogLoaded = ref(false)
    const planPermissionsLoaded = ref(false)

    const planFeatureCatalog = computed(() => DEFAULT_SUBSCRIPTION_FEATURES.filter((feature) => feature.isActive !== false))

    const finishLoading = () => {
      if (planCatalogLoaded.value && planPermissionsLoaded.value) {
        loading.value = false
      }
    }

    const planEntries = computed(() =>
      planCatalog.value.map((plan) => {
        const key = plan.id || plan.key
        return {
          ...plan,
          key,
          label: plan.label || plan.name || plan.id || plan.key,
          permissions: Array.isArray(planPermissions.value[key])
            ? [...planPermissions.value[key]]
            : [],
        }
      })
    )
    const filteredPlanEntries = computed(() => {
      const keyword = planSearch.value.toLowerCase()
      return planEntries.value.filter((plan) => !keyword || [plan.key, plan.label].join(' ').toLowerCase().includes(keyword))
    })
    const paginatedPlanEntries = computed(() => filteredPlanEntries.value.slice((planPage.value - 1) * planPageSize.value, planPage.value * planPageSize.value))
    const totalPlanPages = computed(() => Math.max(1, Math.ceil(filteredPlanEntries.value.length / planPageSize.value)))
    watch([planSearch, planPageSize], () => { planPage.value = 1 })
    watch(totalPlanPages, (count) => { if (planPage.value > count) planPage.value = count })

      let unsubscribePermissions = null
    let unsubscribePlans = null

    const loadPermissions = () => {
      loading.value = true
      error.value = ''
      planCatalogLoaded.value = false
      planPermissionsLoaded.value = false
      if (unsubscribePermissions) {
        unsubscribePermissions()
        unsubscribePermissions = null
      }
      if (unsubscribePlans) {
        unsubscribePlans()
        unsubscribePlans = null
      }
      try {
        unsubscribePlans = pageListener(
          onSnapshot, collection(db, 'subscriptionPlans'),
          (snapshot) => {
            const merged = buildSubscriptionPlanCatalog(defaultPlanCatalog, snapshot.docs)
            planCatalog.value = filterActiveSubscriptionPlans(merged)
            planCatalogLoaded.value = true
            finishLoading()
          },
          (err) => {
            console.error('Error loading subscription plans:', err)
            error.value = 'Failed to load subscription plans. Please try again.'
            loading.value = false
          }
        )

        unsubscribePermissions = pageListener(
          onSnapshot, collection(db, 'planPermissions'),
          (snapshot) => {
            const map = {}
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() || {}
              map[docSnap.id] = Array.isArray(data.permissions) ? data.permissions : []
            })
            planPermissions.value = map
            planPermissionsLoaded.value = true
            finishLoading()
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

        await systemAdminSwal.fire({
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
      if (!planFeatureCatalog.value.length) return false
      return planFeatureCatalog.value.every((feature) => current.includes(feature.key))
    }

    const togglePlanFullAccess = (planKey) => {
      const current = new Set(Array.isArray(planPermissions.value[planKey]) ? planPermissions.value[planKey] : [])
      const allKeys = planFeatureCatalog.value.map((feature) => feature.key)
      const enableAll = !allKeys.every((key) => current.has(key))
      planPermissions.value = {
        ...planPermissions.value,
        [planKey]: enableAll ? allKeys : [],
      }
    }

    onMounted(loadPermissions)

    onUnmounted(() => {
      if (unsubscribePermissions) unsubscribePermissions()
      if (unsubscribePlans) unsubscribePlans()
    })

    return {
      pageLoading,
      loading,
      error,
      savingPlan,
      planEntries,
      planSearch,
      planPage,
      planPageSize,
      filteredPlanEntries,
      paginatedPlanEntries,
      planFeatureCatalog,
      loadPermissions,
      savePlan,
      hasFeature,
      toggleFeature,
      isPlanFullAccess,
      togglePlanFullAccess,
    }
  },
}
</script>

<style scoped>
.feature-switch {
  position: relative;
  display: inline-flex;
  width: 2.75rem;
  height: 1.5rem;
  flex: 0 0 auto;
  align-items: center;
  border: 2px solid #9b6847;
  border-radius: 9999px;
  padding: 0;
  transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
}

.feature-switch-off {
  border-color: #9b6847;
  background: #f5e7d6;
}

.feature-switch-on {
  border-color: #39734a;
  background: #39734a;
}

.feature-switch-thumb {
  display: block;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background: #fffdf9;
  box-shadow: 0 1px 3px rgba(52, 36, 25, .32);
  transition: transform .16s ease;
}

.feature-switch-thumb-off { transform: translateX(.1rem); }
.feature-switch-thumb-on { transform: translateX(1.2rem); }

.feature-switch:focus-visible {
  outline: 3px solid rgba(141, 90, 59, .35);
  outline-offset: 2px;
}
</style>
