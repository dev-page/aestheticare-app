export const buildClinicSidebarItems = ({ dashboardTo = '/owner/dashboard' } = {}) => [
  { label: 'Dashboard', icon: 'dashboard', to: dashboardTo },
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    icon: 'clinic',
    children: [
      { label: 'Branch Info', icon: 'map', to: '/owner/branch/branch-info', permission: 'branches:view' },
      { label: 'Add Branch', icon: 'plus', to: '/owner/branch/add-branch', feature: 'multi_branch', permission: 'branches:create' },
      { label: 'Clinic Page', icon: 'layout', to: '/owner/clinic-page', permission: 'clinic_profile:update' }
    ]
  },
  {
    key: 'team-management',
    label: 'Team Management',
    icon: 'users',
    feature: 'staff_management',
    children: [
      { label: 'Employee Profiles', icon: 'profile', to: '/owner/staff/profiles', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Add Employee', icon: 'userplus', to: '/owner/staff/add-staff', feature: 'staff_management', permission: 'staff:create' },
      { label: 'Approve Employees', icon: 'shield', to: '/owner/staff/approve', feature: 'staff_management', permission: 'staff:update' },
      { label: 'Archived Employees', icon: 'archive', to: '/owner/staff/archived', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Attendance', icon: 'calendar', to: '/owner/staff/attendance', feature: 'attendance', permission: 'attendance:view' },
      { label: 'Role Management', icon: 'shield', to: '/owner/staff/roles', feature: 'staff_management', permission: 'roles:view' }
    ]
  },
  {
    key: 'clinic-module',
    label: 'Clinic Workspace',
    icon: 'clinic',
    moduleKey: 'clinic',
    children: [
      { type: 'section', label: 'CLIENTS' },
      { label: 'Client List', icon: 'profile', to: '/receptionist/clients', permission: 'clients:view' },
      { label: 'Add Client', icon: 'userplus', to: '/receptionist/clients/add', permission: 'clients:create' },
      { type: 'section', label: 'APPOINTMENTS' },
      { label: 'Appointments', icon: 'calendar', to: '/receptionist/appointments', permission: 'appointments:view' },
      { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review' },
      { label: 'Online Consultation', icon: 'clinic', to: '/practitioner/consultations/online', feature: 'online_consultations', permission: 'consultations:view' },
      { type: 'section', label: 'PAYMENTS & MESSAGES' },
      { label: 'POS', icon: 'card', to: '/receptionist/pos', permission: 'payments:create' },
      { label: 'Transactions', icon: 'report', to: '/receptionist/transactions/history', permission: 'payments:view' },
      { label: 'Inbox', icon: 'bell', to: '/receptionist/inbox', permission: 'inbox:view' }
    ]
  },
  {
    key: 'operations-module',
    label: 'Products & Services',
    icon: 'tag',
    moduleKey: 'operations',
    children: [
      { type: 'section', label: 'POSTS' },
      { label: 'Product & Service Listing', icon: 'layout', to: '/manager/product-service-listing', permission: 'services:view' },
      { label: 'Archived Posts', icon: 'archive', to: '/manager/archived-posts', permission: 'services:view' },
      { type: 'section', label: 'SUPPLY & INVENTORY' },
      { label: 'Item Catalog', icon: 'building', to: '/manager/item-catalog', permission: 'inventory:view' },
      { label: 'Suppliers', icon: 'building', to: '/manager/suppliers', permission: 'inventory:view' },
      { label: 'Purchase Requests', icon: 'plus', to: '/manager/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'] },
      { label: 'Orders', icon: 'report', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'] }
    ]
  },
  {
    key: 'hr-module',
    label: 'HR Workspace',
    icon: 'users',
    moduleKey: 'hr',
    feature: 'hr',
    children: [
      { type: 'section', label: 'SHIFTS' },
      { label: 'Add Shift', icon: 'plus', to: '/hr/add-shift', feature: 'hr', permission: 'hr:create' },
      { label: 'Shift Assignment', icon: 'calendar', to: '/hr/schedule-assignment', feature: 'hr', permission: 'hr:update' },
      { type: 'section', label: 'LEAVES' },
      { label: 'Leave Management', icon: 'clipboard', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' },
      { label: 'Leave Request', icon: 'file', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create' },
      { type: 'section', label: 'PAYROLL' },
      { label: 'Base Pay', icon: 'card', to: '/hr/base-pay', feature: 'payroll', permission: 'payroll:update' },
      { label: 'Payroll Management', icon: 'card', to: '/hr/payroll', feature: 'payroll', permission: 'payroll:update' },
      { label: 'Payslip Generation', icon: 'file', to: '/hr/payslip-generation', feature: 'payroll', permission: 'payroll:update' }
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance Workspace',
    icon: 'card',
    moduleKey: 'finance',
    feature: 'reports',
    children: [
      { type: 'section', label: 'PAYROLL' },
      { label: 'Payroll Summary', icon: 'card', to: '/finance/payroll-summary', feature: 'payroll', permission: 'payroll:view' },
      { label: 'Payroll Approval', icon: 'shield', to: '/finance/payroll-approval', feature: 'payroll', permission: 'payroll:view' },
      { type: 'section', label: 'FINANCE OPERATIONS' },
      { label: 'Inventory Purchases', icon: 'building', to: '/finance/inventory-purchases', feature: 'reports', permission: 'inventory:view' },
      { label: 'Accounts Payable', icon: 'card', to: '/finance/accounts-payable', feature: 'reports', permission: 'inventory:view' },
      { label: 'Refunds', icon: 'card', to: '/finance/refunds', feature: 'reports', permission: 'payments:view' },
      { label: 'Sales', icon: 'report', to: '/finance/sales', feature: 'reports', permission: 'reports:view' },
      { label: 'Reports', icon: 'report', to: '/finance/reports', feature: 'reports', permission: 'reports:view' }
    ]
  },
  {
    key: 'account',
    label: 'Account & System',
    icon: 'settings',
    children: [
      { label: 'Reset Password', icon: 'key', to: '/owner/change-password', permission: 'password:update' },
      { label: 'Subscription Plan', icon: 'card', to: '/owner/account/subscription', permission: 'subscription:view' },
      { label: 'Account Closure', icon: 'account-off', to: '/owner/account/closure', permission: 'subscription:view' },
      { label: 'Backup Database', icon: 'file', to: '/owner/account/backup', permission: 'backup:view' },
      { label: 'Activities', icon: 'report', to: '/activities', permission: 'activities:view' },
      { label: 'Notifications', icon: 'bell', to: '/notifications', permission: 'notifications:view' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', permission: 'support:view' }
    ]
  }
]
