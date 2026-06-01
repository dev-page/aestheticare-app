<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="bg-white rounded-2xl shadow-lg p-8">
      <h1 class="text-3xl font-playfair font-bold text-charcoal-900 mb-6">Terms and Conditions</h1>
      
      <div class="space-y-6 text-charcoal-700 leading-relaxed">
        <p class="text-sm text-charcoal-500">Last Updated: {{ new Date().toLocaleDateString() }}</p>
        
        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">1. Introduction</h2>
          <p>Welcome to AesthetiCare, your comprehensive aesthetic center management platform. By accessing or using our platform, you agree to comply with and be bound by these Terms and Conditions. Please read them carefully before using our services.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">2. Acceptance of Terms</h2>
          <p>By registering for an account, accessing, or using AesthetiCare services, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">3. User Accounts</h2>
          <p>When you create an account, you are responsible for maintaining the security of your account information, including your password. You agree to accept responsibility for all activities that occur under your account. We reserve the right to suspend or terminate accounts that violate these terms.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">4. Platform Usage</h2>
          <p>AesthetiCare is designed for professional use by aesthetic clinics, med spas, and healthcare providers. You agree to use our platform in compliance with all applicable laws and regulations. Unauthorized use or abuse of our services may result in account termination.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">5. Privacy and Data Protection</h2>
          <p>We are committed to protecting your privacy and handling your data in accordance with our Privacy Policy. By using our services, you consent to the collection, storage, and processing of your personal information as described in our Privacy Policy.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">6. Intellectual Property</h2>
          <p>All content and materials available on AesthetiCare, including but not limited to text, graphics, logos, images, and software, are the property of AesthetiCare or its licensors and are protected by intellectual property laws. You may not reproduce, distribute, or create derivative works from this content without our prior written consent.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">7. Limitation of Liability</h2>
          <p>AesthetiCare provides its services on an "as is" and "as available" basis. We do not guarantee the accuracy, completeness, or reliability of any information on our platform. In no event shall AesthetiCare be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of our services.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">8. Changes to Terms</h2>
          <p>We reserve the right to modify these Terms and Conditions at any time. Any changes will be effective immediately upon posting to our platform. Your continued use of AesthetiCare following changes to these terms constitutes your acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">9. Governing Law</h2>
          <p>These Terms and Conditions shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law principles. Any legal action or proceeding arising from these terms shall be brought exclusively in the courts of [Your Jurisdiction].</p>
        </section>

        <section>
          <h2 class="text-xl font-playfair font-semibold text-gold-700 mb-3">10. Contact Information</h2>
          <p>For questions or concerns about these Terms and Conditions, please contact us at:</p>
          <p class="mt-2 text-gold-700 font-semibold">AesthetiCare Support</p>
          <p>Email: support@aestheticare.com</p>
          <p>Phone: +1 (555) 123-4567</p>
        </section>

        <div class="mt-8 pt-6 border-t border-gold-200">
          <p class="text-sm text-charcoal-500">By clicking "I agree" or by using AesthetiCare services, you confirm that you have read, understood, and agree to these Terms and Conditions.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
</script>

<style scoped>
h1 {
  font-family: 'Playfair Display', serif;
}

h2 {
  font-family: 'Playfair Display', serif;
}
</style>
