# Customer booking workflow

New customer bookings use workflow version 2. Deploy the frontend, OTP backend and firestore.rules together.

## Clinic setup

- Publish the clinic and services with a price, duration and contract terms.
- Assign workers to the branch and configure recurring or week-specific shifts. Approved leave blocks booking.
- Select required supplies and reusable equipment from branch inventory. Each selection reserves one unit per service. Materials are deducted when service starts; equipment is reserved only for overlapping appointments.
- Enable installments on a service and set the initial payment percentage when allowed. Otherwise full payment is required. For multiple services, all must allow installments; the highest configured deposit percentage applies.

## Stages

1. Customer selects a service and an available worker/time and submits the request.
2. Clinic reviews Pending Approval. Approval rechecks worker, shift and inventory availability.
3. Awaiting Payment: customer pays the required full amount or initial installment through checkout.
4. Contract Pending: customer reviews and signs the clinic agreement in My Appointments.
5. Paid: customer and assigned worker exchange and verify the six-digit service key.
6. Ready to Start: assigned worker starts the service from their appointments page.
7. Ongoing: worker performs the service and marks their work done.
8. Awaiting Customer Confirmation: customer confirms completion.
9. Balance Due: installment customer pays the remainder. Full-payment bookings skip this stage.
10. Completed: both confirmations and full settlement are required. Customer sees the booking in Booking History.

Active bookings remain visible even when their scheduled date has passed. Worker appointment changes update live. Booking milestone notifications are sent to the other participant; approval and payment notifications go to the customer.

## Verification

Run: node --test backend/otp-backend/bookingWorkflow.test.js

Tests cover both payment paths, milestone authorization and order, stock deduction, resource availability, clinic-authoritative prices, weekly shifts, invalid/past dates, failed payments and duplicate callback protection. Database and payment-provider responses are mocked. A production frontend build is also required.

Before release, exercise the flow with clinic, customer and practitioner accounts against deployed Firestore rules and PayMongo test mode. Live payment processing and production deployment are not verified by the unit tests. Existing bookings are not bulk migrated; old reservation-first checkout links must be reviewed by the clinic.
