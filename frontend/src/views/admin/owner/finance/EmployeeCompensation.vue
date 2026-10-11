<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import BasePay from '../hr/BasePay.vue'
import StaffEarningsManagement from '@/components/common/StaffEarningsManagement.vue'
import { usePermissions } from '@/composables/usePermissions'
import { usePageLoading } from '@/composables/usePageLoading'
const route = useRoute()
const { pageLoading } = usePageLoading()
const { hasPermission } = usePermissions()
const canSetBasePay = computed(() => hasPermission('payroll:update'))
const canViewFees = computed(() => hasPermission('payroll:view'))
const activeTab = computed(() => {
  if (['base-pay', 'service-fees'].includes(route.query.tab)) return route.query.tab
  return canSetBasePay.value ? 'base-pay' : 'service-fees'
})
const tabs = computed(() => [
  { key: 'base-pay', label: 'Base Pay', allowed: canSetBasePay.value },
  { key: 'service-fees', label: 'Service Commission & Fees', allowed: canViewFees.value },
])
</script>

<template>
  <div class="module-theme finance-page flex min-h-screen">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold">Employee Compensation</h1>
      <p class="mt-2 text-sm text-slate-400">Manage employee base pay and service earnings. Payroll preparation and approval remain separate.</p>
      <nav class="compensation-tabs" aria-label="Employee compensation tabs">
        <template v-for="tab in tabs" :key="tab.key">
          <router-link v-if="tab.allowed" :to="{ path: '/finance/employee-compensation', query: { tab: tab.key } }" class="compensation-tab" :class="{ 'is-active': activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">{{ tab.label }}</router-link>
          <span v-else class="compensation-tab is-disabled" aria-disabled="true">{{ tab.label }}</span>
        </template>
      </nav>
      <BasePay v-if="activeTab === 'base-pay' && canSetBasePay" embedded />
      <section v-else-if="activeTab === 'service-fees' && canViewFees" v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5 }"><StaffEarningsManagement @loading="pageLoading = $event" /></section>
      <p v-else class="text-sm text-slate-400">You do not have permission to access this tab.</p>
    </main>
  </div>
</template>

<style scoped>
.compensation-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.compensation-tab { flex-shrink: 0; padding: 12px 18px; border-bottom: 3px solid transparent; color: #765d4c; font-size: 14px; font-weight: 600; }
.compensation-tab:hover { color: #91643f; }
.compensation-tab.is-active { color: #91643f; border-bottom-color: #b78055; }
.compensation-tab.is-disabled { opacity: .5; cursor: not-allowed; }
.compensation-tab:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
</style>
