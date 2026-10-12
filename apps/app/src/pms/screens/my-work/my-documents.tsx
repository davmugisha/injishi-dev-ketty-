"use client";

/**
 * My work · My documents (ADR-058, 058-self-service; 058-people-file AC-PF4).
 *
 * The papers the office keeps on a person's file: an ID copy, a certificate,
 * the signed contract. A document used to reach a file by being carried to the
 * office, who uploaded it for them. Here the person hands it in themselves:
 * for a document the office asked of them, or one nobody asked for.
 *
 * HANDING IN IS NOT APPROVAL. What a person sends is a version waiting to be
 * checked, and the page says so in the words a person uses: "the office is
 * checking it", "approved", "sent back" with the office's reason and a way to
 * send another. A document already approved has no upload button: a new copy
 * of it is the office's to ask for.
 *
 * It reads and writes the caller's own file only; every route answers 404 for
 * anybody else's.
 */

import type { EmployeeDocument } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useRef, useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading } from "../../components/ui";
import { humanError } from "../../data/api";
import { uploadMyDocumentFile, useHandInDocument, useMyDocuments } from "../../data/my-work";
import { dshortIso, kigaliDateOf } from "../../lib/format";
import { usePms } from "../../store";
import { Field, FormError, RowList, inputClass, rowClass } from "../staff/staff-ui";
import { Loading, Panel } from "./my-work-ui";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/heic";

/** What a new hire usually brings; a title of one's own works as well. */
const USUAL = ["ID copy", "CV", "Certificate", "Signed contract", "Driving licence"];

const STATE: Record<EmployeeDocument["status"], { label: string; intent: "warn" | "info" | "ok" | "bad" }> = {
  requested: { label: "The office is waiting for it", intent: "warn" },
  submitted: { label: "The office is checking it", intent: "info" },
  approved: { label: "Approved", intent: "ok" },
  rejected: { label: "Sent back", intent: "bad" },
};

/** Choose one file and hand it to `onFile`. The picker is narrowed to what the server takes. */
function PickFile({ label, primary, pending, onFile }: { label: string; primary?: boolean; pending: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          // The same file chosen again is a new choice, not no change.
          ev.target.value = "";
          if (file) onFile(file);
        }}
      />
      <ActionButton variant={primary ? "primary" : "secondary"} pending={pending} onClick={() => input.current?.click()}>
        {pending ? "Sending" : label}
      </ActionButton>
    </>
  );
}

export function MyDocuments({ employeeId }: { employeeId: string }) {
  const { toast } = usePms();
  const documents = useMyDocuments(employeeId);
  const handIn = useHandInDocument(employeeId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(USUAL[0]);
  // Which upload is on the wire: a document's id, or "new".
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ at: string; message: string } | null>(null);

  const all = documents.data?.documents ?? [];
  // What the office is waiting for comes first: it is the reason most people open this.
  const wanted = all.filter((d) => d.status === "requested" || d.status === "rejected");
  const rest = all.filter((d) => d.status === "submitted" || d.status === "approved");

  /** The file first, then the document that names it: for one the office asked for, or a new one. */
  async function send(file: File, target: { documentId: string } | { title: string }) {
    const at = "documentId" in target ? target.documentId : "new";
    if (sending) return;
    setSending(at);
    setProblem(null);
    try {
      const stored = await uploadMyDocumentFile(employeeId, file);
      const saved = await handIn.mutateAsync({ ...target, fileKey: stored.key });
      toast(`${saved.title} sent. The office checks it before it counts.`, "ok");
      if (at === "new") setAdding(false);
    } catch (error) {
      setProblem({ at, message: humanError(error) });
    } finally {
      setSending(null);
    }
  }

  const row = (d: EmployeeDocument, index: number) => {
    const state = STATE[d.status];
    const sent = d.versions[0]?.uploadedAt;
    return (
      <div key={d.id} className={`${rowClass(index)} flex flex-wrap items-center gap-x-4 gap-y-1.5`} data-my-document={d.id}>
        <span className="flex min-w-44 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-ink">{d.title}</span>
          <span className="text-2xs text-muted-foreground">
            {d.status === "requested"
              ? d.dueOn
                ? `Wanted by ${dshortIso(d.dueOn)}`
                : "Not handed in yet"
              : sent
                ? `Sent ${dshortIso(kigaliDateOf(sent))}`
                : ""}
            {d.expiresOn ? ` · ${d.expired ? "expired" : "valid to"} ${dshortIso(d.expiresOn)}` : ""}
          </span>
          {d.status === "rejected" && d.rejectReason && <span className="text-2xs text-bad">The office said: {d.rejectReason}</span>}
          {problem?.at === d.id && (
            <span role="alert" className="text-2xs text-danger">
              {problem.message}
            </span>
          )}
        </span>
        <Badge intent={d.expired && d.status === "approved" ? "warn" : state.intent}>{d.expired && d.status === "approved" ? "Expired" : state.label}</Badge>
        {(d.status === "requested" || d.status === "rejected") && (
          <PickFile
            label={d.status === "rejected" ? "Send another" : "Upload it"}
            primary
            pending={sending === d.id}
            onFile={(file) => void send(file, { documentId: d.id })}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          The papers on your file: your ID copy, certificates, your contract. Send one from here and the office checks
          it before it counts.
        </p>
        {!adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Hand in a document
          </ActionButton>
        )}
      </div>

      {adding && (
        <Panel className="flex flex-col gap-3.5 px-5 py-4">
          <SectionHeading>Hand in a document</SectionHeading>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-full @xl:w-72">
              <Field label="What it is" htmlFor="my-doc-title">
                <Input id="my-doc-title" list="my-doc-usual" maxLength={120} value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputClass} />
              </Field>
              <datalist id="my-doc-usual">
                {USUAL.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            {title.trim().length < 2 ? (
              <ActionButton variant="primary" deniedReason="Say what the document is first.">
                Choose the file and send
              </ActionButton>
            ) : (
              <PickFile label="Choose the file and send" primary pending={sending === "new"} onFile={(file) => void send(file, { title: title.trim() })} />
            )}
            <ActionButton onClick={() => setAdding(false)}>Cancel</ActionButton>
          </div>
          {/* Under the row, not under the field: a hint there would push the buttons off the input's line. */}
          <p className="text-2xs text-muted-foreground">A PDF or a photo, 10 MB at most.</p>
          {problem?.at === "new" && <FormError error={new Error(problem.message)} />}
        </Panel>
      )}

      {documents.isPending ? (
        <Loading rows={2} />
      ) : documents.isError ? (
        <LoadFailed onRetry={() => void documents.refetch()} retrying={documents.isFetching}>
          We couldn&apos;t load your documents. Nothing is lost. Try again.
        </LoadFailed>
      ) : all.length === 0 ? (
        <EmptyState>Nothing on your file yet. Hand in your ID copy or a certificate and it shows here.</EmptyState>
      ) : (
        <>
          {wanted.length > 0 && (
            <div className="flex flex-col gap-0">
              <SectionHeading n={wanted.length}>The office is waiting for</SectionHeading>
              <RowList>{wanted.map(row)}</RowList>
            </div>
          )}
          {rest.length > 0 && (
            <div className="flex flex-col gap-0">
              <SectionHeading n={rest.length}>What you have handed in</SectionHeading>
              <RowList>{rest.map(row)}</RowList>
            </div>
          )}
        </>
      )}
    </div>
  );
}
