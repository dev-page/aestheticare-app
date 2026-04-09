<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8">
      <DashboardSkeleton v-if="loading" />
      <div v-else class="space-y-8">
        <section class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Employee Panel</p>
          <h1 class="mt-3 text-3xl font-bold text-white">{{ headingTitle }}</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">
            Your dashboard adapts automatically to the permissions enabled in your assigned role and the clinic's current plan.
          </p>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Role</p>
              <p class="mt-2 text-lg font-semibold text-white">{{ headingTitle }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Accessible Modules</p>
              <p class="mt-2 text-lg font-semibold text-white">{{ accessibleModules.length }}</p>
            </div>
            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Enabled Permissions</p>
              <p class="mt-2 text-lg font-semibold text-white">{{ effectivePermissions.length }}</p>
            </div>
          </div>
        </section>

        <section v-if="quickLinks.length" class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-white">Quick Access</h2>
              <p class="mt-1 text-sm text-slate-400">Jump into the pages that match your current role setup.</p>
            </div>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <router-link
              v-for="link in quickLinks"
              :key="link.to"
              :to="link.to"
              class="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 transition hover:border-cyan-400 hover:bg-slate-900"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-white">{{ link.label }}</p>
                  <p class="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-300">{{ link.group }}</p>
                </div>
                <span class="rounded-xl border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">Open</span>
              </div>
              <p class="mt-3 text-sm text-slate-400">{{ link.description }}</p>
            </router-link>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-white">Available Modules</h2>
              <p class="mt-1 text-sm text-slate-400">Modules appear automatically when both the permission and the clinic plan allow them.</p>
            </div>
            <span class="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              {{ accessibleModules.length }} active
            </span>
          </div>

          <div v-if="accessibleModules.length" class="mt-6 grid gap-5 lg:grid-cols-2">
            <article
              v-for="module in accessibleModules"
              :key="module.key"
              class="rounded-2xl border border-slate-700 bg-slate-900/80 p-5"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-lg font-semibold text-white">{{ module.label }}</p>
                  <p class="mt-2 text-sm text-slate-400">{{ module.description }}</p>
                </div>
                <router-link
                  :to="module.primaryRoute"
                  class="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Open
                </router-link>
              </div>

              <div class="mt-5 flex flex-wrap gap-2">
                <router-link
                  v-for="entry in module.entries"
                  :key="entry.to"
                  :to="entry.to"
                  class="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-white"
                >
                  {{ entry.label }}
                </router-link>
              </div>
            </article>
          </div>

          <div v-else class="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-5 py-10 text-center">
            <h3 class="text-lg font-semibold text-white">No modules available yet</h3>
            <p class="mt-2 text-sm text-slate-400">
              This employee account does not currently have any active module access. Update the role permissions or clinic plan to unlock modules.
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'

export default {
  name: 'EmployeeDashboard',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { effectivePermissions, hasPermission } = usePermissions()
    const { hasFeature, initSubscription } = useSubscription()

    const loading = ref(true)
    const roleLabel = ref('')

    const moduleCatalog = [
      {
        key: 'attendance',
        label: 'Attendance',
        description: 'Attendance capture and attendance records.',
        entries: [
          { label: 'Scan Attendance QR', to: '/attendance/scan', feature: 'attendance', description: 'Record attendance through QR scanning.' },
          { label: 'Attendance Record', to: '/hr/attendance', permission: 'attendance:view', feature: 'attendance', description: 'Review attendance logs and records.' },
        ],
      },
      {
        key: 'employees',
        label: 'Employees',
        description: 'Employee directory, creation, and employee records.',
        entries: [
          { label: 'Employee Directory', to: '/hr/employee-profile', permission: 'staff:view', feature: 'staff_management', description: 'View employee profiles and role assignments.' },
          { label: 'Add Employee', to: '/hr/add-employee', permission: 'staff:create', feature: 'staff_management', description: 'Create employee accounts under the clinic.' },
          { label: 'Employee Archives', to: '/hr/archives', permission: 'staff:view', feature: 'staff_management', description: 'Review archived employee records.' },
        ],
      },
      {
        key: 'clients',
        label: 'Clients',
        description: 'Client records and client onboarding.',
        entries: [
          { label: 'Client List', to: '/receptionist/clients', permission: 'clients:view', feature: 'appointments', description: 'Review and search clinic clients.' },
          { label: 'Add Client', to: '/receptionist/clients/add', permission: 'clients:create', feature: 'appointments', description: 'Create a new client record.' },
          { label: 'Practitioner Clients', to: '/practitioner/clients', permission: 'clients:view', feature: 'appointments', description: 'Open practitioner client access.' },
        ],
      },
      {
        key: 'appointments',
        label: 'Appointments',
        description: 'Appointments, scheduling, and consultations.',
        entries: [
          { label: 'Appointments', to: '/receptionist/appointments', permission: 'appointments:view', feature: 'appointments', description: 'See and manage appointment listings.' },
          { label: 'Appointment Requests', to: '/receptionist/appointment-requests', permission: 'appointments:review', feature: 'appointments', description: 'Review cancellation and reschedule requests.' },
          { label: 'Online Consultation', to: '/practitioner/consultations/online', permission: 'consultations:view', feature: 'online_consultations', description: 'Join and manage online consultations.' },
        ],
      },
      {
        key: 'hr-payroll',
        label: 'HR and Payroll',
        description: 'HR entries, scheduling, payroll, and payslips.',
        entries: [
          { label: 'Add Shift', to: '/hr/add-shift', permission: 'hr:create', feature: 'hr', description: 'Create shift templates and schedules.' },
          { label: 'Schedule Assignment', to: '/hr/schedule-assignment', permission: 'hr:update', feature: 'hr', description: 'Assign shifts and schedules to staff.' },
          { label: 'Leave Request', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create', description: 'Submit a new leave request.' },
          { label: 'Leave Management', to: '/hr/leave-management', permission: 'leave:review', feature: 'hr', description: 'Track or review leave requests.' },
          { label: 'Base Pay', to: '/hr/base-pay', permission: 'payroll:update', feature: 'payroll', description: 'Manage base pay settings.' },
          { label: 'Payroll', to: '/hr/payroll', permission: 'payroll:update', feature: 'payroll', description: 'Run payroll and payslip workflows.' },
          { label: 'Payslip Generation', to: '/hr/payslip-generation', permission: 'payroll:update', feature: 'payroll', description: 'Generate staff payslips.' },
          { label: 'Payroll Summary', to: '/finance/payroll-summary', permission: 'payroll:view', feature: 'payroll', description: 'Review payroll summary results.' },
          { label: 'Payroll Approval', to: '/finance/payroll-approval', permission: 'payroll:view', feature: 'payroll', description: 'Approve payroll summary items.' },
        ],
      },
      {
        key: 'finance',
        label: 'Finance',
        description: 'Payments, reports, sales, and financial review.',
        entries: [
          { label: 'POS', to: '/receptionist/pos', permission: 'payments:create', feature: 'pos_payments', description: 'Process in-clinic payments.' },
          { label: 'Transactions', to: '/receptionist/transactions/history', permission: 'payments:view', feature: 'reports', description: 'Review payment history.' },
          { label: 'Sales', to: '/finance/sales', permission: 'reports:view', feature: 'reports', description: 'Open the sales analytics view.' },
          { label: 'Refunds', to: '/finance/refunds', permission: 'payments:view', feature: 'reports', description: 'Manage refund workflows.' },
          { label: 'Reports', to: '/finance/reports', permission: 'reports:view', feature: 'reports', description: 'See finance reports and summaries.' },
          { label: 'HR Sales', to: '/hr/sales', permission: 'reports:view', feature: 'reports', description: 'Open the HR reports page.' },
        ],
      },
      {
        key: 'operations',
        label: 'Operations',
        description: 'Inventory, suppliers, requests, and branch operations.',
        entries: [
          { label: 'Suppliers', to: '/manager/suppliers', permission: 'inventory:view', feature: 'inventory', description: 'Manage supplier records.' },
          { label: 'Purchase Requests', to: '/manager/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory', description: 'Create and review purchase requests.' },
          { label: 'Item Catalog', to: '/manager/item-catalog', permission: 'inventory:view', feature: 'inventory', description: 'Browse the item catalog.' },
          { label: 'Supply Dashboard', to: '/supply/dashboard', permission: 'inventory:view', feature: 'inventory', description: 'Open the supply dashboard.' },
          { label: 'Supply Catalog', to: '/supply/catalog', permission: 'inventory:view', feature: 'inventory', description: 'Access supply catalog pages.' },
          { label: 'Supply Requests', to: '/supply/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory', description: 'Manage supply requests.' },
          { label: 'Inventory Purchases', to: '/finance/inventory-purchases', permission: 'inventory:view', feature: 'reports', description: 'Review inventory purchases.' },
          { label: 'Accounts Payable', to: '/finance/accounts-payable', permission: 'inventory:view', feature: 'reports', description: 'Open accounts payable.' },
          { label: 'Product Service Listing', to: '/manager/product-service-listing', permission: 'services:view', feature: 'services', description: 'View products and services.' },
          { label: 'Orders', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'], feature: 'inventory', description: 'Track branch orders.' },
        ],
      },
      {
        key: 'notifications',
        label: 'Notifications',
        description: 'Review account updates and alerts.',
        entries: [
          { label: 'Notifications', to: '/notifications', description: 'Check account notifications.' },
        ],
      },
    ]

    const canAccessEntry = (entry) => {
      const permissionsAny = Array.isArray(entry.permissionsAny) ? entry.permissionsAny : []
      const permissionAllowed =
        (!entry.permission || hasPermission(entry.permission)) &&
        (!permissionsAny.length || permissionsAny.some((permission) => hasPermission(permission)))
      const featureAllowed = !entry.feature || hasFeature(entry.feature)
      return permissionAllowed && featureAllowed
    }

    const accessibleModules = computed(() =>
      moduleCatalog
        .map((module) => {
          const entries = module.entries.filter(canAccessEntry)
          return {
            ...module,
            entries,
            primaryRoute: entries[0]?.to || '/notifications',
          }
        })
        .filter((module) => module.entries.length > 0)
    )

    const quickLinks = computed(() =>
      accessibleModules.value.flatMap((module) =>
        module.entries.slice(0, 1).map((entry) => ({
          ...entry,
          group: module.label,
        }))
      )
    )

    const headingTitle = computed(() => {
      const label = String(roleLabel.value || '').trim()
      return label || 'Employee'
    })

    onMounted(async () => {
      await initSubscription()
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
          loading.value = false
          return
        }
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() || {} : {}
        roleLabel.value = String(userData.customRoleName || userData.role || 'Employee').trim()
        loading.value = false
      })
    })

    return {
      accessibleModules,
      effectivePermissions,
      headingTitle,
      loading,
      quickLinks,
    }
  },
}
</script>
