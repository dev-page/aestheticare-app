# Product and service financial approval

## Workflow

1. Owner/manager saves a draft in Product & Service Listing.
2. Submit to Finance validates the price and installment percentage and queues review.
3. Finance opens Finance > Listing Approvals, reviews the price and financial terms, then approves or requests changes with a reason.
4. Approval does not publish. The owner/manager reviews the offering and clicks Publish.
5. Published and Finance-approved listings appear in customer discovery and clinic pages.

Changes to price, consultation fee, installment eligibility, deposit percentage or structured discount fields return the listing to draft and unpublish it. Submit it for another review and publication. Photo, title and description changes preserve approval. Restored archived listings return as drafts. Included package services and consultations must be approved and published before the package is published.

Finance approval is restricted to the Finance role; publication and submission are restricted to Owner/Manager. All actions check clinic ownership or branch assignment. Review decisions record actor, timestamp, note and financial terms in approvalHistory. Notifications go to branch Finance on submission and the submitter/creator/owner on review.

Customer booking validates publication and Finance approval on the server. Product checkout reloads listings and uses approved prices; stale cart prices and unpublished products are rejected before payment.

## Existing listings and deployment

Existing listings without approval fields are treated as drafts and become hidden from customer queries. They must be submitted, approved and published; there is no automatic grandfathering or live data migration.

Deploy the OTP backend, frontend, firestore.rules and firestore.indexes.json together. The new productServicePosts composite index covers branchId, financeStatus and isPublished. Current local edits do not change the deployed site. Finance accounts need their existing finance:reports:view permission to see the review page.

Run node --test backend/otp-backend/listingApproval.test.js backend/otp-backend/bookingWorkflow.test.js and the frontend production build. Automated tests use local fixtures, not a live Firestore instance. Before release, verify branch isolation and direct-write rejection against the deployed rules or Firestore emulator with owner, manager, Finance and customer accounts.
