<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import AddShift from './AddShift.vue'
import ScheduleAssignment from './ScheduleAssignment.vue'
import { usePermissions } from '@/composables/usePermissions'

const route = useRoute()
const { hasPermission } = usePermissions()
const canAdd = computed(() => hasPermission('hr:create'))
const canAssign = computed(() => hasPermission('hr:update'))
const activeTab = computed(() => {
  if (route.query.tab === 'assignment') return 'assignment'
  if (route.query.tab === 'add') return 'add'
  return !canAdd.value && canAssign.value ? 'assignment' : 'add'
})
const tabs = computed(() => [
  { key: 'add', label: 'Add Shift', to: { path: '/hr/shifts', query: { tab: 'add' } }, allowed: canAdd.value },
  { key: 'assignment', label: 'Shift Assignment', to: { path: '/hr/shifts', query: { tab: 'assignment' } }, allowed: canAssign.value },
])
</script>

<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white">Shift Management</h1>
      <p class="mt-2 text-sm text-slate-400">Create shift templates and assign recurring schedules to your employees.</p>
      <nav class="shift-tabs" aria-label="Shift management tabs">
        <template v-for="tab in tabs" :key="tab.key">
          <router-link v-if="tab.allowed" :to="tab.to" class="shift-tab" :class="{ 'is-active': activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">{{ tab.label }}</router-link>
          <span v-else class="shift-tab is-disabled" aria-disabled="true" title="You do not have permission to access this tab.">{{ tab.label }}</span>
        </template>
      </nav>
      <AddShift v-if="activeTab === 'add' && canAdd" embedded />
      <ScheduleAssignment v-else-if="activeTab === 'assignment' && canAssign" embedded />
      <p v-else class="text-sm text-slate-400">You do not have access to this tab.</p>
    </main>
  </div>
</template>

<style scoped>
.shift-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.shift-tab { flex-shrink: 0; padding: 12px 18px; border-bottom: 3px solid transparent; color: #a58a73; font-size: 14px; font-weight: 600; transition: color 150ms, border-color 150ms; }
.shift-tab:hover { color: #91643f; }
.shift-tab.is-active { color: #91643f; border-bottom-color: #b78055; }
.shift-tab.is-disabled { opacity: 0.5; cursor: not-allowed; }
.shift-tab:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
</style>
