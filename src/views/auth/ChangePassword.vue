<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/config/firebaseConfig'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import axios from 'axios'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'

const router = useRouter()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const enteredOtp = ref('')
const generatedOtp = ref('')
const showOtp = ref(false)

const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const currentPasswordVisible = ref(false)

const roleRoutes = {
  Owner: '/owner/dashboard',
  'Clinic Admin': '/owner/dashboard',
  Manager: '/manager/dashboard',
  Receptionist: '/receptionist/dashboard',
  Practitioner: '/practitioner/dashboard',
  Admin: '/admin/dashboard',
  HR: '/hr/dashboard',
  Finance: '/finance/dashboard',
  Supply: '/supply/dashboard',
  Customer: '/customer/home'
}

const normalizeRoleKey = (value) => {
  const rawRole = String(value || '').trim().toLowerCase()
  if (!rawRole) return 'Customer'
  if (rawRole === 'hr') return 'HR'
  if (rawRole === 'crm') return 'CRM'
  if (rawRole === 'clinic admin' || rawRole === 'clinicadmin' || rawRole === 'clinic administrator') return 'Clinic Admin'
  return `${rawRole.charAt(0).toUpperCase()}${rawRole.slice(1)}`
}

const resolveRedirectPath = async (userData) => {
  const role = normalizeRoleKey(userData?.role || userData?.customRoleName || userData?.userType)
  if (roleRoutes[role]) {
    return roleRoutes[role]
  }

  const userType = String(userData?.userType || '').trim().toLowerCase()
  if (userType === 'staff') {
    return '/employee/dashboard'
  }

  return '/customer/home'
}

const togglePassword = () => (passwordVisible.value = !passwordVisible.value)
const toggleConfirmPassword = () => (confirmPasswordVisible.value = !confirmPasswordVisible.value)
const toggleCurrentPassword = () => (currentPasswordVisible.value = !currentPasswordVisible.value)

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const res = await axios.post('http://localhost:3000/send-otp', {
      recipient: toEmail,
      otp
    })
    return res.data
  } catch (err) {
    console.error('Error sending OTP email:', err.response?.data || err.message)
    return { success: false, error: err.message }
  }
}

const validatePassword = (pwd) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  if (!regex.test(pwd)) {
    toast.error('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character')
    return false
  }
  return true
}

const handleChangePassword = async () => {
  if (!showOtp.value) {
    if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
      toast.error('Please fill in all password fields.')
      return
    }
    if (newPassword.value !== confirmPassword.value) {
      toast.error('Passwords do not match.')
      return
    }
    if (!validatePassword(newPassword.value)) return

    generatedOtp.value = generateOtp()
    const result = await sendOtpEmail(auth.currentUser.email, generatedOtp.value)

    if (result.success) {
      showOtp.value = true
      toast.info('OTP sent to your email. Please verify.')
    } else {
      toast.error(result.error || 'Failed to send OTP email.')
    }
    return
  }

  if (enteredOtp.value !== generatedOtp.value) {
    toast.error('Invalid OTP.')
    return
  }

  try {
    const user = auth.currentUser
    const credential = EmailAuthProvider.credential(user.email, currentPassword.value)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword.value)

    const userRef = doc(db, 'users', user.uid)
    await updateDoc(userRef, { mustChangePassword: false })

    const updatedUserSnap = await getDoc(userRef)
    const redirectPath = await resolveRedirectPath(updatedUserSnap.exists() ? updatedUserSnap.data() : {})

    toast.success('Password changed successfully.')
    router.push(redirectPath)
  } catch (err) {
    console.error(err)
    toast.error(`Failed to change password: ${err.message}`)
  }
}
</script>

