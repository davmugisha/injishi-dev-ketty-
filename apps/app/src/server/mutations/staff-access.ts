/**
 * Putting a person on file, with everything HR keeps about them, and their Injishi login (HR
 * onboarding). Plain functions over the API, like the other people writes; every refusal is the
 * API's (an ApiError), or a StaffInputError for what the form itself can tell.
 *
 * The file and the login stay two things. The file is written first; its details, contract, pay
 * account, kiosk PIN and login follow, and each answers for itself, so a refused contract never
 * undoes a file that was written: the person is told what was saved and what is left to do.
 */
import type { EmployeeAccessView } from "@injishi/data/fixtures/people";
import type {
  AccessInput,
  EmployeePersonalView,
  NewEmployeeInput,
  Registered,
  RegisterOutcome,
} from "@injishi/product-hr";
import { type ApiEmployeeAccess, ROLE_LABEL, toAccessView } from "../access-view";
import { ApiError } from "../api";
import { NoWorkspaceError, type ScopedApi, type SourceContext } from "../sources/types";
import { businesses, inOwningBusiness } from "./people";

export type { AccessInput, NewEmployeeInput, Registered, RegisterOutcome };

/** A mistake the form can name before anything reaches the API. */
export class StaffInputError extends Error {}

// ── One file's login ────────────────────────────────────────────────────────────────────────────

const access = (id: string) => `/api/v1/ops/employees/${encodeURIComponent(id)}/access`;

/** Where the file's login stands (`GET /ops/employees/:id/access`), in whichever business keeps it. */
export async function readAccess(ctx: SourceContext, employeeId: string): Promise<EmployeeAccessView> {
  return toAccessView(await inOwningBusiness(ctx, (api) => api.get<ApiEmployeeAccess>(access(employeeId))));
}

function accessBody(input: AccessInput) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StaffInputError("Enter the email address the login is for.");
  if (input.branchIds && input.branchIds.length === 0)
    throw new StaffInputError("Choose at least one branch, or every branch.");
  return { email, orgRole: input.role, branchIds: input.branchIds, note: input.note.trim() || null };
}

/** Give the file its login, or ask the owner for one (`POST /ops/employees/:id/access`). */
export async function giveAccess(
  ctx: SourceContext,
  employeeId: string,
  input: AccessInput,
): Promise<{ outcome: "invited" | "requested"; access: EmployeeAccessView }> {
  const body = accessBody(input);
  const result = await inOwningBusiness(ctx, (api) =>
    api.post<{ outcome: "invited" | "requested"; access: ApiEmployeeAccess }>(access(employeeId), body),
  );
  return { outcome: result.outcome, access: toAccessView(result.access) };
}

/** Take back an open invitation or a request still with the owner (`POST …/access/cancel`). */
export async function cancelAccess(ctx: SourceContext, employeeId: string): Promise<EmployeeAccessView> {
  return toAccessView(
    await inOwningBusiness(ctx, (api) => api.post<ApiEmployeeAccess>(`${access(employeeId)}/cancel`, {})),
  );
}

// ── The owner decides ───────────────────────────────────────────────────────────────────────────

/** Every business the person manages the team of: the owner's. */
function teamBusinesses(ctx: SourceContext): ScopedApi[] {
  return businesses(ctx).filter((api) => api.workspace.permissions.includes("team.manage"));
}

/**
 * Approve a login HR asked for (its invitation is sent now), or decline it with a reason HR reads
 * (`POST /ops/team/access-requests/:id/approve|decline`), in whichever business it belongs to.
 */
export async function decideAccessRequest(
  ctx: SourceContext,
  id: string,
  decision: "approve" | "decline",
  note: string,
): Promise<void> {
  if (decision === "decline" && note.trim().length < 3)
    throw new StaffInputError("Say why, so HR can tell the person.");
  const apis = teamBusinesses(ctx);
  if (apis.length === 0) throw new NoWorkspaceError("hospitality");
  let last: unknown = null;
  for (const api of apis) {
    try {
      await api.post(
        `/api/v1/ops/team/access-requests/${encodeURIComponent(id)}/${decision}`,
        decision === "decline" ? { note: note.trim() } : {},
      );
      return;
    } catch (error) {
      if (error instanceof ApiError && error.notFound) {
        last = error;
        continue;
      }
      throw error;
    }
  }
  throw last ?? new StaffInputError("That request is not open any more.");
}

