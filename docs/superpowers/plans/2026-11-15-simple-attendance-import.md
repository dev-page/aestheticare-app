# Simple Attendance Import Implementation Plan

> **For agentic workers:** Implement inline in this session. The user explicitly approved the standard-template import flow.

**Goal:** Replace the configurable attendance import wizard with a standard template and ensure imported attendance carries the scheduled unpaid break into payroll.

**Architecture:** The backend preview endpoint parses the selected CSV/XLSX, recognizes standard headers, resolves staff and schedules, and saves a validated preview. The UI presents a template download, one preview, and explicit confirmation. Existing transaction-based commit/history protection remains.

**Tech Stack:** Vue 3, Express, Firebase Firestore, ExcelJS, existing attendance and payroll helpers.

**Spec:** `docs/superpowers/specs/2026-11-15-simple-attendance-import-design.md`

## Global Constraints

- One row represents one employee shift on one work date.
- Existing attendance records are never overwritten.
- Break minutes are copied from the schedule or explicitly provided; missing break context is rejected, not guessed.
- Keep branch authorization, feature checks, 3 MB / 400-row limits, preview expiry, idempotency, and import history.
- Keep CSV/XLSX and audited correction workflows.
- Do not run or add tests unless the user asks; verify with syntax/build/diff checks.

## Review Focus

- Imported records without a schedule or break value must not silently count a long shift as fully paid.
- Excel date and time cells must normalize to the same date/time representation as CSV values.
- Duplicate dates in a file and records already in Firestore must block only the conflicting rows and must never overwrite.
- Overnight rows use an explicit next-day clock-out date and must not be accepted for dates more than one day after clock-in.
- The removed legacy import path must not leave parser-only helpers or references behind.

---

### Task 1: Standardized server preview and payroll snapshots

**Files:**
- Modify `backend/otp-backend/attendanceImports.js`
- Modify `backend/otp-backend/server.js` to inject `loadAttendanceSchedule` and remove the unused direct import endpoint/helpers

**Changes:** Parse and validate the standard shift-row template in the preview request; automatically match staff; attach schedule/break snapshots; store row-level accepted/rejected results; preserve commit transaction and import history.

**Verification:** Node syntax checks and inspection of route references; no test suite run per project instruction.

### Task 2: One-screen upload, preview, and confirm UI

**Files:**
- Modify `frontend/src/components/common/AttendanceImportWizard.vue`
- Modify `frontend/src/views/admin/owner/Attendance.vue` if its importer props need updating

**Changes:** Download a canonical CSV template, upload CSV/XLSX with standard headers, automatically request validation, show ready/rejected rows and paid duration, confirm import, and retain import history navigation. Remove column mapping, punch mode, saved mapping UI, and custom-field mapping from the import flow.

**Verification:** Production frontend build and review of the resulting rendered template structure.

### Task 3: Plan notes and final review

**Files:**
- Update this plan with implementation notes and verification results.

**Verification:** `git diff --check`, backend Node syntax checks, and frontend production build. Do not claim live Firebase behavior was exercised.

## Implementation Notes

- The import screen now downloads a standard CSV header and validates CSV/XLSX files immediately on upload.
- Accepted records include the matched staff account, scheduled shift details, break minutes, work date, and clock epochs. The preview displays break-adjusted paid duration.
- Blank break cells use the assigned shift's configured or legacy-inferred break. Rows with neither a scheduled break nor an explicit value are rejected with a row-level correction message.
- Next-day clock-outs use `clock_out_date`; shifts over 24 hours are rejected.
- The older direct `/attendance/import` endpoint and saved mapping endpoint were removed. Import history, transaction-based commit, duplicate prevention, branch checks, expiry, and the 3 MB / 400-row limits remain.
- Verification completed: `node --check` for the three modified attendance backend modules, production frontend build, and `git diff --check` passed. No tests or live Firebase imports were run.
