<script setup>
import { usePageLoading } from '@/composables/usePageLoading'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import StaffEarningsManagement from '@/components/common/StaffEarningsManagement.vue'
const { pageLoading } = usePageLoading()
</script>
<template><div class="module-theme finance-page flex min-h-screen"><OwnerSidebar /><main v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5 }" class="min-w-0 flex-1 p-4 md:p-8"><StaffEarningsManagement @loading="pageLoading = $event" /></main></div></template>
