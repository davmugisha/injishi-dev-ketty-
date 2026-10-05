import { z } from "zod";
import { BulkRequest, defineListSpec, listPage } from "./list-query";
import { PayRun } from "./payroll";
import { AttendanceRecord, Employee, LeaveRequest, RosterEntry } from "./people";
import { LeaveAllocationRequest, LeaveBalanceRow } from "./leave";
import { AttendanceRequest, ShiftRequest } from "./time";
/**
 * The HR lists (ADR-058), declared once for the operator app and the API
 * (058-list-framework). Each declaration says which fields a person may filter,
 * sort and group by; the API refuses anything else (AC-LF3).
 *
 * The no ranking rule (contract 7) is part of these declarations: a field that
 * measures a person's work is declared `figure`, which `defineListSpec`
 * refuses to make sortable or groupable (AC-LF12). The attendance records
 * carry the only ones (058-time AC-TM13): late, early and overtime minutes,
 * filtered by equality at most, and seen only by the figure audience. A leave
 * request's length belongs to the request, not to a summary of the person.
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
        // 058-people-file AC-PF13. A file carries many tags, so `tag` filters and never groups.
        { key: "employeeType", label: "Employee type", type: "ref", filterable: true, groupable: true },
        { key: "tag", label: "Tag", type: "ref", filterable: true },
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
            enumValues: ["supervisor", "self", "phone", "kiosk"],
            enumLabels: { supervisor: "Supervisor", self: "Themselves", phone: "Their phone", kiosk: "Kiosk" },
            filterable: true,
            groupable: true,
        },
        { key: "validated", label: "Validated", type: "bool", filterable: true, groupable: true },
        // 058-time AC-TM4: closed by the sweep, waiting for someone to put the times right.
        { key: "autoClosed", label: "Closed by the sweep", type: "bool", filterable: true },
        // AC-TM13: work figures, for attendance.approve and people.manage only, never ordered.
        { key: "lateMinutes", label: "Late minutes", type: "number", filterable: true, figure: true },
        { key: "earlyMinutes", label: "Early minutes", type: "number", filterable: true, figure: true },
        { key: "overtimeMinutes", label: "Overtime minutes", type: "number", filterable: true, figure: true },
        // AC-TM8: overtime nobody has decided yet, the approver's queue.
        { key: "overtimePending", label: "Overtime to decide", type: "bool", filterable: true, figure: true },
    ],
});
export const AttendancePage = listPage(AttendanceRecord);
export type AttendancePage = z.infer<typeof AttendancePage>;
/** `GET /ops/shift-requests` (058-time AC-TM5): what is routed to the caller first. */
export const SHIFT_REQUEST_LIST = defineListSpec({
    key: "staff.shift-requests",
    searchFields: ["employee"],
    statusField: "status",
    defaultSort: [
        { field: "routedToMe", dir: "desc" },
        { field: "fromDate", dir: "asc" },
    ],
    fields: [
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "fromDate", label: "From", type: "date", filterable: true, sortable: true },
        { key: "toDate", label: "To", type: "date", filterable: true },
        {
            key: "kind",
            label: "Kind",
            type: "enum",
            enumValues: ["change", "swap"],
            enumLabels: { change: "Different shift", swap: "Swap" },
            filterable: true,
            groupable: true,
        },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["requested", "awaiting_colleague", "approved", "rejected", "cancelled"],
            enumLabels: {
                requested: "Waiting",
                awaiting_colleague: "Waiting for the colleague",
                approved: "Approved",
                rejected: "Refused",
                cancelled: "Cancelled",
            },
            filterable: true,
            groupable: true,
        },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "routedToMe", label: "Routed to me", type: "bool", filterable: true, sortable: true },
        { key: "createdAt", label: "Asked", type: "datetime", sortable: true },
    ],
});
export const ShiftRequestPage = listPage(ShiftRequest);
export type ShiftRequestPage = z.infer<typeof ShiftRequestPage>;
/** `GET /ops/attendance-requests` (058-time AC-TM6). */
export const ATTENDANCE_REQUEST_LIST = defineListSpec({
    key: "staff.attendance-requests",
    searchFields: ["employee"],
    statusField: "status",
    defaultSort: [
        { field: "routedToMe", dir: "desc" },
        { field: "workDate", dir: "desc" },
    ],
    fields: [
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "workDate", label: "Day", type: "date", filterable: true, sortable: true, groupable: true },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["requested", "approved", "rejected", "cancelled"],
            enumLabels: { requested: "Waiting", approved: "Approved", rejected: "Refused", cancelled: "Cancelled" },
            filterable: true,
            groupable: true,
        },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "routedToMe", label: "Routed to me", type: "bool", filterable: true, sortable: true },
        { key: "createdAt", label: "Asked", type: "datetime", sortable: true },
    ],
});
export const AttendanceRequestPage = listPage(AttendanceRequest);
export type AttendanceRequestPage = z.infer<typeof AttendanceRequestPage>;
/** `POST /ops/shift-requests/bulk` and `/ops/attendance-requests/bulk`: approve or refuse many, one command each. */
export const TimeRequestBulkRequest = BulkRequest.extend({
    action: z.enum(["approve", "reject"]),
    params: z.object({ note: z.string().trim().max(500).optional() }).optional(),
});
export type TimeRequestBulkRequest = z.infer<typeof TimeRequestBulkRequest>;
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
/** `GET /ops/leave/allocation-requests` (058-leave AC-LV8): extra and compensatory days, routed to the caller first. */
export const LEAVE_ALLOCATION_LIST = defineListSpec({
    key: "staff.leave-allocations",
    searchFields: ["employee"],
    statusField: "status",
    defaultSort: [
        { field: "routedToMe", dir: "desc" },
        { field: "createdAt", dir: "desc" },
    ],
    fields: [
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "leaveType", label: "Type", type: "ref", filterable: true, groupable: true },
        {
            key: "kind",
            label: "Kind",
            type: "enum",
            enumValues: ["extra", "compensatory"],
            enumLabels: { extra: "Extra days", compensatory: "Compensatory" },
            filterable: true,
            groupable: true,
        },
        {
            key: "status",
            label: "Status",
            type: "enum",
            enumValues: ["requested", "approved", "rejected", "cancelled"],
            enumLabels: { requested: "Waiting", approved: "Approved", rejected: "Refused", cancelled: "Withdrawn" },
            filterable: true,
            groupable: true,
        },
        { key: "days", label: "Days", type: "number", filterable: true, sortable: true },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "routedToMe", label: "Routed to me", type: "bool", filterable: true, sortable: true },
        { key: "createdAt", label: "Asked", type: "datetime", sortable: true },
    ],
});
export const LeaveAllocationPage = listPage(LeaveAllocationRequest);
export type LeaveAllocationPage = z.infer<typeof LeaveAllocationPage>;
/** `POST /ops/leave/allocation-requests/bulk`. */
export const LeaveAllocationBulkRequest = BulkRequest.extend({
    action: z.enum(["approve", "reject"]),
    params: z.object({ note: z.string().trim().max(300).optional() }).optional(),
});
export type LeaveAllocationBulkRequest = z.infer<typeof LeaveAllocationBulkRequest>;
/** `GET /ops/leave/balances` (058-leave AC-LV13): a row per person, a balance per type. */
export const LEAVE_BALANCE_LIST = defineListSpec({
    key: "staff.leave-balances",
    searchFields: ["employee"],
    defaultSort: [{ field: "employee", dir: "asc" }],
    fields: [
        { key: "employee", label: "Person", type: "text", sortable: true },
        { key: "branch", label: "Branch", type: "ref", filterable: true, groupable: true },
        { key: "jobPosition", label: "Position", type: "ref", filterable: true, groupable: true },
    ],
});
export const LeaveBalancePage = listPage(LeaveBalanceRow);
export type LeaveBalancePage = z.infer<typeof LeaveBalancePage>;
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
