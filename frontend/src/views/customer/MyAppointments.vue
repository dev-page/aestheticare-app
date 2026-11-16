<template>
  <div class="appointments-shell customer-theme">
    <CustomerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: isUnpaidAppointmentsPage ? 'appointment-cards' : 'appointments', rows: 5 }" class="appointments-main">
      <div class="appointments-content">
        <section class="appointments-header">
          <div>
            <p class="appointments-eyebrow">{{ isUnpaidAppointmentsPage ? 'Payment centre' : 'My care' }}</p>
            <h1 class="appointments-title">{{ isUnpaidAppointmentsPage ? 'Unpaid Appointments' : 'My Appointments' }}</h1>
            <p v-if="isUnpaidAppointmentsPage" class="appointments-subtitle">Sign your agreement and pay within the slot-hold window. Verified payment confirms your appointment.</p>
            <p v-else class="appointments-subtitle">See every request, upcoming visit, online consultation, and completed service in one place.</p>
          </div>
          <button v-if="!isUnpaidAppointmentsPage && unpaidAppointments.length" type="button" class="appointments-pay-link" @click="router.push({ name: 'customer-unpaid-appointments' })">
            Pay {{ unpaidAppointments.length }} unpaid appointment{{ unpaidAppointments.length === 1 ? '' : 's' }}
          </button>
        </section>

        <section v-if="contractsToSign.length" class="appointments-panel">
          <div class="panel-head"><div><p class="panel-kicker">Next step: sign your contract</p><h2 class="panel-title">Review and sign before payment</h2></div></div>
          <p class="p-4 text-sm">Your slot is held for 15 minutes. Review and sign the agreement, then pay. The appointment is confirmed when payment is verified.</p>
          <article v-for="appt in contractsToSign" :key="appt.id" class="unpaid-appointment-card">
            <h3 class="unpaid-appointment-title">{{ formatAppointmentServices(appt) }}</h3>
            <p>{{ appt.clinic }} ? {{ appt.date }} ? {{ formatClockTime(appt.time) }}</p>
            <p v-if="paymentHoldMessage(appt)" class="text-sm font-semibold text-[#8d5a3b]">{{ paymentHoldMessage(appt) }}</p>
            <button v-if="appt.contract?.terms || appt.contract?.templateUrl" type="button" class="appointment-button appointment-button-primary" @click="openContract(appt)">Review &amp; e-sign contract</button>
            <p v-else class="text-sm">Your clinic is preparing the contract. Payment will be available after you sign.</p>
          </article>
        </section>

        <section v-if="bookingOrders.length && !isUnpaidAppointmentsPage" class="appointments-panel">
          <div class="panel-head"><div><p class="panel-kicker">Multiple service booking</p><h2 class="panel-title">Booking orders</h2></div></div>
          <article v-for="order in bookingOrders" :key="order.id" class="unpaid-appointment-card">
            <div class="unpaid-appointment-card-head">
              <div><h3 class="unpaid-appointment-title">{{ formatAppointmentServices(order) }}</h3><p>{{ order.clinic }}</p></div>
              <span class="status-badge" :class="statusToneClass(order.status)">{{ order.status }}</span>
            </div>
            <p class="mt-2">{{ order.appointmentIds?.length || 0 }} separately scheduled services · Total ₱{{ Number(order.totalAmount || order.amount || 0).toFixed(2) }}</p>
            <p v-if="paymentHoldMessage(order)" class="mt-2 text-sm font-semibold text-[#8d5a3b]">{{ paymentHoldMessage(order) }}</p>
            <button type="button" class="appointment-button appointment-button-secondary justify-self-start" @click="openAppointmentDetails(order)">View booking details</button>
            <p v-if="order.approvalStatus !== 'Approved'" class="mt-2 text-sm">This booking is waiting for clinic review.</p>
            <p v-else-if="paymentDue(order) <= 0" class="mt-2 text-sm">This order is fully paid.</p>
            <button v-else-if="bookingOrderReady(order) && paymentDue(order) > 0" type="button" class="appointment-button appointment-button-primary mt-3" @click="payAppointment(order)">Pay order {{ formatBookingDue(order) }}</button>
            <p v-else class="mt-2 text-sm">Sign the agreement for each appointment before paying for this order.</p>
          </article>
        </section>

        <section v-if="isUnpaidAppointmentsPage" class="appointments-panel unpaid-appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Payment Required</p>
              <h2 class="panel-title">Appointments with a payment due</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading appointments...' : `${unpaidAppointments.length} appointment${unpaidAppointments.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <PageSectionSkeleton variant="cards" :rows="3" :columns="2" />
          </div>

          <div v-else-if="unpaidAppointments.length" class="unpaid-appointments-grid">
            <article v-for="appt in unpaidAppointments" :key="appt.id" class="unpaid-appointment-card">
              <div class="unpaid-appointment-card-head">
                <div>
                  <p class="panel-kicker">{{ appt.clinic }}</p>
                  <h3 class="unpaid-appointment-title">{{ formatAppointmentServices(appt) }}</h3>
                </div>
                <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span><OnlineConsultationClock :appointment="appt" />
              </div>

              <p v-if="paymentHoldMessage(appt)" class="text-sm font-semibold text-[#8d5a3b]">{{ paymentHoldMessage(appt) }}</p>

              <dl class="unpaid-appointment-details">
                <div><dt>Date</dt><dd>{{ appt.date }}</dd></div>
                <div><dt>Time</dt><dd>{{ formatClockTime(appt.time) }}</dd></div>
                <div><dt>Amount due</dt><dd>{{ formatBookingDue(appt) }}</dd></div>
              </dl>

              <div class="payment-agreement">
                <p v-if="appt.installmentsAllowed && !initialPaymentReceived(appt)">Initial payment: {{ appt.depositPercent }}% of the total. The balance is due after you confirm the service is done.</p>
                <dl v-if="appt.pricingSnapshot" class="payment-price-breakdown">
                  <div><dt>Subtotal</dt><dd>{{ formatPricingAmount(appt.pricingSnapshot.subtotal) }}</dd></div>
                  <div><dt>VAT</dt><dd>{{ appt.pricingSnapshot.vatApplicable ? `${formatPricingAmount(appt.pricingSnapshot.vatAmount)} (12%${appt.pricingSnapshot.vatPriceMode === 'inclusive' ? ', included' : ''})` : 'No VAT' }}</dd></div>
                  <div class="payment-price-total"><dt>Total</dt><dd>{{ formatPricingAmount(appt.pricingSnapshot.total) }}</dd></div>
                  <div><dt>Paid to date</dt><dd>{{ formatPricingAmount(appt.amountPaid || 0) }}</dd></div>
                  <div><dt>Remaining balance</dt><dd>{{ formatPricingAmount(Math.max(0, Number(appt.pricingSnapshot.total || appt.totalAmount || appt.amount || 0) - Number(appt.amountPaid || 0))) }}</dd></div>
                </dl>
                <p v-else class="payment-agreement-copy">Tax breakdown unavailable for this booking. Amount due: {{ formatBookingDue(appt) }}.</p>
                <details class="payment-agreement-details" @toggle="markPaymentAgreementViewed(appt.id, $event)">
                  <summary>View clinic policies</summary>
                  <div v-if="getAppointmentPolicyEntries(appt).length" class="payment-agreement-copy">
                    <p v-for="policy in getAppointmentPolicyEntries(appt)" :key="policy.key"><strong>{{ policy.label }}:</strong> {{ policy.text }}</p>
                  </div>
                  <p v-else class="payment-agreement-copy">I understand that payment is for the selected clinic service and is subject to the clinic's booking, cancellation, rescheduling, and refund terms.</p>
                </details>
                <p class="text-sm">Contract signed. You can now proceed to payment.</p>
              </div>

              <div class="unpaid-appointment-actions">
                <button type="button" class="appointment-button appointment-button-primary" @click="payAppointment(appt)">Pay {{ formatBookingDue(appt) }}</button>
                <button v-if="canModifyUnpaidAppointment(appt) && canRequestReschedule(appt)" type="button" class="appointment-button appointment-button-secondary" :disabled="isRequestPending(appt, 'reschedule')" @click="openRequestModal('reschedule', appt)">{{ isRequestPending(appt, 'reschedule') ? 'Pending Approval' : 'Reschedule' }}</button>
                <button v-if="canModifyUnpaidAppointment(appt) && canRequestCancellation(appt)" type="button" class="appointment-button appointment-button-danger" :disabled="isRequestPending(appt, 'cancel')" @click="openRequestModal('cancel', appt)">{{ isRequestPending(appt, 'cancel') ? 'Pending Approval' : 'Cancel' }}</button>
              </div>
            </article>
          </div>

          <div v-else class="state-panel">No appointments are waiting for payment.</div>
        </section>

        <template v-if="!isUnpaidAppointmentsPage">
        <nav class="appointments-tabs" aria-label="Appointment sections">
          <button type="button" :class="['appointments-tab', { 'appointments-tab-active': activeAppointmentTab === 'upcoming' }]" @click="activeAppointmentTab = 'upcoming'">Upcoming <span>{{ activeUpcomingAppointments.length }}</span></button>
          <button type="button" :class="['appointments-tab', { 'appointments-tab-active': activeAppointmentTab === 'online' }]" @click="activeAppointmentTab = 'online'">Online consultations <span>{{ upcomingOnlineConsultations.length }}</span></button>
          <button type="button" :class="['appointments-tab', { 'appointments-tab-active': activeAppointmentTab === 'sessions' }]" @click="activeAppointmentTab = 'sessions'">Treatment sessions <span>{{ treatmentSessions.length }}</span></button>
          <button type="button" :class="['appointments-tab', { 'appointments-tab-active': activeAppointmentTab === 'history' }]" @click="activeAppointmentTab = 'history'">History <span>{{ pastRecords.length }}</span></button>
        </nav>

        <section v-if="activeAppointmentTab === 'sessions'" class="appointments-panel">
          <div class="panel-head"><div><p class="panel-kicker">Treatment Plans</p><h2 class="panel-title">My Treatment Sessions</h2></div><p class="panel-note">{{ treatmentSessions.length }} visit{{ treatmentSessions.length === 1 ? '' : 's' }}</p></div>
          <div v-if="treatmentPlanGroups.length" class="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <article v-for="plan in treatmentPlanGroups" :key="plan.id" class="rounded-xl border border-[#e6cfb0] bg-[#fffaf3] p-4 text-[#3d281d]">
              <div class="flex flex-wrap items-start justify-between gap-2"><div><p class="text-xs font-semibold uppercase tracking-[.15em] text-[#8b6a4d]">Treatment course</p><h3 class="mt-1 font-semibold">{{ plan.name }}</h3></div><strong class="rounded-full bg-[#f1e3d0] px-3 py-1 text-sm">{{ plan.completedCount }} of {{ plan.totalSessions }} complete</strong></div>
              <div v-if="plan.nextSession" class="mt-3 border-t border-[#ead8c0] pt-3 text-sm"><p><strong>Next visit:</strong> {{ plan.nextSession.serviceName }} · Visit {{ plan.nextSession.sessionNumber }}</p><p class="mt-1 text-[#765b45]">{{ plan.nextSessionStatus }}<span v-if="plan.nextSession.earliestScheduleDate"> · Eligible from {{ formatCourseDate(plan.nextSession.earliestScheduleDate) }}</span></p></div>
              <p v-else class="mt-3 border-t border-[#ead8c0] pt-3 text-sm text-[#765b45]">All visits in this treatment course are resolved.</p>
            </article>
          </div>
          <div v-if="treatmentSessions.length" class="appointments-table-wrap"><table class="appointments-table"><thead><tr><th>Visit</th><th>Treatment</th><th>Date &amp; Time</th><th>Status</th><th>Action</th></tr></thead><tbody><tr v-for="session in treatmentSessionsForDisplay" :key="session.id"><td>Visit {{ session.sessionNumber }} of {{ session.totalSessions }}</td><td>{{ session.serviceName }}</td><td>{{ session.date ? `${formatCourseDate(session.date)} ${formatClockTime(session.time)}` : session.requestedDate ? `Requested: ${formatCourseDate(session.requestedDate)} ${formatClockTime(session.requestedTime)}` : session.earliestScheduleDate ? `Eligible from ${formatCourseDate(session.earliestScheduleDate)}` : 'Not scheduled yet' }}</td><td>{{ session.status }}</td><td><button v-if="session.status === 'Schedule Proposed'" type="button" class="appointment-button appointment-button-secondary" @click="confirmSessionSchedule(session)">Confirm proposed date</button><button v-if="canRequestSessionSchedule(session)" type="button" class="appointment-button appointment-button-secondary" @click="openRequestModal('session', session)">{{ session.status === 'Scheduled' ? 'Request reschedule' : 'Request schedule' }}</button><span v-else-if="String(session.status || '').toLowerCase().includes('requested')" class="text-sm text-[#7f6654]">Awaiting clinic review</span><span v-else class="text-sm text-[#7f6654]">{{ session.sessionNumber > 1 ? 'Available after the prior visit is resolved' : '' }}</span></td></tr></tbody></table></div>
          <div v-else class="state-panel">No treatment sessions have been scheduled yet.</div>
        </section>
        <section v-if="activeAppointmentTab === 'online'" class="appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Virtual Visits</p>
              <h2 class="panel-title">Upcoming Online Consultations</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading consultations...' : `${upcomingOnlineConsultations.length} consultation${upcomingOnlineConsultations.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <PageSectionSkeleton variant="table" :rows="4" :columns="7" />
          </div>

          <div v-else class="appointments-table-wrap">
            <table class="appointments-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Meeting Link</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appt in upcomingOnlineConsultations" :key="appt.id">
                  <td class="appointment-service-cell" data-label="Service">
                    <div class="table-primary">{{ formatAppointmentServices(appt) }}</div>
                    <div class="table-secondary">Online consultation</div>
                    <span v-if="appt.demoMode" class="status-badge">DEMO · No charge</span>
                  </td>
                  <td data-label="Clinic">
                    <div class="table-primary">{{ appt.clinic }}</div>
                  </td>
                  <td data-label="Date">{{ appt.date }}</td>
                  <td data-label="Time">{{ formatClockTime(appt.time) }}</td>
                  <td data-label="Meeting Link">
                    <span class="table-secondary">{{ appt.meetLink ? 'Meet invitation ready' : appt.consultationCustomerReadyAt ? 'You are in the virtual waiting room' : 'Waiting for check-in' }}</span>
                    <span v-if="appt.consultationCustomerReadyAt && !appt.consultationInviteAt" class="table-secondary">Your practitioner will invite you to Meet when ready.</span>
                    <span v-if="appt.serviceKey && normalizeAppointmentStatus(appt.contract?.status) === 'signed' && initialPaymentReceived(appt) && !appt.consultationCustomerReadyAt" class="appointment-menu-key">In-app check-in code: <strong class="font-mono text-base">{{ appt.serviceKey }}</strong></span>
                  </td>
                  <td data-label="Status">
                    <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span><OnlineConsultationClock :appointment="appt" />
                    <p v-if="normalizeAppointmentStatus(appt.status) === 'cancellation requested'" class="table-secondary">The clinic is reviewing your request. Your appointment remains scheduled until it is approved.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Processing'" class="table-secondary">Cancellation approved. Your refund is processing.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Requested'" class="table-secondary">Cancellation approved. The clinic is checking the refund with the payment provider.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Refunded'" class="table-secondary">Cancellation approved. The clinic or payment provider confirmed the refund.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Not Applicable'" class="table-secondary">Cancellation approved. No refund was due under the recorded payment and policy.</p>
                    <p v-if="['awaiting customer confirmation', 'balance due'].includes(normalizeAppointmentStatus(appt.status)) && canConfirmCompletion(appt)" class="table-secondary">The clinic marked this consultation complete. Confirm receipt when you are ready.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'awaiting customer confirmation' && !appt.customerCompleted" class="table-secondary">The consultation is waiting for required notes or clinic review. You can report a problem in Consultation controls.</p>
                  </td>
                  <td data-label="Actions">
                    <div class="table-actions">
                      <button type="button" class="appointment-button appointment-button-secondary" @click="openAppointmentDetails(appt)">View details</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!upcomingOnlineConsultations.length">
                  <td colspan="7" class="table-empty-cell" data-label="">No online consultations yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeAppointmentTab === 'upcoming'" class="appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Active Bookings</p>
              <h2 class="panel-title">Upcoming Appointments</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading appointments...' : `${activeUpcomingAppointments.length} appointment${activeUpcomingAppointments.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <PageSectionSkeleton variant="table" :rows="4" :columns="6" />
          </div>

          <div v-else class="appointments-table-wrap">
            <table class="appointments-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appt in activeUpcomingAppointments" :key="appt.id">
                  <td class="appointment-service-cell" data-label="Service">
                    <div class="table-primary">{{ formatAppointmentServices(appt) }}</div>
                    <span v-if="appt.demoMode" class="status-badge mt-2">DEMO · No charge; no service is scheduled</span>
                  </td>
                  <td data-label="Clinic">
                    <div class="table-primary">{{ appt.clinic }}</div>
                  </td>
                  <td data-label="Date">{{ appt.date }}</td>
                  <td data-label="Time">{{ formatClockTime(appt.time) }}</td>
                  <td data-label="Status">
                    <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span><OnlineConsultationClock :appointment="appt" />
                    <p v-if="normalizeAppointmentStatus(appt.status) === 'cancellation requested'" class="table-secondary">The clinic is reviewing your request. Your appointment remains scheduled until it is approved.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Processing'" class="table-secondary">Cancellation approved. Your refund is processing.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Requested'" class="table-secondary">Cancellation approved. The clinic is checking the refund with the payment provider.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Refunded'" class="table-secondary">Cancellation approved. The clinic or payment provider confirmed the refund.</p>
                    <p v-else-if="normalizeAppointmentStatus(appt.status) === 'cancelled' && appt.refundStatus === 'Not Applicable'" class="table-secondary">Cancellation approved. No refund was due under the recorded payment and policy.</p>
                    <p v-if="appt.sameDayTreatmentAppointmentId" class="table-secondary">Same-day request: consultation first, then {{ appt.sameDayTreatmentName || 'your provisional treatment' }}. The treatment slot is provisional until practitioner clearance.</p>
                    <p v-if="appt.sameDayTreatmentStatus === 'pending_clinical_clearance'" class="table-secondary">The consultation must be completed first. The treatment slot is provisional; signing and payment unlock only after the practitioner clears it.</p>
                    <p v-else-if="appt.sameDayTreatmentStatus === 'cleared'" class="table-secondary">The practitioner cleared today’s treatment. Review and sign its agreement, then pay before check-in.</p>
                    <p v-if="['awaiting customer confirmation', 'balance due'].includes(normalizeAppointmentStatus(appt.status)) && canConfirmCompletion(appt)" class="table-secondary">The practitioner marked this service complete. Confirm receipt when you are ready.</p>
                  </td>
                  <td data-label="Actions">
                    <div class="table-actions">
                      <button type="button" class="appointment-button appointment-button-secondary" @click="openAppointmentDetails(appt)">View details</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!activeUpcomingAppointments.length">
                  <td colspan="6" class="table-empty-cell" data-label="">No upcoming appointments.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="activeAppointmentTab === 'history'" class="appointments-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">History</p>
              <h2 class="panel-title">Booking History</h2>
            </div>
            <p class="panel-note">{{ loading ? 'Loading appointments...' : `${pastRecords.length} record${pastRecords.length === 1 ? '' : 's'}` }}</p>
          </div>

          <div v-if="loading" class="state-panel">
            <PageSectionSkeleton variant="table" :rows="4" :columns="6" />
          </div>

          <div v-else class="appointments-table-wrap">
            <table class="appointments-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Clinic</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="appt in pastRecords" :key="appt.id">
                  <td class="appointment-service-cell" data-label="Service">
                    <div class="table-primary">{{ formatAppointmentServices(appt) }}</div>
                    <div v-if="appt.followUpRecommended" class="mt-2">
                      <span class="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        Follow-up recommended
                      </span>
                      <p v-if="appt.followUpRecommendationNote" class="mt-1 max-w-xs text-xs text-slate-600">
                        {{ appt.followUpRecommendationNote }}
                      </p>
                    </div>
                  </td>
                  <td data-label="Clinic">
                    <div class="table-primary">{{ appt.clinic }}</div>
                  </td>
                  <td data-label="Date">{{ appt.date }}</td>
                  <td data-label="Time">{{ formatClockTime(appt.time) }}</td>
                  <td data-label="Status">
                    <span class="status-badge" :class="statusToneClass(appt.status)">{{ appt.status }}</span><OnlineConsultationClock :appointment="appt" />
                  </td>
                  <td data-label="Actions">
                    <div class="table-actions">
                      <button
                        v-if="canBookFollowUp(appt) && !hasOpenFollowUp(appt)"
                        type="button"
                        class="appointment-button appointment-button-secondary"
                        @click="bookFollowUp(appt)"
                      >
                        Book Follow-up
                      </button>
                      <button
                        v-if="normalizeAppointmentStatus(appt.status) === 'completed'"
                        type="button"
                        class="appointment-button appointment-button-secondary"
                        @click="openFeedback(appt)"
                      >
                        Leave optional feedback
                      </button>
                      <span v-if="hasOpenFollowUp(appt)" class="table-secondary">
                        {{ followUpBookingStatus(appt) }}
                      </span>
                      <span v-else-if="followUpAvailabilityMessage(appt)" class="table-secondary">
                        {{ followUpAvailabilityMessage(appt) }}
                      </span>
                      <button type="button" class="appointment-button appointment-button-secondary" @click="openAppointmentDetails(appt)">View details</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!pastRecords.length">
                  <td colspan="6" class="table-empty-cell" data-label="">No past records.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        </template>
      </div>

      <div v-if="requestModal.open" class="request-modal-overlay">
        <div class="request-modal-shell">
          <div class="request-modal-head">
            <div>
              <p class="request-modal-kicker">
                {{ requestModal.type === 'cancel' ? 'Cancellation Request' : requestModal.type === 'session' ? 'Treatment Session Request' : 'Reschedule Request' }}
              </p>
              <h3 class="request-modal-title">
                {{ requestModal.type === 'cancel' ? 'Request Appointment Cancellation' : requestModal.type === 'session' ? 'Request Treatment Session Schedule' : 'Request Appointment Reschedule' }}
              </h3>
              <p class="request-modal-summary">
                {{ requestModal.appointment ? (requestModal.type === 'session' ? `Session ${requestModal.appointment.sessionNumber} of ${requestModal.appointment.totalSessions}` : `${formatAppointmentServices(requestModal.appointment)} - ${requestModal.appointment.date} - ${formatClockTime(requestModal.appointment.time)}`) : '' }}
              </p>
            </div>
            <button type="button" class="request-close-button" @click="closeRequestModal">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>

          <div class="request-modal-body">
            <div v-if="requestPolicyText" class="request-policy-card">
              <p class="request-policy-title">Clinic policy</p>
              <p class="mt-2 whitespace-pre-wrap">{{ requestPolicyText }}</p>
              <p class="mt-3">
                {{ requestModal.type === 'cancel'
                  ? cancellationRefundSummary
                  : `The clinic reviews your request. The preferred slot is checked again on approval and is not held while you wait.` }}
              </p>
              <p v-if="requestModal.type === 'reschedule' || requestModal.type === 'session'" class="mt-2">{{ requestRescheduleAllowanceText }}</p>
            </div>

            <div>
              <label class="request-field-label">Reason *</label>
              <textarea
                v-model.trim="requestModal.reason"
                rows="4"
                class="request-textarea"
                placeholder="Tell the clinic why you need this request."
              ></textarea>
            </div>

            <div v-if="requestModal.type === 'reschedule' || requestModal.type === 'session'" class="request-reschedule-grid">
              <div class="request-card">
                <div class="request-card-head">
                  <button
                    type="button"
                    class="request-nav-button"
                    :disabled="!canGoToPreviousRequestMonth"
                    @click="changeRequestCalendarMonth(-1)"
                  >
                    Prev
                  </button>
                  <p class="request-card-title">{{ requestCalendarMonthLabel }}</p>
                  <button
                    type="button"
                    class="request-nav-button"
                    :disabled="!canGoToNextRequestMonth"
                    @click="changeRequestCalendarMonth(1)"
                  >
                    Next
                  </button>
                </div>

                <div class="request-weekdays">
                  <span v-for="day in requestCalendarWeekdays" :key="day">{{ day }}</span>
                </div>

                <div class="request-calendar-grid">
                  <button
                    v-for="day in requestCalendarDays"
                    :key="day.dateKey"
                    type="button"
                    class="request-day-button"
                    :class="[
                      day.inCurrentMonth ? 'request-day-current' : 'request-day-other',
                      day.isAvailable ? 'request-day-available' : 'request-day-disabled',
                      day.isSelected ? 'request-day-selected' : '',
                    ]"
                    :disabled="!day.isAvailable"
                    @click="selectRequestDate(day.dateKey)"
                  >
                    <span class="text-sm font-semibold">{{ day.dayNumber }}</span>
                    <span class="request-day-dot"></span>
                  </button>
                </div>

                <p class="request-selected-date">{{ requestSelectedDateLabel }}</p>
              </div>

              <div class="request-card">
                <div class="request-card-head request-card-head-stack">
                  <div>
                    <p class="request-card-kicker">Preferred Schedule</p>
                    <h4 class="request-card-title">Choose a time to request</h4>
                  </div>
                  <span class="request-duration-pill">
                    {{ requestBookingDurationMinutes }} mins
                  </span>
                </div>

                <p class="mb-3 text-xs leading-5 text-[#7f6654]">Times are shown only when the full appointment fits both the clinic’s opening hours and the practitioner’s published hours. Availability is checked again when you submit.</p>

                <div v-if="requestModal.loadingAvailability" class="request-info-card">
                  Loading published hours...
                </div>
                <div v-else-if="requestModal.availabilityError" class="request-info-card request-info-card-warn">
                  {{ requestModal.availabilityError }}
                </div>
                <div v-else-if="requestSlotsForSelectedDate.length" class="request-slot-list">
                  <button
                    v-for="slot in requestSlotsForSelectedDate"
                    :key="slot.key"
                    type="button"
                    class="request-slot-button"
                    :class="requestModal.requestedSlotKey === slot.key ? 'request-slot-button-selected' : ''"
                    @click="selectRequestSlot(slot)"
                  >
                    <div class="text-base font-semibold">Starts at {{ minutesToTime12(parseClockToMinutes(slot.time)) }}</div>
                    <div class="mt-1 text-xs text-[#7f6654]">{{ slot.practitionerName }}</div>
                  </button>
                </div>
                <div v-else class="request-info-card request-info-card-muted">
                  {{ requestModal.requestedDate ? 'No published working hours are available on this date.' : 'Choose a date from the calendar to view requestable times.' }}
                </div>

                <div class="request-detail-list">
                  <p>
                    Assigned Practitioner:
                    <span class="request-detail-strong">
                      {{ requestModalPractitioner?.fullName || requestModal.appointment?.assignedPractitionerName || requestModal.appointment?.practitionerName || 'Assigned Practitioner' }}
                    </span>
                  </p>
                  <p>
                    Total duration:
                    <span class="request-detail-strong">{{ requestBookingDurationMinutes }} mins</span>
                  </p>
                </div>
              </div>
            </div>

            <div class="request-modal-actions">
              <p class="request-action-note">
                {{ requestModal.type === 'cancel'
                  ? 'The clinic will review this cancellation request before it is finalized.'
                  : 'The clinic will review this request before the schedule change is finalized.' }}
              </p>
              <div class="request-action-buttons">
                <button
                  type="button"
                  class="request-button request-button-secondary"
                  @click="closeRequestModal"
                >
                  Close
                </button>
                <button
                  type="button"
                  class="request-button request-button-primary"
                  :disabled="!String(requestModal.reason || '').trim() || (['reschedule', 'session'].includes(requestModal.type) && (requestModal.loadingAvailability || !requestModal.requestedSlotKey))"
                  @click="submitRequest"
                >
                  {{ requestModal.type === 'cancel' ? 'Submit Cancellation' : requestModal.type === 'session' ? 'Submit Schedule Request' : 'Submit Reschedule' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <div v-if="selectedAppointmentDetails" class="appointment-details-overlay" @click.self="closeAppointmentDetails" @keydown.esc="closeAppointmentDetails">
      <section class="appointment-details-shell" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
        <header class="appointment-details-header">
          <div>
            <p class="appointment-details-kicker">{{ selectedAppointmentDetails.isBookingOrderParent ? 'Booking order' : 'Appointment details' }}</p>
            <h2 id="appointment-details-title" class="appointment-details-title">{{ formatAppointmentServices(selectedAppointmentDetails) }}</h2>
            <p class="appointment-details-subtitle">{{ selectedAppointmentDetails.clinic }}<span v-if="selectedAppointmentDetails.branchName"> · {{ selectedAppointmentDetails.branchName }}</span></p>
          </div>
          <div class="appointment-details-header-actions">
            <span class="status-badge" :class="statusToneClass(selectedAppointmentDetails.status)">{{ selectedAppointmentDetails.status }}</span>
            <button type="button" class="request-close-button" aria-label="Close appointment details" @click="closeAppointmentDetails"><span class="text-xl leading-none">&times;</span></button>
          </div>
        </header>

        <div class="appointment-details-body">
          <section class="appointment-details-section">
            <h3>Booking information</h3>
            <dl class="appointment-details-facts">
              <div><dt>Booked on</dt><dd>{{ formatReceiptDateTime(selectedAppointmentDetails.createdAt) }}</dd></div>
              <div><dt>Customer</dt><dd>{{ selectedAppointmentDetails.customerName || auth.currentUser?.displayName || 'Customer' }}</dd></div>
              <div><dt>Practitioner</dt><dd>{{ selectedAppointmentDetails.practitionerName || selectedAppointmentDetails.assignedPractitionerName || selectedAppointmentDetails.practitioner || 'Not assigned' }}</dd></div>
              <div><dt>Appointment code</dt><dd class="appointment-details-code">{{ selectedAppointmentDetails.id }}</dd></div>
            </dl>
          </section>

          <section class="appointment-details-section">
            <div class="appointment-details-section-head"><h3>Services and schedule</h3><span>{{ appointmentScheduleRows.length }} {{ appointmentScheduleRows.length === 1 ? 'visit' : 'visits' }}</span></div>
            <div class="appointment-details-schedule-list">
              <article v-for="(visit, index) in appointmentScheduleRows" :key="visit.id || `${selectedAppointmentDetails.id}-${index}`" class="appointment-details-schedule-row">
                <div><strong>{{ visit.serviceName }}</strong><span v-if="visit.sessionLabel">{{ visit.sessionLabel }}</span></div>
                <div class="appointment-details-visit-time"><strong>{{ visit.date ? formatCourseDate(visit.date) : 'Not scheduled yet' }}</strong><span>{{ visit.time ? formatClockTime(visit.time) : visit.status || 'Time not set' }}</span></div>
                <span v-if="visit.status" class="appointment-details-visit-status">{{ visit.status }}</span>
              </article>
            </div>
          </section>

          <section class="appointment-details-section">
            <div class="appointment-details-section-head"><h3>Price summary</h3><span>{{ selectedAppointmentDetails.paymentStatus || (Number(selectedAppointmentDetails.amountPaid || 0) > 0 ? 'Partially paid' : 'Payment due') }}</span></div>
            <dl class="appointment-details-price-list">
              <div><dt>Subtotal</dt><dd>{{ formatPricingAmount(selectedAppointmentDetails.pricingSnapshot?.subtotal ?? selectedAppointmentDetails.totalAmount ?? selectedAppointmentDetails.amount ?? 0) }}</dd></div>
              <div v-if="Number(selectedAppointmentDetails.pricingSnapshot?.discountAmount || selectedAppointmentDetails.pricingSnapshot?.discount || 0) > 0"><dt>Discount</dt><dd>−{{ formatPricingAmount(selectedAppointmentDetails.pricingSnapshot?.discountAmount ?? selectedAppointmentDetails.pricingSnapshot?.discount) }}</dd></div>
              <div><dt>VAT</dt><dd>{{ selectedAppointmentDetails.pricingSnapshot?.vatApplicable ? `${formatPricingAmount(selectedAppointmentDetails.pricingSnapshot?.vatAmount || 0)} (12%${selectedAppointmentDetails.pricingSnapshot?.vatPriceMode === 'inclusive' ? ', included' : ''})` : 'No VAT' }}</dd></div>
              <div class="appointment-details-price-total"><dt>Total price</dt><dd>{{ formatPricingAmount(selectedAppointmentDetails.pricingSnapshot?.total ?? selectedAppointmentDetails.totalAmount ?? selectedAppointmentDetails.amount ?? 0) }}</dd></div>
              <div><dt>Paid to date</dt><dd>{{ formatPricingAmount(selectedAppointmentDetails.amountPaid || 0) }}</dd></div>
              <div><dt>Balance</dt><dd>{{ formatPricingAmount(Math.max(0, Number(selectedAppointmentDetails.pricingSnapshot?.total ?? selectedAppointmentDetails.totalAmount ?? selectedAppointmentDetails.amount ?? 0) - Number(selectedAppointmentDetails.amountPaid || 0))) }}</dd></div>
            </dl>
          </section>

          <section class="appointment-details-section">
            <div class="appointment-details-section-head"><h3>Payments and receipts</h3><span v-if="!appointmentPaymentsLoading">{{ appointmentPayments.length }} verified {{ appointmentPayments.length === 1 ? 'payment' : 'payments' }}</span></div>
            <p v-if="appointmentPaymentsLoading" class="appointment-details-note" aria-live="polite">Loading payment records…</p>
            <p v-else-if="appointmentPaymentsError" class="appointment-details-note appointment-details-note-error" role="alert">{{ appointmentPaymentsError }}</p>
            <div v-else-if="appointmentPayments.length" class="appointment-details-payments">
              <article v-for="payment in appointmentPayments" :key="payment.id" class="appointment-details-payment-row">
                <div class="appointment-details-payment-info">
                  <strong>{{ formatPricingAmount(payment.amount) }} · {{ payment.method || 'Online payment' }}</strong>
                  <span>{{ payment.paidAtSource === 'provider' ? 'Paid' : 'Recorded' }} {{ formatReceiptDateTime(payment.paidAt) }}<span v-if="payment.paidAtSource !== 'provider'"> · provider payment time was not retained</span></span>
                  <span>Transaction code: <code>{{ payment.transactionCode }}</code></span>
                  <span v-if="payment.referenceNumber">Payment reference: <code>{{ payment.referenceNumber }}</code></span>
                  <span v-if="payment.paymentId">Payment ID: <code>{{ payment.paymentId }}</code></span>
                </div>
                <button type="button" class="appointment-button appointment-button-secondary" @click="downloadAppointmentReceipt(payment)">Download PDF receipt</button>
              </article>
            </div>
            <p v-else class="appointment-details-note">No verified payment is recorded for this booking yet. A downloadable receipt appears here after payment is verified.</p>
          </section>

          <section v-if="selectedAppointmentDetails.serviceKey || selectedAppointmentDetails.treatmentNotes || selectedAppointmentDetails.aftercareInstructions" class="appointment-details-section">
            <h3>Service notes</h3>
            <p v-if="selectedAppointmentDetails.serviceKey && initialPaymentReceived(selectedAppointmentDetails)"><strong>Check-in code:</strong> <code>{{ selectedAppointmentDetails.serviceKey }}</code></p>
            <p v-if="selectedAppointmentDetails.treatmentNotes"><strong>Practitioner notes:</strong> {{ selectedAppointmentDetails.treatmentNotes }}</p>
            <p v-if="selectedAppointmentDetails.aftercareInstructions"><strong>Aftercare:</strong> {{ selectedAppointmentDetails.aftercareInstructions }}</p>
          </section>
        </div>

        <footer class="appointment-details-actions">
          <p v-if="selectedAppointmentDetails.consultationCustomerReadyAt && !selectedAppointmentDetails.consultationInviteAt" class="appointment-details-note">You are checked in. Wait here for your practitioner's Meet invitation.</p>
          <div class="appointment-details-action-buttons">
            <button v-if="isOnlineConsultationAppointment(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => selectedOnlineConsultation = selectedAppointmentDetails)">Consultation controls</button>
            <button v-if="selectedAppointmentDetails.contract && selectedAppointmentDetails.approvalStatus === 'Approved' && selectedAppointmentDetails.sameDayTreatmentStatus !== 'pending_clinical_clearance'" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => openContract(selectedAppointmentDetails))">{{ normalizeAppointmentStatus(selectedAppointmentDetails.contract.status) === 'signed' ? 'View contract' : 'Review and sign' }}</button>
            <button v-if="canPayAppointment(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-primary" @click="runAppointmentDetailsAction(() => payAppointment(selectedAppointmentDetails))">Pay {{ formatBookingDue(selectedAppointmentDetails) }}</button>
            <button v-if="isOnlineConsultationAppointment(selectedAppointmentDetails) && !selectedAppointmentDetails.meetLink && !selectedAppointmentDetails.consultationCustomerReadyAt" type="button" class="appointment-button appointment-button-secondary" :disabled="serviceKeyVerifying || isCancelledAppointment(selectedAppointmentDetails) || selectedAppointmentDetails.approvalStatus !== 'Approved' || selectedAppointmentDetails.contract?.status !== 'signed' || !initialPaymentReceived(selectedAppointmentDetails)" @click="runAppointmentDetailsAction(() => selectedAppointmentDetails.serviceKey ? submitServiceKey(selectedAppointmentDetails.serviceKey, selectedAppointmentDetails) : verifyServiceKey(selectedAppointmentDetails))">{{ selectedAppointmentDetails.serviceKey ? 'Check in with saved code' : 'Enter check-in code' }}</button>
            <button v-if="selectedAppointmentDetails.meetLink && onlineAccessOpen(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-primary" @click="runAppointmentDetailsAction(() => openMeetLink(selectedAppointmentDetails))">Join Google Meet</button>
            <button v-if="selectedAppointmentDetails.meetLink && onlineAccessOpen(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => copyMeetLink(selectedAppointmentDetails))">Copy Meet link</button>
            <button v-if="selectedAppointmentDetails.status === 'Ongoing' && !selectedAppointmentDetails.consultationClientEndedAt" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => endConsultationParticipation(selectedAppointmentDetails))">End consultation participation</button>
            <button v-if="canConfirmCompletion(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-primary" @click="runAppointmentDetailsAction(() => confirmCompletion(selectedAppointmentDetails))">Confirm service received</button>
            <button v-if="canRequestReschedule(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-secondary" :disabled="isRequestPending(selectedAppointmentDetails, 'reschedule')" @click="runAppointmentDetailsAction(() => openRequestModal('reschedule', selectedAppointmentDetails))">{{ isRequestPending(selectedAppointmentDetails, 'reschedule') ? 'Reschedule pending' : 'Request reschedule' }}</button>
            <button v-if="canRequestCancellation(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-danger" :disabled="isRequestPending(selectedAppointmentDetails, 'cancel')" @click="runAppointmentDetailsAction(() => openRequestModal('cancel', selectedAppointmentDetails))">{{ isRequestPending(selectedAppointmentDetails, 'cancel') ? 'Cancellation pending' : 'Request cancellation' }}</button>
            <button v-if="normalizeAppointmentStatus(selectedAppointmentDetails.status) === 'completed'" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => openFeedback(selectedAppointmentDetails))">Leave feedback</button>
            <button v-if="canBookFollowUp(selectedAppointmentDetails) && !hasOpenFollowUp(selectedAppointmentDetails)" type="button" class="appointment-button appointment-button-secondary" @click="runAppointmentDetailsAction(() => bookFollowUp(selectedAppointmentDetails))">Book follow-up</button>
            <button type="button" class="appointment-button appointment-button-secondary" @click="closeAppointmentDetails">Close</button>
          </div>
        </footer>
      </section>
    </div>
    <OnlineConsultationControls v-if="selectedOnlineConsultation" :key="selectedOnlineConsultation.id" :appointment="selectedOnlineConsultation" customer auto-open @close="selectedOnlineConsultation = null" />
    <BookingContractModal
      :visible="showContractModal"
      :appointment="selectedContractAppointment"
      @close="closeContract"
      @updated="contractUpdated"
    />
    <ServiceKeyVerificationModal
      :visible="showServiceKeyModal"
      :loading="serviceKeyVerifying"
      :description="isOnlineConsultationAppointment(selectedServiceKeyAppointment) ? 'Enter your emailed service code to check in. Your practitioner will send a Google Meet invitation when ready; the consultation timer starts only after the practitioner begins the session.' : 'Enter the service key for your appointment.'"
      @close="closeServiceKeyModal"
      @submit="submitServiceKey"
    />
    <div v-if="feedbackModal.open" class="request-modal-overlay">
      <section class="request-modal-shell" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
        <header class="request-modal-head">
          <div>
            <p class="request-modal-kicker">Optional feedback</p>
            <h2 id="feedback-modal-title" class="request-modal-title">How was your service?</h2>
            <p class="request-modal-summary">{{ feedbackModal.appointment ? `${formatAppointmentServices(feedbackModal.appointment)} · ${feedbackModal.appointment.clinic}` : '' }}</p>
          </div>
          <button type="button" class="request-close-button" aria-label="Close feedback form" :disabled="feedbackModal.saving" @click="closeFeedbackModal"><span class="text-xl leading-none">&times;</span></button>
        </header>
        <form class="request-modal-body" @submit.prevent="submitFeedback" :aria-busy="feedbackModal.saving">
          <fieldset>
            <legend class="request-field-label">Your rating <span aria-hidden="true">*</span></legend>
            <div class="flex gap-2" role="group" aria-label="Choose a rating from 1 to 5">
              <button v-for="rating in [1, 2, 3, 4, 5]" :key="rating" type="button" class="rounded-lg border px-3 py-2 text-lg" :class="feedbackModal.rating >= rating ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-400'" :aria-label="`${rating} out of 5`" :aria-pressed="feedbackModal.rating === rating" @click="feedbackModal.rating = rating">{{ feedbackModal.rating >= rating ? '★' : '☆' }}</button>
            </div>
            <p class="mt-1 text-xs text-slate-500">A rating is needed only if you choose to submit feedback.</p>
          </fieldset>
          <div>
            <label for="appointment-feedback-comment" class="request-field-label">Comment <span class="font-normal">(optional)</span></label>
            <textarea id="appointment-feedback-comment" v-model.trim="feedbackModal.comment" rows="4" maxlength="2000" class="request-textarea" placeholder="Share anything that would help us improve."></textarea>
          </div>
          <p class="text-sm text-slate-600">Your feedback is separate from confirming that you received the service. If submitted, your rating and comment appear on the clinic profile with your name. Avoid including sensitive health details.</p>
          <p v-if="feedbackModal.error" role="alert" class="text-sm text-rose-700">{{ feedbackModal.error }}</p>
          <footer class="request-modal-actions">
            <div class="request-action-buttons">
              <button type="button" class="request-button request-button-secondary" :disabled="feedbackModal.saving" @click="closeFeedbackModal">Maybe later</button>
              <button type="submit" class="request-button request-button-primary" :disabled="feedbackModal.rating < 1 || feedbackModal.saving">{{ feedbackModal.saving ? 'Submitting…' : 'Submit feedback' }}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import OnlineConsultationClock from '@/components/common/OnlineConsultationClock.vue'
