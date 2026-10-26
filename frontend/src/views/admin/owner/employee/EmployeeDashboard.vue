!START HERE!

<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'dashboard', cards: 4, panels: 2 }" class="flex-1 p-6 md:p-8">
      <DashboardSkeleton v-if="loading" />

      <div v-else class="space-y-6">
        <section class="rounded-[1.75rem] border border-[rgba(123,79,55,0.34)] bg-[radial-gradient(circle_at_top_right,_rgba(230,193,150,0.12),_transparent_24%),linear-gradient(180deg,_rgba(47,31,21,0.96),_rgba(27,17,12,0.98))] p-6 shadow-[0_24px_56px_rgba(11,6,4,0.24)]">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[#d8b38f]">Employee Panel</p>
          <h1 class="mt-3 font-serif text-3xl font-bold text-[#fff0e1] md:text-4xl">{{ headingTitle }}</h1>
          <p class="mt-2 max-w-3xl text-sm leading-7 text-[#d4bead]">
            Your workspace is tailored to the permissions enabled for your role. Use the quick access cards below to jump into the tools you use most.
          </p>
        </section>

        <section class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] border border-[rgba(123,79,55,0.34)] bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_18px_44px_rgba(11,6,4,0.16)]">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Role</p>
            <p class="mt-3 text-lg font-semibold text-[#fff0e1]">{{ roleLabel || headingTitle || 'Employee' }}</p>
            <p class="mt-1 text-sm text-[#d4bead]">Your current access level in the panel.</p>
          </div>
              <div data-onboarding-key="employee-branch-info" class="rounded-[1.5rem] border border-[rgba(123,79,55,0.34)] bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_18px_44px_rgba(11,6,4,0.16)]">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Assigned Branch</p>
                <p class="mt-3 text-lg font-semibold text-[#fff0e1]">{{ branchLabel || 'No branch assigned' }}</p>
                <p class="mt-1 text-sm text-[#d4bead]">This updates when your branch assignment changes.</p>
              </div>
          <div class="rounded-[1.5rem] border border-[rgba(123,79,55,0.34)] bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_18px_44px_rgba(11,6,4,0.16)]">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Today's Shift</p>
            <p class="mt-3 text-lg font-semibold text-[#fff0e1]">{{ todayShiftLabel }}</p>
            <p class="mt-1 text-sm text-[#d4bead]">{{ todayShiftTime }}</p>
          </div>
        </section>

        <section v-if="hasReceptionistDashboard" class="space-y-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6a50]">Receptionist</p>
            <h2 class="mt-1 font-serif text-2xl font-semibold text-[#4a2d1c]">Front desk workspace</h2>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <router-link v-for="card in receptionistCards" :key="card.to" :to="card.to" class="rounded-2xl border border-[#ead7c2] bg-[#fffdfa] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b68a65]">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d6a50]">{{ card.label }}</p>
              <p class="mt-2 text-sm leading-6 text-[#674a36]">{{ card.description }}</p>
              <span class="mt-4 inline-flex text-sm font-semibold text-[#71482e]">Open workspace</span>
            </router-link>
          </div>
        </section>

        <section v-if="hasPractitionerDashboard" class="space-y-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d6a50]">Practitioner</p>
            <h2 class="mt-1 font-serif text-2xl font-semibold text-[#4a2d1c]">My appointment calendar</h2>
          </div>
          <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <div class="rounded-2xl border border-[#ead7c2] bg-[#fffdfa] p-4 shadow-sm sm:p-5">
              <div class="mb-4 flex items-center justify-between gap-3">
                <button type="button" class="rounded-lg border border-[#ead7c2] px-3 py-2 text-sm text-[#674a36] hover:bg-[#f8efe5]" @click="changeCalendarMonth(-1)">Previous</button>
                <h3 class="text-base font-semibold text-[#4a2d1c]">{{ calendarMonthLabel }}</h3>
                <button type="button" class="rounded-lg border border-[#ead7c2] px-3 py-2 text-sm text-[#674a36] hover:bg-[#f8efe5]" @click="changeCalendarMonth(1)">Next</button>
              </div>
              <div class="grid grid-cols-7 gap-1 sm:gap-2">
                <span v-for="day in calendarWeekdays" :key="day" class="py-2 text-center text-[10px] font-semibold uppercase text-[#8d6a50] sm:text-xs">{{ day }}</span>
                <button v-for="cell in practitionerCalendarCells" :key="cell.key" type="button" :disabled="!cell.inMonth" class="min-h-[66px] rounded-lg border p-1.5 text-left sm:min-h-[82px] sm:p-2" :class="cellClass(cell)" @click="selectedCalendarDate = cell.dateKey">
                  <span class="text-xs font-semibold">{{ cell.dayNumber }}</span>
                  <span v-if="cell.appointments.length" class="mt-1 block truncate rounded bg-[#f2e3d1] px-1 py-0.5 text-[9px] text-[#674a36] sm:text-[10px]">{{ cell.appointments.length }} appointment{{ cell.appointments.length === 1 ? '' : 's' }}</span>
                </button>
              </div>
            </div>
            <aside class="rounded-2xl border border-[#ead7c2] bg-[#fffdfa] p-5 shadow-sm">
              <h3 class="font-semibold text-[#4a2d1c]">{{ selectedCalendarDateLabel }}</h3>
              <div v-if="selectedPractitionerAppointments.length" class="mt-4 space-y-3">
                <article v-for="appointment in selectedPractitionerAppointments" :key="appointment.id" class="rounded-xl border border-[#ead7c2] bg-[#fcf7f0] p-3">
                  <p class="text-sm font-semibold text-[#4a2d1c]">{{ appointment.clientName || appointment.patientName || 'Client' }}</p>
                  <p class="mt-1 text-xs text-[#76583f]">{{ appointment.service || 'Service not specified' }}  -  {{ formatAppointmentTime(appointment.time) }}</p>
                </article>
              </div>
              <p v-else class="mt-4 text-sm text-[#76583f]">No assigned appointments for this day.</p>
            </aside>
          </div>
        </section>

        <section class="overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-800 shadow-md">
          <div class="flex flex-col gap-2 border-b border-slate-700 px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Quick Access</p>
              <h2 class="mt-2 font-serif text-2xl font-semibold text-[#fff0e1]" data-onboarding-key="employee-quick-access-title">Open the pages you need most</h2>
              <p class="mt-1 text-sm text-[#d4bead]">
                These shortcuts are filtered to what your account can actually use.
              </p>
            </div>
            <span class="inline-flex w-fit rounded-full border border-slate-700 bg-slate-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {{ quickLinks.length }} shortcuts
            </span>
          </div>

          <div v-if="quickLinks.length" class="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            <router-link
              v-for="link in quickLinks"
              :key="link.to"
              :to="link.to"
              class="group flex min-h-40 flex-col justify-between rounded-[1.4rem] border border-slate-700 bg-slate-700 p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-amber-700 hover:bg-slate-600"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-base font-semibold text-[#fff0e1]">{{ link.label }}</p>
                  <p class="mt-2 max-w-xs text-sm leading-6 text-[#d4bead]">{{ link.description }}</p>
                </div>
                <span class="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  Open
                </span>
              </div>

              <div class="mt-6 flex items-center justify-between gap-3 border-t border-slate-600 pt-4">
                <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8b38f]">
                  {{ link.group }}
                </span>
                <span class="text-sm font-medium text-[#fff0e1] transition group-hover:translate-x-1">
                  Go to page
                </span>
              </div>
            </router-link>
          </div>

          <div v-else class="px-6 py-10 text-center">
            <h3 class="text-lg font-semibold text-[#fff0e1]">No quick access available yet</h3>
            <p class="mt-2 text-sm text-[#d4bead]">
              This account does not currently have any active module access.
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, where } from 'firebase/firestore'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import { formatClockTime } from '@/utils/appointmentDss'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

