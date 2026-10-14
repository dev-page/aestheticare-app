<template>
  <div class="po-summary">
    <dl class="po-overview">
      <div><dt>Supplier</dt><dd>{{ supplierName }}</dd></div>
      <div><dt>Branch</dt><dd>{{ branchName }}</dd></div>
      <div v-if="record.category || record.purpose"><dt>Purpose</dt><dd>{{ record.purpose || record.category }}</dd></div>
    </dl>
    <aside v-if="decisionReason" class="po-decision">
      <strong>{{ record.status === 'Rejected' ? 'Reason for rejection' : 'Response needed' }}</strong>
      <p>{{ decisionReason }}</p>
    </aside>
    <section class="po-items">
      <h3>Order items <span>{{ record.lines?.length || 0 }} {{ record.lines?.length === 1 ? 'item' : 'items' }}</span></h3>
      <div class="po-table-wrap"><table>
        <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
        <tbody><tr v-for="(line, index) in record.lines || []" :key="line.itemId || index">
          <td><strong>{{ line.name || 'Unnamed item' }}</strong><small v-if="line.notes || line.condition">{{ line.notes || line.condition }}</small><small v-if="showReceiving">{{ deliveryResult(record, line).summary }}<br />{{ deliveryResult(record, line).notes }}</small></td>
          <td>{{ line.quantity ?? line.ordered ?? '—' }} {{ line.unit || '' }}</td>
          <td>{{ line.unitPrice == null ? 'Not recorded' : currency(line.unitPrice) }}</td>
          <td>{{ line.unitPrice == null || (line.quantity ?? line.ordered) == null ? '—' : currency(Number(line.unitPrice) * Number(line.quantity ?? line.ordered)) }}</td>
        </tr><tr v-if="!record.lines?.length"><td colspan="4">No order items recorded.</td></tr></tbody>
      </table></div>
    </section>
    <div class="po-bottom">
      <section class="po-delivery"><h3>Delivery</h3><dl>
        <div><dt>Expected date</dt><dd>{{ deliveryDate }}</dd></div>
        <div><dt>Location</dt><dd>{{ record.deliveryLocation || 'Not provided' }}</dd></div>
        <div v-if="record.paymentTerms"><dt>Payment terms</dt><dd>{{ record.paymentTerms }}</dd></div>
      </dl></section>
      <section class="po-costs"><h3>Cost breakdown</h3><dl>
        <div><dt>Items subtotal</dt><dd>{{ record.subtotal == null ? 'Not recorded' : currency(record.subtotal) }}</dd></div>
        <div><dt>Tax</dt><dd>{{ record.tax == null ? 'Not recorded' : currency(record.tax) }}</dd></div>
        <div><dt>Delivery fee</dt><dd>{{ record.delivery == null ? 'Not recorded' : currency(record.delivery) }}</dd></div>
        <div><dt>Other fees</dt><dd>{{ record.otherCharges == null ? 'Not recorded' : currency(record.otherCharges) }}</dd></div>
        <div v-if="Number(record.discount)"><dt>Discount</dt><dd>−{{ currency(record.discount) }}</dd></div>
        <div class="po-total"><dt>Order total</dt><dd>{{ record.total == null ? 'Not recorded' : currency(record.total) }}</dd></div>
      </dl></section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  record: { type: Object, required: true },
  supplierName: { type: String, required: true },
  branchName: { type: String, required: true },
  currency: { type: Function, required: true },
  deliveryResult: { type: Function, required: true },
})
const decisionReason = computed(() => ['Rejected', 'Clarification Requested', 'Returned to Procurement'].includes(props.record.status)
  ? props.record.confirmationReason || props.record.remarks || 'No reason was recorded. Check the activity and messages below.' : '')
const showReceiving = computed(() => ['Partially Received', 'Delivered', 'Completed'].includes(props.record.status))
const deliveryDate = computed(() => {
  const key = String(props.record.deliveryDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'Not scheduled'
  const date = new Date(`${key}T00:00:00+08:00`)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date) : 'Not scheduled'
})
</script>

<style scoped>
.po-summary { color: #503727; }
.po-overview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 18px 0; padding: 18px; border: 1px solid #efd8c0; border-radius: 12px; background: #fffbf6; }
dt { font-size: 12px; color: #95765e; }
dd { margin: 5px 0 0; font-size: 14px; overflow-wrap: anywhere; }
.po-overview dd { font-weight: 600; }
.po-decision { padding: 14px 17px; border: 1px solid #efc8b8; border-radius: 10px; background: #fff3eb; margin-bottom: 20px; font-size: 13px; }
.po-decision strong { color: #974b30; }
.po-decision p { margin: 5px 0 0; line-height: 1.6; white-space: pre-wrap; }
h3 { font-size: 15px; margin: 0 0 12px; }
.po-items h3 { display: flex; justify-content: space-between; gap: 12px; }
.po-items h3 span { font-size: 11px; font-weight: 400; color: #95765e; }
.po-table-wrap { overflow-x: auto; border: 1px solid #efd8c0; border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: #f8ecda; color: #805c40; font-size: 11px; font-weight: 600; text-align: left; padding: 12px 14px; white-space: nowrap; }
td { padding: 15px 14px; border-top: 1px solid #efd8c0; vertical-align: top; }
td:not(:first-child) { white-space: nowrap; }
td small { display: block; font-size: 11px; color: #95765e; margin-top: 5px; }
.po-bottom { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; margin-top: 22px; }
.po-delivery dl { display: grid; gap: 16px; }
.po-delivery dd { line-height: 1.6; }
.po-costs { padding: 18px; border: 1px solid #efd8c0; border-radius: 12px; background: #fffbf6; }
.po-costs dl { display: grid; gap: 10px; }
.po-costs dl > div { display: flex; justify-content: space-between; gap: 18px; }
.po-costs dd { margin: 0; text-align: right; }
.po-total { border-top: 1px solid #e8ceb0; margin-top: 4px; padding-top: 14px; align-items: center; }
.po-total dt { color: #503727; font-weight: 600; font-size: 13px; }
.po-total dd { font-size: 21px; font-weight: 700; }
@media (max-width: 640px) { .po-bottom, .po-overview { grid-template-columns: minmax(0, 1fr); } }
</style>
