"use client";

import { Description, FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  addDays,
  addMonths,
  dueDayFromStart,
  EARLIEST_RECORD_DATE,
  earliestLeaseStart,
  emailTypoMessage,
  type IdKind,
  LEASE_NOTICE_MAX_DAYS,
  LEASE_NOTICE_MIN_DAYS,
  type LeaseDefaults,
  type LeaseTermsView,
  leaseDatesProblem,
  longestLeaseEnd,
  MAX_GRACE_DAYS,
  MAX_OCCUPANTS,
  ordinal,
  PersonName,
  RWANDA_CODE,
  shortestLeaseEnd,
  suggestEmailFix,
  TenantInput,
} from "@injishi/contracts";
import {
  ActionButton,
  BoundedDatePicker,
  CountrySelect,
  EmailInput,
  IconAction,
  MoneyInput,
  PhoneInput,
  SelectField,
} from "@injishi/ui";
import { CountInput, SwitchRow, TextInput } from "../rentals/fields";

// --- The tenant ------------------------------------------------------------------------

export interface TenantDraft {
  fullName: string;
  email: string;
  /** The person said the address is right though it looks like a typo. */
  keepEmail: boolean;
  phone: string | null;
  phoneText: string;
  idKind: IdKind;
  idNumber: string;
  nationality: string | null;
}

export const emptyTenant = (): TenantDraft => ({
  fullName: "",
  email: "",
  keepEmail: false,
  phone: null,
  phoneText: "",
  idKind: "national_id",
  idNumber: "",
  nationality: RWANDA_CODE,
});

export function tenantBody(t: TenantDraft) {
  return {
    fullName: t.fullName,
    email: t.email,
    phone: t.phone ?? t.phoneText,
    idKind: t.idKind,
    idNumber: t.idNumber,
    nationality: t.nationality ?? "",
  };
}

/** What is wrong with a new tenant's details, by field, in the schema's words (the API checks again). */
export function tenantProblems(t: TenantDraft): Record<string, string> {
  const out: Record<string, string> = {};
  const parsed = TenantInput.safeParse(tenantBody(t));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!out[key]) out[key] = issue.message;
    }
  }
  if (!t.nationality) out.nationality = "Pick their nationality.";
  const fix = suggestEmailFix(t.email);
  if (!out.email && fix && !t.keepEmail) out.emailTypo = emailTypoMessage(fix);
  return out;
}

