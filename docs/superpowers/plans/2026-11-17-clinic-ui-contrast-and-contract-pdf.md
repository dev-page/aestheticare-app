# Clinic UI Contrast and Contract PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve clinic page readability and controls, paginate Activities, and offer the applied client contract as a PDF in a new tab.

**Architecture:** Use page-scoped styling with existing `--ac-*` theme tokens so global theme behavior remains unchanged. Preserve current page data flows; add one focused PDF utility that renders the existing structured contract document with the installed `jspdf` dependency.

**Tech Stack:** Vue 3 SFCs, scoped CSS, existing design tokens, Firebase, `jspdf`.

**Spec:** `docs/superpowers/specs/2026-11-17-clinic-ui-contrast-and-contract-pdf-design.md`

## Global Constraints

- Preserve existing permissions, notification and activity data access, and listing workflows.
- Do not delete existing stored address data.
- Keep the current client contract preview and add a PDF view in a separate tab.
- Do not change global theme rules or saved contract content.
- No test suite will be added or run for this UI task; verify with the production build and diff checks.

## Review Focus

- Dark Inbox paragraph overrides must not wash out text on pale outgoing bubbles; inspect both bubble directions in light and dark modes.
- Role action controls must remain visible and usable when the details panel narrows; inspect the responsive action row.
- Activities page changes must preserve the existing user, role, and branch filtering; inspect the current filtering pipeline after pagination is added.
- Notification actions, badges, and empty/loading states must retain readable contrast in both themes; inspect all states.
- PDF output must retain contract title, intro, section headings/content, acknowledgement, list markers, and appearance settings; inspect generated multi-page output.

---

### Task 1: Inbox contrast and Role Details actions

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/ReceptionistInbox.vue`
- Modify: `frontend/src/views/admin/owner/OwnerRoleManagement.vue`

**Interfaces:**
- Consumes: existing `--ac-*` theme tokens and Role Details actions.
- Produces: scoped readable Inbox message colors and responsive role action controls; no data or permission changes.

- [x] **Step 1: Correct Inbox message contrast**

Add theme-aware colors for incoming/outgoing message text, sender labels, and timestamps with sufficient selector specificity to beat the global dark paragraph rule. Keep pale outgoing bubbles in light mode and use contrasting dark surfaces in dark mode.

- [x] **Step 2: Align Role Details actions**

Give Delete Role a compact outlined danger style. Move the Discard, optional Reset, and Save action row out of the form column so it is a full-width sibling spanning the Role Details grid; retain wrapping on narrow screens.

- [x] **Step 3: Inspect both components**

Confirm the Inbox text color rules target both message bubbles and do not alter headings or composer text. Confirm built-in role controls and custom role deletion visibility remain unchanged.

### Task 2: Employee Profile fields and Activities table

**Files:**
- Modify: `frontend/src/views/admin/owner/employee/EmployeeProfileSelf.vue`
- Modify: `frontend/src/views/common/Activities.vue`
- Reuse: `frontend/src/components/common/TablePagination.vue`

**Interfaces:**
- Consumes: the existing employee profile save method and `filteredActivities` computed list.
- Produces: profile form without Staff Arrangement or Address inputs; `pagedActivities` derived from the existing filtered list.

- [x] **Step 1: Remove unnecessary profile controls**

Remove the Staff Arrangement and Address controls and their profile-form address initialization/write. Keep existing stored address values untouched in Firestore. Add a theme-aware Save Changes style.

- [x] **Step 2: Convert Activities to a paginated table**

Render columns for activity, details, actor/role, and date in a horizontally scrollable table. Add `currentPage` (default 1), `pageSize` (default 10), and computed `pagedActivities`; reset the page when displayed records shrink. Use `TablePagination` before and after the table with `v-model:page`, `v-model:page-size`, and `:total-items="filteredActivities.length"`.

- [x] **Step 3: Preserve states and scopes**

Keep the current loading directive, filtering, sorting, and no-activity message. Verify table cells use theme tokens and that pagination reflects only filtered rows.

### Task 3: Notifications light and dark UI

**Files:**
- Modify: `frontend/src/views/common/Notifications.vue`
- Modify: `frontend/src/components/common/NotificationDetailsDialog.vue`

**Interfaces:**
- Consumes: existing module/customer class variants and notification state/actions.
- Produces: theme-aware module header, panel, message rows, badges, and buttons without changing customer notification behavior.

- [x] **Step 1: Scope module theme styles**

Replace module-view hard-coded light surfaces and text with shared theme tokens. Add explicit high-specificity dark module rules where global paragraph or semantic element overrides currently win.

- [x] **Step 2: Tune notification controls**

Style Delete Selected as a clear destructive action, and make mark-read and View controls readable in enabled and disabled states. Keep customer view styles scoped to their existing classes.

- [x] **Step 3: Theme the teleported details dialog and inspect states**

The notification details dialog is teleported to `body`, so its panel and actions use root theme tokens in its own component. Check header, error, loading, empty, selected, unread, read, and details dialog colors in light and dark modes.

### Task 4: Service Listings theme and aligned listing actions

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`

**Interfaces:**
- Consumes: existing listing workflow, preview document, and theme tokens.
- Produces: theme-aware listing page and evenly aligned Edit/Archive/Delete controls; no listing workflow changes.

- [x] **Step 1: Replace hard-coded light surfaces**

Use `--ac-*` theme tokens for overview cards, tabs, policy panels, contract preview container, listing cards, statuses, and form controls. Add scoped dark rules for the contract document area so its white paper preview retains dark readable text against dark chrome.

- [x] **Step 2: Align listing actions**

Place available actions in a consistent responsive row with equal sizing where space allows. Keep Edit and Archive secondary, style Delete as destructive, and allow clean wrapping on small cards.

- [x] **Step 3: Preserve workflow and modal behavior**

Confirm buttons still call the same update, archive, and delete methods with the same visibility and disabled conditions.

### Task 5: Open the applied contract as a PDF

**Files:**
- Create: `frontend/src/utils/clientContractPdf.js`
- Modify: `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`
- Reuse: `shared/clientContract.js`, `frontend/src/components/common/ClientContractDocument.vue`

**Interfaces:**
- Produces: `createClientContractPdf(document) -> Promise<Blob>`.
- Consumes: `listingContractPreview`, including title, intro, sections, acknowledgement, formatted list text, and normalized appearance settings.

- [x] **Step 1: Add PDF preview action**

Add an “Open contract PDF” control beside the existing preview disclosure. Open a blank tab synchronously from the click handler, then set its location to a generated PDF Blob URL; report blocked pop-ups or PDF generation errors through the existing toast pattern.

- [x] **Step 2: Render structured contract content**

Use dynamically imported `jsPDF` to render title, intro, each section heading and body, formatted bullet lines, and acknowledgement. Apply the selected font family, size, heading color, accent color, alignment, and spacing. Add page breaks before content exceeds page bounds.

- [x] **Step 3: Inspect PDF preview lifecycle**

Confirm that generating the PDF does not modify stored contract data and the preview tab opens for the current branch’s contract. Revoke the temporary Blob URL only after the browser has had time to load it.

### Task 6: Final verification

**Files:**
- Inspect all files listed in Tasks 1–5.

- [x] **Step 1: Run whitespace and patch checks**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 2: Build the frontend**

Run: `npm run build`

Expected: Vite completes successfully with exit code 0.

- [x] **Step 3: Review scope**

Inspect `git diff --stat` and `git diff` to confirm no unrelated global theme, permission, data access, or clinic registration changes.
