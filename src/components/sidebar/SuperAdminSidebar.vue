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
        key: 'account-management',
        label: 'Account Management',
        icon: 'users',
        children: [
          { label: 'Admin List', icon: 'shield-account', to: '/superadmin/admin-list' },
          { label: 'User Accounts', icon: 'profile', to: '/superadmin/accounts/users' }
        ]
      },
      {
        key: 'clinic-management',
        label: 'Clinic Management',
        icon: 'box',
        children: [
          { label: 'Verified Clinics', icon: 'shield', to: '/superadmin/clinics/verified' },
          { label: 'Suspended Centers', icon: 'reportIssue', to: '/superadmin/clinics/suspended' },
          { label: 'Clinic Verification', icon: 'clipboard', to: '/superadmin/clinics/verification' },
          { label: 'Archived Clinics', icon: 'archive', to: '/superadmin/clinics/archived' }
        ]
      },
      {
        key: 'subscription',
        label: 'Subscription',
        icon: 'cash',
        children: [
          { label: 'Setup Plans', icon: 'settings', to: '/superadmin/subscription/plans' },
          { label: 'Plan Payments', icon: 'money', to: '/superadmin/subscription/payments' },
          { label: 'Subscription Permissions', icon: 'lock', to: '/superadmin/subscription/permissions' }
        ]
      },
      { label: 'Activity Logs', icon: 'activity', to: '/superadmin/activity-logs' },
      {
        key: 'support',
        label: 'Support & Reports',
        icon: 'inbox',
        children: [{ label: 'User Issues', icon: 'reportIssue', to: '/superadmin/tickets' }]
      }
    ]

    return { items }
  }
}
</script>
