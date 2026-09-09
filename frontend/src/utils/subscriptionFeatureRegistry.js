export const DEFAULT_SUBSCRIPTION_FEATURES = [
  { key: 'multi_branch', label: 'Multi-Branch', description: 'Add and manage multiple branches.', module: 'Clinic', isActive: true },
  { key: 'staff_management', label: 'Staff Management', description: 'Create and manage staff accounts.', module: 'HR', isActive: true },
  { key: 'appointments', label: 'Appointments', description: 'Scheduling, rescheduling, and appointment management.', module: 'Booking', isActive: true },
  { key: 'pos_payments', label: 'POS & Payments', description: 'Collect payments and manage POS.', module: 'Finance', isActive: true },
  { key: 'inventory', label: 'Inventory', description: 'Suppliers, catalog, purchases, and stock.', module: 'Inventory', isActive: true },
  { key: 'services', label: 'Services & Posts', description: 'Manage services, products, and posts.', module: 'Services', isActive: true },
  { key: 'online_consultations', label: 'Online Consultations', description: 'Enable online consultations.', module: 'Consultation', isActive: true },
  { key: 'reports', label: 'Reports', description: 'Access analytics and finance reports.', module: 'Finance', isActive: true },
  { key: 'hr', label: 'HR', description: 'Employee records, shifts, and attendance management.', module: 'HR', isActive: true },
  { key: 'payroll', label: 'Payroll', description: 'Payroll processing and payslips.', module: 'Finance', isActive: true },
  { key: 'attendance', label: 'Attendance', description: 'Attendance monitoring and logs.', module: 'HR', isActive: true },
  { key: 'dss', label: 'DSS', description: 'Decision support recommendations.', module: 'Reports', isActive: true },
]

export const normalizeSubscriptionFeature = (feature = {}, fallback = {}) => {
  const key = String(feature.key || fallback.key || '').trim().toLowerCase()
  const label = String(feature.label || fallback.label || key).trim()
  return {
    ...fallback,
    ...feature,
    key,
    label: label || key,
    description: String(feature.description || fallback.description || '').trim(),
    module: String(feature.module || fallback.module || 'Other').trim() || 'Other',
    isActive: feature.isActive !== false && fallback.isActive !== false,
  }
}

export const buildSubscriptionFeatureRegistry = (snapshotDocs = []) => {
  const databaseFeatures = new Map(snapshotDocs.map((docSnap) => [docSnap.id, docSnap.data() || {}]))
  const defaultKeys = new Set(DEFAULT_SUBSCRIPTION_FEATURES.map((feature) => feature.key))
  const defaults = DEFAULT_SUBSCRIPTION_FEATURES.map((feature) =>
    normalizeSubscriptionFeature(
      { ...feature, ...databaseFeatures.get(feature.key), key: feature.key },
      feature,
    ),
  )
  const custom = snapshotDocs
    .filter((docSnap) => !defaultKeys.has(docSnap.id))
    .map((docSnap) => normalizeSubscriptionFeature({ ...docSnap.data(), key: docSnap.id }))
    .filter((feature) => feature.key)

  return [...defaults, ...custom].sort((a, b) => a.label.localeCompare(b.label))
}
