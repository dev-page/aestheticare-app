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
    key: 'clinic-module',
    label: 'CRM & Clinic',
    icon: 'clinic',
    moduleKey: 'crm',
    children: [
      { type: 'section', label: 'CLIENTS' },
      { label: 'Client List', icon: 'profile', to: '/receptionist/clients', permission: 'clients:view' },
      { label: 'Add Client', icon: 'userplus', to: '/receptionist/clients/add', permission: 'clients:create' },
      { type: 'section', label: 'APPOINTMENTS' },
      { label: 'Bookings', icon: 'calendar-multiple', to: '/receptionist/bookings', permission: 'appointments:view' },
      { label: 'Appointments', icon: 'calendar', to: '/receptionist/appointments', permission: 'appointments:view' },
      { label: 'Appointment Requests', icon: 'calendar-check', to: '/receptionist/appointment-requests', permission: 'appointments:review' },
      { label: 'Online Consultation', icon: 'clinic', to: '/practitioner/consultations/online', feature: 'online_consultations', permission: 'consultations:view' },
      { type: 'section', label: 'PAYMENTS & MESSAGES' },
      { label: 'POS', icon: 'card', to: '/receptionist/pos', permission: 'payments:create' },
      { label: 'Transactions', icon: 'report', to: '/receptionist/transactions/history', permission: 'payments:view' },
      { type: 'section', label: 'ORDERS' },
      { label: 'Customer Orders', icon: 'report', to: '/manager/orders', permissionsAny: ['orders:view', 'inventory:view'] },
      { label: 'Inbox', icon: 'bell', to: '/receptionist/inbox', permission: 'inbox:view' }
    ]
  },
  {
    key: 'inventory-module',
    label: 'Inventory Management',
    icon: 'tag',
    moduleKey: 'inventory',
    children: [
      { type: 'section', label: 'POSTS' },
      { label: 'Product & Service Listing', icon: 'layout', to: '/manager/product-service-listing', permission: 'services:view' },
      { label: 'Archived Posts', icon: 'archive', to: '/manager/archived-posts', permission: 'services:view' },
      { label: 'Item Catalog', icon: 'building', to: '/manager/item-catalog', permission: 'inventory:view' },
      { label: 'Purchase History', icon: 'report', to: '/manager/purchase-history', permission: 'finance:purchases:view' }
    ]
  },
  {
    key: 'supply-chain-module',
    label: 'Supply Chain Management',
    icon: 'building',
    moduleKey: 'supply-chain',
    children: [
      { type: 'section', label: 'SUPPLIERS' },
      { label: 'Suppliers', icon: 'building', to: '/manager/suppliers', permission: 'inventory:view' },
    ]
  },
  {
    key: 'procurement-module',
    label: 'Procurement',
    icon: 'report',
    moduleKey: 'procurement',
    children: [
      { type: 'section', label: 'PURCHASING' },
      { label: 'Procurement', icon: 'report', to: '/manager/procurement', permissionsAny: ['procurement:view', 'procurement:create', 'procurement:review'] },
      { label: 'Purchase Requests', icon: 'plus', to: '/manager/purchase-requests', permissionsAny: ['inventory:create', 'inventory:review'] },
    ]
  },
  {
    key: 'logistics-module',
    label: 'Logistics',
    icon: 'truck',
    moduleKey: 'logistics',
    children: [
      { type: 'section', label: 'DELIVERIES & RECEIVING' },
      { label: 'Logistics', icon: 'truck', to: '/manager/logistics', permissionsAny: ['orders:view', 'inventory:view'] }
    ]
  },
  {
    key: 'hr-module',
    label: 'Human Resources',
    icon: 'users',
    moduleKey: 'hr',
    children: [
      { type: 'section', label: 'EMPLOYEES' },
      { label: 'Employee Profiles', icon: 'profile', to: '/owner/staff/profiles', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Create Account', icon: 'userplus', to: '/owner/staff/add-staff', feature: 'staff_management', permission: 'staff:create' },
      { label: 'Archived Employees', icon: 'archive', to: '/owner/staff/archived', feature: 'staff_management', permission: 'staff:view' },
      { type: 'section', label: 'ROLES & REPORTING' },
      { label: 'Roles', icon: 'shield', to: '/owner/staff/roles', feature: 'staff_management', permission: 'roles:manage', ownerOnly: true },
      { label: 'HR Reports', icon: 'report', to: '/owner/reports', feature: 'reports', permission: 'reports:view' },
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance',
    icon: 'card',
    moduleKey: 'finance',
    children: [
      { type: 'section', label: 'PAYROLL' },
      { label: 'Payroll Summary', icon: 'card', to: '/finance/payroll-summary', feature: 'payroll', permission: 'payroll:view' },
      { label: 'Payroll Approval', icon: 'shield', to: '/finance/payroll-approval', feature: 'payroll', permission: 'payroll:approve' },
      { type: 'section', label: 'FINANCE OPERATIONS' },
      { label: 'Accounts Payable', icon: 'card', to: '/finance/accounts-payable', feature: 'reports', permission: 'finance:payables:view' },
      { label: 'Refunds', icon: 'card', to: '/finance/refunds', feature: 'reports', permission: 'finance:refunds:view' },
      { label: 'Sales Ledger', icon: 'report', to: '/finance/sales', feature: 'reports', permission: 'finance:sales:view' },
      { label: 'Financial Reports', icon: 'report', to: '/finance/reports', feature: 'reports', permission: 'finance:reports:view' }
    ]
  },
  {
    key: 'policies',
    label: 'Policies',
    icon: 'file',
    children: [
      { label: 'Policy Management', icon: 'file', to: '/owner/policies', permissionsAny: ['policies:view', 'policies:update'] },
      { label: 'Commission Agreements', icon: 'handshake', to: '/owner/commission-contracts', permissionsAny: ['commissions:view', 'commissions:manage'] }
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
