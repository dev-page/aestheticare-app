<template>
  <BaseCollapsibleSidebar
    title="Practitioner Sidebar"
    subtitle="Clinical Module"
    panel-key="practitioner"
    default-name="Practitioner"
    default-email="practitioner@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'PractitionerSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/practitioner/dashboard' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' }
        ]
      },
      { label: 'Clients', icon: 'users', to: '/practitioner/clients', permission: 'clients:view' },
      { label: 'Appointments', icon: 'calendar', to: '/practitioner/appointments', permission: 'appointments:view' },
      { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review' },
      { label: 'Online Consultation', icon: 'video', to: '/practitioner/consultations/online', feature: 'online_consultations', permission: 'consultations:view' },
      { label: 'Activities', icon: 'activity', to: '/practitioner/activities' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]

    return { items }
  }
}
</script>
