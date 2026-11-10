import type { BoardId, FixtureSet, IconName, PersonaId } from "../types.ts";

/**
 * Embedded-database fixtures for the "shared" area — the screens every persona reaches: accept an invitation
 * (InviteAccept), business registration (Register), owner onboarding (Onboarding), personal account (Account),
 * global search (GlobalSearch), the notification inbox (Notifications), high-stakes states (StatesGallery) and
 * access denied / step-up (AccessDenied).
 * Collection names are "shared.<thing>"; every document has a stable string `id`.
 * Values are lifted verbatim from the artifact boards (node tools/artifact/extract.mjs <Board>).
 */

/** Semantic tone of a chip, dot or icon (mapped to HeroUI colours by `toneColor`). */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/** Status of a timeline marker. */
export type MarkerStatus = "current" | "default" | "success" | "warning" | "danger" | "muted";

/** One event of a short process timeline (fees, claims, what happens next). */
export interface ProcessStep {
  id: string;
  status: MarkerStatus;
  icon?: IconName;
  title: string;
  detail: string;
}

// ── InviteAccept ────────────────────────────────────────────────────────────────────────────────────────

export type InviteStatus = "valid" | "expired" | "revoked" | "accepted";

/** A role invitation sent by an owner to one email address. */
export interface Invitation {
  id: string;
  inviter: string;
  inviterFirstName: string;
  inviterInitials: string;
  inviterRole: string;
  group: string;
  invitee: string;
  inviteeFirstName: string;
  email: string;
  role: string;
  roleProposed: boolean;
  entity: string;
  tin: string;
  property: string;
  propertyArea: string;
  notIncluded: string;
  message: string;
  /** When the invitee accepted and confirmed the email (valid → joined). */
  joinedAt: string;
  /** When a new invitation was requested (expired → request sent). */
  requestSentAt: string;
  /** Workspace the role opens after joining. */
  workspace: BoardId;
}

/** How an invitation looks in each of its states (artifact: the V map). */
export interface InvitationState {
  id: InviteStatus;
  sentLine: string;
  chip: string;
  chipTone: Tone;
  expiryLabel: string;
  expiry: string;
  banner: { tone: Tone; icon: IconName; title: string; body: string } | null;
}

/** What a role can and can't do, shown before anyone accepts it. */
export interface RoleScope {
  id: string;
  role: string;
  where: string;
  can: string[];
  cant: string[];
}

const invitations: Invitation[] = [
  {
    id: "INV-grace-finance",
    inviter: "Didier Mugenzi",
    inviterFirstName: "Didier",
    inviterInitials: "DM",
    inviterRole: "Owner",
    group: "Amahoro Hospitality Group",
    invitee: "Grace Uwera",
    inviteeFirstName: "Grace",
    email: "grace.uwera@gmail.com",
    role: "Finance",
    roleProposed: true,
    entity: "Amahoro Hospitality Ltd",
    tin: "102 345 678",
    property: "Isangano Lakeside Hotel",
    propertyArea: "Rubavu",
    notIncluded:
      "Ishyamba Forest Lodge, Kacyiru Court Residences (Amahoro Residences Ltd) and Ikawa Corner (separate merchant)",
    message:
      "Grace, this gives you what you need to reconcile payments and fiscal receipts for Isangano. Aline will walk you through the night audit on Tuesday.",
    joinedAt: "12 Oct 2026, 10:24",
    requestSentAt: "10:31",
    workspace: "FinanceHome",
  },
];

const invitationStates: InvitationState[] = [
  {
    id: "valid",
    sentLine: "sent Sat 10 Oct, 16:20",
    chip: "Expires in 5 days",
    chipTone: "default",
    expiryLabel: "Expires",
    expiry: "Sat 17 Oct 2026, 16:20 CAT",
    banner: null,
  },
  {
    id: "expired",
    sentLine: "sent Fri 2 Oct, 09:05",
    chip: "Expired",
    chipTone: "danger",
    expiryLabel: "Expired",
    expiry: "Fri 9 Oct 2026, 09:05 CAT · 3 days ago",
    banner: {
      tone: "warning",
      icon: "Clock",
      title: "This invitation has expired",
      body: "Invitations last 7 days. Ask Didier for a new one; he can resend it from Team & roles.",
    },
  },
  {
    id: "revoked",
    sentLine: "sent Sat 10 Oct, 16:20",
    chip: "Withdrawn",
    chipTone: "default",
    expiryLabel: "Withdrawn",
    expiry: "Sun 11 Oct 2026, 08:05 by Didier Mugenzi",
    banner: {
      tone: "default",
      icon: "Ban",
      title: "Didier Mugenzi withdrew this invitation",
      body: "This link no longer works and no access was created. If you think this is a mistake, contact Didier directly.",
    },
  },
  {
    id: "accepted",
    sentLine: "sent Sat 10 Oct, 16:20",
    chip: "Accepted",
    chipTone: "success",
    expiryLabel: "Accepted",
    expiry: "Sun 11 Oct 2026, 09:14 · email confirmed",
    banner: {
      tone: "success",
      icon: "CircleCheck",
      title: "You’ve already accepted this invitation",
      body: "Sign in with grace.uwera@gmail.com to open your Finance workspace. This link can’t be used again.",
    },
  },
];

const roleScopes: RoleScope[] = [
  {
    id: "finance",
    role: "Finance",
    where: "At Isangano Lakeside Hotel only",
    can: [
      "See payments, folios and reconciliation exceptions",
      "Post folio charges, take payments and close folios",
      "Manage held fiscal receipts and issue refund receipts",
      "Decide refunds up to the limit the owner sets",
      "Close cashier shifts and run financial reports",
      "Look up reservations and guests, read only",
      "View payment and fiscal integration status",
    ],
    cant: [
      "Change rooms, rates or listings",
      "Read staff files, attendance or payroll",
      "Message or answer guests",
      "Invite, change or remove team members",
      "See Ishyamba Forest Lodge, Kacyiru Court Residences or Ikawa Corner",
    ],
  },
];

// ── Register ────────────────────────────────────────────────────────────────────────────────────────────

export type TinCheck = "matched" | "verifying" | "not_verified";

/** A business type the applicant can register (decides workspace, RDB classes and fee). */
export interface BusinessType {
  id: string;
  label: string;
  icon: IconName;
  desc: string;
  note: string;
}

/** One step of the registration wizard. `desc` is null when it follows the application state. */
export interface RegistrationStep {
  id: "type" | "tin" | "class" | "location" | "documents" | "fee" | "channel" | "ownership" | "review";
  title: string;
  lead: string;
  desc: string | null;
}

export type UploadStatus = "complete" | "failed" | "missing" | "uploading";

/** A KYB document slot with its upload state. */
export interface RegistrationDocument {
  id: string;
  doc: string;
  icon: IconName;
  status: UploadStatus;
  /** Meta line in the current state. */
  meta: string;
  /** Meta line once the document is uploaded again. */
  uploadedMeta: string;
  required: boolean;
  /** Upload progress (0–100) while uploading. */
  progress: number | null;
}

/** How the registration reached Injishi. */
export interface AcquisitionChannel {
  id: string;
  label: string;
  desc: string;
}

/** A form field of the registration (selects list their options; a null value follows the business type). */
export interface RegistrationField {
  id: string;
  label: string;
  help: string;
  kind: "select" | "input";
  value: string | null;
  options: string[];
  optional: boolean;
}

/** The application being registered (REG-26-0418). */
export interface RegistrationApplication {
  id: string;
  started: string;
  business: string;
  entity: string;
  tin: string;
  legalForm: string;
  legalForms: string[];
  vatRegistered: boolean;
  location: string;
  locationShort: string;
  street: string;
  pin: string;
  registry: { name: string; status: string; checkedAt: string; ref: string };
  agent: { code: string; team: string };
  owner: { name: string; verifiedOn: string; phone: string; phoneMasked: string; email: string };
  savedAt: string;
  submittedAt: string;
  claimValidUntil: string;
  licence: string;
  eacGrade: string;
  fee: string;
  feeSchedule: string;
  catalogue: string;
  reviewDays: number;
}

const businessTypes: BusinessType[] = [
  {
    id: "hotel",
    label: "Hotel",
    icon: "FolderHouse",
    desc: "Rooms, front desk, outlets and events",
    note: "Hotels get rooms, front desk, outlets and events. Your RDB class options and registration fee follow from this choice.",
  },
  {
    id: "motel",
    label: "Motel",
    icon: "Car",
    desc: "Roadside rooms with parking",
    note: "Motels get rooms and a simple front desk. RDB class options and the fee follow from this choice.",
  },
  {
    id: "camp",
    label: "Tented camp",
    icon: "Compass",
    desc: "Tents or semi-permanent units",
    note: "Tented camps manage tents as rooms, with seasons and park access notes.",
  },
  {
    id: "guesthouse",
    label: "Guest house",
    icon: "House",
    desc: "A few rooms, often family-run",
    note: "Guest houses get a lighter desk with the same payment and receipt rules.",
  },
  {
    id: "apartment",
    label: "Accommodation apartment",
    icon: "LayoutCellsLarge",
    desc: "Serviced apartments by the night",
    note: "Apartments are let by the night. For monthly leases choose Residence landlord.",
  },
  {
    id: "lodge",
    label: "Lodge",
    icon: "Flame",
    desc: "Rooms or cottages in nature",
    note: "Lodges get rooms, meal plans and activity packages.",
  },
  {
    id: "villa",
    label: "Villa",
    icon: "CrownDiamond",
    desc: "A whole house for one party",
    note: "Villas are booked whole, with a single folio per stay.",
  },
  {
    id: "residence",
    label: "Residence landlord",
    icon: "Key",
    desc: "Monthly leases, not nightly stays",
    note: "Residence landlords work in Residence mode: leases, deposits and rent, never nightly stays.",
  },
  {
    id: "outlet",
    label: "Standalone outlet",
    icon: "Cup",
    desc: "Restaurant, bar or café, no rooms",
    note: "Standalone outlets get POS, menus and stock without rooms, under their own TIN.",
  },
];

