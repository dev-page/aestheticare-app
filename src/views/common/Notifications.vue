<template>
  <div class="notifications-shell">
    <EmployeeTopbar
      title=""
      :plan-label="planLabel"
      :is-expired="isExpired"
      :sidebar-collapsed="sidebarCollapsed"
      :panel-key="panelKey"
      :badge-label="badgeLabel"
      :badge-tone="badgeTone"
      :badge-variant="badgeVariant"
      :badge-status-label="badgeStatusLabel"
      :show-badge-status="showBadgeStatus"
      :use-sidebar-offset="true"
    />

    <div class="flex flex-1 min-w-0">
      <component :is="sidebarComponent" v-if="sidebarComponent" />
      <main class="notifications-main">
        <div class="notifications-content">
          <div class="notifications-header">
            <h1 class="notifications-title">Notifications</h1>
            <p class="notifications-subtitle">Latest updates and system activity.</p>
          </div>

          <p v-if="error" class="notifications-error">{{ error }}</p>

          <section class="notifications-panel">
            <div class="notifications-toolbar">
              <span>Recent Notifications</span>
              <button
                type="button"
                class="notifications-delete-button"
                :disabled="!selectedIds.length"
                @click="deleteSelected"
              >
                <Icon icon="mdi:trash-can-outline" class="w-4 h-4" />
                Delete Selected
              </button>
            </div>
            <div v-if="loading" class="px-4 py-4">
              <PageSectionSkeleton variant="list" :rows="6" />
            </div>
            <div v-else-if="!notifications.length" class="notifications-empty">
              No notifications yet.
            </div>
            <ul v-else class="notifications-list">
              <li class="notifications-select-all">
                <input
                  type="checkbox"
                  class="notifications-checkbox"
                  :checked="allSelected"
                  @change="toggleSelectAll"
                />
                <span>Select all</span>
              </li>
              <li
                v-for="item in notifications"
                :key="item.id"
                class="notifications-item"
              >
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    class="notifications-checkbox mt-1"
                    :checked="selectedIds.includes(item.id)"
                    @change="toggleSelected(item.id)"
                  />
                  <div>
                    <p class="notifications-item-title">
                      {{ item.title || 'Notification' }}
                    </p>
                    <p class="notifications-item-message">{{ item.message || '-' }}</p>
                    <p class="notifications-item-date">{{ item.createdLabel }}</p>
                  </div>
                </div>
                <div class="notifications-item-actions">
                  <span
                    v-if="!item.read"
                    class="notifications-new-badge"
                  >
                    New
                  </span>
                  <button
                    type="button"
                    class="notifications-icon-button"
                    :class="item.read ? 'notifications-icon-button-read' : 'notifications-icon-button-new'"
                    :title="item.read ? 'Already read' : 'Mark as read'"
                    :disabled="item.read"
                    @click="markNotificationRead(item)"
                  >
                    <Icon icon="mdi:check-circle-outline" class="w-4 h-4" />
                  </button>
                  <button
                    v-if="item.link"
                    type="button"
                    class="notifications-view-button"
                    @click="openNotification(item)"
                  >
                    View
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  </div>

  <Modal
    :isOpen="showNotificationModal"
    panelClass="notifications-modal-panel"
    bodyClass="notifications-modal-body-shell"
    @close="closeNotificationModal"
  >
    <template #header>
      <h2 class="notifications-modal-heading">Notification</h2>
    </template>
    <template #body>
      <div v-if="selectedNotification" class="notifications-modal-body">
        <div>
          <p class="notifications-modal-label">Title</p>
          <p class="notifications-modal-text mt-1 break-words">{{ selectedNotification.title || 'Notification' }}</p>
        </div>
        <div>
          <p class="notifications-modal-label">Description</p>
          <p class="notifications-modal-text mt-1 whitespace-pre-wrap break-words leading-6">{{ selectedNotification.message || '-' }}</p>
        </div>
        <div>
          <p class="notifications-modal-label">Date & Time</p>
          <p class="notifications-modal-text mt-1">{{ selectedNotification.createdLabel }}</p>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'
import { useSubscription } from '@/composables/useSubscription'
import EmployeeTopbar from '@/components/common/EmployeeTopbar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { Icon } from '@iconify/vue'
import Modal from '@/components/common/Modal.vue'

