<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-6 md:p-8">
      <div class="mx-auto max-w-4xl">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">Employee Profile</h1>
          <p class="text-slate-400">View and update your personal employee information.</p>
        </div>

        <DashboardSkeleton v-if="loading" />

        <div v-else class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
            <div class="flex flex-col items-center text-center">
              <div class="flex h-24 w-24 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-3xl font-bold text-white">
                {{ userInitial }}
              </div>
              <h2 class="mt-4 text-xl font-semibold text-white">{{ fullName || 'Employee' }}</h2>
              <p class="mt-1 text-sm text-slate-400">{{ profile.email || '-' }}</p>
            </div>

            <div class="mt-6 space-y-4">
              <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Role</p>
                <p class="mt-2 text-sm font-medium text-white">{{ profile.customRoleName || profile.role || '-' }}</p>
              </div>
              <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Branch</p>
                <p class="mt-2 text-sm font-medium text-white">{{ profile.branchLabel || '-' }}</p>
              </div>
              <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p class="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                <p class="mt-2 text-sm font-medium text-white">{{ profile.status || '-' }}</p>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-lg">
            <form class="space-y-5" @submit.prevent="saveProfile">
              <div class="grid gap-5 md:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-300">First Name</span>
                  <input
                    v-model.trim="profile.firstName"
                    type="text"
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-300">Last Name</span>
                  <input
                    v-model.trim="profile.lastName"
                    type="text"
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
              </div>

              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-300">Email</span>
                <input
                  :value="profile.email"
                  type="email"
                  readonly
                  class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-400 outline-none"
                />
                <span class="mt-2 block text-xs text-slate-500">Email is read-only here so it stays in sync with your login account.</span>
              </label>

              <div class="grid gap-5 md:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-300">Phone Number</span>
                  <input
                    v-model.trim="profile.phoneNumber"
                    type="text"
                    class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                  />
                </label>

                <label class="block">
                  <span class="mb-2 block text-sm font-medium text-slate-300">Employment Type</span>
                  <input
                    :value="profile.employmentType || '-'"
                    type="text"
                    readonly
                    class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-400 outline-none"
                  />
                </label>
              </div>

              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-300">Address</span>
                <textarea
                  v-model.trim="profile.address"
                  rows="4"
                  class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                ></textarea>
              </label>

              <div class="flex justify-end">
                <button
                  type="submit"
                  :disabled="saving"
                  class="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, updateDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import DashboardSkeleton from '@/components/common/DashboardSkeleton.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'EmployeeProfileSelf',
  components: { OwnerSidebar, DashboardSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)
    const saving = ref(false)
    const currentUserId = ref('')
    const profile = ref({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      address: '',
      role: '',
      customRoleName: '',
      employmentType: '',
      branchId: '',
      branchLabel: '',
      status: '',
    })

    const fullName = computed(() => `${profile.value.firstName || ''} ${profile.value.lastName || ''}`.trim())
    const userInitial = computed(() => (fullName.value || profile.value.email || 'E').charAt(0).toUpperCase())

    const loadProfile = async (uid, email) => {
      const userSnap = await getDoc(doc(db, 'users', uid))
      const userData = userSnap.exists() ? userSnap.data() || {} : {}
      let branchLabel = ''

      const branchId = String(userData.branchId || '').trim()
      if (branchId) {
        const branchSnap = await getDoc(doc(db, 'clinics', branchId))
        if (branchSnap.exists()) {
          const branchData = branchSnap.data() || {}
          branchLabel = [branchData.clinicBranch, branchData.clinicLocation].filter(Boolean).join(' - ')
        }
      }

      profile.value = {
        firstName: String(userData.firstName || '').trim(),
        lastName: String(userData.lastName || '').trim(),
        email: String(userData.email || email || '').trim(),
        phoneNumber: String(userData.phoneNumber || '').trim(),
        address: String(userData.address || '').trim(),
        role: String(userData.role || '').trim(),
        customRoleName: String(userData.customRoleName || '').trim(),
        employmentType: String(userData.employmentType || '').trim(),
        branchId,
        branchLabel: branchLabel || '-',
        status: String(userData.status || '').trim(),
      }
    }

    const saveProfile = async () => {
      if (!currentUserId.value) {
        toast.error('User not authenticated.')
        return
      }
      if (!profile.value.firstName || !profile.value.lastName) {
        toast.error('First name and last name are required.')
        return
      }

      saving.value = true
      try {
        await updateDoc(doc(db, 'users', currentUserId.value), {
          firstName: profile.value.firstName,
          lastName: profile.value.lastName,
          fullName: `${profile.value.firstName} ${profile.value.lastName}`.trim(),
          phoneNumber: profile.value.phoneNumber || '',
          address: profile.value.address || '',
          updatedAt: serverTimestamp(),
        })
        toast.success('Profile updated successfully.')
      } catch (error) {
        console.error('Failed to save employee profile:', error)
        toast.error('Unable to save profile right now.')
      } finally {
        saving.value = false
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          loading.value = false
          return
        }
        currentUserId.value = user.uid
        try {
          await loadProfile(user.uid, user.email || '')
        } catch (error) {
          console.error('Failed to load employee profile:', error)
          toast.error('Unable to load your profile right now.')
        } finally {
          loading.value = false
        }
      })
    })

    return {
      fullName,
      loading,
      profile,
      saveProfile,
      saving,
      userInitial,
    }
  },
}
</script>
