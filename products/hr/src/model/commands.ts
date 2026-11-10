/**
 * The commands HR's views send, and the shapes they send. The app supplies every one of them as a server
 * action and hands them in through `HrProvider` (`./web`); a view never knows how a command reaches the API.
 */

import type { NewAnnouncement } from "./announcements.ts";
import type {
  PastRun,
  PayAmountInput,
  PayClaimView,
  PayLoansData,
  PayrollContributionList,
  PayrollSettingsView,
} from "./payroll.ts";
import type {
  AccessRoleId,
  EmployeeAccessView,
  EmployeeDocumentView,
  EmployeePersonalView,
  PlaceLevelId,
} from "./people.ts";
import type { CandidateStage } from "./talent.ts";
import type { ClockMode } from "./time.ts";

/** What a command answers: done, or the API's refusal in words the screen can show. */
export type Done = { ok: true } | { ok: false; error: string };

/** A command that hands back a value once it is done. */
export type DoneWith<T> = { ok: true; value: T } | { ok: false; error: string };

/** Desk entry for when the kiosk or phone could not record a clock. A justification is required. */
export interface DeskEntry {
  /** The employee (file) id. */
  employee: string;
  /** "15 Oct 2026" or "2026-10-15". */
  date: string;
  /** "06:00". */
  clockIn: string;
  /** "14:00", or empty while they are still on shift. */
  clockOut: string;
  reason: string;
  justification: string;
}

/** The roster week a command acts on. */
export type RosterWeekId = "this" | "next";

/** One roster cell: morning, evening, night, or off. */
export type ShiftLetter = "M" | "E" | "N" | "O";

/** A person's own leave request, from the staff phone. */
export interface LeaveAsk {
  leaveTypeId: string;
  from: string;
  to: string;
  reason?: string;
}

/** A person asking for a day's clock times to be put right, or a missing day to be written. */
export interface ClockFixAsk {
  /** The day, "2026-10-15". */
  workDate: string;
  /** "07:00". */
  inAt: string;
  /** "15:00"; before the in time means the next morning. */
  outAt: string;
  reason: string;
}

/** A read or a write that hands back a shape under `key`, or the API's refusal. */
type Got<K extends string, T> = ({ ok: true } & { [key in K]: T }) | { ok: false; error: string };

/** A file the API built or keeps, as a short-lived link to open. */
type Link = { ok: true; url: string } | { ok: false; error: string };

/** A new pairing code for an entrance tablet, good until `expiresAt`. */
type TabletCode = { ok: true; code: string; expiresAt: string } | { ok: false; error: string };

/** Every command an HR view may send. */
export interface HrActions {
  // People: leave, attendance, offboarding, the roster and rotations.
  decideLeave(id: string, decision: "approved" | "declined", reason?: string): Promise<Done>;
  cancelLeave(id: string, reason: string): Promise<Done>;
  decideExtraDays(id: string, decision: "approved" | "declined", reason?: string): Promise<Done>;
  decideCorrection(id: string, decision: "approved" | "declined", note?: string): Promise<Done>;
  saveDeskEntry(input: DeskEntry): Promise<Done & { name?: string }>;
  clockOutFromDesk(input: { recordId: string; date: string; time: string; clockedInAt?: string }): Promise<Done>;
  setOffboardingStep(id: string, done: boolean): Promise<Done>;
  setRosterShift(week: RosterWeekId, employeeId: string, dayIndex: number, shift: ShiftLetter): Promise<Done>;
  setRosterLent(week: RosterWeekId, employeeId: string, dayIndex: number, lent: boolean): Promise<Done>;
  publishRosterWeek(week: RosterWeekId): Promise<Done>;
  decideShiftSwap(id: string, decision: "approved" | "declined"): Promise<Done>;
  saveRosterCover(input: { teamId: string; shifts: ShiftLetter[]; minByWeekday: number[] }): Promise<Done>;
  acceptSwapForColleague(id: string): Promise<Done>;
  pickRosterBranch(id: string): Promise<Done>;
  askShiftChangeAction(day: string, shiftTemplateId: string, reason: string): Promise<Done>;
  checkPayslipPinAction(pin: string): Promise<Done>;
  askRotationAction(rotationPatternId: string, from: string, reason: string): Promise<Done>;
  createRotation(input: {
    name: string;
    steps: ShiftLetter[];
    rule: "every_n_days" | "weekly" | "monthly";
    ruleValue: number;
  }): Promise<Done>;
  addToRotation(input: {
    employeeId: string;
    patternId: string;
    startsOn: string;
    startStep: number;
    moveFrom?: { assignmentId: string; startsOn: string };
  }): Promise<Done>;
  takeOffRotation(assignmentId: string, endsOn: string): Promise<Done>;
  stopRotation(
    patternIds: string[],
    people: { assignmentId: string; startsOn: string }[],
    lastDay: string,
  ): Promise<Done>;

