"use client";

import { Avatar, Card, Chip } from "@heroui/react";
import type {
  LeaseThreadList,
  LeaseThreadView,
  PlacementThreadList,
  PlacementThreadSummary,
  PlacementThreadView,
} from "@injishi/contracts";
import {
  ActionLink,
  EmptyBlock,
  FilterTabs,
  type IconKey,
  messageClock,
  messageDay,
  PageContent,
  PageHeader,
  SearchBar,
} from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type ConversationSide, LeaseConversation, LiveDot } from "./LeaseConversation";

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

/** One row of the list: a tenant's lease conversation, or a broker's about a placement. */
interface InboxRow {
  key: string;
  kind: "lease" | "placement";
  href: string;
  name: string;
  /** The unit, beside the name. */
  tag: string | null;
  lastMessageAt: string | null;
  preview: string | null;
  fromMe: boolean;
  unread: number;
  writable: boolean;
  search: string[];
}

const placementWhere = (t: { unitLabel: string | null; propertyName: string | null }) =>
  t.unitLabel
    ? `Unit ${t.unitLabel}${t.propertyName ? ` · ${t.propertyName}` : ""}`
    : (t.propertyName ?? "A placement");

function placementRow(t: PlacementThreadSummary): InboxRow {
  return {
    key: `placement:${t.placementId}`,
    kind: "placement",
    href: `/messages?placement=${t.placementId}`,
    name: t.counterpartName,
    tag: t.unitLabel,
    lastMessageAt: t.lastMessageAt,
    preview: t.lastMessagePreview,
    fromMe: t.lastMessageFromMe,
    unread: t.unreadCount,
    writable: t.writable,
    search: [t.counterpartName, t.unitLabel, t.propertyName, t.tenantName].filter((v): v is string => Boolean(v)),
  };
}

const newestFirst = (a: InboxRow, b: InboxRow) => {
  if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
  if (a.lastMessageAt) return -1;
  if (b.lastMessageAt) return 1;
  return Number(b.writable) - Number(a.writable);
};