const registrationSteps: RegistrationStep[] = [
  {
    id: "type",
    title: "Business type",
    lead: "This decides your workspace, the RDB classes you can pick and your registration fee.",
    desc: null,
  },
  {
    id: "tin",
    title: "Legal entity & TIN",
    lead: "The legal entity that owns the business and its tax number. This is the TIN gate.",
    desc: null,
  },
  {
    id: "class",
    title: "Classification & licences",
    lead: "How the business is classified and licensed. A reviewer checks these against your documents.",
    desc: "RDB class, licence, EAC grade",
  },
  {
    id: "location",
    title: "Location",
    lead: "Where guests will find you, using Rwanda’s administrative units.",
    desc: "Rubavu · Gisenyi",
  },
  {
    id: "documents",
    title: "Documents",
    lead: "Upload clear copies. Reviewers compare them with what you entered.",
    desc: null,
  },
  {
    id: "fee",
    title: "Registration fee",
    lead: "What registration costs by business type, and when it is charged.",
    desc: "Pending pricing approval",
  },
  { id: "channel", title: "How you found us", lead: "How this registration reached Injishi.", desc: null },
  {
    id: "ownership",
    title: "Ownership & claim",
    lead: "Who is filling this in, and who will own the business on Injishi.",
    desc: null,
  },
  {
    id: "review",
    title: "Review & submit",
    lead: "Check everything, then send it to Injishi staff for review.",
    desc: null,
  },
];

const registrationDocuments: RegistrationDocument[] = [
  {
    id: "rdb",
    doc: "RDB certificate of incorporation",
    icon: "FileText",
    status: "complete",
    meta: "rdb-certificate.pdf · 412 KB · uploaded 8 Oct",
    uploadedMeta: "rdb-certificate.pdf · 412 KB · uploaded 8 Oct",
    required: true,
    progress: null,
  },
  {
    id: "tincert",
    doc: "RRA TIN certificate",
    icon: "FileText",
    status: "complete",
    meta: "rra-tin-certificate.pdf · 380 KB · uploaded 8 Oct",
    uploadedMeta: "rra-tin-certificate.pdf · 380 KB · uploaded 8 Oct",
    required: true,
    progress: null,
  },
  {
    id: "licence",
    doc: "Tourism operating licence",
    icon: "FileCheck",
    status: "failed",
    meta: "tourism-licence-scan.pdf · 18.4 MB · larger than 10 MB",
    uploadedMeta: "tourism-licence.pdf · 3.2 MB · uploaded just now",
    required: true,
    progress: null,
  },
  {
    id: "id",
    doc: "Owner or director national ID",
    icon: "Passport",
    status: "missing",
    meta: "Required · front and back",
    uploadedMeta: "national-id-didier.jpg · 1.4 MB · uploaded just now",
    required: true,
    progress: null,
  },
  {
    id: "eac",
    doc: "EAC grading certificate",
    icon: "Medal",
    status: "uploading",
    meta: "eac-grading-2025.pdf · 2.1 MB · 64%",
    uploadedMeta: "eac-grading-2025.pdf · 2.1 MB · uploaded just now",
    required: false,
    progress: 64,
  },
];

const acquisitionChannels: AcquisitionChannel[] = [
  { id: "agent", label: "An Injishi field agent", desc: "Enter the code on their badge" },
  { id: "web", label: "Injishi website or search", desc: "Found us online" },
  { id: "referral", label: "Another business recommended us", desc: "Referral code optional" },
  { id: "event", label: "An RDB, PSF or Chamber event", desc: "Training day, expo or meeting" },
  { id: "social", label: "Social media", desc: "Instagram, Facebook, X or similar" },
  { id: "radio", label: "Radio or TV", desc: "An advert or interview" },
  { id: "other", label: "Something else", desc: "Tell us in a few words" },
];

const registrationClassFields: RegistrationField[] = [
  {
    id: "cl-group",
    label: "RDB entity group",
    help: "From your RDB registration",
    kind: "select",
    value: "Accommodation establishments",
    options: ["Accommodation establishments"],
    optional: false,
  },
  {
    id: "cl-class",
    label: "Accommodation class",
    help: "Options follow your business type",
    kind: "select",
    value: null,
    options: [],
    optional: false,
  },
  {
    id: "cl-lic",
    label: "Tourism operating licence number",
    help: "As printed on the licence",
    kind: "input",
    value: "TL-2025-04417",
    options: [],
    optional: false,
  },
  {
    id: "cl-exp",
    label: "Licence valid until",
    help: "We remind you 60 days before it expires",
    kind: "input",
    value: "30 Jun 2027",
    options: [],
    optional: false,
  },
  {
    id: "cl-eac",
    label: "EAC grade",
    help: "Only if you hold an EAC grading certificate",
    kind: "select",
    value: "3 stars",
    options: ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"],
    optional: true,
  },
];

const registrationGeoFields: RegistrationField[] = [
  {
    id: "geo-p",
    label: "Province",
    help: "Kigali City and 4 provinces",
    kind: "select",
    value: "Western Province",
    options: ["Kigali City", "Eastern Province", "Northern Province", "Southern Province", "Western Province"],
    optional: false,
  },
  {
    id: "geo-d",
    label: "District",
    help: "7 districts in Western",
    kind: "select",
    value: "Rubavu",
    options: ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"],
    optional: false,
  },
  {
    id: "geo-s",
    label: "Sector",
    help: "Sectors in Rubavu",
    kind: "select",
    value: "Gisenyi",
    options: [
      "Bugeshi",
      "Busasamana",
      "Cyanzarwe",
      "Gisenyi",
      "Kanama",
      "Kanzenze",
      "Mudende",
      "Nyakiliba",
      "Nyamyumba",
      "Nyundo",
      "Rubavu",
      "Rugerero",
    ],
    optional: false,
  },
  {
    id: "geo-c",
    label: "Cell",
    help: "Cells in Gisenyi",
    kind: "select",
    value: "Nengo",
    options: ["Nengo"],
    optional: false,
  },
  {
    id: "geo-v",
    label: "Village",
    help: "Villages in Nengo",
    kind: "select",
    value: "Ubumwe",
    options: ["Ubumwe"],
    optional: false,
  },
];

const registrationApplications: RegistrationApplication[] = [
  {
    id: "REG-26-0418",
    started: "8 Oct 2026",
    business: "Isangano Lakeside Hotel",
    entity: "Amahoro Hospitality Ltd",
    tin: "102 345 678",
    legalForm: "Private limited company (Ltd)",
    legalForms: [
      "Private limited company (Ltd)",
      "Public limited company (Plc)",
      "Sole proprietorship",
      "Partnership",
      "Cooperative",
    ],
    vatRegistered: true,
    location: "Rubavu · Western Province",
    locationShort: "Ubumwe, Nengo, Gisenyi, Rubavu, Western Province",
    street: "Lakeshore road, near Gisenyi public beach",
    pin: "−1.7021, 29.2574",
    registry: { name: "Amahoro Hospitality Ltd", status: "Active", checkedAt: "12 Oct 2026, 10:42", ref: "TC-58213" },
    agent: { code: "FA-RBV-021", team: "Western Province field team" },
    owner: {
      name: "Didier Mugenzi",
      verifiedOn: "3 Mar 2026",
      phone: "+250 788 123 456",
      phoneMasked: "+250 788 ••• 456",
      email: "didier@amahoro.rw",
    },
    savedAt: "10:41",
    submittedAt: "12 Oct 2026, 10:52",
    claimValidUntil: "19 Oct 2026",
    licence: "TL-2025-04417",
    eacGrade: "3 stars",
    fee: "[FEE PENDING PRICING APPROVAL]",
    feeSchedule: "Fee schedule by business type · draft version 0.3",
    catalogue: "2026.2",
    reviewDays: 2,
  },
];

const registrationFeeSchedule: ProcessStep[] = [
  {
    id: "review",
    status: "current",
    icon: "Pencil",
    title: "While you register and during review",
    detail: "Nothing is charged.",
  },
  {
    id: "approval",
    status: "default",
    icon: "Receipt",
    title: "After Injishi approves the registration",
    detail: "The one-time registration fee for your business type.",
  },
  {
    id: "stub",
    status: "default",
    icon: "Calendar",
    title: "Activation stub month",
    detail: "From activation day to the end of that month, pro-rated.",
  },
  {
    id: "monthly",
    status: "default",
    icon: "ArrowsRotateRight",
    title: "Then every month",
    detail: "The subscription bills on the 1st. Failed charges are retried.",
  },
];

const registrationClaimSteps: ProcessStep[] = [
  { id: "draft", status: "current", title: "You prepare the draft", detail: "Attributed to agent code FA-RBV-021" },
  { id: "link", status: "default", title: "Owner gets a claim link", detail: "By SMS and email · valid for 7 days" },
  {
    id: "verify",
    status: "default",
    title: "Owner signs in and verifies identity",
    detail: "Then checks and corrects every detail",
  },
  {
    id: "submit",
    status: "default",
    title: "Owner submits for Injishi review",
    detail: "Only the owner can submit and pay",
  },
  {
    id: "inactive",
    status: "default",
    title: "Business stays inactive until approved",
    detail: "A reviewer decides, never the paperwork alone",
  },
];

const registrationAfterSteps: ProcessStep[] = [
  { id: "kyb", status: "default", title: "Injishi staff review (KYB)", detail: "Usually 2 business days" },
  { id: "fee", status: "default", title: "Registration fee", detail: "Charged only after approval" },
  { id: "activation", status: "default", title: "Activation", detail: "Stub month starts, then billing on the 1st" },
  { id: "listing", status: "default", title: "Onboarding and listing", detail: "Publish once the business is active" },
];

// ── Onboarding ──────────────────────────────────────────────────────────────────────────────────────────

export type SetupStatus = "done" | "review" | "progress" | "todo" | "blocked" | "external";

