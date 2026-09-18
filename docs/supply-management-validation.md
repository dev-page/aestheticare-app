# Supply management implementation and validation

## Entry points

- Inventory: `/supply-management/inventory/dashboard`
- Procurement: `/supply-management/procurement/dashboard`
- Logistics: `/supply-management/logistics/dashboard`
- Finance: `/supply-management/finance/dashboard`
- Supplier: `/supplier/supply/dashboard`

The sidebar uses these canonical workspaces. Older URLs redirect to the corresponding integrated page and no parallel procurement UI remains. Existing inventory items and supplier catalogs are shared; historical purchase records remain read-only and are not silently converted into funded purchase orders.

## Implemented workflow

Create an inventory request, submit it, and have another inventory reviewer approve it. The resulting procurement request inherits the items and quantities. Procurement chooses manual or online sourcing, prepares and sends an RFQ, compares supplier quotations, and records a selection justification. Finance uses a separate account to approve and reserve a matching department/category budget. Procurement then issues the generated PO.

Manual RFQs, quotations and POs require uploaded evidence. Online suppliers see only their addressed RFQs and their own quotations, orders, invoices and payments. Offline suppliers can be added without creating a login. Portal invitations and supplier profile management use the existing supplier management page.

After confirmation, Logistics records delivered, accepted and rejected quantities, condition, batch, expiration and equipment metadata. Onboarding posts only accepted stock, with an immutable linked movement. Repeated onboarding is idempotent. Partial receipts retain the outstanding quantities. Rejected goods create a discrepancy requiring a recorded resolution.

Invoices are matched against PO prices, accepted quantities, previous invoices and charge allowances. Disputes display reasons and allow supplier/manual corrections before a fresh match. Another Finance user approves the invoice. Recorded payments require an external reference and supporting evidence; no money is transferred. Completion releases unused commitments and preserves actual spending separately.

## Local checks

`npm.cmd test` includes static configuration checks, backend syntax, and the complete local backend test set. The supply workflow adapter exercises the actual HTTP handlers with a transactional in-memory store, not a production Firebase project.

Coverage includes both sourcing modes through payment, partial/rejected receipts, duplicate allocation/onboarding/payment attempts, invoice overbilling, invoice corrections, self approval, cross-branch writes, read-only upload restrictions, and supplier isolation. `npm.cmd run build` compiles the frontend routes and templates.

## Release verification boundary

The local suite verifies Manual and Online procurement from Inventory Request through payment, including explicit approval, allocation, supplier-confirmation, inspection, three-way-match, and payment records; complete controlled state transitions; partial/rejected receipts; supplier isolation; self-approval rejection; duplicate-action protection; budget release; document authorization; and linked inventory movements.

Release still requires the staging checklist: exercise concurrent users against Firebase, validate real custom-role assignments and signed Storage downloads, deploy rules/functions/indexes, confirm scheduled monitors run, rotate the development service-account credential, and obtain organizational acceptance. Local tests cannot certify infrastructure that has not been deployed.

The workspace uses client-side filtering and pagination over the branch-authorized working set so reports and relationship tracing operate on one consistent snapshot. Very large production branches should introduce cursor-backed list endpoints without changing the canonical workflow.

Firestore is a document database, so relationships are application-enforced IDs rather than SQL constraints. The authenticated API validates referenced records in the same branch and executes financial, receiving, and workflow mutations transactionally.

Keep new supply records and private supply-document storage inaccessible to direct client writes. The authenticated backend performs permissions, branch isolation, supplier projection, validation, and audit logging.
