# Appointment VAT and Payment Breakdown Design

## Intent

Show a clear, consistent price breakdown for new online and walk-in service appointments. When the clinic is VAT registered and marks a service, consultation, or package as VAT-applicable, the system uses the fixed 12% rate. Clinics can mark the listing price as VAT-inclusive or VAT-exclusive. Customers pay the saved appointment total; the 12% is not added unless the selected listing is configured as applicable.

The existing platform appointment commission is 10%. It remains an internal deduction from clinic proceeds, not an extra customer charge. For VAT-applicable appointments, calculate that commission on the service subtotal before VAT so the clinic's VAT liability is not included in the commission base.

## Current behavior

- `prepareBooking` in `backend/otp-backend/bookingResources.js` calculates an appointment amount from the published listing price and writes `amount`, `totalAmount`, and platform commission fields.
- Customer checkout and the receptionist POS charge the saved `totalAmount`; they do not currently show a VAT breakdown.
- Walk-in bookings use `prepareBooking`, so a server-side pricing snapshot there covers customer and receptionist-created appointment records.
- Appointment product listings are managed in `ProductServiceListing.vue` with shared fields in `ServiceListingFields.vue`. Clinic-wide policies are saved under the clinic owner in `clinicPolicies/{ownerId}` through `OwnerPolicyManagement.vue`.
- Listing VAT applicability and pricing mode affect the customer's payable amount, so Finance must review those terms when a listing's tax treatment changes.
- Existing listings and appointments have no VAT metadata. Missing VAT configuration must continue to mean no VAT, and old appointments must retain their saved amount.

## Goals

- Calculate all appointment VAT on the server in integer cents and save a pricing snapshot when a booking is created.
- Use one snapshot for booking confirmation, online customer payment, walk-in POS payment, transaction records, and receipts.
- Make the clinic's VAT registration and each listing's VAT applicability and price mode visible in the clinic UI.
- Show a readable subtotal, VAT (or “No VAT”), total, amount already paid, and remaining balance where relevant.
- Keep the 12% rate fixed in application logic; do not let users enter an arbitrary tax rate.
- Preserve backward compatibility for existing appointments and listings.

## Non-goals

- Applying VAT to pharmacy product sales, procurement purchases, subscriptions, or platform fees.
- Repricing historical appointments or changing their refunds.
- Adding tax filing, remittance, or credit-note workflows.
- Giving the clinic tax advice or deciding which of its services legally qualify; the clinic remains responsible for its VAT status and listing classifications.

## Approaches considered

1. **Client-side VAT calculation.** The browser adds VAT to displayed prices. This is small, but client calculations can be altered and can diverge from the amount the server charges. Rejected.
2. **Server-authoritative pricing snapshot with clinic/listing configuration.** The server calculates tax once at booking creation and stores the breakdown. The clinic-level VAT-registration setting gates per-listing applicability; each listing defines whether VAT applies and whether its displayed price includes VAT. Customer and reception UIs display the saved breakdown. Selected because it matches the requested fixed 12% rule and provides one source of truth.
3. **Choose tax treatment at the payment counter.** Reception or the customer decides VAT at checkout. Rejected because it produces different totals for the same appointment and cannot provide a stable quote at booking time.

## Chosen behavior

### Configuration

- Add `vatRegistered: boolean` to the existing owner-level `clinicPolicies/{ownerId}` document. Branches inherit the owner's setting; branch overrides are out of scope.
- In service, consultation, and package listing forms, add `vatApplicable: boolean` and `vatPriceMode: 'inclusive' | 'exclusive'`.
- Changes to VAT applicability or price mode are financial-term changes and require the existing Finance review before publication.
- Default legacy/missing values to `vatRegistered: false` and `vatApplicable: false`. The listing switch is unavailable until the clinic-level setting is enabled. Saving a listing marked VAT-applicable while the clinic setting is off is rejected by server validation.
- A package is taxed once using its own listing classification and package price. Its included service listings are not taxed again. A same-day consultation and treatment are separate appointments and use their individual listing settings.

### Calculation and persisted shape

Use integer centavo arithmetic and a fixed rate of 1,200 basis points:

- VAT-exclusive listing: `subtotal = listed price`; `vat = round(subtotal × 12%)`; `total = subtotal + vat`.
- VAT-inclusive listing: `total = listed price`; `subtotal = total − round(total × 12 / 112)`; VAT is the difference between total and subtotal.
- Non-applicable or legacy listing: VAT is zero and total equals the listed price.

Save a versioned `pricingSnapshot` on each new appointment with `currency: 'PHP'`, `listedPrice`, `subtotal`, `vatApplicable`, `vatRateBasisPoints`, `vatPriceMode`, `vatAmount`, `total`, and `version`. Keep `amount` and `totalAmount` equal to `pricingSnapshot.total` for compatibility. Calculate the 10% platform commission on `subtotal`; save clinic net as `subtotal - commission`, with VAT recorded separately. Do not expose commission or clinic net in the customer interface.

For booking-order/group parent records, aggregate the child appointment subtotal, VAT, total, commission, and clinic net from the saved child snapshots. Do not recalculate tax on the parent total.

### Payment and UI

- Customer booking estimate in `CenterPage.vue`: show service subtotal, VAT row when applicable, and total; explain VAT-inclusive pricing without adding a second 12%. Remove internal platform commission and clinic-net figures from customer-facing copy.
- Customer payment panel in `MyAppointments.vue`: show the persisted breakdown plus paid-to-date and remaining balance. The server continues to validate the payment against the appointment balance.
- Walk-in payment cards and printable receipt in `WalkInDesk.vue`: show the same persisted subtotal, VAT, and total; tender/change remains based on the saved total.
- Online and walk-in transaction records carry the appointment's pricing snapshot so finance and receipts can reconcile the exact amount charged.
- Old appointments without a snapshot show their stored total and a neutral “Tax breakdown unavailable for this booking” note only where a breakdown is requested; never infer or add VAT retroactively.

## Likely implementation files

- Create `shared/appointmentPricing.js` for the pure cents-based calculation shared by browser and server.
- Modify `backend/otp-backend/bookingResources.js` to load owner tax settings, validate listing classification, calculate the snapshot, and set compatible totals and commission fields.
- Modify `backend/otp-backend/listingApproval.js` and `frontend/src/views/admin/owner/finance/ListingApprovals.vue` so Finance reviews VAT treatment alongside price.
- Modify `backend/otp-backend/server.js` and `backend/otp-backend/walkInWorkflow.js` only where payment transaction records need to copy snapshot fields.
- Modify `backend/otp-backend/walkInBookings.js` only if parent/order summaries need aggregate snapshot values.
- Modify `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`, `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`, and `frontend/src/components/common/ServiceListingFields.vue` for configuration and listing controls.
- Modify `frontend/src/views/customer/CenterPage.vue`, `frontend/src/views/customer/MyAppointments.vue`, and `frontend/src/views/admin/owner/crm/WalkInDesk.vue` for visible breakdowns.

## Constraints and open builder decisions

- Keep the server authoritative; client estimates may use the shared helper but may not determine the payable amount.
- Preserve legacy amounts and existing booking/payment APIs.
- Keep cancellation/refund policy calculations unchanged in this change; retain the original snapshot on appointment and transaction records for audit. A later finance change may need tax-specific refund/credit-note handling.
- No new dependency is needed.
- The earlier package-price-preview mismatch in `ServiceListingFields.vue` is already corrected in the working tree and should remain intact while adding the VAT controls.

## Acceptance criteria

- A non-VAT clinic or a non-applicable listing produces zero VAT and leaves the price unchanged.
- A VAT-applicable exclusive price of ₱1,000.00 saves subtotal ₱1,000.00, VAT ₱120.00, total ₱1,120.00.
- A VAT-applicable inclusive price of ₱1,120.00 saves subtotal ₱1,000.00, VAT ₱120.00, total ₱1,120.00.
- A saved customer appointment and walk-in appointment show the same breakdown at payment and charge exactly the persisted total/balance.
- Group and multi-session course totals sum their constituent appointment snapshots without applying VAT twice.
- Legacy appointments continue to charge their original saved total and receive no retroactive tax.
