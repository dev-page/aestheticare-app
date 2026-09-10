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
      { label: 'Home', icon: 'home', to: '/customer/home', tourKey: 'customer-home' },
      { label: 'Appointments', icon: 'calendar', to: '/customer/appointments', tourKey: 'customer-appointments' },
      { label: 'Orders', icon: 'clipboard', to: '/customer/orders', tourKey: 'customer-orders' },
      { label: 'Cart', icon: 'cart', to: '/customer/cart', tourKey: 'customer-cart' },
      { label: 'Profile', icon: 'profile', to: '/customer/profile', tourKey: 'customer-profile' },
      { label: 'Account Settings', icon: 'settings', to: '/customer/account-settings', tourKey: 'customer-account-settings' },
      { label: 'Notifications', icon: 'bell', to: '/notifications', tourKey: 'customer-notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', tourKey: 'customer-report-issue' }
    ]

    return { items }
  }
}
</script>
