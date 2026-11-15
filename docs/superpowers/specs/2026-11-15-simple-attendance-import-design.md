# Simple Attendance Import Design

## Intent

Make historical attendance imports understandable to clinic staff while ensuring imported time records use the same scheduled shift and unpaid-break rules as QR attendance and payroll.

## Approved behavior

- Import remains for historical/backfill records; routine attendance uses the QR flow.
- A standard file has one row per staff member per workday and uses recognizable headers: `employee_email`, `date`, `time_in`, `time_out`, `clock_out_date`, and `unpaid_break_minutes`.
- `employee_email`, `date`, `time_in`, and `time_out` are required. `clock_out_date` and `unpaid_break_minutes` are optional.
- CSV and XLSX remain supported when using the standard headers. Common header spelling variants are recognized automatically; unmatched extra columns are ignored and disclosed.
- If no break value is supplied, use the assigned schedule's stored break, or the existing legacy inference from scheduled shift length. If no schedule break can be determined, reject that row with an instruction to enter `unpaid_break_minutes` (use `0` for no unpaid break).
- Imports use a single upload, preview, and confirmation flow. Preview shows valid rows, rejected rows with reasons, and paid duration. Existing records are never overwritten; batch history and idempotency are retained.
- Imported records snapshot shift start/end/label and unpaid-break minutes so payroll can calculate paid time and overtime consistently.
- The legacy direct import endpoint is removed so attendance cannot bypass preview and confirmation.

## Non-goals

- No import mapping UI, saved mapping templates, punch-event grouping, or custom attendance-field import.
- No employee account creation during import.
- No automatic correction/overwrite of an existing attendance record.
- No changes to normal QR clocking or audited HR corrections.

## Approaches considered

1. Keep the configurable four-step wizard and add only break data. Rejected because column mapping, punch grouping, templates, and custom fields are the main source of import friction.
2. Use one standard shift-row template with automatic matching, preview, and confirmation. Chosen because it is short for clinic users while preserving validation and a safe confirmation step.
3. Permit direct imports without preview. Rejected because users need to see mismatched employees, duplicate dates, and break handling before records enter payroll.

## Constraints and decisions

- Keep the 3 MB / 400-row limits, CSV/XLSX support, branch/permission checks, preview expiration, duplicate protection, and import history.
- Preserve common header aliases such as `email`, `employee id`, `clock in`, `clock out`, and `break minutes`.
- An overnight row uses `clock_out_date` set to the next calendar day; no file-wide checkbox is needed.
- A supplied break overrides the scheduled break for that imported record. Blank break uses the schedule; when schedule data is unavailable, the row is rejected rather than guessed.
- Imported attendance is not location verified and must remain clearly identified as imported.
