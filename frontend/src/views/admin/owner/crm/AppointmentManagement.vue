<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import AppointmentRecords from './AppointmentRecords.vue'
import AppointmentRequestApprovals from './AppointmentRequestApprovals.vue'
import PractitionerAppointments from '../clinic/PractitionerAppointments.vue'
import PractitionerOnlineConsultation from '../clinic/PractitionerOnlineConsultation.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import { auth, db } from '@/config/firebaseConfig'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import { resolveAppointmentBranchQuery, resolveAppointmentManagementState } from '@/utils/appointmentManagementNavigation'
const route = useRoute()
const router = useRouter()
const { hasPermission } = usePermissions()
const { hasFeature } = useSubscription()
const branches = ref([]), branchId = ref(''), branchError = ref(''), scopeReady = ref(false), requestPendingCount = ref(null)
const branchSelectionTouched = ref(false)
const selectLinkedBranch = () => {
  const requestedId = String(route.query.branchId || '')
  if (branches.value.some(branch => branch.id === requestedId)) branchId.value = requestedId
}
const navigationQuery = (patch = {}) => {
  const query = { ...route.query, ...patch }
  if (!Object.prototype.hasOwnProperty.call(patch, 'view')) delete query.view
  if (!Object.prototype.hasOwnProperty.call(patch, 'mode')) delete query.mode
  const selectedBranch = resolveAppointmentBranchQuery({
    queryBranchId: route.query.branchId,
    selectedBranchId: branchId.value,
    selectionTouched: branchSelectionTouched.value,
  })
  if (selectedBranch) query.branchId = selectedBranch
  else delete query.branchId
  return query
}
const syncSelectedBranch = () => {
  branchSelectionTouched.value = true
  const selectedBranch = resolveAppointmentBranchQuery({
    queryBranchId: route.query.branchId,
    selectedBranchId: branchId.value,
    selectionTouched: true,
  })
  if (selectedBranch === String(route.query.branchId || '')) return
  router.replace({ path: route.path, query: { ...route.query, branchId: selectedBranch } })
}
watch(() => route.query.branchId, selectLinkedBranch)
watch(branchId, () => { requestPendingCount.value = null })
onMounted(async () => {
  try {
    const scope = await loadOwnerBranchScope(db, auth.currentUser?.uid)
    branches.value = await loadClinicDocsByIds(db, scope.branchIds)
    branchId.value = branches.value.find(branch => branch.id === scope.branchId)?.id || branches.value[0]?.id || ''
    selectLinkedBranch()
  } catch (cause) { branchError.value = cause.message || 'Unable to load clinic branches.' }
  finally { scopeReady.value = true }
})
const canView = computed(() => hasPermission('appointments:view') || hasPermission('appointments:update'))
const canReview = computed(() => hasPermission('appointments:review'))
// Subscription expiry controls operational access; it never downgrades the clinic to another plan.
const canOnline = computed(() => hasPermission('consultations:view'))
const canQueue = computed(() => canView.value || canOnline.value)
const pageState = computed(() => resolveAppointmentManagementState({
  query: route.query,
  canView: canView.value,
  canReview: canReview.value,
  canOnline: canOnline.value,
  canQueue: canQueue.value,
}))
const activeTab = computed(() => pageState.value.activeTab)
const appointmentView = computed(() => pageState.value.appointmentView)
const onlineMode = computed(() => pageState.value.onlineMode)
const canAppointments = computed(() => canView.value || canReview.value)
const needsBranch = computed(() => activeTab.value === 'queue' || (activeTab.value === 'appointments' && appointmentView.value === 'review'))
const allAppointmentsActive = computed(() => activeTab.value === 'appointments' && appointmentView.value === 'all')
const reviewActive = computed(() => activeTab.value === 'appointments' && appointmentView.value === 'review')
</script>
<template>
  <div class="flex owner-theme min-h-screen">
    <OwnerSidebar />
    <main class="flex-1 min-w-0 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white">Appointment Management</h1>
      <p class="mt-2 text-sm text-slate-400">Manage appointment records, requests that need a decision, and today’s service queue.</p>
      <nav class="appointment-tabs" aria-label="Appointment management tabs">
        <router-link v-if="canView" :to="{ path: '/crm/appointments', query: navigationQuery({ tab: 'appointments' }) }" class="appointment-tab" :class="{ 'is-active': allAppointmentsActive }" :aria-current="allAppointmentsActive ? 'page' : undefined">All appointments</router-link>
        <router-link v-if="canReview" :to="{ path: '/crm/appointments', query: navigationQuery({ tab: 'appointments', view: 'review' }) }" class="appointment-tab" :class="{ 'is-active': reviewActive }" :aria-current="reviewActive ? 'page' : undefined">Change requests <span v-if="requestPendingCount !== null" class="tab-count">{{ requestPendingCount }}</span></router-link>
        <router-link v-if="canQueue" :to="{ path: '/crm/appointments', query: navigationQuery({ tab: 'queue' }) }" class="appointment-tab" :class="{ 'is-active': activeTab === 'queue' }" :aria-current="activeTab === 'queue' ? 'page' : undefined">Service queue</router-link>
      </nav>
      <p v-if="!canAppointments && !canQueue" class="text-sm text-slate-400">You do not have permission to access appointment management.</p>

      <template v-if="activeTab === 'appointments' && canAppointments">
        <div v-if="appointmentView === 'review'" class="mb-5">
          <h2 class="text-lg font-semibold text-white">Customer change requests</h2>
          <p class="mt-1 text-sm text-slate-400">Review customer cancellation and reschedule requests. New bookings are scheduled automatically when the requested slot passes availability checks.</p>
        </div>
        <div v-if="needsBranch && branches.length > 1" class="mb-5">
          <label for="appointment-branch" class="text-sm text-slate-400">Clinic branch</label>
          <select id="appointment-branch" v-model="branchId" @change="syncSelectedBranch" class="mt-2 block w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.clinicBranch || branch.clinicName || branch.id }}</option></select>
        </div>
        <AppointmentRecords v-if="appointmentView === 'all' && canView" />
        <AppointmentRequestApprovals v-if="canReview && scopeReady && branchId" v-show="appointmentView === 'review'" :key="`requests-${branchId}`" :branch-id="branchId" embedded @pending-count="requestPendingCount = $event" />
      </template>

      <section v-if="activeTab === 'queue' && canQueue">
        <p v-if="!scopeReady" class="text-sm text-slate-400" role="status">Loading clinic branches…</p>
        <div v-if="branches.length > 1" class="mb-5">
          <label for="appointment-branch" class="text-sm text-slate-400">Clinic branch</label>
          <select id="appointment-branch" v-model="branchId" @change="syncSelectedBranch" class="mt-2 block w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.clinicBranch || branch.clinicName || branch.id }}</option></select>
        </div>
        <div v-if="scopeReady && !branchId" class="text-sm text-slate-400">{{ branchError || 'No clinic branch is linked to your account.' }}</div>
        <template v-else-if="scopeReady && branchId">
          <div v-if="canView && canOnline" class="mb-5 flex flex-wrap gap-3">
            <router-link :to="{ path: '/crm/appointments', query: navigationQuery({ tab: 'queue' }) }" class="appointment-tab" :class="{ 'is-active': !onlineMode }" :aria-current="!onlineMode ? 'page' : undefined">Clinic Queue</router-link>
            <router-link :to="{ path: '/crm/appointments', query: navigationQuery({ tab: 'queue', mode: 'online' }) }" class="appointment-tab" :class="{ 'is-active': onlineMode }" :aria-current="onlineMode ? 'page' : undefined">Online Consultations</router-link>
          </div>
          <PractitionerOnlineConsultation v-if="onlineMode && canOnline" :key="`online-${branchId}`" :branch-id="branchId" :existing-only="!hasFeature('online_consultations')" embedded />
          <PractitionerAppointments v-else-if="!onlineMode && canView" :key="`queue-${branchId}`" :branch-id="branchId" embedded />
          <p v-else class="text-sm text-slate-400">You do not have access to online consultations.</p>
        </template>
      </section>
      <p v-else-if="needsBranch && !scopeReady" class="text-sm text-slate-400" role="status">Loading clinic branches…</p>
      <p v-else-if="needsBranch && !branchId" class="text-sm text-slate-400">{{ branchError || 'No clinic branch is linked to your account.' }}</p>
    </main>
  </div>
</template>
<style scoped>
.appointment-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.appointment-tab { flex-shrink: 0; padding: 12px 18px; border-bottom: 3px solid transparent; color: #a58a73; font-size: 14px; font-weight: 600; }
.appointment-tab:hover, .appointment-tab.is-active { color: #91643f; }
.appointment-tab.is-active { border-bottom-color: #b78055; }
.appointment-tab:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
.tab-count { display: inline-flex; min-width: 1.35rem; height: 1.35rem; align-items: center; justify-content: center; margin-left: .4rem; border-radius: 999px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: .72rem; line-height: 1; }
@media (max-width: 640px) { .appointment-tabs { gap: 2px; margin: 18px 0; } .appointment-tab { padding: 10px 12px; font-size: 13px; } }
</style>