import OnlineConsultationControls from '@/components/common/OnlineConsultationControls.vue'
import { onlineAccessOpen } from '../../../../shared/onlineConsultation.js'
import { canRequestAppointmentReschedule, cancellationRefundEstimate, isCancellationPolicyEnabled, rescheduleAllowanceForPolicy } from '../../../../shared/appointmentChangePolicy.js'
import { usePageLoading } from '@/composables/usePageLoading'

import { paymentDue, initialPaymentReceived, bookingOrderReadyForPayment } from '../../../../backend/otp-backend/bookingWorkflow.js'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
const selectedOnlineConsultation = ref(null)
import { auth, db } from '@/config/firebaseConfig'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { onAuthStateChanged } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { formatClockTime } from '@/utils/appointmentDss'
import { intersectClinicHoursAndShift, weekdayForDateKey } from '../../../../shared/clinicOperatingHours.js'
import { isBookingPaymentHoldReleased, timestampMillis } from '../../../../shared/bookingPaymentHold.js'
import BookingContractModal from '@/components/BookingContractModal.vue'
import ServiceKeyVerificationModal from '@/components/ServiceKeyVerificationModal.vue'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const loading = ref(true)
const router = useRouter()
const route = useRoute()
const isUnpaidAppointmentsPage = computed(() => route.name === 'customer-unpaid-appointments')
const activeAppointmentTab = ref('upcoming')
const upcomingAppointments = ref([])
const pastAppointments = ref([])
const onlineConsultations = ref([])
const treatmentSessions = ref([])
const treatmentAppointments = computed(() => [...upcomingAppointments.value, ...pastAppointments.value, ...onlineConsultations.value])
const treatmentSessionsForDisplay = computed(() => treatmentSessions.value.map(session => {
  const plan = treatmentAppointments.value.find(appointment => appointment.id === session.treatmentPlanAppointmentId)
  const definition = plan?.treatmentPlan?.sessions?.[Number(session.sessionNumber || 1) - 1]
  return { ...session, serviceName: definition?.serviceName || plan?.service || 'Treatment visit' }
}).sort((left, right) => String(left.treatmentPlanAppointmentId).localeCompare(String(right.treatmentPlanAppointmentId)) || Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0)))
const treatmentPlanGroups = computed(() => {
  const groups = new Map()
  for (const session of treatmentSessionsForDisplay.value) {
    const id = String(session.treatmentPlanAppointmentId || session.id)
    if (!groups.has(id)) groups.set(id, { id, sessions: [] })
    groups.get(id).sessions.push(session)
  }
  return [...groups.values()].map(group => {
    const plan = treatmentAppointments.value.find(appointment => appointment.id === group.id)
    const rows = group.sessions.sort((a, b) => Number(a.sessionNumber || 0) - Number(b.sessionNumber || 0))
    const totalSessions = Number(plan?.treatmentPlan?.totalSessions || rows[0]?.totalSessions || rows.length)
    const nextSession = rows.find(session => !['completed', 'forfeited'].includes(normalizeAppointmentStatus(session.status))) || null
    const status = normalizeAppointmentStatus(nextSession?.status)
    const nextSessionStatus = !nextSession ? 'Course complete'
      : status === 'unscheduled' && nextSession.earliestScheduleDate ? 'Clinic can schedule after this date'
        : status === 'schedule proposed' ? 'Waiting for your confirmation'
          : status.includes('requested') ? 'Waiting for clinic review'
            : nextSession.status || 'Not scheduled yet'
    return { id: group.id, name: plan?.treatmentPlan?.planName || plan?.service || rows[0]?.serviceName || 'Treatment course', totalSessions, completedCount: rows.filter(session => normalizeAppointmentStatus(session.status) === 'completed').length, nextSession, nextSessionStatus }
  })
})
const selectedAppointmentDetails = ref(null)
const appointmentPayments = ref([])
const appointmentPaymentsLoading = ref(false)
const appointmentPaymentsError = ref('')
let appointmentPaymentsRequest = 0
const clinicsById = ref({})
const showContractModal = ref(false)
const selectedContractAppointment = ref(null)
const showServiceKeyModal = ref(false)
const selectedServiceKeyAppointment = ref(null)
const serviceKeyVerifying = ref(false)
const feedbackModal = ref({ open: false, appointment: null, rating: 0, comment: '', saving: false, error: '' })
const paymentAgreementAcknowledged = reactive({})
const paymentAgreementViewed = reactive({})
const requestModal = ref({
  open: false,
  type: 'cancel',
  appointment: null,
  reason: '',
  requestedDate: '',
  requestedTime: '',
  requestedSlotKey: '',
  loadingAvailability: false,
  availabilityError: '',
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
})
const requestModalPractitioner = ref(null)
const requestModalSchedules = ref({})
const requestModalLeaves = ref([])
const requestModalAppointments = ref([])
const requestModalReservations = ref([])
const requestModalOperatingHours = ref({})
const requestModalLegacyOperatingHours = ref({})
const requestModalLoadSeq = ref(0)
const holdClockNow = ref(Date.now())
let holdClockInterval = null
let unsubscribeAuth = null
let unsubscribeAppointments = null
let unsubscribeClinics = null
let unsubscribeTreatmentSessions = null

