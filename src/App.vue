<template>
  <div :class="{ 'read-only-mode': isReadOnly }">
    <div>
      <EmployeeTopbar
        v-if="showEmployeeTopbar"
        :title="topbarTitle"
        :plan-label="planLabel"
        :is-expired="isExpired"
        :sidebar-collapsed="sidebarCollapsed"
        :panel-key="sidebarPanelKey"
        :badge-label="customerTopbarLabel"
        :badge-tone="customerTopbarTone"
        :badge-variant="customerTopbarVariant"
        :show-badge-status="showTopbarStatus"
      />
      <router-view :key="$route.fullPath" />
    </div>
    <div
      v-if="isExpired"
      class="readonly-exempt fixed left-1/2 top-4 z-[9997] -translate-x-1/2 rounded-full border border-amber-500/50 bg-[#2a170d] px-4 py-2 text-xs text-amber-200 shadow-xl"
    >
      Subscription expired. Access is read-only
      <span v-if="graceEndsAt"> until {{ graceEndsAtDisplay }}.</span>
    </div>
  </div>

  <div v-if="isLoading" class="fixed inset-0 z-[9998] bg-[#0f0a07]">
    <div v-if="isPublicSkeleton" class="flex h-full w-full items-center justify-center px-6">
      <div class="w-full max-w-3xl animate-pulse space-y-6">
        <div class="mx-auto h-7 w-40 rounded-full bg-[#3a2417]"></div>
        <div class="h-10 w-3/4 rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
        <div class="h-10 w-full rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
        <div class="h-10 w-full rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
        <div class="h-12 w-40 rounded-2xl bg-[#3a2417]"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <div class="h-32 rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
          <div class="h-32 rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
        </div>
      </div>
    </div>
    <div v-else class="flex h-full w-full">
      <div class="hidden md:flex w-[18rem] p-4">
        <div class="w-full rounded-2xl border border-[#3a2417] bg-[#1f120b] p-4 shadow-2xl">
          <div class="animate-pulse space-y-4">
            <div class="h-5 w-24 rounded bg-[#3a2417]"></div>
            <div class="h-3 w-32 rounded bg-[#3a2417]"></div>
            <div class="space-y-2 pt-2">
              <div class="h-10 rounded-lg bg-[#3a2417]"></div>
              <div class="h-10 rounded-lg bg-[#3a2417]"></div>
              <div class="h-10 rounded-lg bg-[#3a2417]"></div>
              <div class="h-10 rounded-lg bg-[#3a2417]"></div>
              <div class="h-10 rounded-lg bg-[#3a2417]"></div>
            </div>
            <div class="mt-6 h-12 rounded-lg bg-[#150d08] border border-[#3a2417]"></div>
          </div>
        </div>
      </div>
      <div class="flex-1 p-6 md:p-10">
        <div class="animate-pulse space-y-6">
          <div class="h-8 w-56 rounded bg-[#3a2417]"></div>
          <div class="h-4 w-72 rounded bg-[#3a2417]"></div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="h-28 rounded-xl bg-[#20130c] border border-[#3a2417]"></div>
            <div class="h-28 rounded-xl bg-[#20130c] border border-[#3a2417]"></div>
            <div class="h-28 rounded-xl bg-[#20130c] border border-[#3a2417]"></div>
          </div>
          <div class="h-64 rounded-2xl bg-[#20130c] border border-[#3a2417]"></div>
        </div>
      </div>
    </div>
  </div>

  <div
    class="global-loader"
    :class="{ 'is-active': processLoading }"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="loader"></div>
    <p class="loader-label">{{ processLabel }}</p>
  </div>

  <div
    v-if="showConnectionModal"
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
  >
    <div class="w-full max-w-md rounded-3xl border border-amber-500/50 bg-[#1b0f08] p-8 shadow-2xl">
      <div class="flex flex-col items-center text-center gap-6">
        <img
          :src="disconnectIllustration"
          alt="Connection issue"
          class="w-64 h-64 object-contain"
        />
        <div>
          <h2 class="text-white text-3xl font-semibold tracking-wide">Oops...</h2>
          <p class="text-amber-200/90 text-base mt-3 leading-relaxed">
            Network connection is slow or unstable. This message will disappear once the network is restored.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useSubscription } from '@/composables/useSubscription'
import EmployeeTopbar from '@/components/common/EmployeeTopbar.vue'
import disconnectIllustration from '@/assets/disconnect.png'

// Initialize auth state globally
const { isLoading, user, initAuth } = useAuth()

