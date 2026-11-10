"use client";

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CircleCheckFill,
  CircleExclamationFill,
  Clock,
  CreditCard,
  Envelope,
  Hourglass,
  PersonPlus,
  Smartphone,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Switch,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { NativeSelect, RadioButtonGroup, Segment, Stepper } from "@heroui-pro/react";
import { HoloCard } from "@heroui-pro/react/holo-card";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { NumberValue } from "@heroui-pro/react/number-value";
import { formatRwf, LinkButton, PageContent, PageHeader, type PlaceChain, PlacePicker, placeLine } from "@injishi/ui";
import { type ReactNode, useState, useTransition } from "react";
import type { NewEmployeeInput, Registered } from "../../model/commands.ts";
import type { PayrollContributionList } from "../../model/payroll.ts";
import type { NewEmployeeForm } from "../../model/people.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { simulatePay } from "../payroll/pay-calc";
import { type AccessDraft, AccessPicker, accessErrors, emptyAccess } from "./access-picker";
import { initials } from "./parts";

const STEPS = [
  { id: "personal", title: "Personal details", hint: "Identity, contacts, next of kin" },
  { id: "job", title: "Job", hint: "Branch, position, manager, start" },
  { id: "pay", title: "Salary and contract", hint: "Salary, contract, payment" },
  { id: "access", title: "System access", hint: "Login, permissions, kiosk PIN" },
  { id: "review", title: "Review", hint: "Check and create" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

type Personal = NewEmployeeInput["personal"];
type Job = NewEmployeeInput["job"];
type Contract = NewEmployeeInput["contract"];
type Payment = NewEmployeeInput["payment"];
type Errors = Record<string, string>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const digits = (s: string) => s.replace(/[^0-9]/g, "");
const MARITAL: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
};
const CONTRACT: Record<string, string> = { permanent: "Permanent", fixed_term: "Fixed-term", casual: "Casual" };
const PER: Record<Contract["wageBasis"], string> = { monthly: "a month", daily: "a day", hourly: "an hour" };

/** "18 Oct 2026" from "2026-10-18". */
function day(iso: string): string {
  if (!ISO.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${month} ${y}`;
}

/** A labelled text field with its hint and its mistake. */
function Text({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = "text",
  inputMode,
  placeholder,
  className,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "email" | "text" | "decimal";
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      isInvalid={!!error}
      isRequired={required}
      className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}
    >
      <Label>{label}</Label>
      <Input type={type} inputMode={inputMode} placeholder={placeholder} autoComplete={autoComplete ?? "off"} />
      {hint && !error ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

/** A labelled native select, with an empty choice when it is optional. */
function Choose({
  id,
  label,
  value,
  onChange,
  options,
  empty,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  empty?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <NativeSelect fullWidth className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect.Trigger id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        {empty !== undefined ? <NativeSelect.Option value="">{empty}</NativeSelect.Option> : null}
        {options.map((o) => (
          <NativeSelect.Option key={o.value} value={o.value}>
            {o.label}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <Description>{hint}</Description> : null}
    </NativeSelect>
  );
}

const CONTRACT_CARDS = [
  { id: "permanent", label: "Permanent", desc: "No end date", icon: Briefcase },
  { id: "fixed_term", label: "Fixed-term", desc: "Ends on a set date", icon: Calendar },
  { id: "casual", label: "Casual", desc: "Paid for the days worked", icon: Hourglass },
] as const;
const PAYMENT_CARDS = [
  { id: "bank", label: "Bank account", desc: "Paid by transfer", icon: CreditCard },
  { id: "momo", label: "Mobile money", desc: "MTN MoMo or Airtel Money", icon: Smartphone },
  { id: "later", label: "Decide later", desc: "Before the first payday", icon: Clock },
] as const;

/** One choice among a few, as cards with an icon and a line saying what it means. */
function Cards({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; label: string; desc: string; icon: typeof Briefcase }[];
}) {
  return (
    <RadioButtonGroup
      aria-label={label}
      value={value}
      onChange={(v) => v && onChange(v)}
      layout="grid"
      className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]"
    >
      {options.map((o) => (
        <RadioButtonGroup.Item key={o.id} value={o.id} className="px-3.5 py-3">
          <RadioButtonGroup.Indicator>
            <CircleCheckFill />
          </RadioButtonGroup.Indicator>
          <RadioButtonGroup.ItemContent className="flex flex-col gap-1 pr-6">
            <Label className="flex items-center gap-2 font-semibold">
              <o.icon className="size-4 text-accent" aria-hidden="true" />
              {o.label}
            </Label>
            <Description className="text-xs leading-4">{o.desc}</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      ))}
    </RadioButtonGroup>
  );
}

/** A small count with a minus and a plus: children, years, days. */
function Count({
  label,
  value,
  onChange,
  max,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  step?: number;
}) {
  return (
    <NumberStepper
      value={Number(value || 0)}
      onChange={(n) => onChange(Number.isFinite(n) ? String(n) : "")}
      minValue={0}
      maxValue={max}
      step={step}
      className="flex flex-col gap-1"
    >
      <Label>{label}</Label>
      <NumberStepper.Group className="self-start">
        <NumberStepper.DecrementButton aria-label={`Less ${label.toLowerCase()}`} />
        <NumberStepper.Value className="w-14 tabular" />
        <NumberStepper.IncrementButton aria-label={`More ${label.toLowerCase()}`} />
      </NumberStepper.Group>
    </NumberStepper>
  );
}

/**
 * What a monthly salary comes to under the business's own rules, as the person will see it on
 * their payslip: take-home first, then what the state and the business add.
 */
function TakeHome({ rules, salary }: { rules: PayrollContributionList; salary: number }) {
  const sim = simulatePay(rules, salary);
  const parts = [
    { key: "home", name: "Take-home", value: sim.takeHome, color: "var(--accent)" },
    { key: "paye", name: "PAYE", value: sim.paye, color: "var(--chart-4)" },
    { key: "rssb", name: "RSSB and insurance", value: sim.employee, color: "var(--chart-5)" },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-xs text-muted">Take-home a month</span>
          <NumberValue value={sim.takeHome} className="text-2xl leading-8 font-semibold tabular">
            <NumberValue.Prefix>RWF </NumberValue.Prefix>
          </NumberValue>
        </span>
        <span className="flex flex-col items-end text-right">
          <span className="text-xs text-muted">The business pays in all</span>
          <NumberValue value={sim.cost} className="text-[15px] font-semibold tabular">
            <NumberValue.Prefix>RWF </NumberValue.Prefix>
          </NumberValue>
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-default"
        role="img"
        aria-label={parts.map((p) => `${p.name} ${formatRwf(p.value)}`).join(", ")}
      >
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.key}
              className="block h-full border-r-2 border-surface-secondary last:border-r-0"
              style={{ width: `${salary > 0 ? (p.value / salary) * 100 : 0}%`, background: p.color }}
            />
          ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {[...parts, { key: "emp", name: "Business RSSB", value: sim.employer, color: "var(--chart-other)" }].map(
          (p) => (
            <div key={p.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <dt className="text-muted">{p.name}</dt>
              <dd className="ml-auto font-medium tabular">{formatRwf(p.value)}</dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}

/** The new person's staff badge: a holographic card with their initials, name, job and number. */
function StaffBadge({
  name,
  title,
  number,
  business,
}: {
  name: string;
  title: string;
  number: string;
  business: string;
}) {
  return (
    <HoloCard
      gradient="linear-gradient(150deg, var(--chart-2) 0%, var(--chart-1) 45%, var(--eclipse) 100%)"
      className="mx-auto [--holo-card-bleed:12px] [--holo-card-height:330px] [--holo-card-width:224px]"
      aria-label={`Staff badge of ${name}`}
    >
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Pattern />
            <HoloCard.Inset />
            <HoloCard.Content className="flex flex-col justify-between p-5 text-white">
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold tracking-[0.14em] opacity-80">Staff</span>
                <span className="text-[13px] leading-4 font-semibold">{business}</span>
              </span>
              <span className="flex size-20 items-center justify-center self-center rounded-full bg-white/15 text-[28px] font-semibold ring-2 ring-white/40">
                {initials(name)}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[17px] leading-5 font-semibold">{name}</span>
                <span className="text-xs opacity-85">{title}</span>
                <span className="mt-2 font-mono text-xs tracking-wider opacity-90">No. {number}</span>
              </span>
            </HoloCard.Content>
            <HoloCard.Shine />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  );
}

/** A titled group of fields inside a step. */
function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3.5 border-t border-separator pt-5 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{title}</span>
          {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

/** One row of the review. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

/**
 * People › Employees › New employee: put a person on file with everything HR keeps about them,
 * and give them their Injishi login in the same sitting.
 *
 * Five steps, each checked before the next opens: who they are, the job, the contract and how
 * they are paid, what they may do in Injishi, then a review. Creating writes the file first and
 * the rest after it; anything refused after the file exists is reported beside it, never lost.
 */
export function NewEmployeeView({
  form,
  rules = null,
  prefill = {},
}: {
  form: NewEmployeeForm;
  /** A candidate hired in Talent: who they are in Talent, their name, contacts, offered wage and first day. */
  prefill?: { name?: string; phone?: string; email?: string; wage?: string; start?: string; candidate?: string };
  /** The business's pay rules, for the take-home preview; null without pay access. */
  rules?: PayrollContributionList | null;
}) {
  const { loadPlaces, registerNewEmployee } = useHrActions();
  // Where they live, province down to village: the village is what the file keeps.
  const [place, setPlace] = useState<PlaceChain>({});
  const screenHref = useBoardHref();
  const [step, setStep] = useState<StepId>("personal");
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Registered | null>(null);

  const [employerId, setEmployerId] = useState(form.employers[0]?.id ?? "");
  const employer = form.employers.find((e) => e.id === employerId) ?? form.employers[0];

  const [personal, setPersonal] = useState<Personal>({
    legalName: prefill.name ?? "",
    preferredName: "",
    sex: "",
    dateOfBirth: "",
    idType: "national_id",
    idNumber: "",
    phone: prefill.phone ?? "",
    email: prefill.email ?? "",
    maritalStatus: "",
    childrenCount: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
    villageId: null,
    street: "",
    qualification: "",
    experienceYears: "",
  });
  const [job, setJob] = useState<Job>({
    branchId: employer?.branches[0]?.id ?? "",
    positionId: "",
    employeeTypeId: "",
    managerId: "",
    hiredOn: prefill.start && ISO.test(prefill.start) ? prefill.start : form.today,
    employeeNumber: "",
  });
  const [contract, setContract] = useState<Contract>({
    type: "permanent",
    endsOn: "",
    wageBasis: "monthly",
    wage: prefill.wage && Number(prefill.wage) > 0 ? Number(prefill.wage).toLocaleString("en-US") : "",
    noticeDays: "30",
    rssbNumber: "",
  });
  const [payment, setPayment] = useState<Payment>({ method: "bank", bankName: "", accountNumber: "", momoPhone: "" });
  const [login, setLogin] = useState(false);
  const [kioskPin, setKioskPin] = useState("");
  const [access, setAccess] = useState<AccessDraft>(() =>
    employer
      ? emptyAccess(employer.access)
      : emptyAccess({ canGrant: false, grantsEveryRole: false, roles: [], branches: [] }),
  );

  const p = (patch: Partial<Personal>) => setPersonal((x) => ({ ...x, ...patch }));
  const j = (patch: Partial<Job>) => setJob((x) => ({ ...x, ...patch }));
  const c = (patch: Partial<Contract>) => setContract((x) => ({ ...x, ...patch }));
  const pay = (patch: Partial<Payment>) => setPayment((x) => ({ ...x, ...patch }));

  if (!employer) {
    return (
      <PageContent>
        <PageHeader eyebrow="People › Employees" title="New employee" />
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>No business to add staff to</Alert.Title>
            <Alert.Description>Ask the owner to give you HR access.</Alert.Description>
          </Alert.Content>
        </Alert>
      </PageContent>
    );
  }

  const canGrant = employer.access.canGrant && employer.access.roles.length > 0;
  const role = employer.access.roles.find((r) => r.id === access.role);
  const ownerDecides = login && !!role?.needsOwner && !employer.access.grantsEveryRole;
  const loginEmail = access.email || personal.email;

  const changeEmployer = (id: string) => {
    const next = form.employers.find((e) => e.id === id);
    if (!next) return;
    setEmployerId(id);
    j({ branchId: next.branches[0]?.id ?? "", positionId: "", employeeTypeId: "", managerId: "" });
    setAccess(emptyAccess(next.access, access.email));
  };

  /** The mistakes of one step, by field. */
  const check = (id: StepId): Errors => {
    const e: Errors = {};
    if (id === "personal") {
      if (personal.legalName.trim().length < 2) e.legalName = "Enter the name as on the ID.";
      if (!personal.sex) e.sex = "Choose one, as on the ID.";
      if (!ISO.test(personal.dateOfBirth)) e.dateOfBirth = "Enter the date of birth.";
      else if (personal.dateOfBirth > form.today) e.dateOfBirth = "Cannot be in the future.";
      if (personal.idNumber.trim().length < 3) e.idNumber = "Enter the ID or passport number.";
      if (digits(personal.phone).length < 9) e.phone = "Enter a Rwandan mobile number, like 0788 123 456.";
      if (personal.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim()))
        e.email = "Enter a valid email address.";
      if (personal.emergencyPhone.trim() && digits(personal.emergencyPhone).length < 9)
        e.emergencyPhone = "Enter a Rwandan mobile number.";
    }
    if (id === "job") {
      if (!job.branchId) e.branchId = "Choose the branch they work at.";
      if (!ISO.test(job.hiredOn)) e.hiredOn = "Enter the start date.";
      if (job.employeeNumber.trim() && !/^[A-Za-z0-9-]{1,20}$/.test(job.employeeNumber.trim()))
        e.employeeNumber = "Letters, digits and dashes only.";
      if (personal.qualification.trim() && personal.qualification.trim().length < 2)
        e.qualification = "Write the qualification out.";
      if (personal.experienceYears && Number(personal.experienceYears) > 60) e.experienceYears = "At most 60 years.";
    }
    if (id === "pay") {
      if (!(Number(digits(contract.wage)) > 0)) e.wage = "Enter the salary, in francs.";
      if (contract.type === "fixed_term") {
        if (!ISO.test(contract.endsOn)) e.endsOn = "Enter the end date.";
        else if (contract.endsOn <= job.hiredOn) e.endsOn = "Must be after the start date.";
      }
      if (payment.method === "bank") {
        if (!payment.bankName) e.bankName = "Choose the bank.";
        if (digits(payment.accountNumber).length < 5) e.accountNumber = "Enter the account number.";
      }
      if (payment.method === "momo" && digits(payment.momoPhone).length < 9)
        e.momoPhone = "Enter the mobile money number.";
    }
    if (id === "access") {
      if (kioskPin && !/^\d{4,6}$/.test(kioskPin)) e.kioskPin = "A PIN is 4 to 6 digits.";
      if (login) Object.assign(e, accessErrors({ ...access, email: loginEmail }));
    }
    return e;
  };

  const index = STEPS.findIndex((s) => s.id === step);
  const go = (to: number) => {
    setErrors({});
    setStep(STEPS[to].id);
    setReached((r) => Math.max(r, to));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    const found = check(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    go(index + 1);
  };

  const create = () => {
    // Every step once more: a field changed after it was passed is caught here, on its step.
    for (const [i, s] of STEPS.entries()) {
      const found = check(s.id);
      if (Object.keys(found).length > 0) {
        go(i);
        setErrors(found);
        return;
      }
    }
    const input: NewEmployeeInput = {
      employerId: employer.id,
      ...(prefill.candidate ? { candidateId: prefill.candidate } : {}),
      personal,
      job,
      contract,
      payment,
      access: {
        login: login && canGrant,
        email: loginEmail,
        role: access.role,
        allBranches: access.allBranches,
        branchIds: access.branchIds,
        note: access.note,
        kioskPin,
      },
    };
    startTransition(async () => {
      const result = await registerNewEmployee(input);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setDone(result.registered);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const restart = () => window.location.assign(`${screenHref("Employees")}/new`);

  // ── Created ─────────────────────────────────────────────────────────────────────────────────────
  if (done) {
    const failed = done.outcomes.filter((o) => !o.ok);
    return (
      <PageContent>
        <PageHeader eyebrow="People › Employees" title="New employee" />
        <Card className="mx-auto grid w-full max-w-[920px] gap-6 p-6 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)]">
          <StaffBadge
            name={done.name}
            title={employer.positions.find((x) => x.id === job.positionId)?.title ?? "Team member"}
            number={done.employeeNumber}
            business={employer.name}
          />
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                <Check className="size-6" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-xl leading-7 font-semibold">{done.name} is on file</h2>
                <p className="text-sm text-muted">
                  Employee number <span className="font-medium text-foreground tabular">{done.employeeNumber}</span> at{" "}
                  {employer.name}. The joining checklist has started.
                </p>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-separator rounded-xl border border-separator">
              <li className="flex items-center gap-3 px-4 py-3 text-sm">
                <CircleCheckFill className="size-4 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0 flex-1">Staff file created</span>
              </li>
              {done.outcomes.map((o) => (
                <li key={o.part} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {o.ok ? (
                    o.part === "login" && done.login === "requested" ? (
                      <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    ) : o.part === "login" ? (
                      <Envelope className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <CircleCheckFill className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    )
                  ) : (
                    <CircleExclamationFill className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span>{o.detail}</span>
                    {!o.ok ? (
                      <span className="text-xs text-muted">Not saved. Finish it on the employee's file.</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {done.login === "requested" ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <Clock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Waiting for the owner</Alert.Title>
                  <Alert.Description>Emailed once they approve.</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : done.login === "invited" ? (
              <Alert status="success">
                <Alert.Indicator>
                  <Envelope />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Invitation sent</Alert.Title>
                  <Alert.Description>Valid for 7 days.</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {failed.length > 0 ? (
              <p className="text-xs text-muted">
                {failed.length === 1 ? "One part was" : `${failed.length} parts were`} not saved. The file itself is
                kept.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onPress={restart}>
                <PersonPlus className="size-4" aria-hidden="true" />
                Add another employee
              </Button>
              <LinkButton
                href={`${screenHref("Employees")}?employee=${encodeURIComponent(done.employeeId)}&tab=${done.login ? "access" : "overview"}`}
              >
                Open employee file
              </LinkButton>
            </div>
          </div>
        </Card>
        <Toast.Provider placement="bottom" />
      </PageContent>
    );
  }

  // ── The steps ───────────────────────────────────────────────────────────────────────────────────
  const current = STEPS[index];
  return (
    <PageContent>
      <PageHeader
        eyebrow="People › Employees"
        title="New employee"
        actions={
          <LinkButton href={screenHref("Employees")} variant="ghost">
            Cancel
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Steps" className="min-w-0 lg:sticky lg:top-4">
          {(["vertical", "horizontal"] as const).map((o) => (
            <Stepper
              key={o}
              orientation={o}
              size={o === "vertical" ? "md" : "sm"}
              currentStep={index}
              onStepChange={(i) => (i <= reached ? go(i) : undefined)}
              aria-label="Steps"
              className={
                o === "vertical" ? "hidden rounded-2xl bg-surface p-4 lg:flex" : "overflow-x-auto pb-1 lg:hidden"
              }
            >
              {STEPS.map((s, i) => (
                <Stepper.Step key={s.id} className={i > reached ? "pointer-events-none opacity-60" : undefined}>
                  <Stepper.Indicator />
                  <Stepper.Content>
                    <Stepper.Title>{s.title}</Stepper.Title>
                    {o === "vertical" ? <Stepper.Description>{s.hint}</Stepper.Description> : null}
                  </Stepper.Content>
                  <Stepper.Separator />
                </Stepper.Step>
              ))}
            </Stepper>
          ))}
        </nav>

        <Card className="min-w-0 gap-0 p-0">
          <div className="flex flex-col gap-1 border-b border-separator px-5 py-4 sm:px-6">
            <span className="text-xs font-medium text-muted tabular">
              Step {index + 1} of {STEPS.length}
            </span>
            <h2 className="text-lg leading-6 font-semibold">{current.title}</h2>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            {step === "personal" ? (
              <>
                <Group title="Identity" hint="As on the ID.">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Text
                      label="Full legal name"
                      value={personal.legalName}
                      onChange={(v) => p({ legalName: v })}
                      error={errors.legalName}
                      required
                      className="sm:col-span-2"
                    />
                    <Text
                      label="Preferred name"
                      value={personal.preferredName}
                      onChange={(v) => p({ preferredName: v })}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Sex</span>
                      <Segment
                        aria-label="Sex"
                        selectedKey={personal.sex || null}
                        onSelectionChange={(k) => p({ sex: k === "male" ? "male" : "female" })}
                        className="self-start"
                      >
                        <Segment.Item id="female">Female</Segment.Item>
                        <Segment.Item id="male">
                          <Segment.Separator />
                          Male
                        </Segment.Item>
                      </Segment>
                      {errors.sex ? <span className="text-xs text-danger">{errors.sex}</span> : null}
                    </div>
                    <Text
                      label="Date of birth"
                      type="date"
                      value={personal.dateOfBirth}
                      onChange={(v) => p({ dateOfBirth: v })}
                      error={errors.dateOfBirth}
                      required
                    />
                    <div />
                    <Choose
                      id="ne-id-type"
                      label="ID document"
                      value={personal.idType}
                      onChange={(v) => p({ idType: v === "passport" ? "passport" : "national_id" })}
                      options={[
                        { value: "national_id", label: "National ID" },
                        { value: "passport", label: "Passport" },
                      ]}
                    />
                    <Text
                      label={personal.idType === "passport" ? "Passport number" : "National ID number"}
                      value={personal.idNumber}
                      onChange={(v) => p({ idNumber: v })}
                      error={errors.idNumber}
                      required
                      inputMode={personal.idType === "passport" ? "text" : "numeric"}
                      placeholder={personal.idType === "passport" ? "PC1234567" : "1 1990 8 0012345 1 23"}
                    />
                  </div>
                </Group>

                <Group title="Contacts">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Text
                      label="Mobile number"
                      type="tel"
                      inputMode="tel"
                      value={personal.phone}
                      onChange={(v) => p({ phone: v })}
                      error={errors.phone}
                      required
                      placeholder="0788 123 456"
                    />
                    <Text
                      label="Email"
                      type="email"
                      inputMode="email"
                      value={personal.email}
                      onChange={(v) => p({ email: v })}
                      error={errors.email}
                      placeholder="name@example.com"
                    />
                  </div>
                </Group>

                <Group title="Where they live">
                  <div className="flex flex-col gap-3.5">
                    <PlacePicker
                      value={place}
                      onChange={(chain) => {
                        setPlace(chain);
                        const village = chain.village?.id;
                        p({ villageId: typeof village === "number" ? village : village ? Number(village) : null });
                      }}
                      loadPlaces={loadPlaces}
                      reserveSpace={false}
                    />
                    <Text
                      label="Street, house or landmark"
                      value={personal.street}
                      onChange={(v) => p({ street: v })}
                      placeholder="KG 11 Ave, house 24, near the market"
                    />
                  </div>
                </Group>

                <Group title="Family">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Choose
                      id="ne-marital"
                      label="Marital status"
                      value={personal.maritalStatus}
                      onChange={(v) => p({ maritalStatus: v as Personal["maritalStatus"] })}
                      empty="Not recorded"
                      options={Object.entries(MARITAL).map(([value, label]) => ({ value, label }))}
                    />
                    <Count
                      label="Children"
                      value={personal.childrenCount}
                      onChange={(v) => p({ childrenCount: v })}
                      max={30}
                    />
                  </div>
                </Group>

                <Group title="Emergency contact">
                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <Text label="Name" value={personal.emergencyName} onChange={(v) => p({ emergencyName: v })} />
                    <Text
                      label="Phone"
                      type="tel"
                      inputMode="tel"
                      value={personal.emergencyPhone}
                      onChange={(v) => p({ emergencyPhone: v })}
                      error={errors.emergencyPhone}
                      placeholder="0788 123 456"
                    />
                    <Text
                      label="Relationship"
                      value={personal.emergencyRelation}
                      onChange={(v) => p({ emergencyRelation: v })}
                      placeholder="Sister"
                    />
                  </div>
                </Group>
              </>
            ) : null}

            {step === "job" ? (
              <>
                {form.employers.length > 1 ? (
                  <Group title="Employer">
                    <Choose
                      id="ne-employer"
                      label="Employer"
                      value={employer.id}
                      onChange={changeEmployer}
                      options={form.employers.map((e) => ({ value: e.id, label: e.name }))}
                    />
                  </Group>
                ) : null}
                <Group title="Position">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Choose
                      id="ne-branch"
                      label="Branch"
                      value={job.branchId}
                      onChange={(v) => j({ branchId: v })}
                      options={employer.branches.map((b) => ({ value: b.id, label: b.name }))}
                      error={errors.branchId}
                    />
                    <Choose
                      id="ne-position"
                      label="Job position"
                      value={job.positionId}
                      onChange={(v) => j({ positionId: v })}
                      empty="No position yet"
                      options={employer.positions.map((x) => ({ value: x.id, label: x.title }))}
                    />
                    <Choose
                      id="ne-type"
                      label="Employee type"
                      value={job.employeeTypeId}
                      onChange={(v) => j({ employeeTypeId: v })}
                      empty="Not set"
                      options={employer.employeeTypes.map((x) => ({ value: x.id, label: x.title }))}
                    />
                    <Choose
                      id="ne-manager"
                      label="Reports to"
                      value={job.managerId}
                      onChange={(v) => j({ managerId: v })}
                      empty="No line manager"
                      options={employer.managers.map((m) => ({ value: m.id, label: `${m.name} · ${m.title}` }))}
                    />
                  </div>
                </Group>
                <Group title="Start">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Text
                      label="Start date"
                      type="date"
                      value={job.hiredOn}
                      onChange={(v) => j({ hiredOn: v })}
                      error={errors.hiredOn}
                      required
                    />
                    <Text
                      label="Employee number"
                      value={job.employeeNumber}
                      onChange={(v) => j({ employeeNumber: v })}
                      error={errors.employeeNumber}
                      placeholder="Assigned automatically"
                      hint="Leave empty for the next number."
                    />
                  </div>
                </Group>
                <Group title="Background">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Text
                      label="Highest qualification"
                      value={personal.qualification}
                      onChange={(v) => p({ qualification: v })}
                      error={errors.qualification}
                      placeholder="Diploma in hotel management"
                    />
                    <Count
                      label="Years of experience"
                      value={personal.experienceYears}
                      onChange={(v) => p({ experienceYears: v })}
                      max={60}
                    />
                  </div>
                </Group>
              </>
            ) : null}

            {step === "pay" ? (
              <>
                <Group title="Salary">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Paid per</span>
                      <Segment
                        aria-label="Wage basis"
                        selectedKey={contract.wageBasis}
                        onSelectionChange={(k) => c({ wageBasis: String(k) as Contract["wageBasis"] })}
                        className="self-start"
                      >
                        <Segment.Item id="monthly">Month</Segment.Item>
                        <Segment.Item id="daily">
                          <Segment.Separator />
                          Day
                        </Segment.Item>
                        <Segment.Item id="hourly">
                          <Segment.Separator />
                          Hour
                        </Segment.Item>
                      </Segment>
                    </div>
                    <Text
                      label={`Gross salary (RWF ${PER[contract.wageBasis]})`}
                      inputMode="numeric"
                      value={contract.wage}
                      onChange={(v) => c({ wage: digits(v) ? Number(digits(v)).toLocaleString("en-US") : "" })}
                      error={errors.wage}
                      required
                      placeholder="320,000"
                      hint="Before tax and RSSB."
                    />
                  </div>
                  {rules && contract.wageBasis === "monthly" && Number(digits(contract.wage)) > 0 ? (
                    <TakeHome rules={rules} salary={Number(digits(contract.wage))} />
                  ) : null}
                </Group>

                <Group title="Contract">
                  <Cards
                    label="Contract type"
                    value={contract.type || "permanent"}
                    onChange={(k) => c({ type: k as Contract["type"] })}
                    options={CONTRACT_CARDS}
                  />
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {contract.type === "fixed_term" ? (
                      <Text
                        label="End date"
                        type="date"
                        value={contract.endsOn}
                        onChange={(v) => c({ endsOn: v })}
                        error={errors.endsOn}
                        required
                      />
                    ) : null}
                    <Count
                      label="Notice period (days)"
                      value={contract.noticeDays}
                      onChange={(v) => c({ noticeDays: v })}
                      max={180}
                      step={15}
                    />
                  </div>
                </Group>

                <Group title="Social security">
                  <Text
                    label="RSSB number"
                    value={contract.rssbNumber}
                    onChange={(v) => c({ rssbNumber: v })}
                    hint="Optional for now."
                    className="max-w-[360px]"
                  />
                </Group>

                <Group title="How the salary is paid">
                  <Cards
                    label="Payment method"
                    value={payment.method}
                    onChange={(k) => pay({ method: k as Payment["method"] })}
                    options={PAYMENT_CARDS}
                  />
                  {payment.method === "bank" ? (
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <Choose
                        id="ne-bank"
                        label="Bank"
                        value={payment.bankName}
                        onChange={(v) => pay({ bankName: v })}
                        empty="Choose the bank"
                        options={form.banks.map((b) => ({ value: b, label: b }))}
                        error={errors.bankName}
                      />
                      <Text
                        label="Account number"
                        inputMode="numeric"
                        value={payment.accountNumber}
                        onChange={(v) => pay({ accountNumber: v })}
                        error={errors.accountNumber}
                        placeholder="0004 1234 5678"
                      />
                    </div>
                  ) : payment.method === "momo" ? (
                    <Text
                      label="Mobile money number"
                      type="tel"
                      inputMode="tel"
                      value={payment.momoPhone}
                      onChange={(v) => pay({ momoPhone: v })}
                      error={errors.momoPhone}
                      placeholder="0788 123 456"
                      className="max-w-[360px]"
                    />
                  ) : (
                    <Description>Add it before their first payday.</Description>
                  )}
                </Group>
              </>
            ) : null}

            {step === "access" ? (
              <>
                <Group title="Kiosk clock-in">
                  <Text
                    label="Kiosk PIN"
                    type="password"
                    inputMode="numeric"
                    value={kioskPin}
                    onChange={(v) => setKioskPin(digits(v).slice(0, 6))}
                    error={errors.kioskPin}
                    placeholder="4 to 6 digits"
                    hint="Optional · never shown again."
                    className="max-w-[260px]"
                  />
                </Group>

                <Group title="Injishi login">
                  {canGrant ? (
                    <>
                      <Switch isSelected={login} onChange={setLogin}>
                        <Switch.Content className="gap-3">
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium">Give them an Injishi login</span>
                            <span className="text-xs text-muted">Without one: kiosk and SMS payslips only.</span>
                          </span>
                        </Switch.Content>
                      </Switch>
                      {login ? (
                        <AccessPicker
                          idPrefix="ne"
                          options={employer.access}
                          value={{ ...access, email: loginEmail }}
                          onChange={setAccess}
                          errors={{ email: errors.email, branches: errors.branches }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <Alert>
                      <Alert.Content>
                        <Alert.Title>Only the owner gives logins at {employer.name}</Alert.Title>
                      </Alert.Content>
                    </Alert>
                  )}
                </Group>
              </>
            ) : null}

            {step === "review" ? (
              <>
                {[
                  {
                    id: "personal" as const,
                    title: "Personal details",
                    rows: [
                      ["Full legal name", personal.legalName],
                      ["Preferred name", personal.preferredName || "—"],
                      ["Sex", personal.sex === "male" ? "Male" : "Female"],
                      ["Date of birth", day(personal.dateOfBirth)],
                      [personal.idType === "passport" ? "Passport" : "National ID", personal.idNumber],
                      ["Mobile", personal.phone],
                      ["Email", personal.email || "—"],
                      ["Lives in", [personal.street, placeLine(place)].filter(Boolean).join(", ") || "—"],
                      [
                        "Family",
                        [
                          personal.maritalStatus ? MARITAL[personal.maritalStatus] : null,
                          personal.childrenCount
                            ? `${personal.childrenCount} ${personal.childrenCount === "1" ? "child" : "children"}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—",
                      ],
                      [
                        "Emergency contact",
                        personal.emergencyName
                          ? [personal.emergencyName, personal.emergencyRelation, personal.emergencyPhone]
                              .filter(Boolean)
                              .join(" · ")
                          : "—",
                      ],
                    ],
                  },
                  {
                    id: "job" as const,
                    title: "Job",
                    rows: [
                      ["Employer", employer.name],
                      ["Branch", employer.branches.find((b) => b.id === job.branchId)?.name ?? "—"],
                      ["Position", employer.positions.find((x) => x.id === job.positionId)?.title ?? "No position yet"],
                      ["Employee type", employer.employeeTypes.find((x) => x.id === job.employeeTypeId)?.title ?? "—"],
                      ["Reports to", employer.managers.find((m) => m.id === job.managerId)?.name ?? "No line manager"],
                      ["Start date", day(job.hiredOn)],
                      ["Employee number", job.employeeNumber || "Next number"],
                      ["Qualification", personal.qualification || "—"],
                      [
                        "Experience",
                        personal.experienceYears
                          ? `${personal.experienceYears} ${personal.experienceYears === "1" ? "year" : "years"}`
                          : "—",
                      ],
                    ],
                  },
                  {
                    id: "pay" as const,
                    title: "Salary and contract",
                    rows: [
                      ["Gross salary", `${formatRwf(Number(digits(contract.wage)))} ${PER[contract.wageBasis]}`],
                      [
                        "Contract",
                        contract.type
                          ? `${CONTRACT[contract.type]}${contract.type === "fixed_term" ? ` to ${day(contract.endsOn)}` : ""}`
                          : "—",
                      ],
                      ["Notice", contract.type && contract.noticeDays ? `${contract.noticeDays} days` : "—"],
                      ["RSSB number", contract.rssbNumber || "Not yet"],
                      [
                        "Paid to",
                        payment.method === "bank"
                          ? `${payment.bankName} · ${payment.accountNumber}`
                          : payment.method === "momo"
                            ? `Mobile money · ${payment.momoPhone}`
                            : "Decide later",
                      ],
                    ],
                  },
                  {
                    id: "access" as const,
                    title: "System access",
                    rows: [
                      ["Kiosk PIN", kioskPin ? "Set (hidden)" : "Not set"],
                      [
                        "Injishi login",
                        login && canGrant ? `${role?.label ?? access.role} · ${loginEmail}` : "No login",
                      ],
                      ...(login && canGrant && employer.access.branches.length > 1
                        ? [
                            [
                              "Branches",
                              access.allBranches
                                ? "Every branch"
                                : employer.access.branches
                                    .filter((b) => access.branchIds.includes(b.id))
                                    .map((b) => b.name)
                                    .join(", "),
                            ],
                          ]
                        : []),
                    ],
                  },
                ].map((section) => (
                  <section
                    key={section.id}
                    aria-labelledby={`rv-${section.id}`}
                    className="flex flex-col gap-1 border-t border-separator pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 id={`rv-${section.id}`} className="text-sm font-semibold">
                        {section.title}
                      </h3>
                      <Button size="sm" variant="ghost" onPress={() => go(STEPS.findIndex((s) => s.id === section.id))}>
                        Edit
                      </Button>
                    </div>
                    <dl className="flex flex-col">
                      {section.rows.map(([label, value]) => (
                        <Row key={label} label={label}>
                          {value}
                        </Row>
                      ))}
                    </dl>
                  </section>
                ))}
                {ownerDecides ? (
                  <Alert status="warning">
                    <Alert.Indicator>
                      <Clock />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>The {role?.label} login goes to the owner for approval</Alert.Title>
                    </Alert.Content>
                  </Alert>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-separator px-5 py-4 sm:px-6">
            {index > 0 ? (
              <Button variant="ghost" onPress={() => go(index - 1)} isDisabled={pending}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {step === "review" ? (
              <Button onPress={create} isPending={pending}>
                <PersonPlus className="size-4" aria-hidden="true" />
                Create employee
              </Button>
            ) : (
              <Button onPress={next}>
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </Card>
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
