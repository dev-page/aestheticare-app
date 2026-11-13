# Treatment Course Management Design

## Goal

Make the difference between a single appointment and a multi-visit treatment course clear to clinic staff and customers, while keeping the existing appointment and payment workflow.

## User experience

- A Service is described as a single visit. A Service Package is described as a treatment course.
- Course setup uses ordered steps. Each step selects a published service or consultation, sets its visit count, and sets a minimum gap of 1–365 days before the next course visit. The course contains 2–50 visits total.
- The course price is the sum of each selected listing's price multiplied by its visit count, less the clinic's package discount.
- Booking copy tells customers that they are requesting the first visit; the clinic schedules later visits after each prior visit is completed or resolved.
- Customer and clinic session views group visits by treatment plan, show completed/total progress, and show the next visit's treatment, status, and earliest eligible date when available.

## Data and compatibility

- New packages store `treatmentCourseSteps: [{ serviceId, visitCount, minimumGapDays }]`, with the ordered selection persisted in the appointment's treatment-plan snapshot.
- Booking expands these steps into ordered individual session definitions. The interval after a visit is taken from its step and is always at least one day.
- Existing packages without `treatmentCourseSteps` continue using the existing repeated-component expansion.
- New and edited Service listings are single-visit listings. Editing an old multi-session Service converts future bookings to one visit; existing appointments keep their stored treatment-plan snapshots. Show a clear edit warning for this legacy conversion.
- Existing payment, approval, consent, consultation-prerequisite, and scheduling rules remain authoritative. Later visits continue to require the current full-course payment check.

## Validation

- A single-visit Service has exactly one visit.
- A new-format course has at least two and at most 50 visits in total.
- Each course step references a service or consultation, has 1–50 visits, and has a whole-number 1–365 day gap.
- At most one consultation may be included, and a course must include a consultation plus a service or at least two service visits.
- Course steps must reference published, Finance-approved listings from the same branch before publication or booking.

## Not in scope

- Continuous multi-day appointments, same-day treatment-course visits, per-session payment policy, or automatic appointment creation for future visits.
