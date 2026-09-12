"use client";

import {
  DEPARTMENTS,
  DEPARTMENT_BLURB,
  DEPARTMENT_LABEL,
  DEPARTMENT_LEAD,
  type ChatThread,
} from "@/lib/order-store";
import { Icon } from "@/components/app/icon";
import { clockLabel } from "./chat-time";
import { DEPARTMENT_ICON, leadInitials } from "./department-desk";
import { unreadIn, type ReadMarks } from "./read-state";

/**
 * The department picker: five desks, five people, one thread each.
 *
 * THIS IS THE CHOICE THE FEATURE IS ABOUT. A guest with a problem does not want
 * "Message the hotel", they want to know whether the broken kettle goes to
 * maintenance or to the front desk — so the row leads with the desk, names the
 * person who holds it and what they cover, and only then shows the last thing
 * said. A list that showed message previews alone would be a list of five
 * strangers.
 *
 * It is a RAIL rather than a page because `lib/app-nav.ts` gives `/inbox` a
 * `<main>` that is a flex row and says why: "the inbox, whose thread list and
 * conversation sit side by side and each scroll on their own". So both routes
 * render this, and only the conversation route hides it below `lg` — on a phone
 * the list and the thread are two screens, on a laptop they are one.
 */
export function ThreadRail({
  threads,
  activeThreadId,
  marks,
  className = "",
}: {
  /** Null while the browser has not yet answered which stay this is. */
  threads: ChatThread[] | null;
  activeThreadId?: string;
  marks: ReadMarks;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-col border-border ${className}`}>
      <div className="shrink-0 px-4 pb-2 pt-4 sm:px-5">
        <h2 className="font-display text-base font-bold tracking-tight">Departments</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every desk in the hotel has its own thread and its own department lead.
        </p>
      </div>

      <ul className="min-h-0 grow scrollbar overflow-y-auto px-2 pb-4">
        {threads === null
          ? DEPARTMENTS.map((department) => (
              <li key={department}>
                <PendingRow department={department} />
              </li>
            ))
          : threads.map((thread) => (
              <li key={thread.id}>
                <ThreadRow
                  thread={thread}
                  active={thread.id === activeThreadId}
                  unread={unreadIn(thread, marks)}
                />
              </li>
            ))}
      </ul>
    </div>
  );
}

/**
 * One desk.
 *
 * A plain `<a>`, not a router push: every other nav target in this shell is one
 * (see `app-shell.tsx`), and a conversation is a record with an address —
 * `/inbox/<threadId>` — that a guest is meant to be able to reload and share.
 */
function ThreadRow({
  thread,
  active,
  unread,
}: {
  thread: ChatThread;
  active: boolean;
  unread: number;
}) {
  const last = thread.messages[thread.messages.length - 1];
  const preview = last === undefined ? DEPARTMENT_BLURB[thread.department] : last.body;

  return (
    <a
      href={`/inbox/${thread.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex items-start gap-3 rounded-card px-3 py-3 transition-colors hover:bg-secondary ${
        active ? "bg-secondary" : ""
      }`}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-secondary text-secondary-foreground"
      >
        <Icon name={DEPARTMENT_ICON[thread.department]} className="h-5 w-5" />
      </span>

      <span className="min-w-0 grow">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 grow truncate text-sm font-semibold">
            {DEPARTMENT_LABEL[thread.department]}
          </span>
          {last === undefined ? null : (
            <span className="money shrink-0 text-2xs text-muted-foreground">
              {clockLabel(last.at)}
            </span>
          )}
        </span>

        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {thread.leadName} · {thread.leadRole}
        </span>

        <span className="mt-1 flex items-end gap-2">
          <span
            className={`min-w-0 grow text-xs leading-snug ${
              unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className="line-clamp-2">{preview}</span>
          </span>
          {unread > 0 ? (
            // The count is announced through `aria-label` rather than an
            // `sr-only` sibling INSIDE the pill: a visually hidden span is
            // still a flex child, and "2 unread" laid out in a 20px disc drags
            // the pill into a tall narrow sliver. The label says the same thing
            // and occupies no box.
            <span
              aria-label={`${unread} unread`}
              className="money flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground"
            >
              {unread}
            </span>
          ) : null}
        </span>
      </span>
    </a>
  );
}

/**
 * The row before the browser has said which hotel this is.
 *
 * The desk and the person are STATIC data — they are the same five at every
 * property — so they render immediately and only the preview waits. The
 * alternative, five grey blocks, throws away the half of the row that is
 * already known and makes the screen look emptier than it is.
 */
function PendingRow({ department }: { department: (typeof DEPARTMENTS)[number] }) {
  const lead = DEPARTMENT_LEAD[department];
  return (
    <span className="flex items-start gap-3 rounded-card px-3 py-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-secondary text-secondary-foreground"
      >
        <Icon name={DEPARTMENT_ICON[department]} className="h-5 w-5" />
      </span>
      <span className="min-w-0 grow">
        <span className="block truncate text-sm font-semibold">
          {DEPARTMENT_LABEL[department]}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {lead.name} · {lead.role}
        </span>
        <span aria-hidden className="mt-2 block h-3 w-40 animate-pulse rounded bg-secondary" />
      </span>
    </span>
  );
}

/** The disc a desk's lead wears above their reply. Exported for the thread. */
export function LeadAvatar({ leadName, className = "" }: { leadName: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-xs font-bold text-secondary-foreground ${className}`}
    >
      {leadInitials(leadName)}
    </span>
  );
}
