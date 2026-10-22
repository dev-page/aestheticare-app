<template><div v-if="!embedded" class="module-theme flex min-h-screen bg-slate-900"><SuperAdminSidebar/><main class="min-w-0 flex-1 p-8"><SupplierVerificationPanel reviewer/></main></div><SupplierVerificationPanel v-else reviewer/></template>
<script setup>
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import SupplierVerificationPanel from '@/components/SupplierVerificationPanel.vue'
defineProps({ embedded: { type: Boolean, default: false } })
</script>
