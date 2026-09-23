<template>
  <div class="supplier-theme supplier-chat-page flex min-h-screen">
    <SupplierSidebar />

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <div class="mx-auto max-w-4xl space-y-6">
        <header class="supplier-page-header">
          <p class="supplier-eyebrow">Supplier Portal</p>
          <h1>Clinic Messages</h1>
          <p>Keep clinic conversations clear and connected to your supplier account.</p>
        </header>

        <p v-if="error" class="supplier-message-error" role="alert">
          <span>{{ error }}</span>
          <button type="button" class="supplier-retry-button" :disabled="loading" @click="supplierId ? load() : loadWorkspace()">
            {{ loading ? 'Retrying…' : 'Try again' }}
          </button>
        </p>

        <section v-if="loading" class="chat-shell" aria-label="Loading clinic messages" aria-busy="true">
          <div class="chat-heading"><span class="chat-skeleton chat-skeleton-title"></span><span class="chat-skeleton chat-skeleton-subtitle"></span></div>
          <div class="chat-thread chat-thread-loading">
            <div v-for="index in 3" :key="index" class="chat-skeleton-bubble" :class="{ outgoing: index === 2 }"></div>
          </div>
          <div class="chat-compose"><div class="chat-skeleton chat-skeleton-input"></div></div>
        </section>

        <section v-else-if="!error && !suppliers.length" class="chat-empty-panel">
          <span class="chat-empty-icon" aria-hidden="true">✦</span>
          <h2>No clinic linked yet</h2>
          <p>Clinic messages will appear here once your supplier account is connected to a clinic.</p>
          <RouterLink to="/supplier/profile" class="chat-profile-link">Review supplier profile</RouterLink>
        </section>

        <template v-else>
          <label v-if="suppliers.length > 1" class="chat-account-field">
            <span>Supplier account</span>
            <select v-model="supplierId" aria-label="Choose supplier account">
              <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                {{ supplier.businessName || supplier.name }}
              </option>
            </select>
          </label>

          <section class="chat-shell" aria-label="Clinic message conversation">
            <header class="chat-heading">
              <div>
                <p class="chat-heading-kicker">Conversation</p>
                <h2>{{ currentSupplier?.businessName || currentSupplier?.name || 'Clinic chat' }}</h2>
              </div>
              <span class="chat-connection-badge"><span></span> Clinic communication</span>
            </header>

            <div ref="thread" class="chat-thread" aria-label="Messages" aria-live="polite">
              <div v-if="!messages.length" class="chat-empty">
                <span aria-hidden="true">✦</span>
                <p>No messages yet</p>
                <small>Start the conversation with the clinic below.</small>
              </div>
              <article
                v-for="message in messages"
                :key="message.id"
                class="bubble"
                :class="message.from === 'Supplier' ? 'mine' : 'theirs'"
              >
                <p>{{ message.message }}</p>
                <small>{{ message.from }} <span aria-hidden="true">·</span> {{ date(message.createdAt) }}</small>
              </article>
            </div>

            <form class="chat-compose" @submit.prevent="send">
              <label for="supplier-chat-message">Message the clinic</label>
              <div class="chat-compose-row">
                <textarea
                  id="supplier-chat-message"
                  v-model.trim="draft"
                  rows="2"
                  maxlength="4000"
                  placeholder="Write a message…"
                  required
                ></textarea>
                <button type="submit" :disabled="sending || !draft">
                  <span aria-hidden="true">↗</span>
                  {{ sending ? 'Sending…' : 'Send message' }}
                </button>
              </div>
              <p class="chat-compose-hint">Messages are shared with the clinic linked to this account.</p>
            </form>
          </section>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup>
import './supplierTheme.css'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const loading = ref(true)
const sending = ref(false)
const error = ref('')
const suppliers = ref([])
const supplierId = ref('')
const messages = ref([])
const draft = ref('')
const thread = ref(null)

const currentSupplier = computed(() => suppliers.value.find((supplier) => supplier.id === supplierId.value))

