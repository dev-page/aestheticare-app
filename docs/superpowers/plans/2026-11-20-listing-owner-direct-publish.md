# Listing Owner Direct Publish Implementation Plan

> **For agentic workers:** Use the executing-plans workflow to implement this plan task-by-task.

**Goal:** Let clinic owners and Clinic Admins directly publish their own new listings while keeping staff-created listings in Finance review.

**Architecture:** The existing listing approval endpoint remains the authority for publication. It will allow an owner/Admin to publish a self-created draft, while retaining subscription, branch, validation, linked-consultation, and package checks. The Service Listings UI will expose a deliberate direct-publish action for eligible users.

**Tech Stack:** Vue 3, Firebase Firestore, Express, existing `listingApproval.js` workflow.

**Spec:** `docs/superpowers/specs/2026-11-20-listing-owner-direct-publish.md`

## Global Constraints

- Public discovery continues to require `financeStatus: approved` and `isPublished: true`.
- Employees continue to submit listings for review.
- Direct publication cannot override a pending or rejected Finance decision.
- Branch and active-subscription checks remain enforced by the backend.

## Review Focus

- A staff user cannot directly publish their own draft.
- An owner/Admin cannot directly publish another user's draft.
- An owner/Admin cannot use direct publishing on pending or rejected listings.
- A directly published listing must have a positive price and valid installment terms.
- Financial edits retain a Finance-review requirement and cannot clear it through a client update.
- Existing linked consultation and package composition checks still run before publication.
- A failed publish after draft creation reports that the draft was saved.

### Task 1: Backend publication policy

**Files:**
- Modify: `backend/otp-backend/listingApproval.js`

- [x] Allow only `Owner` or `Clinic Admin` to directly publish a draft whose `createdBy` matches the acting UID.
- [x] Mark the listing approved and published while recording the direct-publication method in `approvalHistory`.
- [x] Keep ordinary publishing restricted to Finance-approved listings; keep rejected and pending listings ineligible for direct publication.
- [x] Preserve existing validation, access, subscription, and dependency checks.

### Task 2: Service Listings UI

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`

- [x] Add “Save & Publish” for owners and Clinic Admins while preserving “Save Draft”.
- [x] Expose a direct “Publish” action for their own saved drafts.
- [x] Keep “Submit to Finance” for employee-created drafts and rejected submissions.
- [x] Report partial success accurately if draft creation succeeds but publication fails.
- [x] Update the page description to explain the owner/Admin and employee paths.
