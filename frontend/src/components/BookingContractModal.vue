<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700">
      <h3 class="text-lg font-semibold text-white mb-4">Manage Contract for Appointment</h3>

      <div class="space-y-3">
        <div>
          <label class="text-sm text-slate-300">Contract Title</label>
          <input v-model="title" type="text" class="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1" />
        </div>

        <div>
          <label class="text-sm text-slate-300">Template URL (PDF)</label>
          <input v-model="templateUrl" type="text" placeholder="https://... or gs://..." class="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1" />
          <p class="text-xs text-slate-400 mt-1">Provide a URL to the contract template or a generated PDF. You can upload to Firebase Storage and paste the public URL.</p>
        </div>

        <div>
          <label class="text-sm text-slate-300">Required Signers (comma-separated emails)</label>
          <input v-model="requiredSignersStr" type="text" class="w-full bg-slate-700 text-white px-3 py-2 rounded mt-1" />
        </div>

        <div class="flex gap-2">
          <button @click="createContract" :disabled="isProcessing" class="px-4 py-2 bg-sky-600 text-white rounded">Create / Update</button>
          <button @click="signContract" :disabled="isProcessing || !canSign" class="px-4 py-2 bg-emerald-600 text-white rounded">Sign Contract</button>
          <button @click="uploadSigned" :disabled="isProcessing" class="px-4 py-2 bg-purple-600 text-white rounded">Set Signed URL</button>
          <button @click="close" class="px-4 py-2 bg-slate-600 text-white rounded">Close</button>
        </div>

        <div v-if="contract" class="mt-4 border-t border-slate-700 pt-4">
          <p class="text-slate-300"><strong>Status:</strong> {{ contract.status || 'pending' }}</p>
          <p class="text-slate-300"><strong>Template:</strong> <a :href="contract.templateUrl" target="_blank" class="text-sky-300">Open</a></p>
          <p v-if="contract.signedUrl" class="text-slate-300"><strong>Signed URL:</strong> <a :href="contract.signedUrl" target="_blank" class="text-sky-300">Open</a></p>
          <div class="mt-2">
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

export default {
  name: 'BookingContractModal',
  props: {
    visible: { type: Boolean, default: false },
    appointment: { type: Object, default: null }
  },
  emits: ['close', 'updated'],
  setup(props, { emit }) {
    const auth = getAuth()
    const title = ref('Contract')
    const templateUrl = ref('')
    const requiredSignersStr = ref('')
    const contract = ref(null)
    const isProcessing = ref(false)
    const error = ref('')
    const message = ref('')

    watch(() => props.appointment, (next) => {
      if (next && next.contract) {
        contract.value = next.contract
        title.value = next.contract.title || 'Contract'
        templateUrl.value = next.contract.templateUrl || ''
        requiredSignersStr.value = Array.isArray(next.contract.requiredSigners) ? next.contract.requiredSigners.map(s => s.email).join(', ') : ''
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
        const signers = requiredSignersStr.value.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }))
        const resp = await fetchFromBackend(`/appointments/${props.appointment.id}/contract`, {
          method: 'POST',
          body: JSON.stringify({ title: title.value, templateUrl: templateUrl.value, requiredSigners: signers }),
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

    const canSign = computed(() => {
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
      isProcessing.value = true
      error.value = ''
      message.value = ''
      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Not authenticated')
        const body = { name: currentUser.displayName || '', email: currentUser.email || '' }
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

    const uploadSigned = async () => {
      if (!props.appointment) return
      isProcessing.value = true
      error.value = ''
      message.value = ''
      try {
        if (!templateUrl.value) throw new Error('Provide signed URL in the Template URL field')
        const resp = await fetchFromBackend(`/appointments/${props.appointment.id}/contract/upload-signed`, {
          method: 'POST',
          body: JSON.stringify({ signedUrl: templateUrl.value }),
          headers: { 'Content-Type': 'application/json' }
        })
        const payload = await resp.json()
        if (!payload.success) throw new Error(payload.error || 'Failed to set signed URL')
        contract.value = payload.data.contract
        message.value = 'Signed URL recorded.'
        emit('updated')
      } catch (err) {
        error.value = err?.message || String(err)
      } finally {
        isProcessing.value = false
      }
    }

    const close = () => emit('close')

    return { title, templateUrl, requiredSignersStr, contract, createContract, signContract, uploadSigned, isProcessing, error, message, close, canSign }
  }
}
</script>

<style scoped>
/* minimal modal styling handled via tailwind-like classes already used in project */
</style>
