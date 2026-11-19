# Finance Listing and Policy Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Finance Listing Approvals table and listing preview, and make the Policy Management edit modal readable.

**Architecture:** Keep existing Vue components and data flows. Add presentation-only helpers and scoped CSS; preserve listing review and policy state transitions.

**Tech Stack:** Vue 3, Tailwind utility classes, application CSS.

**Spec:** `docs/superpowers/specs/finance-listing-policy-ui.md`

## Global Constraints

- Preserve existing permissions, approval mutations, policy validation, and persistence.
- Keep visual changes scoped to the two approved areas.
- Do not add or run tests for this request.

## Review Focus

- A missing listing image displays an intentional placeholder in both table and detail view.
- Long titles and descriptions wrap without breaking the modal layout.
- Table remains horizontally usable at narrow widths.
- Policy fields and helper text remain readable across each policy type.
- Apply and Cancel retain their existing behavior.

---

### Task 1: Listing Approvals table and preview

**Files:**
- Modify: `frontend/src/views/admin/owner/finance/ListingApprovals.vue`
- Modify: `frontend/src/assets/finance-pages.css`
- Modify: `frontend/src/assets/app-design-system.css`

**Interfaces:**
- Consume each existing `productServicePosts` record, including optional `imageUrl` / `imageURL` / `image` fields.
- Keep `handleListingAction`, `review`, and `updateListingApproval` behavior unchanged.

- [x] Add a thumbnail and image fallback to each listing row, and use a larger post-style preview in View Details.
- [x] Show listing identity, type/status, branch, price/VAT treatment, description, and available terms/review note in the preview.
- [x] Add responsive, scoped styles for table identity cells, thumbnails, placeholder, and preview layout.
- [x] Review missing-image, long-text, and narrow-width states in the source and diff.

### Task 2: Policy edit modal readability

**Files:**
- Modify: `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`
- Modify: `frontend/src/assets/finance-pages.css`

**Interfaces:**
- Keep the existing `editor`, `validateEditor`, `applyEditor`, and `closeEditor` behavior unchanged.

- [x] Replace the dark modal, form-control, and instruction-panel styling with scoped cream surfaces and dark readable text.
- [x] Keep all existing fields, hints, validation, and actions intact.
- [x] Review each policy editor branch and the final diff for contrast and accidental behavior changes.

**Execution note:** `git diff --check` completed without whitespace errors. Automated tests/build were not run per the session instruction not to run tests unless requested. Final review was performed by the implementing agent.