/** The tenant's details: as their ID names them, and the email the invitation goes to. */
export function TenantFields({
  tenant,
  onChange,
  errors,
}: {
  tenant: TenantDraft;
  onChange: (next: TenantDraft) => void;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof TenantDraft>(key: K, value: TenantDraft[K]) => onChange({ ...tenant, [key]: value });
  const abroad = (tenant.nationality ?? RWANDA_CODE) !== RWANDA_CODE;
  return (
    <div className="flex flex-col gap-4">
      <TextInput
        label="Full name"
        name="fullName"
        value={tenant.fullName}
        onChange={(v) => set("fullName", v)}
        description="As on their ID. They type it to sign."
        errorMessage={errors.fullName}
        isRequired
      />
      <EmailInput
        label="Email"
        name="email"
        value={tenant.email}
        onChange={(v) => onChange({ ...tenant, email: v, keepEmail: false })}
        onTypoChange={(t) => (t.kept !== tenant.keepEmail ? set("keepEmail", t.kept) : undefined)}
        description="The invitation to read and sign goes here."
        errorMessage={errors.email}
        isRequired
      />
      <PhoneInput
        label="Phone"
        name="phone"
        value={tenant.phone}
        onChange={(e164, text) => onChange({ ...tenant, phone: e164, phoneText: text })}
        errorMessage={errors.phone}
        isRequired
      />
      <CountrySelect
        label="Nationality"
        name="nationality"
        value={tenant.nationality}
        onChange={(code) =>
          onChange({
            ...tenant,
            nationality: code,
            idKind: code && code !== RWANDA_CODE ? "passport" : tenant.idKind,
          })
        }
        errorMessage={errors.nationality}
        isRequired
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">ID document</span>
        {abroad ? null : (
          <Segment
            aria-label="ID document"
            selectedKey={tenant.idKind}
            onSelectionChange={(k) => set("idKind", k === "passport" ? "passport" : "national_id")}
            className="w-fit"
          >
            <Segment.Item id="national_id">National ID</Segment.Item>
            <Segment.Item id="passport">Passport</Segment.Item>
          </Segment>
        )}
        <TextField
          name="idNumber"
          aria-label={abroad || tenant.idKind === "passport" ? "Passport number" : "National ID number"}
          value={tenant.idNumber}
          onChange={(v) => set("idNumber", v)}
          isInvalid={errors.idNumber ? true : undefined}
          fullWidth
          className="gap-1"
        >
          <Input
            placeholder={abroad || tenant.idKind === "passport" ? "Passport number" : "16 digits"}
            inputMode={!abroad && tenant.idKind === "national_id" ? "numeric" : "text"}
            autoComplete="off"
          />
          <Description>The contract names it.</Description>
          <FieldError>{errors.idNumber}</FieldError>
        </TextField>
      </div>
    </div>
  );
}

// --- The terms -------------------------------------------------------------------------

export interface TermsDraft {
  startDate: string | null;
  endDate: string | null;
  /** A tenant already living there when the lease comes onto Injishi: billing starts later. */
  movedIn: boolean;
  billingStartsOn: string | null;
  monthlyRentRwf: number | null;
  depositRwf: number | null;
  rentDueDay: number | null;
  graceDays: number | null;
  noticeDays: number | null;
  occupants: string[];
  otherTerms: string;
}

/** A new lease's terms, from the unit's asking figures and the landlord's lease defaults. */
export function newTerms(
  unit: { askingRentRwf: number | null; askingDepositRwf: number | null } | null,
  defaults: LeaseDefaults | null,
): TermsDraft {
  return {
    startDate: null,
    endDate: null,
    movedIn: false,
    billingStartsOn: null,
    monthlyRentRwf: unit?.askingRentRwf ?? null,
    depositRwf: unit?.askingDepositRwf ?? null,
    rentDueDay: defaults?.rentDueDay ?? null,
    graceDays: defaults?.graceDays ?? 5,
    noticeDays: defaults?.noticeDays ?? LEASE_NOTICE_MIN_DAYS,
    occupants: [],
    otherTerms: "",
  };
}

/** A lease's terms as they stand, for the edit form. */
export function termsOf(t: LeaseTermsView): TermsDraft {
  const movedIn = t.billingStartsOn > t.startDate;
  return {
    startDate: t.startDate,
    endDate: t.endDate,
    movedIn,
    billingStartsOn: movedIn ? t.billingStartsOn : null,
    monthlyRentRwf: t.monthlyRentRwf,
    depositRwf: t.depositRwf,
    rentDueDay: t.rentDueDay,
    graceDays: t.graceDays,
    noticeDays: t.noticeDays,
    occupants: [...t.occupants],
    otherTerms: t.otherTerms ?? "",
  };
}

/** The terms as the API takes them. */
export function termsBody(t: TermsDraft) {
  const start = t.startDate ?? "";
  return {
    startDate: start,
    endDate: t.endDate ?? "",
    billingStartsOn: t.movedIn ? (t.billingStartsOn ?? "") : null,
    monthlyRentRwf: t.monthlyRentRwf ?? 0,
    depositRwf: t.depositRwf ?? 0,
    rentDueDay: t.rentDueDay ?? (start ? dueDayFromStart(start) : 1),
    graceDays: t.graceDays ?? 0,
    noticeDays: t.noticeDays ?? LEASE_NOTICE_MIN_DAYS,
    occupants: t.occupants.map((o) => o.trim()).filter(Boolean),
    otherTerms: t.otherTerms.trim() || null,
  };
}

/** What is wrong with the dates and money, by field (`terms.startDate` and so on, as the API names them). */
export function termsProblems(t: TermsDraft, today: string, opts: { isNew: boolean }): Record<string, string> {
  const out: Record<string, string> = {};
  if (!t.startDate) out["terms.startDate"] = "Pick a start date.";
  if (!t.endDate) out["terms.endDate"] = "Pick an end date.";
  if (t.movedIn && !t.billingStartsOn) out["terms.billingStartsOn"] = "Pick the day billing starts here.";
  if (t.startDate && t.endDate && (!t.movedIn || t.billingStartsOn)) {
    const dates = { startDate: t.startDate, endDate: t.endDate, billingStartsOn: t.movedIn ? t.billingStartsOn : null };
    // An edit keeps a start date already in the past: only the end and billing rules apply to it.
    const problem = leaseDatesProblem(dates, opts.isNew ? today : t.startDate < today ? t.startDate : today);
    if (problem) out[`terms.${problem.path}`] = problem.message;
  }
  if (!t.monthlyRentRwf || t.monthlyRentRwf <= 0) out["terms.monthlyRentRwf"] = "Enter the rent a month.";
  if (t.depositRwf === null || t.depositRwf < 0) out["terms.depositRwf"] = "Enter the deposit, or 0.";
  if (t.graceDays === null || t.graceDays < 0 || t.graceDays > MAX_GRACE_DAYS) {
    out["terms.graceDays"] = `Pick from 0 to ${MAX_GRACE_DAYS} days.`;
  }
  if (t.noticeDays === null || t.noticeDays < LEASE_NOTICE_MIN_DAYS || t.noticeDays > LEASE_NOTICE_MAX_DAYS) {
    out["terms.noticeDays"] = `Notice is ${LEASE_NOTICE_MIN_DAYS} to ${LEASE_NOTICE_MAX_DAYS} days.`;
  }
  return out;
}

/** What is wrong with the people living there and the other terms. */
export function occupantProblems(t: TermsDraft): Record<string, string> {
  const out: Record<string, string> = {};
  const names = t.occupants.map((o) => o.trim());
  names.forEach((name, i) => {
    if (!name) return;
    const parsed = PersonName.safeParse(name);
    if (!parsed.success) out[`terms.occupants.${i}`] = parsed.error.issues[0]?.message ?? "Enter the full name.";
    else if (names.findIndex((n) => n.toLowerCase() === name.toLowerCase()) !== i) {
      out[`terms.occupants.${i}`] = "Each person once.";
    }
  });
  if (t.otherTerms.trim().length > 2000) out["terms.otherTerms"] = "Keep other terms under 2000 characters.";
  return out;
}

const DUE_DAYS = Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: `The ${ordinal(i + 1)}` }));

