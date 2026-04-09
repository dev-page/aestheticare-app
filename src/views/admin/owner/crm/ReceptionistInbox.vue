<template>
  <div class="flex module-theme bg-slate-900 min-h-screen text-white">
    <OwnerSidebar />

    <main class="flex-1 p-8 bg-slate-900">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Inbox</h1>
        <p class="text-slate-400">Incoming branch messages and requests.</p>
      </div>

      <div class="space-y-4">
        <div
          v-for="message in messages"
          :key="message.id"
          class="bg-slate-800 rounded-xl border border-slate-700 p-5"
          :class="!message.isRead ? 'border-blue-500/40' : ''"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-white font-semibold">{{ message.subject || 'No Subject' }}</p>
              <p class="text-slate-400 text-sm mt-1">From: {{ message.senderName || message.senderEmail || 'Unknown' }}</p>
              <p class="text-slate-300 text-sm mt-3 whitespace-pre-wrap">{{ message.body || 'No message body.' }}</p>
            </div>
            <div class="text-right">
              <p class="text-slate-400 text-xs">{{ formatDate(message.createdAt) }}</p>
              <button
                v-if="!message.isRead"
                @click="markAsRead(message)"
                class="mt-3 px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs"
              >
                Mark as read
              </button>
              <button
                v-if="message.type === 'chat' && message.threadId"
                @click="openChat(message)"
                class="mt-3 ml-2 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Open chat
              </button>
            </div>
          </div>
        </div>

        <div v-if="messages.length === 0" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
          No messages in inbox.
        </div>
      </div>
    </main>

    <div v-if="showChatModal" class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h3 class="text-white font-semibold">Chat with {{ activeChat?.customerName || activeChat?.senderName || 'Customer' }}</h3>
            <p class="text-xs text-slate-400">Branch: {{ activeChat?.branchId || currentBranchId || '-' }}</p>
          </div>
          <button type="button" class="text-slate-300 hover:text-white" @click="closeChat">
            ✕
          </button>
        </div>
        <div ref="chatScrollRef" class="px-4 py-4 max-h-[45vh] overflow-y-auto space-y-3">
          <div v-if="chatMessages.length === 0" class="text-sm text-slate-400 text-center">No messages yet.</div>
          <div
            v-for="chatMessage in chatMessages"
            :key="chatMessage.id"
            class="flex"
            :class="chatMessage.senderId === currentUserId ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
              :class="chatMessage.senderRole === 'system'
                ? 'bg-emerald-700 text-white'
                : chatMessage.senderId === currentUserId
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-100'"
            >
              <p v-if="chatMessage.senderRole === 'system'" class="text-[10px] uppercase tracking-wide text-emerald-100 mb-1">
                System reply
              </p>
              <p class="whitespace-pre-wrap">{{ chatMessage.text }}</p>
              <p class="mt-1 text-[10px] text-slate-300/80">{{ formatDate(chatMessage.createdAt) }}</p>
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-700">
          <div class="flex items-center gap-2">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Type your reply..."
              class="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              class="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
              @click="sendChatReply"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, setDoc, where, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'

