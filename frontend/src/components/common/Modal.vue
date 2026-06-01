<template>
  <teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 pb-4 pt-20 sm:items-center sm:p-6">
      <div class="absolute inset-0 bg-black bg-opacity-50" @click="handleBackdropClick"></div>
      <div
        :class="['relative z-[81] flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg shadow-lg sm:max-h-[calc(100vh-3rem)]', panelClass]"
        :style="panelStyle"
      >
        <div class="flex items-center justify-between gap-4 border-b p-4">
          <slot name="header">
            <h3 v-if="title" class="text-lg font-semibold">{{ title }}</h3>
          </slot>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div :class="['flex-1 min-h-0 overflow-y-auto p-4', bodyClass]">
          <slot name="body">
            <slot />
          </slot>
        </div>

        <div v-if="$slots.footer || showConfirm" class="p-4 border-t">
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
      try {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          lockPageScroll()
        }
      } catch (_e) {
        // fallback: if window isn't available or check fails, lock as before
        lockPageScroll()
      }
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
