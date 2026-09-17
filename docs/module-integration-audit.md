# Module integration audit

Scope: local source and local automated tests. No live data or deployment was changed. This is an audit, not a completed remediation.

## Connected in code

- HR worker schedules (recurring and weekly overrides) and approved leave feed booking availability.
- Approved/published listings gate customer browsing, booking and product checkout.
- Service start deducts configured material quantities in a transaction; equipment availability is checked for overlapping bookings.
- Supplier catalogs provide item/supplier IDs for purchase requests. Suppliers submit quotes against those requests and notify clinic recipients.
- HR generates payroll summaries; Finance reviews those shared summaries.
- Purchase budget review, logistics status and supplier settlement use purchaseRequests.

## Confirmed gaps

1. Finance approval separation: server.js procurement transitions use canAccessBranchRecord, which accepts procurement/inventory/logistics permissions, and allow Pending Finance -> Approved without a Finance-specific permission. purchaseRequests rules also allow broadly scoped staff updates, including financial/status fields. Finance approval is not consistently enforced.
2. Accepted quote quantities/prices: the quote acceptance handler copies supplierQuoteAmount and reference, but not the accepted quantity/unit price into the request quantity/unitCost/totalCost used for fulfillment and receipt. Partial quotes do not reliably propagate downstream.
3. Receiving stock: server.js has separate Procurement and Logistics stock-receipt implementations. SupplyPurchaseRequests.vue also directly adds inventory on delivery. These use multiple separate writes without a shared, one-time receipt marker/transaction. Status can be saved while stock update fails; concurrent or alternate receipt paths can double count stock.
4. Payment reporting: FinanceSales.vue reads transactions. The booking record-payment endpoint updates appointments/bookings and notifications but does not create a sales transaction. Customer Checkout.vue creates customerOrders without a corresponding transaction or inventory deduction. No corresponding trigger was found in backend/functions. These paths do not fully feed Finance sales and product inventory.
5. Logistics status mismatch: the page maps Not Claimed/Pending/blank to Ready for Claim when approved and budget-approved, but the backend only maps blank. Claim can fail for a displayed ready order until the separate send-to-logistics action sets Ready for Claim.
6. Notifications: logistics backend notifications target recipientRole Owner/Manager without branch/recipient user scoping. Current notification read rules allow matching roles. This can cross clinic boundaries.
7. Payment authority: purchase-request payment receipt UI marks a request Paid directly under procurement review permissions, whereas a separate Finance settlement endpoint exists. customerOrders rules also permit owners of customer records to create/update payment fields, so payment state is not consistently backend-authoritative.
8. Customer logistics: the active LogisticsOrders mount subscribes only to purchaseRequests. A customer-order loader exists but is not invoked there. That loader also requests the entire customerOrders collection before filtering by branch, which conflicts with scoped read rules for ordinary clinic users.
9. Payroll: shared summaries support HR-to-Finance review, but the payroll/payslip save function itself does not enforce approval; payroll and payslip writes are separate. This is not a unified atomic approval/disbursement workflow.

## Validation

Ran node --test backend/otp-backend/listingApproval.test.js backend/otp-backend/bookingWorkflow.test.js: all 11 passed. These tests cover booking/listing milestones and mocked payment/approval behavior, not the procurement, receiving, payroll or financial-ledger handoffs above. No live multi-account end-to-end verification was performed.

## Recommended repair order

Enforce Finance permissions and payment authority; propagate accepted quote quantities/prices; consolidate receipt handling into one atomic, idempotent endpoint; connect sales/payment records and product stock; align logistics states; scope notifications to clinic recipients; finish payroll release controls. Then test complete multi-role scenarios including retries, partial supply, rejection, and concurrent receipt updates.
