<script setup>
defineProps({
  variant: { type: String, default: 'table' },
  columns: { type: Number, default: 5 },
  rows: { type: Number, default: 5 },
  cards: { type: Number, default: 4 },
  fields: { type: Number, default: 6 },
  sections: { type: Number, default: 2 },
  panels: { type: Number, default: 2 },
  listPanels: { type: Number, default: 2 },
  header: { type: Boolean, default: true },
  blocks: { type: Array, default: () => [] },
  cardStyle: { type: String, default: 'catalog' },
})
</script>

<template>
  <div class="page-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading page content…</span>
    <div aria-hidden="true" class="skeleton-layout">
      <div v-if="header" class="skeleton-heading"><div class="bone title"></div><div class="bone subtitle"></div></div>
      <template v-if="blocks.length">
        <PageSkeleton v-for="(block, index) in blocks" :key="index" v-bind="block" :header="false" />
      </template>
      <template v-else>
      <template v-if="variant === 'dashboard' || variant === 'cards' || variant === 'report'">
        <div v-if="variant === 'cards' && cardStyle === 'catalog'" class="skeleton-toolbar"><div class="bone search"></div><div class="bone button"></div></div>
        <div class="skeleton-cards" :style="{ '--cards': Math.min(cards, 4) }">
          <div v-for="card in cards" :key="card" class="skeleton-surface stat">
            <div v-if="variant === 'cards' && cardStyle === 'catalog'" class="bone card-image"></div>
            <div class="bone short"></div><div class="bone value"></div><div class="bone medium"></div>
            <template v-if="variant === 'cards' && cardStyle === 'plan'"><div v-for="line in 5" :key="line" class="bone"></div><div class="bone button"></div></template>
          </div>
        </div>
      </template>
      <div v-if="variant === 'dashboard' || variant === 'report'" class="skeleton-panels" :style="{ '--panels': panels }">
        <div v-for="panel in panels" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div class="chart-placeholder"><div v-for="bar in 5" :key="bar" class="bone chart-bar" :style="{ height: `${25 + (bar * 17 % 65)}%` }"></div></div></div>
      </div>
      <div v-if="variant === 'form' || variant === 'profile' || variant === 'settings'" class="skeleton-surface skeleton-form" :class="{ 'profile-form': variant === 'profile' }">
        <div v-if="variant === 'profile'" class="bone avatar"></div>
        <section v-for="section in sections" :key="section" class="skeleton-form-section">
          <div class="bone medium"></div>
          <div class="skeleton-fields"><div v-for="field in fields" :key="field" class="skeleton-field"><div class="bone short"></div><div class="bone input"></div></div></div>
        </section>
        <div class="bone button"></div>
      </div>
      <div v-else-if="variant === 'split' || variant === 'chat'" class="skeleton-split">
        <div class="skeleton-surface"><div class="bone input"></div><div v-for="row in rows" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone short"></div></div></div></div>
        <div class="skeleton-surface split-detail"><div class="bone medium"></div><div v-for="row in 4" :key="row" class="bone message" :class="{ reply: row % 2 === 0 }"></div><div class="bone input composer"></div></div>
      </div>
      <div v-else-if="variant === 'list'" class="skeleton-surface"><div v-for="row in rows" :key="row" class="skeleton-list-row"><div class="bone avatar small"></div><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone button small"></div></div></div>
      <div v-else-if="variant === 'dashboard'" class="skeleton-panels" :style="{ '--panels': listPanels }"><div v-for="panel in listPanels" :key="panel" class="skeleton-surface"><div class="bone medium"></div><div v-for="row in 3" :key="row" class="skeleton-list-row"><div class="skeleton-copy"><div class="bone medium"></div><div class="bone subtitle"></div></div><div class="bone short"></div></div></div></div>
      <div v-else-if="variant !== 'cards'" class="skeleton-surface">
        <div class="skeleton-toolbar"><div class="bone search"></div><div class="bone button"></div></div>
        <div class="skeleton-table-scroll"><div class="skeleton-table" :style="{ '--columns': columns }"><div v-for="row in rows + 1" :key="row" class="skeleton-table-row"><div v-for="column in columns" :key="column" class="bone" :class="column === columns ? 'short' : ''"></div></div></div></div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page-skeleton { width: 100%; color: #786354; }
.skeleton-layout { display: grid; gap: 24px; }
.skeleton-heading, .skeleton-copy { display: grid; gap: 12px; }
.bone { height: 12px; max-width: 100%; border-radius: 6px; background: linear-gradient(100deg, #ead9c3 20%, #f8eedf 45%, #ead9c3 70%); background-size: 240% 100%; animation: skeleton-shimmer 1.7s ease-in-out infinite; }
.title { height: 28px; width: 260px; }
.subtitle { width: 380px; }
.short { width: 72px; }
.medium { width: 160px; }
.value { height: 30px; width: 90px; }
.skeleton-surface { padding: 24px; border-radius: 16px; border: 1px solid #ead2b2; background: #fffaf4; min-width: 0; }
.skeleton-cards { display: grid; grid-template-columns: repeat(var(--cards), minmax(0, 1fr)); gap: 16px; }
.stat { display: grid; gap: 18px; }
.card-image { height: 140px; width: 100%; border-radius: 10px; }
.skeleton-panels { display: grid; grid-template-columns: repeat(var(--panels), minmax(0, 1fr)); gap: 20px; }
.chart-placeholder { display: flex; gap: 16px; align-items: flex-end; height: 190px; padding-top: 32px; border-bottom: 1px solid #ead2b2; }
.chart-bar { flex: 1; border-radius: 6px 6px 0 0; }
.skeleton-form { width: 100%; max-width: 900px; margin: 0 auto; display: grid; gap: 28px; }
.skeleton-form-section { display: grid; gap: 20px; }
.skeleton-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 16px; }
.skeleton-field { display: grid; gap: 10px; }
.input { height: 44px; width: 100%; border-radius: 10px; }
.avatar { width: 84px; height: 84px; border-radius: 50%; }
.avatar.small { width: 36px; height: 36px; }
.button { width: 120px; height: 38px; border-radius: 10px; }
.button.small { width: 70px; height: 28px; }
.skeleton-toolbar { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.search { width: 320px; height: 42px; border-radius: 10px; }
.skeleton-table-scroll { overflow-x: auto; }
.skeleton-table { min-width: calc(var(--columns) * 95px); }
.skeleton-table-row { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); gap: 20px; padding: 20px 0; border-bottom: 1px solid #efdfcc; }
.skeleton-table-row:first-child { padding-top: 4px; }
.skeleton-split { display: grid; grid-template-columns: minmax(230px, 1fr) minmax(0, 2fr); gap: 20px; }
.skeleton-list-row { display: flex; align-items: center; gap: 16px; padding: 18px 0; border-bottom: 1px solid #efdfcc; }
.skeleton-copy { flex: 1; min-width: 0; }
.split-detail { display: flex; flex-direction: column; gap: 24px; min-height: 400px; }
.message { width: 65%; height: 50px; }
.message.reply { align-self: flex-end; }
.composer { margin-top: auto; }
@keyframes skeleton-shimmer { to { background-position: -140% 0; } }
@media (max-width: 900px) { .skeleton-cards, .skeleton-panels { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .skeleton-fields, .skeleton-panels, .skeleton-split { grid-template-columns: 1fr; } .skeleton-surface { padding: 18px; } .skeleton-toolbar { gap: 12px; } }
@media (prefers-reduced-motion: reduce) { .bone { animation: none; } }
</style>
