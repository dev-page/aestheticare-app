# Clinic Registration Document Quality and Tax Review

## Intent

Stop unreadable, blurry, low-resolution, or cropped registration documents from becoming submitted clinic records. Use OCR to assist document review and surface a likely BIR VAT tax type without allowing OCR alone to change the clinic's tax status.

## Goals

- Check JPEG, PNG, and PDF documents before accepting them into the registration upload flow.
- Reject poor-quality files with a document-specific retry reason; preserve other documents and the prior submitted file until a replacement passes.
- Enforce quality checks again on the server at document submission so a client cannot bypass preflight.
- Use Google Document AI quality signals for blur, cutoff, small text, glare, darkness, and other page defects. Use a 1024-by-768 OCR target for full-page raster images and a separate lower short-edge minimum for ID cards.
- Keep BIR OCR results advisory. A reviewer confirms VAT-registered, Non-VAT, or unresolved after inspecting the original document.
- Store tax status with clinic organization policy, not with the owner's or employees' personal records. Linked branches inherit the organization's confirmed status.
- Derive the effective VAT setting only from the reviewer-confirmed tax profile. Clinic owners and employees cannot set the VAT registration state.

## Non-goals

- Proving the authenticity of a BIR certificate or connecting to a BIR verification service.
- Automatically deciding whether each individual clinic service is VAT-applicable.
- Replacing the existing BIR document requirement or changing other registration document categories.

## Current state and constraints

- Registration currently stores a selected file after MIME and 10 MB checks. OCR runs after document submission.
- The current OCR uses Cloud Vision text extraction, not image defect detection. Its quality-related score is indirect and can reject the whole application.
- `googleapis` is already installed, but this environment has no Document AI processor configuration. A processor resource, enabled Document AI API, and service-account permission are deployment prerequisites.
- Current policy data is organization-scoped in `clinicPolicies/{ownerId}` and branches resolve to that owner. Appointment pricing already reads `vatRegistered` from this policy.

## Approach

Use a pre-upload flow: browser checks file type, byte size, decodability, and image dimensions; the authenticated backend sends the file bytes to a configured Document AI OCR processor with image-quality scoring enabled. Poor-quality files are rejected before Firebase Storage upload. Accepted preflight results are recorded server-side with a content hash. Submission validates that the uploaded bytes match that result, applying a server-side quality check to legacy documents without one. A failed quality check requires only that document to be replaced.

Document AI OCR extracts text and a likely tax-type signal for BIR certificates. The signal is displayed to a system reviewer with the original document. The reviewer records the confirmed clinic tax status in the organization policy. A missing or contradictory signal remains unresolved; it does not imply Non-VAT.

## Decisions

- Missing/unavailable Document AI quality checks fail closed for new uploads; the UI offers retry and does not upload the file.
- A document failing the quality gate is not classified as a rejected clinic. It is a document replacement request.
- Severe defect detections (blur, document/text cutoff, or unreadably small text) and quality scores below the configured floor block acceptance. Harmless local glare alone is not a blocking defect when overall page quality and required OCR text pass.
- A reviewer, not OCR or the clinic owner, is authoritative for VAT registration status.
- Existing clinics without a reviewed tax profile show “Needs BIR review”; VAT-applicable listing actions remain disabled until confirmed.
- The tax status belongs to the legal clinic organization. Employees receive only the effective tax calculation through existing branch access; they do not receive or edit the BIR source document.

## Data and permissions

- Keep the uploaded BIR file in the existing private clinic registration document path.
- Keep temporary OCR text, quality output, content hash, and tax candidate in a backend-only `documentPreflights` subcollection with expiry metadata. Do not return the full OCR text to the browser.
- Keep reviewed `taxProfile` metadata and the derived `vatRegistered` compatibility field in `clinicPolicies/{ownerId}`. The profile records status, source document key, reviewer, and review timestamp. Keep the OCR candidate/evidence in the backend-only preflight record and reviewer audit history.
- Firestore rules prevent clinic owners and staff from changing `taxProfile` or `vatRegistered`; a permission-checked backend reviewer endpoint writes them.

## Acceptance criteria

- Poor-quality images/PDFs receive an actionable error before the normal registration upload is saved.
- Good files upload only after a successful preflight; submission rejects missing or mismatched preflight evidence.
- Legacy documents receive server-side quality assessment before they are accepted during resubmission/review.
- OCR failures do not become an automatic Non-VAT decision.
- Reviewer-confirmed VAT status is visible to the clinic owner, is inherited by branches, and drives backend appointment pricing/listing eligibility.
- If the Document AI processor is not configured or unavailable, the applicant sees a retry/configuration message and cannot submit unchecked documents.

