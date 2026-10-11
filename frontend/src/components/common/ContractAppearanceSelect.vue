<template>
  <div ref="root" class="appearance-select">
    <label :id="`${id}-label`" :for="id">{{ label }}</label>
    <button :id="id" ref="trigger" type="button" class="appearance-select-trigger" role="combobox" aria-haspopup="listbox" :aria-labelledby="`${id}-label`" :aria-expanded="open" :aria-controls="`${id}-options`" :aria-activedescendant="open ? `${id}-option-${activeIndex}` : undefined" :disabled="disabled" @click="toggle" @keydown="onKeydown">
      <span>{{ selectedLabel }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <ul v-if="open" :id="`${id}-options`" class="appearance-select-menu" role="listbox" :aria-labelledby="`${id}-label`">
      <li v-for="(option, index) in options" :id="`${id}-option-${index}`" :key="option.value" role="option" :aria-selected="option.value === modelValue" :class="{ 'is-highlighted': index === activeIndex, 'is-selected': option.value === modelValue }" @pointerenter="activeIndex = index" @pointerdown.prevent @click="choose(index)">
        <span>{{ option.label }}</span><svg v-if="option.value === modelValue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
const props = defineProps({ id: { type: String, required: true }, label: { type: String, required: true }, modelValue: { type: [String, Number], required: true }, options: { type: Array, required: true }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const root = ref(null), trigger = ref(null), open = ref(false), activeIndex = ref(0)
const selectedLabel = computed(() => props.options.find(option => option.value === props.modelValue)?.label || 'Choose an option')
const show = () => { if (props.disabled || !props.options.length) return; activeIndex.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue)); open.value = true }
const toggle = () => { if (open.value) open.value = false; else show() }
const choose = index => { if (props.disabled || !props.options[index]) return; emit('update:modelValue', props.options[index].value); open.value = false; trigger.value?.focus() }
const onKeydown = event => {
  if (props.disabled) return
  if (event.key === 'Tab') { open.value = false; return }
  if (event.key === 'Escape') { event.preventDefault(); open.value = false; return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (!open.value) { show(); return }
    if (event.key === 'Enter' || event.key === ' ') choose(activeIndex.value)
    else if (event.key === 'Home') activeIndex.value = 0
    else if (event.key === 'End') activeIndex.value = props.options.length - 1
    else activeIndex.value = (activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + props.options.length) % props.options.length
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const index = props.options.findIndex(option => option.label.toLowerCase().startsWith(event.key.toLowerCase()))
    if (index >= 0) { if (!open.value) show(); activeIndex.value = index }
  }
}
const closeOutside = event => { if (!root.value?.contains(event.target)) open.value = false }
const closeOnFocus = event => { if (!root.value?.contains(event.target)) open.value = false }
watch(() => props.disabled, disabled => { if (disabled) open.value = false })
onMounted(() => { document.addEventListener('pointerdown', closeOutside); document.addEventListener('focusin', closeOnFocus) })
onUnmounted(() => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('focusin', closeOnFocus) })
</script>

<style scoped>
.appearance-select { position: relative; min-width: 0; margin: 20px 0 8px; color: #5d4536; }
.appearance-select label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.appearance-select .appearance-select-trigger { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #dec19e; border-radius: 10px; background: #fffdf9; color: #3d281d; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; }
.appearance-select-trigger:hover:not(:disabled), .appearance-select-trigger[aria-expanded=true] { border-color: #b78055; background: #fff8ee; }
.appearance-select-trigger:focus-visible { outline: 2px solid #b78055; outline-offset: 2px; }
.appearance-select-trigger:disabled { opacity: .5; cursor: not-allowed; }
.appearance-select svg { width: 17px; height: 17px; flex-shrink: 0; color: #91643f; }
.appearance-select .appearance-select-menu { position: absolute; top: 100%; left: 0; right: 0; z-index: 30; margin: 6px 0 0; padding: 5px; list-style: none; border: 1px solid #dec19e; border-radius: 10px; background: #fffdf9; color: #3d281d; box-shadow: 0 8px 24px #3d281d1a; max-height: 240px; overflow-y: auto; }
.appearance-select-menu li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; border-radius: 6px; font-size: 13px; line-height: 1.5; cursor: pointer; }
.appearance-select-menu li.is-selected { color: #805432; font-weight: 600; }
.appearance-select-menu li.is-highlighted { background: #f4e7d5; color: #3d281d; }
</style>
