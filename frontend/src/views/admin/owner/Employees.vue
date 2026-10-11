<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import StaffProfile from './StaffProfile.vue'
import AddStaff from './AddStaff.vue'
import ArchivedEmployees from './ArchivedEmployees.vue'
import { usePermissions } from '@/composables/usePermissions'

const route = useRoute()
const { hasPermission } = usePermissions()
const canView = computed(() => hasPermission('staff:view'))
const canCreate = computed(() => hasPermission('staff:create'))
const activeTab = computed(() => {
  if (route.path.endsWith('/archived')) return 'archived'
  if (route.path.endsWith('/new') || (!canView.value && canCreate.value)) return 'create'
  return 'profiles'
})
const tabs = computed(() => [
  { key: 'profiles', label: 'Employee Profiles', to: '/hr/employees', allowed: canView.value },
  { key: 'create', label: 'Create Account', to: '/hr/employees/new', allowed: canCreate.value },
  { key: 'archived', label: 'Archived Accounts', to: '/hr/employees/archived', allowed: canView.value },
])
</script>

<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white">Employee Management</h1>
      <p class="mt-2 text-sm text-slate-400">Manage employee profiles, create accounts, and restore archived accounts.</p>
      <nav class="employee-tabs" aria-label="Employee management tabs">
        <template v-for="tab in tabs" :key="tab.key">
          <router-link v-if="tab.allowed" :to="tab.to" class="employee-tab" :class="{ 'is-active': activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">{{ tab.label }}</router-link>
          <span v-else class="employee-tab is-disabled" aria-disabled="true" title="You do not have permission to access this tab.">{{ tab.label }}</span>
        </template>
      </nav>
      <StaffProfile v-if="activeTab === 'profiles' && canView" embedded />
      <AddStaff v-else-if="activeTab === 'create' && canCreate" embedded />
      <ArchivedEmployees v-else-if="activeTab === 'archived' && canView" embedded />
      <p v-else class="text-sm text-slate-400">You do not have access to this tab.</p>
    </main>
  </div>
</template>

<style scoped>
.employee-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.employee-tab { flex-shrink: 0; padding: 12px 18px; border-bottom: 3px solid transparent; color: #a58a73; font-size: 14px; font-weight: 600; transition: color 150ms, border-color 150ms; }
.employee-tab:hover { color: #91643f; }
.employee-tab.is-active { color: #91643f; border-bottom-color: #b78055; }
.employee-tab.is-disabled { opacity: 0.5; cursor: not-allowed; }
.employee-tab:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
</style>
