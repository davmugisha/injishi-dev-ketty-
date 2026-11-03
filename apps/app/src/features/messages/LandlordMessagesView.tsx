"use client";

import { Card, Chip } from "@heroui/react";
import type {
  LeaseThreadList,
  LeaseThreadView,
  PlacementThreadList,
  PlacementThreadSummary,
  PlacementThreadView,
} from "@injishi/contracts";
import { ActionLink, ChatHeader, ChatInbox, EmptyBlock, type IconKey, PageContent } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { type ConversationSide, LeaseConversation, LiveDot } from "./LeaseConversation";

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

export type OpenConversation =
  | { kind: "lease"; view: LeaseThreadView }
  | { kind: "placement"; view: PlacementThreadView };

const openKeyOf = (open: OpenConversation | null) =>
  open ? `${open.kind}:${open.kind === "lease" ? open.view.leaseId : open.view.placementId}` : null;

/**
 * One inbox (P3.4; brokers 2026-10-26) on the shared ChatInbox: the conversations on the left, newest
 * activity first, with a search and All / Unread (and Brokers) filters; the open one on the right. On a
 * phone one pane shows at a time. The landlord sees tenants (`?lease=`) and brokers (`?placement=`);
 * the broker sees landlords. New lines arrive live; the list refreshes its counts when they do.
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
  empty: { title: string; href: string; icon: IconKey; label: string };
}) {
  const router = useRouter();
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
  const openKey = openKeyOf(open);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  if (rows.length === 0 && !open) {
    return (
      <PageContent>
        <AreaHeader title="Messages" />
        <Card className="p-6">
          <EmptyBlock
            icon="Comments"
            title={empty.title}
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

  const header =
    open?.kind === "lease" ? (
      <ChatHeader
        name={open.view.counterpartName}
        about={`Unit ${open.view.unitLabel} · ${open.view.propertyName}`}
        status={<LiveDot />}
        action={
          <ActionLink href={`/leases/${open.view.leaseId}`} icon="FileText" intent="ghost" size="sm">
            <span className="max-sm:sr-only">Lease {open.view.reference}</span>
          </ActionLink>
        }
      />
    ) : open?.kind === "placement" ? (
      <ChatHeader
        name={open.view.counterpartName}
        chip={
          <Chip size="sm" variant="soft" className="shrink-0">
            {side === "broker" ? "Landlord" : "Broker"}
          </Chip>
        }
        status={<LiveDot />}
        about={[placementWhere(open.view), open.view.tenantName ? `For ${open.view.tenantName}` : null]
          .filter(Boolean)
          .join(" · ")}
        action={
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
    ) : null;

  return (
    <PageContent>
      <AreaHeader title="Messages" />
      <ChatInbox
        rows={rows.map((r) => ({
          id: r.key,
          name: r.name,
          tag: r.tag,
          at: r.lastMessageAt,
          preview: r.preview ? `${r.fromMe ? "You: " : ""}${r.preview}` : null,
          unread: r.unread,
          search: r.search,
          group: r.kind === "placement" && side === "landlord" ? "brokers" : undefined,
        }))}
        groups={side === "landlord" ? [{ id: "brokers", label: "Brokers" }] : undefined}
        selectedId={openKey}
        onSelect={(key) => {
          const row = byKey.get(key);
          if (row && key !== openKey) router.push(row.href, { scroll: false });
        }}
        onBack={() => router.push("/messages", { scroll: false })}
        searchPlaceholder={searchPlaceholder}
        header={header}
      >
        {open ? (
          <LeaseConversation
            key={openKey}
            side={side}
            initial={open.view}
            workspaceId={open.kind === "placement" && side === "broker" ? null : workspaceId}
            selfName={selfName}
            onActivity={refreshList}
          />
        ) : null}
      </ChatInbox>
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
        href: "/broker/homes",
        icon: "Magnifier",
        label: "Find homes",
      }}
    />
  );
}
