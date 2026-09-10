<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />
    <main class="flex-1 p-8">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">System Settings</h1>
        <p class="text-slate-400">Global system settings, maintenance windows, and announcements.</p>
      </div>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
        <h2 class="text-xl text-white mb-4">Schedule Maintenance / Announcement</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-slate-400">Maintenance Date</label>
            <input type="date" v-model="date" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
          </div>
          <div>
            <label class="text-xs text-slate-400">Maintenance Time (start)</label>
            <input type="time" v-model="time" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100" />
          </div>
        </div>

        <div class="mt-4">
          <label class="text-xs text-slate-400">Announcement Message</label>
          <textarea v-model="message" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"></textarea>
        </div>

        <div class="mt-4 flex items-center gap-4">
          <label class="inline-flex items-center gap-2 text-slate-200">
            <input type="checkbox" v-model="notifyByEmail" />
            <span class="text-sm">Also send announcement by email (requires backend email worker)</span>
          </label>

          <button class="ml-auto px-4 py-2 bg-emerald-600 rounded text-white" @click="publish">Publish Announcement</button>
        </div>

        <p class="mt-3 text-sm text-slate-400">Recommendation: notifications are delivered to users' in-app notifications by default. Email sends require a backend job to deliver — enabling will store a flag that a worker can pick up and send emails.</p>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h2 class="text-xl text-white mb-4">Recent Announcements</h2>
        <div v-if="loading" class="text-slate-300">Loading...</div>
        <div v-else>
          <ul>
            <li v-for="ann in announcements" :key="ann.id" class="bg-slate-900 border border-slate-700 rounded p-3 mb-3">
              <div class="flex justify-between items-start">
                <div>
                  <p class="text-slate-200 font-medium">{{ ann.message }}</p>
                  <p class="text-xs text-slate-400">Scheduled: {{ ann.scheduledAt }}</p>
                </div>
                <div class="text-xs text-slate-400">By: {{ ann.createdBy || 'System' }}</div>
              </div>
            </li>
          </ul>
          <div v-if="!announcements.length" class="text-slate-400">No announcements yet.</div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import { db } from '@/config/firebaseConfig'
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export default {
  name: 'SystemSettings',
  components: { SuperAdminSidebar },
  setup() {
    const date = ref(new Date().toISOString().slice(0,10))
    const time = ref('00:00')
    const message = ref('')
    const notifyByEmail = ref(false)
    const loading = ref(false)
    const announcements = ref([])
    let unsubscribeAnnouncements = null

    const auth = getAuth()

    const publish = async () => {
      if (!message.value.trim()) return alert('Announcement message is required')
      const scheduled = new Date(`${date.value}T${time.value}:00`)
      try {
        await addDoc(collection(db, 'systemAnnouncements'), {
          message: message.value.trim(),
          scheduledAt: scheduled,
          notifyByEmail: !!notifyByEmail.value,
          createdBy: auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
          published: true,
        })
        message.value = ''
        notifyByEmail.value = false
        alert('Announcement published. If email option selected, a backend worker should send emails.')
        loadAnnouncements()
      } catch (e) {
        console.error('Failed to publish announcement', e)
        alert('Failed to publish announcement')
      }
    }

    const loadAnnouncements = () => {
      if (unsubscribeAnnouncements) unsubscribeAnnouncements()
      loading.value = true
      announcements.value = []
      const q = query(collection(db, 'systemAnnouncements'), orderBy('createdAt','desc'))
      unsubscribeAnnouncements = onSnapshot(q, (snap) => {
        const rows = []
        snap.forEach((d) => {
          const data = d.data() || {}
          rows.push({ id: d.id, message: data.message, scheduledAt: data.scheduledAt ? (data.scheduledAt.toDate ? data.scheduledAt.toDate().toLocaleString() : String(data.scheduledAt)) : '-', createdBy: data.createdBy || null })
        })
        announcements.value = rows
        loading.value = false
      }, (e) => {
        console.error('Failed to load announcements', e)
        loading.value = false
      })
    }

    onMounted(loadAnnouncements)
    onUnmounted(() => unsubscribeAnnouncements?.())

    return { date, time, message, notifyByEmail, publish, loading, announcements }
  }
}
</script>
