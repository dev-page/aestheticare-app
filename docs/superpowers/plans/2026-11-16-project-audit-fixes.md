# Project Audit Fixes Implementation Plan

> **For agentic workers:** Execute this plan task by task. Do not rotate credentials or change clinic-specific/statutory policy values.

**Goal:** Correct the confirmed source-level defects from the project-wide audit without changing unrelated module flows.

**Architecture:** Make targeted validation changes in existing backend workflows and Firestore rules, preserve server-side transaction ownership, and update only the affected UI and reporting helpers. Keep policy-dependent and live-provider work documented as deferred.

**Tech Stack:** Node.js/Express, Firestore rules, Vue 3, existing shared JavaScript helpers.

**Spec:** `docs/superpowers/specs/2026-11-16-project-audit-fixes-design.md`

## Global Constraints

- Do not rotate or display credentials.
- Do not change statutory payroll rates or clinic-specific policies.
- Keep current role and branch boundaries; do not broaden access to make a screen work.
- Do not run or add tests for this task; perform source/diff review and syntax/build checks only.
- Keep online booking email requirements unchanged; only the clinic-entered walk-in flow may omit recipient email.

## Review Focus

- Budget approval must reject inactive or category-mismatched budgets in both approval paths.
- Refund retries must be idempotent per request while allowing a distinct later partial refund.
- Customer chat must not allow a user to mutate thread ownership or impersonate a clinic/customer sender.
- Historical payroll must continue to validate attendance and leave while using the saved pay snapshot.
- Missing walk-in email must not prevent booking, payment, receipt printing, or service-code display.

## Tasks

1. **Backend controls:** tighten Firestore chat/review/activity rules, remove diagnostic detail from API error responses, validate selected budget state/category, and allow later refund operations with a distinct idempotency key.
2. **Inventory reporting:** calculate stock signals and suggested replenishment from usable stock; include `Receiving` orders in ongoing reports.
3. **Payroll period snapshots:** permit archived employee history and validate base pay from the period snapshot rather than mutable current profile fields. Leave statutory-rate changes deferred.
4. **Walk-in and theme:** make recipient email optional only for walk-ins and remove forced light-only styling from Attendance.
5. **Release notes:** update the production checklist for attendance CSV/XLSX import and replace the starter README with project setup and deployment guidance.

## Verification

- Inspect the complete diff for scope, security-rule and UI-flow consistency.
- Run syntax checks on changed backend JavaScript and a frontend production build if the environment permits.
- Do not claim live integration readiness; the staging checklist remains a separate release gate.