/** One setup step on the way to go-live, with who acts and what it unblocks. */
export interface SetupItem {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
  status: SetupStatus;
  /** Outlined gate pill instead of a status chip (external dependencies). */
  gate: { label: string; icon: IconName } | null;
  who: string;
  why: string;
  waitingOn: string[];
  unblocks: string[];
  /** Pricing note awaiting sign-off. */
  note: string | null;
  cta: string;
  board: BoardId;
}

/** A gate that blocks (or doesn't block) go-live. */
export interface GoLiveGate {
  id: string;
  status: MarkerStatus;
  icon: IconName;
  title: string;
  chip: string;
  chipTone: Tone;
  detail: string;
}

const setupItems: SetupItem[] = [
  {
    id: "kyc",
    icon: "Fingerprint",
    title: "Owner identity verified",
    desc: "National ID checked 3 Mar 2026 · needed once for the Owner role",
    status: "done",
    gate: null,
    who: "You",
    why: "Elevated roles verify identity once, anchored on a government document. Guests never need to.",
    waitingOn: [],
    unblocks: [],
    note: null,
    cta: "View in account",
    board: "Account",
  },
  {
    id: "kyb",
    icon: "ShieldCheck",
    title: "Business verification",
    desc: "REG-26-0418 submitted 10 Oct · Injishi staff reviewing",
    status: "review",
    gate: null,
    who: "Injishi staff",
    why: "A reviewer checks your TIN, tourism licence and documents. Nothing goes live on unverified paperwork. They will message you if anything is missing; usually within 2 business days.",
    waitingOn: [],
    unblocks: ["Listing publish", "Subscription activation"],
    note: null,
    cta: "View application",
    board: "Register",
  },
  {
    id: "profile",
    icon: "FolderHouse",
    title: "Property profile",
    desc: "Address, photos, check-in 14:00 and check-out 11:00",
    status: "done",
    gate: null,
    who: "You",
    why: "Shown on your listing, in booking confirmations and in guest messages.",
    waitingOn: [],
    unblocks: [],
    note: null,
    cta: "Edit profile",
    board: "SettingsBusiness",
  },
  {
    id: "rooms",
    icon: "LayoutCells",
    title: "Room types and rooms",
    desc: "4 room types · 42 rooms numbered 101 to 406",
    status: "done",
    gate: null,
    who: "You",
    why: "Rooms drive availability, housekeeping tasks and the room rack.",
    waitingOn: [],
    unblocks: [],
    note: null,
    cta: "Edit rooms",
    board: "RatesInventory",
  },
  {
    id: "rates",
    icon: "Tag",
    title: "Rate plans",
    desc: "2 of 4 room types priced · Twin and Family Suite have no rate yet",
    status: "progress",
    gate: null,
    who: "You or your manager",
    why: "Guests can only book room types that have a rate. Standard Queen RWF 85,000 and Deluxe Lake View RWF 140,000 are set.",
    waitingOn: [],
    unblocks: ["Listing publish"],
    note: null,
    cta: "Finish rate plans",
    board: "RatesInventory",
  },
  {
    id: "policies",
    icon: "FileText",
    title: "Policies",
    desc: "Cancellation, deposit, children and pets",
    status: "todo",
    gate: null,
    who: "You",
    why: "Shown to guests before they pay and used to work out refunds. Without them the listing can’t publish.",
    waitingOn: [],
    unblocks: ["Listing publish"],
    note: null,
    cta: "Set policies",
    board: "SettingsPolicies",
  },
  {
    id: "team",
    icon: "PersonsLock",
    title: "Team invitations",
    desc: "3 accepted · Grace Uwera (Finance) pending until 17 Oct",
    status: "progress",
    gate: null,
    who: "You",
    why: "People get access only by invitation, never from their employee record. Each role sees only its own work.",
    waitingOn: [],
    unblocks: [],
    note: null,
    cta: "Manage team",
    board: "TeamRoles",
  },
  {
    id: "ebm",
    icon: "FileCheck",
    title: "EBM / VSDC connection",
    desc: "Waiting for RRA-issued credentials · requested 6 Oct",
    status: "external",
    gate: { label: "External gate", icon: "Lock" },
    who: "RRA, then you",
    why: "Fiscal receipts are signed by the VSDC. Until it is connected, receipts queue as Pending and none show as Issued.",
    waitingOn: [],
    unblocks: ["Fiscal receipts at checkout"],
    note: null,
    cta: "Open integrations",
    board: "Integrations",
  },
  {
    id: "bank",
    icon: "Vault",
    title: "GT Bank payments",
    desc: "Sandbox connected · production not verified",
    status: "external",
    gate: { label: "Needs verification", icon: "ShieldExclamation" },
    who: "GT Bank",
    why: "Cash works now. MTN MoMo, Airtel Money, card and bank transfer stay in sandbox until GT Bank confirms production access.",
    waitingOn: [],
    unblocks: ["Mobile money and card payments"],
    note: null,
    cta: "Open integrations",
    board: "Integrations",
  },
  {
    id: "listing",
    icon: "Picture",
    title: "Publish your listing",
    desc: "Draft ready · publishing opens when the business is active",
    status: "blocked",
    gate: null,
    who: "You, after verification",
    why: "Only active businesses can publish to the Injishi marketplace. Your draft is saved, so you can keep editing photos and descriptions.",
    waitingOn: ["Business verification", "Rate plans", "Policies"],
    unblocks: ["Marketplace bookings"],
    note: null,
    cta: "Open listing draft",
    board: "Listing",
  },
  {
    id: "plan",
    icon: "CreditCard",
    title: "Subscription activation",
    desc: "Starts at activation · stub month, then billing on the 1st",
    status: "blocked",
    gate: null,
    who: "Starts automatically",
    why: "Your subscription starts the day the business activates: a pro-rated stub month to the end of that month, then billing on the 1st of each month.",
    waitingOn: ["Business verification"],
    unblocks: [],
    note: "Plan price: [PRICE PENDING PRICING APPROVAL]",
    cta: "View plan & billing",
    board: "PlanBilling",
  },
];

const goLiveGates: GoLiveGate[] = [
  {
    id: "kyb",
    status: "current",
    icon: "ShieldCheck",
    title: "Business verification",
    chip: "Injishi staff",
    chipTone: "info",
    detail: "In review since 10 Oct. Blocks listing publish and subscription activation.",
  },
  {
    id: "ebm",
    status: "warning",
    icon: "Lock",
    title: "EBM / VSDC connection",
    chip: "External · RRA",
    chipTone: "default",
    detail: "Needed before you issue fiscal receipts to guests.",
  },
  {
    id: "listing",
    status: "warning",
    icon: "Picture",
    title: "Listing publish",
    chip: "Blocked",
    chipTone: "warning",
    detail: "Waits on verification, rate plans and policies.",
  },
  {
    id: "bank",
    status: "default",
    icon: "Vault",
    title: "GT Bank production",
    chip: "Doesn’t block",
    chipTone: "default",
    detail: "Cash works now; other payment rails stay in sandbox until GT Bank confirms.",
  },
];

// ── Account ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Identity facts of a personal account. Seeded for the owner (the artifact's account); people without a
 * seeded account get one derived from their persona.
 */
export interface AccountIdentity {
  id: PersonaId;
  legalName: string;
  displayName: string;
  email: string;
  phone: string;
  phoneMasked: string;
  google: string;
  initials: string;
  /** Role named in role-bound copy ("Required for {role}"). */
  role: string;
  created: string;
  accountId: string;
  /** Elevated role that first required identity verification. */
  verifiedFor: string;
  verifiedOn: string;
  newsConsentOn: string;
}

/** Keys of AccountIdentity a profile field or sign-in method shows. */
export type IdentityKey = "legalName" | "displayName" | "email" | "phone" | "phoneMasked" | "google";

export interface ProfileField {
  id: string;
  label: string;
  /** Identity value shown in the field (null = `value`). */
  bind: IdentityKey | null;
  value: string;
  help: string;
  verified: boolean;
  locked: boolean;
}

/** A way to sign in or to recover the account. */
export interface SignInMethod {
  id: string;
  group: "signin" | "recovery";
  icon: IconName;
  title: string;
  /** Identity value shown as the description (null = `desc`; "{role}" in `desc` and `chip` is the account's role). */
  bind: IdentityKey | null;
  desc: string;
  chip: string;
  chipTone: Tone;
  action: string | null;
}

export interface AccountSession {
  id: string;
  icon: IconName;
  device: string;
  place: string;
  since: string;
  last: string;
  workspace: string;
  current: boolean;
  newLocation: boolean;
}

export interface KycCheck {
  id: string;
  title: string;
  detail: string;
  /** The registry lookup that still needs verification. */
  registryGate: boolean;
}

export interface KycState {
  id: string;
  label: string;
  tone: Tone;
  text: string;
  current: boolean;
}

/** A workspace this account belongs to. */
export interface AccountWorkspace {
  id: string;
  members: PersonaId[];
  initials: string;
  tone: Tone;
  name: string;
  desc: string;
  note: string | null;
  chip: string;
  chipTone: Tone;
  open: string;
  board: BoardId;
  owner: boolean;
  leavable: boolean;
  /** What leaving costs, asked before leaving. */
  leaveWarning: string | null;
}

/** A notification category with its default channels (in-app, email, SMS). */
export interface NotificationCategory {
  id: string;
  label: string;
  hint: string;
  inApp: boolean;
  email: boolean;
  sms: boolean;
  /** Always on (security). */
  locked: boolean;
  /** Needs marketing consent. */
  consent: boolean;
}

export interface PrivacyRight {
  id: "access" | "correction" | "deletion";
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  danger: boolean;
  disabled: boolean;
  why: string;
}

/** A data-subject request and its progress. */
export interface DataRequest {
  id: string;
  title: string;
  ref: string;
  chip: string;
  chipTone: Tone;
  summary: string;
  steps: { status: MarkerStatus; title: string; when: string }[];
}

