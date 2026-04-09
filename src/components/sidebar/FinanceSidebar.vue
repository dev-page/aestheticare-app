<template>
  <BaseCollapsibleSidebar
    title="Finance Sidebar"
    subtitle="Finance Module"
    panel-key="finance"
    default-name="Finance Officer"
    default-email="finance@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'FinanceSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/finance/dashboard', feature: 'reports' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' }
        ]
      },
      { label: 'Sales', icon: 'money', to: '/finance/sales', feature: 'reports', permission: 'reports:view' },
      { label: 'Payroll Summary', icon: 'cash', to: '/finance/payroll-summary', feature: 'payroll', permission: 'payroll:view' },
      { label: 'Payroll Summary Approval', icon: 'check', to: '/finance/payroll-approval', permission: 'payroll:view' },
      { label: 'Inventory and Purchases', icon: 'cart', to: '/finance/inventory-purchases', feature: 'reports', permission: 'inventory:view' },
      { label: 'Accounts Payable', icon: 'file', to: '/finance/accounts-payable', feature: 'reports', permission: 'inventory:view' },
      { label: 'Reports', icon: 'chart', to: '/finance/reports', feature: 'reports', permission: 'reports:view' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]

    return { items }
  }
}
</script>
