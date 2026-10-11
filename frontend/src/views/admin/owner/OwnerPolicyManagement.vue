<template>
  <div class="module-theme flex min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'settings', fields: 4, sections: 2 }" class="min-w-0 flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-5xl">
        <h1 class="text-3xl font-bold">Policy &amp; Contract Management</h1>
        <p class="mt-2 text-slate-400">Manage your clinic policies and the agreement customers review and sign.</p>
        <nav class="policy-contract-tabs" aria-label="Policy and contract management tabs">
          <button type="button" :class="{ 'is-active': activeTab === 'policies' }" :aria-pressed="activeTab === 'policies'" @click="activeTab = 'policies'">Policies</button>
          <button type="button" :class="{ 'is-active': activeTab === 'contract' }" :aria-pressed="activeTab === 'contract'" @click="activeTab = 'contract'">Client Contract</button>
        </nav>
        <template v-if="activeTab === 'policies'">

        <div class="mt-4 flex flex-col gap-3 rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>Services:</strong> Turn on only the policies your clinic will enforce. Use the edit button to set each enabled policy.</p>
          <span class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold" :class="canManagePolicies ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-500 bg-slate-800 text-slate-300'">{{ canManagePolicies ? 'Editing enabled' : 'View only' }}</span>
        </div>

        <section class="mt-8 rounded-2xl border border-slate-700 bg-slate-800 p-6">
          <h2 class="text-xl font-semibold">Services</h2>
          <p class="mt-1 text-sm text-slate-400">These settings apply when customers book an appointment for a clinic service.</p>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <article v-for="policy in servicePolicies" :key="policy.id" class="rounded-2xl border border-slate-700 bg-slate-900/60 p-5" :class="!isPolicyAvailable(policy) ? 'opacity-55' : ''">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="font-semibold text-slate-100">{{ policy.title }}</h3>
                  <p class="mt-1 text-sm text-slate-400">{{ policy.description }}</p>
                </div>
                <label class="relative inline-flex shrink-0 cursor-pointer items-center" :title="isPolicyAvailable(policy) ? (form[policy.enabledKey] ? 'Disable policy' : 'Enable policy') : 'Available with Basic or Premium'">
                  <input v-model="form[policy.enabledKey]" :disabled="!canManagePolicies || !isPolicyAvailable(policy)" type="checkbox" role="switch" :aria-label="policy.title" :aria-checked="form[policy.enabledKey]" class="peer sr-only" />
                  <span class="policy-switch-track" aria-hidden="true"></span>
                </label>
              </div>
              <div class="mt-5 flex items-center justify-between gap-3 border-t border-slate-700 pt-4">
                <span class="text-xs font-medium" :class="isPolicyAvailable(policy) && form[policy.enabledKey] ? 'text-emerald-300' : 'text-slate-500'">{{ isPolicyAvailable(policy) ? (form[policy.enabledKey] ? 'Enabled' : 'Disabled') : 'Basic or Premium required' }}</span>
                <button v-if="form[policy.enabledKey]" type="button" :disabled="!canManagePolicies || !isPolicyAvailable(policy)" @click="openEditor(policy.id)" class="inline-flex items-center gap-2 rounded-lg border border-amber-500/60 px-3 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"><Icon icon="mdi:pencil" class="h-4 w-4" /> Edit</button>
                <span v-else class="text-xs text-slate-500">Enable to configure</span>
              </div>
            </article>
          </div>
          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-5">
            <span class="text-xs text-slate-500">Last saved: {{ savedAt ? formatDate(savedAt) : 'Not saved yet' }}</span>
            <button type="button" :disabled="saving || !canManagePolicies" @click="savePolicies" class="rounded-xl bg-amber-600 px-5 py-3 font-semibold transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{{ saving ? 'Saving...' : canManagePolicies ? 'Save Services Policies' : 'View-only access' }}</button>
          </div>
        </section>

        <section class="walk-in-policy-section mt-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div><h2 class="text-xl font-semibold">Walk-In Policy</h2><p class="mt-1 text-sm text-slate-400">Rules for services, consultations, and packages provided to clients who visit the clinic.</p></div>
            <span class="rounded-full border px-3 py-1 text-xs font-semibold" :class="form.walkInPolicyEnabled ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-600 bg-slate-900 text-slate-400'">{{ form.walkInPolicyEnabled ? 'Enabled' : 'Disabled' }}</span>
          </div>
          <div class="mt-5 grid overflow-hidden rounded-2xl border border-slate-700 lg:grid-cols-2">
            <div class="space-y-4 bg-slate-900/60 p-5">
              <div><p class="text-sm font-semibold text-slate-100">Policy settings</p><p class="mt-1 text-xs leading-5 text-slate-400">Turn this policy on to display and enforce it during walk-in checkout.</p></div>
              <PolicyToggle v-model="form.walkInPolicyEnabled" :disabled="!canManagePolicies" label="Enable Walk-In Policy" description="Enabled by default for payment-first walk-in services." />
              <div class="space-y-3" :class="!form.walkInPolicyEnabled ? 'pointer-events-none opacity-45' : ''">
                <div class="rounded-xl border border-slate-700 bg-slate-950/40 p-4"><div class="flex items-center gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-300"><Icon icon="mdi:cash-check" class="h-5 w-5" /></span><div><p class="text-sm font-medium text-slate-100">Payment First</p><p class="mt-1 text-xs text-slate-400">Full payment is required before a walk-in service starts.</p></div></div></div>

                <PolicyToggle v-model="form.walkInPolicyAcknowledgementRequired" :disabled="!canManagePolicies || !form.walkInPolicyEnabled" label="Confirm policy acknowledgement" description="Require staff to confirm the service details and applicable policies with the client before payment." />
              </div>
            </div>
            <aside class="border-t border-slate-700 bg-slate-950/40 p-5 lg:border-l lg:border-t-0"><div class="flex items-center gap-2 text-amber-200"><Icon icon="mdi:information-outline" class="h-5 w-5" /><h3 class="font-semibold">How this policy works</h3></div><div class="mt-4 space-y-4 text-sm leading-6 text-slate-300"><p>This policy applies when a client visits the clinic for a service, consultation, or treatment package.</p><ul class="space-y-3 text-slate-400"><li>Full payment is required before the service starts.</li><li>Appointments follow the clinic's applicable payment, cancellation, rescheduling, and no-show policies.</li><li>Before recording payment, staff verifies the selected service, price, session details, and applicable policies with the client.</li></ul></div></aside>
          </div>
          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-5"><span class="text-xs text-slate-500">Last saved: {{ savedAt ? formatDate(savedAt) : 'Not saved yet' }}</span><button type="button" :disabled="saving || !canManagePolicies" @click="savePolicies" class="rounded-xl bg-amber-600 px-5 py-3 font-semibold transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{{ saving ? 'Saving...' : canManagePolicies ? 'Save Walk-In Policy' : 'View-only access' }}</button></div>
        </section>
        </template>
        <section v-else class="client-contract-editor">
          <div class="contract-editor-heading"><div><h2>Client Contract</h2><p>This agreement applies to both online and walk-in bookings. Enabled policies become part of the agreement automatically. Save policy changes in the Policies tab first.</p></div><span>{{ canManagePolicies ? 'Editing enabled' : 'View only' }}</span></div>
          <div class="contract-editor-grid">
            <div>
              <h3>Included policies</h3>
              <ul v-if="contractPolicies.length" class="contract-policy-list"><li v-for="policy in contractPolicies" :key="policy.key"><Icon icon="mdi:check-circle-outline" /> {{ policy.title }}</li></ul>
              <p v-else class="contract-editor-note">No policies are currently enabled. You can still add your clinic's treatment terms below.</p>
              <label for="client-contract-additional">Additional clinic terms</label>
              <div class="contract-format-toolbar" aria-label="Additional terms formatting"><button v-for="format in ['Bold', 'Italic', 'List']" :key="format" type="button" :disabled="!canManagePolicies || savingContract" @click="formatTerms(format)">{{ format }}</button></div>
              <textarea id="client-contract-additional" ref="termsInput" v-model="additionalTerms" :disabled="!canManagePolicies || savingContract" rows="10" maxlength="12000" placeholder="Add treatment instructions, consent information, or other terms customers should review." />
              <p class="contract-editor-note">{{ additionalTerms.length }} / 12,000 characters. Walk-in policy applies to walk-in appointments. Branch policy links determine which enabled policies apply at that branch.</p>
              <fieldset class="contract-appearance-controls" :disabled="!canManagePolicies || savingContract">
                <legend>Contract appearance</legend>
                <div class="contract-control-grid">
                  <ContractAppearanceSelect id="contract-font" v-model="contractAppearance.font" label="Font" :disabled="!canManagePolicies || savingContract" :options="[{ value: 'sans', label: 'Arial' }, { value: 'serif', label: 'Georgia' }, { value: 'classic', label: 'Times New Roman' }]" />
                  <ContractAppearanceSelect id="contract-font-size" v-model="contractAppearance.fontSize" label="Text size" :disabled="!canManagePolicies || savingContract" :options="[12,14,16,18,20].map(value => ({ value, label: `${value} px` }))" />
                  <ContractAppearanceSelect id="contract-alignment" v-model="contractAppearance.alignment" label="Alignment" :disabled="!canManagePolicies || savingContract" :options="[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'justify', label: 'Justified' }]" />
                  <ContractAppearanceSelect id="contract-spacing" v-model="contractAppearance.spacing" label="Section spacing" :disabled="!canManagePolicies || savingContract" :options="[{ value: 12, label: 'Compact' }, { value: 20, label: 'Comfortable' }, { value: 36, label: 'Spacious' }]" />
                  <label>Heading color<input v-model="contractAppearance.headingColor" type="color" /></label>
                  <label>Accent color<input v-model="contractAppearance.accentColor" type="color" /></label>
                </div>
                <button type="button" class="contract-reset-appearance" @click="Object.assign(contractAppearance, normalizeContractAppearance())">Reset appearance</button>
              </fieldset>
              <button type="button" class="save-contract-button" :disabled="savingContract || !canManagePolicies || !policyOwnerId" @click="saveClientContract">{{ savingContract ? 'Saving…' : 'Save Client Contract' }}</button>
              <p class="contract-editor-note">{{ contractSavedAt ? `Last saved: ${formatDate(contractSavedAt)}` : 'Save to use this agreement for new bookings.' }}</p>
            </div>
            <div class="client-contract-preview"><h3>Agreement preview</h3><p class="contract-editor-note">New bookings use your saved content and appearance. Existing agreements retain their original design. Policy wording and the signature section remain protected.</p><ClientContractDocument class="contract-live-preview" :document="contractPreview" /></div>
          </div>
        </section>
      </div>
    </main>

    <div v-if="activeEditor" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" @click.self="closeEditor">
      <section class="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" role="dialog" aria-modal="true" :aria-labelledby="`policy-editor-${activeEditor}`">
        <header class="flex items-start justify-between gap-4 border-b border-slate-700 px-6 py-5">
          <div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Services policy</p><h2 :id="`policy-editor-${activeEditor}`" class="mt-1 text-xl font-bold">{{ activePolicy?.title }}</h2></div>
          <button type="button" @click="closeEditor" class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close policy editor"><Icon icon="mdi:close" class="h-5 w-5" /></button>
        </header>
        <div class="grid lg:grid-cols-2">
          <form class="space-y-5 p-6" @submit.prevent="applyEditor">
            <template v-if="activeEditor === 'payment'">
              <PolicyToggle v-model="editor.fullPayment" label="Full Payment" description="Require the customer to pay the entire service fee at booking." />
              <NumberField v-model="editor.downpaymentPercentage" label="Downpayment Percentage" suffix="%" :disabled="editor.fullPayment" :min="1" :max="100" required />
            </template>
            <template v-else-if="activeEditor === 'cancellation'">
              <fieldset class="space-y-4 rounded-xl border border-slate-700 p-4"><legend class="px-1 font-semibold text-amber-200">Early Cancellation</legend><NumberField v-model="editor.earlyMinimumHours" label="Minimum Hours" suffix="hours" :min="0" required /><PolicyToggle v-model="editor.earlyNonRefundable" label="Non-refundable" description="Do not refund eligible payment for early cancellations." /><NumberField v-model="editor.earlyRefundPercentage" label="Refund Percentage" suffix="%" :disabled="editor.earlyNonRefundable" :min="0" :max="100" required /></fieldset>
              <fieldset class="space-y-4 rounded-xl border border-slate-700 p-4"><legend class="px-1 font-semibold text-amber-200">Mid-Window Cancellation</legend><NumberField v-model="editor.midMinimumHours" label="Minimum Hours" suffix="hours" :min="0" required /><NumberField v-model="editor.midMaximumHours" label="Maximum Hours" suffix="hours" :min="0" required /><PolicyToggle v-model="editor.midNonRefundable" label="Non-refundable" description="Do not refund eligible payment for mid-window cancellations." /><NumberField v-model="editor.midRefundPercentage" label="Refund Percentage" suffix="%" :disabled="editor.midNonRefundable" :min="0" :max="100" required /></fieldset>
              <fieldset class="space-y-4 rounded-xl border border-slate-700 p-4"><legend class="px-1 font-semibold text-amber-200">Late Cancellation</legend><NumberField v-model="editor.lateMaximumHours" label="Maximum Hours" suffix="hours" :min="0" required /><PolicyToggle v-model="editor.lateNonRefundable" label="Non-refundable" description="Do not refund eligible payment for late cancellations." /><NumberField v-model="editor.lateRefundPercentage" label="Refund Percentage" suffix="%" :disabled="editor.lateNonRefundable" :min="0" :max="100" required /></fieldset>
            </template>
            <template v-else-if="activeEditor === 'rescheduling'"><NumberField v-model="editor.maximumRescheduleAllowance" label="Maximum Reschedule Allowance" suffix="times" :min="0" required /></template>
            <template v-else-if="activeEditor === 'noShow'"><NumberField v-model="editor.noShowGracePeriodMinutes" label="Grace Period" suffix="minutes" :min="0" required /><PolicyToggle v-model="editor.noShowNonRefundable" label="Non-refundable" description="Do not refund eligible payment when the customer is classified as a no-show." /><NumberField v-model="editor.noShowRefundPercentage" label="Refund Percentage" suffix="%" :disabled="editor.noShowNonRefundable" :min="0" :max="100" required /></template>



            <div class="flex justify-end gap-3 pt-2"><button type="button" @click="closeEditor" class="rounded-xl border border-slate-600 px-4 py-2.5 font-semibold text-slate-200 hover:bg-slate-800">Cancel</button><button type="submit" class="rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-500">Apply Changes</button></div>
          </form>
          <aside class="border-t border-slate-700 bg-slate-800/70 p-6 lg:border-l lg:border-t-0">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Instructions</p>
            <div class="mt-4 space-y-5 text-sm leading-6 text-slate-300">
              <template v-if="activeEditor === 'payment'"><p>Set how customers are required to pay for a service when booking an appointment.</p><p><strong class="text-white">Full Payment:</strong> When enabled, customers must pay 100% of the service fee. The Downpayment Percentage field is disabled.</p><p><strong class="text-white">Downpayment Percentage:</strong> The percentage of the service fee customers must pay when booking when full payment is not required.</p></template>
              <template v-else-if="activeEditor === 'cancellation'"><p>Define when customers can cancel and how much of their eligible payment is refunded. The system uses the hours remaining before the scheduled appointment.</p><p><strong class="text-white">Early:</strong> Cancellations at or above its minimum-hours value. For example, 48 means 48 hours or more before the appointment.</p><p><strong class="text-white">Mid-window:</strong> Cancellations between the stated minimum and maximum hours. For example, 24 to 48 hours.</p><p><strong class="text-white">Late:</strong> Cancellations below its maximum-hours value. For example, 24 means less than 24 hours before the appointment.</p><p><strong class="text-white">Non-refundable:</strong> When enabled, no refund is due in that period and its Refund Percentage field is disabled. Otherwise, the entered percentage applies.</p></template>
              <template v-else-if="activeEditor === 'rescheduling'"><p>Limit how many times a customer may reschedule an appointment.</p><p><strong class="text-white">Maximum Reschedule Allowance:</strong> The total number of reschedules allowed for one appointment. Set it to 0 to disallow rescheduling.</p></template>
              <template v-else-if="activeEditor === 'noShow'"><p>Define what happens when a customer does not arrive within the allowed waiting period.</p><p><strong class="text-white">Grace Period:</strong> The number of minutes after the appointment start time before the customer can be marked as a no-show. For example, 30 minutes after a 2:00 PM appointment ends at 2:30 PM.</p><p><strong class="text-white">Non-refundable:</strong> When enabled, the payment is forfeited and Refund Percentage is disabled. Otherwise, the entered percentage applies to eligible payment.</p></template>



            </div>
          </aside>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { collection, deleteField, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { isProductOrderPolicyKey, walkInServicePolicy } from '@/utils/clinicPolicies'
import { buildClientContractDocument, clientContractPolicies, normalizeContractAppearance } from '../../../../../shared/clientContract.js'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { loadOwnerBranchScope } from '@/utils/ownerBranchScope'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const PolicyToggle = defineComponent({
  props: { modelValue: Boolean, label: String, description: String, disabled: Boolean }, emits: ['update:modelValue'],
  setup(props, { emit }) { return () => h('label', { class: ['flex items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4', props.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'] }, [h('span', [h('span', { class: 'block font-medium text-slate-100' }, props.label), h('span', { class: 'mt-1 block text-xs leading-5 text-slate-400' }, props.description)]), h('span', { class: 'relative mt-0.5 inline-flex shrink-0 items-center' }, [h('input', { checked: props.modelValue, disabled: props.disabled, type: 'checkbox', role: 'switch', 'aria-label': props.label, 'aria-checked': props.modelValue, class: 'peer sr-only', onChange: (event) => emit('update:modelValue', event.target.checked) }), h('span', { class: 'policy-switch-track', 'aria-hidden': 'true' })])]) },
})
const NumberField = defineComponent({
  props: { modelValue: [Number, String], label: String, suffix: String, disabled: Boolean, min: Number, max: Number, required: Boolean }, emits: ['update:modelValue'],
  setup(props, { emit }) { return () => h('label', { class: 'block' }, [h('span', { class: 'mb-1.5 block text-sm font-medium text-slate-200' }, props.label), h('span', { class: 'relative block' }, [h('input', { value: props.modelValue, type: 'number', min: props.min, max: props.max, required: props.required, disabled: props.disabled, class: 'w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 pr-20 text-white outline-none transition focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-45', onInput: (event) => emit('update:modelValue', event.target.value === '' ? '' : Number(event.target.value)) }), h('span', { class: 'pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500' }, props.suffix)])]) },
})

const servicePolicies = [
  { id: 'payment', enabledKey: 'servicePaymentPolicyEnabled', title: 'Payment Policy', description: 'Set whether full payment or a downpayment is required at booking.' },
  { id: 'cancellation', enabledKey: 'serviceCancellationPolicyEnabled', title: 'Cancellation Policy', description: 'Set cancellation windows and refund amounts.' },
  { id: 'rescheduling', enabledKey: 'serviceReschedulingPolicyEnabled', title: 'Rescheduling Policy', description: 'Set the maximum number of appointment changes.' },
  { id: 'noShow', enabledKey: 'serviceNoShowPolicyEnabled', title: 'No-Show Policy', description: 'Set the late-arrival grace period and refund outcome.' },
]


const form = reactive({ servicePaymentPolicyEnabled: false, fullPayment: false, downpaymentPercentage: 50, serviceCancellationPolicyEnabled: false, earlyMinimumHours: 48, earlyNonRefundable: false, earlyRefundPercentage: 100, midMinimumHours: 24, midMaximumHours: 48, midNonRefundable: false, midRefundPercentage: 50, lateMaximumHours: 24, lateNonRefundable: true, lateRefundPercentage: 0, serviceReschedulingPolicyEnabled: false, maximumRescheduleAllowance: 1, serviceNoShowPolicyEnabled: false, noShowGracePeriodMinutes: 30, noShowNonRefundable: true, noShowRefundPercentage: 0, walkInPolicyEnabled: true, walkInPolicyAcknowledgementRequired: true })
const retiredPolicyFields = ref([])
const activeTab = ref('policies')
const savedPolicy = ref({})
const additionalTerms = ref('')
const termsInput = ref(null)
const contractAppearance = reactive(normalizeContractAppearance())
const lastSavedAppearance = ref(JSON.stringify(contractAppearance))
const formatTerms = (format) => {
  const input = termsInput.value
  if (!input) return
  const start = input.selectionStart, end = input.selectionEnd
  const selected = additionalTerms.value.slice(start, end) || 'Your text'
  const insertion = format === 'List' ? `${start && additionalTerms.value[start - 1] !== '\n' ? '\n' : ''}${selected.split('\n').map(line => `- ${line}`).join('\n')}` : format === 'Bold' ? `**${selected}**` : `*${selected}*`
  const next = additionalTerms.value.slice(0, start) + insertion + additionalTerms.value.slice(end)
  if (next.length > 12000) return toast.error('Additional terms cannot exceed 12,000 characters.')
  additionalTerms.value = next
  input.focus()
}
const savingContract = ref(false)
const contractSavedAt = ref(null)
const contractPolicies = computed(() => clientContractPolicies(savedPolicy.value))
const contractPreview = computed(() => buildClientContractDocument({ ...savedPolicy.value, clientContract: { additionalTerms: additionalTerms.value, appearance: contractAppearance } }))
const saveClientContract = async () => {
  if (!canManagePolicies.value || !policyOwnerId.value || savingContract.value) return
  savingContract.value = true
  try {
    await setDoc(doc(db, 'clinicPolicies', policyOwnerId.value), {
      ownerId: policyOwnerId.value,
      clientContract: { configured: true, version: 2, additionalTerms: additionalTerms.value.trim(), appearance: normalizeContractAppearance(contractAppearance), updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid },
    }, { merge: true })
    toast.success('Client contract saved for new bookings across your clinic.')
  } catch (error) { toast.error(error.message || 'Could not save the client contract.') }
  finally { savingContract.value = false }
}
const editor = reactive({})
const activeEditor = ref('')
const activePolicy = computed(() => servicePolicies.find((policy) => policy.id === activeEditor.value) || null)
const { hasPermission, isClinicAdminOwner } = usePermissions()
const isPolicyAvailable = policy => servicePolicies.some(item => item.id === policy.id)
const canManagePolicies = computed(() => isClinicAdminOwner.value || hasPermission('policies:update'))
const saving = ref(false); const savedAt = ref(null); const branchId = ref(''); const policyOwnerId = ref(''); let stopListening = null
const policyFields = { payment: ['fullPayment', 'downpaymentPercentage'], cancellation: ['earlyMinimumHours', 'earlyNonRefundable', 'earlyRefundPercentage', 'midMinimumHours', 'midMaximumHours', 'midNonRefundable', 'midRefundPercentage', 'lateMaximumHours', 'lateNonRefundable', 'lateRefundPercentage'], rescheduling: ['maximumRescheduleAllowance'], noShow: ['noShowGracePeriodMinutes', 'noShowNonRefundable', 'noShowRefundPercentage'] }
const formatDate = (value) => { const date = value?.toDate ? value.toDate() : new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString() }
const openEditor = (policyId) => { const policy = servicePolicies.find((item) => item.id === policyId); if (!policy || !isPolicyAvailable(policy) || !form[policy.enabledKey] || !canManagePolicies.value) return; Object.keys(editor).forEach((key) => delete editor[key]); policyFields[policyId].forEach((key) => { editor[key] = form[key] }); activeEditor.value = policyId }
const closeEditor = () => { activeEditor.value = ''; Object.keys(editor).forEach((key) => delete editor[key]) }
let previousBodyOverflow = ''
let previousDocumentOverflow = ''
watch(activeEditor, (policyId) => {
  if (policyId) {
    previousBodyOverflow = document.body.style.overflow
    previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousDocumentOverflow
})
const isPercentage = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
const isNonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0
const validateEditor = () => {
  if (activeEditor.value === 'payment' && !editor.fullPayment && (!isPercentage(editor.downpaymentPercentage) || Number(editor.downpaymentPercentage) === 0)) return 'Enter a downpayment percentage from 1 to 100.'
  if (activeEditor.value === 'rescheduling' && !isNonNegative(editor.maximumRescheduleAllowance)) return 'Maximum Reschedule Allowance cannot be negative.'
  if (activeEditor.value === 'noShow') { if (!isNonNegative(editor.noShowGracePeriodMinutes)) return 'Grace Period cannot be negative.'; if (!editor.noShowNonRefundable && !isPercentage(editor.noShowRefundPercentage)) return 'Enter a no-show refund percentage from 0 to 100.' }



  if (activeEditor.value === 'cancellation') { const hours = ['earlyMinimumHours', 'midMinimumHours', 'midMaximumHours', 'lateMaximumHours']; if (hours.some((key) => !isNonNegative(editor[key]))) return 'Cancellation-hour values cannot be negative.'; if (Number(editor.midMinimumHours) > Number(editor.midMaximumHours)) return 'Mid-Window Minimum Hours cannot be greater than Maximum Hours.'; if (Number(editor.earlyMinimumHours) < Number(editor.midMaximumHours)) return 'Early Cancellation Minimum Hours must be at least the Mid-Window Maximum Hours.'; if (Number(editor.lateMaximumHours) > Number(editor.midMinimumHours)) return 'Late Cancellation Maximum Hours cannot be greater than the Mid-Window Minimum Hours.'; const refunds = [['earlyNonRefundable', 'earlyRefundPercentage'], ['midNonRefundable', 'midRefundPercentage'], ['lateNonRefundable', 'lateRefundPercentage']]; if (refunds.some(([toggle, value]) => !editor[toggle] && !isPercentage(editor[value]))) return 'Each refundable cancellation period needs a percentage from 0 to 100.' }
  return ''
}
const applyEditor = () => { const error = validateEditor(); if (error) return toast.error(error); policyFields[activeEditor.value].forEach((key) => { form[key] = editor[key] }); closeEditor(); toast.success('Policy changes are ready to save.') }
const paymentSummary = () => form.fullPayment ? 'Customers must pay 100% of the service fee when booking.' : `Customers must pay a ${Number(form.downpaymentPercentage)}% downpayment when booking.`
const refundPhrase = (nonRefundable, percentage) => nonRefundable ? 'non-refundable' : `${Number(percentage)}% refundable`
const cancellationSummary = () => `Early cancellations (at least ${Number(form.earlyMinimumHours)} hours): ${refundPhrase(form.earlyNonRefundable, form.earlyRefundPercentage)}. Mid-window cancellations (${Number(form.midMinimumHours)}–${Number(form.midMaximumHours)} hours): ${refundPhrase(form.midNonRefundable, form.midRefundPercentage)}. Late cancellations (under ${Number(form.lateMaximumHours)} hours): ${refundPhrase(form.lateNonRefundable, form.lateRefundPercentage)}.`
const rescheduleSummary = () => `Customers may reschedule an appointment up to ${Number(form.maximumRescheduleAllowance)} time${Number(form.maximumRescheduleAllowance) === 1 ? '' : 's'}.`
const noShowSummary = () => `Customers are considered a no-show after ${Number(form.noShowGracePeriodMinutes)} minutes. Eligible payment is ${refundPhrase(form.noShowNonRefundable, form.noShowRefundPercentage)}.`



const walkInPolicySummary = () => walkInServicePolicy(form.walkInPolicyAcknowledgementRequired)
const lastSavedAdditionalTerms = ref('')
const load = trackPageLoad(async () => {
  try {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const scope = await loadOwnerBranchScope(db, uid)
    branchId.value = scope.branchId
    policyOwnerId.value = scope.ownerId || scope.userProfile.organizationOwnerId || (scope.isStaffUser ? '' : uid)
    if (!policyOwnerId.value) throw new Error('No clinic organization is linked to your account.')
    stopListening?.()
    stopListening = pageListener(onSnapshot, doc(db, 'clinicPolicies', policyOwnerId.value), snapshot => {
      const data = snapshot.exists() ? snapshot.data() || {} : {}
      savedPolicy.value = data
      const savedTerms = String(data.clientContract?.additionalTerms || '')
      if (additionalTerms.value === lastSavedAdditionalTerms.value) additionalTerms.value = savedTerms
      lastSavedAdditionalTerms.value = savedTerms
      const appearance = normalizeContractAppearance(data.clientContract?.appearance)
      if (JSON.stringify(contractAppearance) === lastSavedAppearance.value) Object.assign(contractAppearance, appearance)
      lastSavedAppearance.value = JSON.stringify(appearance)
      contractSavedAt.value = data.clientContract?.updatedAt || null
      retiredPolicyFields.value = Object.keys(data).filter(isProductOrderPolicyKey)
      Object.keys(form).forEach(key => { if (Object.prototype.hasOwnProperty.call(data, key)) form[key] = data[key] })
      if (!Object.prototype.hasOwnProperty.call(data, 'servicePaymentPolicyEnabled')) form.servicePaymentPolicyEnabled = data.paymentPolicyEnabled === true
      if (!Object.prototype.hasOwnProperty.call(data, 'serviceCancellationPolicyEnabled')) form.serviceCancellationPolicyEnabled = data.cancellationPolicyEnabled === true
      if (!Object.prototype.hasOwnProperty.call(data, 'serviceReschedulingPolicyEnabled')) form.serviceReschedulingPolicyEnabled = data.reschedulePolicyEnabled === true
      if (!Object.prototype.hasOwnProperty.call(data, 'serviceNoShowPolicyEnabled')) form.serviceNoShowPolicyEnabled = data.noShowPolicyEnabled === true
      savedAt.value = data.updatedAt || null
    }, error => {
      console.error('Failed to listen to clinic policies:', error)
      toast.error('Clinic policies are unavailable for your current access.', { toastId: 'clinic-policy-access' })
    })
  } catch (error) { toast.error(error.message || 'Unable to load clinic policies.') }
})
const savePolicies = async () => {
  if (!canManagePolicies.value) return toast.error('You have view-only policy access.')
  if (!policyOwnerId.value) return toast.error('Clinic could not be identified.')
  saving.value = true
  try {
    const payload = { ...form, ...Object.fromEntries(retiredPolicyFields.value.map(key => [key, deleteField()])), ownerId: policyOwnerId.value, policyScope: 'clinic', updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp(), paymentPolicy: form.servicePaymentPolicyEnabled ? paymentSummary() : '', paymentPolicyEnabled: form.servicePaymentPolicyEnabled, cancellationPolicy: form.serviceCancellationPolicyEnabled ? cancellationSummary() : '', cancellationPolicyEnabled: form.serviceCancellationPolicyEnabled, refundPolicy: form.serviceCancellationPolicyEnabled ? cancellationSummary() : '', refundPolicyEnabled: form.serviceCancellationPolicyEnabled, reschedulePolicy: form.serviceReschedulingPolicyEnabled ? rescheduleSummary() : '', reschedulePolicyEnabled: form.serviceReschedulingPolicyEnabled, noShowPolicy: form.serviceNoShowPolicyEnabled ? noShowSummary() : '', noShowPolicyEnabled: form.serviceNoShowPolicyEnabled, walkInPolicy: form.walkInPolicyEnabled ? walkInPolicySummary() : '', walkInPolicyEnabled: form.walkInPolicyEnabled }
    await setDoc(doc(db, 'clinicPolicies', policyOwnerId.value), payload, { merge: true })
    const summaries = { paymentPolicy: payload.paymentPolicy, paymentPolicyEnabled: payload.paymentPolicyEnabled, cancellationPolicy: payload.cancellationPolicy, cancellationPolicyEnabled: payload.cancellationPolicyEnabled, refundPolicy: payload.refundPolicy, refundPolicyEnabled: payload.refundPolicyEnabled, reschedulePolicy: payload.reschedulePolicy, reschedulePolicyEnabled: payload.reschedulePolicyEnabled, noShowPolicy: payload.noShowPolicy, noShowPolicyEnabled: payload.noShowPolicyEnabled, walkInPolicy: payload.walkInPolicy, walkInPolicyEnabled: payload.walkInPolicyEnabled, policiesUpdatedAt: serverTimestamp() }
    const branches = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', policyOwnerId.value)))
    const batch = writeBatch(db); branches.docs.forEach((branch) => batch.update(branch.ref, { ...summaries, ...Object.fromEntries(Object.keys(branch.data()).filter(isProductOrderPolicyKey).map(key => [key, deleteField()])) })); await batch.commit()
    toast.success('Clinic-wide policies saved for every branch.')
  } catch (error) { console.error('Failed to save clinic policies:', error); toast.error(error?.message || 'Could not save services policies.') } finally { saving.value = false }
}
onMounted(load)
onUnmounted(() => {
  stopListening?.()
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousDocumentOverflow
})
</script>

<style scoped>
:deep(.policy-switch-track) { position: relative; display: block; flex-shrink: 0; width: 48px; height: 28px; border: 2px solid #bca58b; border-radius: 999px; background: #e7dccd !important; transition: background-color 180ms ease, border-color 180ms ease; }
:deep(.policy-switch-track::after) { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fffdf9; box-shadow: 0 1px 4px #3d281d33; transition: transform 180ms ease; }
:deep(input:checked + .policy-switch-track) { background: #97603c !important; border-color: #97603c !important; }
:deep(input:checked + .policy-switch-track::after) { transform: translateX(20px); }
:deep(input:focus-visible + .policy-switch-track) { outline: 2px solid #97603c; outline-offset: 3px; }
:deep(input:disabled + .policy-switch-track) { opacity: .5; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { :deep(.policy-switch-track), :deep(.policy-switch-track::after) { transition: none; } }
.policy-contract-tabs { display: flex; gap: 8px; margin: 24px 0; border-bottom: 1px solid #d7aa7d55; overflow-x: auto; }
.policy-contract-tabs button { flex-shrink: 0; padding: 12px 18px; border: 0; border-bottom: 3px solid transparent; border-radius: 0 !important; background: transparent; box-shadow: none; color: #a58a73; font-size: 14px; font-weight: 600; transition: color 150ms, border-color 150ms; }
.policy-contract-tabs button:hover { color: #91643f; }
.policy-contract-tabs button.is-active { color: #91643f; border-bottom-color: #b78055; }
.policy-contract-tabs button:focus-visible { outline: 2px solid #b78055; outline-offset: -2px; }
.client-contract-editor { padding: 24px; border: 1px solid #e8caaa; border-radius: 16px; background: #fffdf9; color: #3d281d; }
.contract-editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.contract-editor-heading h2 { font-size: 22px; font-weight: 700; }
.contract-editor-heading p, .contract-editor-note { color: #8a725f; font-size: 12px; line-height: 1.6; margin-top: 8px; }
.contract-editor-heading > span { white-space: nowrap; padding: 6px 10px; border-radius: 20px; background: #f4e7d5; font-size: 11px; }
.contract-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
.contract-editor-grid h3 { font-weight: 700; margin-bottom: 12px; }
.contract-policy-list { display: grid; gap: 8px; font-size: 13px; color: #687952; margin-bottom: 24px; }
.contract-policy-list li { display: flex; gap: 8px; align-items: center; }
.contract-policy-list svg { width: 18px; height: 18px; }
.contract-editor-grid label { display: block; margin: 20px 0 8px; font-size: 13px; font-weight: 600; }
.contract-appearance-controls { margin-top: 24px; border-top: 1px solid #ead4b9; padding-top: 16px; min-width: 0; }
.contract-appearance-controls legend { font-weight: 700; padding-right: 12px; }
.contract-control-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.contract-control-grid > label { min-width: 0; color: #5d4536; }
@media (max-width: 420px) { .contract-control-grid { grid-template-columns: minmax(0, 1fr); } }
.contract-appearance-controls :is(input, select) { display: block; width: 100%; margin-top: 8px; min-height: 40px; padding: 8px; border: 1px solid #dec19e; border-radius: 8px; background: white; color: #3d281d; }
.contract-appearance-controls input[type=color] { padding: 4px; }
.contract-format-toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
.contract-format-toolbar button, .contract-reset-appearance { padding: 6px 10px; border: 1px solid #dec19e; background: #fffaf3; color: #805432; font-size: 12px; }
.contract-format-toolbar button:disabled { opacity: .5; }
.contract-live-preview { margin-top: 20px; max-height: 720px; overflow-y: auto; border: 1px solid #ead4b9; border-radius: 8px; }
.contract-editor-grid textarea { width: 100%; resize: vertical; min-height: 200px; padding: 12px; border: 1px solid #dec19e; border-radius: 10px; background: #fff; color: #3d281d; font-size: 13px; line-height: 1.6; }
.contract-editor-grid textarea:focus { outline: 2px solid #b78055; outline-offset: 2px; }
.save-contract-button { margin-top: 16px; padding: 12px 18px; background: #8d5a3b; color: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; }
.save-contract-button:disabled { opacity: .5; cursor: not-allowed; }
.client-contract-preview { border: 1px solid #ead4b9; padding: 20px; border-radius: 12px; background: #fffaf3; }
.contract-preview-text { white-space: pre-wrap; line-height: 1.75; font-size: 13px; margin-top: 20px; max-height: 600px; overflow-y: auto; }
@media(max-width: 767px) { .contract-editor-grid { grid-template-columns: 1fr; }.contract-editor-heading { flex-direction: column; }.client-contract-editor { padding: 16px; } }
/* The walk-in workflow is deliberately presented as a warm, high-contrast
   cream panel so its policy text, status, and action icons stay legible. */
.walk-in-policy-section {
  background: #fff8ea !important;
  border-color: #dfbc90 !important;
  color: #422b1d;
}

.walk-in-policy-section :deep(.border-slate-700) { border-color: #e5caa4 !important; }
.walk-in-policy-section :deep(.border-slate-600) { border-color: #cfaa7d !important; }
.walk-in-policy-section :deep(.bg-slate-900\/60),
.walk-in-policy-section :deep(.bg-slate-950\/40),
.walk-in-policy-section :deep(.bg-slate-900) { background: #fffdf7 !important; }
.walk-in-policy-section :deep(.text-slate-100),
.walk-in-policy-section :deep(.text-slate-200),
.walk-in-policy-section :deep(.text-slate-300) { color: #422b1d !important; }
.walk-in-policy-section :deep(.text-slate-400),
.walk-in-policy-section :deep(.text-slate-500) { color: #73533d !important; }
.walk-in-policy-section :deep(.text-amber-200) { color: #825025 !important; }
.walk-in-policy-section :deep(.text-emerald-200),
.walk-in-policy-section :deep(.text-emerald-300),
.walk-in-policy-section :deep(.text-teal-300) { color: #17634e !important; }
.walk-in-policy-section :deep(.bg-emerald-500\/10),
.walk-in-policy-section :deep(.bg-teal-500\/10) { background: #e4f4e9 !important; }
.walk-in-policy-section :deep(.border-emerald-500\/35),
.walk-in-policy-section :deep(.border-teal-500\/35) { border-color: #75a886 !important; }
.walk-in-policy-section :deep(.bg-slate-800) { background: #e9d3b4 !important; }
.walk-in-policy-section :deep(.peer:checked + span) { background: #a9632e !important; border-color: #8a4f24 !important; }
.walk-in-policy-section :deep(.bg-amber-600) { background: #9a5729 !important; color: #fffaf2 !important; }
.walk-in-policy-section :deep(.bg-amber-600:hover) { background: #7f431e !important; }
</style>
