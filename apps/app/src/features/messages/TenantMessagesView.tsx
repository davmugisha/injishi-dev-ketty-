"use client";

import { Card } from "@heroui/react";
import type { LeaseThreadView } from "@injishi/contracts";
import { ChatHeader, PageContent } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { LeaseConversation, LiveDot } from "./LeaseConversation";

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
      <AreaHeader title="Messages" />
      <Card className="flex h-[min(780px,calc(100dvh-12rem))] min-h-[480px] flex-col gap-0 overflow-hidden rounded-xl p-0">
        <header className="flex items-center gap-3 border-b border-separator px-3 py-2.5 sm:px-4">
          <ChatHeader
            name={thread.counterpartName}
            about={`Unit ${thread.unitLabel} · ${thread.propertyName}`}
            status={<LiveDot />}
          />
        </header>
        <LeaseConversation side="tenant" initial={thread} workspaceId={null} selfName={selfName} onActivity={refresh} />
      </Card>
    </PageContent>
  );
}
