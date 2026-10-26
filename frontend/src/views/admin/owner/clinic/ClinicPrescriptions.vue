<template>
  <div class="prescriptions-shell owner-theme">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'list', fields: 5 }" class="prescriptions-main">
      <div class="prescriptions-content">
        <header class="page-heading">
          <div>
            <p class="eyebrow">Clinic care</p>
            <h1>Prescriptions</h1>
            <p class="subtitle">Review prescriptions from completed consultations and prepare available items for in-person pickup.</p>
          </div>
          <label v-if="branches.length > 1" class="branch-filter">Clinic branch
            <select v-model="branchFilter"><option value="all">All branches</option><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option></select>
          </label>
        </header>

        <p v-if="error" class="state-message error-message" role="alert">{{ error }}</p>
        <p v-else-if="loading" class="state-message">Loading prescriptions…</p>
        <section v-else-if="records.length" class="prescription-list" aria-label="Clinic prescriptions">
          <article v-for="record in records" :key="record.id" class="prescription-card">
            <header class="card-heading">
              <div>
                <p class="clinic-name">{{ record.branchName || branchNames[record.branchId] || 'Clinic' }}</p>
                <h2>{{ record.customerName || record.clientName || 'Customer' }}</h2>
                <p class="visit-meta">{{ record.serviceName || record.service || 'Consultation' }} · {{ formatDate(record.date) }}<span v-if="record.time"> · {{ formatClockTime(record.time) }}</span><span v-if="record.consultationMode"> · {{ record.consultationMode }}</span></p>
              </div>
              <span class="record-badge">{{ record.prescriptionStatus === 'dispensed' ? 'Dispensed' : 'Pending pickup' }}</span>
            </header>

            <section class="detail-section">
              <h3>Prescription</h3>
              <div v-for="(item, index) in record.prescriptions" :key="index" class="medicine-row">
                <strong>{{ item.name || item.medication || item.productName || 'Medication' }}</strong>
                <p v-if="item.dosage || item.strength">{{ item.dosage || item.strength }}</p>
                <p v-if="item.frequency">{{ item.frequency }}</p>
                <p v-if="item.duration">{{ item.duration }}</p>
                <p v-if="item.instructions || item.notes">{{ item.instructions || item.notes }}</p>
              </div>
              <p v-if="record.treatmentNotes" class="prescription-copy">{{ record.treatmentNotes }}</p>
              <p v-if="record.aftercareInstructions" class="prescription-copy"><strong>Aftercare:</strong> {{ record.aftercareInstructions }}</p>
            </section>
            <footer class="card-footer">
              <p v-if="record.prescriptionStatus === 'dispensed'">Marked dispensed {{ record.prescriptionDispensedAt ? `· ${formatDate(record.prescriptionDispensedAt)}` : '' }}</p>
              <p v-else>Confirm the prescribed items are available and provided at the pharmacy.</p>
              <router-link v-if="record.prescriptionStatus !== 'dispensed'" class="pos-link" :to="{ path: '/pharmacy/pos', query: { branchId: record.branchId, appointmentId: record.id } }">Process at pharmacy POS</router-link>
            </footer>
          </article>
        </section>
        <section v-else class="empty-state">
          <span class="empty-icon" aria-hidden="true">Rx</span>
          <h2>No prescriptions to process</h2>
          <p>Prescriptions recorded during completed consultations will appear here.</p>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { formatClockTime } from '@/utils/appointmentDss'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const { hasPermission } = usePermissions()
const branches = ref([]), branchFilter = ref('all'), allRecords = ref([]), error = ref(''), loading = ref(true)
const branchNames = computed(() => Object.fromEntries(branches.value.map(branch => [branch.id, branch.name])))
const records = computed(() => allRecords.value.filter(record => (branchFilter.value === 'all' || record.branchId === branchFilter.value)
  && String(record.type || '').toLowerCase() === 'consultation'
  && String(record.status || '').toLowerCase() === 'completed'
  && record.prescriptions.length > 0))
let stopAuth, stops = [], generation = 0
const formatDate = value => {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value || '')
  return Number.isNaN(date.getTime()) ? 'Date not available' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
