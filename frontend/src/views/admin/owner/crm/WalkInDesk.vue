<template>
  <div class="walk-in-desk owner-theme flex min-h-screen">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'form', fields: 4, sections: 2 }" class="flex-1 min-w-0 p-4 md:p-8">
      <div class="walk-in-content">
        <header class="page-heading"><div><p class="eyebrow">CRM &amp; Clinic</p><h1>Walk-In Desk</h1><p class="muted">Book services for one walk-in client. Each service has its own appointment date and service code.</p></div><RouterLink to="/crm/appointments" class="desk-button secondary">View appointments</RouterLink></header>
        <p v-if="error" class="desk-alert error" role="alert">{{ error }}</p>
        <template v-if="!createdAppointments.length">
          <section class="desk-card">
            <div class="section-heading"><div><p class="eyebrow">Step 1</p><h2>Client information</h2></div><button type="button" class="desk-button secondary" :disabled="busy" @click="openRegistration()">Register a client</button></div>
            <ContractAppearanceSelect id="walk-in-client" v-model="selectedClientId" label="Client" :disabled="busy" :options="clientOptions" />
            <p class="muted small">The client's service code is sent to their email after payment. Confirm their contact details before booking.</p>
            <label class="desk-checkbox summary-acknowledgement"><input v-model="bookingForSomeoneElse" type="checkbox" :disabled="busy" /> Booking for someone else</label>
            <div v-if="bookingForSomeoneElse" class="field-grid">
              <div><label for="booker-name" class="field-label">Booking arranger's name</label><input id="booker-name" v-model.trim="booker.name" class="desk-input" maxlength="150" :disabled="busy" /></div>
              <div><label for="booker-phone" class="field-label">Booking arranger's contact number</label><input id="booker-phone" v-model.trim="booker.phone" class="desk-input" type="tel" maxlength="25" :disabled="busy" /></div>
              <div><label for="booker-email" class="field-label">Booking arranger's email (optional)</label><input id="booker-email" v-model.trim="booker.email" class="desk-input" type="email" maxlength="254" :disabled="busy" /></div>
            </div>
            <p v-if="bookingForSomeoneElse" class="muted small">Keep the selected client as the person receiving treatment. The booking arranger signs only the booking and payment terms.</p>
          </section>
          <section class="desk-card">
            <div class="section-heading"><div><p class="eyebrow">Step 2</p><h2>Service schedules</h2><p class="muted small">Choose one lead practitioner per service. Additional services require different dates.</p><p class="muted small">Assign required support staff through Treatment team in Appointment Management before treatment starts.</p></div></div>
            <p v-if="!selectedClientId" class="empty-note">Choose a client to start scheduling.</p>
            <article v-if="selectedClientId" class="client-card">
              <div class="client-heading"><h3>{{ clientFor(selectedClientId)?.fullName || 'Selected client' }}</h3></div>
              <p v-if="clientFor(selectedClientId)" class="client-contact">{{ clientFor(selectedClientId).email || 'Email missing — update this client first' }} <span>·</span> {{ clientFor(selectedClientId).phone || clientFor(selectedClientId).contactNumber || 'No contact number' }}</p>
              <section v-for="(visit, visitIndex) in visits" :key="visit.key" class="visit-card">
                <div class="visit-heading"><h4>Service {{ visitIndex + 1 }}</h4><button v-if="visits.length > 1" type="button" class="text-button" :disabled="busy" @click="removeVisit(visit.key)">Remove service</button></div>
                <div class="field-grid"><ContractAppearanceSelect :id="`service-${visit.key}`" v-model="visit.serviceId" label="Service, consultation, or package" :disabled="busy" :options="serviceOptions" @update:model-value="clearSchedule(visit)" /><ContractAppearanceSelect :id="`practitioner-${visit.key}`" v-model="visit.practitionerId" label="Lead practitioner" :disabled="busy" :options="practitionerOptions" @update:model-value="clearSchedule(visit)" /></div>
                <div class="schedule-grid">
                  <div><label class="field-label">Appointment date</label><AppointmentCalendar v-model="visit.date" :min-date="today" :disabled="busy || !availabilityReady || !selectedClientId || !visit.serviceId || !visit.practitionerId" :is-available="date => availableSlots(visit, date).length > 0" @update:model-value="visit.time = ''" /></div>
                  <div class="schedule-details"><ContractAppearanceSelect :id="`time-${visit.key}`" v-model="visit.time" label="Available time" :disabled="busy || !visit.date" :options="[{ value: '', label: visit.date ? 'Select available time' : 'Choose a date first' }, ...availableSlots(visit)]" /><p v-if="visit.date" class="selected-date">{{ dateLabel(visit.date) }}</p><p v-if="visit.date && !availableSlots(visit).length" class="field-error">This date no longer has a suitable slot. Choose another date.</p><div v-if="serviceFor(visit.serviceId)" class="service-summary"><p class="muted small">Service price</p><strong>{{ currency(serviceFor(visit.serviceId).price) }}</strong><p class="muted small">{{ serviceFor(visit.serviceId).durationMinutes }} minutes for the first visit · {{ serviceFor(visit.serviceId).totalSessions || 1 }} session(s)</p><p v-if="serviceFor(visit.serviceId).requiresConsultationFirst" class="small">Requires completed consultation or approved clearance before booking.</p></div><label :for="`notes-${visit.key}`" class="field-label">Notes <span class="muted">(optional)</span></label><textarea :id="`notes-${visit.key}`" v-model.trim="visit.notes" :disabled="busy" maxlength="2000" rows="3" class="desk-input" placeholder="Notes for this appointment" /></div>
                </div>
              </section>
              <button type="button" class="desk-button secondary" :disabled="busy || flatVisits.length >= 20" @click="visits.push(newVisit())">+ Add another service</button>
            </article>
          </section>
          <section class="desk-card booking-summary">
            <div><p class="eyebrow">Review booking</p><h2>{{ flatVisits.length }} appointment{{ flatVisits.length === 1 ? '' : 's' }}</h2><p class="muted small">One client · Full payment is collected per appointment.</p></div><strong class="total-price">{{ estimatedTotal }}</strong>
            <details v-if="policy.clientContract?.configured" class="contract-preview"><summary>Review the clinic agreement</summary><ClientContractDocument :document="contractPreview" /></details>
            <ClientContractDocument :document="bookingTermsPreview" />
            <p class="muted small">Booking signer: <strong>{{ bookingForSomeoneElse ? booker.name || 'Enter the arranger name above' : clientFor(selectedClientId)?.fullName || 'Select the client above' }}</strong>. Hand the device to this person. The service recipient signs the separate treatment agreement after payment, before check-in.</p>
            <ElectronicSignaturePad v-model="bookingSignature" label="Booking arranger signature — booking and payment terms only" />
            <label class="desk-checkbox summary-acknowledgement"><input v-model="policyAcknowledged" type="checkbox" :disabled="busy" /> I accept the displayed booking prices, schedules, and booking terms, and confirm this is my signature. This does not authorize treatment for someone else.</label>
            <button type="button" class="desk-button primary" :disabled="busy || !availabilityReady || !selectedClientId || !flatVisits.length || !policyAcknowledged || !bookingSignature" @click="createAppointments">{{ busy ? 'Creating appointments…' : 'Create walk-in appointments' }}</button>
          </section>
        </template>
        <section v-else class="desk-card">
          <div class="section-heading"><div><p class="eyebrow">Step 3</p><h2>Appointments &amp; payments</h2><p class="muted small">Booking confirmed. Collect payment for each appointment; the client receives a separate service code for each service.</p></div><button type="button" class="desk-button secondary" :disabled="busy" @click="startNewBooking">New booking</button></div>
          <article v-for="appointment in createdAppointments" :key="appointment.id" class="payment-card">
            <div class="section-heading"><div><h3>{{ appointment.clientName || appointment.customerName }}</h3><p>{{ appointment.service }}</p><p class="muted small">{{ dateLabel(appointment.date) }} · {{ formatClockTime(appointment.time) }} · {{ appointment.practitionerName }}</p><p class="muted small">{{ appointment.customerEmail }}</p></div><strong>{{ currency(appointment.totalAmount ?? appointment.amount) }}</strong></div>
            <p class="muted small">Arranged by {{ appointment.bookedByName }} · Booking terms signed. Treatment agreement: {{ appointment.contract?.status === 'signed' ? 'Signed by recipient' : 'Awaiting recipient signature' }}.</p>
            <div v-if="!receipts[appointment.id] && appointment.paymentStatus !== 'Paid'" class="payment-form"><div><label :for="`cash-${appointment.id}`" class="field-label">Cash received</label><input :id="`cash-${appointment.id}`" v-model.number="cashReceived[appointment.id]" type="number" min="0" step="0.01" class="desk-input" :disabled="busy" placeholder="0.00" /></div><button type="button" class="desk-button primary" :disabled="busy" @click="collectPayment(appointment)">Record cash payment</button></div>
            <div v-else class="payment-success"><p>Payment recorded<span v-if="receipts[appointment.id]"> · Change: {{ currency(receipts[appointment.id].change) }}</span></p><template v-if="receipts[appointment.id]"><p>Service code: <strong>{{ receipts[appointment.id].serviceKey }}</strong></p><p class="small">{{ receipts[appointment.id].emailSent ? 'Service code emailed to the client.' : 'Email delivery was not confirmed. Give the client their receipt and service code.' }}</p><button type="button" class="desk-button secondary" @click="printReceipt(receipts[appointment.id])">Print receipt</button></template></div>
            <button type="button" class="desk-button secondary agreement-button" :disabled="busy" @click="contractTarget = appointment">{{ appointment.paymentStatus === 'Paid' && appointment.contract?.status !== 'signed' ? 'Sign client agreement' : 'View client agreement' }}</button>
          </article>
          <p class="muted small">This desk records cash payments. Card and GCash payments require the clinic’s verified checkout flow. Review contracts and check in the client in <RouterLink to="/crm/appointments">Appointment Management</RouterLink>.</p>
        </section>
      </div>
    </main>
    <BookingContractModal :visible="Boolean(contractTarget)" :appointment="contractTarget" :read-only="contractTarget?.paymentStatus !== 'Paid'" @close="contractTarget = null" @updated="updateContract" />
    <Modal :is-open="showRegistration" panel-class="walk-in-registration-modal" :panel-style="{ backgroundColor: '#fffdf9', color: '#493225', maxWidth: '560px' }" @close="!busy && (showRegistration = false)">
      <template #header><h2 class="registration-title">Register walk-in client</h2></template>
      <template #body><p class="muted small">Create a client record for this person. An email and contact number are needed for their booking and service code.</p><p v-if="registrationError" class="field-error" role="alert">{{ registrationError }}</p><form id="register-walk-in-client" class="registration-form" @submit.prevent="createClient"><div class="field-grid"><div><label for="walk-in-first-name" class="field-label">First name</label><input id="walk-in-first-name" v-model.trim="newClient.firstName" required maxlength="100" class="desk-input" :disabled="busy" /></div><div><label for="walk-in-last-name" class="field-label">Last name</label><input id="walk-in-last-name" v-model.trim="newClient.lastName" required maxlength="100" class="desk-input" :disabled="busy" /></div></div><div><label for="walk-in-email" class="field-label">Email address</label><input id="walk-in-email" v-model.trim="newClient.email" type="email" required class="desk-input" :disabled="busy" /></div><div><label for="walk-in-phone" class="field-label">Contact number</label><div class="phone-input"><span>+63</span><input id="walk-in-phone" v-model="newClient.phone" inputmode="numeric" maxlength="10" pattern="9[0-9]{9}" required placeholder="9XXXXXXXXX" :disabled="busy" @input="normalizePhone" /></div></div></form></template>
      <template #footer><div class="registration-actions"><button type="button" class="desk-button secondary" :disabled="busy" @click="showRegistration = false">Cancel</button><button type="submit" form="register-walk-in-client" class="desk-button primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save client' }}</button></div></template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import AppointmentCalendar from '@/components/common/AppointmentCalendar.vue'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import Modal from '@/components/common/Modal.vue'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ElectronicSignaturePad from '@/components/common/ElectronicSignaturePad.vue'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { buildWeekScheduleMap } from '@/utils/employeeSchedules'
