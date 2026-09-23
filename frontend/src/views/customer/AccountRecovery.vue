<template>
  <main class="recovery-page">
    <section class="recovery-card" aria-labelledby="recovery-title">
      <p class="recovery-kicker">Account recovery</p>
      <h1 id="recovery-title">{{ mode === 'deletion' ? 'Your deletion request is pending' : 'Your account is temporarily deactivated' }}</h1>
      <p class="recovery-copy">
        Your profile and records are still protected. {{ mode === 'deletion' ? 'Cancel the deletion request before' : 'Reactivate before' }}
        <strong>{{ recoveryEndsLabel }}</strong> to return to AesthetiCare.
      </p>

      <div class="recovery-note">
        <strong>{{ mode === 'deletion' ? 'Changed your mind?' : 'Ready to come back?' }}</strong>
        <span>{{ mode === 'deletion' ? 'Canceling the request keeps your account and records active. Nothing is deleted.' : 'Reactivation restores your customer account immediately. Nothing is deleted.' }}</span>
      </div>

      <p v-if="error" class="recovery-error" role="alert">{{ error }}</p>

      <div class="recovery-actions">
        <button type="button" class="recovery-secondary" :disabled="busy" @click="signOutAndReturn">
          Stay deactivated
        </button>
        <button type="button" class="recovery-primary" :disabled="busy" @click="recover">
          {{ busy ? 'Saving…' : mode === 'deletion' ? 'Cancel deletion request' : 'Reactivate account' }}
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'

const router = useRouter()
const busy = ref(false)
const error = ref('')
const recoveryEndsAt = ref(null)
const mode = ref('deactivation')

const asDate = (value) => {
  if (typeof value?.toDate === 'function') return value.toDate()
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const recoveryEndsLabel = computed(() => {
  const date = asDate(recoveryEndsAt.value)
  if (!date) return 'the end of your recovery period'
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
})

const isEligible = (data = {}) => {
  const role = String(data.role || data.userType || '').trim().toLowerCase()
  const end = asDate(data.accountRecoveryEndsAt)
  return role === 'customer'
    && data.accountDeactivationRequested === true
    && String(data.status || '').trim().toLowerCase() === 'inactive'
    && end && end.getTime() > Date.now()
}

const hasDeletionWindow = (data = {}) => {
  const role = String(data.role || data.userType || '').trim().toLowerCase()
  const end = asDate(data.accountDeletionScheduledFor)
  return role === 'customer' && data.accountDeletionRequested === true && end && end.getTime() > Date.now()
}

const signOutAndReturn = async () => {
  await signOut(auth)
  router.replace('/login')
}

const recover = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return router.replace('/login')
  busy.value = true
  error.value = ''
  try {
    const userRef = doc(db, 'users', currentUser.uid)
    const snapshot = await getDoc(userRef)
    const data = snapshot.exists() ? snapshot.data() || {} : {}
    if (hasDeletionWindow(data)) {
      const requests = await getDocs(query(
        collection(db, 'accountClosureRequests'),
        where('ownerId', '==', currentUser.uid),
        where('requestType', '==', 'customer_account_deletion'),
      ))
      await Promise.all(requests.docs
        .filter((request) => ['pending', 'approved'].includes(String(request.data()?.status || '').toLowerCase()))
        .map((request) => updateDoc(request.ref, {
          status: 'cancelled',
          reviewStatus: 'Cancelled by customer',
          cancellationReason: 'Customer signed in and cancelled the deletion request during the recovery period.',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })))
      await updateDoc(userRef, {
        accountDeletionRequested: false,
        accountDeletionRequestedAt: null,
        accountDeletionReason: null,
        accountDeletionScheduledFor: null,
        accountDeletionCancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await router.replace('/customer/home')
      return
    }
    if (!isEligible(data)) {
      throw new Error('This recovery period is no longer available. Please contact the system administrator.')
    }
    await updateDoc(userRef, {
      status: 'Active',
      accountDeactivationRequested: false,
      accountDeactivationReason: null,
      accountRecoveryEndsAt: null,
      accountReactivatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await router.replace('/customer/home')
  } catch (cause) {
    console.error('Failed to reactivate customer account:', cause)
    error.value = cause?.message || 'We could not restore your account right now. Please try again.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return router.replace('/login')
  const snapshot = await getDoc(doc(db, 'users', currentUser.uid))
  const data = snapshot.exists() ? snapshot.data() || {} : {}
  if (hasDeletionWindow(data)) {
    mode.value = 'deletion'
    recoveryEndsAt.value = data.accountDeletionScheduledFor
    return
  }
  if (!isEligible(data)) return signOutAndReturn()
  recoveryEndsAt.value = data.accountRecoveryEndsAt
})
</script>

<style scoped>
.recovery-page { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: radial-gradient(circle at top, #fff7ec, #f3e5d2 58%, #ead4b8); color: #321b12; }
.recovery-card { width: min(100%, 34rem); padding: 2.25rem; border: 1px solid #e6c6a3; border-radius: 1.5rem; background: rgba(255, 253, 250, .97); box-shadow: 0 1.5rem 3.5rem rgba(83, 45, 22, .15); }
.recovery-kicker { margin: 0 0 .65rem; color: #a7653b; font-size: .72rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(2rem, 6vw, 2.7rem); line-height: 1.08; }
.recovery-copy { margin: 1rem 0 1.5rem; color: #76594b; line-height: 1.65; }
.recovery-note { display: grid; gap: .35rem; padding: 1rem; border: 1px solid #efd3b4; border-radius: .9rem; background: #fff5e8; color: #76594b; font-size: .92rem; }
.recovery-note strong { color: #6c3f26; }
.recovery-error { margin: 1rem 0 0; color: #ae3d35; font-size: .9rem; }
.recovery-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.75rem; }
.recovery-actions button { border-radius: .75rem; padding: .78rem 1rem; font-weight: 700; cursor: pointer; }
.recovery-primary { border: 1px solid #6f3e24; background: #754226; color: #fff; }
.recovery-secondary { border: 1px solid #dcbda1; background: #fff; color: #754226; }
.recovery-actions button:disabled { cursor: wait; opacity: .65; }
@media (max-width: 28rem) { .recovery-card { padding: 1.5rem; } .recovery-actions { align-items: stretch; flex-direction: column-reverse; } }
</style>