export interface PersonalFile {
  id: string;
  icon: IconName;
  name: string;
  use: string;
  who: string;
  whoIcon: IconName;
  when: string;
  size: string;
  /** Can't be deleted while identity verification relies on it. */
  locked: boolean;
}

const accountIdentities: AccountIdentity[] = [
  {
    id: "owner",
    legalName: "Didier Mugenzi",
    displayName: "Didier",
    email: "didier@amahoro.rw",
    phone: "+250 788 123 456",
    phoneMasked: "+250 788 ••• 456",
    google: "didier.mugenzi@gmail.com",
    initials: "DM",
    role: "Owner",
    created: "3 Mar 2026",
    accountId: "USR-7F2K-91",
    verifiedFor: "Owner of Amahoro Hospitality Group",
    verifiedOn: "3 Mar 2026",
    newsConsentOn: "3 Mar 2026",
  },
];

const profileFields: ProfileField[] = [
  {
    id: "pf-legal",
    label: "Legal name",
    bind: "legalName",
    value: "Didier Mugenzi",
    help: "From your verified national ID. Changing it needs a new identity check.",
    verified: false,
    locked: true,
  },
  {
    id: "pf-display",
    label: "Display name",
    bind: "displayName",
    value: "Didier",
    help: "What your team sees",
    verified: false,
    locked: false,
  },
  {
    id: "pf-email",
    label: "Email",
    bind: "email",
    value: "didier@amahoro.rw",
    help: "Used for sign-in codes and receipts",
    verified: true,
    locked: false,
  },
  {
    id: "pf-phone",
    label: "Mobile",
    bind: "phone",
    value: "+250 788 123 456",
    help: "Used for SMS sign-in codes",
    verified: true,
    locked: false,
  },
  {
    id: "pf-lang",
    label: "Language",
    bind: null,
    value: "English · Kinyarwanda available",
    help: "Missing translations fall back to English",
    verified: false,
    locked: false,
  },
  {
    id: "pf-tz",
    label: "Time zone",
    bind: null,
    value: "Africa/Kigali · CAT, UTC+2",
    help: "Dates and times across Injishi",
    verified: false,
    locked: false,
  },
];

const signInMethods: SignInMethod[] = [
  {
    id: "email",
    group: "signin",
    icon: "Envelope",
    title: "Email code",
    bind: "email",
    desc: "didier@amahoro.rw",
    chip: "On",
    chipTone: "success",
    action: "Change",
  },
  {
    id: "sms",
    group: "signin",
    icon: "Smartphone",
    title: "SMS code",
    bind: "phoneMasked",
    desc: "+250 788 ••• 456",
    chip: "On",
    chipTone: "success",
    action: "Change",
  },
  {
    id: "google",
    group: "signin",
    icon: "Globe",
    title: "Google",
    bind: "google",
    desc: "didier.mugenzi@gmail.com",
    chip: "Connected",
    chipTone: "success",
    action: "Disconnect",
  },
  {
    id: "totp",
    group: "signin",
    icon: "ShieldKeyhole",
    title: "Authenticator app",
    bind: null,
    desc: "Added 3 Mar 2026 · asked on new devices and sensitive actions. Can’t be turned off while you hold the {role} role.",
    chip: "Required for {role}",
    chipTone: "default",
    action: "Replace app",
  },
  {
    id: "backup",
    group: "recovery",
    icon: "Key",
    title: "Backup codes",
    bind: null,
    desc: "7 of 10 unused · created 3 Mar 2026",
    chip: "Ready",
    chipTone: "success",
    action: "Regenerate",
  },
  {
    id: "rphone",
    group: "recovery",
    icon: "Handset",
    title: "Recovery phone",
    bind: null,
    desc: "+250 72• ••• 118",
    chip: "Ready",
    chipTone: "success",
    action: "Change",
  },
  {
    id: "remail",
    group: "recovery",
    icon: "At",
    title: "Recovery email",
    bind: null,
    desc: "Not set",
    chip: "Recommended",
    chipTone: "warning",
    action: "Add",
  },
  {
    id: "support",
    group: "recovery",
    icon: "Passport",
    title: "Identity check with support",
    bind: null,
    desc: "Last resort · needs your national ID · up to 1 business day",
    chip: "Available",
    chipTone: "default",
    action: null,
  },
];

const accountSessions: AccountSession[] = [
  {
    id: "s1",
    icon: "Display",
    device: "Chrome on Windows",
    place: "Kigali, Rwanda",
    since: "12 Oct, 07:58",
    last: "Active now",
    workspace: "Amahoro Hospitality Group",
    current: true,
    newLocation: false,
  },
  {
    id: "s2",
    icon: "Smartphone",
    device: "Chrome on Android",
    place: "Rubavu, Rwanda",
    since: "9 Oct, 18:20",
    last: "2 hours ago",
    workspace: "Amahoro Hospitality Group",
    current: false,
    newLocation: false,
  },
  {
    id: "s3",
    icon: "Display",
    device: "Edge on Windows",
    place: "Musanze, Rwanda",
    since: "11 Oct, 22:47",
    last: "Yesterday, 23:10",
    workspace: "Broker workspace",
    current: false,
    newLocation: true,
  },
  {
    id: "s4",
    icon: "Smartphone",
    device: "Safari on iPhone",
    place: "Kigali, Rwanda",
    since: "1 Oct, 12:05",
    last: "3 days ago",
    workspace: "Personal trips",
    current: false,
    newLocation: false,
  },
];

const kycChecks: KycCheck[] = [
  {
    id: "upload",
    title: "Document uploaded",
    detail: "National ID, front and back · 3 Mar 2026, 09:02",
    registryGate: false,
  },
  {
    id: "doc",
    title: "Document check passed",
    detail: "Photo, security features and expiry readable · 09:04",
    registryGate: false,
  },
  {
    id: "registry",
    title: "Registry check confirmed by a reviewer",
    detail: "Name and ID number checked by hand; no automatic lookup is relied on",
    registryGate: true,
  },
  {
    id: "decision",
    title: "Verified by the Injishi KYC team",
    detail: "Decision KYC-26-0193 · 3 Mar 2026, 11:40",
    registryGate: false,
  },
];

const kycStates: KycState[] = [
  {
    id: "not-started",
    label: "Not started",
    tone: "default",
    text: "Needed before a first elevated role such as owner, manager or finance.",
    current: false,
  },
  {
    id: "checking",
    label: "Checking",
    tone: "info",
    text: "Document and registry checks are running.",
    current: false,
  },
  {
    id: "review",
    label: "Needs review",
    tone: "warning",
    text: "Something didn’t match, so a reviewer looks by hand.",
    current: false,
  },
  {
    id: "verified",
    label: "Verified",
    tone: "success",
    text: "Checks passed and a reviewer confirmed. You are here.",
    current: true,
  },
  {
    id: "rejected",
    label: "Rejected",
    tone: "danger",
    text: "Not accepted, with the reason and how to try again.",
    current: false,
  },
  {
    id: "expired",
    label: "Document expired",
    tone: "warning",
    text: "Upload a current ID to keep elevated roles.",
    current: false,
  },
];

const accountWorkspaces: AccountWorkspace[] = [
  {
    id: "amahoro",
    members: ["owner"],
    initials: "AH",
    tone: "accent",
    name: "Amahoro Hospitality Group",
    desc: "Business · Owner · 3 properties, 2 legal entities",
    note: "You can’t leave while you are the only owner. Transfer ownership first; a business always needs an owner.",
    chip: "Current",
    chipTone: "accent",
    open: "Settings",
    board: "SettingsBusiness",
    owner: true,
    leavable: false,
    leaveWarning: null,
  },
  {
    id: "broker",
    members: ["owner"],
    initials: "BR",
    tone: "default",
    name: "Broker workspace",
    desc: "Residence broker · Kigali · 14 contact credits · since Jun 2026",
    note: null,
    chip: "Member",
    chipTone: "default",
    open: "Switch",
    board: "BrokerWork",
    owner: false,
    leavable: true,
    leaveWarning:
      "You lose access to its leads and placements. The 14 unused contact credits stay with the workspace. Your sign-in and other workspaces are not affected.",
  },
  {
    id: "personal",
    members: ["owner"],
    initials: "DM",
    tone: "success",
    name: "Personal trips",
    desc: "Your own bookings as a guest · 1 upcoming trip",
    note: "Part of your account; it can’t be left.",
    chip: "Personal",
    chipTone: "default",
    open: "Switch",
    board: "GuestAccount",
    owner: false,
    leavable: false,
    leaveWarning: null,
  },
];

const notificationCategories: NotificationCategory[] = [
  {
    id: "appr",
    label: "Approvals waiting for you",
    hint: "Refunds, pay runs, rate changes",
    inApp: true,
    email: true,
    sms: true,
    locked: false,
    consent: false,
  },
  {
    id: "money",
    label: "Payment and fiscal exceptions",
    hint: "Unknown payments, held receipts",
    inApp: true,
    email: true,
    sms: false,
    locked: false,
    consent: false,
  },
  {
    id: "guest",
    label: "Guest escalations",
    hint: "Overdue requests and complaints",
    inApp: true,
    email: false,
    sms: false,
    locked: false,
    consent: false,
  },
  {
    id: "daily",
    label: "Daily business summary",
    hint: "Sent at 07:00",
    inApp: false,
    email: true,
    sms: false,
    locked: false,
    consent: false,
  },
  {
    id: "sec",
    label: "Security alerts",
    hint: "Always on · new sign-ins and changes",
    inApp: true,
    email: true,
    sms: true,
    locked: true,
    consent: false,
  },
  {
    id: "news",
    label: "Training and product news",
    hint: "Needs your consent",
    inApp: false,
    email: true,
    sms: false,
    locked: false,
    consent: true,
  },
];

