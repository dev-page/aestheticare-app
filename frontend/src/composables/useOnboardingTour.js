import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'

const STORAGE_PREFIX = 'onboarding:disabled:'
const TOUR_VERSION = 2

const tourCatalog = {
  customer: {
    title: 'Your Customer Panel',
    steps: [
      { title: 'Home', text: 'Explore clinics, filter centers, save favorites, and open a clinic to view its details.', selector: '[data-onboarding-key="customer-home"]', path: '/customer/home' },
      { title: 'Appointments', text: 'Review your appointment requests, schedules, consultation details, and booking progress.', selector: '[data-onboarding-key="customer-appointments"]', path: '/customer/appointments' },
      { title: 'Orders', text: 'Track your customer orders, payment progress, and fulfillment updates here.', selector: '[data-onboarding-key="customer-orders"]', path: '/customer/orders' },
      { title: 'Cart', text: 'Review selected products or services before proceeding to checkout.', selector: '[data-onboarding-key="customer-cart"]', path: '/customer/cart' },
      { title: 'Profile', text: 'Update your personal information and contact details used for bookings.', selector: '[data-onboarding-key="customer-profile"]', path: '/customer/profile' },
      { title: 'Account Settings', text: 'Manage account access, request deactivation, or submit an account deletion request for review.', selector: '[data-onboarding-key="customer-account-settings"]', path: '/customer/account-settings' },
      { title: 'Notifications', text: 'Check booking, order, payment, and clinic updates sent to your account.', selector: '[data-onboarding-key="customer-notifications"]', path: '/notifications' },
      { title: 'Report Issue', text: 'Send a support request when you encounter a problem or need assistance.', selector: '[data-onboarding-key="customer-report-issue"]', path: '/support/report' },
    ],
  },
  owner: {
    title: 'Your clinic workspace',
    steps: [
      { title: 'Start with the dashboard', text: 'This area summarizes your clinic activity and provides shortcuts to your most important modules.', selector: 'main' },
      { title: 'Manage modules from the sidebar', text: 'Finance, inventory, staff, appointments, and other modules appear according to your enabled permissions.', selector: 'aside' },
      { title: 'Review access carefully', text: 'Role permissions control what employees can see and do. You can revisit this guide anytime.', selector: 'aside' },
    ],
  },
  employee: {
    title: 'Your employee workspace',
    steps: [
      { title: 'Your assigned tools', text: 'The sidebar contains only the modules and actions assigned to your account.', selector: 'aside' },
      { title: 'Follow the current task', text: 'Use the page content to complete your assigned clinic, appointment, attendance, or operations work.', selector: 'main' },
      { title: 'Need help?', text: 'Ask your clinic administrator if you need access to another module or action.', selector: 'main' },
    ],
  },
  supplier: {
    title: 'Your supplier workspace',
    steps: [
      { title: 'Manage your catalog', text: 'Use the supplier workspace to maintain products, supplies, requests, and orders.', selector: 'main' },
      { title: 'Navigate by module', text: 'Your sidebar groups related supplier tools together so common tasks are easier to find.', selector: 'aside' },
      { title: 'Keep information current', text: 'Updated product and fulfillment information helps clinics make better decisions.', selector: 'main' },
    ],
  },
}

const getTourKey = (path) => {
  const normalized = String(path || '').toLowerCase()
  if (normalized.startsWith('/customer')) return 'customer'
  if (normalized.startsWith('/owner')) return 'owner'
  if (normalized.startsWith('/superadmin')) return 'superadmin'
  if (normalized.startsWith('/supply')) return 'supplier'
  if (normalized.startsWith('/employee') || normalized.startsWith('/manager') || normalized.startsWith('/hr') || normalized.startsWith('/finance') || normalized.startsWith('/receptionist') || normalized.startsWith('/practitioner') || normalized.startsWith('/cashier')) return 'employee'
  return ''
}

const getStorageKey = (tourKey, uid = '') => `${STORAGE_PREFIX}v${TOUR_VERSION}:${uid || 'anonymous'}:${tourKey}`

const readLocalDisabled = (tourKey, uid = '') => {
  try {
    return localStorage.getItem(getStorageKey(tourKey, uid)) === '1'
  } catch (_error) {
    return false
  }
}

const writeLocalDisabled = (tourKey, disabled, uid = '') => {
  try {
    const storageKey = getStorageKey(tourKey, uid)
    if (disabled) localStorage.setItem(storageKey, '1')
    else localStorage.removeItem(storageKey)
  } catch (_error) {
    // A storage failure should never block the application.
  }
}

