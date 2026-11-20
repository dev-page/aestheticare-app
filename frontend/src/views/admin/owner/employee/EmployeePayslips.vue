<template>
  <div class="module-theme flex min-h-screen bg-[#f8f3ea] text-[#4a3324]">
    <EmployeeSidebar />

    <main
      v-page-loading="{ active: pageLoading, variant: 'table', columns: 6, rows: 4 }"
      class="min-w-0 flex-1 p-4 md:p-8"
    >
      <div class="mx-auto max-w-7xl space-y-6">
        <header class="rounded-[1.75rem] border border-[#ead8c2] bg-[#fffdf9] p-6 md:p-8">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[#91643f]">Payroll</p>
          <h1 class="mt-3 font-serif text-3xl font-bold text-[#402719] md:text-4xl">My Payslips</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-[#806b5a]">
            Review pay statements released by your clinic and print a copy for your records.
          </p>
        </header>

        <div v-if="error" role="alert" class="rounded-2xl border border-[#e7b8ac] bg-[#fff0eb] px-5 py-4 text-sm text-[#8e392b]">
          {{ error }}
        </div>

        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Payslip summary">
          <article class="rounded-2xl border border-[#ead8c2] bg-[#fffdf9] p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#91643f]">Payslips released</p>
            <p class="mt-3 text-3xl font-semibold text-[#402719]">{{ slips.length }}</p>
            <p class="mt-1 text-sm text-[#806b5a]">Available in your account</p>
          </article>
          <article class="rounded-2xl border border-[#ead8c2] bg-[#fffdf9] p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#91643f]">Latest pay period</p>
            <p class="mt-3 text-xl font-semibold text-[#402719]">{{ latestSlip ? formatPayPeriod(latestSlip) : '—' }}</p>
            <p class="mt-1 text-sm text-[#806b5a]">Most recently released statement</p>
          </article>
          <article class="rounded-2xl border border-[#ead8c2] bg-[#fffdf9] p-5 sm:col-span-2 xl:col-span-1">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#91643f]">Latest net pay</p>
            <p class="mt-3 text-3xl font-semibold text-[#402719]">{{ latestSlip ? money(latestSlip.netPay) : '—' }}</p>
            <p class="mt-1 text-sm text-[#806b5a]">{{ latestSlip ? paymentStatus(latestSlip) : 'No released payslip yet' }}</p>
          </article>
        </section>

        <section class="overflow-hidden rounded-[1.75rem] border border-[#ead8c2] bg-[#fffdf9]">
          <div class="flex flex-col gap-2 border-b border-[#ead8c2] px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-7">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#91643f]">Pay statements</p>
              <h2 class="mt-2 font-serif text-2xl font-semibold text-[#402719]">Payslip history</h2>
            </div>
            <p class="text-sm text-[#806b5a]">{{ slips.length }} {{ slips.length === 1 ? 'statement' : 'statements' }}</p>
          </div>

          <div v-if="slips.length" class="space-y-4 p-4 md:p-6">
            <article
              v-for="slip in slips"
              :key="slip.id"
              class="overflow-hidden rounded-2xl border border-[#ead8c2] bg-[#fffaf4]"
            >
              <div class="flex flex-col gap-4 border-b border-[#ead8c2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#91643f]">Pay period</p>
                  <h3 class="mt-1 text-lg font-semibold text-[#402719]">{{ formatPayPeriod(slip) }}</h3>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <span
                    class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                    :class="isPaid(slip)
                      ? 'border-[#b7d8c1] bg-[#e9f5eb] text-[#326044]'
                      : 'border-[#ead2ac] bg-[#fff2d9] text-[#785321]'"
                  >
                    {{ paymentStatus(slip) }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#402719] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5d3b27]"
                    @click="printSlip(slip)"
                  >
                    Print payslip
                  </button>
                </div>
              </div>

              <div class="grid gap-3 p-4 sm:grid-cols-3 md:p-5">
                <div class="rounded-xl border border-[#ead8c2] bg-[#fffdf9] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#806b5a]">Total earnings</p>
                  <p class="mt-2 text-lg font-semibold text-[#402719]">{{ money(totalEarnings(slip)) }}</p>
                </div>
                <div class="rounded-xl border border-[#ead8c2] bg-[#fffdf9] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#806b5a]">Deductions</p>
                  <p class="mt-2 text-lg font-semibold text-[#402719]">{{ money(slip.totalDeductions) }}</p>
                </div>
                <div class="rounded-xl border border-[#d4e4d4] bg-[#f1f7ef] p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b7052]">Net pay</p>
                  <p class="mt-2 text-xl font-bold text-[#31543a]">{{ money(slip.netPay) }}</p>
                </div>
              </div>

              <details class="border-t border-[#ead8c2] px-5 py-4">
                <summary class="cursor-pointer text-sm font-semibold text-[#674a36] hover:text-[#402719]">
                  View earnings and deduction details
                </summary>
                <div class="mt-4 grid gap-5 md:grid-cols-2">
                  <div>
                    <h4 class="text-xs font-semibold uppercase tracking-[0.16em] text-[#91643f]">Earnings breakdown</h4>
                    <dl v-if="earningLines(slip).length" class="mt-3 space-y-2">
                      <div v-for="line in earningLines(slip)" :key="line.label" class="flex justify-between gap-4 text-sm">
                        <dt class="text-[#806b5a]">{{ line.label }}</dt>
                        <dd class="font-medium text-[#402719]">{{ money(line.amount) }}</dd>
                      </div>
                    </dl>
                    <p v-else class="mt-3 text-sm text-[#806b5a]">No separate earning items were recorded.</p>
                    <p v-if="slip.hoursWorked !== undefined" class="mt-3 text-xs text-[#806b5a]">Hours recorded: {{ slip.hoursWorked }}</p>
                  </div>
                  <div>
                    <h4 class="text-xs font-semibold uppercase tracking-[0.16em] text-[#91643f]">Deductions</h4>
                    <dl v-if="deductionLines(slip).length" class="mt-3 space-y-2">
                      <div v-for="line in deductionLines(slip)" :key="line.label" class="flex justify-between gap-4 text-sm">
                        <dt class="text-[#806b5a]">{{ line.label }}</dt>
                        <dd class="font-medium text-[#402719]">{{ money(line.amount) }}</dd>
                      </div>
                    </dl>
                    <p v-else class="mt-3 text-sm text-[#806b5a]">No deductions were recorded for this period.</p>
                  </div>
                </div>
                <div v-if="isPaid(slip)" class="mt-5 border-t border-[#ead8c2] pt-4 text-sm text-[#806b5a]">
                  <span>Paid {{ formatDate(slip.paidAt) }}</span>
                  <span v-if="slip.paymentMethod"> · {{ slip.paymentMethod }}</span>
                  <span v-if="slip.paymentReference"> · Reference {{ slip.paymentReference }}</span>
                </div>
              </details>
            </article>
          </div>

          <div v-else-if="!error" class="px-6 py-14 text-center">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#ead8c2] bg-[#fff7ec] text-[#91643f]" aria-hidden="true">
              <span class="text-xl">₱</span>
            </div>
            <h3 class="mt-4 font-serif text-xl font-semibold text-[#402719]">No payslips available</h3>
            <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-[#806b5a]">
              Payslips will appear here after your clinic releases them.
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, getFirestore, onSnapshot } from 'firebase/firestore'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'
import { usePageLoading } from '@/composables/usePageLoading'

const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
const slips = ref([])
const error = ref('')
const latestSlip = computed(() => slips.value[0] || null)

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0))

const totalEarnings = (slip) => slip.totalEarnings ?? slip.totalPay ?? 0

const formatPayPeriod = (slip) => {
  const value = String(slip.payPeriod || slip.payPeriodMonthKey || '').trim()
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  return value || 'Pay period not provided'
}

const formatDate = (value) => {
  if (!value) return 'Date not recorded'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const isPaid = (slip) => String(slip.paymentStatus || '').toLowerCase() === 'paid'
const paymentStatus = (slip) => isPaid(slip) ? 'Paid' : slip.paymentStatus || 'Unpaid'

const earningLines = (slip) => {
  const lines = [
    { label: 'Base pay', amount: slip.basePayAmount ?? slip.earnings?.basicSalary },
    { label: 'Overtime and night differential', amount: slip.overtimePay },
    { label: 'Service commissions', amount: slip.commission ?? slip.earnings?.commission }
  ].filter((line) => line.amount !== undefined && line.amount !== null && Number(line.amount) !== 0)
  return lines.length ? lines : (totalEarnings(slip) ? [{ label: 'Total earnings', amount: totalEarnings(slip) }] : [])
}

const deductionLines = (slip) => Object.entries(slip.deductions || {})
  .map(([key, value]) => ({
    label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()),
    amount: value && typeof value === 'object' ? value.amount : value
  }))
  .filter((line) => Number.isFinite(Number(line.amount)) && Number(line.amount) !== 0)

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]))

