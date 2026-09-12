"use client";

/**
 * PMS providers for the whole operator surface. Mounted once at the app root so
 * the store survives a workspace switch (switching shouldn't reset the app).
 *
 * WHICH WORKSPACE IS IN VIEW IS NOT DECIDED HERE. It is decided by the
 * `[workspaceId]` param, in `app/w/[workspaceId]/layout.tsx`, and nowhere else
 * (ADR-018, invariant 1).
 *
 * There used to be a `RouteSync` here that read a workspace KIND back out of
 * `pathname.split("/")` and pushed it into the store. That was the second
 * source of truth this restructure removes: a URL naming a kind could not tell
 * two hotels apart, and when the store and the path disagreed the app rendered
 * one workspace's screens against the other's data.
 *
 * WHICH GATE STANDS IN FRONT IS DECIDED HERE, AND ONLY HERE (ADR-029). pms
 * serves two audiences now. `WorkspaceBoundary` refuses anyone holding no
 * workspace, which is correct for an operator and wrong for a government
 * officer: an officer holds an ASSIGNMENT and no workspace at all, so wrapping
 * the console in it would meet every officer with "No workspace yet" and never
 * draw a console. The console brings its own gate, `OfficerBoundary`, mounted in
 * `app/oversight/[console]/layout.tsx`.
 *
 * The path test lives in `isOversightPath` rather than inline, so the one place
 * that decides it is testable and a prefix collision cannot creep in. Reading
 * the pathname here is not the `RouteSync` mistake returning: this derives a
 * SURFACE for rendering and writes nothing into the store.
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { WorkspaceBoundary } from "@/pms/components/workspace-boundary";
import { makeQueryClient } from "@/pms/data/queries";
import { isOversightPath } from "@/pms/lib/surface";
import { PmsProvider } from "@/pms/store";
import { PmsUiProvider } from "@/pms/ui-store";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session. Built in state rather than at module scope
  // so a fast refresh in development does not hand two trees the same cache,
  // and so nothing is shared between requests if this ever renders on a server.
  const [queryClient] = useState(makeQueryClient);
  const pathname = usePathname();
  const oversight = isOversightPath(pathname ?? "");

  return (
    <QueryClientProvider client={queryClient}>
      <PmsProvider>
        <PmsUiProvider>
          {oversight ? children : <WorkspaceBoundary>{children}</WorkspaceBoundary>}
        </PmsUiProvider>
      </PmsProvider>
    </QueryClientProvider>
  );
}
