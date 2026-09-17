export const buildClinicSidebarItems = ({ dashboardTo = '/owner/dashboard', isEmployee = false } = {}) => [
  { label: 'Dashboard', icon: 'dashboard', to: dashboardTo },
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    icon: 'mdi:hospital-building',
    children: [
      { label: 'Branch Info', icon: 'mdi:map-marker-outline', to: '/owner/branch/branch-info', permission: 'branches:view' },
      { label: 'Add Branch', icon: 'mdi:office-building-plus-outline', to: '/owner/branch/add-branch', feature: 'multi_branch', permission: 'branches:create' },
      { label: 'Clinic Page', icon: 'mdi:web', to: '/owner/clinic-page', permission: 'clinic_profile:update' }
    ]
  },
  {
    key: 'clinic-module',
    label: 'CRM & Clinic',
    icon: 'mdi:medical-bag',
    moduleKey: 'crm',
    children: [
      { type: 'section', label: 'CLIENTS' },
      { label: 'Client List', icon: 'mdi:account-multiple-outline', to: '/receptionist/clients', permission: 'clients:view' },
      { label: 'Walk-In', icon: 'mdi:walk', to: '/receptionist/clients/add', permission: 'clients:create' },
      { type: 'section', label: 'APPOINTMENTS' },
      { label: 'Appointments', icon: 'mdi:calendar-month-outline', to: '/receptionist/appointments', permission: 'appointments:view' },
      { label: 'Booking Requests', icon: 'mdi:calendar-question', to: '/receptionist/appointment-requests', permission: 'appointments:review' },
      { label: 'Online Consultation', icon: 'mdi:video-outline', to: '/practitioner/consultations/online', feature: 'online_consultations', permission: 'consultations:view' },
      { type: 'section', label: 'PAYMENTS & MESSAGES' },
      { label: 'POS', icon: 'mdi:cash-register', to: '/receptionist/pos', permission: 'payments:create' },
      { label: 'Transactions', icon: 'mdi:receipt-text-outline', to: '/receptionist/transactions/history', permission: 'payments:view' },
      { type: 'section', label: 'ORDERS' },
      { label: 'Customer Orders', icon: 'mdi:shopping-outline', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'] },
      { label: 'Inbox', icon: 'mdi:email-outline', to: '/receptionist/inbox', permission: 'inbox:view' }
    ]
  },
  { label: 'Product & Service Listing', icon: 'mdi:format-list-bulleted', to: '/manager/product-service-listing', moduleKey: 'operations', permission: 'services:view' },
  {
    key: 'inventory-module',
    label: 'Inventory Management',
    icon: 'mdi:warehouse',
    moduleKey: 'inventory',
    children: [
      { type: 'section', label: 'POSTS' },
      { label: 'Archived Posts', icon: 'mdi:archive-outline', to: '/manager/archived-posts', permission: 'services:view' },
      { label: 'Item Catalog', icon: 'mdi:package-variant-closed', to: '/manager/item-catalog', permission: 'inventory:view' }
    ]
  },
  { label: 'Suppliers', icon: 'mdi:truck-delivery-outline', to: '/manager/suppliers', permission: 'inventory:view' },
  {
    key: 'procurement-module',
    label: 'Procurement',
    icon: 'mdi:cart-outline',
    moduleKey: 'procurement',
    children: [
      { type: 'section', label: 'PURCHASING' },
      { label: 'Procurement', icon: 'mdi:cart-outline', to: '/manager/procurement', permissionsAny: ['procurement:view', 'procurement:create', 'procurement:review'] },
      { label: 'Purchase Requests', icon: 'mdi:cart-plus', to: '/manager/purchase-requests', permission: 'inventory:view' },
      { label: 'Purchase History', icon: 'mdi:history', to: '/manager/purchase-history', permission: 'finance:purchases:view' },
    ]
  },
  { label: 'Logistics', icon: 'truck', to: '/manager/logistics', permissionsAny: ['orders:view', 'inventory:view'] },
  {
    key: 'hr-module',
    label: 'Human Resources',
    icon: 'users',
    moduleKey: 'hr',
    children: [
      { type: 'section', label: 'EMPLOYEES' },
      { label: 'Employee Profiles', icon: 'mdi:card-account-details-outline', to: '/owner/staff/profiles', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Create Account', icon: 'mdi:account-plus-outline', to: '/owner/staff/add-staff', feature: 'staff_management', permission: 'staff:create' },
      { label: 'Archived Employees', icon: 'mdi:account-off-outline', to: '/owner/staff/archived', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Attendance', icon: 'mdi:calendar-check-outline', to: '/owner/staff/attendance', feature: 'attendance', permission: 'attendance:view' },
      { type: 'section', label: 'ROLES & REPORTING' },
      { label: 'Roles', icon: 'mdi:shield-account-outline', to: '/owner/staff/roles', feature: 'staff_management', permission: 'roles:manage', ownerOnly: true },
      { label: 'HR Reports', icon: 'mdi:chart-box-outline', to: '/owner/reports', feature: 'reports', permission: 'reports:view' },
      { type: 'section', label: 'SHIFTS' },
      { label: 'Add Shift', icon: 'mdi:clock-plus-outline', to: '/hr/add-shift', feature: 'hr', permission: 'hr:create' },
      { label: 'Shift Assignment', icon: 'mdi:calendar-account-outline', to: '/hr/schedule-assignment', feature: 'hr', permission: 'hr:update' },
      { type: 'section', label: 'LEAVE & OVERTIME' },
      { label: 'Leave Management', icon: 'mdi:calendar-clock-outline', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' },
      { label: 'Leave Request', icon: 'mdi:calendar-arrow-right', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create' },
      { label: 'Overtime Request', icon: 'mdi:timer-plus-outline', to: '/hr/overtime', feature: 'hr', permissionsAny: ['overtime:view', 'overtime:create'] },
      { type: 'section', label: 'PAYROLL' },
      { label: 'Base Pay', icon: 'mdi:cash', to: '/hr/base-pay', feature: 'payroll', permission: 'payroll:update' },
      { label: 'Payroll Management', icon: 'mdi:calculator', to: '/hr/payroll', feature: 'payroll', permission: 'payroll:update' },
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance',
    icon: 'mdi:finance',
    moduleKey: 'finance',
    children: [
      { label: 'Listing Approvals', icon: 'mdi:clipboard-check-outline', to: '/finance/listing-approvals', permission: 'finance:reports:view' },
      { label: 'Finance Dashboard', icon: 'mdi:chart-pie', to: '/finance/dashboard', feature: 'reports', permission: 'finance:reports:view' },
      { type: 'section', label: 'INCOME & PAYMENTS' },
      { label: 'Income & Payments', icon: 'mdi:cash-plus', to: '/finance/sales', feature: 'reports', permission: 'finance:sales:view' },
      { type: 'section', label: 'EXPENSES & BUDGET' },
      { label: 'Expenses & Payables', icon: 'mdi:cash-minus', to: '/finance/accounts-payable', feature: 'reports', permission: 'finance:payables:view' },
      { label: 'Purchase Budget Tracking', icon: 'mdi:chart-donut', to: '/finance/budget', feature: 'reports', permission: 'finance:payables:view' },
      { type: 'section', label: 'PAYROLL' },
      { label: 'Payroll Summary', icon: 'mdi:file-table-outline', to: '/finance/payroll-summary', feature: 'payroll', permission: 'payroll:view' },
      { label: 'Payroll Approval', icon: 'mdi:file-check-outline', to: '/finance/payroll-approval', feature: 'payroll', permission: 'payroll:approve' },
      { type: 'section', label: 'FINANCE OPERATIONS' },
      { label: 'Refunds', icon: 'mdi:cash-refund', to: '/finance/refunds', feature: 'reports', permission: 'finance:refunds:view' },
      { label: 'Financial Reports', icon: 'mdi:file-chart-outline', to: '/finance/reports', feature: 'reports', permission: 'finance:reports:view' }
    ]
  },
  { label: 'Policy Management', icon: 'mdi:file-document-outline', to: '/owner/policies', permissionsAny: ['policies:view', 'policies:update'] },
  {
    key: 'account',
    label: 'Account Settings',
    icon: 'settings',
    children: [
      { label: 'Profile', icon: 'profile', to: isEmployee ? '/employee/profile' : '/owner/clinic-profile' },
      { label: 'Change Password', icon: 'key', to: '/change-password' },
      ...(!isEmployee ? [
        { label: 'Subscription Plan', icon: 'mdi:card-account-details-star-outline', to: '/owner/account/subscription', permission: 'subscription:view' },
        { label: 'Account Access', icon: 'account-off', to: '/owner/account/closure', permission: 'subscription:view' },
        { label: 'Backup Database', icon: 'mdi:database-export-outline', to: '/owner/account/backup', permission: 'backup:view' },
        { label: 'Activities', icon: 'mdi:clipboard-text-clock-outline', to: '/activities', permission: 'activities:view' },
      ] : []),
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]
  }
]
