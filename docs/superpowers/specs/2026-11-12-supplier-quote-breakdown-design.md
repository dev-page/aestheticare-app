# Supplier Quote Breakdown Design

**Status:** Approved for implementation by the user's request to proceed with the recommendations
**Date:** 2026-11-12

## Goal

Let clinic Procurement record supplier quotations with different tax treatments and itemized fees, while Finance can review a traceable total and match invoices to the approved purchase order.

## Selected approach

Keep quote entry clinic-authored and manual. Procurement records item prices, selects whether tax is included, added separately, or not applicable, adds named tax/fee/discount rows using the amount shown by the supplier, and enters the supplier's stated total. The application adds the entered amounts but does not calculate tax rates or jurisdiction-specific tax rules. It requires the stated total to match the calculated total before submission.

Apply the same itemized price structure to the existing Procurement quote and Finance invoice forms. Carry it through funding approval, purchase orders, invoice matching, purchase order views, and exported purchase order documents. Keep existing aggregate `tax`, `delivery`, `otherCharges`, and `discount` values for compatibility with historical records and existing reports.

## Tax and charge rules

- Tax treatment values are `included`, `separate`, or `not-applicable`.
- Included tax is already part of line unit prices and cannot also be recorded as a tax adjustment.
- Separate tax is entered as a named amount from the supplier quote; the application does not infer a tax rate.
- Not-applicable tax cannot have a tax adjustment.
- Fee and discount rows have a label and a non-negative fixed amount in the clinic's currency.
- A quote or invoice cannot proceed when its supplier-stated total differs from the calculated amount.
- Invoice adjustments are checked against the approved PO allowance, including previously matched invoices.

## Compatibility

- Existing records without itemized adjustments continue to display through synthesized rows from their aggregate amounts.
- Existing API payloads that use aggregate amounts continue to be accepted where their workflow already allowed them.
- No supplier accounts, automatic supplier tax rules, or external tax integrations are added.

## Acceptance criteria

- The direct Procurement quote form and the Procurement workspace quote forms support explicit tax treatment, repeatable named adjustments, and a supplier-stated total.
- Backend totals use integer minor currency units and reject invalid adjustment types, tax-treatment conflicts, invalid amounts, and stated-total mismatches.
- Finance can see named adjustments and the tax treatment on purchase orders; purchase order exports include the same breakdown.
- Invoices can record the supplier's itemized amounts and cannot exceed the approved PO's named adjustment allowances.
- Historical purchase orders and invoices still display their prior aggregate price fields.
