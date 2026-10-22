<template>
  <div class="prescriptions-shell customer-theme">
    <CustomerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'list', fields: 5 }" class="prescriptions-main">
      <div class="prescriptions-content">
        <header class="page-heading">
          <div>
            <p class="eyebrow">My care</p>
            <h1>My Prescriptions</h1>
            <p class="subtitle">Review prescription details and care instructions recorded during your completed consultations.</p>
          </div>
          <RouterLink to="/customer/appointments" class="appointments-link">My appointments</RouterLink>
        </header>

        <p v-if="error" class="state-message error-message" role="alert">{{ error }}</p>
        <div v-else-if="loading" class="prescription-list" aria-label="Loading prescriptions"><div v-for="n in 3" :key="n" class="prescription-card skeleton-card"></div></div>
        <section v-else-if="records.length" class="prescription-list" aria-label="Prescription records">
          <article v-for="record in records" :key="record.id" class="prescription-card">
            <div class="card-heading">
              <div>
                <p class="clinic-name">{{ record.clinicName || 'Clinic' }}</p>
                <h2>{{ record.service || 'Consultation' }}</h2>
                <p class="visit-meta">{{ formatDate(record.date) }}<span v-if="record.time"> · {{ record.time }}</span><span v-if="record.consultationMode"> · {{ record.consultationMode }} consultation</span></p>
              </div>
              <span class="record-badge">{{ record.prescriptions.length ? 'Prescription' : 'Care instructions' }}</span>
            </div>

            <section v-if="record.prescriptions.length" class="detail-section">
              <h3>Prescription</h3>
              <div v-for="(item, index) in record.prescriptions" :key="index" class="medicine-row">
                <strong>{{ item.name || item.medication || item.productName || 'Medication' }}</strong>
                <p v-if="item.dosage || item.strength">{{ item.dosage || item.strength }}</p>
                <p v-if="item.frequency">{{ item.frequency }}</p>
                <p v-if="item.duration">{{ item.duration }}</p>
                <p v-if="item.instructions || item.notes">{{ item.instructions || item.notes }}</p>
              </div>
            </section>

            <section v-if="record.treatmentNotes" class="detail-section">
              <h3>Practitioner notes and recommendations</h3>
              <p class="prescription-copy">{{ record.treatmentNotes }}</p>
            </section>
            <section v-if="record.aftercareInstructions" class="detail-section">
              <h3>Aftercare instructions</h3>
              <p class="prescription-copy">{{ record.aftercareInstructions }}</p>
            </section>
            <p v-if="record.practitionerName" class="practitioner-line">Recorded by {{ record.practitionerName }}</p>
          </article>
        </section>
        <section v-else class="empty-state">
          <span class="empty-icon" aria-hidden="true">✚</span>
          <h2>No prescriptions yet</h2>
          <p>Prescriptions and care instructions from completed consultations will appear here.</p>
          <RouterLink to="/customer/appointments" class="appointments-link">View my appointments</RouterLink>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const records = ref([])
const loading = ref(true)
const error = ref('')
let unsubscribeAuth = null
let unsubscribeAppointments = null

const formatDate = value => {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value || '')
  return Number.isNaN(date.getTime()) ? 'Date not available' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
const asPrescriptionItems = value => {
  if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object')
  if (value && typeof value === 'object') return [value]
  return []
}

const listenToCustomerAppointments = userId => {
  unsubscribeAppointments?.()
  records.value = []
  error.value = ''
  if (!userId) { loading.value = false; return }
  loading.value = true
  unsubscribeAppointments = pageListener(onSnapshot, query(collection(db, 'appointments'), where('customerId', '==', userId)), snapshot => {
    records.value = sortRecordsNewestFirst(snapshot.docs.map(docSnap => {
      const appointment = docSnap.data() || {}
      return {
        id: docSnap.id,
        ...appointment,
        clinicName: appointment.clinicName || (typeof appointment.clinic === 'string' ? appointment.clinic : appointment.clinic?.name) || appointment.branchName || '',
        prescriptions: asPrescriptionItems(appointment.prescriptions || appointment.prescription),
      }
    }).filter(appointment => String(appointment.status || '').toLowerCase() === 'completed' && (
      appointment.prescriptions.length || appointment.treatmentNotes || appointment.aftercareInstructions
    )))
    loading.value = false
  }, listenerError => {
    console.error('Failed to load customer prescriptions:', listenerError)
    error.value = 'Prescriptions could not be loaded. Please refresh and try again.'
    loading.value = false
  })
}

