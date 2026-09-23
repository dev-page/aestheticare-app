<template>
  <Teleport to="body">
    <div v-if="isOpen" class="onboarding-tour-layer pointer-events-none fixed inset-0 z-[10000]" aria-live="polite">
      <div
        v-if="highlightStyle"
        class="pointer-events-none absolute rounded-xl border-2 border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.25),0_0_24px_rgba(252,211,77,0.75)] transition-all duration-300"
        :style="highlightStyle"
      ></div>

      <section
        :class="['onboarding-tooltip', { 'onboarding-tooltip-module': panelKey && panelKey !== 'customer' }]"
        :data-placement="tooltipPlacement"
        ref="tooltipElement"
        :style="tooltipStyle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div class="onboarding-tooltip-accent"></div>
        <div class="onboarding-tooltip-content">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span class="onboarding-guide-icon" aria-hidden="true">?</span>
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Quick guide</p>
                <h2 id="onboarding-title" class="mt-1 text-xl font-semibold tracking-tight">{{ tour?.title }}</h2>
              </div>
            </div>
            <button type="button" class="rounded-full p-2 text-[#8b6a4d] transition hover:bg-amber-100 hover:text-[#2a170d]" aria-label="Close tutorial" @click="close">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>

          <div class="onboarding-step-card">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6a3a]">Step {{ stepIndex + 1 }} of {{ tour?.steps?.length }}</p>
            <h3 class="mt-3 text-xl font-semibold">{{ step?.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#674b37]">{{ step?.text }}</p>
          </div>

          <label class="onboarding-preference">
            <input :checked="dontShowAgain" type="checkbox" class="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" @change="emit('update:dontShowAgain', $event.target.checked)" />
            <span>Don't show this tutorial again</span>
          </label>

          <div class="onboarding-actions">
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
  panelKey: { type: String, default: '' },
})

const emit = defineEmits(['close', 'next', 'previous', 'update:dontShowAgain'])
const targetRect = ref(null)
const tooltipElement = ref(null)
const tooltipPosition = ref(null)
const tooltipPlacement = ref('center')
let targetObserver = null

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

const observeTarget = () => {
  if (!targetObserver) return
  targetObserver.disconnect()
  const selector = String(props.step?.selector || '').trim()
  const element = selector ? document.querySelector(selector) : null
  if (!element) return
  targetObserver.observe(element)
  const sidebar = element.closest('aside')
  if (sidebar) targetObserver.observe(sidebar)
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

  // A sidebar consumes most of a phone-sized viewport. A floating card has no
  // reliable place to go there, so use a deliberate bottom-sheet layout.
  if (window.innerWidth <= 767) {
    tooltipPlacement.value = 'bottom-sheet'
    tooltipPosition.value = {
      right: `${margin}px`,
      bottom: `${margin}px`,
      left: `${margin}px`,
      width: `calc(100vw - ${margin * 2}px)`,
      maxHeight: 'calc(100vh - 1.5rem)',
    }
    return
  }

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
  tooltipPlacement.value = canPlaceRight ? 'right' : 'below'
}

const syncTarget = async () => {
  await nextTick()
  updateTarget()
  observeTarget()
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
  if (typeof ResizeObserver !== 'undefined') {
    targetObserver = new ResizeObserver(() => {
      updateTarget()
      updateTooltipPosition()
    })
  }
  syncTarget()
  window.addEventListener('resize', syncTarget)
  window.addEventListener('scroll', syncTarget, true)
})

onBeforeUnmount(() => {
  targetObserver?.disconnect()
  window.removeEventListener('resize', syncTarget)
  window.removeEventListener('scroll', syncTarget, true)
})
</script>

