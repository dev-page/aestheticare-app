<template>
  <div class="employee-topbar readonly-exempt">
    <div class="employee-topbar-inner" :style="topbarStyle">
      <div class="employee-topbar-left">
        <button
          type="button"
          class="employee-topbar-btn employee-topbar-toggle"
          :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <svg class="employee-topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="sidebarCollapsed ? 'M13 5l7 7-7 7M5 5v14' : 'M11 19l-7-7 7-7M19 5v14'"
            />
          </svg>
        </button>
        <span v-if="title" class="employee-topbar-title">{{ title }}</span>
      </div>
      <div class="employee-topbar-right">
        <div class="employee-topbar-notifications">
        <button type="button" class="employee-topbar-btn" aria-label="Notifications" @click="toggleNotifications">
          <svg class="employee-topbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0"
            />
          </svg>
          <span v-if="unreadCount > 0" class="notifications-badge">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </button>
        <div v-if="showNotifications" class="notifications-menu">
          <div class="notifications-header">Notifications</div>
          <div v-if="loading" class="notifications-empty">Loading...</div>
          <div v-else-if="!latestNotifications.length" class="notifications-empty">No notifications yet.</div>
          <ul v-else class="notifications-list">
            <li v-for="item in latestNotifications" :key="item.id" class="notifications-item">
              <div class="notifications-item-title">{{ item.title || 'Notification' }}</div>
              <div class="notifications-item-body">{{ item.message || '-' }}</div>
              <div class="notifications-item-date">{{ item.createdLabel }}</div>
              <button type="button" class="notifications-view" @click="openNotificationModal(item)">
                View
              </button>
            </li>
          </ul>
          <button type="button" class="notifications-more" @click="goToNotifications">
            See more
          </button>
        </div>
        </div>
        <div class="employee-topbar-badge" :class="badgeClass">
          <span class="badge-label" :class="badgeLabelClass">{{ resolvedBadgeLabel }}</span>
          <span v-if="showBadgeStatus && isExpired" class="badge-status">{{ badgeStatusLabel }}</span>
        </div>
      </div>
    </div>
  </div>

  <Modal
    :isOpen="showNotificationModal"
    panelClass="bg-slate-800 text-white w-full max-w-xl"
    @close="closeNotificationModal"
  >
    <template #header>
      <h2 class="text-lg font-semibold">Notification</h2>
    </template>
    <template #body>
      <div v-if="selectedNotification" class="space-y-3 text-sm">
        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Title</p>
          <p class="text-white mt-1">{{ selectedNotification.title || 'Notification' }}</p>
        </div>
        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Description</p>
          <p class="text-white mt-1 whitespace-pre-line">{{ selectedNotification.message || '-' }}</p>
        </div>
        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Date</p>
          <p class="text-white mt-1">{{ selectedNotification.createdLabel }}</p>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import Modal from '@/components/common/Modal.vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Employee Panel'
  },
  planLabel: {
    type: String,
    default: 'Plan'
  },
  badgeLabel: {
    type: String,
    default: ''
  },
  badgeTone: {
    type: String,
    default: ''
  },
  badgeVariant: {
    type: String,
    default: 'plan'
  },
  showBadgeStatus: {
    type: Boolean,
    default: true
  },
  badgeStatusLabel: {
    type: String,
    default: 'Expired'
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  sidebarCollapsed: {
    type: Boolean,
    default: false
  },
  panelKey: {
    type: String,
    default: ''
  },
  useSidebarOffset: {
    type: Boolean,
    default: true
  },
  offsetPadding: {
    type: String,
    default: '0.5rem'
  }
})

const isSmallScreen = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false)

const syncSmallScreen = () => {
  if (typeof window === 'undefined') return
  isSmallScreen.value = window.matchMedia('(max-width: 767px)').matches
}

const topbarStyle = computed(() => ({
  '--sidebar-offset': props.useSidebarOffset
    ? (isSmallScreen.value ? '0rem' : (props.sidebarCollapsed ? '7rem' : '19rem'))
    : '0rem',
  '--sidebar-offset-padding': props.offsetPadding
}))

const resolvedBadgeLabel = computed(() => {
  return props.badgeLabel ? props.badgeLabel : props.planLabel
})

const resolvedBadgeTone = computed(() => {
  if (props.badgeTone) return props.badgeTone
  return props.isExpired ? 'expired' : 'active'
})

const badgeClass = computed(() => {
  if (resolvedBadgeTone.value === 'neutral') return 'badge-neutral'
  return resolvedBadgeTone.value === 'expired' ? 'badge-expired' : 'badge-active'
})

