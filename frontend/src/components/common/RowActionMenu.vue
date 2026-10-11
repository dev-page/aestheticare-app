<template>
  <div ref="root" class="row-action-menu">
    <button ref="trigger" type="button" class="row-action-trigger" :aria-label="label" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? id : undefined" @click="toggle" @keydown.down.prevent="show">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
    </button>
    <Teleport to="body">
      <div v-if="open" :id="id" ref="menu" class="row-action-options" role="menu" :aria-label="label" :style="position" @keydown="onMenuKeydown">
        <button v-for="item in items" :key="item.action" type="button" role="menuitem" :disabled="item.disabled" :title="item.title" @click="choose(item)">{{ item.label }}</button>
      </div>
    </Teleport>
  </div>
</template>
<script setup>
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'
defineProps({ label: { type: String, default: 'Actions' }, items: { type: Array, required: true } })
const emit = defineEmits(['select'])
const id = useId(), root = ref(null), trigger = ref(null), menu = ref(null), open = ref(false), position = ref({})
const close = (restoreFocus = false) => { open.value = false; if (restoreFocus) trigger.value?.focus() }
const show = async () => {
  const rect = trigger.value.getBoundingClientRect()
  const left = Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188))
  const below = window.innerHeight - rect.bottom
  position.value = { left: left + 'px', ...(below >= 150 ? { top: rect.bottom + 6 + 'px' } : { bottom: window.innerHeight - rect.top + 6 + 'px' }), maxHeight: Math.max(80, Math.max(below, rect.top) - 16) + 'px' }
  open.value = true
  await nextTick()
  menu.value?.querySelector('button:not(:disabled)')?.focus()
}
const toggle = () => open.value ? close() : show()
const choose = item => { if (!item.disabled) { close(true); emit('select', item.action) } }
const onMenuKeydown = event => {
  if (event.key === 'Escape') { event.preventDefault(); close(true); return }
  if (event.key === 'Tab') { close(true); return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const buttons = [...menu.value.querySelectorAll('button:not(:disabled)')]
    const current = buttons.indexOf(document.activeElement)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[index]?.focus()
  }
}
const outside = event => { if (!root.value?.contains(event.target) && !menu.value?.contains(event.target)) close() }
const moved = event => { if (!menu.value?.contains(event.target)) close() }
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('scroll', moved, true); window.addEventListener('resize', moved) })
onUnmounted(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', moved, true); window.removeEventListener('resize', moved) })
</script>
<style scoped>
.row-action-menu .row-action-trigger { display: grid; place-items: center; width: 36px; height: 36px; min-height: 36px; padding: 0; border: 1px solid #dec19e; border-radius: 9px; background: #fffdf9; color: #735039; }
.row-action-trigger:hover, .row-action-trigger[aria-expanded=true] { background: #f4e7d5; border-color: #b78055; }
.row-action-trigger:focus-visible { outline: 2px solid #b78055; outline-offset: 2px; }
.row-action-options { position: fixed; z-index: 100; width: 180px; padding: 5px; overflow-y: auto; border: 1px solid #dec19e; border-radius: 10px; background: #fffdf9; box-shadow: 0 8px 24px #3d281d26; font-family: var(--ac-font-ui, sans-serif); }
.row-action-options button { display: block; width: 100%; min-height: 40px; padding: 10px 12px; border: 0; border-radius: 6px; background: transparent; color: #5d4536; text-align: left; font-size: 13px; font-weight: 500; cursor: pointer; }
.row-action-options button:hover:not(:disabled), .row-action-options button:focus-visible { outline: none; background: #f4e7d5; color: #3d281d; }
.row-action-options button:disabled { color: #aa998b; cursor: not-allowed; }
</style>
