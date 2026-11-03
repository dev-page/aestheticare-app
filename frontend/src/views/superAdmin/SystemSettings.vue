<template>
  <div class="flex min-h-screen module-theme system-settings-page">
    <SuperAdminSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'settings', fields: 4, sections: 2 }" class="system-settings-main flex-1 p-4 sm:p-6 lg:p-8">
      <header class="system-settings-heading">
        <p class="system-settings-eyebrow">PLATFORM ADMINISTRATION</p>
        <h1>System Settings</h1>
        <p>Create maintenance notices, product updates, and announcements for the platform.</p>
      </header>

      <section class="post-composer">
        <div class="composer-intro">
          <div><p class="system-settings-eyebrow">CREATE A POST</p><h2>What would you like to share?</h2><p>Choose a post type to see the details needed for it.</p></div>
        </div>

        <div class="post-type-tabs" role="tablist" aria-label="Post type">
          <button v-for="type in postTypes" :key="type.key" type="button" role="tab" :id="`post-tab-${type.key}`" :aria-selected="activeType === type.key" :aria-controls="'post-form-panel'" :class="{ 'is-active': activeType === type.key }" @click="activeType = type.key">
            <span class="post-type-icon"><Icon :icon="type.icon" /></span><span><strong>{{ type.label }}</strong><small>{{ type.description }}</small></span>
          </button>
        </div>

        <form id="post-form-panel" class="post-form" role="tabpanel" :aria-labelledby="`post-tab-${activeType}`" @submit.prevent="publish">
          <div v-if="activeType === 'maintenance'" class="form-grid">
            <label class="form-field"><span>Maintenance title</span><input v-model.trim="draft.title" required maxlength="120" placeholder="e.g. Scheduled platform maintenance" /></label>
            <label class="form-field"><span>Expected impact</span><select v-model="draft.impact"><option value="limited">Some features may be unavailable</option><option value="unavailable">Platform may be unavailable</option><option value="none">No expected interruption</option></select></label>
            <label class="form-field"><span>Starts</span><input v-model="draft.startsAt" type="datetime-local" required /></label>
            <label class="form-field"><span>Ends</span><input v-model="draft.endsAt" type="datetime-local" required /></label>
            <label class="form-field form-field-wide"><span>Maintenance notice</span><textarea v-model.trim="draft.message" rows="4" required maxlength="3000" placeholder="Explain what is planned and what users should expect."></textarea></label>
          </div>

          <div v-else-if="activeType === 'update'" class="form-grid">
            <label class="form-field"><span>Update title</span><input v-model.trim="draft.title" required maxlength="120" placeholder="e.g. New appointment tools" /></label>
            <label class="form-field"><span>Release date</span><input v-model="draft.releaseDate" type="date" required /></label>
            <label class="form-field form-field-wide"><span>What changed?</span><textarea v-model.trim="draft.message" rows="5" required maxlength="3000" placeholder="Summarize new features, improvements, or fixes."></textarea></label>
          </div>

          <div v-else class="form-grid">
            <label class="form-field form-field-wide"><span>Announcement title</span><input v-model.trim="draft.title" required maxlength="120" placeholder="Give your announcement a clear title" /></label>
            <label class="form-field form-field-wide"><span>Message</span><textarea v-model.trim="draft.message" rows="5" required maxlength="3000" placeholder="Write the message you want users to see."></textarea></label>
            <label class="form-field"><span>Audience</span><select v-model="draft.audience"><option value="everyone">Everyone</option><option value="clinic_owners">Clinic owners and administrators</option><option value="customers">Customers</option></select></label>
            <label class="form-checkbox"><input v-model="draft.notifyByEmail" type="checkbox" /><span><strong>Also send by email</strong><small>Email delivery depends on a configured backend email worker.</small></span></label>
          </div>

          <div class="form-footer">
            <p v-if="formError" class="form-feedback form-feedback-error" role="alert">{{ formError }}</p>
            <p v-else-if="formSuccess" class="form-feedback form-feedback-success" role="status">{{ formSuccess }}</p>
            <span v-else class="form-hint">Posts are saved to the System Settings history.</span>
            <button type="submit" class="publish-button" :disabled="publishing"><Icon :icon="activeType === 'maintenance' ? 'mdi:calendar-check-outline' : 'mdi:send-outline'" /><span>{{ publishing ? 'Publishing…' : publishLabel }}</span></button>
          </div>
        </form>
      </section>

      <section class="recent-posts">
        <div class="recent-posts-heading"><div><p class="system-settings-eyebrow">POST HISTORY</p><h2>Recent posts</h2></div><span class="post-count">{{ announcements.length }} {{ announcements.length === 1 ? 'post' : 'posts' }}</span></div>
        <div v-if="loading" class="empty-posts">Loading posts…</div>
        <div v-else-if="!announcements.length" class="empty-posts">No posts yet. Published notices, updates, and announcements will appear here.</div>
        <ul v-else class="post-list">
          <li v-for="post in announcements" :key="post.id" class="post-item">
            <span class="post-type-badge" :class="`post-type-${post.type}`">{{ post.typeLabel }}</span>
            <div class="post-item-content"><div class="post-item-title-row"><h3>{{ post.title || post.message || 'Untitled post' }}</h3><span>{{ post.createdLabel }}</span></div><p v-if="post.title" class="post-item-message">{{ post.message || 'No message provided.' }}</p><p v-if="post.type === 'maintenance' && post.startsLabel" class="post-item-meta">{{ post.startsLabel }}<template v-if="post.endsLabel"> – {{ post.endsLabel }}</template> · {{ post.impactLabel }}</p><p v-if="post.type === 'update' && post.releaseDate" class="post-item-meta">Release date: {{ post.releaseDate }}</p><p v-if="post.type === 'announcement'" class="post-item-meta">Audience: {{ post.audienceLabel }}<template v-if="post.notifyByEmail"> · Email requested</template></p></div>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const auth = getAuth()
