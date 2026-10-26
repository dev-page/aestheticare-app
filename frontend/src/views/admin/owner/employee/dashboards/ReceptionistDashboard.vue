<template>
  <section class="role-section">
    <header><p class="eyebrow">Receptionist</p><h2>Front desk</h2><p>Today’s schedule, arrivals, and the next appointments to prepare for.</p></header>
    <div class="metric-grid"><article v-for="metric in metrics" :key="metric.label" class="metric"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.note }}</small></article></div>
    <article class="panel"><h3>Today’s appointments</h3><div v-if="todayAppointments.length" class="table-wrap"><table><thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Status</th></tr></thead><tbody><tr v-for="item in todayAppointments" :key="item.id"><td>{{ formatTime(item.time) }}</td><td>{{ item.clientName || item.patientName || 'Client' }}</td><td>{{ item.service || '—' }}</td><td>{{ item.status || 'Scheduled' }}</td></tr></tbody></table></div><p v-else class="empty">No appointments scheduled for today.</p></article>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import { formatClockTime } from '@/utils/appointmentDss'
const props = defineProps({ appointments: { type: Array, default: () => [] } })
const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
const todayAppointments = computed(() => props.appointments.filter(item => item.date === today).sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))))
const metrics = computed(() => [{ label: 'Today’s bookings', value: todayAppointments.value.length, note: 'Scheduled for this branch' }, { label: 'Awaiting confirmation', value: todayAppointments.value.filter(item => /pending|request/i.test(String(item.status || ''))).length, note: 'Review the appointment list' }, { label: 'Checked in', value: todayAppointments.value.filter(item => /arrived|check.?in/i.test(String(item.status || ''))).length, note: 'Based on appointment status' }])
const formatTime = value => formatClockTime(value) || 'Time TBD'
</script>
<style scoped>
.role-section{display:grid;gap:1rem;color:#4a3324}.role-section header h2{margin:.25rem 0;font:600 1.65rem Georgia,serif;color:#402719}.role-section header p:last-child{margin:.3rem 0;color:#806b5a}.eyebrow{margin:0;color:#91643f;font-size:.68rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase}.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.8rem}.metric,.panel{min-width:0;border:1px solid #ead8c2;border-radius:1rem;background:#fffdf9;padding:1rem;box-shadow:0 8px 24px #4b311e0a}.metric span,.metric small{display:block;color:#806b5a;font-size:.8rem}.metric strong{display:block;margin:.45rem 0;color:#4a2d1c;font-size:1.7rem}.panel h3{margin:0 0 .8rem;color:#4a2d1c;font-size:1rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:.82rem}th,td{padding:.65rem .5rem;border-bottom:1px solid #efe3d5;white-space:nowrap}th{color:#806b5a;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}.empty{color:#806b5a;font-size:.85rem}@media(max-width:600px){.role-section header h2{font-size:1.4rem}th,td{padding:.55rem .4rem;font-size:.75rem}}
</style>
