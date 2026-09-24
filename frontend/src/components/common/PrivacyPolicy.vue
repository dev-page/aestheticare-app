<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h1 class="text-3xl font-playfair font-bold text-charcoal-900 mb-6">Privacy Policy</h1>

      <div class="space-y-6 text-charcoal-700 leading-relaxed">
        <p>AesthetiCare collects the information needed to create and manage accounts and to provide the platform's clinic, booking, order, payment, and support features.</p>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>1. What personal information do we collect?</span>
          </summary>
          <div class="policy-body">
            <p>We collect the following personal information:</p>
            <ul class="list-disc pl-6 space-y-1">
              <li>Full name</li>
              <li>Mobile Number</li>
              <li>Email Address</li>
              <li>Address</li>
              <li>Birth date</li>
            </ul>
            <p class="mt-3">Moreover, if you are registering your clinic, the following documents will be needed for verification of legitimacy:</p>
            <ul class="list-disc pl-6 space-y-1">
              <li>Government-Issued ID</li>
              <li>Business Registration or Permit</li>
              <li>BIR 2303 or Certificate of Registration</li>
              <li>Sanitary Certificate</li>
              <li>DOH License to Operate</li>
              <li>PRC ID of Medical Director</li>
            </ul>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>2. Why do we need to collect personal information?</span>
          </summary>
          <div class="policy-body">
            <p>The collected personal information is used for account registration, account access, clinic verification, bookings, orders, payments, notifications, support requests, and other platform features you use.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>3. When do we collect personal information?</span>
          </summary>
          <div class="policy-body">
            <p>
              We collect personal information when you create or update an account, submit a clinic registration,
              place a booking or order, send a support request, or otherwise use a platform feature that requires it.
            </p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>4. How do we collect personal information?</span>
          </summary>
          <div class="policy-body">
            <p>
              We collect and process information that you provide through the platform, including forms, document uploads,
              bookings, orders, account settings, and support requests.
            </p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>5. How do we store the data collected?</span>
          </summary>
          <div class="policy-body">
            <p>Account, booking, order, payment, clinic-registration, notification, and support information is stored in the services used to operate AesthetiCare. The platform provides account deactivation, deletion-request, and data-export options in account settings where available.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>6. How do we dispose of the data collected?</span>
          </summary>
          <div class="policy-body">
            <p>The platform provides a request-account-deletion option. Deletion requests are reviewed before an account is closed; records may remain where they are needed for operational, financial, or legal reasons.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>7. What are the risks involved in processing your personal information?</span>
          </summary>
          <div class="policy-body">
            <p>Using an online platform carries risks, including unauthorized access, service interruption, and data transmission or storage risks. Keep your password private and report suspected unauthorized account activity through the platform's support options.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>8. What are the rights of the data subjects?</span>
          </summary>
          <div class="policy-body">
            <p>The platform lets you update profile information, export available account data, deactivate an account, and submit a deletion request. You may also use the support options for questions about information associated with your account.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>9. How can data subjects exercise these rights?</span>
          </summary>
          <div class="policy-body">
            <p>Submit a support report through the platform or email AesthetiCare Support with your request. Requests are reviewed by the appropriate platform administrator.</p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>10. Consent Form of System User</span>
          </summary>
          <div class="policy-body">
            <p>
              By accessing and using the AesthetiCare platform and by providing your personal data, you hereby
              authorize AesthetiCare to collect, process, and store such information. This may include, but is not
              limited to, your full name, email address, mobile number, and other relevant details
              required for account registration and platform services.
            </p>
            <p class="mt-3">
              Your personal data will be processed using electronic or automated means and will be retained only for
              as long as necessary in accordance with applicable data protection laws, regulations, and
              AesthetiCare's internal policies. The collection and processing of your personal data are necessary for
              account creation, service delivery, system functionality, and compliance with legal obligations.
            </p>
            <p class="mt-3">
              By proceeding with registration and use of the platform, you acknowledge that you have read and
              understood this Privacy Notice and hereby give your informed consent to the collection and processing
              of your personal data.
            </p>
          </div>
        </details>

        <details class="policy-item">
          <summary class="policy-summary">
            <span>11. Feedback on the Privacy Notice</span>
          </summary>
          <div class="policy-body">
            <p>
              If you have any questions, concerns, requests, or if you wish to exercise your rights under applicable
              data protection laws, you may contact AesthetiCare through the following:
            </p>
            <p class="mt-3 font-semibold text-gold-700">Email: support@aestheticare.online</p>
            <p>Support: Use the Report Issue page while signed in.</p>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
 h1 {
  font-family: 'Playfair Display', serif;
}

h2 {
  font-family: 'Playfair Display', serif;
}

.policy-item {
  border: 1px solid rgba(214, 169, 123, 0.35);
  border-radius: 0.9rem;
  background: #fffdf9;
  overflow: hidden;
}

.policy-summary {
  cursor: pointer;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #8c5a3a;
  font-weight: 600;
  font-family: 'Playfair Display', serif;
  list-style: none;
}

.policy-summary::-webkit-details-marker {
  display: none;
}

.policy-summary::after {
  content: '';
  width: 0.6rem;
  height: 0.6rem;
  border-right: 2px solid #c99b64;
  border-bottom: 2px solid #c99b64;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.policy-item[open] .policy-summary::after {
  transform: rotate(225deg);
}

.policy-body {
  padding: 0 1.25rem 1.25rem;
  color: #4b2f1f;
}
</style>

