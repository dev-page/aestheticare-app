<template>
  <BaseCollapsibleSidebar
    title="Supply Sidebar"
    subtitle="Supply Module"
    panel-key="supply"
    default-name="Supply Staff"
    default-email="supply@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'SupplySidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/supply/dashboard', feature: 'inventory', permission: 'inventory:view' },
      { label: 'Suppliers', icon: 'users', to: '/supply/suppliers', feature: 'inventory', permission: 'inventory:view' },
      { label: 'Catalog', icon: 'clipboard', to: '/supply/catalog', feature: 'inventory', permission: 'inventory:view' },
      { label: 'Purchase Requests', icon: 'cart', to: '/supply/purchase-requests', feature: 'inventory', permissionsAny: ['inventory:create', 'inventory:review'] }
    ]

    return { items }
  }
}
</script>
