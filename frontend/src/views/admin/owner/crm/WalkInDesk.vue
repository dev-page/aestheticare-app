<template>
  <div class="walk-in-desk owner-theme flex min-h-screen">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, variant: 'form', fields: 4, sections: 2 }" class="flex-1 min-w-0 p-4 md:p-8">
      <div class="walk-in-content">
        <header class="page-heading"><div><p class="eyebrow">CRM &amp; Clinic</p><h1>Walk-In Desk</h1><p class="muted">Choose or add the care recipient, book their on-site appointment, then record consent and payment here. New client details are saved only when the booking succeeds.</p></div><div v-if="isPosRoute && canCreateAppointments" class="flex flex-wrap gap-2"><RouterLink to="/crm/walk-in" class="desk-button secondary">New walk-in booking</RouterLink></div></header>
        <p v-if="error" class="desk-alert error" role="alert">{{ error }}</p>
        <p v-if="checkoutReturnNotice" class="desk-alert" role="status">{{ checkoutReturnNotice }}</p>
        <nav v-if="!isPosRoute" class="walk-in-progress" aria-label="Walk-in booking progress">
          <button
            v-for="step in bookingSteps"
            :key="step.number"
            type="button"
            class="walk-in-progress-step"
            :class="{ 'is-current': progressStep === step.number, 'is-complete': progressStep > step.number }"
            :disabled="createdAppointments.length > 0 || step.number > bookingStep"
            :aria-current="progressStep === step.number ? 'step' : undefined"
            @click="goToBookingStep(step.number)"
          >
            <span class="walk-in-step-number">{{ step.number < progressStep ? '✓' : step.number }}</span>
            <span class="walk-in-step-copy"><strong>{{ step.label }}</strong><small>{{ step.description }}</small></span>
          </button>
        </nav>
        <template v-if="isPosRoute && !createdAppointments.length">
          <section class="desk-card">
            <div class="section-heading"><div><p class="eyebrow">POS</p><h2>Walk-in payments</h2><p class="muted small">Unpaid walk-in appointments stay here if you leave the booking screen. Confirm the recipient's signed treatment agreement before taking payment. Provisional same-day treatments appear only after practitioner clearance.</p></div><div class="flex gap-2"><button type="button" class="desk-button secondary" :disabled="busy" @click="refreshPaymentQueue">Refresh</button><RouterLink v-if="canCreateAppointments" to="/crm/walk-in" class="desk-button primary">Book a walk-in</RouterLink></div></div>
            <article v-for="appointment in posAppointments" :key="appointment.id" class="payment-card">
              <dl v-if="appointment.pricingSnapshot" class="price-breakdown" aria-label="Appointment price breakdown"><div><dt>Subtotal</dt><dd>{{ currency(appointment.pricingSnapshot.subtotal) }}</dd></div><div><dt>{{ appointment.pricingSnapshot.vatApplicable ? 'VAT (12%)' : 'VAT' }}</dt><dd>{{ appointment.pricingSnapshot.vatApplicable ? currency(appointment.pricingSnapshot.vatAmount) : 'Not applied' }}</dd></div><div class="price-breakdown-total"><dt>Total due</dt><dd>{{ currency(appointment.pricingSnapshot.total) }}</dd></div></dl>
              <p v-else class="muted small">Tax breakdown unavailable for this older booking. Total due: {{ currency(appointment.totalAmount ?? appointment.amount) }}</p>
              <div class="section-heading"><div><h3>{{ appointment.clientName || appointment.customerName }}</h3><p>{{ appointment.service }}</p><p class="muted small">{{ dateLabel(appointment.date) }} · {{ formatClockTime(appointment.time) }} · {{ appointment.practitionerName }}</p><p class="muted small">{{ appointment.customerEmail || 'No email provided — share booking details in person.' }}</p></div><strong>{{ currency(appointment.totalAmount ?? appointment.amount) }}</strong></div>
              <p class="muted small">Arranged by {{ appointment.bookedByName }} · Booking terms: {{ appointment.bookingAgreementStatus === 'signed' ? 'Signed' : 'Legacy booking' }} · Treatment agreement: {{ appointment.contract?.status === 'signed' ? 'Signed by recipient' : 'Awaiting recipient signature' }}.</p>
              <div v-if="appointment.bookingWorkflowVersion === 2 && appointment.contract?.status !== 'signed'" class="desk-alert agreement-required"><p>The treatment recipient must sign before payment can be recorded.</p><button type="button" class="desk-button secondary agreement-button" :disabled="busy" @click="contractTarget = appointment">Review &amp; sign treatment agreement</button></div>
              <div v-else-if="!receipts[appointment.id] && canRecordPayments" class="payment-form">
                <template v-if="pendingOnlineCheckouts[appointment.id]">
                  <div class="online-checkout-pending"><p>Waiting for {{ paymentMethodLabel(pendingOnlineCheckouts[appointment.id].method) }} checkout. Payment is recorded only after verification.</p><div class="flex flex-wrap gap-2"><a class="desk-button secondary" :href="pendingOnlineCheckouts[appointment.id].checkoutUrl" target="_blank" rel="noopener noreferrer">Open secure checkout</a><button type="button" class="desk-button primary" :disabled="busy" @click="verifyOnlinePayment(appointment)">Verify payment &amp; issue service code</button></div></div>
                </template>
                <template v-else>
                  <div><label :for="`pos-cash-${appointment.id}`" class="field-label">Cash received</label><input :id="`pos-cash-${appointment.id}`" v-model.number="cashReceived[appointment.id]" type="number" min="0" step="0.01" class="desk-input" :disabled="busy" placeholder="0.00" /></div>
                  <div class="flex flex-wrap gap-2"><button type="button" class="desk-button primary" :disabled="busy" @click="collectPayment(appointment)">Record full cash payment</button><button type="button" class="desk-button secondary" :disabled="busy" @click="startOnlineCheckout(appointment, 'Card')">Pay by card</button><button type="button" class="desk-button secondary" :disabled="busy" @click="startOnlineCheckout(appointment, 'GCash')">Pay by GCash</button></div>
                </template>
              </div>
              <div v-else-if="receipts[appointment.id]" class="payment-success"><p>Payment recorded<span v-if="receipts[appointment.id].method === 'Cash'"> · Change: {{ currency(receipts[appointment.id].change) }}</span><span v-else> · {{ receipts[appointment.id].method }} verified</span></p><p>Service code: <strong>{{ receipts[appointment.id].serviceKey }}</strong></p><p class="small">{{ receipts[appointment.id].emailSent ? 'Service code emailed to the client.' : 'Email delivery was not confirmed. Give the client their receipt and service code.' }}</p><button type="button" class="desk-button secondary" @click="printReceipt(receipts[appointment.id])">Print receipt</button></div>
              <p v-else class="muted small">Walk-in payment permission is required to record this payment.</p>
            </article>
            <p v-if="!posAppointments.length" class="empty-note">No unpaid walk-in appointments are waiting for consent or payment.</p>
          </section>
        </template>
        <template v-else-if="!createdAppointments.length">
          <section v-if="bookingStep === 1" class="desk-card walk-in-step-panel">
            <div class="section-heading"><div><p class="eyebrow">Step 1 of 3</p><h2>Who is receiving care?</h2><p class="muted small">Choose someone already in this branch’s client list, or add their details as part of this booking. A new clinic profile is saved only when the booking succeeds.</p></div></div>
            <ContractAppearanceSelect id="walk-in-client" v-model="selectedClientId" label="Care recipient" :disabled="busy" :options="clientOptions" />
            <div v-if="selectedClientId === NEW_CLIENT_ID" class="new-recipient-form">
              <p class="muted small">Enter the recipient’s details. They do not need a platform account. Email and phone are optional. Without an email, give them the booking details and service code in person.</p>
              <div class="field-grid">
                <div><label for="walk-in-first-name" class="field-label">First name</label><input id="walk-in-first-name" v-model.trim="newClient.firstName" required maxlength="100" class="desk-input" :disabled="busy" autocomplete="given-name" /></div>
                <div><label for="walk-in-middle-name" class="field-label">Middle name <span class="muted small">(optional)</span></label><input id="walk-in-middle-name" v-model.trim="newClient.middleName" maxlength="100" class="desk-input" :disabled="busy" autocomplete="additional-name" /></div>
                <div><label for="walk-in-last-name" class="field-label">Last name</label><input id="walk-in-last-name" v-model.trim="newClient.lastName" required maxlength="100" class="desk-input" :disabled="busy" autocomplete="family-name" /></div>
                <div><label for="walk-in-suffix" class="field-label">Suffix <span class="muted small">(optional)</span></label><input id="walk-in-suffix" v-model.trim="newClient.suffix" maxlength="20" placeholder="Jr., Sr., III" class="desk-input" :disabled="busy" /></div>
                <div><label for="walk-in-email" class="field-label">Email address <span class="muted small">(optional)</span></label><input id="walk-in-email" v-model.trim="newClient.email" type="email" maxlength="254" class="desk-input" :disabled="busy" autocomplete="email" /></div>
                <div><label for="walk-in-phone" class="field-label">Contact number <span class="muted small">(optional)</span></label><input id="walk-in-phone" v-model.trim="newClient.phone" type="tel" inputmode="tel" maxlength="32" placeholder="+63 9XX XXX XXXX" class="desk-input" :disabled="busy" autocomplete="tel" /></div>
              </div>
              <p v-if="selectedClientId === NEW_CLIENT_ID && !clientReady" class="field-error" role="alert">Enter the recipient’s first and last name. Email and phone may be left blank; complete either one only if it is valid.</p>
            </div>
            <p v-else-if="selectedClientId && !clientReady" class="field-error" role="alert">This client has an invalid saved email or phone number. Correct it or clear it before continuing.</p>
            <p class="muted small">The appointment and service code are linked to the selected recipient. Booking for someone else? Keep the recipient selected and enter the arranger below.</p>
            <label class="desk-checkbox summary-acknowledgement"><input v-model="bookingForSomeoneElse" type="checkbox" :disabled="busy" /> Booking for someone else</label>
            <div v-if="bookingForSomeoneElse" class="field-grid">
              <div><label for="booker-name" class="field-label">Booking arranger's name</label><input id="booker-name" v-model.trim="booker.name" class="desk-input" maxlength="150" :disabled="busy" /></div>
              <div><label for="booker-phone" class="field-label">Booking arranger's contact number</label><input id="booker-phone" v-model.trim="booker.phone" class="desk-input" type="tel" maxlength="25" :disabled="busy" /></div>
              <div><label for="booker-email" class="field-label">Booking arranger's email (optional)</label><input id="booker-email" v-model.trim="booker.email" class="desk-input" type="email" maxlength="254" :disabled="busy" /></div>
            </div>
            <p v-if="bookingForSomeoneElse" class="muted small">Keep the selected client as the person receiving treatment. The booking arranger signs only the booking and payment terms.</p>
            <div class="walk-in-step-actions">
              <span class="muted small">The treatment recipient signs their own treatment agreement later.</span>
              <button type="button" class="desk-button primary" :disabled="busy || !clientReady" @click="continueToSchedule">Continue to schedule</button>
            </div>
          </section>
          <section v-else-if="bookingStep === 2" class="desk-card walk-in-step-panel">
            <div class="section-heading"><div><p class="eyebrow">Step 2 of 3</p><h2>Choose the visit and time</h2><p class="muted small">Schedule one or more appointments for {{ clientFor(selectedClientId)?.fullName || 'the selected client' }}. Each appointment needs its own date and time.</p><p class="muted small">Assign required support staff through Treatment team in Appointment Management before treatment starts.</p></div></div>
            <article class="client-card">
              <div class="client-heading"><h3>{{ clientFor(selectedClientId)?.fullName || 'Selected client' }}</h3></div>
              <p v-if="clientFor(selectedClientId)" class="client-contact">{{ clientFor(selectedClientId).email || 'Email missing — update this client first' }} <span>·</span> {{ clientFor(selectedClientId).phone || clientFor(selectedClientId).contactNumber || 'No contact number' }}</p>
              <section v-for="(visit, visitIndex) in visits" :key="visit.key" class="visit-card">
                <div class="visit-heading"><h4>Appointment {{ visitIndex + 1 }}</h4><button v-if="visits.length > 1" type="button" class="text-button" :disabled="busy" @click="removeVisit(visit.key)">Remove appointment</button></div>
                <div class="field-grid"><ContractAppearanceSelect :id="`service-${visit.key}`" v-model="visit.serviceId" label="Service, consultation, or package" :disabled="busy" :options="serviceOptions" @update:model-value="clearSchedule(visit)" /><ContractAppearanceSelect :id="`practitioner-${visit.key}`" v-model="visit.practitionerId" label="Lead practitioner" :disabled="busy" :options="practitionerOptions" @update:model-value="clearSchedule(visit)" /></div>
                <div class="schedule-grid">
                  <div><label class="field-label">Appointment date</label><AppointmentCalendar v-model="visit.date" :min-date="today" :disabled="busy || !availabilityReady || !selectedClientId || !visit.serviceId || !visit.practitionerId" :is-available="date => availableSlots(visit, date).length > 0" @update:model-value="visit.time = ''" /></div>
                  <div class="schedule-details"><ContractAppearanceSelect :id="`time-${visit.key}`" v-model="visit.time" label="Available time" :disabled="busy || !visit.date" :options="[{ value: '', label: visit.date ? 'Select available time' : 'Choose a date first' }, ...availableSlots(visit)]" /><p v-if="visit.date" class="selected-date">{{ dateLabel(visit.date) }}</p><p v-if="visit.date && !availableSlots(visit).length" class="field-error">This date no longer has a suitable slot. Choose another date.</p><div v-if="serviceFor(visit.serviceId)" class="service-summary"><p class="muted small">{{ visit.sameDayConsultationRequested ? 'Consultation fee due first' : 'Service price' }}</p><strong>{{ currency(visit.sameDayConsultationRequested ? sameDayConsultationFor(serviceFor(visit.serviceId))?.price : serviceFor(visit.serviceId).price) }}</strong><p class="muted small">{{ serviceFor(visit.serviceId).durationMinutes }} minutes for the first treatment visit · {{ serviceFor(visit.serviceId).totalSessions || 1 }} session(s)</p><p v-if="visit.sameDayConsultationRequested" class="small">Selected time is the consultation start. The provisional treatment starts at {{ visit.time ? formatClockTime(sameDayTreatmentTime(visit)) : 'the consultation duration plus the configured buffer' }} on the same date. Treatment fee {{ currency(serviceFor(visit.serviceId).price) }} is due only if the practitioner clears it.</p><p v-else-if="serviceFor(visit.serviceId).requiresConsultationFirst" class="small">Requires a completed consultation or approved prior-consultation clearance before booking.</p></div><label v-if="canRequestSameDay(visit)" :for="`same-day-${visit.key}`" class="desk-checkbox summary-acknowledgement"><input :id="`same-day-${visit.key}`" v-model="visit.sameDayConsultationRequested" type="checkbox" :disabled="busy" @change="visit.time = ''" /> Request an on-site consultation followed by a provisional treatment slot on the same date. The practitioner must clear treatment before its agreement or payment is available.</label><label :for="`notes-${visit.key}`" class="field-label">Notes <span class="muted">(optional)</span></label><textarea :id="`notes-${visit.key}`" v-model.trim="visit.notes" :disabled="busy" maxlength="2000" rows="3" class="desk-input" placeholder="Notes for this appointment" /></div>
                </div>
              </section>
              <button type="button" class="desk-button secondary" :disabled="busy || flatVisits.length >= 20" @click="visits.push(newVisit())">+ Add another appointment</button>
            </article>
            <div class="walk-in-step-actions">
              <button type="button" class="desk-button secondary" :disabled="busy" @click="goToBookingStep(1)">Back to client</button>
              <button type="button" class="desk-button primary" :disabled="busy || !scheduleReady" @click="continueToReview">Review booking</button>
            </div>
          </section>
          <section v-else class="desk-card booking-summary walk-in-step-panel">
            <div class="section-heading"><div><p class="eyebrow">Step 3 of 3</p><h2>Review and confirm</h2><p class="muted small">Check the recipient, appointments, and total before the arranger accepts the booking terms.</p></div><strong class="total-price">{{ estimatedTotal }}</strong></div>
            <div class="walk-in-review-list" aria-label="Appointment review">
              <article v-for="item in appointmentReviewRows" :key="item.key" class="walk-in-review-row">
                <div><strong>{{ item.serviceName }}</strong><span class="walk-in-review-type">{{ item.typeLabel }}</span><p>{{ item.date }} · {{ item.time }} · {{ item.practitioner }}</p><p v-if="item.sameDayTreatmentTime" class="walk-in-review-note">On-site consultation first; provisional treatment at {{ item.sameDayTreatmentTime }} after practitioner clearance.</p><p v-if="item.sessionCount > 1" class="walk-in-review-note">Treatment course: {{ item.sessionCount }} visits. This appointment starts the course.</p></div>
                <strong class="walk-in-review-price"><small>{{ item.sameDayTreatmentTime ? 'Consultation due first' : 'Appointment total' }}</small>{{ item.price }}</strong>
              </article>
            </div>
            <p class="walk-in-recipient-note">Recipient: <strong>{{ clientFor(selectedClientId)?.fullName || 'Select a client' }}</strong><span v-if="bookingForSomeoneElse"> · Arranged by {{ booker.name || 'name needed' }}</span>. The arranger accepts booking/payment terms; the recipient signs the treatment agreement before payment.</p>
            <dl class="price-breakdown booking-price-breakdown" aria-label="Estimated appointment price breakdown"><div><dt>Subtotal</dt><dd>{{ currency(estimatedPricing.subtotal) }}</dd></div><div><dt>{{ estimatedPricing.vatApplicable ? 'VAT (12%)' : 'VAT' }}</dt><dd>{{ estimatedPricing.vatApplicable ? currency(estimatedPricing.vatAmount) : 'Not applied' }}</dd></div><div class="price-breakdown-total"><dt>Total due</dt><dd>{{ currency(estimatedPricing.total) }}</dd></div></dl>
            <details v-if="policy.clientContract?.configured" class="contract-preview"><summary>Review the clinic agreement</summary><ClientContractDocument :document="contractPreview" /></details>
            <ClientContractDocument :document="bookingTermsPreview" />
            <p class="muted small">Booking signer: <strong>{{ bookingForSomeoneElse ? booker.name || 'Enter the arranger name above' : clientFor(selectedClientId)?.fullName || 'Select the client above' }}</strong>. Hand the device to this person to accept booking and payment terms. This signature does not authorize treatment.</p>
            <ElectronicSignaturePad v-model="bookingSignature" label="Booking arranger signature — booking and payment terms only" />
            <label class="desk-checkbox summary-acknowledgement"><input v-model="policyAcknowledged" type="checkbox" :disabled="busy" /> I accept the displayed booking prices, schedules, and booking terms, and confirm this is my signature. This does not authorize treatment for someone else.</label>
            <p class="walk-in-payment-note">Creating the booking does not collect payment. The recipient must sign the treatment agreement first; you can collect payment here or return later through the POS queue.</p>
            <div class="walk-in-step-actions">
              <button type="button" class="desk-button secondary" :disabled="busy" @click="goToBookingStep(2)">Back to schedule</button>
              <button type="button" class="desk-button primary" :disabled="busy || !availabilityReady || !clientReady || !scheduleReady || !flatVisits.length || !policyAcknowledged || !bookingSignature" @click="createAppointments">{{ busy ? 'Creating appointments…' : 'Create walk-in booking' }}</button>
            </div>
          </section>
        </template>
        <section v-else class="desk-card">
            <div class="section-heading"><div><p class="eyebrow">Step 3</p><h2>Consent &amp; payment</h2><p class="muted small">For each appointment, have the treatment recipient sign the agreement before full payment. A same-day treatment stays locked until the practitioner clears it after the consultation.</p></div><div class="flex gap-2"><RouterLink to="/crm/pos" class="desk-button secondary">Open POS queue</RouterLink><button type="button" class="desk-button secondary" :disabled="busy" @click="startNewBooking">New booking</button></div></div>
          <article v-for="appointment in createdAppointments" :key="appointment.id" class="payment-card">
            <dl v-if="appointment.pricingSnapshot" class="price-breakdown" aria-label="Appointment price breakdown"><div><dt>Subtotal</dt><dd>{{ currency(appointment.pricingSnapshot.subtotal) }}</dd></div><div><dt>{{ appointment.pricingSnapshot.vatApplicable ? 'VAT (12%)' : 'VAT' }}</dt><dd>{{ appointment.pricingSnapshot.vatApplicable ? currency(appointment.pricingSnapshot.vatAmount) : 'Not applied' }}</dd></div><div class="price-breakdown-total"><dt>Total due</dt><dd>{{ currency(appointment.pricingSnapshot.total) }}</dd></div></dl>
            <p v-else class="muted small">Tax breakdown unavailable for this older booking. Total due: {{ currency(appointment.totalAmount ?? appointment.amount) }}</p>
            <div class="section-heading"><div><h3>{{ appointment.clientName || appointment.customerName }}</h3><p>{{ appointment.service }}</p><p class="muted small">{{ dateLabel(appointment.date) }} · {{ formatClockTime(appointment.time) }} · {{ appointment.practitionerName }}</p><p class="muted small">{{ appointment.customerEmail || 'No email provided — share booking details in person.' }}</p></div><strong>{{ currency(appointment.totalAmount ?? appointment.amount) }}</strong></div>
            <p class="muted small">Arranged by {{ appointment.bookedByName }} · Booking terms signed. Treatment agreement: {{ appointment.contract?.status === 'signed' ? 'Signed by recipient' : 'Awaiting recipient signature' }}.</p>
            <div v-if="appointment.sameDayTreatmentStatus === 'pending_clinical_clearance'" class="desk-alert agreement-required"><p>This treatment time is provisional. The assigned practitioner must finish the consultation and clear treatment for today before the recipient can sign or pay for it. Only the consultation can be paid now.</p></div>
            <div v-else-if="appointment.paymentStatus !== 'Paid' && appointment.contract?.status !== 'signed'" class="desk-alert agreement-required"><p>The treatment recipient must sign before payment can be recorded.</p><button type="button" class="desk-button secondary agreement-button" :disabled="busy" @click="contractTarget = appointment">Review &amp; sign treatment agreement</button></div>
            <div v-else-if="!receipts[appointment.id] && appointment.paymentStatus !== 'Paid' && canRecordPayments" class="payment-form">
              <template v-if="pendingOnlineCheckouts[appointment.id]">
                <div class="online-checkout-pending"><p>Waiting for {{ paymentMethodLabel(pendingOnlineCheckouts[appointment.id].method) }} checkout. Payment is recorded only after verification.</p><div class="flex flex-wrap gap-2"><a class="desk-button secondary" :href="pendingOnlineCheckouts[appointment.id].checkoutUrl" target="_blank" rel="noopener noreferrer">Open secure checkout</a><button type="button" class="desk-button primary" :disabled="busy" @click="verifyOnlinePayment(appointment)">Verify payment &amp; issue service code</button></div></div>
              </template>
              <template v-else>
                <div><label :for="`cash-${appointment.id}`" class="field-label">Cash received</label><input :id="`cash-${appointment.id}`" v-model.number="cashReceived[appointment.id]" type="number" min="0" step="0.01" class="desk-input" :disabled="busy" placeholder="0.00" /></div>
                <div class="flex flex-wrap gap-2"><button type="button" class="desk-button primary" :disabled="busy" @click="collectPayment(appointment)">Record full cash payment</button><button type="button" class="desk-button secondary" :disabled="busy" @click="startOnlineCheckout(appointment, 'Card')">Pay by card</button><button type="button" class="desk-button secondary" :disabled="busy" @click="startOnlineCheckout(appointment, 'GCash')">Pay by GCash</button></div>
              </template>
            </div>
            <p v-else-if="appointment.paymentStatus !== 'Paid' && !canRecordPayments" class="muted small">Consent is saved. A staff member with walk-in payment access must collect payment and issue the service code.</p>
            <div v-else class="payment-success"><p>Payment recorded<span v-if="receipts[appointment.id]?.method === 'Cash'"> · Change: {{ currency(receipts[appointment.id].change) }}</span><span v-else-if="receipts[appointment.id]?.method"> · {{ receipts[appointment.id].method }} verified</span></p><template v-if="receipts[appointment.id]"><p>Service code: <strong>{{ receipts[appointment.id].serviceKey }}</strong></p><p class="small">{{ receipts[appointment.id].emailSent ? 'Service code emailed to the client.' : 'Email delivery was not confirmed. Give the client their receipt and service code.' }}</p><button type="button" class="desk-button secondary" @click="printReceipt(receipts[appointment.id])">Print receipt</button></template></div>
            <button v-if="appointment.contract?.status === 'signed' || appointment.paymentStatus === 'Paid'" type="button" class="desk-button secondary agreement-button" :disabled="busy" @click="contractTarget = appointment">View treatment agreement</button>
          </article>
          <p class="muted small">Cash, card, and GCash payments are supported. Online payments must be completed and verified before a receipt or service code is issued. Review contracts and check in the client in <RouterLink to="/crm/appointments">Appointment Management</RouterLink>.</p>
        </section>
      </div>
    </main>
    <BookingContractModal :visible="Boolean(contractTarget)" :appointment="contractTarget" :read-only="contractTarget?.contract?.status === 'signed'" @close="contractTarget = null" @updated="updateContract" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { usePageLoading } from '@/composables/usePageLoading'
