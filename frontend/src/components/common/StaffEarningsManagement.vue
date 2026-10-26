<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { compensationApi } from '@/utils/compensationApi'
import { loadOwnerBranchScope, loadClinicDocsByIds } from '@/utils/ownerBranchScope'
import { usePermissions } from '@/composables/usePermissions'
import PractitionerProfileEditor from './PractitionerProfileEditor.vue'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'
import Modal from './Modal.vue'
import { isPractitionerEmployee } from '../../../../shared/practitionerTeam.js'
const { hasPermission, isClinicAdminOwner } = usePermissions()
const emit = defineEmits(['loading'])
const branches = ref([]), branchId = ref(''), staff = ref([]), appointments = ref([]), earnings = ref([]), busy = ref(true), error = ref(''), notice = ref(''), employeeId = ref(''), reviewing = ref(null), preview = ref([])
watch(busy, active => emit('loading', active), { immediate: true })
const reviewNote = ref('')
const payrollMonth = ref(new Date().toISOString().slice(0, 7))
const pending = computed(() => appointments.value.filter(item => item.staffEarningsStatus !== 'Approved'))
const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0)
const api = async (path, body) => {
  return compensationApi(path, body === undefined ? 'GET' : 'POST', body)
}
const load = async () => {
  if (!branchId.value) return
  busy.value = true; error.value = ''
  try {
    const people = await getDocs(query(collection(db, 'users'), where('branchId', '==', branchId.value)))
    staff.value = people.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(isPractitionerEmployee)
    if (!staff.value.some(item => item.id === employeeId.value)) employeeId.value = ''
    const [visits, ledger] = await Promise.all([api('/staff-earnings/appointments?branchId=' + encodeURIComponent(branchId.value)), api('/staff-earnings?branchId=' + encodeURIComponent(branchId.value))])
    appointments.value = visits
    earnings.value = ledger
  } catch (cause) { error.value = cause.message } finally { busy.value = false }
}
const review = async item => {
  busy.value = true; error.value = ''; notice.value = ''; reviewNote.value = ''
  try { preview.value = await api('/appointments/' + item.id + '/staff-earnings'); reviewing.value = item; payrollMonth.value = String(item.date || new Date().toISOString()).slice(0, 7) }
  catch (cause) { error.value = cause.message } finally { busy.value = false }
}
const approve = async () => {
  busy.value = true; error.value = ''
  try { await api('/appointments/' + reviewing.value.id + '/staff-earnings/approve', { payrollMonth: payrollMonth.value, reviewNote: reviewNote.value }); reviewing.value = null; notice.value = 'Staff earnings approved. Regenerate payroll for this period to include them.'; await load() }
  catch (cause) { error.value = cause.message } finally { busy.value = false }
}
const reversalRequestId = ref('')
const reversal = ref(null), reversalAmount = ref(0), reversalReason = ref(''), reversalMonth = ref('')
const openReversal = item => { reversalRequestId.value = crypto.randomUUID(); reversal.value = item; reversalAmount.value = Math.max(0, item.amount - Number(item.reversedAmount || 0)); reversalReason.value = ''; reversalMonth.value = new Date().toISOString().slice(0, 7) }
const reverse = async () => {
  busy.value = true; error.value = ''
  try { await api('/staff-earnings/' + reversal.value.id + '/reverse', { requestId: reversalRequestId.value, amount: reversalAmount.value, reason: reversalReason.value, monthKey: reversalMonth.value }); reversal.value = null; notice.value = 'A separate reversal was recorded. Original earnings and approved payroll remain preserved.'; await load() }
  catch (cause) { error.value = cause.message } finally { busy.value = false }
}
onMounted(async () => {
  try { const scope = await loadOwnerBranchScope(db, auth.currentUser.uid); branches.value = await loadClinicDocsByIds(db, scope.branchIds); branchId.value = scope.branchId || branches.value[0]?.id || '' }
  catch (cause) { error.value = cause.message; busy.value = false }
  if (!branchId.value) busy.value = false
})
watch(branchId, () => { employeeId.value = ''; load() })
</script>
<template>
  <section class="earnings-management">
    <header><div><h1>Staff Compensation &amp; Earnings</h1><p>Configure individual service agreements, review completed treatments, and approve earnings for payroll.</p></div><ContractAppearanceSelect id="earnings-branch" label="Branch" v-model="branchId" :options="branches.map(item => ({ value: item.id, label: item.clinicBranch || item.clinicName || item.id }))" /></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <section v-if="isClinicAdminOwner" class="earnings-card">
      <h2>Practitioner profiles &amp; agreements</h2><p>Set service commissions and fees for clinical practitioners, including treatment leads and assistants. Base pay for all employees is configured in the Base Pay tab.</p>
      <ContractAppearanceSelect id="earnings-employee" label="Practitioner" v-model="employeeId" :disabled="busy || !staff.length" :options="[{ value: '', label: 'Choose a practitioner' }, ...staff.map(item => ({ value: item.id, label: (item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email) + (item.practitionerType ? ' — ' + item.practitionerType : '') }))]" />
      <p v-if="!busy && !staff.length">No active practitioners found for this branch. Assign the Practitioner role or a professional specialty in Employee Management first.</p>
      <PractitionerProfileEditor v-if="employeeId" :key="employeeId" :employee-id="employeeId" :branch-id="branchId" />
    </section>
    <section class="earnings-card"><div class="section-heading"><h2>Completed services awaiting earnings review</h2><button type="button" aria-label="Refresh earnings" title="Refresh earnings" :disabled="busy" @click="load"><svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': busy }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg><span class="sr-only">Refresh</span></button></div><p>An independent owner or Finance reviewer checks each team's saved agreements and participation. Approve these earnings before approving the month's payroll.</p>
      <div class="table-scroll"><table><thead><tr><th>Client</th><th>Service</th><th>Schedule</th><th>Team</th><th>Action</th></tr></thead><tbody><tr v-for="item in pending" :key="item.id"><td>{{ item.customerName || item.clientName }}</td><td>{{ item.service }}</td><td>{{ item.date }} {{ item.time }}</td><td>{{ item.treatmentTeam?.map(member => member.name).join(', ') || 'Legacy appointment' }}</td><td><button type="button" :disabled="busy" @click="review(item)">Review earnings</button></td></tr><tr v-if="!pending.length"><td colspan="5">No completed services awaiting review.</td></tr></tbody></table></div>
    </section>
    <section class="earnings-card"><h2>Approved staff earnings</h2><div class="table-scroll"><table><thead><tr><th>Employee</th><th>Service</th><th>Responsibility</th><th>Period</th><th>Earnings</th><th>Payroll / Adjustments</th></tr></thead><tbody><tr v-for="item in earnings" :key="item.id"><td>{{ item.employeeName }}</td><td>{{ item.service }}<p v-if="item.adjustmentOf">Reversal: {{ item.reason }}</p></td><td>{{ item.responsibility }}</td><td>{{ item.monthKey }}</td><td>{{ money(item.amount) }}</td><td>{{ item.payrollPaidAt ? 'Paid through payroll' : item.payrollSummaryId ? 'Included in approved payroll' : 'Awaiting payroll' }}<button v-if="hasPermission('payroll:approve') && !item.adjustmentOf && item.amount > Number(item.reversedAmount || 0)" type="button" :disabled="busy" @click="openReversal(item)">Record reversal</button></td></tr><tr v-if="!earnings.length"><td colspan="6">No approved staff earnings.</td></tr></tbody></table></div></section>
    <Modal :is-open="!!reversal" :panel-style="{ maxWidth: '40rem', background: '#fffdf9', color: '#493425' }" @close="reversal = null"><template #header><h2>Reverse staff earnings</h2></template><template #body><div class="earnings-review"><p>{{ reversal?.employeeName }} — {{ reversal?.service }}</p><p>Record an adjustment for a refund or correction. Choose an open payroll period.</p><p v-if="error" class="error" role="alert">{{ error }}</p><label>Amount (PHP)<input v-model.number="reversalAmount" type="number" min="0.01" step="0.01" /></label><label>Payroll month<input v-model="reversalMonth" type="month" /></label><label>Reason<textarea v-model="reversalReason" rows="3" minlength="10" maxlength="1000" /></label></div></template><template #footer><button class="earnings-action" type="button" :disabled="busy" @click="reverse">Record reversal</button></template></Modal>
    <Modal :is-open="!!reviewing" :panel-style="{ maxWidth: '64rem', background: '#fffdf9', color: '#493425' }" @close="reviewing = null"><template #header><h2>Review staff earnings</h2></template><template #body><div class="earnings-review"><p>{{ reviewing?.service }} — {{ reviewing?.date }}</p><p v-if="error" role="alert" class="error">{{ error }}</p><div class="table-scroll"><table><thead><tr><th>Employee</th><th>Role</th><th>Session basis</th><th>Saved rate</th><th>Earnings</th></tr></thead><tbody><tr v-for="item in preview" :key="item.employeeId"><td>{{ item.employeeName }}</td><td>{{ item.practitionerType }} / {{ item.responsibility }}</td><td>{{ money(item.baseAmount) }}</td><td>{{ item.rateSnapshot.model === 'percent' ? item.rateSnapshot.amount + '%' : money(item.rateSnapshot.amount) }}</td><td>{{ money(item.amount) }}</td></tr></tbody></table></div><p v-if="reviewing?.consultationNeedsReview" role="alert">This consultation was flagged for review. Check the clinical notes and duration before approval.</p><p v-if="reviewing?.consultationActualDurationSeconds != null">Recorded consultation duration: {{ Math.floor(reviewing.consultationActualDurationSeconds / 60) }} minutes</p><label v-if="reviewing?.consultationNeedsReview">Review explanation<textarea v-model="reviewNote" minlength="10" maxlength="1000" rows="3" /></label><label>Payroll period<input v-model="payrollMonth" type="month" /></label><p>Choose an open payroll period on or after completion. These terms were saved when treatment started. Every listed member has confirmed participation.</p></div></template><template #footer><button class="earnings-action" type="button" :disabled="busy || !hasPermission('payroll:approve')" @click="approve">Approve staff earnings</button></template></Modal>
  </section>
