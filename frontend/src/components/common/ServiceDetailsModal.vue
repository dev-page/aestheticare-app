<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { lockPageScroll, unlockPageScroll } from '@/utils/scrollLock'
import { normalizeServiceCategory } from '../../../../shared/serviceCategories.js'
import { onlinePolicy } from '../../../../shared/onlineConsultation.js'

const props = defineProps({
  service: { type: Object, required: true },
  fallbackImage: { type: String, default: '' },
  consultation: { type: Object, default: null },
  policies: { type: Array, default: () => [] },
  selected: Boolean,
  needsConsultation: Boolean,
  busy: Boolean,
})
const emit = defineEmits(['close', 'book'])
const panel = ref(null)
const title = computed(() => props.service.title || props.service.name || 'Service details')
const online = computed(() => props.service.type === 'Consultation' && props.service.consultationMode === 'online')
const policy = computed(() => onlinePolicy(props.service.consultationPolicy))
const staffing = computed(() => Array.isArray(props.service.staffingRequirements) ? props.service.staffingRequirements.filter(member => member?.type && Number(member.count) > 0) : [])
const price = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const profession = value => ({ doctor: 'Doctor', nurse: 'Registered nurse', aesthetician: 'Aesthetician / facialist', other: 'Practitioner' }[value] || value)
let previousFocus
const onKeydown = event => {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab' || !panel.value) return
  const controls = [...panel.value.querySelectorAll('button:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element => element.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (!first) { event.preventDefault(); panel.value.focus(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  previousFocus = document.activeElement
  lockPageScroll()
  document.addEventListener('keydown', onKeydown)
  await nextTick()
  panel.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockPageScroll()
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="service-details-overlay" @click.self="emit('close')">
      <section ref="panel" class="service-details-dialog" role="dialog" aria-modal="true" aria-labelledby="service-details-title" tabindex="-1">
        <button type="button" class="service-details-close" aria-label="Close service details" @click="emit('close')"><Icon icon="lucide:x" width="20" /></button>
        <div class="service-details-layout">
          <div class="service-details-visual">
            <img :src="service.imageUrl || fallbackImage" :alt="title" />
            <span class="service-details-category">{{ service.type === 'Package' ? 'Treatment package' : service.type === 'Consultation' ? 'Consultation' : 'Clinic service' }}</span>
          </div>
          <div class="service-details-content">
            <header>
              <p class="service-details-eyebrow">Explore your treatment</p>
              <h2 id="service-details-title">{{ title }}</h2>
              <p class="service-details-price">{{ price(service.price) }}</p>
            </header>
            <dl class="service-details-facts">
              <div v-if="service.type !== 'Consultation'"><dt>Category</dt><dd>{{ normalizeServiceCategory(service.serviceCategory) }}</dd></div>
              <div><dt><Icon icon="lucide:clock-3" width="15" /> Duration</dt><dd>{{ service.durationMinutes ? `${service.durationMinutes} minutes` : 'Confirm with the clinic' }}</dd></div>
              <div><dt><Icon icon="lucide:calendar-days" width="15" /> Treatment sessions</dt><dd>{{ service.sessionCount || 1 }} {{ Number(service.sessionCount || 1) === 1 ? 'session' : 'sessions' }}</dd></div>
              <div v-if="service.type === 'Consultation'"><dt>Consultation mode</dt><dd>{{ online ? 'Online via Google Meet' : 'On-site' }}</dd></div>
              <div v-if="Number(service.sessionIntervalDays) > 0 && Number(service.sessionCount) > 1"><dt>Session interval</dt><dd>{{ service.sessionIntervalDays }} days</dd></div>
            </dl>
            <section class="service-details-section">
              <h3>About this service</h3>
              <p class="service-details-prose">{{ service.description || 'Contact the clinic for more information about this service.' }}</p>
            </section>
            <section v-if="service.packageServiceNames?.length" class="service-details-section">
              <h3>Included in the package</h3>
              <ul class="service-details-list"><li v-for="(name, index) in service.packageServiceNames" :key="index">{{ name }}</li></ul>
            </section>
            <section class="service-details-section">
              <h3>Before you book</h3>
              <div v-if="service.requiresConsultationFirst" class="service-details-notice">
                <Icon icon="lucide:stethoscope" width="20" />
                <div><strong>Consultation required first</strong><p>{{ consultation ? `Complete ${consultation.title || consultation.name} before booking this treatment.` : 'Complete the required consultation or ask the clinic to verify your previous consultation.' }}</p><p v-if="consultation">Consultation price: {{ price(consultation.price) }}</p></div>
              </div>
              <p v-else>A prior consultation is not required for booking this service.</p>
              <p class="service-details-follow-up">{{ service.followUpAllowed ? `Follow-ups are available${service.followUpWindowDays ? ` within ${service.followUpWindowDays} days` : ''}.` : 'Follow-up bookings are not enabled for this listing.' }}</p>
              <p v-if="Number(service.sessionCount) > 1">The clinic schedules subsequent treatment visits with you.</p>
            </section>
            <section v-if="staffing.length" class="service-details-section">
              <h3>Treatment team</h3>
              <ul class="service-details-list"><li v-for="(member, index) in staffing" :key="index">{{ member.count }} {{ profession(member.type) }} · {{ member.responsibility === 'lead' ? 'Lead practitioner' : 'Assisting practitioner' }}</li></ul>
            </section>
            <section v-if="online" class="service-details-section">
              <h3>Online consultation</h3>
              <p>Your full consultation duration begins at the verified start. You can enter five minutes early, with a {{ policy.graceMinutes }}-minute arrival grace period. Late arrivals and connection problems require clinic review.</p>
            </section>
            <section v-if="service.termsAndConditions" class="service-details-section"><h3>Service terms</h3><p class="service-details-prose">{{ service.termsAndConditions }}</p></section>
            <section v-if="policies.length" class="service-details-section">
              <h3>Clinic policies</h3>
              <details v-for="item in policies" :key="item.key" class="service-details-policy"><summary>{{ item.label }}<Icon icon="lucide:chevron-down" width="16" /></summary><p class="service-details-prose">{{ item.text }}</p></details>
            </section>
            <footer class="service-details-actions">
              <button type="button" class="service-details-book" :disabled="busy" @click="emit('book', false)">{{ busy ? 'Please wait…' : selected ? 'Remove from booking' : needsConsultation ? 'Book consultation first' : 'Add to Booking' }}<Icon icon="lucide:arrow-right" width="17" /></button>
              <button v-if="needsConsultation && !selected" type="button" class="service-details-verification" :disabled="busy" @click="emit('book', true)">Already consulted? Request verification</button>
            </footer>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.service-details-overlay { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: 24px; background: #24170f99; backdrop-filter: blur(5px); }
.service-details-dialog { position: relative; width: min(100%, 1040px); max-height: 90dvh; overflow-y: auto; border: 1px solid #e6cdb3; border-radius: 24px; background: #fffbf5; color: #493323; box-shadow: 0 28px 90px #24170f40; overscroll-behavior: contain; }
.service-details-dialog:focus { outline: none; }
.service-details-close { position: absolute; top: 16px; right: 16px; z-index: 2; display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #e6cdb3; border-radius: 50%; background: #fffdf8; color: #69472f; }
.service-details-layout { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
.service-details-visual { position: sticky; top: 0; height: min(760px, 90dvh); background: #f2e5d5; }
.service-details-visual img { width: 100%; height: 100%; min-height: 360px; object-fit: cover; }
.service-details-category { position: absolute; bottom: 24px; left: 24px; padding: 9px 15px; border-radius: 30px; background: #fffaf3ed; color: #67462f; font-size: 12px; font-weight: 600; }
.service-details-content { min-width: 0; padding: 36px 32px 28px; }
.service-details-content header { padding-right: 22px; }
.service-details-eyebrow { margin: 0 0 10px; color: #9a6845; font-size: 10px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
.service-details-content h2 { margin: 0; font-family: Georgia, serif; font-size: clamp(25px, 3vw, 34px); line-height: 1.2; overflow-wrap: anywhere; color: #3d281d; }
.service-details-price { margin: 16px 0 24px; color: #855335; font-size: 24px; font-weight: 600; }
.service-details-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 0; padding: 18px; border: 1px solid #edd9c3; border-radius: 14px; background: #f9efdf; }
.service-details-facts dt { display: flex; align-items: center; gap: 6px; color: #86654d; font-size: 11px; }
.service-details-facts dd { margin: 7px 0 0; font-size: 14px; font-weight: 600; }
.service-details-section { padding-top: 22px; }
.service-details-section h3 { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #493323; }
.service-details-section p, .service-details-list { margin: 0; color: #72543f; font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.service-details-prose { white-space: pre-wrap; }
.service-details-list { padding-left: 18px; }
.service-details-notice { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid #e8c6a0; border-radius: 12px; background: #fcf0df; }
.service-details-notice > svg { flex-shrink: 0; margin-top: 2px; color: #a16a3c; }
.service-details-notice strong { font-size: 13px; }
.service-details-section .service-details-follow-up { margin-top: 10px; }
.service-details-policy { margin-top: 8px; border: 1px solid #ecdbc7; border-radius: 10px; background: #fffdf9; }
.service-details-policy summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; list-style: none; cursor: pointer; font-size: 12px; font-weight: 600; }
.service-details-policy summary::-webkit-details-marker { display: none; }
.service-details-policy[open] summary svg { transform: rotate(180deg); }
.service-details-policy p { padding: 0 12px 12px; }
.service-details-actions { display: grid; gap: 12px; margin-top: 26px; padding-top: 20px; border-top: 1px solid #ead6bf; }
.service-details-book { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 46px; padding: 12px 18px; border: 0; border-radius: 12px; background: #8d5a3b; color: #fffaf3; font-size: 14px; font-weight: 600; }
.service-details-book:hover { background: #74472d; }
.service-details-verification { border: 0; background: transparent; color: #825534; font-size: 12px; text-decoration: underline; text-underline-offset: 3px; }
.service-details-actions button:disabled { opacity: .6; cursor: wait; }
.service-details-dialog button:focus-visible, .service-details-policy summary:focus-visible { outline: 3px solid #b88759; outline-offset: 3px; }
@media (max-width: 700px) { .service-details-overlay { padding: 12px; } .service-details-layout { grid-template-columns: 1fr; } .service-details-dialog { max-height: calc(100dvh - 24px); border-radius: 18px; } .service-details-visual { position: relative; height: 230px; } .service-details-visual img { min-height: 0; } .service-details-content { padding: 24px 20px; } .service-details-category { bottom: 16px; left: 16px; } }
</style>
