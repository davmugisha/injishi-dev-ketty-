import type { BoardId, FixtureSet, IconName } from "../types.ts";

/**
 * Embedded-database fixtures for the "owner" area: Approvals, Reports, Compliance, Team and roles,
 * Plan and billing, and the settings screens (business structure, policies, integrations, audit log).
 * Collection names are "owner.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

/** Semantic tone of a chip, dot or icon (mapped to HeroUI colours by `toneColor`). */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** A label/value pair (key figures, evidence facts). */
export interface OwnerPair {
  label: string;
  value: string;
}

/** A link to another screen, e.g. "Open the source". */
export interface OwnerLink {
  label: string;
  board: BoardId;
}

// ── Approvals ───────────────────────────────────────────────────────────────────────────────────────────
export type ApprovalArea = "money" | "people" | "fiscal" | "rates";

/** One check on a request: passed, needs attention, or a note. */
export interface ApprovalCheck {
  kind: "ok" | "warn" | "info";
  text: string;
}

/** A request waiting for the owner, with its evidence. `decision` is written when the owner decides. */
export interface ApprovalRequest {
  id: string;
  area: ApprovalArea;
  tone: Tone;
  icon: IconName;
  type: string;
  title: string;
  who: string;
  initials: string;
  whoRole: string;
  whoProposed: boolean;
  when: string;
  due: string;
  dueTone: Tone;
  isNew: boolean;
  stepUp: boolean;
  needAck: boolean;
  reason: string;
  figures: OwnerPair[];
  facts: OwnerPair[];
  checks: ApprovalCheck[];
  rules: { name: string; version: string }[];
  exceptions: { tag: string; text: string }[];
  after: { status: "current" | "default"; title: string; detail: string }[];
  links: OwnerLink[];
  approveLabel: string;
  footNote: string;
  okTitle: string;
  okDesc: string;
  decision: "approved" | "declined" | null;
  decisionReason: string;
}

/** A decision taken in the last 60 days (read-only history). */
export interface ApprovalHistoryEntry {
  id: string;
  when: string;
  title: string;
  ref: string;
  by: string;
  decision: string;
  decisionTone: Tone;
  decider: string;
  note: string;
}

