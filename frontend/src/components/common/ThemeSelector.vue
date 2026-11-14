<template>
  <div class="theme-selector readonly-exempt">
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
    </button>
  </div>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<style scoped>
.theme-selector { position: relative; z-index: 100; }
.theme-selector-trigger { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: .65rem; border: 1px solid var(--ac-border-strong); border-radius: 999px; background: var(--ac-surface); color: var(--ac-text-secondary); transition: background .2s, border-color .2s, color .2s, transform .2s, box-shadow .2s; box-shadow: 0 8px 22px rgba(42, 25, 14, .18); }
.theme-selector-trigger:hover, .theme-selector-trigger:focus-visible { border-color: var(--ac-accent); background: var(--ac-surface-soft); color: var(--ac-primary); outline: none; }
.theme-selector-trigger:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(42, 25, 14, .24); }
.theme-selector-trigger > svg:first-child { width: 1.2rem; height: 1.2rem; }
@media (max-width: 480px) { .theme-selector-trigger { width: 2.65rem; height: 2.65rem; padding: .6rem; } }
</style>