const date = (value) => {
  const timestamp =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : value?._seconds || value?.seconds
          ? new Date((value._seconds || value.seconds) * 1000)
          : value
            ? new Date(value)
            : null

  return timestamp && !Number.isNaN(timestamp.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
    : 'Just now'
}

const api = async (path, body) => {
  await auth.authStateReady?.()
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in to continue.')

  let lastError
  for (const base of OTP_BACKEND_CANDIDATES) {
    try {
      const response = await fetch(`${base}/supply${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'The request could not be completed.')
      return result.data
    } catch (requestError) {
      lastError = requestError
    }
  }

  throw lastError || new Error('Chat service is unavailable.')
}

const scrollToLatest = async () => {
  await nextTick()
  thread.value?.scrollTo({ top: thread.value.scrollHeight, behavior: 'smooth' })
}

const load = async ({ showLoading = true } = {}) => {
  if (!supplierId.value) {
    messages.value = []
    return
  }

  if (showLoading) loading.value = true
  error.value = ''
  try {
    const result = await api(`/chat?supplierId=${encodeURIComponent(supplierId.value)}`)
    messages.value = result.messages || []
    await scrollToLatest()
  } catch (loadError) {
    error.value = loadError.message || 'Unable to load messages right now.'
  } finally {
    if (showLoading) loading.value = false
  }
}

const send = async () => {
  if (!supplierId.value || !draft.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await api(`/chat/${supplierId.value}/messages`, { message: draft.value })
    draft.value = ''
    await load({ showLoading: false })
  } catch (sendError) {
    error.value = sendError.message || 'Unable to send this message right now.'
  } finally {
    sending.value = false
  }
}

const loadWorkspace = async () => {
  loading.value = true
  error.value = ''
  try {
    const workspace = await api('/workspace')
    suppliers.value = (workspace.supplierIds || []).map((id) => ({ id, name: id }))
    supplierId.value = suppliers.value[0]?.id || ''
    await load()
  } catch (loadError) {
    error.value = loadError.message || 'Unable to open clinic messages right now.'
  } finally {
    loading.value = false
  }
}

onMounted(loadWorkspace)

watch(supplierId, (nextSupplierId, previousSupplierId) => {
  if (nextSupplierId && previousSupplierId) load()
})
</script>

<style scoped>
.supplier-page-header,.chat-empty-panel { border: 1px solid #4a3322; border-radius: 1.5rem; background: linear-gradient(180deg, rgba(47,31,21,.94), rgba(27,17,12,.96)); box-shadow: 0 20px 48px rgba(11,6,4,.24); }
.supplier-page-header { padding: clamp(1.2rem, 3vw, 1.8rem); }
.supplier-eyebrow,.chat-heading-kicker { margin: 0; color: #d6a878; font-size: .7rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.supplier-page-header h1 { margin: .55rem 0 0; color: #f2e2d2; font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 700; letter-spacing: -.035em; line-height: 1.12; }
.supplier-page-header > p:last-child { max-width: 44rem; margin: .65rem 0 0; color: #c8af97; font-size: .94rem; line-height: 1.6; }
.supplier-message-error { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0; border: 1px solid rgba(199,101,79,.5); border-radius: .9rem; background: rgba(99,35,27,.25); padding: .8rem 1rem; color: #f2b7a7; font-size: .9rem; }
.supplier-retry-button { flex: none; border: 1px solid rgba(199,101,79,.5); border-radius: .65rem; background: rgba(99,35,27,.3); padding: .45rem .7rem; color: #f4d7cc; font-size: .8rem; }
.supplier-retry-button:hover:not(:disabled) { background: rgba(123,49,37,.45); }
.chat-shell { overflow: hidden; border: 1px solid #4a3322; border-radius: 1.5rem; background: linear-gradient(180deg, rgba(36,24,15,.96), rgba(26,19,13,.98)); box-shadow: 0 18px 42px rgba(11,6,4,.26); }
.chat-account-field { display: grid; gap: .45rem; max-width: 28rem; color: #c8af97; font-size: .82rem; font-weight: 600; }
.chat-account-field select,.chat-compose textarea { width: 100%; border: 1px solid #6a4c33; border-radius: .8rem; background: #1a130d; padding: .8rem .9rem; color: #f2e2d2; outline: none; transition: border-color 160ms ease, box-shadow 160ms ease; }
.chat-account-field select:focus,.chat-compose textarea:focus { border-color: #b4875d; box-shadow: 0 0 0 3px rgba(180,135,93,.2); }
.chat-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.15rem 1.35rem; border-bottom: 1px solid #4a3322; background: rgba(47,32,21,.72); }
.chat-heading h2 { margin: .35rem 0 0; color: #f2e2d2; font-size: 1.12rem; font-weight: 650; }
.chat-connection-badge { display: inline-flex; align-items: center; gap: .45rem; border: 1px solid rgba(180,135,93,.35); border-radius: 999px; background: rgba(180,135,93,.1); padding: .4rem .65rem; color: #d6c0aa; font-size: .72rem; }
.chat-connection-badge span { width: .45rem; height: .45rem; border-radius: 50%; background: #b4875d; box-shadow: 0 0 0 3px rgba(180,135,93,.12); }
.chat-thread { display: flex; min-height: 22rem; max-height: min(58vh, 42rem); flex-direction: column; gap: .75rem; overflow-y: auto; padding: clamp(1rem, 3vw, 1.5rem); scroll-behavior: smooth; }
.bubble { width: fit-content; max-width: min(82%, 38rem); border: 1px solid #4a3322; border-radius: 1rem; padding: .75rem .9rem; color: #ead8ca; }
.bubble p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; line-height: 1.55; }
.bubble small { display: block; margin-top: .45rem; color: #c8af97; font-size: .68rem; }
.bubble.mine { align-self: flex-end; border-color: #8d5a3b; border-bottom-right-radius: .35rem; background: linear-gradient(145deg,#8d5a3b,#70452f); color: #fff8ef; }
.bubble.mine small { color: rgba(255,248,239,.75); }
.bubble.theirs { align-self: flex-start; border-bottom-left-radius: .35rem; background: #2f2015; }
.chat-empty { display: grid; flex: 1; align-content: center; justify-items: center; gap: .45rem; padding: 2.5rem 1rem; text-align: center; }
.chat-empty > span,.chat-empty-icon { color: #d6a878; font-size: 1.25rem; }
.chat-empty p { margin: 0; color: #f2e2d2; font-weight: 650; }
.chat-empty small,.chat-empty-panel p { max-width: 28rem; margin: 0; color: #c8af97; font-size: .86rem; line-height: 1.6; }
.chat-compose { border-top: 1px solid #4a3322; background: rgba(47,32,21,.5); padding: 1rem 1.25rem 1.15rem; }
.chat-compose > label { display: block; margin-bottom: .5rem; color: #d6c0aa; font-size: .8rem; font-weight: 600; }
.chat-compose-row { display: flex; align-items: flex-end; gap: .7rem; }
.chat-compose textarea { min-height: 3.2rem; max-height: 10rem; resize: vertical; }
.chat-compose textarea::placeholder { color: #aa9078; }
.chat-compose-row button,.chat-profile-link { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: .45rem; min-height: 2.8rem; border: 1px solid #b4875d; border-radius: .75rem; background: #b4875d; padding: .65rem .9rem; color: #1a130d; font-size: .84rem; font-weight: 700; transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease; }
.chat-compose-row button:hover:not(:disabled),.chat-profile-link:hover { transform: translateY(-1px); border-color: #c39770; background: #c39770; }
.chat-compose-row button:disabled { cursor: not-allowed; opacity: .5; }
.chat-compose-hint { margin: .5rem 0 0; color: #9f826a; font-size: .72rem; }
.chat-empty-panel { display: grid; justify-items: center; gap: .7rem; padding: clamp(2rem, 7vw, 4rem) 1.2rem; text-align: center; }
.chat-empty-panel h2 { margin: 0; color: #f2e2d2; font-size: 1.2rem; }
.chat-profile-link { margin-top: .35rem; text-decoration: none; }
.chat-thread-loading { justify-content: center; }
.chat-skeleton,.chat-skeleton-bubble { display: block; border-radius: .6rem; background: #3a281b; animation: chat-pulse 1.25s ease-in-out infinite alternate; }
.chat-skeleton-title { width: 10rem; height: 1rem; }
.chat-skeleton-subtitle { width: 7rem; height: .65rem; }
.chat-skeleton-bubble { width: min(65%, 25rem); height: 3.2rem; }
.chat-skeleton-bubble.outgoing { align-self: flex-end; width: min(52%, 20rem); }
.chat-skeleton-input { width: 100%; height: 3rem; }
@keyframes chat-pulse { to { opacity: .45; } }
@media (max-width: 600px) { .chat-heading { align-items: flex-start; flex-direction: column; padding: 1rem; } .chat-compose-row { align-items: stretch; flex-direction: column; } .chat-compose-row button { width: 100%; } .bubble { max-width: 92%; } .supplier-message-error { align-items: flex-start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .chat-thread { scroll-behavior: auto; } .chat-skeleton,.chat-skeleton-bubble { animation: none; } .chat-account-field select,.chat-compose textarea,.chat-compose-row button,.chat-profile-link { transition: none; } .chat-compose-row button:hover,.chat-profile-link:hover { transform: none; } }
</style>
