<template>
  <div
    :style="containerStyle"
    :class="['relative flex-shrink-0 self-stretch', isSmallScreen ? 'w-0' : '', enableTransitions ? 'transition-all duration-300' : '']"
  >
    <button
      v-if="isSmallScreen && mobileDrawer && !mobileDrawerOpen"
      ref="mobileMenuTrigger"
      type="button"
      class="customer-mobile-menu-trigger fixed left-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-[#765039] bg-[#2a180f] text-[#f3e7e0] shadow-lg transition-colors duration-200 hover:bg-[#3a2417] hover:text-white"
      aria-label="Open navigation menu"
      aria-controls="customer-sidebar-panel"
      aria-expanded="false"
      title="Open menu"
      @click="openMobileSidebar"
    >
      <Icon icon="mdi:menu" class="h-5 w-5" />
    </button>

    <div
      v-if="isSmallScreen && mobileDrawer && mobileDrawerOpen"
      class="fixed inset-0 z-[59] cursor-default bg-[#160d08]/60 backdrop-blur-[2px]"
      aria-hidden="true"
      @click="closeSidebar"
    ></div>

    <button
      v-if="isSmallScreen && collapsed && !mobileDrawer"
      type="button"
      class="fixed left-0 top-24 z-50 flex h-12 w-12 items-center justify-center rounded-r-xl border border-[#5a3927] bg-[#2a180f] text-[#f3e7e0] shadow-2xl transition-colors duration-200 hover:bg-[#3a2417] hover:text-white"
      aria-label="Open sidebar"
      title="Open sidebar"
      @click="toggleCollapsed"
    >
      <Icon icon="mdi:chevron-right" class="h-5 w-5" />
    </button>

    <aside
      ref="sidebarPanel"
      :id="mobileDrawer ? 'customer-sidebar-panel' : undefined"
      :style="asideStyle"
      :inert="isSmallScreen && mobileDrawer && !mobileDrawerOpen"
      :class="[
        'app-sidebar readonly-exempt z-40 h-full bg-[#1f120b] border border-[#3a2417] rounded-tr-2xl rounded-br-2xl shadow-2xl flex flex-col overflow-hidden',
        enableTransitions ? 'transition-all duration-300' : ''
      ]"
    >
      <div class="p-4 border-b border-[#3a2417]">
        <div class="flex items-start gap-3">
          <template v-if="showSkeleton">
            <div class="h-10 w-10 rounded-lg border border-[#5a3927] bg-[#3a2417] animate-pulse"></div>
            <div v-if="!sidebarCollapsed" class="min-w-0 flex-1 space-y-2">
              <div class="h-4 w-28 rounded bg-[#3a2417] animate-pulse"></div>
              <div class="h-3 w-20 rounded bg-[#3a2417] animate-pulse"></div>
            </div>
          </template>
          <template v-else>
            <div v-if="!sidebarCollapsed" class="min-w-0 flex-1">
              <h2 class="text-white font-semibold text-lg truncate">{{ title }}</h2>
              <p class="text-[#c9b3a5] text-xs truncate">{{ subtitle }}</p>
            </div>
            <div v-else class="flex-1"></div>
          </template>
        </div>

        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#5a3927] bg-[#2a180f] px-3 py-2 text-sm font-semibold text-[#f3e7e0] transition-colors duration-200 hover:bg-[#3a2417] hover:text-white"
          :class="sidebarCollapsed ? 'px-2' : ''"
          :title="isSmallScreen && mobileDrawer ? 'Close menu' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-label="isSmallScreen && mobileDrawer ? 'Close menu' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleCollapsed"
        >
          <Icon
            :icon="isSmallScreen && mobileDrawer ? 'mdi:close' : sidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
            class="h-4 w-4"
          />
          <span v-if="!sidebarCollapsed">{{ isSmallScreen && mobileDrawer ? 'Close menu' : 'Collapse sidebar' }}</span>
        </button>
      </div>

      <nav ref="sidebarNav" :data-onboarding-key="panelKey === 'owner' ? 'owner-sidebar-nav' : undefined" class="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-3">
      <ul v-if="showSkeleton" class="space-y-2">
        <li v-for="index in skeletonCount" :key="index">
          <div
            :class="[
              'flex items-center rounded-lg border border-[#3a2417] bg-[#2a180f]',
              sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5'
            ]"
          >
            <div class="h-8 w-8 rounded-lg border border-[#5a3927] bg-[#3a2417] animate-pulse"></div>
            <div v-if="!sidebarCollapsed" class="flex-1">
              <div class="h-3 w-24 rounded bg-[#3a2417] animate-pulse"></div>
            </div>
          </div>
        </li>
      </ul>
      <ul v-else class="space-y-1">
        <li v-for="item in visibleItems" :key="item.key || item.to || item.label" class="relative">
          <template v-if="isGroup(item)">
            <button
              @click="toggleGroup(item)"
              :data-onboarding-key="item.tourKey || undefined"
              :class="[
                'group relative w-full flex items-center rounded-lg transition-colors duration-200',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5',
                item.locked
                  ? 'text-[#b99b88] bg-[#24160f]'
                  : 'text-[#e8d8cf] hover:text-white hover:bg-[#3a2417]'
              ]"
              :title="sidebarCollapsed ? item.lockTitle || item.label : item.lockTitle || ''"
            >
                <span
                :class="[
                  'h-8 w-8 rounded-lg border flex items-center justify-center',
                  'bg-[#3a2417] border-[#5a3927] text-[#f3e7e0]'
                ]"
              >
                <Icon :icon="item.locked ? 'mdi:lock-outline' : iconName(item.icon)" class="w-4 h-4" />
              </span>
              <span v-if="!sidebarCollapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              <Icon
                v-if="!sidebarCollapsed && item.locked"
                icon="mdi:lock-outline"
                class="w-4 h-4 text-amber-300"
              />
              <svg
                v-if="!sidebarCollapsed"
                class="w-4 h-4 ml-auto transition-transform duration-200"
                :class="isGroupOpen(item) ? 'rotate-90' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span
                v-if="sidebarCollapsed"
                class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[#3a2417] border border-[#5a3927] text-[#f3e7e0] px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                {{ item.label }}
              </span>
            </button>

            <ul
              v-if="!sidebarCollapsed && isGroupOpen(item)"
              class="mt-1 space-y-1"
            >
              <li v-for="child in item.children" :key="child.key || child.to || child.label">
                <div
                  v-if="child.type === 'section'"
                  class="flex items-center gap-2 px-3 pt-4 pb-1"
                >
                  <span class="h-px flex-1 bg-[#4b3020]/80"></span>
                  <span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c9b3a5]">
                    {{ child.label }}
                  </span>
                  <span class="h-px flex-1 bg-[#4b3020]/80"></span>
                </div>
                <component
                  v-else
                  :is="child.locked ? 'button' : 'router-link'"
                  :to="child.locked ? undefined : child.to"
                  :aria-current-value="child.locked ? undefined : isExactActive(child.to) ? 'page' : 'false'"
                  :disabled="child.locked"
                  :data-onboarding-key="child.tourKey || undefined"
                  @click="handleItemNavigation"
                  :class="[
                    'group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200',
                    child.locked
                      ? 'w-full cursor-not-allowed text-[#9f8578] bg-[#24160f] opacity-80'
                      : isExactActive(child.to)
                      ? 'bg-[#8b5a3c] text-white'
                      : 'text-[#e8d8cf] hover:text-white hover:bg-[#3a2417]'
                  ]"
                  :title="child.lockTitle || ''"
                >
                  <span
                    :class="[
                      'h-7 w-7 rounded-lg border flex items-center justify-center',
                      child.locked
                        ? 'bg-[#2f1d13] border-[#5a3927] text-amber-300'
                        : isExactActive(child.to)
                        ? 'bg-[#9a6848] text-white border-[#9a6848]'
                        : 'bg-[#3a2417] border-[#5a3927] text-[#f3e7e0]'
                    ]"
                  >
                    <Icon :icon="child.locked ? 'mdi:lock-outline' : iconName(child.icon)" class="w-3.5 h-3.5" />
                  </span>
                  <span class="text-xs leading-5 truncate">{{ child.label }}</span>
                  <span v-if="child.locked" class="ml-auto text-[10px] uppercase tracking-[0.18em] text-amber-300">
                    Locked
                  </span>
                </component>
              </li>
            </ul>

            <!-- mobile submenu uses the same expanded in-flow accordion as desktop -->
          </template>

          <template v-else>
            <component
              :is="item.locked ? 'button' : 'router-link'"
              :to="item.locked ? undefined : item.to"
              :aria-current-value="item.locked ? undefined : isActive(item.to) ? 'page' : 'false'"
              :disabled="item.locked"
              :data-onboarding-key="item.tourKey || undefined"
              @click="handleItemNavigation"
              :class="[
                'group relative w-full flex items-center rounded-lg transition-colors duration-200',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5',
                item.locked
                  ? 'cursor-not-allowed text-[#9f8578] bg-[#24160f] opacity-80'
                  : isActive(item.to)
                  ? 'bg-[#6b3f27] text-white'
                  : 'text-[#e8d8cf] hover:text-white hover:bg-[#3a2417]'
              ]"
              :title="sidebarCollapsed ? item.lockTitle || item.label : item.lockTitle || ''"
            >
              <span
                :class="[
                  'relative h-8 w-8 rounded-lg border flex items-center justify-center',
                  item.locked
                    ? 'bg-[#2f1d13] border-[#5a3927] text-amber-300'
                    : isActive(item.to)
                    ? 'bg-[#8b5a3c] text-white border-[#8b5a3c]'
                    : 'bg-[#3a2417] border-[#5a3927] text-[#f3e7e0]'
                ]"
              >
                <Icon :icon="item.locked ? 'mdi:lock-outline' : iconName(item.icon)" class="w-4 h-4" />
              </span>
              <span v-if="!sidebarCollapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              <Icon
                v-if="!sidebarCollapsed && item.locked"
                icon="mdi:lock-outline"
                class="ml-auto w-4 h-4 text-amber-300"
              />
              <span
                v-else-if="!sidebarCollapsed && item.badge && Number(item.badge) > 0"
                class="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold leading-4 text-white"
              >
                {{ item.badge }}
              </span>
              <span
                v-if="sidebarCollapsed && item.badge && Number(item.badge) > 0"
                class="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white shadow"
              >
                {{ item.badge }}
              </span>
              <span
                v-if="sidebarCollapsed"
                class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[#3a2417] border border-[#5a3927] text-[#f3e7e0] px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                {{ item.label }}
              </span>
            </component>
          </template>
        </li>
      </ul>
    </nav>

      <div class="p-3 border-t border-[#3a2417]">
        <div
          class="flex items-center rounded-lg border border-[#3a2417] bg-[#150d08]"
          :class="sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'"
        >
          <template v-if="isLoading">
            <div class="h-9 w-9 rounded-full bg-[#3a2417] border border-[#5a3927] animate-pulse"></div>
            <div v-if="!sidebarCollapsed" class="min-w-0 flex-1 space-y-2">
              <div class="h-3 w-24 rounded bg-[#3a2417] animate-pulse"></div>
              <div class="h-3 w-32 rounded bg-[#3a2417] animate-pulse"></div>
            </div>
          </template>
          <template v-else>
            <div class="h-9 w-9 rounded-full bg-[#3a2417] border border-[#5a3927] text-white text-sm font-semibold flex items-center justify-center" :title="displayName">
              {{ userInitial }}
            </div>
            <div v-if="!sidebarCollapsed" class="min-w-0">
              <p class="text-white text-sm font-medium truncate">{{ displayName }}</p>
              <p class="text-[#c9b3a5] text-xs truncate">{{ displayEmail }}</p>
            </div>
          </template>
        </div>

        <div v-if="showSkeleton" class="mt-2">
          <div
            :class="[
              'w-full rounded-lg border border-[#5a3927] bg-[#2a180f] animate-pulse',
              sidebarCollapsed ? 'h-10' : 'h-10'
            ]"
          ></div>
        </div>
        <button
          v-else
          @click="logout"
          :class="[
            'readonly-exempt mt-2 w-full rounded-lg border border-[#5a3927] text-[#f0e2d8] hover:bg-[#3a2417] hover:text-white transition-colors',
            sidebarCollapsed ? 'h-10 flex items-center justify-center' : 'px-3 py-2 flex items-center gap-2 justify-center'
          ]"
          :title="sidebarCollapsed ? 'Logout' : ''"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span v-if="!sidebarCollapsed">Logout</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFirestore, collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { Icon } from '@iconify/vue'
