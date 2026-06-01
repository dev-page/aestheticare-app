<template>
  <div :class="isModuleView ? 'module-theme bg-slate-900 min-h-screen notifications-shell-module' : 'notifications-shell'">
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
      <main :class="isModuleView ? 'notifications-main notifications-main-module' : 'notifications-main'">
        <div class="notifications-content">
          <div :class="isModuleView ? 'notifications-header notifications-header-module' : 'notifications-header'">
            <h1 :class="isModuleView ? 'notifications-title notifications-title-module' : 'notifications-title'">Notifications</h1>
            <p :class="isModuleView ? 'notifications-subtitle notifications-subtitle-module' : 'notifications-subtitle'">Latest updates and system activity.</p>
          </div>

          <p v-if="error" :class="isModuleView ? 'notifications-error notifications-error-module' : 'notifications-error'">{{ error }}</p>

          <section :class="isModuleView ? 'notifications-panel notifications-panel-module' : 'notifications-panel'">
            <div :class="isModuleView ? 'notifications-toolbar notifications-toolbar-module' : 'notifications-toolbar'">
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
            <div v-else-if="!notifications.length" :class="isModuleView ? 'notifications-empty notifications-empty-module' : 'notifications-empty'">
              No notifications yet.
            </div>
            <ul v-else class="notifications-list">
              <li :class="isModuleView ? 'notifications-select-all notifications-select-all-module' : 'notifications-select-all'">
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
                :class="isModuleView ? 'notifications-item notifications-item-module' : 'notifications-item'"
              >
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    class="notifications-checkbox mt-1"
                    :checked="selectedIds.includes(item.id)"
                    @change="toggleSelected(item.id)"
                  />
                  <div>
                    <p :class="isModuleView ? 'notifications-item-title notifications-item-title-module' : 'notifications-item-title'">
                      {{ item.title || 'Notification' }}
                    </p>
                    <p :class="isModuleView ? 'notifications-item-message notifications-item-message-module' : 'notifications-item-message'">{{ item.message || '-' }}</p>
                    <p :class="isModuleView ? 'notifications-item-date notifications-item-date-module' : 'notifications-item-date'">{{ item.createdLabel }}</p>
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
    :panelClass="isModuleView ? 'notifications-modal-panel notifications-modal-panel-module' : 'notifications-modal-panel'"
    :panelStyle="isModuleView ? '' : { backgroundColor: '#fffdf6', color: '#4f3527' }"
    bodyClass="notifications-modal-body-shell"
    @close="closeNotificationModal"
  >
    <template #header>
      <h2 :class="isModuleView ? 'notifications-modal-heading notifications-modal-heading-module' : 'notifications-modal-heading'">Notification</h2>
    </template>
    <template #body>
      <div v-if="selectedNotification" class="notifications-modal-body">
        <div>
          <p :class="isModuleView ? 'notifications-modal-label notifications-modal-label-module' : 'notifications-modal-label'">Title</p>
          <p :class="isModuleView ? 'notifications-modal-text notifications-modal-text-module mt-1 break-words' : 'notifications-modal-text mt-1 break-words'">{{ selectedNotification.title || 'Notification' }}</p>
        </div>
        <div>
          <p :class="isModuleView ? 'notifications-modal-label notifications-modal-label-module' : 'notifications-modal-label'">Description</p>
          <p :class="isModuleView ? 'notifications-modal-text notifications-modal-text-module mt-1 whitespace-pre-wrap break-words leading-6' : 'notifications-modal-text mt-1 whitespace-pre-wrap break-words leading-6'">{{ selectedNotification.message || '-' }}</p>
        </div>
        <div>
          <p :class="isModuleView ? 'notifications-modal-label notifications-modal-label-module' : 'notifications-modal-label'">Date & Time</p>
          <p :class="isModuleView ? 'notifications-modal-text notifications-modal-text-module mt-1' : 'notifications-modal-text mt-1'">{{ selectedNotification.createdLabel }}</p>
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
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'NotificationsPage',
  components: {
    EmployeeTopbar,
    PageSectionSkeleton,
    Icon,
    Modal,
    CustomerSidebar,
    EmployeeSidebar,
    OwnerSidebar
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

    const isModuleView = computed(() => panelKey.value === 'owner' || panelKey.value === 'employee')

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
      isModuleView,
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

.notifications-shell-module {
  background: #0f172a;
}

.notifications-main {
  flex: 1;
  padding: 1.5rem 1.4rem 2rem;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.notifications-main-module {
  background: transparent;
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

.notifications-header-module,
.notifications-panel-module {
  border-radius: 1.5rem;
  border: 1px solid rgba(123, 79, 55, 0.34);
  background:
    radial-gradient(circle at top right, rgba(230, 193, 150, 0.12), transparent 24%),
    linear-gradient(180deg, rgba(47, 31, 21, 0.94), rgba(27, 17, 12, 0.96));
  box-shadow: 0 24px 56px rgba(11, 6, 4, 0.24);
}

.notifications-header-module {
  padding: 1.35rem;
}

.notifications-panel {
  overflow: hidden;
}

.notifications-panel-module {
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

.notifications-title-module,
.notifications-modal-heading-module {
  color: #fff0e1;
  font-family: "Bodoni Moda", "Playfair Display", "Times New Roman", serif;
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

.notifications-subtitle-module,
.notifications-toolbar-module,
.notifications-item-message-module,
.notifications-item-date-module,
.notifications-empty-module,
.notifications-modal-label-module {
  color: #d4bead;
}

.notifications-error {
  color: #b85e5e;
  font-size: 0.9rem;
}

.notifications-error-module {
  color: #f7c7c7;
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

.notifications-toolbar-module {
  padding: 0.95rem 1rem;
  border-bottom: 1px solid rgba(123, 79, 55, 0.24);
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

.notifications-toolbar-module .notifications-delete-button,
.notifications-toolbar-module .notifications-view-button {
  border-color: rgba(123, 79, 55, 0.44);
  background: rgba(43, 28, 19, 0.82);
  color: #f2e2d2;
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

.notifications-toolbar-module .notifications-icon-button {
  border-color: rgba(123, 79, 55, 0.34);
  background: rgba(255, 255, 255, 0.04);
  color: #f2dcc4;
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

.notifications-empty-module {
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

.notifications-select-all-module,
.notifications-item-module {
  padding: 1rem;
  border-top: 1px solid rgba(123, 79, 55, 0.24);
}

.notifications-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #8d5a3b;
}

.notifications-toolbar-module .notifications-checkbox {
  accent-color: #d8b38f;
}

.notifications-item-title {
  color: #2f1d14;
  font-weight: 700;
}

.notifications-item-title-module {
  color: #fff0e1;
}

.notifications-item-message {
  margin-top: 0.2rem;
  font-size: 0.92rem;
}

.notifications-item-date {
  margin-top: 0.35rem;
  font-size: 0.76rem;
}

.notifications-item-date-module {
  color: #cbb19c;
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

.notifications-panel-module .notifications-new-badge {
  background: rgba(213, 160, 94, 0.12);
  color: #ffd17f;
  border-color: rgba(213, 160, 94, 0.2);
}

:deep(.notifications-modal-panel) {
  width: 100%;
  max-width: 40rem;
  border-radius: 1.5rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fffdf6 !important; /* solid off-white */
  color: #4f3527;
  box-shadow: 0 24px 60px rgba(87, 56, 35, 0.18);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

:deep(.notifications-modal-panel-module) {
  width: 100%;
  max-width: 40rem;
  border-radius: 1.5rem;
  border: 1px solid rgba(123, 79, 55, 0.34);
  background: linear-gradient(180deg, rgba(44, 29, 20, 0.98), rgba(31, 20, 14, 0.98));
  color: #ead9ca;
  box-shadow: 0 24px 60px rgba(11, 6, 4, 0.34);
}

.notifications-modal-heading {
  font-size: 1.4rem;
}

.notifications-modal-text-module {
  color: #fff1e3;
}

.notifications-modal-body {
  display: grid;
  gap: 1rem;
  font-size: 0.95rem;
  line-height: 1.65;
}

:deep(.notifications-modal-body-shell) {
  background: #fffdf6;
  color: #4f3527;
  padding: 0;
}

.notifications-modal-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.notifications-modal-label-module {
  color: #d4bead;
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
