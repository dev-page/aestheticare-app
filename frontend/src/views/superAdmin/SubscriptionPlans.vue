<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Setup Plans</h1>
          <p class="text-slate-400">Configure pricing, cycle, and features for each subscription plan.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-sky-500/40 text-sky-200 hover:bg-slate-800"
            :disabled="loading"
            @click="addNewPlan"
          >
            + Add New Plan
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadPlans"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <article
          v-for="plan in plans"
          :key="plan.localKey || plan.id"
          class="bg-slate-800 border border-slate-700 rounded-xl p-6"
        >
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-white font-semibold text-lg">{{ plan.isDraft ? (plan.label || 'New Plan') : plan.label }}</h2>
                <span
                  v-if="plan.isDraft"
                  class="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200"
                >
                  New
                </span>
              </div>
              <p class="text-slate-400 text-xs">Plan ID: {{ plan.id || 'Pending' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <label class="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  v-model="plan.isActive"
                  type="checkbox"
                  class="accent-emerald-500"
                  @change="clearPlanFieldError(plan, 'isActive')"
                />
                Active
              </label>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/40 text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="savingId === (plan.localKey || plan.id)"
                :title="plan.isDraft ? 'Discard draft' : 'Delete plan'"
                @click="deletePlan(plan)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div v-if="plan.isDraft">
              <label class="block text-xs text-slate-400 mb-1">Plan ID</label>
              <input
                v-model="plan.id"
                type="text"
                class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                :class="fieldClass(plan, 'id')"
                placeholder="e.g. standard"
                @input="clearPlanFieldError(plan, 'id')"
              />
              <p v-if="fieldError(plan, 'id')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'id') }}</p>
              <p class="mt-1 text-[11px] text-slate-500">Use lowercase letters, numbers, and hyphens only.</p>
            </div>

            <div v-if="plan.isDraft">
              <label class="block text-xs text-slate-400 mb-1">Plan Label</label>
              <input
                v-model="plan.label"
                type="text"
                class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                :class="fieldClass(plan, 'label')"
                placeholder="Visible card title"
                @input="clearPlanFieldError(plan, 'label')"
              />
              <p v-if="fieldError(plan, 'label')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'label') }}</p>
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                v-model="plan.name"
                type="text"
                class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                :class="fieldClass(plan, 'name')"
                placeholder="Plan name"
                @input="clearPlanFieldError(plan, 'name')"
              />
              <p v-if="fieldError(plan, 'name')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'name') }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Price (PHP)</label>
                <input
                  v-model="plan.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  :class="fieldClass(plan, 'price')"
                  @input="clearPlanFieldError(plan, 'price')"
                />
                <p v-if="fieldError(plan, 'price')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'price') }}</p>
              </div>

              <div>
                <label class="block text-xs text-slate-400 mb-1">Billing Cycle</label>
                <input
                  v-model="plan.billingCycle"
                  type="text"
                  class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  :class="fieldClass(plan, 'billingCycle')"
                  placeholder="month, year, one-time"
                  @input="clearPlanFieldError(plan, 'billingCycle')"
                />
                <p v-if="fieldError(plan, 'billingCycle')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'billingCycle') }}</p>
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                v-model="plan.description"
                rows="2"
                class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                :class="fieldClass(plan, 'description')"
                placeholder="Short plan description"
                @input="clearPlanFieldError(plan, 'description')"
              ></textarea>
              <p v-if="fieldError(plan, 'description')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'description') }}</p>
            </div>

            <div v-if="plan.id === 'free' || plan.isDraft">
              <label class="block text-xs text-slate-400 mb-1">Trial Duration (days)</label>
              <input
                v-model="plan.trialDays"
                type="number"
                min="0"
                step="1"
                class="w-full bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                :class="fieldClass(plan, 'trialDays')"
                @input="clearPlanFieldError(plan, 'trialDays')"
              />
              <p v-if="fieldError(plan, 'trialDays')" class="mt-1 text-xs text-rose-300">{{ fieldError(plan, 'trialDays') }}</p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-slate-400">Features</label>
                <button
                  type="button"
                  class="text-xs text-sky-300 hover:text-sky-200"
                  @click="addFeature(plan)"
                >
                  + Add feature
                </button>
              </div>

              <div class="space-y-2">
                <div v-for="(feature, index) in plan.features" :key="`${plan.localKey || plan.id}-feature-${index}`" class="space-y-1">
                  <div class="flex gap-2">
                    <input
                      v-model="plan.features[index]"
                      type="text"
                      class="flex-1 bg-slate-900 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                      :class="featureFieldClass(plan, index)"
                      placeholder="Feature"
                      @input="clearPlanFeatureError(plan, index)"
                    />
                    <button
                      type="button"
                      class="px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs"
                      @click="removeFeature(plan, index)"
                    >
                      Remove
                    </button>
                  </div>
                  <p v-if="featureError(plan, index)" class="text-xs text-rose-300">{{ featureError(plan, index) }}</p>
                </div>

                <p v-if="!plan.features.length" class="text-xs text-slate-500">No features yet.</p>
                <p v-if="fieldError(plan, 'features')" class="text-xs text-rose-300">{{ fieldError(plan, 'features') }}</p>
              </div>
            </div>

            <button
              type="button"
              class="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              :disabled="savingId === (plan.localKey || plan.id)"
              @click="savePlan(plan)"
            >
              {{ savingId === (plan.localKey || plan.id) ? 'Saving...' : (plan.isDraft ? 'Create Plan' : 'Save Plan') }}
            </button>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import Swal from 'sweetalert2'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const defaultPlans = () => [
  {
    id: 'free',
    label: 'Free Plan',
    name: 'Free Plan',
    price: 0,
    billingCycle: 'month',
    description: 'Core tools for one-branch clinics with no expiration.',
    trialDays: 0,
    isActive: true,
    features: ['One branch', 'Core operations', 'Upgrade anytime'],
  },
  {
    id: 'basic',
    label: 'Basic',
    name: 'Basic',
    price: 999,
    billingCycle: 'month',
    description: 'Essential tools for daily clinic operations.',
    trialDays: 0,
    isActive: true,
    features: ['Scheduling & billing', 'Staff management', 'Reports'],
  },
  {
    id: 'premium',
    label: 'Premium',
    name: 'Premium',
    price: 2499,
    billingCycle: 'month',
    description: 'Advanced features and priority support.',
    trialDays: 0,
    isActive: true,
    features: ['Everything in Basic', 'Advanced analytics', 'Priority support'],
  },
]

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const billingCyclePattern = /^(month|year|one-time)$/i

let draftPlanCounter = 0

const prettifyId = (value) =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const createDraftPlan = () => ({
  localKey: `draft-${Date.now()}-${++draftPlanCounter}`,
  isDraft: true,
  id: '',
  label: '',
  name: '',
  price: '',
  billingCycle: 'month',
  description: '',
  trialDays: '',
  isActive: false,
  features: [''],
})

const normalizePlan = (plan, fallback = {}) => ({
  localKey: String(plan.localKey || plan.id || fallback.id || '').trim(),
  isDraft: Boolean(plan.isDraft),
  isDeleted: Boolean(plan.isDeleted),
  id: String(plan.id || fallback.id || '').trim(),
  label: String(plan.label || fallback.label || prettifyId(plan.id || fallback.id || '')).trim(),
  name: String(plan.name || fallback.name || plan.label || fallback.label || '').trim(),
  price: plan.price ?? fallback.price ?? '',
  billingCycle: String(plan.billingCycle || fallback.billingCycle || '').trim(),
  description: String(plan.description || fallback.description || '').trim(),
  trialDays: plan.trialDays ?? fallback.trialDays ?? '',
  isActive: plan.isActive ?? fallback.isActive ?? false,
  features: Array.isArray(plan.features)
    ? [...plan.features]
    : Array.isArray(fallback.features)
      ? [...fallback.features]
      : [''],
})

export default {
  name: 'SuperAdminSubscriptionPlans',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const savingId = ref('')
    const plans = ref(defaultPlans())
    const planErrors = ref({})

    const planKey = (plan) => String(plan?.localKey || plan?.id || '').trim()

    const getPlanErrors = (plan) => planErrors.value[planKey(plan)] || {}

    const fieldError = (plan, field) => {
      const value = getPlanErrors(plan)[field]
      if (Array.isArray(value)) return 'Please complete all feature fields.'
      return value || ''
    }

    const featureError = (plan, index) => {
      const errors = getPlanErrors(plan).features
      return Array.isArray(errors) ? errors[index] || '' : ''
    }

    const clearPlanFieldError = (plan, field) => {
      const key = planKey(plan)
      if (!key || !planErrors.value[key]) return
      if (!field) {
        delete planErrors.value[key]
        return
      }
      const nextErrors = { ...planErrors.value[key] }
      delete nextErrors[field]
      if (field === 'features') {
        delete nextErrors.features
      }
      if (!Object.keys(nextErrors).length) {
        delete planErrors.value[key]
      } else {
        planErrors.value[key] = nextErrors
      }
    }

    const clearPlanFeatureError = (plan, index) => {
      const key = planKey(plan)
      if (!key || !planErrors.value[key] || !Array.isArray(planErrors.value[key].features)) return
      const nextErrors = { ...planErrors.value[key] }
      const nextFeatureErrors = [...nextErrors.features]
      nextFeatureErrors[index] = ''
      if (nextFeatureErrors.some(Boolean)) {
        nextErrors.features = nextFeatureErrors
      } else {
        delete nextErrors.features
      }
      if (!Object.keys(nextErrors).length) {
        delete planErrors.value[key]
      } else {
        planErrors.value[key] = nextErrors
      }
    }

    const buildFeatureErrors = (features) => {
      const errors = []
      features.forEach((feature, index) => {
        if (!String(feature || '').trim()) {
          errors[index] = 'Feature is required.'
        }
      })
      return errors
    }

    const validatePlan = (plan) => {
      const errors = {}
      const normalizedId = String(plan.id || '').trim()
      const normalizedLabel = String(plan.label || '').trim()
      const normalizedName = String(plan.name || '').trim()
      const normalizedBillingCycle = String(plan.billingCycle || '').trim()
      const normalizedDescription = String(plan.description || '').trim()
      const numericPrice = Number(plan.price)
      const numericTrialDays = Number(plan.trialDays)
      const key = planKey(plan)
      const allPlanIds = plans.value
        .filter((entry) => planKey(entry) !== key)
        .map((entry) => String(entry.id || '').trim().toLowerCase())

      if (!normalizedId) {
        errors.id = 'Plan ID is required.'
      } else if (!/^[a-z0-9-]+$/.test(normalizedId)) {
        errors.id = 'Use lowercase letters, numbers, and hyphens only.'
      } else if (allPlanIds.includes(normalizedId.toLowerCase())) {
        errors.id = 'Plan ID already exists.'
      }

      if (!normalizedLabel) {
        errors.label = 'Plan label is required.'
      }

      if (!normalizedName) {
        errors.name = 'Display name is required.'
      }

      if (plan.price === '' || plan.price === null || plan.price === undefined || Number.isNaN(numericPrice)) {
        errors.price = 'Price is required.'
      } else if (numericPrice < 0) {
        errors.price = 'Price must be zero or higher.'
      }

      if (!normalizedBillingCycle) {
        errors.billingCycle = 'Billing cycle is required.'
      } else if (!billingCyclePattern.test(normalizedBillingCycle)) {
        errors.billingCycle = 'Use month, year, or one-time.'
      }

      if (!normalizedDescription) {
        errors.description = 'Description is required.'
      } else if (normalizedDescription.length < 10) {
        errors.description = 'Description must be at least 10 characters.'
      }

      if (plan.id === 'free' || plan.isDraft) {
        if (plan.trialDays === '' || plan.trialDays === null || plan.trialDays === undefined || Number.isNaN(numericTrialDays)) {
          errors.trialDays = 'Trial duration is required.'
        } else if (!Number.isInteger(numericTrialDays) || numericTrialDays < 0) {
          errors.trialDays = 'Trial duration must be a whole number of 0 or more.'
        }
      }

      const features = Array.isArray(plan.features) ? plan.features : []
      if (!features.length) {
        errors.features = 'At least one feature is required.'
      } else {
        const featureErrors = buildFeatureErrors(features)
        if (featureErrors.some(Boolean)) {
          errors.features = featureErrors
        }
      }

      return errors
    }

    const appendPlan = () => {
      plans.value = [...plans.value, createDraftPlan()]
    }

    const deletePlan = async (plan) => {
      const key = planKey(plan)
      const planLabel = String(plan.label || plan.name || plan.id || 'this plan').trim()

      const confirmation = await Swal.fire({
        title: plan.isDraft ? 'Discard this draft?' : 'Delete this plan?',
        text: plan.isDraft
          ? 'This draft will be removed from the page.'
          : `This will hide ${planLabel} from the plan list and mark it as deleted.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: plan.isDraft ? 'Discard' : 'Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
      })

      if (!confirmation.isConfirmed) return

      if (plan.isDraft) {
        plans.value = plans.value.filter((entry) => planKey(entry) !== key)
        clearPlanFieldError(plan)
        return
      }

      savingId.value = key
      error.value = ''

      try {
        await setDoc(doc(db, 'subscriptionPlans', String(plan.id || '').trim()), {
          isDeleted: true,
          isActive: false,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })

        plans.value = plans.value.filter((entry) => planKey(entry) !== key)
        delete planErrors.value[key]

        await Swal.fire({
          title: 'Deleted',
          text: `${planLabel} was removed successfully.`,
          icon: 'success',
          timer: 1400,
          showConfirmButton: false,
        })
      } catch (err) {
        console.error('Error deleting plan:', err)
        error.value = `Failed to delete ${planLabel}. Please try again.`
      } finally {
        savingId.value = ''
      }
    }

    const mergePlan = (basePlan, dbPlan = {}) => {
      return normalizePlan({
        ...basePlan,
        ...dbPlan,
        id: basePlan.id,
        label: basePlan.label,
        features: Array.isArray(dbPlan.features) ? dbPlan.features : basePlan.features,
      }, basePlan)
    }

    const loadPlans = async () => {
      loading.value = true
      error.value = ''

      try {
        const snapshot = await getDocs(collection(db, 'subscriptionPlans'))
        const dbPlans = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))
        const basePlans = defaultPlans()
          .map((plan) => mergePlan(plan, dbPlans.get(plan.id) || {}))
          .filter((plan) => !plan.isDeleted)
        const baseIds = new Set(basePlans.map((plan) => String(plan.id || '').trim()))
        const extraPlans = snapshot.docs
          .filter((docSnap) => !baseIds.has(docSnap.id) && !(dbPlans.get(docSnap.id)?.isDeleted === true))
          .map((docSnap) => normalizePlan({
            id: docSnap.id,
            label: dbPlans.get(docSnap.id)?.label || prettifyId(docSnap.id),
            name: dbPlans.get(docSnap.id)?.name || dbPlans.get(docSnap.id)?.label || prettifyId(docSnap.id),
            ...dbPlans.get(docSnap.id),
            features: Array.isArray(dbPlans.get(docSnap.id)?.features) ? dbPlans.get(docSnap.id).features : [''],
          }, { id: docSnap.id, localKey: docSnap.id }))

        plans.value = [...basePlans, ...extraPlans]
        planErrors.value = {}
      } catch (err) {
        console.error('Error loading subscription plans:', err)
        error.value = 'Failed to load subscription plans. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const addFeature = (plan) => {
      plan.features = Array.isArray(plan.features) ? [...plan.features, ''] : ['']
      clearPlanFieldError(plan, 'features')
    }

    const removeFeature = (plan, index) => {
      if (!Array.isArray(plan.features) || !plan.features.length) return
      if (plan.features.length === 1) {
        plan.features = ['']
      } else {
        plan.features.splice(index, 1)
      }
      clearPlanFieldError(plan, 'features')
    }

    const savePlan = async (plan) => {
      const key = planKey(plan)
      const validationErrors = validatePlan(plan)
      if (Object.keys(validationErrors).length) {
        planErrors.value = {
          ...planErrors.value,
          [key]: validationErrors,
        }
        error.value = 'Please fix the highlighted fields before saving.'
        return
      }

      savingId.value = key
      error.value = ''

      try {
        const cleanFeatures = plan.features
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0)
        const normalizedId = String(plan.id || '').trim()
        const normalizedLabel = String(plan.label || '').trim()
        const normalizedName = String(plan.name || '').trim()
        const normalizedBillingCycle = String(plan.billingCycle || '').trim()
        const normalizedDescription = String(plan.description || '').trim()
        const normalizedTrialDays = Math.max(0, Math.floor(Number(plan.trialDays || 0)))
        const isDraft = Boolean(plan.isDraft)

        const payload = {
          key: normalizedId,
          label: normalizedLabel,
          name: normalizedName || normalizedLabel,
          price: toNumber(plan.price),
          currency: 'PHP',
          currencyDisplay: 'code',
          billingCycle: normalizedBillingCycle,
          description: normalizedDescription,
          trialDays: plan.id === 'free' || isDraft ? normalizedTrialDays : Math.max(0, Math.floor(toNumber(plan.trialDays))),
          isActive: Boolean(plan.isActive),
          isDeleted: false,
          features: cleanFeatures,
          updatedAt: serverTimestamp(),
          createdAt: isDraft ? serverTimestamp() : undefined,
        }

        if (!payload.createdAt) {
          delete payload.createdAt
        }

        await setDoc(doc(db, 'subscriptionPlans', normalizedId), payload, { merge: true })
        plan.features = cleanFeatures
        plan.isDraft = false
        plan.localKey = normalizedId
        plan.label = normalizedLabel
        plan.name = normalizedName || normalizedLabel
        delete planErrors.value[key]

        await Swal.fire({
          title: 'Saved',
          text: `${plan.label} plan updated successfully.`,
          icon: 'success',
          timer: 1400,
          showConfirmButton: false,
        })
      } catch (err) {
        console.error('Error saving plan:', err)
        error.value = `Failed to save ${plan.label}. Please try again.`
      } finally {
        savingId.value = ''
      }
    }

    onMounted(loadPlans)

    return {
      loading,
      error,
      savingId,
      plans,
      loadPlans,
      addNewPlan: appendPlan,
      deletePlan,
      addFeature,
      removeFeature,
      savePlan,
      planKey,
      fieldError,
      featureError,
      clearPlanFieldError,
      clearPlanFeatureError,
      fieldClass: (plan, field) => {
        const hasError = Boolean(fieldError(plan, field))
        return hasError
          ? 'border border-rose-500/70 focus:border-rose-400'
          : 'border border-slate-700 focus:border-slate-500'
      },
      featureFieldClass: (plan, index) => {
        const hasError = Boolean(featureError(plan, index))
        return hasError
          ? 'border border-rose-500/70 focus:border-rose-400'
          : 'border border-slate-700 focus:border-slate-500'
      },
    }
  },
}
</script>