import Swal from 'sweetalert2'
import { useAuth } from '@/composables/useAuth'
import { useSubscription } from '@/composables/useSubscription'
import { usePermissions } from '@/composables/usePermissions'
import { clearSidebarTransientState, useSidebarState } from '@/composables/useSidebarState'
import { sidebarRouteMatches } from '@/utils/sidebarRouteMatch'
import { NOTIFICATION_READ_STATE_EVENT } from '@/utils/notificationState'
import { isSubscriptionRecoveryRoute } from '../../../../shared/subscriptionRecoveryRoutes.js'

export default {
  name: 'BaseCollapsibleSidebar',
  components: { Icon },
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    items: {
      type: Array,
      default: () => []
    },
    panelKey: { type: String, required: true },
    mobileDrawer: { type: Boolean, default: false },
    defaultName: { type: String, default: 'User' },
    defaultEmail: { type: String, default: 'user@aestheticare.com' }
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const db = getFirestore()
    const auth = getAuth()
    const { isLoading, logout: logoutSession } = useAuth()
    const { hasFeature, initSubscription, activePlan, isSuspended, isLoading: subscriptionLoading } = useSubscription()
    const { hasPermission, effectivePermissions, loading: permissionsLoading, userRole } = usePermissions()

    const enableTransitions = ref(false)
    const lastVisibleItems = ref([])
    const groupStorageKey = `sidebar:${props.panelKey}:groups`
    const isSmallScreen = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false)
    const mobileDrawerOpen = ref(false)
    const wasSmallScreen = ref(false)
    const userStorageKey = `sidebar:${props.panelKey}:user`
    const displayName = ref(props.defaultName)
    const displayEmail = ref(props.defaultEmail)
    const openGroups = ref({})
    const sidebarPanel = ref(null)
    const mobileMenuTrigger = ref(null)
    const sidebarNav = ref(null)
    const sidebarScrollStorageKey = `sidebar:${props.panelKey}:scroll-top`
    const notificationsUnread = ref(0)
    const notificationsRoleKey = ref('')
    let unsubscribeNotificationsUser = null
    let unsubscribeNotificationsRole = null
    let notificationReadStateHandler = null
    const notificationsUserCache = ref([])
    const notificationsRoleCache = ref([])
    const { collapsed, toggleCollapsed: toggleSidebarCollapsed, syncFromStorage } = useSidebarState(() => props.panelKey)
    const sidebarCollapsed = computed(() => isSmallScreen.value && props.mobileDrawer ? false : collapsed.value)

    const userInitial = computed(() => {
      const source = String(displayName.value || '').trim()
      return source ? source.charAt(0).toUpperCase() : 'U'
    })

    const containerStyle = computed(() => {
      if (isSmallScreen.value) {
        return { width: '0px' }
      }
      return { width: collapsed.value ? '5rem' : '17rem' }
    })

    const asideStyle = computed(() => {
      if (isSmallScreen.value) {
        if (props.mobileDrawer) {
          if (!mobileDrawerOpen.value) {
            return {
              position: 'fixed',
              left: '0',
              top: '0',
              width: '0px',
              height: '0px',
              minHeight: '0px',
              opacity: '0',
              pointerEvents: 'none',
              transform: 'translateX(-100%)',
              zIndex: 60
            }
          }

          return {
            position: 'fixed',
            left: '0',
            top: '0',
            width: 'min(18rem, calc(100vw - 1rem))',
            height: '100vh',
            minHeight: '0px',
            maxHeight: '100dvh',
            zIndex: 60
          }
        }

        if (collapsed.value) {
          return {
            position: 'fixed',
            left: '0',
            top: '0',
            width: '0px',
            height: '0px',
            minHeight: '0px',
            opacity: '0',
            pointerEvents: 'none',
            transform: 'translateX(-100%)',
            zIndex: 20
          }
        }

        return {
          position: 'fixed',
          left: '0',
          top: '0',
          width: collapsed.value ? '5rem' : '17rem',
          height: '100vh',
          minHeight: '0px',
          maxHeight: '100dvh',
          zIndex: 20
        }
      }
      return {
        position: 'fixed',
        left: '0',
        top: '0',
        width: collapsed.value ? '5rem' : '17rem',
        height: '100vh',
        minHeight: '100vh',
        zIndex: 40
      }
    })

    const isGroup = (item) => Array.isArray(item?.children) && item.children.length > 0

    const pruneEmptySections = (items = []) => {
      const pruned = []
      let pendingSection = null

      items.forEach((item) => {
        if (item?.type === 'section') {
          pendingSection = item
          return
        }

        if (pendingSection) {
          pruned.push(pendingSection)
          pendingSection = null
        }

        pruned.push(item)
      })

      return pruned
    }

    const getItemFeatures = (item) => {
      if (!item) return []
      if (Array.isArray(item.features)) return item.features
      if (item.feature) return [item.feature]
      return []
    }

    const getItemPermissions = (item) => {
      if (!item) {
        return { all: [], any: [] }
      }

      const allPermissions = Array.isArray(item.permissions)
        ? [...item.permissions]
        : item.permission
          ? [item.permission]
          : []

      const anyPermissions = Array.isArray(item.permissionsAny)
        ? [...item.permissionsAny]
        : item.permissionAny
          ? [item.permissionAny]
          : []

      if (item.to && !allPermissions.length && !anyPermissions.length) {
        const routeMatch = router.getRoutes().find((route) => route.path === item.to)
        if (routeMatch?.meta?.requiresPermission) {
          allPermissions.push(routeMatch.meta.requiresPermission)
        }
      }

      return { all: allPermissions, any: anyPermissions }
    }

      const isClinicSideRole = (roleValue) => {
      const compactRole = String(roleValue || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      return !['', 'customer', 'supplier', 'superadmin', 'systemadmin', 'guest'].includes(compactRole)
      }

      const isOwnerLike = (roleValue) => {
        const compactRole = String(roleValue || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
        return ['owner', 'clinicowner', 'clinicadmin', 'clinicadministrator'].includes(compactRole)
      }

      const isItemAllowed = (item) => {
      const required = getItemFeatures(item)
        const requiredPermissions = getItemPermissions(item)
        const currentRole = String(userRole.value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
        if (item?.ownerOnly && !isOwnerLike(currentRole)) return false
      const shouldApplySubscriptionRules = isClinicSideRole(currentRole)
      if (shouldApplySubscriptionRules && isSuspended.value && item?.to && !isSubscriptionRecoveryRoute(item.to)) return false
      const featureAllowed = !required.length || required.every((feature) => hasFeature(feature))
      const allowedPlans = Array.isArray(item?.plans) ? item.plans.map((plan) => String(plan || '').trim().toLowerCase()) : []
      const planAllowed = !allowedPlans.length || allowedPlans.includes(String(activePlan.value || '').trim().toLowerCase())
      const permissionAllowed =
        (!requiredPermissions.all.length || requiredPermissions.all.every((perm) => hasPermission(perm))) &&
        (!requiredPermissions.any.length || requiredPermissions.any.some((perm) => hasPermission(perm)))
      if (!shouldApplySubscriptionRules) {
        return permissionAllowed
      }
      return featureAllowed && planAllowed && permissionAllowed
    }

    const lockTitleForItem = (item) => {
      const features = getItemFeatures(item)
      if (features.length) {
        return 'Locked on the current plan. Upgrade your subscription to access this feature.'
      }
      return 'You do not have access to this item.'
    }

    const decorateItems = (items = [], inheritedLocked = false) =>
      items
        .map((item) => {
          if (item?.type === 'section') {
            return {
              ...item,
              isSection: true,
            }
          }

          const locked = inheritedLocked || !isItemAllowed(item)
          if (locked) {
            return null
          }

          const nextItem = {
            ...item,
          }

          if (isGroup(item)) {
            nextItem.children = pruneEmptySections(decorateItems(item.children || [], locked))
            const hasRenderableChild = Array.isArray(nextItem.children)
              && nextItem.children.some((child) => child?.type !== 'section')
            if (!hasRenderableChild) {
              return null
            }
          }

          return nextItem
        })
        .filter(Boolean)

    const withBadges = (items = []) =>
      items.map((item) => {
        const nextItem = {
          ...item,
          badge: item?.to === '/notifications' ? notificationsUnread.value : item.badge,
        }
        if (isGroup(item)) {
          nextItem.children = withBadges(item.children || [])
        }
        return nextItem
      })

    const hasVisibleChild = (item) =>
      !isGroup(item) || (
        Array.isArray(item.children) &&
        item.children.some((child) => child?.type !== 'section')
      )

    const visibleItems = computed(() => {
      activePlan.value
      subscriptionLoading.value
      effectivePermissions.value
      if (subscriptionLoading.value || permissionsLoading.value) {
        return lastVisibleItems.value.length ? lastVisibleItems.value : []
      }
      const decorated = withBadges(decorateItems(props.items)).filter(hasVisibleChild)
      lastVisibleItems.value = decorated
      return decorated
    })

    // Role edits arrive through Firestore role listeners. If access to the
    // page currently open is revoked, leave it immediately instead of
    // waiting for the next navigation to run the router guard again.
    watch(
      () => effectivePermissions.value.join('|'),
      () => {
        if (permissionsLoading.value) return
        const meta = route.meta || {}
        const requiredAll = [
          ...(meta.requiresPermission ? [meta.requiresPermission] : []),
          ...(Array.isArray(meta.requiresPermissionsAll) ? meta.requiresPermissionsAll : []),
        ]
        let requiredAny = Array.isArray(meta.requiresPermissionsAny) ? [...meta.requiresPermissionsAny] : []
        if (meta.requiresSupplyAccess) {
          const department = String(route.params.department || '').toLowerCase()
          const page = String(route.params.page || 'dashboard').toLowerCase()
          if ((department === 'inventory' && page === 'requests') || route.path === '/inventory/requests') {
            requiredAny = ['inventory:create', 'inventory:review']
          } else if (department === 'inventory' && ['onboarding', 'receiving'].includes(page)) {
            requiredAll.push('inventory:create')
          } else if (department === 'inventory' || route.path === '/inventory/requests') {
            requiredAll.push('inventory:view')
          } else if (department === 'procurement' || route.path === '/procurement/requests') {
            requiredAll.push('procurement:view')
          }
        }
        const permissionAlternates = {
          'inventory:review': ['inventory:create'],
          'orders:view': ['inventory:view'],
          'orders:update': ['inventory:update', 'inventory:review'],
        }
        const hasAll = requiredAll.every((permission) =>
          hasPermission(permission) || (permissionAlternates[permission] || []).some((alternate) => hasPermission(alternate))
        )
        const hasAny = !requiredAny.length || requiredAny.some((permission) => hasPermission(permission))
        if (hasAll && hasAny) return

        const dashboardTo = props.items.find((item) => item?.to)?.to || '/'
        if (route.path !== dashboardTo) void router.replace(dashboardTo)
      }
    )

    const sidebarLoading = computed(
      () => isLoading.value || subscriptionLoading.value || permissionsLoading.value
    )
    const showSkeleton = ref(false)
    let skeletonTimer = null
    const skeletonCount = computed(() => (sidebarCollapsed.value ? 7 : 8))

    const isActive = (target) => Boolean(target && sidebarRouteMatches(route, router.resolve(target)))
    const isExactActive = (target) => Boolean(target && sidebarRouteMatches(route, router.resolve(target), true))

    const isGroupActive = (group) => {
      if (!isGroup(group)) return false
      return group.children.some((child) => child?.type !== 'section' && child.to && isActive(child.to))
    }

    const groupKey = (group) => String(group.key || group.label || '')

    const normalizeOpenGroups = (groups) => {
      if (!groups || typeof groups !== 'object') return {}
      const firstOpenEntry = Object.entries(groups).find(([, value]) => value === true)
      return firstOpenEntry ? { [firstOpenEntry[0]]: true } : {}
    }

    const getActiveGroupKeys = (items = visibleItems.value) =>
      items
        .filter((item) => isGroup(item) && isGroupActive(item))
        .map((item) => groupKey(item))
        .filter(Boolean)

    const isGroupOpen = (group) => {
      const key = groupKey(group)
      return openGroups.value[key] === true || isGroupActive(group)
    }

    const persistGroups = () => {
      localStorage.setItem(groupStorageKey, JSON.stringify(openGroups.value))
    }

    const setExclusiveOpenGroups = (keys = []) => {
      const nextGroups = {}
      const firstKey = keys.find(Boolean)
      if (firstKey) {
        nextGroups[firstKey] = true
      }
      openGroups.value = nextGroups
      persistGroups()
    }

    const syncOpenGroupsToRoute = (fallbackGroups = openGroups.value) => {
      const [activeKey] = getActiveGroupKeys()
      if (activeKey) {
        setExclusiveOpenGroups([activeKey])
        return
      }

      openGroups.value = normalizeOpenGroups(fallbackGroups)
      persistGroups()
    }

    const toggleGroup = (group) => {
      const key = groupKey(group)
      if (!key) return

      if (sidebarCollapsed.value) {
        collapsed.value = false
        window.dispatchEvent(
          new CustomEvent('sidebar-collapsed-change', {
            detail: { panelKey: props.panelKey, collapsed: false }
          })
        )
        setExclusiveOpenGroups([key])
        return
      }

      if (isGroupOpen(group) && !isGroupActive(group)) {
        setExclusiveOpenGroups([])
        return
      }

      setExclusiveOpenGroups([key])
    }

    const toggleCollapsed = () => {
      if (isSmallScreen.value && props.mobileDrawer) {
        closeSidebar()
        return
      }
      toggleSidebarCollapsed()
      window.dispatchEvent(
        new CustomEvent('sidebar-collapsed-change', {
          detail: { panelKey: props.panelKey, collapsed: collapsed.value }
        })
      )
    }

    const closeSidebar = () => {
      if (isSmallScreen.value && props.mobileDrawer) {
        mobileDrawerOpen.value = false
        return
      }
      if (!isSmallScreen.value || collapsed.value) return
      collapsed.value = true
      window.dispatchEvent(
        new CustomEvent('sidebar-collapsed-change', {
          detail: { panelKey: props.panelKey, collapsed: true }
        })
      )
    }

    const openMobileSidebar = () => {
      if (isSmallScreen.value && props.mobileDrawer) mobileDrawerOpen.value = true
    }

    let previousBodyOverflow = null
    const syncMobileBodyScroll = (isOpen) => {
      if (typeof document === 'undefined') return
      if (isOpen) {
        if (previousBodyOverflow === null) previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      } else if (previousBodyOverflow !== null) {
        document.body.style.overflow = previousBodyOverflow
        previousBodyOverflow = null
      }
    }

    watch(
      () => isSmallScreen.value && props.mobileDrawer && mobileDrawerOpen.value,
      syncMobileBodyScroll
    )

    // The panel becomes inert when the mobile drawer closes. Move
    // focus out synchronously before Vue applies those attributes, then return
    // it to the menu trigger once that trigger is rendered.
    watch(
      () => isSmallScreen.value && props.mobileDrawer && !mobileDrawerOpen.value,
      (isHidden, wasHidden) => {
        if (!isHidden || wasHidden) return

        const activeElement = typeof document !== 'undefined' ? document.activeElement : null
        if (sidebarPanel.value?.contains(activeElement)) activeElement.blur?.()

        nextTick(() => {
          if (isSmallScreen.value && props.mobileDrawer && !mobileDrawerOpen.value) {
            mobileMenuTrigger.value?.focus({ preventScroll: true })
          }
        })
      },
      { flush: 'sync' }
    )

    let mobileEscapeHandler = null

    const handleItemNavigation = () => {
      saveSidebarScrollPosition()
      if (isSmallScreen.value) {
        closeSidebar()
      }
    }

    const saveSidebarScrollPosition = () => {
      if (!sidebarNav.value) return

      try {
        sessionStorage.setItem(sidebarScrollStorageKey, String(sidebarNav.value.scrollTop))
      } catch (_error) {
        // Scroll restoration is a convenience and must not affect navigation.
      }
    }

    const restoreSidebarScrollPosition = async () => {
      await nextTick()
      if (!sidebarNav.value) return

      let savedScrollTop = 0
      try {
        savedScrollTop = Number(sessionStorage.getItem(sidebarScrollStorageKey) || 0)
      } catch (_error) {
        return
      }

      if (!Number.isFinite(savedScrollTop) || savedScrollTop <= 0) return

      requestAnimationFrame(() => {
        if (sidebarNav.value) sidebarNav.value.scrollTop = savedScrollTop
      })
    }

    const localTagCheckIcon = {
      width: 24,
      height: 24,
      body: '<path d="M21.41 11.58 12.42 2.59A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .59 1.41l9 9a2 2 0 0 0 2.82 0l7-7a2 2 0 0 0 0-2.83ZM13 20l-9-9V4h7l9 9-7 7ZM6.5 8A1.5 1.5 0 1 0 6.5 5a1.5 1.5 0 0 0 0 3Zm3.8 4.2 1.4-1.4 1.7 1.7 3.9-3.9 1.4 1.4-5.3 5.3-3.1-3.1Z" fill="currentColor" />',
    }

    const iconName = (name) => {
      const key = String(name || '').toLowerCase()
      if (key.startsWith('mdi:')) return key
      const map = {
        card: 'mdi:credit-card-outline',
        'credit-card': 'mdi:credit-card-outline',
        'calendar-check': 'mdi:calendar-check-outline',
        'shield-account': 'mdi:shield-account-outline',
        lock: 'mdi:lock-outline',
        'chart-line': 'mdi:chart-line',
        receipt: 'mdi:receipt-text-outline',
        cog: 'mdi:cog-outline',
        home: 'mdi:home-outline',
        dashboard: 'mdi:view-dashboard-outline',
        building: 'mdi:office-building-outline',
        map: 'mdi:map-marker-outline',
        users: 'mdi:account-group-outline',
        userplus: 'mdi:account-plus-outline',
        usercheck: 'mdi:account-check-outline',
        calendar: 'mdi:calendar-month-outline',
        clipboard: 'mdi:clipboard-text-outline',
        box: 'mdi:package-variant-closed',
        truck: 'mdi:truck-outline',
        cart: 'mdi:cart-outline',
        tag: 'mdi:tag-outline',
        cash: 'mdi:cash-multiple',
        chart: 'mdi:chart-line',
        file: 'mdi:file-document-outline',
        inbox: 'mdi:inbox-arrow-down-outline',
        settings: 'mdi:cog-outline',
        clinic: 'mdi:medical-bag',
        idcard: 'mdi:card-account-details-outline',
        layout: 'mdi:view-dashboard-edit-outline',
        activity: 'mdi:pulse',
        archive: 'mdi:archive-outline',
        report: 'mdi:file-chart-outline',
        reportissue: 'mdi:bug-outline',
        help: 'mdi:help-circle-outline',
        shield: 'mdi:shield-check-outline',
        profile: 'mdi:account-circle-outline',
        bell: 'mdi:bell-outline',
        'account-off': 'mdi:account-off-outline',
        'tag-check': localTagCheckIcon,
        plus: 'mdi:plus-circle-outline',
        search: 'mdi:magnify',
        money: 'mdi:currency-usd',
        key: 'mdi:key-outline',
        qr: 'mdi:qrcode-scan',
        check: 'mdi:check-circle-outline',
        video: 'mdi:video-outline',
        clock: 'mdi:clock-outline'
      }

      return map[key] || 'mdi:circle-outline'
    }

    const loadCachedUserDetails = () => {
      try {
        const cached = JSON.parse(localStorage.getItem(userStorageKey) || '{}')
        if (cached?.name) displayName.value = cached.name
        if (cached?.email) displayEmail.value = cached.email
      } catch (_error) {
        // ignore cache parse errors
      }
    }

    const persistUserDetails = () => {
      localStorage.setItem(userStorageKey, JSON.stringify({ name: displayName.value, email: displayEmail.value }))
    }

    const loadUserDetails = async (user) => {
      if (!user) return
      displayEmail.value = user.email || displayEmail.value

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists()) return

      const data = userSnap.data()
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
      displayName.value = fullName || displayName.value
      displayEmail.value = data.email || displayEmail.value
      const rawRole = String(data.role || '').trim().toLowerCase()
      if (rawRole.includes('superadmin')) {
        notificationsRoleKey.value = 'Superadmin'
      } else if (rawRole.includes('clinic admin') || rawRole === 'clinicadmin' || rawRole === 'owner') {
        notificationsRoleKey.value = 'Owner'
      } else {
        notificationsRoleKey.value = String(data.role || '').trim()
      }
      startNotificationBadgeListener(user.uid, notificationsRoleKey.value, data.branchId || ((notificationsRoleKey.value) === 'Owner' ? user.uid : ''))
      persistUserDetails()
    }

    const updateNotificationsUnread = () => {
      const combined = [...notificationsUserCache.value, ...notificationsRoleCache.value]
      const map = new Map()
      combined.forEach((item) => {
        if (!item || !item.id) return
        if (map.has(item.id)) return
        map.set(item.id, item)
      })
      notificationsUnread.value = Array.from(map.values()).filter((item) => !item.read && !item.deleted).length
    }

    const applyNotificationReadState = (event) => {
      const { notificationId, read } = event?.detail || {}
      if (!notificationId) return
      const update = (item) => item.id === notificationId ? { ...item, read: Boolean(read) } : item
      notificationsUserCache.value = notificationsUserCache.value.map(update)
      notificationsRoleCache.value = notificationsRoleCache.value.map(update)
      updateNotificationsUnread()
    }

    const startNotificationBadgeListener = (userId, roleKey, branchId) => {
      if (!userId) return
      if (unsubscribeNotificationsUser) {
        unsubscribeNotificationsUser()
        unsubscribeNotificationsUser = null
      }
      if (unsubscribeNotificationsRole) {
        unsubscribeNotificationsRole()
        unsubscribeNotificationsRole = null
      }

      unsubscribeNotificationsUser = onSnapshot(
        query(collection(db, 'notifications'), where('recipientUserId', '==', userId)),
        (snapshot) => {
          notificationsUserCache.value = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          updateNotificationsUnread()
        }
      )

      if (roleKey && (branchId || roleKey === 'Superadmin')) {
        unsubscribeNotificationsRole = onSnapshot(
          query(collection(db, 'notifications'), where('recipientRole', '==', roleKey), ...(roleKey === 'Superadmin' ? [] : [where('branchId', '==', branchId)])),
          (snapshot) => {
            notificationsRoleCache.value = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            }))
            updateNotificationsUnread()
          }
        )
      } else {
        notificationsRoleCache.value = []
        updateNotificationsUnread()
      }
    }

    const logout = async () => {
      const result = await Swal.fire({
        title: 'Log out of your account?',
        text: 'You can sign in again at any time.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Log out',
        cancelButtonText: 'Stay signed in',
        customClass: {
          popup: 'swal-logout-popup',
          title: 'swal-logout-title',
          htmlContainer: 'swal-logout-text',
          icon: 'swal-logout-icon',
          confirmButton: 'swal-logout-confirm',
          cancelButton: 'swal-logout-cancel'
        },
        buttonsStyling: false
      })
      if (!result.isConfirmed) return

      openGroups.value = {}
      persistGroups()
      await logoutSession()
    }

    let unsubscribe = null
    let viewportHandler = null

    const syncCollapsedWithViewport = () => {
      const small = window.matchMedia('(max-width: 767px)').matches
      if (small !== wasSmallScreen.value && props.mobileDrawer) mobileDrawerOpen.value = false
      isSmallScreen.value = small
      if (small && !wasSmallScreen.value) {
        syncFromStorage()
        window.dispatchEvent(
          new CustomEvent('sidebar-collapsed-change', {
            detail: { panelKey: props.panelKey, collapsed: collapsed.value }
          })
        )
      }
      if (!small && wasSmallScreen.value) {
        syncFromStorage()
        window.dispatchEvent(
          new CustomEvent('sidebar-collapsed-change', {
            detail: { panelKey: props.panelKey, collapsed: collapsed.value }
          })
        )
      }
      wasSmallScreen.value = small
    }

    onMounted(async () => {
      requestAnimationFrame(() => {
        enableTransitions.value = true
      })
      loadCachedUserDetails()
      try {
        const parsed = JSON.parse(localStorage.getItem(groupStorageKey) || '{}')
        openGroups.value = normalizeOpenGroups(parsed)
      } catch (_error) {
        openGroups.value = {}
      }

      syncOpenGroupsToRoute(openGroups.value)

      initSubscription()

      notificationReadStateHandler = applyNotificationReadState
      window.addEventListener(NOTIFICATION_READ_STATE_EVENT, notificationReadStateHandler)

      syncCollapsedWithViewport()
      mobileEscapeHandler = (event) => {
        if (event.key === 'Escape' && mobileDrawerOpen.value) closeSidebar()
      }
      window.addEventListener('keydown', mobileEscapeHandler)
      viewportHandler = () => syncCollapsedWithViewport()
      window.addEventListener('resize', viewportHandler)
      sidebarNav.value?.addEventListener('scroll', saveSidebarScrollPosition, { passive: true })
      restoreSidebarScrollPosition()

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          openGroups.value = {}
          persistGroups()
          clearSidebarTransientState()
          return
        }
        await loadUserDetails(user)
      })
    })

    watch(
      () => route.fullPath,
      () => {
        syncOpenGroupsToRoute()
        if (mobileDrawerOpen.value) closeSidebar()
        restoreSidebarScrollPosition()
      }
    )

    watch(
      sidebarLoading,
      (loading) => {
        if (skeletonTimer) {
          clearTimeout(skeletonTimer)
          skeletonTimer = null
        }
        if (loading) {
          skeletonTimer = setTimeout(() => {
            showSkeleton.value = true
          }, 180)
        } else {
          showSkeleton.value = false
        }
      },
      { immediate: true }
    )

    onUnmounted(() => {
      saveSidebarScrollPosition()
      sidebarNav.value?.removeEventListener('scroll', saveSidebarScrollPosition)
      if (unsubscribe) unsubscribe()
      if (viewportHandler) {
        window.removeEventListener('resize', viewportHandler)
      }
      if (mobileEscapeHandler) window.removeEventListener('keydown', mobileEscapeHandler)
      syncMobileBodyScroll(false)
      if (unsubscribeNotificationsUser) unsubscribeNotificationsUser()
      if (unsubscribeNotificationsRole) unsubscribeNotificationsRole()
      if (notificationReadStateHandler) window.removeEventListener(NOTIFICATION_READ_STATE_EVENT, notificationReadStateHandler)
      if (skeletonTimer) {
        clearTimeout(skeletonTimer)
      }
    })

    return {
      sidebarPanel,
      mobileMenuTrigger,
      sidebarNav,
      collapsed,
      sidebarCollapsed,
      mobileDrawerOpen,
      openMobileSidebar,
      closeSidebar,
      displayName,
      displayEmail,
      userInitial,
      visibleItems,
      enableTransitions,
      isGroup,
      isActive,
      isExactActive,
      isGroupActive,
      isGroupOpen,
      toggleGroup,
      toggleCollapsed,
      iconName,
      logout,
      isLoading,
      sidebarLoading,
      showSkeleton,
      containerStyle,
      asideStyle,
      handleItemNavigation,
      hasFeature,
      hasPermission,
      isSmallScreen,
      skeletonCount
    }
  }
}
</script>

<style scoped>
.sidebar-scroll {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.sidebar-scroll::-webkit-scrollbar {
  display: none;
}
</style>
