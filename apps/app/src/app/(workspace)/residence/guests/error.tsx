"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="My guests" title="Couldn't load your guests" onRetry={reset} />;
}
