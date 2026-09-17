<template>
  <div class="flex module-theme min-h-screen bg-slate-900 text-white">
    <OwnerSidebar />
    <main class="min-w-0 flex-1 p-6">
      <h1 class="text-2xl font-bold">My Payslips</h1>
      <p class="mt-2 text-slate-400">Payslips released by HR after Finance approval.</p>
      <p v-if="error" role="alert" class="my-4 text-red-400">{{ error }}</p>
      <div v-for="slip in slips" :key="slip.id" class="mt-5 rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 class="font-semibold">{{ slip.payPeriod || slip.payPeriodMonthKey }}</h2>
        <dl class="mt-3 grid grid-cols-2 gap-3"><dt>Gross pay</dt><dd>{{ money(slip.totalEarnings) }}</dd><dt>Deductions</dt><dd>{{ money(slip.totalDeductions) }}</dd><dt>Net pay</dt><dd class="font-bold">{{ money(slip.netPay) }}</dd></dl>
        <details class="mt-3"><summary>Deduction details</summary><p v-for="(value, key) in slip.deductions" :key="key">{{ key }}: {{ money(value.amount) }}</p></details>
      </div>
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
let stopAuth, stopSlips
onMounted(() => { stopAuth = onAuthStateChanged(getAuth(), (user) => {
  stopSlips?.(); slips.value = []
  if (user) stopSlips = onSnapshot(collection(getFirestore(), 'users', user.uid, 'payslips'), (snapshot) => { slips.value = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => String(b.payPeriod).localeCompare(String(a.payPeriod))) }, (e) => { error.value = e.message })
}) })
onUnmounted(() => { stopAuth?.(); stopSlips?.() })
</script>
