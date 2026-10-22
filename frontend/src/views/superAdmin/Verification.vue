<template>
  <div class="module-theme flex min-h-screen bg-slate-900">
    <SuperAdminSidebar />
    <div class="min-w-0 flex-1 p-5 sm:p-8">
      <header class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">System administration</p>
        <h1 class="mt-1 text-3xl font-bold text-white">Verification</h1>
        <p class="mt-1 text-sm text-slate-400">Review clinic registrations and supplier businesses.</p>
      </header>

      <nav class="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-2" aria-label="Verification type">
        <button v-if="showClinic" type="button" class="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition" :class="activeTab === 'clinic' ? 'bg-amber-100 text-amber-950 shadow-sm' : 'text-slate-300 hover:bg-slate-700'" :aria-current="activeTab === 'clinic' ? 'page' : undefined" @click="selectTab('clinic')">Clinic Verification</button>
        <button v-if="showSupplier" type="button" class="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition" :class="activeTab === 'supplier' ? 'bg-amber-100 text-amber-950 shadow-sm' : 'text-slate-300 hover:bg-slate-700'" :aria-current="activeTab === 'supplier' ? 'page' : undefined" @click="selectTab('supplier')">Supplier Verification</button>
      </nav>

      <KeepAlive>
        <component :is="activeView" :embedded="true" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissions } from '@/composables/usePermissions'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import ClinicVerification from '@/views/superAdmin/ClinicVerification.vue'
import SupplierVerification from '@/views/superAdmin/SupplierVerification.vue'

const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermissions()
const showClinic = computed(() => hasPermission('system:clinics:verify'))
const showSupplier = computed(() => hasPermission('system:suppliers:verify') || hasPermission('system:suppliers:manage'))
const activeTab = ref(route.query.tab === 'supplier' && showSupplier.value ? 'supplier' : 'clinic')
const activeView = computed(() => activeTab.value === 'supplier' ? SupplierVerification : ClinicVerification)

const selectTab = async tab => {
  if (tab === 'clinic' && !showClinic.value) return
  if (tab === 'supplier' && !showSupplier.value) return
  activeTab.value = tab
  if (route.query.tab !== tab) await router.replace({ name: 'superadmin-verification', query: { ...route.query, tab } })
}

watch(() => route.query.tab, tab => {
  if (tab === 'supplier' && showSupplier.value) activeTab.value = 'supplier'
  else if (showClinic.value) activeTab.value = 'clinic'
  else if (showSupplier.value) activeTab.value = 'supplier'
}, { immediate: true })

watch([showClinic, showSupplier], ([clinicAllowed, supplierAllowed]) => {
  if (activeTab.value === 'clinic' && !clinicAllowed && supplierAllowed) selectTab('supplier')
  else if (activeTab.value === 'supplier' && !supplierAllowed && clinicAllowed) selectTab('clinic')
})
</script>
