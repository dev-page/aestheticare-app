# Appointment Management Navigation Design

## Intent

Simplify clinic navigation by bringing appointment records and booking-change approvals under one **Appointments** area. Keep the operational service queue and online consultation workspace separate because they support day-of-care actions.

## Current behavior

- The top-level navigation separates All Appointments, Customer Booking Requests, and Service Queue.
- Appointment records and request decisions are different data/workflows, but the first two tabs appear duplicative to staff.
- Request review covers new bookings, cancellation requests, and reschedules. Requests remain pending until staff decide them.
- Online consultations have a separate virtual waiting workflow and Google Meet hosting setup.

## Approved design

- Top-level tabs: **Appointments** and **Service Queue**.
- Appointments views: **All appointments** and **Needs review** with a pending request count.
- Needs review opens to pending requests; retain the existing status filter for the requests available in the review workflow.
- Keep request review actions behind the existing `appointments:review` permission. Keep appointment records behind the existing appointment view/update permission.
- Keep Service Queue with its existing Clinic Queue and Online Consultations views.
- Preserve old `tab=requests`, `tab=all`, and queue URLs so saved links continue to work.
- After Google Meet is connected, show a compact connection summary and make hosting-account controls/details expandable. Keep an attendance-permission warning visible while it needs action.

## Approaches considered

- Keep three top-level tabs: preserves current screen boundaries but retains the confusing split.
- Merge all requests into the appointment records table: presents one list but mixes distinct request and appointment states/actions.
- **Chosen:** one Appointments area with All appointments and Needs review views, backed by the existing components and data sources. This simplifies navigation while preserving each workflow and its permission checks.

## Constraints and non-goals

- Do not change Firestore request/appointment schemas, booking decision behavior, queue transitions, or permission names.
- Do not remove cancellation or reschedule review.
- Keep existing online consultation attendance and meeting controls functional.
