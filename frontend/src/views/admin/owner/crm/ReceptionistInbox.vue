<template>
  <div class="flex min-h-screen module-theme inbox-page">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'chat', rows: 5 }" class="inbox-main min-w-0 flex-1 p-4 md:p-8">
      <header class="inbox-heading"><p class="inbox-eyebrow">CRM & Clinic</p><h1>Inbox</h1><p>Keep customer and supplier conversations in one place.</p></header>
      <section class="messenger-workspace" :class="{ 'has-conversation': !!activeChat }" aria-label="Clinic messaging">
        <aside class="messenger-sidebar" aria-label="Conversation list">
          <div class="messenger-list-header"><h2>Chats</h2><span>{{ activeTab === 'customers' ? customerMessages.length : supplierChats.length }}</span></div>
          <nav class="inbox-tabs" aria-label="Inbox categories"><button type="button" class="inbox-tab" :class="{ 'is-active': activeTab === 'customers' }" :aria-current="activeTab === 'customers' ? 'page' : undefined" @click="switchTab('customers')">Customers</button><button type="button" class="inbox-tab" :class="{ 'is-active': activeTab === 'suppliers' }" :aria-current="activeTab === 'suppliers' ? 'page' : undefined" @click="switchTab('suppliers')">Suppliers</button></nav>
          <div class="messenger-list-tools"><label class="inbox-search" for="inbox-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input id="inbox-search" v-model.trim="search" type="search" placeholder="Search conversations" aria-label="Search conversations" /></label><label v-if="activeTab === 'customers'" class="inbox-unread-filter"><input v-model="unreadOnly" type="checkbox" /> Unread only <span>{{ unreadCount }}</span></label></div>
          <div class="messenger-thread-list">
            <template v-if="activeTab === 'customers'">
              <button v-for="message in filteredCustomers" :key="message.threadId || message.id" type="button" class="messenger-thread" :class="{ 'is-selected': activeChat?.kind === 'customer' && (activeChat.threadId ? activeChat.threadId === message.threadId : activeChat.id === message.id), 'is-unread': !message.isRead }" @click="openCustomerChat(message)">
                <span class="inbox-avatar" aria-hidden="true">{{ initials(message.senderName || message.customerName || message.senderEmail) }}</span><span class="messenger-thread-copy"><span class="messenger-thread-top"><strong>{{ message.customerName || message.senderName || message.senderEmail || 'Customer' }}</strong><span v-if="!message.isRead" class="unread-dot" aria-label="Unread conversation" /></span><span class="messenger-thread-topic">{{ message.subject || 'Customer conversation' }}</span><span class="messenger-thread-preview">{{ message.body || message.lastMessage || 'No message yet' }}</span><time>{{ formatDate(message.createdAt) }}</time></span>
              </button>
              <div v-if="!filteredCustomers.length" class="inbox-list-empty"><strong>{{ customerMessages.length ? 'No matching chats' : 'No customer messages yet' }}</strong><p>{{ customerMessages.length ? 'Try another search or turn off the unread filter.' : 'Customer conversations will appear here.' }}</p></div>
            </template>
            <template v-else>
              <p v-if="supplierError" class="inbox-error" role="alert">{{ supplierError }}</p>
              <button v-for="chat in filteredSuppliers" :key="chat.supplierId" type="button" class="messenger-thread" :class="{ 'is-selected': activeChat?.kind === 'supplier' && activeChat.supplierId === chat.supplierId }" @click="openSupplierChat(chat)"><span class="inbox-avatar supplier-avatar" aria-hidden="true">{{ initials(chat.supplierName) }}</span><span class="messenger-thread-copy"><span class="messenger-thread-top"><strong>{{ chat.supplierName }}</strong></span><span class="messenger-thread-preview">{{ chat.lastMessage || 'Start a conversation' }}</span><time v-if="chat.updatedAt">{{ formatDate(chat.updatedAt) }}</time></span></button>
              <div v-if="supplierLoading && !supplierChats.length" class="inbox-list-empty" role="status">Loading conversations...</div><div v-else-if="!supplierError && !filteredSuppliers.length" class="inbox-list-empty"><strong>{{ supplierChats.length ? 'No matching chats' : 'No suppliers linked yet' }}</strong><p>{{ supplierChats.length ? 'Try another search.' : 'Linked suppliers will appear here.' }}</p></div>
            </template>
          </div>
        </aside>
        <section class="messenger-chat" aria-label="Selected conversation">
          <template v-if="activeChat">
            <header class="messenger-chat-header"><button type="button" class="messenger-back" aria-label="Back to conversations" @click="closeChat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 6-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg></button><span class="inbox-avatar" aria-hidden="true">{{ initials(activeChatLabel) }}</span><div class="messenger-chat-person"><h2>{{ activeChatLabel }}</h2><p>{{ isSupplierChat ? 'Supplier conversation' : activeChat.threadId ? 'Customer conversation' : 'Customer message' }}</p></div><span v-if="isSupplierChat && activeChat.supplierStatus" class="inbox-status">{{ activeChat.supplierStatus }}</span></header>
            <div ref="chatScrollRef" class="messenger-message-list">
              <p v-if="chatError" class="inbox-error" role="alert">{{ chatError }}</p>
              <div v-if="chatLoading" class="chat-loading" role="status" aria-label="Loading conversation"><span /><span /><span /></div>
              <article v-else-if="!canReply" class="messenger-notice"><p class="inbox-eyebrow">CUSTOMER MESSAGE</p><h3>{{ activeChat.subject || 'Message details' }}</h3><p class="messenger-message-text">{{ activeChat.body || activeChat.lastMessage || 'No message body.' }}</p><time>{{ formatDate(activeChat.createdAt) }}</time><button v-if="!activeChat.isRead" type="button" class="inbox-secondary-action" @click="markAsRead(activeChat)">Mark as read</button></article>
              <div v-else-if="!chatMessages.length && !chatError" class="messenger-conversation-empty"><span class="inbox-avatar" aria-hidden="true">{{ initials(activeChatLabel) }}</span><h3>{{ activeChatLabel }}</h3><p>Start the conversation with a message below.</p></div>
              <div v-for="chatMessage in chatMessages" :key="chatMessage.id" class="messenger-message-row" :class="{ 'is-outgoing': chatMessage.senderId === currentUserId || chatMessage.senderRole === 'clinic' }"><div class="messenger-message-bubble"><p class="messenger-message-author">{{ chatMessage.senderId === currentUserId ? 'You' : chatMessage.senderLabel }}</p><p class="messenger-message-text">{{ chatMessage.text }}</p><time>{{ formatDate(chatMessage.createdAt) }}</time></div></div>
            </div>
            <form v-if="canReply" class="messenger-compose" @submit.prevent="sendChatReply"><div class="messenger-compose-row"><textarea id="inbox-reply" v-model="chatInput" rows="1" maxlength="4000" aria-label="Reply to conversation" placeholder="Write a message..." :disabled="sending" @keydown="handleReplyKey" /><button type="submit" class="messenger-send" :disabled="sending || chatLoading || !!chatError || !chatInput.trim()" :aria-label="sending ? 'Sending message' : 'Send message'"><svg v-if="!sending" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m21 3-7 18-4-7-7-4 18-7Z" stroke-linejoin="round" /><path d="m10 14 11-11" stroke-linecap="round" /></svg><span v-else class="send-spinner" /></button></div><p>Enter to send · Shift + Enter for a new line</p></form>
            <div v-else class="messenger-notice-footer">This message has no chat thread available for replies.</div>
          </template>
          <div v-else class="messenger-welcome"><div class="messenger-welcome-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" stroke-linejoin="round" /><path d="M8 12h8" stroke-linecap="round" /></svg></div><h2>Your conversations</h2><p>Select a customer or supplier to view messages and reply.</p></div>
        </section>
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { useRoute } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { toast } from 'vue3-toastify'

