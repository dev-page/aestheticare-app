import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { usePermissions } from "@/composables/usePermissions";
import { useSubscription } from "@/composables/useSubscription";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebaseConfig";
import { getSuspendedCenterAccess } from "@/utils/centerAccess";

const routes = [
  // Public routes
  { path: "/", name: "home", component: () => import("@/views/public/Home.vue") },
  { path: "/login", name: "login", component: () => import("@/views/public/Login.vue"), meta: { guestOnly: true } },
  { path: "/register", name: "register", component: () => import("@/views/public/Register.vue") },
  { path: "/forgot-password", name: "forgot-password", component: () => import("@/views/public/ForgotPassword.vue") },
  { path: "/clinic/register", name: "register-clinic", component: () => import("@/views/public/Register.vue") },
  { path: "/clinic/register/step-:step", name: "register-clinic-step", component: () => import("@/views/public/Register.vue") },
  { path: "/centers", name: "centers", component: () => import("@/views/public/ViewCenters.vue") },
  { path: "/test", name: "test", component: () => import("@/views/public/Test.vue") }, ///Testing image uploads and displays
 // { path: "/video", name: "video", component: () => import("@/views/public/Video.vue") }, ///Testing video conferencing

  // Subscription route
  { path: "/subscription-features", name: "subscription-features", component: () => import("@/views/public/Subscription.vue"), meta: { requiresFeature: "subscription" } },
  { path: "/subscription/checkout", name: "subscription-checkout", component: () => import("@/views/public/SubscriptionCheckout.vue"), meta: { requiresFeature: "subscription" } },

  //Hidden routes
  { path: "/change-password", name: "change-password", component: () => import("@/views/auth/ChangePassword.vue"), meta: { requiresAuth: true } },
  { path: "/employee/dashboard", name: "employee-dashboard", component: () => import("@/views/admin/owner/employee/EmployeeDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/employee/profile", name: "employee-profile-self", component: () => import("@/views/admin/owner/employee/EmployeeProfileSelf.vue"), meta: { requiresAuth: true, requiresPermission: "profile:view" } },
  { path: "/employee/change-password", name: "employee-change-password", component: () => import("@/views/admin/owner/employee/EmployeeChangePassword.vue"), meta: { requiresAuth: true, requiresPermission: "password:update" } },
  { path: "/face-reg", name: "face-registration", component: () => import("@/views/clinic/attendance/FaceRegistration.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:create" } },
  { path: "/support/report", name: "support-report", component: () => import("@/views/common/SupportReport.vue"), meta: { requiresAuth: true, requiresPermission: "support:view" } },
  { path: "/notifications", name: "notifications", component: () => import("@/views/common/Notifications.vue"), meta: { requiresAuth: true, requiresPermission: "notifications:view" } },
  { path: "/attendance/scan", name: "attendance-qr-scan", component: () => import("@/views/clinic/attendance/AttendanceQrScan.vue"), meta: { requiresAuth: true, requiresFeature: "attendance" } },

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
  { path: "/practitioner/activities", name: "practitioner-activities", component: () => import("@/views/admin/owner/clinic/PractitionerActivities.vue"), meta: { requiresAuth: true, requiresPermission: "activities:view" } },

  // HR routes
  { path: "/hr/dashboard", name: "hr-dashboard", component: () => import("@/views/admin/owner/hr/HRDashboard.vue"), meta: { requiresAuth: true, requiresFeature: "hr" } },
  { path: "/hr/employee-profile", name: "hr-employee-profile", component: () => import("@/views/admin/owner/hr/EmployeeProfile.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view", requiresFeature: "staff_management" } },
  { path: "/hr/add-employee", name: "hr-add-employee", component: () => import("@/views/admin/owner/hr/AddEmployee.vue"), meta: { requiresAuth: true, requiresPermission: "staff:create", requiresFeature: "staff_management" } },
  { path: "/hr/sales", name: "hr-sales", component: () => import("@/views/admin/owner/hr/HRSales.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
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

  // Owner routes
  { path: "/owner/dashboard", name: "owner-dashboard", component: () => import("@/views/admin/owner/OwnerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/owner/branch/branch-info", name: "owner-branch-info", component: () => import("@/views/admin/owner/BranchInfo.vue"), meta: { requiresAuth: true, requiresPermission: "branches:view" } },
  { path: "/owner/branch/add-branch", name: "owner-add-branch", component: () => import("@/views/admin/owner/AddBranch.vue"), meta: { requiresAuth: true, requiresPermission: "branches:create", requiresFeature: "multi_branch" } },
  { path: "/owner/staff/profiles", name: "owner-staff-profiles", component: () => import("@/views/admin/owner/StaffProfile.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/owner/staff/add-staff", name: "owner-add-staff", component: () => import("@/views/admin/owner/AddStaff.vue"), meta: { requiresAuth: true, requiresPermission: "staff:create" } },
  { path: "/owner/staff/archived", name: "owner-staff-archived", component: () => import("@/views/admin/owner/ArchivedEmployees.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/owner/staff/attendance", name: "owner-staff-attendance", component: () => import("@/views/admin/owner/Attendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view", requiresFeature: "attendance" } },
  { path: "/owner/staff/approve", name: "owner-staff-approve", component: () => import("@/views/admin/owner/hr/ApproveStaff.vue"), meta: { requiresAuth: true, requiresPermission: "staff:update" } },
  { path: "/owner/staff/roles", name: "owner-staff-roles", component: () => import("@/views/admin/owner/OwnerRoleManagement.vue"), meta: { requiresAuth: true, requiresPermission: "staff:update" } },
  { path: "/owner/finance", name: "owner-finance", component: () => import("@/views/admin/owner/OwnerFinance.vue"), meta: { requiresAuth: true } },
  { path: "/owner/clinic-profile", name: "owner-clinic-profile", component: () => import("@/views/admin/owner/ClinicProfile.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:view" } },
  { path: "/owner/reports", name: "owner-reports", component: () => import("@/views/admin/owner/OwnerReports.vue"), meta: { requiresAuth: true, requiresPermission: "reports:view", requiresFeature: "reports" } },
  { path: "/owner/account/backup", name: "owner-backup", component: () => import("@/views/admin/owner/OwnerBackup.vue"), meta: { requiresAuth: true, requiresPermission: "backup:view" } },
  { path: "/owner/account/subscription", name: "owner-subscription", component: () => import("@/views/admin/owner/OwnerSubscription.vue"), meta: { requiresAuth: true, requiresPermission: "subscription:view" } },
  { path: "/owner/account/plans", name: "owner-plan-selection", component: () => import("@/views/admin/owner/OwnerPlanSelection.vue"), meta: { requiresAuth: true } },
  { path: "/owner/clinic-page", name: "owner-clinic-page", component: () => import("@/views/admin/owner/ClinicPage.vue"), meta: { requiresAuth: true, requiresPermission: "clinic_profile:update" } },

  // Manager routes
  { path: "/manager/dashboard", name: "manager-dashboard", component: () => import("@/views/admin/owner/operations/ManagerDashboard.vue"), meta: { requiresAuth: true } },
  { path: "/manager/staffs", name: "manager-staffs", component: () => import("@/views/admin/owner/operations/ManagerStaffs.vue"), meta: { requiresAuth: true, requiresPermission: "staff:view" } },
  { path: "/manager/attendance", name: "manager-attendance", component: () => import("@/views/admin/owner/operations/ManagerAttendance.vue"), meta: { requiresAuth: true, requiresPermission: "attendance:view" } },
  { path: "/manager/archived-posts", name: "manager-archived-posts", component: () => import("@/views/admin/owner/operations/ArchivedPosts.vue"), meta: { requiresAuth: true, requiresPermission: "services:view" } },
  { path: "/manager/item-catalog", name: "manager-item-catalog", component: () => import("@/views/admin/owner/operations/SupplyCatalog.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/manager/suppliers", name: "manager-suppliers", component: () => import("@/views/admin/owner/operations/SupplySuppliers.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:view" } },
  { path: "/manager/purchase-requests", name: "manager-purchase-requests", component: () => import("@/views/admin/owner/operations/SupplyPurchaseRequests.vue"), meta: { requiresAuth: true, requiresPermission: "inventory:create" } },
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
  { path: "/finance/dashboard", name: "finance-dashboard", component: () => import("@/views/admin/owner/finance/FinanceDashboard.vue"), meta: { requiresAuth: true, requiresFeature: "reports" } },
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

  // Superadmin routes
  { path: "/superadmin/dashboard", name: "superadmin-dashboard", component: () => import("@/views/superAdmin/Dashboard.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/admin-list", name: "superadmin-admin-list", component: () => import("@/views/superAdmin/AdminList.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/subscription/plans", name: "superadmin-subscription-plans", component: () => import("@/views/superAdmin/SubscriptionPlans.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/subscription/permissions", name: "superadmin-subscription-permissions", component: () => import("@/views/superAdmin/SubscriptionPermission.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/subscription/payments", name: "superadmin-subscription-payments", component: () => import("@/views/superAdmin/SubscriptionPayments.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/clinics/verification", name: "superadmin-clinic-verification", component: () => import("@/views/superAdmin/ClinicVerification.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/clinics/verified", name: "superadmin-clinics-verified", component: () => import("@/views/superAdmin/VerifiedClinics.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/clinics/suspended", name: "superadmin-clinics-suspended", component: () => import("@/views/superAdmin/SuspendedClinics.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/clinics/archived", name: "superadmin-clinics-archived", component: () => import("@/views/superAdmin/ArchivedClinics.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/accounts/users", name: "superadmin-accounts-users", component: () => import("@/views/superAdmin/AccountManagement.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/activity-logs", name: "superadmin-activity-logs", component: () => import("@/views/superAdmin/ActivityLogs.vue"), meta: { requiresAuth: true } },
  { path: "/superadmin/tickets", name: "superadmin-tickets", component: () => import("@/views/superAdmin/UserTickets.vue"), meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const isOwnerLikeRole = (value) => {
  const compact = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return compact === "owner" || compact === "clinicadmin" || compact === "clinicadministrator";
};

const permissionAlternates = {
  'inventory:create': ['inventory:review'],
  'inventory:review': ['inventory:create'],
  'orders:view': ['inventory:view'],
};

// 🔧 Global guard
router.beforeEach(async (to, from, next) => {
  const { user, isLoading, initAuth } = useAuth();
  const { hasPermission } = usePermissions();
  const { hasFeature } = useSubscription();

  initAuth();

  if (isLoading.value) {
    return next();
  }

  // Auth-required routes
  if (to.meta.requiresAuth && !user.value) {
    return next("/login");
  }

  if (user.value?.uid) {
    try {
      const userSnap = await getDoc(doc(db, "users", user.value.uid));
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      const suspendedCenter = await getSuspendedCenterAccess(user.value.uid, userData);

      if (suspendedCenter) {
        await signOut(auth);
        return next("/login?suspended=1");
      }
    } catch (error) {
      console.error("Error verifying suspended center access in route guard:", error);
    }
  }

  let forcedEmployeePasswordChange = false
  if (user.value?.uid) {
    try {
      const userSnap = await getDoc(doc(db, "users", user.value.uid));
      const userData = userSnap.exists() ? userSnap.data() || {} : {};
      const userType = String(userData.userType || '').trim().toLowerCase();
      const mustChangePassword = userData.mustChangePassword === true
        || String(userData.mustChangePassword || '').trim().toLowerCase() === 'true'

      if (userType === 'staff' && mustChangePassword && to.path !== '/employee/change-password') {
        return next('/employee/change-password');
      }
      forcedEmployeePasswordChange = userType === 'staff' && mustChangePassword && to.path === '/employee/change-password';
    } catch (error) {
      console.error("Error verifying password change requirement in route guard:", error);
    }
  }

  // Guest-only routes (like /login)
  if (to.meta.guestOnly && user.value) {
    // Instead of forcing dashboard, just allow navigation
    return next();
  }

  // Permission-required routes
  if (to.meta.requiresPermission && !(to.path === '/employee/change-password' && forcedEmployeePasswordChange) && !hasPermission(to.meta.requiresPermission)) {
    if (user.value?.uid) {
      try {
        const userSnap = await getDoc(doc(db, "users", user.value.uid));
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
    return next("/unauthorized");
  }

  // Feature-required routes
  if (to.meta.requiresFeature && !hasFeature(to.meta.requiresFeature)) {
    return next("/subscription-features");
  }

  next();
});

export default router;
