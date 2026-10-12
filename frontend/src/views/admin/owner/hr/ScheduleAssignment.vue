<template>
  <div class="schedule-assignment flex flex-row owner-theme min-w-0" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'div' : 'main'" v-page-loading="{ active: pageLoading, header: !embedded, blocks: [{ variant: 'form', fields: 4, sections: 1 }, { variant: 'cards', cards: 7, cardStyle: 'summary' }] }" class="flex-1 min-w-0 text-white" :class="embedded ? '' : 'p-6 md:p-8'">
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <h1 v-if="!embedded" class="text-3xl font-bold text-white">Shift Assignment</h1>
          <p class="mt-2 text-slate-400">
            Assign recurring schedules to practitioners and staff. Customer booking availability follows the assigned practitioner schedule saved here.
          </p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <h2 class="text-lg font-semibold text-white">Assignment Setup</h2>
            <p class="mt-1 text-sm text-slate-400">Choose the branch, employee, and start date you want to manage.</p>

            <div class="mt-5 space-y-4">
              <div>
                <ContractAppearanceSelect id="assignment-branch" v-model="selectedBranchId" label="Branch" :disabled="saving" :options="[{ value: '', label: 'Select branch' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]" />
              </div>

              <div>
                <ContractAppearanceSelect id="assignment-role" v-model="selectedRole" label="Staff Role" :disabled="saving" :options="roleOptions" />
              </div>

              <div>
                <ContractAppearanceSelect id="assignment-employee" v-model="selectedEmployeeId" label="Employee" :disabled="saving || !filteredEmployees.length" :options="[{ value: '', label: filteredEmployees.length ? 'Select employee' : 'No matching employees' }, ...filteredEmployees.map(employee => ({ value: employee.id, label: employee.fullName + (employee.role ? ` (${employee.role})` : '') }))]" />
              </div>

              <div>
                <label for="assignment-start-date" class="assignment-field-label">Starts On</label>
                <input
                  v-model="selectedWeekStart"
                  id="assignment-start-date"
                  :disabled="saving"
                  type="date"
                  class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                />
              </div>
            </div>

            <div v-if="selectedEmployee" class="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div class="flex flex-col items-start gap-3">
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">DSS Recommendation</h3>
                  <p class="mt-2 text-sm text-slate-200">
                    {{ selectedEmployee.fullName }} has employment type <span class="font-semibold">{{ scheduleTypeLabel }}</span>.
                  </p>
                  <p class="mt-1 text-xs text-slate-300">
                    {{ recommendedShiftSummary }}
                  </p>
                </div>
                <button
                  type="button"
                  class="assignment-button assignment-button-secondary self-stretch"
                  @click="applySuggestedShifts"
                  :disabled="saving || !scheduleDssReady || !suggestedShiftTemplates.length"
                >
                  Apply Suggestions
                </button>
              </div>

              <div class="mt-4">
                <label for="dss-weekly-target" class="assignment-field-label">Weekly hours target (planning only)</label>
                <input id="dss-weekly-target" v-model.number="weeklyTargetHours" type="number" min="1" max="48" step="0.5" :disabled="saving" class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" />
                <p class="mt-2 text-xs text-slate-400">Use the employee's agreed weekly hours. Full-time defaults to the existing 48-hour application limit; enter a target for part-time staff.</p>
              </div>
              <div class="mt-4 grid gap-3 md:grid-cols-2">
                <div class="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-[0.2em] text-slate-400">Employment Type</p>
                  <p class="mt-1 text-sm font-semibold text-white">{{ scheduleTypeLabel }}</p>
                </div>
                <div class="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-[0.2em] text-slate-400">Matched Templates</p>
                  <p class="mt-1 text-sm font-semibold text-white">{{ matchingShiftTemplates.length }}</p>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-for="shift in suggestedShiftTemplates.slice(0, 4)"
                  :key="shift.id"
                  class="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100"
                >
                  {{ shift.label }} · {{ shift.durationHours }}h
                </span>
              </div>
            </div>

            <div class="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">How This Works</h3>
              <ul class="mt-3 space-y-2 text-sm text-slate-200">
                <li>Bookings use practitioner schedules stored under each employee.</li>
                <li>Schedules saved here are recurring by default for future weeks.</li>
                <li>The start date helps show when you began using this recurring pattern.</li>
                <li>Suggestions check employment type, weekly target, available slots, and retained off days. Intern schedules are assigned manually.</li>
                <li>Choose Off for days when the employee should not accept work or appointments.</li>
                <li>Each shift's capacity is enforced per day when the schedule is saved.</li>
              </ul>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 class="text-lg font-semibold text-white">Recurring Assignment</h2>
                <p class="mt-1 text-sm text-slate-400">
                  {{ assignmentSummary }}
                </p>
                <p v-if="selectedEmployee" class="mt-2 text-sm" :class="hoursWarning ? 'text-rose-300' : 'text-emerald-300'">
                  {{ weeklyHoursSummary }}
                </p>
              </div>
              <div class="flex gap-3">
                <button
                  type="button"
                  class="assignment-button assignment-button-secondary"
                  @click="resetAssignments"
                  :disabled="saving || !selectedEmployeeId || !capacityReady"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="assignment-button assignment-button-primary"
                  @click="saveAssignments"
                  :disabled="!selectedEmployeeId || saving || !capacityReady || Boolean(hoursWarning)"
                >
                  {{ saving ? 'Saving...' : 'Save Schedule' }}
                </button>
              </div>
            </div>

            <div v-if="!selectedBranchId" class="mt-8 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
              Pick a branch first to load available staff and shift templates.
            </div>
            <div v-else-if="!branchShifts.length" class="mt-8 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
              No shift templates have been added for this branch yet. Create them first in Add Shift.
            </div>
            <div v-else-if="!selectedEmployeeId" class="mt-8 rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-400">
              Select an employee to assign a recurring schedule.
            </div>
            <div v-else class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <article
                v-for="day in daysOfWeek"
                :key="day"
                class="rounded-xl border border-slate-700 bg-slate-900/70 p-4"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-semibold text-white">{{ day }}</h3>
                    <p class="text-xs text-slate-400">Assign a template or leave this day off.</p>
                  </div>
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="assignments[day] ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'"
                  >
                    {{ assignments[day] ? 'Assigned' : 'Off' }}
                  </span>
                </div>

                <ContractAppearanceSelect :id="`assignment-shift-${day.toLowerCase()}`" v-model="assignments[day]" @update:model-value="markManualDay(day, $event)" label="Shift template" class="assignment-day-select" :disabled="saving || !capacityReady" :options="[{ value: '', label: 'Off — no shift assigned' }, ...displayShiftTemplates.map(shift => ({ value: shift.id, label: `${shift.label} — ${shift.capacity} slot${shift.capacity === 1 ? '' : 's'}${getSuggestedShiftForDay(day)?.id === shift.id ? ' (Suggested)' : ''}` }))]" />

                <div class="mt-3 flex items-center justify-between gap-3">
                  <p class="text-xs text-slate-400">
                    DSS suggestion:
                    <span class="text-slate-200">
                      {{ getSuggestedShiftForDay(day)?.label || (capacityReady ? recommendationPlan.reasons[day] : 'Checking shift capacity...') }}
                    </span>
                  </p>
                  <button
                    type="button"
                    class="assignment-button assignment-button-secondary assignment-button-small"
                    :disabled="saving || !getSuggestedShiftForDay(day)"
                    @click="applySuggestedShiftToDay(day, getSuggestedShiftForDay(day)?.id)"
                  >
                    Use DSS
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </component>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