<template>
  <div class="min-h-[100dvh] bg-gradient-to-br from-cream-50 via-cream-100 to-gold-100 overflow-x-hidden no-scrollbar relative">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-gold-200/40 blur-3xl"></div>
      <div class="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cream-300/40 blur-3xl"></div>
    </div>

    <nav class="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-cream-50/95 via-cream-100/95 to-gold-50/95 backdrop-blur-md border-b border-gold-200/70 shadow-[0_6px_18px_rgba(54,34,22,0.08)]">
      <div class="relative max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 text-charcoal-700 hover:text-gold-700 transition-colors rounded-md px-2 py-1 hover:bg-gold-100/70">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <span class="nav-brand absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg sm:text-xl tracking-wide">
          AesthetiCare
        </span>
        <div class="w-8"></div>
      </div>
    </nav>

    <div class="relative z-10 flex items-center justify-center px-4 pt-24 pb-12 text-sm">
      <div class="relative w-full max-w-[560px] rounded-3xl overflow-hidden bg-white/68 backdrop-blur-xl border border-gold-200/60 shadow-2xl shadow-gold-900/15">
        <div class="relative z-10 px-6 py-10 sm:px-10">
          <form class="space-y-4" @submit.prevent="handleChangePassword">
            <div class="mb-2">
              <h1 class="form-title text-3xl sm:text-4xl leading-tight">Change Password</h1>
              <p class="text-charcoal-600 text-sm mt-1">
                {{ showOtp ? 'Enter the OTP sent to your email to continue.' : 'Set a new secure password for your account.' }}
              </p>
            </div>

            <div class="relative">
              <input
                :type="currentPasswordVisible ? 'text' : 'password'"
                v-model="currentPassword"
                required
                placeholder=" "
                class="peer input h-16 px-4 pr-12 pt-5"
              />
              <label class="floating-label">Current Password</label>
              <button type="button" @click="toggleCurrentPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 hover:text-gold-700" tabindex="-1">
                <svg v-if="!currentPasswordVisible" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.956 9.956 0 012.1-3.592M6.18 6.18A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>

            <div class="relative">
              <input
                :type="passwordVisible ? 'text' : 'password'"
                v-model="newPassword"
                required
                placeholder=" "
                class="peer input h-16 px-4 pr-12 pt-5"
              />
              <label class="floating-label">New Password</label>
              <button type="button" @click="togglePassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 hover:text-gold-700" tabindex="-1">
                <svg v-if="!passwordVisible" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.956 9.956 0 012.1-3.592M6.18 6.18A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>

            <div class="relative">
              <input
                :type="confirmPasswordVisible ? 'text' : 'password'"
                v-model="confirmPassword"
                required
                placeholder=" "
                class="peer input h-16 px-4 pr-12 pt-5"
              />
              <label class="floating-label">Confirm New Password</label>
              <button type="button" @click="toggleConfirmPassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 hover:text-gold-700" tabindex="-1">
                <svg v-if="!confirmPasswordVisible" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.956 9.956 0 012.1-3.592M6.18 6.18A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>

            <div v-if="showOtp" class="relative">
              <input
                v-model="enteredOtp"
                placeholder=" "
                class="peer input h-16 px-4 pt-5"
              />
              <label class="floating-label">Enter OTP</label>
            </div>

            <button
              type="submit"
              class="w-full py-3 rounded-xl bg-gold-700 text-white font-semibold text-base hover:bg-gold-800 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              {{ showOtp ? 'Verify OTP & Update Password' : 'Send OTP' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.form-title {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #6f3f2a;
  background: linear-gradient(120deg, #4a2c1e 0%, #996341 40%, #c89066 72%, #7b4e35 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-brand {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: linear-gradient(120deg, #3c2519 0%, #9f6946 42%, #c99673 70%, #744a33 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.input {
  width: 100%;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(232, 167, 58, 0.35);
  color: #333;
  line-height: 1.25rem;
  vertical-align: middle;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input::placeholder {
  color: transparent;
}

.floating-label {
  position: absolute;
  left: 1rem;
  top: 0.95rem;
  color: #8a5b3d;
  font-size: 0.95rem;
  line-height: 1;
  pointer-events: none;
  transition: all 0.2s ease;
}

.peer:placeholder-shown + .floating-label {
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.05rem;
  color: #9b7a5f;
}

.peer:focus + .floating-label,
.peer:not(:placeholder-shown) + .floating-label {
  top: 0.7rem;
  transform: translateY(0);
  font-size: 0.75rem;
  color: #8c5a3a;
}

.input:focus {
  border-color: #c9a24d;
  box-shadow: 0 0 0 3px rgba(201, 162, 77, 0.25);
}
</style>
