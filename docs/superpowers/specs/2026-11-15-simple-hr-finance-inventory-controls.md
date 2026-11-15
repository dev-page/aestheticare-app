# Simple HR, Finance, and Inventory Controls

## Goal

Close the agreed end-to-end gaps in payroll, leave, Finance reporting, and stock reconciliation while keeping each clinic workflow short and auditable.

## Decisions

- Payroll deduction percentages and modes stay branch-configurable. The backend reads the saved branch settings, recalculates each statutory deduction, and rejects a payroll submission if its settings snapshot, deduction lines, total deductions, or net pay differ. The application does not claim that clinic-entered rates are legal advice or automatically current government rates.
- Leave policy has two clinic settings: annual paid workdays and months of service before eligibility. The same policy is enforced by the backend and explained on the employee request page. HR maintains an employee's employment start date in the existing Base Pay staff list. Pending and approved requests reserve the annual balance; configured special leave types remain outside this annual allowance.
- Finance's monthly summary uses the financial event date already stored for each source (transaction/refund timestamp, payroll period, supplier invoice date, or operating-expense date). Refunds are shown as a separate positive amount and subtracted once from gross collections. The page is labeled as a monthly activity summary, not an audited profit-and-loss statement.
- Inventory reconciliation compares an item's recorded stock total with its remaining lot quantities and reports only mismatches. It does not mutate stock or lots; staff resolve the discrepancy through existing receiving or stock-adjustment actions.
- All new server routes remain authenticated, branch-scoped, and permission-checked. Sensitive settings writes and audit rows are backend-managed.

## Out of Scope

- Choosing or certifying statutory payroll tax rates for a clinic.
- Automatically issuing leave balances for special statutory leave categories.
- Automatic inventory corrections, write-offs, or lot creation.
- External accounting integrations or replacement of the existing procurement/payment workflow.

## Acceptance Criteria

1. A client cannot alter payroll deduction settings or payroll deduction amounts to bypass backend validation.
2. Staff see the same leave allowance and eligibility rule that the backend enforces; missing employment start date is explained and blocks only paid leave requests that require tenure validation.
3. Finance can distinguish gross collections, refunds, and net collections for the selected month without counting a refund twice.
4. Inventory staff can see which item totals disagree with lot totals and the exact difference without any automatic data change.
5. Targeted tests, production verification, and the frontend build pass, or their exact remaining failures are reported.
