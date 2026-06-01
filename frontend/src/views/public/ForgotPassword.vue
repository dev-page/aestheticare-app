<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/config/firebaseConfig'
import { collection, query, where, getDocs } from 'firebase/firestore'
import axios from 'axios'
import { toast } from 'vue3-toastify'
import { OTP_API_BASE_CANDIDATES } from '@/utils/runtimeConfig'

const router = useRouter()
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

const postToBackend = async (path, payload) => {
  let lastError = null
  for (const baseUrl of OTP_API_BASE_CANDIDATES) {
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
  const digits = String(event?.target?.value || '').replace(/\D/g, '')

  if (!digits) {
    otpDigits.value[index] = ''
    return
  }

  if (digits.length === 1) {
    otpDigits.value[index] = digits
    if (index < OTP_LENGTH - 1) focusOtpInput(index + 1)
    return
  }

  const spread = digits.slice(0, OTP_LENGTH - index).split('')
  spread.forEach((digit, offset) => {
    otpDigits.value[index + offset] = digit
  })

  const nextIndex = Math.min(index + spread.length, OTP_LENGTH - 1)
  focusOtpInput(nextIndex)
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
  event.preventDefault()
  const pastedDigits = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, OTP_LENGTH) || ''
  if (!pastedDigits) return
  clearOtpInputs()
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
  <div class="forgot-shell">
    <div class="forgot-shell-glow forgot-glow-left"></div>
    <div class="forgot-shell-glow forgot-glow-right"></div>

    <div class="forgot-layout">
      <section class="forgot-hero">
        <p class="forgot-kicker">Account recovery</p>
        <h1 class="forgot-title">Reset your password with a clean, secure OTP flow.</h1>
        <p class="forgot-copy">
          We'll verify your email, send a one-time code, and let you create a fresh password without affecting your account data.
        </p>

        <div class="forgot-points">
          <div class="forgot-point">
            <span class="forgot-point-icon">1</span>
            <div>
              <p class="forgot-point-title">Verify email</p>
              <p class="forgot-point-copy">We check that the email exists in our records.</p>
            </div>
          </div>
          <div class="forgot-point">
            <span class="forgot-point-icon">2</span>
            <div>
              <p class="forgot-point-title">Confirm OTP</p>
              <p class="forgot-point-copy">Enter the six-digit code sent to your inbox.</p>
            </div>
          </div>
          <div class="forgot-point">
            <span class="forgot-point-icon">3</span>
            <div>
              <p class="forgot-point-title">Set new password</p>
              <p class="forgot-point-copy">Choose a stronger password and sign back in.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="forgot-card">
        <div class="forgot-card-header">
          <div>
            <p class="forgot-card-kicker">Recover account</p>
            <h2 class="forgot-card-title">Password reset</h2>
          </div>
          <div class="forgot-step-badge">Step {{ step }} of 3</div>
        </div>

        <div class="forgot-step-track" aria-hidden="true">
          <span :class="['forgot-step-dot', { active: step >= 1 }]"></span>
          <span :class="['forgot-step-line', { active: step >= 2 }]"></span>
          <span :class="['forgot-step-dot', { active: step >= 2 }]"></span>
          <span :class="['forgot-step-line', { active: step >= 3 }]"></span>
          <span :class="['forgot-step-dot', { active: step >= 3 }]"></span>
        </div>

        <div v-if="step === 1" class="forgot-step-panel">
          <p class="forgot-step-label">Step 1</p>
          <p class="forgot-step-copy">
            Enter your registered email address so we can send a one-time code.
          </p>
          <label class="forgot-field">
            <span class="forgot-field-label">Email Address</span>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="forgot-input"
            />
          </label>

          <div class="forgot-actions">
            <button
              type="button"
              @click="cancelReset"
              class="forgot-button forgot-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="sendOtp"
              class="forgot-button forgot-button-primary"
            >
              Send OTP
            </button>
          </div>
        </div>

        <div v-if="step === 2" class="forgot-step-panel">
          <p class="forgot-step-label">Step 2</p>
          <p class="forgot-step-copy">
            We sent an OTP to <strong>{{ email }}</strong>. Enter it below to verify.
          </p>
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

          <div class="forgot-actions">
            <button
              type="button"
              @click="cancelReset"
              class="forgot-button forgot-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="verifyOtp"
              class="forgot-button forgot-button-primary"
            >
              Verify OTP
            </button>
          </div>

          <div class="forgot-resend-card">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="forgot-resend-title">Didn't receive it?</p>
                <p class="forgot-resend-copy">
                  <span v-if="resendCountdown > 0">You can resend another OTP in {{ resendCountdownLabel }}.</span>
                  <span v-else>You can request another OTP now.</span>
                </p>
              </div>
              <button
                @click="resendOtp"
                type="button"
                :disabled="resendCountdown > 0"
                class="forgot-button forgot-button-secondary"
              >
                Resend
              </button>
            </div>
          </div>
        </div>

        <div v-if="step === 3" class="forgot-step-panel">
          <p class="forgot-step-label">Step 3</p>
          <p class="forgot-step-copy">
            Enter your new password below and confirm it before saving.
          </p>

          <label class="forgot-field">
            <span class="forgot-field-label">New Password</span>
            <div class="forgot-password-field">
              <input
                v-model="newPassword"
                :type="passwordVisible ? 'text' : 'password'"
                placeholder="New Password"
                class="forgot-input forgot-input-with-icon"
              />
              <button type="button" class="forgot-eye-button" @click="togglePassword" aria-label="Toggle password visibility">
                <svg v-if="!passwordVisible" xmlns="http://www.w3.org/2000/svg" class="forgot-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="forgot-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.114-3.592m3.665-2.697A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.043 5.274M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                </svg>
              </button>
            </div>
          </label>

          <label class="forgot-field">
            <span class="forgot-field-label">Confirm Password</span>
            <div class="forgot-password-field">
              <input
                v-model="confirmPassword"
                :type="confirmPasswordVisible ? 'text' : 'password'"
                placeholder="Confirm Password"
                class="forgot-input forgot-input-with-icon"
              />
              <button type="button" class="forgot-eye-button" @click="toggleConfirmPassword" aria-label="Toggle password visibility">
                <svg v-if="!confirmPasswordVisible" xmlns="http://www.w3.org/2000/svg" class="forgot-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="forgot-eye-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.114-3.592m3.665-2.697A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.043 5.274M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                </svg>
              </button>
            </div>
          </label>

          <div class="forgot-actions">
            <button
              type="button"
              @click="cancelReset"
              class="forgot-button forgot-button-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="resetPassword"
              class="forgot-button forgot-button-primary"
            >
              Reset Password
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.forgot-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 2rem 1rem;
  background:
    radial-gradient(circle at top left, rgba(201, 162, 77, 0.18), transparent 28%),
    radial-gradient(circle at bottom right, rgba(232, 210, 185, 0.35), transparent 32%),
    linear-gradient(135deg, #f7e8c4 0%, #f5ebda 52%, #f1e0ca 100%);
}

.forgot-shell-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(56px);
  pointer-events: none;
}

