# Refund workflow design

## Intent

Give clinic staff and customers one predictable refund lifecycle for product orders and appointment cancellations. Cancellation state stays separate from refund state so an appointment can be cancelled while its money is still processing.

## Chosen approach

Use a shared server-side refund workflow with two settlement methods: return to the original PayMongo payment or record an offline refund after staff confirms the money was returned and enters its reference. PayMongo acceptance starts `Processing`; only a successful provider response or webhook marks `Refunded`. Active requests move through `Requested` and `Processing` to `Refunded` or `Rejected`; a cancellation with no refundable balance can be `Approved` with refund state `Not Applicable`.

The other option was to patch each existing order and appointment route independently. That would preserve duplicated status and accounting rules. A voucher-only workflow would not return money to online customers. The repository has voucher issuance records but no redemption path, so the selected implementation does not offer vouchers until customers can actually spend them. The shared workflow keeps validation and settlement consistent while retaining the existing product and appointment review screens.

## Rules

- The backend calculates and caps refundable value from recorded payment and the policy snapshot; clients cannot submit the authoritative amount or status.
- Online payment refunds use the original PayMongo payment by default and an idempotency key. Pending provider refunds remain processing until verified.
- Offline refunds require a staff confirmation and a receipt or transfer reference. Finance can recover an offline appointment refund if the payment was returned but recording initially failed.
- Voucher settlement is not exposed because the platform has no redemption workflow yet.
- Rejection requires a reason. Every settlement, rejection, and provider update is audited and reflected in finance records and customer notifications.
- Order and appointment cancellation statuses remain distinct from refund statuses.

## Scope and constraints

Update customer order request submission, order cancellation review, finance refund actions, appointment cancellation decisions, PayMongo refund webhook handling, and Firestore rules for server-owned refund mutations. Preserve existing payment collection, product fulfillment, appointment scheduling, and rescheduling behavior.

## Implementation notes

Use existing `refundRequests`, `customerOrders`, `appointments`, `transactions`, and `financeAudit` collections where possible. The server-owned `refundOperations` collection makes provider retries and webhook delivery idempotent. Customer refund/cancellation requests and finance decisions are server-owned; Firestore rules deny direct client mutation. Keep the current customer order proof upload and appointment cancellation review screens.