import { manilaDate, walkInSlots } from '@/utils/walkInScheduling'
import { formatClockTime } from '@/utils/appointmentDss'
import { buildClientContractDocument, buildBookingTermsDocument } from '../../../../../../shared/clientContract.js'

const { pageLoading, trackPageLoad } = usePageLoading()
const branchId = ref(''), busy = ref(false), error = ref(''), clients = ref([]), services = ref([]), practitioners = ref([])
const schedules = ref({}), leaves = ref({}), existingAppointments = ref([]), branch = ref({}), policy = ref({})
const selectedClientId = ref(''), visits = ref([]), policyAcknowledged = ref(false)
const bookingForSomeoneElse = ref(false), booker = ref({ name: '', email: '', phone: '' }), bookingSignature = ref('')
const createdAppointments = ref([]), receipts = ref({}), cashReceived = ref({}), contractTarget = ref(null)
const showRegistration = ref(false), registrationError = ref('')
const emptyClient = () => ({ firstName: '', lastName: '', email: '', phone: '' })
const newClient = ref(emptyClient()), now = ref(Date.now())
const availabilityReady = ref(false)
let apiBase = OTP_BACKEND_CANDIDATES[0], clockTimer, submissionId = crypto.randomUUID()
const today = computed(() => manilaDate(now.value))
const newVisit = () => ({ key: crypto.randomUUID(), serviceId: '', practitionerId: '', date: '', time: '', notes: '' })
const clientFor = id => clients.value.find(client => client.id === id)
const serviceFor = id => services.value.find(service => service.id === id)
const currency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const dateLabel = date => date ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(`${date}T00:00:00+08:00`)) : 'Date not selected'
const clientOptions = computed(() => [{ value: '', label: 'Select a registered client' }, ...clients.value.map(client => ({ value: client.id, label: `${client.fullName} · ${client.email || 'No email'}` }))])
const serviceOptions = computed(() => [{ value: '', label: 'Select an offering' }, ...services.value.map(service => ({ value: service.id, label: `${service.name} · ${currency(service.price)}` }))])
const practitionerOptions = computed(() => [{ value: '', label: 'Select a practitioner' }, ...practitioners.value.map(person => ({ value: person.id, label: person.fullName }))])
const flatVisits = computed(() => visits.value.map(visit => ({ ...visit, clientId: selectedClientId.value })))
const estimatedTotal = computed(() => currency(flatVisits.value.reduce((sum, row) => sum + Number(serviceFor(row.serviceId)?.price || 0), 0)))
const contractPreview = computed(() => buildClientContractDocument(policy.value, { branch: branch.value, source: 'walk_in' }))
const bookingTermsPreview = computed(() => buildBookingTermsDocument(policy.value, { branch: branch.value, source: 'walk_in' }))
watch([bookingForSomeoneElse, booker, policy], () => { policyAcknowledged.value = false; bookingSignature.value = '' }, { deep: true })
const availableSlots = (visit, date = visit.date) => walkInSlots({ row: { ...visit, clientId: selectedClientId.value }, date, rows: flatVisits.value, clients: clients.value, services: services.value, schedules: schedules.value, appointments: existingAppointments.value, leaves: leaves.value, now: now.value })
const clearSchedule = visit => { visit.date = ''; visit.time = '' }
const removeVisit = key => { visits.value = visits.value.filter(visit => visit.key !== key) }
watch(selectedClientId, () => {
  if (!visits.value.length && selectedClientId.value) visits.value = [newVisit()]
  else visits.value.forEach(clearSchedule)
})
watch(flatVisits, (next, previous = []) => {
  if (busy.value || createdAppointments.value.length) return
  for (const visit of visits.value) {
    const before = previous.find(row => row.key === visit.key)
    if (before && before.clientId !== selectedClientId.value) clearSchedule(visit)
    else if (visit.time && !availableSlots(visit).some(slot => slot.value === visit.time)) visit.time = ''
  }
  policyAcknowledged.value = false
  bookingSignature.value = ''
})

