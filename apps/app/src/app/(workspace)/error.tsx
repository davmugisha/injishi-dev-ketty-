"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

/** Any workspace page that failed to load, such as during an outage: the sidebar stays, with a Retry. */
export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Injishi" title="This page could not load" onRetry={reset} />;
}
