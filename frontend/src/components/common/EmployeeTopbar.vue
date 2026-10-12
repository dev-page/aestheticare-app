<template>
  <div class="employee-topbar readonly-exempt">
    <div class="employee-topbar-inner" :style="topbarStyle">
      <div class="employee-topbar-left">
        <span class="employee-topbar-kicker">AesthetiCare</span>
        <span class="employee-topbar-title">{{ resolvedTitle }}</span>
        <span v-if="roleValue" class="employee-topbar-role">{{ roleValue }}</span>
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

  <NotificationDetailsDialog :is-open="showNotificationModal" :notification="selectedNotification" :user-type="userTypeValue" :role="roleValue" @close="closeNotificationModal" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import NotificationDetailsDialog from '@/components/common/NotificationDetailsDialog.vue'

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

const resolvedTitle = computed(() => props.title || 'Clinic Workspace')

const router = useRouter()
const showNotifications = ref(false)
const latestNotifications = ref([])
const loading = ref(false)
const roleValue = ref('')
const userTypeValue = ref('')
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

const startListeners = (userId, roleKey, branchId) => {
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

  if (roleKey && (branchId || roleKey === 'Superadmin')) {
    unsubscribeRole = onSnapshot(
      baseQuery([where('recipientRole', '==', roleKey), ...(roleKey === 'Superadmin' ? [] : [where('branchId', '==', branchId)])]),
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
  selectedNotification.value = item
  showNotifications.value = false
  showNotificationModal.value = true
  if (item.read) return
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
      mergeNotifications(userDocsCache.value, roleDocsCache.value)
    } catch (error) {
      console.warn('Unable to mark welcome notification as read:', error)
    }
    return
  }
  try {
    await updateDoc(doc(db, 'notifications', item.id), { read: true })
    // Keep both recipient caches in sync when a notification appears in both queries.
    const markRead = notification => notification.id === item.id ? { ...notification, read: true } : notification
    userDocsCache.value = userDocsCache.value.map(markRead)
    roleDocsCache.value = roleDocsCache.value.map(markRead)
    mergeNotifications(userDocsCache.value, roleDocsCache.value)
  } catch (error) {
    console.warn('Unable to mark notification as read:', error)
  }
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
    userTypeValue.value = String(data.userType || '').trim()
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
    startListeners(user.uid, roleValue.value, data.branchId || ((roleValue.value) === 'Owner' ? user.uid : ''))
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
  z-index: 10;
  background:
    linear-gradient(180deg, rgba(255, 253, 249, .96) 0%, rgba(255, 247, 236, .94) 100%);
  border-bottom: 1px solid var(--ac-border, #ead2b2);
  box-shadow: 0 8px 24px rgba(72, 42, 23, .08);
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
  color: var(--ac-text, #342419);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.employee-topbar-kicker {
  color: var(--ac-text-muted, #795f4b);
  font-size: .65rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.employee-topbar-role {
  border: 1px solid var(--ac-border, #ead2b2);
  border-radius: 999px;
  background: var(--ac-surface-soft, #fff7ec);
  color: var(--ac-text-secondary, #624733);
  padding: .2rem .55rem;
  font-size: .68rem;
  font-weight: 700;
  line-height: 1;
}

.employee-topbar-left {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
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
  background: #fffaf1;
  border: 1px solid #dfbd93;
  border-radius: 1rem;
  box-shadow: 0 20px 42px rgba(72, 42, 23, 0.22);
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
  border: 2px solid #fffaf1;
}
.notifications-header {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #634530;
  border-bottom: 1px solid #ead2b2;
}

.notifications-empty {
  padding: 1rem;
  color: #72533d;
  font-size: 0.8rem;
}

.notifications-list {
  max-height: 240px;
  overflow-y: auto;
}

.notifications-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #ecd8be;
  background: #fffaf1;
}

.notifications-item:hover {
  background: #fff2df;
}

.notifications-item:last-child {
  border-bottom: none;
}

.notifications-item-title {
  color: #3f291b;
  font-size: 0.85rem;
  font-weight: 600;
}

.notifications-item-body {
  color: #674934;
  font-size: 0.78rem;
  margin-top: 0.15rem;
}

.notifications-item-date {
  color: #89684d;
  font-size: 0.7rem;
  margin-top: 0.35rem;
}

.notifications-view {
  margin-top: 0.45rem;
  font-size: 0.72rem;
  color: #4a2c1e;
  background: #f6e3c8;
  border: 1px solid #c99968;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  cursor: pointer;
}

.notifications-view:hover {
  background: #eacb9f;
}

.notifications-more {
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 0.8rem;
  color: #4a2c1e;
  background: #f4dfc1;
  border: none;
  border-top: 1px solid #dfbd93;
  cursor: pointer;
}

.notifications-more:hover {
  background: #eacb9f;
}

.notifications-list::-webkit-scrollbar { width: 8px; }
.notifications-list::-webkit-scrollbar-track { background: #fff4e5; }
.notifications-list::-webkit-scrollbar-thumb { background: #c79a6f; border-radius: 999px; }

.employee-topbar-btn {
  height: 40px;
  width: 40px;
  border-radius: 999px;
  border: 1px solid var(--ac-border, #ead2b2);
  background: var(--ac-surface, #fffdf9);
  color: var(--ac-primary, #2d1b13);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255, 241, 223, 0.05);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.employee-topbar-btn:hover {
  background: var(--ac-surface-muted, #f8ead4);
  color: var(--ac-primary, #2d1b13);
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
  background: var(--ac-success-bg, #e6f1e8);
  border: 1px solid #abd4b5;
  color: var(--ac-success, #39734a);
}

.badge-expired {
  background: rgba(248, 113, 113, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #ffd3d3;
}

.badge-neutral {
  background: var(--ac-surface-soft, #fff7ec);
  border: 1px solid var(--ac-border, #ead2b2);
  color: var(--ac-text-secondary, #624733);
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