const SLOT_STEP_MINUTES = 30
const SLOT_DAYS_LOOKAHEAD = 365
const requestCalendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toDateTime = (date, time) => new Date(`${date}T${time || '00:00'}`)

const normalizeAppointmentStatus = (value) => String(value || '').trim().toLowerCase()
const formatCourseDate = value => {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

const isCancelledAppointment = (appointment) => normalizeAppointmentStatus(appointment?.status) === 'cancelled'

const isOnlineConsultationAppointment = (appointment) => {
  const mode = normalizeAppointmentStatus(appointment?.consultationMode)
  const type = normalizeAppointmentStatus(appointment?.type)
  const serviceText = [
    appointment?.service,
    appointment?.type,
    appointment?.serviceName,
    appointment?.serviceType,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')

  return (type === 'consultation' && mode === 'online') || serviceText.includes('online consultation')
}

const parseClockToMinutes = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!ampm) return null

  let hour = Number(ampm[1])
  const minute = Number(ampm[2])
  const marker = ampm[3].toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  if (marker === 'PM' && hour !== 12) hour += 12
  if (marker === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

const minutesToTime12 = (value) => {
  if (!Number.isFinite(value)) return ''
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
  const rawHours = Math.floor(minutes / 60)
  const mins = String(minutes % 60).padStart(2, '0')
  const period = rawHours >= 12 ? 'PM' : 'AM'
  const hour12 = rawHours % 12 === 0 ? 12 : rawHours % 12
  return `${hour12}:${mins} ${period}`
}

const toDateInput = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const parseDateInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getWeekStartKey = (date) => {
  const currentDay = date.getDay()
  const diffToMonday = (currentDay + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMonday)
  return toDateInput(monday)
}

const extractShiftWindowMinutes = (shiftLabel) => {
  const label = String(shiftLabel || '').trim()
  if (!label) return null
  const base = label.includes('||') ? String(label.split('||').pop() || '').trim() : label
  const [startRaw, endRaw] = base.split('-').map((part) => String(part || '').trim())
  if (!startRaw || !endRaw) return null
  const start = parseClockToMinutes(startRaw)
  const end = parseClockToMinutes(endRaw)
  if (start === null || end === null) return null
  return { start, end }
}

const getAppointmentDurationMinutes = (appointment) => {
  const explicitDuration = Number(
    appointment?.totalServiceDurationMinutes ||
    appointment?.consultationForServiceDurationMinutes ||
    appointment?.consultationDurationMinutes ||
    appointment?.durationMinutes ||
    0
  )
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) return explicitDuration

  const serviceDurations = Array.isArray(appointment?.serviceDurations)
    ? appointment.serviceDurations.map((value) => Number(value || 0)).filter((value) => value > 0)
    : []
  if (serviceDurations.length) {
    return serviceDurations.reduce((sum, value) => sum + value, 0)
  }

  return 60
}

const buildBlockedRanges = (appointmentList = [], options = {}) => {
  const blocked = new Map()
  const blockingStatuses = new Set(['checked in', 'scheduled', 'approved', 'paid', 'cancellation requested', 'reschedule requested', 'completed', 'in progress', 'ongoing', 'held'])
  const skipAppointmentId = String(options.skipAppointmentId || '').trim()

  appointmentList.forEach((appointment) => {
    const appointmentId = String(appointment?.id || '').trim()
    if (skipAppointmentId && appointmentId === skipAppointmentId) return

    const date = String(appointment?.date || '').trim()
    const practitionerId = String(
      appointment?.assignedPractitionerId || appointment?.practitionerId || ''
    ).trim()
    const status = normalizeAppointmentStatus(appointment?.status)
    if (!date || !practitionerId || !blockingStatuses.has(status) || isBookingPaymentHoldReleased(appointment, holdClockNow.value)) return

    const start = parseClockToMinutes(appointment?.time)
    if (start === null) return
    const appointmentDuration = getAppointmentDurationMinutes(appointment)
    const end = parseClockToMinutes(appointment?.endTime)
    const normalizedEnd =
      end !== null && end > start
        ? end
        : start + appointmentDuration

    const key = `${date}|${practitionerId}`
    const nextList = blocked.get(key) || []
    nextList.push({ start, end: normalizedEnd })
    blocked.set(key, nextList)
  })

  return blocked
}

const overlapsBlockedRange = (candidateStart, candidateEnd, blockedRanges = []) =>
  blockedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start)

