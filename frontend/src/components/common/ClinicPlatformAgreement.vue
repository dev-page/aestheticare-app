<template>
  <div ref="agreementElement" class="clinic-agreement" @scroll="handleScroll">
    <p class="text-xs text-slate-500">Agreement version: {{ version }} | Last updated: September 13, 2026</p>

    <h2>Clinic Platform Agreement</h2>
    <p>
      This agreement applies to the clinic owner or authorized representative registering the clinic on AesthetiCare.
      It supplements the general Terms and Conditions and Privacy Policy.
    </p>

    <h3>1. Platform services</h3>
    <p>
      AesthetiCare provides clinic operations, appointment, customer, payment, reporting, and related marketplace tools.
      The clinic remains responsible for its services, products, staff, customers, documents, licenses, and legal compliance.
    </p>

    <h3>2. Platform commissions</h3>
    <p>
      The platform charges a commission on eligible transactions processed through AesthetiCare:
    </p>
    <ul>
      <li><strong>Products:</strong> 5% of the product sale amount.</li>
      <li><strong>Completed services:</strong> 10% of the completed service amount.</li>
    </ul>
    <p>
      The applicable commission is recorded with the transaction and deducted when calculating the clinic's net amount.
      Refund treatment, including any non-refundable commission, follows the applicable platform and clinic policies.
    </p>

    <h3>3. Clinic responsibilities</h3>
    <p>
      The clinic must provide accurate information, maintain valid documents, protect account credentials, use customer data
      lawfully, and ensure that its employees use only the permissions assigned to them.
    </p>

    <h3>4. Payments and records</h3>
    <p>
      The clinic authorizes AesthetiCare to record eligible transactions, commissions, refunds, and settlement information
      needed to operate the platform and provide financial reports.
    </p>

    <h3>5. Agreement changes</h3>
    <p>
      AesthetiCare may publish a new agreement version. Material changes may require the clinic to accept the new version
      before continued use of affected platform features.
    </p>

    <h3>6. Acceptance</h3>
    <p>
      By signing electronically, the representative confirms that they are authorized to bind the clinic and agrees to this
      agreement, including the commission schedule above.
    </p>

    <div v-if="!reachedEnd" class="clinic-agreement-hint">
      Scroll to the end of this agreement to enable acceptance.
    </div>
    <div v-else class="clinic-agreement-hint clinic-agreement-hint-ready">
      You have reached the end of the agreement. You may now close this window and sign below.
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'

defineProps({
  version: {
    type: String,
    default: 'clinic-platform-agreement-v1',
  },
})

const emit = defineEmits(['reached-end'])
const agreementElement = ref(null)
const reachedEnd = ref(false)

const markReachedEndIfReady = (element) => {
  if (!element) return
  const isAtEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 12
  if (isAtEnd && !reachedEnd.value) {
    reachedEnd.value = true
    emit('reached-end')
  }
}

const handleScroll = (event) => markReachedEndIfReady(event.currentTarget)

onMounted(() => {
  nextTick(() => markReachedEndIfReady(agreementElement.value))
})
</script>

<style scoped>
.clinic-agreement {
  max-height: min(65vh, 620px);
  overflow-y: auto;
  padding: 1rem;
  color: #4a3427;
  line-height: 1.65;
}

.clinic-agreement h2 {
  margin-top: 1rem;
  color: #2f1d14;
  font-size: 1.35rem;
  font-weight: 700;
}

.clinic-agreement h3 {
  margin-top: 1.35rem;
  color: #704725;
  font-size: 1rem;
  font-weight: 700;
}

.clinic-agreement ul {
  margin: 0.65rem 0 0.65rem 1.25rem;
  list-style: disc;
}

.clinic-agreement-hint {
  position: sticky;
  bottom: 0;
  margin-top: 1.5rem;
  padding: 0.75rem;
  border: 1px solid #e2b47c;
  border-radius: 0.75rem;
  background: #fff7ed;
  color: #8a541f;
  font-size: 0.8rem;
}

.clinic-agreement-hint-ready {
  border-color: #8ac9a9;
  background: #effaf3;
  color: #1e7045;
}
</style>