import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'

export default {
  name: 'NotificationsPage',
  components: {
    EmployeeTopbar,
    PageSectionSkeleton,
    Icon,
    Modal,
    CustomerSidebar,
    OwnerSidebar,
    EmployeeSidebar
  },
  setup() {
    const router = useRouter()
    const { activePlan, isExpired, initSubscription } = useSubscription()

    const role = ref('')
    const userType = ref('')
    const sidebarCollapsed = ref(false)
    const sidebarHandler = ref(null)
    const notifications = ref([])
    const welcomeNotification = ref(null)
    const showNotificationModal = ref(false)
    const selectedNotification = ref(null)
    const loading = ref(true)
    const error = ref('')
    const currentUserId = ref('')
    let unsubscribeAuth = null
    let unsubscribeUser = null
      let unsubscribeRole = null

    const panelKey = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (typeValue === 'customer' || roleValue === 'customer') return 'customer'
      if (typeValue === 'staff') return 'employee'
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return 'owner'
      return ''
    })

    const sidebarComponent = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (!roleValue && !typeValue) return null
      if (roleValue.includes('superadmin')) return null
      if (typeValue === 'customer' || roleValue === 'customer') return CustomerSidebar
      if (typeValue === 'staff') return EmployeeSidebar
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return OwnerSidebar
      return CustomerSidebar
    })

    const planLabel = computed(() => {
      const raw = String(activePlan.value || '').trim().toLowerCase()
      if (!raw) return 'Plan'
      if (raw.includes('free')) return 'FreePlan'
      if (raw.includes('basic')) return 'Basic'
      if (raw.includes('premium')) return 'Premium'
      return activePlan.value
    })

    const badgeLabel = computed(() => {
      if (panelKey.value === 'customer') {
        try {
          return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }).format(new Date())
        } catch (_error) {
          return ''
        }
      }
      return ''
    })

    const badgeTone = computed(() => (panelKey.value === 'customer' ? 'neutral' : ''))
    const badgeVariant = computed(() => (panelKey.value === 'customer' ? 'date' : 'plan'))
    const showBadgeStatus = computed(() => panelKey.value !== 'customer')
    const badgeStatusLabel = computed(() => (isExpired.value ? 'Expired' : ''))

    const formatDate = (value) => {
      if (!value) return '-'
      const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
      if (Number.isNaN(date.getTime())) return '-'
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date)
    }

    const mergeNotifications = (userDocs = [], roleDocs = []) => {
      const combined = [...userDocs, ...roleDocs]
      if (welcomeNotification.value) {
        combined.push(welcomeNotification.value)
      }
      const map = new Map()
      combined.forEach((item) => {
        map.set(item.id, item)
      })
      notifications.value = Array.from(map.values())
        .filter((item) => !item.deleted)
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    }

    const startNotificationsListener = (userId, roleValue) => {
      loading.value = true
      error.value = ''
      const baseQuery = (filters) =>
        query(collection(db, 'notifications'), ...filters)

      unsubscribeUser = onSnapshot(
        baseQuery([where('recipientUserId', '==', userId)]),
        (snapshot) => {
          userDocsCache.value = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {}
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0)
            return {
              id: docSnap.id,
              ...data,
              createdLabel: formatDate(createdAt),
              createdAtMs: createdAt?.getTime?.() || 0
            }
          })
          mergeNotifications(userDocsCache.value, roleDocsCache.value)
          loading.value = false
        },
        (err) => {
          console.error('Failed to load notifications:', err)
          error.value = 'Unable to load notifications.'
          loading.value = false
        }
      )

      if (roleValue) {
        unsubscribeRole = onSnapshot(
        baseQuery([where('recipientRole', '==', roleValue)]),
        (snapshot) => {
          roleDocsCache.value = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {}
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0)
              return {
                id: docSnap.id,
                ...data,
                createdLabel: formatDate(createdAt),
                createdAtMs: createdAt?.getTime?.() || 0
              }
            })
          mergeNotifications(userDocsCache.value, roleDocsCache.value)
        },
          (err) => {
            console.error('Failed to load role notifications:', err)
            error.value = 'Unable to load notifications.'
          }
        )
      }
    }

    const userDocsCache = ref([])
    const roleDocsCache = ref([])

    const syncSidebarCollapsed = () => {
      if (!panelKey.value) return
      sidebarCollapsed.value = localStorage.getItem(`sidebar:${panelKey.value}:collapsed`) === '1'
    }

    const markNotificationRead = async (item) => {
      if (!item) return
      if (item.isWelcome) {
        try {
          await updateDoc(doc(db, 'users', currentUserId.value), {
            welcomeNotificationRead: true
          })
          if (welcomeNotification.value) {
            welcomeNotification.value = {
              ...welcomeNotification.value,
              read: true
            }
            mergeNotifications(userDocsCache.value, roleDocsCache.value)
          }
        } catch (_error) {
          // ignore
        }
      }
      if (!item.isWelcome && !item.read) {
        try {
          await updateDoc(doc(db, 'notifications', item.id), { read: true })
        } catch (_error) {
          // ignore
        }
      }
    }

    const openNotification = async (item) => {
      await markNotificationRead(item)
      selectedNotification.value = item
      showNotificationModal.value = true
    }

    const closeNotificationModal = () => {
      showNotificationModal.value = false
      selectedNotification.value = null
    }


    const selectedIds = ref([])
    const allSelected = computed(() => notifications.value.length > 0 && selectedIds.value.length === notifications.value.length)

    const toggleSelected = (id) => {
      if (!id) return
      if (selectedIds.value.includes(id)) {
        selectedIds.value = selectedIds.value.filter((value) => value !== id)
      } else {
        selectedIds.value = [...selectedIds.value, id]
      }
    }

    const toggleSelectAll = () => {
      if (allSelected.value) {
        selectedIds.value = []
      } else {
        selectedIds.value = notifications.value.map((item) => item.id)
      }
    }

    const deleteSelected = async () => {
      const ids = selectedIds.value.slice()
      if (!ids.length) return
      const includesWelcome = ids.some((id) => String(id).startsWith('welcome-'))
      const deletableIds = notifications.value
        .filter((item) => ids.includes(item.id) && item.recipientUserId === currentUserId.value)
        .map((item) => item.id)
      if (!deletableIds.length && !includesWelcome) return
      await Promise.all(
        deletableIds.map((id) =>
          updateDoc(doc(db, 'notifications', id), {
            deleted: true,
            updatedAt: new Date()
          }).catch(() => {})
        )
      )
      if (includesWelcome && currentUserId.value) {
        await updateDoc(doc(db, 'users', currentUserId.value), {
          welcomeNotificationDeleted: true
        }).catch(() => {})
        welcomeNotification.value = null
        mergeNotifications(userDocsCache.value, roleDocsCache.value)
      }
      selectedIds.value = []
    }

    onMounted(() => {
      initSubscription()
      syncSidebarCollapsed()
      sidebarHandler.value = (event) => {
        const detail = event?.detail || {}
        if (detail.panelKey && detail.panelKey === panelKey.value) {
          sidebarCollapsed.value = Boolean(detail.collapsed)
        }
      }
      window.addEventListener('sidebar-collapsed-change', sidebarHandler.value)

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return
        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (!userSnap.exists()) return
        const data = userSnap.data() || {}
        role.value = data.role || ''
        userType.value = data.userType || ''
        if (data.welcomeNotificationSent && !data.welcomeNotificationDeleted) {
          const createdAt = data.welcomeNotificationAt?.toDate
            ? data.welcomeNotificationAt.toDate()
            : new Date()
          welcomeNotification.value = {
            id: `welcome-${user.uid}`,
            isWelcome: true,
            title: 'Welcome to AesthetiCare',
            message: 'Thanks for trusting us with your care. We are glad to have you here.',
            createdLabel: formatDate(createdAt),
            createdAtMs: createdAt?.getTime?.() || 0,
            read: Boolean(data.welcomeNotificationRead),
            deleted: false,
            link: '/notifications'
          }
        } else {
          welcomeNotification.value = null
        }
        mergeNotifications(userDocsCache.value, roleDocsCache.value)
        const rawRole = String(data.role || '').trim().toLowerCase()
        let roleKey = ''
        if (rawRole.includes('superadmin')) roleKey = 'Superadmin'
        else if (rawRole.includes('clinic admin') || rawRole === 'clinicadmin' || rawRole === 'owner') roleKey = 'Owner'
        else roleKey = String(data.role || '').trim()
        startNotificationsListener(user.uid, roleKey)
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (unsubscribeUser) unsubscribeUser()
      if (unsubscribeRole) unsubscribeRole()
      if (sidebarHandler.value) {
        window.removeEventListener('sidebar-collapsed-change', sidebarHandler.value)
      }
    })

    return {
      notifications,
      loading,
      error,
      panelKey,
      sidebarCollapsed,
      sidebarComponent,
      planLabel,
      isExpired,
      badgeLabel,
      badgeTone,
      badgeVariant,
      badgeStatusLabel,
      showBadgeStatus,
      markNotificationRead,
      openNotification,
      showNotificationModal,
      selectedNotification,
      closeNotificationModal,
      selectedIds,
      allSelected,
      toggleSelected,
      toggleSelectAll,
      deleteSelected
    }
  }
}
</script>

