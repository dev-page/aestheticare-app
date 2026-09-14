<template>
  <div class="customer-settings-shell flex min-h-screen">
    <CustomerSidebar class="flex-shrink-0" />

    <main class="customer-settings-main flex-1">
      <div class="customer-settings-content">
        <section class="settings-hero">
          <p class="settings-eyebrow">Account Settings</p>
          <h1 class="settings-title">Account Settings</h1>
          <p class="settings-subtitle">Manage your profile, notifications, account access, help, and privacy preferences in one place.</p>
        </section>

        <section class="settings-card">
          <div>
            <p class="settings-card-kicker">Current account</p>
            <h2 class="settings-card-title">{{ accountEmail || 'Customer account' }}</h2>
            <p class="settings-copy">Deactivation signs you out and prevents login until an administrator reactivates the account.</p>
          </div>
          <span class="settings-status" :class="status === 'Active' ? 'settings-status-active' : 'settings-status-inactive'">{{ status }}</span>
        </section>

        <nav class="settings-tabs" aria-label="Account settings sections">
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'profile' }]" @click="selectTab('profile')">Profile</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'notifications' }]" @click="selectTab('notifications')">Notifications</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'account' }]" @click="selectTab('account')">Account Access</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'help' }]" @click="selectTab('help')">Help & Guidance</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'privacy' }]" @click="selectTab('privacy')">Privacy & Data</button>
        </nav>

        <section v-if="activeTab === 'profile'" class="settings-tab-panel settings-profile-panel">
          <MyProfile embedded />
        </section>

        <section v-else-if="activeTab === 'notifications'" class="settings-tab-panel settings-card settings-notifications-card">
          <div class="settings-notifications-content">
            <p class="settings-card-kicker">Notifications</p>
            <h2 class="settings-card-title">Stay updated</h2>
            <p class="settings-copy">Your latest booking, order, payment, and clinic updates are shown here.</p>
            <p v-if="notificationsError" class="settings-notifications-error">{{ notificationsError }}</p>
            <p v-if="notificationsLoading" class="settings-notifications-empty">Loading notifications...</p>
            <p v-else-if="!notifications.length" class="settings-notifications-empty">No notifications yet.</p>
            <ul v-else class="settings-notification-list">
              <li v-for="item in pagedNotifications" :key="item.id" :class="['settings-notification-item', { 'settings-notification-unread': !item.read }]">
                <div class="settings-notification-copy">
                  <strong>{{ item.title || 'Notification' }}</strong>
                  <p>{{ item.message || '-' }}</p>
                  <small>{{ item.createdLabel }}</small>
                </div>
                <div class="settings-notification-actions">
                  <span v-if="!item.read" class="settings-new-badge">New</span>
                  <button v-if="!item.read" type="button" class="settings-text-button" @click="markNotificationRead(item)">Mark read</button>
                  <button type="button" class="settings-text-button settings-delete-text" @click="deleteNotification(item)">Delete</button>
                </div>
              </li>
            </ul>
            <div v-if="notifications.length > pageSize" class="settings-pagination">
              <button type="button" class="settings-page-button" :disabled="notificationPage === 1" @click="notificationPage -= 1">Previous</button>
              <span>Page {{ notificationPage }} of {{ notificationPageCount }}</span>
              <button type="button" class="settings-page-button" :disabled="notificationPage === notificationPageCount" @click="notificationPage += 1">Next</button>
            </div>
            <RouterLink to="/notifications" class="settings-text-link settings-full-notifications-link">Open full notification center</RouterLink>
          </div>
        </section>

        <section v-else-if="activeTab === 'account'" class="settings-tab-panel">
          <div class="settings-grid">
            <article class="settings-card settings-card-warning">
              <div>
                <p class="settings-card-kicker">Temporary option</p>
                <h2 class="settings-card-title">Deactivate account</h2>
                <p class="settings-copy">Use this if you want to stop using the platform temporarily. Your records are retained and your account can be reactivated through support.</p>
              </div>
              <button type="button" class="settings-button settings-button-warning" :disabled="busy || status !== 'Active'" @click="deactivateAccount">
                {{ busy && action === 'deactivate' ? 'Deactivating...' : 'Deactivate Account' }}
              </button>
            </article>

            <article class="settings-card">
              <div>
                <p class="settings-card-kicker">Credentials</p>
                <h2 class="settings-card-title">Change or reset password</h2>
                <p class="settings-copy">Change your current password while signed in, or use the reset flow if you can no longer sign in.</p>
              </div>
              <div class="settings-action-links">
                <RouterLink to="/change-password" class="settings-button settings-button-primary">Change Password</RouterLink>
                <RouterLink :to="{ path: '/forgot-password', query: { returnTo: '/customer/account-settings?tab=account' } }" class="settings-text-link">Forgot password?</RouterLink>
              </div>
            </article>

            <article class="settings-card settings-card-danger">
              <div>
                <p class="settings-card-kicker">Permanent request</p>
                <h2 class="settings-card-title">Request account deletion</h2>
                <p class="settings-copy">Deletion is sent to the System Administrator for review. This prevents accidental loss of records and supports retention requirements.</p>
              </div>
              <button type="button" class="settings-button settings-button-danger" :disabled="busy || deletionRequested" @click="requestDeletion">
                {{ busy && action === 'delete' ? 'Submitting...' : deletionRequested ? 'Request Submitted' : 'Request Deletion' }}
              </button>
            </article>
          </div>
        </section>

        <section v-else-if="activeTab === 'help'" class="settings-tab-panel settings-card">
          <div>
            <p class="settings-card-kicker">Help & Guidance</p>
            <h2 class="settings-card-title">Customer tutorial</h2>
            <p class="settings-copy">Show the tooltip tutorial when you enter the customer panel. You can change this anytime.</p>
          </div>
          <label class="settings-toggle">
            <input v-model="tutorialEnabled" type="checkbox" @change="saveTutorialPreference" />
            <span>{{ tutorialEnabled ? 'Enabled' : 'Disabled' }}</span>
          </label>
        </section>

        <section v-else class="settings-tab-panel settings-card">
          <div>
            <p class="settings-card-kicker">Privacy & Data</p>
            <h2 class="settings-card-title">Your information and records</h2>
            <p class="settings-copy">Your profile, appointment, order, and support records are retained to provide the service and resolve disputes. Account deletion requests are reviewed before any account closure action is taken.</p>
              <p class="settings-copy">For a copy of your information or a privacy question, submit a report through the Report Issue page.</p>
              <button type="button" class="settings-button settings-button-primary" :disabled="exporting" @click="exportAccountData">
                {{ exporting ? 'Preparing export...' : 'Export My Data' }}
              </button>
              <p class="settings-hint">The export excludes passwords, OTPs, internal notes, and other users' information.</p>
          </div>
        </section>

        <p v-if="message" class="settings-message settings-message-success">{{ message }}</p>
        <p v-if="errorMessage" class="settings-message settings-message-error">{{ errorMessage }}</p>
      </div>
    </main>

    <div v-if="accountAction" class="settings-modal-backdrop" @click.self="closeAccountAction">
      <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="account-action-title">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="settings-card-kicker">Account Access</p>
            <h2 id="account-action-title" class="settings-card-title">{{ accountAction === 'deactivate' ? 'Deactivate account' : 'Request account deletion' }}</h2>
          </div>
          <button type="button" class="settings-modal-close" aria-label="Close" @click="closeAccountAction">&times;</button>
        </div>
        <label class="settings-modal-label" for="account-action-reason">Reason</label>
        <label class="settings-modal-label" for="account-action-preset">Common reason</label>
        <select id="account-action-preset" v-model="reasonPreset" class="settings-modal-select">
          <option value="" disabled>Select a reason</option>
          <option v-for="reason in currentReasonOptions" :key="reason" :value="reason">{{ reason }}</option>
        </select>
        <label class="settings-modal-label" for="account-action-reason">Additional details</label>
        <textarea id="account-action-reason" v-model.trim="actionReason" rows="5" class="settings-modal-textarea" :placeholder="accountAction === 'deactivate' ? 'Add details, or explain another reason...' : 'Add details, or explain another reason...'"></textarea>
        <div class="settings-terms">
          <p class="settings-modal-label">Important terms</p>
          <ul v-if="accountAction === 'deactivate'" class="settings-terms-list">
            <li>Your account will be deactivated immediately and you will be signed out.</li>
            <li>Your records will be retained and your account can be reactivated through support.</li>
            <li>Deactivation is not the same as permanent deletion.</li>
          </ul>
          <ul v-else class="settings-terms-list">
            <li>Your request will be reviewed by the System Administrator.</li>
            <li>If approved, your account will enter a 30-day pending deletion period.</li>
            <li>You may contact support during that period to cancel the deletion request.</li>
            <li>Some records may be retained for legal, financial, and operational requirements.</li>
          </ul>
        </div>
        <div class="mt-5 flex justify-end gap-3">
          <button type="button" class="settings-button settings-button-secondary" @click="closeAccountAction">Cancel</button>
          <button type="button" :class="['settings-button', accountAction === 'deactivate' ? 'settings-button-warning' : 'settings-button-danger']" :disabled="busy || !combinedReason.trim()" @click="submitAccountAction">
            {{ busy ? 'Processing...' : accountAction === 'deactivate' ? 'Confirm Deactivation' : 'Submit Deletion Request' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import { auth, db } from '@/config/firebaseConfig'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import MyProfile from '@/views/customer/MyProfile.vue'

const accountEmail = ref('')
const activeTab = ref('profile')
const route = useRoute()
const router = useRouter()
const status = ref('Active')
const deletionRequested = ref(false)
const tutorialEnabled = ref(true)
const busy = ref(false)
const action = ref('')
const message = ref('')
const errorMessage = ref('')
const accountAction = ref('')
const actionReason = ref('')
const reasonPreset = ref('')
const exporting = ref(false)
const notifications = ref([])
const notificationsLoading = ref(false)
const notificationsError = ref('')
const notificationPage = ref(1)
const pageSize = 10
let unsubscribeNotifications = null

const deactivationReasons = [
  'I am taking a break',
  'I am no longer using the service',
  'Privacy concerns',
  'Too many notifications',
  'Technical difficulties',
  'Other',
]
const deletionReasons = [
  'I no longer need the account',
  'I have a duplicate account',
  'Privacy or data concerns',
  'I am dissatisfied with the service',
  'I created the account by mistake',
  'Other',
]
const currentReasonOptions = computed(() => accountAction.value === 'deactivate' ? deactivationReasons : deletionReasons)
const combinedReason = computed(() => [reasonPreset.value, actionReason.value.trim()].filter(Boolean).join(': '))
const notificationPageCount = computed(() => Math.max(1, Math.ceil(notifications.value.length / pageSize)))
const pagedNotifications = computed(() => notifications.value.slice((notificationPage.value - 1) * pageSize, notificationPage.value * pageSize))

const allowedTabs = new Set(['profile', 'notifications', 'account', 'help', 'privacy'])

const selectTab = (tab) => {
  const nextTab = allowedTabs.has(tab) ? tab : 'profile'
  activeTab.value = nextTab
  router.replace({ query: { ...route.query, tab: nextTab } })
}

watch(() => route.query.tab, (tab) => {
  activeTab.value = allowedTabs.has(String(tab || '')) ? String(tab) : 'profile'
}, { immediate: true })

watch(activeTab, () => {
  message.value = ''
  errorMessage.value = ''
})

watch(notificationPageCount, (count) => {
  if (notificationPage.value > count) notificationPage.value = count
})

const openAccountAction = (nextAction) => {
  accountAction.value = nextAction
  actionReason.value = ''
  reasonPreset.value = ''
  errorMessage.value = ''
}

const closeAccountAction = () => {
  if (busy.value) return
  accountAction.value = ''
  actionReason.value = ''
  reasonPreset.value = ''
}

const loadAccount = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return
  accountEmail.value = currentUser.email || ''
  const snapshot = await getDoc(doc(db, 'users', currentUser.uid))
  const data = snapshot.exists() ? snapshot.data() || {} : {}
  status.value = String(data.status || 'Active')
  deletionRequested.value = data.accountDeletionRequested === true
  tutorialEnabled.value = data.preferences?.onboarding?.customer?.disabled !== true
}

const formatNotificationDate = (value) => {
  const date = value?.toDate ? value.toDate() : new Date(value || 0)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

const startNotificationsListener = (userId) => {
  if (unsubscribeNotifications) unsubscribeNotifications()
  notificationsLoading.value = true
  notificationsError.value = ''
  unsubscribeNotifications = onSnapshot(
    query(collection(db, 'notifications'), where('recipientUserId', '==', userId)),
    (snapshot) => {
      notifications.value = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data(), createdLabel: formatNotificationDate(item.data()?.createdAt), createdAtMs: item.data()?.createdAt?.toMillis?.() || 0 }))
        .filter((item) => !item.deleted)
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
      notificationsLoading.value = false
    },
    (error) => {
      console.error('Failed to load customer notifications:', error)
      notificationsError.value = 'Unable to load notifications right now.'
      notificationsLoading.value = false
    }
  )
}

