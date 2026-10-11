<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 5, rows: 5 }" class="flex-1 p-8">
      <h1 class="text-3xl font-bold text-white mb-2">Plan Payments</h1>
      <p class="text-slate-400 mb-6">Payment history from clinic owners for their subscriptions.</p>

      <input v-model.trim="search" type="search" placeholder="Filter clinic, email, plan, or reference..." class="mb-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" />

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
            <tr v-else-if="!filteredPayments.length"><td class="px-4 py-3 text-slate-200" colspan="5">No payments match the filter.</td></tr>
            <tr v-else v-for="payment in paginatedPayments" :key="payment.id" class="border-t border-slate-700/60">
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
        <TablePagination v-model:page="currentPage" v-model:page-size="pageSize" :total-items="filteredPayments.length" />
      </section>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'

export default {
  name: 'SuperAdminSubscriptionPayments',
  components: { SuperAdminSidebar, TablePagination },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const payments = ref([])
    const search = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const loading = ref(false)
    const error = ref('')
    let unsubscribePayments = null

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

    const loadPayments = () => {
      if (unsubscribePayments) unsubscribePayments()
      loading.value = true
      error.value = ''
      const q = query(collection(db, 'planPayments'), orderBy('createdAt', 'desc'))
      unsubscribePayments = pageListener(onSnapshot, q, (snapshot) => {
        payments.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        loading.value = false
      }, (err) => {
        console.error('Failed to load plan payments:', err)
        error.value = 'Failed to load payments.'
        payments.value = []
        loading.value = false
      })
    }

    const filteredPayments = computed(() => {
      const keyword = search.value.toLowerCase()
      if (!keyword) return payments.value
      return payments.value.filter((payment) => [payment.payerName, payment.payerEmail, payment.planName, payment.planId, payment.referenceNumber].join(' ').toLowerCase().includes(keyword))
    })
    const paginatedPayments = computed(() => filteredPayments.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
    const totalPages = computed(() => Math.max(1, Math.ceil(filteredPayments.value.length / pageSize.value)))
    watch([search, pageSize], () => { currentPage.value = 1 })
    watch(totalPages, (count) => { if (currentPage.value > count) currentPage.value = count })

    onMounted(loadPayments)
    onUnmounted(() => unsubscribePayments?.())

    return {
      pageLoading,
      payments,
      search,
      filteredPayments,
      paginatedPayments,
      currentPage,
      pageSize,
      loading,
      error,
      formatCurrency,
      formatDate,
    }
  }
}
</script>