async function api(path, body) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw Error('Sign in to continue.')
  const targets = body ? [apiBase] : [...new Set([apiBase, ...OTP_BACKEND_CANDIDATES])]
  let lastError
  for (const base of targets) {
    try {
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('The Walk-In backend is unavailable or outdated. Restart or deploy the updated backend.')
      const payload = await response.json()
      if (!response.ok || payload.success === false) {
        const failure = Error(payload.error || 'Unable to complete this request.')
        failure.retryable = response.status === 404 || response.status >= 500
        throw failure
      }
      apiBase = base
      return payload.data || payload
    } catch (cause) { lastError = cause; if (body || cause.retryable === false) throw cause }
  }
  throw lastError
}
async function load() {
  const user = auth.currentUser
  if (!user) return
  const profile = await getDoc(doc(db, 'users', user.uid))
  branchId.value = String(profile.data()?.branchId || '')
  if (!branchId.value) throw Error('Your account has no branch assignment.')
  const [clinicSnap, clientRows, serviceRows, availability] = await Promise.all([
    getDoc(doc(db, 'clinics', branchId.value)),
    getDocs(query(collection(db, 'clients'), where('branchId', '==', branchId.value))),
    getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId.value))),
    api(`/public/clinics/${encodeURIComponent(branchId.value)}/practitioners`)
  ])
  branch.value = clinicSnap.data() || {}
  clients.value = clientRows.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })).filter(client => !['inactive', 'archived'].includes(String(client.status || '').toLowerCase()))
  const catalogue = serviceRows.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
  services.value = catalogue.filter(service => ['service', 'consultation', 'package'].includes(String(service.postType || '').toLowerCase()) && !(String(service.postType || '').toLowerCase() === 'consultation' && String(service.consultationMode || 'online').toLowerCase() === 'online') && service.isPublished === true && service.financeStatus === 'approved' && !service.archived).map(service => {
    const component = String(service.postType).toLowerCase() === 'package' ? catalogue.find(item => item.id === service.packageServiceIds?.[0]) : service
    return { ...service, name: service.serviceName || service.consultationName || service.packageName || service.title || service.name, price: Number(service.price || 0), durationMinutes: Number(component?.durationMinutes || 60), totalSessions: String(service.postType).toLowerCase() === 'package' ? Math.max(1, Number(service.sessionCount || 1)) * (service.packageServiceIds || []).reduce((sum, id) => sum + Math.max(1, Number(catalogue.find(item => item.id === id)?.sessionCount || 1)), 0) : Math.max(1, Number(service.sessionCount || 1)) }
  }).filter(service => service.name && service.price > 0)
  practitioners.value = availability.practitioners || []
  schedules.value = Object.fromEntries(Object.entries(availability.schedules || {}).map(([id, entries]) => [id, buildWeekScheduleMap(entries)]))
  leaves.value = availability.leaves || {}
  await refreshAvailability()
}
async function refreshAvailability() {
  const result = await api('/walk-in/availability?branchId=' + encodeURIComponent(branchId.value))
  existingAppointments.value = result.appointments || []
  policy.value = result.policy || {}
  availabilityReady.value = true
}
function openRegistration() { registrationError.value = ''; newClient.value = emptyClient(); showRegistration.value = true }
function normalizePhone() { let digits = newClient.value.phone.replace(/\D/g, ''); if (digits.startsWith('63')) digits = digits.slice(2); if (digits.startsWith('0')) digits = digits.slice(1); newClient.value.phone = digits.slice(0, 10) }
async function createClient() {
  registrationError.value = ''
  normalizePhone()
  const email = newClient.value.email.trim().toLowerCase()
  if (!newClient.value.firstName || !newClient.value.lastName || !/^\S+@\S+\.\S+$/.test(email) || !/^9\d{9}$/.test(newClient.value.phone)) return void (registrationError.value = 'Enter the client’s name, valid email, and 10-digit mobile number beginning with 9.')
  busy.value = true
  try {
    const client = { ...newClient.value, email, phone: `+63${newClient.value.phone}`, fullName: `${newClient.value.firstName} ${newClient.value.lastName}`.trim(), branchId: branchId.value, status: 'Active', createdBy: auth.currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    const clientRef = await addDoc(collection(db, 'clients'), client)
    clients.value.push({ id: clientRef.id, ...client })
    selectedClientId.value = clientRef.id
    showRegistration.value = false
  } catch (cause) { registrationError.value = cause.message || 'Unable to register this client.' }
  finally { busy.value = false }
}
async function createAppointments() {
  error.value = ''
  if (!selectedClientId.value || !flatVisits.value.length || !policyAcknowledged.value) return void (error.value = 'Choose a client, add services, and confirm the policies.')
  if (!clientFor(selectedClientId.value)?.email) return void (error.value = 'Choose a registered client with a valid email address.')
  if (!bookingSignature.value) return void (error.value = 'The booking arranger must sign the booking and payment terms.')
  if (bookingForSomeoneElse.value && (booker.value.name.length < 2 || !/^\+?[0-9 ()-]{7,25}$/.test(booker.value.phone) || (booker.value.email && !/^\S+@\S+\.\S+$/.test(booker.value.email)))) return void (error.value = 'Enter the booking arranger name and valid contact details.')
  if (flatVisits.value.some(row => !row.serviceId || !row.practitionerId || !row.date || !row.time || !walkInSlots({ row, rows: flatVisits.value, clients: clients.value, services: services.value, schedules: schedules.value, appointments: existingAppointments.value, leaves: leaves.value, now: Date.now() }).some(slot => slot.value === row.time))) return void (error.value = 'Select an available date and time for every service. The same person needs separate dates.')
  busy.value = true
  try {
    const result = await api('/walk-in/bookings', { branchId: branchId.value, clientId: selectedClientId.value, submissionId, policyAcknowledged: true, appointments: flatVisits.value, bookingForSomeoneElse: bookingForSomeoneElse.value, booker: bookingForSomeoneElse.value ? booker.value : null, bookingAcceptance: { accepted: true, signatureImage: bookingSignature.value } })
    createdAppointments.value = result.appointments
  } catch (cause) { error.value = cause.message || 'Unable to create these appointments. No automatic retry was attempted.' }
  finally { busy.value = false }
}
async function collectPayment(appointment) {
  error.value = ''
  const amount = Number(appointment.totalAmount ?? appointment.amount), tendered = Number(cashReceived.value[appointment.id])
  if (!Number.isFinite(tendered) || tendered < amount) return void (error.value = 'Cash received must cover the full appointment amount.')
  busy.value = true
  try { receipts.value[appointment.id] = await api(`/appointments/${appointment.id}/walk-in-payment`, { amount, tendered, method: 'Cash' }); appointment.paymentStatus = 'Paid'; appointment.status = 'Paid' }
  catch (cause) { error.value = cause.message || 'Unable to record payment.' }
  finally { busy.value = false }
}
function updateContract(updated) { if (contractTarget.value && updated?.contract) contractTarget.value.contract = updated.contract }
function startNewBooking() { contractTarget.value = null; createdAppointments.value = []; receipts.value = {}; cashReceived.value = {}; visits.value = []; selectedClientId.value = ''; bookingForSomeoneElse.value = false; booker.value = { name: '', email: '', phone: '' }; bookingSignature.value = ''; policyAcknowledged.value = false; submissionId = crypto.randomUUID(); error.value = '' }
function printReceipt(receipt) {
  const popup = window.open('', '_blank')
  if (!popup) return void (error.value = 'Allow pop-ups to print the receipt.')
  const content = popup.document.createElement('pre')
  content.textContent = `Walk-in receipt\n${receipt.clientName}\n${receipt.service}\n${receipt.date} at ${formatClockTime(receipt.time)}\nPaid: ${currency(receipt.total)}\nCash received: ${currency(receipt.tendered)}\nChange: ${currency(receipt.change)}\nService code: ${receipt.serviceKey}`
  popup.document.body.append(content)
  popup.print()
}
onMounted(trackPageLoad(() => load().catch(cause => { error.value = cause.message || 'Unable to load the Walk-In Desk.' })))
onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now(); if (branchId.value && !busy.value && !createdAppointments.value.length) refreshAvailability().catch(cause => { availabilityReady.value = false; error.value = cause.message || 'Unable to refresh appointment availability.' }) }, 60000) })
onUnmounted(() => { clearInterval(clockTimer) })
</script>