const postTypes = [
  { key: 'maintenance', label: 'Maintenance', icon: 'mdi:wrench-clock-outline', description: 'Schedule service work and set expectations.' },
  { key: 'update', label: 'Product update', icon: 'mdi:rocket-launch-outline', description: 'Share features, improvements, and fixes.' },
  { key: 'announcement', label: 'Announcement', icon: 'mdi:bullhorn-outline', description: 'Share a general message with users.' },
]
const activeType = ref('maintenance')
const announcements = ref([])
const loading = ref(true)
const publishing = ref(false)
const formError = ref('')
const formSuccess = ref('')
const unsubscribeAnnouncements = ref(null)
const localDateTime = (date) => {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
const draft = reactive({
  title: '', message: '', startsAt: localDateTime(new Date(Date.now() + 60 * 60 * 1000)), endsAt: localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  impact: 'limited', releaseDate: new Date().toISOString().slice(0, 10), audience: 'everyone', notifyByEmail: false,
})
const publishLabel = computed(() => activeType.value === 'maintenance' ? 'Publish maintenance notice' : activeType.value === 'update' ? 'Publish product update' : 'Publish announcement')
const typeLabels = { maintenance: 'Maintenance', update: 'Product update', announcement: 'Announcement' }
const impactLabels = { limited: 'Some features may be unavailable', unavailable: 'Platform may be unavailable', none: 'No expected interruption' }
const audienceLabels = { everyone: 'Everyone', clinic_owners: 'Clinic owners and administrators', customers: 'Customers' }
const asDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null
const formatDateTime = (value) => {
  const date = asDate(value)
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : ''
}
const resetDraft = () => {
  draft.title = ''
  draft.message = ''
  draft.startsAt = localDateTime(new Date(Date.now() + 60 * 60 * 1000))
  draft.endsAt = localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000))
  draft.impact = 'limited'
  draft.releaseDate = new Date().toISOString().slice(0, 10)
  draft.audience = 'everyone'
  draft.notifyByEmail = false
}
const validateDraft = () => {
  if (!draft.title.trim() || !draft.message.trim()) return 'Add a title and message before publishing.'
  if (activeType.value === 'maintenance') {
    const startsAt = new Date(draft.startsAt)
    const endsAt = new Date(draft.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return 'Choose valid maintenance start and end times.'
    if (endsAt <= startsAt) return 'The maintenance end time must be after the start time.'
  }
  return ''
}
const publish = async () => {
  formError.value = ''
  formSuccess.value = ''
  const validationError = validateDraft()
  if (validationError) { formError.value = validationError; return }
  publishing.value = true
  try {
    const type = activeType.value
    const startsAt = type === 'maintenance' ? new Date(draft.startsAt) : null
    const message = draft.message.trim()
    await addDoc(collection(db, 'systemAnnouncements'), {
      type,
      title: draft.title.trim(),
      message,
      scheduledAt: startsAt || serverTimestamp(),
      startsAt,
      endsAt: type === 'maintenance' ? new Date(draft.endsAt) : null,
      impact: type === 'maintenance' ? draft.impact : null,
      releaseDate: type === 'update' ? draft.releaseDate : null,
      audience: type === 'announcement' ? draft.audience : 'everyone',
      notifyByEmail: type === 'announcement' && !!draft.notifyByEmail,
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      published: true,
    })
    resetDraft()
    formSuccess.value = `${typeLabels[type]} published successfully.`
    toast.success(formSuccess.value)
  } catch (error) {
    console.error('Failed to publish system post:', error)
    formError.value = 'Could not publish this post. Please try again.'
    toast.error(formError.value)
  } finally {
    publishing.value = false
  }
}
const loadAnnouncements = () => {
  unsubscribeAnnouncements.value?.()
  loading.value = true
  const postsQuery = query(collection(db, 'systemAnnouncements'), orderBy('createdAt', 'desc'))
  unsubscribeAnnouncements.value = pageListener(onSnapshot, postsQuery, (snapshot) => {
    announcements.value = snapshot.docs.map((document) => {
      const data = document.data() || {}
      const type = ['maintenance', 'update', 'announcement'].includes(data.type) ? data.type : 'announcement'
      return {
        id: document.id,
        ...data,
        type,
        typeLabel: typeLabels[type],
        createdLabel: formatDateTime(data.createdAt),
        startsLabel: formatDateTime(data.startsAt || data.scheduledAt),
        endsLabel: formatDateTime(data.endsAt),
        impactLabel: impactLabels[data.impact] || 'Impact not specified',
        audienceLabel: audienceLabels[data.audience] || 'Everyone',
      }
    })
    loading.value = false
  }, (error) => {
    console.error('Failed to load system posts:', error)
    announcements.value = []
    loading.value = false
    toast.error('Unable to load recent posts.')
  })
}
onMounted(trackPageLoad(loadAnnouncements))
onUnmounted(() => unsubscribeAnnouncements.value?.())
</script>

<style scoped>
.system-settings-page { background: #fffdf9; color: #3d281d; }
.system-settings-main { min-width: 0; }
.system-settings-heading { margin: 4px 0 24px; }
.system-settings-eyebrow { margin: 0; color: #9b603d; font-size: 10px; font-weight: 700; letter-spacing: .16em; }
.system-settings-heading h1 { margin: 6px 0 8px; color: #3d281d; font-size: 30px; font-weight: 700; }
.system-settings-heading > p:last-child { margin: 0; color: #765d4c; font-size: 14px; }
.post-composer, .recent-posts { margin-bottom: 22px; overflow: hidden; border: 1px solid #ecd6be; border-radius: 14px; background: #fffdf9; box-shadow: 0 10px 24px rgba(92, 59, 37, .06); }
.composer-intro { padding: 22px 24px 18px; }
.composer-intro h2, .recent-posts-heading h2 { margin: 5px 0 4px; color: #3d281d; font-size: 20px; font-weight: 700; }
.composer-intro p:last-child { margin: 0; color: #765d4c; font-size: 13px; }
.post-type-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 0 24px 20px; }
.post-type-tabs button { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 13px; border: 1px solid #ecd6be; border-radius: 11px; background: #fffaf3; color: #5d4536; text-align: left; transition: border-color .15s, background .15s, box-shadow .15s; }
.post-type-tabs button:hover { border-color: #c99b73; background: #fff6e9; }
.post-type-tabs button.is-active { border-color: #8d5a3b; background: #f8eddc; box-shadow: inset 0 0 0 1px #8d5a3b; }
.post-type-icon { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border-radius: 10px; background: #fffdf9; color: #8d5a3b; font-size: 20px; }
.post-type-tabs strong, .post-type-tabs small { display: block; }
.post-type-tabs strong { color: #3d281d; font-size: 13px; }
.post-type-tabs small { margin-top: 3px; color: #765d4c; font-size: 11px; line-height: 1.4; }
.post-type-tabs button:focus-visible, .publish-button:focus-visible { outline: 3px solid #dab999; outline-offset: 2px; }
.post-form { padding: 22px 24px 20px; border-top: 1px solid #ecd6be; background: #fffaf3; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px 16px; }
.form-field { display: block; min-width: 0; }
.form-field-wide { grid-column: span 2; }
.form-field > span { display: block; margin-bottom: 7px; color: #5d4536; font-size: 12px; font-weight: 700; }
.form-field input, .form-field textarea, .form-field select { box-sizing: border-box; width: 100%; min-height: 42px; padding: 10px 12px; border: 1px solid #dec19e; border-radius: 9px; background: #fffdf9; color: #3d281d; font: inherit; font-size: 13px; }
.form-field textarea { min-height: 112px; resize: vertical; line-height: 1.55; }
.form-field :is(input, textarea, select):focus { border-color: #8d5a3b; outline: 3px solid #f2dec6; }
.form-field input::placeholder, .form-field textarea::placeholder { color: #a18a76; }
.form-checkbox { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid #ecd6be; border-radius: 9px; background: #fffdf9; }
.form-checkbox input { width: 16px; height: 16px; margin-top: 2px; accent-color: #8d5a3b; }
.form-checkbox strong, .form-checkbox small { display: block; }
.form-checkbox strong { color: #5d4536; font-size: 12px; }
.form-checkbox small { margin-top: 3px; color: #765d4c; font-size: 11px; line-height: 1.4; }
.form-footer { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; }
.form-hint, .form-feedback { margin: 0; color: #765d4c; font-size: 12px; }
.form-feedback-error { color: #a13732; }
.form-feedback-success { color: #70482e; }
.publish-button { display: inline-flex; min-height: 42px; flex: 0 0 auto; align-items: center; justify-content: center; gap: 8px; padding: 9px 16px; border: 1px solid #8d5a3b; border-radius: 9px; background: #8d5a3b; color: #fffdf9; font-size: 13px; font-weight: 700; }
.publish-button:hover { background: #74462d; }
.publish-button:disabled { opacity: .6; cursor: wait; }
.recent-posts { padding: 20px 24px; }
.recent-posts-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 15px; }
.recent-posts-heading h2 { margin-bottom: 0; }
.post-count { padding: 5px 9px; border-radius: 999px; background: #f1ece5; color: #635344; font-size: 11px; font-weight: 700; }
.post-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.post-item { display: flex; align-items: flex-start; gap: 13px; padding: 15px; border: 1px solid #ecd6be; border-radius: 11px; background: #fffaf3; }
.post-type-badge { flex: 0 0 auto; padding: 5px 8px; border: 1px solid #dec19e; border-radius: 999px; background: #f8eddc; color: #70482e; font-size: 10px; font-weight: 700; }
.post-type-update { background: #f1ece5; }
.post-type-maintenance { background: #fff0d5; }
.post-item-content { min-width: 0; flex: 1; }
.post-item-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.post-item-title-row h3 { margin: 0; color: #3d281d; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.post-item-title-row > span { flex: 0 0 auto; color: #8e7967; font-size: 11px; }
.post-item-message { margin: 5px 0 0; color: #5d4536; font-size: 13px; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.post-item-meta { margin: 7px 0 0; color: #765d4c; font-size: 11px; }
.empty-posts { padding: 22px; border: 1px dashed #dec19e; border-radius: 10px; color: #765d4c; font-size: 13px; text-align: center; }
@media (max-width: 820px) { .post-type-tabs { grid-template-columns: 1fr; } .post-type-tabs button { padding: 11px 13px; } }
@media (max-width: 640px) { .system-settings-main { padding: 20px 16px; } .composer-intro, .post-form { padding: 18px 16px; } .post-type-tabs { padding: 0 16px 16px; } .form-grid { grid-template-columns: 1fr; } .form-field-wide { grid-column: span 1; } .form-footer { align-items: stretch; flex-direction: column; } .publish-button { width: 100%; } .recent-posts { padding: 18px 16px; } .post-item { flex-direction: column; } .post-item-title-row { align-items: flex-start; flex-direction: column; gap: 4px; } }
</style>