const approvalRequests: ApprovalRequest[] = [
  {
    id: "payrun",
    area: "people",
    tone: "accent",
    icon: "Sack",
    type: "Payroll · maker–checker",
    title: "Confirm October pay run",
    who: "Diane Ingabire",
    initials: "DI",
    whoRole: "HR officer",
    whoProposed: true,
    when: "11 Oct, 16:20",
    due: "Pay date Fri 23 Oct",
    dueTone: "default",
    isNew: false,
    stepUp: true,
    needAck: true,
    reason:
      "October run calculated from approved attendance to 10 Oct and the published roster after that. Three exceptions explained below.",
    figures: [
      { label: "Staff paid", value: "48" },
      { label: "Gross pay", value: "RWF 24,560,000" },
      { label: "Net pay", value: "RWF 19,800,000" },
      { label: "Employer cost", value: "RWF 25,970,000" },
    ],
    facts: [
      { label: "Pay run", value: "PR-2026-10 · October 2026" },
      { label: "Snapshot", value: "Version 3 · locked 11 Oct 16:18" },
      { label: "Deductions", value: "PAYE RWF 3,180,000 · RSSB employee RWF 1,290,000 · loans RWF 290,000" },
      { label: "Against September", value: "+RWF 612,000 · two hires, Kivu Hall event overtime" },
      { label: "Paid through", value: "41 by GT Bank transfer file · 7 by MTN MoMo file" },
    ],
    checks: [
      {
        kind: "ok",
        text: "Prepared by Diane Ingabire. You did not prepare or edit this run, so you can confirm it. Whoever prepares a run can never confirm it.",
      },
      { kind: "ok", text: "Totals match snapshot v3. Any edit sends the run back to Diane as version 4." },
      {
        kind: "warn",
        text: "Two payroll rules are configured but not yet signed off by your payroll adviser. Confirming records a documented exception.",
      },
      { kind: "info", text: "Confirming does not pay anyone. Releasing the payment file is a separate, later action." },
    ],
    rules: [
      { name: "PAYE bands", version: "Version 2026.1 · effective 1 Jan 2026" },
      { name: "RSSB contributions", version: "Version 2026.2 · effective 1 Jul 2026" },
    ],
    exceptions: [
      { tag: "Overtime", text: "4 kitchen staff above 48 hours in a week, approved by Aline Uwase" },
      { tag: "Prorated", text: "2 new hires paid from 6 Oct" },
      {
        tag: "Pay method",
        text: "Jean-Paul Niyonsaba changed bank on 9 Oct; paid by MTN MoMo until the new account is checked",
      },
    ],
    after: [
      { status: "current", title: "You confirm snapshot v3", detail: "Step-up verification required" },
      {
        status: "default",
        title: "Diane prepares the bank and MoMo payment files",
        detail: "Files are built from the confirmed snapshot only",
      },
      {
        status: "default",
        title: "Payment-file release, a separate action",
        detail: "Needs its own approval. Nothing is paid automatically.",
      },
      { status: "default", title: "Payslips published to staff on 23 Oct", detail: "Each person sees only their own" },
    ],
    links: [
      { label: "Pay run PR-2026-10", board: "PayRun" },
      { label: "Payroll rules", board: "PayrollRules" },
    ],
    approveLabel: "Confirm pay run",
    footNote: "Confirming locks snapshot v3 for payment. It does not release money.",
    okTitle: "Snapshot v3 confirmed at 10:42",
    okDesc:
      "Nobody has been paid. Diane prepares the payment files next; releasing them needs a separate approval. Rule exception recorded.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "refund",
    area: "money",
    tone: "warning",
    icon: "ArrowUturnCcwLeft",
    type: "Refund above limit",
    title: "Refund RWF 480,000 above the RWF 300,000 limit",
    who: "Eric Habimana",
    initials: "EH",
    whoRole: "Front desk",
    whoProposed: false,
    when: "11 Oct, 18:05",
    due: "Guest waiting",
    dueTone: "warning",
    isNew: true,
    stepUp: false,
    needAck: false,
    reason: "The organiser’s flights moved, so the Volcano view group cancelled 13 days before arrival.",
    figures: [
      { label: "Deposit paid", value: "RWF 800,000" },
      { label: "Policy tier", value: "Tier 2 · 60%" },
      { label: "Refund due", value: "RWF 480,000" },
      { label: "Kept", value: "RWF 320,000" },
    ],
    facts: [
      { label: "Booking", value: "BK-20418 · Volcano view group · 6 rooms, 14–16 Oct" },
      { label: "Cancelled", value: "11 Oct 17:52 · 2 of 6 rooms · 3 days before arrival" },
      { label: "Policy", value: "Flexible 14-day · version 4 · stored with the booking" },
      { label: "Original payment", value: "PI-77140 · MTN MoMo · Verified · ref MP260920.1012.C55120 · 20 Sep 10:12" },
      { label: "Refund to", value: "Same MoMo number, +250 78• ••• 330" },
    ],
    checks: [
      { kind: "ok", text: "Amount matches tier 2 of the policy version this booking was sold with." },
      { kind: "ok", text: "The original payment is Verified with provider evidence." },
      { kind: "warn", text: "Above the RWF 300,000 limit for front desk and finance, so it needs you." },
      { kind: "info", text: "You decide the refund. Payments executes it and shows the provider’s result." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You approve the refund decision", detail: "Recorded with the policy version" },
      {
        status: "default",
        title: "Payments sends RWF 480,000 through the GT Bank adapter",
        detail: "Status: Initiated, then Pending",
      },
      {
        status: "default",
        title: "Refunded only when MTN confirms",
        detail: "Provider reference shown on the payment record",
      },
      { status: "default", title: "Finance issues the refund receipt", detail: "A new fiscal document, never an edit" },
    ],
    links: [
      { label: "Booking BK-20418", board: "ReservationDetail" },
      { label: "Payment PI-77140", board: "Payments" },
      { label: "Cancellation policy", board: "SettingsPolicies" },
    ],
    approveLabel: "Approve refund",
    footNote: "Approving records the decision. The money moves only when Payments executes and the provider confirms.",
    okTitle: "Refund decision approved · sent to Payments",
    okDesc: "Status: Initiated. It shows Refunded only when MTN MoMo confirms, with the provider reference.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "rate",
    area: "rates",
    tone: "accent",
    icon: "Tag",
    type: "Rate change · revenue recommendation",
    title: "Publish Deluxe Lake View rate for 24–26 Oct",
    who: "Aline Uwase",
    initials: "AU",
    whoRole: "General manager",
    whoProposed: false,
    when: "12 Oct, 09:15",
    due: "Expires 18:00",
    dueTone: "warning",
    isNew: true,
    stepUp: false,
    needAck: false,
    reason: "Agree with the recommendation. The EAC Health Forum is in town and we have six Deluxe rooms left.",
    figures: [
      { label: "Current rate", value: "RWF 140,000" },
      { label: "Recommended", value: "RWF 152,000" },
      { label: "Nights", value: "24–26 Oct · 3" },
      { label: "Deluxe left", value: "6 of 12" },
    ],
    facts: [
      { label: "Room type", value: "Deluxe Lake View · Isangano Lakeside Hotel" },
      { label: "Source", value: "Revenue rule “High demand” · generated 12 Oct 08:00" },
      { label: "Reviewed by", value: "Aline Uwase · 12 Oct 09:15" },
      { label: "Pace", value: "EAC Health Forum block 21 of 25 picked up · 9 Deluxe nights booked in 7 days" },
      { label: "Same dates 2025", value: "ADR RWF 138,000 · 74% occupancy" },
    ],
    checks: [
      { kind: "info", text: "A recommendation from booking pace and your rules. It is not a forecast." },
      { kind: "ok", text: "Existing bookings keep the rate they were sold with." },
      { kind: "ok", text: "Deluxe Lake View is mapped on every connected channel." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You publish the rate", detail: "Audited as a rate change" },
      { status: "default", title: "Direct and marketplace update at once", detail: "" },
      {
        status: "default",
        title: "Channel manager receives the change",
        detail: "Each channel confirms separately in Distribution",
      },
    ],
    links: [
      { label: "Recommendation", board: "Revenue" },
      { label: "Rates & inventory", board: "RatesInventory" },
      { label: "Distribution", board: "Channels" },
    ],
    approveLabel: "Publish rate",
    footNote: "After 18:00 the recommendation recalculates and this request closes.",
    okTitle: "Rate published at 10:42",
    okDesc: "Direct and marketplace show RWF 152,000. Channel confirmations are tracked in Distribution.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "invite",
    area: "people",
    tone: "warning",
    icon: "PersonPlus",
    type: "Team invite · proposed role",
    title: "Invite Grace Uwera as Finance",
    who: "Aline Uwase",
    initials: "AU",
    whoRole: "General manager",
    whoProposed: false,
    when: "12 Oct, 09:58",
    due: "New role",
    dueTone: "warning",
    isNew: true,
    stepUp: true,
    needAck: false,
    reason: "We need someone on payment reconciliation and the fiscal queue before month-end.",
    figures: [
      { label: "Role", value: "Finance" },
      { label: "Permissions", value: "7" },
      { label: "Scope", value: "2 properties" },
      { label: "Invite valid", value: "7 days" },
    ],
    facts: [
      { label: "Person", value: "Grace Uwera · grace.uwera@amahoro.rw" },
      {
        label: "Permissions",
        value: "money.view, folio.charge, folio.payment, folio.close, ebm.manage, ebm.refund, refund.decide",
      },
      { label: "Scope", value: "Amahoro Hospitality Ltd: Isangano Lakeside Hotel, Ishyamba Forest Lodge" },
      { label: "Not included", value: "Kacyiru Court Residences, payroll, staff files" },
      { label: "Sign-in", value: "Two-step verification required" },
    ],
    checks: [
      {
        kind: "warn",
        text: "Finance is a proposed role. Its permission set may still change, and you will be told before it does.",
      },
      { kind: "ok", text: "Cannot change rates, read staff files or reply to guests." },
      { kind: "info", text: "Approving sends the invite. Access starts only when Grace accepts and signs in." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You approve the invite", detail: "Step-up verification required" },
      { status: "default", title: "Grace receives the invite by email", detail: "Valid until 19 Oct" },
      { status: "default", title: "Access starts when she accepts", detail: "Shown in Team & roles" },
    ],
    links: [{ label: "Team & roles", board: "TeamRoles" }],
    approveLabel: "Approve invite",
    footNote: "Only the owner can grant team access.",
    okTitle: "Invite sent at 10:42",
    okDesc: "Grace has until 19 Oct to accept. She has no access until then.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "writeoff",
    area: "money",
    tone: "default",
    icon: "FileXmark",
    type: "Write-off",
    title: "Write off RWF 86,500 on folio F-5512",
    who: "Aline Uwase",
    initials: "AU",
    whoRole: "General manager",
    whoProposed: false,
    when: "10 Oct, 15:30",
    due: "Due 15 Oct",
    dueTone: "default",
    isNew: false,
    stepUp: false,
    needAck: false,
    reason: "Charges posted after departure. Card declined, MoMo request expired, and no reply to email.",
    figures: [
      { label: "Balance", value: "RWF 86,500" },
      { label: "Age", value: "19 days" },
      { label: "Contact attempts", value: "3" },
      { label: "Guest", value: "Pierre Laurent" },
    ],
    facts: [
      { label: "Folio", value: "F-5512 · stay ST-8790 · checked out 23 Sep" },
      { label: "Charges", value: "Lake Bar RWF 46,500 · laundry RWF 40,000" },
      { label: "Attempts", value: "Card declined 24 Sep · MoMo request expired 27 Sep · email 2 Oct" },
      { label: "Reason code", value: "Uncollectable after departure" },
      { label: "Ledger", value: "Bad debt · Administrative and general" },
    ],
    checks: [
      { kind: "ok", text: "Reason code and three documented contact attempts recorded." },
      { kind: "warn", text: "Above the RWF 50,000 write-off limit for managers." },
      { kind: "info", text: "Charges stay on the folio. The write-off is a ledger entry; nothing is deleted." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You approve the write-off", detail: "" },
      { status: "default", title: "Ledger posts RWF 86,500 to bad debt", detail: "" },
      {
        status: "default",
        title: "Folio F-5512 closes with balance RWF 0",
        detail: "Write-off line visible on the folio",
      },
    ],
    links: [
      { label: "Folio F-5512", board: "StayFolio" },
      { label: "General ledger", board: "GeneralLedger" },
    ],
    approveLabel: "Approve write-off",
    footNote: "If the guest pays later, the payment reverses the write-off.",
    okTitle: "Write-off approved at 10:42",
    okDesc: "Ledger entry posted to bad debt. Folio F-5512 shows the write-off line.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "reopen",
    area: "money",
    tone: "default",
    icon: "ArrowRotateLeft",
    type: "Folio reopen",
    title: "Reopen folio F-5527 to move a bar charge",
    who: "Eric Habimana",
    initials: "EH",
    whoRole: "Front desk",
    whoProposed: false,
    when: "11 Oct, 09:20",
    due: "Due 14 Oct",
    dueTone: "default",
    isNew: false,
    stepUp: false,
    needAck: false,
    reason: "Lake Bar ticket LB-3381 was signed by the guest in 214 but posted to room 204.",
    figures: [
      { label: "Charge", value: "RWF 18,000" },
      { label: "From", value: "Room 204" },
      { label: "To", value: "Room 214" },
      { label: "Fiscal receipt", value: "Issued" },
    ],
    facts: [
      { label: "Folio", value: "F-5527 · Grace Achieng · closed 10 Oct 11:02" },
      { label: "Charge", value: "Lake Bar LB-3381 · 9 Oct 21:40" },
      { label: "Fiscal receipt", value: "EBM-ISG-2026-018842 · Issued 10 Oct 11:02" },
      { label: "Correction", value: "Credit note against that receipt, then post to F-5534 (room 214)" },
    ],
    checks: [
      { kind: "ok", text: "The issued fiscal receipt is never edited. Finance issues a credit note." },
      {
        kind: "warn",
        text: "Grace Achieng paid in full, so she is owed RWF 18,000. That refund is a separate decision.",
      },
      { kind: "info", text: "The folio reopens for this correction only." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You approve reopening", detail: "" },
      { status: "default", title: "Credit note sent to the VSDC", detail: "Pending until signed" },
      { status: "default", title: "Charge posted to F-5534", detail: "Refund decision raised for Grace Achieng" },
    ],
    links: [
      { label: "Folio F-5527", board: "StayFolio" },
      { label: "Fiscal receipts", board: "FiscalReceipts" },
    ],
    approveLabel: "Approve reopening",
    footNote: "Reopening a closed folio always needs owner approval.",
    okTitle: "Reopen approved at 10:42",
    okDesc: "Credit note queued at the VSDC (Pending). Eric can now move the charge.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "ebm",
    area: "fiscal",
    tone: "danger",
    icon: "ShieldKeyhole",
    type: "Fiscal configuration",
    title: "Change VSDC credentials for Ishyamba Forest Lodge",
    who: "Aline Uwase",
    initials: "AU",
    whoRole: "General manager",
    whoProposed: false,
    when: "11 Oct, 15:40",
    due: "Receipts pending",
    dueTone: "danger",
    isNew: false,
    stepUp: true,
    needAck: false,
    reason:
      "The lodge device failed on 10 Oct and our EBM provider replaced it. New credentials are needed to sign receipts.",
    figures: [
      { label: "Legal entity", value: "Amahoro Hospitality Ltd" },
      { label: "TIN", value: "102 345 678" },
      { label: "Branch", value: "Ishyamba" },
      { label: "Takes effect", value: "On approval" },
    ],
    facts: [
      { label: "Current device", value: "SDC-ISH-01 · serial ending 0417 · since 2 Mar 2026" },
      { label: "New device", value: "Serial ending 1186 · installed by your EBM provider 10 Oct" },
      { label: "Test receipt", value: "Sent in test mode 11 Oct 15:10 · Pending, not yet signed" },
      { label: "Certification", value: "Integration certification pending" },
    ],
    checks: [
      {
        kind: "warn",
        text: "The test receipt has not been signed yet. After approval, lodge receipts stay Pending until the device responds.",
      },
      { kind: "ok", text: "Receipts already issued keep their original device and signature." },
      { kind: "info", text: "Credentials are stored encrypted and never shown again after saving." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You approve the change", detail: "Step-up verification required" },
      { status: "default", title: "Next lodge receipt uses the new device", detail: "" },
      { status: "default", title: "First receipt checked at the VSDC", detail: "You are alerted if it is rejected" },
    ],
    links: [
      { label: "EBM / VSDC settings", board: "Integrations" },
      { label: "Fiscal queue", board: "FiscalReceipts" },
    ],
    approveLabel: "Approve change",
    footNote: "Only the owner can change fiscal credentials.",
    okTitle: "Credentials changed at 10:42",
    okDesc: "The next Ishyamba receipt goes to the new device. It stays Pending until the VSDC signs it.",
    decision: null,
    decisionReason: "",
  },
  {
    id: "override",
    area: "money",
    tone: "warning",
    icon: "ScalesBalanced",
    type: "Money override · two approvers",
    title: "Match a GT Bank transfer to invoice INV-26-0412",
    who: "Aline Uwase",
    initials: "AU",
    whoRole: "General manager",
    whoProposed: false,
    when: "11 Oct, 08:41",
    due: "1 of 2 approvals",
    dueTone: "warning",
    isNew: true,
    stepUp: true,
    needAck: false,
    reason: "Umurage Consulting paid without the invoice number. I confirmed with their finance team by phone.",
    figures: [
      { label: "Bank line", value: "RWF 1,250,000" },
      { label: "Invoice", value: "RWF 1,250,000" },
      { label: "Difference", value: "RWF 0" },
      { label: "Approvals", value: "1 of 2" },
    ],
    facts: [
      { label: "Statement line", value: "GT Bank · 10 Oct · credit RWF 1,250,000 · “UMURAGE CONSULT OCT”" },
      { label: "Source", value: "Statement file uploaded by Aline Uwase 11 Oct 08:30, not a live bank feed" },
      { label: "Invoice", value: "INV-26-0412 · Umurage Consulting Ltd · due 30 Sep" },
      { label: "Why manual", value: "No invoice number in the narrative, so automatic matching did not apply" },
      { label: "First approval", value: "Aline Uwase · 11 Oct 08:41" },
    ],
    checks: [
      { kind: "ok", text: "Amounts match exactly." },
      { kind: "ok", text: "Two different people: Aline approved first, you are the second approver." },
      { kind: "info", text: "This matches money already in the bank. It does not create a payment." },
    ],
    rules: [],
    exceptions: [],
    after: [
      { status: "current", title: "You give the second approval", detail: "Step-up verification required" },
      {
        status: "default",
        title: "Settlement posts to accounts receivable",
        detail: "Invoice shows Paid with the bank line as evidence",
      },
      { status: "default", title: "Umurage’s overdue balance falls to RWF 850,000", detail: "" },
    ],
    links: [
      { label: "Reconciliation", board: "Reconciliation" },
      { label: "Accounts receivable", board: "AccountsReceivable" },
    ],
    approveLabel: "Give second approval",
    footNote: "Manual matches always need two different approvers.",
    okTitle: "Match approved by two people",
    okDesc: "INV-26-0412 settled from the 10 Oct statement line. Aline Uwase and you are both on record.",
    decision: null,
    decisionReason: "",
  },
];

const approvalHistory: ApprovalHistoryEntry[] = [
  {
    id: "h01",
    when: "25 Sep 2026",
    title: "Confirm September pay run",
    ref: "PR-2026-09 · snapshot v5",
    by: "Diane Ingabire",
    decision: "Confirmed",
    decisionTone: "success",
    decider: "Didier Mugenzi",
    note: "Payment file released separately on 25 Sep after its own approval. 47 staff paid.",
  },
  {
    id: "h02",
    when: "22 Sep 2026",
    title: "Refund RWF 120,000",
    ref: "BK-20377 · tier 1",
    by: "Eric Habimana",
    decision: "Approved",
    decisionTone: "success",
    decider: "Didier Mugenzi",
    note: "Refunded. MTN MoMo ref MP260923.0915.A11870, verified 23 Sep.",
  },
  {
    id: "h03",
    when: "18 Sep 2026",
    title: "Publish Family Suite rate RWF 240,000",
    ref: "Revenue recommendation",
    by: "Aline Uwase",
    decision: "Declined",
    decisionTone: "default",
    decider: "Didier Mugenzi",
    note: "“Keep the current rate while the EAC block is negotiated.”",
  },
  {
    id: "h04",
    when: "15 Sep 2026",
    title: "Invite Eric Habimana as Front desk",
    ref: "Team invite",
    by: "Aline Uwase",
    decision: "Approved",
    decisionTone: "success",
    decider: "Didier Mugenzi",
    note: "Accepted 15 Sep. Scope: Isangano Lakeside Hotel.",
  },
  {
    id: "h05",
    when: "9 Sep 2026",
    title: "Write off RWF 12,000",
    ref: "Folio F-5441",
    by: "Eric Habimana",
    decision: "Declined",
    decisionTone: "default",
    decider: "Didier Mugenzi",
    note: "“Guest agreed to pay by MoMo.” Paid 10 Sep by Airtel Money.",
  },
  {
    id: "h06",
    when: "2 Sep 2026",
    title: "Reopen folio F-5402",
    ref: "Folio reopen",
    by: "Eric Habimana",
    decision: "Approved",
    decisionTone: "success",
    decider: "Didier Mugenzi",
    note: "Credit note EBM-ISG-2026-015530 issued 2 Sep.",
  },
  {
    id: "h07",
    when: "28 Aug 2026",
    title: "Match RWF 640,000 to INV-26-0371",
    ref: "Akagera Horizon Travel · two approvers",
    by: "Aline Uwase",
    decision: "Approved",
    decisionTone: "success",
    decider: "Aline Uwase, Didier Mugenzi",
    note: "Settled from the 27 Aug GT Bank statement line.",
  },
];

const approvalsFixtures = {
  "owner.approvalRequests": approvalRequests,
  "owner.approvalHistory": approvalHistory,
} satisfies FixtureSet;
// ── Reports ─────────────────────────────────────────────────────────────────────────────────────────────
/** Report tabs of the Reports screen. */
export type ReportsTab = "perf" | "fin" | "res";

/** Property filter: "all" = hotel and lodge together, "isg" = Isangano, "ish" = Ishyamba. */
export type ReportsPropertyId = "all" | "isg" | "ish";

/** A defined performance measure (KPI and definition popover). */
export type ReportsMeasureId = "occ" | "adr" | "revpar" | "nights" | "rev";

/** Intl.NumberFormat options of a figure rendered by KPI.Value (locale en-KE). */
export interface ReportsNumberFormat {
  style?: "decimal" | "currency" | "percent";
  currency?: string;
  notation?: "standard" | "compact";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/** A property filter option. The factors scale the group's daily trend to one property. */
export interface ReportsProperty {
  id: ReportsPropertyId;
  /** Segment label ("Hotel and lodge"). */
  label: string;
  /** Title-case name used in headings ("Hotel and Lodge"). */
  title: string;
  occFactor: number;
  adrFactor: number;
}

/** A saved view: a named tab and property combination. */
export interface ReportsSavedView {
  id: string;
  label: string;
  tab: ReportsTab;
  property: ReportsPropertyId;
}

/** A key figure of the Performance tab for one property, month to date against the same dates 2025. */
export interface ReportsKpi {
  id: string;
  property: ReportsPropertyId;
  measure: ReportsMeasureId;
  label: string;
  value: number;
  format: ReportsNumberFormat;
  trend: string;
  trendDirection: "up" | "down";
  foot: string;
  board: BoardId;
}

/** How a measure is defined, versioned, sourced and owned. */
export interface ReportsMeasureDefinition {
  id: ReportsMeasureId;
  name: string;
  version: string;
  formula: string;
  rules: string;
  window: string;
  source: string;
  owner: string;
}

/** One night of the daily trend for the group: occupancy in percent, ADR in thousand RWF. */
export interface ReportsTrendDay {
  id: string;
  label: string;
  occ: number;
  occLastYear: number;
  adr: number;
  adrLastYear: number;
}

/** Occupancy on the books for a week, seven days ago and today (percent). */
export interface ReportsPickupWeek {
  id: string;
  week: string;
  was: number;
  now: number;
}

/** A room type with its rooms, nights sold and ADR for 1–12 Oct (12 nights). */
export interface ReportsRoomType {
  id: string;
  property: "isg" | "ish";
  name: string;
  propertyName: string;
  rooms: number;
  sold: number;
  adr: number;
}

/** A distribution channel for hotel and lodge (497 room nights sold). */
export interface ReportsChannel {
  id: string;
  name: string;
  nights: number;
  adr: number;
  commission: string;
}

/** A summary figure of the Financial or Residence tab. `suffix` follows the number ("22 of 24"). */
export interface ReportsSummaryKpi {
  id: string;
  tab: "fin" | "res";
  label: string;
  value: number;
  format: ReportsNumberFormat;
  suffix: string;
  trend: string | null;
  foot: string;
}

/** A line of the USALI departmental profit table, in RWF millions as reported. */
export interface ReportsProfitLine {
  id: string;
  kind: "heading" | "department" | "subtotal" | "gop";
  name: string;
  note: string;
  revenue: string;
  expenses: string;
  profit: string;
  margin: string;
}

/** A receivables aging bucket in RWF millions; `swatch` is the chart colour token. */
export interface ReportsAgingBucket {
  id: string;
  label: string;
  amount: number;
  swatch: "chart-2" | "chart-3" | "chart-4" | "warning" | "danger";
}

/** A city-ledger debtor (amount in RWF millions) and where its records live. */
export interface ReportsDebtor {
  id: string;
  name: string;
  note: string;
  amount: number;
  board: BoardId;
}

/** A vacant residence unit. */
export interface ReportsVacantUnit {
  id: string;
  unit: string;
  kind: string;
  rent: number;
  since: string;
  days: string;
  status: string;
  tone: Tone;
}

/** A lease in arrears (verified payments only). The id is the lease number. */
export interface ReportsArrear {
  id: string;
  name: string;
  unit: string;
  amount: number;
  days: number;
  status: string;
  tone: Tone;
  note: string;
}

/** A scheduled export of the reports. */
export interface ReportsSchedule {
  id: string;
  icon: IconName;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  next: string;
}

const reportsRwf: ReportsNumberFormat = { style: "currency", currency: "RWF" };
const reportsRwfMillions: ReportsNumberFormat = {
  style: "currency",
  currency: "RWF",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};
const reportsPercent: ReportsNumberFormat = { style: "percent" };
const reportsCount: ReportsNumberFormat = { style: "decimal" };

const reportsKpis: ReportsKpi[] = [
  {
    id: "all-occ",
    property: "all",
    measure: "occ",
    label: "Occupancy",
    value: 0.69,
    format: reportsPercent,
    trend: "4 pts",
    trendDirection: "up",
    foot: "497 of 720 room nights",
    board: "Reservations",
  },
  {
    id: "all-adr",
    property: "all",
    measure: "adr",
    label: "ADR",
    value: 119800,
    format: reportsRwf,
    trend: "0.6%",
    trendDirection: "down",
    foot: "Room revenue per night sold",
    board: "Reservations",
  },
  {
    id: "all-revpar",
    property: "all",
    measure: "revpar",
    label: "RevPAR",
    value: 82660,
    format: reportsRwf,
    trend: "6.9%",
    trendDirection: "up",
    foot: "Room revenue per night available",
    board: "Reservations",
  },
  {
    id: "all-nights",
    property: "all",
    measure: "nights",
    label: "Room nights sold",
    value: 497,
    format: reportsCount,
    trend: "38",
    trendDirection: "up",
    foot: "Open the stays",
    board: "Reservations",
  },
  {
    id: "all-rev",
    property: "all",
    measure: "rev",
    label: "Room revenue",
    value: 59500000,
    format: reportsRwfMillions,
    trend: "6.9%",
    trendDirection: "up",
    foot: "Posted room charges",
    board: "Folios",
  },
  {
    id: "isg-occ",
    property: "isg",
    measure: "occ",
    label: "Occupancy",
    value: 0.72,
    format: reportsPercent,
    trend: "5 pts",
    trendDirection: "up",
    foot: "363 of 504 room nights",
    board: "Reservations",
  },
  {
    id: "isg-adr",
    property: "isg",
    measure: "adr",
    label: "ADR",
    value: 124600,
    format: reportsRwf,
    trend: "1.1%",
    trendDirection: "up",
    foot: "Room revenue per night sold",
    board: "Reservations",
  },
  {
    id: "isg-revpar",
    property: "isg",
    measure: "revpar",
    label: "RevPAR",
    value: 89740,
    format: reportsRwf,
    trend: "8.4%",
    trendDirection: "up",
    foot: "Room revenue per night available",
    board: "Reservations",
  },
  {
    id: "isg-nights",
    property: "isg",
    measure: "nights",
    label: "Room nights sold",
    value: 363,
    format: reportsCount,
    trend: "31",
    trendDirection: "up",
    foot: "Open the stays",
    board: "Reservations",
  },
  {
    id: "isg-rev",
    property: "isg",
    measure: "rev",
    label: "Room revenue",
    value: 45200000,
    format: reportsRwfMillions,
    trend: "8.4%",
    trendDirection: "up",
    foot: "Posted room charges",
    board: "Folios",
  },
  {
    id: "ish-occ",
    property: "ish",
    measure: "occ",
    label: "Occupancy",
    value: 0.62,
    format: reportsPercent,
    trend: "1 pt",
    trendDirection: "up",
    foot: "134 of 216 room nights",
    board: "Reservations",
  },
  {
    id: "ish-adr",
    property: "ish",
    measure: "adr",
    label: "ADR",
    value: 106600,
    format: reportsRwf,
    trend: "4.2%",
    trendDirection: "down",
    foot: "Room revenue per night sold",
    board: "Reservations",
  },
  {
    id: "ish-revpar",
    property: "ish",
    measure: "revpar",
    label: "RevPAR",
    value: 66150,
    format: reportsRwf,
    trend: "2.6%",
    trendDirection: "down",
    foot: "Room revenue per night available",
    board: "Reservations",
  },
  {
    id: "ish-nights",
    property: "ish",
    measure: "nights",
    label: "Room nights sold",
    value: 134,
    format: reportsCount,
    trend: "2",
    trendDirection: "up",
    foot: "Open the stays",
    board: "Reservations",
  },
  {
    id: "ish-rev",
    property: "ish",
    measure: "rev",
    label: "Room revenue",
    value: 14300000,
    format: reportsRwfMillions,
    trend: "2.6%",
    trendDirection: "down",
    foot: "Posted room charges",
    board: "Folios",
  },
];

const reportsDefinitions: ReportsMeasureDefinition[] = [
  {
    id: "occ",
    name: "Occupancy",
    version: "v2",
    formula: "Room nights sold ÷ room nights available",
    rules: "Out-of-order rooms are not available. Complimentary nights count as sold. Residence units excluded.",
    window: "Per night by business date, after night audit. Tonight uses bookings on the books.",
    source: "Stays and room status records",
    owner: "Didier Mugenzi, until a Finance lead is appointed",
  },
  {
    id: "adr",
    name: "ADR · average daily rate",
    version: "v2",
    formula: "Room revenue ÷ room nights sold",
    rules: "Before VAT and levies. Packages split by component. Complimentary nights excluded.",
    window: "Per night by business date",
    source: "Room charges posted to folios",
    owner: "Didier Mugenzi",
  },
  {
    id: "revpar",
    name: "RevPAR · revenue per available room",
    version: "v2",
    formula: "Room revenue ÷ room nights available",
    rules: "Same revenue rules as ADR, same availability rules as occupancy.",
    window: "Per night by business date",
    source: "Folios and room status",
    owner: "Didier Mugenzi",
  },
  {
    id: "nights",
    name: "Room nights sold",
    version: "v1",
    formula: "Count of occupied room nights",
    rules: "Includes complimentary and house-use nights, shown separately on drill-down.",
    window: "Per night by business date",
    source: "Stays",
    owner: "Aline Uwase",
  },
  {
    id: "rev",
    name: "Room revenue",
    version: "v1",
    formula: "Sum of posted room charges",
    rules: "Net of VAT and adjustments; credit notes reduce the night they correct.",
    window: "Posting date",
    source: "Folio charges",
    owner: "Didier Mugenzi",
  },
];

const reportsTrendDays: ReportsTrendDay[] = [
  { id: "2026-10-01", label: "1 Oct", occ: 58, occLastYear: 60, adr: 116, adrLastYear: 118 },
  { id: "2026-10-02", label: "2 Oct", occ: 61, occLastYear: 61, adr: 117, adrLastYear: 119 },
  { id: "2026-10-03", label: "3 Oct", occ: 76, occLastYear: 72, adr: 124, adrLastYear: 124 },
  { id: "2026-10-04", label: "4 Oct", occ: 80, occLastYear: 75, adr: 126, adrLastYear: 127 },
  { id: "2026-10-05", label: "5 Oct", occ: 62, occLastYear: 60, adr: 115, adrLastYear: 117 },
  { id: "2026-10-06", label: "6 Oct", occ: 60, occLastYear: 58, adr: 114, adrLastYear: 116 },
  { id: "2026-10-07", label: "7 Oct", occ: 63, occLastYear: 60, adr: 116, adrLastYear: 118 },
  { id: "2026-10-08", label: "8 Oct", occ: 65, occLastYear: 62, adr: 117, adrLastYear: 119 },
  { id: "2026-10-09", label: "9 Oct", occ: 68, occLastYear: 64, adr: 119, adrLastYear: 121 },
  { id: "2026-10-10", label: "10 Oct", occ: 80, occLastYear: 74, adr: 125, adrLastYear: 126 },
  { id: "2026-10-11", label: "11 Oct", occ: 79, occLastYear: 72, adr: 126, adrLastYear: 127 },
  { id: "2026-10-12", label: "Tonight", occ: 78, occLastYear: 72, adr: 122, adrLastYear: 114 },
];

const reportsProperties: ReportsProperty[] = [
  { id: "all", label: "Hotel and lodge", title: "Hotel and Lodge", occFactor: 1, adrFactor: 1 },
  { id: "isg", label: "Isangano", title: "Isangano", occFactor: 1.04, adrFactor: 1.04 },
  { id: "ish", label: "Ishyamba", title: "Ishyamba", occFactor: 0.9, adrFactor: 0.89 },
];

const reportsSavedViews: ReportsSavedView[] = [
  { id: "owner", label: "Owner overview", tab: "perf", property: "all" },
  { id: "isg", label: "Isangano month to date", tab: "perf", property: "isg" },
  { id: "ish", label: "Lodge only", tab: "perf", property: "ish" },
  { id: "month", label: "Month-end financials", tab: "fin", property: "all" },
];

const reportsPickup: ReportsPickupWeek[] = [
  { id: "2026-w42", week: "13–19 Oct", was: 57, now: 61 },
  { id: "2026-w43", week: "20–26 Oct", was: 73, now: 84 },
  { id: "2026-w44", week: "27 Oct–2 Nov", was: 44, now: 47 },
  { id: "2026-w45", week: "3–9 Nov", was: 29, now: 31 },
];

const reportsRoomTypes: ReportsRoomType[] = [
  {
    id: "isg-standard-queen",
    property: "isg",
    name: "Standard Queen",
    propertyName: "Isangano",
    rooms: 16,
    sold: 134,
    adr: 92800,
  },
  { id: "isg-twin", property: "isg", name: "Twin", propertyName: "Isangano", rooms: 10, sold: 81, adr: 98400 },
  {
    id: "isg-deluxe-lake-view",
    property: "isg",
    name: "Deluxe Lake View",
    propertyName: "Isangano",
    rooms: 12,
    sold: 117,
    adr: 152600,
  },
  {
    id: "isg-family-suite",
    property: "isg",
    name: "Family Suite",
    propertyName: "Isangano",
    rooms: 4,
    sold: 31,
    adr: 236200,
  },
  {
    id: "ish-forest-tent",
    property: "ish",
    name: "Forest Tent",
    propertyName: "Ishyamba",
    rooms: 14,
    sold: 104,
    adr: 98500,
  },
  {
    id: "ish-family-tent",
    property: "ish",
    name: "Family Tent",
    propertyName: "Ishyamba",
    rooms: 4,
    sold: 30,
    adr: 135000,
  },
];

const reportsChannels: ReportsChannel[] = [
  { id: "direct", name: "Direct · website and phone", nights: 148, adr: 121400, commission: "None" },
  { id: "ota", name: "OTAs via channel manager", nights: 132, adr: 124700, commission: "RWF 2.47M" },
  { id: "marketplace", name: "Injishi marketplace", nights: 66, adr: 118900, commission: "None" },
  { id: "agents", name: "Travel agents", nights: 46, adr: 113200, commission: "RWF 0.52M" },
  { id: "groups", name: "Groups", nights: 46, adr: 109800, commission: "None" },
  { id: "walk-in", name: "Walk-in", nights: 37, adr: 112000, commission: "None" },
  { id: "corporate", name: "Corporate accounts", nights: 22, adr: 104500, commission: "None" },
];

const reportsSummaryKpis: ReportsSummaryKpi[] = [
  {
    id: "fin-revenue",
    tab: "fin",
    label: "Total revenue",
    value: 189000000,
    format: reportsRwfMillions,
    suffix: "",
    trend: "9.1%",
    foot: "Against September 2025",
  },
  {
    id: "fin-gop",
    tab: "fin",
    label: "Gross operating profit",
    value: 77700000,
    format: reportsRwfMillions,
    suffix: "",
    trend: "12.4%",
    foot: "Against September 2025",
  },
  {
    id: "fin-gop-margin",
    tab: "fin",
    label: "GOP margin",
    value: 0.411,
    format: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 },
    suffix: "",
    trend: "1.2 pts",
    foot: "GOP ÷ total revenue",
  },
  {
    id: "fin-goppar",
    tab: "fin",
    label: "GOPPAR",
    value: 43170,
    format: reportsRwf,
    suffix: "",
    trend: "10.8%",
    foot: "GOP ÷ 1,800 room nights available",
  },
  {
    id: "res-leased",
    tab: "res",
    label: "Leased",
    value: 22,
    format: reportsCount,
    suffix: " of 24",
    trend: null,
    foot: "91.7% of units under an active lease",
  },
  {
    id: "res-vacant",
    tab: "res",
    label: "Vacant",
    value: 2,
    format: reportsCount,
    suffix: " units",
    trend: null,
    foot: "Average 18 days vacant",
  },
  {
    id: "res-rent-roll",
    tab: "res",
    label: "Monthly rent roll",
    value: 20400000,
    format: reportsRwfMillions,
    suffix: "",
    trend: null,
    foot: "Active leases, October",
  },
  {
    id: "res-arrears",
    tab: "res",
    label: "Arrears",
    value: 2850000,
    format: {
      style: "currency",
      currency: "RWF",
      notation: "compact",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    suffix: "",
    trend: null,
    foot: "3 leases · verified payments only",
  },
];

const reportsProfitLines: ReportsProfitLine[] = [
  {
    id: "operated-heading",
    kind: "heading",
    name: "Operated departments",
    note: "",
    revenue: "",
    expenses: "",
    profit: "",
    margin: "",
  },
  {
    id: "rooms",
    kind: "department",
    name: "Rooms",
    note: "",
    revenue: "139.6",
    expenses: "34.9",
    profit: "104.7",
    margin: "75.0%",
  },
  {
    id: "food-beverage",
    kind: "department",
    name: "Food and beverage",
    note: "Isangano Terrace, Lake Bar, lodge dining, Kivu Hall banquets",
    revenue: "41.2",
    expenses: "29.7",
    profit: "11.5",
    margin: "27.9%",
  },
  {
    id: "other-operated",
    kind: "department",
    name: "Other operated departments",
    note: "Laundry, transfers, activities",
    revenue: "6.4",
    expenses: "3.9",
    profit: "2.5",
    margin: "39.1%",
  },
  {
    id: "miscellaneous",
    kind: "department",
    name: "Miscellaneous income",
    note: "Includes Ikawa Corner rent RWF 1.2M",
    revenue: "1.8",
    expenses: "—",
    profit: "1.8",
    margin: "—",
  },
  {
    id: "operated-total",
    kind: "subtotal",
    name: "Total operated departments",
    note: "",
    revenue: "189.0",
    expenses: "68.5",
    profit: "120.5",
    margin: "63.8%",
  },
  {
    id: "undistributed-heading",
    kind: "heading",
    name: "Undistributed operating expenses",
    note: "",
    revenue: "",
    expenses: "",
    profit: "",
    margin: "",
  },
  {
    id: "admin-general",
    kind: "department",
    name: "Administrative and general",
    note: "",
    revenue: "—",
    expenses: "14.6",
    profit: "",
    margin: "",
  },
  {
    id: "it-telecom",
    kind: "department",
    name: "Information and telecommunications",
    note: "Includes Injishi subscription",
    revenue: "—",
    expenses: "2.1",
    profit: "",
    margin: "",
  },
  {
    id: "sales-marketing",
    kind: "department",
    name: "Sales and marketing",
    note: "",
    revenue: "—",
    expenses: "9.8",
    profit: "",
    margin: "",
  },
  {
    id: "property-maintenance",
    kind: "department",
    name: "Property operation and maintenance",
    note: "",
    revenue: "—",
    expenses: "7.4",
    profit: "",
    margin: "",
  },
  {
    id: "utilities",
    kind: "department",
    name: "Utilities",
    note: "",
    revenue: "—",
    expenses: "8.9",
    profit: "",
    margin: "",
  },
  {
    id: "undistributed-total",
    kind: "subtotal",
    name: "Total undistributed expenses",
    note: "",
    revenue: "",
    expenses: "42.8",
    profit: "",
    margin: "",
  },
  {
    id: "gop",
    kind: "gop",
    name: "Gross operating profit (GOP)",
    note: "Before management fees and fixed charges",
    revenue: "189.0",
    expenses: "111.3",
    profit: "77.7",
    margin: "41.1%",
  },
];

const reportsAging: ReportsAgingBucket[] = [
  { id: "current", label: "Current", amount: 2.04, swatch: "chart-3" },
  { id: "1-30", label: "1–30 days", amount: 1.05, swatch: "chart-2" },
  { id: "31-60", label: "31–60 days", amount: 0.52, swatch: "chart-4" },
  { id: "61-90", label: "61–90 days", amount: 1.24, swatch: "warning" },
  { id: "over-90", label: "Over 90 days", amount: 0, swatch: "danger" },
];

const reportsDebtors: ReportsDebtor[] = [
  {
    id: "umurage",
    name: "Umurage Consulting Ltd",
    note: "Oldest invoice 62 days · RWF 1.2M GT Bank transfer waiting for second approval",
    amount: 2.1,
    board: "Approvals",
  },
  {
    id: "akagera",
    name: "Akagera Horizon Travel",
    note: "Travel agent · INV-26-0409 and INV-26-0436 · not yet due",
    amount: 0.97,
    board: "AccountsReceivable",
  },
  {
    id: "other",
    name: "Other accounts",
    note: "Two corporate accounts · current and 1–30 days",
    amount: 1.78,
    board: "AccountsReceivable",
  },
];

const reportsVacantUnits: ReportsVacantUnit[] = [
  {
    id: "B-03",
    unit: "B-03",
    kind: "Two bedroom · 2nd floor",
    rent: 850000,
    since: "18 Sep 2026",
    days: "24 days",
    status: "Listed · 2 viewings booked",
    tone: "accent",
  },
  {
    id: "A-11",
    unit: "A-11",
    kind: "One bedroom · ground floor",
    rent: 650000,
    since: "1 Oct 2026",
    days: "11 days",
    status: "Make-ready until 15 Oct",
    tone: "default",
  },
];

const reportsArrears: ReportsArrear[] = [
  {
    id: "L-KC-007",
    name: "Divine Mutesi",
    unit: "A-04 · L-KC-007",
    amount: 1200000,
    days: 41,
    status: "Payment plan",
    tone: "warning",
    note: "Agreed 8 Oct: two instalments, 20 Oct and 5 Nov",
  },
  {
    id: "L-KC-015",
    name: "Innocent Kalisa",
    unit: "C-02 · L-KC-015",
    amount: 950000,
    days: 12,
    status: "Reminder sent",
    tone: "default",
    note: "SMS and email 6 Oct",
  },
  {
    id: "L-KC-019",
    name: "Samuel Okello",
    unit: "B-09 · L-KC-019",
    amount: 700000,
    days: 7,
    status: "Unknown · checking",
    tone: "info",
    note: "MTN MoMo PI-77188 timed out 11 Oct; checking with the provider",
  },
];

const reportsSchedules: ReportsSchedule[] = [
  {
    id: "owner-weekly",
    icon: "Envelope",
    name: "Owner weekly pack",
    detail: "Performance and Financial · PDF to Didier Mugenzi · every Monday 07:00",
    status: "Active",
    tone: "success",
    next: "Next: Mon 19 Oct",
  },
  {
    id: "month-end",
    icon: "Envelope",
    name: "Month-end pack",
    detail:
      "All tabs · PDF and CSV to Didier Mugenzi and Aline Uwase · Aline’s copy leaves out payroll cost lines she cannot see",
    status: "Active",
    tone: "success",
    next: "Next: 1 Nov 08:00",
  },
  {
    id: "lodge-daily",
    icon: "CirclePause",
    name: "Lodge daily flash",
    detail:
      "Performance, Ishyamba · to Grace Uwera · paused because Grace has no access until her invite is approved and accepted",
    status: "Paused",
    tone: "warning",
    next: "Resumes on access",
  },
];

const reportsFixtures = {
  "owner.reportsProperties": reportsProperties,
  "owner.reportsSavedViews": reportsSavedViews,
  "owner.reportsKpis": reportsKpis,
  "owner.reportsDefinitions": reportsDefinitions,
  "owner.reportsTrendDays": reportsTrendDays,
  "owner.reportsPickup": reportsPickup,
  "owner.reportsRoomTypes": reportsRoomTypes,
  "owner.reportsChannels": reportsChannels,
  "owner.reportsSummaryKpis": reportsSummaryKpis,
  "owner.reportsProfitLines": reportsProfitLines,
  "owner.reportsAging": reportsAging,
  "owner.reportsDebtors": reportsDebtors,
  "owner.reportsVacantUnits": reportsVacantUnits,
  "owner.reportsArrears": reportsArrears,
  "owner.reportsSchedules": reportsSchedules,
} satisfies FixtureSet;
// ── Compliance ──────────────────────────────────────────────────────────────────────────────────────────
/** A figure in the compliance summary row ("7 on file"). `unit` follows the number; empty for bare counts. */
export interface ComplianceKpi {
  id: string;
  icon: IconName;
  status: Tone;
  label: string;
  value: number;
  unit: string;
  foot: string;
}

/** Workflow stage of a submission: 0 Draft · 1 Internal review · 2 Approved to send · 3 Sent · 4 Outcome. */
export type ComplianceStage = 0 | 1 | 2 | 3 | 4;

/** What the counterpart said (only meaningful at stage 4). */
export type ComplianceOutcome = "Acknowledged" | "Rejected" | "Needs follow-up";

/** Something sent (or to be sent) to an authority or membership body. The id is the submission number. */
export interface ComplianceSubmission {
  id: string;
  title: string;
  entity: string;
  party: string;
  channel: string;
  stage: ComplianceStage;
  outcome: ComplianceOutcome | null;
  due: string;
  /** The mandate for this submission still needs verification. */
  mandateGate: boolean;
  basis: string;
  contents: string;
  proof: string;
  /** Detail lines of the first two workflow steps (who prepared it, who reviews or approved it). */
  log: [string, string];
  noteTitle: string | null;
  note: string | null;
}

/** A licence, grading or registration on file, with the document that evidences it. */
export interface ComplianceLicence {
  id: string;
  name: string;
  holder: string;
  issuer: string;
  ref: string;
  expiry: string;
  left: string;
  file: string;
  status: string;
  tone: Tone;
}

/** Membership of a federation or chamber; decisions belong to the body, Injishi records them. */
export interface ComplianceMembership {
  id: string;
  icon: IconName;
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  action: string;
  board: BoardId;
}

/** A condition that must be verified before any government guest-stay reporting is enabled. */
export interface ComplianceReportingGate {
  id: string;
  label: string;
}

/** One read of guest personal data, with its purpose and legal basis. */
export interface ComplianceAccess {
  id: string;
  when: string;
  who: string;
  role: string;
  record: string;
  purpose: string;
  basis: string;
  tone: Tone;
}

/** A data subject request. `decision` is what the request becomes once the owner approves it. */
export interface ComplianceDataRequest {
  id: string;
  who: string;
  kind: string;
  received: string;
  status: string;
  tone: Tone;
  note: string;
  open: boolean;
  decision: { status: string; tone: Tone; note: string } | null;
}

const complianceKpis: ComplianceKpi[] = [
  {
    id: "licences",
    icon: "FileCheck",
    status: "warning",
    label: "Licences and registrations",
    value: 7,
    unit: "on file",
    foot: "1 expires in 34 days · 1 follow-up",
  },
  {
    id: "memberships",
    icon: "Briefcase",
    status: "default",
    label: "Memberships",
    value: 2,
    unit: "",
    foot: "PSF decision pending · Chamber in draft",
  },
  {
    id: "submissions",
    icon: "PaperPlane",
    status: "warning",
    label: "Submissions open",
    value: 4,
    unit: "",
    foot: "1 due 15 Oct · 1 rejected, needs correction",
  },
  {
    id: "requests",
    icon: "ShieldKeyhole",
    status: "default",
    label: "Data subject requests",
    value: 3,
    unit: "open",
    foot: "1 waiting for your decision",
  },
];

const complianceSubmissions: ComplianceSubmission[] = [
  {
    id: "SUB-0412",
    title: "Q3 accommodation statistics return",
    entity: "Isangano and Ishyamba",
    party: "RDB",
    channel: "Encrypted file, uploaded by you to the RDB portal",
    stage: 1,
    outcome: null,
    due: "15 Oct",
    mandateGate: true,
    basis: "Tourism licence condition on periodic statistics, as you recorded it",
    contents:
      "Room nights, arrivals and guests by country group, July to September. Totals only: no names or ID numbers.",
    proof: "None yet",
    log: ["Prepared by Aline Uwase · 10 Oct 14:20", "Reviewer: you. The preparer cannot approve it."],
    noteTitle: null,
    note: null,
  },
  {
    id: "SUB-0409",
    title: "Ishyamba tourism licence renewal",
    entity: "Ishyamba Forest Lodge",
    party: "RDB",
    channel: "RDB online application, outside Injishi",
    stage: 0,
    outcome: null,
    due: "Before 15 Nov",
    mandateGate: false,
    basis: "Licence renewal before expiry",
    contents: "Application form, insurance, fire certificate, staff list, photos. 3 of 5 documents attached.",
    proof: "None yet",
    log: ["Started by Aline Uwase · 6 Oct", ""],
    noteTitle: null,
    note: null,
  },
  {
    id: "SUB-0405",
    title: "September VAT declaration schedule",
    entity: "Amahoro Hospitality Ltd",
    party: "RRA",
    channel: "Filed by you on RRA e-Tax; schedule prepared here",
    stage: 4,
    outcome: "Acknowledged",
    due: "15 Oct",
    mandateGate: false,
    basis: "Monthly VAT declaration",
    contents: "Sales and purchase schedules from issued fiscal receipts and supplier invoices.",
    proof: "RRA acknowledgement PDF · uploaded 10 Oct 16:05",
    log: ["Prepared by Aline Uwase · 8 Oct", "Approved by you · 9 Oct"],
    noteTitle: null,
    note: null,
  },
  {
    id: "SUB-0401",
    title: "Fire safety inspection follow-up",
    entity: "Isangano Lakeside Hotel",
    party: "Fire and rescue inspectorate",
    channel: "Email with read receipt",
    stage: 4,
    outcome: "Needs follow-up",
    due: "20 Oct",
    mandateGate: false,
    basis: "Inspection notice of 29 Sep",
    contents: "Inspection response and corrective actions.",
    proof: "Sent email and read receipt · 2 Oct",
    log: ["Prepared by Aline Uwase · 1 Oct", "Approved by you · 1 Oct"],
    noteTitle: "Inspector asked for one more document",
    note: "Extinguisher service certificate requested by 20 Oct. Jean-Paul Niyonsaba is booking the service.",
  },
  {
    id: "SUB-0398",
    title: "PSF membership application",
    entity: "Amahoro Hospitality Ltd",
    party: "PSF",
    channel: "PSF application console",
    stage: 3,
    outcome: null,
    due: "—",
    mandateGate: false,
    basis: "Voluntary membership",
    contents: "Application form, certificate of incorporation, TIN certificate, tourism licences.",
    proof: "Console submission receipt · 3 Oct 11:12",
    log: ["Prepared by you · 2 Oct", "Approved by you · 3 Oct"],
    noteTitle: null,
    note: null,
  },
  {
    id: "SUB-0390",
    title: "Annual return 2025",
    entity: "Amahoro Residences Ltd",
    party: "RDB",
    channel: "RDB online services, outside Injishi",
    stage: 4,
    outcome: "Rejected",
    due: "Resubmit by 31 Oct",
    mandateGate: false,
    basis: "Annual return for a domestic company",
    contents: "Annual return form and shareholder register.",
    proof: "RDB rejection notice · 2 Oct",
    log: ["Prepared by Solange Uwimana · 25 Sep", "Approved by you · 26 Sep"],
    noteTitle: "Rejected by RDB on 2 Oct",
    note: "Reason given: shareholder register not attached. Prepare a corrected return as a new draft.",
  },
];

const complianceLicences: ComplianceLicence[] = [
  {
    id: "rdb-tl-2024-0388",
    name: "Tourism operating licence",
    holder: "Isangano Lakeside Hotel",
    issuer: "RDB",
    ref: "RDB-TL-2024-0388",
    expiry: "31 Mar 2027",
    left: "170 days",
    file: "licence-isangano.pdf",
    status: "Current",
    tone: "success",
  },
  {
    id: "rdb-tl-2023-1142",
    name: "Tourism operating licence",
    holder: "Ishyamba Forest Lodge",
    issuer: "RDB",
    ref: "RDB-TL-2023-1142",
    expiry: "15 Nov 2026",
    left: "34 days · renewal in draft",
    file: "licence-ishyamba.pdf",
    status: "Expiring",
    tone: "warning",
  },
  {
    id: "rdb-cl-2024-0217",
    name: "Accommodation class · Hotel, 3 star",
    holder: "Isangano Lakeside Hotel",
    issuer: "RDB",
    ref: "RDB-CL-2024-0217",
    expiry: "Review Jun 2027",
    left: "Graded 12 Jun 2024",
    file: "grading-report.pdf",
    status: "Current",
    tone: "success",
  },
  {
    id: "eac-rw-h-0519",
    name: "EAC grade · 3 star",
    holder: "Isangano Lakeside Hotel",
    issuer: "EAC criteria, assessed by RDB",
    ref: "EAC-RW-H-0519",
    expiry: "Review Jun 2027",
    left: "Same assessment",
    file: "grading-report.pdf",
    status: "Current",
    tone: "success",
  },
  {
    id: "eac-ishyamba-requested",
    name: "EAC grade",
    holder: "Ishyamba Forest Lodge",
    issuer: "EAC criteria, assessed by RDB",
    ref: "—",
    expiry: "—",
    left: "Assessment requested 2 Sep",
    file: "request-letter.pdf",
    status: "Waiting for RDB",
    tone: "default",
  },
  {
    id: "fs-rbv-2025-114",
    name: "Fire safety certificate",
    holder: "Isangano Lakeside Hotel",
    issuer: "Fire and rescue inspectorate",
    ref: "FS-RBV-2025-114",
    expiry: "30 Nov 2026",
    left: "49 days · follow-up open",
    file: "fire-cert-2025.pdf",
    status: "Follow-up",
    tone: "warning",
  },
  {
    id: "incorporation-102345678",
    name: "Certificate of incorporation",
    holder: "Amahoro Hospitality Ltd · TIN 102 345 678",
    issuer: "RDB",
    ref: "102345678",
    expiry: "No expiry",
    left: "Registered 2019",
    file: "incorporation.pdf",
    status: "On file",
    tone: "default",
  },
];

const complianceMemberships: ComplianceMembership[] = [
  {
    id: "psf",
    icon: "Briefcase",
    name: "Private Sector Federation (PSF)",
    detail:
      "Amahoro Hospitality Ltd · sent 3 Oct through the PSF console. No PSF reference yet. Membership fee is invoiced by PSF only after approval; nothing paid.",
    status: "Sent · awaiting PSF decision",
    tone: "info",
    action: "View",
    board: "Compliance",
  },
  {
    id: "chamber-of-tourism",
    icon: "FileText",
    name: "Rwanda Chamber of Tourism",
    detail: "Draft · 2 of 5 documents attached. Missing both tourism licences and the 2025 annual return.",
    status: "Draft",
    tone: "default",
    action: "Continue",
    board: "Compliance",
  },
];

const complianceReportingGates: ComplianceReportingGate[] = [
  { id: "authority", label: "Legal authority and the body that asks" },
  { id: "fields", label: "Exact fields to share" },
  { id: "frequency", label: "Frequency and deadline" },
  { id: "channel", label: "Recipient and secure channel" },
];

const complianceAccessLog: ComplianceAccess[] = [
  {
    id: "acc-1210-1031",
    when: "12 Oct 10:31",
    who: "Eric Habimana",
    role: "Front desk · Isangano desk 2",
    record: "ID document of Sarah Kimani · stay ST-8841",
    purpose: "Identity check at check-in",
    basis: "Legal obligation · unverified",
    tone: "warning",
  },
  {
    id: "acc-1210-0940",
    when: "12 Oct 09:40",
    who: "Aline Uwase",
    role: "General manager · step-up passed",
    record: "Rooming list, EAC Health Forum · 25 guests, names and rooms only",
    purpose: "Send to the organiser for room allocation",
    basis: "Contract with organiser",
    tone: "default",
  },
  {
    id: "acc-1110-1147",
    when: "11 Oct 11:47",
    who: "Kevin Mugisha",
    role: "Injishi support · view only",
    record: "Booking BK-20418 details, no ID documents",
    purpose: "Support ticket SUP-4117, fiscal queue question",
    basis: "Your consent until 13 Oct 18:00",
    tone: "info",
  },
  {
    id: "acc-1110-0815",
    when: "11 Oct 08:15",
    who: "Eric Habimana",
    role: "Front desk",
    record: "Guest profile of Thomas Weber",
    purpose: "Update phone number at guest request",
    basis: "Contract (stay)",
    tone: "default",
  },
  {
    id: "acc-1010-1602",
    when: "10 Oct 16:02",
    who: "Jeanne Nyiraneza",
    role: "Housekeeping · staff app",
    record: "Room 204 guest first name only",
    purpose: "Service delivery",
    basis: "Legitimate interest",
    tone: "default",
  },
  {
    id: "acc-0910-1920",
    when: "9 Oct 19:20",
    who: "Aline Uwase",
    role: "General manager",
    record: "Marketing list · 312 past guests who opted in",
    purpose: "Lake festival offer by email",
    basis: "Consent",
    tone: "accent",
  },
];

const complianceDataRequests: ComplianceDataRequest[] = [
  {
    id: "DSR-0013",
    who: "Pierre Laurent",
    kind: "Erase my data",
    received: "2 Oct",
    status: "Your decision",
    tone: "warning",
    note: "Identity verified 3 Oct. Profile and marketing data can be erased. Folio and fiscal receipts must be kept for the retention period you configured.",
    open: true,
    decision: {
      status: "Partial erasure scheduled",
      tone: "success",
      note: "Profile, preferences and marketing data will be anonymised on 13 Oct. Folio F-5512 and fiscal receipts stay for the retention period.",
    },
  },
  {
    id: "DSR-0014",
    who: "Yuki Tanaka",
    kind: "Copy of my data",
    received: "8 Oct",
    status: "In progress",
    tone: "accent",
    note: "Identity verified 9 Oct. Aline Uwase is assembling the export. Due 7 Nov.",
    open: true,
    decision: null,
  },
  {
    id: "DSR-0015",
    who: "Request naming Daniel Okafor",
    kind: "Copy of my data",
    received: "11 Oct",
    status: "Identity not verified",
    tone: "default",
    note: "Sent from an email address not on the guest profile. Nothing is released until identity is checked.",
    open: true,
    decision: null,
  },
  {
    id: "DSR-0012",
    who: "Fatuma Hassan",
    kind: "Correct my name",
    received: "28 Sep",
    status: "Done 30 Sep",
    tone: "success",
    note: "Name spelling corrected on the profile and future documents. Issued fiscal receipts are not edited.",
    open: false,
    decision: null,
  },
];

const complianceFixtures = {
  "owner.complianceKpis": complianceKpis,
  "owner.complianceSubmissions": complianceSubmissions,
  "owner.complianceLicences": complianceLicences,
  "owner.complianceMemberships": complianceMemberships,
  "owner.complianceReportingGates": complianceReportingGates,
  "owner.complianceAccessLog": complianceAccessLog,
  "owner.complianceDataRequests": complianceDataRequests,
} satisfies FixtureSet;
// ── TeamRoles ───────────────────────────────────────────────────────────────────────────────────────────
/** Role preset ids of Team and roles (Owner, General manager, Front desk, Staff, Finance, HR, Storekeeper). */
export type TeamRolesRoleId = "owner" | "manager" | "frontdesk" | "staff" | "finance" | "hr" | "store";

/** Sign-in status of a member. "pending" = an invite a manager requested, waiting for the owner's approval. */
export type TeamRolesMemberStatus = "active" | "invited" | "pending" | "revoked";

/** One permission of a role preset, e.g. `folio.charge` · "Post charges". */
export interface TeamRolesPermission {
  key: string;
  description: string;
}

/** A permission of the proposed payroll split, with the presets that would hold it. */
export interface TeamRolesSplitPermission extends TeamRolesPermission {
  roles: TeamRolesRoleId[];
}

/** An area of the permission matrix (Front office, Folios and money, …). */
export interface TeamRolesPermissionArea {
  id: string;
  label: string;
  permissions: TeamRolesPermission[];
  /** Proposed split of a permission shown under the area (People and payroll: payroll.run). */
  proposedSplit: TeamRolesSplitPermission[];
  /** Expanded when the matrix first opens. */
  defaultOpen: boolean;
}

/** A role preset: which permissions it includes today. Role names are fixed; only their permissions change. */
export interface TeamRolesRole {
  id: TeamRolesRoleId;
  name: string;
  /** Proposed role: its permission set may still change. */
  proposed: boolean;
  /** The preset is still being defined (Storekeeper). */
  beingDefined: boolean;
  /** Shown as a column of the permission matrix. */
  inMatrix: boolean;
  /** Can be granted with an invite. */
  invitable: boolean;
  /** Permission keys the preset includes. */
  permissions: string[];
  /** Permissions of the proposed split the role already holds (counted in its total). */
  extraPermissions: string[];
  /** What the role cannot do (invite panel). Empty for the owner. */
  cannot: string;
}

/** A sign-in of the business. Employee files live in People; a member is only a sign-in. */
export interface TeamRolesMember {
  id: string;
  initials: string;
  name: string;
  /** Email or mobile number. */
  contact: string;
  role: TeamRolesRoleId;
  scope: string;
  /** The scope rows (TeamRolesScope ids) the scope covers. */
  scopeIds: string[];
  status: TeamRolesMemberStatus;
  lastActive: string;
  /** "Two-step on", "Staff app PIN" or "—". */
  signIn: string;
  avatarTone: Tone;
  /** Identity verified: the member can accept an ownership transfer. */
  identityVerified: boolean;
}

/** A row of the invite scope tree: a legal entity (heading), a property, an outlet or a separate merchant. */
export interface TeamRolesScope {
  id: string;
  kind: "entity" | "property" | "outlet" | "merchant";
  label: string;
  description: string;
  /** Indent level in the tree: 0 legal entity, 1 property or merchant, 2 outlet of a property. */
  level: 0 | 1 | 2;
}

/** How long an invite link stays valid. */
export interface TeamRolesInviteExpiry {
  id: string;
  label: string;
  /** "Mon 19 Oct" (invite panel). */
  expiresOn: string;
  /** "19 Oct" (members list). */
  expiresShort: string;
}

/** The invite being prepared in the invite panel (its starting values). */
export interface TeamRolesInviteDraft {
  id: string;
  name: string;
  contact: string;
  role: TeamRolesRoleId;
  /** Scope rows selected (TeamRolesScope ids). */
  scope: string[];
  expiry: string;
  expiries: TeamRolesInviteExpiry[];
  /** Time of day the link stops working. */
  expiresAt: string;
  /** Masked phone the step-up code goes to. */
  verifyPhone: string;
}

/**
 * The permission matrix, area by area: the platform's own areas and permissions (`PERMISSION_AREA`,
 * `PERMISSION_AREA_OF`, `PERMISSION_LABEL` in @injishi/contracts authz.ts), mirrored so the prototype draws
 * what the API enforces. The live source reads them from contracts; this copy must not drift from it.
 */
const teamRolesPermissionAreas: TeamRolesPermissionArea[] = [
  {
    id: "front_desk",
    label: "Front desk",
    permissions: [
      { key: "reservation.approve", description: "Approve reservations" },
      { key: "reservation.assign", description: "Assign rooms" },
      { key: "stay.checkin", description: "Check guests in" },
      { key: "stay.checkout", description: "Check guests out" },
      { key: "message.send", description: "Reply to messages" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "rooms",
    label: "Rooms & housekeeping",
    permissions: [
      { key: "housekeeping.set", description: "Set room status" },
      { key: "ticket.advance", description: "Update maintenance tickets" },
      { key: "task.assign", description: "Assign cleaning tasks" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "services",
    label: "Services & outlets",
    permissions: [
      { key: "order.advance", description: "Update service orders" },
      { key: "menu.manage", description: "Edit the menu" },
      { key: "outlet.manage", description: "Manage outlets" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "money",
    label: "Money & tax",
    permissions: [
      { key: "folio.charge", description: "Add charges to a bill" },
      { key: "folio.payment", description: "Record payments" },
      { key: "money.view", description: "View money" },
      { key: "rent.record", description: "Record rent" },
      { key: "ebm.manage", description: "Connect the RRA EBM account" },
      { key: "folio.close", description: "Close a bill and sign its receipt" },
      { key: "ebm.refund", description: "Refund a signed receipt" },
      { key: "refund.decide", description: "Answer a guest's refund request" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "property",
    label: "Property & listings",
    permissions: [
      { key: "lease.manage", description: "Manage leases and tenants" },
      { key: "deposit.return", description: "Return deposits" },
      { key: "unit.manage", description: "Change unit rents" },
      { key: "listing.manage", description: "Manage listings and inventory" },
      { key: "amenity.manage", description: "Change what the property offers" },
      { key: "offer.manage", description: "Create and retire offers" },
    ],
    proposedSplit: [],
    defaultOpen: false,
  },
  {
    id: "people",
    label: "People",
    permissions: [
      { key: "team.manage", description: "Manage the team" },
      { key: "department.manage", description: "Manage departments" },
      { key: "people.view", description: "View staff files" },
      { key: "people.manage", description: "Manage staff files and contracts" },
      { key: "roster.manage", description: "Manage the roster" },
      { key: "attendance.record", description: "Clock staff in and out" },
      { key: "attendance.approve", description: "Correct and approve attendance" },
      { key: "leave.approve", description: "Decide leave" },
      { key: "payroll.draft", description: "Draft the pay run" },
      { key: "payroll.run", description: "Confirm the pay run" },
    ],
    proposedSplit: [],
    defaultOpen: true,
  },
];

const teamRolesAllPermissions = teamRolesPermissionAreas.flatMap((a) => a.permissions.map((p) => p.key));

const teamRolesRoles: TeamRolesRole[] = [
  {
    id: "owner",
    name: "Owner",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: false,
    permissions: teamRolesAllPermissions,
    extraPermissions: [],
    cannot: "",
  },
  {
    id: "manager",
    name: "General manager",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: true,
    // The platform's manager: everything but OWNER_ONLY and OWNER_BY_DEFAULT (authz.ts).
    permissions: teamRolesAllPermissions.filter(
      (p) => !["team.manage", "people.manage", "payroll.draft", "payroll.run"].includes(p),
    ),
    extraPermissions: [],
    cannot: "Cannot manage the team, open staff files or run payroll.",
  },
  {
    id: "frontdesk",
    name: "Front desk",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: true,
    permissions: [
      "reservation.approve",
      "reservation.assign",
      "stay.checkin",
      "stay.checkout",
      "folio.charge",
      "folio.payment",
      "order.advance",
      "message.send",
      "folio.close",
      "attendance.record",
    ],
    extraPermissions: [],
    cannot: "Cannot see financial reports, change rates or open staff files.",
  },
  {
    id: "staff",
    name: "Staff",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: true,
    permissions: ["housekeeping.set", "ticket.advance"],
    extraPermissions: [],
    cannot: "Sees only assigned rooms and tasks in the staff app.",
  },
  {
    id: "finance",
    name: "Finance",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: true,
    permissions: [
      "folio.charge",
      "folio.payment",
      "money.view",
      "ebm.manage",
      "folio.close",
      "ebm.refund",
      "refund.decide",
    ],
    extraPermissions: [],
    cannot: "Cannot change rates, open staff files or reply to guests.",
  },
  {
    id: "hr",
    name: "HR",
    proposed: false,
    beingDefined: false,
    inMatrix: true,
    invitable: true,
    permissions: [
      "people.view",
      "people.manage",
      "roster.manage",
      "attendance.record",
      "attendance.approve",
      "leave.approve",
      "payroll.draft",
    ],
    extraPermissions: [],
    cannot: "Cannot see reservations or merchant money. Cannot confirm a pay run they prepared.",
  },
  {
    id: "store",
    name: "Storekeeper",
    proposed: true,
    beingDefined: true,
    inMatrix: false,
    // The platform has no storekeeper role yet (world.mjs ROLE_GAPS seeds Patrick as housekeeper),
    // so nobody can be invited into it and it holds no permission.
    invitable: false,
    permissions: [],
    extraPermissions: [],
    cannot: "Not a platform role yet: stock and purchasing are not built, so the preset is still being defined.",
  },
];

const teamRolesMembers: TeamRolesMember[] = [
  {
    id: "owner",
    initials: "DM",
    name: "Didier Mugenzi",
    contact: "didier@amahoro.rw",
    role: "owner",
    scope: "All properties",
    scopeIds: ["isg", "ter", "ish", "kcr"],
    status: "active",
    lastActive: "Now",
    signIn: "Two-step on",
    avatarTone: "accent",
    identityVerified: true,
  },
  {
    id: "aline",
    initials: "AU",
    name: "Aline Uwase",
    contact: "aline.uwase@amahoro.rw",
    role: "manager",
    scope: "Isangano, Ishyamba and Kacyiru Court",
    scopeIds: ["isg", "ter", "ish", "kcr"],
    status: "active",
    lastActive: "Today 09:58",
    signIn: "Two-step on",
    avatarTone: "success",
    identityVerified: true,
  },
  {
    id: "eric",
    initials: "EH",
    name: "Eric Habimana",
    contact: "+250 788 301 552",
    role: "frontdesk",
    scope: "Isangano Lakeside Hotel",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 10:31",
    signIn: "Two-step on",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "solange",
    initials: "SU",
    name: "Solange Uwimana",
    contact: "solange@amahoro.rw",
    role: "manager",
    scope: "Kacyiru Court Residences only",
    scopeIds: ["kcr"],
    status: "active",
    lastActive: "Today 08:12",
    signIn: "Two-step on",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "joseph",
    initials: "JH",
    name: "Joseph Habimana",
    contact: "+250 788 220 914",
    role: "manager",
    scope: "Outlets only: Isangano Terrace, Lake Bar",
    scopeIds: ["ter"],
    status: "active",
    lastActive: "Yesterday 22:40",
    signIn: "Two-step on",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "diane",
    initials: "DI",
    name: "Diane Ingabire",
    contact: "diane.ingabire@amahoro.rw",
    role: "hr",
    scope: "All properties · people records only",
    scopeIds: ["isg", "ter", "ish", "kcr"],
    status: "active",
    lastActive: "11 Oct 16:20",
    signIn: "Two-step on",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "grace",
    initials: "GU",
    name: "Grace Uwera",
    contact: "grace.uwera@amahoro.rw",
    role: "finance",
    scope: "Amahoro Hospitality Ltd",
    scopeIds: ["isg", "ter", "ish"],
    status: "pending",
    lastActive: "Requested by Aline Uwase · not sent yet",
    signIn: "—",
    avatarTone: "warning",
    identityVerified: false,
  },
  {
    id: "patrick",
    initials: "PN",
    name: "Patrick Nshimiyimana",
    contact: "+250 788 610 337",
    role: "store",
    scope: "Isangano stores",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 07:15",
    signIn: "Two-step on",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "jeanne",
    initials: "JN",
    name: "Jeanne Nyiraneza",
    contact: "+250 788 455 120",
    role: "staff",
    scope: "Isangano · housekeeping, floor 2",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 07:02",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  // Beatrice, Jean-Paul and Claudine hold sign-ins at the business too (the supervisor, technician and
  // waiter personas): a member list that left them out would hide three people with access.
  {
    id: "beatrice",
    initials: "BM",
    name: "Beatrice Mukandori",
    contact: "+250 788 995 412",
    role: "staff",
    scope: "Isangano Lakeside Hotel",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 08:40",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "jeanpaul",
    initials: "JN",
    name: "Jean-Paul Niyonsaba",
    contact: "+250 788 106 523",
    role: "staff",
    scope: "Isangano Lakeside Hotel",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 09:12",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "claudine",
    initials: "CM",
    name: "Claudine Mukamana",
    contact: "+250 788 217 634",
    role: "frontdesk",
    scope: "Isangano Lakeside Hotel",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Yesterday 21:55",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  // The three room attendants on the housekeeping board (operations.housekeepingStaff) sign in to the staff app
  // as well, so the business's member list names them.
  {
    id: "vestine",
    initials: "VM",
    name: "Vestine Mukarugwiza",
    contact: "+250 788 331 208",
    role: "staff",
    scope: "Isangano · housekeeping",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 07:05",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "emmanuel-n",
    initials: "EN",
    name: "Emmanuel Nsengimana",
    contact: "+250 788 331 219",
    role: "staff",
    scope: "Isangano · housekeeping",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 07:11",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "odette",
    initials: "OU",
    name: "Odette Uwamahoro",
    contact: "+250 788 331 227",
    role: "staff",
    scope: "Isangano · housekeeping",
    scopeIds: ["isg"],
    status: "active",
    lastActive: "Today 06:58",
    signIn: "Staff app PIN",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "jacques",
    initials: "JM",
    name: "Jacques Mugabo",
    contact: "jacques.mugabo@gmail.com",
    role: "frontdesk",
    scope: "Ishyamba Forest Lodge",
    scopeIds: ["ish"],
    status: "invited",
    lastActive: "Invited 10 Oct · link expires 17 Oct",
    signIn: "—",
    avatarTone: "default",
    identityVerified: false,
  },
  {
    id: "emmanuel",
    initials: "EN",
    name: "Emmanuel Nkusi",
    contact: "+250 788 118 402",
    role: "frontdesk",
    scope: "Isangano Lakeside Hotel",
    scopeIds: ["isg"],
    status: "revoked",
    lastActive: "Revoked 30 Sep by you · left the business",
    signIn: "—",
    avatarTone: "default",
    identityVerified: false,
  },
];

const teamRolesScopes: TeamRolesScope[] = [
  {
    id: "ahl",
    kind: "entity",
    label: "Amahoro Hospitality Ltd",
    description: "Legal entity · TIN 102 345 678",
    level: 0,
  },
  { id: "isg", kind: "property", label: "Isangano Lakeside Hotel", description: "Rubavu · 42 rooms", level: 1 },
  {
    id: "ter",
    kind: "outlet",
    label: "Isangano Terrace and Lake Bar",
    description: "In-house outlets at Isangano",
    level: 2,
  },
  { id: "ish", kind: "property", label: "Ishyamba Forest Lodge", description: "Nyamagabe · 18 tents", level: 1 },
  {
    id: "ard",
    kind: "entity",
    label: "Amahoro Residences Ltd",
    description: "Legal entity · TIN 102 345 990",
    level: 0,
  },
  { id: "kcr", kind: "property", label: "Kacyiru Court Residences", description: "Gasabo · 24 units", level: 1 },
  {
    id: "ikw",
    kind: "merchant",
    label: "Ikawa Corner",
    description: "Separate merchant · manages its own team",
    level: 1,
  },
];

const teamRolesInvite: TeamRolesInviteDraft[] = [
  {
    id: "draft",
    name: "Clarisse Umutoni",
    contact: "+250 788 412 907",
    role: "finance",
    scope: ["isg", "ter"],
    expiry: "7d",
    expiries: [
      { id: "1d", label: "24 hours", expiresOn: "Tue 13 Oct", expiresShort: "13 Oct" },
      { id: "7d", label: "7 days", expiresOn: "Mon 19 Oct", expiresShort: "19 Oct" },
      { id: "14d", label: "14 days", expiresOn: "Mon 26 Oct", expiresShort: "26 Oct" },
    ],
    expiresAt: "10:45",
    verifyPhone: "+250 78• ••• 214",
  },
];

const teamRolesFixtures = {
  "owner.teamRolesMembers": teamRolesMembers,
  "owner.teamRolesRoles": teamRolesRoles,
  "owner.teamRolesPermissionAreas": teamRolesPermissionAreas,
  "owner.teamRolesScopes": teamRolesScopes,
  "owner.teamRolesInvite": teamRolesInvite,
} satisfies FixtureSet;
// ── PlanBilling ─────────────────────────────────────────────────────────────────────────────────────────
/** State of the October subscription charge: board variant `?billing=retrying|paid`; "pending" after Pay now. */
export type PlanBillingState = "retrying" | "pending" | "paid";

/** A step of the subscription history or of the retry schedule (Timeline). */
export interface PlanBillingStep {
  id: string;
  status: "success" | "current" | "danger" | "default";
  title: string;
  detail: string;
}

/** A line of the next invoice. Amounts are pending price approval. */
export interface PlanBillingInvoiceLine {
  id: string;
  label: string;
  sub: string;
}

/** A module the plan includes, with usage at 12 Oct. `usedPct` 0 = no usage bar. */
export interface PlanBillingEntitlement {
  id: string;
  name: string;
  included: string;
  used: string;
  usedPct: number;
  status: string;
  tone: Tone;
}

/** Status of an invoice and the evidence behind it. */
export interface PlanBillingInvoiceStatus {
  status: string;
  tone: Tone;
  evidence: string;
}

/** A subscription invoice. The open invoice carries its status for the other billing states in `byState`. */
export interface PlanBillingInvoice extends PlanBillingInvoiceStatus {
  id: string;
  period: string;
  byState: { pending?: PlanBillingInvoiceStatus; paid?: PlanBillingInvoiceStatus } | null;
}

/** A saved payment method of the subscription. */
export interface PlanBillingMethod {
  id: string;
  icon: IconName;
  title: string;
  description: string;
}

/** One of the three kinds of invoice, and the screen where it lives. */
export interface PlanBillingInvoiceKind {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  board: BoardId;
}

/** An option of the Pay, Change plan or Cancel dialog. */
export interface PlanBillingOption {
  id: string;
  dialog: "pay" | "plan" | "cancel";
  title: string;
  right: string;
  description: string;
  isDisabled: boolean;
  isDefault: boolean;
}

const planBillingActivation: PlanBillingStep[] = [
  {
    id: "registration",
    status: "success",
    title: "Registration fee · hotel business type",
    detail: "14 Mar 2026 · [PRICE PENDING APPROVAL] · paid",
  },
  {
    id: "stub-month",
    status: "success",
    title: "Activation stub month · 14–31 Mar",
    detail: "Charged for the days used · [PRICE PENDING APPROVAL] · paid",
  },
  {
    id: "billing-day",
    status: "success",
    title: "Billing on the 1st from 1 Apr 2026",
    detail: "Moved to Group plan on 1 Jul 2026",
  },
  {
    id: "next-billing",
    status: "current",
    title: "Next billing date · 1 Nov 2026",
    detail: "Plan prices are versioned; a new version applies only from a billing date",
  },
];

const planBillingNextLines: PlanBillingInvoiceLine[] = [
  { id: "group-plan", label: "Group plan", sub: "3 properties of 5" },
  { id: "residence-addon", label: "Residence add-on", sub: "Kacyiru Court · 24 units" },
  { id: "assistant", label: "Assistant above the included 2,000 questions", sub: "None so far this month" },
  { id: "vat", label: "VAT", sub: "Shown on Injishi’s fiscal receipt" },
];

const planBillingRetries: PlanBillingStep[] = [
  {
    id: "attempt-1",
    status: "danger",
    title: "1 Oct 07:00 · Failed",
    detail: "Insufficient balance · MTN ref MP261001.0700.R11872",
  },
  {
    id: "attempt-2",
    status: "danger",
    title: "4 Oct 07:00 · Failed",
    detail: "Insufficient balance · MTN ref MP261004.0700.R11872",
  },
  { id: "attempt-3", status: "current", title: "15 Oct 07:00 · next retry", detail: "Same MoMo number" },
  { id: "attempt-4", status: "default", title: "22 Oct 07:00 · last retry", detail: "" },
  {
    id: "grace-end",
    status: "default",
    title: "31 Oct · grace period ends",
    detail: "Then new bookings and sales pause; sign-in, reports and all fiscal and financial exports stay open",
  },
];

const planBillingEntitlements: PlanBillingEntitlement[] = [
  {
    id: "front-office",
    name: "Front office and reservations",
    included: "5 properties",
    used: "3",
    usedPct: 60,
    status: "Included",
    tone: "success",
  },
  {
    id: "rooms-units",
    name: "Rooms and units",
    included: "120",
    used: "84 · 60 rooms, 24 units",
    usedPct: 70,
    status: "Included",
    tone: "success",
  },
  {
    id: "outlets-pos",
    name: "Outlets and POS",
    included: "6 outlets",
    used: "3 · Ikawa Corner has its own plan",
    usedPct: 50,
    status: "Included",
    tone: "success",
  },
  {
    id: "fiscal-connector",
    name: "Fiscal receipts connector",
    included: "3 legal entities",
    used: "2",
    usedPct: 67,
    status: "Included",
    tone: "success",
  },
  {
    id: "people-payroll",
    name: "People and payroll",
    included: "60 employees",
    used: "48",
    usedPct: 80,
    status: "Included",
    tone: "success",
  },
  {
    id: "residence",
    name: "Residence",
    included: "30 units",
    used: "24",
    usedPct: 80,
    status: "Add-on",
    tone: "accent",
  },
  {
    id: "assistant",
    name: "Injishi assistant",
    included: "2,000 questions a month",
    used: "640",
    usedPct: 32,
    status: "Included",
    tone: "success",
  },
  {
    id: "revenue-recommendations",
    name: "Revenue recommendations, multi-property",
    included: "—",
    used: "—",
    usedPct: 0,
    status: "Not in plan",
    tone: "default",
  },
];

const planBillingInvoices: PlanBillingInvoice[] = [
  {
    id: "INJ-2026-1001",
    period: "October 2026 · Group plan, residence add-on",
    status: "Retrying",
    tone: "warning",
    evidence: "2 failed attempts · next 15 Oct",
    byState: {
      pending: { status: "Pending", tone: "accent", evidence: "Payment request sent 10:42 · waiting for MTN" },
      paid: { status: "Paid", tone: "success", evidence: "MTN MoMo · MP261001.0700.R44120 · verified 1 Oct" },
    },
  },
  {
    id: "INJ-2026-0901",
    period: "September 2026",
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo · MP260901.0700.R40021 · fiscal receipt issued",
    byState: null,
  },
  {
    id: "INJ-2026-0801",
    period: "August 2026",
    status: "Paid",
    tone: "success",
    evidence: "Bank transfer · GT Bank ref FT26214AHG0042",
    byState: null,
  },
  {
    id: "INJ-2026-0701",
    period: "July 2026 · moved to Group plan",
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo · MP260701.0700.R30876",
    byState: null,
  },
  {
    id: "INJ-2026-0401",
    period: "April to June 2026 · 3 invoices",
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo · all verified",
    byState: null,
  },
  {
    id: "INJ-2026-0314",
    period: "Activation stub month · 14–31 Mar",
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo · MP260314.1125.R10022",
    byState: null,
  },
  {
    id: "INJ-2026-0313",
    period: "Registration fee · hotel",
    status: "Paid",
    tone: "success",
    evidence: "MTN MoMo · MP260313.1610.R10004",
    byState: null,
  },
];

const planBillingMethods: PlanBillingMethod[] = [
  {
    id: "mtn-momo",
    icon: "Smartphone",
    title: "MTN MoMo · +250 78• ••• 214",
    description: "Primary · Didier Mugenzi",
  },
  {
    id: "bank-transfer",
    icon: "Vault",
    title: "Bank transfer · ref AHG-0042",
    description: "Backup · matched by reference within one business day",
  },
];

const planBillingInvoiceKinds: PlanBillingInvoiceKind[] = [
  {
    id: "subscription",
    icon: "CreditCard",
    title: "Injishi subscription",
    description: "This page. Injishi invoices Amahoro Hospitality Ltd for the service.",
    board: "PlanBilling",
  },
  {
    id: "guest-company",
    icon: "Receipt",
    title: "Guest and company invoices",
    description: "Your legal entities invoice guests and companies from folios and the city ledger.",
    board: "AccountsReceivable",
  },
  {
    id: "outlet-merchant",
    icon: "Cup",
    title: "Outlet merchant invoices",
    description: "Ikawa Corner Ltd invoices its own customers under TIN 108 221 457.",
    board: "OutletsMenus",
  },
];

const planBillingOptions: PlanBillingOption[] = [
  {
    id: "pay-mtn",
    dialog: "pay",
    title: "MTN MoMo · +250 78• ••• 214",
    right: "Primary",
    description: "Approve the prompt on your phone",
    isDisabled: false,
    isDefault: true,
  },
  {
    id: "pay-airtel",
    dialog: "pay",
    title: "Airtel Money",
    right: "Add number",
    description: "Through the GT Bank adapter",
    isDisabled: false,
    isDefault: false,
  },
  {
    id: "pay-bank",
    dialog: "pay",
    title: "Bank transfer",
    right: "Ref AHG-0042",
    description: "Matched by reference within one business day",
    isDisabled: false,
    isDefault: false,
  },
  {
    id: "pay-card",
    dialog: "pay",
    title: "Card",
    right: "Not available",
    description: "GT Bank card service is not live in production",
    isDisabled: true,
    isDefault: false,
  },
  {
    id: "plan-property",
    dialog: "plan",
    title: "Property",
    right: "[PRICE PENDING APPROVAL]",
    description: "One property · core front office, folios, fiscal receipts",
    isDisabled: false,
    isDefault: false,
  },
  {
    id: "plan-group",
    dialog: "plan",
    title: "Group · current plan",
    right: "[PRICE PENDING APPROVAL]",
    description: "Up to 5 properties · outlets, payroll, API, assistant",
    isDisabled: false,
    isDefault: true,
  },
  {
    id: "plan-enterprise",
    dialog: "plan",
    title: "Enterprise",
    right: "[PRICE PENDING APPROVAL]",
    description: "More than 5 properties · revenue recommendations, custom terms",
    isDisabled: false,
    isDefault: false,
  },
  {
    id: "cancel-cost",
    dialog: "cancel",
    title: "Too expensive",
    right: "",
    description: "",
    isDisabled: false,
    isDefault: true,
  },
  {
    id: "cancel-closing",
    dialog: "cancel",
    title: "Closing or selling the business",
    right: "",
    description: "",
    isDisabled: false,
    isDefault: false,
  },
  {
    id: "cancel-moving",
    dialog: "cancel",
    title: "Moving to another system",
    right: "",
    description: "",
    isDisabled: false,
    isDefault: false,
  },
];

const planBillingFixtures = {
  "owner.planBillingActivation": planBillingActivation,
  "owner.planBillingNextLines": planBillingNextLines,
  "owner.planBillingRetries": planBillingRetries,
  "owner.planBillingEntitlements": planBillingEntitlements,
  "owner.planBillingInvoices": planBillingInvoices,
  "owner.planBillingMethods": planBillingMethods,
  "owner.planBillingInvoiceKinds": planBillingInvoiceKinds,
  "owner.planBillingOptions": planBillingOptions,
} satisfies FixtureSet;
// ── SettingsBusiness ────────────────────────────────────────────────────────────────────────────────────
export type SettingsBusinessNodeKind = "tenant" | "entity" | "property" | "group" | "dept" | "outlet";

/** What the right-hand panel shows for a selected node of the hierarchy. */
export interface SettingsBusinessDetail {
  kind: string;
  title: string;
  chip: string;
  chipTone: Tone;
  facts: OwnerPair[];
  /** Readiness gate, e.g. "VSDC integration certification pending" ("" = none). */
  gate: string;
  note: string;
  links: OwnerLink[];
}

/**
 * A node of the business hierarchy (tenant › legal entity › property › departments and outlets).
 * `parent` is the collapsible group a node sits in; `expanded` is a group's default state.
 * A property without `detail` opens its editable profile (owner.settingsBusinessProfiles).
 */
export interface SettingsBusinessNode {
  id: string;
  depth: number;
  kind: SettingsBusinessNodeKind;
  icon: IconName;
  label: string;
  meta: string;
  tag: string;
  tagTone: Tone;
  parent: string | null;
  expanded: boolean;
  detail: SettingsBusinessDetail | null;
}

/** A fact of a property profile, optionally pointing at the screen where it is managed. */
export interface SettingsBusinessFact {
  label: string;
  value: string;
  link: OwnerLink | null;
}

/** Editable profile of a property (id = its hierarchy node). */
export interface SettingsBusinessProfile {
  id: string;
  branchCode: string;
  name: string;
  status: string;
  statusTone: Tone;
  type: string;
  typeOptions: string[];
  entity: string;
  location: string;
  locationOptions: string[];
  phone: string;
  email: string;
  facts: SettingsBusinessFact[];
}

/** A room type of the selected property and the domain it is sold in. */
export interface SettingsBusinessUnit {
  id: string;
  name: string;
  rooms: string;
  rate: string;
  domain: "hospitality" | "residence";
  /** A domain change someone asked for that has not passed its checks yet. */
  requestedDomain: "hospitality" | "residence" | null;
}

/** A check a unit must pass before it can move from hospitality to residence. */
export interface SettingsBusinessDomainCheck {
  id: string;
  /** The unit (room type) whose domain change this check applies to. */
  unit: string;
  tag: string;
  tone: Tone;
  text: string;
}

/** A branch members' access can be limited to; opens its node. */
export interface SettingsBusinessBranch {
  id: string;
  code: string;
  name: string;
  meta: string;
  node: string;
}

const settingsBusinessNodes: SettingsBusinessNode[] = [
  {
    id: "tenant",
    depth: 0,
    kind: "tenant",
    icon: "FolderHouse",
    label: "Amahoro Hospitality Group",
    meta: "Tenant · 2 legal entities · 3 properties",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: {
      kind: "Tenant",
      title: "Amahoro Hospitality Group",
      chip: "Owner: Didier Mugenzi",
      chipTone: "default",
      facts: [
        { label: "Legal entities", value: "Amahoro Hospitality Ltd, Amahoro Residences Ltd" },
        { label: "Properties", value: "Isangano Lakeside Hotel, Ishyamba Forest Lodge, Kacyiru Court Residences" },
        { label: "Standalone outlets", value: "Isangano Express kiosk" },
        { label: "Plan", value: "Group · billed to Amahoro Hospitality Ltd" },
      ],
      gate: "",
      note: "A tenant groups your legal entities. Money and fiscal records never pool across entities.",
      links: [
        { label: "Plan and billing", board: "PlanBilling" },
        { label: "Team and roles", board: "TeamRoles" },
      ],
    },
  },
  {
    id: "ahl",
    depth: 1,
    kind: "entity",
    icon: "Briefcase",
    label: "Amahoro Hospitality Ltd",
    meta: "TIN 102 345 678 · VAT registered",
    tag: "Legal entity",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: {
      kind: "Legal entity",
      title: "Amahoro Hospitality Ltd",
      chip: "VAT registered",
      chipTone: "success",
      facts: [
        { label: "TIN", value: "102 345 678" },
        { label: "Registered address", value: "Rubavu, Western Province" },
        { label: "Fiscal route", value: "EBM through VSDC · 2 devices: SDC-ISG-01 Isangano, SDC-ISH-01 Ishyamba" },
        { label: "Device status", value: "Isangano connected · Ishyamba credential change awaiting your approval" },
        { label: "Merchant account", value: "GT Bank adapter · sandbox only" },
        { label: "Operates", value: "Isangano Lakeside Hotel, Ishyamba Forest Lodge, Isangano Express kiosk" },
      ],
      gate: "VSDC integration certification pending",
      note: "Receipts for every property under this entity are signed with its TIN. VAT status is as you recorded it from the certificate on file.",
      links: [
        { label: "EBM / VSDC settings", board: "Integrations" },
        { label: "Approvals", board: "Approvals" },
      ],
    },
  },
  {
    id: "isg",
    depth: 2,
    kind: "property",
    icon: "House",
    label: "Isangano Lakeside Hotel",
    meta: "Hotel · Rubavu · 42 rooms",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: null,
  },
  {
    id: "dep",
    depth: 3,
    kind: "group",
    icon: "Hierarchy",
    label: "Departments",
    meta: "3 operated · 3 undistributed",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: null,
  },
  {
    id: "d-rooms",
    depth: 4,
    kind: "dept",
    icon: "LayoutCells",
    label: "Rooms",
    meta: "Front office, housekeeping",
    tag: "Operated",
    tagTone: "success",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Rooms",
      chip: "Operated",
      chipTone: "success",
      facts: [
        { label: "Report category", value: "Operated department: revenue, expenses and departmental profit" },
        { label: "Head", value: "Aline Uwase" },
        { label: "Staff assigned", value: "21 in People" },
        { label: "Ledger accounts", value: "4000 · 5000" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "d-fb",
    depth: 4,
    kind: "dept",
    icon: "Cup",
    label: "Food and beverage",
    meta: "Restaurant, bar, banquets",
    tag: "Operated",
    tagTone: "success",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Food and beverage",
      chip: "Operated",
      chipTone: "success",
      facts: [
        { label: "Report category", value: "Operated department: revenue, expenses and departmental profit" },
        { label: "Head", value: "Joseph Habimana" },
        { label: "Staff assigned", value: "14 in People" },
        { label: "Ledger accounts", value: "4100 · 5100" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "d-oth",
    depth: 4,
    kind: "dept",
    icon: "TShirt",
    label: "Other operated",
    meta: "Laundry, transfers, activities",
    tag: "Operated",
    tagTone: "success",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Other operated",
      chip: "Operated",
      chipTone: "success",
      facts: [
        { label: "Report category", value: "Operated department: revenue, expenses and departmental profit" },
        { label: "Head", value: "Aline Uwase" },
        { label: "Staff assigned", value: "3 in People" },
        { label: "Ledger accounts", value: "4200 · 5200" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "d-ag",
    depth: 4,
    kind: "dept",
    icon: "Briefcase",
    label: "Administrative and general",
    meta: "Finance, HR, IT",
    tag: "Undistributed",
    tagTone: "default",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Administrative and general",
      chip: "Undistributed",
      chipTone: "default",
      facts: [
        { label: "Report category", value: "Undistributed: expenses only, before gross operating profit" },
        { label: "Head", value: "Didier Mugenzi" },
        { label: "Staff assigned", value: "5 in People" },
        { label: "Ledger accounts", value: "6000" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "d-sm",
    depth: 4,
    kind: "dept",
    icon: "Megaphone",
    label: "Sales and marketing",
    meta: "Sales, events, distribution",
    tag: "Undistributed",
    tagTone: "default",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Sales and marketing",
      chip: "Undistributed",
      chipTone: "default",
      facts: [
        { label: "Report category", value: "Undistributed: expenses only, before gross operating profit" },
        { label: "Head", value: "Aline Uwase" },
        { label: "Staff assigned", value: "2 in People" },
        { label: "Ledger accounts", value: "6100" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "d-pom",
    depth: 4,
    kind: "dept",
    icon: "Wrench",
    label: "Property operation and maintenance",
    meta: "Engineering, grounds",
    tag: "Undistributed",
    tagTone: "default",
    parent: "dep",
    expanded: false,
    detail: {
      kind: "Department · Isangano",
      title: "Property operation and maintenance",
      chip: "Undistributed",
      chipTone: "default",
      facts: [
        { label: "Report category", value: "Undistributed: expenses only, before gross operating profit" },
        { label: "Head", value: "Jean-Paul Niyonsaba" },
        { label: "Staff assigned", value: "3 in People" },
        { label: "Ledger accounts", value: "6200" },
      ],
      gate: "Account mapping awaiting Finance sign-off",
      note: "Departments drive the departmental profit report and staff assignments. HR can edit department membership; categories are yours.",
      links: [
        { label: "Reports", board: "Reports" },
        { label: "People", board: "PeopleHome" },
      ],
    },
  },
  {
    id: "out",
    depth: 3,
    kind: "group",
    icon: "Cup",
    label: "Outlets",
    meta: "2 in-house · 1 tenant",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: true,
    detail: null,
  },
  {
    id: "o-ter",
    depth: 4,
    kind: "outlet",
    icon: "Cup",
    label: "Isangano Terrace",
    meta: "Restaurant",
    tag: "In-house",
    tagTone: "accent",
    parent: "out",
    expanded: false,
    detail: {
      kind: "Outlet · in-house",
      title: "Isangano Terrace",
      chip: "In-house",
      chipTone: "accent",
      facts: [
        { label: "Merchant", value: "Amahoro Hospitality Ltd · TIN 102 345 678" },
        { label: "Department", value: "Food and beverage (operated)" },
        { label: "Fiscal receipts", value: "Signed by SDC-ISG-01" },
        { label: "Charge to room", value: "Allowed for in-house guests, limit RWF 200,000 per stay" },
        { label: "Kitchen display", value: "1 screen" },
      ],
      gate: "",
      note: "Sales keep their outlet and department attribution when charged to a room folio.",
      links: [
        { label: "Outlets & menus", board: "OutletsMenus" },
        { label: "Charge-to-room policy", board: "SettingsPolicies" },
      ],
    },
  },
  {
    id: "o-bar",
    depth: 4,
    kind: "outlet",
    icon: "Cup",
    label: "Lake Bar",
    meta: "Bar",
    tag: "In-house",
    tagTone: "accent",
    parent: "out",
    expanded: false,
    detail: {
      kind: "Outlet · in-house",
      title: "Lake Bar",
      chip: "In-house",
      chipTone: "accent",
      facts: [
        { label: "Merchant", value: "Amahoro Hospitality Ltd · TIN 102 345 678" },
        { label: "Department", value: "Food and beverage (operated)" },
        { label: "Fiscal receipts", value: "Signed by SDC-ISG-01" },
        { label: "Charge to room", value: "Allowed with room key check" },
      ],
      gate: "",
      note: "Sales keep their outlet and department attribution when charged to a room folio.",
      links: [{ label: "Outlets & menus", board: "OutletsMenus" }],
    },
  },
  {
    id: "o-ikw",
    depth: 4,
    kind: "outlet",
    icon: "Mug",
    label: "Ikawa Corner",
    meta: "Ikawa Corner Ltd · TIN 108 221 457",
    tag: "Tenant",
    tagTone: "warning",
    parent: "out",
    expanded: false,
    detail: {
      kind: "Outlet · tenant",
      title: "Ikawa Corner",
      chip: "Separate merchant",
      chipTone: "warning",
      facts: [
        { label: "Operator", value: "Ikawa Corner Ltd · TIN 108 221 457" },
        { label: "Your relationship", value: "Landlord · rent RWF 100,000 a month, booked as miscellaneous income" },
        { label: "Fiscal receipts", value: "Ikawa Corner signs with its own device and TIN" },
        { label: "Payments", value: "Into Ikawa Corner’s own merchant account" },
        { label: "Charge to room", value: "Not allowed · no settlement agreement on file" },
      ],
      gate: "",
      note: "Ikawa Corner’s staff, menus, sales and money are not visible to you, and yours are not visible to them.",
      links: [{ label: "Charge-to-room policy", board: "SettingsPolicies" }],
    },
  },
  {
    id: "ish",
    depth: 2,
    kind: "property",
    icon: "House",
    label: "Ishyamba Forest Lodge",
    meta: "Lodge · Nyamagabe · 18 tents",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: {
      kind: "Property",
      title: "Ishyamba Forest Lodge",
      chip: "Active · listed",
      chipTone: "success",
      facts: [
        { label: "Branch code", value: "ISH" },
        { label: "Type", value: "Lodge · 18 tents" },
        { label: "Location", value: "Southern · Nyamagabe · Kitabi" },
        { label: "Legal entity", value: "Amahoro Hospitality Ltd" },
        { label: "Outlets", value: "Lodge dining (in-house)" },
        { label: "Licence", value: "Tourism licence expires 15 Nov 2026" },
      ],
      gate: "",
      note: "Open a property to edit its profile. Units and their domain are managed per property.",
      links: [
        { label: "Compliance", board: "Compliance" },
        { label: "Rates & inventory", board: "RatesInventory" },
      ],
    },
  },
  {
    id: "o-exp",
    depth: 2,
    kind: "outlet",
    icon: "ShoppingBag",
    label: "Isangano Express kiosk",
    meta: "Gisenyi beach · not inside a property",
    tag: "Standalone",
    tagTone: "info",
    parent: null,
    expanded: false,
    detail: {
      kind: "Outlet · standalone",
      title: "Isangano Express kiosk",
      chip: "Standalone",
      chipTone: "info",
      facts: [
        { label: "Merchant", value: "Amahoro Hospitality Ltd · TIN 102 345 678" },
        { label: "Location", value: "Gisenyi beach, not inside a property" },
        { label: "Department", value: "Food and beverage (operated)" },
        { label: "Charge to room", value: "Not available: no rooms attached" },
        { label: "Fiscal receipts", value: "Branch device not set up yet" },
      ],
      gate: "Branch fiscal device for the kiosk not verified",
      note: "Until its fiscal device is confirmed, the kiosk cannot close sales in Injishi.",
      links: [{ label: "Integrations", board: "Integrations" }],
    },
  },
  {
    id: "ard",
    depth: 1,
    kind: "entity",
    icon: "Briefcase",
    label: "Amahoro Residences Ltd",
    meta: "TIN 102 345 990",
    tag: "Legal entity",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: {
      kind: "Legal entity",
      title: "Amahoro Residences Ltd",
      chip: "Fiscal rules not verified",
      chipTone: "warning",
      facts: [
        { label: "TIN", value: "102 345 990" },
        { label: "Operates", value: "Kacyiru Court Residences" },
        { label: "Fiscal route", value: "None yet" },
        { label: "Merchant account", value: "GT Bank adapter · sandbox only" },
        { label: "Rent collection", value: "MTN MoMo and bank transfer, verified per payment" },
      ],
      gate: "Fiscal treatment of residential rent not verified",
      note: "No fiscal receipts are issued for rent until the treatment is confirmed with your tax adviser. Rent receipts are payment receipts only.",
      links: [
        { label: "Rent roll", board: "RentRoll" },
        { label: "Integrations", board: "Integrations" },
      ],
    },
  },
  {
    id: "kcr",
    depth: 2,
    kind: "property",
    icon: "House",
    label: "Kacyiru Court Residences",
    meta: "Residence · Gasabo · 24 units",
    tag: "",
    tagTone: "default",
    parent: null,
    expanded: false,
    detail: {
      kind: "Property",
      title: "Kacyiru Court Residences",
      chip: "Residence",
      chipTone: "accent",
      facts: [
        { label: "Branch code", value: "KCR" },
        { label: "Type", value: "Residence · 24 units, all leased by the month" },
        { label: "Location", value: "Kigali · Gasabo · Kacyiru" },
        { label: "Legal entity", value: "Amahoro Residences Ltd" },
        { label: "Manager", value: "Solange Uwimana, scoped to this property only" },
      ],
      gate: "",
      note: "Residence units use leases, not stays, and never appear in hotel availability or occupancy.",
      links: [
        { label: "Leases", board: "Leases" },
        { label: "Rent roll", board: "RentRoll" },
      ],
    },
  },
];

const settingsBusinessProfiles: SettingsBusinessProfile[] = [
  {
    id: "isg",
    branchCode: "ISG",
    name: "Isangano Lakeside Hotel",
    status: "Active · listed",
    statusTone: "success",
    type: "Hotel",
    typeOptions: ["Hotel", "Lodge", "Residence"],
    entity: "Amahoro Hospitality Ltd · TIN 102 345 678",
    location: "Western · Rubavu · Gisenyi · Nengo",
    locationOptions: [
      "Western · Rubavu · Gisenyi · Nengo",
      "Western · Rubavu · Gisenyi · Mbugangari",
      "Western · Rubavu · Gisenyi · Umuganda",
      "Western · Rubavu · Gisenyi · Bugoyi",
    ],
    phone: "+250 788 300 100",
    email: "stay@isangano.rw",
    facts: [
      { label: "Time zone and currency", value: "Central Africa Time (UTC+2) · RWF", link: null },
      {
        label: "Classification",
        value: "Hotel · 3 star, from the RDB grading on file",
        link: { label: "Compliance", board: "Compliance" },
      },
      {
        label: "Check-in and check-out",
        value: "14:00 and 11:00",
        link: { label: "Policies", board: "SettingsPolicies" },
      },
      {
        label: "Event spaces",
        value: "Kivu Hall (120 seated), Garden Terrace · sold separately from rooms",
        link: null,
      },
    ],
  },
];

const settingsBusinessUnits: SettingsBusinessUnit[] = [
  {
    id: "sq",
    name: "Standard Queen",
    rooms: "Rooms 101–112, 201–204",
    rate: "From RWF 85,000",
    domain: "hospitality",
    requestedDomain: null,
  },
  {
    id: "tw",
    name: "Twin",
    rooms: "Rooms 205–212, 301–302",
    rate: "From RWF 92,000",
    domain: "hospitality",
    requestedDomain: null,
  },
  {
    id: "dlx",
    name: "Deluxe Lake View",
    rooms: "Rooms 303–312, 401–402",
    rate: "From RWF 140,000",
    domain: "hospitality",
    requestedDomain: null,
  },
  {
    id: "fs",
    name: "Family Suite",
    rooms: "Rooms 403–404",
    rate: "From RWF 220,000",
    domain: "hospitality",
    requestedDomain: null,
  },
  {
    id: "apt",
    name: "Lake Apartments",
    rooms: "Units 405–406",
    rate: "Family Suite rate today",
    domain: "hospitality",
    requestedDomain: "residence",
  },
];

const settingsBusinessDomainChecks: SettingsBusinessDomainCheck[] = [
  {
    id: "c1",
    unit: "apt",
    tag: "Blocking",
    tone: "danger",
    text: "3 future bookings hold these units: BK-20452 (18–21 Oct), BK-20467 (2–9 Nov), BK-20471 (28 Nov–2 Dec). Move or cancel them, or change from 3 Dec.",
  },
  {
    id: "c2",
    unit: "apt",
    tag: "Changes",
    tone: "warning",
    text: "Rates, packages and channel listings for 405–406 end on the effective date.",
  },
  {
    id: "c3",
    unit: "apt",
    tag: "Changes",
    tone: "warning",
    text: "Hotel occupancy counts 40 rooms instead of 42 from that date. Past reports keep 42.",
  },
  {
    id: "c4",
    unit: "apt",
    tag: "Check",
    tone: "warning",
    text: "Leases for these units would be issued by Amahoro Hospitality Ltd, not Amahoro Residences Ltd, unless you transfer them.",
  },
  {
    id: "c5",
    unit: "apt",
    tag: "Kept",
    tone: "default",
    text: "Past stays, folios and maintenance history stay attached to the units.",
  },
];

const settingsBusinessBranches: SettingsBusinessBranch[] = [
  { id: "isg", code: "ISG", name: "Isangano Lakeside Hotel", meta: "Hotel · 42 rooms · 3 outlets", node: "isg" },
  { id: "ish", code: "ISH", name: "Ishyamba Forest Lodge", meta: "Lodge · 18 tents · 1 outlet", node: "ish" },
  { id: "kcr", code: "KCR", name: "Kacyiru Court Residences", meta: "Residence · 24 units", node: "kcr" },
  { id: "o-exp", code: "EXP", name: "Isangano Express kiosk", meta: "Standalone outlet", node: "o-exp" },
];

const settingsBusinessFixtures = {
  "owner.settingsBusinessNodes": settingsBusinessNodes,
  "owner.settingsBusinessProfiles": settingsBusinessProfiles,
  "owner.settingsBusinessUnits": settingsBusinessUnits,
  "owner.settingsBusinessDomainChecks": settingsBusinessDomainChecks,
  "owner.settingsBusinessBranches": settingsBusinessBranches,
} satisfies FixtureSet;
// ── SettingsPolicies ────────────────────────────────────────────────────────────────────────────────────
/** Policy groups of the Policies settings screen. */
export type SettingsPoliciesGroupId = "book" | "stay" | "data";

export interface SettingsPoliciesGroup {
  id: SettingsPoliciesGroupId;
  label: string;
}

/** A property whose policies can be edited. */
export interface SettingsPoliciesProperty {
  id: string;
  name: string;
}

/** A policy setting picked from a list (cell select). */
export interface SettingsPoliciesSelectRow {
  kind: "select";
  id: string;
  label: string;
  value: string;
  options: string[];
  note?: string;
  /** Readiness gate shown beside the note ("Configured · unverified"). */
  gate?: string;
}

/** A policy setting that is on or off (cell switch). Locked switches cannot be changed here. */
export interface SettingsPoliciesSwitchRow {
  kind: "switch";
  id: string;
  label: string;
  value: boolean;
  locked: boolean;
  note?: string;
}

export type SettingsPoliciesRow = SettingsPoliciesSelectRow | SettingsPoliciesSwitchRow;

/** A card of policy settings, e.g. "Booking Mode". */
export interface SettingsPoliciesCard {
  id: string;
  group: SettingsPoliciesGroupId;
  title: string;
  description: string;
  rows: SettingsPoliciesRow[];
  /** Footnote under the rows, optionally followed by a link to another screen. */
  foot?: string;
  footLink?: OwnerLink;
}

/** A cancellation tier of the refund policy (the refund share comes from each version). */
export interface SettingsPoliciesTier {
  id: string;
  name: string;
  when: string;
}

/** A version of the cancellation and refund policy. */
export interface SettingsPoliciesVersion {
  id: string;
  /** Segment label: "v4 · current". */
  label: string;
  name: string;
  policyName: string;
  state: "retired" | "current" | "draft" | "scheduled";
  stateLabel: string;
  stateTone: Tone;
  dates: string;
  /** Refund of the deposit per tier, percent (same order as the tiers). */
  refunds: number[];
}

/** An outlet that may post sales to a guest folio (charge to room). */
export interface SettingsPoliciesOutlet {
  id: string;
  name: string;
  operator: string;
  rule: string;
  allowed: boolean;
  /** Cannot be switched on here (separate merchant without a settlement agreement). */
  locked: boolean;
}

const settingsPoliciesInstantOrRequest = ["Instant confirmation", "Request to book"];

const settingsPoliciesGroups: SettingsPoliciesGroup[] = [
  { id: "book", label: "Bookings and money" },
  { id: "stay", label: "Arrival and stay" },
  { id: "data", label: "Guest data and messages" },
];

const settingsPoliciesProperties: SettingsPoliciesProperty[] = [
  { id: "isg", name: "Isangano Lakeside Hotel" },
  { id: "ish", name: "Ishyamba Forest Lodge" },
  { id: "kcr", name: "Kacyiru Court Residences" },
];

const settingsPoliciesCards: SettingsPoliciesCard[] = [
  {
    id: "booking-mode",
    group: "book",
    title: "Booking Mode",
    description: "How each channel confirms a booking",
    rows: [
      {
        kind: "select",
        id: "m.direct",
        label: "Direct website",
        value: "Instant confirmation",
        options: settingsPoliciesInstantOrRequest,
      },
      {
        kind: "select",
        id: "m.market",
        label: "Injishi marketplace",
        value: "Instant confirmation",
        options: settingsPoliciesInstantOrRequest,
      },
      {
        kind: "select",
        id: "m.group",
        label: "Groups of 5 or more rooms",
        value: "Request to book",
        options: settingsPoliciesInstantOrRequest,
      },
      {
        kind: "select",
        id: "m.window",
        label: "Decision window for requests",
        value: "12 hours",
        options: ["6 hours", "12 hours", "24 hours"],
        note: "Rooms are held for the guest while you decide.",
      },
      {
        kind: "switch",
        id: "m.auto",
        label: "Decline automatically when the window ends",
        value: true,
        locked: false,
        note: "The guest is told and the held rooms are released.",
      },
      {
        kind: "select",
        id: "m.hold",
        label: "Hold rooms during online checkout",
        value: "20 minutes",
        options: ["10 minutes", "20 minutes", "30 minutes"],
        note: "Released at once if the payment fails or the guest leaves.",
      },
    ],
  },
  {
    id: "deposits",
    group: "book",
    title: "Deposits",
    description: "What guests pay before arrival",
    rows: [
      {
        kind: "select",
        id: "d.amt",
        label: "Deposit",
        value: "30% of the stay",
        options: ["None", "30% of the stay", "50% of the stay", "First night"],
      },
      {
        kind: "select",
        id: "d.due",
        label: "Due",
        value: "At booking",
        options: ["At booking", "7 days before arrival", "14 days before arrival"],
      },
      {
        kind: "select",
        id: "d.grp",
        label: "Groups of 5 or more rooms",
        value: "50%, 21 days before arrival",
        options: ["30%, 14 days before arrival", "50%, 21 days before arrival"],
      },
      {
        kind: "select",
        id: "d.unpaid",
        label: "If the deposit is not paid",
        value: "Release the hold after 24 hours",
        options: ["Release the hold after 24 hours", "Release after 48 hours", "Keep and remind"],
      },
      {
        kind: "switch",
        id: "d.unknown",
        label: "Never release while a payment is Unknown",
        value: true,
        locked: true,
        note: "If the provider has not answered, the booking waits for the result instead of being cancelled.",
      },
    ],
  },
  {
    id: "no-shows",
    group: "book",
    title: "No-Shows",
    description: "Applied by the night audit",
    rows: [
      {
        kind: "select",
        id: "n.when",
        label: "Mark as no-show",
        value: "At night audit after the arrival date",
        options: ["At night audit after the arrival date", "18:00 on the arrival date"],
      },
      {
        kind: "select",
        id: "n.charge",
        label: "Charge",
        value: "First night, from the deposit",
        options: ["Nothing", "First night, from the deposit", "Whole deposit"],
      },
      { kind: "switch", id: "n.release", label: "Release the remaining nights", value: true, locked: false },
      { kind: "switch", id: "n.sms", label: "Tell the guest by SMS", value: true, locked: false },
    ],
    foot: "A no-show charge is a folio charge with its own fiscal receipt.",
  },
  {
    id: "approval-limits",
    group: "book",
    title: "Approval Limits",
    description: "Who decides money exceptions",
    rows: [
      {
        kind: "select",
        id: "l.fd",
        label: "Front desk refunds up to",
        value: "RWF 50,000",
        options: ["RWF 0", "RWF 50,000", "RWF 100,000"],
      },
      {
        kind: "select",
        id: "l.fin",
        label: "Finance refunds up to",
        value: "RWF 300,000",
        options: ["RWF 150,000", "RWF 300,000", "RWF 500,000"],
      },
      {
        kind: "select",
        id: "l.wo",
        label: "Manager write-offs up to",
        value: "RWF 50,000",
        options: ["RWF 20,000", "RWF 50,000", "RWF 100,000"],
      },
      { kind: "switch", id: "l.reopen", label: "Reopening a closed folio needs the owner", value: true, locked: true },
    ],
    foot: "Anything above a limit goes to",
    footLink: { label: "Approvals", board: "Approvals" },
  },
  {
    id: "check-in-out",
    group: "stay",
    title: "Check-in and Check-out",
    description: "Times shown to guests and used by the room rack",
    rows: [
      {
        kind: "select",
        id: "t.in",
        label: "Check-in from",
        value: "14:00",
        options: ["12:00", "13:00", "14:00", "15:00"],
      },
      { kind: "select", id: "t.out", label: "Check-out by", value: "11:00", options: ["10:00", "11:00", "12:00"] },
      {
        kind: "select",
        id: "t.early",
        label: "Early check-in",
        value: "From 10:00 if a clean room is ready",
        options: ["From 10:00 if a clean room is ready", "From 12:00, RWF 20,000"],
      },
      {
        kind: "select",
        id: "t.late",
        label: "Late checkout until 14:00",
        value: "RWF 30,000",
        options: ["Free", "RWF 20,000", "RWF 30,000"],
      },
      {
        kind: "select",
        id: "t.after",
        label: "After 14:00",
        value: "Half-day rate",
        options: ["Half-day rate", "Full night"],
      },
      {
        kind: "switch",
        id: "t.appr",
        label: "Late checkout after 14:00 needs manager approval",
        value: true,
        locked: false,
      },
    ],
  },
  {
    id: "dirty-room-override",
    group: "stay",
    title: "Dirty-Room Check-in Override",
    description: "When a guest must go into a room not yet inspected",
    rows: [
      {
        kind: "select",
        id: "o.who",
        label: "Who can override",
        value: "General manager and owner",
        options: ["General manager and owner", "Owner only", "Front desk lead, manager and owner"],
      },
      {
        kind: "switch",
        id: "o.reason",
        label: "Reason required",
        value: true,
        locked: true,
        note: "The reason and the person are stored on the stay and in the audit log.",
      },
      { kind: "switch", id: "o.notify", label: "Tell the housekeeping supervisor at once", value: true, locked: false },
      {
        kind: "switch",
        id: "o.ooo",
        label: "Allow for rooms out of order",
        value: false,
        locked: true,
        note: "Never allowed. Maintenance must clear an out-of-order room first.",
      },
    ],
    foot: "Front desk sees why a room is blocked and who can override it.",
  },
  {
    id: "guest-id",
    group: "data",
    title: "Guest ID Capture and Retention",
    description: "Identity details taken at check-in",
    rows: [
      { kind: "switch", id: "i.cap", label: "Capture ID at check-in", value: true, locked: false },
      {
        kind: "select",
        id: "i.docs",
        label: "Accepted documents",
        value: "National ID, passport, EAC ID",
        options: ["National ID, passport, EAC ID", "Passport only for foreign guests"],
      },
      {
        kind: "select",
        id: "i.store",
        label: "What is stored",
        value: "Type, number and expiry, no image",
        options: ["Type, number and expiry, no image", "Also a photo of the document"],
      },
      {
        kind: "select",
        id: "i.keep",
        label: "Keep after checkout",
        value: "5 years",
        options: ["1 year", "3 years", "5 years", "7 years"],
        note: "Then anonymised automatically.",
        gate: "Configured · unverified",
      },
      {
        kind: "select",
        id: "i.who",
        label: "Who can view",
        value: "Front desk at check-in, managers",
        options: ["Front desk at check-in, managers", "Managers only"],
      },
    ],
    foot: "Every view is logged with its purpose.",
    footLink: { label: "Access log", board: "Compliance" },
  },
  {
    id: "guest-messaging",
    group: "data",
    title: "Guest Messaging",
    description: "Automatic messages and their hours",
    rows: [
      {
        kind: "select",
        id: "g.hours",
        label: "Automatic messages",
        value: "07:00 to 21:00",
        options: ["07:00 to 21:00", "08:00 to 20:00", "Any time"],
      },
      { kind: "switch", id: "g.quiet", label: "Outside those hours, urgent messages only", value: true, locked: false },
      {
        kind: "select",
        id: "g.lang",
        label: "Languages",
        value: "English, Kinyarwanda, French",
        options: ["English, Kinyarwanda, French", "English and Kinyarwanda"],
      },
      { kind: "switch", id: "g.wa", label: "WhatsApp", value: false, locked: true, note: "Not connected yet." },
    ],
    foot: "Channels are set up in",
    footLink: { label: "Integrations", board: "Integrations" },
  },
];

const settingsPoliciesTiers: SettingsPoliciesTier[] = [
  { id: "t1", name: "Tier 1", when: "14 days or more before arrival" },
  { id: "t2", name: "Tier 2", when: "9 to 13 days before" },
  { id: "t3", name: "Tier 3", when: "2 to 8 days before" },
  { id: "t4", name: "Tier 4", when: "Under 48 hours, or no-show" },
];

const settingsPoliciesVersions: SettingsPoliciesVersion[] = [
  {
    id: "v3",
    label: "v3",
    name: "Version 3",
    policyName: "Flexible 14-day",
    state: "retired",
    stateLabel: "Retired",
    stateTone: "default",
    dates: "1 Jan to 31 Jul 2026",
    refunds: [100, 50, 0, 0],
  },
  {
    id: "v4",
    label: "v4 · current",
    name: "Version 4",
    policyName: "Flexible 14-day",
    state: "current",
    stateLabel: "Current",
    stateTone: "success",
    dates: "from 1 Aug 2026",
    refunds: [100, 60, 25, 0],
  },
  {
    id: "v5",
    label: "v5 · draft",
    name: "Version 5",
    policyName: "Flexible 14-day",
    state: "draft",
    stateLabel: "Draft",
    stateTone: "warning",
    dates: "from 1 Nov 2026",
    refunds: [100, 50, 20, 0],
  },
];

const settingsPoliciesOutlets: SettingsPoliciesOutlet[] = [
  {
    id: "ter",
    name: "Isangano Terrace",
    operator: "In-house · Amahoro Hospitality Ltd",
    rule: "Up to RWF 200,000 per stay; guest signs the ticket",
    allowed: true,
    locked: false,
  },
  {
    id: "bar",
    name: "Lake Bar",
    operator: "In-house · Amahoro Hospitality Ltd",
    rule: "Room key check before posting",
    allowed: true,
    locked: false,
  },
  {
    id: "hall",
    name: "Kivu Hall banquets",
    operator: "Events · Amahoro Hospitality Ltd",
    rule: "Group master folio only",
    allowed: true,
    locked: false,
  },
  {
    id: "lodge",
    name: "Lodge dining",
    operator: "In-house · Ishyamba Forest Lodge",
    rule: "Up to RWF 150,000 per stay",
    allowed: true,
    locked: false,
  },
  {
    id: "ikw",
    name: "Ikawa Corner",
    operator: "Tenant · Ikawa Corner Ltd, TIN 108 221 457",
    rule: "Separate merchant. Needs a signed settlement agreement before its sales can reach your folios.",
    allowed: false,
    locked: true,
  },
];

const settingsPoliciesFixtures = {
  "owner.settingsPoliciesGroups": settingsPoliciesGroups,
  "owner.settingsPoliciesProperties": settingsPoliciesProperties,
  "owner.settingsPoliciesCards": settingsPoliciesCards,
  "owner.settingsPoliciesTiers": settingsPoliciesTiers,
  "owner.settingsPoliciesVersions": settingsPoliciesVersions,
  "owner.settingsPoliciesOutlets": settingsPoliciesOutlets,
} satisfies FixtureSet;
// ── Integrations ────────────────────────────────────────────────────────────────────────────────────────
/** How far a connection is: drives the summary chips ("3 working", "1 not connected"…). */
export type IntegrationsStage = "working" | "certification" | "testing" | "none";

/** One automated test of a connection and its result (ok, needs attention, blocked, or a note). */
export interface IntegrationsTest {
  name: string;
  result: string;
  kind: "ok" | "warn" | "block" | "info";
  detail: string;
}

/** A row of the connection's checklist, queue, mapping or client list. */
export interface IntegrationsListItem {
  label: string;
  sub: string;
  status: string;
  tone: Tone;
}

/**
 * A connection to an outside system, with what has actually been verified. `gate` is the readiness label shown
 * beside the status ("Production not verified"); `hasEnvironment` shows the Sandbox/Production switch.
 */
export interface IntegrationsConnection {
  id: string;
  name: string;
  provider: string;
  icon: IconName;
  tone: Tone;
  status: string;
  statusTone: Tone;
  stage: IntegrationsStage;
  facts: string[];
  gate: string;
  hasEnvironment: boolean;
  config: OwnerPair[];
  tests: IntegrationsTest[];
  listTitle: string;
  list: IntegrationsListItem[];
  action: string;
  actionNote: string;
  actionBlocked: boolean;
  canTest: boolean;
  lastRun: string;
  links: OwnerLink[];
}

const integrationsConnections: IntegrationsConnection[] = [
  {
    id: "ebm",
    name: "EBM / VSDC fiscal receipts",
    provider: "RRA fiscal route · per legal entity",
    icon: "FileCheck",
    tone: "warning",
    status: "Connected · certification pending",
    statusTone: "warning",
    stage: "certification",
    facts: [
      "Amahoro Hospitality Ltd: SDC-ISG-01 connected, last receipt signed 10:38",
      "Ishyamba device replaced; credential change waits for your approval",
      "Amahoro Residences Ltd: not set up, rent treatment not verified",
    ],
    gate: "Integration certification pending",
    hasEnvironment: false,
    config: [
      { label: "Route", value: "VSDC through your certified EBM provider" },
      { label: "Amahoro Hospitality Ltd", value: "TIN 102 345 678 · SDC-ISG-01 Isangano, SDC-ISH-01 Ishyamba" },
      { label: "Amahoro Residences Ltd", value: "TIN 102 345 990 · no device" },
      { label: "Ikawa Corner Ltd", value: "Own device, managed by Ikawa Corner, not here" },
      { label: "Credentials", value: "Encrypted; changed only with owner approval and step-up" },
      { label: "Retries", value: "Same request ID every time, so a receipt is never issued twice" },
    ],
    tests: [
      { name: "Test receipt, Isangano", result: "Signed", kind: "ok", detail: "Test mode · 9 Oct 11:20" },
      { name: "Credit note, Isangano", result: "Signed", kind: "ok", detail: "Test mode · 9 Oct 11:24" },
      { name: "Duplicate request, same ID", result: "Rejected", kind: "ok", detail: "Expected: no second receipt" },
      {
        name: "Test receipt, Ishyamba new device",
        result: "Pending",
        kind: "warn",
        detail: "Sent 11 Oct 15:10 · no answer from the device yet",
      },
    ],
    listTitle: "Live Queue",
    list: [
      {
        label: "3 receipts pending over 2 hours",
        sub: "Isangano · retrying with the same request ID",
        status: "Pending",
        tone: "warning",
      },
      { label: "Issued today", sub: "41 receipts · Isangano and Ishyamba", status: "Issued", tone: "success" },
      { label: "Rejected this week", sub: "None", status: "None", tone: "default" },
    ],
    action: "Review credential change",
    actionNote: "The Ishyamba change is in your Approvals.",
    actionBlocked: false,
    canTest: true,
    lastRun: "Last run today 10:30",
    links: [
      { label: "Fiscal queue", board: "FiscalReceipts" },
      { label: "Approvals", board: "Approvals" },
    ],
  },
  {
    id: "gtbank",
    name: "GT Bank adapter",
    provider: "Cards, mobile money and bank transfer · one payment port",
    icon: "Vault",
    tone: "accent",
    status: "Sandbox connected",
    statusTone: "accent",
    stage: "testing",
    facts: [
      "Health check passed 10:30 · sandbox",
      "VPN tunnel up in sandbox · production tunnel not provisioned",
      "Webhook signatures checked · 2 replays rejected this week",
    ],
    gate: "Production not verified",
    hasEnvironment: true,
    config: [
      { label: "Environment", value: "Sandbox · test money only" },
      { label: "Merchant IDs", value: "Amahoro Hospitality Ltd AHL-SBX-0042 · Amahoro Residences Ltd ARL-SBX-0043" },
      { label: "VPN tunnel", value: "Sandbox IPsec up · 42 ms · production not provisioned" },
      { label: "Callbacks", value: "Signature checked on every callback · replays older than 5 minutes rejected" },
      { label: "Unknown results", value: "Status polled from 60 seconds to 30 minutes, then sent to Finance" },
      { label: "Credentials", value: "In the vault · rotated 1 Oct · rotating needs step-up" },
    ],
    tests: [
      { name: "Health check", result: "Passed", kind: "ok", detail: "Today 10:30 · 42 ms through the sandbox tunnel" },
      { name: "MoMo collection RWF 100", result: "Verified", kind: "ok", detail: "Sandbox ref SBX-MP-20441 · 09:12" },
      { name: "Same callback sent twice", result: "Rejected", kind: "ok", detail: "Expected: one posting only" },
      {
        name: "Timeout during collection",
        result: "Unknown",
        kind: "warn",
        detail: "Resolved by status poll after 2 minutes; never shown as paid early",
      },
      {
        name: "Tunnel dropped mid-payment",
        result: "Pending",
        kind: "warn",
        detail: "Payments stayed Pending and recovered on reconnect",
      },
      { name: "Refund", result: "Not available", kind: "block", detail: "Refund API not confirmed by the bank" },
    ],
    listTitle: "Production Checklist",
    list: [
      { label: "Signed bank contract", sub: "Sent to GT Bank 18 Sep", status: "Waiting for bank", tone: "warning" },
      { label: "Production API documentation", sub: "Requested 18 Sep", status: "Waiting for bank", tone: "warning" },
      {
        label: "VPN peer address and keys",
        sub: "Network form returned 2 Oct",
        status: "Waiting for bank",
        tone: "warning",
      },
      {
        label: "Settlement accounts per legal entity",
        sub: "Hospitality provided · Residences pending",
        status: "1 of 2",
        tone: "default",
      },
      {
        label: "Production webhook secret",
        sub: "Issued with production access",
        status: "Not issued",
        tone: "default",
      },
    ],
    action: "Request production access",
    actionNote: "Available once the bank returns the contract, documentation and VPN details.",
    actionBlocked: true,
    canTest: true,
    lastRun: "Last run today 10:30",
    links: [{ label: "Payments", board: "Payments" }],
  },
  {
    id: "momo",
    name: "Mobile money networks",
    provider: "MTN MoMo and Airtel Money through the GT Bank adapter",
    icon: "Smartphone",
    tone: "accent",
    status: "Sandbox only",
    statusTone: "accent",
    stage: "testing",
    facts: [
      "MTN MoMo: 20 of 20 sandbox tests verified",
      "Airtel Money: 2 of 20 callbacks timed out, resolved by polling",
      "Every tender records network and provider reference",
    ],
    gate: "Production not verified",
    hasEnvironment: false,
    config: [
      { label: "Networks", value: "MTN MoMo, Airtel Money" },
      { label: "Route", value: "GT Bank adapter only; no direct network contracts" },
      { label: "On receipts", value: "Network, provider reference and time" },
      { label: "Reconciliation", value: "Matched to the bank report by provider reference" },
    ],
    tests: [
      { name: "MTN collection", result: "Verified", kind: "ok", detail: "20 of 20 · sandbox" },
      { name: "Airtel collection", result: "Verified", kind: "ok", detail: "18 at once, 2 after polling · sandbox" },
      { name: "Network shown on folio receipt", result: "Pass", kind: "ok", detail: "Checked on F-5534 test folio" },
    ],
    listTitle: "Production",
    list: [
      { label: "MTN MoMo", sub: "Depends on GT Bank production access", status: "Not verified", tone: "default" },
      { label: "Airtel Money", sub: "Depends on GT Bank production access", status: "Not verified", tone: "default" },
    ],
    action: "",
    actionNote: "",
    actionBlocked: false,
    canTest: true,
    lastRun: "Last run today 10:30",
    links: [{ label: "Payments", board: "Payments" }],
  },
  {
    id: "channels",
    name: "Channel manager and OTAs",
    provider: "Channel manager partner through the Open API",
    icon: "Globe",
    tone: "warning",
    status: "Testing · 5 of 6 room types mapped",
    statusTone: "warning",
    stage: "testing",
    facts: [
      "Family Suite not mapped, so it is not sold on OTAs",
      "Last availability push 10:30 · accepted",
      "14 bookings pulled this week · 2 duplicates ignored",
    ],
    gate: "Partner agreement pending",
    hasEnvironment: false,
    config: [
      { label: "Partner", value: "Channel manager, testing" },
      { label: "OTAs through it", value: "Booking.com, Expedia" },
      { label: "Sends", value: "Availability, rates and restrictions" },
      { label: "Receives", value: "New, changed and cancelled bookings, matched by channel reference" },
    ],
    tests: [
      { name: "Availability push", result: "Accepted", kind: "ok", detail: "Today 10:30" },
      {
        name: "Duplicate booking message",
        result: "Ignored",
        kind: "ok",
        detail: "Same channel reference already exists",
      },
      { name: "Family Suite mapping", result: "Missing", kind: "warn", detail: "Map it in Distribution" },
    ],
    listTitle: "Mapping",
    list: [
      { label: "Standard Queen, Twin, Deluxe Lake View", sub: "Isangano", status: "Mapped", tone: "success" },
      { label: "Forest Tent, Family Tent", sub: "Ishyamba", status: "Mapped", tone: "success" },
      { label: "Family Suite", sub: "Isangano", status: "Not mapped", tone: "warning" },
    ],
    action: "",
    actionNote: "",
    actionBlocked: false,
    canTest: false,
    lastRun: "Last run today 10:30",
    links: [{ label: "Distribution", board: "Channels" }],
  },
  {
    id: "accounting",
    name: "Accounting export",
    provider: "Journal file for your external accountant",
    icon: "Book",
    tone: "success",
    status: "Working",
    statusTone: "success",
    stage: "working",
    facts: [
      "Last batch EXP-2026-09 · September · 1,284 lines · balanced",
      "Exported 5 Oct by Didier Mugenzi",
      "Re-exporting makes a correction batch, never a duplicate",
    ],
    gate: "Account mapping awaiting Finance sign-off",
    hasEnvironment: false,
    config: [
      { label: "Format", value: "Journal CSV with your chart of accounts" },
      { label: "Mapping", value: "Departmental layout · awaiting Finance sign-off" },
      { label: "Frequency", value: "Monthly, after period close" },
      { label: "Batch IDs", value: "One per closed period" },
    ],
    tests: [
      { name: "September batch", result: "Balanced", kind: "ok", detail: "Debits equal credits · 1,284 lines" },
      { name: "October batch", result: "Not yet", kind: "warn", detail: "Period still open" },
    ],
    listTitle: "Batches",
    list: [
      { label: "EXP-2026-09", sub: "September · 5 Oct", status: "Exported", tone: "success" },
      { label: "EXP-2026-08", sub: "August · 4 Sep", status: "Exported", tone: "success" },
    ],
    action: "",
    actionNote: "",
    actionBlocked: false,
    canTest: false,
    lastRun: "Last run today 10:30",
    links: [{ label: "General ledger", board: "GeneralLedger" }],
  },
  {
    id: "locks",
    name: "Door locks and digital keys",
    provider: "No lock provider connected",
    icon: "Key",
    tone: "default",
    status: "Not connected",
    statusTone: "default",
    stage: "none",
    facts: [
      "No provider has been authorised for any property",
      "Physical key fallback is on: front desk issues key cards",
      "Key issue and return are logged at check-in and checkout",
    ],
    gate: "",
    hasEnvironment: false,
    config: [
      { label: "Provider", value: "None. Choose one your property has authorised" },
      { label: "Fallback", value: "Physical key cards from the front desk" },
      {
        label: "Digital keys",
        value: "Issued only through an authorised provider, time-limited to the stay, revoked on room move or checkout",
      },
    ],
    tests: [
      {
        name: "Provider connection",
        result: "Not started",
        kind: "info",
        detail: "Nothing to test until a provider is chosen",
      },
    ],
    listTitle: "Choose a Provider",
    list: [
      { label: "Authorised providers for Isangano", sub: "None on file", status: "None", tone: "default" },
      { label: "Authorised providers for Ishyamba", sub: "None on file", status: "None", tone: "default" },
    ],
    action: "Choose an authorised provider",
    actionNote: "You will need the provider’s written authorisation for each property.",
    actionBlocked: false,
    canTest: false,
    lastRun: "Last run today 10:30",
    links: [{ label: "Guest key screen", board: "GuestKey" }],
  },
  {
    id: "api",
    name: "Open API and webhooks",
    provider: "For partners and your own tools",
    icon: "AbbrApi",
    tone: "accent",
    status: "2 active clients",
    statusTone: "success",
    stage: "working",
    facts: [
      "Channel manager partner · last call 10:30",
      "Accountant export script · last call 5 Oct",
      "1 webhook retrying after a server error",
    ],
    gate: "",
    hasEnvironment: false,
    config: [
      { label: "Keys", value: "ij_live_••••7Q2 and ij_live_••••K8m · shown once at creation" },
      { label: "New key", value: "Needs step-up verification" },
      { label: "Webhook signing", value: "Each delivery signed; partner checks the signature" },
      { label: "Retries", value: "Up to 5 times with growing gaps, then sent to the log" },
    ],
    tests: [
      { name: "booking.created delivery", result: "200", kind: "ok", detail: "Today 10:31" },
      { name: "availability.changed delivery", result: "200", kind: "ok", detail: "Today 10:02" },
      { name: "booking.cancelled delivery", result: "500", kind: "warn", detail: "09:15 · retry 2 of 5 at 10:45" },
    ],
    listTitle: "API Clients",
    list: [
      { label: "Channel manager partner", sub: "ari.write, reservations.read", status: "Active", tone: "success" },
      { label: "Accountant export script", sub: "ledger.read", status: "Active", tone: "success" },
      { label: "Old website widget", sub: "reservations.write · revoked 1 Sep", status: "Revoked", tone: "default" },
    ],
    action: "Create API key",
    actionNote: "Scopes are limited to what you choose. Keys never grant staff or payroll data.",
    actionBlocked: false,
    canTest: false,
    lastRun: "Last run today 10:30",
    links: [{ label: "Audit log", board: "AuditLog" }],
  },
  {
    id: "sms",
    name: "SMS and WhatsApp",
    provider: "Guest and staff messages",
    icon: "Comment",
    tone: "accent",
    status: "SMS working · WhatsApp not connected",
    statusTone: "accent",
    stage: "working",
    facts: [
      "SMS delivered 98.2% in the last 7 days",
      "14 failed: numbers not in service",
      "Sender name AMAHORO approval needs verification",
    ],
    gate: "Sender name approval not verified",
    hasEnvironment: false,
    config: [
      { label: "SMS sender", value: "AMAHORO · approval status not confirmed" },
      { label: "Quiet hours", value: "21:00 to 07:00, urgent only" },
      { label: "WhatsApp", value: "Not connected" },
    ],
    tests: [
      { name: "Test SMS to +250 78• ••• 214", result: "Delivered", kind: "ok", detail: "Today 08:02" },
      { name: "WhatsApp", result: "Not connected", kind: "info", detail: "Connect a business account to test" },
    ],
    listTitle: "Channels",
    list: [
      { label: "SMS", sub: "1,912 sent this week", status: "Working", tone: "success" },
      {
        label: "WhatsApp Business",
        sub: "Needs an approved business account",
        status: "Not connected",
        tone: "default",
      },
    ],
    action: "Connect WhatsApp",
    actionNote: "",
    actionBlocked: false,
    canTest: false,
    lastRun: "Last run today 10:30",
    links: [{ label: "Messaging hours", board: "SettingsPolicies" }],
  },
];

const integrationsFixtures = {
  "owner.integrationsConnections": integrationsConnections,
} satisfies FixtureSet;
// ── AuditLog ────────────────────────────────────────────────────────────────────────────────────────────
/** Area an audit entry belongs to (the filter segment and the inspector chip). */
export type AuditLogAreaId = "money" | "fiscal" | "access" | "guest" | "settings" | "ops";

export interface AuditLogArea {
  id: AuditLogAreaId;
  /** Label in the "Filter by area" segment. */
  filterLabel: string;
  /** Label of the area chip in the entry inspector. */
  label: string;
  tone: Tone;
}

/** One field changed by an audited action. */
export interface AuditLogChange {
  field: string;
  before: string;
  after: string;
}

/** An immutable audit entry. The id is the entry number as a string ("48207"); `seq` is the same number. */
export interface AuditLogEntry {
  id: string;
  seq: number;
  /** Day column ("Today", "11 Oct") and the full date shown in the inspector. */
  day: string;
  date: string;
  time: string;
  actor: string;
  role: string;
  action: string;
  record: string;
  property: string;
  /** Reason given by the actor; empty when the action needs none. */
  reason: string;
  area: AuditLogAreaId;
  changes: AuditLogChange[];
  device: string;
  ip: string;
  requestId: string;
  stepUp: string;
  hash: string;
  previousHash: string;
  /** Where the audited record lives; `tab` opens a specific tab of that screen. */
  link: { label: string; board: BoardId; tab?: string };
}

/** How long one kind of record is kept (configured by the owner, not certified). */
export interface AuditLogRetentionRule {
  id: string;
  label: string;
  value: string;
  options: string[];
  note: string;
  /** Shows "Configured · unverified". */
  unverified: boolean;
}

/** A file format offered by the export dialog. */
export interface AuditLogExportFormat {
  id: "csv" | "json";
  title: string;
  description: string;
}

/** State of the hash chain and the counters around it. */
export interface AuditLogChain {
  id: string;
  entries: number;
  checkedAt: string;
  latestHash: string;
  weekEntries: number;
  nextExport: string;
}

const auditLogAreas: AuditLogArea[] = [
  { id: "money", filterLabel: "Money", label: "Money", tone: "warning" },
  { id: "fiscal", filterLabel: "Fiscal", label: "Fiscal", tone: "info" },
  { id: "access", filterLabel: "Access", label: "Team and access", tone: "accent" },
  { id: "guest", filterLabel: "Guest data", label: "Guest data", tone: "danger" },
  { id: "settings", filterLabel: "Settings", label: "Settings", tone: "default" },
  { id: "ops", filterLabel: "Operations", label: "Operations", tone: "success" },
];

const auditLogEntries: AuditLogEntry[] = [
  {
    id: "48213",
    seq: 48213,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "10:38:02",
    actor: "System",
    role: "Fiscal service",
    action: "Fiscal receipt issued",
    record: "EBM-ISG-2026-019107 · folio F-5531",
    property: "Isangano",
    reason: "",
    area: "fiscal",
    changes: [
      { field: "Status", before: "Pending", after: "Issued" },
      { field: "Device", before: "—", after: "SDC-ISG-01" },
      { field: "Signature", before: "—", after: "On file" },
    ],
    device: "Server job",
    ip: "—",
    requestId: "req_16c1c95be5",
    stepUp: "Not applicable",
    hash: "45c9…f014",
    previousHash: "a791…51dd",
    link: { label: "Open the receipt", board: "FiscalReceipts" },
  },
  {
    id: "48211",
    seq: 48211,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "10:31:44",
    actor: "Eric Habimana",
    role: "Front desk",
    action: "Guest checked in",
    record: "Stay ST-8841 · Sarah Kimani · room 204",
    property: "Isangano",
    reason: "",
    area: "ops",
    changes: [
      { field: "Stay status", before: "Reserved", after: "In house" },
      { field: "Room 204", before: "Inspected", after: "Occupied" },
    ],
    device: "Front desk PC 2 · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16c18b7de5",
    stepUp: "Not required",
    hash: "095a…b3a6",
    previousHash: "6b22…156f",
    link: { label: "Open the stay", board: "CheckIn" },
  },
  {
    id: "48210",
    seq: 48210,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "10:31:20",
    actor: "Eric Habimana",
    role: "Front desk",
    action: "ID document viewed",
    record: "Guest Sarah Kimani · national ID",
    property: "Isangano",
    reason: "Identity check at check-in",
    area: "guest",
    changes: [],
    device: "Front desk PC 2 · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16c16c8ee5",
    stepUp: "Not required",
    hash: "6b22…156f",
    previousHash: "cceb…7738",
    link: { label: "Open the access log", board: "Compliance", tab: "privacy" },
  },
  {
    id: "48207",
    seq: 48207,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "10:18:07",
    actor: "Aline Uwase",
    role: "General manager",
    action: "Dirty-room check-in override",
    record: "Stay ST-8839 · room 211",
    property: "Isangano",
    reason: "VIP early arrival; room checked by eye and linen changed. Full inspection after the guest settles.",
    area: "ops",
    changes: [
      { field: "Stay ST-8839", before: "Reserved", after: "In house" },
      { field: "Room 211 status", before: "Dirty", after: "Dirty, occupied" },
      { field: "Override", before: "None", after: "Dirty-room check-in" },
      { field: "Supervisor told", before: "—", after: "Beatrice Mukandori, 10:18" },
    ],
    device: "Office laptop · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16c10fc1e5",
    stepUp: "Not required by policy",
    hash: "907c…3aca",
    previousHash: "f245…9c93",
    link: { label: "Open the stay", board: "CheckIn" },
  },
  {
    id: "48199",
    seq: 48199,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "09:58:31",
    actor: "Aline Uwase",
    role: "General manager",
    action: "Team invite requested",
    record: "Grace Uwera as Finance (proposed role)",
    property: "All properties",
    reason: "We need someone on reconciliation before month-end.",
    area: "access",
    changes: [{ field: "Invite", before: "None", after: "Waiting for owner approval" }],
    device: "Office laptop · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16c01849e5",
    stepUp: "Not required",
    hash: "9ec0…4912",
    previousHash: "0089…aadb",
    link: { label: "Open in Approvals", board: "Approvals" },
  },
  {
    id: "48188",
    seq: 48188,
    day: "Today",
    date: "Mon 12 Oct 2026",
    time: "09:40:12",
    actor: "Aline Uwase",
    role: "General manager",
    action: "Guest list exported",
    record: "Rooming list, EAC Health Forum · 25 guests",
    property: "Isangano",
    reason: "Send to the organiser for room allocation.",
    area: "guest",
    changes: [],
    device: "Office laptop · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16bec404e5",
    stepUp: "Passed 09:39 · SMS code",
    hash: "d25e…7cb5",
    previousHash: "3427…de7e",
    link: { label: "Open the group block", board: "Groups" },
  },
  {
    id: "48120",
    seq: 48120,
    day: "11 Oct",
    date: "Sun 11 Oct 2026",
    time: "18:05:40",
    actor: "Eric Habimana",
    role: "Front desk",
    action: "Refund above limit requested",
    record: "BK-20418 · RWF 480,000",
    property: "Isangano",
    reason: "Group cancelled after the organiser’s flights moved.",
    area: "money",
    changes: [
      { field: "Refund decision", before: "None", after: "Waiting for owner" },
      { field: "Policy applied", before: "—", after: "Version 4, tier 2, 60%" },
    ],
    device: "Front desk PC 2 · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16b68c88e5",
    stepUp: "Not required",
    hash: "cba2…7619",
    previousHash: "2d6a…d7e2",
    link: { label: "Open in Approvals", board: "Approvals" },
  },
  {
    id: "48117",
    seq: 48117,
    day: "11 Oct",
    date: "Sun 11 Oct 2026",
    time: "16:20:09",
    actor: "Diane Ingabire",
    role: "HR officer",
    action: "Pay run submitted for confirmation",
    record: "PR-2026-10 · snapshot v3",
    property: "All properties",
    reason: "October run, three exceptions explained.",
    area: "money",
    changes: [
      { field: "Pay run state", before: "Draft", after: "Waiting for owner" },
      { field: "Snapshot", before: "v2", after: "v3, locked" },
    ],
    device: "HR laptop · Edge on Windows",
    ip: "41.186.77.•••",
    requestId: "req_16b62fbbe5",
    stepUp: "Passed 16:19 · authenticator app",
    hash: "f0fb…9b74",
    previousHash: "52c4…fd3d",
    link: { label: "Open the pay run", board: "PayRun" },
  },
  {
    id: "48096",
    seq: 48096,
    day: "11 Oct",
    date: "Sun 11 Oct 2026",
    time: "14:02:55",
    actor: "Didier Mugenzi",
    role: "Owner",
    action: "Cancellation policy draft saved",
    record: "Flexible 14-day · version 5",
    property: "Isangano",
    reason: "Align with the lodge terms.",
    area: "settings",
    changes: [
      { field: "Tier 2 refund", before: "60%", after: "50%" },
      { field: "Tier 3 refund", before: "25%", after: "20%" },
      { field: "Effective", before: "—", after: "1 Nov 2026" },
    ],
    device: "iPhone · Injishi app",
    ip: "102.22.140.•••",
    requestId: "req_16b3a620e5",
    stepUp: "Not required",
    hash: "f66e…a0f1",
    previousHash: "5837…02ba",
    link: { label: "Open the policy", board: "SettingsPolicies" },
  },
  {
    id: "48071",
    seq: 48071,
    day: "11 Oct",
    date: "Sun 11 Oct 2026",
    time: "11:47:03",
    actor: "Kevin Mugisha",
    role: "Injishi support",
    action: "Support session started, view only",
    record: "Ticket SUP-4117",
    property: "Isangano",
    reason: "Fiscal queue question. Approved by Didier Mugenzi until 13 Oct 18:00.",
    area: "access",
    changes: [{ field: "Support access", before: "None", after: "View only until 13 Oct 18:00" }],
    device: "Injishi admin console",
    ip: "Injishi network",
    requestId: "req_16b0a0c9e5",
    stepUp: "Passed · Injishi staff two-step",
    hash: "8303…2d92",
    previousHash: "e4cc…8f5b",
    link: { label: "Open the access log", board: "Compliance", tab: "privacy" },
  },
  {
    id: "48044",
    seq: 48044,
    day: "11 Oct",
    date: "Sun 11 Oct 2026",
    time: "08:41:26",
    actor: "Aline Uwase",
    role: "General manager",
    action: "Bank match, first approval",
    record: "INV-26-0412 to GT Bank line of 10 Oct",
    property: "Amahoro Hospitality Ltd",
    reason: "Confirmed with Umurage finance by phone.",
    area: "money",
    changes: [{ field: "Approvals", before: "0 of 2", after: "1 of 2" }],
    device: "Office laptop · Chrome on Windows",
    ip: "197.243.18.•••",
    requestId: "req_16ad5d94e5",
    stepUp: "Passed 08:40 · SMS code",
    hash: "d32a…7dc5",
    previousHash: "34f2…df8e",
    link: { label: "Open reconciliation", board: "Reconciliation" },
  },
];

const auditLogRetention: AuditLogRetentionRule[] = [
  {
    id: "audit",
    label: "Audit log entries",
    value: "7 years",
    options: ["5 years", "7 years", "10 years"],
    note: "Never shortened below the longest record it describes.",
    unverified: true,
  },
  {
    id: "financial",
    label: "Financial and fiscal records",
    value: "7 years",
    options: ["5 years", "7 years", "10 years"],
    note: "Folios, receipts, ledger, invoices.",
    unverified: true,
  },
  {
    id: "guest-id",
    label: "Guest ID details",
    value: "5 years after checkout",
    options: ["1 year after checkout", "3 years after checkout", "5 years after checkout"],
    note: "Document type, number and expiry.",
    unverified: true,
  },
  {
    id: "access-log",
    label: "Personal-data access log",
    value: "3 years",
    options: ["1 year", "3 years", "5 years"],
    note: "Who looked at guest or staff data, and why.",
    unverified: false,
  },
  {
    id: "staff",
    label: "Staff files and payroll",
    value: "7 years after leaving",
    options: ["5 years after leaving", "7 years after leaving"],
    note: "Contracts, payslips, pay runs.",
    unverified: true,
  },
  {
    id: "support",
    label: "Injishi support session records",
    value: "1 year",
    options: ["1 year", "3 years"],
    note: "What support looked at, kept for your review.",
    unverified: false,
  },
];

const auditLogExportFormats: AuditLogExportFormat[] = [
  { id: "csv", title: "CSV spreadsheet", description: "For reading and filtering" },
  { id: "json", title: "Signed file with hash chain", description: "Lets an auditor confirm nothing was removed" },
];

const auditLogChain: AuditLogChain[] = [
  {
    id: "chain",
    entries: 48213,
    checkedAt: "today 10:00",
    latestHash: "45c9…f014",
    weekEntries: 1186,
    nextExport: "EXP-AUD-0042",
  },
];

const auditLogFixtures = {
  "owner.auditLogAreas": auditLogAreas,
  "owner.auditLogEntries": auditLogEntries,
  "owner.auditLogRetention": auditLogRetention,
  "owner.auditLogExportFormats": auditLogExportFormats,
  "owner.auditLogChain": auditLogChain,
} satisfies FixtureSet;
export const fixtures = {
  ...approvalsFixtures,
  ...reportsFixtures,
  ...complianceFixtures,
  ...teamRolesFixtures,
  ...planBillingFixtures,
  ...settingsBusinessFixtures,
  ...settingsPoliciesFixtures,
  ...integrationsFixtures,
  ...auditLogFixtures,
} satisfies FixtureSet;
