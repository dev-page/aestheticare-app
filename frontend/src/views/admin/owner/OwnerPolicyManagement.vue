<template>
  <div class="flex min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-5xl">
        <h1 class="text-3xl font-bold">Policy Management</h1>
        <p class="mt-2 text-slate-400">Set the rules the system applies to bookings, payments, products, and delivery for this branch.</p>
        <div class="mt-4 flex flex-col gap-3 rounded-xl border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>How this works:</strong> Enable only the policies your clinic offers. Enabled appointment policies control whether customers can request actions such as rescheduling.</p>
          <span class="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold" :class="canManagePolicies ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-500 bg-slate-800 text-slate-300'">{{ canManagePolicies ? 'Editing enabled' : 'View only' }}</span>
        </div>
        <form class="mt-8 space-y-6" @submit.prevent="savePolicies">
          <section v-for="group in policyGroups" :key="group.key" class="rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h2 class="text-lg font-semibold">{{ group.label }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ group.description }}</p>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <label v-for="field in group.fields" :key="field.key" class="block rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <span class="flex items-center justify-between gap-3">
                  <span class="text-sm text-slate-300">{{ field.label }}</span>
                  <span class="inline-flex items-center gap-2 text-xs text-slate-400">
                    <input v-model="form[field.enabledKey]" :disabled="!canManagePolicies" type="checkbox" class="accent-amber-500 disabled:cursor-not-allowed" />
                    Enable policy
                  </span>
                </span>
                <textarea v-model="form[field.key]" rows="4" :disabled="!canManagePolicies || !form[field.enabledKey]" :placeholder="field.placeholder" class="mt-3 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50" />
              </label>
            </div>
          </section>
          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h2 class="text-lg font-semibold">No-show outcome</h2>
            <p class="mt-1 text-sm text-slate-400">Choose the default outcome staff applies when a customer does not attend. Staff still review every case.</p>
            <label class="mt-4 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <input v-model="form.noShowRescheduleAllowed" :disabled="!canManagePolicies" type="checkbox" class="mt-1 accent-amber-500 disabled:cursor-not-allowed" />
              <span><span class="block text-sm text-slate-200">Allow staff-approved rescheduling after a no-show</span><span class="mt-1 block text-xs text-slate-400">When disabled, the missed appointment is recorded as forfeited. When enabled, staff may arrange a replacement schedule according to the clinic policy.</span></span>
            </label>
          </section>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Last saved: {{ savedAt ? formatDate(savedAt) : 'Not saved yet' }}</span>
            <button :disabled="saving || !canManagePolicies" class="rounded-xl bg-amber-600 px-5 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50">{{ saving ? 'Saving...' : canManagePolicies ? 'Save Policies' : 'View-only access' }}</button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'

const policyGroups = [
  { key: 'appointments', label: 'Appointments & Consultations', description: 'Shown during appointment and consultation requests.', fields: [
    { key: 'cancellationPolicy', enabledKey: 'cancellationPolicyEnabled', label: 'Cancellation policy', placeholder: 'Explain deadlines, fees, and exceptions.' },
    { key: 'reschedulePolicy', enabledKey: 'reschedulePolicyEnabled', label: 'Reschedule policy', placeholder: 'Explain how customers can request another schedule.' },
    { key: 'noShowPolicy', enabledKey: 'noShowPolicyEnabled', label: 'No-show policy', placeholder: 'Explain what happens when a customer misses an appointment or treatment session.' },
    { key: 'refundPolicy', enabledKey: 'refundPolicyEnabled', label: 'Refund policy', placeholder: 'Explain eligibility, processing time, and non-refundable fees.' },
    { key: 'consultationPolicy', enabledKey: 'consultationPolicyEnabled', label: 'Consultation policy', placeholder: 'Explain consultation requirements and follow-up rules.' },
  ] },
  { key: 'commerce', label: 'Products, Services & Delivery', description: 'Shown on listings, packages, and orders.', fields: [
    { key: 'serviceTerms', enabledKey: 'serviceTermsEnabled', label: 'Service terms', placeholder: 'Explain preparation, duration, inclusions, and customer obligations.' },
    { key: 'productTerms', enabledKey: 'productTermsEnabled', label: 'Product terms and returns', placeholder: 'Explain product handling, returns, exchanges, and warranty.' },
    { key: 'deliveryPolicy', enabledKey: 'deliveryPolicyEnabled', label: 'Delivery policy', placeholder: 'Explain delivery areas, fees, lead time, and receiving requirements.' },
    { key: 'paymentPolicy', enabledKey: 'paymentPolicyEnabled', label: 'Payment and installment policy', placeholder: 'Explain deposits, installments, due dates, and late payments.' },
  ] },
]

