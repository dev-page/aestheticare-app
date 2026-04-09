<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8 text-white">
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white">Schedule Assignment</h1>
          <p class="mt-2 text-slate-400">
            Assign recurring schedules to practitioners and staff. Customer booking availability follows the assigned practitioner schedule saved here.
          </p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <h2 class="text-lg font-semibold text-white">Assignment Setup</h2>
            <p class="mt-1 text-sm text-slate-400">Choose the branch, employee, and start date you want to manage.</p>

            <div class="mt-5 space-y-4">
              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Branch</label>
                <select
                  v-model="selectedBranchId"
                  class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                >
                  <option value="">Select branch</option>
                  <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                    {{ branch.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Staff Role</label>
                <select
                  v-model="selectedRole"
                  class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                >
                  <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                    {{ role.label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Employee</label>
                <select
                  v-model="selectedEmployeeId"
                  class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                  :disabled="!filteredEmployees.length"
                >
                  <option value="">{{ filteredEmployees.length ? 'Select employee' : 'No matching employee yet' }}</option>
                  <option v-for="employee in filteredEmployees" :key="employee.id" :value="employee.id">
                    {{ employee.fullName }}{{ employee.role ? ` (${employee.role})` : '' }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Starts On</label>
                <input
                  v-model="selectedWeekStart"
                  type="date"
                  class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                />
              </div>
            </div>

            <div v-if="selectedEmployee" class="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">DSS Recommendation</h3>
                  <p class="mt-2 text-sm text-slate-200">
                    {{ selectedEmployee.fullName }} is detected as <span class="font-semibold">{{ scheduleTypeLabel }}</span>.
                  </p>
                  <p class="mt-1 text-xs text-slate-300">
                    {{ recommendedShiftSummary }}
                  </p>
                </div>
                <button
                  type="button"
                  class="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="applySuggestedShifts"
                  :disabled="!scheduleDssReady || !suggestedShiftTemplates.length"
                >
                  Apply Suggestions
                </button>
              </div>

              <div class="mt-4 grid gap-3 md:grid-cols-2">
                <div class="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
                  <p class="text-[11px] uppercase tracking-[0.2em] text-slate-400">Detected Type</p>
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
                <li>Shift templates that run for 8 hours or more are treated as full-time; shorter ones are treated as part-time.</li>
                <li>Choose Off for days when the employee should not accept work or appointments.</li>
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
                  class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700"
                  @click="resetAssignments"
                  :disabled="!selectedEmployeeId"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  @click="saveAssignments"
                  :disabled="!selectedEmployeeId || saving || Boolean(hoursWarning)"
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

                <select
                  v-model="assignments[day]"
                  class="mt-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                >
                  <option value="">Off</option>
                  <option v-for="shift in displayShiftTemplates" :key="shift.id" :value="shift.label">
                    {{ shift.label }}{{ shift.scheduleType === selectedEmployeeScheduleType ? ' (Recommended)' : '' }}
                  </option>
                </select>

                <div class="mt-3 flex items-center justify-between gap-3">
                  <p class="text-xs text-slate-400">
                    DSS suggestion:
                    <span class="text-slate-200">
                      {{ getSuggestedShiftForDay(day)?.label || 'No matching shift suggestion yet' }}
                    </span>
                  </p>
                  <button
                    type="button"
                    class="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!getSuggestedShiftForDay(day)"
                    @click="applySuggestedShiftToDay(day, getSuggestedShiftForDay(day)?.label)"
                  >
                    Use DSS
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import {
  RECURRING_SCHEDULE_ID,
  classifyShiftEmploymentType,
  createAssignmentsMap,
  normalizeEmploymentType,
  parseShiftDurationHours,
  normalizeAssignments,
} from '@/utils/employeeSchedules'

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

const selectedEmployeeScheduleType = computed(() => {
  const profileType = normalizeEmploymentType(selectedEmployee.value?.employmentType || '')
  if (profileType) return profileType
  return totalAssignedHours.value >= 8 ? 'full-time' : 'part-time'
})

const parseShiftHours = (shiftLabel) => {
  if (!shiftLabel) return 0
  const match = branchShifts.value.find((shift) => shift.label === shiftLabel)
  if (!match?.start || !match?.end) return 0
  const [startHour, startMinute] = String(match.start).split(':').map(Number)
  const [endHour, endMinute] = String(match.end).split(':').map(Number)
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0
  return Math.max(0, (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60)
}

const totalAssignedHours = computed(() =>
  daysOfWeek.reduce((total, day) => total + parseShiftHours(assignments.value[day]), 0)
)

const isFullTimeEmployee = computed(() =>
  String(selectedEmployee.value?.employmentType || '').trim().toLowerCase() === 'full-time'
)

const hoursWarning = computed(() => {
  if (!selectedEmployee.value || !isFullTimeEmployee.value) return ''
  if (totalAssignedHours.value <= 48) return ''
  return `This full-time employee is assigned ${totalAssignedHours.value} hours. Please keep the weekly total at 48 hours or below.`
})

const weeklyHoursSummary = computed(() => {
  if (!selectedEmployee.value) return ''
  if (isFullTimeEmployee.value) {
    return `Assigned hours: ${totalAssignedHours.value} / 48 hours for a full-time schedule.`
  }
  return `Assigned hours: ${totalAssignedHours.value} hour(s) for this recurring schedule.`
})

const scheduleTypeLabel = computed(() =>
  selectedEmployeeScheduleType.value === 'full-time' ? 'Full-time' : 'Part-time'
)

const matchingShiftTemplates = computed(() => {
  const scheduleType = selectedEmployeeScheduleType.value
  const matches = branchShifts.value.filter((shift) => shift.scheduleType === scheduleType)
  if (matches.length) return matches
  return [...branchShifts.value]
})

const suggestedShiftTemplates = computed(() => {
  const scheduleType = selectedEmployeeScheduleType.value
  const primaryList = branchShifts.value.filter((shift) => shift.scheduleType === scheduleType)
  const fallbackList = branchShifts.value
  const source = primaryList.length ? primaryList : fallbackList
  return [...source].sort((a, b) => {
    if (scheduleType === 'part-time') {
      if (a.durationHours !== b.durationHours) return a.durationHours - b.durationHours
    } else if (scheduleType === 'full-time') {
      if (a.durationHours !== b.durationHours) return b.durationHours - a.durationHours
    }
    return String(a.label || '').localeCompare(String(b.label || ''))
  })
})

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
  if (!selectedEmployee.value) return ''
  const scheduleType = selectedEmployeeScheduleType.value
  const matchingCount = branchShifts.value.filter((shift) => shift.scheduleType === scheduleType).length

  if (!branchShifts.value.length) {
    return 'Create shift templates first so the DSS can recommend the right schedule.'
  }

  if (matchingCount > 0) {
    return scheduleType === 'part-time'
      ? 'The system detected a part-time employee and is prioritizing shifts shorter than 8 hours.'
      : 'The system detected a full-time employee and is prioritizing shifts that are 8 hours or longer.'
  }

  return 'No exact DSS match is available for this employee, so all branch shifts are being shown.'
})

const applySuggestedShiftToDay = (day, shiftLabel) => {
  if (!day) return
  assignments.value[day] = String(shiftLabel || '').trim()
}

const applySuggestedShifts = () => {
  const suggestions = suggestedShiftTemplates.value
  if (!suggestions.length) {
    toast.info('No shift suggestion is available yet.')
    return
  }

  let updated = false
  daysOfWeek.forEach((day, index) => {
    if (!assignments.value[day]) {
      const suggestion = suggestions[index % suggestions.length]
      if (!suggestion) return
      assignments.value[day] = suggestion.label
      updated = true
    }
  })

  if (!updated) {
    toast.info('The suggested shift is already applied to all days.')
    return
  }

  toast.success(`Applied ${scheduleTypeLabel.value.toLowerCase()} DSS suggestion to empty days.`)
}

const getSuggestedShiftForDay = (day) => {
  if (!day || !suggestedShiftTemplates.value.length) return null
  const index = daysOfWeek.indexOf(day)
  if (index < 0) return null
  return suggestedShiftTemplates.value[index % suggestedShiftTemplates.value.length] || null
}

const scheduleDssReady = computed(() => Boolean(selectedEmployee.value && branchShifts.value.length))

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
  const normalizedRole = String(profile.role || '').trim().toLowerCase()
  const isOwnerLike = ['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalizedRole)

  let accessibleClinics = []
  let preferredBranchId = ''

  if (isOwnerLike) {
    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)))
    accessibleClinics = clinicsSnap.docs
  } else {
    const assignedBranchId = String(profile.branchId || '').trim()
    preferredBranchId = assignedBranchId

    if (!assignedBranchId) {
      branches.value = []
      selectedBranchId.value = ''
      return
    }

    const assignedClinicSnap = await getDoc(doc(db, 'clinics', assignedBranchId))
    if (!assignedClinicSnap.exists()) {
      branches.value = []
      selectedBranchId.value = ''
      return
    }

    const ownerId = String(assignedClinicSnap.data()?.ownerId || '').trim()
    if (!ownerId) {
      branches.value = []
      selectedBranchId.value = ''
      return
    }

    const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
    accessibleClinics = clinicsSnap.docs
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
        durationHours,
        scheduleType: classifyShiftEmploymentType({ start, end })
      }
    })
}

