<template>
  <teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div class="absolute inset-0 bg-black bg-opacity-50" @click="handleBackdropClick"></div>
      <div :class="['relative z-[81] w-full max-w-4xl overflow-hidden rounded-lg shadow-lg flex flex-col', panelClass]">
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

        <div :class="['flex-1 overflow-y-auto p-4', bodyClass]">
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
