"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Expenses" title="Couldn't load your expenses" onRetry={reset} />;
}
