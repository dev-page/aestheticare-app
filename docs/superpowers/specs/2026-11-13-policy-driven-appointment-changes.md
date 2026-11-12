# Policy-Driven Appointment Changes

## Goal

Make cancellation and rescheduling choices, policy explanations, and server decisions agree for account customers and invited group attendees.

## Decisions

- Clinic policy values are enforced by the API; customer Firestore writes cannot submit appointment change requests directly.
- Rescheduling requires the clinic's rescheduling toggle and an unused allowance. A request is not a reservation; the clinic rechecks availability when approving it.
- Cancellation refund percentage is selected from the clinic's configured early, middle, or late time band and applied to paid amount after platform commission. The selected terms and estimate are captured when the request is made.
- Cancellation bands must be contiguous: the early minimum equals the middle maximum, and the middle minimum equals the late maximum.
- Account customers and group invitees receive the same policy and allowance behavior.

## User-facing behavior

- Policy management explains and validates contiguous cancellation windows.
- Published branch policy data contains the active limits needed for customer-side eligibility and refund estimates.
- Reschedule actions disappear when policy is disabled or the allowance is exhausted. Cancellation dialogs show the refund estimate and its basis.
- Group invitees see only policy-enabled choices and receive an API error if a policy or schedule changes before submission.

## Verification

- Unit tests cover cancellation time-band selection, refund calculations, and reschedule allowance boundaries.
- Targeted syntax/build checks verify the backend, Firestore rules, and affected Vue components.
