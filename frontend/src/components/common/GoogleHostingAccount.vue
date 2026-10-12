<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const account = ref(null), busy = ref(false), error = ref('')
let confirmedBase = OTP_BACKEND_CANDIDATES[0], unsubscribe
async function request(path, method = 'GET') {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw Error('Sign in to connect your hosting account.')
  const bases = method === 'GET' ? [...new Set([confirmedBase, ...OTP_BACKEND_CANDIDATES])] : [confirmedBase]
  for (const base of bases) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${token}` } })
    if (method === 'GET' && response.status === 404) continue
    const payload = await response.json().catch(() => null)
    if (!payload) throw Error('The Google Meet backend is unavailable. Restart or deploy the updated backend.')
    if (!response.ok || !payload.success) throw Error(payload.error || 'Unable to update your Google connection.')
    confirmedBase = base
    return payload.data
  }
  throw Error('Deploy the updated Google Meet backend before connecting.')
}
async function load() { try { account.value = await request('/google-meet/account') } catch (cause) { error.value = cause.message } }
async function connect() {
  busy.value = true; error.value = ''
  try { const { url } = await request('/google-meet/account/connect', 'POST'); window.location.assign(url) }
  catch (cause) { error.value = cause.message; busy.value = false }
}
async function disconnect() {
  busy.value = true; error.value = ''
  try { await request('/google-meet/account/disconnect', 'POST'); await load() }
  catch (cause) { error.value = cause.message }
  finally { busy.value = false }
}
onMounted(() => { unsubscribe = onAuthStateChanged(auth, user => { if (user) load() }) })
onUnmounted(() => unsubscribe?.())
</script>

<template>
  <section class="google-hosting-account">
    <div><h2>Google Meet hosting account</h2>
      <p v-if="account?.connected">Hosting account: <strong>{{ account.email }}</strong>. Join Google Meet using this account.</p>
      <p v-else>Connect your own Google account once. It may differ from your AesthetiCare email.</p>
      <p>Customers submit their service code to generate the meeting automatically. You join as host, then start the consultation when both are ready.</p>
    </div>
    <div class="hosting-actions"><button :disabled="busy || !account?.configured" @click="connect">{{ account?.connected ? 'Reconnect / change account' : 'Connect Google account' }}</button><button v-if="account?.connected" :disabled="busy" class="secondary" @click="disconnect">Disconnect</button></div>
    <p v-if="account && !account.configured" role="status">Google account connections need administrator setup before use.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.google-hosting-account { margin-bottom: 24px; padding: 20px; border: 1px solid #e8cfb2; border-radius: 14px; background: #fffdf9; color: #493225; }
h2 { margin: 0; font-size: 18px; font-weight: 700; } p { margin: 8px 0; font-size: 13px; line-height: 1.6; color: #79614f; }
.hosting-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
button { padding: 10px 14px; border: 1px solid #8d5a3b; border-radius: 8px; background: #8d5a3b; color: white; font-size: 13px; font-weight: 600; }
button.secondary { background: white; color: #79583f; border-color: #dfc2a5; } button:disabled { opacity: .5; cursor: not-allowed; } .error { color: #a33127; }
</style>
