<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/config/firebaseConfig'
import { collection, query, where, getDocs } from 'firebase/firestore'
import axios from 'axios'
import { toast } from 'vue3-toastify'

const router = useRouter()
const OTP_API_BASE = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const step = ref(1)
const email = ref('')
const otpDigits = ref(Array(6).fill(''))
const generatedOtp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const otpInputRefs = ref([])
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60
const resendCountdown = ref(0)
let resendTimer = null

const cancelReset = () => {
  router.push('/login')
}

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 32
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$/

const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)

const togglePassword = () => { passwordVisible.value = !passwordVisible.value }
const toggleConfirmPassword = () => { confirmPasswordVisible.value = !confirmPasswordVisible.value }

const getBackendCandidates = () => {
  const candidates = [
    String(OTP_API_BASE || '').trim(),
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean)
  return [...new Set(candidates)]
}

const postToBackend = async (path, payload) => {
  let lastError = null
  for (const baseUrl of getBackendCandidates()) {
    try {
      const response = await axios.post(`${baseUrl}${path}`, payload)
      return response
    } catch (err) {
      if (err?.response?.status === 404) {
        lastError = err
        continue
      }
      throw err
    }
  }
  throw lastError || new Error('Backend endpoint not found.')
}

const clearResendTimer = () => {
  if (!resendTimer) return
  clearInterval(resendTimer)
  resendTimer = null
}

const startResendCountdown = () => {
  clearResendTimer()
  resendCountdown.value = RESEND_COOLDOWN_SECONDS
  resendTimer = setInterval(() => {
    if (resendCountdown.value <= 1) {
      resendCountdown.value = 0
      clearResendTimer()
      return
    }
    resendCountdown.value -= 1
  }, 1000)
}

const requestOtp = async ({ advanceStep = true, successMessage = 'OTP sent to your email.' } = {}) => {
  if (!email.value) {
    toast.error('Please enter your email.')
    return false
  }

  try {
    const userRef = collection(db, 'users')
    const q = query(userRef, where('email', '==', email.value.trim()))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      toast.error('Email not found in our records.')
      return false
    }

    const authCheck = await postToBackend('/auth/check-user', {
      email: email.value.trim(),
    })
    if (authCheck?.data?.success && authCheck?.data?.exists === false) {
      toast.error('No account found for this email in authentication.')
      return false
    }

    generatedOtp.value = Math.floor(100000 + Math.random() * 900000).toString()
    await postToBackend('/send-otp', {
      recipient: email.value,
      otp: generatedOtp.value,
    })
    toast.info(successMessage)
    if (advanceStep) {
      step.value = 2
    }
    clearOtpInputs()
    focusOtpInput(0)
    startResendCountdown()
    return true
  } catch (err) {
    console.error(err)
    const providerError =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Failed to send OTP.'
    toast.error(providerError)
    return false
  }
}

const sendOtp = async () => {
  await requestOtp()
}

const resendOtp = async () => {
  if (resendCountdown.value > 0) return
  await requestOtp({
    advanceStep: false,
    successMessage: 'A new OTP has been sent to your email.'
  })
}

const verifyOtp = () => {
  if (otpCode.value === generatedOtp.value) {
    toast.success('OTP verified! You can now reset your password.')
    step.value = 3
  } else {
    toast.error('Invalid OTP.')
  }
}

const resetPassword = async () => {
  if (!newPassword.value || !confirmPassword.value) {
    toast.error('Please enter and confirm your new password.')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error('Passwords do not match.')
    return
  }
  if (newPassword.value.length < PASSWORD_MIN_LENGTH || newPassword.value.length > PASSWORD_MAX_LENGTH) {
    toast.error('Password must be 8-32 characters.')
    return
  }
  if (!PASSWORD_REGEX.test(newPassword.value)) {
    toast.error('Password must include uppercase, lowercase, number, and special character (@$!%*?&).')
    return
  }
  try {
    const response = await postToBackend('/auth/reset-password', {
      email: email.value.trim(),
      newPassword: newPassword.value,
    })
    if (response?.data?.success) {
      toast.success('Password updated successfully. You can now log in.')
    } else {
      toast.error(response?.data?.error || 'Failed to reset password.')
      return
    }
    step.value = 1
    email.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    clearOtpInputs()
    generatedOtp.value = ''
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (err) {
    console.error(err)
    const providerError =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'Error resetting password.'
    toast.error(providerError)
  }
}

const otpCode = computed(() => otpDigits.value.join(''))
const resendCountdownLabel = computed(() => {
  const minutes = String(Math.floor(resendCountdown.value / 60)).padStart(2, '0')
  const seconds = String(resendCountdown.value % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})

const setOtpInputRef = (el, index) => {
  if (el) otpInputRefs.value[index] = el
}

const focusOtpInput = (index) => {
  if (index < 0 || index > OTP_LENGTH - 1) return
  nextTick(() => otpInputRefs.value[index]?.focus())
}

const clearOtpInputs = () => {
  otpDigits.value = Array(OTP_LENGTH).fill('')
}

const handleOtpInput = (index, event) => {
  const input = event?.target?.value || ''
  const digits = input.replace(/\D/g, '').slice(-1)
  otpDigits.value[index] = digits
  if (digits && index < OTP_LENGTH - 1) focusOtpInput(index + 1)
}

const handleOtpKeydown = (index, event) => {
  if (event.key === 'Backspace') {
    if (otpDigits.value[index]) {
      otpDigits.value[index] = ''
    } else if (index > 0) {
      otpDigits.value[index - 1] = ''
      focusOtpInput(index - 1)
    }
  }
  if (event.key === 'ArrowLeft' && index > 0) focusOtpInput(index - 1)
  if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) focusOtpInput(index + 1)
}

const handleOtpPaste = (event) => {
  const pastedDigits = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, OTP_LENGTH) || ''
  if (!pastedDigits) return
  pastedDigits.split('').forEach((digit, offset) => {
    if (offset < OTP_LENGTH) otpDigits.value[offset] = digit
  })
  const nextIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1)
  focusOtpInput(nextIndex)
}

