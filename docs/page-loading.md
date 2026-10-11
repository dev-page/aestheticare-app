# Page skeletons

Data pages use `usePageLoading()` and `v-page-loading`. The directive keeps the real
page mounted, preserving chart references, forms, and subscriptions. It temporarily
hides and disables the content while rendering a skeleton with the page's layout.
Sidebars and the branch/employee tab navigation remain available.

```vue
<script setup>
import { onMounted } from 'vue'
import { usePageLoading } from '@/composables/usePageLoading'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const loadRecords = trackPageLoad(async () => {
  // Fetch the page's records here, keeping its existing error handling.
})
onMounted(loadRecords)
</script>

<template>
  <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 5 }">
    <!-- Existing page content -->
  </main>
</template>
```

Wrap subscription registration with
`pageListener(onSnapshot, query, onResult, onError)` or
`pageListener(onAuthStateChanged, auth, onUser, onError)` to wait for the first
result, including asynchronous work inside the callback. Returned unsubscribe
functions still stop the original listeners. Failures and cancellation clear
pending loading. Tracking stops after the initial data load; live updates do not
cover the page or interrupt edits. Existing local refresh indicators still work.

Choose `table`, `form`, `profile`, `settings`, `list`, `chat`, `split`, `cards`,
`dashboard`, or `report`. Configure rows, columns, fields, sections, cards, and
panels to match the page. Cards support `catalog`, `plan`, and `stat` styles.
For mixed pages, supply `blocks`, for example:

```js
{ active: pageLoading, blocks: [
  { variant: 'form', fields: 4, sections: 1 },
  { variant: 'table', columns: 7, rows: 5 },
] }
```

Static pages and forms that need no initial remote data render immediately.
Container pages delegate loading to their tab content. Skeletons use the cream
palette, resize for mobile, announce loading to screen readers, and respect
reduced-motion preferences.

Coverage is recorded in `scripts/page-skeleton-coverage.json`. Validate changes:

```sh
node --test frontend/src/utils/pageLoadingState.test.js
node scripts/check-page-skeletons.mjs
npm run build
```
