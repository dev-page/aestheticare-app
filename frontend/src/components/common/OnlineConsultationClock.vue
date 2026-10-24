<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onlineWindow } from '../../../../shared/onlineConsultation.js'
const props = defineProps({ appointment: { type: Object, required: true } })
const now = ref(Date.now())
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
const active = computed(() => props.appointment.consultationMode === 'online' && props.appointment.status === 'Ongoing')
const remaining = computed(() => Math.max(0, Math.ceil((onlineWindow(props.appointment).end.getTime() - now.value) / 1000)))
const elapsed = computed(() => Math.max(0, Math.floor((now.value - onlineWindow(props.appointment).end.getTime()) / 1000)))
</script>
<template><div v-if="active" class="consultation-clock" role="status"><strong v-if="remaining">{{ Math.floor(remaining / 60) }}:{{ String(remaining % 60).padStart(2, '0') }} booked time remaining</strong><strong v-else>Continuing {{ Math.floor(elapsed / 60) }}:{{ String(elapsed % 60).padStart(2, '0') }} past booked time</strong><p v-if="remaining && remaining <= 60">One minute or less remains in the booked time.</p><p v-else-if="remaining > 60 && remaining <= 300">Five minutes or less remain in the booked time.</p><p v-else-if="!remaining">The call stays open. The practitioner will end the consultation when it is finished.</p></div></template>
<style scoped>.consultation-clock { margin-top: 8px; font-size: 12px; color: #785232; }.consultation-clock p { margin-top: 4px; color: #995728; }</style>
