<script setup>
import PageSkeleton from './PageSkeleton.vue'
defineProps({
  variant: { type: String, default: 'dashboard' },
  cards: { type: Number, default: 4 },
  panels: { type: Number, default: 2 },
  fields: { type: Number, default: 6 },
  sections: { type: Number, default: 2 },
  header: { type: Boolean, default: true },
})
</script>
<template><PageSkeleton v-bind="$props" /></template>
