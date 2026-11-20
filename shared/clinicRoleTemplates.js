const ROLE_COLOR = '#d2a679'

export const permissionSuggestionRules = [
  {
    match: ['reception', 'front desk', 'frontdesk', 'receptionist', 'desk'],
    permissions: ['clients:view', 'clients:update', 'appointments:view', 'appointments:create', 'appointments:update', 'appointments:review', 'payments:view', 'payments:create', 'inbox:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['practitioner', 'doctor', 'dentist', 'nurse', 'therapist', 'clinician'],
    permissions: ['clients:view', 'appointments:view', 'appointments:update', 'appointments:review', 'consultations:view', 'consultations:create', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['hr', 'human resources'],
    permissions: ['staff:view', 'staff:create', 'staff:update', 'staff:disable', 'attendance:view', 'attendance:create', 'attendance:update', 'attendance:import', 'hr:view', 'hr:create', 'hr:update', 'leave:create', 'leave:review', 'overtime:view', 'overtime:create', 'overtime:review', 'payroll:update', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['finance', 'accounting', 'cashier'],
    permissions: ['payments:view', 'reports:view', 'payroll:view', 'payroll:approve', 'finance:purchases:view', 'finance:payables:view', 'finance:payables:approve', 'finance:payables:settle', 'finance:refunds:view', 'finance:refunds:manage', 'finance:sales:view', 'finance:reports:view', 'services:view', 'services:review', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['branch manager', 'manager', 'operations', 'supervisor'],
    permissions: ['staff:view', 'staff:update', 'staff:disable', 'appointments:view', 'appointments:review', 'inventory:view', 'inventory:update', 'inventory:disable', 'suppliers:create', 'suppliers:update', 'inventory:review', 'orders:view', 'orders:update', 'services:view', 'services:create', 'services:update', 'services:disable', 'reports:view', 'leave:create', 'leave:review', 'overtime:view', 'overtime:create', 'overtime:review', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['inventory'],
    permissions: ['inventory:view', 'inventory:create', 'inventory:review', 'inventory:update', 'inventory:disable', 'suppliers:create', 'suppliers:update', 'reports:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['procurement'],
    permissions: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:purchases:view', 'finance:payables:view', 'suppliers:create', 'suppliers:update', 'reports:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['pharmacist', 'pharmacy'],
    permissions: ['pharmacy:view', 'pharmacy:dispense', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
]

export const builtInRoleTemplates = [
  { key: 'clinic-manager', name: 'Branch Manager', description: 'Manages day-to-day operations for the branch where this employee is assigned.', color: ROLE_COLOR, suggestion: 'manager' },
  { key: 'receptionist', name: 'Receptionist', description: 'Handles walk-ins, customer booking requests, appointment records, payments, inbox messages, and notifications.', color: ROLE_COLOR, suggestion: 'reception' },
  { key: 'practitioner', name: 'Practitioner', description: 'Works with clients, appointments, consultations, and personal leave requests.', color: ROLE_COLOR, suggestion: 'practitioner' },
  { key: 'hr', name: 'HR', description: 'Manages employee records, attendance, leave, overtime, and payroll preparation.', color: ROLE_COLOR, suggestion: 'hr' },
  { key: 'finance', name: 'Finance', description: 'Reviews sales, purchases, payables, refunds, financial reports, and payroll approval.', color: ROLE_COLOR, suggestion: 'finance' },
  { key: 'inventory', name: 'Inventory', description: 'Maintains branch stock, item records, replenishment requests, receiving, and inspection.', color: ROLE_COLOR, suggestion: 'inventory' },
  { key: 'procurement', name: 'Procurement', description: 'Selects clinic suppliers, records external quotations, and prepares purchase orders for Finance approval.', color: ROLE_COLOR, suggestion: 'procurement' },
  { key: 'pharmacist', name: 'Pharmacist', description: 'Views pharmacy stock and prescription information, and processes permitted pharmacy sales.', color: ROLE_COLOR, suggestion: 'pharmacist' },
]

export const getTemplatePermissions = (suggestion) => {
  const rule = permissionSuggestionRules.find((entry) => entry.match.includes(suggestion))
  return rule ? [...new Set(rule.permissions)] : []
}
