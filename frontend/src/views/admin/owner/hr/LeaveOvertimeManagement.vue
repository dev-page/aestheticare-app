<template>
  <div class="flex min-h-screen flex-row owner-theme bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
      <div class="mx-auto max-w-7xl">
        <header class="mb-6">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Human Resource</p>
          <h1 class="mt-2 text-3xl font-bold">Overtime &amp; Leave Management</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">Review clinic leave and overtime requests from one place.</p>
        </header>

        <nav class="mb-6 flex flex-wrap gap-2 border-b border-slate-700" role="tablist" aria-label="Leave and overtime management">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :class="['rounded-t-xl px-4 py-3 text-sm font-semibold transition', activeTab === tab.key ? 'border-b-2 border-amber-400 text-amber-200' : 'text-slate-400 hover:text-white']"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </nav>

        <LeaveManagement v-if="activeTab === 'leave'" embedded />
        <Overtime v-else embedded />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import LeaveManagement from '@/views/admin/owner/hr/LeaveManagement.vue'
import Overtime from '@/views/admin/owner/hr/Overtime.vue'

const activeTab = ref('leave')
const tabs = [
  { key: 'leave', label: 'Leave Requests' },
  { key: 'overtime', label: 'Overtime Requests' },
]
</script>
