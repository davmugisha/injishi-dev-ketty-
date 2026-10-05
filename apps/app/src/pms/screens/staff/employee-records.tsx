"use client";

/**
 * The record tabs of one staff file (058-people-file AC-PF3, AC-PF4, AC-PF6,
 * AC-PF8): documents, pay accounts, notes and discipline.
 *
 * Each is mounted only when the grant reads it (`FILE_LENSES` in
 * `employee-file.tsx`), and each read asks `useMayRead` itself, so a tab
 * reached by a typed URL still never fires a refused read.
 *
 * **Nothing private is a link in the page.** A document, a note's attachment
 * or a disciplinary letter opens through `openFileLink`, which asks for a five
 * minute link at the moment of the click; the server records every fetch.
 */

import {
  type DisciplinaryKind,
  type DocumentStatus,
  type EmployeeDocument,
  type EmployeeFile,
  type LengthUnit,
} from "@injishi/contracts";
import { Checkbox, Input, Textarea } from "@injishi/ui";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { humanError } from "../../data/api";
import { useWorkspaceId } from "../../data/capability";
import {
  openFileLink,
  useAddNote,
  useAddPayAccount,
  useChangePayAccount,
  useDecideDocument,
  useDiscipline,
  useDocumentDates,
  useEmployeeNotes,
  useHrCatalog,
  usePayAccounts,
  usePersonDocuments,
  useRecordDiscipline,
  useUploadDocument,
} from "../../data/people-file";
import { dshortIso, kigaliDateOf, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { HrFileInput } from "./hr-file-input";
import { Field, FormError, RowList, clock, inputClass, rowClass } from "./staff-ui";

/** A date as people read it, with the year: `05 Oct 2026`. */
function longDate(iso: string): string {
  return `${dshortIso(iso)} ${iso.slice(0, 4)}`;
}

/** When something was written: `05 Oct 2026, 14:20`, in Kigali. */
function when(timestamp: string): string {
  return `${longDate(kigaliDateOf(timestamp))}, ${clock(timestamp)}`;
}

/** Open a private file, saying so in a toast when the link could not be had. */
function useOpen(): (path: string) => void {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  return (path: string) => {
    if (!workspaceId) return;
    openFileLink(workspaceId, path).catch((error: unknown) => toast(humanError(error), "bad"));
  };
}

// --- Documents (AC-PF4, AC-PF5) -------------------------------------------------------

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; intent: "info" | "warn" | "ok" | "bad" }> = {
  requested: { label: "Waiting for the file", intent: "info" },
  submitted: { label: "To review", intent: "warn" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Refused", intent: "bad" },
};

export function DocumentsTab({ file }: { file: EmployeeFile }) {
  const workspaceId = useWorkspaceId();
  const e = file.employee;
  const docs = usePersonDocuments(workspaceId, e.id);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading n={docs.data?.documents.length}>Documents</SectionHeading>
        {!adding && <ActionButton onClick={() => setAdding(true)}>Add a document</ActionButton>}
      </div>
      {adding && <AddDocument employeeId={e.id} onDone={() => setAdding(false)} />}
      {docs.isPending ? (
        <Skeleton height={120} />
      ) : docs.isError ? (
        <LoadFailed onRetry={() => void docs.refetch()} retrying={docs.isFetching}>
          We couldn&apos;t load this person&apos;s documents. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : docs.data.documents.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">
          No documents yet. Request one from the Documents lens, or add one here: an ID copy, a contract
          scan, a certificate.
        </EmptyState>
      ) : (
        <RowList>
          {docs.data.documents.map((d, i) => (
            <DocumentRow key={d.id} doc={d} employeeId={e.id} index={i} />
          ))}
        </RowList>
      )}
    </section>
  );
}

