<template>
  <div class="app-loading-screen" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-content">
      <div class="loading-emblem" aria-hidden="true">
        <div class="loading-orbit"></div>
        <div class="loading-logo"><span class="public-nav-mark"></span></div>
      </div>
      <p class="public-nav-brand loading-brand">AesthetiCare</p>
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
    radial-gradient(ellipse at 30% 20%, #fffaf3 0%, transparent 65%),
    linear-gradient(135deg, #fff8ee 0%, #f8eedf 45%, #efdbbf 100%);
  color: #352a25;
}
.loading-content { text-align: center; width: 100%; max-width: 360px; }
.loading-emblem { position: relative; width: 144px; height: 144px; margin: 0 auto 26px; display: grid; place-items: center; }
.loading-orbit { position: absolute; inset: 0; border: 1px solid #e6cfb8; border-radius: 50%; }
.loading-orbit::after { content: ''; position: absolute; inset: -1px; border: 2px solid transparent; border-top-color: #b78055; border-right-color: #d7aa7d; border-radius: 50%; animation: loading-turn 2.4s linear infinite; }
.loading-logo { width: 80px; height: 80px; display: grid; place-items: center; animation: loading-breathe 2.4s ease-in-out infinite; }
.loading-logo .public-nav-mark { transform: scale(2.5); }
.loading-brand { font-size: clamp(28px, 5vw, 34px); line-height: 1.3; margin: 0 0 12px; }
.loading-label { font-family: var(--ac-font-ui, system-ui, sans-serif); font-size: 13px; line-height: 1.6; color: #786354; margin: 0; }
.loading-dots { display: flex; justify-content: center; gap: 7px; margin-top: 22px; }
.loading-dots span { width: 5px; height: 5px; border-radius: 50%; background: #b78055; animation: loading-dot 1.5s ease-in-out infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.18s; }
.loading-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes loading-turn { to { transform: rotate(360deg); } }
@keyframes loading-breathe { 0%, 100% { opacity: 0.65; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1); } }
@keyframes loading-dot { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .loading-orbit::after, .loading-logo, .loading-dots span { animation: none; } }
</style>
