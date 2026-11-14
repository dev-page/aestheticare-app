# Refund workflow implementation plan

## Files and responsibilities

- `backend/otp-backend/refundWorkflow.js`: request validation, refund settlement, PayMongo idempotency, provider status reconciliation, and finance authorization.
- `backend/otp-backend/server.js`: wire the shared workflow into order cancellation and appointment cancellation/rejection routes.
- `backend/otp-backend/appointmentPaymentWebhook.js`: forward signed refund status events to the shared workflow.
- `backend/otp-backend/orderWorkflow.js`: keep fulfillment transitions blocked while cancellation review is pending and avoid prematurely recording a completed refund.
- `frontend/src/views/customer/MyOrders.vue`: submit cancellation/refund requests and show review, cancellation, and settlement progress.
- `frontend/src/views/admin/owner/finance/FinanceRefunds.vue`: review and settle order requests, retry PayMongo refunds, and record confirmed offline appointment refunds.
- `frontend/src/views/admin/owner/crm/AppointmentRequestApprovals.vue`: route appointment rejection through the backend and capture offline refund confirmation when needed.
- `firestore.rules`: make customer refund request creation and protected order refund mutations backend-only.

## Completed tasks

1. [x] Add a shared backend workflow for creating and reconciling refund operations; wire it to the signed PayMongo webhook.
2. [x] Move order refund/cancellation request writes behind authenticated backend validation and prevent fulfillment races while pending.
3. [x] Add finance settlement choices for original payment and confirmed offline payment with a reference; keep voucher issuance unavailable until redemption is supported.
4. [x] Align appointment cancellation approval/rejection with the shared refund statuses, process external refunds after the cancellation decision commits, and provide finance retry/recovery actions.
5. [x] Update customer and staff UI text, actions, and refund status displays to match the backend lifecycle.
6. [x] Lock direct Firestore mutations for the new request lifecycle and review the changed code paths.

## Review focus

Check duplicate submission, provider timeout/retry, duplicate/out-of-order webhook, partial refund bounds, unauthorized branch access, offline reference requirements, voucher consent, and cancellation/refund status separation.
