<template>
  <section class="my-6 rounded-xl border border-emerald-500 bg-white p-6 text-slate-900" aria-live="polite">
    <h2 class="text-xl font-semibold">Payment confirmed</h2>
    <p>{{ receipt.clientName }} · {{ receipt.service }}</p>
    <p>Appointment: {{ receipt.date }} at {{ receipt.time }}</p>
    <p>Paid: PHP {{ Number(receipt.total).toFixed(2) }} · {{ receipt.method }}</p>
    <p v-if="receipt.method === 'Cash'">Change: PHP {{ Number(receipt.change || 0).toFixed(2) }}</p>
    <p class="mt-4 text-sm">Your service key</p>
    <p class="text-3xl font-bold tracking-widest">{{ receipt.serviceKey }}</p>
    <p class="my-3 text-sm">Present this key to your assigned practitioner at the appointment. Review and sign the contract at the clinic before treatment.</p>
    <p v-if="receipt.emailSent" class="text-sm">A copy was also emailed to the client.</p>
    <button class="mr-3 rounded bg-slate-800 px-4 py-2 text-white" @click="printReceipt">Print receipt &amp; service key</button>
    <button class="rounded border border-slate-400 px-4 py-2" @click="$emit('close')">Close</button>
  </section>
</template>

<script setup>
const props = defineProps({ receipt: { type: Object, required: true } })
defineEmits(['close'])
const printReceipt = () => {
  const receipt = props.receipt
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.title = 'Appointment receipt'
  const copy = doc.createElement('pre')
  copy.style.cssText = 'font:16px sans-serif;white-space:pre-wrap;line-height:1.8'
  copy.textContent = `AesthetiCare — Appointment receipt\n\n${receipt.clientName}\n${receipt.service}\nAppointment: ${receipt.date} ${receipt.time}\nPaid: PHP ${Number(receipt.total).toFixed(2)} (${receipt.method})\nChange: PHP ${Number(receipt.change || 0).toFixed(2)}\n\nSERVICE KEY: ${receipt.serviceKey}\n\nPresent this key to your assigned practitioner at your appointment.\nReview and sign the clinic contract before treatment.\n\nAppointment reference: ${receipt.appointmentId}`
  doc.body.appendChild(copy)
  frame.contentWindow.focus()
  frame.contentWindow.print()
  setTimeout(() => frame.remove(), 60000)
}
</script>
