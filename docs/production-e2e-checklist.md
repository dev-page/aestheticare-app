# Production E2E Checklist

Run this checklist against staging, not the production database. Use separate test accounts for each role and record the request ID for every failed API call.

## Release Preparation

- [ ] Rotate the Firebase service-account key that was exposed during development.
- [ ] Confirm Vercel environment variables are configured for the production environment.
- [ ] Confirm `CORS_ORIGINS` contains the deployed frontend origin and no wildcard is used.
- [ ] Confirm Firebase Authentication contains the deployed domain in Authorized domains.
- [ ] Deploy `firestore.rules` and `storage.rules`.
- [ ] Run `npm run verify:production`.
- [ ] Run `npm run build`.
- [ ] Synchronize the Finance role permissions before testing existing Finance accounts.

## Authentication and Registration

- [ ] Request a login OTP with a valid account and confirm the email arrives once.
- [ ] Reject an expired, reused, malformed, and wrong OTP.
- [ ] Confirm rate limiting and a useful error message after repeated OTP requests.
- [ ] Complete a clinic registration with all required fields and documents.
- [ ] Confirm document OCR starts after submission and stores a confidence result.
- [ ] Confirm missing documents produce a rejection reason and an email.
- [ ] Confirm approval creates/enables the account and appears in Approved Clinics.
- [ ] Confirm rejection removes the pending authentication/database record as designed.
- [ ] Refresh during registration and confirm saved draft metadata is restored without restoring passwords.

## RBAC and Data Isolation

- [ ] Test Owner, Finance, HR, Procurement, Logistics, and read-only custom roles.
- [ ] Confirm a user without a Finance permission cannot open that route directly.
- [ ] Confirm Finance view permissions cannot approve budgets or issue refunds.
- [ ] Confirm a Finance user can only read records for assigned branches.
- [ ] Confirm an employee cannot modify another employee's role, payroll, or attendance.
- [ ] Confirm every approval, rejection, refund, and role change creates an audit/activity entry.

## HR and Payroll

- [ ] HR creates shifts and records attendance for a test employee.
- [ ] Employee submits leave and overtime requests.
- [ ] Authorized HR reviews leave and overtime requests.
- [ ] HR generates a payroll period and confirms the summary is pending.
- [ ] Finance approves the summary and confirms payslips become available.
- [ ] Finance rejects the summary with a reason and HR can correct and resubmit it.
- [ ] Confirm approved payroll cannot be edited by HR.
- [ ] Confirm Financial Reports include approved payroll only.

## Integrated Inventory, Procurement, Finance, and Logistics

- [ ] Complete both Manual and Online lifecycles with separate Inventory, Procurement, Finance, Logistics, and Supplier accounts.
- [ ] Confirm an approved Inventory Request creates its Procurement Request without re-entry.
- [ ] Exercise RFQ Draft, Sent, Open, Quotation Received, Closed, Under Evaluation, and Awarded states.
- [ ] Confirm suppliers see only addressed RFQs, their own quotation, their own PO, explicitly shared documents, invoice status, and payment status.
- [ ] Confirm Manual procurement requires RFQ, quotation, and PO evidence.
- [ ] Finance reviews the linked chain and atomically creates Finance Approval and Budget Allocation records.
- [ ] Confirm duplicate budget approvals cannot reserve funds twice.
- [ ] Exercise PO approval, issue, rejection/clarification, supplier confirmation, and ongoing states.
- [ ] Record partial, accepted, rejected, damaged, expired, serialized, and batch-tracked deliveries.
- [ ] Confirm only accepted quantities enter inventory and retrying onboarding is idempotent.
- [ ] Resolve rejected-goods discrepancies and verify their photos/documents remain linked.
- [ ] Submit an invoice, run three-way matching, correct a disputed invoice, and approve it for payment.
- [ ] Prepare, review, approve with another Finance account, process, and record an external payment with evidence.
- [ ] Confirm payment does not call a fake gateway, actual spending remains separate, and unused commitment is released.
- [ ] Trace the completed transaction in both directions and export every departmental report.
- [ ] Test cancellation, deadlines, insufficient budget, expired quotation, cross-branch access, retries, and concurrent submissions.

## Sales, Refunds, and Payments

- [ ] Complete a PayMongo test payment and confirm the transaction is recorded once.
- [ ] Confirm Sales Ledger and Financial Reports reflect the transaction.
- [ ] Submit a customer refund request with proof.
- [ ] Finance can view only assigned-branch refund requests.
- [ ] A view-only Finance user cannot approve or reject a refund.
- [ ] An authorized Finance user can approve and issue one voucher only.
- [ ] An authorized Finance user can reject a request with a recorded decision.
- [ ] Confirm duplicate refund clicks do not create duplicate vouchers or transactions.
- [ ] Confirm payment webhook retries are idempotent.

## OCR, Email, and Consultation Integrations

- [ ] Upload a valid image and PDF document and confirm OCR completes in production.
- [ ] Upload an unreadable document and confirm it is marked for manual review.
- [ ] Confirm OCR matching checks document text against submitted registration fields.
- [ ] Confirm rejection, approval, password, and payment emails arrive with correct links.
- [ ] Create an online consultation and confirm Google Meet link creation.
- [ ] Test missing integration credentials and confirm the UI shows an actionable error.

## Responsive and Failure Testing

- [ ] Test system-admin pages at 320px, 375px, tablet, and desktop widths.
- [ ] Test tables with long names, long statuses, and empty states.
- [ ] Refresh during loading and submit buttons and confirm no duplicate action occurs.
- [ ] Disconnect the network during reads and writes and confirm errors are recoverable.
- [ ] Confirm lazy-loaded routes return JavaScript assets rather than the HTML fallback.
