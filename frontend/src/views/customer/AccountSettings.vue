<template>
  <div class="customer-settings-shell flex min-h-screen">
    <CustomerSidebar class="flex-shrink-0" />

    <main class="customer-settings-main flex-1">
      <div class="customer-settings-content">
        <section class="settings-hero">
          <p class="settings-eyebrow">Account & Settings</p>
          <h1 class="settings-title">Account Settings</h1>
          <p class="settings-subtitle">Manage your account access and choose what should happen to your customer account.</p>
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
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'account' }]" @click="activeTab = 'account'">Account Access</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'help' }]" @click="activeTab = 'help'">Help & Guidance</button>
          <button type="button" :class="['settings-tab', { 'settings-tab-active': activeTab === 'privacy' }]" @click="activeTab = 'privacy'">Privacy & Data</button>
        </nav>

        <section v-if="activeTab === 'account'" class="settings-tab-panel">
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
import { computed, onMounted, ref, watch } from 'vue'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import { auth, db } from '@/config/firebaseConfig'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'

const accountEmail = ref('')
const activeTab = ref('account')
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

watch(activeTab, () => {
  message.value = ''
  errorMessage.value = ''
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
</style>
