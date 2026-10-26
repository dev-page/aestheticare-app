<template>
  <section class="role-section">
    <header><p class="eyebrow">Branch Manager</p><h2>Branch operations</h2><p>At a glance: appointments, team coverage, and stock alerts.</p></header>
    <div class="metric-grid">
      <article v-for="metric in metrics" :key="metric.label" class="metric"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.note }}</small></article>
    </div>
    <div class="panel-grid">
      <article class="panel"><h3>Appointment activity</h3><div class="bars"><div v-for="item in appointmentBars" :key="item.label"><span>{{ item.label }}</span><i><b :style="{ width: `${item.width}%` }" /></i><strong>{{ item.value }}</strong></div></div></article>
      <article class="panel"><h3>Upcoming appointments</h3><div v-if="upcoming.length" class="table-wrap"><table><thead><tr><th>Time</th><th>Client</th><th>Service</th></tr></thead><tbody><tr v-for="item in upcoming" :key="item.id"><td>{{ item.date }} {{ formatTime(item.time) }}</td><td>{{ item.clientName || item.patientName || 'Client' }}</td><td>{{ item.service || '—' }}</td></tr></tbody></table></div><p v-else class="empty">No upcoming appointments found.</p></article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatClockTime } from '@/utils/appointmentDss'
const props = defineProps({ appointments: { type: Array, default: () => [] }, staff: { type: Array, default: () => [] }, inventory: { type: Array, default: () => [] } })
const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = localDateKey(new Date())
const todayAppointments = computed(() => props.appointments.filter(item => item.date === today))
const lowStock = computed(() => props.inventory.filter(item => Number(item.currentStock || 0) <= Number(item.reorderLevel || item.minimumStock || 0)))
const metrics = computed(() => [{ label: 'Today’s appointments', value: todayAppointments.value.length, note: 'Scheduled for today' }, { label: 'Active team', value: props.staff.filter(item => !item.archived && item.isActive !== false).length, note: 'Employees in this branch' }, { label: 'Stock alerts', value: lowStock.value.length, note: 'Items at or below reorder level' }])
const appointmentBars = computed(() => {
  const labels = ['Scheduled', 'Confirmed', 'Completed', 'Other']
  const values = labels.map(label => props.appointments.filter(item => label === 'Other' ? !['scheduled', 'confirmed', 'completed'].includes(String(item.status || '').toLowerCase()) : String(item.status || '').toLowerCase() === label.toLowerCase()).length)
  const max = Math.max(1, ...values)
  return labels.map((label, index) => ({ label, value: values[index], width: Math.max(values[index] ? 8 : 0, Math.round(values[index] / max * 100)) }))
})
const upcoming = computed(() => props.appointments.filter(item => item.date >= today && !['cancelled', 'completed'].includes(String(item.status || '').toLowerCase())).sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`)).slice(0, 6))
const formatTime = value => formatClockTime(value) || 'Time TBD'
</script>

<style scoped>
.role-section{display:grid;gap:1rem;color:#4a3324}.role-section header h2{margin:.25rem 0;font:600 1.65rem Georgia,serif;color:#402719}.role-section header p:last-child{margin:.3rem 0;color:#806b5a}.eyebrow{margin:0;color:#91643f;font-size:.68rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.8rem}.metric,.panel{min-width:0;border:1px solid #ead8c2;border-radius:1rem;background:#fffdf9;padding:1rem;box-shadow:0 8px 24px #4b311e0a}.metric span,.metric small{display:block;color:#806b5a;font-size:.8rem}.metric strong{display:block;margin:.45rem 0;color:#4a2d1c;font-size:1.7rem}.panel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}.panel h3{margin:0 0 .8rem;color:#4a2d1c;font-size:1rem}.bars{display:grid;gap:.75rem}.bars>div{display:grid;grid-template-columns:6rem minmax(2rem,1fr) 2rem;align-items:center;gap:.6rem;font-size:.78rem}.bars i{height:.55rem;overflow:hidden;border-radius:1rem;background:#f2e8dc}.bars b{display:block;height:100%;border-radius:inherit;background:#a97851}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:.82rem}th,td{padding:.65rem .5rem;border-bottom:1px solid #efe3d5;white-space:nowrap}th{color:#806b5a;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}.empty{color:#806b5a;font-size:.85rem}@media(max-width:600px){.role-section header h2{font-size:1.4rem}th,td{padding:.55rem .4rem;font-size:.75rem}}
</style>
