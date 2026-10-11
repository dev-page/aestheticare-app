<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import BranchInfo from './BranchInfo.vue'
import AddBranch from './AddBranch.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'

const route = useRoute()
const { hasPermission } = usePermissions()
const { hasFeature } = useSubscription()
const canView = computed(() => hasPermission('branches:view'))
const canAdd = computed(() => hasPermission('branches:create') && hasFeature('multi_branch'))
const activeTab = computed(() => route.path.endsWith('/new') || (!canView.value && canAdd.value) ? 'add' : 'information')
</script>

<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white">Branch Management</h1>
      <p class="mt-2 text-sm text-slate-400">View your branch information or add a new clinic location.</p>
      <nav class="branch-tabs" aria-label="Branch management tabs">
        <router-link v-if="canView" to="/clinic/branches" class="branch-tab" :class="{ 'is-active': activeTab === 'information' }" :aria-current="activeTab === 'information' ? 'page' : undefined">Branch Information</router-link>
        <span v-else class="branch-tab is-disabled" aria-disabled="true">Branch Information</span>
        <router-link v-if="canAdd" to="/clinic/branches/new" class="branch-tab" :class="{ 'is-active': activeTab === 'add' }" :aria-current="activeTab === 'add' ? 'page' : undefined">Add Branch</router-link>
        <span v-else class="branch-tab is-disabled" aria-disabled="true" :title="hasPermission('branches:create') ? 'Your subscription does not include multiple branches.' : 'You do not have permission to add branches.'">Add Branch</span>
      </nav>
      <BranchInfo v-if="activeTab === 'information' && canView" embedded />
      <AddBranch v-else-if="activeTab === 'add' && canAdd" embedded />
      <p v-else class="mt-6 text-sm text-slate-400">You do not have access to this tab.</p>
    </main>
  </div>
</template>

<style scoped>
.branch-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; }
.branch-tab { padding: 12px 18px; border-bottom: 3px solid transparent; color: #a58a73; font-size: 14px; font-weight: 600; transition: color 150ms, border-color 150ms; }
.branch-tab:hover { color: #91643f; }
.branch-tab.is-active { color: #91643f; border-bottom-color: #b78055; }
.branch-tab.is-disabled { opacity: 0.5; cursor: not-allowed; }
.branch-tab:focus-visible { outline: 2px solid #b78055; outline-offset: 3px; }
</style>