const form = reactive(Object.fromEntries(policyGroups.flatMap((group) => group.fields.flatMap((field) => [[field.key, ''], [field.enabledKey, false]]))))
form.noShowRescheduleAllowed = false
const { hasPermission, isClinicAdminOwner } = usePermissions()
const canManagePolicies = computed(() => isClinicAdminOwner.value || hasPermission('policies:update'))
const saving = ref(false)
const savedAt = ref(null)
const branchId = ref('')
let stopListening = null

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

const load = async () => {
  const uid = auth.currentUser?.uid
  if (!uid) return
  const userSnap = await getDoc(doc(db, 'users', uid))
  branchId.value = userSnap.exists() ? String(userSnap.data()?.branchId || uid) : uid
  stopListening?.()
  stopListening = onSnapshot(doc(db, 'clinicPolicies', branchId.value), (snapshot) => {
    if (!snapshot.exists()) return
    const data = snapshot.data() || {}
    policyGroups.flatMap((group) => group.fields).forEach((field) => {
      form[field.key] = String(data[field.key] || '')
      form[field.enabledKey] = Object.prototype.hasOwnProperty.call(data, field.enabledKey)
        ? data[field.enabledKey] === true
        : Boolean(form[field.key])
    })
    form.noShowRescheduleAllowed = data.noShowRescheduleAllowed === true
    savedAt.value = data.updatedAt || null
  }, (error) => {
    console.error('Failed to listen to clinic policies:', error)
    toast.error('Clinic policies are unavailable for your current access.', { toastId: 'clinic-policy-access' })
  })
}

const savePolicies = async () => {
  if (!canManagePolicies.value) return toast.error('You have view-only policy access.')
  if (!branchId.value) return toast.error('Clinic branch could not be identified.')
  saving.value = true
  try {
    const payload = { ...form, branchId: branchId.value, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() }
    policyGroups.flatMap((group) => group.fields).forEach((field) => {
      if (!form[field.enabledKey]) payload[field.key] = ''
    })
    await setDoc(doc(db, 'clinicPolicies', branchId.value), payload, { merge: true })
    // Keep appointment approval compatible with the legacy clinic policy fields.
    await updateDoc(doc(db, 'clinics', branchId.value), {
      cancellationPolicy: form.cancellationPolicyEnabled ? form.cancellationPolicy : '',
      cancellationPolicyEnabled: form.cancellationPolicyEnabled,
      reschedulePolicy: form.reschedulePolicyEnabled ? form.reschedulePolicy : '',
      reschedulePolicyEnabled: form.reschedulePolicyEnabled,
      noShowPolicy: form.noShowPolicyEnabled ? form.noShowPolicy : '',
      noShowPolicyEnabled: form.noShowPolicyEnabled,
      noShowRescheduleAllowed: form.noShowRescheduleAllowed === true,
      refundPolicy: form.refundPolicyEnabled ? form.refundPolicy : '',
      refundPolicyEnabled: form.refundPolicyEnabled,
      consultationPolicy: form.consultationPolicyEnabled ? form.consultationPolicy : '',
      consultationPolicyEnabled: form.consultationPolicyEnabled,
      serviceTerms: form.serviceTermsEnabled ? form.serviceTerms : '',
      serviceTermsEnabled: form.serviceTermsEnabled,
      productTerms: form.productTermsEnabled ? form.productTerms : '',
      productTermsEnabled: form.productTermsEnabled,
      deliveryPolicy: form.deliveryPolicyEnabled ? form.deliveryPolicy : '',
      deliveryPolicyEnabled: form.deliveryPolicyEnabled,
      paymentPolicy: form.paymentPolicyEnabled ? form.paymentPolicy : '',
      paymentPolicyEnabled: form.paymentPolicyEnabled,
      policiesUpdatedAt: serverTimestamp(),
    })
    toast.success('Clinic policies saved.')
  } catch (error) {
    console.error('Failed to save clinic policies:', error)
    toast.error(error?.message || 'Could not save policies.')
  } finally { saving.value = false }
}

onMounted(load)
onUnmounted(() => stopListening?.())
</script>
