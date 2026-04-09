<template>
  <BaseCollapsibleSidebar
    title="HR Sidebar"
    subtitle="Human Resources"
    panel-key="hr"
    default-name="HR Staff"
    default-email="hr@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'HRSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/hr/dashboard', feature: 'hr' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' },
          { label: 'Attendance Record', icon: 'calendar', to: '/hr/attendance', permission: 'attendance:view' }
        ]
      },
      {
        key: 'employees',
        label: 'Employees',
        icon: 'users',
        feature: 'hr',
        children: [
          { label: 'Employee Directory', icon: 'profile', to: '/hr/employee-profile', permission: 'staff:view' },
          { label: 'Add Employee', icon: 'userplus', to: '/hr/add-employee', permission: 'staff:create' },
          { label: 'Archives', icon: 'archive', to: '/hr/archives', permission: 'staff:disable' }
        ]
      },
      {
        key: 'shifts',
        label: 'Shifts',
        icon: 'calendar',
        feature: 'hr_shifts',
        children: [
          { label: 'Add Shift', icon: 'plus', to: '/hr/add-shift', permission: 'hr:create' }
        ]
      },
      {
        key: 'leave',
        label: 'Leave',
        icon: 'file',
        feature: 'hr',
        children: [
          { label: 'Leave Request', icon: 'file', to: '/hr/leave-request', feature: 'hr' },
          { label: 'Leave Management', icon: 'clipboard', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' }
        ]
      },
      {
        key: 'payroll',
        label: 'Payroll',
        icon: 'cash',
        feature: 'payroll',
        children: [
          { label: 'Base Pay', icon: 'money', to: '/hr/base-pay', permission: 'payroll:update' },
          { label: 'Payroll & Payslip', icon: 'money', to: '/hr/payroll', permission: 'payroll:update' }
        ]
      },
      { label: 'Reports and Analytics', icon: 'chart', to: '/hr/sales', feature: 'hr', permission: 'reports:view' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]

    return { items }
  }
}
</script>
