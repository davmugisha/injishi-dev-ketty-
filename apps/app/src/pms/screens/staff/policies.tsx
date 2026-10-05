"use client";

/**
 * Staff · Policies (058-people-file AC-PF7).
 *
 * House rules and handbook pages, published to everyone or to chosen
 * departments, positions and people. Read by anyone who holds an HR
 * permission, because a policy is the business's, not a person's; published,
 * changed and archived by `people.manage`. A policy is archived, never deleted.
 */

import type { HrTargets, StaffPolicy } from "@injishi/contracts";
import { Input, Textarea } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { humanError } from "../../data/api";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { openFileLink, useCreatePolicy, usePolicies, useUpdatePolicy } from "../../data/people-file";
import { dshortIso } from "../../lib/format";
import { usePms } from "../../store";
import { AudienceFields, NO_TARGETS, audienceText } from "./hr-audience";
import { HrFileInput } from "./hr-file-input";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

export function Policies() {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const policies = usePolicies(workspaceId);
  const [writing, setWriting] = useState(false);
  const mayManage = can("people.manage");
  const published = (policies.data?.policies ?? []).filter((p) => p.status === "published");
  const archived = (policies.data?.policies ?? []).filter((p) => p.status === "archived");

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          The rules everyone works by. Staff with an account read the ones meant for them on their phone; print them for
          staff without one.
        </span>
        {mayManage && !writing && (
          <ActionButton variant="primary" onClick={() => setWriting(true)}>
            Publish a policy
          </ActionButton>
        )}
      </div>
      {writing && <PolicyForm onDone={() => setWriting(false)} />}
      {policies.isPending ? (
        <Skeleton height={140} />
      ) : policies.isError ? (
        <LoadFailed onRetry={() => void policies.refetch()} retrying={policies.isFetching}>
          We couldn&apos;t load the policies. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : (
        <>
          <section>
            <SectionHeading n={published.length}>Published</SectionHeading>
            {published.length === 0 ? (
              <EmptyState className="mt-2.5 p-5">
                No policy yet. {mayManage ? "Start with the one people ask about most: uniform, breaks or leave." : "Whoever manages staff files publishes them."}
              </EmptyState>
            ) : (
              <RowList>
                {published.map((p, i) => (
                  <PolicyRow key={p.id} policy={p} index={i} mayManage={mayManage} />
                ))}
              </RowList>
            )}
          </section>
          {archived.length > 0 && (
            <section>
              <SectionHeading n={archived.length}>Archived</SectionHeading>
              <RowList>
                {archived.map((p, i) => (
                  <PolicyRow key={p.id} policy={p} index={i} mayManage={mayManage} />
                ))}
              </RowList>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PolicyRow({ policy, index, mayManage }: { policy: StaffPolicy; index: number; mayManage: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const update = useUpdatePolicy(workspaceId);
  const [open, setOpen] = useState(false);
  const archived = policy.status === "archived";

  return (
    <div className={`${rowClass(index)} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <span className="text-sm font-semibold text-ink">{policy.title}</span>
          <span className="text-2xs text-muted-foreground">
            For {audienceText(policy.audience, policy.targets).toLowerCase()} · updated {dshortIso(policy.updatedAt)}
            {policy.fileKeys.length > 0 ? ` · ${policy.fileKeys.length} attachment${policy.fileKeys.length === 1 ? "" : "s"}` : ""}
          </span>
        </button>
        {archived && <Badge>Archived</Badge>}
        {mayManage && (
          <ActionButton
            pending={update.isPending}
            onClick={() =>
              update.mutate(
                { id: policy.id, body: { status: archived ? "published" : "archived" } },
                { onSuccess: () => toast(archived ? "Published again" : "Archived", "ok") },
              )
            }
          >
            {archived ? "Publish again" : "Archive"}
          </ActionButton>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <p className="text-sm whitespace-pre-wrap text-ink2">{policy.body}</p>
          {policy.fileKeys.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {policy.fileKeys.map((_, i) => (
                <ActionButton
                  key={i}
                  onClick={() =>
                    workspaceId &&
                    openFileLink(workspaceId, `/ops/policies/${policy.id}/files/${i}`).catch((e: unknown) => toast(humanError(e), "bad"))
                  }
                >
                  Attachment {i + 1}
                </ActionButton>
              ))}
            </span>
          )}
        </div>
      )}
      <FormError error={update.error} />
    </div>
  );
}

function PolicyForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const create = useCreatePolicy(workspaceId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "targeted">("all");
  const [targets, setTargets] = useState<HrTargets>(NO_TARGETS);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        create.mutate(
          { title, body, audience, ...(audience === "targeted" ? { targets } : {}), fileKeys: files.map((f) => f.key) },
          {
            onSuccess: () => {
              toast(`${title} published`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Publish a policy</SectionHeading>
      <Field label="Title" htmlFor="policy-title">
        <Input id="policy-title" required minLength={2} value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputClass} />
      </Field>
      <Field label="The policy" htmlFor="policy-body">
        <Textarea id="policy-body" required value={body} onChange={(ev) => setBody(ev.target.value)} rows={6} />
      </Field>
      <AudienceFields
        audience={audience}
        targets={targets}
        onChange={(a, t) => {
          setAudience(a);
          setTargets(t);
        }}
      />
      <span className="flex flex-wrap items-center gap-2">
        {files.length < 5 && (
          <HrFileInput workspaceId={workspaceId} purpose="attachment" label="Attach a file" onUploaded={(up, name) => setFiles((f) => [...f, { key: up.objectKey, name }])} />
        )}
        {files.map((f) => (
          <Badge key={f.key}>{f.name}</Badge>
        ))}
      </span>
      <FormError error={create.error} />
      <div className="flex justify-end gap-2">
        <ActionButton type="button" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" type="submit" pending={create.isPending}>
          Publish
        </ActionButton>
      </div>
    </form>
  );
}
