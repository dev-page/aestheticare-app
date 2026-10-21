<template>
  <section v-page-loading="{ active: pageLoading, variant: reviewer ? 'list' : 'form', fields: 7 }" class="verification-panel">
    <p class="eyebrow">Business verification</p><h1>{{ reviewer ? 'Supplier Verification' : 'Verify your supplier business' }}</h1>
    <p>Complete business verification to unlock your supplier catalog and clinic orders. Your documents are reviewed by an administrator before any clinic transactions are available.</p>
    <ol v-if="!reviewer" class="onboarding-steps" aria-label="Supplier onboarding steps"><li class="current"><span>1</span><div><strong>Business verification</strong><small>Business details and documents</small></div></li><li :class="{ current: ['Submitted', 'Under review', 'Verified'].includes(application?.verificationStatus) }"><span>2</span><div><strong>Administrator review</strong><small>Document review and decision</small></div></li><li :class="{ current: application?.verificationStatus === 'Verified' }"><span>3</span><div><strong>Supplier portal</strong><small>Catalog and clinic orders</small></div></li></ol>
    <p v-if="error" role="alert" class="error">{{ error }} <button type="button" @click="load">Retry</button></p>
    <template v-if="reviewer">
      <label class="filter">Application status<select v-model="filter"><option value="">All applications</option><option v-for="status in statuses" :key="status">{{ status }}</option></select></label>
      <p v-if="!filtered.length && !error">No applications match this status.</p>
      <article v-for="application in filtered" :key="application.id" class="card">
        <div class="row"><h2>{{ application.businessName || application.companyName || 'Supplier application' }}</h2><span class="badge">{{ application.verificationStatus }}</span></div>
        <p>{{ application.contactEmail || application.email }} · {{ application.contactPhone }}</p><p>{{ application.businessAddress }}</p>
        <p>Registration: {{ application.registrationNumber || 'Not submitted' }} · Tax number: {{ application.taxNumber || 'Not submitted' }}</p><p>Representative: {{ application.representativeName }}</p>
        <div class="documents"><button v-for="(document, kind) in application.documents" :key="kind" type="button" @click="openDocument(application.id, kind)">{{ labels[kind] || kind }}: {{ document.name }}</button></div>
        <p v-if="application.revisionReason">Review reason: {{ application.revisionReason }}</p>
        <label v-if="['Submitted', 'Under review', 'Verified'].includes(application.verificationStatus)">Review reason<textarea v-model="reasons[application.id]" rows="2" maxlength="2000" placeholder="Explain requested changes, rejection, or suspension" /></label>
        <div class="actions" v-if="['Submitted', 'Under review'].includes(application.verificationStatus)"><button :disabled="busy" @click="review(application, 'approve')">Approve</button><button :disabled="busy" @click="review(application, 'revise')">Request revisions</button><button :disabled="busy" @click="review(application, 'reject')">Reject</button></div>
        <button v-if="application.verificationStatus === 'Verified'" :disabled="busy" @click="review(application, 'suspend')">Suspend supplier</button>
        <button type="button" @click="loadHistory(application.id)">View review history</button>
        <ol v-if="histories[application.id]"><li v-for="entry in histories[application.id]" :key="entry.id">{{ entry.previousStatus }} → {{ entry.nextStatus }} · {{ entry.reason || entry.action }} · {{ entry.actorId }}</li></ol>
      </article>
    </template>
    <template v-else-if="application">
      <div class="card"><span class="badge">{{ application.verificationStatus }}</span><p v-if="application.revisionReason">{{ application.revisionReason }}</p><p v-if="application.verificationStatus === 'Verified'">Your supplier business is verified. Catalog and clinic order features are unlocked.</p><p v-else-if="['Submitted', 'Under review'].includes(application.verificationStatus)">Your documents are awaiting review. The supplier portal remains locked until approval. You can return here to see the decision.</p><p v-else-if="application.verificationStatus === 'Rejected'">Your application was rejected. Contact the administrator for more information or submit corrected details if resubmission is allowed.</p><RouterLink v-if="application.verificationStatus === 'Verified'" class="portal-link" to="/supplier/supplies">Continue to supplier portal</RouterLink></div>
      <form @submit.prevent="submit" class="card">
        <fieldset :disabled="locked || busy"><div class="fields"><label v-for="field in fields" :key="field.key">{{ field.label }}<input v-model.trim="form[field.key]" :type="field.type || 'text'" required maxlength="500" /></label></div>
          <div class="documents"><label v-for="kind in Object.keys(labels)" :key="kind">{{ labels[kind] }} {{ kind === 'distribution' ? '(optional)' : '(required)' }}<input type="file" accept="application/pdf,image/png,image/jpeg" @change="upload(kind, $event)" /><small>{{ application.documents?.[kind]?.name || 'PDF, PNG, or JPEG · up to 3 MB' }}</small></label></div>
          <button type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Submit for verification' }}</button>
        </fieldset>
      </form>
    </template>
    <a v-if="documentUrl" class="document-link" :href="documentUrl" target="_blank" rel="noopener">Open selected document (link expires in 5 minutes)</a>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { toast } from 'vue3-toastify'
