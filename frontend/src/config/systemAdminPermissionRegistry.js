export const SYSTEM_ADMIN_FULL_ACCESS = 'administrator:full_access'

export const systemAdminPermissionGroups = [
  {
    key: 'platform',
    label: 'Platform Administration',
    permissions: [
      { key: 'system:dashboard:view', label: 'View Dashboard' },
      { key: 'system:admins:manage', label: 'Manage Administrators' },
      { key: 'system:settings:manage', label: 'Manage System Settings' },
      { key: 'system:logs:view', label: 'View Activity Logs' },
    ],
  },
  {
    key: 'verification',
    label: 'Registration Verification',
    permissions: [
      { key: 'system:clinics:verify', label: 'Verify Clinics' },
      { key: 'system:suppliers:verify', label: 'Verify Suppliers' },
      { key: 'system:clinics:view', label: 'View Verified Clinics' },
      { key: 'system:accounts:view', label: 'View User Accounts' },
      { key: 'system:accounts:archive', label: 'Manage Archived Accounts' },
    ],
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions and Payments',
    permissions: [
      { key: 'system:plans:manage', label: 'Manage Subscription Plans' },
      { key: 'system:permissions:manage', label: 'Manage Plan Permissions' },
      { key: 'system:payments:view', label: 'View Subscription Payments' },
      { key: 'system:analytics:view', label: 'View Payment Analytics' },
    ],
  },
  {
    key: 'support',
    label: 'Support and Account Requests',
    permissions: [
      { key: 'system:tickets:manage', label: 'Manage Support Tickets' },
      { key: 'system:closures:manage', label: 'Manage Account Closure Requests' },
    ],
  },
]

export const systemAdminPermissions = systemAdminPermissionGroups.flatMap((group) => group.permissions)

export const systemAdminRoleTemplates = [
  {
    key: 'platform_owner',
    label: 'Platform Owner',
    description: 'Full access to every system-administration function.',
    permissions: [SYSTEM_ADMIN_FULL_ACCESS],
  },
  {
    key: 'verification_admin',
    label: 'Verification Administrator',
    description: 'Reviews clinics, suppliers, accounts, and verification records.',
    permissions: ['system:dashboard:view', ...systemAdminPermissionGroups.find((group) => group.key === 'verification').permissions.map((permission) => permission.key)],
  },
  {
    key: 'billing_admin',
    label: 'Billing Administrator',
    description: 'Manages plans, permissions, payments, and analytics.',
    permissions: ['system:dashboard:view', ...systemAdminPermissionGroups.find((group) => group.key === 'subscriptions').permissions.map((permission) => permission.key)],
  },
  {
    key: 'support_admin',
    label: 'Support Administrator',
    description: 'Handles support tickets and account closure requests.',
    permissions: ['system:dashboard:view', ...systemAdminPermissionGroups.find((group) => group.key === 'support').permissions.map((permission) => permission.key)],
  },
  {
    key: 'custom',
    label: 'Custom Role',
    description: 'Choose individual permissions for this administrator.',
    permissions: [],
  },
]

export const systemAdminRoleTemplateMap = Object.fromEntries(
  systemAdminRoleTemplates.map((role) => [role.key, role])
)
