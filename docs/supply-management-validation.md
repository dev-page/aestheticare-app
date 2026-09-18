# Supply management implementation and validation

## Entry points

- Inventory: `/supply-management/inventory/dashboard`
- Procurement: `/supply-management/procurement/dashboard`
- Logistics: `/supply-management/logistics/dashboard`
- Finance: `/supply-management/finance/dashboard`
- Supplier: `/supplier/supply/dashboard`

The new sidebar links use these workspaces. Existing purchase records remain accessible through the explicitly labelled legacy pages. Existing inventory items and supplier catalogs are shared; old purchase requests are not silently converted into funded purchase orders.

## Implemented workflow

Create an inventory request, submit it, and have another inventory reviewer approve it. The resulting procurement request inherits the items and quantities. Procurement chooses manual or online sourcing, prepares and sends an RFQ, compares supplier quotations, and records a selection justification. Finance uses a separate account to approve and reserve a matching department/category budget. Procurement then issues the generated PO.

Manual RFQs, quotations and POs require uploaded evidence. Online suppliers see only their addressed RFQs and their own quotations, orders, invoices and payments. Offline suppliers can be added without creating a login. Portal invitations and supplier profile management use the existing supplier management page.

After confirmation, Logistics records delivered, accepted and rejected quantities, condition, batch, expiration and equipment metadata. Onboarding posts only accepted stock, with an immutable linked movement. Repeated onboarding is idempotent. Partial receipts retain the outstanding quantities. Rejected goods create a discrepancy requiring a recorded resolution.

Invoices are matched against PO prices, accepted quantities, previous invoices and charge allowances. Disputes display reasons and allow supplier/manual corrections before a fresh match. Another Finance user approves the invoice. Recorded payments require an external reference and supporting evidence; no money is transferred. Completion releases unused commitments and preserves actual spending separately.

## Local checks

`npm.cmd test` includes static configuration checks, backend syntax, and five isolated workflow tests. The workflow adapter exercises the actual HTTP handlers with a transactional in-memory store, not a production Firebase project.

Coverage includes both sourcing modes through payment, partial/rejected receipts, duplicate allocation/onboarding/payment attempts, invoice overbilling, invoice corrections, self approval, cross-branch writes, read-only upload restrictions, and supplier isolation. `npm.cmd run build` compiles the frontend routes and templates.

## Remaining production and specification work

These checks do not establish production readiness or completion of every item in the master specification:

- Run the same workflows against Firebase emulators/staging with simultaneous approvals and receipts, real staff roles, supplier accounts, and signed Storage downloads. No live records were changed during local tests.
- Workspaces currently load authorized branch records for client-side pagination and reporting. Large datasets require bounded server-side pagination, indexed reporting queries and narrower transaction reads.
- DSS recalculates on workspace refresh. Daily reminders are deduplicated per recipient and capped at 100 alerts per refresh. An unattended scheduler and historical stock snapshots are still needed for continuous background monitoring and low-stock trend charts.
- Dashboard charts and CSV reports cover the implemented records; the full catalog of specialized management reports and financial spending charts in the master specification is not yet complete.
- Receipts preserve batch and equipment metadata, but available stock is still an item-level balance. Full batch allocation, serial-level tracking, and historical expiration depletion need a dedicated lot ledger.
- Workflow statuses implement the core lifecycle, but configurable approval policies, every intermediate draft/revision state, and supplier re-sourcing after an expired award need further work.
- The Firestore data model uses application-enforced references and server transactions, not relational database foreign-key constraints. The architecture document describes the intended model and deployment responsibilities.

Keep new supply records and private supply-document storage inaccessible to direct client writes. The authenticated backend performs permissions, branch isolation, supplier projection, validation, and audit logging.
