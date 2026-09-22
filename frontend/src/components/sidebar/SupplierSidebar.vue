<template>
  <BaseCollapsibleSidebar
    title="Supplier Portal"
    subtitle="External Supplier Account"
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
      { label: 'My Supply Catalog', icon: 'box', to: '/supplier/supplies' },
      {
        key: 'supplier-clinic-transactions',
        label: 'Clinic Requests & Orders',
        icon: 'mdi:file-document-multiple-outline',
        children: [
          { label: 'Requests for Quotation', icon: 'mdi:file-send-outline', to: '/supplier/supply/rfqs' },
          { label: 'Purchase Orders', icon: 'mdi:cart-check', to: '/supplier/supply/orders' },
          { label: 'Invoices & Payments', icon: 'mdi:receipt-text-outline', to: '/supplier/supply/invoices' },
          { label: 'Clinic Messages', icon: 'mdi:chat-processing-outline', to: '/supplier/chat' }
        ]
      },
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
