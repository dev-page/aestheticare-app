<script setup>
import { ref, watch } from 'vue'
import { attendanceApi } from '@/utils/attendanceApi'

const props = defineProps({ branchId: String })
const emit = defineEmits(['done'])
const templateHeaders = ['employee_email', 'date', 'time_in', 'time_out', 'clock_out_date', 'unpaid_break_minutes']
const fileInput = ref(null)
const selectedFileName = ref('')
const preview = ref(null)
const busy = ref(false)
const error = ref('')
const successMessage = ref('')

watch(() => props.branchId, () => clearPreview())

function clearPreview() {
  preview.value = null
  selectedFileName.value = ''
  successMessage.value = ''
  error.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function attempt(action) {
  busy.value = true
  error.value = ''
  try { await action() }
  catch (cause) { error.value = cause?.message || 'Attendance import could not be completed.' }
  finally { busy.value = false }
}

function downloadTemplate() {
  const csv = `${templateHeaders.join(',')}\r\n`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'attendance-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function upload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (fileInput.value) fileInput.value.value = ''
  preview.value = null
  selectedFileName.value = file.name
  successMessage.value = ''
  await attempt(async () => {
    if (file.size > 3 * 1024 * 1024) throw new Error('Maximum file size is 3 MB.')
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
      reader.onerror = () => reject(new Error('The selected file could not be read.'))
      reader.readAsDataURL(file)
    })
    preview.value = await attendanceApi('imports/preview', { branchId: props.branchId, fileName: file.name, content })
  })
}

async function confirmImport() {
  if (!preview.value?.previewId || !preview.value.validRows) return
  await attempt(async () => {
    const result = await attendanceApi('imports/commit', { previewId: preview.value.previewId })
    successMessage.value = result.alreadyImported
      ? 'These attendance records were already imported. No duplicate records were created.'
      : `${result.importedRows} attendance record${result.importedRows === 1 ? '' : 's'} imported.`
    emit('done')
  })
}

