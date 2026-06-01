<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">Plan Payments</h1>
      <p class="text-slate-400 mb-6">Payment history from clinic owners for their subscriptions.</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Clinic</th>
              <th class="text-left text-slate-300 px-4 py-3">Plan</th>
              <th class="text-left text-slate-300 px-4 py-3">Amount</th>
              <th class="text-left text-slate-300 px-4 py-3">Paid On</th>
              <th class="text-left text-slate-300 px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-3 text-slate-200" colspan="5">Loading payments...</td>
            </tr>
            <tr v-else-if="error">
              <td class="px-4 py-3 text-rose-300" colspan="5">{{ error }}</td>
            </tr>
            <tr v-else-if="payments.length === 0">
              <td class="px-4 py-3 text-slate-200" colspan="5">No payments yet.</td>
            </tr>
            <tr v-else v-for="payment in payments" :key="payment.id" class="border-t border-slate-700/60">
              <td class="px-4 py-3 text-slate-100">
                <div class="font-semibold">{{ payment.payerName || '-' }}</div>
                <div class="text-xs text-slate-400">{{ payment.payerEmail || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-200">{{ payment.planName || payment.planId || '-' }}</td>
              <td class="px-4 py-3 text-slate-200">{{ formatCurrency(payment.amount) }}</td>
              <td class="px-4 py-3 text-slate-200">{{ formatDate(payment.paidAt || payment.createdAt) }}</td>
              <td class="px-4 py-3 text-slate-200">{{ payment.referenceNumber || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'

export default {
  name: 'SuperAdminSubscriptionPayments',
  components: { SuperAdminSidebar },
  setup() {
    const payments = ref([])
    const loading = ref(false)
    const error = ref('')

    const toNumber = (value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'code',
        minimumFractionDigits: 2,
      }).format(toNumber(amount))
    }

    const normalizeTimestamp = (value) => {
      if (!value) return null
      if (typeof value?.toDate === 'function') return value.toDate()
      if (value instanceof Date) return value
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const formatDate = (value) => {
      const date = normalizeTimestamp(value)
      if (!date) return '-'
      return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    }

    const loadPayments = async () => {
      loading.value = true
      error.value = ''
      try {
        const q = query(collection(db, 'planPayments'), orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(q)
        payments.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
      } catch (err) {
        console.error('Failed to load plan payments:', err)
        error.value = 'Failed to load payments.'
        payments.value = []
      } finally {
        loading.value = false
      }
    }

    onMounted(loadPayments)

    return {
      payments,
      loading,
      error,
      formatCurrency,
      formatDate,
    }
  }
}
</script>

