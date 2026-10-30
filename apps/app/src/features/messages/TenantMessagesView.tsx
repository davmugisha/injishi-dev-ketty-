"use client";

import { Avatar, Card } from "@heroui/react";
import type { LeaseThreadView } from "@injishi/contracts";
import { PageContent, PageHeader } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { LeaseConversation, LiveDot } from "./LeaseConversation";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** The tenant's conversation with their landlord (P3.4, blueprint 3.6), in the same shell as their home. */
export function TenantMessagesView({ thread, selfName }: { thread: LeaseThreadView; selfName: string | null }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The sidebar's count follows a read or a send.
  const refresh = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  };
  return (
    <PageContent>
      <PageHeader title="Messages" />
      <Card className="flex rounded-lg h-[min(780px,calc(100dvh-12rem))] min-h-[480px] flex-col gap-0 overflow-hidden p-0">
        <header className="flex items-center gap-3 border-b border-separator px-3 py-2.5 sm:px-4">
          <Avatar size="sm" variant="soft" className="shrink-0">
            <Avatar.Fallback>{initials(thread.counterpartName)}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="flex items-center gap-2 truncate text-sm font-semibold">
              {thread.counterpartName}
              <LiveDot />
            </h2>
            <span className="truncate text-xs text-muted">
              Unit {thread.unitLabel} · {thread.propertyName}
            </span>
          </div>
        </header>
        <LeaseConversation side="tenant" initial={thread} workspaceId={null} selfName={selfName} onActivity={refresh} />
      </Card>
    </PageContent>
  );
}
