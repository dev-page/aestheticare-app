# Simple HR Scheduling and Intern Pay Implementation Plan

> **For agentic workers:** Implement inline in this session. The user explicitly requested applying the agreed model.

**Goal:** Use one weekly schedule and attendance flow while tracking paid hours correctly and excluding academic student interns from employee payroll.

**Architecture:** Keep `employmentType` for the schedule recommender and add an explicit `engagementType` to distinguish employees from student interns. Store a weekly target and meal-break minutes, snapshot the break with attendance, and reuse the current Finance operating-expense workflow for optional intern stipends.

**Tech Stack:** Vue 3, Express, Firebase Firestore, existing shared schedule and payroll helpers.

**Spec:** `docs/superpowers/specs/2026-11-15-simple-hr-scheduling-design.md`

## Global Constraints

- One recurring schedule UI and one attendance process for both arrangements.
- Full-time starts at 40 paid hours/week; part-time and intern hours come from their agreement.
- Student interns are excluded from employee payroll; optional allowances use Finance operating expenses.
- Legacy shift templates without meal-break data keep the existing inferred-break behavior.
- Do not reclassify legacy `Intern` profiles without explicit engagement data.

## Review Focus

- Existing profiles and shifts without new fields retain behavior.
- A shift break is subtracted consistently from schedule totals, attendance payroll hours, and overtime calculations.
- Explicit student interns cannot enter employee payroll or the employee overtime request flow.
- Finance remains able to record an optional intern stipend as an operating expense.

---

### Task 1: Staff setup and schedule targets

**Files:**
- Modify `frontend/src/views/admin/owner/AddStaff.vue`
- Modify `frontend/src/views/admin/owner/StaffProfile.vue` for existing staff arrangement updates
- Modify `firestore.rules` to validate arrangement/hour updates and prevent intern base-pay changes
- Modify `backend/otp-backend/server.js` staff profile creation and attendance schedule resolution
- Modify `frontend/src/views/admin/owner/employee/EmployeeProfileSelf.vue`
- Modify `frontend/src/views/admin/owner/hr/ScheduleAssignment.vue`
- Modify `frontend/src/utils/employeeSchedules.js`

**Changes:** Add Employee vs Student Intern/OJT and weekly-hours target fields; validate and persist them server-side; default Full-time to 40; let authorized users explicitly classify existing legacy Intern records; load the stored agreement target into the existing recurring schedule; keep interns manually assigned.

**Verification:** Inspect profile payload and relevant page compilation with the production build.

### Task 2: Paid-hour shift templates and attendance snapshots

**Files:**
- Modify `frontend/src/views/admin/owner/hr/AddShift.vue`
- Modify `frontend/src/utils/employeeSchedules.js`
- Modify `backend/otp-backend/server.js` attendance record creation
- Modify `frontend/src/views/admin/owner/operations/ManagerAttendance.vue` and `frontend/src/views/admin/owner/Attendance.vue` to show the captured break and distinguish elapsed time
- Modify `backend/otp-backend/attendanceManagement.js`
- Modify `shared/philippineOvertime.js` only if needed to preserve explicit break snapshots

**Changes:** Add an unpaid meal-break field to shifts, calculate paid duration for weekly targets, and snapshot the break on attendance for payroll. Preserve inferred meal breaks for legacy data.

**Verification:** Compare UI calculations and payroll helper call sites; run production build.

### Task 3: Employee payroll and intern allowance separation

**Files:**
- Modify `frontend/src/views/admin/owner/hr/Payroll.vue`
- Modify `frontend/src/views/admin/owner/hr/BasePay.vue`
- Modify `frontend/src/views/admin/owner/hr/Overtime.vue` if a clear blocked-state is required
- Modify `backend/otp-backend/payrollWorkflow.js`
- Modify `backend/otp-backend/hrWorkflow.js`
- Modify `frontend/src/views/admin/owner/finance/FinanceExpenses.vue` to honor the stipend link's Other Expenses tab

**Changes:** Hide explicit student interns from employee base-pay and payroll preparation, enforce the same rule in server-side payroll submission and overtime requests, and show a clear link/instruction to record optional stipends in Finance operating expenses.

**Verification:** Inspect route guards, UI messaging, and payroll projection behavior; run production build.

### Task 4: Review and documentation

**Files:**
- Review changed files and update this plan with implementation notes.

**Implementation notes:** Profiles store `engagementType`, `employmentType`, and `weeklyHoursTarget`. Shift records store `unpaidMealBreakMinutes`, which is copied to attendance and used by weekly scheduling, leave hours, overtime, and payroll. Explicit student interns are hidden from base-pay and payroll setup, blocked from payroll submission/approval/release and overtime requests, and directed to Finance operating expenses for optional stipends. The Employee Management edit form supports classifying existing records.

**Verification:** `git diff --check`, Node syntax checks for the modified backend modules, and `npm.cmd run build` completed. The test suite was not run, and no live Firebase or payroll data was exercised.