const loadAssignments = async () => {
  if (!selectedEmployeeId.value) {
    assignments.value = emptyAssignments()
    loadedAssignments.value = emptyAssignments()
    return
  }

  const recurringSnap = await getDoc(doc(db, 'users', selectedEmployeeId.value, 'schedules', RECURRING_SCHEDULE_ID))
  const nextAssignments = normalizeAssignments(recurringSnap.exists() ? recurringSnap.data()?.assignments || {} : {}, daysOfWeek)

  assignments.value = { ...nextAssignments }
  loadedAssignments.value = { ...nextAssignments }
}

const loadScheduleContext = async (user) => {
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
}

const resetAssignments = () => {
  assignments.value = { ...loadedAssignments.value }
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
      updatedAt: serverTimestamp()
    }

    const scheduleRef = doc(db, 'users', selectedEmployee.value.id, 'schedules', RECURRING_SCHEDULE_ID)
    const existingSnap = await getDoc(scheduleRef)
    if (!existingSnap.exists()) {
      payload.createdAt = serverTimestamp()
    }

    await setDoc(scheduleRef, payload, { merge: true })
    await logActivity(db, {
      module: 'HR',
      action: 'Updated recurring staff schedule',
      details: `Saved recurring schedule for ${selectedEmployee.value.fullName} (${employeeRole}) starting ${selectedWeekStart.value}.`
    })

    loadedAssignments.value = { ...assignments.value }
    toast.success('Recurring schedule saved successfully.')
  } catch (error) {
    console.error(error)
    toast.error('Failed to save recurring schedule.')
  } finally {
    saving.value = false
  }
}

watch(selectedBranchId, async () => {
  await Promise.all([hydrateEmployees(), hydrateBranchShifts(), hydrateCustomRoles()])
})

watch(selectedRole, () => {
  if (!filteredEmployees.value.some((employee) => employee.id === selectedEmployeeId.value)) {
    selectedEmployeeId.value = filteredEmployees.value[0]?.id || ''
  }
})

watch([selectedEmployeeId, selectedWeekStart], async () => {
  await loadAssignments()
})

onMounted(() => {
  selectedWeekStart.value = getMondayDate()
  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    await loadScheduleContext(user)
  })
})

onBeforeUnmount(() => {
  if (typeof unsubscribeAuth === 'function') {
    unsubscribeAuth()
  }
})
</script>
