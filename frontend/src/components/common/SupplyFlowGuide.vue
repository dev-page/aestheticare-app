<template>
  <section class="supply-flow-guide" aria-labelledby="supply-flow-title">
    <div class="supply-flow-heading">
      <div>
        <p class="supply-flow-eyebrow">SUPPLY ORDERING</p>
        <h2 id="supply-flow-title">From request to delivery</h2>
      </div>
      <p class="supply-flow-intro">Four steps keep the order and stock record in sync.</p>
    </div>
    <ol class="supply-flow-steps">
      <li v-for="(step, index) in steps" :key="step.title">
        <span class="supply-flow-number">{{ index + 1 }}</span>
        <div>
          <strong>{{ step.title }}</strong>
          <p>{{ step.description }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
const steps = [
  { title: 'Inventory requests supplies', description: 'List the items, quantities, delivery branch, and date needed.' },
  { title: 'Procurement prepares the order', description: 'Choose a clinic supplier and record the invoice and item prices.' },
  { title: 'Finance approves the order', description: 'After approval, Procurement sends the purchase order to the supplier.' },
  { title: 'Inventory records delivery', description: 'Inspect the delivery and receipt; accepted quantities are added to stock. Finance records payment.' },
]
</script>

<style scoped>
.supply-flow-guide { margin: 0 0 1.1rem; border: 1px solid var(--ac-border); border-radius: var(--ac-radius-md); background: var(--ac-surface); box-shadow: var(--ac-shadow-sm); color: var(--ac-text); padding: 1rem; }
.supply-flow-heading { display: flex; align-items: end; justify-content: space-between; gap: .6rem 1.5rem; flex-wrap: wrap; }
.supply-flow-eyebrow { margin: 0 0 .25rem; color: var(--ac-text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .12em; }
.supply-flow-heading h2 { margin: 0; color: var(--ac-text); font-size: 1rem; font-weight: 700; }
.supply-flow-intro { margin: 0; color: var(--ac-text-muted); font-size: .75rem; }
.supply-flow-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .6rem; margin: .85rem 0 0; padding: 0; list-style: none; }
.supply-flow-steps li { display: flex; min-width: 0; align-items: flex-start; gap: .6rem; border: 1px solid var(--ac-border); border-radius: .7rem; background: var(--ac-surface-soft); padding: .7rem; }
.supply-flow-number { display: grid; width: 1.5rem; height: 1.5rem; flex: 0 0 auto; place-items: center; border-radius: 50%; background: var(--ac-surface); color: var(--ac-text-secondary); font-size: .72rem; font-weight: 800; }
.supply-flow-steps strong { display: block; color: var(--ac-text); font-size: .76rem; line-height: 1.35; }
.supply-flow-steps p { margin: .2rem 0 0; color: var(--ac-text-muted); font-size: .7rem; line-height: 1.45; }
@media (max-width: 1080px) { .supply-flow-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .supply-flow-guide { padding: .8rem; } .supply-flow-steps { grid-template-columns: minmax(0, 1fr); } }
</style>
