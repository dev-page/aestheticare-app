const supplyPath = (department, page) => ({ finance: `/finance/procurement/${page}`, management: `/management/supply/${page}` })[department] || `/${department}/${page}`
const supplyLinks = (department, permission, entries) => entries.map(([page, label, icon]) => ({ label, icon, to: supplyPath(department, page), permission }))
export const buildClinicSidebarItems = ({ dashboardTo = '/clinic/dashboard', isEmployee = false } = {}) => [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    to: dashboardTo,
    tourKey: isEmployee ? 'employee-dashboard-nav' : 'owner-dashboard-nav',
  },
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    icon: 'mdi:hospital-building',
    tourKey: 'clinic-setup',
    children: [
      { label: 'Clinic Profile', icon: 'profile', to: '/clinic/profile', permission: 'page:clinic-profile:manage' },
      { label: 'Branch Management', icon: 'mdi:map-marker-outline', to: '/clinic/branches', permissionsAny: ['page:branches:view', 'page:branches:manage'] },
      { label: 'Policy & Contract Management', icon: 'mdi:file-document-outline', to: '/clinic/policies', permission: 'page:policies:manage' }
    ]
  },
  {
    key: 'clinic-module',
    label: 'CRM & Clinic',
    icon: 'mdi:medical-bag',
    moduleKey: 'crm',
    children: [
      { type: 'section', label: 'CLIENT RECORDS' },
      { label: 'Client List', icon: 'mdi:account-multiple-outline', to: '/crm/clients', permission: 'page:clients:view' },
      { type: 'section', label: 'FRONT DESK' },
      { label: 'Walk-In Desk', icon: 'mdi:walk', to: '/crm/walk-in', permission: 'page:walk-in:manage' },
      { type: 'section', label: 'APPOINTMENTS' },
      { label: 'Appointment Management', icon: 'mdi:calendar-month-outline', to: '/crm/appointments', feature: 'appointments', permission: 'page:appointments:manage' },
      { label: 'Prescriptions', icon: 'mdi:prescription', to: '/clinical/prescriptions', feature: 'appointments', permission: 'page:prescriptions:manage' },
      { label: 'Booking Availability', icon: 'mdi:calendar-clock-outline', to: '/appointments/booking-availability', feature: 'booking_availability', plans: ['basic'], permission: 'page:appointments:manage' },
      { type: 'section', label: 'PAYMENTS & MESSAGES' },
      { label: 'Transactions', icon: 'mdi:receipt-text-outline', to: '/crm/transactions', feature: 'appointments', permission: 'page:transactions:view' },
      { label: 'Inbox', icon: 'mdi:email-outline', to: '/crm/inbox', permission: 'page:inbox:manage' }
    ]
  },
  {
    key: 'hr-module',
    label: 'Human Resource',
    icon: 'users',
    moduleKey: 'hr',
    children: [
      { type: 'section', label: 'PEOPLE & WORKFORCE' },
      { label: 'Roles', icon: 'mdi:shield-account-outline', to: '/hr/roles', feature: 'staff_management', permission: 'page:roles:manage' },
      { label: 'Employee Profiles', icon: 'mdi:card-account-details-outline', to: '/hr/employees', feature: 'staff_management', permission: 'page:employees:manage' },
      { label: 'Create Account', icon: 'mdi:account-plus-outline', to: '/hr/employees/new', feature: 'staff_management', permission: 'page:employees:manage' },
      { label: 'Archived Accounts', icon: 'mdi:account-off-outline', to: '/hr/employees/archived', feature: 'staff_management', permission: 'page:employees:manage' },
      { label: 'Attendance', icon: 'mdi:calendar-check-outline', to: '/hr/attendance', feature: 'attendance', permission: 'page:employees:manage' },
      { type: 'section', label: 'LEAVE & OVERTIME' },
      { label: 'Overtime & Leave Management', icon: 'mdi:calendar-clock-outline', to: '/hr/leave-overtime-management', feature: 'hr', permission: 'page:leave-overtime:manage' },
      { label: 'Leave Request', icon: 'mdi:calendar-arrow-right', to: '/hr/leave-request', feature: 'hr', permission: 'page:leave:request' },
      { label: 'Overtime Request', icon: 'mdi:timer-plus-outline', to: '/hr/overtime', feature: 'hr', permission: 'page:overtime:request' },
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance',
    icon: 'mdi:finance',
    moduleKey: 'finance',
    feature: 'reports',
    children: [
      { label: 'Approve Purchase Orders', icon: 'mdi:clipboard-check-outline', to: '/finance/procurement/requests', permission: 'page:purchase-orders:approve' },
      { label: 'Listing Approvals', icon: 'tag-check', to: '/finance/listing-approvals', permission: 'page:listings:approve' },
      { label: 'Payroll Management', icon: 'mdi:calculator', to: '/finance/payroll-management', feature: 'payroll', permission: 'page:payroll:manage' },
      { label: 'Payroll Approval', icon: 'mdi:cash-check', to: '/finance/payroll-approval', feature: 'payroll', permission: 'page:payroll:manage' },
      { label: 'Invoices & Payments', icon: 'mdi:receipt-text-check-outline', to: '/finance/procurement/invoices', permission: 'page:supplier-invoices:manage' },
      { label: 'Other Expenses', icon: 'mdi:cash-minus', to: '/finance/expenses-payments?tab=other', permission: 'page:other-expenses:manage' },
    ]
  },
  {
    key: 'products-services-module',
    label: 'Services',
    icon: 'mdi:format-list-bulleted',
    moduleKey: 'operations',
    children: [
      { label: 'Service Listings', icon: 'mdi:format-list-bulleted', to: '/catalog/products-services', permission: 'page:services:manage' },
      { label: 'Archived Posts', icon: 'mdi:archive-outline', to: '/catalog/archived', permission: 'page:services:manage' }
    ]
  },
  {
    key: 'inventory-module',
    label: 'Inventory',
    icon: 'mdi:warehouse',
    moduleKey: 'inventory',
    feature: 'inventory',
    children: [
      ...supplyLinks('inventory', 'page:inventory:manage', [['items', 'Inventory & Stock', 'mdi:package-variant-closed'], ['requests', 'Request Supplies', 'mdi:clipboard-plus-outline']]),
      { label: 'Receive Supplies', icon: 'mdi:clipboard-check-outline', to: '/inventory/receiving', permission: 'page:inventory:manage' },
      { label: 'Pharmacy', icon: 'mdi:cash-register', to: '/pharmacy/pos', feature: 'inventory', permission: 'page:pharmacy:manage' },
    ]
  },
  {
    key: 'procurement-module',
    label: 'Procurement',
    icon: 'mdi:cart-outline',
    moduleKey: 'procurement',
    feature: 'inventory',
    children: [
      { type: 'section', label: 'PROCUREMENT WORKFLOW' },
      ...supplyLinks('procurement', 'page:procurement-orders:manage', [['orders', 'Purchase Orders', 'mdi:cart-check']]),
      { label: 'Review Supply Requests', icon: 'mdi:clipboard-text-outline', to: '/procurement/requests', permission: 'page:inventory-requests:manage' },
      { type: 'section', label: 'SUPPLIER MANAGEMENT' },
      { label: 'Supplier Directory', icon: 'mdi:truck-delivery-outline', to: '/procurement/suppliers/directory', permission: 'page:suppliers:manage' },
    ]
  },
  {
    key: 'account',
    label: 'Account Settings',
    icon: 'settings',
    children: [
      { label: 'Profile', icon: 'profile', to: '/account/profile', permission: 'page:account:manage' },
      { label: 'Change Password', icon: 'key', to: '/account/change-password', permission: 'page:account:manage' },
      { label: 'Subscription Plan', icon: 'mdi:card-account-details-star-outline', to: '/account/subscription', permission: 'page:subscription:manage' },
      { label: 'Backup Database', icon: 'mdi:database-export-outline', to: '/account/backup', permission: 'page:backups:manage' },
      { label: 'Activities', icon: 'mdi:clipboard-text-clock-outline', to: '/activities', permission: 'page:account:manage' },
      ...(!isEmployee ? [
        { label: 'Account Access', icon: 'account-off', to: '/account/closure', permission: 'page:account:manage' },
      ] : []),
      { label: 'Notifications', icon: 'bell', to: '/notifications', permission: 'page:account:manage' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report', permission: 'page:account:manage' }
    ]
  }
]