onMounted(trackPageLoad(async () => {
  unsubscribeAuth = pageListener(onAuthStateChanged, auth, user => listenToCustomerAppointments(user?.uid || ''))
}))
onUnmounted(() => { unsubscribeAuth?.(); unsubscribeAppointments?.() })
</script>

<style scoped>
.prescriptions-shell{display:flex;min-height:100vh;background:#fffaf2;color:#493426}.prescriptions-main{min-width:0;flex:1;padding:2rem}.prescriptions-content{width:min(100%,1050px);margin:0 auto}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.5rem}.eyebrow{margin:0;color:#9b6846;font-size:.7rem;font-weight:700;letter-spacing:.17em;text-transform:uppercase}.page-heading h1{margin:.35rem 0;color:#493426;font:700 2.1rem Georgia,'Times New Roman',serif}.subtitle{max-width:660px;margin:.4rem 0 0;color:#80634e;line-height:1.55}.appointments-link{display:inline-flex;align-items:center;justify-content:center;border:1px solid #cba982;border-radius:.75rem;padding:.65rem .95rem;background:#fff7e9;color:#704a30;font-size:.85rem;font-weight:700;text-decoration:none;white-space:nowrap}.appointments-link:hover{background:#f5e6d0}.prescription-list{display:grid;gap:1rem}.prescription-card,.empty-state{border:1px solid #e8d2b3;border-radius:1rem;background:#fffdf8;box-shadow:0 8px 24px #6041230b}.prescription-card{padding:1.25rem}.card-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}.clinic-name{margin:0;color:#9b6846;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.card-heading h2{margin:.3rem 0;color:#493426;font-size:1.2rem;font-weight:700}.visit-meta{margin:0;color:#80634e;font-size:.84rem}.record-badge{flex:0 0 auto;border-radius:999px;padding:.35rem .7rem;background:#f3e4d1;color:#744c31;font-size:.75rem;font-weight:700}.detail-section{margin-top:1rem;padding-top:.85rem;border-top:1px solid #efdfc8}.detail-section h3{margin:0 0 .45rem;color:#754e33;font-size:.88rem;font-weight:700}.prescription-copy{margin:0;color:#493426;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.medicine-row{padding:.7rem 0;border-top:1px solid #f1e5d3}.medicine-row:first-of-type{border-top:0}.medicine-row strong{color:#493426}.medicine-row p{margin:.25rem 0 0;color:#735740;font-size:.9rem;white-space:pre-wrap}.practitioner-line{margin:.85rem 0 0;color:#8a705c;font-size:.78rem}.empty-state{display:grid;justify-items:center;padding:3rem 1.25rem;text-align:center}.empty-icon{display:grid;width:2.7rem;height:2.7rem;place-items:center;border-radius:50%;background:#f4e5d1;color:#8c5d3d}.empty-state h2{margin:1rem 0 .35rem;color:#493426;font:700 1.35rem Georgia,'Times New Roman',serif}.empty-state p{margin:0 0 1rem;color:#80634e}.error-message{border:1px solid #e8b7a9;background:#fff1eb;color:#9c412e}.state-message{border-radius:.75rem;padding:1rem}.skeleton-card{height:9rem;animation:pulse 1.5s ease-in-out infinite;background:linear-gradient(90deg,#fffdf8,#f8eedf,#fffdf8);background-size:200% 100%}@keyframes pulse{to{background-position:-200% 0}}@media(max-width:700px){.prescriptions-main{padding:1rem}.page-heading{align-items:flex-start;flex-direction:column}.page-heading h1{font-size:1.7rem}.prescription-card{padding:1rem}.card-heading{flex-direction:column}.record-badge{order:-1}}
</style>
