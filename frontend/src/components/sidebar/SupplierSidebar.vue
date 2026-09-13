<template>
  <BaseCollapsibleSidebar
    title="Supplier Panel"
    subtitle="Business Operations"
    panel-key="supplier"
    default-name="Supplier"
    default-email="supplier@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'SupplierSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/supplier/dashboard' },
      { label: 'Business Profile', icon: 'profile', to: '/supplier/profile' },
      { label: 'My Supplies', icon: 'box', to: '/supplier/supplies' },
      { label: 'Quote Requests', icon: 'report', to: '/supplier/quote-requests' },
      {
        key: 'supplier-support',
        label: 'Support',
        icon: 'inbox',
        children: [
          { label: 'Notifications', icon: 'bell', to: '/notifications', permission: 'notifications:view' },
          { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', permission: 'support:view' },
          { label: 'Change Password', icon: 'key', to: '/change-password' },
        ],
      },
    ]

    return { items }
  },
}
</script>
