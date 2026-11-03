"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Move-outs" title="Couldn't load the move-outs" onRetry={reset} />;
}
