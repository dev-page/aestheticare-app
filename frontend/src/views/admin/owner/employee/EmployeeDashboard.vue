!START HERE!

<template>
  <div class="flex module-theme min-h-screen bg-[#f8f3ea] text-[#4a3324]">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'dashboard', cards: 4, panels: 2 }" class="flex-1 p-6 md:p-8">
      <DashboardSkeleton v-if="loading" />

      <div v-else class="space-y-6">
        <section class="rounded-[1.75rem] border border-[#ead8c2] bg-[#fffdf9] p-6 shadow-[0_18px_44px_rgba(75,49,30,0.08)]">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[#91643f]">Employee Panel</p>
          <h1 class="mt-3 font-serif text-3xl font-bold text-[#402719] md:text-4xl">{{ headingTitle }}</h1>
          <p class="mt-2 max-w-3xl text-sm leading-7 text-[#806b5a]">
            Your dashboard combines the tools and operational summaries for every role assigned to your account.
          </p>
        </section>

        <section class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] border border-[#ead8c2] bg-[#fffdf9] p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#91643f]">Roles</p>
            <p class="mt-3 text-lg font-semibold text-[#402719]">{{ roleLabel || headingTitle || 'Employee' }}</p>
            <p class="mt-1 text-sm text-[#806b5a]">Dashboard sections follow your assigned roles and permissions.</p>
          </div>
              <div data-onboarding-key="employee-branch-info" class="rounded-[1.5rem] border border-[#ead8c2] bg-[#fffdf9] p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#91643f]">Assigned Branch</p>
                <p class="mt-3 text-lg font-semibold text-[#402719]">{{ branchLabel || 'No branch assigned' }}</p>
                <p class="mt-1 text-sm text-[#806b5a]">This updates when your branch assignment changes.</p>
              </div>
          <div class="rounded-[1.5rem] border border-[#ead8c2] bg-[#fffdf9] p-5 shadow-sm">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#91643f]">Today's Shift</p>
            <p class="mt-3 text-lg font-semibold text-[#402719]">{{ todayShiftLabel }}</p>
            <p class="mt-1 text-sm text-[#806b5a]">{{ todayShiftTime }}</p>
          </div>
        </section>

        <BranchManagerDashboard v-if="hasBranchManagerDashboard" :appointments="dashboardData.appointments" :staff="dashboardData.staff" :inventory="dashboardData.inventory" />
        <HumanResourceDashboard v-if="hasHumanResourceDashboard" :staff="dashboardData.staff" :attendance="dashboardData.attendance" />
        <FinanceDashboard v-if="hasFinanceDashboard" :transactions="dashboardData.transactions" />
        <InventoryDashboard v-if="hasInventoryDashboard" :items="dashboardData.inventory" />
        <ProcurementDashboard v-if="hasProcurementDashboard" :orders="dashboardData.purchaseOrders" />
        <PharmacistDashboard v-if="hasPharmacistDashboard" :items="dashboardData.inventory" />
        <PractitionerDashboard v-if="hasPractitionerDashboard" :appointments="dashboardData.appointments" :user-id="currentUserId" />
        <ReceptionistDashboard v-if="hasReceptionistDashboard" :appointments="dashboardData.appointments" />

        <section class="overflow-hidden rounded-[1.75rem] border border-[#ead8c2] bg-[#fffdf9] shadow-sm">
          <div class="flex flex-col gap-2 border-b border-[#ead8c2] px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#91643f]">Quick Access</p>
              <h2 class="mt-2 font-serif text-2xl font-semibold text-[#402719]" data-onboarding-key="employee-quick-access-title">Open the pages you need most</h2>
              <p class="mt-1 text-sm text-[#806b5a]">
                These shortcuts are filtered to what your account can actually use.
              </p>
            </div>
            <span class="inline-flex w-fit rounded-full border border-[#ead8c2] bg-[#f7ede0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#76583f]">
              {{ quickLinks.length }} shortcuts
            </span>
          </div>

          <div v-if="quickLinks.length" class="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            <router-link
              v-for="link in quickLinks"
              :key="link.to"
              :to="link.to"
              class="group flex min-h-40 flex-col justify-between rounded-[1.4rem] border border-[#ead8c2] bg-[#fffaf4] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#b68a65] hover:bg-[#f8efe5]"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-base font-semibold text-[#402719]">{{ link.label }}</p>
                  <p class="mt-2 max-w-xs text-sm leading-6 text-[#806b5a]">{{ link.description }}</p>
                </div>
                <span class="rounded-full border border-[#ead8c2] bg-[#f7ede0] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#76583f]">
                  Open
                </span>
              </div>

              <div class="mt-6 flex items-center justify-between gap-3 border-t border-[#ead8c2] pt-4">
                <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#91643f]">
                  {{ link.group }}
                </span>
                <span class="text-sm font-medium text-[#674a36] transition group-hover:translate-x-1">
                  Go to page
                </span>
              </div>
            </router-link>
          </div>

          <div v-else class="px-6 py-10 text-center">
            <h3 class="text-lg font-semibold text-[#402719]">No quick access available yet</h3>
            <p class="mt-2 text-sm text-[#806b5a]">
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
import BranchManagerDashboard from './dashboards/BranchManagerDashboard.vue'
import HumanResourceDashboard from './dashboards/HumanResourceDashboard.vue'
import FinanceDashboard from './dashboards/FinanceDashboard.vue'
import InventoryDashboard from './dashboards/InventoryDashboard.vue'
import ProcurementDashboard from './dashboards/ProcurementDashboard.vue'
import PharmacistDashboard from './dashboards/PharmacistDashboard.vue'
import PractitionerDashboard from './dashboards/PractitionerDashboard.vue'
import ReceptionistDashboard from './dashboards/ReceptionistDashboard.vue'

export default {
  name: 'EmployeeDashboard',
  components: {
    OwnerSidebar,
    DashboardSkeleton,
    BranchManagerDashboard,
    HumanResourceDashboard,
    FinanceDashboard,
    InventoryDashboard,
    ProcurementDashboard,
    PharmacistDashboard,
    PractitionerDashboard,
    ReceptionistDashboard,
  },
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
    const dashboardData = ref({ appointments: [], transactions: [], staff: [], attendance: [], inventory: [], purchaseOrders: [] })
    const todayShiftLabel = ref('Loading...')
    const todayShiftTime = ref('Checking today\'s schedule...')
    let unsubscribeAuth = null
    let unsubscribeProfile = null
    let unsubscribeBranch = null

    const normalizeRoleName = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
    const assignedRoleKeys = computed(() => assignedRoleNames.value.map(normalizeRoleName))
    const hasReceptionistDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('reception') || role.includes('frontdesk')))
    const hasPractitionerDashboard = computed(() => assignedRoleKeys.value.some((role) => ['practitioner', 'doctor', 'dentist', 'nurse', 'therapist', 'clinician'].some((name) => role.includes(name))))
    const hasBranchManagerDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('branchmanager') || role === 'manager'))
    const hasHumanResourceDashboard = computed(() => assignedRoleKeys.value.some((role) => role === 'hr' || role.includes('humanresource')))
    const hasFinanceDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('finance') || role.includes('accounting')))
    const hasInventoryDashboard = computed(() => assignedRoleKeys.value.some((role) => role === 'inventory' || role.includes('inventorymanager')))
    const hasProcurementDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('procurement')))
    const hasPharmacistDashboard = computed(() => assignedRoleKeys.value.some((role) => role.includes('pharmacist') || role.includes('pharmacy')))
    const formatShiftTime = (value) => formatClockTime(value) || value

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

    const loadAssignedRoleNames = async (userData = {}) => {
      const roleIds = [...new Set([...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []), userData.customRoleId].map((id) => String(id || '').trim()).filter(Boolean))]
      const roleDocs = await Promise.all(roleIds.map((id) => getDoc(doc(db, 'clinicRoles', id)).catch(() => null)))
      const names = roleDocs.filter((snapshot) => snapshot?.exists()).map((snapshot) => String(snapshot.data()?.name || '').trim()).filter(Boolean)
      const fallbackNames = String(userData.customRoleName || userData.role || '').split(',').map(name => name.trim()).filter(Boolean)
      assignedRoleNames.value = [...new Set([...names, ...fallbackNames])]
    }

    const loadDashboardCollection = async (name, permission, feature, branchId, extraConstraints = []) => {
      if (!branchId || !hasPermission(permission) || (feature && !hasFeature(feature))) return []
      try {
        const snapshot = await getDocs(query(collection(db, name), where('branchId', '==', branchId), ...extraConstraints))
        return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      } catch (error) {
        console.warn(`Unable to load ${name} for the employee dashboard:`, error)
        return []
      }
    }

    let dashboardRequest = 0
    const refreshDashboardData = async (branchId) => {
      const requestId = ++dashboardRequest
      if (!branchId) {
        dashboardData.value = { appointments: [], transactions: [], staff: [], attendance: [], inventory: [], purchaseOrders: [] }
        return
      }
      const [appointments, transactions, staff, attendance, inventory, purchaseOrders] = await Promise.all([
        loadDashboardCollection('appointments', 'appointments:view', 'appointments', branchId),
        loadDashboardCollection('transactions', 'payments:view', 'pos_payments', branchId),
        loadDashboardCollection('users', 'staff:view', 'staff_management', branchId, [where('userType', '==', 'Staff')]),
        loadDashboardCollection('attendance', 'attendance:view', 'hr', branchId),
        (hasPermission('inventory:view') || hasPermission('pharmacy:view') || hasPermission('finance:purchases:view')) && hasFeature('inventory')
          ? loadDashboardCollection('inventoryItems', hasPermission('inventory:view') ? 'inventory:view' : hasPermission('pharmacy:view') ? 'pharmacy:view' : 'finance:purchases:view', 'inventory', branchId)
          : Promise.resolve([]),
        loadDashboardCollection('purchaseOrders', 'procurement:view', 'inventory', branchId),
      ])
      if (requestId !== dashboardRequest) return
      dashboardData.value = {
        appointments,
        transactions,
        staff: staff.filter(member => !member.archived),
        attendance,
        inventory,
        purchaseOrders,
      }
    }

    watch(
      () => [practitionerBranchId.value, assignedRoleKeys.value.join('|'), hasPermission('appointments:view'), hasPermission('payments:view'), hasPermission('staff:view'), hasPermission('attendance:view'), hasPermission('inventory:view'), hasPermission('pharmacy:view'), hasPermission('procurement:view')],
      ([branchId]) => { void refreshDashboardData(branchId) },
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
        todayShiftTime.value = shift?.start && shift?.end ? `${formatShiftTime(shift.start)} - ${formatShiftTime(shift.end)}` : 'Shift time is not configured.'
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
      await initSubscription()
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
          assignedRoleNames.value = []
          currentUserId.value = ''
          practitionerBranchId.value = ''
          dashboardData.value = { appointments: [], transactions: [], staff: [], attendance: [], inventory: [], purchaseOrders: [] }
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
      currentUserId,
      dashboardData,
      hasBranchManagerDashboard,
      hasHumanResourceDashboard,
      hasFinanceDashboard,
      hasInventoryDashboard,
      hasProcurementDashboard,
      hasPharmacistDashboard,
      hasReceptionistDashboard,
      hasPractitionerDashboard,
      quickLinks,
      todayShiftLabel,
      todayShiftTime
    }
  }
}
</script>
