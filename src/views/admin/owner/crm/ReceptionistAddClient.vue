<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Walk-In</h1>
        <p class="text-slate-400">Register a walk-in client for your branch.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-3xl">
        <form class="space-y-6" @submit.prevent="submitClient">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 text-sm mb-2">First Name</label>
              <input
                v-model="form.firstName"
                type="text"
                class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none"
                :class="fieldErrors.firstName ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-purple-500'"
                @input="validateField('firstName')"
              />
              <p v-if="fieldErrors.firstName" class="mt-1 text-xs text-red-400">{{ fieldErrors.firstName }}</p>
            </div>
            <div>
              <label class="block text-slate-400 text-sm mb-2">Last Name</label>
              <input
                v-model="form.lastName"
                type="text"
                class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none"
                :class="fieldErrors.lastName ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-purple-500'"
                @input="validateField('lastName')"
              />
              <p v-if="fieldErrors.lastName" class="mt-1 text-xs text-red-400">{{ fieldErrors.lastName }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 text-sm mb-2">Email</label>
              <input
                v-model="form.email"
                type="email"
                class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none"
                :class="fieldErrors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-purple-500'"
                @input="validateField('email')"
              />
              <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-400">{{ fieldErrors.email }}</p>
            </div>
            <div>
              <label class="block text-slate-400 text-sm mb-2">Phone</label>
              <div class="flex">
                <span class="inline-flex items-center px-3 rounded-l-lg bg-slate-700 text-slate-300 border border-r-0 border-slate-600">+63</span>
                <input
                  v-model="form.phone"
                  type="text"
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-r-lg border focus:outline-none"
                  :class="fieldErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-purple-500'"
                  @input="validateField('phone')"
                />
              </div>
              <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-400">{{ fieldErrors.phone }}</p>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Address</label>
            <textarea
              v-model="form.address"
              rows="3"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border focus:outline-none"
              :class="fieldErrors.address ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-purple-500'"
              @input="validateField('address')"
            ></textarea>
            <p v-if="fieldErrors.address" class="mt-1 text-xs text-red-400">{{ fieldErrors.address }}</p>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              :disabled="isSubmitting"
              class="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white text-sm"
            >
              {{ isSubmitting ? 'Saving...' : 'Save Client' }}
            </button>
            <router-link
              to="/receptionist/clients"
              class="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm"
            >
              Cancel
            </router-link>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ReceptionistAddClient',
  components: { OwnerSidebar },
  setup() {
    const router = useRouter()
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const isSubmitting = ref(false)

    const form = ref({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: ''
    })
    const fieldErrors = ref({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: ''
    })

    const nameRegex = /^[A-Za-z\s]+$/
    const emailRegex = /^[A-Za-z0-9._]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

    const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)

    const validateField = (field) => {
      const value = String(form.value[field] || '').trim()

      if (field === 'firstName') {
        if (!value) fieldErrors.value.firstName = 'First name is required.'
        else if (!nameRegex.test(value)) fieldErrors.value.firstName = 'First name must contain letters only.'
        else fieldErrors.value.firstName = ''
      }

      if (field === 'lastName') {
        if (!value) fieldErrors.value.lastName = 'Last name is required.'
        else if (!nameRegex.test(value)) fieldErrors.value.lastName = 'Last name must contain letters only.'
        else fieldErrors.value.lastName = ''
      }

      if (field === 'email') {
        if (value && !emailRegex.test(value)) fieldErrors.value.email = 'Enter a valid email address.'
        else fieldErrors.value.email = ''
      }

      if (field === 'phone') {
        form.value.phone = normalizePhone(form.value.phone)
        if (!form.value.phone) fieldErrors.value.phone = 'Phone number is required.'
        else if (form.value.phone.length !== 10) fieldErrors.value.phone = 'Enter a 10-digit phone number.'
        else fieldErrors.value.phone = ''
      }

      if (field === 'address') {
        fieldErrors.value.address = ''
      }
    }

    const validateForm = () => {
      validateField('firstName')
      validateField('lastName')
      validateField('email')
      validateField('phone')
      validateField('address')
      return !Object.values(fieldErrors.value).some((error) => error)
    }

    const submitClient = async () => {
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('Your account is not ready for client creation.')
        return
      }
      if (!validateForm()) {
        toast.error('Please fix the highlighted fields.')
        return
      }

      isSubmitting.value = true
      try {
        const fullName = `${form.value.firstName} ${form.value.lastName}`.trim()
        await addDoc(collection(db, 'clients'), {
          firstName: form.value.firstName.trim(),
          lastName: form.value.lastName.trim(),
          fullName,
          email: form.value.email.trim(),
          phone: `+63${form.value.phone}`,
          address: form.value.address.trim(),
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
          status: 'Active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        await logActivity(db, {
          actorId: currentUserId.value,
          action: 'Added a client',
          details: `Created client record: ${fullName}`,
          module: 'Receptionist'
        })

        toast.success('Client added successfully.')
        router.push('/receptionist/clients')
      } catch (error) {
        console.error(error)
        toast.error('Failed to save client.')
      } finally {
        isSubmitting.value = false
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
      })
    })

    return {
      form,
      isSubmitting,
      submitClient,
      fieldErrors,
      validateField
    }
  }
}
</script>
