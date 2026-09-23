<template>
  <main class="owner-recovery-page">
    <section class="owner-recovery-card" aria-labelledby="owner-recovery-title">
      <p class="owner-recovery-kicker">Owner access recovery</p>
      <h1 id="owner-recovery-title">Restore your clinic-owner access</h1>
      <p class="owner-recovery-copy">
        Your owner-only closure is still recoverable. Restore access before
        <strong>{{ recoveryEndsLabel }}</strong> and your clinic branches and staff will remain unchanged.
      </p>
      <div class="owner-recovery-note">
        <strong>This does not reverse ownership transfers or clinic shutdowns.</strong>
        <span>Those actions require a System Administrator because they affect other people and business records.</span>
      </div>
      <p v-if="error" class="owner-recovery-error" role="alert">{{ error }}</p>
      <div class="owner-recovery-actions">
        <button type="button" class="owner-recovery-secondary" :disabled="busy" @click="leaveClosed">Keep account closed</button>
        <button type="button" class="owner-recovery-primary" :disabled="busy" @click="restoreAccess">{{ busy ? 'Restoring…' : 'Restore owner access' }}</button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/config/firebaseConfig'

const router = useRouter()
const busy = ref(false)
const error = ref('')
const recoveryEndsAt = ref(null)

const asDate = (value) => typeof value?.toDate === 'function' ? value.toDate() : new Date(value || 0)
const isOwner = (data = {}, uid = '') => {
  const value = String(data.role || data.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  return ['owner', 'clinicadmin', 'clinicadministrator'].includes(value) || (Boolean(uid) && String(data.branchId || '').trim() === uid)
}
const eligible = (data = {}, uid = '') => {
  const end = asDate(data.accountRecoveryEndsAt)
  return isOwner(data, uid)
    && String(data.status || '').trim().toLowerCase() === 'inactive'
    && data.archived === true && data.accountClosed === true
    && String(data.accountClosureAction || '').trim().toLowerCase() === 'deactivate'
    && !Number.isNaN(end.getTime()) && end.getTime() > Date.now()
}
const recoveryEndsLabel = computed(() => {
  const date = asDate(recoveryEndsAt.value)
  return Number.isNaN(date.getTime()) ? 'the end of the recovery period' : new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
})
const leaveClosed = async () => { await signOut(auth); router.replace('/login') }
const restoreAccess = async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return router.replace('/login')
  busy.value = true; error.value = ''
  try {
    const userRef = doc(db, 'users', currentUser.uid)
    const snapshot = await getDoc(userRef)
    const data = snapshot.exists() ? snapshot.data() || {} : {}
    if (!eligible(data, currentUser.uid)) throw new Error('This recovery period is no longer available. Please contact the System Administrator.')
    await updateDoc(userRef, {
      status: 'Active', archived: false, accountClosed: false, accountClosureAction: null,
      accountRecoveryEndsAt: null, accountReactivatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await router.replace('/clinic/dashboard')
  } catch (cause) {
    console.error('Failed to restore owner account:', cause)
    error.value = cause?.message || 'We could not restore owner access right now.'
  } finally { busy.value = false }
}
onMounted(async () => {
  const currentUser = auth.currentUser
  if (!currentUser) return router.replace('/login')
  const snapshot = await getDoc(doc(db, 'users', currentUser.uid))
  const data = snapshot.exists() ? snapshot.data() || {} : {}
  if (!eligible(data, currentUser.uid)) return leaveClosed()
  recoveryEndsAt.value = data.accountRecoveryEndsAt
})
</script>

<style scoped>
.owner-recovery-page { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; background: radial-gradient(circle at top, #563323, #24160f 58%, #160d09); color: #f3e7e0; }
.owner-recovery-card { width: min(100%, 36rem); padding: 2.25rem; border: 1px solid #71472f; border-radius: 1.5rem; background: rgba(42, 24, 15, .97); box-shadow: 0 1.5rem 3.5rem rgba(0, 0, 0, .35); }
.owner-recovery-kicker { margin: 0 0 .65rem; color: #d8a47c; font-size: .72rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: 0; font-family: Georgia, serif; font-size: clamp(2rem, 6vw, 2.7rem); line-height: 1.08; }
.owner-recovery-copy { margin: 1rem 0 1.5rem; color: #e2c7b6; line-height: 1.65; }
.owner-recovery-note { display: grid; gap: .35rem; padding: 1rem; border: 1px solid #6d452f; border-radius: .9rem; background: #351e12; color: #d9bca9; font-size: .92rem; }
.owner-recovery-note strong { color: #f3e7e0; }.owner-recovery-error { margin: 1rem 0 0; color: #ff9d92; font-size: .9rem; }
.owner-recovery-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.75rem; }.owner-recovery-actions button { border-radius: .75rem; padding: .78rem 1rem; font-weight: 700; cursor: pointer; }
.owner-recovery-primary { border: 1px solid #b8794f; background: #8d5a3b; color: #fff; }.owner-recovery-secondary { border: 1px solid #70452f; background: transparent; color: #f3e7e0; }.owner-recovery-actions button:disabled { cursor: wait; opacity: .65; }
@media (max-width: 28rem) { .owner-recovery-card { padding: 1.5rem; }.owner-recovery-actions { align-items: stretch; flex-direction: column-reverse; } }
</style>
