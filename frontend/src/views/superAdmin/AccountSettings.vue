<template>
  <div class="flex min-h-screen bg-slate-900 module-theme">
    <SuperAdminSidebar />

    <main class="flex-1 p-5 md:p-8">
      <div class="mx-auto max-w-4xl">
        <div class="mb-6">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">System Administration</p>
          <h1 class="mt-2 text-3xl font-bold text-white">Account Settings</h1>
          <p class="mt-2 text-slate-400">Manage your administrator profile and password securely.</p>
        </div>

        <div v-if="loading" class="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-300">Loading account settings...</div>

        <div v-else class="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl shadow-slate-950/20">
            <div class="mb-5">
              <h2 class="text-lg font-semibold text-white">Profile Information</h2>
              <p class="mt-1 text-sm text-slate-400">This information identifies you in the system.</p>
            </div>

            <form class="space-y-4" @submit.prevent="saveProfile">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-sm text-slate-300">First Name</span>
                  <input v-model.trim="profile.firstName" required class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm text-slate-300">Last Name</span>
                  <input v-model.trim="profile.lastName" required class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
                </label>
              </div>

              <label class="block space-y-2">
                <span class="text-sm text-slate-300">Email Address</span>
                <input :value="auth.currentUser?.email || profile.email" disabled class="w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-slate-400" />
                <span class="block text-xs text-slate-500">Email changes require a separate re-verification flow.</span>
              </label>

              <label class="block space-y-2">
                <span class="text-sm text-slate-300">Phone Number</span>
                <input v-model.trim="profile.phoneNumber" inputmode="numeric" placeholder="9XXXXXXXXX" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
              </label>

              <button type="submit" class="rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60" :disabled="savingProfile">
                {{ savingProfile ? 'Saving...' : 'Save Profile' }}
              </button>
            </form>
          </section>

          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl shadow-slate-950/20">
            <div class="mb-5">
              <h2 class="text-lg font-semibold text-white">Password and Security</h2>
              <p class="mt-1 text-sm text-slate-400">Use your current password to set a new one.</p>
            </div>

            <form class="space-y-4" @submit.prevent="changePassword">
              <label class="block space-y-2">
                <span class="text-sm text-slate-300">Current Password</span>
                <input v-model="passwords.current" type="password" autocomplete="current-password" required class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
              </label>
              <label class="block space-y-2">
                <span class="text-sm text-slate-300">New Password</span>
                <input v-model="passwords.next" type="password" autocomplete="new-password" required class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
              </label>
              <label class="block space-y-2">
                <span class="text-sm text-slate-300">Confirm New Password</span>
                <input v-model="passwords.confirm" type="password" autocomplete="new-password" required class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none transition focus:border-cyan-500" />
              </label>

              <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs leading-5 text-slate-400">
                Use at least 8 characters with uppercase and lowercase letters, a number, and a special character.
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <button type="submit" class="rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60" :disabled="changingPassword">
                  {{ changingPassword ? 'Updating...' : 'Update Password' }}
                </button>
                <router-link :to="{ path: '/forgot-password', query: { returnTo: '/superadmin/account-settings' } }" class="text-sm text-cyan-300 underline-offset-4 hover:underline">Forgot your password?</router-link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import { auth, db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const loading = ref(true)
const savingProfile = ref(false)
const changingPassword = ref(false)
const profile = reactive({ firstName: '', lastName: '', email: '', phoneNumber: '' })
const passwords = reactive({ current: '', next: '', confirm: '' })

const loadProfile = async () => {
  const user = auth.currentUser
  if (!user) return
  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid))
    const data = snapshot.exists() ? snapshot.data() || {} : {}
    profile.firstName = data.firstName || ''
    profile.lastName = data.lastName || ''
    profile.email = data.email || user.email || ''
    profile.phoneNumber = String(data.phoneNumber || '').replace(/^\+63/, '')
  } catch (error) {
    console.error('Failed to load system-admin profile:', error)
    toast.error('Unable to load account settings.')
  } finally {
    loading.value = false
  }
}

const saveProfile = async () => {
  const user = auth.currentUser
  if (!user) return
  savingProfile.value = true
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      phoneNumber: profile.phoneNumber ? `+63${profile.phoneNumber}` : '',
      updatedAt: new Date(),
    })
    toast.success('Profile updated successfully.')
  } catch (error) {
    console.error('Failed to update system-admin profile:', error)
    toast.error('Unable to update your profile.')
  } finally {
    savingProfile.value = false
  }
}

const changePassword = async () => {
  const user = auth.currentUser
  if (!user?.email) return
  if (passwords.next !== passwords.confirm) {
    toast.error('New passwords do not match.')
    return
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(passwords.next)) {
    toast.error('Password must meet all the requirements shown.')
    return
  }

  changingPassword.value = true
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, passwords.current))
    await updatePassword(user, passwords.next)
    await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, updatedAt: new Date() })
    passwords.current = ''
    passwords.next = ''
    passwords.confirm = ''
    toast.success('Password updated successfully.')
  } catch (error) {
    console.error('Failed to update system-admin password:', error)
    const code = error?.code || ''
    toast.error(code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Current password is incorrect.' : 'Unable to update your password.')
  } finally {
    changingPassword.value = false
  }
}

onMounted(loadProfile)
</script>