onBeforeUnmount(() => {
  clearResendTimer()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gold-100 via-cream-200 to-rose-100">
    <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <h2 class="text-xl font-semibold text-gold-700 mb-4">
        Recover Account
      </h2>

      <!-- Step 1: Enter Email -->
      <div v-if="step === 1" class="space-y-4">
        <p class="text-sm text-gray-600">Enter your registered email address to receive an OTP.</p>
        <input
          v-model="email"
          type="email"
          placeholder="Email Address"
          class="w-full border rounded px-3 py-2"
        />

        <div class="flex gap-2">
          <button
            @click="cancelReset"
            class="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="sendOtp"
            class="w-full py-2 bg-gold-700 text-white rounded hover:bg-gold-800"
          >
            Send OTP
          </button>
        </div>
      </div>

      <!-- Step 2: Verify OTP -->
      <div v-if="step === 2" class="space-y-4">
        <p class="text-sm text-gray-600">We sent an OTP to <strong>{{ email }}</strong>. Enter it below to verify.</p>
        <div class="otp-boxes">
          <input
            v-for="(_, index) in OTP_LENGTH"
            :key="`forgot-otp-${index}`"
            :ref="(el) => setOtpInputRef(el, index)"
            v-model="otpDigits[index]"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            autocomplete="one-time-code"
            class="otp-digit"
            :class="{ 'otp-digit-filled': otpDigits[index] }"
            @input="handleOtpInput(index, $event)"
            @keydown="handleOtpKeydown(index, $event)"
            @paste="handleOtpPaste"
          />
        </div>

        <div class="flex gap-2">
          <button
            @click="cancelReset"
            class="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="verifyOtp"
            class="w-full py-2 bg-gold-700 text-white rounded hover:bg-gold-800"
          >
            Verify OTP
          </button>
        </div>
        <div class="space-y-2">
          <button
            @click="resendOtp"
            type="button"
            :disabled="resendCountdown > 0"
            class="w-full py-2 border border-gold-700 text-gold-700 rounded hover:bg-gold-50 disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Resend OTP
          </button>
          <p class="text-center text-xs text-gray-500">
            <span v-if="resendCountdown > 0">You can resend another OTP in {{ resendCountdownLabel }}.</span>
            <span v-else>You can request another OTP now.</span>
          </p>
        </div>
      </div>

      <!-- Step 3: Reset Password -->
      <div v-if="step === 3" class="space-y-4">
        <p class="text-sm text-gray-600">Enter your new password below.</p>
        <div class="relative">
          <input
            v-model="newPassword"
            :type="passwordVisible ? 'text' : 'password'"
            placeholder="New Password"
            class="w-full border rounded px-3 py-2 pr-10"
          />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" @click="togglePassword">
            <svg v-if="!passwordVisible" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.114-3.592m3.665-2.697A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.043 5.274M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
            </svg>
          </button>
        </div>
        <div class="relative">
          <input
            v-model="confirmPassword"
            :type="confirmPasswordVisible ? 'text' : 'password'"
            placeholder="Confirm Password"
            class="w-full border rounded px-3 py-2 pr-10"
          />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" @click="toggleConfirmPassword">
            <svg v-if="!confirmPasswordVisible" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.114-3.592m3.665-2.697A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.043 5.274M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
            </svg>
          </button>
        </div>

        <div class="flex gap-2">
          <button
            @click="cancelReset"
            class="w-full py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            @click="resetPassword"
            class="w-full py-2 bg-gold-700 text-white rounded hover:bg-gold-800"
          >
            Reset Password
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.otp-boxes {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
  max-width: 18.75rem;
  margin: 0 auto;
}

.otp-digit {
  height: 2.95rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(214, 186, 152, 0.8);
  background: linear-gradient(180deg, rgba(243, 241, 237, 0.98), rgba(234, 230, 223, 0.95));
  color: #6f3f2a;
  text-align: center;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.14s, background 0.2s;
}

.otp-digit:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 3px rgba(201, 162, 77, 0.22);
  transform: translateY(-1px);
}

.otp-digit-filled {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 237, 226, 0.96));
}
</style>