import { usePermissions } from '@/composables/usePermissions'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import AppointmentCalendar from '@/components/common/AppointmentCalendar.vue'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ElectronicSignaturePad from '@/components/common/ElectronicSignaturePad.vue'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { buildWeekScheduleMap } from '@/utils/employeeSchedules'
import { manilaDate, walkInSlots } from '@/utils/walkInScheduling'
import { formatClockTime } from '@/utils/appointmentDss'
import { buildClientContractDocument, buildBookingTermsDocument } from '../../../../../../shared/clientContract.js'
import { buildAppointmentPricing, sumAppointmentPricing } from '../../../../../../shared/appointmentPricing.js'

const { pageLoading, trackPageLoad } = usePageLoading()
const { hasPermission } = usePermissions()
const route = useRoute()
const router = useRouter()
const canCreateAppointments = computed(() => hasPermission('appointments:create'))
const canRecordPayments = computed(() => hasPermission('payments:create'))
const isPosRoute = computed(() => route.path === '/crm/pos')
const pendingWalkInCheckoutsKey = 'pendingWalkInCheckouts'
function readPendingWalkInCheckouts() {
  try {
    const saved = JSON.parse(localStorage.getItem(pendingWalkInCheckoutsKey) || '{}')
    return Object.fromEntries(Object.entries(saved).filter(([, checkout]) => {
      try {
        const url = new URL(checkout?.checkoutUrl)
        return url.protocol === 'https:' && (url.hostname === 'paymongo.com' || url.hostname.endsWith('.paymongo.com')) && checkout.checkoutSessionId && ['Card', 'GCash'].includes(checkout.method)
      } catch { return false }
    }))
  } catch { return {} }
}
const pendingOnlineCheckouts = ref(readPendingWalkInCheckouts())
const checkoutReturnNotice = computed(() => route.query.walkin_payment === 'success'
  ? 'Checkout returned. Verify the payment here; the appointment is marked paid only after the provider confirms it.'
  : route.query.walkin_payment === 'cancelled'
    ? 'Checkout was cancelled. Reopen the secure link below if the client wants to try again.'
    : '')
