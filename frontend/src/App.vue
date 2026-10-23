<template>
  <div
    class="aestheticare-app"
    :class="{
      'read-only-mode': (isReadOnly || isSuspended) && !isSubscriptionRoute,
      'system-admin-route': isSystemAdminRoute,
      'landing-route': isLandingRoute,
    }"
  >
    <div>
      <EmployeeTopbar
        v-if="showEmployeeTopbar && !isClinicOnboardingRoute"
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
      <!-- Keep Account Settings mounted while its tab query changes. A fullPath
           key tears down the entire page for ?tab=notifications and causes a
           visible flash before the notification listener reconnects. Other
           routes retain their existing query-driven remount behavior. -->
      <router-view :key="($route.name === 'register-clinic' || $route.name === 'register-clinic-step') ? 'register-clinic' : ($route.path === '/customer/account-settings' ? $route.path : $route.fullPath)" />
      <Analytics />
      <OnboardingTour
        :is-open="onboardingIsOpen"
        :tour="onboardingTour"
        :step="onboardingStep"
        :step-index="onboardingStepIndex"
        :is-last-step="onboardingIsLastStep"
        :dont-show-again="onboardingDontShowAgain"
        :panel-key="sidebarPanelKey"
        @close="onboardingClose"
        @next="onboardingNext"
        @previous="onboardingPrevious"
        @update:dont-show-again="setOnboardingDontShowAgain"
      />
    </div>

    <div
      v-if="isExpired"
      class="readonly-exempt fixed left-1/2 top-4 z-[9997] -translate-x-1/2 rounded-full border border-amber-500/50 bg-[#2a170d] px-4 py-2 text-xs text-amber-200 shadow-xl"
    >
      <span v-if="isInGracePeriod">Subscription expired. Access is read-only until {{ graceEndsAtDisplay }}.</span>
      <span v-else>Subscription grace period ended. Please renew your subscription to regain access.</span>
    </div>

    <AppLoadingScreen v-if="isLoading || processLoading" :label="processLoading ? processLabel : 'Preparing your experience...'" />

    <div v-if="inactivityWarning" class="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="inactivity-title">
      <section class="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-slate-800 shadow-2xl shadow-slate-950/20">
        <p class="text-xs font-semibold uppercase tracking-widest text-amber-700">Session timeout</p>
        <h2 id="inactivity-title" class="mt-2 text-xl font-semibold text-slate-900">You will be signed out soon</h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-600">There has been no activity for almost 15 minutes. Select Continue session to remain signed in.</p>
        <div class="mt-5 flex justify-end"><button class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2" @click="continueSession">Continue session</button></div>
      </section>
    </div>

    <div
      v-if="showConnectionModal"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-[#140b06]/70 p-4 backdrop-blur-[6px]"
    >
      <div class="connection-modal-shell w-full max-w-2xl overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-[#fff8ee] via-white to-[#fdf0db] shadow-[0_30px_80px_rgba(27,15,8,0.36)]">
        <div class="h-1.5 bg-gradient-to-r from-amber-500 via-gold-500 to-rose-300"></div>
        <div class="relative p-6 sm:p-8">
          <div class="absolute right-6 top-6 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl"></div>
          <div class="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-[#f1c27a]/20 blur-3xl"></div>
          <div class="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <div class="relative flex items-center justify-center">
              <div class="absolute inset-6 rounded-full bg-amber-100/65 blur-2xl"></div>
              <div class="relative flex h-48 w-48 items-center justify-center rounded-full border border-amber-200/80 bg-white/70 shadow-[0_16px_40px_rgba(111,63,42,0.12)]">
                <img
                  :src="disconnectIllustration"
                  alt="Connection issue"
                  class="h-40 w-40 object-contain drop-shadow-[0_10px_18px_rgba(69,40,18,0.16)]"
                />
              </div>
            </div>
            <div class="relative text-center md:text-left">
              <div class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 shadow-sm">
                <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                {{ isOnline ? 'Connection Slow' : 'Offline' }}
              </div>
              <h2 class="mt-4 text-3xl font-semibold tracking-tight text-charcoal-900 sm:text-4xl">
                {{ isOnline ? 'Holding on to your progress' : 'You are offline' }}
              </h2>
              <p class="mt-3 max-w-lg text-base leading-relaxed text-charcoal-700">
                {{ connectionMessage || 'We are checking your connection.' }}
              </p>
              <p class="mt-3 text-sm text-charcoal-500">
                This screen will close automatically once the connection is stable again.
              </p>
              <div class="mt-6 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <span class="rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-charcoal-700">Secure session</span>
                <span class="rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-charcoal-700">Auto-retry enabled</span>
                <span class="rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium text-charcoal-700">No action needed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Analytics } from '@vercel/analytics/vue'
