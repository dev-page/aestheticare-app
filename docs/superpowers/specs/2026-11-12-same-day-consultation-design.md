# Same-Day Consultation and Treatment Design

## Intent

Let customers and clinic staff request an on-site consultation followed by a linked treatment on the same date when the clinic enables it for that treatment. The practitioner decides whether treatment may proceed after the consultation.

## Goals

- Configure same-day eligibility on each service, disabled by default.
- Allow only an on-site linked consultation followed by the treatment at the same branch and with the same practitioner in this release.
- Reserve the treatment time provisionally, with the service's configured buffer after the consultation.
- Collect consultation payment through the existing appointment flow. Do not allow treatment consent or payment until the practitioner clears it.
- Let customers request this online and let clinic staff create the same linked pair for a walk-in.
- Let only the assigned practitioner record the clinical decision; no decision releases the provisional treatment slot.
- Keep group bookings and online consultations on the existing paths.

## Non-goals

- Automatically determine clinical suitability or classify procedures as low or high risk.
- Permit same-day treatment after an online consultation.
- Change the existing rules for unrelated appointments on the same date.

## Approaches

- A global clinic toggle would be simple but would enable services with different requirements together.
- Treating consultation and treatment as one long appointment would obscure separate consent, payment, clinical records, and appointment statuses.
- **Chosen:** store eligibility on the treatment service and create two linked appointment records transactionally. This follows existing appointment records while keeping the treatment provisional until practitioner clearance.

## Behavior

For online customers, the service form offers an explicit same-day request only when its linked consultation supports on-site booking. One selected slot represents the consultation start; the UI shows the calculated treatment start and buffer. For walk-ins, staff select the treatment and opt into the same-day consultation; the desk shows the consultation fee due first and treatment fee due only if cleared.

The backend re-reads the service and consultation listings, checks branch, mode, practitioner, availability, time order, clinic schedule, resources, and existing customer bookings. It creates a consultation appointment and a provisional treatment appointment as one transaction. Approval/rejection of the booking applies to both. A practitioner may clear the linked treatment after completing the on-site consultation. Clearance enables the normal treatment contract and payment flow; refusal cancels the provisional treatment without charging its fee.

Group bookings remain unsupported for consultation-required services. Existing prior-consultation clearance continues to allow normal service booking on a later date.

## Constraints and calls

- The existing `requiresConsultationFirst` and `linkedConsultationId` fields remain authoritative for prerequisites.
- Add `sameDayConsultationAllowed` and `sameDayConsultationBufferMinutes` to a service listing. Default to false and 15 minutes; validate the buffer to 0–60 minutes.
- The backend, not a customer checkbox, determines eligibility and computes the linked schedule.
- Existing clinic approval, contract, payment, appointment permissions, and inventory validation remain in force.
