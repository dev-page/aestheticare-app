<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Admin List</h1>
          <p class="text-slate-400">Manage system administrators with full platform access.</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <input
            v-model="search"
            type="text"
            placeholder="Search name, email, role..."
            class="w-72 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
            :disabled="loading"
            @click="loadAdmins"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
            @click="openAddModal"
          >
            Add Admin
          </button>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div class="border-b border-slate-700 px-4 py-3 text-sm text-slate-400">
          Total Admin Accounts: <span class="font-semibold text-slate-200">{{ filteredAdmins.length }}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-900/70">
              <tr>
                <th class="px-4 py-3 text-left text-slate-300">Name</th>
                <th class="px-4 py-3 text-left text-slate-300">Email</th>
                <th class="px-4 py-3 text-left text-slate-300">Role</th>
                <th class="px-4 py-3 text-left text-slate-300">Status</th>
                <th class="px-4 py-3 text-left text-slate-300">Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-300" colspan="5">Loading admin accounts...</td>
              </tr>
              <tr v-else-if="!filteredAdmins.length">
                <td class="px-4 py-3 text-slate-300" colspan="5">No admin accounts found.</td>
              </tr>
              <tr v-for="admin in filteredAdmins" :key="admin.id" class="border-b border-slate-700/60 last:border-b-0">
                <td class="px-4 py-3 text-slate-100">{{ admin.fullName }}</td>
                <td class="px-4 py-3 text-slate-300">{{ admin.email || '-' }}</td>
                <td class="px-4 py-3 text-slate-300">{{ admin.role || 'Superadmin' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-md px-2 py-1 text-xs font-medium" :class="statusClass(admin.status)">
                    {{ admin.status || 'Unknown' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400">{{ admin.createdLabel }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6"
        @click.self="closeAddModal"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">Add Admin</h2>
              <p class="mt-1 text-sm text-slate-400">Create a platform administrator account.</p>
            </div>
            <button type="button" class="text-slate-400 hover:text-white" @click="closeAddModal">✕</button>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="createAdmin">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2">
                <span class="text-sm text-slate-300">First Name</span>
                <input v-model.trim="newAdmin.firstName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <p v-if="formErrors.firstName" class="text-xs text-rose-400">{{ formErrors.firstName }}</p>
              </label>
              <label class="space-y-2">
                <span class="text-sm text-slate-300">Last Name</span>
                <input v-model.trim="newAdmin.lastName" type="text" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
                <p v-if="formErrors.lastName" class="text-xs text-rose-400">{{ formErrors.lastName }}</p>
              </label>
            </div>

            <label class="space-y-2 block">
              <span class="text-sm text-slate-300">Email</span>
              <input v-model.trim="newAdmin.email" type="email" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
              <p v-if="formErrors.email" class="text-xs text-rose-400">{{ formErrors.email }}</p>
            </label>

            <label class="space-y-2 block">
              <span class="text-sm text-slate-300">Phone Number <span class="text-slate-500">(optional)</span></span>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">+63</span>
                <input v-model.trim="newAdmin.phoneNumber" type="text" inputmode="numeric" maxlength="10" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pl-12 text-white" placeholder="9XXXXXXXXX" />
              </div>
              <p v-if="formErrors.phoneNumber" class="text-xs text-rose-400">{{ formErrors.phoneNumber }}</p>
            </label>

            <div class="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              <p class="text-sm font-semibold text-slate-100">Account Preview</p>
              <p class="mt-2 text-sm text-slate-400">
                Role: <span class="text-white">Superadmin</span>
              </p>
              <p class="text-sm text-slate-400">
                User Type: <span class="text-white">systemadmin</span>
              </p>
              <p class="text-sm text-slate-400">
                Default Password: <span class="text-white">password123</span>
              </p>
            </div>

            <div class="flex justify-end gap-3">
              <button type="button" class="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800" @click="closeAddModal">
                Cancel
              </button>
              <button type="submit" class="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400" :disabled="saving">
                {{ saving ? 'Creating...' : 'Create Admin' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

const DEFAULT_ADMIN_PASSWORD = 'password123'

const normalizeRoleKey = (value) => {
  const compact = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!compact) return ''
  if (compact === 'superadmin' || compact === 'systemadmin' || compact === 'sysadmin') return 'Superadmin'
  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}

const formatDate = (value) => {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null
  if (!date) return '-'
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default {
  name: 'SuperAdminAdminList',
  components: { SuperAdminSidebar },
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const error = ref('')
    const search = ref('')
    const admins = ref([])
    const showAddModal = ref(false)
    const newAdmin = ref({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    })

    const formErrors = computed(() => {
      const errors = { firstName: '', lastName: '', email: '', phoneNumber: '' }
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
      const phone = String(newAdmin.value.phoneNumber || '').trim()

      if (!newAdmin.value.firstName.trim()) errors.firstName = 'First name is required.'
      if (!newAdmin.value.lastName.trim()) errors.lastName = 'Last name is required.'
      if (!newAdmin.value.email.trim()) errors.email = 'Email is required.'
      else if (!emailRegex.test(newAdmin.value.email.trim())) errors.email = 'Enter a valid email address.'
      if (phone && (!/^\d{10}$/.test(phone) || !phone.startsWith('9'))) {
        errors.phoneNumber = 'Enter a valid PH mobile number starting with 9.'
      }
      return errors
    })

    const hasFormErrors = computed(() => Object.values(formErrors.value).some(Boolean))

    const statusClass = (status) => {
      const normalized = String(status || '').toLowerCase()
      if (normalized === 'active') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      if (normalized.includes('pending')) return 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      if (normalized === 'inactive' || normalized === 'disabled' || normalized === 'archived') return 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      return 'bg-slate-600/30 text-slate-200 border border-slate-500/40'
    }

    const isSystemAdmin = (user) => {
      const role = normalizeRoleKey(user?.role)
      const userType = String(user?.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      return role === 'Superadmin' || userType === 'systemadmin'
    }

    const isArchived = (user) => {
      const status = String(user?.status || '').trim().toLowerCase()
      return user?.archived === true || status === 'inactive' || status === 'disabled'
    }

    const loadAdmins = async () => {
      loading.value = true
      error.value = ''
      try {
        const snapshot = await getDocs(collection(db, 'users'))
        admins.value = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((user) => isSystemAdmin(user) && !isArchived(user))
          .map((user) => ({
            id: user.id,
            fullName:
              String(user.fullName || '').trim() ||
              `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
              'Unnamed Admin',
            email: user.email || '',
            role: normalizeRoleKey(user.role) || 'Superadmin',
            status: user.status || 'Unknown',
            createdLabel: formatDate(user.createdAt),
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
      } catch (err) {
        console.error('Error loading admin accounts:', err)
        error.value = 'Failed to load admin accounts. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const filteredAdmins = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return admins.value
      return admins.value.filter((admin) =>
        [admin.fullName, admin.email, admin.role, admin.status].join(' ').toLowerCase().includes(keyword)
      )
    })

    const openAddModal = () => {
      newAdmin.value = { firstName: '', lastName: '', email: '', phoneNumber: '' }
      showAddModal.value = true
    }

    const closeAddModal = () => {
      showAddModal.value = false
    }

    const createAdmin = async () => {
      if (hasFormErrors.value) {
        const firstError = Object.values(formErrors.value).find(Boolean)
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      const confirm = await Swal.fire({
        title: 'Create Admin Account?',
        text: `Create a system administrator account for ${newAdmin.value.firstName} ${newAdmin.value.lastName}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, create',
        cancelButtonText: 'Cancel',
      })
      if (!confirm.isConfirmed) return

      saving.value = true
      let creatorApp = null
      let creatorAuth = null
      try {
        const appName = `superadmin-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`
        creatorApp = initializeApp(getApp().options, appName)
        creatorAuth = getAuth(creatorApp)
        const credential = await createUserWithEmailAndPassword(creatorAuth, newAdmin.value.email, DEFAULT_ADMIN_PASSWORD)
        const uid = credential.user.uid
        const phone = String(newAdmin.value.phoneNumber || '').trim()

        await setDoc(doc(db, 'users', uid), {
          firstName: newAdmin.value.firstName.trim(),
          lastName: newAdmin.value.lastName.trim(),
          fullName: `${newAdmin.value.firstName.trim()} ${newAdmin.value.lastName.trim()}`,
          email: newAdmin.value.email.trim(),
          phoneNumber: phone ? `+63${phone}` : '',
          role: 'Superadmin',
          userType: 'systemadmin',
          status: 'Active',
          mustChangePassword: true,
          createdAt: new Date(),
        })

        toast.success('Admin account created successfully.')
        showAddModal.value = false
        await loadAdmins()
      } catch (err) {
        console.error('Error creating admin account:', err)
        toast.error(err?.code === 'auth/email-already-in-use' ? 'This email is already registered.' : 'Failed to create admin account.')
      } finally {
        if (creatorAuth) {
          await signOut(creatorAuth).catch(() => {})
        }
        if (creatorApp) {
          await deleteApp(creatorApp).catch(() => {})
        }
        saving.value = false
      }
    }

    onMounted(loadAdmins)

    return {
      loading,
      saving,
      error,
      search,
      filteredAdmins,
      statusClass,
      loadAdmins,
      showAddModal,
      openAddModal,
      closeAddModal,
      newAdmin,
      formErrors,
      createAdmin,
    }
  },
}
</script>