  // Employees: putting someone on file, their login and their documents.
  registerNewEmployee(input: NewEmployeeInput): Promise<Got<"registered", Registered>>;
  loadEmployeeAccess(employeeId: string): Promise<Got<"access", EmployeeAccessView>>;
  giveEmployeeAccess(
    employeeId: string,
    input: AccessInput,
  ): Promise<{ ok: true; access: EmployeeAccessView; outcome: "invited" | "requested" } | { ok: false; error: string }>;
  cancelEmployeeAccess(employeeId: string): Promise<Got<"access", EmployeeAccessView>>;
  loadEmployeeDocuments(employeeId: string): Promise<Got<"documents", EmployeeDocumentView[]>>;
  loadEmployeePersonal(employeeId: string): Promise<Got<"personal", EmployeePersonalView>>;
  /** One level of Rwanda's places under the one chosen above it, for the address picker. */
  loadPlaces(level: PlaceLevelId, parentId: number | string | null): Promise<{ id: number | string; name: string }[]>;
  openEmployeeDocument(documentId: string): Promise<Link>;
  decideEmployeeDocument(documentId: string, decision: "approved" | "declined", reason?: string): Promise<Done>;
  requestEmployeeDocument(employeeId: string, input: { title: string; note: string; dueOn: string }): Promise<Done>;

  // Clock-in rules and entrance tablets.
  saveClockRuleAction(
    propertyId: string,
    rule: {
      clockMode: ClockMode;
      opensMinutesBefore: number | null;
      geofenceRadiusM: number;
      centre?: { lat: number; lng: number } | null;
    },
  ): Promise<Done>;
  addTabletAction(propertyId: string, name: string): Promise<TabletCode>;
  newTabletCodeAction(id: string): Promise<TabletCode>;
  removeTabletAction(id: string): Promise<Done>;
  checkClockInAction(recordId: string, decision: { count: true } | { count: false; note: string }): Promise<Done>;

  // Payroll: the month's run, its files, claims and contributions.
  preparePayRun(period: string): Promise<Done>;
  recomputePayRun(id: string): Promise<Done>;
  holdPayslip(id: string, employeeId: string, reason: string): Promise<Done>;
  addPayAmount(input: PayAmountInput, key: string, runId: string | null): Promise<Done>;
  submitPayRun(id: string, note: string | null): Promise<Done>;
  withdrawPayRun(id: string, reason: string | null): Promise<Done>;
  confirmPayRun(id: string): Promise<Done>;
  buildPayFile(
    id: string,
    kind: "bank" | "momo" | "paye" | "rssb",
  ): Promise<{ ok: true; url: string; leftOut: string[] } | { ok: false; error: string }>;
  fixBlocker(employeeId: string, fix: StaffFileFix, runId: string | null): Promise<Done>;
  settleClockRecord(
    input: { kind: "out"; recordId: string; clockInAt: string; time: string } | { kind: "validate"; recordId: string },
    runId: string | null,
  ): Promise<Done>;
  loadPastRun(id: string): Promise<Got<"run", PastRun>>;
  loadClaims(): Promise<Got<"claims", PayClaimView[]>>;
  decidePayClaim(id: string, decision: "approve" | "reject", note: string | null): Promise<Done>;
  openClaimReceipt(id: string): Promise<Link>;
  loadContributions(): Promise<Got<"list", PayrollContributionList>>;
  chooseContribution(code: string, body: SetPayrollContributionRequest): Promise<Got<"list", PayrollContributionList>>;
  loadPayrollSettings(): Promise<Got<"settings", PayrollSettingsView>>;
  saveRssbEmployerNumber(value: string): Promise<Done>;
  loadLoans(): Promise<Got<"data", PayLoansData>>;
  /** `key` is one per form: a second press answers the first loan. */
  recordLoan(input: NewLoanInput, key: string): Promise<Done>;