/** One document with what may be done to it at its status. Shared with the Documents lens. */
export function DocumentRow({ doc, employeeId, index, showPerson }: { doc: EmployeeDocument; employeeId: string; index: number; showPerson?: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const open = useOpen();
  const uploadDoc = useUploadDocument(workspaceId);
  const decide = useDecideDocument(workspaceId);
  const dates = useDocumentDates(workspaceId);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const [dating, setDating] = useState(false);
  const [draft, setDraft] = useState({
    issuedOn: doc.issuedOn ?? "",
    expiresOn: doc.expiresOn ?? "",
    remindDaysBefore: doc.remindDaysBefore === null ? "" : String(doc.remindDaysBefore),
  });
  const status = DOCUMENT_STATUS[doc.status];
  const error = uploadDoc.error ?? decide.error ?? dates.error;

  return (
    <div className={`${rowClass(index)} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">
            {showPerson ? `${doc.employee.displayName} · ` : ""}
            {doc.title}
          </span>
          <span className="pms-num text-2xs text-muted-foreground">
            {[
              doc.requestId ? `Asked for ${doc.formats.join(", ").toUpperCase()}, up to ${doc.maxMb} MB` : "Added without a request",
              doc.dueOn && doc.status === "requested" ? `due ${longDate(doc.dueOn)}` : null,
              doc.expiresOn ? `expires ${longDate(doc.expiresOn)}` : null,
              doc.versions.length > 1 ? `${doc.versions.length} uploads` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {doc.status === "rejected" && doc.rejectReason && (
            <span className="text-2xs text-danger">Refused: {doc.rejectReason}</span>
          )}
        </span>
        {doc.expired && <Badge intent="bad">Expired</Badge>}
        <Badge intent={status.intent}>{status.label}</Badge>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {doc.versions.length > 0 && <ActionButton onClick={() => open(`/ops/documents/${doc.id}/file`)}>Open the file</ActionButton>}
        {(doc.status === "requested" || doc.status === "rejected") && (
          <HrFileInput
            workspaceId={workspaceId}
            purpose="document"
            label={doc.status === "rejected" ? "Upload a new copy" : "Upload the file"}
            onUploaded={(up) =>
              uploadDoc.mutate(
                { id: employeeId, body: { documentId: doc.id, fileKey: up.objectKey } },
                { onSuccess: () => toast(`${doc.title} uploaded`, "ok") },
              )
            }
          />
        )}
        {doc.status === "submitted" && !refusing && (
          <>
            <ActionButton
              variant="primary"
              pending={decide.isPending}
              onClick={() =>
                decide.mutate({ documentId: doc.id, body: { decision: "approve" } }, { onSuccess: () => toast(`${doc.title} approved`, "ok") })
              }
            >
              Approve
            </ActionButton>
            <ActionButton onClick={() => setRefusing(true)}>Refuse</ActionButton>
          </>
        )}
        {!dating && <ActionButton onClick={() => setDating(true)}>Dates and reminder</ActionButton>}
      </div>
      {refusing && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            decide.mutate(
              { documentId: doc.id, body: { decision: "reject", reason } },
              {
                onSuccess: () => {
                  toast(`${doc.title} refused`, "ok");
                  setRefusing(false);
                  setReason("");
                },
              },
            );
          }}
        >
          <div className="min-w-60 flex-1">
            <Field label="Why it is refused" hint="The person reads this, so say what to fix." htmlFor={`doc-reason-${doc.id}`}>
              <Input id={`doc-reason-${doc.id}`} required minLength={3} value={reason} onChange={(ev) => setReason(ev.target.value)} className={inputClass} />
            </Field>
          </div>
          <ActionButton type="button" onClick={() => setRefusing(false)}>
            Cancel
          </ActionButton>
          <ActionButton variant="primary" type="submit" pending={decide.isPending}>
            Refuse it
          </ActionButton>
        </form>
      )}
      {dating && (
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            dates.mutate(
              {
                documentId: doc.id,
                body: {
                  issuedOn: draft.issuedOn || null,
                  expiresOn: draft.expiresOn || null,
                  remindDaysBefore: draft.remindDaysBefore === "" ? null : Number(draft.remindDaysBefore),
                },
              },
              {
                onSuccess: () => {
                  toast("Dates saved", "ok");
                  setDating(false);
                },
              },
            );
          }}
        >
          <Field label="Issued on" htmlFor={`doc-issued-${doc.id}`}>
            <Input id={`doc-issued-${doc.id}`} type="date" value={draft.issuedOn} onChange={(ev) => setDraft({ ...draft, issuedOn: ev.target.value })} className={inputClass} />
          </Field>
          <Field label="Expires on" htmlFor={`doc-expires-${doc.id}`}>
            <Input id={`doc-expires-${doc.id}`} type="date" value={draft.expiresOn} onChange={(ev) => setDraft({ ...draft, expiresOn: ev.target.value })} className={inputClass} />
          </Field>
          <Field label="Remind days before" hint="Moving either clears the reminder." htmlFor={`doc-remind-${doc.id}`}>
            <Input id={`doc-remind-${doc.id}`} type="number" min={0} max={365} value={draft.remindDaysBefore} onChange={(ev) => setDraft({ ...draft, remindDaysBefore: ev.target.value })} className={inputClass} />
          </Field>
          <div className="flex items-end gap-2">
            <ActionButton type="button" onClick={() => setDating(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" type="submit" pending={dates.isPending}>
              Save dates
            </ActionButton>
          </div>
        </form>
      )}
      <FormError error={error} />
    </div>
  );
}

function AddDocument({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const uploadDoc = useUploadDocument(workspaceId);
  const [title, setTitle] = useState("");
  const [fileKey, setFileKey] = useState<{ key: string; name: string } | null>(null);
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [remind, setRemind] = useState("");

  return (
    <form
      className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!fileKey) return;
        uploadDoc.mutate(
          {
            id: employeeId,
            body: {
              title,
              fileKey: fileKey.key,
              issuedOn: issuedOn || null,
              expiresOn: expiresOn || null,
              remindDaysBefore: remind === "" ? null : Number(remind),
            },
          },
          {
            onSuccess: () => {
              toast(`${title} added`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="What it is" hint="Food handler certificate, work permit, signed contract." htmlFor="doc-new-title">
          <Input id="doc-new-title" required minLength={2} value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="The file" hint="PDF, JPEG, PNG or HEIC, up to 10 MB.">
          <span className="flex flex-wrap items-center gap-2">
            <HrFileInput workspaceId={workspaceId} purpose="document" label={fileKey ? "Choose another" : "Choose the file"} onUploaded={(up, name) => setFileKey({ key: up.objectKey, name })} />
            {fileKey && <span className="text-2xs text-muted-foreground">{fileKey.name}</span>}
          </span>
        </Field>
        <Field label="Issued on" hint="Optional." htmlFor="doc-new-issued">
          <Input id="doc-new-issued" type="date" value={issuedOn} onChange={(ev) => setIssuedOn(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Expires on" hint="Optional." htmlFor="doc-new-expires">
          <Input id="doc-new-expires" type="date" value={expiresOn} onChange={(ev) => setExpiresOn(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Remind days before it expires" hint="Optional; a reminder goes out once." htmlFor="doc-new-remind">
          <Input id="doc-new-remind" type="number" min={0} max={365} value={remind} onChange={(ev) => setRemind(ev.target.value)} className={inputClass} />
        </Field>
      </div>
      <FormError error={uploadDoc.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={uploadDoc.isPending} deniedReason={fileKey ? undefined : "Choose the file first."}>
          Add the document
        </ActionButton>
      </div>
    </form>
  );
}

// --- Pay accounts (AC-PF3) --------------------------------------------------------------

export function PayTab({ file }: { file: EmployeeFile }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const e = file.employee;
  const accounts = usePayAccounts(workspaceId, e.id);
  const change = useChangePayAccount(workspaceId);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading>Pay accounts</SectionHeading>
        {!adding && <ActionButton onClick={() => setAdding(true)}>Add an account</ActionButton>}
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        Pay goes to the primary account. Changing it tells the person, through the contacts they had before the
        change, and the owner, so a salary is never moved in silence.
      </p>
      {adding && <AddPayAccount employeeId={e.id} onDone={() => setAdding(false)} />}
      {accounts.isPending ? (
        <Skeleton height={80} />
      ) : accounts.isError ? (
        <LoadFailed onRetry={() => void accounts.refetch()} retrying={accounts.isFetching}>
          We couldn&apos;t load the pay accounts. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : accounts.data.accounts.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">No account yet. Add the bank account or MoMo number pay goes to.</EmptyState>
      ) : (
        <RowList>
          {accounts.data.accounts.map((a, i) => (
            <div key={a.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{a.kind === "bank" ? a.bankName : "MoMo"}</span>
                <span className="pms-num text-2xs text-muted-foreground">
                  {a.kind === "bank" ? [a.accountNumber, a.branchName].filter(Boolean).join(" · ") : a.momoPhone}
                </span>
              </span>
              {a.isPrimary && <Badge intent="ok">Primary</Badge>}
              {a.status === "retired" && <Badge>Retired</Badge>}
              {a.status === "active" && !a.isPrimary && (
                <ActionButton
                  pending={change.isPending}
                  onClick={() =>
                    change.mutate({ accountId: a.id, body: { action: "make_primary" } }, { onSuccess: () => toast("Primary account changed", "ok") })
                  }
                >
                  Make primary
                </ActionButton>
              )}
              {a.status === "active" && (
                <ActionButton
                  onClick={() =>
                    change.mutate({ accountId: a.id, body: { action: "retire" } }, { onSuccess: () => toast("Account retired", "ok") })
                  }
                >
                  Retire
                </ActionButton>
              )}
            </div>
          ))}
        </RowList>
      )}
      <FormError error={change.error} />
    </section>
  );
}

function AddPayAccount({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const add = useAddPayAccount(workspaceId);
  const [kind, setKind] = useState<"bank" | "momo">("bank");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [momoPhone, setMomoPhone] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);

  return (
    <form
      className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        add.mutate(
          {
            id: employeeId,
            body:
              kind === "bank"
                ? { kind, bankName, accountNumber, branchName: branchName.trim() || null, makePrimary }
                : { kind, momoPhone, makePrimary },
          },
          {
            onSuccess: () => {
              toast("Account added", "ok");
              onDone();
            },
          },
        );
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Paid by">
          <SelectField
            label="Paid by"
            value={kind}
            onChange={(v) => setKind(v as "bank" | "momo")}
            options={[
              { value: "bank", label: "Bank transfer" },
              { value: "momo", label: "MoMo" },
            ]}
          />
        </Field>
        {kind === "bank" ? (
          <>
            <Field label="Bank" htmlFor="pay-bank">
              <Input id="pay-bank" required value={bankName} onChange={(ev) => setBankName(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Account number" htmlFor="pay-number">
              <Input id="pay-number" required inputMode="numeric" value={accountNumber} onChange={(ev) => setAccountNumber(ev.target.value)} className={inputClass} />
            </Field>
            <Field label="Bank branch" hint="Optional." htmlFor="pay-branch">
              <Input id="pay-branch" value={branchName} onChange={(ev) => setBranchName(ev.target.value)} className={inputClass} />
            </Field>
          </>
        ) : (
          <Field label="MoMo number" htmlFor="pay-momo">
            <Input id="pay-momo" required inputMode="tel" placeholder="0788 123 456" value={momoPhone} onChange={(ev) => setMomoPhone(ev.target.value)} className={inputClass} />
          </Field>
        )}
      </div>
      <Checkbox isSelected={makePrimary} onChange={setMakePrimary} className="flex items-center gap-2 text-sm font-normal text-ink">
        Pay goes here from now on (the first account always does)
      </Checkbox>
      <FormError error={add.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={add.isPending}>
          Add the account
        </ActionButton>
      </div>
    </form>
  );
}

// --- Notes (AC-PF6) ---------------------------------------------------------------------------

export function NotesTab({ file }: { file: EmployeeFile }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const open = useOpen();
  const e = file.employee;
  const notes = useEmployeeNotes(workspaceId, e.id);
  const add = useAddNote(workspaceId);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  return (
    <section>
      <SectionHeading n={notes.data?.notes.length}>Notes</SectionHeading>
      <p className="mt-1 text-2xs text-muted-foreground">
        Private to people who manage staff files. A note is never edited; write another to correct it. Reading this
        tab is recorded.
      </p>
      <form
        className="mt-2.5 flex flex-col gap-3 rounded-card border border-card-bd bg-card p-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          add.mutate(
            { id: e.id, body: { body, fileKeys: files.map((f) => f.key) } },
            {
              onSuccess: () => {
                toast("Note added", "ok");
                setBody("");
                setFiles([]);
              },
            },
          );
        }}
      >
        <Field label="New note" htmlFor="note-body">
          <Textarea id="note-body" required value={body} onChange={(ev) => setBody(ev.target.value)} rows={3} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {files.length < 5 && (
            <HrFileInput
              workspaceId={workspaceId}
              purpose="attachment"
              label="Attach a file"
              onUploaded={(up, name) => setFiles((f) => [...f, { key: up.objectKey, name }])}
            />
          )}
          {files.map((f) => (
            <Badge key={f.key}>{f.name}</Badge>
          ))}
          <span className="flex-1" />
          <ActionButton variant="primary" type="submit" pending={add.isPending}>
            Add the note
          </ActionButton>
        </div>
        <FormError error={add.error} />
      </form>
      {notes.isPending ? (
        <Skeleton height={80} />
      ) : notes.isError ? (
        <LoadFailed onRetry={() => void notes.refetch()} retrying={notes.isFetching}>
          We couldn&apos;t load the notes. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : notes.data.notes.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">No notes yet.</EmptyState>
      ) : (
        <RowList>
          {notes.data.notes.map((n, i) => (
            <div key={n.id} className={`${rowClass(i)} flex flex-col gap-1.5`}>
              <p className="text-sm whitespace-pre-wrap text-ink">{n.body}</p>
              <span className="text-2xs text-muted-foreground">
                {n.authorName ?? "Someone"} · {when(n.createdAt)}
              </span>
              {n.fileKeys.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {n.fileKeys.map((_, index) => (
                    <ActionButton key={index} onClick={() => open(`/ops/employees/${e.id}/notes/${n.id}/files/${index}`)}>
                      Attachment {index + 1}
                    </ActionButton>
                  ))}
                </span>
              )}
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

// --- Discipline (AC-PF8) -----------------------------------------------------------------------

export const DISCIPLINE_KIND: Record<DisciplinaryKind, { label: string; intent: "info" | "warn" | "bad" }> = {
  warning: { label: "Warning", intent: "info" },
  suspension: { label: "Suspension", intent: "warn" },
  dismissal: { label: "Dismissal", intent: "bad" },
};

export function DisciplineTab({ file, workBase }: { file: EmployeeFile; workBase: string }) {
  const workspaceId = useWorkspaceId();
  const open = useOpen();
  const e = file.employee;
  const records = useDiscipline(workspaceId, e.id);
  const [recording, setRecording] = useState(false);
  const [offer, setOffer] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeading n={records.data?.actions.length}>Discipline</SectionHeading>
        {!recording && e.status === "active" && <ActionButton onClick={() => setRecording(true)}>Record an action</ActionButton>}
      </div>
      {offer && (
        <div role="status" className="mt-2.5 rounded-card border border-card-bd bg-warn-bg px-5 py-4 text-sm text-ink">
          A dismissal is recorded, and nobody is offboarded by it.{" "}
          <Link href={`${workBase}#leaving`} className="font-semibold text-foreground underline">
            Start offboarding {e.displayName}
          </Link>{" "}
          when the last day is known.
        </div>
      )}
      {recording && (
        <RecordDiscipline
          employeeIds={[e.id]}
          onDone={(dismissal) => {
            setRecording(false);
            setOffer(dismissal);
          }}
        />
      )}
      {records.isPending ? (
        <Skeleton height={80} />
      ) : records.isError ? (
        <LoadFailed onRetry={() => void records.refetch()} retrying={records.isFetching}>
          We couldn&apos;t load the records. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : records.data.actions.length === 0 ? (
        <EmptyState className="mt-2.5 p-5">Nothing recorded.</EmptyState>
      ) : (
        <RowList>
          {records.data.actions.map((a, i) => (
            <div key={a.id} className={`${rowClass(i)} flex flex-col gap-1.5`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm font-semibold text-ink">{a.type.title}</span>
                <Badge intent={DISCIPLINE_KIND[a.type.kind].intent}>{DISCIPLINE_KIND[a.type.kind].label}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink2">{a.description}</p>
              <span className="pms-num text-2xs text-muted-foreground">
                {[
                  `From ${longDate(a.startsOn)}`,
                  a.length && a.unit ? `${a.length} ${a.length === 1 ? a.unit.slice(0, -1) : a.unit}` : null,
                  `recorded by ${a.createdByName ?? "someone"} on ${when(a.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {a.hasFile && (
                <span>
                  <ActionButton onClick={() => open(`/ops/disciplinary-actions/${a.id}/file`)}>Open the letter</ActionButton>
                </span>
              )}
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

/**
 * Record one action against the people named: one row each, so nobody's record
 * shows who else was named. Shared with the Discipline lens. Answers whether
 * the type was a dismissal, so the caller can offer offboarding (AC-PF8).
 */
export function RecordDiscipline({
  employeeIds,
  onDone,
  children,
}: {
  employeeIds: readonly string[];
  onDone: (dismissal: boolean) => void;
  /** Anything to ask before the details, such as who it is for. */
  children?: ReactNode;
}) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const types = useHrCatalog(workspaceId, "disciplinary-types");
  const record = useRecordDiscipline(workspaceId);
  const [typeId, setTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<LengthUnit | "">("");
  const [length, setLength] = useState("");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [letter, setLetter] = useState<{ key: string; name: string } | null>(null);
  const active = (types.data?.items ?? []).filter((t) => t.status === "active");

  return (
    <form
      className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        // The button says why while either is missing; a submit by Enter must not send it anyway.
        if (!typeId || employeeIds.length === 0) return;
        record.mutate(
          {
            employeeIds: [...employeeIds],
            typeId,
            description,
            unit: unit || null,
            length: unit && length ? Number(length) : null,
            startsOn,
            fileKey: letter?.key ?? null,
          },
          {
            onSuccess: (r) => {
              toast(r.actions.length === 1 ? "Recorded" : `Recorded for ${r.actions.length} people, one record each`, "ok");
              onDone(r.offerOffboarding);
            },
          },
        );
      }}
    >
      {children}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type" hint={active.length === 0 ? "Add the types your business uses under Configuration first." : undefined}>
          <SelectField
            label="Type"
            value={typeId}
            onChange={setTypeId}
            placeholder="Choose"
            options={active.map((t) => ({ value: t.id, label: `${t.title}${t.kind ? ` (${DISCIPLINE_KIND[t.kind].label.toLowerCase()})` : ""}` }))}
          />
        </Field>
        <Field label="Starts on" htmlFor="discipline-starts">
          <Input id="discipline-starts" required type="date" value={startsOn} onChange={(ev) => setStartsOn(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Length" hint="Optional, for a suspension.">
          <SelectField
            label="Length unit"
            value={unit}
            onChange={(v) => setUnit(v as LengthUnit | "")}
            placeholder="No length"
            options={[
              { value: "days", label: "Days" },
              { value: "hours", label: "Hours" },
            ]}
          />
        </Field>
        {unit && (
          <Field label={`How many ${unit}`} htmlFor="discipline-length">
            <Input id="discipline-length" required type="number" min={1} max={365} value={length} onChange={(ev) => setLength(ev.target.value)} className={inputClass} />
          </Field>
        )}
      </div>
      <Field label="What happened" htmlFor="discipline-description">
        <Textarea id="discipline-description" required minLength={3} value={description} onChange={(ev) => setDescription(ev.target.value)} rows={3} />
      </Field>
      <span className="flex flex-wrap items-center gap-2">
        <HrFileInput
          workspaceId={workspaceId}
          purpose="attachment"
          label={letter ? "Choose another letter" : "Attach a letter"}
          onUploaded={(up, name) => setLetter({ key: up.objectKey, name })}
        />
        {letter && <span className="text-2xs text-muted-foreground">{letter.name}</span>}
      </span>
      <FormError error={record.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={() => onDone(false)}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={record.isPending}
          deniedReason={!typeId ? "Choose a type first." : employeeIds.length === 0 ? "Choose who it is for." : undefined}
        >
          Record it
        </ActionButton>
      </div>
    </form>
  );
}