// ── A new employee ──────────────────────────────────────────────────────────────────────────────

const digits = (s: string) => s.replace(/[^0-9]/g, "");
const orNull = (s: string) => (s.trim() ? s.trim() : null);

function employerApi(ctx: SourceContext, employerId: string): ScopedApi {
  const api = businesses(ctx).find((a) => a.workspace.workspaceId === employerId);
  if (!api) throw new StaffInputError("Choose the business that employs this person.");
  return api;
}

/** The form's own checks, in the order a person meets them. */
function checkInput(input: NewEmployeeInput): void {
  const p = input.personal;
  if (p.legalName.trim().length < 2) throw new StaffInputError("Enter the full name as it is on the ID.");
  if (!p.sex) throw new StaffInputError("Choose the person's sex, as on the ID.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth)) throw new StaffInputError("Enter the date of birth.");
  if (p.idNumber.trim().length < 3) throw new StaffInputError("Enter the ID or passport number.");
  if (!p.phone.trim()) throw new StaffInputError("Enter a mobile number.");
  if (!input.job.branchId) throw new StaffInputError("Choose the branch the person works at.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.job.hiredOn)) throw new StaffInputError("Enter the start date.");
  const c = input.contract;
  if (c.type) {
    if (!(Number(digits(c.wage)) > 0)) throw new StaffInputError("Enter the wage, in francs.");
    if (c.type === "fixed_term" && !/^\d{4}-\d{2}-\d{2}$/.test(c.endsOn))
      throw new StaffInputError("A fixed-term contract needs its end date.");
  }
  if (input.payment.method === "bank" && (!input.payment.bankName || !digits(input.payment.accountNumber)))
    throw new StaffInputError("Choose the bank and enter the account number.");
  if (input.payment.method === "momo" && !input.payment.momoPhone.trim())
    throw new StaffInputError("Enter the mobile money number.");
  if (input.access.kioskPin && !/^\d{4,6}$/.test(input.access.kioskPin))
    throw new StaffInputError("A kiosk PIN is 4 to 6 digits.");
  if (input.access.login) accessBody(loginOf(input));
}

function loginOf(input: NewEmployeeInput): AccessInput {
  return {
    email: input.access.email || input.personal.email,
    role: input.access.role,
    branchIds: input.access.allBranches ? null : input.access.branchIds,
    note: input.access.note,
  };
}

/** Run one part after the file exists; a refusal is reported, never thrown. */
async function part(
  outcomes: RegisterOutcome[],
  name: RegisterOutcome["part"],
  done: string,
  run: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await run();
    outcomes.push({ part: name, ok: true, detail: done });
    return true;
  } catch (error) {
    if (error instanceof ApiError || error instanceof StaffInputError) {
      outcomes.push({ part: name, ok: false, detail: error.message });
      return false;
    }
    throw error;
  }
}

/**
 * Put a person on file at their employer, then everything that goes with it:
 *
 * 1. `POST /ops/employees`: the file (name, ID, birth date, phone, branch, position, manager, start);
 * 2. `PATCH /ops/employees/:id`: family, emergency contact and employee type, when given;
 * 3. `POST …/contracts`: the contract and wage, when given;
 * 4. `POST …/pay-accounts`: where the salary is paid, when given;
 * 5. `PUT …/kiosk-pin`: the clock-in PIN, when given;
 * 6. `POST …/access`: the login, sent at once or asked of the owner, when wanted;
 * 7. `POST /ops/candidates/:id/stage`: the hire this file is for, named on it, when it came from Talent.
 *
 * A refusal of step 1 is the whole answer (nothing was written). Any later refusal leaves the file
 * as written and says which part to finish on it.
 */
export async function registerEmployee(ctx: SourceContext, input: NewEmployeeInput): Promise<Registered> {
  checkInput(input);
  const api = employerApi(ctx, input.employerId);
  const p = input.personal;
  const j = input.job;
  const created = await api.post<{ id: string; employeeNumber: string; displayName: string }>("/api/v1/ops/employees", {
    legalName: p.legalName.trim(),
    preferredName: orNull(p.preferredName),
    phone: p.phone.trim(),
    email: orNull(p.email)?.toLowerCase() ?? null,
    dateOfBirth: p.dateOfBirth,
    sex: p.sex,
    idDocumentType: p.idType,
    idDocumentNumber: p.idNumber.trim(),
    hiredOn: j.hiredOn,
    workPropertyId: j.branchId,
    ...(j.employeeNumber.trim() ? { employeeNumber: j.employeeNumber.trim() } : {}),
    rssbNumber: orNull(input.contract.rssbNumber),
    reportingManagerId: j.managerId || null,
    jobPositionId: j.positionId || null,
  });
  const id = encodeURIComponent(created.id);
  const outcomes: RegisterOutcome[] = [];

  // First, so a refusal further down never leaves Talent offering to make this file a second time.
  if (input.candidateId) {
    await part(outcomes, "candidate", "Linked to their hiring record", () =>
      api.post(`/api/v1/ops/candidates/${encodeURIComponent(input.candidateId as string)}/stage`, {
        stage: "hired",
        hiredEmployeeId: created.id,
      }),
    );
  }

  const details: Record<string, unknown> = {};
  if (p.maritalStatus) details.maritalStatus = p.maritalStatus;
  if (p.childrenCount.trim()) details.childrenCount = Number(digits(p.childrenCount));
  if (p.emergencyName.trim()) details.emergencyName = p.emergencyName.trim();
  if (p.emergencyPhone.trim()) details.emergencyPhone = p.emergencyPhone.trim();
  if (p.emergencyRelation.trim()) details.emergencyRelation = p.emergencyRelation.trim();
  if (j.employeeTypeId) details.employeeTypeId = j.employeeTypeId;
  if (p.street.trim()) details.street = p.street.trim();
  if (p.villageId) details.villageId = p.villageId;
  if (p.qualification.trim()) details.qualification = p.qualification.trim();
  if (p.experienceYears.trim()) details.priorExperienceYears = Number(digits(p.experienceYears));
  if (Object.keys(details).length > 0) {
    const saved = [
      p.street.trim() || p.villageId ? "home address" : null,
      p.maritalStatus || p.childrenCount.trim() ? "family" : null,
      p.emergencyName.trim() || p.emergencyPhone.trim() ? "emergency contact" : null,
      p.qualification.trim() || p.experienceYears.trim() ? "background" : null,
      j.employeeTypeId ? "employee type" : null,
    ].filter((x): x is string => x !== null);
    const words = saved.length > 1 ? `${saved.slice(0, -1).join(", ")} and ${saved.at(-1)}` : (saved[0] ?? "details");
    await part(outcomes, "details", `${words.charAt(0).toUpperCase()}${words.slice(1)} saved`, () =>
      api.patch(`/api/v1/ops/employees/${id}`, details),
    );
  }

  const c = input.contract;
  if (c.type) {
    const wage = Number(digits(c.wage));
    const per = c.wageBasis === "monthly" ? "a month" : c.wageBasis === "daily" ? "a day" : "an hour";
    await part(outcomes, "contract", `Contract recorded · RWF ${wage.toLocaleString("en-US")} ${per}`, () =>
      api.post(`/api/v1/ops/employees/${id}/contracts`, {
        contractType: c.type,
        startsOn: j.hiredOn,
        endsOn: c.type === "fixed_term" ? c.endsOn : null,
        wageBasis: c.wageBasis,
        wageRwf: wage,
        noticeDays: c.noticeDays.trim() ? Number(digits(c.noticeDays)) : null,
      }),
    );
  }

  const pay = input.payment;
  if (pay.method === "bank") {
    await part(outcomes, "payment", `Salary paid to ${pay.bankName}`, () =>
      api.post(`/api/v1/ops/employees/${id}/pay-accounts`, {
        kind: "bank",
        bankName: pay.bankName,
        accountNumber: pay.accountNumber.trim(),
        makePrimary: true,
      }),
    );
  } else if (pay.method === "momo") {
    await part(outcomes, "payment", "Salary paid by mobile money", () =>
      api.post(`/api/v1/ops/employees/${id}/pay-accounts`, {
        kind: "momo",
        momoPhone: pay.momoPhone.trim(),
        makePrimary: true,
      }),
    );
  }

  if (input.access.kioskPin) {
    await part(outcomes, "pin", "Kiosk PIN set for clocking in", () =>
      api.put(`/api/v1/ops/employees/${id}/kiosk-pin`, { pin: input.access.kioskPin }),
    );
  }

  let login: Registered["login"] = null;
  if (input.access.login) {
    const wanted = loginOf(input);
    const role = ROLE_LABEL[wanted.role] ?? wanted.role;
    try {
      const result = await api.post<{ outcome: "invited" | "requested" }>(
        `/api/v1/ops/employees/${id}/access`,
        accessBody(wanted),
      );
      login = result.outcome;
      outcomes.push({
        part: "login",
        ok: true,
        detail:
          result.outcome === "invited"
            ? `${role} login sent to ${wanted.email.trim().toLowerCase()}`
            : `${role} login waiting for the owner's approval`,
      });
    } catch (error) {
      if (!(error instanceof ApiError || error instanceof StaffInputError)) throw error;
      outcomes.push({ part: "login", ok: false, detail: error.message });
    }
  }

  return {
    employeeId: created.id,
    employeeNumber: created.employeeNumber,
    name: created.displayName,
    outcomes,
    login,
  };
}

interface ApiFullEmployee {
  view: "basic" | "full";
  phone?: string | null;
  email?: string | null;
  sex?: "female" | "male" | null;
  dateOfBirth?: string | null;
  idDocumentType?: "national_id" | "passport" | null;
  idDocumentNumber?: string | null;
  rssbNumber?: string | null;
  maritalStatus?: "single" | "married" | "divorced" | "widowed" | null;
  childrenCount?: number | null;
  address?: {
    villageName: string;
    cellName: string;
    sectorName: string;
    districtName: string;
    street: string | null;
  } | null;
  emergencyContact?: { name: string; phone: string | null; relation: string | null } | null;
}

const MARITAL_WORD: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
};
const MONTH_WORD = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A file's personal details for its Personal tab (`GET /ops/employees/:id`), in words. */
export async function readPersonal(ctx: SourceContext, employeeId: string): Promise<EmployeePersonalView> {
  const api = ctx.ops("hospitality");
  const { employee: e } = await api.get<{ employee: ApiFullEmployee }>(
    `/api/v1/ops/employees/${encodeURIComponent(employeeId)}`,
  );
  const none = "Not recorded";
  const contacts = [
    { label: "Mobile", value: e.phone || none },
    { label: "Email", value: e.email || none },
  ];
  if (e.view !== "full") return { full: false, rows: contacts };
  const born = e.dateOfBirth
    ? (() => {
        const [y, m, d] = e.dateOfBirth.split("-").map(Number);
        const today = ctx.today.iso;
        const age = Number(today.slice(0, 4)) - y - (today.slice(5) < e.dateOfBirth.slice(5) ? 1 : 0);
        return `${d} ${MONTH_WORD[m - 1]} ${y} · ${age} years`;
      })()
    : none;
  const lives = e.address
    ? [e.address.street, e.address.villageName, e.address.cellName, e.address.sectorName, e.address.districtName]
        .filter(Boolean)
        .join(", ")
    : none;
  const ec = e.emergencyContact;
  return {
    full: true,
    rows: [
      { label: "Born", value: born },
      { label: "Sex", value: e.sex === "male" ? "Male" : e.sex === "female" ? "Female" : none },
      {
        label: e.idDocumentType === "passport" ? "Passport" : "National ID",
        value: e.idDocumentNumber || none,
      },
      ...contacts,
      { label: "Lives in", value: lives },
      {
        label: "Family",
        value:
          [
            e.maritalStatus ? MARITAL_WORD[e.maritalStatus] : null,
            e.childrenCount ? `${e.childrenCount} ${e.childrenCount === 1 ? "child" : "children"}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || none,
      },
      {
        label: "Emergency contact",
        value: ec ? [ec.name, ec.relation ? `(${ec.relation})` : null, ec.phone].filter(Boolean).join(" ") : none,
      },
      { label: "RSSB number", value: e.rssbNumber || none },
    ],
  };
}
