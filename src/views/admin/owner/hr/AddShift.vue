<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'AddShift',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const branches = ref([])
    const shifts = ref([])
    const shiftsLoading = ref(false)
    const editingShiftId = ref('')

    const currentShift = ref({
      shiftType: '',
      start: '',
      end: '',
      branch: '',
      notes: '',
      capacity: 1,
      employees: []
    })

    const shiftTypes = ['Morning', 'Afternoon', 'Evening']

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size))
      }
      return chunks
    }

    const loadBranches = async (user) => {
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
        const normalizedRole = String(profile.role || '').trim().toLowerCase()
        const isOwnerLike = ['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalizedRole)

        if (isOwnerLike) {
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
          branches.value = []
          toast.error('Your account has no branch assignment.')
          return
        }

        const hrClinicSnap = await getDoc(doc(db, 'clinics', hrBranchId))
        if (!hrClinicSnap.exists()) {
          branches.value = []
          toast.error('Assigned branch was not found.')
          return
        }

        const ownerId = hrClinicSnap.data().ownerId || ''
        if (!ownerId) {
          branches.value = []
          toast.error('Assigned branch has no owner mapping.')
          return
        }

        const ownerClinicsSnapshot = await getDocs(
          query(collection(db, 'clinics'), where('ownerId', '==', ownerId))
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
      } catch (err) {
        console.error('Error loading branches:', err)
      }
    }

    const loadShifts = async () => {
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
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        await loadBranches(user)
        await loadShifts()
      })
    })

    const resetForm = () => {
      editingShiftId.value = ''
      currentShift.value = {
        shiftType: '',
        start: '',
        end: '',
        branch: '',
        notes: '',
        capacity: 1,
        employees: []
      }
    }

    const startEditingShift = (shift) => {
      editingShiftId.value = shift.id
      currentShift.value = {
        shiftType: String(shift.shiftType || '').trim(),
        start: String(shift.start || '').trim(),
        end: String(shift.end || '').trim(),
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
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
      return hours * 60 + minutes
    }

    const validateShiftInput = () => {
      if (
        !currentShift.value.shiftType ||
        !currentShift.value.start ||
        !currentShift.value.end ||
        !currentShift.value.branch
      ) {
        toast.error('Shift type, start time, end time, and branch are required.')
        return false
      }

      const startMinutes = timeToMinutes(currentShift.value.start)
      const endMinutes = timeToMinutes(currentShift.value.end)
      if (startMinutes === null || endMinutes === null) {
        toast.error('Please provide a valid start and end time.')
        return false
      }
      if (endMinutes <= startMinutes) {
        toast.error('End time must be later than start time.')
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
        const result = await Swal.fire({
          title: isEditing ? 'Update Shift' : 'Confirm Shift',
          text: isEditing
            ? `Save the changes to this ${currentShift.value.shiftType} shift (${currentShift.value.start} - ${currentShift.value.end}) at ${currentShift.value.branch}?`
            : `Create a ${currentShift.value.shiftType} shift (${currentShift.value.start} - ${currentShift.value.end}) at ${currentShift.value.branch} with capacity ${currentShift.value.capacity}?`,
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
          branch: currentShift.value.branch,
          branchId: selectedBranch?.id || '',
          notes: currentShift.value.notes,
          capacity: currentShift.value.capacity,
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

    const deleteShiftRecord = async (shift) => {
      if (!shift?.id) return

      try {
        const result = await Swal.fire({
          title: 'Delete Shift',
          text: `Delete the ${shift.shiftType || 'shift'} schedule for ${shift.branch || 'this branch'}?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#dc2626'
        })

        if (!result.isConfirmed) return

        await deleteDoc(doc(db, 'shifts', shift.id))

        await logActivity(db, {
          module: 'HR',
          action: 'Deleted shift',
          details: `Deleted ${shift.shiftType || 'shift'} (${shift.start || ''} - ${shift.end || ''}) for ${shift.branch || 'Unknown Branch'}.`
        })

        if (editingShiftId.value === shift.id) {
          resetForm()
        }

        toast.success('Shift deleted successfully!')
        await loadShifts()
      } catch (err) {
        console.error('Error deleting shift:', err)
        toast.error('Failed to delete shift.')
      }
    }

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      currentShift,
      branches,
      shiftTypes,
      shifts,
      shiftsLoading,
      editingShiftId,
      saveShift,
      resetForm,
      normalizeCapacity,
      startEditingShift,
      deleteShiftRecord
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-10 text-white">
      <h1 class="text-2xl font-bold mb-6">Add Shift</h1>

      <div class="bg-slate-800 rounded-xl shadow-lg p-6 md:p-8 border border-slate-700 max-w-2xl mx-auto">
        <form class="space-y-4">
          <div v-if="editingShiftId" class="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Editing an existing shift. Save your changes below, or press Cancel to stop editing.
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Shift Type</label>
            <select
              v-model="currentShift.shiftType"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            >
              <option disabled value="">Select Shift Type</option>
              <option v-for="type in shiftTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 mb-1">Start Time</label>
              <input
                type="time"
                v-model="currentShift.start"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                v-model="currentShift.end"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
              />
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
            <label class="block text-slate-400 mb-1">Capacity (Slots)</label>
            <input
              type="number"
              min="1"
              v-model="currentShift.capacity"
              @input="normalizeCapacity"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
            />
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
          <table class="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-700 text-slate-400 uppercase text-xs">
                <th class="py-3 px-3">Shift Type</th>
                <th class="py-3 px-3">Time</th>
                <th class="py-3 px-3">Branch</th>
                <th class="py-3 px-3">Capacity</th>
                <th class="py-3 px-3">Notes</th>
                <th class="py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody class="text-white">
              <tr v-for="shift in shifts" :key="shift.id" class="border-b border-slate-800 hover:bg-slate-700/40">
                <td class="py-3 px-3 font-medium">{{ shift.shiftType || 'Shift' }}</td>
                <td class="py-3 px-3">{{ shift.start }} - {{ shift.end }}</td>
                <td class="py-3 px-3">{{ shift.branch || 'Unknown Branch' }}</td>
                <td class="py-3 px-3">{{ shift.capacity || 0 }}</td>
                <td class="py-3 px-3 text-slate-300">{{ shift.notes || 'No notes' }}</td>
                <td class="py-3 px-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      @click="startEditingShift(shift)"
                      class="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      @click="deleteShiftRecord(shift)"
                      class="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>
