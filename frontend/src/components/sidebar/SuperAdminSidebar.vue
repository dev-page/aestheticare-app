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
      { label: 'Clinic Verification', icon: 'shield', to: '/superadmin/clinics/verification' },
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
      { label: 'Activity Logs', icon: 'activity', to: '/superadmin/activity-logs' },
      {
        key: 'account-settings',
        label: 'Account Settings',
        icon: 'settings',
        children: [
          { label: 'Profile & Security', icon: 'profile', to: '/superadmin/account-settings' },
          { label: 'Notifications', icon: 'bell', to: '/notifications' },
          { label: 'Change Password', icon: 'key', to: '/change-password' },
          { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' },
        ]
      },
      { label: 'System Settings', icon: 'cog', to: '/superadmin/system-settings' }
    ]

    return { items }
  }
}
</script>
