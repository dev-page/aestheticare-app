<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8">
      <div class="max-w-4xl">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">Module Access</h1>
          <p class="text-slate-400">Choose which modules the clinic owner wants visible and active in the panel.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <article
            v-for="moduleCard in moduleCards"
            :key="moduleCard.key"
            class="rounded-2xl border border-slate-700 bg-slate-800 p-6"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-xl font-semibold text-white">{{ moduleCard.label }}</h2>
                <p class="mt-2 text-sm text-slate-400">{{ moduleCard.description }}</p>
              </div>
              <button
                type="button"
                :class="[
                  'relative inline-flex h-7 w-14 items-center rounded-full transition-colors',
                  formModules[moduleCard.key] ? 'bg-emerald-500' : 'bg-slate-600'
                ]"
                @click="toggleModule(moduleCard.key)"
                :aria-pressed="formModules[moduleCard.key]"
              >
                <span
                  :class="[
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                    formModules[moduleCard.key] ? 'translate-x-8' : 'translate-x-1'
                  ]"
                />
              </button>
            </div>
          </article>
        </div>

        <div class="mt-8 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
            @click="resetModules"
          >
            Reset
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-500"
            @click="saveModules"
          >
            Save Modules
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { useOwnerModules } from '@/composables/useOwnerModules'

const { enabledModules, startOwnerModulesListener, saveOwnerModules, defaultModules } = useOwnerModules()

const formModules = ref({ ...defaultModules })

const moduleCards = computed(() => [
  { key: 'crm', label: 'CRM Module', description: 'Clients, appointments, POS, inbox, and transaction history.' },
  { key: 'clinic', label: 'Clinic Module', description: 'Clinical appointments, consultations, and practitioner activities.' },
  { key: 'operations', label: 'Operations Module', description: 'Orders, staff operations, catalog, suppliers, and purchase requests.' },
  { key: 'hr', label: 'HR Module', description: 'Employee records, attendance, payroll, and HR processing.' },
  { key: 'finance', label: 'Finance Module', description: 'Sales, reports, accounts payable, and payroll approvals.' },
])

watch(
  enabledModules,
  (value) => {
    formModules.value = { ...defaultModules, ...(value || {}) }
  },
  { immediate: true, deep: true }
)

const toggleModule = (key) => {
  formModules.value = {
    ...formModules.value,
    [key]: !formModules.value[key],
  }
}

const resetModules = () => {
  formModules.value = { ...enabledModules.value }
}

const saveModules = async () => {
  try {
    await saveOwnerModules(formModules.value)
    toast.success('Owner modules updated successfully.')
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Failed to save owner modules.')
  }
}

onMounted(async () => {
  await startOwnerModulesListener()
})
</script>
