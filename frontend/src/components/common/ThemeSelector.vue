<template>
  <div class="theme-selector">
    <button
      type="button"
      class="theme-selector-trigger theme-toggle"
      :aria-pressed="theme.preference === 'dark'"
      :aria-label="theme.preference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      :title="theme.preference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="theme.toggle()"
    >
      <svg v-if="theme.preference === 'light'" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="4" stroke-width="1.8" />
        <path stroke-linecap="round" stroke-width="1.8" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg v-else aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20.5 15.4A8.5 8.5 0 0 1 8.6 3.5 8.5 8.5 0 1 0 20.5 15.4Z" />
      </svg>
      <span class="theme-selector-label">{{ theme.preference === 'dark' ? 'Dark Mode' : 'Light Mode' }}</span>
    </button>
  </div>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<style scoped>
.theme-selector { position: relative; z-index: 100; }
.theme-selector-trigger { display: inline-flex; align-items: center; gap: .45rem; min-height: 2.25rem; padding: .45rem .7rem; border: 1px solid var(--ac-border-strong); border-radius: 999px; background: var(--ac-surface); color: var(--ac-text-secondary); font-size: .75rem; font-weight: 600; transition: background .2s, border-color .2s, color .2s; }
.theme-selector-trigger:hover, .theme-selector-trigger:focus-visible { border-color: var(--ac-accent); background: var(--ac-surface-soft); color: var(--ac-primary); outline: none; }
.theme-selector-trigger > svg:first-child { width: 1rem; height: 1rem; }
.theme-selector-label { white-space: nowrap; }
@media (max-width: 480px) { .theme-selector-label { display: none; } .theme-selector-trigger { width: 2.25rem; justify-content: center; padding: .45rem; } }
</style>
