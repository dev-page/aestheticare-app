<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import QRCode from 'qrcode'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import AttendanceImportWizard from '@/components/common/AttendanceImportWizard.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import { attendanceApi } from '@/utils/attendanceApi'

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
onMounted(async () => {
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
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="flex min-h-screen owner-theme bg-black">
    <OwnerSidebar />
    <main class="attendance flex-1 min-w-0 p-3 md:p-6 text-white">
      <div class="shell">
        <h1>Attendance Management</h1>
        <div class="summary"><div v-for="[label,count] in summary" :key="label"><small>{{ label }}</small><strong>{{ count }}</strong></div></div>
        <nav aria-label="Attendance sections">
          <button v-for="[key,label] in [['records','Attendance Records'],['qr','QR Station'],['import','Import Attendance'],['history','Import History']]" :key="key" :class="{active:tab===key}" @click="tab=key">{{ label }}</button>
        </nav>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="busy" role="status">Loading attendance…</p>
        <div class="filters">
          <label>Branch<select v-model="branchId"><option v-if="!branches.length" value="">No authorized branches</option><option v-for="b in branches" :key="b.id" :value="b.id">{{ b.clinicBranch }}</option></select></label>
          <label v-if="tab==='records'">Date (Asia/Manila)<input v-model="date" type="date" /></label>
        </div>
        <section v-if="tab==='records'">
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
          <div class="filters"><label>Status<select v-model="status"><option value="">All statuses</option><option v-for="s in ['Complete','On Duty','Needs Review','Absent','Scheduled','On Leave','Holiday','Day Off']" :key="s">{{ s }}</option></select></label><label>Source<select v-model="source"><option value="">All sources</option><option value="imported">Imported</option><option value="built_in">QR + Location</option></select></label></div>
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
            <div class="heading"><button :disabled="qrBusy" @click="attempt(()=>refreshQr(true))">Refresh QR</button><button @click="fullscreen">Full screen</button></div>
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
          <div class="heading"><h2>{{ selected ? 'Attendance Record' : 'Import Details' }}</h2><button aria-label="Close details" @click="selected=null;batchDetails=null">Close</button></div>
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
  .attendance{background:#000;color:#f4f4f5;font-size:14px}.shell{max-width:1200px;margin:auto;border:1px solid #27272a;border-radius:14px;padding:18px}h1{font-size:26px;font-weight:700;border-bottom:1px solid #18181b;padding-bottom:16px}h2,h3{font-weight:600;font-size:17px;margin:12px 0}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.summary>div{border:1px solid #27272a;border-radius:10px;padding:14px}.summary small{color:#a1a1aa}.summary strong{display:block;font-size:28px;font-weight:600}nav{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #18181b;padding-bottom:16px;margin-bottom:16px}button{border:1px solid #3f3f46;border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer}button:hover{border-color:#a1a1aa}button.active{background:#fafafa;color:#09090b}button:disabled{opacity:.4;cursor:default}.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:14px 0}label{display:block;font-size:12px;color:#a1a1aa;margin:8px 0}input:not([type=checkbox]),select,textarea{display:block;background:#09090b!important;color:#fafafa!important;border:1px solid #3f3f46;border-radius:12px;padding:8px 12px;width:100%;margin-top:5px}.inline{display:inline-block;margin-right:14px}.heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.table-wrap{overflow:auto;border:1px solid #27272a;border-radius:10px;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}table{width:100%;text-align:left;font-size:12px}th,td{padding:10px;white-space:nowrap;border-bottom:1px solid #18181b}th{color:#a1a1aa}.badge{border-radius:20px;background:#172554;color:#93c5fd;padding:3px 8px;font-size:11px}.good{background:#052e16;color:#86efac}.review{background:#451a03;color:#fdba74}.panel{border:1px solid #27272a;border-radius:12px;padding:16px;margin:14px 0}.station{background:#000;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}.station img{width:min(100%,360px);margin:16px auto}.station:fullscreen{padding:30px}.station:fullscreen img{width:min(60vh,600px)}p{font-size:13px;color:#a1a1aa;margin:10px 0}.error{color:#fca5a5}.overlay{position:fixed;inset:0;z-index:60;background:#000c;display:flex;align-items:center;justify-content:center;padding:16px}.dialog{width:100%;max-width:680px;max-height:90vh;overflow:auto;border:1px solid #52525b;border-radius:16px;background:#09090b;padding:22px}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}dt{color:#a1a1aa}a{color:#93c5fd}summary{cursor:pointer;font-size:13px}li{margin:8px 0;font-size:13px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
  @media(max-width:640px){.attendance{font-size:13px}.shell{padding:12px;border-radius:10px}h1{font-size:21px;padding-bottom:12px}.summary{grid-template-columns:1fr}.summary strong{font-size:24px}.heading{align-items:flex-start;flex-direction:column}.heading>button{width:100%}.table-wrap{margin-inline:-1px}.dialog{max-height:calc(100dvh - 1.5rem);padding:16px}.dialog dl{grid-template-columns:1fr;gap:4px}.dialog dd{margin:0 0 10px;overflow-wrap:anywhere}.station:fullscreen{padding:16px}.station:fullscreen img{width:min(100%,420px)}nav button{flex:1 1 calc(50% - 6px);min-height:2.5rem}.inline{margin-right:0}.filters{grid-template-columns:1fr}}
</style>
