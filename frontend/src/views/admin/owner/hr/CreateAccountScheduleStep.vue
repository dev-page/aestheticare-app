<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { db } from '@/config/firebaseConfig'
import { recommendRecurringShifts } from '@/utils/shiftRecommendations'
import { parseShiftDurationHours } from '@/utils/employeeSchedules'
import { logActivity } from '@/utils/activityLogger'
import { compensationApi } from '@/utils/compensationApi'
import { toast } from 'vue3-toastify'

const props = defineProps({
  branchId: { type: String, default: '' },
  branchName: { type: String, default: '' },
  employmentType: { type: String, default: '' },
  weeklyHoursTarget: { type: Number, default: 0 },
  modelValue: { type: Object, required: true },
  canViewShifts: { type: Boolean, default: false },
  canCreateShifts: { type: Boolean, default: false },
  canAssignShifts: { type: Boolean, default: false },
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
const assignments = computed(() => schedule.value.assignments || Object.fromEntries(days.map(day => [day, ''])))
const activeShifts = computed(() => shifts.value.filter(shift => !shift.isArchived))
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
    && value >= currentWeekStart()
})
const totalAssignedHours = computed(() => days.reduce((sum, day) => {
  const shift = shifts.value.find(entry => entry.id === assignments.value[day])
  return sum + (shift ? parseShiftDurationHours(shift) : 0)
}, 0))

const currentWeekStart = () => {
  const date = new Date()
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const updateSchedule = (updates) => emit('update:modelValue', {
  ...schedule.value,
  branchId: props.branchId,
  effectiveFrom: schedule.value.effectiveFrom || currentWeekStart(),
  weeklyHoursCap: Number(schedule.value.weeklyHoursCap || props.weeklyHoursTarget || 0),
  assignments: { ...assignments.value },
  ...updates,
})

const capacityConflicts = computed(() => days.filter(day => {
  const shiftId = String(assignments.value[day] || '')
  if (!shiftId) return false
  const shift = shifts.value.find(entry => entry.id === shiftId)
  if (!shift) return false
  const alreadyAssigned = capacitySchedules.value.reduce((count, item) => count + (item.assignments?.[day] === shiftId ? 1 : 0), 0)
  return alreadyAssigned >= Number(shift.capacity || 1)
}))

const validationError = computed(() => {
  if (!props.branchId) return 'Choose a branch in the previous step before assigning a shift.'
  if (!props.canAssignShifts) return ''
  if (loading.value) return 'Wait for the branch shifts and capacity check to finish loading.'
  if (shiftError.value) return shiftError.value
  if (!activeShifts.value.length) return 'Add at least one shift template before continuing.'
  if (!days.some(day => assignments.value[day])) return 'Assign at least one shift day before continuing.'
  if (!validWeeklyCap.value) return 'The weekly schedule limit must be at least 1 hour and cannot exceed the agreed weekly hours or 48 hours.'
  if (!validEffectiveMonday.value) return 'Choose a current or future Monday for the schedule to take effect.'
  if (totalAssignedHours.value > Number(schedule.value.weeklyHoursCap || 0)) return `Assigned shifts total ${totalAssignedHours.value} hours, over the ${schedule.value.weeklyHoursCap}-hour weekly limit.`
  if (capacityConflicts.value.length) return `Shift capacity is full on ${capacityConflicts.value.join(', ')}. Choose another shift or day.`
  return ''
})

const recommendationPlan = computed(() => recommendRecurringShifts({
  days,
  shifts: activeShifts.value,
  assignments: assignments.value,
  employmentType: props.employmentType,
  targetHours: schedule.value.weeklyHoursCap || props.weeklyHoursTarget,
  schedules: capacitySchedules.value,
  employeeId: '__new_employee__',
}))

const setAssignment = (day, shiftId) => {
  const shift = shifts.value.find(entry => entry.id === shiftId)
  const assignmentLabels = { ...(schedule.value.assignmentLabels || {}) }
  assignmentLabels[day] = shift ? `${shift.shiftType || 'Shift'} || ${shift.start || ''} - ${shift.end || ''}` : ''
  updateSchedule({ assignments: { ...assignments.value, [day]: shiftId || '' }, assignmentLabels })
}

const applySuggestions = () => {
  const next = { ...assignments.value }
  const labels = { ...(schedule.value.assignmentLabels || {}) }
  Object.entries(recommendationPlan.value.suggestions).forEach(([day, shift]) => { next[day] = shift.id })
  Object.entries(recommendationPlan.value.suggestions).forEach(([day, shift]) => { labels[day] = `${shift.shiftType || 'Shift'} || ${shift.start || ''} - ${shift.end || ''}` })
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
      effectiveFrom: schedule.value.effectiveFrom || currentWeekStart(),
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
      effectiveFrom: currentWeekStart(),
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
      effectiveFrom: currentWeekStart(),
      weeklyHoursCap: Number(props.weeklyHoursTarget || 0),
      assignments: Object.fromEntries(days.map(day => [day, ''])),
      assignmentLabels: Object.fromEntries(days.map(day => [day, ''])),
    })
  }
})

