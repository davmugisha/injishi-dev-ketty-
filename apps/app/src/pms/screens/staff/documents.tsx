"use client";

/**
 * Staff · Documents (058-people-file AC-PF4, AC-PF5).
 *
 * Ask several people for the same document at once, then work what comes back:
 * open it, approve it, or refuse it with a reason they read. A request is a
 * template; each person gets their own document, so one late cook never holds
 * up the others. `people.manage` alone, like every document read.
 *
 * Expiry is read, never stored: a document past its date says so whatever the
 * nightly job did, and its reminder goes out once, the number of days before
 * that the document names.
 */

import type { DocumentFormat, DocumentStatus } from "@injishi/contracts";
import { Checkbox, Input, Textarea } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useEmployees } from "../../data/people";
import { useDocumentRequests, useDocuments, useRequestDocuments } from "../../data/people-file";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { DOCUMENT_STATUS, DocumentRow } from "./employee-records";
import { personOption } from "./hr-audience";
import { Field, FormError, PeoplePicker, RowList, inputClass, rowClass } from "./staff-ui";

const FORMATS: readonly { value: DocumentFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "jpg", label: "JPEG photo" },
  { value: "png", label: "PNG image" },
  { value: "heic", label: "iPhone photo (HEIC)" },
];

export function Documents() {
  const workspaceId = useWorkspaceId();
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState<DocumentStatus | "all">("submitted");
  const requests = useDocumentRequests(workspaceId);
  const documents = useDocuments(workspaceId, status);

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          ID copies, contracts, certificates and permits, kept private and opened only through a link that lasts five
          minutes. Every opening is recorded.
        </span>
        {!asking && (
          <ActionButton variant="primary" onClick={() => setAsking(true)}>
            Ask for a document
          </ActionButton>
        )}
      </div>

      {asking && <AskForm onDone={() => setAsking(false)} />}

      <section>
        <SectionHeading n={requests.data?.requests.length}>Requests</SectionHeading>
        {requests.isPending ? (
          <Skeleton height={80} />
        ) : requests.isError ? (
          <LoadFailed onRetry={() => void requests.refetch()} retrying={requests.isFetching}>
            We couldn&apos;t load the requests. Nothing has changed — this is on our side.
          </LoadFailed>
        ) : requests.data.requests.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            Nothing asked for yet. Ask for the same document from several people at once: everyone&apos;s ID copy,
            every cook&apos;s food handler certificate.
          </EmptyState>
        ) : (
          <RowList>
            {requests.data.requests.map((r, i) => (
              <div key={r.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{r.title}</span>
                  <span className="pms-num text-2xs text-muted-foreground">
                    {[r.formats.join(", ").toUpperCase(), `up to ${r.maxMb} MB`, r.dueOn ? `due ${dshortIso(r.dueOn)}` : null, `asked ${dshortIso(r.createdAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {(["requested", "submitted", "approved", "rejected"] as const).map((s) =>
                  r.counts[s] > 0 ? (
                    <Badge key={s} intent={DOCUMENT_STATUS[s].intent}>
                      {r.counts[s]} {DOCUMENT_STATUS[s].label.toLowerCase()}
                    </Badge>
                  ) : null,
                )}
              </div>
            ))}
          </RowList>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading n={documents.data?.documents.length}>Documents</SectionHeading>
          <div className="w-56">
            <SelectField
              label="Show"
              value={status}
              onChange={(v) => setStatus(v as DocumentStatus | "all")}
              options={[
                { value: "submitted", label: "To review" },
                { value: "requested", label: "Waiting for the file" },
                { value: "rejected", label: "Refused" },
                { value: "approved", label: "Approved" },
                { value: "all", label: "Every document" },
              ]}
            />
          </div>
        </div>
        {documents.isPending ? (
          <Skeleton height={120} />
        ) : documents.isError ? (
          <LoadFailed onRetry={() => void documents.refetch()} retrying={documents.isFetching}>
            We couldn&apos;t load the documents. Nothing on them has changed — this is on our side.
          </LoadFailed>
        ) : documents.data.documents.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            {status === "submitted" ? "Nothing waiting for review." : "No documents here."}
          </EmptyState>
        ) : (
          <RowList>
            {documents.data.documents.map((d, i) => (
              <DocumentRow key={d.id} doc={d} employeeId={d.employee.employeeId} index={i} showPerson />
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}

function AskForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const people = useEmployees(workspaceId, "active");
  const ask = useRequestDocuments(workspaceId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formats, setFormats] = useState<DocumentFormat[]>(["pdf", "jpg"]);
  const [maxMb, setMaxMb] = useState("5");
  const [dueOn, setDueOn] = useState("");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (employeeIds.length === 0 || formats.length === 0) return;
        ask.mutate(
          {
            title,
            description: description.trim() || null,
            formats,
            maxMb: Number(maxMb),
            dueOn: dueOn || null,
            employeeIds,
          },
          {
            onSuccess: () => {
              toast(`Asked ${employeeIds.length} ${employeeIds.length === 1 ? "person" : "people"} for ${title}`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Ask for a document</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Which document" hint="National ID copy, food handler certificate." htmlFor="ask-title">
          <Input id="ask-title" required minLength={2} value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Due by" hint="Optional." htmlFor="ask-due">
          <Input id="ask-due" type="date" min={todayIso()} value={dueOn} onChange={(ev) => setDueOn(ev.target.value)} className={inputClass} />
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Files accepted</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
            {FORMATS.map((f) => (
              <Checkbox
                key={f.value}
                isSelected={formats.includes(f.value)}
                onChange={(on) => setFormats((fs) => (on ? [...fs, f.value] : fs.filter((x) => x !== f.value)))}
                className="flex items-center gap-2 text-sm font-normal text-ink"
              >
                {f.label}
              </Checkbox>
            ))}
          </div>
        </fieldset>
        <Field label="Largest file">
          <SelectField
            label="Largest file"
            value={maxMb}
            onChange={setMaxMb}
            options={[1, 2, 5, 10].map((n) => ({ value: String(n), label: `${n} MB` }))}
          />
        </Field>
      </div>
      <Field label="A note for them" hint="Optional: which pages, how recent." htmlFor="ask-description">
        <Textarea id="ask-description" value={description} onChange={(ev) => setDescription(ev.target.value)} rows={2} />
      </Field>
      <Field label="Who to ask">
        <PeoplePicker
          label="People to ask"
          people={(people.data ?? []).map(personOption)}
          selected={employeeIds}
          onChange={setEmployeeIds}
        />
      </Field>
      <FormError error={ask.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          type="submit"
          pending={ask.isPending}
          deniedReason={
            employeeIds.length === 0 ? "Choose who to ask." : formats.length === 0 ? "Accept at least one kind of file." : undefined
          }
        >
          Ask {employeeIds.length > 0 ? `${employeeIds.length} ${employeeIds.length === 1 ? "person" : "people"}` : ""}
        </ActionButton>
      </div>
    </form>
  );
}
