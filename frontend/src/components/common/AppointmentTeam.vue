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
  <Modal :is-open="open" panel-class="appointment-team-modal" body-class="appointment-team-modal-body" :panel-style="{ maxWidth: '48rem', background: 'var(--ac-surface)', color: 'var(--ac-text)' }" @close="open = false">
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
        <div class="team-actions"><button v-if="canAssign" type="button" :disabled="busy || members.length >= 8" @click="members.push({ employeeId: '', responsibility: 'assistant' })">Add assistant</button><button v-if="canAssign" class="team-primary" type="button" :disabled="busy" @click="submit(false)">{{ busy ? 'Saving…' : 'Save team' }}</button><button v-if="canConfirm" class="team-primary" type="button" :disabled="busy" @click="submit(true)">{{ busy ? 'Saving…' : 'Confirm my participation' }}</button></div>
      </template>
    </section></template>
  </Modal>
</template>
<style scoped>
.team-button,.team-panel button{border:1px solid var(--ac-border-strong);border-radius:var(--ac-radius-sm);padding:9px 12px;background:var(--ac-surface);color:var(--ac-text-secondary);font-size:12px}
.team-button:hover,.team-panel button:hover:not(:disabled){background:var(--ac-surface-muted)}
.team-panel{color:var(--ac-text)}
.team-panel p{margin:10px 0;font-size:13px;line-height:1.6;color:var(--ac-text-secondary)}
.member-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;border:1px solid var(--ac-border);background:var(--ac-surface-soft);padding:12px;border-radius:var(--ac-radius-sm);margin:12px 0}
.member-row strong{color:var(--ac-text)}
.member-row :deep(.appearance-select){flex:1;min-width:min(100%,220px)}
.member-row span{font-size:12px;color:var(--ac-text-muted)}
.team-actions{display:flex;flex-wrap:wrap;gap:10px}
.team-panel button.team-primary{background:var(--ac-primary);border-color:var(--ac-primary);color:var(--ac-on-primary)}
.team-panel button:disabled{opacity:.58;cursor:not-allowed}
.team-panel .error{color:var(--ac-danger)}
:global(.appointment-team-modal){width:min(100%,48rem);max-height:min(90dvh,48rem);border:1px solid var(--ac-border)!important;border-radius:var(--ac-radius-lg)!important;box-shadow:var(--ac-shadow-lg)!important}
:global(.appointment-team-modal > div:first-child),:global(.appointment-team-modal > div:last-child){border-color:var(--ac-border)!important}
:global(.appointment-team-modal-body){padding:clamp(1rem,3vw,1.5rem)!important}
@media(max-width:600px){.member-row{align-items:stretch;flex-direction:column}.member-row :deep(.appearance-select){width:100%;min-width:0}.team-actions button{flex:1 1 100%}}
</style>
