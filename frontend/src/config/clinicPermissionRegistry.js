export const fullAccessPermissionKey = 'administrator:full_access'

export const permissionGroups = [
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    description: 'Branches and the public clinic identity.',
    sections: [
      {
        key: 'branches',
        label: 'Branches',
        description: 'View and create clinic branches.',
        permissions: [
          { key: 'branches:view', label: 'View Branches', description: 'Open branch information pages.', icon: 'mdi:source-branch' },
          { key: 'branches:create', label: 'Create Branches', description: 'Add and configure clinic branches.', icon: 'mdi:map-marker-plus-outline' },
        ],
      },
      {
        key: 'clinic-profile',
        label: 'Clinic Profile',
        description: 'Manage the public clinic profile and page.',
        permissions: [
          { key: 'clinic_profile:view', label: 'View Clinic Profile', description: 'Open clinic profile management.', icon: 'mdi:domain' },
          { key: 'clinic_profile:update', label: 'Update Clinic Profile', description: 'Edit clinic page and public presentation.', icon: 'mdi:file-document-edit-outline' },
        ],
      },
    ],
  },
  {
    key: 'team-management',
    label: 'Team Management',
    description: 'Employees, attendance, and role maintenance.',
    sections: [
      {
        key: 'staff',
        label: 'Employees',
        description: 'Staff profiles and account management.',
        permissions: [
          { key: 'staff:view', label: 'View Staff', description: 'Open employee profiles and staff listings.', icon: 'mdi:account-group-outline' },
          { key: 'staff:create', label: 'Create Staff', description: 'Add employee accounts under the clinic.', icon: 'mdi:account-plus-outline' },
          { key: 'staff:update', label: 'Update Staff', description: 'Edit staff details and role assignments.', icon: 'mdi:account-edit-outline' },
          { key: 'roles:manage', label: 'Manage Roles', description: 'Create roles and manage clinic role permissions.', icon: 'mdi:shield-account-outline', ownerOnly: true },
        ],
      },
      {
        key: 'attendance',
        label: 'Attendance',
        description: 'Attendance logs and QR-based tracking.',
        permissions: [
          { key: 'attendance:view', label: 'View Attendance', description: 'See attendance records and logs.', icon: 'mdi:clipboard-text-clock-outline' },
          { key: 'attendance:create', label: 'Record Attendance', description: 'Record attendance entries and actions.', icon: 'mdi:calendar-check-outline' },
          { key: 'attendance:update', label: 'Correct Attendance', description: 'Correct attendance records with an audit trail.', icon: 'mdi:calendar-edit-outline' },
          { key: 'attendance:import', label: 'Import Attendance', description: 'Import attendance records from the clinic system.', icon: 'mdi:file-upload-outline' },
        ],
      },
    ],
  },
  {
    key: 'crm-clinic',
    label: 'CRM & Clinic',
    description: 'Clients, appointments, consultations, POS, and inbox.',
    sections: [
      {
        key: 'clients',
        label: 'Clients',
        description: 'Client records and profiles.',
        permissions: [
          { key: 'clients:view', label: 'View Clients', description: 'Access client records and profiles.', icon: 'mdi:account-heart-outline' },
          { key: 'clients:create', label: 'Create Clients', description: 'Add new client records.', icon: 'mdi:account-plus-outline' },
        ],
      },
      {
        key: 'appointments',
        label: 'Appointments & Consultations',
        description: 'Scheduling, requests, and online consultations.',
        permissions: [
          { key: 'appointments:view', label: 'View Appointments', description: 'See appointment listings and schedules.', icon: 'mdi:calendar-month-outline' },
          { key: 'appointments:create', label: 'Create Appointments', description: 'Create or reschedule appointments.', icon: 'mdi:calendar-plus-outline' },
          { key: 'appointments:review', label: 'Review Appointment Requests', description: 'Approve or reject appointment requests.', icon: 'mdi:calendar-check-outline' },
          { key: 'consultations:view', label: 'View Online Consultations', description: 'Access online consultation screens.', icon: 'mdi:video-outline' },
        ],
      },
      {
        key: 'payments',
        label: 'Payments & Inbox',
        description: 'POS, transactions, and messaging access.',
        permissions: [
          { key: 'payments:create', label: 'Process POS Payments', description: 'Process POS or payment entries.', icon: 'mdi:cash-register' },
          { key: 'payments:view', label: 'View Transactions', description: 'Open transaction history and sales records.', icon: 'mdi:cash-multiple' },
          { key: 'inbox:view', label: 'View Inbox', description: 'Access branch inbox and messages.', icon: 'mdi:inbox-outline' },
        ],
      },
    ],
  },
  {
    key: 'inventory-operations',
    label: 'Inventory & Operations',
    description: 'Listings, inventory, suppliers, requests, logistics, and orders.',
    sections: [
      {
        key: 'posts',
        label: 'Listings',
        description: 'Product and service listing pages.',
        permissions: [
          { key: 'services:view', label: 'View Listings', description: 'Access product and service listings.', icon: 'mdi:tag-outline' },
          { key: 'services:create', label: 'Create Listings', description: 'Create products, services, consultations, and packages.', icon: 'mdi:tag-plus-outline' },
          { key: 'services:update', label: 'Update Listings', description: 'Edit listing details and package contents.', icon: 'mdi:tag-edit-outline' },
        ],
      },
      {
        key: 'inventory',
        label: 'Supply & Inventory',
        description: 'Catalog, suppliers, requests, logistics, and orders.',
        permissions: [
          { key: 'inventory:view', label: 'View Inventory', description: 'Open suppliers, catalog, and inventory pages.', icon: 'mdi:package-variant-closed' },
          { key: 'suppliers:create', label: 'Create Suppliers', description: 'Create clinic-managed supplier records.', icon: 'mdi:account-plus-outline' },
          { key: 'suppliers:update', label: 'Manage Suppliers', description: 'Edit, activate, deactivate, or archive supplier records.', icon: 'mdi:account-edit-outline' },
          { key: 'inventory:create', label: 'Create Purchase Requests', description: 'Create purchase requests and inventory actions.', icon: 'mdi:cart-plus' },
          { key: 'inventory:review', label: 'Review Purchase Requests', description: 'Approve, reject, and manage purchase requests.', icon: 'mdi:cart-check' },
          { key: 'orders:view', label: 'View Orders', description: 'Open branch order and fulfillment tracking.', icon: 'mdi:cart-outline' },
          { key: 'orders:update', label: 'Update Logistics Orders', description: 'Claim orders and update shipment progress.', icon: 'mdi:truck-check-outline' },
          { key: 'procurement:view', label: 'View Procurement', description: 'View quotes, purchase orders, and manual purchases.', icon: 'mdi:file-document-multiple-outline' },
          { key: 'procurement:create', label: 'Create Procurement Records', description: 'Create supplier quotations, purchase orders, and manual purchases.', icon: 'mdi:file-plus-outline' },
          { key: 'procurement:review', label: 'Review Procurement', description: 'Review and advance procurement records.', icon: 'mdi:file-check-outline' },
        ],
      },
    ],
  },
  {
    key: 'human-resources',
    label: 'Human Resources',
    description: 'Shifts, leave, attendance, and payroll tools.',
    sections: [
      {
        key: 'shifts',
        label: 'Shifts',
        description: 'Shift setup and schedule assignment.',
        permissions: [
          { key: 'hr:view', label: 'View Shift Records', description: 'Open HR records and shift-related pages.', icon: 'mdi:badge-account-outline' },
          { key: 'hr:create', label: 'Add Shift', description: 'Create HR-related shift records.', icon: 'mdi:clipboard-plus-outline' },
          { key: 'hr:update', label: 'Update Shift Assignments', description: 'Modify schedules and assignments.', icon: 'mdi:clipboard-edit-outline' },
        ],
      },
      {
        key: 'leaves',
        label: 'Leave & Overtime',
        description: 'Leave requests and overtime tracking.',
        permissions: [
          { key: 'leave:create', label: 'Submit Leave Requests', description: 'Submit leave requests.', icon: 'mdi:file-plus-outline' },
          { key: 'leave:review', label: 'Manage Leave Requests', description: 'Approve or reject leave requests.', icon: 'mdi:calendar-check-outline' },
          { key: 'overtime:view', label: 'View Overtime', description: 'View overtime records and evidence.', icon: 'mdi:clock-outline' },
          { key: 'overtime:create', label: 'Submit Overtime', description: 'Submit overtime based on attendance.', icon: 'mdi:clock-plus-outline' },
          { key: 'overtime:review', label: 'Approve Overtime', description: 'Approve or reject overtime requests.', icon: 'mdi:clock-check-outline' },
        ],
      },
      {
        key: 'payroll',
        label: 'Payroll',
        description: 'Base pay, payroll management, and payslips.',
        permissions: [
          { key: 'payroll:view', label: 'View Payroll', description: 'Open payroll summaries and approvals.', icon: 'mdi:file-chart-outline' },
          { key: 'payroll:update', label: 'Manage Payroll', description: 'Adjust payroll settings and payslips.', icon: 'mdi:cash-edit' },
          { key: 'payroll:approve', label: 'Approve Payroll', description: 'Approve payroll summaries before payslips are issued.', icon: 'mdi:shield-check-outline' },
        ],
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Sales, reports, refunds, payables, and payroll approvals.',
    sections: [
      {
        key: 'finance-operations',
        label: 'Finance Operations',
        description: 'Purchases, payables, refunds, sales, and reports.',
        permissions: [
          { key: 'finance:purchases:view', label: 'View Purchase History', description: 'Review purchase costs without managing procurement.', icon: 'mdi:package-variant-closed' },
          { key: 'finance:payables:view', label: 'View Accounts Payable', description: 'Review supplier balances, budgets, and settlement status.', icon: 'mdi:cash-minus' },
          { key: 'finance:payables:approve', label: 'Approve Purchase Budgets', description: 'Approve finance budgets for purchase requests.', icon: 'mdi:check-decagram-outline' },
          { key: 'finance:payables:settle', label: 'Settle Supplier Balances', description: 'Record payment and settle delivered purchase variances.', icon: 'mdi:bank-check' },
          { key: 'finance:refunds:view', label: 'View Refunds', description: 'Review refund requests and issued vouchers.', icon: 'mdi:cash-refund' },
          { key: 'finance:refunds:manage', label: 'Manage Refunds', description: 'Approve or reject refunds and issue vouchers.', icon: 'mdi:cash-refund' },
          { key: 'finance:sales:view', label: 'View Sales Ledger', description: 'Review sales transactions and daily reconciliation.', icon: 'mdi:cash-multiple' },
          { key: 'finance:reports:view', label: 'View Financial Reports', description: 'Access profit, cost, payroll, and sales analysis.', icon: 'mdi:chart-box-outline' },
          { key: 'commissions:view', label: 'View Commission Agreements', description: 'View commission terms and notifications.', icon: 'mdi:handshake-outline' },
          { key: 'commissions:manage', label: 'Manage Commission Agreements', description: 'Create and update commission agreements.', icon: 'mdi:handshake-outline' },
        ],
      },
    ],
  },
  {
    key: 'policies',
    label: 'Policies',
    description: 'Manage the clinic rules shown throughout booking and commerce.',
    sections: [{
      key: 'policy-management',
      label: 'Policy Management',
      description: 'Maintain dynamic appointment, service, product, and delivery policies.',
      permissions: [
        { key: 'policies:view', label: 'View Policies', description: 'Read the clinic policy configuration.', icon: 'mdi:text-box-outline' },
        { key: 'policies:update', label: 'Manage Policies', description: 'Create and update clinic policies.', icon: 'mdi:text-box-edit-outline' },
      ],
    }],
  },
  {
    key: 'account-system',
    label: 'Account & System',
    description: 'Subscription, backup, activity, notifications, and support tools.',
    sections: [
      {
        key: 'access',
        label: 'Account Access',
        description: 'Core account controls.',
        permissions: [
          { key: fullAccessPermissionKey, label: 'Administrator Full Access', description: 'Unlock every permission in the clinic workspace.', icon: 'mdi:key-star' },
          { key: 'subscription:view', label: 'View Subscription', description: 'Open the clinic subscription plan screen.', icon: 'mdi:card-outline' },
          { key: 'backup:view', label: 'View Backup', description: 'Access database backup tools.', icon: 'mdi:file-download-outline' },
          { key: 'profile:view', label: 'View Profile', description: 'Open employee profile pages.', icon: 'mdi:card-account-details-outline' },
          { key: 'password:update', label: 'Change Password', description: 'Access password reset and change screens.', icon: 'mdi:shield-key-outline' },
        ],
      },
      {
        key: 'system',
        label: 'System Tools',
        description: 'Logs, notifications, activities, and support.',
        permissions: [
          { key: 'activities:view', label: 'View Activities', description: 'Open user activity pages and logs.', icon: 'mdi:history' },
          { key: 'notifications:view', label: 'View Notifications', description: 'Access in-app notifications.', icon: 'mdi:bell-outline' },
          { key: 'support:view', label: 'View Support', description: 'Open support and issue reporting pages.', icon: 'mdi:lifebuoy' },
        ],
      },
    ],
  },
]

export const allPermissionKeys = [...new Set(permissionGroups.flatMap((group) =>
  group.sections.flatMap((section) => section.permissions.map((permission) => permission.key))
))]

export const permissionLabelMap = permissionGroups.reduce((labels, group) => {
  group.sections.forEach((section) => {
    section.permissions.forEach((permission) => {
      labels[permission.key] = permission.label
    })
  })
  return labels
}, {})

export const permissionDependencies = {
  'branches:create': ['branches:view'],
  'clinic_profile:update': ['clinic_profile:view'],
  'clients:create': ['clients:view'],
  'appointments:create': ['appointments:view'],
  'appointments:review': ['appointments:view'],
  'payments:create': ['payments:view'],
  'inventory:create': ['inventory:view'],
  'inventory:review': ['inventory:view'],
  'hr:create': ['hr:view'],
  'hr:update': ['hr:view'],
  'leave:create': ['hr:view'],
  'leave:review': ['hr:view'],
  'overtime:view': ['hr:view'],
  'overtime:create': ['overtime:view'],
  'overtime:review': ['overtime:view', 'attendance:view'],
  'payroll:update': ['payroll:view', 'overtime:view'],
  'payroll:approve': ['payroll:view'],
  'finance:payables:approve': ['finance:payables:view'],
  'finance:payables:settle': ['finance:payables:view'],
  'finance:refunds:manage': ['finance:refunds:view'],
}

export const permissionFeatureMap = {
  'staff:view': 'staff_management',
  'staff:create': 'staff_management',
  'staff:update': 'staff_management',
  'roles:manage': 'staff_management',
  'attendance:view': 'attendance',
  'attendance:create': 'attendance',
  'branches:view': 'multi_branch',
  'branches:create': 'multi_branch',
  'appointments:view': 'appointments',
  'appointments:create': 'appointments',
  'appointments:review': 'appointments',
  'clients:view': 'appointments',
  'clients:create': 'appointments',
  'consultations:view': 'online_consultations',
  'payments:view': 'reports',
  'payments:create': 'pos_payments',
  'reports:view': 'reports',
  'inventory:view': 'inventory',
  'inventory:create': 'inventory',
  'inventory:review': 'inventory',
  'services:view': 'services',
  'hr:view': 'hr',
  'hr:create': 'hr',
  'hr:update': 'hr',
  'leave:create': 'hr',
  'leave:review': 'hr',
  'overtime:view': 'hr',
  'overtime:create': 'hr',
  'overtime:review': 'hr',
  'payroll:view': 'payroll',
  'payroll:update': 'payroll',
  'payroll:approve': 'payroll',
  'finance:purchases:view': 'inventory',
  'finance:payables:view': 'reports',
  'finance:payables:approve': 'reports',
  'finance:payables:settle': 'reports',
  'finance:refunds:view': 'reports',
  'finance:refunds:manage': 'reports',
  'finance:sales:view': 'reports',
  'finance:reports:view': 'reports',
}

export const knownPermissionKeys = new Set(allPermissionKeys)