const badgeLabelClass = computed(() => {
  return props.badgeVariant === 'date' ? 'badge-date' : ''
})

const toggleSidebar = () => {
  if (!props.panelKey) return
  window.dispatchEvent(
    new CustomEvent('sidebar-toggle-request', {
      detail: { panelKey: props.panelKey }
    })
  )
}

const router = useRouter()
const showNotifications = ref(false)
const latestNotifications = ref([])
const loading = ref(false)
const roleValue = ref('')
const userId = ref('')
const showNotificationModal = ref(false)
const selectedNotification = ref(null)
let unsubscribeAuth = null
let unsubscribeUser = null
let unsubscribeRole = null
let resizeHandler = null

const formatDate = (value) => {
  if (!value) return '-'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

const mergeNotifications = (userDocs = [], roleDocs = []) => {
  const combined = [...userDocs, ...roleDocs]
  if (welcomeNotification.value) {
    combined.push(welcomeNotification.value)
  }
  const map = new Map()
  combined.forEach((item) => map.set(item.id, item))
  latestNotifications.value = Array.from(map.values())
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 3)
}

const userDocsCache = ref([])
const roleDocsCache = ref([])
const unreadCount = computed(() => {
  const items = [...userDocsCache.value, ...roleDocsCache.value]
  if (welcomeNotification.value) {
    items.push(welcomeNotification.value)
  }
  const map = new Map()
  items.forEach((item) => {
    if (!item || !item.id) return
    if (map.has(item.id)) return
    map.set(item.id, item)
  })
  return Array.from(map.values()).filter((item) => !item.read && !item.deleted).length
})

const startListeners = (userId, roleKey) => {
  loading.value = true
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
    () => {
      loading.value = false
    }
  )

  if (roleKey) {
    unsubscribeRole = onSnapshot(
      baseQuery([where('recipientRole', '==', roleKey)]),
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
      }
    )
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const goToNotifications = () => {
  showNotifications.value = false
  router.push('/notifications')
}

const openNotificationModal = async (item) => {
  if (!item) return
  if (item.isWelcome) {
    try {
      await updateDoc(doc(db, 'users', userId.value), {
        welcomeNotificationRead: true
      })
      if (welcomeNotification.value) {
        welcomeNotification.value = {
          ...welcomeNotification.value,
          read: true
        }
      }
    } catch (_error) {
      // ignore
    }
  }
  selectedNotification.value = item
  showNotifications.value = false
  showNotificationModal.value = true
}

const closeNotificationModal = () => {
  showNotificationModal.value = false
  selectedNotification.value = null
}

const welcomeNotification = ref(null)

onMounted(() => {
  syncSmallScreen()
  resizeHandler = () => syncSmallScreen()
  window.addEventListener('resize', resizeHandler)
  unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (!user) return
    userId.value = user.uid
    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const data = userSnap.exists() ? userSnap.data() : {}
    const rawRole = String(data.role || '').trim().toLowerCase()
    if (rawRole.includes('superadmin')) {
      roleValue.value = 'Superadmin'
    } else if (rawRole.includes('clinic admin') || rawRole === 'clinicadmin' || rawRole === 'owner') {
      roleValue.value = 'Owner'
    } else if (rawRole) {
      roleValue.value = String(data.role || '').trim()
    } else {
      roleValue.value = ''
    }
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
    startListeners(user.uid, roleValue.value)
    mergeNotifications(userDocsCache.value, roleDocsCache.value)
  })
})

onUnmounted(() => {
  if (unsubscribeAuth) unsubscribeAuth()
  if (unsubscribeUser) unsubscribeUser()
  if (unsubscribeRole) unsubscribeRole()
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
})
</script>

<style scoped>
.employee-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background:
    linear-gradient(180deg, rgba(26, 16, 11, 0.94) 0%, rgba(20, 12, 8, 0.9) 100%);
  border-bottom: 1px solid rgba(123, 79, 55, 0.44);
  box-shadow: 0 10px 28px rgba(11, 6, 4, 0.2);
  backdrop-filter: blur(12px);
}

.employee-topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.78rem 1.5rem;
  padding-left: calc(var(--sidebar-offset-padding, 1.5rem) + var(--sidebar-offset, 19rem));
  gap: 0.75rem;
}

