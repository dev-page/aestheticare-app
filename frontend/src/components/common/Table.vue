<template>
  <div class="app-table-wrap overflow-x-auto" role="region" aria-label="Scrollable table" tabindex="0">
    <table class="app-table min-w-full">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in data" :key="index">
          <td
            v-for="column in columns"
            :key="column.key"
            class="px-6 py-4 whitespace-nowrap text-sm"
          >
            {{ row[column.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  columns: {
    type: Array,
    required: true
  },
  data: {
    type: Array,
    required: true
  }
})
</script>

<style scoped>
.app-table-wrap {
  min-width: 0;
  max-width: 100%;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
}

.app-table-wrap:focus-visible {
  outline: 2px solid var(--ac-accent, #b9794f);
  outline-offset: 2px;
}

.app-table {
  max-width: 100%;
}
</style>
