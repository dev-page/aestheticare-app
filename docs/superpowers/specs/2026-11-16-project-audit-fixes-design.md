# Project Audit Fixes Design

## Intent

Close the source-level defects found in the project audit that can be corrected without clinic-specific policy decisions or live provider credentials. Preserve existing module boundaries and user flows.

## Goals

- Enforce procurement budget state and category rules in the backend.
- Make a second partial refund create its own idempotent operation.
- Base replenishment signals on stock available after reservations and include receiving orders in reports.
- Keep generated payroll reviewable after staff archival or later pay-profile edits by relying on payroll-period snapshots.
- Narrow direct Firestore write permissions for customer messages, chat threads, reviews, and activity identity.
- Remove internal exception details from public 500 responses.
- Allow walk-in recipients without email while retaining name, phone, consent, printed receipt, and service-code flows.
- Make the Attendance page respect the existing light/dark theme.

## Non-goals

- Rotate credentials.
- Change statutory payroll rates, tax tables, or legal leave policy without accountant/clinic approval and current authoritative inputs.
- Redesign multi-branch employment/payroll, pharmacy catalog identity, supplier-document permissions, or supply transaction scaling.
- Claim live PayMongo, Firebase, email, OCR, or Google Meet readiness without staging credentials and end-to-end execution.

## Approaches

1. Rewrite module workflows broadly. Rejected because it would create unnecessary migration and regression risk.
2. Add narrow backend/rules guards and correct the specific calculations/report predicates. Chosen because these defects are localized and existing workflows provide the intended behavior.
3. Defer all changes to staging. Rejected for code defects that can be corrected and reviewed locally.

## Implementation calls

- Customer-facing clinic chat remains available; writes must match the authenticated customer or an authorized branch inbox user, and thread identity fields remain immutable.
- Reviews are written through the existing authenticated API, so direct browser writes are disabled.
- Activity log entries remain client-created for compatibility but must identify the authenticated actor and their own branch.
- A walk-in appointment may omit email; email delivery becomes optional, while the UI continues to show the service code and printable receipt.
- Payroll keeps the generated rate/model/divisor snapshot as the basis for period validation. Current archived status or later employee-rate edits must not invalidate the saved period calculation.

## Deferred review

Payroll statutory calculations still require qualified validation. Multi-branch payroll attribution, medication catalog IDs, document visibility for generic report roles, and branch-wide transaction scaling require additional product/data-model decisions.
