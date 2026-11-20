# Inventory and Procurement Workflow Simplification

## Intent

Make supply requests, Procurement review, and delivery receiving easier to follow while preserving clinic approvals, invoice evidence, delivery inspection, and traceable inventory updates.

## Goals

- Explain the process in four plain-language stages.
- Keep routine invoice entry focused on supplier, invoice and delivery details, item prices, invoice total, invoice file, and the Procurement confirmation.
- Let Inventory record delivered and accepted quantities, attach the delivery receipt, and add accepted stock through one clear submit action.
- Keep the existing backend checks and inventory movement records as the source of truth.
- Make a partially completed receiving action recoverable without creating a duplicate delivery record.

## Non-goals

- Change who approves purchase orders or records supplier payments.
- Remove delivery evidence or inspection.
- Change service-to-supply links or treatment consumption in this step.
- Redesign all inventory pages or the underlying procurement data model.

## Approaches

- **Simplify the current screens and reuse their existing transitions (chosen).** This shortens the visible process and combines receiving into one guided action while retaining the existing API safeguards and records.
- Replace the procurement and inventory workflows with a new data model. This would touch approvals, invoices, permissions, and historical records; it adds risk without being needed for the UI simplification.
- Remove delivery receiving. This would allow stock to appear without a verified delivery and would break lot, receipt, and inventory movement traceability.

## Design

The guide groups the current handoffs into four stages: Inventory requests supplies; Procurement prepares the order; Finance approves it and Procurement issues it; Inventory records the delivery and accepted stock, then Finance records payment.

In the Procurement review modal, routine fields remain visible. Tax handling, extra charges or discounts, warranty, and terms stay available in a collapsed optional section. Existing invoice total reconciliation and invoice evidence requirements remain in place.

In Inventory receiving, the user enters delivered and accepted quantities. Rejected quantity is calculated from those values. Optional lot, expiry, serial, model, and warranty details are tucked into an item-specific disclosure. The user must attach the delivery receipt before submitting. The UI saves the inspection, uploads the receipt, then invokes the existing accepted-stock action. Stock is added only after all three steps succeed. If a later step fails, the saved receiving record is reopened for retry instead of creating another delivery.

## Constraints and implementation calls

- Keep the existing purchase order approval, supplier, invoice, inspection, receipt, lot, and audit rules.
- Use the current backend API rather than adding a new workflow endpoint.
- Preserve an explicit recovery path if the inspection saves but receipt upload or stock posting fails.
- Do not add or run tests for this change unless requested; inspect the diff and run a frontend production build if the project provides one.