  // Staff services: the help desk, things lent and announcements.
  answerHelpTicket(id: string, body: string, close: boolean): Promise<Done>;
  closeHelpTicket(id: string): Promise<Done>;
  lendItem(input: {
    employeeId: string;
    kind: AssetKindId;
    name: string;
    tag: string;
    issuedOn: string;
    dueBackOn: string;
    note: string;
  }): Promise<Done>;
  returnItem(id: string, how: "good" | "damaged" | "lost", today: string): Promise<Done>;
  postAnnouncementAction(input: NewAnnouncement): Promise<Done>;
  setAnnouncementShownAction(id: string, shown: boolean): Promise<Done>;

  // Talent: roles, candidates, the salary talk, interviews, reviews and joining lists.
  openVacancyAction(input: {
    title: string;
    branchId: string;
    openings: string;
    wageFrom: string;
    wageTo: string;
    closesOn: string;
    managerEmployeeId: string;
    note: string;
    documents: string[];
  }): Promise<Done>;
  setVacancyDocumentsAction(id: string, documents: string[]): Promise<Done>;
  closeVacancyAction(id: string, status: "closed" | "filled" | "open"): Promise<Done>;
  addCandidateAction(input: {
    vacancyId: string;
    fullName: string;
    phone: string;
    email: string;
    source: string;
    note: string;
    talentPool: boolean;
    expectedWage: string;
  }): Promise<Done>;
  addOfferRoundAction(id: string, side: "business" | "candidate", wage: string, note: string): Promise<Done>;
  agreeOfferAction(id: string, amountRwf: number): Promise<Done>;
  moveCandidateAction(
    id: string,
    stage: CandidateStage,
    extra?: { offerWage?: string; offerStartsOn?: string; reason?: string },
  ): Promise<Done>;
  scoreCandidateAction(id: string, what: string, score: number, note: string): Promise<Done>;
  bookInterviewAction(input: { candidateId: string; when: string; place: string; interviewer: string }): Promise<Done>;
  interviewStatusAction(id: string, status: "done" | "cancelled"): Promise<Done>;
  openReviewCycleAction(name: string, startsOn: string, endsOn: string): Promise<Done>;
  closeReviewCycleAction(id: string): Promise<Done>;
  updateReviewAction(
    id: string,
    patch: { selfDone?: boolean; managerDone?: boolean; rating?: number | null },
  ): Promise<Done>;
  tickOnboardingAction(taskId: string, done: boolean): Promise<Done>;

  // Self service, from the staff phone.
  askLeaveAction(input: LeaveAsk): Promise<DoneWith<string>>;
  cancelRequestAction(requestId: string): Promise<DoneWith<undefined>>;
  askSwapAction(day: string, colleagueId: string): Promise<DoneWith<string>>;
  answerSwapAction(requestId: string, answer: "accept" | "decline"): Promise<DoneWith<undefined>>;
  askExtraDaysAction(input: { leaveTypeId: string; days: number; reason: string }): Promise<DoneWith<undefined>>;
  handInDocumentAction(form: FormData): Promise<DoneWith<undefined>>;
  askClaimAction(form: FormData): Promise<DoneWith<undefined>>;
  cancelClaimAction(claimId: string): Promise<DoneWith<undefined>>;
  askHelpAction(topic: string, text: string): Promise<DoneWith<undefined>>;
  replyHelpAction(ticketId: string, text: string): Promise<DoneWith<undefined>>;
  sendSelfReviewAction(reviewId: string, note: string): Promise<DoneWith<undefined>>;
  askFixAction(input: ClockFixAsk): Promise<DoneWith<undefined>>;
  signOut(): Promise<void>;
}

