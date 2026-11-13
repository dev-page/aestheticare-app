# Three-Lane Service Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present in-person appointments as a three-stage, date-scoped service queue while preserving current appointment actions and keeping other records searchable.

**Architecture:** Update the embedded `PractitionerAppointments.vue` view to derive lane groups from its existing permission-filtered appointments and render a responsive board. Keep the existing appointments table as a separate history/other-records view; leave the parent tabs, API calls, status transitions, and online-consultation component unchanged.

**Tech Stack:** Vue 3 Options API, Composition API setup state, existing Tailwind utility classes and appointment actions.

**Spec:** `docs/superpowers/specs/2026-11-13-three-lane-service-queue.md`

## Global Constraints

- Keep existing branch, practitioner assignment, and permission filtering.
- Keep existing service action handlers and their authorization checks.
- The live board defaults to today's local date and classifies the exact statuses listed in the spec.
- Display appointment dates in Month Day, Year format.
- Preserve the Online Consultations subtab and its behavior.
- Do not add or run tests for this request.

## Review Focus

- Local date at UTC day boundaries: default date uses local calendar fields, not a UTC date conversion.
- Status casing/spacing: classification handles case and surrounding whitespace without losing the displayed original status.
- Customer confirmation and balance: these statuses remain in Finished but do not appear as fully completed.
- Inactive or unfamiliar statuses: the history/other view exposes records omitted from the active lanes.
- Narrow viewport and empty lanes: all columns remain readable and each lane explains when it has no appointments.

---

### Task 1: Build the live service board and history view

**Files:**
- Modify: `frontend/src/views/admin/owner/clinic/PractitionerAppointments.vue`

**Interfaces:**
- Consumes existing `assignedAppointments`, search/date/status filters, action handlers, and `embedded` prop.
- Produces three computed lane collections, a live-board/history view toggle, and a date filter initialized to today's local date.

- [x] Add a local-date key helper and initialize the queue date filter to today's local date.
- [x] Format displayed appointment dates as Month Day, Year in both the board cards and history table.
- [x] Add normalized status grouping for Waiting (`Scheduled`, `Paid`, `Checked in`, `Ready to Start`), In Service (`Ongoing`), and Finished (`Awaiting Customer Confirmation`, `Balance Due`, `Completed`). Apply existing assignment, search, and date constraints before grouping.
- [x] Render the live board with three lane counts, appointment cards, distinct state labels, empty states, responsive stacking, and the existing appointment actions/permission checks.
- [x] Retain the current table and its status filter under a History & other appointments toggle so excluded and unclassified records remain reachable; provide an all-dates path for old records.
- [x] Review the result against the five Review Focus conditions and confirm the parent Online Consultations branch remains untouched.

## Execution Record

- Production build: `npm.cmd run build` passed.
- Whitespace validation: `git diff --check` passed.
- No tests were added or run.
- Ruling: Keep the change in the user's active checkout on `main`, since they approved proceeding in the IDE workspace. Risk if wrong: the work is not branch-isolated.
- Ruling: Use the clinic's local calendar date for the no-show button's date gate, matching the queue date and appointment schedule. Risk if wrong: a browser set to another timezone could show the button on a date boundary differently from clinic policy.
- Final review: read-only review found no remaining Critical or Important issues.
- Accessibility follow-up complete: Search, Status, and Date labels now target their controls with matching `for`/`id` attributes.