const requestBookingDurationMinutes = computed(() => Math.max(getAppointmentDurationMinutes(requestModal.value.appointment), 30))

const requestAssignedPractitionerId = computed(() =>
  String(requestModal.value.appointment?.assignedPractitionerId || requestModal.value.appointment?.practitionerId || '').trim()
)

const requestBranchId = computed(() =>
  String(requestModal.value.appointment?.branchId || '').trim()
)

const requestCalendarMonthLabel = computed(() =>
  requestModal.value.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const requestAvailableSlots = computed(() => {
  if (!['reschedule', 'session'].includes(requestModal.value.type) || !requestModal.value.open) return []
  if (!requestAssignedPractitionerId.value || !requestBranchId.value) return []
  if (!requestModalSchedules.value || !Object.keys(requestModalSchedules.value).length) return []

  const slotDurationMinutes = Number(requestBookingDurationMinutes.value || 0)
  if (slotDurationMinutes <= 0) return []

  const blockedMap = buildBlockedRanges(
    [...requestModalAppointments.value, ...requestModalReservations.value],
    { skipAppointmentId: requestModal.value.appointment?.id }
  )
  const slots = []
  const today = new Date()
  const todayKey = toDateInput(today)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  for (let offset = 0; offset < SLOT_DAYS_LOOKAHEAD; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const dateKey = toDateInput(date)
    const earliestScheduleDate = String(requestModal.value.appointment?.earliestScheduleDate || '').trim()
    if (earliestScheduleDate && dateKey < earliestScheduleDate) continue
    const onApprovedLeave = requestModalLeaves.value.some((leave) =>
      leave.startDate <= dateKey && dateKey <= leave.endDate
    )
    if (onApprovedLeave) continue
    const weekKey = getWeekStartKey(dateKey)
    const dayKey = weekdayForDateKey(dateKey)
    const dayName = dayKey ? `${dayKey[0].toUpperCase()}${dayKey.slice(1)}` : ''
    const assignments = resolveWeekAssignments(requestModalSchedules.value, weekKey)
    const shiftLabel = String(assignments?.[dayName] || '').trim()
    if (!shiftLabel) continue

    const windowMinutes = extractShiftWindowMinutes(shiftLabel)
    if (!windowMinutes) continue

    const blockedRanges = blockedMap.get(`${dateKey}|${requestAssignedPractitionerId.value}`) || []
    const clinicWindows = intersectClinicHoursAndShift(
      requestModalOperatingHours.value,
      dateKey,
      { start: minutesToTime12(windowMinutes.start), end: minutesToTime12(windowMinutes.end) },
      requestModalLegacyOperatingHours.value,
    )

    for (const clinicWindow of clinicWindows) {
      let slotStart = clinicWindow.start
      if (dateKey === todayKey && slotStart <= nowMinutes) slotStart = nowMinutes + SLOT_STEP_MINUTES
      for (let minutes = slotStart; minutes + slotDurationMinutes <= Math.min(clinicWindow.end, 1440); minutes += SLOT_STEP_MINUTES) {
        const time = minutesToTime12(minutes)
        const key = `${dateKey}|${time}|${requestAssignedPractitionerId.value}`
        const endMinutes = minutes + slotDurationMinutes
        if (overlapsBlockedRange(minutes, endMinutes, blockedRanges)) continue
        slots.push({
          key,
          date: dateKey,
          time,
          practitionerName: requestModalPractitioner.value?.fullName || requestModal.value.appointment?.assignedPractitionerName || requestModal.value.appointment?.practitionerName || 'Assigned Practitioner',
        })
      }
    }
  }

  return slots
})

const requestAvailableDates = computed(() => [...new Set(requestAvailableSlots.value.map((slot) => slot.date))])
const requestAvailableDateSet = computed(() => new Set(requestAvailableDates.value))

const requestSelectedDateLabel = computed(() => {
  const parsed = parseDateInput(requestModal.value.requestedDate)
  return parsed
    ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Choose a date from the calendar to view available time slots.'
})

const requestSlotsForSelectedDate = computed(() => {
  if (!requestModal.value.requestedDate) return []
  return requestAvailableSlots.value.filter((slot) => slot.date === requestModal.value.requestedDate)
})

const requestCalendarDays = computed(() => {
  const year = requestModal.value.calendarMonth.getFullYear()
  const month = requestModal.value.calendarMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateKey = toDateInput(date)
    return {
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isAvailable: requestAvailableDateSet.value.has(dateKey),
      isSelected: requestModal.value.requestedDate === dateKey,
    }
  })
})

const canGoToPreviousRequestMonth = computed(() => {
  const firstAllowed = new Date()
  firstAllowed.setDate(1)
  firstAllowed.setHours(0, 0, 0, 0)
  return (
    requestModal.value.calendarMonth.getFullYear() > firstAllowed.getFullYear()
    || (
      requestModal.value.calendarMonth.getFullYear() === firstAllowed.getFullYear()
      && requestModal.value.calendarMonth.getMonth() > firstAllowed.getMonth()
    )
  )
})

const canGoToNextRequestMonth = computed(() => {
  const lastAllowed = new Date()
  lastAllowed.setDate(lastAllowed.getDate() + Math.max(0, SLOT_DAYS_LOOKAHEAD - 1))
  lastAllowed.setHours(0, 0, 0, 0)
  return (
    requestModal.value.calendarMonth.getFullYear() < lastAllowed.getFullYear()
    || (
      requestModal.value.calendarMonth.getFullYear() === lastAllowed.getFullYear()
      && requestModal.value.calendarMonth.getMonth() < lastAllowed.getMonth()
    )
  )
})

const changeRequestCalendarMonth = (offset) => {
  const next = new Date(requestModal.value.calendarMonth)
  next.setMonth(next.getMonth() + offset)
  requestModal.value.calendarMonth = new Date(next.getFullYear(), next.getMonth(), 1)
}

const selectRequestDate = (dateKey) => {
  if (!requestAvailableDateSet.value.has(dateKey)) return
  requestModal.value.requestedDate = dateKey
  const selectedDate = parseDateInput(dateKey)
  if (selectedDate) {
    requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  }
  const firstSlot = requestAvailableSlots.value.find((slot) => slot.date === dateKey)
  if (firstSlot) {
    requestModal.value.requestedTime = firstSlot.time
    requestModal.value.requestedSlotKey = firstSlot.key
    return
  }
  requestModal.value.requestedTime = ''
  requestModal.value.requestedSlotKey = ''
}

const selectRequestSlot = (slot) => {
  if (!slot?.key) return
  requestModal.value.requestedDate = slot.date
  requestModal.value.requestedTime = slot.time
  requestModal.value.requestedSlotKey = slot.key
  const selectedDate = parseDateInput(slot.date)
  if (selectedDate) {
    requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  }
}

const resetRequestModalState = () => {
  requestModalLoadSeq.value += 1
  requestModal.value = {
    open: false,
    type: 'cancel',
    appointment: null,
    reason: '',
    requestedDate: '',
    requestedTime: '',
    requestedSlotKey: '',
    loadingAvailability: false,
    availabilityError: '',
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  }
  requestModalPractitioner.value = null
  requestModalSchedules.value = {}
  requestModalLeaves.value = []
  requestModalAppointments.value = []
  requestModalReservations.value = []
  requestModalOperatingHours.value = {}
  requestModalLegacyOperatingHours.value = {}
}

const loadRescheduleAvailability = trackPageLoad(async (appointment, { autoSelect = true } = {}) => {
  const loadSeq = ++requestModalLoadSeq.value
  const branchId = String(appointment?.branchId || '').trim()
  const practitionerId = String(appointment?.assignedPractitionerId || appointment?.practitionerId || '').trim()

  requestModal.value.loadingAvailability = true
  requestModal.value.availabilityError = ''
  requestModalPractitioner.value = null
  requestModalSchedules.value = {}
  requestModalLeaves.value = []
  requestModalAppointments.value = []
  requestModalReservations.value = []
  requestModalOperatingHours.value = {}
  requestModalLegacyOperatingHours.value = {}

  try {
    if (!branchId || !practitionerId) {
      requestModal.value.availabilityError = 'This appointment does not include practitioner scheduling details.'
      return
    }

    // Customers may use published recurring availability, but must never read
    // private staff leave, other appointments, temporary reservations, or a
    // practitioner profile. The booking API revalidates the slot on submit.
    const [scheduleSnap, clinicSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', practitionerId, 'schedules'), where('recurring', '==', true))),
      getDoc(doc(db, 'clinics', branchId)),
    ])

    if (loadSeq !== requestModalLoadSeq.value || !requestModal.value.open) return

    requestModalSchedules.value = buildWeekScheduleMap(
      scheduleSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} }))
    )
    const clinic = clinicSnap.exists() ? clinicSnap.data() || {} : {}
    requestModalOperatingHours.value = clinic.operatingHours && typeof clinic.operatingHours === 'object' ? clinic.operatingHours : {}
    requestModalLegacyOperatingHours.value = { openDays: clinic.openDays || [], openTime: clinic.openTime || '', closeTime: clinic.closeTime || '' }
    requestModalLeaves.value = []
    requestModalAppointments.value = []
    requestModalReservations.value = []
    requestModalPractitioner.value = {
      id: practitionerId,
      fullName:
        appointment?.assignedPractitionerName ||
        appointment?.practitionerName ||
        'Assigned Practitioner',
    }

    const parsedDate = parseDateInput(appointment?.date) || new Date()
    requestModal.value.calendarMonth = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)

    if (autoSelect) {
      const currentRequestedDate = String(requestModal.value.requestedDate || '').trim()
      const currentRequestedTime = String(requestModal.value.requestedTime || '').trim()
      const existingSelection = currentRequestedDate && currentRequestedTime
        ? requestAvailableSlots.value.find((slot) => slot.date === currentRequestedDate && slot.time === currentRequestedTime)
        : null
      const firstSlot = existingSelection || requestAvailableSlots.value[0] || null
      if (firstSlot) {
        requestModal.value.requestedDate = firstSlot.date
        requestModal.value.requestedTime = firstSlot.time
        requestModal.value.requestedSlotKey = firstSlot.key
        const selectedDate = parseDateInput(firstSlot.date)
        if (selectedDate) {
          requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        }
      }
    } else {
      const currentRequestedDate = String(requestModal.value.requestedDate || '').trim()
      const currentRequestedTime = String(requestModal.value.requestedTime || '').trim()
      const selection = currentRequestedDate && currentRequestedTime
        ? requestAvailableSlots.value.find((slot) => slot.date === currentRequestedDate && slot.time === currentRequestedTime)
        : null
      requestModal.value.requestedSlotKey = selection?.key || ''
      if (!selection && currentRequestedDate) {
        requestModal.value.requestedDate = ''
        requestModal.value.requestedTime = ''
      } else if (selection) {
        const selectedDate = parseDateInput(selection.date)
        if (selectedDate) {
          requestModal.value.calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        }
      }
    }
  } catch (error) {
    console.error(error)
    requestModal.value.availabilityError = 'Unable to load available schedules for rescheduling.'
  } finally {
    requestModal.value.loadingAvailability = false
  }
})