const privacyRights: PrivacyRight[] = [
  {
    id: "access",
    icon: "FileArrowDown",
    title: "Get a Copy of My Data",
    body: "Your profile, sign-ins, workspaces and messages in one file.",
    cta: "Request a copy",
    danger: false,
    disabled: true,
    why: "You already have an open request, DSR-26-0031.",
  },
  {
    id: "correction",
    icon: "PencilToSquare",
    title: "Correct My Data",
    body: "Tell us what’s wrong. We fix it or explain why not.",
    cta: "Request a correction",
    danger: false,
    disabled: false,
    why: "Most fields you can also edit yourself in Profile.",
  },
  {
    id: "deletion",
    icon: "TrashBin",
    title: "Delete My Account",
    body: "Removes your identity and personal data. Records the law requires are kept.",
    cta: "Request deletion",
    danger: true,
    disabled: true,
    why: "Transfer ownership of Amahoro Hospitality Group first.",
  },
];

const dataRequests: DataRequest[] = [
  {
    id: "DSR-26-0031",
    title: "Copy of my data",
    ref: "DSR-26-0031 · submitted 2 Oct 2026",
    chip: "In progress",
    chipTone: "info",
    summary: "Gathering records from your 3 workspaces. The download link will work for 7 days.",
    steps: [
      { status: "success", title: "Submitted", when: "2 Oct 2026, 14:10" },
      { status: "success", title: "Identity confirmed", when: "2 Oct 2026, 14:12" },
      { status: "current", title: "Gathering records", when: "Business, broker and personal workspaces" },
      { status: "default", title: "Ready to download", when: "Target 1 Nov 2026" },
    ],
  },
  {
    id: "DSR-26-0012",
    title: "Correction",
    ref: "DSR-26-0012 · submitted 12 Aug 2026",
    chip: "Completed",
    chipTone: "success",
    summary: "Date of birth corrected on your guest profile.",
    steps: [
      { status: "success", title: "Submitted", when: "12 Aug 2026" },
      { status: "success", title: "Corrected", when: "16 Aug 2026 · confirmation emailed" },
    ],
  },
];

const personalFiles: PersonalFile[] = [
  {
    id: "id-front",
    icon: "Passport",
    name: "national-id-front.jpg",
    use: "Identity verification",
    who: "Injishi KYC reviewers only",
    whoIcon: "Lock",
    when: "3 Mar 2026",
    size: "1.2 MB",
    locked: true,
  },
  {
    id: "id-back",
    icon: "Passport",
    name: "national-id-back.jpg",
    use: "Identity verification",
    who: "Injishi KYC reviewers only",
    whoIcon: "Lock",
    when: "3 Mar 2026",
    size: "1.1 MB",
    locked: true,
  },
  {
    id: "photo",
    icon: "Picture",
    name: "profile-photo.jpg",
    use: "Profile photo",
    who: "People in your workspaces",
    whoIcon: "Persons",
    when: "3 Mar 2026",
    size: "240 KB",
    locked: false,
  },
  {
    id: "signature",
    icon: "Pencil",
    name: "signature-didier.png",
    use: "Approval signature",
    who: "Amahoro approvers",
    whoIcon: "PersonsLock",
    when: "5 Mar 2026",
    size: "38 KB",
    locked: false,
  },
];

// ── GlobalSearch ────────────────────────────────────────────────────────────────────────────────────────

/** A desk figure on the front desk's Today page (behind the search palette). */
export interface DeskFigure {
  id: string;
  label: string;
  value: number;
  foot: string;
}

/** An arriving guest on the front desk's Today page. */
export interface DeskArrival {
  id: string;
  name: string;
  booking: string;
  nights: string;
  roomType: string;
  room: string | null;
  expected: string;
  balance: number;
}

export type SearchGroup = "guests" | "bookings" | "stays" | "folios" | "actions";

/** A searchable record or desk action. `always` actions show for every query; `quick` ones when it is empty. */
export interface SearchEntry {
  id: string;
  group: SearchGroup;
  icon: IconName;
  title: string;
  meta: string;
  chip: string | null;
  chipTone: Tone;
  /** Folio balance (RWF). */
  balance: number | null;
  keywords: string;
  board: BoardId;
  always: boolean;
  quick: boolean;
}

export interface RecentSearch {
  id: string;
  q: string;
}

const deskFigures: DeskFigure[] = [
  { id: "arrivals", label: "Arrivals", value: 14, foot: "5 checked in · 9 to come" },
  { id: "inhouse", label: "In-house", value: 33, foot: "Of 42 rooms tonight" },
  { id: "departures", label: "Departures", value: 11, foot: "6 out · 5 due by 12:00" },
  { id: "notready", label: "Rooms not ready", value: 3, foot: "For arrivals before 14:00" },
];

const deskArrivals: DeskArrival[] = [
  {
    id: "BK-20431",
    name: "Sarah Kimani",
    booking: "BK-20431",
    nights: "2 nights",
    roomType: "Deluxe Lake View",
    room: "204",
    expected: "At the desk",
    balance: 165200,
  },
  {
    id: "BK-20436",
    name: "Daniel Okafor",
    booking: "BK-20436",
    nights: "3 nights",
    roomType: "Standard Queen",
    room: "106",
    expected: "12:30",
    balance: 0,
  },
  {
    id: "BK-20433",
    name: "Thomas Weber",
    booking: "BK-20433",
    nights: "5 nights",
    roomType: "Deluxe Lake View",
    room: "211",
    expected: "13:30",
    balance: 148680,
  },
  {
    id: "BK-20438",
    name: "Yuki Tanaka",
    booking: "BK-20438",
    nights: "1 night",
    roomType: "Standard Queen",
    room: null,
    expected: "14:00",
    balance: 0,
  },
  {
    id: "BK-20440",
    name: "Aisha Mohammed",
    booking: "BK-20440",
    nights: "4 nights",
    roomType: "Deluxe Lake View",
    room: "310",
    expected: "15:00",
    balance: 0,
  },
];

const searchEntries: SearchEntry[] = [
  {
    id: "g-kimani",
    group: "guests",
    icon: "Person",
    title: "Sarah Kimani",
    meta: "Returning guest · 3 stays since 2025 · +254 7•• ••• 219",
    chip: "At the desk",
    chipTone: "accent",
    balance: null,
    keywords: "",
    board: "Guests",
    always: false,
    quick: false,
  },
  {
    id: "g-weber",
    group: "guests",
    icon: "Person",
    title: "Thomas Weber",
    meta: "Umurage Consulting · 1 stay · +49 1•• ••• 802",
    chip: "Arriving 13:30",
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "Guests",
    always: false,
    quick: false,
  },
  {
    id: "g-mohammed",
    group: "guests",
    icon: "Person",
    title: "Aisha Mohammed",
    meta: "Umurage Consulting · 2 stays",
    chip: "Arriving 15:00",
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "Guests",
    always: false,
    quick: false,
  },
  {
    id: "BK-20431",
    group: "bookings",
    icon: "Calendar",
    title: "BK-20431 · Sarah Kimani",
    meta: "Today to 14 Oct · 2 nights · Deluxe Lake View · Akagera Horizon Travel",
    chip: "Arriving today",
    chipTone: "accent",
    balance: null,
    keywords: "",
    board: "ReservationDetail",
    always: false,
    quick: false,
  },
  {
    id: "BK-20502",
    group: "bookings",
    icon: "Calendar",
    title: "BK-20502 · Sarah Kimani",
    meta: "20 to 23 Dec 2026 · 3 nights · Family Suite · Direct",
    chip: "Confirmed",
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "ReservationDetail",
    always: false,
    quick: false,
  },
  {
    id: "BK-20433",
    group: "bookings",
    icon: "Calendar",
    title: "BK-20433 · Thomas Weber",
    meta: "Today to 17 Oct · 5 nights · Deluxe Lake View",
    chip: "Arriving today",
    chipTone: "accent",
    balance: null,
    keywords: "",
    board: "ReservationDetail",
    always: false,
    quick: false,
  },
  {
    id: "ST-8754",
    group: "stays",
    icon: "Suitcase",
    title: "ST-8754 · Sarah Kimani",
    meta: "14 to 16 Jul 2026 · Room 305 · checked out",
    chip: "Closed",
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "StayFolio",
    always: false,
    quick: false,
  },
  {
    id: "F-5590",
    group: "folios",
    icon: "Receipt",
    title: "F-5590 · Sarah Kimani",
    meta: "For BK-20431 · deposit due before check-in",
    chip: null,
    chipTone: "default",
    balance: 165200,
    keywords: "",
    board: "StayFolio",
    always: false,
    quick: false,
  },
  {
    id: "F-5512",
    group: "folios",
    icon: "Receipt",
    title: "F-5512 · Sarah Kimani",
    meta: "For ST-8754 · July stay",
    chip: null,
    chipTone: "default",
    balance: 0,
    keywords: "",
    board: "StayFolio",
    always: false,
    quick: false,
  },
  {
    id: "F-5594",
    group: "folios",
    icon: "Receipt",
    title: "F-5594 · Thomas Weber",
    meta: "For BK-20433 · deposit by MTN MoMo pending",
    chip: null,
    chipTone: "default",
    balance: 148680,
    keywords: "",
    board: "StayFolio",
    always: false,
    quick: false,
  },
  {
    id: "a-checkin-kimani",
    group: "actions",
    icon: "ArrowRightToSquare",
    title: "Check in Sarah Kimani",
    meta: "BK-20431 · room 204 due clean at 12:00",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "kimani sarah",
    board: "CheckIn",
    always: false,
    quick: false,
  },
  {
    id: "a-message-kimani",
    group: "actions",
    icon: "Comments",
    title: "Message Sarah Kimani",
    meta: "Opens the booking thread · last message 08:12",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "kimani sarah",
    board: "Messages",
    always: false,
    quick: false,
  },
  {
    id: "a-checkin-weber",
    group: "actions",
    icon: "ArrowRightToSquare",
    title: "Check in Thomas Weber",
    meta: "BK-20433 · room 211 due clean at 13:00",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "weber thomas",
    board: "CheckIn",
    always: false,
    quick: false,
  },
  {
    id: "a-walkin",
    group: "actions",
    icon: "PersonPlus",
    title: "New walk-in",
    meta: "Start a booking for a guest at the desk",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "WalkIn",
    always: true,
    quick: true,
  },
  {
    id: "q-calendar",
    group: "actions",
    icon: "LayoutCells",
    title: "Open calendar",
    meta: "Rooms and stays for the next 14 days",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "RoomRack",
    always: false,
    quick: true,
  },
  {
    id: "q-notready",
    group: "actions",
    icon: "BroomMotion",
    title: "Rooms not ready",
    meta: "3 rooms for arrivals before 14:00",
    chip: null,
    chipTone: "default",
    balance: null,
    keywords: "",
    board: "HousekeepingBoard",
    always: false,
    quick: true,
  },
];

