"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="New lease" title="Couldn't open the new lease form" onRetry={reset} />;
}
