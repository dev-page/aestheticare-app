// Access shared by every clinic staff role. Keep the role editor, frontend
// permission store, backend authorization, and Firestore rule snapshots aligned.
export const defaultClinicRolePermissions = Object.freeze([
  'activities:view',
  'notifications:view',
  'leave:create',
  'overtime:create',
])