import { useAuth } from '@/composables/useAuth'
import { useSubscription } from '@/composables/useSubscription'
import EmployeeTopbar from '@/components/common/EmployeeTopbar.vue'
import disconnectIllustration from '@/assets/disconnect.png'
import { lockPageScroll, unlockPageScroll } from '@/utils/scrollLock'
import { useSidebarState } from '@/composables/useSidebarState'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import OnboardingTour from '@/components/common/OnboardingTour.vue'
import AppLoadingScreen from '@/components/common/AppLoadingScreen.vue'

// Initialize auth state globally
const { isLoading, user, inactivityWarning, initAuth, startInactivityTracking, stopInactivityTracking, continueSession } = useAuth()

const route = useRoute()
const isClinicOnboardingRoute = computed(() => String(route.path || '').toLowerCase() === '/clinic/onboarding')
const isSystemAdminRoute = computed(() => String(route.path || '').toLowerCase().startsWith('/superadmin/'))
const {
  isOpen: onboardingIsOpen,
  tour: onboardingTour,
  step: onboardingStep,
  stepIndex: onboardingStepIndex,
  isLastStep: onboardingIsLastStep,
  dontShowAgain: onboardingDontShowAgain,
  close: onboardingClose,
  next: onboardingNext,
  previous: onboardingPrevious,
  setDontShowAgain: setOnboardingDontShowAgain,
} = useOnboardingTour({ route, user })
const { initSubscription, isReadOnly, isExpired, isSuspended, graceEndsAt, activePlan } = useSubscription()
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const isPoorConnection = ref(false)

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
  // The shared employee dashboard is served from /workspace, not /employee.
  // Keep its global overlays (including the onboarding tooltip) on the employee theme.
  if (path.startsWith('/workspace')) return 'employee'
  if (path.startsWith('/employee')) return 'employee'
  if (path.startsWith('/manager')) return 'manager'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/receptionist')) return 'receptionist'
  if (path.startsWith('/practitioner')) return 'practitioner'
  if (path.startsWith('/cashier')) return 'cashier'
  if (path.startsWith('/supplier')) return 'supplier'
  if (path.startsWith('/supply')) return 'supply'
  if (path.startsWith('/owner') || path.startsWith('/clinic')) return 'owner'
  if (path.startsWith('/customer')) return 'customer'
  return ''
})

const { collapsed: sidebarCollapsed, syncFromStorage: syncSidebarFromStorage } = useSidebarState(sidebarPanelKey)

const showEmployeeTopbar = computed(() => {
  const path = String(route.path || '').toLowerCase()
  if (path.startsWith('/clinic/register') || path.startsWith('/customer-app/')) return false
  return (
    path.startsWith('/workspace') ||
    path.startsWith('/clinic') ||
    path.startsWith('/clinical') ||
    path.startsWith('/employee') ||
    path.startsWith('/manager') ||
    path.startsWith('/hr') ||
    path.startsWith('/finance') ||
    path.startsWith('/receptionist') ||
    path.startsWith('/practitioner') ||
    path.startsWith('/cashier') ||
    path.startsWith('/supply') ||
    path.startsWith('/owner') ||
    path.startsWith('/operations') ||
    path.startsWith('/catalog') ||
    path.startsWith('/crm') ||
    path.startsWith('/management') ||
    path.startsWith('/account') ||
    path.startsWith('/activities') ||
    path.startsWith('/appointments') ||
    path.startsWith('/inventory') ||
    path.startsWith('/procurement') ||
    path.startsWith('/logistics') ||
    path.startsWith('/customer')
  )
})

