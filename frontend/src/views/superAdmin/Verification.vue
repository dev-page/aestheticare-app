<template>
  <div class="module-theme flex min-h-screen bg-slate-900">
    <SuperAdminSidebar />
    <div class="min-w-0 flex-1 p-5 sm:p-8">
      <header class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">System administration</p>
        <h1 class="mt-1 text-3xl font-bold text-white">Verification</h1>
        <p class="mt-1 text-sm text-slate-400">Review clinic registrations.</p>
      </header>

      <ClinicVerification v-if="showClinic" embedded />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePermissions } from '@/composables/usePermissions'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import ClinicVerification from '@/views/superAdmin/ClinicVerification.vue'
const { hasPermission } = usePermissions()
const showClinic = computed(() => hasPermission('system:clinics:verify'))
</script>
