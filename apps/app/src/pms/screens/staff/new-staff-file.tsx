"use client";

/**
 * Staff · Employees: putting somebody on file, in one go (ADR-058).
 *
 * A file used to open with twelve fields, and everything else a new hire comes
 * with was a walk through the file's tabs afterwards: the contract on
 * Contracts, the account pay goes to on Pay accounts, the emergency contact on
 * Profile, the ID copy on Documents. This form shows all of it at once.
 *
 * WHO THEY ARE and THEIR JOB are the file itself, and are required. The rest is
 * offered beneath, each part behind a tick: what is ticked is saved with the
 * file, and what is not is added later on the tab it belongs to.
 *
 * NOTHING NEW ON THE SERVER. The file is created by the same request as
 * before, and each ticked part is then written through the route its own tab
 * uses, in order. Two things follow from that:
 *
 *  - Every ticked part is checked against its contract BEFORE the file is
 *    created, so a mistyped account number stops the form, not half of it.
 *  - Should a part still be refused once the file exists (the server knows
 *    things this form does not), the file stays, the form says which part did
 *    not save and why, and points at the tab to add it on. The file is never
 *    sent twice.
 */

import {
  CreateContractRequest,
  CreatePayAccountRequest,
  UpdateEmployeeRequest,
  type ContractType,
  type CreateEmployeeRequest,
  type Employee,
} from "@injishi/contracts";
import { Checkbox, Input, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ActionButton, Badge, SectionHeading, SelectField } from "../../components/ui";
import { humanError } from "../../data/api";
import { useWorkspaceId } from "../../data/capability";
import { useCreateContract, useCreateEmployee, useEmployees, useUpdateEmployee } from "../../data/people";
import { useAddNote, useAddPayAccount, useHrCatalog, useUploadDocument } from "../../data/people-file";
import { dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { HrFileInput } from "./hr-file-input";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

const CONTRACT_TYPE: Record<ContractType, string> = {
  permanent: "Permanent",
  fixed_term: "Fixed term",
  casual: "Casual",
};

/** What a new hire usually brings; a title of one's own works as well. */
const USUAL_DOCUMENTS = ["ID copy", "Signed contract", "CV", "Certificate"];

/** The parts beyond the file itself, each saved on the tab named beside it. */
type Part = "pay" | "account" | "emergency" | "documents" | "note";

const EMPTY = {
  legalName: "",
  preferredName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  sex: "",
  idDocumentType: "national_id",
  idDocumentNumber: "",
  hiredOn: "",
  workPropertyId: "",
  jobPositionId: "",
  reportingManagerId: "",
  rssbNumber: "",
  contractType: "permanent",
  wage: "",
  // Empty is "the day they are hired".
  startsOn: "",
  endsOn: "",
  payKind: "momo",
  bankName: "",
  accountNumber: "",
  bankBranch: "",
  // Empty is "the phone above".
  momoPhone: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
  note: "",
};

interface Outcome {
  label: string;
  ok: boolean;
  /** What was saved, or the server's words for why it was not. */
  detail: string;
  /** The tab of the file this part lives on. */
  tab: string;
}

export function NewStaffFile({ onDone }: { onDone: () => void }) {
  const { state } = usePms();
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const branches = currentGrant(state)?.branches ?? [];
  const positions = useHrCatalog(workspaceId, "job-positions");
  const colleagues = useEmployees(workspaceId, "active");
  const create = useCreateEmployee(workspaceId);
  const update = useUpdateEmployee(workspaceId);
  const contract = useCreateContract(workspaceId);
  const account = useAddPayAccount(workspaceId);
  const uploadDoc = useUploadDocument(workspaceId);
  const note = useAddNote(workspaceId);

  const fresh = () => ({ ...EMPTY, hiredOn: todayIso(), workPropertyId: branches[0]?.id ?? "" });
  const [form, setForm] = useState(fresh);
  // Pay and the account it goes to are what a hire nearly always comes with.
  const [on, setOn] = useState<Record<Part, boolean>>({ pay: true, account: true, emergency: false, documents: false, note: false });
  const [docs, setDocs] = useState<{ title: string; fileKey: string; filename: string }[]>([]);
  const [docTitle, setDocTitle] = useState(USUAL_DOCUMENTS[0]);
  const [problem, setProblem] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ employee: Employee; outcomes: Outcome[] } | null>(null);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const base = `${workspaceBase(workspaceId)}/staff`;
  const startsOn = form.startsOn || form.hiredOn;
  const momoPhone = form.momoPhone.trim() || form.phone;

  const contractBody = (): CreateContractRequest => ({
    contractType: form.contractType as ContractType,
    startsOn,
    endsOn: form.endsOn || null,
    wageBasis: "monthly",
    wageRwf: Number(form.wage.replace(/[^\d]/g, "")),
  });
  const accountBody = (): CreatePayAccountRequest =>
    form.payKind === "bank"
      ? { kind: "bank", bankName: form.bankName, accountNumber: form.accountNumber, branchName: form.bankBranch.trim() || null }
      : { kind: "momo", momoPhone };
  const emergencyBody = () => ({
    emergencyName: form.emergencyName.trim(),
    emergencyPhone: form.emergencyPhone,
    emergencyRelation: form.emergencyRelation.trim(),
  });

  /** What is wrong with a ticked part, in words, before anything is sent. */
  const check = (): string | null => {
    const first = (result: { success: boolean; error?: { issues: { message: string }[] } }, part: string) =>
      result.success ? null : `${part}: ${result.error?.issues[0]?.message ?? "check what you typed."}`;
    if (!form.sex) return "Choose their sex.";
    if (!form.workPropertyId) return "Choose the branch they work at.";
    if (on.pay) {
      const wrong = first(CreateContractRequest.safeParse(contractBody()), "Pay");
      if (wrong) return wrong;
      if (form.contractType === "fixed_term" && !form.endsOn) return "Pay: a fixed term contract needs the day it ends.";
      if (form.endsOn && form.endsOn < startsOn) return "Pay: the contract cannot end before it starts.";
    }
    if (on.account) {
      const wrong = first(CreatePayAccountRequest.safeParse(accountBody()), "Where pay goes");
      if (wrong) return wrong;
    }
    if (on.emergency) {
      const wrong = first(UpdateEmployeeRequest.safeParse(emergencyBody()), "Emergency contact");
      if (wrong) return wrong;
    }
    if (on.documents && docs.length === 0) return "Documents: attach one, or untick Documents.";
    if (on.note && form.note.trim() === "") return "Note: write it, or untick the note.";
    return null;
  };

  const submit = async () => {
    const wrong = check();
    setProblem(wrong);
    if (wrong) return;

    const body: CreateEmployeeRequest = {
      legalName: form.legalName,
      preferredName: form.preferredName.trim() || null,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      sex: form.sex as CreateEmployeeRequest["sex"],
      idDocumentType: form.idDocumentType as CreateEmployeeRequest["idDocumentType"],
      idDocumentNumber: form.idDocumentNumber,
      hiredOn: form.hiredOn,
      workPropertyId: form.workPropertyId,
      jobPositionId: form.jobPositionId || null,
      reportingManagerId: form.reportingManagerId || null,
      rssbNumber: form.rssbNumber.trim() || null,
      email: form.email.trim() || null,
    };

    setWorking("Saving the file");
    let employee: Employee;
    try {
      employee = await create.mutateAsync(body);
    } catch {
      // Nothing exists yet: the form stays as typed, with the server's words under it.
      setWorking(null);
      return;
    }

    // The file exists from here on. Each part is tried once and reported; none stops the next.
    const outcomes: Outcome[] = [];
    const attempt = async (label: string, tab: string, run: () => Promise<string>) => {
      setWorking(`Saving ${label.toLowerCase()}`);
      try {
        outcomes.push({ label, tab, ok: true, detail: await run() });
      } catch (error) {
        outcomes.push({ label, tab, ok: false, detail: humanError(error) });
      }
    };

    if (on.pay) {
      await attempt("The contract", "contracts", async () => {
        const made = await contract.mutateAsync({ id: employee.id, body: contractBody() });
        return `${CONTRACT_TYPE[made.contract.contractType]}, ${fmt(made.contract.wageRwf)} a month from ${dshortIso(made.contract.startsOn)}`;
      });
    }
    if (on.account) {
      await attempt("The pay account", "pay", async () => {
        const made = await account.mutateAsync({ id: employee.id, body: accountBody() });
        return made.kind === "bank" ? `${made.bankName ?? "Bank"}, account ${made.accountNumber ?? ""}` : `MoMo ${made.momoPhone ?? ""}`;
      });
    }
    if (on.emergency) {
      await attempt("The emergency contact", "", async () => {
        await update.mutateAsync({ id: employee.id, patch: emergencyBody() });
        return `${form.emergencyName.trim()}, ${form.emergencyRelation.trim().toLowerCase()}`;
      });
    }
    if (on.documents) {
      for (const doc of docs) {
        await attempt(`Document: ${doc.title}`, "documents", async () => {
          await uploadDoc.mutateAsync({ id: employee.id, body: { title: doc.title, fileKey: doc.fileKey } });
          return doc.filename;
        });
      }
    }
    if (on.note) {
      await attempt("The note", "notes", async () => {
        await note.mutateAsync({ id: employee.id, body: { body: form.note.trim() } });
        return "On their file, for whoever manages staff files.";
      });
    }

    setWorking(null);
    setSaved({ employee, outcomes });
  };

  // --- Saved: what went in, and what still has to ---------------------------------------------
  if (saved) {
    const { employee, outcomes } = saved;
    const missed = outcomes.filter((o) => !o.ok);
    return (
      <section className="flex flex-col gap-3 rounded-card border border-card-bd bg-card p-5" aria-live="polite" data-new-file={employee.id}>
        <SectionHeading>
          {employee.displayName} is on file
        </SectionHeading>
        <p className="text-sm text-ink2">
          Employee number <span className="pms-num font-semibold text-ink">{employee.employeeNumber}</span>.{" "}
          {missed.length === 0
            ? outcomes.length === 0
              ? "The contract, the pay account and the rest can be added on their file."
              : "Everything you entered is saved."
            : `The file is saved, but ${missed.length === 1 ? "one part was" : `${missed.length} parts were`} not. Add ${missed.length === 1 ? "it" : "them"} on their file.`}
        </p>
        {outcomes.length > 0 && (
          <RowList>
            {outcomes.map((o, index) => (
              <div key={`${o.label}:${index}`} className={`${rowClass(index)} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{o.label}</span>
                  <span className={o.ok ? "text-2xs text-muted-foreground" : "text-2xs text-danger"}>{o.detail}</span>
                </span>
                {o.ok ? (
                  <Badge intent="ok">Saved</Badge>
                ) : (
                  <>
                    <Badge intent="bad">Not saved</Badge>
                    <ActionButton onClick={() => router.push(o.tab ? `${base}/${employee.id}/${o.tab}` : `${base}/${employee.id}`)}>
                      Add it on the file
                    </ActionButton>
                  </>
                )}
              </div>
            ))}
          </RowList>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton onClick={onDone}>Done</ActionButton>
          <ActionButton
            onClick={() => {
              setSaved(null);
              setForm(fresh());
              setDocs([]);
              create.reset();
            }}
          >
            Put another person on file
          </ActionButton>
          <ActionButton variant="primary" onClick={() => router.push(`${base}/${employee.id}`)}>
            Open the file
          </ActionButton>
        </div>
      </section>
    );
  }

  // --- The form -------------------------------------------------------------------------------
  const willSave = [
    "the file",
    ...(on.pay ? ["a contract"] : []),
    ...(on.account ? ["a pay account"] : []),
    ...(on.emergency ? ["an emergency contact"] : []),
    ...(on.documents && docs.length > 0 ? [`${docs.length} document${docs.length === 1 ? "" : "s"}`] : []),
    ...(on.note ? ["a note"] : []),
  ];

  return (
    <form
      className="@container flex flex-col gap-5 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-1">
        <SectionHeading>New staff file</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Everything a new hire comes with, in one place. The first two parts are the file; tick any of the others to
          save them with it, or add them later on the person&apos;s file.
        </p>
      </div>

      <Group n={1} title="Who they are">
        <Field label="Legal name" hint="As it is written on the ID." htmlFor="hr-legal-name">
          <Input id="hr-legal-name" required value={form.legalName} onChange={(e) => set("legalName")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Called" hint="Optional. What colleagues call them." htmlFor="hr-preferred">
          <Input id="hr-preferred" value={form.preferredName} onChange={(e) => set("preferredName")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="hr-phone">
          <Input id="hr-phone" required inputMode="tel" placeholder="0788 123 456" value={form.phone} onChange={(e) => set("phone")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email" hint="Optional." htmlFor="hr-email">
          <Input id="hr-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Date of birth" htmlFor="hr-dob">
          <Input id="hr-dob" required type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sex">
          <SelectField
            label="Sex"
            value={form.sex}
            onChange={set("sex")}
            placeholder="Choose"
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
        </Field>
        <Field label="ID document">
          <SelectField
            label="ID document"
            value={form.idDocumentType}
            onChange={set("idDocumentType")}
            options={[
              { value: "national_id", label: "National ID" },
              { value: "passport", label: "Passport" },
            ]}
          />
        </Field>
        <Field label="ID number" htmlFor="hr-id-number">
          <Input id="hr-id-number" required value={form.idDocumentNumber} onChange={(e) => set("idDocumentNumber")(e.target.value)} className={inputClass} />
        </Field>
      </Group>

      <Group n={2} title="Their job">
        <Field label="Hired on" htmlFor="hr-hired">
          <Input id="hr-hired" required type="date" value={form.hiredOn} onChange={(e) => set("hiredOn")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Works at">
          <SelectField
            label="Works at"
            value={form.workPropertyId}
            onChange={set("workPropertyId")}
            placeholder="Choose a branch"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Field label="Job position" hint="Optional. Positions are kept under Settings.">
          <SelectField
            label="Job position"
            value={form.jobPositionId}
            onChange={set("jobPositionId")}
            placeholder="None yet"
            options={(positions.data?.items ?? []).filter((p) => p.status === "active").map((p) => ({ value: p.id, label: p.title }))}
          />
        </Field>
        <Field label="Reports to" hint="Optional. It draws the org chart.">
          <SelectField
            label="Reports to"
            value={form.reportingManagerId}
            onChange={set("reportingManagerId")}
            placeholder="Nobody yet"
            options={(colleagues.data ?? []).map((c) => ({ value: c.id, label: c.displayName }))}
          />
        </Field>
        <Field label="RSSB number" hint="Optional now; pay cannot be confirmed without it." htmlFor="hr-rssb">
          <Input id="hr-rssb" value={form.rssbNumber} onChange={(e) => set("rssbNumber")(e.target.value)} className={inputClass} />
        </Field>
      </Group>

      <Optional
        n={3}
        title="Pay"
        hint="Their contract and wage. Nobody is on a pay run without one."
        on={on.pay}
        onChange={(v) => setOn({ ...on, pay: v })}
      >
        <Field label="Contract">
          <SelectField
            label="Contract type"
            value={form.contractType}
            onChange={set("contractType")}
            options={[
              { value: "permanent", label: "Permanent" },
              { value: "fixed_term", label: "Fixed term" },
              { value: "casual", label: "Casual" },
            ]}
          />
        </Field>
        <Field label="Monthly wage (RWF)" hint="Before tax and RSSB." htmlFor="hr-wage">
          <Input id="hr-wage" inputMode="numeric" placeholder="200,000" value={form.wage} onChange={(e) => set("wage")(e.target.value)} className={`${inputClass} pms-num`} />
        </Field>
        <Field label="Starts on" hint="The day they are hired, unless you change it." htmlFor="hr-starts">
          <Input id="hr-starts" type="date" value={startsOn} onChange={(e) => set("startsOn")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Ends on" hint={form.contractType === "fixed_term" ? "Needed for a fixed term." : "Optional."} htmlFor="hr-ends">
          <Input id="hr-ends" type="date" min={startsOn} value={form.endsOn} onChange={(e) => set("endsOn")(e.target.value)} className={inputClass} />
        </Field>
      </Optional>

      <Optional
        n={4}
        title="Where pay goes"
        hint="The bank account or MoMo number their pay is sent to."
        on={on.account}
        onChange={(v) => setOn({ ...on, account: v })}
      >
        <Field label="Paid by">
          <SelectField
            label="Paid by"
            value={form.payKind}
            onChange={set("payKind")}
            options={[
              { value: "momo", label: "MoMo" },
              { value: "bank", label: "Bank transfer" },
            ]}
          />
        </Field>
        {form.payKind === "bank" ? (
          <>
            <Field label="Bank" htmlFor="hr-bank">
              <Input id="hr-bank" placeholder="Bank of Kigali" value={form.bankName} onChange={(e) => set("bankName")(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Account number" htmlFor="hr-account-number">
              <Input id="hr-account-number" inputMode="numeric" value={form.accountNumber} onChange={(e) => set("accountNumber")(e.target.value)} className={`${inputClass} pms-num`} />
            </Field>
            <Field label="Bank branch" hint="Optional." htmlFor="hr-bank-branch">
              <Input id="hr-bank-branch" value={form.bankBranch} onChange={(e) => set("bankBranch")(e.target.value)} className={inputClass} />
            </Field>
          </>
        ) : (
          <Field label="MoMo number" hint="Their phone above, unless pay goes to another number." htmlFor="hr-momo">
            <Input id="hr-momo" inputMode="tel" placeholder={form.phone || "0788 123 456"} value={form.momoPhone} onChange={(e) => set("momoPhone")(e.target.value)} className={inputClass} />
          </Field>
        )}
      </Optional>

      <Optional
        n={5}
        title="Emergency contact"
        hint="Who to call if something happens at work."
        on={on.emergency}
        onChange={(v) => setOn({ ...on, emergency: v })}
      >
        <Field label="Their name" htmlFor="hr-emergency-name">
          <Input id="hr-emergency-name" value={form.emergencyName} onChange={(e) => set("emergencyName")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Their phone" htmlFor="hr-emergency-phone">
          <Input id="hr-emergency-phone" inputMode="tel" placeholder="0788 123 456" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone")(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Who they are to them" htmlFor="hr-emergency-relation">
          <Input id="hr-emergency-relation" placeholder="Sister" value={form.emergencyRelation} onChange={(e) => set("emergencyRelation")(e.target.value)} className={inputClass} />
        </Field>
      </Optional>

      <Optional
        n={6}
        title="Documents"
        hint="The ID copy, the signed contract, a certificate: a PDF or a photo."
        on={on.documents}
        onChange={(v) => setOn({ ...on, documents: v })}
        wide
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-64">
              <Field label="What it is" htmlFor="hr-doc-title">
                <Input id="hr-doc-title" list="hr-doc-usual" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className={inputClass} />
              </Field>
              <datalist id="hr-doc-usual">
                {USUAL_DOCUMENTS.map((title) => (
                  <option key={title} value={title} />
                ))}
              </datalist>
            </div>
            {docTitle.trim().length < 2 ? (
              <ActionButton deniedReason="Say what the document is first.">Choose the file</ActionButton>
            ) : (
              <HrFileInput
                workspaceId={workspaceId}
                purpose="document"
                label="Choose the file"
                onUploaded={(upload, filename) => {
                  setDocs((all) => [...all, { title: docTitle.trim(), fileKey: upload.objectKey, filename }]);
                  // Offer the next usual one that is not attached yet.
                  setDocTitle(USUAL_DOCUMENTS.find((t) => t !== docTitle.trim() && !docs.some((d) => d.title === t)) ?? "");
                }}
              />
            )}
          </div>
          {docs.length > 0 && (
            <ul className="flex flex-col gap-1.5" aria-label="Documents to save with the file">
              {docs.map((doc) => (
                <li key={doc.fileKey} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-ink">{doc.title}</span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">{doc.filename}</span>
                  <button
                    type="button"
                    className="text-2xs font-semibold text-accent-text underline-offset-2 hover:underline"
                    onClick={() => setDocs((all) => all.filter((d) => d.fileKey !== doc.fileKey))}
                  >
                    Take off
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Optional>

      <Optional
        n={7}
        title="A note"
        hint="Anything worth remembering about the hire. Read only by whoever manages staff files."
        on={on.note}
        onChange={(v) => setOn({ ...on, note: v })}
        wide
      >
        <Textarea id="hr-note" aria-label="Note" rows={3} value={form.note} onChange={(e) => set("note")(e.target.value)} />
      </Optional>

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <FormError error={create.error} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="min-w-48 flex-1 text-2xs text-muted-foreground">This saves {willSave.join(", ")}.</span>
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={working !== null}>
          {working ?? "Put on file"}
        </ActionButton>
      </div>
    </form>
  );
}

/** A numbered part of the form that is always filled in. */
function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2.5">
        <Step n={n} />
        <span className="text-sm font-bold text-ink">{title}</span>
      </legend>
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** A numbered part that is saved only when ticked; its fields show only then. */
function Optional({
  n,
  title,
  hint,
  on,
  onChange,
  wide,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** One column: the part is a list or a paragraph, not a pair of fields. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
      <legend className="sr-only">{title}</legend>
      <Checkbox isSelected={on} onChange={onChange} className="flex w-full items-start gap-2.5 text-sm font-normal text-ink">
        <span className="flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <Step n={n} quiet={!on} />
          <span className="font-bold">{title}</span>
          <span className="text-2xs text-muted-foreground">{on ? hint : `${hint} Tick to add it now.`}</span>
        </span>
      </Checkbox>
      {on && <div className={wide ? undefined : "grid grid-cols-1 gap-4 @2xl:grid-cols-2"}>{children}</div>}
    </fieldset>
  );
}

function Step({ n, quiet }: { n: number; quiet?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        quiet
          ? "pms-num grid size-5 shrink-0 place-items-center rounded-full border border-line2 text-2xs font-bold text-muted-foreground"
          : "pms-num grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-bold text-accent-text"
      }
    >
      {n}
    </span>
  );
}