const route = useRoute()
const { initSubscription, isReadOnly, isExpired, graceEndsAt, activePlan } = useSubscription()
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const isPoorConnection = ref(false)
const sidebarCollapsed = ref(false)

const showConnectionModal = ref(false)
const connectionIssueSince = ref(null)
let connectionShowTimer = null
let connectionHideTimer = null

const updateConnectionStatus = () => {
  isOnline.value = typeof navigator !== 'undefined' ? navigator.onLine : true

  const connection = typeof navigator !== 'undefined' ? navigator.connection || navigator.mozConnection || navigator.webkitConnection : null
  if (!connection) {
    isPoorConnection.value = false
  } else {
    const effectiveType = String(connection.effectiveType || '').toLowerCase()
    const downlink = Number(connection.downlink || 0)
    const rtt = Number(connection.rtt || 0)

    const slowType = effectiveType === 'slow-2g' || effectiveType === '2g'
    const slowDownlink = downlink > 0 && downlink < 0.8
    const highRtt = rtt > 3000

    isPoorConnection.value = slowType || slowDownlink || highRtt
  }

  const hasIssue = !isOnline.value || isPoorConnection.value

  if (hasIssue) {
    if (!connectionIssueSince.value) {
      connectionIssueSince.value = Date.now()
    }
    if (connectionHideTimer) {
      clearTimeout(connectionHideTimer)
      connectionHideTimer = null
    }
    if (!connectionShowTimer) {
      connectionShowTimer = setTimeout(() => {
        showConnectionModal.value = true
        connectionShowTimer = null
      }, 1500)
    }
  } else {
    connectionIssueSince.value = null
    if (connectionShowTimer) {
      clearTimeout(connectionShowTimer)
      connectionShowTimer = null
    }
    if (showConnectionModal.value) {
      if (connectionHideTimer) {
        clearTimeout(connectionHideTimer)
      }
      connectionHideTimer = setTimeout(() => {
        showConnectionModal.value = false
        connectionHideTimer = null
      }, 800)
    }
  }
}

const connectionMessage = computed(() => {
  if (!isOnline.value) return 'You appear to be offline.'
  if (isPoorConnection.value) return 'Your connection looks slow or unstable.'
  return ''
})

const sidebarPanelKey = computed(() => {
  const path = String(route.path || '').toLowerCase()
  if (path.startsWith('/employee')) return 'employee'
  if (path.startsWith('/manager')) return 'manager'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/receptionist')) return 'receptionist'
  if (path.startsWith('/practitioner')) return 'practitioner'
  if (path.startsWith('/cashier')) return 'cashier'
  if (path.startsWith('/supply')) return 'supply'
  if (path.startsWith('/owner')) return 'owner'
  if (path.startsWith('/customer')) return 'customer'
  return ''
})

const showEmployeeTopbar = computed(() => {
  const path = String(route.path || '').toLowerCase()
  return (
    path.startsWith('/employee') ||
    path.startsWith('/manager') ||
    path.startsWith('/hr') ||
    path.startsWith('/finance') ||
    path.startsWith('/receptionist') ||
    path.startsWith('/practitioner') ||
    path.startsWith('/cashier') ||
    path.startsWith('/supply') ||
    path.startsWith('/owner') ||
    path.startsWith('/customer')
  )
})

const topbarTitle = computed(() => {
  const path = String(route.path || '').toLowerCase()
  if (path.startsWith('/owner')) return ''
  if (path.startsWith('/customer')) return ''
  if (path.startsWith('/employee')) return 'Employee Panel'
  return 'Employee Panel'
})

const isCustomerPanel = computed(() => String(route.path || '').toLowerCase().startsWith('/customer'))

const customerTopbarLabel = computed(() => {
  if (!isCustomerPanel.value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date())
  } catch (_error) {
    return ''
  }
})

const customerTopbarTone = computed(() => (isCustomerPanel.value ? 'neutral' : ''))
const customerTopbarVariant = computed(() => (isCustomerPanel.value ? 'date' : 'plan'))
const showTopbarStatus = computed(() => !isCustomerPanel.value && isExpired.value)
const isPublicSkeleton = computed(() => {
  const path = String(route.path || '').toLowerCase()
  if (path === '/') return true
  if (path.startsWith('/login')) return true
  if (path.startsWith('/register')) return true
  if (path.startsWith('/clinic/register')) return true
  if (path.startsWith('/forgot-password')) return true
  if (path.startsWith('/centers')) return true
  if (path.startsWith('/subscription')) return true
  if (path.startsWith('/map-test')) return true
  if (path.startsWith('/test')) return true
  return false
})
let connectionHandler = null
let sidebarHandler = null
let processHandler = null
const processLoading = ref(false)
const processLabel = ref('Processing...')

