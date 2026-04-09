<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Setup Plans</h1>
          <p class="text-slate-400">Configure pricing, cycle, and features for each subscription plan.</p>
        </div>

        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          @click="loadPlans"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <article v-for="plan in plans" :key="plan.id" class="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 class="text-white font-semibold text-lg">{{ plan.label }}</h2>
              <p class="text-slate-400 text-xs">Plan ID: {{ plan.id }}</p>
            </div>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300">
              <input v-model="plan.isActive" type="checkbox" class="accent-emerald-500" />
              Active
            </label>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                v-model="plan.name"
                type="text"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                placeholder="Plan name"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Price (PHP)</label>
                <input
                  v-model.number="plan.price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label class="block text-xs text-slate-400 mb-1">Billing Cycle</label>
                <input
                  v-model="plan.billingCycle"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                  placeholder="month, year, one-time"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                v-model="plan.description"
                rows="2"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                placeholder="Short plan description"
              ></textarea>
            </div>

            <div v-if="plan.id === 'free'">
              <label class="block text-xs text-slate-400 mb-1">Trial Duration (days)</label>
              <input
                v-model.number="plan.trialDays"
                type="number"
                min="0"
                step="1"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
              />
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
                <div v-for="(feature, index) in plan.features" :key="`${plan.id}-feature-${index}`" class="flex gap-2">
                  <input
                    v-model="plan.features[index]"
                    type="text"
                    class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                    placeholder="Feature"
                  />
                  <button
                    type="button"
                    class="px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs"
                    @click="removeFeature(plan, index)"
                  >
                    Remove
                  </button>
                </div>

                <p v-if="!plan.features.length" class="text-xs text-slate-500">No features yet.</p>
              </div>
            </div>

            <button
              type="button"
              class="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              :disabled="savingId === plan.id"
              @click="savePlan(plan)"
            >
              {{ savingId === plan.id ? 'Saving...' : 'Save Plan' }}
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

export default {
  name: 'SuperAdminSubscriptionPlans',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const error = ref('')
    const savingId = ref('')
    const plans = ref(defaultPlans())

    const mergePlan = (basePlan, dbPlan = {}) => {
      return {
        ...basePlan,
        ...dbPlan,
        id: basePlan.id,
        label: basePlan.label,
        features: Array.isArray(dbPlan.features) ? dbPlan.features : basePlan.features,
      }
    }

    const loadPlans = async () => {
      loading.value = true
      error.value = ''

      try {
        const snapshot = await getDocs(collection(db, 'subscriptionPlans'))
        const dbPlans = new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()]))

        plans.value = defaultPlans().map((plan) => mergePlan(plan, dbPlans.get(plan.id) || {}))
      } catch (err) {
        console.error('Error loading subscription plans:', err)
        error.value = 'Failed to load subscription plans. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const addFeature = (plan) => {
      plan.features.push('')
    }

    const removeFeature = (plan, index) => {
      plan.features.splice(index, 1)
    }

    const savePlan = async (plan) => {
      savingId.value = plan.id
      error.value = ''

      try {
        const cleanFeatures = plan.features
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0)

        const payload = {
          key: plan.id,
          name: String(plan.name || '').trim() || plan.label,
          price: toNumber(plan.price),
          currency: 'PHP', currencyDisplay: 'code',
          billingCycle: String(plan.billingCycle || '').trim() || 'month',
          description: String(plan.description || '').trim(),
          trialDays: plan.id === 'free' ? 0 : Math.max(0, Math.floor(toNumber(plan.trialDays))),
          isActive: Boolean(plan.isActive),
          features: cleanFeatures,
          updatedAt: serverTimestamp(),
        }

        await setDoc(doc(db, 'subscriptionPlans', plan.id), payload, { merge: true })
        plan.features = cleanFeatures

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
      addFeature,
      removeFeature,
      savePlan,
    }
  },
}
</script>

