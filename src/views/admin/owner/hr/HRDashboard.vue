<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    
    <main class="flex-1 p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else>
      <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">HR Dashboard</h1>
          <p class="text-slate-400">Overview of human resources for your branch</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            @click="exportCsv"
          >
            Export CSV
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            @click="exportWord"
          >
            Export Word
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500"
            @click="exportPdf"
          >
            Export PDF
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Total Branches</h3>
          <p class="text-3xl font-bold text-white">{{ totalBranches }}</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Total Employees</h3>
          <p class="text-3xl font-bold text-white">{{ totalEmployees }}</p>
          <p class="text-xs text-slate-500 mt-1">In your branch</p>
        </div>

        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-1">Active Employees</h3>
          <p class="text-3xl font-bold text-white">{{ activeEmployees }}</p>
        </div>
      </div>

      <!-- Employee Distribution -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-white mb-6">Employee Distribution</h2>
        <div class="space-y-4">
          <div v-for="role in roleDistribution" :key="role.name" class="flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-center justify-between mb-2">
                <span class="text-white font-medium">{{ role.name }}</span>
                <span class="text-slate-400 text-sm">{{ role.employees }} employees</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div
                  class="bg-purple-500 h-2 rounded-full transition-all duration-500"
                  :style="{ width: `${(role.employees / totalEmployees) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- My Schedule -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <h2 class="text-xl font-semibold text-white mb-1">My Shift Assignment</h2>
        <p class="text-slate-400 text-sm mb-5">My Work Schedule</p>
        <div v-if="hrScheduleLoading" class="text-slate-400 text-sm">Loading schedule...</div>
        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-amber-500/30 bg-slate-950/60 p-5 min-h-[220px]">
            <p class="text-xs uppercase tracking-[0.2em] text-amber-200/80">Today</p>
            <p class="text-2xl font-semibold text-white mt-2">{{ todaySchedule.day }}</p>
            <p class="text-sm text-emerald-300 mt-2">{{ todaySchedule.shift }}</p>
          </div>
          <div class="rounded-2xl border border-amber-500/30 bg-slate-950/60 p-5">
            <p class="text-xs uppercase tracking-[0.2em] text-amber-200/80 mb-3">This Week</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="entry in hrSchedule"
                :key="entry.day"
                class="rounded-xl border border-amber-500/20 bg-amber-950/30 px-4 py-3"
              >
                <p class="text-sm font-semibold text-amber-100">{{ entry.day }}</p>
                <p class="text-xs text-amber-200/80 mt-1">{{ entry.shift || 'Off' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DSS: Unassigned Shifts -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
        <div class="mb-4">
          <div>
            <h2 class="text-xl font-semibold text-white">Unassigned Shifts</h2>
            <p class="text-slate-400 text-sm">Employees who do not have any shift assignments yet.</p>
          </div>
        </div>

        <div v-if="unassignedLoading" class="text-slate-400 text-sm">Checking employee schedules...</div>
        <div v-else-if="unassignedEmployees.length === 0" class="text-emerald-300 text-sm">
          All employees have at least one assigned shift.
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="employee in unassignedEmployees"
            :key="employee.id"
            class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3"
          >
            <div>
              <p class="text-white text-sm font-medium">{{ employee.fullName || employee.name || 'Unnamed' }}</p>
              <p class="text-slate-400 text-xs">{{ getRoleLabel(employee) }}</p>
            </div>
            <span class="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
              No shifts assigned
            </span>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 class="text-xl font-semibold text-white mb-6">Recent Activity</h2>
        <div class="space-y-4">
          <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start gap-4 pb-4 border-b border-slate-700 last:border-0">
            <div class="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-white text-sm">{{ activity.action }}</p>
              <p class="text-slate-400 text-xs mt-1">{{ activity.time }}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/config/firebaseConfig'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import { toast } from 'vue3-toastify'
import { buildWeekScheduleMap, hasAnyAssignedShift, resolveWeekAssignments } from '@/utils/employeeSchedules'

export default {
  name: 'HRDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const router = useRouter()
    const db = getFirestore(getApp())

    const loading = ref(true)
    const totalBranches = ref(0)
    const totalEmployees = ref(0)
    const activeEmployees = ref(0)
    const roleDistribution = ref([])
    const recentActivity = ref([])
    const unassignedEmployees = ref([])
    const unassignedLoading = ref(false)
    const hrSchedule = ref([])
    const hrScheduleLoading = ref(false)
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const todaySchedule = ref({ day: '', shift: 'Off' })
    const getRoleLabel = (staff) => String(staff?.customRoleName || staff?.role || 'Staff').trim()
    const branchLabel = ref('Current Branch')

    const getWeekStartKey = (baseDate = new Date()) => {
      const now = baseDate
      const currentDay = now.getDay()
      const diffToMonday = (currentDay + 6) % 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - diffToMonday)
      const yyyy = monday.getFullYear()
      const mm = String(monday.getMonth() + 1).padStart(2, '0')
      const dd = String(monday.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const checkPasswordChange = async () => {
      const user = auth.currentUser
      if (!user) return

      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists() && userDoc.data().mustChangePassword) {
        toast.warning("You must change your password before continuing.")
        setTimeout(() => {
          router.push('/employee/change-password')
        }, 1500)
      }
    }

    const loadDashboardData = async () => {
      loading.value = true
      const user = auth.currentUser
      if (!user) return

      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (!userDoc.exists()) return

      const hrData = userDoc.data()
      const hrBranchId = hrData.branchId

      if (!hrBranchId) {
        toast.error("Your account is missing a branch assignment.")
        return
      }

      // Step 1: Get clinic for HR’s branch
      const clinicDoc = await getDoc(doc(db, 'clinics', hrBranchId))
      if (!clinicDoc.exists()) {
        toast.error("Assigned branch not found in clinics.")
        return
      }
      const clinicData = clinicDoc.data()
      const ownerId = clinicData.ownerId
      branchLabel.value = `${clinicData.clinicBranch || 'Branch'}${clinicData.clinicLocation ? ` - ${clinicData.clinicLocation}` : ''}`

      if (!ownerId) {
        toast.error("Clinic is missing ownerId.")
        return
      }

      // Step 2: Count all branches under this owner
      const branchQuery = query(collection(db, 'clinics'), where('ownerId', '==', ownerId))
      const branchSnapshot = await getDocs(branchQuery)
      const branches = branchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      totalBranches.value = branches.length

      // Step 3: Employees only for HR’s branch
      const staffQuery = query(
        collection(db, 'users'),
        where('branchId', '==', hrBranchId),
        where('userType', '==', 'Staff')
      )
      const staffSnapshot = await getDocs(staffQuery)
      const staff = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((user) => !user.archived)
      totalEmployees.value = staff.length
      activeEmployees.value = staff.filter(s => s.status === 'Active').length

      // Step 4: Employee distribution by role (HR’s branch)
      const roleMap = new Map()
      staff.forEach((member) => {
        const role = getRoleLabel(member)
        roleMap.set(role, (roleMap.get(role) || 0) + 1)
      })
      roleDistribution.value = Array.from(roleMap.entries())
        .map(([name, employees]) => ({ name, employees }))
        .sort((a, b) => b.employees - a.employees)

      hrScheduleLoading.value = true
      try {
        const weekKey = getWeekStartKey()
        const schedulesSnap = await getDocs(collection(db, 'users', user.uid, 'schedules'))
        const weekMap = buildWeekScheduleMap(schedulesSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))
        const assignments = resolveWeekAssignments(weekMap, weekKey)
        hrSchedule.value = daysOfWeek.map((day) => ({
          day,
          shift: String(assignments?.[day] || '').trim() || 'Off'
        }))
        const todayIndex = (new Date().getDay() + 6) % 7
        todaySchedule.value = hrSchedule.value[todayIndex] || { day: daysOfWeek[todayIndex], shift: 'Off' }
      } catch (_error) {
        hrSchedule.value = daysOfWeek.map((day) => ({ day, shift: 'Off' }))
        const todayIndex = (new Date().getDay() + 6) % 7
        todaySchedule.value = { day: daysOfWeek[todayIndex], shift: 'Off' }
      } finally {
        hrScheduleLoading.value = false
      }

      // Step 4.5: DSS - Employees with no shift assignments
      unassignedLoading.value = true
      const unassigned = []
      for (const employee of staff) {
        const scheduleSnap = await getDocs(collection(db, 'users', employee.id, 'schedules'))
        if (scheduleSnap.empty) {
          unassigned.push(employee)
          continue
        }

        const hasShift = hasAnyAssignedShift(
          scheduleSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} }))
        )

        if (!hasShift) {
          unassigned.push(employee)
        }
      }
      unassignedEmployees.value = unassigned
      unassignedLoading.value = false

      // Step 5: Logs only for HR’s branch
      // ⚠️ Requires composite index: branchId + time
      const activityQuery = query(
        collection(db, 'activities'),
        where('actorId', '==', user.uid)
      )
      const activitySnapshot = await getDocs(activityQuery)
      recentActivity.value = activitySnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0
          const bTime = b.createdAt?.seconds || 0
          return bTime - aTime
        })
        .slice(0, 10)
        .map((activity) => ({
          id: activity.id,
          action: activity.action || 'Activity recorded',
          time: activity.createdAt?.toDate?.().toLocaleString() || 'Unknown time'
        }))
      loading.value = false
    }

    onMounted(async () => {
      await loadDashboardData()
      await checkPasswordChange()
    })

    const createTimestampLabel = () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}_${hh}-${min}`
    }

    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    const buildExportRows = () => {
      const roleRows = roleDistribution.value.map((entry) => ({
        section: 'Employee Distribution',
        label: entry.name,
        value: entry.employees
      }))

      const scheduleRows = hrSchedule.value.map((entry) => ({
        section: 'My Shift Assignment',
        label: entry.day,
        value: entry.shift || 'Off'
      }))

      const unassignedRows = unassignedEmployees.value.length
        ? unassignedEmployees.value.map((employee) => ({
            section: 'Unassigned Shifts',
            label: employee.fullName || employee.name || 'Unnamed',
            value: getRoleLabel(employee)
          }))
        : [{
            section: 'Unassigned Shifts',
            label: 'Status',
            value: 'All employees have at least one assigned shift.'
          }]

      const activityRows = recentActivity.value.length
        ? recentActivity.value.map((activity) => ({
            section: 'Recent Activity',
            label: activity.action,
            value: activity.time
          }))
        : [{
            section: 'Recent Activity',
            label: 'Status',
            value: 'No recent activity.'
          }]

      return [
        { section: 'Summary', label: 'Branch', value: branchLabel.value },
        { section: 'Summary', label: 'Total Branches', value: totalBranches.value },
        { section: 'Summary', label: 'Total Employees', value: totalEmployees.value },
        { section: 'Summary', label: 'Active Employees', value: activeEmployees.value },
        ...roleRows,
        ...scheduleRows,
        ...unassignedRows,
        ...activityRows
      ]
    }

    const exportCsv = () => {
      const rows = buildExportRows()
      const header = ['Section', 'Label', 'Value']
      const csvLines = [
        header.join(','),
        ...rows.map((row) => [row.section, row.label, row.value]
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(','))
      ]
      downloadBlob(
        new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' }),
        `hr-dashboard_${createTimestampLabel()}.csv`
      )
    }

    const buildDocumentHtml = () => {
      const rows = buildExportRows()
      const tableRows = rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.section)}</td>
          <td>${escapeHtml(row.label)}</td>
          <td>${escapeHtml(row.value)}</td>
        </tr>
      `).join('')

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>HR Dashboard Report</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
              h1 { margin: 0 0 6px; font-size: 28px; }
              p { margin: 0 0 18px; color: #4b5563; }
              table { width: 100%; border-collapse: collapse; margin-top: 18px; }
              th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; vertical-align: top; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h1>HR Dashboard Report</h1>
            <p>${escapeHtml(branchLabel.value)} | Generated ${escapeHtml(new Date().toLocaleString())}</p>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Label</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </body>
        </html>
      `
    }

    const exportWord = () => {
      const html = buildDocumentHtml()
      downloadBlob(
        new Blob([html], { type: 'application/msword;charset=utf-8' }),
        `hr-dashboard_${createTimestampLabel()}.doc`
      )
    }

    const exportPdf = () => {
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) {
        toast.error('Please allow pop-ups to export PDF.')
        return
      }
      printWindow.document.open()
      printWindow.document.write(buildDocumentHtml())
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }

    return {
      loading,
      totalBranches,
      totalEmployees,
      activeEmployees,
      roleDistribution,
      recentActivity,
      unassignedEmployees,
      unassignedLoading,
      hrSchedule,
      hrScheduleLoading,
      todaySchedule,
      getRoleLabel,
      exportCsv,
      exportWord,
      exportPdf
    }
  }
}
</script>
