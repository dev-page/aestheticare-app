<template>
  <Teleport to="body">
    <div v-if="isOpen" class="onboarding-tour-layer pointer-events-none fixed inset-0 z-[10000]" aria-live="polite">
      <div
        v-if="highlightStyle"
        class="onboarding-spotlight pointer-events-none absolute rounded-xl border-2 border-amber-300"
        :style="highlightStyle"
        aria-hidden="true"
      ></div>

      <section
        :class="[
          'onboarding-tooltip',
          { 'onboarding-tooltip-module': panelKey && panelKey !== 'customer' },
          { 'onboarding-tooltip-supplier': panelKey === 'supplier' },
        ]"
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
const tooltipPosition = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
const tooltipPlacement = ref('center')
const positionReady = ref(false)

const TARGET_PADDING = 3
const TOOLTIP_GAP = 16
const VIEWPORT_MARGIN = 12
const TOOLTIP_MAX_WIDTH = 336
let targetElement = null
let targetObserver = null
let layoutObserver = null
let mutationObserver = null
let refreshFrame = 0
let syncSequence = 0
let placementSequence = 0

const close = () => emit('close')
const next = () => emit('next')
const previous = () => emit('previous')

const highlightStyle = computed(() => {
  if (!targetRect.value) return null
  const rect = targetRect.value
  return {
    top: `${rect.top - TARGET_PADDING}px`,
    left: `${rect.left - TARGET_PADDING}px`,
    width: `${rect.width + TARGET_PADDING * 2}px`,
    height: `${rect.height + TARGET_PADDING * 2}px`,
  }
})

const tooltipStyle = computed(() => ({ ...tooltipPosition.value, visibility: positionReady.value ? 'visible' : 'hidden' }))

const readTargetRect = () => {
  if (!targetElement?.isConnected) return false
  const rect = targetElement.getBoundingClientRect()
  targetRect.value = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
  return true
}

const targetIsInViewport = (rect) => {
  const oversized = rect.height > window.innerHeight - (VIEWPORT_MARGIN + TARGET_PADDING) * 2 ||
    rect.width > window.innerWidth - (VIEWPORT_MARGIN + TARGET_PADDING) * 2
  const intersectsViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
  if (oversized) return intersectsViewport

  return rect.top >= VIEWPORT_MARGIN + TARGET_PADDING &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight - VIEWPORT_MARGIN - TARGET_PADDING &&
    rect.right <= window.innerWidth
}

const waitForScrollSettle = () => new Promise((resolve) => {
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    window.removeEventListener('scrollend', finish)
    resolve()
  }
  const timeout = window.setTimeout(finish, 550)
  window.addEventListener('scrollend', finish, { once: true })
})

const ensureTargetVisible = async (element) => {
  const rect = element.getBoundingClientRect()
  if (targetIsInViewport(rect)) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
  if (!reduceMotion) await waitForScrollSettle()
  await nextTick()
}

const findTarget = async (selector, sequence) => {
  if (!selector) return null
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (sequence !== syncSequence || !props.isOpen) return null
    const element = document.querySelector(selector)
    if (element) return element
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  return null
}

const observeTarget = () => {
  targetObserver?.disconnect()
  if (!targetObserver || !targetElement) return
  const ancestors = [targetElement, targetElement.parentElement, targetElement.closest('main, aside')].filter(Boolean)
  for (const element of new Set(ancestors)) targetObserver.observe(element)
}

