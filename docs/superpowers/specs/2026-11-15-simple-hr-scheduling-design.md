# Simple HR Scheduling and Intern Pay Design

## Intent

Make clinic staffing easier to configure while keeping one recurring schedule and attendance workflow. Payroll must distinguish employees from academic student interns/OJT trainees so an intern allowance is not accidentally treated as employee wages.

## Approved behavior

- Staff profiles have a work arrangement: **Employee** or **Student Intern/OJT**. An intern hired as an employee and paid through payroll is classified as Employee; Student Intern/OJT is for an academic placement.
- Employees select Full-time or Part-time and keep an agreed weekly-hours target. Full-time starts at 40 paid hours; Part-time uses the agreed value.
- Student Intern/OJT uses the same weekly schedule and attendance screens. The schedule is assigned manually against the training agreement.
- Shift templates record an unpaid meal break. Weekly scheduled hours and payroll attendance hours use paid time (shift span minus the unpaid break). Legacy templates without a break retain the existing inferred-break behavior.
- Attendance clock-in/out remains the same for employees and interns.
- Student interns do not enter employee payroll. An optional stipend is recorded as a separate operating expense in Finance, without employee payroll deductions.
- Employee payroll continues to use attendance, approved overtime, pay model, approved leave, and existing payroll approval.

## Non-goals

- No internship agreement/document manager, legal classification engine, or separate intern attendance system.
- No automatic stipend amount or automatic payment. Finance enters and settles an optional allowance through the existing expense workflow.
- No change to the app-wide 48-hour schedule ceiling; it remains a validation ceiling, not the recommended full-time target.

## Approaches considered

1. Add a separate internship scheduling and payroll module. Rejected because it creates a second calendar and payroll flow.
2. Treat every intern as an employee and rely on a payroll checkbox. Rejected because an academic trainee's allowance should not inherit employee wage deductions.
3. Use the shared schedule and attendance flow, explicit employee/student-intern classification, employee-only payroll, and Finance operating expenses for optional stipends. Chosen for the simplest workflow and the clearest pay separation.

## Constraints and decisions

- Existing staff with no `engagementType` remain employees for backwards compatibility.
- Existing records that only say `employmentType: Intern` are not silently reclassified. Only an explicit `engagementType: student_intern` is excluded from employee payroll.
- Employee Management lets an authorized clinic user classify existing legacy intern records explicitly. Until classified, they remain employees for backwards compatibility and the UI flags them for review.
- New full-time profiles default to a 40-hour weekly target. Part-time and intern targets are entered from their agreement.
- A meal-break value is stored on the shift template and copied to attendance records so payroll uses the same number that HR sees.
