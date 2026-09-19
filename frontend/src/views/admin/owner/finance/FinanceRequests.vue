<template>
  <div class="module-theme min-h-screen bg-slate-900">
    <OwnerSidebar />
    <main class="p-4 md:p-8">
      <div class="mx-auto max-w-6xl">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Finance</p>
        <h1 class="mt-2 text-3xl font-bold text-white">Approvals</h1>
        <p class="mt-2 max-w-2xl text-slate-400">Review procurement funding, listing financial terms, and payroll submissions from one place. Each queue keeps its own audit trail and permission boundary.</p>
        <div class="mt-8 grid gap-5 md:grid-cols-2">
          <RouterLink v-for="item in requestLinks" :key="item.to" :to="item.to" class="rounded-2xl border border-slate-700 bg-slate-800 p-6 transition hover:border-amber-400/60 hover:bg-slate-800/80">
            <h2 class="text-lg font-semibold text-white">{{ item.label }}</h2>
            <p class="mt-2 text-sm leading-6 text-slate-400">{{ item.description }}</p>
            <span class="mt-5 inline-block text-sm font-semibold text-amber-300">Open queue</span>
          </RouterLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
const requestLinks = [
  { label: 'Procurement approvals', to: '/finance/procurement/requests', description: 'Approve, return, or reject funding requests after reviewing the selected supplier, quotation, and available budget.' },
  { label: 'Listing approvals', to: '/finance/listing-approvals', description: 'Review the prices and payment terms of clinic product and service listings before they are published.' },
  { label: 'Payroll approvals', to: '/finance/payroll-approval', description: 'Review HR-prepared payroll summaries before payslips are finalized.' }
]
</script>