const formatAppointmentServices = (appointment) => {
  if (Array.isArray(appointment?.services) && appointment.services.length) {
    return appointment.services.join(', ')
  }
  return appointment?.service || 'Service not set'
}

const customerAppointmentRecords = computed(() => [...new Map([
  ...upcomingAppointments.value,
  ...pastAppointments.value,
  ...onlineConsultations.value,
].map(appointment => [appointment.id, appointment])).values()])

const appointmentScheduleRows = computed(() => {
  const appointment = selectedAppointmentDetails.value
  if (!appointment) return []

  if (appointment.isBookingOrderParent && Array.isArray(appointment.appointmentIds)) {
    const childAppointments = appointment.appointmentIds
      .map(id => customerAppointmentRecords.value.find(item => item.id === id))
      .filter(Boolean)
      .sort((left, right) => `${left.date || ''} ${left.time || ''}`.localeCompare(`${right.date || ''} ${right.time || ''}`))
    if (childAppointments.length) return childAppointments.map((child, index) => ({
      id: child.id,
      serviceName: formatAppointmentServices(child),
      date: child.date,
      time: child.time,
      status: child.status,
      sessionLabel: `Service ${index + 1} of ${childAppointments.length}`,
    }))
  }

  const treatmentDefinitions = Array.isArray(appointment.treatmentPlan?.sessions) ? appointment.treatmentPlan.sessions : []
  if (Number(appointment.treatmentPlan?.totalSessions || 0) > 1 && treatmentDefinitions.length) {
    return treatmentDefinitions.map((definition, index) => {
      const sessionNumber = index + 1
      const session = treatmentSessions.value.find(item => item.treatmentPlanAppointmentId === appointment.id && Number(item.sessionNumber) === sessionNumber)
      return {
        id: session?.id || `${appointment.id}-visit-${sessionNumber}`,
        serviceName: definition?.serviceName || definition?.name || appointment.service || 'Treatment visit',
        date: session?.date || (index === 0 ? appointment.date : ''),
        time: session?.time || (index === 0 ? appointment.time : ''),
        status: session?.status || (index === 0 ? appointment.status : 'Not scheduled yet'),
        sessionLabel: `Visit ${sessionNumber} of ${treatmentDefinitions.length}`,
      }
    })
  }

  const details = Array.isArray(appointment.serviceDetails) ? appointment.serviceDetails : []
  const names = details.map(item => typeof item === 'string' ? item : item?.title || item?.name || item?.serviceName).filter(Boolean)
  const fallbackNames = Array.isArray(appointment.services) ? appointment.services : []
  const serviceNames = names.length ? names : (fallbackNames.length ? fallbackNames : [appointment.service || 'Service'])
  return serviceNames.map((name, index) => ({
    id: `${appointment.id}-service-${index}`,
    serviceName: typeof name === 'string' ? name : name?.title || name?.name || name?.serviceName || 'Service',
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
  }))
})

const formatReceiptDateTime = value => {
  const milliseconds = timestampMillis(value)
  if (!milliseconds) return 'Not recorded'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(milliseconds))
}

const closeAppointmentDetails = () => {
  selectedAppointmentDetails.value = null
  appointmentPayments.value = []
  appointmentPaymentsError.value = ''
  appointmentPaymentsLoading.value = false
  appointmentPaymentsRequest += 1
}