</template>
<style scoped>
.earnings-management{color:#493425}.earnings-management header{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:24px}.earnings-management h1{font-size:28px;font-weight:700}.earnings-management h2{font-size:18px;font-weight:600}.earnings-management p{font-size:13px;line-height:1.7;color:#755e4d;margin:10px 0}.earnings-card{background:#fffdf9;border:1px solid #e6c6a7;border-radius:12px;padding:20px;margin:20px 0}.section-heading{display:flex;justify-content:space-between;gap:16px}.table-scroll{overflow:auto;margin-top:16px}:is(.earnings-management,.earnings-review) table{width:100%;border-collapse:collapse;font-size:13px}:is(.earnings-management,.earnings-review) th{background:#f7ead5;text-align:left;font-size:11px;padding:12px}:is(.earnings-management,.earnings-review) td{padding:14px 12px;border-bottom:1px solid #eed8c2}:is(.earnings-management,.earnings-review) button,.earnings-action{padding:9px 12px;border:1px solid #dfbb99;border-radius:7px;background:#f5e8d6;color:#664329}.earnings-management .error{color:#ab3325}.earnings-review{color:#493425}.earnings-review label{display:block;margin:12px 0;font-size:13px}.earnings-review input,.earnings-review textarea{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #dfbb99;border-radius:7px;background:#fff;color:#493425;color-scheme:light}
</style>
