<template>
  <BaseCollapsibleSidebar
    title="Receptionist Sidebar"
    subtitle="Front Desk"
    panel-key="receptionist"
    default-name="Receptionist"
    default-email="receptionist@aestheticare.com"
    :items="items"
  />
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getFirestore, collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'

export default {
  name: 'ReceptionistSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const currentBranchId = ref('')
    const unreadCount = ref(0)
    let unsubscribeMessages = null
    let unsubscribeAuth = null

    const items = computed(() => [
      { label: 'Dashboard', icon: 'home', to: '/receptionist/dashboard' },
      {
        key: 'attendance',
        label: 'Attendance',
        icon: 'calendar',
        feature: 'attendance',
        children: [
          { label: 'Scan Attendance QR', icon: 'qr', to: '/attendance/scan', permission: 'attendance:create' }
        ]
      },
      {
        key: 'clients',
        label: 'Clients',
        icon: 'users',
        children: [
          { label: 'Client List', icon: 'profile', to: '/receptionist/clients', permission: 'clients:view' },
          { label: 'Add Client', icon: 'plus', to: '/receptionist/clients/add', permission: 'clients:create' }
        ]
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: 'calendar',
        children: [
          { label: 'Appointments', icon: 'clipboard', to: '/receptionist/appointments', permission: 'appointments:view' },
          { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review' }
        ]
      },
      { label: 'POS', icon: 'cash', to: '/receptionist/pos', feature: 'pos_payments', permission: 'payments:create' },
      { label: 'Inbox', icon: 'inbox', to: '/receptionist/inbox', permission: 'inbox:view', badge: unreadCount.value },
      {
        key: 'transactions',
        label: 'Transactions',
        icon: 'money',
        children: [
          { label: 'History', icon: 'chart', to: '/receptionist/transactions/history', permission: 'payments:view' }
        ]
      },
      { label: 'Activity Logs', icon: 'activity', to: '/receptionist/activity-logs' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ])

    const startMessageListener = () => {
      if (!currentBranchId.value) return
      if (unsubscribeMessages) unsubscribeMessages()
      const msgQuery = query(
        collection(db, 'messages'),
        where('branchId', '==', currentBranchId.value),
        where('isRead', '==', false)
      )
      unsubscribeMessages = onSnapshot(msgQuery, (snapshot) => {
        unreadCount.value = snapshot.size || 0
      })
    }

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          unreadCount.value = 0
          if (unsubscribeMessages) unsubscribeMessages()
          return
        }
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        startMessageListener()
      })
    })

    onUnmounted(() => {
      if (unsubscribeMessages) unsubscribeMessages()
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return { items }
  }
}
</script>
