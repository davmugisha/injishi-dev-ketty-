"use client";

/**
 * The operator inbox, shared by every workspace that has one.
 *
 * **On real data** (ADR-035, D-f wave 1). Reads `GET /api/v1/ops/threads` and
 * `GET /ops/threads/:id/messages`, and commands `POST /ops/threads/:id/messages`
 * behind `message.send`. The demo store is gone from this screen (D-i).
 *
 * A thread is never free floating: `threads_scope_exactly_one` in the database
 * ties it to exactly one booking, stay or lease, so a reader never has to pick.
 * That is why one component serves the host and the landlord — the shape is
 * identical and only the noun changes.
 *
 * **THREE THINGS THE DEMO SHOWED THAT THE DATA DOES NOT CARRY**, all removed
 * rather than faked:
 *
 * - **Unread.** `OperatorThread` has no unread flag and there is no mark-read
 *   route. The blue dot and the read-on-open effect are gone. A dot that never
 *   went out, or went out only in this tab, is worse than no dot.
 * - **A reference chip.** The demo showed a booking code beside the name. The
 *   thread carries a `subjectId` and a `scope`, not a human reference, so the
 *   header says what the thread is ABOUT ("About a booking") rather than
 *   inventing a code.
 * - **Timestamps as "2h".** Those were fixture strings. Real messages carry an
 *   ISO `createdAt`, rendered as a date the operator can act on.
 *
 * `bodyType` can be `image` or `voice` with a null `body`. The composer sends
 * text only, because `SendMessageRequest` is text only until F-S09 gives an
 * upload a home — but an inbound image or voice note still has to RENDER, so it
 * is named rather than shown as an empty bubble.
 *
 * **THE DESK FILTER** (ADR-050 D-q). One flat list per workspace made a
 * department read every other department's messages to find its own: on the
 * seeded demo hotel, seventy-four conversations of which two are Rooms' and one
 * is Food and Beverage's (probed 2026-09-16). The picker above the list narrows
 * it to one department, and three things about it are deliberate:
 *
 * - **It asks the SERVER.** `useThreads(workspaceId, departmentId)` puts the id
 *   on the request and `listThreads` applies it in SQL. Nothing here reduces a
 *   fetched list by department, because the whole reason the filter exists is a
 *   list that grows with the property.
 * - **It is not a permission.** The default is every desk, anyone who may read
 *   the inbox may read all of it, and nothing on this screen is gated on a role.
 *   `message.send`, checked by `WorkspaceGuard`, is the only control.
 * - **The way back is always visible.** The picker, the empty state's own
 *   button, and the count in the heading all stay on screen while a filter is
 *   on. Most conversations carry no department at all — the reservation thread
 *   every booking gets at sale — and "All desks" is the only thing that shows
 *   them, so it can never be a state the operator cannot return to.
 */

import { Button, Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { ScrollShadow } from "@heroui/react";
import type { OperatorMessage, OperatorThread } from "@injishi/contracts";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ActionButton,
  Badge,
  EmptyState,
  Initials,
  LoadFailed,
  SelectField,
  type SelectOption,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useDepartments, useSendMessage, useThreadMessages, useThreads } from "../data/ops";
import { dshortIso } from "../lib/format";
import { usePms } from "../store";

export interface ConversationProps {
  /** "Guest threads" / "Tenant threads" — the list's own heading. */
  listLabel: string;
  /** The line above the messages explaining what the thread is bounded to. */
  scopeNote: string;
  placeholder: string;
  /** Replies offered above the composer, chosen for this domain. */
  quick: string[];
}

/**
 * The picker's "no filter" row.
 *
 * A REAL, SELECTABLE OPTION rather than an empty value standing for absence.
 * With a placeholder doing that job there is nothing to press to get the whole
 * inbox back, and the whole inbox is where the reservation threads live — the
 * majority of them, on every property we have measured. A department id is a
 * uuid, so this can never collide with one.
 */
const EVERY_DESK = "all";

/** What a thread is hung off, said plainly. */
const ABOUT: Record<OperatorThread["scope"], string> = {
  booking: "About a booking",
  stay: "About a stay",
  lease: "About a lease",
};

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * What to render for a message body.
 *
 * An image or a voice note has a null `body`, and an empty bubble reads as a
 * failed send rather than as a photo this screen cannot show yet.
 */
function bodyText(m: OperatorMessage): string {
  if (m.bodyType === "image") return "📷 Photo";
  if (m.bodyType === "system") return m.body ?? "";
  if (m.bodyType === "voice") {
    const s = m.voiceDurationS;
    return s ? `🎙 Voice note · ${s}s` : "🎙 Voice note";
  }
  return m.body ?? "";
}