defineProps({ embedded: { type: Boolean, default: false } })

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { logActivity } from '@/utils/activityLogger'
import { recommendRecurringShifts } from '@/utils/shiftRecommendations'
import {
  RECURRING_SCHEDULE_ID,
  classifyShiftEmploymentType,
  createAssignmentsMap,
  normalizeEmploymentType,
  parseShiftDurationHours,
  normalizeAssignments,
} from '@/utils/employeeSchedules'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const db = getFirestore(getApp())
const auth = getAuth(getApp())

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const branches = ref([])
const employees = ref([])
const branchShifts = ref([])
const customRoles = ref([])
const selectedBranchId = ref('')
const selectedRole = ref('all')
const selectedEmployeeId = ref('')
const selectedWeekStart = ref('')
const saving = ref(false)
const weeklyTargetHours = ref(48)
const capacitySchedules = ref([])
const capacityReady = ref(false)
const protectedDays = ref([])
const loadedProtectedDays = ref([])
let assignmentLoadVersion = 0
const isOwnerLikeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase()
  return ['owner', 'clinic owner', 'clinicowner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalized)
}

const emptyAssignments = () => createAssignmentsMap(daysOfWeek)

const assignments = ref(emptyAssignments())
const loadedAssignments = ref(emptyAssignments())
let unsubscribeAuth = null

