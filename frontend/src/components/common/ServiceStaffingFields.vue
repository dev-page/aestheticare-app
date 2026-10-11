<script setup>
import { computed } from 'vue'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'
import { practitionerTypes } from '../../../../shared/practitionerTeam.js'
const props = defineProps({ model: { type: Object, required: true } })
const rows = computed(() => props.model.staffingRequirements || [])
const add = () => { props.model.staffingRequirements = [...rows.value, { type: 'Aesthetician', responsibility: rows.value.length ? 'assistant' : 'lead', count: 1 }] }
</script>
<template>
  <section class="staffing-fields">
    <h3>Treatment team requirements</h3><p>Set one lead and any required assistants. Staff must be approved for this service. The clinic assigns the team before treatment starts. Packages use each component service’s requirements.</p>
    <div v-for="(row, index) in rows" :key="index" class="staffing-row">
      <ContractAppearanceSelect :id="'staffing-type-' + index" label="Specialty" v-model="row.type" :options="practitionerTypes.map(type => ({ value: type, label: type }))" />
      <ContractAppearanceSelect :id="'staffing-role-' + index" label="Responsibility" v-model="row.responsibility" :options="[{ value: 'lead', label: 'Lead' }, { value: 'assistant', label: 'Assistant' }]" />
      <label>Number required<input v-model.number="row.count" type="number" min="1" :max="row.responsibility === 'lead' ? 1 : 8" /></label>
      <button type="button" @click="model.staffingRequirements.splice(index, 1)">Remove</button>
    </div>
    <button type="button" @click="add" :disabled="rows.length >= 8">Add staffing requirement</button>
    <p v-if="!rows.length">No specialty restriction. Existing listings continue using their booked lead practitioner.</p>
  </section>
</template>
<style scoped>
.staffing-fields{border:1px solid #e6c6a7;border-radius:10px;padding:16px;margin:20px 0;background:#fffaf2;color:#493425}.staffing-fields h3{font-weight:600}.staffing-fields p{font-size:12px;line-height:1.6;margin:8px 0;color:#755e4d}.staffing-row{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:12px;align-items:end;margin:14px 0}.staffing-row label{font-size:12px}.staffing-row input{display:block;width:100%;padding:10px;border:1px solid #dfbb99;border-radius:7px;background:#fff;color:#493425}.staffing-fields button{padding:9px 12px;border:1px solid #dfbb99;border-radius:7px;background:#f5e8d6;color:#664329}@media(max-width:700px){.staffing-row{grid-template-columns:1fr}}
</style>
