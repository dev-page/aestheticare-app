<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import AppointmentRecords from './AppointmentRecords.vue'
import AppointmentRequestApprovals from './AppointmentRequestApprovals.vue'
import PractitionerAppointments from '../clinic/PractitionerAppointments.vue'
import PractitionerOnlineConsultation from '../clinic/PractitionerOnlineConsultation.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import { auth, db } from '@/config/firebaseConfig'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
const route = useRoute()
const { hasPermission } = usePermissions()
const { hasFeature } = useSubscription()
const branches = ref([]), branchId = ref(''), branchError = ref(''), scopeReady = ref(false)
onMounted(async () => {
  try {
    const scope = await loadOwnerBranchScope(db, auth.currentUser?.uid)
    branches.value = await loadClinicDocsByIds(db, scope.branchIds)
    branchId.value = branches.value.find(branch => branch.id === scope.branchId)?.id || branches.value[0]?.id || ''
  } catch (cause) { branchError.value = cause.message || 'Unable to load clinic branches.' }
  finally { scopeReady.value = true }
})
const canView = computed(() => hasPermission('appointments:view') || hasPermission('appointments:update'))
const canReview = computed(() => hasPermission('appointments:review'))
// Existing paid consultations remain available after returning to Free.
const canOnline = computed(() => hasPermission('consultations:view'))
const canQueue = computed(() => canView.value || canOnline.value)
const onlineMode = computed(() => route.query.mode === 'online' || (!canView.value && canOnline.value))
const activeTab = computed(() => route.query.tab === 'requests' ? 'requests' : route.query.tab === 'queue' ? 'queue' : canView.value ? 'all' : canReview.value ? 'requests' : 'queue')
const tabs = computed(() => [
  { key: 'all', label: 'All Appointments', allowed: canView.value },
  { key: 'requests', label: 'Online Booking Requests', allowed: canReview.value },
  { key: 'queue', label: 'Service Queue', allowed: canQueue.value },
])
</script>
<template>
  <div class="flex owner-theme min-h-screen bg-slate-900">
    <OwnerSidebar />
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white">Appointment Management</h1>
      <p class="mt-2 text-sm text-slate-400">Manage walk-ins, online bookings, requests, and your service queue.</p>
      <nav class="appointment-tabs" aria-label="Appointment management tabs">
        <template v-for="tab in tabs" :key="tab.key">
          <router-link v-if="tab.allowed" :to="{ path: '/crm/appointments', query: { tab: tab.key } }" class="appointment-tab" :class="{ 'is-active': activeTab === tab.key }" :aria-current="activeTab === tab.key ? 'page' : undefined">{{ tab.label }}</router-link>
          <span v-else class="appointment-tab is-disabled" aria-disabled="true">{{ tab.label }}</span>
        </template>
      </nav>
      <AppointmentRecords v-if="activeTab === 'all' && canView" />
      <div v-if="activeTab !== 'all' && branches.length > 1" class="mb-5">
        <label for="appointment-branch" class="text-sm text-slate-400">Clinic branch</label>
        <select id="appointment-branch" v-model="branchId" class="mt-2 block w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.clinicBranch || branch.clinicName || branch.id }}</option></select>
      </div>
      <AppointmentRequestApprovals v-if="activeTab === 'requests' && canReview && scopeReady && branchId" :key="`requests-${branchId}`" :branch-id="branchId" embedded />
      <section v-else-if="activeTab === 'queue' && canQueue && scopeReady && branchId">
        <div v-if="canView && canOnline" class="mb-5 flex flex-wrap gap-3">
          <router-link :to="{ path: '/crm/appointments', query: { tab: 'queue' } }" class="appointment-tab" :class="{ 'is-active': !onlineMode }">Service Queue</router-link>
          <router-link :to="{ path: '/crm/appointments', query: { tab: 'queue', mode: 'online' } }" class="appointment-tab" :class="{ 'is-active': onlineMode }">Online Consultations</router-link>
        </div>
        <PractitionerOnlineConsultation v-if="onlineMode && canOnline" :key="`online-${branchId}`" :branch-id="branchId" :existing-only="!hasFeature('online_consultations')" embedded />
        <PractitionerAppointments v-else-if="!onlineMode && canView" :key="`queue-${branchId}`" :branch-id="branchId" embedded />
        <p v-else class="text-sm text-slate-400">You do not have access to online consultations.</p>
      </section>
      <p v-else-if="activeTab !== 'all' && !scopeReady" class="text-sm text-slate-400" role="status">Loading clinic branches…</p>
      <p v-else-if="activeTab !== 'all' && !branchId" class="text-sm text-slate-400">{{ branchError || 'No clinic branch is linked to your account.' }}</p>
      <p v-else-if="(activeTab === 'requests' && !canReview) || (activeTab === 'queue' && !canQueue)" class="text-sm text-slate-400">You do not have permission to access this tab.</p>
    </main>
  </div>
</template>
<style scoped>
.appointment-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.appointment-tab { flex-shrink: 0; padding: 12px 18px; border-bottom: 3px solid transparent; color: #a58a73; font-size: 14px; font-weight: 600; }
.appointment-tab:hover, .appointment-tab.is-active { color: #91643f; }
.appointment-tab.is-active { border-bottom-color: #b78055; }
.appointment-tab.is-disabled { opacity: .5; cursor: not-allowed; }
.appointment-tab:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
</style>
