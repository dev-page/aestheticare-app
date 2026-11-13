# Clinic Registration Document Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block poor clinic registration documents before upload, enforce the check server-side, and route BIR tax-type evidence through human review into organization tax policy.

**Architecture:** Browser validates basic image properties and calls an authenticated preflight API before Firebase Storage. The backend uses the configured Document AI OCR processor for quality signals and OCR, stores accepted evidence privately with a file hash, and verifies that evidence at submission. Reviewers confirm the BIR tax status; the backend derives the clinic policy VAT flag from that confirmation.

**Tech Stack:** Vue 3, Firebase Storage/Firestore, Express, existing `googleapis` package, Google Document AI OCR processor.

**Spec:** `docs/superpowers/specs/2026-11-13-registration-document-quality-design.md`

## Global Constraints

- Registration file types remain PDF, PNG, and JPEG; maximum upload size remains 10 MB.
- Do not save an unapproved file as a submitted registration document.
- Treat missing quality service configuration as a failed preflight, never as approval.
- OCR tax candidates remain advisory; only permission-checked reviewers can set clinic VAT registration.
- Do not store clinic VAT status on owner or employee user profiles.
- Do not run test suites unless the user asks for tests; compile and syntax checks are allowed.

## Review Focus

- A portrait image uses the correct orientation-aware dimension thresholds.
- A scanned multi-page PDF fails if any page has a blocking defect.
- A transient Document AI error leaves the prior accepted document untouched and allows retry.
- A browser cannot bypass server quality checks or submit different bytes than were preflighted.
- A missing/ambiguous BIR tax type never silently becomes Non-VAT.
- A staff policy update cannot forge a clinic tax profile through Firestore.

---

### Task 1: Add Document AI quality assessment and BIR OCR candidates

**Files:**
- Modify: `backend/otp-backend/server.js`
- Create: `docs/clinic-registration-document-quality-setup.md`

**Interfaces:**
- Add a helper accepting `{ bytes, contentType, displayName }` and returning extracted text, page quality scores/defects, and an accepted/rejected/unavailable result.
- Add `CLINIC_REGISTRATION_DOCUMENT_AI_PROCESSOR` as the full Document AI processor resource name.
- Add a BIR OCR helper returning `vat_candidate`, `non_vat_candidate`, or `unclear`, plus safe evidence text.

- [x] Add lazy Document AI client construction with the existing service-account credentials and cloud-platform scope.
- [x] Enable `enableImageQualityScores` for all document pages, block low-quality/cutoff/blur cases, and require readable OCR.
- [x] Extract only a bounded tax-type evidence snippet for BIR registration; do not persist the full OCR text in client-visible fields.
- [x] Document API enablement, processor creation, IAM, environment variable, and the fail-closed behavior.
- [x] Run `node --check backend/otp-backend/server.js`.

### Task 2: Gate browser registration uploads before Firebase Storage

**Files:**
- Modify: `frontend/src/views/public/Register.vue`
- Modify: `backend/otp-backend/server.js`

**Interfaces:**
- `/registration/ocr-preflight` accepts file metadata and base64 content for PDF, PNG, and JPEG and returns only quality status and actionable reason.
- Store preflight record at `clinics/{uid}/documentPreflights/{docKey}` with hash, quality result, safe OCR candidate, timestamp, and status.

- [x] Validate image decoding, orientation-aware minimum dimensions, MIME, and size before changing the selected/previous file state.
- [x] Call preflight before `uploadDocumentForClinic`; upload only on accepted quality and preserve old file on failure.
- [x] Extend server preflight to PDF using Document AI raw-document processing.
- [x] In `/registration/submit-clinic-documents`, verify each uploaded file hash against accepted preflight evidence; quality-check legacy documents server-side before transaction writes.
- [x] Return a document-specific retry error without marking the entire application rejected.
- [x] Run `npm run build` and `node --check backend/otp-backend/server.js`.

### Task 3: Make reviewer tax decisions authoritative

**Files:**
- Modify: `backend/otp-backend/server.js`
- Modify: `frontend/src/views/superAdmin/ClinicVerification.vue`
- Modify: `firestore.rules`

**Interfaces:**
- Add permission-checked reviewer endpoint accepting `vat_registered`, `non_vat`, or `needs_clarification`.
- Persist reviewed tax status in `clinicPolicies/{ownerId}.taxProfile`; derive `vatRegistered` only from the reviewed status.

- [x] Include quality and BIR candidate summary in registration review records.
- [x] Add reviewer controls with OCR candidate/evidence beside the original BIR certificate.
- [x] Write review audit history and apply status to organization clinic policy.
- [x] Prevent client Firestore writes to `taxProfile` and `vatRegistered` except superadmin paths.
- [x] Run `node --check backend/otp-backend/server.js` and `git diff --check`.

### Task 4: Apply confirmed tax status to clinic pricing UI and APIs

**Files:**
- Modify: `backend/otp-backend/server.js`
- Modify: `backend/otp-backend/bookingResources.js`
- Modify: `backend/otp-backend/listingApproval.js`
- Modify: `frontend/src/utils/clinicPolicies.js`
- Modify: `frontend/src/views/admin/owner/OwnerPolicyManagement.vue`
- Modify: `frontend/src/components/common/ServiceListingFields.vue`

**Interfaces:**
- Resolved clinic policy exposes an effective boolean `vatRegistered` derived from `taxProfile.status`.
- Owner policy UI displays verified/pending status and removes manual VAT-registration editing.

- [x] Resolve branch tax settings from the clinic organization's reviewed profile in frontend and backend.
- [x] Remove manual owner VAT toggle and exclude tax profile fields from clinic policy saves.
- [x] Update listing/pricing messages to explain that VAT controls unlock after BIR review.
- [x] Block VAT-applicable listing changes and appointment pricing unless profile status is verified VAT.
- [x] Run `npm run build`, `node --check` for changed backend files, and `git diff --check`.

