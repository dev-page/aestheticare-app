<template>
  <div class="flex module-theme min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="min-w-0 flex-1 p-4 md:p-6">
      <div class="mx-auto max-w-6xl">
        <h1 class="text-3xl font-bold">Treatment Courses</h1>
        <p class="mt-2 text-slate-400">Track visit progress. The clinic arranges each later visit after the previous one is completed or resolved.</p>
        <p v-if="error" class="mt-4 rounded-lg bg-rose-950 p-3 text-rose-200">{{ error }}</p>

        <section v-if="treatmentPlanGroups.length" class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article v-for="plan in treatmentPlanGroups" :key="plan.id" class="course-card rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div><p class="course-kicker">Treatment course</p><h2 class="mt-1 text-lg font-semibold">{{ plan.name }}</h2><p class="mt-1 text-sm text-slate-300">{{ plan.customerName }}</p></div>
              <strong class="course-progress-label">{{ plan.completedCount }} of {{ plan.totalSessions }} complete</strong>
            </div>
            <div class="course-progress-track" role="progressbar" :aria-valuenow="plan.completedCount" :aria-valuemin="0" :aria-valuemax="plan.totalSessions"><span :style="{ width: `${plan.progressPercent}%` }"></span></div>
            <div v-if="plan.nextSession" class="mt-4 border-t border-slate-700 pt-3 text-sm">
              <p><strong>Next visit:</strong> {{ plan.nextSession.serviceName }} · Visit {{ plan.nextSession.sessionNumber }}</p>
              <p class="mt-1 text-slate-300">{{ plan.nextStatus }}<span v-if="plan.nextSession.earliestScheduleDate"> · Earliest {{ formatCourseDate(plan.nextSession.earliestScheduleDate) }}</span></p>
            </div>
            <p v-else class="mt-4 border-t border-slate-700 pt-3 text-sm text-slate-300">All visits in this treatment course are resolved.</p>
          </article>
        </section>

        <section class="mt-6 overflow-x-auto rounded-xl border border-slate-700">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="bg-slate-800 text-slate-300"><tr><th class="p-3">Course</th><th class="p-3">Visit</th><th class="p-3">Treatment</th><th class="p-3">Customer</th><th class="p-3">Schedule</th><th class="p-3">Status</th><th class="p-3">Actions</th></tr></thead>
            <tbody>
              <tr v-for="session in sortedSessions" :key="session.id" class="border-t border-slate-700">
                <td class="p-3">{{ session.planName || 'Treatment course' }}</td><td class="p-3">{{ session.sessionNumber }} of {{ session.totalSessions }}</td><td class="p-3">{{ session.serviceName || 'Treatment visit' }}</td><td class="p-3">{{ session.customerName || 'Customer' }}</td>
                <td class="p-3">{{ session.date ? `${formatCourseDate(session.date)} ${formatClockTime(session.time)}` : session.requestedDate ? `Requested: ${formatCourseDate(session.requestedDate)} ${formatClockTime(session.requestedTime)}` : session.earliestScheduleDate ? `Eligible from ${formatCourseDate(session.earliestScheduleDate)}` : 'Not scheduled' }}</td><td class="p-3">{{ session.status }}</td>
                <td class="whitespace-nowrap p-3"><button v-if="canSchedule(session)" class="btn" @click="openSchedule(session)">{{ String(session.status).toLowerCase().includes('requested') ? 'Review request' : 'Schedule' }}</button><router-link v-if="session.appointmentId && session.status === 'Scheduled'" class="btn ml-1" to="/clinical/appointments">Open queue</router-link><span v-if="session.status === 'Schedule Proposed'" class="mx-1 text-sm text-amber-300">Awaiting customer</span><button v-if="session.status === 'Scheduled'" class="ml-1 rounded bg-rose-700 px-3 py-2" @click="noShow(session)">No-show</button><button class="ml-1 rounded border border-slate-500 px-3 py-2" @click="showHistory(session)">History</button></td>
              </tr>
              <tr v-if="!sessions.length"><td colspan="7" class="p-8 text-center text-slate-400">No treatment courses are available for this branch.</td></tr>
            </tbody>
          </table>
        </section>

        <section v-if="historySession" class="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-5"><div class="flex justify-between"><h2 class="font-semibold">Visit {{ historySession.sessionNumber }} history</h2><button @click="historySession = null">Close</button></div><p v-if="!history.length" class="mt-3 text-slate-400">No recorded changes yet.</p><ol v-else class="mt-3 space-y-3"><li v-for="entry in history" :key="entry.id" class="rounded-lg bg-slate-900 p-3"><strong>{{ entry.action }}</strong> · {{ entry.previousStatus || 'New' }} → {{ entry.nextStatus }}<span v-if="entry.date"> · {{ formatCourseDate(entry.date) }} {{ formatClockTime(entry.time) }}</span><small class="mt-1 block text-slate-400">{{ entry.actorName || entry.actorId }} · {{ formatDate(entry.createdAt) }}</small></li></ol></section>

        <form v-if="target" class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4" @submit.prevent="schedule"><section class="w-full max-w-sm rounded-xl bg-slate-800 p-5"><h2 class="text-lg font-semibold">{{ String(target.status).includes('Requested') ? 'Review requested time' : 'Schedule' }} visit {{ target.sessionNumber }}</h2><p class="mt-1 text-sm text-slate-300">{{ target.serviceName }}</p><p v-if="target.requestedDate" class="mt-2 text-sm text-slate-300">Customer requested {{ formatCourseDate(target.requestedDate) }} at {{ formatClockTime(target.requestedTime) }}. You may confirm it or choose another available time.</p><ContractAppearanceSelect id="session-lead-practitioner" label="Lead practitioner" v-model="practitionerId" :options="practitioners.map(person => ({ value: person.id, label: person.fullName + (person.practitionerType ? ' (' + person.practitionerType + ')' : '') }))" /><label class="mt-4 block">Date</label><AppointmentCalendar v-model="date" :min-date="sessionMinDate" :disabled="!practitionerId" :availability-aware="false" :help-text="practitionerId ? 'Choose a date. Availability is checked when the clinic confirms the schedule.' : 'Choose a practitioner first.'" @update:model-value="time = ''"/><label class="mt-3 block">Time<input v-model="time" type="time" required class="field"/></label><div class="mt-5 flex justify-end gap-2"><button type="button" @click="target = null">Cancel</button><button class="btn">Propose schedule</button></div></section></form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { usePageLoading } from '@/composables/usePageLoading'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import AppointmentCalendar from '@/components/common/AppointmentCalendar.vue'
