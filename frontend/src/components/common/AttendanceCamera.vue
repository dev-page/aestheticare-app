<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
const props = defineProps({
  disabled: { type: Boolean, default: false },
  disabledReason: { type: String, default: 'Attendance is unavailable without a scheduled shift.' },
})
const emit = defineEmits(['capture'])
const video = ref(null), open = ref(false), error = ref(''), busy = ref(false), cameraReady = ref(false)
let stream
function close() {
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  open.value = false
  cameraReady.value = false
}
function markCameraReady() {
  cameraReady.value = Boolean(video.value?.videoWidth)
}
async function start() {
  if (props.disabled) return
  error.value = ''
  cameraReady.value = false
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture requires a supported browser and HTTPS.')
    open.value = true
    await nextTick()
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false })
    video.value.srcObject = stream
    await video.value.play()
    cameraReady.value = video.value.videoWidth > 0
  } catch (e) { close(); error.value = e.message || 'Allow camera access and try again.' }
}
async function capture() {
  if (props.disabled || !video.value?.videoWidth) return
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
    <button
      type="button"
      class="attendance-camera-action attendance-camera-secondary rounded-lg px-3 py-2 text-sm"
      :disabled="disabled"
      :title="disabled ? disabledReason : undefined"
      @click="start"
    >Take attendance photo</button>
    <p v-if="error" role="alert" class="attendance-camera-error mt-2 text-sm">{{ error }}</p>
    <div v-if="open" role="dialog" aria-modal="true" aria-label="Attendance photo" class="attendance-camera-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" @keydown.esc="close">
      <div class="attendance-camera-panel w-full max-w-lg rounded-2xl p-4 sm:p-5">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">Take attendance photo</h2>
          <p class="mt-1 text-sm">Center your face in the preview, then capture a current photo.</p>
        </div>
        <div class="attendance-camera-preview">
          <video ref="video" autoplay muted playsinline class="attendance-camera-video" @loadeddata="markCameraReady" />
          <div v-if="!cameraReady" class="attendance-camera-placeholder">
            <span class="attendance-camera-placeholder-icon" aria-hidden="true">◉</span>
            <span>Starting camera preview…</span>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-3">
          <button @click="close" type="button" class="attendance-camera-action attendance-camera-secondary">Cancel</button>
          <button @click="capture" :disabled="disabled || busy || !cameraReady" type="button" class="attendance-camera-action attendance-camera-primary">{{ busy ? 'Capturing…' : cameraReady ? 'Capture photo' : 'Starting camera…' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-camera-backdrop {
  background: rgba(52, 36, 25, .24);
  backdrop-filter: blur(4px);
}

:global(html[data-ac-theme="dark"]) .attendance-camera-backdrop {
  background: rgba(0, 0, 0, .72);
}

.attendance-camera-panel {
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  color: var(--ac-text);
  box-shadow: var(--ac-shadow-lg);
}

.attendance-camera-panel h2 { color: var(--ac-text); }
.attendance-camera-panel p { color: var(--ac-text-muted); }

.attendance-camera-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  max-height: min(60vh, 480px);
  background: var(--ac-surface-muted);
  border: 1px solid var(--ac-border);
  border-radius: .85rem;
  overflow: hidden;
}

.attendance-camera-video {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 220px;
  background: var(--ac-surface-muted);
  object-fit: cover;
}

.attendance-camera-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .65rem;
  background: var(--ac-surface-muted);
  color: var(--ac-text-muted);
  font-size: .9rem;
}

.attendance-camera-placeholder-icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--ac-border-strong);
  border-radius: 50%;
  color: var(--ac-accent);
  font-size: 1.4rem;
}

.attendance-camera-action {
  min-height: 42px;
  padding: .65rem 1rem;
  border: 1px solid var(--ac-border-strong);
  border-radius: .7rem;
  font-weight: 600;
  transition: background-color .15s ease, border-color .15s ease;
}

.attendance-camera-secondary {
  background: var(--ac-surface);
  color: var(--ac-text-secondary);
}

.attendance-camera-secondary:hover { background: var(--ac-surface-muted); }
.attendance-camera-action:disabled { cursor: not-allowed; opacity: .55; }

.attendance-camera-primary {
  border-color: var(--ac-primary);
  background: var(--ac-primary);
  color: var(--ac-on-primary);
}

.attendance-camera-primary:hover:not(:disabled) { background: var(--ac-primary-hover); }
.attendance-camera-primary:disabled { cursor: not-allowed; opacity: .65; }
.attendance-camera-error { color: var(--ac-danger); }
</style>