export function Conversation({ listLabel, scopeNote, placeholder, quick }: ConversationProps) {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  // `/w/:id/inbox/:threadId` names a thread, and that is the one it opens: a
  // link a colleague sends has to land on the conversation it points at.
  const params = useParams<{ threadId?: string | string[] }>();
  const linked = typeof params.threadId === "string" ? params.threadId : null;
  const [selId, setSelId] = useState<string | null>(linked);
  const [text, setText] = useState("");
  /**
   * Which desk the operator is reading, this session.
   *
   * Not in the address bar and not in storage, deliberately. A filter is a way
   * of FINDING something now, not a setting: an inbox that reopened narrowed to
   * Engineering would hide every guest who wrote to the desk, and the person it
   * hid them from would have no idea why the inbox looked quiet.
   */
  const [desk, setDesk] = useState<string>(EVERY_DESK);

  const deskQuery = useDepartments(workspaceId);
  /**
   * The desks this property runs, in the property's own order.
   *
   * EVERY ACTIVE DEPARTMENT, not only the ones currently open to guests.
   * `guestRequestable` is a switch a manager flips at any moment, and flipping
   * it off does not delete the conversations that desk already holds — deriving
   * the list from it would make real threads unreachable the moment somebody
   * closed a desk to new requests. Archived departments are left out: they are
   * retired, and their threads are still under "All desks".
   */
  const desks = useMemo<SelectOption[]>(() => {
    const rows = (deskQuery.data?.departments ?? [])
      .filter((d) => d.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    return [
      { value: EVERY_DESK, label: "All desks" },
      ...rows.map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [deskQuery.data]);

  /**
   * A chosen desk the picker no longer offers falls back to every desk.
   *
   * This is the branch switcher, not a hypothetical: departments are scoped to
   * the branch in view, so moving from Rubavu to Musanze leaves this holding an
   * id that belongs to neither the new branch's departments nor its threads.
   * The server would answer that request with nothing, and the operator would
   * be looking at an empty inbox under a desk name the picker could not even
   * show. Only fall back once the list has actually ARRIVED — while it is in
   * flight, an unrecognised id means "not loaded yet", not "gone".
   */
  const chosenDesk =
    deskQuery.data === undefined || desks.some((d) => d.value === desk) ? desk : EVERY_DESK;
  const departmentId = chosenDesk === EVERY_DESK ? null : chosenDesk;
  /** The desk's own name, for the wording of an empty result. */
  const deskLabel = desks.find((d) => d.value === chosenDesk)?.label ?? "this desk";

  const threadsQuery = useThreads(workspaceId, departmentId);
  const threads = threadsQuery.data?.threads ?? [];
  // With no thread in the address, the first one stands in until the operator
  // picks. Derived rather than stored, so a refetch that drops the selected
  // thread lands on a real one instead of an empty pane.
  const sel = threads.find((t) => t.id === selId) ?? threads[0] ?? null;

  const messagesQuery = useThreadMessages(workspaceId, sel?.id ?? null);
  const send = useSendMessage(workspaceId, sel?.id ?? null);

  const maySend = can("message.send");
  const denied = maySend ? undefined : reasonFor("message.send");

  function submit(value: string) {
    const body = value.trim();
    // A press while the last send is still on the wire would post it twice.
    if (!sel || !body || denied || send.isPending) return;
    send.mutate(
      { body },
      {
        onSuccess: () => {
          setText("");
          // The bubble appearing is the real confirmation, and it is what an
          // operator watches for. This is for the case where it does not: the
          // refetch is a round trip behind the send, and a composer that
          // simply empties itself has, from the desk, exactly the shape of a
          // message that went nowhere.
          toast(`Sent to ${sel.counterpartName ?? "them"}.`, "ok");
        },
        onError: toastError,
      },
    );
  }

  /**
   * THE WHOLE-SCREEN STATES BELONG TO THE UNFILTERED INBOX ONLY.
   *
   * Each of them replaces the screen, the picker included, and that is right
   * for the first load: there is nothing to filter yet. It would be a trap once
   * a desk is chosen — a slow answer for Housekeeping would take away the one
   * control that gets the operator back to every desk, and an empty desk would
   * read as an empty property. Filtered, the same three states render INSIDE
   * the list, under a picker that stays put.
   */
  const whole = departmentId === null;

  if (whole && threadsQuery.isPending) {
    return (
      <div className="pms-enter grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <Skeleton height={360} />
        <Skeleton height={360} delay={60} />
      </div>
    );
  }

  if (whole && threadsQuery.isError) {
    /* An unreachable API is not an empty inbox. A guest waiting on an answer
       is exactly who this failure hurts. */
    return (
      <LoadFailed onRetry={() => void threadsQuery.refetch()} retrying={threadsQuery.isFetching}>
        We couldn&apos;t load your inbox. Every message a guest has sent is still there —
        this is on our side, not an empty inbox.
      </LoadFailed>
    );
  }

  if (whole && threads.length === 0) {
    return (
      <EmptyState className="p-7">
        No conversations yet. A thread opens the moment someone messages you about a booking
        or a tenancy.
      </EmptyState>
    );
  }

  return (
    <div className="pms-enter grid gap-4 lg:h-[calc(100dvh-190px)] lg:min-h-[440px] lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <div className={cn(surfaceClass, "flex max-h-[42dvh] min-h-0 flex-col overflow-hidden lg:max-h-none")}>
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">
              {listLabel}
            </span>
            {/* The count is of what is LISTED, so it is the desk's count while a
                desk is chosen. A total carried over from the unfiltered read
                would be a number the list beneath it contradicts, and there is
                no second request to be had: the server sends the rows it was
                asked for and counts nothing else. It is withheld while the
                answer is in flight rather than shown as a zero. */}
            {!threadsQuery.isPending && (
              <span className="pms-num text-2xs text-faint">{threads.length}</span>
            )}
          </div>
          {/* No picker where there is nothing to pick: a workspace whose
              departments this person's grant does not admit reading, or one
              with none, gets the inbox exactly as it was before this filter
              existed rather than a dead control. */}
          {desks.length > 1 && (
            <SelectField
              className="mt-2"
              label={`Filter ${listLabel.toLowerCase()} by desk`}
              value={chosenDesk}
              onChange={setDesk}
              options={desks}
            />
          )}
          {/* The desks are a SECOND read, and it can fail on its own while the
              inbox beside it is fine. Saying so beats silently withholding a
              control the operator was reaching for. */}
          {deskQuery.isError && (
            <Button
              variant="link"
              size="sm"
              onClick={() => void deskQuery.refetch()}
              pending={deskQuery.isFetching}
              className="mt-1 text-2xs text-muted-foreground"
            >
              {deskQuery.isFetching ? "Loading the desks" : "We couldn't load the desks. Try again"}
            </Button>
          )}
        </div>
        <ScrollShadow className="min-h-0 flex-1 scrollbar overflow-y-auto">
          {threadsQuery.isPending && (
            <div className="p-4">
              <Skeleton height={220} />
            </div>
          )}

          {threadsQuery.isError && (
            <LoadFailed
              className="m-4"
              onRetry={() => void threadsQuery.refetch()}
              retrying={threadsQuery.isFetching}
            >
              We couldn&apos;t load {deskLabel}&apos;s conversations. Nothing has been lost —
              this is on our side.
            </LoadFailed>
          )}

          {/* A DESK WITH NOTHING IN IT IS NOT A BROKEN SCREEN, and it must not
              look like one. It names the desk, says what would put something
              here, and carries the way back to the rest of the inbox — most of
              which is the reservation threads, which belong to no desk at all
              and are only ever reachable under "All desks". */}
          {!threadsQuery.isPending && !threadsQuery.isError && threads.length === 0 && (
            <div className="flex flex-col items-start gap-3 p-4">
              <EmptyState className="p-4">
                No conversations for {deskLabel} yet. One opens the moment a guest writes to
                this desk.
              </EmptyState>
              <ActionButton onClick={() => setDesk(EVERY_DESK)}>Show all desks</ActionButton>
            </div>
          )}

          {threads.map((t) => {
            const on = t.id === sel?.id;
            return (
              <Button
                variant="ghost"
                key={t.id}
                onClick={() => setSelId(t.id)}
                // `h-auto` and `whitespace-normal`, as the officer queue does: the
                // shared button carries a fixed control height and a thread row is
                // three lines, so each preview drew over the next row's name.
                // `rounded-none`: a row is a band of the list, not a control.
                className={cn(
                  "flex h-auto w-full items-start justify-start gap-2.5 whitespace-normal rounded-none border-b border-line px-4 py-3 text-left transition-colors",
                  on ? "bg-hover" : "hover:bg-hover",
                )}
              >
                <Initials size={32}>{initialsOf(t.counterpartName)}</Initials>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {t.counterpartName ?? "Unnamed"}
                    </span>
                    <span className="pms-num text-2xs text-faint">
                      {t.lastMessageAt ? dshortIso(t.lastMessageAt) : ""}
                    </span>
                  </span>
                  <span className="mt-px block truncate text-2xs text-muted-foreground">
                    {t.departmentName ? `To ${t.departmentName} · ` : ""}
                    {ABOUT[t.scope]}
                    {t.status === "archived" ? " · archived" : ""}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-ink2">
                      {t.lastMessagePreview ?? "No messages yet"}
                    </span>
                  </span>
                </span>
              </Button>
            );
          })}
        </ScrollShadow>
      </div>

      {/* THE READING HALF, or a reason it is empty. Before the desk filter this
          pane simply did not render when nothing was selected, which could only
          happen on an inbox that had no conversations at all — and that screen
          never got this far. Filtered, it is reachable with the list beside it
          empty, and half a screen of nothing reads as a fault. */}
      {!sel ? (
        <div
          className={cn(
            surfaceClass,
            "hidden items-center justify-center px-7 py-7 lg:flex",
          )}
        >
          <p className="max-w-form text-center text-sm text-muted-foreground">
            {threads.length === 0
              ? `Nothing to read for ${deskLabel}. The rest of the inbox is under All desks.`
              : "Choose a conversation to read it."}
          </p>
        </div>
      ) : (
        <div className={cn(surfaceClass, "flex min-h-0 flex-col overflow-hidden")}>
          <div className="flex items-center gap-2.5 border-b border-line px-[18px] py-3">
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-foreground">
                {sel.counterpartName ?? "Unnamed"}
              </span>
              <span className="block truncate text-2xs text-muted-foreground">
                {sel.departmentName ? `To ${sel.departmentName} · ` : ""}
                {ABOUT[sel.scope]}
              </span>
            </span>
            {sel.status === "archived" && <Badge intent="neutral">Archived</Badge>}
          </div>

          <ScrollShadow className="flex min-h-0 flex-1 flex-col gap-2.5 scrollbar overflow-y-auto px-[18px] py-4">
            <div className="self-center rounded-full bg-field px-3 py-1 text-2xs text-muted-foreground">
              {scopeNote}
            </div>

            {messagesQuery.isPending && <Skeleton height={120} />}

            {/* With a retry, because this is the one panel on the screen that
                can fail on its own: the thread list beside it loaded fine, so
                an operator sitting on a blank conversation had nothing to
                press but the browser's reload. */}
            {messagesQuery.isError && (
              <LoadFailed
                className="self-center"
                onRetry={() => void messagesQuery.refetch()}
                retrying={messagesQuery.isFetching}
              >
                We couldn&apos;t load this conversation. Nothing has been lost — this is on
                our side, not an empty thread.
              </LoadFailed>
            )}

            {(messagesQuery.data?.messages ?? []).map((m) =>
              m.bodyType === "system" ? (
                // A line the platform wrote about an order raised in this
                // conversation (ADR-050 D-s): nobody's bubble, and it never
                // reads as the guest or a colleague speaking.
                <div
                  key={m.id}
                  data-system-line
                  className="self-center rounded-full bg-field px-3 py-1 text-center text-2xs text-muted-foreground"
                >
                  {bodyText(m)} · <span className="pms-num">{dshortIso(m.createdAt)}</span>
                </div>
              ) : (
              <div key={m.id} className={cn("flex", m.fromUs ? "justify-end" : "justify-start")}>
                <div className="max-w-[76%]">
                  <div
                    className={cn(
                      "rounded px-3.5 py-2.5 text-sm leading-relaxed",
                      m.fromUs
                        ? "bg-accent-soft text-foreground"
                        : "border border-line2 bg-field text-foreground",
                    )}
                  >
                    {bodyText(m)}
                  </div>
                  <div
                    className={cn(
                      "pms-num mt-1 text-2xs text-faint",
                      m.fromUs ? "text-right" : "text-left",
                    )}
                  >
                    {dshortIso(m.createdAt)}
                    {!m.fromUs && m.senderName ? ` · ${m.senderName}` : ""}
                  </div>
                </div>
              </div>
              ),
            )}
          </ScrollShadow>

          <div className="border-t border-line px-[18px] py-3">
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  onClick={() => submit(q)}
                  aria-disabled={denied || send.isPending ? true : undefined}
                  title={denied}
                  className={cn(
                    "h-8 rounded-full border-card-bd bg-card px-3 text-xs font-medium text-ink2 hover:bg-hover",
                    denied && "cursor-not-allowed opacity-50",
                  )}
                >
                  {q}
                </Button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit(text);
                }}
                placeholder={denied ?? placeholder}
                /* A placeholder is not an accessible name: it is not announced
                   once the field has content, and it disappears as soon as the
                   operator starts typing. */
                aria-label={placeholder}
                maxLength={4000}
                disabled={Boolean(denied)}
                className="h-11 rounded border-line2 bg-field text-sm"
              />
              <Button
                onClick={() => submit(text)}
                aria-disabled={denied || !text.trim() ? true : undefined}
                title={denied}
                pending={send.isPending}
                className={cn(
                  "h-11 rounded bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90",
                  (denied || !text.trim()) && "cursor-not-allowed opacity-50",
                )}
              >
                {send.isPending ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
