# Inventory and Procurement workflow validation

## Entry points

- Inventory: `/inventory/dashboard`
- Inventory receiving and inspection: `/inventory/receiving`
- Procurement: `/procurement/dashboard`
- Procurement supplier directory: `/procurement/suppliers/directory`
- Existing Finance handoff: `/finance/procurement/dashboard`
- Management overview: `/management/supply/dashboard`

The clinic maintains supplier contacts, products, and local regulatory-check data in the supplier directory. Supplier users do not have accounts or portal access. Legacy `/logistics/*`, `/manager/logistics`, and `/supply-management/logistics/*` links redirect to Inventory receiving.

## New clinic-entered workflow

1. Inventory creates a request describing an item, category, unit, quantity, and specifications. The request does not select a supplier or estimate a price.
2. Procurement selects an active clinic-associated supplier, obtains a quotation outside AesthetiCare, attaches the quotation as internal evidence, and enters prices and commercial terms. It records whether tax is included, separate, or not applicable; enters supplier-quoted tax, named fees, and discounts; and confirms that the supplier-stated grand total matches the calculated total.
3. Procurement prepares a purchase order for Finance review. Finance approves it against an available budget; existing invoice, matching, and external payment-recording workflows remain in Finance.
4. Procurement uploads and sends the approved purchase order outside AesthetiCare, then records the supplier's external confirmation and expected delivery date.
5. Inventory records deliveries, inspection condition, accepted/rejected quantities, lot and expiry information, and discrepancies. Only accepted quantities are onboarded into stock.
6. Inventory resolves discrepancies. Repeated onboarding is idempotent, partial receipts leave outstanding quantities open, and rejected goods do not enter usable stock.

Historical supplier-account and Online-mode records remain readable for audit. Historical Online-mode supply records are read-only and are not migrated or rewritten. Historical supplier-owned files remain readable according to Storage rules, while new supplier-owned uploads are disabled.

## Implementation review points

- Supplier-role accounts are blocked at sign-in and rejected by supply APIs; clinic supplier records remain available to authorized Inventory and Procurement staff.
- Inventory uses `inventory:create` for receiving, inspection, discrepancy resolution, and accepted-stock onboarding. Procurement-only permission does not post inventory.
- Customer-order fulfillment continues to use its existing order permissions and routes.
- Approved PO documents, quotations, invoices, and payment evidence are internal clinic uploads. Supplier messages are captured as external communication records, not sent from the platform.
- Finance remains responsible for budgets, invoice verification, three-way matching, payment review, and payment recording.

## Local implementation verification

The implementation plan calls for static authorization and route review, `git diff --check`, and the frontend production build. It does not call for running tests. A deployment still requires staging review of Firebase custom roles, branch assignments, Storage downloads, rules/functions/indexes, scheduled monitors, and production acceptance.
