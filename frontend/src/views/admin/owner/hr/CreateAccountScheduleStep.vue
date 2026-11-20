<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { db } from '@/config/firebaseConfig'
import { recommendRecurringShifts } from '@/utils/shiftRecommendations'
import { parseShiftDurationHours } from '@/utils/employeeSchedules'
import { logActivity } from '@/utils/activityLogger'
import { compensationApi } from '@/utils/compensationApi'
import { toast } from 'vue3-toastify'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'

const props = defineProps({
  branchId: { type: String, default: '' },
  branchName: { type: String, default: '' },
  employeeId: { type: String, default: '' },
  employmentType: { type: String, default: '' },
  weeklyHoursTarget: { type: Number, default: 0 },
  modelValue: { type: Object, required: true },
  canViewShifts: { type: Boolean, default: false },
  canCreateShifts: { type: Boolean, default: false },
  canAssignShifts: { type: Boolean, default: false },
  allowEmptySchedule: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const loading = ref(false)
const savingShift = ref(false)
const shifts = ref([])
const capacitySchedules = ref([])
const shiftError = ref('')
const currentShift = ref({ name: '', start: '09:00', end: '17:00', capacity: 1, notes: '' })

const schedule = computed(() => props.modelValue || {})
const assignments = computed(() => Object.fromEntries(days.map(day => [day, String(schedule.value.assignments?.[day] || '')])))
const activeShifts = computed(() => shifts.value.filter(shift => !shift.isArchived))
const capacityCount = (day, shiftId) => capacitySchedules.value.reduce((count, item) => count + (item.assignments?.[day] === shiftId ? 1 : 0), 0)
const availableShiftsForDay = day => activeShifts.value.filter(shift => capacityCount(day, shift.id) < Number(shift.capacity || 1))
const shiftOptionsForDay = day => [
  { value: '', label: 'Off — no shift' },
  ...availableShiftsForDay(day).map(shift => ({
    value: shift.id,
    label: `${shift.shiftType || 'Shift'} · ${shift.start}–${shift.end} · ${Math.max(0, Number(shift.capacity || 1) - capacityCount(day, shift.id))} spots available`,
  })),
]
const validWeeklyCap = computed(() => {
  const cap = Number(schedule.value.weeklyHoursCap)
  const agreed = Number(props.weeklyHoursTarget)
  return Number.isFinite(cap) && cap > 0 && cap <= 48 && cap <= agreed
})
const validEffectiveMonday = computed(() => {
  const value = String(schedule.value.effectiveFrom || '')
  const date = new Date(`${value}T12:00:00`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(date.getTime())
    && date.getDay() === 1
    && value >= nextScheduleMonday()
})
const totalAssignedHours = computed(() => days.reduce((sum, day) => {
  const shift = shifts.value.find(entry => entry.id === assignments.value[day])
  return sum + (shift ? parseShiftDurationHours(shift) : 0)
}, 0))

const nextScheduleMonday = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const daysUntilMonday = (8 - date.getUTCDay()) % 7
  date.setUTCDate(date.getUTCDate() + daysUntilMonday)
  return date.toISOString().slice(0, 10)
}

const updateSchedule = (updates) => emit('update:modelValue', {
  ...schedule.value,
  branchId: props.branchId,
  effectiveFrom: schedule.value.effectiveFrom || nextScheduleMonday(),
  weeklyHoursCap: Number(schedule.value.weeklyHoursCap || props.weeklyHoursTarget || 0),
  assignments: { ...assignments.value },
  ...updates,
})

const capacityConflicts = computed(() => days.filter(day => {
  const shiftId = String(assignments.value[day] || '')
  if (!shiftId) return false
  const shift = shifts.value.find(entry => entry.id === shiftId)
  if (!shift) return false
  const alreadyAssigned = capacityCount(day, shiftId)
  return alreadyAssigned >= Number(shift.capacity || 1)
}))

const validationError = computed(() => {
  if (!props.branchId) return 'Choose a branch in the previous step before assigning a shift.'
  if (!props.canAssignShifts) return ''
  if (loading.value) return 'Wait for the branch shifts and capacity check to finish loading.'
  if (shiftError.value) return shiftError.value
  if (!props.allowEmptySchedule && !activeShifts.value.length) return 'Add at least one shift template before continuing.'
  if (!props.allowEmptySchedule && !days.some(day => assignments.value[day])) return 'Assign at least one shift day before continuing.'
  if (!validWeeklyCap.value) return 'The weekly schedule limit must be at least 1 hour and cannot exceed the agreed weekly hours or 48 hours.'
  if (!validEffectiveMonday.value) return 'Choose a current or future Monday for the schedule to take effect.'
  if (totalAssignedHours.value > Number(schedule.value.weeklyHoursCap || 0)) return `Assigned shifts total ${totalAssignedHours.value} hours, over the ${schedule.value.weeklyHoursCap}-hour weekly limit.`
  if (capacityConflicts.value.length) return `Shift capacity is full on ${capacityConflicts.value.join(', ')}. Choose another shift or day.`
  return ''
})

const recommendationPlan = computed(() => recommendRecurringShifts({
  days,
  shifts: activeShifts.value,
  assignments: Object.fromEntries(days.map(day => [day, ''])),
  employmentType: props.employmentType,
  targetHours: schedule.value.weeklyHoursCap || props.weeklyHoursTarget,
  schedules: capacitySchedules.value,
  employeeId: props.employeeId || '__new_employee__',
}))

const setAssignment = (day, shiftId) => {
  const shift = shifts.value.find(entry => entry.id === shiftId)
  const assignmentLabels = { ...(schedule.value.assignmentLabels || {}) }
  assignmentLabels[day] = shift ? `${shift.shiftType || 'Shift'} || ${shift.start || ''} - ${shift.end || ''}` : ''
  updateSchedule({ assignments: { ...assignments.value, [day]: shiftId || '' }, assignmentLabels })
}

const applySuggestions = () => {
  const next = Object.fromEntries(days.map(day => [day, recommendationPlan.value.suggestions[day]?.id || '']))
  const labels = Object.fromEntries(days.map(day => {
    const shift = recommendationPlan.value.suggestions[day]
    return [day, shift ? `${shift.shiftType || 'Shift'} || ${shift.start || ''} - ${shift.end || ''}` : '']
  }))
  updateSchedule({ assignments: next, assignmentLabels: labels })
}

const loadBranchData = async () => {
  if (!props.branchId || !props.canViewShifts) {
    shifts.value = []
    capacitySchedules.value = []
    shiftError.value = ''
    return
  }
  loading.value = true
  shiftError.value = ''
  try {
    const queryParams = new URLSearchParams({
      includeCapacity: props.canAssignShifts ? 'true' : 'false',
      effectiveFrom: schedule.value.effectiveFrom || nextScheduleMonday(),
      ...(props.employeeId ? { excludeEmployeeId: props.employeeId } : {}),
    })
    const result = await compensationApi(`/hr/branches/${encodeURIComponent(props.branchId)}/shift-templates?${queryParams}`)
    shifts.value = Array.isArray(result.shifts) ? result.shifts : []
    capacitySchedules.value = Array.isArray(result.capacitySchedules) ? result.capacitySchedules : []
  } catch (error) {
    shifts.value = []
    capacitySchedules.value = []
    shiftError.value = error.message || 'We could not load this branch’s shift templates. Retry before continuing.'
  } finally {
    loading.value = false
  }
}

const timeToMinutes = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const createShift = async () => {
  if (savingShift.value || !props.canCreateShifts || !props.branchId) return
  const name = String(currentShift.value.name || '').trim()
  const start = String(currentShift.value.start || '')
  const end = String(currentShift.value.end || '')
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  const capacity = Number(currentShift.value.capacity)
  if (!name || name.length > 80 || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    toast.error('Enter a shift name and valid same-day start and end times.')
    return
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    toast.error('Enter a staff capacity from 1 to 500.')
    return
  }
  if (String(currentShift.value.notes || '').length > 300) {
    toast.error('Shift notes must be 300 characters or fewer.')
    return
  }
  const duplicate = shifts.value.some(shift => !shift.isArchived
    && String(shift.shiftType || '').trim().toLowerCase() === name.toLowerCase()
    && shift.start === start && shift.end === end)
  if (duplicate) {
    toast.error('A shift with the same name and time already exists for this branch.')
    return
  }

  savingShift.value = true
  try {
    const payload = {
      name,
      start,
      end,
      unpaidMealBreakMinutes: 0,
      notes: String(currentShift.value.notes || '').trim(),
      capacity,
    }
    const result = await compensationApi(`/hr/branches/${encodeURIComponent(props.branchId)}/shifts`, 'POST', payload)
    const created = result.shift || {}
    shifts.value = [...shifts.value, { ...created, unpaidMealBreakMinutes: 0 }]
    await logActivity(db, {
      module: 'HR',
      action: 'Added shift',
      details: `Created ${name} shift (${start} - ${end}) for ${props.branchName}.`,
    }).catch(error => console.error('Unable to record shift creation activity:', error))
    currentShift.value = { name: '', start: '09:00', end: '17:00', capacity: 1, notes: '' }
    toast.success('Shift template added to this branch.')
  } catch (error) {
    toast.error(error.message || 'Unable to save the shift template. Please try again.')
  } finally {
    savingShift.value = false
  }
}

watch(() => [props.branchId, props.canViewShifts, props.canAssignShifts], (next, previous) => {
  const [nextBranchId] = next
  const [previousBranchId] = previous || []
  if (previousBranchId && previousBranchId !== nextBranchId) {
    emit('update:modelValue', {
      branchId: nextBranchId,
      effectiveFrom: nextScheduleMonday(),
      weeklyHoursCap: Number(props.weeklyHoursTarget || 0),
      assignments: Object.fromEntries(days.map(day => [day, ''])),
      assignmentLabels: Object.fromEntries(days.map(day => [day, ''])),
    })
  }
  loadBranchData()
}, { immediate: true })

watch(() => props.weeklyHoursTarget, (value) => {
  if (!Number(schedule.value.weeklyHoursCap)) updateSchedule({ weeklyHoursCap: Number(value || 0) })
})

onMounted(() => {
  if (!schedule.value.assignments || !schedule.value.branchId) {
    emit('update:modelValue', {
      branchId: props.branchId,
      effectiveFrom: nextScheduleMonday(),
      weeklyHoursCap: Number(props.weeklyHoursTarget || 0),
      assignments: Object.fromEntries(days.map(day => [day, ''])),
      assignmentLabels: Object.fromEntries(days.map(day => [day, ''])),
    })
  }
})

defineExpose({ validationError })
</script>

<template>
  <div class="employee-schedule-layout">
    <section class="schedule-panel">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="schedule-title">Assign the weekly schedule</h3>
          <p class="schedule-subtitle">{{ branchName }} · Choose one shift or leave a day off.</p>
        </div>
        <button v-if="canAssignShifts" type="button" class="schedule-dss-button" :disabled="loading || Boolean(shiftError) || !Object.keys(recommendationPlan.suggestions).length" :title="Object.keys(recommendationPlan.suggestions).length ? 'Apply a fresh DSS schedule using currently available capacity.' : 'No DSS schedule is available for the current employment type, hours, and shift capacity.'" @click="applySuggestions">Apply DSS suggestions</button>
      </div>

      <div v-if="!canViewShifts" class="schedule-notice">Shift management is not available to this account or clinic plan. You can create the account now and assign its schedule later when HR access is available.</div>

      <template v-else>
      <div class="schedule-meta">
        <span>Employment type: <strong>{{ employmentType }}</strong></span>
        <span>Agreed hours: <strong>{{ weeklyHoursTarget }} / week</strong></span>
      </div>
      <p class="schedule-note">This recurring schedule applies to {{ branchName }}. Any other assigned branch can be scheduled later in Shift Management.</p>
      <div class="schedule-settings">
        <label class="schedule-field" for="new-employee-weekly-cap">Weekly schedule limit
          <input id="new-employee-weekly-cap" :value="schedule.weeklyHoursCap" type="number" min="1" :max="Math.min(48, weeklyHoursTarget || 48)" step="0.5" :disabled="!canAssignShifts" class="schedule-input" @input="updateSchedule({ weeklyHoursCap: Number($event.target.value) })" />
          <span class="schedule-help">May be lower than agreed hours, up to 48.</span>
        </label>
        <label class="schedule-field" for="new-employee-effective-week">Effective week (Monday)
          <input id="new-employee-effective-week" :value="schedule.effectiveFrom || nextScheduleMonday()" type="date" :min="nextScheduleMonday()" :disabled="!canAssignShifts" class="schedule-input" @input="updateSchedule({ effectiveFrom: $event.target.value })" />
          <span class="schedule-help">The recurring schedule starts on the selected Monday.</span>
        </label>
      </div>

      <div v-if="loading" class="schedule-loading" role="status">Loading shift templates and capacity…</div>
      <div v-else-if="shiftError" class="schedule-error" role="alert">
        {{ shiftError }} <button type="button" class="ml-2 underline" @click="loadBranchData">Retry</button>
      </div>
      <div v-else-if="!activeShifts.length" class="schedule-empty">{{ canCreateShifts ? 'Create a shift in the panel to the right. It will appear here for assignment.' : 'No shifts are available yet. Ask an HR manager to create a shift template.' }}</div>
      <div v-else class="schedule-days">
        <article v-for="day in days" :key="day" class="schedule-day-card">
          <div class="mb-2 flex items-center justify-between gap-2">
            <label :for="`create-account-shift-${day}`" class="schedule-day-title">{{ day }}</label>
            <span class="schedule-day-status">{{ assignments[day] ? 'Assigned' : 'Off' }}</span>
          </div>
          <ContractAppearanceSelect :id="`create-account-shift-${day}`" label="Shift" :model-value="assignments[day]" :disabled="!canAssignShifts || loading || Boolean(shiftError)" :options="shiftOptionsForDay(day)" @update:model-value="setAssignment(day, $event)" />
          <p v-if="assignments[day] && !availableShiftsForDay(day).some(shift => shift.id === assignments[day])" class="schedule-capacity-error" role="alert">This shift has reached capacity for {{ day }}. Choose an available shift or set this day off.</p>
          <p class="schedule-recommendation">DSS: {{ recommendationPlan.suggestions[day]?.label || recommendationPlan.reasons[day] || 'No suggestion available.' }}</p>
        </article>
      </div>

      <div class="schedule-summary">
        <span>Assigned: <strong>{{ totalAssignedHours }} / {{ schedule.weeklyHoursCap || 0 }} hours</strong></span>
        <span>Effective Monday: <strong>{{ schedule.effectiveFrom || nextScheduleMonday() }}</strong></span>
      </div>
      <p v-if="validationError && !shiftError" class="schedule-validation-error" role="alert">{{ validationError }}</p>
      <p v-else-if="!canAssignShifts" class="schedule-help schedule-permission-note">An authorized HR manager can assign this employee’s schedule later.</p>
      </template>
    </section>

    <aside class="schedule-side-panel">
      <section class="schedule-panel">
        <h3 class="schedule-title">Create a shift</h3>
        <p class="schedule-subtitle">New templates are saved to {{ branchName }} and can be reused later.</p>
        <div v-if="!canCreateShifts" class="schedule-notice">Your account cannot create shift templates. An HR manager can add these later.</div>
        <form v-else class="schedule-create-form" @submit.prevent="createShift">
          <label class="schedule-field">Shift name
            <input v-model.trim="currentShift.name" maxlength="80" required class="schedule-input" placeholder="For example, Opening Shift" />
          </label>
          <div class="schedule-time-grid">
            <label class="schedule-field">Start
              <input v-model="currentShift.start" type="time" required class="schedule-input" />
            </label>
            <label class="schedule-field">End
              <input v-model="currentShift.end" type="time" required class="schedule-input" />
            </label>
          </div>
          <label class="schedule-field">Staff capacity
            <input v-model.number="currentShift.capacity" type="number" min="1" max="500" step="1" required class="schedule-input" />
          </label>
          <label class="schedule-field">Notes
            <textarea v-model.trim="currentShift.notes" maxlength="300" rows="2" class="schedule-input" placeholder="Optional" />
          </label>
          <button type="submit" class="schedule-add-button" :disabled="savingShift">{{ savingShift ? 'Saving shift…' : 'Add shift' }}</button>
        </form>
      </section>

      <section v-if="canViewShifts" class="schedule-panel">
        <h3 class="schedule-title">Shifts for this branch</h3>
        <div v-if="loading" class="schedule-help">Loading shifts…</div>
        <div v-else-if="!shifts.length" class="schedule-help">No shifts created yet.</div>
        <div v-else class="schedule-shift-table-wrap">
          <table class="schedule-shift-table">
            <thead><tr><th>Shift</th><th>Time</th><th>Capacity</th></tr></thead>
            <tbody>
              <tr v-for="shift in shifts" :key="shift.id" :class="{ 'is-archived': shift.isArchived }">
                <td class="p-2">{{ shift.shiftType }}<span v-if="shift.isArchived" class="ml-1 text-xs">(Archived)</span></td>
                <td class="p-2">{{ shift.start }}–{{ shift.end }}</td>
                <td class="p-2">{{ shift.capacity }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.employee-schedule-layout { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(290px, 1fr); gap: 18px; color: var(--ac-text); }
.schedule-panel { min-width: 0; padding: 18px; border: 1px solid var(--ac-border); border-radius: 16px; background: var(--ac-surface); color: var(--ac-text); }
.schedule-title { margin: 0; color: var(--ac-text); font-size: 18px; font-weight: 700; }
.schedule-subtitle { margin: 5px 0 0; color: var(--ac-text-secondary); font-size: 14px; line-height: 1.5; }
.schedule-dss-button { min-height: 42px; padding: 9px 13px; border: 1px solid var(--ac-border-strong); border-radius: 9px; background: var(--ac-surface); color: var(--ac-primary); font-size: 13px; font-weight: 700; }
.schedule-dss-button:hover:not(:disabled) { background: var(--ac-surface-muted); }
.schedule-dss-button:disabled { cursor: not-allowed; opacity: .5; }
.schedule-notice, .schedule-loading, .schedule-empty { margin-top: 16px; padding: 13px; border: 1px solid var(--ac-border); border-radius: 11px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 13px; line-height: 1.5; }
.schedule-meta { display: flex; flex-wrap: wrap; gap: 12px 18px; margin-top: 16px; color: var(--ac-text-secondary); font-size: 14px; }
.schedule-meta strong, .schedule-summary strong { color: var(--ac-text); }
.schedule-note { margin: 9px 0 0; color: var(--ac-text-secondary); font-size: 12px; line-height: 1.55; }
.schedule-settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; max-width: 640px; margin-top: 16px; }
.schedule-field { display: block; min-width: 0; color: var(--ac-text); font-size: 13px; font-weight: 600; }
.schedule-input { display: block; width: 100%; min-height: 43px; margin-top: 7px; padding: 9px 11px; border: 1px solid var(--ac-border-strong); border-radius: 9px; background: var(--ac-surface); color: var(--ac-text); font: inherit; }
.schedule-input:focus { outline: 2px solid var(--ac-accent); outline-offset: 1px; }
.schedule-input:disabled { cursor: not-allowed; opacity: .65; }
.schedule-help { display: block; margin-top: 6px; color: var(--ac-text-secondary); font-size: 12px; font-weight: 400; line-height: 1.5; }
.schedule-days { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 17px; }
.schedule-day-card { min-width: 0; padding: 12px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface-muted); }
.schedule-day-title { color: var(--ac-text); font-size: 14px; font-weight: 700; }
.schedule-day-status { color: var(--ac-text-secondary); font-size: 12px; }
.schedule-day-card :deep(.appearance-select) { margin: 8px 0 0; }
.schedule-day-card :deep(.appearance-select label) { display: none; }
.schedule-day-card :deep(.appearance-select-trigger) { min-height: 43px; }
.schedule-day-card :deep(.appearance-select-menu) { z-index: 50; }
.schedule-capacity-error, .schedule-validation-error, .schedule-error { margin-top: 12px; padding: 11px 12px; border: 1px solid #e3b9ad; border-radius: 10px; background: #fff1ee; color: #8d352b; font-size: 13px; line-height: 1.5; }
.schedule-recommendation { min-height: 34px; margin: 8px 0 0; color: var(--ac-text-secondary); font-size: 12px; line-height: 1.5; }
.schedule-summary { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 14px; padding: 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 13px; }
.schedule-side-panel, .schedule-create-form { display: grid; align-content: start; gap: 14px; }
.schedule-time-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.schedule-add-button { min-height: 44px; width: 100%; padding: 10px 14px; border: 1px solid var(--ac-primary); border-radius: 9px; background: var(--ac-primary); color: var(--ac-on-primary); font-size: 14px; font-weight: 700; }
.schedule-add-button:hover:not(:disabled) { filter: brightness(1.08); }
.schedule-add-button:disabled { cursor: wait; opacity: .6; }
.schedule-shift-table-wrap { max-height: 260px; margin-top: 12px; overflow: auto; border: 1px solid var(--ac-border); border-radius: 10px; }
.schedule-shift-table { width: 100%; min-width: 380px; border-collapse: collapse; color: var(--ac-text); font-size: 13px; text-align: left; }
.schedule-shift-table th { position: sticky; top: 0; padding: 9px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.schedule-shift-table td { padding: 9px; border-top: 1px solid var(--ac-border); }
.schedule-shift-table tr.is-archived { color: var(--ac-text-secondary); }
@media (max-width: 1023px) { .employee-schedule-layout { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) { .schedule-settings, .schedule-days { grid-template-columns: minmax(0, 1fr); } .schedule-panel { padding: 14px; } }
</style>