export const useOnboardingTour = ({ route, user }) => {
  const router = useRouter()
  const isOpen = ref(false)
  const stepIndex = ref(0)
  const dontShowAgain = ref(false)
  const disabledTours = ref({})
  const loading = ref(false)
  const triggeredForUid = ref('')

  // useRoute() returns a reactive object, while some callers may provide a
  // ref. Support both shapes so the tour key is resolved reliably.
  const getCurrentPath = () => route?.value?.path || route?.path || ''
  const routeTourKey = computed(() => getTourKey(getCurrentPath()))
  const activeTourKey = ref('')
  const tourKey = computed(() => routeTourKey.value || activeTourKey.value)
  const tour = computed(() => tourCatalog[tourKey.value] || null)
  const step = computed(() => tour.value?.steps?.[stepIndex.value] || null)
  const isLastStep = computed(() => Boolean(tour.value && stepIndex.value >= tour.value.steps.length - 1))

  const loadPreference = async () => {
    const key = tourKey.value
    if (!key) return false
    const uid = user.value?.uid || ''
    let disabled = readLocalDisabled(key, uid)
    if (user.value?.uid) {
      try {
        const snapshot = await getDoc(doc(db, 'users', user.value.uid))
        const preference = snapshot.data()?.preferences?.onboarding?.[key]
        // Ignore preferences written by the earlier onboarding implementation;
        // those could have been saved accidentally before the checkbox was fixed.
        disabled = disabled || (preference?.disabled === true && Number(preference?.version) === TOUR_VERSION)
      } catch (_error) {
        // Local storage remains a safe fallback when the profile is unavailable.
      }
    }
    disabledTours.value = { ...disabledTours.value, [key]: disabled }
    return disabled
  }

  const persistPreference = async (key, disabled) => {
    writeLocalDisabled(key, disabled, user.value?.uid || '')
    disabledTours.value = { ...disabledTours.value, [key]: disabled }
    if (!user.value?.uid) return
    try {
      await setDoc(doc(db, 'users', user.value.uid), {
        'preferences.onboarding': {
          [key]: { disabled, version: TOUR_VERSION, updatedAt: new Date().toISOString() },
        },
      }, { merge: true })
    } catch (_error) {
      // The local preference still works if Firestore rules or connectivity reject the update.
    }
  }

  const open = async () => {
    if (!tour.value) return
    await loadPreference()
    stepIndex.value = 0
    dontShowAgain.value = Boolean(disabledTours.value[tourKey.value])
    isOpen.value = true
  }

  const close = async () => {
    if (dontShowAgain.value && tourKey.value) await persistPreference(tourKey.value, true)
    isOpen.value = false
  }

  const next = async () => {
    if (!tour.value) {
      await close()
      return
    }
    if (!isLastStep.value) {
      stepIndex.value += 1
      const nextPath = step.value?.path
      if (nextPath && getCurrentPath() !== nextPath) {
        await router.push(nextPath)
      }
      return
    }
    await close()
  }

  const previous = async () => {
    if (stepIndex.value === 0) return
    stepIndex.value = Math.max(0, stepIndex.value - 1)
    const previousPath = step.value?.path
    if (previousPath && getCurrentPath() !== previousPath) {
      await router.push(previousPath)
    }
  }

  const reset = async () => {
    if (!tourKey.value) return
    await persistPreference(tourKey.value, false)
    dontShowAgain.value = false
    await open()
  }

  const setDontShowAgain = async (value) => {
    const disabled = Boolean(value)
    dontShowAgain.value = disabled
    if (tourKey.value) await persistPreference(tourKey.value, disabled)
  }

  watch(
    () => [user.value?.uid || '', getCurrentPath()],
    async ([nextUid, nextPath], [previousUid, previousPath] = []) => {
      if (!nextUid) {
        triggeredForUid.value = ''
        activeTourKey.value = ''
        isOpen.value = false
        return
      }
      if (routeTourKey.value === 'superadmin') {
        activeTourKey.value = ''
        isOpen.value = false
        return
      }
      if (routeTourKey.value) activeTourKey.value = routeTourKey.value
      if (!nextPath || !tourKey.value || triggeredForUid.value === nextUid || loading.value) return
      loading.value = true
      try {
        // Login redirects can finish before the customer workspace has
        // rendered. Wait briefly so the tour opens on the actual dashboard,
        // not during the transition from /login.
        await new Promise((resolve) => setTimeout(resolve, 150))
        if (!user.value?.uid || !tourKey.value) return
        const disabled = await loadPreference()
        if (!disabled) {
          triggeredForUid.value = nextUid
          await open()
        }
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  return { isOpen, stepIndex, step, tour, tourKey, isLastStep, dontShowAgain, open, close, next, previous, reset, setDontShowAgain }
}