/** The end a lease of `months` from `start` has: the day before the same date that many months on. */
export const endAfter = (start: string, months: number): string => addDays(addMonths(start, months), -1);

/** The dates, the money and the days the lease runs on. */
export function TermsFields({
  terms,
  onChange,
  errors,
  today,
  autoStart,
  isNew,
}: {
  terms: TermsDraft;
  onChange: (next: TermsDraft) => void;
  errors: Record<string, string>;
  today: string;
  /** The landlord lets Injishi start a signed lease on its start date. */
  autoStart: boolean;
  isNew: boolean;
}) {
  const set = <K extends keyof TermsDraft>(key: K, value: TermsDraft[K]) => onChange({ ...terms, [key]: value });
  const startMin = terms.movedIn ? EARLIEST_RECORD_DATE : isNew ? earliestLeaseStart(today) : null;
  const endMin = terms.startDate ? shortestLeaseEnd(terms.startDate) : null;
  const endMax = terms.startDate ? longestLeaseEnd(terms.startDate) : null;
  const billingMin =
    terms.startDate && terms.startDate > earliestLeaseStart(today) ? terms.startDate : earliestLeaseStart(today);
  const billingMax = terms.endDate ? addDays(terms.endDate, -1) : null;
  const dueDay = terms.rentDueDay ?? (terms.startDate ? dueDayFromStart(terms.startDate) : null);
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow
        label="The tenant already lives there"
        description="A tenancy that began before Injishi. Rent is charged here from the day you pick."
        isSelected={terms.movedIn}
        onChange={(on) => onChange({ ...terms, movedIn: on, billingStartsOn: on ? terms.billingStartsOn : null })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <BoundedDatePicker
          label="Starts"
          name="terms.startDate"
          value={terms.startDate}
          onChange={(d) => {
            // A new start keeps an end that still fits; else it suggests a year.
            const fits =
              d && terms.endDate && terms.endDate >= shortestLeaseEnd(d) && terms.endDate <= longestLeaseEnd(d);
            onChange({ ...terms, startDate: d, endDate: d ? (fits ? terms.endDate : endAfter(d, 12)) : terms.endDate });
          }}
          minValue={startMin}
          description={terms.movedIn ? "The day they moved in" : "Up to 30 days ago"}
          errorMessage={errors["terms.startDate"]}
          isRequired
        />
        <BoundedDatePicker
          label="Ends"
          name="terms.endDate"
          value={terms.endDate}
          onChange={(d) => set("endDate", d)}
          minValue={endMin}
          maxValue={endMax}
          isDisabled={!terms.startDate}
          description={terms.startDate ? "At least a month, at most 10 years" : "Pick the start first"}
          errorMessage={errors["terms.endDate"]}
          isRequired
        />
      </div>
      {terms.startDate ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Runs for</span>
          {[6, 12, 24].map((m) => (
            <ActionButton
              key={m}
              size="sm"
              intent={terms.endDate === endAfter(terms.startDate as string, m) ? "primary" : "ghost"}
              onPress={() => set("endDate", endAfter(terms.startDate as string, m))}
            >
              {m === 6 ? "6 months" : m === 12 ? "1 year" : "2 years"}
            </ActionButton>
          ))}
        </div>
      ) : null}
      {terms.movedIn ? (
        <BoundedDatePicker
          label="Billing starts here"
          name="terms.billingStartsOn"
          value={terms.billingStartsOn}
          onChange={(d) => set("billingStartsOn", d)}
          minValue={billingMin}
          maxValue={billingMax}
          description="Up to 30 days ago. Rent before it is not charged on Injishi."
          errorMessage={errors["terms.billingStartsOn"]}
          isRequired
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyInput
          label="Rent a month"
          name="terms.monthlyRentRwf"
          value={terms.monthlyRentRwf}
          onChange={(v) => set("monthlyRentRwf", v)}
          minValue={1}
          errorMessage={errors["terms.monthlyRentRwf"]}
          isRequired
        />
        <MoneyInput
          label="Deposit"
          name="terms.depositRwf"
          value={terms.depositRwf}
          onChange={(v) => set("depositRwf", v)}
          description="You hold it. 0 for none."
          errorMessage={errors["terms.depositRwf"]}
          isRequired
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Rent is due on"
          name="terms.rentDueDay"
          options={DUE_DAYS}
          value={dueDay === null ? null : String(dueDay)}
          onChange={(v) => set("rentDueDay", Number(v))}
          description="Of each month"
          errorMessage={errors["terms.rentDueDay"]}
        />
        <CountInput
          label="Late after"
          name="terms.graceDays"
          value={terms.graceDays}
          onChange={(v) => set("graceDays", v)}
          minValue={0}
          maxValue={MAX_GRACE_DAYS}
          unit="days"
          description="Grace after the due day"
          errorMessage={errors["terms.graceDays"]}
        />
        <CountInput
          label="Notice"
          name="terms.noticeDays"
          value={terms.noticeDays}
          onChange={(v) => set("noticeDays", v)}
          minValue={LEASE_NOTICE_MIN_DAYS}
          maxValue={LEASE_NOTICE_MAX_DAYS}
          unit="days"
          description={`At least ${LEASE_NOTICE_MIN_DAYS} days`}
          errorMessage={errors["terms.noticeDays"]}
        />
      </div>
      <p className="text-xs text-muted">
        {autoStart
          ? "Once both have signed, Injishi starts the tenancy on its start date."
          : "Once both have signed, you start the tenancy yourself."}
      </p>
    </div>
  );
}

/** The people living in the home with the tenant, and anything else agreed. */
export function OccupantsFields({
  terms,
  onChange,
  errors,
}: {
  terms: TermsDraft;
  onChange: (next: TermsDraft) => void;
  errors: Record<string, string>;
}) {
  const occupants = terms.occupants;
  const setOccupant = (i: number, v: string) =>
    onChange({ ...terms, occupants: occupants.map((o, j) => (j === i ? v : o)) });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Who else lives there</span>
          <span className="text-xs text-muted">
            The contract names them. Leave it empty when the tenant lives alone.
          </span>
        </div>
        {occupants.map((name, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, by position
          <div key={i} className="flex items-start gap-2">
            <TextField
              aria-label={`Person ${i + 1}`}
              value={name}
              onChange={(v) => setOccupant(i, v)}
              isInvalid={errors[`terms.occupants.${i}`] ? true : undefined}
              fullWidth
              className="gap-1"
            >
              <Input placeholder="Full name" autoComplete="off" />
              <FieldError>{errors[`terms.occupants.${i}`]}</FieldError>
            </TextField>
            <IconAction
              icon="TrashBin"
              label={`Remove ${name.trim() || `person ${i + 1}`}`}
              intent="danger"
              size="md"
              onPress={() => onChange({ ...terms, occupants: occupants.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        {occupants.length < MAX_OCCUPANTS ? (
          <ActionButton
            icon="PersonPlus"
            size="sm"
            className="self-start"
            onPress={() => onChange({ ...terms, occupants: [...occupants, ""] })}
          >
            Add a person
          </ActionButton>
        ) : (
          <p className="text-xs text-muted">At most {MAX_OCCUPANTS} people.</p>
        )}
      </div>
      <TextField
        name="terms.otherTerms"
        value={terms.otherTerms}
        onChange={(v) => onChange({ ...terms, otherTerms: v })}
        isInvalid={errors["terms.otherTerms"] ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>Other terms</Label>
        <TextArea rows={4} placeholder="Anything else you both agree to" />
        <Description>Pets, parking, who pays water and power. Optional.</Description>
        <FieldError>{errors["terms.otherTerms"]}</FieldError>
      </TextField>
    </div>
  );
}
