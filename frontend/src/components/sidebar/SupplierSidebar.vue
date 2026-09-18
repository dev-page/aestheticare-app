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
      { label: 'My Supplies', icon: 'box', to: '/supplier/supplies' },
      { label: 'Procurement Dashboard', icon: 'mdi:view-dashboard-outline', to: '/supplier/supply/dashboard' },
      { label: 'RFQs & Quotations', icon: 'mdi:file-document-outline', to: '/supplier/supply/rfqs' },
      { label: 'Purchase Orders', icon: 'mdi:cart-check', to: '/supplier/supply/orders' },
      { label: 'Invoices & Payments', icon: 'mdi:receipt-text-outline', to: '/supplier/supply/invoices' },
      { label: 'Quote Requests', icon: 'report', to: '/supplier/quote-requests' },
      {
        key: 'supplier-account-settings',
        label: 'Account Settings',
        icon: 'settings',
        children: [
          { label: 'Profile', icon: 'profile', to: '/supplier/profile' },
          { label: 'Notifications', icon: 'bell', to: '/notifications' },
          { label: 'Change Password', icon: 'key', to: '/change-password' },
          { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' },
        ],
      },
    ]

    return { items }
  },
}
</script>