const branchId = ref(''), busy = ref(false), error = ref(''), clients = ref([]), services = ref([]), practitioners = ref([])
const schedules = ref({}), leaves = ref({}), existingAppointments = ref([]), branch = ref({}), policy = ref({})
const selectedClientId = ref(''), visits = ref([]), policyAcknowledged = ref(false), bookingStep = ref(1)
const bookingForSomeoneElse = ref(false), booker = ref({ name: '', email: '', phone: '' }), bookingSignature = ref('')
const createdAppointments = ref([]), posAppointments = ref([]), receipts = ref({}), cashReceived = ref({}), contractTarget = ref(null)
const NEW_CLIENT_ID = '__new_client__'
const emptyClient = () => ({ firstName: '', middleName: '', lastName: '', suffix: '', email: '', phone: '' })
const newClient = ref(emptyClient()), now = ref(Date.now())
const availabilityReady = ref(false)
let apiBase = OTP_BACKEND_CANDIDATES[0], clockTimer, submissionId = crypto.randomUUID()
const today = computed(() => manilaDate(now.value))
const bookingSteps = computed(() => [
  { number: 1, label: 'Client', description: 'Choose who is receiving care' },
  { number: 2, label: 'Schedule', description: 'Choose offering, practitioner, and time' },
  { number: 3, label: createdAppointments.value.length ? 'Consent & payment' : 'Review & confirm', description: createdAppointments.value.length ? 'Recipient consent and payment' : 'Review terms and create booking' },
])
const progressStep = computed(() => createdAppointments.value.length ? 3 : bookingStep.value)
const newVisit = () => ({ key: crypto.randomUUID(), serviceId: '', practitionerId: '', date: '', time: '', notes: '', sameDayConsultationRequested: false })
const clientFor = id => id === NEW_CLIENT_ID ? {
  ...newClient.value,
  fullName: [newClient.value.firstName, newClient.value.middleName, newClient.value.lastName].map(value => String(value || '').trim()).filter(Boolean).join(' ')
    + (String(newClient.value.suffix || '').trim() ? `, ${String(newClient.value.suffix).trim()}` : ''),
} : bookingClients.value.find(client => client.id === id)
const normalizedNewClient = computed(() => {
  const firstName = String(newClient.value.firstName || '').trim().replace(/\s+/g, ' ')
  const middleName = String(newClient.value.middleName || '').trim().replace(/\s+/g, ' ')
  const lastName = String(newClient.value.lastName || '').trim().replace(/\s+/g, ' ')
  const suffix = String(newClient.value.suffix || '').trim().replace(/\s+/g, ' ')
  const email = String(newClient.value.email || '').trim().toLowerCase()
  const phone = String(newClient.value.phone || '').trim()
  return { firstName, middleName, lastName, suffix, email, phone, fullName: [firstName, middleName, lastName].filter(Boolean).join(' ') + (suffix ? `, ${suffix}` : '') }
})
const validNewClient = computed(() => {
  const client = normalizedNewClient.value
  return Boolean(client.firstName && client.lastName && client.firstName.length <= 100 && client.middleName.length <= 100 && client.lastName.length <= 100
    && client.suffix.length <= 20 && (!client.email || (client.email.length <= 254 && /^\S+@\S+\.\S+$/.test(client.email)))
    && client.phone.length <= 32 && (!client.phone || /^\+?[0-9 ()-]{7,32}$/.test(client.phone)))
})
const clientReady = computed(() => selectedClientId.value === NEW_CLIENT_ID
  ? validNewClient.value
  : (() => {
      const client = clientFor(selectedClientId.value) || {}
      const email = String(client.email || '').trim()
      const phone = String(client.phone || client.contactNumber || '').trim()
      return (!email || (email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)))
        && phone.length <= 32 && (!phone || /^\+?[0-9 ()-]{7,32}$/.test(phone))
    })())
