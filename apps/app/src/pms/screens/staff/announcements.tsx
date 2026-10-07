"use client";

/**
 * Staff · Announcements (058-people-file AC-PF9).
 *
 * News for the people who work here: a staff party, a new rota rule, a closed
 * kitchen. Separate from the platform's own announcements, which Injishi writes
 * for every business. Posting one tells its audience (the automations deliver
 * `announcement.published`); staff read it until it expires, may comment when
 * comments are on, and their first view is counted.
 */

import type { HrTargets, StaffAnnouncement } from "@injishi/contracts";
import { Checkbox, Input, Textarea } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { humanError } from "../../data/api";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { openFileLink, useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement } from "../../data/people-file";
import { dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { AudienceFields, NO_TARGETS, audienceText } from "./hr-audience";
import { HrFileInput } from "./hr-file-input";
import { Field, FormError, RowList, inputClass, rowClass } from "./staff-ui";

export function Announcements() {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const announcements = useAnnouncements(workspaceId);
  const [writing, setWriting] = useState(false);
  const mayManage = can("people.manage");
  const today = todayIso();
  const rows = announcements.data?.announcements ?? [];
  const live = rows.filter((a) => a.status === "published" && (!a.expiresOn || a.expiresOn >= today));
  const past = rows.filter((a) => !live.includes(a));

  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          What the team should know. Staff with an account see it on their phone until it expires.
        </span>
        {mayManage && !writing && (
          <ActionButton variant="primary" onClick={() => setWriting(true)}>
            Post an announcement
          </ActionButton>
        )}
      </div>
      {writing && <AnnouncementForm onDone={() => setWriting(false)} />}
      {announcements.isPending ? (
        <Skeleton height={140} />
      ) : announcements.isError ? (
        <LoadFailed onRetry={() => void announcements.refetch()} retrying={announcements.isFetching}>
          We couldn&apos;t load the announcements. Nothing on them has changed — this is on our side.
        </LoadFailed>
      ) : (
        <>
          <section>
            <SectionHeading n={live.length}>Showing now</SectionHeading>
            {live.length === 0 ? (
              <EmptyState className="mt-2.5 p-5">Nothing showing to staff right now.</EmptyState>
            ) : (
              <RowList>
                {live.map((a, i) => (
                  <AnnouncementRow key={a.id} announcement={a} index={i} mayManage={mayManage} />
                ))}
              </RowList>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <SectionHeading n={past.length}>Expired or archived</SectionHeading>
              <RowList>
                {past.map((a, i) => (
                  <AnnouncementRow key={a.id} announcement={a} index={i} mayManage={mayManage} />
                ))}
              </RowList>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AnnouncementRow({ announcement: a, index, mayManage }: { announcement: StaffAnnouncement; index: number; mayManage: boolean }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const update = useUpdateAnnouncement(workspaceId);
  const [open, setOpen] = useState(false);
  const archived = a.status === "archived";
  const expired = !!a.expiresOn && a.expiresOn < todayIso();

  return (
    <div className={`${rowClass(index)} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <span className="text-sm font-semibold text-ink">{a.title}</span>
          <span className="pms-num text-2xs text-muted-foreground">
            {[
              `For ${audienceText(a.audience, a.targets).toLowerCase()}`,
              `posted ${dshortIso(a.createdAt)}`,
              a.expiresOn ? `${expired ? "expired" : "until"} ${dshortIso(a.expiresOn)}` : "no expiry",
              `${a.viewCount} seen`,
              a.commentsAllowed ? `${a.commentCount} comment${a.commentCount === 1 ? "" : "s"}` : "comments off",
            ].join(" · ")}
          </span>
        </button>
        {archived && <Badge>Archived</Badge>}
        {!archived && expired && <Badge>Expired</Badge>}
        {mayManage && (
          <ActionButton
            pending={update.isPending}
            onClick={() =>
              update.mutate(
                { id: a.id, body: { status: archived ? "published" : "archived" } },
                { onSuccess: () => toast(archived ? "Posted again" : "Archived", "ok") },
              )
            }
          >
            {archived ? "Post again" : "Archive"}
          </ActionButton>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <p className="text-sm whitespace-pre-wrap text-ink2">{a.body}</p>
          {a.fileKeys.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {a.fileKeys.map((_, i) => (
                <ActionButton
                  key={i}
                  onClick={() =>
                    workspaceId &&
                    openFileLink(workspaceId, `/ops/staff-announcements/${a.id}/files/${i}`).catch((e: unknown) => toast(humanError(e), "bad"))
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

function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const create = useCreateAnnouncement(workspaceId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [commentsAllowed, setCommentsAllowed] = useState(true);
  const [audience, setAudience] = useState<"all" | "targeted">("all");
  const [targets, setTargets] = useState<HrTargets>(NO_TARGETS);
  const [files, setFiles] = useState<{ key: string; name: string }[]>([]);

  return (
    <form
      className="flex flex-col gap-4 rounded-card border border-card-bd bg-card p-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        create.mutate(
          {
            title,
            body,
            audience,
            ...(audience === "targeted" ? { targets } : {}),
            expiresOn: expiresOn || null,
            commentsAllowed,
            fileKeys: files.map((f) => f.key),
          },
          {
            onSuccess: () => {
              toast(`${title} posted`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <SectionHeading>Post an announcement</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" htmlFor="announcement-title">
          <Input id="announcement-title" required minLength={2} value={title} onChange={(ev) => setTitle(ev.target.value)} className={inputClass} />
        </Field>
        <Field label="Shown until" hint="Optional. It stops showing after this day." htmlFor="announcement-expires">
          <Input id="announcement-expires" type="date" min={todayIso()} value={expiresOn} onChange={(ev) => setExpiresOn(ev.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="The announcement" htmlFor="announcement-body">
        <Textarea id="announcement-body" required value={body} onChange={(ev) => setBody(ev.target.value)} rows={4} />
      </Field>
      <AudienceFields
        audience={audience}
        targets={targets}
        onChange={(a, t) => {
          setAudience(a);
          setTargets(t);
        }}
      />
      <Checkbox isSelected={commentsAllowed} onChange={setCommentsAllowed} className="flex items-center gap-2 text-sm font-normal text-ink">
        Staff may comment
      </Checkbox>
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
          Post
        </ActionButton>
      </div>
    </form>
  );
}
