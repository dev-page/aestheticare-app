<template>
  <div class="flex module-theme min-h-screen bg-slate-900">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-3xl">
        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Account Security</p>
          <h1 class="mt-3 text-3xl font-bold text-white">Reset Password</h1>
          <p class="mt-2 text-sm text-slate-400">
            Verify the OTP sent to your email, then set a new secure password for your employee account.
          </p>
        </div>

        <section class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
          <form class="space-y-5" @submit.prevent="handleChangePassword">
            <div class="grid gap-5 md:grid-cols-2">
              <label class="block md:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-300">Current Password</span>
                <div class="relative">
                  <input
                    :type="currentPasswordVisible ? 'text' : 'password'"
                    v-model="currentPassword"
                    required
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-white outline-none transition focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-300"
                    tabindex="-1"
                    @click="toggleCurrentPassword"
                  >
                    <span v-if="currentPasswordVisible">Hide</span>
                    <span v-else>Show</span>
                  </button>
                </div>
              </label>

              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-300">New Password</span>
                <div class="relative">
                  <input
                    :type="passwordVisible ? 'text' : 'password'"
                    v-model="newPassword"
                    required
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-white outline-none transition focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-300"
                    tabindex="-1"
                    @click="togglePassword"
                  >
                    <span v-if="passwordVisible">Hide</span>
                    <span v-else>Show</span>
                  </button>
                </div>
              </label>

              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-300">Confirm New Password</span>
                <div class="relative">
                  <input
                    :type="confirmPasswordVisible ? 'text' : 'password'"
                    v-model="confirmPassword"
                    required
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-white outline-none transition focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-cyan-300"
                    tabindex="-1"
                    @click="toggleConfirmPassword"
                  >
                    <span v-if="confirmPasswordVisible">Hide</span>
                    <span v-else>Show</span>
                  </button>
                </div>
              </label>
            </div>

            <div v-if="showOtp" class="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-300">Enter OTP</span>
                <input
                  v-model="enteredOtp"
                  class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
                <span class="mt-2 block text-xs text-slate-500">Check the email address connected to this employee account.</span>
              </label>
            </div>

            <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p class="text-sm text-slate-400">
                Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.
              </p>
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                class="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {{ showOtp ? 'Verify OTP and Update Password' : 'Send OTP' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/config/firebaseConfig'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import axios from 'axios'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'EmployeeChangePassword',
  components: { OwnerSidebar },
  setup() {
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

    const togglePassword = () => (passwordVisible.value = !passwordVisible.value)
    const toggleConfirmPassword = () => (confirmPasswordVisible.value = !confirmPasswordVisible.value)
    const toggleCurrentPassword = () => (currentPasswordVisible.value = !currentPasswordVisible.value)

    const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

    const sendOtpEmail = async (toEmail, otp) => {
      try {
        const res = await axios.post('http://localhost:3000/send-otp', {
          recipient: toEmail,
          otp,
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
        const userData = updatedUserSnap.exists() ? updatedUserSnap.data() || {} : {}
        const userType = String(userData.userType || '').trim().toLowerCase()

        toast.success('Password changed successfully.')
        router.push(userType === 'staff' ? '/employee/dashboard' : '/change-password')
      } catch (err) {
        console.error(err)
        toast.error(`Failed to change password: ${err.message}`)
      }
    }

    return {
      confirmPassword,
      confirmPasswordVisible,
      currentPassword,
      currentPasswordVisible,
      enteredOtp,
      handleChangePassword,
      newPassword,
      passwordVisible,
      showOtp,
      toggleConfirmPassword,
      toggleCurrentPassword,
      togglePassword,
    }
  },
}
</script>
