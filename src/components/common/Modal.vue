<template>
  <teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black bg-opacity-50" @click="handleBackdropClick"></div>
      <div :class="['relative rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col', panelClass]">
        <div class="flex justify-between items-center p-4 border-b">
          <slot name="header">
            <h3 v-if="title" class="text-lg font-semibold">{{ title }}</h3>
          </slot>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-2 overflow-y-auto flex-1">
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

let openModalCount = 0
let savedBodyOverflow = ''
let savedHtmlOverflow = ''

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

const lockBodyScroll = (shouldLock) => {
  if (typeof document === 'undefined') return
  if (shouldLock) {
    if (openModalCount === 0) {
      savedBodyOverflow = document.body.style.overflow
      savedHtmlOverflow = document.documentElement.style.overflow
    }
    openModalCount += 1
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  } else {
    openModalCount = Math.max(0, openModalCount - 1)
    if (openModalCount === 0) {
      document.body.style.overflow = savedBodyOverflow || ''
      document.documentElement.style.overflow = savedHtmlOverflow || ''
    }
  }
}

watch(
  () => props.isOpen,
  (isOpen) => {
    lockBodyScroll(isOpen)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  lockBodyScroll(false)
})
</script>
