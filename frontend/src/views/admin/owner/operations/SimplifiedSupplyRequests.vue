<template>
  <div class="module-theme supply-requests-page flex min-h-screen bg-slate-900 text-slate-100" :class="{ 'finance-page': mode === 'finance' }">
    <OwnerSidebar />
    <main v-page-loading="{ active: pageLoading, blocks: mode === 'inventory' ? [{ variant: 'form', fields: 4, sections: 2 }, { variant: 'table', columns: 6, rows: 4 }] : [{ variant: 'table', columns: 6, rows: 5 }] }" class="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <div class="mx-auto max-w-6xl">
      <header class="border-b border-slate-700/80 pb-5">
        <p class="text-xs font-bold tracking-[0.16em] text-amber-400">{{ mode.toUpperCase() }} MANAGEMENT</p>
        <h1 class="mt-1 text-2xl font-bold text-white sm:text-3xl">{{ title }}</h1>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{{ intro }}</p>
      </header>
      <SupplyFlowGuide :department="mode" page="requests" />
      <p v-if="error" class="mt-5 rounded-xl border border-red-500/70 bg-red-950/40 p-4 text-sm text-red-100">{{ error }}</p>

      <section v-if="mode === 'inventory'" class="mt-6 rounded-2xl border border-slate-700 bg-slate-800/80 shadow-xl shadow-slate-950/20">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700 px-5 py-5 sm:px-6">
          <div><p class="text-xs font-bold tracking-[0.14em] text-amber-400">NEW REQUEST</p><h2 class="mt-1 text-lg font-semibold text-white">Request clinic supplies</h2><p class="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Describe the item your clinic needs. Procurement will compare external quotations and prepare a purchase order.</p></div>
          <span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">Inventory starts the request</span>
        </div>
          <form class="p-5 sm:p-6" @submit.prevent="createRequest" :aria-busy="busy">
            <p v-if="!requestBranchId" class="mb-5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">Your assigned clinic branch is still loading. Wait a moment before sending this request.</p>
          <div class="grid gap-5 md:grid-cols-2">
            <label class="form-field"><span>Supply or item name <b>*</b></span><input v-model.trim="draft.name" placeholder="e.g. Surgical gloves" required /><small>Use a general item description. It does not need to match a supplier's exact product name.</small></label>
            <label class="form-field"><span>Category <b>*</b></span><input v-model.trim="draft.category" placeholder="e.g. Medical supplies" required /><small>Group similar supplies to make the request easier to review.</small></label>
            <label class="form-field"><span>Quantity requested <b>*</b></span><input v-model.number="draft.quantity" type="number" min="1" required /><small>Enter the amount of supply the clinic needs.</small></label>
            <label class="form-field"><span>Unit of measure <b>*</b></span><select v-model="draft.unit" required><option value="units">Units</option><option value="boxes">Boxes</option><option value="packs">Packs</option><option value="bottles">Bottles</option><option value="pairs">Pairs</option><option value="pieces">Pieces</option><option value="rolls">Rolls</option><option value="tubes">Tubes</option><option value="grams">Grams</option><option value="kilograms">Kilograms</option><option value="milliliters">Milliliters</option><option value="liters">Liters</option></select><small>Choose how the requested quantity is measured.</small></label>
            <label class="form-field"><span>Required by <b>*</b></span><input v-model="draft.requiredDate" type="date" required /><small>Choose the date when this supply is needed.</small></label>
            <section class="delivery-location-panel md:col-span-2"><div><p class="form-field-label">Delivery location <b>*</b></p><p class="mt-1 text-sm text-slate-400">Choose where the supplies should arrive. The saved branch address will be attached to the request.</p></div><label class="form-field mt-4"><span>Clinic branch <b>*</b></span><select v-model="selectedDeliveryBranchId" required><option value="" disabled>Select delivery branch</option><option v-for="branch in data.branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option></select></label><p class="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300"><strong class="text-slate-100">Saved address:</strong> {{ branchAddress || 'No address is recorded for this branch.' }}</p></section>
            <label class="form-field"><span>Priority</span><select v-model="draft.priority"><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select><small>Normal is selected by default; raise it only if operations are affected.</small></label>
            <label class="form-field md:col-span-2"><span>Reason for request <b>*</b></span><textarea v-model.trim="draft.reason" placeholder="Explain why this supply is needed and how it will be used." required /><small>This helps Procurement and Finance assess the request.</small></label>
          </div>
          <div class="mt-6 flex flex-col gap-4 border-t border-slate-700 pt-5 sm:flex-row sm:items-center sm:justify-between"><p class="max-w-2xl text-sm leading-6 text-slate-400"><span class="font-semibold text-slate-200">Next step:</span> Procurement will be notified to contact clinic suppliers, record an external quotation, and prepare a purchase order.</p><button class="rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60" :disabled="busy || !requestBranchId">{{ busy ? 'Sending request…' : 'Send to Procurement' }}</button></div>
        </form>
      </section>

      <section class="mt-6">
        <div class="mb-4"><h2 class="text-lg font-semibold text-white">{{ mode === 'inventory' ? 'Your requests' : mode === 'procurement' ? 'Inventory requests for review' : 'Records requiring action' }}</h2><p class="mt-1 text-sm text-slate-400">{{ mode === 'inventory' ? 'Track the requests you have sent to Procurement.' : mode === 'procurement' ? 'Open a request to review its details, record the external supplier quotation, and prepare a purchase order.' : 'Review the information below and complete the next workflow step.' }}</p></div>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><label class="min-w-64 flex-1 text-sm text-slate-300"><span class="sr-only">Filter records</span><input v-model.trim="recordSearch" class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500" placeholder="Filter by reference, supply, status, or department" /></label><p class="text-xs text-slate-400">Newest records first · {{ filteredTableRecords.length }} record{{ filteredTableRecords.length === 1 ? '' : 's' }}</p></div>
        <TablePagination v-model:page="tablePage" v-model:page-size="rowsPerPage" :total-items="filteredTableRecords.length" part="top" item-label="records" />
        <div v-if="mode === 'procurement'" class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-slate-700 bg-slate-900/70 text-xs font-bold uppercase tracking-[.1em] text-slate-300"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Requested supplies</th><th class="px-4 py-3">Priority</th><th class="px-4 py-3">Required by</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right">Action</th></tr></thead>
              <tbody class="divide-y divide-slate-700"><tr v-for="record in pagedTableRecords" :key="record.id" class="transition hover:bg-slate-700/40"><td class="whitespace-nowrap px-4 py-4 font-semibold text-white">{{ record.number }}</td><td class="px-4 py-4 text-slate-300">{{ requestLines(record).map(line => `${line.name} × ${line.quantity} ${line.unit || 'units'}`).join(', ') || '—' }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'priority') }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'requiredDate') }}</td><td class="whitespace-nowrap px-4 py-4"><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ record.status }}</span></td><td class="whitespace-nowrap px-4 py-4 text-right"><button class="rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500 hover:text-slate-950" @click="openProcurementDetails(record)">Details</button></td></tr></tbody>
            </table>
          </div>
          <p v-if="!procurementRecords.length" class="px-5 py-8 text-center text-sm text-slate-400">No procurement requests currently need your action.</p>
        </div>
        <div v-if="mode === 'inventory'" class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-slate-700 bg-slate-900/70 text-xs font-bold uppercase tracking-[.1em] text-slate-300"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Requested supplies</th><th class="px-4 py-3">Priority</th><th class="px-4 py-3">Required by</th><th class="px-4 py-3">Date created</th><th class="px-4 py-3">Status</th></tr></thead>
              <tbody class="divide-y divide-slate-700"><tr v-for="record in pagedTableRecords" :key="record.id" class="transition hover:bg-slate-700/40"><td class="whitespace-nowrap px-4 py-4 font-semibold text-white">{{ record.number }}</td><td class="px-4 py-4 text-slate-300">{{ requestLines(record).map(line => `${line.name} × ${line.quantity} ${line.unit || 'units'}`).join(', ') || '—' }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'priority') }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ requestValue(record, 'requiredDate') }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ formatDateCreated(record.createdAt) }}</td><td class="whitespace-nowrap px-4 py-4"><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ record.status }}</span></td></tr></tbody>
            </table>
          </div>
          <p v-if="!inventoryRecords.length" class="px-5 py-8 text-center text-sm text-slate-400">No inventory requests have been created yet.</p>
        </div>
        <div v-if="mode === 'finance'" class="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
          <div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead class="border-b border-slate-700 bg-slate-900/70 text-xs font-bold uppercase tracking-[.1em] text-slate-300"><tr><th class="px-4 py-3">Purchase order</th><th class="px-4 py-3">Supplies</th><th class="px-4 py-3">Department</th><th class="px-4 py-3">Total</th><th class="px-4 py-3">Date created</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Budget decision</th><th class="px-4 py-3 text-right">Details</th></tr></thead><tbody class="divide-y divide-slate-700"><tr v-for="record in pagedTableRecords" :key="record.id" class="transition hover:bg-slate-700/40"><td class="whitespace-nowrap px-4 py-4 font-semibold text-white">{{ record.number }}</td><td class="px-4 py-4 text-slate-300">{{ record.lines?.map(line => `${line.name} × ${line.quantity}`).join(', ') || '—' }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ record.department || 'Inventory' }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-100">{{ currency(record.total) }}</td><td class="whitespace-nowrap px-4 py-4 text-slate-300">{{ formatDateCreated(record.createdAt) }}</td><td class="whitespace-nowrap px-4 py-4"><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ record.status }}</span></td><td class="min-w-64 px-4 py-4"><div v-if="record.status === 'For Review'" class="flex gap-2"><select v-model="budgetByRecord[record.id]" class="min-w-0 flex-1"><option value="">Choose a budget</option><option v-for="budget in eligibleBudgetsFor(record)" :key="budget.id" :value="budget.id">{{ budget.category }} · {{ currency(budgetAvailable(budget)) }} available</option></select><button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60" :disabled="!budgetByRecord[record.id] || busy" @click="approve(record)">Approve &amp; reserve</button></div><span v-else class="text-xs text-slate-400">{{ record.status === 'Approved' ? 'Budget reserved' : '—' }}</span><button v-if="record.status === 'Approved'" class="ml-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold" :disabled="busy" @click="goToProcurementOrders">Open in Procurement</button></td><td class="whitespace-nowrap px-4 py-4 text-right"><button class="rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500 hover:text-slate-950" @click="openFinanceOrderDetails(record)">Details</button></td></tr></tbody></table></div><p v-if="!financePurchaseOrders.length" class="px-5 py-8 text-center text-sm text-slate-400">No purchase orders currently need your action.</p></div>
        <TablePagination v-model:page="tablePage" v-model:page-size="rowsPerPage" :total-items="filteredTableRecords.length" part="bottom" item-label="records" />
      </section>
      </div>
    </main>
    <Modal :is-open="Boolean(selectedProcurementRecord)" panel-class="procurement-modal-panel" body-class="procurement-modal-body" @close="closeProcurementDetails">
      <template #header><div><p class="text-xs font-bold tracking-[.14em] text-amber-300">INVENTORY REQUEST REVIEW</p><h2 class="mt-1 text-xl font-bold text-white">{{ selectedProcurementRecord?.number }}</h2></div></template>
      <template #body>
        <div v-if="selectedProcurementRecord" class="space-y-5">
          <section class="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-semibold text-white">Inventory request details</h3><p class="mt-1 text-sm text-slate-400">The original supply request sent by Inventory.</p></div><span class="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-100">{{ relatedInventoryRequest(selectedProcurementRecord)?.number || 'Linked request' }}</span></div><dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt>Requested supplies</dt><dd>{{ requestLines(selectedProcurementRecord).map(line => `${line.name} × ${line.quantity} ${line.unit || 'units'}`).join(', ') || '—' }}</dd></div><div><dt>Category</dt><dd>{{ requestValue(selectedProcurementRecord, 'category') }}</dd></div><div><dt>Priority</dt><dd>{{ requestValue(selectedProcurementRecord, 'priority') }}</dd></div><div><dt>Required by</dt><dd>{{ requestValue(selectedProcurementRecord, 'requiredDate') }}</dd></div><div class="sm:col-span-2"><dt>Delivery location</dt><dd>{{ requestValue(selectedProcurementRecord, 'location') }}</dd></div><div class="sm:col-span-2"><dt>Reason for request</dt><dd>{{ requestValue(selectedProcurementRecord, 'reason') }}</dd></div></dl></section>
          <section v-if="selectedProcurementRecord.status === 'Received'" class="supply-quote-form space-y-4 rounded-xl border border-amber-500/35 bg-amber-950/15 p-4">
            <div><p class="supply-form-step">NEXT STEP · PROCUREMENT</p><h3 class="mt-1 font-semibold text-white">Add supplier quote</h3><p class="mt-1 text-sm text-slate-400">Choose a supplier, enter prices, and attach the quote. This creates the purchase order for Finance to approve.</p></div>
            <label class="form-field">Supplier <b>*</b><select v-model="supplierByRecord[selectedProcurementRecord.id]" class="mt-1 w-full"><option value="">Choose a clinic supplier</option><option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.businessName || supplier.name }}</option></select></label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-field">Expected delivery date <b>*</b><input v-model="quoteDraftByRecord[selectedProcurementRecord.id].deliveryDate" type="date" required /></label>
              <label class="form-field">Delivery location <b>*</b><input v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].deliveryLocation" required /></label>
            </div>
            <div class="space-y-3"><div><h4 class="font-semibold text-white">Quoted item prices</h4><p class="mt-1 text-xs text-slate-400">Enter the unit price shown for each requested item.</p></div>
              <div v-for="(line, index) in quoteDraftByRecord[selectedProcurementRecord.id].lines" :key="line.itemId" class="supply-quote-line rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                <div class="flex flex-wrap items-baseline justify-between gap-2"><p class="text-sm font-medium text-white">{{ line.name }}</p><span class="text-xs text-slate-400">{{ line.quantity }} {{ line.unit || 'units' }}</span></div>
                <label class="form-field mt-3">Unit price (PHP) <b>*</b><input v-model.number="quoteDraftByRecord[selectedProcurementRecord.id].lines[index].unitPrice" type="number" min="0.01" step="0.01" required /></label>
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-field">Tax on the quote<select v-model="quoteDraftByRecord[selectedProcurementRecord.id].taxTreatment"><option value="included">Included in item prices</option><option value="separate">Listed separately</option><option value="not-applicable">No tax applies</option></select></label>
              <label class="form-field">Total shown on quote (PHP) <b>*</b><input v-model.number="quoteDraftByRecord[selectedProcurementRecord.id].statedTotal" type="number" min="0.01" step="0.01" required /></label>
            </div>
            <p v-if="quoteTotalMatches(selectedProcurementRecord)" role="status" class="supply-quote-status is-ready">The entered total matches the item prices and any listed charges.</p>
            <p v-else role="status" class="supply-quote-status is-warning">{{ quotePricingMessage(selectedProcurementRecord) }}</p>
            <details class="supply-quote-options rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <summary class="cursor-pointer text-sm font-semibold text-slate-200">Optional quote details and extra charges</summary>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label class="form-field">Quote reference<input v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].quoteReference" maxlength="200" /></label>
                <label class="form-field">Quote date<input v-model="quoteDraftByRecord[selectedProcurementRecord.id].quoteDate" type="date" /></label>
                <label class="form-field">Budget category<input v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].category" /></label>
                <label class="form-field">Payment terms<input v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].paymentTerms" /></label>
                <label class="form-field">Warranty<input v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].warranty" /></label>
                <label class="form-field sm:col-span-2">Purchase terms<textarea v-model.trim="quoteDraftByRecord[selectedProcurementRecord.id].terms" rows="2" /></label>
              </div>
              <div class="mt-4 space-y-2"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm font-semibold text-slate-200">Charges or discounts <span class="font-normal text-slate-400">(only if shown on the quote)</span></p><button type="button" class="rounded border border-slate-600 px-3 py-2 text-sm text-white" @click="addQuoteAdjustment(selectedProcurementRecord)">Add amount</button></div>
                <div v-for="(adjustment, index) in quoteDraftByRecord[selectedProcurementRecord.id].adjustments" :key="adjustment.id" class="grid gap-2 rounded border border-slate-700 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto]">
                  <label class="form-field">Type<select v-model="adjustment.type"><option value="tax">Tax</option><option value="fee">Fee</option><option value="discount">Discount</option></select></label>
                  <label class="form-field">Description<input v-model.trim="adjustment.label" maxlength="120" :placeholder="adjustment.type === 'tax' ? 'VAT' : adjustment.type === 'discount' ? 'Discount' : 'Delivery or handling'" /></label>
                  <label class="form-field">Amount (PHP)<input v-model.number="adjustment.amount" type="number" min="0" step="0.01" /></label>
                  <button type="button" class="self-end rounded border border-slate-600 px-3 py-2 text-sm" aria-label="Remove charge or discount" @click="removeQuoteAdjustment(selectedProcurementRecord, index)">Remove</button>
                </div>
              </div>
              <dl class="mt-3 space-y-1 border-t border-slate-700 pt-3 text-sm"><div class="flex justify-between gap-3"><dt>Items subtotal</dt><dd>{{ currency(Math.round(quoteItemsSubtotal(selectedProcurementRecord) * 100)) }}</dd></div><div class="flex justify-between gap-3"><dt>Tax and fees</dt><dd>{{ currency(Math.round(quotePositiveAdjustments(selectedProcurementRecord) * 100)) }}</dd></div><div class="flex justify-between gap-3"><dt>Discounts</dt><dd>-{{ currency(Math.round(quoteDiscounts(selectedProcurementRecord) * 100)) }}</dd></div><div class="flex justify-between gap-3 border-t border-slate-700 pt-2 font-bold"><dt>Calculated total</dt><dd>{{ currency(Math.round(quoteTotal(selectedProcurementRecord) * 100)) }}</dd></div></dl>
            </details>
            <label class="supply-quote-evidence form-field"><span>Supplier quote document <b>*</b><small>PDF, PNG, or JPEG up to 5 MB. Kept as an internal clinic record.</small></span><input type="file" accept="application/pdf,image/png,image/jpeg" :disabled="busy" @change="uploadQuotation(selectedProcurementRecord, $event)" /><span v-if="evidenceByRecord[selectedProcurementRecord.id]?.length" class="supply-evidence-list"><button v-for="document in evidenceByRecord[selectedProcurementRecord.id]" :key="document.id" type="button" @click="downloadDocument(document)">{{ document.name }}</button></span></label>
            <label class="supply-quote-check rounded-lg border border-slate-700 bg-slate-900/60 p-3"><input type="checkbox" :checked="procurementQuoteVerified(selectedProcurementRecord.id)" :disabled="busy" @change="setProcurementQuoteVerified(selectedProcurementRecord.id, $event.target.checked)" /><span><strong>I checked the items, quantities, supplier availability, and prices against this quote.</strong><small>This one confirmation records the four procurement checks together.</small></span></label>
            <div v-if="financeReadinessItems(selectedProcurementRecord).length" role="status" class="supply-quote-status is-warning"><strong>Still needed</strong><ul class="mt-1 list-disc pl-5"><li v-for="item in financeReadinessItems(selectedProcurementRecord)" :key="item">{{ item }}</li></ul></div>
            <div v-else role="status" class="supply-quote-status is-ready">Ready for Finance to review and assign a budget.</div>
            <button class="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" :disabled="!readyForFinance(selectedProcurementRecord) || busy" @click="sendForApproval(selectedProcurementRecord)">{{ busy ? 'Sending to Finance…' : 'Create order and send to Finance' }}</button>
          </section>
          <p v-else class="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">This request has already been sent to the next workflow step and can no longer be edited here.</p>
        </div>
      </template>
    </Modal>
    <Modal :is-open="Boolean(selectedFinanceOrder)" panel-class="finance-dialog purchase-order-dialog" body-class="purchase-order-body" @close="closeFinanceOrderDetails">
      <template #header>
        <div class="purchase-order-heading">
          <p>Purchase order</p>
          <h2>{{ selectedFinanceOrder?.number || 'Order details' }}</h2>
          <span class="purchase-order-status" :class="financeOrderStatusTone">{{ selectedFinanceOrder?.status || 'Pending' }}</span>
        </div>
      </template>
      <template #body>
        <div v-if="selectedFinanceOrder" class="purchase-order-content">
          <section class="purchase-order-section">
            <h3>Order information</h3>
            <dl class="purchase-order-info">
              <div><dt>Supplier</dt><dd>{{ selectedFinanceOrder.supplierBusinessName || 'Not specified' }}</dd></div>
              <div><dt>Department</dt><dd>{{ selectedFinanceOrder.department || 'Inventory' }}</dd></div>
              <div><dt>Purpose</dt><dd>{{ selectedFinanceOrder.category || 'Not specified' }}</dd></div>
              <div><dt>Delivery date</dt><dd>{{ formatDateCreated(selectedFinanceOrder.deliveryDate) }}</dd></div>
              <div class="purchase-order-location"><dt>Delivery location</dt><dd>{{ selectedFinanceOrder.deliveryLocation || 'Not specified' }}</dd></div>
            </dl>
          </section>
          <section class="purchase-order-section">
            <div class="purchase-order-supplies-heading"><h3>Requested supplies</h3><span>{{ selectedFinanceOrder.lines?.length || 0 }} item{{ selectedFinanceOrder.lines?.length === 1 ? '' : 's' }}</span></div>
            <div class="purchase-order-table-wrap">
              <table><thead><tr><th scope="col">Supply</th><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
                <tbody><tr v-for="(line, index) in selectedFinanceOrder.lines || []" :key="line.itemId || index"><td>{{ line.name || 'Unnamed supply' }}</td><td>{{ line.quantity ?? '?' }}</td><td>{{ line.unit || 'units' }}</td><td class="purchase-order-money">{{ recordedMoney(line.unitPrice) }}</td><td class="purchase-order-money">{{ recordedMoney(orderLineTotal(line)) }}</td></tr><tr v-if="!selectedFinanceOrder.lines?.length"><td colspan="5" class="purchase-order-no-supplies">No supplies recorded for this order.</td></tr></tbody>
              </table>
            </div>
          </section>
          <section class="purchase-order-section purchase-order-pricing">
            <h3>Price breakdown</h3>
            <p class="purchase-order-pricing-note">Prices and charges recorded when this purchase order was prepared.</p>
            <dl>
              <div><dt>Items subtotal</dt><dd>{{ recordedMoney(selectedFinanceOrder.subtotal) }}</dd></div>
              <div v-for="adjustment in quoteAdjustmentRows(selectedFinanceOrder)" :key="adjustment.key" :class="adjustment.type === 'discount' ? 'purchase-order-discount' : ''"><dt>{{ adjustment.label }}</dt><dd>{{ adjustment.type === 'discount' ? '-' : '' }}{{ recordedMoney(adjustment.amount) }}</dd></div>
              <div v-if="selectedFinanceOrder.statedTotal != null"><dt>Supplier-stated total</dt><dd>{{ recordedMoney(selectedFinanceOrder.statedTotal) }}</dd></div>
            </dl>
            <p v-if="quoteTaxTreatmentLabel(selectedFinanceOrder)" class="purchase-order-pricing-note">{{ quoteTaxTreatmentLabel(selectedFinanceOrder) }}.</p>
          </section>
          <div class="purchase-order-total"><div><span>Purchase order total</span><p>Total amount for this order</p></div><strong>{{ currency(selectedFinanceOrder.total) }}</strong></div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import SupplyFlowGuide from '@/components/common/SupplyFlowGuide.vue'
