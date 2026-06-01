<template>
  <button
    :class="buttonClasses"
    @click="$emit('click')"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const buttonClasses = computed(() => {
  const baseClasses = 'font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors'

  const variantClasses = {
    primary: 'bg-brown text-white hover:bg-opacity-90 focus:ring-brown',
    secondary: 'bg-light text-gray-900 hover:bg-opacity-90 focus:ring-light',
    danger: 'bg-pink text-white hover:bg-opacity-90 focus:ring-pink'
  }

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  }

  return `${baseClasses} ${variantClasses[props.variant]} ${sizeClasses[props.size]} ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`
})
</script>