<style scoped>
.walk-in-desk { background: #fffaf3; color: #493225; }
.walk-in-content { max-width: 1150px; margin: 0 auto; display: grid; gap: 24px; }
.page-heading, .section-heading, .client-heading, .visit-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.page-heading { align-items: flex-start; }
h1 { margin: 0; font-size: clamp(26px, 3vw, 34px); font-weight: 700; }
h2 { margin: 0; font-size: 20px; font-weight: 700; } h3 { margin: 0; font-size: 17px; font-weight: 600; } h4 { margin: 0; font-size: 14px; font-weight: 600; }
.eyebrow { margin: 0 0 7px; color: #a77752; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .16em; }
.muted { margin: 7px 0 0; color: #876e59; line-height: 1.7; } .small { font-size: 12px; }
.desk-card { padding: 24px; background: #fffdf9; border: 1px solid #ead2b7; border-radius: 14px; }
.section-heading { margin-bottom: 20px; }
.desk-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; min-height: 42px; border: 1px solid #dfc2a5; border-radius: 9px; font-size: 12px; font-weight: 600; text-decoration: none; }
.primary { background: #8d5a3b; color: #fffdf9; border-color: #8d5a3b; } .primary:hover:not(:disabled) { background: #74462d; }
.secondary { background: #fffdf9; color: #79583f; } .secondary:hover:not(:disabled) { background: #fff3e4; border-color: #bf8d61; }
button:disabled { cursor: not-allowed; opacity: .5; } button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible { outline: 2px solid #b78055; outline-offset: 3px; }
.desk-checkbox { display: flex; align-items: flex-start; gap: 10px; margin-top: 18px; font-size: 13px; line-height: 1.7; color: #654733; }
.desk-checkbox input { width: 16px; height: 16px; margin-top: 3px; flex-shrink: 0; accent-color: #8d5a3b; }
.client-card { margin-top: 20px; padding: 20px; border: 1px solid #e7cfb6; border-radius: 12px; background: #fff9f0; }
.client-heading > div { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.client-contact { margin: 12px 0; color: #846950; font-size: 12px; overflow-wrap: anywhere; }.client-contact span { margin: 0 8px; }
.visit-card { margin: 18px 0; padding: 18px; border: 1px solid #edd9c3; border-radius: 11px; background: #fffdf9; }
.visit-heading { margin-bottom: 18px; }.text-button { padding: 5px 0; color: #a4533d; font-size: 12px; background: transparent; border: 0; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.schedule-grid { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(220px, 1fr); gap: 24px; margin-top: 20px; }
.field-label { display: block; margin-bottom: 8px; color: #654733; font-size: 12px; font-weight: 600; }
.desk-input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #dec19e; border-radius: 9px; background: #fffdf9; color: #493225; font-size: 13px; }
.schedule-details { display: flex; flex-direction: column; align-items: stretch; }.selected-date { margin: 10px 0 0; color: #805638; font-size: 12px; }
.service-summary { margin: 18px 0; padding: 14px; border: 1px solid #ecd7bb; border-radius: 10px; background: #fff7eb; }.service-summary strong { display: block; margin-top: 4px; font-size: 21px; color: #426e56; }
.booking-summary { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }.total-price { font-size: 25px; color: #426e56; }.summary-acknowledgement { width: 100%; margin-top: 0; }
.contract-preview { width: 100%; padding: 14px; border: 1px solid #ead2b7; border-radius: 10px; font-size: 13px; }.contract-preview summary { cursor: pointer; color: #805638; margin-bottom: 12px; }
.payment-card { padding: 20px; border: 1px solid #ead2b7; border-radius: 12px; margin: 18px 0; }.payment-card .section-heading { margin-bottom: 12px; }.payment-card .section-heading > strong { color: #426e56; font-size: 21px; }
.payment-form { display: flex; align-items: flex-end; gap: 14px; max-width: 520px; }.payment-form > div { flex: 1; }
.agreement-button { margin-top: 14px; }
.payment-success { padding: 14px; background: #eef6ef; border: 1px solid #cadccc; border-radius: 10px; color: #426e56; font-size: 13px; }.payment-success p { margin: 0 0 8px; }
.desk-alert { padding: 14px 16px; border-radius: 10px; font-size: 13px; }.error { border: 1px solid #e8b6aa; background: #fff0eb; color: #a04432; }.field-error { color: #a04432; font-size: 12px; margin: 10px 0; }.empty-note { padding: 24px; border: 1px dashed #dec19e; color: #876e59; font-size: 13px; border-radius: 10px; }
.walk-in-desk :deep(.appearance-select) { margin: 0; }.walk-in-desk :deep(.appearance-select-trigger > span) { overflow-wrap: anywhere; }.walk-in-desk :deep(.appearance-select-menu li) { white-space: normal; }
.registration-title { color: #493225; font-size: 20px; font-weight: 700; }.registration-form { display: grid; gap: 18px; margin-top: 20px; }.registration-actions { display: flex; justify-content: flex-end; gap: 10px; }.phone-input { display: flex; border: 1px solid #dec19e; border-radius: 9px; overflow: hidden; background: #fffdf9; }.phone-input span { background: #fff1de; padding: 10px 12px; color: #805638; }.phone-input input { min-width: 0; flex: 1; padding: 10px 12px; color: #493225; background: #fffdf9; }
@media (max-width: 750px) { .desk-card, .client-card, .visit-card { padding: 16px; }.field-grid, .schedule-grid { grid-template-columns: minmax(0, 1fr); }.payment-form { flex-direction: column; align-items: stretch; }.payment-form > div { width: 100%; } }
</style>
