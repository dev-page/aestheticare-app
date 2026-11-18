# Public clinic profile rollout

Clinic documents contain private registration and verification data. Public
pages now read `publicClinics`, whose records are written by the
`syncPublicClinic` Cloud Function from an explicit allowlist. The function
reconciles every clinic write and removes a public record when the clinic is
unpublished or deleted. Existing clinics need a one-time backfill.

Deploy the function first, before migrating existing records, so concurrent
clinic changes are also synchronized. Use a Firebase account or service account
with permission to deploy functions and read and write these collections.

1. Deploy the `syncPublicClinic` function to the intended Firebase project.
2. Run the backfill without `--apply` to confirm the target project and record
   counts. Configure Application Default Credentials beforehand.
3. Run it again with `--apply`. It overwrites public records with the allowlisted
   profile, removes records whose source is absent or unpublished, and rereads
   each source in a transaction to handle concurrent updates.
4. Deploy the updated Firestore rules and frontend together. Customer pages may
   briefly be unavailable between these deployments. The old clinic-document
   public access stays exposed until the new rules are deployed.

```sh
firebase deploy --only functions:syncPublicClinic --project PROJECT_ID
node backend/otp-backend/scripts/backfill-public-clinics.mjs --project=PROJECT_ID
node backend/otp-backend/scripts/backfill-public-clinics.mjs --project=PROJECT_ID --apply
firebase deploy --only firestore:rules --project PROJECT_ID
```

Deploy the frontend through the project's normal hosting workflow. Backfill is
safe to rerun after an interrupted run. It does not log clinic fields. Legacy
business email and contact numbers are omitted until the owner completes clinic
setup, which asks for customer-facing contact information.
