# Appointment Operations Design

## Goals

- Remove the Walk-In Desk header links shown in the supplied screenshot.
- Make Client List details easy to open, read, and scroll on desktop and mobile.
- Replace the squeezed appointment-recipient table in Appointment Details with responsive recipient cards.
- Keep standard customer bookings automatic after the backend confirms an available slot and eligible practitioner.
- Use the clinic review queue for customer cancellation and reschedule requests, and let authorized clinic staff directly move an appointment when the clinic needs to reschedule it.

## Proposed behavior

### Walk-In Desk

Remove the “Unpaid walk-in payments” and “View appointments” header links from the booking page. Keep the payment workflow available at its dedicated POS route and keep the POS page’s “New walk-in booking” route back to booking.

### Client List

Move the client profile dialog to the shared body-level modal behavior. Constrain it to the viewport, make its body scroll, and stack client details and appointment history on narrow screens. Preserve the existing edit permission and branch-scoped data rules.

### Appointment Details

Render each service recipient as a responsive card with distinct sections for contact, service, practitioner and treatment team, schedule, status, sessions, and actions. Keep contract, check-in, and online consultation controls available without placing them inside a crowded table cell.

### Booking and change requests

Standard customer bookings remain automatically approved only after the existing backend availability, practitioner eligibility, leave, and conflict checks pass. Remove “New Booking Requests” from the clinic’s change-request queue. Keep customer cancellation and reschedule requests in that queue, including the existing refund and approval rules.

Add a clinic-side “Reschedule” action for eligible future appointments. An authorized staff member selects a date and available practitioner/time. The backend rechecks branch scope, practitioner eligibility, approved leave, and slot conflicts transactionally before moving the appointment. It records an audit entry and a clinic-reschedule reason, preserves the existing payment and signed agreement, refreshes a service code when required, and notifies the customer in-app and by email. Clinic-initiated emergency reschedules do not consume the customer’s reschedule allowance. Appointments already started or checked in cannot be moved through this action.

## Access and safety

- Clinic rescheduling requires appointment update/review permission and access to the appointment’s branch; owners retain their current authorized access.
- Existing cancellation handling and refund safeguards stay unchanged.
- Legacy appointments already marked as pending approval remain visible in the full appointment records; the normal new-booking review queue no longer presents them as customer booking requests.

## Review question

Please approve this scope before implementation, or reply with changes—especially if emergency reschedules should wait for customer acceptance instead of taking effect immediately.