const openAppointmentDetails = async appointment => {
  if (!appointment?.id) return
  selectedAppointmentDetails.value = appointment
  appointmentPayments.value = []
  appointmentPaymentsError.value = ''
  appointmentPaymentsLoading.value = true
  const requestId = ++appointmentPaymentsRequest
  try {
    const user = auth.currentUser
    if (!user) throw new Error('Please sign in again to view payment records.')
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/appointments/${encodeURIComponent(appointment.id)}/payment-receipt`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Payment records could not be loaded.')
    if (requestId !== appointmentPaymentsRequest) return
    appointmentPayments.value = Array.isArray(payload.data?.payments) ? payload.data.payments : []
  } catch (error) {
    if (requestId !== appointmentPaymentsRequest) return
    appointmentPaymentsError.value = error?.message || 'Payment records could not be loaded.'
  } finally {
    if (requestId === appointmentPaymentsRequest) appointmentPaymentsLoading.value = false
  }
}

const runAppointmentDetailsAction = async action => {
  closeAppointmentDetails()
  await action()
}

const getAppointmentTimestampMillis = (value) => {
  if (value?.toDate) return value.toDate().getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

const getAppointmentFollowUpWindowDays = (appointment) => {
  const windows = [Number(appointment?.followUpWindowDays || 0)]
  if (Array.isArray(appointment?.serviceDetails)) {
    windows.push(...appointment.serviceDetails.map((service) => Number(service?.followUpWindowDays || 0)))
  }
  const validWindows = windows.filter((value) => Number.isFinite(value) && value > 0)
  return validWindows.length ? Math.min(...validWindows) : 0
}

const getAppointmentCompletedAtMillis = (appointment) => {
  const candidates = [
    appointment?.completedAt,
    appointment?.workerCompletedAt,
  ]

  for (const candidate of candidates) {
    const timestamp = getAppointmentTimestampMillis(candidate)
    if (timestamp !== null) return timestamp
  }

  const fallback = toDateTime(appointment?.date, appointment?.time).getTime()
  return Number.isNaN(fallback) ? null : fallback
}

const extractAppointmentServiceIds = (appointment) => {
  const ids = []

  if (Array.isArray(appointment?.serviceIds)) {
    ids.push(
      ...appointment.serviceIds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  }

  if (Array.isArray(appointment?.serviceDetails)) {
    ids.push(
      ...appointment.serviceDetails
        .map((service) => String(service?.id || service?.serviceId || '').trim())
        .filter(Boolean)
    )
  }

  return [...new Set(ids)]
}

const extractAppointmentServiceNames = (appointment) => {
  const names = []

  if (Array.isArray(appointment?.services)) {
    names.push(
      ...appointment.services
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  }

  if (Array.isArray(appointment?.serviceDetails)) {
    names.push(
      ...appointment.serviceDetails
        .map((service) => String(service?.title || service?.name || service?.serviceName || '').trim())
        .filter(Boolean)
    )
  }

  return [...new Set(names)]
}

const isFollowUpEligible = (appointment) => {
  const status = normalizeAppointmentStatus(appointment?.status)
  if (status !== 'completed') return false
  if (isCancelledAppointment(appointment)) return false
  if (!appointment?.followUpRecommended) return false

  const allowed = Boolean(appointment?.followUpAllowed) || (
    Array.isArray(appointment?.serviceDetails) &&
    appointment.serviceDetails.some((service) => Boolean(service?.followUpAllowed))
  )
  if (!allowed) return false

  const windowDays = getAppointmentFollowUpWindowDays(appointment)
  if (!windowDays) return true

  const completedAt = getAppointmentCompletedAtMillis(appointment)
  if (completedAt === null) return true

  const windowMillis = windowDays * 24 * 60 * 60 * 1000
  return Date.now() - completedAt <= windowMillis
}

const canBookFollowUp = (appointment) => {
  if (!isFollowUpEligible(appointment)) return false
  if (!String(appointment?.branchId || '').trim()) return false
  return extractAppointmentServiceIds(appointment).length > 0 || extractAppointmentServiceNames(appointment).length > 0
}

const hasOpenFollowUp = (appointment) => {
  const sourceId = String(appointment?.id || '').trim()
  if (!sourceId) return false
  const related = [...upcomingAppointments.value, ...pastAppointments.value, ...onlineConsultations.value]
    .find((candidate) => String(candidate?.followUpOf || '').trim() === sourceId
      && !['cancelled', 'rejected'].includes(normalizeAppointmentStatus(candidate.status)))
  return Boolean(related)
}

const followUpBookingStatus = (appointment) => {
  const sourceId = String(appointment?.id || '').trim()
  const related = [...upcomingAppointments.value, ...pastAppointments.value, ...onlineConsultations.value]
    .find((candidate) => String(candidate?.followUpOf || '').trim() === sourceId
      && !['cancelled', 'rejected'].includes(normalizeAppointmentStatus(candidate.status)))
  return related && normalizeAppointmentStatus(related.status) === 'completed'
    ? 'Follow-up completed'
    : 'Follow-up already booked'
}

const followUpAvailabilityMessage = (appointment) => {
  if (normalizeAppointmentStatus(appointment?.status) !== 'completed') return ''
  const allowed = Boolean(appointment?.followUpAllowed)
    || (Array.isArray(appointment?.serviceDetails) && appointment.serviceDetails.some((service) => Boolean(service?.followUpAllowed)))
  if (!allowed) return 'No follow-up offered for this service'
  if (!appointment?.followUpRecommended) return 'Awaiting clinic recommendation'
  if (!isFollowUpEligible(appointment)) return 'Follow-up booking window has expired'
  if (!String(appointment?.branchId || '').trim() || (!extractAppointmentServiceIds(appointment).length && !extractAppointmentServiceNames(appointment).length)) {
    return 'Contact the clinic to arrange your follow-up'
  }
  return ''
}

const bookFollowUp = (appointment) => {
  if (!canBookFollowUp(appointment)) {
    toast.error('This appointment is not eligible for a follow-up booking.')
    return
  }

  const branchId = String(appointment?.branchId || '').trim()
  const serviceIds = extractAppointmentServiceIds(appointment)
  const serviceNames = extractAppointmentServiceNames(appointment)

  const query = {
    branch: branchId,
    followupOf: String(appointment?.id || '').trim(),
  }

  const preferredPractitionerId = String(appointment?.assignedPractitionerId || appointment?.practitionerId || '').trim()
  if (preferredPractitionerId) {
    query.preferredPractitionerId = preferredPractitionerId
  }

  if (serviceIds.length) {
    query.followupServiceIds = serviceIds.join(',')
  }
  if (serviceNames.length) {
    query.followupServiceNames = serviceNames.join('|')
  }

  router.push({
    name: 'customer-center',
    params: { id: branchId },
    query,
  }).catch(() => {})
}

const openMeetLink = async (appointment) => {
  if (!onlineAccessOpen(appointment)) { toast.info('Consultation access is closed. Contact the clinic for review.'); return }
  const url = String(appointment.meetLink || '').trim()
  if (!url) return
  const callWindow = window.open('about:blank', '_blank')
  try {
    await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/transition`, { action: 'join_consultation' })
    if (callWindow) { callWindow.opener = null; callWindow.location.href = url }
    else toast.info('Waiting room entered. Use Copy Link to open your call.')
  } catch (error) { callWindow?.close(); toast.error(error.message) }
}
const endConsultationParticipation = async appointment => {
  if (!window.confirm('Record that you have finished participating? Close the meeting tab to leave the call.')) return
  try { await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/transition`, { action: 'client_end_consultation' }); toast.success('Your end time was recorded. The practitioner must still submit the consultation notes.') }
  catch (error) { toast.error(error.message) }
}

const copyMeetLink = async (appointment) => {
  if (!onlineAccessOpen(appointment)) { toast.info('Consultation access is closed.'); return }
  const meetLink = appointment.meetLink
  const url = String(meetLink || '').trim()
  if (!url) return

  try {
    await navigator.clipboard.writeText(url)
    toast.success('Meet link copied.')
  } catch (error) {
    console.error('Failed to copy meet link:', error)
    toast.error('Failed to copy meeting link.')
  }
}

const getClinicPolicy = (appointment, kind) => {
  const clinic = clinicsById.value[appointment?.branchId] || {}
  if (kind === 'cancel') {
    return (
      (clinic.cancellationPolicyEnabled !== false && clinic.cancellationPolicy) ||
      (clinic.refundPolicyEnabled !== false && clinic.refundPolicy) ||
      'Cancellations are reviewed by clinic staff. The estimated refund below uses the clinic’s saved cancellation terms.'
    )
  }

  return (
    clinic.reschedulePolicy ||
    'Reschedule requests are reviewed by the clinic first. The new schedule will only take effect after approval.'
  )
}

const statusToneClass = (status) => {
  const normalized = normalizeAppointmentStatus(status)
  if (normalized.includes('cancel')) return 'status-badge-danger'
  if (normalized.includes('complete')) return 'status-badge-muted'
  if (normalized.includes('request')) return 'status-badge-warning'
  return 'status-badge-primary'
}

const upcomingOnlineConsultations = computed(() => {
  return onlineConsultations.value.filter((appt) =>
    !['completed', 'cancelled', 'rejected'].includes(normalizeAppointmentStatus(appt.status))
  )
})

const customerLifecycleAppointments = computed(() => [
  ...upcomingAppointments.value,
  ...upcomingOnlineConsultations.value,
])

const pastOnlineConsultations = computed(() => {
  const now = new Date()
  return onlineConsultations.value.filter((appt) => ['completed', 'cancelled', 'rejected'].includes(normalizeAppointmentStatus(appt.status)))
})

const pastRecords = computed(() =>
  sortRecordsNewestFirst([
    ...pastAppointments.value,
    ...pastOnlineConsultations.value,
  ])
)

const unpaidAppointments = computed(() =>
  customerLifecycleAppointments.value.filter((appointment) => canPayAppointment(appointment))
)

const bookingOrders = computed(() => upcomingAppointments.value.filter(appointment => appointment.isBookingOrderParent))

const activeUpcomingAppointments = computed(() =>
  upcomingAppointments.value.filter((appointment) => !appointment.isBookingOrderParent && !canPayAppointment(appointment))
)

const requestPolicyText = computed(() => {
  if (!requestModal.value.appointment) return ''
  if (requestModal.value.type === 'session' && normalizeAppointmentStatus(requestModal.value.appointment.status) === 'unscheduled') {
    return 'This is your first schedule request for this treatment session. The clinic will confirm the final time.'
  }
  return getClinicPolicy(requestModal.value.appointment, requestModal.value.type)
})
const cancellationRefundSummary = computed(() => {
  const appointment = requestModal.value.appointment
  const clinic = clinicsById.value[appointment?.branchId] || {}
  const estimate = cancellationRefundEstimate({ policy: clinic, appointment })
  const currency = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0))
  if (estimate.eligibleAmount <= 0) return 'No paid amount is currently eligible for a refund. Clinic staff will review and finalize this request.'
  if (estimate.refundPercentage <= 0) return `Estimated refund: ${currency(0)} under the ${estimate.tier} cancellation window. Clinic staff will review and finalize this request.`
  return `Estimated refund if approved: ${currency(estimate.refundAmount)} (${estimate.refundPercentage}% of ${currency(estimate.eligibleAmount)} after platform commission, using the ${estimate.tier} window). Clinic staff will review and finalize this request.`
})
const requestRescheduleAllowanceText = computed(() => {
  const appointment = requestModal.value.appointment
  if (requestModal.value.type === 'session' && normalizeAppointmentStatus(appointment?.status) === 'unscheduled') return 'This is the first schedule for this treatment session; the reschedule allowance applies after a schedule is set.'
  const clinic = clinicsById.value[appointment?.branchId] || {}
  const maximum = rescheduleAllowanceForPolicy(clinic)
  const used = Math.max(0, Number(appointment?.rescheduleCount || 0))
  return `Reschedules used: ${used} of ${maximum}. This request does not change your appointment unless the clinic approves it.`
})

const isRequestPending = (appt, kind) => {
  const status = String(appt?.status || '').trim().toLowerCase()
  if (status.includes('requested')) return true
  if (kind === 'cancel') {
    return status === 'cancelled' || status === 'completed'
  }
  return status === 'cancelled' || status === 'completed'
}

const canRequestCancellation = (appointment) => {
  if (appointment.isGroupParent || appointment.isBookingOrderParent) return false
  if (appointment.startedAt || appointment.checkedInAt) return false
  const clinic = clinicsById.value[appointment?.branchId] || {}
  const status = normalizeAppointmentStatus(appointment?.status)
  if (!['paid', 'scheduled', 'awaiting payment', 'contract pending', 'ready to start'].includes(status)) return false
  if (appointment.sameDayBookingId
    && normalizeAppointmentStatus(appointment.type) === 'consultation'
    && normalizeAppointmentStatus(appointment.sameDayTreatmentStatus) === 'cleared') return false
  return Boolean(appointment?.id)
    && isCancellationPolicyEnabled(clinic)
    && !['cancelled', 'completed'].includes(status)
    && toDateTime(appointment?.date, appointment?.time) >= new Date()
}

const canRequestReschedule = (appointment) => {
  if (appointment.isGroupParent || appointment.isBookingOrderParent || appointment.treatmentPlanAppointmentId) return false
  if (appointment.startedAt || appointment.checkedInAt) return false
  const clinic = clinicsById.value[appointment?.branchId] || {}
  const status = normalizeAppointmentStatus(appointment?.status)
  if (!['paid', 'scheduled', 'awaiting payment', 'contract pending', 'ready to start'].includes(status)) return false
  if (appointment.sameDayBookingId
    && (normalizeAppointmentStatus(appointment.type) !== 'service'
      || normalizeAppointmentStatus(appointment.sameDayTreatmentStatus) !== 'cleared')) return false
  return Boolean(appointment?.id)
    && canRequestAppointmentReschedule(clinic, appointment)
    && !['cancelled', 'completed', 'no-show'].includes(status)
    && toDateTime(appointment?.date, appointment?.time) >= new Date()
}

const canRequestSessionSchedule = (session) => {
  const status = String(session?.status || '').trim().toLowerCase()
  if (!session?.id || ['schedule requested', 'reschedule requested', 'completed', 'forfeited'].includes(status)) return false
  // The API repeats this check so the UI can never bypass the sequential plan.
  if (Number(session?.sessionNumber || 1) > 1) {
    const previous = treatmentSessions.value.find((item) =>
      item.treatmentPlanAppointmentId === session.treatmentPlanAppointmentId
      && Number(item.sessionNumber || 0) === Number(session.sessionNumber || 1) - 1
    )
    if (!previous || !['completed', 'forfeited'].includes(String(previous.status || '').trim().toLowerCase())) return false
  }
  if (status === 'unscheduled') return true
  const clinic = clinicsById.value[session?.branchId] || {}
  return ['scheduled', 'schedule proposed', 'reschedule eligible'].includes(status)
    && canRequestAppointmentReschedule(clinic, { rescheduleCount: session?.rescheduleCount })
}
const confirmSessionSchedule = async session => {
  try { await postAppointmentAction(session.id, `/treatment-sessions/${session.id}/confirm`, {}); toast.success('Schedule confirmed. Your appointment code will be emailed to you.') }
  catch (error) { toast.error(error.message) }
}

const openRequestModal = async (type, appt) => {
  requestModal.value = {
    open: true,
    type,
    appointment: appt,
    reason: '',
    requestedDate: '',
    requestedTime: '',
    requestedSlotKey: '',
    loadingAvailability: type === 'reschedule' || type === 'session',
    availabilityError: '',
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  }

  if (type === 'reschedule' || type === 'session') {
    await loadRescheduleAvailability(appt, { autoSelect: true })
  }
}

const closeRequestModal = () => {
  resetRequestModalState()
}

const startAppointmentsListener = (userId) => {
  if (!userId) {
    upcomingAppointments.value = []
    pastAppointments.value = []
    onlineConsultations.value = []
    loading.value = false
    return
  }

  loading.value = true
  if (unsubscribeAppointments) {
    unsubscribeAppointments()
    unsubscribeAppointments = null
  }

  const appointmentsQuery = query(collection(db, 'appointments'), where('customerId', '==', userId))
  unsubscribeAppointments = pageListener(
    onSnapshot, appointmentsQuery,
    async (snapshot) => {
      const clinicMap = new Map(Object.entries(clinicsById.value).map(([id, data]) => [id, data]))
      const now = new Date()
      const all = await Promise.all(snapshot.docs.map(async (snap) => {
        const data = snap.data()
        const waitingForInvite = Boolean(data.consultationCustomerReadyAt && !data.consultationInviteAt)
        const meetingSnap = waitingForInvite ? null : await getDoc(doc(db, 'appointmentMeetings', snap.id))
        return {
          id: snap.id,
          ...data,
          ...(meetingSnap?.exists() && meetingSnap.data().hostVerified && data.consultationCodeVerifiedAt && meetingSnap.data().practitionerId === (data.assignedPractitionerId || data.practitionerId) && Date.parse(meetingSnap.data().scheduledStartAt) === Date.parse(`${data.date}T${data.time}+08:00`) ? meetingSnap.data() : { meetLink: '' }),
          clinic: clinicMap.get(data.branchId)?.name || 'Clinic',
        }
      }))

      onlineConsultations.value = sortRecordsNewestFirst(
        all.filter((appt) => isOnlineConsultationAppointment(appt))
      )

      upcomingAppointments.value = all
        .filter((appt) => appt.isBookingOrderParent || (
          !isOnlineConsultationAppointment(appt) &&
          !['completed', 'cancelled', 'rejected', 'no-show'].includes(normalizeAppointmentStatus(appt.status))
        ))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime()
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime()
          return bTime - aTime
        })

      pastAppointments.value = all
        .filter((appt) => !isOnlineConsultationAppointment(appt) && ['completed', 'cancelled', 'rejected', 'no-show'].includes(normalizeAppointmentStatus(appt.status)))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime()
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime()
          return bTime - aTime
        })
      loading.value = false
    },
    (error) => {
      console.error(error)
      toast.error('Failed to load appointments.')
      loading.value = false
    }
  )
}

const startTreatmentSessionsListener = (userId) => {
  if (unsubscribeTreatmentSessions) unsubscribeTreatmentSessions()
  if (!userId) { treatmentSessions.value = []; return }
  unsubscribeTreatmentSessions = pageListener(onSnapshot, query(collection(db, 'treatmentSessions'), where('customerId', '==', userId)), (snapshot) => {
    treatmentSessions.value = snapshot.docs.map((snap) => ({ id: snap.id, ...(snap.data() || {}) })).sort((a, b) => Number(a.sessionNumber || 0) - Number(b.sessionNumber || 0))
  }, () => { treatmentSessions.value = [] })
}

const startClinicsListener = () => {
  if (unsubscribeClinics) {
    unsubscribeClinics()
    unsubscribeClinics = null
  }

  // Public clinic reads must be constrained to the field required by the
  // Firestore rule. Historical appointments still fall back to “Clinic” when
  // their former clinic is no longer published.
  unsubscribeClinics = pageListener(
    onSnapshot, query(collection(db, 'clinics'), where('isPublished', '==', true)),
    (snapshot) => {
      const clinicMap = new Map()
      sortRecordsNewestFirst(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))).forEach((data) => {
        const enforcedPolicyKeys = Array.isArray(data.enforcedPolicyKeys) ? new Set(data.enforcedPolicyKeys.map(key => String(key || '').trim())) : null
        const cancellationLinked = !enforcedPolicyKeys || enforcedPolicyKeys.has('cancellationPolicy')
        const rescheduleLinked = !enforcedPolicyKeys || enforcedPolicyKeys.has('reschedulePolicy')
        clinicMap.set(data.id, {
          name: data.clinicName || data.clinicBranch || 'Clinic',
          cancellationPolicy: String(data.cancellationPolicy || '').trim(),
          cancellationPolicyEnabled: cancellationLinked && (data.cancellationPolicyEnabled === true || data.serviceCancellationPolicyEnabled === true || data.refundPolicyEnabled === true),
          reschedulePolicy: String(data.reschedulePolicy || '').trim(),
          reschedulePolicyEnabled: rescheduleLinked && (data.reschedulePolicyEnabled === true || data.serviceReschedulingPolicyEnabled === true),
          maximumRescheduleAllowance: data.maximumRescheduleAllowance,
          earlyMinimumHours: data.earlyMinimumHours,
          earlyNonRefundable: data.earlyNonRefundable,
          earlyRefundPercentage: data.earlyRefundPercentage,
          midMinimumHours: data.midMinimumHours,
          midMaximumHours: data.midMaximumHours,
          midNonRefundable: data.midNonRefundable,
          midRefundPercentage: data.midRefundPercentage,
          lateMaximumHours: data.lateMaximumHours,
          lateNonRefundable: data.lateNonRefundable,
          lateRefundPercentage: data.lateRefundPercentage,
          refundPolicy: String(data.refundPolicy || '').trim(),
          refundPolicyEnabled: cancellationLinked && data.refundPolicyEnabled === true,
        })
      })
      clinicsById.value = Object.fromEntries(clinicMap.entries())
    },
    () => {
      clinicsById.value = {}
    }
  )
}

const submitRequest = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in first.')
    return
  }

  const appt = requestModal.value.appointment
  if (!appt?.id) {
    toast.error('Please choose an appointment first.')
    return
  }

  const reason = String(requestModal.value.reason || '').trim()
  if (!reason) {
    toast.error('Please provide a reason.')
    return
  }

  if (requestModal.value.type === 'cancel') {
    try {
      if (!canRequestCancellation(appt)) {
        toast.error('This appointment has already started or passed and can no longer be cancelled here.')
        closeRequestModal()
        return
      }
      await postAppointmentAction(appt.id, `/appointments/${appt.id}/request-change`, {
        type: 'cancel',
        reason,
      })
      toast.success('Cancellation request submitted for review.')
      closeRequestModal()
    } catch (error) {
      console.error(error)
      toast.error(error?.message || 'Failed to submit cancellation request.')
    }
    return
  }

  if (!requestModal.value.requestedDate || !requestModal.value.requestedTime) {
    toast.error('Please choose a new date and time.')
    return
  }

  if (requestModal.value.type === 'session' ? !canRequestSessionSchedule(appt) : !canRequestReschedule(appt)) {
    toast.error('This clinic policy or appointment status no longer allows this reschedule request.')
    return
  }

  try {
    await loadRescheduleAvailability(appt, { autoSelect: false })
    const selectedSlot = requestAvailableSlots.value.find(
      (slot) =>
        slot.date === requestModal.value.requestedDate &&
        slot.time === requestModal.value.requestedTime &&
        slot.key === requestModal.value.requestedSlotKey
    )

    if (!selectedSlot) {
      toast.error('That time slot is no longer available. Please choose another one.')
      return
    }

    if (requestModal.value.type === 'session') {
      await postAppointmentAction(appt.id, `/treatment-sessions/${appt.id}/request-schedule`, {
        date: requestModal.value.requestedDate,
        time: requestModal.value.requestedTime,
        reason,
      })
      toast.success('Your treatment-session request was sent to the clinic.')
      closeRequestModal()
      return
    }

    await postAppointmentAction(appt.id, `/appointments/${appt.id}/request-change`, {
      type: 'reschedule',
      reason,
      date: requestModal.value.requestedDate,
      time: requestModal.value.requestedTime,
      practitionerId: requestAssignedPractitionerId.value,
      slotKey: requestModal.value.requestedSlotKey,
    })
    toast.success('Reschedule request submitted for review.')
    closeRequestModal()
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Failed to submit reschedule request.')
  }
}

const cancel = async (appt) => {
  try {
    openRequestModal('cancel', appt)
  } catch (error) {
    console.error(error)
    toast.error('Failed to open cancellation modal.')
  }
}

const reschedule = async (appt) => {
  try {
    openRequestModal('reschedule', appt)
  } catch (error) {
    console.error(error)
    toast.error('Failed to open reschedule modal.')
  }
}

const formatBookingDue = (appointment) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(paymentDue(appointment) / 100)
const formatPricingAmount = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0))
const downloadAppointmentReceipt = async (payment) => {
  const appointment = selectedAppointmentDetails.value
  if (!appointment || String(payment?.status || '').toLowerCase() !== 'paid' || Number(payment?.amount || 0) <= 0) {
    toast.info('A receipt is available only for a verified payment.')
    return
  }
  try {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const currency = amount => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0))
    const safeCode = String(payment.transactionCode || payment.checkoutSessionId || payment.id || appointment.id)
    const pricing = appointment.pricingSnapshot || {}
    const clinicName = appointment.clinic || 'AesthetiCare clinic'

    pdf.setFillColor(61, 40, 29)
    pdf.rect(0, 0, 210, 42, 'F')
    pdf.setTextColor(255, 248, 235)
    pdf.setFont('helvetica', 'bold').setFontSize(20)
    pdf.text('AesthetiCare', 15, 18)
    pdf.setFontSize(10).setFont('helvetica', 'normal')
    pdf.text('PAYMENT RECEIPT', 15, 27)
    pdf.text(clinicName, 15, 35, { maxWidth: 175 })
    pdf.setTextColor(61, 40, 29)
    pdf.setFont('helvetica', 'bold').setFontSize(12)
    pdf.text('Payment details', 15, 54)
    autoTable(pdf, {
      startY: 59,
      theme: 'plain',
      body: [
        ['Transaction code', safeCode],
        ...(payment.referenceNumber ? [['Payment reference', payment.referenceNumber]] : []),
        ['PayMongo payment ID', payment.paymentId || 'Not provided'],
        [payment.paidAtSource === 'provider' ? 'Paid on' : 'Payment recorded', formatReceiptDateTime(payment.paidAt)],
        ['Payment method', payment.method || 'Online payment'],
        ['Customer', appointment.customerName || auth.currentUser?.displayName || 'Customer'],
        ['Appointment code', appointment.id],
        ['Booked on', formatReceiptDateTime(appointment.createdAt)],
      ],
      styles: { fontSize: 9, cellPadding: 2.4, textColor: [77, 56, 42] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 1: { cellWidth: 138 } },
      margin: { left: 15, right: 15 },
    })

    let y = (pdf.lastAutoTable?.finalY || 105) + 8
    pdf.setTextColor(61, 40, 29).setFont('helvetica', 'bold').setFontSize(12)
    pdf.text('Services and schedule', 15, y)
    autoTable(pdf, {
      startY: y + 5,
      head: [['Service', 'Date', 'Time', 'Status']],
      body: appointmentScheduleRows.value.map(visit => [visit.serviceName, visit.date ? formatCourseDate(visit.date) : 'Not scheduled', visit.time ? formatClockTime(visit.time) : 'Not set', visit.status || 'Scheduled']),
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [77, 56, 42], lineColor: [230, 207, 176] },
      headStyles: { fillColor: [247, 234, 213], textColor: [77, 48, 31], fontStyle: 'bold' },
      margin: { left: 15, right: 15 },
    })

    y = (pdf.lastAutoTable?.finalY || y + 18) + 8
    if (y > 235) { pdf.addPage(); y = 20 }
    pdf.setFont('helvetica', 'bold').setFontSize(12).setTextColor(61, 40, 29)
    pdf.text('Price summary', 15, y)
    const total = Number(pricing.total ?? appointment.totalAmount ?? appointment.amount ?? 0)
    const chronologicalPayments = appointmentPayments.value
      .filter(item => String(item.status || '').toLowerCase() === 'paid')
      .sort((left, right) => timestampMillis(left.paidAt) - timestampMillis(right.paidAt))
    const currentPaymentIndex = chronologicalPayments.findIndex(item => item.id === payment.id)
    const paidToDate = currentPaymentIndex >= 0
      ? chronologicalPayments.slice(0, currentPaymentIndex + 1).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      : Number(payment.amount || 0)
    autoTable(pdf, {
      startY: y + 5,
      body: [
        ['Subtotal', currency(pricing.subtotal ?? total)],
        ['Discount', currency(pricing.discountAmount ?? pricing.discount ?? 0)],
        ['VAT', pricing.vatApplicable === true ? `${currency(pricing.vatAmount || 0)} (12%${pricing.vatPriceMode === 'inclusive' ? ', included' : ''})` : 'No VAT'],
        ['Total price', currency(total)],
        ['This payment', currency(payment.amount)],
        ['Paid to date', currency(paidToDate)],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.4, textColor: [77, 56, 42] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { halign: 'right', cellWidth: 132 } },
      margin: { left: 15, right: 15 },
    })
    const footerY = Math.min((pdf.lastAutoTable?.finalY || y + 25) + 12, 285)
    pdf.setDrawColor(230, 207, 176).line(15, footerY - 5, 195, footerY - 5)
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120, 97, 79)
    pdf.text('Generated from the verified payment record in AesthetiCare.', 15, footerY)
    pdf.save(`AesthetiCare-Receipt-${safeCode.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`)
  } catch (error) {
    console.error('Failed to create appointment receipt:', error)
    toast.error('The receipt PDF could not be created. Please try again.')
  }
}

const contractsToSign = computed(() => customerLifecycleAppointments.value.filter(appointment =>
  appointment.approvalStatus === 'Approved'
  && !isBookingPaymentHoldReleased(appointment, holdClockNow.value)
  && appointment.sameDayTreatmentStatus !== 'pending_clinical_clearance'
  && normalizeAppointmentStatus(appointment.contract?.status) !== 'signed'
  && ['approved', 'awaiting payment', 'payment pending', 'contract pending', 'paid', 'scheduled', 'ready to start'].includes(normalizeAppointmentStatus(appointment.status))
))

const bookingOrderReady = (order) => bookingOrderReadyForPayment(order, customerLifecycleAppointments.value)

const canPayAppointment = (appointment) => {
  if (isBookingPaymentHoldReleased(appointment, holdClockNow.value)) return false
  if (appointment.isBookingOrderParent) return bookingOrderReady(appointment) && paymentDue(appointment) > 0
  if (appointment.sameDayTreatmentStatus === 'pending_clinical_clearance') return false
  if (appointment.paymentManagedByOrganizer && !appointment.isBookingOrderParent && !appointment.isGroupParent) return false
  const status = normalizeAppointmentStatus(appointment?.status)
  if (normalizeAppointmentStatus(appointment?.contract?.status) !== 'signed') return false
  return status === 'awaiting payment' || status === 'payment pending' || status === 'approved' || status === 'balance due'
}

const canModifyUnpaidAppointment = (appointment) => {
  if (isBookingPaymentHoldReleased(appointment, holdClockNow.value)) return false
  const status = normalizeAppointmentStatus(appointment?.status)
  return ['awaiting payment', 'payment pending', 'approved'].includes(status)
}

const paymentHoldMessage = (appointment) => {
  if (!appointment || ['confirmed', 'awaiting_clinical_clearance'].includes(String(appointment.paymentHoldStatus || '').toLowerCase())) return ''
  if (String(appointment.paymentHoldStatus || '').toLowerCase() === 'released' || normalizeAppointmentStatus(appointment.status) === 'expired') return 'This 15-minute hold expired and the time was released. Choose a new available time to book again.'
  if (!appointment.paymentHoldExpiresAt) return ''
  if (isBookingPaymentHoldReleased(appointment, holdClockNow.value)) return 'This 15-minute hold expired and the time was released. Choose a new available time to book again.'
  if (appointment.activePaymongoCheckoutSessionId || String(appointment.paymentHoldStatus || '').toLowerCase() === 'checkout_active') return 'Checkout is in progress. The slot stays reserved while payment is confirmed.'
  const remaining = Math.max(0, Math.ceil((timestampMillis(appointment.paymentHoldExpiresAt) - holdClockNow.value) / 1000))
  const minutes = Math.floor(remaining / 60)
  const seconds = String(remaining % 60).padStart(2, '0')
  return `Slot held for ${minutes}:${seconds}. Sign and pay before the timer ends.`
}

const getAppointmentPolicyEntries = (appointment) => {
  const snapshot = appointment?.clinicPolicySnapshot
  if (!snapshot || typeof snapshot !== 'object') return []
  return Object.entries(snapshot)
    .filter(([, policy]) => policy && String(policy.text || '').trim())
    .map(([key, policy]) => ({
      key,
      label: String(policy.label || key),
      text: String(policy.text || '').trim(),
    }))
}

const markPaymentAgreementViewed = (appointmentId, event) => {
  if (event?.target?.open) paymentAgreementViewed[appointmentId] = true
}

const createShortAppointmentReference = () => {
  const buffer = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buffer)
  else buffer[0] = Date.now()
  return `APT-${String(buffer[0] % 1000000).padStart(6, '0')}`
}

const canConfirmCompletion = (appointment) => {
  const status = normalizeAppointmentStatus(appointment?.status)
  const online = isOnlineConsultationAppointment(appointment)
  const workerFinished = Boolean(appointment?.workerCompleted)
    || (online && Boolean(appointment?.startedAt) && appointment?.consultationEndedByTimer === true)
  if (!workerFinished || appointment?.customerCompleted || !['awaiting customer confirmation', 'balance due'].includes(status)) return false
  if (!online) return true
  return appointment?.consultationDispute?.status !== 'Open'
    && String(appointment?.treatmentNotes || '').trim().length >= 10
    && !(appointment?.treatmentTeam || []).some(member => !member.participationConfirmed)
}

const verifyServiceKey = (appointment) => {
  selectedServiceKeyAppointment.value = appointment
  showServiceKeyModal.value = true
}

const closeServiceKeyModal = () => {
  showServiceKeyModal.value = false
  selectedServiceKeyAppointment.value = null
}

const submitServiceKey = async (serviceKey, appointmentOverride = null) => {
  const appointment = appointmentOverride || selectedServiceKeyAppointment.value
  if (!appointment?.id) return
  serviceKeyVerifying.value = true
  try {
    if (isOnlineConsultationAppointment(appointment)) {
      const result = await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/consultation-access`, { serviceKey })
      appointment.consultationCustomerReadyAt = new Date().toISOString()
      appointment.meetLink = ''
      toast.success('You are checked in. Your practitioner will invite you to Google Meet when ready.')
    } else {
      await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/verify-service-key`, { serviceKey })
      toast.success('Service key verified.')
    }
    closeServiceKeyModal()
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Unable to verify the service key.')
  } finally {
    serviceKeyVerifying.value = false
  }
}

const postAppointmentAction = async (appointmentId, path, body) => {
  const user = auth.currentUser
  if (!user) throw new Error('Please log in first.')
  const token = await user.getIdToken()
  const response = await fetch(`${OTP_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Appointment update failed.')
  return payload.data
}

const confirmCompletion = async (appointment) => {
  try {
    const data = await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/transition`, { action: 'customer_complete' })
    appointment.customerCompleted = true
    appointment.customerCompletedAt = new Date().toISOString()
    appointment.status = data?.status || (paymentDue(appointment) > 0 ? 'Balance Due' : 'Completed')
    toast.success('Your completion confirmation was submitted.')
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Unable to confirm completion.')
  }
}

const openFeedback = appointment => {
  feedbackModal.value = { open: true, appointment, rating: 0, comment: '', saving: false, error: '' }
}

const closeFeedbackModal = () => {
  if (feedbackModal.value.saving) return
  feedbackModal.value.open = false
}

const submitFeedback = async () => {
  const form = feedbackModal.value
  const appointment = form.appointment
  if (!appointment?.id || !Number.isInteger(form.rating) || form.rating < 1 || form.rating > 5) return
  form.saving = true
  form.error = ''
  try {
    await postAppointmentAction(appointment.id, `/appointments/${appointment.id}/feedback`, { rating: form.rating, comment: form.comment.trim() })
    toast.success('Thank you. Your feedback was submitted.')
    form.open = false
  } catch (error) {
    console.error(error)
    form.error = error?.message || 'Unable to submit feedback.'
    toast.error(error?.message || 'Unable to submit feedback.')
  } finally {
    form.saving = false
  }
}

const openContract = (appointment) => {
  selectedContractAppointment.value = appointment
  showContractModal.value = true
}

const closeContract = () => {
  showContractModal.value = false
  selectedContractAppointment.value = null
}

const contractUpdated = () => {
  const needsPayment = selectedContractAppointment.value && paymentDue(selectedContractAppointment.value) > 0
  closeContract()
  toast.success(needsPayment ? 'Contract signed. You can now complete payment.' : 'Contract signed successfully.')
  if (needsPayment) router.push({ name: 'customer-unpaid-appointments' })
}

const payAppointment = async (appointment) => {
  const user = auth.currentUser
  if (!user || !appointment?.id) return

  const bookingOrder = appointment.isBookingOrderParent === true
  if (!canPayAppointment(appointment)) {
    toast.error('Please sign the contract before proceeding to payment.')
    return
  }

  const totalAmount = Number(appointment.totalAmount || appointment.amount || 0)
  const amountPaid = Number(appointment.amountPaid || 0)
  const remainingAmount = paymentDue(appointment) / 100
  if (remainingAmount <= 0) {
    toast.info('This appointment has no remaining balance.')
    return
  }

  try {
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/paymongo/create-checkout-session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: Math.round(remainingAmount * 100),
        paymentMethodTypes: ['card', 'gcash', 'grab_pay'],
        description: `Payment for ${appointment.service || 'appointment'}`,
        referenceNumber: createShortAppointmentReference(),
        billing: { name: appointment.customerName || user.displayName || 'Customer', email: user.email || appointment.customerEmail || '' },
        successUrl: `${window.location.origin}${isUnpaidAppointmentsPage.value ? '/customer/unpaid-appointments' : '/customer/appointments'}?paymongo_status=success`,
        cancelUrl: `${window.location.origin}${isUnpaidAppointmentsPage.value ? '/customer/unpaid-appointments' : '/customer/appointments'}?paymongo_status=cancelled`,
        metadata: {
          module: 'customer_appointment',
          source: 'appointment_payment',
          appointmentId: appointment.id,
          customerId: user.uid,
          branchId: appointment.branchId || '',
          practitionerId: appointment.practitionerId || appointment.assignedPractitionerId || '',
          appointmentDate: appointment.date || '',
          appointmentTime: appointment.time || '',
          totalServiceDurationMinutes: appointment.totalServiceDurationMinutes || 60,
          paymentAgreementAcknowledged: true,
          ...(bookingOrder ? { bookingOrder: true } : {}),
        },
        paymentAgreementAcknowledged: true,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success || !payload.data?.id || !payload.data?.checkout_url) {
      throw new Error(payload?.error || 'Failed to create payment checkout.')
    }
    localStorage.setItem('pendingAppointmentPayment', JSON.stringify({ appointmentId: appointment.id, checkoutSessionId: payload.data.id }))
    window.location.href = payload.data.checkout_url
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Failed to start appointment payment.')
  }
}

const handlePaymentReturn = async (user) => {
  if (!user || route.query.paymongo_status !== 'success') return
  const raw = localStorage.getItem('pendingAppointmentPayment')
  if (!raw) return
  let pending = null
  try { pending = JSON.parse(raw) } catch (_error) { pending = null }
  if (!pending?.appointmentId || !pending?.checkoutSessionId) return

  try {
    const token = await user.getIdToken()
    const response = await fetch(`${OTP_API_BASE}/appointments/${pending.appointmentId}/record-payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ checkoutSessionId: pending.checkoutSessionId, paymentAgreementAcknowledged: true }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Payment verification failed.')
    localStorage.removeItem('pendingAppointmentPayment')
    toast.success('Appointment payment recorded.')
  } catch (error) {
    console.error(error)
    toast.error(error?.message || 'Payment verification failed. Please refresh and try again.')
  }
}

onMounted(trackPageLoad(() => {
  holdClockInterval = setInterval(() => { holdClockNow.value = Date.now() }, 1000)
  startClinicsListener()
  unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
    if (!user) {
      upcomingAppointments.value = []
      pastAppointments.value = []
      onlineConsultations.value = []
      loading.value = false
      return
    }
    startAppointmentsListener(user.uid)
    startTreatmentSessionsListener(user.uid)
    await handlePaymentReturn(user)
  })
}))

