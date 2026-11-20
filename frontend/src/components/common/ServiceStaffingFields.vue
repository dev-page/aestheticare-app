<script setup>
import { computed } from 'vue'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'
import { practitionerTypes } from '../../../../shared/practitionerTeam.js'
const props = defineProps({ model: { type: Object, required: true } })
const rows = computed(() => props.model.staffingRequirements || [])
const leadType = computed({
  get: () => rows.value.find(row => row?.responsibility === 'lead')?.type || '',
  set: type => { props.model.staffingRequirements = type ? [{ type, responsibility: 'lead', count: 1 }] : [] },
})
</script>
<template>
  <section class="staffing-fields">
    <h3>Lead practitioner</h3>
    <p>Each appointment has one assigned practitioner. For packages, that same practitioner handles every visit. Optionally limit bookings to one professional specialty.</p>
    <ContractAppearanceSelect id="staffing-lead-type" label="Required specialty (optional)" v-model="leadType" :options="[{ value: '', label: 'Any approved practitioner' }, ...practitionerTypes.map(type => ({ value: type, label: type }))]" />
  </section>
</template>
<style scoped>
.staffing-fields{border:1px solid #e6c6a7;border-radius:10px;padding:16px;margin:20px 0;background:#fffaf2;color:#493425}.staffing-fields h3{font-weight:600}.staffing-fields p{font-size:12px;line-height:1.6;margin:8px 0;color:#755e4d}
</style>
