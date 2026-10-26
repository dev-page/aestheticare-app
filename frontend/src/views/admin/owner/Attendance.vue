<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import QRCode from 'qrcode'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import AttendanceImportWizard from '@/components/common/AttendanceImportWizard.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import { attendanceApi } from '@/utils/attendanceApi'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const { hasPermission } = usePermissions()
const tab = ref('records'), branches = ref([]), branchId = ref(''), records = ref([])
const date = ref(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
const search = ref(''), status = ref(''), source = ref(''), busy = ref(false), error = ref('')
const config = ref({ fields: [], templates: [], holidays: [] }), chooser = ref(false), hidden = ref([])
const selected = ref(null), audit = ref([]), reason = ref(''), edit = ref({}), batches = ref([]), batchDetails = ref(null)
const field = ref({ label: '', type: 'text', options: '' }), holidays = ref('')
const qr = ref(''), expires = ref(0), now = ref(Date.now()), station = ref(null), qrBusy = ref(false)
let timer, refreshing = false, recordSequence = 0
const columns = computed(() => [
  { key: 'employeeName', label: 'Employee' }, { key: 'date', label: 'Date' },
  { key: 'branchLabel', label: 'Branch' }, { key: 'timeIn', label: 'Time In' },
  { key: 'timeOut', label: 'Time Out' }, { key: 'attendanceStatus', label: 'Status' },
  { key: 'sourceLabel', label: 'Source' },
  { key: 'employeeId', label: 'Employee ID', optional: true },
  { key: 'totalWorkedMinutes', label: 'Work Minutes', optional: true },
  { key: 'verification', label: 'Verification', optional: true },
  ...(config.value.fields || []).map(f => ({ key: 'field:' + f.id, label: f.label + (f.archived ? ' (archived)' : ''), optional: true })),
])
const visible = computed(() => columns.value.filter(c => !hidden.value.includes(c.key)))
const filtered = computed(() => records.value.filter(r =>
  (!search.value || String(r.employeeName || '').toLowerCase().includes(search.value.toLowerCase())) &&
  (!status.value || r.attendanceStatus === status.value) && (!source.value || r.source === source.value)))
const summary = computed(() => [
  ['Scheduled Employees', records.value.filter(r => r.scheduled).length],
  ['Completed', records.value.filter(r => r.attendanceStatus === 'Complete').length],
  ['On Duty', records.value.filter(r => r.attendanceStatus === 'On Duty').length],
  ['Needs Review', records.value.filter(r => r.attendanceStatus === 'Needs Review').length],
])
const activeFields = computed(() => (config.value.fields || []).filter(f => !f.archived))
const selectedBranch = computed(() => branches.value.find(b => b.id === branchId.value))
const remaining = computed(() => Math.max(0, Math.ceil((expires.value - now.value) / 1000)))
async function attempt(fn) {
  busy.value = true; error.value = ''
  try { await fn() } catch(e) { error.value = e.message }
  finally { busy.value = false }
}
async function loadConfiguration() {
  if (!branchId.value) return
  config.value = await attendanceApi('configuration', { branchId: branchId.value })
  holidays.value = (config.value.holidays || []).join('\n')
}
async function loadRecords() {
  const sequence = ++recordSequence
  const result = await attendanceApi('records', { branchId: branchId.value, date: date.value })
  if (sequence === recordSequence) records.value = result.records
}
async function loadHistory() {
  if (hasPermission('attendance:import')) batches.value = (await attendanceApi('imports/history', { branchId: branchId.value })).batches
}
async function refreshQr(forceRefresh = false) {
  if (!branchId.value || qrBusy.value) return
  qrBusy.value = true
  try {
    const selectedId = branchId.value
    const result = await attendanceApi('qr', { branchId: selectedId, forceRefresh })
    if (selectedId !== branchId.value) return
    qr.value = await QRCode.toDataURL(result.qrPayload, { width: 480, margin: 4 })
    expires.value = result.expiresAt
  } finally { qrBusy.value = false }
}
async function openRecord(record) {
  await attempt(async () => {
    const result = await attendanceApi('details', { attendanceId: record.id })
    selected.value = result.record; audit.value = result.audit; reason.value = ''
    edit.value = { timeIn: result.record.timeIn || '', timeOut: result.record.timeOut || '', overnight: !!(result.record.timeOutEpoch && new Date(result.record.timeOutEpoch + 8 * 3600000).toISOString().slice(0,10) > result.record.date), customFields: { ...result.record.customFields } }
  })
}
async function saveCorrection() {
  await attempt(async () => {
    const result = await attendanceApi('correction', { attendanceId: selected.value.id, revision: selected.value.revision || 0, reason: reason.value, ...edit.value })
    selected.value = result.record
    await loadRecords()
    audit.value = (await attendanceApi('details', { attendanceId: selected.value.id })).audit
    reason.value = ''
  })
}
async function addField() {
  await attempt(async () => {
    await attendanceApi('fields', { branchId: branchId.value, label: field.value.label, type: field.value.type, options: field.value.options.split(',').map(s => s.trim()) })
    await loadConfiguration(); field.value = { label: '', type: 'text', options: '' }
  })
}
async function archiveField(id) { await attempt(async () => { await attendanceApi('fields', { branchId: branchId.value, archiveId: id }); await loadConfiguration() }) }
async function saveHolidays() { await attempt(async () => { await attendanceApi('holidays', { branchId: branchId.value, holidays: holidays.value.split(/\s+/).filter(Boolean) }); await loadConfiguration(); await loadRecords() }) }
function valueFor(record, key) {
  if (key.startsWith('field:')) return record.customFields?.[key.slice(6)] ?? '—'
  if (key === 'branchLabel') return selectedBranch.value?.clinicBranch || record.branchId
  if (key === 'sourceLabel') return record.source === 'imported' ? 'Imported' : record.attendanceMethod ? 'QR + Location' : '—'
  if (key === 'verification') return record.locationVerified ? 'Verified' : 'Not verified'
  return record[key] ?? '—'
}
function toggleColumn(key) { hidden.value = hidden.value.includes(key) ? hidden.value.filter(k => k !== key) : [...hidden.value, key] }
async function fullscreen() { await attempt(async () => { if (!station.value?.requestFullscreen) throw new Error('Fullscreen is unavailable in this browser.'); await station.value.requestFullscreen() }) }
function timestamp(value) { return value?.seconds ? new Date(value.seconds * 1000).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—' }
watch(hidden, value => { try { localStorage.setItem('attendance-columns:' + auth.currentUser?.uid, JSON.stringify(value)) } catch {} })
watch([branchId, date], () => {
  records.value = []; selected.value = null; qr.value = ''; expires.value = 0
  if (branchId.value) void attempt(async () => { await loadConfiguration(); await loadRecords(); if (tab.value === 'history') await loadHistory(); if (tab.value === 'qr') await refreshQr() })
})
watch(tab, () => { if (branchId.value) void attempt(async () => { if (tab.value === 'qr') await refreshQr(); if (tab.value === 'history') await loadHistory() }) })
onMounted(trackPageLoad(async () => {
  await attempt(async () => {
    try { hidden.value = JSON.parse(localStorage.getItem('attendance-columns:' + auth.currentUser?.uid) || '["employeeId","totalWorkedMinutes","verification"]') } catch {}
    const scope = await loadOwnerBranchScope(db, auth.currentUser.uid)
    branches.value = await loadClinicDocsByIds(db, scope.branchIds)
    branchId.value = branches.value[0]?.id || ''
  })
  timer = setInterval(async () => {
    now.value = Date.now()
    if (tab.value === 'qr' && expires.value && remaining.value <= 10 && !refreshing) {
      refreshing = true
      try { await refreshQr() } catch(e) { error.value = e.message } finally { refreshing = false }
    }
  }, 1000)
}))
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="flex min-h-screen owner-theme bg-[#1b0e08]">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, blocks: [{ variant: 'cards', cardStyle: 'stat', cards: 4 }, { variant: tab === 'import' ? 'form' : tab === 'qr' ? 'cards' : 'table', columns: visible.length + 1, rows: 5, cards: 1, fields: 4 }] }" class="attendance flex-1 min-w-0 p-3 md:p-6 text-white">
      <div class="shell">
        <header class="attendance-page-heading"><p class="attendance-eyebrow">Human Resources</p><h1>Attendance Management</h1><p>Review employee attendance, manage the QR station, and import attendance records.</p></header>
        <div class="summary"><div v-for="[label,count] in summary" :key="label"><small>{{ label }}</small><strong>{{ count }}</strong></div></div>
        <nav class="attendance-tabs" aria-label="Attendance sections">
          <button v-for="[key,label] in [['records','Attendance Records'],['qr','QR Station'],['import','Import Attendance'],['history','Import History']]" :key="key" :class="{active:tab===key}" :aria-pressed="tab===key" type="button" @click="tab=key">{{ label }}</button>
        </nav>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="busy" role="status">Loading attendance…</p>
        <div class="filters">
          <ContractAppearanceSelect id="attendance-branch" label="Branch" v-model="branchId" :disabled="!branches.length" :options="branches.length ? branches.map(branch => ({ value: branch.id, label: branch.clinicBranch })) : [{ value: '', label: 'No authorized branches' }]" />
          <label v-if="tab==='records'">Date (Asia/Manila)<input v-model="date" type="date" /></label>
        </div>
        <section v-if="tab==='records'" class="attendance-records-panel">
          <div class="heading"><h2>Attendance Records</h2><button @click="chooser=!chooser">Customize Columns</button></div>
          <div v-if="chooser" class="panel">
            <p>Optional columns</p>
            <label v-for="column in columns.filter(c=>c.optional)" :key="column.key" class="inline"><input type="checkbox" :checked="!hidden.includes(column.key)" @change="toggleColumn(column.key)" /> {{ column.label }}</label>
            <details v-if="config.canManageFields"><summary>Organization custom fields</summary>
              <form @submit.prevent="addField" class="filters">
                <label>Field label<input v-model="field.label" required maxlength="80" /></label>
                <label>Type<select v-model="field.type"><option v-for="type in ['text','number','date','dropdown','boolean']" :key="type">{{ type }}</option></select></label>
                <label v-if="field.type==='dropdown'">Options (comma separated)<input v-model="field.options" required /></label>
                <button :disabled="busy">Add field</button>
              </form>
              <div v-for="f in activeFields" :key="f.id" class="heading"><span>{{ f.label }} · {{ f.type }}</span><button :disabled="busy" @click="archiveField(f.id)">Archive</button></div>
            </details>
          </div>
          <input v-model="search" type="search" aria-label="Search employee" placeholder="Search employee…" />
          <div class="filters"><ContractAppearanceSelect id="attendance-status" label="Status" v-model="status" :options="[{ value: '', label: 'All statuses' }, ...['Complete','On Duty','Needs Review','Absent','Scheduled','On Leave','Holiday','Day Off'].map(value => ({ value, label: value }))]" /><ContractAppearanceSelect id="attendance-source" label="Source" v-model="source" :options="[{ value: '', label: 'All sources' }, { value: 'imported', label: 'Imported' }, { value: 'built_in', label: 'QR + Location' }]" /></div>
          <div class="table-wrap"><table><thead><tr><th v-for="c in visible" :key="c.key">{{ c.label }}</th><th>Action</th></tr></thead><tbody>
            <tr v-for="r in filtered" :key="r.employeeId + r.date"><td v-for="c in visible" :key="c.key"><span :class="c.key==='attendanceStatus' ? ['badge',r.attendanceStatus==='Complete'?'good':r.attendanceStatus==='Needs Review'?'review':''] : ''">{{ valueFor(r,c.key) }}</span></td><td><button :disabled="!r.id || busy" @click="openRecord(r)">View</button></td></tr>
            <tr v-if="!filtered.length"><td :colspan="visible.length+1">No records for these filters.</td></tr>
          </tbody></table></div>
          <details v-if="config.canManageFields" class="panel"><summary>Organization non-working holidays</summary><p>Dates are evaluated with recurring schedules and approved leave. Absence is determined one hour after the scheduled shift ends. Overnight shifts end the following day.</p><label>One YYYY-MM-DD date per line<textarea v-model="holidays" rows="4" /></label><button :disabled="busy" @click="saveHolidays">Save holiday calendar</button></details>
        </section>
        <section v-else-if="tab==='qr'">
          <h2>Branch QR Station</h2>
          <div ref="station" class="station panel">
            <span class="badge good">QR Station</span><h3>{{ selectedBranch?.clinicBranch }}</h3>
            <img v-if="qr && remaining" :src="qr" alt="Branch attendance QR code" /><p v-else>No active QR. Refresh to issue a code.</p>
            <p>Employees open My Attendance and tap Scan QR on their phone.</p>
            <p>Expires in {{ remaining }} seconds · refreshes automatically</p>
            <div class="heading"><button type="button" :disabled="qrBusy" aria-label="Refresh attendance QR" title="Refresh attendance QR" @click="attempt(()=>refreshQr(true))"><svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': qrBusy }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh QR</span></button><button @click="fullscreen">Full screen</button></div>
          </div>
        </section>
        <AttendanceImportWizard v-else-if="tab==='import' && hasPermission('attendance:import')" :branch-id="branchId" :fields="config.fields || []" :templates="config.templates || []" @configuration="attempt(loadConfiguration)" @done="tab='history'" />
        <section v-else-if="tab==='history' && hasPermission('attendance:import')">
          <h2>Import History</h2><div class="table-wrap"><table><thead><tr><th>File</th><th>Date</th><th>Uploaded by</th><th>Imported</th><th>Rejected</th><th>Review</th><th>Status</th><th>Action</th></tr></thead><tbody><tr v-for="b in batches" :key="b.id"><td>{{ b.sourceFileName || b.id }}</td><td>{{ timestamp(b.createdAt) }}</td><td>{{ b.importedBy }}</td><td>{{ b.validRows }}</td><td>{{ b.rejectedRows }}</td><td>{{ b.reviewRows || 0 }}</td><td>{{ b.status || 'Completed' }}</td><td><button @click="batchDetails=b">View</button></td></tr><tr v-if="!batches.length"><td colspan="8">No imports yet.</td></tr></tbody></table></div>
        </section>
        <p v-else>You do not have permission to import attendance.</p>
      </div>
      <div v-if="selected || batchDetails" class="overlay" role="dialog" aria-modal="true" aria-label="Attendance details" @click.self="selected=null;batchDetails=null" @keydown.esc="selected=null;batchDetails=null">
        <article class="dialog">
          <div class="heading"><h2>{{ selected ? 'Attendance Record' : 'Import Details' }}</h2><button type="button" class="attendance-dialog-close" aria-label="Close details" @click="selected=null;batchDetails=null"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6" stroke-linecap="round" /></svg></button></div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <template v-if="selected">
            <p>{{ selected.employeeName }} · {{ selected.date }} · {{ selectedBranch?.clinicBranch }}</p>
            <dl><dt>Source</dt><dd>{{ valueFor(selected,'sourceLabel') }}</dd><dt>Verification</dt><dd>{{ selected.locationVerified ? 'Location verified' : 'Not verified' }}</dd><dt>Distance / accuracy</dt><dd>{{ selected.locationDistanceMeters ?? '—' }} m / {{ selected.locationAccuracyMeters ?? '—' }} m</dd><dt>Work minutes</dt><dd>{{ selected.totalWorkedMinutes ?? '—' }}</dd><dt>Import batch</dt><dd>{{ selected.importBatchId || '—' }}</dd></dl>
            <a v-if="selected.proofUrl" :href="selected.proofUrl" target="_blank" rel="noopener">Open attendance proof</a>
            <form v-if="hasPermission('attendance:update')" @submit.prevent="saveCorrection">
              <div class="filters"><label>Time In<input v-model="edit.timeIn" required placeholder="08:30" /></label><label>Time Out<input v-model="edit.timeOut" placeholder="17:30" /></label></div>
              <label class="inline"><input v-model="edit.overnight" type="checkbox" /> Overnight shift</label>
              <label v-for="f in activeFields" :key="f.id">{{ f.label }}
                <select v-if="f.type==='dropdown'" v-model="edit.customFields[f.id]"><option value="">Not set</option><option v-for="o in f.options" :key="o">{{ o }}</option></select>
                <select v-else-if="f.type==='boolean'" v-model="edit.customFields[f.id]"><option :value="null">Not set</option><option :value="true">Yes</option><option :value="false">No</option></select>
                <input v-else-if="f.type==='number'" v-model.number="edit.customFields[f.id]" type="number" step="any" />
                <input v-else v-model="edit.customFields[f.id]" :type="f.type==='date'?'date':'text'" maxlength="1000" />
              </label>
              <label>Reason for correction<textarea v-model="reason" required minlength="5" maxlength="1000" /></label>
              <button :disabled="busy">Save audited correction</button>
            </form>
            <h3>Correction history</h3><p v-if="!audit.length">No corrections.</p>
            <div v-for="entry in audit" :key="entry.id" class="panel"><p>{{ timestamp(entry.createdAt) }} · {{ entry.correctedBy }}</p><p>{{ entry.reason }}</p><p>{{ entry.before?.timeIn || '—' }} – {{ entry.before?.timeOut || '—' }} → {{ entry.after?.timeIn || '—' }} – {{ entry.after?.timeOut || '—' }}</p></div>
          </template>
          <template v-else><p>{{ batchDetails.sourceFileName }} · {{ timestamp(batchDetails.createdAt) }}</p><p>Batch: {{ batchDetails.id }}</p><ul><li v-for="(issue,i) in [...(batchDetails.rejected || []),...(batchDetails.review || [])]" :key="i">Row {{ issue.row }}: {{ issue.reason }}</li></ul><p v-if="!batchDetails.rejected?.length && !batchDetails.review?.length">No recorded validation issues.</p></template>
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped>
.attendance { background: #fffaf4 !important; color: #3d281d; font-size: 14px; }
.shell { width: 100%; max-width: none; margin: 0 auto; padding: 8px; }
.attendance-page-heading { padding-bottom: 20px; border-bottom: 1px solid #ead2b2; }
.attendance-eyebrow { margin: 0 0 8px; color: #a8754e; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
h1 { font-size: clamp(24px, 2.5vw, 32px); font-weight: 700; color: #3d281d; }
h2,h3 { font-weight: 700; font-size: 18px; margin: 12px 0; color: #4f3526; }
.summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 16px; margin: 24px 0; }
.summary > div { border: 1px solid #ead2b2; border-radius: 12px; padding: 20px; background: #fffdf9; }
.summary small { color: #8a725f; font-size: 12px; }
.summary strong { display: block; margin-top: 8px; font-size: 28px; font-weight: 700; color: #3d281d; }
.attendance-tabs { display: flex; gap: 8px; border-bottom: 1px solid #ead2b2; margin-bottom: 24px; overflow-x: auto; }
.attendance .attendance-tabs button { flex-shrink: 0; min-height: 48px; padding: 12px 18px; border: 0; border-bottom: 3px solid transparent; border-radius: 0 !important; background: transparent !important; box-shadow: none; color: #8a725f !important; font-size: 14px; font-weight: 600; white-space: nowrap; }
.attendance .attendance-tabs button:hover { color: #8d5c3c !important; background: #fff6e9 !important; }
.attendance .attendance-tabs button.active { border-bottom-color: #8d5c3c; color: #8d5c3c !important; }
.attendance :deep(button) { border: 1px solid #dec19e; border-radius: 9px; padding: 9px 13px; font-size: 13px; cursor: pointer; color: #735039; background: #fffdf9; min-height: 38px; }
.attendance :deep(button:hover:not(:disabled)) { border-color: #b78055; background: #f4e7d5; }
.attendance :deep(button:disabled) { opacity: .45; cursor: not-allowed; }
.filters { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); align-items: end; gap: 18px; margin: 18px 0; }
.shell > .filters { padding: 20px; border: 1px solid #ead2b2; border-radius: 12px; background: #fffdf9; }
.attendance :deep(label) { display: block; font-size: 13px; color: #5d4536; margin: 0; font-weight: 600; }
.attendance :deep(input:not([type=checkbox])), .attendance :deep(select), .attendance :deep(textarea) { display: block; background: #fffdf9 !important; color: #3d281d !important; border: 1px solid #dec19e; border-radius: 9px; padding: 10px 12px; width: 100%; min-height: 44px; margin-top: 8px; font-size: 14px; color-scheme: light; }
.attendance :deep(select option) { color: #3d281d; background: #fffdf9; }
.attendance :deep(.appearance-select) { margin: 0; }
.attendance :deep(.appearance-select-trigger) { min-height: 44px; }
.inline { display: inline-flex !important; align-items: center; gap: 8px; margin: 12px 18px 12px 0 !important; }
.attendance :deep(input[type=checkbox]) { accent-color: #8d5c3c; }
.heading { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 16px; }
.attendance-records-panel { border: 1px solid #ead2b2; border-radius: 14px; padding: 20px; background: #fffdf9; }
.table-wrap { overflow: auto; border: 1px solid #ead2b2; border-radius: 12px; background: #fffdf9; }
table { width: 100%; text-align: left; font-size: 14px; }
th,td { padding: 14px 16px; white-space: nowrap; border-bottom: 1px solid #f0dfc9; }
th { color: #765237; background: #f7ead5; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
tbody tr:last-child td { border-bottom: 0; }
td[colspan] { padding: 40px 20px; text-align: center; color: #8a725f; }
.badge { border-radius: 999px; background: #f1ebe4; color: #735039; padding: 5px 10px; font-size: 12px; font-weight: 600; }
.good { background: #e5f2ea; color: #28765c; }.review { background: #f7ead5; color: #886130; }
.panel { border: 1px solid #ead2b2; border-radius: 12px; padding: 20px; margin: 18px 0; background: #fffaf4; }
.station { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fffdf9; }
.station img { width: min(100%,360px); margin: 16px auto; border: 1px solid #ead2b2; border-radius: 12px; padding: 16px; background: white; }
.station:fullscreen { padding: 30px; }.station:fullscreen img { width: min(60vh,600px); }
p { font-size: 14px; color: #8a725f; margin: 10px 0; line-height: 1.65; }
.error { color: #a12d22; background: #fff1ed; padding: 12px 16px; border: 1px solid #e4b7ad; border-radius: 10px; }
.overlay { position: fixed; inset: 0; z-index: 60; background: #28180fb3; backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.dialog { width: 100%; max-width: 760px; max-height: 90dvh; overflow: auto; border: 1px solid #ead2b2; border-radius: 16px; background: #fffdf9; padding: 24px; }
.dialog > .heading { border-bottom: 1px solid #ead2b2; padding-bottom: 16px; }
.attendance .attendance-dialog-close { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; flex-shrink: 0; }
dl { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; padding: 16px; background: #fffaf4; border-radius: 12px; }
dt { color: #8a725f; }a { color: #8d5c3c; }summary { cursor: pointer; font-size: 14px; font-weight: 600; }li { margin: 8px 0; font-size: 14px; }
.attendance :deep(:is(button,input,select,textarea):focus-visible) { outline: 2px solid #b78055; outline-offset: 2px; }
.attendance :deep(.steps) { flex-wrap: wrap; gap: 10px; }
.attendance :deep(.steps span) { background: #f4e7d5; color: #8a725f; padding: 8px 12px; }
.attendance :deep(.steps .active) { background: #8d5c3c; color: #fffaf4; }
.attendance :deep(.buttons) { align-items: center; flex-wrap: wrap; }
.attendance :deep(section > .panel) { background: #fffdf9; border-color: #ead2b2; }
@media(max-width:1000px) { .summary { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:640px) { .shell { padding: 0; }.summary { gap: 12px; }.summary > div { padding: 16px; }.summary strong { font-size: 24px; }.heading { flex-wrap: wrap; }.filters { grid-template-columns: 1fr; }.attendance-records-panel { padding: 16px; }.dialog { padding: 16px; }.dialog dl { grid-template-columns: 1fr; gap: 4px; }.dialog dd { margin: 0 0 10px; overflow-wrap: anywhere; }.station:fullscreen { padding: 16px; }.station:fullscreen img { width: min(100%,420px); }.attendance-tabs { gap: 0; }.attendance .attendance-tabs button { padding: 12px 14px; } }
</style>
