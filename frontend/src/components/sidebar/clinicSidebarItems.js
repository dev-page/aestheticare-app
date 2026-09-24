const supplyPath = (department, page) => ({ finance: `/finance/procurement/${page}`, management: `/management/supply/${page}` })[department] || `/${department}/${page}`
const supplyLinks = (department, permission, entries) => entries.map(([page, label, icon]) => ({ label, icon, to: supplyPath(department, page), permission }))
export const buildClinicSidebarItems = ({ dashboardTo = '/clinic/dashboard', isEmployee = false } = {}) => [
  { label: 'Dashboard', icon: 'dashboard', to: dashboardTo },
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    icon: 'mdi:hospital-building',
    children: [
      { label: 'Branch Info', icon: 'mdi:map-marker-outline', to: '/clinic/branches', permission: 'branches:view', ownerOnly: true },
      { label: 'Add Branch', icon: 'mdi:office-building-plus-outline', to: '/clinic/branches/new', feature: 'multi_branch', permission: 'branches:create', ownerOnly: true },
      { label: 'Clinic Page', icon: 'mdi:web', to: '/clinic/page', permission: 'clinic_profile:update', ownerOnly: true },
      { label: 'Policy Management', icon: 'mdi:file-document-outline', to: '/clinic/policies', permissionsAny: ['policies:view', 'policies:update'] }
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
      { label: 'Appointments', icon: 'mdi:calendar-month-outline', to: '/crm/appointments', permission: 'appointments:view' },
      { label: 'Treatment Sessions', icon: 'mdi:calendar-sync-outline', to: '/clinical/treatment-sessions', permission: 'appointments:update' },
      { label: 'Booking Requests', icon: 'mdi:calendar-question', to: '/crm/appointments/requests', permission: 'appointments:review' },
      { label: 'Booking Availability', icon: 'mdi:calendar-clock-outline', to: '/appointments/booking-availability', feature: 'booking_availability', plans: ['basic'], permission: 'appointments:review' },
      { label: 'Online Consultation', icon: 'mdi:video-outline', to: '/clinical/consultations/online', feature: 'online_consultations', permission: 'consultations:view' },
      { type: 'section', label: 'PAYMENTS & MESSAGES' },
      { label: 'POS', icon: 'mdi:cash-register', to: '/crm/pos', permission: 'payments:create' },
      { label: 'Transactions', icon: 'mdi:receipt-text-outline', to: '/crm/transactions', permission: 'payments:view' },
      { type: 'section', label: 'ORDERS' },
      { label: 'Customer Orders', icon: 'mdi:shopping-outline', to: '/operations/orders', permissionsAny: ['orders:view', 'inventory:view'] },
      { label: 'Inbox', icon: 'mdi:email-outline', to: '/crm/inbox', permission: 'inbox:view' }
    ]
  },
  {
    key: 'products-services-module',
    label: 'Products & Services',
    icon: 'mdi:format-list-bulleted',
    moduleKey: 'operations',
    children: [
      { label: 'Product & Service Listing', icon: 'mdi:format-list-bulleted', to: '/catalog/products-services', permission: 'services:view' },
      { label: 'Archived Posts', icon: 'mdi:archive-outline', to: '/catalog/archived', permission: 'services:view' }
    ]
  },
  {
    key: 'inventory-module',
    label: 'Inventory Management',
    icon: 'mdi:warehouse',
    moduleKey: 'inventory',
    children: supplyLinks('inventory', 'inventory:view', [['dashboard', 'Inventory Dashboard', 'mdi:view-dashboard-outline'], ['items', 'Inventory List & DSS', 'mdi:package-variant-closed'], ['requests', 'Inventory Requests', 'mdi:clipboard-plus-outline'], ['reports', 'Inventory Reports', 'mdi:chart-box-outline']])
  },
  {
    key: 'procurement-module',
    label: 'Procurement',
    icon: 'mdi:cart-outline',
    moduleKey: 'procurement',
    children: [
      { type: 'section', label: 'PROCUREMENT WORKFLOW' },
      ...supplyLinks('procurement', 'procurement:view', [['dashboard', 'Procurement Dashboard', 'mdi:view-dashboard-outline'], ['requests', 'Procurement Requests', 'mdi:clipboard-text-outline'], ['orders', 'Purchase Orders', 'mdi:cart-check']]),
      { type: 'section', label: 'SUPPLIER MANAGEMENT' },
      { label: 'Supplier Directory', icon: 'mdi:truck-delivery-outline', to: '/procurement/suppliers/directory', permission: 'inventory:view' },
      { type: 'section', label: 'REPORTING' },
      ...supplyLinks('procurement', 'procurement:view', [['reports', 'Procurement Reports', 'mdi:file-chart-outline']])
    ]
  },
  {
    key: 'finance-module',
    label: 'Finance',
    icon: 'mdi:finance',
    moduleKey: 'finance',
    children: [
      { label: 'Dashboard', icon: 'mdi:chart-pie', to: '/finance/dashboard', feature: 'reports', permission: 'finance:reports:view' },
      { label: 'Budget Allocations', icon: 'mdi:bank-outline', to: '/finance/procurement/budgets', permission: 'finance:payables:view' },
      { label: 'Approvals', icon: 'mdi:clipboard-check-outline', to: '/finance/procurement/requests', permission: 'finance:payables:view' },
      { label: 'Income', icon: 'mdi:cash-plus', to: '/finance/sales', feature: 'reports', permission: 'finance:sales:view' },
      { label: 'Invoices & Payments', icon: 'mdi:receipt-text-check-outline', to: '/finance/procurement/invoices', permission: 'finance:payables:view' },
      { label: 'Financial Reports', icon: 'mdi:file-chart-outline', to: '/finance/reports', feature: 'reports', permission: 'finance:reports:view' }
    ]
  },
  {
    key: 'logistics-module',
    label: 'Logistics Management',
    icon: 'mdi:truck-delivery-outline',
    moduleKey: 'inventory',
    children: supplyLinks('logistics', 'orders:view', [['dashboard', 'Logistics Dashboard', 'mdi:view-dashboard-outline'], ['items', 'Receiving & Inspection', 'mdi:clipboard-check-outline'], ['onboarding', 'Inventory Onboarding', 'mdi:package-down'], ['requests', 'Requests & Discrepancies', 'mdi:alert-box-outline'], ['reports', 'Logistics Reports', 'mdi:file-chart-outline']])
  },
  {
    key: 'hr-module',
    label: 'Human Resources',
    icon: 'users',
    moduleKey: 'hr',
    children: [
      { type: 'section', label: 'EMPLOYEES' },
      { label: 'Employee Profiles', icon: 'mdi:card-account-details-outline', to: '/hr/employees', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Create Account', icon: 'mdi:account-plus-outline', to: '/hr/employees/new', feature: 'staff_management', permission: 'staff:create' },
      { label: 'Archived Employees', icon: 'mdi:account-off-outline', to: '/hr/employees/archived', feature: 'staff_management', permission: 'staff:view' },
      { label: 'Attendance', icon: 'mdi:calendar-check-outline', to: '/hr/attendance', feature: 'attendance', permission: 'attendance:view' },
      { type: 'section', label: 'ROLES & REPORTING' },
      { label: 'Roles', icon: 'mdi:shield-account-outline', to: '/hr/roles', feature: 'staff_management', permission: 'roles:manage', ownerOnly: true },
      { label: 'HR Reports', icon: 'mdi:chart-box-outline', to: '/hr/reports', feature: 'reports', permission: 'reports:view' },
      { type: 'section', label: 'SHIFTS' },
      { label: 'Add Shift', icon: 'mdi:clock-plus-outline', to: '/hr/add-shift', feature: 'hr', permission: 'hr:create' },
      { label: 'Shift Assignment', icon: 'mdi:calendar-account-outline', to: '/hr/schedule-assignment', feature: 'hr', permission: 'hr:update' },
      { type: 'section', label: 'LEAVE & OVERTIME' },
      { label: 'Leave Management', icon: 'mdi:calendar-clock-outline', to: '/hr/leave-management', feature: 'hr', permission: 'leave:review' },
      { label: 'Leave Request', icon: 'mdi:calendar-arrow-right', to: '/hr/leave-request', feature: 'hr', permission: 'leave:create' },
      { label: 'Overtime Request', icon: 'mdi:timer-plus-outline', to: '/hr/overtime', feature: 'hr', permissionsAny: ['overtime:view', 'overtime:create'] },
      { type: 'section', label: 'PAYROLL' },
      { label: 'Base Pay', icon: 'mdi:cash', to: '/hr/base-pay', feature: 'payroll', permission: 'payroll:update' },
      { label: 'Payroll Management', icon: 'mdi:calculator', to: '/hr/payroll', feature: 'payroll', permission: 'payroll:update' }
    ]
  },
  {
    key: 'account',
    label: 'Account Settings',
    icon: 'settings',
    children: [
      { label: 'Profile', icon: 'profile', to: isEmployee ? '/account/profile' : '/clinic/profile' },
      { label: 'Change Password', icon: 'key', to: '/account/change-password' },
      ...(!isEmployee ? [
        { label: 'Subscription Plan', icon: 'mdi:card-account-details-star-outline', to: '/account/subscription', permission: 'subscription:view' },
        { label: 'Account Access', icon: 'account-off', to: '/account/closure', permission: 'subscription:view' },
        { label: 'Backup Database', icon: 'mdi:database-export-outline', to: '/account/backup', permission: 'backups:view', ownerOnly: true },
        { label: 'Activities', icon: 'mdi:clipboard-text-clock-outline', to: '/activities', permission: 'activities:view' },
      ] : []),
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
      { label: 'Report Issue', icon: 'reportIssue', to: '/support/report' }
    ]
  }
]
