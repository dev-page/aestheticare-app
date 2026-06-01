<template>
  <BaseCollapsibleSidebar
    title="Cashier Sidebar"
    subtitle="Cashier Module"
    panel-key="cashier"
    default-name="Cashier"
    default-email="cashier@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'CashierSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Dashboard', icon: 'home', to: '/cashier/dashboard' },
      { label: 'Payments', icon: 'cash', to: '/cashier/payments', permission: 'payments:view' }
    ]

    return { items }
  }
}
</script>