import Modal from '@/components/common/Modal.vue'
import { auth } from '@/config/firebaseConfig'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'
import { quoteAdjustmentRows, quoteDraftIsValid, quoteDraftTotal, quoteTaxTreatment, quoteTaxTreatmentLabel as taxTreatmentLabel } from '@/utils/supplyQuotePricing'
import { toast } from 'vue3-toastify'
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()


const route = useRoute()
const router = useRouter()
const data = ref({ records: [], suppliers: [], branches: [] })
const busy = ref(false)
const error = ref('')
const supplierByRecord = ref({})
const quoteDraftByRecord = ref({})
const evidenceByRecord = ref({})
const procurementChecksByRecord = ref({})
const budgetByRecord = ref({})
const selectedDeliveryBranchId = ref('')
const selectedProcurementRecord = ref(null)
const selectedFinanceOrder = ref(null)
const financeOrderStatusTone = computed(() => {
  const status = String(selectedFinanceOrder.value?.status || '').toLowerCase()
  if (['rejected', 'cancelled', 'disputed'].includes(status)) return 'is-negative'
  if (['approved', 'paid', 'completed', 'delivered'].includes(status)) return 'is-positive'
  return 'is-pending'
})
const recordSearch = ref('')
const tablePage = ref(1)
const rowsPerPage = ref(10)
const mode = computed(() => route.path.startsWith('/inventory') ? 'inventory' : route.path.startsWith('/procurement') ? 'procurement' : 'finance')
const title = computed(() => mode.value === 'inventory' ? 'Request Supplies' : mode.value === 'procurement' ? 'Review Supply Requests' : 'Approve Purchase Orders')
const intro = computed(() => mode.value === 'inventory' ? 'Send one clear request. Procurement will add the supplier quote, and Finance will review the order.' : mode.value === 'procurement' ? 'Add the supplier and quoted prices, then send the order to Finance for approval.' : 'Check the order total, choose its budget, and approve or return it to Procurement.')
const branchId = computed(() => data.value.branchId || data.value.branches?.[0]?.id || '')
const activeBranch = computed(() => data.value.branches.find(branch => branch.id === selectedDeliveryBranchId.value) || {})
const requestBranchId = computed(() => String(activeBranch.value?.id || '').trim())
const branchAddress = computed(() => String(activeBranch.value.address || activeBranch.value.name || '').trim())
const suppliers = computed(() => data.value.suppliers.filter(supplier => supplier.status === 'Active' && supplier.associationStatus === 'Active'))
const budgets = computed(() => data.value.records.filter(record => record.kind === 'budget' && record.status === 'Active'))
const records = computed(() => data.value.records.filter(record => mode.value === 'inventory' ? record.kind === 'request' : mode.value === 'procurement' ? ['procurement', 'po'].includes(record.kind) : record.kind === 'po'))
const procurementRecords = computed(() => records.value.filter(record => record.kind === 'procurement').sort((first, second) => createdTimestamp(second.createdAt) - createdTimestamp(first.createdAt)))
const financePurchaseOrders = computed(() => [...records.value].sort((first, second) => createdTimestamp(second.createdAt) - createdTimestamp(first.createdAt)))
const createdTimestamp = value => {
  const milliseconds = value?.toMillis?.() || value?.toDate?.().getTime?.()
  if (Number.isFinite(Number(milliseconds))) return Number(milliseconds)
  // Firestore timestamps arrive as `seconds` in the SDK and `_seconds` after
  // the backend serializes them as JSON. Support both representations.
  const seconds = value?.seconds ?? value?._seconds
  if (Number.isFinite(Number(seconds))) return Number(seconds) * 1000
  return new Date(value || 0).getTime() || 0
}
const inventoryRecords = computed(() => [...records.value].sort((first, second) => createdTimestamp(second.createdAt) - createdTimestamp(first.createdAt)))
const tableRecords = computed(() => mode.value === 'inventory' ? inventoryRecords.value : mode.value === 'procurement' ? procurementRecords.value : financePurchaseOrders.value)
const recordSearchText = record => [
  record.number,
  record.status,
  record.department,
  record.priority,
  record.category,
  ...requestLines(record).flatMap(line => [line.name, line.unit, line.specifications]),
].filter(Boolean).join(' ').toLowerCase()
const filteredTableRecords = computed(() => {
  const query = recordSearch.value.toLowerCase()
  return query ? tableRecords.value.filter(record => recordSearchText(record).includes(query)) : tableRecords.value
})
const pagedTableRecords = computed(() => filteredTableRecords.value.slice((tablePage.value - 1) * rowsPerPage.value, tablePage.value * rowsPerPage.value))
watch([recordSearch, mode, filteredTableRecords], () => { tablePage.value = 1 })
const api = async (path, body) => {
  await auth.authStateReady?.()
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw Error('Sign in to continue.')
  let lastError
  for (const base of OTP_BACKEND_CANDIDATES) {
    let response
    try {
      response = await fetch(`${base}/supply${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (caught) {
      if (body !== undefined) throw caught
      lastError = caught
      continue
    }

    let json = {}
    try { json = await response.json() } catch { json = {} }
    if (!response.ok || json.success === false) {
      const failure = Error(json.error || (response.status >= 500 ? 'Supply service is temporarily unavailable.' : 'Request failed.'))
      if (body === undefined && response.status >= 500) {
        lastError = failure
        continue
      }
      throw failure
    }
    return json.data
  }
  throw lastError || Error('Supply service is unavailable. Please try again.')
}
const load = trackPageLoad(async () => {
  try {
    data.value = await api('/workspace')
    if (!selectedDeliveryBranchId.value || !data.value.branches.some(branch => branch.id === selectedDeliveryBranchId.value)) selectedDeliveryBranchId.value = data.value.branches.find(branch => branch.id === data.value.branchId)?.id || data.value.branches[0]?.id || ''
  } catch (caught) { error.value = caught.message }
})
const draft = ref({ name: '', category: '', quantity: 1, unit: 'units', requiredDate: new Date().toISOString().slice(0, 10), location: 'Clinic branch', reason: '', priority: 'Normal' })
const createRequest = async () => {
  if (!requestBranchId.value) {
    error.value = 'Your assigned clinic branch is unavailable. Refresh the page and try again.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const requestDraft = { ...draft.value, location: branchAddress.value }
    await api('/records', { kind: 'request', branchId: requestBranchId.value, department: 'Inventory', lines: [requestDraft], ...requestDraft })
    draft.value = { ...draft.value, name: '', category: '', quantity: 1, reason: '' }
    await load()
    toast.success('Inventory request sent to Procurement.')
  } catch (caught) {
    error.value = caught.message === 'Invalid record identifier.' ? 'Your assigned clinic branch could not be identified. Refresh the page and try again.' : caught.message
    toast.error(error.value)
  } finally { busy.value = false }
}
const relatedInventoryRequest = record => data.value.records.find(candidate => candidate.kind === 'request' && (candidate.id === record?.requestId || candidate.links?.includes(record?.id) || record?.links?.includes(candidate.id))) || null
const requestSource = record => relatedInventoryRequest(record) || record
const requestLines = record => requestSource(record)?.lines?.length ? requestSource(record).lines : record?.lines || []
const requestValue = (record, key) => requestSource(record)?.[key] || record?.[key] || '—'
const formatDateCreated = value => {
  const timestamp = createdTimestamp(value)
  return timestamp ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(timestamp)) : '—'
}
const hasRecordedMoney = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const recordedMoney = value => hasRecordedMoney(value) ? currency(value) : 'Not recorded'
const orderLineTotal = line => hasRecordedMoney(line.total) ? line.total : hasRecordedMoney(line.unitPrice) && hasRecordedMoney(line.quantity) ? Number(line.unitPrice) * Number(line.quantity) : null
const currency = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(cents || 0) / 100)
const budgetAvailable = budget => Math.max(0, Number(budget?.total || 0) - Number(budget?.committed || 0) - Number(budget?.spent || 0))
const eligibleBudgetsFor = record => budgets.value.filter(budget => String(budget.department || '') === String(record?.department || 'Inventory'))
const procurementCheckKeys = ['productsCorrect', 'quantitiesVerified', 'availabilityConfirmed', 'pricesVerified']
const procurementQuoteVerified = recordId => procurementCheckKeys.every(key => procurementChecksByRecord.value[recordId]?.[key])
const setProcurementQuoteVerified = (recordId, checked) => {
  procurementChecksByRecord.value[recordId] = Object.fromEntries(procurementCheckKeys.map(key => [key, Boolean(checked)]))
}
const openProcurementDetails = async record => {
  selectedProcurementRecord.value = record
  if (!procurementChecksByRecord.value[record.id]) procurementChecksByRecord.value[record.id] = { productsCorrect: false, quantitiesVerified: false, availabilityConfirmed: false, pricesVerified: false }
  if (!quoteDraftByRecord.value[record.id]) {
    const request = relatedInventoryRequest(record) || record
    quoteDraftByRecord.value[record.id] = {
      lines: (record.lines || []).map(line => ({ ...line, unitPrice: Number(line.unitPrice || 0) / 100 })),
      quoteReference: '', quoteDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()),
      category: record.lines?.[0]?.category || 'Clinic Supplies',
      deliveryDate: request.requiredDate || '', deliveryLocation: request.lines?.[0]?.location || request.location || '',
      paymentTerms: '', warranty: '', terms: '', taxTreatment: 'not-applicable', adjustments: [], statedTotal: '',
    }
  }
  try {
    const history = await api(`/records/${record.id}/history`)
    evidenceByRecord.value[record.id] = history.documents || []
  } catch (caught) { error.value = caught.message }
}
const closeProcurementDetails = () => { selectedProcurementRecord.value = null }
const openFinanceOrderDetails = record => { selectedFinanceOrder.value = record }
const closeFinanceOrderDetails = () => { selectedFinanceOrder.value = null }
const quoteTotal = record => {
  const quote = quoteDraftByRecord.value[record?.id]
  if (!quote) return 0
  return quoteDraftTotal(quote.lines, quote.adjustments)
}
const quoteItemsSubtotal = record => (quoteDraftByRecord.value[record?.id]?.lines || []).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
const quotePositiveAdjustments = record => (quoteDraftByRecord.value[record?.id]?.adjustments || []).filter(row => row.type !== 'discount').reduce((sum, row) => sum + Number(row.amount || 0), 0)
const quoteDiscounts = record => (quoteDraftByRecord.value[record?.id]?.adjustments || []).filter(row => row.type === 'discount').reduce((sum, row) => sum + Number(row.amount || 0), 0)
const quoteTotalMatches = record => {
  const quote = quoteDraftByRecord.value[record?.id]
  return Boolean(quote && quoteDraftIsValid(quote.lines, quote.adjustments, quote.taxTreatment, quote.statedTotal))
}
const quotePricingMessage = record => {
  const quote = quoteDraftByRecord.value[record?.id]
  if (!quote?.lines?.length || quote.lines.some(line => !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) <= 0)) return 'Enter a unit price for every requested item.'
  if (quote.adjustments.some(row => !Number.isFinite(Number(row.amount || 0)) || Number(row.amount || 0) < 0)) return 'Enter a valid amount for each charge or discount.'
  if (quote.adjustments.some(row => Number(row.amount || 0) > 0 && !String(row.label || '').trim())) return 'Add a description for each charge or discount with an amount.'
  if (quote.taxTreatment !== 'separate' && quote.adjustments.some(row => row.type === 'tax' && Number(row.amount || 0) > 0)) return 'Choose “Tax is listed as a separate amount” or remove the separate tax amount.'
  if (!Number(quote.statedTotal) || Number(quote.statedTotal) <= 0) return 'Enter the final total shown on the supplier’s quote.'
  const difference = Math.abs(Number(quote.statedTotal) - quoteTotal(record))
  if (Math.round(difference * 100) > 0) return `The totals differ by ${currency(Math.round(difference * 100))}. Check the item prices and quote charges.`
  return 'Check that the entered prices match the supplier’s quotation.'
}
const quoteTaxTreatmentLabel = record => taxTreatmentLabel(quoteTaxTreatment(record))
const addQuoteAdjustment = record => quoteDraftByRecord.value[record.id].adjustments.push({ id: `adjustment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'fee', label: '', amount: 0 })
const removeQuoteAdjustment = (record, index) => quoteDraftByRecord.value[record.id].adjustments.splice(index, 1)
const financeReadinessItems = record => {
  const quote = quoteDraftByRecord.value[record?.id]
  const checks = procurementChecksByRecord.value[record?.id]
  const items = []
  if (!supplierByRecord.value[record?.id]) items.push('Choose the clinic supplier.')
  if (!quote?.quoteDate || !String(quote.category || '').trim() || !quote.deliveryDate || !String(quote.deliveryLocation || '').trim()) items.push('Complete the quotation date, budget category, expected delivery date, and delivery location.')
  if (!quoteTotalMatches(record)) items.push('Complete the quote prices and make the calculated total match the supplier’s total.')
  if (!evidenceByRecord.value[record?.id]?.length) items.push('Attach the supplier quotation file.')
  if (!checks || procurementCheckKeys.some(key => !checks[key])) items.push('Confirm that the quote matches the requested items and quantities.')
  return items
}
const readyForFinance = record => {
  return financeReadinessItems(record).length === 0
}
const actionSuccessMessage = actionName => ({
  confirm: 'Purchase order prepared and sent to Finance for approval.',
  approve: 'Purchase order approved. Procurement can record when it is issued externally.',
  issue: 'Purchase order issue recorded. Inventory can receive the delivery after supplier confirmation.',
}[actionName] || 'Supply workflow updated.')
const action = async (record, actionName, extra = {}) => {
  busy.value = true
  error.value = ''
  try {
    await api(`/records/${record.id}/actions`, { action: actionName, ...extra })
    await load()
    toast.success(actionSuccessMessage(actionName))
  } catch (caught) {
    error.value = caught.message
    toast.error(error.value)
  } finally { busy.value = false }
}
const sendForApproval = async record => {
  const quote = quoteDraftByRecord.value[record.id]
  await action(record, 'confirm', {
    supplierId: supplierByRecord.value[record.id],
    lines: quote.lines.map(line => ({ itemId: line.itemId, quantity: line.quantity, unitPrice: Number(line.unitPrice) })),
    quoteReference: quote.quoteReference, quoteDate: quote.quoteDate, category: quote.category,
    deliveryDate: quote.deliveryDate, deliveryLocation: quote.deliveryLocation, paymentTerms: quote.paymentTerms,
    warranty: quote.warranty, terms: quote.terms, taxTreatment: quote.taxTreatment,
    adjustments: quote.adjustments.map(({ type, label, amount }) => ({ type, label, amount: Number(amount || 0) })),
    statedTotal: Number(quote.statedTotal),
    ...procurementChecksByRecord.value[record.id],
  })
  if (!error.value) closeProcurementDetails()
}
const approve = record => action(record, 'approve', { budgetId: budgetByRecord.value[record.id], approvedAmount: Number(record.total ?? record.requestedAmount ?? 0) / 100, remarks: 'Approved' })
const goToProcurementOrders = () => router.push('/procurement/orders')
const uploadQuotation = async (record, event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
    error.value = 'Choose a PDF, PNG, or JPEG file up to 5 MB.'
    event.target.value = ''
    return
  }
  busy.value = true
  error.value = ''
  try {
    const encoded = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await api(`/records/${record.id}/documents`, { name: file.name, contentType: file.type, data: encoded })
    const history = await api(`/records/${record.id}/history`)
    evidenceByRecord.value[record.id] = history.documents || []
    toast.success('Quotation saved as an internal clinic document.')
  } catch (caught) {
    error.value = caught.message || 'Unable to upload quotation.'
    toast.error(error.value)
  } finally { busy.value = false; event.target.value = '' }
}
const downloadDocument = async document => {
  try { const result = await api(`/documents/${document.id}`); window.open(result.url, '_blank', 'noopener,noreferrer') }
  catch (caught) { error.value = caught.message; toast.error(error.value) }
}
onMounted(load)
</script>

<style scoped>
.supply-requests-page { background: var(--ac-bg); color: var(--ac-text); }
.supply-requests-page main { background: var(--ac-bg); }
.supply-requests-page header { border-color: var(--ac-border); }
.supply-requests-page header h1, .supply-requests-page h2, .supply-requests-page h3, .supply-requests-page h4 { color: var(--ac-text); }
.supply-requests-page p.text-slate-400, .supply-requests-page small.text-slate-400 { color: var(--ac-text-muted); }
.supply-requests-page section.rounded-2xl, .supply-requests-page .rounded-xl.border { border-color: var(--ac-border); background: var(--ac-surface); box-shadow: var(--ac-shadow-sm); }
.supply-requests-page section.rounded-2xl > div:first-child { border-color: var(--ac-border); }
.supply-requests-page .form-field, .supply-requests-page .form-field-label { display:flex; flex-direction:column; gap:.42rem; color:var(--ac-text-secondary); font-size:.875rem; font-weight:600; }
.supply-requests-page .form-field b { color:var(--ac-danger); }
.supply-requests-page .form-field small { color:var(--ac-text-muted); font-size:.75rem; font-weight:400; line-height:1.25rem; }
.supply-requests-page .delivery-location-panel { border:1px solid var(--ac-border); border-radius:.75rem; background:var(--ac-surface-soft); padding:1rem; }
.supply-requests-page input:not([type="checkbox"]), .supply-requests-page select, .supply-requests-page textarea { width:100%; border:1px solid var(--ac-border-strong); border-radius:.5rem; background:var(--ac-surface); padding:.7rem .8rem; color:var(--ac-text); font-weight:400; }
.supply-requests-page input::placeholder, .supply-requests-page textarea::placeholder { color:var(--ac-text-muted); }
.supply-requests-page input:focus, .supply-requests-page select:focus, .supply-requests-page textarea:focus { border-color:var(--ac-accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--ac-accent) 18%, transparent); outline:none; }
.supply-requests-page textarea { min-height:6.5rem; resize:vertical; }
.supply-requests-page select:disabled { cursor:not-allowed; opacity:.55; }
.supply-requests-page [class*="bg-slate-"] { background-color:var(--ac-surface-soft); }
.supply-requests-page [class*="border-slate-"] { border-color:var(--ac-border); }
.supply-requests-page [class~="text-white"], .supply-requests-page [class~="text-slate-100"], .supply-requests-page [class~="text-slate-200"], .supply-requests-page [class~="text-slate-300"] { color:var(--ac-text-secondary); }
.supply-requests-page [class~="text-slate-400"], .supply-requests-page [class~="text-slate-500"] { color:var(--ac-text-muted); }
.supply-requests-page [class~="text-amber-200"], .supply-requests-page [class~="text-amber-300"], .supply-requests-page [class~="text-amber-400"] { color:var(--ac-warning); }
.supply-requests-page button.bg-amber-500 { border-color:var(--ac-primary); background:var(--ac-primary); color:var(--ac-on-primary); }
.supply-requests-page button.bg-amber-500:hover:not(:disabled) { background:var(--ac-primary-hover); }
.supply-form-step { color:var(--ac-text-muted); font-size:.68rem; font-weight:800; letter-spacing:.14em; }
.supply-quote-status { border:1px solid var(--ac-border); border-radius:.7rem; padding:.7rem .85rem; color:var(--ac-text-secondary); font-size:.82rem; line-height:1.5; }
.supply-quote-status.is-ready { border-color:color-mix(in srgb, var(--ac-success) 42%, var(--ac-border)); background:var(--ac-success-bg); }
.supply-quote-status.is-warning { border-color:color-mix(in srgb, var(--ac-warning) 42%, var(--ac-border)); background:var(--ac-warning-bg); }
.supply-quote-options { border-color:var(--ac-border); background:var(--ac-surface-soft); }
.supply-quote-options summary { color:var(--ac-text-secondary); }
.supply-quote-evidence { border:1px solid var(--ac-border); border-radius:.7rem; background:var(--ac-surface-soft); padding:.8rem; }
.supply-quote-evidence > span:first-child small { display:block; margin-top:.2rem; }
.supply-evidence-list { display:flex; flex-wrap:wrap; gap:.5rem; }
.supply-evidence-list button { color:var(--ac-primary); text-decoration:underline; text-align:left; }
.supply-quote-check { display:flex; align-items:flex-start; gap:.65rem; border-color:var(--ac-border); background:var(--ac-surface-soft); }
.supply-quote-check input { width:1rem; height:1rem; flex:0 0 auto; margin-top:.2rem; padding:0; accent-color:var(--ac-primary); }
.supply-quote-check span { display:block; }
.supply-quote-check strong,.supply-quote-check small { display:block; }
.supply-quote-check strong { color:var(--ac-text-secondary); font-size:.82rem; line-height:1.45; }
.supply-quote-check small { margin-top:.2rem; color:var(--ac-text-muted); font-size:.72rem; }
.supply-requests-page table thead { background:var(--ac-surface-muted); color:var(--ac-text-secondary); }
.supply-requests-page table tbody tr:hover { background:var(--ac-surface-soft); }
.supply-requests-page button:focus-visible, .supply-requests-page a:focus-visible, .supply-requests-page input:focus-visible, .supply-requests-page select:focus-visible, .supply-requests-page textarea:focus-visible { outline:3px solid color-mix(in srgb, var(--ac-accent) 40%, transparent); outline-offset:2px; }
:global(.procurement-modal-panel) { border-color:var(--ac-border-strong) !important; background:var(--ac-surface) !important; color:var(--ac-text) !important; }
:global(.procurement-modal-body) { background:var(--ac-surface) !important; color:var(--ac-text); }
:global(.procurement-modal-body) dt { color:var(--ac-text-muted); font-size:.75rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
:global(.procurement-modal-body) dd { margin-top:.3rem; color:var(--ac-text); line-height:1.45; }
:global(.procurement-modal-body) [class*="bg-slate-"] { background-color:var(--ac-surface-soft); }
:global(.procurement-modal-body) [class*="border-slate-"] { border-color:var(--ac-border); }
:global(.procurement-modal-body) [class~="text-white"], :global(.procurement-modal-body) [class~="text-slate-100"], :global(.procurement-modal-body) [class~="text-slate-200"], :global(.procurement-modal-body) [class~="text-slate-300"] { color:var(--ac-text-secondary); }
:global(.procurement-modal-body) [class~="text-slate-400"], :global(.procurement-modal-body) [class~="text-slate-500"] { color:var(--ac-text-muted); }
:global(.procurement-modal-body) [class~="text-amber-200"], :global(.procurement-modal-body) [class~="text-amber-300"] { color:var(--ac-warning); }
:global(.procurement-modal-body) input, :global(.procurement-modal-body) select, :global(.procurement-modal-body) textarea { border-color:var(--ac-border-strong); background:var(--ac-surface); color:var(--ac-text); }
:global(.procurement-modal-body) input:focus, :global(.procurement-modal-body) select:focus, :global(.procurement-modal-body) textarea:focus { border-color:var(--ac-accent); }
</style>
