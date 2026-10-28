"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { joinWorkspace, onConnection, onMessage } from "./realtime";

/**
 * Keeps the sidebar's message counts true (P3.4): when a line arrives in any of the person's lease
 * conversations, the shell re-reads (the counts come from the API with the page). Mounted once in the
 * shell for landlords and tenants. While the live line is down, it asks the unread count every 20
 * seconds and re-reads only when the count moved.
 */
export function MessagesLive({ workspaceId, unreadPath }: { workspaceId: string | null; unreadPath: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const known = useRef<number | null>(null);
  const live = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 600);
    };
    if (workspaceId) joinWorkspace(workspaceId);
    const off = onMessage(refresh);
    const offStatus = onConnection((up) => {
      live.current = up;
    });
    const poll = setInterval(async () => {
      if (live.current || document.visibilityState !== "visible") return;
      const response = await fetch(unreadPath, { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const { total } = (await response.json()) as { total: number };
      if (known.current !== null && known.current !== total) refresh();
      known.current = total;
    }, 20_000);
    return () => {
      off();
      offStatus();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router, workspaceId, unreadPath]);

  // A new page read the counts afresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every navigation
  useEffect(() => {
    known.current = null;
  }, [pathname]);

  return null;
}
