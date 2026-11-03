"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Maintenance" title="Couldn't load the repairs" onRetry={reset} />;
}
