<template>
  <Teleport to="body">
    <div v-if="isOpen" class="pointer-events-none fixed inset-0 z-[10000]" aria-live="polite">
      <div
        v-if="highlightStyle"
        class="pointer-events-none absolute rounded-xl border-2 border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.25),0_0_24px_rgba(252,211,77,0.75)] transition-all duration-300"
        :style="highlightStyle"
      ></div>

      <section
        class="pointer-events-auto fixed w-[min(92vw,23rem)] overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-[#fffaf2] via-white to-[#f8e7cf] text-[#2a170d] shadow-[0_18px_48px_rgba(20,10,4,0.28)] sm:w-[23rem]"
        ref="tooltipElement"
        :style="tooltipStyle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div class="h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-300"></div>
        <div class="p-6 sm:p-7">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Quick guide</p>
              <h2 id="onboarding-title" class="mt-2 text-2xl font-semibold tracking-tight">{{ tour?.title }}</h2>
            </div>
            <button type="button" class="rounded-full p-2 text-[#8b6a4d] transition hover:bg-amber-100 hover:text-[#2a170d]" aria-label="Close tutorial" @click="close">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>

          <div class="mt-7 rounded-2xl border border-amber-200/80 bg-white/65 p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6a3a]">Step {{ stepIndex + 1 }} of {{ tour?.steps?.length }}</p>
            <h3 class="mt-3 text-xl font-semibold">{{ step?.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#674b37]">{{ step?.text }}</p>
          </div>

          <label class="mt-5 flex cursor-pointer items-start gap-3 text-sm text-[#674b37]">
            <input :checked="dontShowAgain" type="checkbox" class="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" @change="emit('update:dontShowAgain', $event.target.checked)" />
            <span>Don't show this tutorial again</span>
          </label>

          <div class="mt-6 flex items-center justify-between gap-3">
            <button type="button" class="rounded-xl px-3 py-2 text-sm font-semibold text-[#8b6a4d] transition hover:bg-amber-100" :disabled="stepIndex === 0" @click="previous">Back</button>
            <div class="flex items-center gap-1.5" aria-hidden="true">
              <span v-for="(_, index) in (tour?.steps || [])" :key="index" class="h-1.5 rounded-full transition-all" :class="index === stepIndex ? 'w-6 bg-amber-600' : 'w-1.5 bg-amber-200'"></span>
            </div>
            <button type="button" class="rounded-xl bg-[#2a170d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4a2818]" @click="next">{{ isLastStep ? 'Finish' : 'Next' }}</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  tour: { type: Object, default: null },
  step: { type: Object, default: null },
  stepIndex: { type: Number, default: 0 },
  isLastStep: { type: Boolean, default: false },
  dontShowAgain: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'next', 'previous', 'update:dontShowAgain'])
const targetRect = ref(null)
const tooltipElement = ref(null)
const tooltipPosition = ref(null)

const close = () => emit('close')
const next = () => emit('next')
const previous = () => emit('previous')

const updateTarget = () => {
  const selector = String(props.step?.selector || '').trim()
  const element = selector ? document.querySelector(selector) : null
  if (!element) {
    targetRect.value = null
    return
  }
  const rect = element.getBoundingClientRect()
  targetRect.value = { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }
}

const highlightStyle = computed(() => {
  if (!targetRect.value) return null
  return { top: `${targetRect.value.top}px`, left: `${targetRect.value.left}px`, width: `${targetRect.value.width}px`, height: `${targetRect.value.height}px` }
})

const tooltipStyle = computed(() => {
  if (tooltipPosition.value) return tooltipPosition.value
  const rect = targetRect.value
  const cardWidth = Math.min(368, window.innerWidth - 24)
  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxHeight: 'calc(100vh - 2rem)',
    }
  }

  const gap = 14
  const preferredLeft = rect.left + rect.width + gap
  const left = preferredLeft + cardWidth <= window.innerWidth - 12
    ? preferredLeft
    : Math.max(12, rect.left)
  const preferredTop = preferredLeft + cardWidth <= window.innerWidth - 12
    ? rect.top
    : rect.top + rect.height + gap
  const top = Math.min(Math.max(12, preferredTop), Math.max(12, window.innerHeight - 300))

  return {
    top: `${top}px`,
    left: `${Math.min(left, Math.max(12, window.innerWidth - cardWidth - 12))}px`,
    maxHeight: 'calc(100vh - 1.5rem)',
  }
})

const updateTooltipPosition = () => {
  const rect = targetRect.value
  if (!rect || !tooltipElement.value) return

  const margin = 12
  const gap = 14
  const tooltipWidth = tooltipElement.value.offsetWidth || Math.min(368, window.innerWidth - 24)
  const tooltipHeight = tooltipElement.value.offsetHeight || 330
  const rightSpace = window.innerWidth - (rect.left + rect.width + gap)
  const canPlaceRight = rightSpace >= tooltipWidth + margin
  const maxLeft = Math.max(margin, window.innerWidth - tooltipWidth - margin)
  const left = canPlaceRight
    ? rect.left + rect.width + gap
    : Math.min(Math.max(margin, rect.left), maxLeft)
  const belowTop = rect.top + rect.height + gap
  const aboveTop = rect.top - tooltipHeight - gap
  const top = belowTop + tooltipHeight <= window.innerHeight - margin
    ? belowTop
    : Math.max(margin, aboveTop)
  const maxTop = Math.max(margin, window.innerHeight - tooltipHeight - margin)

  tooltipPosition.value = {
    top: `${Math.max(margin, Math.min(top, maxTop))}px`,
    left: `${Math.max(margin, left)}px`,
    maxHeight: `calc(100vh - ${margin * 2}px)`,
  }
}

const syncTarget = async () => {
  await nextTick()
  updateTarget()
  tooltipPosition.value = null
  await nextTick()
  updateTooltipPosition()
  // The next step can also navigate to a new customer page. Give the
  // sidebar time to remount before measuring its target item.
  window.setTimeout(() => { updateTarget(); updateTooltipPosition() }, 120)
  window.setTimeout(() => { updateTarget(); updateTooltipPosition() }, 350)
}

watch(() => [props.isOpen, props.stepIndex, props.step?.selector], syncTarget, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', syncTarget)
  window.addEventListener('scroll', syncTarget, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncTarget)
  window.removeEventListener('scroll', syncTarget, true)
})
</script>
