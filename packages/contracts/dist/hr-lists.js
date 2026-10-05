"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayRunPage = exports.PAY_RUN_LIST = exports.LeaveBulkRequest = exports.LeaveRequestPage = exports.LEAVE_REQUEST_LIST = exports.TimeRequestBulkRequest = exports.AttendanceRequestPage = exports.ATTENDANCE_REQUEST_LIST = exports.ShiftRequestPage = exports.SHIFT_REQUEST_LIST = exports.AttendancePage = exports.ATTENDANCE_LIST = exports.RosterPage = exports.ROSTER_LIST = exports.EmployeePage = exports.EMPLOYEE_LIST = void 0;
const zod_1 = require("zod");
const list_query_1 = require("./list-query");
const payroll_1 = require("./payroll");
const people_1 = require("./people");
const time_1 = require("./time");
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
exports.EMPLOYEE_LIST = (0, list_query_1.defineListSpec)({
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
exports.EmployeePage = (0, list_query_1.listPage)(people_1.Employee);
/**
 * `GET /ops/roster`. With no day filter it reads this week, Monday to Sunday in
 * Kigali; pages bound anything wider, which retired the first thread's 31 day
 * cap on a roster read.
 */
exports.ROSTER_LIST = (0, list_query_1.defineListSpec)({
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
exports.RosterPage = (0, list_query_1.listPage)(people_1.RosterEntry);
/** `GET /ops/attendance`. With no day filter it reads today and anything still open. */
exports.ATTENDANCE_LIST = (0, list_query_1.defineListSpec)({
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
exports.AttendancePage = (0, list_query_1.listPage)(people_1.AttendanceRecord);
/** `GET /ops/shift-requests` (058-time AC-TM5): what is routed to the caller first. */
exports.SHIFT_REQUEST_LIST = (0, list_query_1.defineListSpec)({
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
exports.ShiftRequestPage = (0, list_query_1.listPage)(time_1.ShiftRequest);
/** `GET /ops/attendance-requests` (058-time AC-TM6). */
exports.ATTENDANCE_REQUEST_LIST = (0, list_query_1.defineListSpec)({
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
exports.AttendanceRequestPage = (0, list_query_1.listPage)(time_1.AttendanceRequest);
/** `POST /ops/shift-requests/bulk` and `/ops/attendance-requests/bulk`: approve or refuse many, one command each. */
exports.TimeRequestBulkRequest = list_query_1.BulkRequest.extend({
    action: zod_1.z.enum(["approve", "reject"]),
    params: zod_1.z.object({ note: zod_1.z.string().trim().max(500).optional() }).optional(),
});
/** `GET /ops/leave/requests`. */
exports.LEAVE_REQUEST_LIST = (0, list_query_1.defineListSpec)({
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
exports.LeaveRequestPage = (0, list_query_1.listPage)(people_1.LeaveRequest);
/**
 * `POST /ops/leave/requests/bulk`: approve or refuse several requests, each as
 * the single command with its own checks, lock and audit row (AC-LF6).
 */
exports.LeaveBulkRequest = list_query_1.BulkRequest.extend({
    action: zod_1.z.enum(["approve", "reject"]),
    params: zod_1.z.object({ note: zod_1.z.string().trim().max(300).optional() }).optional(),
});
/** `GET /ops/pay-runs`. */
exports.PAY_RUN_LIST = (0, list_query_1.defineListSpec)({
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
exports.PayRunPage = (0, list_query_1.listPage)(payroll_1.PayRun);
//# sourceMappingURL=hr-lists.js.map