const toDateInput = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const getMondayDate = () => {
  const now = new Date()
  const diffToMonday = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - diffToMonday)
  return toDateInput(monday)
}

const formatFullName = (data = {}) =>
  String(data.fullName || '').trim() ||
  `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
  data.email ||
  'Unnamed Staff'

const roleOptions = computed(() => {
  const options = [{ value: 'all', label: 'All Staff' }]
  customRoles.value.forEach((role) => {
    options.push({
      value: role.id,
      label: role.name
    })
  })
  return options
})

const filteredEmployees = computed(() => {
  if (selectedRole.value === 'all') return employees.value
  return employees.value.filter((employee) => String(employee.customRoleId || '').trim() === selectedRole.value)
})

const selectedEmployee = computed(() =>
  filteredEmployees.value.find((employee) => employee.id === selectedEmployeeId.value) || null
)

const selectedEmployeeScheduleType = computed(() => normalizeEmploymentType(selectedEmployee.value?.employmentType || ''))

const parseShiftHours = (shiftLabel) => {
  if (!shiftLabel) return 0
  const match = branchShifts.value.find((shift) => shift.id === shiftLabel || shift.label === shiftLabel)
  return match ? parseShiftDurationHours(match) : 0
}

const totalAssignedHours = computed(() =>
  daysOfWeek.reduce((total, day) => total + parseShiftHours(assignments.value[day]), 0)
)

const isFullTimeEmployee = computed(() =>
  selectedEmployeeScheduleType.value === 'full-time'
)

const hoursWarning = computed(() => {
  if (!selectedEmployee.value || totalAssignedHours.value <= 48) return ''
  return `${scheduleTypeLabel.value} schedules cannot exceed 48 assigned hours per week.`
})

const weeklyHoursSummary = computed(() => {
  if (!selectedEmployee.value) return ''
  if (isFullTimeEmployee.value) {
    return `Assigned hours: ${totalAssignedHours.value} / 48 hours for a full-time schedule.`
  }
  return `Assigned hours: ${totalAssignedHours.value} hour(s) for this recurring schedule.`
})

const scheduleTypeLabel = computed(() =>
  selectedEmployeeScheduleType.value === 'full-time'
    ? 'Full-time'
    : selectedEmployeeScheduleType.value === 'intern'
      ? 'Intern'
      : selectedEmployeeScheduleType.value === 'part-time' ? 'Part-time' : 'Not specified'
)

const recommendationPlan = computed(() => recommendRecurringShifts({
  days: daysOfWeek, shifts: branchShifts.value, assignments: assignments.value,
  employmentType: selectedEmployee.value?.employmentType, targetHours: weeklyTargetHours.value,
  schedules: capacitySchedules.value, employeeId: selectedEmployeeId.value,
  protectedDays: protectedDays.value
}))
const matchingShiftTemplates = computed(() => recommendationPlan.value.templates)
const suggestedShiftTemplates = matchingShiftTemplates

const displayShiftTemplates = computed(() => {
  const scheduleType = selectedEmployeeScheduleType.value
  return [...branchShifts.value].sort((a, b) => {
    const aMatch = a.scheduleType === scheduleType ? 0 : 1
    const bMatch = b.scheduleType === scheduleType ? 0 : 1
    if (aMatch !== bMatch) return aMatch - bMatch
    if (a.durationHours !== b.durationHours) {
      return scheduleType === 'part-time'
        ? a.durationHours - b.durationHours
        : b.durationHours - a.durationHours
    }
    return String(a.label || '').localeCompare(String(b.label || ''))
  })
})

const recommendedShiftSummary = computed(() => {
  if (!capacityReady.value) return 'Loading current shift capacity. Suggestions are unavailable until this finishes.'
  if (!selectedEmployeeScheduleType.value) return 'Set the employee employment type in Employee Management first; no type is guessed from assigned hours.'
  if (selectedEmployeeScheduleType.value === 'intern') return 'Assign intern schedules manually according to their agreed hours.'
  if (!(Number(weeklyTargetHours.value) > 0 && Number(weeklyTargetHours.value) <= 48)) return 'Enter agreed weekly hours between 1 and 48 before requesting suggestions.'
  return 'Uses saved employment type, remaining shift slots, and your ' + weeklyTargetHours.value + '-hour planning target. Existing assignments and off days are retained. Planned total: ' + recommendationPlan.value.plannedHours + ' hours. Shift duration includes the full start-to-end window.'
})
const applySuggestedShiftToDay = (day, shiftId) => {
  if (!capacityReady.value || !day || !shiftId) return
  assignments.value[day] = shiftId
}
const applySuggestedShifts = () => {
  if (!scheduleDssReady.value) return
  const suggestions = recommendationPlan.value.suggestions
  Object.entries(suggestions).forEach(([day, shift]) => { assignments.value[day] = shift.id })
  toast.success('Applied suggestions within the weekly planning target. Review before saving.')
}
const getSuggestedShiftForDay = day => capacityReady.value ? recommendationPlan.value.suggestions[day] || null : null
const scheduleDssReady = computed(() => Boolean(selectedEmployee.value && capacityReady.value && Object.keys(recommendationPlan.value.suggestions).length))
const markManualDay = (day, value) => {
  protectedDays.value = protectedDays.value.filter(entry => entry !== day)
  if (!value) protectedDays.value.push(day)
}

const assignmentSummary = computed(() => {
  if (!selectedEmployee.value) return 'Choose an employee to start assigning shifts.'
  if (!selectedWeekStart.value) return `Editing the recurring schedule for ${selectedEmployee.value.fullName}.`
  return `Editing the recurring schedule for ${selectedEmployee.value.fullName}, starting ${selectedWeekStart.value}.`
})

const hydrateBranches = async () => {
  const user = auth.currentUser
  if (!user) {
    branches.value = []
    return
  }

  const userSnap = await getDoc(doc(db, 'users', user.uid))
  if (!userSnap.exists()) {
    branches.value = []
    return
  }

  const profile = userSnap.data() || {}
  let accessibleClinics = []
  let preferredBranchId = ''

  if (isOwnerLikeRole(profile.role)) {
    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)))
    accessibleClinics = clinicsSnap.docs
  } else {
    const assignedBranchId = String(profile.branchId || '').trim()
    preferredBranchId = assignedBranchId

    if (assignedBranchId) {
      const assignedClinicSnap = await getDoc(doc(db, 'clinics', assignedBranchId))
      if (!assignedClinicSnap.exists()) {
        branches.value = []
        selectedBranchId.value = ''
        return
      }
      accessibleClinics = [assignedClinicSnap]
    } else {
      const branchAdminSnapshot = await getDocs(
        query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid))
      )
      accessibleClinics = branchAdminSnapshot.docs
      if (!accessibleClinics.length) {
        branches.value = []
        selectedBranchId.value = ''
        return
      }
      preferredBranchId = accessibleClinics[0].id
    }
  }

  branches.value = accessibleClinics
    .map((snap) => {
      const data = snap.data() || {}
      return {
        id: snap.id,
        name: data.clinicBranch || data.clinicName || 'Unnamed Branch'
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedStillExists = branches.value.some((branch) => branch.id === selectedBranchId.value)
  if (selectedStillExists) return

  if (preferredBranchId && branches.value.some((branch) => branch.id === preferredBranchId)) {
    selectedBranchId.value = preferredBranchId
    return
  }

  selectedBranchId.value = branches.value[0]?.id || ''
}

const hydrateCustomRoles = async () => {
  if (!selectedBranchId.value) {
    customRoles.value = []
    return
  }

  const clinicSnap = await getDoc(doc(db, 'clinics', selectedBranchId.value))
  if (!clinicSnap.exists()) {
    customRoles.value = []
    return
  }

  const ownerId = String(clinicSnap.data()?.ownerId || '').trim()
  if (!ownerId) {
    customRoles.value = []
    return
  }

  const rolesSnap = await getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
  customRoles.value = rolesSnap.docs
    .map((snap) => {
      const data = snap.data() || {}
      const permissions = Array.isArray(data.permissions)
        ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
        : []

      return {
        id: snap.id,
        name: String(data.name || '').trim(),
        permissions
      }
    })
    .filter((role) => role.name && role.permissions.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedStillExists =
    selectedRole.value === 'all' ||
    customRoles.value.some((role) => role.id === selectedRole.value)

  if (!selectedStillExists) {
    selectedRole.value = 'all'
  }
}

const hydrateEmployees = async () => {
  if (!selectedBranchId.value) {
    employees.value = []
    return
  }

  const staffSnap = await getDocs(query(collection(db, 'users'), where('branchId', '==', selectedBranchId.value)))
  employees.value = staffSnap.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .filter((entry) => String(entry.userType || '').trim().toLowerCase() === 'staff' && !entry.archived)
    .map((entry) => ({
      id: entry.id,
      role: String(entry.customRoleName || entry.role || 'Staff').trim(),
      customRoleId: String(entry.customRoleId || '').trim(),
      employmentType: String(entry.employmentType || '').trim(),
      fullName: formatFullName(entry)
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  if (!filteredEmployees.value.some((employee) => employee.id === selectedEmployeeId.value)) {
    selectedEmployeeId.value = filteredEmployees.value[0]?.id || ''
  }
}

const hydrateBranchShifts = async () => {
  if (!selectedBranchId.value) {
    branchShifts.value = []
    return
  }

  const shiftsSnap = await getDocs(query(collection(db, 'shifts'), where('branchId', '==', selectedBranchId.value)))
  branchShifts.value = shiftsSnap.docs
    .map((snap) => {
      const data = snap.data() || {}
      const shiftType = String(data.shiftType || 'Shift').trim()
      const start = String(data.start || '').trim()
      const end = String(data.end || '').trim()
      const durationHours = parseShiftDurationHours({ start, end })
      return {
        id: snap.id,
        label: `${shiftType} || ${start} - ${end}`,
        shiftType,
        start,
        end,
        capacity: Math.max(1, Number(data.capacity) || 1),
        durationHours,
        scheduleType: classifyShiftEmploymentType({ start, end })
      }
    })
}

const loadAssignments = trackPageLoad(async () => {
  const version = ++assignmentLoadVersion
  const employeeId = selectedEmployeeId.value
  capacityReady.value = false
  capacitySchedules.value = []
  protectedDays.value = []
  loadedProtectedDays.value = []
  assignments.value = emptyAssignments()
  loadedAssignments.value = emptyAssignments()
  if (!employeeId) return
  try {
    const staff = [...employees.value]
    const snapshots = await Promise.all(staff.map(employee => getDoc(doc(db, 'users', employee.id, 'schedules', RECURRING_SCHEDULE_ID))))
    if (version !== assignmentLoadVersion || employeeId !== selectedEmployeeId.value) return
    capacitySchedules.value = snapshots.map((snapshot, index) => ({ employeeId: staff[index].id, assignments: snapshot.data()?.assignments || {} }))
    const selected = snapshots[staff.findIndex(employee => employee.id === employeeId)]
    const next = normalizeAssignments(selected?.data()?.assignments || {}, daysOfWeek)
    daysOfWeek.forEach(day => {
      const shift = branchShifts.value.find(shift => shift.id === next[day] || shift.label === next[day])
      next[day] = shift?.id || next[day]
    })
    assignments.value = { ...next }
    loadedAssignments.value = { ...next }
    protectedDays.value = selected?.exists() ? daysOfWeek.filter(day => !next[day]) : []
    loadedProtectedDays.value = [...protectedDays.value]
    capacityReady.value = true
  } catch (error) {
    if (version !== assignmentLoadVersion) return
    console.error('Failed to load schedule capacity:', error)
    toast.error('Unable to check current shift capacity. Reopen this page before using suggestions.')
  }
})

const loadScheduleContext = trackPageLoad(async (user) => {
  if (!user) {
    branches.value = []
    customRoles.value = []
    employees.value = []
    branchShifts.value = []
    selectedBranchId.value = ''
    selectedRole.value = 'all'
    selectedEmployeeId.value = ''
    assignments.value = emptyAssignments()
    loadedAssignments.value = emptyAssignments()
    return
  }

  await hydrateBranches()
  if (selectedBranchId.value) {
    await Promise.all([hydrateEmployees(), hydrateBranchShifts(), hydrateCustomRoles()])
  }
  await loadAssignments()
})

const resetAssignments = () => {
  assignments.value = { ...loadedAssignments.value }
  protectedDays.value = [...loadedProtectedDays.value]
}

const getShiftForAssignment = (value) => {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  return branchShifts.value.find((shift) => shift.id === normalized || shift.label === normalized) || null
}

const saveScheduleWithCapacityCheck = async (scheduleRef, payload) => {
  const scheduleRefs = employees.value.map((employee) =>
    doc(db, 'users', employee.id, 'schedules', RECURRING_SCHEDULE_ID)
  )

  return runTransaction(db, async (transaction) => {
    const scheduleSnapshots = await Promise.all(scheduleRefs.map((schedule) => transaction.get(schedule)))
    const assignedCounts = new Map()

    scheduleSnapshots.forEach((scheduleSnap, index) => {
      if (!scheduleSnap.exists() || employees.value[index]?.id === selectedEmployee.value?.id) return

      const existingAssignments = scheduleSnap.data()?.assignments || {}
      daysOfWeek.forEach((day) => {
        const shift = getShiftForAssignment(existingAssignments[day])
        if (!shift) return
        const key = `${day}:${shift.id}`
        assignedCounts.set(key, (assignedCounts.get(key) || 0) + 1)
      })
    })

    for (const day of daysOfWeek) {
      const shift = getShiftForAssignment(assignments.value[day])
      if (!shift) continue

      const key = `${day}:${shift.id}`
      const assignedCount = (assignedCounts.get(key) || 0) + 1
      if (assignedCount > shift.capacity) {
        const capacityError = new Error('Shift capacity reached.')
        capacityError.code = 'SHIFT_CAPACITY'
        capacityError.day = day
        capacityError.shiftLabel = shift.label
        capacityError.capacity = shift.capacity
        throw capacityError
      }
    }

    const selectedScheduleSnapshot = scheduleSnapshots[employees.value.findIndex(employee => employee.id === selectedEmployeeId.value)]
    if (!selectedScheduleSnapshot?.exists()) {
      payload.createdAt = serverTimestamp()
    }

    transaction.set(scheduleRef, payload, { merge: true })
  })
}

const saveAssignments = async () => {
  if (!selectedEmployee.value || !selectedBranchId.value || !selectedWeekStart.value) {
    toast.error('Please complete the branch, employee, and start date fields first.')
    return
  }
  if (hoursWarning.value) {
    toast.error(hoursWarning.value)
    return
  }

  const result = await Swal.fire({
    title: 'Save Recurring Schedule',
    text: `Assign this recurring schedule to ${selectedEmployee.value.fullName}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Save schedule',
    cancelButtonText: 'Cancel'
  })

  if (!result.isConfirmed) {
    toast.info('Schedule update cancelled.')
    return
  }

  try {
    saving.value = true
    const employeeRole = selectedEmployee.value.role || 'Staff'
    const payload = {
      employeeId: selectedEmployee.value.id,
      employeeName: selectedEmployee.value.fullName,
      employeeRole,
      branchId: selectedBranchId.value,
      weekStart: null,
      effectiveFrom: selectedWeekStart.value,
      recurring: true,
      type: RECURRING_SCHEDULE_ID,
      assignments: { ...assignments.value },
      assignmentLabels: Object.fromEntries(
        daysOfWeek.map((day) => {
          const shift = branchShifts.value.find((entry) => entry.id === assignments.value[day])
          return [day, shift?.label || '']
        })
      ),
      updatedAt: serverTimestamp()
    }

    const scheduleRef = doc(db, 'users', selectedEmployee.value.id, 'schedules', RECURRING_SCHEDULE_ID)
    await saveScheduleWithCapacityCheck(scheduleRef, payload)
    await logActivity(db, {
      module: 'HR',
      action: 'Updated recurring staff schedule',
      details: `Saved recurring schedule for ${selectedEmployee.value.fullName} (${employeeRole}) starting ${selectedWeekStart.value}.`
    })

    loadedAssignments.value = { ...assignments.value }
    await loadAssignments()
    toast.success('Recurring schedule saved successfully.')
  } catch (error) {
    console.error(error)
    if (error?.code === 'SHIFT_CAPACITY') {
      toast.error(`${error.shiftLabel} is already full on ${error.day}. Capacity is ${error.capacity}.`)
    } else {
      toast.error('Failed to save recurring schedule.')
    }
  } finally {
    saving.value = false
  }
}

