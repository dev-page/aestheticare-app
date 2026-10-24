<template><div class="supplier-verification-page min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fff8eb] via-[#f8f0e5] to-[#f2e7d8]"><button type="button" class="onboarding-logout" aria-label="Log out" title="Log out" @click="logout"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3m9-7h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" /></svg><span>Log out</span></button><main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12"><SupplierVerificationPanel/></main></div></template>
<script setup>
import SupplierVerificationPanel from '@/components/SupplierVerificationPanel.vue'
import { useAuth } from '@/composables/useAuth'
const { logout } = useAuth()
</script>
<style scoped>
.onboarding-logout{position:fixed;top:1.25rem;right:1.25rem;z-index:20;display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.75rem;padding:.55rem .85rem;border:1px solid #ddc6a8;border-radius:999px;background:#fffdfa;color:#68442d;font:inherit;font-size:.82rem;font-weight:800;box-shadow:0 8px 22px #795c461c;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}.onboarding-logout:hover{transform:translateY(-1px);border-color:#a97a51;background:#fff5e7}.onboarding-logout:focus-visible{outline:3px solid #95634466;outline-offset:3px}.onboarding-logout svg{width:1.1rem;height:1.1rem;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8}@media(max-width:640px){.onboarding-logout{top:.75rem;right:.75rem;width:2.65rem;height:2.65rem;min-height:2.65rem;padding:.65rem}.onboarding-logout span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.supplier-verification-page main{padding-top:4.5rem}}
</style>
