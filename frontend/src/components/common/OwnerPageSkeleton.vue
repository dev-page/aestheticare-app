<script setup>
import PageSkeleton from './PageSkeleton.vue'
defineProps({
  variant: { type: String, default: 'table' },
  columns: { type: Number, default: 5 },
  rows: { type: Number, default: 5 },
  fields: { type: Number, default: 6 },
  sections: { type: Number, default: 2 },
  cards: { type: Number, default: 4 },
  header: { type: Boolean, default: false },
  cardStyle: { type: String, default: 'catalog' },
})
</script>
<template><PageSkeleton v-bind="$props" /></template>