function ThreadRow({ t, selected, now }: { t: InboxRow; selected: boolean; now: string | undefined }) {
  const unread = t.unread > 0;
  return (
    <Link
      href={t.href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-foreground no-underline transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
        selected ? "bg-accent-soft" : "hover:bg-default",
      )}
    >
      <Avatar size="md" color={unread ? "accent" : "default"} variant="soft" className="shrink-0">
        <Avatar.Fallback>{initials(t.name)}</Avatar.Fallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cx("min-w-0 truncate text-sm", unread ? "font-semibold" : "font-medium")}>{t.name}</span>
          {t.tag ? <span className="shrink-0 text-xs text-muted">{t.tag}</span> : null}
          <span className={cx("ml-auto shrink-0 text-xs tabular", unread ? "font-medium text-accent" : "text-muted")}>
            {when(t.lastMessageAt, now)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={cx("min-w-0 flex-1 truncate text-xs", unread ? "text-foreground" : "text-muted")}>
            {t.preview ? `${t.fromMe ? "You: " : ""}${t.preview}` : "No messages yet"}
          </span>
          {unread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular">
              {t.unread}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/** The open conversation's header: who, about what, and the record it belongs to. */
function OpenHeader({ name, about, chip, link }: { name: string; about: string; chip?: string; link?: ReactNode }) {
  return (
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
        <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{name}</span>
          {chip ? (
            <Chip size="sm" variant="soft" className="shrink-0">
              {chip}
            </Chip>
          ) : null}
          <LiveDot />
        </h2>
        <span className="truncate text-xs text-muted">{about}</span>
      </div>
      {link}
    </header>
  );
}

export type OpenConversation =
  | { kind: "lease"; view: LeaseThreadView }
  | { kind: "placement"; view: PlacementThreadView };

const openKeyOf = (open: OpenConversation | null) =>
  open ? `${open.kind}:${open.kind === "lease" ? open.view.leaseId : open.view.placementId}` : null;

/**
 * One inbox (P3.4; brokers 2026-10-26): the conversations on the left, newest activity first, with
 * search, filters and the counts; the open one on the right. On a phone one pane shows at a time.
 * The landlord sees tenants (`?lease=`) and brokers (`?placement=`); the broker sees landlords.
 * New lines arrive live; the list refreshes its counts when they do.
 */
function Inbox({
  side,
  rows,
  open,
  workspaceId,
  selfName,
  searchPlaceholder,
  empty,
}: {
  side: ConversationSide;
  rows: InboxRow[];
  open: OpenConversation | null;
  workspaceId: string | null;
  selfName: string | null;
  searchPlaceholder: string;
  empty: { title: string; description: string; href: string; icon: IconKey; label: string };
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
  const both = rows.some((r) => r.kind === "lease") && rows.some((r) => r.kind === "placement");
  const shown = useMemo(
    () =>
      rows.filter(
        (t) =>
          (tab === "all" ||
            (tab === "unread" && t.unread > 0) ||
            (tab === "brokers" && t.kind === "placement")) &&
          (!needle || t.search.some((v) => v.toLowerCase().includes(needle))),
      ),
    [rows, tab, needle],
  );
  const openKey = openKeyOf(open);

  if (rows.length === 0 && !open) {
    return (
      <PageContent>
        <PageHeader title="Messages" />
        <Card className="rounded-lg p-6">
          <EmptyBlock
            icon="Comments"
            title={empty.title}
            description={empty.description}
            action={
              <ActionLink href={empty.href} icon={empty.icon}>
                {empty.label}
              </ActionLink>
            }
          />
        </Card>
      </PageContent>
    );
  }

  const tabs = [
    { id: "all", label: "All", count: rows.length },
    { id: "unread", label: "Unread", count: rows.filter((t) => t.unread > 0).length },
    ...(both
      ? [
          { id: "brokers", label: "Brokers", count: rows.filter((t) => t.kind === "placement").length },
        ]
      : []),
  ];

  return (
    <PageContent>
      <PageHeader title="Messages" />
      <Card className="grid rounded-lg h-[min(780px,calc(100dvh-12rem))] min-h-[520px] grid-cols-1 gap-0 overflow-hidden p-0 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section
          aria-label="Conversations"
          className={cx("flex min-h-0 flex-col border-separator md:border-r", open ? "max-md:hidden" : "")}
        >
          <div className="flex flex-col gap-2 border-b border-separator p-3">
            <SearchBar
              label="Search conversations"
              value={q}
              onChange={setQ}
              placeholder={searchPlaceholder}
              className="md:w-full"
            />
            <FilterTabs label="Show" variant="segment" tabs={tabs} selectedKey={tab} onSelectionChange={setTab} />
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
                  <li key={t.key}>
                    <ThreadRow t={t} selected={openKey === t.key} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </section>
        <section aria-label="Conversation" className={cx("flex min-h-0 min-w-0 flex-col", open ? "" : "max-md:hidden")}>
          {open?.kind === "lease" ? (
            <>
              <OpenHeader
                name={open.view.counterpartName}
                about={`Unit ${open.view.unitLabel} · ${open.view.propertyName}`}
                link={
                  <ActionLink href={`/leases/${open.view.leaseId}`} icon="FileText" intent="ghost" size="sm">
                    <span className="max-sm:sr-only">Lease {open.view.reference}</span>
                  </ActionLink>
                }
              />
              <LeaseConversation
                key={openKey}
                side={side}
                initial={open.view}
                workspaceId={workspaceId}
                selfName={selfName}
                onActivity={refreshList}
              />
            </>
          ) : open?.kind === "placement" ? (
            <>
              <OpenHeader
                name={open.view.counterpartName}
                chip={side === "broker" ? "Landlord" : "Broker"}
                about={[placementWhere(open.view), open.view.tenantName ? `For ${open.view.tenantName}` : null]
                  .filter(Boolean)
                  .join(" · ")}
                link={
                  <ActionLink
                    href={side === "broker" ? "/broker/placements" : "/brokers"}
                    icon="Persons"
                    intent="ghost"
                    size="sm"
                  >
                    <span className="max-sm:sr-only">{side === "broker" ? "Placements" : "Brokers"}</span>
                  </ActionLink>
                }
              />
              <LeaseConversation
                key={openKey}
                side={side}
                initial={open.view}
                workspaceId={side === "broker" ? null : workspaceId}
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

/** The landlord's messages: tenants (one per lease) and brokers (one per placement) in one list. */
export function LandlordMessagesView({
  list,
  brokers,
  open,
  workspaceId,
  selfName,
}: {
  list: LeaseThreadList;
  brokers: PlacementThreadList | null;
  open: OpenConversation | null;
  workspaceId: string;
  selfName: string | null;
}) {
  const openKey = openKeyOf(open);
  const rows: InboxRow[] = [
    ...list.threads.map(
      (t): InboxRow => ({
        key: `lease:${t.leaseId}`,
        kind: "lease",
        href: `/messages?lease=${t.leaseId}`,
        name: t.counterpartName,
        tag: t.unitLabel,
        lastMessageAt: t.lastMessageAt,
        preview: t.lastMessagePreview,
        fromMe: t.lastMessageFromMe,
        unread: t.unreadCount,
        writable: t.writable,
        search: [t.counterpartName, t.unitLabel, t.propertyName, t.reference],
      }),
    ),
    // A broker conversation is listed once someone wrote in it, or while it is the one open.
    ...(brokers?.threads ?? []).map(placementRow).filter((r) => r.lastMessageAt || r.key === openKey),
  ].sort(newestFirst);
  return (
    <Inbox
      side="landlord"
      rows={rows}
      open={open}
      workspaceId={workspaceId}
      selfName={selfName}
      searchPlaceholder="Tenant, broker or unit"
      empty={{
        title: "No conversations yet",
        description: "Each lease gets a conversation with its tenant once it is sent for signing.",
        href: "/leases",
        icon: "FileText",
        label: "Open leases",
      }}
    />
  );
}

/** The broker's messages: one conversation per placement, with the landlord. */
export function BrokerMessagesView({
  list,
  open,
  selfName,
}: {
  list: PlacementThreadList;
  open: PlacementThreadView | null;
  selfName: string | null;
}) {
  return (
    <Inbox
      side="broker"
      rows={list.threads.map(placementRow).sort(newestFirst)}
      open={open ? { kind: "placement", view: open } : null}
      workspaceId={null}
      selfName={selfName}
      searchPlaceholder="Landlord, unit or tenant"
      empty={{
        title: "No conversations yet",
        description: "Start a placement on a home, then message its landlord here.",
        href: "/broker/homes",
        icon: "Magnifier",
        label: "Find homes",
      }}
    />
  );
}