const props = defineProps({ reviewer: Boolean })
const { pageLoading, trackPageLoad } = usePageLoading()
const application = ref(null), applications = ref([]), form = ref({}), filter = ref(''), reasons = ref({}), histories = ref({}), error = ref(''), busy = ref(false), documentUrl = ref('')
const statuses = ['Draft', 'Submitted', 'Under review', 'Needs revision', 'Rejected', 'Verified', 'Suspended']
const labels = { registration: 'Business registration', permit: 'Business permit / tax document', representative: 'Representative authorization', distribution: 'Distribution credentials' }
const fields = [{ key: 'businessName', label: 'Legal business name' }, { key: 'registrationNumber', label: 'Registration number' }, { key: 'taxNumber', label: 'Tax number' }, { key: 'businessAddress', label: 'Business address' }, { key: 'representativeName', label: 'Authorized representative' }, { key: 'contactEmail', label: 'Contact email', type: 'email' }, { key: 'contactPhone', label: 'Contact phone', type: 'tel' }]
const locked = computed(() => ['Submitted', 'Under review', 'Verified', 'Suspended'].includes(application.value?.verificationStatus))
const filtered = computed(() => applications.value.filter(a => !filter.value || a.verificationStatus === filter.value))
const api = async (path, body) => { const token = await auth.currentUser.getIdToken(); const response = await fetch(OTP_API_BASE + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || 'Unable to complete request.'); return result.data }
const load = trackPageLoad(async () => { error.value = ''; try { if (props.reviewer) applications.value = await api('/admin/supplier-verification'); else { application.value = await api('/supplier-verification/me'); form.value = Object.fromEntries(fields.map(field => [field.key, application.value[field.key] || (field.key === 'contactEmail' ? auth.currentUser.email : '')])) } } catch (e) { error.value = e.message } })
const upload = async (kind, event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { toast.error('Choose a file up to 3 MB.'); return } busy.value = true; try { const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file) }); const document = await api('/supplier-verification/documents', { kind, name: file.name, base64 }); application.value.documents = { ...application.value.documents, [kind]: document }; toast.success('Document uploaded.') } catch (e) { toast.error(e.message) } finally { busy.value = false; event.target.value = '' } }
const submit = async () => { busy.value = true; try { await api('/supplier-verification/submit', form.value); await load(); toast.success('Application submitted for review.') } catch (e) { error.value = e.message } finally { busy.value = false } }
const review = async (a, action) => { busy.value = true; try { await api(`/admin/supplier-verification/${encodeURIComponent(a.id)}/review`, { action, reason: reasons.value[a.id] || '' }); await load(); if (histories.value[a.id]) await loadHistory(a.id); toast.success('Review decision saved.') } catch (e) { toast.error(e.message) } finally { busy.value = false } }
const openDocument = async (id, kind) => { try { documentUrl.value = (await api(`/supplier-verification/${encodeURIComponent(id)}/documents/${encodeURIComponent(kind)}`)).url } catch (e) { toast.error(e.message) } }
const loadHistory = async id => { try { histories.value[id] = await api(`/admin/supplier-verification/${encodeURIComponent(id)}/history`) } catch (e) { toast.error(e.message) } }
onMounted(load)
</script>
<style scoped>
.verification-panel{max-width:960px;margin:auto;color:#3d281d}.eyebrow{font-size:.7rem;text-transform:uppercase;letter-spacing:.18em;color:#8d5a3b}h1{font:700 2rem Georgia,serif;margin:.5rem 0}h2{font:700 1.2rem Georgia,serif}p{margin:.6rem 0;line-height:1.6}.card{padding:1.4rem;margin-top:1.3rem;border:1px solid #e0c09a;border-radius:1.2rem;background:#fffaf3}.row,.actions{display:flex;gap:.75rem;justify-content:space-between;flex-wrap:wrap}.badge{background:#f7ead7;padding:.3rem .7rem;border-radius:1rem;font-size:.8rem}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}label{display:block;font-size:.85rem;margin:.75rem 0}input,select,textarea{display:block;width:100%;border:1px solid #d9be9b;border-radius:.65rem;padding:.65rem;background:#fff;color:#3d281d;margin-top:.4rem}button{border:1px solid #d9be9b;border-radius:.7rem;padding:.55rem .85rem;background:#f7ead7;color:#6f4a2d;margin:.3rem 0}button[type=submit]{background:#8d5a3b;color:#fff}.error{color:#a22a26;background:#fff0ed;padding:1rem;border-radius:.75rem}small{color:#775743}.document-link{display:block;margin:1rem 0;text-decoration:underline}fieldset{min-width:0;border:0;padding:0}button:disabled,fieldset:disabled{opacity:.6}.filter{max-width:300px}.onboarding-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;padding:0;margin:1.5rem 0;list-style:none}.onboarding-steps li{display:flex;align-items:center;gap:.7rem;padding:.8rem;border:1px solid #e0c09a;border-radius:.9rem;background:#fffaf3;color:#8a7567}.onboarding-steps li.current{border-color:#a8714d;background:#f7ead7;color:#573923}.onboarding-steps li>span{display:grid;place-items:center;flex:0 0 2rem;height:2rem;border-radius:50%;background:#ead3b8;font-weight:700}.onboarding-steps strong,.onboarding-steps small{display:block}.onboarding-steps strong{font-size:.8rem}.onboarding-steps small{font-size:.68rem}.portal-link{display:inline-block;margin-top:.5rem;color:#8d5a3b;font-weight:700;text-decoration:underline}@media(max-width:640px){.fields{grid-template-columns:1fr}.onboarding-steps{grid-template-columns:1fr}.onboarding-steps li{padding:.65rem}h1{font-size:1.5rem}.card{padding:1rem}}
</style>
