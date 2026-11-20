# Listing Owner Direct Publish

## Intent

Reduce the extra Finance approval loop for listings created by a clinic owner or Clinic Admin while preserving financial review for employee-created listings.

## Goals

- Owners and Clinic Admins can intentionally save and publish their own new listing from Service Listings.
- An owner or Clinic Admin can publish their own saved draft without opening Finance.
- Employee-created listings continue through Finance review before publication.
- The backend validates publisher authority, branch access, listing rules, subscription status, and dependencies.
- Record direct publication in listing approval history.
- Changes to price, VAT, discount, or payment terms still require Finance review.

## Non-goals

- Change who can review employee submissions.
- Allow a rejected listing to bypass Finance review.
- Change system administrator moderation or customer visibility rules.
- Add a new approval inbox.

## Approaches

- Auto-publish every listing on save: rejected because saving a draft should remain a distinct, intentional action.
- Owner/Admin direct publish action: selected because it removes the redundant Finance step while preserving a deliberate publish choice and the existing staff review path.
- Keep Finance approval for everyone: rejected because it retains the friction the change is meant to remove.

## Behavior

New listings are still created as drafts. Owners and Clinic Admins see a separate “Save & Publish” action and can publish their own draft from the listings view. Direct publishing is restricted to a draft created by the acting user. Pending or rejected submissions remain in the Finance review workflow. The backend records direct publication as an approval-history event and sets the approved/published fields needed by public discovery.
