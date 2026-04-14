<template>
  <div
    :style="containerStyle"
    :class="['relative flex-shrink-0', enableTransitions ? 'transition-all duration-300' : '']"
  >
    <button
      v-if="isSmallScreen && collapsed && !useInlineMobileToggle"
      type="button"
      class="readonly-exempt fixed left-2 top-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#5a3927] bg-[#1f120b] text-[#f3e7e0] shadow-2xl"
      :aria-label="'Expand sidebar'"
      title="Expand sidebar"
      @click="toggleCollapsed"
    >
      <Icon icon="mdi:menu" class="h-4 w-4" />
    </button>
    <aside
      :style="asideStyle"
      :class="[
        'readonly-exempt fixed left-0 top-0 bottom-0 z-40 bg-[#1f120b] border border-[#3a2417] rounded-tr-2xl rounded-br-2xl shadow-2xl flex flex-col overflow-hidden',
        isSmallScreen && collapsed ? '-translate-x-full' : 'translate-x-0',
        enableTransitions ? 'transition-all duration-300' : ''
      ]"
    >
      <div class="p-4 border-b border-[#3a2417]">
        <div class="flex items-center gap-3">
          <template v-if="showSkeleton">
            <div class="h-10 w-10 rounded-lg border border-[#5a3927] bg-[#3a2417] animate-pulse"></div>
            <div v-if="!collapsed" class="min-w-0 flex-1 space-y-2">
              <div class="h-4 w-28 rounded bg-[#3a2417] animate-pulse"></div>
              <div class="h-3 w-20 rounded bg-[#3a2417] animate-pulse"></div>
            </div>
          </template>
          <template v-else>
            <div v-if="!collapsed" class="min-w-0">
              <h2 class="text-white font-semibold text-lg truncate">{{ title }}</h2>
              <p class="text-[#c9b3a5] text-xs truncate">{{ subtitle }}</p>
            </div>
          </template>
          <button
            v-if="isSmallScreen"
            type="button"
            class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#5a3927] bg-[#2a180f] text-[#f3e7e0]"
            :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleCollapsed"
          >
            <Icon :icon="collapsed ? 'mdi:menu-open' : 'mdi:menu-close'" class="h-4 w-4" />
          </button>
          <div v-else class="ml-auto"></div>
        </div>
      </div>

      <nav class="sidebar-scroll flex-1 p-3 overflow-y-auto">
      <ul v-if="showSkeleton" class="space-y-2">
        <li v-for="index in skeletonCount" :key="index">
          <div
            :class="[
              'flex items-center rounded-lg border border-[#3a2417] bg-[#2a180f]',
              collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5'
            ]"
          >
            <div class="h-8 w-8 rounded-lg border border-[#5a3927] bg-[#3a2417] animate-pulse"></div>
            <div v-if="!collapsed" class="flex-1">
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
              :class="[
                'group relative w-full flex items-center rounded-lg transition-colors duration-200',
                collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5',
                item.locked
                  ? 'text-[#b99b88] bg-[#24160f]'
                  : isGroupOpen(item)
                    ? 'text-white bg-[#6b3f27]'
                    : 'text-[#e8d8cf] hover:text-white hover:bg-[#3a2417]'
              ]"
              :title="collapsed ? item.lockTitle || item.label : item.lockTitle || ''"
            >
                <span
                :class="[
                  'h-8 w-8 rounded-lg border flex items-center justify-center',
                  isGroupOpen(item)
                    ? 'bg-[#8b5a3c] border-[#8b5a3c] text-white'
                    : 'bg-[#3a2417] border-[#5a3927] text-[#f3e7e0]'
                ]"
              >
                <Icon :icon="item.locked ? 'mdi:lock-outline' : iconName(item.icon)" class="w-4 h-4" />
              </span>
              <span v-if="!collapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              <Icon
                v-if="!collapsed && item.locked"
                icon="mdi:lock-outline"
                class="w-4 h-4 text-amber-300"
              />
              <svg
                v-if="!collapsed"
                class="w-4 h-4 ml-auto transition-transform duration-200"
                :class="isGroupOpen(item) ? 'rotate-90' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span
                v-if="collapsed"
                class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[#3a2417] border border-[#5a3927] text-[#f3e7e0] px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                {{ item.label }}
              </span>
            </button>

            <ul
              v-if="!collapsed && isGroupOpen(item)"
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
                  :disabled="child.locked"
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
                  <span class="text-sm truncate">{{ child.label }}</span>
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
              :disabled="item.locked"
              @click="handleItemNavigation"
              :class="[
                'group relative w-full flex items-center rounded-lg transition-colors duration-200',
                collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5',
                item.locked
                  ? 'cursor-not-allowed text-[#9f8578] bg-[#24160f] opacity-80'
                  : isActive(item.to)
                  ? 'bg-[#6b3f27] text-white'
                  : 'text-[#e8d8cf] hover:text-white hover:bg-[#3a2417]'
              ]"
              :title="collapsed ? item.lockTitle || item.label : item.lockTitle || ''"
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
              <span v-if="!collapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              <Icon
                v-if="!collapsed && item.locked"
                icon="mdi:lock-outline"
                class="ml-auto w-4 h-4 text-amber-300"
              />
              <span
                v-else-if="!collapsed && item.badge && Number(item.badge) > 0"
                class="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold leading-4 text-white"
              >
                {{ item.badge }}
              </span>
              <span
                v-if="collapsed && item.badge && Number(item.badge) > 0"
                class="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white shadow"
              >
                {{ item.badge }}
              </span>
              <span
                v-if="collapsed"
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
          :class="collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'"
        >
          <template v-if="isLoading">
            <div class="h-9 w-9 rounded-full bg-[#3a2417] border border-[#5a3927] animate-pulse"></div>
            <div v-if="!collapsed" class="min-w-0 flex-1 space-y-2">
              <div class="h-3 w-24 rounded bg-[#3a2417] animate-pulse"></div>
              <div class="h-3 w-32 rounded bg-[#3a2417] animate-pulse"></div>
            </div>
          </template>
          <template v-else>
            <div class="h-9 w-9 rounded-full bg-[#3a2417] border border-[#5a3927] text-white text-sm font-semibold flex items-center justify-center" :title="displayName">
              {{ userInitial }}
            </div>
            <div v-if="!collapsed" class="min-w-0">
              <p class="text-white text-sm font-medium truncate">{{ displayName }}</p>
              <p class="text-[#c9b3a5] text-xs truncate">{{ displayEmail }}</p>
            </div>
          </template>
        </div>

        <div v-if="showSkeleton" class="mt-2">
          <div
            :class="[
              'w-full rounded-lg border border-[#5a3927] bg-[#2a180f] animate-pulse',
              collapsed ? 'h-10' : 'h-10'
            ]"
          ></div>
        </div>
        <button
          v-else
          @click="logout"
          :class="[
            'mt-2 w-full rounded-lg border border-[#5a3927] text-[#f0e2d8] hover:bg-[#3a2417] hover:text-white transition-colors',
            collapsed ? 'h-10 flex items-center justify-center' : 'px-3 py-2 flex items-center gap-2 justify-center'
          ]"
          :title="collapsed ? 'Logout' : ''"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span v-if="!collapsed">Logout</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFirestore, collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { Icon } from '@iconify/vue'