const collisionFreeRect = (direction, target, width, height, available) => {
  const centeredLeft = target.left + (target.width - width) / 2
  const centeredTop = target.top + (target.height - height) / 2
  let left = centeredLeft
  let top = centeredTop

  if (direction === 'right') left = target.right + TARGET_PADDING + TOOLTIP_GAP
  if (direction === 'left') left = target.left - TARGET_PADDING - TOOLTIP_GAP - width
  if (direction === 'below') top = target.bottom + TARGET_PADDING + TOOLTIP_GAP
  if (direction === 'above') top = target.top - TARGET_PADDING - TOOLTIP_GAP - height

  if (direction === 'right' || direction === 'left') {
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - VIEWPORT_MARGIN - height))
  } else {
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - VIEWPORT_MARGIN - width))
  }

  const box = { left, top, right: left + width, bottom: top + height }
  const overlapsTarget = box.left < target.right + TOOLTIP_GAP &&
    box.right > target.left - TOOLTIP_GAP &&
    box.top < target.bottom + TOOLTIP_GAP &&
    box.bottom > target.top - TOOLTIP_GAP
  const insideViewport = left >= VIEWPORT_MARGIN && top >= VIEWPORT_MARGIN &&
    box.right <= window.innerWidth - VIEWPORT_MARGIN && box.bottom <= window.innerHeight - VIEWPORT_MARGIN
  return { ...box, overlapsTarget, insideViewport, available }
}

const getPlacementCandidates = (target) => {
  const width = window.innerWidth
  const height = window.innerHeight
  const targetLeft = target.left - TARGET_PADDING
  const targetRight = target.right + TARGET_PADDING
  const targetTop = target.top - TARGET_PADDING
  const targetBottom = target.bottom + TARGET_PADDING
  const verticalRoom = height - VIEWPORT_MARGIN * 2
  const horizontalRoom = width - VIEWPORT_MARGIN * 2

  return [
    { direction: 'right', width: width - VIEWPORT_MARGIN - targetRight - TOOLTIP_GAP, height: verticalRoom, priority: 4 },
    { direction: 'left', width: targetLeft - TOOLTIP_GAP - VIEWPORT_MARGIN, height: verticalRoom, priority: 3 },
    { direction: 'below', width: horizontalRoom, height: height - VIEWPORT_MARGIN - targetBottom - TOOLTIP_GAP, priority: 2 },
    { direction: 'above', width: horizontalRoom, height: targetTop - TOOLTIP_GAP - VIEWPORT_MARGIN, priority: 1 },
  ].map((candidate) => ({ ...candidate, width: Math.max(0, candidate.width), height: Math.max(0, candidate.height) }))
}