const recentSearches: RecentSearch[] = [
  { id: "r-weber", q: "Weber" },
  { id: "r-204", q: "204" },
  { id: "r-bk20418", q: "BK-20418" },
  { id: "r-okafor", q: "Okafor" },
];

// ── Notifications ───────────────────────────────────────────────────────────────────────────────────────

/** A figure on the manager's Today page (behind the notification panel). */
export interface InboxFigure {
  id: string;
  label: string;
  value: number;
  percent: boolean;
  foot: string;
}

/** An item on the manager's "Needs You Now" list. */
export interface InboxTask {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
}

export type NotificationCategoryId = "action" | "mention" | "system";

/** A notification in someone's inbox. `read` is false until they read it. */
export interface InboxNotification {
  id: string;
  recipients: PersonaId[];
  cats: NotificationCategoryId[];
  tone: Tone;
  icon: IconName;
  time: string;
  title: string;
  body: string;
  chip: string | null;
  chipTone: Tone;
  refs: string[];
  actions: { label: string; board: BoardId; primary: boolean }[];
  /** Delivery evidence for failed messages. */
  evidence: string[];
  read: boolean;
}

const inboxFigures: InboxFigure[] = [
  { id: "occupancy", label: "Occupancy tonight", value: 0.81, percent: true, foot: "34 of 42 rooms" },
  { id: "arrivals", label: "Arrivals", value: 14, percent: false, foot: "5 in · 9 to come" },
  { id: "notready", label: "Rooms not ready", value: 5, percent: false, foot: "For arrivals before 14:00" },
  { id: "exceptions", label: "Open exceptions", value: 7, percent: false, foot: "Requests, payments, receipts" },
];

const inboxTasks: InboxTask[] = [
  { id: "305", icon: "CircleExclamation", title: "Room 305 request overdue", desc: "Escalated to you at 10:35" },
  { id: "211", icon: "BroomMotion", title: "Room 211 needed by 11:30", desc: "Thomas Weber landed early" },
  { id: "112", icon: "Wrench", title: "Room 112 out of order to 15 Oct", desc: "2 bookings to move" },
  { id: "rate", icon: "Tag", title: "Deluxe Lake View rate for 24–26 Oct", desc: "Waiting for owner approval" },
];

const MANAGEMENT: PersonaId[] = ["manager", "owner"];

const inboxNotifications: InboxNotification[] = [
  {
    id: "esc",
    recipients: MANAGEMENT,
    cats: ["action"],
    tone: "danger",
    icon: "CircleExclamation",
    time: "10:45",
    title: "Guest request overdue · Room 305",
    body: "Lucia Romero asked for extra towels and a kettle at 10:05. Nobody acknowledged it within the 30-minute target, so it was escalated to you.",
    chip: "Overdue 40 min",
    chipTone: "danger",
    refs: ["ST-8801"],
    actions: [
      { label: "Assign to housekeeping", board: "HousekeepingBoard", primary: true },
      { label: "Open thread", board: "Messages", primary: false },
    ],
    evidence: [],
    read: false,
  },
  {
    id: "dirty",
    recipients: MANAGEMENT,
    cats: ["action"],
    tone: "warning",
    icon: "BroomMotion",
    time: "10:44",
    title: "Room 211 still dirty, arrival in 45 min",
    body: "Thomas Weber’s flight landed early and he now expects 11:30. Jeanne Nyiraneza is cleaning 204 first.",
    chip: "Arrival 11:30",
    chipTone: "warning",
    refs: ["BK-20433"],
    actions: [
      { label: "Reprioritise rooms", board: "HousekeepingBoard", primary: true },
      { label: "Offer another room", board: "RoomRack", primary: false },
    ],
    evidence: [],
    read: false,
  },
  {
    id: "pay",
    recipients: MANAGEMENT,
    cats: ["system"],
    tone: "warning",
    icon: "CreditCard",
    time: "10:38",
    title: "Payment status Unknown · RWF 148,680",
    body: "Deposit for Thomas Weber by MTN MoMo. The provider hasn’t answered since 10:20. Don’t ask the guest to pay again while we check.",
    chip: "Unknown · checking with provider",
    chipTone: "warning",
    refs: ["PI-77142", "MoMo ref MP261012.1020.T4471"],
    actions: [{ label: "Open booking", board: "ReservationDetail", primary: true }],
    evidence: [],
    read: false,
  },
  {
    id: "vsdc",
    recipients: MANAGEMENT,
    cats: ["system"],
    tone: "warning",
    icon: "FileCheck",
    time: "10:31",
    title: "3 fiscal receipts pending at the VSDC",
    body: "Oldest since 08:31, for Moses Kariuki’s checkout. Retrying with the same request IDs, so no receipt is issued twice.",
    chip: "Pending",
    chipTone: "warning",
    refs: ["F-5502", "F-5488", "F-5509"],
    actions: [{ label: "View fiscal receipts", board: "FiscalReceipts", primary: true }],
    evidence: [],
    read: false,
  },
  {
    id: "ooo",
    recipients: MANAGEMENT,
    cats: ["action", "mention"],
    tone: "info",
    icon: "Wrench",
    time: "10:12",
    title: "Jean-Paul Niyonsaba mentioned you on WO-318",
    body: "“Room 112 stays out of order until Thu 15 Oct. The replacement water heater arrives Tuesday.” 2 bookings need another room.",
    chip: "Out of order extended",
    chipTone: "info",
    refs: ["WO-318", "Room 112"],
    actions: [
      { label: "Move 2 bookings", board: "RoomRack", primary: true },
      { label: "Open work order", board: "Maintenance", primary: false },
    ],
    evidence: [],
    read: false,
  },
  {
    id: "late",
    recipients: MANAGEMENT,
    cats: ["mention"],
    tone: "accent",
    icon: "Comments",
    time: "09:55",
    title: "Eric Habimana mentioned you",
    body: "“Kevin Otieno in 301 asks for a 14:00 checkout on Wednesday. Room 301 isn’t needed until 16:00. OK to approve?”",
    chip: null,
    chipTone: "default",
    refs: ["BK-20427"],
    actions: [{ label: "Reply", board: "Messages", primary: true }],
    evidence: [],
    read: true,
  },
  {
    id: "bounce",
    recipients: MANAGEMENT,
    cats: ["system"],
    tone: "danger",
    icon: "Envelope",
    time: "09:41",
    title: "Email to guest not delivered",
    body: "Pre-arrival message to Yuki Tanaka for BK-20438 failed after 3 tries. The receiving server says the mailbox doesn’t exist.",
    chip: "Delivery failed",
    chipTone: "danger",
    refs: ["BK-20438"],
    actions: [{ label: "Update guest email", board: "Guests", primary: true }],
    evidence: [
      "09:00 · attempt 1 · 550 5.1.1 mailbox unavailable",
      "09:20 · attempt 2 · same response",
      "09:40 · attempt 3 · same response · retries stopped",
      "Message MSG-6620194 · to yuki.tanaka@•••.jp",
    ],
    read: false,
  },
];

// ── StatesGallery ───────────────────────────────────────────────────────────────────────────────────────

/** A payment status, as every screen shows it. Only Verified looks like success. */
export interface PaymentStateCard {
  id: string;
  label: string;
  tone: Tone;
  icon: IconName;
  copy: string;
  ref: string;
  /** Highlighted as the one success state. */
  success: boolean;
}

/** A status with its explanation (fiscal documents, submission outcomes). */
export interface StateCopy {
  id: string;
  label: string;
  tone: Tone;
  copy: string;
}

/** A step of a government submission, with when and by whom it happened. */
export interface SubmissionStep {
  id: string;
  title: string;
  when: string;
  complete: boolean;
}

export interface EvidenceLine {
  id: string;
  text: string;
}

/** A write-off reason code; posting errors are not write-offs. */
export interface WriteOffReason {
  id: string;
  label: string;
  desc: string;
  disabled: boolean;
}

/** A refund above the limit, waiting for a second approver (maker and checker). */
export interface MakerCheckerRequest {
  id: string;
  title: string;
  context: string;
  status: string;
  facts: { label: string; value: string }[];
  preparedBy: string;
  preparedAt: string;
  approver: string;
  approverRole: string;
}

/** A room row of the bulk-selection example. */
export interface BulkRoom {
  id: string;
  label: string;
  status: string;
  statusTone: Tone;
  selected: boolean;
}

