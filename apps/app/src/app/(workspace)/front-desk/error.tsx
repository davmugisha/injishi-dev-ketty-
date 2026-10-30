"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Today" title="Couldn't load today at the desk" onRetry={reset} />;
}
