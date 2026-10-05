import { z } from "zod";
import { BulkRequest, defineListSpec, listPage } from "./list-query";
import { PayRun } from "./payroll";
import { AttendanceRecord, Employee, LeaveRequest, RosterEntry } from "./people";
/**
 * The HR lists (ADR-058), declared once for the operator app and the API
 * (058-list-framework). Each declaration says which fields a person may filter,
 * sort and group by; the API refuses anything else (AC-LF3).
 *
 * The no ranking rule (contract 7) is part of these declarations: a field that
 * measures a person's work is declared `figure`, which `defineListSpec`
 * refuses to make sortable or groupable (AC-LF12). None of these five carries
 * one: a leave request's length belongs to the request, not to a summary of
 * the person.
 */
const EMPLOYEE_STATUS_LABELS = { active: "Working", offboarded: "Left" };
/** `GET /ops/employees`. Date of birth is sensitive: a `basic` caller cannot see or use it (AC-LF4). */
export const EMPLOYEE_LIST = defineListSpec({
    key: "staff.employees",
    searchFields: ["name", "legalName", "employeeNumber", "phone"],
    statusField: "status",
    defaultSort: [{ field: "employeeNumber", dir: "asc" }],
    fields: [
        { key: "employeeNumber", label: "Number", type: "text", filterable: true, sortable: true },
        { key: "name", label: "Name", type: "text", filterable: true, sortable: true },
        { key: "legalName", label: "Legal name", type: "text" },
        { key: "phone", label: "Phone", type: "text" },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["active", "offboarded"],
            enumLabels: EMPLOYEE_STATUS_LABELS,
            filterable: true,
            groupable: true,
        },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "department", label: "Department", type: "ref", filterable: true },
        { key: "jobPosition", label: "Job position", type: "ref", filterable: true, groupable: true },
        { key: "hiredOn", label: "Hired on", type: "date", filterable: true, sortable: true },
        { key: "hasAccount", label: "Has an account", type: "bool", filterable: true, groupable: true },
        { key: "detailsMissing", label: "Details missing", type: "bool", filterable: true },
        { key: "dateOfBirth", label: "Date of birth", type: "date", filterable: true, sortable: true, sensitive: true },
    ],
});
export const EmployeePage = listPage(Employee);
export type EmployeePage = z.infer<typeof EmployeePage>;
/**
 * `GET /ops/roster`. With no day filter it reads this week, Monday to Sunday in
 * Kigali; pages bound anything wider, which retired the first thread's 31 day
 * cap on a roster read.
 */
export const ROSTER_LIST = defineListSpec({
    key: "staff.roster",
    searchFields: ["employee"],
    statusField: "status",
    defaultSort: [
        { field: "workDate", dir: "asc" },
        { field: "startsAt", dir: "asc" },
    ],
    fields: [
        { key: "workDate", label: "Day", type: "date", filterable: true, sortable: true, groupable: true },
        { key: "startsAt", label: "Starts", type: "datetime", sortable: true },
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "shift", label: "Shift", type: "ref", filterable: true, groupable: true },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "department", label: "Department", type: "ref", filterable: true, groupable: true },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["scheduled", "cancelled"],
            enumLabels: { scheduled: "Scheduled", cancelled: "Cancelled" },
            filterable: true,
        },
    ],
});
export const RosterPage = listPage(RosterEntry);
export type RosterPage = z.infer<typeof RosterPage>;
/** `GET /ops/attendance`. With no day filter it reads today and anything still open. */
export const ATTENDANCE_LIST = defineListSpec({
    key: "staff.attendance",
    searchFields: ["employee"],
    statusField: "status",
    defaultSort: [{ field: "clockInAt", dir: "desc" }],
    fields: [
        { key: "workDate", label: "Day", type: "date", filterable: true, sortable: true, groupable: true },
        { key: "clockInAt", label: "Clocked in", type: "datetime", filterable: true, sortable: true },
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["open", "closed", "superseded"],
            enumLabels: { open: "Clocked in", closed: "Closed", superseded: "Corrected" },
            filterable: true,
        },
        {
            key: "source",
            label: "Recorded by",
            type: "enum",
            enumValues: ["supervisor", "self"],
            enumLabels: { supervisor: "Supervisor", self: "Themselves" },
            filterable: true,
            groupable: true,
        },
        { key: "validated", label: "Validated", type: "bool", filterable: true, groupable: true },
    ],
});
export const AttendancePage = listPage(AttendanceRecord);
export type AttendancePage = z.infer<typeof AttendancePage>;
/** `GET /ops/leave/requests`. */
export const LEAVE_REQUEST_LIST = defineListSpec({
    key: "staff.leave-requests",
    searchFields: ["employee"],
    statusField: "status",
    // The queue as it always read: what is routed to the caller first, then by first day.
    defaultSort: [
        { field: "routedToMe", dir: "desc" },
        { field: "startsOn", dir: "asc" },
    ],
    fields: [
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["requested", "approved", "rejected", "cancelled"],
            enumLabels: { requested: "Waiting", approved: "Approved", rejected: "Refused", cancelled: "Cancelled" },
            filterable: true,
            groupable: true,
        },
        { key: "leaveType", label: "Type", type: "ref", filterable: true, groupable: true },
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "startsOn", label: "From", type: "date", filterable: true, sortable: true },
        { key: "endsOn", label: "To", type: "date", filterable: true, sortable: true },
        { key: "days", label: "Days", type: "number", filterable: true, sortable: true },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "routedToMe", label: "Waiting on me", type: "bool", filterable: true, sortable: true },
        { key: "createdAt", label: "Requested", type: "datetime", filterable: true, sortable: true },
    ],
});
export const LeaveRequestPage = listPage(LeaveRequest);
export type LeaveRequestPage = z.infer<typeof LeaveRequestPage>;
/**
 * `POST /ops/leave/requests/bulk`: approve or refuse several requests, each as
 * the single command with its own checks, lock and audit row (AC-LF6).
 */
export const LeaveBulkRequest = BulkRequest.extend({
    action: z.enum(["approve", "reject"]),
    params: z.object({ note: z.string().trim().max(300).optional() }).optional(),
});
export type LeaveBulkRequest = z.infer<typeof LeaveBulkRequest>;
/** `GET /ops/pay-runs`. */
export const PAY_RUN_LIST = defineListSpec({
    key: "staff.pay-runs",
    statusField: "status",
    defaultSort: [{ field: "periodStart", dir: "desc" }],
    fields: [
        { key: "periodStart", label: "Month", type: "date", filterable: true, sortable: true },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["draft", "confirmed"],
            enumLabels: { draft: "Draft", confirmed: "Confirmed" },
            filterable: true,
        },
        { key: "headcount", label: "People", type: "number", sortable: true },
        { key: "grossRwf", label: "Gross", type: "money", sortable: true },
        { key: "netRwf", label: "Net", type: "money", sortable: true },
    ],
});
export const PayRunPage = listPage(PayRun);
export type PayRunPage = z.infer<typeof PayRunPage>;