const paymentStates: PaymentStateCard[] = [
  {
    id: "initiated",
    label: "Initiated",
    tone: "default",
    icon: "CircleDashed",
    copy: "Request created. Nothing has been asked of the payer yet.",
    ref: "PI-77150 · 10:41",
    success: false,
  },
  {
    id: "pending",
    label: "Pending",
    tone: "warning",
    icon: "Hourglass",
    copy: "Sent to MTN MoMo. Waiting for the guest to approve on their phone.",
    ref: "PI-77149 · prompt sent 10:39",
    success: false,
  },
  {
    id: "verified",
    label: "Verified",
    tone: "success",
    icon: "CircleCheck",
    copy: "Confirmed by the provider. Safe to release the room or close the folio.",
    ref: "MTN MoMo · ref MP261012.0941.C2107 · 09:41 · RWF 280,000",
    success: true,
  },
  {
    id: "failed",
    label: "Failed",
    tone: "danger",
    icon: "CircleXmark",
    copy: "Declined by the provider: insufficient balance. No money moved.",
    ref: "PI-77131 · 09:12",
    success: false,
  },
  {
    id: "reversed",
    label: "Reversed",
    tone: "default",
    icon: "ArrowUturnCcwLeft",
    copy: "The provider reversed a verified payment. The folio balance reopened.",
    ref: "PI-77088 · reversed 8 Oct",
    success: false,
  },
  {
    id: "refunded",
    label: "Refunded",
    tone: "info",
    icon: "ArrowRotateLeft",
    copy: "Money returned to the payer. The refund receipt is a separate document.",
    ref: "PI-77064 · refund receipt issued 9 Oct",
    success: false,
  },
  {
    id: "disputed",
    label: "Disputed",
    tone: "danger",
    icon: "ScalesUnbalanced",
    copy: "The cardholder disputed the charge. Funds are held until it is resolved.",
    ref: "PI-77012 · GT Bank case open",
    success: false,
  },
  {
    id: "unknown",
    label: "Unknown",
    tone: "warning",
    icon: "CircleQuestion",
    copy: "Unknown — checking with provider. No answer after 60 seconds; don’t take a second payment.",
    ref: "PI-77142 · checking since 10:20",
    success: false,
  },
];

const fiscalStates: StateCopy[] = [
  { id: "draft", label: "Draft", tone: "default", copy: "Being prepared. Nothing has been sent to the VSDC." },
  {
    id: "pending",
    label: "Pending",
    tone: "warning",
    copy: "Sent to the VSDC, waiting for its signature. Retries reuse the same request ID.",
  },
  {
    id: "issued",
    label: "Issued",
    tone: "success",
    copy: "Signed by the VSDC as EBM-0004-118301 at 10:08. Only now does a receipt number exist.",
  },
  {
    id: "rejected",
    label: "Rejected",
    tone: "danger",
    copy: "The VSDC refused it because the buyer TIN format was wrong. Fix and resend; no receipt exists.",
  },
  {
    id: "unknown",
    label: "Unknown",
    tone: "warning",
    copy: "No answer from the VSDC. We check before retrying so nothing is issued twice.",
  },
];

const submissionSteps: SubmissionStep[] = [
  { id: "draft", title: "Draft", when: "2 Oct", complete: true },
  { id: "review", title: "Internal review", when: "Aline · 3 Oct", complete: true },
  { id: "approved", title: "Approved to send", when: "Didier · 4 Oct", complete: true },
  { id: "sent", title: "Sent", when: "6 Oct · manual", complete: false },
];

const submissionOutcomes: StateCopy[] = [
  {
    id: "acknowledged",
    label: "Acknowledged",
    tone: "success",
    copy: "Counterpart reference received and attached as proof.",
  },
  { id: "rejected", label: "Rejected", tone: "danger", copy: "Refused by the counterpart, with their reason on file." },
  {
    id: "follow-up",
    label: "Needs follow-up",
    tone: "warning",
    copy: "More information asked for, or no reply by the due date.",
  },
];

const checkoutEvidence: EvidenceLine[] = [
  { id: "payment", text: "Payment Verified · MTN MoMo · ref MP261012.1205.K7731 · 12:07" },
  { id: "receipt", text: "Fiscal receipt Issued · EBM-0004-118309 · 12:08" },
  { id: "folio", text: "Folio F-5507 closed by Eric Habimana · 12:09" },
];

const writeOffReasons: WriteOffReason[] = [
  { id: "RC-02", label: "Guest dispute settled", desc: "RC-02 · settlement note attached", disabled: false },
  { id: "RC-05", label: "Uncollectible after 90 days", desc: "RC-05 · 3 reminders sent", disabled: false },
  {
    id: "RC-07",
    label: "Goodwill, approved by owner",
    desc: "RC-07 · needs the owner’s approval reference",
    disabled: false,
  },
  {
    id: "posting-error",
    label: "Posting error",
    desc: "Not a write-off: correct it with a credit note instead",
    disabled: true,
  },
];

const makerCheckerRequests: MakerCheckerRequest[] = [
  {
    id: "refund-BK-20418",
    title: "Refund RWF 480,000",
    context: "BK-20418 · Volcano view group · above the RWF 300,000 limit",
    status: "Needs a second approver",
    facts: [
      { label: "Prepared by", value: "Aline Uwase · 09:20" },
      { label: "Policy", value: "Cancellation tier 2 · policy v3" },
      { label: "Paid with", value: "MTN MoMo · verified · ref MP260914.1102.V8812" },
      { label: "Refund to", value: "Original method only" },
    ],
    preparedBy: "Aline",
    preparedAt: "09:20",
    approver: "Didier Mugenzi",
    approverRole: "Owner",
  },
];

const bulkRooms: BulkRoom[] = [
  { id: "204", label: "Room 204 · checkout", status: "Dirty", statusTone: "warning", selected: true },
  { id: "211", label: "Room 211 · checkout", status: "Dirty", statusTone: "warning", selected: true },
  { id: "102", label: "Room 102 · checkout", status: "Dirty", statusTone: "warning", selected: false },
];

// ── AccessDenied ────────────────────────────────────────────────────────────────────────────────────────

/** Why a screen is blocked for a role, keyed by the blocked board. */
export interface AccessDenial {
  id: BoardId;
  source: string;
  crumb: string;
  /** "report", "screen" … */
  noun: string;
  /** What the role doesn't include, e.g. "financial reports". */
  scope: string;
  whoCanOpen: string;
  decider: string;
  reference: string;
  at: string;
  /** Pre-filled reason of an access request. */
  reason: string;
  durations: string[];
  requestSentAt: string;
}

/** Where a persona can go instead (artifact: "What You Can Do From the Desk"). */
export interface AccessAlternatives {
  id: PersonaId;
  heading: string;
  items: { id: string; icon: IconName; title: string; desc: string; board: BoardId }[];
}

/** A personal-data export that needs step-up (purpose, reason and a fresh authenticator code). */
export interface DataExport {
  id: string;
  crumb: string;
  title: string;
  lead: string;
  property: string;
  entity: string;
  dates: string;
  rows: number;
  format: string;
  fields: string[];
  exportId: string;
  fingerprint: string;
  verifiedAt: string;
  linkExpires: string;
  auditEntry: string;
  reason: string;
}

export interface ExportPurpose {
  id: string;
  label: string;
  desc: string;
}

/** An earlier export of personal data. */
export interface ExportRecord {
  id: string;
  label: string;
  by: string;
  purpose: string;
  rows: number;
  link: string;
}

const accessDenials: AccessDenial[] = [
  {
    id: "Reports",
    source: "Opened from a shared link",
    crumb: "Reports › Revenue by department",
    noun: "report",
    scope: "financial reports",
    whoCanOpen: "Owner, general manager and finance roles",
    decider: "Didier Mugenzi, Owner",
    reference: "ACC-26-7F3K",
    at: "12 Oct 2026, 10:12",
    reason: "Aline asked me to print yesterday’s revenue summary for the 11:00 department meeting.",
    durations: ["Today only", "7 days", "30 days"],
    requestSentAt: "10:14",
  },
];

const accessAlternatives: AccessAlternatives[] = [
  {
    id: "frontdesk",
    heading: "What You Can Do From the Desk",
    items: [
      {
        id: "today",
        icon: "House",
        title: "Today’s arrivals and departures",
        desc: "9 arrivals still to come",
        board: "FrontDeskToday",
      },
      {
        id: "folio",
        icon: "Receipt",
        title: "Take a payment on a guest folio",
        desc: "Desk payments for your shift",
        board: "StayFolio",
      },
      { id: "messages", icon: "Comments", title: "Answer guest messages", desc: "5 unread", board: "Messages" },
    ],
  },
];

const dataExports: DataExport[] = [
  {
    id: "guest-register",
    crumb: "Reports › Guest data",
    title: "Guest Register Export",
    lead: "Personal data of guests who stayed at Isangano Lakeside Hotel. Every export is purpose-bound and logged.",
    property: "Isangano Lakeside Hotel",
    entity: "Amahoro Hospitality Ltd",
    dates: "1 to 11 Oct 2026",
    rows: 412,
    format: "CSV",
    fields: ["Full name", "Nationality", "ID or passport number", "Phone", "Email", "Stay dates"],
    exportId: "EXP-26-0091",
    fingerprint: "SHA-256 3f9a…c21e",
    verifiedAt: "10:30",
    linkExpires: "13 Oct 2026, 10:30",
    auditEntry: "AUD-26-30422",
    reason: "Q3 check of guest ID records before the tourism licence renewal.",
  },
];

const exportPurposes: ExportPurpose[] = [
  { id: "dsr", label: "Answer a guest’s own data request", desc: "Link the request, for example DSR-26-0031" },
  {
    id: "authority",
    label: "Respond to a verified authority request",
    desc: "Attach the request letter and its reference",
  },
  { id: "audit", label: "Internal audit", desc: "Stays inside Amahoro Hospitality Ltd" },
];

const exportHistory: ExportRecord[] = [
  {
    id: "EXP-26-0084",
    label: "EXP-26-0084 · 1 to 30 Sep",
    by: "Didier Mugenzi",
    purpose: "Internal audit",
    rows: 1036,
    link: "Expired",
  },
  {
    id: "EXP-26-0061",
    label: "EXP-26-0061 · guest Daniel Okafor",
    by: "Didier Mugenzi",
    purpose: "Guest’s own data request",
    rows: 1,
    link: "Expired",
  },
];

// ── Me (/me) ─────────────────────────────────────────────────────────────────

export type MyHrTone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/**
 * A person's own HR, as they read it on Me (/me): who HR has them as, their pay, leave and time,
 * and what they can ask for. One document, read from their own staff file only (`/me/work`).
 */
