# Clinic Supply, Profile, and Policy Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the clinic-side UI and align supply ordering, policy selection, owner access, and clinic hours with the user's requested workflow.

**Architecture:** Keep the existing Vue/Firebase frontend and server-authoritative supply workflow. Reuse current branch authorization and operating-hours data; change the supplier query, supply record transitions, and page-level UI at their existing boundaries.

**Tech Stack:** Vue 3, Firebase Firestore, Node.js supply API, shared JavaScript policy and schedule helpers.

**Spec:** `docs/superpowers/specs/2026-11-18-clinic-supply-profile-and-policy-design.md`

## Global Constraints

- Preserve historical records; do not delete legacy budgets or alter registration.
- Keep owner privileges clinic-scoped; do not grant additional staff permissions.
- Use the existing `operatingHours` format and existing appointment availability checks.
- Do not add or run tests in this session; verify with syntax/build checks and `git diff --check`.

## Review Focus

- Supplier directory never runs the unauthorized legacy branch query — inspect owner and shared-directory query paths.
- Finance approval requires invoice evidence — inspect PO creation, document transfer, and approval transitions.
- Received accepted stock unlocks invoice settlement only after full delivery — inspect partial, rejected, and complete receiving behavior.
- Closed operating days save and remain unavailable to booking — inspect default/legacy normalization and save payload.
- Legacy policies and budgets remain intact but do not reappear in current navigation, contract selection, or approval copy.

---

### Task 1: Fix Walk-In and Inventory UI; simplify supply guide

**Files:**
- Modify: `frontend/src/views/admin/owner/crm/WalkInDesk.vue`
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`
- Modify: `frontend/src/components/common/SupplyFlowGuide.vue`

- [ ] Set explicit readable dark-mode text, surface, and input colors on the new-recipient form.
- [ ] Remove the Register item action and the More filters disclosure; show compact filters directly and use the available inventory categories as Category options.
- [ ] Replace the expandable step highlighting with a readable static sequence matching the six handoffs in the spec.
- [ ] Simplify the procurement request detail card to a request summary and a clear next action; remove the four confirmation checkboxes and all budget wording from this handoff.

### Task 2: Fix supplier owner access and remove active Finance budgets

**Files:**
- Modify: `frontend/src/views/admin/owner/operations/SupplySuppliers.vue`
- Modify: `frontend/src/components/sidebar/clinicSidebarItems.js`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`
- Modify: `frontend/src/views/admin/owner/finance/FinanceRequests.vue`

- [ ] Query only associated suppliers and the explicitly shared directory; remove the branch query over legacy supplier rows.
- [ ] Remove Budget Allocations from Finance navigation and redirect the old budget route to purchase approvals.
- [ ] Remove active budget page, budget creation action, and budget-only dashboard/copy from Finance; leave old stored records untouched.
- [ ] Remove copy that describes purchase approvals as funding or budget requests.

### Task 3: Align the supply API and UI with invoice approval and delivery receipt

**Files:**
- Modify: `backend/otp-backend/supplyWorkflow.js`
- Modify: `backend/otp-backend/supplyModel.js`
- Modify: `frontend/src/views/admin/owner/operations/SupplyWorkspace.vue`
- Modify: `frontend/src/components/common/PurchaseOrderSummary.vue` only if its current fields cannot show invoice and delivery evidence.

- [ ] Create the purchase order from the supplier/pricing/invoice form without a budget request or allocation.
- [ ] Require supplier invoice number/date and invoice evidence before PO finance review; link the uploaded document to the resulting PO.
- [ ] Let Finance approve or reject the PO without selecting a budget; on approval, mark its linked supplier invoice approved pending delivery.
- [ ] Let Procurement issue the approved PO to the supplier; let Inventory receive and inspect against the issued PO and add accepted stock.
- [ ] Make delivery receipt evidence available on the receiving record and notify Finance when Inventory completes receiving.
- [ ] Make the linked invoice payable only after complete accepted delivery, then use the existing external-payment recording flow without budget deductions.
- [ ] Keep legacy budget records and legacy approval paths readable; new actions must use the new path.

### Task 4: Remove separate Walk-In policy and improve policy modal backdrop

**Files:**
- Modify: `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`
- Modify: `frontend/src/utils/clinicPolicies.js`
- Modify: `frontend/src/views/admin/owner/BranchInfo.vue`
- Modify: `frontend/src/views/admin/owner/ClinicPage.vue`
- Modify: `frontend/src/views/admin/owner/OwnerDashboard.vue`
- Modify: `frontend/src/views/admin/owner/operations/ProductServiceListing.vue`
- Modify: `shared/clientContract.js`
- Modify: `backend/otp-backend/server.js`
- Modify: `shared/clinicPolicyContent.js` only if needed to ignore legacy Walk-In fields.

- [ ] Remove the clinic tax status panel and its display-only tax-status calculations from Policy & Contract Management.
- [ ] Remove Walk-In Policy controls and branch policy selection; apply service policies consistently to walk-in and online bookings.
- [ ] Ignore old Walk-In policy fields when building contracts; remove Walk-In-only explanatory copy.
- [ ] Change the policy editor overlay from near-opaque to translucent so the underlying page remains visible.

### Task 5: Add flexible operating hours to Clinic Profile

**Files:**
- Modify: `frontend/src/views/admin/owner/ClinicProfile.vue`

- [ ] Show Monday through Sunday with editable open/closed state and one or more time ranges per open day.
- [ ] Normalize saved and legacy hour data into the existing `operatingHours` shape; preserve multiple ranges and closed days.
- [ ] Validate that open-day ranges are complete and close after open before saving.
- [ ] Save hours with the clinic profile so booking availability uses them immediately.

### Task 6: Verify the resulting changes

**Files:** None.

- [ ] Run backend JavaScript syntax checks for changed server files.
- [ ] Run the frontend production build.
- [ ] Run `git diff --check` and inspect the final diff for accidental unrelated changes.