onMounted(() => {
  initAuth()
  initSubscription()
  updateConnectionStatus()
  window.addEventListener('online', updateConnectionStatus)
  window.addEventListener('offline', updateConnectionStatus)
  const key = sidebarPanelKey.value ? `sidebar:${sidebarPanelKey.value}:collapsed` : ''
  if (key) {
    sidebarCollapsed.value = localStorage.getItem(key) === '1'
  }

  sidebarHandler = (event) => {
    const detail = event?.detail || {}
    if (!detail.panelKey) return
    if (detail.panelKey === sidebarPanelKey.value) {
      sidebarCollapsed.value = Boolean(detail.collapsed)
    }
  }
  window.addEventListener('sidebar-collapsed-change', sidebarHandler)

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (connection) {
    connectionHandler = () => updateConnectionStatus()
    connection.addEventListener('change', connectionHandler)
  }

  processHandler = (event) => {
    if (typeof event?.detail?.active === 'boolean') {
      processLoading.value = event.detail.active
      if (event.detail.active) {
        processLabel.value = String(event?.detail?.label || 'Processing...')
      } else {
        processLabel.value = 'Processing...'
      }
    }
  }
  window.addEventListener('app-process-loading', processHandler)
})

watch(
  () => user.value?.uid || null,
  (nextUserId, prevUserId) => {
    if (nextUserId !== prevUserId) {
      initSubscription()
    }
  }
)

watch(
  () => sidebarPanelKey.value,
  (nextKey) => {
    if (!nextKey) return
    sidebarCollapsed.value = localStorage.getItem(`sidebar:${nextKey}:collapsed`) === '1'
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('online', updateConnectionStatus)
  window.removeEventListener('offline', updateConnectionStatus)
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (connection && connectionHandler) {
    connection.removeEventListener('change', connectionHandler)
  }
  if (connectionShowTimer) {
    clearTimeout(connectionShowTimer)
    connectionShowTimer = null
  }
  if (connectionHideTimer) {
    clearTimeout(connectionHideTimer)
    connectionHideTimer = null
  }
  if (sidebarHandler) {
    window.removeEventListener('sidebar-collapsed-change', sidebarHandler)
  }
  if (processHandler) {
    window.removeEventListener('app-process-loading', processHandler)
  }
})

const graceEndsAtDisplay = computed(() => {
  if (!graceEndsAt.value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(graceEndsAt.value)
  } catch (_error) {
    return graceEndsAt.value?.toString?.() || ''
  }
})

const planLabel = computed(() => {
  const raw = String(activePlan.value || '').trim().toLowerCase()
  if (!raw) return 'Plan'
  if (raw.includes('free')) return 'Free Trial'
  if (raw.includes('basic')) return 'Basic'
  if (raw.includes('premium')) return 'Premium'
  return activePlan.value
})
</script>

<style>
.read-only-mode button,
.read-only-mode input,
.read-only-mode select,
.read-only-mode textarea,
.read-only-mode [contenteditable="true"] {
  pointer-events: none;
  opacity: 0.75;
  cursor: not-allowed;
}

.read-only-mode .readonly-exempt,
.read-only-mode .readonly-exempt * {
  pointer-events: auto !important;
}

.global-loader {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1f120b;
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.45s ease, opacity 0.45s ease;
}

.global-loader.is-active {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.loader {
  width: 120px;
  aspect-ratio: 1;
  border: 14px solid #0000;
  box-sizing: border-box;
  background:
    radial-gradient(farthest-side, #fff 98%, #0000) 0 0/30px 30px,
    radial-gradient(farthest-side, #fff 98%, #0000) 100% 0/30px 30px,
    radial-gradient(farthest-side, #fff 98%, #0000) 100% 100%/30px 30px,
    radial-gradient(farthest-side, #fff 98%, #0000) 0 100%/30px 30px,
    linear-gradient(#fff 0 0) 50%/60px 60px;
  background-repeat: no-repeat;
  filter: blur(4px) contrast(10);
  animation: l12 0.8s infinite;
}

.loader-label {
  margin-top: 1.25rem;
  color: #f3e7e0;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

@keyframes l12 {
  100% {
    background-position: 100% 0, 100% 100%, 0 100%, 0 0, center;
  }
}
</style>
