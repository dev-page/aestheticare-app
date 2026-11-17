<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const account = ref(null), busy = ref(false), loading = ref(true), error = ref(''), detailsExpanded = ref(false)
const callbackCopied = ref(false)
let confirmedBase = OTP_BACKEND_CANDIDATES[0], unsubscribe
async function request(path, method = 'GET') {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw Error('Sign in to connect your hosting account.')
  const bases = method === 'GET' ? [...new Set([confirmedBase, ...OTP_BACKEND_CANDIDATES])] : [confirmedBase]
  let unreachableBackend = false
  for (const base of bases) {
    let response
    try {
      response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}` } })
    } catch (cause) {
      if (method !== 'GET') throw Error('Could not reach the Google Meet backend. Check that the OTP backend is running or deployed.')
      unreachableBackend = true
      continue
    }
    if (method === 'GET' && response.status === 404) continue
    const payload = await response.json().catch(() => null)
    if (!payload) throw Error('The Google Meet backend is unavailable. Restart or deploy the updated backend.')
    if (!response.ok || !payload.success) throw Error(payload.error || 'Unable to update your Google connection.')
    confirmedBase = base
    return payload.data
  }
  if (unreachableBackend) throw Error('Could not reach the Google Meet backend. In local development, start it with `npm run backend`; for the deployed app, check the `/api` backend deployment and its access settings.')
  throw Error('Deploy the updated Google Meet backend before connecting.')
}
async function load() {
  loading.value = true
  error.value = ''
  try { account.value = await request('/google-meet/account') }
  catch (cause) { account.value = null; error.value = cause.message }
  finally { loading.value = false }
}
async function connect() {
  busy.value = true; error.value = ''
  try {
    const { url } = await request('/google-meet/account/connect', 'POST')
    if (!url) throw Error('The backend did not return a Google authorization link. Deploy the updated backend and try again.')
    window.location.assign(url)
  } catch (cause) { error.value = cause.message; busy.value = false }
}
async function disconnect() {
  busy.value = true; error.value = ''
  try { await request('/google-meet/account/disconnect', 'POST'); await load() }
  catch (cause) { error.value = cause.message }
  finally { busy.value = false }
}
async function copyCallback() {
  if (!account.value?.redirectUri) return
  try {
    await navigator.clipboard.writeText(account.value.redirectUri)
    callbackCopied.value = true
    window.setTimeout(() => { callbackCopied.value = false }, 1800)
  } catch (_error) {
    error.value = 'Copy is unavailable in this browser. Select and copy the callback URL below.'
  }
}
onMounted(() => {
  unsubscribe = onAuthStateChanged(auth, user => {
    if (user) load()
    else { account.value = null; loading.value = false; error.value = 'Sign in to connect your hosting account.' }
  })
})
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <section class="google-hosting-account">
    <template v-if="account?.connected">
      <div class="connected-summary">
        <div>
          <h2>Google Meet connected</h2>
          <p>Hosting account: <strong>{{ account.email }}</strong></p>
        </div>
        <button type="button" class="secondary" :aria-expanded="detailsExpanded" aria-controls="google-hosting-details" @click="detailsExpanded = !detailsExpanded">{{ detailsExpanded ? 'Hide settings' : 'Manage account' }}</button>
      </div>
      <p v-if="!account.attendanceEnabled" class="attendance-notice">Reconnect this account to grant Google Meet participant access. Until then, attendance remains a manual check.</p>
      <div v-show="detailsExpanded" id="google-hosting-details" class="hosting-details">
        <p>Customers check in with their service code and wait in the virtual queue. Invite them to Meet when you are ready; the consultation timer starts only after both participants are detected and you start the session.</p>
        <div class="hosting-actions">
          <button :disabled="busy || loading || !account.configured" @click="connect">{{ !account.configured ? 'Google setup required' : !account.attendanceEnabled ? 'Reconnect to enable attendance' : 'Reconnect / change account' }}</button>
          <button :disabled="busy" class="secondary" @click="disconnect">Disconnect</button>
          <button v-if="error && !loading" type="button" class="secondary" @click="load">Retry setup check</button>
        </div>
        <p v-if="!account.configured" role="status">Administrator setup required: enable Google Calendar and Meet APIs, configure the OAuth client and callback URL, and add the backend environment secrets.</p>
        <div v-if="account.redirectUri" class="callback-setting">
          <p><strong>OAuth callback URL</strong><span>Register this exact URL in the Google OAuth client.</span></p>
          <code>{{ account.redirectUri }}</code>
          <button type="button" class="secondary callback-copy" @click="copyCallback">{{ callbackCopied ? 'Copied' : 'Copy URL' }}</button>
        </div>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
      </div>
    </template>
    <template v-else>
      <h2>Google Meet hosting account</h2>
      <p v-if="loading" role="status">Checking Google Meet connection and backend setup…</p>
      <p v-else-if="account?.configured">Connect your own Google account once. It may differ from your AesthetiCare email.</p>
      <p v-else-if="!account && error" role="status">Google Meet setup could not be checked. Use Retry setup check after confirming the clinic backend is available.</p>
      <p>Customers check in with their service code and wait in the virtual queue. Invite them to Meet when you are ready; the consultation timer starts only after both participants are detected and you start the session.</p>
      <div class="hosting-actions">
        <button :disabled="busy || loading || !account?.configured" @click="connect">{{ loading ? 'Checking setup…' : account && !account.configured ? 'Google setup required' : 'Connect Google account' }}</button>
        <button v-if="error && !loading" type="button" class="secondary" @click="load">Retry setup check</button>
      </div>
      <p v-if="account && !account.configured" role="status">Administrator setup required: enable Google Calendar and Meet APIs, configure the OAuth client and callback URL, and add the backend environment secrets.</p>
      <div v-if="account?.redirectUri" class="callback-setting">
        <p><strong>OAuth callback URL</strong><span>Register this exact URL in the Google OAuth client.</span></p>
        <code>{{ account.redirectUri }}</code>
        <button type="button" class="secondary callback-copy" @click="copyCallback">{{ callbackCopied ? 'Copied' : 'Copy URL' }}</button>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.google-hosting-account { margin-bottom: 24px; padding: 20px; border: 1px solid var(--ac-border); border-radius: 14px; background: var(--ac-surface); color: var(--ac-text); }
h2 { margin: 0; font-size: 18px; font-weight: 700; } p { margin: 8px 0; font-size: 13px; line-height: 1.6; color: var(--ac-text-secondary); }
.hosting-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
button { padding: 10px 14px; border: 1px solid var(--ac-primary); border-radius: 8px; background: var(--ac-primary); color: var(--ac-on-primary); font-size: 13px; font-weight: 600; }
button.secondary { background: var(--ac-surface); color: var(--ac-text-secondary); border-color: var(--ac-border-strong); } button:disabled { opacity: .5; cursor: not-allowed; } .error { color: var(--ac-danger); }.attendance-notice{padding:.65rem .8rem;border-radius:.65rem;background:var(--ac-warning-bg);color:var(--ac-warning)}
.connected-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.connected-summary p { margin-bottom: 0; }
.hosting-details { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ac-border); }
.callback-setting { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 14px; margin-top: 14px; padding: 12px; border: 1px solid var(--ac-border); border-radius: 10px; background: var(--ac-surface-soft); }
.callback-setting p { display: grid; margin: 0; }
.callback-setting p span { color: var(--ac-text-muted); font-size: 12px; }
.callback-setting code { grid-column: 1; min-width: 0; overflow-wrap: anywhere; color: var(--ac-text); font-size: 12px; }
.callback-copy { grid-column: 2; grid-row: 1 / span 2; }
button:focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 3px; }
@media (max-width: 560px) { .connected-summary { align-items: flex-start; flex-direction: column; } }
@media (max-width: 560px) { .callback-setting { grid-template-columns: minmax(0, 1fr); } .callback-copy { grid-column: 1; grid-row: auto; justify-self: start; } }
</style>
