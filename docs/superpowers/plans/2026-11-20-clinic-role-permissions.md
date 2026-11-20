# Clinic role permission implementation plan

- **Goal:** Replace low-level role switches with the requested page-level controls and enforce them in the clinic sidebar and router.
- **Architecture:** Keep a shared page-control-to-action-grant map. The role editor stores page keys plus grants; the API continues checking grants. Legacy role records gain inferred page access until explicitly saved.
- **Tech stack:** Vue 3, Pinia, Vue Router, shared ESM permission definitions, Firebase-backed clinic role documents, Express API.
- **Spec path:** `docs/superpowers/specs/2026-11-20-clinic-role-permissions.md`
- **Global constraints:** Preserve server authorization, branch scope, subscription feature gates, and owner-only account closure. Do not grant platform-wide administrator access.
- **Review focus:** Toggle off must remove page and direct URL access; overlapping finance actions must not reveal unrelated pages; Clinic Admin must retain all clinic access; leave and overtime review must be available together.

## Steps

1. Define shared page controls, action grants, legacy access inference, and the requested role-editor descriptions.
2. Update the role editor to show page controls, normalize grants, and save the new permission format.
3. Update permission resolution, role validation, staff snapshots, and Clinic Admin grants.
4. Apply the page keys to clinic sidebar entries and all corresponding route guards, including dynamic supply routes and Finance tabs.
5. Disable branch Edit/Link Policy actions without branch-management permission and combine leave/overtime management into one page.
6. Review the changed permission paths and report the verification boundary.
