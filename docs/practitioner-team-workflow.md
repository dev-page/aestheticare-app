# Practitioner teams and staff earnings

## Clinic setup

1. Create employee accounts in Employee Management. Professional specialty is separate from system roles and does not grant permissions.
2. The clinic owner opens the employee's edit dialog, or Finance > Staff Compensation, to configure their practitioner profile. Review credentials, select approved services, and create effective-dated compensation agreements. Doctor and Registered Nurse staffing requirements need owner-verified credentials. Verification is a recorded clinic review, not an automatic PRC lookup.
3. Each agreement is a percentage or fixed PHP fee **per person, per completed session**, for lead or assistant work. Service-specific agreements override a general agreement. Use a zero rate for unpaid assistance. Overlapping agreements for the same service/responsibility are rejected. A shared assistant pool is not supported; give each assistant their own agreed rate.
4. Configure Base Pay separately: hourly (including hourly professional fees), daily, or fixed monthly retainer. Daily pay counts distinct completed attendance days. Monthly retainers pay the full agreed monthly amount without automatic proration; configure the monthly hour divisor used for the hourly equivalent. These models do not automatically determine employment classification or statutory eligibility.
5. In Create/Edit Listing, configure one lead specialty and the required assistants. Packages use each component service's requirements. Existing listings without requirements retain their booked lead.

## Appointment and queue

- Customers book the lead practitioner. For configured staffing requirements, customer slots and the server require the appropriate specialty, verified credentials where required, and approval for the service.
- Open **Treatment team** in appointment recipient details or the Service Queue to assign assistants. Every member must be active, assigned to the branch, approved for the service, within their shift/availability, not on approved leave, and free of overlapping appointments or active booking holds.
- Rescheduling or reassigning the lead clears the old team. Assign the supporting team again for the new schedule.
- Reception checks in the customer as before. The lead starts and completes the service. The full team is required before starting; compensation is captured privately at start and is not included in customer appointment data. Total configured staff fees cannot exceed the allocated session price.
- Each assistant uses Treatment team > Confirm my participation while the appointment is Ongoing. The lead's start records lead participation. Assistants cannot start or finish the appointment for the lead. Every member must confirm before normal worker completion.
- Customer confirmation/payment completion remains required by the existing booking workflow. Group recipients have independent appointments and treatment teams.

## Finance and payroll

- Finance > **Staff Compensation** lists completed individual services awaiting review and approved earnings.
- An independent reviewer with `payroll:approve` reviews the saved rates and participation and approves the appointment's earnings. A team member cannot approve their own treatment's earnings. Flagged consultations require an explanation after reviewing clinical notes.
- Percentages use the booked service revenue allocated to the session, before platform fees. Packages/multiple-session plans divide the plan price equally in centavos; any remainder is allocated to the first sessions. Fixed fees apply once per session. Platform commission remains separate.
- Select an open payroll period on or after completion. Late approvals may use a later open period. This does not change completed or approved payroll.
- HR regenerates payroll to include the approved earning IDs. The server checks employee, branch, period, amounts, and prior claims when submitting and approving payroll. Approval claims the earning IDs; payslip release remains idempotent.
- Refunds/corrections use **Record reversal**. This creates a separate negative ledger entry in an open period, preserves the original earning and approved payroll, limits total reversals to the original amount, and prevents duplicate submission using a request ID. A negative net payroll requires Finance review rather than automatic release.

## Existing data and release checks

- Deploy frontend, backend, and the updated Firestore rules together. New private collections (`practitionerProfiles`, `appointmentStaffTerms`, `staffEarnings`, `practitionerProfileAudit`) are accessible only through the trusted API.
- Existing completed appointments without captured staff agreements do **not** receive guessed commissions or automatic backdated rates. Existing approved payroll/payslips remain unchanged. Regenerate unapproved payroll that previously counted service revenue as commission.
- Before enabling new configured team services, set each practitioner profile, approved service list, availability, base pay model, and compensation agreements. Existing unconfigured single-lead appointments can still start, but cannot produce new approved staff earnings without saved agreements.
- Test with separate owner, Finance, doctor, nurse, and customer accounts: book, assign team, reject overlap/leave, check in, start, confirm assistant participation, complete, confirm as customer, approve earnings, generate/approve/release payroll, retry release, and record a partial reversal. Also test a package follow-up, a rescheduled appointment, and a flagged consultation.

Automated checks: `npm test` and `npm run build`. Hosting configuration and live account permissions still need staging verification.
