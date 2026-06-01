<template>
  <BaseCollapsibleSidebar
    title="Manager Sidebar"
    subtitle="Branch Management"
    panel-key="manager"
    default-name="Branch Manager"
    default-email="manager@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'ManagerSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/manager/dashboard' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' },
          { label: 'Attendance Record', icon: 'calendar', to: '/manager/attendance', permission: 'attendance:view' }
        ]
      },
      {
        key: 'staff',
        label: 'Employees',
        icon: 'users',
        children: [
          { label: 'Records', icon: 'profile', to: '/manager/staffs', permission: 'staff:view' }
        ]
      },
      {
        key: 'supply',
        label: 'Supply and Inventory',
        icon: 'box',
        feature: 'inventory',
        children: [
          { label: 'Suppliers', icon: 'users', to: '/manager/suppliers', permission: 'inventory:view' },
          { label: 'Purchase Requests', icon: 'cart', to: '/manager/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'] },
          { label: 'Item Catalog', icon: 'clipboard', to: '/manager/item-catalog', permission: 'inventory:view' }
        ]
      },
      { label: 'Orders', icon: 'cart', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'] },
      { label: 'Product and Service Listing', icon: 'tag', to: '/manager/product-service-listing', feature: 'services', permission: 'services:view' },
      { label: 'Archives', icon: 'archive', to: '/manager/archived-posts', permission: 'services:view' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]

    return { items }
  }
}
</script>
