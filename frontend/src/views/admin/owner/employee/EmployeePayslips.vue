<template>
  <div class="flex module-theme min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6">
      <h1 class="text-2xl font-bold">My Payslips</h1>
      <p class="mt-2 text-slate-400">Payslips released by HR after Finance approval.</p>
      <p v-if="error" role="alert" class="my-4 text-red-400">{{ error }}</p>
      <article v-for="slip in slips" :key="slip.id" class="payslip-card mt-5 rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="text-xs font-semibold uppercase tracking-widest text-amber-300">AesthetiCare payslip</p><h2 class="mt-1 font-semibold">{{ slip.payPeriod || slip.payPeriodMonthKey }}</h2></div>
          <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="slip.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'">{{ slip.paymentStatus || 'Unpaid' }}</span>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm"><dt>Gross pay</dt><dd>{{ money(slip.totalEarnings) }}</dd><dt>Deductions</dt><dd>{{ money(slip.totalDeductions) }}</dd><dt class="font-semibold text-white">Net pay</dt><dd class="font-bold text-emerald-300">{{ money(slip.netPay) }}</dd></dl>
        <p v-if="slip.paymentStatus === 'Paid'" class="mt-4 text-xs text-slate-400">Paid {{ formatDate(slip.paidAt) }} · {{ slip.paymentMethod || 'Payment method not recorded' }} · Ref: {{ slip.paymentReference || '-' }}</p>
        <details class="mt-4 border-t border-slate-700 pt-3 text-sm"><summary class="cursor-pointer text-slate-200">View deduction details</summary><p v-for="(value, key) in slip.deductions" :key="key" class="mt-2 text-slate-400">{{ key }}: {{ money(value.amount) }}</p></details>
        <button type="button" class="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700" @click="printSlip(slip)">Print / Save PDF</button>
      </article>
      <p v-if="!slips.length && !error" class="mt-5 text-slate-400">No released payslips yet.</p>
    </main>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, onSnapshot } from 'firebase/firestore'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
const slips = ref([]), error = ref('')
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))
const formatDate = (value) => value?.toDate ? value.toDate().toLocaleString('en-PH') : value ? new Date(value).toLocaleString('en-PH') : '-'
const printSlip = (slip) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=760,height=720')
  if (!popup) return
  popup.document.write(`<title>AesthetiCare Payslip</title><style>body{font-family:Arial,sans-serif;color:#2f1d14;padding:32px}h1{margin:0}dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}dt{color:#70594a}dd{margin:0;font-weight:700}.status{display:inline-block;padding:6px 10px;border-radius:999px;background:#e7f6e9;color:#24633b;font-weight:700}</style><h1>AesthetiCare Payslip</h1><p>${slip.payPeriod || slip.payPeriodMonthKey || ''}</p><p class="status">${slip.paymentStatus || 'Unpaid'}</p><dl><dt>Gross pay</dt><dd>${money(slip.totalEarnings)}</dd><dt>Deductions</dt><dd>${money(slip.totalDeductions)}</dd><dt>Net pay</dt><dd>${money(slip.netPay)}</dd></dl><p>Payment reference: ${slip.paymentReference || '-'}</p>`)
  popup.document.close()
  popup.focus()
  popup.print()
}
let stopAuth, stopSlips
onMounted(() => { stopAuth = onAuthStateChanged(getAuth(), (user) => {
  stopSlips?.(); slips.value = []
  if (user) stopSlips = onSnapshot(collection(getFirestore(), 'users', user.uid, 'payslips'), (snapshot) => { slips.value = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.payPeriod).localeCompare(String(a.payPeriod))) }, (e) => { error.value = e.message })
}) })
onUnmounted(() => { stopAuth?.(); stopSlips?.() })
</script>