.forgot-glow-left {
  top: -4rem;
  left: -3rem;
  width: 16rem;
  height: 16rem;
  background: rgba(201, 162, 77, 0.22);
}

.forgot-glow-right {
  right: -2rem;
  bottom: -5rem;
  width: 18rem;
  height: 18rem;
  background: rgba(255, 255, 255, 0.34);
}

.forgot-layout {
  position: relative;
  z-index: 1;
  max-width: 78rem;
  margin: 0 auto;
  display: grid;
  gap: 1.5rem;
  align-items: stretch;
}

.forgot-hero,
.forgot-card {
  border-radius: 2rem;
  border: 1px solid rgba(193, 143, 85, 0.2);
  box-shadow: 0 24px 60px rgba(73, 42, 18, 0.12);
}

.forgot-hero {
  background: linear-gradient(180deg, rgba(52, 32, 20, 0.96), rgba(37, 23, 15, 0.96));
  color: #f8ecd8;
  padding: 2rem;
}

.forgot-kicker,
.forgot-card-kicker {
  text-transform: uppercase;
  letter-spacing: 0.26em;
  font-size: 0.7rem;
  font-weight: 700;
}

.forgot-kicker {
  color: #e4c18d;
}

.forgot-title {
  margin-top: 0.75rem;
  font-family: "Playfair Display", serif;
  font-size: clamp(2rem, 4vw, 3.3rem);
  line-height: 1.02;
  letter-spacing: -0.03em;
  max-width: 14ch;
}

.forgot-copy {
  margin-top: 1rem;
  max-width: 42rem;
  font-size: 0.98rem;
  line-height: 1.7;
  color: rgba(248, 236, 216, 0.84);
}

.forgot-points {
  margin-top: 1.75rem;
  display: grid;
  gap: 0.9rem;
}

.forgot-point {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 0.95rem 1rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(232, 194, 133, 0.12);
}

.forgot-point-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: rgba(201, 162, 77, 0.16);
  color: #f3d7a2;
  font-weight: 700;
  flex: 0 0 auto;
}

.forgot-point-title {
  font-weight: 700;
  color: #fff3de;
}

.forgot-point-copy {
  margin-top: 0.15rem;
  color: rgba(248, 236, 216, 0.76);
  font-size: 0.92rem;
}

.forgot-card {
  background: rgba(252, 246, 236, 0.95);
  backdrop-filter: blur(16px);
  padding: 1.5rem;
}

.forgot-card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.forgot-card-kicker {
  color: #a66a3c;
}

.forgot-card-title {
  margin-top: 0.4rem;
  font-family: "Playfair Display", serif;
  font-size: 1.8rem;
  color: #3c2416;
}

.forgot-step-badge {
  flex: 0 0 auto;
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  background: rgba(201, 162, 77, 0.14);
  color: #8a5a37;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.forgot-step-track {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.2rem;
  margin-bottom: 1.35rem;
}

.forgot-step-dot {
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
  background: rgba(180, 148, 114, 0.25);
  border: 1px solid rgba(180, 148, 114, 0.4);
}

