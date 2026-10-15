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
        tourKey: 'customer-care',
        children: [
          { label: 'Appointments', icon: 'calendar', to: '/customer/appointments', tourKey: 'customer-appointments' },
          { label: 'Payments due', icon: 'card', to: '/customer/unpaid-appointments', tourKey: 'customer-unpaid-appointments' },
        ],
      },
      {
        label: 'My account',
        icon: 'settings',
        tourKey: 'customer-account',
        children: [
          { label: 'Profile', icon: 'profile', to: '/customer/account-settings?tab=profile', tourKey: 'customer-profile' },
          { label: 'Notifications', icon: 'bell', to: '/customer/account-settings?tab=notifications', tourKey: 'customer-notifications' },
          { label: 'Account Access', icon: 'account-off', to: '/customer/account-settings?tab=account', tourKey: 'customer-account-settings' },
          { label: 'Help & Guidance', icon: 'help', to: '/customer/account-settings?tab=help', tourKey: 'customer-help' },
          { label: 'Privacy & Data', icon: 'shield', to: '/customer/account-settings?tab=privacy', tourKey: 'customer-privacy' },
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
  border-color: #ead2b2;
  background: linear-gradient(180deg, #fffaf1, #f8ead4 100%);
}

:deep(.customer-sidebar aside > div:first-child) {
  padding-top: 1.35rem;
  border-bottom-color: #ead2b2;
}

:deep(.customer-sidebar aside h2) { font-family: Georgia, 'Times New Roman', serif; letter-spacing: -.02em; }
</style>
