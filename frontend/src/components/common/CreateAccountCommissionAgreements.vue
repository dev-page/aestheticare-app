<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  branchIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const form = reactive({
  approvedServiceIds: [...(props.modelValue.approvedServiceIds || [])],
  rates: (props.modelValue.rates || []).map(rate => ({ ...rate })),
})
const services = ref([])
const loading = ref(false)
const loadError = ref('')
let requestSequence = 0

watch(form, () => {
  emit('update:modelValue', {
    approvedServiceIds: [...form.approvedServiceIds],
    rates: form.rates.map(rate => ({ ...rate })),
  })
}, { deep: true })

watch(() => [...props.branchIds].filter(Boolean).sort().join('|'), async (branchKey) => {
  const sequence = ++requestSequence
  services.value = []
  loadError.value = ''
  loading.value = false
  const branchIds = branchKey.split('|').filter(Boolean)
  if (!branchIds.length) return

  loading.value = true
  try {
    const snapshots = await Promise.all(branchIds.map(branchId =>
      getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId)))
    ))
    if (sequence !== requestSequence) return
    const byId = new Map()
    for (const snapshot of snapshots) {
      for (const listingDoc of snapshot.docs) {
        const listing = { id: listingDoc.id, ...listingDoc.data() }
        if (listing.postType !== 'Product' && !listing.archived) byId.set(listing.id, listing)
      }
    }
    services.value = [...byId.values()]
  } catch (error) {
    if (sequence === requestSequence) loadError.value = error?.message || 'Service listings could not be loaded.'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}, { immediate: true })

const serviceOptions = computed(() => services.value.map(service => ({
  value: service.id,
  label: service.title || service.serviceName || service.consultationName || 'Untitled service',
})))

const validationError = computed(() => {
  for (let index = 0; index < form.rates.length; index += 1) {
    const rate = form.rates[index]
    const amount = Number(rate.amount)
    if (!['lead', 'assistant'].includes(rate.responsibility) || !['percent', 'fixed'].includes(rate.model)) return 'Choose a valid commission responsibility and type.'
    if (String(rate.amount ?? '').trim() === '' || !Number.isFinite(amount) || amount < 0 || (rate.model === 'percent' && amount > 100)) return 'Enter a valid commission rate. Percentages must be between 0 and 100.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveFrom || '') || (rate.effectiveUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveUntil) || rate.effectiveUntil < rate.effectiveFrom))) return 'Enter valid commission effective dates.'
    if (rate.serviceId && !form.approvedServiceIds.includes(rate.serviceId)) return 'Approve each specific service that has a commission rate.'
    for (let otherIndex = index + 1; otherIndex < form.rates.length; otherIndex += 1) {
      const other = form.rates[otherIndex]
      const rateEnd = rate.effectiveUntil || '9999-12-31'
      const otherEnd = other.effectiveUntil || '9999-12-31'
      if (rate.serviceId === other.serviceId && rate.responsibility === other.responsibility && rate.effectiveFrom <= otherEnd && other.effectiveFrom <= rateEnd) return 'Commission rates for the same service and responsibility cannot overlap.'
    }
  }
  return ''
})

defineExpose({ validationError })

const addRate = () => form.rates.push({
  serviceId: '',
  responsibility: 'lead',
  model: 'percent',
  amount: 0,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveUntil: '',
})
</script>

<template>
  <div class="mt-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 class="font-semibold text-slate-100">Service commissions</h4>
        <p class="mt-1 text-sm text-slate-400">Set the employee’s rate for completed services or consultations. These agreements use the same rules as Employee Compensation.</p>
      </div>
      <button type="button" class="rounded-lg border border-amber-500/50 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50" :disabled="loading || !services.length" @click="addRate">Add commission rate</button>
    </div>

    <p v-if="loading" class="mt-3 text-sm text-slate-400" role="status">Loading service listings…</p>
    <p v-else-if="loadError" class="mt-3 text-sm text-amber-200" role="status">{{ loadError }} Commission agreements can be added later in Employee Compensation.</p>
    <p v-else-if="!services.length" class="mt-3 text-sm text-slate-400">Create a service or consultation listing first. Commission agreements can be added later.</p>

    <div v-if="services.length" class="mt-4">
      <h5 class="text-sm font-medium text-slate-200">Services this practitioner may perform</h5>
      <div class="mt-2 grid gap-2 sm:grid-cols-2">
        <label v-for="service in services" :key="service.id" class="flex items-start gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">
          <input v-model="form.approvedServiceIds" type="checkbox" :value="service.id" class="mt-0.5 accent-amber-600" />
          <span>{{ service.title || service.serviceName || service.consultationName || 'Untitled service' }}</span>
        </label>
      </div>
      <p class="mt-2 text-xs text-slate-500">A practitioner must be approved for a service before they can be assigned to perform it.</p>
    </div>

    <p v-if="validationError" class="mt-3 text-sm text-rose-300" role="alert">{{ validationError }}</p>

    <div v-for="(rate, index) in form.rates" :key="index" class="mt-3 grid gap-3 rounded-lg border border-slate-700 p-3 sm:grid-cols-2">
      <ContractAppearanceSelect :id="`new-staff-commission-service-${index}`" v-model="rate.serviceId" label="Service" :options="[{ value: '', label: 'All approved services' }, ...serviceOptions]" />
      <ContractAppearanceSelect :id="`new-staff-commission-responsibility-${index}`" v-model="rate.responsibility" label="Responsibility" :options="[{ value: 'lead', label: 'Lead' }, { value: 'assistant', label: 'Assistant' }]" />
      <ContractAppearanceSelect :id="`new-staff-commission-model-${index}`" v-model="rate.model" label="Commission type" :options="[{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed fee (PHP)' }]" />
      <label class="block text-sm font-medium text-slate-300">Rate
        <input v-model.number="rate.amount" type="number" min="0" :max="rate.model === 'percent' ? 100 : undefined" step="0.01" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      </label>
      <label class="block text-sm font-medium text-slate-300">Effective from
        <input v-model="rate.effectiveFrom" type="date" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      </label>
      <label class="block text-sm font-medium text-slate-300">Effective until (optional)
        <input v-model="rate.effectiveUntil" type="date" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      </label>
      <button type="button" class="justify-self-start rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10 sm:col-span-2" @click="form.rates.splice(index, 1)">Remove rate</button>
    </div>
  </div>
</template>
