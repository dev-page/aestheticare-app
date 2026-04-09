<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import QRCode from 'qrcode'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth } from '@/config/firebaseConfig'
import { classifyAttendanceRecord } from '@/utils/attendanceStatus'

export default {
  name: 'AttendanceReports',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())

    const attendanceRecords = ref([])
    const staffUsers = ref([])
    const branchMap = ref({})
    const branches = ref([])
    const selectedQrBranchId = ref('')
    const qrCodeUrl = ref('')
    const qrLoading = ref(false)
    const qrTokenRecord = ref(null)
    const nowRef = ref(new Date())

    const branchFilter = ref('')
    const selectedDay = ref('')
    let clockInterval = null

    const toDateKey = (dateObj) => {
      const yyyy = dateObj.getFullYear()
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
      const dd = String(dateObj.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const liveTime = computed(() =>
      nowRef.value.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    )

    const liveDate = computed(() =>
      nowRef.value.toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    )

    const todayKey = computed(() => toDateKey(nowRef.value))

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const generateToken = (length = 24) => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
      let token = ''
      for (let index = 0; index < length; index += 1) {
        token += chars[Math.floor(Math.random() * chars.length)]
      }
      return token
    }

    const getSelectedBranchLabel = () => {
      const match = branches.value.find((branch) => branch.id === selectedQrBranchId.value)
      if (!match) return 'Clinic Branch'
      return `${match.branch}${match.location ? ` - ${match.location}` : ''}`
    }

    const renderQrCode = async (payload) => {
      qrCodeUrl.value = await QRCode.toDataURL(payload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc'
        }
      })
    }

    const ensureDailyAttendanceQr = async (forceRegenerate = false) => {
      const user = auth.currentUser
      if (!user || !selectedQrBranchId.value) {
        qrCodeUrl.value = ''
        qrTokenRecord.value = null
        return
      }

      qrLoading.value = true
      try {
        const dateKey = todayKey.value
        const docId = `${selectedQrBranchId.value}_${dateKey}`
        const qrRef = doc(db, 'attendanceDailyQRCodes', docId)
        const qrSnap = await getDoc(qrRef)

        let record = null
        if (qrSnap.exists() && !forceRegenerate) {
          record = qrSnap.data() || {}
        } else {
          const token = generateToken()
          const branchLabel = getSelectedBranchLabel()
          const qrPayloadObject = {
            type: 'attendance-qr',
            ownerId: user.uid,
            branchId: selectedQrBranchId.value,
            branchLabel,
            date: dateKey,
            token
          }
          const qrPayload = JSON.stringify(qrPayloadObject)

          record = {
            ...qrPayloadObject,
            qrPayload
          }

          await setDoc(qrRef, {
            ...record,
            createdAt: qrSnap.exists() && !forceRegenerate ? (qrSnap.data()?.createdAt || serverTimestamp()) : serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }

        qrTokenRecord.value = record
        await renderQrCode(record.qrPayload)
      } catch (error) {
        console.error('Failed to generate attendance QR:', error)
        qrCodeUrl.value = ''
        qrTokenRecord.value = null
      } finally {
        qrLoading.value = false
      }
    }

    const regenerateDailyAttendanceQr = async () => {
      await ensureDailyAttendanceQr(true)
    }

    const loadAttendance = async () => {
      const user = auth.currentUser
      if (!user) {
        attendanceRecords.value = []
        staffUsers.value = []
        branchMap.value = {}
        branches.value = []
        return
      }

      const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', user.uid)))
      const clinics = clinicsSnap.docs.map((clinicDoc) => ({ id: clinicDoc.id, ...clinicDoc.data() }))
      branches.value = clinics.map((clinic) => ({
        id: clinic.id,
        branch: clinic.clinicBranch || 'Branch',
        location: clinic.clinicLocation || ''
      }))
      if (!selectedQrBranchId.value && branches.value.length) {
        selectedQrBranchId.value = branches.value[0].id
      }
      const clinicLookup = {}
      clinics.forEach((clinic) => {
        clinicLookup[clinic.id] = `${clinic.clinicBranch || 'Branch'}${clinic.clinicLocation ? ` - ${clinic.clinicLocation}` : ''}`
      })
      branchMap.value = clinicLookup

      const branchIds = clinics.map((clinic) => clinic.id).filter(Boolean)
      if (branchIds.length === 0) {
        attendanceRecords.value = []
        staffUsers.value = []
        return
      }

      const attendanceChunks = chunkArray(branchIds)
      let attendanceData = []
      for (const chunk of attendanceChunks) {
        const attendanceQuery = query(collection(db, 'attendance'), where('branchId', 'in', chunk))
        const attendanceSnap = await getDocs(attendanceQuery)
        attendanceData = attendanceData.concat(attendanceSnap.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() })))
      }

      attendanceRecords.value = attendanceData
        .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))

      let staffData = []
      for (const chunk of attendanceChunks) {
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', 'in', chunk),
          where('userType', '==', 'Staff')
        )
        const usersSnap = await getDocs(staffQuery)
        staffData = staffData.concat(usersSnap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })))
      }

      staffUsers.value = staffData
        .filter((user) => !user.archived && user.status === 'Active')
    }

    const activeStaffIds = computed(() => new Set(staffUsers.value.map((staff) => staff.id)))

    const displayRecords = computed(() =>
      attendanceRecords.value
        .filter((record) => activeStaffIds.value.has(record.employeeId))
        .map((record) => {
        const branchName = branchMap.value[record.branchId] || record.branchId || 'N/A'
        const dateValue = record.date || ''
        return {
          ...record,
          dateKey: dateValue,
          displayName: record.employeeName || record.staffName || 'N/A',
          displayBranch: branchName,
          displayDate: dateValue ? new Date(dateValue).toLocaleDateString() : '-',
          displayTimeIn: record.timeIn || '-',
          displayTimeOut: record.timeOut || '-'
        }
      })
    )

    // This table auto-resets every day because it always uses todayKey.
    const todayDailyRecords = computed(() =>
      displayRecords.value.filter((record) => {
        const matchesDay = record.dateKey === todayKey.value
        const matchesBranch = branchFilter.value
          ? record.displayBranch.toLowerCase().includes(branchFilter.value.toLowerCase())
          : true
        return matchesDay && matchesBranch
      })
    )

    const statusRows = computed(() => {
      const selectedKey = selectedDay.value || todayKey.value
      const branchNeedle = branchFilter.value.toLowerCase()

      const staffPool = staffUsers.value.filter((staff) => {
        const branchName = branchMap.value[staff.branchId] || staff.branchId || ''
        return branchNeedle ? branchName.toLowerCase().includes(branchNeedle) : true
      })

      return staffPool
        .map((staff) => {
          const branchName = branchMap.value[staff.branchId] || staff.branchId || 'N/A'
          const fullName = staff.fullName || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email || 'N/A'
          const dayRecord = attendanceRecords.value.find(
            (record) => record.employeeId === staff.id && record.date === selectedKey
          )

          const timeIn = dayRecord?.timeIn || '-'
          const timeOut = dayRecord?.timeOut || '-'
          const attendanceMeta = classifyAttendanceRecord({
            timeIn: dayRecord?.timeIn || '',
            timeOut: dayRecord?.timeOut || '',
            shiftStart: dayRecord?.shiftStart || staff.shiftStart || '',
            shiftEnd: dayRecord?.shiftEnd || staff.shiftEnd || '',
          })

          return {
            id: `${staff.id}-${selectedKey}`,
            name: fullName,
            branch: branchName,
            date: selectedKey,
            timeIn,
            timeOut,
            attendanceStatus: dayRecord?.attendanceStatus || attendanceMeta.attendanceStatus,
            workHoursStatus: dayRecord?.workHoursStatus || attendanceMeta.workHoursStatus,
            lateMinutes: Number(dayRecord?.lateMinutes ?? attendanceMeta.lateMinutes ?? 0),
            overtimeMinutes: Number(dayRecord?.overtimeMinutes ?? attendanceMeta.overtimeMinutes ?? 0),
            undertimeMinutes: Number(dayRecord?.undertimeMinutes ?? attendanceMeta.undertimeMinutes ?? 0),
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    })

    const todaySummary = computed(() =>
      todayDailyRecords.value.reduce(
        (acc, record) => {
          if (record.timeIn) acc.clockedIn += 1
          if (record.timeOut) acc.clockedOut += 1
          if (record.timeIn && !record.timeOut) acc.pendingClockOut += 1
          return acc
        },
        { clockedIn: 0, clockedOut: 0, pendingClockOut: 0 }
      )
    )

    onMounted(async () => {
      selectedDay.value = toDateKey(new Date())
      await loadAttendance()
      await ensureDailyAttendanceQr()

      clockInterval = setInterval(() => {
        nowRef.value = new Date()
      }, 1000)
    })

    watch(selectedQrBranchId, async () => {
      await ensureDailyAttendanceQr()
    })

    onUnmounted(() => {
      if (clockInterval) clearInterval(clockInterval)
    })

    return {
      branchFilter,
      branches,
      selectedDay,
      selectedQrBranchId,
      liveTime,
      liveDate,
      qrCodeUrl,
      qrLoading,
      qrTokenRecord,
      ensureDailyAttendanceQr,
      regenerateDailyAttendanceQr,
      todayDailyRecords,
      statusRows,
      todaySummary
    }
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-10 text-white">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold">Attendance Reports</h1>
          <p class="text-slate-400">Daily live attendance and filterable status report.</p>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 md:min-w-[240px] text-right">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Current Time</p>
          <p class="text-white text-2xl font-semibold leading-tight">{{ liveTime }}</p>
          <p class="text-slate-300 text-sm">{{ liveDate }}</p>
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          v-model="branchFilter"
          placeholder="Filter by branch..."
          class="px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <section class="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-2xl">
            <h2 class="text-lg font-semibold text-white">Daily Attendance QR</h2>
            <p class="mt-1 text-sm text-slate-400">
              Generate a branch attendance QR that changes every day. Employees can scan the current day’s QR for attendance validation.
            </p>

            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label class="block flex-1">
                <span class="mb-1 block text-sm text-slate-300">Branch</span>
                <select
                  v-model="selectedQrBranchId"
                  class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option disabled value="">Select Branch</option>
                  <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                    {{ branch.branch }}{{ branch.location ? ` - ${branch.location}` : '' }}
                  </option>
                </select>
              </label>

              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-700 text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="qrLoading || !selectedQrBranchId"
                @click="regenerateDailyAttendanceQr"
                title="Generate a new QR"
              >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M20 20v-5h-5M5.64 18.36A9 9 0 104.58 9M18.36 5.64A9 9 0 0019.42 15" />
                </svg>
              </button>
            </div>

            <div v-if="qrTokenRecord" class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Date</p>
                <p class="mt-1 text-sm font-medium text-white">{{ qrTokenRecord.date }}</p>
              </div>
              <div class="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                <p class="text-xs uppercase tracking-wide text-slate-500">Token</p>
                <p class="mt-1 break-all text-sm font-medium text-cyan-300">{{ qrTokenRecord.token }}</p>
              </div>
            </div>
          </div>

          <div class="flex w-full max-w-sm justify-center lg:justify-end">
            <div class="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-4 shadow-xl">
              <div v-if="qrCodeUrl" class="space-y-3">
                <img :src="qrCodeUrl" alt="Daily attendance QR" class="h-72 w-72 rounded-2xl bg-white object-contain p-3" />
                <p class="text-center text-xs uppercase tracking-[0.18em] text-slate-400">
                  Valid for {{ qrTokenRecord?.date || 'today' }}
                </p>
              </div>
              <div v-else class="flex h-72 w-72 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-400">
                Select a branch to generate the daily attendance QR.
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-slate-800 p-4 rounded-lg text-center">
          <p class="text-slate-400">Clocked In Today</p>
          <p class="text-green-400 text-xl font-bold">{{ todaySummary.clockedIn }}</p>
        </div>
        <div class="bg-slate-800 p-4 rounded-lg text-center">
          <p class="text-slate-400">Clocked Out Today</p>
          <p class="text-blue-400 text-xl font-bold">{{ todaySummary.clockedOut }}</p>
        </div>
        <div class="bg-slate-800 p-4 rounded-lg text-center">
          <p class="text-slate-400">Pending Clock Out</p>
          <p class="text-yellow-400 text-xl font-bold">{{ todaySummary.pendingClockOut }}</p>
        </div>
      </div>

      <section class="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">Daily Attendance (Today)</h2>
          <p class="text-sm text-slate-400">Auto-resets every 24 hours</p>
        </div>

        <table class="w-full text-left text-sm">
          <thead class="text-slate-400 border-b border-slate-600">
            <tr>
              <th class="px-4 py-2">Name</th>
              <th class="px-4 py-2">Branch</th>
              <th class="px-4 py-2">Date</th>
              <th class="px-4 py-2">Time In</th>
              <th class="px-4 py-2">Time Out</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in todayDailyRecords" :key="record.id" class="border-b border-slate-700">
              <td class="px-4 py-2">{{ record.displayName }}</td>
              <td class="px-4 py-2">{{ record.displayBranch }}</td>
              <td class="px-4 py-2">{{ record.displayDate }}</td>
              <td class="px-4 py-2">{{ record.displayTimeIn }}</td>
              <td class="px-4 py-2">{{ record.displayTimeOut }}</td>
            </tr>

            <tr v-if="todayDailyRecords.length === 0">
              <td colspan="5" class="px-4 py-6 text-center text-slate-400">
                No attendance records for today.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 class="text-lg font-semibold text-white">Attendance Status (Per Day)</h2>
          <input
            type="date"
            v-model="selectedDay"
            class="px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <table class="w-full text-left text-sm">
          <thead class="text-slate-400 border-b border-slate-600">
            <tr>
              <th class="px-4 py-2">Name</th>
              <th class="px-4 py-2">Branch</th>
              <th class="px-4 py-2">Date</th>
              <th class="px-4 py-2">Time In</th>
              <th class="px-4 py-2">Time Out</th>
              <th class="px-4 py-2">Attendance</th>
              <th class="px-4 py-2">Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in statusRows" :key="row.id" class="border-b border-slate-700">
              <td class="px-4 py-2">{{ row.name }}</td>
              <td class="px-4 py-2">{{ row.branch }}</td>
              <td class="px-4 py-2">{{ row.date }}</td>
              <td class="px-4 py-2">{{ row.timeIn }}</td>
              <td class="px-4 py-2">{{ row.timeOut }}</td>
              <td class="px-4 py-2">
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    row.attendanceStatus === 'Present' ? 'bg-green-500/20 text-green-400' :
                    row.attendanceStatus === 'Late' ? 'bg-yellow-500/20 text-yellow-400' :
                    row.attendanceStatus === 'Absent' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-600 text-slate-200'
                  ]"
                >
                  {{ row.attendanceStatus }}
                </span>
              </td>
              <td class="px-4 py-2">
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    row.workHoursStatus === 'Overtime' ? 'bg-blue-500/20 text-blue-400' :
                    row.workHoursStatus === 'Undertime' ? 'bg-orange-500/20 text-orange-400' :
                    row.workHoursStatus === 'No Clock Out' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-600 text-slate-200'
                  ]"
                >
                  {{ row.workHoursStatus }}
                </span>
              </td>
            </tr>

            <tr v-if="statusRows.length === 0">
              <td colspan="7" class="px-4 py-6 text-center text-slate-400">
                No employee records found.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>
