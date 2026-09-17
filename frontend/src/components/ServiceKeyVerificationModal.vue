<template>
  <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" @click.self="close">
    <form class="w-full max-w-md rounded-2xl border border-[#d9be9b] bg-[#fffaf3] p-6 shadow-2xl" @submit.prevent="submit">
      <h3 class="text-xl font-semibold text-[#3d281d]">Verify service key</h3>
      <p class="mt-2 text-sm leading-6 text-[#6f4a2d]">{{ description }}</p>
      <label class="mt-5 block text-sm font-semibold text-[#5d3b27]" for="service-key-input">Service key</label>
      <input id="service-key-input" ref="input" v-model.trim="serviceKey" autocomplete="one-time-code" inputmode="numeric" maxlength="6" required class="mt-2 w-full rounded-xl border border-[#d9be9b] bg-white px-4 py-3 text-[#3d281d] outline-none focus:border-[#a46b45] focus:ring-4 focus:ring-[#e8bf8a]/20" placeholder="Enter the 6-digit key" />
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#6f4a2d] hover:bg-[#f6eadb]" :disabled="loading" @click="close">Cancel</button>
        <button type="submit" class="rounded-xl bg-[#8d5a3b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#75462e] disabled:opacity-60" :disabled="loading">{{ loading ? 'Verifying…' : 'Verify key' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  description: { type: String, default: 'Enter the service key shared for this appointment.' },
})
const emit = defineEmits(['close', 'submit'])
const serviceKey = ref('')
const input = ref(null)
const error = ref('')

watch(() => props.visible, async (visible) => {
  if (!visible) return
  serviceKey.value = ''
  error.value = ''
  await nextTick()
  input.value?.focus()
})

const close = () => {
  if (!props.loading) emit('close')
}

const submit = () => {
  if (!serviceKey.value) {
    error.value = 'Enter the service key.'
    return
  }
  emit('submit', serviceKey.value)
}
</script>
