<template>
  <div class="app-loading-screen" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-content">
      <div class="loading-emblem" aria-hidden="true">
        <div class="loading-orbit"></div>
        <div class="loading-logo"><span class="public-nav-mark"></span></div>
      </div>
      <p class="loading-brand">AesthetiCare</p>
      <p class="loading-label">{{ label }}</p>
      <div class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
  </div>
</template>

<script setup>
defineProps({ label: { type: String, default: 'Preparing your experience…' } })
</script>

<style scoped>
.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at 30% 20%, var(--ac-surface) 0%, transparent 65%),
    linear-gradient(135deg, var(--ac-bg) 0%, var(--ac-bg-soft) 45%, var(--ac-bg-deep) 100%);
  color: var(--ac-text);
}
.loading-content { text-align: center; width: 100%; max-width: 360px; }
.loading-emblem { position: relative; width: 144px; height: 144px; margin: 0 auto 26px; display: grid; place-items: center; }
.loading-orbit { position: absolute; inset: 0; border: 1px solid var(--ac-border); border-radius: 50%; }
.loading-orbit::after { content: ''; position: absolute; inset: -1px; border: 2px solid transparent; border-top-color: var(--ac-accent); border-right-color: var(--ac-accent-soft); border-radius: 50%; animation: loading-turn 2.4s linear infinite; }
.loading-logo { width: 80px; height: 80px; display: grid; place-items: center; animation: loading-breathe 2.4s ease-in-out infinite; }
.loading-logo .public-nav-mark { transform: scale(2.5); background: linear-gradient(145deg, var(--ac-accent-soft) 0%, var(--ac-accent) 52%, var(--ac-primary) 100%); }
.loading-brand { font-family: var(--ac-font-display, Georgia, serif); font-size: clamp(28px, 5vw, 34px); font-weight: 700; letter-spacing: .05em; line-height: 1.3; color: var(--ac-text); margin: 0 0 12px; }
.loading-label { font-family: var(--ac-font-ui, system-ui, sans-serif); font-size: 13px; line-height: 1.6; color: var(--ac-text-muted); margin: 0; }
.loading-dots { display: flex; justify-content: center; gap: 7px; margin-top: 22px; }
.loading-dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--ac-accent); animation: loading-dot 1.5s ease-in-out infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.18s; }
.loading-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes loading-turn { to { transform: rotate(360deg); } }
@keyframes loading-breathe { 0%, 100% { opacity: 0.65; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1); } }
@keyframes loading-dot { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .loading-orbit::after, .loading-logo, .loading-dots span { animation: none; } }
</style>
