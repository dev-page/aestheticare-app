<template>
  <div class="flex min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-5xl">
        <h1 class="text-3xl font-bold">Policy Management</h1>
        <p class="mt-2 text-slate-400">Maintain the rules shown to customers before they book, buy, or request delivery.</p>
        <form class="mt-8 space-y-6" @submit.prevent="savePolicies">
          <section v-for="group in policyGroups" :key="group.key" class="rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h2 class="text-lg font-semibold">{{ group.label }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ group.description }}</p>
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <label v-for="field in group.fields" :key="field.key" class="block">
                <span class="mb-2 block text-sm text-slate-300">{{ field.label }}</span>
                <textarea v-model="form[field.key]" rows="4" :placeholder="field.placeholder" class="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-500" />
              </label>
            </div>
          </section>
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Last saved: {{ savedAt ? formatDate(savedAt) : 'Not saved yet' }}</span>
            <button :disabled="saving" class="rounded-xl bg-amber-600 px-5 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50">{{ saving ? 'Saving...' : 'Save Policies' }}</button>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'

const policyGroups = [
  { key: 'appointments', label: 'Appointments & Consultations', description: 'Shown during appointment and consultation requests.', fields: [
    { key: 'cancellationPolicy', label: 'Cancellation policy', placeholder: 'Explain deadlines, fees, and exceptions.' },
    { key: 'reschedulePolicy', label: 'Reschedule policy', placeholder: 'Explain how customers can request another schedule.' },
    { key: 'refundPolicy', label: 'Refund policy', placeholder: 'Explain eligibility, processing time, and non-refundable fees.' },
    { key: 'consultationPolicy', label: 'Consultation policy', placeholder: 'Explain consultation requirements and follow-up rules.' },
  ] },
  { key: 'commerce', label: 'Products, Services & Delivery', description: 'Shown on listings, packages, and orders.', fields: [
    { key: 'serviceTerms', label: 'Service terms', placeholder: 'Explain preparation, duration, inclusions, and customer obligations.' },
    { key: 'productTerms', label: 'Product terms and returns', placeholder: 'Explain product handling, returns, exchanges, and warranty.' },
    { key: 'deliveryPolicy', label: 'Delivery policy', placeholder: 'Explain delivery areas, fees, lead time, and receiving requirements.' },
    { key: 'paymentPolicy', label: 'Payment and installment policy', placeholder: 'Explain deposits, installments, due dates, and late payments.' },
  ] },
]

const form = reactive(Object.fromEntries(policyGroups.flatMap((group) => group.fields.map((field) => [field.key, '']))))
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
    Object.keys(form).forEach((key) => { form[key] = String(data[key] || '') })
    savedAt.value = data.updatedAt || null
  })
}

const savePolicies = async () => {
  if (!branchId.value) return toast.error('Clinic branch could not be identified.')
  saving.value = true
  try {
    const payload = { ...form, branchId: branchId.value, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() }
    await setDoc(doc(db, 'clinicPolicies', branchId.value), payload, { merge: true })
    // Keep appointment approval compatible with the legacy clinic policy fields.
    await updateDoc(doc(db, 'clinics', branchId.value), {
      cancellationPolicy: form.cancellationPolicy,
      reschedulePolicy: form.reschedulePolicy,
      refundPolicy: form.refundPolicy,
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
