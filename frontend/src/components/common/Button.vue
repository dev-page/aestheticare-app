<template>
  <button
    :class="buttonClasses"
    @click="$emit('click')"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span v-if="loading" class="inline-flex items-center gap-2">
      <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span>
      {{ loadingLabel || 'Processing...' }}
    </span>
    <slot v-else />
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
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingLabel: {
    type: String,
    default: ''
  }
})

const buttonClasses = computed(() => {
  const baseClasses = 'app-button focus:outline-none transition-colors'

  const variantClasses = {
    primary: 'app-button--primary',
    secondary: 'app-button--secondary',
    danger: 'app-button--danger'
  }

  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  }

  return `${baseClasses} ${variantClasses[props.variant]} ${sizeClasses[props.size]} ${props.disabled || props.loading ? 'opacity-50 cursor-not-allowed' : ''}`
})
</script>
