<template>
  <div v-if="visible" class="contract-modal-backdrop">
    <div class="contract-modal" role="dialog" aria-modal="true" aria-labelledby="booking-contract-title">
      <header class="contract-modal-header">
        <div>
          <p class="contract-kicker">Secure agreement</p>
          <h3 id="booking-contract-title">{{ title || 'Booking Contract' }}</h3>
          <p v-if="canSign" class="contract-intro">Review the agreement, draw your signature, and confirm. {{ isWalkIn ? 'The client must sign before treatment can start.' : 'Payment becomes available after signing.' }}</p>
        </div>
        <span class="contract-status" :class="{ 'contract-status-signed': contract?.status === 'signed' }">{{ contract?.status === 'signed' ? 'Signed' : 'Awaiting signature' }}</span>
      </header>

      <div class="space-y-3">
        <p v-if="isWalkIn && appointment.paymentStatus !== 'Paid'" class="contract-warning">Collect payment at POS first. The client can then sign here before treatment.</p>
        <section v-if="contract?.terms" class="contract-document">
          <div class="contract-step"><span>1</span><div><h4>Review agreement</h4><p>Please read the terms before signing.</p></div></div>
          <p class="contract-terms">{{ contract.terms }}</p>
        </section>
        <div class="contract-field">
          <label>Contract title</label>
          <input :readonly="isCustomer || isWalkIn" v-model="title" type="text" />
        </div>

        <div v-if="!isCustomer && !isWalkIn" class="contract-field">
          <label>Contract PDF link <span>(optional)</span></label>
          <input :readonly="isCustomer" v-model="templateUrl" type="text" placeholder="https://... or gs://..." />
          <p>Attach a public link only when the clinic has a PDF agreement. The booking customer is the contract signer.</p>
        </div>

        <a v-if="canSign && contract.templateUrl" :href="contract.templateUrl" target="_blank" rel="noopener noreferrer" class="contract-link">Open the attached agreement</a>
        <section v-if="canSign" class="signature-section">
          <div class="contract-step"><span>2</span><div><h4>{{ isWalkIn ? 'Client electronic signature' : 'Your electronic signature' }}</h4><p>{{ isWalkIn ? 'Hand the device to the client to sign.' : 'Use your finger, stylus, or mouse to sign below.' }}</p></div></div>
          <ElectronicSignaturePad v-model="signatureImage" label="Draw your signature for this appointment contract" />
          <label class="contract-consent">
            <input v-model="accepted" type="checkbox" class="mt-1" />
            <span>I have read and agree to this contract and confirm that the signature above is mine.</span>
          </label>
        </section>
        <div class="contract-actions">
          <button v-if="!isCustomer" @click="createContract" :disabled="isProcessing" class="contract-button contract-button-secondary">Create / Update</button>
          <button v-if="canSign" @click="signContract" :disabled="isProcessing || !accepted || !signatureImage" class="contract-button contract-button-primary">{{ isProcessing ? 'Saving signature...' : 'Confirm signature' }}</button>
          <button @click="close" class="contract-button contract-button-plain">Close</button>
        </div>

        <div v-if="contract" class="signature-record">
          <p class="contract-record-title">Signature record</p>
          <p class="contract-record-line"><strong>Status:</strong> {{ contract.status || 'pending' }}</p>
          <p v-if="contract.templateUrl" class="contract-record-line"><strong>Template:</strong> <a :href="contract.templateUrl" target="_blank">Open</a></p>
          <p v-if="contract.signedUrl" class="contract-record-line"><strong>Signed URL:</strong> <a :href="contract.signedUrl" target="_blank">Open</a></p>
          <div class="mt-2">
            <img v-for="(sig, signerId) in contract.signatures || {}" v-show="sig.signatureImage" :key="`image-${signerId}`" :src="sig.signatureImage" alt="Customer electronic signature" class="signature-preview" />
            <p class="contract-record-title">Signatures</p>
            <ul class="contract-signer-list">
              <li v-for="(sig, uid) in contract.signatures || {}" :key="uid">{{ sig.name || sig.email }} — {{ sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'Not signed' }}</li>
            </ul>
          </div>
        </div>

        <div v-if="error" class="contract-error">{{ error }}</div>
        <div v-if="message" class="contract-success">{{ message }}</div>
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
.contract-modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(36, 20, 10, .54); backdrop-filter: blur(3px); }
.contract-modal { width: 100%; max-width: 48rem; max-height: 90vh; overflow-y: auto; border: 1px solid #e7cda5; border-radius: 1rem; background: #fffaf4; color: #2f1d14; box-shadow: 0 25px 70px rgba(48, 25, 11, .28); }
.contract-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.5rem 1.5rem 1.25rem; border-bottom: 1px solid #efdec8; }.contract-kicker { margin: 0 0 .25rem; color: #9a6340; font-size: .72rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }.contract-modal h3 { margin: 0; font-size: 1.35rem; font-weight: 750; }.contract-intro { max-width: 35rem; margin: .5rem 0 0; color: #70594a; font-size: .88rem; line-height: 1.5; }.contract-status { flex: none; border-radius: 999px; padding: .4rem .65rem; background: #f4e7d6; color: #805432; font-size: .74rem; font-weight: 700; }.contract-status-signed { background: #e2f3e7; color: #21643a; }
.contract-modal > .space-y-3 { padding: 1.5rem; }.contract-warning, .contract-error, .contract-success { border-radius: .65rem; padding: .8rem .9rem; font-size: .85rem; }.contract-warning { border: 1px solid #f0cc8d; background: #fff4da; color: #81531d; }.contract-error { background: #fbe9e6; color: #a12d22; }.contract-success { background: #e7f6e9; color: #24633b; }
.contract-document, .signature-section, .signature-record { border: 1px solid #ecd8bd; border-radius: .85rem; background: #fff; padding: 1rem; }.contract-step { display: flex; align-items: flex-start; gap: .65rem; }.contract-step > span { display: grid; width: 1.5rem; height: 1.5rem; flex: none; place-items: center; border-radius: 999px; background: #f6e7d2; color: #874e28; font-size: .76rem; font-weight: 750; }.contract-step h4, .contract-record-title { margin: .05rem 0 0; color: #412d20; font-size: .96rem; font-weight: 750; }.contract-step p { margin: .15rem 0 0; color: #816d5f; font-size: .77rem; }.contract-terms { max-height: 16rem; overflow-y: auto; margin: 1rem 0 0; padding: .9rem; border: 1px solid #f0e2cf; border-radius: .6rem; background: #fffcf8; color: #4c392e; font-size: .86rem; line-height: 1.6; white-space: pre-wrap; }
.contract-field label { display: block; margin-bottom: .35rem; color: #5d4536; font-size: .8rem; font-weight: 700; }.contract-field label span, .contract-field p { color: #947d6c; font-weight: 400; }.contract-field p { margin: .35rem 0 0; font-size: .72rem; }.contract-field input { width: 100%; box-sizing: border-box; border: 1px solid #dfc4a0; border-radius: .6rem; padding: .65rem .75rem; background: #fff; color: #2f1d14; outline: none; }.contract-field input:focus { border-color: #a56639; box-shadow: 0 0 0 3px rgba(165, 102, 57, .12); }.contract-link { display: inline-flex; color: #8c4c22; font-size: .83rem; font-weight: 700; text-decoration: underline; }.contract-consent { display: flex; align-items: flex-start; gap: .55rem; margin-top: .8rem; color: #594437; font-size: .8rem; line-height: 1.45; }.contract-consent input { margin-top: .14rem; accent-color: #9d5d30; }
.contract-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .55rem; padding-top: .35rem; }.contract-button { border-radius: .6rem; padding: .63rem .9rem; font-size: .82rem; font-weight: 700; transition: .15s ease; }.contract-button:disabled { cursor: not-allowed; opacity: .5; }.contract-button-primary { background: #8e4b23; color: white; }.contract-button-primary:hover:not(:disabled) { background: #713617; }.contract-button-secondary { border: 1px solid #d5a773; background: #fff; color: #7b431f; }.contract-button-plain { color: #725d4d; }.contract-record-line { margin: .45rem 0 0; color: #684f40; font-size: .8rem; }.contract-record-line a { color: #8c4c22; text-decoration: underline; }.signature-preview { display: block; max-width: 9rem; max-height: 3.5rem; margin: .7rem 0; border-radius: .35rem; background: white; }.contract-signer-list { margin: .35rem 0 0; padding-left: 1.15rem; color: #684f40; font-size: .78rem; }
@media (max-width: 640px) { .contract-modal-header, .contract-modal > .space-y-3 { padding: 1.15rem; }.contract-status { display: none; } }
</style>
