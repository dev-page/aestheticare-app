<template>
  <nav
    v-if="totalItems"
    class="flex flex-col gap-3 border-t border-slate-700 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    aria-label="Table pagination"
  >
    <p class="text-slate-400">
      Showing <span class="font-semibold text-slate-200">{{ rangeStart }}–{{ rangeEnd }}</span>
      of <span class="font-semibold text-slate-200">{{ totalItems }}</span>
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-slate-400">
        <span class="sr-only">Rows per page</span>
        <select :value="pageSize" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100" @change="$emit('update:pageSize', Number($event.target.value))">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} / page</option>
        </select>
      </label>
      <button type="button" class="pager-button" :disabled="page <= 1" @click="$emit('update:page', page - 1)">Previous</button>
      <span class="min-w-20 text-center text-slate-400">{{ page }} / {{ totalPages }}</span>
      <button type="button" class="pager-button" :disabled="page >= totalPages" @click="$emit('update:page', page + 1)">Next</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  pageSizes: { type: Array, default: () => [10, 25, 50] },
})

defineEmits(['update:page', 'update:pageSize'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))
const rangeStart = computed(() => props.totalItems ? ((props.page - 1) * props.pageSize) + 1 : 0)
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.totalItems))
</script>

<style scoped>
.pager-button {
  border: 1px solid #475569;
  border-radius: .375rem;
  padding: .3rem .65rem;
  color: #e2e8f0;
}
.pager-button:hover:not(:disabled) { background: #334155; }
.pager-button:disabled { cursor: not-allowed; opacity: .45; }
</style>