const bookingClients = computed(() => {
  const byId = new Map()
  const identityToId = new Map()
  const registerIdentity = (identity, id) => { if (identity) identityToId.set(String(identity), id) }
  clients.value.forEach(client => {
    if (['inactive', 'archived'].includes(String(client.status || '').toLowerCase())) return
    byId.set(client.id, { ...client, fullName: client.fullName || [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ') })
    registerIdentity(client.id, client.id)
    registerIdentity(client.customerId, client.id)
  })
  existingAppointments.value.forEach(appointment => {
    if (appointment.isGroupParent || appointment.isBookingOrderParent) return
    const customerId = String(appointment.customerId || '').trim()
    const clientId = String(appointment.clientId || '').trim()
    const identity = customerId || clientId
    if (!identity) return
    const matchedId = identityToId.get(clientId) || identityToId.get(customerId)
    if (matchedId) return
    const id = identity
    const fullName = String(appointment.clientName || appointment.customerName || '').trim() || 'Clinic Client'
    byId.set(id, {
      id,
      clientId: clientId || id,
      customerId: customerId || id,
      fullName,
      email: appointment.customerEmail || appointment.clientEmail || '',
      phone: appointment.customerPhone || appointment.clientPhone || '',
      source: 'appointment',
    })
    registerIdentity(id, id)
    registerIdentity(clientId, id)
    registerIdentity(customerId, id)
  })
  return [...byId.values()]
})
const availabilityClients = computed(() => selectedClientId.value === NEW_CLIENT_ID
  ? [...bookingClients.value, { id: NEW_CLIENT_ID, ...normalizedNewClient.value }]
  : bookingClients.value)
const bookingArrangerReady = computed(() => !bookingForSomeoneElse.value || (
  booker.value.name.trim().length >= 2
  && /^\+?[0-9 ()-]{7,25}$/.test(booker.value.phone)
  && (!booker.value.email || /^\S+@\S+\.\S+$/.test(booker.value.email))
))
const serviceFor = id => services.value.find(service => service.id === id)
const sameDayConsultationFor = service => services.value.find(item => item.id === service?.linkedConsultationId && String(item.postType || '').toLowerCase() === 'consultation') || null
const supportsOnSite = service => (Array.isArray(service?.consultationModes) && service.consultationModes.length ? service.consultationModes : [service?.consultationMode]).some(mode => ['on-site', 'onsite'].includes(String(mode || '').trim().toLowerCase().replace(/[\s_]+/g, '-')))
const canRequestSameDay = visit => {
  const service = serviceFor(visit.serviceId)
  return service?.postType === 'Service' && service.requiresConsultationFirst === true && service.sameDayConsultationAllowed === true && supportsOnSite(sameDayConsultationFor(service))
}
const sameDayTreatmentTime = visit => {
  const start = parseClockToMinutes(visit.time)
  const service = serviceFor(visit.serviceId), consultation = sameDayConsultationFor(service)
  return Number.isFinite(start) ? minutesToTime(start + Number(consultation?.durationMinutes || 60) + Math.max(0, Number(service?.sameDayConsultationBufferMinutes ?? 15))) : ''
}
const currency = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const pricingFor = service => buildAppointmentPricing({
  listedPrice: Number(service?.price || 0),
  vatApplicable: policy.value.vatRegistered === true && service?.vatApplicable === true,
  vatPriceMode: service?.vatPriceMode,
})
const visitPricing = visit => {
  const service = serviceFor(visit.serviceId)
  return pricingFor(visit.sameDayConsultationRequested ? sameDayConsultationFor(service) : service)
}
const dateLabel = date => date ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(`${date}T00:00:00+08:00`)) : 'Date not selected'
const clientOptions = computed(() => [{ value: '', label: 'Select an existing client' }, ...bookingClients.value.map(client => ({ value: client.id, label: `${client.fullName} · ${client.email || 'No email'}` })), { value: NEW_CLIENT_ID, label: '+ Add a new person for this booking' }])
const serviceOptions = computed(() => [{ value: '', label: 'Select an offering' }, ...services.value.map(service => ({ value: service.id, label: `${service.name} · ${currency(service.price)}` }))])
const practitionerOptions = computed(() => [{ value: '', label: 'Select a practitioner' }, ...practitioners.value.map(person => ({ value: person.id, label: person.fullName }))])
const flatVisits = computed(() => visits.value.map(visit => ({ ...visit, clientId: selectedClientId.value })))
const estimatedPricing = computed(() => sumAppointmentPricing(flatVisits.value
  .filter(row => serviceFor(row.serviceId))
  .map(visitPricing)))
const estimatedTotal = computed(() => currency(estimatedPricing.value.total))
const contractPreview = computed(() => buildClientContractDocument(policy.value, { branch: branch.value, source: 'walk_in' }))
const bookingTermsPreview = computed(() => buildBookingTermsDocument(policy.value, { branch: branch.value, source: 'walk_in' }))
watch([bookingForSomeoneElse, booker, policy], () => { policyAcknowledged.value = false; bookingSignature.value = '' }, { deep: true })
const availableSlots = (visit, date = visit.date) => walkInSlots({ row: { ...visit, clientId: selectedClientId.value }, date, rows: flatVisits.value, clients: availabilityClients.value, services: services.value, schedules: schedules.value, appointments: existingAppointments.value, leaves: leaves.value, operatingHours: branch.value.operatingHours || {}, legacyOperatingHours: { openDays: branch.value.openDays || [], openTime: branch.value.openTime || '', closeTime: branch.value.closeTime || '' }, now: now.value })
const scheduleReady = computed(() => Boolean(availabilityReady.value && clientReady.value && flatVisits.value.length
  && flatVisits.value.every(row => row.serviceId && row.practitionerId && row.date && row.time
    && availableSlots(row).some(slot => slot.value === row.time))))
const appointmentReviewRows = computed(() => flatVisits.value
  .filter(row => serviceFor(row.serviceId))
  .map(row => {
    const service = serviceFor(row.serviceId)
    const practitioner = practitioners.value.find(person => person.id === row.practitionerId)
    const type = String(service?.postType || '').toLowerCase()
    return {
      ...row,
      serviceName: service.name,
      typeLabel: type === 'consultation' ? 'On-site consultation' : type === 'package' ? 'Service package' : 'Service',
      practitioner: practitioner?.fullName || 'Practitioner not selected',
      date: dateLabel(row.date),
      time: formatClockTime(row.time),
      price: currency(visitPricing(row).total),
      sessionCount: Number(service.totalSessions || 1),
      sameDayTreatmentTime: row.sameDayConsultationRequested ? formatClockTime(sameDayTreatmentTime(row)) : '',
    }
  }))
const continueToSchedule = () => {
  error.value = ''
  if (!selectedClientId.value || !clientReady.value) {
    error.value = 'Choose an existing client or enter the new recipient’s name and valid contact details.'
    return
  }
  if (!bookingArrangerReady.value) {
    error.value = 'Enter the booking arranger’s name and a valid contact number before continuing.'
    return
  }
  if (!visits.value.length) visits.value = [newVisit()]
  bookingStep.value = 2
}
const continueToReview = () => {
  error.value = ''
  if (!scheduleReady.value) {
    error.value = 'Choose an available offering, practitioner, date, and time for every appointment.'
    return
  }
  bookingStep.value = 3
}
const goToBookingStep = step => {
  if (createdAppointments.value.length || step > bookingStep.value || step < 1 || step > 3) return
  error.value = ''
  bookingStep.value = step
}
const clearSchedule = visit => { visit.date = ''; visit.time = ''; visit.sameDayConsultationRequested = false }
const removeVisit = key => { visits.value = visits.value.filter(visit => visit.key !== key) }
watch(selectedClientId, () => {
  bookingStep.value = 1
  policyAcknowledged.value = false
  bookingSignature.value = ''
  error.value = ''
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
  const clinicSnap = await getDoc(doc(db, 'clinics', branchId.value))
  branch.value = clinicSnap.data() || {}
  if (isPosRoute.value) {
    await refreshPaymentQueue()
    return
  }
  const [clientRows, serviceRows, availability] = await Promise.all([
    getDocs(query(collection(db, 'clients'), where('branchId', '==', branchId.value))),
    getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId.value))),
    api(`/public/clinics/${encodeURIComponent(branchId.value)}/practitioners`)
  ])
  clients.value = clientRows.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() })).filter(client => !['inactive', 'archived'].includes(String(client.status || '').toLowerCase()))
  const catalogue = serviceRows.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
  services.value = catalogue.filter(service => ['service', 'consultation', 'package'].includes(String(service.postType || '').toLowerCase()) && !(String(service.postType || '').toLowerCase() === 'consultation' && !supportsOnSite(service)) && service.isPublished === true && service.financeStatus === 'approved' && !service.archived).map(service => {
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
  if (isPosRoute.value) await refreshPaymentQueue()
}
async function refreshPaymentQueue() {
  if (!branchId.value) return
  error.value = ''
  try {
    const result = await api('/walk-in/pos?branchId=' + encodeURIComponent(branchId.value))
    posAppointments.value = result.appointments || []
  } catch (cause) { error.value = cause.message || 'Unable to refresh walk-in payments.' }
}
async function createAppointments() {
  error.value = ''
  if (!selectedClientId.value || !flatVisits.value.length || !policyAcknowledged.value) return void (error.value = 'Choose a client, add services, and confirm the policies.')
  if (!clientReady.value) return void (error.value = 'Check the recipient’s name and any email or phone number you entered.')
  if (!scheduleReady.value) return void (error.value = 'Select an available date and time for every appointment. The same person needs separate dates.')
  if (!bookingSignature.value) return void (error.value = 'The booking arranger must sign the booking and payment terms.')
  if (!bookingArrangerReady.value) return void (error.value = 'Enter the booking arranger name and valid contact details.')
  if (flatVisits.value.some(row => !row.serviceId || !row.practitionerId || !row.date || !row.time || !walkInSlots({ row, rows: flatVisits.value, clients: availabilityClients.value, services: services.value, schedules: schedules.value, appointments: existingAppointments.value, leaves: leaves.value, operatingHours: branch.value.operatingHours || {}, legacyOperatingHours: { openDays: branch.value.openDays || [], openTime: branch.value.openTime || '', closeTime: branch.value.closeTime || '' }, now: Date.now() }).some(slot => slot.value === row.time))) return void (error.value = 'Select an available date and time for every service. The same person needs separate dates.')
  busy.value = true
  try {
    const result = await api('/walk-in/bookings', {
      branchId: branchId.value,
      clientId: selectedClientId.value === NEW_CLIENT_ID ? null : selectedClientId.value,
      ...(selectedClientId.value === NEW_CLIENT_ID ? { clientDetails: normalizedNewClient.value } : {}),
      submissionId,
      policyAcknowledged: true,
      appointments: flatVisits.value,
      bookingForSomeoneElse: bookingForSomeoneElse.value,
      booker: bookingForSomeoneElse.value ? booker.value : null,
      bookingAcceptance: { accepted: true, signatureImage: bookingSignature.value },
    })
    createdAppointments.value = result.appointments
  } catch (cause) { error.value = cause.message || 'Unable to create these appointments. No automatic retry was attempted.' }
  finally { busy.value = false }
}
async function collectPayment(appointment) {
  error.value = ''
  if (appointment.bookingWorkflowVersion === 2 && appointment.contract?.status !== 'signed') return void (error.value = 'The treatment recipient must sign the agreement before payment.')
  if (!canRecordPayments.value) return void (error.value = 'Walk-in payment permission is required to record this payment.')
  const amount = Number(appointment.totalAmount ?? appointment.amount), tendered = Number(cashReceived.value[appointment.id])
  if (!Number.isFinite(tendered) || tendered < amount) return void (error.value = 'Cash received must cover the full appointment amount.')
  busy.value = true
  try { receipts.value[appointment.id] = await api(`/appointments/${appointment.id}/walk-in-payment`, { amount, tendered, method: 'Cash' }); appointment.paymentStatus = 'Paid'; appointment.status = 'Paid' }
  catch (cause) { error.value = cause.message || 'Unable to record payment.' }
  finally { busy.value = false }
}
function paymentMethodLabel(method) { return method === 'GCash' ? 'GCash' : 'card' }
function savePendingOnlineCheckouts(next) {
  localStorage.setItem(pendingWalkInCheckoutsKey, JSON.stringify(next))
  pendingOnlineCheckouts.value = next
}
async function startOnlineCheckout(appointment, method) {
  error.value = ''
  if (!canRecordPayments.value) return void (error.value = 'Walk-in payment permission is required to collect payment.')
  if (!['Card', 'GCash'].includes(method)) return void (error.value = 'Choose card or GCash checkout.')
  if (appointment.bookingWorkflowVersion === 2 && appointment.contract?.status !== 'signed') return void (error.value = 'The treatment recipient must sign the agreement before payment.')
  const amount = Math.round(Number(appointment.totalAmount ?? appointment.amount) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) return void (error.value = 'This appointment has an invalid payment amount.')

  busy.value = true
  try {
    const checkout = await api('/paymongo/create-checkout-session', {
      amount,
      paymentMethodTypes: [method.toLowerCase()],
      description: `Walk-in appointment: ${appointment.service || 'Clinic service'}`,
      referenceNumber: `WALKIN-${appointment.id}`,
      lineItems: appointment.pricingSnapshot && Math.round(Number(appointment.pricingSnapshot.total) * 100) === amount
        ? [
            ...(Number(appointment.pricingSnapshot.subtotal) > 0
              ? [{ amount: Math.round(Number(appointment.pricingSnapshot.subtotal) * 100), currency: 'PHP', name: `${String(appointment.service || 'Appointment').slice(0, 55)} subtotal`, quantity: 1 }]
              : []),
            ...(appointment.pricingSnapshot.vatApplicable && Number(appointment.pricingSnapshot.vatAmount) > 0
              ? [{ amount: Math.round(Number(appointment.pricingSnapshot.vatAmount) * 100), currency: 'PHP', name: 'VAT (12%)', quantity: 1 }]
              : []),
          ]
        : undefined,
      ...((appointment.customerEmail || appointment.bookedByEmail)
        ? { billing: { name: appointment.bookedByName || appointment.clientName || appointment.customerName || 'Clinic customer', email: appointment.customerEmail || appointment.bookedByEmail } }
        : {}),
      metadata: { module: 'clinic_walk_in_pos', saleMode: 'appointment', source: 'walk_in_pos', appointmentId: appointment.id, branchId: branchId.value },
      successUrl: `${window.location.origin}/crm/pos?walkin_payment=success`,
      cancelUrl: `${window.location.origin}/crm/pos?walkin_payment=cancelled`,
    })
    if (!checkout?.id || !checkout?.checkout_url) throw Error('The payment provider did not return a checkout link.')
    const checkoutUrl = new URL(checkout.checkout_url)
    if (checkoutUrl.protocol !== 'https:' || (checkoutUrl.hostname !== 'paymongo.com' && !checkoutUrl.hostname.endsWith('.paymongo.com'))) throw Error('The payment provider returned an invalid checkout link.')
    savePendingOnlineCheckouts({
      ...pendingOnlineCheckouts.value,
      [appointment.id]: { checkoutSessionId: checkout.id, checkoutUrl: checkoutUrl.toString(), method },
    })
    window.location.assign(checkoutUrl.toString())
  } catch (cause) { error.value = cause.message || 'Unable to start the secure checkout.' }
  finally { busy.value = false }
}
async function verifyOnlinePayment(appointment) {
  error.value = ''
  if (!canRecordPayments.value) return void (error.value = 'Walk-in payment permission is required to verify this payment.')
  if (appointment.bookingWorkflowVersion === 2 && appointment.contract?.status !== 'signed') return void (error.value = 'The treatment recipient must sign the agreement before payment.')
  const checkout = pendingOnlineCheckouts.value[appointment.id]
  if (!checkout?.checkoutSessionId) return void (error.value = 'No online checkout is waiting for this appointment.')
  busy.value = true
  try {
    const amount = Number(appointment.totalAmount ?? appointment.amount)
    const receipt = await api(`/appointments/${appointment.id}/walk-in-payment`, {
      amount,
      method: checkout.method,
      checkoutSessionId: checkout.checkoutSessionId,
    })
    receipts.value[appointment.id] = receipt
    appointment.paymentStatus = 'Paid'
    appointment.status = 'Paid'
    const next = { ...pendingOnlineCheckouts.value }
    delete next[appointment.id]
    savePendingOnlineCheckouts(next)
    if (isPosRoute.value && route.query.walkin_payment) await router.replace({ path: '/crm/pos' })
  } catch (cause) { error.value = cause.message || 'Unable to verify the online payment. The appointment remains unpaid until verification succeeds.' }
  finally { busy.value = false }
}
function updateContract(updated) { if (contractTarget.value && updated?.contract) contractTarget.value.contract = updated.contract }
function startNewBooking() { contractTarget.value = null; createdAppointments.value = []; receipts.value = {}; cashReceived.value = {}; visits.value = []; selectedClientId.value = ''; bookingForSomeoneElse.value = false; booker.value = { name: '', email: '', phone: '' }; bookingSignature.value = ''; policyAcknowledged.value = false; bookingStep.value = 1; submissionId = crypto.randomUUID(); error.value = '' }
function receiptPaidAt(value) {
  if (!value) return ''
  const timestamp = value?.toDate?.() || (typeof value === 'object' && Number.isFinite(Number(value._seconds ?? value.seconds))
    ? new Date(Number(value._seconds ?? value.seconds) * 1000)
    : new Date(value))
  if (!Number.isFinite(timestamp.getTime())) return ''
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(timestamp)
}
function escapeReceiptText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}
function printReceipt(receipt) {
  const popup = window.open('', '_blank')
  if (!popup) return void (error.value = 'Allow pop-ups to print the receipt.')
  const pricing = receipt.pricingSnapshot
  const branchName = branch.value.clinicBranch || branch.value.clinicName || branch.value.name || 'Clinic branch'
  const address = branch.value.clinicLocationAddress || branch.value.clinicLocation || branch.value.address || ''
  const contactNumber = branch.value.contactNumber || ''
  const total = pricing?.total ?? receipt.total ?? receipt.amount
  const receiptNumber = receipt.transactionCode || `walk-in-${receipt.appointmentId || ''}`
  const line = (label, value, className = '') => value === '' || value == null ? '' : `<div class="detail-row ${className}"><span>${escapeReceiptText(label)}</span><strong>${escapeReceiptText(value)}</strong></div>`
  const dynamic = value => escapeReceiptText(value)
  const cashDetails = receipt.method === 'Cash'
    ? `<section class="cash-details"><h2>Cash tender</h2>${line('Cash received', currency(receipt.tendered))}${line('Change', currency(receipt.change))}</section>`
    : ''
  let printStarted = false
  const beginPrint = () => {
    if (printStarted || popup.closed || !popup.document.querySelector('.receipt-sheet')) return
    printStarted = true
    popup.focus()
    popup.print()
  }
  popup.addEventListener('load', () => window.setTimeout(beginPrint, 100), { once: true })
  const popupHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Receipt ${dynamic(receiptNumber)}</title><style>
    @page{size:A4 portrait;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#f7f2ec;color:#30241e;font:14px/1.5 Arial,Helvetica,sans-serif}.receipt-sheet{max-width:760px;margin:28px auto;padding:36px 42px;background:#fff;border:1px solid #e5d9ce;border-top:7px solid #85553a;box-shadow:0 12px 36px rgba(54,36,25,.1)}.receipt-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:24px;border-bottom:1px solid #e9e1d9}.brand{display:flex;align-items:center;gap:13px}.brand-mark{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#85553a;color:#fff;font-family:Georgia,serif;font-size:21px;font-weight:bold}.brand h1{margin:0;font:700 21px Georgia,serif;color:#3e2a1e}.brand p,.receipt-kind p{margin:4px 0 0;color:#76695f}.receipt-kind{text-align:right}.receipt-kind h2{margin:0;font-size:18px;letter-spacing:.1em;text-transform:uppercase;color:#85553a}.paid-tag{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:99px;background:#edf4ee;color:#315b3d;font-size:11px;font-weight:bold;letter-spacing:.08em}.clinic-contact{margin:16px 0 24px;color:#76695f;font-size:12px}.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}.summary-card{padding:14px 16px;border:1px solid #ebe3db;border-radius:8px;background:#fcfaf8}.summary-card span,.section-label{display:block;color:#87766a;font-size:10px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase}.summary-card strong{display:block;margin-top:5px;overflow-wrap:anywhere;font-size:13px}.section-title{margin:22px 0 10px;font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#60432f}.items{width:100%;border-collapse:collapse}.items th{padding:11px 12px;background:#f5eee7;color:#654b39;text-align:left;font-size:10px;letter-spacing:.1em;text-transform:uppercase}.items th:last-child,.items td:last-child{text-align:right}.items td{padding:14px 12px;border-bottom:1px solid #ece5de;vertical-align:top}.items td strong{display:block}.items td small{color:#76695f}.totals{width:min(100%,360px);margin:18px 0 0 auto}.detail-row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;color:#66584e}.detail-row strong{text-align:right;color:#30241e}.detail-row.grand-total{margin-top:6px;padding:12px 0;border-top:2px solid #85553a;font-size:17px;font-weight:bold}.detail-row.grand-total span,.detail-row.grand-total strong{color:#3e2a1e}.cash-details{margin-top:20px;padding:14px 16px;border:1px solid #ebe3db;border-radius:8px}.cash-details h2{margin:0 0 5px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#60432f}.receipt-footer{margin-top:34px;padding-top:18px;border-top:1px dashed #d7c8b9;text-align:center;color:#76695f;font-size:11px}.receipt-footer strong{display:block;margin-bottom:4px;color:#60432f;font-size:13px}.receipt-code{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}@media(max-width:600px){body{background:#fff}.receipt-sheet{margin:0;padding:24px 18px;border:0;border-top:6px solid #85553a;box-shadow:none}.receipt-header{gap:12px}.brand h1{font-size:18px}.summary-grid{grid-template-columns:1fr}.items th,.items td{padding:10px 8px}}@media print{body{background:#fff;font-size:12px}.receipt-sheet{max-width:none;margin:0;padding:0;border:0;border-top:5px solid #85553a;box-shadow:none}.receipt-header{padding-bottom:18px}.receipt-footer{margin-top:24px}}
    </style></head><body><main class="receipt-sheet"><header class="receipt-header"><div class="brand"><span class="brand-mark">AC</span><div><h1>AesthetiCare</h1><p>${dynamic(branchName)}</p></div></div><div class="receipt-kind"><h2>Payment receipt</h2><p>Walk-in service</p><span class="paid-tag">PAID</span></div></header>
    <p class="clinic-contact">${[address, contactNumber ? `Contact: ${contactNumber}` : ''].filter(Boolean).map(dynamic).join(' · ')}</p>
    <section class="summary-grid"><div class="summary-card"><span>Receipt number</span><strong class="receipt-code">${dynamic(receiptNumber)}</strong></div><div class="summary-card"><span>Payment date</span><strong>${dynamic(receiptPaidAt(receipt.createdAt) || 'Payment date unavailable')}</strong></div><div class="summary-card"><span>Paid by</span><strong>${dynamic(receipt.payerName || receipt.clientName || 'Walk-in client')}</strong>${receipt.payerEmail ? `<small>${dynamic(receipt.payerEmail)}</small>` : ''}${receipt.payerPhone ? `<small>${dynamic(receipt.payerPhone)}</small>` : ''}</div><div class="summary-card"><span>Care recipient</span><strong>${dynamic(receipt.clientName || 'Walk-in client')}</strong>${receipt.customerEmail ? `<small>${dynamic(receipt.customerEmail)}</small>` : ''}${receipt.customerPhone ? `<small>${dynamic(receipt.customerPhone)}</small>` : ''}</div></section>
    <h2 class="section-title">Service and appointment</h2><table class="items"><thead><tr><th>Description</th><th>Appointment</th><th>Amount</th></tr></thead><tbody><tr><td><strong>${dynamic(receipt.service || 'Clinic service')}</strong>${receipt.practitionerName ? `<small>Practitioner: ${dynamic(receipt.practitionerName)}</small>` : ''}</td><td>${dynamic(dateLabel(receipt.date))}<br>${dynamic(formatClockTime(receipt.time))}</td><td>${dynamic(currency(pricing?.subtotal ?? receipt.amount ?? receipt.total))}</td></tr></tbody></table>
    <section class="totals">${line('Subtotal', currency(pricing?.subtotal ?? receipt.amount ?? receipt.total))}${line(pricing?.vatApplicable ? 'VAT (12%)' : 'VAT', pricing?.vatApplicable ? currency(pricing.vatAmount) : 'Not applied')}${line('Payment method', receipt.method || 'Cash')}${line('Total paid', currency(total), 'grand-total')}</section>${cashDetails}
    <h2 class="section-title">Payment reference</h2><div class="detail-row"><span>Transaction code</span><strong class="receipt-code">${dynamic(receiptNumber)}</strong></div>${line('Appointment reference', receipt.appointmentId || '')}${line('Service code', receipt.serviceKey || '')}
    <footer class="receipt-footer"><strong>Thank you for choosing AesthetiCare.</strong>Please keep this receipt for your records. This document confirms payment for the service listed above.</footer></main></body></html>`
  popup.document.open()
  popup.document.write(popupHtml)
  popup.document.close()
  window.setTimeout(beginPrint, 250)
  window.setTimeout(() => { if (!popup.closed && !printStarted) { error.value = 'Unable to prepare the receipt for printing.'; popup.close() } }, 1500)
}
onMounted(trackPageLoad(() => load().catch(cause => { error.value = cause.message || 'Unable to load the Walk-In Desk.' })))
onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now(); if (branchId.value && !busy.value) { const refresh = isPosRoute.value ? refreshPaymentQueue() : !createdAppointments.value.length ? refreshAvailability() : null; refresh?.catch(cause => { availabilityReady.value = false; error.value = cause.message || 'Unable to refresh appointment availability.' }) } }, 60000) })
onUnmounted(() => { clearInterval(clockTimer) })
</script>

<style scoped>
.walk-in-desk { background: #fffaf3; color: #493225; }
.walk-in-content { max-width: 1150px; margin: 0 auto; display: grid; gap: 24px; }
.walk-in-progress { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.walk-in-progress-step { display: flex; min-width: 0; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #e7cfb6; border-radius: 13px; background: #fffdf9; color: #654733; text-align: left; transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease; }
.walk-in-progress-step:not(:disabled) { cursor: pointer; }
.walk-in-progress-step:disabled { cursor: default; }
.walk-in-progress-step.is-current { border-color: #a56a43; background: #f6e8d7; box-shadow: 0 0 0 2px rgb(165 106 67 / 12%); color: #493225; }
.walk-in-progress-step.is-complete { border-color: #87a890; background: #edf5ed; color: #355a40; }
.walk-in-step-number { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border-radius: 50%; background: #efe2d2; color: #654733; font-size: 13px; font-weight: 700; }
.is-current .walk-in-step-number { background: #8d5a3b; color: #fff; }
.is-complete .walk-in-step-number { background: #426e56; color: #fff; }
.walk-in-step-copy { display: grid; gap: 3px; min-width: 0; }
.walk-in-step-copy strong { font-size: 13px; }
.walk-in-step-copy small { color: #846950; font-size: 11px; line-height: 1.4; }
.walk-in-step-panel { min-width: 0; }
.new-recipient-form { display: grid; gap: 15px; margin-top: 16px; padding: 18px; border: 1px solid #ead2b7; border-radius: 12px; background: #fff9f0; }
.new-recipient-form > .muted { margin: 0; }
.walk-in-step-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
.walk-in-step-actions > .muted { flex: 1 1 260px; }
.walk-in-review-list { display: grid; width: 100%; gap: 10px; }
.walk-in-review-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 15px 16px; border: 1px solid #ead6c1; border-radius: 11px; background: #fffdf9; color: #493225; }
.walk-in-review-row > div { min-width: 0; }
.walk-in-review-row > div > strong { display: inline-block; margin-right: 8px; }
.walk-in-review-type { display: inline-block; border-radius: 999px; background: #f4e6d5; padding: 3px 8px; color: #795638; font-size: 10px; font-weight: 700; }
.walk-in-review-row p { margin: 5px 0 0; color: #846950; font-size: 12px; }
.walk-in-review-row .walk-in-review-note { color: #765423; }
.walk-in-review-price { display: grid; flex: 0 0 auto; justify-items: end; gap: 4px; color: #426e56; font-size: 14px; text-align: right; }
.walk-in-review-price small { color: #846950; font-size: 10px; font-weight: 500; }
.walk-in-recipient-note, .walk-in-payment-note { width: 100%; margin: 0; color: #765d47; font-size: 12px; line-height: 1.6; }
.walk-in-payment-note { padding: 12px 14px; border: 1px solid #e7cfb6; border-radius: 10px; background: #fff7eb; }
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step {
  background: var(--ac-surface-soft) !important;
  border-color: var(--ac-border) !important;
  color: var(--ac-text-secondary) !important;
  opacity: 1;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step.is-current {
  background: var(--ac-primary) !important;
  border-color: var(--ac-accent) !important;
  color: var(--ac-on-primary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step.is-complete {
  background: var(--ac-success-bg) !important;
  border-color: var(--ac-success) !important;
  color: var(--ac-text-secondary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step .walk-in-step-number {
  background: var(--ac-surface-muted) !important;
  color: var(--ac-text) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step.is-current .walk-in-step-number {
  background: var(--ac-on-primary) !important;
  color: var(--ac-primary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step.is-complete .walk-in-step-number {
  background: var(--ac-success) !important;
  color: var(--ac-bg-deep) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step .walk-in-step-copy small {
  color: var(--ac-text-muted) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-progress-step.is-current .walk-in-step-copy small {
  color: var(--ac-on-primary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button.secondary {
  background: var(--ac-surface-soft) !important;
  border-color: var(--ac-border-strong) !important;
  color: var(--ac-text-secondary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button.secondary:hover:not(:disabled) {
  background: var(--ac-surface-muted) !important;
  border-color: var(--ac-accent) !important;
  color: var(--ac-text) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button.primary {
  background: var(--ac-primary) !important;
  border-color: var(--ac-primary) !important;
  color: var(--ac-on-primary) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button.primary:hover:not(:disabled) {
  background: var(--ac-primary-hover) !important;
  border-color: var(--ac-primary-hover) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button:disabled {
  cursor: not-allowed;
  opacity: 1;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .desk-button.primary:disabled {
  background: var(--ac-surface-muted) !important;
  border-color: var(--ac-border) !important;
  color: var(--ac-text-muted) !important;
}
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-step-copy small,
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-review-row p,
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-review-price small,
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-recipient-note { color: var(--ac-text-muted); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-review-type { background: var(--ac-surface-soft); color: var(--ac-text-secondary); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-review-row .walk-in-review-note { color: var(--ac-warning); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .walk-in-payment-note { background: var(--ac-surface-soft); border-color: var(--ac-border); color: var(--ac-text-secondary); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .new-recipient-form { background: var(--ac-surface-soft); border-color: var(--ac-border); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .new-recipient-form :is(.field-label, .muted) { color: var(--ac-text-secondary); }
:global(html[data-ac-theme="dark"]) .walk-in-desk .new-recipient-form .desk-input { background: var(--ac-bg-deep); border-color: var(--ac-border); color: var(--ac-text); }
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
.price-breakdown { display: grid; gap: 8px; max-width: 430px; margin: 0 0 16px auto; padding: 14px 16px; border: 1px solid #ead2b7; border-radius: 10px; background: #fffaf3; color: #654733; font-size: 13px; }.price-breakdown > div { display: flex; justify-content: space-between; gap: 20px; }.price-breakdown dt, .price-breakdown dd { margin: 0; }.price-breakdown dd { font-weight: 600; }.price-breakdown-total { border-top: 1px solid #ead2b7; padding-top: 8px; color: #493225; font-size: 15px; font-weight: 700; }.booking-price-breakdown { width: 100%; max-width: none; margin: 0; }
.payment-form { display: flex; align-items: flex-end; gap: 14px; max-width: 720px; }.payment-form > div { flex: 1; }.online-checkout-pending { display: grid; gap: 12px; width: 100%; }.online-checkout-pending p { margin: 0; }
.agreement-button { margin-top: 14px; }
.payment-success { padding: 14px; background: #eef6ef; border: 1px solid #cadccc; border-radius: 10px; color: #426e56; font-size: 13px; }.payment-success p { margin: 0 0 8px; }
.desk-alert { padding: 14px 16px; border-radius: 10px; font-size: 13px; }.error { border: 1px solid #e8b6aa; background: #fff0eb; color: #a04432; }.agreement-required { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border: 1px solid #edd19b; background: #fff7e7; color: #765423; }.agreement-required p { margin: 0; }.field-error { color: #a04432; font-size: 12px; margin: 10px 0; }.empty-note { padding: 24px; border: 1px dashed #dec19e; color: #876e59; font-size: 13px; border-radius: 10px; }
.walk-in-desk :deep(.appearance-select) { margin: 0; }.walk-in-desk :deep(.appearance-select-trigger > span) { overflow-wrap: anywhere; }.walk-in-desk :deep(.appearance-select-menu li) { white-space: normal; }
@media (max-width: 750px) { .walk-in-progress { grid-template-columns: minmax(0, 1fr); gap: 8px; }.walk-in-progress-step { padding: 10px 12px; }.walk-in-step-copy small { font-size: 10px; }.walk-in-review-row { flex-direction: column; }.walk-in-review-price { justify-items: start; text-align: left; }.desk-card, .client-card, .visit-card { padding: 16px; }.field-grid, .schedule-grid { grid-template-columns: minmax(0, 1fr); }.payment-form { flex-direction: column; align-items: stretch; }.payment-form > div { width: 100%; } }
</style>
