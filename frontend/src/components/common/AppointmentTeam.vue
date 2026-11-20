<script setup>
import { computed } from 'vue'

const props = defineProps({ appointment: { type: Object, required: true } })
const leadPractitioner = computed(() => props.appointment.practitionerName
  || props.appointment.assignedPractitionerName
  || 'Assigned practitioner')
</script>

<template>
  <span class="lead-label">Lead practitioner: <strong>{{ leadPractitioner }}</strong></span>
</template>

<style scoped>
.lead-label{font-size:12px;color:var(--ac-text-muted)}
.lead-label strong{color:var(--ac-text-secondary);font-weight:600}
</style>
