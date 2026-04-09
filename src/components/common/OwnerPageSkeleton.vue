<template>
  <div class="space-y-6">
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6">
      <div class="h-6 w-40 rounded bg-slate-700 animate-pulse"></div>
      <div class="mt-3 h-4 w-64 rounded bg-slate-700 animate-pulse"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="index in 6" :key="index" class="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div class="h-4 w-28 rounded bg-slate-700 animate-pulse"></div>
        <div class="mt-4 h-6 w-20 rounded bg-slate-700 animate-pulse"></div>
        <div class="mt-3 h-3 w-full rounded bg-slate-700 animate-pulse"></div>
      </div>
    </div>

    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6">
      <div class="h-4 w-48 rounded bg-slate-700 animate-pulse"></div>
      <div class="mt-4 space-y-3">
        <div v-for="row in 4" :key="row" class="h-4 w-full rounded bg-slate-700 animate-pulse"></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'OwnerPageSkeleton'
}
</script>