defineExpose({ validationError })
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
    <section class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-white">Assign the weekly schedule</h3>
          <p class="mt-1 text-sm text-slate-400">{{ branchName }} · Choose one shift or leave a day off.</p>
        </div>
        <button v-if="canAssignShifts" type="button" class="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50" :disabled="loading || !Object.keys(recommendationPlan.suggestions).length" @click="applySuggestions">Apply DSS suggestions</button>
      </div>

      <div v-if="!canViewShifts" class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">Shift management is not available to this account or clinic plan. You can create the account now and assign its schedule later when HR access is available.</div>

      <template v-else>
      <div class="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
        <span>Employment type: <strong class="text-white">{{ employmentType }}</strong></span>
        <span>Agreed hours: <strong class="text-white">{{ weeklyHoursTarget }} / week</strong></span>
      </div>
      <p class="mt-2 text-xs text-slate-400">This recurring schedule applies to {{ branchName }}. Any other assigned branch can be scheduled later in Shift Management.</p>
      <div class="mt-4 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block text-sm font-medium text-slate-200" for="new-employee-weekly-cap">Weekly schedule limit
          <input id="new-employee-weekly-cap" :value="schedule.weeklyHoursCap" type="number" min="1" :max="Math.min(48, weeklyHoursTarget || 48)" step="0.5" :disabled="!canAssignShifts" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" @input="updateSchedule({ weeklyHoursCap: Number($event.target.value) })" />
          <span class="mt-1 block text-xs font-normal text-slate-400">May be lower than agreed hours, up to 48.</span>
        </label>
        <label class="block text-sm font-medium text-slate-200" for="new-employee-effective-week">Effective week (Monday)
          <input id="new-employee-effective-week" :value="schedule.effectiveFrom || currentWeekStart()" type="date" :min="currentWeekStart()" :disabled="!canAssignShifts" class="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" @input="updateSchedule({ effectiveFrom: $event.target.value })" />
          <span class="mt-1 block text-xs font-normal text-slate-400">The recurring schedule starts on the selected Monday.</span>
        </label>
      </div>

      <div v-if="loading" class="mt-5 rounded-xl border border-slate-700 p-5 text-sm text-slate-400" role="status">Loading shift templates and capacity…</div>
      <div v-else-if="shiftError" class="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200" role="alert">
        {{ shiftError }} <button type="button" class="ml-2 underline" @click="loadBranchData">Retry</button>
      </div>
      <div v-else-if="!activeShifts.length" class="mt-5 rounded-xl border border-dashed border-slate-600 p-5 text-sm text-slate-400">{{ canCreateShifts ? 'Create a shift in the panel to the right. It will appear here for assignment.' : 'No shifts are available yet. Ask an HR manager to create a shift template.' }}</div>
      <div v-else class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <article v-for="day in days" :key="day" class="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <label :for="`create-account-shift-${day}`" class="font-semibold text-white">{{ day }}</label>
            <span class="text-xs text-slate-400">{{ assignments[day] ? 'Assigned' : 'Off' }}</span>
          </div>
          <select :id="`create-account-shift-${day}`" :value="assignments[day]" :disabled="!canAssignShifts" class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" @change="setAssignment(day, $event.target.value)">
            <option value="">Off — no shift</option>
            <option v-for="shift in activeShifts" :key="shift.id" :value="shift.id">{{ shift.shiftType }} · {{ shift.start }}–{{ shift.end }} · capacity {{ shift.capacity }}</option>
          </select>
          <p class="mt-2 min-h-8 text-xs text-slate-400">DSS: {{ recommendationPlan.suggestions[day]?.label || recommendationPlan.reasons[day] || 'No suggestion available.' }}</p>
        </article>
      </div>

      <div class="mt-4 flex flex-wrap gap-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm">
        <span class="text-slate-300">Assigned: <strong class="text-white">{{ totalAssignedHours }} / {{ schedule.weeklyHoursCap || 0 }} hours</strong></span>
        <span class="text-slate-300">Effective Monday: <strong class="text-white">{{ schedule.effectiveFrom || currentWeekStart() }}</strong></span>
      </div>
      <p v-if="validationError && !shiftError" class="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">{{ validationError }}</p>
      <p v-else-if="!canAssignShifts" class="mt-3 text-sm text-slate-400">An authorized HR manager can assign this employee’s schedule later.</p>
      </template>
    </section>

    <aside class="min-w-0 space-y-4">
      <section class="rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-white">Create a shift</h3>
        <p class="mt-1 text-sm text-slate-400">New templates are saved to {{ branchName }} and can be reused later.</p>
        <div v-if="!canCreateShifts" class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">Your account cannot create shift templates. An HR manager can add these later.</div>
        <form v-else class="mt-4 space-y-3" @submit.prevent="createShift">
          <label class="block text-sm font-medium text-slate-200">Shift name
            <input v-model.trim="currentShift.name" maxlength="80" required class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="For example, Opening Shift" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-slate-200">Start
              <input v-model="currentShift.start" type="time" required class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
            </label>
            <label class="block text-sm font-medium text-slate-200">End
              <input v-model="currentShift.end" type="time" required class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
            </label>
          </div>
          <label class="block text-sm font-medium text-slate-200">Staff capacity
            <input v-model.number="currentShift.capacity" type="number" min="1" max="500" step="1" required class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
          </label>
          <label class="block text-sm font-medium text-slate-200">Notes
            <textarea v-model.trim="currentShift.notes" maxlength="300" rows="2" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" placeholder="Optional" />
          </label>
          <button type="submit" class="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50" :disabled="savingShift">{{ savingShift ? 'Saving shift…' : 'Add shift' }}</button>
        </form>
      </section>

      <section v-if="canViewShifts" class="rounded-2xl border border-slate-700 bg-slate-800 p-4 sm:p-5">
        <h3 class="text-lg font-semibold text-white">Shifts for this branch</h3>
        <div v-if="loading" class="mt-3 text-sm text-slate-400">Loading shifts…</div>
        <div v-else-if="!shifts.length" class="mt-3 text-sm text-slate-400">No shifts created yet.</div>
        <div v-else class="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-700">
          <table class="w-full min-w-[380px] text-left text-sm">
            <thead class="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-slate-400"><tr><th class="p-2">Shift</th><th class="p-2">Time</th><th class="p-2">Capacity</th></tr></thead>
            <tbody>
              <tr v-for="shift in shifts" :key="shift.id" class="border-t border-slate-700" :class="shift.isArchived ? 'text-slate-500' : 'text-slate-200'">
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
