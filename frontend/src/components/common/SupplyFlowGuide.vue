<template>
  <section class="supply-flow-guide" aria-label="Supply ordering workflow">
    <details>
      <summary>
        <span class="flow-step">SUPPLY FLOW <span aria-hidden="true">·</span> STEP {{ activeStep }} OF {{ steps.length }}</span>
        <span class="flow-current">{{ currentStep.label }} <small>· {{ currentStep.owner }}</small></span>
        <span class="flow-expand">View all steps <span class="flow-chevron" aria-hidden="true">⌄</span></span>
      </summary>
      <ol class="supply-flow-steps">
        <li v-for="(step, index) in steps" :key="step.label" :class="{ 'is-current': index + 1 === activeStep, 'is-complete': index + 1 < activeStep }" :aria-current="index + 1 === activeStep ? 'step' : undefined">
          <span class="supply-flow-number">{{ index + 1 }}</span>
          <span class="supply-flow-copy"><strong>{{ step.label }}</strong><small>{{ step.owner }}</small></span>
        </li>
      </ol>
      <p class="supply-flow-note">Each order stays linked from the original request through approval, delivery, invoice, and payment. Suppliers are contacted outside AesthetiCare; record the quote and payment here.</p>
    </details>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  department: { type: String, default: 'inventory' },
  page: { type: String, default: 'requests' },
})

const steps = [
  { label: 'Request supplies', owner: 'Inventory' },
  { label: 'Record quote', owner: 'Procurement' },
  { label: 'Approve and issue PO', owner: 'Finance · Procurement' },
  { label: 'Receive and add stock', owner: 'Inventory' },
  { label: 'Record invoice and payment', owner: 'Finance' },
]

const activeStep = computed(() => {
  if (props.department === 'inventory') return props.page === 'receiving' ? 4 : 1
  if (props.department === 'procurement') return props.page === 'orders' ? 3 : 2
  if (props.department === 'finance') return props.page === 'invoices' ? 5 : 3
  return 1
})

const currentStep = computed(() => steps[activeStep.value - 1])
</script>

<style scoped>
.supply-flow-guide {
  margin: 0 0 1.1rem;
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-radius-md);
  background: var(--ac-surface);
  box-shadow: var(--ac-shadow-sm);
  color: var(--ac-text);
}
.supply-flow-guide details { padding: .8rem 1rem; }
.supply-flow-guide summary {
  display: flex;
  align-items: center;
  gap: .8rem 1rem;
  cursor: pointer;
  list-style: none;
}
.supply-flow-guide summary::-webkit-details-marker { display: none; }
.flow-step { flex: 0 0 auto; color: var(--ac-text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .12em; }
.flow-current { min-width: 0; color: var(--ac-text); font-size: .9rem; font-weight: 700; }
.flow-current small { color: var(--ac-text-muted); font-size: .75rem; font-weight: 500; }
.flow-expand { display: inline-flex; align-items: center; gap: .35rem; margin-left: auto; color: var(--ac-text-secondary); font-size: .75rem; font-weight: 700; white-space: nowrap; }
.flow-chevron { color: var(--ac-accent); font-size: 1rem; transition: transform .15s ease; }
details[open] .flow-chevron { transform: rotate(180deg); }
.supply-flow-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .5rem; margin-top: .8rem; padding: 0; list-style: none; }
.supply-flow-steps li { display: flex; min-width: 0; align-items: center; gap: .5rem; border: 1px solid var(--ac-border); border-radius: .7rem; background: var(--ac-surface-soft); padding: .55rem; color: var(--ac-text-muted); }
.supply-flow-steps li.is-current { border-color: var(--ac-accent); background: var(--ac-accent-soft); color: var(--ac-text); }
.supply-flow-number { display: grid; width: 1.55rem; height: 1.55rem; flex: 0 0 auto; place-items: center; border-radius: 50%; background: var(--ac-surface); color: var(--ac-text-secondary); font-size: .72rem; font-weight: 800; }
.supply-flow-steps li.is-complete .supply-flow-number { background: var(--ac-success-bg); color: var(--ac-success); }
.supply-flow-copy { display: block; min-width: 0; }
.supply-flow-copy strong, .supply-flow-copy small { display: block; overflow-wrap: anywhere; }
.supply-flow-copy strong { color: var(--ac-text-secondary); font-size: .7rem; line-height: 1.3; }
.supply-flow-steps li.is-current .supply-flow-copy strong { color: var(--ac-text); }
.supply-flow-copy small { margin-top: .12rem; color: var(--ac-text-muted); font-size: .63rem; }
.supply-flow-note { margin: .65rem 0 0; color: var(--ac-text-muted); font-size: .72rem; line-height: 1.45; }
@media (max-width: 760px) {
  .supply-flow-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .supply-flow-guide details { padding: .75rem; }
  .supply-flow-guide summary { align-items: flex-start; flex-wrap: wrap; gap: .35rem .7rem; }
  .flow-step { width: auto; }
  .flow-current { order: 2; width: 100%; font-size: .85rem; }
  .flow-expand { margin-left: auto; }
  .supply-flow-steps { grid-template-columns: 1fr; }
}
</style>
