<script setup>
import { computed, ref } from 'vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { usePermissions } from '@/composables/usePermissions'
import Modal from './Modal.vue'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'
const props = defineProps({ appointment: { type: Object, required: true } })
const open = ref(false), busy = ref(false), error = ref(''), people = ref([]), current = ref(null), members = ref([])
const { hasPermission } = usePermissions()
const canAssign = computed(() => hasPermission('appointments:update') && !current.value?.startedAt && !['Completed', 'Cancelled', 'Rejected'].includes(current.value?.status))
const canConfirm = computed(() => current.value?.status === 'Ongoing' && members.value.some(member => member.employeeId === auth.currentUser?.uid && !member.participationConfirmed))
const request = async (path = '', body) => {
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(OTP_API_BASE + '/appointments/' + props.appointment.id + '/team' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to update treatment team.')
  return payload.data
}
const load = async () => {
  const data = await request(); current.value = data.appointment; people.value = data.people
  members.value = data.appointment.treatmentTeam?.length ? data.appointment.treatmentTeam.map(row => ({ ...row })) : [{ employeeId: data.appointment.practitionerId || data.appointment.assignedPractitionerId, responsibility: 'lead', name: data.appointment.practitionerName || 'Booked practitioner', participationConfirmed: false }]
}
const show = async () => { open.value = true; busy.value = true; error.value = ''; try { await load() } catch (cause) { error.value = cause.message } finally { busy.value = false } }
const submit = async (participation = false) => {
  busy.value = true; error.value = ''
  try { await request(participation ? '/participation' : '', participation ? {} : { members: members.value.map(row => ({ employeeId: row.employeeId, responsibility: row.responsibility })) }); await load() }
  catch (cause) { error.value = cause.message } finally { busy.value = false }
}
</script>
<template>
  <button type="button" class="team-button" @click="show">Treatment team</button>
  <Modal :is-open="open" :panel-style="{ maxWidth: '48rem', background: '#fffdf9', color: '#493425' }" @close="open = false">
    <template #header><h3>Treatment team</h3></template>
    <template #body><section class="team-panel">
      <p v-if="busy" role="status">Loading or saving team...</p><p v-if="error" role="alert" class="error">{{ error }}</p>
      <template v-if="current">
        <p>{{ current.service }} — {{ current.date }} {{ current.time }}</p>
        <p v-for="(rule, index) in current.staffingRequirements || []" :key="index">Required: {{ rule.count }} {{ rule.type }} ({{ rule.responsibility }})</p>
        <div v-for="(member, index) in members" :key="index" class="member-row">
          <template v-if="canAssign && member.responsibility !== 'lead'">
            <ContractAppearanceSelect :id="'team-member-' + appointment.id + index" label="Assistant" v-model="member.employeeId" :disabled="busy" :options="people.map(person => ({ value: person.id, label: person.name + ' (' + person.type + ')' }))" />
            <button type="button" :disabled="busy" @click="members.splice(index, 1)">Remove</button>
          </template>
          <template v-else><strong>{{ people.find(person => person.id === member.employeeId)?.name || member.name }}</strong><span>{{ member.type || people.find(person => person.id === member.employeeId)?.type || 'Specialty not configured' }} · {{ member.responsibility }}</span><span>{{ member.participationConfirmed ? 'Participation confirmed' : 'Awaiting participation' }}</span></template>
        </div>
        <p>Team assignments are locked when treatment starts. Each assistant confirms their own participation while the service is ongoing.</p>
        <div class="team-actions"><button v-if="canAssign" type="button" :disabled="busy || members.length >= 8" @click="members.push({ employeeId: '', responsibility: 'assistant' })">Add assistant</button><button v-if="canAssign" type="button" :disabled="busy" @click="submit(false)">Save team</button><button v-if="canConfirm" type="button" :disabled="busy" @click="submit(true)">Confirm my participation</button></div>
      </template>
    </section></template>
  </Modal>
</template>
<style scoped>
.team-button,.team-panel button{border:1px solid #dfbb99;border-radius:7px;padding:9px 12px;background:#fffaf2;color:#664329;font-size:12px}.team-panel{color:#493425}.team-panel p{margin:10px 0;font-size:13px;line-height:1.6}.member-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;border:1px solid #e6c6a7;padding:12px;border-radius:8px;margin:12px 0}.member-row :deep(.appearance-select){flex:1;min-width:200px}.member-row span{font-size:12px;color:#755e4d}.team-actions{display:flex;flex-wrap:wrap;gap:10px}.error{color:#ab3325}
</style>