const printSlip = (slip) => {
  const popup = window.open('', '_blank', 'width=760,height=720')
  if (!popup) {
    error.value = 'Your browser blocked the print window. Allow pop-ups for this site, then try again.'
    return
  }

  popup.opener = null
  const earningsHtml = earningLines(slip).map((line) => `<tr><th>${escapeHtml(line.label)}</th><td>${escapeHtml(money(line.amount))}</td></tr>`).join('')
  const deductionsHtml = deductionLines(slip).map((line) => `<tr><th>${escapeHtml(line.label)}</th><td>${escapeHtml(money(line.amount))}</td></tr>`).join('')
  const paidDetails = isPaid(slip)
    ? `<p>Paid ${escapeHtml(formatDate(slip.paidAt))}${slip.paymentMethod ? ` · ${escapeHtml(slip.paymentMethod)}` : ''}${slip.paymentReference ? ` · Reference ${escapeHtml(slip.paymentReference)}` : ''}</p>`
    : ''

  popup.document.open()
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AesthetiCare Payslip</title><style>
    body{font-family:Arial,sans-serif;color:#402719;padding:32px;max-width:760px;margin:0 auto}
    h1{margin:0;font-size:26px}p{color:#806b5a}table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{text-align:left;padding:10px;border-bottom:1px solid #ead8c2}td{text-align:right;font-weight:600}
    .status{display:inline-block;padding:6px 10px;border-radius:999px;background:#e9f5eb;color:#326044;font-weight:700}
    .totals{margin-top:24px;padding-top:12px;border-top:2px solid #ead8c2}.net{font-size:20px;color:#31543a}
    @media print{body{padding:0}}
  </style></head><body><p>AesthetiCare · Pay statement</p><h1>${escapeHtml(formatPayPeriod(slip))}</h1>
    <p class="status">${escapeHtml(paymentStatus(slip))}</p>
    <h2>Earnings</h2><table>${earningsHtml}</table>
    <h2>Deductions</h2><table>${deductionsHtml || '<tr><th>No deductions recorded</th><td>—</td></tr>'}</table>
    <div class="totals"><p>Total earnings: <strong>${escapeHtml(money(totalEarnings(slip)))}</strong></p>
    <p>Total deductions: <strong>${escapeHtml(money(slip.totalDeductions))}</strong></p>
    <p class="net">Net pay: <strong>${escapeHtml(money(slip.netPay))}</strong></p>${paidDetails}</div>
  </body></html>`)
  popup.document.close()
  popup.focus()
  popup.print()
}

let stopAuth
let stopSlips

onMounted(trackPageLoad(() => {
  stopAuth = pageListener(onAuthStateChanged, getAuth(), (user) => {
    stopSlips?.()
    slips.value = []
    error.value = ''
    if (!user) return

    stopSlips = pageListener(
      onSnapshot,
      collection(getFirestore(), 'users', user.uid, 'payslips'),
      (snapshot) => {
        slips.value = snapshot.docs
          .map((document) => ({ ...document.data(), id: document.id }))
          .sort((a, b) => String(b.payPeriodMonthKey || b.payPeriod || b.id).localeCompare(String(a.payPeriodMonthKey || a.payPeriod || a.id)))
      },
      () => {
        error.value = 'Payslips could not be loaded. Refresh the page to try again.'
      }
    )
  })
}))

onUnmounted(() => {
  stopAuth?.()
  stopSlips?.()
})
</script>
