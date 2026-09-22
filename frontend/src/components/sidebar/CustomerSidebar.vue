<template>
  <BaseCollapsibleSidebar
    class="customer-sidebar"
    title="AesthetiCare"
    subtitle="Your wellness space"
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
      { label: 'Discover clinics', icon: 'home', to: '/customer/home', tourKey: 'customer-home' },
      {
        label: 'My care',
        icon: 'calendar',
        children: [
          { label: 'Appointments', icon: 'calendar', to: '/customer/appointments', tourKey: 'customer-appointments' },
          { label: 'Payments due', icon: 'card', to: '/customer/unpaid-appointments', tourKey: 'customer-unpaid-appointments' },
        ],
      },
      {
        label: 'Shop',
        icon: 'cart',
        children: [
          { label: 'My cart', icon: 'cart', to: '/customer/cart', tourKey: 'customer-cart' },
          { label: 'Orders & pickup', icon: 'clipboard', to: '/customer/orders', tourKey: 'customer-orders' },
        ],
      },
      {
        label: 'My account',
        icon: 'settings',
        children: [
          { label: 'Profile', icon: 'profile', to: '/customer/account-settings?tab=profile', tourKey: 'customer-profile' },
          { label: 'Notifications', icon: 'bell', to: '/customer/account-settings?tab=notifications', tourKey: 'customer-notifications' },
          { label: 'Account Access', icon: 'account-off', to: '/customer/account-settings?tab=account', tourKey: 'customer-account-settings' },
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

<style scoped>
:deep(.customer-sidebar aside) {
  border-color: #4a2d1c;
  background:
    radial-gradient(circle at 10% 0%, rgba(170, 103, 53, .20), transparent 30%),
    linear-gradient(180deg, #21130c, #170d08 100%);
}

:deep(.customer-sidebar aside > div:first-child) {
  padding-top: 1.35rem;
  border-bottom-color: rgba(134, 82, 47, .45);
}

:deep(.customer-sidebar aside h2) { font-family: Georgia, 'Times New Roman', serif; letter-spacing: -.02em; }
</style>