export interface NewEmployeeInput {
  /** The business workspace that employs the person. */
  employerId: string;
  /** The candidate hired in Talent this file is for, so Talent links to it. */
  candidateId?: string;
  personal: {
    legalName: string;
    preferredName: string;
    sex: "female" | "male" | "";
    dateOfBirth: string;
    idType: "national_id" | "passport";
    idNumber: string;
    phone: string;
    email: string;
    maritalStatus: "" | "single" | "married" | "divorced" | "widowed";
    childrenCount: string;
    emergencyName: string;
    emergencyPhone: string;
    emergencyRelation: string;
    /** Where they live: the village (umudugudu) picked from Rwanda's places, if any. */
    villageId: number | null;
    /** Home address: the street line or a landmark. */
    street: string;
    /** Highest qualification, like "Diploma in hotel management". */
    qualification: string;
    /** Years of work before this job. */
    experienceYears: string;
  };
  job: {
    branchId: string;
    positionId: string;
    employeeTypeId: string;
    managerId: string;
    hiredOn: string;
    /** Empty: the business mints the next number. */
    employeeNumber: string;
  };
  contract: {
    /** Empty: no contract yet. */
    type: "" | "permanent" | "fixed_term" | "casual";
    endsOn: string;
    wageBasis: "monthly" | "daily" | "hourly";
    wage: string;
    noticeDays: string;
    rssbNumber: string;
  };
  payment: { method: "later" | "bank" | "momo"; bankName: string; accountNumber: string; momoPhone: string };
  access: {
    login: boolean;
    email: string;
    role: AccessRoleId;
    allBranches: boolean;
    branchIds: string[];
    note: string;
    /** Empty: no kiosk PIN yet. */
    kioskPin: string;
  };
}

export interface Registered {
  employeeId: string;
  employeeNumber: string;
  name: string;
  outcomes: RegisterOutcome[];
  /** The login's outcome, when one was given: sent at once, or waiting for the owner. */
  login: "invited" | "requested" | null;
}

export interface AccessInput {
  email: string;
  role: AccessRoleId;
  /** Null is every branch. */
  branchIds: string[] | null;
  note: string;
}

export interface SetPayrollContributionRequest {
  enabled: boolean;
  provider?: string | null;
  employeeAmountRwf?: number;
  employerAmountRwf?: number;
}

/** What a pay run blocker can put right on the file itself: the RSSB number, the ID. */
export interface StaffFileFix {
  rssbNumber?: string;
  idDocumentType?: "national_id" | "passport";
  idDocumentNumber?: string;
}

/** A loan or salary advance to record (`POST /ops/loans`): repaid in equal parts, one a month. */
export interface NewLoanInput {
  employeeId: string;
  kind: "loan" | "advance";
  amountRwf: number;
  /** "2026-11-06". */
  givenOn: string;
  installments: number;
  /** The first month repaid, "2026-11". */
  firstPeriod: string;
  /** Paid with the month's pay, or already handed over outside Injishi. */
  paidOut: "payslip" | "outside";
  reason: string | null;
}

export type AssetKindId = "key" | "uniform" | "phone" | "laptop" | "tool" | "other";

/** What happened to each part after the file was written. */
export interface RegisterOutcome {
  part: "details" | "contract" | "payment" | "pin" | "login" | "candidate";
  ok: boolean;
  /** "Contract recorded · RWF 320,000 a month", or the API's refusal. */
  detail: string;
}
