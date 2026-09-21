<script setup>
import { ref, computed, watch } from 'vue'
import { attendanceApi } from '@/utils/attendanceApi'
const props = defineProps({ branchId: String, fields: Array, templates: Array })
const emit = defineEmits(['done', 'configuration'])
const step = ref(1), busy = ref(false), error = ref(''), sheet = ref(null), mapping = ref({}), mode = ref('shift'), overnight = ref(false), preview = ref(null), templateName = ref('')
const targets = computed(() => ['employeeId','email','date', ...(mode.value === 'shift' ? ['timeIn','timeOut'] : ['time','direction'])])
async function attempt(fn) { busy.value = true; error.value = ''; try { await fn() } catch(e) { error.value = e.message } finally { busy.value = false } }
watch(() => props.branchId, () => { sheet.value = null; step.value = 1; preview.value = null })
async function upload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  await attempt(async () => {
    if (file.size > 3 * 1024 * 1024) throw new Error('Maximum file size is 3 MB.')
    const content = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file) })
    sheet.value = await attendanceApi('imports/preview', { branchId: props.branchId, fileName: file.name, content })
    mapping.value = Object.fromEntries(sheet.value.headers.map(header => [header, targets.value.find(key => key.toLowerCase() === header.toLowerCase()) || '']))
    preview.value = null
  })
}
async function next() {
  await attempt(async () => {
    if (step.value === 1 && !sheet.value) throw new Error('Upload a file first.')
    if (step.value === 2) preview.value = await attendanceApi('imports/validate', { branchId: props.branchId, ...sheet.value, mapping: mapping.value, mode: mode.value, overnight: overnight.value })
    if (step.value === 4) { await attendanceApi('imports/commit', { previewId: preview.value.previewId }); emit('done'); step.value = 1; sheet.value = null; return }
    step.value++
  })
}
function applyTemplate(event) { const template = props.templates.find(t => t.id === event.target.value); if (template) { mapping.value = { ...template.mapping }; mode.value = template.mode } }
async function saveTemplate() { await attempt(async () => { await attendanceApi('template', { branchId: props.branchId, name: templateName.value, mapping: mapping.value, mode: mode.value }); emit('configuration'); templateName.value = '' }) }
</script>
<template>
  <section>
    <h2>Import Attendance</h2>
    <div class="steps"><span v-for="(label,i) in ['Upload','Map Columns','Validate','Confirm']" :key="label" :class="{ active: step === i + 1 }">{{ i + 1 }}. {{ label }}</span></div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="panel">
      <template v-if="step === 1">
        <h3>Upload CSV or Excel</h3><p>Historical records · UTF-8 CSV or .xlsx · up to 400 rows / 3 MB.</p>
        <input aria-label="Attendance file" type="file" accept=".csv,.xlsx" :disabled="busy || !branchId" @change="upload" />
        <div v-if="sheet" class="overflow"><p>{{ sheet.fileName }} — {{ sheet.rows.length }} rows</p><table><thead><tr><th v-for="header in sheet.headers" :key="header">{{ header }}</th></tr></thead><tbody><tr v-for="(row,i) in sheet.rows.slice(0,3)" :key="i"><td v-for="(value,j) in row" :key="j">{{ value }}</td></tr></tbody></table></div>
      </template>
      <template v-else-if="step === 2">
        <h3>Map Imported Columns</h3>
        <label>Row format<select v-model="mode"><option value="shift">One row per shift</option><option value="punch">One row per punch (in/out)</option></select></label>
        <label>Saved mapping<select @change="applyTemplate"><option value="">Select template</option><option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option></select></label>
        <p>Dates: YYYY-MM-DD. Times: 24-hour or AM/PM. All times use Asia/Manila.</p>
        <label v-for="header in sheet.headers" :key="header">{{ header }}<select v-model="mapping[header]"><option value="">Ignore column</option><option v-for="target in targets" :key="target">{{ target }}</option><option v-for="field in fields.filter(f => !f.archived)" :key="field.id" :value="`custom:${field.id}`">{{ field.label }}</option></select></label>
        <label><input v-model="overnight" type="checkbox" /> Shifts can end the following day</label>
        <div class="buttons"><input v-model="templateName" placeholder="Mapping template name" aria-label="Mapping template name" /><button type="button" :disabled="busy || !templateName" @click="saveTemplate">Save mapping</button></div>
      </template>
      <template v-else>
        <h3>{{ step === 3 ? 'Validate Records' : 'Review Before Import' }}</h3>
        <p>{{ preview.validRows }} valid · {{ preview.rejectedRows }} invalid · {{ preview.reviewRows }} need review</p>
        <p>Only valid records will be imported. Existing attendance will never be overwritten.</p>
        <ul><li v-for="(issue,i) in [...preview.rejected, ...preview.review]" :key="i">Row {{ issue.row }}: {{ issue.reason }}</li></ul>
        <div class="overflow"><table><thead><tr><th>Employee</th><th>Date</th><th>Time In</th><th>Time Out</th></tr></thead><tbody><tr v-for="r in preview.valid" :key="`${r.employeeId}-${r.date}`"><td>{{ r.employeeName }}</td><td>{{ r.date }}</td><td>{{ r.timeIn }}</td><td>{{ r.timeOut }}</td></tr></tbody></table></div>
      </template>
    </div>
    <div class="buttons"><button :disabled="step === 1 || busy" @click="step--">Back</button><button :disabled="busy || (step === 4 && !preview?.validRows)" @click="next">{{ busy ? 'Processing…' : step === 4 ? 'Confirm Import' : 'Next' }}</button></div>
  </section>
</template>
<style scoped>
.panel{border:1px solid #27272a;border-radius:12px;padding:20px;margin:16px 0}h2,h3{font-weight:600;margin-bottom:12px}p{font-size:13px;color:#a1a1aa;margin:10px 0}.steps{display:flex;gap:6px;font-size:12px}.steps span{border-radius:20px;background:#27272a;padding:3px 8px}.steps .active{background:#172554;color:#93c5fd}label{display:block;margin:12px 0;font-size:13px}select,input:not([type=checkbox]){display:block;background:#09090b;border:1px solid #3f3f46;border-radius:8px;padding:8px;width:100%;margin-top:5px}button{border:1px solid #52525b;border-radius:20px;padding:6px 16px;font-size:13px}button:disabled{opacity:.4}.buttons{display:flex;justify-content:space-between;gap:12px}.overflow{overflow:auto;max-height:300px}th,td{padding:8px;border-bottom:1px solid #27272a;text-align:left;white-space:nowrap;font-size:12px}.error{color:#fca5a5}li{font-size:13px;color:#fcd34d;margin:6px 0}
</style>