export interface MyHr {
  id: string;
  /** The person has a staff file at this business; without one the page says so and nothing else. */
  hasFile: boolean;
  /** Today in Kigali ("2026-10-18"): where the two weeks of shifts start. */
  today: string;
  /** They have left: their file reads, and nothing can be asked. */
  readOnly: boolean;
  person: MyHrPerson;
  /** Four figures across the top: leave left, next shift, the month so far, the last pay. */
  figures: MyHrFigure[];
  /** Published shifts of the next two weeks. */
  shifts: MyHrShift[];
  payslips: MyHrPayslip[];
  claims: MyHrItem[];
  loans: MyHrItem[];
  balances: MyHrBalance[];
  /** The kinds of leave the person may ask for. */
  leaveTypes: { id: string; name: string }[];
  /** Leave, extra days, shift changes and time corrections they asked for, newest first. */
  requests: MyHrRequest[];
  month: MyHrMonth | null;
  records: MyHrRecord[];
  documents: MyHrDocument[];
  /** Joining and leaving checklist tasks; `mine` are the person's to tick. */
  tasks: MyHrTask[];
  kioskPin: { hasPin: boolean; setOn: string | null } | null;
  /** Questions the person asked HR or IT, newest first. */
  tickets?: MyHrTicket[];
  /** Things signed out to them and not back yet. */
  assets?: MyHrAsset[];
  /** What HR posted that is for them, newest first. */
  announcements?: MyHrAnnouncement[];
  /** Their own reviews, the latest cycle first. */
  reviews?: MyHrReview[];
  /** The clock-in card: how their branch clocks in, whether they are in now, and their shift. */
  clock?: MyHrClock | null;
}

/** How a branch's staff clock themselves in: see `ClockMode` in the contracts. */
export type MyHrClockMode = "anywhere" | "at_work" | "entrance";

export interface MyHrClock {
  branch: string | null;
  mode: MyHrClockMode;
  /** In since (ISO), and whether HR has still to check it. */
  open: { since: string; checked: boolean } | null;
  /** The shift a clock-in now belongs to, ISO times. */
  shift: { startsAt: string; endsAt: string } | null;
  /** When a clock-in opens for that shift (ISO); null when it is open now. */
  opensAt: string | null;
}

export interface MyHrTicket {
  id: string;
  title: string;
  meta: string;
  chip: string;
  tone: MyHrTone;
  /** HR's last answer, when there is one. */
  answer: string | null;
}

export interface MyHrAnnouncement {
  id: string;
  title: string;
  body: string;
  /** "6 Nov · until 20 Nov". */
  meta: string;
}

/** A person's own review: where it stands, and whether their part can still be written. */
export interface MyHrReview {
  id: string;
  title: string;
  /** "1 Nov – 30 Nov". */
  meta: string;
  chip: string;
  tone: MyHrTone;
  /** What they wrote. */
  note: string | null;
  canWrite: boolean;
}

export interface MyHrAsset {
  id: string;
  name: string;
  meta: string;
  chip: string;
  tone: MyHrTone;
}

export interface MyHrPerson {
  employeeId: string | null;
  name: string;
  initials: string;
  job: string;
  branch: string;
  business: string;
  staffNo: string;
  manager: string | null;
  status: string;
}

export interface MyHrFigure {
  id: string;
  label: string;
  value: string;
  foot: string;
}

export interface MyHrShift {
  id: string;
  /** "2026-10-19". */
  date: string;
  day: string;
  time: string;
  name: string;
  today: boolean;
}

export interface MyHrPayslip {
  id: string;
  /** "2026-09": the year to date adds up the payslips of one year. */
  period: string;
  month: string;
  gross: number;
  net: number;
  paid: string;
  tone: MyHrTone;
}

/** A claim or a loan: what it is, where it stands. */
export interface MyHrItem {
  id: string;
  /** What it is for: "Printer paper for the front desk", "Salary advance". */
  title: string;
  /** In francs; null for a claim of leave days paid out, which payroll prices. */
  amount: number | null;
  /** A loan's share already repaid, 0 to 1; null for a claim. */
  repaid: number | null;
  meta: string;
  chip: string;
  tone: MyHrTone;
  canCancel: boolean;
}

export interface MyHrBalance {
  id: string;
  name: string;
  /** Null: the kind keeps no balance (sick leave, unpaid leave). */
  days: number | null;
  foot: string;
}

export interface MyHrRequest {
  /** `leave:<id>`, `extra:<id>`, `shift:<id>` or `fix:<id>`. */
  id: string;
  kind: string;
  title: string;
  meta: string;
  chip: string;
  tone: MyHrTone;
  canCancel: boolean;
}

export interface MyHrMonth {
  label: string;
  daysWorked: number;
  worked: string;
  expected: string;
  late: number;
  overtime: string;
}

export interface MyHrRecord {
  id: string;
  day: string;
  times: string;
  worked: string;
  note: string;
  chip: string;
  tone: MyHrTone;
  workDate: string;
  /** "07:01", "15:04", in Kigali: what a correction starts from. */
  inAt: string;
  outAt: string | null;
  /** A closed record can be asked to be put right. */
  canAsk: boolean;
}

export interface MyHrDocument {
  id: string;
  title: string;
  meta: string;
  chip: string;
  tone: MyHrTone;
  /** HR asked for it, or sent it back. */
  canSend: boolean;
}

export interface MyHrTask {
  id: string;
  label: string;
  meta: string;
  done: boolean;
  mine: boolean;
  checklist: string;
}

/** Diane Ingabire's own HR in the prototype's October. */
const myHr: MyHr[] = [
  {
    id: "hr",
    hasFile: true,
    today: "2026-10-18",
    readOnly: false,
    person: {
      employeeId: null,
      name: "Diane Ingabire",
      initials: "DI",
      job: "HR officer",
      branch: "Isangano Lakeside Hotel",
      business: "Amahoro Hospitality Ltd",
      staffNo: "EMP-0088",
      manager: "Aline Uwase",
      status: "active",
    },
    figures: [
      { id: "leave", label: "Annual leave balance", value: "14 days", foot: "Available this year" },
      { id: "shift", label: "Next shift", value: "Mon 19 Oct", foot: "08:00 – 17:00 · Office" },
      { id: "month", label: "Hours this month", value: "92 h 30 min", foot: "of 99 h scheduled · 11 days worked" },
      { id: "pay", label: "Last net pay", value: "RWF 386,560", foot: "September 2026 · paid 30 Sep" },
    ],
    shifts: [
      { id: "2026-10-19", date: "2026-10-19", day: "Mon 19 Oct", time: "08:00 – 17:00", name: "Office", today: false },
      { id: "2026-10-20", date: "2026-10-20", day: "Tue 20 Oct", time: "08:00 – 17:00", name: "Office", today: false },
    ],
    payslips: [
      {
        id: "sep",
        period: "2026-09",
        month: "September 2026",
        gross: 550000,
        net: 386560,
        paid: "Paid 30 Sep",
        tone: "success",
      },
    ],
    claims: [],
    loans: [],
    balances: [
      { id: "annual", name: "Annual leave", days: 14, foot: "Available" },
      { id: "sick", name: "Sick leave", days: null, foot: "No fixed balance" },
    ],
    leaveTypes: [
      { id: "annual", name: "Annual leave" },
      { id: "sick", name: "Sick leave" },
    ],
    requests: [],
    month: {
      label: "October 2026",
      daysWorked: 11,
      worked: "92 h 30 min",
      expected: "99 h",
      late: 0,
      overtime: "0 h",
    },
    records: [],
    documents: [
      {
        id: "id",
        title: "National ID copy",
        meta: "Verified by HR",
        chip: "Verified",
        tone: "success",
        canSend: false,
      },
    ],
    tasks: [],
    kioskPin: { hasPin: true, setOn: "3 Mar 2026" },
  },
];

export const fixtures = {
  // InviteAccept
  "shared.invitations": invitations,
  "shared.invitationStates": invitationStates,
  "shared.roleScopes": roleScopes,
  // Register
  "shared.businessTypes": businessTypes,
  "shared.registrationSteps": registrationSteps,
  "shared.registrationDocuments": registrationDocuments,
  "shared.acquisitionChannels": acquisitionChannels,
  "shared.registrationClassFields": registrationClassFields,
  "shared.registrationGeoFields": registrationGeoFields,
  "shared.registrationApplications": registrationApplications,
  "shared.registrationFeeSchedule": registrationFeeSchedule,
  "shared.registrationClaimSteps": registrationClaimSteps,
  "shared.registrationAfterSteps": registrationAfterSteps,
  // Onboarding
  "shared.setupItems": setupItems,
  "shared.goLiveGates": goLiveGates,
  // Me
  "shared.myHr": myHr,
  // Account
  "shared.accountIdentities": accountIdentities,
  "shared.profileFields": profileFields,
  "shared.signInMethods": signInMethods,
  "shared.accountSessions": accountSessions,
  "shared.kycChecks": kycChecks,
  "shared.kycStates": kycStates,
  "shared.accountWorkspaces": accountWorkspaces,
  "shared.notificationCategories": notificationCategories,
  "shared.privacyRights": privacyRights,
  "shared.dataRequests": dataRequests,
  "shared.personalFiles": personalFiles,
  // GlobalSearch
  "shared.deskFigures": deskFigures,
  "shared.deskArrivals": deskArrivals,
  "shared.searchEntries": searchEntries,
  "shared.recentSearches": recentSearches,
  // Notifications
  "shared.inboxFigures": inboxFigures,
  "shared.inboxTasks": inboxTasks,
  "shared.inboxNotifications": inboxNotifications,
  // StatesGallery
  "shared.paymentStates": paymentStates,
  "shared.fiscalStates": fiscalStates,
  "shared.submissionSteps": submissionSteps,
  "shared.submissionOutcomes": submissionOutcomes,
  "shared.checkoutEvidence": checkoutEvidence,
  "shared.writeOffReasons": writeOffReasons,
  "shared.makerCheckerRequests": makerCheckerRequests,
  "shared.bulkRooms": bulkRooms,
  // AccessDenied
  "shared.accessDenials": accessDenials,
  "shared.accessAlternatives": accessAlternatives,
  "shared.dataExports": dataExports,
  "shared.exportPurposes": exportPurposes,
  "shared.exportHistory": exportHistory,
} satisfies FixtureSet;
