<template>
  <div v-if="center" class="branch-picker-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="branch-picker" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <div class="branch-picker-header">
        <div>
          <p class="branch-picker-kicker">Choose a branch</p>
          <h2 :id="titleId">{{ center.name }}</h2>
          <p>Select the branch you want to browse, book with, or shop from.</p>
        </div>
        <button type="button" class="branch-picker-close" aria-label="Close branch selector" @click="$emit('close')">×</button>
      </div>
      <div class="branch-picker-list">
        <button
          v-for="branch in center.branches"
          :key="branch.id"
          type="button"
          class="branch-picker-option"
          @click="$emit('select', branch)"
        >
          <span>
            <strong>{{ branch.branchName || branch.name }}</strong>
            <small>{{ branch.location || 'Location not set' }}</small>
          </span>
          <span class="branch-picker-arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  center: { type: Object, default: null },
})
defineEmits(['close', 'select'])
const titleId = 'branch-picker-title'
</script>

<style scoped>
.branch-picker-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1rem; background: rgba(42, 24, 15, .56); backdrop-filter: blur(5px); }
.branch-picker { width: min(100%, 34rem); max-height: min(42rem, calc(100dvh - 2rem)); overflow: auto; border: 1px solid #e6c196; border-radius: 1.5rem; background: #fffaf4; padding: 1.5rem; box-shadow: 0 28px 72px rgba(54, 34, 22, .3); }
.branch-picker-header { display: flex; justify-content: space-between; gap: 1rem; }
.branch-picker-kicker { margin: 0; color: #956344; font-size: .7rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.branch-picker h2 { margin: .35rem 0; color: #342419; font-size: 1.5rem; }
.branch-picker p { margin: 0; color: #72573f; font-size: .9rem; line-height: 1.5; }
.branch-picker-close { display: inline-grid; width: 2.25rem; height: 2.25rem; place-items: center; border: 1px solid #e6c196; border-radius: 999px; background: #fff; color: #5b432f; font-size: 1.5rem; line-height: 1; }
.branch-picker-list { display: grid; gap: .75rem; margin-top: 1.4rem; }
.branch-picker-option { display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%; border: 1px solid #efd3ac; border-radius: 1rem; background: #fff; padding: 1rem; text-align: left; transition: border-color .2s ease, background-color .2s ease, transform .2s ease; }
.branch-picker-option:hover { border-color: #c6946c; background: #fff8eb; transform: translateY(-1px); }
.branch-picker-option strong, .branch-picker-option small { display: block; }
.branch-picker-option strong { color: #342419; font-size: .95rem; }
.branch-picker-option small { margin-top: .3rem; color: #72573f; font-size: .8rem; }
.branch-picker-arrow { color: #956344; font-size: 1.75rem; line-height: 1; }
</style>
