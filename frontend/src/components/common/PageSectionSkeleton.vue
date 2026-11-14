<template>
  <div class="page-section-skeleton" :class="variantClass" :style="rootStyle" role="status" aria-live="polite" aria-busy="true">
    <span class="sr-only">Loading content…</span>
    <div class="skeleton-content" aria-hidden="true">
    <template v-if="variant === 'list'">
      <div
        v-for="item in resolvedCount"
        :key="`list-${item}`"
        class="skeleton-list-row"
      >
        <div class="skeleton-check"></div>
        <div class="skeleton-list-copy">
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-pill"></div>
      </div>
    </template>

    <template v-else-if="variant === 'detail'">
      <div class="skeleton-detail-header">
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
      <div class="skeleton-detail-grid">
        <div
          v-for="item in 4"
          :key="`detail-card-${item}`"
          class="skeleton-detail-card"
        >
          <div class="skeleton-line short"></div>
          <div class="skeleton-line medium"></div>
        </div>
      </div>
      <div class="skeleton-detail-panels">
        <div
          v-for="item in 2"
          :key="`detail-panel-${item}`"
          class="skeleton-panel"
        ></div>
      </div>
    </template>

    <template v-else-if="variant === 'split'">
      <div class="skeleton-split">
        <div class="skeleton-panel tall"></div>
        <div class="skeleton-panel side"></div>
      </div>
    </template>

    <template v-else-if="variant === 'cards'">
      <div class="skeleton-card-grid">
        <article v-for="item in resolvedCount" :key="`card-${item}`" class="skeleton-card">
          <div class="skeleton-card-media"></div>
          <div class="skeleton-card-heading"><div class="skeleton-line medium"></div><div class="skeleton-pill"></div></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-card-details"><div v-for="detail in 3" :key="detail"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div></div></div>
          <div class="skeleton-line long"></div>
          <div class="skeleton-card-footer"><div class="skeleton-line short"></div><div class="skeleton-pill"></div></div>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="skeleton-table-head">
        <div
          v-for="item in columns"
          :key="`head-${item}`"
          class="skeleton-line short"
        ></div>
      </div>
      <div class="skeleton-table-body">
        <div
          v-for="item in resolvedCount"
          :key="`row-${item}`"
          class="skeleton-table-row"
        >
          <div
            v-for="col in columns"
            :key="`cell-${item}-${col}`"
            class="skeleton-line"
            :class="col % 3 === 0 ? 'short' : col % 2 === 0 ? 'medium' : 'long'"
          ></div>
        </div>
      </div>
    </template>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'PageSectionSkeleton',
  props: {
    variant: {
      type: String,
      default: 'table',
    },
    rows: {
      type: Number,
      default: 5,
    },
    columns: {
      type: Number,
      default: 5,
    },
  },
  setup(props) {
    const resolvedCount = computed(() => Math.max(1, Number(props.rows) || 1))
    const variantClass = computed(() => `variant-${props.variant}`)
    const rootStyle = computed(() => ({ '--cols': Math.max(1, Number(props.columns) || 1) }))

    return {
      resolvedCount,
      rootStyle,
      variantClass,
    }
  },
}
</script>

<style scoped>
.page-section-skeleton {
  display: grid;
  gap: 1rem;
}
.skeleton-content { display: grid; gap: 1rem; }

.skeleton-line,
.skeleton-pill,
.skeleton-check,
.skeleton-panel,
.skeleton-detail-card {
  background: linear-gradient(90deg, var(--ac-surface-muted), var(--ac-border), var(--ac-surface-muted));
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-line {
  height: 0.9rem;
  max-width: 100%;
  border-radius: 999px;
}

.skeleton-line.short {
  width: 5rem;
}

.skeleton-line.medium {
  width: 9rem;
}

.skeleton-line.long {
  width: 100%;
}

.skeleton-table-head,
.skeleton-table-row {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
}

.skeleton-table-body {
  display: grid;
  gap: 0.85rem;
}

.skeleton-table-row {
  padding: 1rem 0;
  border-top: 1px solid var(--ac-border);
}

.skeleton-list-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.85rem;
  padding: 1rem 0;
  border-top: 1px solid var(--ac-border);
}

.skeleton-list-copy {
  display: grid;
  gap: 0.65rem;
}

.skeleton-check {
  width: 1rem;
  height: 1rem;
  margin-top: 0.15rem;
  border-radius: 0.35rem;
}

.skeleton-pill {
  width: 4.5rem;
  height: 1.7rem;
  border-radius: 999px;
}

.skeleton-detail-header {
  display: grid;
  gap: 0.75rem;
}

.skeleton-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
}

.skeleton-detail-card {
  display: grid;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 1rem;
}

.skeleton-detail-panels,
.skeleton-split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.skeleton-card-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: 1rem;
}

.skeleton-card {
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--ac-border);
  border-radius: 1rem;
  background: var(--ac-surface);
}

.skeleton-card-media {
  height: 8rem;
  border-radius: .75rem;
  background: linear-gradient(90deg, var(--ac-surface-muted), var(--ac-border), var(--ac-surface-muted));
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-card-heading,
.skeleton-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.skeleton-card-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .5rem;
  padding: .75rem 0;
  border-top: 1px solid var(--ac-border);
  border-bottom: 1px solid var(--ac-border);
}

.skeleton-card-details > div {
  display: grid;
  gap: .5rem;
}

.skeleton-panel {
  min-height: 14rem;
  border-radius: 1rem;
}

.skeleton-panel.tall {
  min-height: 22rem;
}

.skeleton-panel.side {
  min-height: 18rem;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 800px) {
  .skeleton-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .skeleton-card-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-line, .skeleton-pill, .skeleton-check, .skeleton-panel, .skeleton-detail-card, .skeleton-card-media { animation: none; }
}
</style>