<style scoped>
.notifications-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.notifications-main {
  flex: 1;
  padding: 1.5rem 1.4rem 2rem;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.notifications-content {
  display: grid;
  gap: 1rem;
}

.notifications-header,
.notifications-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.notifications-header {
  padding: 1.25rem;
}

.notifications-panel {
  overflow: hidden;
}

.notifications-title,
.notifications-modal-heading {
  margin: 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
}

.notifications-title {
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.notifications-subtitle,
.notifications-toolbar,
.notifications-item-message,
.notifications-item-date,
.notifications-empty,
.notifications-modal-label {
  color: rgba(76, 54, 40, 0.76);
}

.notifications-subtitle {
  margin: 0.75rem 0 0;
  line-height: 1.7;
}

.notifications-error {
  color: #b85e5e;
  font-size: 0.9rem;
}

.notifications-toolbar,
.notifications-select-all,
.notifications-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.notifications-toolbar {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid rgba(230, 193, 150, 0.6);
}

.notifications-delete-button,
.notifications-view-button,
.notifications-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.notifications-delete-button,
.notifications-view-button {
  padding: 0.72rem 1rem;
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  font-size: 0.82rem;
  font-weight: 700;
}

.notifications-delete-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.notifications-icon-button {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(230, 193, 150, 0.7);
  background: #fff8ef;
  color: #8d5a3b;
}

.notifications-icon-button-read {
  opacity: 0.55;
}

.notifications-icon-button-new {
  background: rgba(181, 127, 92, 0.12);
}

.notifications-delete-button:hover:not(:disabled),
.notifications-view-button:hover,
.notifications-icon-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.notifications-empty {
  padding: 1.2rem 1rem 1.35rem;
}

.notifications-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notifications-select-all,
.notifications-item {
  padding: 1rem;
  border-top: 1px solid rgba(230, 193, 150, 0.5);
}

.notifications-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #8d5a3b;
}

.notifications-item-title {
  color: #2f1d14;
  font-weight: 700;
}

.notifications-item-message {
  margin-top: 0.2rem;
  font-size: 0.92rem;
}

.notifications-item-date {
  margin-top: 0.35rem;
  font-size: 0.76rem;
}

.notifications-item-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.notifications-new-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: rgba(213, 160, 94, 0.18);
  color: #8a5e1d;
  border: 1px solid rgba(213, 160, 94, 0.28);
  font-size: 0.76rem;
  font-weight: 700;
}

:deep(.notifications-modal-panel) {
  width: 100%;
  max-width: 40rem;
  border-radius: 1.5rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 251, 244, 0.98);
  color: #4f3527;
  box-shadow: 0 24px 60px rgba(87, 56, 35, 0.18);
}

.notifications-modal-body-shell {
  padding: 0;
}

.notifications-modal-heading {
  font-size: 1.4rem;
}

.notifications-modal-body {
  display: grid;
  gap: 1rem;
  font-size: 0.95rem;
  line-height: 1.65;
}

.notifications-modal-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.notifications-modal-text {
  color: #3f281c;
}

@media (min-width: 1280px) {
  .notifications-main {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 767px) {
  .notifications-main {
    padding: 1rem 1rem 1.5rem;
  }

  .notifications-toolbar,
  .notifications-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .notifications-item-actions,
  .notifications-delete-button,
  .notifications-view-button {
    width: 100%;
  }
}
</style>
