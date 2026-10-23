<template>
  <div class="flex min-h-screen bg-slate-900 module-theme">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'form', fields: 6, sections: 2 }" class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div class="mx-auto max-w-6xl">
        <header class="mb-7 overflow-hidden rounded-2xl border border-cyan-900/50 bg-gradient-to-br from-slate-800 via-slate-800 to-cyan-950/50 p-5 shadow-xl shadow-slate-950/20 sm:p-7">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">System Administration</p>
              <h1 class="mt-2 text-2xl font-bold text-white sm:text-3xl">Profile &amp; Security</h1>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Manage your administrator profile and keep your account secure.</p>
            </div>
            <span class="inline-flex items-center gap-2 rounded-full border border-cyan-800/70 bg-cyan-950/50 px-3 py-1.5 text-xs font-semibold text-cyan-200">
              <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
              System Administrator
            </span>
          </div>
        </header>

        <div v-if="loading" class="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-300">Loading profile and security settings...</div>

        <div v-else class="grid items-start gap-5 xl:grid-cols-2">
          <section class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
            <div class="mb-5 flex items-start gap-3 border-b border-slate-700/80 pb-4">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-800/60 bg-cyan-950/50 text-cyan-300">
                <Icon icon="mdi:account-edit-outline" class="text-xl" />
              </span>
              <div>
                <h2 class="text-lg font-semibold text-white">Profile Information</h2>
                <p class="mt-1 text-sm text-slate-400">This information identifies you in the system.</p>
              </div>
            </div>

            <div class="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <div class="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-800/70 bg-slate-950 text-xl font-bold text-white shadow-lg shadow-black/20">
                <img v-if="profilePreview || profile.profilePicture" :src="profilePreview || profile.profilePicture" alt="System administrator profile picture" class="h-full w-full object-cover" />
                <span v-else>{{ profileInitial }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-100">Profile photo</p>
                <p class="mt-1 text-xs leading-5 text-slate-400">JPG, PNG, or another image format. Maximum size: 5 MB.</p>
                <label class="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-white focus-within:ring-2 focus-within:ring-cyan-500">
                  {{ profilePictureFile ? 'Choose a different photo' : 'Upload profile photo' }}
                  <input type="file" accept="image/*" class="sr-only" @change="handleProfilePictureChange" />
                </label>
                <p v-if="profilePictureFile" class="mt-2 truncate text-xs text-cyan-300">{{ profilePictureFile.name }}</p>
              </div>
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
                <div class="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900 focus-within:border-cyan-500">
                  <span class="inline-flex items-center border-r border-slate-700 px-3 text-sm font-semibold text-slate-300">+63</span>
                  <input :value="profile.phoneNumber" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="9XXXXXXXXX" class="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-white outline-none" @input="handlePhoneInput" @blur="validatePhoneNumber" />
                </div>
                <span v-if="phoneNumberError" class="block text-xs text-rose-400">{{ phoneNumberError }}</span>
              </label>

              <button type="submit" class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" :disabled="savingProfile">
                {{ savingProfile ? 'Saving...' : 'Save Profile' }}
              </button>
            </form>
          </section>

          <section class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
            <div class="mb-5 flex items-start gap-3 border-b border-slate-700/80 pb-4">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-800/60 bg-violet-950/40 text-violet-300">
                <Icon icon="mdi:shield-lock-outline" class="text-xl" />
              </span>
              <div>
                <h2 class="text-lg font-semibold text-white">Password &amp; Security</h2>
                <p class="mt-1 text-sm text-slate-400">Use your current password to set a new one.</p>
              </div>
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

              <div class="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4">
                <p class="text-xs font-semibold text-violet-200">Password requirements</p>
                <p class="mt-1 text-xs leading-5 text-slate-400">At least 8 characters, including uppercase and lowercase letters, a number, and a special character.</p>
              </div>

              <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="submit" class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" :disabled="changingPassword">
                  {{ changingPassword ? 'Updating...' : 'Update Password' }}
                </button>
                <router-link :to="{ path: '/forgot-password', query: { returnTo: '/superadmin/account-settings' } }" class="text-center text-sm text-cyan-300 underline-offset-4 hover:underline sm:text-left">Forgot your password?</router-link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import { auth, db, storage } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const loading = ref(true)
const savingProfile = ref(false)
const changingPassword = ref(false)
const profile = reactive({ firstName: '', lastName: '', email: '', phoneNumber: '', profilePicture: '' })
const profilePictureFile = ref(null)
const profilePreview = ref('')
const phoneNumberError = ref('')
const profileInitial = computed(() => `${profile.firstName || ''} ${profile.lastName || ''}`.trim().charAt(0).toUpperCase() || 'A')
const passwords = reactive({ current: '', next: '', confirm: '' })

const normalizePhilippineMobile = (value) => {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}
const validatePhoneNumber = () => {
  phoneNumberError.value = /^9\d{9}$/.test(profile.phoneNumber) ? '' : 'Enter exactly 10 digits starting with 9.'
  return !phoneNumberError.value
}
const handlePhoneInput = (event) => {
  profile.phoneNumber = normalizePhilippineMobile(event?.target?.value)
  if (phoneNumberError.value) validatePhoneNumber()
}

const loadProfile = trackPageLoad(async () => {
  const user = auth.currentUser
  if (!user) return
  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid))
    const data = snapshot.exists() ? snapshot.data() || {} : {}
    profile.firstName = data.firstName || ''
    profile.lastName = data.lastName || ''
    profile.email = data.email || user.email || ''
    profile.phoneNumber = normalizePhilippineMobile(data.phoneNumber)
    profile.profilePicture = String(data.profilePicture || '').trim()
  } catch (error) {
    console.error('Failed to load system-admin profile:', error)
    toast.error('Unable to load account settings.')
  } finally {
    loading.value = false
  }
})

const saveProfile = async () => {
  const user = auth.currentUser
  if (!user) return
  if (!validatePhoneNumber()) {
    toast.error('Enter a valid Philippine mobile number before saving.')
    return
  }
  savingProfile.value = true
  try {
    let profilePicture = profile.profilePicture || ''
    if (profilePictureFile.value) {
      const file = profilePictureFile.value
      const fileRef = storageRef(storage, `userProfiles/${user.uid}/profile-${Date.now()}`)
      await uploadBytes(fileRef, file, { contentType: file.type })
      profilePicture = await getDownloadURL(fileRef)
    }
    await updateDoc(doc(db, 'users', user.uid), {
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      phoneNumber: profile.phoneNumber ? `+63${profile.phoneNumber}` : '',
      profilePicture,
      updatedAt: new Date(),
    })
    profile.profilePicture = profilePicture
    profilePictureFile.value = null
    toast.success('Profile updated successfully.')
  } catch (error) {
    console.error('Failed to update system-admin profile:', error)
    toast.error('Unable to update your profile.')
  } finally {
    savingProfile.value = false
  }
}

const handleProfilePictureChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('Please choose an image file.')
    event.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Profile pictures must be 5 MB or smaller.')
    event.target.value = ''
    return
  }
  profilePictureFile.value = file
  profilePreview.value = URL.createObjectURL(file)
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
