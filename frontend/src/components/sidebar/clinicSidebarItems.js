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
      { label: 'Branch Management', icon: 'mdi:map-marker-outline', to: '/clinic/branches', permissionsAny: ['branches:view', 'branches:create'] },
      { label: 'Policy & Contract Management', icon: 'mdi:file-document-outline', to: '/clinic/policies', permissionsAny: ['policies:view', 'policies:update'] }
    ]
  },
  {
    key: 'clinic-module',
    label: 'CRM & Clinic',
    icon: 'mdi:medical-bag',
    moduleKey: 'crm',
    children: [
      { type: 'section', label: 'CLIENTS' },
      { label: 'Client List', icon: 'mdi:account-multiple-outline', to: '/crm/clients', permission: 'clients:view' },
      { label: 'Walk-In', icon: 'mdi:walk', to: '/crm/clients/new', permission: 'clients:create' },
      { type: 'section', label: 'APPOINTMENTS' },
      { label: 'Appointment Management', icon: 'mdi:calendar-month-outline', to: '/crm/appointments', feature: 'appointments', permissionsAny: ['appointments:view', 'appointments:update', 'appointments:review', 'consultations:view'] },
      { label: 'Prescriptions', icon: 'mdi:prescription', to: '/clinical/prescriptions', feature: 'appointments', permissionsAny: ['appointments:view', 'appointments:update', 'consultations:view'] },
      { label: 'Booking Availability', icon: 'mdi:calendar-clock-outline', to: '/appointments/booking-availability', feature: 'booking_availability', plans: ['basic'], permission: 'appointments:review' },
      { type: 'section', label: 'OTHERS' },
      { label: 'Transactions', icon: 'mdi:receipt-text-outline', to: '/crm/transactions', feature: 'appointments', permission: 'payments:view' },
      { label: 'Inbox', icon: 'mdi:email-outline', to: '/crm/inbox', permission: 'inbox:view' }
    ]
  },
  {
    key: 'hr-module',
    label: 'Human Resource',
    icon: 'users',
    moduleKey: 'hr',
    children: [
      { type: 'section', label: 'EMPLOYEES' },
      { label: 'Employee Management', icon: 'mdi:card-account-details-outline', to: '/hr/employees', feature: 'staff_management', permissionsAny: ['staff:view', 'staff:create'] },
      { label: 'Attendance', icon: 'mdi:calendar-check-outline', to: '/hr/attendance', feature: 'attendance', permission: 'attendance:view' },
      { type: 'section', label: 'ROLES & REPORTING' },
      { label: 'Roles', icon: 'mdi:shield-account-outline', to: '/hr/roles', feature: 'staff_management', permission: 'roles:manage' },
      { label: 'HR Reports', icon: 'mdi:chart-box-outline', to: '/hr/reports', feature: 'reports', permission: 'reports:view' },
      { type: 'section', label: 'SHIFTS' },
      { label: 'Shift Management', icon: 'mdi:calendar-clock-outline', to: '/hr/shifts', feature: 'hr', permissionsAny: ['hr:create', 'hr:update'] },
      { type: 'section', label: 'LEAVE & OVERTIME' },
      { label: 'Leave Management', icon: 'mdi:calendar-clock-outline', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' },
      { label: 'Leave Request', icon: 'mdi:calendar-arrow-right', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create' },
      { label: 'Overtime Request', icon: 'mdi:timer-plus-outline', to: '/hr/overtime', feature: 'hr', permissionsAny: ['overtime:view', 'overtime:create'] },
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance',
    icon: 'mdi:finance',
    moduleKey: 'finance',
    feature: 'reports',
    children: [
      { label: 'Budget Allocations', icon: 'mdi:bank-outline', to: '/finance/procurement/budgets', permission: 'finance:payables:view' },
      { label: 'Purchase Order Approvals', icon: 'mdi:clipboard-check-outline', to: '/finance/procurement/requests', permission: 'finance:payables:view' },
      { label: 'Listing Approvals', icon: 'mdi:tag-check-outline', to: '/finance/listing-approvals', permission: 'finance:reports:view' },
      { label: 'Employee Compensation', icon: 'mdi:account-cash-outline', to: '/finance/employee-compensation', feature: 'payroll', permissionsAny: ['payroll:update', 'payroll:view'] },
      { label: 'Payroll Management', icon: 'mdi:calculator', to: '/finance/payroll-management', feature: 'payroll', permission: 'payroll:update' },
      { label: 'Payroll Approval', icon: 'mdi:cash-check', to: '/finance/payroll-approval', feature: 'payroll', permission: 'payroll:approve' },
      { label: 'Invoices & Payments', icon: 'mdi:receipt-text-check-outline', to: '/finance/procurement/invoices', permission: 'finance:payables:view' },
    ]
  },
  {
    key: 'products-services-module',
    label: 'Services',
    icon: 'mdi:format-list-bulleted',
    moduleKey: 'operations',
    children: [
      { label: 'Service Listings', icon: 'mdi:format-list-bulleted', to: '/catalog/products-services', permission: 'services:view' },
      { label: 'Archived Posts', icon: 'mdi:archive-outline', to: '/catalog/archived', permission: 'services:view' }
    ]
  },
  {
    key: 'inventory-module',
    label: 'Inventory',
    icon: 'mdi:warehouse',
    moduleKey: 'inventory',
    feature: 'inventory',
    children: [
      ...supplyLinks('inventory', 'inventory:view', [['items', 'Inventory List & DSS', 'mdi:package-variant-closed'], ['requests', 'Inventory Requests', 'mdi:clipboard-plus-outline']]),
      { label: 'Delivery Onboarding', icon: 'mdi:package-down', to: '/inventory/onboarding', permission: 'inventory:create' },
      { label: 'Pharmacy', icon: 'mdi:cash-register', to: '/pharmacy/pos', feature: 'inventory', permission: 'inventory:view' },
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
      ...supplyLinks('procurement', 'procurement:view', [['requests', 'Inventory Request Review', 'mdi:clipboard-text-outline'], ['orders', 'Purchase Orders', 'mdi:cart-check']]),
      { type: 'section', label: 'SUPPLIER MANAGEMENT' },
      { label: 'Supplier Directory', icon: 'mdi:truck-delivery-outline', to: '/procurement/suppliers/directory', permission: 'inventory:view' },
    ]
  },
  {
    key: 'logistics-module',
    label: 'Logistics',
    icon: 'mdi:truck-delivery-outline',
    moduleKey: 'inventory',
    children: supplyLinks('logistics', 'orders:view', [['items', 'Receiving & Inspection', 'mdi:clipboard-check-outline']])
  },
  {
    key: 'account',
    label: 'Account Settings',
    icon: 'settings',
    children: [
      { label: 'Profile', icon: 'profile', to: isEmployee ? '/account/profile' : '/clinic/profile' },
      { label: 'Change Password', icon: 'key', to: '/account/change-password' },
      { label: 'Subscription Plan', icon: 'mdi:card-account-details-star-outline', to: '/account/subscription', permission: 'subscription:view' },
      { label: 'Backup Database', icon: 'mdi:database-export-outline', to: '/account/backup', permission: 'backups:view' },
      { label: 'Activities', icon: 'mdi:clipboard-text-clock-outline', to: '/activities', permission: 'activities:view' },
      ...(!isEmployee ? [
        { label: 'Account Access', icon: 'account-off', to: '/account/closure', permission: 'subscription:view' },
      ] : []),
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]
  }
]