<style scoped>
.onboarding-tooltip {
  position: fixed;
  z-index: 1;
  pointer-events: auto;
  width: min(92vw, 21rem);
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(245, 214, 187, .7);
  background: linear-gradient(135deg, #fffaf2, #fff, #f8e7cf);
  color: #2a170d;
  box-shadow: 0 18px 48px rgba(20, 10, 4, .28);
}

.onboarding-tooltip::after {
  position: absolute;
  top: 2.25rem;
  left: -7px;
  width: 13px;
  height: 13px;
  content: '';
  transform: rotate(45deg);
  border-bottom: 1px solid rgba(245, 214, 187, .7);
  border-left: 1px solid rgba(245, 214, 187, .7);
  background: #fffaf2;
}

.onboarding-tooltip[data-placement='below']::after {
  top: -7px;
  left: 2rem;
  transform: rotate(225deg);
}

.onboarding-tooltip-accent { height: .32rem; background: linear-gradient(90deg, #d89246, #e9b377 55%, #f4d3a7); }
.onboarding-tooltip-content { padding: 1.2rem 1.25rem 1.15rem; }.onboarding-guide-icon { display: grid; width: 2.15rem; height: 2.15rem; flex: none; place-items: center; border-radius: .7rem; background: #f7e3c9; color: #8a542f; font-family: Georgia, serif; font-size: 1.1rem; font-weight: 700; }.onboarding-step-card { margin-top: 1.15rem; border: 1px solid rgba(226, 188, 142, .8); border-radius: .85rem; background: rgba(255, 255, 255, .65); padding: .9rem; }.onboarding-preference { display: flex; align-items: flex-start; gap: .65rem; margin-top: 1rem; color: #674b37; font-size: .78rem; }.onboarding-actions { display: flex; align-items: center; justify-content: space-between; gap: .65rem; margin-top: 1.1rem; }

.onboarding-tooltip-module {
  border-color: rgba(141, 90, 59, .7);
  background: linear-gradient(135deg, #2a1a14, #1b1411 68%, #302016);
  color: #f8eee5;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .5);
}

.onboarding-tooltip-module::after { border-color: rgba(141, 90, 59, .7); background: #2a1a14; }
.onboarding-tooltip-module .onboarding-tooltip-accent { background: linear-gradient(90deg, #a66a2c, #c58b5e, #8d5a3b); }
.onboarding-tooltip-module .onboarding-guide-icon { background: rgba(141, 90, 59, .3); color: #f0cfb0; }
.onboarding-tooltip-module .onboarding-step-card { border-color: rgba(141, 90, 59, .6); background: rgba(15, 20, 24, .58); }

.onboarding-tooltip-module > div:first-child {
  background: linear-gradient(90deg, #a66a2c, #c58b5e, #8d5a3b);
}

.onboarding-tooltip-module .text-\[\#8b6a4d\],
.onboarding-tooltip-module .text-\[\#674b37\],
.onboarding-tooltip-module .text-\[\#2a170d\] {
  color: #d8c0ad;
}

.onboarding-tooltip-module .text-amber-700 { color: #d8a77e; }
.onboarding-tooltip-module .bg-white\/65 { border-color: rgba(141, 90, 59, .6); background: rgba(15, 20, 24, .58); }
.onboarding-tooltip-module .hover\:bg-amber-100:hover { background: rgba(141, 90, 59, .25); }
.onboarding-tooltip-module .bg-\[\#2a170d\] { background: #8d5a3b; }
.onboarding-tooltip-module .hover\:bg-\[\#4a2818\]:hover { background: #a66a2c; }
.onboarding-tooltip-module .bg-amber-200 { background: #8d5a3b; }
.onboarding-tooltip-module input[type='checkbox'] { accent-color: #c58b5e; }

@media (max-width: 360px) {
  .onboarding-tooltip { width: calc(100vw - 24px); }
  .onboarding-tooltip-content { padding: 1rem; }
}

@media (max-width: 767px) {
  .onboarding-tour-layer {
    background: rgba(31, 18, 11, .28);
    backdrop-filter: blur(1px);
  }

  .onboarding-tooltip[data-placement='bottom-sheet'] {
    border-radius: 1.2rem;
    box-shadow: 0 20px 52px rgba(35, 18, 8, .3);
  }

  .onboarding-tooltip[data-placement='bottom-sheet']::after {
    display: none;
  }
}
</style>
