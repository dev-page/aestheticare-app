<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8">
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
          <div class="rounded-[1.5rem] border border-[rgba(123,79,55,0.34)] bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_18px_44px_rgba(11,6,4,0.16)]">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Assigned Branch</p>
            <p class="mt-3 text-lg font-semibold text-[#fff0e1]">{{ branchLabel || 'No branch assigned' }}</p>
            <p class="mt-1 text-sm text-[#d4bead]">This updates when your branch assignment changes.</p>
          </div>
        </section>

        <section class="rounded-[1.75rem] border border-[rgba(123,79,55,0.34)] bg-[radial-gradient(circle_at_top_right,_rgba(230,193,150,0.12),_transparent_24%),linear-gradient(180deg,_rgba(47,31,21,0.96),_rgba(27,17,12,0.98))] shadow-[0_24px_56px_rgba(11,6,4,0.24)] overflow-hidden">
          <div class="flex flex-col gap-2 border-b border-[rgba(123,79,55,0.24)] px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8b38f]">Quick Access</p>
              <h2 class="mt-2 font-serif text-2xl font-semibold text-[#fff0e1]">Open the pages you need most</h2>
              <p class="mt-1 text-sm text-[#d4bead]">
                These shortcuts are filtered to what your account can actually use.
              </p>
            </div>
            <span class="inline-flex w-fit rounded-full border border-[rgba(123,79,55,0.34)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d8b38f]">
              {{ quickLinks.length }} shortcuts
            </span>
          </div>

          <div v-if="quickLinks.length" class="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            <router-link
              v-for="link in quickLinks"
              :key="link.to"
              :to="link.to"
              class="group flex min-h-40 flex-col justify-between rounded-[1.4rem] border border-[rgba(123,79,55,0.28)] bg-[rgba(255,255,255,0.04)] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(216,179,143,0.55)] hover:bg-[rgba(255,255,255,0.06)]"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-base font-semibold text-[#fff0e1]">{{ link.label }}</p>
                  <p class="mt-2 max-w-xs text-sm leading-6 text-[#d4bead]">{{ link.description }}</p>
                </div>
                <span class="rounded-full border border-[rgba(123,79,55,0.34)] bg-[rgba(43,28,19,0.82)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f2e2d2]">
                  Open
                </span>
              </div>

              <div class="mt-6 flex items-center justify-between gap-3 border-t border-[rgba(123,79,55,0.24)] pt-4">
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getFirestore, onSnapshot, query, where } from 'firebase/firestore'
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
    const { hasPermission } = usePermissions()
    const { hasFeature, initSubscription } = useSubscription()

    const loading = ref(true)
    const roleLabel = ref('')
    const branchLabel = ref('')
    let unsubscribeAuth = null
    let unsubscribeProfile = null
    let unsubscribeBranch = null

    const moduleCatalog = [
      {
        key: 'employees',
        label: 'Employees',
        entries: [
          { label: 'Employee Directory', to: '/hr/employee-profile', permission: 'staff:view', feature: 'staff_management', description: 'View employee profiles and role assignments.' },
          { label: 'Add Employee', to: '/hr/add-employee', permission: 'staff:create', feature: 'staff_management', description: 'Create employee accounts under the clinic.' },
          { label: 'Employee Archives', to: '/hr/archives', permission: 'staff:view', feature: 'staff_management', description: 'Review archived employee records.' }
        ]
      },
      {
        key: 'clients',
        label: 'Clients',
        entries: [
          { label: 'Client List', to: '/receptionist/clients', permission: 'clients:view', feature: 'appointments', description: 'Review and search clinic clients.' },
          { label: 'Add Client', to: '/receptionist/clients/add', permission: 'clients:create', feature: 'appointments', description: 'Create a new client record.' },
          { label: 'Practitioner Clients', to: '/practitioner/clients', permission: 'clients:view', feature: 'appointments', description: 'Open practitioner client access.' }
        ]
      },
      {
        key: 'appointments',
        label: 'Appointments',
        entries: [
          { label: 'Appointments', to: '/receptionist/appointments', permission: 'appointments:view', feature: 'appointments', description: 'See and manage appointment listings.' },
          { label: 'Appointment Requests', to: '/receptionist/appointment-requests', permission: 'appointments:review', feature: 'appointments', description: 'Review cancellation and reschedule requests.' },
          { label: 'Online Consultation', to: '/practitioner/consultations/online', permission: 'consultations:view', feature: 'online_consultations', description: 'Join and manage online consultations.' }
        ]
      },
      {
        key: 'hr-payroll',
        label: 'HR and Payroll',
        entries: [
          { label: 'Add Shift', to: '/hr/add-shift', permission: 'hr:create', feature: 'hr', description: 'Create shift templates and schedules.' },
          { label: 'Schedule Assignment', to: '/hr/schedule-assignment', permission: 'hr:update', feature: 'hr', description: 'Assign shifts and schedules to staff.' },
          { label: 'Leave Request', to: '/hr/leave-request', permission: 'leave:create', feature: 'hr', description: 'Submit a new leave request.' },
          { label: 'Leave Management', to: '/hr/leave-management', permission: 'leave:review', feature: 'hr', description: 'Track or review leave requests.' },
          { label: 'Base Pay', to: '/hr/base-pay', permission: 'payroll:update', feature: 'payroll', description: 'Manage base pay settings.' },
          { label: 'Payroll', to: '/hr/payroll', permission: 'payroll:update', feature: 'payroll', description: 'Run payroll and payslip workflows.' },
          { label: 'Payslip Generation', to: '/hr/payslip-generation', permission: 'payroll:update', feature: 'payroll', description: 'Generate staff payslips.' },
          { label: 'Payroll Summary', to: '/finance/payroll-summary', permission: 'payroll:view', feature: 'payroll', description: 'Review payroll summary results.' },
          { label: 'Payroll Approval', to: '/finance/payroll-approval', permission: 'payroll:view', feature: 'payroll', description: 'Approve payroll summary items.' }
        ]
      },
      {
        key: 'finance',
        label: 'Finance',
        entries: [
          { label: 'POS', to: '/receptionist/pos', permission: 'payments:create', feature: 'pos_payments', description: 'Process in-clinic payments.' },
          { label: 'Transactions', to: '/receptionist/transactions/history', permission: 'payments:view', feature: 'reports', description: 'Review payment history.' },
          { label: 'Sales', to: '/finance/sales', permission: 'reports:view', feature: 'reports', description: 'Open the sales analytics view.' },
          { label: 'Refunds', to: '/finance/refunds', permission: 'payments:view', feature: 'reports', description: 'Manage refund workflows.' },
          { label: 'Reports', to: '/finance/reports', permission: 'reports:view', feature: 'reports', description: 'See finance reports and summaries.' }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
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
          { label: 'Orders', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'], feature: 'inventory', description: 'Track branch orders.' }
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

    const subscribeToBranchSource = (user, userData = {}) => {
      clearBranchSubscription()

      const branchId = String(userData.branchId || userData.clinicBranch || '').trim()
      if (branchId) {
        unsubscribeBranch = onSnapshot(doc(db, 'clinics', branchId), (branchSnap) => {
          if (!branchSnap.exists()) {
            branchLabel.value = branchId
            return
          }
          void applyBranchSnapshot(branchSnap, branchId)
        })
        return
      }

      unsubscribeBranch = onSnapshot(
        query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid)),
        (snapshot) => {
          if (snapshot.empty) {
            branchLabel.value = ''
            return
          }

          const branchSnap = snapshot.docs[0]
          void applyBranchSnapshot(branchSnap)
        }
      )
    }

    onMounted(async () => {
      await initSubscription()
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
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

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (userSnap) => {
          const userData = userSnap.exists() ? userSnap.data() || {} : {}
          roleLabel.value = String(userData.customRoleName || userData.role || 'Employee').trim()
          subscribeToBranchSource(user, userData)
          loading.value = false
        })
      })
    })

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
      branchLabel,
      headingTitle,
      loading,
      roleLabel,
      quickLinks
    }
  }
}
</script>