import { useRoute } from 'vue-router'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { formatClockTime } from '@/utils/appointmentDss'
import { manilaDate } from '@/utils/walkInScheduling'
import { auth, db } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

const route = useRoute()
const { pageLoading, trackPageLoad } = usePageLoading()
const sessions = ref([]), error = ref(''), target = ref(null), date = ref(''), time = ref(''), history = ref([]), historySession = ref(null)
const practitioners = ref([]), practitionerId = ref('')
const today = manilaDate()
let branchId = ''
const sessionMinDate = computed(() => String(target.value?.earliestScheduleDate || '') > today ? String(target.value.earliestScheduleDate) : today)
const sortedSessions = computed(() => [...sessions.value].sort((left, right) => String(left.treatmentPlanAppointmentId).localeCompare(String(right.treatmentPlanAppointmentId)) || Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0)))
const treatmentPlanGroups = computed(() => {
  const groups = new Map()
  for (const session of sortedSessions.value) {
    const id = String(session.treatmentPlanAppointmentId || session.id)
    if (!groups.has(id)) groups.set(id, { id, sessions: [] })
    groups.get(id).sessions.push(session)
  }
  return [...groups.values()].map(group => {
    const rows = group.sessions
    const totalSessions = Number(rows[0]?.totalSessions || rows.length)
    const nextSession = rows.find(session => !['completed', 'forfeited'].includes(String(session.status || '').toLowerCase())) || null
    const status = String(nextSession?.status || '').toLowerCase()
    const nextStatus = !nextSession ? 'Course complete'
      : status === 'unscheduled' && nextSession.earliestScheduleDate ? 'Ready to schedule after the minimum gap'
        : status === 'schedule proposed' ? 'Waiting for customer confirmation'
          : status.includes('requested') ? 'Customer requested a schedule change'
            : nextSession.status || 'Not scheduled yet'
    return {
      id: group.id,
      name: rows[0]?.planName || 'Treatment course',
      customerName: rows[0]?.customerName || 'Customer',
      totalSessions,
      completedCount: rows.filter(session => String(session.status || '').toLowerCase() === 'completed').length,
      progressPercent: Math.min(100, Math.round(rows.filter(session => String(session.status || '').toLowerCase() === 'completed').length / Math.max(1, totalSessions) * 100)),
      nextSession,
      nextStatus,
    }
  })
})

