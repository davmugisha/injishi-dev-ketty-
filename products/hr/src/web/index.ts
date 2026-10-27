/**
 * HR's web views, and the provider an app mounts around them. The app hands each view its data as props,
 * and its links, commands and shell through `HrProvider`; nothing here reads the API or knows a URL.
 */
export { type HrLinks, HrProvider, type HrShell, type TopbarStatusProps } from "./mount.tsx";
export { PayRunView } from "./payroll/pay-run-view.tsx";
export { PayrollRulesView } from "./payroll/payroll-rules-view.tsx";
export { StaffServicesView } from "./payroll/staff-services-view.tsx";
export { TalentView } from "./payroll/talent-view.tsx";
export { AttendanceView } from "./people/attendance-view.tsx";
export { EmployeesView } from "./people/employees-view.tsx";
export { LeaveView } from "./people/leave-view.tsx";
export { PeopleHomeView } from "./people/people-home-view.tsx";
export { RosterView } from "./people/roster-view.tsx";
export { StaffMeView } from "./self-service/staff-me-view.tsx";
export { StaffScheduleView } from "./self-service/staff-schedule-view.tsx";
