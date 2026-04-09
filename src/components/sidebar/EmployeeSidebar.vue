<template>
  <BaseCollapsibleSidebar
    :title="sidebarTitle"
    :subtitle="sidebarSubtitle"
    panel-key="employee"
    default-name="Employee"
    default-email="employee@aestheticare.com"
    :items="items"
  />
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'

export default {
  name: 'EmployeeSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission, effectivePermissions } = usePermissions()
    const { hasFeature, initSubscription } = useSubscription()

    const roleLabel = ref('')

    const sidebarTitle = computed(() => {
      const label = String(roleLabel.value || '').trim()
      return label || 'Employee Panel'
    })

    const sidebarSubtitle = computed(() => 'Dynamic access based on your assigned permissions')

    const moduleItems = [
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', feature: 'attendance' },
          { label: 'Attendance Record', icon: 'calendar', to: '/hr/attendance', permission: 'attendance:view', feature: 'attendance' }
        ]
      },
      {
        key: 'employees',
        label: 'Employees',
        icon: 'users',
        children: [
          { label: 'Employee Directory', icon: 'profile', to: '/hr/employee-profile', permission: 'staff:view', feature: 'staff_management' },
          { label: 'Add Employee', icon: 'userplus', to: '/hr/add-employee', permission: 'staff:create', feature: 'staff_management' },
          { label: 'Employee Archives', icon: 'archive', to: '/hr/archives', permission: 'staff:view', feature: 'staff_management' }
        ]
      },
      {
        key: 'clients',
        label: 'Clients',
        icon: 'users',
        children: [
          { label: 'Client List', icon: 'profile', to: '/receptionist/clients', permission: 'clients:view', feature: 'appointments' },
          { label: 'Add Client', icon: 'plus', to: '/receptionist/clients/add', permission: 'clients:create', feature: 'appointments' },
          { label: 'Practitioner Clients', icon: 'profile', to: '/practitioner/clients', permission: 'clients:view', feature: 'appointments' }
        ]
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: 'calendar',
        children: [
          { label: 'Appointments', icon: 'clipboard', to: '/receptionist/appointments', permission: 'appointments:view', feature: 'appointments' },
          { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review', feature: 'appointments' },
          { label: 'Online Consultation', icon: 'video', to: '/practitioner/consultations/online', permission: 'consultations:view', feature: 'online_consultations' }
        ]
      },
      {
        key: 'hr',
        label: 'HR and Payroll',
        icon: 'users',
        children: [
          { label: 'Add Shift', icon: 'plus', to: '/hr/add-shift', permission: 'hr:create', feature: 'hr' },
          { label: 'Schedule Assignment', icon: 'calendar', to: '/hr/schedule-assignment', permission: 'hr:update', feature: 'hr' },
          { label: 'Leave Request', icon: 'file', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create' },
          { label: 'Leave Management', icon: 'clipboard', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' },
          { label: 'Base Pay', icon: 'money', to: '/hr/base-pay', permission: 'payroll:update', feature: 'payroll' },
          { label: 'Payroll', icon: 'cash', to: '/hr/payroll', permission: 'payroll:update', feature: 'payroll' },
          { label: 'Payslip Generation', icon: 'file', to: '/hr/payslip-generation', permission: 'payroll:update', feature: 'payroll' },
          { label: 'Payroll Summary', icon: 'money', to: '/finance/payroll-summary', permission: 'payroll:view', feature: 'payroll' },
          { label: 'Payroll Approval', icon: 'check', to: '/finance/payroll-approval', permission: 'payroll:view', feature: 'payroll' }
        ]
      },
      {
        key: 'finance',
        label: 'Finance',
        icon: 'cash',
        children: [
          { label: 'POS', icon: 'cash', to: '/receptionist/pos', permission: 'payments:create', feature: 'pos_payments' },
          { label: 'Transactions', icon: 'chart', to: '/receptionist/transactions/history', permission: 'payments:view', feature: 'reports' },
          { label: 'Sales', icon: 'money', to: '/finance/sales', permission: 'reports:view', feature: 'reports' },
          { label: 'Refunds', icon: 'money', to: '/finance/refunds', permission: 'payments:view', feature: 'reports' },
          { label: 'Finance Reports', icon: 'chart', to: '/finance/reports', permission: 'reports:view', feature: 'reports' },
          { label: 'HR Sales', icon: 'chart', to: '/hr/sales', permission: 'reports:view', feature: 'reports' }
        ]
      },
      {
        key: 'operations',
        label: 'Operations',
        icon: 'building',
        children: [
          { label: 'Suppliers', icon: 'users', to: '/manager/suppliers', permission: 'inventory:view', feature: 'inventory' },
          { label: 'Purchase Requests', icon: 'cart', to: '/manager/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory' },
          { label: 'Item Catalog', icon: 'clipboard', to: '/manager/item-catalog', permission: 'inventory:view', feature: 'inventory' },
          { label: 'Supply Dashboard', icon: 'home', to: '/supply/dashboard', permission: 'inventory:view', feature: 'inventory' },
          { label: 'Supply Catalog', icon: 'clipboard', to: '/supply/catalog', permission: 'inventory:view', feature: 'inventory' },
          { label: 'Supply Suppliers', icon: 'users', to: '/supply/suppliers', permission: 'inventory:view', feature: 'inventory' },
          { label: 'Supply Requests', icon: 'cart', to: '/supply/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'], feature: 'inventory' },
          { label: 'Inventory Purchases', icon: 'cart', to: '/finance/inventory-purchases', permission: 'inventory:view', feature: 'reports' },
          { label: 'Accounts Payable', icon: 'file', to: '/finance/accounts-payable', permission: 'inventory:view', feature: 'reports' },
          { label: 'Product Service Listing', icon: 'tag', to: '/manager/product-service-listing', permission: 'services:view', feature: 'services' },
          { label: 'Orders', icon: 'cart', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'], feature: 'inventory' }
        ]
      },
      { label: 'Notifications', icon: 'bell', to: '/notifications', permission: 'notifications:view' },
      {
        key: 'account',
        label: 'Account Settings',
        icon: 'settings',
        children: [
          { label: 'Employee Profile', icon: 'profile', to: '/employee/profile', permission: 'profile:view' },
          { label: 'Reset Password', icon: 'shield', to: '/employee/change-password', permission: 'password:update' },
          { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', permission: 'support:view' }
        ]
      }
    ]

    const items = computed(() => {
      effectivePermissions.value
      return [{ label: 'Dashboard', icon: 'home', to: '/employee/dashboard' }, ...moduleItems]
        .map((item) => {
          if (!Array.isArray(item.children)) return item
          const children = item.children.filter((child) => {
            const permissionAllowed = !child.permission || hasPermission(child.permission)
            const featureAllowed = !child.feature || hasFeature(child.feature)
            return permissionAllowed && featureAllowed
          })
          return { ...item, children }
        })
        .filter((item) => {
          if (!Array.isArray(item.children)) return !item.permission || hasPermission(item.permission)
          return item.children.length > 0
        })
    })

    onMounted(async () => {
      await initSubscription()
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
          return
        }
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() || {} : {}
        roleLabel.value = String(userData.customRoleName || userData.role || 'Employee').trim()
      })
    })

    return {
      items,
      sidebarTitle,
      sidebarSubtitle,
    }
  }
}
</script>