watch(selectedBranchId, async () => {
  assignmentLoadVersion++
  capacityReady.value = false
  await Promise.all([hydrateEmployees(), hydrateBranchShifts(), hydrateCustomRoles()])
  await loadAssignments()
})

watch(selectedRole, () => {
  if (!filteredEmployees.value.some((employee) => employee.id === selectedEmployeeId.value)) {
    selectedEmployeeId.value = filteredEmployees.value[0]?.id || ''
  }
})

watch(selectedEmployeeId, () => {
  weeklyTargetHours.value = normalizeEmploymentType(selectedEmployee.value?.employmentType) === 'full-time' ? 48 : ''
})

watch([selectedEmployeeId, selectedWeekStart], async () => {
  await loadAssignments()
})

onMounted(trackPageLoad(() => {
  selectedWeekStart.value = getMondayDate()
  unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
    await loadScheduleContext(user)
  })
}))

onBeforeUnmount(() => {
  if (typeof unsubscribeAuth === 'function') {
    unsubscribeAuth()
  }
})
</script>

<style scoped>
.schedule-assignment :deep(.appearance-select) { margin: 0; }
.schedule-assignment :deep(.appearance-select label), .assignment-field-label { display: block; margin-bottom: 8px; color: #5d4536; font-size: 12px; font-weight: 600; }
.schedule-assignment :deep(.appearance-select-trigger) { min-height: 44px; border-radius: 9px; line-height: 1.6; }
.schedule-assignment :deep(.appearance-select-trigger > span) { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.schedule-assignment :deep(.appearance-select-menu li > span) { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.schedule-assignment :deep(.appearance-select-menu) { min-width: 100%; box-shadow: 0 8px 24px #3d281d1a; }
.schedule-assignment .assignment-day-select { margin-top: 16px; }
.schedule-assignment input[type=date] { min-height: 44px; border-radius: 9px; color-scheme: light; }
.assignment-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 8px; min-height: 40px; padding: 10px 15px; border: 1px solid; border-radius: 9px; font-size: 12px; font-weight: 600; line-height: 1.5; transition: background .15s, border-color .15s; }
.assignment-button-primary { background: #8d5a3b; border-color: #8d5a3b; color: #fffdf9; }
.assignment-button-primary:hover:not(:disabled) { background: #74462d; border-color: #74462d; }
.assignment-button-secondary { background: #fffdf9; border-color: #d9b896; color: #70482e; }
.assignment-button-secondary:hover:not(:disabled) { background: #f8eddc; border-color: #b78055; }
.assignment-button-small { min-height: 34px; padding: 7px 11px; font-size: 11px; }
.assignment-button:disabled { cursor: not-allowed; opacity: .5; }
.assignment-button:focus-visible { outline: 2px solid #b78055; outline-offset: 3px; }
</style>
