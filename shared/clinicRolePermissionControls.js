const permission = (key, label, description, icon, grants, legacyAny = grants) => ({
  key: `page:${key}`,
  label,
  description,
  icon,
  grants,
  legacyAny,
})

export const clinicRolePermissionGroups = [
  {
    key: 'clinic-setup', label: 'Clinic Setup', description: 'Control access to clinic details, branches, and policies.', sections: [
      { key: 'branches', label: 'Branches', description: 'View branches separately from changing branch settings.', permissions: [
        permission('branches:view', 'View Branches', 'View branch details and assigned locations.', 'mdi:source-branch', ['branches:view'], ['branches:view', 'branches:create']),
        permission('branches:manage', 'Edit & Create Branches', 'Add or edit branches and link clinic policies to them.', 'mdi:map-marker-plus-outline', ['branches:view', 'branches:create', 'branches:update', 'branches:policies:link'], ['branches:create', 'branches:update', 'branches:policies:link']),
      ] },
      { key: 'clinic-profile', label: 'Clinic Profile & Policies', description: 'Manage the public clinic profile and clinic-wide policies.', permissions: [
        permission('clinic-profile:manage', 'Manage Clinic Profile', 'Open and update the clinic profile and public clinic page.', 'mdi:domain', ['clinic_profile:view', 'clinic_profile:update'], ['clinic_profile:view', 'clinic_profile:update']),
        permission('policies:manage', 'Manage Policies and Contract', 'View and update clinic policies, agreements, and contract terms.', 'mdi:file-document-edit-outline', ['policies:view', 'policies:update'], ['policies:view', 'policies:update']),
      ] },
    ],
  },
  {
    key: 'crm-clinic', label: 'CRM & Clinic', description: 'Control access to client records, appointments, prescriptions, and messages.', sections: [
      { key: 'client-care', label: 'Client Care', description: 'Choose the customer-facing clinic pages this role can use.', permissions: [
        permission('clients:view', 'View Client List', 'Open the client list and client profiles.', 'mdi:account-heart-outline', ['clients:view'], ['clients:view']),
        permission('walk-in:manage', 'Manage Walk-In Clients', 'Use the Walk-In Desk to register clients, book visits, and take walk-in payments.', 'mdi:walk', ['clients:view', 'clients:update', 'appointments:view', 'appointments:create', 'appointments:update', 'payments:create'], ['appointments:create']),
        permission('appointments:manage', 'Manage Appointments', 'View appointment schedules and process appointment and consultation updates.', 'mdi:calendar-month-outline', ['appointments:view', 'appointments:update', 'appointments:review', 'consultations:view', 'consultations:create'], ['appointments:view', 'appointments:update', 'appointments:review', 'consultations:view']),
        permission('prescriptions:manage', 'Manage Prescriptions', 'Review consultation prescriptions and prepare eligible items for pharmacy pickup.', 'mdi:prescription', ['consultations:view'], ['consultations:view']),
      ] },
      { key: 'transactions-messages', label: 'Transactions & Messages', description: 'Access clinic transaction history and the inbox.', permissions: [
        permission('transactions:view', 'View Transactions', 'Review customer transaction and payment history.', 'mdi:receipt-text-outline', ['payments:view', 'finance:sales:view'], ['payments:view']),
        permission('inbox:manage', 'Manage Inbox', 'Open the clinic inbox and respond to customer messages.', 'mdi:inbox-outline', ['inbox:view'], ['inbox:view']),
      ] },
    ],
  },
  {
    key: 'human-resources', label: 'Human Resource', description: 'Manage roles, staff setup, leave, and overtime.', sections: [
      { key: 'employee-admin', label: 'Employee Administration', description: 'Manage clinic roles, employee records, schedules, and compensation.', permissions: [
        permission('roles:manage', 'Manage Roles', 'Create clinic roles, assign permissions, and maintain role details.', 'mdi:shield-account-outline', ['roles:manage'], ['roles:manage']),
        permission('employees:manage', 'Manage Employee Accounts', 'View, create, edit, and archive employee accounts; manage attendance, shifts, assignments, base pay, and service commissions.', 'mdi:account-group-outline', ['staff:view', 'staff:create', 'staff:update', 'staff:disable', 'attendance:view', 'attendance:create', 'attendance:update', 'attendance:import', 'hr:view', 'hr:create', 'hr:update', 'payroll:view', 'payroll:update'], ['staff:view', 'staff:create', 'staff:update', 'staff:disable', 'attendance:view', 'hr:view', 'hr:update', 'payroll:view', 'payroll:update']),
      ] },
      { key: 'leave-overtime', label: 'Leave & Overtime', description: 'Review team requests or allow staff to submit their own.', permissions: [
        permission('leave-overtime:manage', 'Manage Overtime and Leave Requests', 'Review leave and overtime requests together on one management page.', 'mdi:calendar-clock-outline', ['leave:review', 'overtime:view', 'overtime:review', 'attendance:view'], ['leave:review', 'overtime:review']),
        permission('leave:request', 'Request Leave', 'Submit and manage the employee’s own leave requests.', 'mdi:calendar-arrow-right', ['leave:create'], ['leave:create']),
        permission('overtime:request', 'Request Overtime', 'Submit overtime requests based on the employee’s recorded attendance.', 'mdi:timer-plus-outline', ['overtime:create'], ['overtime:create']),
      ] },
    ],
  },
  {
    key: 'finance', label: 'Finance', description: 'Review listings, supplier costs, expenses, and payroll.', sections: [
      { key: 'financial-approvals', label: 'Approvals & Records', description: 'Give access to the financial work area each role needs.', permissions: [
        permission('listings:approve', 'Approve Service Listings', 'Review submitted service, consultation, and package prices and payment terms.', 'mdi:tag-check-outline', ['services:view', 'services:review'], ['services:review']),
        permission('purchase-orders:approve', 'Approve Purchase Orders', 'Review purchase orders and approve, reject, or return them for changes.', 'mdi:clipboard-check-outline', ['finance:payables:view', 'finance:payables:approve'], ['finance:payables:approve']),
        permission('payroll:manage', 'Manage Payrolls', 'Prepare payroll and review payroll approvals and payslips.', 'mdi:calculator', ['payroll:view', 'payroll:update', 'payroll:approve'], ['payroll:view', 'payroll:update', 'payroll:approve']),
        permission('supplier-invoices:manage', 'Manage Supplier Invoices', 'Review supplier invoices, verify deliveries, and record supplier payments.', 'mdi:receipt-text-check-outline', ['finance:invoices:view', 'finance:invoices:manage', 'finance:invoices:settle'], ['finance:payables:view', 'finance:payables:approve', 'finance:payables:settle']),
        permission('other-expenses:manage', 'Manage Other Expenses', 'View, record, and pay the clinic’s non-supplier operating expenses.', 'mdi:cash-minus', ['finance:expenses:view', 'finance:expenses:manage', 'finance:expenses:settle'], ['finance:expenses:view', 'finance:expenses:manage', 'finance:expenses:settle']),
      ] },
    ],
  },
  {
    key: 'services', label: 'Services', description: 'Manage clinic listings and archived posts.', sections: [
      { key: 'service-listings', label: 'Service Listings', description: 'Create and maintain services, consultations, and packages.', permissions: [
        permission('services:manage', 'Manage Service Listings', 'Create and edit clinic services, consultations, and packages, and open archived posts.', 'mdi:format-list-bulleted', ['services:view', 'services:create', 'services:update', 'services:disable'], ['services:view', 'services:create', 'services:update', 'services:disable']),
      ] },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', description: 'Manage clinic supplies, stock records, and deliveries.', sections: [
      { key: 'stock', label: 'Inventory', description: 'View and maintain the branch inventory and stock history.', permissions: [
        permission('inventory:manage', 'Manage Inventory', 'View stock, submit supply requests, inspect deliveries, and update inventory records.', 'mdi:package-variant-closed', ['inventory:view', 'inventory:create', 'inventory:update', 'inventory:disable', 'inventory:review'], ['inventory:view', 'inventory:create', 'inventory:update']),
      ] },
    ],
  },
  {
    key: 'pharmacy', label: 'Pharmacy', description: 'Access pharmacy stock and dispensing tools.', sections: [
      { key: 'pharmacy-operations', label: 'Pharmacy', description: 'Manage pharmacy items, prices, and dispensing.', permissions: [
        permission('pharmacy:manage', 'Manage Pharmacy', 'View pharmacy stock, maintain item setup, and dispense eligible items.', 'mdi:store-check-outline', ['pharmacy:view', 'pharmacy:dispense', 'pharmacy:manage'], ['pharmacy:view', 'pharmacy:manage']),
      ] },
    ],
  },
  {
    key: 'procurement', label: 'Procurement', description: 'Manage suppliers, supply requests, and purchase orders.', sections: [
      { key: 'supplier-procurement', label: 'Suppliers & Orders', description: 'Give access to the supplier directory and purchasing workflow.', permissions: [
        permission('suppliers:manage', 'Manage Suppliers', 'View the supplier directory and maintain clinic supplier contacts.', 'mdi:truck-delivery-outline', ['suppliers:create', 'suppliers:update'], ['suppliers:create', 'suppliers:update']),
        permission('inventory-requests:manage', 'Manage Inventory Requests', 'Review incoming supply requests, confirm item and supplier details, and send them to Finance.', 'mdi:clipboard-text-outline', ['procurement:requests:view', 'procurement:requests:manage'], ['procurement:review']),
        permission('procurement-orders:manage', 'Manage Purchase Orders', 'Prepare purchase orders, record supplier responses, and advance approved orders.', 'mdi:cart-check', ['procurement:orders:view', 'procurement:orders:manage'], ['procurement:create', 'procurement:review']),
      ] },
    ],
  },
  {
    key: 'account-settings', label: 'Account Settings', description: 'Manage personal account tools and clinic-level settings.', sections: [
      { key: 'account-access', label: 'Account Tools', description: 'Manage the account pages and clinic settings available to this role.', permissions: [
        permission('account:manage', 'Manage Account', 'Open profile, change password, notifications, activities, and report-issue pages.', 'mdi:account-cog-outline', ['profile:view', 'password:update', 'notifications:view', 'activities:view', 'support:report'], ['profile:view', 'password:update', 'activities:view', 'notifications:view']),
        permission('subscription:manage', 'Manage Clinic Subscription', 'View clinic subscription details and available plan actions.', 'mdi:card-account-details-star-outline', ['subscription:view'], ['subscription:view']),
        permission('backups:manage', 'Manage Clinic Backup', 'View backup history and create clinic database exports.', 'mdi:database-export-outline', ['backups:view', 'backups:create'], ['backups:view']),
      ] },
    ],
  },
]

export const clinicRolePermissionControls = clinicRolePermissionGroups.flatMap(group =>
  group.sections.flatMap(section => section.permissions)
)

export const clinicRolePagePermissionKeys = clinicRolePermissionControls.map(item => item.key)
export const clinicRolePermissionGrants = [...new Set(clinicRolePermissionControls.flatMap(item => item.grants))]

export const expandClinicRolePermissions = (permissions = []) => {
  const expanded = new Set(Array.isArray(permissions) ? permissions : [])
  clinicRolePermissionControls.forEach(control => {
    if (!expanded.has(control.key)) return
    control.grants.forEach(grant => expanded.add(grant))
  })
  return [...expanded]
}

export const inferClinicRolePagePermissions = (permissions = []) => {
  const granted = new Set(Array.isArray(permissions) ? permissions : [])
  return clinicRolePermissionControls
    .filter(control => control.legacyAny.some(permissionKey => granted.has(permissionKey)))
    .map(control => control.key)
}
