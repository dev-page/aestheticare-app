# Clinic registration document quality setup

The clinic registration upload flow now checks each required PDF, PNG, or JPEG with Google Document AI before Firebase Storage accepts it. The backend also checks the stored file bytes during final submission. If Document AI is unavailable or a page fails quality checks, the applicant must retry or replace that document; the rest of the application remains saved.

## Google Cloud setup

1. Open the Google Cloud project used by the OTP backend and enable the Document AI API (`documentai.googleapis.com`).
2. In **Document AI → Processors**, create an **Enterprise Document OCR** processor. Choose the processor region that fits your project and keep that location available for the service.
3. Copy the processor resource name in this format:

   `projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`

4. Grant the service account used by `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, or the backend service-account file the **Document AI API User** role (`roles/documentai.apiUser`) on that project or processor.
5. Set this backend environment variable to the full processor resource name and restart/redeploy the OTP backend:

   `CLINIC_REGISTRATION_DOCUMENT_AI_PROCESSOR=projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`

The backend enables Document AI image quality scores for every processing request. The processor call requires the `documentai.processors.processOnline` permission, which is included in the API User role. See [Document AI IAM roles](https://docs.cloud.google.com/document-ai/docs/access-control/iam-roles), [Document AI setup](https://docs.cloud.google.com/document-ai/docs/setup), and the [processor process method](https://docs.cloud.google.com/document-ai/docs/reference/rest/v1/projects.locations.processors/process).

The processor resource name determines the regional API endpoint used by the backend, so the configured location must match the location shown in Document AI.

## Quality behavior

- Images are checked in the browser for decoding and minimum dimensions, then checked by Document AI for per-page quality, OCR readability, blur, cutoff, and small-text defects.
- Every upload is limited to 10 MB. The government ID front and back fields each accept exactly one page; upload the two sides separately. Other clinic registration documents may be uploaded as PDFs of up to 15 pages when all pages belong to that document or its supporting packet.
- A multi-page file is checked page by page. Pages with little readable text or without clear OCR cues for the selected document are retained for administrator review; they are not automatically treated as verified. The ID back also always requires visual comparison with the uploaded front.
- Page-count rules are enforced again from the backend Document AI result before the file is accepted into Firebase Storage. The configured OCR processor's standard online request limit is 15 pages; a processor limit error returns an actionable upload message.
- The minimum accepted Document AI page score is `0.5`. A missing quality score for any page fails closed so an unchecked page cannot pass.
- PDFs are processed page by page. Every page must return a quality score and enough readable OCR text.
- A passing preflight stores a private SHA-256 hash and compact quality result in `clinics/{ownerUid}/documentPreflights/{documentKey}`. The full OCR text is not returned to the browser or saved in the clinic profile.
- Final submission compares the actual Storage object with the accepted hash. Legacy files without an accepted preflight are checked from Storage before they can be submitted.
- Poor quality or OCR mismatch asks for replacement of the affected document and leaves the application pending. It does not delete or reject the clinic account.

## BIR tax review

The BIR OCR candidate (`VAT`, `Non-VAT`, or `unclear`) and a short evidence excerpt are visible only to authorized clinic reviewers. A reviewer must open the source certificate and explicitly record **VAT-registered**, **Non-VAT**, or **Needs clarification** in Clinic Verification. OCR never decides the tax profile by itself.

The reviewer decision is saved in the organization document `clinicPolicies/{ownerUid}.taxProfile`. Only a reviewer-confirmed VAT-registered profile enables VAT controls; Non-VAT, unclear, or unreviewed profiles leave VAT disabled. Branches inherit the organization tax profile. Clinic owners and employees can view the status but cannot edit it. The status is not copied into personal owner or employee records.
