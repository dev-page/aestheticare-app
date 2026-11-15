<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'
import { recurringScheduleVersions, resolveRecurringScheduleVersion } from '../../../../../../shared/recurringEmployeeSchedules.js'
import { parseShiftDurationHours } from '@/utils/employeeSchedules'

export default {
  name: 'AddShift',
  props: { embedded: { type: Boolean, default: false } },
  components: { OwnerSidebar },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
    const { hasPermission } = usePermissions()
    const canManageShifts = computed(() => hasPermission('hr:update'))

    const db = getFirestore(getApp())
    const branches = ref([])
    const shifts = ref([])
    const shiftsLoading = ref(false)
    const editingShiftId = ref('')
    const breakCustomized = ref(false)

    const currentShift = ref({
      shiftType: '',
      start: '',
      end: '',
      unpaidMealBreakMinutes: 0,
      branch: '',
      notes: '',
      capacity: 1,
      employees: []
    })

    const shiftTypes = ['Morning', 'Afternoon', 'Evening']
    const isOwnerLikeRole = (role) => {
      const normalized = String(role || '').trim().toLowerCase()
      return ['owner', 'clinic owner', 'clinicowner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalized)
    }

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
      }
      return chunks
    }

    const loadBranches = trackPageLoad(async (user) => {
      try {
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
        if (isOwnerLikeRole(profile.role)) {
          const ownerClinicsSnapshot = await getDocs(
            query(collection(db, 'clinics'), where('ownerId', '==', user.uid))
          )

          branches.value = ownerClinicsSnapshot.docs.map((clinicDoc) => {
            const data = clinicDoc.data()
            return {
              id: clinicDoc.id,
              branch: data.clinicBranch || data.clinicName || 'Unnamed Branch',
              location: data.clinicLocation || '-'
            }
          })

          const selectedExists = branches.value.some((branch) => branch.branch === currentShift.value.branch)
          if (!selectedExists) currentShift.value.branch = ''
          return
        }

        const hrBranchId = profile.branchId || ''
        if (!hrBranchId) {
          const adminClinicSnapshot = await getDocs(
            query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid))
          )
          const adminClinicSnap = adminClinicSnapshot.docs[0]
          if (!adminClinicSnap) {
            branches.value = []
            toast.error('Your account has no branch assignment.')
            return
          }

          const data = adminClinicSnap.data() || {}
          branches.value = [{
            id: adminClinicSnap.id,
            branch: data.clinicBranch || data.clinicName || 'Unnamed Branch',
            location: data.clinicLocation || '-'
          }]
        } else {
          const hrClinicSnap = await getDoc(doc(db, 'clinics', hrBranchId))
          if (!hrClinicSnap.exists()) {
            branches.value = []
            toast.error('Assigned branch was not found.')
            return
          }

          const data = hrClinicSnap.data() || {}
          branches.value = [{
            id: hrClinicSnap.id,
            branch: data.clinicBranch || data.clinicName || 'Unnamed Branch',
            location: data.clinicLocation || '-'
          }]
        }

        const selectedExists = branches.value.some((branch) => branch.branch === currentShift.value.branch)
        if (!selectedExists) currentShift.value.branch = ''
      } catch (err) {
        console.error('Error loading branches:', err)
      }
    })

    const loadShifts = trackPageLoad(async () => {
      shiftsLoading.value = true
      try {
        const branchIds = branches.value.map((branch) => branch.id).filter(Boolean)
        if (!branchIds.length) {
          shifts.value = []
          return
        }

        const snapshots = await Promise.all(
          chunkArray(branchIds).map((ids) => getDocs(query(collection(db, 'shifts'), where('branchId', 'in', ids))))
        )

        const records = snapshots.flatMap((snapshot) =>
          snapshot.docs.map((shiftDoc) => ({
            id: shiftDoc.id,
            ...shiftDoc.data()
          }))
        )

        shifts.value = records.sort((a, b) => {
          if (Boolean(a.isArchived) !== Boolean(b.isArchived)) return Number(Boolean(a.isArchived)) - Number(Boolean(b.isArchived))
          const branchCompare = String(a.branch || '').localeCompare(String(b.branch || ''))
          if (branchCompare !== 0) return branchCompare
          const typeCompare = String(a.shiftType || '').localeCompare(String(b.shiftType || ''))
          if (typeCompare !== 0) return typeCompare
          return String(a.start || '').localeCompare(String(b.start || ''))
        })
      } catch (err) {
        console.error('Error loading shifts:', err)
        shifts.value = []
      } finally {
        shiftsLoading.value = false
      }
    })

    let unsubscribeAuth = null
    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        await loadBranches(user)
        await loadShifts()
      })
    }))

    const resetForm = () => {
      editingShiftId.value = ''
      breakCustomized.value = false
      currentShift.value = {
        shiftType: '',
        start: '',
        end: '',
        unpaidMealBreakMinutes: 0,
        branch: '',
        notes: '',
        capacity: 1,
        employees: []
      }
    }

    const startEditingShift = (shift) => {
      editingShiftId.value = shift.id
      breakCustomized.value = true
      currentShift.value = {
        shiftType: String(shift.shiftType || '').trim(),
        start: String(shift.start || '').trim(),
        end: String(shift.end || '').trim(),
        unpaidMealBreakMinutes: getShiftBreakMinutes(shift),
        branch: String(shift.branch || '').trim(),
        notes: String(shift.notes || '').trim(),
        capacity: Number(shift.capacity || 1),
        employees: Array.isArray(shift.employees) ? [...shift.employees] : []
      }
    }

    const timeToMinutes = (value) => {
      if (!value) return null
      const parts = String(value).split(':')
      if (parts.length < 2) return null
      const hours = Number(parts[0])
      const minutes = Number(parts[1])
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
      return hours * 60 + minutes
    }

    const formatTime = (value) => {
      const parts = String(value || '').split(':')
      if (parts.length < 2) return value || '-'

      const hours = Number(parts[0])
      const minutes = Number(parts[1])
      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return value || '-'
      }

      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHour = hours % 12 || 12
      return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
    }

    const shiftTimePresets = {
      Morning: { start: '08:00', end: '17:00' },
      Afternoon: { start: '13:00', end: '21:00' },
      Evening: { start: '18:00', end: '23:00' },
    }

    const getShiftBreakMinutes = (shift = {}) => {
      const storedBreak = shift.unpaidMealBreakMinutes ?? shift.mealBreakMinutes
      const explicitBreak = Number(storedBreak)
      if (storedBreak !== null && storedBreak !== undefined && Number.isFinite(explicitBreak) && explicitBreak >= 0) return explicitBreak
      const start = timeToMinutes(shift.start), end = timeToMinutes(shift.end)
      return start !== null && end - start > 8 * 60 ? 60 : 0
    }
    const updateDefaultMealBreak = () => {
      if (breakCustomized.value) return
      const start = timeToMinutes(currentShift.value.start), end = timeToMinutes(currentShift.value.end)
      currentShift.value.unpaidMealBreakMinutes = start !== null && end !== null && end - start > 8 * 60 ? 60 : 0
    }
    const currentShiftPaidHours = computed(() => parseShiftDurationHours(currentShift.value))
    const formatPaidHours = (shift) => {
      const hours = parseShiftDurationHours(shift)
      return `${Number.isInteger(hours) ? hours : hours.toFixed(2)} hours`
    }

    const applyShiftTypeDefaults = (type) => {
      const rule = shiftTimePresets[type]
      if (!rule) return
      currentShift.value.shiftType = type
      currentShift.value.start = rule.start
      currentShift.value.end = rule.end
      currentShift.value.unpaidMealBreakMinutes = getShiftBreakMinutes(rule)
      breakCustomized.value = false
    }

    const validateShiftInput = () => {
      const shiftName = String(currentShift.value.shiftType || '').trim()
      if (
        !shiftName ||
        !currentShift.value.start ||
        !currentShift.value.end ||
        !currentShift.value.branch
      ) {
        toast.error('Shift name, start time, end time, and branch are required.')
        return false
      }
      if (shiftName.length > 80) {
        toast.error('Shift names should be 80 characters or fewer.')
        return false
      }

      const startMinutes = timeToMinutes(currentShift.value.start)
      const endMinutes = timeToMinutes(currentShift.value.end)
      if (startMinutes === null || endMinutes === null) {
        toast.error('Please provide a valid start and end time.')
        return false
      }
      if (endMinutes <= startMinutes) {
        toast.error('End time must be later than start time on the same day.')
        return false
      }
      const unpaidMealBreakMinutes = Number(currentShift.value.unpaidMealBreakMinutes)
      if (!Number.isInteger(unpaidMealBreakMinutes) || unpaidMealBreakMinutes < 0 || unpaidMealBreakMinutes > 180 || unpaidMealBreakMinutes >= endMinutes - startMinutes) {
        toast.error('Enter an unpaid meal break from 0 to 180 minutes that is shorter than the shift.')
        return false
      }

      const duplicateShift = shifts.value.some((shift) =>
        shift.id !== editingShiftId.value &&
        String(shift.branchId || '') === String(
          branches.value.find((branch) => branch.branch === currentShift.value.branch)?.id || ''
        ) &&
        !shift.isArchived &&
        String(shift.shiftType || '').trim().toLowerCase() === shiftName.toLowerCase() &&
        String(shift.start || '').trim() === String(currentShift.value.start || '').trim() &&
        String(shift.end || '').trim() === String(currentShift.value.end || '').trim() &&
        getShiftBreakMinutes(shift) === Number(currentShift.value.unpaidMealBreakMinutes)
      )
      if (duplicateShift) {
        toast.error('A shift with the same name and time already exists for this branch.')
        return false
      }

      const capacity = Number(currentShift.value.capacity || 0)
      if (!Number.isFinite(capacity) || capacity < 1) {
        toast.error('Capacity must be at least 1.')
        return false
      }

      if (String(currentShift.value.notes || '').length > 300) {
        toast.error('Notes should be 300 characters or fewer.')
        return false
      }

      return true
    }

    const shiftIsAssigned = async (shift) => {
      if (!shift?.branchId) return false
      const people = await getDocs(query(collection(db, 'users'), where('branchId', '==', shift.branchId)))
      const scheduleGroups = await Promise.all(people.docs.map(person =>
        getDocs(collection(db, 'users', person.id, 'schedules'))
      ))
      const today = new Date()
      today.setDate(today.getDate() - (today.getDay() + 6) % 7)
      const currentWeekStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const previousLabel = `${String(shift.shiftType || 'Shift').trim()} || ${String(shift.start || '').trim()} - ${String(shift.end || '').trim()}`
      const matches = (schedule = {}) => {
        const assignments = Object.values(schedule.assignments || {}).map(value => String(value || '').trim())
        const labels = Object.values(schedule.assignmentLabels || {}).map(value => String(value || '').trim())
        return [...assignments, ...labels].some(value => value === shift.id || value === previousLabel)
      }
      return scheduleGroups.some(group => group.docs.some(scheduleDoc => {
        const data = scheduleDoc.data() || {}
        const isRecurring = scheduleDoc.id === 'recurring' || data.recurring === true || String(data.type || '').toLowerCase() === 'recurring'
        if (isRecurring) {
          const current = resolveRecurringScheduleVersion(data, currentWeekStart)
          const future = recurringScheduleVersions(data).filter(version => version.effectiveFrom > currentWeekStart)
          return matches(current || {}) || future.some(matches)
        }
        const effectiveWeek = String(data.weekStart || scheduleDoc.id || '')
        return effectiveWeek >= currentWeekStart && matches(data)
      }))
    }

    const normalizeCapacity = () => {
      const numeric = Number(currentShift.value.capacity || 0)
      if (!Number.isFinite(numeric) || numeric < 1) {
        currentShift.value.capacity = 1
      } else {
        currentShift.value.capacity = Math.floor(numeric)
      }
    }

    const saveShift = async () => {
      if (!validateShiftInput()) return

      try {
        const isEditing = Boolean(editingShiftId.value)
        const existingShift = isEditing ? shifts.value.find((shift) => shift.id === editingShiftId.value) : null
        const changesShiftIdentity = Boolean(existingShift && (
          String(existingShift.shiftType || '').trim() !== String(currentShift.value.shiftType || '').trim() ||
          String(existingShift.start || '').trim() !== String(currentShift.value.start || '').trim() ||
          String(existingShift.end || '').trim() !== String(currentShift.value.end || '').trim() ||
          getShiftBreakMinutes(existingShift) !== Number(currentShift.value.unpaidMealBreakMinutes)
        ))
        const reducesStaffCapacity = Boolean(existingShift && Number(currentShift.value.capacity) < Number(existingShift.capacity || 1))
        const assigned = existingShift && (changesShiftIdentity || reducesStaffCapacity) ? await shiftIsAssigned(existingShift) : false
        if (existingShift && assigned && changesShiftIdentity) {
          toast.error('This shift is assigned to employee schedules. Copy it to create a new time pattern, reassign employees, then archive the old template.')
          return
        }
        if (existingShift && assigned && reducesStaffCapacity) {
          toast.error('Staff capacity cannot be reduced while this template is assigned. Reassign employees first, then update the capacity.')
          return
        }
        const result = await Swal.fire({
          title: isEditing ? 'Update Shift' : 'Confirm Shift',
          text: isEditing
            ? `Save ${currentShift.value.shiftType} (${currentShift.value.start} - ${currentShift.value.end}, ${currentShift.value.unpaidMealBreakMinutes} unpaid break minutes) at ${currentShift.value.branch}?`
            : `Create ${currentShift.value.shiftType} (${currentShift.value.start} - ${currentShift.value.end}, ${currentShift.value.unpaidMealBreakMinutes} unpaid break minutes) at ${currentShift.value.branch} with capacity for ${currentShift.value.capacity} staff member(s)?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: isEditing ? 'Save changes' : 'Yes, create',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info('Shift creation cancelled.')
          return
        }

        const selectedBranch = branches.value.find((branch) => branch.branch === currentShift.value.branch)
        const payload = {
          shiftType: currentShift.value.shiftType,
          start: currentShift.value.start,
          end: currentShift.value.end,
          unpaidMealBreakMinutes: Number(currentShift.value.unpaidMealBreakMinutes),
          branch: currentShift.value.branch,
          branchId: selectedBranch?.id || '',
          notes: currentShift.value.notes,
          capacity: currentShift.value.capacity,
          isArchived: Boolean(existingShift?.isArchived),
          employees: isEditing
            ? (shifts.value.find((shift) => shift.id === editingShiftId.value)?.employees || [])
            : [],
          updatedAt: serverTimestamp()
        }

        if (isEditing) {
          await updateDoc(doc(db, 'shifts', editingShiftId.value), payload)
        } else {
          await addDoc(collection(db, 'shifts'), {
            ...payload,
            createdAt: serverTimestamp()
          })
        }

        await logActivity(db, {
          module: 'HR',
          action: isEditing ? 'Updated shift' : 'Added shift',
          details: `${isEditing ? 'Updated' : 'Created'} ${currentShift.value.shiftType} shift (${currentShift.value.start} - ${currentShift.value.end}) for ${currentShift.value.branch}.`
        })

        toast.success(isEditing ? 'Shift updated successfully!' : 'Shift added successfully!')
        resetForm()
        await loadShifts()
      } catch (err) {
        console.error('Error adding shift:', err)
        toast.error('Failed to add shift.')
      }
    }

    const archiveShiftRecord = async (shift) => {
      if (!shift?.id) return

      try {
        const nextArchivedState = !shift.isArchived
        const result = await Swal.fire({
          title: nextArchivedState ? 'Archive Shift Template' : 'Restore Shift Template',
          text: nextArchivedState
            ? `Hide ${shift.shiftType || 'this shift'} from new assignments? Existing employee schedules will keep using it.`
            : `Make ${shift.shiftType || 'this shift'} available for new assignments again?`,
          icon: nextArchivedState ? 'warning' : 'question',
          showCancelButton: true,
          confirmButtonText: nextArchivedState ? 'Archive template' : 'Restore template',
          cancelButtonText: 'Cancel',
          confirmButtonColor: nextArchivedState ? '#dc2626' : undefined
        })

        if (!result.isConfirmed) return

        await updateDoc(doc(db, 'shifts', shift.id), {
          isArchived: nextArchivedState,
          archivedAt: nextArchivedState ? serverTimestamp() : null,
          updatedAt: serverTimestamp()
        })

        await logActivity(db, {
          module: 'HR',
          action: nextArchivedState ? 'Archived shift template' : 'Restored shift template',
          details: `${nextArchivedState ? 'Archived' : 'Restored'} ${shift.shiftType || 'shift'} (${shift.start || ''} - ${shift.end || ''}) for ${shift.branch || 'Unknown Branch'}.`
        })

        if (editingShiftId.value === shift.id) {
          resetForm()
        }

        toast.success(nextArchivedState ? 'Shift template archived. Existing schedules are preserved.' : 'Shift template restored.')
        await loadShifts()
      } catch (err) {
        console.error('Error archiving shift:', err)
        toast.error('Failed to update shift template.')
      }
    }

    const duplicateShiftRecord = (shift) => {
      if (!shift || shift.isArchived) return
      editingShiftId.value = ''
      breakCustomized.value = true
      currentShift.value = {
        shiftType: `${String(shift.shiftType || 'Shift').trim()} Copy`.slice(0, 80),
        start: String(shift.start || '').trim(),
        end: String(shift.end || '').trim(),
        unpaidMealBreakMinutes: getShiftBreakMinutes(shift),
        branch: String(shift.branch || '').trim(),
        notes: String(shift.notes || '').trim(),
        capacity: Number(shift.capacity || 1),
        employees: []
      }
    }

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageLoading,
      canManageShifts,
      currentShift,
      branches,
      shiftTypes,
      applyShiftTypeDefaults,
      currentShiftPaidHours,
      formatPaidHours,
      getShiftBreakMinutes,
      breakCustomized,
      updateDefaultMealBreak,
      formatTime,
      shifts,
      shiftsLoading,
      editingShiftId,
      saveShift,
      resetForm,
      normalizeCapacity,
      startEditingShift,
      archiveShiftRecord,
      duplicateShiftRecord
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row module-theme min-w-0" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component :is="embedded ? 'div' : 'main'" v-page-loading="{ active: pageLoading, header: !embedded, blocks: [{ variant: 'form', fields: 7, sections: 1 }, { variant: 'table', columns: 8, rows: 4 }] }" class="flex-1 min-w-0 text-white" :class="embedded ? '' : 'p-6 md:p-10'">
      <h1 v-if="!embedded" class="text-2xl font-bold mb-6">Add Shift</h1>

      <div class="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700 max-w-2xl mx-auto">
        <form class="space-y-4">
          <div v-if="editingShiftId" class="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Editing a reusable template. Assigned templates keep their name and times; use Copy to create a replacement, move employees to it, then archive the old template.
          </div>

          <div>
            <label for="shift-name" class="block text-slate-400 mb-1">Shift Name</label>
            <input
              id="shift-name"
              v-model="currentShift.shiftType"
              maxlength="80"
              type="text"
              placeholder="For example, Opening Shift or Saturday Clinic"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-slate-400">Choose a name that makes sense to your team. Start and end times define the shift period.</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="type in shiftTypes"
                :key="type"
                type="button"
                @click="applyShiftTypeDefaults(type)"
                class="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-700"
              >
                Use {{ type }} preset
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 mb-1">Start Time</label>
              <input
                type="time"
                v-model="currentShift.start"
                @input="updateDefaultMealBreak"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                v-model="currentShift.end"
                @input="updateDefaultMealBreak"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p class="text-xs text-slate-400">Presets fill suggested times only. You can change either time to match your clinic’s hours. Shifts currently run within one calendar day.</p>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label for="shift-meal-break" class="block text-slate-400 mb-1">Unpaid Meal Break (minutes)</label>
              <input id="shift-meal-break" v-model.number="currentShift.unpaidMealBreakMinutes" @input="breakCustomized = true" type="number" min="0" max="180" step="1" class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500" />
              <p class="mt-1 text-xs text-slate-400">This break is excluded from scheduled paid hours and payroll calculations.</p>
            </div>
            <div class="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-slate-400">Paid time per shift</p>
              <p class="mt-1 text-lg font-semibold text-white">{{ currentShiftPaidHours }} hours</p>
              <p class="text-xs text-slate-400">Start-to-end time minus the unpaid break.</p>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Branch</label>
            <select
              v-model="currentShift.branch"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            >
              <option disabled value="">Select Branch</option>
              <option v-for="branch in branches" :key="branch.id" :value="branch.branch">
                {{ branch.branch }} - {{ branch.location }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Staff Capacity (Employees)</label>
            <input
              type="number"
              min="1"
              v-model="currentShift.capacity"
              @input="normalizeCapacity"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-slate-400">Maximum number of employees who can be assigned this template on the same weekday.</p>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Notes</label>
            <textarea
              v-model="currentShift.notes"
              placeholder="Optional notes"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <div class="flex justify-end space-x-2 pt-4">
            <button
              type="reset"
              @click="resetForm"
              class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded transition"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="saveShift"
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              {{ editingShiftId ? 'Save Changes' : 'Add Shift' }}
            </button>
          </div>
        </form>
      </div>

      <div class="mt-8 bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700">
        <div class="mb-4">
          <h2 class="text-xl font-semibold text-white">Created Shifts</h2>
          <p class="text-sm text-slate-400">Review the shifts already created for your accessible branches.</p>
        </div>

        <div v-if="shiftsLoading" class="text-sm text-slate-400">Loading shifts...</div>
        <div v-else-if="!shifts.length" class="text-sm text-slate-400">No shifts created yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[960px] text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400 uppercase text-xs">
                <th class="py-3 px-3">Shift Name</th>
                <th class="py-3 px-3">Time</th>
                <th class="py-3 px-3">Unpaid Break</th>
                <th class="py-3 px-3">Paid Duration</th>
                <th class="py-3 px-3">Branch</th>
                <th class="py-3 px-3">Staff Capacity</th>
                <th class="py-3 px-3">Notes</th>
                <th class="py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="text-white">
              <tr v-for="shift in shifts" :key="shift.id" class="border-b border-slate-800 hover:bg-slate-700/40">
                <td class="py-3 px-3 font-medium">
                  {{ shift.shiftType || 'Shift' }}
                  <span v-if="shift.isArchived" class="ml-2 rounded-full bg-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">Archived</span>
                </td>
                <td class="py-3 px-3">{{ formatTime(shift.start) }} - {{ formatTime(shift.end) }}</td>
                <td class="py-3 px-3">{{ getShiftBreakMinutes(shift) }} min</td>
                <td class="py-3 px-3">{{ formatPaidHours(shift) }}</td>
                <td class="py-3 px-3">{{ shift.branch || 'Unknown Branch' }}</td>
                <td class="py-3 px-3">{{ shift.capacity || 0 }}</td>
                <td class="py-3 px-3 text-slate-300">{{ shift.notes || 'No notes' }}</td>
                <td class="py-3 px-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-if="!shift.isArchived && canManageShifts"
                      type="button"
                      @click="startEditingShift(shift)"
                      class="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      v-if="!shift.isArchived"
                      type="button"
                      @click="duplicateShiftRecord(shift)"
                      class="rounded-lg border border-sky-500/40 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/10"
                    >
                      Copy
                    </button>
                    <button
                      v-if="canManageShifts"
                      type="button"
                      @click="archiveShiftRecord(shift)"
                      :class="shift.isArchived ? 'border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10' : 'border-rose-500/40 text-rose-200 hover:bg-rose-500/10'"
                      class="rounded-lg border px-3 py-2 text-xs font-semibold transition"
                    >
                      {{ shift.isArchived ? 'Restore' : 'Archive' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </component>
  </div>
</template>
