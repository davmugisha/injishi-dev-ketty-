/**
 * The government console's own types.
 *
 * Lifted from `apps/app/src/pms/data/types.ts` when the console moved out
 * (ADR-018, move 2). The console keeps only what it uses: an officer, the orgs
 * in the registration pipeline, the decision log and the reject reasons. It
 * carries no property, no reservation and no workspace, because an officer's
 * authority is an assignment against a district and never a workspace row.
 */

export type Intent = "ok" | "warn" | "bad" | "info" | "accent" | "neutral";

export type OfficerKey = "verifier" | "approver";

/** The five pipeline stages, plus the recoverable `rejected` branch. */
export type RegStage = "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected";

export type BusinessType = "host" | "landlord" | "broker";

/**
 * An officer is a grant, not an account type: a KYC'd person, a function, an
 * issuing body, and a jurisdiction. `actsOn` is the only stage they can move.
 */
export interface Officer {
  key: OfficerKey;
  name: string;
  ini: string;
  /** The permission name the backend will check. */
  fn: "business_field_verifier" | "business_approver";
  fnLabel: string;
  /** The verb on their primary button. */
  act: string;
  body: string;
  bodyName: string;
  title: string;
  /**
   * All three levels, since ADR-053. It was `"district"` because the fixture only
   * ever described district officers; a country or province appointment is a real
   * grant the admin console can now make.
   */
  scopeLevel: "country" | "province" | "district";
  /** The region IN WORDS, from the server. A country grant reads as Rwanda. */
  scope: string;
  actsOn: RegStage;
  /** The officer's seal colour, used for their identity square only. */
  seal: string;
}

/** [display name, what it is]. */
export type RegDoc = [string, string];

/** One location a business declared at registration (ADR-054 AC-R4). */
export interface RegBranch {
  name: string;
  district: string | null;
  isHeadOffice: boolean;
}

export interface RegOrg {
  id: string;
  biz: string;
  type: BusinessType;
  /** `me` means the file belongs to the signed-in registrant. */
  registrant: "me" | "other";
  owner?: string;
  tin: string;
  /** Accommodation or residence classification code. */
  cls: string;
  tourismLic?: string;
  rha?: boolean;
  star?: number;
  upi?: string;
  district: string;
  sector: string;
  address: string;
  docs: RegDoc[];
  /**
   * Every location the business declared, head office first (ADR-054 AC-R4).
   * Absent on a fixture that predates branches; the live queue always sends it.
   */
  branches?: RegBranch[];
  stage: RegStage;
  /** Hours in the queue. Past 48 the row reads as overdue. */
  ageH: number;
  submittedTs: string;
  /** Registered on behalf of the owner by an agent — payouts stay locked. */
  obo: boolean;
  tinOk: boolean;
  fieldVerifiedBy: string | null;
  approvedBy: string | null;
  rejectReason: string | null;
  rejectNote: string;
  /** Where a rejected file returns to when it is fixed. */
  prevStage: RegStage | null;
  /**
   * From the approval queue: this officer field-verified the row and may not
   * approve it. Absent or false on every other surface.
   */
  blockedBySeparationOfDuties?: boolean;
}

/** One entry in an officer's decision log. Append-only (ADR-053, AC-G6). */
export interface Decision {
  /** The review row. */
  id: string;
  orgId: string;
  biz: string;
  action: string;
  reason?: string;
  note?: string;
  /** The government title AS RECORDED on the decision, not the posting today. */
  title: string | null;
  /** The body code as recorded on the decision. */
  body: string;
  ts: string;
}

/** [code, label, explanation]. `other` is the only one that forces a note. */
export type RejectReason = [string, string, string];

/** A registered business as the district overview sees it. */
export interface PerfRow {
  biz: string;
  type: BusinessType;
  sector: string;
  open: boolean;
  note?: string;
  metric: string;
  /** Occupancy percentage. */
  occ: number;
  /** [month-on-month label, intent]. */
  mom: [string, Intent];
}

export interface OversightData {
  orgs: RegOrg[];
  perf: PerfRow[];
  rejectReasons: RejectReason[];
  /** This officer's own decisions, newest first, from the server. */
  decisions: Decision[];
}
