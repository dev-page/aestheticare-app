<template>
  <div class="flex module-theme min-h-screen bg-[#fbf5eb]">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'cards', cardStyle: 'plan', cards: 3 }" class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="mb-2 text-3xl font-bold text-[#4b3324]">Setup Plans</h1>
          <p class="text-[#8a725f]">Configure pricing, cycle, and features for each subscription plan.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-[#d9bea1] bg-[#fffaf3] px-4 py-2 text-[#684b35] transition hover:bg-[#f2e5d4]"
            :disabled="loading"
            @click="addNewPlan"
          >
            + Add New Plan
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-[#d9bea1] bg-[#fffaf3] px-4 py-2 text-[#684b35] transition hover:bg-[#f2e5d4]"
            :disabled="loading"
            @click="loadPlans"
          >
            <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 rounded-lg border border-[#c7a17d] bg-[#f6eadb] px-3 py-2 text-sm text-[#704d37]">{{ error }}</p>

      <section class="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <article
          v-for="plan in plans"
          :key="plan.localKey || plan.id"
          :ref="(element) => setPlanCardRef(plan, element)"
          class="min-w-0 scroll-mt-6 rounded-xl border border-[#e5d2bb] bg-[#fffdf9] p-4 shadow-sm sm:p-6"
          :class="{ '2xl:col-span-2': plan.isDraft }"
        >
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-lg font-semibold text-[#4b3324]">{{ plan.isDraft ? (plan.label || 'New Plan') : plan.label }}</h2>
                <span
                  v-if="plan.isDraft"
                  class="inline-flex items-center rounded-full border border-[#d9bea1] bg-[#f6eadb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#76563d]"
                >
                  New
                </span>
              </div>
              <p class="text-xs text-[#8a725f]">Plan ID: {{ plan.id || 'Pending' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <label class="inline-flex items-center gap-2 text-xs text-[#765f4b]">
                <input
                  v-model="plan.isActive"
                  type="checkbox"
                  class="accent-[#806044]"
                  @change="clearPlanFieldError(plan, 'isActive')"
                />
                Active
              </label>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9bea1] text-[#76563d] transition hover:bg-[#f2e5d4] disabled:cursor-not-allowed disabled:opacity-40"
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
              <label class="mb-1 block text-xs text-[#765f4b]">Plan ID</label>
              <input
                v-model="plan.id"
                type="text"
                class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                :class="fieldClass(plan, 'id')"
                placeholder="e.g. standard"
                @input="clearPlanFieldError(plan, 'id')"
              />
              <p v-if="fieldError(plan, 'id')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'id') }}</p>
              <p class="mt-1 text-[11px] text-[#9b846e]">Use lowercase letters, numbers, and hyphens only.</p>
            </div>

            <div v-if="plan.isDraft">
              <label class="mb-1 block text-xs text-[#765f4b]">Plan Label</label>
              <input
                v-model="plan.label"
                type="text"
                class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                :class="fieldClass(plan, 'label')"
                placeholder="Visible card title"
                @input="clearPlanFieldError(plan, 'label')"
              />
              <p v-if="fieldError(plan, 'label')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'label') }}</p>
            </div>

            <div>
              <label class="mb-1 block text-xs text-[#765f4b]">Display Name</label>
              <input
                v-model="plan.name"
                type="text"
                class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                :class="fieldClass(plan, 'name')"
                placeholder="Plan name"
                @input="clearPlanFieldError(plan, 'name')"
              />
              <p v-if="fieldError(plan, 'name')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'name') }}</p>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs text-[#765f4b]">Price (PHP)</label>
                <input
                  v-model="plan.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                  :class="fieldClass(plan, 'price')"
                  @input="clearPlanFieldError(plan, 'price')"
                />
                <p v-if="fieldError(plan, 'price')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'price') }}</p>
              </div>

              <div>
                <label class="mb-1 block text-xs text-[#765f4b]">Billing Cycle</label>
                <select
                  v-model="plan.billingCycle"
                  class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                  :class="fieldClass(plan, 'billingCycle')"
                  @change="clearPlanFieldError(plan, 'billingCycle')"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="one-time">One-time</option>
                </select>
                <p v-if="fieldError(plan, 'billingCycle')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'billingCycle') }}</p>
              </div>
            </div>

            <div v-if="plan.id !== 'free' && Number(plan.price) > 0" class="rounded-lg border border-[#e5d2bb] bg-[#fbf5eb] p-3">
              <label class="inline-flex items-center gap-2 text-sm font-medium text-[#5c4230]">
                <input v-model="plan.freeTrialEnabled" type="checkbox" class="accent-[#806044]" />
                Offer a free trial for this plan
              </label>
              <div v-if="plan.freeTrialEnabled" class="mt-3">
                <label class="mb-1 block text-xs text-[#765f4b]">Trial length (days)</label>
                <input v-model="plan.trialDays" type="number" min="1" max="365" step="1" class="w-full rounded-lg bg-[#fffdf9] px-3 py-2 text-[#4b3324]" :class="fieldClass(plan, 'trialDays')" @input="clearPlanFieldError(plan, 'trialDays')" />
                <p v-if="fieldError(plan, 'trialDays')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'trialDays') }}</p>
              </div>
              <p class="mt-2 text-xs text-[#8a725f]">Each clinic can use one paid-plan trial once. No charge is collected during the trial; when it ends, the clinic returns to Free. A later purchase uses this plan’s normal price.</p>
            </div>

            <div>
              <label class="mb-1 block text-xs text-[#765f4b]">Description</label>
              <textarea
                v-model="plan.description"
                rows="2"
                class="w-full rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                :class="fieldClass(plan, 'description')"
                placeholder="Short plan description"
                @input="clearPlanFieldError(plan, 'description')"
              ></textarea>
              <p v-if="fieldError(plan, 'description')" class="mt-1 text-xs text-[#76563d]">{{ fieldError(plan, 'description') }}</p>
            </div>

            <p v-if="plan.id === 'free'" class="text-sm text-[#8a725f]">Free is permanent and has no expiry. Free trials are configured separately on paid plans.</p>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs text-[#765f4b]">Features</label>
                <button
                  type="button"
                  class="text-xs text-[#76563d] hover:text-[#4b3324]"
                  @click="addFeature(plan)"
                >
                  + Add feature
                </button>
              </div>

              <div class="space-y-2">
                <div v-for="(feature, index) in plan.features" :key="`${plan.localKey || plan.id}-feature-${index}`" class="space-y-1">
                  <div class="flex min-w-0 gap-2">
                    <input
                      v-model="plan.features[index]"
                      type="text"
                      class="min-w-0 flex-1 rounded-lg bg-[#fffaf3] px-3 py-2 text-[#4b3324] focus:outline-none"
                      :class="featureFieldClass(plan, index)"
                      placeholder="Feature"
                      @input="clearPlanFeatureError(plan, index)"
                    />
                    <button
                      type="button"
                      class="rounded-lg border border-[#c7a17d] bg-[#f3e6d5] px-3 py-2 text-xs text-[#684b35] transition hover:bg-[#ead7c1]"
                      @click="removeFeature(plan, index)"
                    >
                      Remove
                    </button>
                  </div>
                  <p v-if="featureError(plan, index)" class="text-xs text-[#76563d]">{{ featureError(plan, index) }}</p>
                </div>

                <p v-if="!plan.features.length" class="text-xs text-[#9b846e]">No features yet.</p>
                <p v-if="fieldError(plan, 'features')" class="text-xs text-[#76563d]">{{ fieldError(plan, 'features') }}</p>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5a3d2b] px-4 py-2 text-sm font-semibold text-[#fffaf3] transition hover:bg-[#704d37] disabled:cursor-wait disabled:opacity-70"
              :disabled="Boolean(savingId)"
              :aria-busy="savingId === (plan.localKey || plan.id)"
              @click="savePlan(plan)"
            >
              <svg v-if="savingId === (plan.localKey || plan.id)" aria-hidden="true" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{{ savingId === (plan.localKey || plan.id) ? (plan.isDraft ? 'Creating plan...' : 'Saving plan...') : (plan.isDraft ? 'Create Plan' : 'Save Plan') }}</span>
            </button>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
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
    freeTrialEnabled: false,
    isActive: true,
    features: ['One branch', 'Service listings and online bookings', 'Create employee accounts', 'Upgrade anytime'],
  },
  {
    id: 'basic',
    label: 'Basic',
    name: 'Basic',
    price: 499,
    billingCycle: 'month',
    description: 'Essential tools for daily clinic operations.',
    trialDays: 0,
    freeTrialEnabled: false,
    isActive: true,
    features: ['Scheduling, POS & payments', 'Inventory, procurement & reports', 'Staff account management', 'Single-branch operations'],
  },
  {
    id: 'premium',
    label: 'Premium',
    name: 'Premium',
    price: 999,
    billingCycle: 'month',
    description: 'Advanced features and priority support.',
    trialDays: 14,
    freeTrialEnabled: true,
    isActive: true,
    features: ['Everything in Basic', 'Multi-branch operations', 'HR, attendance & payroll', 'Advanced reports & priority support'],
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
  freeTrialEnabled: false,
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
  freeTrialEnabled: Boolean(plan.freeTrialEnabled ?? fallback.freeTrialEnabled ?? false),
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
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const loading = ref(false)
    const error = ref('')
    const savingId = ref('')
    const plans = ref(defaultPlans())
    const planErrors = ref({})
    const planCardElements = new Map()

    const setPlanCardRef = (plan, element) => {
      const key = String(plan?.localKey || plan?.id || '').trim()
      if (!key) return
      if (element) planCardElements.set(key, element)
      else planCardElements.delete(key)
    }

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

      if (plan.id !== 'free' && Number(plan.price) > 0 && plan.freeTrialEnabled) {
        const days = Number(plan.trialDays)
        if (!Number.isInteger(days) || days < 1 || days > 365) errors.trialDays = 'Enter a whole number from 1 to 365 days.'
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

    const appendPlan = async () => {
      const draft = createDraftPlan()
      plans.value = [...plans.value, draft]
      await nextTick()
      planCardElements.get(planKey(draft))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const deletePlan = async (plan) => {
      const key = planKey(plan)
      const planLabel = String(plan.label || plan.name || plan.id || 'this plan').trim()

      const confirmation = await systemAdminSwal.fire({
        title: plan.isDraft ? 'Discard this draft?' : 'Delete this plan?',
        text: plan.isDraft
          ? 'This draft will be removed from the page.'
          : `This will hide ${planLabel} from the plan list and mark it as deleted.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: plan.isDraft ? 'Discard' : 'Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#6b4b34',
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

        await systemAdminSwal.fire({
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
    let unsubscribePlans = null

    const loadPlans = () => {
      if (unsubscribePlans) unsubscribePlans()
      loading.value = true
      error.value = ''
      unsubscribePlans = pageListener(onSnapshot, collection(db, 'subscriptionPlans'), (snapshot) => {
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
        loading.value = false
      }, (err) => {
        console.error('Error loading subscription plans:', err)
        error.value = 'Failed to load subscription plans. Please try again.'
        loading.value = false
      })
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
          trialDays: normalizedId !== 'free' && Number(plan.price) > 0 && plan.freeTrialEnabled ? Number(plan.trialDays) : 0,
          freeTrialEnabled: normalizedId !== 'free' && Number(plan.price) > 0 && Boolean(plan.freeTrialEnabled),
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

        await systemAdminSwal.fire({
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
    onUnmounted(() => unsubscribePlans?.())

    return {
      pageLoading,
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
      setPlanCardRef,
      fieldError,
      featureError,
      clearPlanFieldError,
      clearPlanFeatureError,
      fieldClass: (plan, field) => {
        const hasError = Boolean(fieldError(plan, field))
        return hasError
          ? 'border border-[#9a7656] bg-[#f6eadb] focus:border-[#76563d]'
          : 'border border-[#e2cbb0] focus:border-[#9a7656]'
      },
      featureFieldClass: (plan, index) => {
        const hasError = Boolean(featureError(plan, index))
        return hasError
          ? 'border border-[#9a7656] bg-[#f6eadb] focus:border-[#76563d]'
          : 'border border-[#e2cbb0] focus:border-[#9a7656]'
      },
    }
  },
}
</script>

