<template>
  <BaseCollapsibleSidebar
    title="Receptionist Sidebar"
    subtitle="Front Desk"
    panel-key="receptionist"
    default-name="Receptionist"
    default-email="receptionist@aestheticare.com"
    :items="items"
  />
</template>

<script>
import { computed } from 'vue'
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'ReceptionistSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = computed(() => [
      { label: 'Dashboard', icon: 'home', to: '/receptionist/dashboard' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' }
        ]
      },
      {
        key: 'clients',
        label: 'Clients',
        icon: 'users',
        children: [
          { label: 'Client List', icon: 'profile', to: '/receptionist/clients', permission: 'clients:view' },
          { label: 'Add Client', icon: 'plus', to: '/receptionist/clients/add', permission: 'clients:create' }
        ]
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: 'calendar',
        children: [
          { label: 'Appointments', icon: 'clipboard', to: '/receptionist/appointments', permission: 'appointments:view' },
          { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review' }
        ]
      },
      { label: 'POS', icon: 'cash', to: '/receptionist/pos', feature: 'pos_payments', permission: 'payments:create' },
      { label: 'Inbox', icon: 'inbox', to: '/receptionist/inbox', permission: 'inbox:view' },
      {
        key: 'transactions',
        label: 'Transactions',
        icon: 'money',
        children: [
          { label: 'History', icon: 'chart', to: '/receptionist/transactions/history', permission: 'payments:view' }
        ]
      },
      { label: 'Activity Logs', icon: 'activity', to: '/receptionist/activity-logs' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ])

    return { items }
  }
}
</script>
