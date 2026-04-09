<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8">
      <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Attendance</h1>
      <p class="text-slate-400 mb-6">Attendance records for your branch</p>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 overflow-x-auto">
        <table class="w-full text-left min-w-[650px] border-collapse">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-4">Employee</th>
              <th class="py-2 px-4">Date</th>
              <th class="py-2 px-4">Time In</th>
              <th class="py-2 px-4">Time Out</th>
              <th class="py-2 px-4">Attendance</th>
              <th class="py-2 px-4">Work Hours</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <template v-for="group in groupedAttendance" :key="group.dateKey">
              <tr class="bg-slate-900/60">
                <td colspan="6" class="py-2 px-4 text-sm font-semibold text-slate-200">
                  {{ group.label }}
                </td>
              </tr>
              <tr v-for="record in group.records" :key="record.id" class="hover:bg-slate-700 transition-colors">
                <td class="py-2 px-4 font-medium">{{ record.employeeName || 'N/A' }}</td>
                <td class="py-2 px-4">{{ record.date || '-' }}</td>
                <td class="py-2 px-4">{{ record.timeIn || '-' }}</td>
                <td class="py-2 px-4">{{ record.timeOut || '-' }}</td>
                <td class="py-2 px-4">
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      record.attendanceStatus === 'Present' ? 'bg-green-500/20 text-green-400' :
                      record.attendanceStatus === 'Late' ? 'bg-yellow-500/20 text-yellow-400' :
                      record.attendanceStatus === 'Absent' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    ]"
                  >
                    {{ record.attendanceStatus || record.status || 'Logged' }}
                  </span>
                </td>
                <td class="py-2 px-4">
                  <span
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      record.workHoursStatus === 'Overtime' ? 'bg-blue-500/20 text-blue-400' :
                      record.workHoursStatus === 'Undertime' ? 'bg-orange-500/20 text-orange-400' :
                      record.workHoursStatus === 'No Clock Out' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-300'
                    ]"
                  >
                    {{ record.workHoursStatus || '-' }}
                  </span>
                </td>
              </tr>
            </template>

            <tr v-if="groupedAttendance.length === 0">
              <td colspan="6" class="py-6 text-center text-slate-400">No attendance records found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { classifyAttendanceRecord } from '@/utils/attendanceStatus'

export default {
  name: 'ManagerAttendance',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const attendanceRecords = ref([])

    const toDate = (record) => {
      if (record?.date) {
        const parsed = new Date(`${record.date}T00:00:00`)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
      if (record?.createdAt?.toDate) return record.createdAt.toDate()
      if (record?.createdAt?.seconds) return new Date(record.createdAt.seconds * 1000)
      return null
    }

    const formatHeader = (date) =>
      date
        ? date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Unknown Date'

    const groupedAttendance = computed(() => {
      const map = new Map()
      attendanceRecords.value.forEach((record) => {
        const dateObj = toDate(record)
        const dateKey = dateObj ? dateObj.toISOString().slice(0, 10) : 'unknown'
        if (!map.has(dateKey)) {
          map.set(dateKey, { dateKey, label: formatHeader(dateObj), records: [] })
        }
        map.get(dateKey).records.push(record)
      })
      return Array.from(map.values()).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
    })

    const loadAttendance = async () => {
      if (!currentBranchId.value) {
        attendanceRecords.value = []
        return
      }

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('branchId', '==', currentBranchId.value)
      )
      const snapshot = await getDocs(attendanceQuery)
      attendanceRecords.value = snapshot.docs
        .map((snap) => {
          const data = snap.data() || {}
          const computedMeta = classifyAttendanceRecord({
            timeIn: data.timeIn || '',
            timeOut: data.timeOut || '',
            shiftStart: data.shiftStart || '',
            shiftEnd: data.shiftEnd || '',
          })

          return {
            id: snap.id,
            ...data,
            attendanceStatus: data.attendanceStatus || computedMeta.attendanceStatus,
            workHoursStatus: data.workHoursStatus || computedMeta.workHoursStatus,
          }
        })
        .filter((record) => {
          const role = String(record.role || '').toLowerCase()
          const isCurrentManagerRecord = record.employeeId && record.employeeId === currentUserId.value
          return role !== 'manager' && !isCurrentManagerRecord
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          attendanceRecords.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''

        await loadAttendance()
        await logActivity(db, {
          module: 'Manager',
          action: 'Viewed attendance records',
          details: 'Opened manager attendance page.'
        })
      })
    })

    return { attendanceRecords, groupedAttendance }
  }
}
</script>
