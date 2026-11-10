/** HR's report shapes, which the app reads from the API and hands HR's views (ADR-074 stage 3). */

export interface ReportPerson {
  employeeId: string;
  name: string;
  job: string | null;
  team: string | null;
  branch: string | null;
}

export interface AttendanceFigures {
  shifts: number;
  present: number;
  absent: number;
  onLeave: number;
  late: number;
  lateMinutes: number;
  leftEarly: number;
  notCounted: number;
  workedMinutes: number;
  overtimeMinutes: number;
  approvedOvertimeMinutes: number;
}

export type AttendanceRow = ReportPerson & AttendanceFigures;

export interface ReportEvent {
  employeeId: string;
  date: string;
  kind: "late" | "absent" | "left_early" | "not_counted";
  shift: string | null;
  clockIn: string | null;
  minutes: number | null;
  note: string | null;
}

export interface ReportLeave extends ReportPerson {
  requestId: string;
  type: string;
  startsOn: string;
  endsOn: string;
  days: number;
  daysInPeriod: number;
  status: "approved" | "requested";
  reason: string | null;
}

export interface ReportPayMonth {
  month: string;
  status: string;
  people: number;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  netRwf: number;
  employerCostRwf: number;
}

export interface HrReport {
  from: string;
  to: string;
  today: string;
  people: {
    atStart: number;
    atEnd: number;
    joined: (ReportPerson & { on: string })[];
    left: (ReportPerson & { on: string; reason: string | null })[];
    byTeam: { name: string; count: number }[];
    byBranch: { name: string; count: number }[];
  };
  attendance: {
    totals: AttendanceFigures;
    people: AttendanceRow[];
    events: ReportEvent[];
    byWeekday: { day: string; late: number; absent: number }[];
  };
  leave: {
    byType: { type: string; people: number; days: number }[];
    taken: ReportLeave[];
    asked: { approved: number; declined: number; pending: number; cancelled: number };
  };
  /** Null for a reader without payroll access. */
  pay: ReportPayMonth[] | null;
  requests: {
    claims: { asked: number; approved: number; approvedRwf: number; pending: number };
    corrections: { asked: number; approved: number; declined: number; pending: number };
    helpDesk: { opened: number; closed: number };
  };
}
