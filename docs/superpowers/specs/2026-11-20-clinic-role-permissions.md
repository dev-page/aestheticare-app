# Clinic role permissions

## Goal

Make clinic roles understandable at the page level. Each switch controls the matching clinic page and maps to the existing server-side action permissions used by that page. Unchecked page switches hide the page and block direct URL access.

## Permission groups

- **Clinic Setup:** View Branches; Edit & Create Branches; Manage Clinic Profile; Manage Policies and Contract.
- **CRM & Clinic:** View Client List; Manage Walk-In Clients; Manage Appointments; Manage Prescriptions; View Transactions; Manage Inbox.
- **Human Resource:** Manage Roles; Manage Employee Accounts; Manage Overtime and Leave Requests; Request Leave; Request Overtime.
- **Finance:** Approve Service Listings; Approve Purchase Orders; Manage Payrolls; Manage Supplier Invoices; Manage Other Expenses.
- **Services:** Manage Service Listings, including archived posts.
- **Inventory:** Manage Inventory.
- **Pharmacy:** Manage Pharmacy.
- **Procurement:** Manage Suppliers; Manage Inventory Requests; Manage Purchase Orders.
- **Account Settings:** Manage Account; Manage Clinic Subscription; Manage Clinic Backup.
- **Clinic Administrator:** receives every clinic permission, without platform-wide administrator access.

Each control has a stable page-access key and a set of existing action grants. Server endpoints continue to check those action grants. Existing roles without page-access keys are interpreted from their current action grants until saved in the new format.

## Page behavior

- Branch viewing and branch editing are independent. Without Edit & Create Branches, the branch action menu remains visible but Edit and Link Policy are disabled. Creating additional branches remains subject to the subscription feature.
- Listing approval requires listing-review permission; financial-report access alone does not expose it.
- Client List does not require appointment access. Walk-In Desk, Appointment Management, and Prescriptions each have independent access switches.
- Employee Accounts covers staff profiles, creation/archive, shifts, compensation, and service commissions. Payroll Management and Payroll Approval are controlled by Manage Payrolls.
- Leave and overtime review appear together on a single management page. Leave and overtime request pages remain separately controlled.
- Supplier Invoice and Other Expense tabs are filtered independently.
- Account closure remains owner-only even though Manage Account controls employee profile, password, notifications, activity, and support pages.

## Clinic Administrator

The built-in Clinic Admin employee role gets every clinic page and action permission. It does not get the platform administrator permission or owner-only account closure.
