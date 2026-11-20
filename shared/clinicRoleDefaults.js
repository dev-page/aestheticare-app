// Access shared by every clinic staff role. Keep the role editor, frontend
// permission store, backend authorization, and Firestore rule snapshots aligned.
// Clinic page access is intentionally role-controlled. Employees receive no
// default-on permissions that could bypass an unchecked role switch.
export const defaultClinicRolePermissions = Object.freeze([])
