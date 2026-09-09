<template>
  <BaseCollapsibleSidebar
    title="System Admin"
    subtitle="Platform Administration"
    panel-key="superadmin"
    default-name="System Admin"
    default-email="sysadmin@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'SuperAdminSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/superadmin/dashboard' },
      {
        key: 'accounts',
        label: 'Accounts',
        icon: 'users',
        children: [
          { label: 'Admin List', icon: 'shield-account', to: '/superadmin/admin-list' },
          { label: 'User Accounts', icon: 'profile', to: '/superadmin/accounts/users' }
        ]
      },
      {
        key: 'verification',
        label: 'Verification',
        icon: 'clipboard-list',
        children: [
          { label: 'Clinics', icon: 'shield', to: '/superadmin/clinics/verification' },
          { label: 'Suppliers', icon: 'truck', to: '/superadmin/suppliers/verification' }
        ]
      },
      {
        key: 'subscription',
        label: 'Subscription',
        icon: 'cash',
        children: [
          { label: 'Setup Plans', icon: 'settings', to: '/superadmin/subscription/plans' },
          { label: 'Permissions', icon: 'lock', to: '/superadmin/subscription/permissions' }
        ]
      },
      {
        key: 'payments',
        label: 'Payments',
        icon: 'credit-card',
        children: [
          { label: 'Analytics', icon: 'chart-line', to: '/superadmin/payments/analytics' },
          { label: 'Subscriptions', icon: 'receipt', to: '/superadmin/subscription/payments' }
        ]
      },
      { label: 'User Reports', icon: 'reportIssue', to: '/superadmin/tickets' },
      { label: 'System Settings', icon: 'cog', to: '/superadmin/system-settings' },
      { label: 'Activity Logs', icon: 'activity', to: '/superadmin/activity-logs' }
    ]

    return { items }
  }
}
</script>
