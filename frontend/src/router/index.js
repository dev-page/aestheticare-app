import { createRouter, createWebHistory } from "vue-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useAuth } from "@/composables/useAuth";
import { usePermissions } from "@/composables/usePermissions";
import { useSubscription } from "@/composables/useSubscription";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "@/config/firebaseConfig";

const isMobileApp = String(import.meta.env.VITE_MOBILE_APP || '').trim().toLowerCase() === 'true'

const routes = [
  { path: '/procurement/rfqs', redirect: '/procurement/requests' },
  { path: '/supplier/supply/rfqs', redirect: '/supplier/supply/orders' },
  { path: '/:department(inventory|procurement|logistics)/:page?', name: 'supply-workspace', component: () => import('@/views/admin/owner/operations/SupplyWorkspace.vue'), meta: { requiresAuth: true } },
  { path: '/finance/procurement/:page?', name: 'procurement-finance-workspace', component: () => import('@/views/admin/owner/operations/SupplyWorkspace.vue'), meta: { requiresAuth: true, supplyDepartment: 'finance' } },
  { path: '/management/supply/:page?', name: 'supply-management-workspace', component: () => import('@/views/admin/owner/operations/SupplyWorkspace.vue'), meta: { requiresAuth: true, supplyDepartment: 'management' } },
  { path: '/supplier/supply/:page?', name: 'supplier-supply-workspace', component: () => import('@/views/admin/owner/operations/SupplyWorkspace.vue'), meta: { requiresAuth: true } },

  ...(isMobileApp
    ? [{ path: "/", redirect: "/login" }]
    : [{ path: "/", name: "home", component: () => import("@/views/public/Home.vue") }]),
  { path: "/login", name: "login", component: () => import("@/views/public/Login.vue"), meta: { guestOnly: true } },
  { path: "/activate-account", name: "activate-account", component: () => import("@/views/public/ActivateAccount.vue") },
  { path: "/register", name: "register", component: () => import("@/views/public/Register.vue") },
  { path: "/forgot-password", name: "forgot-password", component: () => import("@/views/public/ForgotPassword.vue") },
  { path: "/clinic/register", name: "register-clinic", component: () => import("@/views/public/Register.vue") },
  { path: "/clinic/register/step-:step", name: "register-clinic-step", component: () => import("@/views/public/Register.vue") },
  { path: "/centers", name: "centers", component: () => import("@/views/public/ViewCenters.vue") },
  ...(import.meta.env.DEV
    ? [{ path: "/test", name: "test", component: () => import("@/views/public/Test.vue") }]
    : []), ///Testing image uploads and displays
 // { path: "/video", name: "video", component: () => import("@/views/public/Video.vue") }, ///Testing video conferencing

  // Subscription route
  { path: "/subscription-features", name: "subscription-features", component: () => import("@/views/public/Subscription.vue"), meta: { requiresFeature: "subscription" } },
  { path: "/subscription/checkout", name: "subscription-checkout", component: () => import("@/views/public/SubscriptionCheckout.vue"), meta: { requiresAuth: true, requiresFeature: "subscription" } },

  //Hidden routes
  { path: "/change-password", name: "change-password", component: () => import("@/views/auth/ChangePassword.vue"), meta: { requiresAuth: true } },
  { path: "/workspace/dashboard", name: "workspace-dashboard", component: () => import("@/views/admin/owner/employee/EmployeeDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/hr/my-payslips", name: "hr-my-payslips", component: () => import("@/views/admin/owner/employee/EmployeePayslips.vue"), meta: { requiresAuth: true, requiresPermission: "profile:view" } },
  { path: "/account/profile", name: "account-profile", component: () => import("@/views/admin/owner/employee/EmployeeProfileSelf.vue"), meta: { requiresAuth: true, requiresPermission: "profile:view" } },
  { path: "/account/change-password", name: "account-change-password", component: () => import("@/views/admin/owner/employee/EmployeeChangePassword.vue"), meta: { requiresAuth: true, requiresPermission: "password:update" } },
  { path: "/hr/attendance/face-registration", name: "hr-attendance-face-registration", component: () => import("@/views/clinic/attendance/FaceRegistration.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:create" } },
  { path: "/support/report", name: "support-report", component: () => import("@/views/common/SupportReport.vue"), meta: { requiresAuth: true } },
  { path: "/notifications", name: "notifications", component: () => import("@/views/common/Notifications.vue"), meta: { requiresAuth: true } },
  { path: "/hr/attendance/scan", name: "hr-attendance-qr-scan", component: () => import("@/views/clinic/attendance/AttendanceQrScan.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:create", requiresFeature: "attendance" } },

  //{ path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/home/view-centers", name: "customer-view-center", component: () => import("@/views/customer/ViewCenterDetails.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/appointments", name: "customer-appointments", component: () => import("@/views/customer/CustomerAppointments.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/profile", name: "customer-profile", component: () => import("@/views/customer/CustomerProfile.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  //
  //
  // Clinical module routes
  //{ path: "/dashboard", name: "dashboard", component: () => import("@/views/clinic/practitioners/Dashboard.vue"), meta: { requiresAuth: true } },
  { path: "/clinical/patients", name: "clinical-patients", component: () => import("@/views/admin/owner/clinic/Patients.vue"), meta: { requiresAuth: true, requiresPermission: "clients:view" } },
  { path: "/clinical/dashboard", name: "clinical-dashboard", component: () => import("@/views/admin/owner/clinic/PractitionerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/clinical/clients", name: "clinical-clients", component: () => import("@/views/admin/owner/clinic/PractitionerClients.vue"), meta: { requiresAuth: true, requiresPermission: "clients:view" } },
  { path: "/clinical/appointments", name: "clinical-appointments", component: () => import("@/views/admin/owner/clinic/PractitionerAppointments.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:view" } },
  { path: "/clinical/consultations/online", name: "clinical-online-consultation", component: () => import("@/views/admin/owner/clinic/PractitionerOnlineConsultation.vue"), meta: { requiresAuth: true, requiresPermission: "consultations:view", requiresFeature: "online_consultations" } },
  { path: "/activities", name: "activities", component: () => import("@/views/common/Activities.vue"), meta: { requiresAuth: true, requiresPermission: "activities:view" } },

  // HR routes
  { path: "/hr/dashboard", redirect: "/workspace/dashboard" },
  { path: "/hr/sales", redirect: "/finance/reports" },
  //{ path: "/hr/schedule", name: "hr-schedule", component: () => import("@/views/clinic/hr/HRSchedule.vue"), meta: { requiresAuth: true } },
  { path: "/hr/add-shift", name: "hr-add-shift", component: () => import("@/views/admin/owner/hr/AddShift.vue"), meta: { requiresAuth: true, requiresPermission: "hr:create", requiresFeature: "hr" } },
  { path: "/hr/schedule-assignment", name: "hr-schedule-assignment", component: () => import("@/views/admin/owner/hr/ScheduleAssignment.vue"), meta: { requiresAuth: true, requiresPermission: "hr:update", requiresFeature: "hr" } },
  { path: "/hr/leave-request", name: "hr-leave-request", component: () => import("@/views/admin/owner/hr/LeaveRequest.vue"), meta: { requiresAuth: true, requiresPermission: "leave:create", requiresFeature: "hr" } },
  { path: "/hr/leave-management", name: "hr-leave-management", component: () => import("@/views/admin/owner/hr/LeaveManagement.vue"), meta: { requiresAuth: true, requiresPermission: "leave:review", requiresFeature: "hr" } },
  { path: "/hr/overtime", name: "hr-overtime", component: () => import("@/views/admin/owner/hr/Overtime.vue"), meta: { requiresAuth: true, requiresPermission: "overtime:view", requiresFeature: "hr" } },
  { path: "/hr/employees", name: "hr-employees", component: () => import("@/views/admin/owner/StaffProfile.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view", requiresFeature: "staff_management" } },
  { path: "/hr/employees/new", name: "hr-employees-new", component: () => import("@/views/admin/owner/AddStaff.vue"), meta: { requiresAuth: true, requiresPermission: "staff:create", requiresFeature: "staff_management" } },
  { path: "/hr/employees/archived", name: "hr-employees-archived", component: () => import("@/views/admin/owner/ArchivedEmployees.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view", requiresFeature: "staff_management" } },
  { path: "/hr/attendance", name: "hr-attendance", component: () => import("@/views/admin/owner/Attendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view", requiresFeature: "attendance" } },
  { path: "/hr/roles", name: "hr-roles", component: () => import("@/views/admin/owner/OwnerRoleManagement.vue"), meta: { requiresAuth: true, requiresOwner: true, requiresPermission: "roles:manage", requiresFeature: "staff_management" } },
  { path: "/hr/reports", name: "hr-reports", component: () => import("@/views/admin/owner/OwnerReports.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/hr/base-pay", name: "hr-base-pay", component: () => import("@/views/admin/owner/hr/BasePay.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:update", requiresFeature: "payroll" } },
  { path: "/hr/payroll", name: "hr-payroll", component: () => import("@/views/admin/owner/hr/Payroll.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:update", requiresFeature: "payroll" } },
  { path: "/hr/payslip-generation", name: "hr-payslip-generation", redirect: "/hr/payroll" },
  //{ path: "/hr/calendar", name: "hr-calendar", component: () => import("@/views/clinic/hr/Calendar.vue"), meta: { requiresAuth: true } },

  // Clinic configuration routes
  { path: "/clinic/onboarding", name: "clinic-onboarding", component: () => import("@/views/admin/owner/OwnerSubscriptionOnboarding.vue"), meta: { requiresAuth: true } },
  { path: "/clinic/dashboard", name: "clinic-dashboard", component: () => import("@/views/admin/owner/OwnerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/clinic/branches", name: "clinic-branches", component: () => import("@/views/admin/owner/BranchInfo.vue"), meta: { requiresAuth: true, requiresPermission: "branches:view" } },
  { path: "/clinic/branches/new", name: "clinic-branches-new", component: () => import("@/views/admin/owner/AddBranch.vue"), meta: { requiresAuth: true, requiresPermission: "branches:create", requiresFeature: "multi_branch" } },
  { path: "/clinic/profile", name: "clinic-profile", component: () => import("@/views/admin/owner/ClinicProfile.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:view" } },
  { path: "/clinic/page", name: "clinic-page", component: () => import("@/views/admin/owner/ClinicPage.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:update" } },
  { path: "/clinic/policies", name: "clinic-policies", component: () => import("@/views/admin/owner/OwnerPolicyManagement.vue"), meta: { requiresAuth: true, requiresPermission: "policies:view" } },
  { path: "/management/reports", name: "management-reports", component: () => import("@/views/admin/owner/OwnerReports.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/account/closure", name: "account-closure", component: () => import("@/views/admin/owner/OwnerAccountClosure.vue"), meta: { requiresAuth: true } },
  { path: "/account/backup", name: "account-backup", component: () => import("@/views/admin/owner/OwnerBackup.vue"), meta: { requiresAuth: true, requiresPermission: "backup:view" } },
  { path: "/account/subscription", name: "account-subscription", component: () => import("@/views/admin/owner/OwnerSubscription.vue"), meta: { requiresAuth: true, requiresPermission: "subscription:view" } },
  { path: "/account/plans", name: "account-plans", component: () => import("@/views/admin/owner/OwnerPlanSelection.vue"), meta: { requiresAuth: true } },

  // Operations and catalog module routes
  { path: "/operations/dashboard", name: "operations-dashboard", component: () => import("@/views/admin/owner/operations/ManagerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/operations/team", name: "operations-team", component: () => import("@/views/admin/owner/operations/ManagerStaffs.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/operations/attendance", name: "operations-attendance", component: () => import("@/views/admin/owner/operations/ManagerAttendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view" } },
  { path: "/catalog/archived", name: "catalog-archived", component: () => import("@/views/admin/owner/operations/ArchivedPosts.vue"), meta: { requiresAuth: true, requiresPermission: "services:view" } },
  { path: "/procurement/suppliers/directory", name: "procurement-supplier-directory", component: () => import("@/views/admin/owner/operations/SupplySuppliers.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/catalog/products-services", name: "catalog-products-services", component: () => import("@/views/admin/owner/operations/ProductServiceListing.vue"), meta: { requiresAuth: true, requiresPermission: "services:view" } },
  { path: "/operations/orders", name: "operations-orders", component: () => import("@/views/admin/owner/operations/ManagerOrders.vue"), meta: { requiresAuth: true, requiresPermission: "orders:view" } },

  // CRM module routes
  { path: "/crm/dashboard", name: "crm-dashboard", component: () => import("@/views/admin/owner/crm/ReceptionistDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/crm/clients", name: "crm-clients", component: () => import("@/views/admin/owner/crm/ReceptionistClientList.vue"), meta: { requiresAuth: true, requiresPermission: "clients:view" } },
  { path: "/crm/clients/new", name: "crm-clients-new", component: () => import("@/views/admin/owner/crm/ReceptionistAddClient.vue"), meta: { requiresAuth: true, requiresPermission: "clients:create" } },
  { path: "/crm/appointments", name: "crm-appointments", component: () => import("@/views/admin/owner/crm/ReceptionistAppointmentList.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:view" } },
  { path: "/crm/appointments/requests", name: "crm-appointment-requests", component: () => import("@/views/admin/owner/crm/AppointmentRequestApprovals.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:review" } },
  { path: "/crm/appointments/new", name: "crm-appointments-new", component: () => import("@/views/admin/owner/crm/ReceptionistAddAppointment.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:create" } },
  { path: "/crm/pos", name: "crm-pos", component: () => import("@/views/admin/owner/crm/ReceptionistPOS.vue"), meta: { requiresAuth: true, requiresPermission: "payments:create" } },
  { path: "/crm/transactions", name: "crm-transactions", component: () => import("@/views/admin/owner/crm/ReceptionistTransactionHistory.vue"), meta: { requiresAuth: true, requiresPermission: "payments:view" } },
  { path: "/crm/inbox", name: "crm-inbox", component: () => import("@/views/admin/owner/crm/ReceptionistInbox.vue"), meta: { requiresAuth: true, requiresPermission: "inbox:view" } },
  { path: "/crm/activity-logs", name: "crm-activity-logs", component: () => import("@/views/admin/owner/crm/ReceptionistActivityLogs.vue"), meta: { requiresAuth: true } },
  // Finance routes
  { path: "/finance/listing-approvals", name: "finance-listing-approvals", component: () => import("@/views/admin/owner/finance/ListingApprovals.vue"), meta: { requiresAuth: true, requiresPermission: "finance:reports:view" } },
  { path: "/finance/dashboard", name: "finance-dashboard", component: () => import("@/views/admin/owner/OwnerFinance.vue"), meta: { requiresAuth: true, requiresPermission: "finance:reports:view", requiresFeature: "reports" } },
  { path: "/finance/sales", name: "finance-sales", component: () => import("@/views/admin/owner/finance/FinanceSales.vue"), meta: { requiresAuth: true, requiresPermission: "finance:sales:view", requiresFeature: "reports" } },
  { path: "/finance/expenses-payments", name: "finance-expenses-payments", component: () => import("@/views/admin/owner/finance/FinanceExpenses.vue"), meta: { requiresAuth: true, requiresPermission: "finance:payables:view", requiresFeature: "reports" } },
  { path: "/finance/refunds", name: "finance-refunds", component: () => import("@/views/admin/owner/finance/FinanceRefunds.vue"), meta: { requiresAuth: true, requiresPermission: "finance:refunds:view", requiresFeature: "reports" } },
  { path: "/finance/reports", name: "finance-reports", component: () => import("@/views/admin/owner/finance/FinanceReports.vue"), meta: { requiresAuth: true, requiresPermission: "finance:reports:view", requiresFeature: "reports" } },
  { path: "/finance/inventory-purchases", redirect: "/procurement/reports" },
  { path: "/finance/accounts-payable", redirect: "/finance/expenses-payments" },
  { path: "/finance/budget", redirect: "/finance/procurement/budgets" },
  { path: "/finance/approvals", name: "finance-approvals", component: () => import("@/views/admin/owner/finance/FinanceRequests.vue"), meta: { requiresAuth: true, requiresPermission: "finance:payables:view", requiresFeature: "reports" } },
  { path: "/finance/requests", redirect: "/finance/approvals" },
  { path: "/finance/payroll-summary", name: "finance-payroll-summary", component: () => import("@/views/admin/owner/finance/FinancePayrollSummary.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:view", requiresFeature: "payroll" } },
  { path: "/finance/payroll-approval", name: "finance-payroll-approval", component: () => import("@/views/admin/owner/finance/FinancePayrollApproval.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:approve", requiresFeature: "payroll" } },

  // Compatibility redirects from former role-owned clinic URLs.
  { path: "/owner/change-password", redirect: "/account/change-password" },
  { path: "/employee/dashboard", redirect: "/workspace/dashboard" },
  { path: "/employee/payslips", redirect: "/hr/my-payslips" },
  { path: "/employee/profile", redirect: "/account/profile" },
  { path: "/employee/change-password", redirect: "/account/change-password" },
  { path: "/face-reg", redirect: "/hr/attendance/face-registration" },
  { path: "/attendance/scan", redirect: "/hr/attendance/scan" },
  { path: "/practitioner/dashboard", redirect: "/clinical/dashboard" },
  { path: "/practitioner/clients", redirect: "/clinical/clients" },
  { path: "/practitioner/appointments", redirect: "/clinical/appointments" },
  { path: "/practitioner/consultations/online", redirect: "/clinical/consultations/online" },
  { path: "/practitioner/activities", redirect: "/activities" },
  { path: "/patients", redirect: "/clinical/patients" },
  { path: "/owner/onboarding", redirect: "/clinic/onboarding" },
  { path: "/owner/dashboard", redirect: "/clinic/dashboard" },
  { path: "/owner/branch/branch-info", redirect: "/clinic/branches" },
  { path: "/owner/branch/add-branch", redirect: "/clinic/branches/new" },
  { path: "/owner/staff/profiles", redirect: "/hr/employees" },
  { path: "/owner/staff/add-staff", redirect: "/hr/employees/new" },
  { path: "/owner/staff/archived", redirect: "/hr/employees/archived" },
  { path: "/owner/staff/attendance", redirect: "/hr/attendance" },
  { path: "/owner/staff/approve", redirect: "/hr/employees" },
  { path: "/owner/staff/roles", redirect: "/hr/roles" },
  { path: "/owner/finance", redirect: "/finance/dashboard" },
  { path: "/owner/clinic-profile", redirect: "/clinic/profile" },
  { path: "/owner/reports", redirect: "/management/reports" },
  { path: "/owner/account/closure", redirect: "/account/closure" },
  { path: "/owner/account/backup", redirect: "/account/backup" },
  { path: "/owner/account/subscription", redirect: "/account/subscription" },
  { path: "/owner/account/plans", redirect: "/account/plans" },
  { path: "/owner/clinic-page", redirect: "/clinic/page" },
  { path: "/owner/policies", redirect: "/clinic/policies" },
  { path: "/manager/dashboard", redirect: "/operations/dashboard" },
  { path: "/manager/staffs", redirect: "/operations/team" },
  { path: "/manager/attendance", redirect: "/operations/attendance" },
  { path: "/manager/archived-posts", redirect: "/catalog/archived" },
  { path: "/manager/item-catalog", redirect: "/inventory/items" },
  { path: "/manager/suppliers", redirect: "/procurement/suppliers/directory" },
  { path: "/manager/purchase-requests", redirect: "/inventory/requests" },
  { path: "/manager/procurement", redirect: "/procurement/dashboard" },
  { path: "/manager/logistics", redirect: "/logistics/dashboard" },
  { path: "/manager/product-service-listing", redirect: "/catalog/products-services" },
  { path: "/manager/orders", redirect: "/operations/orders" },
  { path: "/manager/purchase-history", redirect: "/procurement/reports" },
  { path: "/receptionist/dashboard", redirect: "/crm/dashboard" },
  { path: "/receptionist/clients", redirect: "/crm/clients" },
  { path: "/receptionist/clients/add", redirect: "/crm/clients/new" },
  { path: "/receptionist/appointments", redirect: "/crm/appointments" },
  { path: "/receptionist/bookings", redirect: "/crm/appointments" },
  { path: "/receptionist/appointment-requests", redirect: "/crm/appointments/requests" },
  { path: "/receptionist/appointments/add", redirect: "/crm/appointments/new" },
  { path: "/receptionist/pos", redirect: "/crm/pos" },
  { path: "/receptionist/transactions/history", redirect: "/crm/transactions" },
  { path: "/receptionist/inbox", redirect: "/crm/inbox" },
  { path: "/receptionist/activity-logs", redirect: "/crm/activity-logs" },
  { path: "/supply-management/:department(inventory|procurement|logistics)/:page?", redirect: to => `/${to.params.department}/${to.params.page || 'dashboard'}` },
  { path: "/supply-management/finance/:page?", redirect: to => `/finance/procurement/${to.params.page || 'dashboard'}` },
  { path: "/supply-management/management/:page?", redirect: to => `/management/supply/${to.params.page || 'dashboard'}` },
  { path: "/supply/dashboard", redirect: "/inventory/dashboard" },
  { path: "/supply/suppliers", redirect: "/procurement/suppliers/directory" },
  { path: "/supply/catalog", redirect: "/inventory/items" },
  { path: "/supply/purchase-requests", redirect: "/inventory/requests" },
  { path: "/supply/logistics", redirect: "/logistics/dashboard" },
  // Customer routes
  { path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  { path: "/customer/center/:id", name: "customer-center", component: () => import("@/views/customer/CenterPage.vue"), meta: { requiresAuth: true } },
  { path: "/customer/appointments", name: "customer-appointments", component: () => import("@/views/customer/MyAppointments.vue"), meta: { requiresAuth: true } },
  { path: "/customer/unpaid-appointments", name: "customer-unpaid-appointments", component: () => import("@/views/customer/MyAppointments.vue"), meta: { requiresAuth: true } },
  { path: "/customer/orders", name: "customer-orders", component: () => import("@/views/customer/MyOrders.vue"), meta: { requiresAuth: true } },
  { path: "/customer/checkout", name: "customer-checkout", component: () => import("@/views/customer/Checkout.vue"), meta: { requiresAuth: true } },
  { path: "/customer/cart", name: "customer-cart", component: () => import("@/views/customer/MyCart.vue"), meta: { requiresAuth: true } },
  { path: "/customer/profile", name: "customer-profile", redirect: { path: "/customer/account-settings", query: { tab: "profile" } }, meta: { requiresAuth: true } },
  { path: "/customer/account-settings", name: "customer-account-settings", component: () => import("@/views/customer/AccountSettings.vue"), meta: { requiresAuth: true } },

  // Supplier routes
  { path: "/supplier", redirect: "/supplier/supplies" },
  { path: "/supplier/dashboard", redirect: "/supplier/supplies" },
  { path: "/supplier/profile", name: "supplier-profile", component: () => import("@/views/supplier/SupplierProfile.vue"), meta: { requiresAuth: true } },
  { path: "/supplier/supplies", name: "supplier-supplies", component: () => import("@/views/supplier/SupplierSupplies.vue"), meta: { requiresAuth: true } },

  // Superadmin routes
  { path: "/superadmin/dashboard", name: "superadmin-dashboard", component: () => import("@/views/superAdmin/Dashboard.vue"), meta: { requiresAuth: true, requiresPermission: "system:dashboard:view" } },
  { path: "/superadmin/admin-list", name: "superadmin-admin-list", component: () => import("@/views/superAdmin/AdminList.vue"), meta: { requiresAuth: true, requiresPermission: "system:admins:manage" } },
  { path: "/superadmin/subscription/plans", name: "superadmin-subscription-plans", component: () => import("@/views/superAdmin/SubscriptionPlans.vue"), meta: { requiresAuth: true, requiresPermission: "system:plans:manage" } },
  { path: "/superadmin/subscription/permissions", name: "superadmin-subscription-permissions", component: () => import("@/views/superAdmin/SubscriptionPermission.vue"), meta: { requiresAuth: true, requiresPermission: "system:permissions:manage" } },
  { path: "/superadmin/subscription/payments", name: "superadmin-subscription-payments", component: () => import("@/views/superAdmin/SubscriptionPayments.vue"), meta: { requiresAuth: true, requiresPermission: "system:payments:view" } },
  { path: "/superadmin/payments/analytics", name: "superadmin-payments-analytics", component: () => import("@/views/superAdmin/PaymentsAnalytics.vue"), meta: { requiresAuth: true, requiresPermission: "system:analytics:view" } },
  { path: "/superadmin/system-settings", name: "superadmin-system-settings", component: () => import("@/views/superAdmin/SystemSettings.vue"), meta: { requiresAuth: true, requiresPermission: "system:settings:manage" } },
  { path: "/superadmin/clinics/verification", name: "superadmin-clinic-verification", component: () => import("@/views/superAdmin/ClinicVerification.vue"), meta: { requiresAuth: true, requiresPermission: "system:clinics:verify" } },
  { path: "/superadmin/clinics/verified", name: "superadmin-clinics-verified", component: () => import("@/views/superAdmin/VerifiedClinics.vue"), meta: { requiresAuth: true, requiresPermission: "system:clinics:view" } },
  { path: "/superadmin/clinics/archived", name: "superadmin-clinics-archived", component: () => import("@/views/superAdmin/ArchivedClinics.vue"), meta: { requiresAuth: true, requiresPermission: "system:clinics:view" } },
  { path: "/superadmin/accounts/users", name: "superadmin-accounts-users", component: () => import("@/views/superAdmin/AccountManagement.vue"), meta: { requiresAuth: true, requiresPermission: "system:accounts:view" } },
  { path: "/superadmin/activity-logs", name: "superadmin-activity-logs", component: () => import("@/views/superAdmin/ActivityLogs.vue"), meta: { requiresAuth: true, requiresPermission: "system:logs:view" } },
  { path: "/superadmin/account-settings", name: "superadmin-account-settings", component: () => import("@/views/superAdmin/AccountSettings.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/account-closure-requests", name: "superadmin-account-closure-requests", component: () => import("@/views/superAdmin/AccountClosureRequests.vue"), meta: { requiresAuth: true, requiresPermission: "system:closures:manage" } },
  { path: "/superadmin/tickets", name: "superadmin-tickets", component: () => import("@/views/superAdmin/UserTickets.vue"), meta: { requiresAuth: true, requiresPermission: "system:tickets:manage" } },
  // Unknown URLs must never expose an unhandled route or blank protected view.
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const isOwnerLikeRole = (userData = {}, uid = '') => {
  const role = String(userData.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const userType = String(userData.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  return userType === 'owner' || role === 'owner' || role === 'clinicowner' || (
    ['clinicadmin', 'clinicadministrator'].includes(role) && Boolean(uid) && String(userData.branchId || '').trim() === uid
  )
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')

const isSuperadminRole = (userData = {}) => {
  const role = normalizeRole(userData.role || userData.userType)
  return ['superadmin', 'systemadmin', 'sysadmin'].includes(role)
}

const isCustomerRole = (userData = {}) => {
  return normalizeRole(userData.role) === 'customer' || normalizeRole(userData.userType) === 'customer'
}

const isSupplierRole = (userData = {}) => {
  const role = normalizeRole(userData.role || userData.userType)
  return ['supplier', 'supplieradmin'].includes(role)
}

const isClinicAccount = (userData = {}) => {
  const role = normalizeRole(userData.role)
  const userType = normalizeRole(userData.userType)
  return isSuperadminRole(userData)
    || isOwnerLikeRole(userData)
    || ['clinicadmin', 'clinicadministrator'].includes(role)
    || userType === 'staff'
    || userType === 'employee'
}

const isFreeSubscriptionPlan = (value) => {
  const plan = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-')
  return !plan || plan === 'free' || plan === 'free-plan' || plan === 'free-trial' || plan === 'trial'
}

const isTrueFlag = (value) => value === true || String(value || '').trim().toLowerCase() === 'true'

const isAuthReady = (isLoading) => {
  if (!isLoading.value) return Promise.resolve()

  return new Promise((resolve) => {
    let unsubscribe = null
    unsubscribe = onAuthStateChanged(auth, () => {
      if (unsubscribe) unsubscribe()
      resolve()
    })
  })
}

const safeUnauthorizedRedirect = (user, userData = {}) => {
  if (!user?.uid) return '/login'
  if (isSupplierRole(userData)) return '/supplier/supplies'
  if (isCustomerRole(userData)) return '/customer/home'
  if (isSuperadminRole(userData)) return '/superadmin/dashboard'
  if (isOwnerLikeRole(userData, user?.uid)) return '/clinic/dashboard'
  if (['staff', 'employee'].includes(normalizeRole(userData.userType))) return '/workspace/dashboard'
  return '/'
}

const permissionAlternates = {
  'inventory:create': ['inventory:review'],
  'inventory:review': ['inventory:create'],
  'orders:view': ['inventory:view'],
  'orders:update': ['inventory:update', 'inventory:review'],
};

// 🔧 Global guard
router.beforeEach(async (to, from, next) => {
  // Password recovery must remain accessible even when the current session
  // cannot load or the account requires onboarding or a password change.
  if (to.name === 'forgot-password') return next();

  const { user, isLoading, initAuth } = useAuth();
  const { hasPermission } = usePermissions();
  const { hasFeature } = useSubscription();

  initAuth();

  // Never render a protected route while Firebase is still resolving the
  // session. The previous early next() allowed direct URL access to load
  // protected components before the auth state was known.
  await isAuthReady(isLoading)
  const currentUser = user.value || auth.currentUser

  // Auth-required routes
  if (to.meta.requiresAuth && !currentUser) {
    return next("/login");
  }

  let forcedEmployeePasswordChange = false
  let currentUserData = {}
  if (currentUser?.uid) {
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      currentUserData = userData
      const userType = String(userData.userType || '').trim().toLowerCase();
      const accountStatus = String(userData.status || '').trim().toLowerCase();
      const accountClosed = userData.archived === true || userData.accountClosed === true || ['inactive', 'disabled', 'closed', 'deactivated'].includes(accountStatus)
      if (accountClosed) {
        await signOut(auth).catch(() => {})
        return next('/login');
      }
      const mustChangePassword = userData.mustChangePassword === true
        || String(userData.mustChangePassword || '').trim().toLowerCase() === 'true'

      if (
        (userType === 'staff' || userType === 'supplier') &&
        mustChangePassword &&
        to.path !== '/account/change-password' &&
        to.path !== '/change-password' &&
        to.path !== '/forgot-password'
      ) {
        return next(userType === 'staff' ? '/account/change-password' : '/change-password');
      }
      forcedEmployeePasswordChange = (userType === 'staff' || userType === 'supplier') && mustChangePassword
        && (to.path === '/account/change-password' || to.path === '/change-password');
    } catch (error) {
      console.error("Error verifying password change requirement in route guard:", error);
    }
  }

  // Guest-only routes (like /login)
  if (to.meta.guestOnly && currentUser) {
    // Instead of forcing dashboard, just allow navigation
    return next();
  }

  const routePath = String(to.path || '').toLowerCase()
  const isOwnerRoute = isOwnerLikeRole(currentUserData, currentUser?.uid)
  const isRegistrationRoute = routePath === '/register' || routePath.startsWith('/clinic/register')
  const isSubscriptionOnboardingRoute = routePath === '/clinic/onboarding'
  const isSubscriptionCheckoutRoute = routePath === '/subscription/checkout'

  let clinicSubscriptionData = {}
  if (currentUser && isOwnerRoute) {
    try {
      const candidateClinicIds = [currentUserData.branchId, currentUser.uid]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
      for (const clinicId of candidateClinicIds) {
        const clinicSnap = await getDoc(doc(db, 'clinics', clinicId))
        if (clinicSnap.exists()) {
          clinicSubscriptionData = clinicSnap.data() || {}
          break
        }
      }
      if (!Object.keys(clinicSubscriptionData).length) {
        const ownerClinicSnap = await getDocs(query(
          collection(db, 'clinics'),
          where('ownerId', '==', currentUser.uid),
          limit(1),
        ))
        clinicSubscriptionData = ownerClinicSnap.docs[0]?.data() || {}
      }
    } catch (error) {
      console.error('Error loading clinic subscription state:', error)
    }
  }

  const activeSubscriptionPlan = currentUserData.subscriptionPlan
    || currentUserData.plan
    || clinicSubscriptionData.subscriptionPlan
    || clinicSubscriptionData.plan
  const userStatus = String(currentUserData.status || '').trim().toLowerCase()
  const clinicApprovalStatus = String(
    clinicSubscriptionData.approvalStatus || currentUserData.approvalStatus || ''
  ).trim().toLowerCase()
  const isApprovedClinicOwner = currentUser
    && isOwnerRoute
    && userStatus === 'active'
    && clinicApprovalStatus.includes('approved')
  const needsSubscriptionOnboarding = isApprovedClinicOwner
    && !isRegistrationRoute
    && isFreeSubscriptionPlan(activeSubscriptionPlan)
    && !isTrueFlag(currentUserData.subscriptionOnboardingDismissed)

  if (needsSubscriptionOnboarding && !isSubscriptionOnboardingRoute && !isSubscriptionCheckoutRoute) {
    return next('/clinic/onboarding')
  }

  if (currentUser && routePath.startsWith('/superadmin') && !isSuperadminRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser, currentUserData))
  }
  if (currentUser && routePath.startsWith('/supplier') && !isSupplierRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser, currentUserData))
  }
  if (
    currentUser
    && routePath.startsWith('/supplier')
    && userStatus !== 'active'
  ) {
    await signOut(auth).catch(() => {})
    return next('/login')
  }
  if (currentUser && routePath.startsWith('/customer') && !isCustomerRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser, currentUserData))
  }
  if (
    currentUser &&
    ['/clinic', '/workspace', '/clinical', '/crm', '/operations', '/catalog', '/inventory', '/procurement', '/logistics', '/management', '/account', '/hr', '/finance', '/activities']
      .some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`)) &&
    !isClinicAccount(currentUserData)
  ) {
    return next(safeUnauthorizedRedirect(currentUser, currentUserData))
  }

  if (to.meta.requiresOwner && !isOwnerLikeRole(currentUserData, currentUser?.uid)) {
    return next(safeUnauthorizedRedirect(currentUser, currentUserData));
  }

  // Permission-required routes
  if (to.meta.requiresPermission && !(to.path === '/account/change-password' && forcedEmployeePasswordChange) && !hasPermission(to.meta.requiresPermission)) {
    if (currentUser?.uid) {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() || {} : {};
        const alternates = permissionAlternates[to.meta.requiresPermission] || [];
        if (alternates.some((permission) => hasPermission(permission))) {
          return next();
        }
        if (isOwnerLikeRole(userData, currentUser?.uid)) {
          return next();
        }
      } catch (error) {
        console.error("Error verifying owner access in route guard:", error);
      }
    }
    return next(safeUnauthorizedRedirect(currentUser, currentUserData));
  }

  // Feature-required routes
  if (to.meta.requiresFeature && !hasFeature(to.meta.requiresFeature)) {
    return next("/subscription-features");
  }

  next();
});

router.onError((error) => {
  const message = String(error?.message || error || '')
  const isChunkLoadFailure = /dynamically imported module|importing a module script failed|failed to fetch dynamically imported module/i.test(message)
  if (!isChunkLoadFailure || typeof window === 'undefined') {
    console.error('Router navigation failed:', error)
    return
  }

  // Recover once from an old cached index that points to a removed Vite chunk.
  // The deployment cache headers prevent this in new releases; the guard keeps
  // an existing browser session from getting stuck during rollout.
  const reloadKey = `chunk-reload:${window.location.pathname}`
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1')
    window.location.reload()
    return
  }
  sessionStorage.removeItem(reloadKey)
  console.error('A page asset could not be loaded after a cache refresh:', error)
});

export default router;