const markNotificationRead = async (item) => {
  if (!item?.id || item.read) return
  try {
    await updateDoc(doc(db, 'notifications', item.id), { read: true, updatedAt: serverTimestamp() })
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
    toast.error('Unable to update that notification.')
  }
}

const deleteNotification = async (item) => {
  if (!item?.id) return
  try {
    await updateDoc(doc(db, 'notifications', item.id), { deleted: true, updatedAt: serverTimestamp() })
  } catch (error) {
    console.error('Failed to delete notification:', error)
    toast.error('Unable to delete that notification.')
  }
}

const saveTutorialPreference = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return
  const disabled = !tutorialEnabled.value
  try {
    localStorage.setItem(
      `onboarding:disabled:v2:${currentUser.uid}:customer`,
      disabled ? '1' : ''
    )
    await updateDoc(doc(db, 'users', currentUser.uid), {
      'preferences.onboarding.customer': {
        disabled,
        version: 2,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    })
    message.value = disabled ? 'Customer tutorial disabled.' : 'Customer tutorial enabled.'
    toast.success(message.value)
  } catch (error) {
    console.error(error)
    tutorialEnabled.value = !tutorialEnabled.value
    errorMessage.value = 'Unable to update the tutorial setting right now.'
  }
}

const deactivateAccount = () => openAccountAction('deactivate')

