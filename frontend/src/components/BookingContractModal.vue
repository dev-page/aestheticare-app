<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="max-h-[90vh] overflow-y-auto bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700">
      <h3 class="text-lg font-semibold text-white mb-4">Booking Contract</h3>
      <p v-if="canSign" class="mb-4 text-sm text-slate-300">Review the agreement, draw your signature, and confirm. {{ isWalkIn ? 'The client must sign before treatment can start.' : 'Payment becomes available after signing.' }}</p>

      <div class="space-y-3">
        <p v-if="isWalkIn && appointment.paymentStatus !== 'Paid'" class="rounded bg-amber-900/30 p-3 text-sm text-amber-200">Collect payment at POS first. The client can then sign here before treatment.</p>
        <p v-if="contract?.terms" class="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white p-4 text-sm text-slate-800">{{ contract.terms }}</p>
        <div>
          <label class="text-sm text-slate-300">Contract Title</label>
          <input :readonly="isCustomer || isWalkIn" v-model="title" type="text" class="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1" />
        </div>

        <div v-if="!isCustomer && !isWalkIn">
          <label class="text-sm text-slate-300">Contract PDF link (optional)</label>
          <input :readonly="isCustomer" v-model="templateUrl" type="text" placeholder="https://... or gs://..." class="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1" />
          <p class="text-xs text-slate-400 mt-1">Attach a public link only when the clinic has a PDF agreement. The booking customer is the contract signer.</p>
        </div>

        <a v-if="canSign && contract.templateUrl" :href="contract.templateUrl" target="_blank" rel="noopener noreferrer" class="block text-sky-300 underline">Open the clinic agreement to review</a>
        <div v-if="canSign" class="space-y-3 rounded-lg bg-white p-4 text-slate-800">
          <h4 class="font-semibold">{{ isWalkIn ? 'Client signature: ' + (appointment.clientName || appointment.customerName) : 'Your electronic signature' }}</h4>
          <p v-if="isWalkIn" class="text-sm">Hand the device to the client so they can review and sign. The clinic staff account records who assisted.</p>
          <ElectronicSignaturePad v-model="signatureImage" label="Draw your signature for this appointment contract" />
          <label class="flex items-start gap-2 text-sm">
            <input v-model="accepted" type="checkbox" class="mt-1" />
            <span>I have read and agree to this contract and confirm that the signature above is mine.</span>
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="!isCustomer" @click="createContract" :disabled="isProcessing" class="px-4 py-2 bg-sky-600 text-white rounded">Create / Update</button>
          <button v-if="canSign" @click="signContract" :disabled="isProcessing || !accepted || !signatureImage" class="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed">{{ isProcessing ? 'Saving signature...' : 'Confirm signature' }}</button>
          <button @click="close" class="px-4 py-2 bg-slate-600 text-white rounded">Close</button>
        </div>

        <div v-if="contract" class="mt-4 border-t border-slate-700 pt-4">
          <p class="text-slate-300"><strong>Status:</strong> {{ contract.status || 'pending' }}</p>
          <p v-if="contract.templateUrl" class="text-slate-300"><strong>Template:</strong> <a :href="contract.templateUrl" target="_blank" class="text-sky-300">Open</a></p>
          <p v-if="contract.signedUrl" class="text-slate-300"><strong>Signed URL:</strong> <a :href="contract.signedUrl" target="_blank" class="text-sky-300">Open</a></p>
          <div class="mt-2">
            <img v-for="(sig, signerId) in contract.signatures || {}" v-show="sig.signatureImage" :key="`image-${signerId}`" :src="sig.signatureImage" alt="Customer electronic signature" class="my-2 max-h-36 rounded bg-white" />
            <p class="text-slate-300 font-semibold">Signatures</p>
            <ul class="text-slate-300 text-sm mt-1">
              <li v-for="(sig, uid) in contract.signatures || {}" :key="uid">{{ sig.name || sig.email }} — {{ sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'Not signed' }}</li>
            </ul>
          </div>
        </div>

        <div v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</div>
        <div v-if="message" class="mt-3 text-sm text-emerald-300">{{ message }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import { getAuth } from 'firebase/auth'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import ElectronicSignaturePad from '@/components/common/ElectronicSignaturePad.vue'

export default {
  name: 'BookingContractModal',
  components: { ElectronicSignaturePad },
  props: {
    visible: { type: Boolean, default: false },
    appointment: { type: Object, default: null }
  },
  emits: ['close', 'updated'],
  setup(props, { emit }) {
    const auth = getAuth()
    const title = ref('Contract')
    const templateUrl = ref('')
    const contract = ref(null)
    const isProcessing = ref(false)
    const error = ref('')
    const message = ref('')
    const signatureImage = ref('')
    const accepted = ref(false)

    watch(() => props.appointment, (next) => {
      signatureImage.value = ''
      accepted.value = false
      error.value = ''
      message.value = ''
      if (next && next.contract) {
        contract.value = next.contract
        title.value = next.contract.title || 'Contract'
        templateUrl.value = next.contract.templateUrl || ''
      } else {
        contract.value = null
      }
    }, { immediate: true })

    const fetchFromBackend = async (path, options = {}) => {
      const candidates = OTP_BACKEND_CANDIDATES
      let lastError = null
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

      for (const baseUrl of candidates) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: { ...(options.headers || {}), ...authHeader },
          })
          return response
        } catch (err) {
          lastError = err
        }
      }
      throw lastError || new Error('Failed to reach backend')
    }

    const createContract = async () => {
      if (!props.appointment) return
      isProcessing.value = true
      error.value = ''
      message.value = ''
      try {
        const resp = await fetchFromBackend(`/appointments/${props.appointment.id}/contract`, {
          method: 'POST',
          body: JSON.stringify({ title: title.value, templateUrl: templateUrl.value }),
          headers: { 'Content-Type': 'application/json' }
        })
        const payload = await resp.json()
        if (!payload.success) throw new Error(payload.error || 'Failed')
        contract.value = payload.data.contract
        message.value = 'Contract saved.'
        emit('updated')
      } catch (err) {
        error.value = err?.message || String(err)
      } finally {
        isProcessing.value = false
      }
    }

    const isWalkIn = computed(() => props.appointment?.source === 'walk_in')
    const isCustomer = computed(() => props.appointment?.customerId === auth.currentUser?.uid)
    const canSign = computed(() => {
      if (isWalkIn.value) return Boolean(auth.currentUser && contract.value && contract.value.status !== 'signed' && props.appointment.paymentStatus === 'Paid')
      if (!isCustomer.value || contract.value?.status === 'signed') return false
      if (!auth.currentUser || !contract.value) return false
      // allow signing if current user's email is among requiredSigners or no requiredSigners defined
      const email = auth.currentUser.email && auth.currentUser.email.toLowerCase()
      if (!email) return false
      const required = Array.isArray(contract.value.requiredSigners) && contract.value.requiredSigners.length > 0
      if (!required) return true
      return (contract.value.requiredSigners || []).some(s => String(s.email || '').toLowerCase() === email)
    })

    const signContract = async () => {
      if (!props.appointment) return
      if (!canSign.value || !accepted.value || !signatureImage.value) {
        error.value = 'Please read the contract, draw your signature, and accept the agreement.'
        return
      }
      isProcessing.value = true
      error.value = ''
      message.value = ''
      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Not authenticated')
        const body = { name: currentUser.displayName || '', signatureImage: signatureImage.value, accepted: accepted.value }
        const resp = await fetchFromBackend(`/appointments/${props.appointment.id}/contract/sign`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' }
        })
        const payload = await resp.json()
        if (!payload.success) throw new Error(payload.error || 'Failed to sign')
        contract.value = payload.data.contract
        message.value = 'Contract signed.'
        emit('updated')
      } catch (err) {
        error.value = err?.message || String(err)
      } finally {
        isProcessing.value = false
      }
    }

    const close = () => emit('close')

    return { isWalkIn, isCustomer, title, templateUrl, contract, createContract, signContract, isProcessing, error, message, close, canSign, signatureImage, accepted }
  }
}
</script>

<style scoped>
/* minimal modal styling handled via tailwind-like classes already used in project */
</style>
