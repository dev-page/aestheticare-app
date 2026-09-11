import { createRouter, createWebHistory } from "vue-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useAuth } from "@/composables/useAuth";
import { usePermissions } from "@/composables/usePermissions";
import { useSubscription } from "@/composables/useSubscription";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebaseConfig";

const isMobileApp = String(import.meta.env.VITE_MOBILE_APP || '').trim().toLowerCase() === 'true'

const routes = [

  ...(isMobileApp
    ? [{ path: "/", redirect: "/login" }]
    : [{ path: "/", name: "home", component: () => import("@/views/public/Home.vue") }]),
  { path: "/login", name: "login", component: () => import("@/views/public/Login.vue"), meta: { guestOnly: true } },
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
  { path: "/subscription/checkout", name: "subscription-checkout", component: () => import("@/views/public/SubscriptionCheckout.vue"), meta: { requiresFeature: "subscription" } },

  //Hidden routes
  { path: "/change-password", name: "change-password", component: () => import("@/views/auth/ChangePassword.vue"), meta: { requiresAuth: true } },
  { path: "/owner/change-password", name: "owner-change-password", component: () => import("@/views/admin/owner/employee/EmployeeChangePassword.vue"), meta: { requiresAuth: true, requiresPermission: "password:update" } },
  { path: "/employee/dashboard", name: "employee-dashboard", component: () => import("@/views/admin/owner/employee/EmployeeDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/employee/profile", name: "employee-profile-self", component: () => import("@/views/admin/owner/employee/EmployeeProfileSelf.vue"), meta: { requiresAuth: true, requiresPermission: "profile:view" } },
  { path: "/employee/change-password", name: "employee-change-password", component: () => import("@/views/admin/owner/employee/EmployeeChangePassword.vue"), meta: { requiresAuth: true, requiresPermission: "password:update" } },
  { path: "/face-reg", name: "face-registration", component: () => import("@/views/clinic/attendance/FaceRegistration.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:create" } },
  { path: "/support/report", name: "support-report", component: () => import("@/views/common/SupportReport.vue"), meta: { requiresAuth: true, requiresPermission: "support:view" } },
  { path: "/notifications", name: "notifications", component: () => import("@/views/common/Notifications.vue"), meta: { requiresAuth: true, requiresPermission: "notifications:view" } },
  { path: "/attendance/scan", name: "attendance-qr-scan", component: () => import("@/views/clinic/attendance/AttendanceQrScan.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:create", requiresFeature: "attendance" } },

  //{ path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/home/view-centers", name: "customer-view-center", component: () => import("@/views/customer/ViewCenterDetails.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/appointments", name: "customer-appointments", component: () => import("@/views/customer/CustomerAppointments.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/profile", name: "customer-profile", component: () => import("@/views/customer/CustomerProfile.vue"), meta: { requiresAuth: true } },
  //{ path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  //
  //
  // Practitioner routes
  //{ path: "/dashboard", name: "dashboard", component: () => import("@/views/clinic/practitioners/Dashboard.vue"), meta: { requiresAuth: true } },
  //{ path: "/patients", name: "patients", component: () => import("@/views/clinic/practitioners/Patients.vue"), meta: { requiresAuth: true } },
  //{ path: "/appointments", name: "appointments", component: () => import("@/views/clinic/practitioners/Appointments.vue"), meta: { requiresAuth: true } },
  { path: "/practitioner/dashboard", name: "practitioner-dashboard", component: () => import("@/views/admin/owner/clinic/PractitionerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/practitioner/clients", name: "practitioner-clients", component: () => import("@/views/admin/owner/clinic/PractitionerClients.vue"), meta: { requiresAuth: true, requiresPermission: "clients:view" } },
  { path: "/practitioner/appointments", name: "practitioner-appointments", component: () => import("@/views/admin/owner/crm/ReceptionistAppointmentList.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:view" } },
  { path: "/practitioner/consultations/online", name: "practitioner-online-consultation", component: () => import("@/views/admin/owner/clinic/PractitionerOnlineConsultation.vue"), meta: { requiresAuth: true, requiresPermission: "consultations:view", requiresFeature: "online_consultations" } },
  { path: "/activities", name: "activities", component: () => import("@/views/common/Activities.vue"), meta: { requiresAuth: true, requiresPermission: "activities:view" } },
  { path: "/practitioner/activities", redirect: "/activities" },

  // HR routes
  { path: "/hr/dashboard", redirect: "/owner/dashboard" },
  { path: "/hr/employee-profile", redirect: "/owner/staff/profiles" },
  { path: "/hr/add-employee", name: "hr-add-employee", component: () => import("@/views/admin/owner/hr/AddEmployee.vue"), meta: { requiresAuth: true, requiresPermission: "staff:create", requiresFeature: "staff_management" } },
  { path: "/hr/sales", redirect: "/finance/reports" },
  //{ path: "/hr/schedule", name: "hr-schedule", component: () => import("@/views/clinic/hr/HRSchedule.vue"), meta: { requiresAuth: true } },
  { path: "/hr/add-shift", name: "hr-add-shift", component: () => import("@/views/admin/owner/hr/AddShift.vue"), meta: { requiresAuth: true, requiresPermission: "hr:create", requiresFeature: "hr" } },
  { path: "/hr/schedule-assignment", name: "hr-schedule-assignment", component: () => import("@/views/admin/owner/hr/ScheduleAssignment.vue"), meta: { requiresAuth: true, requiresPermission: "hr:update", requiresFeature: "hr" } },
  { path: "/hr/leave-request", name: "hr-leave-request", component: () => import("@/views/admin/owner/hr/LeaveRequest.vue"), meta: { requiresAuth: true, requiresPermission: "leave:create", requiresFeature: "hr" } },
  { path: "/hr/leave-management", name: "hr-leave-management", component: () => import("@/views/admin/owner/hr/LeaveManagement.vue"), meta: { requiresAuth: true, requiresPermission: "leave:review", requiresFeature: "hr" } },
  { path: "/hr/attendance", name: "hr-attendance", component: () => import("@/views/admin/owner/hr/Attendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view", requiresFeature: "attendance" } },
  { path: "/hr/archives", name: "hr-archives", component: () => import("@/views/admin/owner/hr/Archive.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view", requiresFeature: "staff_management" } },
  { path: "/hr/base-pay", name: "hr-base-pay", component: () => import("@/views/admin/owner/hr/BasePay.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:update", requiresFeature: "payroll" } },
  { path: "/hr/payroll", name: "hr-payroll", component: () => import("@/views/admin/owner/hr/Payroll.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:update", requiresFeature: "payroll" } },
  { path: "/hr/payslip-generation", name: "hr-payslip-generation", component: () => import("@/views/admin/owner/hr/PayslipGeneration.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:update", requiresFeature: "payroll" } },
  //{ path: "/hr/calendar", name: "hr-calendar", component: () => import("@/views/clinic/hr/Calendar.vue"), meta: { requiresAuth: true } },

  // Supply routes
  { path: "/supply/dashboard", name: "supply-dashboard", component: () => import("@/views/admin/owner/operations/SupplyCatalog.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/supply/suppliers", name: "supply-suppliers", component: () => import("@/views/admin/owner/operations/SupplySuppliers.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/supply/catalog", name: "supply-catalog", component: () => import("@/views/admin/owner/operations/SupplyCatalog.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/supply/purchase-requests", name: "supply-purchase-requests", component: () => import("@/views/admin/owner/operations/SupplyPurchaseRequests.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:create" } },
  { path: "/supply/logistics", name: "supply-logistics", component: () => import("@/views/admin/owner/operations/LogisticsOrders.vue"), meta: { requiresAuth: true, requiresPermission: "orders:view" } },

  // Owner routes
  { path: "/owner/dashboard", name: "owner-dashboard", component: () => import("@/views/admin/owner/OwnerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/owner/branch/branch-info", name: "owner-branch-info", component: () => import("@/views/admin/owner/BranchInfo.vue"), meta: { requiresAuth: true, requiresPermission: "branches:view" } },
  { path: "/owner/branch/add-branch", name: "owner-add-branch", component: () => import("@/views/admin/owner/AddBranch.vue"), meta: { requiresAuth: true, requiresPermission: "branches:create", requiresFeature: "multi_branch" } },
  { path: "/owner/staff/profiles", name: "owner-staff-profiles", component: () => import("@/views/admin/owner/StaffProfile.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/owner/staff/add-staff", name: "owner-add-staff", component: () => import("@/views/admin/owner/AddStaff.vue"), meta: { requiresAuth: true, requiresPermission: "staff:create" } },
  { path: "/owner/staff/archived", name: "owner-staff-archived", component: () => import("@/views/admin/owner/ArchivedEmployees.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/owner/staff/attendance", name: "owner-staff-attendance", component: () => import("@/views/admin/owner/Attendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view", requiresFeature: "attendance" } },
  { path: "/owner/staff/approve", name: "owner-staff-approve", component: () => import("@/views/admin/owner/hr/ApproveStaff.vue"), meta: { requiresAuth: true, requiresPermission: "staff:update" } },
  { path: "/owner/staff/roles", name: "owner-staff-roles", component: () => import("@/views/admin/owner/OwnerRoleManagement.vue"), meta: { requiresAuth: true, requiresOwner: true, requiresPermission: "roles:manage" } },
  { path: "/owner/finance", name: "owner-finance", component: () => import("@/views/admin/owner/OwnerFinance.vue"), meta: { requiresAuth: true } },
  { path: "/owner/clinic-profile", name: "owner-clinic-profile", component: () => import("@/views/admin/owner/ClinicProfile.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:view" } },
  { path: "/owner/reports", name: "owner-reports", component: () => import("@/views/admin/owner/OwnerReports.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/owner/account/closure", name: "owner-account-closure", component: () => import("@/views/admin/owner/OwnerAccountClosure.vue"), meta: { requiresAuth: true } },
  { path: "/owner/account/backup", name: "owner-backup", component: () => import("@/views/admin/owner/OwnerBackup.vue"), meta: { requiresAuth: true, requiresPermission: "backup:view" } },
  { path: "/owner/account/subscription", name: "owner-subscription", component: () => import("@/views/admin/owner/OwnerSubscription.vue"), meta: { requiresAuth: true, requiresPermission: "subscription:view" } },
  { path: "/owner/account/plans", name: "owner-plan-selection", component: () => import("@/views/admin/owner/OwnerPlanSelection.vue"), meta: { requiresAuth: true } },
  { path: "/owner/clinic-page", name: "owner-clinic-page", component: () => import("@/views/admin/owner/ClinicPage.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:update" } },
  { path: "/owner/policies", name: "owner-policies", component: () => import("@/views/admin/owner/OwnerPolicyManagement.vue"), meta: { requiresAuth: true, requiresPermission: "policies:view" } },
  { path: "/owner/commission-contracts", name: "owner-commission-contracts", component: () => import("@/views/admin/owner/finance/CommissionContracts.vue"), meta: { requiresAuth: true, requiresPermission: "commissions:view" } },

  // Manager routes
  { path: "/manager/dashboard", name: "manager-dashboard", component: () => import("@/views/admin/owner/operations/ManagerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/manager/staffs", name: "manager-staffs", component: () => import("@/views/admin/owner/operations/ManagerStaffs.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/manager/attendance", name: "manager-attendance", component: () => import("@/views/admin/owner/operations/ManagerAttendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view" } },
  { path: "/manager/archived-posts", name: "manager-archived-posts", component: () => import("@/views/admin/owner/operations/ArchivedPosts.vue"), meta: { requiresAuth: true, requiresPermission: "services:view" } },
  { path: "/manager/item-catalog", name: "manager-item-catalog", component: () => import("@/views/admin/owner/operations/SupplyCatalog.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/manager/suppliers", name: "manager-suppliers", component: () => import("@/views/admin/owner/operations/SupplySuppliers.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/manager/purchase-requests", name: "manager-purchase-requests", component: () => import("@/views/admin/owner/operations/SupplyPurchaseRequests.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:create" } },
  { path: "/manager/procurement", name: "manager-procurement", component: () => import("@/views/admin/owner/operations/ProcurementManagement.vue"), meta: { requiresAuth: true, requiresPermission: "procurement:view" } },
  { path: "/manager/logistics", name: "manager-logistics", component: () => import("@/views/admin/owner/operations/LogisticsOrders.vue"), meta: { requiresAuth: true, requiresPermission: "orders:view" } },
  { path: "/manager/product-service-listing", name: "manager-product-service-listing", component: () => import("@/views/admin/owner/operations/ProductServiceListing.vue"), meta: { requiresAuth: true, requiresPermission: "services:view" } },
  { path: "/manager/orders", name: "manager-orders", component: () => import("@/views/admin/owner/operations/ManagerOrders.vue"), meta: { requiresAuth: true, requiresPermission: "orders:view" } },

  // Receptionist routes
  { path: "/receptionist/dashboard", name: "receptionist-dashboard", component: () => import("@/views/admin/owner/crm/ReceptionistDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/receptionist/clients", name: "receptionist-clients", component: () => import("@/views/admin/owner/crm/ReceptionistClientList.vue"), meta: { requiresAuth: true, requiresPermission: "clients:view" } },
  { path: "/receptionist/clients/add", name: "receptionist-clients-add", component: () => import("@/views/admin/owner/crm/ReceptionistAddClient.vue"), meta: { requiresAuth: true, requiresPermission: "clients:create" } },
  { path: "/receptionist/appointments", name: "receptionist-appointments", component: () => import("@/views/admin/owner/crm/ReceptionistAppointmentList.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:view" } },
  { path: "/receptionist/appointment-requests", name: "receptionist-appointment-requests", component: () => import("@/views/admin/owner/crm/AppointmentRequestApprovals.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:review" } },
  { path: "/receptionist/appointments/add", name: "receptionist-appointments-add", component: () => import("@/views/admin/owner/crm/ReceptionistAddAppointment.vue"), meta: { requiresAuth: true, requiresPermission: "appointments:create" } },
  { path: "/receptionist/pos", name: "receptionist-pos", component: () => import("@/views/admin/owner/crm/ReceptionistPOS.vue"), meta: { requiresAuth: true, requiresPermission: "payments:create" } },
  { path: "/receptionist/transactions/history", name: "receptionist-transactions-history", component: () => import("@/views/admin/owner/crm/ReceptionistTransactionHistory.vue"), meta: { requiresAuth: true, requiresPermission: "payments:view" } },
  { path: "/receptionist/inbox", name: "receptionist-inbox", component: () => import("@/views/admin/owner/crm/ReceptionistInbox.vue"), meta: { requiresAuth: true, requiresPermission: "inbox:view" } },
  { path: "/receptionist/activity-logs", name: "receptionist-activity-logs", component: () => import("@/views/admin/owner/crm/ReceptionistActivityLogs.vue"), meta: { requiresAuth: true } },
  // Finance routes
  { path: "/finance/dashboard", redirect: "/finance/reports" },
  { path: "/finance/sales", name: "finance-sales", component: () => import("@/views/admin/owner/finance/FinanceSales.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/finance/refunds", name: "finance-refunds", component: () => import("@/views/admin/owner/finance/FinanceRefunds.vue"), meta: { requiresAuth: true, requiresPermission: "payments:view", requiresFeature: "reports" } },
  { path: "/finance/reports", name: "finance-reports", component: () => import("@/views/admin/owner/finance/FinanceReports.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/finance/inventory-purchases", name: "finance-inventory-purchases", component: () => import("@/views/admin/owner/finance/FinanceInventoryPurchases.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view", requiresFeature: "reports" } },
  { path: "/finance/accounts-payable", name: "finance-accounts-payable", component: () => import("@/views/admin/owner/finance/FinanceAccountsPayable.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view", requiresFeature: "reports" } },
  { path: "/finance/payroll-summary", name: "finance-payroll-summary", component: () => import("@/views/admin/owner/finance/FinancePayrollSummary.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:view", requiresFeature: "payroll" } },
  { path: "/finance/payroll-approval", name: "finance-payroll-approval", component: () => import("@/views/admin/owner/finance/FinancePayrollApproval.vue"), meta: { requiresAuth: true, requiresPermission: "payroll:view", requiresFeature: "payroll" } },
  // Customer routes
  { path: "/customer/home", name: "customer-home", component: () => import("@/views/customer/CustomerHome.vue"), meta: { requiresAuth: true } },
  { path: "/customer/center/:id", name: "customer-center", component: () => import("@/views/customer/CenterPage.vue"), meta: { requiresAuth: true } },
  { path: "/customer/appointments", name: "customer-appointments", component: () => import("@/views/customer/MyAppointments.vue"), meta: { requiresAuth: true } },
  { path: "/customer/orders", name: "customer-orders", component: () => import("@/views/customer/MyOrders.vue"), meta: { requiresAuth: true } },
  { path: "/customer/checkout", name: "customer-checkout", component: () => import("@/views/customer/Checkout.vue"), meta: { requiresAuth: true } },
  { path: "/customer/cart", name: "customer-cart", component: () => import("@/views/customer/MyCart.vue"), meta: { requiresAuth: true } },
  { path: "/customer/profile", name: "customer-profile", component: () => import("@/views/customer/MyProfile.vue"), meta: { requiresAuth: true } },
  { path: "/customer/account-settings", name: "customer-account-settings", component: () => import("@/views/customer/AccountSettings.vue"), meta: { requiresAuth: true } },

  // Supplier routes
  { path: "/supplier", redirect: "/supplier/dashboard" },
  { path: "/supplier/dashboard", name: "supplier-dashboard", component: () => import("@/views/supplier/SupplierDashboard.vue"), meta: { requiresAuth: true } },
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
  { path: "/superadmin/suppliers/verification", name: "superadmin-supplier-verification", component: () => import("@/views/superAdmin/SupplierVerification.vue"), meta: { requiresAuth: true, requiresPermission: "system:suppliers:verify" } },
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

const isOwnerLikeRole = (value) => {
  const compact = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return compact === "owner" || compact === "clinicadmin" || compact === "clinicadministrator";
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
    || isOwnerLikeRole(role)
    || userType === 'staff'
    || userType === 'employee'
}

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

const safeUnauthorizedRedirect = (user) => user?.uid ? '/' : '/login'

const permissionAlternates = {
  'inventory:create': ['inventory:review'],
  'inventory:review': ['inventory:create'],
  'orders:view': ['inventory:view'],
  'orders:update': ['inventory:update', 'inventory:review'],
};

// 🔧 Global guard
router.beforeEach(async (to, from, next) => {
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
        userType === 'staff' &&
        mustChangePassword &&
        to.path !== '/employee/change-password' &&
        to.path !== '/forgot-password'
      ) {
        return next('/employee/change-password');
      }
      forcedEmployeePasswordChange = userType === 'staff' && mustChangePassword && to.path === '/employee/change-password';
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
  if (currentUser && routePath.startsWith('/superadmin') && !isSuperadminRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser))
  }
  if (currentUser && routePath.startsWith('/supplier') && !isSupplierRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser))
  }
  if (currentUser && routePath.startsWith('/customer') && !isCustomerRole(currentUserData)) {
    return next(safeUnauthorizedRedirect(currentUser))
  }
  if (
    currentUser &&
    ['/owner', '/manager', '/receptionist', '/practitioner', '/employee', '/hr', '/finance', '/supply', '/face-reg', '/attendance', '/activities']
      .some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`)) &&
    !isClinicAccount(currentUserData)
  ) {
    return next(safeUnauthorizedRedirect(currentUser))
  }

  if (to.meta.requiresOwner && !isOwnerLikeRole(currentUserData.role || currentUserData.userType || "")) {
    return next(safeUnauthorizedRedirect(currentUser));
  }

  // Permission-required routes
  if (to.meta.requiresPermission && !(to.path === '/employee/change-password' && forcedEmployeePasswordChange) && !hasPermission(to.meta.requiresPermission)) {
    if (currentUser?.uid) {
      try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        const userData = userSnap.exists() ? userSnap.data() || {} : {};
        const alternates = permissionAlternates[to.meta.requiresPermission] || [];
        if (alternates.some((permission) => hasPermission(permission))) {
          return next();
        }
        if (isOwnerLikeRole(userData.role || userData.userType || "")) {
          return next();
        }
      } catch (error) {
        console.error("Error verifying owner access in route guard:", error);
      }
    }
    return next(safeUnauthorizedRedirect(currentUser));
  }

  // Feature-required routes
  if (to.meta.requiresFeature && !hasFeature(to.meta.requiresFeature)) {
    return next("/subscription-features");
  }

  next();
});

export default router;