import Swal from 'sweetalert2'
import { useAuth } from '@/composables/useAuth'
import { useSubscription } from '@/composables/useSubscription'
import { usePermissions } from '@/composables/usePermissions'

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
    defaultName: { type: String, default: 'User' },
    defaultEmail: { type: String, default: 'user@aestheticare.com' }
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    const db = getFirestore()
    const auth = getAuth()
    const { isLoading } = useAuth()
    const { hasFeature, initSubscription, activePlan, isLoading: subscriptionLoading } = useSubscription()
    const { hasPermission, effectivePermissions, loading: permissionsLoading } = usePermissions()

    const enableTransitions = ref(false)
    const lastVisibleItems = ref([])
    const storageKey = `sidebar:${props.panelKey}:collapsed`
    const groupStorageKey = `sidebar:${props.panelKey}:groups`
    const collapsed = ref(localStorage.getItem(storageKey) === '1')
    const isSmallScreen = ref(false)
    const wasSmallScreen = ref(false)
    const userStorageKey = `sidebar:${props.panelKey}:user`
    const displayName = ref(props.defaultName)
    const displayEmail = ref(props.defaultEmail)
    const openGroups = ref({})
    const notificationsUnread = ref(0)
    const notificationsRoleKey = ref('')
    let unsubscribeNotificationsUser = null
    let unsubscribeNotificationsRole = null
    const notificationsUserCache = ref([])
    const notificationsRoleCache = ref([])

    const userInitial = computed(() => {
      const source = String(displayName.value || '').trim()
      return source ? source.charAt(0).toUpperCase() : 'U'
    })

    const containerStyle = computed(() => {
      if (isSmallScreen.value) return { width: '0rem' }
      return { width: collapsed.value ? '5rem' : '17rem' }
    })

    const asideStyle = computed(() => {
      if (isSmallScreen.value) {
        return { width: collapsed.value ? '5rem' : '17rem' }
      }
      return { width: collapsed.value ? '5rem' : '17rem' }
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

    const isItemAllowed = (item) => {
      const required = getItemFeatures(item)
      const requiredPermissions = getItemPermissions(item)
      const featureAllowed = !required.length || required.every((feature) => hasFeature(feature))
      const permissionAllowed =
        (!requiredPermissions.all.length || requiredPermissions.all.every((perm) => hasPermission(perm))) &&
        (!requiredPermissions.any.length || requiredPermissions.any.some((perm) => hasPermission(perm)))
      return featureAllowed && permissionAllowed
    }

    const lockTitleForItem = (item) => {
      const features = getItemFeatures(item)
      if (features.length) {
        return 'Locked on the Free plan. Upgrade your subscription to access this feature.'
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

    const sidebarLoading = computed(
      () => isLoading.value || subscriptionLoading.value || permissionsLoading.value
    )
    const showSkeleton = ref(false)
    let skeletonTimer = null
    const skeletonCount = computed(() => (collapsed.value ? 7 : 8))

    const isActive = (path) => route.path === path || route.path.startsWith(`${path}/`)
    const isExactActive = (path) => route.path === path

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

    const useInlineMobileToggle = computed(() => {
      const path = String(route.path || '').toLowerCase()
      return !path.startsWith('/superadmin')
    })

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

      if (collapsed.value) {
        collapsed.value = false
        localStorage.setItem(storageKey, '0')
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
      collapsed.value = !collapsed.value
      localStorage.setItem(storageKey, collapsed.value ? '1' : '0')
      window.dispatchEvent(
        new CustomEvent('sidebar-collapsed-change', {
          detail: { panelKey: props.panelKey, collapsed: collapsed.value }
        })
      )
    }

    const closeSidebar = () => {
      if (!isSmallScreen.value || collapsed.value) return
      collapsed.value = true
      localStorage.setItem(storageKey, '1')
      window.dispatchEvent(
        new CustomEvent('sidebar-collapsed-change', {
          detail: { panelKey: props.panelKey, collapsed: true }
        })
      )
    }

    const handleItemNavigation = () => {
      if (isSmallScreen.value) {
        closeSidebar()
      }
    }

    const iconName = (name) => {
      const key = String(name || '').toLowerCase()
      const map = {
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
        reportIssue: 'mdi:bug-outline',
        shield: 'mdi:shield-check-outline',
        profile: 'mdi:account-circle-outline',
        bell: 'mdi:bell-outline',
        'account-off': 'mdi:account-off-outline',
        plus: 'mdi:plus-circle-outline',
        search: 'mdi:magnify',
        money: 'mdi:currency-usd',
        key: 'mdi:key-outline',
        qr: 'mdi:qrcode-scan',
        check: 'mdi:check-circle-outline',
        video: 'mdi:video-outline'
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
      startNotificationBadgeListener(user.uid, notificationsRoleKey.value)
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

    const startNotificationBadgeListener = (userId, roleKey) => {
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

      if (roleKey) {
        unsubscribeNotificationsRole = onSnapshot(
          query(collection(db, 'notifications'), where('recipientRole', '==', roleKey)),
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
        title: 'Are you sure?',
        text: 'Do you really want to log out?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, log me out',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      openGroups.value = {}
      persistGroups()

      window.dispatchEvent(
        new CustomEvent('app-process-loading', {
          detail: { active: true, label: 'Logging out...' }
        })
      )

      try {
        await new Promise((resolve) => setTimeout(resolve, 600))
        await signOut(auth)
        await router.push('/login')
      } finally {
        window.dispatchEvent(
          new CustomEvent('app-process-loading', {
            detail: { active: false }
          })
        )
      }
    }

    let unsubscribe = null
    let sidebarToggleHandler = null
    let viewportHandler = null

    const syncCollapsedWithViewport = () => {
      const small = window.matchMedia('(max-width: 767px)').matches
      isSmallScreen.value = small
      if (small && !wasSmallScreen.value) {
        collapsed.value = localStorage.getItem(storageKey) === '1'
        window.dispatchEvent(
          new CustomEvent('sidebar-collapsed-change', {
            detail: { panelKey: props.panelKey, collapsed: collapsed.value }
          })
        )
      }
      if (!small && wasSmallScreen.value) {
        const stored = localStorage.getItem(storageKey) === '1'
        collapsed.value = stored
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
      sidebarToggleHandler = (event) => {
        const detail = event?.detail || {}
        if (!detail.panelKey) return
        if (detail.panelKey === props.panelKey) {
          toggleCollapsed()
        }
      }
      window.addEventListener('sidebar-toggle-request', sidebarToggleHandler)
      try {
        const parsed = JSON.parse(localStorage.getItem(groupStorageKey) || '{}')
        openGroups.value = normalizeOpenGroups(parsed)
      } catch (_error) {
        openGroups.value = {}
      }

      syncOpenGroupsToRoute(openGroups.value)

      initSubscription()

      syncCollapsedWithViewport()
      viewportHandler = () => syncCollapsedWithViewport()
      window.addEventListener('resize', viewportHandler)

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        await loadUserDetails(user)
      })
    })

    watch(
      () => route.path,
      () => {
        syncOpenGroupsToRoute()
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
      if (unsubscribe) unsubscribe()
      if (sidebarToggleHandler) {
        window.removeEventListener('sidebar-toggle-request', sidebarToggleHandler)
      }
      if (viewportHandler) {
        window.removeEventListener('resize', viewportHandler)
      }
      if (unsubscribeNotificationsUser) unsubscribeNotificationsUser()
      if (unsubscribeNotificationsRole) unsubscribeNotificationsRole()
      if (skeletonTimer) {
        clearTimeout(skeletonTimer)
      }
    })

    return {
      collapsed,
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
      useInlineMobileToggle,
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