.forgot-step-dot.active {
  background: #a96e43;
  border-color: #a96e43;
  box-shadow: 0 0 0 4px rgba(169, 110, 67, 0.14);
}

.forgot-step-line {
  flex: 1;
  height: 2px;
  border-radius: 999px;
  background: rgba(180, 148, 114, 0.2);
}

.forgot-step-line.active {
  background: linear-gradient(90deg, #b88357, #d2b27d);
}

.forgot-step-panel {
  display: grid;
  gap: 1rem;
}

.forgot-step-label {
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a66a3c;
  font-weight: 700;
}

.forgot-step-copy {
  color: #6e4a34;
  line-height: 1.7;
  font-size: 0.98rem;
}

.forgot-field {
  display: grid;
  gap: 0.45rem;
}

.forgot-field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #7d563d;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.forgot-input {
  width: 100%;
  border: 1px solid rgba(180, 148, 114, 0.45);
  border-radius: 1rem;
  background: linear-gradient(180deg, rgba(253, 251, 247, 0.98), rgba(243, 236, 225, 0.96));
  color: #2f1d13;
  padding: 0.95rem 1rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

.forgot-input:focus {
  border-color: #b57a47;
  box-shadow: 0 0 0 4px rgba(181, 122, 71, 0.16);
  transform: translateY(-1px);
}

.forgot-password-field {
  position: relative;
}

.forgot-input-with-icon {
  padding-right: 3rem;
}

.forgot-eye-button {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #936242;
  transition: background 0.2s, color 0.2s, transform 0.2s;
}

.forgot-eye-button:hover {
  background: rgba(201, 162, 77, 0.12);
  color: #6f412a;
  transform: translateY(-50%) scale(1.04);
}

.forgot-eye-icon {
  width: 1.05rem;
  height: 1.05rem;
}

.forgot-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 0.25rem;
}

.forgot-button {
  min-height: 2.95rem;
  border-radius: 1rem;
  padding: 0.8rem 1rem;
  font-weight: 700;
  transition: transform 0.16s, box-shadow 0.2s, background 0.2s, border-color 0.2s, opacity 0.2s;
}

.forgot-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.forgot-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.forgot-button-ghost {
  border: 1px solid rgba(160, 117, 80, 0.22);
  background: rgba(255, 255, 255, 0.62);
  color: #6f4a32;
}

.forgot-button-ghost:hover:not(:disabled) {
  background: rgba(248, 236, 216, 0.9);
}

.forgot-button-primary {
  border: 1px solid #a96e43;
  background: linear-gradient(180deg, #b97b4d, #99613d);
  color: #fff8ef;
  box-shadow: 0 14px 28px rgba(153, 97, 61, 0.2);
}

.forgot-button-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #c48351, #8e5836);
}

.forgot-button-secondary {
  min-height: 2.7rem;
  padding-inline: 1rem;
  border: 1px solid rgba(169, 110, 67, 0.22);
  background: rgba(201, 162, 77, 0.12);
  color: #8a5a37;
}

.forgot-button-secondary:hover:not(:disabled) {
  background: rgba(201, 162, 77, 0.18);
}

.forgot-resend-card {
  margin-top: 0.25rem;
  padding: 1rem;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, rgba(249, 242, 231, 0.96), rgba(241, 232, 218, 0.92));
  border: 1px solid rgba(180, 148, 114, 0.2);
}

.forgot-resend-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #5e3d2a;
}

.forgot-resend-copy {
  margin-top: 0.2rem;
  color: #8a6b53;
  font-size: 0.82rem;
  line-height: 1.5;
}

.otp-boxes {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
  max-width: 20rem;
  margin: 0 auto;
}

.otp-digit {
  height: 3.2rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(214, 186, 152, 0.9);
  background: linear-gradient(180deg, rgba(250, 247, 242, 0.98), rgba(241, 233, 223, 0.95));
  color: #6f3f2a;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.14s, background 0.2s;
}

.otp-digit:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 4px rgba(201, 162, 77, 0.2);
  transform: translateY(-1px);
}

.otp-digit-filled {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 237, 226, 0.96));
}

@media (min-width: 1024px) {
  .forgot-layout {
    grid-template-columns: 1.05fr 0.95fr;
    padding-top: 1rem;
  }

  .forgot-hero,
  .forgot-card {
    min-height: 42rem;
  }

  .forgot-hero {
    padding: 2.5rem;
  }

  .forgot-card {
    padding: 1.9rem;
  }
}

@media (max-width: 639px) {
  .forgot-shell {
    padding: 1rem 0.75rem 1.5rem;
  }

  .forgot-hero,
  .forgot-card {
    border-radius: 1.5rem;
  }

  .forgot-hero {
    padding: 1.35rem;
  }

  .forgot-card {
    padding: 1.15rem;
  }

  .forgot-title {
    max-width: none;
  }

  .forgot-actions {
    grid-template-columns: 1fr;
  }

  .forgot-card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .otp-boxes {
    gap: 0.35rem;
  }

  .otp-digit {
    height: 2.75rem;
    border-radius: 0.8rem;
    font-size: 1.2rem;
  }
}
</style>