const api = async (path, body) => {
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(OTP_API_BASE + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Request failed')
  return payload.data
}
const load = trackPageLoad(async () => {
  try {
    error.value = ''
    const scope = await loadOwnerBranchScope(db, auth.currentUser.uid)
    branchId = scope.branchIds.includes(String(route.query.branch || '')) ? String(route.query.branch) : scope.branchId
    if (!branchId) throw new Error('No clinic branch is linked to your account.')
    sessions.value = await api(`/treatment-sessions?branchId=${encodeURIComponent(branchId)}`)
  } catch (cause) { error.value = cause.message }
})
const canSchedule = session => ['unscheduled', 'reschedule eligible', 'schedule requested', 'reschedule requested'].includes(String(session.status || '').toLowerCase())
const openSchedule = async session => {
  target.value = session
  const requestedDate = String(session.requestedDate || '')
  date.value = requestedDate >= sessionMinDate.value ? requestedDate : ''
  time.value = date.value ? session.requestedTime || '' : ''
  practitionerId.value = session.practitionerId || ''
  try {
    const token = await auth.currentUser.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/public/clinics/${encodeURIComponent(branchId)}/practitioners`, { headers: { Authorization: `Bearer ${token}` } })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load practitioners.')
    practitioners.value = payload.practitioners || []
  } catch (cause) { toast.error(cause.message) }
}
const schedule = async () => {
  try {
    await api(`/treatment-sessions/${target.value.id}/schedule`, { date: date.value, time: time.value, practitionerId: practitionerId.value })
    toast.success('Schedule proposed. The customer must confirm it.')
    target.value = null
    await load()
  } catch (cause) { toast.error(cause.message) }
}
const noShow = async session => {
  if (!confirm('Mark this visit as a no-show?')) return
  try { const data = await api(`/treatment-sessions/${session.id}/no-show`, {}); toast.success(`Visit marked ${data.status}.`); await load() }
  catch (cause) { toast.error(cause.message) }
}
const showHistory = async session => {
  try { historySession.value = session; history.value = await api(`/treatment-sessions/${session.id}/audit`) }
  catch (cause) { toast.error(cause.message) }
}
const formatCourseDate = value => {
  if (!value) return ''
  const dateValue = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(dateValue.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(dateValue)
}
const formatDate = value => {
  if (!value) return 'Just now'
  if (value?.toDate) return value.toDate().toLocaleString()
  const seconds = Number(value?._seconds ?? value?.seconds)
  return Number.isFinite(seconds) ? new Date(seconds * 1000).toLocaleString() : new Date(value).toLocaleString()
}
onMounted(load)
</script>

<style scoped>
.field { display: block; width: 100%; margin-top: .35rem; border: 1px solid #475569; border-radius: .5rem; background: #0f172a; padding: .55rem; color: #fff; }
.btn { display: inline-block; border-radius: .45rem; background: #8d5a3b; padding: .45rem .75rem; color: #fff; }
.course-kicker { color: #c79b74; font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.course-progress-label { border-radius: 999px; background: #392719; padding: .4rem .7rem; color: #f5e6d2; font-size: .8rem; }
.course-progress-track { height: .4rem; margin-top: 1rem; overflow: hidden; border-radius: 999px; background: #392719; }
.course-progress-track span { display: block; height: 100%; border-radius: inherit; background: #bb8057; transition: width 180ms ease; }
.course-card { box-shadow: 0 10px 30px #0002; }
.module-theme :is(input, select) { color-scheme: light; }

@media (max-width: 767px) {
  main { min-width: 0; padding: 1rem !important; }
  h1 { font-size: 1.45rem; line-height: 1.2; }
  section.overflow-x-auto { -webkit-overflow-scrolling: touch; overscroll-behavior-inline: contain; }
  form.fixed { align-items: flex-start; padding-top: 1rem; }
  form.fixed > section { max-height: calc(100dvh - 2rem); overflow: auto; }
}
</style>
