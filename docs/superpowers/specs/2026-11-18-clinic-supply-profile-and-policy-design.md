# Clinic Supply, Profile, and Policy Updates

## Source of truth

The user's written request is the implementation requirement. The attached screenshots are visual examples of the current problems; they do not add workflow instructions beyond the written request.

## Goals

- Make the new-recipient form on Walk-In Desk readable in dark mode.
- Simplify Inventory & Stock filters, make Category a dropdown, and remove the Register item action.
- Replace the expandable, highlighted supply steps with a short, always-visible instruction sequence.
- Make supplier purchase requests follow this clinic workflow: Inventory requests supplies; Procurement records the supplier, prices, invoice details and invoice evidence, then submits the purchase order and invoice to Finance; Finance approves or rejects; Procurement sends the approved order to the supplier; Inventory records the delivery, adds accepted stock, and uploads the delivery receipt; Finance is notified and can settle the supplier invoice.
- Remove budgets from Finance navigation and active purchase approvals while retaining existing historical records.
- Keep clinic owners' clinic-wide permissions. Fix supplier access at the data query that causes the observed permission error; do not grant staff extra permissions.
- In Policy & Contract Management, remove the clinic tax status panel and the separate Walk-In Policy. The existing clinic service policies apply to both walk-in and online service appointments. Let the policy editor backdrop show the page underneath it.
- Add editable Monday–Sunday clinic hours to Clinic Profile using the existing `operatingHours` shape, including closed days and multiple time ranges.

## Design decisions

- Keep the current Vue, Firebase, and supply API architecture.
- Reuse the existing `operatingHours` representation (`{ day: { closed, ranges: [{ open, close }] } }`) so booking availability continues to use the same source of truth.
- Keep finance review on the purchase order, with invoice number/date and the invoice document visible from that record. Approval makes the invoice eligible for payment only after Inventory completes receipt. A rejected order remains available for Procurement to revise and resubmit.
- Existing legacy budget records are not deleted. New purchase approvals do not create or require budget records, and Finance no longer exposes budget pages or budget summaries.
- Scope supplier-directory reads to clinic supplier associations and the explicitly shared directory; do not query branch-tagged legacy supplier records that violate Firestore rules.

## Non-goals

- No supplier payments are initiated by the app; Finance records external settlement as the existing payment workflow does.
- No clinic registration changes.
- No broad permission change for clinic staff.
- No schema deletion or migration of historical supply records.

## Review focus

- Owner and staff authorization remains distinct, with all writes still branch-scoped.
- Finance cannot approve an order until the supplier invoice evidence is attached.
- Inventory cannot complete stock receipt without recording the existing line-level inspection.
- Closed days produce no appointment availability.
- Older policy and budget records remain readable without reintroducing removed UI.