const updateTooltipPosition = async () => {
  if (!targetRect.value || !tooltipElement.value) return
  const sequence = ++placementSequence
  const target = targetRect.value
  const naturalWidth = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const naturalHeight = tooltipElement.value.getBoundingClientRect().height || 360
  const candidates = getPlacementCandidates(target)
    .filter((candidate) => candidate.width >= 180 && candidate.height >= 150)
    .map((candidate) => {
      const width = Math.min(naturalWidth, candidate.width)
      const estimatedHeight = Math.min(candidate.height, naturalHeight * (naturalWidth / width))
      const box = collisionFreeRect(candidate.direction, target, width, estimatedHeight, candidate)
      const fits = candidate.width >= naturalWidth && candidate.height >= naturalHeight
      const capacity = Math.min(1, candidate.width / naturalWidth) * Math.min(1, candidate.height / naturalHeight)
      return { ...candidate, width, estimatedHeight, box, score: (fits ? 1000 : 0) + capacity * 100 + candidate.priority }
    })
    .filter((candidate) => !candidate.box.overlapsTarget && candidate.box.insideViewport)
    .sort((a, b) => b.score - a.score)

  const placement = candidates[0]
  if (!placement) {
    // A target can fill most of a small viewport. Keep the tooltip in the
    // largest free region and constrain its contents rather than covering it.
    const fallback = getPlacementCandidates(target)
      .filter((candidate) => candidate.width > 0 && candidate.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0]
    if (!fallback) return
    const width = Math.min(naturalWidth, fallback.width)
    const height = Math.min(naturalHeight, fallback.height)
    const box = collisionFreeRect(fallback.direction, target, width, height, fallback)
    tooltipPlacement.value = fallback.direction
    tooltipPosition.value = { top: `${box.top}px`, left: `${box.left}px`, width: `${width}px`, maxHeight: `${fallback.height}px` }
    return
  }

  tooltipPlacement.value = placement.direction
  tooltipPosition.value = {
    top: `${VIEWPORT_MARGIN}px`,
    left: `${VIEWPORT_MARGIN}px`,
    width: `${placement.width}px`,
    maxHeight: `${placement.height}px`,
  }
  await nextTick()
  if (sequence !== placementSequence) return

  const actual = tooltipElement.value.getBoundingClientRect()
  const box = collisionFreeRect(placement.direction, target, actual.width, actual.height, placement)
  tooltipPosition.value = {
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${placement.width}px`,
    maxHeight: `${placement.height}px`,
  }
}

const syncTarget = async () => {
  const sequence = ++syncSequence
  placementSequence += 1
  positionReady.value = false
  await nextTick()
  if (!props.isOpen) {
    targetElement = null
    targetRect.value = null
    return
  }

  const selector = String(props.step?.selector || '').trim()
  targetElement = await findTarget(selector, sequence)
  if (sequence !== syncSequence) return

  if (!targetElement) {
    targetRect.value = null
    tooltipPlacement.value = 'center'
    tooltipPosition.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: `min(92vw, ${TOOLTIP_MAX_WIDTH}px)`, maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)` }
    positionReady.value = true
    return
  }

  await ensureTargetVisible(targetElement)
  if (sequence !== syncSequence || !readTargetRect()) return
  observeTarget()
  tooltipPosition.value = { top: `${VIEWPORT_MARGIN}px`, left: `${VIEWPORT_MARGIN}px`, width: `min(92vw, ${TOOLTIP_MAX_WIDTH}px)`, maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)` }
  await nextTick()
  await updateTooltipPosition()
  if (sequence === syncSequence) positionReady.value = true
}

const refreshPosition = () => {
  if (refreshFrame) return
  refreshFrame = window.requestAnimationFrame(() => {
    refreshFrame = 0
    if (!props.isOpen) return
    if (!targetElement?.isConnected) {
      syncTarget()
      return
    }
    readTargetRect()
    updateTooltipPosition()
  })
}

const handleResize = () => syncTarget()

watch(() => [props.isOpen, props.stepIndex, props.step?.selector], syncTarget, { immediate: true })

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    targetObserver = new ResizeObserver(refreshPosition)
    layoutObserver = new ResizeObserver(refreshPosition)
    layoutObserver.observe(document.documentElement)
    layoutObserver.observe(document.body)
  }
  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver(() => {
      if (targetElement && !targetElement.isConnected) {
        targetElement = null
        targetRect.value = null
        syncTarget()
      }
      else if (targetElement) refreshPosition()
      else {
        const selector = String(props.step?.selector || '').trim()
        if (props.isOpen && selector && document.querySelector(selector)) syncTarget()
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })
  }
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', refreshPosition, true)
  document.fonts?.ready?.then(refreshPosition)
  syncTarget()
})

onBeforeUnmount(() => {
  syncSequence += 1
  targetObserver?.disconnect()
  layoutObserver?.disconnect()
  mutationObserver?.disconnect()
  if (refreshFrame) window.cancelAnimationFrame(refreshFrame)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', refreshPosition, true)
})
</script>

<style scoped>
.onboarding-spotlight {
  z-index: 1;
  box-sizing: border-box;
  box-shadow: 0 0 0 9999px rgba(16, 10, 7, .68), 0 0 0 3px rgba(252, 211, 77, .25), 0 0 24px rgba(252, 211, 77, .75);
  transition: top .18s ease, left .18s ease, width .18s ease, height .18s ease;
}

.onboarding-tooltip {
  position: fixed;
  z-index: 2;
  pointer-events: auto;
  width: min(92vw, 21rem);
  max-width: calc(100vw - 24px);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
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

.onboarding-tooltip[data-placement='left']::after {
  right: -7px;
  left: auto;
  transform: rotate(225deg);
}

.onboarding-tooltip[data-placement='above']::after {
  top: auto;
  bottom: -7px;
  left: 2rem;
  transform: rotate(45deg);
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

.onboarding-tooltip-supplier {
  border-color: #4a3322;
  border-radius: 1.1rem;
  background: linear-gradient(160deg, #24180f, #1a130d 72%, #2f2015);
  color: #f2e2d2;
  box-shadow: 0 18px 48px rgba(11, 6, 4, .42);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.onboarding-tooltip-supplier::after {
  border-color: #4a3322;
  background: #24180f;
}

.onboarding-tooltip-supplier .onboarding-tooltip-accent,
.onboarding-tooltip-supplier > div:first-child {
  background: linear-gradient(90deg, #8d5a3b, #b4875d 55%, #d6a878);
}

.onboarding-tooltip-supplier .onboarding-guide-icon {
  border: 1px solid #4a3322;
  background: #2f2015;
  color: #d6a878;
}

.onboarding-tooltip-supplier .onboarding-step-card {
  border-color: #4a3322;
  border-radius: 1rem;
  background: rgba(26, 19, 13, .88);
}

.onboarding-tooltip-supplier .onboarding-step-card > p:first-child {
  color: #d6a878 !important;
}

.onboarding-tooltip-supplier .onboarding-step-card h3 {
  color: #f2e2d2;
  font-weight: 700;
}

.onboarding-tooltip-supplier .onboarding-step-card > p:last-child,
.onboarding-tooltip-supplier .onboarding-preference,
.onboarding-tooltip-supplier .text-\[\#8b6a4d\],
.onboarding-tooltip-supplier .text-\[\#674b37\] {
  color: #c8af97 !important;
}

.onboarding-tooltip-supplier .text-amber-700 {
  color: #d6a878 !important;
}

.onboarding-tooltip-supplier .onboarding-preference input[type='checkbox'] {
  border-color: #6a4c33;
  accent-color: #b4875d;
}

.onboarding-tooltip-supplier .onboarding-actions > button:first-child {
  border: 1px solid transparent;
  color: #c8af97 !important;
}

.onboarding-tooltip-supplier .onboarding-actions > button:first-child:hover:not(:disabled),
.onboarding-tooltip-supplier .onboarding-actions > button:first-child:focus-visible,
.onboarding-tooltip-supplier .onboarding-tooltip-content > div:first-child button:hover {
  background: #2f2015;
  color: #f2e2d2 !important;
}

.onboarding-tooltip-supplier .onboarding-actions > button:last-child {
  border: 1px solid #b4875d;
  border-radius: .75rem;
  background: #b4875d !important;
  color: #1a130d !important;
  font-weight: 700;
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.onboarding-tooltip-supplier .onboarding-actions > button:last-child:hover {
  transform: translateY(-1px);
  border-color: #c39770;
  background: #c39770 !important;
}

.onboarding-tooltip-supplier button:focus-visible {
  outline: 2px solid #d6a878;
  outline-offset: 3px;
}

.onboarding-tooltip-supplier .onboarding-actions > div[aria-hidden='true'] span {
  background: #4a3322;
}

.onboarding-tooltip-supplier .onboarding-actions > div[aria-hidden='true'] span.w-6 {
  background: #b4875d;
}

@media (max-width: 360px) {
  .onboarding-tooltip { width: calc(100vw - 24px); }
  .onboarding-tooltip-content { padding: 1rem; }
}

@media (max-width: 767px) {
  .onboarding-tooltip { border-radius: 1.2rem; }
}

@media (max-width: 767px) {
  .onboarding-tooltip-supplier { border-radius: 1.1rem; }
  .onboarding-tooltip-supplier .onboarding-step-card { margin-top: 1rem; padding: .85rem; }
  .onboarding-tooltip-supplier .onboarding-actions { gap: .5rem; margin-top: 1rem; }
}

@media (max-width: 360px) {
  .onboarding-tooltip-supplier .onboarding-tooltip-content { padding: .9rem; }
  .onboarding-tooltip-supplier .onboarding-guide-icon { width: 1.9rem; height: 1.9rem; }
  .onboarding-tooltip-supplier .onboarding-actions button { padding-left: .65rem; padding-right: .65rem; }
}
</style>