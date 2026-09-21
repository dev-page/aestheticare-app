<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
const emit = defineEmits(['capture'])
const video = ref(null), open = ref(false), error = ref(''), busy = ref(false)
let stream
function close() {
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  open.value = false
}
async function start() {
  error.value = ''
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture requires a supported browser and HTTPS.')
    open.value = true
    await nextTick()
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false })
    video.value.srcObject = stream
    await video.value.play()
  } catch (e) { close(); error.value = e.message || 'Allow camera access and try again.' }
}
async function capture() {
  if (!video.value?.videoWidth) return
  busy.value = true
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.value.videoWidth
    canvas.height = video.value.videoHeight
    canvas.getContext('2d').drawImage(video.value, 0, 0)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Could not capture the photo. Try again.')
    emit('capture', new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }))
    close()
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
onBeforeUnmount(close)
</script>
<template>
  <div class="mt-4">
    <button type="button" class="rounded-lg border border-slate-600 px-3 py-2 text-sm text-white" @click="start">Take attendance photo</button>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-400">{{ error }}</p>
    <div v-if="open" role="dialog" aria-modal="true" aria-label="Attendance photo" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" @keydown.esc="close">
      <div class="w-full max-w-lg rounded-xl bg-slate-900 p-4">
        <video ref="video" autoplay muted playsinline class="w-full rounded-lg" />
        <div class="mt-4 flex justify-between"><button @click="close" type="button" class="text-white">Cancel</button><button @click="capture" :disabled="busy" type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-white">Capture photo</button></div>
      </div>
    </div>
  </div>
</template>