const requestDeletion = () => openAccountAction('delete')

const submitAccountAction = async () => {
  if (!auth.currentUser || !accountAction.value || !combinedReason.value.trim()) return
  busy.value = true
  action.value = accountAction.value
  errorMessage.value = ''
  try {
    if (accountAction.value === 'deactivate') {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        status: 'Inactive',
        accountDeactivationRequested: true,
        accountDeactivationReason: combinedReason.value,
        accountDeactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await signOut(auth)
      window.location.assign('/login?deactivated=1')
      return
    }

    const currentUser = auth.currentUser
    const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await addDoc(collection(db, 'accountClosureRequests'), {
      requestType: 'customer_account_deletion', ownerId: currentUser.uid,
      ownerName: currentUser.displayName || 'Customer', ownerEmail: currentUser.email || '',
      action: 'delete', actionLabel: 'Customer account deletion', reason: combinedReason.value,
      clinicCount: 0, branchIds: [], branchNames: [], deletionGraceDays: 30,
      deletionScheduledFor: Timestamp.fromDate(deletionDate), status: 'pending', reviewStatus: 'Pending',
      requestedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'users', currentUser.uid), {
      accountDeletionRequested: true,
      accountDeletionRequestedAt: serverTimestamp(),
      accountDeletionReason: combinedReason.value,
      accountDeletionScheduledFor: Timestamp.fromDate(deletionDate),
      updatedAt: serverTimestamp(),
    })
    await addDoc(collection(db, 'notifications'), {
      recipientRole: 'Superadmin', senderId: currentUser.uid, type: 'customer_account_deletion_request',
      title: 'Customer Account Deletion Request', message: `${currentUser.email || 'A customer'} requested account deletion.`,
      link: '/superadmin/account-closure-requests', read: false, deleted: false, createdAt: serverTimestamp(),
    })
    deletionRequested.value = true
    message.value = 'Your deletion request was submitted for review.'
    toast.success(message.value)
    accountAction.value = ''
    actionReason.value = ''
    reasonPreset.value = ''
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Unable to complete this account action right now.'
  } finally {
    busy.value = false
    action.value = ''
  }
}