const topbarTitle = computed(() => {
  const path = String(route.path || '').toLowerCase()
  if (path.startsWith('/clinic')) return 'Clinic Administration'
  if (path.startsWith('/clinical')) return 'Clinical Workspace'
  if (path.startsWith('/hr')) return 'Human Resources'
  if (path.startsWith('/operations')) return 'Operations'
  if (path.startsWith('/catalog')) return 'Services'
  if (path.startsWith('/crm')) return 'Client Management'
  if (path.startsWith('/finance')) return 'Finance'
  if (path.startsWith('/management')) return 'Management'
  if (path.startsWith('/inventory') || path.startsWith('/procurement') || path.startsWith('/logistics') || path.startsWith('/supply')) return 'Supply Management'
  if (path.startsWith('/account')) return 'Account'
  if (path.startsWith('/owner')) return 'Clinic Administration'
  if (path.startsWith('/customer')) return ''
  return 'Clinic Workspace'
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

// The landing page is the visual reference for the product. Keeping this
// marker at the application boundary lets the shared stylesheet apply the
// same system to every other route without flattening the landing artwork.
const isLandingRoute = computed(() => String(route.path || '') === '/')
let connectionHandler = null
let processHandler = null
const processLoading = ref(false)
const processLabel = ref('Processing...')

// Determine if current route is subscription-related (so read-only is exempted)
const isSubscriptionRoute = computed(() => {
  const path = String(route.path || '').toLowerCase()
  return path.startsWith('/account/subscription') ||
         path.startsWith('/account/plans') ||
         path.startsWith('/subscription')
})

// Check if we're still within the grace period (7 days after expiry)
const isInGracePeriod = computed(() => {
  if (!graceEndsAt.value) return false
  const now = new Date()
  return now.getTime() <= graceEndsAt.value.getTime()
})

onMounted(() => {
  initAuth()
  initSubscription()
  updateConnectionStatus()
  window.addEventListener('online', updateConnectionStatus)
  window.addEventListener('offline', updateConnectionStatus)
  syncSidebarFromStorage()

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
  (nextKey, prevKey) => {
    if (!nextKey || nextKey === prevKey) return
    syncSidebarFromStorage()
  },
  { immediate: true }
)

watch(
  () => showConnectionModal.value,
  (isOpen) => {
    if (isOpen) {
      try {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          lockPageScroll()
        }
      } catch (_e) {
        lockPageScroll()
      }
    } else {
      unlockPageScroll()
    }
  }
)

// ── Track user auth state to start/stop inactivity timer ──────────────
watch(
  () => user.value?.uid || null,
  (nextUid, prevUid) => {
    if (nextUid && !prevUid) {
      // User just logged in — start tracking
      startInactivityTracking()
    } else if (!nextUid && prevUid) {
      // User just logged out — stop tracking
      stopInactivityTracking()
    }
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
  if (processHandler) {
    window.removeEventListener('app-process-loading', processHandler)
  }
  if (showConnectionModal.value) {
    unlockPageScroll()
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
  if (raw.includes('free')) return 'FreePlan'
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
  cursor: default;
}

/* Keep data read-only but never show the "not-allowed" stop-sign cursor */
.read-only-mode,
.read-only-mode * {
  cursor: default !important;
}

.read-only-mode .readonly-exempt,
.read-only-mode .readonly-exempt * {
  pointer-events: auto !important;
}

</style>
