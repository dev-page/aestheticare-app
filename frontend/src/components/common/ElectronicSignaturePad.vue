<template>
  <div class="signature-pad-wrap">
    <div class="signature-pad-frame">
      <canvas
        ref="canvasElement"
        class="signature-pad"
        :aria-label="label"
        role="img"
        @pointerdown="startStroke"
        @pointermove="continueStroke"
        @pointerup="finishStroke"
        @pointercancel="finishStroke"
        @pointerleave="finishStroke"
      ></canvas>
      <span v-if="!hasSignature" class="signature-pad-placeholder">Sign here</span>
    </div>
    <div class="signature-pad-actions">
      <span class="signature-pad-hint">Use your finger, stylus, or mouse.</span>
      <button type="button" class="signature-pad-clear" :disabled="!hasSignature" @click="clearSignature">Clear</button>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: 'Electronic signature pad',
  },
})

const emit = defineEmits(['update:modelValue'])
const canvasElement = ref(null)
const hasSignature = ref(Boolean(props.modelValue))
let drawing = false
let lastPoint = null
let resizeObserver = null

const getContext = () => canvasElement.value?.getContext('2d') || null

const resizeCanvas = () => {
  const canvas = canvasElement.value
  if (!canvas) return
  const previousValue = props.modelValue
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.max(window.devicePixelRatio || 1, 1)
  canvas.width = Math.max(Math.round(rect.width * ratio), 1)
  canvas.height = Math.max(Math.round(rect.height * ratio), 1)
  const context = getContext()
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#2f1d14'
  context.lineWidth = 2.2
  if (previousValue) {
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height)
    image.src = previousValue
  }
}

const getPoint = (event) => {
  const rect = canvasElement.value.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

const startStroke = (event) => {
  if (!canvasElement.value) return
  event.preventDefault()
  canvasElement.value.setPointerCapture?.(event.pointerId)
  drawing = true
  lastPoint = getPoint(event)
}

const continueStroke = (event) => {
  if (!drawing) return
  event.preventDefault()
  const context = getContext()
  const point = getPoint(event)
  if (!context || !lastPoint) return
  context.beginPath()
  context.moveTo(lastPoint.x, lastPoint.y)
  context.lineTo(point.x, point.y)
  context.stroke()
  lastPoint = point
}

const finishStroke = () => {
  if (!drawing) return
  drawing = false
  lastPoint = null
  hasSignature.value = true
  emit('update:modelValue', canvasElement.value.toDataURL('image/png'))
}

const clearSignature = () => {
  const canvas = canvasElement.value
  const context = getContext()
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  hasSignature.value = false
  emit('update:modelValue', '')
}

onMounted(async () => {
  await nextTick()
  resizeCanvas()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resizeCanvas)
    if (canvasElement.value) resizeObserver.observe(canvasElement.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.modelValue, (value) => {
  hasSignature.value = Boolean(value)
})
</script>

<style scoped>
.signature-pad-wrap { width: 100%; }
.signature-pad-frame { position: relative; width: 100%; height: 9rem; overflow: hidden; border: 1px solid #e8c88e; border-radius: .75rem; background: #fff; }
.signature-pad { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.signature-pad-placeholder { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; color: #9b806c; font-size: .95rem; }
.signature-pad-actions { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-top: .5rem; }
.signature-pad-hint { color: #6f5a4a; font-size: .75rem; }
.signature-pad-clear { border: 1px solid #c69a61; border-radius: .5rem; padding: .35rem .7rem; color: #6f3f22; font-size: .8rem; font-weight: 600; }
.signature-pad-clear:disabled { cursor: not-allowed; opacity: .45; }
</style>
