<template>
  <main class="flex min-h-screen items-center justify-center bg-[#21150f] px-6 text-[#fff8ef]">
    <section class="w-full max-w-lg rounded-3xl border border-[#8d5a3b] bg-[#302016] p-8 text-center shadow-2xl">
      <h1 class="text-3xl font-semibold">{{ loading ? 'Activating account' : success ? 'Account activated' : 'Activation unavailable' }}</h1>
      <p class="mt-4 text-[#e6cdb4]">{{ message }}</p>
      <button v-if="success" type="button" class="mt-8 rounded-xl bg-[#8d5a3b] px-5 py-3 font-semibold text-white hover:bg-[#6f4329]" @click="router.push('/login')">Go to Login</button>
      <button v-else-if="!loading" type="button" class="mt-8 rounded-xl border border-[#c99563] px-5 py-3 font-semibold text-[#f7dfc6] hover:bg-[#4a2d20]" @click="router.push('/login')">Return to Login</button>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const success = ref(false)
const message = ref('Please wait while we activate your account.')

onMounted(async () => {
  const token = String(route.query.token || '').trim()
  if (!token) {
    loading.value = false
    message.value = 'This activation link is missing its token.'
    return
  }
  try {
    const response = await fetch(`${OTP_API_BASE}/auth/activate-account`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'This activation link is invalid or expired.')
    success.value = true
    message.value = 'Your account is active. You can now sign in.'
  } catch (error) {
    message.value = error?.message || 'This activation link is invalid or expired.'
  } finally {
    loading.value = false
  }
})
</script>