const asPrescriptionItems = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : value && typeof value === 'object' ? [value] : []
const startListening = async user => {
  const run = ++generation
  stops.forEach(stop => stop()); stops = []; branches.value = []; allRecords.value = []; error.value = ''
  if (!user) { loading.value = false; return }
  loading.value = true
  try {
    const scope = await loadOwnerBranchScope(db, user.uid)
    if (run !== generation) return
    const ids = [...new Set(scope.branchIds.filter(Boolean))]
    if (!ids.length) throw new Error('No clinic branch is linked to your account.')
    const docs = await loadClinicDocsByIds(db, ids)
    if (run !== generation) return
    branches.value = docs.map(branch => ({ id: branch.id, name: branch.clinicBranch || branch.clinicName || branch.name || branch.id }))
    if (scope.isStaffUser && !hasPermission('appointments:view') && !hasPermission('appointments:update') && !hasPermission('consultations:view')) throw new Error('You do not have permission to review clinic prescriptions.')
    const byBranch = new Map()
    ids.forEach(branchId => {
      stops.push(pageListener(onSnapshot, query(collection(db, 'appointments'), where('branchId', '==', branchId)), snapshot => {
        if (run !== generation) return
        byBranch.set(branchId, snapshot.docs.map(item => {
          const data = item.data() || {}
          return { ...data, id: item.id, prescriptions: asPrescriptionItems(data.prescriptions || data.prescription) }
        }))
        allRecords.value = [...byBranch.values()].flat()
        loading.value = false
      }, cause => { if (run === generation) { console.error('Clinic prescription updates failed:', cause); error.value = 'Unable to load prescriptions. Check clinic branch access and Firestore permissions.'; loading.value = false } }))
    })
  } catch (cause) { if (run === generation) { error.value = cause.message || 'Unable to load clinic prescriptions.'; loading.value = false } }
}
onMounted(trackPageLoad(() => { stopAuth = pageListener(onAuthStateChanged, auth, startListening) }))
onUnmounted(() => { generation++; stopAuth?.(); stops.forEach(stop => stop()) })
</script>

<style scoped>
.prescriptions-shell{display:flex;min-height:100vh;background:#0f172a;color:#f8fafc}.prescriptions-main{min-width:0;flex:1;padding:2rem}.prescriptions-content{width:min(100%,1100px);margin:0 auto}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.5rem}.eyebrow{margin:0;color:#c08457;font-size:.7rem;font-weight:700;letter-spacing:.17em;text-transform:uppercase}.page-heading h1{margin:.35rem 0;color:#fff;font-size:2rem;font-weight:700}.subtitle{max-width:680px;margin:.4rem 0 0;color:#94a3b8;line-height:1.55}.branch-filter{min-width:220px;color:#cbd5e1;font-size:.85rem}.branch-filter select{display:block;width:100%;margin-top:.35rem;border:1px solid #475569;border-radius:.65rem;background:#1e293b;padding:.65rem;color:#fff}.prescription-list{display:grid;gap:1rem}.prescription-card,.empty-state{border:1px solid #334155;border-radius:1rem;background:#1e293b}.prescription-card{padding:1.25rem}.card-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}.clinic-name{margin:0;color:#c08457;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.card-heading h2{margin:.3rem 0;color:#f8fafc;font-size:1.2rem;font-weight:700}.visit-meta{margin:0;color:#94a3b8;font-size:.84rem}.record-badge{flex:0 0 auto;border-radius:999px;padding:.35rem .7rem;background:#334155;color:#e2e8f0;font-size:.75rem;font-weight:700}.detail-section{margin-top:1rem;padding-top:.85rem;border-top:1px solid #334155}.detail-section h3{margin:0 0 .45rem;color:#fbbf77;font-size:.88rem;font-weight:700}.prescription-copy{margin:.6rem 0 0;color:#cbd5e1;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.medicine-row{padding:.7rem 0;border-top:1px solid #334155}.medicine-row:first-of-type{border-top:0}.medicine-row strong{color:#f8fafc}.medicine-row p{margin:.25rem 0 0;color:#cbd5e1;font-size:.9rem;white-space:pre-wrap}.card-footer{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem;padding-top:.85rem;border-top:1px solid #334155}.card-footer p{margin:0;color:#94a3b8;font-size:.84rem}.card-footer button{border:0;border-radius:.65rem;padding:.65rem .9rem;background:#b45309;color:white;font-size:.82rem;font-weight:700;white-space:nowrap}.card-footer button.secondary-button{border:1px solid #64748b;background:transparent;color:#e2e8f0}.card-footer button:disabled{opacity:.55}.empty-state{display:grid;justify-items:center;padding:3rem 1.25rem;text-align:center}.empty-icon{display:grid;width:2.7rem;height:2.7rem;place-items:center;border-radius:50%;background:#334155;color:#fbbf77;font-weight:700}.empty-state h2{margin:1rem 0 .35rem;color:#f8fafc;font-size:1.25rem;font-weight:700}.empty-state p,.state-message{margin:0;color:#94a3b8}.state-message{border-radius:.75rem;padding:1rem}.error-message{border:1px solid #7f1d1d;background:#450a0a;color:#fecaca}@media(max-width:700px){.prescriptions-main{padding:1rem}.page-heading,.card-footer{align-items:flex-start;flex-direction:column}.page-heading h1{font-size:1.65rem}.prescription-card{padding:1rem}.card-heading{flex-direction:column}.record-badge{order:-1}.branch-filter{width:100%}}
</style>
