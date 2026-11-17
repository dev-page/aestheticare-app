<template>
  <div
    v-if="totalItems > 0"
    class="table-pagination"
    :class="`table-pagination-${part}`"
    :aria-label="part === 'top' ? undefined : 'Table pagination'"
    :role="part === 'top' ? 'group' : 'navigation'"
  >
    <template v-if="part === 'top'">
      <p class="table-pagination-summary" aria-live="polite">
        Showing <strong>{{ rangeStart }}–{{ rangeEnd }}</strong> of
        <strong>{{ totalItems }}</strong> {{ itemLabel }}
        <slot name="summary-extra" />
      </p>
      <label class="table-pagination-size">
        <span>Rows per page</span>
        <select :value="pageSize" @change="updatePageSize">
        <option v-for="size in availablePageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </template>

    <template v-else>
      <p class="table-pagination-page-label" aria-live="polite">Page {{ safePage }} of {{ totalPages }}</p>
      <div class="table-pagination-controls">
        <button type="button" :disabled="safePage <= 1" aria-label="Go to first page" @click="goToPage(1)">First</button>
        <button type="button" :disabled="safePage <= 1" aria-label="Go to previous page" @click="goToPage(safePage - 1)">Previous</button>
        <template v-for="pageEntry in visiblePages" :key="pageEntry.key">
          <span v-if="pageEntry.type === 'ellipsis'" class="table-pagination-ellipsis" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="table-pagination-number"
            :class="{ 'is-current': pageEntry.value === safePage }"
            :aria-label="`Go to page ${pageEntry.value}`"
            :aria-current="pageEntry.value === safePage ? 'page' : undefined"
            @click="goToPage(pageEntry.value)"
          >{{ pageEntry.value }}</button>
        </template>
        <button type="button" :disabled="safePage >= totalPages" aria-label="Go to next page" @click="goToPage(safePage + 1)">Next</button>
        <button type="button" :disabled="safePage >= totalPages" aria-label="Go to last page" @click="goToPage(totalPages)">Last</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  pageSizes: { type: Array, default: () => [10, 25, 50] },
  itemLabel: { type: String, default: 'records' },
  part: { type: String, default: 'bottom', validator: value => ['top', 'bottom'].includes(value) },
})

const emit = defineEmits(['update:page', 'update:pageSize'])
const availablePageSizes = computed(() => [...new Set([...props.pageSizes, props.pageSize])].sort((first, second) => first - second))
const totalPages = computed(() => Math.max(1, Math.ceil(Math.max(0, props.totalItems) / Math.max(1, props.pageSize))))
const safePage = computed(() => Math.min(Math.max(1, props.page), totalPages.value))
const rangeStart = computed(() => props.totalItems > 0 ? ((safePage.value - 1) * props.pageSize) + 1 : 0)
const rangeEnd = computed(() => Math.min(safePage.value * props.pageSize, props.totalItems))

const visiblePages = computed(() => {
  const count = totalPages.value
  if (count <= 7) return Array.from({ length: count }, (_, index) => ({ type: 'page', value: index + 1, key: `page-${index + 1}` }))

  const current = safePage.value
  const first = Math.max(2, current - 1)
  const last = Math.min(count - 1, current + 1)
  const entries = [{ type: 'page', value: 1, key: 'page-1' }]
  if (first > 2) entries.push({ type: 'ellipsis', key: 'ellipsis-start' })
  for (let value = first; value <= last; value += 1) entries.push({ type: 'page', value, key: `page-${value}` })
  if (last < count - 1) entries.push({ type: 'ellipsis', key: 'ellipsis-end' })
  entries.push({ type: 'page', value: count, key: `page-${count}` })
  return entries
})

const goToPage = page => emit('update:page', Math.min(Math.max(1, page), totalPages.value))
const updatePageSize = event => {
  const nextSize = Number(event.target.value)
  if (!Number.isFinite(nextSize) || nextSize < 1) return
  emit('update:page', 1)
  emit('update:pageSize', nextSize)
}

watch([() => props.totalItems, totalPages], () => {
  if (props.page !== safePage.value) emit('update:page', safePage.value)
}, { immediate: true })
</script>

<style scoped>
.table-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .75rem 1rem;
  color: var(--ac-text-muted, #795f4b);
  font-size: .82rem;
}

.table-pagination-top {
  min-height: 3.5rem;
  padding: .65rem 1rem;
  border-bottom: 1px solid var(--ac-border, #ead2b2);
}

.table-pagination-bottom {
  min-height: 3.5rem;
  padding: .65rem 1rem;
  border-top: 1px solid var(--ac-border, #ead2b2);
}

.table-pagination-summary,
.table-pagination-page-label { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.table-pagination-summary strong { color: var(--ac-text, #342419); font-weight: 700; }
.table-pagination-size { display: inline-flex; align-items: center; gap: .65rem; }
.table-pagination select,
.table-pagination-controls button {
  min-height: 2.35rem;
  border: 1px solid var(--ac-border, #ead2b2);
  border-radius: .65rem;
  background: var(--ac-surface, #fffdf9);
  color: var(--ac-text-secondary, #624733);
  font: inherit;
}
.table-pagination select { padding: .35rem .65rem; }
.table-pagination-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.table-pagination-controls button { padding: .35rem .65rem; font-weight: 600; cursor: pointer; }
.table-pagination :is(select, button):focus-visible { outline: 2px solid var(--ac-accent, #b9794f); outline-offset: 2px; }
.table-pagination-controls button:hover:not(:disabled) {
  border-color: var(--ac-border-strong, #cf9f78);
  background: var(--ac-surface-muted, #f8ead4);
  color: var(--ac-text, #342419);
}
.table-pagination-controls .table-pagination-number { min-width: 2.35rem; }
.table-pagination-controls .table-pagination-number.is-current,
.table-pagination-controls .table-pagination-number.is-current:hover {
  border-color: var(--ac-primary, #2d1b13);
  background: var(--ac-primary, #2d1b13);
  color: var(--ac-on-primary, #fffaf3);
}
.table-pagination-controls button:disabled { cursor: not-allowed; opacity: .45; }
.table-pagination-ellipsis { padding: 0 .15rem; }

@media (max-width: 640px) {
  .table-pagination-top { align-items: stretch; }
  .table-pagination-summary { flex: 1 1 100%; }
  .table-pagination-size { width: 100%; justify-content: space-between; }
  .table-pagination-bottom { align-items: flex-start; }
  .table-pagination-controls { width: 100%; }
  .table-pagination-controls button { flex: 1 1 auto; }
}
</style>