const sanitizeExportValue = (value, key = '') => {
  const blockedKeys = new Set(['password', 'passwordHash', 'otp', 'otpCode', 'resetToken', 'verificationToken'])
  if (blockedKeys.has(key)) return undefined
  if (value?.toDate) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item)).filter((item) => item !== undefined)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeExportValue(entryValue, entryKey)]).filter(([, entryValue]) => entryValue !== undefined))
  return value
}

const exportAccountData = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return
  exporting.value = true
  errorMessage.value = ''
  try {
    const readOwnedCollection = async (name, field) => {
      try {
        const snapshot = await getDocs(query(collection(db, name), where(field, '==', currentUser.uid)))
        return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      } catch (error) {
        console.warn(`Could not export ${name}:`, error)
        return []
      }
    }
    const userSnapshot = await getDoc(doc(db, 'users', currentUser.uid))
    const [appointments, orders, notifications] = await Promise.all([
      readOwnedCollection('appointments', 'customerId'),
      readOwnedCollection('customerOrders', 'customerId'),
      readOwnedCollection('notifications', 'recipientUserId'),
    ])
    let favorites = []
    try {
      const storedFavorites = JSON.parse(localStorage.getItem('aestheticCare.favoriteClinicIds') || '[]')
      favorites = Array.isArray(storedFavorites) ? storedFavorites : []
    } catch (_error) {
      favorites = []
    }
    const exportPayload = sanitizeExportValue({
      exportedAt: new Date().toISOString(), account: userSnapshot.exists() ? userSnapshot.data() : {},
      appointments, orders, notifications, favorites,
    })
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aestheticare-account-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    message.value = 'Your account data export has been downloaded.'
    window.setTimeout(() => {
      message.value = ''
    }, 5000)
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Unable to export your account data right now.'
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadAccount().catch((error) => {
    console.error(error)
    errorMessage.value = 'Unable to load account settings.'
  })
  const currentUser = auth.currentUser
  if (currentUser) startNotificationsListener(currentUser.uid)
})

