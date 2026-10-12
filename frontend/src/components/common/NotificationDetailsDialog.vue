<template>
  <Modal :is-open="isOpen" panel-class="notification-dialog-panel" body-class="notification-dialog-body" :panel-style="{ backgroundColor: '#fffdf9', color: '#493225' }" @close="$emit('close')">
    <template #header>
      <div class="notification-dialog-heading">
        <p class="notification-dialog-eyebrow">Notification</p>
        <h2>{{ notification?.title || 'Notification details' }}</h2>
      </div>
    </template>
    <template #body>
      <div v-if="notification" class="notification-dialog-content">
        <p class="notification-dialog-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {{ dateLabel }}
        </p>
        <p class="notification-dialog-message">{{ notification.message || 'No additional details provided.' }}</p>
      </div>
    </template>
    <template #footer>
      <div class="notification-dialog-actions">
        <button type="button" class="notification-dialog-dismiss" @click="$emit('close')">Dismiss</button>
        <RouterLink :to="destination.to" class="notification-dialog-open" @click="$emit('close')">
          {{ destination.label }}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </RouterLink>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Modal from './Modal.vue'
import { notificationDestination } from '@/utils/notificationDestination'

const props = defineProps({
  isOpen: Boolean,
  notification: { type: Object, default: null },
  userType: { type: String, default: '' },
  role: { type: String, default: '' }
})
defineEmits(['close'])
const router = useRouter()
const destination = computed(() => {
  const result = notificationDestination(props.notification || {}, props)
  return router.resolve(result.to).matched.some(record => !record.path.includes(':pathMatch'))
    ? result : notificationDestination({}, props)
})
const dateLabel = computed(() => {
  const value = props.notification?.createdAt
  const date = value?.toDate ? value.toDate() : new Date(value || props.notification?.createdAtMs || NaN)
  return Number.isNaN(date.getTime()) ? props.notification?.createdLabel || 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
})
</script>

<style>
/* The dialog is teleported outside the page theme. Keep its palette explicit. */
.app-modal-panel.notification-dialog-panel { width: min(100%, 520px) !important; max-width: 520px !important; border: 1px solid #e8ceb3 !important; border-radius: 18px !important; background: #fffdf9 !important; color: #493225 !important; box-shadow: 0 24px 80px #2d1b1333; }
.notification-dialog-panel > div:first-child { padding: 24px !important; align-items: flex-start; border-color: #efddca !important; background: #fffdf9 !important; }
.notification-dialog-panel > div:first-child > button { display: grid; place-items: center; width: 34px; height: 34px; flex-shrink: 0; border: 1px solid #ead4bd; border-radius: 9px; color: #79583f !important; background: #fff8ee !important; }
.notification-dialog-panel > div:first-child > button:hover { background: #f5e7d6 !important; }
.notification-dialog-panel .notification-dialog-body { padding: 22px 24px 28px !important; background: #fffdf9 !important; }
.notification-dialog-panel > div:last-child { border-color: #efddca !important; }
.notification-dialog-heading { min-width: 0; }
.notification-dialog-heading .notification-dialog-eyebrow { margin: 0 0 8px; color: #a2714c !important; font-size: 10px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
.notification-dialog-heading h2 { margin: 0; color: #493225 !important; font-size: 22px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.notification-dialog-date { display: flex; align-items: center; gap: 8px; margin: 0 0 18px; color: #897260 !important; font-size: 12px; }
.notification-dialog-date svg { width: 16px; height: 16px; flex-shrink: 0; }
.notification-dialog-message { margin: 0; color: #594333 !important; font-size: 14px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.notification-dialog-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.notification-dialog-dismiss, .notification-dialog-open { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 42px; padding: 10px 16px; border: 1px solid #dfc2a5; border-radius: 9px; font-size: 13px; font-weight: 600; text-decoration: none; }
.notification-dialog-dismiss { color: #79583f !important; background: #fffdf9 !important; }
.notification-dialog-open { color: #fffdf9 !important; background: #8d5a3b !important; border-color: #8d5a3b; }
.notification-dialog-open:hover { background: #74462d !important; }
.notification-dialog-dismiss:hover { background: #fff5e8 !important; }
.notification-dialog-open svg { width: 18px; height: 18px; }
.notification-dialog-panel button:focus-visible, .notification-dialog-open:focus-visible { outline: 2px solid #b78055; outline-offset: 3px; }
@media (max-width: 480px) { .notification-dialog-actions { flex-wrap: wrap; } .notification-dialog-open { flex: 1; } }
</style>