.employee-topbar-title {
  color: #f7e8de;
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.employee-topbar-left {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.employee-topbar-toggle {
  height: 32px;
  width: 32px;
}

.employee-topbar-toggle .employee-topbar-icon {
  width: 16px;
  height: 16px;
}

.employee-topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.employee-topbar-notifications {
  position: relative;
}

.notifications-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.6rem);
  width: 300px;
  background: linear-gradient(180deg, rgba(28, 17, 12, 0.98), rgba(20, 12, 8, 0.98));
  border: 1px solid rgba(123, 79, 55, 0.62);
  border-radius: 1rem;
  box-shadow: 0 20px 42px rgba(0, 0, 0, 0.38);
  overflow: hidden;
  z-index: 60;
}

.notifications-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  border: 2px solid rgba(20, 12, 8, 0.96);
}
.notifications-header {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #c9b3a5;
  border-bottom: 1px solid rgba(90, 57, 39, 0.5);
}

.notifications-empty {
  padding: 1rem;
  color: #c9b3a5;
  font-size: 0.8rem;
}

.notifications-list {
  max-height: 240px;
  overflow-y: auto;
}

.notifications-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(90, 57, 39, 0.4);
}

.notifications-item:last-child {
  border-bottom: none;
}

.notifications-item-title {
  color: #f7e8de;
  font-size: 0.85rem;
  font-weight: 600;
}

.notifications-item-body {
  color: #c9b3a5;
  font-size: 0.78rem;
  margin-top: 0.15rem;
}

.notifications-item-date {
  color: #9f8a7c;
  font-size: 0.7rem;
  margin-top: 0.35rem;
}

.notifications-view {
  margin-top: 0.45rem;
  font-size: 0.72rem;
  color: #f3e7e0;
  background: rgba(58, 36, 23, 0.9);
  border: 1px solid rgba(90, 57, 39, 0.6);
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
}

.notifications-view:hover {
  background: rgba(84, 49, 33, 0.95);
}

.notifications-more {
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 0.8rem;
  color: #f3e7e0;
  background: rgba(58, 36, 23, 0.9);
  border: none;
  border-top: 1px solid rgba(90, 57, 39, 0.6);
  cursor: pointer;
}

.notifications-more:hover {
  background: rgba(84, 49, 33, 0.95);
}

.employee-topbar-btn {
  height: 40px;
  width: 40px;
  border-radius: 999px;
  border: 1px solid rgba(123, 79, 55, 0.62);
  background: linear-gradient(180deg, rgba(72, 45, 30, 0.82), rgba(48, 29, 18, 0.9));
  color: #f3e7e0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 241, 223, 0.05);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.employee-topbar-btn:hover {
  background: linear-gradient(180deg, rgba(96, 61, 41, 0.94), rgba(61, 38, 25, 0.96));
  color: #fff;
  transform: translateY(-1px);
}

.employee-topbar-icon {
  width: 18px;
  height: 18px;
}

.employee-topbar-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.badge-active {
  background: linear-gradient(180deg, rgba(17, 117, 78, 0.35), rgba(10, 88, 58, 0.32));
  border: 1px solid rgba(35, 183, 122, 0.34);
  color: #d9f9ea;
}

.badge-expired {
  background: rgba(248, 113, 113, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #ffd3d3;
}

.badge-neutral {
  background: linear-gradient(180deg, rgba(72, 45, 30, 0.82), rgba(48, 29, 18, 0.9));
  border: 1px solid rgba(123, 79, 55, 0.74);
  color: #f3e7e0;
}

.badge-date {
  text-transform: none;
  letter-spacing: 0.02em;
}

.badge-status {
  font-size: 0.65rem;
  opacity: 0.9;
}

@media (max-width: 767px) {
  .employee-topbar-toggle {
    display: none;
  }

  .employee-topbar-inner {
    padding: 0.45rem 0.7rem;
    padding-left: 1rem;
    align-items: flex-start;
    gap: 0.4rem;
  }

  .employee-topbar-title {
    font-size: 0.74rem;
  }

  .employee-topbar-right {
    gap: 0.5rem;
  }

  .employee-topbar-badge {
    padding: 0.22rem 0.42rem;
    font-size: 0.58rem;
  }

  .notifications-menu {
    right: -0.25rem;
    width: min(280px, calc(100vw - 1.5rem));
  }

  .employee-topbar-btn {
    width: 28px;
    height: 28px;
  }

  .employee-topbar-icon {
    width: 13px;
    height: 13px;
  }
}

@media (max-width: 520px) {
  .employee-topbar-inner {
    flex-direction: row;
    align-items: center;
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
  }

  .employee-topbar-left,
  .employee-topbar-right {
    width: auto;
  }

  .employee-topbar-right {
    justify-content: flex-end;
  }

  .employee-topbar-badge {
    max-width: calc(100vw - 6rem);
    justify-content: center;
  }

  .employee-topbar-title {
    font-size: 0.68rem;
  }
}
</style>