function hoursAndMinutes(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0)
  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`
}
</script>

<template>
  <section class="import-card" aria-labelledby="attendance-import-title">
    <div class="import-heading">
      <div>
        <p class="eyebrow">Historical records</p>
        <h2 id="attendance-import-title">Import attendance</h2>
        <p class="intro">Upload one row per staff member per workday. The system checks staff, dates, duplicates, and unpaid breaks before saving anything.</p>
      </div>
      <button type="button" class="secondary-button" @click="downloadTemplate">Download template</button>
    </div>

    <aside class="import-note">
      <strong>Use the staff member’s registered email.</strong>
      <span>Required columns: <code>employee_email</code>, <code>date</code>, <code>time_in</code>, and <code>time_out</code>. Use YYYY-MM-DD dates and 24-hour or AM/PM times. Example: <code>staff@clinic.com,2026-03-25,08:30,17:30,,60</code>. Enter <code>clock_out_date</code> only for a next-day clock-out. Leave <code>unpaid_break_minutes</code> blank to use the assigned shift; enter 0 when there was no unpaid break or no schedule is available.</span>
    </aside>

    <label class="file-picker">
      <span class="file-picker-title">Attendance file</span>
      <span class="file-picker-hint">CSV or Excel .xlsx · up to 400 rows · maximum 3 MB</span>
      <input ref="fileInput" type="file" accept=".csv,.xlsx" :disabled="busy || !branchId" @change="upload" />
    </label>

    <p v-if="error" class="message error" role="alert">{{ error }}</p>
    <p v-if="successMessage" class="message success" role="status">{{ successMessage }}</p>
    <p v-if="busy" class="message progress" role="status">{{ preview ? 'Saving attendance…' : 'Checking the file and matching scheduled breaks…' }}</p>

    <template v-if="preview">
      <div class="preview-heading">
        <div>
          <h3>{{ preview.fileName || selectedFileName }}</h3>
          <p>Review these results before importing. Existing attendance will never be overwritten.</p>
        </div>
        <button type="button" class="text-button" :disabled="busy" @click="clearPreview">Choose another file</button>
      </div>

      <div class="counts" aria-live="polite">
        <div><strong>{{ preview.validRows }}</strong><span>Ready to import</span></div>
        <div :class="{ 'has-errors': preview.rejectedRows }"><strong>{{ preview.rejectedRows }}</strong><span>Rows to fix</span></div>
      </div>

      <p v-if="preview.ignoredColumns?.length" class="message warning">These extra columns will be ignored: {{ preview.ignoredColumns.join(', ') }}.</p>

      <div v-if="preview.valid?.length" class="table-wrap">
        <table>
          <thead><tr><th>Staff member</th><th>Work date</th><th>Time</th><th>Unpaid break</th><th>Paid time</th></tr></thead>
          <tbody>
            <tr v-for="record in preview.valid" :key="`${record.employeeId}-${record.date}`">
              <td>{{ record.employeeName }}</td>
              <td>{{ record.date }}</td>
              <td>{{ record.timeIn.slice(0, 5) }} – {{ record.timeOut.slice(0, 5) }}<small v-if="record.date !== record.clockOutDate">Next-day clock-out</small></td>
              <td>{{ record.unpaidMealBreakMinutes }} min</td>
              <td>{{ hoursAndMinutes(record.paidMinutes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="preview.rejected?.length" class="rejected-list">
        <h3>Rows to fix</h3>
        <ul><li v-for="issue in preview.rejected" :key="`${issue.row}-${issue.reason}`"><strong>Row {{ issue.row }}:</strong> {{ issue.reason }}</li></ul>
      </div>

      <div class="actions">
        <span>Imported records are marked unverified because they did not use the clinic QR location check.</span>
        <button type="button" class="primary-button" :disabled="busy || !preview.validRows" @click="confirmImport">{{ busy ? 'Please wait…' : `Import ${preview.validRows} valid row${preview.validRows === 1 ? '' : 's'}` }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.import-card { padding: 22px; border: 1px solid #ead2b2; border-radius: 14px; background: #fffdf9; color: #3d281d; }
.import-heading, .preview-heading, .actions { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.eyebrow { margin: 0 0 5px; color: #a8754e; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
h2, h3 { margin: 0; color: #4f3526; font-size: 18px; font-weight: 700; }
.intro, .preview-heading p { max-width: 760px; margin: 7px 0 0; color: #735039; font-size: 13px; line-height: 1.6; }
.import-note { display: grid; gap: 6px; margin: 20px 0; padding: 14px 16px; border: 1px solid #ead2b2; border-left: 3px solid #b78055; border-radius: 10px; background: #fff8ee; color: #735039; font-size: 13px; line-height: 1.6; }
.import-note strong { color: #4f3526; }
code { padding: 1px 4px; border-radius: 4px; background: #f2e4d3; color: #4f3526; font-family: ui-monospace, monospace; font-size: 12px; }
.file-picker { display: grid; gap: 5px; padding: 16px; border: 1px dashed #c99c72; border-radius: 10px; background: #fffaf4; cursor: pointer; }
.file-picker-title { color: #4f3526; font-size: 14px; font-weight: 700; }
.file-picker-hint { color: #8a725f; font-size: 12px; }
.file-picker input { margin-top: 8px; color: #5d4536; }
.secondary-button, .text-button, .primary-button { min-height: 40px; padding: 9px 14px; border: 1px solid #dec19e; border-radius: 9px; color: #735039; background: #fffdf9; font-size: 13px; font-weight: 600; cursor: pointer; }
.primary-button { border-color: #8d5c3c; background: #8d5c3c; color: #fffaf4; }
.text-button { border-color: transparent; background: transparent; text-decoration: underline; text-underline-offset: 3px; }
button:disabled { cursor: not-allowed; opacity: .5; }
.message { margin: 14px 0; padding: 11px 14px; border-radius: 9px; font-size: 13px; line-height: 1.5; }
.error { border: 1px solid #e4b7ad; background: #fff1ed; color: #8d2d24; }
.success { border: 1px solid #a9d4b2; background: #eff9f0; color: #27613b; }
.progress { border: 1px solid #ead2b2; background: #fff8ee; color: #735039; }
.warning { border: 1px solid #e6ca94; background: #fff7e8; color: #75551f; }
.preview-heading { align-items: center; margin-top: 22px; padding-top: 18px; border-top: 1px solid #f0dfc9; }
.counts { display: flex; gap: 12px; margin: 16px 0; }
.counts > div { display: grid; gap: 2px; min-width: 150px; padding: 12px 14px; border: 1px solid #c9dfc9; border-radius: 10px; background: #f2faf1; color: #27613b; }
.counts > div.has-errors { border-color: #e8c5a4; background: #fff7ee; color: #8a4c23; }
.counts strong { font-size: 22px; }
.counts span { font-size: 12px; }
.table-wrap { max-height: 380px; overflow: auto; border: 1px solid #ead2b2; border-radius: 10px; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
th, td { padding: 11px 13px; border-bottom: 1px solid #f0dfc9; white-space: nowrap; }
th { position: sticky; top: 0; background: #f7ead9; color: #5d4536; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
td { color: #4f3526; }
td small { display: block; margin-top: 3px; color: #8a725f; }
.rejected-list { margin-top: 18px; padding: 14px 16px; border: 1px solid #e8c5a4; border-radius: 10px; background: #fff7ee; }
.rejected-list ul { display: grid; gap: 7px; margin: 10px 0 0; padding-left: 20px; color: #75502e; font-size: 13px; }
.actions { align-items: center; margin-top: 18px; padding-top: 16px; border-top: 1px solid #f0dfc9; }
.actions span { max-width: 520px; color: #8a725f; font-size: 12px; line-height: 1.5; }
@media (max-width: 700px) { .import-card { padding: 16px; }.import-heading, .preview-heading, .actions { flex-direction: column; align-items: stretch; }.counts { flex-direction: column; }.counts > div { min-width: 0; }.actions .primary-button { width: 100%; } }
</style>
