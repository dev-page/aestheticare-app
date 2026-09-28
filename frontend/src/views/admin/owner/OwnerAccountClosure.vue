<template>
  <div class="flex min-h-screen owner-theme bg-[#2a180f] text-[#f3e7e0]">
    <OwnerSidebar />
    <main class="flex-1 px-4 py-6 md:px-8 closure-page-shell">
      <div class="mx-auto max-w-5xl space-y-6">
        <section class="rounded-[2rem] border border-[#5a3927] bg-[#24160f] p-6 shadow-[0_24px_60px_rgba(20,12,8,0.45)]">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-[#d2b7a6]">Account access</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#f3e7e0]">Close clinic account</h1>
          <p class="mt-3 max-w-3xl text-sm leading-6 text-[#e2c7b6]">Close your clinic directly. No System Administrator approval is required.</p>
        </section>

        <section class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-6">
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#70452f] bg-[#3a2417] text-[#d8a47c]"><Icon icon="mdi:store-remove-outline" class="h-6 w-6" /></div>
              <div><h2 class="text-lg font-semibold text-[#f3e7e0]">What happens immediately</h2><p class="mt-2 text-sm leading-6 text-[#e2c7b6]">Your clinic is taken offline while its information is placed on hold.</p></div>
            </div>
            <div class="mt-6 space-y-3">
              <div v-for="item in effects" :key="item.title" class="rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                <p class="text-sm font-semibold text-[#f3e7e0]">{{ item.title }}</p><p class="mt-1 text-xs leading-5 text-[#d2b7a6]">{{ item.description }}</p>
              </div>
            </div>
          </article>

          <aside class="rounded-[1.75rem] border border-[#75452b] bg-[#2c180e] p-6">
            <div class="flex items-center gap-3 text-[#f0c38d]"><Icon icon="mdi:clock-outline" class="h-6 w-6" /><h2 class="text-lg font-semibold">30-day recovery period</h2></div>
            <p class="mt-3 text-sm leading-6 text-[#e2c7b6]">Your clinic information, branch data, employee records, and audit logs are held for 30 days. Signing in during that period restores your clinic and re-enables the employee accounts locked by this closure.</p>
            <p class="mt-3 text-sm leading-6 text-[#e2c7b6]">After 30 days, the closure becomes permanent and the held clinic information is deleted.</p>
            <div class="mt-6 space-y-3 border-t border-[#5a3927] pt-5">
              <label class="flex items-start gap-3 rounded-2xl border border-[#5a3927] bg-[#24160f] p-4"><input v-model="acknowledged" type="checkbox" class="mt-1 h-4 w-4 accent-[#b8794f]" /><span class="text-sm leading-6 text-[#e2c7b6]">I understand that the clinic will be unpublished and employee access will be disabled until I restore the account.</span></label>
              <label class="block text-sm font-semibold text-[#f3e7e0]" for="closure-confirmation">Type <span class="text-[#f0c38d]">CLOSE MY ACCOUNT</span> to confirm</label>
              <input id="closure-confirmation" v-model.trim="confirmation" type="text" placeholder="CLOSE MY ACCOUNT" class="w-full rounded-xl border border-[#5a3927] bg-[#24160f] px-4 py-3 text-[#f3e7e0] outline-none focus:border-[#b8794f]" />
              <p v-if="error" class="text-sm text-[#ffb0a5]" role="alert">{{ error }}</p>
              <button type="button" class="w-full rounded-xl bg-[#a84c3a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#8e3e30] disabled:cursor-not-allowed disabled:opacity-60" :disabled="!canClose || closing" @click="closeAccount">{{ closing ? 'Closing clinic account…' : 'Close clinic account' }}</button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { signOut } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'

const CONFIRMATION = 'CLOSE MY ACCOUNT'
const acknowledged = ref(false)
const confirmation = ref('')
const closing = ref(false)
const error = ref('')
const effects = [
  { title: 'Clinic is unpublished', description: 'Customers can no longer find or book your clinic.' },
  { title: 'Employee access is disabled', description: 'Employees cannot sign in while the owner account is closed.' },
  { title: 'Data is held for 30 days', description: 'Clinic, branch, and audit information remains recoverable during the hold.' },
]
const canClose = computed(() => acknowledged.value && confirmation.value.toUpperCase() === CONFIRMATION)

const callBackend = async (path, options) => {
  let lastError = null
  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to close the clinic account.')
      return payload
    } catch (cause) { lastError = cause }
  }
  throw lastError || new Error('Unable to reach the account service.')
}

const closeAccount = async () => {
  if (!canClose.value || closing.value) return
  const currentUser = auth.currentUser
  if (!currentUser) { error.value = 'Please sign in again before closing the clinic account.'; return }
  closing.value = true
  error.value = ''
  try {
    const token = await currentUser.getIdToken()
    await callBackend('/owner/account/close', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } })
    await signOut(auth)
    toast.success('Clinic account closed. Sign in within 30 days to restore it.')
    window.location.assign('/login')
  } catch (cause) {
    console.error('Unable to close clinic account:', cause)
    error.value = cause?.message || 'Unable to close the clinic account.'
  } finally { closing.value = false }
}
</script>

<style scoped>
.closure-page-shell { background: radial-gradient(circle at top left, rgba(141, 90, 59, .16), transparent 28%), linear-gradient(180deg, #2a180f 0%, #24160f 52%, #1a100b 100%); }
</style>
