# Connected workflow fixes

## Implemented handoffs

- Supplier quotes: accepting a quote copies its accepted quantity, unit price and total to the purchase request, preserves the original requested quantity, requests Finance review and notifies branch Finance staff. Cross-clinic or mismatched quotes are rejected.
- Finance: only finance:payables:approve can approve purchase budgets; only finance:payables:settle can confirm supplier payment. Uploading a receipt submits evidence and does not mark an invoice paid. Finance confirms the full payment from Accounts Payable after receipt of goods.
- Procurement and Logistics: both receipt actions use the same Firestore transaction and receipt marker. Purchase status, inventory count and inventory movement are recorded together, once. Legacy Not Claimed statuses are recognized after approved budgets. Customer orders now load through branch-scoped listeners.
- Inventory and bookings: service consumption records an inventory movement. Product sales respect materials reserved for active bookings. Verified product payments create the order, sales transaction and stock deduction atomically. If stock changes while payment is in progress, the paid order is retained as Awaiting Stock, the clinic/customer are notified, and Logistics can resume preparation after replenishment. Cancellation returns previously deducted stock once and creates one refund ledger record after provider confirmation.
- Finance sales: each booking deposit/balance payment creates its own uniquely keyed transaction; retries do not duplicate sales. Product payments also create a Finance sales transaction.
- HR and Finance: HR submits a monthly summary with explicit payroll-entry IDs. Finance approves an immutable snapshot or returns it to HR with a reason. HR releases both payslip copies in one transaction using the approved entry, with duplicate release prevention. Employees can view My Payslips. Finance prints the selected month's released payslip. Payslip release is not a salary transfer.
- Notifications and permissions: workflow notifications target users in the correct branch. Role notification listeners include branch scope. Customers cannot write order payment/stock fields, and ordinary self-profile edits cannot change roles, permissions or branch assignments. Payroll summary approval and payslip writes are backend-owned.

## Validation

- 21 local tests pass across booking, listing approval and integration workflows.
- Integration tests exercise partial quotes, Finance authorization, receipt retries across both entry points, transaction rollback, sales/stock retry protection, shortage recovery, reservation protection, cancellation stock return, Finance-approved payslip snapshots and payroll notifications.
- Backend JavaScript syntax checks pass.
- Production frontend build passes.
- Firestore rules compile successfully using Firebase's non-deploying rules test API. No rules were published.

Tests use a transaction fixture that rejects reads after writes and commits only successful transactions. They are not a live multi-account or live PayMongo test.

## Deployment and existing records

Deploy frontend, OTP backend, Firestore rules and indexes together. New collections include orderCheckouts, inventoryMovements and purchasePayments. Retain the notification branch/recipientRole composite index.

Existing delivered purchases without a receipt marker are blocked from being received again; reconcile their inventory rather than blindly crediting stock. Existing accepted quotes and historical sales are not bulk rewritten. Finance can use Confirm Legacy Approval (or return the summary to HR) for older approved summaries without approved-entry snapshots. Old checkout sessions without a server-side order snapshot require reconciliation; new checkouts create this snapshot before redirecting to payment.

Payment finalization still uses the authenticated payment-return flow. No live payment, data migration or deployment was performed in this task.
