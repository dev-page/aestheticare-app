<script setup>
import { reactive, ref, watch } from 'vue'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import { compensationApi } from '@/utils/compensationApi'
import ContractAppearanceSelect from './ContractAppearanceSelect.vue'
import { practitionerTypes } from '../../../../shared/practitionerTeam.js'
const props = defineProps({ employeeId: { type: String, required: true }, branchId: String })
const form = reactive({ type: 'Aesthetician', credentialNumber: '', credentialsVerified: false, approvedServiceIds: [], rates: [] })
const services = ref([]), busy = ref(false), error = ref(''), notice = ref(''), allowed = ref(false)
const api = async (method, body) => {
  return compensationApi('/practitioner-profiles/' + encodeURIComponent(props.employeeId), method, body)
}
watch(() => props.employeeId, async () => {
  error.value = ''; notice.value = ''; allowed.value = false; busy.value = true
  try {
    Object.assign(form, { type: 'Aesthetician', credentialNumber: '', credentialsVerified: false, approvedServiceIds: [], rates: [] }, await api('GET') || {})
    const employee = (await getDoc(doc(db, 'users', props.employeeId))).data() || {}
    const ids = [...new Set([employee.branchId, ...(employee.branchIds || []), props.branchId].filter(Boolean))]
    const listings = await Promise.all(ids.map(id => getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', id)))))
    services.value = listings.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))).filter(item => item.postType !== 'Product' && !item.archived)
    allowed.value = true
  } catch (cause) { error.value = cause.message } finally { busy.value = false }
}, { immediate: true })
const addRate = () => form.rates.push({ serviceId: '', responsibility: 'lead', model: 'percent', amount: 0, effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: '' })
const save = async () => {
  busy.value = true; error.value = ''; notice.value = ''
  try { await api('POST', form); notice.value = 'Practitioner profile and compensation agreements saved.' }
  catch (cause) { error.value = cause.message } finally { busy.value = false }
}
</script>
<template>
  <section class="practitioner-editor">
    <h3>Practitioner specialty &amp; compensation</h3>
    <p>System roles control access. This profile controls clinical eligibility and individual service earnings.</p>
    <p v-if="busy" role="status">Loading or saving profile...</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <fieldset v-if="allowed" :disabled="busy">
      <ContractAppearanceSelect :id="'specialty-' + employeeId" label="Professional type" v-model="form.type" :options="practitionerTypes.map(type => ({ value: type, label: type }))" />
      <label>Credential / license number<input v-model="form.credentialNumber" maxlength="100" /></label>
      <label class="check"><input v-model="form.credentialsVerified" type="checkbox" /> Credentials reviewed by clinic owner</label>
      <p>Verification records the clinic’s review; it does not verify a license automatically.</p>
      <h4>Approved services</h4>
      <label v-for="service in services" :key="service.id" class="check"><input type="checkbox" v-model="form.approvedServiceIds" :value="service.id" /> {{ service.title || service.serviceName || service.consultationName }}</label>
      <p v-if="!services.length">Create a service listing first, then approve it here.</p>
      <h4>Service earnings agreements</h4>
      <p>Rates apply per person per completed session. Percentages use the session’s allocated service price. Base pay and platform fees are separate. Leave a 0 rate for unpaid assistance.</p>
      <div v-for="(rate, index) in form.rates" :key="index" class="rate-grid">
        <ContractAppearanceSelect :id="'rate-service-' + employeeId + index" label="Service" v-model="rate.serviceId" :options="[{ value: '', label: 'All approved services' }, ...services.map(item => ({ value: item.id, label: item.title || item.serviceName || item.consultationName }))]" />
        <ContractAppearanceSelect :id="'rate-role-' + employeeId + index" label="Responsibility" v-model="rate.responsibility" :options="[{ value: 'lead', label: 'Lead' }, { value: 'assistant', label: 'Assistant' }]" />
        <ContractAppearanceSelect :id="'rate-model-' + employeeId + index" label="Model" v-model="rate.model" :options="[{ value: 'percent', label: 'Percentage' }, { value: 'fixed', label: 'Fixed fee (PHP)' }]" />
        <label>Rate<input v-model.number="rate.amount" type="number" min="0" :max="rate.model === 'percent' ? 100 : undefined" step="0.01" /></label>
        <label>Effective from<input v-model="rate.effectiveFrom" type="date" /></label><label>Effective until (optional)<input v-model="rate.effectiveUntil" type="date" /></label>
        <button type="button" @click="form.rates.splice(index, 1)">Remove agreement</button>
      </div>
      <div class="buttons"><button type="button" @click="addRate">Add agreement</button><button type="button" @click="save" :disabled="busy">Save practitioner profile</button></div>
    </fieldset>
  </section>
</template>
<style scoped>
.practitioner-editor{padding:18px;border:1px solid #e6c6a7;border-radius:12px;background:#fffaf2;color:#493425;margin:16px 0}.practitioner-editor h3,.practitioner-editor h4{font-weight:600;margin:8px 0}.practitioner-editor p{font-size:12px;line-height:1.6;margin:8px 0;color:#755e4d}.practitioner-editor fieldset{border:0;padding:0;min-width:0}.practitioner-editor label{display:block;font-size:12px;margin:10px 0}.practitioner-editor input:not([type=checkbox]){display:block;width:100%;padding:10px;border:1px solid #dfbb99;border-radius:7px;background:#fff;color:#493425;color-scheme:light}.practitioner-editor .check{display:flex;gap:8px;align-items:center}.rate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border:1px solid #e6c6a7;border-radius:8px;margin:12px 0}.buttons{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.practitioner-editor button{padding:9px 12px;border:1px solid #dfbb99;border-radius:7px;background:#f5e8d6;color:#664329}.practitioner-editor .error{color:#ab3325}@media(max-width:600px){.rate-grid{grid-template-columns:1fr}}
</style>
