<template>
  <section class="supply-flow-guide" aria-label="Supply ordering steps">
    <div class="supply-flow-heading">
      <div>
        <p class="supply-flow-eyebrow">ONE SUPPLY ORDER FLOW</p>
        <h2>From request to payment</h2>
      </div>
      <p class="supply-flow-current">{{ currentStep.label }} <span>· {{ currentStep.owner }}</span></p>
    </div>
    <ol class="supply-flow-steps">
      <li v-for="(step, index) in steps" :key="step.label" :class="{ 'is-current': index + 1 === activeStep, 'is-complete': index + 1 < activeStep }" :aria-current="index + 1 === activeStep ? 'step' : undefined">
        <span class="supply-flow-number">{{ index + 1 }}</span>
        <span class="supply-flow-copy"><strong>{{ step.label }}</strong><small>{{ step.owner }}</small></span>
      </li>
    </ol>
    <p class="supply-flow-note">The request, purchase order, delivery, and payment stay linked as one supply trail. The supplier quote and final payment are recorded here after they are handled externally.</p>
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
  { label: 'Approve & issue PO', owner: 'Finance · Procurement' },
  { label: 'Receive & add stock', owner: 'Inventory' },
  { label: 'Record invoice & payment', owner: 'Finance' },
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
  margin-top: 1.25rem;
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-radius-lg);
  background: var(--ac-surface);
  padding: 1rem;
  box-shadow: var(--ac-shadow-sm);
  color: var(--ac-text);
}
.supply-flow-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
.supply-flow-eyebrow { color:var(--ac-text-muted); font-size:.68rem; font-weight:800; letter-spacing:.15em; }
.supply-flow-heading h2 { margin-top:.12rem; color:var(--ac-text); font-family:var(--ac-font-display); font-size:1.2rem; font-weight:700; }
.supply-flow-current { flex:0 0 auto; border:1px solid var(--ac-border); border-radius:999px; background:var(--ac-surface-soft); padding:.4rem .7rem; color:var(--ac-text-secondary); font-size:.75rem; font-weight:700; }
.supply-flow-current span { color:var(--ac-text-muted); font-weight:500; }
.supply-flow-steps { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:.5rem; margin-top:.85rem; }
.supply-flow-steps li { display:flex; min-width:0; align-items:center; gap:.55rem; border:1px solid var(--ac-border); border-radius:.8rem; background:var(--ac-surface-soft); padding:.6rem; color:var(--ac-text-muted); }
.supply-flow-steps li.is-current { border-color:var(--ac-accent); background:var(--ac-accent-soft); color:var(--ac-text); }
.supply-flow-steps li.is-complete .supply-flow-number { background:var(--ac-success-bg); color:var(--ac-success); }
.supply-flow-number { display:grid; width:1.7rem; height:1.7rem; flex:0 0 auto; place-items:center; border-radius:50%; background:var(--ac-surface); color:var(--ac-text-secondary); font-size:.75rem; font-weight:800; }
.supply-flow-copy { display:block; min-width:0; }
.supply-flow-copy strong,.supply-flow-copy small { display:block; overflow-wrap:anywhere; }
.supply-flow-copy strong { color:var(--ac-text-secondary); font-size:.72rem; line-height:1.3; }
.supply-flow-steps li.is-current .supply-flow-copy strong { color:var(--ac-text); }
.supply-flow-copy small { margin-top:.15rem; color:var(--ac-text-muted); font-size:.65rem; }
.supply-flow-note { margin:.7rem 0 0; color:var(--ac-text-muted); font-size:.72rem; line-height:1.5; }
@media (max-width: 900px) { .supply-flow-steps { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width: 560px) {
  .supply-flow-heading { display:block; }
  .supply-flow-current { display:inline-block; margin-top:.55rem; }
  .supply-flow-steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .supply-flow-steps li { align-items:flex-start; }
  .supply-flow-copy strong { font-size:.68rem; }
}
</style>
