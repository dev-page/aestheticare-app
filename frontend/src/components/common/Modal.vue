<template>
  <teleport to="body">
    <div v-if="isOpen" class="app-modal-overlay fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto">
      <div :class="['absolute inset-0 bg-black/70 backdrop-blur-sm', backdropClass]" @click="handleBackdropClick"></div>
      <div
        :class="['app-modal-panel relative z-[81] flex w-full max-w-4xl flex-col overflow-hidden rounded-lg shadow-lg', panelClass]"
        :style="panelStyle"
      >
        <div class="app-modal-header flex items-center justify-between gap-4 border-b p-4">
          <slot name="header">
            <h3 v-if="title" class="text-lg font-semibold">{{ title }}</h3>
          </slot>
          <button type="button" aria-label="Close dialog" @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div :class="['app-modal-body flex-1 min-h-0 overflow-y-auto p-4', bodyClass]">
          <slot name="body">
            <slot />
          </slot>
        </div>

        <div v-if="$slots.footer || showConfirm" class="app-modal-footer p-4 border-t">
          <slot name="footer">
            <div v-if="showConfirm" class="flex justify-end">
              <Button @click="$emit('confirm')">Confirm</Button>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { defineEmits, defineProps, onBeforeUnmount, watch } from 'vue'
import Button from './Button.vue'
import { lockPageScroll, unlockPageScroll } from '@/utils/scrollLock'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true
  },
  showConfirm: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  panelClass: {
    type: String,
    default: ''
  },
  panelStyle: {
    type: [String, Object],
    default: ''
  },
  bodyClass: {
    type: String,
    default: ''
  },
  backdropClass: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'confirm'])

const closeModal = () => {
  emit('close')
}

const handleBackdropClick = () => {
  if (!props.closeOnBackdrop) return
  closeModal()
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      lockPageScroll()
    } else {
      unlockPageScroll()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  unlockPageScroll()
})
</script>

<style>
.app-modal-overlay {
  box-sizing: border-box;
  padding: 0.75rem;
  padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
}

.app-modal-panel {
  min-width: 0;
  max-height: calc(100vh - 1.5rem);
  max-height: calc(100dvh - 1.5rem);
}

.app-modal-header,
.app-modal-footer {
  flex: 0 0 auto;
}

.app-modal-body {
  min-width: 0;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  .app-modal-overlay {
    padding-left: max(0.5rem, env(safe-area-inset-left, 0px));
    padding-right: max(0.5rem, env(safe-area-inset-right, 0px));
  }

  .app-modal-panel {
    border-radius: 0.9rem;
  }

  .app-modal-overlay .app-modal-header,
  .app-modal-overlay .app-modal-footer,
  .app-modal-overlay .app-modal-body {
    padding: 0.85rem;
  }
}

@media (min-width: 641px) {
  .app-modal-overlay { padding: 1.5rem; }
}
</style>
