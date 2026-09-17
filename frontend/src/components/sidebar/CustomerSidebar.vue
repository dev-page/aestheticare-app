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
      { label: 'Unpaid Appointments', icon: 'card', to: '/customer/unpaid-appointments', tourKey: 'customer-unpaid-appointments' },
      { label: 'Orders', icon: 'clipboard', to: '/customer/orders', tourKey: 'customer-orders' },
      { label: 'Cart', icon: 'cart', to: '/customer/cart', tourKey: 'customer-cart' },
      {
        label: 'Account Settings',
        icon: 'settings',
        children: [
          { label: 'Profile', icon: 'profile', to: '/customer/account-settings?tab=profile', tourKey: 'customer-profile' },
          { label: 'Notifications', icon: 'bell', to: '/customer/account-settings?tab=notifications', tourKey: 'customer-notifications' },
          { label: 'Account Access', icon: 'key', to: '/customer/account-settings?tab=account', tourKey: 'customer-account-settings' },
          { label: 'Help & Guidance', icon: 'help', to: '/customer/account-settings?tab=help', tourKey: 'customer-help' },
          { label: 'Privacy & Data', icon: 'shield', to: '/customer/account-settings?tab=privacy', tourKey: 'customer-privacy' },
          { label: 'Change Password', icon: 'key', to: '/change-password', tourKey: 'customer-change-password' },
          { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', tourKey: 'customer-report-issue' }
        ]
      }
    ]

    return { items }
  }
}
</script>