export default {
  name: 'EmployeeDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()
    const { hasFeature, initSubscription } = useSubscription()

    const loading = ref(true)
    const roleLabel = ref('')
    const assignedRoleNames = ref([])
    const branchLabel = ref('')
    const currentUserId = ref('')
    const practitionerBranchId = ref('')
    const practitionerAppointments = ref([])
    const calendarMonth = ref(new Date())
    const selectedCalendarDate = ref('')
    const todayShiftLabel = ref('Loading...')
    const todayShiftTime = ref('Checking today\'s schedule...')
    let unsubscribeAuth = null
    let unsubscribeProfile = null
    let unsubscribeBranch = null

    const normalizeRoleName = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
    const assignedRoleKeys = computed(() => assignedRoleNames.value.map(normalizeRoleName))
    const hasReceptionistDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('reception') || role.includes('frontdesk')))
    const hasPractitionerDashboard = computed(() => assignedRoleKeys.value.some((role) => ['practitioner', 'doctor', 'dentist', 'nurse', 'therapist', 'clinician'].some((name) => role.includes(name))))
    const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const calendarMonthLabel = computed(() => calendarMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))
    const practitionerAssignedAppointments = computed(() => sortRecordsNewestFirst(practitionerAppointments.value.filter((appointment) => [appointment.practitionerId, appointment.assignedPractitionerId, appointment.staffId, appointment.assignedTo].some((id) => String(id || '') === currentUserId.value))))
    const practitionerCalendarCells = computed(() => {
      const year = calendarMonth.value.getFullYear()
      const month = calendarMonth.value.getMonth()
      const first = new Date(year, month, 1)
      const start = new Date(year, month, 1 - first.getDay())
      return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        const key = dateKey(date)
        return { key, dateKey: key, dayNumber: date.getDate(), inMonth: date.getMonth() === month, appointments: practitionerAssignedAppointments.value.filter((appointment) => appointment.date === key) }
      })
    })
    const selectedCalendarDateLabel = computed(() => {
      const date = new Date(`${selectedCalendarDate.value}T12:00:00`)
      return Number.isNaN(date.getTime()) ? 'Select a day' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    })
    const selectedPractitionerAppointments = computed(() => practitionerAssignedAppointments.value.filter((appointment) => appointment.date === selectedCalendarDate.value))
    const changeCalendarMonth = (offset) => {
      const next = new Date(calendarMonth.value)
      next.setMonth(next.getMonth() + offset)
      calendarMonth.value = next
    }
    const cellClass = (cell) => {
      if (!cell.inMonth) return 'border-[#f4ece3] bg-[#fbf8f4] text-[#c5b3a2]'
      if (cell.dateKey === selectedCalendarDate.value) return 'border-[#9a6b48] bg-[#f4e6d7] text-[#4a2d1c]'
      return 'border-[#ead7c2] bg-[#fffdfa] text-[#674a36] hover:bg-[#f8efe5]'
    }
    const formatAppointmentTime = (value) => formatClockTime(value) || 'Time TBD'

    const moduleCatalog = [
      {
        key: 'employees',
        label: 'Employees',
        entries: [
          { label: 'Employee Directory', to: '/hr/employees', permission: 'staff:view', feature: 'staff_management', description: 'View employee profiles and role assignments.' },
          { label: 'Create Employee Account', to: '/hr/employees/new', permission: 'staff:create', feature: 'staff_management', description: 'Create employee accounts under the clinic.' },
          { label: 'Employee Archives', to: '/hr/employees/archived', permission: 'staff:view', feature: 'staff_management', description: 'Review archived employee records.' }
        ]
      },
      {
        key: 'clients',
        label: 'Clients',
        entries: [
          { label: 'Client List', to: '/crm/clients', permission: 'clients:view', feature: 'appointments', description: 'Review and search clinic clients.' },
          { label: 'Practitioner Clients', to: '/clinical/clients', permission: 'clients:view', feature: 'appointments', description: 'Open clinical client access.' }
        ]
      },
      {
        key: 'appointments',
        label: 'Appointments',
        entries: [
          { label: 'Appointments', to: '/crm/appointments', permission: 'appointments:view', feature: 'appointments', description: 'See and manage appointment listings.' },
          { label: 'Appointment Requests', to: '/crm/appointments/requests', permission: 'appointments:review', feature: 'appointments', description: 'Review cancellation and reschedule requests.' },
          { label: 'Online Consultation', to: '/clinical/consultations/online', permission: 'consultations:view', feature: 'online_consultations', description: 'Join and manage online consultations.' }
        ]
      },
      {
        key: 'hr-payroll',
        label: 'HR and Payroll',
        entries: [
          { label: 'Add Shift', to: '/hr/shifts?tab=add', permission: 'hr:create', feature: 'hr', description: 'Create shift templates in Shift Management.' },
          { label: 'Shift Assignment', to: '/hr/shifts?tab=assignment', permission: 'hr:update', feature: 'hr', description: 'Assign recurring schedules in Shift Management.' },
          { label: 'Leave Request', to: '/hr/leave-request', permission: 'leave:create', feature: 'hr', description: 'Submit a new leave request.' },
          { label: 'Overtime Request', to: '/hr/overtime', permissionsAny: ['overtime:view', 'overtime:create'], feature: 'hr', description: 'Submit and track overtime based on your recorded attendance.' },
          { label: 'Leave Management', to: '/hr/leave-management', permission: 'leave:review', feature: 'hr', description: 'Track or review leave requests.' },
          { label: 'Base Pay', to: '/hr/base-pay', permission: 'payroll:update', feature: 'payroll', description: 'Manage base pay settings.' },
          { label: 'Payroll', to: '/hr/payroll', permission: 'payroll:update', feature: 'payroll', description: 'Run payroll and payslip workflows.' },
          { label: 'Payroll Summary', to: '/finance/payroll-summary', permission: 'payroll:view', feature: 'payroll', description: 'Review payroll summary results.' },
          { label: 'Payroll Approval', to: '/finance/payroll-approval', permission: 'payroll:approve', feature: 'payroll', description: 'Approve payroll summary items.' }
        ]
      },
      {
        key: 'finance',
        label: 'Finance',
        entries: [
          { label: 'Transactions', to: '/crm/transactions', permission: 'payments:view', feature: 'reports', description: 'Review payment history.' },
          { label: 'Sales Ledger', to: '/finance/sales', permission: 'finance:sales:view', feature: 'reports', description: 'Open the sales ledger and reconciliation view.' },
          { label: 'Refunds', to: '/finance/refunds', permission: 'finance:refunds:view', feature: 'reports', description: 'Review refund workflows.' },
          { label: 'Financial Reports', to: '/finance/reports', permission: 'finance:reports:view', feature: 'reports', description: 'See finance reports and summaries.' }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
        entries: [
          { label: 'Suppliers', to: '/procurement/suppliers/directory', permission: 'inventory:view', feature: 'inventory', description: 'Manage supplier records.' },
          { label: 'Inventory Requests', to: '/inventory/requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory', description: 'Create and review inventory requests.' },
          { label: 'Item Catalog', to: '/inventory/items', permission: 'inventory:view', feature: 'inventory', description: 'Browse the item catalog.' },
          { label: 'Supply Dashboard', to: '/supply/dashboard', permission: 'inventory:view', feature: 'inventory', description: 'Open the supply dashboard.' },
          { label: 'Supply Catalog', to: '/supply/catalog', permission: 'inventory:view', feature: 'inventory', description: 'Access supply catalog pages.' },
          { label: 'Supply Requests', to: '/supply/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory', description: 'Manage supply requests.' },
          { label: 'Procurement Spending & History', to: '/procurement/reports', permission: 'finance:purchases:view', feature: 'inventory', description: 'Review linked procurement records and spending.' },
          { label: 'Supplier Invoices & Payments', to: '/finance/procurement/invoices', permission: 'finance:payables:view', feature: 'reports', description: 'Review invoices and payment records.' },
          { label: 'Product Service Listing', to: '/catalog/products-services', permission: 'services:view', feature: 'services', description: 'View products and services.' },
          { label: 'Orders', to: '/operations/orders', permissionsAny: ['orders:view', 'inventory:view'], feature: 'inventory', description: 'Track branch orders.' }
        ]
      },
      {
        key: 'notifications',
        label: 'Notifications',
        entries: [
          { label: 'Notifications', to: '/notifications', description: 'Check account notifications.' }
        ]
      }
    ]

    const canAccessEntry = (entry) => {
      const permissionsAny = Array.isArray(entry.permissionsAny) ? entry.permissionsAny : []
      const permissionAllowed =
        (!entry.permission || hasPermission(entry.permission)) &&
        (!permissionsAny.length || permissionsAny.some((permission) => hasPermission(permission)))
      const featureAllowed = !entry.feature || hasFeature(entry.feature)
      return permissionAllowed && featureAllowed
    }

    const receptionistCards = computed(() => [
      { label: 'Appointments', to: '/crm/appointments', description: "View today's bookings and appointment records.", permission: 'appointments:view' },
      { label: 'Appointment Requests', to: '/crm/appointments/requests', description: 'Review cancellation and reschedule requests.', permission: 'appointments:review' },
      { label: 'Clients', to: '/crm/clients', description: 'Find and manage clinic client records.', permission: 'clients:view' },
      { label: 'Transactions', to: '/crm/transactions', description: 'Review recent client payments.', permission: 'payments:view' }
    ].filter((entry) => canAccessEntry({ permission: entry.permission, feature: 'appointments' })))

    const loadAssignedRoleNames = async (userData = {}) => {
      const roleIds = [...new Set([...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []), userData.customRoleId].map((id) => String(id || '').trim()).filter(Boolean))]
      const roleDocs = await Promise.all(roleIds.map((id) => getDoc(doc(db, 'clinicRoles', id)).catch(() => null)))
      const names = roleDocs.filter((snapshot) => snapshot?.exists()).map((snapshot) => String(snapshot.data()?.name || '').trim()).filter(Boolean)
      const fallbackName = String(userData.customRoleName || userData.role || '').trim()
      assignedRoleNames.value = [...new Set([...names, ...(fallbackName ? [fallbackName] : [])])]
    }

    const loadPractitionerAppointments = async (branchId) => {
      practitionerAppointments.value = []
      if (!hasPractitionerDashboard.value || !branchId || !hasPermission('appointments:view') || !hasFeature('appointments')) return
      try {
        const snapshot = await getDocs(query(collection(db, 'appointments'), where('branchId', '==', branchId)))
        practitionerAppointments.value = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      } catch (error) {
        console.warn('Unable to load practitioner dashboard appointments:', error)
      }
    }

    watch(
      () => [hasPractitionerDashboard.value, hasPermission('appointments:view'), hasFeature('appointments'), practitionerBranchId.value],
      ([isPractitioner, canViewAppointments, appointmentsEnabled, branchId]) => {
        if (isPractitioner && canViewAppointments && appointmentsEnabled && branchId) {
          void loadPractitionerAppointments(branchId)
        } else {
          practitionerAppointments.value = []
        }
      },
      { immediate: true }
    )

    const accessibleModules = computed(() =>
      moduleCatalog
        .map((module) => {
          const entries = module.entries.filter(canAccessEntry)
          return {
            ...module,
            entries
          }
        })
        .filter((module) => module.entries.length > 0)
    )

    const quickLinks = computed(() =>
      accessibleModules.value.flatMap((module) =>
        module.entries.slice(0, 1).map((entry) => ({
          ...entry,
          group: module.label
        }))
      )
    )

    const headingTitle = computed(() => {
      const label = String(roleLabel.value || '').trim()
      return label || 'Employee'
    })

    const clearBranchSubscription = () => {
      if (unsubscribeBranch) {
        unsubscribeBranch()
        unsubscribeBranch = null
      }
    }

    const applyBranchSnapshot = async (branchSnapOrDocs, fallbackBranchId = '') => {
      const branchData = Array.isArray(branchSnapOrDocs)
        ? branchSnapOrDocs[0]?.data?.() || branchSnapOrDocs[0] || {}
        : branchSnapOrDocs?.data?.() || {}
      const branchId = String(fallbackBranchId || branchSnapOrDocs?.id || '').trim()
      const label = [branchData.clinicBranch, branchData.clinicLocation].filter(Boolean).join(' - ')
      branchLabel.value = label || branchId || 'No branch assigned'
    }

    const loadTodayShift = trackPageLoad(async (userId, userData = {}) => {
      if (!hasFeature('hr')) {
        todayShiftLabel.value = 'Not included in this plan'
        todayShiftTime.value = 'Shift and attendance management are available with Premium.'
        return
      }
      todayShiftLabel.value = 'No shift assigned'
      todayShiftTime.value = 'Today is unavailable for clock-in until a schedule is assigned.'
      const scheduleSnap = await getDoc(doc(db, 'users', userId, 'schedules', 'recurring'))
      if (!scheduleSnap.exists()) {
        todayShiftLabel.value = 'Day Off'
        todayShiftTime.value = 'No recurring shift is assigned for today.'
        return
      }

      const schedule = scheduleSnap.data() || {}
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Manila' }).format(new Date())
      const assignment = String(schedule.assignments?.[weekday] || '').trim()
      const assignmentLabel = String(schedule.assignmentLabels?.[weekday] || assignment).trim()
      if (!assignment || assignment.toLowerCase() === 'off' || assignmentLabel.toLowerCase() === 'off') {
        todayShiftLabel.value = 'Day Off'
        todayShiftTime.value = 'Clock-in is unavailable today.'
        return
      }

      const branchId = String(userData.branchId || userData.clinicBranch || '').trim()
      if (!branchId) {
        todayShiftLabel.value = assignmentLabel || 'Assigned Shift'
        todayShiftTime.value = 'Branch schedule details are unavailable.'
        return
      }

      // A staff member may read their own recurring schedule but must not load
      // every shift template in the branch unless their role can view HR data.
      // The old branch-wide query was denied for ordinary employees and its
      // async error escaped the snapshot callback as an uncaught promise.
      if (!hasPermission('hr:view')) {
        todayShiftLabel.value = assignmentLabel || 'Assigned Shift'
        todayShiftTime.value = 'Your assigned shift is scheduled for today.'
        return
      }

      try {
        const shiftSnapshot = await getDocs(query(collection(db, 'shifts'), where('branchId', '==', branchId)))
        const shift = shiftSnapshot.docs.map((shiftDoc) => ({ id: shiftDoc.id, ...shiftDoc.data() })).find((entry) => {
          const label = `${String(entry.shiftType || 'Shift').trim()} || ${String(entry.start || '').trim()} - ${String(entry.end || '').trim()}`
          return entry.id === assignment || label === assignmentLabel || label === assignment
        })
        todayShiftLabel.value = shift?.shiftType || assignmentLabel || 'Assigned Shift'
        todayShiftTime.value = shift?.start && shift?.end ? `${shift.start} - ${shift.end}` : 'Shift time is not configured.'
      } catch (error) {
        console.warn('Unable to load branch shift details for employee dashboard:', error)
        todayShiftLabel.value = assignmentLabel || 'Assigned Shift'
        todayShiftTime.value = 'Your assigned shift is scheduled for today.'
      }
    })

    const subscribeToBranchSource = (user, userData = {}) => {
      clearBranchSubscription()

      const branchId = String(userData.branchId || userData.clinicBranch || '').trim()
      if (branchId) {
        unsubscribeBranch = pageListener(onSnapshot, doc(db, 'clinics', branchId), (branchSnap) => {
          if (!branchSnap.exists()) {
            branchLabel.value = branchId
            return
          }
          void applyBranchSnapshot(branchSnap, branchId)
        }, (error) => {
          console.error('Failed to load assigned branch:', error)
          branchLabel.value = branchId
        })
        return
      }

      unsubscribeBranch = pageListener(
        onSnapshot, query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid)),
        (snapshot) => {
          if (snapshot.empty) {
            branchLabel.value = ''
            return
          }

          const branchSnap = snapshot.docs[0]
          void applyBranchSnapshot(branchSnap)
        }, (error) => {
          console.error('Failed to load branch assignment:', error)
          branchLabel.value = ''
        }
      )
    }

    onMounted(trackPageLoad(async () => {
      selectedCalendarDate.value = dateKey(new Date())
      await initSubscription()
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
          assignedRoleNames.value = []
          currentUserId.value = ''
          practitionerBranchId.value = ''
          practitionerAppointments.value = []
          branchLabel.value = ''
          loading.value = false
          if (unsubscribeProfile) {
            unsubscribeProfile()
            unsubscribeProfile = null
          }
          clearBranchSubscription()
          return
        }

        if (unsubscribeProfile) {
          unsubscribeProfile()
          unsubscribeProfile = null
        }

        unsubscribeProfile = pageListener(
          onSnapshot, doc(db, 'users', user.uid),
          async (userSnap) => {
            const userData = userSnap.exists() ? userSnap.data() || {} : {}
            currentUserId.value = user.uid
            await loadAssignedRoleNames(userData)
            roleLabel.value = assignedRoleNames.value.join(' + ') || String(userData.role || 'Employee').trim()
            practitionerBranchId.value = String(userData.branchId || userData.clinicBranch || '').trim()
            subscribeToBranchSource(user, userData)
            await loadTodayShift(user.uid, userData)
            loading.value = false
          },
          (error) => {
            console.error('Failed to load employee profile:', error)
            loading.value = false
          }
        )
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
      clearBranchSubscription()
    })

    return {
      pageLoading,
      branchLabel,
      headingTitle,
      loading,
      roleLabel,
      hasReceptionistDashboard,
      hasPractitionerDashboard,
      receptionistCards,
      calendarWeekdays,
      calendarMonthLabel,
      practitionerCalendarCells,
      selectedCalendarDate,
      selectedCalendarDateLabel,
      selectedPractitionerAppointments,
      changeCalendarMonth,
      cellClass,
      formatAppointmentTime,
      quickLinks,
      todayShiftLabel,
      todayShiftTime
    }
  }
}
</script>