onUnmounted(() => {
  if (unsubscribeNotifications) unsubscribeNotifications()
})
</script>

<style scoped>
.customer-settings-shell { background: linear-gradient(135deg, #fbf2e4, #f1dcc0); }
.customer-settings-main { min-width: 0; background: radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 28%), linear-gradient(180deg, #fbf5e8, #f4e1c6); }
.customer-settings-content { max-width: 980px; margin: 0 auto; padding: 2rem 1.25rem 3rem; display: grid; gap: 1.25rem; }
.settings-hero, .settings-card { border: 1px solid rgba(230, 193, 150, 0.8); border-radius: 1.5rem; background: rgba(255, 251, 244, 0.94); padding: 1.5rem; box-shadow: 0 18px 45px rgba(84, 54, 34, 0.1); }
.settings-eyebrow, .settings-card-kicker { color: #9b6a3c; font-size: .72rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.settings-title { margin-top: .45rem; color: #3d281d; font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; }
.settings-subtitle, .settings-copy { margin-top: .5rem; color: #775743; line-height: 1.6; }
.settings-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.settings-card-title { margin-top: .35rem; color: #3d281d; font-size: 1.2rem; font-weight: 700; }
.settings-status { border-radius: 999px; padding: .45rem .75rem; font-size: .75rem; font-weight: 700; }
.settings-status-active { background: #dcfce7; color: #166534; }
.settings-status-inactive { background: #fee2e2; color: #991b1b; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
.settings-card-warning { border-color: #f0c98e; }
.settings-card-danger { border-color: #e5b1a9; }
.settings-tabs { display: flex; gap: .5rem; overflow-x: auto; border-bottom: 1px solid rgba(180, 132, 87, .35); padding: .25rem; }
.settings-tab { border-bottom: 3px solid transparent; border-radius: .75rem .75rem 0 0; padding: .8rem 1rem; color: #775743; font-size: .875rem; font-weight: 700; white-space: nowrap; transition: background .2s, color .2s, border-color .2s; }
.settings-tab:hover { background: rgba(255, 255, 255, .55); color: #3d281d; }
.settings-tab-active { border-color: #8d5a3b; background: rgba(255, 255, 255, .72); color: #3d281d; }
.settings-tab-panel { min-width: 0; }
.settings-profile-panel { padding: 0; }
.settings-profile-panel :deep(.profile-content) { padding: 0; }
.settings-profile-panel :deep(.profile-panel) { max-width: none; }
.settings-notifications-content { width: 100%; min-width: 0; }
.settings-notification-list { display: grid; gap: .65rem; margin-top: 1rem; max-height: 34rem; overflow-y: auto; padding-right: .25rem; }
.settings-notification-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border: 1px solid rgba(230, 193, 150, .55); border-radius: .9rem; padding: .85rem; background: rgba(255, 255, 255, .5); }
.settings-notification-unread { border-color: #c18452; background: rgba(255, 245, 229, .9); }
.settings-notification-copy { min-width: 0; }
.settings-notification-copy strong { color: #3d281d; font-size: .9rem; }
.settings-notification-copy p { margin-top: .25rem; color: #775743; font-size: .82rem; line-height: 1.45; overflow-wrap: anywhere; }
.settings-notification-copy small { display: block; margin-top: .35rem; color: #9a765d; font-size: .7rem; }
.settings-notification-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .5rem; flex-shrink: 0; }
.settings-new-badge { border-radius: 999px; background: #8d5a3b; padding: .2rem .45rem; color: white; font-size: .68rem; font-weight: 700; }
.settings-text-button { color: #8d5a3b; font-size: .75rem; font-weight: 700; text-decoration: underline; }
.settings-delete-text { color: #a6473d; }
.settings-notifications-empty, .settings-notifications-error { margin-top: 1rem; color: #775743; font-size: .85rem; }
.settings-notifications-error { color: #a6473d; }
.settings-pagination { display: flex; align-items: center; justify-content: center; gap: .75rem; margin-top: 1rem; color: #775743; font-size: .78rem; }
.settings-page-button { border: 1px solid #d2a879; border-radius: .65rem; padding: .45rem .65rem; color: #6f4329; font-weight: 700; }
.settings-page-button:disabled { cursor: not-allowed; opacity: .45; }
.settings-full-notifications-link { display: inline-block; margin-top: 1rem; }
.settings-inline-button { display: inline-block; text-decoration: none; }
.settings-action-links { display: flex; flex-direction: column; align-items: flex-end; gap: .65rem; min-width: 10rem; }
.settings-text-link { color: #8d5a3b; font-size: .8rem; font-weight: 700; text-decoration: underline; }
.settings-toggle { display: inline-flex; align-items: center; gap: .65rem; cursor: pointer; white-space: nowrap; color: #6f4329; font-size: .875rem; font-weight: 700; }
.settings-toggle input { width: 1.15rem; height: 1.15rem; accent-color: #8d5a3b; }
.settings-button { margin-top: 1.25rem; border-radius: .9rem; padding: .75rem 1rem; color: white; font-size: .875rem; font-weight: 700; transition: opacity .2s; }
.settings-button:disabled { cursor: not-allowed; opacity: .55; }
.settings-button-warning { background: #a66a2c; }
.settings-button-danger { background: #a6473d; }
.settings-button-primary { background: #8d5a3b; }
.settings-button-secondary { background: #775743; }
.settings-hint { margin-top: .75rem; color: #9a765d; font-size: .75rem; }
.settings-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(31, 18, 11, .62); backdrop-filter: blur(3px); }
.settings-modal { width: min(100%, 40rem); max-height: calc(100vh - 2rem); overflow-y: auto; border: 1px solid #e6c196; border-radius: 1.5rem; background: #fffaf2; padding: 2rem; color: #3d281d; box-shadow: 0 24px 80px rgba(31, 18, 11, .3); }
.settings-modal-close { color: #8b6a4d; font-size: 1.5rem; line-height: 1; }
.settings-modal-label { display: block; margin-top: 1.25rem; color: #6f4329; font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.settings-modal-textarea { margin-top: .5rem; width: 100%; resize: vertical; border: 1px solid #e6c196; border-radius: .9rem; background: white; padding: .8rem; color: #3d281d; outline: none; }
.settings-modal-textarea:focus { border-color: #a66a2c; box-shadow: 0 0 0 3px rgba(166, 106, 44, .15); }
.settings-modal-select { margin-top: .5rem; width: 100%; border: 1px solid #e6c196; border-radius: .9rem; background: white; padding: .8rem; color: #3d281d; outline: none; }
.settings-modal-select:focus { border-color: #a66a2c; box-shadow: 0 0 0 3px rgba(166, 106, 44, .15); }
.settings-terms { margin-top: 1rem; border: 1px solid #efd7ba; border-radius: 1rem; background: #fff3e4; padding: 1rem; }
.settings-terms-list { margin-top: .5rem; list-style: disc; padding-left: 1.25rem; color: #775743; font-size: .85rem; line-height: 1.55; }
.settings-message { border-radius: 1rem; padding: .9rem 1rem; font-size: .9rem; }
.settings-message-success { background: #dcfce7; color: #166534; }
.settings-message-error { background: #fee2e2; color: #991b1b; }
@media (max-width: 760px) { .settings-card, .settings-grid { grid-template-columns: 1fr; display: grid; } }
@media (max-width: 520px) {
  .customer-settings-content { padding: 1rem .75rem 2rem; }
  .settings-hero, .settings-card { padding: 1rem; border-radius: 1rem; }
  .settings-action-links { align-items: stretch; min-width: 0; }
  .settings-button { width: 100%; text-align: center; }
  .settings-notification-item { display: grid; }
  .settings-notification-actions { justify-content: flex-start; }
  .settings-pagination { flex-wrap: wrap; }
}
</style>