export default {
  name: 'ReceptionistInbox',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const messages = ref([])
    const currentUserId = ref('')
    const showChatModal = ref(false)
    const activeChat = ref(null)
    const chatMessages = ref([])
    const chatInput = ref('')
    const chatScrollRef = ref(null)
    let chatUnsubscribe = null
    let unsubscribeMessages = null

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const startMessageListener = () => {
      if (!currentBranchId.value) return
      if (unsubscribeMessages) unsubscribeMessages()
      const messageQuery = query(collection(db, 'messages'), where('branchId', '==', currentBranchId.value))
      unsubscribeMessages = onSnapshot(messageQuery, (snapshot) => {
        const allMessages = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
        const chatGroups = new Map()
        const otherMessages = []

        allMessages.forEach((message) => {
          if (message.type === 'chat' && message.threadId) {
            const key = message.threadId
            const group = chatGroups.get(key) || {
              ...message,
              unreadCount: 0,
              isRead: true
            }

            const currentTime = group.createdAt?.seconds || 0
            const nextTime = message.createdAt?.seconds || 0
            const latest = nextTime >= currentTime ? message : group

            const unreadCount = group.unreadCount + (message.isRead ? 0 : 1)
            chatGroups.set(key, {
              ...latest,
              unreadCount,
              isRead: unreadCount === 0
            })
          } else {
            otherMessages.push(message)
          }
        })

        const groupedChats = Array.from(chatGroups.values())
        messages.value = [...groupedChats, ...otherMessages].sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        )
      })
    }

    const scrollChatToBottom = async () => {
      await nextTick()
      if (chatScrollRef.value) {
        chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
      }
    }

    const startChatListener = (threadId) => {
      if (!threadId) return
      if (chatUnsubscribe) chatUnsubscribe()
      const messageRef = collection(db, 'chatThreads', threadId, 'messages')
      const messageQuery = query(messageRef)
      chatUnsubscribe = onSnapshot(messageQuery, (snapshot) => {
        chatMessages.value = snapshot.docs
          .map((snap) => ({ id: snap.id, ...snap.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
        scrollChatToBottom()
      })
    }

    const stopChatListener = () => {
      if (chatUnsubscribe) {
        chatUnsubscribe()
        chatUnsubscribe = null
      }
    }

    const openChat = async (message) => {
      if (!message?.threadId) {
        toast.error('Chat thread is missing.')
        return
      }
      activeChat.value = message
      showChatModal.value = true
      startChatListener(message.threadId)
      if (message.unreadCount > 0 || !message.isRead) {
        await markThreadAsRead(message.threadId)
      }
    }

    const closeChat = () => {
      showChatModal.value = false
      chatInput.value = ''
      activeChat.value = null
      chatMessages.value = []
      stopChatListener()
    }

    const sendChatReply = async () => {
      const threadId = activeChat.value?.threadId
      if (!threadId) return
      if (!chatInput.value.trim()) {
        toast.error('Please enter a reply.')
        return
      }

      try {
        const replyText = chatInput.value.trim()
        chatInput.value = ''

        const payload = {
          text: replyText,
          senderId: currentUserId.value,
          senderName: 'Receptionist',
          senderRole: 'receptionist',
          createdAt: serverTimestamp()
        }

        await addDoc(collection(db, 'chatThreads', threadId, 'messages'), payload)

        await setDoc(
          doc(db, 'chatThreads', threadId),
          {
            lastMessage: replyText,
            lastMessageAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        )
      } catch (error) {
        console.error(error)
        toast.error('Failed to send reply.')
      }
    }

    const markAsRead = async (message) => {
      try {
        await updateDoc(doc(db, 'messages', message.id), {
          isRead: true,
          updatedAt: serverTimestamp()
        })
        message.isRead = true
        toast.success('Message marked as read.')
      } catch (error) {
        console.error(error)
        toast.error('Failed to update message.')
      }
    }

    const markThreadAsRead = async (threadId) => {
      try {
        const msgSnap = await getDocs(
          query(
            collection(db, 'messages'),
            where('branchId', '==', currentBranchId.value),
            where('threadId', '==', threadId)
          )
        )
        await Promise.all(
          msgSnap.docs.map((snap) =>
            updateDoc(doc(db, 'messages', snap.id), { isRead: true, updatedAt: serverTimestamp() })
          )
        )
      } catch (error) {
        console.error(error)
        toast.error('Failed to update messages.')
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        currentUserId.value = user.uid
        startMessageListener()
      })
    })

    onUnmounted(() => {
      if (unsubscribeMessages) unsubscribeMessages()
      stopChatListener()
    })

    return {
      messages,
      formatDate,
      markAsRead
      ,
      showChatModal,
      activeChat,
      chatMessages,
      chatInput,
      chatScrollRef,
      openChat,
      closeChat,
      sendChatReply,
      currentBranchId,
      currentUserId
    }
  }
}
</script>
