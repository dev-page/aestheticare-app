<template>
  <BaseCollapsibleSidebar
    title="Customer Sidebar"
    subtitle="Customer Panel"
    panel-key="customer"
    default-name="Customer"
    default-email="customer@aestheticare.com"
    :items="items"
  />
</template>

<script>
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'CustomerSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const items = [
      { label: 'Home', icon: 'home', to: '/customer/home' },
      { label: 'Appointments', icon: 'calendar', to: '/customer/appointments' },
      { label: 'Orders', icon: 'clipboard', to: '/customer/orders' },
      { label: 'Cart', icon: 'cart', to: '/customer/cart' },
      { label: 'Profile', icon: 'profile', to: '/customer/profile' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]

    return { items }
  }
}
</script>