onUnmounted(() => {
  if (holdClockInterval) clearInterval(holdClockInterval)
  if (unsubscribeAppointments) unsubscribeAppointments()
  if (unsubscribeClinics) unsubscribeClinics()
  if (unsubscribeTreatmentSessions) unsubscribeTreatmentSessions()
  if (unsubscribeAuth) unsubscribeAuth()
})
</script>

<style scoped>
.appointments-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.appointments-main {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.appointments-content {
  display: grid;
  gap: 1.35rem;
  padding: 1.5rem 1.4rem 2rem;
}

.appointments-header,
.appointments-panel,
.state-panel,
.request-modal-shell,
.request-policy-card,
.request-card {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.appointments-header,
.appointments-panel {
  padding: 1.25rem;
}

.appointments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.appointments-eyebrow { margin: 0 0 .35rem; color: #98613d; font-size: .7rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }

.appointments-subtitle {
  margin: 0.65rem 0 0;
  max-width: 42rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.appointments-pay-link {
  flex: 0 0 auto;
  border: 1px solid rgba(126, 78, 53, 0.24);
  border-radius: 1rem;
  padding: 0.8rem 1rem;
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  font-size: 0.84rem;
  font-weight: 700;
}

.appointments-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: .55rem;
  padding: .65rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 12px 30px rgba(87, 56, 35, 0.06);
}

.appointments-tab {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  border: 1px solid transparent;
  border-radius: .85rem;
  padding: .7rem .85rem;
  background: transparent;
  color: #765942;
  font-size: .82rem;
  font-weight: 700;
  transition: background-color .16s ease, color .16s ease, transform .16s ease;
}

.appointments-tab:hover { background: #f7ead8; color: #4e301f; }
.appointments-tab-active { border-color: rgba(141, 90, 59, .42); background: #8d5a3b; color: #fffaf3; box-shadow: 0 5px 14px rgba(87, 56, 35, .16); }
.appointments-tab-active:hover { background: #75452e; color: #fffaf3; }
.appointments-tab span { min-width: 1.35rem; border-radius: 999px; padding: .08rem .38rem; background: rgba(94, 59, 39, .1); font-size: .7rem; text-align: center; }
.appointments-tab-active span { background: rgba(255, 250, 243, .22); }

.appointments-kicker,
.panel-kicker,
.appointment-card-kicker,
.request-modal-kicker,
.request-card-kicker,
.request-field-label,
.meta-label,
.summary-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.appointments-kicker,
.panel-kicker,
.request-modal-kicker,
.request-card-kicker,
.request-field-label,
.summary-label,
.meta-label {
  color: #8c6d55;
}

.appointments-title,
.panel-title,
.appointment-service,
.request-modal-title {
  font-family: "Playfair Display", "Times New Roman", serif;
}

.appointments-title {
  margin: 0;
  color: #3d281d;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.appointments-subtitle,
.panel-note,
.appointment-clinic,
.request-modal-summary,
.request-action-note,
.state-copy,
.request-selected-date {
  color: rgba(76, 54, 40, 0.76);
}

.panel-head,
.appointment-card-head,
.appointment-actions,
.request-modal-head,
.request-card-head,
.request-modal-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.panel-title,
.request-card-title {
  margin: 0.55rem 0 0;
  color: #3d281d;
  font-size: clamp(1.6rem, 2.4vw, 2.15rem);
  line-height: 1;
}

.panel-note {
  margin: 0;
  align-self: center;
  font-size: 0.88rem;
}

.unpaid-appointments-panel {
  border-color: rgba(181, 127, 92, 0.5);
}

.unpaid-appointments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.unpaid-appointment-card {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  border-radius: 1.35rem;
  background: rgba(255, 251, 244, 0.94);
}

.unpaid-appointment-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.unpaid-appointment-title {
  margin: 0.45rem 0 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: 1.45rem;
  line-height: 1.15;
}

.unpaid-appointment-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.unpaid-appointment-details div {
  padding: 0.7rem;
  border-radius: 0.85rem;
  background: rgba(248, 236, 217, 0.65);
}

.unpaid-appointment-details dt {
  color: #8c6d55;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.unpaid-appointment-details dd {
  margin: 0.3rem 0 0;
  color: #3d281d;
  font-size: 0.9rem;
  font-weight: 700;
}

.unpaid-appointment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.appointments-table-wrap {
  margin-top: 1.25rem;
  overflow-x: auto;
  border-radius: 1.35rem;
  border: 1px solid rgba(230, 193, 150, 0.72);
  background: rgba(255, 251, 244, 0.94);
}

.appointments-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 780px;
}

.appointments-table thead tr {
  background: linear-gradient(180deg, #d8b891 0%, #c8a57d 100%);
}

.appointments-table th {
  padding: 1rem 1.05rem;
  text-align: left;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4d301f;
}

.appointments-table td {
  padding: 1rem 1.05rem;
  border-top: 1px solid rgba(230, 193, 150, 0.5);
  color: #6a4b39;
  font-size: 0.95rem;
  vertical-align: middle;
}

.appointments-table tbody tr:nth-child(even) {
  background: rgba(252, 245, 233, 0.76);
}

.appointments-table tbody tr:hover {
  background: rgba(245, 230, 209, 0.72);
}

.appointment-service-cell {
  min-width: 16rem;
}

.table-primary {
  color: #2f1d14;
  font-weight: 600;
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.appointment-menu-key {
  margin: 0;
  padding: 0.6rem 0.7rem;
  color: #7f6655;
  font-size: 0.78rem;
  line-height: 1.4;
}

.appointment-menu-key {
  margin: 0.15rem 0;
  border-left: 3px solid #c28b5e;
  border-radius: 0.5rem;
  background: #fff4e4;
  overflow-wrap: anywhere;
}

.appointment-details-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(35, 23, 15, 0.72);
  backdrop-filter: blur(5px);
}

.appointment-details-shell {
  display: flex;
  flex-direction: column;
  width: min(100%, 58rem);
  max-height: min(92vh, 58rem);
  overflow: hidden;
  border: 1px solid var(--customer-border, #e6c196);
  border-radius: 1.4rem;
  background: var(--customer-surface, #fffdf9);
  color: var(--customer-text, #3d281d);
  box-shadow: 0 28px 90px rgba(20, 12, 7, 0.4);
}

.appointment-details-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.4rem;
  border-bottom: 1px solid var(--customer-border, #ead8c0);
  background: var(--customer-surface-soft, #fbf3e7);
}

.appointment-details-kicker {
  margin: 0;
  color: var(--customer-muted, #98613d);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.appointment-details-title {
  margin: 0.3rem 0 0;
  color: var(--customer-text, #3d281d);
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.15;
}

.appointment-details-subtitle { margin: 0.4rem 0 0; color: var(--customer-muted, #806b5a); }
.appointment-details-header-actions { display: flex; align-items: center; gap: 0.65rem; }
.appointment-details-body { display: grid; gap: 0.9rem; padding: 1rem 1.25rem; overflow-y: auto; }

.appointment-details-section {
  padding: 1rem;
  border: 1px solid var(--customer-border, #ead8c0);
  border-radius: 1rem;
  background: var(--customer-surface-soft, #fff9f0);
  color: var(--customer-text, #3d281d);
}

.appointment-details-section h3 { margin: 0; font-size: 0.94rem; font-weight: 800; }
.appointment-details-section p { margin: 0.4rem 0 0; line-height: 1.5; }
.appointment-details-section-head { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.75rem; }
.appointment-details-section-head > span { color: var(--customer-muted, #806b5a); font-size: 0.78rem; }

.appointment-details-facts,
.appointment-details-price-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.7rem; margin: 0.75rem 0 0; }
.appointment-details-facts > div,
.appointment-details-price-list > div { min-width: 0; padding: 0.65rem 0.75rem; border-radius: 0.75rem; background: var(--customer-surface, #fffdf9); }
.appointment-details-facts dt,
.appointment-details-price-list dt { color: var(--customer-muted, #806b5a); font-size: 0.67rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
.appointment-details-facts dd,
.appointment-details-price-list dd { margin: 0.25rem 0 0; font-size: 0.88rem; font-weight: 700; overflow-wrap: anywhere; }
.appointment-details-code,
.appointment-details-payment-info code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; }
.appointment-details-price-list .appointment-details-price-total { border: 1px solid var(--customer-border, #ddbe99); background: var(--customer-surface, #fffdf9); }
.appointment-details-price-total dt,
.appointment-details-price-total dd { font-weight: 900; }

.appointment-details-schedule-list,
.appointment-details-payments { display: grid; gap: 0.55rem; }
.appointment-details-schedule-row,
.appointment-details-payment-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; border: 1px solid var(--customer-border, #ead8c0); border-radius: 0.8rem; background: var(--customer-surface, #fffdf9); }
.appointment-details-schedule-row > div,
.appointment-details-payment-info { display: grid; min-width: 0; gap: 0.2rem; }
.appointment-details-schedule-row span,
.appointment-details-payment-info span { color: var(--customer-muted, #806b5a); font-size: 0.78rem; overflow-wrap: anywhere; }
.appointment-details-visit-time { text-align: right; }
.appointment-details-visit-status { flex: 0 0 auto; }
.appointment-details-payment-row .appointment-button { flex: 0 0 auto; }
.appointment-details-note { margin: 0; color: var(--customer-muted, #806b5a); font-size: 0.85rem; line-height: 1.5; }
.appointment-details-note-error { color: var(--ac-danger, #a04646); }

.appointment-details-actions { display: grid; gap: 0.75rem; padding: 1rem 1.25rem; border-top: 1px solid var(--customer-border, #ead8c0); background: var(--customer-surface-soft, #fbf3e7); }
.appointment-details-action-buttons { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; }

.payment-agreement {
  flex: 1 1 100%;
  min-width: min(22rem, 100%);
  padding: 0.8rem;
  border: 1px solid rgba(126, 78, 53, 0.22);
  border-radius: 0.85rem;
  background: rgba(255, 248, 238, 0.72);
}

.payment-price-breakdown {
  display: grid;
  gap: 0.35rem;
  margin: 0.65rem 0;
  color: #5d4536;
  font-size: 0.82rem;
}

.payment-price-breakdown > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.payment-price-breakdown dd { text-align: right; font-weight: 600; }
.payment-price-breakdown .payment-price-total { padding-top: 0.35rem; border-top: 1px solid rgba(126, 78, 53, 0.22); color: #3d281d; font-weight: 700; }

.payment-agreement-details summary {
  cursor: pointer;
  color: #7c4f34;
  font-size: 0.82rem;
  font-weight: 700;
}

.payment-agreement-copy {
  margin-top: 0.65rem;
  max-height: 9rem;
  overflow-y: auto;
  color: rgba(76, 54, 40, 0.82);
  font-size: 0.78rem;
  line-height: 1.45;
}

.payment-agreement-copy p + p {
  margin-top: 0.45rem;
}

.payment-agreement-check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.7rem;
  color: #4d301f;
  font-size: 0.78rem;
  line-height: 1.35;
}

.payment-agreement-check input {
  accent-color: #8d5a3b;
  margin-top: 0.15rem;
}

.table-empty-cell {
  padding: 1.4rem 1rem;
  text-align: center;
  color: rgba(76, 54, 40, 0.76);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-badge-primary {
  background: rgba(181, 127, 92, 0.16);
  color: #7c4f34;
  border: 1px solid rgba(181, 127, 92, 0.28);
}

.status-badge-warning {
  background: rgba(213, 160, 94, 0.18);
  color: #8a5e1d;
  border: 1px solid rgba(213, 160, 94, 0.28);
}

.status-badge-danger {
  background: rgba(194, 96, 96, 0.14);
  color: #9a4444;
  border: 1px solid rgba(194, 96, 96, 0.22);
}

.status-badge-muted {
  background: rgba(157, 139, 121, 0.16);
  color: #6f6258;
  border: 1px solid rgba(157, 139, 121, 0.22);
}

.appointment-button,
.request-button,
.request-nav-button,
.request-close-button {
  transition: transform 0.18s ease, filter 0.18s ease, background-color 0.18s ease;
}

.appointment-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.85rem;
  padding: 0.8rem 1.15rem;
  border-radius: 1rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.appointment-button:disabled,
.request-nav-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  transform: none;
}

.appointment-button-secondary {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

.appointment-button-danger {
  border: 1px solid rgba(175, 98, 98, 0.28);
  background: linear-gradient(120deg, #ca7c7c 0%, #b85e5e 48%, #974444 100%);
  color: #fff8f2;
}

.appointment-button:hover:not(:disabled),
.request-button:hover,
.request-nav-button:hover:not(:disabled),
.request-close-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.state-panel {
  margin-top: 1.25rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.state-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #342419;
}

.state-copy {
  margin: 0.85rem auto 0;
  max-width: 32rem;
  line-height: 1.7;
}

.request-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(35, 20, 12, 0.56);
  backdrop-filter: blur(6px);
  /* allow overlay to scroll on small viewports */
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.request-modal-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 70rem;
  /* ensure shell fits inside viewport and allow inner scrolling */
  max-height: calc(100vh - 2rem);
  overflow: visible; /* let .request-modal-body handle scrolling */
}

.request-modal-head {
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid rgba(230, 193, 150, 0.8);
}

.request-modal-title {
  margin: 0.45rem 0 0;
  color: #3d281d;
  font-size: clamp(1.75rem, 2.5vw, 2.2rem);
  line-height: 1.02;
}

.request-modal-summary {
  margin: 0.65rem 0 0;
  font-size: 0.95rem;
}

.request-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
}

.request-modal-body {
  flex: 1;
  /* Constrain body height so it can scroll inside the shell on small screens */
  max-height: calc(100vh - 12rem);
  overflow-y: auto;
  padding: 1.4rem 1.5rem;
  display: grid;
  gap: 1rem;
  -webkit-overflow-scrolling: touch;
}

.request-policy-card,
.request-card {
  padding: 1rem;
}

.request-policy-card {
  background: linear-gradient(180deg, rgba(255, 248, 235, 0.98), rgba(249, 236, 215, 0.94));
  color: #674532;
}

.request-policy-title {
  font-weight: 700;
  color: #523324;
}

.request-textarea {
  width: 100%;
  padding: 0.95rem 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.9);
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.request-textarea:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.request-reschedule-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
}

.request-card-head {
  padding-bottom: 0.85rem;
  border-bottom: 1px solid rgba(230, 193, 150, 0.7);
}

.request-card-head-stack {
  align-items: center;
}

.request-nav-button {
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
  padding: 0.65rem 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.request-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8c6d55;
}

.request-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.request-day-button {
  min-height: 4.6rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fffaf2;
  color: #513626;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.request-day-other {
  background: #f6efe6;
  color: #a08a7a;
}

.request-day-available:hover {
  transform: translateY(-1px);
  border-color: rgba(181, 127, 92, 0.6);
  background: #fff4e6;
}

.request-day-disabled {
  opacity: 0.45;
}

.request-day-selected {
  border-color: rgba(181, 127, 92, 0.85);
  background: rgba(181, 127, 92, 0.16);
  color: #6f4330;
}

.request-day-dot {
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: #d7a764;
}

.request-day-disabled .request-day-dot {
  background: #b6a79a;
}

.request-day-selected .request-day-dot {
  background: #8d5a3b;
}

.request-selected-date {
  margin: 0.9rem 0 0;
  font-size: 0.92rem;
}

.request-duration-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #7c5b44;
  padding: 0.4rem 0.8rem;
  font-size: 0.76rem;
  font-weight: 700;
}

.request-info-card {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fffaf2;
  color: #6a4b39;
  font-size: 0.92rem;
}

.request-info-card-warn {
  border-color: rgba(213, 160, 94, 0.35);
  background: rgba(255, 243, 219, 0.92);
  color: #8a5e1d;
}

.request-info-card-muted {
  border-style: dashed;
  color: #8a7768;
}

.request-slot-list {
  display: grid;
  gap: 0.65rem;
  max-height: 20rem;
  overflow-y: auto;
  margin-top: 1rem;
  padding-right: 0.25rem;
}

.request-slot-button {
  text-align: left;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fffaf2;
  color: #513626;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.request-slot-button:hover {
  transform: translateY(-1px);
  border-color: rgba(181, 127, 92, 0.6);
  background: #fff4e6;
}

.request-slot-button-selected {
  border-color: rgba(181, 127, 92, 0.9);
  background: rgba(181, 127, 92, 0.16);
}

.request-detail-list {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(230, 193, 150, 0.7);
  display: grid;
  gap: 0.5rem;
  color: #6b5040;
  font-size: 0.92rem;
}

.request-detail-strong {
  font-weight: 700;
  color: #452b1e;
}

.request-modal-actions {
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(230, 193, 150, 0.7);
}

.request-action-note {
  margin: 0;
  max-width: 30rem;
  font-size: 0.82rem;
}

.request-action-buttons {
  display: flex;
  gap: 0.75rem;
}

.request-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.85rem;
  padding: 0.8rem 1.15rem;
  border-radius: 1rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.request-button-secondary {
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
}

.request-button-primary {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

@media (min-width: 1280px) {
  .appointments-content {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 1023px) {
  .request-reschedule-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .appointment-details-overlay {
    align-items: flex-start;
    overflow-y: auto;
    padding: 0.65rem;
  }

  .appointment-details-shell {
    max-height: calc(100dvh - 1.3rem);
    border-radius: 1rem;
  }

  .appointment-details-header,
  .appointment-details-body,
  .appointment-details-actions {
    padding: 0.9rem;
  }

  .appointment-details-facts,
  .appointment-details-price-list {
    grid-template-columns: 1fr;
  }

  .appointment-details-schedule-row,
  .appointment-details-payment-row {
    align-items: stretch;
    flex-direction: column;
  }

  .appointment-details-visit-time { text-align: left; }
  .appointment-details-action-buttons { width: 100%; }

  .unpaid-appointment-details {
    grid-template-columns: 1fr;
  }

  .unpaid-appointment-actions .appointment-button {
    width: 100%;
  }

  .appointments-content {
    padding: 1rem 1rem 1.5rem;
  }

  .appointments-header,
  .panel-head,
  .request-modal-head,
  .request-card-head,
  .request-modal-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .appointments-pay-link {
    width: 100%;
  }

  .request-action-buttons {
    width: 100%;
  }

  .appointment-button,
  .request-button {
    width: 100%;
  }

  .request-modal-overlay {
    align-items: flex-start;
    /* make overlay scrollable and avoid locking viewport on small screens */
    overflow: auto;
    padding-top: 1rem;
  }

  .request-modal-shell {
    width: 100%;
    max-width: 100%;
    max-height: calc(100vh - 1.5rem);
  }

  .request-modal-body {
    max-height: calc(100vh - 10rem);
  }

  .appointments-content {
    padding: 1rem 0.75rem 1.25rem;
    gap: 1rem;
  }

  .appointments-table-wrap {
    overflow: hidden;
  }

  .appointments-table {
    min-width: 0;
    table-layout: fixed;
  }

  .appointments-table thead {
    display: none;
  }

  .appointments-table,
  .appointments-table tbody,
  .appointments-table tr,
  .appointments-table td {
    display: block;
    width: 100%;
  }

  .appointments-table tbody tr {
    padding: 0.35rem 0;
  }

  .appointments-table td {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.8rem 0.9rem;
    border-top: 1px solid rgba(230, 193, 150, 0.46);
    white-space: normal;
    word-break: break-word;
    font-size: 0.92rem;
  }


  .appointments-table tbody tr {
    margin-bottom: 0.9rem;
    border: 1px solid rgba(230, 193, 150, 0.72);
    border-radius: 1.25rem;
    overflow: hidden;
    background: rgba(255, 251, 244, 0.96);
    box-shadow: 0 12px 28px rgba(87, 56, 35, 0.06);
  }

  .appointments-table tbody tr:hover {
    background: rgba(255, 251, 244, 0.96);
  }

  .appointments-table td:first-child {
    border-top: 0;
  }

  .appointments-table td::before {
    content: attr(data-label);
    flex: 0 0 32%;
    color: #8c6d55;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .appointments-table td[data-label=""]::before {
    content: none;
  }

  .appointment-service-cell {
    min-width: 0;
  }

  .appointment-service-cell .table-primary {
    line-height: 1.45;
  }

  .table-actions {
    justify-content: flex-end;
    width: 100%;
  }

  .table-actions .appointment-button {
    width: 100%;
  }

  .status-badge {
    white-space: normal;
    text-align: center;
  }

  .table-empty-cell {
    display: block;
    padding: 1.1rem 0.9rem;
    text-align: center;
  }

  .table-empty-cell::before {
    content: none;
  }
}

</style>
