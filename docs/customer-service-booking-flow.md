# Customer Service Booking Flow

This flow follows the customer-facing service booking process in AesthetiCare, from the **BSV** connector through verified payment. BSV is shown as the connector label requested; it is not expanded into an acronym here.

```mermaid
flowchart TD
    BSV((BSV)) --> browse[/Browse a clinic and choose a published service/]
    browse --> details[/Review price, VAT, duration, terms, and consultation requirements/]
    details --> needsConsult{Is a consultation required first?}
    needsConsult -- No --> chooseSlot[/Choose a service, practitioner, date, and time/]
    needsConsult -- Yes --> hasClearance{Is there a completed consultation or approved prior-consultation clearance?}
    hasClearance -- Yes --> chooseSlot
    hasClearance -- No --> consultFirst[/Book and attend the required consultation; request verification if it was completed elsewhere/]
    consultFirst --> clearance{Is treatment cleared for booking?}
    clearance -- No --> consultFirst
    clearance -- Yes --> chooseSlot

    chooseSlot --> validSlot{Does the full duration fit clinic hours and practitioner availability, with no conflict?}
    validSlot -- No --> chooseSlot
    validSlot -- Yes --> hold[/System creates appointment and holds the slot for 15 minutes/]
    hold --> sign[/Open My Appointments and e-sign the service agreement/]
    sign --> pay[/Review the total and pay through checkout/]
    pay --> verified{Did the backend verify payment before the hold expired?}
    verified -- Yes --> confirmed[/Appointment confirmed; customer and clinic are notified/]
    verified -- No --> released[/Checkout expires; slot is released. Choose another time to book again/]

    details --> sameDay{Is a same-day consultation and treatment requested?}
    sameDay -- Yes --> sameDaySlot[/Choose the on-site consultation start; the full consultation-buffer-treatment block must fit both schedules/]
    sameDaySlot --> sameDayHold[/Consultation and provisional treatment times are held/]
    sameDayHold --> signConsult[/Sign and pay for the consultation within 15 minutes/]
    signConsult --> consultDone[/Attend consultation; practitioner records the clinical decision/]
    consultDone --> proceed{Is treatment cleared?}
    proceed -- No --> treatmentReleased[/Treatment slot released; no treatment payment is collected/]
    proceed -- Yes --> treatmentHold[/Treatment becomes payable; a fresh 15-minute hold starts/]
    treatmentHold --> signTreatment[/Sign the treatment agreement and pay/]
    signTreatment --> verified
```

## Notes

- The customer must be signed in to submit an online booking.
- Availability is the intersection of the clinic's opening hours and the practitioner's published schedule. The complete appointment duration must fit inside both, and the backend repeats the check when the booking is created.
- The system creates a 15-minute payment hold after validating the selected time. The customer signs and pays in **My Appointments**. Verified payment confirms the appointment and notifies the clinic; a checkout that expires before payment releases the slot.
- A service with a consultation prerequisite cannot be booked for treatment until the linked consultation is complete or the clinic approves verification of an earlier consultation.
- For same-day on-site consultation and treatment, only the consultation is initially payable. Treatment remains provisional until the practitioner clears it, then gets a fresh 15-minute signature-and-payment hold.
- Eligible group bookings use the same 15-minute rule. The organizer signs and pays once; each attendee completes their own treatment consent before check-in.
- Payment is not confirmation until the backend verifies the provider's payment record.
