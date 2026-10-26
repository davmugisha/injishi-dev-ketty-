"use client";

import { Avatar, Card } from "@heroui/react";
import type { LeaseThreadList, LeaseThreadSummary, LeaseThreadView } from "@injishi/contracts";
import {
  ActionLink,
  EmptyBlock,
  FilterTabs,
  messageClock,
  messageDay,
  PageContent,
  PageHeader,
  SearchBar,
} from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeaseConversation, LiveDot } from "./LeaseConversation";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** "14:05" today, "Yesterday", "Tuesday 20 October" before. */
function when(iso: string | null, now: string | undefined): string {
  if (!iso) return "";
  const day = messageDay(iso, now);
  return day === "Today" ? messageClock(iso) : day.replace(/ \d{4}$/, "");
}

function ThreadRow({ t, selected, now }: { t: LeaseThreadSummary; selected: boolean; now: string | undefined }) {
  const unread = t.unreadCount > 0;
  return (
    <Link
      href={`/messages?lease=${t.leaseId}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground no-underline transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        selected ? "bg-accent-soft" : "hover:bg-default",
      )}
    >
      <Avatar size="md" color={unread ? "accent" : "default"} variant="soft" className="shrink-0">
        <Avatar.Fallback>{initials(t.counterpartName)}</Avatar.Fallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cx("min-w-0 truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            {t.counterpartName}
          </span>
          <span className="shrink-0 text-xs text-muted">{t.unitLabel}</span>
          <span className={cx("ml-auto shrink-0 text-xs tabular", unread ? "font-medium text-accent" : "text-muted")}>
            {when(t.lastMessageAt, now)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={cx("min-w-0 flex-1 truncate text-xs", unread ? "text-foreground" : "text-muted")}>
            {t.lastMessagePreview ? `${t.lastMessageFromMe ? "You: " : ""}${t.lastMessagePreview}` : "No messages yet"}
          </span>
          {unread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular">
              {t.unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/**
 * The landlord's messages (P3.4, blueprint 3.5): the conversations with tenants on the left, newest
 * activity first, with search, an Unread filter and the counts; the open conversation on the right.
 * On a phone one pane shows at a time: the list, or the conversation with a way back. `?lease=` opens
 * one. New lines arrive live; the list refreshes its counts when they do.
 */
export function LandlordMessagesView({
  list,
  open,
  workspaceId,
  selfName,
}: {
  list: LeaseThreadList;
  open: LeaseThreadView | null;
  workspaceId: string;
  selfName: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [now, setNow] = useState<string | undefined>(undefined);
  useEffect(() => setNow(new Date().toISOString()), []);

  // Counts and previews follow the conversation: refresh the list (the server reads) after activity.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshList = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      list.threads.filter(
        (t) =>
          (tab === "all" || t.unreadCount > 0) &&
          (!needle ||
            [t.counterpartName, t.unitLabel, t.propertyName, t.reference].some((v) =>
              v.toLowerCase().includes(needle),
            )),
      ),
    [list.threads, tab, needle],
  );
  const unreadThreads = list.threads.filter((t) => t.unreadCount > 0).length;

  if (list.threads.length === 0) {
    return (
      <PageContent>
        <PageHeader title="Messages" />
        <Card className="rounded-lg p-6">
          <EmptyBlock
            icon="Comments"
            title="No conversations yet"
            description="Each lease gets a conversation with its tenant once it is sent for signing."
            action={
              <ActionLink href="/leases" icon="FileText">
                Open leases
              </ActionLink>
            }
          />
        </Card>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader title="Messages" />
      <Card className="grid rounded-lg h-[min(780px,calc(100dvh-12rem))] min-h-[520px] grid-cols-1 gap-0 overflow-hidden p-0 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section
          aria-label="Conversations"
          className={cx("flex min-h-0 flex-col border-separator md:border-r", open ? "max-md:hidden" : "")}
        >
          <div className="flex flex-col gap-2 border-b border-separator p-3">
            <SearchBar label="Search conversations" value={q} onChange={setQ} placeholder="Tenant, unit or lease" />
            <FilterTabs
              label="Show"
              variant="segment"
              tabs={[
                { id: "all", label: "All", count: list.threads.length },
                { id: "unread", label: "Unread", count: unreadThreads },
              ]}
              selectedKey={tab}
              onSelectionChange={setTab}
            />
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {shown.length === 0 ? (
              <EmptyBlock
                size="sm"
                icon="Magnifier"
                title={tab === "unread" && !needle ? "Nothing unread" : "No conversation matches"}
              />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {shown.map((t) => (
                  <li key={t.leaseId}>
                    <ThreadRow t={t} selected={open?.leaseId === t.leaseId} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </section>
        <section aria-label="Conversation" className={cx("flex min-h-0 min-w-0 flex-col", open ? "" : "max-md:hidden")}>
          {open ? (
            <>
              <header className="flex items-center gap-3 border-b border-separator px-3 py-2.5 sm:px-4">
                <ActionLink
                  href="/messages"
                  icon="ArrowLeft"
                  intent="ghost"
                  size="sm"
                  className="md:hidden"
                  aria-label="All conversations"
                >
                  <span className="sr-only">All conversations</span>
                </ActionLink>
                <Avatar size="sm" variant="soft" className="shrink-0">
                  <Avatar.Fallback>{initials(open.counterpartName)}</Avatar.Fallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
                    {open.counterpartName}
                    <LiveDot />
                  </h2>
                  <span className="truncate text-xs text-muted">
                    Unit {open.unitLabel} · {open.propertyName}
                  </span>
                </div>
                <ActionLink href={`/leases/${open.leaseId}`} icon="FileText" intent="ghost" size="sm">
                  <span className="max-sm:sr-only">Lease {open.reference}</span>
                </ActionLink>
              </header>
              <LeaseConversation
                key={open.leaseId}
                side="landlord"
                initial={open}
                workspaceId={workspaceId}
                selfName={selfName}
                onActivity={refreshList}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyBlock icon="Comments" title="Pick a conversation" />
            </div>
          )}
        </section>
      </Card>
    </PageContent>
  );
}
