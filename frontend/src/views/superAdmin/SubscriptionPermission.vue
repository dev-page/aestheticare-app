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

      <section class="mb-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="font-semibold text-white">Feature Registry</h2>
            <p class="text-xs text-slate-400">Add subscription feature keys used by plans and module access checks.</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-sky-500/40 px-3 py-2 text-xs text-sky-200 hover:bg-slate-700"
            :disabled="savingFeature"
            @click="addFeatureDefinition"
          >
            + Add Feature
          </button>
        </div>

        <div class="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1.4fr_0.8fr]">
          <input v-model="newFeature.key" class="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100" placeholder="feature_key" />
          <input v-model="newFeature.label" class="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100" placeholder="Feature label" />
          <input v-model="newFeature.description" class="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100" placeholder="Description" />
          <input v-model="newFeature.module" class="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100" placeholder="Module" />
        </div>

        <div class="space-y-2">
          <div v-for="feature in featureDefinitions" :key="feature.key" class="grid grid-cols-1 gap-2 rounded-lg border border-slate-700/70 p-2 md:grid-cols-[1fr_1fr_1.4fr_0.8fr_auto_auto] md:items-center">
            <input v-model="feature.key" disabled class="rounded bg-slate-900/70 px-2 py-1.5 text-xs text-slate-400" />
            <input v-model="feature.label" class="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
            <input v-model="feature.description" class="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
            <input v-model="feature.module" class="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
            <button type="button" class="rounded bg-emerald-600 px-2 py-1.5 text-xs text-white hover:bg-emerald-500" :disabled="savingFeature" @click="saveFeatureDefinition(feature)">Save</button>
            <button type="button" class="rounded px-2 py-1.5 text-xs hover:bg-slate-700" :class="feature.isActive ? 'text-amber-300' : 'text-emerald-300'" :disabled="savingFeature" @click="toggleFeatureDefinition(feature)">
              {{ feature.isActive ? 'Deactivate' : 'Activate' }}
            </button>
          </div>
        </div>
      </section>

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
import {
  buildSubscriptionPlanCatalog,
  filterActiveSubscriptionPlans,
} from '@/utils/subscriptionPlans'
import {
  buildSubscriptionFeatureRegistry,
  DEFAULT_SUBSCRIPTION_FEATURES,
} from '@/utils/subscriptionFeatureRegistry'

const defaultPlanCatalog = [
  { id: 'free', key: 'free', label: 'Free Plan' },
  { id: 'basic', key: 'basic', label: 'Basic' },
  { id: 'premium', key: 'premium', label: 'Premium' },
]

export default {
  name: 'SuperAdminSubscriptionPermission',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const savingPlan = ref('')
    const planCatalog = ref([])
    const planPermissions = ref({})
    const featureDefinitions = ref(DEFAULT_SUBSCRIPTION_FEATURES.map((feature) => ({ ...feature })))
    const newFeature = ref({ key: '', label: '', description: '', module: 'Other' })
    const savingFeature = ref(false)
    const planCatalogLoaded = ref(false)
    const planPermissionsLoaded = ref(false)

    const planFeatureCatalog = computed(() => featureDefinitions.value.filter((feature) => feature.isActive !== false))

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

      let unsubscribePermissions = null
    let unsubscribePlans = null
    let unsubscribeFeatures = null

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
      if (unsubscribeFeatures) {
        unsubscribeFeatures()
        unsubscribeFeatures = null
      }

      try {
        unsubscribePlans = onSnapshot(
          collection(db, 'subscriptionPlans'),
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

        unsubscribePermissions = onSnapshot(
          collection(db, 'planPermissions'),
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

        unsubscribeFeatures = onSnapshot(
          collection(db, 'subscriptionFeatures'),
          (snapshot) => {
            featureDefinitions.value = buildSubscriptionFeatureRegistry(snapshot.docs)
          },
          (err) => {
            console.error('Error loading subscription feature registry:', err)
            error.value = 'Failed to load the subscription feature registry. Please try again.'
          }
        )
      } catch (err) {
        console.error('Error loading plan permissions:', err)
        error.value = 'Failed to load plan permissions. Please try again.'
        loading.value = false
      }
    }

    const normalizeFeatureKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

    const saveFeatureDefinition = async (feature) => {
      const key = normalizeFeatureKey(feature.key)
      if (!key || !String(feature.label || '').trim()) {
        error.value = 'Feature key and label are required.'
        return
      }
      savingFeature.value = true
      error.value = ''
      try {
        await setDoc(doc(db, 'subscriptionFeatures', key), {
          key,
          label: String(feature.label || '').trim(),
          description: String(feature.description || '').trim(),
          module: String(feature.module || 'Other').trim() || 'Other',
          isActive: feature.isActive !== false,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        feature.key = key
        await Swal.fire({ title: 'Saved', text: `${feature.label} feature updated.`, icon: 'success', timer: 1100, showConfirmButton: false })
      } catch (err) {
        console.error('Error saving subscription feature:', err)
        error.value = 'Failed to save the subscription feature.'
      } finally {
        savingFeature.value = false
      }
    }

    const addFeatureDefinition = async () => {
      const key = normalizeFeatureKey(newFeature.value.key)
      if (!key || !String(newFeature.value.label || '').trim()) {
        error.value = 'Feature key and label are required.'
        return
      }
      if (featureDefinitions.value.some((feature) => feature.key === key)) {
        error.value = 'That feature key already exists.'
        return
      }
      const feature = { key, label: newFeature.value.label, description: newFeature.value.description, module: newFeature.value.module, isActive: true }
      await saveFeatureDefinition(feature)
      featureDefinitions.value = [...featureDefinitions.value, feature].sort((a, b) => a.label.localeCompare(b.label))
      newFeature.value = { key: '', label: '', description: '', module: 'Other' }
    }

    const toggleFeatureDefinition = async (feature) => {
      feature.isActive = feature.isActive === false
      await saveFeatureDefinition(feature)
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

    const toggleClass = (enabled) =>
      enabled
        ? 'bg-emerald-500 border-emerald-300/50 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]'
        : 'bg-slate-900 border-slate-600 hover:border-slate-400'

    onMounted(loadPermissions)

    onUnmounted(() => {
      if (unsubscribePermissions) unsubscribePermissions()
      if (unsubscribePlans) unsubscribePlans()
      if (unsubscribeFeatures) unsubscribeFeatures()
    })

    return {
      loading,
      error,
      savingPlan,
      planEntries,
      featureDefinitions,
      newFeature,
      savingFeature,
      planFeatureCatalog,
      addFeatureDefinition,
      saveFeatureDefinition,
      toggleFeatureDefinition,
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