export default { name: 'ReceptionistInbox', components: { OwnerSidebar }, setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

  const db = getFirestore(getApp()), auth = getAuth(getApp())
  const route = useRoute()
  const activeTab = ref(route.query.tab === 'suppliers' ? 'suppliers' : 'customers'), currentBranchId = ref(''), customerMessages = ref([]), supplierChats = ref([]), supplierLoading = ref(false), supplierError = ref(''), currentUserId = ref('')
  const search = ref(''), unreadOnly = ref(false)
  const unreadCount = computed(() => customerMessages.value.filter(message => !message.isRead).length)
  const filteredCustomers = computed(() => customerMessages.value.filter(message => (!unreadOnly.value || !message.isRead) && [message.senderName, message.senderEmail, message.subject, message.body, message.lastMessage].some(value => String(value || '').toLowerCase().includes(search.value.toLowerCase()))))
  const filteredSuppliers = computed(() => supplierChats.value.filter(chat => [chat.supplierName, chat.supplierEmail, chat.lastMessage].some(value => String(value || '').toLowerCase().includes(search.value.toLowerCase()))))
  const activeChat = ref(null), chatMessages = ref([]), chatLoading = ref(false), chatError = ref(''), chatInput = ref(''), sending = ref(false), chatScrollRef = ref(null)
  let chatSession = 0
  let customerMessagesUnsubscribe = null, customerChatUnsubscribe = null, supplierChatPoll = null, authUnsubscribe = null
  const isSupplierChat = computed(() => activeChat.value?.kind === 'supplier')
  const canReply = computed(() => !!activeChat.value && (isSupplierChat.value || !!activeChat.value.threadId))
  const initials = value => String(value || 'C').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()
  const activeChatLabel = computed(() => isSupplierChat.value ? activeChat.value?.supplierName || 'Supplier' : activeChat.value?.customerName || activeChat.value?.senderName || activeChat.value?.senderEmail || 'Customer')
  const formatDate = value => { const date = value?.toDate?.() || (value?._seconds || value?.seconds ? new Date((value._seconds || value.seconds) * 1000) : value ? new Date(value) : null); return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Just now' }
  const api = async (path, body = null) => { const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''; if (!token) throw new Error('Sign in to continue.'); let lastError; for (const base of OTP_BACKEND_CANDIDATES) { try { const response = await fetch(`${base}/supply${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const payload = await response.json(); if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to complete the request.'); return payload.data } catch (error) { lastError = error } } throw lastError || new Error('Supplier chat is unavailable.') }
  const scrollChatToBottom = async () => { await nextTick(); if (chatScrollRef.value) chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight }
  const startCustomerMessagesListener = () => { if (!currentBranchId.value) return; if (customerMessagesUnsubscribe) customerMessagesUnsubscribe(); customerMessagesUnsubscribe = pageListener(onSnapshot, query(collection(db, 'messages'), where('branchId', '==', currentBranchId.value)), snapshot => { const grouped = new Map(); snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() })).forEach(message => { if (message.type !== 'chat' || !message.threadId) return grouped.set(message.id, message); const previous = grouped.get(message.threadId); const latest = (message.createdAt?.seconds || 0) >= (previous?.createdAt?.seconds || 0) ? message : previous; grouped.set(message.threadId, { ...latest, unreadCount: Number(previous?.unreadCount || 0) + (message.isRead ? 0 : 1), isRead: previous ? Boolean(previous.isRead) && Boolean(message.isRead) : Boolean(message.isRead) }) }); customerMessages.value = [...grouped.values()].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) }, () => toast.error('Customer messages are unavailable for your current access.', { toastId: 'customer-inbox-access' })) }
  const loadSupplierChats = async ({ background = false } = {}) => {
    const load = async () => { if (!currentBranchId.value) return; supplierLoading.value = true; supplierError.value = ''; try { const result = await api(`/chats?branchId=${encodeURIComponent(currentBranchId.value)}`); supplierChats.value = Array.isArray(result?.chats) ? result.chats : [] } catch (error) { supplierChats.value = []; supplierError.value = error.message || 'Supplier conversations are unavailable for your current access.' } finally { supplierLoading.value = false } }
    return background ? load() : trackPageLoad(load)()
  }
  const startCustomerChatListener = threadId => {
    const session = chatSession
    chatLoading.value = true
    customerChatUnsubscribe = onSnapshot(query(collection(db, 'chatThreads', threadId, 'messages')), snapshot => {
      if (session !== chatSession) return
      chatMessages.value = snapshot.docs.map(snap => { const message = snap.data() || {}; return { id: snap.id, text: message.text || '', senderId: message.senderId || '', senderRole: message.senderRole || '', senderLabel: message.senderName || message.senderRole || 'Customer', createdAt: message.createdAt } }).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      chatLoading.value = false
      chatError.value = ''
      scrollChatToBottom()
    }, () => {
      if (session !== chatSession) return
      chatLoading.value = false
      chatError.value = 'This customer conversation is unavailable for your current access.'
    })
  }
  const loadSupplierChatMessages = async ({ silent = false } = {}) => {
    const supplierId = activeChat.value?.supplierId, session = chatSession
    if (!supplierId || !isSupplierChat.value) return
    if (!silent) chatLoading.value = true
    try {
      const result = await api(`/chat?supplierId=${encodeURIComponent(supplierId)}`)
      if (session !== chatSession) return
      chatMessages.value = (result?.messages || []).map(message => ({ id: message.id, text: message.message || '', senderId: message.actorId || '', senderLabel: message.from || 'Supplier', createdAt: message.createdAt }))
      chatError.value = ''
      await scrollChatToBottom()
    } catch (error) { if (session === chatSession) chatError.value = error.message || 'This supplier conversation is unavailable.' }
    finally { if (session === chatSession && !silent) chatLoading.value = false }
  }
  const stopChatListeners = () => { chatSession++; if (customerChatUnsubscribe) { customerChatUnsubscribe(); customerChatUnsubscribe = null } if (supplierChatPoll) { clearInterval(supplierChatPoll); supplierChatPoll = null } }
  const markThreadAsRead = async threadId => { try { const snapshot = await getDocs(query(collection(db, 'messages'), where('branchId', '==', currentBranchId.value), where('threadId', '==', threadId))); await Promise.all(snapshot.docs.map(item => updateDoc(doc(db, 'messages', item.id), { isRead: true, updatedAt: serverTimestamp() }))) } catch (_) {} }
  const openCustomerChat = async message => {
    if (activeChat.value?.kind === 'customer' && (message.threadId ? activeChat.value.threadId === message.threadId : activeChat.value.id === message.id)) return
    stopChatListeners(); activeChat.value = { ...message, kind: 'customer' }; chatMessages.value = []; chatInput.value = ''; chatError.value = ''; chatLoading.value = false
    if (message.threadId) { startCustomerChatListener(message.threadId); if (!message.isRead) await markThreadAsRead(message.threadId) }
  }
  const openSupplierChat = async chat => {
    if (isSupplierChat.value && activeChat.value.supplierId === chat.supplierId) return
    stopChatListeners(); activeChat.value = { ...chat, kind: 'supplier' }; chatMessages.value = []; chatInput.value = ''; chatError.value = ''
    const session = chatSession
    await loadSupplierChatMessages()
    if (session === chatSession) supplierChatPoll = setInterval(() => loadSupplierChatMessages({ silent: true }), 15000)
  }
  const closeChat = () => { stopChatListeners(); activeChat.value = null; chatMessages.value = []; chatInput.value = ''; chatError.value = ''; chatLoading.value = false }
  const switchTab = tab => { if (activeTab.value === tab) return; closeChat(); activeTab.value = tab; search.value = '' }
  watch(() => route.query.tab, tab => switchTab(tab === 'suppliers' ? 'suppliers' : 'customers'))
  const handleReplyKey = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendChatReply() } }
  const sendChatReply = async () => {
    const text = chatInput.value.trim(), target = activeChat.value, session = chatSession
    if (!text || sending.value || chatLoading.value || chatError.value || !canReply.value) return
    sending.value = true
    try {
      if (target.kind === 'supplier') {
        await api(`/chat/${target.supplierId}/messages`, { message: text })
        if (session === chatSession) { chatInput.value = ''; await loadSupplierChatMessages({ silent: true }) }
        await loadSupplierChats({ background: true })
      } else {
        await addDoc(collection(db, 'chatThreads', target.threadId, 'messages'), { text, senderId: currentUserId.value, senderName: 'Clinic', senderRole: 'clinic', createdAt: serverTimestamp() })
        await setDoc(doc(db, 'chatThreads', target.threadId), { lastMessage: text, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
        if (session === chatSession) chatInput.value = ''
      }
    } catch (error) { toast.error(error.message || 'Failed to send message.') }
    finally { sending.value = false }
  }
  const markAsRead = async message => { try { if (message.threadId) await markThreadAsRead(message.threadId); else await updateDoc(doc(db, 'messages', message.id), { isRead: true, updatedAt: serverTimestamp() }); if (activeChat.value?.id === message.id) activeChat.value.isRead = true } catch (_) { toast.error('Failed to update the message.') } }
  onMounted(trackPageLoad(() => { authUnsubscribe = pageListener(onAuthStateChanged, auth, async user => { if (!user) return; currentUserId.value = user.uid; const userSnap = await getDoc(doc(db, 'users', user.uid)); currentBranchId.value = userSnap.exists() ? String(userSnap.data()?.branchId || '') : ''; if (!currentBranchId.value) return toast.error('Your account has no branch assignment.', { toastId: 'inbox-branch-assignment' }); startCustomerMessagesListener(); await loadSupplierChats() }) }))
  onUnmounted(() => { if (authUnsubscribe) authUnsubscribe(); if (customerMessagesUnsubscribe) customerMessagesUnsubscribe(); stopChatListeners() })
  return {
      pageLoading, search, unreadOnly, unreadCount, filteredCustomers, filteredSuppliers, activeTab, activeChat, canReply, chatError, initials, switchTab, handleReplyKey, customerMessages, supplierChats, supplierLoading, supplierError, currentUserId, activeChatLabel, isSupplierChat, chatMessages, chatLoading, chatInput, sending, chatScrollRef, formatDate, markAsRead, openCustomerChat, openSupplierChat, closeChat, sendChatReply }
} }
</script>

<style scoped>
.inbox-page { background: #fffdf9; color: #3d281d; }
.inbox-main { display: flex; flex-direction: column; }
.inbox-heading { margin-bottom: 22px; }
.inbox-eyebrow { color: #9b603d; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
.inbox-heading h1 { margin: 6px 0; font-size: 30px; font-weight: 700; color: #3d281d; }
.inbox-heading > p:last-child { color: #765d4c; font-size: 13px; line-height: 1.6; }
.messenger-workspace { display: grid; grid-template-columns: minmax(260px, 32%) minmax(0, 1fr); height: clamp(440px, calc(100dvh - 225px), 780px); overflow: hidden; border: 1px solid #ecd6be; border-radius: 16px; background: #fffdf9; box-shadow: 0 6px 24px #6e472909; }
.messenger-sidebar { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid #ecd6be; background: #fffdf9; }
.messenger-list-header { display: flex; align-items: center; gap: 10px; padding: 20px 20px 8px; }
.messenger-list-header h2 { font-size: 20px; font-weight: 700; color: #3d281d; }
.messenger-list-header > span, .inbox-unread-filter span { padding: 2px 8px; border-radius: 999px; background: #f3e7d7; color: #70482e; font-size: 11px; }
.inbox-tabs { display: flex; gap: 6px; margin: 0 16px; padding-bottom: 8px; border-bottom: 1px solid #ecd6be; }
.inbox-tab { flex: 1; padding: 12px 8px; border: 1px solid transparent; border-radius: 9px; color: #765d4c; font-size: 12px; font-weight: 600; }
.inbox-tab:hover { background: #f7ead8; }
.inbox-page .inbox-tabs .inbox-tab.is-active { background: #8d5a3b !important; color: #fffdf9 !important; border-color: #8d5a3b !important; }
.messenger-list-tools { padding: 16px; }
.inbox-search { display: flex; position: relative; }
.inbox-search svg { position: absolute; left: 12px; top: 13px; width: 17px; height: 17px; color: #9b7a60; pointer-events: none; }
.inbox-search input { width: 100%; min-height: 42px; padding: 10px 10px 10px 37px !important; border: 1px solid #dec19e; border-radius: 22px; background: #fffaf3; color: #3d281d; font-size: 12px; }
.inbox-unread-filter { display: flex; align-items: center; gap: 7px; margin-top: 12px; color: #765d4c; font-size: 11px; }
.inbox-unread-filter input { accent-color: #8d5a3b; }
.messenger-thread-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 12px; scrollbar-color: #cfaf90 #fffdf9; }
.messenger-thread { display: flex; width: 100%; gap: 12px; align-items: center; text-align: left; padding: 14px 10px; border: 1px solid transparent; border-radius: 11px; margin-bottom: 3px; background: transparent; color: #3d281d; }
.messenger-thread:hover { background: #fff8ed; }
.messenger-thread.is-selected { background: #f7ead8; border-color: #ead0af; }
.inbox-avatar { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; background: #f3e7d7; color: #8d5a3b; border: 1px solid #e3c9ad; font-size: 13px; font-weight: 700; }
.supplier-avatar { background: #edf1e8; color: #586547; border-color: #d9e0d0; }
.messenger-thread-copy { display: block; flex: 1; min-width: 0; }
.messenger-thread-top { display: flex; align-items: center; gap: 8px; }
.messenger-thread-top strong { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.is-unread .messenger-thread-top strong { font-weight: 750; }
.unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #a36a43; flex-shrink: 0; }
.messenger-thread-topic, .messenger-thread-preview, .messenger-thread-copy time { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px; font-size: 11px; color: #765d4c; }
.messenger-thread-topic { color: #5d4536; }
.messenger-thread-copy time { font-size: 10px; }
.inbox-list-empty { padding: 32px 16px; text-align: center; font-size: 12px; color: #765d4c; line-height: 1.7; }
.inbox-list-empty strong { display: block; color: #3d281d; font-size: 13px; margin-bottom: 6px; }
.messenger-chat { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #fffaf3; }
.messenger-chat-header { display: flex; align-items: center; gap: 12px; padding: 16px 22px; background: #fffdf9; border-bottom: 1px solid #ecd6be; }
.messenger-chat-person { min-width: 0; flex: 1; }
.messenger-chat-header h2 { color: #3d281d; font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.messenger-chat-header p { font-size: 11px; color: #765d4c; margin-top: 4px; }
.inbox-status { color: #635344; background: #f1ece5; border-radius: 999px; padding: 4px 9px; font-size: 10px; }
.messenger-back { display: none; }
.messenger-message-list { flex: 1; min-height: 0; overflow-y: auto; padding: 24px; scrollbar-color: #cfaf90 #fffaf3; }
.messenger-message-row { display: flex; margin-bottom: 14px; }
.messenger-message-row.is-outgoing { justify-content: flex-end; }
.messenger-message-bubble { max-width: 80%; padding: 12px 16px; border: 1px solid #ecd6be; border-radius: 17px 17px 17px 5px; background: #fffdf9; color: #3d281d; }
.is-outgoing .messenger-message-bubble { background: #f3e3cd; border-color: #e0be97; border-radius: 17px 17px 5px 17px; }
.messenger-message-author { font-size: 10px; font-weight: 700; color: #8d5a3b; margin-bottom: 5px; }
.messenger-message-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.7; }
.messenger-message-bubble time, .messenger-notice time { display: block; color: #765d4c; font-size: 10px; margin-top: 7px; }
.messenger-compose { padding: 16px 22px; border-top: 1px solid #ecd6be; background: #fffdf9; }
.messenger-compose-row { display: flex; align-items: flex-end; gap: 12px; }
.messenger-compose textarea { flex: 1; min-width: 0; min-height: 44px; max-height: 120px; padding: 12px 16px; border: 1px solid #dec19e !important; border-radius: 22px; background: #fffaf3 !important; color: #3d281d !important; font-size: 13px; resize: vertical; }
.messenger-compose > p { color: #765d4c; font-size: 10px; margin-top: 8px; }
.messenger-send { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; border: 1px solid #8d5a3b; background: #8d5a3b; color: #fffdf9; }
.messenger-send svg { width: 21px; height: 21px; }
.messenger-send:hover:not(:disabled) { background: #74462d; }
.messenger-send:disabled { opacity: .45; cursor: not-allowed; }
.messenger-welcome { display: grid; align-content: center; justify-items: center; height: 100%; padding: 32px; text-align: center; }
.messenger-welcome-icon { display: grid; place-items: center; width: 80px; height: 80px; border: 1px solid #ecd6be; background: #f7ead8; border-radius: 50%; color: #8d5a3b; margin-bottom: 20px; }
.messenger-welcome-icon svg { width: 36px; height: 36px; }
.messenger-welcome h2 { color: #3d281d; font-size: 23px; font-weight: 700; }
.messenger-welcome > p { max-width: 300px; color: #765d4c; font-size: 13px; line-height: 1.7; margin-top: 10px; }
.messenger-conversation-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; text-align: center; color: #765d4c; padding: 20px; }
.messenger-conversation-empty h3 { color: #3d281d; font-size: 18px; font-weight: 700; margin: 14px 0 8px; }
.messenger-conversation-empty p { font-size: 12px; }
.inbox-error { padding: 12px; border: 1px solid #edc1b9; background: #fceceb; color: #a13732; font-size: 12px; border-radius: 9px; margin: 8px; overflow-wrap: anywhere; }
.messenger-notice { padding: 22px; border: 1px solid #ecd6be; border-radius: 12px; background: #fffdf9; }
.messenger-notice h3 { font-size: 18px; font-weight: 700; margin: 8px 0 16px; }
.inbox-secondary-action { margin-top: 18px; padding: 9px 14px; border: 1px solid #dec19e; border-radius: 8px; color: #70482e; background: #fffdf9; font-size: 12px; }
.messenger-notice-footer { padding: 18px; font-size: 12px; color: #765d4c; border-top: 1px solid #ecd6be; background: #fffdf9; text-align: center; }
.chat-loading { display: flex; justify-content: center; gap: 8px; padding: 40px; }
.chat-loading span { width: 8px; height: 8px; border-radius: 50%; background: #c59a72; animation: inbox-pulse 1s infinite alternate; }
.chat-loading span:nth-child(2) { animation-delay: .15s; }.chat-loading span:nth-child(3) { animation-delay: .3s; }
.send-spinner { width: 18px; height: 18px; border: 2px solid #ffffff66; border-top-color: #fff; border-radius: 50%; animation: inbox-spin .8s linear infinite; }
.messenger-thread:focus-visible, .inbox-tab:focus-visible, .messenger-send:focus-visible, .messenger-back:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
@keyframes inbox-pulse { to { opacity: .3; transform: translateY(-3px); } } @keyframes inbox-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .chat-loading span, .send-spinner { animation: none; } }
@media(max-width: 820px) { .messenger-workspace { grid-template-columns: 1fr; height: max(480px, calc(100dvh - 205px)); max-height: 800px; } .messenger-sidebar { border-right: 0; } .messenger-chat { display: none; } .has-conversation .messenger-sidebar { display: none; } .has-conversation .messenger-chat { display: flex; } .messenger-back { display: grid; place-items: center; width: 30px; height: 34px; color: #8d5a3b; flex-shrink: 0; } .messenger-back svg { width: 22px; height: 22px; } .messenger-chat-header, .messenger-compose { padding: 14px; } .messenger-message-list { padding: 16px; } .messenger-message-bubble { max-width: 90%; } }
</style>
